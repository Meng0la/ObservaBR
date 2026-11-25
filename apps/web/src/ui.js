export const names = {
  politician: 'Representantes', expense: 'Despesas', proposal: 'Proposições',
  vote: 'Votações', ballot: 'Votos nominais'
}
export const singular = {
  politician: 'Representante', expense: 'Despesa', proposal: 'Proposição',
  vote: 'Votação', ballot: 'Voto nominal'
}
export const statusLabel = { queued: 'Na fila', running: 'Em andamento', done: 'Concluída', failed: 'Falhou' }
export const digits = new Intl.NumberFormat('pt-BR')
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const currency = value => value == null ? 'Indisponível' : money.format(Number(value))
export const brDate = value => {
  if (!value) return 'Indisponível'
  const text = String(value).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text.split('-').reverse().join('/') : 'Indisponível'
}
export const el = (tag, props = {}, ...children) => {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(props)) {
    if (value == null) continue
    if (key.startsWith('on')) node.addEventListener(key.slice(2), value)
    else if (key === 'class') node.className = value
    else node.setAttribute(key, value)
  }
  node.append(...children.filter(child => child !== null && child !== undefined))
  return node
}
const paths = {
  overview: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  search: 'M20 20l-5-5 M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
  politician: 'M17 21v-2a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v2 M14 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M17 4a4 4 0 0 1 0 7 M19 15a5 5 0 0 1 2 4v2',
  expense: 'M3 6h18v13H3z M3 10h18 M7 15h4',
  proposal: 'M6 2h9l4 4v16H6z M15 2v5h4 M9 12h7 M9 16h5',
  vote: 'M4 14h4l2 2h4l2-2h4l2 6H2z M8 7l4-4 5 5-4 4z',
  sources: 'M3 12h4l3-7 4 14 3-7h4',
  globe: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M2 12h20 M12 2q-9 10 0 20 9-10 0-20',
  inspect: 'M14 4h6v6 M20 4l-9 9 M10 6H4v14h14v-6',
  theme: 'M17 4a8 8 0 0 0 3 14A9 9 0 1 1 17 4',
  layers: 'M2 8l10-5 10 5-10 5z M3 13l9 4 9-4 M3 17l9 4 9-4',
  database: 'M3 6a9 3 0 1 0 18 0 9 3 0 1 0-18 0 M3 6v12a9 3 0 0 0 18 0V6 M3 12a9 3 0 0 0 18 0',
  clock: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M12 6v6l4 2'
}
export function icon(name) {
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  for (const [key, value] of Object.entries({viewBox:'0 0 24 24', width:18, height:18, fill:'none', stroke:'currentColor', 'stroke-width':1.6, 'stroke-linecap':'round', 'stroke-linejoin':'round','aria-hidden':'true'})) svg.setAttribute(key, value)
  const path = document.createElementNS(ns, 'path')
  path.setAttribute('d', paths[name])
  svg.append(path)
  return svg
}
export const link = (label, hash, cls) => el('a', { href: hash, class: cls }, label)
export const button = (label, onclick, cls) => el('button', {type:'button', onclick, class:cls}, label)
export function sourceLink(label, url) {
  try {
    const target = new URL(url)
    if (target.protocol !== 'https:') return null
    return el('a', {href:target.href, target:'_blank', rel:'noopener noreferrer'}, label, ' ', icon('inspect'))
  } catch { return null }
}
export const empty = text => el('p', {class:'empty'}, text)
export async function read(path, signal) {
  const response = await fetch(path, { signal, headers:{Accept:'application/json'} })
  if (!response.ok) throw new Error(response.status === 404 ? 'Registro não encontrado.' : 'Não foi possível consultar a API.')
  return response.json()
}
export function evidence(row) {
  const fields = {
    Instituição:'Câmara dos Deputados', 'Identificador no índice':row.id,
    'Data do registro':brDate(row.date), 'Data de publicação':brDate(row.published_at),
    'Coleta':row.collected_at ? new Date(row.collected_at).toLocaleString('pt-BR') : 'Indisponível',
    'Última verificação':row.verified_at ? new Date(row.verified_at).toLocaleString('pt-BR') : 'Indisponível',
    'Período informado':row.data?.year ? String(row.data.year) : 'Indisponível',
    'Situação da verificação':row.verification_status || (row.verified_at?'Consulta à fonte registrada':'Sem verificação registrada'),
    'Campo consultado':row.field, 'Versão do coletor':row.collector_version, 'SHA-256':row.sha256
  }
  const details = el('dl', {class:'metadata'})
  Object.entries(fields).forEach(([name, value]) => details.append(el('dt',{},name),el('dd',{},value ?? 'Indisponível')))
  document.querySelector('#evidence-body').replaceChildren(el('h3',{},row.title), details,
    el('p',{},'Registro normalizado a partir de uma resposta da API oficial. A cobertura depende das páginas coletadas.'),
    el('div',{class:'actions'},sourceLink('Abrir publicação original', row.source_url), sourceLink('Consultar resposta da API', row.api_url)))
  const dialog=document.querySelector('#evidence')
  dialog.classList.add('evidence-panel')
  dialog.showModal()
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)dialog.animate([{opacity:0,transform:'translateX(12px)'},{opacity:1,transform:'none'}],{duration:180,easing:'ease-out'})
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)dialog.animate([{opacity:0,transform:'translateX(12px)'},{opacity:1,transform:'none'}],{duration:180,easing:'ease-out'})
}
