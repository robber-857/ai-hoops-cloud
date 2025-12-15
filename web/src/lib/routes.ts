//export const routes = {
 // HOME: "/",
 // POSE: "/pose",
 // POSE_2D: "/pose-2d",
 //} as const;

export const routes = {
  home: "/",
  pose: "/pose",
  pose2d: {
    main: "/pose-2d/shooting", // 保留旧路径
    shooting: "/pose-2d/shooting", // 'pose-2d' 页面现在明确为投篮分析页
    dribbling: "/pose-2d/dribbling", // 运球分析页的新路径
    report: "/pose-2d/report", // 导出报告页的新路径
  },
};