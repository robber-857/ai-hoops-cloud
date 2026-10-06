import { apiRequest } from '@/services/client';
import type { CampLesson } from '@/services/campLessons';
export type ActivityCategory='inactive'|'low_active'|'active'|'very_active';
export type MealShares={breakfast:string;lunch:string;dinner:string};
export type PersonalEnergyPlayer={
  student_public_id?:string;activity_category?:ActivityCategory;activity_basis?:'individual_review'|'class_scenario';
  student_name:string;attendance:string;status:string;reason:string;energy_kcal:number|null;growth_kcal:number|null;formula:string|null;
  meals?:{name:string;percent:string;energy_kcal:number}[]|null;
  inputs:{measured_on:string;measurement_age_days:number;held_on:string;age_years:string;sex:string;height_cm:string;weight_kg:string;activity_category:ActivityCategory}|null;
};
export type PersonalEnergyPreview={
  preview_token?:string;meal_shares?:MealShares|null;
  activity_overrides?:Record<string,ActivityCategory>;
  rule_version:string;source_url:string;source_title:string;checked_on:string;status:string;lesson_version:number;
  input_basis:'published_snapshot'|'saved_lesson';activity_category:ActivityCategory;blockers:string[];players:PersonalEnergyPlayer[];
};
export type EnergyDraft={public_id:string;revision:number;created_at:string;status:string;lesson_changed:boolean;snapshot:PersonalEnergyPreview};
export type EnergyDraftRequest={request_id:string;expected_revision:number;expected_version:number;preview_token:string;activity_category:ActivityCategory;meal_shares?:MealShares|null;activity_overrides?:Record<string,ActivityCategory>};
const draftBase=(lesson:CampLesson)=>`/coach/classes/${lesson.class_public_id}/lessons/${lesson.public_id}/energy-drafts`;
export const personalEnergyService={
  drafts:(lesson:CampLesson,offset=0)=>apiRequest<{items:EnergyDraft[];latest_revision:number;has_more:boolean}>(`${draftBase(lesson)}?offset=${offset}`),
  saveDraft:(lesson:CampLesson,payload:EnergyDraftRequest)=>apiRequest<EnergyDraft>(draftBase(lesson),{method:'POST',body:JSON.stringify(payload)}),
  preview:(lesson:CampLesson,activity:ActivityCategory,shares?:MealShares,overrides?:Record<string,ActivityCategory>)=>apiRequest<PersonalEnergyPreview>(`/coach/classes/${lesson.class_public_id}/lessons/${lesson.public_id}/energy-preview`,{method:'POST',body:JSON.stringify({expected_version:lesson.version,activity_category:activity,meal_shares:shares,activity_overrides:overrides})}),
};
