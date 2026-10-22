import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readWorkspaceArtifact, validateArtifact } from './artifact.ts'

const validArtifact = {
  schema: 'artifact/1',
  kind: 'report',
  status: 'complete',
  title: '就业指导报告',
  outputs: [
    { id: 'user-report', type: 'html', audience: 'user', required: true, status: 'complete', path: 'report.html' },
    { id: 'evidence', type: 'json', audience: 'system', required: true, status: 'complete', path: 'report.artifact.json' },
  ],
  sources: [{ id: 'S1', title: '岗位库快照', kind: 'database' }],
  metrics: [{ id: 'M1', label: '岗位占比', value: 42, unit: '%', sourceIds: ['S1'] }],
  claims: [{ id: 'C1', kind: 'fact', text: '岗位占比为 42%。', metricIds: ['M1'] }],
  evidence: [],
  gaps: [],
}

test('validates artifact/1 and its source references', () => {
  const result = validateArtifact(validArtifact)
  assert.equal(result.pass, true)
  assert.deepEqual(result.counts, { outputs: 2, sources: 1, metrics: 1, claims: 1, evidence: 0, gaps: 0 })
})

test('rejects missing source references and unsafe output paths', () => {
  const result = validateArtifact({
    ...validArtifact,
    outputs: [{ id: 'bad', type: 'json', audience: 'system', status: 'complete', path: '../secret.json' }],
    metrics: [{ id: 'M1', label: 'x', value: 1, sourceIds: ['missing'] }],
  })
  assert.equal(result.pass, false)
  assert.match(result.errors.join('\n'), /workspace|不存在的 id/)
})

test('reads the fixed workspace artifact file', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'plaza-artifact-'))
  try {
    writeFileSync(join(workspace, 'report.artifact.json'), JSON.stringify(validArtifact))
    const result = readWorkspaceArtifact(workspace)
    assert.equal(result.error, undefined)
    assert.deepEqual(result.document?.schema, 'artifact/1')
    assert.ok(result.raw)
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
})
