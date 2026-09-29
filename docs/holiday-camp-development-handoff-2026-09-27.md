# 开发交接：假期班训练、营养与个人中心

更新：2026-09-29。给下一个对话的首读入口。

## 2026-09-29 P5b 最新进度

P5b 食品检索和菜谱草稿/发布快照 API、每份与成品重量营养换算完成。全量后端 94 项测试、本地 PostgreSQL 迁移回退/前滚、真实合成账号登录 API 流程通过。详见 [P5b 验证与接口交接](holiday-camp-p5b-validation-2026-09-29.md)。P5a 已推送 8df3407。下一批 P5c 为 Admin 编辑 UI 和独立菜谱列表/详情及响应式验证；尚未上线迁移或真实教练 UAT。以下早期进度以本节为准。

## 2026-09-29 最新进度

P5a 食品来源/条目模型、AFCD 预览与幂等导入已完成，专用本地 PostgreSQL 全量导入 1,588 个食品及重复执行验证通过，后端 83 项测试通过。详见 [P5a 验证及操作](holiday-camp-p5a-validation-2026-09-29.md)。未执行线上迁移；下一步 P5b 食品检索、菜谱维护和固定版本营养换算，再接独立浏览页。姓名显示批次已推送 dd39f05。以下旧状态以本节为准。

## 最新执行状态（P4 及学员姓名显示更新）

按用户最新要求，Coach / Admin 学员界面统一展示姓名，Admin 添加成员改为按姓名或联系方式搜索选择，详见 [姓名显示验证](holiday-camp-staff-names-validation-2026-09-27.md)。没有姓名时明确提示补充，不以账号或 ID 代替。P4 已推送 8d89ca5。本批不需要数据库迁移；P5 食品及菜谱尚待实施。

P0/P1 已用户确认并提交 c077df8；P2 已提交 b6a1a65，邮箱独立注册满足现阶段范围。注册登录保持现状，手机号与 Google 后续再接。P3 已完成教练计划草稿/发布/修订和球员独立查看，详见 [P3 验证记录](holiday-camp-p3-validation-2026-09-27.md)。P3 已推送 25fa85c。P4 实际课次、五种个人参与状态、幂等保存及版本恢复已完成本地验证，详见 [P4 验证记录](holiday-camp-p4-validation-2026-09-27.md)。下一步 P5 AFCD 食品及独立菜谱；线上数据库迁移和真实教练 UAT 尚未执行。

以下原始交接章节是历史基线，和此处冲突时以最新执行状态与用户指令为准。

## 1. 先读这些文档

1. [已确认需求](./holiday-camp-training-nutrition-requirements.md)
2. [个人中心 UI 与移动端方案](./personal-center-development-plan.md)的 2026-09-27 章节
3. [开发批次与验收](./holiday-camp-development-plan.md)
4. [三餐营养和 AFCD 规范](./holiday-camp-nutrition-spec.md)
5. [总体进度](./training-camp-backend-implementation-status.md)的最新章节；需要动作分析集成时再读 [Training 专项进度](./training-five-template-next-phase-status-risk-plan.md)

本需求主入口为本文。Training 专项文档仍是旧动作评分、模板、视频验收的状态主索引，不能被新营养计划覆盖。更早的个人中心单页方案已被最新需求替代。

## 2. 已确认、不必再问的事项

4–18 岁；家长代管球员账号；手机号或邮箱；不做多孩子家长体系；UI 改版、训练计划、课后报告、全天三餐建议、独立 AFCD 菜谱同步纳入首版；不做周期体测和实际饮食追踪。教练记录班级实际运动/时长及个体参与差异。

桌面：顶部 Shooting/Dribbling/Training，右上角个人中心，左侧导航右侧独立页面。手机：右上角头像与菜单，下面一行三训练入口，菜单承接桌面页面导航。细节见 UI 文档。

## 3. 当前证据和未完成项

