//export const routes = {
 // HOME: "/",
 // POSE: "/pose",
 // POSE_2D: "/pose-2d",
 //} as const;

export const routes = {
  home: "/",
  auth: {
    login: "/auth/login",
    register: "/auth/register",
  },
  user: {
    me: "/me",
  },
  coach: {
    home: "/coach",
    classes: "/coach/classes",
    reports: "/coach/reports",
    tasks: "/coach/tasks",
    announcements: "/coach/announcements",
    notifications: "/coach/notifications",
    classDetail: (classPublicId: string) => `/coach/classes/${classPublicId}`,
    studentProfile: (studentPublicId: string) => `/coach/students/${studentPublicId}`,
  },
  admin: {
    home: "/admin",
    users: "/admin/users",
    camps: "/admin/camps",
    classes: "/admin/classes",
    classMembers: (classPublicId: string) => `/admin/classes/${classPublicId}/members`,
    templates: "/admin/templates",
    announcements: "/admin/announcements",
    tasks: "/admin/tasks",
    notifications: "/admin/notifications",
  },
  pose: "/pose",
  pose2d: {
    main: "/pose-2d/shooting", // 保留旧路径
    shooting: "/pose-2d/shooting", // 'pose-2d' 页面现在明确为投篮分析页
    dribbling: "/pose-2d/dribbling", // 运球分析页的新路径
    training: '/pose-2d/training', // 训练页的路径
    report: "/pose-2d/report", // 导出报告页的新路径
  },
};
