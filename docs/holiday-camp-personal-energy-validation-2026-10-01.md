# P6 个人能量候选预览

2026-10-01。本批接通本人资料计算和教练课次预览；仍不是正式营养建议发布。

## 规则与范围

- 采用 [Health Canada 的 DRI 能量公式](https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/equations-estimate-energy-requirement.html)，2026-10-01 核对；[2023 DRI 原始报告](https://www.nationalacademies.org/read/26818/chapter/7)明确儿童青少年范围至 18.99 岁。
- 候选版本：`dri-2023-personal-energy-review-2026-10-01-v1`。这与 Admin 页的澳新参考表是不同方法，未声称已获机构批准。
- 本产品范围为满 4 岁至未满 19 岁，输入本人年龄、性别、身高 cm、体重 kg；分别采用四个全天活动类别对应系数，生长项只加一次。没有减脂缺口或额外叠加课程消耗。
- 年龄按上课日期计算：完整周岁加当年生日间隔中的日期比例；闰日出生在非闰年按 2 月 28 日计算周年。年龄分支在 4/9/14/19 岁生日切换，显示四位小数，运算不提前舍入；结果按 10 kcal 舍入。
- 活动类别需明确选择，当前是整班比较情景，不表示每个人已经确认属于同一类别。不能把“经常运动”自动解释成全员相同参数。
- 缺身体资料、缺性别、超出年龄范围、非法测量值均不出数字。显示测量日期及距上课天数，不虚构资料有效期。缺席不出本课能量预览；未确认课次显示阻塞项。

## 数据、权限与界面

`POST /api/v1/coach/classes/{class_id}/lessons/{lesson_id}/energy-preview`，请求要求保存版本和活动类别。仅授权班级教练可访问；版本不一致返回 409。未发布版本取上课日期之前的最新身体资料；已发布版本读取其冻结快照，不用后来补录资料改写历史依据。

教练 Actual lessons 打开课次后使用 **Personal energy review**。预览不写报告、不发通知、不修改资料；未保存编辑时禁用，换课次/保存版本/活动类别后需重新预览。返回结果含公式、输入和版本，便于审核。

这仍是全日候选 EER，不是单课消耗、实时测量或晚餐需要补吃的量。尚未生成三餐宏量营养克数。

## 本地演示与验证

- `Energy review class (local demo)` → `Energy review practice (local demo)`（2026-10-01）。教练沿用 `p3_coach`。
- Alex (energy demo)：12 岁、150 cm、40 kg，Active 情景约 2400 kcal/day，Low active 约 2190 kcal/day。仅为合成计算案例，不是正式建议。
- Sam (energy demo)：无资料；Jamie (local demo)：缺席。独立新增演示班级/课次，保留之前的演示及发布历史。
- 新增后端 6 项（固定例子覆盖男女全部 8 个公式、年龄/生长边界、缺资料、冻结快照、无写入、权限及版本）；连同原参考工具共 11 项通过。
- 前端新增 2 项、类型检查、定向 ESLint、本地构建通过。
- 真实浏览器连接本地 API：Active/Low active 数值、缺资料、缺席、不设默认、切换清除旧结果、刷新、断网重试通过；360/390/768/1280/1440 无横向溢出。初次脚本重复选择同一班级以及标签/嵌套区块定位不准确，修正脚本后全流程重跑通过。
- 证据：`output/playwright/personal-energy-verified.txt`、`personal-energy-mobile.png`、`personal-energy-desktop.png`。自动化验证不等于真实教练 UAT。

## 剩余

机构规则审核及正式启用、个别学员活动类别确认、单课运动消耗映射、三大营养素和三餐规则、每日营养版本发布仍待完成。仅本地数据库和 3000/8000 预览，无新增迁移、提交、推送或生产操作。
