import Link from 'next/link';
import type { ClassReport, DailyExerciseEnergy, ExerciseEnergy } from '@/services/classReports';
import { measurementBmi } from '@/lib/profile';

const statuses = {present:'Full attendance',absent:'Absent',left_early:'Left early',partial:'Partial participation'};
const methods: Record<string,string> = {
  youth_mety: "Children’s activity reference",
  youth_analogy: "Approximate match to a children’s activity reference",
  generic_met_approximation: 'General activity estimate · approximation',
};

export function ExerciseEnergySummary({energy}:{energy?:ExerciseEnergy|DailyExerciseEnergy}) {
  if (!energy) {
    return <p className="text-white/75">This publication did not include an energy estimate. Its recorded training remains available.</p>;
  }
  if (energy.status === 'not_applicable') {
    return <p>No exercise energy estimate applies to this attendance record.</p>;
  }
  const missing = 'missing_reports' in energy ? energy.missing_reports : energy.missing_items;
  const missingUnit = 'missing_reports' in energy ? 'class record' : 'activity';
  return <div className="space-y-3">
    {energy.status === 'complete' && energy.total_kcal !== null ?
      <p className="text-2xl font-semibold">≈ {energy.total_kcal} kcal</p> :
      energy.status === 'partial' && energy.known_subtotal_kcal !== null ?
        <><p className="text-2xl font-semibold">Known subtotal ≈ {energy.known_subtotal_kcal} kcal</p>
          <p className="text-amber-100">{missing} {missingUnit}{missing === 1 ? '' : 's'} without a complete estimate.</p></> :
        <p className="text-amber-100">Energy estimate unavailable. Training minutes are still recorded.</p>}
    <p className="text-sm leading-6 text-white/70">
      Estimated energy during the recorded training time, including resting
      energy during those minutes. Actual expenditure varies by player and
      participation.
    </p>
    {!!energy.methods.length && <ul className="space-y-1 text-sm text-white/75">
      {energy.methods.map(method => <li key={method}>{methods[method] || 'Activity estimate'}</li>)}
    </ul>}
  </div>;
}

export function FoodRecoveryReference() {
  return <section className="space-y-3">
    <h3 className="font-semibold">Food and recovery reference</h3>
    <p className="text-sm leading-6 text-white/75">
      Use the food reference to compare carbohydrate, protein and fat in familiar
      meat, eggs, dairy and vegetables. Each entry describes 100 g of the edible
      food in its stated preparation state.
    </p>
    <Link href="/foods" className="inline-flex min-h-11 items-center underline">View food nutrition per 100 g</Link>
  </section>;
}

export function ClassReportDetails({report:r}:{report:ClassReport}) {
  const energy = r.exercise_energy;
  return <article className="min-w-0 space-y-5 rounded-lg border border-white/20 bg-[#080d16]/90 p-5">
    <header>
      <h2 className="break-words text-xl font-semibold">{r.student_name} · {r.title}</h2>
      <p className="mt-2 text-sm text-white/70">{r.class_name} · {r.held_on} ({r.timezone}) · Lesson v{r.lesson_version}</p>
    </header>
    {r.is_latest === false && <p className="text-amber-200">Historical version. A newer published record is available in Class reports.</p>}
    <section className="space-y-3">
      <h3 className="font-semibold">What you trained</h3>
      <p>{statuses[r.attendance]} · {r.total_minutes} recorded minutes</p>
      {r.attendance === 'absent' ?
        <p>Attendance record only. No exercise expenditure report is generated for this absence.</p> :
        <ul className="divide-y divide-white/15">{r.items.map((item,index) => <li className="py-3" key={index}>
          <strong className="break-words">{item.name}</strong>
          <p>{item.minutes} minutes participated / {item.actual_minutes} class minutes</p>
          {item.intensity && <p className="text-sm capitalize text-white/70">Intensity: {item.intensity}</p>}
          {item.notes && <p className="whitespace-pre-wrap text-white/70">{item.notes}</p>}
        </li>)}</ul>}
      {r.lesson_notes && <p className="whitespace-pre-wrap">Class note: {r.lesson_notes}</p>}
      {r.notes && <p className="whitespace-pre-wrap">Player note: {r.notes}</p>}
    </section>
    <section>
      <h3 className="font-semibold">Measurements saved with this publication</h3>
      {r.profile ? <p className="mt-2">Measured {r.profile.measured_on} · {r.profile.height_cm} cm · {r.profile.weight_kg} kg · BMI {measurementBmi(r.profile) ?? 'unavailable'}. These are the recorded measurements.</p> :
        <p className="mt-2 text-amber-100">No measurements were available on or before this lesson date. The training record can still be viewed.</p>}
    </section>
    {r.attendance !== 'absent' && <section className="space-y-3 border-t border-white/20 pt-4">
      <h3 className="font-semibold">Training energy estimate</h3>
      <ExerciseEnergySummary energy={energy}/>
      {energy && energy.items.length > 0 && <details>
        <summary className="min-h-11 cursor-pointer py-3">Activity estimates and sources</summary>
        <ul className="divide-y divide-white/15">{energy.items.map((item,index) => <li className="space-y-2 py-4" key={index}>
          <p className="break-words font-medium">{r.items[index]?.name || 'Recorded activity'}</p>
          {item.gross_kcal !== null ? <p>≈ {item.gross_kcal} kcal</p> : <p className="text-amber-100">Not estimated</p>}
          {item.method && <p className="text-sm text-white/75">{methods[item.method] || 'Activity estimate'}</p>}
          {item.reason && <p className="text-sm text-white/75">{item.reason}</p>}
          {item.source && <div className="text-sm text-white/70">
            <p className="break-words">{item.source.description}{item.source.age_group ? ` · Age group ${item.source.age_group}` : ''}</p>
            <a className="inline-flex min-h-11 items-center break-words underline" href={item.source.url} target="_blank" rel="noreferrer">{item.source.title}</a>
          </div>}
        </li>)}</ul>
      </details>}
    </section>}
    <div className="border-t border-white/20 pt-4"><FoodRecoveryReference/></div>
  </article>;
}
