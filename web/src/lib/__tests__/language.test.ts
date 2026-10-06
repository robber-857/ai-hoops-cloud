import { describe, expect, it } from "vitest";
import { normalizeLanguage } from "@/lib/language";

describe("account language preference", () => {
  it.each([undefined, null, "", "fr", "zh", "EN", 0, {}])("defaults unsupported or missing preference %s to English", (value) => {
    expect(normalizeLanguage(value)).toBe("en");
  });
  it("uses Chinese only for the supported saved preference", () => {
    expect(normalizeLanguage("zh-CN")).toBe("zh-CN");
    expect(normalizeLanguage("en")).toBe("en");
  });
});
