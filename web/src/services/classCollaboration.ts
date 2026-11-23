import { apiRequest } from "@/services/client";

type Invitation = { class_name: string; course_name: string };
type JoinStatus = "pending" | "approved" | "declined";
export type ClassJoinResult = Invitation & { status: JoinStatus };
export type ClassJoinRequest = {
  public_id: string;
  student_name: string;
  requested_at: string;
  reviewed_at: string | null;
  status: JoinStatus;
};
export type ClassInvitationStatus = { active: boolean; expires_at: string | null };
export type ClassVideo = {
  public_id: string;
  class_public_id: string;
  class_name: string;
  title: string;
  uploader_name: string;
  created_at: string;
};
type VideosPage = { items: ClassVideo[]; has_more: boolean };

export const maximumClassVideoBytes = 50_000_000;

function classPath(classId: string) {
  return `/coach/classes/${encodeURIComponent(classId)}`;
}

export const classCollaboration = {
  preview(token: string) {
    return apiRequest<Invitation>("/class-invitations/preview", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },
  apply(token: string) {
    return apiRequest<ClassJoinResult>("/class-invitations/apply", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  },
  getInvitation(classId: string) {
    return apiRequest<ClassInvitationStatus>(`${classPath(classId)}/invitation`);
  },
  issueInvitation(classId: string) {
    return apiRequest<{ token: string; expires_at: string }>(`${classPath(classId)}/invitation`, {
      method: "POST",
    });
  },
  revokeInvitation(classId: string) {
    return apiRequest<void>(`${classPath(classId)}/invitation`, { method: "DELETE" });
  },
  listJoinRequests(classId: string) {
    return apiRequest<ClassJoinRequest[]>(`${classPath(classId)}/join-requests`);
  },
  review(classId: string, requestId: string, decision: "approved" | "declined") {
    return apiRequest<ClassJoinRequest>(`${classPath(classId)}/join-requests/${encodeURIComponent(requestId)}`, {
      method: "PATCH",
      body: JSON.stringify({ decision }),
    });
  },
  listVideos(offset = 0, classId?: string) {
    const path = classId ? `${classPath(classId)}/videos` : "/me/class-videos";
    return apiRequest<VideosPage>(`${path}?offset=${offset}`);
  },
  async uploadVideo(classId: string, title: string, file: File) {
    if (file.size > maximumClassVideoBytes) throw new Error("Video must be 50 MB or smaller.");
    const extension = file.name.split(".").pop()?.toLowerCase();
    const mime = extension === "mp4" ? "video/mp4" : extension === "webm" ? "video/webm" : file.type;
    if (mime !== "video/mp4" && mime !== "video/webm") throw new Error("Choose an MP4 or WebM video.");
    const params = new URLSearchParams({ title });
    return apiRequest<ClassVideo>(`${classPath(classId)}/videos?${params}`, {
      method: "POST",
      headers: { "Content-Type": mime },
      body: file,
    });
  },
  playback(videoId: string) {
    return apiRequest<{ url: string }>(`/class-videos/${encodeURIComponent(videoId)}/playback`);
  },
  archive(classId: string, videoId: string) {
    return apiRequest<void>(`${classPath(classId)}/videos/${encodeURIComponent(videoId)}`, {
      method: "DELETE",
    });
  },
};
