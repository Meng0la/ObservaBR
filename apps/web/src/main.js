import './fonts.css'
import './tokens.css'
import './style.css'
import './observa-eye.js'
import {el, link, button, empty, icon, names, singular, statusLabel, currency, brDate, digits, read, evidence, sourceLink} from './ui.js'
import {ufByCode, origin, drawMap, drawHistory, drawAffiliation} from './visuals.js'

const main = document.querySelector('main')
const search = document.querySelector('#search')
const sources = 'https://dadosabertos.camara.leg.br/swagger/api.html'
const ufs = Object.values(ufByCode).sort()
let routeController
const route = () => (location.hash.slice(1) || 'panorama').split('?')
const navigate = (path, params={}) => {
  const query = new URLSearchParams(Object.entries(params).filter(([,v])=>v!=='' && v!=null)).toString()
  location.hash = path + (query ? '?' + query : '')
}
const sectionTitle = (title, extra) => el('div',{class:'section-title'},el('h2',{},title),extra)
const panel = (title, content, extra) => el('section',{class:'panel'},sectionTitle(title,extra),content)
const intro = (title, subtitle, meta) => el('header',{class:'intro'},el('div',{},el('h1',{},title),el('p',{},subtitle)),meta)
const detail = (row) => button('Ver fonte original',()=>evidence(row),'source-button')
function portrait(person,profile=false) {
  return el('img',{class:profile?'avatar profile-avatar':'avatar',src:person.data.photo,
    alt:profile?'Fotografia institucional de '+person.title:'',width:profile?72:36,height:profile?92:44,
    loading:'lazy',referrerpolicy:'no-referrer',onerror:event=>{
      event.currentTarget.replaceWith(el('span',{class:'avatar','aria-label':'Fotografia indisponível',title:'Fotografia indisponível'},'—'))
    }})
}
const fieldNames = {uf:'UF',party:'Partido',category:'Categoria',supplier:'Fornecedor',vote:'Voto registrado',
  voteId:'Identificador da votação',year:'Ano',month:'Mês',body:'Órgão legislativo',number:'Número',type:'Tipo',gross:'Valor bruto',withheld:'Glosa',cnpj:'CNPJ',
  summary:'Ementa',object:'Objeto votado',description:'Descrição oficial',result:'Aprovação (código da fonte)',registered:'Registro do voto',deputy:'Nome parlamentar',proposalId:'Identificador da proposição'}
