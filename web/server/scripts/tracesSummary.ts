#!/usr/bin/env node
/* 聚合运行索引：npm run traces:summary —— 按 skill 统计成功率/时长/token/缓存命中 */

import { readIndex } from '../lib/traceExport.ts'

const runs = readIndex()
if (runs.length === 0) {
  console.log('index.jsonl 为空：还没有已记录的运行。')
  process.exit(0)
}

const pct = (nums: number[], p: number): number => {
  if (nums.length === 0) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]
}
const k = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)))

const bySkill = new Map<string, typeof runs>()
for (const r of runs) {
  const list = bySkill.get(r.skill) ?? []
  list.push(r)
  bySkill.set(r.skill, list)
}

const totalUsage = runs.reduce(
  (acc, r) => {
    const u = r.usage ?? {}
    acc.input += u.inputTokens ?? 0
    acc.output += u.outputTokens ?? 0
    acc.cacheRead += u.cacheReadTokens ?? 0
    return acc
  },
  { input: 0, output: 0, cacheRead: 0 },
)

console.log(`共 ${runs.length} 次运行（${new Date(runs[0].ts).toLocaleString()} 起）\n`)
console.log('| skill | 运行 | 成功 | 超时 | 中断 | 错误 | 时长p50 | 时长p95 | 输入tok | 输出tok | 缓存命中 | 工具调用 |')
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |')
for (const [skill, list] of bySkill) {
  const durations = list.map((r) => r.durationMs)
  const usageIn = list.reduce((a, r) => a + (r.usage?.inputTokens ?? 0), 0)
  const usageOut = list.reduce((a, r) => a + (r.usage?.outputTokens ?? 0), 0)
  const usageCache = list.reduce((a, r) => a + (r.usage?.cacheReadTokens ?? 0), 0)
  const cacheRate = usageIn > 0 ? Math.round((usageCache / usageIn) * 100) + '%' : '-'
  const tools = list.reduce((a, r) => a + (r.toolCallCount ?? 0), 0)
  const count = (o: string) => list.filter((r) => r.outcome === o).length
  console.log(
    `| ${skill} | ${list.length} | ${count('success')} | ${count('timeout')} | ${count('aborted')} | ${count('error')}` +
      ` | ${Math.round(pct(durations, 50) / 1000)}s | ${Math.round(pct(durations, 95) / 1000)}s` +
      ` | ${k(usageIn)} | ${k(usageOut)} | ${cacheRate} | ${tools} |`,
  )
}
console.log('')
console.log(
  `合计 token：输入 ${k(totalUsage.input)} · 输出 ${k(totalUsage.output)} · 缓存命中 ${k(totalUsage.cacheRead)}` +
    `（命中率 ${totalUsage.input > 0 ? Math.round((totalUsage.cacheRead / totalUsage.input) * 100) : 0}%）`,
)
