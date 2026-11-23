import type { AppLanguage } from "@/lib/language";

// These are measurement identifiers emitted by extractPoseAngles. Only labels are localized.
const labels: Readonly<Record<string, readonly [string, string]>> = {
  elbowToTorsoDistanceNorm: ["Elbow-to-torso distance", "肘部与躯干的距离"],
  wristMidlineOffsetNorm: ["Wrist offset from midline", "手腕偏离中线的距离"],
  trunkLeanDegSide: ["Trunk lean", "躯干倾角"],
  forearmVerticalDeg: ["Forearm angle from vertical", "前臂与竖直方向的夹角"],
  kneeOverToeSide: ["Knee position relative to toes", "膝盖相对脚尖的位置"],
  minKneeAngleDuringLoad: ["Minimum knee angle during loading", "蓄力时最小膝角"],
  kneeAngleDeg: ["Knee angle", "膝关节角度"],
  shoulderStanceRatio: ["Stance width relative to shoulder width", "站距与肩宽之比"],
  wristHeightRatioToShoulder: ["Wrist height relative to shoulder", "手腕相对肩部的高度"],
  wristHeightRatioToHip: ["Wrist height relative to hip", "手腕相对髋部的高度"],
  guideHandInChestBoxRate: ["Guide hand in chest area", "护球手是否在胸前区域"],
  toeAngleDegLeft: ["Left toe angle", "左脚尖角度"],
  toeAngleDegRight: ["Right toe angle", "右脚尖角度"],
  crossMidlineState: ["Hand crossing the midline", "手是否越过身体中线"],
  overreachControlFront: ["Hand reach from shoulder", "手部相对肩部的伸出距离"],
  wristXAtContactNormByST: ["Wrist position at contact", "触球时手腕的横向位置"],
  receiveZoneQuarterNorm: ["Receiving position within stance", "接球点在站距内的位置"],
  wristAlignOppFootAtPeak: ["Wrist alignment with opposite foot at peak", "最高点时手腕与对侧脚的对齐程度"],
  hipForwardRatioSide: ["Hip forward offset", "髋部向前偏移量"],
  hipForwardRatioSideab: ["Hip offset magnitude", "髋部偏移幅度"],
  handForwardOffsetSide: ["Hand forward offset", "手部向前偏移量"],
  handForwardOffsetSideab: ["Hand offset magnitude", "手部偏移幅度"],
  wristToToeForwardOffsetSide: ["Wrist forward offset from toes", "手腕相对脚尖的前移量"],
  elbowAngleDeg: ["Elbow angle", "肘关节角度"],
  shoulderArmAngleDeg: ["Upper arm angle to torso", "上臂与躯干的夹角"],
  bodyLineDeg: ["Body alignment angle", "身体伸展角度"],
  avgKneeAngleDeg: ["Average knee angle", "平均膝角"],
  topKneeAngleDeg: ["Knee angle at top", "最高点膝角"],
  plankBodyLineDeg: ["Plank body alignment", "平板支撑身体角度"],
  avgElbowAngleDeg: ["Average elbow angle", "平均肘角"],
  torsoLeanDegSide: ["Side-view torso lean", "侧面躯干倾角"],
  shoulderOverWristOffsetX: ["Shoulder offset from wrist", "肩部与手腕的水平偏移量"],
  kneeOverToeOffsetXSide: ["Knee offset from toes", "膝盖与脚尖的水平偏移量"],
  hipBelowKneeRatioSide: ["Hip depth relative to knee", "髋部相对膝盖的下沉深度"],
  footStrikeOffsetXUnderHip: ["Foot landing offset from hip", "落脚点相对髋部的水平偏移量"],
  kneeToHipHeightRatioSide: ["Knee height relative to hip", "膝盖相对髋部的高度"],
};

export function liveMetricLabel(key: string, language: AppLanguage): string | undefined {
  const side = /^(left|right)([A-Z].*)$/.exec(key);
  const stem = side ? side[2][0].toLowerCase() + side[2].slice(1) : key;
  if (!Object.hasOwn(labels, stem)) return undefined;
  const [english, chinese] = labels[stem];
  if (!side) return language === "zh-CN" ? chinese : english;
  if (language === "zh-CN") return (side[1] === "left" ? "左侧" : "右侧") + chinese;
  return (side[1] === "left" ? "Left " : "Right ") + english[0].toLowerCase() + english.slice(1);
}
