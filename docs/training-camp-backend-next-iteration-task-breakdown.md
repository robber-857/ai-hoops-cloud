# AI 篮球训练营下一轮开发任务拆解

最后更新：2026-06-13

本文档是下一轮开发的执行清单。已经完成或明显过时的旧任务已清理，只保留当前产品真正需要推进的内容。

重要约束：

- 本地模板 JSON 是评分核心标准，开发不得修改 `web/src/config/templates/**/*.json` 的评分内容。
- 评分和计算逻辑主要位于 `web/src/lib`，除非明确设计评分迁移，否则不要改动核心评分算法。
- Admin/Coach/Student 登录跳转已由用户在 2026-05-03 手动验证正常，下一轮不再把登录跳转作为主任务。

## 本轮已完成

### Student 图表视觉升级与 Coach 聚合入口第一版

- Student 个人中心 `Growth trends` 在现有时间-分数折线图基础上完成视觉升级，补充暗色科技网格、扫描光、发光折线/节点、latest/peak 摘要和 hover/focus tooltip，保持纵轴 `0-100 score` 与个人中心原有布局。
- 后端新增 `GET /api/v1/me/notifications`，返回当前用户自己的通知流和未读数。
- 后端新增 `POST /api/v1/me/notifications/{notification_public_id}/read`，支持当前用户将自己的通知标记为已读。
- Coach 左侧导航补齐 `Announcements` 和 `Notifications`。
- 新增 `/coach/announcements` 聚合页，复用当前用户公告可见性规则，Coach 可看到 Admin 全局/camp/class/role 公告和 class announcements，并可打开详情后标记已读。
- 新增 `/coach/notifications` 聚合页，展示当前 Coach 自己的通知流，支持类型/已读状态筛选，并可打开详情后标记已读。
- 后端测试补充当前用户通知列表和通知已读逻辑。

### Admin 注册用户管理第一版

- 后端新增/完善：
  - `GET /api/v1/admin/users`
  - `POST /api/v1/admin/users`
  - `GET /api/v1/admin/users/{user_public_id}`
  - `PATCH /api/v1/admin/users/{user_public_id}`
  - `DELETE /api/v1/admin/users/{user_public_id}`，当前语义为软禁用。
- 支持分页、角色筛选、状态筛选、关键词搜索。
- 支持创建 coach/student 档案和登录密码。
- 支持编辑昵称、邮箱、手机号、角色、状态、重置密码和班级归属。
- 禁用/恢复用户不会级联删除历史报告、训练记录、任务等数据。
- 前端新增 `/admin/users` 页面，并加入 Admin 左侧导航。

### Admin 本地评分模板同步第一版

- 后端新增 `POST /api/v1/admin/training-templates/sync-local?dry_run=true|false`。
- 从 `web/src/config/templates/shooting`、`dribbling`、`training` 读取 12 个本地 JSON 模板。
- 同步到 `training_templates` 和 `training_template_versions`。
- 同步保存 template code、category、display name、version、source path、metric summary、scoring rules 等信息。
- 支持 dry-run 预览 create/update/skip。
- 不修改本地模板 JSON，不改动 `web/src/lib` 评分算法。
- Admin 模板页新增 dry-run 和 sync local 操作入口。

### Coach 工作台左侧导航第一版

- Coach 左侧导航 `Classes`、`Reports`、`Tasks` 已经指向真实路由。
- 新增 `/coach/classes`：展示教练负责的班级列表。
- 新增 `/coach/reports`：聚合展示可见班级最近报告，并支持班级筛选。
- 新增 `/coach/tasks`：聚合展示可见班级训练任务，并支持班级和状态筛选。

### Admin 公告、任务、通知监督第一版

- 后端新增/完善：
  - `GET /api/v1/admin/announcements`
  - `POST /api/v1/admin/announcements`
  - `PATCH /api/v1/admin/announcements/{announcement_public_id}`
  - `DELETE /api/v1/admin/announcements/{announcement_public_id}`，当前语义为归档。
  - `GET /api/v1/admin/tasks`
  - `GET /api/v1/admin/tasks/{task_public_id}`
  - `PATCH /api/v1/admin/tasks/{task_public_id}`
  - `GET /api/v1/admin/notifications`
  - `GET /api/v1/admin/notifications/{notification_public_id}`
- 公告支持 `global`、`camp`、`class`、`role` 范围；角色公告当前支持 `coach` / `student`。
- 公告发布可生成通知；Coach 发布 class task / class announcement 时也会写入通知表，方便 Admin 监督。
- Admin 新增 `/admin/announcements`、`/admin/tasks`、`/admin/notifications` 三个页面，并加入左侧导航。
- Admin Task / Announcement / Notification 筛选区已完成 UI 修复第一步：筛选控件从标题右侧拆出，统一改为独立可换行筛选栏，并为所有筛选项增加标签；keyword 输入并入同一表单，避免中等宽度视口和右侧详情栏下按钮或输入被遮挡。
- Task 进度规则已调整为严格完成度：默认 `target_sessions=1` 且 `target_score=0` 时，提交一个 completed report 会让 assignment 达到 100%；如果 Coach 配置了目标次数和/或目标分，进度按已配置目标中最低的达成率计算，高分但次数不足或次数够但分数不足都不会提前显示 100%；完成状态仍要求所有目标同时达标。

