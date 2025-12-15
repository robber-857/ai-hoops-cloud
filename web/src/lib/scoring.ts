import { ActionTemplate, Weights, Metric } from "@/config/templates/index";
// 引入全局配置 (确保路径正确，Next.js 支持导入 JSON)
import globalConfig from "@/config/templates/global.json";

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface Finding {
  id: string;
  title: string;
  score: number;
  isPositive: boolean;
  hint: string;
  category: 'posture' | 'execution' | 'consistency';
}

export interface ScoreResult {
  overall: number;
  grade: Grade;
  weights: Weights;
  breakdown: {
    posture: number;
    execution: number;
    consistency: number;
  };
  findings: Finding[];
}

export type AngleData = { name: string; value: number; unit?: string };

// 颜色映射
export function getGradeColor(grade: Grade): string {
  switch (grade) {
    case 'S': return "text-purple-400";
    case 'A': return "text-blue-400";
    case 'B': return "text-emerald-400";
    case 'C': return "text-yellow-400";
    case 'D': return "text-orange-400";
    default: return "text-red-400";
  }
}

// 辅助：获取年龄放宽系数
function getAgeToleranceMultiplier(ageGroup: string): number {
  // 断言类型以读取 JSON
  const scaleMap = globalConfig.ageToleranceScale as Record<string, number>;
  return scaleMap[ageGroup] || 1.0; // 默认不放宽 (1.0)
}

