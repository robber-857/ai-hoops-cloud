import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { TrainingFood } from "@/services/foods";
import { FoodNutrientCard, FoodSourceNote } from "@/components/foods/FoodNutritionParts";
import { FoodNutritionList } from "@/components/foods/FoodNutritionList";
import { AFCD_SOURCE_URL } from "@/lib/foodLanguage";
import type { AppLanguage } from "@/lib/language";

const state = vi.hoisted(() => ({
  user: { role: "student", username: "fixture" }, language: "en" as AppLanguage,
  preferenceLoading: false, preferenceError: "", reload: vi.fn(),
}));
vi.mock("@/store/authStore", () => ({ useAuthStore: (select: (s: typeof state) => unknown) => select(state) }));
vi.mock("@/components/account/LanguagePreferenceProvider", () => ({
  LanguagePreferenceProvider: ({ children }: { children: unknown }) => children,
  useLanguagePreference: () => ({
    language: state.language, loading: state.preferenceLoading, error: state.preferenceError, reload: state.reload,
  }),
}));
vi.mock("@/components/auth/ProtectedRoute", () => ({ ProtectedRoute: ({ children }: { children: unknown }) => children }));
vi.mock("@/components/admin/AdminShell", () => ({ AdminShell: () => "Admin workspace" }));
vi.mock("@/components/coach/CoachShell", () => ({ CoachShell: () => "Coach workspace" }));
vi.mock("@/components/account/AccountCenterShell", () => ({ AccountCenterShell: () => "Player workspace" }));
import FoodLayout from "@/app/foods/layout";

const milk: TrainingFood = {
  release_id: 17, food_key: "F005634", name: "全脂牛奶", category: "dairy",
  source_name: "Milk, cow, fluid, regular fat (~3.5%)", preparation: "液态，约3.5%脂肪",
  carbohydrate_g: "5.4", protein_g: "3.3", fat_g: "3.4",
};

describe("read-only food nutrient presentation", () => {
  it("defaults to English and keeps milk on a 100g basis with source precision", () => {
    const html = renderToStaticMarkup(createElement(FoodNutrientCard, { food: milk }));
    expect(html).toContain("Whole milk");
    expect(html).toContain("Per 100 g edible portion");
    expect(html).toContain("Liquid, ~3.5% fat");
    expect(html).toContain("5.4 g");
    expect(html).toContain("3.3 g");
    expect(html).toContain("3.4 g");
    expect(html).not.toMatch(/\p{Script=Han}/u);
    expect(html).not.toContain("<details");
    expect(html).not.toContain("100 mL");
    expect(html).not.toContain(milk.food_key);
    expect(html).not.toContain("<input");
  });

  it("shows null as unavailable while retaining official zero in another nutrient", () => {
    const html = renderToStaticMarkup(createElement(FoodNutrientCard, { food: { ...milk, carbohydrate_g: null, fat_g: "0", protein_g: "3.30" } }));
    expect(html).toContain("No data");
    expect(html).toContain("0 g");
    expect(html).toContain("3.30 g");
    expect(html).not.toContain("null g");
  });

  it("uses Chinese names, states and nutrient labels only when selected", () => {
    const html = renderToStaticMarkup(createElement(FoodNutrientCard, { food: milk, language: "zh-CN" }));
    expect(html).toContain("全脂牛奶");
    expect(html).toContain("每 100 g 可食部分");
    expect(html).toContain("液态，约3.5%脂肪");
    expect(html).toContain("碳水化合物");
    expect(html).toContain("蛋白质");
    expect(html).not.toContain("Whole milk");
  });

  it.each(["en", "zh-CN"] as const)("keeps only the AFCD source link in the %s footer", (language) => {
    const html = renderToStaticMarkup(createElement(FoodSourceNote, { language }));
    expect(html).toContain(language === "en" ? "Source:" : "来源:");
    expect(html).toContain(AFCD_SOURCE_URL);
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).not.toContain("licence");
    expect(html).not.toContain("FSANZ");
    expect(html).not.toContain("翻译");
    expect(html).not.toContain("批次");
  });

  it.each(["en", "zh-CN"] as const)("reads %s from the account preference for page controls", (language) => {
    state.language = language;
    const html = renderToStaticMarkup(createElement(FoodNutritionList));
    expect(html).toContain('lang="' + language + '"');
    expect(html).toContain(language === "en" ? "Food nutrition" : "食材营养");
    expect(html).toContain(language === "en" ? "Food categories" : "食材分类");
    expect(html).toContain(language === "en" ? "Loading foods…" : "正在加载食材…");
    if (language === "en") expect(html).not.toMatch(/\p{Script=Han}/u);
    state.language = "en";
  });

  it("waits for the saved preference before exposing English page controls", () => {
    state.language = "en";
    state.preferenceLoading = true;
    const html = renderToStaticMarkup(createElement(FoodNutritionList));
    expect(html).toContain("Loading foods…");
    expect(html).not.toContain("Food nutrition");
    expect(html).not.toContain("<form");
    state.preferenceLoading = false;
  });

  it("keeps foods usable and offers preference retry when the language request fails", () => {
    state.preferenceError = "服务端错误信息";
    const html = renderToStaticMarkup(createElement(FoodNutritionList));
    expect(html).toContain("Could not load your language preference. Showing English.");
    expect(html).toContain("Retry language preference");
    expect(html).toContain("Food nutrition");
    expect(html).toContain("<form");
    expect(html).not.toContain(state.preferenceError);
    state.preferenceError = "";
  });

  it.each([["admin", "Admin"], ["coach", "Coach"], ["student", "Player"], ["user", "Player"]])("%s keeps its %s workspace", (role, workspace) => {
    state.user.role = role;
    expect(renderToStaticMarkup(createElement(FoodLayout, null, "Food nutrients"))).toBe(`${workspace} workspace`);
    expect(state.user.role).toBe(role);
  });
});
