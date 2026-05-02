import { apiRequest } from "@/services/client";
import type { ReportAnalysisType } from "@/services/reports";

export type AdminCampRead = {
  public_id: string;
  name: string;
  code: string;
  description: string | null;
  season_name: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  class_count: number;
  created_at: string;
};

export type AdminCreateCampPayload = {
  name: string;
  code: string;
  description?: string | null;
  season_name?: string | null;
  status?: string;
  start_date?: string | null;
  end_date?: string | null;
};

export type AdminUpdateCampPayload = Partial<AdminCreateCampPayload>;

export type AdminClassRead = {
  public_id: string;
  camp_public_id: string;
  camp_name: string;
  name: string;
  code: string;
  description: string | null;
  status: string;
  age_group: string | null;
  max_students: number | null;
  start_date: string | null;
  end_date: string | null;
  coach_count: number;
  student_count: number;
  created_at: string;
};

export type AdminCreateClassPayload = {
  camp_public_id: string;
  name: string;
  code: string;
  description?: string | null;
  status?: string;
  age_group?: string | null;
  max_students?: number | null;
  start_date?: string | null;
  end_date?: string | null;
};

export type AdminUpdateClassPayload = Partial<Omit<AdminCreateClassPayload, "camp_public_id">>;

export type AdminClassMemberRead = {
  public_id: string;
  class_public_id: string;
  user_public_id: string;
  username: string;
  nickname: string | null;
  email: string | null;
  phone_number: string;
  user_role: string;
  member_role: string;
  status: string;
  joined_at: string | null;
  left_at: string | null;
  remarks: string | null;
  created_at: string;
};

export type AdminCreateClassMemberPayload = {
  user_public_id: string;
  member_role: string;
  status?: string;
  joined_at?: string | null;
  remarks?: string | null;
};

export type AdminUserRole = "user" | "student" | "coach" | "admin";
export type AdminUserStatus = "active" | "disabled" | "locked";

export type AdminUserClassMembershipRead = {
  public_id: string;
  class_public_id: string;
  class_name: string;
  class_code: string;
  camp_public_id: string;
  camp_name: string;
  member_role: string;
  status: string;
  joined_at: string | null;
  left_at: string | null;
};

