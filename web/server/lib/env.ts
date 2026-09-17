/* web/.env 本地配置加载（模板见 .env.example，不进仓库）。
   Node 内置解析，保持零第三方依赖；外部环境变量优先于 .env 文件 */
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export function loadLocalEnv(): void {
  try {
    process.loadEnvFile(join(dirname(fileURLToPath(import.meta.url)), '../../.env'))
  } catch {
    /* 无 .env 文件时仅用进程环境变量 */
  }
}
