"use client";

import { usePoseCopy } from "@/components/Pose2D/poseCopy";
import { Crosshair, Gauge, PersonStanding, Repeat2, type LucideIcon } from "lucide-react";
import { getGrade, type Grade, type ScoreResult } from "@/lib/scoring";
import styles from "./ReportScoreSummary.module.css";

const categories = ["posture", "execution", "consistency"] as const;
const titles = { posture: "Posture", execution: "Execution", consistency: "Consistency" };
const icons = { posture: PersonStanding, execution: Crosshair, consistency: Repeat2 };

interface ScoreCardProps {
  title: string;
  icon: LucideIcon;
  score: number;
  grade: Grade;
  available: boolean;
  overall?: boolean;
  weightShare?: number;
}

function ScoreCard({ title, icon: Icon, score, grade, available, overall, weightShare }: ScoreCardProps) {
  const { t } = usePoseCopy();
  const meterValue = Math.max(0, Math.min(100, score));
  return (
    <article
      className={styles.card}
      data-grade={available ? grade : undefined}
      data-overall={overall || undefined}
    >
      <div className={styles.header}>
        <h3 className={styles.title}><Icon aria-hidden="true" />{t(title)}</h3>
        {available && (
          <span className={styles.grade}>
            <span className={styles.gradeLabel}>{t("Grade")} </span><b>{grade}</b>
            {overall && (
              <svg aria-hidden="true" viewBox="0 0 64 64" className={styles.dial}>
                <circle cx="32" cy="32" r="27" />
                <circle
                  cx="32" cy="32" r="27" pathLength="100" strokeDasharray="100"
                  strokeDashoffset={100 - meterValue} transform="rotate(-90 32 32)"
                  className={styles.dialFill}
                />
              </svg>
            )}
          </span>
        )}
      </div>
      {available ? (
        <>
          <div className={styles.scoreLine}>
            <span className={styles.value}>{Math.round(score)}</span>
            <span className={styles.unit}> / 100</span>
          </div>
          <div aria-hidden="true" className={styles.track}>
            <div
              className={styles.fill}
              style={{ width: `${meterValue}%` }}
            />
          </div>
          {(overall || weightShare !== undefined) && (
            <p className={styles.caption}>
              {t(overall ? "Weighted score" : `${weightShare}% weight`)}
            </p>
          )}
        </>
      ) : (
        <div className={styles.missing}>
          <p className="text-2xl leading-none font-semibold">{t("N/A")}</p>
          <p className={styles.caption}>{t("More movement samples needed.")}</p>
        </div>
      )}
    </article>
  );
}

export function ReportScoreSummary({ result }: { result: ScoreResult }) {
  const { t } = usePoseCopy();
  // Older reports store relative weights (e.g. 1/1/1), current reports may store shares.
  const weightTotal = categories.reduce((sum, key) => sum + (result.weights?.[key] ?? 0), 0);

  return (
    <section data-score-summary aria-label={t("Score summary")} className={styles.summary}>
      <ScoreCard
        title={t("Overall")}
        icon={Gauge}
        score={result.overall}
        grade={result.grade}
        available={result.analysisStatus !== "insufficient_data" && Number.isFinite(result.overall)}
        overall
      />
      {categories.map((key) => {
        const score = result.breakdown[key];
        const weight = result.weights?.[key];
        return (
          <ScoreCard
            key={key}
            title={titles[key]}
            icon={icons[key]}
            score={score}
            grade={getGrade(score)}
            available={result.availability?.[key] !== false && Number.isFinite(score)}
            weightShare={weight !== undefined && weightTotal > 0 ? Math.round(weight / weightTotal * 100) : undefined}
          />
        );
      })}
    </section>
  );
}
