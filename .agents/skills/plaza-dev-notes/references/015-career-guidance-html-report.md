# 015 · 就业指导 HTML 报告与内联 SVG 绘图 Skill

- 状态：开发中。
- 动机：Markdown 表格被误标为柱状图，`report-meta/2.charts` 还需要额外解析和前端转换；就业指导报告改为 Agent 直接输出可展示 HTML，图表直接以内联 SVG 呈现。
- 约定细节：career-guidance 首轮提示要求输出完整 HTML 文档，不输出 Markdown、JSON 或 report-meta 侧车；每张图使用 `figure[data-chart-skill]` 和对应 `references/html-chart-skills/*.md`，必须包含标题、来源/口径、可访问文本和内联 SVG。前端通过沙箱 iframe 展示 HTML，旧 Markdown 报告继续由 MarkdownView 渲染。
- 成本与取舍：报告样式与图表布局交给 Agent，减少侧车图表协议和多系列转换；iframe 引入固定高度和内部滚动，复杂交互图表暂不支持，脚本被沙箱禁用以限制模型 HTML 的执行风险。
- 后续扩展路线：补充 HTML 报告的高度自适应、打印/导出和真实 career-guidance 回归；确认所有图表 Skill 的数据口径与 SVG 可访问性。
- 验证：前端构建和真实 Agent HTML 输出待验证。
