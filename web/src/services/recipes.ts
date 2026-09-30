import { apiRequest } from "@/services/client";
export type Ingredient = {
  release_id: number;
  food_key: string;
  edible_grams: string;
  preparation_note: string;
};
export type RecipeContent = {
  title: string;
  instructions: string;
  servings: string;
  finished_weight_grams: string | null;
  image_url: string | null;
  ingredients: Ingredient[];
  allergens: string[];
  dietary_notes: string;
  allergens_reviewed: boolean;
};
export type Food = {
  release_id: number;
  food_key: string;
  name: string;
  details: Record<string, string | number | null>;
};
export type Source = {
  release: string;
  attribution: string;
  licence_url: string;
  source_page: string;
};
export type Recipe = {
  public_id: string;
  version: number;
  content: RecipeContent;
  ingredients: (Ingredient & {
    name: string;
    details: Food["details"];
    source: Source;
  })[];
  nutrition: {
    ingredient_contributions: Record<string, string | null>[];
    nutrients: Record<
      string,
      {
        unit: string;
        total: string | null;
        per_serving: string | null;
        per_100g_finished: string | null;
        known_subtotal: string;
        missing_ingredient_indexes: number[];
      }
    >;
    serving_weight_grams: string | null;
  };
  portion_preview?: {
    servings_requested: string;
    weight_grams: string | null;
    nutrients: Record<
      string,
      {
        unit: string;
        amount: string | null;
        missing_ingredient_indexes: number[];
      }
    >;
  };
};
export type RecipeSummary = {
  public_id: string;
  title: string;
  version: number;
  image_url?: string | null;
};
export type Page<T> = { items: T[]; has_more: boolean };
export const recipeService = {
  list: (admin = false, offset = 0) =>
    apiRequest<Page<RecipeSummary>>(
      `${admin ? "/admin" : ""}/recipes?offset=${offset}`,
    ),
  get: (id: string, admin = false, version?: number, servings = "1") =>
    apiRequest<Recipe>(
      `${admin ? "/admin" : ""}/recipes/${id}?${new URLSearchParams({ ...(version ? { version: String(version) } : {}), servings })}`,
    ),
  create: (content: RecipeContent, request_id: string) =>
    apiRequest<Recipe>("/admin/recipes", {
      method: "POST",
      body: JSON.stringify({ ...content, request_id }),
    }),
  update: (id: string, content: RecipeContent, expected_version: number) =>
    apiRequest<Recipe>(`/admin/recipes/${id}`, {
      method: "PUT",
      body: JSON.stringify({ ...content, expected_version }),
    }),
  publish: (id: string, expected_version: number) =>
    apiRequest<Recipe>(`/admin/recipes/${id}/publish`, {
      method: "POST",
      body: JSON.stringify({ expected_version }),
    }),
  versions: (id: string, offset = 0) =>
    apiRequest<Page<{ version: number; published_at: string; title: string }>>(
      `/recipes/${id}/versions?offset=${offset}`,
    ),
  releases: () =>
    apiRequest<{ items: { id: number; name: string }[] }>("/foods/releases"),
  foods: (release: number, query: string, offset = 0) =>
    apiRequest<Page<Food>>(
      `/foods?${new URLSearchParams({ release_id: String(release), query, offset: String(offset) })}`,
    ),
};
