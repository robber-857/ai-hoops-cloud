# Training 报告年龄重评分交付与验证记录

日期：2026-10-05（Australia/Sydney）

本文件记录本轮 Pose / Training 报告的年龄选择、历史报告重评分及其统计边界。它与教练发布的课程训练记录、课程热量估算和 AFCD 食材营养是不同链路；后者见[精简训练饮食本地验证](./holiday-camp-simplified-local-validation-2026-10-03.md)。

代码行为和验证结果分开记录，第 6 节列出实际命令、数量和证据。未覆盖的实拍、部署与 UAT 保持待验收；功能描述本身不作为验证证明。

## 1. 本轮行为

### 首次生成 Training 报告

- 上传分析页面提供 Age Group。所选年龄用于评分、建议、保存的 `score_context` 和摘要；默认仍为 `16-18`。
- 生成按钮和提交处理器使用同一份就绪判断：完整采集完成、时序与聚合数据可用、存在必要可评分类别、至少两个有限数值指标，并且评分结果为 `ready`。不可评分时显示原因，不用补零伪造成功报告。
- 保存前核对上传会话锁定的模板 code、version 和 content hash。规则不匹配时要求刷新并重新上传。
- 沿用已确认的模板参数和评分标准，不因本轮年龄选择接入修改 `target/tol/L/U/margin`。
- MediaPipe 脚本加载由并发使用者共享，加载失败可在后续分析挂载时重试；已卸载使用者不再接受迟到的初始化结果。自动分析错误进入明确错误状态。首次保存保留失败后的采集数据供重试，并隔离离开分析页面后的迟到保存响应。这些实现保护仍需与真实视频链路验证区分。

### 已保存报告的年龄预览与保存

- 完成、未删除且保存资料齐全的 Training 报告，仅所有者可切换年龄预览。共享页面及有读取权限的其他用户保持只读；后端权限判断独立于前端按钮状态。
- 预览使用该报告保存的模板 JSON 和 `saved_metrics`，不重新运行视频采集或按当前模板重新聚合测量数据。
- `Cancel` 恢复已保存年龄和结果。预览期间禁用分享，避免分享链接指向原结果而页面显示未保存分数。
- 点击 `Save as new report` 才调用 `POST /api/v1/reports/{id}/reanalyze-age`。后端另建报告及报告快照，保留原 session、video、template code/version 和测量资料；此接口不修改原报告。
- 保存期间禁用保存、年龄选择和取消，成功后进入新报告；刷新后从真实 API 恢复新报告的年龄和结果。失败保留预览并提供重试。
- 加载失败明确显示错误和重试入口。切换报告 ID 或登录身份时隔离数据，失败页面不得继续展示上一份报告的分数或可写操作。
- 合法 UUID、唯一 `id` 和唯一 `share=1` 的 `/pose-2d/report` 可匿名读取现有公开报告 API。私人报告、上传分析页面及个人中心仍需要登录；分享参数不对其他页面放行。

### 重复请求与来源标记

- `request_id` 是本次保存的 UUID。同一来源、同一年龄的失败重试复用 UUID；已成功保存时返回第一次生成的报告，不再次写入。
- UUID 已被不同来源、年龄或用户使用时返回 `409`，不会把另一份报告当作成功结果。跨来源并发竞争同一 UUID 时，失败事务回滚后核对已提交结果。
- 同一个 UUID 的相同来源/年龄重试以第一次结果为准，不用于提交修改后的分数；新的保存意图需要新的 UUID。
- 比较报告的 `source_report_public_id` 和 `source=report_age_reanalysis` 由服务端设置。普通报告保存清除这类客户端来源标记，防止普通报告伪装成比较报告。

## 2. 冻结范围与评分信任边界

| 内容 | 本轮处理 |
| --- | --- |
| 原报告模板 JSON | 从报告实际保存的服务端快照复制，保留模板身份和版本 |
| 原测量值 `saved_metrics` | 从原报告复制，请求不能替换 |
| 原时间线、视频和会话关联 | 复制/复用原报告资料，不重新采集 |
| 原上下文、摘要 | 复制原资料，更新所选年龄及服务端来源标记 |
| 新分数、分类结果和 Findings | 使用客户端现有评分引擎产生结果；服务端校验结构后保存 |
| 年龄倍率 `ageToleranceScale` | 读取当前前端 `global.json`，未随报告冻结 |
| 可执行评分引擎及等级计算 | 使用当前前端代码，未随历史报告保存可执行版本 |

