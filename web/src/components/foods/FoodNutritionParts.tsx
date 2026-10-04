import type { FoodSource, TrainingFood } from "@/services/foods";

export function FoodNutrientCard({ food }: { food: TrainingFood }) {
  const nutrients = [
    ["碳水化合物", food.carbohydrate_g],
    ["蛋白质", food.protein_g],
    ["脂肪", food.fat_g],
  ];
  return (
    <article className="min-w-0 rounded-xl border border-white/15 bg-white/[0.025] p-4 sm:p-5">
      <h2 className="break-words text-lg font-semibold">{food.name}</h2>
      <p className="mt-1 break-words text-sm text-white/65">{food.preparation}</p>
      <p className="mt-4 text-xs text-white/55">每 100 g 可食部分</p>
      <dl className="mt-2 grid grid-cols-3 gap-2 border-t border-white/10 pt-3">
        {nutrients.map(([label, value]) => (
          <div className="min-w-0" key={label}>
            <dt className="text-xs text-white/70">{label}</dt>
            <dd className="mt-2 break-words font-semibold tabular-nums sm:text-lg">
              {value === null ? "暂无数据" : `${value} g`}
            </dd>
          </div>
        ))}
      </dl>
      <details className="mt-4 text-xs text-white/60">
        <summary className="cursor-pointer py-2 focus-visible:outline-2 focus-visible:outline-[#d8ff5d]">
          AFCD 原始食品名称
        </summary>
        <p className="break-words py-1 leading-relaxed" lang="en">{food.source_name}</p>
      </details>
    </article>
  );
}

export function FoodSourceNote({ source, notice }: { source: FoodSource | null; notice: string }) {
  return (
    <footer className="mt-8 space-y-3 border-t border-white/15 pt-5 text-sm leading-relaxed text-white/60">
      {source && (
        <>
          <p>{source.attribution}</p>
          <p>
            <a className="underline underline-offset-4 hover:text-white" href={source.source_page} target="_blank" rel="noreferrer">
              AFCD 官方数据文件
            </a>
            {" · "}
            <a className="underline underline-offset-4 hover:text-white" href={source.licence_url} target="_blank" rel="noreferrer">
              数据使用许可
            </a>
          </p>
          <p>食品显示名称与状态由英文翻译为中文，营养数值保留 AFCD 原值。</p>
        </>
      )}
      <p>营养数据是样本参考值，可能因批次、品牌、季节及加工方式而变化；以澳大利亚食品数据为基础，其他国家的食品可能不适用。</p>
      {notice && <p lang="en" className="text-xs">{notice}</p>}
    </footer>
  );
}