### Admin / Coach 公告链路状态更新

- Admin announcement 列表/发布链路已回到第一版可用状态。
- Coach class announcements 读取/发布链路已回到第一版可用状态。
- 下一轮不再把公告链路作为首要修复任务；相关内容转为回归测试、审计日志和聚合入口增强。

### Student 个人中心增强第一版

- 后端新增 `GET /api/v1/me/announcements`，按学生可见范围返回全局、camp、class、student 角色公告，并返回未读数量。
- 后端新增 `POST /api/v1/me/announcements/{announcement_public_id}/read`，用于标记公告已读，并同步将对应 notification 标记为已读。
- Student 个人中心新增 announcement 聚合入口，可查看公告标题、范围、发布时间、置顶状态、未读状态和内容详情。
- `Weekly tasks` 已改为只展示后端真实 `/me/tasks` 数据；没有教练任务时显示空状态，不再用报告生成模拟任务。
- `Growth trends` 已重做为横轴时间、纵轴固定 `0-100 score` 的折线图，并已完成第一版视觉升级。

### Student 任务提交链路第一版

- 后端 `TaskSummaryRead` 补充 class、description、analysis type、template、target、latest report、completed/last submission 等任务详情上下文。
- 新增 `GET /api/v1/me/tasks/{assignment_public_id}`，学生只能读取自己且任务处于 published 的 assignment。
- 新增 `POST /api/v1/me/tasks/{assignment_public_id}/submit-report`，学生可把自己的 completed report 关联到可见任务；后端校验 analysis type、template、报告归属和是否已绑定其他任务，然后复用报告服务的 assignment 进度计算。
- 上传初始化继续支持 `task_assignment_public_id`，并新增 class / assignment 一致性校验，避免任务上传被错误挂到其他班级。
- Student 个人中心任务卡新增 Start task 跳转，自动携带 assignment/class/template 上下文到对应 `pose-2d` 上传页。
- Student 个人中心任务卡新增 Use latest report 入口，可用最近的匹配报告提交任务并刷新任务状态。
- 后端测试新增已有报告提交成功与 analysis/template 不匹配拒绝场景。
- Student 个人中心 Weekly tasks 新增任务详情弹窗第一版，展示 class、template、target、progress 等任务上下文。
- Student 个人中心 Weekly tasks 新增显式报告选择器第一版，按任务 analysis type/template 展示匹配报告，学生可选择具体报告后提交。
- 任务详情接口新增 `submission_reports`，返回当前 assignment 已关联的 completed report 历史，包含 report/session/video public id、template、score、grade 和提交时间。
- Student 个人中心 Weekly tasks 详情弹窗新增提交历史区块，打开详情时按需请求 `/me/tasks/{assignment_public_id}` 并展示已提交报告。
- Student 个人中心 Weekly tasks 提交失败体验改为页面内错误提示和 Try again 重试，不再只依赖浏览器 `alert`。
- Student 个人中心 Weekly tasks 新增刷新策略第一版：任务区支持手动 Refresh，页面会每 60 秒静默刷新 dashboard/tasks/reports，并刷新已加载过的任务详情缓存。
- Student 个人中心 Weekly tasks 详情弹窗新增内部滚动区和固定底部操作区，提交历史过多时仍能看到 `Submit selected report`。
- Student 个人中心 Weekly tasks 新增固定面板与内部滚动第一版：Coach 发布很多任务时，任务区不再无限撑高页面；桌面端任务区与趋势图按同一套视口高度节奏对齐，移动端按钮和任务元数据自动换行。

### Student Growth trends 第二版

- 趋势图优先展示最近报告的单次 `0-100` 分数，避免把后端日聚合 best score 误读成累计总分。
- 前端 fallback 的趋势点保留报告模板名，后端 trend fallback 改为优先使用 average score，并在 tooltip 中显示 session 数。
- 图表 UI 最终改为单一折线/节点/淡色面积表达，增加 Latest / Best / Change 摘要、明确“not cumulative points”的说明和可访问 tooltip；此前的分数柱已移除，避免柱状图与日期槽位视觉误读。

### Student Growth trends 第三步：7 天周视图和训练类型切换

- 趋势图现在按日级别固定展示 7 天窗口，横轴每天一个固定槽位，避免日期标签挤压重叠。
- 图表顶部新增上一周 / 下一周 / This week 筛选，用户可以按周切换查看历史趋势。
- Shooting、Dribbling、Training 改为分段按钮切换同一张趋势图，不再把三张趋势图依次堆叠，也不把运球、投篮和训练共享到同一条趋势线。
- 每天的柱子、折线节点、tooltip 命中区和日期标签已统一对齐到日期格子的中点，而不是贴在格子左端点。
- 前端优先并行读取三类 `/me/trends?analysis_type=...` 的后端日聚合数据；如果后端趋势为空，则用最近报告按日期和训练类型聚合兜底。

### Student Growth trends 第四步：7D / 30D 日级折线图

