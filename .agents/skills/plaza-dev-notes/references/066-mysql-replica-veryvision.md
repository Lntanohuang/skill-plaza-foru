# 066 - 岗位库 MySQL 本地副本（veryVision 服务器 Docker）

**状态**：构建中断，待续（2026-10-19 启动，第 1 张表 c_industry_chain_info 已对账导入；第 2 张 c_company_chain 导入时遭遇 redo 活锁，2026-10-21 用户叫停，容器已停止；详见「事故记录」节）

## 动机

career-guidance / career-market-query 的数据源 `192.168.8.1:3908`（MySQL 5.7.43，账号仅 `GRANT SELECT`）存在三个结构性限制（见 017 / 047）：

1. 仅公司内网可达，跑数受内网窗口约束；
2. 无写权限，无法补 `c_company_position (company_address_id, publish_state, deleted)` 索引——城市过滤查询只能按 publish_state 索引扫 479 万候选行的根因；
3. 查询瓶颈在库服务端 CPU/IO，并发加不动（MAX_PARALLEL=2 是护库上限而非客户端上限）。

在 veryVision 服务器（192.168.10.7，wlc-Precision-3660，hsq 账户有 sudo）上建一份只含核心表的 MySQL 8.0 副本，三个限制全部解除：本地可加索引、8.0 有 hash join、并发不再伤源库。

## 约定细节

- **实例**：Docker 容器 `hsq-mysql`（`mysql:8.0`），`--restart unless-stopped`，仅绑 `127.0.0.1:3307`（外部机器走 SSH 隧道 `ssh -L 3307:127.0.0.1:3307 hsq@192.168.10.7`）。关键启动参数：`--skip-log-bin --max-allowed-packet=512M --innodb-buffer-pool-size=10G --character-set-server=utf8mb4 --collation-server=utf8mb4_general_ci`。
- **库名不变**：`ai_crowd_souring_extend`，已交付 SQL 零改动可用。
- **只复制 7 张核心表**：`c_company_position`(~15.4G)、`c_company_position_tag`、`c_position_chain`、`c_company_chain`、`c_company_archive`、`c_company_address`、`c_industry_chain_info`。XXL-JOB 调度表、`_2025xxxx` 快照表不导。
- **路径**（均在服务器 hsq 家目录）：数据目录 `/home/hsq/project/mysql-data`（sda 3.6T 机械盘）、dump 文件与完成标记 `/home/hsq/project/mysql-dumps/`、凭据与脚本 `~/mysql-replica/`（`source.cnf`/`target.cnf` 为 600 权限，root 与 `career_read` 密码文件同目录）。
- **构建/刷新脚本**：`~/mysql-replica/dump_all.sh`，逐表「mysqldump → 灌入 → 源/副本 COUNT 对账 → 打 done 标记」，断点续跑（有标记即跳过）。mysqldump 8.0 客户端连 5.7 服务端必带 `--column-statistics=0 --single-transaction --no-tablespaces --set-gtid-purged=OFF --max-allowed-packet=512M`。
- **副本补索引**：`c_company_position` 导入对账通过后脚本自动建 `idx_addr_pub_del (company_address_id, publish_state, deleted)`。中文 FULLTEXT（ngram）未建，源库那个无 ngram 是摆设（019），需要时在副本上补。
- **查询账号**：`career_read`（仅 SELECT 本库），密码在 `~/mysql-replica/career_read-password.txt`。

## 成本与取舍

- **否决真主从复制**：源库账号仅 SELECT，开 binlog / 建复制账号均无权限。
- **否决逐行 SELECT→INSERT 脚本**：7 表约 8700 万行，逐行网络往返不可行；mysqldump 的批量 extended insert 即该思路的实用形态。
- **否决 apt 原生安装**：污染同事（wlc）工作站的系统包；Docker 拆卸干净，且机器上已有他管理的容器生态。
- **否决放 nvme 系统盘**：系统盘已 88% 满（剩 109G），副本约 30–50G 放进去有填满系统盘风险；sda 3.6T 仅用 18%。代价是机械盘冷查询慢（全表扫分钟级），依赖 10G buffer pool 热缓存。
- **刷新策略**：源库静态已两次实证（09-20/10-15 在招基数零漂移），不设 cron，需要时手动重跑 `dump_all.sh`（删对应 done 标记可单表重刷）。

## 事故记录（2026-10-19 → 10-21）

- **现象**：c_company_chain（705M dump）导入时，一条 INSERT 卡在 `update` 状态 38 小时无进展；容器日志每 11 秒刷 `[MY-014084] Threads are unable to reserve space in redo log... log_checkpointer consumer still lagging`（LSN 固定不动）。
- **表层原因**：MySQL 8.0.30+ 默认 `innodb_redo_log_capacity=100M`，大批量导入 + 慢盘导致检查点永久滞后（活锁，不是死锁）。
- **深层疑点**：iostat 实测 sda 写延迟 `w_await≈378ms`、fsync 412ms（健康 HDD 应 10–20ms），磁盘本身写性能异常差（SMR 盘或健康问题，未查证）。
- **已做处置**：杀掉导入任务；容器已用 `--innodb-redo-log-capacity=4G --innodb-io-capacity=400 --innodb-io-capacity-max=2000` 重建，但崩溃恢复 5 分钟未完成即被用户叫停（Exited）。半截的 c_company_chain 表未清理。
- **恢复路径**（待续时）：起容器等崩溃恢复完成 → `DROP TABLE c_company_chain` → 重跑 `~/mysql-replica/dump_all.sh`（断点续跑，已完成表跳过）；若导入速度仍被磁盘拖死，改放 nvme（空间紧张，约需 35–50G/109G 空闲）或先 `smartctl` 查盘。

## 后续扩展路线

- 验收：`~/mysql-replica/run.log` 的逐表 COUNT 对账行、中文抽查、基准查询（广东在招去重 1,542,515、education 分布 BUXIAN 35.0%/DAZHUAN 27.8%/BENKE 22.1%——注意以源库当天实际为准）。
- 接入改造：`scripts/career-market-query.mjs` 在该服务器上运行时指向 `127.0.0.1:3307`（凭据走 cnf），护库并发纪律可解除；Mac 侧 DBeaver 走 SSH 隧道。
- 可选：副本上建 ngram FULLTEXT、高职切片物化表。
