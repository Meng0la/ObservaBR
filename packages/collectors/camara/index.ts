import { createHash } from 'node:crypto'
import { lookup } from 'node:dns'
import { Agent, request } from 'node:https'
import { lookup as resolveHost } from 'node:dns/promises'
import { BlockList } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'

export type Task = {
  kind: 'politician' | 'expense' | 'proposal' | 'vote' | 'ballot'
  owner?: string
  name?: string
  year: number
  month?: number
  roster?:'period'
}

export type PublicRecord = {
  kind: Task['kind']
  id: string
  owner: string | null
  title: string
  date: string | null
  amount: string | null
  data: Record<string, unknown>
  sourceUrl: string
  field: string
}

const origin = 'https://dadosabertos.camara.leg.br'
const byteLimit = 6 * 1024 * 1024
const blocked = new BlockList()
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]
] as const) blocked.addSubnet(address, prefix, 'ipv4')

export function collectionUrl(task: Task, page = 1): URL {
  if(task.roster!=null&&(task.roster!=='period'||task.kind!=='politician'))throw Error('Modo de cadastro inválido')
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw Error('Página inválida')
  if (!Number.isInteger(task.year) || task.year < 1900 || task.year > 2100) throw Error('Ano inválido')
  const paths = { politician: 'deputados', expense: 'deputados', proposal: 'proposicoes', vote: 'votacoes', ballot: 'votacoes' }
  let path = paths[task.kind]
  if (!Object.hasOwn(paths, task.kind)) throw Error('Recurso inválido')
  const params = new URLSearchParams()
  if (task.kind === 'ballot') {
    if (!/^\d{1,14}-\d{1,10}$/.test(task.owner ?? '') || page !== 1) throw Error('Votação inválida')
    return new URL('/api/v2/votacoes/' + task.owner + '/votos', origin)
  }
  if (task.kind === 'expense' || (task.kind === 'proposal' && task.owner !== undefined)) {
    if (!/^[1-9]\d{0,12}$/.test(task.owner ?? '')) throw Error('Identificador de deputado inválido')
  }
  if (task.kind === 'expense') path += '/' + task.owner + '/despesas'
  if (task.kind === 'expense' || task.kind === 'proposal') params.set('ano', String(task.year))
  if (task.kind === 'proposal' && task.owner) params.set('idDeputadoAutor', task.owner)
  if (task.kind === 'politician' && task.name) {
    if (task.name.length > 120) throw Error('Nome muito longo')
    params.set('nome', task.name)
  }
  if(task.kind==='politician'&&task.roster==='period'){
    params.set('dataInicio',`${task.year}-01-01`)
    params.set('dataFim',`${task.year}-12-31`)
  }
  if (task.kind === 'vote') {
    const now = new Date()
    const month = task.month ?? (task.year === now.getUTCFullYear() ? now.getUTCMonth() + 1 : 12)
    if (!Number.isInteger(month) || month < 1 || month > 12) throw Error('Mês inválido')
    const start = new Date(Date.UTC(task.year, month - 1, 1))
    const end = new Date(Date.UTC(task.year, month, 0))
    params.set('dataInicio', start.toISOString().slice(0, 10))
    params.set('dataFim', end.toISOString().slice(0, 10))
  }
  params.set('itens', '100')
  params.set('pagina', String(page))
  return new URL('/api/v2/' + path + '?' + params.toString(), origin)
}

type Row = Record<string, unknown>
function object(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Objeto oficial inválido')
  return value as Row
}
function required(value: unknown): string {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value)
  if (typeof value === 'string' && value.trim()) return value.trim()
  throw Error('Campo obrigatório indisponível')
}
function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}
function money(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const decimal = String(value)
  if (!/^-?\d{1,13}(?:\.\d{1,2})?$/.test(decimal)) throw Error('Valor monetário inválido')
  return decimal
}
function official(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const u = new URL(value)
    if (u.protocol === 'https:' && !u.username && !u.password && !u.port &&
        ['www.camara.leg.br', 'dadosabertos.camara.leg.br'].includes(u.hostname)) return u.href
  } catch { /* Optional document URL. */ }
  return null
}
function dateOf(value: unknown): string | null {
  const source = text(value)
  if (!source) return null
  if (!/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(source)) throw Error('Data inválida')
  return source.slice(0, 10)
}

