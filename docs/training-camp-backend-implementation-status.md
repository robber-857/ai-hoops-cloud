# AI 篮球训练营开发状态说明

最后更新：2026-06-13

本文档只保留当前仍然有指导价值的开发状态。早期已经完成、已经被后续实现覆盖，或与当前产品状态矛盾的历史内容已清理。下一轮具体任务见 `docs/training-camp-backend-next-iteration-task-breakdown.md`。

## 当前阶段结论

篮球训练营系统已经具备学生端主链路、基础后台数据模型、登录角色跳转、Admin/Coach 初版页面、Admin 用户管理第一版、Admin 本地模板同步入口、Coach 关键工作台路由、Admin 公告/任务/通知监督第一版、Student 个人中心真实任务/公告入口第一版，以及 Admin 按用户名/批量添加 class 成员第一版。Admin / Coach 公告链路已经从阻塞修复项移出；当前主要缺口集中在更完整的测试覆盖、Coach 公告通知聚合入口、上传/异步分析增强和运营细节打磨。

本轮追加完成：

- Student 个人中心 `Growth trends` 在既有时间-分数折线图基础上升级为更有训练数据仪表盘感的图表：增加暗色分层背景、数据网格、扫描光、发光折线/节点、latest/peak 摘要和 hover/focus tooltip，同时保持原有个人中心布局。
- 后端新增当前用户通知接口：`GET /api/v1/me/notifications` 和 `POST /api/v1/me/notifications/{notification_public_id}/read`，供 Coach/Student 等角色查看自己的通知流并标记已读。
- Coach 左侧导航补齐 `Announcements` / `Notifications` 入口。
- 新增 `/coach/announcements` 聚合页，复用 `/me/announcements` 的当前用户可见性规则，让 Coach 能看到 Admin 全局/camp/class/role 公告以及 class announcements，并可标记已读。
- 新增 `/coach/notifications` 聚合页，展示当前 Coach 自己的通知流，支持类型和已读状态筛选，并可打开详情后标记已读。
- Student 任务提交链路补齐第一版：`/me/tasks` 返回任务详情上下文，新增 `/api/v1/me/tasks/{assignment_public_id}` 与 `/api/v1/me/tasks/{assignment_public_id}/submit-report`，学生可用已有匹配报告提交任务；个人中心任务卡新增训练入口和“使用最新匹配报告”入口；上传页可携带 task assignment / class / template 上下文，保存报告后继续沿用既有 assignment 进度刷新逻辑。
- Student Weekly tasks 补充任务详情弹窗与显式报告选择器第一版：学生可打开任务详情查看班级、模板、目标和进度，并从匹配报告下拉框中选择具体报告提交，不再只能默认提交最新匹配报告。
- Student Weekly tasks 继续补齐提交历史与失败重试第一版：`/me/tasks/{assignment_public_id}` 返回 `submission_reports`，前端详情弹窗展示已提交报告历史；提交失败时显示页面内错误和 Try again 重试。
- Student Weekly tasks 新增刷新策略第一版：任务区支持手动 Refresh，页面会每 60 秒静默刷新 dashboard/tasks/reports，并刷新已加载过的任务详情缓存。
- Admin announcement 发布/通知生成/归档流程补齐后端回归测试第一版：覆盖班级公告发布后给活跃成员生成通知、Admin 列表返回 notification_count，以及归档公告不删除既有通知。
- Student Weekly tasks 详情弹窗修复长内容可用性：弹窗正文增加内部滚动区，提交历史单独限制高度，底部 `Start task upload` / `Submit selected report` 操作区固定在弹窗底部，避免提交记录过多时看不到提交按钮。
- Student `Growth trends` 完成第二版 UI 和数据口径优化：趋势图优先展示最近报告的单次 `0-100` 分数，不再优先用后端日聚合 best score；图表改为折线 + 分数柱组合，增加 Latest / Best / Change 摘要、明确非累计说明和可访问 tooltip。
- Student `Growth trends` 完成第三步周视图与训练类型切换：趋势图按日级别固定展示 7 天窗口，顶部提供上一周 / 下一周 / This week 筛选；Shooting、Dribbling、Training 改为分段按钮切换同一张趋势图，不再把三类趋势图依次堆叠或混在同一条趋势线中；前端优先并行读取三类 `/me/trends?analysis_type=...` 日聚合数据，缺失时用最近报告按日期/类型聚合兜底；日期槽位、柱子、节点和命中区已统一按格子中点对齐。
- Student `Growth trends` 完成第四步 7D / 30D 折线图切换：图表从“折线 + 分数柱”改为单一折线/节点/淡色面积表达，移除柱状图；新增 7 天与 30 天日级窗口切换，30 天横轴按每日 slot 生成；训练类型切换加入用户手动选择保护，避免点击 Shooting / Training 后又被自动切回有数据的 Dribbling；横轴日期 label 使用日 slot 中心点作为理想位置，并对首尾可见范围做 `clamp()` 限制，降低窄屏裁切；顶部 header 已删除 `Live reports` badge，标题/说明和 7D/30D/日期选择控件分区排列，避免在右侧窄栏或移动端被日期控件挤压折叠。
- Student `Weekly tasks` 区域完成固定面板与内部滚动第一版：任务很多时不再无限撑高个人中心页面，任务列表在自适应高度容器中滚动；桌面端与 `Growth trends` 使用同一套视口高度节奏对齐，移动端按钮、标题和任务元数据会自动换行。
- Student 个人中心移动端自适应收口完成第一轮：外层 shell、Profile、Announcements、Recent reports 补齐 `min-w-0`、断词/截断、移动端按钮全宽和更紧凑的圆角/内边距，降低窄屏下边框重叠和内容横向溢出的概率。
- Pose2D 上传/端侧分析链路完成第二步增强：在等待/分析中状态、循环播放数据保护基础上，新增隐藏自动整段 MediaPipe 采集组件；上传完成进入分析页后会自动从 0 到结尾抽帧生成整段 timeline，`View Analysis Report` 使用自动采集完成的数据进行评分，自动分析失败时仍保留手动播放采集兜底；自动分析已补 metadata、seek 和首帧 decodable frame 等待 timeout，隐藏分析视频改为 `preload="auto"`，避免 0 秒首帧或视频解码等待卡死；上传页提示文案已改为上传后自动分析；报告保存时会在 `summary_data` 记录 `capture_source`、timeline 帧数/覆盖率和自动分析帧统计，并写入自动分析起止时间，方便后续排查评分是否来自整段自动采集；视频时间轴 Scrubber 已修复单击 seek 需要双击才生效的问题，单击或键盘调整都会提交一次明确的 seek 请求。
- Pose2D 上传后画质“被压缩”问题完成代码层排查与预览层修复：当前上传链路前端直接上传原始 `File` 到 Supabase，本地代理也原样上传文件，后端只登记 metadata，不存在转码/压缩逻辑；此前分析页把视频帧重绘到 canvas 且隐藏原生 video，导致大分辨率视频在预览框内二次采样后看起来变糊；现在原生 `<video>` 负责显示画面，canvas 只覆盖骨架与角度。
- Pose2D 上传完成时补充原始视频 metadata 记录：前端在上传完成前读取本地视频 `duration_seconds`、`width`、`height` 并随 `/uploads/complete` 提交，写入后端 `videos` 记录，方便后续用 `file_size`、分辨率和时长对比确认文件是否真的被压缩。
- Admin Task / Announcement / Notification 筛选区完成 UI 修复第一步：三页筛选控件已从标题右侧拆出，改为独立可换行筛选栏，所有筛选项增加明确标签，keyword 输入并入同一表单，避免在带右侧详情栏或中等宽度视口下被挤压遮挡。
- Task 进度规则已调整为严格完成度：默认 `target_sessions=1` 且 `target_score=0` 时，学生提交一个 completed report 会让 assignment 达到 100%；如果 Coach 配置了 `target_sessions` 和/或 `target_score`，进度会按已配置目标中最低的达成率计算，避免高分但次数不足时显示 100%；完成状态仍要求所有配置目标同时达标。

