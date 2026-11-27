import {test} from 'node:test'
import assert from 'node:assert/strict'
import {crc32} from 'node:zlib'
import {annualExpenseUrl,csvFromZip,csvRows,readAnnualExpenseFile} from '../packages/collectors/camara/files.ts'
function zip(name:string,text:string){
 const filename=Buffer.from(name),body=Buffer.from(text),local=Buffer.alloc(30),central=Buffer.alloc(46),end=Buffer.alloc(22)
 local.writeUInt32LE(0x04034b50);local.writeUInt16LE(filename.length,26)
 central.writeUInt32LE(0x02014b50);central.writeUInt32LE(crc32(body),16);central.writeUInt32LE(body.length,20);central.writeUInt32LE(body.length,24);central.writeUInt16LE(filename.length,28)
 end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(central.length+filename.length,12);end.writeUInt32LE(local.length+filename.length+body.length,16)
 return Buffer.concat([local,filename,body,central,filename,end])
}
test('arquivo anual valida destino, orçamento, expansão, CRC e membro sem extrair caminhos',async()=>{
 assert.equal(annualExpenseUrl(2025).hostname,'www.camara.leg.br');assert.throws(()=>annualExpenseUrl(0))
 await assert.rejects(readAnnualExpenseFile(2025,Infinity),/Orçamento/)
 assert.equal(csvFromZip(zip('Ano-2025.csv','a;b')).csv.toString(),'a;b')
 assert.throws(()=>csvFromZip(zip('../Ano.csv','a;b')))
 assert.throws(()=>csvFromZip(zip('Ano.csv','a;b'),2))
 const corrupt=zip('Ano.csv','a;b');corrupt[37]^=1;assert.throws(()=>csvFromZip(corrupt))
 assert.throws(()=>csvFromZip(Buffer.from('not a zip')))
})
test('CSV anual conserva delimitadores e aspas em campos e recusa truncamento',()=>{
 assert.deepEqual([...csvRows('\ufeffa;b\r\n"x;y";"a""b"\r\n')],[['a','b'],['x;y','a"b']])
 assert.throws(()=>[...csvRows('a;"b')],/truncado/)
})