- 新增 7D / 30D 时间范围切换，30 天视图横轴按每日 slot 生成，保留日级趋势而不是按周或月聚合。
- 训练类型切换加入用户手动选择保护：首次加载仍可优先选择有数据的类型，但用户点击 Shooting / Dribbling / Training 后不会再被自动切回 Dribbling。
- 图表已从柱状图切换为折线图，节点、tooltip 命中区和日期标签统一使用日 slot 中心点定位。
- 30 天模式只显示必要日期标签，避免移动端横轴文字挤压；首尾日期 label 使用 CSS `clamp()` 保持可见，分数点和点击命中区仍对齐日 slot 中心。
- 顶部 header 已删除 `Live reports` badge，标题/说明独立占位，7D/30D 与日期选择控件使用响应式控制区，避免右侧窄栏和移动端把标题挤成逐词折行。

### Pose2D 上传/端侧分析状态第一版

- 上传后分析工作区新增 MediaPipe 时间线采集进度、样本数、覆盖秒数和分析中状态，用户能看到当前是否仍在采集帧。
- `View Analysis Report` 会等到整段视频时间线基本采集完成后解锁，避免只播放一小段就生成缺数据报告。
- 视频元素取消自动循环，播放结束后停在尾部并保留第一轮采集数据。
- 时间回跳、seek 或循环片段不会再清空已有 `allFrames` / dribble / training 时间线，只会忽略回跳帧，避免用户播放完后又循环 1 秒导致报告只使用循环片段。
- `Scrubber` 时间轴已修复单击不生效、需要双击才跳转的问题：range 单击/拖动结束会在浏览器更新值后提交 seek，父组件使用带 `requestId` 的 seek 请求保证每次交互都会触发视频跳转；键盘调整也会提交 seek。

### Pose2D 上传后自动整段端侧分析第一版

- 新增隐藏 `PoseAutoAnalyzer`，上传完成进入分析页后会自动加载 MediaPipe，并从视频开头到结尾按采样点抽帧分析。
- 自动分析结果会写入 `allFrames`，dribbling/training 模式会同步写入对应原始动作帧，报告评分优先使用这组完整 timeline。
- 自动分析期间 `Play` 暂时禁用，`View Analysis Report` 等自动整段采集完成后解锁；如果自动分析失败，页面会提示用户可手动播放一次作为兜底。
- Canvas 实时预览与自动分析共用 `poseMetrics` 指标提取工具，避免同一套 MediaPipe landmarks 口径被写成两份。
- 自动分析已补 metadata、seek 和首帧 decodable frame 等待 timeout，隐藏分析视频改为 `preload="auto"`，避免 0 秒首帧或视频解码等待卡死。
- 上传页提示文案已改为上传后自动分析，避免用户误以为仍必须手动播放到底才能生成报告。
- 保存报告时会在 `summary_data` 记录 `capture_source`、timeline 帧数/覆盖率和自动分析帧统计，并写入自动分析起止时间，后续可以直接确认评分来自整段自动采集还是手动播放兜底。
- 分析页预览已修复“画质像被压缩”的视觉问题：原生 `<video>` 负责显示上传视频，canvas 只覆盖骨架和角度，不再把视频帧重绘到 canvas 后作为可见画面。
- 上传完成时前端会读取原始本地视频的 `duration_seconds`、`width`、`height` 并随 `/uploads/complete` 提交，后端 `videos` 记录可用于和源文件对比确认是否发生真实压缩。

### Admin class 成员添加体验第一版

- 后端 `POST /api/v1/admin/classes/{class_public_id}/members` 支持通过 `username` 添加成员，同时兼容旧的 `user_public_id`。
- 后端新增 `POST /api/v1/admin/classes/{class_public_id}/members/bulk`，支持一次提交多个用户名，返回 `added` 和 `errors` 明细。
- 成员添加会校验用户必须 active、`member_role` 必须是 `coach` 或 `student`、用户实际角色必须与成员角色匹配、重复 active 成员会返回清晰错误。
- Admin class members 页面已从填写 `user public id` 改为粘贴用户名列表，支持空格、逗号、分号或换行分隔，并展示批量失败明细。

### Admin 运营表单与用户错误提示增强

- Admin announcement 表单已将 `publish_at` / `expire_at` 从手写 `ISO datetime` 改为日期 + 分钟级时间选择控件。
- 前端会把运营人员选择的本地日期时间组合为后端需要的 datetime payload；未选择日期时仍提交空值，保持“立即发布/不过期”的既有语义。
- Admin 创建/编辑用户时，`username`、`email`、`phone_number` 唯一性冲突已返回字段级明细，例如 `Username already exists.`、`Email already exists.`、`Phone number already exists.`。
- 多个字段同时重复时，后端会一次性返回多条冲突明细，前端 `apiRequest` 会聚合展示这些消息。

### Admin announcement 回归测试第一版

- 后端测试新增 Admin 发布 class announcement 后给 active class members 生成 notification 的覆盖。
- 后端测试新增 Admin announcement 列表返回 `notification_count` 的覆盖。
- 后端测试新增归档 announcement 后状态变为 `archived`，且既有 notification 不被删除的覆盖。

### Admin 筛选区 UI 修复第一步

