# AI 篮球训练营主链路实施状态说明

## 0. 文档链路

本文档建议和以下两份文档配合使用：

- 目标设计文档：
  [training-camp-backend-data-design.md](<D:\githubproject\ai-hoops-cloud\docs\training-camp-backend-data-design.md>)
- 下一轮任务拆解清单：
  [training-camp-backend-next-iteration-task-breakdown.md](<D:\githubproject\ai-hoops-cloud\docs\training-camp-backend-next-iteration-task-breakdown.md>)

三份文档的职责划分如下：

- 设计文档：回答“应该做成什么样”
- 状态文档：回答“这轮已经做了什么，还缺什么”
- 任务拆解文档：回答“下一轮按什么顺序继续做”

## 1. 当前阶段结论

截至 2026-04-30，训练营业务主链路已经从“后端能力准备好”推进到“前后端主使用链路已接通并完成端到端上传验证”。

当前已经具备：

- PostgreSQL 作为训练营业务主记录源
- Supabase Storage 作为当前阶段的视频对象存储
- 上传初始化、对象上传、上传完成回调的完整链路
- 前端本地分析后提交后端保存报告的完整链路
- 报告详情通过后端 API 读取
- 个人中心通过 `/me/*` 后端聚合接口读取主要数据
- 教练端第一批后端接口已经接入，可围绕班级查看学生、报告并发布任务和公告

当前仍处在过渡阶段：

- 视频对象仍由前端使用 Supabase 客户端直传
- AI 分析计算仍在前端本地完成
- 教练端前端页面尚未开发
- 管理员端业务接口尚未补齐
- 还缺少系统化自动化集成测试

## 2. 已完成内容

## 2.1 核心数据模型已补齐

已在 `server/app/models/` 下新增或扩展训练营业务核心模型。

### 已新增模型

- [training_camp.py](<D:\githubproject\ai-hoops-cloud\server\app\models\training_camp.py>)
- [camp_class.py](<D:\githubproject\ai-hoops-cloud\server\app\models\camp_class.py>)
- [class_member.py](<D:\githubproject\ai-hoops-cloud\server\app\models\class_member.py>)
- [training_template.py](<D:\githubproject\ai-hoops-cloud\server\app\models\training_template.py>)
- [training_template_version.py](<D:\githubproject\ai-hoops-cloud\server\app\models\training_template_version.py>)
- [template_example_video.py](<D:\githubproject\ai-hoops-cloud\server\app\models\template_example_video.py>)
- [training_session.py](<D:\githubproject\ai-hoops-cloud\server\app\models\training_session.py>)
- [training_task.py](<D:\githubproject\ai-hoops-cloud\server\app\models\training_task.py>)
- [training_task_assignment.py](<D:\githubproject\ai-hoops-cloud\server\app\models\training_task_assignment.py>)
- [announcement.py](<D:\githubproject\ai-hoops-cloud\server\app\models\announcement.py>)
- [announcement_read.py](<D:\githubproject\ai-hoops-cloud\server\app\models\announcement_read.py>)
- [notification.py](<D:\githubproject\ai-hoops-cloud\server\app\models\notification.py>)
- [student_growth_snapshot.py](<D:\githubproject\ai-hoops-cloud\server\app\models\student_growth_snapshot.py>)
- [achievement.py](<D:\githubproject\ai-hoops-cloud\server\app\models\achievement.py>)
- [student_achievement.py](<D:\githubproject\ai-hoops-cloud\server\app\models\student_achievement.py>)
- [student_goal.py](<D:\githubproject\ai-hoops-cloud\server\app\models\student_goal.py>)

### 已扩展模型

- [user.py](<D:\githubproject\ai-hoops-cloud\server\app\models\user.py>)
- [video.py](<D:\githubproject\ai-hoops-cloud\server\app\models\video.py>)
- [upload_task.py](<D:\githubproject\ai-hoops-cloud\server\app\models\upload_task.py>)
- [analysis_report.py](<D:\githubproject\ai-hoops-cloud\server\app\models\analysis_report.py>)
- [__init__.py](<D:\githubproject\ai-hoops-cloud\server\app\models\__init__.py>)

模型设计重点：

