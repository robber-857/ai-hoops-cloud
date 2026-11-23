"use client";

import { Camera, Film, LockKeyhole } from "lucide-react";
import { useState } from "react";

import type { ActionTemplate } from "@/config/templates";
import type { TrainingTemplateCatalogItem } from "@/lib/trainingTemplateCatalog";
import { resolveTemplateExampleVideoSource } from "@/services/templates";

type Pose = {
  label: string;
  head: [number, number];
  trunk: string;
  arms: string;
  legs: string;
  equipment?: string;
};

const standing: Pose = {
  label: "Stand tall",
  head: [64, 24],
  trunk: "M64 32V65",
  arms: "M64 41L52 57L53 70 M64 41L76 57L75 70",
  legs: "M64 65L58 88L58 109H66 M64 65L69 88L69 109H77",
};

// Joint paths are authored for the same camera angle and movement that the scorer expects.
const examplePoses: Record<string, Pose[]> = {
  high_knees_in_place_side: [standing, {
    label: "Lift one knee",
    head: [62, 23], trunk: "M61 33L60 65",
    arms: "M60 42L47 57L39 45 M60 42L73 49L83 34",
    legs: "M60 65L63 88L65 109H74 M60 65L91 62L91 82H100",
  }],
  pushup_hold_high_plank: [{
    label: "Hold a straight line",
    head: [99, 53], trunk: "M89 61L61 69",
    arms: "M87 62V109H107",
    legs: "M61 69L41 86L21 105L22 109",
  }],
  wall_sit_half_hold: [{
    label: "Hold a lower seat",
    head: [45, 23], trunk: "M43 33L42 67",
    arms: "M43 40L52 56L64 66", legs: "M42 67L75 68L76 109H88",
    equipment: "M32 17V109",
  }],
  wall_sit_quarter_hold: [{
    label: "Hold a shallow seat",
    head: [45, 14], trunk: "M43 24L42 57",
    arms: "M43 35L52 49L66 60", legs: "M42 57L70 76L62 109H74",
    equipment: "M32 10V109",
  }],
  deep_squat_reps_side: [standing, {
    label: "Sit down and back",
    head: [73, 36], trunk: "M68 45L49 72",
    arms: "M63 49L83 45L99 45", legs: "M49 72L77 73L69 109H83",
  }],
  jumping_jack_reps_front: [{ ...standing, label: "Feet together" }, {
    label: "Feet apart, arms up",
    head: [64, 24], trunk: "M64 34V66",
    arms: "M64 43L49 40L39 23L36 11 M64 43L79 40L89 23L92 11",
    legs: "M64 66L47 85L33 109H42 M64 66L81 85L95 109H104",
  }],
  lunge_same_side_reps_side: [{
    ...standing, label: "Set your split stance",
    legs: "M64 65L47 88L32 109H39 M64 65L80 88L92 109H101",
  }, {
    label: "Lower the rear knee",
    head: [64, 35], trunk: "M64 45V76",
    arms: "M64 52L54 64L63 72 M64 52L72 64L64 72",
    legs: "M64 76L52 102L32 109H38 M64 76L89 77L89 109H103",
  }],
  pushup_reps_side: [{
    label: "Start with straight arms",
    head: [99, 51], trunk: "M90 60L61 69",
    arms: "M88 62V109H99", legs: "M61 69L42 86L21 108H28",
  }, {
    label: "Lower your chest",
    head: [104, 83], trunk: "M94 90L62 95",
    arms: "M91 92L76 91L88 109H98", legs: "M62 95L42 101L21 108H28",
  }],
  single_leg_stand_front: [{
    label: "Balance on one foot",
    head: [64, 24], trunk: "M64 34V65 M56 65H72",
    arms: "M64 43L49 50L39 44 M64 43L78 50L89 44",
    legs: "M58 65L58 87L57 109H65 M70 65L79 86L73 95H82",
  }],
  jump_rope_basic_front: [{
    ...standing, label: "Start with feet together",
    arms: "M64 43L50 56L41 57 M64 43L78 56L87 57",
    equipment: "M41 57C16 86 35 112 64 112S112 86 87 57",
  }, {
    label: "Jump on both feet",
    head: [64, 16], trunk: "M64 26V57",
    arms: "M64 35L50 48L41 49 M64 35L78 48L87 49",
    legs: "M64 57L58 79L58 98H66 M64 57L70 79L70 98H78",
    equipment: "M41 49C17 75 32 106 64 106S111 75 87 49",
  }],
};