- 新增共享 `AdminFilterControls`，让 Admin 筛选表单使用统一的可换行布局、标签和按钮样式。
- `/admin/tasks`、`/admin/announcements`、`/admin/notifications` 的筛选控件不再放在标题行右侧，避免被标题、详情栏或表格挤压遮挡。
- `/admin/tasks` 和 `/admin/notifications` 的 keyword 搜索框已并入筛选表单，Search 操作保持在同一块筛选区域内。

### 本轮验证

- `python -m compileall server\app`：通过，使用 Codex bundled Python。
- `npm.cmd run lint`：通过，仅有既存 warning。
- `npx.cmd tsc --noEmit --pretty false`：通过。
- `npm.cmd run build`：通过。
- `python -m unittest server.tests.test_report_service_idempotency`：通过，使用 Codex bundled Python，并临时把 `server` 与 `server/.venv/Lib/site-packages` 加入 `PYTHONPATH`。
- `python -m unittest server.tests.test_camp_operations_service`：通过，覆盖 Student announcement 可见性/已读、Admin 按用户名/批量添加 class member，以及 Admin 用户创建/编辑唯一性冲突字段级错误。
- 本轮追加验证：`python -m compileall server\app` 通过。
- 本轮追加验证：`python -m unittest server.tests.test_camp_operations_service` 通过，新增覆盖 Student task submission history。
- 本轮追加验证：`npx.cmd tsc --noEmit --pretty false --incremental false` 通过。
- 本轮追加验证：`npm.cmd run lint` 通过，仅有既存 warning。
- 本轮追加验证：`npm.cmd run build` 普通沙箱因 `web\.next\trace` 权限失败，提权重跑后通过。
- 本轮追加验证：`python -m compileall server\app` 通过；`python -m unittest server.tests.test_camp_operations_service` 通过，新增覆盖 Student task submit/detail API handler 的提交历史返回和学生隔离边界。
- 本轮追加验证：`npx.cmd tsc --noEmit --pretty false --incremental false` 通过；`npm.cmd run lint` 通过，仅有既存 warning；`npm.cmd run build` 普通沙箱因 `web\.next\trace` 权限失败，提权重跑后通过。
- 本轮追加验证：`python -m compileall server\app` 通过；`python -m unittest server.tests.test_camp_operations_service` 通过，新增覆盖非 Admin 访问 Admin 用户管理 handler 被拒绝，以及 Admin 禁用用户不会删除既有 report/session/task assignment。
- 本轮追加验证：`python -m compileall server\app` 通过；`python -m unittest server.tests.test_camp_operations_service` 通过，新增覆盖 Admin announcement 发布后生成通知、列表 notification_count，以及归档公告不删除既有通知。
- 本轮追加验证：`npx.cmd tsc --noEmit --pretty false --incremental false` 通过；`npm.cmd run lint` 通过，仅有既存 warning；`npm.cmd run build` 通过，新增覆盖 Weekly tasks 详情弹窗滚动修复和 Growth trends 第二版 UI/数据口径优化。
- 本轮追加验证：`npx.cmd tsc --noEmit --pretty false --incremental false` 通过；`npm.cmd run lint` 通过，仅有既存 warning；`npm.cmd run build` 通过，新增覆盖 Pose2D 上传/端侧分析等待状态、采集进度和循环播放数据保护。
- 本轮追加验证：`npx.cmd tsc --noEmit --pretty false --incremental false` 通过；`npm.cmd run lint` 通过，仅有既存 warning；`npm.cmd run build` 通过，新增覆盖 Pose2D 上传后自动整段 MediaPipe 抽帧采集、报告按钮等待自动采集完成和手动兜底。
- 本轮追加验证：`npx.cmd tsc --noEmit --pretty false --incremental false` 通过；`npm.cmd run lint` 通过，仅有既存 warning；`npm.cmd run build` 通过，新增覆盖 Pose2D 自动分析 metadata/seek/首帧等待 timeout 边界修复。
- 本轮追加验证：`npx.cmd tsc --noEmit --pretty false --incremental false` 通过；`npm.cmd run lint` 通过，仅有既存 warning；`npm.cmd run build` 通过，新增覆盖 Pose2D 隐藏分析视频 `preload="auto"` 和上传页自动分析提示文案。
- 本轮追加验证：`npm.cmd run build` 通过；`git diff --check` 通过，仅有 Windows 换行提示；新增覆盖 Pose2D 报告保存自动/手动采样来源、timeline 覆盖率和自动分析时间元数据。
- 本轮追加验证：`npx.cmd tsc --noEmit --pretty false --incremental false` 通过；`npm.cmd run lint` 通过，仅有既存 warning；`npm.cmd run build` 通过；`git diff --check` 通过，仅有 Windows 换行提示；新增覆盖 Admin Task / Announcement / Notification 筛选区独立可换行布局修复。
- 本轮追加验证：`npx.cmd tsc --noEmit --pretty false --incremental false` 通过；`npm.cmd run lint` 通过，仅有既存 warning；`npm.cmd run build` 通过；`git diff --check` 通过，仅有 Windows 换行提示；新增覆盖 Pose2D Scrubber 单击/键盘 seek 请求修复。
- 本轮追加验证：`npx.cmd tsc --noEmit --pretty false --incremental false` 通过；`npm.cmd run lint` 通过，仅有既存 warning；`npm.cmd run build` 通过；`git diff --check` 通过，仅有 Windows 换行提示；新增覆盖 Student `Growth trends` 7 天周视图、周切换和 Shooting / Dribbling / Training 分段按钮切换。
- 本轮追加验证：`python -m unittest server.tests.test_camp_operations_service` 通过，新增覆盖 Task progress 严格完成度规则；`npx.cmd tsc --noEmit --pretty false --incremental false` 通过；`npm.cmd run lint` 通过，仅有既存 warning；`npm.cmd run build` 通过；`git diff --check` 通过，仅有 Windows 换行提示。
- 本轮追加验证：`npx.cmd tsc --noEmit --pretty false --incremental false` 通过；`npm.cmd run lint` 通过，仅有既存 warning；`npm.cmd run build` 通过；`git diff --check` 通过，仅有 Windows 换行提示；新增覆盖 Growth trends 7D/30D 日级折线图、任务区固定高度滚动、个人中心移动端收口、Pose2D 原生 video 预览和上传视频 metadata 记录。
- 本轮追加验证：`npx.cmd tsc --noEmit --pretty false --incremental false` 通过；`npm.cmd run lint` 通过，仅有既存 warning；`npm.cmd run build` 通过；`git diff --check -- web\src\components\account\GrowthTrendsSection.tsx` 通过，仅有 Windows 换行提示；新增覆盖 Growth trends 横轴日期 label 首尾可见范围加固。
- 本轮追加验证：`npx.cmd tsc --noEmit --pretty false --incremental false` 通过；`npm.cmd run lint` 通过，仅有既存 warning；新增覆盖 Growth trends 顶部 header 响应式布局优化和 `Live reports` badge 删除。

