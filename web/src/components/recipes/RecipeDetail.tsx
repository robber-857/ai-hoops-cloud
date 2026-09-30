"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { recipeService, type Recipe } from "@/services/recipes";
import {
  button,
  field,
  ErrorNotice,
  Nutrition,
  SourceNotice,
} from "./RecipeShared";
export function RecipeDetail({ id }: { id: string }) {
  const [recipe, setRecipe] = useState<Recipe | null>(null),
    [version, setVersion] = useState<number | undefined>(),
    [servings, setServings] = useState("1"),
    [requested, setRequested] = useState("1"),
    [versions, setVersions] = useState<{ version: number; title: string }[]>(
      [],
    ),
    [offset, setOffset] = useState(0),
    [more, setMore] = useState(false),
    [error, setError] = useState(""),
    [historyError, setHistoryError] = useState(""),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    recipeService
      .get(id, false, version, requested)
      .then((r) => {
        if (active) setRecipe(r);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, version, requested, retry]);
  useEffect(() => {
    let active = true;
    setHistoryError("");
    recipeService
      .versions(id, offset)
      .then((d) => {
        if (active) {
          setVersions(d.items);
          setMore(d.has_more);
        }
      })
      .catch((e) => {
        if (active) setHistoryError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id, offset, retry]);
  return (
    <div className="max-w-5xl space-y-7">
      <Link href="/recipes" className="underline">
        Recipe library
      </Link>
      {error && (
        <ErrorNotice error={error} retry={() => setRetry((v) => v + 1)} />
      )}{" "}
      {loading ? (
        <p role="status">Loading recipe…</p>
      ) : (
        !error &&
        recipe && (
          <>
            <header>
              <h1 className="break-words text-3xl font-semibold">
                {recipe.content.title}
              </h1>
              <p className="mt-2 text-white/70">
                Published version {recipe.version} · Makes{" "}
                {recipe.content.servings} serving(s)
              </p>
            </header>
            {recipe.content.image_url && (
              <Image
                unoptimized
                width={1200}
                height={675}
                src={recipe.content.image_url}
                alt={recipe.content.title}
                referrerPolicy="no-referrer"
                className="max-h-96 w-full rounded-lg object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
            <form
              className="flex max-w-sm items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                setRequested(servings);
              }}
            >
              <label className="min-w-0 flex-1">
                Servings to preview
                <input
                  required
                  type="number"
                  min="0.01"
                  max="1000"
                  step="0.01"
                  className={field}
                  value={servings}
                  onChange={(e) => setServings(e.target.value)}
                />
              </label>
              <button className={button} type="submit">
                Update portions
              </button>
            </form>
            <Nutrition recipe={recipe} portion />
            <section>
              <h2 className="text-2xl font-semibold">
                Ingredients for the full recipe
              </h2>
              <ul className="mt-3 divide-y divide-white/20">
                {recipe.ingredients.map((i, n) => (
                  <li key={n} className="py-4">
                    <div className="flex justify-between gap-4">
                      <span className="break-words font-medium">{i.name}</span>
                      <span className="shrink-0 tabular-nums">
                        {i.edible_grams} g
                      </span>
                    </div>
                    {i.preparation_note && (
                      <p className="mt-2 text-white/70">{i.preparation_note}</p>
                    )}
                    <p className="mt-1 text-sm text-white/60">
                      {i.source.release} ·{" "}
                      {i.details["Analysed Portion"] ?? "Edible portion"}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h2 className="text-2xl font-semibold">Method</h2>
              <p className="mt-3 whitespace-pre-wrap break-words leading-7">
                {recipe.content.instructions}
              </p>
            </section>
            <section>
              <h2 className="text-2xl font-semibold">
                Allergens & dietary notes
              </h2>
              <p className="mt-3">
                {recipe.content.allergens.length
                  ? recipe.content.allergens.join(", ")
                  : "No allergens listed."}{" "}
                {recipe.content.allergens_reviewed
                  ? "Information reviewed by the recipe author."
                  : "Allergen information has not been reviewed; an empty list does not mean allergen-free."}
              </p>
              {recipe.content.dietary_notes && (
                <p className="mt-2 whitespace-pre-wrap">
                  {recipe.content.dietary_notes}
                </p>
              )}
            </section>
            <SourceNotice recipe={recipe} />
          </>
        )
      )}
      <section className="border-t border-white/20 pt-5">
        <h2 className="text-xl font-semibold">Published versions</h2>
        {historyError && (
          <ErrorNotice
            error={historyError}
            retry={() => setRetry((v) => v + 1)}
          />
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <button className={button} onClick={() => setVersion(undefined)}>
            Latest
          </button>
          {versions.map((v) => (
            <button
              className={button}
              key={v.version}
              aria-pressed={recipe?.version === v.version}
              onClick={() => setVersion(v.version)}
            >
              Version {v.version}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-3">
          <button
            className={button}
            disabled={!offset}
            onClick={() => setOffset((v) => Math.max(0, v - 20))}
          >
            Previous versions
          </button>
          <button
            className={button}
            disabled={!more}
            onClick={() => setOffset((v) => v + 20)}
          >
            Older versions
          </button>
        </div>
      </section>
    </div>
  );
}
