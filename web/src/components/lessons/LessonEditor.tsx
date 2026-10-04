"use client";
import { useEffect, useRef, useState } from "react";
import {
  campLessonService,
  lessonContent,
  type CampLesson,
  type LessonContent,
  type LessonItem,
  type LessonParticipant,
  type LessonHistoryEntry,
  type ExerciseActivity,
  type ActivityIntensity,
} from "@/services/campLessons";
export const lessonField =
  "mt-2 min-h-11 w-full min-w-0 rounded-lg border border-white/25 bg-[#10141b] px-3 py-2 text-base text-white focus-visible:outline-2 focus-visible:outline-[#d8ff5d]";
export const lessonButton =
  "min-h-11 rounded-lg border border-white/30 px-4 py-2 text-sm disabled:opacity-50";
const statusLabels = {
  unconfirmed: "Unconfirmed",
  present: "Full attendance",
  absent: "Absent",
  left_early: "Left early",
  partial: "Partial participation",
};
export function LessonEditor({
  lesson,
  onSaved,
  onDirty,
  onBusy,
  disabled = false,
}: {
  lesson: CampLesson;
  disabled?: boolean;
  onSaved: (l: CampLesson) => void;
  onDirty: (dirty: boolean) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [form, setForm] = useState(() => lessonContent(lesson)),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [history, setHistory] = useState<LessonHistoryEntry[]>([]),
    [more, setMore] = useState(false),
    [historyOpen, setHistoryOpen] = useState(false);
  const requestId = useRef<string | null>(null),
    inFlight = useRef(false);
  const [activities, setActivities] = useState<ExerciseActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [activitiesError, setActivitiesError] = useState("");
  const [activitiesRetry, setActivitiesRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setActivitiesLoading(true);
    setActivitiesError("");
    campLessonService.exerciseActivities()
      .then((value) => { if (active) setActivities(value.items); })
      .catch((e) => {
        if (active) setActivitiesError(e instanceof Error ? e.message : "Could not load activity standards.");
      })
      .finally(() => { if (active) setActivitiesLoading(false); });
    return () => { active = false; };
  }, [activitiesRetry]);
  useEffect(() => {
    onBusy(busy);
    return () => onBusy(false);
  }, [busy, onBusy]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const click = (e: MouseEvent) => {
      if (
        (e.target as Element).closest?.("a[href]") &&
        !window.confirm("Leave without saving this lesson?")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
    };
  }, [dirty]);
  function change(next: LessonContent) {
    setForm(next);
    setDirty(true);
    onDirty(true);
    requestId.current = null;
    setNotice("");
    setError("");
  }
  function changeActivities(items: LessonItem[]) {
    change({
      ...form,
      items,
      participants: form.participants.map((p) => ({
        ...p,
        status: p.status === "absent" ? "absent" : "unconfirmed",
        items: items.map((i) => ({
          item_id: i.item_id,
          minutes: p.status === "absent" ? "0" : null,
        })),
      })),
    });
    setNotice(
      "Activities changed. Review and confirm each player’s participation again; absences were retained.",
    );
  }
  function player(index: number, changes: Partial<LessonParticipant>) {
    change({
      ...form,
      participants: form.participants.map((p, i) =>
        i === index ? { ...p, ...changes } : p,
      ),
    });
  }
  function status(index: number, value: LessonParticipant["status"]) {
    player(index, {
      status: value,
      items: form.items.map((i) => ({
        item_id: i.item_id,
        minutes:
          value === "unconfirmed"
            ? null
            : value === "absent"
              ? "0"
              : value === "present"
                ? i.actual_minutes
                : null,
      })),
    });
  }
  async function save() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      requestId.current ??= crypto.randomUUID();
      const saved = await campLessonService.save(
        lesson,
        form,
        requestId.current,
      );
      setDirty(false);
      onDirty(false);
      onSaved(saved);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not save. Retry with your changes intact.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function loadHistory(append = false) {
    setBusy(true);
    setError("");
    try {
      const data = await campLessonService.history(
        lesson,
        append ? history.length : 0,
      );
      setHistory((h) => (append ? [...h, ...data.items] : data.items));
      setMore(data.has_more);
      setHistoryOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load history.");
    } finally {
      setBusy(false);
    }
  }
  async function restore(version: number) {
    if (
      dirty &&
      !window.confirm("Replace unsaved edits with this historical version?")
    )
      return;
    setBusy(true);
    setError("");
    try {
      const old = await campLessonService.revision(lesson, version);
      change(lessonContent(old));
      setNotice(
        `Version ${version} loaded into the editor. Save to add a new version; existing history stays unchanged.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load version.");
    } finally {
      setBusy(false);
    }
  }
  const unknownMinutes = form.items.some((i) => i.actual_minutes === null);
  return (
    <section
      id="lesson-editor"
      className="mt-8 min-w-0 border-t border-white/20 pt-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">Record actual lesson</h2>
        <span className="text-sm text-white/75">
          Saved version {lesson.version}
          {dirty ? " · Unsaved changes" : ""}
        </span>
      </div>
      <p className="mt-3 text-sm text-white/75">
        {lesson.class_name} · Dates use {lesson.timezone}. Save your changes,
        then preview and publish class records below.
      </p>
      <details className="mt-4 text-sm">
        <summary className="min-h-11 cursor-pointer py-3 text-white/85">
          Source plan: {lesson.source_plan.title}
        </summary>
        <ul className="space-y-2 py-3 text-white/75">
          {lesson.source_plan.items.map((i, index) => (
            <li key={index}>
              {i.name} ·{" "}
              {i.duration_minutes === null
                ? "No planned duration"
                : `${i.duration_minutes} planned min`}
            </li>
          ))}
        </ul>
        <p className="text-white/75">
          This source snapshot is unchanged by actual lesson edits.
        </p>
      </details>
      {error && (
        <p role="alert" className="mt-4 text-red-200">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4 text-[#d8ff5d]">
          {notice}
        </p>
      )}
      <form
        className="mt-6"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={busy || disabled} className="min-w-0 space-y-6">
          <div className="grid min-w-0 gap-5 sm:grid-cols-2">
            <label className="text-sm">
              Lesson title
              <input
                className={lessonField}
                required
                maxLength={120}
                value={form.title}
                onChange={(e) => change({ ...form, title: e.target.value })}
              />
            </label>
            <label className="text-sm">
              Lesson date
              <input
                type="date"
                className={lessonField}
                required
                value={form.held_on}
                onChange={(e) => change({ ...form, held_on: e.target.value })}
              />
            </label>
          </div>
          <label className="block text-sm">
            Lesson notes
            <textarea
              className={lessonField}
              maxLength={2000}
              value={form.notes || ""}
              onChange={(e) =>
                change({ ...form, notes: e.target.value || null })
              }
            />
          </label>
          <section>
            <h3 className="text-xl font-semibold">Actual activities</h3>
            <p className="mt-2 max-w-prose text-sm text-white/75">
              Record effective activity minutes, excluding breaks, explanations
              and queue time. Leave unknown minutes blank. Enter 0 if an activity did not take
              place. Changing durations or activities resets participation for
              review.
            </p>
            <p className="mt-2 max-w-prose text-sm text-white/75">
              Choose the activity standard and intensity that match the actual
              exercise for an energy estimate. Keep your own activity name;
              unmatched activities can still be recorded.
            </p>
            {activitiesLoading && <p role="status" className="mt-3 text-sm">Loading activity standards…</p>}
            {activitiesError && <div role="alert" className="mt-3 text-sm text-amber-200">
              <p>{activitiesError} You can still save the training record.</p>
              <button type="button" className={`${lessonButton} mt-2`} onClick={() => setActivitiesRetry(value => value + 1)}>
                Reload activity standards
              </button>
            </div>}
            <ol className="mt-4 divide-y divide-white/20">
              {form.items.map((item, index) => (
                <li key={item.item_id} className="min-w-0 py-5">
                  <div className="grid min-w-0 gap-4 sm:grid-cols-[1fr_10rem]">
                    <label className="text-sm">
                      Activity {index + 1}
                      <input
                        className={lessonField}
                        required
                        maxLength={120}
                        value={item.name}
                        onChange={(e) =>
                          change({
                            ...form,
                            items: form.items.map((i) =>
                              i.item_id === item.item_id
                                ? { ...i, name: e.target.value }
                                : i,
                            ),
                          })
                        }
                      />
                    </label>
                    <label className="text-sm">
                      Actual minutes
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        max="1440"
                        className={lessonField}
                        value={item.actual_minutes ?? ""}
                        onChange={(e) =>
                          changeActivities(
                            form.items.map((i) =>
                              i.item_id === item.item_id
                                ? {
                                    ...i,
                                    actual_minutes: e.target.value || null,
                                  }
                                : i,
                            ),
                          )
                        }
                      />
                    </label>
                  </div>
                  <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
                    <label className="min-w-0 text-sm">
                      Activity standard
                      <select
                        className={lessonField}
                        aria-label={`Activity standard for activity ${index + 1}`}
                        value={item.activity_code ?? ""}
                        disabled={activitiesLoading || Boolean(activitiesError)}
                        onChange={(e) => change({
                          ...form,
                          items: form.items.map(i => i.item_id === item.item_id
                            ? { ...i, activity_code: e.target.value || null, intensity: null }
                            : i),
                        })}
                      >
                        <option value="">Custom activity / no standard selected</option>
                        {item.activity_code && !activities.some(a => a.code === item.activity_code) &&
                          <option value={item.activity_code}>Saved standard unavailable — reselect</option>}
                        {activities.map(activity => <option key={activity.code} value={activity.code}>{activity.name}</option>)}
                      </select>
                    </label>
                    <label className="min-w-0 text-sm">
                      Intensity
                      <select
                        className={lessonField}
                        aria-label={`Intensity for activity ${index + 1}`}
                        value={item.intensity ?? ""}
                        disabled={!item.activity_code || activitiesLoading || Boolean(activitiesError)}
                        onChange={(e) => change({
                          ...form,
                          items: form.items.map(i => i.item_id === item.item_id
                            ? { ...i, intensity: (e.target.value || null) as ActivityIntensity | null }
                            : i),
                        })}
                      >
                        <option value="">Select intensity</option>
                        {item.intensity && !activities.find(a => a.code === item.activity_code)?.intensities.includes(item.intensity) &&
                          <option value={item.intensity}>Saved intensity unavailable — reselect</option>}
                        {activities.find(a => a.code === item.activity_code)?.intensities.map(intensity =>
                          <option key={intensity} value={intensity}>{intensity[0].toUpperCase() + intensity.slice(1)}</option>)}
                      </select>
                    </label>
                  </div>
                  <label className="mt-4 block text-sm">
                    Activity notes
                    <textarea
                      className={lessonField}
                      maxLength={1000}
                      value={item.notes || ""}
                      onChange={(e) =>
                        change({
                          ...form,
                          items: form.items.map((i) =>
                            i.item_id === item.item_id
                              ? { ...i, notes: e.target.value || null }
                              : i,
                          ),
                        })
                      }
                    />
                  </label>
                  <button
                    className={`${lessonButton} mt-3`}
                    type="button"
                    disabled={form.items.length === 1}
                    onClick={() =>
                      changeActivities(
                        form.items.filter((i) => i.item_id !== item.item_id),
                      )
                    }
                  >
                    Remove activity {index + 1}
                  </button>
                </li>
              ))}
            </ol>
            <button
              type="button"
              className={lessonButton}
              disabled={form.items.length >= 40}
              onClick={() =>
                changeActivities([
                  ...form.items,
                  {
                    item_id: crypto.randomUUID(),
                    name: "",
                    actual_minutes: null,
                    notes: null,
                    activity_code: null,
                    intensity: null,
                  },
                ])
              }
            >
              Add actual activity
            </button>
          </section>
          <section className="border-t border-white/20 pt-6">
            <h3 className="text-xl font-semibold">Player participation</h3>
            <p className="mt-2 max-w-prose text-sm text-white/75">
              The roster was captured when this lesson was created. Confirm each
              player explicitly; unconfirmed players have no assumed attendance.
            </p>
            {unknownMinutes && (
              <p className="mt-3 text-sm text-amber-200">
                Enter all actual minutes before recording full or partial
                attendance. You can still save unknowns and absences.
              </p>
            )}
            <div className="mt-4 divide-y divide-white/20">
              {form.participants.map((p, index) => {
                const person = lesson.roster.find(
                  (r) => r.student_public_id === p.student_public_id,
                );
                const name = person?.name || "Name not added";
                const label = person?.contact
                  ? `${name} (${person.contact})`
                  : name;
                return (
                  <div key={p.student_public_id} className="min-w-0 py-6">
                    <div className="grid min-w-0 items-center gap-4 sm:grid-cols-2">
                      <div>
                        <h4 className="break-words text-lg font-semibold">
                          {name}
                        </h4>
                        {person?.contact && (
                          <p className="mt-1 break-words text-sm text-white/70">
                            {person.contact}
                          </p>
                        )}
                      </div>
                      <label className="text-sm">
                        Participation
                        <select
                          aria-label={`Participation for ${label}`}
                          className={lessonField}
                          value={p.status}
                          onChange={(e) =>
                            status(
                              index,
                              e.target.value as LessonParticipant["status"],
                            )
                          }
                        >
                          {Object.entries(statusLabels).map(([k, label]) => (
                            <option
                              key={k}
                              value={k}
                              disabled={
                                unknownMinutes &&
                                !["unconfirmed", "absent"].includes(k)
                              }
                            >
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {["partial", "left_early"].includes(p.status) ? (
                      <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
                        {form.items.map((item) => (
                          <label
                            key={item.item_id}
                            className="min-w-0 break-words text-sm"
                          >
                            {item.name} · player minutes
                            <input
                              type="number"
                              inputMode="decimal"
                              className={lessonField}
                              required
                              min="0"
                              max={item.actual_minutes ?? 1440}
                              step="0.01"
                              value={
                                p.items.find((i) => i.item_id === item.item_id)
                                  ?.minutes ?? ""
                              }
                              onChange={(e) =>
                                player(index, {
                                  items: p.items.map((i) =>
                                    i.item_id === item.item_id
                                      ? {
                                          ...i,
                                          minutes: e.target.value || null,
                                        }
                                      : i,
                                  ),
                                })
                              }
                            />
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-white/75">
                        {p.status === "unconfirmed"
                          ? "Minutes unknown"
                          : p.status === "absent"
                            ? "0 minutes · absent"
                            : `${form.items.reduce((n, i) => n + Number(i.actual_minutes || 0), 0)} minutes · all activities`}
                      </p>
                    )}
                    <label className="mt-4 block text-sm">
                      Player notes
                      <textarea
                        aria-label={`Notes for ${label}`}
                        className={lessonField}
                        maxLength={1000}
                        value={p.notes || ""}
                        onChange={(e) =>
                          player(index, { notes: e.target.value || null })
                        }
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </section>
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={!dirty}
              className="min-h-11 rounded-lg bg-[#d8ff5d] px-5 font-semibold text-black disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save lesson record"}
            </button>
            <button
              type="button"
              className={lessonButton}
              onClick={() => loadHistory()}
            >
              View saved history
            </button>
          </div>
        </fieldset>
      </form>
      {historyOpen && (
        <section className="mt-8 border-t border-white/20 pt-5">
          <h3 className="text-xl font-semibold">Saved history</h3>
          <p className="mt-2 text-sm text-white/75">
            Loading a previous version only changes this editor. Save it as a
            new version to restore it.
          </p>
          <ul className="mt-4 divide-y divide-white/15">
            {history.map((h) => (
              <li
                className="flex flex-wrap items-center justify-between gap-3 py-3"
                key={h.version}
              >
                <span className="text-sm">
                  Version {h.version} ·{" "}
                  {new Date(h.saved_at).toLocaleString("en-AU", {
                    timeZone: "Australia/Sydney",
                  })}
                </span>
                <button
                  disabled={busy || disabled}
                  type="button"
                  className={lessonButton}
                  onClick={() => restore(h.version)}
                >
                  Load version {h.version}
                </button>
              </li>
            ))}
          </ul>
          {more && (
            <button
              className={lessonButton}
              disabled={busy || disabled}
              onClick={() => loadHistory(true)}
            >
              More history
            </button>
          )}
        </section>
      )}
    </section>
  );
}
