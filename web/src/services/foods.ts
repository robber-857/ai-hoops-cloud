import { apiRequest } from "@/services/client";
import { resolveFoodSearch } from "@/lib/foodLanguage";

export type FoodCategory = "meat" | "eggs" | "dairy" | "vegetables";
export type TrainingFood = {
  release_id: number;
  food_key: string;
  name: string;
  source_name: string;
  category: FoodCategory;
  preparation: string;
  carbohydrate_g: string | null;
  protein_g: string | null;
  fat_g: string | null;
};
export type FoodSource = {
  release_id: number;
  name: string;
  fingerprint: string;
  attribution: string;
  licence_url: string;
  source_page: string;
  translation_notice: string;
};
export type TrainingFoodPage = {
  items: TrainingFood[];
  has_more: boolean;
  total: number;
  categories: { key: FoodCategory; name: string }[];
  source: FoodSource | null;
  catalog_version: string;
  expected_release: string;
  basis: "per_100g_edible_portion";
  data_status: "ready" | "source_unavailable" | "partial_catalog";
  missing_food_count: number;
  data_notice: string;
};

export const foodService = {
  list: (category: FoodCategory | "" = "", query = "", offset = 0) => {
    const params = new URLSearchParams({ query: resolveFoodSearch(query), offset: String(offset), limit: "20" });
    if (category) params.set("category", category);
    return apiRequest<TrainingFoodPage>(`/training-foods?${params}`);
  },
};
