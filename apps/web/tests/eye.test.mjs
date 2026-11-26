import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'
import {chromium, expect} from '@playwright/test'
import {preview} from 'vite'

test('marca: movimento limitado, retorno, preferências, ciclo de vida e temas', async t => {
  const server = await preview({configFile:false, root:fileURLToPath(new URL('..', import.meta.url)), preview:{host:'127.0.0.1', port:0}, logLevel:'silent'})
  t.after(() => server.close())
  const browser = await chromium.launch({executablePath:process.env.CHROME_BIN || undefined})
  t.after(() => browser.close())
  const page = await browser.newPage({viewport:{width:1440,height:900}, reducedMotion:'no-preference'})
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  const url = server.resolvedUrls.local[0]
  await page.goto(url + '#metodologia')
  const eye = page.locator('.brand observa-eye')
  const iris = eye.locator('[data-eye-iris]')
  await expect(eye.locator('svg')).toBeVisible()
  await expect(page.getByRole('link', {name:'ObservaBR, início', exact:true})).toBeVisible()
  const outline = await eye.locator('path').getAttribute('d')
  await page.mouse.move(1400, 800)
  await expect(iris).toHaveAttribute('transform', /translate\([1-5]/)
  await page.waitForTimeout(700)
  const position = await iris.getAttribute('transform')
  const [x,y] = position.match(/-?\d+\.\d+/g).map(Number)
  assert.ok(x > 0 && y > 0)
  assert.ok(Math.hypot(x / 5, y / 3.2) <= 1.001)
  assert.equal(await eye.locator('path').getAttribute('transform'), null)
  assert.equal(await eye.locator('path').getAttribute('d'), outline)
  await page.waitForTimeout(150)
  assert.equal(await iris.getAttribute('transform'), position)
  await page.evaluate(() => document.documentElement.dispatchEvent(new PointerEvent('pointerleave')))
  await expect(iris).not.toHaveAttribute('transform')
  await page.mouse.move(1200, 600)
  await expect(iris).toHaveAttribute('transform', /translate/)
  await page.emulateMedia({reducedMotion:'reduce'})
  await expect(iris).not.toHaveAttribute('transform')
  await page.mouse.move(1300, 700)
  await page.waitForTimeout(100)
  await expect(iris).not.toHaveAttribute('transform')
  await page.emulateMedia({reducedMotion:'no-preference'})
  await page.waitForTimeout(50) // Chromium delivers MediaQueryList change asynchronously.
  await page.mouse.move(1000, 500)
  await expect(iris).toHaveAttribute('transform', /translate/)
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await expect(iris).not.toHaveAttribute('transform')

  // Reuse and disconnection must not retain listeners or a moving detached SVG.
  await page.evaluate(() => {
    const second = document.createElement('observa-eye')
    second.id = 'second-eye'
    document.querySelector('main').append(second)
    window.detachedEye = document.querySelector('.brand observa-eye')
    window.detachedEye.remove()
  })
  await page.mouse.move(1100, 700)
  await expect(page.locator('#second-eye [data-eye-iris]')).toHaveAttribute('transform', /translate/)
  assert.equal(await page.evaluate(() => window.detachedEye.querySelector('g').getAttribute('transform')), null)
  await page.evaluate(() => {
    document.querySelector('.brand').prepend(window.detachedEye)
    document.querySelector('#second-eye').remove()
    delete window.detachedEye
  })
  await page.mouse.move(1300, 750)
  await expect(iris).toHaveAttribute('transform', /translate/)

  await mkdir('.tools/brand-eye', {recursive:true})
  for (const theme of ['light','dark']) {
    await page.evaluate(value => document.documentElement.dataset.theme = value, theme)
    const colors = await eye.evaluate(element => ({
      ink:getComputedStyle(element).color,
      outline:getComputedStyle(element.querySelector('path')).stroke,
      pupil:getComputedStyle(element.querySelector('circle:last-child')).fill,
      brand:getComputedStyle(document.querySelector('.brand i')).backgroundColor
    }))
    assert.equal(colors.ink, colors.outline)
    assert.equal(colors.pupil, colors.brand)
    for (const width of [390,768,1024,1440,1920]) {
      await page.setViewportSize({width,height:900})
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      await page.locator('.masthead').screenshot({path:`.tools/brand-eye/${theme}-${width}.png`})
    }
  }
  const touch = await browser.newPage({isMobile:true,hasTouch:true,viewport:{width:390,height:844}})
  await touch.goto(url + '#metodologia')
  await touch.locator('observa-eye svg').waitFor()
  await touch.mouse.move(300,600)
  await touch.touchscreen.tap(200,600)
  await touch.waitForTimeout(150)
  assert.equal(await touch.locator('observa-eye g').getAttribute('transform'), null)
  const favicon = await page.request.get(url + 'mark.svg')
  assert.ok(favicon.ok())
  assert.ok((await favicon.text()).includes('cx="32" cy="32" r="4.5"'))
  assert.deepEqual(errors, [])
})
