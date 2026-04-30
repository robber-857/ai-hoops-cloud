# 教练端功能与接口开发准备文档

## 1. 文档目的

本文档用于后续开发教练端前端页面。当前后端已经完成教练端第一批接口，前端可以基于这些接口先做一个可用的 MVP。

目标不是一次性做完整教练后台，而是先让教练可以围绕自己负责的班级完成最小运营闭环：

- 查看负责班级
- 查看班级学生
- 查看班级训练报告
- 发布训练任务
- 发布班级公告

## 2. 权限规则

当前后端权限规则：

- `coach` 只能访问自己作为 active coach member 的班级
- `admin` 可以访问全部班级
- 其他角色访问教练端接口会返回 `403`
- 教练访问自己不负责的班级时，后端按不可访问资源处理

前端建议：

- 未登录用户跳转登录页
- 已登录但非 `coach/admin` 用户展示无权限状态
- `coach/admin` 用户显示教练端入口

## 3. 建议前端路由

第一版建议新增：

- `/coach`
  - 教练首页
  - 展示负责班级列表
  - 展示每个班级的学生数量、状态、训练营信息

- `/coach/classes/{classPublicId}`
  - 班级详情页
  - 包含学生列表、近期报告、发布任务、发布公告

后续可扩展：

- `/coach/classes/{classPublicId}/students/{studentPublicId}`
  - 学生训练档案

- `/coach/classes/{classPublicId}/tasks`
  - 班级任务管理

- `/coach/classes/{classPublicId}/announcements`
  - 班级公告管理

## 4. 已完成后端接口

Base path: `/api/v1`

### 4.1 获取教练班级

`GET /coach/classes`

用途：

- 获取当前教练负责的班级
- `admin` 获取全部班级

响应结构：

```ts
type CoachClassRead = {
  public_id: string;
  camp_public_id: string | null;
  name: string;
  code: string;
  description: string | null;
  status: string;
  age_group: string | null;
  max_students: number | null;
  start_date: string | null;
  end_date: string | null;
  student_count: number;
  created_at: string;
};

type CoachClassesResponse = {
  items: CoachClassRead[];
};
```

前端展示建议：

- 班级名称
- 班级 code
- 学生数量
- 年龄组
- 开始/结束日期
- 状态 badge
- 进入班级详情按钮

### 4.2 获取班级学生

`GET /coach/classes/{class_public_id}/students`

用途：

- 获取班级 active student member 列表
- 同时返回每个学生在该班级下的报告数量、最近报告时间、最佳分数

响应结构：

```ts
type CoachStudentRead = {
  public_id: string;
  username: string;
  nickname: string | null;
  email: string | null;
  phone_number: string;
  status: string;
  joined_at: string | null;
  report_count: number;
  last_report_at: string | null;
  best_score: number | null;
};

type CoachStudentsResponse = {
  items: CoachStudentRead[];
};
```

前端展示建议：

- 学生昵称或 username
- 手机号/邮箱
- 报告数量
- 最佳分数
- 最近训练时间
- 后续预留“查看档案”入口

### 4.3 获取班级报告

`GET /coach/classes/{class_public_id}/reports?limit=50`

用途：

- 获取该班级下学生最近训练报告
- 可跳转现有报告详情页

响应结构：

```ts
type CoachClassReportRead = {
  public_id: string;
  session_public_id: string;
  video_public_id: string;
  student_public_id: string;
  student_name: string;
  analysis_type: "shooting" | "dribbling" | "training" | "comprehensive";
  template_code: string;
  template_version: string | null;
  overall_score: number | null;
  grade: string | null;
  status: string;
  video_url: string | null;
  created_at: string;
  analysis_finished_at: string | null;
};

type CoachClassReportsResponse = {
  items: CoachClassReportRead[];
};
```

前端展示建议：

- 学生姓名
- 动作类型
- 模板名称：前端可用本地模板配置把 `template_code` 转为 display name
- 分数/等级
- 创建时间
- `Open report` 跳转 `/pose-2d/report?id={public_id}`

### 4.4 发布训练任务

`POST /coach/classes/{class_public_id}/tasks`

用途：

- 给班级发布训练任务
- 后端会为该班级 active student member 创建任务分配记录

请求结构：

```ts
type CoachCreateTaskRequest = {
  title: string;
  description?: string | null;
  analysis_type?: "shooting" | "dribbling" | "training" | "comprehensive" | null;
  template_code?: string | null;
  target_config?: Record<string, unknown> | null;
  status?: string;
  publish_at?: string | null;
  start_at?: string | null;
  due_at?: string | null;
};
```

建议 `target_config` 第一版：

```ts
type CoachTaskTargetConfig = {
  target_sessions?: number;
  target_score?: number;
};
```

响应结构：

