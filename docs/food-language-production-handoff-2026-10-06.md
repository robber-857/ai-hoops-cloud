# 2026-10-06 食材语言与日期格式生产发布

## 发布范围

- Food nutrition 默认英语。Profile → Language 可保存 English / 中文（简体），用于食材页名称、状态、搜索、分类和提示。
- 食材页脚仅保留 AFCD 来源和官方数据文件链接；原始营养数值、每 100g 可食部分口径及生熟区分保持不变。
- Profile 训练开始日、出生日期、体测日期及日期显示统一为 `yyyy/mm/dd`；数据库/API 继续使用 ISO 日期。
- 实现说明：[food-language-profile-dates-2026-10-06.md](food-language-profile-dates-2026-10-06.md)。

## 精确版本与验证

- 发布提交：`56b7e9c043e3c7cfdba2ae506170b6c0fbbd2c53`，已从原生产 `12dd8c6636a315d3432d6c0c2ca873923770d4df` 快进推送 `main`。
- 同一功能已推送 `developbranch`，提交 `0fe9788f`。
- [精确发布提交 CI](https://github.com/robber-857/ai-hoops-cloud/actions/runs/37453627674)：两 job 成功；完整后端 198、前端 296、浏览器 6 项测试通过，应用/E2E 类型检查、定向 lint 和 42 页生产构建通过。
- [main CI](https://github.com/robber-857/ai-hoops-cloud/actions/runs/37454855905)：同一精确 SHA 的两个 job 全部成功，包含浏览器业务回归。
- 原开发目录 45 个既有未提交文件的大小与 SHA-256 全部保留；没有并入本次发布。生产原有 Academy 首页与资产保持不变。

## 数据库与后端

- Render 数据库 `dpg-d7redsn7f7vs73ctu88g-a` / `ai_hoops`，发布前 revision 为 `20261003_0012`。
- 发布前只读确认 provider PITR 为 AVAILABLE，保留 1 份 2026-10-05 15:53 Sydney 内部逻辑备份；未下载生产数据库或备份。API 未提供最新 PITR 时间。
- 增量迁移已完成至 `20261006_0013`，仅增加非空、默认 `en` 的 `users.preferred_language`，CHECK 限定 `en` / `zh-CN`。
- 前后业务数量一致：users 4、analysis_reports 24、training_sessions 36、videos 36、food_entries 1588、player_profile_revisions 0、class_reports 0。无非法语言值，约束已验证。
- Render 部署 `dep-db2ddomk1f9s73a2bhg0` 已 live，精确发布 SHA，完成于 2026-10-06 22:10:20 Sydney。
- 公共 `/health` 返回 200 / ok；`/openapi.json` 包含 Profile 双语言定义。这些检查分别证明存活和部署接口结构，不能代替认证保存验收。

## 前端与线上验收

- Vercel Production deployment `6882420490` 成功，精确发布 SHA，完成状态时间 2026-10-06 22:13:05 Sydney；[部署地址](https://ai-hoops-cloud-r2cfhncl4-eltons-projects-1c805292.vercel.app)。
- [主域名](https://apexsportai.com/me/profile) 已在认证浏览器中加载新版 Profile：账号初始 Language 为 English，训练开始日和出生日期占位符均为 `yyyy/mm/dd`，体测日期显示 `2026/10/06`，Joined 日期使用同一格式。
- 主域名新版 Food nutrition 已实际加载：中文名称、状态与营养标签正常，28 条食材数量和营养数值保持，页脚仅有 `来源：AFCD` 与官方数据文件链接，长篇说明已删除。
- 语言选择与按钮操作后，浏览器未确认提交成功提示；后续新加载的食材页显示中文。用户随后明确选择“先跳过这项线上核验”，因此本次不认定完整的生产保存 → 刷新 → 重新登录流程已验收。没有提取会话凭据或写入真实体测数据。
- 页面截图保存在本机可视化目录，未把认证页面截图或会话数据提交到仓库。

## 验收边界与回滚

本次独立虚构账号浏览器回归覆盖日期输入、ISO 保存、刷新与重新登录、语言账号隔离和失败重试。真实儿童训练、真实教练发布/家长读取及生产视频上传 → 分析 → 保存 → 重新打开没有新增验收证据；此前用户选择跳过自动上传验收仍然有效。

本次使用的独立 8123 测试 API 和 45441 Postgres 测试容器已停止；保留测试数据。用户 3000/8000 及其他项目服务未被停止。

如需回滚应用，可发布原已验证提交 `12dd8c6636a315d3432d6c0c2ca873923770d4df`，保留 0013 增量数据库结构。不要自动降级数据库或删除受保护历史。
