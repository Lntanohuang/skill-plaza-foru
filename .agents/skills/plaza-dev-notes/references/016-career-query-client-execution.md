# 016 · 岗位库查询客户端执行：客户端回落、预探测与受控并行

**状态**：已实现（2026-09-28 本机与真实岗位库实测通过。原 016（native_password 回落）与 020（预探测与受控并行）于 2026-10-19 合并，见 076）。

## 动机

Homebrew 默认 mysql 已是 9.x，移除了 `mysql_native_password` 插件，而岗位库服务端仍是 5.7 侧握手，导致真实会话中每条 SQL 都报 `ERROR 2059 (HY000)`。`scripts/mysql-query.mjs`（009）与 `scripts/career-market-query.mjs`（012）此前都把 `mysql` 当作假定可用的客户端，需要固定的客户端选择与批次执行策略。

## 约定细节

- **客户端回落**：新增 `scripts/mysql-client.mjs`（零依赖）。`mysqlBinCandidates(explicitBin)` 返回 `[主客户端, /opt/homebrew/opt/mysql@8.4/bin/mysql, /usr/local/opt/mysql@8.4/bin/mysql, /opt/homebrew/opt/mysql-client@8.4/bin/mysql, /opt/homebrew/opt/mysql-client/bin/mysql]`（仅追加 `existsSync` 为真的路径）；`isAuthPluginError(text)` 匹配 `mysql_native_password` / `Authentication plugin`。**显式指定不回退**：`MYSQL_BIN` 环境变量或 `--mysql-bin` 给出时只跑该客户端。`career-market-query.mjs` 的 `execute()` 按候选列表循环回落，成功结果带 `mysqlBin` 字段（成功客户端路径，便于排障）。
- **批次预探测**：批次开始先 `SELECT 1 AS mysql_client_probe` 选定兼容客户端，后续查询复用，避免每条 SQL 重复触发 2059。
- **受控并行**：默认查询超时 120 秒、上限 180 秒；批次最多并发 2（结果带 `maxParallel`）；沙箱 `AGENTS.md` 工具节文案同步该限制。
- **执行纪律（实测）**：三条重聚合（education/experience/salary-distribution）并行会互抢资源全部超时（`ERROR 3024`，55s 级），重查询必须串行（单条约 40s）；「工具内部最多并发 3」只适用于轻量查询。
- **并行输出读取**：并行批次 stdout 很大，禁止对输出直接 `tail/head` 截断（曾截掉前 3 条结果被迫补跑）；应 `> /tmp/q.json 2>&1` 重定向后再读文件。`--parallel` 的参数键是 `query`（非 `queryId`）。

## 成本与取舍

- 每批次多一次轻量探测；并发从 3 降为 2，牺牲部分峰值并行换取数据库稳定性。
- 否决：在 `web/.env` 或沙箱 AGENTS.md 写死 8.x 绝对路径——机器路径会漂移，且服务端升级后 9.x 客户端仍是对的默认值。
- 否决：为回落引入 mysql2 等 JS 驱动——破坏零第三方依赖惯例。
- 未把 `MATCH AGAINST` 强行用于中文岗位词（017 实测中文 FULLTEXT 命中为 0）。

## 后续扩展路线

- 若目标环境默认客户端全部不兼容，在 `mysql-client.mjs` 增加 `MYSQL_BIN_FALLBACKS` 配置；把成功使用的 `mysqlBin` 记入会话事件日志便于回归排查。
- 索引/快照优化（见 017）后再评估并发 3；增加按查询类型的总预算。

## 验证（2026-09-28 实测）

- `env -u MYSQL_BIN node scripts/mysql-query.mjs "SELECT 1"` ok（回落到 8.4 客户端）；显式指定 9.5 客户端按预期失败并提示「用 --mysql-bin 指定 8.x 客户端」。
- 广州 Java 实习口径三条真实重聚合串行约 40s/条全部成功；`--parallel` 批次（并发 2）总耗时 95.2s，无 2059/3024。
