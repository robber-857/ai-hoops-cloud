# AI Hoops Cloud 认证与安全改造实施清单

## 1. 目标

本文档聚焦“前后端分别要改哪些文件、哪些接口、按什么顺序改”的实施层方案。

目标是把当前项目从“前端登录态 + 页面守卫”升级为“服务端可信 session + 受保护接口 + 受保护上传链路”。

## 2. 改造顺序总览

推荐顺序：

1. 后端先完成 session 能力
2. 后端完成 `/auth/me` 和统一鉴权依赖
3. 前端改为以服务端 session 为准
4. 中间件与页面守卫切换到服务端可信 cookie
5. 上传、报告、分析接口统一接入鉴权
6. 最后补风控与安全增强

这样可以避免前端先改完，但后端还没有真实认证依据，导致中间状态混乱。

## 3. 后端改造清单

## 3.1 优先改动文件

建议优先关注以下文件：

- `server/app/api/v1/auth.py`
- `server/app/services/auth_service.py`
- `server/app/api/deps.py`
- `server/app/core/security.py`
- `server/app/core/config.py`
- `server/app/models/user_session.py`
- `server/app/models/user.py`
- `server/app/schemas/auth.py`
- `server/app/main.py`
- `server/tests/` 下认证相关测试

如果需要数据库结构调整，还要补：

- `server/alembic/` 下新的 migration

## 3.2 后端要补或重构的接口

### 第一组：会话核心接口

- `POST /auth/login/password-code`
- `POST /auth/login/phone`
- `POST /auth/login/email`
- `POST /auth/logout`
- `GET /auth/me`

改造目标：

- 登录成功时不只返回 token 数据，还要由后端设置 session cookie
- `/auth/logout` 不只是空返回，要真正撤销 session
- `/auth/me` 必须根据当前 cookie 返回真实当前用户

### 第二组：会话管理接口

建议新增：

- `POST /auth/session/refresh`
  - 如果保留 refresh 机制
- `GET /auth/sessions`
  - 查看当前账号设备 / 会话列表
- `DELETE /auth/sessions/{session_id}`
  - 撤销某个会话

这组不是第一优先级，但适合正式环境。

### 第三组：验证码接口

- `POST /auth/register/send-code`
- `POST /auth/login/phone/send-code`
- `POST /auth/login/email/send-code`
- `POST /auth/password/send-reset-code`

改造目标：

- 增加限流
- 增加频率控制
- 删除测试码逻辑
- 不向前端暴露开发快捷值

## 3.3 后端服务层改造点

### `server/app/services/auth_service.py`

建议做的事情：

- 登录成功时创建 `user_sessions` 记录
- 生成高熵 session id
- session id 做哈希后存库
- 数据库存储：
  - `user_id`
  - `status`
  - `expire_at`
  - `last_active_at`
  - `ip_address`
  - `user_agent`
  - 设备信息
- 提供：
  - 创建 session
  - 校验 session
  - 刷新 session 活跃时间
  - 撤销 session
  - 清理过期 session

### `server/app/api/deps.py`

建议新增依赖：

- `get_current_session`
- `get_current_user`
- `require_authenticated_user`

职责：

- 从 `HttpOnly` cookie 取 session id
- 查库验证 session 是否有效
- 返回当前登录用户
- 无效则抛 `401`

### `server/app/core/security.py`

建议用途调整：

- 密码哈希与校验继续保留
- 如果 session 为主，可弱化前端直持 JWT 的职责
- 如果保留 refresh token，则在这里统一处理 token 生成与验证规则

## 3.4 后端模型与数据库

### `server/app/models/user_session.py`

当前项目已经有 `user_session` 模型，这是非常好的基础。

建议核查并补齐：

- session 唯一标识字段
- session 哈希字段
- 过期时间
- 撤销时间
- 最后活跃时间
- 设备指纹信息
- 索引

### 可能新增或调整的数据库字段

如当前表还不够用，建议通过 migration 补：

- `session_token_hash`
- `csrf_secret` 或等效字段
- `rotated_from_session_id`
- `revoked_reason`

## 3.5 后端实施顺序

### 阶段 A

- 完善 `AuthService` 的 session 创建与撤销
- 完成 `/auth/me`
- 完成 `get_current_user` 依赖

### 阶段 B

- 登录接口改为写 `HttpOnly` cookie
- logout 接口改为删 cookie + 撤销 session
- middleware / 前端开始消费真实 session

### 阶段 C

- 上传、报告、分析接口接入 `require_authenticated_user`
- 统一返回 `401`

### 阶段 D

- 限流
- 审计日志
- 多设备管理
- 会话撤销

## 4. 前端改造清单

## 4.1 优先改动文件

建议优先关注以下文件：

- `web/src/store/authStore.ts`
- `web/src/components/auth/LoginClient.tsx`
- `web/src/components/auth/RegisterClient.tsx`
- `web/src/services/auth.ts`
- `web/src/services/client.ts`
- `web/src/lib/routes.ts`
- `web/middleware.ts`
- `web/src/app/auth/login/page.tsx`
- `web/src/app/pose-2d/*`
- `web/src/components/Pose2D/UploadDropZone.tsx`

