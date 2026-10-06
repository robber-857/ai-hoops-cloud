import { normalizeLanguage, type AppLanguage } from "@/lib/language";
import { ApiError } from "@/services/client";
import type { FoodCategory, TrainingFood } from "@/services/foods";

export const AFCD_SOURCE_URL = "https://www.foodstandards.gov.au/science-data/food-nutrient-databases/afcd/data-files";
export const FOOD_CATEGORIES: (FoodCategory | "")[] = ["", "meat", "eggs", "dairy", "vegetables"];

const FOOD_COPY = {
  en: {
    title: "Food nutrition",
    basis: "Per 100 g edible portion",
    searchLabel: "Search food names or preparation",
    searchPlaceholder: "Search eggs, milk, broccoli…",
    search: "Search",
    categoryLabel: "Food categories",
    categories: { "": "All", meat: "Meat", eggs: "Eggs", dairy: "Dairy", vegetables: "Vegetables" },
    loading: "Loading foods…",
    retry: "Retry",
    unavailable: "Food data is not ready yet. Please check again later.",
    partial: "Some foods are unavailable. Available entries are shown below.",
    empty: "No matching foods. Try another name or category.",
    previous: "Previous",
    next: "Next",
    carbohydrate: "Carbohydrate",
    protein: "Protein",
    fat: "Fat",
    missing: "No data",
    source: "Source",
    item: "Food item",
    loadError: "Could not load food data. Please try again.",
    signInError: "Please sign in to view food data.",
    permissionError: "Your account cannot access food data.",
    validationError: "Check your search and try again.",
    unavailableError: "Food data is temporarily unavailable. Please try again.",
    languageWarning: "Could not load your language preference. Showing English.",
    retryLanguage: "Retry language preference",
    results: (count: number) => count + " matching " + (count === 1 ? "food" : "foods") + " · Per 100 g",
  },
  "zh-CN": {
    title: "食材营养",
    basis: "每 100 g 可食部分",
    searchLabel: "搜索食材名称或状态",
    searchPlaceholder: "搜索食材，如鸡蛋、牛奶、西兰花",
    search: "搜索",
    categoryLabel: "食材分类",
    categories: { "": "全部", meat: "肉类", eggs: "蛋类", dairy: "奶类", vegetables: "蔬菜" },
    loading: "正在加载食材…",
    retry: "重新加载",
    unavailable: "正式食材数据尚未准备好，请稍后查看。",
    partial: "部分食材暂不可用，以下显示已准备好的条目。",
    empty: "没有匹配的食材，试试其他名称或分类。",
    previous: "上一页",
    next: "下一页",
    carbohydrate: "碳水化合物",
    protein: "蛋白质",
    fat: "脂肪",
    missing: "暂无数据",
    source: "来源",
    item: "食材",
    loadError: "食材数据暂时无法加载，请重试。",
    signInError: "请先登录后查看食材数据。",
    permissionError: "当前账户无法访问食材数据。",
    validationError: "请检查搜索内容后重试。",
    unavailableError: "食材数据暂不可用，请稍后重试。",
    languageWarning: "无法加载语言偏好，暂以英文显示。",
    retryLanguage: "重新加载语言偏好",
    results: (count: number) => "共 " + count + " 条匹配食材 · 每 100 g",
  },
};