export type AdminUserRead = {
  public_id: string;
  username: string;
  nickname: string | null;
  email: string | null;
  phone_number: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  is_active: boolean;
  class_names: string[];
  camp_names: string[];
  active_class_count: number;
  report_count: number;
  task_assignment_count: number;
  last_training_at: string | null;
  last_login_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminUserDetailRead = AdminUserRead & {
  memberships: AdminUserClassMembershipRead[];
};

export type AdminUsersResponse = {
  items: AdminUserRead[];
  total: number;
  page: number;
  page_size: number;
};

export type AdminCreateUserPayload = {
  username: string;
  password: string;
  phone_number: string;
  email?: string | null;
  nickname?: string | null;
  role?: AdminUserRole;
  status?: AdminUserStatus;
  class_public_ids?: string[] | null;
};

export type AdminUpdateUserPayload = Partial<AdminCreateUserPayload>;

export type AdminTrainingTemplateRead = {
  public_id: string;
  template_code: string;
  name: string;
  analysis_type: ReportAnalysisType;
  description: string | null;
  difficulty_level: string | null;
  status: string;
  current_version: string | null;
  version_count: number;
  published_at: string | null;
  created_at: string;
};

export type AdminLocalTemplateSyncItem = {
  template_code: string;
  name: string;
  analysis_type: ReportAnalysisType;
  source_path: string;
  version: string;
  action: "create" | "update" | "skip";
  reason: string | null;
};

export type AdminLocalTemplateSyncResponse = {
  dry_run: boolean;
  created: number;
  updated: number;
  skipped: number;
  items: AdminLocalTemplateSyncItem[];
};

export type AdminCreateTrainingTemplatePayload = {
  template_code: string;
  name: string;
  analysis_type: ReportAnalysisType;
  description?: string | null;
  difficulty_level?: string | null;
  status?: string;
  current_version?: string | null;
};

export type AdminUpdateTrainingTemplatePayload = Partial<AdminCreateTrainingTemplatePayload>;

export type AdminTrainingTemplateVersionRead = {
  public_id: string;
  version: string;
  scoring_rules: Record<string, unknown>;
  metric_definitions: Record<string, unknown> | null;
  mediapipe_config: Record<string, unknown> | null;
  summary_template: Record<string, unknown> | null;
  status: string;
  is_default: boolean;
  published_at: string | null;
  created_at: string;
};

export type AdminCreateTrainingTemplateVersionPayload = {
  version: string;
  scoring_rules: Record<string, unknown>;
  metric_definitions?: Record<string, unknown> | null;
  mediapipe_config?: Record<string, unknown> | null;
  summary_template?: Record<string, unknown> | null;
  status?: string;
  is_default?: boolean;
};

export type AdminUpdateTrainingTemplateVersionPayload = Partial<AdminCreateTrainingTemplateVersionPayload>;

export type AdminTemplateExampleVideoRead = {
  public_id: string;
  template_public_id: string;
  template_version: string | null;
  title: string;
  description: string | null;
  storage_provider: "s3" | "supabase";
  bucket_name: string;
  object_key: string;
  file_name: string;
  content_type: string;
  duration_seconds: number | null;
  cover_url: string | null;
  sort_order: number;
  status: string;
  created_at: string;
};

export type AdminCreateTemplateExampleVideoPayload = {
  template_version?: string | null;
  title: string;
  description?: string | null;
  storage_provider?: "s3" | "supabase";
  bucket_name: string;
  object_key: string;
  file_name: string;
  content_type?: string;
  duration_seconds?: number | null;
  cover_url?: string | null;
  sort_order?: number;
  status?: string;
};

export type AdminUpdateTemplateExampleVideoPayload =
  Partial<AdminCreateTemplateExampleVideoPayload>;

type ItemsResponse<TItem> = {
  items: TItem[];
};

export const adminService = {
  listUsers(filters: {
    role?: AdminUserRole | "";
    status?: AdminUserStatus | "";
    keyword?: string;
    page?: number;
    page_size?: number;
  } = {}) {
    const searchParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        return;
      }
      searchParams.set(key, String(value));
    });
    const query = searchParams.toString();
    return apiRequest<AdminUsersResponse>(`/admin/users${query ? `?${query}` : ""}`, {
      method: "GET",
    });
  },

  createUser(payload: AdminCreateUserPayload) {
    return apiRequest<AdminUserDetailRead>("/admin/users", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getUser(userPublicId: string) {
    return apiRequest<AdminUserDetailRead>(`/admin/users/${userPublicId}`, {
      method: "GET",
    });
  },

  updateUser(userPublicId: string, payload: AdminUpdateUserPayload) {
    return apiRequest<AdminUserDetailRead>(`/admin/users/${userPublicId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  disableUser(userPublicId: string) {
    return apiRequest<null>(`/admin/users/${userPublicId}`, {
      method: "DELETE",
    });
  },

  listCamps() {
    return apiRequest<ItemsResponse<AdminCampRead>>("/admin/camps", {
      method: "GET",
    });
  },

  createCamp(payload: AdminCreateCampPayload) {
    return apiRequest<AdminCampRead>("/admin/camps", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateCamp(campPublicId: string, payload: AdminUpdateCampPayload) {
    return apiRequest<AdminCampRead>(`/admin/camps/${campPublicId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  listClasses(campPublicId?: string) {
    const query = campPublicId ? `?camp_public_id=${campPublicId}` : "";
    return apiRequest<ItemsResponse<AdminClassRead>>(`/admin/classes${query}`, {
      method: "GET",
    });
  },

  createClass(payload: AdminCreateClassPayload) {
    return apiRequest<AdminClassRead>("/admin/classes", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateClass(classPublicId: string, payload: AdminUpdateClassPayload) {
    return apiRequest<AdminClassRead>(`/admin/classes/${classPublicId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  listClassMembers(classPublicId: string) {
    return apiRequest<ItemsResponse<AdminClassMemberRead>>(
      `/admin/classes/${classPublicId}/members`,
      {
        method: "GET",
      },
    );
  },

  addClassMember(classPublicId: string, payload: AdminCreateClassMemberPayload) {
    return apiRequest<AdminClassMemberRead>(`/admin/classes/${classPublicId}/members`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  removeClassMember(classPublicId: string, memberPublicId: string) {
    return apiRequest<null>(`/admin/classes/${classPublicId}/members/${memberPublicId}`, {
      method: "DELETE",
    });
  },

  listTrainingTemplates() {
    return apiRequest<ItemsResponse<AdminTrainingTemplateRead>>("/admin/training-templates", {
      method: "GET",
    });
  },

  syncLocalTrainingTemplates(dryRun = true) {
    return apiRequest<AdminLocalTemplateSyncResponse>(
      `/admin/training-templates/sync-local?dry_run=${String(dryRun)}`,
      {
        method: "POST",
      },
    );
  },

  createTrainingTemplate(payload: AdminCreateTrainingTemplatePayload) {
    return apiRequest<AdminTrainingTemplateRead>("/admin/training-templates", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  updateTrainingTemplate(
    templatePublicId: string,
    payload: AdminUpdateTrainingTemplatePayload,
  ) {
    return apiRequest<AdminTrainingTemplateRead>(
      `/admin/training-templates/${templatePublicId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
  },

  listTrainingTemplateVersions(templatePublicId: string) {
    return apiRequest<ItemsResponse<AdminTrainingTemplateVersionRead>>(
      `/admin/training-templates/${templatePublicId}/versions`,
      {
        method: "GET",
      },
    );
  },

  createTrainingTemplateVersion(
    templatePublicId: string,
    payload: AdminCreateTrainingTemplateVersionPayload,
  ) {
    return apiRequest<AdminTrainingTemplateVersionRead>(
      `/admin/training-templates/${templatePublicId}/versions`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  updateTrainingTemplateVersion(
    templatePublicId: string,
    versionPublicId: string,
    payload: AdminUpdateTrainingTemplateVersionPayload,
  ) {
    return apiRequest<AdminTrainingTemplateVersionRead>(
      `/admin/training-templates/${templatePublicId}/versions/${versionPublicId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
  },

  listTemplateExampleVideos(templatePublicId: string) {
    return apiRequest<ItemsResponse<AdminTemplateExampleVideoRead>>(
      `/admin/training-templates/${templatePublicId}/example-videos`,
      {
        method: "GET",
      },
    );
  },

  createTemplateExampleVideo(
    templatePublicId: string,
    payload: AdminCreateTemplateExampleVideoPayload,
  ) {
    return apiRequest<AdminTemplateExampleVideoRead>(
      `/admin/training-templates/${templatePublicId}/example-videos`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  updateTemplateExampleVideo(
    templatePublicId: string,
    videoPublicId: string,
    payload: AdminUpdateTemplateExampleVideoPayload,
  ) {
    return apiRequest<AdminTemplateExampleVideoRead>(
      `/admin/training-templates/${templatePublicId}/example-videos/${videoPublicId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
  },

  deleteTemplateExampleVideo(templatePublicId: string, videoPublicId: string) {
    return apiRequest<null>(
      `/admin/training-templates/${templatePublicId}/example-videos/${videoPublicId}`,
      {
        method: "DELETE",
      },
    );
  },
};
