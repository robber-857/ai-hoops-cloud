import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DailySummaryDetails } from '@/components/class-reports/DailySummaryDetails';
import type { ClassReport, DailyClassSummary } from '@/services/classReports';

const empty: DailyClassSummary = {held_on:'2026-10-06',timezone:'Australia/Sydney',published_lessons:0,attended_lessons:0,absent_lessons:0,total_minutes:'0',reports:[]};
describe('daily summary interpretation', () => {
  it('does not interpret missing publications as no physical activity', () => {
    const html=renderToStaticMarkup(createElement(DailySummaryDetails,{summary:empty}));
    expect(html).toContain('does not mean you had no physical activity');
    expect(html).not.toContain('Participation minutes');
  });
  it('shows recorded totals with no invented calories', () => {
    const html=renderToStaticMarkup(createElement(DailySummaryDetails,{summary:{...empty,published_lessons:2,attended_lessons:1,absent_lessons:1,total_minutes:'12.25'}}));
    expect(html).toContain('12.25');
    expect(html).toContain('Absent lessons');
    expect(html).toContain('did not include an energy estimate');
    expect(html).not.toContain('0 kcal');
  });
  it('shows actual activities and all three parent sections',()=>{
    const report:ClassReport={public_id:'r',published_at:'2026-10-06',is_latest:true,title:'Morning class',class_name:'Class A',held_on:empty.held_on,timezone:empty.timezone,lesson_public_id:'l',lesson_version:2,student_name:'Alex',attendance:'partial',report_kind:'training_record',total_minutes:'12.25',notes:null,lesson_notes:null,items:[{name:'Passing practice',actual_minutes:'20',minutes:'12.25',notes:null,intensity:'moderate'}],profile:null,profile_status:'missing_at_lesson_date',nutrition:{status:'rules_pending',rule_version:null,energy_kcal:null,meals:null}};
    const summary:DailyClassSummary={...empty,published_lessons:1,attended_lessons:1,total_minutes:'12.25',reports:[report],exercise_energy:{status:'complete',total_kcal:75,known_subtotal_kcal:75,missing_reports:0,methods:['youth_mety'],basis:'gross'}};
    const html=renderToStaticMarkup(createElement(DailySummaryDetails,{summary}));
    expect(html).toContain('1. What you trained');
    expect(html).toContain('Passing practice');
    expect(html).toContain('12.25 minutes');
    expect(html).toContain('moderate intensity');
    expect(html).toContain('2. Training energy estimate');
    expect(html).toContain('≈ 75 kcal');
    expect(html).toContain('3. Food nutrition reference');
    expect(html).toContain('href="/foods"');
  });
  it('labels daily incomplete records as a known subtotal rather than a total',()=>{
    const summary:DailyClassSummary={...empty,published_lessons:2,attended_lessons:2,total_minutes:'60',exercise_energy:{status:'partial',total_kcal:null,known_subtotal_kcal:125,missing_reports:1,methods:['youth_mety'],basis:'gross'}};
    const html=renderToStaticMarkup(createElement(DailySummaryDetails,{summary}));
    expect(html).toContain('Known subtotal ≈ 125 kcal');
    expect(html).toContain('1 class record without a complete estimate');
    expect(html).not.toContain('0 kcal');
  });
  it('leaves food information accessible when no class records have been published',()=>{
    const html=renderToStaticMarkup(createElement(DailySummaryDetails,{summary:empty}));
    expect(html).toContain('No published class records');
    expect(html).toContain('href="/foods"');
    expect(html).not.toContain('≈');
  });
});
