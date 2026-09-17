#!/usr/bin/env node
/* 清理旧 trace：npm run traces:prune -- --keep 200（保留最近 N 次运行，删除其文件） */

import { rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { TRACES_DIR, readIndex } from '../lib/traceExport.ts'

const keepArg = process.argv.includes('--keep') ? Number(process.argv[process.argv.indexOf('--keep') + 1]) : NaN
const keep = Number.isFinite(keepArg) && keepArg > 0 ? keepArg : 100

const runs = readIndex()
if (runs.length <= keep) {
  console.log(`当前 ${runs.length} 次运行，未超过保留上限 ${keep}，无需清理。`)
  process.exit(0)
}

const drop = runs.slice(0, runs.length - keep)
const keepRuns = runs.slice(runs.length - keep)

for (const r of drop) {
  for (const file of [r.files.events, r.files.trace]) {
    if (file) {
      try { rmSync(file) } catch { /* 已不存在则忽略 */ }
    }
  }
}
writeFileSync(join(TRACES_DIR, 'index.jsonl'), keepRuns.map((r) => JSON.stringify(r)).join('\n') + '\n')
console.log(`已删除 ${drop.length} 次旧运行的文件，保留最近 ${keep} 次。`)
