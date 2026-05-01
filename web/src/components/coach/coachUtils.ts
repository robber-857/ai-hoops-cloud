import { getTemplateById } from "@/config/templates";
import type { ReportAnalysisType } from "@/services/reports";

export const analysisTypeLabels: Record<ReportAnalysisType, string> = {
  shooting: "Shooting",
  dribbling: "Dribbling",
  training: "Training",
  comprehensive: "Comprehensive",
};

export function formatDate(input: string | null | undefined, options?: Intl.DateTimeFormatOptions) {
  if (!input) {
    return "--";
  }

  const time = new Date(input).getTime();
  if (Number.isNaN(time)) {
    return "--";
  }

  return new Intl.DateTimeFormat("en-AU", {
    month: "short",
    day: "numeric",
    ...(options ?? {}),
  }).format(new Date(time));
}

export function formatDateTime(input: string | null | undefined) {
  return formatDate(input, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatScore(score: number | null | undefined) {
  if (score === null || score === undefined || Number.isNaN(score)) {
    return "--";
  }

  return String(Math.round(score));
}

export function getClassStatusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "active" || normalized === "open" || normalized === "published") {
    return "text-[#d8ff5d] bg-[#d8ff5d]/12 border-[#d8ff5d]/35";
  }

  if (normalized === "paused" || normalized === "draft") {
    return "text-[#a78bfa] bg-[#8b5cf6]/14 border-[#a78bfa]/35";
  }

  return "text-sky-200 bg-sky-400/10 border-sky-300/30";
}

export function getTemplateDisplayName(templateCode: string | null | undefined) {
  if (!templateCode) {
    return "No template";
  }

  return getTemplateById(templateCode)?.displayName ?? templateCode;
}

export function getStudentDisplayName(username: string, nickname: string | null) {
  return nickname?.trim() || username;
}
