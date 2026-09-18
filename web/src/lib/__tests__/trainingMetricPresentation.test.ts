import { describe, expect, it } from "vitest";

import { getTemplateById, parseActionTemplateSnapshot } from "@/config/templates";
import squatV1 from "./fixtures/squat-v1.json";

import { resolveMetricScoreBand } from "../scoring";
import { buildTrainingMetricChartModels } from "../trainingMetricPresentation";

describe("training metric chart contract", () => {
  it("creates one chart model for every locked metric even when values are missing", () => {
    const template = getTemplateById("deep_squat_reps_side");
    expect(template).toBeDefined();
    if (!template) return;

    const models = buildTrainingMetricChartModels(template, [], [], { ageGroup: "16-18" });

    expect(models).toHaveLength(template.metrics.length);
    expect(models.map((model) => model.metric.metricId)).toEqual(
      template.metrics.map((metric) => metric.metricId),
    );
    expect(models.every((model) => model.summaryValue === null)).toBe(true);
  });

  it("keeps a removed historical metric as an N/A chart model", () => {
    const currentTemplate = getTemplateById("deep_squat_reps_side");
    expect(currentTemplate).toBeDefined();
    if (!currentTemplate) return;

    // The published 299aaf3 fixture preserves the real v1 ordering and parameters.
    const historicalTemplate = parseActionTemplateSnapshot(squatV1, {
      templateId: currentTemplate.templateId, version: "v1",
    })!;

    const models = buildTrainingMetricChartModels(historicalTemplate, [], [], {
      ageGroup: "16-18",
    });

    expect(models).toHaveLength(7);
    expect(models[4].metric.metricId).toBe("E_rep_rhythm");
    expect(models[4].summaryValue).toBeNull();
    expect(models[4].scoreBand).toMatchObject({ min: 1.5, max: 4 });
    expect(currentTemplate.metrics).toHaveLength(6);
    expect(models.map((model) => model.metric.metricId)).toEqual(
      squatV1.metrics.map((metric) => metric.metricId),
    );
  });

  it("uses the same resolved score band as the scorer", () => {
    const template = getTemplateById("deep_squat_reps_side");
    expect(template).toBeDefined();
    if (!template) return;

    const models = buildTrainingMetricChartModels(template, [], [], { ageGroup: "10-12" });

    models.forEach((model) => {
      expect(model.scoreBand).toEqual(
        resolveMetricScoreBand(model.metric, {
          ...(template.options || {}),
          ageGroup: "10-12",
        }),
      );
    });
  });
});
