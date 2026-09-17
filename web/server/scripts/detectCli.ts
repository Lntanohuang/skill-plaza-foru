#!/usr/bin/env node
/* 环境自检：zcode CLI 在哪、登录态是否就绪。同事 clone 后先跑 npm run detect:cli */

import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { resolveZcodeCli, wellKnownLocations } from '../lib/zcodeCli.ts'
import { loadLocalEnv } from '../lib/env.ts'

loadLocalEnv()

const mark = (ok: boolean) => (ok ? '✓' : '✗')
const envSet = process.env.ZCODE_CLI?.trim()

console.log('zcode CLI 环境自检')
console.log(`- 平台：${process.platform}`)
console.log(`- ZCODE_CLI（环境变量 / web/.env）：${envSet ? envSet : '未设置（走自动检测）'}`)

console.log('- 当前平台常见安装位置：')
for (const loc of wellKnownLocations()) console.log(`    ${mark(existsSync(loc))} ${loc}`)

const cli = resolveZcodeCli()
if (cli) {
  const run = cli.mode === 'node' ? '以 node 运行' : cli.mode === 'shell' ? '经 shell 运行' : '直接执行'
  console.log(`- 结果：${mark(true)} 找到 ${cli.path}（${cli.source}，${run}）`)
  if (!existsSync(cli.path)) console.warn('  警告：该路径当前不存在，请检查 ZCODE_CLI 配置。')
} else {
  console.log('- PATH：未找到 zcode 可执行文件')
  console.log('- 结果：✗ 未找到 zcode CLI')
  console.log('  请安装 ZCode 客户端后重试；CLI 在自定义位置时，复制 web/.env.example 为 web/.env 并设置 ZCODE_CLI。')
}

const authConfig = join(homedir(), '.zcode', 'cli', 'config.json')
console.log(`- 登录态：${mark(existsSync(authConfig))} ${authConfig}`)
if (!existsSync(authConfig))
  console.log('  缺少登录配置：请打开 ZCode 客户端登录（GLM Coding Plan），或确认 ~/.zcode/cli/config.json 存在。')

process.exit(cli && existsSync(cli.path) ? 0 : 1)
