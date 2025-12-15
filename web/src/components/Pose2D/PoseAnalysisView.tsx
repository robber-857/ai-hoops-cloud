"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation"; // 引入路由
import Pose2DCanvas from "./Pose2DCanvas";
import Scrubber from './Scrubber';
import Controls from "./Controls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button"; // 引入 Button
import { FileText, ArrowRight, Activity } from "lucide-react"; // 引入图标
// [New] 引入 Store 和 配置
import { useAnalysisStore, FrameSample } from "@/store/analysisStore";
import { getAllTemplates, ActionTemplate, Metric } from "@/config/templates"; // 确保引入 Metric 类型
import { calculateRealScore, ScoreResult, Grade, Finding} from "@/lib/scoring"; // 确保引入这些类型
import { routes } from "@/lib/routes";
import { DribbleFrame } from "@/lib/dribbleTemporal";
import { aggregateDribbleSequence } from "@/lib/dribbleCalculator";

// --- 导出类型定义，以便 Pose2DCanvas 可以使用 ---
export type AnalysisType = "shooting" | "dribbling";
export type AngleData = { name: string; value: number; unit?: string };

type Props = {
  file: File;
  onClear: () => void;
  analysisType?: AnalysisType; // 1. 接受 analysisType Prop
};

// 聚合函数：计算一段时间内的平均角度 (用于 Posture 类指标)
function aggregateFrames(frames: FrameSample[]): AngleData[] {
  if (frames.length === 0) return [];

  // 1. 找出所有出现过的 key
  const keys = new Set<string>();
  frames.forEach(f => f.angles.forEach(a => keys.add(a.name)));

  // 2. 对每个 key 计算平均值
  const result: AngleData[] = [];
  keys.forEach(key => {
    // 提取该 key 的所有数值
    const values = frames
      .map(f => f.angles.find(a => a.name === key))
      .filter(a => a !== undefined)
      .map(a => a!.value);
    
    if (values.length > 0) {
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      // 找一个单位 (取第一个非空的)
      const unit = frames.find(f => f.angles.find(a => a.name === key))?.angles.find(a => a.name === key)?.unit;
      
      result.push({ name: key, value: avg, unit });
    }
  });
  
  return result;
}

