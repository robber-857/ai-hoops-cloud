export type AccountAnalysisType = "shooting" | "dribbling" | "training";

export type ReportSource = "live" | "preview";

export type AccountReport = {
  id: string;
  analysisType: AccountAnalysisType;
  templateCode: string | null;
  templateName: string;
  score: number;
  grade: string;
  createdAt: string;
  linkable: boolean;
};

export type StatOverviewItem = {
  label: string;
  value: string;
  helper: string;
  accent?: boolean;
};

export type TaskReportOption = {
  id: string;
  label: string;
  scoreLabel: string;
  dateLabel: string;
};

export type TaskSubmissionHistoryItem = {
  id: string;
  title: string;
  scoreLabel: string;
  gradeLabel: string;
  dateLabel: string;
};

export type WeeklyTaskDetail = {
  submissionHistory: TaskSubmissionHistoryItem[];
};

export type WeeklyTask = {
  id: string;
  title: string;
  description: string;
  progress: number;
  status: "done" | "in_progress" | "pending";
  valueLabel: string;
  dueLabel: string;
  actionHref: string;
  className: string;
  analysisType: AccountAnalysisType;
  templateCode: string | null;
  templateName: string;
  targetLabel: string;
  completedSessions: number;
  candidateReportId: string | null;
  candidateReportLabel: string | null;
  reportOptions: TaskReportOption[];
  latestReportId: string | null;
};

export type AccountAnnouncement = {
  id: string;
  title: string;
  content: string;
  scopeLabel: string;
  publishedAt: string;
  isPinned: boolean;
  isRead: boolean;
};

export type TrendPoint = {
  analysisType: AccountAnalysisType;
  dateKey: string;
  label: string;
  fullLabel: string;
  score: number;
  metaLabel?: string;
  sessionCount?: number;
};

export type TrendPointsByType = Record<AccountAnalysisType, TrendPoint[]>;
