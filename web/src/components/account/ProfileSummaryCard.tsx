"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarDays, Mail, Phone, ShieldCheck, Target } from "lucide-react";

import { usePlayerCopy } from "@/components/account/playerCopy";
import { routes } from "@/lib/routes";
import type { AuthUser } from "@/types/auth";

import { LogoutButton } from "./LogoutButton";
import styles from "./PlayerProfile.module.css";
import type { AccountReport, ReportSource } from "./types";

type ProfileSummaryCardProps = {
  user: AuthUser;
  latestReport: AccountReport | null;
  reportSource: ReportSource;
  joinedLabel: string;
  displayName: string;
};

function getAvatarFallback(user: AuthUser, displayName: string): string {
  const source = user.nickname?.trim() || displayName.trim() || user.username;
  return source.split(/\s+/).slice(0, 2).map((part) => Array.from(part)[0]?.toUpperCase()).join("");
}

export function ProfileSummaryCard({
  user,
  latestReport,
  reportSource,
  joinedLabel,
  displayName,
}: ProfileSummaryCardProps) {
  const { t, isChinese } = usePlayerCopy();
  const primaryHref = latestReport?.linkable
    ? `${routes.pose2d.report}?id=${latestReport.id}`
    : routes.pose2d.shooting;
  const primaryLabel = latestReport?.linkable ? t("Open Latest Report") : t("Continue Training");

  return (
    <section className={styles.summary} aria-labelledby="profile-display-name">
      <div className={styles.topRow}>
        <div className={styles.identity}>
          <div className={styles.avatar} aria-hidden="true">
            {user.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : getAvatarFallback(user, displayName)}
          </div>
          <div className="min-w-0">
            <h2 id="profile-display-name" className={styles.name}>{displayName}</h2>
            <p className={styles.handle}>@{user.username}</p>
            <div className={styles.badges}>
              <span className={styles.badge} data-active={user.is_active || undefined}>
                {user.is_active ? t("Active account") : t("Inactive")}
              </span>
              <span className={styles.badge}>{reportSource === "live" ? t("Live history") : t("Preview metrics")}</span>
            </div>
          </div>
        </div>
        <div className={styles.actions}>
          <Link href={primaryHref} className={styles.primary}>
            {primaryLabel}<ArrowUpRight aria-hidden="true" size={16} />
          </Link>
          <LogoutButton className={styles.secondary} />
        </div>
      </div>
      <ul className={styles.details}>
        <li><Mail aria-hidden="true" /><span>{user.email ?? t("Email not added yet")}</span></li>
        <li><Phone aria-hidden="true" /><span>{user.phone_number || t("Phone not added yet")}</span></li>
        <li><ShieldCheck aria-hidden="true" /><span>{user.is_active ? t("Verified training account") : t("Account pending")}</span></li>
        <li><CalendarDays aria-hidden="true" /><span>{joinedLabel}</span></li>
      </ul>
      <div className={styles.focus}>
        <Target className={styles.focusIcon} size={18} aria-hidden="true" />
        <div className={styles.focusBody}>
          <h3>{t("Current focus")}</h3>
          <p>
            {latestReport
              ? (isChinese ? `最近的${t(latestReport.analysisType)}报告得分为 ${Math.round(latestReport.score)}，可以重新查看。` : `Latest ${latestReport.analysisType} report scored ${Math.round(latestReport.score)} and is ready to reopen.`)
              : t("Start your next session from the shooting workspace and the center will update from there.")}
          </p>
        </div>
        {latestReport && <span className={styles.grade}>{t("Grade")} {latestReport.grade}</span>}
      </div>
    </section>
  );
}
