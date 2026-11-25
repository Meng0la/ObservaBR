import {database} from '../../packages/database/index.ts'
import {app} from './app.ts'
const pool=database()
const server=await app(pool)
server.addHook('onClose',()=>pool.end())
process.once('SIGTERM',()=>void server.close())
process.once('SIGINT',()=>void server.close())
await server.listen({host:'0.0.0.0',port:Number(process.env.PORT||3000)})
