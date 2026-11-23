"use client";

import { usePoseCopy } from "@/components/Pose2D/poseCopy";
import Link from "next/link";
import type { ReactNode } from "react";

import { AccountEntryButton } from "@/components/account/AccountEntryButton";
import { ThemeToggle } from "@/components/navigation/ThemeToggle";
import type { ActionTemplate } from "@/config/templates";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

type AnalysisMode = ActionTemplate["mode"];

const modeConfig = {
  shooting: {
    titleLead: "Build a cleaner",
    titleAccent: "release motion",
    description: "Choose a shooting template and see how to film your form before uploading.",
    accentText: "text-[var(--ui-chart-teal)]",
    accentButton: "border-sky-300/30 bg-sky-300 text-slate-950 hover:bg-sky-200",
  },
  dribbling: {
    titleLead: "Sharpen your",
    titleAccent: "ball control",
    description: "Choose a dribbling template and check the camera angle and ball path before uploading.",
    accentText: "text-[var(--ui-chart-violet)]",
    accentButton: "border-fuchsia-300/30 bg-fuchsia-300 text-slate-950 hover:bg-fuchsia-200",
  },
  training: {
    titleLead: "Practice a",
    titleAccent: "movement",
    description: "Choose an exercise, check how to film it, and upload your clip for feedback on your technique.",
    accentText: "text-[var(--ui-chart-green)]",
    accentButton: "border-emerald-300/30 bg-emerald-300 text-slate-950 hover:bg-emerald-200",
  },
} satisfies Record<AnalysisMode, {
  titleLead: string;
  titleAccent: string;
  description: string;
  accentText: string;
  accentButton: string;
}>;

const navItems = [
  { key: "shooting", href: routes.pose2d.shooting, label: "Shooting" },
  { key: "dribbling", href: routes.pose2d.dribbling, label: "Dribbling" },
  { key: "training", href: routes.pose2d.training, label: "Training" },
] as const;

const navLinkClass = "inline-flex min-h-11 items-center justify-center rounded-full border px-4 py-2 text-sm font-medium transition-colors sm:px-5";
const idleLinkClass = "border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--ui-text)] hover:border-[var(--ui-accent)] hover:bg-[var(--ui-subtle)]";

export default function PoseWorkspaceShell({ mode, hasUpload, movementPreview, children }: {
  mode: AnalysisMode;
  hasUpload: boolean;
  movementPreview?: ReactNode;
  children: ReactNode;
}) {
  const { t } = usePoseCopy();
  const config = modeConfig[mode];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07080b] text-white">
      <div className="workspace-dark-decoration pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_58%)]" />
      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <section className="analysis-surface space-y-5 rounded-[30px] border border-white/10 p-4 sm:p-6 lg:p-8">
          <div>
            <p className="font-[var(--font-display)] text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-[var(--ui-muted)]">{t("AI Hoops Motion Studio")}</p>
            <nav aria-label={t("Motion studio")} className="mt-3 flex flex-wrap gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={item.key === mode ? "page" : undefined}
                  className={cn(navLinkClass, item.key === mode ? config.accentButton : idleLinkClass)}
                >
                  {t(item.label)}
                </Link>
              ))}
              <Link href={routes.pose2d.report} className={cn(navLinkClass, idleLinkClass)}>{t("Report")}</Link>
              <AccountEntryButton className={cn(idleLinkClass, "hover:text-[var(--ui-text)]")} />
              <ThemeToggle />
            </nav>
          </div>
          <div>
            <h1 className="font-[var(--font-display)] text-[clamp(2.3rem,6vw,4.5rem)] font-bold leading-tight tracking-[-0.06em]">
              {t(config.titleLead)}{" "}
              <span className={config.accentText}>{t(config.titleAccent)}</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--ui-muted)] sm:text-base">{t(config.description)}</p>
          </div>
        </section>

        {movementPreview}

        <section aria-label={t(hasUpload ? "Analysis session" : "Choose and upload")} className="analysis-surface rounded-[28px] border border-white/10 p-4 sm:p-6">
          {hasUpload && <h2 className="mb-4 text-xl font-semibold sm:text-2xl">{t("Analysis session")}</h2>}
          {children}
        </section>
      </div>
    </main>
  );
}
