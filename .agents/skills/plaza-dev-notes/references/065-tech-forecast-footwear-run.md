# 065 · tech-forecast 鞋类设计与工艺沙箱运行：专业型切词、入库日期筛选缺口与六图报告

**状态**：已实现观察（2026-10-16 会话 `sess-20261016-144013-1v9h`；服务端 `validateCompleteHtmlReport` 校验通过）。

**动机**：用户以「鞋类设计与工艺」专业为对象，要求按专业找岗位并生成分析，且限定“库筛范围为近两天入库（2026-10-10 之后）”。这与 tech-forecast 现有标准关键词表（无鞋类/皮革词）和只读查询工具（无日期谓词）两处约定都不重合，需要沉淀新形态。

## 约定细节

### 专业型切片的关键词落法（本次实测）
- `technology-snapshots.md` 标准关键词表没有「鞋类」领域，本次按“专业词 + 角色词收窄”自行组切片：
  - 目标切片：`keywords:["鞋"]` AND `roleTerms:["设计","开发","打版","制版","工艺"]`；广州 243 条、深圳 71 条、广东可识别 454 条（14 城）。
  - 传统对照切片：`keywords:["服装"]` + 同一 `roleTerms`（相邻成衣产业链大盘），广州 877 条。
  - 数字化新兴切片探测：`keywords:["鞋"]` AND `roleTerms:["3D","建模","数字化","渲染","虚拟"]`，全省仅 9 条（广州 4）→ 不足以支撑图表，未进入正文；数字化方向证据层改用公开来源 + 分析推断（与 044/045/046 纺织数字切片零命中的处理一致）。
  - 上游材料探测 `keywords:["鞋材"]`/`["皮革"]` 命中 0–2 条，同样不进入正文。
- 可复用结论：`roleTerms` 必须显式指定为**专业角色词**（设计/开发/打版/制版/工艺），不能沿用工具默认 `["后端","服务端","开发"]`（会收窄为软件岗，即 041 记录的问题）；`keywords` 用**单字领域词**（鞋/服装）可最大化召回，再用角色词收窄。

### 入库日期筛选：白名单工具不支持（用户要求无法在接口层满足）
- 用户要求“限定近两天入库（2026-10-10 之后）”，但 `scripts/career-market-query.mjs:47` 的允许参数集为 `[locationKey, keywords, roleTerms, internship, limit, timeoutMs]`，`scripts/career-market-query.mjs:48` 对未知参数直接抛 `不允许的参数：<key>`。
- 实测传 `dateFrom` → `{"ok":false,"error":"不允许的参数：dateFrom"}`。查询模板 `scripts/career-market-queries/*.sql` 也无日期列谓词；`038` 记录已确认库内 `create_time` 是抓取批次时间而非真实发布时间。
- 处理方式：**不伪造日期口径**，报告仍按在架横截面（`publish_state='PUBLISHING'`、`deleted=0`）出数，并在第七章以中性专业口径说明“只读查询接口不提供按入库日期筛选，本次为快照时点在架横截面”。后续若要支持该需求，须在工具侧新增受控日期参数（见扩展路线）。

### 报告产物
- `web/server/workspace/sess-20261016-144013-1v9h/report.html`，UTF-8 **46,420 字节**，7 个 `<h2>` 与 `TECH_FORECAST_REPORT_SECTIONS`（`web/server/lib/skills.ts:63-71`）逐字一致。
- 6 图，全部内联 SVG + `data-chart-skill`：`radar-chart CH_RADAR_FOOTWEAR`（4 技术 × 5 维）、`sankey-chart CH_SANKEY_FOOTWEAR`（6 来源 × 6 目标 = 12 节点）、`bar-chart CH_BAR_CITY_FOOTWEAR`、`bar-chart CH_BAR_SALARY_FOOTWEAR`、`stacked-bar-chart CH_STACKED_EDU_FOOTWEAR`、`stacked-bar-chart CH_STACKED_EXP_FOOTWEAR`；无 `<script>`、无 Base64、无外链。
- 引用编号自校验：正文 `<sup>[n]</sup>` 唯一值 {1..7}，首次出现顺序严格递增，第七章 `<h3>参考文献</h3>` 编号列表 7 条与正文一一对应。
- 服务端真实校验：`node --experimental-strip-types` 直接调 `validateCompleteHtmlReport(html, { heatmapChecks:false })` → `pass:true`、`errors:[]`、`warnings:[]`。