本对话只检查代码/文档并整理需求与交接；未实现新业务、未导入 AFCD、未批准计算公式、未运行应用测试、未操作数据库、未提交或部署。

检查时分支为 `developbranch`；下次必须重新确认。已看到账号/班级/Coach 权限、任务与个人中心聚合 API；用户模型没有独立身体资料字段，现有 session/report 是视频动作评估用途。

Training 专项 2026-09-22 文档记录：本地十模板 ready、前端 161/后端 43 测试通过、年龄重新评分保留旧报告；这是旧记录，本轮没有复测。真实登录/视频/存储/保存读取端到端验收仍未完成，目标生产状态未知。

工作区原本有大量未提交/未跟踪内容，包括：

- `server/app/api/v1/reports.py`、`schemas/report.py`、`services/report_service.py`，年龄重分析测试。
- `web/src/app/page.tsx`、`globals.css`、AcademyLanding/academy 样式、`web/public/academy/` 和 landing 组件。
- `web/src/app/pose-2d/report/page.tsx`、Pose2D 控件/分析器、MediaPipe hook、reports client、trainingReport 工具及测试。
- Training 进度/开发文档、未跟踪交接与 Phase 2 文档、`tmp/`、`output/`、`.playwright-cli/` 和异常名称未跟踪文件。

此列表不是完整 Git 清单。先 `git status --short` 和审查 diff；不得 reset/清理这些内容或一次性 `git add .`。不改评分 JSON/算法，不公开本地临时资料。用户本轮只要求整理文档，没有要求 commit/push。

## 4. 代码定位

- 学员聚合页：`web/src/app/me/page.tsx`；组件：`web/src/components/account/`。
- 当前外壳：`AccountCenterShell.tsx`；移动导航：`web/src/components/navigation/WorkspaceMobileMenu.tsx`。
- Coach 参考：`web/src/components/coach/CoachShell.tsx`、`web/src/app/coach/layout.tsx`。
- 路由定义：`web/src/lib/routes.ts`；个人 API client：`web/src/services/me.ts`。
- API：`server/app/api/v1/me.py`、`coach.py`；服务：`me_service.py`、`coach_service.py`。
- 模型：`user.py`、`camp_class.py`、`class_member.py`、`training_task.py`、`training_session.py`、`analysis_report.py`。

## 5. 下一对话的起步任务

先执行 P0/P1：核对工作区和现有页面行为；建立共用导航和独立路由，迁移任务提交、历史、趋势、消息，并做桌面/手机回归。暂未接通的新模块不要用假数据或可点击空入口伪装完成。

同时列出营养规则待核验项目，可独立开始 AFCD 数据格式调查；不要把附件 PAL=1.6 和示例数值直接落地。开发计划、资料、手动课次录入不必等待营养内容确定。

无需再让用户复述本轮需求；遇到新的业务决策或服务凭据缺失，提出具体问题并继续不依赖它的工作。

可复制到新对话：

> 请先阅读 docs/holiday-camp-development-handoff-2026-09-27.md 及其链接，按已确认范围开始假期班首版开发。先完成 P0/P1 的工作区基线检查、个人中心桌面侧栏/移动导航及旧任务、报告、趋势页面拆分，保留现有功能和未提交改动，再按批次推进训练计划、课次记录、AFCD 菜谱和三餐建议。每批给出实际验证证据，不把代码完成当作上线或 UAT 完成；不要改动旧评分规则。

## 2026-09-27 发布与后续批次更新

用户已确认 P0/P1 UI；c077df8 已推送 developbranch，远端 SHA 已核对，Vercel Preview 部署成功（有 SSO 保护，非 Production）。继续完成了 P2 测量历史、幂等保存、邮箱独立注册的本地实现与验证；仅手机号自助注册待短信服务。P2 尚未提交或上线迁移，详细边界及验证见 [P2 验证记录](holiday-camp-p2-validation-2026-09-27.md)。
