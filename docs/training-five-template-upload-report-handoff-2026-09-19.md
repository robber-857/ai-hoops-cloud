# Training 新五模板上传与 Report 开发交接

日期：2026-09-19
工作区：`D:\githubproject\ai-hoops-cloud`
分支/本地基准：`developbranch` / `6ac59fe`
主进度与风险索引：[状态与风险文档](D:/githubproject/ai-hoops-cloud/docs/training-five-template-next-phase-status-risk-plan.md)

## 1. 下一步目标

让已登录 Student/User 可以选择新增动作、上传真实视频、完成分析、点击生成 report，并在刷新或重新登录后查看同一份持久化报告。先打通自由训练，再验证 Coach 任务，不重做已经存在的上传或评分系统。

本阶段沿用现有“上传后自动端侧采集，数据可用后点击 View Analysis Report 保存”的交互。视频上传成功不等于报告已生成；本阶段不要求新增后台 Worker，也不要求上传完成后无需点击就自动保存 report。

| 动作 | template_code | 版本 | 拍摄方向 | 指标/Findings/图表或摘要 |
| --- | --- | --- | --- | --- |
| 开合跳 | jumping_jack_reps_front | v1 | 正面 | 6/6/6 |
| 同一侧连续弓步蹲 | lunge_same_side_reps_side | v1 | 侧面 | 6/6/6 |
| 俯卧撑 | pushup_reps_side | v1 | 侧面 | 5/5/5 |
| 单腿站立 | single_leg_stand_front | v1 | 正面 | 6/6/6 |
| 双脚基础跳绳 | jump_rope_basic_front | v1 | 正面 | 6/6/6 |

聚合指标可以显示摘要，不要求伪造逐帧曲线。缺失指标保留 N/A，不删掉对应位置。

## 2. 已完成与未完成

| 环节 | 当前代码状态 | 尚未证明/下一步工作 |
| --- | --- | --- |
| JSON/模板注册 | 十个 Training 已注册，新五个 v1、原五个修改规则 v2 | 目标库是否存在匹配发布版本未知 |
| 动作选择 | 上传前选择；与后端 code/version/hash 对比；不一致禁止上传 | 真实登录下的 Ready 状态和选择交互 |
| 视频上传 | init、Supabase 对象上传、complete、会话传递已接入 | 实际存储权限、对象可读、元数据和失败重试 |
| 自动采集 | 浏览器 MediaPipe 整段抽帧，约 12 FPS、最多 420 帧；支持手动播放兜底 | CDN/模型、解码、CORS、真实儿童关键点质量 |
| 分段/评分 | 新五个分段和指标聚合已实现，按模板评分 | 正确和错误视频是否都能进入评估而非一律数据不足 |
| report 保存 | POST /reports，校验会话模板版本；服务端写入模板快照 | PostgreSQL 真正写入、幂等提交、失败不丢结果 |
| report 展示 | GET detail，历史 Training 只读，锁定快照生成图表 | 真正刷新/重新登录、视频回放、手机与桌面展示 |
| 旧功能保护 | 运球/投篮策略隔离，原五个 Training 版本保护 | 旧视频端到端冒烟 |

2026-09-18 已记录前端 126 个测试、后端 35 个测试、TypeScript 与定向 ESLint 通过。本次 2026-09-19 仅核对源代码并整理交接，未重新运行测试、生产构建、浏览器或真实视频验收，未连接/同步目标库。

## 3. 真实数据链路

```text
TrainingPage 读取本地 JSON + GET /api/v1/training-templates?analysis_type=training
  -> TrainingTemplatePicker 选择 Ready 动作
  -> UploadDropZone POST /api/v1/uploads/init（code/version）
  -> 后端返回 session、upload_task、bucket/object_key、解析后的版本/hash
  -> 浏览器上传原文件到 Supabase；网络 fetch 错误时尝试 /api/storage/upload 代理
  -> POST /api/v1/uploads/complete 登记视频并返回完成会话
  -> PoseAnalysisView / PoseAutoAnalyzer 采集关键点和时序帧
  -> aggregateTrainingSequence + calculateRealScore
  -> 用户点击生成报告，POST /api/v1/reports
  -> analysis_reports + report_snapshots，服务端从锁定 DB 版本写入模板快照
  -> 跳转 /pose-2d/report?id=<report_public_id>
  -> GET /api/v1/reports/<report_public_id> 读取持久化报告
```

