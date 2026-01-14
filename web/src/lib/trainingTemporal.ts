// src/lib/trainingTemporal.ts

/**
 * 单帧训练数据结构
 * 存储某一时刻的所有计算出的原始指标（如膝盖角度、躯干前倾角等）
 */
export interface TrainingFrame {
  time: number; // 时间戳 (秒)
  // 存储该帧所有计算出的原始值，key 与 angles2d.ts 或 Pose2DCanvas 计算的一致
  // 例如: { "kneeAngle": 90, "trunkLean": 5, "hipHeight": 0.5 }
  metrics: Record<string, number>; 
}

/**
 * 简单的低通滤波器 (Low Pass Filter)
 * 用于平滑数据，去除 MediaPipe 的高频抖动，让评分更稳定
 */
export function smoothSeries(data: number[], alpha: number = 0.3): number[] {
  if (data.length === 0) return [];
  const smoothed = [data[0]];
  for (let i = 1; i < data.length; i++) {
    const prev = smoothed[i - 1];
    const curr = data[i];
    // alpha 越小越平滑，但也越滞后
    smoothed.push(prev + alpha * (curr - prev));
  }
  return smoothed;
}

/**
 * 简单的波峰/波谷检测，用于数动作次数 (Reps)
 * @param series 时间序列数据
 * @param type 'min' (找波谷，如深蹲最低点) | 'max' (找波峰，如高抬腿最高点)
 * @param threshold 触发计数的阈值 (如深蹲必须低于 100度)
 * @param minDistance 两个动作之间的最小间隔帧数 (防止抖动导致重复计数)
 */
export function detectRepetitions(
  series: number[], 
  type: 'min' | 'max', 
  threshold: number, 
  minDistance: number = 15
): number[] {
  const indices: number[] = [];
  let lastIndex = -minDistance;

  for (let i = 1; i < series.length - 1; i++) {
    const prev = series[i - 1];
    const curr = series[i];
    const next = series[i + 1];

    if (type === 'min') {
      // 找局部最小值 (V字底)
      if (curr < prev && curr < next && curr < threshold) {
        if (i - lastIndex >= minDistance) {
          indices.push(i);
          lastIndex = i;
        }
      }
    } else {
      // 找局部最大值 (A字顶)
      if (curr > prev && curr > next && curr > threshold) {
        if (i - lastIndex >= minDistance) {
          indices.push(i);
          lastIndex = i;
        }
      }
    }
  }
  return indices;
}

/**
 * 计算标准差 (Standard Deviation)
 * 用于评估“稳定性”
 */
export function calculateStdDev(data: number[]): number {
  if (data.length < 2) return 0;
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const variance = data.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (data.length - 1);
  return Math.sqrt(variance);
}

/**
 * 计算变异系数 (CV)
 * 用于评估节奏稳定性 (数值越小越稳)
 */
export function calculateCV(data: number[]): number {
  if (data.length === 0) return 0;
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  if (mean === 0) return 0;
  const std = calculateStdDev(data);
  return std / mean;
}