function normalize(task: Task, row: Row, url: string, index: number): PublicRecord {
  const base = { kind: task.kind, owner: task.owner ?? null, date: null, amount: null, sourceUrl: url, field: '/dados/' + index }
  switch (task.kind) {
    case 'politician':
      return { ...base, id: required(row.id), title: required(row.nome), sourceUrl: official(row.uri) ?? url,
        data: { party: task.roster==='period'?null:text(row.siglaPartido), uf: text(row.siglaUf), legislature: row.idLegislatura ?? null, photo: official(row.urlFoto),rosterYear:task.roster==='period'?task.year:new Date().getUTCFullYear(),rosterMode:task.roster??'current' } }
    case 'expense': {
      const amount = money(row.valorLiquido)
      const company = typeof row.cnpjCpfFornecedor === 'string' && /^\d{14}$/.test(row.cnpjCpfFornecedor)
      // Some centrally billed entries have no document ID. Hash the official distinguishing fields
      // without exposing invoice numbers or individual supplier identifiers in published keys.
      const hasDocument = !!row.codDocumento && String(row.codDocumento) !== '0'
      const key = [task.owner, row.ano, row.mes, row.dataDocumento, row.codDocumento, row.codLote,
        row.parcela, row.numRessarcimento, row.numDocumento, row.tipoDespesa, amount?.startsWith('-') ?? null]
      if (!hasDocument) key.push(row.cnpjCpfFornecedor, amount)
      const id = createHash('sha256').update(JSON.stringify(key)).digest('hex')
      return { ...base, id, amount, title: required(row.tipoDespesa), date: dateOf(row.dataDocumento),
        sourceUrl: official(row.urlDocumento) ?? url,
        data: { category: row.tipoDespesa, year: row.ano, month: row.mes, net: amount, gross: money(row.valorDocumento),
          withheld: money(row.valorGlosa), supplier: company ? text(row.nomeFornecedor) : null,
          cnpj: company ? row.cnpjCpfFornecedor : null, documentId: hasDocument ? String(row.codDocumento) : null } }
    }
    case 'proposal': {
      const proposalId = required(row.id)
      return { ...base, id: task.owner ? proposalId + ':' + task.owner : proposalId,
        title: required(row.siglaTipo) + ' ' + required(row.numero) + '/' + required(row.ano),
        date: dateOf(row.dataApresentacao), sourceUrl: official(row.uri) ?? url,
        data: { proposalId, summary: text(row.ementa), year: row.ano } }
    }
    case 'vote':
      return { ...base, id: required(row.id), date: dateOf(row.data), title: text(row.proposicaoObjeto) ?? text(row.descricao) ?? required(row.id),
        sourceUrl: official(row.uri) ?? url, data: { object: text(row.proposicaoObjeto), description: text(row.descricao),
          body: text(row.siglaOrgao), result: row.aprovacao ?? null, proposalUrl: official(row.uriProposicaoObjeto),
          eventUrl:official(row.uriEvento),bodyUrl:official(row.uriOrgao),registered:text(row.dataHoraRegistro) } }
    case 'ballot': {
      const deputy = object(row.deputado_)
      const owner = required(deputy.id)
      const vote = required(row.tipoVoto)
      const registered = text(row.dataRegistroVoto)
      return { ...base, id: [task.owner, owner, registered ?? vote].join(':'), owner, title: vote,
        date: dateOf(registered), data: { voteId: task.owner, vote, deputy: required(deputy.nome), registered,
          party: text(deputy.siglaPartido),uf:text(deputy.siglaUf),photo:official(deputy.urlFoto) } }
    }
  }
}

export function parsePage(raw: Buffer, task: Task, page: number, url: string) {
  const body = object(JSON.parse(raw.toString('utf8')))
  if (!Array.isArray(body.dados) || !Array.isArray(body.links)) throw Error('Envelope da Câmara inválido')
  const records:PublicRecord[]=[]
  const observations:Array<{id:string,field:string}>=[]
  const identities=new Map<string,string>()
  const rawRows=new Set<string>()
  let duplicates=0,representationVariants=0
  const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.keys(v).sort().map(k=>[k,canonical((v as Row)[k])]):v
  for(const [index,value] of body.dados.entries()){
    const row=object(value),record=normalize(task,row,url,index)
    // Dated rosters may repeat the same institutional person with different parties.
    // Keep every source position; never select one of these as current affiliation.
    const identityRow=task.kind==='politician'&&task.roster==='period'?Object.fromEntries(Object.entries(row).filter(([key])=>key!=='siglaPartido')):row
    const fingerprint=JSON.stringify(canonical(identityRow))
    const rawFingerprint=JSON.stringify(canonical(row))
    observations.push({id:record.id,field:record.field})
    if(identities.has(record.id)){
      if(identities.get(record.id)!==fingerprint)throw Error('Chaves ambíguas na página da Câmara')
      if(rawRows.has(rawFingerprint))duplicates++;else representationVariants++
    }else{identities.set(record.id,fingerprint);records.push(record)}
    rawRows.add(rawFingerprint)
  }
  const next = body.links.some(link => object(link).rel === 'next')
  return { page, url, raw, records, next,observations,sourceRows:body.dados.length,duplicates,representationVariants }
}

export class CollectionBudgetExceeded extends Error {}
let budget:{deadline:number,maxRequests:number,maxBytes:number,requests:number,bytes:number}|undefined
export function configureCollectionBudget(config?:{deadline:number,maxRequests:number,maxBytes:number}) {
  budget=config?{...config,requests:0,bytes:0}:undefined
}
export function collectionUsage(){return {requests:budget?.requests??0,bytes:budget?.bytes??0}}