const navItems=[['panorama','overview','Panorama'],['pesquisa','search','Pesquisa global'],['registros/politician','politician','Representantes'],['registros/expense','expense','Despesas'],['registros/proposal','proposal','Proposições'],['registros/vote','vote','Votações'],['fontes','sources','Fontes e cobertura']]
const nav=document.querySelector('#nav')
nav.append(...navItems.map(([path,symbol,label])=>el('a',{href:'#'+path},icon(symbol),label)))
const theme=document.querySelector('#theme')
theme.append(icon('theme'))
function setTheme(value) {
  document.documentElement.dataset.theme=value
  theme.setAttribute('aria-label', value==='light'?'Ativar tema escuro':'Ativar tema claro')
}
try { setTheme(localStorage.getItem('observabr-theme') || 'dark') } catch {setTheme('dark')}
theme.onclick=()=>{
  const next=document.documentElement.dataset.theme==='light'?'dark':'light'
  setTheme(next)
  try { localStorage.setItem('observabr-theme',next) } catch {}
  render()
}
document.querySelector('#search-icon').append(icon('search'))
search.onsubmit=e=>{e.preventDefault(); navigate('pesquisa',{q:search.q.value.trim()})}
let suggestTimer
let suggestionsController
search.q.oninput=()=>{
  clearTimeout(suggestTimer)
  suggestionsController?.abort()
  const term=search.q.value.trim()
  const list=document.querySelector('#suggestions')
  list.replaceChildren()
  if(term.length<3) return
  suggestionsController=new AbortController()
  const signal=suggestionsController.signal
  suggestTimer=setTimeout(async()=>{
    try {
      const result=await read('/api/records?'+new URLSearchParams({q:term}),signal)
      list.replaceChildren(...[...new Set(result.items.map(r=>r.title))].slice(0,8).map(t=>el('option',{value:t})))
    } catch {}
  },350)
}
document.addEventListener('keydown',e=>{
  if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)){
    e.preventDefault();search.q.focus()
  }
})
document.querySelector('.skip').onclick=e=>{e.preventDefault();main.focus()}
function recordsTable(rows) {
  if(!rows.length) return empty('Nenhum registro indexado para esta consulta. A cobertura pode estar parcial ou com coleta pendente.')
  const people=rows.every(r=>r.kind==='politician')
  const financial=rows.every(r=>r.kind==='expense')
  const body=el('tbody')
  rows.forEach(r=>{
    const href=r.kind==='politician'?'#politician/'+encodeURIComponent(r.id):'#registro/'+r.kind+'/'+encodeURIComponent(r.id)
    const name=el('div',{class:people?'person-cell':null})
    if(people&&r.data?.photo) name.append(portrait(r))
    name.append(el('div',{},link(r.title,href),el('small',{},people?'Câmara dos Deputados · ID '+r.id:singular[r.kind])))
    const row=el('tr',{},el('td',{},name))
    if(people) row.append(el('td',{},r.data?.party||'Indisponível'),el('td',{class:'mono'},r.data?.uf||'—'))
    else row.append(el('td',{class:'mono numeric'},financial?currency(r.amount):brDate(r.date)))
    row.append(el('td',{},detail(r)))
    body.append(row)
  })
  const labels=people?['Representante','Partido','UF','Fonte']:['Registro',financial?'Valor líquido':'Data do registro','Fonte']
  return el('div',{class:'table-wrap',tabindex:0,'aria-label':'Tabela de registros, com rolagem quando necessária'},
    el('table',{},el('thead',{},el('tr',{},...labels.map(label=>el('th',{scope:'col'},label)))),body))
}

