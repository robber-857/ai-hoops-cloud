# 个人中心开发文档

## 0. 当前状态更新

截至 2026-04-30，个人中心第一版已经完成并接入后端聚合接口。

当前已完成：

- `/me` 页面
- 当前用户信息展示
- `Log out` 入口
- 最近报告列表
- 本周任务模块
- 成长趋势模块
- 核心统计卡片
- 历史报告跳转到 `/pose-2d/report?id={report_public_id}`
- 数据源已从前端直查 Supabase 报告表切换为 `/api/v1/me/*`

因此，本文档后续章节中“建议新增”“需要补齐”的描述应理解为早期规划记录，而不是当前未完成状态。当前剩余重点请以 [training-camp-backend-next-iteration-task-breakdown.md](<D:\githubproject\ai-hoops-cloud\docs\training-camp-backend-next-iteration-task-breakdown.md>) 为准。

## 1. 目标

当前项目已经有登录、注册和动作分析页面，但缺少一个统一的“个人中心”承接登录后的用户状态与长期使用场景。

目前主要问题有：

- 用户登录后没有明确的个人入口
- `shooting`、`dribbling`、`training`、`report` 页面没有 `log out`
- 缺少统一管理登录状态的界面
- 历史报告、训练任务、成长趋势没有聚合展示页

因此建议先规划并开发一个个人中心页面，作为登录后的主账号空间。

## 2. 产品定位

个人中心不是单纯的资料页，而是用户登录后的“训练档案主页”。

它需要同时承担四类功能：

- 账号管理：查看当前用户信息、退出登录
- 内容归档：查看历史报告记录
- 训练运营：展示本周任务和完成进度
- 成长反馈：展示分数趋势、训练频率和提升曲线

## 3. 页面定位与路由建议

建议新增一级页面路由：

- `/me`

对应前端路由建议扩展：

- `routes.user.me = "/me"`

选择 `/me` 的原因：

- 语义清晰，和 `/auth/me` 的“当前用户”概念一致
- 适合作为登录后的个人主页入口
- 后续扩展 `/me/reports`、`/me/tasks`、`/me/settings` 也自然

## 4. 个人中心信息架构

建议个人中心首页采用以下模块结构，自上而下排列：

### 4.1 顶部账号区

展示内容：

- 用户头像
- 用户昵称
- 用户名
- 手机号
- 邮箱
- 账号状态
- 最近登录时间

核心操作：

- `Log out`
- 进入账号设置

这个区域的第一优先目标是解决“退出登录没有统一入口”的问题。

### 4.2 历史报告模块

展示内容：

- 最近生成的报告列表
- 每条报告的分析类型
- 模板名称
- 得分
- 等级
- 生成时间
- 快捷入口：查看报告详情

建议交互：

- 默认展示最近 5 到 10 条
- 支持按 `shooting / dribbling / training` 筛选
- 支持点击后跳转到现有报告页

报告详情跳转建议直接复用现有页面：

- `/pose-2d/report?id={reportId}`

### 4.3 本周任务模块

展示内容：

- 本周目标任务
- 每个任务的完成状态
- 完成进度
- 推荐动作类型
- 截止时间

任务示例：

- 本周完成 3 次 shooting 分析
- 本周完成 2 次 dribbling 训练
- 本周至少查看 1 次历史报告
- 本周将某项得分提升到指定阈值

建议交互：

- 卡片式任务列表
- 已完成 / 进行中 / 未开始状态
- 支持点击查看任务来源或推荐动作

### 4.4 成长趋势模块

展示内容：

- 最近 7 天 / 30 天分数趋势
- 各动作类型平均分变化
- 本周训练频率
- 最佳成绩
- 连续训练天数

建议图表：

- 折线图：总分趋势
- 柱状图：按动作类型统计分析次数
- 小型指标卡：本周训练数、最佳成绩、连续训练天数

## 5. 页面布局建议

建议采用“两层结构”：

### 第一层：个人中心首页

模块顺序建议：

1. 顶部账号区
2. 核心数据概览
3. 本周任务
4. 成长趋势
5. 历史报告

### 第二层：后续扩展页

后续可以拆分为：

- `/me/reports`
- `/me/tasks`
- `/me/settings`

但第一阶段建议先只做一个聚合首页，降低开发复杂度。

## 6. UI 风格建议

个人中心建议延续当前 `pose-2d` 系列页面的高级深色运动科技风。

可复用的现有视觉语言：

- `PoseWorkspaceShell` 的深色玻璃卡片风格
- `report` 页的模块卡片和渐变背景
- 现有 `button`、`card`、`badge` 组件

个人中心视觉方向建议：

- 深色背景
- 强调数据面板感
- 模块卡片分层清晰
- 顶部账号区与趋势图模块视觉权重更高

## 7. 当前项目中可复用的能力

### 7.1 当前用户信息

前端已具备：

- `web/src/store/authStore.ts`
- `/auth/me`

这意味着个人中心可以直接读取当前登录用户资料，无需重新设计登录态来源。

### 7.2 历史报告详情页

现有可复用页面：

- `web/src/app/pose-2d/report/page.tsx`

个人中心只需要提供“历史列表”和跳转入口，不需要重做报告详情。

