import { apiRequest } from '@/services/client';
export type EnergyReferenceInput = {
  age_years:number; sex:'male'|'female'; pal:string;
  meal_shares?:{breakfast:string;lunch:string;dinner:string};
};
export type EnergyReferenceMetadata = {
  rule_version:string;status:string;source_url:string;source_title:string;checked_on:string;
  min_age:number;max_age:number;pal_options:{value:string;label:string}[];
};
export type EnergyReferencePreview = EnergyReferenceMetadata & {
  inputs:EnergyReferenceInput;reference_weight_kg:string;reference_height_cm:string;
  energy_mj:string;energy_kj:string;energy_kcal:number;
  meals:{name:string;percent:string;energy_kcal:number}[]|null;
  meal_rule_status:string;exercise_energy_kcal:null;macronutrients:null;
  calculation:string;rounding:string;
};
export const energyReferenceService = {
  metadata:()=>apiRequest<EnergyReferenceMetadata>('/admin/energy-reference'),
  preview:(input:EnergyReferenceInput)=>apiRequest<EnergyReferencePreview>('/admin/energy-reference/preview',{method:'POST',body:JSON.stringify(input)}),
};
