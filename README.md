# AI Hoops Cloud

AI Hoops Cloud 是一个面向篮球训练场景的 AI 训练与运营平台。项目包含学生端训练视频上传与动作分析、训练报告、个人中心，Coach 工作台，以及 Admin 训练营后台管理能力。

当前仓库采用前后端分离结构：

- `web/`：Next.js 前端应用，包含落地页、登录注册、学生端、Coach/Admin 工作台、2D 姿态分析与报告页面。
- `server/`：FastAPI 后端服务，负责认证、训练营数据、上传元数据、报告持久化、Coach/Admin API、数据库迁移。
- `docs/`：架构、部署、API、训练营数据模型和后续迭代说明。

## 功能概览

- 账号注册、登录、验证码、刷新令牌与退出登录。
- 按角色跳转入口：`admin` -> `/admin`，`coach` -> `/coach`，`student` / `user` -> `/me`。
- 学生端训练视频上传、姿态分析、报告保存、个人中心聚合数据。
- Shooting / Dribbling / Training 本地评分模板与前端分析逻辑。
- Coach 班级、学员、报告、训练任务和公告发布的第一版工作流。
- Admin 训练营、班级、用户、模板同步、公告、任务和通知监督的第一版后台能力。
- PostgreSQL 作为业务数据源，Supabase Storage 作为当前视频对象存储。

## 技术栈

### Frontend

- Next.js App Router
- React 19
- TypeScript
- Tailwind CSS
- MediaPipe Pose
- Three.js / React Three Fiber
- Zustand
- Supabase JS Client

### Backend

- Python
- FastAPI
- SQLAlchemy
- Alembic
- PostgreSQL / psycopg
- Pydantic Settings
- python-jose / passlib

## 目录结构

```text
.
├── docs/                  # 架构、部署、API 与产品迭代文档
├── server/                # FastAPI 后端服务
│   ├── alembic/           # 数据库迁移
│   ├── app/
│   │   ├── api/           # HTTP API 路由
│   │   ├── core/          # 配置、数据库、安全能力
│   │   ├── models/        # SQLAlchemy ORM 模型
│   │   ├── schemas/       # Pydantic 请求/响应模型
│   │   └── services/      # 业务服务层
│   └── tests/             # 后端测试
└── web/                   # Next.js 前端应用
    ├── public/            # 静态资源和演示视频
    └── src/
        ├── app/           # App Router 页面
        ├── components/    # UI 和业务组件
        ├── config/        # 本地训练模板
        ├── lib/           # 评分、认证、工具函数
        ├── services/      # 前端 API Client
        └── store/         # 客户端状态
```

## 本地运行

### 1. 准备依赖

建议环境：

- Node.js 20+
- npm
- Python 3.11+
- PostgreSQL 14+
- Supabase 项目和 Storage bucket

### 2. 启动后端

```powershell
cd server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

编辑 `server/.env`，至少确认数据库、JWT、SMTP、CORS 和 Supabase bucket 配置。

运行迁移并启动 API：

```powershell
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

健康检查：

```text
GET http://localhost:8000/health
```

成功时返回：

```json
{"status":"ok"}
```

### 3. 启动前端

```powershell
cd web
npm install
Copy-Item .env.example .env.local
npm run dev
```

编辑 `web/.env.local`：

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api/v1
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

然后打开：

```text
http://localhost:3000
```

## 常用命令

### 前端

```powershell
cd web
npm run dev
npm run lint
npm run build
npm run start
```

### 后端

```powershell
cd server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
alembic upgrade head
python -m compileall app
python -m unittest tests.test_report_service_idempotency
```

## 环境变量

环境变量示例文件：

- `web/.env.example`
- `web/.env.production.example`
- `server/.env.example`
- `server/.env.production.example`

本地敏感文件不要提交：

- `web/.env.local`
- `server/.env`
- `server/.env.local`
- `server/.env.production`

后端关键变量包括：

- `DATABASE_URL` 或 `POSTGRES_*`
- `JWT_SECRET_KEY`
- `JWT_REFRESH_SECRET_KEY`
- `CORS_ORIGINS`
- `SMTP_*`
- `UPLOAD_VIDEO_BUCKET`
- `TEMPLATE_VIDEO_BUCKET`

前端关键变量包括：

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## API 概览

后端默认 API 前缀为 `/api/v1`，当前主要模块包括：

- `/auth`：注册、登录、验证码、刷新、退出、当前用户。
- `/uploads`：训练视频上传初始化与完成回调。
- `/reports`：训练报告保存、列表和详情。
- `/me`：学生个人中心、任务、趋势、成就等聚合数据。
- `/training-templates`：训练模板查询。
- `/coach`：Coach 班级、学员、报告、任务和公告能力。
- `/admin`：Admin 用户、训练营、班级、模板、公告、任务、通知管理能力。

更完整的接口说明见 [docs/api-spec.md](docs/api-spec.md)。

## 部署

推荐部署方式：

- 前端部署到 Vercel，Root Directory 设置为 `web`。
- 后端部署到 Render，Root Directory 设置为 `server`。
- 数据库使用 PostgreSQL。
- 视频对象存储使用 Supabase Storage。

Vercel 常用设置：

- Build Command: `npm run build`
- Install Command: `npm install`
- Production Branch: `main`

Render 常用设置：

- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

详细部署说明见 [docs/deployment.md](docs/deployment.md)。

## 重要文档

- [架构说明](docs/architecture.md)
- [API 草案](docs/api-spec.md)
- [部署指南](docs/deployment.md)
- [训练营后端数据设计](docs/training-camp-backend-data-design.md)
- [当前开发状态](docs/training-camp-backend-implementation-status.md)
- [下一轮任务拆解](docs/training-camp-backend-next-iteration-task-breakdown.md)

## 当前状态

截至 2026-05-03，项目已经具备学生端主链路、基础后台数据模型、登录角色跳转、Admin/Coach 初版页面、Admin 用户管理、本地模板同步入口、Coach 关键工作台路由，以及 Admin 公告/任务/通知监督第一版。

当前主要后续重点：

- 补齐 Admin、Coach、模板同步和权限相关自动化测试。
- 修复 Admin/Coach announcement 链路中的已知报错。
- 增强 Student 个人中心的趋势图、真实任务和公告通知入口。
- 优化 Admin class 成员添加体验。
- 推进 Supabase signed upload、后端异步 AI 分析和模板视频审核发布流程。
