import { apiRequest } from "@/services/client";
export type LessonItem = {
  item_id: string;
  name: string;
  actual_minutes: string | null;
  notes: string | null;
};
export type LessonParticipant = {
  student_public_id: string;
  status: "unconfirmed" | "present" | "absent" | "left_early" | "partial";
  notes: string | null;
  items: { item_id: string; minutes: string | null }[];
};
export type LessonContent = {
  title: string;
  held_on: string;
  notes: string | null;
  items: LessonItem[];
  participants: LessonParticipant[];
};
export type CampLesson = LessonContent & {
  public_id: string;
  class_public_id: string;
  class_name: string;
  version: number;
  timezone: string;
  updated_at: string;
  source_plan: {
    title: string;
    public_id: string;
    items: { name: string; duration_minutes: number | null }[];
  };
  roster: { student_public_id: string; name: string; contact?: string | null }[];
};
export type LessonSummary = {
  public_id: string;
  title: string;
  held_on: string;
  version: number;
  unconfirmed_count: number;
  missing_minutes_count: number;
};
export type LessonHistoryEntry = { version: number; saved_at: string };
const base = (id: string) => `/coach/classes/${id}/lessons`;
export const lessonContent = (l: CampLesson): LessonContent => ({
  title: l.title,
  held_on: l.held_on,
  notes: l.notes,
  items: l.items,
  participants: l.participants,
});
export const campLessonService = {
  list: (id: string, offset = 0) =>
    apiRequest<{ items: LessonSummary[]; has_more: boolean }>(
      `${base(id)}?offset=${offset}`,
    ),
  get: (id: string, lessonId: string) =>
    apiRequest<CampLesson>(`${base(id)}/${lessonId}`),
  create: (
    id: string,
    input: { request_id: string; plan_public_id: string; held_on: string },
  ) =>
    apiRequest<CampLesson>(base(id), {
      method: "POST",
      body: JSON.stringify(input),
    }),
  save: (lesson: CampLesson, content: LessonContent, request_id: string) =>
    apiRequest<CampLesson>(
      `${base(lesson.class_public_id)}/${lesson.public_id}`,
      {
        method: "PUT",
        body: JSON.stringify({
          ...content,
          request_id,
          expected_version: lesson.version,
        }),
      },
    ),
  history: (lesson: CampLesson, offset = 0) =>
    apiRequest<{ items: LessonHistoryEntry[]; has_more: boolean }>(
      `${base(lesson.class_public_id)}/${lesson.public_id}/history?offset=${offset}`,
    ),
  revision: (lesson: CampLesson, version: number) =>
    apiRequest<CampLesson>(
      `${base(lesson.class_public_id)}/${lesson.public_id}/history/${version}`,
    ),
};
