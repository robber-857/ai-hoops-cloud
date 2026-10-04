# 下一对话交接：先修复菜谱可读性与角色导航

> 2026-10-03 此交接已由 [精简版现行开发交接](holiday-camp-development-handoff-2026-10-03.md) 替代。下方保留原始执行和验证记录；“先修菜谱再推进三餐”的启动提示不再作为本轮待办。当前开发顺序与验收请使用新交接及关联计划。

2026-10-01 最新：个人活动情景已接入预览与草稿历史，可分别为学员选择，旧草稿兼容；后端 124、前端 182 项、类型/lint/构建和真实浏览器通过。见 [本轮验证](holiday-camp-individual-activity-validation-2026-10-01.md) 与 [老板汇报说明](holiday-camp-boss-brief-2026-10-01.md)。仍只运行本地 3000/8000；公式与评分未变，正式营养发布未完成。

2026-10-01 最新：能量审核草稿可保存、刷新恢复、查看历史和复用输入；重试去重、并发及旧预览保护已接入。全量后端 121 项、前端 181 项、构建、真实浏览器和独立空库迁移回退验证通过。见 [草稿验证与剩余工作](holiday-camp-energy-drafts-validation-2026-10-01.md)。仅本地 3000/8000，pending_review 不向学员发布；P6 正式每日营养发布、单课消耗和宏量营养素仍未完成。

## 2026-10-01 最新：个人三餐热量试算与全量测试通过

教练个人能量预览已支持自填三餐百分比分配，缺资料/缺席不生成数字；与 Admin 共用舍入函数，候选版本 v2，不设置默认或正式发布。全量后端 117 项、前端 181 项、类型/定向 lint/构建和真实浏览器通过。详见 [本轮验证与剩余](holiday-camp-personal-meals-validation-2026-10-01.md)。仍只运行本地 3000/8000；宏量营养素、单课消耗及正式每日营养发布未完成。

## 2026-10-01 最新：教练个人能量候选预览

Actual lessons 已接入 Personal energy review，读取本人资料、按课次日期计算年龄，使用带来源/版本的 DRI 候选公式；已发布课次保留冻结身体资料。缺资料、缺性别、年龄不适用、缺席均不出虚假数字。新增独立本地 Energy review class 演示；能量后端 11 项、前端新增 2 项、类型/构建和真实浏览器流程通过，见 [验证记录](holiday-camp-personal-energy-validation-2026-10-01.md)。仅本地 3000/8000，不发布营养目标。剩余为规则审核、个体活动类别确认、单课消耗、宏量营养/三餐与每日营养版本发布。

## 2026-10-01 最新：管理员能量参考工具

新增 `/admin/energy-reference`：查官方 4–18 岁参考表，明确选择 PAL，支持自填三餐百分比的热量试算。来源逐项比对和本地 API/浏览器验证通过，详见 [验证记录](holiday-camp-energy-reference-validation-2026-10-01.md)。使用参考体型，不是个人能量计算；不保存/发布给学员，不推断默认 PAL 或三餐比例。前端 3000 / 后端 8000 已更新，个人规则、单课运动消耗、三大营养素及每日营养发布仍待完成。字段已补进 [操作说明](holiday-camp-user-guide.md)。

## 最新：每日事实汇总与操作说明已完成本地验证

已新增 [中文操作说明](holiday-camp-user-guide.md) 和学员 Daily summary：同日多课取各课最新发布版本，累加个人参与分钟，正确处理缺席和改日期。11 项后端报告测试、5 项相关前端测试、类型/构建与真实浏览器检查通过，详见 [验证记录](holiday-camp-p6-daily-validation-2026-09-30.md)。前端 3000 / 后端 8000。热量、全天需求、三餐及每日营养发布仍待完成；用户方向为经常运动、重点看热量，未确认数字不能自行定值。已有评分和无关修改保留，只操作本地。

## 2026-09-30 当前进度：P6a 本地完成，端口 3000 / 8000

按用户“继续开发”进入 P6：课后记录预览、事务发布、个人读取、历史修订和通知去重已实现并完成本地验证。前端 **3000**、后端 **8000**；旧 3016/8111 演示服务已关闭。详见 [P6a 验证与账号](holiday-camp-p6a-validation-2026-09-30.md)。用户指定经常运动、重点热量；三餐规则尚无，热量和三餐数值仍未生成。P6 整体未完成，不代表真实用户 UAT 或上线。已有修改、评分规则和生产边界保留。下方旧端口和“P6 未开始”属于历史状态，以本节为准。


