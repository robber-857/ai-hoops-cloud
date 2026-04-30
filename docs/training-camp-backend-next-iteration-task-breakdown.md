# AI 篮球训练营后端下一轮开发任务拆解清单

## 1. 文档目的

本文档用于承接以下两份文档：

- 目标设计文档：
  [training-camp-backend-data-design.md](<D:\githubproject\ai-hoops-cloud\docs\training-camp-backend-data-design.md>)
- 当前实施状态文档：
  [training-camp-backend-implementation-status.md](<D:\githubproject\ai-hoops-cloud\docs\training-camp-backend-implementation-status.md>)

本文档重点回答：

- 下一轮具体先做什么
- 每一项开发任务的目标是什么
- 建议按什么顺序推进
- 哪些任务会影响前后端联调

## 2. 下一轮总目标

下一轮建议把重点放在“让前端真正切到新的后端主记录源”。

也就是说，下一轮的主目标不是继续铺很多新表，而是把已经写好的后端能力真正接起来，让训练上传、报告保存、个人中心、模板读取都从 PostgreSQL 主链路跑通。

## 3. 建议优先级

建议按下面顺序推进：

1. 执行数据库迁移并验证库结构
2. 前端上传链路接入后端 API
3. 前端报告保存与报告读取接入后端 API
4. 前端个人中心接入 `/me/*`
5. 补服务端 Supabase 上传接入
6. 补教练端接口
7. 补管理员端接口
8. 最后再推进后端异步 AI 分析

## 4. 任务拆解

## 4.1 任务 A：执行数据库迁移

### 目标

把当前新增的数据模型真正同步到 PostgreSQL。

### 任务内容

- 确认 `server/.env` 或 Render 环境变量中的数据库配置正确
- 在 `server/` 目录执行 Alembic 迁移
- 确认以下表已成功创建：
  - `training_camps`
  - `camp_classes`
  - `class_members`
  - `training_templates`
  - `training_template_versions`
  - `template_example_videos`
  - `training_sessions`
  - `training_tasks`
  - `training_task_assignments`
  - `announcements`
  - `announcement_reads`
  - `notifications`
  - `student_growth_snapshots`
  - `achievements`
  - `student_achievements`
  - `student_goals`

### 完成标准

- `alembic upgrade head` 成功
- 数据库中能看到新增表和新增字段
- 不出现 migration 中断或枚举冲突

## 4.2 任务 B：前端上传链路切到后端

### 目标

让前端不再自己定义上传会话主记录，而是通过后端创建 `training_session` 和 `upload_task`。

### 任务内容

- 改造上传页或上传组件，先调用 `POST /api/v1/uploads/init`
- 使用后端返回的：
  - `session_public_id`
  - `upload_task_public_id`
  - `bucket_name`
  - `object_key`
- 完成 Supabase 上传后，再调用 `POST /api/v1/uploads/complete`

### 主要影响文件

- [UploadDropZone.tsx](<D:\githubproject\ai-hoops-cloud\web\src\components\Pose2D\UploadDropZone.tsx>)
- 可能新增 `web/src/services/uploads.ts`
- 可能扩展 `web/src/services/client.ts`

### 完成标准

- 上传一个视频后，数据库能看到：
  - `training_sessions`
  - `upload_tasks`
  - `videos`
- 前端上传逻辑不再只依赖 Supabase 客户端本地流程

## 4.3 任务 C：报告保存改走后端

### 目标

前端分析结果不再直接写 Supabase `analysis_reports`，改为提交后端保存。

### 任务内容

- 前端生成评分结果后，调用 `POST /api/v1/reports`
- 请求里传入：
  - `session_public_id`
  - `template_code`
  - `template_version`
  - `overall_score`
  - `grade`
  - `score_data`
  - `timeline_data`
  - `summary_data`

### 主要影响文件

- [PoseAnalysisView.tsx](<D:\githubproject\ai-hoops-cloud\web\src\components\Pose2D\PoseAnalysisView.tsx>)
- 可能新增 `web/src/services/reports.ts`

### 完成标准

- 前端点击生成报告后，后端成功写入：
  - `analysis_reports`
  - `report_snapshots`
  - 相关 `notifications`
- 页面跳转时使用后端返回的 `report_public_id`

## 4.4 任务 D：报告页读取改走后端

### 目标

报告详情页不再直接查 Supabase。