因此，本轮是**冻结模板和测量资料后，使用当前评分引擎及年龄倍率进行比较**。它不保证历史评分引擎的完整重现。以后修改全局年龄倍率或评分代码时，即使模板 JSON 未变，重新预览的结果也可能变化；原已保存结果仍按保存值读取。

服务端验证年龄枚举、所有者、Training 类型、完成状态、所需冻结资料、模板指标对应关系、总分/等级一致性，以及有限数值、权重范围、布尔值和 Finding 文本/状态/类别等结构，并剥除未知评分字段。请求不能替换被冻结的模板、测量值、时间线或来源信息。

**服务端仍未独立计算分数，也未证明客户端分数与测量值数学一致。** 本轮结构校验不是服务端权威评分；用于达标、排名或奖励的权威结算仍需单独设计。年龄由用户手动选择，当前不从 Profile 出生日期推导或验证，既有年龄分组边界保持不变。

### 历史资料缺失

报告实际保存的模板快照或测量资料缺失、不符合所需结构时，`can_reanalyze_age=false`，前端禁用重评分，保存接口返回 `409`。旧报告详情可沿用已有的模板版本兼容读取，但该回退不能证明报告曾保存冻结快照，也不能据此开启重评分。不要用当前模板补造历史冻结资料。

## 3. 比较报告与训练统计、任务的关系

年龄比较复用一次采集，不新增训练 session，不触发任务进度、成长快照、成就或训练天数更新。

- 后端个人统计、趋势回退、教练统计、管理员报告计数，以及任务报告候选/提交相关查询排除年龄比较报告。
- 前端个人中心的统计回退、趋势、连续训练天数和任务候选，以及教练班级页面自行计算的最高分、平均分和近期报告数量，同样排除比较报告。
- 历史列表保留比较报告以便打开，通过 `is_age_comparison` 传递身份并标识；保存文件数量与训练次数是不同口径。
- 比较报告不能作为一次新的任务训练提交。历史报告读取和分享仍沿用现有访问规则；本轮没有新增分享同意、过期或撤销机制。

## 4. 本轮修改依赖闭包

以下为本轮行为涉及的源码与验证支持文件。最终提交清单由主任务核对；全工作区保留的其他历史改动不因本文件而纳入本轮交付。

### 后端

| 文件 | 作用 |
| --- | --- |
| [reports.py](../server/app/api/v1/reports.py) | 年龄重评分 API 入口 |
| [report.py](../server/app/schemas/report.py) | 请求、只读/比较标记和评分结果结构 |
| [report_service.py](../server/app/services/report_service.py) | 冻结资料复制、权限、去重、事务冲突及原报告筛选 |
| [coach.py](../server/app/schemas/coach.py) | 教练报告列表的比较标记 |
| [me_service.py](../server/app/services/me_service.py) | 个人统计/趋势和任务提交排除比较报告 |
| [coach_service.py](../server/app/services/coach_service.py) | 教练统计筛选及列表标记 |
| [admin_service.py](../server/app/services/admin_service.py) | 管理员报告计数筛选 |
| [test_report_age_reanalysis.py](../server/tests/test_report_age_reanalysis.py) | 保存、冻结、权限、重试、缺失资料和结构边界用例 |
| [test_report_age_reanalysis_postgres.py](../server/tests/test_report_age_reanalysis_postgres.py) | PostgreSQL 事务/并发和统计、任务边界回归 |
| [run_ci_tests.py](../server/tools/run_ci_tests.py)、[test_training_ci_tools.py](../server/tests/test_training_ci_tools.py) | 严格后端测试数量及禁止跳过的边界检查 |

### 前端与浏览器验证支持

本轮涉及下列 19 个源码/定向单测文件。结果以第 6 节的实际记录为准。

