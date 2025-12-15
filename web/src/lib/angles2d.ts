import type { Landmark, NormalizedLandmark, NormalizedLandmarkList } from '@mediapipe/pose';

// MediaPipe Pose 关键点索引
const POSE_LANDMARKS = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
};
/**
 * 根据三个关节点计算夹角（单位：度）
 * @param a - 第一个点 (例如：肩膀)
 * @param b - 中间点，角度所在处 (例如：肘部)
 * @param c - 第三个点 (例如：手腕)
 * @returns 角度值 (0-180)
 */
//这里的坐标是 MediaPipe 的归一化坐标（0~1）；用于角度没问题，因为比例缩放不影响角度。
function calculateAngle(a: NormalizedLandmark, b: NormalizedLandmark, c: NormalizedLandmark): number {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * 180.0 / Math.PI);
  
  if (angle > 180.0) {
    angle = 360 - angle;
  }
  return angle;
}

/**
 * 在 Canvas 的指定关节点旁绘制角度文本
 * @param ctx - Canvas 2D 上下文
 * @param landmarks - MediaPipe 返回的关节点数组
 * @param p1Idx, p2Idx, p3Idx - 三个关节点的索引
 * @param label - 角度的标签 (例如 'Elbow')
 */
function drawAngle(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmarkList,
  p1Idx: number,
  p2Idx: number,
  p3Idx: number,
  label: string
) {
  const p1 = landmarks[p1Idx];
  const p2 = landmarks[p2Idx];
  const p3 = landmarks[p3Idx];

  // 确保所有关节点都存在且可见
  // 使用 ?? 0 来处理 visibility 可能为 undefined 的情况
  if (p1 && p2 && p3 && (p1.visibility ?? 0) > 0.6 && (p2.visibility ?? 0) > 0.6 && (p3.visibility ?? 0) > 0.6) {
    const angle = calculateAngle(p1, p2, p3);
    const text = `${label}: ${angle.toFixed(1)}°`;

    // 设置文本样式
    ctx.fillStyle = '#00ff00'; // 亮绿色
    ctx.font = 'bold 26px "Geist Mono", monospace';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 4;
    
    // 文本位置（在关节点旁边，乘以画布宽高得到像素坐标）
    const posX = p2.x * ctx.canvas.width;
    const posY = p2.y * ctx.canvas.height;
    
    // 绘制带描边的文本，使其在任何背景下都清晰可见
    ctx.strokeText(text, posX + 15, posY + 15);
    ctx.fillText(text, posX + 15, posY + 15);
  }
}

/**
 * 计算并绘制所有我们关心的角度
 * @param ctx - Canvas 2D 上下文
 * @param landmarks - MediaPipe 返回的关节点数组
 */
export function calculateAndDrawAngles(ctx: CanvasRenderingContext2D, landmarks: NormalizedLandmarkList) {
  // 索引来自 MediaPipe Pose Landkmarks 文档
  // 左肘
  drawAngle(ctx, landmarks, 11, 13, 15, 'L Elbow');
  // 右肘
  drawAngle(ctx, landmarks, 12, 14, 16, 'R Elbow');
  // 左膝
  drawAngle(ctx, landmarks, 23, 25, 27, 'L Knee');
  // 右膝
  drawAngle(ctx, landmarks, 24, 26, 28, 'R Knee');
  // 左肩
  drawAngle(ctx, landmarks, 13, 11, 23, 'L Shoulder');
  // 右肩
  drawAngle(ctx, landmarks, 14, 12, 24, 'R Shoulder');
}

// --- 以下是为 React 组件 (PoseAnalysisView) 新增/恢复的函数 ---

/**
 * [恢复的函数]
 * 计算投篮相关的角度并返回数值 (用于 PoseAnalysisView)
 */
