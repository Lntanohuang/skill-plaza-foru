#!/usr/bin/env node
/* 补导历史运行：npm run trace:backfill —— 扫 zcode 会话库中本项目沙箱会话，导出未入索引的 */

import { appendIndex, exportSessionTrace, listWorkspaceSessions, readIndex, traceFilePath } from '../lib/traceExport.ts'

const known = new Set(
  readIndex().filter((r) => r.engine !== 'pi').map((r) => r.engineSessionId).filter(Boolean),
)
const sessions = await listWorkspaceSessions()
const missing = sessions.filter((s) => !known.has(s.id))

if (missing.length === 0) {
  console.log(`会话库共 ${sessions.length} 个沙箱会话，索引已全覆盖，无需补导。`)
  process.exit(0)
}

console.log(`发现 ${missing.length} 个未入索引的历史会话，开始补导…`)
for (const s of missing) {
  const runId = `backfill-${s.id}`
  const traceFile = traceFilePath(runId, 'trace')
  const result = await exportSessionTrace(s.id, traceFile)
  if (!result) {
    console.log(`  跳过 ${s.id}（${s.title}）：导出失败`)
    continue
  }
  appendIndex({
    runId,
    ts: new Date(s.time_created).toISOString(),
    clientSessionId: 'historical',
    engine: 'zcode',
    engineSessionId: s.id,
    skill: 'unknown',
    promptDigest: s.title.slice(0, 80),
    outcome: 'historical',
    durationMs: s.time_updated - s.time_created,
    toolCallCount: result.toolCallCount,
    files: { trace: traceFile },
  })
  console.log(`  已补导 ${s.id}（${s.title}，${result.toolCallCount} 次工具调用）`)
}
console.log('补导完成。历史运行的 skill 字段为 unknown，可用 trace:md 查看内容后修正。')
