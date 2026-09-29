import { configOf, type UseTaskConfig } from './useTaskConfigs'

export interface CareerTestTemplate {
  id: string
  label: string
  demoFile: string
  values: UseTaskConfig['example']
}

/** 开发侧合成测试材料；简历原文从 examples/resumes 导入，不复制维护。 */
export const CAREER_TEST_TEMPLATES: CareerTestTemplate[] = [
  { id: 'java', label: 'Java 后端实习', demoFile: 'resume', values: configOf('career-guidance')!.example },
  {
    id: 'network', label: '计算机网络技术 · 运维实习', demoFile: 'networkResume',
    values: {
      goal: 'IT 技术支持 / 网络运维实习生', stage: '在校找实习', task: '岗位匹配', region: '广州、佛山', time: '',
      context: '2026 届计算机网络技术专业高职在校生；完成校园机房 VLAN、Trunk、DHCP、ACL 配置实训及 Flask 报修工单课程项目，会 Linux 基础命令和简单 Bash/Python 脚本。暂无企业实习经历，每周可实习 4 天、连续 4–6 个月，接受轮班；缺少真实工单、监控和值班经验。证书及项目验收数据待核验，每周求职准备时间待确认。',
    },
  },
  {
    id: 'equipment', label: '机电一体化 · 设备技术员', demoFile: 'equipmentResume',
    values: {
      goal: '设备技术员 / PLC 助理工程师', stage: '在校找实习', task: '岗位匹配', region: '东莞、惠州', time: '',
      context: '2026 届机电一体化技术专业高职在校生；完成 S7-1200 PLC 传送带分拣控制实训及三轴机械臂维护训练，会 TIA Portal 基础编程、AutoCAD 和点检记录。暂无企业实习，可参加 4 个月以上顶岗实习，接受车间环境和倒班；夜班、噪声、粉尘接受度待确认。低压电工证计划报考，CAD 证书待核验，不能独立调试整线；每周求职准备时间待确认。',
    },
  },
  {
    id: 'commerce', label: '电子商务 · 运营实习', demoFile: 'commerceResume',
    values: {
      goal: '电商运营 / 内容运营实习生', stage: '在校找实习', task: '岗位匹配', region: '深圳、东莞', time: '',
      context: '2026 届电子商务专业高职在校生；参与校园文创店铺商品信息、内容排期及客服话术整理，完成短视频脚本、剪辑和 Excel 数据复盘。每周可实习 4–5 天，接受直播间晚间排班，优先商品运营、内容执行或直播助理。缺少企业后台、广告投放和供应链协作经验，成交额与转化率未统一留档，证书及账号数据待核验；每周求职准备时间待确认。',
    },
  },
]
