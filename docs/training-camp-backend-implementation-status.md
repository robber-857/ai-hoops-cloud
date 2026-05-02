# AI 篮球训练营开发状态说明

最后更新：2026-05-03

本文档只保留当前仍然有指导价值的开发状态。早期已经完成、已经被后续实现覆盖，或与当前产品状态矛盾的历史内容已清理。下一轮具体任务见 `docs/training-camp-backend-next-iteration-task-breakdown.md`。

## 当前阶段结论

篮球训练营系统已经具备学生端主链路、基础后台数据模型、登录角色跳转、Admin/Coach 初版页面和部分管理接口。当前主要缺口已经从“基础链路是否可用”转为“后台管理能力、教练工作台路由、模板标准导入、公告任务通知治理”。

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

### 3. Coach 初版能力

Coach 区域已有第一版页面和部分后端接口基础，包含：

- 教练首页。
- 班级概览/详情的基础数据结构。
- 学员档案与训练记录的基础展示能力。
- 任务、公告、通知相关的后端模型和初版页面方向。

当前问题：

- Coach 左侧导航中的 `Classes`、`Reports`、`Tasks` 等入口前端外观存在，但点击后没有进入独立可用页面或视图。
- 下一轮需要补齐 Coach 工作台路由或视图切换，让左侧导航成为真实工作入口。

### 4. Admin 初版能力

Admin 当前已经可以进行部分训练营后台管理：

- 新增和管理 camp。
- 新增和管理 classes。
- 管理班级成员的基础接口/页面方向。
- 管理模板元数据的第一版页面。

当前缺口：

- Admin 还没有完整的“所有注册人员管理系统”。
- Admin 还不能统一管理 coach/student 用户数据的增删改查。
- Admin 还不能发布面向全局、camp 或 class 的公告。
- Admin 还不能统一查看 coach 发布的 tasks 和 notifications。

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

当前问题：

- Admin 模板管理页还没有加载这些本地 JSON 模板。
- 后端模板注册表与前端本地评分模板之间还没有稳定的导入/同步桥接。
- 下一轮应实现“读取本地模板 -> 同步到后端模板表 -> Admin 可查看/管理元数据”的能力，但不得修改模板 JSON 的评分标准内容。

### 6. 视频与模板展示治理

已经完成第一版：

- Admin 模板页可以区分公开视频和后台占位/不可见视频。
- 学生端训练动作选择区域不会再暴露不适合作为公开视频的 dribbling 本地示例视频。
- 后续仍需补齐真实模板示例视频上传、审核和发布流程。

## 当前重要缺口

### P0 / P1 缺口

- Admin 用户管理系统缺失：需要能管理 coach、student 等注册用户数据。
- Admin 公告发布系统缺失：需要能按全局、camp、class 发布公告。
- Admin 监督视图缺失：需要能查看 coach 发布的 tasks 和 notifications。
- Coach 左侧导航未接入真实页面/视图：`Classes`、`Reports`、`Tasks` 点击后没有明显反应。
- Admin 模板页没有加载 `web/src/config/templates` 中已有的 12 个本地评分模板。

### 技术债与后续增强

- 后端测试覆盖仍不足，尤其是权限、用户管理、模板同步、任务公告通知等后台能力。
- 上传链路还需要接入 Supabase signed upload。
- AI 分析链路仍需要从前端/同步流程逐步演进为后端异步任务。
- 模板示例视频仍需要后台上传、可见性控制和发布审核流程。

## 最近验证记录

上一轮代码执行后已经验证：

- `npm.cmd run lint`：通过，仅有既存 warning。
- `npm.cmd run build`：通过。
- `python -m compileall server\app`：通过。
- `python -m unittest server.tests.test_report_service_idempotency`：通过。

本轮只整理开发文档，没有改动业务代码，也没有重新运行构建或单元测试。

## 下一阶段优先级

建议下一轮优先按以下顺序推进：

1. Admin 用户管理系统：先做 coach/student 用户列表、筛选、详情、创建、编辑、禁用/恢复。
2. Admin 模板同步：只读取并导入 `web/src/config/templates` 中的本地模板，不改模板 JSON 和评分逻辑。
3. Coach 工作台路由：让 `Classes`、`Reports`、`Tasks` 等左侧导航进入真实页面或稳定视图。
4. Admin 公告、任务、通知监督：Admin 可以发布公告，也可以查看 coach 发布的任务和通知。
5. 增加后端测试和必要的前端构建验证。
