import { apiRequest } from "@/services/client";
import type { AuthUser } from "@/types/auth";
import type { ReportAnalysisType, ReportListItem } from "@/services/reports";
import type { VideoRead } from "@/services/uploads";

export type TrainingSessionRead = {
  public_id: string;
  student_public_id: string;
  class_public_id: string | null;
  task_assignment_public_id: string | null;
  analysis_type: ReportAnalysisType;
  template_code: string | null;
  template_version: string | null;
  source_type: string;
  status: string;
  started_at: string | null;
  uploaded_at: string | null;
  analysis_started_at: string | null;
  completed_at: string | null;
  created_at: string;
  video: VideoRead | null;
};

export type TrendPointRead = {
  date: string;
  average_score: number | null;
  best_score: number | null;
  session_count: number;
};

export type TaskSummaryRead = {
  public_id: string;
  task_public_id: string;
  class_public_id: string;
  title: string;
  status: string;
  progress_percent: number | null;
  completed_sessions: number;
  best_score: number | null;
  due_at: string | null;
};

export type AchievementSummaryRead = {
  public_id: string;
  achievement_public_id: string;
  code: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  unlocked_at: string;
};

export type DashboardStatsRead = {
  total_reports: number;
  total_sessions: number;
  completed_sessions: number;
  weekly_sessions: number;
  best_score: number | null;
  average_score: number | null;
  active_tasks: number;
  unread_notifications: number;
};

export type MeDashboardResponse = {
  user: AuthUser;
  stats: DashboardStatsRead;
  recent_reports: ReportListItem[];
  recent_sessions: TrainingSessionRead[];
  active_tasks: TaskSummaryRead[];
  recent_achievements: AchievementSummaryRead[];
};

export type MeReportsResponse = {
  items: ReportListItem[];
};

export type MeSessionsResponse = {
  items: TrainingSessionRead[];
};

export type MeTasksResponse = {
  items: TaskSummaryRead[];
};

export type MeAchievementsResponse = {
  items: AchievementSummaryRead[];
};

export type MeTrendsResponse = {
  range: string;
  analysis_type: ReportAnalysisType | null;
  points: TrendPointRead[];
};

export const meService = {
  getDashboard() {
    return apiRequest<MeDashboardResponse>("/me/dashboard", {
      method: "GET",
    });
  },

  getReports(limit = 20) {
    return apiRequest<MeReportsResponse>(`/me/reports?limit=${limit}`, {
      method: "GET",
    });
  },

  getTrainingSessions(limit = 20) {
    return apiRequest<MeSessionsResponse>(`/me/training-sessions?limit=${limit}`, {
      method: "GET",
    });
  },

  getTasks(limit = 20) {
    return apiRequest<MeTasksResponse>(`/me/tasks?limit=${limit}`, {
      method: "GET",
    });
  },

  getAchievements(limit = 20) {
    return apiRequest<MeAchievementsResponse>(`/me/achievements?limit=${limit}`, {
      method: "GET",
    });
  },

  getTrends(params: { range?: string; analysisType?: ReportAnalysisType } = {}) {
    const searchParams = new URLSearchParams({
      range: params.range ?? "30d",
    });

    if (params.analysisType) {
      searchParams.set("analysis_type", params.analysisType);
    }

    return apiRequest<MeTrendsResponse>(`/me/trends?${searchParams.toString()}`, {
      method: "GET",
    });
  },
};
