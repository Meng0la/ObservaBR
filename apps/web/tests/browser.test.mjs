import {test} from 'node:test'
import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'
import {preview} from 'vite'
import {fileURLToPath} from 'node:url'

// Fixture exclusiva deste teste. Nenhum registro é gravado na aplicação.
const fixture = {kind:'politician',id:'teste',title:'Parlamentar de teste',owner:null,
  date:null,amount:null,data:{uf:'DF',party:'TESTE'},api_url:'https://dadosabertos.camara.leg.br',
  source_url:'https://dadosabertos.camara.leg.br',field:'/dados/0',collector_version:'teste',sha256:'a'.repeat(64)}

test('panorama, perfil, fonte original, consulta e navegação móvel',async t=>{
  const server=await preview({root:fileURLToPath(new URL('..',import.meta.url)),preview:{host:'127.0.0.1',port:0},logLevel:'silent'})
  t.after(()=>server.close())
  const browser=await chromium.launch({executablePath:process.env.CHROME_BIN || undefined})
  t.after(()=>browser.close())
  const page=await browser.newPage()
  const errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text())})
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url())
    let data
    if(url.pathname==='/api/summary')data={counts:{politician:1,expense:0,proposal:0,vote:0,ballot:0},states:[{uf:'DF',count:1}],jobs:[],lastVerified:null}
    else if(url.pathname==='/api/records/politician/teste')data=fixture
    else if(url.pathname==='/api/records')data=url.searchParams.get('kind')==='vote'?{items:[],total:0}:{items:[fixture],total:1}
    else return route.abort()
    return route.fulfill({json:data})
  })
  await page.goto(server.resolvedUrls.local[0])
  await page.getByRole('heading',{name:/A atividade pública,.*à vista de todos/i}).waitFor()
  await page.locator('.maplibregl-canvas').waitFor()
  await page.waitForTimeout(1500)
  assert.equal(await page.getByText('Mapa indisponível.',{exact:false}).count(),0)
  await page.getByLabel('Consultar representantes por UF').selectOption('DF')
  await page.getByRole('link',{name:fixture.title,exact:true}).click()
  await page.getByRole('heading',{name:fixture.title,exact:true}).waitFor()
  await page.getByRole('button',{name:'Ver fonte original'}).click()
  assert.equal(await page.getByRole('dialog').isVisible(),true)
  await page.getByRole('button',{name:'Fechar'}).click()
  await page.setViewportSize({width:375,height:800})
  await page.getByLabel('Pesquisa global',{exact:true}).fill('Parlamentar')
  await page.getByLabel('Pesquisa global',{exact:true}).press('Enter')
  await page.getByRole('heading',{name:'Pesquisa global'}).waitFor()
  await page.getByRole('link',{name:fixture.title,exact:true}).waitFor()
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  assert.deepEqual(errors,[])
})