class RemoteFailure extends Error {
  readonly status: number
  readonly retryAfter: number
  constructor(status: number, retryAfter: number) {
    super('Câmara HTTP ' + status)
    this.status = status
    this.retryAfter = retryAfter
  }
}
async function download(url: URL): Promise<Buffer> {
  if(budget&&(Date.now()>=budget.deadline||budget.requests>=budget.maxRequests))throw new CollectionBudgetExceeded('Orçamento da fonte atingido')
  if(budget)budget.requests++
  // Proxy use is an operator decision. The proxy resolves the fixed institutional
  // hostname again, while TLS still validates that hostname inside the tunnel.
  const proxy = process.env.OBSERVABR_HTTPS_PROXY
  const agent = proxy ? new Agent({ proxyEnv: { HTTPS_PROXY: proxy }, keepAlive: false }) : false
  if (proxy) {
    const { address } = await resolveHost(url.hostname, { family: 4 })
    if (blocked.check(address, 'ipv4')) throw Error('Endereço institucional recusado')
  }
  return new Promise((resolve, reject) => {
    const req = request(url, {
      family: 4, agent, signal: AbortSignal.timeout(Math.max(1,Math.min(30000,budget?budget.deadline-Date.now():30000))),
      headers: { Accept: 'application/json', 'User-Agent': 'ObservaBR/0.1 (dados publicos da Camara)' },
      lookup: proxy ? undefined : (host, _options, cb) => {
        lookup(host, { family: 4 }, (err, address) => {
          if (err) return cb(err, '', 4)
          if (blocked.check(address, 'ipv4')) return cb(Error('Endereço institucional recusado'), '', 4)
          cb(null, address, 4)
        })
      }
    }, res => {
      const status = res.statusCode ?? 0
      if (status !== 200) {
        const hint = res.headers['retry-after'] ?? '0'
        const wait = /^\d+$/.test(hint) ? Number(hint) * 1000 : Math.max(0, Date.parse(hint) - Date.now()) || 0
        reject(new RemoteFailure(status, wait))
        res.destroy()
        return
      }
      if (!res.headers['content-type']?.toLowerCase().includes('application/json')) {
        reject(Error('Tipo de resposta inesperado')); res.destroy(); return
      }
      let size = 0
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => {
        size += chunk.length
        if(budget){
          budget.bytes+=chunk.length
          if(budget.bytes>budget.maxBytes){res.destroy(new CollectionBudgetExceeded('Orçamento de bytes atingido'));return}
        }
        if (size > byteLimit) res.destroy(Error('Documento excede o limite'))
        else chunks.push(chunk)
      })
      res.on('error', reject)
      res.on('end', () => resolve(Buffer.concat(chunks)))
    })
    req.on('error', reject)
    req.end()
  })
}

let nextSlot = 0
async function readPage(url: URL) {
  for (let attempt = 0; ; attempt++) {
    const slot = Math.max(Date.now(), nextSlot)
    if(budget&&slot>=budget.deadline)throw new CollectionBudgetExceeded('Orçamento de duração atingido')
    nextSlot = slot + 1500
    await delay(Math.max(0, slot - Date.now()))
    try { return await download(url) } catch (error) {
      if(error instanceof CollectionBudgetExceeded)throw error
      const remote = error instanceof RemoteFailure ? error : null
      if (remote?.retryAfter) nextSlot = Math.max(nextSlot, Date.now() + remote.retryAfter)
      if (attempt === 2 || (remote && ![429, 500, 502, 503, 504].includes(remote.status)) ||
          (remote && remote.retryAfter > 60000)) throw error
      const pause=Math.max(1500 * 2 ** attempt+Math.random()*500,remote?.retryAfter??0)
      if(budget&&Date.now()+pause>=budget.deadline)throw new CollectionBudgetExceeded('Retry excede o orçamento')
      await delay(pause)
    }
  }
}

// The enrichment registry builds complete resource paths from typed identifiers.
// Validate them again at the transport boundary, before resolving any hostname.
export function readInstitutionalResource(url: URL) {
  const route = /^\/api\/v2\/(?:votacoes\/\d{1,14}-\d{1,10}(?:\/(?:votos|orientacoes))?|proposicoes\/[1-9]\d{0,13}(?:\/(?:autores|tramitacoes))?|eventos\/[1-9]\d{0,13}(?:\/pauta)?|orgaos\/[1-9]\d{0,13})$/
  if (url.origin !== origin || url.username || url.password || url.search || url.hash || !route.test(url.pathname)) {
    throw Error('Recurso institucional inválido')
  }
  return readPage(new URL(url.href))
}

export async function readCollectionPage(task:Task,page=1) {
  const url=collectionUrl(task,page)
  return {raw:await readPage(url),url:url.href,page}
}

export async function* collect(task: Task, startPage = 1) {
  for (let page = startPage; ; page++) {
    const source=await readCollectionPage(task,page)
    const result = parsePage(source.raw, task, page, source.url)
    yield result
    if (!result.next) break
  }
}
