import {mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {database} from '../packages/database/index.ts'

// Private transfer bundle. Never publish this directory or include it in a build.
const directory=resolve('.tools/cloud-migration')
const tables=['source_documents','records','data_revisions','collection_jobs','collection_requests',
  'api_snapshots','enrichment_jobs','entity_contexts','enrichment_documents']
const pool=database()
const db=await pool.connect()
await mkdir(directory,{recursive:true})
const manifest:{table:string;rows:number;sha256:string;files:string[]}[]=[]
try {
  await db.query('begin isolation level repeatable read read only')
  await db.query("set local timezone='UTC'")
  const integrity=await db.query("select count(*)::int as invalid from source_documents where sha256<>encode(sha256(raw),'hex')")
  if(integrity.rows[0].invalid)throw new Error('Hash do documento de origem divergente')
  for(const table of tables) {
    const columns=await db.query(`select column_name from information_schema.columns
      where table_schema='observabr' and table_name=$1 order by ordinal_position`,[table])
    const names=columns.rows.map(row=>'"'+row.column_name.replaceAll('"','""')+'"').join(',')
    // Keep PostgreSQL's JSON text intact: JS must not round NUMERIC or bigint values.
    const {rows}=await db.query(`select to_jsonb(t)::text as row from observabr.${table} t order by to_jsonb(t)::text collate "C"`)
    const checksum=await db.query(`select encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E'\\n' order by to_jsonb(t)::text collate "C"),''),'UTF8')),'hex') as hash from observabr.${table} t`)
    const files:string[]=[]
    let batch:string[]=[],bytes=0
    const flush=async()=>{
      if(!batch.length)return
      const payload='['+batch.join(',')+']'
      // Apostrophes are SQL-escaped; backslashes remain literal with standard_conforming_strings.
      const sql=`set standard_conforming_strings=on; insert into observabr.${table} (${names}) overriding system value select ${names} from jsonb_populate_recordset(null::observabr.${table},'${payload.replaceAll("'","''")}'::jsonb) on conflict do nothing; select '${table}' as imported_table,${batch.length} as batch_rows;`
      const filename=`${table}-${String(files.length).padStart(3,'0')}.sql`
      await writeFile(resolve(directory,filename),sql,{mode:0o600})
      files.push(filename)
      batch=[];bytes=0
    }
    for(const row of rows){
      const size=Buffer.byteLength(row.row)*2 // Reserve room for escaped quotes and SQL syntax.
      if(bytes+size>650_000)await flush()
      if(size>1_800_000)throw new Error(`Documento excede limite de transferência em ${table}`)
      batch.push(row.row);bytes+=size
    }
    await flush()
    manifest.push({table,rows:rows.length,sha256:checksum.rows[0].hash,files})
    console.log(`${table}: ${rows.length} registros; ${files.length} lotes`)
  }
  await db.query('commit')
  await writeFile(resolve(directory,'manifest.json'),JSON.stringify({createdAt:new Date().toISOString(),tables:manifest},null,2)+'\n',{mode:0o600})
} catch(error) {
  await db.query('rollback')
  throw error
} finally {db.release();await pool.end()}
