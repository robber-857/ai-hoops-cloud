/**
 * Dribble Temporal Analysis (Universal Version)
 * 适用于：正面/侧面，V运球/低运球/高运球
 * 核心逻辑：基于 MediaPipe 原始坐标，利用 Y 轴律动和可见性进行周期切分
 */

// --- 1. 类型定义 ---

// MediaPipe 关键点索引
const IDX = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_ELBOW: 13, // [New]
  RIGHT_ELBOW: 14, // [New]
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,    // ← 添加
  RIGHT_KNEE: 26,   // ← 添加
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
};

// 基础点位 (对应 NormalizedLandmark)
export interface RawPoint {
  x: number;
  y: number;
  z: number;
  visibility?: number; // MediaPipe 提供的可见性置信度
}

// 提取后的特征帧 (每一帧的关键数据)
export interface DribbleFrame {
  t: number;            // 时间戳 (秒)
  
  // 关键点 (直接引用，方便后续计算)
  la: RawPoint;         // Left Ankle
  ra: RawPoint;         // Right Ankle
  lw: RawPoint;         // Left Wrist
  rw: RawPoint;         // Right Wrist
  le: RawPoint;         // Left Elbow [New]
  re: RawPoint;         // Right Elbow [New]
  ls: RawPoint;         // Left Shoulder
  rs: RawPoint;         // Right Shoulder
  lk: RawPoint;         // Left Knee
  rk: RawPoint;         // Right Knee
  lh: RawPoint;         // Left Hip
  rh: RawPoint;         // Right Hip
  lf: RawPoint;         // Left Foot Index
  rf: RawPoint;         // Right Foot Index
  
  // 参考尺度 (每一帧都要算，因为人可能会前后移动)
  trunkHeight: number;  // 躯干高度 (肩中点到髋中点)，侧面/正面都稳定
  shoulderWidth: number;// 肩宽 (仅正面有效，侧面时会很小)
  
  // 视图判断
  isSideView: boolean;  // 根据肩宽/躯干高比率判断
}

// 周期定义
export interface DribbleCycle {
  startFrame: number;   // 周期开始 (球在最高点/手刚开始下压)
  contactFrame: number; // 触底/最发力点 (Y轴最低点)
  endFrame: number;     // 周期结束 (球回弹到最高点)
  duration: number;     // 持续时间 (秒)
}

// --- 2. 核心函数 ---

/**
 * 步骤一：单帧特征提取
 * 能够自动处理正面/侧面归一化问题
 */
export function extractDribbleFrame(
  landmarks: RawPoint[],
  timestampSec: number
): DribbleFrame {
  const get = (i: number) => landmarks[i];

  // 1. 计算躯干高度 (Trunk Height) - 这是最稳定的“标尺”
  // 无论侧面还是正面，脊柱长度变化不大
  const midShoulderY = (get(IDX.LEFT_SHOULDER).y + get(IDX.RIGHT_SHOULDER).y) / 2;
  const midHipY = (get(IDX.LEFT_HIP).y + get(IDX.RIGHT_HIP).y) / 2;
  const trunkHeight = Math.abs(midHipY - midShoulderY) || 0.1; // 防止除0

  // 2. 计算肩宽
  const shoulderWidth = Math.abs(get(IDX.LEFT_SHOULDER).x - get(IDX.RIGHT_SHOULDER).x);

  // 3. 简单的视图判断
  // 如果肩宽 < 躯干高度的 40%，大概率是侧身 (Side View)
  const isSideView = shoulderWidth < (trunkHeight * 0.4);

  return {
    t: timestampSec,
    la: get(IDX.LEFT_ANKLE),
    ra: get(IDX.RIGHT_ANKLE),
    lw: get(IDX.LEFT_WRIST),
    rw: get(IDX.RIGHT_WRIST),
    le: get(IDX.LEFT_ELBOW), // [New] 提取左肘
    re: get(IDX.RIGHT_ELBOW), // [New] 提取右肘
    lk: get(IDX.LEFT_KNEE),
    rk: get(IDX.RIGHT_KNEE),
    ls: get(IDX.LEFT_SHOULDER),
    rs: get(IDX.RIGHT_SHOULDER),
    lh: get(IDX.LEFT_HIP),
    rh: get(IDX.RIGHT_HIP),
    lf: get(IDX.LEFT_FOOT_INDEX),
    rf: get(IDX.RIGHT_FOOT_INDEX),
    trunkHeight,
    shoulderWidth: shoulderWidth || (trunkHeight * 0.5), // 侧面时的兜底
    isSideView
  };
}

/**
 * 步骤二：自动判断运球手 (Handedness)
 * 兼容侧面视图 (自动忽略被挡住的手)
 */
