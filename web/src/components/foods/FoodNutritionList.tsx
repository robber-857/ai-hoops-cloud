"use client";

import { useEffect, useState } from "react";
import { foodService, type FoodCategory, type TrainingFoodPage } from "@/services/foods";
import { FoodNutrientCard, FoodSourceNote } from "./FoodNutritionParts";

const button = "inline-flex min-h-11 items-center justify-center rounded-lg border border-white/25 px-4 py-2 text-sm font-semibold hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#d8ff5d] disabled:opacity-40";
const categories: { key: FoodCategory | ""; name: string }[] = [
  { key: "", name: "全部" },
  { key: "meat", name: "肉类" },
  { key: "eggs", name: "蛋类" },
  { key: "dairy", name: "奶类" },
  { key: "vegetables", name: "蔬菜" },
];

export function FoodNutritionList() {
  const [category, setCategory] = useState<FoodCategory | "">("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<TrainingFoodPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    foodService.list(category, query, offset)
      .then((result) => { if (active) setData(result); })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "食材数据暂时无法加载。");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [category, query, offset, retry]);

  return (
    <div className="w-full min-w-0 max-w-5xl">
      <h1 className="text-3xl font-semibold">食材营养</h1>
      <p className="mt-3 max-w-2xl leading-relaxed text-white/70">
        查看常见肉、蛋、奶和蔬菜的营养成分，帮助了解食材。
        所有数值按每 100 g 可食部分计算；牛奶也按重量 100 g，不是 100 mL。
      </p>
      <p className="mt-2 text-sm text-white/60">碳水为可利用碳水化合物，不含糖醇。表格提供食材参考信息，不代表个人食用量。</p>
      <form className="mt-6 flex flex-wrap gap-2" onSubmit={(event) => {
        event.preventDefault();
        setQuery(search.trim());
        setOffset(0);
      }}>
        <label className="sr-only" htmlFor="food-search">搜索食材名称或状态</label>
        <input id="food-search" type="search" maxLength={200} value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜索食材，如鸡蛋、牛奶、西兰花"
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/25 bg-[#10141b] px-3 text-base text-white focus:outline-2 focus:outline-[#d8ff5d]" />
        <button className={button} type="submit">搜索</button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="食材分类">
        {categories.map((item) => (
          <button key={item.key} type="button" aria-pressed={category === item.key}
            className={`${button} ${category === item.key ? "border-[#d8ff5d] bg-[#d8ff5d]/15 text-[#d8ff5d]" : "text-white/75"}`}
            onClick={() => { setCategory(item.key); setOffset(0); }}>
            {item.name}
          </button>
        ))}
      </div>
      {error && (
        <div role="alert" className="mt-6 rounded-lg border border-red-300/40 p-4 text-red-100">
          <p className="break-words">{error}</p>
          <button className={`${button} mt-3`} type="button" onClick={() => setRetry((value) => value + 1)}>重新加载</button>
        </div>
      )}
      {loading ? (
        <p role="status" className="py-10 text-white/70">正在加载食材…</p>
      ) : !error && data ? (
        <>
          {data.data_status === "source_unavailable" ? (
            <p role="status" className="mt-6 rounded-lg border border-white/20 p-5 text-white/70">
              {data.expected_release} 正式食材数据尚未准备好，请稍后查看。
            </p>
          ) : (
            <>
              {data.data_status === "partial_catalog" && (
                <p role="status" className="mt-5 text-sm text-amber-100">部分食材暂不可用，以下显示已准备好的条目。</p>
              )}
              {data.items.length ? (
                <>
                  <p className="mt-5 text-sm text-white/60" role="status">共 {data.total} 条匹配食材 · 每 100 g</p>
                  <ul className="mt-3 grid gap-4 md:grid-cols-2">
                    {data.items.map((food) => (
                      <li className="min-w-0" key={`${food.release_id}:${food.food_key}`}><FoodNutrientCard food={food} /></li>
                    ))}
                  </ul>
                </>
              ) : (
                <p role="status" className="py-10 text-white/70">没有匹配的食材，试试其他名称或分类。</p>
              )}
              {(offset > 0 || data.has_more) && (
                <div className="mt-5 flex flex-wrap gap-3">
                  <button type="button" className={button} disabled={offset === 0} onClick={() => setOffset((value) => Math.max(0, value - 20))}>上一页</button>
                  <button type="button" className={button} disabled={!data.has_more} onClick={() => setOffset((value) => value + 20)}>下一页</button>
                </div>
              )}
            </>
          )}
          <FoodSourceNote source={data.source} notice={data.data_notice} />
        </>
      ) : null}
    </div>
  );
}