- `training_sessions` 作为一次训练行为的业务主表
- `upload_tasks`、`videos`、`analysis_reports` 统一挂到训练会话
- `class_members` 支持学生、教练与班级的归属关系
- 训练模板、模板版本、模板示例视频已有基础结构
- 任务、公告、通知、成长、成就相关表已具备后续扩展基础

## 2.2 枚举与基础语义已扩展

已扩展 [enums.py](<D:\githubproject\ai-hoops-cloud\server\app\models\enums.py>)：

- `UserRole` 新增 `student`
- `StorageProvider` 新增 `supabase`
- `AnalysisType` 新增 `comprehensive`

当前兼容策略：

- 继续兼容旧的 `user`
- 继续兼容旧的 `training`
- 继续兼容旧的 `s3`

后续业务上推荐逐步统一到：

- `student`
- `comprehensive`
- `supabase`

## 2.3 Alembic 迁移脚本已新增并已在本地执行

已新增迁移脚本：

- [20260427_0002_training_camp_core.py](<D:\githubproject\ai-hoops-cloud\server\alembic\versions\20260427_0002_training_camp_core.py>)

并同步更新了：

- [alembic/env.py](<D:\githubproject\ai-hoops-cloud\server\alembic\env.py>)

迁移脚本包含：

- 新增训练营核心业务表
- 扩展已有枚举值
- 给 `upload_tasks` 增加 `session_id`、`storage_provider`、`bucket_name`、`object_key`
- 给 `analysis_reports` 增加 `session_id`、`training_template_id`
- 对旧 `upload_tasks` 和旧 `analysis_reports` 做最小回填，避免历史内测数据导致迁移失败

当前状态：

- 用户已完成本地数据库迁移
- 本轮开发基于“数据库迁移已完成”的前提继续推进

## 2.4 后端 Schema、Service 与 API 已补齐

已新增 schema：

- [training.py](<D:\githubproject\ai-hoops-cloud\server\app\schemas\training.py>)
- [report.py](<D:\githubproject\ai-hoops-cloud\server\app\schemas\report.py>)
- [me.py](<D:\githubproject\ai-hoops-cloud\server\app\schemas\me.py>)
- [template.py](<D:\githubproject\ai-hoops-cloud\server\app\schemas\template.py>)

已新增 service：

- [training_service.py](<D:\githubproject\ai-hoops-cloud\server\app\services\training_service.py>)
- [report_service.py](<D:\githubproject\ai-hoops-cloud\server\app\services\report_service.py>)
- [me_service.py](<D:\githubproject\ai-hoops-cloud\server\app\services\me_service.py>)
- [template_service.py](<D:\githubproject\ai-hoops-cloud\server\app\services\template_service.py>)

已新增 API 路由：

- [uploads.py](<D:\githubproject\ai-hoops-cloud\server\app\api\v1\uploads.py>)
- [reports.py](<D:\githubproject\ai-hoops-cloud\server\app\api\v1\reports.py>)
- [me.py](<D:\githubproject\ai-hoops-cloud\server\app\api\v1\me.py>)
- [training_templates.py](<D:\githubproject\ai-hoops-cloud\server\app\api\v1\training_templates.py>)

当前已具备的接口：

- `POST /api/v1/uploads/init`
- `POST /api/v1/uploads/complete`
- `POST /api/v1/reports`
- `GET /api/v1/reports/mine`
- `GET /api/v1/reports/{report_public_id}`
- `GET /api/v1/me/dashboard`
- `GET /api/v1/me/reports`
- `GET /api/v1/me/training-sessions`
- `GET /api/v1/me/tasks`
- `GET /api/v1/me/achievements`
- `GET /api/v1/me/trends`
- `GET /api/v1/training-templates`
- `GET /api/v1/training-templates/{template_code}`
- `GET /api/v1/coach/classes`
- `GET /api/v1/coach/classes/{class_public_id}/students`
- `GET /api/v1/coach/classes/{class_public_id}/reports`
- `POST /api/v1/coach/classes/{class_public_id}/tasks`
- `POST /api/v1/coach/classes/{class_public_id}/announcements`

## 2.5 前端主链路已切到后端 API

本轮已完成前端服务层和调用点迁移。

新增前端服务文件：

- [uploads.ts](<D:\githubproject\ai-hoops-cloud\web\src\services\uploads.ts>)
- [reports.ts](<D:\githubproject\ai-hoops-cloud\web\src\services\reports.ts>)
- [me.ts](<D:\githubproject\ai-hoops-cloud\web\src\services\me.ts>)

