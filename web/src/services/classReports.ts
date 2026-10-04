import { apiRequest } from '@/services/client';
import type { CampLesson } from '@/services/campLessons';
export type ExerciseEnergyTotals = {
  status: 'complete'|'partial'|'unavailable'|'not_applicable';
  total_kcal: number|null;
  known_subtotal_kcal: number|null;
  unrounded_subtotal_kcal?: string|null;
  methods: string[];
  basis: 'gross';
};
export type ExerciseEnergyItem = {
  status: string;
  method: 'youth_mety'|'youth_analogy'|'generic_met_approximation'|null;
  gross_kcal: number|null;
  unrounded_kcal: string|null;
  source: {title:string;url:string;activity_code:string;description:string;age_group:string|null}|null;
  inputs: Record<string,unknown>;
  reason: string|null;
};
export type ExerciseEnergy = ExerciseEnergyTotals & {
  missing_items: number;
  items: ExerciseEnergyItem[];
  rule_version: string;
  mapping_version: string;
  rounding_version: string;
};
export type DailyExerciseEnergy = ExerciseEnergyTotals & {
  missing_reports: number;
  missing_items?: number;
};
export type ClassReport = {
  public_id: string; published_at: string; is_latest: boolean;
  title: string; class_name: string; held_on: string; timezone: string;
  lesson_public_id: string; lesson_version: number; student_name: string;
  attendance: 'present'|'absent'|'left_early'|'partial'; report_kind: string;
  total_minutes: string; notes: string|null; lesson_notes: string|null;
  items: {name:string; actual_minutes:string; minutes:string; notes:string|null;activity_code?:string|null;intensity?:string|null}[];
  profile: {measured_on:string;date_of_birth:string;height_cm:string;weight_kg:string;sex:string|null;bmi?:string|number|null}|null;
  profile_status: string; nutrition: {status:string;rule_version:null;energy_kcal:null;meals:null};
  exercise_energy?: ExerciseEnergy;
};
export type ReportPreview = {lesson_version:number;blockers:string[];already_published:boolean;reports:ClassReport[];preview_fingerprint?:string|null};
export type Publication = {public_id:string;lesson_version:number;published_at:string;reports:ClassReport[]};
export type DailyClassSummary = {
  held_on:string; timezone:string; published_lessons:number; attended_lessons:number;
  absent_lessons:number; total_minutes:string; reports:ClassReport[];
  exercise_energy?: DailyExerciseEnergy;
};
const base=(l:CampLesson)=>`/coach/classes/${l.class_public_id}/lessons/${l.public_id}`;
export const classReportService={
  daily:(date:string)=>apiRequest<DailyClassSummary>(`/me/class-reports/daily?held_on=${encodeURIComponent(date)}`),
  preview:(l:CampLesson)=>apiRequest<ReportPreview>(`${base(l)}/report-preview`),
  publish:(l:CampLesson,previewFingerprint?:string|null)=>apiRequest<Publication>(`${base(l)}/publish-reports`,{method:'POST',body:JSON.stringify({expected_version:l.version,...(previewFingerprint ? {expected_preview_fingerprint:previewFingerprint} : {})})}),
  mine:(offset=0)=>apiRequest<{items:ClassReport[];has_more:boolean}>(`/me/class-reports?offset=${offset}`),
  get:(id:string)=>apiRequest<ClassReport>(`/me/class-reports/${id}`),
  history:(id:string,offset=0)=>apiRequest<{items:ClassReport[];has_more:boolean}>(`/me/class-reports/${id}/history?offset=${offset}`),
};
