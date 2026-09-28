/*
 * mysql 客户端选择工具：Homebrew mysql 9.x 移除了 mysql_native_password 插件，
 * 连岗位库（5.7 侧握手）会报 ERROR 2059 Authentication plugin ... cannot be loaded。
 * 这里在默认客户端失败时回落到本机 8.x 客户端；MYSQL_BIN 显式指定时不回退。
 */
import { existsSync } from 'node:fs'

const FALLBACK_BINS = [
  '/opt/homebrew/opt/mysql@8.4/bin/mysql',
  '/usr/local/opt/mysql@8.4/bin/mysql',
  '/opt/homebrew/opt/mysql-client@8.4/bin/mysql',
  '/opt/homebrew/opt/mysql-client/bin/mysql',
]

export function isAuthPluginError(text) {
  const value = String(text || '')
  return value.includes('mysql_native_password') || value.includes('Authentication plugin')
}

export function mysqlBinCandidates(explicitBin) {
  const primary = explicitBin || process.env.MYSQL_BIN || 'mysql'
  const list = [primary]
  if (process.env.MYSQL_BIN || (explicitBin && explicitBin !== 'mysql')) return list
  for (const bin of FALLBACK_BINS) if (!list.includes(bin) && existsSync(bin)) list.push(bin)
  return list
}
