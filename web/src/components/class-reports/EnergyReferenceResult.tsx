import type { EnergyReferencePreview } from '@/services/energyReference';
const names:Record<string,string>={breakfast:'Breakfast',lunch:'Lunch',dinner:'Dinner'};
export function EnergyReferenceResult({result:r}:{result:EnergyReferencePreview}) {
  return <section className="space-y-4 rounded-xl border border-white/20 p-5" aria-label="Reference preview result">
    <h2 className="text-2xl font-semibold">Reference scenario: about {r.energy_kcal} kcal / day</h2>
    <p>Age {r.inputs.age_years} · {r.inputs.sex === 'male' ? 'Male' : 'Female'} · PAL {r.inputs.pal}</p>
    <p>Source reference body: {r.reference_weight_kg} kg / {r.reference_height_cm} cm. These are the table’s reference measurements, not a player’s measurements.</p>
    <p>Published table value: {r.energy_mj} MJ / day ({r.energy_kj} kJ / day).</p>
    <p className="text-white/70">{r.calculation}</p>
    {r.meals ? <div className="space-y-3">
      <h3 className="text-xl font-semibold">Your three-meal scenario</h3>
      <p>These percentages were entered by you. They are not an official meal recommendation.</p>
      <dl className="grid gap-3 sm:grid-cols-3">{r.meals.map(meal=><div className="rounded-lg border border-white/20 p-3" key={meal.name}><dt>{names[meal.name]} · {meal.percent}%</dt><dd className="mt-2 text-xl">{meal.energy_kcal} kcal</dd></div>)}</dl>
      <p className="text-sm text-white/70">{r.rounding} Meal totals equal the displayed daily total.</p>
    </div> : <p>No meal split configured. Enter all three percentages to preview a split.</p>}
    <p>PAL already represents whole-day activity. Do not add class exercise calories to this table value. No separate exercise estimate or carbohydrate, protein and fat targets are generated here.</p>
    <p>This is a whole-day reference, not an amount to eat at the next meal. It is not saved or published to players.</p>
    <p className="break-words text-sm text-white/70">Reference version: {r.rule_version} · Source checked {r.checked_on}</p>
    <a className="underline" href={r.source_url} target="_blank" rel="noreferrer">{r.source_title}</a>
  </section>;
}
