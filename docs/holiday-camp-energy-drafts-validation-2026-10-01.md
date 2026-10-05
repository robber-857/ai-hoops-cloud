# 能量审核草稿：本地验证（2026-10-01）

## 本轮完成

教练 Actual lessons 中的 Personal energy review 可保存审核草稿、恢复最近输入、查看历史并复用旧输入。保存内容包含活动情景、可选三餐比例、本人资料、计算结果、来源和候选版本。状态固定为 pending_review，不产生学员通知或正式营养发布。

新增 energy_review_drafts 表及迁移 20261001_0011。数据库触发器禁止更新和删除历史；有草稿数据时迁移拒绝回退，避免丢失数据。同一请求重试只保存一次；课次锁、期望修订和预览摘要分别处理并发、旧版本和预览后资料变化。

代码入口：`server/app/services/energy_draft_service.py`、`server/app/models/energy_draft.py`、`server/tests/test_energy_drafts.py`、`web/src/components/class-reports/EnergyDraftHistory.tsx`。API 为课次下的 GET/POST `energy-drafts`，沿用班级授权边界。

## 验证证据

- 全量后端 **121 项通过**，包含新增的保存/重试、并发去重、旧预览、旧修订、权限、快照不可变测试。日志：`tmp/p6-draft-tests.log`。
- 全量前端 **181 项通过**；TypeScript、定向 ESLint、Next 构建通过。
- 真实本地浏览器完成断网保存后重试、刷新恢复、r1/r2 保存、r1 历史不变、历史输入恢复；学员读取草稿接口返回 403。
- 360 / 390 / 768 / 1280 / 1440 宽度无横向溢出，手机截图已检查。证据：`output/playwright/energy-drafts-verified.txt`、`output/playwright/energy-draft-history-mobile.png`。
- 独立空的本地数据库 `ai_hoops_p6_draft_migration_check` 完成升级到 0011、回退到 0010、再升级到 0011。已有测试库和演示库未回退或删除。

## 本地预览与边界

前端 http://127.0.0.1:3000，后端 http://127.0.0.1:8000。演示班 Energy review class (local demo) 已有 r1/r2 草稿供检查。使用说明见 [中文字段和操作说明](holiday-camp-user-guide.md)。

本轮只操作本地数据库，保留已有改动和评分规则；未提交、推送、部署或操作生产。自动测试和本地浏览器检查不代表真实教练 UAT 已完成。

## 距离完整训练饮食系统的剩余工作

训练事实记录、课后发布/历史、每日事实汇总、菜谱维护、候选个人热量/三餐试算、审核草稿已实现。仍需完成单课运动消耗规则及计算、个体活动判断、宏量营养素克数与正式三餐规则、规则审核批准及每日营养发布历史，并开展真实教练验收。P7 语音/文字助理仍待开发。草稿保存不表示 P6 整体完成。
