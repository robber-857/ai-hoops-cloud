"use client";
import { usePlayerCopy } from "@/components/account/playerCopy";
import type { PersonalEnergyPreview } from '@/services/personalEnergy';
export function PersonalEnergyDetails({result:r}:{result:PersonalEnergyPreview}){
  const { t, isChinese } = usePlayerCopy();
  return <div className="space-y-4">
    <p>{t("Inputs:")} {r.input_basis==='published_snapshot'?t("measurements frozen with this published class record"):t("saved lesson and measurements available on or before its date")} {t("· Lesson v")}{r.lesson_version}</p>
    {r.blockers.length>0&&<ul className="list-inside list-disc text-amber-100">{r.blockers.map((b,i)=><li key={i}>{isChinese ? t(b).replace(/^Confirm participation for (.+) before publishing\.$/, '发布前请确认 $1 的参与情况。') : b}</li>)}</ul>}
    {r.players.map((p,i)=><article key={i} className="min-w-0 space-y-3 rounded-xl border border-white/20 p-4">
      <h3 className="break-words text-xl font-semibold">{p.student_name}</h3>
      {p.attendance!=='absent'&&<p>{t("Activity scenario:")} {t((p.activity_category??r.activity_category).replaceAll('_',' '))} · {p.activity_basis==='individual_review'?t("Individual review selection"):t("Class comparison scenario")}</p>}
      {p.energy_kcal!==null&&<p className="text-2xl">{t("About")} {p.energy_kcal} {t("kcal / day")}</p>}
      <p>{t(p.reason)}</p>
      {p.meals&&<div className="space-y-2"><h4 className="font-semibold">{t("Meal energy scenario")}</h4><dl className="grid gap-3 sm:grid-cols-3">{p.meals.map(meal=><div className="rounded-lg border border-white/20 p-3" key={meal.name}><dt className="capitalize">{t(meal.name)} · {meal.percent}%</dt><dd>{meal.energy_kcal} kcal</dd></div>)}</dl><p className="text-sm text-white/70">{t("Your entered split; rounded in 10 kcal units so the meals total")} {p.energy_kcal} {t("kcal. This is a whole-day scenario, not an amount to make up at the next meal.")}</p></div>}
      {p.inputs&&<><p>{isChinese ? `${p.inputs.held_on} 时 ${p.inputs.age_years} 岁` : `Age ${p.inputs.age_years} at ${p.inputs.held_on}`} · {t(p.inputs.sex)} · {p.inputs.height_cm} {t("cm ·")} {p.inputs.weight_kg} kg</p><p>{t("Measured")} {p.inputs.measured_on} ({p.inputs.measurement_age_days} {t("days before this lesson). Review whether these measurements still represent the player.")}</p><details><summary className="cursor-pointer py-2">{t("Calculation details")}</summary><p className="break-words">{isChinese ? p.formula?.replaceAll("age years", "年龄（岁）").replaceAll("height cm", "身高（厘米）").replaceAll("weight kg", "体重（千克）") : p.formula}</p><p>{t("Growth allowance:")} {p.growth_kcal} {t("kcal / day, already included.")}</p></details></>}
    </article>)}
    <p>{t("Class whole-day scenario:")} {t(r.activity_category.replaceAll('_',' '))}{t("; individual selections are shown above. Activity is not inferred from class minutes. Do not add exercise calories again. Nutrient grams and approved meal targets are not generated here.")}</p>
    <p className="break-words text-sm text-white/70">{t("Candidate version:")} {r.rule_version} {t("· Checked")} {r.checked_on}</p>
    <a href={r.source_url} className="underline" target="_blank" rel="noreferrer">{r.source_title}</a>
  </div>;
}
