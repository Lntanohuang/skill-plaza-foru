#!/usr/bin/env node
/* pi RPC usage 字段探针：打印 message_update / message_end 的原始 usage JSON */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const cwd = mkdtempSync(join(tmpdir(), 'pi-usage-'))
const proc = spawn('pi', ['--mode', 'rpc', '--model', 'deepseek/deepseek-v4-pro', '--no-session', '--no-extensions'], { cwd, stdio: ['pipe', 'pipe', 'inherit'] })
let buf = ''
let n = 0
proc.stdout.on('data', (d) => {
  buf += d
  let i
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim()
    buf = buf.slice(i + 1)
    if (!line) continue
    let m
    try { m = JSON.parse(line) } catch { continue }
    if (m.type === 'message_update' && m.usage) {
      const ev = m.assistantMessageEvent?.type
      if (ev === 'text_end' || ev === 'toolcall_end' || ev === 'toolcall_start')
        console.log(`[update:${ev}]`, JSON.stringify(m.usage))
    } else if (m.type === 'message_end') {
      console.log('[end]    ', JSON.stringify(m.message?.usage))
    } else if (m.type === 'agent_settled') {
      console.log('[settled]')
      proc.kill()
      process.exit(0)
    }
  }
})
proc.stdin.write(JSON.stringify({ id: 1, type: 'prompt', message: '用 bash 工具执行 echo hi，然后回答 ok' }) + '\n')
setTimeout(() => { proc.kill(); process.exit(1) }, 120_000)
