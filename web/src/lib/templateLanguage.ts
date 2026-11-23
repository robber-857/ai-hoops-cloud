import type { AppLanguage } from "./language";

type Names = { en: string; "zh-CN": string; aliases?: string[] };

const catalog: Record<string, Names> = {
  shoot_front_form_close: { en: "Front Form Shot", "zh-CN": "正面近距离定型投篮", aliases: ["正面｜近距离 Form Shot"] },
  shoot_side_form_close: { en: "Side Form Shot", "zh-CN": "侧面近距离定型投篮", aliases: ["侧面｜近距离 Form Shot"] },
  dribble_front_narrow_crossover: { en: "Front Narrow Crossover", "zh-CN": "正面小幅度变向运球", aliases: ["正面｜窄距 Crossover"] },
  dribble_side_narrow_crossover: { en: "Side Narrow Crossover", "zh-CN": "侧面小幅度变向运球", aliases: ["侧面｜窄距 Crossover"] },
  dribble_front_onehand_oneside_height: { en: "Front Hip-High Dribble", "zh-CN": "正面单手髋高运球", aliases: ["正面｜单手单侧运球(hip_high)"] },
  dribble_front_onehand_v: { en: "Front One-Hand V Dribble", "zh-CN": "正面单手 V 字运球", aliases: ["正面｜单手 V 运球(接球落点：按四等分)"] },
  dribble_side_onehand_oneside: { en: "Side One-Hand Dribble", "zh-CN": "侧面单手单侧运球", aliases: ["侧面｜单手单侧运球(落点在脚尖前方一点)"] },
  deep_squat_reps_side: { en: "Bodyweight Squat", "zh-CN": "徒手深蹲", aliases: ["深蹲｜徒手深蹲(侧面/重复次数)"] },
  high_knees_in_place_side: { en: "High Knees", "zh-CN": "原地高抬腿", aliases: ["高抬腿｜原地高抬腿(侧面)"] },
  jump_rope_basic_front: { en: "Basic Two-Foot Jump Rope", "zh-CN": "双脚基础跳绳" },
  jumping_jack_reps_front: { en: "Jumping Jack", "zh-CN": "开合跳" },
  lunge_same_side_reps_side: { en: "Same-Side Lunge", "zh-CN": "同侧弓步蹲" },
  pushup_hold_high_plank: { en: "Forearm Plank", "zh-CN": "前臂平板支撑" },
  pushup_reps_side: { en: "Push-Up", "zh-CN": "俯卧撑" },
  single_leg_stand_front: { en: "Single-Leg Stand", "zh-CN": "单腿站立" },
  wall_sit_half_hold: { en: "Wall Sit", "zh-CN": "靠墙静蹲", aliases: ["靠墙半蹲保持｜标准靠墙静蹲(侧面/约90°)"] },
  wall_sit_quarter_hold: { en: "Shallow Wall Sit", "zh-CN": "浅幅靠墙静蹲", aliases: ["靠墙四分之一蹲保持｜浅靠墙静蹲(侧面/约135°)"] },
};

const namesByLabel = new Map<string, { code: string; names: Names }>();
function indexNames(code: string, names: Names) {
  for (const label of [names.en, names["zh-CN"], ...(names.aliases ?? [])]) {
    namesByLabel.set(label, { code, names });
  }
}
for (const [code, names] of Object.entries(catalog)) indexNames(code, names);
// The original straight-arm plank and the newer forearm plank share a code.
indexNames("pushup_hold_high_plank", { en: "High Plank", "zh-CN": "高位平板支撑", aliases: ["俯卧撑状态保持｜高位平板(侧面)"] });

/** Only translate recognized built-in labels; saved snapshots and authored names stay intact. */
export function templateDisplayName(
  code: string | null | undefined,
  rawName: string | null | undefined,
  language: AppLanguage = "en",
): string {
  const key = code?.trim() ?? "";
  const label = rawName?.trim() ?? "";
  const known = Object.hasOwn(catalog, key) ? catalog[key] : undefined;
  if (known && (!label || label === key)) return known[language];
  const match = namesByLabel.get(label || key);
  if (match && (!key || !label || key === label || key === match.code)) {
    return match.names[language];
  }
  return label && rawName ? rawName : key;
}
