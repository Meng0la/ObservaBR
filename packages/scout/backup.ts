import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto'
import {createReadStream,createWriteStream} from 'node:fs'
import {writeFile,open,stat,rm} from 'node:fs/promises'
import {Transform} from 'node:stream'
import {pipeline} from 'node:stream/promises'

const magic=Buffer.from('OBRBAK01')
export function backupKey(value:string|undefined){
 if(!value||!/^[a-fA-F0-9]{64}$/.test(value))throw Error('BACKUP_KEY_HEX exige chave independente de 32 bytes')
 return Buffer.from(value,'hex')
}
export async function encryptBackup(source:string,destination:string,key:Buffer){
 const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce)
 const handle=await open(destination,'wx',0o600)
 await handle.write(Buffer.concat([magic,nonce]));await handle.close()
 const digest=createHash('sha256');let bytes=0
 await pipeline(createReadStream(source),cipher,new Transform({transform(chunk,_encoding,done){digest.update(chunk);bytes+=chunk.length;done(null,chunk)}}),createWriteStream(destination,{flags:'a',mode:0o600}))
 const tag=cipher.getAuthTag();await writeFile(destination,tag,{flag:'a'})
 return {version:1,algorithm:'AES-256-GCM',createdAt:new Date().toISOString(),ciphertextSha256:digest.digest('hex'),ciphertextBytes:bytes}
}
// Decryption validates GCM and the ciphertext hash before the caller can restore the dump.
// The destination stays private and is removed on authentication failure.
export async function decryptBackup(source:string,destination:string,key:Buffer){
 const size=(await stat(source)).size
 if(size<36)throw Error('Backup truncado')
 const handle=await open(source,'r'),header=Buffer.alloc(20),tag=Buffer.alloc(16)
 try{await handle.read(header,0,20,0);await handle.read(tag,0,16,size-16)}finally{await handle.close()}
 if(!header.subarray(0,8).equals(magic))throw Error('Formato de backup desconhecido')
 const decipher=createDecipheriv('aes-256-gcm',key,header.subarray(8));decipher.setAuthTag(tag)
 const output=await open(destination,'wx',0o600)
 try{
  await pipeline(createReadStream(source,{start:20,end:size-17}),decipher,output.createWriteStream())
 }catch(error){await output.close().catch(()=>{});await rm(destination,{force:true});throw error}
}
export async function fileHash(path:string){
 const hash=createHash('sha256')
 for await(const chunk of createReadStream(path))hash.update(chunk)
 return hash.digest('hex')
}