### 任务内容

- 报告页改为调用 `GET /api/v1/reports/{report_public_id}`
- 路由参数逐步从旧的 `id` 数字模式切到 `public_id`
- 页面内部映射后端返回的：
  - `score_data`
  - `timeline_data`
  - `summary_data`
  - `video_url`

### 主要影响文件

- [page.tsx](<D:\githubproject\ai-hoops-cloud\web\src\app\pose-2d\report\page.tsx>)

### 完成标准

- 报告页完全不依赖 Supabase 报告表
- 学员打开历史报告时，数据来自后端 API

## 4.5 任务 E：个人中心改走 `/me/*`

### 目标

把个人中心从“前端直接查 Supabase”切到“后端聚合接口”。

### 任务内容

- 概览数据改读 `GET /api/v1/me/dashboard`
- 历史报告列表改读 `GET /api/v1/me/reports`
- 历史训练记录改读 `GET /api/v1/me/training-sessions`
- 本周任务改读 `GET /api/v1/me/tasks`
- 成就改读 `GET /api/v1/me/achievements`
- 趋势改读 `GET /api/v1/me/trends`

### 主要影响文件

- [page.tsx](<D:\githubproject\ai-hoops-cloud\web\src\app\me\page.tsx>)
- [GrowthTrendsSection.tsx](<D:\githubproject\ai-hoops-cloud\web\src\components\account\GrowthTrendsSection.tsx>)
- [AccountCenterShell.tsx](<D:\githubproject\ai-hoops-cloud\web\src\components\account\AccountCenterShell.tsx>)

### 完成标准

- `/me` 页面不再直接查 Supabase 报告数据
- 个人中心所有主要数据来自后端聚合接口

## 4.6 任务 F：服务端 Supabase 上传接入

### 目标

把上传路径和上传策略进一步收口到后端。

### 任务内容

- 评估是否接入服务端 Supabase SDK
- 后端统一控制 bucket、object_key、上传时效
- 如需要，扩展 `POST /uploads/init` 返回真实上传凭证

### 完成标准

- 前端不再自己拼完整对象路径规则
- 上传策略由后端统一下发

## 4.7 任务 G：补教练端第一批接口

### 目标

让教练能开始使用班级与学生数据。

### 建议先补的接口

- `GET /api/v1/coach/classes`
- `GET /api/v1/coach/classes/{classPublicId}/students`
- `GET /api/v1/coach/classes/{classPublicId}/reports`
- `POST /api/v1/coach/classes/{classPublicId}/tasks`
- `POST /api/v1/coach/classes/{classPublicId}/announcements`

### 完成标准

- 教练能看到自己负责的班级
- 教练能查看班级学生训练报告
- 教练能发布任务和公告

## 4.8 任务 H：补管理员端第一批接口

### 目标

让管理员开始能维护训练营组织和模板体系。

### 建议先补的接口

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
- 管理员能维护班级和成员关系
- 管理员能维护模板和模板版本

## 4.9 任务 I：后端异步 AI 分析链路

### 目标

把“前端分析再回传保存”的过渡方案，逐步演进成“后端异步分析”。

### 任务内容

- 设计分析任务队列
- 上传完成后自动进入分析状态
- 后端运行 MediaPipe
- 后端生成报告
- 后端更新通知、任务、成长、成就

### 完成标准

- 学员上传完成后，无需前端本地负责完整报告计算
- 报告完全由后端生成并保存

## 5. 建议的下一轮交付边界

如果下一轮只做一个清晰可交付版本，建议边界定为：

- 已执行数据库迁移
- 上传页已接 `uploads/init` 和 `uploads/complete`
- 报告保存已接 `POST /reports`
- 报告页已接 `GET /reports/{report_public_id}`
- 个人中心已接 `/me/*`

如果做到这里，就能形成一个很重要的阶段成果：

- 前端主使用链路已经完成从 Supabase 直连到后端 API 的迁移
- PostgreSQL 真正成为训练营业务主记录源

## 6. 下一轮完成后的预期状态

当上述任务完成后，系统会进入下面这个状态：

- 视频对象仍在 Supabase
- 但训练业务数据全部由后端掌控
- 训练会话、视频元数据、分析报告、任务、成长、成就都有统一主记录源
- 前端不再直接依赖 Supabase 报告表
- 教练端和管理员端可以在下一轮继续自然扩展
