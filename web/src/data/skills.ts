/* ============================================================
   SKILL 广场 · 数据
   ------------------------------------------------------------
   只放事实字段。不填推测的日期、版本、评分或下载量。
   outputs / dependencies / limitations / installation 均按条目列出，
   便于在界面里逐条核对，而不是藏在句子里。
   ============================================================ */

export interface Category {
  id: string
  name: string
}

export interface Audience {
  id: string
  name: string
}

export interface Skill {
  slug: string
  name: string
  identifier: string
  categoryId: string
  audiences: string[]
  summary: string
  tags: string[]
  compatibility: string[]
  preconditions: string
  outputs: string[]
  dependencies: string[]
  limitations: string[]
  installation: string[]
  installPrompt: string
  minimalInput: string
  repository: string
  repositoryLabel: string
}

export interface Feature {
  id: string
  catId: string
  title: string
  description: string
  tags: string[]
  slug: string
}

/* 业务分类：id 同时用作语义色名（见 tokens.css 的 --cat-*） */
export const CATEGORIES: Category[] = [
  { id: 'industry', name: '产业与专业建设' },
  { id: 'teaching', name: '课程与教学开发' },
  { id: 'career', name: '实训与就业' },
  { id: 'data', name: '数据治理与模型底座' },
]

/* 适用角色 */
export const AUDIENCES: Audience[] = [
  { id: 'manager', name: '院校管理者' },
  { id: 'teacher', name: '教师' },
  { id: 'student', name: '学生' },
  { id: 'data', name: '数据团队' },
]

/* 清单最后核对日期（对应 README 验证记录） */
export const CHECKED_ON = '2026-09-15'