用户已在 2026-05-03 手动验证：

- `admin` 账号登录后可以正常跳转到 Admin 区域。
- `coach` 账号登录后可以正常跳转到 Coach 区域。
- `student` 账号登录后可以正常跳转到 Student/个人区域。

## 当前已完成能力

### 1. 账号登录与角色跳转

- 前端登录页已经按用户角色跳转到不同区域。
- 当前角色入口：
  - `admin` -> `/admin`
  - `coach` -> `/coach`
  - `student` / `user` -> `/me`
- 这部分已经通过用户手动测试确认。

### 2. 学生端核心链路

学生端上传、报告、个人中心等主链路已经具备基础可用能力：

- 训练视频上传记录。
- 报告查询与详情查看。
- 当前用户个人信息读取。
- 报告生成的幂等性测试已经有基础覆盖。

后续学生端重点不是重做主链路，而是接入更完整的真实训练任务、模板标准和后台异步分析。

本轮新增/完善：

- Student 个人中心 `Growth trends` 已重做为时间-分数折线图，纵轴固定为 `0-100 score`，并完成第一版视觉升级，同时保留原有个人中心信息层级。
- Student 个人中心 `Weekly tasks` 已停止使用基于报告生成的模拟任务，改为展示后端 `/me/tasks` 的真实教练任务；无任务时显示明确空状态。
- 后端新增 `/api/v1/me/announcements` 和 `/api/v1/me/announcements/{announcement_public_id}/read`，Student 可看到全局、camp、class、student 角色相关公告，并可标记已读。
- Student 个人中心新增 announcement 消息入口，显示未读数量、置顶状态和公告详情。

