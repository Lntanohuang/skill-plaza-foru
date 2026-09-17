#!/usr/bin/env node
/* 按需生成可读 Markdown trace：npm run trace:md -- <runId|sessionId|trace文件路径> */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import { TRACES_DIR, readIndex } from '../lib/traceExport.ts'

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
    // 按 zcodeSessionId 反查
    const hit = readIndex().find((r) => r.zcodeSessionId === arg || r.runId.includes(arg))
    if (hit?.files.trace && existsSync(hit.files.trace)) traceFile = hit.files.trace
    else {
      console.error(`找不到对应 trace：${arg}`)
      process.exit(1)
    }
  }
}

const trace = JSON.parse(readFileSync(traceFile, 'utf8'))
const s = trace.session

const short = (text: unknown, n = 600): string => {
  const t = String(text ?? '')
  return t.slice(0, n) + (t.length > n ? `\n…（共 ${t.length} 字符，截断）` : '')
}

const L: string[] = []
L.push(`# Trace：${s.title}`)
L.push('')
L.push(`- **会话**：\`${s.id}\``)
L.push(`- **沙箱**：\`${s.workspace}\``)
L.push(`- **时间**：${s.created?.slice(11, 19)} → ${s.updated?.slice(11, 19)}`)
L.push(`- **规模**：${trace.summary.messages} 条消息 · ${trace.summary.toolCalls.length} 次工具调用`)
L.push('')
L.push('## 工具调用时间线')
L.push('')
L.push('| # | 时间 | 工具 | 状态 |')
L.push('| --- | --- | --- | --- |')
trace.summary.toolCalls.forEach((t: any, i: number) => {
  L.push(`| ${i + 1} | ${t.started?.slice(11, 19) ?? '-'} | ${t.tool} | ${t.status} |`)
})
L.push('')
L.push('---')
L.push('')
L.push('## 完整事件流')

for (const m of trace.messages) {
  const ts = m.time?.slice(11, 19) ?? '-'
  const role = m.role ?? '?'
  for (const p of m.parts ?? []) {
    const type = p?.type
    if (type === 'text') {
      const body = String(p.text ?? '')
      if (!body.trim()) continue
      L.push(`### [${ts}] ${role} · 文本`)
      L.push('')
      L.push(short(body, 2500))
      L.push('')
    } else if (type === 'reasoning') {
      const body = String(p.text ?? '').trim()
      if (!body) continue
      L.push(`**[${ts}] 💭 思考（${role}）**`)
      L.push('')
      L.push('> ' + short(body, 500).replace(/\n/g, '\n> '))
      L.push('')
    } else if (type === 'tool') {
      const name = p.tool ?? '?'
      const st = p.state ?? {}
      L.push(`#### [${ts}] 🔧 ${name}（${st.status ?? '?'}）`)
      L.push('')
      if (st.input !== undefined && st.input !== null && st.input !== '') {
        L.push('**入参**')
        L.push('')
        L.push('```json')
        L.push(short(JSON.stringify(st.input), 400))
        L.push('```')
        L.push('')
      }
      if (st.output !== undefined && st.output !== null && st.output !== '') {
        L.push('**输出**')
        L.push('')
        L.push('```')
        L.push(short(st.output, 700))
        L.push('```')
        L.push('')
      }
    } else if (type === 'step-finish' && (p.cost || p.tokens)) {
      L.push(`*[${ts}] step 结束：${JSON.stringify({ cost: p.cost, tokens: p.tokens })}*`)
      L.push('')
    }
  }
}

const outFile = join(TRACES_DIR, basename(traceFile).replace(/\.json$/, '.md'))
writeFileSync(outFile, L.join('\n'))
console.log(`已生成：${outFile}`)
