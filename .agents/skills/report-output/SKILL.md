---
name: report-output
description: 通用报告输出指导：根据业务 Skill 声明生成 text、HTML、Markdown、PDF、DOC/DOCX 或 JSON 产物，并用统一 Artifact 清单记录状态。
---

# 通用报告输出

本 Skill 负责输出产物的声明、文件边界、状态和交付；不负责业务分析，也不决定报告章节。业务 Skill 决定需要哪些产物，本 Skill 负责按当前运行环境支持的能力完成它们。

## 输出需求与输出结果

业务 Skill 声明“需要什么”，Agent/运行时最终登记“实际生成了什么”。两者都使用 Artifact 协议，但结果必须诚实反映失败、缺失和部分成功。

常见产物类型：

- `text`：直接回复用户；
- `html`：用户可查看的独立报告；
- `markdown`：可编辑文本源；
- `pdf`：固定版式交付物；
- `docx` / `doc`：可编辑 Word 交付物；
- `json`：机器校验或开发侧数据；
- `image` / `zip`：业务明确要求时使用。

不要为了统一而强制所有报告输出相同格式。只生成业务声明的产物。

## 当前工作区文件约定

HTML 报告 Skill 将用户报告写入当前 workspace 根目录的 `report.html`。需要结构化产物时写入 `report.artifact.json`。不要把完整 HTML、JSON 或二进制文件复制到最终对话回复。

`report.artifact.json` 使用 [Artifact 协议](references/artifact-protocol.md)，只保存产物清单和证据关系，不嵌入完整 HTML/SVG/PDF 内容。

## 交付规则

1. 先按业务 Skill 声明产物清单。
2. 文件写入固定 workspace 路径，不伪造 URL，不使用 workspace 外路径。
3. 生成后做最小存在性、格式和引用校验。
4. 用户回复只说明可交付产物和失败原因；内部证据、校验错误和 trace 进入结构化运行记录。
5. 一个产物失败不自动掩盖其他已成功产物，使用 `partial` 或 `failed` 状态明确表达。

## 不在本阶段实现的内容

本协议本次不新增雷达图、桑基图，也不要求现有 `tech-forecast` 迁移到新协议。旧 `report-meta` 和 `industry-education-report` 产物继续兼容。
