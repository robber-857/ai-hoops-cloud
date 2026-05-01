import { apiRequest } from "@/services/client";
import type { ReportAnalysisType } from "@/services/reports";

export type CoachClassRead = {
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

export type CoachClassesResponse = {
  items: CoachClassRead[];
};

export type CoachStudentRead = {
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

export type CoachStudentsResponse = {
  items: CoachStudentRead[];
};

export type CoachClassReportRead = {
  public_id: string;
  session_public_id: string;
  video_public_id: string;
  student_public_id: string;
  student_name: string;
  analysis_type: ReportAnalysisType;
  template_code: string;
  template_version: string | null;
  overall_score: number | null;
  grade: string | null;
  status: string;
  video_url: string | null;
  created_at: string;
  analysis_finished_at: string | null;
};

export type CoachClassReportsResponse = {
  items: CoachClassReportRead[];
};

export type CoachTaskTargetConfig = {
  target_sessions?: number;
  target_score?: number;
};

export type CoachCreateTaskPayload = {
  title: string;
  description?: string | null;
  analysis_type?: ReportAnalysisType | null;
  template_code?: string | null;
  target_config?: CoachTaskTargetConfig | null;
  status?: string;
  publish_at?: string | null;
  start_at?: string | null;
  due_at?: string | null;
};

export type CoachTaskRead = {
  public_id: string;
  class_public_id: string;
  title: string;
  description: string | null;
  analysis_type: ReportAnalysisType | null;
  template_code: string | null;
  target_config: Record<string, unknown> | null;
  status: string;
  publish_at: string | null;
  start_at: string | null;
  due_at: string | null;
  assignment_count: number;
  created_at: string;
};

export type CoachCreateAnnouncementPayload = {
  title: string;
  content: string;
  status?: string;
  is_pinned?: boolean;
  publish_at?: string | null;
  expire_at?: string | null;
};

export type CoachAnnouncementRead = {
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

export const coachService = {
  listClasses() {
    return apiRequest<CoachClassesResponse>("/coach/classes", {
      method: "GET",
    });
  },

  listClassStudents(classPublicId: string) {
    return apiRequest<CoachStudentsResponse>(`/coach/classes/${classPublicId}/students`, {
      method: "GET",
    });
  },

  listClassReports(classPublicId: string, limit = 50) {
    return apiRequest<CoachClassReportsResponse>(
      `/coach/classes/${classPublicId}/reports?limit=${limit}`,
      {
        method: "GET",
      },
    );
  },

  createClassTask(classPublicId: string, payload: CoachCreateTaskPayload) {
    return apiRequest<CoachTaskRead>(`/coach/classes/${classPublicId}/tasks`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  createClassAnnouncement(
    classPublicId: string,
    payload: CoachCreateAnnouncementPayload,
  ) {
    return apiRequest<CoachAnnouncementRead>(
      `/coach/classes/${classPublicId}/announcements`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },
};
