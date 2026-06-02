"use client";

import React, { useRef, useEffect, useState } from "react";
import { useMediaPipePose } from "@/hooks/useMediaPipePose";
import type { Results } from "@mediapipe/pose";
// 导入类型定义，避免循环依赖建议使用 import type
import type { AnalysisType, AngleData } from "./types";
import { extractDribbleFrame, DribbleFrame } from "@/lib/dribbleTemporal";
import { calculateAndDrawAngles } from "@/lib/angles2d";
import { FACE_IDX, extractPoseAngles } from "./poseMetrics";

interface Pose2DCanvasProps {
  videoUrl: string;
  isPlaying: boolean;
  onVideoEnd: () => void;
  onTime?: (current: number, duration: number) => void;
  seekTo?: { time: number; requestId: number } | null;
  analysisType: AnalysisType;
  onProcessing: (isProcessing: boolean) => void;
  onAnglesUpdate: (angles: AngleData[], time: number) => void;// 加了time 参数
  onFrameCaptured?: (frame: DribbleFrame) => void;// 新增一个回调专门传原始帧数据
}
export default function Pose2DCanvas({ videoUrl, isPlaying, onVideoEnd, onTime, seekTo, analysisType,
  onAnglesUpdate, onProcessing,onFrameCaptured}: Pose2DCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { isReady, error, pose, drawingUtils, connections } = useMediaPipePose();

  const [ratio, setRatio] = useState<string>("16 / 9");
  const dprRef = useRef(1);

  function resizeCanvasToBox() {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const rect = wrap.getBoundingClientRect();          // 盒子 CSS 尺寸
    const dpr = window.devicePixelRatio || 1;
    dprRef.current = dpr;

    // ① 只设置画布像素尺寸，不要对 ctx 再 setTransform（关键改动）
    canvas.width  = Math.max(1, Math.round(rect.width  * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
  }
//监听视频元数据以设定比例
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onMeta = () => {
      setRatio(`${v.videoWidth} / ${v.videoHeight}`);
      resizeCanvasToBox();
    };
    v.addEventListener("loadedmetadata", onMeta, { once: true });
    return () => v.removeEventListener("loadedmetadata", onMeta);
  }, [videoUrl]);

  // ：时间相关事件 —— 上报当前时间与总时长；seek 后在暂停态渲染一帧
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const report = () => {
    const dur = Number.isFinite(v.duration) ? v.duration : 0;
    onTime?.(v.currentTime || 0, dur);
  };

    const handleLoadedMeta = () => {
      // 元数据就绪时先上报一次
      report();
    };

    const handleTimeUpdate = () => {
    // 播放时浏览器会持续触发
      report();
    };

    const handleEnded = () => {
      // 结束时把时间钉到尾部，并通知父层
      const dur = Number.isFinite(v.duration) ? v.duration : 0;
      onTime?.(dur, dur);
      onVideoEnd?.();
    };

    const handleSeeked = async () => {
    // 若当前是“暂停”，seek 后也要渲染一帧，确保画面/骨架更新
      if (!isPlaying && pose) {
        try { await pose.send({ image: v }); } catch {}
      }
      report();
    };

    v.addEventListener('loadedmetadata', handleLoadedMeta);
    v.addEventListener('timeupdate', handleTimeUpdate);
    v.addEventListener('ended', handleEnded);
    v.addEventListener('seeked', handleSeeked);

  // 若元数据已就绪（用户快速切源等），立即补一次
   if (v.readyState >= 1) report();

    return () => {
      v.removeEventListener('loadedmetadata', handleLoadedMeta);
      v.removeEventListener('timeupdate', handleTimeUpdate);
      v.removeEventListener('ended', handleEnded);
      v.removeEventListener('seeked', handleSeeked);
   };
  }, [videoUrl, onTime, onVideoEnd, isPlaying, pose]);

  // External seek request from the scrubber.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!seekTo || !Number.isFinite(seekTo.time)) return;

    const duration = Number.isFinite(v.duration) ? v.duration : undefined;
    const dst = Math.max(0, duration != null ? Math.min(seekTo.time, duration) : seekTo.time);

    try {
      v.currentTime = dst;
      onTime?.(dst, duration ?? 0);
    } catch {
    // 某些环境在 metadata 未就绪前不允许 seek，可忽略或延后
    }
  }, [seekTo, onTime]);

  
