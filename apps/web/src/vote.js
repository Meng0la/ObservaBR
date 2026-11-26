import {el,link,button,empty,read,brDate,digits,evidence,sourceLink} from './ui.js'
import './vote.css'

const tabs={contexto:'Contexto',votos:'Votos nominais',partidos:'Partidos',orientacoes:'Orientações de bancada',
 relacionadas:'Proposições relacionadas',tramitacao:'Tramitação',documentos:'Documentos',fontes:'Fontes',api:'API'}
function table(headers,rows){
 return el('div',{class:'table-wrap',tabindex:0,'aria-label':'Tabela de dados legislativos'},
  el('table',{},el('thead',{},el('tr',{},...headers.map(h=>el('th',{scope:'col'},h)))),el('tbody',{},...rows)))
}
function pairs(items){
 return el('dl',{class:'metadata'},...items.flatMap(([key,value])=>[el('dt',{},key),el('dd',{},value??'Indisponível')]))
}
function entityLink(kind,id,title){
 return link(title||'Registro '+id,kind==='politician'?'#politician/'+encodeURIComponent(id):
  ['body','event'].includes(kind)?'#entidade/'+kind+'/'+encodeURIComponent(id):'#registro/'+kind+'/'+encodeURIComponent(id))
}
function rowSource(row){return button('Ver fonte original',()=>evidence(row),'source-button')}
function tally(value){
 const score=value.context?.score
 if(!score)return empty('Placar oficial ainda não contextualizado.')
 const entries=[['yes','Sim'],['no','Não'],['abstentions','Abstenções'],['obstructions','Obstruções']]
 const list=el('dl',{class:'vote-score'})
 for(const [key,label] of entries)list.append(el('div',{},el('dt',{},label),el('dd',{class:score[key]==null?'score-unavailable':'mono'},score[key]==null?'Não informado':digits.format(score[key]))))
 list.append(el('div',{},el('dt',{},'Total oficial'),el('dd',{class:'mono'},score.total==null?'Não informado':digits.format(score.total))))
 const positive=entries.filter(([key])=>typeof score[key]==='number')
 const sum=positive.reduce((n,[key])=>n+score[key],0)
 const box=el('section',{class:'vote-tally'},el('h2',{},'Placar proclamado'),list)
 if(score.total>0&&sum===score.total){
  const chart=el('div',{class:'vote-bars',role:'img','aria-label':'Distribuição do placar oficial, denominador '+score.total})
  positive.forEach(([key,label],index)=>{
   const percent=100*score[key]/score.total
   const segment=el('span',{class:'vote-segment segment-'+index,title:label+' · '+percent.toFixed(2)+'%'})
   segment.style.flexGrow=String(score[key])
   segment.textContent=score[key]?label+' '+percent.toFixed(1)+'%':''
   if(score[key])chart.append(segment)
  })
  box.append(chart,el('p',{class:'empty'},'Percentuais sobre o total oficial de '+digits.format(score.total)+' votos.'))
 }else box.append(el('p',{class:'empty'},'Distribuição proporcional indisponível: categorias e total não conciliados.'))
 box.append(el('p',{class:'coverage-note'},digits.format(value.nominalTotal)+' registros nominais indexados. A quantidade pode diferir do total proclamado. Ausências e presenças não são inferidas.'))
 box.append(el('details',{},el('summary',{},'Categorias dos registros nominais'),
  table(['Registro na fonte','Quantidade'],value.ballotCounts.map(item=>el('tr',{},el('td',{},item.vote),el('td',{class:'mono numeric'},digits.format(item.count)))))))
 return box
}
async function ballots(id,params,signal,value){
 const q=new URLSearchParams({kind:'ballot',voteId:id})
 for(const key of ['q','party','vote','uf','page','sort'])if(params.get(key))q.set(key,params.get(key))
 const result=await read('/api/records?'+q,signal)
 const form=el('form',{class:'filters'})
 form.append(el('label',{},'Nome do parlamentar',el('input',{type:'search',name:'q',value:params.get('q')||''})))
 for(const [name,label,values] of [['party','Partido no registro nominal',[...new Set(value.partyCounts.map(p=>p.party).filter(Boolean))]],
   ['vote','Voto registrado',value.ballotCounts.map(v=>v.vote)],['uf','UF',value.ufs||[]]]){
  const select=el('select',{name,'aria-label':label},el('option',{value:''},'Todos'),...values.map(v=>el('option',{value:v},v)))
  select.value=params.get(name)||''
  form.append(el('label',{},label,select))
 }
 form.append(el('button',{type:'submit'},'Filtrar votos'))
 form.onsubmit=e=>{
  e.preventDefault()
  location.hash='registro/vote/'+encodeURIComponent(id)+'/votos?'+new URLSearchParams(new FormData(form))
 }
 const rows=result.items.map(r=>{
  const person=el('div',{class:'person-cell'})
  if(r.data.photo)person.append(el('img',{src:r.data.photo,alt:'',class:'avatar',loading:'lazy',width:36,height:44,onerror:e=>e.currentTarget.remove()}))
  person.append(entityLink('politician',r.owner,r.data.deputy||r.owner))
  return el('tr',{},el('td',{},person),el('td',{},r.data.party||'Indisponível'),el('td',{},r.data.uf||'Indisponível'),
   el('td',{},r.data.vote),el('td',{class:'mono'},r.data.registered||'Indisponível'),el('td',{},rowSource(r)))
 })
 const pagination=el('nav',{class:'actions','aria-label':'Paginação dos votos'})
 const page=Number(params.get('page')||1)
 for(const [number,label] of [[page-1,'Anterior'],[page+1,'Próxima']]){
  if(number<1||(number>page&&page*25>=result.total))continue
  const next=new URLSearchParams(params);next.set('page',number)
  pagination.append(link(label,'#registro/vote/'+id+'/votos?'+next,'button'))
 }
 const exports=el('div',{class:'actions'},'Exportar página')
 for(const format of ['csv','json']){
  const query=new URLSearchParams(q);query.set('format',format)
  exports.append(el('a',{href:'/api/records?'+query,download:'votos.'+format},format.toUpperCase()))
 }
 return el('section',{},el('h2',{},'Votos nominais'),el('p',{class:'coverage-note'},'Partido, UF e fotografia reproduzem o registro nominal publicado para esta votação.'),
  form,exports,rows.length?table(['Parlamentar','Partido','UF','Voto','Horário na fonte','Fonte'],rows):empty('Nenhum registro nominal corresponde aos filtros.'),pagination)
}

