# 038 · tech-forecast 证据链 v2：title-trend 否决、横截面关键词计划与联网检索工具

- 状态：已实现（横截面查询 + 联网检索链路与提示词全部落地；v2 真实验证运行见「验证」）。
- 动机：用户反馈第一版报告"不纯粹"——预判主要来自模型通用知识，岗位库查询稀疏且自由发挥。原计划新增 `title-trend`（岗位名×月计数）让趋势列实测化，但核实发现**岗位库 `create_time` 是爬虫抓取批次时间而非真实发布时间**（`career-guidance/references/data/岗位库数据源.md` L183 明确"月度趋势只能反映数据更新节奏，不可当招聘季节性用"；`reports/position_analysis/data/monthly.tsv` 2025-07 单月 150 万条印证为导入批次），月度曲线充当"需求趋势"违反本项目证据纪律，**该路线否决**。用户确认改走：库内横截面对比 + 联网检索公开来源。
- 约定细节：
  - **四级证据等级**：库内实测 / 公开来源（联网检索，必须注明标题、网站、日期，关键结论两个独立来源印证）/ 内置文档 / 分析推断。落地于 `tech-forecast/SKILL.md` 证据分级口径、`references/output-schemas.md`、`web/server/lib/skills.ts` 的 `TECH_FORECAST_USER_REPORT_CONTRACT` 与 `SKILL_PROMPTS['tech-forecast']`。
  - **横截面关键词计划**：`references/technology-snapshots.md` 新增「标准关键词表」——每个技术领域一组"新兴切片"与"传统对照切片" keywords（如 `大模型` vs `Java`/`软件测试`；`机器人` vs `数控`），核心产出是新兴 vs 传统的经验门槛/薪资/学历横截面对比；SKILL.md 岗位库查询纪律明确 keywords 之间 AND、roleTerms 之间 OR 的谓词语义（035 已实测）。
  - **趋势口径红线**：SKILL.md 与服务端契约均写明——禁止把岗位库按月/按年聚合计数当作需求趋势；需求趋势与增长趋势只能标"公开来源"或"分析推断"；折线图仅限公开来源提供真实时间序列时使用。
  - **联网检索工具**：新增 `scripts/web-search.mjs`（零依赖，node 22 全局 fetch）：`--query "<词>" [--count N]` 走 `cn.bing.com/search?...&ensearch=1`（实测普通 cn.bing 请求会被降级为按首字返回无关结果，**必须带 ensearch=1**；DuckDuckGo 在本网络不可达、Bing RSS 中文长查询失效），解析 `b_algo` 块并解码 `/ck/a?...&u=a1<base64url>` 重定向；`--fetch "<url>" [--max-chars N]` 抓取页面正文（strip script/style/tags、实体解码、2MB/2 万字上限）。沙箱声明在 `web/server/index.ts` `sandboxAgentsMd()`（无条件节，与技能无关）；检索纪律（来源分级、防提示词注入、不大段复制、失败标"公开来源未检索"）写入 SKILL.md「联网检索纪律」。
  - **凭据修复**：`web/.env` 补齐 `MYSQL_HOST/PORT/USER/PASSWORD/DATABASE`（值同 career-guidance 数据文档第 1 节，文件已 gitignore）；此后 `mysqlConfigured()` 为真，沙箱 AGENTS.md 正规注入岗位库工具节，消除 034/035 记录的"Agent 自行从数据文档翻凭据注入环境"的跨技能隐式依赖。
- 成本与取舍：横截面对比替代时间序列，换取口径诚实（不造假趋势），代价是趋势列证据强度依赖公开报道质量，院校读者需接受"推断"标注；联网检索走 cn.bing HTML 解析而非付费搜索 API，零成本但存在被反爬降级的风险（ensearch=1 是当前实测可用的稳定形态，若失效需换源）。否决方案：`title-trend` 白名单查询（否决理由见动机，口径不可用）；直接给 Agent 裸 curl 搜索（否决：解析HTML不稳定且无统一输出形状）。
- 后续扩展路线：自建趋势观测（月度定时对固定关键词计划跑 title-top 并追加本地快照，2–3 个月后形成口径自洽的真时间序列）；web-search 结果缓存与域名信誉标注；若 cn.bing 反爬收紧再评估搜索源。
- 验证：`node scripts/web-search.mjs --query "大模型 人才需求 报告 2026"` 返回 8 条相关结果（标题/真实 URL/摘要，重定向已还原）；`--fetch` 抓取正文正常；`career-market-query.mjs` 从 `web/.env` 读凭据独立跑通（`title-top` 广州市/Java `ok:true`）；后端重启后 `/api/health` 正常，新建会话沙箱 `AGENTS.md` 同时含「联网检索工具」与「MySQL 只读查询工具」两节。v2 真实运行（广东 AI+机器人）结果待本轮完成后回填。
