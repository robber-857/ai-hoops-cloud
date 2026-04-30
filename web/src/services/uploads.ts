import { apiRequest } from "@/services/client";

export type UploadAnalysisType = "shooting" | "dribbling" | "training";

export type UploadInitPayload = {
  analysis_type: UploadAnalysisType;
  file_name: string;
  content_type: string;
  file_size: number;
  template_code?: string;
  template_version?: string;
  class_public_id?: string;
  task_assignment_public_id?: string;
  source_type?: string;
};

export type UploadInitResponse = {
  session_public_id: string;
  upload_task_public_id: string;
  storage_provider: "s3" | "supabase";
  bucket_name: string;
  object_key: string;
  upload_strategy: string;
  upload_expires_at: string | null;
};

export type VideoRead = {
  public_id: string;
  storage_provider: "s3" | "supabase";
  bucket_name: string;
  object_key: string;
  file_name: string;
  original_file_name: string | null;
  content_type: string;
  file_size: number;
  url: string | null;
  cdn_url: string | null;
  upload_status: string;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  created_at: string;
};

export type UploadCompletePayload = {
  upload_task_public_id: string;
  original_file_name?: string;
  url?: string;
  cdn_url?: string;
  checksum_md5?: string;
  etag?: string;
  duration_seconds?: number;
  width?: number;
  height?: number;
  fps?: number;
};

export type UploadCompleteResponse = {
  session_public_id: string;
  upload_task_public_id: string;
  video: VideoRead;
};

export type CompletedUploadSession = {
  sessionPublicId: string;
  uploadTaskPublicId: string;
  bucketName: string;
  objectKey: string;
  videoUrl: string;
  videoPublicId: string;
};

export const uploadService = {
  init(payload: UploadInitPayload) {
    return apiRequest<UploadInitResponse>("/uploads/init", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  complete(payload: UploadCompletePayload) {
    return apiRequest<UploadCompleteResponse>("/uploads/complete", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
