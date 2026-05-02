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
  completed_assignment_count: number;
  assignment_status_counts: Record<string, number>;
  created_at: string;
};

export type CoachTaskAssignmentRead = {
  public_id: string;
  student_public_id: string;
  student_name: string;
  status: string;
  progress_percent: number | null;
  completed_sessions: number;
  best_score: number | null;
  latest_report_public_id: string | null;
  completed_at: string | null;
  last_submission_at: string | null;
  created_at: string;
};

export type CoachTaskDetailRead = CoachTaskRead & {
  assignments: CoachTaskAssignmentRead[];
};

export type CoachTasksResponse = {
  items: CoachTaskRead[];
};

export type CoachUpdateTaskPayload = Partial<{
  title: string;
  description: string | null;
  analysis_type: ReportAnalysisType | null;
  template_code: string | null;
  target_config: Record<string, unknown> | null;
  status: string;
  publish_at: string | null;
  start_at: string | null;
  due_at: string | null;
}>;

export type CoachTaskFilters = Partial<{
  status: string;
  analysis_type: ReportAnalysisType;
  keyword: string;
  from_date: string;
  to_date: string;
  limit: number;
}>;

export type CoachBulkUpdateTasksPayload = {
  task_public_ids: string[];
  status: string;
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

export type CoachAnnouncementsResponse = {
  items: CoachAnnouncementRead[];
};

export type CoachUpdateAnnouncementPayload = Partial<{
  title: string;
  content: string;
  status: string;
  is_pinned: boolean;
  publish_at: string | null;
  expire_at: string | null;
}>;

export type CoachAnnouncementFilters = Partial<{
  status: string;
  is_pinned: boolean;
  keyword: string;
  from_date: string;
  to_date: string;
  limit: number;
}>;

export type CoachBulkUpdateAnnouncementsPayload = {
  announcement_public_ids: string[];
  status?: string;
  is_pinned?: boolean;
};

export type CoachDashboardClassSnapshot = {
  public_id: string;
  name: string;
  code: string;
  student_count: number;
  open_task_count: number;
  recent_report_count: number;
  latest_report_at: string | null;
};

export type CoachDashboardResponse = {
  class_count: number;
  active_class_count: number;
  student_count: number;
  report_count: number;
  recent_report_count: number;
  task_count: number;
  open_task_count: number;
  announcement_count: number;
  class_snapshots: CoachDashboardClassSnapshot[];
};

export type CoachStudentClassMembershipRead = {
  class_public_id: string;
  class_name: string;
  class_code: string;
  member_public_id: string;
  member_role: string;
  status: string;
  joined_at: string | null;
};

export type CoachStudentTaskSummary = {
  assigned_count: number;
  completed_count: number;
  in_progress_count: number;
  pending_count: number;
  latest_submission_at: string | null;
};

export type CoachStudentProfileRead = {
  public_id: string;
  username: string;
  nickname: string | null;
  email: string | null;
  phone_number: string;
  status: string;
  role: string;
  report_count: number;
  best_score: number | null;
  last_report_at: string | null;
  memberships: CoachStudentClassMembershipRead[];
  task_summary: CoachStudentTaskSummary;
};

export type CoachStudentReportsResponse = {
  items: CoachClassReportRead[];
};

function buildQuery(params: Record<string, string | number | boolean | null | undefined>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    searchParams.set(key, String(value));
  });
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export const coachService = {
  getDashboard() {
    return apiRequest<CoachDashboardResponse>("/coach/dashboard", {
      method: "GET",
    });
  },

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

  listClassTasks(classPublicId: string, filters: CoachTaskFilters = {}) {
    const query = buildQuery({ limit: 50, ...filters });
    return apiRequest<CoachTasksResponse>(`/coach/classes/${classPublicId}/tasks${query}`, {
      method: "GET",
    });
  },

  getClassTask(classPublicId: string, taskPublicId: string) {
    return apiRequest<CoachTaskDetailRead>(
      `/coach/classes/${classPublicId}/tasks/${taskPublicId}`,
      {
        method: "GET",
      },
    );
  },

  updateClassTask(
    classPublicId: string,
    taskPublicId: string,
    payload: CoachUpdateTaskPayload,
  ) {
    return apiRequest<CoachTaskDetailRead>(
      `/coach/classes/${classPublicId}/tasks/${taskPublicId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
  },

  bulkUpdateClassTasks(classPublicId: string, payload: CoachBulkUpdateTasksPayload) {
    return apiRequest<CoachTasksResponse>(`/coach/classes/${classPublicId}/tasks/bulk-update`, {
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

  listClassAnnouncements(
    classPublicId: string,
    filters: CoachAnnouncementFilters = {},
  ) {
    const query = buildQuery({ limit: 50, ...filters });
    return apiRequest<CoachAnnouncementsResponse>(
      `/coach/classes/${classPublicId}/announcements${query}`,
      {
        method: "GET",
      },
    );
  },

  updateClassAnnouncement(
    classPublicId: string,
    announcementPublicId: string,
    payload: CoachUpdateAnnouncementPayload,
  ) {
    return apiRequest<CoachAnnouncementRead>(
      `/coach/classes/${classPublicId}/announcements/${announcementPublicId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
  },

  bulkUpdateClassAnnouncements(
    classPublicId: string,
    payload: CoachBulkUpdateAnnouncementsPayload,
  ) {
    return apiRequest<CoachAnnouncementsResponse>(
      `/coach/classes/${classPublicId}/announcements/bulk-update`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  getStudentProfile(studentPublicId: string) {
    return apiRequest<CoachStudentProfileRead>(`/coach/students/${studentPublicId}/profile`, {
      method: "GET",
    });
  },

  listStudentReports(studentPublicId: string, limit = 50) {
    return apiRequest<CoachStudentReportsResponse>(
      `/coach/students/${studentPublicId}/reports?limit=${limit}`,
      {
        method: "GET",
      },
    );
  },
};