### 生成方式
- 恢复 041 记录的**一次性生成脚本**路线（`/tmp/gen-footwear-report.mjs`）：雷达/桑基/柱状/堆叠柱的坐标全部由脚本按数据计算，避免手写大规模 SVG 坐标。脚本一次性产出 `report.html`。

### 联网检索降级与可用来源（复现 046/051）
- `scripts/web-search.mjs --query` 中英文查询**整批失准**（“鞋类设计 3D 数字化 人才需求”返回知乎鞋子分类；“footwear 3D design”返回网文页）。`--fetch https://cn.bing.com/search?q=...` 同样主题错位。
- 可用兜底：**直连权威站点首页** `--fetch` 成功并可读到带日期条目——`https://www.worldfootwear.com/`（英文行业站，可读到 2026-10-13 「Digital Personalization in Footwear」等条目）、`https://www.cntac.org.cn/`、`http://www.clii.com.cn/`、`https://www.jinjiang.gov.cn/`、`https://www.gov.cn/`、`https://www.miit.gov.cn/`。
- 失败域名留档：`chinleather.org`、`china-leather.com`、`leather.org.cn`、`leatherbiz.com`、`leather365.com`、`shoes.net.cn` 均 `fetch failed`；`texnet.com.cn` 返回安全检查页；`chinashoes.com` 返回 GBK 乱码（同 045 的 GBK 取数坑）；`worldfootwear.com/sitemap.xml` 因 `text/xml` 不支持被拒。

## 成本与取舍
- 本次为无快照命中（`references/data/` 无鞋类文件）× 无日期筛选的组合，只能实时查库：共 3 批 `--parallel`、15 条查询，单批约 50s，合计约 3 分钟；比命中快照的会话慢，但换到真实横截面。
- **否决方案**：①用 `mysql-query.mjs` 手写带 `create_time` 的 SQL 满足“近两天入库”——越权（会话 AGENTS.md 只授权白名单 `career-market-query.mjs`，且 `create_time` 非真实发布时间，见 038）；②把 9 条数字化切片画成图表——样本口径不成立；③按通用行业常识编造鞋业薪资/趋势——违反证据纪律。
- 检索降级继续消耗 4–6 次无效 `--query` 与若干 `--fetch`（同 046/051），未改工具代码。

## 后续扩展路线
- **（高优先）工具侧受控日期参数**：若业务确实需要“近 N 天入库”切片，应在 `career-market-queries/*.sql` 增加显式日期谓词并在 `career-market-query.mjs` 的 `allowed` 白名单开放受控参数（如 `ingestSince`，固定可用列），同时在 SKILL.md 说明“入库时间≠发布时间、不得用于趋势”。
- `references/data/` 增加鞋类快照（如 `guangdong-footwear.md`），登记 `keywords:["鞋"]` + `roleTerms:["设计","开发","打版","制版","工艺"]` 口径与广州/深圳/佛山/东莞城市切片，消除实时查库。
- `technology-snapshots.md` 标准关键词表补「鞋类/皮革箱包」行（新兴：三维数字化设计/可持续材料；传统对照：手工制版/针车成型）。
- `web-search.mjs` 相关性硬阈值与自动 `--fetch` 兜底（同 046），或换稳定检索源。
- `parseReport` 对 HTML 报告的链路回归（同 035–053，仍待跑）；浏览器渲染回归待用户执行。

## 验证
- 15/15 白名单查询 `ok:true`（3 批 `--parallel`，单批 50–52s）。
- `report.html` 服务端校验 `pass:true`（见上）。
- 未完成：`parseReport` 链路与浏览器渲染回归。
