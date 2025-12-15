// src/config/templates/index.ts

// 1. 导入 JSON 模板文件 (请确保你的 JSON 文件确实在对应的子文件夹中)
import dribbleFrontNarrow from './dribbling/dribble_front_narrow_crossover.json';
import dribbleFrontOneHandHeight from './dribbling/dribble_front_onehand_oneside_height.json';
import dribbleFrontOneHandV from './dribbling/dribble_front_onehand_v.json';
import dribbleSideNarrowCrossover from './dribbling/dribble_side_narrow_crossover.json';
import dribbleSideOneHandOneSide from './dribbling/dribble_side_onehand_oneside.json';
import shootFrontFormClose from './shooting/shoot_front_form_close.json';
import shootSideFormClose from './shooting/shoot_side_form_close.json';

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
  mode: 'shooting' | 'dribbling';
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
// 使用双重断言确保 JSON 数据兼容接口
const rawTemplates = [
  dribbleFrontNarrow,
  dribbleFrontOneHandHeight,
  dribbleFrontOneHandV,
  dribbleSideNarrowCrossover,
  dribbleSideOneHandOneSide,
  shootFrontFormClose,
  shootSideFormClose,
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

export function getAllTemplates(mode?: 'shooting' | 'dribbling'): ActionTemplate[] {
  const all = Object.values(templatesMap);
  if (mode) return all.filter(t => t.mode === mode);
  return all;
}