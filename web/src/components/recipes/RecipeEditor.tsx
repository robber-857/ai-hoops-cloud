"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError } from "@/services/client";
import {
  recipeService,
  type Recipe,
  type RecipeContent,
  type Food,
} from "@/services/recipes";
import { FoodPicker } from "./FoodPicker";
import {
  button,
  primary,
  field,
  ErrorNotice,
  Nutrition,
  SourceNotice,
} from "./RecipeShared";
const empty: RecipeContent = {
  title: "",
  instructions: "",
  servings: "1",
  finished_weight_grams: null,
  image_url: null,
  ingredients: [],
  allergens: [],
  dietary_notes: "",
  allergens_reviewed: false,
};
export function RecipeEditor({ id }: { id?: string }) {
  const router = useRouter();
  const [form, setForm] = useState<RecipeContent>(empty),
    [saved, setSaved] = useState<Recipe | null>(null),
    [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(!!id),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [dirty, setDirty] = useState(false),
    [retry, setRetry] = useState(0),
    [pending, setPending] = useState(false),
    [published, setPublished] = useState(false);
  const request = useRef<{
      content: RecipeContent;
      id: string;
      version?: number;
    } | null>(null),
    inFlight = useRef(false);
  const key = (i: { release_id: number; food_key: string }) =>
    `${i.release_id}/${i.food_key}`;
  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    setError("");
    recipeService
      .get(id, true)
      .then((r) => {
        if (active) {
          setSaved(r);
          setForm(r.content);
          setNames(
            Object.fromEntries(r.ingredients.map((i) => [key(i), i.name])),
          );
          setDirty(false);
        }
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
  }, [id, retry]);
  useEffect(() => {
    if (!dirty && !pending) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, pending]);
  function change(patch: Partial<RecipeContent>) {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
    setMessage("");
  }
  function add(food: Food) {
    if (form.ingredients.some((i) => key(i) === key(food))) {
      setMessage(
        "This ingredient is already included. Update its weight below.",
      );
      return;
    }
    setNames((n) => ({ ...n, [key(food)]: food.name }));
    change({
      ingredients: [
        ...form.ingredients,
        {
          release_id: food.release_id,
          food_key: food.food_key,
          edible_grams: "100",
          preparation_note: "",
        },
      ],
    });
  }
  async function save() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    const attempt = request.current ?? {
      content: {
        ...structuredClone(form),
        allergens: form.allergens.map((s) => s.trim()).filter(Boolean),
      },
      id: saved?.public_id ?? crypto.randomUUID(),
      version: saved?.version,
    };
    request.current = attempt;
    setPending(true);
    try {
      const r = attempt.version
        ? await recipeService.update(
            attempt.id,
            attempt.content,
            attempt.version,
          )
        : await recipeService.create(attempt.content, attempt.id);
      setSaved(r);
      setForm(r.content);
      setDirty(false);
      setPending(false);
      request.current = null;
      setMessage(
        `Draft version ${r.version} saved. Review the nutrition below before publishing.`,
      );
      if (!id) router.replace(`/admin/recipes/${r.public_id}`);
    } catch (e) {
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        setPending(false);
        request.current = null;
      }
      setError(
        e instanceof Error
          ? e.message
          : "Could not save. Retry the same save request.",
      );
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }
  async function publish() {
    if (!saved || dirty || pending || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await recipeService.publish(saved.public_id, saved.version);
      setPublished(true);
      setMessage(
        `Published version ${r.version}. It is now available in the recipe library.`,
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not publish. Retry publishing this saved version.",
      );
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }
  async function discard() {
    if (busy || pending) return;
    if (window.confirm("Discard local changes and reload the saved recipe?")) {
      inFlight.current = true;
      setBusy(true);
      try {
        if (saved) {
          const r = await recipeService.get(saved.public_id, true);
          setSaved(r);
          setForm(r.content);
          setNames(
            Object.fromEntries(r.ingredients.map((i) => [key(i), i.name])),
          );
        } else setForm(empty);
        request.current = null;
        setDirty(false);
        setError("");
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Could not reload the saved recipe.",
        );
      } finally {
        setBusy(false);
        inFlight.current = false;
      }
    }
  }
  if (loading) return <p role="status">Loading recipe…</p>;
  if (id && !saved)
    return (
      <ErrorNotice
        error={error || "Recipe unavailable."}
        retry={() => setRetry((v) => v + 1)}
      />
    );
  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <Link href="/admin/recipes" className="underline">
          All recipes
        </Link>
        <h1 className="mt-4 text-3xl font-semibold">
          {saved ? "Edit recipe" : "Create recipe"}
        </h1>
        <p className="mt-2 text-white/70">
          Save a draft to review nutrition. Publish when it is ready for players
          and coaches.
        </p>
      </div>
      {error && <ErrorNotice error={error} />}{" "}
      {message && (
        <p role="status" className="border border-white/20 p-4">
          {message}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={busy || pending} className="min-w-0 space-y-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="sm:col-span-2">
              Recipe name
              <input
                required
                maxLength={200}
                className={field}
                value={form.title}
                onChange={(e) => change({ title: e.target.value })}
              />
            </label>
            <label>
              Number of servings
              <input
                required
                type="number"
                min="0.01"
                max="1000"
                step="0.01"
                className={field}
                value={form.servings}
                onChange={(e) => change({ servings: e.target.value })}
              />
            </label>
            <label>
              Finished weight in grams (optional)
              <input
                type="number"
                min="0.01"
                max="1000000"
                step="0.01"
                className={field}
                value={form.finished_weight_grams ?? ""}
                onChange={(e) =>
                  change({ finished_weight_grams: e.target.value || null })
                }
              />
            </label>
            <label className="sm:col-span-2">
              Image URL (optional)
              <input
                type="url"
                className={field}
                value={form.image_url ?? ""}
                onChange={(e) => change({ image_url: e.target.value || null })}
              />
            </label>
          </div>
          <section>
            <h2 className="text-2xl font-semibold">Ingredients</h2>
            <p className="mt-2 text-sm text-white/70">
              Enter edible weights in the same raw or cooked state as the
              selected food.
            </p>
            {!form.ingredients.length && (
              <p className="my-4">
                Add at least one ingredient using food search.
              </p>
            )}
            <ol className="divide-y divide-white/20">
              {form.ingredients.map((i, index) => (
                <li className="py-5" key={key(i)}>
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="break-words font-semibold">
                      {names[key(i)] ||
                        saved?.ingredients.find((s) => key(s) === key(i))
                          ?.name ||
                        "Selected food"}
                    </h3>
                    <button
                      type="button"
                      className={button}
                      aria-label={`Remove ingredient ${index + 1}`}
                      onClick={() =>
                        change({
                          ingredients: form.ingredients.filter(
                            (_, n) => n !== index,
                          ),
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <label>
                      Edible grams
                      <input
                        aria-label={`Edible grams for ingredient ${index + 1}`}
                        required
                        type="number"
                        min="0.01"
                        max="100000"
                        step="0.01"
                        className={field}
                        value={i.edible_grams}
                        onChange={(e) =>
                          change({
                            ingredients: form.ingredients.map((v, n) =>
                              n === index
                                ? { ...v, edible_grams: e.target.value }
                                : v,
                            ),
                          })
                        }
                      />
                    </label>
                    <label>
                      Preparation note
                      <input
                        maxLength={500}
                        className={field}
                        value={i.preparation_note}
                        onChange={(e) =>
                          change({
                            ingredients: form.ingredients.map((v, n) =>
                              n === index
                                ? { ...v, preparation_note: e.target.value }
                                : v,
                            ),
                          })
                        }
                      />
                    </label>
                  </div>
                </li>
              ))}
            </ol>
            <FoodPicker onAdd={add} />
          </section>
          <label className="block">
            Method
            <textarea
              required
              maxLength={10000}
              rows={5}
              className={field}
              value={form.instructions}
              onChange={(e) => change({ instructions: e.target.value })}
            />
          </label>
          <label className="block">
            Allergens (comma separated)
            <input
              className={field}
              value={form.allergens.join(",")}
              onChange={(e) => change({ allergens: e.target.value.split(",") })}
            />
          </label>
          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              checked={form.allergens_reviewed}
              onChange={(e) => change({ allergens_reviewed: e.target.checked })}
            />
            Allergen information has been reviewed
          </label>
          <label className="block">
            Dietary notes
            <textarea
              maxLength={1000}
              className={field}
              value={form.dietary_notes}
              onChange={(e) => change({ dietary_notes: e.target.value })}
            />
          </label>
        </fieldset>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="submit"
            className={primary}
            disabled={busy || !form.ingredients.length}
          >
            {busy
              ? "Working…"
              : pending
                ? "Retry same save"
                : "Save draft & preview"}
          </button>
          <button
            type="button"
            className={button}
            disabled={!saved || dirty || busy || pending}
            onClick={publish}
          >
            Publish saved version
          </button>
          {(dirty || pending) && (
            <button
              type="button"
              disabled={busy || pending}
              className={button}
              onClick={discard}
            >
              Discard local changes
            </button>
          )}
        </div>
        {dirty && saved && (
          <p className="mt-3 text-sm text-amber-100">
            Unsaved changes. Nutrition below belongs to saved version{" "}
            {saved.version}.
          </p>
        )}
      </form>
      {saved && (
        <>
          <Nutrition recipe={saved} />
          <SourceNotice recipe={saved} />
          {published && (
            <Link className={button} href={`/recipes/${saved.public_id}`}>
              Open published recipe
            </Link>
          )}
        </>
      )}
    </div>
  );
}
