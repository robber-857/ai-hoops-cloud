import Image from "next/image";
import type { TrainingFood } from "@/services/foods";
import type { AppLanguage } from "@/lib/language";
import { AFCD_SOURCE_URL, ENGLISH_FOOD_LABELS, foodCopy, foodDisplay } from "@/lib/foodLanguage";
import styles from "./Foods.module.css";

export function FoodNutrientCard({ food, language = "en" }: { food: TrainingFood; language?: AppLanguage }) {
  const copy = foodCopy(language);
  const display = foodDisplay(food, language);
  const hasPhoto = Object.hasOwn(ENGLISH_FOOD_LABELS, food.food_key);
  const nutrients = [
    [copy.carbohydrate, food.carbohydrate_g],
    [copy.protein, food.protein_g],
    [copy.fat, food.fat_g],
  ];
  return (
    <article className={styles.card}>
      {hasPhoto && (
        <div className={styles.photo}>
          <Image src={`/images/foods/${food.food_key}.webp`} alt="" width={480} height={480} unoptimized />
        </div>
      )}
      <div className={styles.identity}>
        <h2>{display.name}</h2>
        {display.preparation && <p>{display.preparation}</p>}
      </div>
      <div className={styles.nutrition}>
        <p className={styles.basis}>{copy.basis}</p>
        <dl className={styles.metrics}>
          {nutrients.map(([label, value]) => (
            <div className="min-w-0" key={label}>
              <dt>{label}</dt>
              <dd>{value === null ? copy.missing : `${value} g`}</dd>
            </div>
          ))}
        </dl>
      </div>
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
