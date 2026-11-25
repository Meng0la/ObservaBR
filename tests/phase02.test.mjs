import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {mkdir, readFile, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {chromium} from '@playwright/test'

const base = process.env.OBSERVABR_TEST_URL
const output = process.env.PHASE02_OUTPUT || '.tools/phase02/after'
const widths = [390, 768, 1024, 1440, 1920]
const routes = [
  ['home', 'panorama'],
  ['diretorio', 'registros/politician'],
  ['perfil', 'politician/204379']
]

async function openRoute(page, hash) {
  const target = new URL('#' + hash, base).href
  const previous = page.url() !== target ? await page.locator('main h1').first().elementHandle({timeout: 250}).catch(() => null) : null
  await page.goto(target)
  if (previous) await previous.waitForElementState('hidden')
  await page.waitForFunction(() => {
    const main = document.querySelector('main[aria-busy=false]')
    return main?.querySelector('h1') && !main.innerText.includes('Carregando consulta…')
  })
  await page.evaluate(() => document.fonts.ready)
}

// Contraste WCAG de texto HTML sobre superfícies de cores sólidas, com
// composição alfa. Canvas, imagens e controles nativos exigem revisão visual.
function inspectText() {
  const ctx = document.createElement('canvas').getContext('2d', {willReadFrequently: true})
  const palette = new Map()
  function color(value) {
    if (!palette.has(value)) {
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = value
      ctx.fillRect(0, 0, 1, 1)
      palette.set(value, Array.from(ctx.getImageData(0, 0, 1, 1).data))
    }
    return palette.get(value)
  }
  function over(top, bottom) {
    const a = top[3] / 255
    return top.slice(0, 3).map((n, i) => n * a + bottom[i] * (1 - a))
  }
  function luminance(rgb) {
    const [r, g, b] = rgb.map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  let tested = 0
  let complex = 0
  const failures = []
  let minimum = null
  for (const element of document.body.querySelectorAll('*')) {
    if (!(element instanceof HTMLElement) || !element.checkVisibility({opacityProperty: true, visibilityProperty: true})) continue
    if (element.matches('script, style, option, svg, canvas, select:disabled, input:disabled, button:disabled')) continue
    const rect = element.getBoundingClientRect()
    if (!rect.width || !rect.height || rect.right <= 0 || rect.bottom <= 0) continue
    const text = [...element.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join('').trim()
    const placeholder = !text && element instanceof HTMLInputElement && !element.value && element.placeholder
    if (!text && !placeholder) continue
    const ancestors = []
    for (let node = element; node; node = node.parentElement) ancestors.push(getComputedStyle(node))
    if (ancestors.some(s => s.backgroundImage !== 'none' || Number(s.opacity) < 1)) {
      complex++
      continue
    }
    let background = [255, 255, 255]
    for (const s of ancestors.reverse()) background = over(color(s.backgroundColor), background)
    const style = getComputedStyle(element, placeholder ? '::placeholder' : null)
    const fontSize = parseFloat(style.fontSize)
    const threshold = fontSize >= 24 || (fontSize >= 18.6667 && Number(style.fontWeight) >= 700) ? 3 : 4.5
    const light = luminance(over(color(style.color), background))
    const dark = luminance(background)
    const ratio = (Math.max(light, dark) + 0.05) / (Math.min(light, dark) + 0.05)
    const detail = {text: (text || placeholder).slice(0, 70), ratio: Number(ratio.toFixed(3)), threshold,
      element: element.tagName.toLowerCase() + '.' + element.className, foreground: style.color, background}
    if (minimum === null || ratio < minimum.ratio) minimum = detail
    if (ratio < threshold) failures.push(detail)
    tested++
  }
  return {tested, complex, minimum, failures}
}

test('Fase 02 · temas, resoluções, contraste de texto, capturas e teclado', {skip: !base, timeout: 240000}, async t => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname))
  await mkdir(output, {recursive: true})
  const browser = await chromium.launch({executablePath: process.env.CHROME_BIN || undefined})
  t.after(() => browser.close())
  const context = await browser.newContext({deviceScaleFactor: 1, reducedMotion: 'reduce', viewport: {width: 1440, height: 960}})
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  const results = []
  const signatures = {}
  await openRoute(page, 'panorama')
  for (const theme of ['dark', 'light']) {
    if (await page.locator('html').getAttribute('data-theme') !== theme) await page.locator('#theme').click()
    assert.equal(await page.locator('html').getAttribute('data-theme'), theme)
    for (const width of widths) {
      const height = width === 390 ? 844 : 960
      await page.setViewportSize({width, height})
      for (const [name, hash] of routes) {
        await openRoute(page, hash)
        if (name === 'home') {
          await page.locator('.maplibregl-canvas').waitFor()
          await page.waitForTimeout(600)
        }
        const screenshot = name + '-' + width + '-' + theme + '.png'
        const shot = await page.screenshot({path: join(output, screenshot), animations: 'disabled', fullPage: true})
        signatures[screenshot] = createHash('sha256').update(shot).digest('hex')
        results.push({theme, width, name, screenshot, heading: await page.locator('main h1').first().innerText(),
          overflow: await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
          contrast: await page.evaluate(inspectText)})
      }
    }
  }
  const report = {generated: new Date().toISOString(), chrome: browser.version(), results, errors}
  await writeFile(join(output, 'matrix.json'), JSON.stringify(report, null, 2))
  await writeFile(join(output, 'signatures.json'), JSON.stringify(signatures, null, 2))
  if (process.env.PHASE02_APPROVED_SIGNATURES) {
    const approved = JSON.parse(await readFile(process.env.PHASE02_APPROVED_SIGNATURES, 'utf8'))
    assert.deepEqual(signatures, approved, 'Diferença na captura aprovada; inspecione os arquivos antes de atualizar as referências.')
  }
  assert.deepEqual(results.filter(r => r.overflow > 0).map(r => r.screenshot), [], 'Overflow horizontal')
  const contrastIssues = results.flatMap(r => r.contrast.failures.map(f => r.screenshot + ' ' + f.text + ' ' + f.ratio))
  assert.deepEqual([...new Set(contrastIssues)].slice(0, 12), [], 'Contraste abaixo do limiar WCAG')
  assert.ok(results.every(r => r.contrast.tested > 8 && !/indisponível|não encontrada/i.test(r.heading)))
  assert.deepEqual([...new Set(errors)], [], 'Erros de execução no navegador')

  await openRoute(page, 'panorama')
  const summary = await (await context.request.get(new URL('/api/summary', base).href)).json()
  const geo = await (await context.request.get(new URL('/geo/uf.geojson', base).href)).json()
  assert.equal(new Set(geo.features.map(f => f.properties.codarea)).size, 27)
  const canvas = page.locator('.maplibregl-canvas')
  await canvas.scrollIntoViewIfNeeded()
  const mapBox = await canvas.boundingBox()
  const popup = page.locator('.maplibregl-popup-content')
  let selected
  for (const y of [.43, .37, .48, .54]) {
    await page.mouse.move(mapBox.x + mapBox.width * .5, mapBox.y + mapBox.height * y)
    if (await popup.waitFor({state: 'visible', timeout: 700}).then(() => true).catch(() => false)) {
      selected = await popup.locator('strong').innerText()
      const count = summary.states.find(state => state.uf === selected)?.count
      assert.ok(Number.isInteger(count))
      assert.match(await popup.innerText(), new RegExp('\\b' + count + '\\b'))
      await page.mouse.down()
      await page.mouse.up()
      break
    }
  }
  assert.ok(selected, 'O mapa deve renderizar polígonos que respondem ao ponteiro')
  await page.waitForURL(url => new URLSearchParams(url.hash.split('?')[1]).get('uf') === selected)

  await openRoute(page, 'registros/politician')
  await page.getByLabel('Partido', {exact: true}).selectOption('MDB')
  await page.getByLabel('Ordenação').selectOption('name-desc')
  const updated = page.waitForResponse(response => {
    const url = new URL(response.url())
    return url.pathname === '/api/records' && url.searchParams.get('party') === 'MDB' && url.searchParams.get('sort') === 'name-desc'
  })
  await page.getByRole('button', {name: 'Aplicar'}).press('Enter')
  const filtered = await (await updated).json()
  assert.ok(filtered.items.length > 1 && filtered.items.every(r => r.data.party === 'MDB'))
  await page.getByRole('link', {name: filtered.items[0].title, exact: true}).first().waitFor()
  assert.match(await page.getByRole('link', {name: 'CSV', exact: true}).getAttribute('href'), /sort=name-desc/)

  await openRoute(page, 'politician/204379')
  const trigger = page.getByRole('button', {name: 'Ver fonte original'}).first()
  await trigger.focus()
  await page.keyboard.press('Enter')
  assert.equal(await page.getByRole('dialog').isVisible(), true)
  await page.keyboard.press('Tab')
  assert.equal(await page.evaluate(() => !!document.activeElement?.closest('dialog')), true)
  await page.keyboard.press('Escape')
  assert.equal(await page.getByRole('dialog').isVisible(), false)
  assert.equal(await trigger.evaluate(el => el === document.activeElement), true)
  await page.reload()
  await page.keyboard.press('Tab')
  assert.match(await page.evaluate(() => document.activeElement?.textContent), /Pular|Saltar/i)
  await page.keyboard.press('Enter')
  assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'MAIN')
  await page.keyboard.press('/')
  assert.equal(await page.evaluate(() => document.activeElement?.type), 'search')
  await page.getByRole('link', {name: 'Design system', exact: true}).press('Enter')
  await page.getByRole('heading', {name: 'Design system', exact: true}).waitFor()
  await page.getByRole('button', {name: 'Testar feedback'}).press('Enter')
  await page.getByRole('status').filter({hasText: 'Ação recebida'}).waitFor()
})
