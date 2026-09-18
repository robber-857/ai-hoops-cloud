import { describe, expect, it } from "vitest";
import { getTemplateById, type ActionTemplate } from "@/config/templates";
import { calculateRealScore } from "../scoring";

type Golden = [number, number, number, number, number[]];
// Fixed outputs captured from the published scorer at 299aaf3, not the current implementation.
const golden: Record<string, Golden[]> = {
  dribble_front_narrow_crossover: [
    [100,100,100,100,[100,100,100,100,100,100,100]],
    [75.37581253897044,73.788416988417,80.95238095238095,71.38663967611338,[74,74,74,81,81,72,71]],
    [87.22459013227302,90.72313196642357,84.61538461538461,86.3352538150109,[91,91,91,85,85,88,85]],
    [43.333333333333336,20,60,50,[0,100,0,100,0,100,0]], [0,0,0,0,[0,0,0,0,0,0,0]],
  ],
  dribble_front_onehand_oneside_height: [
    [100,100,100,100,[100,100,100,100]],
    [77.68253968253968,80.95238095238093,80.95238095238096,71.14285714285714,[81,81,81,71]],
    [84.7948717948718,84.6153846153846,84.61538461538461,85.15384615384616,[85,85,85,85]],
    [46.666666666666664,40,0,100,[0,100,0,100]], [0,0,0,0,[0,0,0,0]],
  ],
  dribble_front_onehand_v: [
    [100,100,100,100,[100,100,100,100,100,100]],
    [73.16811442525729,72.85714285714286,76.2625850340136,70.38461538461539,[73,73,71,81,70,71]],
    [85.12881093265707,90.38461538461539,83.52252747252747,81.4792899408284,[90,90,82,85,80,85]],
    [46.111111111111114,50,55.00000000000001,33.333333333333336,[0,100,0,100,0,100]], [0,0,0,0,[0,0,0,0,0,0]],
  ],
  dribble_side_narrow_crossover: [
    [100,100,100,100,[100,100,100,100,100,100,100,100]],
    [72.46190476190476,65.0047619047619,80.95238095238093,71.42857142857144,[81,81,81,0,81,73,81,71]],
    [80.50641025641026,70.36538461538461,84.6153846153846,86.53846153846155,[85,85,85,0,85,90,85,87]],
    [50,50,0,100,[0,100,0,100,0,100,0,100]], [0,0,0,0,[0,0,0,0,0,0,0,0]],
  ],
  dribble_side_onehand_oneside: [
    [100,100,100,100,[100,100,100,100,100,100,100,100]],
    [75.10682650682652,78.0952380952381,74.33116883116885,70.68131868131869,[81,81,71,81,71,81,71,71]],
    [85.13308230231308,85.1923076923077,86.18181818181819,82.9171597633136,[85,85,87,85,87,85,83,83]],
    [38,45,30,40,[0,100,0,100,0,100,0,100]], [0,0,0,0,[0,0,0,0,0,0,0,0]],
  ],
  shoot_front_form_close: [
    [78,45,100,100,[0,100,100,100]],
    [57.25714285714287,36.42857142857142,71.14285714285717,71.14285714285715,[0,81,71,71]],
    [66.32307692307694,38.07692307692308,85.15384615384617,85.15384615384616,[0,85,85,85]],
    [38,45,0,100,[0,100,0,100]], [0,0,0,0,[0,0,0,0]],
  ],
  shoot_side_form_close: [
    [80,50,100,100,[100,100,0,100,100,100,100]],
    [47.17142857142858,21.642857142857142,60.71428571428571,71.14285714285715,[72,0,0,81,81,0,71]],
    [53.21538461538462,27,63.46153846153845,85.15384615384616,[90,0,0,85,85,0,85]],
    [34,20,65,0,[0,100,0,100,0,100,0]], [0,0,0,0,[0,0,0,0,0,0,0]],
  ],
};
const cases = [
  ["ideal", "16-18", "right"], ["outside", "16-18", "right"],
  ["outside", "4-7", "left"], ["sparse", "16-18", "right"], ["empty", "16-18", "right"],
] as const;

function fixture(template: ActionTemplate, scenario: string, options: Record<string, string>) {
  if (scenario === "empty") return [];
  return template.metrics.flatMap((metric, index) => {
    if (scenario === "sparse" && index % 2 === 0) return [];
    const p = metric.params;
    const outside = scenario === "outside";
    let value: number;
    if (metric.type === "target") {
      value = (p.target || 0) + (outside ? (p.tol || 5) + (p.margin || 15) * 0.25 : 0);
    } else if (metric.type === "range" || metric.type === "rangeByOption") {
      const key = p.optionKey || "handedness";
      const selected = options[key] || (template.options?.[key] as string) || "right";
      const range = metric.type === "range"
        ? { L: p.L || 0, U: p.U || 180, margin: p.margin || 15 }
        : p.ranges![selected];
      value = outside ? range.U + (range.margin || 0.1) * 0.2 : (range.L + range.U) / 2;
    } else {
      value = outside ? 0 : (p.target ?? 1);
    }
    return [{ name: metric.computeKey, value }];
  });
}

describe("published dribbling and shooting regression", () => {
  for (const [id, expectedCases] of Object.entries(golden)) {
    cases.forEach(([scenario, ageGroup, hand], caseIndex) => {
      it(`${id}: ${scenario}, ${ageGroup}, ${hand}`, () => {
        const template = getTemplateById(id)!;
        const options = { ageGroup, handedness: hand, shootingHand: hand };
        const result = calculateRealScore(template, fixture(template, scenario, options), options);
        const expected = expectedCases[caseIndex];
        expect(result.overall).toBeCloseTo(expected[0], 12);
        expect(result.breakdown.posture).toBeCloseTo(expected[1], 12);
        expect(result.breakdown.execution).toBeCloseTo(expected[2], 12);
        expect(result.breakdown.consistency).toBeCloseTo(expected[3], 12);
        expect(result.findings.map((finding) => finding.score)).toEqual(expected[4]);
        expect(result.weights).toEqual(template.overallWeights || template.categoryWeights);
        result.findings.forEach((finding, index) => {
          const metric = template.metrics[index];
          const missing = scenario === "empty" || (scenario === "sparse" && index % 2 === 0);
          expect(finding.isMissing).toBe(missing);
          expect(finding.isPositive).toBe(!missing && expected[4][index] >= 75);
          expect(finding.title).toBe(metric.metricId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
          expect(finding.hint).toBe(missing
            ? `Data missing: ${metric.computeKey} was not collected for this clip. Use a clearer ${template.camera} view and make sure the movement completes enough reps for this metric.`
            : expected[4][index] < 75 ? metric.hint_bad || ""
              : metric.hint_good || (expected[4][index] < 90
                ? "Improve the details of the movements to get a better score." : "Good form maintained."));
        });
      });
    });
  }
});
