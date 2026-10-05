import { describe, expect, it } from "vitest";
import { findCandidateReports, normalizeReport, selectActivityReports } from "@/components/account/AccountDataProvider";
import type { ReportListItem } from "@/services/reports";
import type { TaskSummaryRead } from "@/services/me";

const original: ReportListItem = {
  public_id: "original", session_public_id: "session", video_public_id: "video",
  analysis_type: "training", template_code: "pushup_reps_side", template_version: "v1",
  overall_score: 60, grade: "C", status: "completed", video_url: null,
  created_at: "2026-10-01T00:00:00Z", analysis_finished_at: null,
};
const comparison = { ...original, public_id: "comparison", is_age_comparison: true,
  overall_score: 99, grade: "S", created_at: "2026-10-05T00:00:00Z" };
const task: TaskSummaryRead = {
  public_id: "assignment", task_public_id: "task", class_public_id: "class", class_name: "Class",
  title: "Pushup practice", description: null, analysis_type: "training", template_code: "pushup_reps_side",
  target_config: null, status: "pending", progress_percent: 0, completed_sessions: 0,
  best_score: null, latest_report_public_id: null, completed_at: null, last_submission_at: null, due_at: null,
};

describe("age comparisons remain history rather than new training activity", () => {
  it("retains comparison links and identity while labelling their history rows", () => {
    const history = normalizeReport(comparison)!;
    expect(history.id).toBe("comparison");
    expect(history.linkable).toBe(true);
    expect(history.isAgeComparison).toBe(true);
    expect(history.templateName).toContain("Age comparison");
    expect(history.score).toBe(99);
  });

  it("excludes a newer higher-scoring comparison from task choices and fallback activity inputs", () => {
    const history = [normalizeReport(comparison)!, normalizeReport(original)!];
    const before = structuredClone(history);
    expect(findCandidateReports(task, history).map((report) => report.id)).toEqual(["original"]);
    expect(selectActivityReports(history).map((report) => report.score)).toEqual([60]);
    expect(history).toEqual(before);
  });

  it("keeps older API responses eligible and still enforces action type/template matching", () => {
    const history = [normalizeReport(original)!,
      normalizeReport({ ...original, public_id: "other-template", template_code: "jump_rope_basic_front" })!,
      normalizeReport({ ...original, public_id: "shooting", analysis_type: "shooting" })!];
    expect(history[0].isAgeComparison).toBe(false);
    expect(findCandidateReports(task, history).map((report) => report.id)).toEqual(["original"]);
    expect(findCandidateReports({ ...task, template_code: null }, history).map((report) => report.id))
      .toEqual(["original", "other-template"]);
  });
});
