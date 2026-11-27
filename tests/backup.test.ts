import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,readFile,rm,stat} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {randomBytes} from 'node:crypto'
import {backupKey,backupProcessEnvironment,encryptBackup,decryptBackup,fileHash} from '../packages/scout/backup.ts'
test('backup autenticado recupera bytes e rejeita corrupção/chave diferente',async()=>{
 const root=await mkdtemp(join(tmpdir(),'observabr-backup-test-'))
 try{
  assert.throws(()=>backupKey('invalid'))
  const key=randomBytes(32),data=randomBytes(8192)
  const original=join(root,'original'),encrypted=join(root,'encrypted'),restored=join(root,'restored')
  await writeFile(original,data);await encryptBackup(original,encrypted,key);await decryptBackup(encrypted,restored,key)
  assert.equal(await fileHash(original),await fileHash(restored))
  await assert.rejects(decryptBackup(encrypted,join(root,'wrong-key'),randomBytes(32)))
  await assert.rejects(stat(join(root,'wrong-key')),{code:'ENOENT'})
  const damaged=await readFile(encrypted);damaged[25]^=1;await writeFile(encrypted,damaged)
  await assert.rejects(decryptBackup(encrypted,join(root,'damaged'),key))
 }finally{await rm(root,{recursive:true,force:true})}
})
test('processo de dump recebe somente ambiente necessário',()=>{
 const url=new URL('postgresql://backup_user:private@db.example:5432/observabr?sslmode=verify-full&sslrootcert=%2Fca.pem')
 const env=backupProcessEnvironment({PATH:'safe-path',BACKUP_KEY_HEX:'must-not-propagate',DATABASE_URL:'must-not-propagate',UNRELATED:'no'},url)
 assert.equal(env.PATH,'safe-path')
 assert.equal(env.PGUSER,'backup_user')
 assert.equal(env.PGSSLMODE,'verify-full')
 assert.equal(env.PGSSLROOTCERT,'/ca.pem')
 assert.equal(env.BACKUP_KEY_HEX,undefined)
 assert.equal(env.DATABASE_URL,undefined)
 assert.equal(env.UNRELATED,undefined)
})
