/* ============================================================
   报告文本解析器（MVP 直出模式的轻量结构校验）
   ------------------------------------------------------------
   输入：run 的最终回复全文（报告 Markdown）。
   产出：章节切分 / 来源提取 / 分级计数 / 期望章节完整性校验。
   替代原技能 python validate 的最低限度检查；flash 漏章节时
   structurePass=false + missingSections 直接暴露。
   ============================================================ */

import { REPORT_SECTIONS } from './skills.ts'

export interface ReportStats {
  sections: number
  facts: number
  inferences: number
  recommendations: number
  gaps: number
  sources: number
  chars: number
}

export interface ReportParseResult {
  structurePass: boolean
  missingSections: string[]
  sections: Array<{ id?: string; title: string; level: number; chars: number }>
  sources: Array<{ id: string; url: string; cited: number }>
  stats: ReportStats
}

function countMatches(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length
}

/** 解析报告全文；空文本返回 null */
export function parseReport(
  text: string,
  expected: Array<{ id: string; title: string }> = REPORT_SECTIONS,
): ReportParseResult | null {
  if (!text || !text.trim()) return null

  /* 章节：按 Markdown 标题切分（# ~ ####），统计各节正文字数 */
  const lines = text.split('\n')
  const sections: ReportParseResult['sections'] = []
  let current: ReportParseResult['sections'][number] | null = null
  for (const line of lines) {
    const m = /^(#{1,4})\s+(.+?)\s*$/.exec(line)
    if (m) {
      current = { title: m[2], level: m[1].length, chars: 0 }
      sections.push(current)
    } else if (current) {
      current.chars += line.length
    }
  }

  /* 期望章节：标题互相包含即算命中（模型可能在标题前后加限定词） */
  const titles = sections.map(s => s.title)
  const missingSections = expected
    .filter(e => !titles.some(t => t.includes(e.title) || e.title.includes(t)))
    .map(e => `${e.id} ${e.title}`)

  /* 来源：[S1](https://...) 形态的证据引用按编号聚合；
     模型未必用行内链接（附录表/纯 URL 也常见），以全文唯一 URL 兜底去重 */
  const srcMap = new Map<string, { id: string; url: string; cited: number }>()
  for (const m of text.matchAll(/\[S(\d+)\]\((https?:\/\/[^)\s]+)\)/g)) {
    const id = `S${m[1]}`
    const hit = srcMap.get(id)
    if (hit) hit.cited++
    else srcMap.set(id, { id, url: m[2], cited: 1 })
  }
  let uSeq = 0
  const seenUrls = new Set([...srcMap.values()].map(s => s.url))
  for (const m of text.matchAll(/https?:\/\/[^\s)\]'"，。、；]+/g)) {
    if (seenUrls.has(m[0])) continue
    seenUrls.add(m[0])
    srcMap.set(`U${++uSeq}`, { id: `U${uSeq}`, url: m[0], cited: 1 })
  }
  const sources = [...srcMap.values()]

  /* 分级计数：技能约定的「X1 · fact/inference/recommendation/数据缺口」标记 */
  const stats: ReportStats = {
    sections: sections.length,
    facts: countMatches(text, /·\s*fact\b/gi),
    inferences: countMatches(text, /·\s*inference\b/gi),
    recommendations: countMatches(text, /·\s*recommendation\b/gi),
    gaps: countMatches(text, /·\s*数据缺口/g),
    sources: sources.length,
    chars: text.length,
  }

  return {
    structurePass: missingSections.length === 0,
    missingSections,
    sections,
    sources,
    stats,
  }
}
