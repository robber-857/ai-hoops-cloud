# AI 篮球训练营开发状态说明

最后更新：2026-05-04

本文档只保留当前仍然有指导价值的开发状态。早期已经完成、已经被后续实现覆盖，或与当前产品状态矛盾的历史内容已清理。下一轮具体任务见 `docs/training-camp-backend-next-iteration-task-breakdown.md`。

## 当前阶段结论

篮球训练营系统已经具备学生端主链路、基础后台数据模型、登录角色跳转、Admin/Coach 初版页面、Admin 用户管理第一版、Admin 本地模板同步入口、Coach 关键工作台路由，以及 Admin 公告/任务/通知监督第一版。当前主要缺口已经从“基础链路是否可用”转为“测试覆盖、Coach 公告通知聚合入口、上传/异步分析增强和运营细节打磨”。

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

当前新增反馈/待优化：

- Student 个人中心 `Growth trends` 趋势图当前观感不佳；后续应按前端设计规范重做为折线图，横轴为时间，纵轴固定为 `0-100 score`，并保持原有个人中心页面布局不被扰乱。
- Student 个人中心 `Weekly tasks` 需要连接真实训练任务数据，随着教练发布、更新任务而变化，不能继续使用静态或模拟任务。
- Student 个人中心还缺少公告/通知入口；后续可以设计一个消息提醒按钮，用于接收教练和管理员发给学生的 announcement。

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
- `/coach/announcements`、`/coach/notifications` 还没有独立聚合页。
- Coach 当前发布/读取 announcement 存在阻塞错误：请求 `GET http://localhost:8000/api/v1/coach/classes/de54750a-15a3-4bfb-b61e-3433c6a7575c/announcements?limit=50` 返回 `500 Internal Server Error`，前端显示 `fail to fetch`，需要下一轮优先排查。

### 4. Admin 初版能力

Admin 当前已经可以进行训练营后台管理：

- 新增和管理 camp。
- 新增和管理 classes。
- 管理班级成员的基础接口/页面方向。
- 管理模板元数据的第一版页面。
- 管理注册用户的第一版能力：列表、筛选、详情、创建、编辑、禁用/恢复、班级分配。
- 将本地评分模板 dry-run / sync 到后端模板注册表。
- 发布面向全局、camp、class、coach/student 角色的公告，并可选择生成通知。
- 统一查看 coach 发布的训练任务，支持按 coach、camp、class、状态、动作类型和关键词筛选，并可查看任务完成情况。
- 统一查看系统通知，支持按通知类型、业务类型、接收角色、读状态和关键词筛选。

当前缺口：

- Admin 公告、任务、通知监督已经具备第一版，但还缺少自动化测试、审计日志和更完整的运营流程。
- Admin announcement 当前存在报错，需要下一轮优先排查公告列表/发布链路。
- Admin announcement 的发布时间/过期时间字段当前要求填写 `ISO datetime`，对非 IT 管理员不友好；后续前端应改为日期选择 + 时间选择控件，由系统组合成后端需要的 `publish_at` / `expire_at` 格式。
- Admin 用户管理已经具备第一版，但还缺少专门的后端自动化测试和更细的邀请/重置密码流程。
- Admin 在 classes 页面向 class 添加成员时，目前需要填写被添加用户的 `user public id`；后续应改为填写用户名添加成员，并扩展批量添加操作。

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

### P0 / P1 缺口

- Admin announcement 和 Coach class announcement 当前有实际报错，需要优先修复。
- Student 个人中心需要增强：`Growth trends` 改为时间-分数折线图、`Weekly tasks` 接真实任务、增加 announcement 消息提醒入口。
- Admin class 成员添加体验需要优化：从填写 `user public id` 改为按用户名添加，并支持批量添加。
- Admin announcement 起止时间填写体验需要优化：从手写 `ISO datetime` 改为日期 + 时间选择，避免运营人员不知道该按什么格式填写。
- Admin 公告发布系统已完成第一版：后续需要补自动化测试、审计日志和前台/Coach 聚合展示联动。
- Admin 任务/通知监督视图已完成第一版：后续需要补自动化测试和更多运营操作。
- Admin 用户管理、模板同步、Coach 路由已完成第一版，但还需要补自动化测试和细节打磨。
- Coach 还缺少 announcements / notifications 的独立聚合入口。

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

未完成验证：

- `server/.venv/Scripts/python.exe` 仍然指向不可用的本机 Python 路径；后端测试当前依赖上述 `PYTHONPATH` workaround。后续仍建议重建 server venv。

## 下一阶段优先级

建议下一轮优先按以下顺序推进：

1. 测试补齐：优先补 Admin 用户管理权限、公告发布、任务监督、通知监督、模板同步 dry-run/import、非 Admin 拒绝访问。
2. 公告阻塞 bug 修复：优先排查 Admin announcement 报错，以及 Coach class announcements `500 Internal Server Error`。
3. Student 个人中心增强：重做 `Growth trends` 折线图、接入真实 `Weekly tasks`、增加 announcement 消息提醒入口。
4. Admin class 成员添加体验优化：支持按用户名添加成员，并设计批量添加流程。
5. Coach 聚合入口增强：补 `/coach/announcements`、`/coach/notifications`，并让 Coach 能看到 Admin 全局/camp/角色公告。
6. Admin 运营细节：补公告/任务/通知审计日志、批量操作、通知重发/撤回策略，并把 announcement 起止时间输入从手写 `ISO datetime` 改为日期 + 时间选择。
7. 技术增强继续排期：Supabase signed upload、后端异步 AI 分析、模板示例视频审核发布流程。
