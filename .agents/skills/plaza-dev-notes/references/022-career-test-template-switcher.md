# 022 · 就业指导开发侧测试模板切换

- **状态**：已实现（构建与测试环境浏览器交互已验证）。
- **动机**：就业指导工作台原先仅能在测试环境自动附带 Java 后端实习样例，无法快速覆盖网络运维、设备技术员和电商运营三类简历场景。
- **约定细节**：`web/src/data/careerTestTemplates.ts` 声明四套测试模板的表单值与 `demoFile`；`web/src/data/demoFiles.ts` 从 `.agents/skills/career-guidance/examples/resumes/` 直接导入三份 Markdown 样例，避免复制简历内容。`web/src/pages/UsePage.vue` 仅在 `isTestEnv() && skill.slug === 'career-guidance'` 挂载开发侧选择器；应用模板先通过 `/api/upload` 上传到新沙箱，成功后清空该技能的会话 ID、运行中的会话消息与旧附件，再替换表单和附件。生产环境不渲染该入口。
- **成本与取舍**：应用模板需要一次上传，且会开启新会话以避免跨简历上下文污染；历史运行记录不删除。采用前端测试配置而非修改后端 prompt，避免把开发侧选项暴露给生产用户或改变运行协议。
- **后续扩展路线**：如需更多场景，继续在 `careerTestTemplates.ts` 增加配置并在 `demoFiles.ts` 注册附件；已验证：测试环境页面显示四个选项；切换并应用“计算机网络技术 · 运维实习”后，表单目标岗位、地区、经历摘要和附件均替换，页面提示“新测试会话已就绪”。真实模型运行结果仍待回归。
