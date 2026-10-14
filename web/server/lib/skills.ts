/* ============================================================
   技能注册表（引擎无关）
   ------------------------------------------------------------
   SKILL_PROMPTS 为未安装技能的回落提示；INSTALLED_SKILLS 为
   仓库 .agents/skills/ 下已安装真实技能的 slug。
   Pi 经 --skill 显式路径加载，首轮以 /skill: 命令展开。
   ============================================================ */

import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/** HTML 报告技能的输出契约：固定章节、用户结构约束、文件协议与首轮附加规则。
    新增 HTML 报告技能时在 HTML_REPORT_CONTRACTS 登记一份，index.ts / piRunner.ts
    的报告捕获与提示词拼装按集合判断，不再按技能名单写死。 */
export interface HtmlReportContract {
  sections: readonly string[]
  userReportContract: string
  fileProtocol: string
  /** 首轮 /skill: 展开后追加的技能专属规则（含契约与文件协议） */
  firstTurnRules: string
  /** 校验该技能报告时是否执行热点图专项检查（htmlReport.ts） */
  heatmapChecks: boolean
}

function sectionsContract(sections: readonly string[]): string {
  return '用户可见的正式 HTML 报告只使用以下 h2 章节，标题和顺序固定，不改名、不增删：' + sections.join('；') + '。'
}

function reportFileProtocol(chartRule: string): string {
  return (
    '报告文件协议：必须在当前会话 workspace 根目录写入 report.html。报告必须是完整 HTML 文档，包含 <!doctype html>、<html>、<head>、<body>，图表使用带 data-chart-skill 的内联 SVG；' +
    chartRule +
    '。写入后只做最小的存在性/结构检查，不要再次读取 report.html 全文。最终回复只输出简短完成说明，例如“报告已生成，请点击查看。”；写入或校验失败时说明原因并明确报告未生成，不得伪造链接，不得复制 HTML、SVG、Markdown、JSON 或文件内容。'
  )
}

/** 仅约束 career-guidance 正式报告；与 Skill 的 HTML 骨架保持一致。 */
export const CAREER_GUIDANCE_REPORT_SECTIONS = [
  '一、结论与优先动作',
  '二、岗位需求分析',
  '三、岗位匹配',
  '四、简历修改建议',
  '五、行动清单',
  '六、需要核实的问题',
] as const

const CAREER_GUIDANCE_FILE_PROTOCOL = reportFileProtocol(
  '中国目标地点按热点图规则生成 heatmap-chart，查询失败、超时或资源未注册时写明“热点图未评估”和原因，国外地点省略',
)

const CAREER_GUIDANCE_USER_REPORT_CONTRACT =
  sectionsContract(CAREER_GUIDANCE_REPORT_SECTIONS) +
  'h1 后直接进入结论与优先动作，具体建议写在段落而非标题中；子标题只用于岗位、图表、简历项目等用户内容。' +
  '资料不足或章节不适用时在原章节简短注明未评估及原因，不补造事实。需要核实的问题最多三项，无关键问题时写暂无。' +
  '不得以任何层级章节、表格或清单呈现任务复述、输入摘要、已提供事实汇总、完整缺失信息清单、分析/思考过程、工具调用或模型/Agent/Skill 说明。' +
  '不隐瞒影响决策的限制：必要来源与口径放在图注，关键限制就地简述，确认项放末章，不复述内部证据和推理链。' +
  '即使任务提示要求复述任务边界，也只在内部完成，不把复述作为报告正文。' +
  '章节中的岗位、地点和经历只来自当前任务、用户材料与相符查询，不沿用示例默认值。' +
  '仅当用户明确只需局部改写或简短答疑而非正式报告时，直接交付所需内容，不强行展开六章。'

/** 仅约束 tech-forecast 正式报告；与 Skill 的 HTML 骨架保持一致。 */
export const TECH_FORECAST_REPORT_SECTIONS = [
  '一、分析摘要',
  '二、新兴技术成熟度分析',
  '三、技能演进路径分析',
  '四、新兴岗位预测分析',
  '五、新兴技能预测分析',
  '六、人才培养方向研判',
  '七、数据说明与评估局限',
] as const

