import {test} from 'node:test'
import assert from 'node:assert/strict'
import {chromium} from '@playwright/test'

const base=process.env.OBSERVABR_TEST_URL
test('navegação sobre índice real, histórico financeiro e voto nominal', {skip:!base}, async t=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME_BIN || undefined})
  t.after(()=>browser.close())
  const page=await browser.newPage({viewport:{width:1366,height:900}})
  const errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  async function api(path) {
    const response=await fetch(new URL(path,base))
    assert.equal(response.status,200)
    return response.json()
  }
  const expenses=await api('/api/records?kind=expense')
  const ballots=await api('/api/records?kind=ballot')
  assert.ok(expenses.total && ballots.total,'O índice precisa conter despesas e votos nominais reais')
  const person=await api('/api/records/politician/'+expenses.items[0].owner)
  await page.goto(base)
  await page.getByRole('heading',{name:/A atividade pública,.*à vista de todos/i}).waitFor()
  await page.locator('.maplibregl-canvas').waitFor({timeout:10000})
  await page.getByLabel('Pesquisa global',{exact:true}).fill(person.title)
  await page.getByLabel('Pesquisa global',{exact:true}).press('Enter')
  await page.getByRole('link',{name:person.title,exact:true}).first().click()
  await page.getByRole('heading',{name:person.title,exact:true}).waitFor()
  await page.getByRole('navigation',{name:'Seções do perfil'}).getByRole('link',{name:'Despesas'}).click()
  await page.getByText('Ver valores mensais').click()
  await page.getByRole('button',{name:'Ver fonte original'}).first().click()
  assert.ok((await page.getByRole('link',{name:'Consultar resposta da API'}).getAttribute('href')).startsWith('https://dadosabertos.camara.leg.br/'))
  await page.getByRole('button',{name:'Fechar'}).click()
  const voteId=ballots.items[0].data.voteId
  await page.goto(new URL('/#registro/vote/'+encodeURIComponent(voteId),base).href)
  await page.getByRole('link',{name:'Consultar votos nominais indexados'}).click()
  await page.getByRole('button',{name:'Ver fonte original'}).first().waitFor()
  assert.ok(page.url().includes('/vote/'+encodeURIComponent(voteId)+'/votos'))
  assert.deepEqual(errors,[])
})
