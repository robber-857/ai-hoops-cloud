import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MetricTimelineCard from "@/components/Pose2D/MetricTimelineCard";
import { getTemplateById, parseActionTemplateSnapshot } from "@/config/templates";
import squatV1 from "./fixtures/squat-v1.json";

describe("Training chart rendering", () => {
  it("labels the age-effective target tolerance as 90-100 points, not 100 points", () => {
    const current = getTemplateById("deep_squat_reps_side")!;
    const depth = current.metrics.find((metric) => metric.metricId === "E_squat_depth")!;
    const html = renderToStaticMarkup(createElement(MetricTimelineCard, {
      templateId: current.templateId, template: { ...current, metrics: [depth] },
      timeline: [], savedMetrics: [], scoringContext: { ageGroup: "16-18" },
    }));
    expect(html).toContain("90-100 pts: -0.536-0.136");
  });
  it("renders all-missing current metrics as N/A with the six-chart counter", () => {
    const template = getTemplateById("deep_squat_reps_side")!;
    const html = renderToStaticMarkup(createElement(MetricTimelineCard, {
      templateId: template.templateId, template, timeline: [], savedMetrics: [],
      scoringContext: { ageGroup: "16-18" },
    }));
    expect(html).toContain("N/A");
    expect(html).toContain("1 / 6");
    expect(html).toContain("100 pts: 0-45 deg");
    expect(html).not.toContain("Side squat reps");
  });

  it("uses a historical seven-metric snapshot rather than the local six-metric version", () => {
    const template = parseActionTemplateSnapshot(squatV1, {
      templateId: squatV1.templateId, version: "v1",
    })!;
    const html = renderToStaticMarkup(createElement(MetricTimelineCard, {
      templateId: template.templateId, template, timeline: [], savedMetrics: [],
    }));
    expect(html).toContain("1 / 7");
    expect(html).toContain("N/A");
  });

  it("does not silently fall back to current JSON when the locked Training template is absent", () => {
    const html = renderToStaticMarkup(createElement(MetricTimelineCard, {
      templateId: "deep_squat_reps_side", timeline: [],
    }));
    expect(html).toBe("");
  });
});