export async function renderVote({main,id,view='contexto',params,signal}){
 const value=await read('/api/votes/'+encodeURIComponent(id),signal)
 if(signal.aborted)return
 const context=value.context
 const title=context?.title||'Votação '+id
 const heading=el('header',{class:'intro'},el('div',{},el('p',{class:'eyebrow'},'Câmara dos Deputados · Votação documentada'),
  el('h1',{},title),el('p',{},context?.mainProposal?.summary||context?.object||value.record.title)),rowSource(value.record))
 const nav=el('nav',{class:'tabs','aria-label':'Seções da votação'},...Object.entries(tabs).map(([key,label])=>
  el('a',{href:'#registro/vote/'+encodeURIComponent(id)+'/'+key,'aria-current':key===view?'page':null},label)))
 const body=el('section',{class:'vote-content'})
 main.replaceChildren(heading,nav,body)
 if(!context){
  body.append(empty('O detalhe contextual ainda não foi indexado. O registro e sua fonte permanecem disponíveis.'),rowSource(value.record))
  const status=el('p',{role:'status'},value.job?'Enriquecimento · '+value.job.status:'Coleta complementar disponível sob demanda.')
  body.append(status,button('Solicitar enriquecimento',async()=>{
   const response=await fetch('/api/enrichment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'vote',id}),signal})
   status.textContent=response.ok?'Enriquecimento solicitado. O Scout processará a fila.':'Não foi possível solicitar a coleta complementar.'
  }),button('Atualizar contexto',()=>renderVote({main,id,view,params,signal})))
  if(view!=='api'&&view!=='votos')return
 }
 if(view==='votos'){body.append(await ballots(id,params,signal,value));return}
 if(view==='api'){
  const {createExplorer}=await import('./explorer.js')
  body.append(await createExplorer({kind:'vote',id,signal}));return
 }
 if(!context)return
 if(view==='contexto'){
  body.append(pairs([['Proposição principal',context.mainProposal?entityLink('proposal',context.mainProposal.id,context.mainProposal.label):null],
   ['Objeto efetivamente votado',context.object],['Órgão',context.body?.id?entityLink('body',context.body.id,context.body.name||context.body.acronym):null],
   ['Data da sessão',brDate(context.date)],['Registro temporal na fonte',context.registeredAt],
   ['Sessão legislativa',context.eventId?entityLink('event',context.eventId,context.event?.name||context.eventId):null],['Resultado oficial',context.result]]),
   tally(value),link('Consultar votos nominais indexados','#registro/vote/'+id+'/votos','button'))
  if(context.lastPresentation)body.append(el('details',{class:'presentation'},el('summary',{},'Última apresentação registrada'),
   pairs([['Data',context.lastPresentation.date]]),el('p',{},context.lastPresentation.description||'Descrição indisponível')))
 }else if(view==='partidos'){
  body.append(el('h2',{},'Votos por partido no registro nominal'),table(['Partido','Voto','Registros'],value.partyCounts.map(p=>
   el('tr',{},el('td',{},p.party||'Indisponível'),el('td',{},p.vote),el('td',{class:'mono numeric'},digits.format(p.count))))))
 }else if(view==='orientacoes'){
  body.append(el('h2',{},'Orientações de bancada'),el('p',{class:'coverage-note'},'Orientações partidárias são instruções de bancada. Os votos individuais constam na lista nominal.'),
   context.orientations.length?table(['Partido ou bloco','Orientação'],context.orientations.map(p=>el('tr',{},el('td',{},p.party||'Indisponível'),el('td',{},p.vote||'Indisponível')))):empty('Orientações indisponíveis nesta coleta.'))
 }else if(view==='relacionadas'){
  const labels={affected:'Afetada',possible:'Objeto possível',object:'Objeto identificado'}
  body.append(el('h2',{},'Proposições relacionadas'),el('p',{class:'coverage-note'},'Os objetos possíveis são listados pela fonte. A condição de possível objeto não confirma o objeto efetivamente votado.'),
   table(['Proposição','Relação na fonte','Ementa'],context.related.map(p=>el('tr',{},el('td',{},p.id?entityLink('proposal',p.id,p.label||p.id):p.label||'Identificador indisponível'),el('td',{},labels[p.role]||p.role),el('td',{},p.summary||'Indisponível')))))
 }else if(view==='tramitacao'){
  body.append(el('h2',{},'Tramitação da proposição principal'),
   table(['Data','Órgão','Andamento'],context.timeline.map(p=>el('tr',{},el('td',{class:'mono'},p.date||'Indisponível'),el('td',{},p.body||'Indisponível'),
    el('td',{},el('p',{},p.description||'Indisponível'),el('p',{},p.detail||''),p.url?sourceLink('Documento oficial',p.url):null)))))
 }else if(view==='documentos'||view==='fontes'){
  body.append(el('h2',{},view==='fontes'?'Fontes e rastreabilidade':'Documentos consultados'),rowSource(value.record),
   table(['Recurso','Identificador','Origem'],context.sources.map(p=>el('tr',{},el('td',{},p.resource),el('td',{class:'mono'},p.id),el('td',{},sourceLink('Consultar fonte oficial',p.url))))),
   link('Consultar respostas coletadas','#registro/vote/'+id+'/api','button'))
  if(view==='fontes'&&context.evidence){
   const labels={title:'Título contextualizado',mainProposal:'Proposição principal',object:'Objeto votado',score:'Placar oficial',date:'Data da sessão',body:'Órgão legislativo',result:'Resultado'}
   const rows=[]
   for(const [field,proofs] of Object.entries(context.evidence)){
    if(!labels[field])continue
    for(const proof of proofs)rows.push(el('tr',{},el('td',{},labels[field]),el('td',{},sourceLink(proof.resource,proof.url)),el('td',{class:'mono'},proof.field),el('td',{class:'mono'},proof.sha256||'Indisponível')))
   }
   body.append(el('h3',{},'Evidências por campo'),table(['Informação','Recurso oficial','Campo consultado','SHA-256'],rows))
  }
 }
 if(context.authors?.length&&view==='contexto')body.append(el('h2',{},'Autoria da proposição principal'),el('ul',{},...context.authors.map(a=>el('li',{},a.id?entityLink('politician',a.id,a.name):a.name||'Indisponível',a.type?' · '+a.type:''))))
 if(context.issues?.length)body.append(el('section',{class:'notice'},el('h2',{},'Limitações das fontes'),el('ul',{},...context.issues.map(issue=>el('li',{},issue)))))
}