export function calculateAngles(landmarks: Landmark[]) {
  try {
    const shoulder = calculateAngle(
      landmarks[POSE_LANDMARKS.RIGHT_SHOULDER],
      landmarks[POSE_LANDMARKS.LEFT_SHOULDER],
      landmarks[POSE_LANDMARKS.LEFT_ELBOW]
    );
    const elbow = calculateAngle(
      landmarks[POSE_LANDMARKS.LEFT_SHOULDER],
      landmarks[POSE_LANDMARKS.LEFT_ELBOW],
      landmarks[POSE_LANDMARKS.LEFT_WRIST]
    );
    const wrist = calculateAngle(
      landmarks[POSE_LANDMARKS.LEFT_ELBOW],
      landmarks[POSE_LANDMARKS.LEFT_WRIST],
      landmarks[POSE_LANDMARKS.LEFT_WRIST] // 保持原来的逻辑
    );
    return { shoulder, elbow, wrist };
  } catch (error) {
    console.error("Error calculating angles:", error);
    return { shoulder: 0, elbow: 0, wrist: 0 };
  }
}

/**
 * [新增函数]
 * 计算两个 2D 关键点之间的欧几里得距离 (归一化距离)
 */
function getDistance(
  a: NormalizedLandmark,
  b: NormalizedLandmark
): number {
  if (!a || !b || (a.visibility ?? 0) < 0.5 || (b.visibility ?? 0) < 0.5) {
    throw new Error("Invalid landmarks for distance calculation.");
  }
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}


/** * 工具：计算 2D 向量距离 
 */
