import type { Recipe } from "@/services/recipes";
export const field =
  "mt-2 min-h-11 w-full min-w-0 rounded-lg border border-white/30 bg-[#10141b] px-3 py-2 text-base text-white focus:outline-2 focus:outline-[#d8ff5d]";
export const button =
  "inline-flex min-h-11 items-center justify-center rounded-lg border border-white/30 px-4 py-2 text-sm font-semibold hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#d8ff5d] disabled:opacity-40";
export const primary = button + " bg-[#d8ff5d] text-black hover:bg-[#e6ff98]";
export const labels: Record<string, string> = {
  energy_kcal: "Energy",
  energy_with_fibre_kj: "Energy (kJ)",
  protein_g: "Protein",
  fat_g: "Fat",
  carbohydrate_without_sugar_alcohols_g: "Available carbohydrate",
  fibre_g: "Fibre",
  sugars_g: "Sugars",
  sodium_mg: "Sodium",
};
export function ErrorNotice({
  error,
  retry,
}: {
  error: string;
  retry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="my-4 break-words rounded-lg border border-red-300/40 p-4 text-red-100"
    >
      {error}
      {retry && (
        <button className={button + " ml-3"} onClick={retry} type="button">
          Retry
        </button>
      )}
    </div>
  );
}
export function Nutrition({
  recipe,
  portion = false,
}: {
  recipe: Recipe;
  portion?: boolean;
}) {
  return (
    <section className="min-w-0 space-y-4">
      <h2 className="text-2xl font-semibold">
        {portion
          ? `Nutrition for ${recipe.portion_preview?.servings_requested ?? "1"} serving(s)`
          : "Nutrition per serving"}
      </h2>
      <dl className="grid grid-cols-2 gap-x-6 sm:grid-cols-4">
        {Object.keys(labels).map((key) => {
          const value = portion
            ? recipe.portion_preview?.nutrients[key]?.amount
            : recipe.nutrition.nutrients[key]?.per_serving;
          const unit = recipe.nutrition.nutrients[key]?.unit;
          return (
            <div key={key} className="border-b border-white/20 py-4">
              <dt className="text-sm text-white/70">{labels[key]}</dt>
              <dd className="mt-1 text-xl tabular-nums">
                {value == null ? "Unknown" : `${value} ${unit}`}
              </dd>
            </div>
          );
        })}
      </dl>
      {Object.entries(recipe.nutrition.nutrients)
        .filter(([, value]) => value.total === null)
        .map(([key, value]) => (
          <p key={key} className="text-sm text-amber-100">
            {labels[key]} is incomplete: missing data for{" "}
            {value.missing_ingredient_indexes
              .map((i) => recipe.ingredients[i]?.name)
              .join(", ")}
            . Known recipe subtotal: {value.known_subtotal} {value.unit}.
          </p>
        ))}
      <p className="text-sm text-white/70">
        {recipe.nutrition.serving_weight_grams
          ? `One serving weighs approximately ${recipe.nutrition.serving_weight_grams} g.`
          : "Finished weight was not recorded; weight per serving is unavailable."}
      </p>
      <details className="border-b border-white/20 py-3">
        <summary className="min-h-11 cursor-pointer py-2">
          Whole recipe and finished weight values
        </summary>
        <dl>
          {Object.entries(recipe.nutrition.nutrients).map(([key, v]) => (
            <div
              key={key}
              className="flex flex-wrap justify-between gap-2 py-2 text-sm"
            >
              <dt>{labels[key]}</dt>
              <dd>
                Total: {v.total ?? "Unknown"} {v.unit} · per 100g finished:{" "}
                {v.per_100g_finished ?? "Unavailable"} {v.unit}
              </dd>
            </div>
          ))}
        </dl>
      </details>
      <details className="border-b border-white/20 py-3">
        <summary className="min-h-11 cursor-pointer py-2">
          Ingredient contributions to the full recipe
        </summary>
        {recipe.ingredients.map((ingredient, index) => (
          <div
            className="border-t border-white/10 py-4"
            key={`${ingredient.release_id}/${ingredient.food_key}`}
          >
            <h3 className="break-words font-semibold">{ingredient.name}</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Object.entries(
                recipe.nutrition.ingredient_contributions[index] || {},
              ).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-sm text-white/70">{labels[key]}</dt>
                  <dd>
                    {value ?? "Unknown"}{" "}
                    {value === null
                      ? ""
                      : recipe.nutrition.nutrients[key]?.unit}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </details>
    </section>
  );
}
export function SourceNotice({ recipe }: { recipe: Recipe }) {
  const sources = [
    ...new Map(
      recipe.ingredients.map((i) => [i.source.release, i.source]),
    ).values(),
  ];
  return (
    <aside className="mt-8 space-y-2 border-t border-white/20 pt-5 text-sm text-white/70">
      <p>
        Estimated from matched-state edible food weights. Cooking losses,
        retention and oil absorption are not inferred. This is not an
        AFCD-certified recipe or an individual meal prescription.
      </p>
      <p>
        Australian food composition data varies with samples, seasons,
        processing and brands. It may not be appropriate for use in other
        countries.
      </p>
      {sources.map((s) => (
        <p key={s.release}>
          {s.attribution}.{" "}
          <a
            className="underline"
            href={s.source_page}
            target="_blank"
            rel="noreferrer"
          >
            Source data
          </a>{" "}
          ·{" "}
          <a
            className="underline"
            href={s.licence_url}
            target="_blank"
            rel="noreferrer"
          >
            Data licence
          </a>
          . Changes: ingredient amounts scaled and combined into recipe
          estimates.
        </p>
      ))}
    </aside>
  );
}
