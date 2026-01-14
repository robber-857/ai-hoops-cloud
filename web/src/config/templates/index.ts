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
  category: 'posture' | 'execution' | 'consistency';
  weight: number;
  type: string; 
  computeKey: string;
  params: MetricParams;
  hint_bad: string;
  hint_good?: string;
}

export interface Weights {
  posture: number;
  execution: number;
  consistency: number;
}

export interface ActionTemplate {
  templateId: string;

  // 建议统一使用 "training" 以匹配你的路由和代码逻辑
  mode: 'shooting' | 'dribbling' | 'training'; 
  camera: 'front' | 'side';
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
  trainingSquat
] as unknown as ActionTemplate[];

// 建立 ID 映射以便快速查找
const templatesMap: Record<string, ActionTemplate> = {};
rawTemplates.forEach(t => {
  templatesMap[t.templateId] = t;
});

// 4. 导出工具函数
export function getTemplateById(id: string): ActionTemplate | undefined {
  return templatesMap[id];
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