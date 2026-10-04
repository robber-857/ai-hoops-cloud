# 开发交接：精简训练与食材营养系统

更新：2026-10-03（Australia/Sydney）。此文是新对话的首读入口，替代 2026-09-27/09-30 的下一批执行提示。R1–R4 已完成本地实现并通过自动化、专用 PostgreSQL 和构建检查；本地应用库已备份、迁移并导入正式 AFCD 数据。当前进入 R5 联调与用户手动确认，未部署。

已执行：后端 **163 项无跳过通过**，前端 **17 文件 206 项通过**、类型检查、变更文件 lint 及隔离 webpack 生产构建通过。当前本地库为 `localhost:5432/ai_hoops`：约 42MB 备份后由 `0003` 升至 `0012`，AFCD 官方 1,588 条、精选 28 条。前端 3000、后端 8000 均由用户启动。具体数据库、计算与浏览器证据见 [本轮验证](holiday-camp-simplified-local-validation-2026-10-03.md)，使用步骤见 [精简版操作说明](holiday-camp-simplified-user-guide.md)；未列明的浏览器流程不声称通过。

## 1. 已确认范围，无需重复询问

家长端三个模块：**Profile、今日训练、食材营养**。Profile 保持姓名/昵称、出生日期、性别、身高、体重、测量日期和开始训练日期；年龄、BMI、训练年限自动计算。用户明确训练时间只指开始训练日期/年限，不扩展复杂能力体测或评分。

教练录入实际训练项目、个人参与分钟、简单强度、备注及出勤差异，预览并发布；家长继续通过球员账号只看本人训练记录和食材营养，不新增独立家长/多孩子体系。

儿童专用运动参考优先，缺项目先做有依据的儿童活动类比；4–5 岁或无适龄依据才进入已标明的近似估算分支。家长统一看“≈ … kcal”，不查看公式，也不填写 MET 或三餐比例。AFCD 食材按每 100g 可食部分展示碳水/蛋白质/脂肪，主要肉、蛋、奶、常见蔬菜。

三餐配额、菜谱推荐、餐单、实际饮食打卡、独立营养审批、心率/设备接入、语音/AI 录入和外部自动发送均不在本轮范围。旧数据和旧发布版本保留。

## 2. 阅读顺序与文档职责

1. [已确认需求](holiday-camp-training-nutrition-requirements.md)：业务范围、角色和完成标准。
2. [开发与验收计划](holiday-camp-development-plan.md)：本轮批次、改造文件、依赖与验收。
3. [课程消耗与 AFCD 规范](holiday-camp-nutrition-spec.md)：儿童/通用算法、数据映射、单位、快照与计算测试。
4. [个人中心方案](personal-center-development-plan.md)：三模块首页和页面/导航调整。
5. [本轮验证](holiday-camp-simplified-local-validation-2026-10-03.md)与[操作说明](holiday-camp-simplified-user-guide.md)：已执行检查、可操作路径及仍需用户确认的流程。
6. [总体状态](training-camp-backend-implementation-status.md)：本轮状态与历史实现证据。原 Training 专项状态继续管理旧动作评分，不被本需求覆盖。

遇到冲突，以用户最新指令及各文档顶部 2026-10-03 现行章节为准；下方三餐/菜谱旧范围和端口/测试记录按日期理解，不作为当前开发指令或当前环境证明。

## 3. 当前实现入口

以下为 2026-10-03 已实现的源码入口。自动化及数据库证据见本轮验证；源码清单本身不作为浏览器、真实用户或生产验证。

