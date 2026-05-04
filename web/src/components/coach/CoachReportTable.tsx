import Link from "next/link";
import { Eye, FileSearch, Gauge } from "lucide-react";

import {
  analysisTypeLabels,
  formatDateTime,
  formatScore,
  getTemplateDisplayName,
} from "@/components/coach/coachUtils";
import { routes } from "@/lib/routes";
import type { CoachClassReportRead } from "@/services/coach";

type CoachReportTableProps = {
  reports: CoachClassReportRead[];
  returnTo?: string;
};

function reportHref(reportPublicId: string, returnTo?: string) {
  const params = new URLSearchParams({ id: reportPublicId });
  if (returnTo) {
    params.set("returnTo", returnTo);
  }
  return `${routes.pose2d.report}?${params.toString()}`;
}

export function CoachReportTable({ reports, returnTo }: CoachReportTableProps) {
  if (reports.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-black/18 p-8 text-center">
        <FileSearch className="mx-auto h-8 w-8 text-[#65f7ff]/70" />
        <div className="mt-4 font-[var(--font-display)] text-lg font-semibold text-white">
          No reports have been submitted for this class yet.
        </div>
        <p className="mt-2 text-sm text-white/52">
          Completed student analysis reports will stream into this table.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-black/18">
      <div className="overflow-x-auto">
        <table className="min-w-[860px] w-full border-collapse text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.035] text-[0.68rem] uppercase tracking-[0.18em] text-white/42">
            <tr>
              <th className="px-4 py-3 font-semibold">Student</th>
              <th className="px-4 py-3 font-semibold">Motion</th>
              <th className="px-4 py-3 font-semibold">Template</th>
              <th className="px-4 py-3 text-right font-semibold">Score</th>
              <th className="px-4 py-3 font-semibold">Created</th>
              <th className="px-4 py-3 text-right font-semibold">Report</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8">
            {reports.map((report) => (
              <tr
                key={report.public_id}
                className="transition-colors hover:bg-[#65f7ff]/[0.055]"
              >
                <td className="px-4 py-4 font-semibold text-white">{report.student_name}</td>
                <td className="px-4 py-4">
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#65f7ff]/24 bg-[#65f7ff]/10 px-2.5 py-1 text-[0.72rem] font-semibold text-[#dffbff]">
                    <Gauge className="h-3.5 w-3.5" />
                    {analysisTypeLabels[report.analysis_type] ?? report.analysis_type}
                  </span>
                </td>
                <td className="px-4 py-4 text-white/62">
                  <div className="max-w-[16rem] truncate">
                    {getTemplateDisplayName(report.template_code)}
                  </div>
                </td>
                <td className="px-4 py-4 text-right">
                  <span className="font-[var(--font-display)] text-xl font-bold text-[#d8ff5d]">
                    {formatScore(report.overall_score)}
                  </span>
                  <span className="ml-2 text-xs font-semibold text-white/42">
                    {report.grade ?? "--"}
                  </span>
                </td>
                <td className="px-4 py-4 text-white/62">{formatDateTime(report.created_at)}</td>
                <td className="px-4 py-4 text-right">
                  <Link
                    href={reportHref(report.public_id, returnTo)}
                    className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3 text-xs font-semibold text-white/78 transition hover:border-[#d8ff5d]/32 hover:bg-[#d8ff5d]/10 hover:text-[#f1ffc1]"
                  >
                    <Eye className="h-4 w-4" />
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
