// src/lib/trainingCalculator.ts

import { ActionTemplate } from "@/config/templates";
import { DribbleFrame } from "./dribbleTemporal"; 
import { 
  smoothSeries, 
  calculateStdDev, 
  detectRepetitions,
  calculateCV 
} from "./trainingTemporal";

// --- 1. 基础数学工具 ---
function calcAngle(a: {x:number, y:number}, b: {x:number, y:number}, c: {x:number, y:number}): number {
  const rad = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let deg = Math.abs(rad * 180.0 / Math.PI);
  if (deg > 180.0) deg = 360 - deg;
  return deg;
}

function calcVertAngle(top: {x:number, y:number}, bottom: {x:number, y:number}): number {
  const dx = top.x - bottom.x;
  const dy = top.y - bottom.y;
  return (Math.atan2(Math.abs(dx), Math.abs(dy)) * 180) / Math.PI;
}

function dist(a: {x:number, y:number}, b: {x:number, y:number}): number {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function average(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

// 核心特征流数据结构
interface StreamData {
  t: number;
  kneeAngle: number;
  hipAngle: number;
  elbowAngle: number;
  trunkLean: number;
  kneeOverToeOffset: number;
  hipBelowKneeRatio: number;
  shoulderWristOffset: number;
  footStrikeOffset: number;
  kneeToHipHeightRatio: number;
  ankleY: number;
}

export type ComputedResult = Record<string, number | undefined>;

/**
 * 全量聚合函数：一次性计算所有训练模板所需的指标包
 * 解决切换模板时 Data Missing 的根本原因：让 saved_metrics 包含全量 Key
 */
export function aggregateTrainingSequence(
  frames: DribbleFrame[], 
  template: ActionTemplate 
): ComputedResult {
  if (!frames || frames.length === 0) return {};

  const result: ComputedResult = {};
  
  // --- 第一步：构建全量特征流 ---
  const stream: StreamData[] = frames.map(f => {
    const isLeftVisible = (f.lk?.visibility ?? 0) > (f.rk?.visibility ?? 0);
    const k = isLeftVisible ? (f.lk || f.rk) : (f.rk || f.lk);
    const h = isLeftVisible ? (f.lh || f.rh) : (f.rh || f.lh);
    const a = isLeftVisible ? (f.la || f.ra) : (f.ra || f.la);
    const s = isLeftVisible ? (f.ls || f.rs) : (f.rs || f.ls);
    const e = isLeftVisible ? (f.le || f.re) : (f.re || f.le);
    const w = isLeftVisible ? (f.lw || f.rw) : (f.rw || f.lw);
    const toe = isLeftVisible ? (f.lf || f.rf) : (f.rf || f.lf);

    if (!k || !h || !a || !s || !e || !w || !toe) {
        return { t: f.t, kneeAngle: 0, hipAngle: 0, elbowAngle: 0, trunkLean: 0, kneeOverToeOffset: 0, hipBelowKneeRatio: 0, shoulderWristOffset: 0, footStrikeOffset: 0, kneeToHipHeightRatio: 0, ankleY: 0 };
    }

    const dir = (toe.x > a.x) ? 1 : -1;
    const shankLen = dist(k, a) || 1;
    const thighLen = dist(h, k) || 1;
    const torsoLen = dist(s, h) || 1;
    const legLen = Math.abs(a.y - h.y) || 1;

    return {
      t: f.t,
      kneeAngle: calcAngle(h, k, a),
      hipAngle: calcAngle(s, h, a), 
      elbowAngle: calcAngle(s, e, w),
      trunkLean: calcVertAngle(s, h),
      kneeOverToeOffset: ((k.x - toe.x) * dir) / shankLen,
      hipBelowKneeRatio: (h.y - k.y) / thighLen,
      shoulderWristOffset: (s.x - w.x) / torsoLen, 
      footStrikeOffset: ((a.x - h.x) * dir) / shankLen,
      // 修正高抬腿逻辑：越高值越大 (0-1)
      kneeToHipHeightRatio: 1 - (Math.abs(a.y - k.y) / legLen),
      ankleY: a.y
    };
  });

  // --- 第二步：静态/通用指标全量产出 ---
  const kneeAngles = stream.map(s => s.kneeAngle);
  result["avgKneeAngleDeg"] = average(kneeAngles);
  result["stdKneeAngleDeg"] = calculateStdDev(kneeAngles);

  const trunkLeans = stream.map(s => s.trunkLean);
  const mLean = median(trunkLeans);
  result["trunkLeanDegSide"] = mLean;
  result["torsoLeanDegSide"] = mLean;

  const bodyLines = stream.map(s => s.hipAngle);
  result["plankBodyLineDeg"] = median(bodyLines);
  result["stdPlankBodyLineDeg"] = calculateStdDev(bodyLines);

  const swOffsets = stream.map(s => s.shoulderWristOffset);
  result["shoulderOverWristOffsetX"] = average(swOffsets);
  
  const elbowAngles = stream.map(s => s.elbowAngle);
  result["avgElbowAngleDeg"] = average(elbowAngles);

  // 全局平均，如有 rep 会被底部采样覆盖
  result["kneeOverToeOffsetXSide"] = average(stream.map(s => s.kneeOverToeOffset));

  // --- 第三步：动作识别 (Reps) ---
  const squatReps = detectRepetitions(smoothSeries(stream.map(s => s.kneeAngle)), 'min', 140, 25);
  const hkReps = detectRepetitions(smoothSeries(stream.map(s => s.kneeToHipHeightRatio)), 'max', 0.5, 8);

  // --- 第四步：基于 Reps 的动态指标 ---
  if (squatReps.length > 0) {
    result["hipBelowKneeRatioSide"] = average(squatReps.map(i => stream[i].hipBelowKneeRatio));
    result["stdHipBelowKneeRatioSidePerRep"] = calculateStdDev(squatReps.map(i => stream[i].hipBelowKneeRatio));
    result["stdTrunkLeanDegSidePerRep"] = calculateStdDev(squatReps.map(i => stream[i].trunkLean));
    // 修正口径：深蹲取底部膝盖位置
    result["kneeOverToeOffsetXSide"] = average(squatReps.map(i => stream[i].kneeOverToeOffset)); 

    if (squatReps.length > 1) {
      const intervals = squatReps.slice(1).map((idx, i) => stream[idx].t - stream[squatReps[i]].t);
      result["repTempoSec"] = average(intervals);
      const tops: number[] = [];
      for(let i=0; i<squatReps.length-1; i++) {
        let maxA = -1;
        for(let j=squatReps[i]; j<squatReps[i+1]; j++) if(stream[j].kneeAngle > maxA) maxA = stream[j].kneeAngle;
        if(maxA > 0) tops.push(maxA);
      }
      if(tops.length > 0) result["topKneeAngleDeg"] = median(tops);
    }
  }

  if (hkReps.length > 0) {
    result["kneeToHipHeightRatioSide"] = median(hkReps.map(i => stream[i].kneeToHipHeightRatio));
    result["stdKneeToHipHeightRatioSide"] = calculateStdDev(hkReps.map(i => stream[i].kneeToHipHeightRatio));
    const landings = detectRepetitions(smoothSeries(stream.map(s => s.ankleY)), 'max', 0.75, 5);
    if (landings.length > 0) result["footStrikeOffsetXUnderHip"] = median(landings.map(i => stream[i].footStrikeOffset));

    if (hkReps.length > 1) {
      const intervals = hkReps.slice(1).map((idx, i) => stream[idx].t - stream[hkReps[i]].t);
      result["cadenceSPM"] = 60 / average(intervals);
      result["stepIntervalCV"] = calculateCV(intervals);
    }
  }

  result["repCount"] = Math.max(squatReps.length, hkReps.length);

  // --- 第五步：有效时长逻辑 (针对上传时的初始模板判定) ---
  const totalDur = stream.length > 1 ? stream[stream.length-1].t - stream[0].t : 0;
  let goodTime = 0;
  const primaryPostureMetric = template.metrics.filter(m => m.category === 'posture').sort((a, b) => b.weight - a.weight)[0];

  if (primaryPostureMetric) {
    const keyMap: Record<string, keyof StreamData> = { 'plankBodyLineDeg': 'hipAngle', 'avgKneeAngleDeg': 'kneeAngle', 'trunkLeanDegSide': 'trunkLean', 'torsoLeanDegSide': 'trunkLean' };
    const sKey = keyMap[primaryPostureMetric.computeKey] || (primaryPostureMetric.computeKey as keyof StreamData);
    
    for (let i = 0; i < stream.length - 1; i++) {
        const val = stream[i][sKey];
        if (typeof val === 'number') {
            const target = primaryPostureMetric.params.target ?? 0;
            const tol = (primaryPostureMetric.params.tol ?? 15) * 1.5;
            if (Math.abs(val - target) <= tol) goodTime += (stream[i+1].t - stream[i].t);
        }
    }
  }
  result["holdDurationSec"] = goodTime;
  result["goodFormFrameRatio"] = totalDur > 0 ? goodTime / totalDur : 0;

  // 清理 NaN 值防止 DB 报错
  Object.keys(result).forEach(k => {
    if (typeof result[k] === 'number' && !Number.isFinite(result[k])) delete result[k];
  });

  return result;
}