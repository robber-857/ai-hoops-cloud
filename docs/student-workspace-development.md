# 小班协作与学生工作台开发与验收

需求和验收场景见 [PRD](student-workspace-prd.md)。发布环境和先后顺序见 [部署文档](deployment.md)。

## 开发入口

| 功能 | 前端 | 后端 |
| --- | --- | --- |
| 小班 | `/coach/classes/[classPublicId]`、`/join/[token]`、`/me/class-videos` | `class_collaboration.py`、`ClassCollaborationService`、私有对象存储 |
| 报告评语 | `/pose-2d/report?id=…`、`/me/messages` | `ReportService`、`report_feedback`、`notifications` |
| 管理员 | `/admin/users` | `ADMIN_ROLES`、`AdminService`、`operation_logs` |
| AI Coach | `/me/assistant` | `TrainingAssistant`，使用 OpenAI Responses API |
| 学生界面 | `AccountCenterShell`、`/me/plans`、`/me/class-reports`、`/me/trends` | 现有班级报告、训练结果和 Player measurements API |
| 动作目录 | `/pose-2d/training`、`/pose-2d/dribbling`、`/pose-2d/shooting`、`/admin/templates` | 现有目录、版本快照和带预览令牌的同步接口 |

## 数据边界

- 权限由服务端判定。邀请只保存随机令牌的哈希，视频播放前校验班级授权。归档视频或移除成员会阻止签发新播放地址，已签发地址最长十分钟到期。
- 评语和站内通知在同一事务写入。客户端重试复用 `request_id`。通知链接使用报告公开 ID，仍走认证和报告授权。公开分享接口只返回原报告内容。
- 角色提升和撤回写入 `operation_logs`。普通 Admin 无法提升 Admin 或修改其他管理员账号，权限更新以后端读取的账号角色为准。
- AI 请求最多携带九条消息、八条当前任务、六条原始报告摘要。报告上下文包含运动类型、匹配目录中的动作名称、分数、等级和日期。模型返回的推荐必须匹配服务端已构造的任务或动作链接。模型输出按文本显示，模型请求配置 `store: false`，应用不保存会话记录。
- 身体测量图对历史记录按测量日期排序，同日使用最新保存版本。评分曲线仍使用训练数据的原有聚合规则。两类数据使用各自的单位。

## 发布与核对动作模板

2026-11-23 读取公开 Training 目录时，以下五项的现行版本是 `local-v1`，当前前端要求 `v2`。版本或内容哈希不一致时，上传选择器会停止提交。

| 动作 | 模板代码 |
| --- | --- |
| High Knees | `high_knees_in_place_side` |
| Forearm Plank | `pushup_hold_high_plank` |
| Wall Sit | `wall_sit_half_hold` |
| Shallow Wall Sit | `wall_sit_quarter_hold` |
| Bodyweight Squat | `deep_squat_reps_side` |

在目标环境的 **Admin → Templates → Sync local templates** 选 Training，先对上述五个代码 Dry run。预览应为五个新版本且无冲突。使用预览令牌 Apply，将 `v2` 设置为当前版本并保留 `local-v1`。再次预览完整 Training 应为十项跳过。打开学生 Training，验证十项可以选择，切换示范后上传入口仍使用该动作，并抽查一份旧版本报告。

运球的 `dribble_front_narrow_crossover` 也需要单独发布 `v2`。当前浏览器已经使用仓库里的接球位置一致性参数，线上旧 JSON 有三处不同。新版只为这些现有参数补上显式版本号。其他四个运球和两个投篮模板继续用 `local-v1`，通过原始规则计算规范化摘要，兼容旧导入的摘要编码。

三个工作台共用动作选择、示范、拍摄角度和上传入口。新版上传和报告请求传入规范化规则摘要，并与目录版本核对。报告保存规则快照，打开历史报告直接显示保存的分数。管理员可以挂接与当前版本匹配或通用的示范视频，缺少可用视频时显示图解。

## 验收用例

1. 教练从小班发出邀请。新学生注册或现有学生登录后申请，待审核阶段查看不了课程视频。批准后从学生工作台播放，另一个班的学生无法获取播放地址。
2. 班级教练从分析报告提交评语。学生收件箱收到一条通知并能返回报告，重试同一请求不多发通知。测试同班其他学生、无权限教练及公开分享页的访问。
3. 普通 Admin 继续管理小班和学生。系统管理员可在 Users 把现有用户设为 Admin。普通 Admin 的相同 API 调用返回 403。
4. AI 在无密钥环境提示服务不可用。有测试模型时核对只发送当前学生的摘要并能打开任务或测评。发布环境另测实际服务响应。
5. 桌面、平板和手机验证 Overview、Training plans、Class reports 和趋势图。切换主题后刷新验证持久化。检查无数据、单条及同日修订场景。

Windows 上运行测试时可将 `TEMP` 和 `TMP` 指向仓库下可写的独立临时目录。数据库测试使用隔离 PostgreSQL，流程见 [CI 历史记录中的测试库约定](holiday-camp-automated-validation-2026-10-04.md) 和当前 `.github/workflows/training-nutrition.yml`。

## 本地验证记录

- 隔离 PostgreSQL 从空库迁移至 `20261123_0016`。严格后端套件 208 项通过，覆盖小班权限、评语与通知幂等、系统管理员权限及 AI 上下文范围。
- 按锁文件安装的 Next.js 16.3.8 环境通过前端 317 项单元测试、TypeScript 和 Webpack 生产构建。涉及的前端文件通过 ESLint。
- 浏览器通过本地 API 和测试库完成生成邀请、注册和登录、申请、批准、发布和播放视频。邮件使用测试验证码，私有存储使用本地替身服务。
- 浏览器使用合成数据核对桌面 1440px、平板 820px、手机 390px 的学生工作台。训练模板联动、报告评语到通知、AI 多轮对话亦使用模拟响应核对。
- 以公开目录快照在隔离环境定向发布五个体能和一个运球 `v2`，核对体能 10 项、运球 5 项、投篮 2 项全部匹配应用规则。已发布的旧版本可用于历史报告。
