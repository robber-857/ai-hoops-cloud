"use client";

import {
  Camera,
  CheckCircle2,
  LockKeyhole,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";

import type { TrainingTemplateCatalogItem } from "@/lib/trainingTemplateCatalog";

type Props = {
  items: TrainingTemplateCatalogItem[];
  selectedCode: string | null;
  lockedCode?: string | null;
  loading?: boolean;
  error?: string | null;
  onSelect: (templateCode: string) => void;
};

function cameraLabel(camera: "front" | "side") {
  return camera === "front" ? "Front view" : "Side view";
}

export default function TrainingTemplatePicker({
  items,
  selectedCode,
  lockedCode,
  loading = false,
  error,
  onSelect,
}: Props) {
  return (
    <section aria-labelledby="training-template-heading" className="py-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase text-sky-200/75">
            Training exercise
          </div>
          <h2
            id="training-template-heading"
            className="mt-2 text-2xl font-semibold text-white sm:text-3xl"
          >
            Choose your movement
          </h2>
        </div>
        {lockedCode ? (
          <div className="inline-flex min-h-10 items-center gap-2 self-start rounded-lg border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-sm text-amber-100 sm:self-auto">
            <LockKeyhole className="h-4 w-4 shrink-0" aria-hidden="true" />
            Coach task locked
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-rose-300/25 bg-rose-300/10 px-4 py-3 text-sm leading-6 text-rose-100">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="h-44 animate-pulse rounded-lg border border-white/10 bg-white/[0.04]"
            />
          ))}
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const isSelected = selectedCode === item.template.templateId;
            const isReady = item.availability === "ready";
            const isLockedOut = Boolean(lockedCode && lockedCode !== item.template.templateId);
            const disabled = !isReady || isLockedOut;

            return (
              <button
                key={item.template.templateId}
                type="button"
                disabled={disabled}
                aria-pressed={isSelected}
                onClick={() => onSelect(item.template.templateId)}
                className={[
                  "flex min-h-44 w-full flex-col rounded-lg border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300",
                  isSelected
                    ? "border-sky-300/65 bg-sky-300/12"
                    : "border-white/12 bg-white/[0.035] hover:border-white/25 hover:bg-white/[0.06]",
                  disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer",
                ].join(" ")}
              >
                <div className="flex w-full items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="break-words text-base font-semibold leading-6 text-white">
                      {item.template.displayName}
                    </div>
                    <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-white/65">
                      <Camera className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      {cameraLabel(item.template.camera)}
                    </div>
                  </div>
                  {isSelected ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-sky-200" aria-hidden="true" />
                  ) : isLockedOut ? (
                    <LockKeyhole className="h-4 w-4 shrink-0 text-white/50" aria-hidden="true" />
                  ) : !isReady ? (
                    <RefreshCw className="h-4 w-4 shrink-0 text-amber-200" aria-hidden="true" />
                  ) : null}
                </div>

                <p className="mt-4 line-clamp-3 text-sm leading-6 text-white/58">
                  {item.template.cameraInstructions}
                </p>

                <div
                  className={[
                    "mt-auto pt-3 text-xs font-medium",
                    isReady ? "text-emerald-200" : "text-amber-200",
                  ].join(" ")}
                >
                  {item.availabilityMessage}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
