import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getAllTemplates, getTemplateById } from "@/config/templates";
import MetricTimelineCard from "./MetricTimelineCard";
import { liveMetricLabel } from "./liveMetricLabels";
import { poseTranslator } from "./poseCopy";
import { ReportFindingItem } from "./ReportFindingItem";

vi.mock("@/components/account/LanguagePreferenceProvider", () => ({ useAppLanguage: () => "zh-CN" }));

const chinese = poseTranslator("zh-CN");
const english = poseTranslator("en");

describe("pose analysis display language", () => {
  it("renders the built-in filming instructions, metrics, targets and coaching cues in both languages", () => {
    for (const template of getAllTemplates()) {
      const phrases = [template.cameraInstructions, ...template.metrics.flatMap(metric =>
        [metric.displayName, metric.targetText, metric.hint_good, metric.hint_low, metric.hint_high, metric.hint_bad])];
      for (const phrase of phrases) {
        if (!phrase) continue;
        expect(chinese(phrase), phrase).toMatch(/[\u3400-\u9fff]/u);
        expect(english(phrase), phrase).not.toMatch(/[\u3400-\u9fff]/u);
      }
    }
  });

  it("localizes a finding and the score band rendered by its training chart", () => {
    const finding = renderToStaticMarkup(createElement(ReportFindingItem, { finding: {
      id: "P_toe_forward_L", title: "P Toe Forward L", score: 92,
      state: "good", isPositive: true, category: "posture", actualValue: "5 degrees",
      targetText: "Aim for 0-10.", hint: "Good form maintained.",
    } }));
    for (const label of ["左脚尖方向", "5 度", "0-10", "动作保持良好"]) expect(finding).toContain(label);

    const template = getTemplateById("deep_squat_reps_side")!;
    const chart = renderToStaticMarkup(createElement(MetricTimelineCard, {
      templateId: template.templateId, template, timeline: [], savedMetrics: [],
    }));
    expect(chart).toContain("表现曲线");
    expect(chart).toContain("100 分：0-45°");
    expect(chart).not.toContain("pts:");
  });

  it("keeps unknown text intact and formats live measurements using their stored identifiers", () => {
    expect(chinese("Coach Dani · 3×3")).toBe("Coach Dani · 3×3");
    expect(liveMetricLabel("leftWristHeightRatioToHip", "zh-CN")).toBe("左侧手腕相对髋部的高度");
    expect(liveMetricLabel("leftWristHeightRatioToHip", "en")).toBe("Left wrist height relative to hip");
    expect(liveMetricLabel("customMeasurement", "zh-CN")).toBeUndefined();
  });
});