export function inferHandedness(
  frames: DribbleFrame[]
): "left" | "right" {
  if (frames.length < 5) return "right"; // 数据太少兜底

  let leftScore = 0;
  let rightScore = 0;

  for (let i = 1; i < frames.length; i++) {
    const curr = frames[i];
    const prev = frames[i-1];

    // 1. 可见性权重 (Visibility Weight)
    // 如果是侧面，挡住的那只手 visibility 会很低 (通常 < 0.5)
    // 我们只累加“可见”的手的动能
    const lwVis = curr.lw.visibility ?? 1;
    const rwVis = curr.rw.visibility ?? 1;

    // 2. 垂直动能 (Vertical Energy)
    // 运球主要是上下动，累加 Y 轴的变化量
    if (lwVis > 0.6) {
      leftScore += Math.abs(curr.lw.y - prev.lw.y);
    }
    if (rwVis > 0.6) {
      rightScore += Math.abs(curr.rw.y - prev.rw.y);
    }
  }

  // 谁动得多，谁就是运球手
  return leftScore > rightScore ? "left" : "right";
}

/**
 * 步骤三：通用周期切分 (Universal Cycle Segmentation)
 * 不关心运球轨迹 (V/Pound/Behind)，只关心手腕的垂直律动
 */
export function segmentDribbleCycles(
  frames: DribbleFrame[],
  hand: "left" | "right",
  fpsGuess = 30
): { cycles: DribbleCycle[]; contacts: number[] } {
  if (frames.length < 10) return { cycles: [], contacts: [] };

  // 1. 提取目标手腕的 Y 序列
  // MediaPipe Y: 0(头) -> 1(脚)。值越大越靠近地面。
  const rawY = frames.map(f => (hand === "left" ? f.lw.y : f.rw.y));

  // 2. 平滑处理 (Smoothing) - 关键！
  // MediaPipe 的手腕关键点会有高频抖动，不平滑会产生很多假周期
  const y = smoothArray(rawY, 3);

  // 3. 寻找局部最大值 (Local Maxima) => 也就是物理最低点 (Contact)
  // 阈值设定：
  // minGap: 两个运球之间至少间隔 0.15秒 (对于快速运球这也够了)
  const minGapFrames = Math.floor(fpsGuess * 0.15); 
  const contacts: number[] = [];
  let lastContactIdx = -999;

  for (let i = 2; i < y.length - 2; i++) {
    const val = y[i];
    // 峰值判定：比左右两边都大 (即位置更低)
    if (val > y[i-1] && val > y[i-2] && val >= y[i+1] && val >= y[i+2]) {
      
      // 过滤太近的杂波
      if (i - lastContactIdx > minGapFrames) {
        // 额外的幅度过滤：
        // 只有当这个“低点”比肩膀明显低的时候才算 (防止把举手时的抖动算进去)
        const shoulderY = hand === 'left' ? frames[i].ls.y : frames[i].rs.y;
        if (val > shoulderY + 0.1) { // 至少比肩膀低 0.1 (归一化坐标)
             contacts.push(i);
             lastContactIdx = i;
        }
      }
    }
  }

  // 4. 构建周期 (Cycles)
  const cycles: DribbleCycle[] = [];
  
  // 策略：以 Contact 为锚点，向左向右找“最高点”(Y最小) 作为 Start/End
  for (let k = 0; k < contacts.length - 1; k++) {
    const currC = contacts[k];
    const nextC = contacts[k+1];
    
    // 如果间隔太大 (>1.5秒)，说明断了/捡球，不连线
    if (nextC - currC > fpsGuess * 1.5) continue;

    // 简单策略：两个 Contact 中间那个“Y最小”的点就是分界线
    // 这种方法比求导数更鲁棒
    let highestIdx = currC;
    let minVal = 999;
    
    // 在两个触底之间找最高点
    for (let j = currC; j < nextC; j++) {
      if (y[j] < minVal) {
        minVal = y[j];
        highestIdx = j;
      }
    }

    // Cycle N: [Start(High) -> Contact(Low) -> End(High)]
    // 我们把 highestIdx 当作 上一个周期的End 和 下一个周期的Start
    if (cycles.length > 0) {
      cycles[cycles.length - 1].endFrame = highestIdx;
    }
    
    // 开启新周期 (注意：第一个周期可能没有完美的 Start，先用 Contact 前推代替)
    const startIdx = cycles.length === 0 ? Math.max(0, currC - 5) : highestIdx;
    
    cycles.push({
      startFrame: startIdx,
      contactFrame: currC,
      endFrame: nextC, // 暂定，下轮循环会修正
      duration: (frames[nextC].t - frames[startIdx].t)
    });
  }
  
  // 修正最后一个周期的 End (设为 下一个触底前的最高点)
  if (cycles.length > 0) {
    const lastC = contacts[contacts.length - 1];
    // 往后找一点
    const limit = Math.min(frames.length - 1, lastC + fpsGuess);
    let bestEnd = lastC;
    let minV = 999;
    for(let j = lastC; j < limit; j++){
       if(y[j] < minV) { minV = y[j]; bestEnd = j; }
    }
    cycles[cycles.length - 1].endFrame = bestEnd;
  }

  return { cycles, contacts };
}

// 辅助：简单的移动平均平滑
function smoothArray(arr: number[], windowSize: number): number[] {
  const res = [];
  const half = Math.floor(windowSize / 2);
  for (let i = 0; i < arr.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = i - half; j <= i + half; j++) {
      if (j >= 0 && j < arr.length) {
        sum += arr[j];
        count++;
      }
    }
    res.push(sum / count);
  }
  return res;
}