```ts
type CoachTaskRead = {
  public_id: string;
  class_public_id: string;
  title: string;
  description: string | null;
  analysis_type: "shooting" | "dribbling" | "training" | "comprehensive" | null;
  template_code: string | null;
  target_config: Record<string, unknown> | null;
  status: string;
  publish_at: string | null;
  start_at: string | null;
  due_at: string | null;
  assignment_count: number;
  created_at: string;
};
```

前端表单建议字段：

- 标题
- 描述
- 动作类型
- 模板
- 目标训练次数
- 目标分数
- 截止时间
- 发布按钮

成功反馈建议：

- 显示 `assignment_count`，例如 “已分配给 12 名学生”
- 刷新班级任务概览，第一版可以只 toast，不做任务列表

### 4.5 发布班级公告

`POST /coach/classes/{class_public_id}/announcements`

用途：

- 给班级发布公告

请求结构：

```ts
type CoachCreateAnnouncementRequest = {
  title: string;
  content: string;
  status?: string;
  is_pinned?: boolean;
  publish_at?: string | null;
  expire_at?: string | null;
};
```

响应结构：

```ts
type CoachAnnouncementRead = {
  public_id: string;
  class_public_id: string;
  title: string;
  content: string;
  status: string;
  is_pinned: boolean;
  publish_at: string | null;
  expire_at: string | null;
  created_at: string;
};
```

前端表单建议字段：

- 标题
- 正文
- 是否置顶
- 发布时间
- 过期时间

## 5. 建议前端组件拆分

建议新增目录：

- `web/src/services/coach.ts`
- `web/src/app/coach/page.tsx`
- `web/src/app/coach/classes/[classPublicId]/page.tsx`
- `web/src/components/coach/CoachShell.tsx`
- `web/src/components/coach/CoachClassList.tsx`
- `web/src/components/coach/CoachClassSummary.tsx`
- `web/src/components/coach/CoachStudentTable.tsx`
- `web/src/components/coach/CoachReportTable.tsx`
- `web/src/components/coach/CreateTaskPanel.tsx`
- `web/src/components/coach/CreateAnnouncementPanel.tsx`

## 6. 第一版页面信息架构

### `/coach`

页面模块：

1. 顶部账号与角色状态
2. 班级列表
3. 最近需要关注的提示区

班级卡片建议展示：

- 班级名称
- 学生数量
- 年龄组
- 状态
- 训练营/赛季信息
- 进入详情按钮

### `/coach/classes/{classPublicId}`

页面模块：

1. 班级概览
2. 学生列表
3. 最近报告
4. 发布训练任务
5. 发布公告

交互建议：

- 学生列表和报告列表放在同一页面，减少第一版路由复杂度
- 任务发布和公告发布可以先用右侧面板或弹窗
- 报告列表点击后复用现有报告详情页

## 7. 前端状态与错误处理

建议处理状态：

- `loading`：首次加载班级/学生/报告
- `empty`：没有负责班级、没有学生、没有报告
- `forbidden`：当前用户不是 coach/admin
- `notFound`：班级不存在或不可访问
- `submitting`：发布任务/公告中
- `submitSuccess`：发布成功
- `submitError`：发布失败

错误文案建议：

- 非教练角色：`This workspace is available to coaches only.`
- 无班级：`No active classes are assigned yet.`
- 无报告：`No reports have been submitted for this class yet.`
- 发布失败：`Unable to publish. Please try again.`

## 8. 与现有学生端的连接

教练端不需要重做报告详情页。

复用路径：

- 班级报告列表点击 `Open report`
- 跳转 `/pose-2d/report?id={report_public_id}`

注意：

- 后端 `GET /reports/{report_public_id}` 已支持教练按班级归属访问
- 如果教练不是该班级 active coach member，报告详情会拒绝访问

## 9. 后续待补接口

当前第一批接口只支撑 MVP。后续建议补：

- `GET /coach/classes/{class_public_id}/tasks`
- `GET /coach/classes/{class_public_id}/tasks/{task_public_id}`
- `PATCH /coach/classes/{class_public_id}/tasks/{task_public_id}`
- `GET /coach/classes/{class_public_id}/announcements`
- `PATCH /coach/classes/{class_public_id}/announcements/{announcement_public_id}`
- `GET /coach/students/{student_public_id}/profile`
- `GET /coach/students/{student_public_id}/reports`
- `GET /coach/dashboard`

## 10. 第一版验收标准

教练端前端第一版完成后，至少应满足：

- coach/admin 登录后可以进入 `/coach`
- coach 可以看到自己负责的班级
- coach 可以进入班级详情页
- coach 可以查看班级学生列表
- coach 可以查看班级报告列表
- coach 可以从班级报告跳转到现有报告详情页
- coach 可以发布训练任务
- coach 可以发布班级公告
- 非 coach/admin 用户不能正常进入教练端工作台