| 文件 | 作用 |
| --- | --- |
| [报告页面](../web/src/app/pose-2d/report/page.tsx) | 历史年龄预览、另存、加载错误重试及报告/身份隔离 |
| [Controls.tsx](../web/src/components/Pose2D/Controls.tsx) | 分析生成按钮的就绪与保存状态 |
| [PoseAnalysisView.tsx](../web/src/components/Pose2D/PoseAnalysisView.tsx) | 初次年龄选择、采集就绪、规则校验及保存重试 |
| [PoseAutoAnalyzer.tsx](../web/src/components/Pose2D/PoseAutoAnalyzer.tsx) | 自动分析进度、错误和取消保护 |
| [useMediaPipePose.ts](../web/src/hooks/useMediaPipePose.ts) | 共享脚本加载、失败重试与卸载保护 |
| [reports.ts](../web/src/services/reports.ts) | 重评分 API 和权限/比较标记 |
| [trainingReport.ts](../web/src/lib/trainingReport.ts) | 统一就绪判断、年龄重评分和模板身份核验 |
| [trainingReport.test.ts](../web/src/lib/__tests__/trainingReport.test.ts) | 就绪、年龄与锁定规则回归 |
| [mediaPipePose.test.ts](../web/src/lib/__tests__/mediaPipePose.test.ts) | 模拟脚本加载、失败重试和卸载回归 |
| [poseReportSave.test.ts](../web/src/lib/__tests__/poseReportSave.test.ts) | 受控采集/保存回调、并发锁及规则不一致回归 |
| [reportActivity.test.ts](../web/src/lib/__tests__/reportActivity.test.ts) | 历史保留、任务候选和统计输入筛选回归 |
| [AccountDataProvider.tsx](../web/src/components/account/AccountDataProvider.tsx) | 个人中心比较身份、任务筛选和统计回退 |
| [账户类型](../web/src/components/account/types.ts) | 归一化报告的比较身份 |
| [coach.ts](../web/src/services/coach.ts) | 教练报告列表比较标记 |
| [教练班级页面](../web/src/app/coach/classes/[classPublicId]/page.tsx) | 自行计算的班级统计排除比较报告 |
| [CoachReportTable.tsx](../web/src/components/coach/CoachReportTable.tsx) | 比较报告历史标识 |
| [ProtectedRoute.tsx](../web/src/components/auth/ProtectedRoute.tsx) | 只读分享入口的精确匿名访问例外 |
| [sharedReportRoute.ts](../web/src/lib/sharedReportRoute.ts) | 校验 exact 路径、唯一参数及 UUID |
| [sharedReportRoute.test.ts](../web/src/lib/__tests__/sharedReportRoute.test.ts) | 33 项路径边界及真实保护组件渲染/effect 用例 |

浏览器和测试数据支持文件如下：

| 文件 | 作用 |
| --- | --- |
| [report-age.spec.ts](../web/e2e/report-age.spec.ts) | 本轮新增两个浏览器场景 |
| [support.ts](../web/e2e/support.ts) | 读取专用测试账户与年龄报告 fixture |
| [seed_training_e2e.py](../server/tools/seed_training_e2e.py) | 在专用测试库生成随机隔离 fixture、合成测量值及历史模板报告 |
| [training-report-age-validation-2026-10-05.md](./training-report-age-validation-2026-10-05.md) | 本轮行为、边界和实际验证记录 |

测试 fixture 的密码、临时 JSON、数据库备份和临时输出不随文档上传。CI 及 README 的最终变更由主任务补充，不从未经核对的工作区状态推断。

## 5. 浏览器场景与证据范围

新增两个场景位于 `web/e2e/report-age.spec.ts`，使用随机测试账户、**synthetic measurements + historical template fixture**，通过真实 API 读写专用 PostgreSQL。部分失败路径由 Playwright 一次性注入 `503`，随后重试恢复真实 API。

