import {lookup} from 'node:dns/promises'
import {BlockList} from 'node:net'
import {inflateRawSync,crc32} from 'node:zlib'
import {createHash} from 'node:crypto'

export function annualExpenseUrl(year:number){
 if(!Number.isInteger(year)||year<2008||year>new Date().getUTCFullYear())throw Error('Ano de arquivo inválido')
 return new URL(`https://www.camara.leg.br/cotas/Ano-${year}.csv.zip`)
}
export async function readAnnualExpenseFile(year:number,maxBytes=16*1024*1024){
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1024||maxBytes>64*1024*1024)throw Error('Orçamento de arquivo inválido')
 const url=annualExpenseUrl(year)
 const blocked=new BlockList()
 for(const [ip,bits] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',4],['240.0.0.0',4]] as const)blocked.addSubnet(ip,bits,'ipv4')
 for(const address of await lookup(url.hostname,{all:true,family:4}))if(blocked.check(address.address,'ipv4'))throw Error('Destino institucional recusado')
 const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(120000),headers:{Accept:'application/zip'}})
 if(!response.ok||response.status>=300||!response.body)throw Error('Arquivo institucional indisponível')
 if(Number(response.headers.get('content-length'))>maxBytes)throw Error('Arquivo excede orçamento')
 const chunks:Uint8Array[]=[];let size=0
 for await(const chunk of response.body){size+=chunk.byteLength;if(size>maxBytes)throw Error('Arquivo excede orçamento');chunks.push(chunk)}
 const raw=Buffer.concat(chunks),csv=csvFromZip(raw)
 return {url:url.href,raw,...csv,sha256:createHash('sha256').update(raw).digest('hex'),csvSha256:createHash('sha256').update(csv.csv).digest('hex')}
}
export function csvFromZip(raw:Buffer,maxExpanded=256*1024*1024){
 if(!Number.isSafeInteger(maxExpanded)||maxExpanded<1||maxExpanded>256*1024*1024)throw Error('Limite ZIP inválido')
 let end=-1
 for(let i=raw.length-22;i>=Math.max(0,raw.length-65557);i--)if(raw.readUInt32LE(i)===0x06054b50){end=i;break}
 if(end<0||raw.readUInt16LE(end+4)!==0||raw.readUInt16LE(end+6)!==0)throw Error('ZIP inválido ou não suportado')
 const entries=raw.readUInt16LE(end+10),offset=raw.readUInt32LE(end+16)
 if(entries===65535||entries>100||offset===0xffffffff)throw Error('ZIP64 ou excesso de membros não homologado')
 let at=offset,chosen:{name:string,start:number,size:number,expanded:number,method:number,crc:number}|undefined
 for(let n=0;n<entries;n++){
  if(at+46>raw.length||raw.readUInt32LE(at)!==0x02014b50)throw Error('Diretório ZIP inválido')
  const flags=raw.readUInt16LE(at+8),method=raw.readUInt16LE(at+10),crc=raw.readUInt32LE(at+16),size=raw.readUInt32LE(at+20),expanded=raw.readUInt32LE(at+24)
  const length=raw.readUInt16LE(at+28),extra=raw.readUInt16LE(at+30),comment=raw.readUInt16LE(at+32),local=raw.readUInt32LE(at+42)
  const name=raw.subarray(at+46,at+46+length).toString('utf8')
  if(at+46+length+extra+comment>end)throw Error('Diretório ZIP truncado')
  if(name.toLowerCase().endsWith('.csv')){
   if(chosen||name.includes('..')||name.includes('/')||name.includes('\\')||(flags&1)||expanded>maxExpanded||![0,8].includes(method)||local+30>raw.length)throw Error('Membro ZIP não homologado')
   if(raw.readUInt32LE(local)!==0x04034b50)throw Error('Cabeçalho ZIP inválido')
   const start=local+30+raw.readUInt16LE(local+26)+raw.readUInt16LE(local+28)
   if(start+size>offset)throw Error('Dados ZIP inválidos')
   chosen={name,start,size,expanded,method,crc}
  }
  at+=46+length+extra+comment
 }
 if(!chosen)throw Error('CSV ausente no arquivo')
 const compressed=raw.subarray(chosen.start,chosen.start+chosen.size)
 const csv=chosen.method===0?Buffer.from(compressed):inflateRawSync(compressed,{maxOutputLength:maxExpanded})
 if(csv.length!==chosen.expanded||crc32(csv)!==chosen.crc)throw Error('Integridade ZIP divergente')
 return {csv,name:chosen.name}
}
export function* csvRows(text:string){
 let row:string[]=[],field='',quoted=false
 for(let i=text.charCodeAt(0)===0xfeff?1:0;i<text.length;i++){
  const char=text[i]
  if(char==='"'){
   if(quoted&&text[i+1]==='"'){field+='"';i++}else quoted=!quoted
  }else if(!quoted&&(char===';'||char==='\n'||char==='\r')){
   row.push(field);field=''
   if(row.length>128)throw Error('CSV com colunas demais')
   if(char!==';'){
    if(char==='\r'&&text[i+1]==='\n')i++
    if(row.some(Boolean))yield row
    row=[]
   }
  }else field+=char
  if(field.length>1024*1024)throw Error('Campo CSV excede limite')
 }
 if(quoted)throw Error('CSV truncado')
 if(field||row.length){row.push(field);yield row}
}
