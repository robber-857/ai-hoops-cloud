import { expect, test } from "@playwright/test";
import dribblingTemplate from "../src/config/templates/dribbling/dribble_front_onehand_oneside_height.json";
import shootingTemplate from "../src/config/templates/shooting/shoot_side_form_close.json";
import type { ReportRead } from "../src/services/reports";

const savedAt = "2026-09-28T04:00:00Z";
const reportId = "5b15527b-695b-4974-b540-088786d6e72f";
const savedFinding = "Saved left-hand evaluation";

const modes = [
  { mode: "dribbling", template: dribblingTemplate },
  { mode: "shooting", template: shootingTemplate },
] as const;

for (const { mode, template } of modes) {
  for (const frozen of [false, true]) {
    test(`${frozen ? "frozen" : "legacy"} ${mode} report reopens with its saved score without writing`, async ({ page, baseURL }) => {
      const snapshot = frozen ? { ...template, version: "v1", displayName: "Saved template title" } : null;
      const report: ReportRead = {
        public_id: reportId,
        session_public_id: "53ec9ea3-e06b-46f8-be9a-ac26982ece9d",
        video_public_id: "f78808ab-8645-493a-851b-a2ee83ba2737",
        analysis_type: mode,
        template_code: template.templateId,
        template_version: "v1",
        status: "completed",
        overall_score: 91,
        grade: "A",
        video_url: null,
        created_at: savedAt,
        analysis_finished_at: savedAt,
        template_snapshot: snapshot,
        timeline_data: [],
        summary_data: null,
        score_data: {
          overall: 91,
          grade: "A",
          analysisStatus: "ready",
          breakdown: { posture: 95, execution: 90, consistency: 89 },
          weights: { posture: 0.33, execution: 0.33, consistency: 0.34 },
          availability: { posture: true, execution: true, consistency: true },
          findings: [{
            id: template.metrics[0].metricId,
            title: savedFinding,
            score: 95,
            isPositive: true,
            state: "good",
            targetText: "Saved target",
            actualValue: "Saved observation",
            hint: "Saved feedback",
            category: "posture",
          }],
          // These raw inputs intentionally disagree with the stored score.
          saved_metrics: template.metrics.map(metric => ({ name: metric.computeKey, value: 0.01 })),
          score_context: { age_group: "13-15", handedness: "left" },
          ...(snapshot ? { template_snapshot: snapshot } : {}),
        },
      };

      const writes: string[] = [];
      await page.route(/\/api\/v1\/(?:auth\/me$|reports(?:\/|$))/, async route => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        const headers = {
          "access-control-allow-origin": new URL(baseURL!).origin,
          "access-control-allow-credentials": "true",
          "access-control-allow-headers": "authorization,content-type",
          "access-control-allow-methods": "GET,POST,OPTIONS",
        };
        if (request.method() === "OPTIONS") {
          await route.fulfill({ status: 204, headers });
        } else if (request.method() !== "GET") {
          writes.push(path);
          await route.fulfill({ status: 405, json: { detail: "Unexpected report write" }, headers });
        } else if (path.endsWith("/auth/me")) {
          await route.fulfill({ json: {
            id: 1, public_id: "2870b18a-3c00-4140-98e4-893a2d9ee5da",
            username: "synthetic-player", role: "student", is_active: true,
            nickname: null, email: null, avatar_url: null, phone_number: null,
            created_at: savedAt, updated_at: savedAt,
          }, headers });
        } else if (path.endsWith(`/reports/${reportId}/feedback`)) {
          await route.fulfill({ json: { items: [], can_write: false }, headers });
        } else if (path.endsWith(`/reports/${reportId}`)) {
          await route.fulfill({ json: report, headers });
        } else {
          await route.fulfill({ status: 404, json: { detail: "Unexpected report read" }, headers });
        }
      });

      await page.clock.install();
      await page.goto(`/pose-2d/report?id=${reportId}`);
      const age = page.getByRole("combobox", { name: "Age Group", exact: true });
      const action = page.getByRole("combobox").first();
      await expect(age).toHaveValue("13-15");
      await expect(action).toHaveValue(template.templateId);
      if (frozen) {
        await expect(action).toBeDisabled();
        await expect(action.locator("option:checked")).toHaveText("Saved template title");
        await expect(age).toBeDisabled();
      }

      // Advance past the legacy report's delayed save effect.
      await page.clock.runFor(750);
      await expect(page.getByText("91", { exact: true })).toBeVisible();
      await expect(page.getByText(savedFinding, { exact: true })).toBeVisible();
      expect(writes).toEqual([]);
    });
  }
}