未完成验证：

- `server/.venv/Scripts/python.exe` 仍然指向不可用的本机 Python 路径；后端测试当前依赖上述 `PYTHONPATH` workaround，后续仍建议重建 server venv。

## 已完成第一版：Admin 注册用户管理系统

### 目标

Admin 可以管理所有注册人员，重点是 coach 和 student 用户数据。Admin 需要具备增删改查或禁用/恢复权限。

状态：第一版已完成，下一轮不再作为主实现任务，但需要补测试和细节增强。

### 后端建议

新增或完善 Admin 用户管理接口：

- `GET /api/v1/admin/users`
  - 支持分页。
  - 支持按 `role` 过滤：`admin`、`coach`、`student`。
  - 支持按状态过滤：active、disabled、pending 等。
  - 支持关键词搜索：姓名、邮箱、手机号。
- `POST /api/v1/admin/users`
  - 创建 coach/student 用户档案。
  - 如当前认证体系暂不支持直接创建登录凭证，可先创建 profile，并保留 invite/reset password 后续任务。
  - 当 `username`、`email`、`phone_number` 发生唯一性冲突时，错误提示必须指出具体重复字段；当前笼统提示 `Username, phone number, or email already exists.` 不适合运营排查。
- `GET /api/v1/admin/users/{user_public_id}`
  - 查看用户详情。
  - 包含角色、状态、所属 camp/class、最近训练/任务概要。
- `PATCH /api/v1/admin/users/{user_public_id}`
  - 编辑姓名、联系方式、角色、状态、班级归属等允许 Admin 修改的字段。
- `DELETE /api/v1/admin/users/{user_public_id}` 或 `PATCH status`
  - 建议优先做软删除/禁用，避免破坏训练报告、任务、通知等历史数据。

权限要求：

- 只有 `admin` 可以访问这些接口。
- `coach` 不应能提升自己或其他用户权限。
- 删除/禁用用户时不得级联删除历史报告和训练记录。

### 前端建议

新增 Admin 用户管理页面：

- 路由建议：`/admin/users`
- 列表字段：
  - 用户名
  - 邮箱/手机号
  - 角色
  - 状态
  - 所属 camp/class
  - 最近活跃时间
  - 操作入口
- 必备操作：
  - 新增 coach/student
  - 编辑用户资料
  - 禁用/恢复用户
  - 查看用户详情
  - 将 student 分配到 class
  - 将 coach 分配到 class 或 camp

### 验收标准

- Admin 可以看到所有 coach/student：已完成。
- Admin 可以创建、编辑、禁用/恢复 coach/student：已完成第一版。
- 非 Admin 访问用户管理接口会被拒绝：已补 handler/service 回归测试。
- 用户被禁用后不会删除历史训练数据：已采用软禁用，并补 report/session/task assignment 保留测试。
- 创建/编辑用户时，用户名重复、邮箱重复、手机号重复应分别返回明确错误；多个字段重复时应能返回字段级明细：已完成服务层实现与回归测试。

## 已完成第一版：Admin 加载本地评分模板

### 目标

Admin 模板管理页需要显示当前已经存在的本地评分模板，并把这些模板与后端模板注册表建立稳定同步关系。

状态：第一版同步能力已完成，下一轮重点是测试补齐和详情展示优化。

本地模板位置：