FastAPI 当前负责业务登记、权限、模板和报告存储，**不是**从视频重新计算动作指标的分析引擎。不能把已保存报告描述成已通过服务端可信评分认证。

当前自动采集使用共享的 `DribbleFrame` / `drillFrames` 关键点容器，Training 也会接收这些帧；名称不是没有采集 Training 的证据。不要为改名重构运球采集链路。

## 4. 代码入口

| 责任 | 文件 |
| --- | --- |
| 模板选择、目录加载、上传锁定 | [TrainingPage](D:/githubproject/ai-hoops-cloud/web/src/app/pose-2d/training/page.tsx)、[TrainingTemplatePicker](D:/githubproject/ai-hoops-cloud/web/src/components/Pose2D/TrainingTemplatePicker.tsx)、[trainingTemplateCatalog](D:/githubproject/ai-hoops-cloud/web/src/lib/trainingTemplateCatalog.ts) |
| 上传与会话契约 | [UploadDropZone](D:/githubproject/ai-hoops-cloud/web/src/components/Pose2D/UploadDropZone.tsx)、[uploads service](D:/githubproject/ai-hoops-cloud/web/src/services/uploads.ts)、[training_service](D:/githubproject/ai-hoops-cloud/server/app/services/training_service.py) |
| 视频存储兜底 | [storage upload route](D:/githubproject/ai-hoops-cloud/web/src/app/api/storage/upload/route.ts) |
| 采集、分析、生成报告 | [PoseAnalysisView](D:/githubproject/ai-hoops-cloud/web/src/components/Pose2D/PoseAnalysisView.tsx)、[PoseAutoAnalyzer](D:/githubproject/ai-hoops-cloud/web/src/components/Pose2D/PoseAutoAnalyzer.tsx)、[useMediaPipePose](D:/githubproject/ai-hoops-cloud/web/src/hooks/useMediaPipePose.ts) |
| 几何、分段、聚合、评分 | [trainingGeometry](D:/githubproject/ai-hoops-cloud/web/src/lib/trainingGeometry.ts)、[trainingTemporal](D:/githubproject/ai-hoops-cloud/web/src/lib/trainingTemporal.ts)、[trainingAggregators](D:/githubproject/ai-hoops-cloud/web/src/lib/trainingAggregators.ts)、[trainingCalculator](D:/githubproject/ai-hoops-cloud/web/src/lib/trainingCalculator.ts)、[scoring](D:/githubproject/ai-hoops-cloud/web/src/lib/scoring.ts) |
| report API/存储/展示 | [reports service](D:/githubproject/ai-hoops-cloud/web/src/services/reports.ts)、[report_service](D:/githubproject/ai-hoops-cloud/server/app/services/report_service.py)、[ReportPage](D:/githubproject/ai-hoops-cloud/web/src/app/pose-2d/report/page.tsx)、[MetricTimelineCard](D:/githubproject/ai-hoops-cloud/web/src/components/Pose2D/MetricTimelineCard.tsx) |
| 数据库模板发布 | [Admin templates](D:/githubproject/ai-hoops-cloud/web/src/app/admin/templates/page.tsx)、[admin_service](D:/githubproject/ai-hoops-cloud/server/app/services/admin_service.py)、[Template API](D:/githubproject/ai-hoops-cloud/server/app/api/v1/training_templates.py) |
| 联调配置 | [API client](D:/githubproject/ai-hoops-cloud/web/src/services/client.ts)、[server config](D:/githubproject/ai-hoops-cloud/server/app/core/config.py) |

模板真实目录是 `web/src/config/templates/training/`，不是早期对话中的 `trainingJSON`。模板 JSON 是规则依据，文档不应再复制另一套阈值到组件里。

## 5. 按顺序执行

### A. 环境确认与受控数据发布

