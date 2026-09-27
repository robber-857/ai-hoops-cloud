"use client";
import { useEffect, useRef, useState } from "react";
import { CoachShell } from "@/components/coach/CoachShell";
import { PlanDetails, focusLabels } from "@/components/plans/PlanDetails";
import { useAuthStore } from "@/store/authStore";
import {
  coachService,
  type CoachClassRead,
  type CoachStudentRead,
} from "@/services/coach";
import {
  templateService,
  type TrainingTemplateRead,
} from "@/services/templates";
import {
  campPlanService,
  type CampPlan,
  type PlanContent,
  type PlanItem,
} from "@/services/campPlans";
const field =
  "mt-2 min-h-11 w-full min-w-0 rounded-lg border border-white/25 bg-[#10141b] px-3 py-2 text-base text-white focus-visible:outline-2 focus-visible:outline-[#d8ff5d]";
const button =
  "min-h-11 rounded-lg border border-white/30 px-4 py-2 text-sm disabled:opacity-50";
const emptyItem = (): PlanItem => ({
  name: "",
  sets: null,
  reps: null,
  duration_minutes: null,
  instructions: null,
  template_code: null,
});
const empty = (): PlanContent => ({
  title: "",
  planned_on: new Date().toLocaleDateString("en-CA", {
    timeZone: "Australia/Sydney",
  }),
  focus: "general",
  notes: null,
  items: [emptyItem()],
});
const content = (plan: CampPlan): PlanContent => ({
  title: plan.title,
  planned_on: plan.planned_on,
  focus: plan.focus,
  notes: plan.notes,
  items: plan.items.map(({ analysis_type, template_version, ...item }) => {
    void analysis_type;
    void template_version;
    return item;
  }),
});
export default function CoachPlansPage() {
  const user = useAuthStore((s) => s.user);
  const [classes, setClasses] = useState<CoachClassRead[]>([]),
    [classId, setClassId] = useState(""),
    [students, setStudents] = useState<CoachStudentRead[]>([]),
    [templates, setTemplates] = useState<TrainingTemplateRead[]>([]);
  const [plans, setPlans] = useState<CampPlan[]>([]),
    [more, setMore] = useState(false),
    [form, setForm] = useState(empty),
    [studentId, setStudentId] = useState(""),
    [editing, setEditing] = useState<CampPlan | null>(null),
    [previous, setPrevious] = useState<string | null>(null);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [reload, setReload] = useState(0),
    [templateError, setTemplateError] = useState("");
  const requestId = useRef<string | null>(null),
    inFlight = useRef(false);
  const allowed = user?.role === "coach" || user?.role === "admin";
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    coachService
      .listClasses()
      .then((data) => {
        if (active) {
          const rows = data.items.filter((c) => c.status === "active");
          setClasses(rows);
          setClassId((id) => id || rows[0]?.public_id || "");
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setLoading(false);
        }
      });
    templateService
      .listTemplates()
      .then((data) => {
        if (active)
          setTemplates(
            data.filter((t) =>
              ["training", "shooting", "dribbling"].includes(t.analysis_type),
            ),
          );
      })
      .catch(() => {
        if (active)
          setTemplateError(
            "Assessment links are unavailable. You can still save ordinary training activities.",
          );
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
      coachService.listClassStudents(classId),
    ])
      .then(([p, s]) => {
        if (active) {
          setPlans(p.items);
          setMore(p.has_more);
          setStudents(s.items);
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
  }, [classId, reload]);
  useEffect(() => {
    if (!dirty) return;
    const before = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const click = (e: MouseEvent) => {
      if (
        (e.target as Element).closest?.("a[href]") &&
        !window.confirm("Leave without saving this plan?")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", before);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", before);
      document.removeEventListener("click", click, true);
    };
  }, [dirty]);
  function change(next: PlanContent) {
    setForm(next);
    setDirty(true);
    setNotice("");
    requestId.current = null;
  }
  function reset() {
    setForm(empty());
    setEditing(null);
    setPrevious(null);
    setStudentId("");
    setDirty(false);
    requestId.current = null;
  }
  function canLeave() {
    return !dirty || window.confirm("Discard unsaved plan changes?");
  }
  function edit(plan: CampPlan, revision = false) {
    if (!canLeave()) return;
    setForm(content(plan));
    setStudentId(plan.student_public_id || "");
    setEditing(revision ? null : plan);
    setPrevious(revision ? plan.public_id : null);
    setDirty(false);
    setNotice("");
    requestId.current = null;
    document
      .getElementById("plan-editor")
      ?.scrollIntoView({ behavior: "smooth" });
  }
  async function save() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      requestId.current ??= crypto.randomUUID();
      const saved = editing
        ? await campPlanService.update(classId, editing, form)
        : await campPlanService.create(classId, {
            ...form,
            request_id: requestId.current,
            student_public_id: studentId || null,
            supersedes_public_id: previous,
          });
      setEditing(saved);
      setDirty(false);
      requestId.current = null;
      setNotice("Draft saved. Review it below before publishing.");
      setReload((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save plan. Retry.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function publish(plan: CampPlan) {
    if (
      inFlight.current ||
      !canLeave() ||
      !window.confirm(
        `Publish “${plan.title}” to ${plan.student_name || "this class"}? Published content can only be corrected with a new revision.`,
      )
    )
      return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await campPlanService.publish(plan);
      reset();
      setNotice("Plan published. Players can now view it.");
      setReload((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not publish. Retry.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function loadMore() {
    setBusy(true);
    try {
      const data = await campPlanService.list(classId, plans.length);
      setPlans((p) => [...p, ...data.items]);
      setMore(data.has_more);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load more plans.");
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
      title="Training plans"
      breadcrumb={["Training plans"]}
    >
      <div className="min-w-0 max-w-5xl text-white">
        <p className="mt-3 max-w-prose text-white/75">
          Build a class plan or tailor one for a player. Save a draft, review
          the activities, then publish.
        </p>
        {error && (
          <div role="alert" className="mt-5 text-red-200">
            {error}
            <button
              className="ml-3 min-h-11 underline"
              onClick={() => setReload((v) => v + 1)}
            >
              Reload plans
            </button>
          </div>
        )}
        {notice && (
          <p role="status" className="mt-5 text-[#d8ff5d]">
            {notice}
          </p>
        )}
        {loading && (
          <p role="status" className="mt-5">
            Loading plans…
          </p>
        )}
        <label className="mt-6 block max-w-lg text-sm">
          Class
          <select
            className={field}
            value={classId}
            aria-label="Class"
            disabled={busy || loading}
            onChange={(e) => {
              if (canLeave()) {
                reset();
                setPlans([]);
                setClassId(e.target.value);
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
        {!loading && !classes.length && !error && (
          <p className="mt-5">No active classes are assigned to you.</p>
        )}
        {classId && (
          <>
            <form
              id="plan-editor"
              className="mt-8 border-t border-white/20 pt-6"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <h2 className="text-xl font-semibold">
                {editing
                  ? "Edit draft"
                  : previous
                    ? "New revision"
                    : "New plan"}
              </h2>
              <fieldset
                disabled={busy || loading}
                className="mt-5 min-w-0 space-y-5"
              >
                <div className="grid min-w-0 gap-5 sm:grid-cols-2">
                  <label className="min-w-0 text-sm">
                    Plan title
                    <input
                      className={field}
                      required
                      maxLength={120}
                      value={form.title}
                      onChange={(e) =>
                        change({ ...form, title: e.target.value })
                      }
                    />
                  </label>
                  <label className="min-w-0 text-sm">
                    Planned date
                    <input
                      className={field}
                      required
                      type="date"
                      value={form.planned_on}
                      onChange={(e) =>
                        change({ ...form, planned_on: e.target.value })
                      }
                    />
                  </label>
                  <label className="min-w-0 text-sm">
                    Recipient
                    <select
                      className={field}
                      disabled={Boolean(editing || previous)}
                      value={studentId}
                      aria-label="Recipient"
                      onChange={(e) => {
                        setStudentId(e.target.value);
                        setDirty(true);
                        requestId.current = null;
                      }}
                    >
                      <option value="">Whole class</option>
                      {students.map((s) => (
                        <option key={s.public_id} value={s.public_id}>
                          {s.nickname || s.username}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="min-w-0 text-sm">
                    Training focus
                    <select
                      className={field}
                      value={form.focus}
                      aria-label="Training focus"
                      onChange={(e) =>
                        change({ ...form, focus: e.target.value })
                      }
                    >
                      {Object.entries(focusLabels).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block text-sm">
                  Plan notes
                  <textarea
                    className={field}
                    maxLength={2000}
                    value={form.notes || ""}
                    onChange={(e) =>
                      change({ ...form, notes: e.target.value || null })
                    }
                  />
                </label>
                {templateError && (
                  <p className="text-sm text-white/75">{templateError}</p>
                )}
                <ol className="divide-y divide-white/20">
                  {form.items.map((item, index) => {
                    const update = (changes: Partial<PlanItem>) =>
                      change({
                        ...form,
                        items: form.items.map((row, i) =>
                          i === index ? { ...row, ...changes } : row,
                        ),
                      });
                    return (
                      <li key={index} className="min-w-0 py-6">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="font-semibold">
                            Activity {index + 1}
                          </h3>
                          <button
                            type="button"
                            className={button}
                            disabled={form.items.length === 1}
                            onClick={() =>
                              change({
                                ...form,
                                items: form.items.filter((_, i) => i !== index),
                              })
                            }
                          >
                            Remove activity {index + 1}
                          </button>
                        </div>
                        <label className="mt-3 block text-sm">
                          Activity name
                          <input
                            className={field}
                            required
                            maxLength={120}
                            value={item.name}
                            onChange={(e) => update({ name: e.target.value })}
                          />
                        </label>
                        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                          {(["sets", "reps", "duration_minutes"] as const).map(
                            (key) => (
                              <label key={key} className="text-sm">
                                {
                                  {
                                    sets: "Sets",
                                    reps: "Repetitions",
                                    duration_minutes: "Planned minutes",
                                  }[key]
                                }
                                <input
                                  type="number"
                                  className={field}
                                  min={key === "duration_minutes" ? 0.1 : 1}
                                  max={
                                    key === "sets"
                                      ? 100
                                      : key === "reps"
                                        ? 10000
                                        : 1440
                                  }
                                  step={key === "duration_minutes" ? 0.1 : 1}
                                  value={item[key] ?? ""}
                                  onChange={(e) =>
                                    update({
                                      [key]: e.target.value
                                        ? Number(e.target.value)
                                        : null,
                                    })
                                  }
                                />
                              </label>
                            ),
                          )}
                        </div>
                        <label className="mt-4 block text-sm">
                          Instructions
                          <textarea
                            className={field}
                            maxLength={1000}
                            value={item.instructions || ""}
                            onChange={(e) =>
                              update({ instructions: e.target.value || null })
                            }
                          />
                        </label>
                        <label className="mt-4 block text-sm">
                          Optional assessment
                          <select
                            className={field}
                          value={item.template_code || ""}
                          aria-label={`Assessment for activity ${index + 1}`}
                            onChange={(e) =>
                              update({ template_code: e.target.value || null })
                            }
                          >
                            <option value="">No video assessment</option>
                            {item.template_code &&
                              !templates.some(
                                (t) => t.template_code === item.template_code,
                              ) && (
                                <option value={item.template_code}>
                                  {item.template_code} · unavailable
                                </option>
                              )}
                            {templates.map((t) => (
                              <option
                                key={t.template_code}
                                value={t.template_code}
                              >
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </li>
                    );
                  })}
                </ol>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className={button}
                    disabled={form.items.length >= 40}
                    onClick={() =>
                      change({ ...form, items: [...form.items, emptyItem()] })
                    }
                  >
                    Add activity
                  </button>
                  <button
                    className="min-h-11 rounded-lg bg-[#d8ff5d] px-5 font-semibold text-black disabled:opacity-50"
                    type="submit"
                  >
                    {busy ? "Saving…" : "Save draft"}
                  </button>
                  <button
                    type="button"
                    className={button}
                    onClick={() => {
                      if (canLeave()) reset();
                    }}
                  >
                    Start new plan
                  </button>
                </div>
              </fieldset>
            </form>
            <section className="mt-12 border-t border-white/20 pt-6">
              <h2 className="text-2xl font-semibold">Saved plans</h2>
              <p className="mt-2 text-sm text-white/75">
                Newest planned dates first. Published revisions preserve earlier
                versions. Personal plans are shown alongside class plans.
              </p>
              {!loading && !error && !plans.length && (
                <p className="mt-6">No plans saved for this class yet.</p>
              )}
              <div className="mt-4 divide-y divide-white/20">
                {plans.map((plan) => (
                  <article key={plan.public_id} className="py-6">
                    <PlanDetails plan={plan} />
                    <div className="mt-3 flex flex-wrap gap-3">
                      {plan.status === "draft" ? (
                        <>
                          <button
                            className={button}
                            disabled={busy}
                            onClick={() => edit(plan)}
                          >
                            Edit draft
                          </button>
                          <button
                            className={button}
                            disabled={busy}
                            onClick={() => publish(plan)}
                          >
                            Publish plan
                          </button>
                        </>
                      ) : (
                        <button
                          className={button}
                          disabled={busy}
                          onClick={() => edit(plan, true)}
                        >
                          Create revision
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
              {more && (
                <button className={button} disabled={busy} onClick={loadMore}>
                  Load more plans
                </button>
              )}
            </section>
          </>
        )}
      </div>
    </CoachShell>
  );
}