当前剩余问题：

- Student 个人中心 `Growth trends` 已完成单图训练类型切换、7D/30D 日级折线视图和柱状图移除；后续重点转为真实数据边界、前端自动化测试和浏览器视觉回归。
- Student announcement 目前是个人中心内聚合入口，尚未建设独立消息中心页面、批量已读和更完整的前端自动化测试。
- Student Weekly tasks 已接真实数据并补齐任务提交链路第一版：可从任务卡进入对应训练上传页，或在任务详情弹窗中选择匹配报告提交到任务并刷新状态；提交历史、失败重试、API handler 边界测试、刷新策略、详情弹窗长内容滚动、固定底部提交操作区、任务列表固定面板和内部滚动也已完成第一版；后续仍需要更完整的页面/浏览器端到端测试。

### 3. Coach 初版能力

Coach 区域已有第一版页面和部分后端接口基础，包含：

- 教练首页。
- 班级概览/详情的基础数据结构。
- 学员档案与训练记录的基础展示能力。
- 任务、公告、通知相关的后端模型和初版页面方向。

本轮新增/完善：

- Coach 左侧导航中的 `Classes`、`Reports`、`Tasks` 已经指向真实独立路由。
- 新增 `/coach/classes`，展示当前教练可见班级列表。
- 新增 `/coach/reports`，聚合展示可见班级的最近学生训练报告，并支持按班级筛选。
- 新增 `/coach/tasks`，聚合展示可见班级的训练任务，并支持按班级和状态筛选。

当前剩余问题：

- `/coach/tasks` 当前是聚合只读视图，任务编辑/发布主要仍在班级详情页完成。
- `/coach/announcements`、`/coach/notifications` 已有独立聚合页第一版；后续仍需补前端页面测试、更多跳转联动和批量已读。
- Coach class announcement 发布/读取链路已回到第一版可用状态；聚合入口已有第一版，后续重点是补回归测试、批量已读和关联对象跳转。

