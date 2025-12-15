"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import globalConfig from "@/config/templates/global.json";
import { getAllTemplates, getTemplateById, ActionTemplate } from "@/config/templates";
import { calculateRealScore, ScoreResult, Grade } from "@/lib/scoring";
import { useAnalysisStore } from "@/store/analysisStore";
import MetricTimelineCard from "@/components/Pose2D/MetricTimelineCard";
import { ChevronLeft, Share2, Download, Activity, CheckCircle2, AlertCircle } from "lucide-react";

type CSSVarStyle = React.CSSProperties & Record<`--${string}`, string | number>;

function getLocalGrade(score: number): Grade {
  if (score >= 90) return "S";
  if (score >= 85) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}

type Tone = {
  accent: string;
  cardBg: string;
  borderClass: string;
  led: string; // "r g b"
  badgeClass: string;
};

const gradeTone = (g: Grade): Tone => {
  if (g === "S") {
    return {
      accent: "#E8C547",
      cardBg: "#A66B00",
      borderClass: "border-amber-300/80",
      led: "232 197 71",
      badgeClass: "bg-amber-300/15 text-amber-50 border-amber-200/60",
    };
  }
  if (g === "F") {
    return {
      accent: "#E35757",
      cardBg: "#7F1D1D",
      borderClass: "border-red-400/80",
      led: "227 87 87",
      badgeClass: "bg-red-400/20 text-red-50 border-red-300/70",
    };
  }
  if (g === "A" || g === "B") {
    return {
      accent: "#22C55E",
      cardBg: "#065F46",
      borderClass: "border-emerald-400/80",
      led: "34 197 94",
      badgeClass: "bg-emerald-400/20 text-emerald-50 border-emerald-300/70",
    };
  }
  // C / D
  return {
    accent: "#3B82F6",
    cardBg: "#1D4ED8",
    borderClass: "border-blue-400/80",
    led: "59 130 246",
    badgeClass: "bg-blue-400/20 text-blue-50 border-blue-300/70",
  };
};

