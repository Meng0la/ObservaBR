import {writeFile,rm} from 'node:fs/promises'
import {backupKey,encryptBackup,decryptBackup,fileHash} from '../../packages/scout/backup.ts'

const {BACKUP_PLAIN,BACKUP_ENCRYPTED,BACKUP_VERIFY,BACKUP_MANIFEST,BACKUP_KEY_HEX}=process.env
if(!BACKUP_PLAIN||!BACKUP_ENCRYPTED||!BACKUP_VERIFY||!BACKUP_MANIFEST)throw Error('Caminhos privados obrigatorios')
const key=backupKey(BACKUP_KEY_HEX)
try{
 const plainSha256=await fileHash(BACKUP_PLAIN)
 const metadata=await encryptBackup(BACKUP_PLAIN,BACKUP_ENCRYPTED,key)
 await decryptBackup(BACKUP_ENCRYPTED,BACKUP_VERIFY,key)
 if(await fileHash(BACKUP_VERIFY)!==plainSha256)throw Error('Round-trip divergente')
 const manifest={...metadata,plainSha256,encryptedSha256:await fileHash(BACKUP_ENCRYPTED),schema:'observabr',format:'tar-migrations-plus-csv',source:'production',sequenceState:'derived-from-restored-primary-key',restoreTest:'pending-isolated-postgresql'}
 await writeFile(BACKUP_MANIFEST,JSON.stringify(manifest,null,2),{flag:'wx',mode:0o600})
 console.log(JSON.stringify({encrypted:true,authenticated:true,hashes:true,ciphertextBytes:metadata.ciphertextBytes}))
}finally{
 await rm(BACKUP_PLAIN,{force:true})
 await rm(BACKUP_VERIFY,{force:true})
}