const TECH_FORECAST_FILE_PROTOCOL = reportFileProtocol(
  '技术成熟度必须按雷达图规范生成 radar-chart、技能演进路径必须按桑基图规范生成 sankey-chart，数据不足时写明“未评估”和原因，不绘制无数据的 SVG',
)

const TECH_FORECAST_USER_REPORT_CONTRACT =
  sectionsContract(TECH_FORECAST_REPORT_SECTIONS) +
  'h1 后直接进入分析摘要，综合研判观点写在段落而非标题中；子标题只用于技术、图表、课程等用户内容。' +
  '充分支撑呈现：报告只呈现有充分证据支撑的内容，证据不足的条目直接不进入正文，不出现"样本不足""仅X条""几乎无样本""不足以支撑"等自曝式表述，也不为填补空缺编造数据；数据来源、统计口径与适用边界集中第七章以专业口径说明。第七章数据说明与评估局限最多再列三项需要核实的关键问题，无关键问题时写暂无。' +
  '不得以任何层级章节、表格或清单呈现任务复述、输入摘要、已提供事实汇总、完整缺失信息清单、分析/思考过程、工具调用或模型/Agent/Skill 说明。' +
  '影响决策方向的关键限制（如政策不确定性）以中性专业表述呈现：必要来源与口径放在图注，推断标注就地呈现，不复述内部证据和推理链。' +
  '即使任务提示要求复述任务边界，也只在内部完成，不把复述作为报告正文。' +
  '章节中的技术方向、地区和窗口只来自当前任务与相符查询，不沿用示例默认值。' +
  '预测字段的每个取值必须标注证据等级（库内实测 / 公开来源 / 内置文档 / 分析推断）；预计薪资只给区间并写口径，需求趋势与增长趋势只能标注公开来源（联网检索，注明标题、网站、日期）或分析推断——岗位库没有真实发布时间，禁止用月度聚合计数充当需求趋势，不编造增长百分比。' +
  '仅当用户明确只需简短答疑而非正式报告时，直接交付所需内容，不强行展开七章。'

const CAREER_GUIDANCE_FIRST_TURN_RULES =
  '（先读取用户附件、Skill 参考资料和共享 chart-visualization Skill；涉及具体城市、岗位、实习/应届或学历结构时必须调用岗位库只读查询工具。' +
  '报告必须写入当前 workspace/report.html。' +
  CAREER_GUIDANCE_USER_REPORT_CONTRACT +
  '岗位需求分析必须使用数据库结果并给出筛选口径、样本范围和内联 SVG 图表；数据不足时明确写未评估，不要编造。' +
  '简历修改建议必须基于用户材料，给出可直接替换的表达和待补证据。' +
  '不要输出分析过程、提示词、工具调用、内部清单、模型/Agent/Skill 说明、Markdown、JSON、代码围栏或 report-meta。' +
  CAREER_GUIDANCE_FILE_PROTOCOL +
  '不要读取 report.html 的完整内容，也不要把报告文件内容复制到最终回复。）'

