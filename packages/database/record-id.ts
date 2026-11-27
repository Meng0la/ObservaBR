import type pg from 'pg'
export async function recordId(db:pg.Pool,kind:string,id:string){
 if(kind!=='expense')return id
 return (await db.query('select record_id from record_aliases where kind=$1 and alias_id=$2',[kind,id])).rows[0]?.record_id??id
}
