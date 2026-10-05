"use client";
import { useEffect, useState } from "react";
import { campPlanService, type CampPlan } from "@/services/campPlans";
import { PlanDetails } from "@/components/plans/PlanDetails";
export default function MyPlansPage() {
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
      setError(e instanceof Error ? e.message : "Could not load plans.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="min-w-0">
      <h1 className="text-3xl font-semibold">Training plans</h1>
      <p className="mt-3 max-w-prose text-white/75">
        Your coach’s published class and personal plans. Planned activities do
        not record attendance or completed training.
      </p>
      {error && (
        <div role="alert" className="mt-5 text-red-200">
          {error}
          <button
            className="ml-3 min-h-11 underline"
            onClick={() => setAttempt((v) => v + 1)}
          >
            Reload plans
          </button>
        </div>
      )}
      {loading && (
        <p role="status" className="mt-6">
          Loading plans…
        </p>
      )}
      {!loading && !error && items.length === 0 && (
        <p className="mt-8 text-white/75">
          No published plans yet. Your coach’s plans will appear here.
        </p>
      )}
      <div className="mt-8 divide-y divide-white/20">
        {items.map((plan) => (
          <article key={plan.public_id} className="py-6">
            <PlanDetails plan={plan} />
          </article>
        ))}
      </div>
      {more && (
        <button
          disabled={loading}
          className="mt-4 min-h-11 rounded-lg border border-white/30 px-5 disabled:opacity-50"
          onClick={loadMore}
        >
          Load more plans
        </button>
      )}
    </section>
  );
}
