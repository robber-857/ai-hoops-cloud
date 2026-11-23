import Link from "next/link";
import {
  ArrowUpRight, BookOpen, CalendarDays, ChevronDown, CircleCheck,
  ClipboardList, Clock3, Dumbbell, Flame, GraduationCap, MessageSquareText, Ruler, UserRound,
} from "lucide-react";
import type { ClassReport, DailyExerciseEnergy, ExerciseEnergy } from "@/services/classReports";
import { measurementBmi } from "@/lib/profile";
import styles from "./ClassRecord.module.css";

export const attendanceLabels: Record<ClassReport["attendance"], string> = {
  present: "Full attendance",
  absent: "Absent",
  left_early: "Left early",
  partial: "Partial participation",
};

const methods: Record<string, string> = {
  youth_mety: "Children’s activity reference",
  youth_analogy: "Approximate match to a children’s activity reference",
  generic_met_approximation: "General activity estimate · approximation",
};

export function ExerciseEnergySummary({ energy }: { energy?: ExerciseEnergy | DailyExerciseEnergy }) {
  if (!energy) {
    return <p className={styles.muted}>This publication did not include an energy estimate. Its recorded training remains available.</p>;
  }
  if (energy.status === "not_applicable") {
    return <p className={styles.muted}>No exercise energy estimate applies to this attendance record.</p>;
  }

  const missingReports = "missing_reports" in energy;
  const missing = missingReports ? energy.missing_reports : energy.missing_items;
  const missingUnit = missingReports ? (missing === 1 ? "class record" : "class records") : (missing === 1 ? "activity" : "activities");

  return <div className="space-y-3">
    {energy.status === "complete" && energy.total_kcal !== null ? (
      <p className={styles.energyValue}>≈ {energy.total_kcal} kcal</p>
    ) : energy.status === "partial" && energy.known_subtotal_kcal !== null ? (
      <>
        <p className={styles.energyValue}>Known subtotal ≈ {energy.known_subtotal_kcal} kcal</p>
        <p className={styles.notice}>{missing} {missingUnit} without a complete estimate.</p>
      </>
    ) : (
      <p className={styles.notice}>Energy estimate unavailable. Training minutes are still recorded.</p>
    )}
    <p className={styles.muted}>
      Estimated energy during the recorded training time, including resting energy
      during those minutes. Actual expenditure varies by player and participation.
    </p>
    {energy.methods.length > 0 && (
      <ul className={styles.methodList}>
        {energy.methods.map(method => <li key={method}>{methods[method] || "Activity estimate"}</li>)}
      </ul>
    )}
  </div>;
}

export function FoodRecoveryReference({ title = "Food and recovery reference" }: { title?: string }) {
  return <section className={`${styles.panel} ${styles.reference}`}>
    <div>
      <h3 className={styles.sectionTitle}><BookOpen aria-hidden="true" />{title}</h3>
      <p className={styles.muted}>Compare carbohydrate, protein and fat per 100 g of edible food in its listed preparation state.</p>
    </div>
    <Link href="/foods" className="ui-link">View food nutrition per 100 g <ArrowUpRight size={16} aria-hidden="true" /></Link>
  </section>;
}

function participationPercent(minutes: number, classMinutes: number) {
  return Number.isFinite(minutes) && Number.isFinite(classMinutes) && classMinutes > 0 && minutes >= 0 && minutes <= classMinutes + 0.00001
    ? Math.min(100, 100 * minutes / classMinutes)
    : null;
}