- `web/src/config/templates/shooting`
- `web/src/config/templates/dribbling`
- `web/src/config/templates/training`

当前模板总数：

- Shooting：2 个
- Dribbling：5 个
- Training：5 个
- 合计：12 个

### 关键约束

- 不修改模板 JSON 的评分标准内容。
- 不改坏 `web/src/lib` 中已有评分计算逻辑。
- 后端同步逻辑应读取模板结构并保存元数据、版本、评分规则摘要，而不是重写模板。

### 后端建议

实现模板导入/同步能力：

- 增加模板同步 service 或脚本。
- 从 `web/src/config/templates` 读取本地 JSON。
- 建立本地模板与后端模板表的映射：
  - template code / template id
  - category：shooting、dribbling、training
  - display name
  - version
  - metrics / scoring rules
  - source path
  - active / visible 状态
- 支持 dry-run：
  - 显示将新增、更新、跳过哪些模板。
  - 避免误覆盖核心模板标准。
- 同步后写入或更新：
  - `training_templates`
  - `training_template_versions`

### 前端建议

完善 Admin 模板页：

- 能看到 12 个本地模板同步后的列表。
- 能按 category 过滤：shooting、dribbling、training。
- 能查看模板详情，但评分标准默认只读。
- 能管理可见性、示例视频、展示名称等后台元数据。

### 验收标准

- Admin 模板页能显示 12 个本地模板：同步执行后可显示。
- 同步过程不会修改 `web/src/config/templates/**/*.json`：已按只读导入实现。
- 模板详情能看到核心评分指标或规则摘要：后端已保存摘要，前端详情展示仍可增强。
- 学生端/训练端仍然使用原有评分逻辑正常计算：未改动评分逻辑，仍需回归测试覆盖。

## 已完成第一版：Coach 工作台左侧导航完善

### 当前问题

Coach 页面左侧导航原先有 `Classes`、`Reports`、`Tasks` 等入口，但点击后没有进入对应页面或视图，用户感知为“没有反应”。本轮已经完成第一版独立路由。

### 推荐方案

优先采用独立路由，而不是把所有内容继续塞在 `/coach` 一个页面中：

- `/coach/classes`
- `/coach/classes/[classId]`
- `/coach/students`
- `/coach/reports`
- `/coach/tasks`
- `/coach/announcements`
- `/coach/notifications`

如果短期想减少改动，也可以先在 `/coach` 内做 tab/hash 切换，但这只适合作为过渡方案。

### 前端任务

- 修正 Coach 左侧导航配置，确保每个入口指向真实路由或真实视图。
- 增加 active 状态，让当前页面高亮。
- `Classes` 页面展示教练负责的班级。
- `Reports` 页面展示学生训练报告列表，可按班级/学生/模板筛选。
- `Tasks` 页面展示教练发布或待处理的训练任务。

### 后端任务

如现有接口不足，补充：

- coach 负责的班级列表。
- coach 可见的报告列表。
- coach 发布、编辑、取消训练任务。
- coach 通知列表。

### 验收标准

- 点击 Coach 左侧导航会切换到明确页面或视图：已完成。
- 浏览器 URL 或页面 active 状态能反映当前入口：已完成。
- `Classes`、`Reports`、`Tasks` 至少有真实数据列表或明确空状态：已完成第一版。

剩余增强：

- `/coach/tasks` 当前偏聚合只读，可继续增加编辑/批量状态管理，或强化跳转到班级详情的上下文。
- `/coach/announcements` 和 `/coach/notifications` 已完成独立聚合页第一版，后续继续补页面测试、批量已读和关联对象跳转。
- Coach class announcements 链路已回到第一版可用状态；下一轮应补读取、发布、空列表和权限边界的回归测试。

## 已完成第一版：Admin 公告、任务、通知监督

### 目标

Admin 不只是管理 camp/classes，还需要能管理训练营运营内容。

状态：第一版已完成，下一轮重点转为测试补齐、审计日志、Coach 聚合入口和通知治理细节。

### Admin 公告发布

Admin 应能发布公告：

- 全局公告。
- 指定 camp 公告。
- 指定 class 公告。
- 指定角色公告：coach/student。

已实现接口：

- `GET /api/v1/admin/announcements`
- `POST /api/v1/admin/announcements`
- `PATCH /api/v1/admin/announcements/{announcement_public_id}`
- `DELETE /api/v1/admin/announcements/{announcement_public_id}`，归档公告。

### Admin 查看 Coach 任务

Admin 应能查看 coach 发布的训练任务：

- 按 coach 过滤。
- 按 class/camp 过滤。
- 按状态过滤：draft、published、completed、cancelled。
- 可查看任务关联模板、截止时间、完成情况。

已实现接口：

- `GET /api/v1/admin/tasks`
- `GET /api/v1/admin/tasks/{task_public_id}`
- `PATCH /api/v1/admin/tasks/{task_public_id}`

### Admin 查看通知

Admin 应能查看系统通知和 coach/student 相关通知：

- 任务发布通知。
- 公告通知。
- 报告生成通知。
- 用户加入/离开班级通知。

已实现接口：

- `GET /api/v1/admin/notifications`
- `GET /api/v1/admin/notifications/{notification_public_id}`

