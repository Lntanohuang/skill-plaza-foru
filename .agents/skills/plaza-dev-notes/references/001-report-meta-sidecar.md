# 001 · report-meta 侧车：报告双轨输出（校验字段与用户内容分离）

**状态**：已实现（2026-09-21 定稿并落地，首批 career-guidance / pi 引擎）。端到端真实会话验收待跑。
**适用范围**：首批仅 career-guidance（pi 引擎）；机制按引擎/技能无关抽象，新技能接入只改 `SIDECAR_SKILLS` 一行。

## 动机

MVP 直出模式下，模型最终回复的 Markdown 即交付物，但有两个结构性缺口：

1. **来源无法机器校验**——报告里每个关键数字的依据（哪个快照、什么口径）只存在于 `[事实·岗位库快照 2026-09-20]` 这类行内文字标注里，机器无法逐数字核对来源。
2. **图表数据不可寻址**——数字埋在 md 表格文本里，将来前端渲染图表需要再解析 md 表格或重跑生成，历史 run 记录无法复用。

方案：**双轨输出**。给用户的 Markdown 报告照旧流式输出；报告全文最后附一个机器侧车 JSON 块（校验字段与依据字段），服务端识别、剥离、校验、落盘——用户全程看不到原始 JSON，也不在正文展示依据表。

## 约定细节

### 输出形态（模型侧）

- 报告全文最后另起一个围栏块，信息串**必须**是 `json:report-meta`（服务端按此识别，不是普通 ```json 块）：

````markdown
（……报告全文 Markdown……）

```json:report-meta
{ "schema": "report-meta/1", "skill": "career-guidance", "sources": [...], "metrics": [...], "claims": [...] }
```
````

- 块内单例 JSON，schema 固定 `report-meta/1`，三段：

```jsonc
{
  "schema": "report-meta/1",
  "skill": "career-guidance",
  "sources": [                                   // 本报告引用的全部来源
    { "id": "DS1", "title": "内置岗位库快照", "snapshotDate": "2026-09-20", "locator": "城市分布" }
  ],
  "metrics": [                                   // 正文每个关键数字一条
    { "id": "M1", "name": "广州岗位量", "value": 8.1, "unit": "万条",
      "period": "快照", "region": "广州", "sourceIds": ["DS1"] }   // sourceIds 必填
  ],
  "claims": [                                    // 结论条目，kind 对应正文 [事实]/[推断]/[建议]
    { "id": "C1", "kind": "fact", "sourceIds": ["DS1"], "sectionId": "1. 结论" }
  ],
  "evidence": [                                  // 开发侧依据链，不展示给用户
    { "id": "E1", "requirement": "岗位要求", "support": "用户材料", "status": "matched", "sourceIds": ["DS1"] }
  ]
}
```

- `claims.kind ∈ fact | inference | recommendation`。
- `evidence.status ∈ matched | partial | gap | unknown`；`evidence` 用于记录岗位要求、用户材料与判断的对应关系，正文不展示。
- **id 沿用各技能正文既有编号习惯**：career-guidance 用 DS/M/C；industry-education-report 接入时对齐其 data-contract 的 DS/M/CL 体系，不自造第三套编号。
- 指令要求紧凑：不复述正文文字，可选字段能省则省。

### 服务端行为（实现落点，2026-09-21 回填）

- `web/server/lib/reportMeta.ts`（引擎/技能无关的核心抽象）：
  - `SIDECAR_MARKER`（:13）：围栏标记常量，流式隐藏与提取共用。
  - `extractSidecar(text)`（:82）→ `{ meta | null, cleanText, error? }`：取**最后一个** ` ```json:report-meta ` 围栏块，JSON.parse 后从正文剥离；围栏存在但 JSON 损坏时**也剥离**（用户不该看到坏 JSON），记录 error；未闭合围栏同样报 error 并丢弃尾部。
  - `validateMeta(meta)`（:120）→ `{ pass, errors[], counts }`：来源 id 唯一、title 必填；每个 metric 的 `sourceIds` 非空且全部可解析到 sources；claim 的 kind ∈ fact/inference/recommendation、来源可解析。错误上限 20 条（防坏输出撑爆 note）。**不做**正文↔侧车数值一致性核对（flash 级模型容错）。
  - `sidecarInstruction(skill)`（:178）：注入提示词的紧凑指令（含 schema 示例与编号约定）。
