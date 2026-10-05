# 个人活动情景与项目汇报：本轮验证

日期：2026-10-01。仅本地 3000/8000，未提交、推送或部署，未操作生产。

## 本轮功能

- 教练可在班级比较情景之外，对参与学员分别选择全天活动情景；没有个人选择则使用班级情景。
- 预览、三餐热量、草稿保存/重试、刷新恢复和历史复用完整传递个人选择。
- 按内部身份匹配而非姓名或数组顺序，支持已发布课次的冻结资料；工作人员界面仍显示姓名。
- 后端拒绝非本课参与者或缺席者的个人选择。旧草稿仍可查看和复用，不回写历史；空个人选择保持旧保存请求的重试哈希兼容。
- 候选计算公式仍为 v2，无公式、评分、默认比例修改；个人选择仍是审核输入，不代表已确认活动评估。
- 新增 [老板汇报说明](holiday-camp-boss-brief-2026-10-01.md)，包含一分钟讲稿、已完成能力、最近改动、剩余事项和演示顺序。

## 验证

- 全量后端 **124 项通过**；新增个人选择/冻结资料、未知及缺席身份拒绝、草稿历史保留测试。
- 全量前端 **182 项通过**；新增个人选择标识和旧快照兼容检查。TypeScript、定向 ESLint 和 Next 构建通过。
- 真实浏览器：Alex 个人选择覆盖班级情景、改班级情景后个人选择保留、保存 r3、刷新恢复、旧 r1 数值保留、恢复 r1 时清空个人选择。
- 360 / 390 / 768 / 1280 / 1440 宽度均无横向溢出；截图 `output/playwright/individual-energy-mobile.png` 已检查。
- 后端日志 `tmp/p6-individual-tests.log`；浏览器复现脚本 `tmp/individual-energy-browser.js`（依赖演示库初始 r1/r2，不要在已有 r3 时原样重跑）。

首次全量后端运行遇到测试库已有 class_members 种子编号与序列冲突；仅把该本地表序列推进至现有最大编号，未修改记录，随后全量重跑通过。没有新增迁移。浏览器控制台的登录前 auth/me 401 为未登录会话检查；另有既有 CSS preload 提示。

## 改动入口

后端：`schemas/personal_energy.py`、`services/personal_energy_service.py`、`services/class_report_service.py`、`services/energy_draft_service.py`。

前端：`services/personalEnergy.ts`、`components/class-reports/LessonEnergyPreview.tsx`、`PersonalEnergyDetails.tsx`、`EnergyDraftHistory.tsx`。

测试：`server/tests/test_personal_energy.py`、`server/tests/test_energy_drafts.py`、`web/src/lib/__tests__/personalEnergy.test.ts`。

## 尚未完成

单课运动消耗、三餐宏量营养素克数、营养规则批准、正式每日营养发布、真实教练 UAT 与上线；语音/文字辅助仍待确定优先级。本轮提供个人选择入口，没有自动判断真实活动等级。全部饮食建议完成度不能用本轮测试通过率代替。
