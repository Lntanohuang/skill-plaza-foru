import MarkdownIt from 'markdown-it'

// html:false —— 源文本里的 HTML 一律转义，v-html 注入安全，无需 DOMPurify
const md = new MarkdownIt({ html: false, linkify: true })

// 渲染出的链接统一新窗口打开
const defaultLinkOpen =
  md.renderer.rules.link_open ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  tokens[idx].attrSet('target', '_blank')
  tokens[idx].attrSet('rel', 'noopener noreferrer')
  return defaultLinkOpen(tokens, idx, options, env, self)
}

export function renderMd(text: string): string {
  return text ? md.render(text) : ''
}
