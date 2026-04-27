import Link from "next/link";
import { ArrowUpRight, Dot } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

import type { AccountAnalysisType, AccountReport, ReportSource } from "./types";

type RecentReportsSectionProps = {
  reports: AccountReport[];
  source: ReportSource;
  isLoading?: boolean;
};

const toneMap: Record<AccountAnalysisType, string> = {
  shooting: "text-[#d8ff5d]",
  dribbling: "text-sky-300",
  training: "text-emerald-300",
};

const badgeMap: Record<AccountAnalysisType, string> = {
  shooting: "border-[#d8ff5d]/20 bg-[#d8ff5d]/12 text-[#e8ff9a]",
  dribbling: "border-sky-300/20 bg-sky-300/12 text-sky-100",
  training: "border-emerald-300/20 bg-emerald-400/12 text-emerald-100",
};

function formatDateLabel(createdAt: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(createdAt));
}

export function RecentReportsSection({
  reports,
  source,
  isLoading = false,
}: RecentReportsSectionProps) {
  return (
    <section className="analysis-surface rounded-[32px] border border-white/10 p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[0.72rem] uppercase tracking-[0.28em] text-white/42">
            Recent reports
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-white">
            Your latest analysis snapshots
          </h2>
        </div>
        <Badge
          variant="outline"
          className="border-white/12 bg-white/[0.03] text-white/62"
        >
          {source === "live" ? "Report history" : "Preview table"}
        </Badge>
      </div>

      {isLoading ? (
        <div className="mt-6 grid gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-16 animate-pulse rounded-[20px] border border-white/8 bg-white/[0.04]"
            />
          ))}
        </div>
      ) : (
        <>
          <div className="mt-6 hidden overflow-hidden rounded-[28px] border border-white/10 lg:block">
            <table className="min-w-full divide-y divide-white/8">
              <thead className="bg-white/[0.03]">
                <tr className="text-left text-[0.72rem] uppercase tracking-[0.24em] text-white/42">
                  <th className="px-5 py-4 font-medium">Analysis type</th>
                  <th className="px-5 py-4 font-medium">Template</th>
                  <th className="px-5 py-4 font-medium">Score</th>
                  <th className="px-5 py-4 font-medium">Grade</th>
                  <th className="px-5 py-4 font-medium">Date</th>
                  <th className="px-5 py-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6">
                {reports.map((report) => (
                  <tr key={report.id} className="bg-white/[0.01] text-sm text-white/78">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Dot className={cn("h-5 w-5", toneMap[report.analysisType])} />
                        <span className="capitalize">{report.analysisType}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-white/56">{report.templateName}</td>
                    <td className="px-5 py-4 text-lg font-semibold text-white">
                      {Math.round(report.score)}
                    </td>
                    <td className="px-5 py-4">
                      <Badge className={cn("border", badgeMap[report.analysisType])}>
                        {report.grade}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-white/48">{formatDateLabel(report.createdAt)}</td>
                    <td className="px-5 py-4 text-right">
                      {report.linkable ? (
                        <Link
                          href={`${routes.pose2d.report}?id=${report.id}`}
                          className="inline-flex items-center gap-1 text-sm font-medium text-[#d8ff5d] hover:text-[#eeffaf]"
                        >
                          Open
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      ) : (
                        <span className="text-white/34">Preview only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 grid gap-3 lg:hidden">
            {reports.map((report) => (
              <article
                key={report.id}
                className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Dot className={cn("h-5 w-5", toneMap[report.analysisType])} />
                      <span className="capitalize text-white">{report.analysisType}</span>
                    </div>
                    <div className="mt-2 text-sm text-white/52">{report.templateName}</div>
                  </div>
                  <Badge className={cn("border", badgeMap[report.analysisType])}>
                    {report.grade}
                  </Badge>
                </div>

                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <div className="text-2xl font-semibold tracking-[-0.04em] text-white">
                      {Math.round(report.score)}
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-[0.22em] text-white/36">
                      {formatDateLabel(report.createdAt)}
                    </div>
                  </div>

                  {report.linkable ? (
                    <Link
                      href={`${routes.pose2d.report}?id=${report.id}`}
                      className="inline-flex items-center gap-1 text-sm font-medium text-[#d8ff5d]"
                    >
                      Open
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <span className="text-sm text-white/34">Preview only</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
