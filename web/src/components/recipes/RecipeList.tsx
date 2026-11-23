"use client";

import { useInterfaceText } from "@/hooks/useInterfaceText";

import { useEffect, useState } from "react";
import Link from "next/link";
import { recipeService, type RecipeSummary } from "@/services/recipes";
import { button, primary, ErrorNotice } from "./RecipeShared";
export function RecipeList({ admin = false }: { admin?: boolean }) {
  const t = useInterfaceText();
  const [rows, setRows] = useState<RecipeSummary[]>([]),
    [offset, setOffset] = useState(0),
    [more, setMore] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    recipeService
      .list(admin, offset)
      .then((d) => {
        if (active) {
          setRows(d.items);
          setMore(d.has_more);
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
  }, [admin, offset, retry]);
  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">
          {admin ? t("Manage recipes") : t("Recipe library")}
        </h1>
        {admin && (
          <Link href="/admin/recipes/new" className={primary}>
            {t("Create recipe")}
          </Link>
        )}
      </div>
      <p className="mt-3 max-w-2xl text-white/70">
        {admin
          ? t("Maintain ingredients, review nutrition and publish recipes for players and coaches.")
          : t("Explore published recipes and adjust serving sizes. Nutrition values are estimates, not personal meal targets.")}
      </p>
      {error && (
        <ErrorNotice error={error} retry={() => setRetry((v) => v + 1)} />
      )}{" "}
      {loading ? (
        <p className="py-8" role="status">
          {t("Loading recipes…")}
        </p>
      ) : (
        !error &&
        (!rows.length ? (
          <p className="py-10">
            {admin
              ? t("No recipes yet. Create your first draft.")
              : t("No recipes have been published yet. Please check back later.")}
          </p>
        ) : (
          <ul className="mt-8 divide-y divide-white/20 border-y border-white/20">
            {rows.map((r) => (
              <li key={r.public_id}>
                <Link
                  className="flex min-h-24 items-center justify-between gap-4 py-6 hover:text-[#d8ff5d]"
                  href={`${admin ? "/admin" : ""}/recipes/${r.public_id}`}
                >
                  <span className="min-w-0 break-words text-xl font-semibold">
                    {r.title}
                  </span>
                  <span className="shrink-0 text-sm text-white/70">
                    {admin ? t("Draft") : t("Published")} v{r.version} →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ))
      )}
      <div className="mt-6 flex gap-3">
        <button
          className={button}
          disabled={loading || offset === 0}
          onClick={() => setOffset((v) => Math.max(0, v - 20))}
        >
          {t("Previous recipes")}
        </button>
        <button
          className={button}
          disabled={loading || !more || !!error}
          onClick={() => setOffset((v) => v + 20)}
        >
          {t("Next recipes")}
        </button>
      </div>
    </div>
  );
}
