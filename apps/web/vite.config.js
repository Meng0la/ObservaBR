import { defineConfig } from 'vite'
const api=process.env.OBSERVABR_API_URL || 'http://127.0.0.1:3000'
export default defineConfig({
  server:{proxy:{'/api':api}},
  preview:{proxy:{'/api':api}}
})
