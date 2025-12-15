"use client";

import { useState, useEffect, useRef } from 'react';
import type { Pose as PoseType, Results, PoseConfig, LandmarkConnectionArray, NormalizedLandmarkList } from '@mediapipe/pose';

// 为动态加载的全局变量提供类型定义
declare global {
  interface Window {
    Pose: new (config?: PoseConfig) => PoseType;//声明 window 上会有一个构造器 Pose，用来实例化 MediaPipe Pose
    POSE_CONNECTIONS: LandmarkConnectionArray;//声明连接关系数组（关节索引对）
    drawConnectors: (ctx: CanvasRenderingContext2D, landmarks: NormalizedLandmarkList, connections: LandmarkConnectionArray, options: Record<string, unknown>) => void;
    drawLandmarks: (ctx: CanvasRenderingContext2D, landmarks: NormalizedLandmarkList, options: Record<string, unknown>) => void;
    //声明绘图工具的全局函数签名drawConnectors和drawLandmarks（canvas 绘制辅助函数）。
  }
}

// 辅助函数：加载脚本
// 动态注入脚本：避免重复加载
const loadScript = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      return resolve();
    }
    const script = document.createElement('script');
    script.src = src;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = (err) => reject(new Error(`Script load error for ${src}: ${err}`));
    document.body.appendChild(script);
  });
};
//轮询等待全局对象：waitForGlobal<T>(name) 每 100ms 检查一次，默认 3s 超时。
// 辅助函数：轮询检查全局变量是否可用
const waitForGlobal = <T>(name: string, timeout = 3000): Promise<T> => {
    return new Promise((resolve, reject) => {
        let waited = 0;
        const interval = 100;
        const check = () => {
            // 修复：显式地将 window[name] 转换为 any，然后再断言为 T，以解决 implicit any 错误
            const globalVar = (window as unknown as Record<string, unknown>)[name];
            if (globalVar) {
                resolve(globalVar as T);
            } else if (waited >= timeout) {
                reject(new Error(`Timed out waiting for global variable "${name}"`));
            } else {
                waited += interval;
                setTimeout(check, interval);
            }
        };
        check();
    });
};

//HOOK主体
export function useMediaPipePose() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  //布尔状态，表示 MediaPipe 已成功初始化并可以使用；组件用它来决定何时开始发送帧进行推理。
  const poseRef = useRef<PoseType | null>(null);//保存 Pose 实例；
  const drawingUtilsRef = useRef<{
      drawConnectors: typeof window.drawConnectors,
      drawLandmarks: typeof window.drawLandmarks
  } | null>(null);
  const connectionsRef = useRef<LandmarkConnectionArray | null>(null);
  //保存 POSE_CONNECTIONS；以及 UI 状态 isReady/error

//并行加载两段脚本：@mediapipe/drawing_utils 和 @mediapipe/pose
  useEffect(() => {
    let isActive = true;

    const initialize = async () => {
      try {
        // 加载 UMD 版本的脚本
        await Promise.all([
          loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js'),
          loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js'),
        ]);

        // 等待全局变量挂载完成
        const [Pose, drawConnectors, drawLandmarks, POSE_CONNECTIONS] = await Promise.all([
            waitForGlobal<typeof window.Pose>('Pose'),
            waitForGlobal<typeof window.drawConnectors>('drawConnectors'),
            waitForGlobal<typeof window.drawLandmarks>('drawLandmarks'),
            waitForGlobal<typeof window.POSE_CONNECTIONS>('POSE_CONNECTIONS'),
        ]);
        
        if (!isActive) return;
        //创建 Pose 实例与配置
        //通过 locateFile 指向 CDN，省去本地模型文件托管；
        //设置模型复杂度和平滑选项以适应大多数应用场景
        //modelComplexity 取 1（在精度与速度间折中），smoothLandmarks 开启平滑，min*Confidence 设为 0.5 起步。
        const pose = new Pose({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
        });

        pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        
        poseRef.current = pose;
        drawingUtilsRef.current = { drawConnectors, drawLandmarks };
        connectionsRef.current = POSE_CONNECTIONS;

        setIsReady(true);
        
      } catch (err) {
        console.error("Failed to load or initialize MediaPipe modules:", err);
        if (isActive) {
          setError(err instanceof Error ? err.message : 'An unknown error occurred during initialization.');
        }
      }
    };

    initialize();
    // 清理函数
    return () => {
      isActive = false;
      poseRef.current?.close();
    };
  }, []);
  //返回 Pose 实例、绘图工具、连接数组和状态
  //给消费方（Pose2DCanvas）使用，判断就绪、绘制骨架与连线、触发 pose.onResults() 等。
  return { 
    isReady, 
    error,
    pose: poseRef.current,
    drawingUtils: drawingUtilsRef.current,
    connections: connectionsRef.current,
  };
}

