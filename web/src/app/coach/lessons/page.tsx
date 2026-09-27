"use client";
import { useEffect, useRef, useState } from "react";
import { CoachShell } from "@/components/coach/CoachShell";
import {
  LessonEditor,
  lessonButton,
  lessonField,
} from "@/components/lessons/LessonEditor";
import { useAuthStore } from "@/store/authStore";
import { coachService, type CoachClassRead } from "@/services/coach";
import { campPlanService, type CampPlan } from "@/services/campPlans";
import {
  campLessonService,
  type CampLesson,
  type LessonSummary,
} from "@/services/campLessons";
export default function CoachLessonsPage() {
  const user = useAuthStore((s) => s.user),
    allowed = user?.role === "coach" || user?.role === "admin";
  const [classes, setClasses] = useState<CoachClassRead[]>([]),
    [classId, setClassId] = useState(""),
    [plans, setPlans] = useState<CampPlan[]>([]),
    [planId, setPlanId] = useState(""),
    [planOffset, setPlanOffset] = useState(0),
    [morePlans, setMorePlans] = useState(false),
    [date, setDate] = useState(() =>
      new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" }),
    );
  const [lessons, setLessons] = useState<LessonSummary[]>([]),
    [more, setMore] = useState(false),
    [selected, setSelected] = useState<CampLesson | null>(null),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [reload, setReload] = useState(0);
  const requestId = useRef<string | null>(null),
    inFlight = useRef(false);
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    setLoading(true);
    coachService
      .listClasses()
      .then((data) => {
        if (!active) return;
        const rows = data.items.filter((c) => c.status === "active");
        setClasses(rows);
        const requested = new URLSearchParams(window.location.search).get(
          "classId",
        );
        setClassId(
          (current) =>
            current ||
            rows.find((c) => c.public_id === requested)?.public_id ||
            rows[0]?.public_id ||
            "",
        );
        if (!rows.length) setLoading(false);
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
  }, [allowed, reload]);
  useEffect(() => {
    if (!classId) return;
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([
      campPlanService.list(classId),
      campLessonService.list(classId),
    ])
      .then(async ([p, l]) => {
        if (!active) return;
        const published = p.items.filter((plan) => plan.status === "published");
        const params = new URLSearchParams(window.location.search);
        const requested =
          params.get("classId") === classId ? params.get("planId") : null;
        if (
          requested &&
          !published.some((plan) => plan.public_id === requested)
        ) {
          const requestedPlan = await campPlanService.get(classId, requested);
          if (requestedPlan.status !== "published")
            throw new Error("The linked plan is not published.");
          published.push(requestedPlan);
        }
        if (!active) return;
        setPlans(published);
        setMorePlans(p.has_more);
        setPlanOffset(p.items.length);
        setLessons(l.items);
        setMore(l.has_more);
        setPlanId((current) =>
          published.some((plan) => plan.public_id === current)
            ? current
            : published.find((plan) => plan.public_id === requested)
                ?.public_id ||
              published[0]?.public_id ||
              "",
        );
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
  }, [classId, reload]);
  function canLeave() {
    return !dirty || window.confirm("Discard unsaved lesson changes?");
  }
  async function create() {
    if (inFlight.current || !canLeave()) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      requestId.current ??= crypto.randomUUID();
      const lesson = await campLessonService.create(classId, {
        request_id: requestId.current,
        plan_public_id: planId,
        held_on: date,
      });
      setSelected(lesson);
      setDirty(false);
      requestId.current = null;
      setNotice(
        "Lesson created. Actual minutes are unknown and every player is unconfirmed.",
      );
      setReload((v) => v + 1);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not create lesson. Retry.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function open(id: string) {
    if (!canLeave()) return;
    setBusy(true);
    setError("");
    try {
      setSelected(await campLessonService.get(classId, id));
      setDirty(false);
      setNotice("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load lesson.");
    } finally {
      setBusy(false);
    }
  }
  async function loadMore(kind: "plans" | "lessons") {
    setBusy(true);
    setError("");
    try {
      if (kind === "plans") {
        const p = await campPlanService.list(classId, planOffset);
        setPlans((rows) => [
          ...rows,
          ...p.items.filter(
            (plan) =>
              plan.status === "published" &&
              !rows.some((row) => row.public_id === plan.public_id),
          ),
        ]);
        setPlanOffset((v) => v + p.items.length);
        setMorePlans(p.has_more);
      } else {
        const l = await campLessonService.list(classId, lessons.length);
        setLessons((rows) => [...rows, ...l.items]);
        setMore(l.has_more);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load more records.");
    } finally {
      setBusy(false);
    }
  }
  if (!user) return <p role="status">Loading account…</p>;
  if (!allowed)
    return (
      <p role="alert" className="p-8">
        Coach access is required.
      </p>
    );
  return (
    <CoachShell
      user={user}
      title="Actual lessons"
      breadcrumb={["Actual lessons"]}
    >
      <div className="min-w-0 max-w-5xl text-white">
        <p className="max-w-prose text-white/75">
          Record what happened in class. Start from a published plan, enter
          actual activities, then review each player’s participation.
        </p>
        {error && (
          <div role="alert" className="mt-5 text-red-200">
            {error}
            <button
              className="ml-3 min-h-11 underline"
              onClick={() => setReload((v) => v + 1)}
            >
              Reload lists
            </button>
          </div>
        )}
        {notice && (
          <p role="status" className="mt-5 text-[#d8ff5d]">
            {notice}
          </p>
        )}
        {loading && (
          <p role="status" className="mt-4">
            Loading lessons…
          </p>
        )}
        <label className="mt-6 block max-w-lg text-sm">
          Class
          <select
            aria-label="Class"
            className={lessonField}
            value={classId}
            disabled={loading || busy}
            onChange={(e) => {
              if (canLeave()) {
                setClassId(e.target.value);
                setPlans([]);
                setLessons([]);
                setSelected(null);
                setDirty(false);
                setPlanId("");
                requestId.current = null;
                setNotice("");
              }
            }}
          >
            {classes.map((c) => (
              <option key={c.public_id} value={c.public_id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {!loading && !error && !classes.length && (
          <p className="mt-5">No active classes are assigned to you.</p>
        )}
        {classId && (
          <>
            <form
              className="mt-8 border-t border-white/20 pt-6"
              onSubmit={(e) => {
                e.preventDefault();
                void create();
              }}
            >
              <h2 className="text-xl font-semibold">Start a lesson</h2>
              <fieldset
                disabled={busy || loading}
                className="mt-5 min-w-0 space-y-4"
              >
                <div className="grid min-w-0 gap-5 sm:grid-cols-2">
                  <label className="min-w-0 text-sm">
                    Published plan
                    <select
                      required
                      aria-label="Published plan"
                      className={lessonField}
                      value={planId}
                      onChange={(e) => {
                        setPlanId(e.target.value);
                        requestId.current = null;
                      }}
                    >
                      <option value="">Select a plan</option>
                      {plans.map((p) => (
                        <option key={p.public_id} value={p.public_id}>
                          {p.title} · {p.planned_on} ·{" "}
                          {p.student_name || "Class plan"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="min-w-0 text-sm">
                    Lesson date
                    <input
                      className={lessonField}
                      type="date"
                      required
                      value={date}
                      onChange={(e) => {
                        setDate(e.target.value);
                        requestId.current = null;
                      }}
                    />
                  </label>
                </div>
                {!loading && !plans.length && (
                  <p className="text-sm text-white/75">
                    No published plans in this page. Publish a plan first, or
                    load older plans.
                  </p>
                )}
                <div className="flex flex-wrap gap-3">
                  <button
                    className={lessonButton}
                    type="submit"
                    disabled={!planId}
                  >
                    Create lesson record
                  </button>
                  {morePlans && (
                    <button
                      className={lessonButton}
                      type="button"
                      onClick={() => loadMore("plans")}
                    >
                      Load older plans
                    </button>
                  )}
                </div>
              </fieldset>
            </form>
            <section className="mt-8 border-t border-white/20 pt-6">
              <h2 className="text-xl font-semibold">Saved lessons</h2>
              {!loading && !error && !lessons.length && (
                <p className="mt-4 text-white/75">
                  No actual lessons recorded for this class yet.
                </p>
              )}
              <ul className="mt-4 divide-y divide-white/15">
                {lessons.map((l) => (
                  <li
                    key={l.public_id}
                    className="flex flex-wrap items-center justify-between gap-3 py-4"
                  >
                    <div className="min-w-0 break-words">
                      <h3 className="font-semibold">{l.title}</h3>
                      <p className="mt-1 text-sm text-white/75">
                        {l.held_on} · Version {l.version} ·{" "}
                        {l.unconfirmed_count} unconfirmed ·{" "}
                        {l.missing_minutes_count} activities without minutes
                      </p>
                    </div>
                    <button
                      className={lessonButton}
                      disabled={busy || loading}
                      onClick={() => open(l.public_id)}
                    >
                      Open lesson
                    </button>
                  </li>
                ))}
              </ul>
              {more && (
                <button
                  className={lessonButton}
                  disabled={busy || loading}
                  onClick={() => loadMore("lessons")}
                >
                  Load more lessons
                </button>
              )}
            </section>
            {selected && (
              <LessonEditor
                key={`${selected.public_id}:${selected.version}`}
                lesson={selected}
                onDirty={setDirty}
                onBusy={setBusy}
                onSaved={(lesson) => {
                  setSelected(lesson);
                  setDirty(false);
                  setNotice(
                    `Lesson saved as version ${lesson.version}. Earlier versions are unchanged.`,
                  );
                  setReload((v) => v + 1);
                }}
              />
            )}
          </>
        )}
      </div>
    </CoachShell>
  );
}
