"use client";

import { usePoseCopy } from "@/components/Pose2D/poseCopy";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { Finding } from "@/lib/scoring";

function getFindingStatus(finding: Finding) {
  if (finding.isMissing) return { tone: "caution", label: "N/A" };
  const tone = finding.isPositive ? "positive" : finding.score < 60 ? "critical" : "caution";
  if (finding.state === "low") return { tone, label: "Try More" };
  if (finding.state === "high") return { tone, label: "Reduce" };
  if (finding.isPositive) return { tone, label: "Stable" };
  return { tone, label: finding.score < 60 ? "Needs Work" : "Watch" };
}

export function ReportFindingItem({ finding }: { finding: Finding }) {
  const { t } = usePoseCopy();
  const { tone, label } = getFindingStatus(finding);
  const Icon = tone === "positive" ? CheckCircle2 : AlertCircle;
  return (
    <li className="report-finding" data-tone={tone}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="min-w-0 break-words text-sm font-semibold leading-5">{t(finding.title)}</h3>
        {!finding.isMissing && (
          <span className="shrink-0 text-sm font-bold tabular-nums">
            {finding.score} <span className="report-secondary text-xs font-medium">{t("pts")}</span>
          </span>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="report-finding-state">
          <Icon size={13} aria-hidden="true" />{t(label)}
        </span>
        <span className="report-secondary text-xs capitalize">{t(finding.category)}</span>
      </div>
      {(finding.actualValue || finding.targetText) && (
        <dl className="report-finding-values">
          <div>
            <dt>{t("Actual")}</dt>
            <dd>{t(finding.actualValue || "Not enough data")}</dd>
          </div>
          {finding.targetText && <div><dt>{t("Simple target")}</dt><dd>{t(finding.targetText)}</dd></div>}
        </dl>
      )}
      {finding.hint && <p className="report-secondary mt-2 text-sm leading-5">{t(finding.hint)}</p>}
    </li>
  );
}
