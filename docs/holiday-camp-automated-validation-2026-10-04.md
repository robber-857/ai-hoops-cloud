# 精简训练与食材营养：自动回归和 CI

日期：2026-10-04（Australia/Sydney）。这是 [功能提交与剩余验收](holiday-camp-release-readiness-2026-10-04.md) 的下一步；功能范围继续以 [需求](holiday-camp-training-nutrition-requirements.md) 为准。

## 本次新增

- 三组真实 Chromium UI 流程：Profile 日期和体测保存、教练发布及家长历史读取、AFCD 食材查询。
- 四项真实 PostgreSQL 回归：全零课程到日汇总、同日多课原始小数汇总、资料在发布复核前/后提交的两事务时序。
- AFCD 官方工作簿下载和固定字节数/SHA-256/内容指纹核验；不提交工作簿。
- 只允许显式 `APP_ENV=test`、本机专用测试库的迁移和随机账号准备工具。
- GitHub Actions：独立 PostgreSQL 服务，前后端回归、类型检查、生产构建及浏览器流程；缺少输入导致跳过时检查失败。

入口：[`training-nutrition.yml`](../.github/workflows/training-nutrition.yml)、[浏览器说明](../web/e2e/README.md)、[浏览器场景](../web/e2e/training-nutrition.spec.ts)。CI 使用所提交代码的最低完整数量：后端 167、前端 161、浏览器 3 个场景，均要求无跳过。工作区中其他尚未提交的测试不计入这些数量。

## 运行方式

GitHub 的 push / pull request 触及 `server`、`web` 或此 workflow 时自动运行，也可以手动 dispatch。两个 job 分别使用临时 PostgreSQL 16，数据库完全分开。CI 不发布前后端，也不操作正式数据库。

本地先准备两个专用库：`ai_hoops_p2_test` 和 `ai_hoops_e2e_test`。端口可按本地测试 PostgreSQL 设置；工具拒绝正式环境、远程主机、其他库名以及 URL query 参数。第一次空库迁移执行以下命令；已有业务表的库会被拒绝，不会删除、降级或清空数据。

```powershell
# 在 server 目录，使用独立测试 Python 环境。
python -m pip install -r requirements-dev.txt
$env:APP_ENV = 'test'
$env:DATABASE_URL = '<专用 ai_hoops_p2_test 的 postgresql+psycopg URL>'
$env:PLAYER_PROFILE_TEST_DATABASE_URL = $env:DATABASE_URL
python -m tools.fetch_training_food_sources
python -m tools.migrate_training_test_db
python -m tools.run_ci_tests
```

下载工具只使用需求配置中固定的 FSANZ 官方 HTTPS 地址，输出保存在本 checkout 的 `tmp/afcd-release-3`。已有文件先核验，任何差异都直接失败；`--verify-only` 可以离线核验。严格后端 runner 要求完整 discovery、无失败、无跳过。

浏览器准备与单元测试分开：

```powershell
# 仍在 server 目录。
$env:DATABASE_URL = '<专用 ai_hoops_e2e_test 的 postgresql+psycopg URL>'
python -m tools.migrate_training_test_db # 仅第一次空库运行
python -m tools.seed_training_e2e --output ../tmp/training-e2e-fixture.json
$env:CORS_ORIGINS = '["http://127.0.0.1:3123"]'
python -m uvicorn app.main:app --host 127.0.0.1 --port 8123
```

另一个终端在独立 checkout 的 `web` 目录：

```powershell
npm ci
npx playwright install chromium
$env:AI_HOOPS_E2E_FIXTURE = '<上一步 fixture JSON 的绝对路径>'
$env:PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:3123'
$env:API_BASE_URL = 'http://127.0.0.1:8123/api/v1'
$env:NEXT_PUBLIC_API_BASE_URL = $env:API_BASE_URL
npm test
npm run typecheck:e2e
npm run build -- --webpack
npm run test:e2e
```

Playwright 启动和管理 3123 生产前端；调用方管理 8123 后端。必须在 build 前设置 API 地址，生产浏览器 bundle 已嵌入该值，start 时才设置不能改变它。正在运行另一个 Next 时必须使用独立 checkout 和依赖，避免共享 `.next`。不要使用当前 3000/8000，也不要让测试 fixtures 连接用户库。

每次完整浏览器重跑必须生成一个新 fixture 路径：seed 追加随机命名账号、班级及已发布训练计划，初始体测和训练开始日期为空，真实 UI 创建体测/课程。工具拒绝覆盖已有 JSON；三个场景按顺序执行，失败不会自动重试已修改记录。

## 验证范围

日期使用原生 `input[type=date]` 的 fill/change/Tab，核对实际 HTTP 请求体及响应，再刷新、退出和重新登录重读。此证据覆盖自动化原生日期输入，不等同于每种浏览器日历弹窗的鼠标选日。

课程覆盖个人分钟和缺勤、首次预览/发布、新体测导致真实 409 后重新预览发布、家长只读、旧版体测及能量快照保留。数据库并发回归明确：资料在复核读取前已提交会冲突；复核读取后再提交则冻结已审核的旧快照，最新体测仍保留。

食材成功流程读取真实 AFCD 数据；仅一次 503 是模拟网络响应，重试随后读取真实 API。覆盖中英文搜索、分类、分页、空结果，以及 360/390/768/1440 宽度和手机菜单键盘导航。

失败 trace、截图、HTML 和 JUnit 保存于 `web/e2e/.artifacts`，由局部 `.gitignore` 排除。CI 只在失败时保留这些测试证据及临时 API 日志七天；不会上传 fixture JSON、原始工作簿或数据库备份。trace 可能包含一次性合成测试账号。

## 证据与后续

本地所选源码已通过后端 167 项（无跳过）、前端 161 项、E2E 类型检查及 lint、空库 `base → 20261003_0012` 和生产 webpack 构建（42 个静态页面）。官方三工作簿已通过实际下载、字节数/SHA-256/1,588 条内容指纹核验。

采用全新随机账号的生产前端 Chromium 整链回归：3/3 通过，16.7 秒，无跳过。成功流程连接真实 8123 API 和专用 PostgreSQL，3123 前端通过完整 lockfile `npm ci` 和 webpack 生产构建；没有使用用户的 3000/8000。开发模式曾出现 Next 16 清单错误，最终用生产构建验证，不将开发模式的失败计作业务功能通过。

远程 GitHub CI 结果在首次实际运行完成后补记；本地结果不代表 Ubuntu runner 已通过。

仍需要真实教练/家长 UAT、正式环境备份和迁移/数据导入/部署后鉴权验证、独立库备份恢复演练。浏览器回归只覆盖 Chromium；其他浏览器日历、请求尚未完成时换账号、完整 dirty 导航和所有弱网场景仍需后续验证。
