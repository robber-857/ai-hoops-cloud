"use client";
import { usePlayerCopy } from "@/components/account/playerCopy";
import type { EnergyReferencePreview } from '@/services/energyReference';
const names:Record<string,string>={breakfast:'Breakfast',lunch:'Lunch',dinner:'Dinner'};
export function EnergyReferenceResult({result:r}:{result:EnergyReferencePreview}) {
  const { t } = usePlayerCopy();
  return <section className="space-y-4 rounded-xl border border-white/20 p-5" aria-label={t("Reference preview result")}>
    <h2 className="text-2xl font-semibold">{t("Reference scenario: about")} {r.energy_kcal} {t("kcal / day")}</h2>
    <p>{t("Age")} {r.inputs.age_years} · {r.inputs.sex === 'male' ? t("Male") : t("Female")} {t("· PAL")} {r.inputs.pal}</p>
    <p>{t("Source reference body:")} {r.reference_weight_kg} {t("kg /")} {r.reference_height_cm} {t("cm. These are the table’s reference measurements, not a player’s measurements.")}</p>
    <p>{t("Published table value:")} {r.energy_mj} {t("MJ / day (")}{r.energy_kj} {t("kJ / day).")}</p>
    <p className="text-white/70">{t(r.calculation)}</p>
    {r.meals ? <div className="space-y-3">
      <h3 className="text-xl font-semibold">{t("Your three-meal scenario")}</h3>
      <p>{t("These percentages were entered by you. They are not an official meal recommendation.")}</p>
      <dl className="grid gap-3 sm:grid-cols-3">{r.meals.map(meal=><div className="rounded-lg border border-white/20 p-3" key={meal.name}><dt>{t(names[meal.name])} · {meal.percent}%</dt><dd className="mt-2 text-xl">{meal.energy_kcal} kcal</dd></div>)}</dl>
      <p className="text-sm text-white/70">{t(r.rounding)} {t("Meal totals equal the displayed daily total.")}</p>
    </div> : <p>{t("No meal split configured. Enter all three percentages to preview a split.")}</p>}
    <p>{t("PAL already represents whole-day activity. Do not add class exercise calories to this table value. No separate exercise estimate or carbohydrate, protein and fat targets are generated here.")}</p>
    <p>{t("This is a whole-day reference, not an amount to eat at the next meal. It is not saved or published to players.")}</p>
    <p className="break-words text-sm text-white/70">{t("Reference version:")} {r.rule_version} {t("· Source checked")} {r.checked_on}</p>
    <a className="underline" href={r.source_url} target="_blank" rel="noreferrer">{r.source_title}</a>
  </section>;
}
