# 033 · industry-education-report 沙箱内第二次端到端运行（更丰富产物与语义审核）

## 状态

已实现观察（2026-10-12，真实 pi 会话，沙箱 `web/server/workspace/sess-20261012-093447-5eq4/`）。仍为 pi 直接执行技能脚本，**未经 `web/server/index.ts` 的 `parseReport` 侧车链路回归**，不能替代 001 的接入验收项。

## 动机

在 032 首次运行基础上，以“院校管理者 / 专业建设与调整”为对象再跑一次，验证 032 记录的产物形态能否复现并被有意扩展（更多图表、更强证据关联），同时把语义审核作为交付必过环节实测一次。

## 约定细节（本次实测）

- **产物**：`report.json` / `validation.json` / `report.md` / `delivery.json` / `review.md`，落在会话沙箱；命令以技能目录为 cwd。
- **规模**：22 claims（fact 18 / inference 1 / recommendation 3）、91 metrics、7 gaps、16 charts（全部 `type=table`）、16 sections、2 sources。`validate` → `structure_pass=true, errors=[]`；`render` 成功；`verify` → `{"delivery_matches_validated_report": true}`（写入 `delivery.json`）。
- **图表形态不变**：`charts[].metric_ids` + `metrics[]` 仍是唯一结构化图源；`sections[]` 依旧只有 `claim_ids`/`gap_ids`，无 `chart_ids`，故 032 记录的“02 模板逐章图位无法自动落实”依旧成立。本次把 charts 扩到 16 张，为后续前端按 `charts[].metric_ids` 渲染提供了更完整的实测输入。
- **语义审核实测（新增可复用约定）**：`review.md` 逐 claim 记录数值核对、kind 语气与 limitation。本轮发现并修正：(1) `fact` claim 中混入规范性建议（“不能只按全量岗位结构设专业”“对布点有直接指向”“主战场”“院校不能用它估计”）→ 移出建议或改为数据代表性陈述；(2) 经验枚举口径误解——每条岗位仅一个 `experience` 枚举、各桶合计约 100%，真正限制是区间语义重叠、无法切严格档位，原稿“各桶不可相加”属错误表述，已在 limitation 与图注改正。
- **操作事实**：`scripts/report.py` 的 `--output` 用 `open('x')` 不覆盖，重跑前须先删旧 `validation.json`/`report.md`/`delivery.json`；`validate` 还校验 `published <= accessed <= as_of`。
- **离线边界**：仍只读内置 05 与 assets，未联网、未连 MySQL；前端 Mock 知识库（政策库/岗位库/专业课程库/就业去向库）未被引用。

## 成本与取舍

- **取舍**：本次仍未改父仓库技能，16 张 chart 全靠手写，重复劳动高；换来的是一次对 `charts[].metric_ids` 承载能力的压力实测。
- **被否决的备选**：在广场侧给 `report.json` 私加 sections→charts 绑定以凑“图随章”。再次否决，理由同 032：偏离父仓库 data-contract，validate 不认。
- **未做**：未导出 Word/PDF，未验收页码/表头/图注。

## 后续扩展路线

1. 前端按 001/032 路线消费 `charts[]`（`type=table`）与 `metrics[]`（unit/period/region/population/definition/source_ids），可直接复用本次 16 chart 输入。
2. 父仓库给 `sections[]` 增加 `chart_ids` 仍是自动按章插图的唯一正解；落地前广场侧不私改 schema。
3. 需要正式交付件时按 `assets/02-报告模板.md` 排版 Word/PDF，并单独验收页码/表头/图注，不以 JSON 合格代替文件验收。
4. 002/001 的 `parseReport` 侧车回归仍是独立验收项（技能脚本直跑与 API 链路不可互替）。
