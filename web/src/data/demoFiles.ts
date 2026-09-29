/* ============================================================
   内置演示附件（一键测试）
   ------------------------------------------------------------
   内容直接从仓库 test-data/ 原文件导入（单一数据源），
   进入声明了 demoFile 的工作台时自动上传并挂到附件区，
   可随时移除换成自己的文件。
   ============================================================ */

import networkResume from '../../../.agents/skills/career-guidance/examples/resumes/01-计算机网络技术-运维实习.md?raw'
import equipmentResume from '../../../.agents/skills/career-guidance/examples/resumes/02-机电一体化-设备技术员.md?raw'
import commerceResume from '../../../.agents/skills/career-guidance/examples/resumes/03-电子商务-运营实习.md?raw'
import resume from '../../../test-data/测试简历-Java后端实习.md?raw'

export interface DemoFile {
  filename: string
  content: string
}

export const DEMO_FILES: Record<string, DemoFile> = {
  networkResume: { filename: '01-计算机网络技术-运维实习.md', content: networkResume },
  equipmentResume: { filename: '02-机电一体化-设备技术员.md', content: equipmentResume },
  commerceResume: { filename: '03-电子商务-运营实习.md', content: commerceResume },
  resume: { filename: '测试简历-Java后端实习.md', content: resume },
}
