import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EnergyReferenceResult } from '@/components/class-reports/EnergyReferenceResult';
import type { EnergyReferencePreview } from '@/services/energyReference';
const result:EnergyReferencePreview={
  rule_version:'review-v1',status:'reference_only',source_url:'https://www.eatforhealth.gov.au/nutrient-reference-values/nutrients/dietary-energy',source_title:'NRV Table 2',checked_on:'2026-09-30',min_age:4,max_age:18,pal_options:[],inputs:{age_years:12,sex:'male',pal:'1.8'},reference_weight_kg:'40.5',reference_height_cm:'149.00',energy_mj:'10.5',energy_kj:'10500',energy_kcal:2510,meals:null,meal_rule_status:'not_configured',exercise_energy_kcal:null,macronutrients:null,calculation:'Conversion',rounding:'Rounding',
};
describe('admin energy reference boundaries',()=>{
  it('labels reference measurements, no meal default and no player publication',()=>{
    const html=renderToStaticMarkup(createElement(EnergyReferenceResult,{result}));
    expect(html).toContain('about 2510 kcal');
    expect(html).toContain('not a player');
    expect(html).toContain('No meal split configured');
    expect(html).toContain('not saved or published');
    expect(html).toContain('Do not add class exercise calories');
    expect(html).not.toMatch(/\b0 kcal/);
  });
  it('identifies meal percentages as the user scenario',()=>{
    const html=renderToStaticMarkup(createElement(EnergyReferenceResult,{result:{...result,meals:[{name:'breakfast',percent:'30',energy_kcal:750},{name:'lunch',percent:'40',energy_kcal:1010},{name:'dinner',percent:'30',energy_kcal:750}]}}));
    expect(html).toContain('not an official meal recommendation');
    expect(html).toContain('Lunch');
    expect(html).toContain('1010 kcal');
    expect(html).not.toContain('No meal split configured');
  });
});
