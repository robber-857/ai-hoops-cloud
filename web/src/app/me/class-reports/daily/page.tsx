"use client";
import { usePlayerCopy } from "@/components/account/playerCopy";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { classReportService, type DailyClassSummary } from '@/services/classReports';
import { DailySummaryDetails } from '@/components/class-reports/DailySummaryDetails';
import { ErrorNotice } from '@/components/recipes/RecipeShared';

function sydneyToday() {
  const parts = new Intl.DateTimeFormat('en', { timeZone:'Australia/Sydney', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(new Date());
  return ['year','month','day'].map(key => parts.find(p => p.type === key)?.value).join('-');
}

export default function DailyClassReports() {
  const { t } = usePlayerCopy();
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
      .catch(e => { if (active) setError(e instanceof Error ? e.message : "Could not load daily summary."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [date, retry]);
  return <section className="space-y-5 text-[var(--ui-text)]">
    <div>
      <Link className="ui-link" href="/me/class-reports"><ArrowLeft size={16} aria-hidden="true" />{t("Back to class reports")}</Link>
      <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{t("Daily summary")}</h1>
      <p className="mt-2 max-w-prose text-sm leading-6 text-[var(--ui-muted)]">{t("This summary uses the latest published record for each lesson on the selected date in Australia/Sydney. Earlier publications are available in each report’s history.")}</p>
    </div>
    <div className="flex flex-wrap items-end gap-3">
      <label className="grid min-w-0 gap-1.5 text-sm font-semibold">{t("Lesson date")}<input className="min-h-11 max-w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 text-[var(--ui-text)]" type="date" value={date} onChange={e => { setSummary(null); setDate(e.target.value); }} /></label>
      <button className="ui-button" disabled={!date || loading} onClick={() => setRetry(v => v+1)}><RefreshCw size={15} aria-hidden="true" />{t("Refresh summary")}</button>
    </div>
    {!date && <p>{t("Select a lesson date to view your records.")}</p>}
    {loading && <p role="status">{t("Loading daily summary…")}</p>}
    {error && <ErrorNotice error={t(error)} retry={() => setRetry(v => v+1)} />}
    {!loading && !error && summary && <DailySummaryDetails summary={summary} />}
  </section>;
}
