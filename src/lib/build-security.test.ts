import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { test } from 'node:test'

const require = createRequire(import.meta.url)
const merge = require('deepmerge')

test('the installed build dependency cannot poison merged objects from target or source keys', () => {
  const payload = JSON.parse('{"__proto__":{"poisoned":true},"constructor":{"prototype":{"poisoned":true}}}')
  for (const [target, source] of [[payload, {}], [{}, payload], [{ nested: payload }, {}], [{}, { nested: payload }]]) {
    const result = merge(target, source)
    assert.equal(result.poisoned, undefined)
    assert.equal(result.nested?.poisoned, undefined)
    assert.equal(Object.getPrototypeOf(result), Object.prototype)
    if (result.nested) assert.equal(Object.getPrototypeOf(result.nested), Object.prototype)
    assert.equal(Object.prototype.hasOwnProperty.call(result, '__proto__'), false)
  }
  assert.equal(({} as { poisoned?: boolean }).poisoned, undefined)
  assert.deepEqual(merge.all([{ options: { extensions: ['.js'] } }, { options: { extensions: ['.ts'] } }]), { options: { extensions: ['.js', '.ts'] } })
})
