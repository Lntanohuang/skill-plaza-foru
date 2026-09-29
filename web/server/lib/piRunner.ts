/* ============================================================
   PiRunner：pi --mode rpc 桥（继承 AgentRunner，针对性修改）
   ------------------------------------------------------------
   与 zcode 不同：pi RPC 是单会话协议，因此【每个引擎会话一个
   常驻子进程】，cwd 即沙箱 workspace；模型经 --model provider/id
   钉死（默认 DeepSeek）。命令/事件协议见 docs/pi-runner.md 与
   samples/pi-rpc-events-sample.jsonl（照真实输出写的解析）。
   会话进程空闲回收（PI_IDLE_MS），进程内天然保留多轮上下文。
   ============================================================ */

import { randomUUID } from 'node:crypto'
import { accessSync, constants, writeFileSync } from 'node:fs'
import { join, delimiter } from 'node:path'
import { AgentRunner, JsonlChannel, type EngineName } from './runner.ts'
import type {
  AgentEnvInfo,
  ModelContextInfo,
  SessionTrace,
  TraceExportOptions,
  UsageRound,
  UsageSummary,
} from './traceExport.ts'
import { tokenUsageFrom } from './traceExport.ts'
import { piCliVersion } from './agentEnv.ts'
import { CAREER_GUIDANCE_FILE_PROTOCOL, SKILL_PROMPTS, INSTALLED_SKILLS, SIDECAR_SKILLS, skillDir } from './skills.ts'
import { sidecarInstruction } from './reportMeta.ts'
import { loadLocalEnv } from './env.ts'

/* pi CLI 定位：PI_CLI 配置 → PATH；找不到由调用方给配置指引 */
export function resolvePiCli(): string | null {
  loadLocalEnv()
  const fromEnv = process.env.PI_CLI?.trim()
  if (fromEnv) return fromEnv
  const names =
    process.platform === 'win32' ? ['pi.cmd', 'pi.exe', 'pi'] : ['pi']
  for (const dir of (process.env.PATH || '').split(delimiter)) {
    if (!dir) continue
    for (const name of names) {
      const p = join(dir, name)
      try {
        accessSync(p, constants.X_OK)
        return p
      } catch {
        /* 继续扫描 */
      }
    }
  }
  return null
}

/** PI_MODEL（格式 provider/model），默认 DeepSeek Flash（便宜快速，MVP 演示够用） */
export function piModelRef(): { provider: string; modelId: string } {
  loadLocalEnv()
  const raw = process.env.PI_MODEL?.trim() || 'deepseek/deepseek-flash'
  const i = raw.indexOf('/')
  if (i <= 0 || i >= raw.length - 1) {
    console.warn(`忽略非法 PI_MODEL（需 provider/model 格式）：${raw}，使用默认 deepseek/deepseek-flash`)
    return { provider: 'deepseek', modelId: 'deepseek-flash' }
  }
  return { provider: raw.slice(0, i), modelId: raw.slice(i + 1) }
}

/** PI_THINKING 思考档位（off..max），默认 low：降 token 大头（长推理），要质量可调 high */
export function piThinkingLevel(): string {
  loadLocalEnv()
  const allowed = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']
  const raw = process.env.PI_THINKING?.trim().toLowerCase() || 'low'
  if (!allowed.includes(raw)) {
    console.warn(`忽略非法 PI_THINKING=${raw}（可选 ${allowed.join('/')}），使用默认 low`)
    return 'low'
  }
  return raw
}

/* pi usage → 统一 UsageSummary（cost.total 为该次调用的美元花费） */
function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function normUsage(u: any): UsageSummary | undefined {
  if (!u) return undefined
  const inputTokens = numberOrUndefined(u.input ?? u.inputTokens)
  const outputTokens = numberOrUndefined(u.output ?? u.outputTokens)
  const cacheReadTokens = numberOrUndefined(u.cacheRead ?? u.cacheReadTokens)
  const reportedTotal = numberOrUndefined(u.totalTokens ?? u.total)
  const totalTokens =
    reportedTotal ??
    (inputTokens !== undefined || outputTokens !== undefined || cacheReadTokens !== undefined
      ? (inputTokens ?? 0) + (outputTokens ?? 0) + (cacheReadTokens ?? 0)
      : undefined)
  const cost = u.cost?.total
  return {
    inputTokens,
    outputTokens,
    cacheReadTokens,
    totalTokens,
    costUsd: typeof cost === 'number' ? cost : undefined,
  }
}

