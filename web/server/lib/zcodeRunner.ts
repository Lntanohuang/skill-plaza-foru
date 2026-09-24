/* ============================================================
   ZcodeRunner：zcode app-server 桥（继承 AgentRunner）
   ------------------------------------------------------------
   一个全局共享的常驻子进程，NDJSON 协议：
   session/create(yolo) → session/subscribe → session/send。
   需应答两类服务端反向请求（15s 超时）；session/event 通知
   按字段特征归一成 RunnerEvent（payload 多数没有 kind 字段，
   详见 samples/PROTOCOL.md）。
   ============================================================ */

import { AgentRunner, JsonlChannel, type EngineName } from './runner.ts'
import type { AgentEnvInfo } from './traceExport.ts'
import type { ZcodeCli } from './zcodeCli.ts'
import { zcodeCliVersion } from './agentEnv.ts'
import { exportSessionTrace } from './traceExport.ts'
import { SKILL_PROMPTS, INSTALLED_SKILLS } from './skills.ts'

export class ZcodeRunner extends AgentRunner {
  readonly name: EngineName = 'zcode'
  readonly cli: ZcodeCli
  private shared: JsonlChannel | null = null

  constructor(cli: ZcodeCli) {
    super()
    this.cli = cli
  }

  describe(): string {
    return 'glm-5.3 (GLM Coding Plan)'
  }

  /** 运行环境快照：zcode 侧模型为服务端标识串，无思考档位与花费数据 */
  envInfo(): Partial<AgentEnvInfo> {
    return { model: this.describe(), agentVersion: zcodeCliVersion(this.cli) }
  }

  /* 全部会话共享一个 app-server 进程（缓存友好） */
  protected channelFor(): JsonlChannel {
    if (this.shared && !this.shared.exited) return this.shared
    /* .cjs 等脚本用当前 node 运行；独立可执行文件直接 spawn；Windows .cmd 等需 shell */
    const command = this.cli.mode === 'node' ? process.execPath : this.cli.path
    const args = this.cli.mode === 'node' ? [this.cli.path, 'app-server'] : ['app-server']
    const ch = new JsonlChannel(command, args, this.cli.mode === 'shell' ? { shell: true } : {})
    this.shared = ch
    this.wireChannel(ch)
    return ch
  }

  protected routeMessage(ch: JsonlChannel, msg: any) {
    // 服务端反向请求：必须应答，否则 15s 超时（实测两类，其余空对象兜底）
    if (msg.id !== undefined && msg.method) {
      this.tapOf(msg.params?.sessionId)?.('in', msg)
      let result: any = {}
      if (msg.method === 'session/requestRuntimePreferences')
        result = { nativeSearchEnhancementsEnabled: false }
      else if (msg.method === 'interaction/requestOfficialMcpAuthHeaders') result = { headers: {} }
      ch.write({ id: msg.id, result })
      return
    }
    if (msg.method === 'session/event') {
      const sid = msg.params?.sessionId
      this.tapOf(sid)?.('in', msg)
      const p = msg.params?.payload
      if (p?.kind === 'text_delta') {
        if (p.delta) this.emit(sid, { kind: 'text_delta', delta: p.delta })
      } else if (p?.error) {
        // 会话级错误（如模型未配置）：必须上抛，否则前端只会看到心跳直到超时
        this.emit(sid, {
          kind: 'error',
          message: `zcode 会话错误：${p.error.message || p.error.type || '未知错误'}`,
        })
      } else if (p?.response !== undefined && p?.resultType !== undefined) {
        // 终止事件：{response, resultType, tokenCount, usage, ...}
        this.emit(sid, {
          kind: 'terminal',
          response: String(p.response ?? ''),
          resultType: p.resultType,
          usage: p.usage,
        })
      } else if (p?.usage && p?.stopReason !== undefined) {
        this.emit(sid, { kind: 'usage', usage: p.usage, content: p.content })
      }
    }
  }

  private zrequest(method: string, params: any): Promise<any> {
    const sid =
      params && typeof params.sessionId === 'string' ? params.sessionId : undefined
    return this.request({ method, params }, sid)
  }

  async createSession(workspaceDir: string): Promise<string> {
    const result = await this.zrequest('session/create', {
      workspace: { workspacePath: workspaceDir, workspaceKey: workspaceDir },
      // 无头会话没有人工批准环节：yolo 让写文件/建目录在沙箱内直接放行
      mode: 'yolo',
    })
    const sid = result?.session?.sessionId
    if (!sid) throw new Error('session/create 未返回 sessionId')
    await this.zrequest('session/subscribe', {
      sessionId: sid,
      deliveryKind: 'web-remote-replayable',
    })
    return sid
  }

  send(sessionId: string, content: string): Promise<void> {
    return this.zrequest('session/send', { sessionId, content })
  }

  stop(sessionId: string) {
    this.zrequest('session/stop', { sessionId }).catch(() => {})
  }

  async exportTrace(sessionId: string, outFile: string) {
    return exportSessionTrace(sessionId, outFile)
  }

  buildPrompt(skill: string, messages: any[], isFirstTurn: boolean): string {
    // 复用 zcode 会话时历史天然保留，只发最新一条；技能指令仅在新会话首条注入
    const latest = messages[messages.length - 1]
    if (!isFirstTurn) return latest.content
    if (INSTALLED_SKILLS.has(skill)) {
      return (
        `请先用 Skill 工具加载 ${skill} 技能，然后严格按该技能的方法与输出契约执行以下任务；` +
        `技能自带的方法文档、参考资料与脚本优先于你的一般经验。\n\n${latest.content}`
      )
    }
    return `${SKILL_PROMPTS[skill]}\n\n${latest.content}`
  }
}
