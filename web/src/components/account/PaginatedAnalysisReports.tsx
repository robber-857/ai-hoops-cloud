"use client";

import { useEffect, useState } from "react";
import { meService } from "@/services/me";
import { normalizeReport } from "./AccountDataProvider";
import type { AccountReport } from "./types";
import { RecentReportsSection } from "./RecentReportsSection";
import { ReportPagination } from "@/components/ReportPagination";
import { useAuthStore } from "@/store/authStore";

export function PaginatedAnalysisReports() {
  const userId = useAuthStore(state => state.user?.public_id);
  const [type, setType] = useState("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: AccountReport[]; total: number }>({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(null);
    void meService.getReports(10, (page - 1) * 10, type === "all" ? undefined : type)
      .then(response => {
        if (!active) return;
        const lastPage = Math.max(1, Math.ceil(response.total / 10));
        if (page > lastPage) { setPage(lastPage); return; }
        setData({ items: response.items.map(normalizeReport).filter((r): r is AccountReport => r !== null), total: response.total });
      }).catch(e => { if (active) setError(e instanceof Error ? e.message : "Unable to load reports."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, type, userId, retry]);
  return <>
    <h1 className="text-2xl font-semibold sm:text-3xl">Analysis reports</h1>
    <p className="text-sm text-white/65">All saved reports, 10 per page.</p>
    <label className="flex flex-wrap items-center gap-3 text-sm">Analysis type
      <select value={type} onChange={e => { setType(e.target.value); setPage(1); }} className="min-h-11 rounded-lg border border-white/20 bg-[#10141b] px-3">
        <option value="all">All types</option><option value="shooting">Shooting</option><option value="dribbling">Dribbling</option><option value="training">Training</option>
      </select>
    </label>
    {loading ? <p role="status">Loading reports…</p> : error ? <div role="alert">{error} <button onClick={() => setRetry(n => n + 1)}>Retry</button></div> : <>
      {data.items.length ? <RecentReportsSection reports={data.items} source="live" /> : <p>No saved reports match this filter.</p>}
      <ReportPagination key={`${type}-${page}`} page={page} total={data.total} onChange={setPage} />
    </>}
  </>;
}