### 4. Admin 初版能力

Admin 当前已经可以进行训练营后台管理：

- 新增和管理 camp。
- 新增和管理 classes。
- 管理班级成员的基础接口/页面方向。
- 管理模板元数据的第一版页面。
- 管理注册用户的第一版能力：列表、筛选、详情、创建、编辑、禁用/恢复、班级分配。
- 在 class 成员管理页按用户名添加 student/coach，并支持一次粘贴多个用户名批量添加，返回成功/失败明细。
- 将本地评分模板 dry-run / sync 到后端模板注册表。
- 发布面向全局、camp、class、coach/student 角色的公告，并可选择生成通知。
- Admin announcement 表单已把 `publish_at` / `expire_at` 从手写 `ISO datetime` 改为日期 + 分钟级时间选择，并由前端组合成后端 datetime payload。
- 统一查看 coach 发布的训练任务，支持按 coach、camp、class、状态、动作类型和关键词筛选，并可查看任务完成情况。
- 统一查看系统通知，支持按通知类型、业务类型、接收角色、读状态和关键词筛选。
- Admin task / announcement / notification 筛选区已改为独立可换行操作栏，避免被标题区域、详情栏或表格区域挤压遮挡。
- Admin 创建/编辑用户时，`username`、`email`、`phone_number` 唯一性冲突已返回字段级明细，多个字段同时重复时会一次性返回多条错误。

当前缺口：

- Admin 公告、任务、通知监督已经具备第一版；Admin announcement 发布/通知/归档已补后端回归测试，后续仍缺审计日志、任务/通知监督测试和更完整的运营流程。
- Admin announcement 的列表/发布链路已回到第一版可用状态；发布后通知生成和归档保留通知已补自动化回归测试，后续可继续补更新、空列表和权限边界测试。
- Admin 用户管理已经具备第一版，唯一性冲突、非 Admin 拒绝访问和禁用历史数据保护已补第一版测试；后续仍缺邀请/重置密码流程和更多恢复场景测试。
- Admin class 成员添加已经支持用户名和批量粘贴第一版；后续仍可继续补用户搜索/autocomplete、上传名单和更细的批量校验体验。

### 5. 模板与评分资产

本地模板文件是当前评分标准的核心资产，不能随意改动。

模板文件位置：

- `web/src/config/templates/shooting`
- `web/src/config/templates/dribbling`
- `web/src/config/templates/training`

当前本地模板数量：

- Shooting：2 个
- Dribbling：5 个
- Training：5 个
- 合计：12 个

当前模板文件：

- `shoot_front_form_close.json`
- `shoot_side_form_close.json`
- `dribble_front_narrow_crossover.json`
- `dribble_front_onehand_oneside_height.json`
- `dribble_front_onehand_v.json`
- `dribble_side_narrow_crossover.json`
- `dribble_side_onehand_oneside.json`
- `deep_squat_reps_side.json`
- `high_knees_in_place_side.json`
- `pushup_hold_high_plank.json`
- `wall_sit_half_hold.json`
- `wall_sit_quarter_hold.json`

评分和计算逻辑主要位于：

- `web/src/lib`

本轮新增/完善：

- Admin 模板管理页新增本地模板 dry-run 和同步按钮。
- 后端新增 `POST /api/v1/admin/training-templates/sync-local?dry_run=true|false`。
- 同步逻辑只读取 `web/src/config/templates/*/*.json`，写入或更新 `training_templates` 和 `training_template_versions` 的元数据/版本/规则摘要，不修改本地 JSON。

当前剩余问题：

- 模板同步功能还缺少后端单元/集成测试。
- Admin 模板详情仍可继续优化“评分规则只读摘要”的展示方式。

### 6. 视频与模板展示治理

已经完成第一版：