### 7.3 现有视觉组件

可复用组件：

- `web/src/components/ui/card.tsx`
- `web/src/components/ui/button.tsx`
- `web/src/components/ui/badge.tsx`

### 7.4 趋势图组件基础

现有报告页和指标页已经有图表表达思路，可延续到个人中心趋势模块中。

## 8. 当前项目中需要补齐的后端能力

本节是早期规划记录。当前个人中心已经接入后端聚合接口，但仍保留以下背景说明，方便理解演进过程。

### 8.1 logout 接口接入前端

后端已经有：

- `POST /auth/logout`

但个人中心需要把它作为可点击入口接到前端，并在退出后：

- 清理前端用户态
- 跳回登录页

### 8.2 历史报告接口

当前状态：

- 前端报告保存已经走 `POST /api/v1/reports`
- 个人中心历史报告已经走 `GET /api/v1/me/reports`
- 报告详情已经走 `GET /api/v1/reports/{report_public_id}`

### 8.3 本周任务接口

当前状态：

- 后端已有 `training_tasks` 和 `training_task_assignments`
- 个人中心任务列表已经走 `GET /api/v1/me/tasks`
- 教练端发布真实任务的接口尚未补齐

### 8.4 成长趋势接口

当前状态：

- 成长趋势已经走 `GET /api/v1/me/trends`
- 后端会优先读取 `student_growth_snapshots`，没有快照时回退到报告数据聚合

## 9. 前端组件拆分建议

建议未来按以下组件拆分：

- `web/src/app/me/page.tsx`
- `web/src/components/account/AccountCenterShell.tsx`
- `web/src/components/account/ProfileSummaryCard.tsx`
- `web/src/components/account/LogoutButton.tsx`
- `web/src/components/account/RecentReportsSection.tsx`
- `web/src/components/account/WeeklyTasksSection.tsx`
- `web/src/components/account/GrowthTrendsSection.tsx`
- `web/src/components/account/StatOverviewRow.tsx`

这样可以避免个人中心变成一个超大页面文件。

## 10. 个人中心首页模块定义

### 10.1 模块一：Profile Summary

目标：

- 给用户一个明确的“我已登录”的个人空间

展示字段：

- avatar
- nickname
- username
- email
- phone number
- membership level
- last login at

操作：

- Edit Profile
- Log out

### 10.2 模块二：Quick Stats

目标：

- 第一屏快速展示训练概况

建议字段：

- 总报告数
- 本周分析次数
- 最佳得分
- 最近一次分析时间

### 10.3 模块三：Weekly Tasks

目标：

- 强化持续使用和训练节奏

字段建议：

- task title
- task description
- progress
- due date
- related action type
- status

### 10.4 模块四：Growth Trends

目标：

- 呈现长期变化，而不是只看单次报告

建议字段：

- 7 日平均分
- 30 日平均分
- 本周动作分布
- 连续训练天数
- 分析次数曲线

### 10.5 模块五：Recent Reports

目标：

- 让用户快速回看历史分析

建议字段：

- report id
- analysis type
- template id / template display name
- score
- grade
- created at
- action: view report

## 11. 开发顺序建议

建议按以下顺序推进个人中心：

### 阶段 A：先做可用入口

- 新增 `/me` 页面
- 显示当前用户信息
- 接上 `Log out`

这个阶段的核心是先解决“登录后没有统一管理入口”的问题。

### 阶段 B：接入历史报告

- 先做“最近报告列表”
- 支持跳转报告详情
- 再做全部报告页或分页

### 阶段 C：补本周任务

- 先用静态任务结构验证页面
- 再接真实任务接口

### 阶段 D：补成长趋势

- 先基于历史报告做前端聚合
- 再升级为后端聚合接口

## 12. MVP 范围建议

如果只做第一版 MVP，建议范围如下：

- `/me` 页面
- 顶部账号区
- `Log out`
- 最近报告列表
- 4 个概览数据卡

MVP 中可以暂时不做：

- 全量任务系统
- 复杂趋势筛选
- 资料编辑
- 多设备会话管理

## 13. 验收标准

个人中心第一版完成后，至少应满足：

- 用户登录后可以进入 `/me`
- 用户可以在 `/me` 页面点击 `Log out`
- 用户退出后能回到登录页
- 用户可以看到自己的最近报告记录
- 用户可以从历史报告列表进入现有报告详情页
- 页面支持桌面端和移动端正常浏览

## 14. 与后续登录拦截的关系

个人中心不是登录拦截的替代，而是登录完成后的承接页。

后续推荐把登录后的完整体验串起来：

1. 未登录访问受保护页面时跳转登录页
2. 登录成功后可进入训练页或个人中心
3. 在个人中心统一管理账号、报告、任务和退出登录

因此个人中心开发完成后，下一步再统一补：

- 登录拦截
- 全局登录入口
- 顶部账号菜单
- 退出登录后的页面回跳逻辑

## 15. 一句话结论

个人中心应该作为“登录后用户的训练主页”来设计，而不是单纯资料页。

第一优先级是先补：

- 个人中心入口
- `Log out`
- 历史报告

然后再逐步扩展：

- 本周任务
- 成长趋势
- 设置与资料管理
