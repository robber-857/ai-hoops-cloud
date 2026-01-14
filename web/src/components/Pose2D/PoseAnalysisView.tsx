"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Pose2DCanvas from "./Pose2DCanvas";
import Scrubber from "./Scrubber";
import Controls from "./Controls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ArrowRight, Activity } from "lucide-react";
import { useAnalysisStore, FrameSample } from "@/store/analysisStore";
import { getAllTemplates } from "@/config/templates/index";
import { calculateRealScore } from "@/lib/scoring";
import { routes } from "@/lib/routes";
import { DribbleFrame } from "@/lib/dribbleTemporal";
import { aggregateDribbleSequence } from "@/lib/dribbleCalculator";
import { supabase } from "@/lib/supabaseClient"; // [New] 引入 Supabase 客户端
import { aggregateTrainingSequence } from "@/lib/trainingCalculator"; 
import { TrainingFrame } from "@/lib/trainingTemporal";

// --- 导出类型定义，以便 Pose2DCanvas 可以使用 ---
export type AnalysisType = "shooting" | "dribbling"| "training";
export type AngleData = { name: string; value: number; unit?: string };

type Props = {
  file?: File | null; // 变为可选：如果是云端视频，可能没有 File 对象
  videoUrl?: string | null; // [New] 直接接收云端链接
  onClear: () => void;
  analysisType?: AnalysisType;
};

// 聚合函数：计算一段时间内的平均角度 (用于 Posture 类指标)
function aggregateFrames(frames: FrameSample[]): AngleData[] {
  if (frames.length === 0) return [];

  // 1) 找出所有出现过的 key
  const keys = new Set<string>();
  frames.forEach((f) => f.angles.forEach((a) => keys.add(a.name)));

  // 2) 对每个 key 计算平均值
  const result: AngleData[] = [];
  keys.forEach((key) => {
    // 提取该 key 的所有数值
    const values = frames
      .map((f) => f.angles.find((a) => a.name === key))
      .filter((a) => a !== undefined)
      .map((a) => a!.value);

    if (values.length > 0) {
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;

      // 找一个单位（取第一个非空的）
      const unit = frames
        .find((f) => f.angles.find((a) => a.name === key))
        ?.angles.find((a) => a.name === key)?.unit;

      result.push({ name: key, value: avg, unit });
    }
  });

  return result;
}

