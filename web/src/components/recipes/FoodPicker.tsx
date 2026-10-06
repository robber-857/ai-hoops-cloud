"use client";
import { useEffect, useState } from "react";
import { recipeService, type Food } from "@/services/recipes";
import { field, button, ErrorNotice } from "./RecipeShared";
export function FoodPicker({ onAdd }: { onAdd: (food: Food) => void }) {
  const [releases, setReleases] = useState<{ id: number; name: string }[]>([]);
  const [release, setRelease] = useState(0),
    [query, setQuery] = useState(""),
    [offset, setOffset] = useState(0),
    [retry, setRetry] = useState(0);
  const [foods, setFoods] = useState<Food[]>([]),
    [more, setMore] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setError("");
    recipeService
      .releases()
      .then((data) => {
        if (active) {
          setReleases(data.items);
          setRelease((r) => r || data.items[0]?.id || 0);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [retry]);
  useEffect(() => {
    if (!release) return;
    let active = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      recipeService
        .foods(release, query, offset)
        .then((data) => {
          if (active) {
            setFoods(data.items);
            setMore(data.has_more);
          }
        })
        .catch((e) => {
          if (active) {
            setError(e.message);
            setFoods([]);
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [release, query, offset, retry]);
  return (
    <section className="mt-6 border-t border-white/20 pt-5">
      <h3 className="text-xl font-semibold">Find an ingredient</h3>
      <p className="mt-2 text-sm text-white/70">
        Choose the food and cooking state that match your edible ingredient
        weight.
      </p>
      <div className="my-4 grid gap-4 sm:grid-cols-2">
        <label>
          Food source
          <select
            aria-label="Food source"
            className={field}
            value={release}
            onChange={(e) => {
              setRelease(Number(e.target.value));
              setOffset(0);
            }}
          >
            <option value={0} disabled>
              Select source
            </option>
            {releases.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Food name
          <input
            className={field}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOffset(0);
            }}
            placeholder="For example, rice cooked"
          />
        </label>
      </div>
      {error && (
        <ErrorNotice error={error} retry={() => setRetry((v) => v + 1)} />
      )}
      {loading ? (
        <p role="status">Searching foods…</p>
      ) : !release ? (
        <p>No food source has been imported yet.</p>
      ) : !foods.length ? (
        <p>No matching foods. Try a shorter name.</p>
      ) : (
        <ul className="max-h-96 overflow-y-auto divide-y divide-white/20">
          {foods.map((f) => (
            <li
              key={f.food_key}
              className="flex items-start justify-between gap-4 py-4"
            >
              <div className="min-w-0">
                <p className="break-words font-medium">{f.name?.trim() || "Food name unavailable — retry the search"}</p>
                <p className="mt-1 text-sm text-white/70">
                  {f.details["Food Description"]}
                </p>
                <p className="mt-1 text-xs text-white/60">
                  Analysed portion:{" "}
                  {f.details["Analysed Portion"] || "Not specified"}
                </p>
              </div>
              <button
                type="button"
                className={button + " shrink-0"}
                disabled={!f.name?.trim()}
                aria-label={`Add ${f.name}`}
                onClick={() => onAdd(f)}
              >
                Add
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          className={button}
          disabled={loading || offset === 0}
          onClick={() => setOffset((v) => Math.max(0, v - 20))}
        >
          Previous foods
        </button>
        <button
          type="button"
          className={button}
          disabled={loading || !more || !!error}
          onClick={() => setOffset((v) => v + 20)}
        >
          Next foods
        </button>
      </div>
    </section>
  );
}