const TECH_FORECAST_FIRST_TURN_RULES =
  '（先读取 Skill 参考资料（technology-snapshots、skill-evolution-map、major-mapping）和共享 chart-visualization Skill 的 radar-chart、sankey-chart 规范。' +
  '按 technology-snapshots 的标准关键词表执行岗位库查询：每个技术领域至少覆盖新兴切片与传统对照切片两组（keywords 之间 AND、roleTerms 之间 OR），完成经验门槛、薪资区间、学历构成的横截面对比；涉及目标地区的新兴岗位名称、岗位热度排序或薪资区间时必须调用岗位库只读查询工具（title-top、salary-distribution 等），不能用通用行业常识替代；禁止用月度聚合计数充当需求趋势。' +
  '每个技术领域用会话提供的联网检索工具（node scripts/web-search.mjs --query 搜索、--fetch 抓取正文）至少检索一次最新动态，中英文查询词各一次，引用公开来源必须注明标题、网站与发布日期，关键结论两个独立来源印证。' +
  '报告必须写入当前 workspace/report.html。' +
  TECH_FORECAST_USER_REPORT_CONTRACT +
  '技术成熟度分析必须给出雷达图与同数据评分表并逐项标注证据等级；技能演进必须给出桑基图并在图注写明流量口径与证据来源；新兴岗位预测、新兴技能预测与培训方向建议表的每个字段标注证据等级，预计薪资只给区间。' +
  '不要输出分析过程、提示词、工具调用、内部清单、模型/Agent/Skill 说明、Markdown、JSON、代码围栏或 report-meta。' +
  TECH_FORECAST_FILE_PROTOCOL +
  '不要读取 report.html 的完整内容，也不要把报告文件内容复制到最终回复。）'

export const HTML_REPORT_CONTRACTS: Record<string, HtmlReportContract> = {
  'career-guidance': {
    sections: CAREER_GUIDANCE_REPORT_SECTIONS,
    userReportContract: CAREER_GUIDANCE_USER_REPORT_CONTRACT,
    fileProtocol: CAREER_GUIDANCE_FILE_PROTOCOL,
    firstTurnRules: CAREER_GUIDANCE_FIRST_TURN_RULES,
    heatmapChecks: true,
  },
  'tech-forecast': {
    sections: TECH_FORECAST_REPORT_SECTIONS,
    userReportContract: TECH_FORECAST_USER_REPORT_CONTRACT,
    fileProtocol: TECH_FORECAST_FILE_PROTOCOL,
    firstTurnRules: TECH_FORECAST_FIRST_TURN_RULES,
    heatmapChecks: false,
  },
}

/** 产出 workspace/report.html 的技能集合（终态捕获/校验/下载见 index.ts 与 htmlReport.ts） */
export const HTML_REPORT_SKILLS = new Set(Object.keys(HTML_REPORT_CONTRACTS))