已改造上传入口：

- [UploadDropZone.tsx](<D:\githubproject\ai-hoops-cloud\web\src\components\Pose2D\UploadDropZone.tsx>)
- [shooting/page.tsx](<D:\githubproject\ai-hoops-cloud\web\src\app\pose-2d\shooting\page.tsx>)
- [dribbling/page.tsx](<D:\githubproject\ai-hoops-cloud\web\src\app\pose-2d\dribbling\page.tsx>)
- [training/page.tsx](<D:\githubproject\ai-hoops-cloud\web\src\app\pose-2d\training\page.tsx>)

上传链路现在是：

1. 前端调用 `POST /api/v1/uploads/init`
2. 后端创建 `training_session` 和 `upload_task`
3. 后端返回 `bucket_name`、`object_key`、`session_public_id`、`upload_task_public_id`
4. 前端按后端下发路径上传到 Supabase Storage
5. 前端调用 `POST /api/v1/uploads/complete`
6. 后端写入或更新 `videos`、`upload_tasks`、`training_sessions`

已改造报告保存和读取：

- [PoseAnalysisView.tsx](<D:\githubproject\ai-hoops-cloud\web\src\components\Pose2D\PoseAnalysisView.tsx>)
- [report/page.tsx](<D:\githubproject\ai-hoops-cloud\web\src\app\pose-2d\report\page.tsx>)

报告链路现在是：

1. 前端本地完成动作分析和评分
2. 前端调用 `POST /api/v1/reports`
3. 后端写入 `analysis_reports`、`report_snapshots`、相关通知与成长数据
4. 前端使用后端返回的 `report_public_id` 跳转报告页
5. 报告页调用 `GET /api/v1/reports/{report_public_id}` 读取详情
6. 报告页按用户选择的模板重新计算评分，并通过 `POST /api/v1/reports` 更新同一份报告

本轮修正了一个关键体验问题：

- 上传分析页仍会以当前动作类型的第一个模板生成默认报告
- 用户进入报告页后，如果选择其他模板或年龄段，报告页会把当前展示的模板和分数回写后端
- 个人中心 `Recent reports` 因此会展示用户最后在报告页确认过的模板评分，而不是固定保存上传分析页的第一个模板评分
- 后端保存同一 `training_session` 的报告时改为幂等更新，避免重复保存导致训练任务完成次数被重复累计

已改造个人中心：

- [me/page.tsx](<D:\githubproject\ai-hoops-cloud\web\src\app\me\page.tsx>)

个人中心现在读取：

- `GET /api/v1/me/dashboard`
- `GET /api/v1/me/reports`
- `GET /api/v1/me/tasks`
- `GET /api/v1/me/trends`

## 2.6 阶段性权限策略已接入

当前没有上完整 RBAC，但已具备“角色 + 归属关系”的阶段性访问控制方案。

当前状态：

- 学员接口按资源 owner 限制
- 报告详情支持教练按班级归属访问
- 教练端接口按 active coach member 班级归属访问
- 管理员可后续扩展为全局访问

这部分主要体现在：

- [deps.py](<D:\githubproject\ai-hoops-cloud\server\app\api\deps.py>)
- [report_service.py](<D:\githubproject\ai-hoops-cloud\server\app\services\report_service.py>)
- [training_service.py](<D:\githubproject\ai-hoops-cloud\server\app\services\training_service.py>)
- [coach_service.py](<D:\githubproject\ai-hoops-cloud\server\app\services\coach_service.py>)

## 2.7 教练端第一批后端接口已完成

本轮新增了教练端最小运营闭环接口：

- `GET /api/v1/coach/classes`
- `GET /api/v1/coach/classes/{class_public_id}/students`
- `GET /api/v1/coach/classes/{class_public_id}/reports`
- `POST /api/v1/coach/classes/{class_public_id}/tasks`
- `POST /api/v1/coach/classes/{class_public_id}/announcements`

实现文件：

- [coach.py](<D:\githubproject\ai-hoops-cloud\server\app\api\v1\coach.py>)
- [coach.py](<D:\githubproject\ai-hoops-cloud\server\app\schemas\coach.py>)
- [coach_service.py](<D:\githubproject\ai-hoops-cloud\server\app\services\coach_service.py>)

