import { readInstitutionalResource } from './index.ts'
import {createHash} from 'node:crypto'

const routes = {
  vote: 'votacoes/:id', votes: 'votacoes/:id/votos', orientations: 'votacoes/:id/orientacoes',
  proposal: 'proposicoes/:id', authors: 'proposicoes/:id/autores', proceedings: 'proposicoes/:id/tramitacoes',
  agenda: 'eventos/:id/pauta', event: 'eventos/:id', body: 'orgaos/:id'
} as const
export type Resource = keyof typeof routes
const voteResources = new Set<Resource>(['vote', 'votes', 'orientations'])
const lists = new Set<Resource>(['votes', 'orientations', 'authors', 'proceedings', 'agenda'])
const api = 'https://dadosabertos.camara.leg.br/api/v2/'
type Row = Record<string, unknown>
export type SourceDocument = { resource: Resource, id: string, url: string, raw: Buffer, payload: unknown }
type Evidence = Pick<SourceDocument, 'resource' | 'id' | 'url'> & { field: string,sha256:string }

export function resourceUrl(resource: Resource, id: string): URL {
  if (!Object.hasOwn(routes, resource) || typeof id !== 'string') throw Error('Recurso desconhecido')
  const pattern = voteResources.has(resource) ? /^[1-9]\d{0,13}-\d{1,10}$/ : /^[1-9]\d{0,13}$/
  if (!pattern.test(id)) throw Error('Identificador institucional inválido')
  return new URL(routes[resource].replace(':id', id), api)
}
function row(value: unknown): Row {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Objeto oficial inválido')
  return value as Row
}
function rows(value: unknown): Row[] {
  if (value == null) return []
  if (!Array.isArray(value)) throw Error('Lista oficial inválida')
  return value.map(row)
}
function text(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null
  return value.trim().replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF suprimido]')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[e-mail suprimido]')
}
function integer(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : null
}
function institutionId(value: unknown): string | null {
  const id = String(value ?? '')
  return /^[1-9]\d{0,13}$/.test(id) ? id : null
}
function linkedId(value: unknown, resource: 'proposicoes'|'orgaos'|'eventos'|'deputados'): string | null {
  if (typeof value !== 'string' || !value.startsWith(api + resource + '/')) return null
  return institutionId(value.slice((api + resource + '/').length).replace(/\/$/, ''))
}
function sourceLink(value: unknown) {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    if (url.protocol === 'https:' && !url.username && !url.password && !url.port &&
        ['dadosabertos.camara.leg.br','www.camara.leg.br'].includes(url.hostname)) return url.href
  } catch { /* Optional document link. */ }
  return null
}
function validate(document: SourceDocument) {
  if (document.url !== resourceUrl(document.resource, document.id).href) throw Error('Origem incompatível')
  const envelope = row(document.payload)
  if (lists.has(document.resource)) {
    if (!Array.isArray(envelope.dados)) throw Error('Coleção oficial inválida')
    rows(envelope.dados)
    if (rows(envelope.links).some(link => link.rel === 'next')) throw Error('Recurso paginado exige revisão do contrato')
  } else if (String(row(envelope.dados).id) !== document.id) throw Error('Identidade oficial divergente')
}
export async function fetchResource(resource: Resource, id: string): Promise<SourceDocument> {
  const url = resourceUrl(resource, id)
  const raw = await readInstitutionalResource(url)
  const document = { resource, id, url: url.href, raw, payload: JSON.parse(raw.toString('utf8')) as unknown }
  validate(document)
  return document
}
function evidence(doc: SourceDocument, field: string): Evidence {
  return { resource: doc.resource, id: doc.id, url: doc.url, field,sha256:createHash('sha256').update(doc.raw).digest('hex') }
}
function proposalLabel(proposal: Row) {
  const type = text(proposal.siglaTipo)
  const number = institutionId(proposal.numero)
  const year = institutionId(proposal.ano)
  if (!type || !number) return null
  return type + ' ' + number + (year ? '/' + year : '')
}
function references(description: string, label: string): boolean {
  const term = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
  return new RegExp('(?:^|[^\\p{L}\\d])' + term + '(?![\\p{L}\\d/])', 'iu').test(description)
}
function mainProposalId(vote: Row, agenda: Row[], voteId: string) {
  const affected = rows(vote.proposicoesAfetadas)
  const opening = text(vote.descUltimaAberturaVotacao) ?? ''
  const byName = affected.filter(p => {
    const label = proposalLabel(p)
    return label?.includes('/') && references(opening, label)
  })
  // A high-confidence agenda match references this exact vote, not just its session.
  const agendaIds = new Set(agenda.filter(item => String(item.uriVotacao).replace(/\/$/, '') === resourceUrl('vote', voteId).href)
    .map(item => item.proposicaoRelacionada_ && institutionId(row(item.proposicaoRelacionada_).id)).filter(Boolean))
  const matches = new Set([...byName.map(p => institutionId(p.id)), ...affected.map(p => institutionId(p.id)).filter(id => agendaIds.has(id))].filter(Boolean))
  return matches.size === 1 ? [...matches][0] ?? null : null
}
function scoreFrom(description: string | null) {
  function officialCount(label: string) {
    const hits = [...(description ?? '').matchAll(new RegExp('(?:^|[.;,]\\s*)' + label + '\\s*:\\s*(\\d+)(?=\\s*(?:[;.,]|$))','giu'))]
    return hits.length === 1 ? Number(hits[0][1]) : null
  }
  return {yes: officialCount('Sim'), no: officialCount('Não'), abstentions: officialCount('Abstenç(?:ão|ões)'),
    obstructions: officialCount('Obstruç(?:ão|ões)'), total: officialCount('Total')}
}
function voteObject(vote: Row) {
  const opening = text(vote.descUltimaAberturaVotacao)
  // A generic announcement can report an opening without naming a matter.
  if (opening && /\b(?:DTQ|PLP|PEC|PL|REQ|EMP|artigo|art\.|requerimento|redação final|destaque|parecer|substitutivo|emenda)\b/iu.test(opening)) {
    return { label: opening, field: '/dados/descUltimaAberturaVotacao' }
  }
  const named = text(vote.proposicaoObjeto)
  return named ? { label: named, field: '/dados/proposicaoObjeto' } : null
}

