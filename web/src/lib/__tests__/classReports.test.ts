import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ClassReportDetails } from '@/components/class-reports/ClassReportDetails';
import type { ClassReport, ExerciseEnergy } from '@/services/classReports';
const report: ClassReport = {
  public_id:'report',published_at:'2026-09-30T00:00:00Z',is_latest:true,title:'Basketball',class_name:'Class',held_on:'2026-09-30',timezone:'Australia/Sydney',lesson_public_id:'lesson',lesson_version:2,student_name:'Alex',attendance:'present',report_kind:'training_record',total_minutes:'30',notes:null,lesson_notes:null,
  items:[{name:'Ball handling',actual_minutes:'30',minutes:'30',notes:null}],profile:null,profile_status:'missing_at_lesson_date',nutrition:{status:'rules_pending',rule_version:null,energy_kcal:null,meals:null},
};
const energy:ExerciseEnergy = {
  status:'complete',total_kcal:180,known_subtotal_kcal:180,unrounded_subtotal_kcal:'179.7',
  missing_items:0,methods:['youth_mety'],basis:'gross',rule_version:'exercise-v1',mapping_version:'activities-v1',rounding_version:'kcal-v1',
  items:[{status:'complete',method:'youth_mety',gross_kcal:180,unrounded_kcal:'179.7',reason:null,inputs:{minutes:'30'},
    source:{title:'NCCOR Youth Compendium',url:'https://www.nccor.org/tools/youthcompendium/',activity_code:'basketball',description:'Basketball activity',age_group:'10–12'}}],
};

describe('class records distinguish frozen training and estimates',()=>{
  it('shows actual participation and explicitly unavailable calories',()=>{
    const html=renderToStaticMarkup(createElement(ClassReportDetails,{report}));
    expect(html).toContain('30 minutes participated');
    expect(html).toContain('This publication did not include an energy estimate');
    expect(html).toContain('No measurements were available');
    expect(html).not.toContain('0 kcal');
  });
  it('absence is an attendance record without activity expenditure',()=>{
    const html=renderToStaticMarkup(createElement(ClassReportDetails,{report:{...report,attendance:'absent',report_kind:'attendance_only',total_minutes:'0'}}));
    expect(html).toContain('Attendance record only');
    expect(html).not.toContain('Ball handling');
    expect(html).not.toContain('Training energy estimate');
  });
  it('labels old publications rather than presenting them as current',()=>{
    const html=renderToStaticMarkup(createElement(ClassReportDetails,{report:{...report,is_latest:false}}));
    expect(html).toContain('Historical version');
  });
  it('shows complete training-period energy and its child source without meal targets',()=>{
    const html=renderToStaticMarkup(createElement(ClassReportDetails,{report:{...report,exercise_energy:energy}}));
    expect(html).toContain('≈ 180 kcal');
    expect(html).toContain('including resting');
    expect(html).toContain('Children’s activity reference');
    expect(html).toContain('NCCOR Youth Compendium');
    expect(html).toContain('Age group 10–12');
    expect(html).toContain('href="/foods"');
    expect(html).not.toContain('kcal / day');
    expect(html).not.toContain('Breakfast');
  });
  it('presents incomplete activity estimates as a known subtotal',()=>{
    const partial:ExerciseEnergy = {...energy,status:'partial',total_kcal:null,missing_items:1,
      items:[...energy.items,{status:'unavailable',method:null,gross_kcal:null,unrounded_kcal:null,source:null,inputs:{},reason:'Activity standard was not selected.'}]};
    const html=renderToStaticMarkup(createElement(ClassReportDetails,{report:{...report,items:[...report.items,{name:'Custom practice',actual_minutes:'10',minutes:'10',notes:null}],exercise_energy:partial}}));
    expect(html).toContain('Known subtotal ≈ 180 kcal');
    expect(html).toContain('1 activity without a complete estimate');
    expect(html).toContain('Activity standard was not selected');
    expect(html).toContain('Not estimated');
    expect(html).not.toMatch(/≈\s*0 kcal/);
  });
  it('marks analogy and general references as approximations',()=>{
    for (const method of ['youth_analogy','generic_met_approximation'] as const) {
      const approximate:ExerciseEnergy={...energy,methods:[method],items:[{...energy.items[0],method}]};
      const html=renderToStaticMarkup(createElement(ClassReportDetails,{report:{...report,exercise_energy:approximate}}));
      expect(html.toLowerCase()).toContain(method === 'youth_analogy' ? 'approximate match' : 'approximation');
    }
  });
  it('does not turn missing measurements or unavailable results into zero',()=>{
    const unavailable:ExerciseEnergy={...energy,status:'unavailable',total_kcal:null,known_subtotal_kcal:null,missing_items:1,methods:[],items:[{...energy.items[0],method:null,gross_kcal:null,source:null,reason:'Body measurements unavailable.'}]};
    const html=renderToStaticMarkup(createElement(ClassReportDetails,{report:{...report,exercise_energy:unavailable}}));
    expect(html).toContain('Energy estimate unavailable');
    expect(html).toContain('Body measurements unavailable');
    expect(html).not.toContain('0 kcal');
  });
});