| 领域 | 已有入口/文件 | 本轮用途 |
| --- | --- | --- |
| 个人身体资料 | `server/app/models/player_profile_revision.py`、`schemas/player_profile.py`、`services/player_profile_service.py`；`web/src/components/account/PlayerMeasurementsSection.tsx` | 复用身高体重、出生日期、测量日期及历史；BMI派生，不另存输入 |
| 基础账号资料 | `server/app/models/user.py`、`api/v1/me.py`、`schemas/profile.py`、`services/profile_service.py`；`web/src/components/account/ProfileBasicsSection.tsx`、`TrainingNutritionOverview.tsx` | 已增加可空 `training_started_on` 和本人读写，自动年龄/BMI/年限；训练开始日期不放进每次体测记录 |
| 实际课次 | `server/app/schemas/camp_lesson.py`、`services/camp_lesson_service.py`；`web/src/components/lessons/LessonEditor.tsx` | 保留项目和每人分钟/出勤，增加活动映射与强度 |
| 发布与历史 | `server/app/services/class_report_service.py`、`models/class_report.py`、`api/v1/class_reports.py`；`web/src/components/class-reports/LessonReportPublisher.tsx`、`ClassReportDetails.tsx` | 同一次预览/发布保存课程消耗及规则快照，保留版本和去重 |
| 每日训练事实 | `ClassReportService.daily`；`web/src/components/class-reports/DailySummaryDetails.tsx`、`web/src/app/me/class-reports/daily/page.tsx` | 最新已发布课次的个人项目展开及课程估算汇总 |
| 食材来源与读取 | `server/app/api/v1/foods.py`、`services/training_food_service.py`、`config/training_foods.json`；`web/src/services/foods.ts`、`components/foods/*`、`app/foods/*` | 新 `/training-foods` 登录只读 API 与 `/foods` 页面，固定 AFCD Release 3，每100g三宏量，28条中文精选 |
| 课程消耗 | `server/app/services/exercise_energy_service.py`、`config/exercise_activities.json`；`web/src/components/class-reports/ClassReportDetails.tsx` 的 `ExerciseEnergySummary` | 儿童/类比/通用分支、输入/来源/规则/舍入版本、缺失小计，接入预览/冻结发布 |
| 旧全天候选工具 | `server/app/services/personal_energy_service.py`、`meal_allocation.py`、`energy_draft_service.py`；`web/src/components/class-reports/LessonEnergyPreview.tsx` | 保留历史，退出当前课程/家长主流程；不可改标题当课程消耗 |

新食材服务与原配料选择器解耦，不从旧 `recipes.ts` 的 `Food` 类型取营养。`RecipeShared` 的通用组件仍由报告引用，保留该文件；停用菜谱导航没有删除共享依赖或历史数据。

## 4. 已落实的实现边界

- **Profile：**`users.training_started_on` 可空日期及本人更新 API，派生年限；体测响应增加可选 BMI 展示字段。保留旧记录和幂等保存。
- **食品：**官方 AFCD 来源固定；独立轻量配置维护中文名、四类分类和明确生熟状态。复用原 `food_entries`/`food_releases`，不另建完整营养库或复杂后台。
- **课程估算：**独立 `exercise_energy_service.py` 已接入，输入已保存课程、本人实际分钟和上课日期前可用体测。NCCOR METy 与标准 MET 的规则分支分开，映射/公式带版本和来源。
- **发布：**扩展课程/修订 JSONB 内容与报告 JSONB 快照；新 `schema_version` 与 `exercise_energy` 结果独立于旧 `nutrition.energy_kcal`。不 UPDATE/DELETE 已发布记录，不静默给旧报告补算。
- **家长：**复用 `/me`、`/me/profile`、`/me/class-reports/daily`，已增加 `/foods` 只读页；今日结果支持日期切换，默认 Sydney 今天。菜谱和三餐主流程入口已撤下，旧菜谱浏览地址兼容跳转食材页，旧数据和 API 保留。

## 5. 接下来完成 R5

R0–R4 的基线、Profile、食材浏览、课程计算、冻结报告/今日汇总与导航已经落实。R5 已完成本地合成账号的 Profile 保存、教练预览发布、家长读取/历史、课程修订和 390px 手机菜单/布局检查；详见验证文档，勿重复开发。下一步记录用户本人操作确认及反馈；更多设备尺寸/完整键盘检查保留未执行。生产发布作为后续有明确目标环境授权的独立操作。

本轮未承诺新的交付日期或完成比例。当前儿童活动映射、通用回退来源与首批28条正式食材已准备；缺资料或未匹配项目继续明确显示“无法估算”，不造数，也不等待旧三餐配比审批。

## 6. 工作区与证据边界

本轮基线核查分支为 `developbranch`；工作区有大量已有修改和未跟踪功能文件。继续工作时重新核对分支和目标文件差异，保留所有无关改动。不 reset/清理、不使用 `git add .`，不改变旧评分规则。

已有本地迁移、测试和当前数据库证据见本轮 validation 文档；浏览器与用户确认仅采用该文档实际列明的结果。历史端口/数据库不得直接当后续连接配置。本轮未部署，旧日期文档和健康检查不代表线上 UAT。

## 可直接复制给下一轮开发

> 请先阅读 docs/holiday-camp-development-handoff-2026-10-03.md 和本轮 simplified-local-validation。R1–R4 已实现，后端163项、前端206项/类型/变更lint及隔离webpack构建已通过，本地库已备份升至0012并导入正式AFCD。本地合成账号浏览器及HTTP已走通教练发布→家长读取→修订25分钟/116kcal→旧版35分钟/185kcal保留，权限/幂等通过。下一步按用户反馈完成本人UAT及补缺，不重复开发已完成模块。保留儿童参考优先、缺失小计、冻结历史与本人权限；保留所有已有改动和旧评分规则。3000/8000由用户运行，后续先核对当前环境；未经明确目标环境授权不操作生产。