- Admin 模板页可以区分公开视频和后台占位/不可见视频。
- 学生端训练动作选择区域不会再暴露不适合作为公开视频的 dribbling 本地示例视频。
- 后续仍需补齐真实模板示例视频上传、审核和发布流程。

## 当前重要缺口

### P1 / P2 缺口

- Student 个人中心增强已完成第一版：`Growth trends` 时间-分数折线图、`Weekly tasks` 接真实任务、任务提交历史/失败重试/刷新策略、announcement 消息提醒入口；后续重点是测试和独立详情页。
- Student `Growth trends` line chart 已完成 7D / 30D 日级视图和训练类型切换：现在按单张折线图展示 Shooting / Dribbling / Training，用户可切换训练类型和时间范围；图表已移除柱状图，节点、tooltip 命中区和日期槽位按日 slot 对齐；后续重点是真机/浏览器视觉回归和前端自动化测试。
- Admin class 成员添加体验已完成第一版：从填写 `user public id` 改为按用户名添加，并支持批量添加；后续重点是搜索选择器、上传名单和更完整测试。
- Admin announcement 起止时间填写体验需要优化：从手写 `ISO datetime` 改为日期 + 小时/分钟选择，避免运营人员不知道该按什么格式填写。
- Admin 用户创建/编辑重复字段错误需要优化：当用户名、邮箱或手机号重复时，必须指出具体重复项，而不是返回笼统错误。
- Admin 公告发布系统已完成第一版：发布/通知生成/归档已补后端回归测试，后续需要补审计日志、更新/空列表边界和前台/Coach 聚合展示联动。
- Admin 任务/通知监督视图已完成第一版，筛选区遮挡问题已完成前端修复第一步：后续需要补自动化测试和更多运营操作。
- Admin 用户管理、模板同步、Coach 路由已完成第一版；用户管理权限/禁用历史保护已补第一版测试，模板同步和 Coach 路由仍需继续补自动化测试和细节打磨。
- Coach announcements / notifications 独立聚合入口已有第一版，后续仍缺页面测试、批量已读和更多运营上下文。

### 技术债与后续增强

- 后端测试覆盖仍不足，尤其是模板同步、任务/通知监督、Coach 公告和更多权限边界等后台能力。
- 上传链路当前使用 Supabase 直接上传/本地代理兜底，未发现转码压缩；后续仍需要推进更安全的 signed upload 策略。
- AI 分析链路仍需要从前端/同步流程逐步演进为后端异步任务。
- 当前视频上传/分析仍是端侧计算，但已经从必须手动播放到底推进为上传后自动整段 MediaPipe 抽帧采集第一版；分析预览已改为原生 video 显示 + canvas 覆盖层，上传完成会记录本地视频宽高/时长 metadata；后续目标是补浏览器端真实视频回归，并逐步迁移为后端异步分析任务。
- 模板示例视频仍需要后台上传、可见性控制和发布审核流程。

## 最近验证记录

本轮代码执行后已经验证：

