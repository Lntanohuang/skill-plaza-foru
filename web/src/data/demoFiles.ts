/* ============================================================
   内置演示附件（一键测试）
   ------------------------------------------------------------
   内容直接从仓库 test-data/ 原文件导入（单一数据源），
   进入声明了 demoFile 的工作台时自动上传并挂到附件区，
   可随时移除换成自己的文件。
   ============================================================ */

import resume from '../../../test-data/测试简历-Java后端实习.md?raw'

export interface DemoFile {
  filename: string
  content: string
}

export const DEMO_FILES: Record<string, DemoFile> = {
  resume: { filename: '测试简历-Java后端实习.md', content: resume },
}
