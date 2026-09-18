#!/usr/bin/env node
/* pi --mode rpc 最小探测客户端：prompt（含写文件任务）→ 打印事件流 → 终态统计。
   实跑前需 DeepSeek 凭据（如 ~/.zshrc 的 DEEPSEEK_API_KEY）。
   用法：node samples/pi-probe.mjs ["自定义 prompt"] */
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const prompt =
  process.argv[2] ||
  '请在当前目录创建 hello.txt，内容为 "pi-rpc-ok"，然后读回来确认内容一致，最后简要汇报。'
const cwd = mkdtempSync(join(tmpdir(), 'pi-probe-ws-'))
const sessionDir = mkdtempSync(join(tmpdir(), 'pi-probe-sessions-'))

const proc = spawn(
  'pi',
  [
    '--mode', 'rpc',
    '--provider', 'deepseek',
    '--model', 'deepseek-v4-pro',
    '--session-dir', sessionDir,
    '-n', 'pi-probe',
  ],
  { cwd, stdio: ['pipe', 'pipe', 'inherit'] },
)

/* 严格按 \n 分帧（不用 readline：它会在 U+2028/U+2029 处错误分行，见 rpc.md） */
let buf = ''
let nextId = 1
const pending = new Map()
const events = []

function send(cmd) {
  const id = 'req-' + nextId++
  proc.stdin.write(JSON.stringify({ id, ...cmd }) + '\n')
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject, command: cmd.type }))
}

let settled = false
proc.stdout.on('data', (d) => {
  buf += d.toString('utf8')
  let i
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim()
    buf = buf.slice(i + 1)
    if (!line) continue
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      console.log('[非JSON行]', line.slice(0, 200))
      continue
    }
    events.push(msg)
    if (msg.type === 'response') {
      const p = pending.get(msg.id)
      if (p) {
        pending.delete(msg.id)
        if (msg.success) p.resolve(msg)
        else p.reject(new Error(msg.error || `${msg.command} 失败`))
      }
      console.log('[response]', msg.command, msg.success, msg.error || '')
    } else if (msg.type === 'message_update') {
      const ev = msg.assistantMessageEvent
      if (ev?.type === 'text_delta') process.stdout.write(ev.delta)
      else if (ev?.type === 'toolcall_start')
        console.log(`\n[toolcall] ${ev.toolName}`)
      if (msg.usage && msg.usage.totalTokens)
        console.log(`  [usage] in=${msg.usage.input} out=${msg.usage.output} cacheRead=${msg.usage.cacheRead}`)
    } else if (msg.type === 'agent_start' || msg.type === 'agent_end' || msg.type === 'agent_settled') {
      console.log(`\n[${msg.type}]${msg.willRetry ? ' willRetry' : ''}`)
      if (msg.type === 'agent_settled') settled = true
    } else if (msg.type === 'tool_execution_start') {
      console.log(`  [tool] ${msg.toolName} ${JSON.stringify(msg.args).slice(0, 120)}`)
    } else if (msg.type === 'tool_execution_end') {
      console.log(`  [tool end] isError=${msg.isError}`)
    } else if (msg.type === 'extension_ui_request') {
      /* 对话框不回复会超时自动取消；这里主动回 cancelled 让流程立刻继续 */
      if (['select', 'confirm', 'input', 'editor'].includes(msg.method)) {
        proc.stdin.write(
          JSON.stringify({ type: 'extension_ui_response', id: msg.id, cancelled: true }) + '\n',
        )
      }
    } else {
      console.log(`[${msg.type}]`)
    }
  }
})

const fail = (t) => setTimeout(() => {
  console.error(`[超时 ${t / 1000}s] settled=${settled}`)
  proc.kill('SIGKILL')
  process.exit(1)
}, t)
fail.clear = () => clearTimeout(fail)
const guard = fail(180_000)

try {
  const cmds = await send({ type: 'get_commands' })
  console.log('[commands]', JSON.stringify(cmds.data.commands.map((c) => `${c.source}:${c.name}`)))
  await send({ type: 'prompt', message: prompt })
  await new Promise((resolve, reject) => {
    const iv = setInterval(() => {
      if (settled) { clearInterval(iv); resolve() }
    }, 200)
    proc.once('exit', () => { clearInterval(iv); reject(new Error('pi 进程提前退出')) })
  })
  const stats = await send({ type: 'get_session_stats' })
  console.log('[stats]', JSON.stringify(stats.data))
  const last = await send({ type: 'get_last_assistant_text' })
  console.log('[last]', String(last.data.text).slice(0, 160))
} catch (exc) {
  console.error('[失败]', exc.message)
}

clearTimeout(guard)
const hello = join(cwd, 'hello.txt')
console.log('[hello.txt]', existsSync(hello) ? readFileSync(hello, 'utf8').trim() : '未创建！')
writeFileSync(
  new URL('./pi-rpc-events-sample.jsonl', import.meta.url),
  events.map((m) => JSON.stringify(m)).join('\n') + '\n',
)
console.log(`[样例已存] ${events.length} 条；workspace=${cwd}`)
proc.kill()
