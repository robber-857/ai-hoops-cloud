import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { TrainingFood } from "@/services/foods";
import { FoodNutrientCard, FoodSourceNote } from "@/components/foods/FoodNutritionParts";

const state = vi.hoisted(() => ({ user: { role: "student", username: "fixture" } }));
vi.mock("@/store/authStore", () => ({ useAuthStore: (select: (s: typeof state) => unknown) => select(state) }));
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
  it("keeps milk on a 100g basis, source precision and preparation visible", () => {
    const html = renderToStaticMarkup(createElement(FoodNutrientCard, { food: milk }));
    expect(html).toContain("全脂牛奶");
    expect(html).toContain("每 100 g 可食部分");
    expect(html).toContain("液态，约3.5%脂肪");
    expect(html).toContain("5.4 g");
    expect(html).toContain("3.3 g");
    expect(html).toContain("3.4 g");
    expect(html).toContain(milk.source_name);
    expect(html).not.toContain("100 mL");
    expect(html).not.toContain(milk.food_key);
    expect(html).not.toContain("<input");
  });

  it("shows null as unavailable while retaining official zero in another nutrient", () => {
    const html = renderToStaticMarkup(createElement(FoodNutrientCard, { food: { ...milk, carbohydrate_g: null, fat_g: "0", protein_g: "3.30" } }));
    expect(html).toContain("暂无数据");
    expect(html).toContain("0 g");
    expect(html).toContain("3.30 g");
    expect(html).not.toContain("null g");
  });

  it("attributes the selected official release, translation and licence", () => {
    const html = renderToStaticMarkup(createElement(FoodSourceNote, {
      source: { release_id: 17, name: "AFCD Release 3", fingerprint: "pinned", attribution: "FSANZ, Australian Food Composition Database, Release 3", licence_url: "https://www.foodstandards.gov.au/licence", source_page: "https://www.foodstandards.gov.au/data-files", translation_notice: "Translated names; nutrient values unchanged." },
      notice: "Australian data may not be appropriate elsewhere.",
    }));
    expect(html).toContain("FSANZ");
    expect(html).toContain("Release 3");
    expect(html).toContain("https://www.foodstandards.gov.au/licence");
    expect(html).toContain("英文翻译为中文");
    expect(html).toContain("Australian data may not be appropriate elsewhere.");
  });

  it.each([["admin", "Admin"], ["coach", "Coach"], ["student", "Player"], ["user", "Player"]])("%s keeps its %s workspace", (role, workspace) => {
    state.user.role = role;
    expect(renderToStaticMarkup(createElement(FoodLayout, null, "Food nutrients"))).toBe(`${workspace} workspace`);
    expect(state.user.role).toBe(role);
  });
});