1. 确认开发数据库身份及已有 Alembic head，不输出数据库/JWT/存储密钥。已有 migration 必须到位；只新增模板业务数据不新增 revision。
2. 备份模板、版本、会话与报告引用。审计旧 v1 是否曾被覆盖，禁止猜测历史规则。
3. 核对 API base、CORS、登录 token/cookie、Supabase URL/anon key、后端 UPLOAD_VIDEO_BUCKET 与实际 bucket 权限。手机上的 localhost 指手机自身，默认 loopback API 地址不能直接用于局域网联调；还需正确 HTTPS/安全上下文和 CORS。
4. Admin 在测试环境选择 Training，并逐项或批量预览五个 code。`POST /api/v1/admin/training-templates/sync-local?dry_run=true&analysis_type=training` 可重复传 `template_codes`。
5. 审核全部操作、版本和 blocked 原因；apply 使用相同范围和返回的 `preview_token`，不是把预览 token 用于另一个范围。未获得明确授权不 apply 生产。
6. 第二次相同范围 dry-run 应全部 skip。公共目录的五个新动作应有匹配 v1、active/default 和 hash；最终还须确认原五个 v2 正常，完整十模板目录 Ready。

A 的退出条件：目标测试 PostgreSQL 上有可核验的发布规则；不是只有 SQLite 测试通过。

### B. 先打通一个真实自由训练视频

1. 以 `pushup_reps_side` 的侧面、全身可见、浏览器可解码测试视频开始。选择模板后再上传，不依赖数组第一个模板。
2. 逐段记录 init -> storage -> complete 的结果，确认 session/video public_id、object_key、视频 URL、元数据及 code/version 保持一致；存储失败不能标记上传完成。
3. 验证 MediaPipe 脚本和模型加载、视频首帧解码、seek timeout、真正产生的关键点/时序帧。auto progress 扫描到 100% 不代表所有姿态指标已足够。
4. 验证聚合可评估片段及 P/E 指标；无有效数据给出明确失败原因，不伪造一份 0 分成功 report。一个完整动作可评价 P/E，Consistency 不足显示 N/A。
5. 修复本节之后列出的生成按钮、保存前锁定规则检查、错误反馈和重试问题。
6. POST report 成功后确认 DB report/snapshot，再用返回的 public_id 查询与刷新。Report 页面必须通过 GET detail 独立恢复，不只读取 Zustand 内存。

B 的退出条件：一条真实视频完整到达持久化 report，并能刷新重新读取；网络请求成功与 DB 证据都应记录。

### C. 收口当前代码里的具体断点

- **按钮门槛不统一：** `PoseAnalysisView` 的生成按钮主要使用 `captureStats.ready`；handler 还检查 temporal readiness、聚合状态和 P/E。对齐真实生成门槛或提供明确下一状态，避免“Report ready”后点击又提示数据不足；不能用放宽质量判断掩盖采集失败。
- **保存前模板复核不足：** handler 按 code 从当前本地模板取规则，却把会话版本作为提交版本字符串，没有在此再次校验本地规则 version/hash。增加生成前 code + version + hash 一致性检查；规则已变则要求刷新/新会话，不把新版分数贴上旧版标签。
- **错误/重试不够明确：** report 失败主要 alert + console。显示阶段错误和原始可理解原因，保留已完成采集，允许重试保存；防重复点击、反复创建快照或重复推进任务。
- **诊断值不统一：** Training 实际最少 scoring metrics 为 2，但 `summary_data.min_scoring_metrics` 仍写共享常量 3；记录真实生效值，避免误诊。帧数、时长只进入开发诊断，不作为儿童得分或目标次数。
- **评分上下文：** 初次生成沿用默认年龄 16-18，保存上下文未显式记录 age_group。至少持久化实际生效的年龄参数；若以后接入年龄选择，评分、图表和历史恢复必须同源，不能只是改展示。

上述是下一步待修项，本次只记录，未修改应用代码。

### D. 扩展到另外四个动作与旧功能回归

1. 每个动作准备正确、典型错误视频；重复型动作增加不完整片段，单腿站立增加触地/明显晃动片段。不要以用户上传时长或标准动作次数给分。
2. 确认错误动作仍可识别并量化问题，不把未达到评分目标直接排除为无效动作；建议要对应高/低/好/缺失四类表现。
3. 验证五份 report 的数量分别 6、6、5、6、6，顺序和名称来自同一锁定模板，摘要/曲线/N/A 不漏项。
4. 验证切换动作或视频时清理旧采集/结果；历史报告不换模板覆盖。显式同视频创建新分析是后续独立能力，不是本阶段必要前置。
5. 验证 Coach 指定模板不被替换、无权限提交被拒绝、同 session 重试不重复任务进度；只修新链路，不升级旧运球/投篮规则。
6. 原五个 Training、五个运球、两个投篮做旧视频冒烟，再检查手机、平板、桌面。用户自行运行前后端；开发代理默认不启动/打开 3000/8000。

