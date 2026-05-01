# AI 篮球训练营下一轮开发任务拆解清单

## 1. 文档目的

本文档承接当前实施状态文档：

- [training-camp-backend-implementation-status.md](<D:\githubproject\ai-hoops-cloud\docs\training-camp-backend-implementation-status.md>)

截至 2026-04-30，以下任务已经完成并进入已验证状态：

- 数据库迁移已在本地执行
- 前端上传链路已接 `POST /api/v1/uploads/init` 和 `POST /api/v1/uploads/complete`
- 报告保存已接 `POST /api/v1/reports`
- 报告详情页已接 `GET /api/v1/reports/{report_public_id}`
- 个人中心已接 `/me/*` 后端聚合接口
- 本地端到端上传、分析、保存、报告读取链路已验证正常
- 报告页模板选择后的评分会回写同一份报告，个人中心 Recent reports 会展示最后确认的模板评分
- 教练端第一批后端接口已完成：班级、学生、报告、发布任务、发布公告
- 已补一个报告重复保存幂等性的单元测试

因此本文档不再把“前端主链路迁移”作为下一轮目标，而是记录剩余未完成内容的建议推进顺序。

## 2. 下一轮总目标

下一轮建议目标是：把当前“学生端主链路已跑通”的能力，扩展为更完整的训练营运营闭环。

重点不再是主链路是否能保存报告，而是：

- 上传策略进一步后端化
- 教练端前端页面开始可用
- 管理员端开始可维护基础数据
- 自动化测试补齐
- 为后端异步 AI 分析做设计准备

## 3. 建议优先级

建议按下面顺序推进：

1. 服务端 Supabase 上传签名或上传凭证方案
2. 教练端第一版前端页面
3. 管理员端第一批接口
4. 自动化集成测试补齐
5. 后端异步 AI 分析链路设计与第一版实现

## 4. 任务拆解

## 4.1 任务 A：服务端 Supabase 上传签名或上传凭证

### 目标

把对象存储上传策略进一步收口到后端，减少前端对 Supabase Storage 细节的直接控制。

### 当前状态

当前已经完成：

- 后端创建 `training_session`
- 后端创建 `upload_task`
- 后端生成 `bucket_name` 和 `object_key`
- 前端按后端返回的路径上传 Supabase Storage
- 前端调用 `uploads/complete` 后，后端写入 `videos`、`upload_tasks`、`training_sessions`

当前尚未完成：

- 后端没有真正签发 Supabase 上传 URL
- 前端仍直接持有 Supabase Storage 客户端上传能力

### 建议任务内容

- 评估 Supabase 服务端 SDK 是否适合当前 FastAPI 服务
- 设计 `uploads/init` 的返回结构扩展：
  - 上传策略类型
  - 上传 URL 或 token
  - 过期时间
  - 允许的 content-type、size 限制
- 保持当前 `client_direct_supabase` 兼容
- 如引入签名上传，补充失败、过期、重试语义

### 完成标准

- 前端不再需要自己决定对象路径
- 上传策略由后端统一下发
- 上传失败、过期、重复完成回调有清晰处理

## 4.2 任务 B：教练端第一版前端页面

### 目标

基于已完成的教练端第一批后端接口，开发教练可以实际使用的前端页面，让教练围绕自己负责的班级开始做最小运营闭环。

### 已完成后端接口

- `GET /api/v1/coach/classes`
- `GET /api/v1/coach/classes/{class_public_id}/students`
- `GET /api/v1/coach/classes/{class_public_id}/reports`
- `POST /api/v1/coach/classes/{class_public_id}/tasks`
- `POST /api/v1/coach/classes/{class_public_id}/announcements`

### 关键权限规则

- `coach` 只能访问自己作为 active coach member 的班级
- `admin` 可作为全局管理角色访问
- 学生报告详情继续复用当前按班级归属访问的判断逻辑

### 建议前端页面范围

- `/coach`：教练首页，展示班级列表和最近运营概览
- `/coach/classes/{classPublicId}`：班级详情，包含学生列表、近期报告、任务发布、公告发布
- 班级学生列表支持点击进入学生训练档案的预留入口
- 班级报告列表支持跳转现有报告详情页 `/pose-2d/report?id={report_public_id}`
- 发布任务表单支持选择动作类型、模板、目标次数、目标分数、截止时间
- 发布公告表单支持标题、内容、置顶、发布时间、过期时间

更详细的前端准备文档见：

- [coach-portal-function-api.md](<D:\githubproject\ai-hoops-cloud\docs\coach-portal-function-api.md>)

### 完成标准

- 教练登录后能进入 `/coach`
- 教练能看到自己负责的班级
- 教练能进入班级详情页查看学生和报告
- 教练能发布训练任务，并看到发布成功后的反馈
- 教练能发布公告，并看到发布成功后的反馈
- 非教练用户访问教练端页面时有清晰的无权限处理

