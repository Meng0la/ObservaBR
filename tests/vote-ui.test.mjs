import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'

// Caso histórico documentado em docs/VOTE_AUDIT.md. Este teste só consulta a
// instância indicada; o enriquecimento e as evidências devem existir no índice.
const base = process.env.OBSERVABR_TEST_URL
const voteId = '2520670-66'
const official = 'https://dadosabertos.camara.leg.br/api/v2/votacoes/' + voteId

function privateKeys(value) {
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, child]) => {
    if (/^(email|cpf|enderecoResidencial|telefonePessoal|authorization|apiKey)$/i.test(key)) return [key]
    return privateKeys(child)
  })
}

async function readJson(download) {
  const stream = await download.createReadStream()
  assert.ok(stream)
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

test('Votação documentada, registros nominais e inspeção das evidências no navegador', {
  skip: !base, timeout: 100000
}, async t => {
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname))
  const browser = await chromium.launch({executablePath: process.env.CHROME_BIN || undefined})
  t.after(() => browser.close())
  const context = await browser.newContext({viewport: {width: 1440, height: 960}, reducedMotion: 'reduce'})
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() !== 'error') return
    const url = message.location().url
    // A foto institucional externa pode falhar. O frontend possui fallback.
    if (!url.startsWith('https://www.camara.leg.br/internet/deputado/bandep/')) errors.push(message.text())
  })
  const folder = process.env.OBSERVABR_SCREENSHOTS
  if (folder) await mkdir(folder, {recursive: true})
  const route = new URL('/#registro/vote/' + voteId, base)
  await page.goto(route.href)
  const main = page.getByRole('main')
  await main.getByRole('heading', {level: 1}).filter({hasText: /PLP\s*128\s*\/\s*2025/i}).waitFor()
  const text = await main.innerText()
  assert.match(text, /DTQ\s*8|Destaque\s*(?:n[º°.o]\s*)?8/i)
  assert.match(text, /art(?:igo|\.)\s*8/i)
  assert.match(text, /mantido o texto/i)
  for (const n of [286, 116, 402, 404]) assert.match(text, new RegExp('\\b'+n+'\\b'))
  if (folder) await page.screenshot({path: join(folder, 'votacao-desktop.png'), fullPage: true})

  await main.getByText('Votos nominais', {exact: true}).first().click()
  const profile = main.locator('a[href^="#politician/"]').first()
  await profile.waitFor()
  assert.match(await profile.getAttribute('href'), /^#politician\/\d+/)
  const published=await (await context.request.get(new URL('/api/votes/'+voteId,base).href)).json()
  const choice=published.partyCounts.find(row=>row.party&&row.vote&&row.count>0)
  await main.getByLabel('Partido no registro nominal',{exact:true}).selectOption(choice.party)
  await main.getByLabel('Voto registrado',{exact:true}).selectOption(choice.vote)
  const filtered=page.waitForResponse(response=>{
    const url=new URL(response.url())
    return url.pathname==='/api/records'&&url.searchParams.get('party')===choice.party&&url.searchParams.get('vote')===choice.vote
  })
  await main.getByRole('button',{name:'Filtrar votos'}).click()
  const filteredRows=await (await filtered).json()
  assert.equal(filteredRows.total,choice.count)
  assert.ok(filteredRows.items.every(row=>row.data.party===choice.party&&row.data.vote===choice.vote))
  const csv = main.getByRole('link', {name: /CSV/i}).first()
  await csv.waitFor()
  const url = new URL(await csv.getAttribute('href'), base)
  assert.equal(url.origin, new URL(base).origin)
  const exported = await context.request.get(url.href)
  assert.equal(exported.status(), 200)
  assert.match(exported.headers()['content-type'], /csv/)

  await main.getByText('API', {exact: true}).first().click()
  const explorer = main.locator('.api-explorer')
  await explorer.getByRole('tab', {name: 'Dados interpretados'}).waitFor()
  await explorer.getByRole('tab', {name: 'Resposta original'}).click()
  const evidenceResponse = await context.request.get(new URL('/api/evidence/vote/' + voteId, base).href)
  assert.equal(evidenceResponse.status(), 200)
  const evidence = await evidenceResponse.json()
  const index = evidence.documents.findIndex(doc => doc.api_url === official)
  assert.ok(index >= 0, 'Evidência da resposta complementar da votação')
  const selector = explorer.getByLabel('Documento consultado', {exact: true})
  if (evidence.documents.length > 1) await selector.selectOption({index})
  const search = explorer.getByRole('searchbox', {name: 'Pesquisar campos no JSON'})
  await search.fill('descUltimaAberturaVotacao')
  await explorer.getByText(/\/descUltimaAberturaVotacao/).first().waitFor()
  await search.fill('')
  const pending = page.waitForEvent('download')
  await explorer.getByRole('button', {name: 'Exportar JSON'}).click()
  const raw = await readJson(await pending)
  const body = raw.dados ?? raw
  assert.equal(body.id, voteId)
  assert.equal(body.proposicoesAfetadas.find(x => x.id === 2520670)?.numero, 128)
  assert.deepEqual(privateKeys(raw), [])
  const nominalIndex=evidence.documents.findIndex(doc=>doc.api_url===official+'/votos')
  assert.ok(nominalIndex>=0)
  await selector.selectOption({index:nominalIndex})
  await explorer.getByRole('heading',{name:'Resposta coletada com campos suprimidos',exact:true}).waitFor()
  const suppressed=explorer.locator('details').filter({has:page.locator('summary').filter({hasText:/^Campos suprimidos/})})
  assert.equal(await suppressed.evaluate(node=>node.open),false)
  await selector.selectOption({index})
  await explorer.getByRole('tab', {name: 'Metadados da fonte'}).click()
  await explorer.getByRole('link', {name: official, exact: true}).first().waitFor()
  assert.match(await explorer.getByRole('tabpanel').innerText(), /[a-f\d]{64}/)
  for (const width of [390, 1440]) {
    await page.setViewportSize({width, height: width === 390 ? 844 : 960})
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    if (folder) await page.screenshot({path: join(folder, 'explorer-' + width + '.png'), fullPage: true})
  }
  for(const theme of ['dark','light']){
    if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('#theme').click()
    for(const [view,heading] of [['contexto','Placar proclamado'],['votos','Votos nominais']]){
      await page.goto(new URL('/#registro/vote/'+voteId+'/'+view,base).href)
      await main.getByRole('heading',{name:heading,exact:true}).waitFor()
      for(const width of [390,768,1024,1440,1920]){
        await page.setViewportSize({width,height:width===390?844:960})
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,view+' '+theme+' '+width)
        if(folder)await page.screenshot({path:join(folder,view+'-'+width+'-'+theme+'.png'),fullPage:true})
      }
    }
  }
  assert.deepEqual(errors, [])
})
