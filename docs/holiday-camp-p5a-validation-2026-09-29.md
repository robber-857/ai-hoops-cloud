# P5a：AFCD 食品数据导入

本批完成食品来源与食品条目的数据库结构、离线预览和事务导入。尚未实现食品搜索 API、菜谱编辑/发布/浏览页面，也没有上线迁移或真实用户验收。注册登录、旧评分和报告逻辑不变。

## 来源和数据规则

2026-09-29 重新核对 [FSANZ 数据入口](https://www.foodstandards.gov.au/science-data/food-nutrient-databases/afcd/data-files) 的 Release 3 下载链接。本地三个工作簿来自该官方来源；原始文件、导入结果及食品数据均不提交 Git。

- 只读取 `All solids & liquids per 100 g`，不混入每 100mL 工作表。
- 268 个字段保留原字段含义和单位。`%T` 与 `mg/gN` 单独标记为比例/每克氮口径，不能当作每 100g 食品的绝对营养量参与菜谱求和。
- 明确保留含纤维能量、无糖醇可利用碳水、蛋白质、脂肪、纤维、糖和钠的映射；没有按 4/4/9 重算能量。
- 数值以十进制字符串保存；缺失为 null，不填零。非数值、公式、负数、非有限值、重复食品 ID、名称不一致、缺少必需字段或未知单位阻止导入。
- 保留食品原名、描述、可食部分、数据来源以及营养定义工作表内容和单元格位置。生熟状态不从名字猜测成结构字段；后续选食材必须展示原名和描述供确认。
- 工作簿未提供官方营养素代码，`official_code` 保留 null；应用字段映射不得冒称官方代码。
- 源文件 SHA256、内容 fingerprint、版本、来源地址及署名随来源记录保存。不是自动校验 FSANZ 数字签名；运维仍须从官方链接取得文件并审核预览。

## 使用

从 `server` 目录运行（使用可工作的 Python 环境）：

```powershell
python -m pip install -r requirements.txt -r requirements-data.txt
python -m app.import_afcd --source-dir ../tmp/afcd-release-3
```

目录必须包含 `food-details.xlsx`、`nutrient-profiles.xlsx`、`nutrient-details.xlsx`。默认只预览，不读取应用数据库配置，也不连接数据库。

迁移为 `20260929_0007`。先按目标环境流程执行 `alembic upgrade head`；审核预览后，显式设置 `AFCD_IMPORT_DATABASE_URL` 为目标连接串，再运行：

```powershell
python -m app.import_afcd --source-dir ../tmp/afcd-release-3 --commit --expect-fingerprint <预览中的完整fingerprint>
```

导入器不会回退读取应用的 `DATABASE_URL`。相同来源重复执行返回 `unchanged` 并校验已存内容；同版本不同内容拒绝覆盖。并发导入串行化，失败整笔回滚。后续新版适配应新增来源版本，不更新已被菜谱引用的旧条目。当前解析器仅支持 Release 3。

## 本地验证

- 全部后端测试：83 passed，包括解析、单位/缺失值、CLI 预览无数据库连接、校验值不匹配拒绝、并发重复导入、内容篡改检测、版本不可覆盖及事务失败回滚。
- 专用 PostgreSQL：`127.0.0.1:55439/ai_hoops_p2_test`。升级 → 回退到 `20260927_0006` → 再升级通过。回退会删除本批食品表，只在本地合成数据上演练；未来已有菜谱引用时不能直接使用此回退方式。
- 完整工作簿成功落库：1,588 foods / 268 nutrient fields；243,444 个缺失值和 77,355 个零值保持区分。再次执行返回同一 release 的 `unchanged`，1,588 行完整内容重新校验通过。
- 内容 fingerprint：`26922a4c7b33d94d1937b9e66c8660a9322bcad72664f2da150856faa271955c`。
- 食品详情 SHA256：`69aa096c45cb0699db60a9c544442312e9ff09af587b99c42dc78bc26f689629`。
- 营养组成 SHA256：`14cb3e73dbf58987b440e6299624c0fefd7a4e61591fc1f753995d9534e0efc9`。
- 营养定义 SHA256：`7c455129a90e65d29840ecd188fa223cca8bdf0729b21efebc286884d69fafaa`。
- 官方工作簿间有 4 条分类/来源标记差异：F001972、F002513、F003018、F009464。预览列出两边原值，数据库分别保留，不静默统一；食品 ID 与名称一致。
- 本批没有前端变动，不重复声称浏览器/UI 或线上部署已验收。

## 来源使用说明与后续

记录 [AFCD 数据使用许可](https://www.foodstandards.gov.au/science-data/monitoringnutrients/afcd/datauserlicenceagreement) 作为数据许可入口。该页面指定基于 CC BY-SA 3.0 AU 并有附加条款，不能用网站一般许可替代。公开食品/菜谱数据前，落实要求的署名、许可链接、数据局限及澳洲数据适用范围说明；本批只提交程序和合成测试，不分发源工作簿或转换后的数据。

下一批 P5b：认证内食品检索、菜谱草稿/发布版本、固定来源食材引用、每份换算及缺失营养提示；随后接独立菜谱页。个体全天/三餐建议仍属于 P6，须完成规则来源审核。
