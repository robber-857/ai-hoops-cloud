"use client";

import { Camera, Film, LockKeyhole } from "lucide-react";
import { useState } from "react";

import type { ActionTemplate } from "@/config/templates";
import type { TrainingTemplateCatalogItem } from "@/lib/trainingTemplateCatalog";
import { resolveTemplateExampleVideoSource } from "@/services/templates";
import { getMovementPresentation, type MovementPose } from "./movementExamples";

function PoseIllustration({ pose }: { pose: MovementPose }) {
  return (
    <figure className="flex min-w-0 flex-col items-center rounded-xl border border-[var(--ui-border,#2b3542)] bg-[var(--ui-subtle,#131b25)] px-3 pb-3 pt-2">
      <svg viewBox="0 -6 128 126" className="h-32 w-full max-w-48 text-[var(--ui-text,#edf2f8)]" aria-hidden="true">
        <path d="M16 111H112" stroke="currentColor" opacity="0.25" strokeWidth="1.5" />
        {pose.equipment && <path d={pose.equipment} stroke="currentColor" opacity="0.4" fill="none" strokeWidth="2" strokeDasharray="3 3" />}
        <circle cx={pose.head[0]} cy={pose.head[1]} r="7.5" fill="none" stroke="currentColor" strokeWidth="3.5" />
        <path d={pose.trunk} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        <path d={`${pose.arms} ${pose.legs}`} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {pose.ball && (
          <circle cx={pose.ball[0]} cy={pose.ball[1]} r="6" fill="var(--ui-chart-orange)" />
        )}
      </svg>
      <figcaption className="text-center text-xs font-medium text-[var(--ui-text,#edf2f8)] sm:text-sm">{pose.label}</figcaption>
    </figure>
  );
}

function MovementExample({ template, catalogItem, canUpload }: {
  template: ActionTemplate;
  catalogItem: TrainingTemplateCatalogItem | null;
  canUpload: boolean;
}) {
  const [failedVideos, setFailedVideos] = useState<string[]>([]);
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const version = catalogItem?.remoteVersion?.version ?? template.version;
  const presentation = getMovementPresentation(template);
  const clips = (catalogItem?.remoteTemplate?.example_videos ?? [])
    .filter((clip) => clip.status === "active"
      && !failedVideos.includes(clip.public_id)
      && (clip.template_version === version || clip.template_version === null))
    .sort((first, second) => Number(second.template_version !== null) - Number(first.template_version !== null)
      || first.sort_order - second.sort_order)
    .flatMap((clip) => {
      const source = resolveTemplateExampleVideoSource(clip);
      return source ? [{ clip, source }] : [];
    });
  const example = clips.find(({ clip }) => clip.public_id === selectedClip) ?? clips[0];

  return (
    <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] md:items-center">
      {example ? (
        <video
          key={example.clip.public_id}
          src={example.source}
          poster={example.clip.cover_url ?? undefined}
          aria-label={example.clip.title}
          onError={() => setFailedVideos((ids) => [...ids, example.clip.public_id])}
          controls
          playsInline
          preload="metadata"
          className="aspect-video w-full rounded-xl bg-black object-contain"
        />
      ) : presentation.poses.length > 0 ? (
        <div className="grid grid-flow-col auto-cols-fr gap-2 sm:gap-3" aria-label={`${presentation.title} illustrated example`}>
          {presentation.poses.map((pose) => <PoseIllustration key={pose.label} pose={pose} />)}
        </div>
      ) : null}
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm text-[var(--ui-muted,#a9b6c8)]">
          <Camera aria-hidden="true" className="size-4" />
          {template.camera === "front" ? "Front view" : "Side view"}
          <span aria-hidden="true">·</span>
          {example ? "Example video" : presentation.poses.length > 0 ? "Illustrated example" : "Filming guide"}
        </div>
        <h3 className="mt-2 text-lg font-semibold">{presentation.title}</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--ui-muted,#a9b6c8)]">{presentation.filming}</p>
        {example?.clip.description && <p className="mt-2 text-sm text-[var(--ui-muted,#a9b6c8)]">{example.clip.description}</p>}
        {clips.length > 1 && (
          <label className="mt-4 grid gap-1 text-sm text-[var(--ui-muted)]">
            Example clip
            <select
              value={example.clip.public_id}
              onChange={(event) => setSelectedClip(event.target.value)}
              className="min-h-10 max-w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-subtle)] px-3 text-[var(--ui-text)]"
            >
              {clips.map(({ clip }) => <option key={clip.public_id} value={clip.public_id}>{clip.title}</option>)}
            </select>
          </label>
        )}
        {canUpload && (
          <a href="#movement-video-upload" className="ui-button ui-primary mt-4">Upload this movement</a>
        )}
      </div>
    </div>
  );
}

export default function MovementPreview({ templates, selectedTemplate, catalogItem, locked, loading, selectionDisabled, canUpload, onSelect }: {
  templates: ActionTemplate[];
  selectedTemplate: ActionTemplate | undefined;
  catalogItem: TrainingTemplateCatalogItem | null;
  locked: boolean;
  loading: boolean;
  selectionDisabled: boolean;
  canUpload: boolean;
  onSelect: (code: string) => void;
}) {
  return (
    <section aria-labelledby="movement-preview-heading" className="ui-panel p-4 text-[var(--ui-text)] sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="movement-preview-heading" className="flex items-center gap-2.5 text-base font-semibold sm:text-lg">
          <Film aria-hidden="true" className="size-5" />
          Movement example
        </h2>
        {locked ? (
          <span className="flex items-center gap-2 text-sm text-[var(--ui-muted,#a9b6c8)]"><LockKeyhole aria-hidden="true" className="size-4" /> Coach-assigned movement</span>
        ) : (
          <select
            aria-label="Preview a movement"
            value={selectedTemplate?.templateId ?? ""}
            onChange={(event) => onSelect(event.target.value)}
            disabled={loading || selectionDisabled}
            className="min-h-10 max-w-full rounded-lg border border-[var(--ui-border,#2b3542)] bg-[var(--ui-subtle,#131b25)] px-3 text-sm"
          >
            <option value="" disabled>Select a movement</option>
            {templates.map((template) => <option key={template.templateId} value={template.templateId}>{getMovementPresentation(template).title}</option>)}
          </select>
        )}
      </div>
      {selectedTemplate ? (
        <MovementExample key={selectedTemplate.templateId} template={selectedTemplate} catalogItem={catalogItem} canUpload={canUpload} />
      ) : (
        <p className="mt-3 text-sm text-[var(--ui-muted,#a9b6c8)]">{loading ? "Loading the movement…" : "Choose a movement to see an example and where to place your camera."}</p>
      )}
    </section>
  );
}