// --- 内部组件：用于显示角度的卡片 ---
function AngleDisplayCard({
  title,
  angles,
}: {
  title: string;
  angles: AngleData[];
}) {
  return (
    <Card className="border-slate-800/70 bg-slate-900/65 w-full h-full max-h-[600px] overflow-y-auto">
      <CardHeader>
        <CardTitle className="text-xl text-white">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {angles.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {angles.map((angle) => (
              <div key={angle.name} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-slate-700/50 shadow-sm">
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

export default function PoseAnalysisView({ file, onClear, analysisType = "shooting" }: Props) {
  const router = useRouter();
  
  // Store Hook
  const setAnalysisResult = useAnalysisStore((state) => state.setAnalysisResult);
  
  // --- State 必须定义在 Callback 之前，解决 "used before declaration" 错误 ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const urlRef = useRef<string | null>(null);
  
  const [currentTime, setCurrentTime] = React.useState(0);        // 进度条当前位置（秒）
  const [duration, setDuration] = React.useState(0);              // 视频总时长（秒）
  const [pendingSeek, setPendingSeek] = React.useState<number | null>(null); // 想跳到的目标时间
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  
  // [New] 为了让 UI 实时显示，我们也需要一个 State
  const [displayAngles, setDisplayAngles] = useState<AngleData[]>([]);

  // --- Refs ---
  //  存储所有帧的历史数据 (用于 Posture 平均值 和 Timeline 图表)
  const allFramesRef = useRef<FrameSample[]>([]);
  //  专门存运球的原始帧 (用于 Dribble Cycle 计算)
  const dribbleFramesRef = useRef<DribbleFrame[]>([]);
  //  用于存储“最新一帧”的角度数据
  const latestAnglesRef = useRef<AngleData[]>([]); 

  // --- Callbacks ---

  //  [New] 处理 Canvas 回传的原始帧 (用于运球分析)
  // [关键修复] 处理 Canvas 回传的原始帧
  const handleFrameCaptured = useCallback((frame: DribbleFrame) => {
    if (!isPlaying) return;

    const currentData = dribbleFramesRef.current;
    
    // 1. 检查是否发生了“时间倒流” (Loop 或 Seek)
    if (currentData.length > 0) {
      const lastFrame = currentData[currentData.length - 1];
      // 如果当前时间比上一帧还小 (比如从 15s 变回 0s)，说明重播了
      // 阈值设为 0.5s 以防轻微抖动，通常 Loop 是大幅度回跳
      if (frame.t < lastFrame.t - 0.5) {
        console.log("🔄 Detected loop or seek. Resetting analysis buffer.");
        dribbleFramesRef.current = []; // 清空运球数据
        allFramesRef.current = [];     // 清空波形图数据
      }
    }

    // 2. 存入新数据
    dribbleFramesRef.current.push(frame);
  }, [isPlaying]);

  // [同步修改] handleAnglesUpdate 也要加同样的逻辑，防止图表乱掉
  const handleAnglesUpdate = useCallback((angles: AngleData[], time: number) => {
    latestAnglesRef.current = angles;
    setDisplayAngles(angles);

    if (isPlaying && angles.length > 0) {
       const history = allFramesRef.current;
       // 同样的重置逻辑
       if (history.length > 0) {
          const lastTime = history[history.length - 1].time;
          if (time < lastTime - 0.5) {
             // 这里不需要清空，因为 handleFrameCaptured 已经负责清空了(或者你可以双重保险)
             // 为了安全起见，建议让 handleFrameCaptured 统一管理重置，或者两个都写
             allFramesRef.current = []; 
          }
       }
       allFramesRef.current.push({ time, angles });
    }
  }, [isPlaying]);

  useEffect(() => {
    // 换文件时生成新 URL，先安全清理旧的
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    
    const u = URL.createObjectURL(file);
    urlRef.current = u;
    setVideoUrl(u);
    
    // 重置所有状态
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setDisplayAngles([]); // 重置显示
    latestAnglesRef.current = []; // 重置数据
    allFramesRef.current = [];// 重置数据
    dribbleFramesRef.current = []; // [New] 重置运球数据
    setIsProcessing(false);

    // 仅在组件卸载时清理
    return () => {
      // ✅ [关键修改 2] 暂时注释掉销毁逻辑，防止 Report 页黑屏
      /* if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      } */
    };
  }, [file]);
  
  // --- 生成真实报告 (核心逻辑修改) ---
  const handleGenerateReport = () => {
    setIsPlaying(false);
    console.log("[DEBUG] allFramesRef length:", allFramesRef.current.length);
    console.log("[DEBUG] dribbleFramesRef length:", dribbleFramesRef.current.length);
    if (allFramesRef.current.length) {
    console.log(
      "[DEBUG] allFramesRef sample times:",
      allFramesRef.current.slice(0, 5).map(f => f.time.toFixed(3)),
      "..., last:",
      allFramesRef.current[allFramesRef.current.length - 1].time.toFixed(3)
    );
  }
    // 基础检查：是否采集到了数据
    // 如果没录到数据(比如没播放就点了)，回退到用最后一帧(仅针对 Posture)
    if (allFramesRef.current.length === 0 && latestAnglesRef.current.length > 0) {
       allFramesRef.current.push({ time: 0, angles: latestAnglesRef.current });
    }

    if (allFramesRef.current.length === 0) {
      alert("No motion data captured. Please play the video for a few seconds.");
      return;
    }

    setIsGeneratingReport(true);

    try {
      const templates = getAllTemplates(analysisType);
      const activeTemplate = templates[0]; 

      let finalInputForScoring: AngleData[] = [];
      let detectedHandness = 'right'; // 默认值

      // === 分支逻辑：运球 vs 投篮 ===
      if (analysisType === "dribbling") {
         const dFrames = dribbleFramesRef.current;
         
         // 只有当运球数据足够多时，才进行复杂的 Cycle 分析
         if (dFrames.length > 10) {
            // 1. 调用 DribbleCalculator (计算周期、一致性等)
            const { computedValues, handUsed } = aggregateDribbleSequence(dFrames, activeTemplate);
            detectedHandness = handUsed;

            console.log("🏀 [Debug] Dribble Computed:", computedValues, "Hand:", handUsed);

            // 2. 将计算结果 (Map) 转换为 AngleData[] 格式
            const dynamicMetrics: AngleData[] = Object.entries(computedValues).map(([key, val]) => ({
               name: key, 
               value: val,
               unit: "calc"
            }));

            // 3. 计算 Posture 类指标 (从 allFramesRef 取平均值)
            const staticMetrics = aggregateFrames(allFramesRef.current);

            // 4. 合并两者
            finalInputForScoring = [...staticMetrics, ...dynamicMetrics];
         } else {
            // 数据不足时的兜底 (只算 Posture)
            console.warn("Not enough dribble frames for cycle analysis. Fallback to static avg.");
            finalInputForScoring = aggregateFrames(allFramesRef.current);
         }
      } else {
         // === 投篮逻辑 (保持不变) ===
         finalInputForScoring = aggregateFrames(allFramesRef.current);
      }
      
      console.log("📊 [Debug] Final Scoring Input:", finalInputForScoring);

      // 5. 调用评分引擎 (传入 detectedHandness 用于 rangeByOption)
      const realScoreResult = calculateRealScore(
        activeTemplate, 
        finalInputForScoring,
        { handedness: detectedHandness } // 支持 scoring.ts 的第三个参数
      );

      // 6. 存入 Store (包含 timeline)
      setAnalysisResult({
        videoUrl: videoUrl,
        angles: finalInputForScoring,    // 混合后的数据(用于 Report 展示结果)
        timeline: allFramesRef.current,  // 原始时序数据(用于 Report 画折线图)
        score: realScoreResult,
        template: activeTemplate
      });

      router.push(routes.pose2d.report);

    } catch (error) {
      console.error("Analysis failed:", error);
      alert("Analysis failed. See console for details.");
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
                
                // ✅ [关键修改 3] 传递稳定的回调函数
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
              onScrub={(sec) => { setCurrentTime(sec); }} 
              onScrubEnd={(sec) => {
                setPendingSeek(sec);
                setTimeout(() => setPendingSeek(null), 0);
              }}
            />
            <div className="mt-4 flex justify-between items-center">
               <Controls
                  isPlaying={isPlaying}
                  onTogglePlay={() => setIsPlaying(p => !p)}
                  onClear={onClear}
               />
               
               {/* [New] 生成报告按钮 */}
               <Button 
                 onClick={handleGenerateReport} 
                 disabled={isGeneratingReport || isProcessing}
                 className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2 shadow-lg shadow-indigo-500/20"
               >
                 {isGeneratingReport ? "Calculating..." : "View Analysis Report"}
                 {!isGeneratingReport && <ArrowRight className="w-4 h-4" />}
               </Button>
            </div>
          </div>
      </div>
      
      {/* 右侧 (col-span-1): 分析数据面板 */}
      <div className="lg:col-span-1 h-[600px] hidden lg:block">
         {/* [Modified] 传入 displayAngles State */}
         <AngleDisplayCard 
            title="Real-time Metrics" 
            angles={displayAngles} 
         />
      </div>
    </div>
  );
}