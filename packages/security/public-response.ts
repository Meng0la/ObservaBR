type Projection={payload:unknown,original:boolean,suppressedFields:string[]}
const restricted=/cpf|email|telefone|endereco|nascimento|nomecivil|familiares|token|authorization|password|senha|apikey|servicerole|secret/i
export function publicResponse(input:unknown):Projection {
 const suppressedFields:string[]=[]
 function clean(value:unknown,path:string,depth=0):unknown {
  if(depth>64){suppressedFields.push(path);return null}
  if(typeof value==='string'){
   const key=path.slice(path.lastIndexOf('/')+1)
   if(/^(?:id|.*Id|numero|num.*|ano|cod.*|valor.*|amount|gross|net|withheld|quantidade|sequencia)$/i.test(key)&&/^-?\d+(?:\.\d+)?$/.test(value))return value
   const safe=value.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,'[identificador pessoal suprimido]')
   if(safe!==value)suppressedFields.push(path)
   return safe
  }
  if(Array.isArray(value))return value.map((row,index)=>clean(row,path+'/'+index,depth+1))
  if(!value||typeof value!=='object')return value
  const source=value as Record<string,unknown>
  const target:Record<string,unknown>=Object.create(null)
  const individual=typeof source.cnpjCpfFornecedor==='string'&&source.cnpjCpfFornecedor.replace(/\D/g,'').length===11
  for(const [key,item] of Object.entries(source)){
   const normalized=key.normalize('NFD').replace(/[\u0300-\u036f_ -]/g,'')
   const company=normalized.toLowerCase()==='cnpjcpffornecedor'&&typeof item==='string'&&/^\d{14}$/.test(item)
   if((restricted.test(normalized)&&!company)||(individual&&key==='nomeFornecedor')||['__proto__','constructor','prototype'].includes(key)){
    suppressedFields.push(path+'/'+key)
   }else target[key]=clean(item,path+'/'+key,depth+1)
  }
  return target
 }
 const payload=clean(input,'')
 return {payload,original:suppressedFields.length===0,suppressedFields}
}