## 4.3 任务 C：管理员端第一批接口

### 目标

让管理员可以维护训练营组织结构和模板体系。

### 建议先补接口

- `GET /api/v1/admin/camps`
- `POST /api/v1/admin/camps`
- `GET /api/v1/admin/classes`
- `POST /api/v1/admin/classes`
- `POST /api/v1/admin/classes/{classPublicId}/members`
- `GET /api/v1/admin/training-templates`
- `POST /api/v1/admin/training-templates`
- `POST /api/v1/admin/training-templates/{templatePublicId}/versions`

### 完成标准

- 管理员能维护训练营
- 管理员能维护班级
- 管理员能维护班级成员关系
- 管理员能维护模板和模板版本

## 4.4 任务 D：自动化测试补齐

### 目标

把当前依赖手动验证的关键链路沉淀为可回归测试。

当前已有：

- `server/tests/test_report_service_idempotency.py` 覆盖重复保存同一 session 报告时，任务完成次数按唯一训练 session 计算

### 建议优先测试范围

- `POST /uploads/init`
- `POST /uploads/complete`
- `POST /reports`
- `GET /reports/{report_public_id}`
- `GET /me/dashboard`
- `GET /me/reports`
- 学员访问他人报告的 403
- 教练按班级归属访问学生报告
- 重复调用 `uploads/complete` 的幂等行为
- 重复保存同一 session 报告的覆盖或更新行为
- 教练访问自己班级的学生、报告、任务发布、公告发布
- 教练访问非自己班级时的 404/403 边界

### 完成标准

- 后端有覆盖主链路的 pytest 集成测试
- 权限边界有明确测试
- 本地开发可以一条命令跑完关键后端测试

## 4.5 任务 E：后端异步 AI 分析链路

### 目标

把当前“前端分析后提交报告”的过渡方案，逐步演进为“上传后后端异步分析并生成报告”。

### 建议任务内容

- 设计分析任务表或任务队列
- `uploads/complete` 后自动创建分析任务
- 增加分析状态：
  - queued
  - processing
  - completed
  - failed
- 后端运行 MediaPipe 或独立分析 worker
- 后端生成 `analysis_reports`
- 后端更新通知、任务、成长、成就

### 完成标准

- 学员上传完成后，可以不依赖前端本地分析生成报告
- 报告生成状态可查询
- 分析失败可重试或可见

## 5. 下一轮建议交付边界

如果下一轮只做一个清晰可交付版本，建议边界定为：

- 服务端上传策略方案定稿并实现第一版
- 教练端前端第一版完成班级、学生、报告、任务发布、公告发布
- 后端主链路测试覆盖上传、报告、个人中心和教练端权限

如果时间允许，再继续补：

- 管理员训练营、班级、成员维护
- 后端异步 AI 分析设计文档和任务模型草案

## 6. 下一轮完成后的预期状态

完成上述任务后，系统会进入下面这个状态：

- 学生端主链路稳定可回归
- 教练可以通过前端页面围绕班级查看学生训练情况并发布运营内容
- 管理员可以开始维护训练营基础数据
- 上传策略进一步从前端收口到后端
- 后端异步 AI 分析有清晰落地方向
# 2026-05-02 下一轮任务更新

> 本节为最新任务拆分。本文后续旧段落中“开发教练端第一版前端页面”已完成，不再作为下一轮主目标。

## 本轮已完成并移出下一轮范围

教练端第一版前端 MVP 已完成：

- `/coach` 教练首页
- `/coach/classes/{classPublicId}` 班级详情页
- 教练端 API service：`web/src/services/coach.ts`
- 教练端 UI 组件：`web/src/components/coach/*`
- 班级列表、学生列表、近期报告列表
- 训练任务发布表单
- 班级公告发布表单
- 报告跳转到现有 `/pose-2d/report?id={report_public_id}`
- coach/admin 权限态与非教练无权限态
- 科技风 3D CoachShell、Canvas 背景、Framer Motion 动效

验证：

- `npm.cmd run lint` 通过
- `npm.cmd run build` 通过
- Playwright mock API 视觉验证通过，Canvas 非空，移动端无横向溢出

## 下一轮总目标

下一轮目标从“教练端前端可用”调整为“补齐训练营运营闭环的后续后台能力与可回归测试”。

重点包括：

- 上传策略进一步后端化
- 教练端从 MVP 扩展到任务/公告/学生档案管理
- 管理员端具备维护训练营基础数据的第一批能力
- API 集成测试与权限边界测试补齐
- 后端异步 AI 分析链路进入设计和第一版实现

## 更新后的优先级

建议按以下顺序推进：

1. 服务端 Supabase 上传签名或上传凭证方案
2. 教练端后续运营接口与前端扩展
3. 管理员端第一批接口与基础前端
4. 自动化集成测试补齐
5. 后端异步 AI 分析链路设计与第一版实现

