import { spawn } from 'node:child_process'
const child = spawn('node', ['/Applications/ZCode.app/Contents/Resources/glm/zcode.cjs', 'app-server', '--cwd', '/tmp/zcode-sample'], { stdio: ['pipe','pipe','inherit'] })
let buf = ''
let sessionId = null
const send = o => (child.stdin.write(JSON.stringify(o)+'\n'), console.log('>>', JSON.stringify(o).slice(0,180)))
child.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0,i).trim(); buf = buf.slice(i+1); if (line) handle(JSON.parse(line)) } })
function handle(msg) {
  if (msg.method === 'session/event') { console.log('EV', JSON.stringify(msg.params).slice(0,300)); return }
  if (msg.id !== undefined && msg.method) {
    console.log('<< SRV-REQ', msg.method, JSON.stringify(msg.params).slice(0,160))
    if (msg.method === 'session/requestRuntimePreferences') send({ id: msg.id, result: { nativeSearchEnhancementsEnabled: false } })
    else send({ id: msg.id, result: { headers: {} } })
    return
  }
  if (msg.id === 1) { console.log('<< id=1 FULL:', JSON.stringify(msg.result).slice(0, 600)); sessionId = msg.result?.session?.sessionId }
  else console.log('<< id=%s %s', msg.id, JSON.stringify(msg).slice(0,300))
  if (msg.id === 1 && sessionId && sessionId !== 'unknown') {
    setTimeout(() => send({ id: 2, method: 'session/subscribe', params: { sessionId, deliveryKind: 'web-remote-replayable' } }), 200)
    setTimeout(() => send({ id: 3, method: 'session/send', params: { sessionId, content: '用一句话说明 1+1 等于几' } }), 700)
  }
}
send({ id: 1, method: 'session/create', params: { workspace: { workspacePath: '/tmp/zcode-sample', workspaceKey: '/tmp/zcode-sample' } } })
setTimeout(() => { console.log('PROBE_DONE'); child.kill(); process.exit(0) }, 60000)