/** 两段已归一化的 usage 相加（缺省按 0；cost 双方都缺省时保持缺省），不落账 */
function sumUsage(prev?: UsageSummary, add?: UsageSummary): UsageSummary {
  const a = add ?? {}
  const base = prev ?? {}
  const noCost = base.costUsd === undefined && a.costUsd === undefined
  return {
    inputTokens: (base.inputTokens ?? 0) + (a.inputTokens ?? 0),
    outputTokens: (base.outputTokens ?? 0) + (a.outputTokens ?? 0),
    cacheReadTokens: (base.cacheReadTokens ?? 0) + (a.cacheReadTokens ?? 0),
    totalTokens: (base.totalTokens ?? 0) + (a.totalTokens ?? 0),
    costUsd: noCost ? undefined : (base.costUsd ?? 0) + (a.costUsd ?? 0),
  }
}

const PI_IDLE_MS = Number(process.env.PI_IDLE_MS || 30 * 60_000)

interface PiSession {
  channel: JsonlChannel
  workspaceDir: string
  lastUsed: number
  /** pi 自己的会话标识（get_state 返回，trace 导出用） */
  piSessionId?: string
  /** 从 pi model 配置 / get_session_stats 得到的上下文元数据。 */
  modelInfo: ModelContextInfo
}

export class PiRunner extends AgentRunner {
  readonly name: EngineName = 'pi'
  private sessions = new Map<string, PiSession>()
  private sweeper: ReturnType<typeof setInterval> | null = null
  /** 引擎会话 id → 本轮累计 usage（agent_start 重置） */
  private turnUsage = new Map<string, UsageSummary>()
  /** 引擎会话 id → 本轮每次实际模型请求的 usage。 */
  private turnRounds = new Map<string, UsageRound[]>()
  private turnRoundNo = new Map<string, number>()
  /** 当前 LLM 调用最近一次流式 usage（message_end 全零时的回落值，DeepSeek 实测如此） */
  private callUsage = new Map<string, UsageSummary>()
  /** 引擎会话 id → 思考进度（累计字数 + 上次上报时间，agent_start 重置） */
  private thinkState = new Map<string, { chars: number; at: number }>()

  private readonly model: { provider: string; modelId: string }
  private readonly cli: string | null
  private readonly thinking: string

  modelInfo(): ModelContextInfo {
    return {
      model: this.model.modelId,
      provider: this.model.provider,
      contextWindowTokens: null,
      contextWindowSource: 'provider_metadata_unavailable',
    }
  }

  constructor(model?: { provider: string; modelId: string }, cli?: string | null) {
    super()
    this.model = model ?? piModelRef()
    this.cli = cli === undefined ? resolvePiCli() : cli
    this.thinking = piThinkingLevel()
  }

