"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, History } from "lucide-react";
import { classReportService, type ClassReport } from "@/services/classReports";
import { ClassReportDetails } from "@/components/class-reports/ClassReportDetails";
import { ErrorNotice } from "@/components/recipes/RecipeShared";

function PublicationHistory({ id }: { id: string }) {
  const [items, setItems] = useState<ClassReport[]>([]);
  const [offset, setOffset] = useState(0);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    classReportService.history(id, offset).then(page => {
      if (!active) return;
      setItems(current => offset === 0 ? page.items : [...current, ...page.items]);
      setMore(page.has_more);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Could not load publication history.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [id, offset, retry]);

  return <section className="ui-panel p-4 sm:p-5">
    <h2 className="flex items-center gap-2 text-base font-semibold"><History size={18} className="text-[var(--ui-accent)]" aria-hidden="true" />Publication history</h2>
    {items.length > 0 && <ul className="mt-3 flex flex-wrap gap-2">{items.map(item => (
      <li key={item.public_id}>
        <Link
          href={`/me/class-reports/${encodeURIComponent(item.public_id)}`}
          aria-current={item.public_id === id ? "page" : undefined}
          className="ui-button aria-[current=page]:border-[var(--ui-accent)] aria-[current=page]:bg-[var(--ui-accent-soft)] aria-[current=page]:text-[var(--ui-accent)]"
        >Lesson v{item.lesson_version}{item.is_latest ? " · Latest" : ""}</Link>
      </li>
    ))}</ul>}
    {loading && <p role="status" className="mt-3 text-sm text-[var(--ui-muted)]">Loading publication history…</p>}
    {error && <ErrorNotice error={error} retry={() => { setError(""); setLoading(true); setRetry(n => n + 1); }} />}
    {more && !error && <button className="ui-link mt-2" disabled={loading} onClick={() => { setLoading(true); setOffset(items.length); }}>Older publications</button>}
  </section>;
}

function PublishedRecord({ id }: { id: string }) {
  const [report, setReport] = useState<ClassReport | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    classReportService.get(id).then(data => {
      if (active) setReport(data);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Could not load this record.");
    });
    return () => { active = false; };
  }, [id, retry]);

  return <section className="min-w-0 space-y-4 text-[var(--ui-text)] sm:space-y-5">
    <div>
      <Link href="/me/class-reports" className="ui-link"><ArrowLeft size={16} aria-hidden="true" />All class reports</Link>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Published class record</h1>
        {report && <p className="text-xs text-[var(--ui-muted)]">
          Published <time dateTime={report.published_at}>{new Date(report.published_at).toLocaleString("en-AU", { timeZone: "Australia/Sydney" })}</time> (Australia/Sydney)
        </p>}
      </div>
    </div>
    {error && <ErrorNotice error={error} retry={() => { setError(""); setRetry(n => n + 1); }} />}
    {!error && !report && <p role="status" className="ui-panel p-5 text-sm text-[var(--ui-muted)]">Loading record…</p>}
    {report && <><ClassReportDetails report={report} /><PublicationHistory id={id} /></>}
  </section>;
}

export default function ClassReportPage() {
  const { id } = useParams<{ id: string }>();
  return <PublishedRecord key={id} id={id} />;
}
