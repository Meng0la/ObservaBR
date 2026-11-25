import {z} from 'zod'
import {database} from '../packages/database/index.ts'
import {enqueue} from '../packages/scout/store.ts'
import {collectionUrl} from '../packages/collectors/camara/index.ts'
const schema=z.object({kind:z.enum(['politician','expense','ballot','vote','proposal']),
 year:z.number().int(),name:z.string().min(3).max(100).optional(),month:z.number().int().min(1).max(12).optional(),owner:z.string().max(40).optional()}).strict()
const task=schema.parse(JSON.parse(process.argv[2]??'{}'))
collectionUrl(task)
const pool=database()
const db=await pool.connect()
try {await enqueue(db,task,1);console.log('Trabalho registrado')} finally {db.release();await pool.end()}
