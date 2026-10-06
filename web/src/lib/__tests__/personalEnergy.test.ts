import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {PersonalEnergyDetails} from '@/components/class-reports/PersonalEnergyDetails';
import type {PersonalEnergyPreview} from '@/services/personalEnergy';
const result:PersonalEnergyPreview={rule_version:'candidate-v1',source_url:'https://www.canada.ca',source_title:'Health Canada',checked_on:'2026-10-01',status:'candidate_review_only',lesson_version:2,input_basis:'published_snapshot',activity_category:'active',blockers:[],players:[{student_name:'Alex',attendance:'present',status:'missing_profile',reason:'No measurements available',energy_kcal:null,growth_kcal:null,formula:null,inputs:null}]};
describe('personal energy review',()=>{
  it('distinguishes individual selections and supports older snapshots',()=>{
    const r:PersonalEnergyPreview={...result,players:[{...result.players[0],activity_category:'inactive',activity_basis:'individual_review'}]};
    const html=renderToStaticMarkup(createElement(PersonalEnergyDetails,{result:r}));
    expect(html).toContain('Activity scenario: inactive');
    expect(html).toContain('Individual review selection');
    const old=renderToStaticMarkup(createElement(PersonalEnergyDetails,{result}));
    expect(old).toContain('Activity scenario: active');
    expect(old).toContain('Class comparison scenario');
  });
  it('shows entered meal split without allocating missing profiles',()=>{
    const r={...result,players:[{...result.players[0],energy_kcal:2400,meals:[{name:'breakfast',percent:'30',energy_kcal:720},{name:'lunch',percent:'40',energy_kcal:960},{name:'dinner',percent:'30',energy_kcal:720}]}]};
    const html=renderToStaticMarkup(createElement(PersonalEnergyDetails,{result:r}));
    expect(html).toContain('960 kcal');expect(html).toContain('meals total 2400 kcal');expect(html).toContain('not an amount to make up');
    const missing=renderToStaticMarkup(createElement(PersonalEnergyDetails,{result}));
    expect(missing).not.toContain('Meal energy scenario');
  });
  it('keeps missing values distinct from zero and identifies frozen inputs',()=>{
    const html=renderToStaticMarkup(createElement(PersonalEnergyDetails,{result}));
    expect(html).toContain('Alex');expect(html).toContain('No measurements available');expect(html).not.toMatch(/\b0 kcal/);expect(html).toContain('frozen with this published');
  });
  it('shows candidate result and actual measurement age',()=>{
    const r={...result,players:[{...result.players[0],status:'candidate',reason:'Candidate for review',energy_kcal:2400,growth_kcal:25,formula:'formula',inputs:{measured_on:'2026-09-01',measurement_age_days:35,held_on:'2026-10-06',age_years:'12.0000',sex:'male',height_cm:'150',weight_kg:'40',activity_category:'active' as const}}]};
    const html=renderToStaticMarkup(createElement(PersonalEnergyDetails,{result:r}));
    expect(html).toContain('2400 kcal / day');expect(html).toContain('35 days before');expect(html).toContain('already included');expect(html).toContain('Do not add exercise calories again');
  });
});
