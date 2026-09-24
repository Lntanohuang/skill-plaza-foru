/* ============================================================
   Agent 版本与环境探测
   ------------------------------------------------------------
   运行记录需要「当时的 Agent 版本与环境」：CLI 版本用
   spawnSync --version 探测（失败回落 bin 旁 package.json），
   按引擎进程内缓存——服务生命周期内 CLI 不会变。全部尽力
   而为：探测失败返回 undefined，绝不影响主流程。
   ============================================================ */

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { arch, platform } from 'node:os'
import type { AgentEnvInfo } from './traceExport.ts'
import type { ZcodeCli } from './zcodeCli.ts'

const VERSION_RE = /(\d+\.\d+[\w.\-+]*)/

/** 从命令输出提取第一个版本号（如 "pi 0.85.1" → "0.85.1"） */
function parseVersion(out: string): string | undefined {
  return VERSION_RE.exec(out)?.[1]
}

/** 执行 `<cli> --version` 取版本；超时/非零退出/无版本号 → undefined */
function versionByFlag(command: string, args: string[], shell = false): string | undefined {
  try {
    const r = spawnSync(command, args, { encoding: 'utf8', timeout: 5_000, ...(shell ? { shell: true } : {}) })
    if (r.status !== 0 && !r.stdout) return undefined
    return parseVersion(`${r.stdout || ''} ${r.stderr || ''}`)
  } catch {
    return undefined
  }
}

/** npm bin（多为符号链接）→ 向上找包目录的 package.json 读 version */
function versionByPackageJson(cliPath: string): string | undefined {
  try {
    for (let dir = dirname(realpathSync(cliPath)), hops = 0; hops < 3; hops++, dir = dirname(dir)) {
      const pkg = join(dir, 'package.json')
      if (!existsSync(pkg)) continue
      const version = JSON.parse(readFileSync(pkg, 'utf8'))?.version
      if (typeof version === 'string' && version) return version
    }
  } catch {
    /* 回落链末端，放弃 */
  }
  return undefined
}

/* 进程内缓存：首次探测后不再 spawn */
const cache = new Map<string, string | undefined>()

export function piCliVersion(cli: string | null): string | undefined {
  if (!cli) return undefined
  const key = `pi:${cli}`
  if (!cache.has(key)) cache.set(key, versionByFlag(cli, ['--version']) ?? versionByPackageJson(cli))
  return cache.get(key)
}

export function zcodeCliVersion(cli: ZcodeCli): string | undefined {
  const key = `zcode:${cli.path}:${cli.mode}`
  if (!cache.has(key)) {
    const v =
      cli.mode === 'node'
        ? versionByFlag(process.execPath, [cli.path, '--version'])
        : versionByFlag(cli.path, ['--version'], cli.mode === 'shell')
    cache.set(key, v ?? versionByPackageJson(cli.path))
  }
  return cache.get(key)
}

/** 服务端运行环境（每次运行随 agentEnv 落盘） */
export function serverEnv(): Pick<AgentEnvInfo, 'node' | 'os'> {
  return { node: process.version, os: `${platform()} ${arch()}` }
}
