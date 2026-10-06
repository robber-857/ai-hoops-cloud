import type { TrainingFood } from "@/services/foods";
import type { AppLanguage } from "@/lib/language";
import { AFCD_SOURCE_URL, foodCopy, foodDisplay } from "@/lib/foodLanguage";

export function FoodNutrientCard({ food, language = "en" }: { food: TrainingFood; language?: AppLanguage }) {
  const copy = foodCopy(language);
  const display = foodDisplay(food, language);
  const nutrients = [
    [copy.carbohydrate, food.carbohydrate_g],
    [copy.protein, food.protein_g],
    [copy.fat, food.fat_g],
  ];
  return (
    <article className="min-w-0 rounded-xl border border-white/15 bg-white/[0.025] p-4 sm:p-5">
      <h2 className="break-words text-lg font-semibold">{display.name}</h2>
      {display.preparation && <p className="mt-1 break-words text-sm text-white/65">{display.preparation}</p>}
      <p className="mt-4 text-xs text-white/55">{copy.basis}</p>
      <dl className="mt-2 grid grid-cols-3 gap-2 border-t border-white/10 pt-3">
        {nutrients.map(([label, value]) => (
          <div className="min-w-0" key={label}>
            <dt className="break-words text-xs text-white/70">{label}</dt>
            <dd className="mt-2 break-words font-semibold tabular-nums sm:text-lg">
              {value === null ? copy.missing : `${value} g`}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

export function FoodSourceNote({ language = "en" }: { language?: AppLanguage }) {
  const copy = foodCopy(language);
  return (
    <footer className="mt-8 border-t border-white/15 pt-5 text-sm text-white/60">
      {copy.source}: {" "}
      <a className="underline underline-offset-4 hover:text-white" href={AFCD_SOURCE_URL} target="_blank" rel="noreferrer">
        AFCD
      </a>
    </footer>
  );
}
