# 开发交接：假期班训练、营养与个人中心

更新：2026-09-27。给下一个对话的首读入口。

## 最新执行状态（P0/P1 实施后追加）

P0 工作区基线和 P1 个人中心导航/独立路由已实施。详见 [P0/P1 验证记录](./holiday-camp-p0-p1-validation-2026-09-27.md)：前端 161 项、相关后端 14 项、TypeScript/lint/build 和五屏宽合成浏览器回归通过；未提交、未部署、未执行真实账号/视频/数据库端到端 UAT。P2 起未实施，营养规则仍待核验。

新入口为 `web/src/app/me/layout.tsx`、六个 `/me` 页面、`components/account/AccountDataProvider.tsx`、`AccountPages.tsx` 和 `accountNavigation.ts`。下面“本对话只检查文档”“下一对话先执行 P0/P1”等段落保留为原交接基线，不代表最新状态；后续先检查本次未提交改动，再继续 P2 或真实 UAT。

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
