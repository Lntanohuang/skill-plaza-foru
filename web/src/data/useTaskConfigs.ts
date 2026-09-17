/* ============================================================
   「在线运行」工作台 · 任务配置
   ------------------------------------------------------------
   每个 SKILL 一份结构化任务表单：分节 + 字段（单选/多选/下拉/输入/文本域）
   + 填表示例 + 可选知识库（当前为 Mock，仅演示前端状态）。
   字段只描述"要让 SKILL 知道什么"，不在前端推断模型行为。
   ============================================================ */

export type FieldType = 'choice' | 'multi' | 'select' | 'text' | 'textarea'

export interface TaskField {
  id: string
  label: string
  type: FieldType
  required?: boolean
  span?: 'full'
  placeholder?: string
  help?: string
  options?: string[]
}

export interface TaskSection {
  number: string
  title: string
  description: string
  fields: TaskField[]
}

export interface KnowledgeItem {
  id: string
  title: string
  meta: string
  tag: string
  default?: boolean
}

export interface UseTaskConfig {
  slug: string
  eyebrow: string
  lead: string
  output: string
  sections: TaskSection[]
  example: Record<string, string | string[]>
  knowledge: KnowledgeItem[]
}

export const USE_TASK_CONFIGS: UseTaskConfig[] = [
  {
    slug: 'industry-education-report',
    eyebrow: '产业研究工作台',
    lead: '填写报告对象与研究边界，组合所需专题，再从右侧选择可参考的知识库。',
    output: '产业与专业建设决策报告',
    sections: [
      {
        number: '01',
        title: '确定报告边界',
        description: '先明确服务对象、研究地区与时间口径。',
        fields: [
          { id: 'audience', label: '服务对象', type: 'choice', required: true, options: ['院校管理者', '政府部门', '产业园区'] },
          { id: 'region', label: '目标地区', type: 'text', required: true, placeholder: '例如：广东省佛山市' },
          { id: 'baseline', label: '报告基期', type: 'select', required: true, options: ['2026 年', '2025 年', '2024 年', '2023 年'] },
          { id: 'purpose', label: '报告用途', type: 'select', required: true, options: ['专业建设与调整', '区域产教融合规划', '产业招商与人才研判', '项目申报与评审'] },
        ],
      },
      {
        number: '02',
        title: '选择研究专题',
        description: '可多选；SKILL 会按选择组织报告章节与证据清单。',
        fields: [
          { id: 'topics', label: '重点专题', type: 'multi', required: true, span: 'full', options: ['区域产业链', '岗位人才需求', '重点企业', '专业与课程', '就业去向', '招商建议'] },
          { id: 'context', label: '已有材料或特别要求', type: 'textarea', span: 'full', placeholder: '例如：已有学校专业目录，希望重点比较新能源汽车与智能网联方向……', help: '可以先写资料名称，后续再补充附件。' },
        ],
      },
    ],
    example: {
      audience: '院校管理者',
      region: '广东省佛山市',
      baseline: '2024 年',
      purpose: '专业建设与调整',
      topics: ['区域产业链', '岗位人才需求', '专业与课程', '就业去向'],
      context: '为某高职院校论证新能源汽车专业建设方向，结论需要区分事实、推断和建议。',
    },
    knowledge: [
      { id: 'industry-policy', title: '区域产业政策资料库', meta: '政策与规划 · 38 份', tag: '政策', default: true },
      { id: 'job-market', title: '重点产业岗位需求库', meta: '招聘与岗位画像 · 12,680 条', tag: '岗位', default: true },
      { id: 'major-course', title: '院校专业与课程库', meta: '专业目录与课程样本 · 216 份', tag: '院校' },
      { id: 'employment-flow', title: '毕业生就业去向库', meta: '匿名统计样例 · 8 个数据集', tag: '就业' },
    ],
  },
  {
    slug: 'classroom-assistant',
    eyebrow: '课程教学工作台',
    lead: '用结构化选项说明课程、对象和教学任务，再限定本次允许引用的知识范围。',
    output: '课堂材料与带引用教学内容',
    sections: [
      {
        number: '01',
        title: '设置教学任务',
        description: '选择课程场景与本次希望完成的工作。',
        fields: [
          { id: 'course', label: '课程名称', type: 'text', required: true, placeholder: '例如：人工智能导论' },
          { id: 'learners', label: '授课对象', type: 'select', required: true, options: ['高职一年级', '高职二年级', '本科低年级', '本科高年级', '职业培训学员'] },
          { id: 'task', label: '任务类型', type: 'choice', required: true, span: 'full', options: ['课程答疑', '要点总结', '生成练习', '整理答疑记录'] },
        ],
      },
      {
        number: '02',
        title: '定义输出要求',
        description: '设置内容规模与教学侧重点。',
        fields: [
          { id: 'amount', label: '内容数量', type: 'select', required: true, options: ['3 项', '5 项', '8 项', '10 项'] },
          { id: 'difficulty', label: '难度', type: 'choice', required: true, options: ['基础', '进阶', '综合'] },
          { id: 'focus', label: '教学侧重点', type: 'multi', span: 'full', options: ['概念理解', '案例分析', '操作实践', '课堂互动', '考核复习'] },
          { id: 'context', label: '补充说明', type: 'textarea', span: 'full', placeholder: '例如：需要附参考答案，并标出引用所在章节……' },
        ],
      },
    ],
    example: {
      course: '人工智能导论',
      learners: '高职一年级',
      task: '生成练习',
      amount: '3 项',
      difficulty: '基础',
      focus: ['概念理解', '案例分析'],
      context: '基于第 1 章生成课堂练习，附参考答案和资料定位引用。',
    },
    knowledge: [
      { id: 'course-textbook', title: '《人工智能导论》课程资料', meta: '讲义、课件与章节索引 · 24 份', tag: '课程', default: true },
      { id: 'teaching-plan', title: '课程标准与授课计划', meta: '教学目标与周次安排 · 6 份', tag: '标准', default: true },
      { id: 'exercise-bank', title: '课堂练习样例库', meta: '已审核练习 · 186 题', tag: '题库' },
      { id: 'faq-records', title: '历史课堂答疑记录', meta: '匿名问答 · 92 条', tag: '答疑' },
    ],
  },
  {
    slug: 'ai-interview',
    eyebrow: '模拟面试工作台',
    lead: '补充目标岗位与练习方式，让每轮提问都围绕岗位要求和真实经历展开。',
    output: '交互式模拟面试与证据化复盘',
    sections: [
      {
        number: '01',
        title: '设置目标岗位',
        description: '岗位信息越具体，问题和追问越贴近真实场景。',
        fields: [
          { id: 'role', label: '目标岗位', type: 'text', required: true, placeholder: '例如：Java 后端实习生' },
          { id: 'stage', label: '求职阶段', type: 'select', required: true, options: ['实习', '校招', '社招转岗', '升职竞聘'] },
          { id: 'mode', label: '练习模式', type: 'choice', required: true, span: 'full', options: ['完整模拟', '专项突破', '压力追问'] },
        ],
      },
      {
        number: '02',
        title: '配置面试节奏',
        description: '选择题量和希望重点观察的能力。',
        fields: [
          { id: 'questions', label: '基础题量', type: 'choice', required: true, options: ['3 题', '5 题', '8 题'] },
          { id: 'language', label: '面试语言', type: 'select', required: true, options: ['中文', '中英混合', '英文'] },
          { id: 'focus', label: '重点能力', type: 'multi', span: 'full', options: ['专业基础', '项目经历', '问题解决', '沟通表达', '职业动机', '压力应对'] },
          { id: 'resume', label: '匿名经历摘要', type: 'textarea', required: true, span: 'full', placeholder: '简述教育背景、项目和实习经历；请删除姓名、电话等敏感信息。' },
        ],
      },
    ],
    example: {
      role: 'Java 后端实习生',
      stage: '实习',
      mode: '完整模拟',
      questions: '3 题',
      language: '中文',
      focus: ['专业基础', '项目经历', '问题解决'],
      resume: '计算机相关专业，完成过 Spring Boot 校园二手交易平台项目，负责接口设计与 MySQL 数据建模。',
    },
    knowledge: [
      { id: 'role-competency', title: '数字技术岗位能力库', meta: '岗位能力模型 · 42 类', tag: '岗位', default: true },
      { id: 'interview-rubric', title: '结构化面试评价标准', meta: '评分维度与行为锚点 · 18 份', tag: '评价', default: true },
      { id: 'question-bank', title: '企业面试题样例库', meta: '匿名真题与追问 · 326 题', tag: '题库' },
      { id: 'resume-evidence', title: '简历证据识别规则', meta: '项目与经历核验规则 · 12 份', tag: '规则' },
    ],
  },
  {
    slug: 'training-data-qa',
    eyebrow: '数据治理工作台',
    lead: '描述数据任务、规模与验收重点，再选择标注规范和业务规则知识库。',
    output: '训练样本、质检报告与抽检任务',
    sections: [
      {
        number: '01',
        title: '定义数据任务',
        description: '说明数据用途和预期处理规模。',
        fields: [
          { id: 'task', label: '任务类型', type: 'select', required: true, options: ['文本分类', '信息抽取', '问答生成', '对话指令', '多轮对话'] },
          { id: 'amount', label: '目标样本量', type: 'text', required: true, placeholder: '例如：200 条' },
          { id: 'stage', label: '当前阶段', type: 'choice', required: true, span: 'full', options: ['黄金种子', '批量扩增', '标注验收', '版本封存'] },
        ],
      },
      {
        number: '02',
        title: '配置质量检查',
        description: '选择数据划分和本轮必须通过的质量门禁。',
        fields: [
          { id: 'split', label: '数据集划分', type: 'select', required: true, options: ['80 / 10 / 10', '70 / 15 / 15', '自定义划分', '仅独立评测集'] },
          { id: 'format', label: '交付格式', type: 'choice', required: true, options: ['JSONL', 'JSON', 'CSV'] },
          { id: 'checks', label: '质检项目', type: 'multi', required: true, span: 'full', options: ['Schema', '事实证据', '业务规则', '重复样本', '数据泄漏', '分布偏差'] },
          { id: 'schema', label: '字段与标注说明', type: 'textarea', required: true, span: 'full', placeholder: '例如：input 为用户问题，output 为标准答复，category 为一级意图标签……' },
        ],
      },
    ],
    example: {
      task: '问答生成',
      amount: '200 条',
      stage: '黄金种子',
      split: '80 / 10 / 10',
      format: 'JSONL',
      checks: ['Schema', '事实证据', '重复样本', '数据泄漏', '分布偏差'],
      schema: '基于客服问答数据构造候选黄金种子；input 为问题，output 为答复，category 为业务意图。',
    },
    knowledge: [
      { id: 'annotation-schema', title: '标注 Schema 与字段字典', meta: '字段定义与示例 · 16 份', tag: 'Schema', default: true },
      { id: 'business-rules', title: '业务规则与禁答边界', meta: '规则条目 · 286 条', tag: '规则', default: true },
      { id: 'golden-examples', title: '已验收黄金样本库', meta: '专家确认样本 · 1,240 条', tag: '样本' },
      { id: 'qa-rubric', title: '数据质检验收标准', meta: '门禁与抽检规范 · 9 份', tag: '质检' },
    ],
  },
]

export const configOf = (slug: string): UseTaskConfig | undefined =>
  USE_TASK_CONFIGS.find(item => item.slug === slug)
