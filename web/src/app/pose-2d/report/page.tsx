// src/app/pose-2d/report/page.tsx

"use client";

import React, { useState, useEffect, Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation"; 
import { AccountEntryButton } from "@/components/account/AccountEntryButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import globalConfig from "@/config/templates/global.json";
import { getAllTemplates, getTemplateById, ActionTemplate } from "@/config/templates";
import { calculateRealScore, ScoreResult, Grade, AngleData } from "@/lib/scoring";
import { useAnalysisStore, FrameSample } from "@/store/analysisStore";
import MetricTimelineCard from "@/components/Pose2D/MetricTimelineCard";
import { ChevronLeft, Share2, Download, Activity, CheckCircle2, AlertCircle, Check, Link as LinkIcon, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient"; 
import Image from "next/image";

// --- 1. 类型定义与扩展 ---

/** 解决 CSS 变量类型报错 */
interface ExtendedCSS extends React.CSSProperties {
  "--cardBase"?: string;
  "--sheen"?: string;
  "--led"?: string;
}

interface ScoreCardProps {
  title: string;
  score: number;
  weight?: number;
  icon: React.ComponentType<{ className?: string }>;
}

type Tone = {
  accent: string;
  cardBg: string;
  borderClass: string;
  led: string;
  badgeClass: string;
};

// --- 2. 顶层工具函数 ---

/** 修复 gradeTone 作用域 */
const getGradeTone = (g: Grade): Tone => {
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
  return {
    accent: "#3B82F6",
    cardBg: "#1D4ED8",
    borderClass: "border-blue-400/80",
    led: "59 130 246",
    badgeClass: "bg-blue-400/20 text-blue-50 border-blue-300/70",
  };
};

function getLocalGrade(score: number): Grade {
  if (score >= 90) return "S";
  if (score >= 85) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}

// --- 3. 内部组件 ---

const ScoreCard: React.FC<ScoreCardProps> = ({ title, score, weight, icon: Icon }) => {
  const grade = getLocalGrade(score);
  const tone = getGradeTone(grade);
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
        } as ExtendedCSS
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
              } as ExtendedCSS
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

// --- 4. 报告页面主体 ---

function ReportContent() {
  const { currentScore, currentAngles, currentVideoUrl, currentTemplate, currentTimeline } = useAnalysisStore();

  const searchParams = useSearchParams();
  const reportId = searchParams.get('id');

  const [ageGroup, setAgeGroup] = useState<string>("16-18");
  const [selectedMode, setSelectedMode] = useState<ActionTemplate['mode']>("dribbling");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  
  // Local Result
  const [result, setResult] = useState<ScoreResult | null>(null);

  // Cloud Result
  const [dbResult, setDbResult] = useState<ScoreResult | null>(null);
  
  // [Fix] 修复 any[] 报错，使用正确的 FrameSample[] 类型
  const [dbTimeline, setDbTimeline] = useState<FrameSample[] | null>(null); 
  const [dbVideoUrl, setDbVideoUrl] = useState<string | null>(null);
  const [dbSavedMetrics, setDbSavedMetrics] = useState<AngleData[] | null>(null);

  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => setIsMounted(true), []);

  // 1. 初始化模板 (本地模式)
  useEffect(() => {
    if (currentTemplate && !reportId) {
      setSelectedMode(currentTemplate.mode);
      setSelectedTemplateId(currentTemplate.templateId);
    }
  }, [currentTemplate, reportId]);

  const templates = useMemo(() => getAllTemplates(selectedMode), [selectedMode]);

  // 2. 确保模板 ID 有效
  useEffect(() => {
    if (reportId) return; 

    if (templates && templates.length > 0) {
      const currentExists = templates.find((t) => t.templateId === selectedTemplateId);
      if (!selectedTemplateId || !currentExists) {
        if (templates[0]) setSelectedTemplateId(templates[0].templateId);
      }
    }
  }, [templates, selectedTemplateId, reportId]);

  // 3. 核心评分逻辑 (Scheme B: 直接复用全量 saved_metrics)
  useEffect(() => {
    // 本地即时计算
    if (!reportId && currentAngles && currentAngles.length > 0) {
        const template = getTemplateById(selectedTemplateId);
        if (template) {
          setResult(calculateRealScore(template, currentAngles, { ageGroup, handedness: "right" }));
        }
    }
    
    // 云端重算 (切模板直接出分)
    if (reportId && dbSavedMetrics && selectedTemplateId) {
        const template = getTemplateById(selectedTemplateId);
        if (template) {
          setDbResult(calculateRealScore(template, dbSavedMetrics, { ageGroup, handedness: "right" }));
        }
    }
  }, [selectedTemplateId, currentAngles, ageGroup, reportId, dbSavedMetrics]);

  // 4. 加载 Supabase 云端报告
  useEffect(() => {
    if (!reportId) return;

    async function fetchReport() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('analysis_reports')
          .select('*')
          .eq('id', reportId)
          .single();

        if (error || !data) {
          console.error("Report fetch failed");
        } else {
          setDbResult(data.score_data);
          setDbTimeline(data.timeline_data as FrameSample[]);
          setDbVideoUrl(data.video_url);

          if (data.score_data?.saved_metrics) {
             setDbSavedMetrics(data.score_data.saved_metrics);
          }

          if (data.template_id) {
            const t = getTemplateById(data.template_id);
            if (t) {
              setSelectedMode(t.mode);
              setSelectedTemplateId(data.template_id);
            }
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, [reportId]);

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const finalResult = reportId ? dbResult : result;
  const finalVideoUrl = reportId ? dbVideoUrl : currentVideoUrl;
  const finalTimeline = reportId ? dbTimeline : currentTimeline;

  // 数据异常提示逻辑
  const isDataMissing = useMemo(() => !finalResult || finalResult.overall <= 0, [finalResult]);

  if (!isMounted) return null;

  if (loading) {
     return (
        <div className="report-shell relative min-h-screen overflow-x-hidden flex items-center justify-center">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(225,29,72,0.24),transparent_24%),radial-gradient(circle_at_84%_12%,rgba(59,130,246,0.18),transparent_22%),radial-gradient(circle_at_52%_58%,rgba(255,255,255,0.05),transparent_34%),linear-gradient(180deg,#05070c_0%,#0a1018_38%,#070b12_100%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:54px_54px] opacity-40" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_82%_52%_at_8%_14%,transparent_0_70%,rgba(255,255,255,0.08)_70.5%_71%,transparent_71.5%),radial-gradient(ellipse_68%_42%_at_92%_18%,transparent_0_72%,rgba(225,29,72,0.10)_72.5%_73%,transparent_73.5%),radial-gradient(ellipse_88%_56%_at_54%_88%,transparent_0_78%,rgba(59,130,246,0.08)_78.5%_79%,transparent_79.5%)] opacity-80" />
          <div className="pointer-events-none absolute left-[-8rem] top-[5rem] h-[22rem] w-[22rem] rounded-full bg-[#CF1041]/[0.16] blur-3xl sm:h-[28rem] sm:w-[28rem]" />
          <div className="pointer-events-none absolute right-[-6rem] top-[8rem] h-[20rem] w-[20rem] rounded-full bg-sky-400/20 blur-3xl sm:h-[24rem] sm:w-[24rem]" />
          <div className="relative z-10 flex flex-col items-center gap-3 rounded-[28px] border border-white/10 bg-white/[0.06] px-8 py-7 shadow-[0_28px_80px_rgba(0,0,0,0.36)] backdrop-blur-xl">
            <div className="h-8 w-8 rounded-full border-4 border-[#E35757] border-t-transparent animate-spin" />
            <p className="font-bold text-white/75 uppercase tracking-[0.34em]">Loading Report...</p>
          </div>
        </div>
     );
  }

  const overallGrade = finalResult?.grade || "F";
  const overallNum = Math.round(finalResult?.overall || 0);
  const tone = getGradeTone(overallGrade);

  return (
    <div className="report-shell min-h-screen text-slate-900 font-sans pb-20 relative overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_14%,rgba(225,29,72,0.24),transparent_24%),radial-gradient(circle_at_84%_12%,rgba(59,130,246,0.18),transparent_22%),radial-gradient(circle_at_54%_38%,rgba(255,255,255,0.06),transparent_28%),radial-gradient(circle_at_18%_72%,rgba(168,85,247,0.08),transparent_26%),linear-gradient(180deg,#05070c_0%,#0a1018_38%,#070b12_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[38rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_58%)]" />
      <div className="pointer-events-none absolute inset-0 tech-grid opacity-[0.34]" />
      <div className="pointer-events-none absolute inset-0 tech-orbits opacity-85" />
      <div className="pointer-events-none absolute inset-0 report-noise opacity-50" />
      <div className="pointer-events-none absolute left-[-10rem] top-[4rem] h-[24rem] w-[24rem] rounded-full bg-[#CF1041]/[0.18] blur-3xl sm:left-[-6rem] sm:h-[30rem] sm:w-[30rem]" />
      <div className="pointer-events-none absolute right-[-7rem] top-[7rem] h-[20rem] w-[20rem] rounded-full bg-sky-400/20 blur-3xl sm:h-[28rem] sm:w-[28rem]" />
      <div className="pointer-events-none absolute right-[12%] top-[24rem] h-[18rem] w-[18rem] rounded-full bg-fuchsia-500/10 blur-3xl sm:h-[22rem] sm:w-[22rem]" />
      <div className="pointer-events-none absolute inset-x-2 top-[4.5rem] bottom-6 rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] shadow-[0_40px_120px_rgba(0,0,0,0.34)] backdrop-blur-[4px] sm:inset-x-4 sm:top-[5.25rem] lg:inset-x-6" />

      <header className="sticky top-0 z-50 relative overflow-hidden border-b border-white/10 bg-[linear-gradient(135deg,rgba(6,8,14,0.90)_0%,rgba(13,18,28,0.84)_46%,rgba(30,41,59,0.70)_100%)] shadow-[0_18px_60px_rgba(0,0,0,0.42)] backdrop-blur-xl supports-[backdrop-filter]:bg-[linear-gradient(135deg,rgba(6,8,14,0.72)_0%,rgba(13,18,28,0.66)_46%,rgba(30,41,59,0.56)_100%)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_-28%,rgba(225,29,72,0.20),transparent_32%),radial-gradient(circle_at_84%_0%,rgba(59,130,246,0.16),transparent_28%),linear-gradient(90deg,rgba(255,255,255,0.06),transparent_32%,transparent_70%,rgba(255,255,255,0.04))]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        <div className="max-w-7xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2 sm:gap-4 relative z-10">
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
              <h1 className="text-base sm:text-lg font-extrabold text-white/90 leading-tight">Back</h1>
              <p className="text-[10px] sm:text-xs text-white/80 hidden sm:block">
                {reportId ? `Report ID: ...${reportId.slice(-6)}` : `Generated on ${new Date().toLocaleDateString()}`}
              </p>
            </div>
          </div>

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <Image
              src="/logoonreport.png"
              alt="App Logo"
              className="h-10 w-auto sm:h-12 object-contain"
              priority
              width={1080}
              height={540}
            />
          </div>

          <div className="flex items-center gap-2 sm:gap-3 relative z-10">
            <AccountEntryButton
              compact
              className="min-h-0 h-8 px-2.5 sm:h-9 sm:px-3 border-white/20 bg-white/[0.06] text-white/80 hover:bg-white/[0.1] lg:pr-4"
            />
            {reportId && (
              <Button
                variant="default"
                size="sm"
                onClick={handleShare}
                className="gap-2 bg-white text-[#E35757] hover:bg-white/90 h-8 px-2 sm:h-9 sm:px-4 font-bold shadow-sm transition-all active:scale-95"
              >
                {isCopied ? <Check className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
                <span className="hidden sm:inline">{isCopied ? "Copied" : "Share"}</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              className="gap-2 hidden md:flex border-white/40 bg-white/90 hover:bg-white text-slate-800"
            >
              <Download className="w-4 h-4" />
              PDF
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6 relative z-10">
        
        <section className="report-module rounded-2xl p-3 sm:p-4">
          <div className="flex flex-col md:flex-row md:items-end gap-3 sm:gap-4">
            <div className="w-full md:max-w-sm relative">
              <label className="text-xs text-slate-300/80 mb-1.5 block ml-1 font-semibold tracking-[0.02em]">
                Select Action Template
              </label>
              <div className="relative">
                <select
                  className="report-select w-full appearance-none text-sm rounded-xl p-2.5 pr-9 outline-none cursor-pointer transition-all"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  disabled={!!reportId && !dbSavedMetrics} 
                >
                  {templates.map((t) => (
                    <option key={t.templateId} value={t.templateId}>
                      {t.displayName}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/45">
                  <ChevronLeft className="w-4 h-4 -rotate-90" />
                </div>
              </div>
            </div>

            <div className="w-full md:w-44">
              <label className="text-xs text-slate-300/80 mb-1.5 block ml-1 font-semibold tracking-[0.02em]">
                Age Group
              </label>
              <div className="relative">
                <select
                  className="report-select w-full appearance-none text-sm rounded-xl p-2.5 pr-9 outline-none cursor-pointer transition-all"
                  value={ageGroup}
                  onChange={(e) => setAgeGroup(e.target.value)}
                >
                  {Object.keys(globalConfig.ageToleranceScale).map((age) => (
                    <option key={age} value={age}>
                      {age} Years
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/45">
                  <ChevronLeft className="w-4 h-4 -rotate-90" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {isDataMissing && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-amber-900 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <h5 className="text-amber-800 font-semibold text-sm">Insufficient Data</h5>
              <p className="text-amber-700/90 mt-1 text-xs sm:text-sm">
                The analysis could not calculate key metrics for this template. 
                <br/>
                Possible causes: Video too short, not enough repetitions detected, or switching templates without raw data support.
              </p>
            </div>
          </div>
        )}

        {finalResult ? (
          <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500">
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <Card
                className={cn(
                  "col-span-2 md:col-span-1 relative overflow-hidden rounded-2xl border shadow-sm transition-all",
                  "card-energy text-white",
                  "hover:-translate-y-[1px] hover:shadow-lg",
                  tone.borderClass
                )}
                style={
                  {
                    "--cardBase": tone.cardBg,
                    "--sheen": tone.led,
                  } as ExtendedCSS
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
                          tone.badgeClass
                        )}
                      >
                        {finalResult.grade}
                      </Badge>
                    </div>
                    <div className="mt-3 sm:mt-4 flex items-baseline gap-3">
                      <span
                        className="text-4xl sm:text-5xl font-black tracking-tight tabular-nums led-num led-strong"
                        data-text={String(overallNum)}
                        style={
                          {
                            "--led": tone.led,
                          } as ExtendedCSS
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
                          width: `${finalResult.overall}%`,
                          background: tone.accent,
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <ScoreCard
                title="POSTURE"
                score={finalResult.breakdown.posture}
                weight={finalResult.weights.posture}
                icon={Activity}
              />
              <ScoreCard
                title="EXECUTION"
                score={finalResult.breakdown.execution}
                weight={finalResult.weights.execution}
                icon={Activity}
              />
              <ScoreCard
                title="CONSISTENCY"
                score={finalResult.breakdown.consistency}
                weight={finalResult.weights.consistency}
                icon={Activity}
              />
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              
              <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                <Card className="report-module rounded-2xl overflow-hidden">
                  <CardHeader className="report-module-header pb-3 px-4 pt-4">
                    <CardTitle className="text-sm font-semibold text-white tracking-wide flex items-center gap-2">
                      <Activity className="w-4 h-4 text-[#E35757]" />
                      Analysis Replay{" "}
                      <span className="text-[10px] sm:text-xs font-medium text-slate-300/70 hidden sm:inline">
                        (recommended: play ~10s)
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <div className="aspect-video bg-black relative flex items-center justify-center">
                    {finalVideoUrl ? (
                      <video
                        src={finalVideoUrl}
                        className="w-full h-full object-contain"
                        controls
                        playsInline
                        loop
                      />
                    ) : (
                      <p className="text-white/45 text-sm">Video Not Found</p>
                    )}
                  </div>
                </Card>

                {finalTimeline && finalTimeline.length > 0 && (
                  <div className="lightify-timeline report-module rounded-2xl p-0 overflow-visible">
                    <MetricTimelineCard timeline={finalTimeline} templateId={selectedTemplateId} />
                  </div>
                )}
              </div>

              <div className="lg:col-span-1">
                <Card className="report-module rounded-2xl h-full flex flex-col overflow-hidden min-h-[400px]">
                  <CardHeader className="report-module-header pb-3 px-4 pt-4">
                    <CardTitle className="text-base font-semibold text-white flex items-center justify-between">
                      <span>Top Findings</span>
                      {finalResult && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] bg-white/[0.08] text-slate-200 border border-white/10"
                        >
                          {finalResult.findings.length} Issues
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 flex-1 overflow-y-auto max-h-[500px] lg:max-h-[600px] custom-scrollbar">
                    <div className="space-y-3 p-3">
                      {finalResult?.findings.map((finding, idx) => {
                        const isBad = finding.score < 60;
                        const isPositive = finding.isPositive;
                        return (
                          <div
                            key={idx}
                            className={cn(
                              "report-findings-item rounded-2xl border p-3 sm:p-4 transition-all",
                              isPositive
                                ? "border-emerald-400/18 bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(16,185,129,0.02))]"
                                : isBad
                                  ? "border-red-400/18 bg-[linear-gradient(180deg,rgba(248,113,113,0.08),rgba(248,113,113,0.02))]"
                                  : "border-amber-400/18 bg-[linear-gradient(180deg,rgba(251,191,36,0.08),rgba(251,191,36,0.02))]"
                            )}
                          >
                            <div className="flex justify-between items-start mb-3 gap-3">
                              <div className="min-w-0">
                                <h4 className="font-semibold text-white/95 text-sm leading-tight pr-3">
                                  {finding.title}
                                </h4>
                                <div className="mt-2 flex items-center gap-2 flex-wrap">
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] sm:text-[10px] px-1.5 py-0 h-4 border-white/10 bg-white/[0.04] text-slate-300/75 uppercase"
                                  >
                                    {finding.category}
                                  </Badge>
                                  <span
                                    className={cn(
                                      "inline-flex h-5 items-center rounded-full px-2 text-[10px] font-bold uppercase tracking-[0.12em]",
                                      isPositive
                                        ? "bg-emerald-400/12 text-emerald-300"
                                        : isBad
                                          ? "bg-red-400/12 text-red-300"
                                          : "bg-amber-400/12 text-amber-300"
                                    )}
                                  >
                                    {isPositive ? "Stable" : isBad ? "Needs Work" : "Watch"}
                                  </span>
                                </div>
                              </div>
                              <div
                                className={cn(
                                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                                  isPositive
                                    ? "border-emerald-400/25 bg-emerald-400/10"
                                    : isBad
                                      ? "border-red-400/25 bg-red-400/10"
                                      : "border-amber-400/25 bg-amber-400/10"
                                )}
                              >
                                {isPositive ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                                ) : (
                                  <AlertCircle
                                    className={cn(
                                      "w-4 h-4 shrink-0",
                                      isBad ? "text-red-300" : "text-amber-300"
                                    )}
                                  />
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mb-3">
                              <div className="h-3 w-px bg-white/10" />
                              <span
                                className={cn(
                                  "text-xs font-extrabold",
                                  isPositive
                                    ? "text-emerald-300"
                                    : isBad
                                      ? "text-red-300"
                                      : "text-amber-300"
                                )}
                              >
                                {finding.score} pts
                              </span>
                            </div>
                            <p className="report-findings-note text-xs text-slate-200 leading-relaxed p-2.5 rounded-xl">
                              {finding.hint}
                            </p>
                          </div>
                        );
                      })}

                      {(!finalResult || finalResult.findings.length === 0) && (
                        <div className="flex flex-col items-center justify-center py-12 text-white/45 gap-2">
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
          <div className="report-module h-64 flex flex-col items-center justify-center text-white/50 rounded-2xl border-dashed gap-4">
            <Activity className="w-6 h-6 opacity-40" />
            <p className="text-sm font-semibold text-white/72">Ready for Analysis</p>
          </div>
        )}
      </main>

      <style jsx global>{`
        .report-shell {
          background-color: #05070c;
        }

        .report-module {
          border: 1px solid rgba(255, 255, 255, 0.08);
          background:
            radial-gradient(circle at top left, rgba(225, 29, 72, 0.08), transparent 24%),
            radial-gradient(circle at top right, rgba(59, 130, 246, 0.08), transparent 22%),
            linear-gradient(180deg, rgba(15, 23, 42, 0.90), rgba(10, 15, 24, 0.86));
          box-shadow:
            0 24px 70px rgba(0, 0, 0, 0.26),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(16px);
        }

        .report-module-header {
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.03),
            rgba(255, 255, 255, 0)
          );
        }

        .report-select {
          border: 1px solid rgba(255, 255, 255, 0.10);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.04)),
            rgba(8, 12, 20, 0.92);
          color: rgba(255, 255, 255, 0.92);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.04),
            0 10px 30px rgba(0, 0, 0, 0.18);
        }

        .report-select:hover {
          border-color: rgba(255, 255, 255, 0.16);
        }

        .report-select:focus {
          border-color: rgba(225, 29, 72, 0.65);
          box-shadow:
            0 0 0 4px rgba(225, 29, 72, 0.16),
            inset 0 1px 0 rgba(255, 255, 255, 0.05),
            0 10px 30px rgba(0, 0, 0, 0.24);
        }

        .report-findings-item:hover {
          background:
            linear-gradient(90deg, rgba(255, 255, 255, 0.03), transparent 72%),
            rgba(255, 255, 255, 0.015);
          transform: translateY(-1px);
          box-shadow:
            0 18px 40px rgba(0, 0, 0, 0.16),
            inset 0 1px 0 rgba(255, 255, 255, 0.04);
        }

        .report-findings-note {
          border: 1px solid rgba(255, 255, 255, 0.08);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.04)),
            rgba(8, 12, 20, 0.92);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.03),
            0 10px 24px rgba(0, 0, 0, 0.16);
        }

        .tech-grid {
          background-image:
            linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.04) 1px, transparent 1px),
            linear-gradient(to right, rgba(225, 29, 72, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(59, 130, 246, 0.04) 1px, transparent 1px);
          background-size: 58px 58px, 58px 58px, 14px 14px, 14px 14px;
          background-position: center center;
          mask-image: linear-gradient(
            180deg,
            rgba(0, 0, 0, 0.68) 0%,
            rgba(0, 0, 0, 0.42) 45%,
            rgba(0, 0, 0, 0.18) 100%
          );
        }

        .tech-orbits {
          background-image:
            radial-gradient(
              ellipse 62% 42% at 8% 18%,
              transparent 0 67%,
              rgba(255, 255, 255, 0.10) 67.5% 68%,
              transparent 68.5%
            ),
            radial-gradient(
              ellipse 58% 36% at 88% 12%,
              transparent 0 69%,
              rgba(225, 29, 72, 0.14) 69.5% 70%,
              transparent 70.5%
            ),
            radial-gradient(
              ellipse 54% 34% at 82% 68%,
              transparent 0 71%,
              rgba(59, 130, 246, 0.12) 71.5% 72%,
              transparent 72.5%
            ),
            radial-gradient(
              ellipse 72% 48% at 30% 88%,
              transparent 0 75%,
              rgba(148, 163, 184, 0.10) 75.5% 76%,
              transparent 76.5%
            );
          mask-image: radial-gradient(circle at center, rgba(0, 0, 0, 0.9), transparent 92%);
        }

        .report-noise {
          background-image:
            linear-gradient(120deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0) 36%),
            linear-gradient(300deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0) 42%),
            radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.04), transparent 62%);
          mix-blend-mode: screen;
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
          background-color: rgba(9, 13, 22, 0.92) !important;
        }
        .lightify-timeline
          :is(
            [class*="text-white"],
            [class*="text-slate-"],
            [class*="text-zinc-"],
            [class*="text-neutral-"],
            [class*="text-gray-"]
          ) {
          color: #e5edf8 !important;
        }
        .lightify-timeline
          :is(
            [class*="border-slate-"],
            [class*="border-zinc-"],
            [class*="border-neutral-"],
            [class*="border-gray-"]
          ) {
          border-color: rgba(255, 255, 255, 0.09) !important;
        }
        .lightify-timeline :is([class*="text-black"]) {
          color: #f8fafc !important;
        }
        .lightify-timeline :is([class*="text-slate-500"], [class*="text-gray-500"]) {
          color: rgba(203, 213, 225, 0.72) !important;
        }
        .lightify-timeline :is([class*="text-slate-400"], [class*="text-gray-400"]) {
          color: rgba(203, 213, 225, 0.58) !important;
        }
        .lightify-timeline :is([class*="bg-white"]) {
          background-color: rgba(255, 255, 255, 0.05) !important;
        }
        .lightify-timeline :is([class*="hover:bg-slate-"], [class*="hover:bg-gray-"]) {
          --tw-bg-opacity: 1 !important;
        }

        @media (max-width: 640px) {
          .tech-grid {
            background-size: 42px 42px, 42px 42px, 12px 12px, 12px 12px;
          }

          .tech-orbits {
            background-image:
              radial-gradient(
                ellipse 82% 48% at 18% 14%,
                transparent 0 69%,
                rgba(255, 255, 255, 0.08) 69.5% 70%,
                transparent 70.5%
              ),
              radial-gradient(
                ellipse 70% 42% at 92% 16%,
                transparent 0 70%,
                rgba(225, 29, 72, 0.10) 70.5% 71%,
                transparent 71.5%
              ),
              radial-gradient(
                ellipse 86% 54% at 48% 88%,
                transparent 0 76%,
                rgba(59, 130, 246, 0.08) 76.5% 77%,
                transparent 77.5%
              );
          }
        }
      `}</style>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={
      <div className="report-shell relative min-h-screen overflow-x-hidden flex items-center justify-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(225,29,72,0.24),transparent_24%),radial-gradient(circle_at_84%_12%,rgba(59,130,246,0.18),transparent_22%),radial-gradient(circle_at_52%_58%,rgba(255,255,255,0.05),transparent_34%),linear-gradient(180deg,#05070c_0%,#0a1018_38%,#070b12_100%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:54px_54px] opacity-40" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_82%_52%_at_8%_14%,transparent_0_70%,rgba(255,255,255,0.08)_70.5%_71%,transparent_71.5%),radial-gradient(ellipse_68%_42%_at_92%_18%,transparent_0_72%,rgba(225,29,72,0.10)_72.5%_73%,transparent_73.5%),radial-gradient(ellipse_88%_56%_at_54%_88%,transparent_0_78%,rgba(59,130,246,0.08)_78.5%_79%,transparent_79.5%)] opacity-80" />
        <div className="pointer-events-none absolute left-[-8rem] top-[5rem] h-[22rem] w-[22rem] rounded-full bg-[#CF1041]/[0.16] blur-3xl sm:h-[28rem] sm:w-[28rem]" />
        <div className="pointer-events-none absolute right-[-6rem] top-[8rem] h-[20rem] w-[20rem] rounded-full bg-sky-400/20 blur-3xl sm:h-[24rem] sm:w-[24rem]" />
        <div className="flex flex-col items-center gap-3">
           <div className="w-8 h-8 border-4 border-[#E35757] border-t-transparent rounded-full animate-spin"></div>
           <p className="text-white/75 font-medium">Loading...</p>
        </div>
      </div>
    }>
      <ReportContent />
    </Suspense>
  );
}