## 4.2 前端要改的核心行为

### `web/src/store/authStore.ts`

目标：

- 不再把前端 store 当成最终安全依据
- store 只保留：
  - 当前用户展示信息
  - 是否已通过 `/auth/me` 校验
  - 加载状态

建议：

- 不再依赖前端可伪造 cookie 做最终判断
- 最终登录态应由 `/auth/me` 返回结果驱动

### `web/src/components/auth/LoginClient.tsx`

目标：

- 登录后不需要前端自行写认证 cookie
- 登录成功后：
  - 调用后端登录接口
  - 由后端设置 `HttpOnly` cookie
  - 前端再调用 `/auth/me` 或直接进入受保护页

建议：

- 保留 `next` 跳转参数逻辑
- 不再把前端自写 cookie 当成正式方案

### `web/src/services/client.ts`

目标：

- 让所有需要鉴权的请求自动携带 cookie

建议：

- `fetch` 增加 `credentials: "include"`
- 统一处理 `401`

### `web/middleware.ts`

目标：

- 只认服务端可信认证 cookie
- 不认前端伪造标记作为最终安全边界

注意：

- middleware 只能做“入口访问控制”
- 真正安全边界仍然是后端接口鉴权

### `web/src/components/Pose2D/UploadDropZone.tsx`

目标：

- 上传功能只在用户已登录时可用
- 但真正允许上传不能只由前端决定

建议：

- 上传前先通过服务端鉴权
- 如果改成“后端签发上传授权 / 上传 URL”，前端只消费签名结果

## 4.3 前端接口侧需要联动的点

### 认证相关

- 登录完成后请求 `GET /auth/me`
- 应用初始化时请求 `GET /auth/me`
- 退出时调用 `POST /auth/logout`

### 受保护资源

以下前端功能都要按“未登录 -> 跳登录页”处理：

- Shooting 页面
- Dribbling 页面
- Training 页面
- Report 页面
- 上传入口
- 报告导出

## 4.4 前端实施顺序

### 阶段 A

- 后端先提供真实 session 能力
- 前端先不做大改，只接 `/auth/me`

### 阶段 B

- 改 `authStore.ts`
- 改登录成功逻辑
- 改应用初始化拉取当前用户逻辑

### 阶段 C

- 改 middleware
- 改受保护页访问逻辑
- 改上传和报告请求逻辑

### 阶段 D

- 做退出登录
- 做 401 全局处理
- 做无权限提示体验优化

## 5. 上传与分析链路的安全要求

这是当前项目最重要的业务风险点之一。

### 必须保护的能力

- 上传视频
- 获取上传签名或上传地址
- 保存分析报告
- 查看分析报告
- 导出报告

### 推荐方式

- 前端不能直接拥有永久上传权限
- 上传前先请求后端鉴权
- 后端确认当前用户已登录后，再返回一次性上传授权
- 报告写入必须绑定当前用户

## 6. 验证码与登录注册的生产整改

正式环境建议重点检查：

- 删除开发测试验证码
- 删除前端自动填充验证码
- 登录失败限流
- 注册限流
- 验证码发送频率限制
- 验证码错误次数限制
- 找回密码流程加审计日志

## 7. 测试与验收顺序

## 7.1 后端测试

- 未登录访问 `/auth/me` 返回 `401`
- 登录后返回 `Set-Cookie`
- cookie 过期后访问受保护接口返回 `401`
- logout 后 cookie 失效
- 撤销 session 后原设备失效

## 7.2 前端测试

- 未登录直接输入 `/pose-2d/shooting` 会跳登录页
- 登录后回跳原目标页
- 刷新页面后仍能识别登录态
- logout 后再访问受保护页会被拦截
- 未登录无法发起上传成功流程

## 7.3 安全测试

- 伪造前端状态不能进入受保护资源
- 伪造普通 cookie 不能通过后端鉴权
- 没有有效 session 时上传接口返回 `401`
- 验证码接口频繁调用会被限流

## 8. 推荐里程碑

### Milestone 1

- 后端 session 登录闭环
- `/auth/me`
- logout
- middleware 生效

### Milestone 2

- 上传与报告接口全部鉴权
- 401 流程打通

### Milestone 3

- 验证码风控
- 会话撤销
- 审计日志

### Milestone 4

- 多设备管理
- 安全监控
- 上线前渗透测试与安全复查

## 9. 最终建议

对当前仓库来说，最合理的落地顺序是：

1. 先把后端 session 做成真正可信来源
2. 再让前端只消费服务端认证结果
3. 再把上传和报告链路纳入接口级鉴权
4. 最后做限流、CSRF、XSS、审计、会话管理增强

如果这一顺序执行正确，你的网站才会从“功能能用”进入“生产可防护”的状态。
