import type { AppLanguage } from "@/lib/language";
import { useAppLanguage } from "@/components/account/LanguagePreferenceProvider";
import { poseStrings } from "./poseStrings";
import { poseMetricStrings } from "./poseMetricStrings";

const dictionary: Readonly<Record<string, string>> = { ...poseStrings, ...poseMetricStrings };

const messages: [RegExp, (...parts: string[]) => string][] = [
  [/^(\d+(?:\.\d+)?)% weight$/, n => `权重 ${n}%`],
  [/^Report ID: (.+)$/, id => `报告编号：${id}`],
  [/^Generated on (.+)$/, date => `生成日期：${date}`],
  [/^Update required\. Published (.+) · requires (.+)\.$/, (a, b) => `需要更新。已发布 ${a}，当前需要 ${b}。`],
  [/^Update required\. Publish version (.+) to enable analysis\.$/, v => `请发布 ${v} 版本以启用分析。`],
  [/^Local upload proxy failed with (\d+)$/, n => `本地上传代理返回错误 ${n}。`],
  [/^(\d+)\/(\d+) frames · ([\d.]+)s \/ ([\d.]+)s$/, (now, total, time, duration) => `${now}/${total} 帧 · ${time} 秒 / ${duration} 秒`],
  [/^(\d+) pose frames \/ (\d+) motion frames$/, (a, b) => `${a} 个姿势帧 / ${b} 个动作帧`],
  [/^(\d+) frames captured$/, a => `已采集 ${a} 帧`],
  [/^([\d.]+)s \/ ([\d.]+)s covered$/, (covered, total) => `已覆盖 ${covered} 秒 / ${total} 秒`],
  [/^(\d+) samples$/, n => `${n} 个样本`],
  [/^(shooting|dribbling|training) reports need a full motion sequence\. Collected (\d+)\/(\d+) sequence frames; wait for automatic analysis or choose Recapture from start\.$/, (mode, now, total) => `${translatePose(mode)}报告需要完整动作序列。已采集 ${now}/${total} 帧，请等待自动分析或选择“从头重新采集”。`],
  [/^Only (\d+)\/(\d+) scoring metrics were collected\. Use a clearer full-body clip and try again\.$/, (a, b) => `仅采集到 ${a}/${b} 项评分指标。请使用更清晰的全身视频重试。`],
  [/^(.+) Retry automatic analysis, or recapture the clip manually from the beginning\.$/, reason => `${translatePose(reason)} 请重试自动分析，或从头手动采集。`],
  [/^(.+) Your captured analysis is still available\. You can retry saving when the issue is resolved\.$/, reason => `${translatePose(reason)} 已采集的分析数据仍然保留，问题解决后可以重试保存。`],
  [/^This report saved (\d+) findings, but locked template (.+) defines (\d+) metrics\. Performance charts are hidden until the historical template data is repaired\.$/, (a, v, b) => `本报告保存了 ${a} 项结果，但锁定的模板 ${v} 定义了 ${b} 项指标。修复历史模板数据后才能显示表现图表。`],
  [/^There is not enough clear movement data for this check\. Use a clear (front|side) view and keep the full body visible\.$/, cam => `此项检测的动作数据不足。请从${translatePose(cam)}拍摄，确保全身清晰可见。`],
  [/^Data missing: (.+) was not collected for this clip\. Use a clearer (front|side) view and make sure the movement completes enough reps for this metric\.$/, (name, cam) => `缺少数据：视频中未采集到${translatePose(name)}。请从${translatePose(cam)}清晰拍摄，并完成足够的重复次数。`],
  [/^Aim for (.+)\.$/, range => `目标范围：${range}。`],
  [/^Aim close to (.+)\.$/, value => `尽量接近 ${value}。`],
  [/^Target (range|rate|angle|offset) ([-\d.]+)( deg)?$/, (kind, range, unit) => `目标${({ range: "范围", rate: "比例", angle: "角度", offset: "偏移" } as Record<string, string>)[kind]} ${range}${unit ? "°" : ""}`],
  [/^(.+) pts: (.+)$/, (score, range) => `${score} 分：${range.replace(/ deg$/, "°")}`],
  [/^([-+\d.]+) (deg|degrees|sec|s|reps|ratio|rate|norm|score)$/, (val, unit) => `${val} ${translatePose(unit)}`],
];

function translatePose(text: string): string {
  const exact = dictionary[text];
  if (typeof exact === "string") return exact;
  for (const [pattern, format] of messages) {
    const match = pattern.exec(text);
    if (match) return format(...match.slice(1));
  }
  return text;
}

// Some older published shooting templates contain Chinese coaching cues.
const legacyEnglish: Readonly<Record<string, string>> = {
  "手肘外撇/离肋骨太远：让肘更贴近身体一侧，出手线路更直。": "Bring the elbow closer to the shooting side of your ribs for a straighter release.",
  "出手手越过身体中线：把出手保持在自己这侧，更稳定更准。": "Keep the shooting hand on its own side of your body through the release.",
  "出手路线左右飘：让手走直线，不要横向甩。": "Keep the release path straight and avoid swinging your hand sideways.",
  "每一投差异大：先慢速 form shot，追求每次动作一样。": "Start with slower form shots and repeat the same movement on every shot.",
  "身体前倾过多/过少：保持轻微前倾，便于发力与控球。": "Keep a slight forward lean to support the shot and ball control.",
  "膝盖顶到脚尖前：重心太靠前，臀部坐回去更稳。": "Sit your hips back to balance your weight over your feet when your knees drift past your toes.",
  "下蹲不足/过度：近距离更重视顺序和稳定，蹲到可控范围即可。": "Use a controlled knee dip. For a close-range shot, prioritise timing and stability.",
  "前臂不够竖直：让肘更在球下方，出手更直更稳。": "Place the elbow under the ball to keep the forearm vertical through the release.",
  "随球保持不足：出手后手腕保持0.2–0.4秒，形成稳定手感。": "Hold your wrist in its follow-through for 0.2–0.4 seconds after release.",
  "发力顺序乱：先下肢带动，再肘伸、腕甩。": "Start with your legs, then extend the elbow and snap the wrist.",
  "收势不稳：出手后保持身体稳定，落地站住。": "Keep your body steady after release and hold your landing."
};

function english(text: string): string {
  return Object.hasOwn(legacyEnglish, text) ? legacyEnglish[text] : text;
}
export const poseTranslator = (language: AppLanguage) => language === "zh-CN" ? translatePose : english;
export function usePoseCopy() {
  const language = useAppLanguage();
  return { language, t: poseTranslator(language) };
}
