// GHSA-gcqx-w48m-w2h4 has no patched upstream deepmerge release. Workbox's
// Rollup resolver still needs it. Block prototype keys in BOTH copy loops;
// checking source keys alone leaves the target-copy attack intact.
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const entry = require.resolve('deepmerge')
const root = dirname(dirname(entry))
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
if (version !== '4.3.1') throw new Error('Review the deepmerge security patch before changing its pinned version')
const marker = '// OzempicAI: reject prototype keys (GHSA-gcqx-w48m-w2h4).'
for (const file of ['dist/cjs.js', 'dist/umd.js', 'index.js']) {
  const path = join(root, file)
  const source = readFileSync(path, 'utf8')
  if (source.includes(marker)) continue
  let loops = 0
  const patched = source.replace(/getKeys\((target|source)\)\.forEach\(function\(key\) \{/g, match => {
    loops++
    return `${match}\n${marker}\nif (key === '__proto__' || key === 'constructor' || key === 'prototype') return;`
  })
  // Fail closed on upstream layout changes rather than silently losing the fix.
  if (loops !== 2) throw new Error(`Unexpected deepmerge layout in ${file}; security patch was not applied`)
  writeFileSync(path, patched)
}