## 2026-09-30 P5 修复后的当前状态

P5 角色导航、缺失名称提示和独立可读演示内容已修复；三角色真实本地浏览器、权限矩阵、保存/重载/历史/重试检查通过。用户复验仍待进行；P6 未开始，公式不自行定值。新预览为 **3016 / API 8111 / ai_hoops_recipe_demo**，原 3015/8110 是合成测试库，不用于此次内容验收。详见 [本轮修复、账号与剩余进度](holiday-camp-p5-repair-validation-2026-09-30.md)。本次未提交、未部署、不动生产，保留旧评分和既有改动。下方先修 P5 的描述保留为历史交接。


更新：2026-09-30。用户开始手动预览后提出问题；本文件优先于旧文档中“下一步直接进入 P6”的安排。

## 1. 用户最新要求与边界

- 菜谱和 food 食材必须显示人能看懂的菜品/食材名称，不显示一堆 ID 或开发测试标题。
- 排查菜谱页面是否影响 Coach / Admin 身份判定，并保留各角色工作区入口、导航和退出能力。
- 先完成这些 P5 验收修复，再推进后续功能。注册登录不扩展；排查现有会话和权限属于本批范围。
- 数据迁移、导入、演示数据准备只做本地。不得操作生产数据库、部署生产或合并到生产分支。
- 保留工作区已有未提交改动、旧评分规则；教练和管理员查看学员继续显示姓名，不以账号或 UUID 替代。

## 2. 已确认事实与尚未确认的问题

| 项目 | 证据与结论 |
| --- | --- |
| 菜谱内容不可读 | 用户截图显示 `P5c revised recipe`、`Synthetic P5b draft revision`、`Second title` 等。这是本地合成测试数据，不是正式菜谱，也不是 AFCD 食材名。不能把测试样本当成可交付内容。 |
| 角色导航 | `web/src/app/recipes/layout.tsx` 对所有已登录角色使用 `AccountCenterShell`，没有角色分流；Coach/Admin 会进入个人中心导航。已确认外壳不区分角色。 |
| 角色是否被改写 | 尚未证实。该 layout 只读取 auth store，不写入角色；截图中的 `P3 Student` 只能证明当时显示学员账号，不能证明教练被降级。需检查服务端 `/auth/me`、会话、前端 store 与实际权限。 |
| 食材 ID | `FoodPicker` 和编辑器已有名称字段，编辑器也有名称映射与兜底路径；不能笼统断言所有位置都只显示 ID。下一批须逐项复现搜索、添加、保存、重载、详情和历史版本中的泄漏路径。 |
| 验收结论 | P5 代码链路与合成自动化验证已完成，但用户已提出内容与角色体验问题，P5 用户验收未通过。 |

## 3. 下一批按此顺序执行

1. **基线与复现**：核对 branch/status、监听端口和测试数据库连接；记录 Admin/Coach/Student 各自进入菜谱前后的 `/auth/me` 与 auth store 角色。使用独立浏览器会话测试，再覆盖同浏览器退出/切换账号，避免共享 cookie 混淆证据。
2. **角色导航与权限**：菜谱浏览保持共用业务组件，但外壳/返回入口按真实角色组织；Admin 菜谱编辑保持管理员限定。角色必须来自服务端认证，不从 URL 或页面外壳推断。检查首次进入、刷新、返回、深链接、移动菜单、退出和重新登录。学员/教练不能访问管理员写接口；未经授权响应与前端守卫分别验证。
3. **名称显示**：列表显示真实菜名，食材显示食品名称；ID、food_key、release_id 仅作为内部关联和来源追踪，不作主标题、选项名称或错误兜底。名称缺失应明确提示并提供恢复方式，不猜名称。覆盖缺失/慢加载、错误重试、保存后重载及历史快照。
4. **可理解的本地演示内容**：建立独立、可重复生成的本地演示数据集，与自动化测试数据隔离；准备少量易懂的菜品名称、食材克数、份数、做法及过敏原说明。演示内容明确标识，不冒充正式营养方案。不得批量改写既有发布快照来美化历史；使用新草稿/新发布版本或独立本地演示库。保留 AFCD 原始名称和来源；如加中文展示名，应独立映射且保留生熟、部位等区别，不破坏来源键。
5. **验收与交付**：针对角色和名称问题补充必要回归测试，真实浏览器直接连接本地 API，不用请求拦截掩盖 CORS/会话问题；桌面和手机人工可读性检查。给用户三角色预览入口、测试步骤与实际结果，更新开发和进度文档。修复通过后再进入 P6。

