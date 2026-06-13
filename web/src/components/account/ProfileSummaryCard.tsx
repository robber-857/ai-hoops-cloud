import Link from "next/link";
import { CalendarDays, Mail, Phone, ShieldCheck, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { routes } from "@/lib/routes";
import type { AuthUser } from "@/types/auth";

import { LogoutButton } from "./LogoutButton";
import type { AccountReport, ReportSource } from "./types";

type ProfileSummaryCardProps = {
  user: AuthUser;
  latestReport: AccountReport | null;
  reportSource: ReportSource;
  joinedLabel: string;
  displayName: string;
};

function getAvatarFallback(user: AuthUser, displayName: string): string {
  const source = user.nickname?.trim() || displayName.trim();
  const parts = source.split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) {
    return user.username.slice(0, 1).toUpperCase();
  }

  return parts.map((part) => part.slice(0, 1).toUpperCase()).join("");
}

export function ProfileSummaryCard({
  user,
  latestReport,
  reportSource,
  joinedLabel,
  displayName,
}: ProfileSummaryCardProps) {
  const avatarFallback = getAvatarFallback(user, displayName);
  const primaryHref =
    latestReport?.linkable
      ? `${routes.pose2d.report}?id=${latestReport.id}`
      : routes.pose2d.shooting;
  const primaryLabel = latestReport?.linkable ? "Open Latest Report" : "Continue Training";

  return (
    <section className="analysis-surface relative min-w-0 overflow-hidden rounded-[28px] border border-white/10 p-4 sm:rounded-[32px] sm:p-7 lg:p-8">
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[36%] bg-[radial-gradient(circle_at_center,rgba(216,255,93,0.12),transparent_72%)]" />
      <div className="pointer-events-none absolute left-0 top-0 h-24 w-24 rounded-full bg-[#d8ff5d]/8 blur-3xl" />

      <div className="relative flex min-w-0 flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#d8ff5d]/35 bg-[linear-gradient(145deg,rgba(216,255,93,0.16),rgba(255,255,255,0.04))] text-xl font-semibold text-[#e8ff9a] shadow-[0_18px_45px_rgba(0,0,0,0.28)] sm:h-28 sm:w-28 sm:text-2xl">
            {user.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatar_url}
                alt={displayName}
                className="h-full w-full object-cover"
              />
            ) : (
              avatarFallback
            )}
          </div>

          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Badge className="max-w-full border border-[#d8ff5d]/25 bg-[#d8ff5d]/12 text-[#e8ff9a]">
                {user.is_active ? "Active account" : "Inactive"}
              </Badge>
              <Badge
                variant="outline"
                className="max-w-full border-white/12 bg-white/[0.03] text-white/62"
              >
                {reportSource === "live" ? "Live history" : "Preview metrics"}
              </Badge>
            </div>

            <h1 className="mt-4 break-words text-2xl font-semibold text-white sm:text-4xl">
              {displayName}
            </h1>
            <p className="mt-1 break-words text-sm text-white/55 sm:text-base">@{user.username}</p>

            <div className="mt-5 grid gap-3 text-sm text-white/70 sm:grid-cols-2">
              <div className="flex min-w-0 items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-[#d8ff5d]" />
                <span className="min-w-0 truncate">{user.email ?? "Email not added yet"}</span>
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-[#d8ff5d]" />
                <span className="min-w-0 truncate">{user.phone_number || "Phone not added yet"}</span>
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-[#d8ff5d]" />
                <span className="min-w-0 truncate">
                  {user.is_active ? "Verified training account" : "Account pending"}
                </span>
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <CalendarDays className="h-4 w-4 shrink-0 text-[#d8ff5d]" />
                <span className="min-w-0 truncate">{joinedLabel}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-stretch">
          <Button
            asChild
            className="min-h-11 w-full justify-center rounded-full border border-[#d8ff5d]/20 bg-[#d8ff5d] px-5 text-[#10140a] shadow-[0_18px_45px_rgba(0,0,0,0.24)] hover:bg-[#e6ff9d] sm:w-auto"
          >
            <Link href={primaryHref}>
              <Sparkles className="h-4 w-4" />
              {primaryLabel}
            </Link>
          </Button>
          <LogoutButton className="min-h-11 w-full rounded-full px-5 sm:w-auto" />
        </div>
      </div>

      <div className="relative mt-6 min-w-0 rounded-[22px] border border-white/10 bg-black/25 p-4 backdrop-blur-md sm:rounded-[24px]">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-[0.66rem] uppercase tracking-[0.18em] text-white/40 sm:text-[0.68rem] sm:tracking-[0.26em]">
              Current focus
            </div>
            <div className="mt-2 break-words text-sm leading-6 text-white/78">
              {latestReport
                ? `Latest ${latestReport.analysisType} report scored ${Math.round(
                    latestReport.score
                  )} and is ready to reopen.`
                : "Start your next session from the shooting workspace and the center will update from there."}
            </div>
          </div>
          {latestReport && (
            <div className="w-fit shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[0.7rem] uppercase tracking-[0.16em] text-white/56 sm:tracking-[0.24em]">
              Grade {latestReport.grade}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