当前能力：

- `coach` 只能访问自己作为 active coach member 的班级
- `admin` 可访问全部班级
- 教练可以查看自己负责的班级列表
- 教练可以查看班级内 active student member 列表
- 教练可以查看班级下学生报告
- 教练发布训练任务时，会为班级内 active student member 创建 `training_task_assignment`
- 教练可以发布班级公告

前端页面尚未开发，后续可参考：

- [coach-portal-function-api.md](<D:\githubproject\ai-hoops-cloud\docs\coach-portal-function-api.md>)

## 2.8 当前校验结果

后端基础校验已完成：

- Python 模块导入检查
- `compileall` 语法编译检查
- SQLAlchemy `configure_mappers()` 映射检查
- FastAPI app 路由加载检查
- `python -m unittest server.tests.test_report_service_idempotency` 通过

前端校验已完成：

- `npm.cmd run lint` 通过
- `npm.cmd run build` 通过

端到端功能验证：

- 用户已在本地验证上传、分析、保存报告、报告页读取链路正常
- 浏览器网络面板可看到 `uploads/init`、Supabase 对象上传、`uploads/complete`、`reports`、报告详情读取请求均正常返回

## 3. 当前没有完成的内容

## 3.1 服务端 Supabase 上传签名尚未接入

当前 `POST /uploads/init` 已经能够：

- 创建 `training_session`
- 创建 `upload_task`
- 生成对象路径和上传元数据

但还没有接入 Supabase 服务端 SDK 去真正生成上传签名或短期上传凭证。

当前阶段仍是：

- 后端统一生成 bucket 和 object_key
- 前端使用 Supabase 客户端直传对象
- 后端通过 `uploads/complete` 接收完成回调并落业务数据

后续如果要进一步收口上传能力，需要让后端下发真实上传凭证，或者改为服务端代理上传。

## 3.2 MediaPipe 后端异步分析任务尚未实现

当前 `POST /reports` 是过渡方案：

- 前端完成分析
- 前端把评分、时间线和总结数据提交给后端保存

尚未实现：

- 上传完成后自动排队
- 后端异步运行 MediaPipe
- 后端自动生成分析报告
- 异步任务状态追踪

## 3.3 教练端前端和管理员端完整接口尚未开发完

目前未完成的典型接口包括：

- 教练端前端页面
- 教练端任务详情、任务编辑、任务关闭、学生任务完成明细
- 教练端公告列表、公告编辑、公告置顶、公告过期管理
- 管理员管理训练营
- 管理员管理班级
- 管理员管理成员关系
- 管理员管理模板与模板版本
- 管理员上传、删除、修改模板示例视频
- 管理员整体数据总览

## 3.4 自动化测试尚未补齐

还没做的是：

- API 集成测试
- 迁移执行测试
- 权限边界测试
- 训练任务与成就联动测试
- 前端上传、报告保存、报告读取的自动化端到端测试

## 3.5 前端仍保留 Supabase Storage 客户端依赖

这不是当前阶段的错误，而是过渡方案的一部分。

当前前端不再直接写 Supabase `analysis_reports`，但仍会：

- 使用 Supabase 客户端上传视频对象
- 使用后端下发的 bucket 和 object_key

后续如果实现服务端上传签名或服务端代理上传，再进一步减少前端 Supabase Storage 依赖。

## 4. 建议下一步开发顺序

下一轮建议按以下顺序推进：

1. 补服务端 Supabase 上传签名或上传凭证方案
2. 开发教练端第一版前端页面
3. 补管理员端第一批接口
4. 补自动化集成测试
5. 设计并推进后端异步 AI 分析链路

## 5. 过时信息修正记录

以下旧判断已经过时：

- “前端尚未切换到新的后端 API”已经过时。上传、报告保存、报告读取、个人中心主链路已经接入后端 API。
- “没有执行真实数据库迁移”已经过时。用户已完成本地迁移。
- “没有清理或改造前端已有 Supabase 报告表依赖”已经过时。前端不再直接读写 Supabase `analysis_reports`。

仍然成立的限制：

- 服务端 Supabase 上传签名尚未实现
- 后端异步 AI 分析尚未实现
- 教练端前端页面尚未实现
- 管理员端接口尚未补齐
- 自动化集成测试尚未补齐