  describe(): string {
    const known: Record<string, string> = { deepseek: 'DeepSeek', openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google' }
    const p = known[this.model.provider] ?? this.model.provider
    return `${this.model.modelId} (${p} · pi)`
  }

  private updateModelInfo(sid: string, patch: ModelContextInfo) {
    const session = this.sessions.get(sid)
    if (!session) return
    const contextWindowTokens =
      typeof patch.contextWindowTokens === 'number' && Number.isFinite(patch.contextWindowTokens) && patch.contextWindowTokens > 0
        ? patch.contextWindowTokens
        : session.modelInfo.contextWindowTokens
    session.modelInfo = {
      ...session.modelInfo,
      ...patch,
      model: patch.model ?? session.modelInfo.model ?? this.model.modelId,
      provider: patch.provider ?? session.modelInfo.provider ?? this.model.provider,
      contextWindowTokens,
      contextWindowSource:
        contextWindowTokens !== null && contextWindowTokens !== undefined
          ? patch.contextWindowSource ?? session.modelInfo.contextWindowSource ?? 'model_config'
          : patch.contextWindowSource ?? session.modelInfo.contextWindowSource ?? 'provider_metadata_unavailable',
    }
  }

  modelInfoForSession(sessionId: string): ModelContextInfo {
    return this.modelInfoOf(sessionId)
  }

  private modelInfoOf(sid: string): ModelContextInfo {
    return this.sessions.get(sid)?.modelInfo ?? this.modelInfo()
  }

  private modelInfoFromState(state: any): ModelContextInfo {
    const model = state?.model
    const contextWindowTokens = numberOrUndefined(model?.contextWindow)
    return {
      model: typeof model?.id === 'string' ? model.id : this.model.modelId,
      provider: typeof model?.provider === 'string' ? model.provider : this.model.provider,
      contextWindowTokens: contextWindowTokens ?? null,
      contextWindowSource: contextWindowTokens !== undefined ? 'model_config' : 'provider_metadata_unavailable',
    }
  }

  /** 运行环境快照：模型引用/思考档位/CLI 版本（run 记录落盘用） */
  envInfo(): Partial<AgentEnvInfo> {
    return {
      model: `${this.model.provider}/${this.model.modelId}`,
      thinking: this.thinking,
      agentVersion: piCliVersion(this.cli),
    }
  }

  /* 每会话一个 RPC 进程；不存在或已退出即视为坏会话（不隐式重启，
     避免静默丢失上下文） */
  protected channelFor(sessionId: string): JsonlChannel {
    const s = this.sessions.get(sessionId)
    if (!s) throw new Error('pi 会话不存在，请开启新会话重试。')
    if (s.channel.exited) throw new Error('pi 会话进程已退出，请开启新会话重试。')
    s.lastUsed = Date.now()
    return s.channel
  }

  private sidOf(channel: JsonlChannel): string | undefined {
    for (const [sid, s] of this.sessions) if (s.channel === channel) return sid
    return undefined
  }

  protected routeMessage(channel: JsonlChannel, msg: any) {
    const sid = this.sidOf(channel)
    if (!sid) return
    /* 全部事件留痕（zcode 侧通知同样落 events.jsonl，保持对齐） */
    this.tapOf(sid)?.('in', msg)
    const type = msg.type
    if (type === 'message_update') {
      const ev = msg.assistantMessageEvent
      if (ev?.type === 'text_delta' && ev.delta)
        this.emit(sid, { kind: 'text_delta', delta: ev.delta })
      else if (ev?.type === 'thinking_delta' && ev.delta) this.emitThinking(sid, ev.delta.length)
      else if (ev?.type === 'toolcall_start' && ev.toolName)
        this.emit(sid, { kind: 'status', phase: 'tool', tool: ev.toolName })
      else if (ev?.type === 'text_start') this.emit(sid, { kind: 'status', phase: 'text' })
      if (msg.usage) {
        /* usage 逐 delta 都会带（单次调用内的累计值），先记账最新值 */
        this.callUsage.set(sid, normUsage(msg.usage) ?? {})
        /* 只在块边界上报预览（本轮已入账 + 本次调用当前值），避免 SSE 刷屏 */
        if (ev?.type === 'text_end' || ev?.type === 'toolcall_end')
          this.emit(sid, {
            kind: 'usage',
            usage: sumUsage(this.turnUsage.get(sid), this.callUsage.get(sid)),
          })
      }
    } else if (type === 'message_end') {
      /* 每条 assistant 消息对应一次 LLM 调用：终值入账，累计成本轮总量；
         部分供应商（DeepSeek）message_end 不带细分，回落流式最后上报值 */
      const u = normUsage(msg.message?.usage)
      const hasBreakdown = (x?: UsageSummary) =>
        Boolean(x && (x.inputTokens !== undefined || x.outputTokens !== undefined || x.cacheReadTokens !== undefined))
      const final = hasBreakdown(u) ? u : this.callUsage.get(sid)
      this.callUsage.delete(sid)
      if (final && hasBreakdown(final)) {
        const roundNo = (this.turnRoundNo.get(sid) ?? 0) + 1
        this.turnRoundNo.set(sid, roundNo)
        const messageModel = typeof msg.message?.model === 'string' ? msg.message.model : undefined
        const messageProvider = typeof msg.message?.provider === 'string' ? msg.message.provider : undefined
        const context = this.modelInfoOf(sid)
        const round: UsageRound = {
          round: roundNo,
          model: messageModel ?? context.model ?? null,
          provider: messageProvider ?? context.provider ?? null,
          inputTokens: final.inputTokens ?? null,
          outputTokens: final.outputTokens ?? null,
          cacheReadTokens: final.cacheReadTokens ?? null,
          totalTokens: final.totalTokens ?? null,
          contextTokens: null,
          contextWindowTokens: context.contextWindowTokens ?? null,
          contextWindowSource: context.contextWindowSource ?? 'provider_metadata_unavailable',
        }
        const rounds = this.turnRounds.get(sid) ?? []
        rounds.push(round)
        this.turnRounds.set(sid, rounds)
        const total = sumUsage(this.turnUsage.get(sid), final)
        this.turnUsage.set(sid, total)
        this.emit(sid, { kind: 'usage', usage: total, round, context })
      }
    } else if (type === 'agent_start') {
      this.turnUsage.delete(sid)
      this.callUsage.delete(sid)
      this.updateModelInfo(sid, { peakContextTokens: null })
      this.turnRounds.delete(sid)
      this.turnRoundNo.delete(sid)
      this.thinkState.delete(sid)
    } else if (type === 'agent_settled') {
      /* 权威收尾：拉最终文本后发 terminal（失败经 error 收尾） */
      void this.finishTurn(sid)
    } else if (type === 'extension_ui_request') {
      /* 对话框（select/confirm/input/editor）不回复会等到超时，
         主动回 cancelled 让无头流程立刻继续；notify 类无需理会 */
      if (['select', 'confirm', 'input', 'editor'].includes(msg.method))
        channel.write({ type: 'extension_ui_response', id: msg.id, cancelled: true })
    } else if (type === 'auto_retry_end' && msg.success === false) {
      this.emit(sid, { kind: 'error', message: `pi 重试失败：${msg.finalError || '模型调用失败'}` })
    } else if (type === 'extension_error') {
      this.emit(sid, { kind: 'error', message: `pi 扩展错误：${msg.error}` })
    }
  }

  /** 思考期进度节流上报（≥700ms 一次，给前端"正在推进"的体感；
      正文/工具事件本身稀疏，不走这里） */
  private emitThinking(sid: string, add: number) {
    const now = Date.now()
    const st = this.thinkState.get(sid) ?? { chars: 0, at: 0 }
    st.chars += add
    if (now - st.at >= 700) {
      this.emit(sid, { kind: 'status', phase: 'thinking', chars: st.chars })
      st.at = now
    }
    this.thinkState.set(sid, st)
  }

  private async finishTurn(sid: string) {
    try {
      const [last, stats] = await Promise.all([
        this.request({ type: 'get_last_assistant_text' }, sid),
        this.request({ type: 'get_session_stats' }, sid).catch(() => null),
      ])
      const session = this.sessions.get(sid)
      const statsContextWindow = numberOrUndefined(stats?.contextUsage?.contextWindow)
      const statsPeak = numberOrUndefined(stats?.contextUsage?.tokens)
      if (statsContextWindow !== undefined || statsPeak !== undefined) {
        this.updateModelInfo(sid, {
          contextWindowTokens: statsContextWindow,
          contextWindowSource: statsContextWindow !== undefined ? 'provider_metadata' : undefined,
          peakContextTokens: statsPeak ?? null,
        })
      }
      const rounds = this.turnRounds.get(sid) ?? []
      if (statsPeak !== undefined && rounds.length) {
        /* get_session_stats.contextUsage 是 pi 对当前请求的真实上下文占用；
           归属于本轮最后一个请求，避免把累计 tokens 当作单轮上下文。 */
        rounds[rounds.length - 1] = { ...rounds[rounds.length - 1], contextTokens: statsPeak }
      }
      const context = this.modelInfoOf(sid)
      for (let i = 0; i < rounds.length; i++) {
        rounds[i] = {
          ...rounds[i],
          contextWindowTokens: rounds[i].contextWindowTokens ?? context.contextWindowTokens ?? null,
          contextWindowSource: context.contextWindowSource ?? rounds[i].contextWindowSource,
        }
      }
      const peakContextTokens =
        context.peakContextTokens ??
        rounds.reduce<number | null>(
          (peak, round) => round.contextTokens === null ? peak : Math.max(peak ?? 0, round.contextTokens),
          null,
        )
      this.emit(sid, {
        kind: 'terminal',
        response: String(last?.text ?? ''),
        resultType: 'success',
        usage: this.turnUsage.get(sid),
        rounds: rounds.map((round) => ({ ...round })),
        context: { ...context, peakContextTokens },
      })
    } catch (exc: any) {
      this.emit(sid, { kind: 'error', message: exc?.message || 'pi 收尾失败' })
    }
  }

  async createSession(workspaceDir: string, opts: { skill?: string } = {}): Promise<string> {
    if (!this.cli) throw new Error('未找到 pi CLI：请安装 pi（npm i -g @earendil-works/pi-coding-agent）或在 web/.env 配置 PI_CLI。')
    const sid = randomUUID()
    const args = [
      '--mode', 'rpc',
      '--model', `${this.model.provider}/${this.model.modelId}`,
      /* 思考档位默认 low：长推理是 token 大头，MVP 演示优先速度与成本 */
      '--thinking', this.thinking,
      /* 会话文件落在沙箱内，兼作权威 trace 来源 */
      '--session-dir', join(workspaceDir, '.pi-sessions'),
      '-n', sid.slice(0, 8),
      /* 无头运行不需要扩展发现，裁掉固定上下文开销 */
      '--no-extensions',
    ]
    if (opts.skill && INSTALLED_SKILLS.has(opts.skill)) args.push('--skill', skillDir(opts.skill))
    const channel = new JsonlChannel(this.cli, args, { cwd: workspaceDir })
    this.sessions.set(sid, {
      channel,
      workspaceDir,
      lastUsed: Date.now(),
      modelInfo: this.modelInfo(),
    })
    this.wireChannel(channel)
    this.startSweeper()
    /* 就绪确认：pi 启动完成才会应答；spawn 失败（命令不存在等）在这里暴露 */
    const state = await this.request({ type: 'get_state' }, sid)
    const s = this.sessions.get(sid)
    if (s) {
      if (state?.sessionId) s.piSessionId = String(state.sessionId)
      this.updateModelInfo(sid, this.modelInfoFromState(state))
    }
    return sid
  }

  async send(sessionId: string, content: string): Promise<void> {
    await this.request({ type: 'prompt', message: content }, sessionId)
  }

  stop(sessionId: string) {
    this.request({ type: 'abort' }, sessionId).catch(() => {})
  }

  disposeSession(sessionId: string) {
    const s = this.sessions.get(sessionId)
    if (!s) return
    this.sessions.delete(sessionId)
    this.turnUsage.delete(sessionId)
    this.callUsage.delete(sessionId)
    this.turnRounds.delete(sessionId)
    this.turnRoundNo.delete(sessionId)
    this.thinkState.delete(sessionId)
    s.channel.kill()
    this.dropSessionBookkeeping(sessionId)
  }

  protected onChannelExit(channel: JsonlChannel) {
    const sid = this.sidOf(channel)
    if (!sid) return
    this.sessions.delete(sid)
    this.turnUsage.delete(sid)
    this.callUsage.delete(sid)
    this.turnRounds.delete(sid)
    this.turnRoundNo.delete(sid)
    this.thinkState.delete(sid)
    for (const [id, p] of this.pending) {
      if (p.sid === sid) {
        this.pending.delete(id)
        p.reject(new Error('pi 会话进程退出'))
      }
    }
    this.dropSessionBookkeeping(sid)
  }

  /* 空闲回收：pi 每会话一进程，不能任其堆积 */
  private startSweeper() {
    if (this.sweeper) return
    this.sweeper = setInterval(() => {
      const now = Date.now()
      for (const [sid, s] of [...this.sessions]) {
        if (s.channel.exited || now - s.lastUsed > PI_IDLE_MS) this.disposeSession(sid)
      }
      if (this.sessions.size === 0 && this.sweeper) {
        clearInterval(this.sweeper)
        this.sweeper = null
      }
    }, 60_000)
    this.sweeper.unref?.()
  }

  async exportTrace(
    sessionId: string,
    outFile: string,
    options: TraceExportOptions = {},
  ): Promise<{ toolCallCount: number } | null> {
    const info = this.sessions.get(sessionId)
    const [state, msgs] = await Promise.all([
      this.request({ type: 'get_state' }, sessionId).catch(() => null),
      this.request({ type: 'get_messages' }, sessionId).catch(() => null),
    ])
    const list = msgs?.messages
    if (!Array.isArray(list) || list.length === 0) return null

    /* toolResult 折叠进对应 toolCall 的 state.output（详情页时间线形状） */
    const outputs = new Map<string, { text: string; isError: boolean }>()
    for (const m of list) {
      if (m?.role !== 'toolResult') continue
      const text = Array.isArray(m.content)
        ? m.content.filter((c: any) => c?.type === 'text').map((c: any) => c.text).join('\n')
        : String(m.content ?? '')
      outputs.set(m.toolCallId, { text, isError: Boolean(m.isError) })
    }

    const toolCalls: { tool: string; status: string; read_only: boolean; started: string }[] = []
    const messages = list.map((m: any, i: number) => ({
      seq: i,
      time: new Date(m.timestamp ?? Date.now()).toISOString(),
      role: m.role,
      parts: piParts(m, outputs, toolCalls),
    }))

    const tokenUsage =
      options.tokenUsage ??
      tokenUsageFrom(undefined, info?.modelInfo ?? this.modelInfo(), options.usageRounds ?? [])
    const trace: SessionTrace = {
      session: {
        id: state?.sessionId ?? info?.piSessionId ?? sessionId,
        title: `pi ${this.model.modelId}`,
        workspace: info?.workspaceDir ?? '',
        created: messages[0]?.time ?? new Date().toISOString(),
        updated: messages[messages.length - 1]?.time ?? new Date().toISOString(),
      },
      ...tokenUsage,
      usageRounds: options.usageRounds ?? [],
      summary: { messages: list.length, toolCalls },
      messages,
    }
    writeFileSync(outFile, JSON.stringify(trace, null, 1))
    return { toolCallCount: toolCalls.length }
  }

  buildPrompt(skill: string, messages: any[], isFirstTurn: boolean): string {
    // pi 进程常驻，历史天然保留，只发最新一条；技能指令仅首条注入
    const latest = messages[messages.length - 1]
    if (!isFirstTurn) return latest.content
    if (INSTALLED_SKILLS.has(skill)) {
      /* --skill 已注册命令，/skill:name 展开注入技能文档（模板章节在文档内）。
         career-guidance 写入 workspace/report.html，最终回复只保留短状态。 */
      const direct =
        `/skill:${skill} ${latest.content}\n\n` +
        '（先读取用户附件、Skill 参考资料和共享 chart-visualization Skill；涉及具体城市、岗位、实习/应届或学历结构时必须调用岗位库只读查询工具。' +
        '报告必须包含结论、岗位需求分析、岗位匹配、简历修改建议和行动计划，并写入当前 workspace/report.html。' +
        '岗位需求分析必须使用数据库结果并给出筛选口径、样本范围和内联 SVG 图表；数据不足时明确写未评估，不要编造。' +
        '简历修改建议必须基于用户材料，给出可直接替换的表达和待补证据。' +
        '不要输出分析过程、提示词、工具调用、内部清单、模型/Agent/Skill 说明、Markdown、JSON、代码围栏或 report-meta。' +
        CAREER_GUIDANCE_FILE_PROTOCOL +
        '不要读取 report.html 的完整内容，也不要把报告文件内容复制到最终回复。）'
      /* report-meta 侧车：报告尾部附机器校验块（服务端剥离，见 lib/reportMeta.ts） */
      return SIDECAR_SKILLS.has(skill) ? `${direct}\n\n${sidecarInstruction(skill)}` : direct
    }
    return `${SKILL_PROMPTS[skill]}\n\n${latest.content}`
  }
}

/** AgentMessage 内容块 → 详情页 RunPart 形状；toolCall 同时登记 toolCalls 摘要 */
function piParts(
  m: any,
  outputs: Map<string, { text: string; isError: boolean }>,
  toolCalls: { tool: string; status: string; read_only: boolean; started: string }[],
): unknown[] {
  if (m?.role === 'user') {
    if (typeof m.content === 'string') return [{ type: 'text', text: m.content }]
    return Array.isArray(m.content) ? m.content : []
  }
  if (m?.role !== 'assistant') return []
  const time = new Date(m.timestamp ?? Date.now()).toISOString()
  return (Array.isArray(m.content) ? m.content : []).map((b: any) => {
    if (b?.type === 'thinking') return { type: 'reasoning', text: b.thinking }
    if (b?.type === 'toolCall') {
      const out = outputs.get(b.id)
      const status = out?.isError ? 'error' : 'completed'
      toolCalls.push({ tool: b.name, status, read_only: false, started: time })
      return {
        type: 'tool',
        tool: b.name,
        callID: b.id,
        state: { status, input: b.arguments, output: out?.text },
      }
    }
    return b
  })
}
