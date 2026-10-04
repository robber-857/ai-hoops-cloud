# 精简训练与食材营养：本地实现与验证记录

日期：2026-10-03（Australia/Sydney）。本文件对应 [R0–R5 开发计划](holiday-camp-development-plan.md)、[现行需求](holiday-camp-training-nutrition-requirements.md)及[计算/AFCD 规范](holiday-camp-nutrition-spec.md)。记录本轮实际执行的检查，不继承旧三餐、菜谱或 P5/P6 验证结论。

状态：R1–R4 已实现并完成本地自动化检查及 3000/8000 联调，R5 的用户本人操作确认、正式部署尚未执行。用户自行启动前端 3000、后端 8000；本轮未停止或重启这两项服务。以下浏览器及 HTTP 结果使用本地合成账号和课程，不代表真实教练/家长 UAT。

## R0–R5 状态

| 批次 | 已有证据 | 当前边界 |
| --- | --- | --- |
| R0 基线/契约 | `/training-foods`、`/me/profile`、`/exercise-activities`；真实本地库备份、迁移至 `20261003_0012`；保留既有未提交改动 | 未提交、推送或部署；正式环境仍需独立备份和迁移 |
| R1 Profile | 基础资料与追加体测、训练日期、当前年龄/训练年限、统一 BMI 舍入；13 个后端测试全部通过（含 3 个 PostgreSQL）；真实浏览器保存昵称和新体测并重新登录读取 | 日期控件自动填入未触发浏览器事件，因此日期保存由真实 HTTP 验证，UI 核对持久化值 |
| R2 食材营养 | 正式 AFCD 1,588 条已导入本地；精选 28 条；8 个后端、7 个前端测试；真实分类、中英文搜索、无结果、分页与手机布局 | 错误和来源缺失分支由测试验证；未在正在运行的服务中破坏来源以模拟异常 |
| R3 课程消耗 | 9 个版本化活动映射；儿童/类比/通用估算、缺失输入、个人分钟、最终一次舍入；11 个计算测试 | 输出训练期间总消耗估算（包含静息部分），不是全天需求或精确设备测量 |
| R4 今日记录/冻结发布 | 教练浏览器保存/预览/发布；家长首页三卡与本人记录；发布指纹、幂等、缺席、冻结与日汇总测试 | 仅显示已发布记录；旧报告没有新消耗字段时显示不可估算 |
| R5 整体与用户确认 | 后端 163/163；前端 17 文件 206/206；TypeScript、针对性 ESLint、隔离 webpack 生产构建及差异检查通过 | 用户本人 UAT 与正式发布待执行，自动化及本地联调不替代这两项 |

## R1 实现与针对性检查

- `users.training_started_on` 为可空日期，migration `20261003_0012` 从 `20261001_0011` 追加，旧用户不赋予猜测的日期。
- `/api/v1/me/profile` GET/PATCH 从登录身份确定本人；请求不接受 `user_id`、角色、联系方式等无关字段。昵称和训练日期可独立更新或清空。
- 开始日期不得在 Sydney 的未来或早于最近已记录的出生日期；新增体测不得将出生日期改到训练起始日之后。Profile 更新与新增体测锁定同一用户行；已保存体测的幂等重试继续返回其原记录。
- Profile `expected_updated_at` 防止使用旧版本覆盖最新资料；空 PATCH 不变更资料。
- BMI 从对应记录的厘米/公斤计算，服务端 Decimal half-up 保留两位；不写入体测快照，也不作成人 BMI 体重类别判断。
- 前端测试覆盖 Sydney 时区/夏令时、生日、闰日与月末、空/未来日期、训练经验年/月、BMI 单位、缺失数据以及旧响应兼容。

已执行 `tests.test_profile`：**13/13 通过，无跳过**。专用 PostgreSQL 测试覆盖真实保存/并发旧 token、训练日期与出生日期并发、历史测量幂等重试。

独立审阅发现的问题均已修正：前端以精确十进制分数和 half-up 计算 BMI，`200 cm / 80.02 kg` 与后端一致返回 `20.01`；Profile 同时展示按 Sydney 今天派生的当前年龄与历史体测年龄。前端回归测试已覆盖。

