# 本地未提交工作清单

核对日期：2026-10-04（Australia/Sydney）。当前分支 `developbranch`；盘点基线为 `a534defc56d0fd1ad47c86a892fb37b9747d7050`。本文件描述当前分支的工作区差异，区分其他分支已经提交的内容，保留原有源码与历史文档。

**2026-10-05 后续进展**：本清单第 1 组的 12 项已纳入视频年龄报告交付，连同必要的统计/任务/分享修复及回归测试完成隔离验证；交付后其余基线保持 **13 个已跟踪修改 + 32 个未跟踪文件 = 45 项**，内容 SHA-256 全部与盘点基线一致。下面的 57 项是 10 月 4 日的历史盘点，不再表示当前待提交总数。最新验证和推送/CI 状态见 [视频年龄报告交付](training-report-age-validation-2026-10-05.md)。

## 已经推送的本轮需求

- `619393e`：精简 Profile、教练实际课程与估算消耗、家长发布记录及 AFCD 每 100 g 食材营养。
- `4fdfd96`：持久 Chromium E2E、严格 GitHub CI、额外 PostgreSQL 边界测试和测试准备工具。
- `a534def`：成功 CI 和独立合成库恢复验收证据。

这些核心文件没有未提交差异。CI 的后端 167、前端 161、浏览器 3 组针对已提交源码，详细结果见 [自动验证说明](holiday-camp-automated-validation-2026-10-04.md)。下面的其他本地代码不因此获得 CI 通过证明。

## 总数与分类

盘点时暂存区为空：**22 个已跟踪文件修改、35 个未跟踪文件，共 57 项**。这个数字排除了 `tmp/`、`output/`、`.playwright-cli/` 中的临时内容，以及 Git 已忽略的依赖、构建目录和本地环境文件；本次新增的盘点文档也不计入基线。

| 分组 | 修改 M | 未跟踪 U | 合计 | 当前判断 |
| --- | ---: | ---: | ---: | --- |
| 视频报告按年龄重评分及 Pose | 9 | 3 | 12 | 前后端必须成组审阅与验证 |
| 旧菜谱兼容和错误提示修复 | 7 | 1 | 8 | 低优先级兼容候选，现有菜谱路由均转食材页 |
| 旧能量参考/个人全天能量工具 | 0 | 10 | 10 | 属于旧方案，部分包含三餐配额，暂不并入精简家长流程 |
| 首页 / Academy / Landing | 2 | 12 | 14 | 其中 10 项已经在 GitHub main，另 4 项是本地样式/原型/截图 |
| 旧评分计划及第二阶段文档 | 4 | 4 | 8 | 与各自功能分组同步，保留历史证据 |
| 旧演示种子与启动脚本 | 0 | 4 | 4 | 固定演示环境工具，需要单独整理安全限制 |
| 零字节命令残留文件 | 0 | 1 | 1 | `({src`，0 bytes；本轮保留 |
| **合计** | **22** | **35** | **57** | |

### 1. 视频报告按年龄重评分：12 项

```text
M server/app/api/v1/reports.py
M server/app/schemas/report.py
M server/app/services/report_service.py
M web/src/app/pose-2d/report/page.tsx
M web/src/components/Pose2D/Controls.tsx
M web/src/components/Pose2D/PoseAnalysisView.tsx
M web/src/components/Pose2D/PoseAutoAnalyzer.tsx
M web/src/hooks/useMediaPipePose.ts
M web/src/services/reports.ts
U server/tests/test_report_age_reanalysis.py
U web/src/lib/trainingReport.ts
U web/src/lib/__tests__/trainingReport.test.ts
```

新增 `POST /api/v1/reports/{id}/reanalyze-age`，允许本人用冻结模板和原始测量另存 Training 年龄对比报告。复用原 session/video，保留原报告；统计查询排除年龄对比报告，防止重复计入成长/任务等。客户端计算新分数，服务端校验结构并复制冻结资料，不能称为服务端权威复算。

上传页年龄选择、已保存报告的预览/另存/取消、前端 API 与后端接口互相依赖。这组差异还包含完整时间序列门槛、向前新帧捕获、保存中锁定/失败保留数据、冻结模板 hash 核验及 MediaPipe 脚本加载并发/失败重试；共享 Pose 改动影响投篮/运球页面，不能只验证年龄按钮。新增后端文件含 8 项 SQLite 用例，尚未进入远程 167 项 CI；提交前需对应单元/类型检查、真实 PostgreSQL 的幂等/锁与统计回归，以及真实视频上传/保存、切年龄→另存→刷新→原报告不变和共享只读的浏览器验证。

### 2. 旧菜谱兼容修复：8 项

```text
M server/app/services/recipe_service.py
M server/tests/test_recipes.py
M web/src/app/recipes/layout.tsx
M web/src/components/recipes/FoodPicker.tsx
M web/src/components/recipes/RecipeDetail.tsx
M web/src/components/recipes/RecipeEditor.tsx
M web/src/components/recipes/RecipeShared.tsx
U web/src/lib/__tests__/recipeWorkspace.test.ts
```

无效食材仍返回 422，改用第几项食材不可用及重新选择提示；角色外壳分别保留 Admin/Coach/个人工作区，另有缺失名称和重试提示调整。`RecipeShared` 的通用工具被当前课后报告复用，但本次差异只改旧菜谱 Nutrition 展示，没有直接改 `/foods` 或今日训练主流程。

