# 015 · 就业指导 HTML 报告与内联 SVG 绘图 Skill

- 状态：已实现文件产物协议（真实 Agent 超时恢复与浏览器回归待验证。2026-10-19 并入原 025/034 的 failureHint 文案坑与终态收档事实，见 076）。
- 动机：Markdown 表格被误标为柱状图，且让 Agent 把完整 HTML 放进最终回复会增加输出 token、SSE 传输量和超时概率；就业指导报告改为写入当前会话 workspace/report.html，最终回复只返回短状态，图表仍由 Agent 以内联 SVG 呈现。
- 约定细节：`career-guidance/SKILL.md`、`web/server/lib/skills.ts` 与 `web/server/lib/piRunner.ts` 统一要求 Agent 将完整 HTML 写入当前 workspace 根目录的 `report.html`，最终回复不得复制报告内容或伪造 URL。`web/server/index.ts` 终态优先读取并校验 workspace/report.html，复制到 `traces/<runId>.report.html` 后通过 `/api/reports/:runId` 独立返回；旧 Agent 返回完整 HTML 时仅在识别为 HTML 后兼容转换，普通短状态不能伪装成报告。`web/src/components/ReportOutput.vue` 只展示报告链接。每张图使用 `figure[data-chart-skill]` 和对应绘图 Skill，要求内联 SVG；HTML 文件限制大小、拒绝符号链接越界并检查 doctype/html/head/body。
- 成本与取舍：报告样式与图表布局仍交给 Agent，文件产物与最终回复解耦，减少上下文末端的 HTML 输出和前端 SSE 压力；保留旧 HTML 回复 fallback 以兼容历史会话。报告通过独立 endpoint 返回并使用 CSP 禁止脚本，复杂交互图表暂不支持。
- 后续扩展路线：完成真实成功、短回复、空回复、旧 HTML fallback、超时恢复和浏览器回归；补充报告打印/导出与更细的图表语义校验。
- 验证：`cd web && npm run build` 与 HTML 报告单元测试待本次运行完成后回填；已有会话 `sess-20260928-222556-pft1` 证明旧版完整 HTML 报告可落盘，真实新协议回归仍待验证。
- 服务端补充校验：`web/server/lib/htmlReport.ts` 在保存 career-guidance HTML 时记录图表 marker；成功热点图须为 `CH_CITY` 并含 SVG `title`/`desc`/`figcaption`，失败状态可用 `data-chart-status="unassessed"` 但必须写可读原因。校验结果落在 `RunRecord.report.html` 和运行事件 note；报告已写入但任务超时时先返回可用链接，未写入则明确报告未生成。真实中国目标成功/失败分支仍待回归。
- **failureHint 文案坑（2026-09-29 与 10-13 两次复现）**：热点图 figure 的图注若出现「未返回/无结果/失败」等字样且附近有「热点图/城市分布」，`htmlReport.ts` 的 failureHint 会把**成功**热点图误判为失败分支；图注必须用「没有匹配记录/缺失（非 0）」等中性表述。`figcaption` 必须在 `<figure>` 内，外部 `<p class="cap">` 不算。
- **终态收档时序**（原 025 诊断结论）：报告文件在终态、超时、断连三种收尾路径都会尝试复制；超时且已恢复报告时先返回带 `reportUrl` 的 done，避免 error 事件吞掉链接。trace 权威数据为 `traces/index.jsonl`、`<runId>.events.jsonl`、`<runId>.json` 三层；done 早于 appendIndex 落库的竞态已由 074 前端重拉承接。
