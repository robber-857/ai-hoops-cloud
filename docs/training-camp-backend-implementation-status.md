# AI 篮球训练营后端开发实施状态说明

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

## 1. 文档目的

本文档用于记录本轮基于 [training-camp-backend-data-design.md](<D:\githubproject\ai-hoops-cloud\docs\training-camp-backend-data-design.md>) 已完成的后端开发内容、当前未完成内容，以及后续建议推进顺序。

适用范围：

- `server/` 后端服务
- PostgreSQL 数据模型与 Alembic 迁移
- 训练视频上传主链路
- 报告保存与读取主链路
- 个人中心聚合查询主链路

## 2. 本轮开发目标

本轮开发遵循文档第 11 节“数据一致性与迁移建议”的方向，核心目标是：

- 让 PostgreSQL 成为训练营业务主记录源
- 让 Supabase 当前阶段仅承担视频对象存储
- 为后续前端从 Supabase 直连迁移到后端 API 做准备

## 3. 已完成内容

## 3.1 核心数据模型已补齐

本轮已在 `server/app/models/` 下新增或扩展训练营业务核心模型。

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

### 本轮模型设计重点

- 新增 `training_sessions` 作为一次训练行为的业务主表
- 新增 `class_members` 作为学生与教练的班级归属关系表
- 新增训练模板主表、模板版本表、模板示例视频表
- 新增任务、公告、通知、成长、成就相关表
- 让 `upload_tasks` 和 `analysis_reports` 能挂到 `training_sessions`

## 3.2 枚举与基础语义已扩展

本轮已扩展 [enums.py](<D:\githubproject\ai-hoops-cloud\server\app\models\enums.py>)：

- `UserRole` 新增 `student`
- `StorageProvider` 新增 `supabase`
- `AnalysisType` 新增 `comprehensive`

当前兼容策略：

- 继续兼容旧的 `user`
- 继续兼容旧的 `training`
- 继续兼容旧的 `s3`

这意味着当前数据库和代码不会立刻被旧语义卡死，但后续业务上推荐逐步统一到：

- `student`
- `comprehensive`
- `supabase`

## 3.3 Alembic 迁移脚本已新增

本轮已新增迁移脚本：

- [20260427_0002_training_camp_core.py](<D:\githubproject\ai-hoops-cloud\server\alembic\versions\20260427_0002_training_camp_core.py>)

并同步更新了：

- [alembic/env.py](<D:\githubproject\ai-hoops-cloud\server\alembic\env.py>)

本次迁移脚本完成的事情包括：

- 新增训练营核心业务表
- 扩展已有枚举值
- 给 `upload_tasks` 增加 `session_id`、`storage_provider`、`bucket_name`、`object_key`
- 给 `analysis_reports` 增加 `session_id`、`training_template_id`
- 对旧 `upload_tasks` 和旧 `analysis_reports` 做最小回填，避免历史内测数据导致迁移失败

## 3.4 新的后端 Schema 已新增

本轮已新增这些 schema 文件：

- [training.py](<D:\githubproject\ai-hoops-cloud\server\app\schemas\training.py>)
- [report.py](<D:\githubproject\ai-hoops-cloud\server\app\schemas\report.py>)
- [me.py](<D:\githubproject\ai-hoops-cloud\server\app\schemas\me.py>)
- [template.py](<D:\githubproject\ai-hoops-cloud\server\app\schemas\template.py>)

并扩展了：

- [user.py](<D:\githubproject\ai-hoops-cloud\server\app\schemas\user.py>)

这些 schema 主要用于：

- 上传初始化
- 上传完成回调
- 报告保存
- 报告列表与详情
- 个人中心聚合响应
- 模板查询

## 3.5 新的 Service 层已新增

本轮已新增：

- [training_service.py](<D:\githubproject\ai-hoops-cloud\server\app\services\training_service.py>)
- [report_service.py](<D:\githubproject\ai-hoops-cloud\server\app\services\report_service.py>)
- [me_service.py](<D:\githubproject\ai-hoops-cloud\server\app\services\me_service.py>)
- [template_service.py](<D:\githubproject\ai-hoops-cloud\server\app\services\template_service.py>)

并扩展了：

- [auth_service.py](<D:\githubproject\ai-hoops-cloud\server\app\services\auth_service.py>)

本轮 Service 层已经实现的能力：

- 训练视频上传初始化
- 上传完成后的 `videos`、`upload_tasks`、`training_sessions` 落库
- 学员报告保存
- 报告快照写入
- 任务完成度联动更新
- 成长快照的日级聚合写入
- 成就判定与解锁写入
- 报告通知与成就通知写入
- 个人中心数据聚合查询
- 模板与模板示例视频查询

## 3.6 新的 API 路由已新增

本轮已新增：

- [uploads.py](<D:\githubproject\ai-hoops-cloud\server\app\api\v1\uploads.py>)
- [reports.py](<D:\githubproject\ai-hoops-cloud\server\app\api\v1\reports.py>)
- [me.py](<D:\githubproject\ai-hoops-cloud\server\app\api\v1\me.py>)
- [training_templates.py](<D:\githubproject\ai-hoops-cloud\server\app\api\v1\training_templates.py>)

并更新了：

- [router.py](<D:\githubproject\ai-hoops-cloud\server\app\api\router.py>)
- [deps.py](<D:\githubproject\ai-hoops-cloud\server\app\api\deps.py>)

本轮已补的接口如下：

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

## 3.7 阶段性权限策略已接入

