# 067. 禁止 100% 归一化堆叠柱：构成对比统一分组柱

- **状态**：已实现（规则落地 8 个接入点；真实报告回归待跑）
- **动机**：run `20261021-025459-s6mo` 复查发现堆叠柱薄段标签挤压——学历/薪资 100% 堆叠图中 <3% 的薄段标签被省略或重叠（从该报告 SVG 提取文本时惠州学历图缺 2 档标签、薪资图两城各缺 2–3 段，读者看不到数值）。2026-10-22 用同一数据集对 4 个画图技能（自研 chart-visualization、lieflat-charts、antv-g2-chart、d3-viz）做独立评测，学历/薪资两张图全部自发选择分组柱且无标签丢失，验证分组柱是该场景的标准解。用户拍板：技能层直接禁止 100% 堆叠柱。
- **约定细节**：
  - 禁止任何"各段之和为 100%"的归一化堆叠柱；多群组构成/占比对比一律分组柱（同档各群组柱并排、共享一条占比坐标轴、每柱标注数值）。
  - 绝对数（非归一化）堆叠柱受限保留：仅单一群组、段数少且每段数值标签可读；薄段标签外置或引导线，不得省略/重叠。`data-chart-skill="stacked-bar-chart"` 值保留，旧报告校验兼容。
  - 接入点（2026-10-22 落地）：
    - `chart-visualization/SKILL.md:34`（Boundaries 禁令）
    - `chart-visualization/references/common-rules.md:13`（通用规则）
    - `chart-visualization/references/stacked-bar-chart.md:9`（选择限制，核心）
    - `chart-visualization/references/bar-chart.md:14`（分组柱规范）
    - `career-guidance/SKILL.md:85`（构成比例 → bar-chart 分组柱）
    - `career-guidance/references/job-data-presentation.md:16`（删除"各段之和应为 100%"要求，改分组柱口径；无数值/面议改列显式独立分组项）
    - `tech-forecast/SKILL.md:89`（学历/经验构成 → 分组柱）
    - `career-guidance/references/output-schemas.md:153`（charts 规格文档 type 枚举标 stackedBar 已禁用）
- **成本与取舍**：否决了"保留 100% 堆叠 + 薄段标签外置/引导线修补"方案——四个独立实现在同数据上全部放弃堆叠，且分组柱实现更简单、逐档对比可读性更强；分组柱图幅比堆叠柱略宽（档位多时横向压力大），由 bar-chart 的横向布局承担。服务端无兼容成本：`htmlReport.ts` 只校验 `data-chart-skill` 存在与热点图专项，无堆叠依赖；`reportMeta.ts` 的 `stackedBar` 枚举属休眠侧车协议（SIDECAR_SKILLS 为空集），未动。
- **后续扩展路线**：
  - 真实 career-guidance 会话回归：确认学历/薪资两图变为分组柱且无标签丢失（DeepSeek 充值后可跑；画图技能评测缺场 title-top8×antv 同批补跑，`~/Code/plaza-foru/chart-skill-eval/batch` 下 `node run-batch.mjs` 断点续跑）。
  - 若后续出现单群组构成且段数少的场景，验证绝对数堆叠受限条款是否被模型正确执行。
