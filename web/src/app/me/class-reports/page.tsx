"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3, GraduationCap } from "lucide-react";
import { ErrorNotice } from "@/components/recipes/RecipeShared";
import { routes } from "@/lib/routes";
import { classReportService, type ClassReport } from "@/services/classReports";

const attendanceLabels: Record<ClassReport["attendance"], string> = {
  present: "Present",
  absent: "Absent",
  left_early: "Left early",
  partial: "Partial attendance",
};

export default function MyClassReports() {
  const [items, setItems] = useState<ClassReport[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    classReportService.mine()
      .then((response) => {
        if (active) {
          setItems(response.items);
          setHasMore(response.has_more);
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load reports.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);

  async function loadMore() {
    setLoading(true);
    setError("");
    try {
      const response = await classReportService.mine(items.length);
      setItems((current) => [...current, ...response.items]);
      setHasMore(response.has_more);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load reports.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Class reports</h1>
          <p className="mt-2 max-w-prose text-sm leading-6 text-[var(--ui-muted)]">
            See what you did in class, how long you trained and your attendance.
          </p>
        </div>
        <Link className="ui-button" href={`${routes.user.classReports}/daily`}>
          <CalendarDays size={17} aria-hidden="true" /> Daily summary
        </Link>
      </div>
      {error && (
        <ErrorNotice error={error} retry={() => {
          setLoading(true);
          setError("");
          setRetry((value) => value + 1);
        }} />
      )}
      {loading && <p role="status">Loading class reports…</p>}
      {!loading && !error && !items.length && (
        <p className="ui-panel p-5 text-sm text-[var(--ui-muted)]">Your coach has not published any class reports yet.</p>
      )}
      <ul className="grid gap-3">
        {items.map((report) => (
          <li key={report.public_id} className="ui-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-5">
            <div className="flex min-w-0 items-start gap-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--ui-accent-soft)] text-[var(--ui-accent)]">
                <GraduationCap size={20} aria-hidden="true" />
              </span>
              <div className="min-w-0 space-y-1.5">
                <h2 className="text-lg font-bold">{report.title}</h2>
                <p className="text-sm font-medium">{report.class_name}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-[var(--ui-muted)]">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays size={15} className="shrink-0" aria-hidden="true" />
                    <time dateTime={report.held_on}>{report.held_on}</time>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 size={15} className="shrink-0" aria-hidden="true" /> {report.total_minutes} min
                  </span>
                  <span>Lesson v{report.lesson_version}</span>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
              <span className="rounded-full bg-[var(--ui-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--ui-muted)]">
                {attendanceLabels[report.attendance] ?? "Training record"}
              </span>
              <Link
                href={`${routes.user.classReports}/${encodeURIComponent(report.public_id)}`}
                aria-label={`View report for ${report.title}`}
                className="ui-button"
              >
                View report <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button type="button" className="ui-button" disabled={loading} onClick={() => void loadMore()}>
          Load more class reports
        </button>
      )}
    </section>
  );
}
