# 016 · 岗位库查询客户端的 mysql_native_password 回落

- 状态：已实现（2026-09-28，本机与真实岗位库实测通过）
- 动机：真实 career-guidance 会话在本机跑岗位库查询时全部失败：`ERROR 2059 (HY000): Authentication plugin 'mysql_native_password' cannot be loaded`。原因是 Homebrew 默认 `mysql` 已是 9.5.0，9.x 移除 mysql_native_password 插件；岗位库服务端仍是 5.7 侧握手。此前 `scripts/mysql-query.mjs`（009）和 `scripts/career-market-query.mjs`（012）都把 `mysql` 当作假定可用的客户端，没有回落路径。
- 约定细节：
  - 新增 `scripts/mysql-client.mjs`（零依赖）：`mysqlBinCandidates(explicitBin)` 返回 `[主客户端, /opt/homebrew/opt/mysql@8.4/bin/mysql, /usr/local/opt/mysql@8.4/bin/mysql, /opt/homebrew/opt/mysql-client@8.4/bin/mysql, /opt/homebrew/opt/mysql-client/bin/mysql]`（仅追加 `existsSync` 为真的路径）；`isAuthPluginError(text)` 匹配 `mysql_native_password` / `Authentication plugin`。
  - **显式指定不回退**：`MYSQL_BIN` 环境变量或 `mysql-query.mjs --mysql-bin` 给出时只跑该客户端；只有默认值 `mysql` 才尝试回落。
  - `scripts/career-market-query.mjs:104-151` 把原 `execute()` 拆成 `spawnMysql(bin,...)` + 循环回落的 `execute()`，成功结果新增 `mysqlBin` 字段（成功客户端路径），便于排障。
  - `scripts/mysql-query.mjs` 的 `spawnSync` 改为按候选列表循环，最后错误信息在认证插件失败时追加“用 --mysql-bin 指定 8.x 客户端”提示。
- 成本与取舍：多一个共享小模块和一次失败重试；换取本机默认环境不再需要人工 `PATH=/opt/homebrew/opt/mysql@8.4/bin` 前缀。**否决**：直接改 `web/.env` 或沙箱 AGENTS.md 写死 8.x 绝对路径——机器路径会漂移，且 9.x 客户端在其它库（服务端已升级时）仍是对的默认值。**否决**：为回落引入 mysql2 等 JS 驱动——破坏零第三方依赖惯例。
- 后续扩展路线：若目标环境默认客户端全部不兼容，可在 `mysql-client.mjs` 增加 `MYSQL_BIN` 之外的 `MYSQL_BIN_FALLBACKS` 配置项；把成功使用的 `mysqlBin` 记入会话事件日志便于回归排查。
- 验证（2026-09-28，本机 Homebrew mysql 9.5.0 为默认）：`env -u MYSQL_BIN node scripts/mysql-query.mjs "SELECT 1 AS ok, '中文' AS t"` → `ok:true`，135ms；`--mysql-bin /opt/homebrew/bin/mysql` 仍按预期失败并给出 8.x 提示；`env -u MYSQL_BIN node scripts/career-market-query.mjs --query cohort-summary ...` → `ok:true`，33.7s，返回 `mysqlBin:/opt/homebrew/opt/mysql@8.4/bin/mysql`。
- 配套实测事实（同次会话）：`--parallel` 批量跑 3 个重聚合（education/experience/salary-distribution）会与单条同量级查询争夺资源，55s 全部超时（`ERROR 3024`）；逐个串行 40s 左右全部成功。与 `岗位库数据源.md` 的“重查询必须串行”一致，沙箱 AGENTS.md 里“工具内部最多并发 3 个查询”只适用于轻量查询。