当前 `/recipes`、`/recipes/[id]` 及 `/admin/recipes` 列表/新建/详情均已重定向 `/foods`，旧 RecipeDetail/RecipeEditor/RecipeList 没有页面挂载。这是兼容修复候选，不会恢复家长菜谱推荐需求；无需为验证重新开启菜谱入口。以后提交时应验证旧菜谱 PostgreSQL 测试、角色外壳、失效食材和重试提示，并确认这些旧 URL 继续转食材页。

### 3. 旧能量工具：10 项

```text
U web/src/app/admin/energy-reference/layout.tsx
U web/src/app/admin/energy-reference/page.tsx
U web/src/components/class-reports/EnergyDraftHistory.tsx
U web/src/components/class-reports/EnergyReferenceResult.tsx
U web/src/components/class-reports/LessonEnergyPreview.tsx
U web/src/components/class-reports/PersonalEnergyDetails.tsx
U web/src/lib/__tests__/energyReference.test.ts
U web/src/lib/__tests__/personalEnergy.test.ts
U web/src/services/energyReference.ts
U web/src/services/personalEnergy.ts
```

后台参考页及个人全天能量/审核草稿 UI 依赖已保留的旧后端接口。`LessonEnergyPreview` 还包含早/午/晚三餐百分比输入；当前精简课程页面没有挂载它。这一组不是当前 Profile→课程估算→AFCD 食材需求的遗漏，应按旧后台工具单独决定是否继续维护，不能当作待上线的家长功能。

### 4. 首页与分支差异：14 项

```text
M web/src/app/page.tsx
M web/src/app/globals.css
U web/src/app/AcademyLanding.tsx
U web/src/app/academy.module.css
U web/src/components/landing/AnalysisModeStage.tsx
U web/src/components/landing/MotionIntelligenceHero.tsx
U web/public/academy/ASSETS.md
U web/public/academy/basketball-court.jpg
U web/public/academy/dribbling-promo-prompt.txt
U web/public/academy/dribbling-promo.webp
U web/public/academy/infinity-logo.png
U web/public/academy/shooting.jpg
U web/public/academy/strength.jpg
U web/figma-concept-v2-preview.png
```

实际本地首页入口为 `/` → `AcademyLanding` → `academy.module.css` 和五张图片。**其中 `page.tsx`、Academy 组件/样式及 `public/academy` 的七项资料，共 10 个文件，已在 GitHub main 的 `5066ad32379e32c0a9fd9ca3c57ab71044d2da32` 中提交。** 逐项按 Git 过滤规则计算的 blob hash 与本地一致；远程 main 的实际 hash 已核实，`5066ad3` 不在当前 developbranch 的祖先中。因此这 10 项应描述为分支尚未合入，而非从未推送。

剩余 `globals.css`、两个 Landing 组件及预览 PNG 属于独立本地工作。两个组件当前没有被页面导入，PNG 没有运行时引用；新增的大部分 `landing-*` CSS 只被这些原型使用。删除字体导入和全局定位调整仍会影响全站。未来同步首页时应单独核对 main/developbranch 的变化，不附带合入这些未使用原型或未经评估的全局样式。

### 5. 旧计划与未来规划：8 项

```text
M docs/training-camp-backend-next-iteration-task-breakdown.md
M docs/training-five-template-end-to-end-development-plan.md
M docs/training-five-template-metrics-development-plan.md
M docs/training-five-template-next-phase-status-risk-plan.md
U docs/training-five-template-upload-report-handoff-2026-09-19.md
U docs/phase-2-ai-tactical-video-architecture.md
U docs/phase-2-ai-tactical-video-prd.md
U docs/phase-2-boss-requirements-confirmation-report.md
```

五模板文档记录 9 月评分和年龄选择工作，不能把其中“已实现”理解为已经包含在本轮推送里。三份 Phase 2 文件是未来战术/长视频等规划，不能视为当前已开发模块。

这些文件尚需随各自功能梳理状态：旧任务文档仍列三餐/菜谱首版；某些“当前现状”属于此前断点；旧模板总数 12 与当前配置 17（Training 10、Dribbling 5、Shooting 2）不一致；上传交接有 25 个本机绝对链接。当前训练饮食范围以 [2026-10-03 精简需求](holiday-camp-training-nutrition-requirements.md) 及本轮验证文档为准。盘点没有改写这些旧文件中的日期和证据。

### 6. 旧演示脚本：4 项

```text
U server/tools/seed_recipe_demo.py
U server/tools/seed_class_report_demo.py
U server/tools/seed_personal_energy_demo.py
U server/tools/start_recipe_demo.ps1
```

这些脚本依赖旧固定演示库/账号/日期，其中有顶层写入、`assert` 限制及特定 Windows runtime/容器依赖。它们不是已提交的随机账号 `seed_training_e2e.py`。未来需要交付时，再统一显式测试环境、实际数据库身份校验、重跑及失败清理，独立验证后提交。

## 临时文件与下一步

`tmp/` 包含数据库备份、随机测试账号 fixture、AFCD 工作簿、依赖缓存、隔离源码副本、日志及临时检查脚本；`output/` 和 `.playwright-cli/` 包含截图、报告及浏览器记录。这里只查看目录名，没有把这些内容混入提交。已整理的脱敏恢复证据在已跟踪的 `docs/evidence` 中。

建议下一批先验证并交付活跃的视频年龄重评分/Pose 前后端及相应文档；首页按 main/developbranch 的分支同步单独处理。旧菜谱兼容修复优先级较低；旧能量/三餐工具、未挂载 Landing 原型、未来规划及演示脚本继续作为独立工作管理。当前精简训练需求剩余的正式发布工作仍是教练/家长 UAT 和正式环境准备，见 [交付与剩余验收](holiday-camp-release-readiness-2026-10-04.md)。
