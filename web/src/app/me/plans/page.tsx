"use client";
import { usePlayerCopy } from "@/components/account/playerCopy";

import { useEffect, useState } from "react";
import { campPlanService, type CampPlan } from "@/services/campPlans";
import { PlanDetails } from "@/components/plans/PlanDetails";
export default function MyPlansPage() {
  const { t } = usePlayerCopy();
  const [items, setItems] = useState<CampPlan[]>([]),
    [more, setMore] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    campPlanService
      .mine()
      .then((data) => {
        if (active) {
          setItems(data.items);
          setMore(data.has_more);
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
  }, [attempt]);
  async function loadMore() {
    setLoading(true);
    setError("");
    try {
      const data = await campPlanService.mine(items.length);
      setItems((current) => [...current, ...data.items]);
      setMore(data.has_more);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Could not load plans."));
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="min-w-0">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("Training plans")}</h1>
      <p className="mt-2 max-w-prose text-sm leading-6 text-[var(--ui-muted)]">
        {t("See what your coach has planned for your class or for you.")}
      </p>
      {error && (
        <div role="alert" className="mt-5 text-red-200">
          {t(error)}
          <button
            className="ml-3 min-h-11 underline"
            onClick={() => setAttempt((v) => v + 1)}
          >
            {t("Reload plans")}
          </button>
        </div>
      )}
      {loading && (
        <p role="status" className="mt-6">
          {t("Loading plans…")}
        </p>
      )}
      {!loading && !error && items.length === 0 && (
        <p className="ui-panel mt-6 p-5 text-sm text-[var(--ui-muted)]">
          {t("No published plans yet. Your coach’s plans will appear here.")}
        </p>
      )}
      <div className="mt-6 grid gap-4">
        {items.map((plan) => (
          <article key={plan.public_id} className="ui-panel p-4 sm:p-6">
            <PlanDetails plan={plan} />
          </article>
        ))}
      </div>
      {more && (
        <button
          disabled={loading}
          className="ui-button mt-4"
          onClick={loadMore}
        >
          {t("Load more plans")}
        </button>
      )}
    </section>
  );
}
