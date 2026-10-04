# 精简训练与食材营养操作说明

更新：2026-10-03（Australia/Sydney）。适用范围：[现行需求](holiday-camp-training-nutrition-requirements.md)。实现、数据库、自动化与浏览器证据见 [本轮验证](holiday-camp-simplified-local-validation-2026-10-03.md)。当前前端 `http://localhost:3000`、API `http://localhost:8000/api/v1` 由用户运行；R1–R4已实现，未部署，真实用户确认仍按验证记录单独填写。

## 家长代球员使用

1. 用球员账号登录，进入 **Personal profile**（`/me/profile`）。基础资料填写昵称和开始训练日期；体测填写出生日期、性别、身高cm、体重kg和测量日期。已有资料自动带出，按需更新即可。
2. 年龄、BMI、训练年限自动计算；开始训练日期与体测分开保存，改训练日期无需重新录入身高体重。新体测保留历史，不改写过去课后记录。
3. 概览 `/me` 查看Profile、今日训练与食材入口；**Class reports** 的今日汇总 `/me/class-reports/daily` 查看教练已发布的实际项目、个人分钟、反馈及估算消耗，可切换日期和打开单课详情。
4. **Food nutrition**（`/foods`）按肉、蛋、奶、蔬菜分类或输入名称搜索；每条显示状态、每100g可食部分碳水/蛋白质/脂肪。牛奶也按100g，缺失值显示“暂无数据”；原始英文名称、AFCD来源及许可可查看。

家长只读课程，训练分钟由教练记录。食材表用于了解成分，不生成菜谱、个人食用克数或“消耗多少必须补吃多少”的目标。

## 教练记录与发布

1. 从 **Lessons**（`/coach/lessons`）选择授权班级，创建或打开课次，确认课程日期。
2. 记录实际训练项目及分钟，选择适用活动标准和强度，可补充名称/备注。讲解、排队和休息不要记成连续高强度运动；自定义未匹配项目仍可保留事实记录。
3. 确认每位球员的全勤、缺席、早退或部分参与分钟；修改项目/分钟后重新核查个人参与，完成确认并保存。
4. 在 **Publish class records** 查看已保存版本的 **Preview player records**，核对训练事实、身体资料日期、估算或缺失原因，再发布。资料或课次变更使预览过期时，重新加载并核对后发布。
5. 已发布同一版本的重试不会重复创建报告/通知。更正内容后保存、预览、发布新版本；家长今日页采用每课最新发布版本，旧版本保持冻结。

“≈ X kcal”是课程期间总消耗估算；儿童参考优先，类比/通用估算有相应提示。部分项目缺输入或未匹配时显示已知小计及原因；未知不是0。旧报告没有新估算字段时保留“旧记录未估算”状态。

## 新本地环境：迁移与AFCD导入

当前机器的本地 `localhost:5432/ai_hoops` 已在约42MB备份后由0003升至0012，并导入官方AFCD1588条、精选28条。以下供新环境复现或检查；已有库先查看实际版本和来源，不重复执行历史迁移/导入。本轮不操作生产数据库。

在 `server` 目录，确认 `.env` 指向预期本地数据库，并准备开发/数据工具依赖：

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m alembic current
```

迁移前使用当前本地数据库账户备份，备份路径替换为已有目录，密码按提示输入；再执行迁移并检查head：

```powershell
pg_dump --host=localhost --port=5432 --username=YOUR_LOCAL_DB_USER --dbname=ai_hoops --format=custom --file='D:\backups\ai_hoops-before-simplified.dump'
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m alembic current
```

本轮迁移head为 `20261003_0012`；后续版本变化以源码和实际库为准。已有用户的 `training_started_on` 为可空字段，不替他们猜日期。

从 [AFCD官方数据文件页](https://www.foodstandards.gov.au/science-data/food-nutrient-databases/afcd/data-files)准备Release 3的Food Details、Nutrient profiles和Nutrient details三个工作簿，按下列名称放入 `tmp/afcd-release-3`：

```text
food-details.xlsx
nutrient-profiles.xlsx
nutrient-details.xlsx
```

先预览。预览不连接数据库，核对1588条、每100g口径、源文件哈希和指纹：

```powershell
.\.venv\Scripts\python.exe -m app.import_afcd --source-dir ../tmp/afcd-release-3
```

本轮已核对指纹为 `26922a4c7b33d94d1937b9e66c8660a9322bcad72664f2da150856faa271955c`。确认预览相同后，显式填写目标本地连接URL再导入；不要将真实密码写入文档或提交文件：

```powershell
$env:AFCD_IMPORT_DATABASE_URL = 'postgresql+psycopg://YOUR_LOCAL_DB_USER:YOUR_LOCAL_DB_PASSWORD@localhost:5432/ai_hoops'
.\.venv\Scripts\python.exe -m app.import_afcd --source-dir ../tmp/afcd-release-3 --commit --expect-fingerprint 26922a4c7b33d94d1937b9e66c8660a9322bcad72664f2da150856faa271955c
Remove-Item Env:AFCD_IMPORT_DATABASE_URL
```

导入工具只用显式 `AFCD_IMPORT_DATABASE_URL`，不自动读取应用连接；同名同内容再次导入返回unchanged，冲突内容拒绝覆盖。食材页固定该正式指纹，显示28条精选；来源缺失显示数据尚未准备，来源校验失败显示错误，不退回演示数据。

## 用户确认

请按家长Profile保存/刷新、教练记录/预览/发布、家长今日/单课读取、食材搜索/分类四步复核。遇到缺资料、旧记录或部分估算，先查看原因；结果和反馈记到本轮验证文档。自动化、构建、数据库成功与真实用户确认分开记录。
