"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { classReportService, type DailyClassSummary } from '@/services/classReports';
import { DailySummaryDetails } from '@/components/class-reports/DailySummaryDetails';
import { button, field, ErrorNotice } from '@/components/recipes/RecipeShared';

function sydneyToday() {
  const parts = new Intl.DateTimeFormat('en', { timeZone:'Australia/Sydney', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(new Date());
  return ['year','month','day'].map(key => parts.find(p => p.type === key)?.value).join('-');
}

export default function DailyClassReports() {
  const [date, setDate] = useState('');
  const [summary, setSummary] = useState<DailyClassSummary | null>(null);
  const [loading, setLoading] = useState(false), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => { setDate(sydneyToday()); }, []);
  useEffect(() => {
    let active = true;
    setSummary(null); setError('');
    if (!date) { setLoading(false); return; }
    setLoading(true);
    classReportService.daily(date).then(data => { if (active) setSummary(data); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Could not load daily summary.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [date, retry]);
  return <section className="space-y-5">
    <Link className="underline" href="/me/class-reports">Back to class reports</Link>
    <h1 className="text-3xl font-semibold">Daily summary</h1>
    <p className="text-white/75">Your latest published record from each lesson, grouped by lesson date in Australia/Sydney. Saved drafts are excluded. New publications update this summary; previous reports remain in history.</p>
    <div className="flex flex-wrap items-end gap-4">
      <label className="min-w-0">Lesson date<input className={field} type="date" value={date} onChange={e => { setSummary(null); setDate(e.target.value); }} /></label>
      <button className={button} disabled={!date || loading} onClick={() => setRetry(v => v+1)}>Refresh summary</button>
    </div>
    {!date && <p>Select a lesson date to view your records.</p>}
    {loading && <p role="status">Loading daily summary…</p>}
    {error && <ErrorNotice error={error} retry={() => setRetry(v => v+1)} />}
    {!loading && !error && summary && <DailySummaryDetails summary={summary} />}
  </section>;
}
