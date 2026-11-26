import {spawn} from 'node:child_process'
import {mkdir,mkdtemp,writeFile,rm,readdir,lstat} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {tmpdir} from 'node:os'
import {backupKey,encryptBackup,decryptBackup,fileHash} from '../packages/scout/backup.ts'

// A mounted private external directory is supported. No uploads to public Actions artifacts.
const destination=process.env.BACKUP_DIRECTORY
if(!destination)throw Error('Configure BACKUP_DIRECTORY em volume privado externo ou diretório privado de ensaio')
const key=backupKey(process.env.BACKUP_KEY_HEX)
const retention=Number(process.env.BACKUP_RETENTION_DAYS||30)
if(!Number.isSafeInteger(retention)||retention<1||retention>3650)throw Error('Retenção inválida')
const url=new URL(process.env.BACKUP_DATABASE_URL||'')
if(!url.username.includes('backup'))throw Error('Use login dedicado de backup, separado de reader/writer')
if(!['localhost','127.0.0.1','::1','[::1]'].includes(url.hostname)&&url.searchParams.get('sslmode')!=='verify-full')throw Error('Backup remoto exige TLS verify-full')
const work=await mkdtemp(join(tmpdir(),'observabr-backup-'))
const dump=join(work,'database.dump'),verification=join(work,'verified.dump')
const root=resolve(destination)
await mkdir(root,{recursive:true,mode:0o700})
if((await lstat(root)).isSymbolicLink())throw Error('Destino simbólico recusado')
const base='observabr-'+new Date().toISOString().replaceAll(':','-')
const encrypted=join(root,base+'.obr')
try{
 const result=await new Promise<number|null>((done,reject)=>{
  const args=['--format=custom','--schema=observabr','--enable-row-security','--no-password','--lock-wait-timeout=15s','--file',dump]
  const child=spawn(process.env.PG_DUMP_BIN||'pg_dump',args,{timeout:240000,env:{...process.env,
   PGHOST:url.hostname,PGPORT:url.port||'5432',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),
   PGDATABASE:decodeURIComponent(url.pathname.slice(1)),PGSSLMODE:url.searchParams.get('sslmode')||'prefer',
   ...(url.searchParams.get('sslrootcert')?{PGSSLROOTCERT:url.searchParams.get('sslrootcert')!}:{})},stdio:['ignore','ignore','pipe']})
  // pg_dump errors may contain endpoints/usernames; report a generic status, never raw stderr.
  child.stderr.resume();child.on('error',()=>reject(Error('Não foi possível iniciar pg_dump')));child.on('exit',done)
 })
 if(result!==0)throw Error('pg_dump falhou; backup anterior preservado')
 const plainSha256=await fileHash(dump)
 const metadata=await encryptBackup(dump,encrypted,key)
 await decryptBackup(encrypted,verification,key)
 if(await fileHash(verification)!==plainSha256)throw Error('Integridade do backup divergente')
 await writeFile(join(root,base+'.json'),JSON.stringify({...metadata,plainSha256,encryptedSha256:await fileHash(encrypted),schema:'observabr',restoreTest:'authenticated round-trip; isolated PostgreSQL restore required separately'},null,2),{flag:'wx',mode:0o600})
 // Only delete our exact file format, after creating and verifying the new backup.
 for(const name of await readdir(root)){
  if(!/^observabr-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z\.(obr|json)$/.test(name))continue
  const path=join(root,name),info=await lstat(path)
  if(info.isFile()&&!info.isSymbolicLink()&&info.mtimeMs<Date.now()-retention*86400000)await rm(path)
 }
 console.log(JSON.stringify({backup:base,verified:true,retentionDays:retention}))
}finally{await rm(work,{recursive:true,force:true})}