function votedProposalId(vote: Row): string | null {
  const explicit = linkedId(vote.uriProposicaoObjeto,'proposicoes')
  if (explicit) return explicit
  const opening = text(vote.descUltimaAberturaVotacao)
  // Only an opening that names this designation as its immediate grammatical
  // object can resolve a possible item. A later mention of an amendment cannot.
  const designation = opening?.match(/^Votação\s+(?:d[oa]\s+)?([A-Z]{2,8})\s+(?:n[º°.o]?\s*)?(\d+)\b(?:\s*\/\s*(\d{4}))?/u)
  if (!designation) return null
  const candidates = rows(vote.objetosPossiveis).filter(p => p.siglaTipo === designation[1] &&
    String(p.numero) === designation[2] && (!designation[3] || String(p.ano) === designation[3]))
  return candidates.length === 1 ? institutionId(candidates[0].id) : null
}

function selectedProposals(vote: Row, mainId: string | null) {
  const voted = votedProposalId(vote)
  return [...new Set([mainId, voted, ...rows(vote.proposicoesAfetadas).map(p=>institutionId(p.id))].filter((id):id is string=>!!id))].slice(0,4)
}

export function contextualizeVote(id: string, documents: SourceDocument[]) {
  const get = (resource: Resource, externalId: string|null) => documents.find(d => d.resource === resource && d.id === externalId)
  const detail = get('vote', id)
  if (!detail) throw Error('Detalhe de votação ausente')
  for (const doc of documents) validate(doc)
  const vote = row(row(detail.payload).dados)
  const bodyId = institutionId(vote.idOrgao) ?? linkedId(vote.uriOrgao, 'orgaos')
  const eventId = institutionId(vote.idEvento) ?? linkedId(vote.uriEvento, 'eventos')
  const agenda = get('agenda', eventId)
  const mainId = mainProposalId(vote, agenda ? rows(row(agenda.payload).dados) : [], id)
  const proposal = get('proposal', mainId)
  const bodyDoc = get('body', bodyId)
  const eventDoc = get('event', eventId)
  const data = (d: SourceDocument) => row(row(d.payload).dados)
  const list = (doc?: SourceDocument) => doc ? rows(row(doc.payload).dados) : []
  const evidenceMap: Record<string, Evidence[]> = {}
  const add = (key: string, doc: SourceDocument, field: string) => {
    (evidenceMap[key] ??= []).push(evidence(doc, field))
  }
  const object = voteObject(vote)
  if (object) add('object', detail, object.field)
  const result = text(vote.descricao)
  const score = scoreFrom(result)
  if (result) {
    add('result', detail, '/dados/descricao')
    if (Object.values(score).some(value => value !== null)) add('score', detail, '/dados/descricao')
  }
  add('date', detail, '/dados/data')
  add('body', detail, '/dados/siglaOrgao')
  if (eventId) add('eventId', detail, vote.idEvento ? '/dados/idEvento' : '/dados/uriEvento')
  if (bodyDoc) add('body', bodyDoc, '/dados/nome')
  const related = [
    ...rows(vote.proposicoesAfetadas).map((p, i) => ({p, role:'affected', field:'/dados/proposicoesAfetadas/' + i})),
    ...rows(vote.objetosPossiveis).map((p, i) => ({p, role:'possible', field:'/dados/objetosPossiveis/' + i}))
  ].map(({p, role, field}) => {
    add('related', detail, field)
    return {id: institutionId(p.id), label: proposalLabel(p), summary: text(p.ementa), role, field}
  })
  const objectId = votedProposalId(vote)
  if (objectId) {
    if (linkedId(vote.uriProposicaoObjeto,'proposicoes')) add('objectProposalId',detail,'/dados/uriProposicaoObjeto')
    else {
      add('objectProposalId',detail,'/dados/descUltimaAberturaVotacao')
      const hit = related.find(r=>r.id===objectId && r.role==='possible')
      if (hit) add('objectProposalId',detail,hit.field)
    }
  }
  const affected = related.find(p => p.role === 'affected' && p.id === mainId && mainId)
  const mainProposal = affected ? {id: mainId!, label: affected.label, summary: proposal ? text(data(proposal).ementa) : affected.summary,
    url: proposal ? sourceLink(data(proposal).urlInteiroTeor) : null} : null
  if (affected) {
    add('mainProposal', detail, affected.field)
    if (affected.label && references(text(vote.descUltimaAberturaVotacao) ?? '', affected.label)) {
      add('mainProposal', detail, '/dados/descUltimaAberturaVotacao')
    }
    if (agenda) list(agenda).forEach((item,i) => {
      if (String(item.uriVotacao).replace(/\/$/,'') === detail.url && item.proposicaoRelacionada_ &&
          institutionId(row(item.proposicaoRelacionada_).id) === mainId) add('mainProposal',agenda,'/dados/'+i)
    })
    if (proposal) add('mainProposal', proposal, '/dados')
  }
  const authorsDoc = get('authors', mainId)
  const authors = list(authorsDoc).map((a,i) => {
    add('authors', authorsDoc!, '/dados/'+i)
    return {name:text(a.nome),id:linkedId(a.uri,'deputados'),type:text(a.tipo),order:integer(a.ordemAssinatura)}
  })
  const orientationsDoc = get('orientations',id)
  const orientations = list(orientationsDoc).map((o,i) => {
    add('orientations',orientationsDoc!,'/dados/'+i)
    return { party:text(o.siglaPartidoBloco),vote:text(o.orientacaoVoto) }
  })
  const proceedings = get('proceedings', mainId)
  const timeline = list(proceedings).map((t,i) => {
    add('timeline',proceedings!,'/dados/'+i)
    return {date:text(t.dataHora),body:text(t.siglaOrgao),description:text(t.descricaoTramitacao),detail:text(t.despacho),url:sourceLink(t.url)}
  })
  const issues: string[] = []
  const unenriched = related.filter(r=>r.id && !get('proposal',r.id)).length
  if (unenriched) issues.push('Vínculos listados sem ficha complementar nesta coleta: '+unenriched+'.')
  if (!object) issues.push('O registro disponível não identifica com precisão o objeto votado.')
  if (!mainProposal) issues.push('A proposição principal não foi confirmada nas fontes consultadas.')
  const objectTitle = objectId ? related.find(item=>item.id===objectId)?.label : null
  const title = [mainProposal?.label,objectTitle||object?.label].filter((s,i,a) => !!s && a.indexOf(s)===i).join(' · ') || 'Deliberação '+id
  evidenceMap.title = [...(evidenceMap.mainProposal ?? []), ...(evidenceMap.object ?? [])]
  const presentation = vote.ultimaApresentacaoProposicao ? row(vote.ultimaApresentacaoProposicao) : null
  if (presentation) add('lastPresentation',detail,'/dados/ultimaApresentacaoProposicao')
  if (eventDoc) add('event',eventDoc,'/dados')
  if (vote.dataHoraRegistro) add('registeredAt',detail,'/dados/dataHoraRegistro')
  if (vote.aprovacao != null) add('approval',detail,'/dados/aprovacao')
  return {title, mainProposal, object:object?.label ?? null, objectProposalId:objectId, body:{id:bodyId,name:bodyDoc ? text(data(bodyDoc).nome) : null,acronym:text(vote.siglaOrgao)},
    date:text(vote.data), result, score, approval:integer(vote.aprovacao), registeredAt:text(vote.dataHoraRegistro), eventId,
    event:eventDoc ? {id:eventId,name:text(data(eventDoc).descricaoTipo),description:text(data(eventDoc).descricao)} : null,
    lastPresentation:presentation ? {date:text(presentation.dataHoraRegistro),description:text(presentation.descricao),
      proposalId:linkedId(presentation.uriProposicaoCitada,'proposicoes')} : null,
    related, authors, orientations, timeline, issues, evidence:evidenceMap, sources:documents.map(d=>evidence(d,'/dados'))}
}
export type VoteContext = ReturnType<typeof contextualizeVote>