## 任务 A：服务端 Supabase 上传签名或上传凭证方案

目标不变：把对象存储上传策略进一步收口到后端，减少前端对 Supabase Storage 细节的直接控制。

建议本轮完成：

- 扩展 `POST /api/v1/uploads/init` 返回结构
- 返回上传策略类型，例如 `client_direct_supabase`、`signed_upload_url` 或 `server_proxy`
- 返回过期时间、允许 content-type、允许 size 范围
- 保持当前 `client_direct_supabase` 兼容
- 明确上传失败、凭证过期、重复 complete 的语义
- 更新 `web/src/services/uploads.ts` 和上传组件以读取后端下发策略

验收标准：

- 前端不再自行决定对象路径
- 上传策略由后端统一下发
- 旧的 Supabase 客户端直传路径仍可运行

## 任务 B：教练端后续运营能力扩展

教练端第一版页面已完成，下一轮建议补齐后续接口和页面能力。

建议新增或补齐接口：

- `GET /api/v1/coach/classes/{class_public_id}/tasks`
- `GET /api/v1/coach/classes/{class_public_id}/tasks/{task_public_id}`
- `PATCH /api/v1/coach/classes/{class_public_id}/tasks/{task_public_id}`
- `GET /api/v1/coach/classes/{class_public_id}/announcements`
- `PATCH /api/v1/coach/classes/{class_public_id}/announcements/{announcement_public_id}`
- `GET /api/v1/coach/students/{student_public_id}/profile`
- `GET /api/v1/coach/students/{student_public_id}/reports`
- `GET /api/v1/coach/dashboard`

建议前端扩展：

- 班级详情页增加任务列表
- 支持编辑任务、关闭任务
- 展示任务 assignment 完成情况
- 班级详情页增加公告列表
- 支持编辑公告、置顶公告、过期公告
- 增加学生训练档案页预览或第一版详情页
- 教练首页增加跨班级运营概览

验收标准：

- 教练可以查看已发布任务和公告
- 教练可以维护任务和公告状态
- 教练可以查看单个学生的训练档案和报告历史
- 权限仍按 coach active class member / admin 规则限制

## 任务 C：管理员端第一批接口与基础前端

建议先补接口：

- `GET /api/v1/admin/camps`
- `POST /api/v1/admin/camps`
- `GET /api/v1/admin/classes`
- `POST /api/v1/admin/classes`
- `PATCH /api/v1/admin/classes/{classPublicId}`
- `POST /api/v1/admin/classes/{classPublicId}/members`
- `DELETE /api/v1/admin/classes/{classPublicId}/members/{memberPublicId}`
- `GET /api/v1/admin/training-templates`
- `POST /api/v1/admin/training-templates`
- `POST /api/v1/admin/training-templates/{templatePublicId}/versions`

前端建议：

- `/admin` 管理概览
- `/admin/camps` 训练营维护
- `/admin/classes` 班级维护
- `/admin/classes/{classPublicId}/members` 班级成员维护
- `/admin/templates` 模板维护

验收标准：

- admin 可以维护训练营、班级、成员关系
- admin 可以维护训练模板和模板版本
- 非 admin 用户访问管理员接口返回明确无权限

## 任务 D：自动化集成测试补齐

优先测试范围：

- `POST /uploads/init`
- `POST /uploads/complete`
- `POST /reports`
- `GET /reports/{report_public_id}`
- `GET /me/dashboard`
- `GET /me/reports`
- 教练端班级、学生、报告、任务发布、公告发布接口
- 教练访问非自己班级的 403/404 边界
- 非 coach/admin 访问教练接口的 403
- 重复 `uploads/complete` 幂等行为
- 重复保存同一 session 报告的覆盖/更新行为

验收标准：

- 后端主链路有可回归集成测试
- 权限边界有明确测试
- 本地开发可以一条命令跑完关键测试

## 任务 E：后端异步 AI 分析链路

建议先做设计和最小闭环：

- 设计分析任务模型或任务队列
- `uploads/complete` 后创建分析任务
- 增加分析状态：`queued`、`processing`、`completed`、`failed`
- 设计 worker 运行 MediaPipe 或独立分析逻辑
- 后端生成 `analysis_reports`
- 失败任务可重试或可查询失败原因

验收标准：

- 学生上传完成后，后端可以创建待分析任务
- 报告生成状态可查询
- 前端可以展示分析排队/处理中/失败状态

## 下一轮建议交付边界

如果只做一个清晰可交付版本，建议边界为：

- 上传策略扩展第一版
- 教练端任务列表/公告列表/学生档案第一版
- 教练端与上传/报告/me 主链路的后端集成测试

如果时间允许，再继续补：

- 管理员端训练营、班级、成员维护
- 后端异步 AI 分析任务模型和 worker 草案
