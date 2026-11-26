import {readFile,writeFile,mkdir,stat} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import {resolve} from 'node:path'
import pg from 'pg'
import {csvRows,csvFromZip} from '../packages/collectors/camara/files.ts'

// Analysis-only tool. Install @duckdb/node-api in .tools/analysis, never in runtime dependencies.
const target=new URL(process.env.POC_DATABASE_URL||'')
if(!['127.0.0.1','localhost'].includes(target.hostname)||!target.pathname.includes('engineering'))throw Error('POC exige banco local isolado de engenharia')
const root=resolve('.tools/data-engineering/storage-poc');await mkdir(root,{recursive:true,mode:0o700})
const raw=await readFile('.tools/data-engineering/Ano-2025.csv.zip'),{csv}=csvFromZip(raw)
const iterator=csvRows(csv.toString('utf8')),header=iterator.next().value!
const index=(key:string)=>{const n=header.indexOf(key);if(n<0)throw Error('Campo anual obrigatório ausente');return n}
const cols=['ideCadastro','numAno','numMes','txtDescricao','vlrLiquido'].map(index)
const rows:Array<{source_row:number,owner:string|null,year:number,month:number,category:string,net:string}>=[]
for(const [i,row] of [...iterator].entries()){
 if(row.length!==header.length)throw Error('Quantidade de colunas anual divergente')
 const [owner,year,month,category,money]=cols.map(p=>row[p]),net=money.replace(',','.')
 if(!/^-?\d{1,13}(?:\.\d{1,2})?$/.test(net)||!/^\d{4}$/.test(year)||!/^\d{1,2}$/.test(month))throw Error('Valor anual inválido')
 rows.push({source_row:i+2,owner:owner||null,year:Number(year),month:Number(month),category,net})
}
// A line number plus immutable file SHA identifies an observation, not a cross-source expense.
const sha256=createHash('sha256').update(raw).digest('hex')
const jsonPath=resolve(root,'expenses.json'),csvPath=resolve(root,'expenses.csv'),parquetPath=resolve(root,'expenses.parquet')
await writeFile(jsonPath,JSON.stringify(rows),{mode:0o600})
const quote=(value:unknown)=>'"'+String(value??'').replaceAll('"','""')+'"'
await writeFile(csvPath,'source_row,owner,year,month,category,net\n'+rows.map(r=>Object.values(r).map(quote).join(',')).join('\n')+'\n',{mode:0o600})
const moduleUrl=pathToFileURL(resolve('.tools/analysis/node_modules/@duckdb/node-api/lib/index.js')).href
const {DuckDBInstance}=await import(moduleUrl)
const instance=await DuckDBInstance.create(':memory:'),connection=await instance.connect()
const sqlPath=(value:string)=>"'"+value.replaceAll('\\','/').replaceAll("'","''")+"'"
const jsonSource=`read_json_auto(${sqlPath(jsonPath)})`,csvSource=`read_csv(${sqlPath(csvPath)},header=true,all_varchar=true)`
await connection.run(`copy (select source_row::integer as source_row,owner::varchar as owner,year::integer as "year",month::integer as "month",category::varchar as category,net::decimal(18,2) as net from ${jsonSource}) to ${sqlPath(parquetPath)} (format parquet,compression zstd)`)
const pool=new pg.Pool({connectionString:target.href}),db=await pool.connect()
const checks:Record<string,unknown>={},timings:Record<string,number[]>={}
try{
 await db.query('create schema if not exists analysis')
 await db.query('drop table if exists analysis.annual_poc') // Only the explicitly isolated analysis dataset.
 await db.query('create table analysis.annual_poc(source_row integer primary key,owner text,year integer,month integer,category text,net numeric(18,2))')
 for(let at=0;at<rows.length;at+=1000)await db.query('insert into analysis.annual_poc select * from jsonb_to_recordset($1::jsonb) as t(source_row integer,owner text,year integer,month integer,category text,net numeric(18,2))',[JSON.stringify(rows.slice(at,at+1000))])
 await db.query('analyze analysis.annual_poc')
 for(const [name,source] of Object.entries({csv:csvSource,json:jsonSource,parquet:`read_parquet(${sqlPath(parquetPath)})`})){
  timings[name]=[]
  for(let i=0;i<5;i++){
   const start=performance.now(),result=await connection.runAndReadAll(`select count(*)::varchar n,sum(net::decimal(18,2))::varchar total from ${source}`)
   checks[name]=result.getRowObjectsJson()[0];timings[name].push(performance.now()-start)
  }
 }
 timings.postgres=[]
 for(let i=0;i<5;i++){const start=performance.now();checks.postgres=(await db.query('select count(*)::text n,sum(net)::text total from analysis.annual_poc')).rows[0];timings.postgres.push(performance.now()-start)}
 if(new Set(Object.values(checks).map(v=>JSON.stringify(v))).size!==1)throw Error('Contagens/totais POC divergentes')
 const bytes={csv:(await stat(csvPath)).size,json:(await stat(jsonPath)).size,parquet:(await stat(parquetPath)).size,
  postgres:(await db.query("select pg_total_relation_size('analysis.annual_poc')::float8 n")).rows[0].n}
 const report={at:new Date().toISOString(),source:'https://www.camara.leg.br/cotas/Ano-2025.csv.zip',sha256,rows:rows.length,bytes,checks,queryMilliseconds:timings,
  scope:'Full annual file, public analytical projection: institutional owner, year, month, category, exact NUMERIC and source line. Does not replace the original evidence. No production records moved.',limitations:'One local machine, five repeated scans; not p95 or cloud performance. PostgreSQL includes primary-key index; files do not. Source lines are observation keys, not reconciled expense IDs.'}
 await writeFile(resolve(root,'manifest.json'),JSON.stringify(report,null,2),{mode:0o600})
 console.log(JSON.stringify(report))
}finally{db.release();await pool.end();connection.closeSync();instance.closeSync()}