function PoseIllustration({ pose }: { pose: Pose }) {
  return (
    <figure className="flex min-w-0 flex-col items-center rounded-xl border border-[var(--ui-border,#2b3542)] bg-[var(--ui-subtle,#131b25)] px-3 pb-3 pt-2">
      <svg viewBox="0 0 128 120" className="h-32 w-full max-w-48 text-[var(--ui-text,#edf2f8)]" aria-hidden="true">
        <path d="M16 111H112" stroke="currentColor" opacity="0.25" strokeWidth="1.5" />
        {pose.equipment && <path d={pose.equipment} stroke="currentColor" opacity="0.4" fill="none" strokeWidth="2" strokeDasharray="3 3" />}
        <circle cx={pose.head[0]} cy={pose.head[1]} r="7.5" fill="none" stroke="currentColor" strokeWidth="3.5" />
        <path d={pose.trunk} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        <path d={`${pose.arms} ${pose.legs}`} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <figcaption className="text-center text-xs font-medium text-[var(--ui-text,#edf2f8)] sm:text-sm">{pose.label}</figcaption>
    </figure>
  );
}

function TrainingExample({ template, catalogItem }: {
  template: ActionTemplate;
  catalogItem: TrainingTemplateCatalogItem | null;
}) {
  const [failedVideos, setFailedVideos] = useState<string[]>([]);
  const clips = (catalogItem?.remoteTemplate?.example_videos ?? [])
    .filter((clip) => clip.status === "active"
      && !failedVideos.includes(clip.public_id)
      && (clip.template_version === template.version || clip.template_version === null))
    .sort((first, second) => Number(second.template_version !== null) - Number(first.template_version !== null)
      || first.sort_order - second.sort_order)
    .flatMap((clip) => {
      const source = resolveTemplateExampleVideoSource(clip);
      return source ? [{ clip, source }] : [];
    });
  const poses = examplePoses[template.templateId];
  const example = clips[0];

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
      ) : poses ? (
        <div className="grid grid-flow-col auto-cols-fr gap-2 sm:gap-3" aria-label={`${template.displayName} illustrated example`}>
          {poses.map((pose) => <PoseIllustration key={pose.label} pose={pose} />)}
        </div>
      ) : null}
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm text-[var(--ui-muted,#a9b6c8)]">
          <Camera aria-hidden="true" className="size-4" />
          {template.camera === "front" ? "Front view" : "Side view"}
          <span aria-hidden="true">·</span>
          {example ? "Example video" : poses ? "Illustrated example" : "Filming guide"}
        </div>
        <h3 className="mt-2 text-lg font-semibold">{template.displayName}</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--ui-muted,#a9b6c8)]">{template.cameraInstructions}</p>
        {example?.clip.description && <p className="mt-2 text-sm text-[var(--ui-muted,#a9b6c8)]">{example.clip.description}</p>}
        {catalogItem?.availability === "ready" && (
          <a href="#training-video-upload" className="ui-button mt-4">Upload this exercise</a>
        )}
      </div>
    </div>
  );
}

export default function TrainingMovementPreview({ templates, selectedTemplate, catalogItem, locked, loading, onSelect }: {
  templates: ActionTemplate[];
  selectedTemplate: ActionTemplate | undefined;
  catalogItem: TrainingTemplateCatalogItem | null;
  locked: boolean;
  loading: boolean;
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
          <span className="flex items-center gap-2 text-sm text-[var(--ui-muted,#a9b6c8)]"><LockKeyhole aria-hidden="true" className="size-4" /> Coach-assigned exercise</span>
        ) : (
          <select
            aria-label="Preview a movement"
            value={selectedTemplate?.templateId ?? ""}
            onChange={(event) => onSelect(event.target.value)}
            disabled={loading}
            className="min-h-10 max-w-full rounded-lg border border-[var(--ui-border,#2b3542)] bg-[var(--ui-subtle,#131b25)] px-3 text-sm"
          >
            <option value="" disabled>Select an exercise</option>
            {templates.map((template) => <option key={template.templateId} value={template.templateId}>{template.displayName}</option>)}
          </select>
        )}
      </div>
      {selectedTemplate ? (
        <TrainingExample key={selectedTemplate.templateId} template={selectedTemplate} catalogItem={catalogItem} />
      ) : (
        <p className="mt-3 text-sm text-[var(--ui-muted,#a9b6c8)]">{loading ? "Loading the exercise…" : "Choose an exercise to see the movement and where to place your camera."}</p>
      )}
    </section>
  );
}
