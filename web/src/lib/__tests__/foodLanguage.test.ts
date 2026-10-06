import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ENGLISH_FOOD_LABELS, foodCopy, foodDisplay, foodErrorMessage, resolveFoodSearch } from "@/lib/foodLanguage";
import { ApiError, apiRequest } from "@/services/client";
import { foodService, type TrainingFood } from "@/services/foods";

vi.mock("@/services/client", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/services/client")>(),
  apiRequest: vi.fn(),
}));

const catalog = JSON.parse(readFileSync(new URL("../../../../server/app/config/training_foods.json", import.meta.url), "utf8")) as {
  foods: Pick<TrainingFood, "food_key" | "name" | "source_name" | "category" | "preparation">[];
};
const fixture: TrainingFood = {
  release_id: 17, food_key: "F005634", name: "全脂牛奶", source_name: "Milk, cow, fluid, regular fat (~3.5%)",
  category: "dairy", preparation: "液态，约3.5%脂肪", carbohydrate_g: "5.4", protein_g: "3.3", fat_g: "3.4",
};

describe("food language and official-state fallback", () => {
  it("covers exactly the curated release keys and keeps all English names and states readable", () => {
    expect(catalog.foods).toHaveLength(28);
    expect(Object.keys(ENGLISH_FOOD_LABELS).sort()).toEqual(catalog.foods.map((food) => food.food_key).sort());
    for (const food of catalog.foods) {
      const display = foodDisplay({ ...fixture, ...food });
      expect(display.name).not.toMatch(/\p{Script=Han}/u);
      expect(display.preparation).not.toMatch(/\p{Script=Han}/u);
      expect(display.name.trim()).not.toBe("");
      expect(display.preparation.trim()).not.toBe("");
      expect(resolveFoodSearch(display.name)).toBe(food.name);
      if (/\braw\b/.test(food.source_name)) expect(display.preparation).toMatch(/\braw\b/i);
      if (/\bhard-boiled\b/.test(food.source_name)) expect(display.preparation).toMatch(/\bhard-boiled\b/i);
      if (/no added fat/.test(food.source_name)) expect(display.preparation).toContain("no added fat");
      if (/boiled, drained/.test(food.source_name)) expect(display.preparation).toContain("boiled and drained");
    }
  });

  it("preserves raw and cooked distinctions and leaves API data unchanged", () => {
    const original = structuredClone(fixture);
    expect(foodDisplay(fixture)).toEqual({ name: "Whole milk", preparation: "Liquid, ~3.5% fat" });
    expect(foodDisplay({ ...fixture, food_key: "F001905" }).preparation).toBe("Fresh, raw");
    expect(foodDisplay({ ...fixture, food_key: "F001900" }).preparation).toBe("Fresh, boiled and drained");
    expect(foodDisplay(fixture, "zh-CN")).toEqual({ name: fixture.name, preparation: fixture.preparation });
    expect(fixture).toEqual(original);
  });

  it("uses the official English name for a future key without inventing preparation", () => {
    expect(foodDisplay({ ...fixture, food_key: "F999999", source_name: "Future official food, raw" })).toEqual({
      name: "Future official food, raw", preparation: "",
    });
    expect(foodDisplay({ ...fixture, food_key: "F999999", source_name: "" })).toEqual({ name: "Food item", preparation: "" });
  });

  it("resolves exact visible names and eggs while preserving unknown and Chinese queries", () => {
    expect(resolveFoodSearch(" WHOLE MILK ")).toBe("全脂牛奶");
    expect(resolveFoodSearch("Whole egg")).toBe("鸡蛋（全蛋）");
    expect(resolveFoodSearch("eggs")).toBe("egg");
    expect(resolveFoodSearch("Future official food, raw")).toBe("Future official food, raw");
    expect(resolveFoodSearch("  未收录的搜索  ")).toBe("  未收录的搜索  ");
    expect(resolveFoodSearch("")).toBe("");
  });

  it("treats inherited object names as unknown searches and food keys", () => {
    for (const key of ["constructor", "__proto__", "toString"]) {
      expect(resolveFoodSearch(key)).toBe(key);
      expect(foodDisplay({ ...fixture, food_key: key })).toEqual({ name: fixture.source_name, preparation: "" });
    }
  });

  it("sends the resolved search to the API without changing categories or pagination", async () => {
    vi.mocked(apiRequest).mockClear();
    vi.mocked(apiRequest).mockResolvedValue({ items: [] });
    await foodService.list("dairy", "Whole milk", 20);
    const path = vi.mocked(apiRequest).mock.calls[0][0];
    const params = new URL(path, "https://api.example.test").searchParams;
    expect(params.get("query")).toBe("全脂牛奶");
    expect(params.get("category")).toBe("dairy");
    expect(params.get("offset")).toBe("20");
    expect(params.get("limit")).toBe("20");
  });

  it("passes unknown searches unchanged through the service", async () => {
    vi.mocked(apiRequest).mockClear();
    await foodService.list("", "unlisted English search");
    const params = new URL(vi.mocked(apiRequest).mock.calls[0][0], "https://api.example.test").searchParams;
    expect(params.get("query")).toBe("unlisted English search");
    expect(params.has("category")).toBe(false);
  });

  it.each([undefined, null, "", "zh", "fr", 1])("defaults unsupported or missing preference %s to English", (language) => {
    expect(foodCopy(language).title).toBe("Food nutrition");
    expect(foodCopy(language).categories.vegetables).toBe("Vegetables");
  });

  it("localizes result counts and both pagination directions", () => {
    expect(foodCopy().results(1)).toBe("1 matching food · Per 100 g");
    expect(foodCopy().results(28)).toBe("28 matching foods · Per 100 g");
    expect(foodCopy("zh-CN").results(28)).toBe("共 28 条匹配食材 · 每 100 g");
    expect([foodCopy().previous, foodCopy().next]).toEqual(["Previous", "Next"]);
    expect([foodCopy("zh-CN").previous, foodCopy("zh-CN").next]).toEqual(["上一页", "下一页"]);
  });

  it.each([401, 403, 422, 503, 500])("localizes API status %s instead of leaking backend language", (status) => {
    const error = new ApiError("服务端中文错误", status);
    expect(foodErrorMessage(error)).not.toMatch(/\p{Script=Han}/u);
    expect(foodErrorMessage(error, "zh-CN")).toMatch(/\p{Script=Han}/u);
    expect(foodErrorMessage(error, "zh-CN")).not.toContain(error.message);
  });

  it("uses the selected language for unknown rejection reasons", () => {
    expect(foodErrorMessage(new Error("网络错误"))).toBe("Could not load food data. Please try again.");
    expect(foodErrorMessage(null, "zh-CN")).toBe("食材数据暂时无法加载，请重试。");
  });
});