当前没有上完整 RBAC，但本轮已经保留并扩展了“角色 + 归属关系”的阶段性访问控制方案。

当前状态：

- 学员接口按资源 owner 限制
- 报告详情支持教练按班级归属访问
- 管理员可后续直接扩展为全局访问

这部分主要体现在：

- [deps.py](<D:\githubproject\ai-hoops-cloud\server\app\api\deps.py>)
- [report_service.py](<D:\githubproject\ai-hoops-cloud\server\app\services\report_service.py>)
- [training_service.py](<D:\githubproject\ai-hoops-cloud\server\app\services\training_service.py>)

## 3.8 配置项已补充

本轮已在 [config.py](<D:\githubproject\ai-hoops-cloud\server\app\core\config.py>) 中新增：

- `UPLOAD_VIDEO_BUCKET`
- `TEMPLATE_VIDEO_BUCKET`

用于支持当前阶段的对象存储元数据管理。

## 3.9 基础校验已完成

本轮做过以下校验：

- 使用项目虚拟环境进行了 Python 模块导入检查
- 进行了 `compileall` 语法编译检查
- 进行了 SQLAlchemy `configure_mappers()` 映射检查

校验结论：

- 新增模型、schema、service、router 在导入层面通过
- 新增后端代码在语法层面通过
- 新增 ORM 关系在 mapper 配置层面通过

## 4. 本轮没有完成的内容

## 4.1 前端尚未切换到新的后端 API

目前新的后端接口已经具备，但前端还没有完成切换。

也就是说，以下页面或组件还没有正式迁移：

- 上传页
- 报告页
- 个人中心

当前仍然存在前端直连 Supabase 的逻辑，需要后续改造。

## 4.2 还没有实现服务端真正签发 Supabase 上传 URL

当前 `POST /uploads/init` 已经能够：

- 创建 `training_session`
- 创建 `upload_task`
- 生成对象路径和上传元数据

但还没有接入 Supabase 服务端 SDK 去真正生成上传签名或服务端上传凭证。

当前阶段返回的是：

- `upload_strategy = client_direct_supabase`

所以这轮完成的是“后端元数据主链路”，不是“服务端托管上传签名”的完整版本。

## 4.3 还没有实现 MediaPipe 后端异步分析任务

本轮的 `POST /reports` 更适合作为：

- 前端已完成分析后，把结果提交回后端保存

但还没有实现：

- 上传完成后自动排队
- 后端异步运行 MediaPipe
- 后端自动生成分析报告
- 异步任务状态追踪

也就是说，AI 分析执行链路目前还没有从前端完全迁到后端。

## 4.4 教练端和管理员端完整接口还没有开发完

本轮只完成了面向主链路的数据结构与基础读写能力，没有把教练端、管理员端的完整运营接口全部补齐。

目前未完成的典型接口包括：

- 教练发布训练任务
- 教练查看班级学生列表
- 教练按班级筛报告
- 教练发布公告
- 管理员管理训练营
- 管理员管理班级
- 管理员管理模板
- 管理员上传/删除/修改模板示例视频
- 管理员整体数据总览

## 4.5 没有执行真实数据库迁移

本轮已经写好了 Alembic 脚本，但还没有实际执行：

```bash
alembic upgrade head
```

所以当前是“代码与迁移脚本已准备好”，但不是“数据库已经在你的环境里完成升级”。

## 4.6 没有补自动化测试

本轮没有新增 pytest 测试文件，也没有做接口级自动化测试。

当前已做的是：

- 导入检查
- 语法检查
- ORM 映射检查

还没做的是：

- API 集成测试
- 迁移执行测试
- 权限边界测试
- 训练任务与成就联动测试

## 4.7 没有清理或改造前端已有 Supabase 报告表依赖

虽然这轮后端已经能接管报告主记录源，但前端原先依赖的：

- Supabase `analysis_reports`
- Supabase 直接上传视频

这些旧逻辑还在，需要下一轮逐步替换。

## 5. 建议下一步开发顺序

建议后续按下面顺序推进。

### 第一步

先把前端上传与报告保存接到新后端 API：

- 上传页改接 `POST /uploads/init`
- 上传成功后改接 `POST /uploads/complete`
- 报告保存改接 `POST /reports`
- 报告页改读 `GET /reports/{report_public_id}`
- 个人中心改读 `/me/*`

### 第二步

补服务端对象存储接入：

- 服务端生成 Supabase 上传策略或签名
- 前端不再自己直接控制对象路径规则

### 第三步

补教练端能力：

- 班级查询
- 学员列表
- 任务发布
- 公告发布
- 学员报告查看

### 第四步

补管理员端能力：

- 训练营管理
- 班级管理
- 模板管理
- 示例视频管理
- 全局统计

### 第五步

把 AI 分析执行真正迁到后端异步任务中。

## 6. 当前阶段结论

这轮后端开发已经完成了“训练营业务主记录源向 PostgreSQL 收口”的第一阶段基础建设。

更准确地说，当前已经具备：

- 训练营核心表结构
- 训练上传主链路数据落库能力
- 报告保存与读取能力
- 个人中心聚合接口
- 模板查询接口
- 基于角色与归属关系的初步访问控制

但还没有完成：

- 前端切换
- 真实数据库升级执行
- Supabase 服务端上传签名接入
- 教练端 / 管理员端完整业务接口
- 后端异步 AI 分析链路
- 自动化测试

因此，本轮成果适合定义为：

- “后端核心基础设施和业务主链路已落地”
- 但“前后端联调和完整业务闭环仍需下一轮继续推进”
