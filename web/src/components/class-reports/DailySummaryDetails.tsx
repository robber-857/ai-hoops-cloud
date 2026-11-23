"use client";
import { usePlayerCopy } from "@/components/account/playerCopy";
import Link from "next/link";
import { Activity, ArrowUpRight, CalendarDays, Flame } from "lucide-react";
import type { DailyClassSummary } from "@/services/classReports";
import { attendanceLabels, ExerciseEnergySummary, FoodRecoveryReference } from "./ClassReportDetails";
import styles from "./ClassRecord.module.css";

export function DailySummaryDetails({ summary }: { summary: DailyClassSummary }) {
  const { t } = usePlayerCopy();
  if (!summary.published_lessons) return <div className="space-y-4">
    <p className="ui-panel p-5 text-sm">{t("No published class records for this date. This does not mean you had no physical activity.")}</p>
    <FoodRecoveryReference />
  </div>;

  return <div className={styles.record}>
    <section className={styles.panel}>
      <h2 className={styles.sectionTitle}><CalendarDays aria-hidden="true" /><time dateTime={summary.held_on}>{summary.held_on}</time> · {summary.timezone}</h2>
      <dl className={styles.dailyMetrics}>
        {[
          [t("Published lessons"), summary.published_lessons],
          [t("Attended lessons"), summary.attended_lessons],
          [t("Absent lessons"), summary.absent_lessons],
          [t("Participation minutes"), summary.total_minutes],
        ].map(([label, value]) => <div key={label}><dt className={styles.muted}>{label}</dt><dd>{value}</dd></div>)}
      </dl>
    </section>
    <div className={styles.columns}>
      <section className={styles.panel}>
        <h3 className={styles.sectionTitle}><Activity aria-hidden="true" />{t("1. What you trained")}</h3>
        <ul className={styles.activityList}>{summary.reports.map(report => (
          <li key={report.public_id}>
            <Link className="ui-link break-words" href={`/me/class-reports/${encodeURIComponent(report.public_id)}`}>{report.title}<ArrowUpRight size={15} aria-hidden="true" /></Link>
            <p className={styles.muted}>{report.class_name} · {report.total_minutes} {t("minutes ·")} {t(attendanceLabels[report.attendance])} {t("· Lesson v")}{report.lesson_version}</p>
            {report.attendance !== "absent" && <ul className="mt-2 space-y-1 text-sm">
              {report.items.map((item, index) => <li key={index}>{item.name} · {item.minutes} {t("minutes")}{item.intensity ? ` · ${t(item.intensity)} ${t("intensity")}` : ""}</li>)}
            </ul>}
          </li>
        ))}</ul>
        <p className={`mt-4 ${styles.muted}`}>{t("Minutes use your participation in each lesson. Overlapping lesson times are not detected.")}</p>
      </section>
      <div className={styles.stack}>
        <section className={styles.panel}>
          <h3 className={styles.sectionTitle}><Flame aria-hidden="true" />{t("2. Training energy estimate")}</h3>
          <ExerciseEnergySummary energy={summary.exercise_energy} />
          <p className={`mt-4 ${styles.muted}`}>{t("Open a class record to view its activity estimates and sources.")}</p>
        </section>
        <FoodRecoveryReference title={t("3. Food nutrition reference")} />
      </div>
    </div>
  </div>;
}
