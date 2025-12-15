import { ActionTemplate } from "@/config/templates/index";
import { 
  DribbleFrame, 
  DribbleCycle, 
  segmentDribbleCycles, 
  inferHandedness,
  RawPoint
} from "./dribbleTemporal"; 

// 辅助：计算标准差
const calculateStd = (values: number[]) => {
  if (values.length < 2) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(v => Math.pow(v - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquareDiff);
};
// 辅助：计算关节夹角 (a-joint-c), 返回角度值 (0~180°)
const calcJointAngleDeg = (a: RawPoint, joint: RawPoint, c: RawPoint): number => {
  if (!a || !joint || !c) return 0;

  const v1x = a.x - joint.x;
  const v1y = a.y - joint.y;
  const v2x = c.x - joint.x;
  const v2y = c.y - joint.y;

  const dot = v1x * v2x + v1y * v2y;
  const len1 = Math.sqrt(v1x * v1x + v1y * v1y);
  const len2 = Math.sqrt(v2x * v2x + v2y * v2y);
  if (len1 < 1e-4 || len2 < 1e-4) return 0;

  let cos = dot / (len1 * len2);
  // 数值保护，避免浮点误差导致 acos NaN
  cos = Math.max(-1, Math.min(1, cos));

  return Math.acos(cos) * 180 / Math.PI; // 返回 0~180°
};
// 辅助：计算平均值
const average = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

/**
 * 计算两点连线与铅垂线的夹角 (0° = 竖直)
 * 用于 Forearm Vertical 计算
 */
const calcVerticalDeg = (top: RawPoint, bottom: RawPoint) => {
  const dx = Math.abs(top.x - bottom.x);
  const dy = Math.abs(top.y - bottom.y); 
  if (dy < 0.001) return 90; 
  return (Math.atan(dx / dy) * 180) / Math.PI;
};

/**
 * 判断 "护球手在胸前"
 * Box 定义: X 在左右肩之间, Y 在肩和髋之间
 */
const isHandInBox = (hand: RawPoint, ls: RawPoint, rs: RawPoint, lh: RawPoint, rh: RawPoint) => {
  const minX = Math.min(ls.x, rs.x);
  const maxX = Math.max(ls.x, rs.x);
  const minY = Math.min(ls.y, rs.y); 
  const maxY = Math.max(lh.y, rh.y); 
  // 宽松判定
  return (hand.y > minY && hand.y < maxY + 0.1 && 
          hand.x > minX - 0.1 && hand.x < maxX + 0.1) ? 1 : 0;
};

/**
 * [New] 判断侧面朝向 (返回 1: 朝右, -1: 朝左)
 * 依据：脚尖在脚踝(或脚跟)右边 => 朝右
 */
const getFacingDir = (f: DribbleFrame, isLeftHand: boolean) => {
  // 31/32 是 Toe, 27/28 是 Ankle. 
  // DribbleFrame: lf/rf 是 Toe, la/ra 是 Ankle
  const toe = isLeftHand ? f.lf : f.rf; 
  const ankle = isLeftHand ? f.la : f.ra; 
  
  // 如果 脚尖X > 脚踝X，说明面朝右侧 (1)，否则朝左 (-1)
  return (toe.x > ankle.x) ? 1 : -1; 
};

export function aggregateDribbleSequence(
  frames: DribbleFrame[], 
  template: ActionTemplate
) {
  // 1. 自动推断左右手
  const handOption = template.options?.handedness || "auto";
  const detectedHand = inferHandedness(frames);
  const finalHand = handOption === "auto" ? detectedHand : (handOption as "left" | "right");
  const isLeft = finalHand === "left";

  // 2. 切分周期
  const { cycles, contacts } = segmentDribbleCycles(frames, finalHand);
  
  // 3. 准备结果对象
  const results: Record<string, number> = {};

  // 3. [关键修正] 判定是否为侧面
  // 优先信任模板配置。如果模板说 camera="side"，那就强制认定为侧面。
  // 只有当模板没说时，才用算法猜。
  const isTemplateSide = template.camera === 'side';
  const isAlgoSide = frames.length > 0 && frames[0].isSideView;
  const isSideView = isTemplateSide || isAlgoSide;

  // =========================================================
  //  A. Execution 类 (基于周期/关键帧)
  // =========================================================
  
  // 1. receiveZoneQuarterNorm (V运球落点区域 - Front View)
  const contactZones = contacts.map(idx => {
  const f = frames[idx];

  const leftFootX  = Math.min(f.lf.x, f.rf.x);
  const rightFootX = Math.max(f.lf.x, f.rf.x);
  const stanceWidth = (rightFootX - leftFootX) || 0.1;

  const wristX = isLeft ? f.lw.x : f.rw.x;

  // 0 = 左脚下方, 1 = 右脚下方, 0.5 = 双脚中点
  return (wristX - leftFootX) / stanceWidth;
});

results["receiveZoneQuarterNorm"] = average(contactZones);

  // 2. [Height] 高度指标 (wristHeightRatioToShoulder/Hip)
  // 逻辑: 使用 Peak (最高点) 而不是 Contact (最低点)
  const heightRatios = cycles.map(cycle => {
    // 寻找周期内的最高点 (Y 最小)
    const startF = frames[cycle.startFrame];
    const endF = frames[cycle.endFrame];
    const startY = isLeft ? startF.lw.y : startF.rw.y;
    const endY = isLeft ? endF.lw.y : endF.rw.y;
    const peakFrame = startY < endY ? startF : endF;

    const wY = isLeft ? peakFrame.lw.y : peakFrame.rw.y;
    const sY = isLeft ? peakFrame.ls.y : peakFrame.rs.y; 
    const aY = isLeft ? peakFrame.la.y : peakFrame.ra.y; // 地板参考

    // 归一化公式: (脚踝 - 手腕) / (脚踝 - 肩膀)
    // 结果: 0=脚踝, 1=肩膀, 0.5=髋部附近
    const totalH = Math.abs(aY - sY) || 0.5;
    const currentH = Math.abs(aY - wY);
    
    return currentH / totalH;
  });
  // 如果没有检测到周期，给个默认值
  const avgHeight = heightRatios.length ? average(heightRatios) : 0.4;
  results["wristHeightRatioToShoulder"] = avgHeight;
  results["wristHeightRatioToHip"] = avgHeight; 

  // 3. crossMidlineRate (过中线率 - Front View)
  const crossCounts = cycles.filter(c => {
    const cycleFrames = frames.slice(c.startFrame, c.endFrame + 1);
    if (cycleFrames.length === 0) return false;
    const xs = cycleFrames.map(f => isLeft ? f.lw.x : f.rw.x);
    const contactF = frames[c.contactFrame];
    const midX = (contactF.ls.x + contactF.rs.x) / 2;
    return (Math.min(...xs) < midX && Math.max(...xs) > midX);
  }).length;
  results["crossMidlineRate"] = cycles.length ? (crossCounts / cycles.length) : 0;

  // 4. overreachControlFront (身体前侧过伸 - Front View)
  const overreachs = contacts.map(idx => {
      const f = frames[idx];
      const w = isLeft ? f.lw : f.rw;
      const s = isLeft ? f.ls : f.rs;
      return Math.abs(w.x - s.x) / f.shoulderWidth; 
  });
  results["overreachControlFront"] = average(overreachs);

  // 5. [New] 落点前后位置 (侧面视图专用)
  if (isSideView) {
     // wristToToeForwardOffsetSide (触球点相对脚尖的前后偏移)
     // 正数 = 球在脚尖前方
     const toeOffsets = contacts.map(idx => {
        const f = frames[idx];
        const w = isLeft ? f.lw : f.rw;
        const toe = isLeft ? f.lf : f.rf; // 同侧脚尖
        const dir = getFacingDir(f, isLeft);
        
        // 计算带符号距离: (Wrist - Toe) * Dir
        // 若朝右(Dir=1): Wrist > Toe (在右边) => 正数 (前方)
        return (w.x - toe.x) * dir / f.trunkHeight; 
     });
     results["wristToToeForwardOffsetSide"] = average(toeOffsets);
  } else {
     results["wristToToeForwardOffsetSide"] = 0;
  }
  // 6. wristAlignOppFootAtPeak (运到对侧时手腕与对侧脚的对齐程度 - Front View)
  const wristAligns: number[] = cycles.map(cycle => {
  const cycleFrames = frames.slice(cycle.startFrame, cycle.endFrame + 1);
  if (!cycleFrames.length) return 0;

  // 取这个周期的任意一帧来估计站位（用 contactFrame 或第一个姿态正常的帧都行）
  const refF = frames[cycle.contactFrame] || cycleFrames[0];

  // 屏幕上的左右脚 (不信任 lf/rf 标签顺序，直接按 x 排）
  const leftFootX  = Math.min(refF.lf.x, refF.rf.x);
  const rightFootX = Math.max(refF.lf.x, refF.rf.x);
  const stanceWidth = (rightFootX - leftFootX) || 0.1;

  // 对侧脚 x
  const oppFootX = isLeft ? rightFootX : leftFootX;

  // 左手→对侧为右 (+1)，右手→对侧为左 (-1)
  const oppSideSign = isLeft ? 1 : -1;

  let bestDiffNorm = Number.POSITIVE_INFINITY;

  cycleFrames.forEach(f => {
    const w = isLeft ? f.lw : f.rw;
    const ls = f.ls;
    const rs = f.rs;
    if (!w || !ls || !rs) return;

    const midX = (ls.x + rs.x) / 2;

    // wrist 是否真的到了对侧
    const relToMid = (w.x - midX) * oppSideSign;
    if (relToMid <= 0) return; // 还在本侧或中线，不算“到另一侧”

    // 计算“手腕与对侧脚竖直对齐”的偏差，归一化到站距
    const diffNorm = Math.abs(w.x - oppFootX) / stanceWidth;

    if (diffNorm < bestDiffNorm) {
      bestDiffNorm = diffNorm;
    }
  });

  // 如果这一周期压根没到对侧，就给一个偏大的默认，比如 0.5
  if (!Number.isFinite(bestDiffNorm)) {
    return 0.5;
  }
  return bestDiffNorm;
});

results["wristAlignOppFootAtPeak"] = wristAligns.length ? average(wristAligns) : 0.5;

  // =========================================================
  //  B. Posture 类 (姿态)
  // =========================================================
  
  // 1. wristBelowElbow (手腕是否低于肘部)
  const wristBelowCounts = frames.filter(f => {
    const w = isLeft ? f.lw : f.rw;
    const e = isLeft ? f.le : f.re; 
    if (!e || !w) return true;
    return w.y > e.y; // Y向下增大
  }).length;
  const passRate = frames.length ? (wristBelowCounts / frames.length) : 0;
  results["wristBelowElbow"] = passRate > 0.8 ? 1 : 0; 

  // 2. forearmVerticalDeg (前臂垂直度)
  const forearmDegs = frames.map(f => {
    const w = isLeft ? f.lw : f.rw;
    const e = isLeft ? f.le : f.re;
    if (!e || !w) return 0;
    return calcVerticalDeg(e, w);
  });
  results["forearmVerticalDeg"] = average(forearmDegs);

  // 3. guideHandInChestBoxRate (护球手位置)
  const guideHandInBoxCounts = frames.filter(f => {
    const guideHand = isLeft ? f.rw : f.lw; 
    return isHandInBox(guideHand, f.ls, f.rs, f.lh, f.rh);
  }).length;
  results["guideHandInChestBoxRate"] = frames.length ? (guideHandInBoxCounts / frames.length) : 0;

  // 4. [New] Side View Posture Metrics (使用真实 Knee 数据)
  if (isSideView) {
    const postureFrames = frames.filter(f => f.trunkHeight > 0.1); 

    // (1) 膝盖过脚尖 (kneeOverToeSide)
    // 这里的 f.lk/f.rk 是你刚刚添加进 DribbleFrame 的
    const kneeOverToes = postureFrames.map(f => {
       const knee = isLeft ? f.lk : f.rk; // 真实膝盖数据
       const toe = isLeft ? f.lf : f.rf;
       // 检查数据是否存在
       if (!knee) return 0; 
       
       const dir = getFacingDir(f, isLeft);
       // (Knee - Toe) * Dir. 正数 = 膝盖超过脚尖
       return (knee.x - toe.x) * dir / f.trunkHeight;
    });
    results["kneeOverToeSide"] = average(kneeOverToes);

    // (2) 髋部前送 (hipForwardRatioSide)
    // Hip 相对 Ankle 的位置. 正数 = 髋在踝前方 (挺肚子)
    const hipForwards = postureFrames.map(f => {
       const h = isLeft ? f.lh : f.rh;
       const a = isLeft ? f.la : f.ra;
       const dir = getFacingDir(f, isLeft);
       return (h.x - a.x) * dir / f.trunkHeight;
    });
    results["hipForwardRatioSide"] = average(hipForwards);
    // 2.1 髋部前送绝对值 (hipForwardRatioSideab)
    results["hipForwardRatioSideab"] = Math.abs(results["hipForwardRatioSide"]);

    // (3) 躯干前倾 (trunkLeanDegSide)
    const trunkLeans = postureFrames.map(f => {
       const s = isLeft ? f.ls : f.rs;
       const h = isLeft ? f.lh : f.rh;
       return calcVerticalDeg(s, h);
    });
    results["trunkLeanDegSide"] = average(trunkLeans);

    // (4) 手部前探 (handForwardOffsetSide)
    // 侧面看手离肩膀多远
    const handOffsets = postureFrames.map(f => {
       const w = isLeft ? f.lw : f.rw;
       const s = isLeft ? f.ls : f.rs;
       const dir = getFacingDir(f, isLeft);
       return (w.x - s.x) * dir / f.trunkHeight;
    });
    results["handForwardOffsetSide"] = average(handOffsets);

    // (5) 肘角度 (elbowAngleDeg)
    const elbowAngles = postureFrames.map(f => {
      const s = isLeft ? f.ls : f.rs;  // 肩
      const e = isLeft ? f.le : f.re;  // 肘
      const w = isLeft ? f.lw : f.rw;  // 腕
      if (!s || !e || !w) return 0;
      return calcJointAngleDeg(s, e, w);
    }).filter(v => v > 0);

    results["elbowAngleDeg"] = elbowAngles.length ? average(elbowAngles) : 160; // 160 给个保守默认

    // (6) 肩-上臂角度 (shoulderArmAngleDeg) 计算肘-肩-髋夹角
    const shoulderAngles = postureFrames.map(f => {
      const h = isLeft ? f.lh : f.rh;  // 髋
      const s = isLeft ? f.ls : f.rs;  // 肩
      const e = isLeft ? f.le : f.re;  // 肘
      if (!h || !s || !e) return 0;
      return calcJointAngleDeg(h, s, e);
    }).filter(v => v > 0);

    results["shoulderArmAngleDeg"] = shoulderAngles.length ? average(shoulderAngles) : 90; // 90° 作为居中默认

  } else {
    results["kneeOverToeSide"] = 0;
    results["hipForwardRatioSide"] = 0;
    results["trunkLeanDegSide"] = 20; 
    results["handForwardOffsetSide"] = 0.2;
    results["elbowAngleDeg"] = 160;
    results["shoulderArmAngleDeg"] = 90;
  }
  // 4.1 手部前探绝对值 (handForwardOffsetSideab)
  // 这里我们只关心“手离肩膀有多远”，不关心前 / 后方向
  results["handForwardOffsetSideab"] = Math.abs(results["handForwardOffsetSide"]);
  // 5. [New] Toe Angles (脚尖朝向 - 正面/窄距模板核心)
  // 逻辑：计算 脚踝(Ankle) 到 脚尖(Toe) 的连线偏离垂直线的角度
  // DribbleFrame 数据源: la(左踝), lf(左脚尖), ra(右踝), rf(右脚尖)
  const leftToeAngles = frames.map(f => {
     // 如果没有脚部数据，返回 0 (默认完美)
     if (!f.la || !f.lf) return 0;
     return calcVerticalDeg(f.la, f.lf);
  });
  results["toeAngleDegLeft"] = average(leftToeAngles);

  const rightToeAngles = frames.map(f => {
     if (!f.ra || !f.rf) return 0;
     return calcVerticalDeg(f.ra, f.rf);
  });
  results["toeAngleDegRight"] = average(rightToeAngles);

  // =========================================================
  //  C. Consistency 类 (稳定性)
  // =========================================================

  // 1. X 轴稳定性 (Contact)
  const contactXNorms = contacts.map(idx => {
    const f = frames[idx];
    const w = isLeft ? f.lw : f.rw;
    const midX = (f.ls.x + f.rs.x) / 2;
    return (w.x - midX) / f.trunkHeight;
  });
  results["stdWristXAtContactPerCycleNormByST"] = calculateStd(contactXNorms);

  // 2. Y 轴稳定性 (使用 Peak Height 数组)
  results["stdWristHeightRatioToShoulderPerCycle"] = calculateStd(heightRatios);
  results["stdWristHeightRatioToHipPerCycle"] = calculateStd(heightRatios); 

  // 3. 落点稳定性 (Side View - 前后方向)
  if (isSideView) {
      const zValues = contacts.map(idx => {
          const f = frames[idx];
          const w = isLeft ? f.lw : f.rw;
          const toe = isLeft ? f.lf : f.rf;
          const dir = getFacingDir(f, isLeft);
          return (w.x - toe.x) * dir / f.trunkHeight;
      });
      results["stdWristToToeForwardOffsetPerCycle"] = calculateStd(zValues);
  } else {
      results["stdWristToToeForwardOffsetPerCycle"] = 0;
  }

  return {
    computedValues: results,
    handUsed: finalHand,
    cycles 
  };
}