import type { PersonalEnergyPreview } from '@/services/personalEnergy';
export function PersonalEnergyDetails({result:r}:{result:PersonalEnergyPreview}){
  return <div className="space-y-4">
    <p>Inputs: {r.input_basis==='published_snapshot'?'measurements frozen with this published class record':'saved lesson and measurements available on or before its date'} · Lesson v{r.lesson_version}</p>
    {r.blockers.length>0&&<ul className="list-inside list-disc text-amber-100">{r.blockers.map((b,i)=><li key={i}>{b}</li>)}</ul>}
    {r.players.map((p,i)=><article key={i} className="min-w-0 space-y-3 rounded-xl border border-white/20 p-4">
      <h3 className="break-words text-xl font-semibold">{p.student_name}</h3>
      {p.attendance!=='absent'&&<p>Activity scenario: {(p.activity_category??r.activity_category).replaceAll('_',' ')} · {p.activity_basis==='individual_review'?'Individual review selection':'Class comparison scenario'}</p>}
      {p.energy_kcal!==null&&<p className="text-2xl">About {p.energy_kcal} kcal / day</p>}
      <p>{p.reason}</p>
      {p.meals&&<div className="space-y-2"><h4 className="font-semibold">Meal energy scenario</h4><dl className="grid gap-3 sm:grid-cols-3">{p.meals.map(meal=><div className="rounded-lg border border-white/20 p-3" key={meal.name}><dt className="capitalize">{meal.name} · {meal.percent}%</dt><dd>{meal.energy_kcal} kcal</dd></div>)}</dl><p className="text-sm text-white/70">Your entered split; rounded in 10 kcal units so the meals total {p.energy_kcal} kcal. This is a whole-day scenario, not an amount to make up at the next meal.</p></div>}
      {p.inputs&&<><p>Age {p.inputs.age_years} at {p.inputs.held_on} · {p.inputs.sex} · {p.inputs.height_cm} cm · {p.inputs.weight_kg} kg</p><p>Measured {p.inputs.measured_on} ({p.inputs.measurement_age_days} days before this lesson). Review whether these measurements still represent the player.</p><details><summary className="cursor-pointer py-2">Calculation details</summary><p className="break-words">{p.formula}</p><p>Growth allowance: {p.growth_kcal} kcal / day, already included.</p></details></>}
    </article>)}
    <p>Class whole-day scenario: {r.activity_category.replaceAll('_',' ')}; individual selections are shown above. Activity is not inferred from class minutes. Do not add exercise calories again. Nutrient grams and approved meal targets are not generated here.</p>
    <p className="break-words text-sm text-white/70">Candidate version: {r.rule_version} · Checked {r.checked_on}</p>
    <a href={r.source_url} className="underline" target="_blank" rel="noreferrer">{r.source_title}</a>
  </div>;
}