//窗口尺寸变化时重建画布像素
  useEffect(() => {
    const onResize = () => resizeCanvasToBox();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!pose) return;

    const handleResults = (results: Results) => {
      
      // console.log('handleResults called', { hasLandmarks: !!results.poseLandmarks, drawingUtils, connections });
      const canvas = canvasRef.current!;
      // [新增] 获取当前视频时间
      const video = videoRef.current!;
      const currentTime = video ? video.currentTime : 0;
      const ctx = canvas.getContext("2d")!;
      // ② 绘制全部使用“设备像素”尺寸（canvas.width/height）
      const W = canvas.width;
      const H = canvas.height;

      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(video, 0, 0, W, H);
      const landmarks = results.poseLandmarks;
      if (landmarks && drawingUtils && connections) {
        //过滤掉脸部的关键点和连线
        const connectionsNoFace = connections.filter(([a, b]) => !FACE_IDX.has(a) && !FACE_IDX.has(b));
        drawingUtils.drawConnectors(ctx, results.poseLandmarks, connectionsNoFace, {color: "#0ea5e9", lineWidth: 3});
        const landmarksNoFace = results.poseLandmarks.filter((_, i) => !FACE_IDX.has(i));
        drawingUtils.drawLandmarks(ctx, landmarksNoFace, {color: "#e11d48", lineWidth: 2, radius: 4});
      
        //只有在有 pose 关键点（results.poseLandmarks）并且 MediaPipe 的绘制工具（drawingUtils）
        // 和连接数组（connections）就绪时才绘制骨架与关键点，防止空指针或未初始化调用。
        //1.使用 MediaPipe 的工具在画布上绘制骨架连线（关节之间的边），
        // connections 指定哪些关节相连，传入样式选项控制颜色和线宽
        //2.在骨架线上绘制每个关键点（小圆点），用指定颜色、线宽与半径突出显示关节点。
        calculateAndDrawAngles(ctx, results.poseLandmarks);
        //3.调用自定义函数计算并绘制关节角度/注释
        // 如果它期望“像素坐标”，用下面这一行替换成像素后再传入：
        // const px = results.poseLandmarks.map(p => ({ ...p, x: p.x * W, y: p.y * H }));
        // calculateAndDrawAngles(ctx, px as any);
        const newAngleData = extractPoseAngles(landmarks, analysisType);
        if (
          (analysisType === "dribbling" || analysisType === "training") &&
          results.poseLandmarks &&
          onFrameCaptured
        ) {
          onFrameCaptured(extractDribbleFrame(results.poseLandmarks, currentTime));
        }
        onAnglesUpdate(newAngleData, currentTime); // 回传给父组件显示
      } else {
        onAnglesUpdate([], currentTime);//或者可以改0
      }
    };

    //推理结果回调
    //绘制顺序：清屏 → 画视频帧 → 画骨架 → 画角度注释。
    //坐标体系：canvas.width/height 使用设备像素，因此 drawImage 和骨架覆盖都与像素一一对应（不会因 CSS 缩放模糊）。
    //归一化 vs 像素：MediaPipe 的 poseLandmarks 通常是 0~1 的归一化值；你的角度计算函数若吃归一化坐标就直接传，否则先映射到像素再传。
    
    pose.onResults(handleResults);
  }, [pose, drawingUtils, connections,analysisType, onAnglesUpdate,onFrameCaptured]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isReady || !pose) {
      onProcessing(false);
      return;
    }

    let raf = 0;
    let stopped = false;
    const loop = async () => {
      // ③ 侦测 dpr 改变（浏览器缩放会触发），变了就立刻重设画布尺寸
      const cur = window.devicePixelRatio || 1;
      if (Math.abs(cur - dprRef.current) > 1e-3) {
        resizeCanvasToBox();
      }
      //如果视频还在播，把当前帧送入 MediaPipe
      //如果暂停/结束，不再排队新的 requestAnimationFrame
      if (!stopped && !v.paused && !v.ended) {
        try {
          await pose.send({ image: v });
        } catch (err) {
          console.error("Pose frame processing failed:", err);
        }
        raf = requestAnimationFrame(loop);
      } else {
        onProcessing(false);
      }
    };
//播放/推理循环
    if (isPlaying) {
      onProcessing(true);
      v.play().catch((err) => {
        onProcessing(false);
        if (err?.name !== "AbortError") console.error("Video play error:", err);
      });
      raf = requestAnimationFrame(loop);
    } else {
      v.pause();
      onProcessing(false);
    }
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      onProcessing(false);
    };
  }, [isPlaying, isReady, pose, onProcessing]);

  return (
    <div
      ref={wrapRef}
      className="relative w-full max-w-5xl max-h-[calc(100vh-220px)] mx-auto rounded-xl overflow-hidden shadow-2xl bg-black"
      style={{ aspectRatio: ratio || '16 / 9' }}
    >
      {error && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-red-900/80 backdrop-blur">
          <div className="text-center">
            <h3 className="text-lg font-semibold">Loading failed</h3>
            <p className="text-sm opacity-80 mt-1">{error}</p>
          </div>
        </div>
      )}
      {!isReady && !error && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-black/40 backdrop-blur">
          <p>Loading analysis engine</p>
        </div>
      )}

      {/* video 只是帧源，隐藏；object-contain 保证不变形 */}
      <video
        ref={videoRef}
        src={videoUrl}
        className="absolute inset-0 w-full h-full object-contain opacity-0"
        playsInline
        muted
        preload="metadata"
        crossOrigin="anonymous"
      />

      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
    </div>
  );
}
