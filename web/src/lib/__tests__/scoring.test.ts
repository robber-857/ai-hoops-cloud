import { describe, expect, it } from "vitest";

import { getAllTemplates, getTemplateById } from "@/config/templates";
import globalConfig from "@/config/templates/global.json";

import { calculateRealScore, resolveMetricScoreBand } from "../scoring";

describe("training score availability and feedback", () => {
  for (const template of getAllTemplates("training")) {
    for (const ageGroup of Object.keys(globalConfig.ageToleranceScale)) {
      it(`${template.templateId}: JSON bands and scores at ${ageGroup}`, () => {
        const options = { ...template.options, ageGroup };
        const ideal = template.metrics.map((metric) => {
          const band = resolveMetricScoreBand(metric, options)!;
          return { name: metric.computeKey, value: band.target ?? (band.min + band.max) / 2 };
        });
        expect(calculateRealScore(template, ideal, options).overall).toBeCloseTo(100);
        template.metrics.forEach((metric, index) => {
          const band = resolveMetricScoreBand(metric, options)!;
          expect(band.kind).toBe(metric.type);
          if (metric.type === "range") {
            expect(band.min).toBe(metric.params.L);
            expect(band.max).toBe(metric.params.U);
          } else if (metric.type === "target") {
            expect(band.target).toBe(metric.params.target);
            expect(band.max - band.min).toBeCloseTo(2 * band.tolerance!);
          }
          for (const edge of [band.min, band.max]) {
            const values = ideal.map((value, i) => i === index ? { ...value, value: edge } : value);
            const finding = calculateRealScore(template, values, options).findings[index];
            expect(finding.score).toBe(band.scoreFloorInsideBand);
          }
          if (band.margin > 0) {
            const values = ideal.map((value, i) => i === index
              ? { ...value, value: band.max + band.margin / 2 } : value);
            const finding = calculateRealScore(template, values, options).findings[index];
            expect(finding.score).toBe(band.kind === "target" ? 45 : 50);
            expect(finding.state).toBe("high");
          }
        });
      });
    }
  }
  it("keeps target tolerance as a 90-100 score band", () => {
    const template = getTemplateById("deep_squat_reps_side");
    expect(template).toBeDefined();
    if (!template) return;
    const metric = template.metrics.find((item) => item.metricId === "E_squat_depth");
    expect(metric).toBeDefined();
    if (!metric) return;

    const band = resolveMetricScoreBand(metric, { ageGroup: "16-18" });
    expect(band?.kind).toBe("target");
    expect(band?.target).toBe(-0.2);
    expect(band?.min).toBeCloseTo(-0.536);
    expect(band?.max).toBeCloseTo(0.136);
    expect(band?.scoreFloorInsideBand).toBe(90);
    expect(band?.scoreCeilingInsideBand).toBe(100);

    const scoreAt = (value: number) =>
      calculateRealScore(template, [{ name: metric.computeKey, value }]).findings.find(
        (finding) => finding.id === metric.metricId,
      )?.score;

    expect(scoreAt(-0.2)).toBe(100);
    expect(scoreAt(0.136)).toBe(90);
    expect(scoreAt(0.1885)).toBe(45);
  });

  it("keeps range bounds as the exact 100 point interval", () => {
    const template = getTemplateById("deep_squat_reps_side");
    expect(template).toBeDefined();
    if (!template) return;
    const metric = template.metrics.find((item) => item.metricId === "P_trunk_lean");
    expect(metric).toBeDefined();
    if (!metric) return;

    const band = resolveMetricScoreBand(metric, { ageGroup: "4-7" });
    expect(band).toMatchObject({
      kind: "range",
      min: 0,
      max: 45,
      scoreFloorInsideBand: 100,
      scoreCeilingInsideBand: 100,
    });
  });

  it("renormalizes posture and execution when consistency is unavailable", () => {
    const template = getTemplateById("pushup_reps_side");
    expect(template).toBeDefined();
    if (!template) return;

    const result = calculateRealScore(template, [
      { name: "pushupHipLineDeviationNorm", value: 0.02 },
      { name: "pushupBottomElbowDeg", value: 90 },
      { name: "pushupTopElbowDeg", value: 170 },
    ]);

    expect(result.analysisStatus).toBe("ready");
    expect(result.availability.consistency).toBe(false);
    expect(result.weights).toEqual({ posture: 0.5, execution: 0.5, consistency: 0 });
    expect(result.overall).toBe(100);
    expect(
      result.findings
        .filter((finding) => finding.category === "consistency")
        .every((finding) => finding.state === "missing"),
    ).toBe(true);
  });

  it("uses different child-readable guidance for low and high values", () => {
    const template = getTemplateById("jumping_jack_reps_front");
    expect(template).toBeDefined();
    if (!template) return;

    const result = calculateRealScore(template, [
      { name: "jumpingJackTorsoLeanDeg", value: 5 },
      { name: "jumpingJackLandingKneeOffsetNorm", value: 0.02 },
      { name: "jumpingJackOpenStanceRatio", value: 1.1 },
      { name: "jumpingJackArmHeightRatio", value: 1.6 },
    ]);
    const width = result.findings.find((finding) => finding.id === "E_open_width");
    const arms = result.findings.find((finding) => finding.id === "E_arm_height");

    expect(width?.state).toBe("low");
    expect(width?.hint).toContain("wider");
    expect(arms?.state).toBe("high");
    expect(arms?.hint).toContain("relax");
    expect(width?.actualValue).not.toBeNull();
    expect(width?.targetText).toContain("1.4-2.4");
  });

  it("does not generate a total score when a whole required category is missing", () => {
    const template = getTemplateById("single_leg_stand_front");
    expect(template).toBeDefined();
    if (!template) return;

    const result = calculateRealScore(template, [
      { name: "singleLegPelvisTiltDeg", value: 2 },
      { name: "singleLegTorsoLeanDeg", value: 4 },
    ]);

    expect(result.analysisStatus).toBe("insufficient_data");
    expect(result.availability.execution).toBe(false);
    expect(result.overall).toBe(0);
  });
});