### 验收标准

- Admin 可以发布公告并按范围生成通知：已完成第一版，且已补发布/通知生成/归档后端回归测试第一版。
- Admin 可以看到 coach 发布的任务列表：已完成第一版。
- Admin 可以看到关键通知事件：已完成第一版。
- Coach 发布任务后，Admin 监督页能同步显示：后端通知写入已完成，仍需补自动化测试。

### 剩余增强

- 继续补 Admin announcement 更新、空列表、权限边界和异常输入的后端测试。
- 补 Admin 任务监督列表/详情/状态修改的后端测试。
- 增加公告、任务、通知的审计日志。
- 继续打磨 Coach `/coach/announcements`、`/coach/notifications` 聚合入口，补页面测试、批量已读和关联对象跳转。

## 公告链路后续工作

Admin announcement 和 Coach class announcement 不再作为下一轮阻塞修复项。Admin announcement 发布、通知生成、归档保留通知已补第一版回归测试；文档中保留的后续工作只包括：

- Admin announcement 更新、空列表、权限边界和异常输入的回归测试。
- Coach class announcement 发布、读取、空列表、批量更新和通知生成的回归测试。
- Coach `/coach/announcements`、`/coach/notifications` 聚合入口的页面测试、批量已读和关联对象跳转。

## 已完成第一版：Student 个人中心增强

### Growth trends 图表重做

状态：图表视觉、数据口径、训练类型切换和 7D/30D 日级折线图已完成，后续重点是前端自动化测试、浏览器视觉回归和真实数据空态持续打磨。

当前 Student 个人中心 `Growth trends` 已按前端技能要求重做为更清晰的折线图：

- 横轴为时间。
- 纵轴固定为 `0-100 score`。
- 使用折线、节点和淡色面积表达最近报告的单次/日聚合分数变化趋势，避免误读为累计分。
- 保持原本个人中心页面布局和信息层级，不新增大面积 hero 或扰乱现有 UI。
- 适配移动端与桌面端，坐标轴、tooltip、空状态都要清晰。

前端设计约束：

- 这是产品工作台页面，不做营销式 hero。
- 图表应融入现有 Student 个人中心布局。
- 用克制的视觉层级表达趋势，避免过多装饰、卡片堆叠或干扰主要训练信息。

本轮视觉升级：

- line chart 视觉升级已完成第四步：已改为低噪音数据面板、7D/30D 日级折线图、Shooting / Dribbling / Training 分段按钮切换、Latest / Best / Change 摘要和 hover/focus tooltip，让图表明确表达每天单次/日聚合 `0-100` 分数，不展示累计分。
- 移动端边界收口已完成第一轮，后续仍需补真实浏览器视觉回归和前端自动化测试。

### Weekly tasks 接真实任务

状态：第一版已完成，当前 `Weekly tasks` 已连接真实 tasks：

- 数据来自后端真实任务接口，而不是静态/模拟数据。
- 随着教练发布、更新、关闭任务而变化。
- 展示任务标题、截止时间、进度、状态和关联训练模板/动作。
- 空状态要明确提示当前没有教练发布的任务。

当前缺口：

- 学生任务提交链路已有第一版：可从个人中心任务卡进入对应训练上传页，或在任务详情弹窗中选择匹配报告提交任务并刷新任务状态。
- 提交历史与失败重试已完成第一版：任务详情接口返回已提交报告历史，前端详情弹窗展示历史并支持提交失败后原地重试。
- Student task submit/detail API handler 已补提交历史返回和学生隔离边界测试。
- 任务状态刷新策略已完成第一版：Weekly tasks 支持手动刷新和 60 秒静默轮询，刷新任务列表、可提交报告选项、dashboard 统计和已缓存的任务详情。
- 任务详情弹窗长内容滚动已完成第一版：提交历史过多时正文滚动，底部上传/提交按钮固定可见。
- 任务列表固定面板和内部滚动已完成第一版：任务过多时只滚动任务列表，不继续撑开个人中心双栏布局。
- 后续仍需要补更多页面测试和真实浏览器端到端流程。
- 任务上传的真实浏览器端到端流程仍需要用户手动测试和后续自动化覆盖。

### Student announcement 消息入口

状态：第一版已完成，当前已在 Student 个人中心增加 announcement 聚合入口：

- 在个人中心显示公告提醒入口和未读数量。
- 接收教练给 class 发布的 announcement。
- 接收管理员发布给全局、camp、class、student 角色的 announcement。
- 点击公告后可查看内容并标记已读。

剩余增强：

- 建设独立消息中心页面、批量已读、全部/未读筛选。
- 补 Student Weekly tasks 和 announcement 前端页面测试；任务轮询/手动刷新已完成第一版，后续可再演进为 SSE/WebSocket。
- 上传视频/端侧分析链路仍需继续打磨：等待/分析中状态、循环播放数据保护、采集完成后再解锁 View analysis、上传后自动整段 MediaPipe 抽帧采集、报告保存采样来源/timeline 覆盖率/自动分析时间元数据、Scrubber 单击 seek 修复、原生 video 预览和上传视频宽高/时长 metadata 记录已完成第一版；下一步补真实视频浏览器回归，并迁移到后端异步分析任务。