// --- 内部组件：用于显示角度的卡片 ---
function AngleDisplayCard({ title, angles }: { title: string; angles: AngleData[] }) {
  return (
    <Card className="border-slate-800/70 bg-slate-900/65 w-full h-full max-h-[600px] overflow-y-auto">
      <CardHeader>
        <CardTitle className="text-xl text-white">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {angles.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {angles.map((angle) => (
              <div
                key={angle.name}
                className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-slate-700/50 shadow-sm"
              >
                <span className="text-sm font-medium text-gray-300">{angle.name}</span>
                <span className="text-2xl font-bold text-sky-400 tabular-nums">
                  {angle.value.toFixed(1)}
                  <span className="text-sm text-sky-400/70 ml-1">{angle.unit || "°"}</span>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-gray-500 space-y-2">
            <Activity className="w-8 h-8 opacity-50" />
            <p>No data to analyze</p>
            <p className="text-xs opacity-70">Please play the video to start the analysis</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PoseAnalysisView({
  file,
  videoUrl: propVideoUrl,
  onClear,
  analysisType = "shooting",
}: Props) {
  const router = useRouter();

  // Store Hook
  const setAnalysisResult = useAnalysisStore((state) => state.setAnalysisResult);

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>("");

  // Ref 用于管理 Blob URL 的销毁
  const localUrlRef = useRef<string | null>(null);

  // 进度条当前位置 / 视频总时长 / 想跳到的目标时间
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [pendingSeek, setPendingSeek] = React.useState<number | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // [New] 为了让 UI 实时显示，我们也需要一个 State
  const [displayAngles, setDisplayAngles] = useState<AngleData[]>([]);

  // --- Refs ---
  // 存储所有帧的历史数据（用于 Posture 平均值 和 Timeline 图表）
  const allFramesRef = useRef<FrameSample[]>([]);
  // 专门存运球的原始帧（用于 Dribble Cycle 计算）
  const dribbleFramesRef = useRef<DribbleFrame[]>([]);
  // 用于存储训练动作的时序数据
  const trainingFramesRef = useRef<DribbleFrame[]>([]);
  // 用于存储“最新一帧”的角度数据（兜底：没播放也能生成 Posture）
  const latestAnglesRef = useRef<AngleData[]>([]);

  // --- 视频源处理逻辑：优先用传入的云端 URL，没有则用本地 File 生成 Blob ---
  useEffect(() => {
    // 1) 如果有云端链接，直接使用
    if (propVideoUrl) {
      setVideoUrl(propVideoUrl);
      return;
    }

    // 2) 如果只有本地文件，生成 Blob URL
    if (file) {
      if (localUrlRef.current) URL.revokeObjectURL(localUrlRef.current);
      const u = URL.createObjectURL(file);
      localUrlRef.current = u;
      setVideoUrl(u);
    }

    // 重置所有状态
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setDisplayAngles([]);
    latestAnglesRef.current = [];
    allFramesRef.current = [];
    dribbleFramesRef.current = [];
    setIsProcessing(false);

    // 清理函数：只有当是本地 Blob 时才销毁（如需在 report 继续播放，可先不销毁）
    // return () => {
    //   if (localUrlRef.current) URL.revokeObjectURL(localUrlRef.current);
    // };
  }, [file, propVideoUrl]);

  // --- Callbacks ---

  // [New] 处理 Canvas 回传的原始帧（用于运球分析）
  // [关键修复] 检测 Loop / Seek：避免“时间倒流”导致缓存与图表错乱
  const handleFrameCaptured = useCallback(
    (frame: DribbleFrame) => {
      if (isPlaying) {
        // 3. [Training Logic] 根据模式决定存入哪个 Ref
        if (analysisType === "dribbling") {
          const currentData = dribbleFramesRef.current;
          //过滤轻微抖动，避免时间倒流
          if (currentData.length > 0 && frame.t < currentData[currentData.length - 1].t - 0.5) {
            dribbleFramesRef.current = []; 
          }
          dribbleFramesRef.current.push(frame);
        } 
        else if (analysisType === "training") {
          const currentData = trainingFramesRef.current;
          // 同样的防回跳逻辑
          if (currentData.length > 0 && frame.t < currentData[currentData.length - 1].t - 0.5) {
             trainingFramesRef.current = [];
          }
          trainingFramesRef.current.push(frame);
        }
      }
    },
    [isPlaying, analysisType]
  );

  // [同步修改] 角度回传也要有同样的“时间倒流”处理，防止 timeline 乱掉
  const handleAnglesUpdate = useCallback(
    (angles: AngleData[], time: number) => {
      latestAnglesRef.current = angles;
      setDisplayAngles(angles);

      if (isPlaying && angles.length > 0) {
        const history = allFramesRef.current;

        // 检查是否发生了“时间倒流” (Loop 或 Seek)
        if (history.length > 0) {
          const lastTime = history[history.length - 1].time;
          if (time < lastTime - 0.5) {
            console.log("🔄 Loop detected in Timeline. Resetting.");
            allFramesRef.current = [];
          }
        }

        allFramesRef.current.push({ time, angles });
      }
    },
    [isPlaying]
  );

  // --- 核心：生成报告并保存 ---
  const handleGenerateReport = async () => {
    setIsPlaying(false);

    // 基础检查：是否采集到了数据
    // 如果没录到数据（比如没播放就点了），回退到用最后一帧（仅针对 Posture）
    if (allFramesRef.current.length === 0 && latestAnglesRef.current.length > 0) {
      allFramesRef.current.push({ time: 0, angles: latestAnglesRef.current });
    }

    if (allFramesRef.current.length === 0) {
      alert("If you find the black screen time is too long, please try again in an area with a smooth internet connection. After the screen displays, play for a few seconds before clicking the button.");
      return;
    }

    setIsGeneratingReport(true);

    try {
      const templates = getAllTemplates(analysisType);
      const activeTemplate = templates[0];

      let finalInputForScoring: AngleData[] = [];
      let detectedHandness = "right"; // 默认值

      // === 分支逻辑：运球 vs 投篮 ===
      if (analysisType === "dribbling") {
        const dFrames = dribbleFramesRef.current;

        // 只有当运球数据足够多时，才进行复杂的 Cycle 分析
        if (dFrames.length > 10) {
          // 1) 调用 DribbleCalculator（计算周期、一致性等）
          const { computedValues, handUsed } = aggregateDribbleSequence(dFrames, activeTemplate);
          detectedHandness = handUsed;

          // 2) 将计算结果(Map) 转换为 AngleData[] 格式
          const dynamicMetrics: AngleData[] = Object.entries(computedValues).map(([key, val]) => ({
            name: key,
            value: val,
            unit: "calc",
          }));

          // 3) 计算 Posture 类指标（从 allFramesRef 取平均值）
          const staticMetrics = aggregateFrames(allFramesRef.current);

          // 4) 合并两者
          finalInputForScoring = [...staticMetrics, ...dynamicMetrics];
        } else {
          // 数据不足时的兜底（只算 Posture）
          console.warn("Not enough dribble frames. Fallback to static.");
          finalInputForScoring = aggregateFrames(allFramesRef.current);
        }
      } else if (analysisType === "training") {
        // [New Logic] 训练动作处理
        const tFrames = trainingFramesRef.current;

        // 判断是“动态周期动作”还是“静态保持动作”
        // 我们可以通过 Template ID 或 Metrics 类型来判断
        const isDynamic = activeTemplate.templateId.includes("squat") || activeTemplate.templateId.includes("knees");
        
        if (tFrames.length > 10) {
          console.log("Analyzing Training Data:", tFrames.length, "frames");
          const computedStats = aggregateTrainingSequence(tFrames, activeTemplate);
          
          // [Fix] 修复类型报错：显式断言 val as number
          // [关键] 我们修改了 aggregateTrainingSequence 返回 Record<string, number | undefined>
          // 所以这里需要先过滤 undefined，再转换
          const dynamicMetrics: AngleData[] = Object.entries(computedStats)
            .filter(([_, val]) => val !== undefined) // 这一步运行时过滤了 undefined
            .map(([key, val]) => ({
              name: key,
              value: val as number, // [关键] 告诉 TS 这里肯定是 number
              unit: "calc",
            }));
            
            // Training 也可以混合一些静态平均值作为兜底
            const staticMetrics = aggregateFrames(allFramesRef.current);
            // 优先使用动态计算值覆盖静态值
             finalInputForScoring = [...staticMetrics, ...dynamicMetrics];
        } else {
          finalInputForScoring = aggregateFrames(allFramesRef.current);
        }
        
      }
      else {
        // === 投篮逻辑（保持不变）===
        finalInputForScoring = aggregateFrames(allFramesRef.current);
      }

      // 5) 调用评分引擎（传入 detectedHandness 用于 rangeByOption）
      const realScoreResult = calculateRealScore(
        activeTemplate, 
        finalInputForScoring,
        { handedness: detectedHandness } 
      );
      // [关键修改] 生成 10 年有效期的长期链接
      
      let longTermVideoUrl = videoUrl;
  
      // 🛑 [拦截器] 绝对禁止保存 blob 链接到数据库
      if (longTermVideoUrl.startsWith("blob:")) {
        alert("⚠️ Cloud upload not ready. Please wait a moment or re-upload.");
        console.error("❌ Blocking save: Video URL is still a local blob.", longTermVideoUrl);
        setIsGeneratingReport(false);
        return; // 直接终止，不让它往数据库写脏数据
      }
      // 检查是否是 Supabase 的临时链接
      if (videoUrl.includes("supabase.co") && videoUrl.includes("/user-videos/")) {
        try {
          // 1. 从临时 URL 中提取文件路径 (path)
          // URL 格式通常是: .../storage/v1/object/sign/user-videos/[filename]?token=...
          const pathPart = videoUrl.split("/user-videos/")[1];
          if (pathPart) {
            const filePath = decodeURIComponent(pathPart.split("?")[0]);

            console.log("🔄 Generating long-term URL for:", filePath);

            // 2. 申请一个 10 年 (315360000秒) 有效的签名
            const { data: signedData, error: signError } = await supabase
              .storage
              .from("user-videos")
              .createSignedUrl(filePath, 315360000);

            if (signError) throw signError;
            if (signedData?.signedUrl) {
              longTermVideoUrl = signedData.signedUrl;
              console.log("✅ Long-term URL generated");
            }
          }
        } catch (urlError) {
          console.error("⚠️ Failed to generate long-term URL, using session URL:", urlError);
          // 如果失败，回退使用当前的 videoUrl，至少能保证当下可用
        }
      }
      // 我们把 saved_metrics 混入 score_data 字段中存储
      // score_data 在数据库里是 JSONB 类型，可以随便存额外字段
      const scoreDataToSave = {
        ...realScoreResult,
        saved_metrics: finalInputForScoring // <--- 这里！存入原始数据
      };
      // 1) 准备数据包
      const reportData = {
        video_url: longTermVideoUrl,
        score_data: scoreDataToSave, // 使用包含 raw metrics 的对象
        timeline_data: allFramesRef.current,
        template_id: activeTemplate.templateId,
      };

      // 2) 存入 Supabase analysis_reports 表
      const { data, error } = await supabase
        .from("analysis_reports")
        .insert(reportData)
        .select()
        .single();

      if (error) throw error;

      const newReportId = data.id;
      console.log("✅ Report saved to DB, ID:", newReportId);

      // 3) 更新 Store（包含 timeline；使用长期链接，方便统一）
      setAnalysisResult({
        videoUrl: longTermVideoUrl,
        angles: finalInputForScoring, // 混合后的数据（用于 Report 展示结果）
        timeline: allFramesRef.current, // 原始时序数据（用于 Report 画折线图）
        score: realScoreResult,
        template: activeTemplate,
      });

      // 4) 跳转（带 report id）
      router.push(`${routes.pose2d.report}?id=${newReportId}`);
    } catch (error) {
      console.error("Analysis/Save failed:", error);
      alert("Failed to save report to cloud. Please check console.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in zoom-in duration-500">
      {/* 左侧 (col-span-2): 视频区域 */}
      <div className="lg:col-span-2 space-y-4">
        <div className="relative rounded-xl overflow-hidden shadow-2xl bg-black border border-slate-800">
          <div className="aspect-video relative">
            <Pose2DCanvas
              videoUrl={videoUrl}
              isPlaying={isPlaying}
              onVideoEnd={() => setIsPlaying(false)}
              onTime={(curr, dur) => {
                setCurrentTime(curr);
                setDuration(dur);
              }}
              seekTo={pendingSeek}
              analysisType={analysisType}
              // ✅ [关键修改] 传递稳定的回调函数
              onAnglesUpdate={handleAnglesUpdate}
              // ✅ [New] 传递运球帧捕获回调
              onFrameCaptured={handleFrameCaptured}
              onProcessing={(processing) => setIsProcessing(processing)}
            />

            {/* 加载遮罩 (保留) */}
            {isProcessing && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-white font-medium tracking-wide">AI Processing...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 控制区域 */}
        <div className="bg-slate-900/50 rounded-xl border border-slate-800/50 p-4 backdrop-blur-sm">
          <Scrubber
            current={currentTime}
            duration={duration}
            onScrub={(sec) => {
              setCurrentTime(sec);
            }}
            onScrubEnd={(sec) => {
              setPendingSeek(sec);
              setTimeout(() => setPendingSeek(null), 0);
            }}
          />
          <div className="mt-4 flex justify-between items-center">
            <Controls isPlaying={isPlaying} onTogglePlay={() => setIsPlaying((p) => !p)} onClear={onClear} />

            {/* [New] 生成报告按钮 */}
            <Button
              onClick={handleGenerateReport}
              disabled={isGeneratingReport || isProcessing}
              className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2 shadow-lg shadow-indigo-500/20"
            >
              {isGeneratingReport ? "Saving..." : "View Analysis Report"}
              {!isGeneratingReport && <ArrowRight className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* 右侧 (col-span-1): 分析数据面板 */}
      <div className="lg:col-span-1 h-[600px] hidden lg:block">
        {/* [Modified] 传入 displayAngles State */}
        <AngleDisplayCard title="Real-time Metrics" angles={displayAngles} />
      </div>
    </div>
  );
}