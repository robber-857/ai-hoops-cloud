export type AccountAnalysisType = "shooting" | "dribbling" | "training";

export type ReportSource = "live" | "preview";

export type AccountReport = {
  id: string;
  analysisType: AccountAnalysisType;
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

export type WeeklyTask = {
  title: string;
  description: string;
  progress: number;
  status: "done" | "in_progress" | "pending";
  valueLabel: string;
  dueLabel: string;
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
  label: string;
  fullLabel: string;
  score: number;
};

export type GrowthSummary = {
  label: string;
  value: string;
  helper: string;
};