| 场景 | 用例覆盖 | 当前验证状态 |
| --- | --- | --- |
| 年龄预览、取消、保存失败重试、历史冻结及只读分享 | 年龄改变、预览禁分享、Cancel、保存期间禁用操作、同 UUID 重试、新报告 ID、刷新恢复、原资料不变、统计不变、匿名共享只读及匿名写入被拒绝；私人报告及上传仍转登录 | passed：最终完整运行 1/1 |
| 历史规则缺失及报告加载失败恢复 | 缺少保存快照时不可编辑、一次性加载失败、重试成功、同一挂载页面切换不存在的报告 ID 后不展示旧分数或旧操作 | passed：最终完整运行 1/1 |

这些场景验证的是页面与报告持久化链路。它们没有处理实拍视频，没有证明 MediaPipe 动作识别、全视频采集质量、S3/Supabase 上传、对象权限、CDN 视频可读性或真实儿童动作评分准确性。合成测量值不能替代正确/典型错误视频验收。

## 6. 实际验证结果

| 验证层 | 状态 | 数量、命令与证据 |
| --- | --- | --- |
| 后端定向单元测试 | passed | `python -m unittest tests.test_report_age_reanalysis`：17/17，SQLite 内存库 |
| 后端真实 PostgreSQL 回归 | passed | `python -m unittest tests.test_report_age_reanalysis_postgres`：6/6、无 skip；本机 55439 的专用 `ai_hoops_p2_test`，实际 `pg_blocking_pids` 核对行锁；覆盖真实 API、同源重试、不同年龄/不同来源 UUID 冲突、锁后刷新、统计/任务与冻结副作用 |
| 后端完整测试 | passed | 隔离 checkout `python -m tools.run_ci_tests`：190 项、skipped=0、failures=0、errors=0，13.633 秒；仅本轮提交闭包，不带旧菜谱未提交差异 |
| 前端 Vitest | passed | 隔离 checkout `npm test`：239 passed、pending=0、todo=0；基线 161 + 本批纳入 78 项，未纳入旧菜谱/能量未提交用例 |
| 前端 TypeScript / 定向 ESLint | passed | `npx tsc --noEmit --incremental false`、`npm run typecheck:e2e`、19 个源码/定向测试及 `e2e/*.ts`、Playwright 配置 lint 均 exit 0；lint 不扫描生成 trace 资源 |
| 隔离生产构建 | passed | 最终共享路由修复后 `npm run build -- --webpack` 成功，42 个静态页面；build 前设置 API 为 `http://127.0.0.1:8123/api/v1` |
| 新增两个 Playwright 场景 | passed | Chromium 2/2，实际隔离生产前端 3123 / API 8123 / 专用 `ai_hoops_e2e_test`；最终完整运行包含 5/5 场景，28.7 秒，无跳过/失败/错误 |
| 既有训练饮食浏览器回归 | passed | 同一最终运行中的 Profile 持久化、教练发布/家长历史和 AFCD 食材 3/3 通过；使用新随机 fixture，不复用被此前运行修改的记录 |
| GitHub 提交与 CI | pending | 待填实际 commit、workflow run URL 和结果；本地通过不代替 CI |
| 部署与真实用户 UAT | pending | 待填独立证据；不由 HTTP 200 或合成账户验证推断完成 |
| 正确/典型错误实拍视频、存储与 CDN | pending | 未由本轮合成报告场景覆盖，待单独验收 |

日期、环境和提交要与结果一起记录；重跑后的结果另加记录，保留原验证事实。旧规划中的 2026-09-18、2026-09-19、2026-09-22 测试与本地数据库文字仍是当日历史，参见[指标与开发计划](./training-five-template-metrics-development-plan.md)及[状态风险文档](./training-five-template-next-phase-status-risk-plan.md)。

首轮浏览器新增场景因测试选择器同时匹配 Next 路由提示节点而失败，修正选择器后，成功走到保存/刷新/原报告与统计不变检查；匿名分享步骤发现父级登录保护仍拦截公开链接，属于实际功能缺陷。该缺陷已修复，增加 33 项保护路径用例和浏览器私人路由断言后，再次生产构建，以第三份新随机 fixture 完整运行 5/5 通过。早期严格后端检查的唯一失败是 CI 工具测试硬编码旧数量 167；数量边界测试已改为引用当前最低数量，最终 190 项均通过。Windows 沙箱临时缓存权限错误不计作业务测试通过。
