import test from 'node:test'
import assert from 'node:assert/strict'
import {contextualizeVote,enrichVote,resourceUrl,type SourceDocument,type Resource} from '../packages/collectors/camara/enrichment.ts'
import {readInstitutionalResource} from '../packages/collectors/camara/index.ts'
import {publicResponse} from '../packages/security/public-response.ts'

const id='2520670-66'
function doc(resource:Resource,data:unknown,externalId=id):SourceDocument {
 const payload={dados:data,links:[]}
 return {resource,id:externalId,url:resourceUrl(resource,externalId).href,raw:Buffer.from(JSON.stringify(payload)),payload}
}
function detail(changes:Record<string,unknown>={}){
 return doc('vote',{id,data:'2025-12-16',siglaOrgao:'PLEN',descricao:'Mantido o texto. Sim: 286; Não: 116; Total: 402.',
  descUltimaAberturaVotacao:'Votação do DTQ 8 (NOVO): Destaque para Votação em Separado do Art. 8º do substitutivo, apresentado ao PLP 128/2025. (161, I)',
  proposicoesAfetadas:[{id:2520670,siglaTipo:'PLP',numero:128,ano:2025}],
  objetosPossiveis:[{id:999,siglaTipo:'RPD',numero:12,ano:2025},{id:2597595,siglaTipo:'DTQ',numero:8,ano:2025}],...changes})
}
test('a abertura e os vínculos confirmam o projeto e o destaque, sem escolher o primeiro possível',()=>{
 const context=contextualizeVote(id,[detail()])
 assert.equal(context.mainProposal?.id,'2520670')
 assert.equal(context.objectProposalId,'2597595')
 assert.match(context.title,/PLP 128\/2025/)
 assert.match(context.object??'',/Art\. 8/)
 assert.deepEqual(context.score,{yes:286,no:116,total:402,abstentions:null,obstructions:null})
 assert.ok(context.evidence.object.every(e=>e.field==='/dados/descUltimaAberturaVotacao'))
 const unknown=contextualizeVote(id,[detail({descUltimaAberturaVotacao:null})])
 assert.equal(unknown.mainProposal,null)
 assert.equal(unknown.object,null)
 assert.ok(unknown.issues.length)
})
test('a fila complementar tolera recurso ausente e registra falhas de recuperação',async()=>{
 const value=await enrichVote(id,async(resource,externalId)=>{
  if(resource==='vote')return detail()
  throw Error('Indisponível no teste')
 })
 assert.ok(value.retrievalIssues.length)
 assert.equal(value.context.mainProposal?.id,'2520670')
 assert.equal(value.context.score.total,402)
})
test('o transporte rejeita destinos e parâmetros arbitrários antes da rede',()=>{
 assert.throws(()=>resourceUrl('vote','https://127.0.0.1'))
 assert.throws(()=>resourceUrl('proposal','../42'))
 assert.throws(()=>readInstitutionalResource(new URL('https://dadosabertos.camara.leg.br/api/v2/votacoes/1-2?url=http://localhost')))
 assert.throws(()=>readInstitutionalResource(new URL('http://dadosabertos.camara.leg.br/api/v2/votacoes/1-2')))
})
test('a publicação informa supressão e conserva CNPJ empresarial e estrutura de arrays',()=>{
 const result=publicResponse({dados:[{deputado_:{nome:'Teste',email:'privado@teste.invalid',cpf:'00000000000'}},
  {cnpjCpfFornecedor:'00000000000',nomeFornecedor:'Pessoa individual'},
  {cnpjCpfFornecedor:'00000000000000',nomeFornecedor:'Empresa'}]})
 const serialized=JSON.stringify(result.payload)
 assert.equal(result.original,false)
 assert.ok(result.suppressedFields.includes('/dados/0/deputado_/email'))
 assert.ok(!serialized.includes('privado@')&&!serialized.includes('Pessoa individual'))
 assert.ok(serialized.includes('Empresa'))
})
test('contrato de enriquecimento oficial', {skip:!process.env.OBSERVABR_LIVE},async()=>{
 const result=await enrichVote(id)
 assert.equal(result.context.mainProposal?.label,'PLP 128/2025')
 assert.equal(result.context.objectProposalId,'2597595')
 assert.deepEqual(result.context.score,{yes:286,no:116,total:402,abstentions:null,obstructions:null})
 assert.equal(result.context.body.name,'Plenário')
 assert.ok(result.documents.some(d=>d.resource==='agenda'))
 assert.equal(result.retrievalIssues.length,0)
})
