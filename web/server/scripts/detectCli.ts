#!/usr/bin/env node
/* 环境自检：两个引擎（zcode / pi）的 CLI 在哪、登录态是否就绪。
   同事 clone 后先跑 npm run detect:cli；退出码 0 = 至少一个引擎可用 */

import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { resolveZcodeCli, wellKnownLocations } from '../lib/zcodeCli.ts'
import { resolvePiCli, piModelRef } from '../lib/piRunner.ts'
import { loadLocalEnv } from '../lib/env.ts'

loadLocalEnv()

const mark = (ok: boolean) => (ok ? '✓' : '✗')

console.log('引擎环境自检')
console.log(`- 平台：${process.platform}`)
console.log(`- AGENT_RUNNER：${process.env.AGENT_RUNNER?.trim() || '未设置（默认 pi）'}`)

/* ---- pi ---- */
console.log('pi 引擎：')
const piEnv = process.env.PI_CLI?.trim()
console.log(`- PI_CLI（环境变量 / web/.env）：${piEnv ? piEnv : '未设置（扫 PATH）'}`)
const pi = resolvePiCli()
if (pi) {
  const model = piModelRef()
  console.log(`- 结果：${mark(true)} 找到 ${pi}`)
  console.log(`- PI_MODEL：${model.provider}/${model.modelId}`)
  console.log(`- DEEPSEEK_API_KEY（或 pi auth 里的凭据）：${mark(Boolean(process.env.DEEPSEEK_API_KEY))} ${process.env.DEEPSEEK_API_KEY ? '已在环境中' : '未在当前环境（确认启动后端的 shell 是否 export，或写入 web/.env）'}`)
} else {
  console.log(`- 结果：${mark(false)} PATH 上未找到 pi`)
  console.log('  安装：npm i -g @earendil-works/pi-coding-agent；自定义位置时在 web/.env 配置 PI_CLI。')
}

/* ---- zcode ---- */
console.log('zcode 引擎：')
const envSet = process.env.ZCODE_CLI?.trim()
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

const zcodeOk = Boolean(cli && existsSync(cli.path))
if (!pi && !zcodeOk) {
  console.log('\n两个引擎都不可用，后端无法启动。')
  process.exit(1)
}
console.log(`\n可用引擎：${[pi && 'pi', zcodeOk && 'zcode'].filter(Boolean).join('、')}`)
