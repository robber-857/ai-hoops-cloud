import { apiRequest } from "@/services/client";

export type ReportAnalysisType = "shooting" | "dribbling" | "training" | "comprehensive";

export type ReportListItem = {
  public_id: string;
  session_public_id: string;
  video_public_id: string;
  analysis_type: ReportAnalysisType;
  template_code: string;
  template_version: string | null;
  overall_score: number | null;
  grade: string | null;
  status: string;
  video_url: string | null;
  created_at: string;
  analysis_finished_at: string | null;
  is_age_comparison?: boolean;
};

export type SaveReportPayload = {
  session_public_id: string;
  template_code: string;
  template_version?: string | null;
  overall_score?: number | null;
  grade?: string | null;
  score_data: Record<string, unknown>;
  timeline_data?: unknown[] | null;
  summary_data?: Record<string, unknown> | null;
  analysis_started_at?: string | null;
  analysis_finished_at?: string | null;
};

export type ReportRead = ReportListItem & {
  score_data: Record<string, unknown>;
  timeline_data: unknown[] | null;
  summary_data: Record<string, unknown> | null;
  template_snapshot: Record<string, unknown> | null;
  can_reanalyze_age?: boolean;
};

export type MyReportsResponse = {
  items: ReportListItem[];
};

export const reportService = {
  reanalyzeAge(reportPublicId: string, payload: {
    request_id: string;
    age_group: string;
    overall_score: number;
    grade: string;
    score_data: Record<string, unknown>;
  }) {
    return apiRequest<ReportRead>(`/reports/${reportPublicId}/reanalyze-age`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  saveReport(payload: SaveReportPayload) {
    return apiRequest<ReportRead>("/reports", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getReport(reportPublicId: string) {
    return apiRequest<ReportRead>(`/reports/${reportPublicId}`, {
      method: "GET",
    });
  },

  getSharedReport(reportPublicId: string) {
    return apiRequest<ReportRead>(`/reports/shared/${reportPublicId}`, {
      method: "GET",
    });
  },

  listMine(limit = 20) {
    return apiRequest<MyReportsResponse>(`/reports/mine?limit=${limit}`, {
      method: "GET",
    });
  },
};
