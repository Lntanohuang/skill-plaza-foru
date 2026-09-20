/* ============================================================
   技能注册表（引擎无关）
   ------------------------------------------------------------
   SKILL_PROMPTS 与旧 server.py 保持一致；INSTALLED_SKILLS 为
   仓库 .zcode/skills/ 下已安装真实技能的 slug，各引擎按自己的
   方式加载（zcode：Skill 工具；pi：--skill + /skill: 命令）。
   ============================================================ */

import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

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
  'training-data-qa':
    '你正在按 training-data-qa SKILL 工作。根据治理数据、任务模板和标注规则构造黄金种子、' +
    '扩增样本与难例，规划训练/验证/测试/独立评测划分，并检查 Schema、事实证据、业务规则、' +
    '重复、泄漏和分布。未经专家确认的结果只能标为候选；负责数据构造与验收，不执行模型训练。',
}

/** 已安装为真实技能的 slug（仓库 .zcode/skills/ 下） */
export const INSTALLED_SKILLS = new Set(['industry-education-report'])

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

/** 已安装技能的目录（供 pi --skill 直接加载，SKILL.md 格式两边通用）。
    本文件在 web/server/lib/ 下，仓库根需上溯三级：lib → server → web → 根 */
export function skillDir(slug: string): string {
  return join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '..',
    '.zcode',
    'skills',
    slug,
  )
}
