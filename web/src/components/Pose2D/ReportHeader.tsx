"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, ChevronLeft, Link as LinkIcon, Printer } from "lucide-react";

import { AccountEntryButton } from "@/components/account/AccountEntryButton";
import { ThemeToggle } from "@/components/navigation/ThemeToggle";
import "./report-header.css";

type ReportHeaderProps = {
  backHref: string;
  reportId: string | null;
  onShare: () => void;
  copied: boolean;
  shareDisabled: boolean;
};

export function ReportHeader({ backHref, reportId, onShare, copied, shareDisabled }: ReportHeaderProps) {
  const shareLabel = copied ? "Copied" : "Share";

  return (
    <header className="pose-report-header sticky top-0 z-50 border-b">
      <div className="mx-auto grid min-h-14 max-w-7xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 sm:min-h-16 sm:gap-3 sm:px-6 md:grid-cols-[1fr_auto_1fr]">
        <div className="flex min-w-0 items-center gap-2">
          <Link className="pose-report-control" href={backHref} aria-label="Back" title="Back">
            <ChevronLeft size={20} aria-hidden="true" />
          </Link>
          <div className="pose-report-heading sr-only sm:not-sr-only">
            <h1 className="text-sm font-bold leading-tight sm:text-base">Analysis report</h1>
            <p className="pose-report-id mt-0.5 text-xs leading-tight">
              {reportId ? `Report ID: …${reportId.slice(-6)}` : `Generated on ${new Date().toLocaleDateString()}`}
            </p>
          </div>
        </div>

        <div className="pose-report-brand pointer-events-none min-w-0 justify-self-start md:justify-self-center">
          <Image
            src="/logoonreport.png"
            alt="Infinity Sport"
            width={354}
            height={75}
            className="pose-report-brand-dark h-auto w-36 max-w-full sm:w-44"
          />
          <Image
            src="/academy/infinity-logo.png"
            alt="Infinity Sport"
            width={585}
            height={103}
            className="pose-report-brand-light h-auto w-28 max-w-full sm:w-36"
          />
        </div>

        <div className="pose-report-actions flex items-center justify-self-end gap-1 sm:gap-2">
          <ThemeToggle className="pose-report-control" />
          <AccountEntryButton compact className="pose-report-control pose-report-account" />
          {reportId && (
            <button
              type="button"
              className="pose-report-control pose-report-share"
              onClick={onShare}
              disabled={shareDisabled}
              aria-label={shareLabel}
              title={shareLabel}
            >
              {copied ? <Check size={16} aria-hidden="true" /> : <LinkIcon size={16} aria-hidden="true" />}
              <span className="hidden sm:inline">{shareLabel}</span>
            </button>
          )}
          <button
            type="button"
            className="pose-report-control"
            onClick={() => window.print()}
            aria-label="Print or save as PDF"
            title="Print or save as PDF"
          >
            <Printer size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Print</span>
          </button>
        </div>
      </div>
    </header>
  );
}
