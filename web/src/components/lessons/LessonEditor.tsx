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
    [historyOpen, setHistoryOpen] = useState(false),
    [search, setSearch] = useState("");
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
    campLessonService
      .exerciseActivities()
      .then((value) => {
        if (active) setActivities(value.items);
      })
      .catch((e) => {
        if (active)
          setActivitiesError(
            e instanceof Error
              ? e.message
              : "Could not load activity standards.",
          );
      })
      .finally(() => {
        if (active) setActivitiesLoading(false);
      });
    return () => {
      active = false;
    };
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
        <h2 className="text-2xl font-semibold">Today’s training</h2>
        <span className="text-sm text-white/75">
          Draft saved · v{lesson.version}
          {dirty ? " · Unsaved changes" : ""}
        </span>
      </div>
      <p className="mt-3 text-sm text-white/75">
        {lesson.class_name} · Dates use {lesson.timezone}. Record activities,
        confirm attendance, then publish to students.
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
            Message to students (optional)
            <textarea
              className={lessonField}
              maxLength={2000}
              value={form.notes || ""}
              onChange={(e) =>
                change({ ...form, notes: e.target.value || null })
              }
            />
          </label>
          <section id="session-activities" className="scroll-mt-28">
            <h3 className="text-xl font-semibold">1. What did you train?</h3>
            <p className="mt-2 text-sm text-white/75">
              Enter active minutes for each activity, excluding breaks. Use 0
              for activities you skipped.
            </p>
            {activitiesLoading && (
              <p role="status" className="mt-3 text-sm">
                Loading activity standards…
              </p>
            )}
            {activitiesError && (
              <div role="alert" className="mt-3 text-sm text-amber-200">
                <p>{activitiesError} You can still save the training record.</p>
                <button
                  type="button"
                  className={`${lessonButton} mt-2`}
                  onClick={() => setActivitiesRetry((value) => value + 1)}
                >
                  Reload activity standards
                </button>
              </div>
            )}
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
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer py-2 text-white/65">
                      Activity notes & energy estimate (optional)
                    </summary>
                    <div className="mt-2 grid min-w-0 gap-4 sm:grid-cols-2">
                      <label className="min-w-0 text-sm">
                        Activity standard
                        <select
                          className={lessonField}
                          aria-label={`Activity standard for activity ${index + 1}`}
                          value={item.activity_code ?? ""}
                          disabled={
                            activitiesLoading || Boolean(activitiesError)
                          }
                          onChange={(e) =>
                            change({
                              ...form,
                              items: form.items.map((i) =>
                                i.item_id === item.item_id
                                  ? {
                                      ...i,
                                      activity_code: e.target.value || null,
                                      intensity: null,
                                    }
                                  : i,
                              ),
                            })
                          }
                        >
                          <option value="">
                            Custom activity / no standard selected
                          </option>
                          {item.activity_code &&
                            !activities.some(
                              (a) => a.code === item.activity_code,
                            ) && (
                              <option value={item.activity_code}>
                                Saved standard unavailable — reselect
                              </option>
                            )}
                          {activities.map((activity) => (
                            <option key={activity.code} value={activity.code}>
                              {activity.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="min-w-0 text-sm">
                        Intensity
                        <select
                          className={lessonField}
                          aria-label={`Intensity for activity ${index + 1}`}
                          value={item.intensity ?? ""}
                          disabled={
                            !item.activity_code ||
                            activitiesLoading ||
                            Boolean(activitiesError)
                          }
                          onChange={(e) =>
                            change({
                              ...form,
                              items: form.items.map((i) =>
                                i.item_id === item.item_id
                                  ? {
                                      ...i,
                                      intensity: (e.target.value ||
                                        null) as ActivityIntensity | null,
                                    }
                                  : i,
                              ),
                            })
                          }
                        >
                          <option value="">Select intensity</option>
                          {item.intensity &&
                            !activities
                              .find((a) => a.code === item.activity_code)
                              ?.intensities.includes(item.intensity) && (
                              <option value={item.intensity}>
                                Saved intensity unavailable — reselect
                              </option>
                            )}
                          {activities
                            .find((a) => a.code === item.activity_code)
                            ?.intensities.map((intensity) => (
                              <option key={intensity} value={intensity}>
                                {intensity[0].toUpperCase() +
                                  intensity.slice(1)}
                              </option>
                            ))}
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
                  </details>
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
          <section
            id="session-attendance"
            className="scroll-mt-28 border-t border-white/20 pt-6"
          >
            <h3 className="text-xl font-semibold">2. Who attended?</h3>
            <p className="mt-2 text-sm text-white/75">
              Confirm the class together, then adjust individual students. Early
              departures and partial attendance need individual minutes.
            </p>
            <div className="my-4 flex flex-wrap items-center gap-3">
              <input
                aria-label="Find student"
                placeholder="Find student…"
                className={`${lessonField} !mt-0 sm:!w-64`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button
                type="button"
                className={lessonButton}
                disabled={
                  unknownMinutes ||
                  !form.participants.some((p) => p.status === "unconfirmed")
                }
                onClick={() =>
                  change({
                    ...form,
                    participants: form.participants.map((p) =>
                      p.status !== "unconfirmed"
                        ? p
                        : {
                            ...p,
                            status: "present",
                            items: form.items.map((i) => ({
                              item_id: i.item_id,
                              minutes: i.actual_minutes,
                            })),
                          },
                    ),
                  })
                }
              >
                Mark all unconfirmed present
              </button>
              <span className="text-sm text-white/65" role="status">
                {
                  form.participants.filter((p) => p.status !== "unconfirmed")
                    .length
                }
                /{form.participants.length} confirmed · applies to the whole
                class
              </span>
            </div>
            {unknownMinutes && (
              <p className="mb-3 text-sm text-amber-200">
                First enter the missing activity minutes in step 1 to enable
                attendance. You can still mark absences and save a draft.
              </p>
            )}
            {!form.participants.length && (
              <p className="text-amber-200">
                This session has no students. Check the class roster before
                starting a new session.
              </p>
            )}
            <div className="max-h-[560px] overflow-auto rounded-lg border border-white/15">
              <table className="w-full min-w-[680px] text-left text-sm">
                <caption className="sr-only">
                  Student attendance and individual feedback
                </caption>
                <thead className="sticky top-0 z-10 bg-[#151b25] text-white/65">
                  <tr>
                    <th className="p-3">Student</th>
                    <th className="p-3">Attendance</th>
                    <th className="p-3">Minutes</th>
                    <th className="p-3">Student note (optional)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {form.participants.map((p, index) => {
                    const person = lesson.roster.find(
                      (r) => r.student_public_id === p.student_public_id,
                    );
                    const name = person?.name || "Name not added";
                    const label = person?.contact
                      ? `${name} (${person.contact})`
                      : name;
                    if (
                      search &&
                      !label.toLowerCase().includes(search.toLowerCase())
                    )
                      return null;
                    const partial = ["partial", "left_early"].includes(
                      p.status,
                    );
                    return (
                      <tr
                        key={p.student_public_id}
                        className="align-top hover:bg-white/[0.025]"
                      >
                        <th scope="row" className="max-w-56 p-3 font-medium">
                          <span className="block break-words">{name}</span>
                          <span className="mt-1 block break-all text-xs font-normal text-white/50">
                            {person?.contact}
                          </span>
                        </th>
                        <td className="w-48 p-3">
                          <select
                            aria-label={`Participation for ${label}`}
                            className={`${lessonField} !mt-0`}
                            value={p.status}
                            onChange={(e) =>
                              status(
                                index,
                                e.target.value as LessonParticipant["status"],
                              )
                            }
                          >
                            {Object.entries(statusLabels).map(([k, text]) => (
                              <option
                                key={k}
                                value={k}
                                disabled={
                                  unknownMinutes &&
                                  !["unconfirmed", "absent"].includes(k)
                                }
                              >
                                {text}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="min-w-32 p-3">
                          {partial ? (
                            <div className="space-y-2">
                              {form.items.map((item) => (
                                <label
                                  key={item.item_id}
                                  className="block text-xs"
                                >
                                  {item.name}
                                  <input
                                    aria-label={`${item.name} minutes for ${label}`}
                                    type="number"
                                    inputMode="decimal"
                                    required
                                    min="0"
                                    max={item.actual_minutes ?? 1440}
                                    step="0.01"
                                    className={`${lessonField} !mt-1`}
                                    value={
                                      p.items.find(
                                        (i) => i.item_id === item.item_id,
                                      )?.minutes ?? ""
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
                            <span className="block py-3 text-white/70">
                              {p.status === "unconfirmed"
                                ? "—"
                                : p.status === "absent"
                                  ? "0"
                                  : form.items.reduce(
                                      (n, i) =>
                                        n + Number(i.actual_minutes || 0),
                                      0,
                                    )}
                            </span>
                          )}
                        </td>
                        <td className="min-w-52 p-3">
                          <input
                            aria-label={`Notes for ${label}`}
                            className={`${lessonField} !mt-0`}
                            placeholder="Add feedback…"
                            maxLength={1000}
                            value={p.notes || ""}
                            onChange={(e) =>
                              player(index, { notes: e.target.value || null })
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {search &&
              !lesson.roster.some((p) =>
                `${p.name} ${p.contact || ""}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              ) && (
                <p className="mt-3 text-sm text-white/65">
                  No matching students. Clear the search to see everyone.
                </p>
              )}
          </section>
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={!dirty}
              className="min-h-11 rounded-lg bg-[#d8ff5d] px-5 font-semibold text-black disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save draft"}
            </button>
            <button
              type="button"
              className={lessonButton}
              onClick={() => loadHistory()}
            >
              Saved versions
            </button>
          </div>
        </fieldset>
      </form>
      {historyOpen && (
        <section className="mt-8 border-t border-white/20 pt-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold">Saved history</h3>
            <button
              type="button"
              className={lessonButton}
              onClick={() => setHistoryOpen(false)}
            >
              Close history
            </button>
          </div>
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
