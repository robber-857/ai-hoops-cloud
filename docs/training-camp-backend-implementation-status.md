# AI 篮球训练营开发状态说明

最后更新：2026-05-05

本文档只保留当前仍然有指导价值的开发状态。早期已经完成、已经被后续实现覆盖，或与当前产品状态矛盾的历史内容已清理。下一轮具体任务见 `docs/training-camp-backend-next-iteration-task-breakdown.md`。

## 当前阶段结论

篮球训练营系统已经具备学生端主链路、基础后台数据模型、登录角色跳转、Admin/Coach 初版页面、Admin 用户管理第一版、Admin 本地模板同步入口、Coach 关键工作台路由、Admin 公告/任务/通知监督第一版、Student 个人中心真实任务/公告入口第一版，以及 Admin 按用户名/批量添加 class 成员第一版。Admin / Coach 公告链路已经从阻塞修复项移出；当前主要缺口集中在更完整的测试覆盖、Coach 公告通知聚合入口、上传/异步分析增强和运营细节打磨。

本轮追加完成：

- Student 个人中心 `Growth trends` 在既有时间-分数折线图基础上升级为更有训练数据仪表盘感的图表：增加暗色分层背景、数据网格、扫描光、发光折线/节点、latest/peak 摘要和 hover/focus tooltip，同时保持原有个人中心布局。
- 后端新增当前用户通知接口：`GET /api/v1/me/notifications` 和 `POST /api/v1/me/notifications/{notification_public_id}/read`，供 Coach/Student 等角色查看自己的通知流并标记已读。
- Coach 左侧导航补齐 `Announcements` / `Notifications` 入口。
- 新增 `/coach/announcements` 聚合页，复用 `/me/announcements` 的当前用户可见性规则，让 Coach 能看到 Admin 全局/camp/class/role 公告以及 class announcements，并可标记已读。
- 新增 `/coach/notifications` 聚合页，展示当前 Coach 自己的通知流，支持类型和已读状态筛选，并可打开详情后标记已读。

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

- Student 个人中心 `Growth trends` 已完成视觉升级；后续重点转为真实数据边界、前端自动化测试和浏览器视觉回归。
- Student announcement 目前是个人中心内聚合入口，尚未建设独立消息中心页面、批量已读和更完整的前端自动化测试。
- Student Weekly tasks 已接真实数据，但当前学生只能查看任务，不能提交任务；后续需要补任务详情、任务提交入口、关联训练上传/报告、提交后进度与状态更新，以及实时刷新。

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
- Admin 创建/编辑用户时，`username`、`email`、`phone_number` 唯一性冲突已返回字段级明细，多个字段同时重复时会一次性返回多条错误。

当前缺口：

- Admin 公告、任务、通知监督已经具备第一版，但还缺少自动化测试、审计日志和更完整的运营流程。
- Admin announcement 的列表/发布链路已回到第一版可用状态；后续仍需要补公告发布、通知生成和归档流程的自动化回归测试。
- Admin 用户管理已经具备第一版，唯一性冲突已补字段级测试；后续仍缺更完整的权限、禁用历史数据保护、邀请/重置密码流程测试。
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

- Student 个人中心增强已完成第一版：`Growth trends` 时间-分数折线图、`Weekly tasks` 接真实任务、announcement 消息提醒入口；后续重点是测试、详情页和实时刷新。
- Student `Growth trends` line chart 视觉升级第一版已完成；后续重点是浏览器视觉回归、移动端边界和前端自动化测试。
- Admin class 成员添加体验已完成第一版：从填写 `user public id` 改为按用户名添加，并支持批量添加；后续重点是搜索选择器、上传名单和更完整测试。
- Admin announcement 起止时间填写体验需要优化：从手写 `ISO datetime` 改为日期 + 小时/分钟选择，避免运营人员不知道该按什么格式填写。
- Admin 用户创建/编辑重复字段错误需要优化：当用户名、邮箱或手机号重复时，必须指出具体重复项，而不是返回笼统错误。
- Admin 公告发布系统已完成第一版：后续需要补自动化测试、审计日志和前台/Coach 聚合展示联动。
- Admin 任务/通知监督视图已完成第一版：后续需要补自动化测试和更多运营操作。
- Admin 用户管理、模板同步、Coach 路由已完成第一版，但还需要补自动化测试和细节打磨。
- Coach announcements / notifications 独立聚合入口已有第一版，后续仍缺页面测试、批量已读和更多运营上下文。

### 技术债与后续增强

- 后端测试覆盖仍不足，尤其是权限、用户管理、模板同步、任务公告通知等后台能力。
- 上传链路还需要接入 Supabase signed upload。
- AI 分析链路仍需要从前端/同步流程逐步演进为后端异步任务。
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

未完成验证：

- `server/.venv/Scripts/python.exe` 仍然指向不可用的本机 Python 路径；后端测试当前依赖上述 `PYTHONPATH` workaround。后续仍建议重建 server venv。

## 下一阶段优先级

建议下一轮优先按以下顺序推进：

1. Student 任务提交链路：补任务详情页/弹窗、提交任务入口、关联训练上传或已有训练报告、提交后更新 assignment 进度与状态，并补真实任务联动测试。
2. 测试补齐：继续补 Admin 用户管理权限、禁用历史数据保护、Admin announcement 发布/通知生成/归档、Coach class announcement 读取/发布/批量更新、任务监督、通知监督、模板同步 dry-run/import、非 Admin 拒绝访问。
3. Coach 聚合入口继续打磨：为 `/coach/announcements`、`/coach/notifications` 补前端页面测试、批量已读和跳转到关联 class/task/report 的上下文。
4. Student 个人中心视觉回归：为升级后的 `Growth trends` line chart 补浏览器视觉验证和移动端边界检查。
5. Student 个人中心后续增强：补独立消息中心、批量已读、任务详情跳转和刷新策略。
6. Admin class 成员添加继续打磨：补用户搜索/autocomplete、上传名单和更完整的批量添加测试。
7. 技术增强继续排期：Supabase signed upload、后端异步 AI 分析、模板示例视频审核发布流程。
