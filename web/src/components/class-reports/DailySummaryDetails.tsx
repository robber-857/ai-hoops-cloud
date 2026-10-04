import Link from 'next/link';
import type { DailyClassSummary } from '@/services/classReports';
import { ExerciseEnergySummary, FoodRecoveryReference } from './ClassReportDetails';

export function DailySummaryDetails({ summary }: { summary: DailyClassSummary }) {
  if (!summary.published_lessons) return <div className="space-y-5">
    <p>No published class records for this date. This does not mean you had no physical activity.</p>
    <FoodRecoveryReference/>
  </div>;
  return <div className="space-y-6">
    <h2 className="text-xl font-semibold">{summary.held_on} · {summary.timezone}</h2>
    <section className="space-y-4">
    <h3 className="text-lg font-semibold">1. What you trained</h3>
    <dl className="grid gap-4 sm:grid-cols-2">
      {[
        ['Published lessons', summary.published_lessons],
        ['Attended lessons', summary.attended_lessons],
        ['Absent lessons', summary.absent_lessons],
        ['Participation minutes', summary.total_minutes],
      ].map(([label, value]) => <div key={label} className="rounded-xl border border-white/20 p-4"><dt className="text-white/70">{label}</dt><dd className="mt-2 text-2xl font-semibold">{value}</dd></div>)}
    </dl>
    <ul className="divide-y divide-white/20">{summary.reports.map(report => <li key={report.public_id} className="space-y-2 py-4">
      <Link className="break-words text-lg underline" href={`/me/class-reports/${report.public_id}`}>{report.title}</Link>
      <p className="mt-2 break-words text-white/70">{report.class_name} · {report.total_minutes} minutes · {report.attendance === 'absent' ? 'Absent' : report.attendance === 'left_early' ? 'Left early' : report.attendance === 'partial' ? 'Partial participation' : 'Full attendance'} · Lesson v{report.lesson_version}</p>
      {report.attendance !== 'absent' && <ul className="space-y-1 text-sm text-white/80">{report.items.map((item,index) =>
        <li key={index} className="break-words">{item.name} · {item.minutes} minutes{item.intensity ? ` · ${item.intensity} intensity` : ''}</li>)}</ul>}
    </li>)}</ul>
    <p className="text-sm text-white/70">Minutes use your participation in each lesson. Overlapping lesson times are not detected.</p>
    </section>
    <section className="space-y-3 border-t border-white/20 pt-5">
      <h3 className="text-lg font-semibold">2. Training energy estimate</h3>
      <ExerciseEnergySummary energy={summary.exercise_energy}/>
      <p className="text-sm text-white/70">Open a class record to view its activity estimates and sources.</p>
    </section>
    <div className="space-y-3 border-t border-white/20 pt-5">
      <h3 className="text-lg font-semibold">3. Food nutrition reference</h3>
      <FoodRecoveryReference/>
    </div>
  </div>;
}