function getDist(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * 工具：计算向量与垂直线(Y轴)的夹角 (0-180度)
 * 用于计算躯干前倾、前臂竖直度等
 */
function calculateVerticalAngle(top: NormalizedLandmark, bottom: NormalizedLandmark): number {
  // 向量 (x, y)
  const dx = top.x - bottom.x;
  const dy = top.y - bottom.y; // 注意 canvas y轴向下，但计算角度通常只关心绝对偏差
  // Math.atan2(dx, dy) 计算与 Y 轴的夹角 (弧度)
  // 如果完全竖直 (dx=0), 结果为 0
  const rad = Math.atan2(Math.abs(dx), Math.abs(dy)); 
  return (rad * 180) / Math.PI;
}
/**
 * [新增函数]
 * 计算下蹲角度并返回数值 (取两侧膝盖的平均值)
 */
//visibility < 0.5 就表示该关键点置信度较低，可能被遮挡、误检或定位不准，因此不参与计算。
export function calculateCrouchAngle(landmarks: Landmark[]): number | null {
  try {
    const leftKnee = landmarks[POSE_LANDMARKS.LEFT_KNEE];
    const rightKnee = landmarks[POSE_LANDMARKS.RIGHT_KNEE];

    let leftAngle = 0;
    let rightAngle = 0;
    let validSides = 0;

    // 尝试计算左膝
    try {
      if (leftKnee && leftKnee.visibility && leftKnee.visibility > 0.5) {
        leftAngle = calculateAngle(
          landmarks[POSE_LANDMARKS.LEFT_HIP],
          leftKnee,
          landmarks[POSE_LANDMARKS.LEFT_ANKLE]
        );
        validSides++;
      }
    } catch (e) { /* 忽略单侧错误 */ }

    // 尝试计算右膝
    try {
      if (rightKnee && rightKnee.visibility && rightKnee.visibility > 0.5) {
        rightAngle = calculateAngle(
          landmarks[POSE_LANDMARKS.RIGHT_HIP],
          rightKnee,
          landmarks[POSE_LANDMARKS.RIGHT_ANKLE]
        );
        validSides++;
      }
    } catch (e) { /* 忽略单侧错误 */ }

    if (validSides === 0) return null;

    // 返回平均值
    return (leftAngle + rightAngle) / validSides;

  } catch (error) {
    console.error("Error calculating crouch angle:", error);
    return null;
  }
}

/**
 * [新增函数]
 * 计算双脚距离与肩宽的比值并返回数值
 */
export function calculateStanceToShoulderRatio(landmarks: Landmark[]): number | null {
  try {
    const shoulderWidth = getDistance(
      landmarks[POSE_LANDMARKS.LEFT_SHOULDER],
      landmarks[POSE_LANDMARKS.RIGHT_SHOULDER]
    );
    const stanceWidth = getDistance(
      landmarks[POSE_LANDMARKS.LEFT_ANKLE],
      landmarks[POSE_LANDMARKS.RIGHT_ANKLE]
    );

    if (shoulderWidth === 0) return null; // 避免除以零

    return stanceWidth / shoulderWidth;
  } catch (error) {
    // getDistance 会在点不可见时抛出错误
    console.warn("Cannot calculate stance ratio: landmarks not visible");
    return null;
  }
}
// =================================================================
//  新增：针对 Shooting Template 的计算函数
// =================================================================

/**
 * 1. 计算手肘到躯干的归一化距离 (用于 Front View: elbowToTorsoDistanceNorm)
 * 逻辑：计算同侧手肘 x 坐标与同侧肩膀 x 坐标的差值，除以肩宽进行归一化。
 * 越小说明手肘越内收 (Tucked)。
 */
export function calculateElbowToTorso(landmarks: NormalizedLandmarkList, isLeftHand: boolean): number {
  try {
    const shoulderL = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const shoulderR = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    
    // 计算肩宽作为基准 (归一化因子)
    const shoulderWidth = getDist(shoulderL, shoulderR) || 1; // 防止除以0

    const shoulder = isLeftHand ? shoulderL : shoulderR;
    const elbow = isLeftHand ? landmarks[POSE_LANDMARKS.LEFT_ELBOW] : landmarks[POSE_LANDMARKS.RIGHT_ELBOW];

    // 计算水平距离 (X轴差异)
    const dist = Math.abs(elbow.x - shoulder.x);
    
    return dist / shoulderWidth;
  } catch (e) { return 0; }
}

/**
 * 2. 计算手腕相对于中线的偏移 (用于 Front View: wristMidlineOffsetNorm)
 * 逻辑：(手腕X - 身体中心X) / 肩宽
 */
export function calculateWristMidlineNorm(landmarks: NormalizedLandmarkList, isLeftHand: boolean): number {
  try {
    const shoulderL = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const shoulderR = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    const shoulderWidth = getDist(shoulderL, shoulderR) || 1;

    // 身体中线 X (用双肩中点代替)
    const midX = (shoulderL.x + shoulderR.x) / 2;
    const wrist = isLeftHand ? landmarks[POSE_LANDMARKS.LEFT_WRIST] : landmarks[POSE_LANDMARKS.RIGHT_WRIST];
    // 归一化偏移量
    
    // 如果是右手投篮，手腕在右侧(x大)为正; 如果在中线左侧(x小)为负
    const offset = wrist.x - midX;
    
    // 如果是左手，镜像一下逻辑，或者直接返回绝对值视模板需求而定
    // 这里我们返回带符号的值，以便模板里的 Range 判断偏左还是偏右
    return offset / shoulderWidth; 
  } catch (e) { return 0; }
}

/**
 * 3. 计算躯干侧面倾角 (用于 Side View: trunkLeanDegSide)
 * 逻辑：髋关节中点到肩关节中点的连线，与垂直线的夹角
 */
export function calculateTrunkLean(landmarks: NormalizedLandmarkList): number {
  try {
    const sL = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const sR = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    const hL = landmarks[POSE_LANDMARKS.LEFT_HIP];
    const hR = landmarks[POSE_LANDMARKS.RIGHT_HIP];

    const midShoulder = { x: (sL.x + sR.x)/2, y: (sL.y + sR.y)/2, z: 0, visibility: 1 };
    const midHip = { x: (hL.x + hR.x)/2, y: (hL.y + hR.y)/2, z: 0, visibility: 1 };

    return calculateVerticalAngle(midShoulder, midHip);
  } catch (e) { return 0; }
}

/**
 * 4. 计算前臂垂直度 (用于 Side View: forearmVerticalDeg)
 */
export function calculateForearmVertical(landmarks: NormalizedLandmarkList, isLeftHand: boolean): number {
  try {
    const elbow = isLeftHand ? landmarks[POSE_LANDMARKS.LEFT_ELBOW] : landmarks[POSE_LANDMARKS.RIGHT_ELBOW];
    const wrist = isLeftHand ? landmarks[POSE_LANDMARKS.LEFT_WRIST] : landmarks[POSE_LANDMARKS.RIGHT_WRIST];
    return calculateVerticalAngle(elbow, wrist); // 上下关系: 肘在上腕在下(准备姿势)或相反
  } catch (e) { return 0; }
}

/**
 * 5. 判断膝盖是否过脚尖 (用于 Side View: kneeOverToeSide)
 * 返回 1 (True) 或 0 (False)
 */
export function checkKneeOverToe(landmarks: NormalizedLandmarkList): number {
  try {
    // 侧面视角，取可见度高的一侧
    // 这里简单取右侧为例，实际可以根据 visibility 判断
    const knee = landmarks[POSE_LANDMARKS.RIGHT_KNEE];
    const toe = landmarks[32]; // MediaPipe 32 是右脚尖 (RIGHT_FOOT_INDEX)
    
    // 在 2D 侧面图中，假设人朝右，如果 Knee.x > Toe.x 则过脚尖
    // 这个逻辑很依赖拍摄方向，简单做个 X 轴比较
    // 如果人朝左，则 Knee.x < Toe.x 是过脚尖
    // 这里先简单返回绝对值差，或者假设一个方向。
    // 为了 Demo，我们比较 X 坐标
    if (!toe) return 0;
    
    // 这是一个非常简化的判定，实际上需要知道人朝向
    // 我们假设 膝盖的 X 比 脚尖的 X 更靠前 (无论是左还是右)
    // 更好的方式是看两者的相对位置
    return Math.abs(knee.x - toe.x) < 0.02 ? 1 : 0; // 假设差距很小就是对其，这里仅做示例
  } catch (e) { return 0; }
}

/**
 * 计算手腕高度相对于[髋-肩]的位置 (0=髋, 1=肩)
 * 用于 computeKey: wristHeightRatioToShoulder
 */
export function calculateWristHeightRatio(landmarks: NormalizedLandmarkList, isLeft: boolean): number {
  try {
    const w = isLeft ? landmarks[15] : landmarks[16]; // WRIST
    const s = isLeft ? landmarks[11] : landmarks[12]; // SHOULDER
    const h = isLeft ? landmarks[23] : landmarks[24]; // HIP
    
    // MediaPipe Y 向下增大: Shoulder < Hip
    // 归一化高度: (HipY - WristY) / (HipY - ShoulderY)
    const torsoH = Math.abs(h.y - s.y);
    if (torsoH < 0.01) return 0;
    
    return (h.y - w.y) / torsoH;
  } catch(e) { return 0; }
}

/**
 * 计算前臂是否垂直 (Forearm Vertical)
 * 0 = 完全垂直
 */
export function calculateForearmVerticalDev(landmarks: NormalizedLandmarkList, isLeft: boolean): number {
  try {
    const e = isLeft ? landmarks[13] : landmarks[14]; // ELBOW
    const w = isLeft ? landmarks[15] : landmarks[16]; // WRIST
    // 理想情况 x 相同。计算 |dx| / dy 的角度，或者直接算角度
    return calculateVerticalAngle(e, w); 
  } catch(e) { return 0; }
}

/**
   计算脚尖角度 (Toe Angle)
 * 用于判断脚尖是否朝前 (0度=垂直向前/向侧面? 取决于你的定义)
 * 在 2D 图像中，通常计算 [Heel -> Toe] 向量与水平线的夹角
 */
export function calculateToeAngle(landmarks: NormalizedLandmarkList, isLeft: boolean): number {
  try {
    // 29: Left Heel, 31: Left Foot Index (Toe)
    // 30: Right Heel, 32: Right Foot Index (Toe)
    const heel = isLeft ? landmarks[29] : landmarks[30];
    const toe = isLeft ? landmarks[31] : landmarks[32];
    
    // 计算向量与水平线的夹角 (0-180)
    // 0 = 水平(脚尖朝侧面), 90 = 垂直(脚尖朝向镜头/正前方 - 投影原理)
    // 在 2D 正视图中，如果脚尖冲镜头，Heel 和 Toe 的 X 应该很接近 -> 90度
    // 如果脚尖外八，X 差值变大 -> 角度变小
    return calculateVerticalAngle(heel, toe); // 复用 VerticalAngle (0=竖直, 90=水平)
  } catch (e) { return 0; }
}