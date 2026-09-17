/* 可读 Markdown trace 渲染：server 的 /api/runs/:id/file/md 与 scripts/traceMd.ts 共用 */

import type { SessionTrace } from './traceExport.ts'

function short(text: unknown, n = 600): string {
  const t = String(text ?? '')
  return t.slice(0, n) + (t.length > n ? `\n…（共 ${t.length} 字符，截断）` : '')
}

export function renderTraceMd(trace: SessionTrace): string {
  const s = trace.session
  const L: string[] = []
  L.push(`# Trace：${s.title}`)
  L.push('')
  L.push(`- **会话**：\`${s.id}\``)
  L.push(`- **沙箱**：\`${s.workspace}\``)
  L.push(`- **时间**：${s.created?.slice(0, 19)} → ${s.updated?.slice(0, 19)}`)
  L.push(`- **规模**：${trace.summary.messages} 条消息 · ${trace.summary.toolCalls.length} 次工具调用`)
  L.push('')
  L.push('## 工具调用时间线')
  L.push('')
  L.push('| # | 时间 | 工具 | 状态 |')
  L.push('| --- | --- | --- | --- |')
  trace.summary.toolCalls.forEach((t, i) => {
    L.push(`| ${i + 1} | ${t.started?.slice(11, 19) ?? '-'} | ${t.tool} | ${t.status} |`)
  })
  L.push('')
  L.push('---')
  L.push('')
  L.push('## 完整事件流')

  for (const m of trace.messages) {
    const ts = m.time?.slice(11, 19) ?? '-'
    const role = m.role ?? '?'
    for (const p of (m.parts ?? []) as Array<Record<string, any>>) {
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
        const st = p.state ?? {}
        L.push(`#### [${ts}] 🔧 ${p.tool ?? '?'}（${st.status ?? '?'}）`)
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
  return L.join('\n') + '\n'
}
