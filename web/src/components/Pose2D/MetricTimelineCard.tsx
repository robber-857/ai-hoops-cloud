"use client";

import React, { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Activity, Info } from "lucide-react";
import { FrameSample } from "@/store/analysisStore";

// --- 1. 针对孩子的通俗解释配置 ---
// 这里定义你想要可视化的指标，以及对应的“儿童语言”
const METRIC_CONFIG: Record<string, { label: string; desc: string; color: string; domain?: [number, number] }> = {
  // 运球高度 (相对于肩/髋)
  wristHeightRatioToShoulder: {
    label: "🏀 Dribble Height",
    desc: "See how high the ball goes? Keep the line low and steady (like a flat road, not a roller coaster)!",
    color: "#38bdf8", // Sky Blue
    domain: [0, 1] // 0=Hip, 1=Shoulder
  },
  wristHeightRatioToHip: {
    label: "🏀 Dribble Height",
    desc: "Keep the ball below your waist line for better control.",
    color: "#38bdf8",
    domain: [-0.5, 1]
  },
  // 膝盖角度
  kneeAngleDeg: {
    label: "🦵 Knee Bend",
    desc: "Large fluctuations in angle indicate that the child's knees are frequently changing direction or shaking while dribbling. It is recommended to stabilize posture during dribbling practice.",
    color: "#34d399", // Emerald
    domain: [90, 180]
  },
  // 站距
  shoulderStanceRatio: {
    label: "👣 Feet Width",
    desc: "Wide feet make you strong. Keep this line steady around 2.0 (double your shoulder width).When selecting a forward template, the volatility of this indicator represents the swing of a child's shoulder or foot while dribbling.",
    color: "#fbbf24", // Amber
    domain: [0, 4]
  },
  // 护球手
  guideHandInChestBoxRate: {
    label: "🛡️ Guard Hand",
    desc: "Where is your other hand? Keep it up (value 1) to protect the ball!",
    color: "#f472b6", // Pink
    domain: [0, 1.2]
  },
  // 前臂垂直度
  forearmVerticalDeg: {
    label: "💪 Arm Angle",
    desc: "Keep your arm straight up and down when pushing the ball.",
    color: "#a78bfa", // Violet
    domain: [0, 90]
  }
};

interface Props {
  timeline: FrameSample[];
  templateId: string; // 暂时可能用不到，但为了扩展性保留
}

export default function MetricTimelineCard({ timeline, templateId }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // --- 2. 智能筛选可展示的指标 ---
  // 从 timeline 数据中找出我们 Config 里定义过的、且实际存在的指标 keys
  const availableMetrics = useMemo(() => {
    if (!timeline || timeline.length === 0) return [];
    
    // 检查第一帧数据包含哪些 key
    const firstFrameAngles = timeline[0].angles;
    const keys = firstFrameAngles.map(a => a.name);
    
    // 过滤出我们在 METRIC_CONFIG 里配置过的 Key
    return keys.filter(k => METRIC_CONFIG[k]);
  }, [timeline]);

  // 当前选中的 Key
  const activeKey = availableMetrics[currentIndex] || "";
  const config = METRIC_CONFIG[activeKey];

  // --- 3. 数据转换 ---
  const chartData = useMemo(() => {
    if (!timeline) return [];
    // 每 3 帧取样一次，减少图表噪点，提高性能
    return timeline.filter((_, i) => i % 3 === 0).map((frame) => {
      const metric = frame.angles.find((a) => a.name === activeKey);
      return {
        time: frame.time.toFixed(1), // X轴：时间
        value: metric ? metric.value : 0 // Y轴：数值
      };
    });
  }, [timeline, activeKey]);

  // --- 翻页处理 ---
  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % availableMetrics.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + availableMetrics.length) % availableMetrics.length);
  };

  if (availableMetrics.length === 0) return null;

  return (
    <Card className="bg-slate-900/50 border-slate-800 overflow-hidden shadow-sm">
      <CardHeader className="pb-2 border-b border-slate-800/50 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-slate-300 uppercase tracking-wide flex items-center gap-2">
          <Activity className="w-4 h-4 text-sky-500" /> 
          Performance Curves
        </CardTitle>
        
        {/* 翻页控制区 */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-white" onClick={handlePrev}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs text-slate-500 font-mono">
            {currentIndex + 1} / {availableMetrics.length}
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-white" onClick={handleNext}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row gap-6">
          
          {/* 左侧：图表区域 */}
          <div className="flex-1 h-[200px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis 
                  dataKey="time" 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  tickLine={false}
                  axisLine={false}
                  minTickGap={30}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  domain={config.domain || ['auto', 'auto']}
                  hide // 隐藏Y轴刻度，让界面更干净，靠Tooltip看数值
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                  itemStyle={{ color: config.color }}
                  labelStyle={{ color: '#94a3b8' }}
                  formatter={(value: number) => [value.toFixed(2), config.label]}
                />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke={config.color} 
                  strokeWidth={3} 
                  dot={false}
                  activeDot={{ r: 6, fill: config.color }}
                  animationDuration={1500}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 右侧：解说区域 (Kid Friendly) */}
          <div className="md:w-1/3 flex flex-col justify-center space-y-3 bg-slate-950/30 p-4 rounded-xl border border-slate-800/50">
            <div>
              <h4 className="text-lg font-bold text-white flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: config.color }}></span>
                {config.label}
              </h4>
              <p className="text-xs text-slate-500 mt-1 font-mono">
                {activeKey}
              </p>
            </div>
            
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-sky-500 mt-0.5 shrink-0" />
              <p className="text-sm text-slate-300 leading-relaxed">
                {config.desc}
              </p>
            </div>

            {/* 这里可以加一个简单的状态指示器 */}
            <div className="pt-2">
               <div className="text-[10px] uppercase text-slate-500 mb-1">Consistency Goal</div>
               <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                 {/* 模拟一个进度条，或者是装饰性的 */}
                 <div className="h-full bg-emerald-500/50 w-2/3 rounded-full"></div>
               </div>
            </div>
          </div>

        </div>
      </CardContent>
    </Card>
  );
}