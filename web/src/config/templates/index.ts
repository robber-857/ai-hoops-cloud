// src/config/templates/index.ts

// 1. 导入 JSON 模板文件
import dribbleFrontNarrow from './dribbling/dribble_front_narrow_crossover.json';
import dribbleFrontOneHandHeight from './dribbling/dribble_front_onehand_oneside_height.json';
import dribbleFrontOneHandV from './dribbling/dribble_front_onehand_v.json';
import dribbleSideNarrowCrossover from './dribbling/dribble_side_narrow_crossover.json';
import dribbleSideOneHandOneSide from './dribbling/dribble_side_onehand_oneside.json';
import shootFrontFormClose from './shooting/shoot_front_form_close.json';
import shootSideFormClose from './shooting/shoot_side_form_close.json';

// [Modified] 更新了 Training 模板的引用文件名
import trainingHighKnees from "./training/high_knees_in_place_side.json";
import trainingPlank from "./training/pushup_hold_high_plank.json";
import trainingWallSit from "./training/wall_sit_half_hold.json";
import trainingWallQuarter from "./training/wall_sit_quarter_hold.json";
import trainingSquat from "./training/deep_squat_reps_side.json";
import trainingJumpingJack from "./training/jumping_jack_reps_front.json";
import trainingLunge from "./training/lunge_same_side_reps_side.json";
import trainingPushup from "./training/pushup_reps_side.json";
import trainingSingleLegStand from "./training/single_leg_stand_front.json";
import trainingJumpRope from "./training/jump_rope_basic_front.json";

// 2. 定义类型接口
export interface MetricRange {
  L: number;
  U: number;
  margin: number;
}

export interface MetricParams {
  target?: number;
  tol?: number;
  margin?: number;
  L?: number;
  U?: number;
  epsFootLen?: number;
  optionKey?: string;
  ranges?: Record<string, MetricRange>;
}

export interface Metric {
  metricId: string;
  displayName?: string;
  category: 'posture' | 'execution' | 'consistency';
  weight: number;
  type: string; 
  computeKey: string;
  params: MetricParams;
  targetText?: string;
  unit?: "deg" | "ratio" | "norm" | "score";
  precision?: number;
  hint_bad?: string;
  hint_good?: string;
  hint_low?: string;
  hint_high?: string;
}

export interface Weights {
  posture: number;
  execution: number;
  consistency: number;
}

export interface ActionTemplate {
  templateId: string;
  version: string;
  contentHash?: string;

  // 建议统一使用 "training" 以匹配你的路由和代码逻辑
  mode: 'shooting' | 'dribbling' | 'training'; 
  camera: 'front' | 'side';
  cameraInstructions?: string;
  displayName: string;
  ageGroups?: string[];
  options?: Record<string, unknown>;
  overallWeights?: Weights; 
  categoryWeights?: Weights;
  rulesNote?: string;
  metrics: Metric[];
}

// 3. 注册所有模板
const rawTemplates = [
  dribbleFrontNarrow,
  dribbleFrontOneHandHeight,
  dribbleFrontOneHandV,
  dribbleSideNarrowCrossover,
  dribbleSideOneHandOneSide,
  shootFrontFormClose,
  shootSideFormClose,
  trainingHighKnees,
  trainingPlank,
  trainingWallSit,
  trainingWallQuarter,
  trainingSquat,
  trainingJumpingJack,
  trainingLunge,
  trainingPushup,
  trainingSingleLegStand,
  trainingJumpRope,
] as unknown as ActionTemplate[];

const FORBIDDEN_TRAINING_COMPUTE_KEYS = new Set([
  "repCount",
  "holdDurationSec",
  "goodFormFrameRatio",
  "cadenceSPM",
  "repTempoSec",
]);

