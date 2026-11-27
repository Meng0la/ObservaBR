import type pg from 'pg'

export type CoverageFilter={kind:'politician'|'expense'|'proposal'|'vote'|'ballot';year:number;by:'representative'|'source'|'category'|'period';owner?:string;page:number}
const dimensions={representative:'representative',source:'source',category:'category',period:'period'} as const
export async function coverage(db:Pick<pg.Pool,'query'>,f:CoverageFilter){
 const values=[f.kind,f.year,f.owner??null]
 const dimension=dimensions[f.by]
 const records=`with base as (
  select r.*,case when r.kind='ballot' then (select v.date from records v where v.kind='vote' and v.id=r.data->>'voteId') else r.date end event_date
  from records r where kind=$1
 ), observed as (
  select r.*,case when kind='politician' then id else owner end representative,'camara'::text source,
   coalesce(data->>'category',data->>'body',kind) category,
   case when kind='expense' and data->>'year'~'^[0-9]{4}$' then (data->>'year')::int
        when event_date is not null then extract(year from event_date)::int
        when data->>'year'~'^[0-9]{4}$' then (data->>'year')::int end observation_year,
   case when kind='expense' and data->>'month'~'^(0?[1-9]|1[0-2])$' then lpad(data->>'month',2,'0')
        when event_date is not null then to_char(event_date,'MM') else 'unknown' end period
  from base r
 ), selected as (select * from observed where observation_year=$2 and ($3::text is null or representative=$3))`
 const aggregate=`count(*)::int published,count(distinct coalesce(data->>'proposalId',id))::int distinct_entities,count(distinct representative)::int representatives,
  count(*) filter(where event_date is null)::int missing_event_date,min(event_date)::text first_event,max(event_date)::text last_event,
  min(collected_at) first_collected,max(collected_at) last_collected,max(verified_at) last_verified`
 const totals=(await db.query(`${records} select ${aggregate},
  (select count(*)::int from observed where observation_year is null and ($3::text is null or representative=$3)) unattributed_period_records,
  (select count(*)::int from records where kind='politician') indexed_roster from selected`,values)).rows[0]
 const groups=await db.query(`${records} select ${dimension} as dimension,${aggregate} from selected
  group by ${dimension} order by ${dimension} nulls last limit 100 offset $4`,[...values,(f.page-1)*100])
 const groupedTotal=(await db.query(`${records} select count(*)::int n from (select ${dimension} from selected group by ${dimension}) t`,values)).rows[0].n
 const subjectFilter=`($3::text is null or (j.kind<>'ballot' and j.task->>'owner'=$3) or
  (j.kind='ballot' and exists(select 1 from records b where b.kind='ballot' and b.owner=$3 and b.data->>'voteId'=j.task->>'owner')))`
 const scopes=await db.query(`select j.task->>'owner' subject,j.task->>'month' as "month",j.status,j.page,
  latest.scope_from::text requested_from,latest.scope_to::text requested_to,
  latest.mode cycle_mode,latest.started_at cycle_started_at,latest.finished_at cycle_finished_at,latest.pages pages_collected,
  latest.source_rows::text current_observed_source_rows,latest.validated_rows::text current_validated_rows,latest.published_rows::text current_published_observations,
  last_complete.scope_from::text covered_from,last_complete.scope_to::text covered_to,
  last_complete.completed_at,last_complete.source_rows::text observed_source_rows,last_complete.validated_rows::text validated_rows,
  last_complete.published_rows::text published_observations,
  (last_complete.source_rows=0) empty_source_response,
  case when latest.scope_from>current_date then 'future_scope'
   when j.status='quarantined' then 'quarantined' when j.status in ('failed','dead') then 'source_failure'
   when last_complete.completed_at is not null and j.kind='ballot' then 'entity_complete_as_of_collection'
   when last_complete.completed_at is not null and last_complete.scope_from is null then 'complete_period_unknown'
   when last_complete.completed_at is not null and j.due_at<=now() then 'stale'
   when last_complete.completed_at is not null then 'complete_as_of_collection'
   when j.page>1 or latest.pages>0 then 'partial' else 'pending' end state
  from collection_jobs j
  left join lateral(select * from collection_cycles c where c.job_key=j.key order by started_at desc limit 1) latest on true
  left join lateral(select * from collection_cycles c where c.job_key=j.key and c.status='complete' order by completed_at desc limit 1) last_complete on true
  where j.kind=$1 and j.task->>'year'=$2::text and ${subjectFilter}
  order by j.key limit 100 offset $4`,[...values,(f.page-1)*100])
 const scopeTotal=(await db.query(`select count(*)::int n from collection_jobs j where j.kind=$1 and j.task->>'year'=$2::text and ${subjectFilter}`,values)).rows[0].n
 const meanings={expense:'document_issue_date; financial period comes from year/month',proposal:'presentation_date',vote:'session_date',ballot:'parent_voting_session_date; registration date is a separate record field',politician:'no event date inferred from a roster snapshot'}
 return {source:'camara',kind:f.kind,eventDateMeaning:meanings[f.kind],requestedYear:f.year,groupBy:f.by,page:f.page,pageSize:100,groupTotal:groupedTotal,scopeTotal,totals,groups:groups.rows,scopes:scopes.rows,
  institutionalTotal:null,coveragePercent:null,
  interpretation:'Contagens do índice, não totais institucionais. Ausência de registro não comprova ausência de gastos ou atividade. Intervalos observados não comprovam cobertura contínua. Escopo nominal é uma votação, não um ano inteiro. Datas desconhecidas permanecem nulas. Cadastro de representantes é snapshot; não comprova todos os mandatos históricos.'}
}