export const SKILLS: Skill[] = [
  {
    slug: 'industry-education-report',
    name: '产教决策报告',
    identifier: 'industry-education-report',
    categoryId: 'industry',
    audiences: ['manager', 'data'],
    summary: '面向院校、政府和园区生成有证据、可审查的产业与专业建设决策报告。',
    tags: ['产教融合', '专业建设', '决策报告'],
    compatibility: ['Codex', 'Claude Code', 'Cursor', 'WorkBuddy', '豆包'],
    preconditions: '产业 / 岗位 / 专业或就业资料',
    outputs: [
      '报告 Markdown',
      '结构化 report.json',
      '证据与口径附录',
      '结构与语义验收结果',
    ],
    dependencies: [
      '可信的产业、岗位、专业或就业资料',
      'Python 3（运行报告校验脚本时）',
    ],
    limitations: [
      '最新报告需要重新核验来源、年份、范围和统计口径。',
      '缺少院校微观数据时会保留缺口，不编造就业率、岗位缺口或招生规模。',
    ],
    installation: [
      '从公开 GitHub 仓库获取完整目录。',
      '安装时保留 SKILL.md、references、assets 和 scripts 等配套文件。',
    ],
    installPrompt:
      '请从 https://github.com/Lntanohuang/industry-education-report-skill.git 安装 industry-education-report SKILL，保留仓库完整目录，并在安装后检查依赖、说明调用方式。',
    minimalInput:
      '使用 $industry-education-report，为广东省某高职院校制作新能源汽车专业建设报告，受众为院校管理者，基期为 2024 年。',
    repository: 'https://github.com/Lntanohuang/industry-education-report-skill',
    repositoryLabel: 'Lntanohuang/industry-education-report-skill',
  },
  {
    slug: 'classroom-assistant',
    name: '课堂助教',
    identifier: 'classroom-assistant',
    categoryId: 'teaching',
    audiences: ['teacher', 'student'],
    summary: '在授权课程资料范围内完成带引用答疑、要点总结、练习生成和答疑记录整理。',
    tags: ['课程资料', '课堂练习', '引用答疑'],
    compatibility: ['Codex', 'Claude Code', 'Cursor', 'WorkBuddy', '豆包'],
    preconditions: '本次明确授权的课程材料',
    outputs: [
      '带定位引用的答疑记录',
      '课堂要点总结',
      '练习题与参考答案',
      '答疑过程清单',
    ],
    dependencies: [
      '教师明确授权并提供的课程资料',
      '需要引用时给出资料中的出处位置',
    ],
    limitations: [
      '只回答授权资料覆盖范围内的问题，范围外会明确说明。',
      '练习题在教师确认前只作为草稿，不直接计分。',
    ],
    installation: [
      '从公开 GitHub 仓库获取完整目录。',
      '安装时保留 SKILL.md、references、assets 和 examples 等配套文件。',
    ],
    installPrompt:
      '请从 https://github.com/Lntanohuang/classroom-assistant-skill.git 安装 classroom-assistant SKILL，保留仓库完整目录，并在安装后检查依赖、说明调用方式。',
    minimalInput:
      '使用 $classroom-assistant，基于我上传的《新能源汽车概论》第 3 章资料，生成 5 道课堂练习并附答案要点。',
    repository: 'https://github.com/Lntanohuang/classroom-assistant-skill',
    repositoryLabel: 'Lntanohuang/classroom-assistant-skill',
  },
  {
    slug: 'ai-interview',
    name: 'AI 面试练习',
    identifier: 'ai-interview',
    categoryId: 'career',
    audiences: ['teacher', 'student'],
    summary: '结合目标岗位、岗位要求和简历开展逐题模拟面试、智能追问与证据化复盘。',
    tags: ['模拟面试', '就业辅导', '回答复盘'],
    compatibility: ['Codex', 'Claude Code', 'Cursor', 'WorkBuddy', '豆包', 'Python'],
    preconditions: '目标岗位 + 简历或经历摘要',
    outputs: [
      '逐题问答记录（含追问链）',
      '能力维度复盘报告',
      '原话引用与待验证项清单',
      '下一轮练习建议',
    ],
    dependencies: [
      '目标岗位的职责与要求描述',
      '本人简历或经历摘要',
    ],
    limitations: [
      '复盘只基于本人提供的信息，不联网核查任职资格。',
      '不承诺面试结果，只给出证据化的改进建议。',
    ],
    installation: [
      '从公开 GitHub 仓库获取完整目录。',
      '安装时保留 SKILL.md、references、assets 和 scripts 等配套文件。',
    ],
    installPrompt:
      '请从 https://github.com/Lntanohuang/ai-interview-skill.git 安装 ai-interview SKILL，保留仓库完整目录，并在安装后检查依赖、说明调用方式。',
    minimalInput:
      '使用 $ai-interview，目标岗位为某新能源汽车企业售后技术支持，按我上传的简历逐题模拟并复盘。',
    repository: 'https://github.com/Lntanohuang/ai-interview-skill',
    repositoryLabel: 'Lntanohuang/ai-interview-skill',
  },
  {
    slug: 'training-data-qa',
    name: '训练样本构造与标注质检',
    identifier: 'training-data-qa',
    categoryId: 'data',
    audiences: ['data'],
    summary: '从治理数据构造可追溯训练样本，检查重复、泄漏、分布和业务规则并编排专家抽检。',
    tags: ['数据治理', '标注质检', '训练数据'],
    compatibility: ['Codex', 'Claude Code', 'Cursor', 'WorkBuddy', '豆包', 'Python'],
    preconditions: '治理数据、任务模板和标注规则',
    outputs: [
      '训练样本数据集（带来源标注）',
      '质检报告（重复、泄漏、分布、规则）',
      '专家抽检任务包',
      '数据集版本说明',
    ],
    dependencies: [
      '已完成治理的数据表或数据文件',
      '明确的任务模板和标注规则',
    ],
    limitations: [
      '数据授权范围由使用方确认，页面与 SKILL 不代替授权判断。',
      '统计结论基于所给数据计算，不外推到未提供的数据源。',
    ],
    installation: [
      '从公开 GitHub 仓库获取完整目录。',
      '安装时保留 SKILL.md、references、scripts 和 requirements.txt 等配套文件。',
    ],
    installPrompt:
      '请从 https://github.com/Lntanohuang/training-data-qa-skill.git 安装 training-data-qa SKILL，保留仓库完整目录，并在安装后检查依赖、说明调用方式。',
    minimalInput:
      '使用 $training-data-qa，对我提供的就业意向调查数据构造训练样本，标注字段以附带规则文件为准。',
    repository: 'https://github.com/Lntanohuang/training-data-qa-skill',
    repositoryLabel: 'Lntanohuang/training-data-qa-skill',
  },
]

/* 智能体矩阵：23 个智能体按 4 大分类归组。
   skillSlug 指向已上线的 SKILL；未上线的标 audiences 供筛选使用，卡片置灰。 */
export interface Agent {
  code: string
  name: string
  categoryId: string
  audiences: string[]
  skillSlug?: string
}

