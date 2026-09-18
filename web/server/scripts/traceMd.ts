#!/usr/bin/env node
/* 按需生成可读 Markdown trace：npm run trace:md -- <runId|sessionId|trace文件路径> */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import { TRACES_DIR, readIndex } from '../lib/traceExport.ts'
import { renderTraceMd } from '../lib/traceMd.ts'

const arg = process.argv[2]
if (!arg) {
  console.error('用法：npm run trace:md -- <runId | zcodeSessionId | trace文件路径>')
  process.exit(1)
}

let traceFile = arg
if (!existsSync(traceFile)) {
  if (existsSync(join(TRACES_DIR, `${arg}.json`))) {
    traceFile = join(TRACES_DIR, `${arg}.json`)
  } else {
    const hit = readIndex().find((r) => r.engineSessionId === arg || r.runId.includes(arg))
    if (hit?.files.trace && existsSync(hit.files.trace)) traceFile = hit.files.trace
    else {
      console.error(`找不到对应 trace：${arg}`)
      process.exit(1)
    }
  }
}

const trace = JSON.parse(readFileSync(traceFile, 'utf8'))
const outFile = join(TRACES_DIR, basename(traceFile).replace(/\.json$/, '.md'))
writeFileSync(outFile, renderTraceMd(trace))
console.log(`已生成：${outFile}`)