// --- [核心] 真实评分算法 ---
export function calculateRealScore(
  template: ActionTemplate, 
  currentAngles: AngleData[], 
  options: Record<string, unknown> = {}
): ScoreResult {
  
  // 1. 获取年龄系数
  // 优先从 options 读，没有则默认 "16-18" (最严)
  const ageGroup = (options.ageGroup as string) || "16-18"; 
  const multiplier = getAgeToleranceMultiplier(ageGroup);
  
  // 开启一个折叠的日志组，方便调试但不刷屏
  console.groupCollapsed(`📊 Scoring Analysis [Age: ${ageGroup}, Tolerance: ${multiplier}x]`);

  let totalScore = 0;
  let totalWeight = 0;
  
  const categoryScores = {
    posture: { score: 0, weight: 0 },
    execution: { score: 0, weight: 0 },
    consistency: { score: 0, weight: 0 },
  };

  const findings: Finding[] = [];

  template.metrics.forEach((metric: Metric) => {
    // 2. 查找数据 
    //遍历模板里的每个 metric，
    //按“去下划线/空格并小写”的规则把 metric.computeKey 规范化为 targetKey
    const targetKey = metric.computeKey.toLowerCase().replace(/_/g, '').replace(/\s/g, '');
    
    const matchedData = currentAngles.find(a => {
      const dataKey = a.name.toLowerCase().replace(/_/g, '').replace(/\s/g, '');
      // [修复] 必须全等，防止 'wristHeight' 匹配到 'stdWristHeight'
      return dataKey === targetKey;
    });

    if (!matchedData) {
      console.warn(`⚠️ Data Missing: ${metric.computeKey}`);
      return;
    }

    const val = matchedData.value;
    let itemScore = 0;

    // [动态缩放] 根据年龄放宽 Tol 和 Margin
    const relax = (v?: number) => v ? v * multiplier : v;

    // --- 核心打分逻辑 (尖峰模型) ---

    if (metric.type === 'boolean') {
      const target = metric.params.target ?? 1;
      itemScore = (Math.round(val) === target) ? 100 : 0;
    } 
    
    else if (metric.type === 'rangeByOption') {
      const optKey = metric.params.optionKey || 'handedness';
      const currentOpt = (options[optKey] as string) || (template.options?.[optKey] as string) || 'right';
      // 明确声明 ranges 配置的结构，避免使用 any
      type RangeConfig = { L: number; U: number; margin?: number };
      const rangesMap = metric.params?.ranges as Record<string, RangeConfig> | undefined;
      const config = rangesMap ? rangesMap[currentOpt] : undefined;
      if (config) {
        const { L, U } = config;
        const margin = relax(config.margin || 0.1)!;
        
        // Range 类型：区间内 100 分 (区间通常是物理限制，暂不应用尖峰扣分，保持区间内满分)
        if (val >= L && val <= U) {
          itemScore = 100;
        } else if (val < L) {
          itemScore = Math.max(0, 100 - ((L - val) / margin) * 100);
        } else {
          itemScore = Math.max(0, 100 - ((val - U) / margin) * 100);
        }
        console.log(`📉 Rangebyoption Deduction [${metric.metricId}]: Val ${val.toFixed(2)} outside [${L}, ${U}] -> Score=${itemScore.toFixed(1)}`);
        
      }
    }
    
    else if (metric.type === 'target') {
      const target = metric.params.target || 0;
      const tol = relax(metric.params.tol || 5)!;
      const margin = relax(metric.params.margin || 15)!;
      const diff = Math.abs(val - target);

      // [尖峰模型实现]
      // 阶段 1: 在容忍度 (Tol) 范围内，分数从 100 线性降到 90 (S级底线)
      // 这样保证了“越准分越高”，杜绝了“很容易满分”
      if (diff <= tol) {
        // diff=0 -> 100分; diff=tol -> 90分
        const penalty = (diff / tol) * 10; 
        itemScore = 100 - penalty;
      } 
      // 阶段 2: 超出容忍度，分数从 90 线性降到 0
      else {
        const extraDiff = diff - tol;
        if (extraDiff > margin) {
          itemScore = 0;
        } else {
          // extra=0 -> 90分; extra=margin -> 0分
          const penalty = (extraDiff / margin) * 90;
          itemScore = 90 - penalty;
        }
      }
      
        console.log(`❌ Target Low Score [${metric.metricId}]: Val=${val.toFixed(4)} Target=${target} Diff=${diff.toFixed(4)} (Tol=${tol.toFixed(4)}, Margin=${margin.toFixed(4)}) -> Score=${itemScore.toFixed(1)}`);


    } 
    
    else if (metric.type === 'range') {
      const L = metric.params.L || 0;
      const U = metric.params.U || 180;
      const margin = relax(metric.params.margin || 15)!;

      if (val >= L && val <= U) itemScore = 100;
      else if (val < L) itemScore = Math.max(0, 100 - ((L - val) / margin) * 100);
      else itemScore = Math.max(0, 100 - ((val - U) / margin) * 100);

      console.log(` Range Deduction [${metric.metricId}]: Val ${val.toFixed(2)} outside [${L}, ${U}] -> Score=${itemScore.toFixed(1)}`);
    }

    // --- 生成 Findings ---
    const displayTitle = metric.metricId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    if (itemScore < 75) {
      findings.push({
        id: metric.metricId,
        title: displayTitle,
        score: Math.round(itemScore),
        isPositive: false,
        hint: metric.hint_bad,
        category: metric.category
      });
    } 
    else if (itemScore >= 75 && itemScore < 90) {
       findings.push({
        id: metric.metricId,
        title: displayTitle,
        score: Math.round(itemScore),
        isPositive: true,
        hint: metric.hint_good || "Improve the details of the movements to get a better score..",
        category: metric.category
      });
    }
    else if (itemScore > 90) {
       findings.push({
        id: metric.metricId,
        title: displayTitle,
        score: Math.round(itemScore),
        isPositive: true,
        hint: metric.hint_good || "Good form maintained.",
        category: metric.category
      });
    }

    // --- 权重累加 ---
    const weight = metric.weight || 1;
    if (categoryScores[metric.category]) {
      categoryScores[metric.category].score += itemScore * weight;
      categoryScores[metric.category].weight += weight;
    }
    totalScore += itemScore * weight;
    totalWeight += weight;
  });

  const finalBreakdown = {
    posture: categoryScores.posture.weight ? (categoryScores.posture.score / categoryScores.posture.weight) : 0,
    execution: categoryScores.execution.weight ? (categoryScores.execution.score / categoryScores.execution.weight) : 0,
    consistency: categoryScores.consistency.weight ? (categoryScores.consistency.score / categoryScores.consistency.weight) : 0,
  };

  const finalOverall = totalWeight ? (totalScore / totalWeight) : 0;

  let grade: Grade = 'F';
  if (finalOverall >= 90) grade = 'S';
  else if (finalOverall >= 85) grade = 'A';
  else if (finalOverall >= 75) grade = 'B';
  else if (finalOverall >= 60) grade = 'C';
  else if (finalOverall >= 50) grade = 'D';

  console.groupEnd(); // 结束日志组

  return {
    overall: finalOverall,
    grade: grade,
    weights: template.overallWeights || { posture: 0.4, execution: 0.4, consistency: 0.2 },
    breakdown: finalBreakdown,
    findings: findings.slice(0, 8)
  };
}