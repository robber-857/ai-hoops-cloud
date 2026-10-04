"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { meService } from "@/services/me";
import { playerProfileService } from "@/services/playerProfile";
import { classReportService } from "@/services/classReports";
import { ageYears, measurementBmi, sydneyDateKey, trainingDurationLabel } from "@/lib/profile";
import { ExerciseEnergySummary } from "@/components/class-reports/ClassReportDetails";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Could not load this information.";
}

async function loadProfile() {
  const [profile, measurements] = await Promise.allSettled([
    meService.getProfile(),
    playerProfileService.history(),
  ]);
  return {
    profile: profile.status === "fulfilled" ? profile.value : null,
    measurement: measurements.status === "fulfilled" ? measurements.value.items[0] ?? null : null,
    errors: [
      ...(profile.status === "rejected" ? [errorMessage(profile.reason)] : []),
      ...(measurements.status === "rejected" ? [errorMessage(measurements.reason)] : []),
    ],
    measurementsAvailable: measurements.status === "fulfilled",
  };
}

async function loadToday() {
  const today = sydneyDateKey();
  return { today, summary: await classReportService.daily(today) };
}

function useOwnedResource<T>(userPublicId: string | null, load: () => Promise<T>) {
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{
    owner: string | null;
    loading: boolean;
    data: T | null;
    error: string | null;
  }>({ owner: null, loading: true, data: null, error: null });

  useEffect(() => {
    let active = true;
    setState({ owner: userPublicId, loading: true, data: null, error: null });
    if (!userPublicId) return () => { active = false; };
    load().then((data) => {
      if (active) setState({ owner: userPublicId, loading: false, data, error: null });
    }).catch((error) => {
      if (active) setState({ owner: userPublicId, loading: false, data: null, error: errorMessage(error) });
    });
    return () => { active = false; };
  }, [userPublicId, retry, load]);

  return {
    loading: state.owner !== userPublicId || state.loading,
    data: state.owner === userPublicId ? state.data : null,
    error: state.owner === userPublicId ? state.error : null,
    retry: () => setRetry((value) => value + 1),
  };
}

function ReloadNotice({ message, retry }: { message: string; retry: () => void }) {
  return <div role="alert" className="space-y-2 text-sm text-red-200">
    <p>{message}</p>
    <button type="button" onClick={retry} className="min-h-11 rounded-lg border border-white/25 px-4 text-white">
      Retry
    </button>
  </div>;
}

const cardClass = "min-w-0 space-y-4 rounded-[22px] border border-white/15 bg-[#080d16]/85 p-5";
const linkClass = "inline-flex min-h-11 items-center text-sm text-[#d8ff5d] underline";

export function TrainingNutritionOverview({ userPublicId }: { userPublicId: string | null }) {
  const profile = useOwnedResource(userPublicId, loadProfile);
  const today = useOwnedResource(userPublicId, loadToday);
  const measurement = profile.data?.measurement;
  const basics = profile.data?.profile;
  const summary = today.data?.summary;

  return <div className="grid min-w-0 gap-4 lg:grid-cols-3">
    <section className={cardClass}>
      <h2 className="text-xl font-semibold">Player profile</h2>
      {profile.loading && <p role="status" className="text-sm text-white/70">Loading profile…</p>}
      {profile.error && <ReloadNotice message={profile.error} retry={profile.retry}/>}
      {!!profile.data?.errors.length && <ReloadNotice message={profile.data.errors.join(" ")} retry={profile.retry}/>}
      {measurement && <>
        <p className="text-xs text-white/65">Latest measurements · {measurement.measured_on}</p>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {[
            ["Current age",`${ageYears(measurement.date_of_birth) ?? 'Unavailable'}${ageYears(measurement.date_of_birth) !== null ? ' years' : ''}`],
            ["Height",`${measurement.height_cm} cm`],
            ["Weight",`${measurement.weight_kg} kg`],
            ["BMI",measurementBmi(measurement) ?? "Unavailable"],
          ].map(([label,value]) => <div key={label} className="min-w-0">
            <dt className="text-white/60">{label}</dt>
            <dd className="mt-1 break-words font-medium">{value}</dd>
          </div>)}
        </dl>
      </>}
      {!profile.loading && profile.data?.measurementsAvailable && !measurement &&
        <p className="text-sm text-white/70">No body measurements saved yet.</p>}
      {basics && <div className="text-sm">
        <p className="text-white/60">Training experience</p>
        <p className="mt-1 font-medium">{trainingDurationLabel(basics.training_started_on)}</p>
      </div>}
      <Link className={linkClass} href="/me/profile">View and update profile</Link>
    </section>
    <section className={cardClass}>
      <h2 className="text-xl font-semibold">Today’s training</h2>
      {today.loading && <p role="status" className="text-sm text-white/70">Loading today’s published classes…</p>}
      {today.error && <ReloadNotice message={today.error} retry={today.retry}/>}
      {summary && <>
        <p className="text-xs text-white/65">{today.data?.today} · Australia/Sydney</p>
        {summary.published_lessons ? <>
          <p className="text-sm">{summary.total_minutes} personal training minutes · {summary.published_lessons} published {summary.published_lessons === 1 ? "class" : "classes"}</p>
          <ul className="max-h-64 space-y-3 overflow-y-auto pr-1">{summary.reports.map(report => <li key={report.public_id} className="text-sm">
            <Link className="break-words font-medium underline" href={`/me/class-reports/${report.public_id}`}>{report.title}</Link>
            {report.attendance === "absent" ? <p className="mt-1 text-white/65">Absent</p> :
              <ul className="mt-1 space-y-1 text-white/75">{report.items.map((item,index) =>
                <li className="break-words" key={index}>{item.name} · {item.minutes} minutes</li>)}</ul>}
          </li>)}</ul>
          <ExerciseEnergySummary energy={summary.exercise_energy}/>
        </> : <p className="text-sm leading-6 text-white/70">Your coach has not published a class record for today. Other physical activity is not recorded here.</p>}
      </>}
      <Link className={linkClass} href="/me/class-reports/daily">View daily training records</Link>
    </section>
    <section className={cardClass}>
      <h2 className="text-xl font-semibold">Food nutrients</h2>
      <p className="text-sm leading-6 text-white/75">Compare carbohydrate, protein and fat per 100 g of meat, eggs, dairy and vegetables, with the preparation state and food source shown.</p>
      <p className="text-sm leading-6 text-white/70">For general recovery, remember fluids and regular meals containing carbohydrate and protein.</p>
      <Link className={linkClass} href="/foods">Explore food nutrition per 100 g</Link>
    </section>
  </div>;
}
