import { describe, expect, it } from "vitest";
import { getAllTemplates } from "@/config/templates";
import { templateDisplayName } from "../templateLanguage";

describe("localized template display names", () => {
  it("translates all 17 built-ins consistently using either the code or the stored name", () => {
    const templates = getAllTemplates();
    expect(templates).toHaveLength(17);
    for (const template of templates) {
      const english = templateDisplayName(template.templateId, null);
      const chinese = templateDisplayName(template.templateId, null, "zh-CN");
      expect(english).toMatch(/^[A-Za-z]/);
      expect(chinese).toMatch(/[\u3400-\u9fff]/u);
      for (const input of [template.displayName, english, chinese]) {
        expect(templateDisplayName(template.templateId, input)).toBe(english);
        expect(templateDisplayName(null, input, "zh-CN")).toBe(chinese);
      }
    }
  });

  it("retains the movement described by an older snapshot when a code was reused", () => {
    expect(templateDisplayName("pushup_hold_high_plank", "俯卧撑状态保持｜高位平板(侧面)")).toBe("High Plank");
    expect(templateDisplayName("pushup_hold_high_plank", "Forearm Plank", "zh-CN")).toBe("前臂平板支撑");
  });

  it("preserves authored labels, unrecognized codes, punctuation and fallback data", () => {
    expect(templateDisplayName("squad-drill", " Coach Lee’s 3×3 ", "zh-CN")).toBe(" Coach Lee’s 3×3 ");
    expect(templateDisplayName("shoot_front_form_close", "Saved template title", "zh-CN")).toBe("Saved template title");
    expect(templateDisplayName("custom", "Push-Up", "zh-CN")).toBe("Push-Up");
    expect(templateDisplayName("toString", undefined)).toBe("toString");
    expect(templateDisplayName(undefined, undefined)).toBe("");
    expect(templateDisplayName("  ", "  ")).toBe("");
    expect(templateDisplayName("正面｜窄距 Crossover", null)).toBe("Front Narrow Crossover");
  });
});