export async function enrichVote(id: string, reader: typeof fetchResource = fetchResource) {
  resourceUrl('vote', id)
  const detail = await reader('vote', id)
  validate(detail)
  if (detail.resource !== 'vote' || detail.id !== id) throw Error('Detalhe incompatível')
  const documents = [detail]
  const issues: string[] = []
  async function add(resource: Resource, externalId: string | null) {
    if (!externalId) return
    try {
      const doc = await reader(resource, externalId)
      if (doc.resource !== resource || doc.id !== externalId) throw Error('Recurso incompatível')
      validate(doc)
      documents.push(doc)
    } catch {
      issues.push('Coleta complementar indisponível: ' + routes[resource].replace(':id', externalId) + '.')
    }
  }
  const vote = row(row(detail.payload).dados)
  await add('votes', id)
  await add('orientations', id)
  await add('body', institutionId(vote.idOrgao) ?? linkedId(vote.uriOrgao,'orgaos'))
  const eventId = institutionId(vote.idEvento) ?? linkedId(vote.uriEvento,'eventos')
  await add('event', eventId)
  await add('agenda', eventId)
  const agenda = documents.find(d=>d.resource==='agenda')
  const mainId = mainProposalId(vote,agenda ? rows(row(agenda.payload).dados) : [],id)
  for (const proposalId of selectedProposals(vote,mainId)) await add('proposal',proposalId)
  for (const resource of ['authors','proceedings'] as const) await add(resource,mainId)
  const context = contextualizeVote(id,documents)
  context.issues.push(...issues)
  return {documents,context,retrievalIssues:issues}
}
