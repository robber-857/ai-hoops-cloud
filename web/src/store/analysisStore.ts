import { create } from 'zustand';
import { ScoreResult, AngleData } from '@/lib/scoring'; // 确保引入 AngleData
import { ActionTemplate } from '@/config/templates/index';
//这个文件用于(Zustand 状态管理：存 currentAngles, currentTimeline)
// [新增] 定义单帧数据结构
export interface FrameSample {
  time: number;
  angles: AngleData[];
}
interface AnalysisState {
  // 核心数据
  currentTimeline: FrameSample[] | null; // 这里存所有帧的原始数据
  currentVideoUrl: string | null;
  currentAngles: AngleData[] | null; //这里存聚合后的数据(平均值)
  currentScore: ScoreResult | null;  // 保存初始分数
  currentTemplate: ActionTemplate | null;
  
  // 动作
  setAnalysisResult: (data: { 
    videoUrl: string; 
    angles: AngleData[]; // [新增]
    timeline: FrameSample[]; // [新增]
    score: ScoreResult; 
    template: ActionTemplate 
  }) => void;
  
  clearAnalysis: () => void;
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  currentVideoUrl: null,
  currentAngles: null,
  currentTimeline: null, 
  currentScore: null,
  currentTemplate: null,

  setAnalysisResult: (data) => set({
    currentVideoUrl: data.videoUrl,
    currentAngles: data.angles, 
    currentTimeline: data.timeline,
    currentScore: data.score,
    currentTemplate: data.template
  }),

  clearAnalysis: () => set({ 
    currentVideoUrl: null, 
    currentAngles: null,
    currentScore: null, 
    currentTemplate: null 
  })
}));