### E. 测试与上线门槛

- 前端：保留 35 组发布基准和区间/静态渲染测试；补模板锁定复核、按钮与数据不足、POST 失败重试、GET 刷新恢复、五动作上传 report 浏览器用例。
- 后端：补真实 PostgreSQL init/complete/save/get 的关联与幂等用例，不能只测 `_template_snapshot_from_version` 等 helper。
- 在 `web` 执行 `npm.cmd test`、`npx.cmd tsc --noEmit --incremental false` 和改动文件的 ESLint；在有效后端环境执行 `python -m unittest discover -s tests`。
- 生产构建需在用户允许且不冲突的输出环境执行；没有跑过不得记录为通过。
- 最后审核隐私与评分信任风险，再决定受控发布。提交只包含本阶段完成工作；没有新指令不自动 push/main 同步或数据库生产 apply。

## 6. 故障定位速查

| 现象 | 先检查 | 不应该做 |
| --- | --- | --- |
| 模板卡不可选/上传灰色 | catalog availability、DB active version、实际 hash、登录、API/CORS、安全上下文 | 跳过 Ready 校验或硬编码第一个模板 |
| 上传 init 404/409 | DB 发布记录、请求 code/version、Coach assignment | 手改请求标签以蒙混过关 |
| 上传 storage 失败 | bucket/RLS、签名能力、网络错误类型、代理是否触发 | 把文件标记为 completed |
| complete 有记录但视频打不开 | storage 对象是否真的存在、签名是否有效、CORS、视频编码/元数据 | 把“DB 有 video”当成“视频可分析” |
| 自动分析完成却不能生成 | pose 检出率、时序覆盖、完整片段、required category、具体 reason | 任意放宽门槛或填 0 指标 |
| report POST 409 | session code/version、服务器锁定规则/快照、旧 report 身份 | 用新 JSON 覆盖发布版本 |
| report 仅首次可看 | POST 返回 id、GET detail、已保存 metrics/timeline/snapshot、视频 URL | 只使用本地 store 掩盖持久化问题 |

## 7. 公开上线前风险

以下均未在本次交接解决，主风险登记继续保留在状态文档：

- 后端仍信任客户端指标和分数。至少服务端按锁定规则重算总分；这仍不能防伪造指标，任务达标/奖励不可宣称已可信。
- `/api/storage/upload` 当前未显式校验 AI Hoops 登录会话、object_key 归属或 bucket 白名单；实际匿名可写能力取决于尚未核验的 Supabase 权限。补权限/文件限制、对象归属校验和负向测试，不认为字符串前缀校验等同授权。
- 直传和代理申请的视频签名 URL TTL 为 315360000 秒（约十年），不等于确认平台一定接受此期限。应明确儿童视频访问、短期签名刷新、撤销/删除政策；不要把长期 URL 当可靠权限控制。
- `/reports/shared/{public_id}` 无登录依赖，服务按 completed/non-deleted report 返回，目前没有显式分享授权、有效期和撤销门槛。知道 report UUID 不能等同监护人已同意公开视频。
- `/uploads/complete` 登记客户端视频 URL/元数据，尚无对象存在性/存储归属验证；补验证后才能将 uploaded 状态视为可靠。

安全修复若新增分享 token、版本外键等列，另行设计 Alembic migration；不要与“新增五模板只需业务数据同步”混为一谈。

## 8. 下一阶段完成定义与交接记录

完成核心功能必须同时满足：五个新模板真实可选；真实视频上传完成；每个动作正确/错误样例均有可解释结果；有效数据产出 report 并持久化；刷新/重新登录可恢复；版本/hash/评分区间及指标图表一一对应；旧模板回归通过。单纯新增 JSON 或 POST 返回 201 不算完成。

后续开发者为每个动作记录：测试环境/分支/commit、匿名视频标识、session/video/report public_id、模板版本/hash、实际指标与典型建议、缺失项、POST/GET/刷新结果、截图/失败原因。不要在交接里写儿童姓名、真实视频签名 URL、账号密码或 token。

更新进度时继续使用主状态文档，保持“代码完成 / 数据库完成 / 浏览器完成 / 真实视频完成 / 公开发布完成”分层；不要将待验收 checkbox 批量打勾。

本次没有修改应用代码、评分 JSON、数据库、服务进程或用户原有 Landing/Phase 2 改动，没有提交/push Git。
