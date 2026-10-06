"use client";

import { useEffect, useState } from "react";
import { foodService, type FoodCategory, type TrainingFoodPage } from "@/services/foods";
import { useLanguagePreference } from "@/components/account/LanguagePreferenceProvider";
import { FOOD_CATEGORIES, foodCopy, foodErrorMessage } from "@/lib/foodLanguage";
import { FoodNutrientCard, FoodSourceNote } from "./FoodNutritionParts";

const button = "inline-flex min-h-11 items-center justify-center rounded-lg border border-white/25 px-4 py-2 text-sm font-semibold hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#d8ff5d] disabled:opacity-40";
export function FoodNutritionList() {
  const preference = useLanguagePreference();
  const { language } = preference;
  const copy = foodCopy(language);
  const [category, setCategory] = useState<FoodCategory | "">("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<TrainingFoodPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ reason: unknown } | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    foodService.list(category, query, offset)
      .then((result) => { if (active) setData(result); })
      .catch((reason: unknown) => {
        if (active) setError({ reason });
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [category, query, offset, retry]);

  if (preference.loading) {
    return <p lang={language} role="status" className="py-10 text-white/70">{copy.loading}</p>;
  }

  return (
    <div className="w-full min-w-0 max-w-5xl" lang={language}>
      <h1 className="text-3xl font-semibold">{copy.title}</h1>
      <p className="mt-3 text-white/70">{copy.basis}</p>
      {preference.error && (
        <div role="alert" className="mt-5 rounded-lg border border-amber-300/30 p-4 text-sm text-amber-100">
          <p>{copy.languageWarning}</p>
          <button className={`${button} mt-3`} type="button" onClick={preference.reload}>{copy.retryLanguage}</button>
        </div>
      )}
      <form className="mt-6 flex flex-wrap gap-2" onSubmit={(event) => {
        event.preventDefault();
        setQuery(search.trim());
        setOffset(0);
      }}>
        <label className="sr-only" htmlFor="food-search">{copy.searchLabel}</label>
        <input id="food-search" type="search" maxLength={200} value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={copy.searchPlaceholder}
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/25 bg-[#10141b] px-3 text-base text-white focus:outline-2 focus:outline-[#d8ff5d]" />
        <button className={button} type="submit">{copy.search}</button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={copy.categoryLabel}>
        {FOOD_CATEGORIES.map((key) => (
          <button key={key} type="button" aria-pressed={category === key}
            className={`${button} ${category === key ? "border-[#d8ff5d] bg-[#d8ff5d]/15 text-[#d8ff5d]" : "text-white/75"}`}
            onClick={() => { setCategory(key); setOffset(0); }}>
            {copy.categories[key]}
          </button>
        ))}
      </div>
      {error && (
        <div role="alert" className="mt-6 rounded-lg border border-red-300/40 p-4 text-red-100">
          <p className="break-words">{foodErrorMessage(error.reason, language)}</p>
          <button className={`${button} mt-3`} type="button" onClick={() => setRetry((value) => value + 1)}>{copy.retry}</button>
        </div>
      )}
      {loading ? (
        <p role="status" className="py-10 text-white/70">{copy.loading}</p>
      ) : !error && data ? (
        <>
          {data.data_status === "source_unavailable" ? (
            <p role="status" className="mt-6 rounded-lg border border-white/20 p-5 text-white/70">
              {copy.unavailable}
            </p>
          ) : (
            <>
              {data.data_status === "partial_catalog" && (
                <p role="status" className="mt-5 text-sm text-amber-100">{copy.partial}</p>
              )}
              {data.items.length ? (
                <>
                  <p className="mt-5 text-sm text-white/60" role="status">{copy.results(data.total)}</p>
                  <ul className="mt-3 grid gap-4 md:grid-cols-2">
                    {data.items.map((food) => (
                      <li className="min-w-0" key={`${food.release_id}:${food.food_key}`}><FoodNutrientCard food={food} language={language} /></li>
                    ))}
                  </ul>
                </>
              ) : (
                <p role="status" className="py-10 text-white/70">{copy.empty}</p>
              )}
              {(offset > 0 || data.has_more) && (
                <div className="mt-5 flex flex-wrap gap-3">
                  <button type="button" className={button} disabled={offset === 0} onClick={() => setOffset((value) => Math.max(0, value - 20))}>{copy.previous}</button>
                  <button type="button" className={button} disabled={!data.has_more} onClick={() => setOffset((value) => value + 20)}>{copy.next}</button>
                </div>
              )}
            </>
          )}
          <FoodSourceNote language={language} />
        </>
      ) : null}
    </div>
  );
}
