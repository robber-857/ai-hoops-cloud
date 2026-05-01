"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";

import { analysisTypeLabels } from "@/components/coach/coachUtils";
import { getAllTemplates } from "@/config/templates";
import { cn } from "@/lib/utils";
import {
  coachService,
  type CoachTaskRead,
  type CoachTaskTargetConfig,
} from "@/services/coach";
import type { ReportAnalysisType } from "@/services/reports";

type CreateTaskPanelProps = {
  classPublicId: string;
  studentCount: number;
  onCreated?: (task: CoachTaskRead) => void;
  isCompact?: boolean;
};

const analysisTypes: ReportAnalysisType[] = [
  "shooting",
  "dribbling",
  "training",
  "comprehensive",
];

const fieldClass =
  "min-h-11 w-full rounded-lg border border-white/10 bg-black/24 px-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#65f7ff]/46 focus:bg-black/34 focus:ring-2 focus:ring-[#65f7ff]/12";

const labelClass = "text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-white/46";

function toApiDate(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export function CreateTaskPanel({
  classPublicId,
  studentCount,
  onCreated,
  isCompact = false,
}: CreateTaskPanelProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [analysisType, setAnalysisType] = useState<ReportAnalysisType>("shooting");
  const [templateCode, setTemplateCode] = useState("");
  const [targetSessions, setTargetSessions] = useState("3");
  const [targetScore, setTargetScore] = useState("85");
  const [dueAt, setDueAt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const templates = useMemo(() => {
    if (analysisType === "comprehensive") {
      return [];
    }

    return getAllTemplates(analysisType);
  }, [analysisType]);

  const selectedTemplateCode = templateCode || templates[0]?.templateId || "";

  const handleAnalysisTypeChange = (nextType: ReportAnalysisType) => {
    const nextTemplates = nextType === "comprehensive" ? [] : getAllTemplates(nextType);
    setAnalysisType(nextType);
    setTemplateCode(nextTemplates[0]?.templateId ?? "");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    const targetConfig: CoachTaskTargetConfig = {};
    const sessions = Number(targetSessions);
    const score = Number(targetScore);

    if (Number.isFinite(sessions) && sessions > 0) {
      targetConfig.target_sessions = sessions;
    }
    if (Number.isFinite(score) && score > 0) {
      targetConfig.target_score = score;
    }

    try {
      const task = await coachService.createClassTask(classPublicId, {
        title: title.trim(),
        description: description.trim() || null,
        analysis_type: analysisType,
        template_code: selectedTemplateCode || null,
        target_config: Object.keys(targetConfig).length > 0 ? targetConfig : null,
        status: "published",
        due_at: toApiDate(dueAt),
      });

      setMessage(`Assigned to ${task.assignment_count} students.`);
      setTitle("");
      setDescription("");
      onCreated?.(task);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to publish.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      className={cn(
        "rounded-lg border border-white/10 bg-white/[0.055] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.2)] backdrop-blur-2xl",
        isCompact ? "h-full" : "",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className={labelClass}>Task uplink</div>
          <h2 className="mt-2 font-[var(--font-display)] text-xl font-bold text-white">
            Publish training task
          </h2>
        </div>
        <span className="rounded-full border border-[#d8ff5d]/24 bg-[#d8ff5d]/10 px-3 py-1 text-xs font-semibold text-[#e8ff9a]">
          {studentCount} targets
        </span>
      </div>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-2">
          <span className={labelClass}>Title</span>
          <input
            className={fieldClass}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Weekly shooting control"
            maxLength={100}
            required
          />
        </label>

        <label className="block space-y-2">
          <span className={labelClass}>Description</span>
          <textarea
            className={`${fieldClass} min-h-24 resize-none py-3`}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Complete the assigned motion template before the deadline."
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className={labelClass}>Motion</span>
            <select
              className={fieldClass}
              value={analysisType}
              onChange={(event) => handleAnalysisTypeChange(event.target.value as ReportAnalysisType)}
            >
              {analysisTypes.map((type) => (
                <option key={type} value={type}>
                  {analysisTypeLabels[type]}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className={labelClass}>Template</span>
            <select
              className={fieldClass}
              value={selectedTemplateCode}
              onChange={(event) => setTemplateCode(event.target.value)}
              disabled={templates.length === 0}
            >
              {templates.length === 0 ? <option value="">No template</option> : null}
              {templates.map((template) => (
                <option key={template.templateId} value={template.templateId}>
                  {template.displayName}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block space-y-2">
            <span className={labelClass}>Sessions</span>
            <input
              className={fieldClass}
              type="number"
              min={1}
              value={targetSessions}
              onChange={(event) => setTargetSessions(event.target.value)}
            />
          </label>
          <label className="block space-y-2">
            <span className={labelClass}>Score</span>
            <input
              className={fieldClass}
              type="number"
              min={1}
              max={100}
              value={targetScore}
              onChange={(event) => setTargetScore(event.target.value)}
            />
          </label>
          <label className="block space-y-2">
            <span className={labelClass}>Due</span>
            <input
              className={fieldClass}
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
            />
          </label>
        </div>

        {message ? (
          <div className="flex items-center gap-2 rounded-lg border border-[#d8ff5d]/24 bg-[#d8ff5d]/10 px-3 py-2 text-sm font-medium text-[#efffb8]">
            <CheckCircle2 className="h-4 w-4" />
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-red-400/24 bg-red-500/10 px-3 py-2 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#65f7ff]/34 bg-[#65f7ff]/12 px-4 text-sm font-semibold text-[#dffbff] transition hover:bg-[#65f7ff]/18 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Publish task
        </button>
      </form>
    </section>
  );
}