function jobList(rows) {
  if(!rows.length) return empty('Aguardando a primeira coleta.')
  return el('ul',{class:'jobs'},...rows.slice(0,8).map(job=>el('li',{},el('span',{class:'job-icon'},icon('database')),
    el('div',{},el('strong',{},names[job.kind] || job.kind),el('small',{},brDate(job.updated_at))),
    el('span',{class:'badge '+job.status},statusLabel[job.status]||job.status))))
}
async function dashboard(signal) {
  const requests=await Promise.allSettled(['/api/summary','/api/records?kind=vote','/api/records?kind=expense','/api/records?kind=proposal'].map(url=>read(url,signal)))
  if(signal.aborted)return
  const data=requests[0].status==='fulfilled'?requests[0].value:null
  const states=data?.states||[]
  const choose=uf=>navigate('registros/politician',{uf})
  const select=el('select',{'aria-label':'Consultar representantes por UF',onchange:e=>{if(e.target.value)choose(e.target.value)}},
    el('option',{value:''},'Selecionar UF'),...ufs.map(uf=>el('option',{value:uf},uf)))
  const mapHost=el('div',{class:'map-canvas',role:'region','aria-label':'Mapa do Brasil. Use a lista de UFs para navegar pelo teclado.'})
  const map=el('section',{class:'map-panel'},sectionTitle('Representação no índice',select),
    el('div',{class:'map-stage'},mapHost),
    el('div',{class:'map-foot'},el('span',{},el('i',{class:'swatch'}),' Com registros'),el('span',{},el('i',{class:'swatch off'}),' Sem registros'),sourceLink('Malha IBGE',origin)))
  const find=el('form',{class:'home-search',role:'search'},el('label',{for:'home-query'},'Encontre um representante'),
    el('div',{},el('input',{id:'home-query',name:'q',type:'search',placeholder:'Nome parlamentar, partido ou estado',maxlength:120}),el('button',{type:'submit'},'Pesquisar')))
  find.onsubmit=e=>{e.preventDefault();navigate('registros/politician',{q:new FormData(find).get('q')})}
  const labels={politician:'Representantes indexados',expense:'Despesas indexadas',proposal:'Proposições vinculadas',vote:'Votações coletadas',ballot:'Votos nominais disponíveis'}
  const metrics=el('section',{class:'metrics','aria-label':'Indicadores indexados'},...Object.entries(labels).map(([kind,label])=>
    el('a',{href:'#registros/'+kind,class:'metric'},el('strong',{},data?digits.format((kind==='proposal'?data.counts.proposalLinks:data.counts[kind])??data.counts[kind]??0):'—'),el('span',{},label))))
  const hero=el('header',{class:'home-hero'},el('div',{},el('p',{class:'eyebrow'},'Observatório de dados públicos'),
    el('h1',{},'A atividade pública,',el('br'),'à vista de todos.'),
    el('p',{},'Consulte representantes, despesas e decisões legislativas. Cada registro acompanha o caminho até a fonte.')),find)
  const coverage=el('aside',{class:'coverage-copy'},el('p',{class:'eyebrow'},'O alcance dos dados'),el('h2',{},'Uma fonte integrada.\nCobertura em construção.'),
    el('p',{},'Dados Abertos da Câmara dos Deputados. O mapa localiza as UFs dos deputados federais indexados.'),
    el('p',{class:'coverage-note'},'Cobertura parcial. Os registros financeiros aguardam conciliação. Os períodos e a disponibilidade variam entre conjuntos.'),
    link('Consultar fontes e períodos','#fontes','text-link'),
    el('p',{class:'stamp'},data?.lastVerified?'Índice verificado em '+brDate(data.lastVerified):data?'Sem verificação registrada':'API indisponível'))
  const section=(index,title,kind)=>{
    const result=requests[index]
    return el('section',{class:'activity-section'},sectionTitle(title,link('Ver todos','#registros/'+kind)),
      result.status==='fulfilled'?recordsTable(result.value.items.slice(0,4)):empty('Consulta indisponível. Tente novamente.'))
  }
  main.replaceChildren(hero,metrics,el('div',{class:'coverage-layout'},coverage,map),
    el('div',{class:'activity-grid'},section(1,'Decisões legislativas recentes','vote'),section(2,'Registros financeiros disponíveis','expense')),
    section(3,'Proposições no índice','proposal'))
  if(!data)main.prepend(el('div',{class:'notice',role:'status'},'Índice indisponível. ',button('Tentar novamente',render,'text-button')))
  drawMap(mapHost,states,choose,signal).catch(()=>{if(!signal.aborted)mapHost.replaceChildren(empty('Mapa indisponível. Consulte pela lista de UFs.'))})
}