P6 的个体全天需求、三餐分配和运动消耗规则仍待核验/确认，不能用演示数值或 AFCD 食品成分冒充已批准的个体处方。

## 4. 当前版本、验证和环境

- 仓库：`D:\githubproject\ai-hoops-cloud`；分支：`developbranch`；功能提交：`94998ef454fb434422bd5f0bf9a86e2642b30f7e`，已推送 `https://github.com/robber-857/ai-hoops-cloud`。下次重新核对远端。
- 已完成 P0/P1、P2、P3、P4、学员姓名显示、P5a–P5c。P5c 记录前端 167 项测试、类型/构建与五屏宽流程；后端 94 项来自 P5b，均为此前验证，不是本次重跑。
- 上一轮预览实际通过 Admin/Coach/Student 登录与菜谱读取，以及 Admin/Student 刷新保持会话；这没有覆盖完整角色权限矩阵或真实用户 UAT。
- 本地前端 `http://127.0.0.1:3015/auth/login`，API `http://127.0.0.1:8110/api/v1`；前端进程覆盖 `NEXT_PUBLIC_API_BASE_URL` 指向 8110。不要直接使用 `.env.local` 的旧 8000 端口。
- 专用容器 `ai-hoops-p2-test-20260927`，PostgreSQL 本机 `127.0.0.1:55439`，数据库 `ai_hoops_p2_test`；已验证迁移头 `20260929_0008`。AFCD 官方食品记录 1,588 条，另有合成测试数据。
- 本地 API 进程设置 `CORS_ORIGINS` 允许 3015、`SESSION_COOKIE_NAME=ai-hoops-local-preview`、secure=false、development，并显式指定本地 DATABASE_URL。本地 JWT 配置与生产隔离；不要输出生产凭据。
- 启动时用本机 127.0.0.1，统一使用此主机名，避免 localhost 与 127.0.0.1 的 cookie 差异。会话 cookie 不按端口隔离。端口 3000 上一轮属于其他项目，不得随意停止。
- 上一轮保留了前端/API/数据库运行；新对话必须复查，不能假定进程仍在。
- 本地测试账号：Admin `names_admin` / `Names-fixture-only-2026`；Coach `p3_coach`、Student `p3_student` / `P3-fixture-only-2026`。仅为合成测试库账号。
- API Python：`C:/Users/28068/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe`；旧 venv 解释器失效时可参考此运行时，并设置 server、server/.venv/Lib/site-packages、tmp/p2-test-deps 的 PYTHONPATH；使用前重新验证存在性。

## 5. 代码与文档定位

- 页面外壳：`web/src/app/recipes/layout.tsx`、`components/account/AccountCenterShell.tsx`、`components/admin/AdminShell.tsx`、`components/coach/CoachShell.tsx`。
- 会话：`web/src/store/authStore.ts`、`components/auth/ProtectedRoute.tsx`、`server/app/api/v1/auth.py`。
- 菜谱：`web/src/components/recipes/{RecipeList,RecipeDetail,RecipeEditor,FoodPicker,RecipeShared}.tsx`、`web/src/services/recipes.ts`、`server/app/api/v1/recipes.py`、`server/app/services/recipe_service.py`。
- 需求与历史：[原交接](holiday-camp-development-handoff-2026-09-27.md)、[开发计划](holiday-camp-development-plan.md)、[营养规范](holiday-camp-nutrition-spec.md)、[总体进度](training-camp-backend-implementation-status.md)、[P5c 验证记录](holiday-camp-p5c-validation-2026-09-30.md)。
- 本轮只更新文档；尚未修复角色导航、名称显示或替换本地测试数据，未迁移/部署生产。工作区存在大量既有改动，尤其总体进度文档本身已有未提交内容；提交时只选择本轮内容，不使用 `git add .`。

## 可直接复制到新对话

> 请先阅读 docs/holiday-camp-next-session-handoff-2026-09-30.md 和关联开发/进度文档。先做 P5 验收修复：排查菜谱页面对 Coach/Admin 角色、导航、会话和后端权限的影响；菜谱与 food 食材显示清楚的菜名/食材名，不显示 ID 或测试标题；建立与自动化测试隔离、可读的本地演示数据。先复现，再实现并按三个角色验证，更新文档并提供手动预览。只操作本地数据库，不动生产，不扩展注册登录，不改变旧评分规则，保留所有已有未提交改动。P5 问题处理后再推进 P6，未确认营养规则不得自行定值。