const ScoreCard = ({
  title,
  score,
  weight,
  icon: Icon,
}: {
  title: string;
  score: number;
  weight?: number;
  icon: React.ComponentType<{ className?: string }>;
}) => {
  const grade = getLocalGrade(score);
  const tone = gradeTone(grade);
  const num = Math.round(score);

  return (
    <Card
      className={cn(
        "group relative overflow-hidden rounded-2xl border shadow-sm transition-all",
        "card-energy text-white",
        "hover:-translate-y-[1px] hover:shadow-lg",
        tone.borderClass
      )}
      style={
        {
          "--cardBase": tone.cardBg,
          "--sheen": tone.led,
        } as CSSVarStyle
      }
    >
      <CardContent className="relative z-[1] p-3 sm:p-4 flex flex-col justify-between h-full">
        <div className="flex justify-between items-start mb-2 sm:mb-3">
          <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.22em] text-white/80 flex items-center gap-1.5">
            <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5 opacity-80" />
            {title}
          </span>
          {weight !== undefined && (
            <Badge
              variant="outline"
              className="text-[9px] sm:text-[10px] font-semibold rounded-md border-white/30 bg-white/10 text-white/80 px-1.5 py-0"
            >
              {(weight * 100).toFixed(0)}%
            </Badge>
          )}
        </div>

        <div className="flex items-baseline gap-2 mt-auto">
          <span
            className="text-2xl sm:text-3xl font-black tabular-nums led-num led-strong"
            data-text={String(num)}
            style={
              {
                "--led": tone.led,
              } as CSSVarStyle
            }
          >
            {num}
          </span>
          <Badge
            className={cn(
              "h-5 sm:h-6 px-1.5 sm:px-2 text-[9px] sm:text-[10px] font-extrabold rounded-md border",
              tone.badgeClass
            )}
          >
            {grade}
          </Badge>
        </div>

        <div className="mt-3 sm:mt-4">
          <div className="h-1.5 sm:h-2 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${Math.max(0, Math.min(100, score))}%`,
                background: tone.accent,
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function ReportPage() {
  const { currentScore, currentAngles, currentVideoUrl, currentTemplate, currentTimeline } =
    useAnalysisStore();

  const [ageGroup, setAgeGroup] = useState<string>("16-18");
  const [selectedMode, setSelectedMode] = useState<"shooting" | "dribbling">("dribbling");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => setIsMounted(true), []);

  useEffect(() => {
    if (currentTemplate) {
      setSelectedMode(currentTemplate.mode);
      setSelectedTemplateId(currentTemplate.templateId);
    }
  }, [currentTemplate]);

  const templates: ActionTemplate[] = getAllTemplates(selectedMode);

  useEffect(() => {
    if (templates && templates.length > 0) {
      const currentExists = templates.find((t) => t.templateId === selectedTemplateId);
      if (!selectedTemplateId || !currentExists) {
        if (templates[0]) setSelectedTemplateId(templates[0].templateId);
      }
    } else {
      setSelectedTemplateId("");
    }
  }, [selectedMode, templates, selectedTemplateId]);

  // scoring logic
  useEffect(() => {
    if (selectedTemplateId && currentAngles && currentAngles.length > 0) {
      const template = getTemplateById(selectedTemplateId);
      if (template) {
        const realResult = calculateRealScore(template, currentAngles, {
          ageGroup,
          handedness: "right",
        });
        setResult(realResult);
      }
    } else if (currentAngles && currentAngles.length > 0 && !result && currentScore) {
      setResult(currentScore);
    }
  }, [selectedTemplateId, currentAngles, currentScore, ageGroup]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isMounted) return null;

  const overallGrade: Grade = result ? result.grade : "F";
  const overallTone = gradeTone(overallGrade);
  const overallNum = result ? Math.round(result.overall) : 0;

  return (
    <div className="min-h-screen bg-[#F4F4F4] text-slate-900 font-sans pb-20 relative overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 tech-grid opacity-[0.35]" />

      {/* [UI调整] Header: 在移动端减少 padding, 隐藏非核心按钮 
      */}
      <header className="border-b border-[#E35757]/20 bg-[#E35757] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button
              variant="ghost"
              size="icon"
              asChild
              className="text-white hover:bg-white/10 hover:text-white h-8 w-8 sm:h-10 sm:w-10"
            >
              <Link
                href={selectedMode === "dribbling" ? routes.pose2d.dribbling : routes.pose2d.shooting}
              >
                <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
              </Link>
            </Button>
            <div>
              <h1 className="text-base sm:text-lg font-extrabold text-white leading-tight">Analysis Report</h1>
              <p className="text-[10px] sm:text-xs text-white/80 hidden sm:block">
                Generated on {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex bg-white rounded-xl p-1 border border-white/30 shadow-sm scale-90 sm:scale-100 origin-right">
              <button
                onClick={() => setSelectedMode("shooting")}
                className={cn(
                  "px-2 sm:px-3 py-1 text-xs rounded-lg transition-all font-semibold",
                  selectedMode === "shooting"
                    ? "bg-[#E35757] text-white shadow"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                Shot
              </button>
              <button
                onClick={() => setSelectedMode("dribbling")}
                className={cn(
                  "px-2 sm:px-3 py-1 text-xs rounded-lg transition-all font-semibold",
                  selectedMode === "dribbling"
                    ? "bg-[#E35757] text-white shadow"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                Dribble
              </button>
            </div>

            {/* 桌面端显示按钮, 移动端隐藏 */}
            <Button
              variant="outline"
              size="sm"
              className="gap-2 hidden md:flex border-white/40 bg-white/90 hover:bg-white text-slate-800"
            >
              <Download className="w-4 h-4" />
              PDF
            </Button>

            {/* 移动端仅显示图标 */}
            <Button
              variant="default"
              size="sm"
              className="gap-2 bg-white text-[#E35757] hover:bg-white/90 h-8 px-2 sm:h-9 sm:px-4"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Share</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6 relative">
        
        {/* [UI调整] Selector Section: Flex布局在移动端自动换行 
        */}
        <section className="rounded-2xl bg-white/90 border border-slate-200 shadow-sm p-3 sm:p-4">
          <div className="flex flex-col md:flex-row md:items-end gap-3 sm:gap-4">
            <div className="w-full md:max-w-sm relative">
              <label className="text-xs text-slate-500 mb-1.5 block ml-1 font-semibold">
                Select Action Template
              </label>
              <div className="relative">
                <select
                  className="w-full appearance-none bg-white border border-slate-200 text-slate-900 text-sm rounded-xl p-2.5 pr-9 focus:ring-2 focus:ring-[#E35757]/25 focus:border-[#E35757] outline-none cursor-pointer hover:border-slate-300 transition-all shadow-sm"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                >
                  {templates.map((t) => (
                    <option key={t.templateId} value={t.templateId}>
                      {t.displayName}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <ChevronLeft className="w-4 h-4 -rotate-90" />
                </div>
              </div>
            </div>

            <div className="w-full md:w-44">
              <label className="text-xs text-slate-500 mb-1.5 block ml-1 font-semibold">
                Age Group
              </label>
              <div className="relative">
                <select
                  className="w-full appearance-none bg-white border border-slate-200 text-slate-900 text-sm rounded-xl p-2.5 pr-9 focus:ring-2 focus:ring-[#E35757]/25 focus:border-[#E35757] outline-none cursor-pointer hover:border-slate-300 transition-all shadow-sm"
                  value={ageGroup}
                  onChange={(e) => setAgeGroup(e.target.value)}
                >
                  {Object.keys(globalConfig.ageToleranceScale).map((age) => (
                    <option key={age} value={age}>
                      {age} Years
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <ChevronLeft className="w-4 h-4 -rotate-90" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {result ? (
          <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500">
            {/* [UI调整] Score Cards: 手机端2列(grid-cols-2), iPad/Desktop 4列(md:grid-cols-4)
            */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {/* Overall Card */}
              <Card
                className={cn(
                  "col-span-2 md:col-span-1 relative overflow-hidden rounded-2xl border shadow-sm transition-all",
                  "card-energy text-white",
                  "hover:-translate-y-[1px] hover:shadow-lg",
                  overallTone.borderClass
                )}
                style={
                  {
                    "--cardBase": overallTone.cardBg,
                    "--sheen": overallTone.led,
                  } as CSSVarStyle
                }
              >
                <CardContent className="relative z-[1] p-4 sm:p-5 flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg sm:text-xl md:text-2xl font-extrabold tracking-[0.18em] leading-tight text-white/90 uppercase">
                        OVERALL
                      </h3>
                      <Badge
                        className={cn(
                          "text-[10px] sm:text-[11px] px-2 py-0.5 font-extrabold rounded-md border",
                          overallTone.badgeClass
                        )}
                      >
                        {result.grade}
                      </Badge>
                    </div>
                    <div className="mt-3 sm:mt-4 flex items-baseline gap-3">
                      <span
                        className="text-4xl sm:text-5xl font-black tracking-tight tabular-nums led-num led-strong"
                        data-text={String(overallNum)}
                        style={
                          {
                            "--led": overallTone.led,
                          } as CSSVarStyle
                        }
                      >
                        {overallNum}
                      </span>
                      <span className="text-[10px] sm:text-xs font-semibold text-white/80">Weighted</span>
                    </div>
                  </div>

                  <div className="mt-3 sm:mt-4 flex items-center gap-2">
                    <div className="h-1.5 sm:h-2 flex-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-1000 ease-out"
                        style={{
                          width: `${result.overall}%`,
                          background: overallTone.accent,
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <ScoreCard
                title="POSTURE"
                score={result.breakdown.posture}
                weight={result.weights.posture}
                icon={Activity}
              />
              <ScoreCard
                title="EXECUTION"
                score={result.breakdown.execution}
                weight={result.weights.execution}
                icon={Activity}
              />
              <ScoreCard
                title="CONSISTENCY"
                score={result.breakdown.consistency}
                weight={result.weights.consistency}
                icon={Activity}
              />
            </section>

            {/* [UI调整] 核心内容区: 
              - 手机端: 单列垂直堆叠 (grid-cols-1)
              - 桌面端: 左右 2:1 分栏 (lg:grid-cols-3)
            */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              
              {/* Left Column (Video + Chart) */}
              <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                <Card className="rounded-2xl bg-white/90 border border-slate-200 overflow-hidden shadow-sm">
                  <CardHeader className="pb-3 border-b border-slate-100 px-4 pt-4">
                    <CardTitle className="text-sm font-semibold text-slate-900 tracking-wide flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[#E35757]" />
                      Analysis Replay{" "}
                      <span className="text-[10px] sm:text-xs font-medium text-slate-500 hidden sm:inline">
                        (recommended: play ~10s)
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <div className="aspect-video bg-black relative flex items-center justify-center">
                    {currentVideoUrl ? (
                      <video
                        src={currentVideoUrl}
                        className="w-full h-full object-contain"
                        controls
                        playsInline
                        loop
                      />
                    ) : (
                      <p className="text-slate-400 text-sm">Video Not Found</p>
                    )}
                  </div>
                </Card>

                {currentTimeline && currentTimeline.length > 0 && (
                  <div className="lightify-timeline rounded-2xl bg-white border border-slate-200 shadow-sm p-0 overflow-visible">
                    <MetricTimelineCard timeline={currentTimeline} templateId={selectedTemplateId} />
                  </div>
                )}
              </div>

              {/* Right Column (Findings List) */}
              <div className="lg:col-span-1">
                <Card className="rounded-2xl bg-white/90 border border-slate-200 h-full shadow-sm flex flex-col overflow-hidden min-h-[400px]">
                  <CardHeader className="pb-3 border-b border-slate-100 px-4 pt-4">
                    <CardTitle className="text-base font-semibold text-slate-900 flex items-center justify-between">
                      <span>Top Findings</span>
                      {result && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] bg-white text-slate-500 border border-slate-200"
                        >
                          {result.findings.length} Issues
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 flex-1 overflow-y-auto max-h-[500px] lg:max-h-[600px] custom-scrollbar">
                    <div className="space-y-0 divide-y divide-slate-100">
                      {result?.findings.map((finding, idx) => {
                        const isBad = finding.score < 70;
                        return (
                          <div key={idx} className="p-3 sm:p-4 hover:bg-slate-50 transition-colors">
                            <div className="flex justify-between items-start mb-2 gap-3">
                              <h4 className="font-semibold text-slate-900 text-sm leading-tight pr-3">
                                {finding.title}
                              </h4>
                              {finding.isPositive ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center gap-2 mb-2.5">
                              <Badge
                                variant="outline"
                                className="text-[9px] sm:text-[10px] px-1.5 py-0 h-4 border-slate-200 text-slate-500 uppercase"
                              >
                                {finding.category}
                              </Badge>
                              <div className="h-3 w-px bg-slate-200" />
                              <span
                                className={cn(
                                  "text-xs font-extrabold",
                                  isBad ? "text-red-600" : "text-amber-600"
                                )}
                              >
                                {finding.score} pts
                              </span>
                            </div>
                            <p className="text-xs text-slate-700 leading-relaxed bg-white p-2 rounded-xl border border-slate-100">
                              {finding.hint}
                            </p>
                          </div>
                        );
                      })}

                      {(!result || result.findings.length === 0) && (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                          <CheckCircle2 className="w-8 h-8 opacity-40" />
                          <p className="text-sm font-semibold">No critical findings found.</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 bg-white/70 rounded-2xl border border-dashed border-slate-300 gap-4">
            <Activity className="w-6 h-6 opacity-40" />
            <p className="text-sm font-semibold text-slate-700">Ready for Analysis</p>
          </div>
        )}
      </main>

      <style jsx global>{`
        /* 背景网格 */
        .tech-grid {
          background-image: linear-gradient(
              to right,
              rgba(169, 169, 169, 0.16) 1px,
              transparent 1px
            ),
            linear-gradient(to bottom, rgba(169, 169, 169, 0.16) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(circle at 35% 20%, rgba(0, 0, 0, 0.9), transparent 70%);
        }

        .card-energy {
          position: relative;
          overflow: hidden;
          isolation: isolate;
          background: transparent;
        }

        .card-energy::before {
          content: "";
          position: absolute;
          inset: -1px;
          background:
            radial-gradient(
              circle at 0% 0%,
              color-mix(in srgb, var(--cardBase) 70%, #000 30%),
              transparent 60%
            ),
            radial-gradient(
              circle at 100% 100%,
              color-mix(in srgb, var(--cardBase) 65%, #000 35%),
              transparent 65%
            ),
            linear-gradient(
              135deg,
              color-mix(in srgb, var(--cardBase) 80%, #000 20%),
              color-mix(in srgb, var(--cardBase) 45%, #000 55%)
            );
          opacity: 0.98;
          z-index: -2;
        }

        @keyframes card-x-sweep {
          0% {
            transform: translate(-20%, 12%) rotate(8deg);
          }
          50% {
            transform: translate(15%, -10%) rotate(8deg);
          }
          100% {
            transform: translate(40%, 18%) rotate(8deg);
          }
        }

        .card-energy::after {
          content: "";
          position: absolute;
          inset: -40%;
          background:
            linear-gradient(
              60deg,
              rgba(255, 255, 255, 0) 0%,
              rgba(255, 255, 255, 0.9) 40%,
              rgba(255, 255, 255, 0) 60%
            ),
            linear-gradient(
              -60deg,
              rgba(255, 255, 255, 0) 0%,
              rgba(255, 255, 255, 0.7) 40%,
              rgba(255, 255, 255, 0) 60%
            );
          mix-blend-mode: screen;
          opacity: 0.25;
          z-index: -1;
          animation: card-x-sweep 9s linear infinite;
        }

        @keyframes led-sweep {
          0% {
            background-position: 0% 50%;
          }
          100% {
            background-position: 220% 50%;
          }
        }

        @keyframes led-flicker {
          0%,
          100% {
            filter: brightness(1);
          }
          2% {
            filter: brightness(0.92);
          }
          4% {
            filter: brightness(1.06);
          }
          7% {
            filter: brightness(0.96);
          }
          10% {
            filter: brightness(1.08);
          }
          55% {
            filter: brightness(0.98);
          }
          58% {
            filter: brightness(1.05);
          }
        }

        .led-num {
          position: relative;
          display: inline-block;
          color: rgb(var(--led));
          text-shadow:
            0 0 12px rgba(var(--led), 0.28),
            0 0 1px rgba(0, 0, 0, 0.18);
          animation: led-flicker 3s steps(1, end) infinite;
        }

        .led-num::after {
          content: attr(data-text);
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.9) 18%,
            rgba(255, 255, 255, 0) 36%,
            rgba(255, 255, 255, 0.6) 52%,
            rgba(255, 255, 255, 0) 70%,
            rgba(255, 255, 255, 0.8) 86%,
            rgba(255, 255, 255, 0) 100%
          );
          background-size: 220% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          opacity: 0.9;
          mix-blend-mode: screen;
          animation: led-sweep 6.5s linear infinite;
        }

        .led-strong {
          text-shadow:
            0 0 20px rgba(var(--led), 0.36),
            0 0 3px rgba(0, 0, 0, 0.2);
        }

        .lightify-timeline
          :is(
            [class*="bg-slate-"],
            [class*="bg-zinc-"],
            [class*="bg-neutral-"],
            [class*="bg-gray-"]
          ) {
          background-color: white !important;
        }
        .lightify-timeline
          :is(
            [class*="text-white"],
            [class*="text-slate-"],
            [class*="text-zinc-"],
            [class*="text-neutral-"],
            [class*="text-gray-"]
          ) {
          color: #111827 !important;
        }
        .lightify-timeline
          :is(
            [class*="border-slate-"],
            [class*="border-zinc-"],
            [class*="border-neutral-"],
            [class*="border-gray-"]
          ) {
          border-color: #e5e7eb !important;
        }
      `}</style>
    </div>
  );
}