# 032 · industry-education-report 在广场沙箱内首次端到端运行观察

## 状态

已实现观察（2026-10-10，真实 pi 会话，主仓库 `web/server/workspace/sess-20261010-160819-n35a/`）。**经 web/server `parseReport` 的链路回归仍未验证**（本次为 pi 直接执行技能脚本，未经 `web/server/index.ts` 侧车解析）。

## 动机

用户在会话沙箱内以 pi 直接运行 `industry-education-report`（子模块 `.agents/skills/industry-education-report`）生成《广东省人工智能产业人才需求观察报告》。本次记录两件事：该技能离线运行的真实产物形态；以及 `render` 产物与 02 模板排版正文的差异，避免后续把 `report.md` 误当作可交付排版稿，并为 001 提到的“后续 `charts[]` 前端渲染”提供实测输入。

## 约定细节

- **运行方式**：以技能目录为 cwd，`python3 scripts/report.py validate|render|verify <report.json>`；`--output` 用 `open('x')` **不覆盖**已有文件。本次产物落在会话沙箱：`report.json`、`validation.json`、`report.md`、`delivery.json`、`review.md`。
- **结构契约实测**：`edition=observation` 固定 16 章（S00–S12 + APXA/B/C），顺序须与 `assets/templates.json` 完全一致；本次 38 claims / 90 metrics / 7 gaps / 8 charts 全部被引用、无孤儿。`scripts/report.py:validate` 要求每个 metric 被 claim 或 chart 使用、每个 claim 有 source/metric、所有章节非空、`status=final` 时不得有 gap。
- **渲染件形态（关键事实）**：`scripts/report.py:render` 输出的是“按章罗列 claim 与其 limitation + 文末「图表与统计口径」表 + 来源附录”，**不是** `assets/02-报告模板.md` 的 12 章排版正文。schema 的 `sections` 只有 `claim_ids`/`gap_ids`，**没有 sections→charts 绑定字段**，故“每章 观点式导语→图N→数据解读→结论框”中的图位只能在后续 Word/PDF 排版阶段手工落实；导出后仍需另行检查页码、表头、图注。
- **编号体系**：本次 report.json 沿用 `DS-* / M-* / CL-*`（与 001 的约定一致：industry-education-report 接入时对齐其 data-contract，不自造第三套编号）。
- **离线边界实测**：技能仅读内置 `references/05-数据库字段摸底与口径.md` 与 `assets/*`，未联网、未连 MySQL；参考知识库（区域产业政策资料库、重点产业岗位需求库）为前端 Mock，未接入、未被引用。

## 成本与取舍

- **取舍**：本次不把该运行计入 001 的“industry-education-report parseReport 回归”验收项——路径不同（技能脚本 vs 服务端侧车），不能互相替代。
- **取舍**：`charts[]` 当前仅 `type=table`（`scripts/report.py:validate` 强制），因此未产出图形化图表；好处是 `metric_ids` 已是结构化数据源，前端渲染时无需重跑技能。
- **被否决的备选**：为凑“图 N 随章”而在 report.json 里自造章节与图绑定字段。否决理由：会偏离父仓库 data-contract，validate 不认，且应在上游技能仓库修改而非在广场侧私改。

## 后续扩展路线

1. 若前端按 001 路线渲染 observation 报告图表，可直接消费 `report.json` 的 `charts[].metric_ids` + `metrics[]`（含 unit/period/region/population/definition/source_ids）。
2. `sections[]` 增加 `chart_ids` 绑定是父仓库（industry-education-report-skill）的候选扩展；落地后广场侧才能自动按章插图。
3. 需要正式交付件时，再按 `assets/02-报告模板.md` 排版（Word/PDF），并单独验收页码/表头/图注，不能以 JSON 合格代替文件验收。
