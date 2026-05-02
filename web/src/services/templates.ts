import { apiRequest } from "@/services/client";
import type { ReportAnalysisType } from "@/services/reports";

export type TemplateExampleVideoRead = {
  public_id: string;
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
};

export type TrainingTemplateVersionRead = {
  public_id: string;
  version: string;
  scoring_rules: Record<string, unknown>;
  metric_definitions: Record<string, unknown> | null;
  mediapipe_config: Record<string, unknown> | null;
  summary_template: Record<string, unknown> | null;
  status: string;
  is_default: boolean;
  published_at: string | null;
};

export type TrainingTemplateRead = {
  public_id: string;
  template_code: string;
  name: string;
  analysis_type: ReportAnalysisType;
  description: string | null;
  difficulty_level: string | null;
  status: string;
  current_version: string | null;
  published_at: string | null;
  versions: TrainingTemplateVersionRead[];
  example_videos: TemplateExampleVideoRead[];
};

function encodeObjectKey(objectKey: string) {
  return objectKey.split("/").map(encodeURIComponent).join("/");
}

export function resolveTemplateExampleVideoSource(video: TemplateExampleVideoRead) {
  const objectKey = video.object_key.trim();

  if (!objectKey) {
    return null;
  }

  if (objectKey.startsWith("http://") || objectKey.startsWith("https://")) {
    return objectKey;
  }

  if (objectKey.startsWith("/")) {
    return objectKey;
  }

  if (video.storage_provider === "supabase") {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
    if (!supabaseUrl) {
      return null;
    }

    return `${supabaseUrl}/storage/v1/object/public/${encodeURIComponent(
      video.bucket_name,
    )}/${encodeObjectKey(objectKey)}`;
  }

  return null;
}

export const templateService = {
  listTemplates(includeInactive = false) {
    const query = includeInactive ? "?include_inactive=true" : "";
    return apiRequest<TrainingTemplateRead[]>(`/training-templates${query}`, {
      method: "GET",
    });
  },

  getTemplate(templateCode: string) {
    return apiRequest<TrainingTemplateRead>(
      `/training-templates/${encodeURIComponent(templateCode)}`,
      {
        method: "GET",
      },
    );
  },
};
