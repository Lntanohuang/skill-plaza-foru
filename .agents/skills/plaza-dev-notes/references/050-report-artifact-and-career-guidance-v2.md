# 050 · 通用报告 Artifact 协议与就业指导 Skill v2

- **状态**：已实现（通用协议、运行时捕获、新版就业指导 Skill 和一次真实 DeepSeek Pro 会话均已验证；浏览器端回归待用户执行）。
- **动机**：不同报告需要不同输出格式，不能把 HTML、PDF、DOCX 或纯文本强行统一成一种报告。需要统一描述“实际生成了什么、给谁用、是否成功”，同时将就业指导 Skill 中的业务规则与通用写作、输出和图表规则分层。

## 约定细节

### Artifact 协议

- 协议文件：`.agents/skills/report-output/references/artifact-protocol.md`。
- 当前版本：`artifact/1`。
- Artifact 是产物清单和证据关系，不嵌入完整 HTML、SVG、PDF 或二进制内容。
- 顶层字段：`schema`、`kind`、`status`、`title`、`outputs`、`sources`、`metrics`、`claims`、`evidence`、`gaps`。
- `outputs[]` 允许业务按需声明 `text`、`html`、`markdown`、`pdf`、`docx`、`doc`、`json`、`image`、`zip`；本次没有实现 PDF/DOCX 渲染器，只实现协议记录和当前 HTML/JSON 产物。
- 业务 Skill 决定需要的产物组合；运行时负责读取、校验、保存、记录和返回产物摘要。

### 统一证据模型

- 通用写作说明：`.agents/skills/report-writing/references/evidence-model.md`。
- 最小公共关系为 `claim → evidence → source`、`metric → source`；岗位匹配可以在 evidence 上扩展 `requirement` 和 `support`。
- 证据支持状态、缺口状态和机器校验状态不混用。
- 旧 `report-meta/1`、`report-meta/2` 和 `industry-education-report/report.json` 保持兼容，本次不强制迁移。

### Skill 分层

- `.agents/skills/report-writing/SKILL.md`：事实/推断/建议、来源口径、报告组织和通用自检。
- `.agents/skills/report-output/SKILL.md`：产物声明、workspace 文件约定、Artifact 使用和交付失败语义。
- `.agents/skills/career-guidance/SKILL.md`：v2 只保留就业领域目标、岗位库、简历、匹配、行动、六章结构和就业专属图表要求；正式报告声明 `report.html` 与 `report.artifact.json`。
- 本次未整理 `tech-forecast` 和 `industry-education-report`，未实现 radar/sankey。

### 运行时接入

- `web/server/lib/artifact.ts`：固定读取 workspace `report.artifact.json`，限制 1 MB、拒绝符号链接，校验 schema、产物类型/状态、路径安全、ID 唯一性和 source/metric/claim/evidence 引用关系。
- `web/server/index.ts:985-1006`：终态、超时和中止收尾均捕获 Artifact；有效或结构有误的 JSON 保存为 `traces/<runId>.artifact.json`，校验摘要写入 `RunRecord.report.artifact`；不阻断已有 HTML 报告成功交付。
- `web/server/index.ts:300-307`：运行详情提供 Artifact JSON 下载；终态 SSE/OpenAI 扩展帧返回产物摘要。
- `web/server/lib/traceExport.ts`：RunRecord 增加 Artifact 校验摘要和文件路径。
- `web/src/composables/useChatApi.ts`、`web/src/pages/UsePage.vue`、`web/src/data/runsMock.ts`、`web/src/api/runsApi.ts`、`web/src/pages/RunDetailPage.vue`：补充产物摘要类型、事件透传和运行详情下载入口。

## 成本与取舍

- 采用“Artifact 作为结构化侧车，HTML 继续走现有报告文件链路”，避免重写现有 `workspace/report.html`、HTML 校验、报告查看和下载。
- Artifact 校验只保证结构和引用可解析，不声称完成正文数字与证据的语义一致性核验。
- 没有把所有技能强制改成 Artifact，也没有替换旧 report-meta；这样可以先验证就业指导，再逐步迁移其他业务。
- 没有实现 PDF/DOCX 渲染器；协议预留类型，但当前运行时只会保存 Agent 已实际生成的文件描述。

## 验证

- `cd skill-plaza-foru && node --experimental-strip-types --test web/server/lib/artifact.test.ts web/server/lib/htmlReport.test.ts`：15 项通过。
- `cd skill-plaza-foru/web && npm run build`：通过。
- `node --experimental-strip-types --check web/server/index.ts`、`artifact.ts`、`traceExport.ts`：通过。
- 真实 DeepSeek Pro Pi 会话：run `20261021-025459-s6mo`，`outcome=success`；耗时约 980 秒；生成 `report.html`（132,260 bytes）和 `report.artifact.json`（9,857 bytes）。HTML 校验通过，六个 h2 顺序正确，4 张内联 SVG 图表和 `CH_CITY` 热点图通过服务端校验；Artifact 校验通过，包含 2 个产物、4 个来源、10 个指标、6 个结论、7 条证据、5 个缺口；HTML 查看/下载接口与 Artifact JSON 下载接口均返回 200。
- 待验证：浏览器端报告查看、历史记录复用和用户侧下载链接由用户执行 Playwright/浏览器回归。

## 后续扩展路线

1. 先用真实就业指导会话验证 Artifact 产物生成率、证据引用质量和部分成功语义。
2. 再决定是否让 `report.artifact.json` 成为就业指导报告的硬性成功条件。
3. 其他业务 Skill 后续分别声明自己的 Artifact 输出组合，不直接复制就业指导的六章或岗位库规则。
4. PDF/DOCX 需要独立 renderer 和资源打包策略，不能仅靠 Artifact 协议自动生成。