- `npm.cmd run lint`：通过，仅有既存 warning。
- `npm.cmd run build`：通过。
- `npx.cmd tsc --noEmit --pretty false`：通过。
- `python -m compileall server\app`：通过，使用 Codex bundled Python。
- `python -m unittest server.tests.test_report_service_idempotency`：通过，使用 Codex bundled Python，并临时把 `server` 与 `server/.venv/Lib/site-packages` 加入 `PYTHONPATH`。
- `python -m unittest server.tests.test_camp_operations_service`：通过，覆盖 Student announcement 可见性/已读、Admin 按用户名/批量添加 class member，以及 Admin 用户创建/编辑唯一性冲突字段级错误。
- 本轮追加验证：`python -m unittest server.tests.test_camp_operations_service` 通过，新增覆盖当前用户通知列表和通知已读。
- 本轮追加验证：`npm.cmd run lint` 通过，仅有既存 warning；`npx.cmd tsc --noEmit --pretty false` 通过；`npm.cmd run build` 通过，并确认 `/coach/announcements`、`/coach/notifications` 已进入 Next route 列表。
- 本轮追加验证：`python -m compileall server\app` 通过；`python -m unittest server.tests.test_camp_operations_service` 通过，新增覆盖 Student task submission history；`npx.cmd tsc --noEmit --pretty false --incremental false` 通过；`npm.cmd run lint` 通过，仅有既存 warning；`npm.cmd run build` 普通沙箱因 `web\.next\trace` 权限失败，提权重跑后通过。
- 本轮追加验证：`python -m compileall server\app` 通过；`python -m unittest server.tests.test_camp_operations_service` 通过，新增覆盖 Student task submit/detail API handler 的提交历史返回和学生隔离边界。
- 本轮追加验证：`npx.cmd tsc --noEmit --pretty false --incremental false` 通过；`npm.cmd run lint` 通过，仅有既存 warning；`npm.cmd run build` 普通沙箱因 `web\.next\trace` 权限失败，提权重跑后通过。
- 本轮追加验证：`python -m compileall server\app` 通过；`python -m unittest server.tests.test_camp_operations_service` 通过，新增覆盖非 Admin 访问 Admin 用户管理 handler 被拒绝，以及 Admin 禁用用户不会删除既有 report/session/task assignment。
- 本轮追加验证：`python -m compileall server\app` 通过；`python -m unittest server.tests.test_camp_operations_service` 通过，新增覆盖 Admin announcement 发布后生成通知、列表 notification_count，以及归档公告不删除既有通知。
- 本轮追加验证：`npx.cmd tsc --noEmit --pretty false --incremental false` 通过；`npm.cmd run lint` 通过，仅有既存 warning；`npm.cmd run build` 通过，覆盖 Student Weekly tasks 弹窗滚动修复和 `Growth trends` 第二版图表改动。
- 本轮追加验证：`npx.cmd tsc --noEmit --pretty false --incremental false` 通过；`npm.cmd run lint` 通过，仅有既存 warning；`npm.cmd run build` 通过，覆盖 Pose2D 上传/端侧分析等待状态、采集进度和循环播放数据保护改动。
- 本轮追加验证：`npx.cmd tsc --noEmit --pretty false --incremental false` 通过；`npm.cmd run lint` 通过，仅有既存 warning；`npm.cmd run build` 通过，覆盖 Pose2D 上传后自动整段 MediaPipe 抽帧采集、报告按钮等待自动采集完成和手动兜底改动。
- 本轮追加验证：`npx.cmd tsc --noEmit --pretty false --incremental false` 通过；`npm.cmd run lint` 通过，仅有既存 warning；`npm.cmd run build` 通过，覆盖 Pose2D 自动分析 metadata/seek/首帧等待 timeout 边界修复。
- 本轮追加验证：`npx.cmd tsc --noEmit --pretty false --incremental false` 通过；`npm.cmd run lint` 通过，仅有既存 warning；`npm.cmd run build` 通过，覆盖 Pose2D 隐藏分析视频 `preload="auto"` 和上传页自动分析提示文案。
- 本轮追加验证：`npm.cmd run build` 通过；`git diff --check` 通过，仅有 Windows 换行提示；覆盖 Pose2D 报告保存自动/手动采样来源、timeline 覆盖率和自动分析时间元数据。
- 本轮追加验证：`npx.cmd tsc --noEmit --pretty false --incremental false` 通过；`npm.cmd run lint` 通过，仅有既存 warning；`npm.cmd run build` 通过；`git diff --check` 通过，仅有 Windows 换行提示；覆盖 Admin Task / Announcement / Notification 筛选区独立可换行布局修复。
- 本轮追加验证：`npx.cmd tsc --noEmit --pretty false --incremental false` 通过；`npm.cmd run lint` 通过，仅有既存 warning；`npm.cmd run build` 通过；`git diff --check` 通过，仅有 Windows 换行提示；覆盖 Pose2D Scrubber 单击/键盘 seek 请求修复。
- 本轮追加验证：`npx.cmd tsc --noEmit --pretty false --incremental false` 通过；`npm.cmd run lint` 通过，仅有既存 warning；`npm.cmd run build` 通过；`git diff --check` 通过，仅有 Windows 换行提示；覆盖 Student `Growth trends` 7 天周视图、周切换和 Shooting / Dribbling / Training 分段按钮切换。
- 本轮追加验证：`python -m unittest server.tests.test_camp_operations_service` 通过，新增覆盖 Task progress 严格完成度规则；`npx.cmd tsc --noEmit --pretty false --incremental false` 通过；`npm.cmd run lint` 通过，仅有既存 warning；`npm.cmd run build` 通过；`git diff --check` 通过，仅有 Windows 换行提示。
- 本轮追加验证：`npx.cmd tsc --noEmit --pretty false --incremental false` 通过；`npm.cmd run lint` 通过，仅有既存 warning；`npm.cmd run build` 通过；`git diff --check` 通过，仅有 Windows 换行提示；覆盖 Growth trends 7D/30D 日级折线图、任务区固定高度滚动、个人中心移动端收口、Pose2D 原生 video 预览和上传视频 metadata 记录。
- 本轮追加验证：`npx.cmd tsc --noEmit --pretty false --incremental false` 通过；`npm.cmd run lint` 通过，仅有既存 warning；`npm.cmd run build` 通过；`git diff --check -- web\src\components\account\GrowthTrendsSection.tsx` 通过，仅有 Windows 换行提示；覆盖 Growth trends 横轴日期 label 首尾可见范围加固。
- 本轮追加验证：`npx.cmd tsc --noEmit --pretty false --incremental false` 通过；`npm.cmd run lint` 通过，仅有既存 warning；覆盖 Growth trends 顶部 header 响应式布局优化和 `Live reports` badge 删除。

