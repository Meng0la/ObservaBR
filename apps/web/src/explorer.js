import {el,button,link,read,singular,brDate,currency,sourceLink} from './ui.js'
import './explorer.css'

const unavailable='Indisponível'
const recognized=new Set(['politician','expense','proposal','vote','ballot','body','event'])
const branchSize=30
const nodeLimit=500
const fieldScanLimit=15000
const searchLimit=40
let sequence=0

function scalar(value) {
  const type=value===null?'null':typeof value
  const text=JSON.stringify(value)??unavailable
  if(typeof value==='string'&&value.length<=2000){
    try{
      const url=new URL(value)
      if(url.protocol==='https:'&&!url.username&&!url.password){
        const match=url.hostname==='dadosabertos.camara.leg.br'&&url.pathname.match(/^\/api\/v2\/(deputados|proposicoes|votacoes|eventos|orgaos)\/([\d-]+)\/?$/)
        if(match){
          const kind={deputados:'politician',proposicoes:'proposal',votacoes:'vote',eventos:'event',orgaos:'body'}[match[1]]
          const target=kind==='politician'?'#politician/':kind==='body'||kind==='event'?'#entidade/'+kind+'/':'#registro/'+kind+'/'
          return el('a',{href:target+encodeURIComponent(match[2]),class:'explorer-reference'},text)
        }
        if(['dadosabertos.camara.leg.br','www.camara.leg.br'].includes(url.hostname))return el('a',{href:url.href,target:'_blank',rel:'noopener noreferrer'},text)
      }
    }catch{}
  }
  return el('span',{class:'explorer-value value-'+type},text.length>2000?text.slice(0,2000)+'… [texto abreviado]':text)
}
function collection(value) {
  return value!==null && typeof value==='object'
}
function shape(value) {
  if(!collection(value))return scalar(value)
  const array=Array.isArray(value)
  const size=array?value.length:Object.keys(value).length
  return el('span',{class:'explorer-shape'},array?'Array ['+size+']':'Objeto {'+size+'}')
}
function property(name) {
  return el('span',{class:'explorer-key'},JSON.stringify(String(name)),': ')
}
function tree(value,openRoot=true) {
  const root=el('div',{class:'explorer-tree'})
  function entry(key,current,depth) {
    const row=el('div',{class:'explorer-entry'})
    const label=key===null?null:property(key)
    if(!collection(current)) {
      if(label)row.append(label)
      row.append(scalar(current))
      return row
    }
    const details=el('details',{},el('summary',{},label,shape(current)))
    row.append(details)
    if(depth>=24) {
      details.append(el('p',{},'Limite de profundidade da visualização. A cópia inclui todo o conteúdo público.'))
      return row
    }
    const contents=el('div',{class:'explorer-children'})
    const keys=()=>Array.isArray(current)?null:Object.keys(current)
    let start=0
    function branch(change=0) {
      const fields=keys()
      const length=fields?fields.length:current.length
      start=Math.max(0,Math.min(start+change,Math.max(0,length-1)))
      contents.replaceChildren()
      const scope=root.closest('.explorer-pane')??root
      const space=nodeLimit-scope.querySelectorAll('.explorer-entry').length
      if(space<Math.min(branchSize,length)){
        contents.append(el('p',{},'Limite de itens abertos atingido. Recolha outros grupos e abra este novamente.'))
        return
      }
      for(let i=start;i<Math.min(length,start+branchSize);i++){
        const name=fields?fields[i]:i
        contents.append(entry(name,current[name],depth+1))
      }
      if(length>branchSize) {
        const controls=el('div',{class:'actions explorer-range'},(start+1)+'–'+Math.min(start+branchSize,length)+' de '+length)
        if(start>0)controls.append(button('Grupo anterior',()=>branch(-branchSize)))
        if(start+branchSize<length)controls.append(button('Grupo seguinte',()=>branch(branchSize)))
        contents.append(controls)
      }
      if(!length)contents.append(el('p',{class:'explorer-hint'},'Grupo vazio.'))
    }
    details.append(contents)
    details.ontoggle=()=>{
      if(details.open)branch()
      else contents.replaceChildren()
    }
    details.open=openRoot&&depth===0
    return row
  }
  root.append(entry(null,value,0))
  return root
}