- 接入点（实际 file:line）：
  - `web/server/lib/skills.ts:45`：`SIDECAR_SKILLS = new Set(['career-guidance'])`。
  - `web/server/lib/piRunner.ts:352`：`buildPrompt` INSTALLED_SKILLS 分支内，命中 SIDECAR_SKILLS 时在直出指令后追加 `sidecarInstruction(skill)`。未改 career-guidance 子模块。
  - `web/server/index.ts:473-477`（状态声明）、`:629-649`（text_delta 扣留转发：未确认围栏前扣留标记长度-1 的尾部，确认后从标记处截断）、`:654-658`（terminal：`extractSidecar` → `done.content` 与 `finalText` 用 cleanText；无围栏时补发扣留尾部）、`:531-559`（finalizeRun：校验写 `record.report.meta`，全量 `{skill, meta, validation}` 写 `traces/<runId>.report.json`，`recorder.note({sidecar:…})`；无块记 `absent` 不算失败）。
  - `web/server/lib/traceExport.ts`：`RunRecord.report` 扩展可选 `meta{pass,errors,counts}`（原 structurePass/missingSections/stats 转可选，历史 jsonl 兼容）。
  - `web/src/pages/RunDetailPage.vue:180-196`：「来源校验」卡（`item.report?.meta` 门控，不限技能）——来源/指标/事实/推断/建议计数 + 前 5 条错误 + 下载 report.json；「报告解析」卡仍仅 industry-education-report。前端镜像类型 `web/src/data/runsMock.ts`。
- **industry-education-report 的 parseReport 章节校验链路原样保留**，与侧车两轨并存。
- 已验证（2026-09-21）：node 直调 14 项断言全过（提取三路径、坏引用四类、逐字符/分片流式隐藏、无围栏补发）；`vue-tsc --noEmit` 0 错；服务端四模块 import OK。端到端真实 pi 会话验收待跑（见下）。

## 成本与取舍

- 每次报告约 **+300~800 输出 token**（侧车本体）+ 约 150 指令 token；无重复正文、无额外模型调用。
- 坏 JSON 降级：剥离侧车、正文照发、note 记录 sidecarError，**不自动重试**（成本优先）。
- 被否决的备选：
  - ~~md 表格 + 侧车全量数据双份~~：9 图数据输出两遍，token 明显增加，与成本优先冲突。
  - ~~图表数据只进侧车、md 不再放表格~~：报告 md 不自包含，模型 JSON 损坏时表格全丢。
  - ~~纯 JSON 单轨输出~~：流式过程用户只能看 JSON 流，展示体验差，flash 级可靠性风险集中。

## 后续扩展路线

- **图表（本期明确不做）**：metrics（值+单位+口径+来源 id）即图表数据源；后续 `charts[]` 只引用 metric id（对齐 industry-education-report data-contract 的 `metric_ids` 约定），前端引入 ECharts 渲染时历史 run 无需重跑。
- 新技能接入：`SIDECAR_SKILLS` 加一行 + 确认该技能的 id 编号习惯写进 `sidecarInstruction`。
- zcode 引擎如需侧车：`zcodeRunner.buildPrompt` 调同一 `sidecarInstruction`，index.ts 侧逻辑本来就引擎无关。

## 验证口径

1. ✅ node 直调 `extractSidecar` / `validateMeta`：正常块提取+剥离干净、坏 JSON 降级（剥离但记 error）、无块直通原文本（2026-09-21，14 项断言全过）。
2. ⬜ 真实 pi 会话（career-guidance）：流式输出无 JSON、`done.content` 干净、`traces/<runId>.report.json` 有 meta、RunDetailPage「来源校验」卡正确。
3. ⬜ 回归：industry-education-report 跑一次确认 parseReport 链路不受影响。