function filters(kind,params,path,parties=[]) {
  const form=el('form',{class:'filters'})
  const select=el('select',{name:'uf'},el('option',{value:''},'Todas'),...ufs.map(uf=>el('option',{value:uf},uf)))
  select.value=params.get('uf')||''
  form.append(el('label',{},'Termo',el('input',{name:'q',type:'search',maxlength:120,value:params.get('q')||''})),el('label',{},'UF do representante',select))
  if(kind==='politician'&&parties.length) {
    const party=el('select',{name:'party','aria-label':'Partido'},el('option',{value:''},'Todos'),...parties.map(value=>el('option',{value},value)))
    party.value=params.get('party')||''
    form.append(el('label',{},'Partido',party))
  }
  if(kind!=='politician')form.append(el('label',{},'De',el('input',{name:'from',type:'date',value:params.get('from')||''})),
    el('label',{},'Até',el('input',{name:'to',type:'date',value:params.get('to')||''})))
  const options=kind==='politician'?[['name-asc','Nome A–Z'],['name-desc','Nome Z–A']]:[['date-desc','Mais recentes'],['date-asc','Mais antigos'],['name-asc','Título A–Z']]
  if(kind==='expense')options.push(['amount-desc','Maior valor'],['amount-asc','Menor valor'])
  const order=el('select',{name:'sort','aria-label':'Ordenação'},el('option',{value:''},'Padrão'),...options.map(([value,label])=>el('option',{value},label)))
  order.value=params.get('sort')||''
  form.append(el('label',{},'Ordenação',order),el('button',{type:'submit'},'Aplicar'))
  form.onsubmit=e=>{
    e.preventDefault()
    const values=Object.fromEntries(new FormData(form))
    if(params.has('voteId'))values.voteId=params.get('voteId')
    if(values.from&&values.to&&values.from>values.to){form.elements.to.setCustomValidity('Escolha uma data posterior ao início.');form.reportValidity();form.elements.to.setCustomValidity('');return}
    navigate(path,values)
  }
  return form
}
async function requestCollection(name, box, signal) {
  box.replaceChildren(empty('Enfileirando consulta…'))
  try {
    const r=await fetch('/api/requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name}),signal})
    if(!r.ok) throw new Error('Solicitação não aceita.')
    const job=await r.json()
    const show=async()=>{
      try{
        const state=await read('/api/requests/'+encodeURIComponent(job.id),signal)
        box.replaceChildren(el('p',{},'Consulta oficial · '+(statusLabel[state.status]||state.status)), state.status==='done'?button('Recarregar resultados',render):button('Atualizar andamento',show))
      } catch {if(!signal.aborted)box.replaceChildren(empty('Andamento indisponível.'),button('Consultar novamente',show))}
    }
    await show()
  } catch { if(!signal.aborted)box.replaceChildren(empty('Não foi possível solicitar a consulta.'),button('Tentar novamente',()=>requestCollection(name,box,signal))) }
}
async function results(kind, owner, params, path, signal) {
  const query=new URLSearchParams()
  for(const key of ['q','uf','party','sort','from','to','page','voteId']) if(params.get(key)) query.set(key,params.get(key))
  if(kind) query.set('kind',kind)
  if(owner) query.set('owner',owner)
  const base='/api/records?'
  const result=await read(base+query,signal)
  const page=Math.max(1,Number(query.get('page')||1))
  const pager=el('div',{class:'actions'})
  function pageLink(number,label) {
    const next=new URLSearchParams(params)
    next.set('page',number)
    return link(label,'#'+path+'?'+next,'button')
  }
  if(page>1)pager.append(pageLink(page-1,'Anterior'))
  if(page*25<result.total)pager.append(pageLink(page+1,'Próxima'))
  const exportLink=format=>{
    const fields=new URLSearchParams(query);fields.set('format',format)
    return el('a',{href:base+fields,download:'observabr.'+format},format.toUpperCase())
  }
  const box=el('div',{},sectionTitle(digits.format(result.total)+' registros',el('div',{class:'actions'},'Exportar página',exportLink('csv'),exportLink('json'))),recordsTable(result.items),pager)
  const term=params.get('q')?.trim()
  if(!owner&&!result.items.length&&term?.length>=3&&term.length<=100&&/^[\p{L}\p{M} '\-]+$/u.test(term)&&(!kind||kind==='politician')){
    const action=el('div',{class:'notice'})
    action.append(button('Solicitar busca de deputado na Câmara',()=>requestCollection(term,action,signal)))
    box.append(action)
  }
  return box
}
async function listings(path,kind,params,signal) {
  const title=names[kind]||'Pesquisa global'
  const box=el('section',{class:'panel'},empty('Consultando o índice…'))
  const summary=kind==='politician'?await read('/api/summary',signal):null
  if(signal.aborted)return
  main.replaceChildren(intro(title,params.has('voteId')?'Votos individuais publicados para a votação '+params.get('voteId'):kind==='politician'?'Deputados federais presentes no índice da Câmara dos Deputados.':'Registros documentados · cobertura parcial.'),filters(kind,params,path,summary?.parties||[]),box)
  if(kind==='expense')box.before(el('p',{class:'coverage-note'},'Conciliação pendente. Os valores apresentados correspondem aos lançamentos indexados.'))
  box.replaceChildren(await results(kind,null,params,path,signal))
}
async function profile(path,id,tab,params,signal) {
  const person=await read('/api/records/politician/'+encodeURIComponent(id),signal)
  if(signal.aborted)return
  const base='politician/'+encodeURIComponent(id)
  const tabs={geral:'Visão geral',expense:'Despesas',ballot:'Votos nominais',proposal:'Proposições',fontes:'Fontes',vinculos:'Relacionamentos'}
  if(!Object.hasOwn(tabs,tab)) tab='geral'
  const content=el('section',{class:'panel'})
  main.replaceChildren(intro(person.title,['Câmara dos Deputados',person.data?.party,person.data?.uf].filter(Boolean).join(' · '),detail(person)),
    el('nav',{class:'tabs','aria-label':'Seções do perfil'},...Object.entries(tabs).map(([slug,label])=>el('a',{href:'#'+base+'/'+slug,'aria-current':tab===slug?'page':null},label))),content)
  const heading=main.querySelector('.intro')
  heading.classList.add('profile-heading')
  if(person.data?.photo)heading.prepend(portrait(person,true))
  heading.append(el('span',{class:'stamp'},'Última verificação · '+brDate(person.verified_at)))
  if(tab==='geral'){
    content.append(sectionTitle('Dados institucionais'),el('dl',{class:'metadata'},
      el('dt',{},'Identificador na Câmara'),el('dd',{},person.id),el('dt',{},'Partido'),el('dd',{},person.data?.party||'Indisponível'),
      el('dt',{},'UF'),el('dd',{},person.data?.uf||'Indisponível'),el('dt',{},'Legislatura'),el('dd',{},person.data?.legislature||'Indisponível'),
      el('dt',{},'Última verificação'),el('dd',{},brDate(person.verified_at))))
  } else if(tab==='fontes'){
    content.append(sectionTitle('Fonte institucional'),el('p',{},'Dados Abertos da Câmara dos Deputados · '+brDate(person.verified_at)),detail(person))
    const {createExplorer}=await import('./explorer.js')
    if(!signal.aborted)content.append(await createExplorer({kind:'politician',id,signal}))
  } else if(tab==='vinculos'){
    content.append(sectionTitle('Vínculo institucional',detail(person)))
    await drawAffiliation(content,person,signal)
  } else {
    content.append(filters(tab,params,path),await results(tab,id,params,path,signal))
    if(tab==='expense'){
      const chart=el('div')
      main.append(el('p',{class:'coverage-note'},'Histórico parcial. A conciliação das despesas permanece pendente. Os valores refletem os registros indexados.'),panel('Despesas líquidas por mês · histórico indexado',chart))
      try{await drawHistory(chart,await read('/api/history/'+encodeURIComponent(id),signal),signal)}
      catch{if(!signal.aborted)chart.replaceChildren(empty('Histórico indisponível.'))}
    }
  }
}
async function record(kind,id,signal) {
  const item=await read('/api/records/'+encodeURIComponent(kind)+'/'+encodeURIComponent(id),signal)
  if(signal.aborted)return
  const dl=el('dl',{class:'metadata'})
  for(const [key,value] of Object.entries(item.data||{})){
    if(value!=null&&fieldNames[key]&&['number','string'].includes(typeof value)) dl.append(el('dt',{},fieldNames[key]),el('dd',{},String(value)))
  }
  if(item.amount!=null)dl.append(el('dt',{},'Valor líquido'),el('dd',{},currency(item.amount)))
  dl.append(el('dt',{},'Data'),el('dd',{},brDate(item.date)))
  main.replaceChildren(intro(item.title,singular[kind]||'Registro',detail(item)),panel('Registro oficial',dl))
  if(kind==='proposal'&&item.data.detailPending){
    const status=el('p',{class:'notice',role:'status'},'Referência institucional identificada. A ficha complementar ainda está pendente.')
    main.append(status,button('Solicitar ficha complementar',async()=>{
      const response=await fetch('/api/enrichment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,id}),signal})
      status.textContent=response.ok?'Coleta complementar solicitada. Consulte novamente após o processamento do Scout.':'Não foi possível solicitar a coleta.'
    }))
  }
  if(item.owner&&['ballot','expense','proposal'].includes(kind)) main.append(link('Consultar perfil relacionado','#politician/'+encodeURIComponent(item.owner),'button'))
  if(kind==='ballot'&&item.data?.voteId) main.append(link('Consultar votação','#registro/vote/'+encodeURIComponent(item.data.voteId),'button'))
  if(kind==='vote') main.append(el('p',{class:'notice'},'O resultado se refere ao objeto descrito pela Câmara. Esse objeto pode ser um requerimento, destaque, emenda ou outro procedimento.'),link('Consultar votos nominais indexados','#registros/ballot?'+new URLSearchParams({voteId:id}),'button'))
  if(kind==='vote'&&item.data?.proposalUrl)main.append(sourceLink('Consultar proposição na Câmara',item.data.proposalUrl))
  const {createExplorer}=await import('./explorer.js')
  const explorer=await createExplorer({kind,id,signal})
  if(!signal.aborted)main.append(explorer)
}
const pages={
  apoiar:['Apoiar o projeto','O ObservaBR é independente. Nesta etapa, contribuições podem ser feitas com revisão de código, documentação e indicação de fontes oficiais, conforme CONTRIBUTING.md no repositório. O financiamento do projeto será documentado em etapa futura.'],
  metodologia:['Metodologia','O Scout consulta páginas da API de Dados Abertos da Câmara. O índice conserva o identificador oficial, o campo consultado, a data de verificação e o hash da resposta. A opção “Ver fonte original” permite conferir a publicação.'],
  privacidade:['Privacidade','O índice apresenta dados relativos à atuação pública. A preferência de tema fica armazenada no navegador. A API recebe os termos informados para responder às consultas. Evite inserir dados pessoais nos campos de busca.'],
  licenca:['Licenciamento','Consulte o arquivo LICENSE distribuído com o código do ObservaBR. Os registros governamentais e a malha cartográfica preservam suas origens e condições de reutilização.'],
  limites:['Limitações conhecidas','O índice reflete as páginas e os períodos efetivamente processados pelo Scout. Lacunas podem ocorrer entre coletas ou quando uma fonte fica indisponível. A cobertura estadual, municipal, contratual e eleitoral depende de integrações adicionais.'],
  correcao:['Solicitação de correção','Para relatar divergência ao mantenedor da instalação, inclua o identificador do registro, o campo questionado e o link da publicação oficial. O SHA-256 e o horário da verificação estão em “Ver fonte original”.']
}
async function render(){
  routeController?.abort()
  routeController=new AbortController()
  const signal=routeController.signal
  const [path,query]=route()
  const params=new URLSearchParams(query)
  const [page,rawId,rawTab,view]=path.split('/')
  search.q.value=params.get('q')||''
  const current=page==='politician'?'registros/politician':page==='registro'?'registros/'+rawId:path
  for(const item of nav.children){if(item.hash==='#'+current)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current')}
  main.className=page==='panorama'?'home':page==='politician'?'profile-page':''
  main.setAttribute('aria-busy','true')
  main.replaceChildren(empty('Carregando consulta…'))
  try{
    if(page==='panorama') await dashboard(signal)
    else if(page==='pesquisa'||(page==='registros'&&Object.hasOwn(names,rawId))) await listings(path,rawId,params,signal)
    else if(page==='politician'&&rawId) await profile(path,decodeURIComponent(rawId),rawTab||'geral',params,signal)
    else if(page==='registro'&&rawId==='vote'&&rawTab){
      const {renderVote}=await import('./vote.js')
      if(!signal.aborted)await renderVote({main,id:decodeURIComponent(rawTab),view:view||'contexto',params,signal})
    }
    else if(page==='registro'&&Object.hasOwn(names,rawId)&&rawTab) await record(rawId,decodeURIComponent(rawTab),signal)
    else if(page==='entidade'&&['body','event'].includes(rawId)&&rawTab){
      const data=await read('/api/entities/'+rawId+'/'+encodeURIComponent(rawTab),signal)
      if(signal.aborted)return
      const source=data.payload.dados
      main.replaceChildren(intro(source.nome||source.descricaoTipo||'Documento institucional',source.descricao||'Fonte institucional da Câmara'),sourceLink('Fonte institucional',data.api_url))
      const {createExplorer}=await import('./explorer.js')
      const explorer=await createExplorer({kind:rawId,id:decodeURIComponent(rawTab),signal})
      if(!signal.aborted)main.append(explorer)
    }
    else if(page==='fontes'){
      const summary=await read('/api/summary',signal)
      if(signal.aborted)return
      main.replaceChildren(intro('Fontes e cobertura','Integrações, abrangência do índice e histórico recente.'),
        panel('Câmara dos Deputados',el('div',{},el('p',{},'Esfera federal · API de Dados Abertos · cobertura parcial'),sourceLink('Documentação oficial',sources),
          el('ul',{class:'counts'},...Object.entries(names).map(([kind,name])=>el('li',{},link(name,'#registros/'+kind),el('b',{},digits.format(summary.counts[kind]||0))))))),
        panel('Histórico de atualizações',jobList(summary.jobs)),link('Limitações conhecidas','#limites'))
      const periodRows=(summary.periods||[]).map(p=>el('tr',{},el('td',{},names[p.kind]),el('td',{class:'mono'},brDate(p.from)),el('td',{class:'mono'},brDate(p.to))))
      const coverageRows=(summary.coverage||[]).map(c=>el('tr',{},el('td',{},names[c.kind]),...['done','queued','running','failed'].map(key=>el('td',{class:'mono numeric'},digits.format(c[key]||0)))))
      const table=(headers,rows)=>el('div',{class:'table-wrap'},el('table',{},el('thead',{},el('tr',{},...headers.map(label=>el('th',{scope:'col'},label)))),el('tbody',{},...rows)))
      main.append(panel('Datas documentais observadas',table(['Conjunto','Primeira data','Última data'],periodRows)),
        el('p',{class:'coverage-note'},'As datas descrevem os registros presentes no índice. Lacunas entre essas datas podem existir. A ausência de data permanece indisponível.'),
        panel('Processamento dos conjuntos',table(['Conjunto','Concluídas','Pendentes','Em andamento','Com falha'],coverageRows)))
      if(summary.coverage?.some(c=>c.failed>0))main.append(el('p',{class:'notice'},'Há coletas com falha. O acervo já indexado permanece disponível. Consulte as limitações antes de interpretar totais.'))
    } else if(page==='sistema'){
      const {designSystem}=await import('./system.js')
      main.replaceChildren(designSystem())
    } else if(Object.hasOwn(pages,page)){
      const [title,text]=pages[page]
      main.replaceChildren(intro(title,'ObservaBR'),el('article',{class:'panel reading'},el('p',{},text),el('div',{class:'actions'},link('Fontes e cobertura','#fontes'),link('Solicitação de correção','#correcao'))))
    } else main.replaceChildren(intro('Página não encontrada','Confira o endereço ou volte ao panorama.'),link('Ir ao panorama','#panorama'))
  } catch(error){
    if(!signal.aborted)main.replaceChildren(intro('Consulta indisponível',error.message),button('Tentar novamente',render))
  } finally{if(!signal.aborted){main.setAttribute('aria-busy','false');animateContent();document.title=(main.querySelector('h1')?.textContent||'Panorama')+' · ObservaBR'}}
}
window.addEventListener('hashchange',render)
render()

function animateContent() {
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return
  main.animate([{opacity:.5},{opacity:1}],{duration:160,easing:'ease-out'})
  Array.from(main.children).slice(0,6).forEach((node,index)=>node.animate([{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'none'}],{duration:180,delay:index*18,fill:'backwards',easing:'ease-out'}))
}
