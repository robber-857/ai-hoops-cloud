"use client";
import { useEffect, useRef, useState } from "react";
import type { CampLesson } from "@/services/campLessons";
import {
  classReportService,
  type ReportPreview,
  type Publication,
} from "@/services/classReports";
import { ClassReportDetails } from "./ClassReportDetails";
import { button, ErrorNotice } from "@/components/recipes/RecipeShared";
export function LessonReportPublisher({
  lesson,
  disabled,
  dirty = false,
  onBusy,
}: {
  lesson: CampLesson;
  disabled: boolean;
  dirty?: boolean;
  onBusy: (busy: boolean) => void;
}) {
  const [preview, setPreview] = useState<ReportPreview | null>(null),
    [receipt, setReceipt] = useState<Publication | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [attempt, setAttempt] = useState(0);
  const inFlight = useRef(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    classReportService
      .preview(lesson)
      .then((p) => {
        if (active) setPreview(p);
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
  }, [lesson, attempt]);
  async function publish() {
    if (
      inFlight.current ||
      !preview ||
      (!preview.already_published && !preview.preview_fingerprint)
    )
      return;
    inFlight.current = true;
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      const result = await classReportService.publish(
        lesson,
        preview.preview_fingerprint,
      );
      setReceipt(result);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not publish. Reload the preview and review this saved lesson version.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <section
      id="session-publish"
      className="scroll-mt-28 mt-8 space-y-4 border-t border-white/20 pt-6"
    >
      <h2 className="text-2xl font-semibold">3. Publish to students</h2>
      <p className="text-white/75">
        Students and parents can view the training activities, attendance and
        your feedback after publishing. Each student sees only their own
        summary.
      </p>
      {dirty && (
        <p role="status" className="text-amber-200">
          Your changes are not published yet. Click Save draft above, then
          review and publish here.
        </p>
      )}
      {error && (
        <ErrorNotice error={error} retry={() => setAttempt((v) => v + 1)} />
      )}
      {loading ? (
        <p role="status">Preparing student summaries…</p>
      ) : (
        preview && (
          <>
            {!dirty && preview.blockers.length > 0 && (
              <>
                <p className="text-sm text-white/75">
                  Finish these steps to prepare student summaries:
                </p>
                <div className="flex flex-wrap gap-4 text-sm">
                  <button
                    type="button"
                    className="underline"
                    onClick={() =>
                      document
                        .getElementById("session-activities")
                        ?.scrollIntoView({ block: "start" })
                    }
                  >
                    Edit training minutes
                  </button>
                  <button
                    type="button"
                    className="underline"
                    onClick={() =>
                      document
                        .getElementById("session-attendance")
                        ?.scrollIntoView({ block: "start" })
                    }
                  >
                    Check attendance
                  </button>
                </div>
                <ul className="list-inside list-disc text-amber-200">
                  {preview.blockers.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </>
            )}
            {!preview.already_published &&
              !preview.preview_fingerprint &&
              !preview.blockers.length && (
                <p className="text-amber-200">
                  Reload the preview before publishing.
                  <button
                    type="button"
                    className={`${button} ml-2`}
                    onClick={() => setAttempt((v) => v + 1)}
                  >
                    Reload preview
                  </button>
                </p>
              )}
            <button
              type="button"
              className={button}
              disabled={
                disabled ||
                busy ||
                preview.blockers.length > 0 ||
                preview.lesson_version !== lesson.version ||
                (!preview.already_published && !preview.preview_fingerprint)
              }
              onClick={publish}
            >
              {busy
                ? "Publishing…"
                : dirty
                  ? "Save draft before publishing"
                  : preview.blockers.length
                    ? "Complete steps 1 and 2 to publish"
                    : preview.already_published || receipt
                      ? "View publication confirmation"
                      : `Publish to ${preview.reports.length} students`}
            </button>
            {receipt && (
              <p role="status">
                Published to {receipt.reports.length} students. Students and
                parents can now view their session summary.
              </p>
            )}
            {!dirty && preview.reports.length > 0 && (
              <details>
                <summary className="cursor-pointer py-3">
                  {receipt || preview.already_published
                    ? "Published student summaries"
                    : "Preview student summaries"}{" "}
                  ({preview.reports.length})
                </summary>
                <div className="space-y-4">
                  {(receipt?.reports || preview.reports).map((r, i) => (
                    <ClassReportDetails key={r.public_id || i} report={r} />
                  ))}
                </div>
              </details>
            )}
          </>
        )
      )}
    </section>
  );
}