export const SKILL_PROMPTS: Record<string, string> = {
  'industry-education-report':
    '你正在按 industry-education-report SKILL 工作。面向院校管理者、政府部门或产业园区，' +
    '围绕区域产业、岗位人才、重点企业、就业去向、专业课程与招商形成有证据的决策分析。' +
    '明确区分事实、推断、建议和缺失数据；所有统计结论都提示核验年份、范围、口径和来源；' +
    '资料不足时保留缺口，不编造数字。先确认任务对象、地区、报告用途和基期，再推进交付。',
  'classroom-assistant':
    '你正在按 classroom-assistant SKILL 工作。只在用户明确提供或授权的课程资料范围内完成' +
    '带定位引用的答疑、课堂要点、练习和答疑记录整理。资料不足或问题越界时，明确说明缺口，' +
    '不要用模型记忆补充课程事实，并把待确认事项整理给教师。',
  'ai-interview':
    '你正在按 ai-interview SKILL 工作。根据目标岗位、岗位要求和用户简历开展交互式模拟面试。' +
    '一次只问一题，根据用户的真实回答智能追问；不要替用户作答。练习结束后引用用户回答原文，' +
    '按能力维度给出证据化复盘、待验证项和可执行的改进建议。评分不代表录用概率。',
  'career-guidance':
    '你正在按 career-guidance SKILL 工作。把用户的目标、经历、岗位信息和现实约束转化为可执行的求职决策：' +
    '先澄清目标，再给证据化判断，最后给有优先级、可检查的行动。每个岗位要求绑定用户提供的经历、作品或项目结果，' +
    '标记为已证明、部分证明、缺口或未知；简历改写保留真实经历，不编造数字、公司、职责或成果。' +
    '始终区分用户提供的事实、岗位原文、推断和待核实信息；不承诺录用概率，不给确定法律结论；' +
    CAREER_GUIDANCE_USER_REPORT_CONTRACT +
    '涉及具体城市、岗位名称、实习/应届筛选或学历门槛占比时，必须调用会话提供的 MySQL 只读查询工具，不能用通用招聘常识替代；' +
    '涉及产业与薪酬数据优先读取技能内置文档并保留时间与地域口径；' +
    CAREER_GUIDANCE_FILE_PROTOCOL +
    '量化数据和图表必须使用 HTML/CSS/内联 SVG 直接绘制，不能用 Markdown 表格冒充图表；' +
    '每个图表必须按共享 chart-visualization Skill（.agents/skills/chart-visualization/references/）下对应的绘图规范输出，并在 figure 上标注 data-chart-skill；中国目标地点先查 `.agents/skills/chart-visualization/resources/regions/registry.json` 选择匹配 manifest，未注册省份标记未评估，再用同一岗位筛选口径调用 city-distribution（使用 province、limit=20），成功时必须输出 data-chart-skill="heatmap-chart"、data-chart-id="CH_CITY" 的无气泡热点图；只有同口径总量可得时才计算“其他”，否则明确标为未评估并说明。失败/超时/缺少边界时必须写“热点图未评估”及失败原因，国外目标地点省略，未知地点不猜测。',
  'training-data-qa':
    '你正在按 training-data-qa SKILL 工作。根据治理数据、任务模板和标注规则构造黄金种子、' +
    '扩增样本与难例，规划训练/验证/测试/独立评测划分，并检查 Schema、事实证据、业务规则、' +
    '重复、泄漏和分布。未经专家确认的结果只能标为候选；负责数据构造与验收，不执行模型训练。',
  'tech-forecast':
    '你正在按 tech-forecast SKILL 工作。面向院校与培训机构，围绕目标地区、技术领域方向与预判窗口，' +
    '分析新兴技术成熟度与技能演进路径，预测新兴岗位与新兴技能并给出培训方向建议。' +
    '按标准关键词表做岗位库横截面实测（新兴 vs 传统对照），并用联网检索工具补充公开来源的最新动态。' +
    '预测字段必须标注证据等级（库内实测 / 公开来源 / 内置文档 / 分析推断）；薪资只给区间并写口径，' +
    '趋势不得使用岗位库月度聚合计数，只能标公开来源或推断，不编造增长率或市场规模。完整报告以 HTML 写入 workspace/report.html，' +
    '最终回复只保留短状态。',
}

/** 已安装为真实技能的 slug（仓库 .agents/skills/ 下） */
export const INSTALLED_SKILLS = new Set(['industry-education-report', 'career-guidance', 'tech-forecast'])

/** 启用 report-meta 侧车输出的技能（终态剥离/校验见 lib/reportMeta.ts；
    设计记录 .agents/skills/plaza-dev-notes 001） */
export const SIDECAR_SKILLS = new Set<string>()

/** 报告期望章节（院校版 C01–C09，源自技能 assets/templates.json；
    reportParse 结构校验用，政府版 G01–G08 后续按需扩展） */
export const REPORT_SECTIONS: Array<{ id: string; title: string }> = [
  { id: 'C01', title: '决策摘要' },
  { id: 'C02', title: '区域产业链画像' },
  { id: 'C03', title: '岗位与人才需求' },
  { id: 'C04', title: '重点企业与合作' },
  { id: 'C05', title: '毕业生就业去向' },
  { id: 'C06', title: '专业与课程建设' },
  { id: 'C07', title: '校地协同与招商主题' },
  { id: 'C08', title: '行动清单与条件' },
  { id: 'C09', title: '证据与图表附录' },
]

/** 已安装技能的目录（供 pi --skill 直接加载）。
    本文件在 web/server/lib/ 下，仓库根需上溯三级：lib → server → web → 根 */
export function skillDir(slug: string): string {
  return join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '..',
    '.agents',
    'skills',
    slug,
  )
}
