#!/usr/bin/env node
/*
 * 联网检索工具（零依赖）：cn.bing 搜索（ensearch=1）+ 页面正文抓取。
 * Agent 只给查询词或 URL，不接触原始 HTML 解析细节。
 * 用法：
 *   node scripts/web-search.mjs --query "大模型 人才需求" [--count 10]
 *   node scripts/web-search.mjs --fetch "https://..." [--max-chars 6000]
 * 输出 JSON；搜索失败/无结果 ok:false。
 */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
const TIMEOUT_MS = 15_000
const MAX_COUNT = 20
const MAX_FETCH_BYTES = 2_000_000
const MAX_CHARS_CAP = 20_000

function parseArgs(argv) {
  const args = { count: 10, maxChars: 6000 }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--query') args.query = argv[++i]
    else if (argv[i] === '--fetch') args.fetch = argv[++i]
    else if (argv[i] === '--count') args.count = Number(argv[++i]) || 10
    else if (argv[i] === '--max-chars') args.maxChars = Number(argv[++i]) || 6000
  }
  return args
}

async function get(url, cookieJar) {
  const headers = { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.6', Accept: 'text/html,application/xhtml+xml' }
  if (cookieJar && cookieJar.length) headers.Cookie = cookieJar.join('; ')
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'follow' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  if (cookieJar) {
    const fresh = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
    for (const c of fresh) {
      const pair = c.split(';')[0]
      if (!cookieJar.some((x) => x.split('=')[0] === pair.split('=')[0])) cookieJar.push(pair)
    }
  }
  return res.text()
}

/** 带 cookie 引导的必应搜索：先访问首页取 cookie，可显著降低被降级为无关结果的概率 */
async function bingHtml(query, count) {
  const jar = []
  try {
    await get('https://cn.bing.com/', jar)
  } catch {
    /* 首页失败不阻断搜索 */
  }
  const params = new URLSearchParams({ q: query, count: String(count), ensearch: '1', setmkt: 'zh-CN', setlang: 'zh-hans' })
  return get(`https://cn.bing.com/search?${params}`, jar)
}

function decodeEntities(s) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', hellip: '…', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”' }
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (_, n) => named[n.toLowerCase()] ?? `&${n};`)
}

function stripTags(s) {
  return decodeEntities(String(s).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

/** bing /ck/a 重定向链接 → 真实地址（u=a1<base64url>）；解不出就保留原链接 */
function unwrapBingLink(href) {
  const raw = decodeEntities(String(href))
  const m = /[?&]u=a1([^&]+)/.exec(raw)
  if (m) {
    try {
      const dec = Buffer.from(m[1], 'base64url').toString('utf8')
      if (/^https?:\/\//.test(dec)) return dec
    } catch {
      /* 保留原链接 */
    }
  }
  return raw
}

function parseResults(html, limit) {
  const out = []
  const blocks = html.split('<li class="b_algo"').slice(1)
  for (const b of blocks) {
    const a = /<h2[^>]*><a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(b)
    if (!a) continue
    const title = stripTags(a[2])
    if (!title) continue
    let snippet = ''
    const cap = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(b)
    if (cap) snippet = stripTags(cap[1]).slice(0, 300)
    out.push({ title, url: unwrapBingLink(a[1]), snippet })
    if (out.length >= limit) break
  }
  return out
}

/** 360 搜索兜底：so.com 对自动化请求较宽容；link 重定向页里有明文真实地址 */
async function so360(query, count) {
  const params = new URLSearchParams({ q: query, rn: String(Math.min(Math.max(1, count), MAX_COUNT)) })
  const html = await get(`https://www.so.com/s?${params}`)
  const blocks = []
  const re = /<h3\s+class="res-title"><a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)(?=<h3\s+class="res-title"|$)/gi
  for (const m of html.matchAll(re)) {
    blocks.push({ rawUrl: decodeEntities(m[1]), title: stripTags(m[2]), rest: m[3] })
  }
  const out = []
  for (const b of blocks.slice(0, MAX_COUNT)) {
    let url = b.rawUrl
    if (/so\.com\/link\?m=/.test(url)) {
      try {
        const page = await get(url)
        const real = /window\.location\.replace\("([^"]+)"\)/.exec(page)?.[1]
          ?? /content="0;URL='([^']+)'"/.exec(page)?.[1]
        if (real) url = real
      } catch {
        /* 解析失败保留原链接 */
      }
    }
    const p = /<p[^>]*class="[^"]*res-desc[^"]*"[^>]*>([\s\S]*?)<\/p>/i.exec(b.rest)
    out.push({ title: b.title, url, snippet: p ? stripTags(p[1]).slice(0, 300) : '' })
  }
  return out
}

/** 查询词是否在标题/摘要里出现过——用于识别必应反爬降级（返回完全无关结果） */
function looksRelevant(query, results) {
  if (!results.length) return false
  const tokens = query.split(/[\s,，、]+/).filter((t) => t.length >= 2)
  if (!tokens.length) return true
  const hay = results.map((r) => r.title + r.snippet).join(' ')
  return tokens.some((t) => hay.includes(t))
}

async function search(query, count) {
  const capped = Math.min(Math.max(1, count), MAX_COUNT)
  let results = []
  try {
    results = parseResults(await bingHtml(query, capped), capped)
  } catch {
    /* 必应失败转 360 */
  }
  if (!looksRelevant(query, results)) {
    try {
      const alt = await so360(query, capped)
      if (alt.length) results = alt
    } catch {
      /* 360 也失败则交回必应结果（可能为空） */
    }
  }
  return results
}

async function fetchPage(url, maxChars) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('URL 无法解析')
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('仅支持 http/https')
  const res = await fetch(parsed, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.6' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const type = res.headers.get('content-type') || ''
  if (!/text\/html|text\/plain|application\/(xhtml|xml)/.test(type)) throw new Error(`不支持的内容类型：${type.split(';')[0]}`)
  const buf = Buffer.from(await res.arrayBuffer())
  const raw = buf.subarray(0, MAX_FETCH_BYTES).toString('utf8')
  const title = stripTags(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(raw)?.[1] ?? '')
  const text = stripTags(
    raw
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1\s*>/gi, ' '),
  )
  const cap = Math.min(Math.max(500, maxChars), MAX_CHARS_CAP)
  return { title, text: text.slice(0, cap), truncated: text.length > cap }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  try {
    if (args.query) {
      const results = await search(args.query, args.count)
      console.log(JSON.stringify(results.length ? { ok: true, query: args.query, engine: 'cn.bing', results } : { ok: false, query: args.query, error: '无搜索结果' }))
    } else if (args.fetch) {
      const r = await fetchPage(args.fetch, args.maxChars)
      console.log(JSON.stringify({ ok: true, url: args.fetch, ...r }))
    } else {
      console.log(JSON.stringify({ ok: false, error: '用法：--query "关键词" | --fetch "url"' }))
    }
  } catch (exc) {
    console.log(JSON.stringify({ ok: false, error: String(exc?.message || exc) }))
  }
}

main()