export function ClassReportDetails({ report }: { report: ClassReport }) {
  const { profile, items, exercise_energy: energy } = report;
  const absent = report.attendance === "absent";
  const classMinutes = items.reduce((total, item) => total + Number.parseFloat(item.actual_minutes), 0);
  const participation = absent ? null : participationPercent(Number.parseFloat(report.total_minutes), classMinutes);
  const bmi = profile && measurementBmi(profile);

  return <article className={styles.record}>
    <header className={styles.overview}>
      <div className="min-w-0">
        <p className={styles.className}><GraduationCap size={18} aria-hidden="true" />{report.class_name}</p>
        <h2 className={styles.lessonTitle}>{report.title}</h2>
        <div className={styles.metadata}>
          <span><UserRound aria-hidden="true" />{report.student_name}</span>
          <span><CalendarDays aria-hidden="true" /><time dateTime={report.held_on}>{report.held_on}</time> · {report.timezone}</span>
          <span>Lesson v{report.lesson_version}</span>
        </div>
      </div>
      <div className={styles.participation}>
        {participation !== null && (
          <span aria-hidden="true" className={styles.ring} style={{ backgroundImage: `conic-gradient(var(--ui-chart-green) ${participation}%, var(--ui-border) 0)` }}>
            <span>{Math.round(participation)}%</span>
          </span>
        )}
        <div>
          <p className={styles.duration}><strong>{report.total_minutes}</strong> recorded minutes</p>
          <p className={styles.attendance}>
            {report.attendance === "present" ? <CircleCheck size={15} aria-hidden="true" /> : <Clock3 size={15} aria-hidden="true" />}
            {attendanceLabels[report.attendance]}
          </p>
          {participation !== null && <p className={styles.ringCaption}>{Math.round(participation)}% of class minutes</p>}
        </div>
      </div>
    </header>

    {report.is_latest === false && <p className={styles.notice}>Historical version. A newer published record is available in Class reports.</p>}

    <div className={styles.columns}>
      <div className={styles.stack}>
        <section className={styles.panel}>
          <h3 className={styles.sectionTitle}><Dumbbell aria-hidden="true" />What you trained</h3>
          {absent ? <p className={styles.muted}>Attendance record only. No exercise expenditure report is generated for this absence.</p> : (
            <ul className={styles.activityList}>{items.map((item, index) => {
              const percent = participationPercent(Number.parseFloat(item.minutes), Number.parseFloat(item.actual_minutes));
              return <li key={index}>
                <div className={styles.rowTitle}><h4>{item.name}</h4>{item.intensity && <span className={styles.tag}>{item.intensity} intensity</span>}</div>
                <p className={styles.activityMinutes}>{item.minutes} minutes participated <span>/ {item.actual_minutes} class minutes</span></p>
                {percent !== null && <div className={styles.track} aria-hidden="true"><span style={{ width: `${percent}%` }} /></div>}
                {item.notes && <p className={styles.itemNote}>{item.notes}</p>}
              </li>;
            })}</ul>
          )}
        </section>

        {(report.lesson_notes || report.notes) && (
          <section className={styles.panel}>
            <h3 className={styles.sectionTitle}><MessageSquareText aria-hidden="true" />Lesson notes</h3>
            <dl className={styles.notes}>
              {report.lesson_notes && <div><dt>Class note</dt><dd>{report.lesson_notes}</dd></div>}
              {report.notes && <div><dt>Player note</dt><dd>{report.notes}</dd></div>}
            </dl>
          </section>
        )}

        <section className={styles.panel}>
          <h3 className={styles.sectionTitle}><Ruler aria-hidden="true" />Measurements saved with this publication</h3>
          {profile ? (
            <>
              <p className={styles.muted}>Measured <time dateTime={profile.measured_on}>{profile.measured_on}</time></p>
              <dl className={styles.measurements}>
                <div><dt>Height</dt><dd>{profile.height_cm} <small>cm</small></dd></div>
                <div><dt>Weight</dt><dd>{profile.weight_kg} <small>kg</small></dd></div>
                <div><dt>BMI</dt><dd>{bmi ?? "Unavailable"} {bmi && <small>kg/m²</small>}</dd></div>
              </dl>
            </>
          ) : <p className={styles.muted}>No measurements were available on or before this lesson date. The training record can still be viewed.</p>}
        </section>
      </div>

      <div className={styles.stack}>
        {!absent && (
          <section className={styles.panel}>
            <h3 className={styles.sectionTitle}><Flame aria-hidden="true" />Training energy estimate</h3>
            <ExerciseEnergySummary energy={energy} />
            {energy && energy.items.length > 0 && (
              <details className={styles.sources}>
                <summary><ClipboardList size={17} aria-hidden="true" />Activity estimates and sources <ChevronDown size={16} aria-hidden="true" /></summary>
                <ul>{energy.items.map((item, index) => (
                  <li key={index}>
                    <div className={styles.rowTitle}>
                      <h4>{items[index]?.name || "Recorded activity"}</h4>
                      <span>{item.gross_kcal !== null ? `≈ ${item.gross_kcal} kcal` : "Not estimated"}</span>
                    </div>
                    {item.method && <p>{methods[item.method] || "Activity estimate"}</p>}
                    {item.reason && <p>{item.reason}</p>}
                    {item.source && (
                      <>
                        <p>{item.source.description}{item.source.age_group && ` · Age group ${item.source.age_group}`}</p>
                        <a href={item.source.url} target="_blank" rel="noreferrer" className="ui-link">{item.source.title}<ArrowUpRight size={15} aria-hidden="true" /></a>
                      </>
                    )}
                  </li>
                ))}</ul>
              </details>
            )}
          </section>
        )}
        <FoodRecoveryReference />
      </div>
    </div>
  </article>;
}