未完成验证：

- `server/.venv/Scripts/python.exe` 仍然指向不可用的本机 Python 路径；后端测试当前依赖上述 `PYTHONPATH` workaround。后续仍建议重建 server venv。

## 下一阶段优先级

建议下一轮优先按以下顺序推进：

1. Student 任务提交链路继续打磨：提交历史、失败重试、API handler 边界测试、刷新策略和长内容滚动已完成第一版，下一步补页面测试和浏览器端到端流程。
2. 测试补齐：Admin 用户管理权限/禁用历史保护、Admin announcement 发布/通知生成/归档已补第一版；继续补 Coach class announcement 读取/发布/批量更新、任务监督、通知监督、模板同步 dry-run/import、非 Admin 访问其他 Admin 能力的拒绝测试。
3. Coach 聚合入口继续打磨：为 `/coach/announcements`、`/coach/notifications` 补前端页面测试、批量已读和跳转到关联 class/task/report 的上下文。
4. Student 个人中心视觉回归：为升级后的 `Growth trends` 7D/30D 日级折线图、训练类型切换按钮、任务区滚动面板和移动端自适应布局补浏览器视觉验证。
5. Student 个人中心后续增强：补独立消息中心、批量已读、任务详情独立页和页面测试。
6. Admin class 成员添加继续打磨：补用户搜索/autocomplete、上传名单和更完整的批量添加测试。
7. 视频上传/分析链路继续打磨：端侧等待/分析中状态、循环播放数据保护、采集完成后再解锁 View analysis、上传后自动整段 MediaPipe 抽帧采集、报告保存采样来源/timeline 覆盖率/自动分析时间元数据、Scrubber 单击 seek 修复、原生 video 预览和上传视频宽高/时长 metadata 记录已完成第一版；下一步补真实视频浏览器回归并推进后端异步 AI 分析。
8. 技术增强继续排期：Supabase signed upload、后端异步 AI 分析、模板示例视频审核发布流程。