// Percorre os índices de arrays sem criar elementos DOM para itens ocultos.
function fieldMatches(value,term) {
  const matches=[]
  let visited=0
  let truncated=false
  function search(object,path,depth) {
    if(!collection(object))return
    if(depth>=48){truncated=true;return}
    const array=Array.isArray(object)
    const keys=array?null:Object.keys(object)
    const length=array?object.length:keys.length
    for(let i=0;i<length;i++){
      if(++visited>fieldScanLimit || matches.length>=searchLimit){truncated=true;return}
      const key=array?String(i):keys[i]
      const child=object[key]
      const pointer=path+'/'+key.replaceAll('~','~0').replaceAll('/','~1')
      if(!array && key.toLocaleLowerCase('pt-BR').includes(term)) matches.push([pointer,child])
      search(child,pointer,depth+1)
    }
  }
  search(value,'',0)
  return {matches,truncated}
}
function publicJson(doc) {
  const status=el('p',{role:'status',class:'explorer-hint'})
  if(!Object.hasOwn(doc,'payload')||doc.payload===undefined)return el('p',{class:'empty'},'Conteúdo indisponível para consulta pública.')
  const value=doc.payload
  const content=el('div',{},tree(value))
  const keyword=el('input',{type:'search',maxlength:100,'aria-label':'Pesquisar campos no JSON',placeholder:'Nome do campo'})
  const controls=el('div',{class:'explorer-toolbar'},el('label',{},'Pesquisar campos',keyword))
  keyword.oninput=()=>{
    const query=keyword.value.toLocaleLowerCase('pt-BR').trim()
    if(!query){content.replaceChildren(tree(value));status.textContent='';return}
    const {matches,truncated}=fieldMatches(value,query)
    status.textContent=matches.length+' campos encontrados.'+(truncated?' Busca limitada a '+searchLimit+' resultados, '+fieldScanLimit+' itens ou 48 níveis.':'')
    const list=el('ul',{class:'explorer-matches'})
    for(const [pointer,child] of matches) list.append(el('li',{},el('code',{},pointer),collection(child)?tree(child,false):scalar(child)))
    content.replaceChildren(list)
  }
  const serialized=()=>JSON.stringify(value,null,2)
  controls.append(button('Copiar JSON',async()=>{
    try {await navigator.clipboard.writeText(serialized());status.textContent='Conteúdo público copiado.'}
    catch {status.textContent='O navegador bloqueou a cópia. Use a exportação JSON.'}
  }),button('Exportar JSON',()=>{
    const url=URL.createObjectURL(new Blob([serialized()],{type:'application/json;charset=utf-8'}))
    const a=el('a',{href:url,download:'observabr-evidencia.json'})
    a.click()
    setTimeout(()=>URL.revokeObjectURL(url),1000)
    status.textContent='Exportação do conteúdo público iniciada.'
  }))
  const changed=Array.isArray(doc.suppressedFields)&&doc.suppressedFields.length>0
  const title=changed?'Resposta coletada com campos suprimidos':doc.original===true?'Resposta original da API':'Recorte público da resposta coletada'
  const box=el('div',{},el('h3',{},title))
  if(changed)box.append(el('details',{class:'coverage-note'},el('summary',{},'Campos suprimidos · '+doc.suppressedFields.length),
    el('ul',{class:'explorer-links'},...doc.suppressedFields.map(path=>el('li',{},el('code',{},path))))))
  box.append(controls,status,content)
  return box
}
function pairs(entries) {
  const dl=el('dl',{class:'metadata'})
  for(const [name,value] of entries)dl.append(el('dt',{},name),el('dd',{},value??unavailable))
  return dl
}
function timestamp(value) {
  if(!value)return unavailable
  const d=new Date(value)
  return Number.isNaN(d.getTime())?unavailable:new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'long',timeZone:'America/Sao_Paulo'}).format(d)
}
function officialLink(raw) {
  try {
    const url=new URL(raw)
    if(url.protocol==='https:'&&!url.username&&!url.password)return sourceLink(url.href,url.href)
  } catch {}
  return null
}
function sourceMetadata(doc,kind) {
  return pairs([
    ['Instituição',doc.institution??(recognized.has(kind)?'Câmara dos Deputados':null)],['Recurso',doc.resource],
    ['Endpoint original',officialLink(doc.api_url)],['Publicação original',officialLink(doc.source_url)],['Método HTTP',doc.method],['Identificador externo',doc.externalId],
    ['Documento no índice',doc.id],['Coleta (Brasília)',timestamp(doc.collected_at)],['Última verificação (Brasília)',timestamp(doc.verified_at)],
    ['SHA-256 do conteúdo coletado',doc.sha256],['Aplicação do hash',doc.original===false?'Conteúdo coletado antes da supressão de campos':'Conteúdo coletado na fonte'],
    ['Versão do coletor',doc.collector_version],['Versão da projeção pública',doc.projection_version??doc.collector_version],
    ['Situação da validação',doc.verification_status==='collected'?'Coletado; integridade registrada':doc.verification_status]
  ])
}
function interpreted(record,relations) {
  if(!record)return el('p',{class:'empty'},'Registro interpretado indisponível.')
  const box=el('div',{},el('h3',{},record.title||'Registro normalizado'),pairs([
    ['Tipo de registro',singular[record.kind]??record.kind],['Identificador no índice',record.id],
    ['Data do registro',brDate(record.date)],...(record.kind==='expense'?[['Valor líquido',currency(record.amount)]]:[])
  ]))
  if(record.data&&Object.keys(record.data).length)box.append(el('h4',{},'Campos normalizados pelo ObservaBR'),tree(record.data))
  const linked=relations.filter(r=>recognized.has(r.kind)&&r.id)
  if(linked.length){
    const list=el('ul',{class:'explorer-links'})
    for(const r of linked){
      const id=encodeURIComponent(r.id)
      list.append(el('li',{},link(r.title||singular[r.kind]+' '+r.id,r.kind==='politician'?'#politician/'+id:['body','event'].includes(r.kind)?'#entidade/'+r.kind+'/'+id:'#registro/'+r.kind+'/'+id)))
    }
    box.append(el('h4',{},'Registros relacionados'),list)
  }
  return box
}

