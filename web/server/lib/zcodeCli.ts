/* zcode CLI 跨平台定位：ZCODE_CLI 配置 → 各平台常见安装位置 → PATH 扫描。
   零依赖；找不到时由调用方给出配置指引 */
import { existsSync, accessSync, constants } from 'node:fs'
import { join, delimiter, extname } from 'node:path'
import { homedir } from 'node:os'
import { loadLocalEnv } from './env.ts'

export interface ZcodeCli {
  path: string
  /** node = 用当前 node 运行脚本；direct = 直接 spawn；shell = Windows 脚本需 shell */
  mode: 'node' | 'direct' | 'shell'
  /** 找到的方式，写进启动日志与 detect:cli 输出便于排查 */
  source: string
}

const expand = (p: string) => (p.startsWith('~/') ? join(homedir(), p.slice(2)) : p)

const isExecutable = (p: string) => {
  try {
    accessSync(p, constants.X_OK)
    return true
  } catch {
    return false
  }
}

function modeFor(p: string): ZcodeCli['mode'] {
  const ext = extname(p).toLowerCase()
  if (ext === '.cjs' || ext === '.js' || ext === '.mjs') return 'node'
  if (process.platform === 'win32' && (ext === '.cmd' || ext === '.bat' || ext === '.ps1'))
    return 'shell'
  return 'direct'
}

/** 各平台桌面 App 的常见安装位置（尽力匹配，布局随版本可能变化）；~/.zcode/cli 兜底 */
export function wellKnownLocations(): string[] {
  const nextToConfig = ['~/.zcode/cli/zcode.cjs']
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')
    const pf = process.env.PROGRAMFILES || 'C:\\Program Files'
    return [
      join(local, 'Programs', 'ZCode', 'resources', 'glm', 'zcode.cjs'),
      join(pf, 'ZCode', 'resources', 'glm', 'zcode.cjs'),
      ...nextToConfig,
    ]
  }
  if (process.platform === 'darwin') {
    return [
      '/Applications/ZCode.app/Contents/Resources/glm/zcode.cjs',
      '~/Applications/ZCode.app/Contents/Resources/glm/zcode.cjs',
      ...nextToConfig,
    ]
  }
  return [
    '/opt/ZCode/resources/glm/zcode.cjs',
    '/usr/local/zcode/zcode.cjs',
    join(homedir(), '.local/share/ZCode/resources/glm/zcode.cjs'),
    ...nextToConfig,
  ]
}

function fromPath(): ZcodeCli | null {
  const names =
    process.platform === 'win32'
      ? ['zcode.cmd', 'zcode.exe', 'zcode.cjs', 'zcode.ps1', 'zcode']
      : ['zcode', 'zcode.cjs']
  for (const dir of (process.env.PATH || '').split(delimiter)) {
    if (!dir) continue
    for (const name of names) {
      const p = join(dir, name)
      if (existsSync(p) && isExecutable(p))
        return { path: p, mode: modeFor(p), source: `PATH（${dir}）` }
    }
  }
  return null
}

/** 解析 zcode CLI；会先加载 web/.env（外部环境变量优先于文件） */
export function resolveZcodeCli(): ZcodeCli | null {
  loadLocalEnv()
  const fromEnv = process.env.ZCODE_CLI?.trim()
  if (fromEnv) return { path: fromEnv, mode: modeFor(fromEnv), source: 'ZCODE_CLI 配置' }
  for (const c of wellKnownLocations()) {
    const p = expand(c)
    if (existsSync(p)) return { path: p, mode: modeFor(p), source: `已知安装位置` }
  }
  return fromPath()
}