## R2 来源、精选与每 100 g 口径

新 [食品服务](../server/app/services/training_food_service.py)直接读 `FoodEntry.content.nutrients`，沿用 manifest `core_mapping`，不经过 `RecipeService`。新 [食品 API](../server/app/api/v1/foods.py)只提供登录 GET `/api/v1/training-foods`；原 `/foods` 和菜谱存储保持兼容。

[版本化精选配置](../server/app/config/training_foods.json)为 `training-foods-afcd-r3-2026-10-03-v1`，包含 **28 条：肉类 8、蛋类 4、奶类 5、蔬菜 11**。中文名、分类、状态、原始英文名称和食品键分开保存；营养数值没有写进精选配置。

来源固定为 `AFCD Release 3`，导入指纹：

```text
26922a4c7b33d94d1937b9e66c8660a9322bcad72664f2da150856faa271955c
```

服务按名称及该指纹选择来源，同时核对 manifest 的食品数据口径、三宏量单位、官方字段映射、来源页、许可、署名及源文件哈希/URL。不会采用“最新导入”来源或合成食品。所选来源不存在时返回明确 `source_unavailable` 空态；部分条目缺失显示 `partial_catalog`；来源或食品身份/格式校验失败返回 503，前端可重试。

本轮离线重新解析 `tmp/afcd-release-3` 三份工作簿，1,588 个食品的指纹与固定值相同；28 个精选键均存在且原始名称逐一相符。官方 [数据文件页](https://www.foodstandards.gov.au/science-data/food-nutrient-databases/afcd/data-files)当前链接与本地 manifest 所记三个下载 URL 对应；[使用许可](https://www.foodstandards.gov.au/science-data/monitoringnutrients/afcd/datauserlicenceagreement)在页面来源区保留链接、FSANZ 署名、中文译名说明及数据限制说明。

| 源工作簿 | 本地文件 SHA-256 |
| --- | --- |
| `food-details.xlsx` | `69aa096c45cb0699db60a9c544442312e9ff09af587b99c42dc78bc26f689629` |
| `nutrient-profiles.xlsx` | `14cb3e73dbf58987b440e6299624c0fefd7a4e61591fc1f753995d9534e0efc9` |
| `nutrient-details.xlsx` | `7c455129a90e65d29840ecd188fa223cca8bdf0729b21efebc286884d69fafaa` |

三宏量值来自 `All solids & liquids per 100 g` 工作表：碳水使用 `Available carbohydrate, without sugar alcohols (g)`，蛋白质使用 `Protein (g)`，脂肪使用 `Fat, total (g)`。以下是从该工作表核对、再由测试独立断言的样本，单位均为 **g / 100 g 可食部分**：

| food_key / 食品状态 | 碳水 | 蛋白质 | 脂肪 |
| --- | ---: | ---: | ---: |
| F002594 鸡胸肉去皮瘦肉，生 | 0 | 22.5 | 0.8 |
| F002593 鸡胸肉去皮瘦肉，烤制无加油 | 0 | 29.8 | 2.5 |
| F003721 鸡蛋全蛋，煮熟去壳可食部分 | 0.7 | 12.4 | 9.4 |
| F005634 全脂液态牛奶 | 5.4 | 3.3 | 3.4 |
| F001900 西兰花，新鲜水煮沥干 | 1.2 | 2.9 | 0.3 |

牛奶继续按重量 100 g，不改成 100 mL；生熟作为不同来源记录展示，不自行推算烹调影响；保留官方小数精度，`null` 显示“暂无数据”，真实 0 显示 `0 g`。

已执行 [后端食品测试](../server/tests/test_training_foods.py) **8/8 通过**：官方源/清单/样本、登录及只读权限、筛选边界、中文英文搜索、分页、生熟、缺失与零、来源/身份/异常数值/格式失败保护。另已通过 8000 真实数据库请求和 3000 浏览器读取验证当前来源可用。

已执行 [前端食品测试](../web/src/lib/__tests__/foodNutrients.test.ts) **7/7 通过**：牛奶 100 g、状态及原名可查看、源精度、null/0、署名/许可/译名，以及 admin、coach、student、user 四种角色外壳。页面只读，提供分类与搜索，不提供食材克数输入、菜谱、做法或个人补吃量。

## R3/R4 实现与计算边界

- 独立课程计算服务使用已核对的 NCCOR 儿童 METy 与 Schofield BMR；6–18 岁按儿童年龄段选值。合适的类比单独标记，无适合儿童来源及 4–5 岁按已确认的通用公式近似估算。
- 通用公式为 `MET × 3.5 × kg ÷ 200 × 本人分钟 × 强度系数`（低 0.8、中 1、高 1.15）。儿童 METy 分支不再次乘该系数。
- 活动标准和强度由教练选择，不从动作名称猜测。有效运动分钟排除休息、讲解和排队；个人参与分钟可小于班级分钟。
- 输入不足为未知，缺席为不适用。部分可计算只展示已知小计及未知项目数量，不将未知项当成零。日汇总使用冻结的未舍入小计再统一 half-up 到整数 kcal。
- 规则 `course-gross-energy-2026-10-03-v1`、映射 `exercise-activities-2026-10-03-v1`、舍入 `decimal40-sum-half-up-integer-kcal-v1` 保存进发布快照；更新体测或映射不重算旧报告。
- 首次发布必须携带预览指纹；发布复核读取到的体测等输入与预览不同返回 409，要求重新预览。复核读取后另一个事务再更新资料，不保证触发 409，此并发时序的专项测试待补。已发布版本的幂等重试仍返回原回执，不新增报告或通知。
- 原全天 EER/三餐逻辑及存储保留兼容，当前主流程不提供入口；旧菜谱网页转到 `/foods`。

## 实际本地数据库与运行服务

已确认 8000 使用 `localhost:5432/ai_hoops`，最初 Alembic 为 `20260923_0003`。首次查询暴露缺少 `users.training_started_on`，先创建 `tmp/local-db-backups/ai-hoops-before-0012-20261003.sql`（42,642,776 bytes），再执行现有追加迁移至 `20261003_0012`。迁移后的无效账号登录由 schema 500 恢复为预期 401。

使用 [本地 AFCD 导入工具](../server/tools/import_training_foods.py) 导入已核对的三份工作簿：Release 3、1,588 条食品、28 条精选条目可用。导入工具限制本地开发数据库。没有停止服务、删除卷、修改其他项目数据库或向外部家长发消息。

完整后端回归使用独立测试库 `127.0.0.1:55439/ai_hoops_p2_test`，迁移至 0012；`PLAYER_PROFILE_TEST_DATABASE_URL` 与 `DATABASE_URL` 均指向该库，163 个测试全部通过，无跳过。该结果覆盖既有评分/报告相关回归，但不代表用户视频分析的真实 UAT。

## 3000/8000 浏览器及真实 HTTP 联调

仅创建 `simplified_demo_parent`、`simplified_demo_coach`、`simplified_demo_peer` 和标题带 `Local training demo - synthetic` 的本地合成课程。

- Profile：浏览器保存昵称 `Alex Local Demo`，页头同步更新；将身高体重从 150 cm/40 kg 改为 155 cm/43 kg 后保存新体测，历史两条都保留。重新登录后读取当前年龄 12 岁、BMI 17.90、训练经验 2 年。出生日期及训练日期经真实 HTTP 保存后在页面核对；浏览器自动化日期控件填入未触发 React 状态，未将此算作日期控件保存验证。
- 教练：真实页面选择热身低强度 10 分钟、篮球比赛高强度 20 分钟、拉伸低强度 5 分钟；学员一全勤、学员二缺席。保存至 v3、查看预览并发布 2 份本人记录；全勤 35 分钟、约 185 kcal，使用 43 kg 体测；缺席只显示出勤、不生成运动消耗。重复查看回执成功。
- 浏览器发现课程保存后 editor/publisher 使用重复 sibling key 导致旧编辑器残留；已改为独立 key。修正后再次保存只有 1 个编辑器，成功退出 Saving 状态，控制台无 error。
- 家长：首页实际显示 Profile/今日训练/食材三卡，35 分钟、约 185 kcal 与本人三项活动；未发布前日汇总为 0 课。课程和个人输入来源清楚显示。
- 食材：登录页面读取官方 28 条，中文分类和“牛奶”搜索、`milk` 英文搜索返回 3 条、无结果状态、第二页 8 条均验证；全脂牛奶每 100 g 为碳水 5.4/蛋白质 3.3/脂肪 3.4 g。
- 布局：默认桌面三卡展示；390 px 手机上首页、食材页、Profile 的 document scrollWidth 与 clientWidth 均为 375 px，无页面横向溢出。手机菜单可实际进入食材和个人档案。

课程修订与权限已通过真实 8000 HTTP 验证，共 54 项检查通过。原始 JSON 和合成账号脚本只保留在本地 `tmp/simplified-live-validation.json`、`tmp/simplified_live_validate.py`；它们依赖本机 fixture，不作为通用验收工具或 GitHub 附件。可共享的结果摘要如下：

- v4 将本人篮球参与分钟改为 10，课程仍 35 分钟；本人共 25 分钟、约 116 kcal。日汇总只采用该课一次最新发布版。
- 旧 v3 仍为 35 分钟、185 kcal、43 kg/155 cm；逐字段冻结内容保持一致。浏览器实际打开 v4 详情和 v3 历史链接，分别看到 25/116 与 35/185，并清楚标记历史版。
- peer 只能读自己缺席记录，读取 parent 报告及历史返回 404；parent 发布返回 403；已发布报告没有可编辑 PATCH（405）。
- v3/v4 重试均返回原发布回执，报告历史 IDs 和通知 IDs 未增长。未给真实用户或外部渠道发送消息。

家长首页实际截图：[三模块首页](evidence/simplified-parent-overview-20261003.jpg)。该图来自合成账号的最新 v4，不是示意图。数据库备份、临时环境、原始工作簿及本地账号脚本均不纳入提交。

## 可复跑检查与环境限制

后端正常开发环境按 `server/requirements-dev.txt` 准备测试依赖，在 **专用测试库** 设置 `DATABASE_URL` 和 `PLAYER_PROFILE_TEST_DATABASE_URL` 后执行：

```powershell
# server 目录；不得把完整回归指向包含实际用户的库。
python -m unittest discover -s tests
```

本轮未修改用户运行环境的依赖，借用 bundled Python、`server/.venv/Lib/site-packages` 和已有 `tmp/p2-test-deps` 执行；将 TEMP/TMP 指向工作区临时目录解决 AFCD 测试在 Windows 沙箱中的文件写入限制。

```powershell
# web 目录
npm test
npx tsc --noEmit
npx eslint src/app/foods src/components/foods src/components/account/ProfileBasicsSection.tsx src/components/account/TrainingNutritionOverview.tsx src/components/lessons/LessonEditor.tsx src/components/class-reports src/services/foods.ts src/lib/profile.ts
```

前端完整 17 文件、206 测试通过，TypeScript 与本轮相关文件 ESLint 通过。为保留正在运行的 `web/.next`，将源码复制到 `tmp/simplified-build-9a37327c` 进行 `npm run build -- --webpack`：43 页面构建成功。默认 Turbopack 无法解析临时副本外部的依赖 junction，改用 webpack；Windows 沙箱编译器 canonicalize 被拒绝时，在获准的本地构建中通过。构建存在既有 baseline-browser-mapping 过期提示，未因此升级依赖。`git diff --check` 通过。

## 尚未执行

用户本人教练/家长操作 UAT、真实训练数据准确性确认、更多设备尺寸/完整键盘流程、生产备份迁移、CI 与正式部署尚未执行。Profile 清空/未来日期/并发冲突、来源缺失/503 恢复、同日多课/移日/部分未知估算由自动化测试覆盖，不声称每个分支都在浏览器人工点击验证。