export const AGENTS: Agent[] = [
  /* 产业与专业建设 */
  { code: 'T01', name: '产业链分析与产业场景智能体', categoryId: 'industry', audiences: ['teacher', 'data'] },
  { code: 'T02', name: '产业岗位画像与学习路径智能体', categoryId: 'industry', audiences: ['teacher', 'student'] },
  { code: 'T03', name: '产教人才培养方案智能体', categoryId: 'industry', audiences: ['manager', 'teacher'] },
  { code: 'T04', name: '产教决策报告生成智能体', categoryId: 'industry', audiences: ['manager', 'data'], skillSlug: 'industry-education-report' },
  /* 课程与教学开发 */
  { code: 'T05', name: '产教课程开发智能体', categoryId: 'teaching', audiences: ['teacher'] },
  { code: 'T06', name: '智能排课智能体', categoryId: 'teaching', audiences: ['manager', 'teacher'] },
  { code: 'T07', name: '智能分班智能体', categoryId: 'teaching', audiences: ['manager', 'teacher'] },
  { code: 'T08', name: '智能课件生成智能体', categoryId: 'teaching', audiences: ['teacher'] },
  { code: 'T09', name: '课堂助教智能体', categoryId: 'teaching', audiences: ['teacher', 'student'], skillSlug: 'classroom-assistant' },
  { code: 'T10', name: '学勤与教学诊断智能体', categoryId: 'teaching', audiences: ['teacher'] },
  /* 实训与就业服务 */
  { code: 'T11', name: '学员个性化学习智能体', categoryId: 'career', audiences: ['student'] },
  { code: 'T12', name: '岗位胜任力测评智能体', categoryId: 'career', audiences: ['teacher', 'student'] },
  { code: 'T13', name: '岗位智能匹配智能体', categoryId: 'career', audiences: ['student'] },
  { code: 'T14', name: '简历优化智能体', categoryId: 'career', audiences: ['student'] },
  { code: 'T15', name: 'AI 面试智能体', categoryId: 'career', audiences: ['teacher', 'student'], skillSlug: 'ai-interview' },
  /* 数据治理与模型底座 */
  { code: 'T16', name: '数据资产治理与质量智能体', categoryId: 'data', audiences: ['data'] },
  { code: 'T17', name: 'JD 解析、聚类与统计智能体', categoryId: 'data', audiences: ['data'] },
  { code: 'T18', name: '课程资源发现与入库智能体', categoryId: 'data', audiences: ['teacher', 'data'] },
  { code: 'T19', name: '标准检索与课程合规校验智能体', categoryId: 'data', audiences: ['teacher', 'data'] },
  { code: 'T20', name: '岗位—能力—知识点—课程映射智能体', categoryId: 'data', audiences: ['teacher', 'data'] },
  { code: 'T21', name: '知识库运营与引用溯源智能体', categoryId: 'data', audiences: ['data'] },
  { code: 'T22', name: '训练样本构造与标注质检智能体', categoryId: 'data', audiences: ['data'], skillSlug: 'training-data-qa' },
  { code: 'T23', name: '模型评测与持续迭代智能体', categoryId: 'data', audiences: ['data'] },
]

export function agentsOf(categoryId: string): Agent[] {
  return AGENTS.filter(a => a.categoryId === categoryId)
}

/* 效果预览：左侧业务列表 + 右侧产物示意 */
export const FEATURES: Feature[] = [  {
    id: 'industry',
    catId: 'industry',
    title: '规划产业与专业',
    description: '让产业、岗位和专业建议回到证据与口径。',
    tags: ['产业分析', '专业建设', '证据报告'],
    slug: 'industry-education-report',
  },
  {
    id: 'teaching',
    catId: 'teaching',
    title: '开发课程与教学',
    description: '在授权课程资料内生成答疑、要点和练习。',
    tags: ['授权资料', '定位引用', '课堂练习'],
    slug: 'classroom-assistant',
  },
  {
    id: 'interview',
    catId: 'career',
    title: '组织实训与就业',
    description: '围绕目标岗位和简历完成面试练习闭环。',
    tags: ['能力地图', '逐题追问', '回答复盘'],
    slug: 'ai-interview',
  },
  {
    id: 'data',
    catId: 'data',
    title: '治理训练数据',
    description: '把样本构造、机器质检和专家抽检连成流程。',
    tags: ['数据集划分', '泄漏检查', '专家抽检'],
    slug: 'training-data-qa',
  },
]

export const bySlug = new Map(SKILLS.map(s => [s.slug, s] as const))

export function catOf(id: string): Category {
  return CATEGORIES.find(c => c.id === id) ?? { id: 'industry', name: id }
}

export function audOf(id: string): Audience {
  return AUDIENCES.find(a => a.id === id) ?? { id, name: id }
}
