import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  normalizeLegacyHtmlDocument,
  readWorkspaceHtmlReport,
  validateCompleteHtmlReport,
  validateHtmlReport,
} from './htmlReport.ts'

const validHeatmap = `<!doctype html><html><body>
  <figure data-chart-skill="heatmap-chart" data-chart-id="CH_CITY">
    <svg viewBox="0 0 10 10"><title>广东省内城市分布</title><desc>岗位库记录分布</desc>
      <path data-adcode="440100" fill="#0ea5e9" d="M0 0h1v1H0z" />
    </svg>
    <figcaption>来源：岗位库；快照日期：2026-09-29；岗位记录分布，不是实际就业人数。</figcaption>
  </figure>
</body></html>`

const completeHeatmap = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>报告</title></head><body>${validHeatmap.replace('<!doctype html><html><body>', '').replace('</body></html>', '')}</body></html>`

test('accepts a complete report document with an accessible CH_CITY heatmap', () => {
  const result = validateCompleteHtmlReport(completeHeatmap)
  assert.equal(result.pass, true)
})

test('accepts a CH_CITY heatmap figure with accessible SVG metadata', () => {
  const result = validateHtmlReport(validHeatmap)
  assert.equal(result.pass, true)
  assert.equal(result.heatmap.status, 'present')
  assert.equal(result.heatmap.figureCount, 1)
  assert.deepEqual(result.figures, [{ chartSkill: 'heatmap-chart', chartId: 'CH_CITY' }])
})

test('rejects a heatmap with a non-CH_CITY id', () => {
  const result = validateHtmlReport(validHeatmap.replace('CH_CITY', 'CH1'))
  assert.equal(result.pass, false)
  assert.match(result.errors.join('\n'), /CH_CITY/)
})

test('records an unassessed heatmap and its failure reason', () => {
  const result = validateHtmlReport(
    '<h3>岗位在招城市分布热点图：未评估</h3><p>跨城市查询超时，未获得广东省内城市结果。</p>',
  )
  assert.equal(result.pass, true)
  assert.equal(result.heatmap.status, 'unassessed')
  assert.match(result.heatmap.failureReason ?? '', /跨城市查询超时/)
})

test('allows an unassessed heatmap status block without SVG geometry', () => {
  const result = validateHtmlReport(
    '<figure data-chart-skill="heatmap-chart" data-chart-id="CH_CITY" data-chart-status="unassessed">' +
      '<figcaption>热点图未评估：city-distribution 查询超时。</figcaption>' +
      '</figure>',
  )
  assert.equal(result.pass, true)
  assert.equal(result.heatmap.status, 'unassessed')
  assert.match(result.heatmap.failureReason ?? '', /city-distribution 查询超时/)
})

test('flags a failed city-distribution query when the report silently omits the status', () => {
  const result = validateHtmlReport('<p>city-distribution 查询失败：数据库超时。</p>')
  assert.equal(result.pass, false)
  assert.match(result.errors.join('\n'), /热点图未评估/)
})

test('allows a report without a China heatmap when no failure is claimed', () => {
  const result = validateHtmlReport('<h2>岗位需求分析</h2><p>目标地点：新加坡。</p>')
  assert.equal(result.pass, true)
  assert.equal(result.heatmap.status, 'omitted')
  assert.equal(result.errors.length, 0)
  assert.ok(result.warnings.length > 0)
})

test('does not turn a short completion status into a legacy report', () => {
  assert.equal(normalizeLegacyHtmlDocument('报告已生成，请点击查看。'), null)
})

test('normalizes a legacy HTML fragment for compatibility', () => {
  const html = normalizeLegacyHtmlDocument('<h1>岗位匹配</h1><figure data-chart-skill="bar-chart"><svg><title>岗位排名</title></svg></figure>')
  assert.match(html ?? '', /^<!doctype html>/i)
  assert.match(html ?? '', /<html[\s>]/i)
})

test('reads only the fixed workspace report and rejects a symlink escape', () => {
  const root = mkdtempSync(join(tmpdir(), 'career-report-'))
  const outside = mkdtempSync(join(tmpdir(), 'career-report-outside-'))
  try {
    writeFileSync(join(root, 'report.html'), completeHeatmap)
    assert.equal(readWorkspaceHtmlReport(root).found, true)
    rmSync(join(root, 'report.html'))
    writeFileSync(join(outside, 'report.html'), completeHeatmap)
    symlinkSync(join(outside, 'report.html'), join(root, 'report.html'))
    const result = readWorkspaceHtmlReport(root)
    assert.equal(result.found, false)
    assert.match(result.error ?? '', /工作区之外/)
  } finally {
    rmSync(root, { recursive: true, force: true })
    rmSync(outside, { recursive: true, force: true })
  }
})
