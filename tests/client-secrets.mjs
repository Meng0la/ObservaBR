import {readdir, readFile} from 'node:fs/promises'
import {join} from 'node:path'
import assert from 'node:assert/strict'

// Supply the same synthetic canary to the build and to this check.
const needle = process.env.BUILD_SECRET_CANARY
assert.ok(needle && needle.length >= 24, 'Defina a sentinela de build com pelo menos 24 caracteres')
const root = process.argv[2] ?? 'apps/web/dist'
let inspected = 0
async function inspect(dir) {
  for (const entry of await readdir(dir, {withFileTypes:true})) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) await inspect(path)
    else if (entry.isFile()) {
      assert.ok(!(await readFile(path)).includes(needle), 'Segredo de teste exposto em '+path)
      inspected++
    }
  }
}
await inspect(root)
assert.ok(inspected > 0, 'Build vazio')
console.log('Sentinela ausente nos '+inspected+' arquivos publicados.')
