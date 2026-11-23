"use client";

import { usePoseCopy } from "@/components/Pose2D/poseCopy";
import {
  Camera,
  CheckCircle2,
  LockKeyhole,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";

import type { TrainingTemplateCatalogItem } from "@/lib/trainingTemplateCatalog";
import { getMovementPresentation } from "./movementExamples";

type Props = {
  items: TrainingTemplateCatalogItem[];
  selectedCode: string | null;
  locked?: boolean;
  selectionDisabled?: boolean;
  loading?: boolean;
  error?: string | null;
  onSelect: (templateCode: string) => void;
};

function cameraLabel(camera: "front" | "side") {
  return camera === "front" ? "Front view" : "Side view";
}

export default function MovementTemplatePicker({
  items,
  selectedCode,
  locked = false,
  selectionDisabled = false,
  loading = false,
  error,
  onSelect,
}: Props) {
  const { language, t } = usePoseCopy();
  return (
    <section aria-labelledby="movement-template-heading" className="py-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            id="movement-template-heading"
            className="text-xl font-semibold text-[var(--ui-text)] sm:text-2xl"
          >{t("Choose your movement")}</h2>
        </div>
        {locked ? (
          <div className="inline-flex min-h-10 items-center gap-2 self-start rounded-lg border border-[var(--ui-border)] bg-[var(--ui-subtle)] px-3 py-2 text-sm text-[var(--ui-muted)] sm:self-auto">
            <LockKeyhole className="h-4 w-4 shrink-0" aria-hidden="true" />{t("Coach task locked")}</div>
        ) : null}
      </div>

      {error ? (
        <div role="alert" className="mt-4 flex items-start gap-3 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-subtle)] px-4 py-3 text-sm leading-6 text-[var(--ui-danger)]">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t(error)}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="h-36 animate-pulse rounded-xl border border-[var(--ui-border)] bg-[var(--ui-subtle)]"
            />
          ))}
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const isSelected = selectedCode === item.template.templateId;
            const isReady = item.availability === "ready";
            const isLockedOut = locked && !isSelected;
            const presentation = getMovementPresentation(item.template, language);

            return (
              <button
                key={item.template.templateId}
                type="button"
                disabled={locked || selectionDisabled}
                aria-pressed={isSelected}
                onClick={() => onSelect(item.template.templateId)}
                className={[
                  "flex min-h-36 w-full flex-col rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)]",
                  isSelected
                    ? "border-[var(--ui-accent)] bg-[var(--ui-accent-soft)]"
                    : "border-[var(--ui-border)] bg-[var(--ui-surface)] enabled:hover:bg-[var(--ui-subtle)]",
                  isLockedOut ? "cursor-not-allowed opacity-55" : locked || selectionDisabled ? "cursor-default" : "cursor-pointer",
                ].join(" ")}
              >
                <div className="flex w-full items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="break-words text-base font-semibold leading-6 text-[var(--ui-text)]">
                      {presentation.title}
                    </div>
                    <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ui-muted)]">
                      <Camera className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {t(cameraLabel(item.template.camera))}
                    </div>
                  </div>
                  {isSelected ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--ui-accent)]" aria-hidden="true" />
                  ) : isLockedOut ? (
                    <LockKeyhole className="h-4 w-4 shrink-0 text-[var(--ui-muted)]" aria-hidden="true" />
                  ) : !isReady ? (
                    <RefreshCw className="h-4 w-4 shrink-0 text-[var(--ui-chart-orange)]" aria-hidden="true" />
                  ) : null}
                </div>

                <p className="mt-3 text-sm leading-6 text-[var(--ui-muted)]">
                  {t(presentation.filming)}
                </p>

                <div
                  className={[
                    "mt-auto pt-3 text-xs font-medium",
                    isReady ? "text-[var(--ui-chart-teal)]" : "text-[var(--ui-chart-orange)]",
                  ].join(" ")}
                >
                  {t(item.availabilityMessage)}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
