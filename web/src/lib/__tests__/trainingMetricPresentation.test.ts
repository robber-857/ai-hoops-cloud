import { describe, expect, it } from "vitest";

import { getTemplateById, type ActionTemplate, type Metric } from "@/config/templates";

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

    const historicalMetric: Metric = {
      metricId: "E_rep_rhythm",
      displayName: "Rep Rhythm",
      category: "execution",
      weight: 0.2,
      type: "range",
      computeKey: "repTempoSec",
      params: { L: 1.5, U: 4, margin: 2 },
    };
    const historicalTemplate: ActionTemplate = {
      ...currentTemplate,
      version: "v1",
      metrics: [...currentTemplate.metrics, historicalMetric],
    };

    const models = buildTrainingMetricChartModels(historicalTemplate, [], [], {
      ageGroup: "16-18",
    });

    expect(models).toHaveLength(7);
    expect(models.at(-1)?.metric.metricId).toBe("E_rep_rhythm");
    expect(models.at(-1)?.summaryValue).toBeNull();
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