export async function createExplorer({kind,id,signal}) {
  const root=el('section',{class:'api-explorer'},el('h2',{},'ObservaBR API Explorer'))
  let evidence
  try { evidence=await read('/api/evidence/'+encodeURIComponent(kind)+'/'+encodeURIComponent(id),signal) }
  catch(error) {
    if(signal?.aborted)throw error
    root.append(el('p',{class:'notice',role:'status'},'Não foi possível carregar as evidências deste registro.'),
      button('Tentar novamente',async e=>{
        e.currentTarget.disabled=true
        try {const retry=await createExplorer({kind,id,signal});if(!signal?.aborted)root.replaceWith(retry)}
        catch(err){if(!signal?.aborted)throw err}
      }))
    return root
  }
  const docs=Array.isArray(evidence.documents)?evidence.documents:[]
  if(evidence.documentsTruncated)root.append(el('p',{class:'coverage-note'},'O limite de volume desta consulta foi atingido. Outras versões podem ser conferidas nas fontes oficiais.'))
  const uid='explorer-'+(++sequence)
  const tabs=el('div',{role:'tablist','aria-label':'Formas de consulta',class:'explorer-tabs'})
  const pane=el('div',{id:uid+'-panel',role:'tabpanel',tabindex:0,class:'explorer-pane'})
  const selector=el('select',{'aria-label':'Documento consultado'},...docs.map((doc,index)=>el('option',{value:index},(doc.resource||'Documento')+' · '+(doc.externalId??doc.id))))
  const source=el('label',{class:'explorer-source'},'Documento consultado',selector)
  const noDocs=()=>el('p',{class:'empty'},'Nenhum documento disponível para este registro.')
  let tab=0
  function show(index) {
    tab=index
    const selected=docs[Number(selector.value)]
    for(const [i,b] of Array.from(tabs.children).entries()){
      b.setAttribute('aria-selected',String(i===tab))
      b.tabIndex=i===tab?0:-1
    }
    source.hidden=tab===0||docs.length<2
    pane.setAttribute('aria-labelledby',uid+'-tab-'+tab)
    if(!tab)pane.replaceChildren(interpreted(evidence.normalized,evidence.relations||[]))
    else if(!selected)pane.replaceChildren(noDocs())
    else pane.replaceChildren(tab===1?publicJson(selected):sourceMetadata(selected,kind))
  }
  const labels=['Dados interpretados','Resposta original','Metadados da fonte']
  labels.forEach((label,i)=>{
    const b=el('button',{type:'button',role:'tab',id:uid+'-tab-'+i,'aria-controls':pane.id,onclick:()=>show(i)},label)
    b.onkeydown=e=>{
      const move={ArrowRight:(i+1)%3,ArrowLeft:(i+2)%3,Home:0,End:2}[e.key]
      if(typeof move==='number'){e.preventDefault();show(move);tabs.children[move].focus()}
    }
    tabs.append(b)
  })
  selector.onchange=()=>show(tab)
  root.append(tabs,source,pane)
  show(0)
  return root
}