/** English display metadata for the exact curated AFCD keys; nutrients remain server data. */
export const ENGLISH_FOOD_LABELS: Readonly<Record<string, { name: string; preparation: string }>> = {
  F002594: { name: "Chicken breast (skinless, lean)", preparation: "Raw" },
  F002593: { name: "Chicken breast (skinless, lean)", preparation: "Grilled, no added fat" },
  F000836: { name: "Beef fillet (boneless, lean)", preparation: "Raw" },
  F000835: { name: "Beef fillet (boneless, lean)", preparation: "Grilled, no added fat" },
  F006899: { name: "Pork fillet (lean)", preparation: "Raw" },
  F006892: { name: "Pork fillet (fully trimmed)", preparation: "Baked, no added fat" },
  F007827: { name: "Atlantic salmon fillet", preparation: "Raw" },
  F007828: { name: "Atlantic salmon fillet", preparation: "Steamed, no added fat" },
  F003729: { name: "Whole egg", preparation: "Raw, shell removed" },
  F003721: { name: "Whole egg", preparation: "Hard-boiled, shell removed" },
  F003706: { name: "Egg white", preparation: "Raw" },
  F003705: { name: "Egg white", preparation: "Hard-boiled" },
  F005634: { name: "Whole milk", preparation: "Liquid, ~3.5% fat" },
  F005614: { name: "Reduced-fat milk", preparation: "Liquid, ~1% fat" },
  F005637: { name: "Skim milk", preparation: "Liquid, ~0.15% fat" },
  F009694: { name: "Natural yoghurt", preparation: "Regular fat (~3%)" },
  F002414: { name: "Natural cheddar cheese", preparation: "Regular fat" },
  F001905: { name: "Broccoli", preparation: "Fresh, raw" },
  F001900: { name: "Broccoli", preparation: "Fresh, boiled and drained" },
  F002276: { name: "Carrot", preparation: "Mature, peeled, fresh, raw" },
  F002275: { name: "Carrot", preparation: "Mature, peeled, fresh, boiled and drained" },
  F008761: { name: "English spinach", preparation: "Mature, fresh, raw" },
  F008760: { name: "English spinach", preparation: "Mature, fresh, boiled and drained" },
  F009193: { name: "Tomato", preparation: "Common variety, raw" },
  F007320: { name: "Potato", preparation: "Pale skin, peeled, boiled and drained" },
  F007554: { name: "Pumpkin", preparation: "Peeled, fresh, boiled and drained" },
  F000430: { name: "Green beans", preparation: "Fresh, boiled and drained" },
  F006535: { name: "Green peas", preparation: "Fresh, boiled and drained" },
};

const FOOD_SEARCH_ALIASES: Readonly<Record<string, string>> = {
  "chicken breast (skinless, lean)": "鸡胸肉（去皮瘦肉）",
  "beef fillet (boneless, lean)": "牛里脊（去骨瘦肉）",
  "pork fillet (lean)": "猪里脊（瘦肉）",
  "pork fillet (fully trimmed)": "猪里脊（修去可见脂肪）",
  "atlantic salmon fillet": "大西洋三文鱼（鱼柳）",
  "whole egg": "鸡蛋（全蛋）",
  "egg white": "鸡蛋蛋白",
  "whole milk": "全脂牛奶",
  "reduced-fat milk": "低脂牛奶",
  "skim milk": "脱脂牛奶",
  "natural yoghurt": "原味酸奶",
  "natural cheddar cheese": "天然切达奶酪",
  broccoli: "西兰花",
  carrot: "胡萝卜",
  "english spinach": "菠菜",
  tomato: "番茄",
  potato: "土豆",
  pumpkin: "南瓜",
  "green beans": "四季豆",
  "green peas": "青豌豆",
  eggs: "egg",
};

/** Resolve exact visible names for the API while retaining the user's typed input. */
export function resolveFoodSearch(query: string) {
  const key = query.trim().toLowerCase();
  return Object.hasOwn(FOOD_SEARCH_ALIASES, key) ? FOOD_SEARCH_ALIASES[key] : query;
}

export function foodCopy(language: unknown = "en") {
  return FOOD_COPY[normalizeLanguage(language)];
}

export function foodDisplay(food: TrainingFood, language: AppLanguage = "en") {
  if (normalizeLanguage(language) === "zh-CN") {
    return { name: food.name, preparation: food.preparation };
  }
  // A future uncatalogued key may show its official English name; do not guess its state.
  return (Object.hasOwn(ENGLISH_FOOD_LABELS, food.food_key) ? ENGLISH_FOOD_LABELS[food.food_key] : undefined) ?? {
    name: food.source_name.trim() || foodCopy().item,
    preparation: "",
  };
}

export function foodErrorMessage(error: unknown, language: AppLanguage = "en") {
  const copy = foodCopy(language);
  if (error instanceof ApiError) {
    if (error.status === 401) return copy.signInError;
    if (error.status === 403) return copy.permissionError;
    if (error.status === 422) return copy.validationError;
    if (error.status === 503) return copy.unavailableError;
  }
  return copy.loadError;
}