export function validateTrainingTemplate(template: ActionTemplate): string[] {
  const errors: string[] = [];
  if (template.mode !== "training") return errors;
  if (!template.templateId.trim()) errors.push("templateId is required");
  if (!/^v[1-9]\d*$/.test(template.version)) {
    errors.push("version must use the v1, v2, ... format");
  }
  if (!template.displayName.trim()) errors.push("displayName is required");
  if (!template.cameraInstructions?.trim()) errors.push("cameraInstructions is required");

  const metricIds = new Set<string>();
  template.metrics.forEach((metric) => {
    if (!metric.metricId.trim()) errors.push("metricId is required");
    if (metricIds.has(metric.metricId)) errors.push(`duplicate metricId: ${metric.metricId}`);
    metricIds.add(metric.metricId);
    if (!metric.computeKey.trim()) errors.push(`${metric.metricId}: computeKey is required`);
    if (FORBIDDEN_TRAINING_COMPUTE_KEYS.has(metric.computeKey)) {
      errors.push(`${metric.metricId}: forbidden computeKey ${metric.computeKey}`);
    }
    if (!metric.displayName?.trim()) errors.push(`${metric.metricId}: displayName is required`);
    if (!metric.targetText?.trim()) errors.push(`${metric.metricId}: targetText is required`);
    if (!metric.hint_good?.trim()) errors.push(`${metric.metricId}: hint_good is required`);
    if (!metric.hint_low?.trim() && !metric.hint_high?.trim()) {
      errors.push(`${metric.metricId}: hint_low or hint_high is required`);
    }
  });

  if (!template.metrics.some((metric) => metric.category === "posture")) {
    errors.push("at least one posture metric is required");
  }
  if (!template.metrics.some((metric) => metric.category === "execution")) {
    errors.push("at least one execution metric is required");
  }
  return errors;
}

// 建立 ID 映射以便快速查找
const templatesMap: Record<string, ActionTemplate> = {};
rawTemplates.forEach(t => {
  const validationErrors = validateTrainingTemplate(t);
  if (validationErrors.length > 0) {
    throw new Error(`Invalid training template ${t.templateId}: ${validationErrors.join("; ")}`);
  }
  templatesMap[t.templateId] = t;
});

// 4. 导出工具函数
export function getTemplateById(id: string): ActionTemplate | undefined {
  return templatesMap[id];
}

export function parseActionTemplateSnapshot(
  value: unknown,
  fallback: { templateId?: string; version?: string } = {},
): ActionTemplate | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<ActionTemplate>;
  const templateId =
    typeof candidate.templateId === "string" && candidate.templateId.trim()
      ? candidate.templateId
      : fallback.templateId;
  const version =
    typeof candidate.version === "string" && candidate.version.trim()
      ? candidate.version
      : fallback.version;

  if (!templateId || !version) return null;
  if (!candidate.mode || !["shooting", "dribbling", "training"].includes(candidate.mode)) {
    return null;
  }
  if (!candidate.camera || !["front", "side"].includes(candidate.camera)) return null;
  if (typeof candidate.displayName !== "string" || !candidate.displayName.trim()) return null;
  if (!Array.isArray(candidate.metrics) || candidate.metrics.length === 0) return null;

  const metricsAreValid = candidate.metrics.every(
    (metric) =>
      metric &&
      typeof metric.metricId === "string" &&
      typeof metric.computeKey === "string" &&
      ["posture", "execution", "consistency"].includes(metric.category) &&
      typeof metric.type === "string" &&
      metric.params &&
      typeof metric.params === "object",
  );
  if (!metricsAreValid) return null;

  return {
    ...candidate,
    templateId,
    version,
    metrics: candidate.metrics,
  } as ActionTemplate;
}

// [Modified] 更新筛选逻辑
// 如果你 JSON 里写的是 "fitness"，但外面传参是 "training"，这里要做个兼容
export function getAllTemplates(mode?: 'shooting' | 'dribbling' | 'training'): ActionTemplate[] {
  const all = Object.values(templatesMap);
  if (mode) {
    if (mode === 'training') {
      // 同时也返回 mode 为 'fitness' 的模板，兼容刚才 JSON 文件里的写法
      return all.filter(t => t.mode === 'training');
    }
    return all.filter(t => t.mode === mode);
  }
  return all;
}
