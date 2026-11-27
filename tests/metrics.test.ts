import {test} from 'node:test'
import assert from 'node:assert/strict'
import {quotaAlert} from '../packages/scout/metrics.ts'
test('alertas usam os três limites e recusam orçamento inválido',()=>{
 assert.equal(quotaAlert(69,100).level,'normal');assert.equal(quotaAlert(70,100).level,'warning')
 assert.equal(quotaAlert(85,100).level,'high');assert.equal(quotaAlert(95,100).level,'critical')
 assert.throws(()=>quotaAlert(0,0));assert.throws(()=>quotaAlert(1,2,[95,85,70]))
})