验收标准：

- 学生能在个人中心看到公告提醒入口。
- 有新公告时能够看到未读提示。
- 点击后能查看与自己相关的 announcement。

## 已完成第一版：Admin class 成员添加体验优化

状态：第一版已完成。Admin 在 classes 页面向 class 添加成员时，已经不再要求手动填写 `user public id`，可以改用用户名和批量粘贴名单。

- 支持填写用户名来新增 class 成员。
- 后端提供按 username 查询/添加 class member 的能力，避免运营人员手动复制 UUID。
- 前端输入框支持一次粘贴多个用户名，并展示成功/失败明细。
- 后端会校验用户名不存在、角色不匹配、已经在班级中等错误。

剩余增强：

- 增加用户搜索/autocomplete，显示用户名、角色、手机号/邮箱等必要确认信息。
- 扩展上传名单、批量预览和更细的运营校验。

验收标准：

- Admin 可以用用户名把 student/coach 加入 class。
- 用户名不存在、角色不匹配、已经在班级中时有清晰错误提示。
- 批量添加能返回成功/失败明细，不应整批静默失败。

## P2：测试补齐

下一轮建议至少补充以下测试：

- Admin 用户管理权限测试：已覆盖非 Admin 访问用户管理 handler 被拒绝。
- Admin 创建/编辑/禁用用户测试：创建/编辑唯一性和禁用历史保护已覆盖；仍需补更多恢复/重置密码流程。
- Admin 创建/编辑用户唯一性冲突测试：用户名、邮箱、手机号重复时分别返回明确错误。
- 非 Admin 访问 Admin 用户接口的拒绝测试：已覆盖用户管理 handler。
- 本地模板同步 dry-run 测试。
- 本地模板同步导入 12 个模板的测试。
- Coach 路由或导航配置的基础验证。
- Admin 公告发布和 Coach 任务监督接口测试：Admin announcement 发布/归档/通知生成已覆盖，仍需补更新、空列表、权限边界和异常输入。
- Admin announcement 列表、发布、归档、通知生成的回归测试：已覆盖发布后通知生成、列表 `notification_count` 和归档保留通知。
- Coach class announcements 空列表、发布、读取、批量更新的回归测试。
- Student Weekly tasks 真实任务数据联动测试；服务/API handler 层已覆盖提交历史返回和学生隔离，仍需补页面与浏览器端到端测试。
- Student announcement 消息入口页面测试；后端可见性/已读服务测试已补第一版。
- Admin 按 username 添加 class member 和批量添加测试；服务层测试已补第一版，仍需补 API 层/页面测试。

执行测试前需要注意后端 Python 环境：

- 当前 `server/.venv` 指向的 Python 解释器不可用。
- Codex bundled Python 可通过把 `server` 与 `server/.venv/Lib/site-packages` 加入 `PYTHONPATH` 来运行现有 unittest。
- 后续仍建议修复/重建 server venv，避免每次测试依赖 workaround。

## P2：后续技术增强

这些不是下一轮最优先任务，但需要继续排期：

- Supabase signed upload：让视频上传走安全直传。
- 后端异步 AI 分析：把训练分析从前端/同步链路逐步迁移到后端任务。
- 模板示例视频管理：Admin 上传、审核、发布、隐藏示例视频。
- 报告和任务通知的实时更新：Weekly tasks 已有轮询第一版；后续可考虑 SSE 或 WebSocket。

## 建议下一轮执行顺序

1. 继续打磨视频上传/端侧分析链路：端侧等待/分析中状态、循环播放数据保护、采集完成后再解锁 View analysis、上传后自动整段 MediaPipe 抽帧采集、报告保存采样来源/timeline 覆盖率/自动分析时间元数据、Scrubber 单击 seek 修复、原生 video 预览和上传视频宽高/时长 metadata 记录已完成第一版；下一步补真实视频浏览器回归并推进后端异步 AI 分析。
2. 继续打磨 Student 任务提交链路：提交历史、失败重试、API handler 边界测试、刷新策略、长内容滚动、任务列表固定面板和内部滚动已完成第一版，下一步补页面测试和浏览器端到端流程。
3. 继续补公告链路回归测试：Admin announcement 发布/归档/通知生成已完成第一版，下一步覆盖 Admin 更新/空列表/权限边界，以及 Coach class announcements 空列表/发布/读取/批量更新。
4. 补 Admin 后台测试：用户管理权限和禁用历史保护已补第一版，下一步继续补模板同步、任务监督和通知监督的后端自动化测试。
5. 继续打磨 Coach 聚合入口：为 `/coach/announcements`、`/coach/notifications` 补页面测试、批量已读和关联 class/task/report 的上下文跳转。
6. 继续打磨 Student 个人中心：独立消息中心、真实任务/公告页面测试、`Growth trends` 7D/30D 日级折线图、训练类型切换、任务滚动面板和移动端自适应布局的浏览器视觉回归。
7. 继续打磨 Admin class 成员添加：用户搜索/autocomplete、上传名单、API 层/页面测试。
8. 继续推进 Supabase signed upload、后端异步 AI 分析和模板示例视频审核发布流程。
