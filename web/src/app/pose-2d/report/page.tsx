// src/app/pose-2d/report/page.tsx

"use client";

import { templateDisplayName } from "@/lib/templateLanguage";
import { usePoseCopy } from "@/components/Pose2D/poseCopy";
import { useState, useEffect, Suspense, useMemo, useRef } from "react";
import { isAdminRole } from "@/lib/authRedirect";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ReportHeader } from "@/components/Pose2D/ReportHeader";
import { ReportScoreSummary } from "@/components/Pose2D/ReportScoreSummary";
import { ReportFindingItem } from "@/components/Pose2D/ReportFindingItem";
import { ReportFeedbackPanel } from "@/components/Pose2D/ReportFeedbackPanel";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import globalConfig from "@/config/templates/global.json";
import {
  getAllTemplates,
  getTemplateById,
  parseActionTemplateSnapshot,
  ActionTemplate,
} from "@/config/templates";
import { calculateRealScore, ScoreResult, AngleData } from "@/lib/scoring";
import { mergeTrainingTimelineMetrics } from "@/lib/trainingCalculator";
import { rescoreTrainingReportForAge } from "@/lib/trainingReport";
import { useAnalysisStore, FrameSample } from "@/store/analysisStore";
import MetricTimelineCard from "@/components/Pose2D/MetricTimelineCard";
import { ChevronDown, Activity, CheckCircle2, AlertTriangle, MessageCircle } from "lucide-react";
import { reportService } from "@/services/reports";
import { useAuthStore } from "@/store/authStore";
import "./report.css";

type SavedScoreData = ScoreResult & {
  saved_metrics?: AngleData[];
  template_snapshot?: unknown;
  score_context?: {
    age_group?: string;
    handedness?: string;
    camera_match?: boolean | null;
    expected_camera?: "front" | "side" | null;
    camera_instructions?: string | null;
    [key: string]: unknown;
  };
};

type TrainingCameraContext = {
  match: boolean | null;
  expected: "front" | "side" | null;
  instructions: string | null;
};

type ReportSyncState = "idle" | "saving" | "saved" | "error";

const DEFAULT_AGE_GROUP = "16-18";

function getPersistedAgeGroup(scoreData: SavedScoreData): string {
  return typeof scoreData.score_context?.age_group === "string"
    ? scoreData.score_context.age_group
    : DEFAULT_AGE_GROUP;
}

function buildReportSignature(templateId: string, ageGroup: string, score: number | null | undefined): string {
  return `${templateId}:${ageGroup}:${typeof score === "number" ? score.toFixed(2) : "none"}`;
}

function getSafeReturnTo(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  const allowedPrefixes = [
    routes.coach.home,
    routes.admin.home,
    routes.user.me,
    routes.pose2d.shooting,
    routes.pose2d.dribbling,
    routes.pose2d.training,
  ];

  return allowedPrefixes.some((prefix) => value === prefix || value.startsWith(`${prefix}/`))
    ? value
    : null;
}

function ReportContent() {
  const { language, t } = usePoseCopy();
  const { currentAngles, currentVideoUrl, currentTemplate, currentTimeline } = useAnalysisStore();
  const user = useAuthStore((state) => state.user);

  const searchParams = useSearchParams();
  const router = useRouter();
  const reportId = searchParams.get('id');
  const isSharedView = searchParams.get("share") === "1";
  const returnTo = getSafeReturnTo(searchParams.get("returnTo"));

  const [ageGroup, setAgeGroup] = useState<string>(DEFAULT_AGE_GROUP);
  const [savedAgeGroup, setSavedAgeGroup] = useState(DEFAULT_AGE_GROUP);
  const [canReanalyzeAge, setCanReanalyzeAge] = useState(false);
  const [ageSaveError, setAgeSaveError] = useState<string | null>(null);
  const ageSaveRequestRef = useRef<{ key: string; id: string } | null>(null);
  const ageSaveInFlightRef = useRef(false);
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
  const [dbSessionPublicId, setDbSessionPublicId] = useState<string | null>(null);
  const [dbTemplateVersion, setDbTemplateVersion] = useState<string | null>("v1");
  const [dbTemplateSnapshot, setDbTemplateSnapshot] = useState<ActionTemplate | null>(null);
  const [legacySelectionEdited, setLegacySelectionEdited] = useState(false);
  const [dbTemplateSnapshotError, setDbTemplateSnapshotError] = useState<string | null>(null);
  const [dbCameraContext, setDbCameraContext] = useState<TrainingCameraContext | null>(null);
  const [reportSyncState, setReportSyncState] = useState<ReportSyncState>("idle");

  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportLoadError, setReportLoadError] = useState<string | null>(null);
  const [reportLoadAttempt, setReportLoadAttempt] = useState(0);
  const [loadedReportKey, setLoadedReportKey] = useState<string | null>(null);
  const reportKey = `${reportId}:${isSharedView}:${user?.public_id ?? "anonymous"}`;
  const reportKeyRef = useRef(reportKey);
  reportKeyRef.current = reportKey;
  const reportViewMountedRef = useRef(true);
  const [isCopied, setIsCopied] = useState(false);
  const persistedReportSignatureRef = useRef<string | null>(null);
  const [persistedScoringOptions, setPersistedScoringOptions] = useState<Record<string, unknown>>({});

  useEffect(() => {
    reportViewMountedRef.current = true;
    setIsMounted(true);
    return () => { reportViewMountedRef.current = false; };
  }, []);

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
          const metricsForScoring =
            template.mode === "training"
              ? mergeTrainingTimelineMetrics(
                  currentAngles.filter((metric) => metric.unit === "calc"),
                  currentTimeline,
                  template
                )
              : currentAngles;
          setResult(calculateRealScore(template, metricsForScoring, { ageGroup, handedness: "right" }));
        }
    }
    
    // A saved report initially displays the result and handedness from storage.
    if (reportId && legacySelectionEdited && !dbTemplateSnapshot && dbSavedMetrics && selectedTemplateId) {
        const template = getTemplateById(selectedTemplateId);
        if (template) {
          if (template.mode === "training") return;
          const metricsForScoring =
            dbSavedMetrics;
          setDbResult(calculateRealScore(template, metricsForScoring, { ageGroup, handedness: "right" }));
        }
    }
  }, [selectedTemplateId, currentAngles, currentTimeline, ageGroup, reportId, dbSavedMetrics, dbTemplateSnapshot, legacySelectionEdited]);

  // 4. Load report detail from the backend by public id.
  useEffect(() => {
    const reportPublicId = reportId;
    if (!reportPublicId) return;
    let cancelled = false;

    async function fetchReport(publicId: string) {
      setLoading(true);
      setLoadedReportKey(null);
      setReportLoadError(null);
      setCanReanalyzeAge(false);
      setAgeSaveError(null);
      setReportSyncState("idle");
      ageSaveInFlightRef.current = false;
      setDbResult(null);
      setDbTimeline(null);
      setDbVideoUrl(null);
      setDbSavedMetrics(null);
      setDbSessionPublicId(null);
      setDbTemplateSnapshot(null);
      setLegacySelectionEdited(false);
      setDbTemplateSnapshotError(null);
      setDbCameraContext(null);
      try {
        const data = isSharedView
          ? await reportService.getSharedReport(publicId)
          : await reportService.getReport(publicId);
        if (cancelled) return;
        setLoadedReportKey(reportKey);
        const scoreData = data.score_data as unknown as SavedScoreData;
        const persistedAgeGroup = getPersistedAgeGroup(scoreData);
        setPersistedScoringOptions(scoreData.score_context || {});

        setDbResult(scoreData);
        setDbTimeline((data.timeline_data ?? []) as FrameSample[]);
        setDbVideoUrl(data.video_url);
        setDbSessionPublicId(data.session_public_id);
        setDbTemplateVersion(data.template_version ?? "v1");
        const templateSnapshot = parseActionTemplateSnapshot(
          data.analysis_type === "training"
            ? data.template_snapshot ?? scoreData.template_snapshot
            : scoreData.template_snapshot,
          {
            templateId: data.template_code,
            version: data.template_version ?? "v1",
          },
        );
        setDbTemplateSnapshot(templateSnapshot);
        setDbTemplateSnapshotError(
          data.analysis_type === "training" && !templateSnapshot
            ? "This report cannot load its locked template version. Performance charts are hidden to avoid mixing historical scores with current template rules."
            : null,
        );
        setDbCameraContext({
          match:
            typeof scoreData.score_context?.camera_match === "boolean"
              ? scoreData.score_context.camera_match
              : null,
          expected:
            scoreData.score_context?.expected_camera === "front" ||
            scoreData.score_context?.expected_camera === "side"
              ? scoreData.score_context.expected_camera
              : null,
          instructions:
            typeof scoreData.score_context?.camera_instructions === "string"
              ? scoreData.score_context.camera_instructions
              : null,
        });
        setAgeGroup(persistedAgeGroup);
        setSavedAgeGroup(persistedAgeGroup);
        setCanReanalyzeAge(data.can_reanalyze_age === true && !isSharedView);

        setDbSavedMetrics(Array.isArray(scoreData.saved_metrics) ? scoreData.saved_metrics : null);

        if (
          data.analysis_type === "shooting" ||
          data.analysis_type === "dribbling" ||
          data.analysis_type === "training"
        ) {
          setSelectedMode(data.analysis_type);
        }
        if (data.template_code) {
          setSelectedTemplateId(data.template_code);
        }

        if (data.template_code) {
          persistedReportSignatureRef.current = buildReportSignature(
            data.template_code,
            persistedAgeGroup,
            data.overall_score ?? scoreData.overall
          );
        }
      } catch (e) {
        if (!cancelled) {
          setReportLoadError(e instanceof Error ? e.message : "Could not load this report. Please retry.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchReport(reportPublicId);
    return () => { cancelled = true; };
  }, [isSharedView, reportId, reportKey, reportLoadAttempt]);

  useEffect(() => {
    if (isSharedView || !legacySelectionEdited || dbTemplateSnapshot || !reportId || loading || loadedReportKey !== reportKey || !dbSessionPublicId || !dbSavedMetrics || !dbResult || !selectedTemplateId) {
      return;
    }

    const template = getTemplateById(selectedTemplateId);
    if (!template) {
      return;
    }
    if (template.mode === "training") {
      return;
    }

    const metricsToSave = dbSavedMetrics;
    const nextSignature = buildReportSignature(selectedTemplateId, ageGroup, dbResult.overall);
    if (persistedReportSignatureRef.current === nextSignature) {
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        setReportSyncState("saving");

        const savedReport = await reportService.saveReport({
          session_public_id: dbSessionPublicId,
          template_code: selectedTemplateId,
          template_version: dbTemplateVersion ?? "v1",
          overall_score: dbResult.overall,
          grade: dbResult.grade,
          score_data: {
            ...dbResult,
            saved_metrics: metricsToSave,
            score_context: {
              age_group: ageGroup,
              handedness: "right",
              source: "report_template_selection",
            },
          },
          timeline_data: dbTimeline ?? [],
          summary_data: {
            analysis_type: template.mode,
            handedness: "right",
            metrics_count: metricsToSave.length,
            template_name: template.displayName,
            age_group: ageGroup,
            source: "report_template_selection",
          },
        });

        persistedReportSignatureRef.current = buildReportSignature(
          savedReport.template_code,
          ageGroup,
          savedReport.overall_score ?? dbResult.overall
        );
        setDbTemplateVersion(savedReport.template_version ?? "v1");
        setReportSyncState("saved");
      } catch (error) {
        console.error("Failed to sync selected report template:", error);
        setReportSyncState("error");
      }
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [
    ageGroup,
    dbResult,
    dbSavedMetrics,
    dbSessionPublicId,
    dbTemplateVersion,
    dbTemplateSnapshot,
    dbTimeline,
    isSharedView,
    loading,
    loadedReportKey,
    legacySelectionEdited,
    reportKey,
    reportId,
    selectedTemplateId,
  ]);

  const handleShare = () => {
    const url = new URL(window.location.href);
    if (reportId) {
      url.searchParams.set("id", reportId);
      url.searchParams.set("share", "1");
      url.searchParams.delete("returnTo");
    }
    navigator.clipboard.writeText(url.toString()).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const isTrainingAgePreview = Boolean(reportId) && selectedMode === "training" && ageGroup !== savedAgeGroup;
  const agePreviewResult = useMemo(() => isTrainingAgePreview
    ? rescoreTrainingReportForAge(dbTemplateSnapshot, dbSavedMetrics, ageGroup, persistedScoringOptions)
    : null, [isTrainingAgePreview, dbTemplateSnapshot, dbSavedMetrics, ageGroup, persistedScoringOptions]);
  const finalResult = reportId ? (isTrainingAgePreview ? agePreviewResult : dbResult) : result;
  const handleSaveAgeReport = async () => {
    if (!reportId || !canReanalyzeAge || !isTrainingAgePreview || agePreviewResult?.analysisStatus !== "ready" || ageSaveInFlightRef.current) return;
    ageSaveInFlightRef.current = true;
    setReportSyncState("saving");
    setAgeSaveError(null);
    const key = `${reportId}:${ageGroup}`;
    const savingReportKey = reportKey;
    let navigatingToReport = false;
    try {
      if (ageSaveRequestRef.current?.key !== key) {
        ageSaveRequestRef.current = { key, id: crypto.randomUUID() };
      }
      const saved = await reportService.reanalyzeAge(reportId, {
        request_id: ageSaveRequestRef.current.id,
        age_group: ageGroup,
        overall_score: agePreviewResult.overall,
        grade: agePreviewResult.grade,
        score_data: { ...agePreviewResult },
      });
      if (!reportViewMountedRef.current || reportKeyRef.current !== savingReportKey) return;
      const params = new URLSearchParams({ id: saved.public_id });
      if (returnTo) params.set("returnTo", returnTo);
      // Keep controls locked until the new persisted report has loaded.
      setLoading(true);
      router.push(`${routes.pose2d.report}?${params.toString()}`);
      navigatingToReport = true;
    } catch (error) {
      if (!reportViewMountedRef.current || reportKeyRef.current !== savingReportKey) return;
      setAgeSaveError(error instanceof Error ? error.message : "Could not save the new report. Please retry.");
      setReportSyncState("error");
    } finally {
      if (reportViewMountedRef.current && !navigatingToReport && reportKeyRef.current === savingReportKey) {
        ageSaveInFlightRef.current = false;
      }
    }
  };
  const finalVideoUrl = reportId ? dbVideoUrl : currentVideoUrl;
  const finalTimeline = reportId ? dbTimeline : currentTimeline;
  const rawFinalSavedMetrics = reportId ? dbSavedMetrics : currentAngles;
  const selectedTemplate = useMemo(
    () => {
      if (reportId && (dbTemplateSnapshot || selectedMode === "training")) {
        return dbTemplateSnapshot;
      }
      return selectedTemplateId ? getTemplateById(selectedTemplateId) ?? null : null;
    },
    [dbTemplateSnapshot, reportId, selectedMode, selectedTemplateId],
  );
  const finalSavedMetrics = useMemo(() => {
    if (reportId || selectedTemplate?.mode !== "training") {
      return rawFinalSavedMetrics;
    }

    return mergeTrainingTimelineMetrics(rawFinalSavedMetrics, finalTimeline, selectedTemplate);
  }, [reportId, rawFinalSavedMetrics, finalTimeline, selectedTemplate]);
  const trainingTemplateContractError = useMemo(() => {
    if (!reportId || selectedMode !== "training") return null;
    if (dbTemplateSnapshotError) return dbTemplateSnapshotError;
    if (!dbTemplateSnapshot || !finalResult) return null;

    const expectedMetricIds = dbTemplateSnapshot.metrics.map((metric) => metric.metricId);
    const findingIds = finalResult.findings.map((finding) => finding.id);
    if (
      expectedMetricIds.length !== findingIds.length ||
      expectedMetricIds.some((metricId, index) => metricId !== findingIds[index])
    ) {
      return `This report saved ${findingIds.length} findings, but locked template ${dbTemplateSnapshot.version} defines ${expectedMetricIds.length} metrics. Performance charts are hidden until the historical template data is repaired.`;
    }
    return null;
  }, [dbTemplateSnapshot, dbTemplateSnapshotError, finalResult, reportId, selectedMode]);
  const hasPerformanceData =
    Boolean(finalTimeline && finalTimeline.length > 0) ||
    Boolean(finalSavedMetrics && finalSavedMetrics.length > 0);
  const hasPerformanceCurves =
    (hasPerformanceData || (selectedTemplate?.mode === "training" && Boolean(finalResult))) &&
    !trainingTemplateContractError;
  const trainingBackHref =
    selectedMode === "dribbling"
      ? routes.pose2d.dribbling
      : selectedMode === "training"
        ? routes.pose2d.training
        : routes.pose2d.shooting;
  const roleBackHref =
    user?.role === "coach"
      ? routes.coach.reports
      : isAdminRole(user?.role)
        ? routes.admin.home
        : trainingBackHref;
  const backHref = returnTo ?? (isSharedView ? routes.home : roleBackHref);

  // 数据异常提示逻辑
  const isDataMissing = useMemo(
    () =>
      !finalResult ||
      finalResult.analysisStatus === "insufficient_data" ||
      finalResult.overall <= 0,
    [finalResult],
  );
  const hasCameraMismatch =
    selectedTemplate?.mode === "training" && dbCameraContext?.match === false;

  if (!isMounted) return null;

  if (reportId && reportLoadError && !loading) {
    return <div className="report-shell flex min-h-screen items-center justify-center p-6 text-white">
      <div className="max-w-lg space-y-4 rounded-2xl border border-white/10 p-6">
        <h1 className="text-xl font-semibold">{t("Could not load report")}</h1>
        <p role="alert">{t(reportLoadError)}</p>
        <Button className="ui-button" onClick={() => setReportLoadAttempt((attempt) => attempt + 1)}>{t("Retry loading report")}</Button>
        <Link href={backHref} className="ml-4 underline">{t("Back")}</Link>
      </div>
    </div>;
  }

  if (loading || (reportId && loadedReportKey !== reportKey)) {
     return (
        <div className="report-shell relative min-h-screen overflow-x-hidden flex items-center justify-center">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(225,29,72,0.24),transparent_24%),radial-gradient(circle_at_84%_12%,rgba(59,130,246,0.18),transparent_22%),radial-gradient(circle_at_52%_58%,rgba(255,255,255,0.05),transparent_34%),linear-gradient(180deg,#05070c_0%,#0a1018_38%,#070b12_100%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:54px_54px] opacity-40" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_82%_52%_at_8%_14%,transparent_0_70%,rgba(255,255,255,0.08)_70.5%_71%,transparent_71.5%),radial-gradient(ellipse_68%_42%_at_92%_18%,transparent_0_72%,rgba(225,29,72,0.10)_72.5%_73%,transparent_73.5%),radial-gradient(ellipse_88%_56%_at_54%_88%,transparent_0_78%,rgba(59,130,246,0.08)_78.5%_79%,transparent_79.5%)] opacity-80" />
          <div className="pointer-events-none absolute left-[-8rem] top-[5rem] h-[22rem] w-[22rem] rounded-full bg-[#CF1041]/[0.16] blur-3xl sm:h-[28rem] sm:w-[28rem]" />
          <div className="pointer-events-none absolute right-[-6rem] top-[8rem] h-[20rem] w-[20rem] rounded-full bg-sky-400/20 blur-3xl sm:h-[24rem] sm:w-[24rem]" />
          <div className="relative z-10 flex flex-col items-center gap-3 rounded-[28px] border border-white/10 bg-white/[0.06] px-8 py-7 shadow-[0_28px_80px_rgba(0,0,0,0.36)] backdrop-blur-xl">
            <div className="h-8 w-8 rounded-full border-4 border-[#E35757] border-t-transparent animate-spin" />
            <p className="font-bold text-white/75 uppercase tracking-[0.34em]">{t("Loading Report...")}</p>
          </div>
        </div>
     );
  }

  const reportSyncLabel =
    reportSyncState === "saving"
      ? "Saving"
      : reportSyncState === "saved"
        ? "Saved"
        : reportSyncState === "error"
          ? "Save failed"
          : isTrainingAgePreview ? "Preview · unsaved" : "Ready";

  return (
    <div className="report-shell relative min-h-screen overflow-x-clip pb-20 font-sans">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_14%,rgba(225,29,72,0.24),transparent_24%),radial-gradient(circle_at_84%_12%,rgba(59,130,246,0.18),transparent_22%),radial-gradient(circle_at_54%_38%,rgba(255,255,255,0.06),transparent_28%),radial-gradient(circle_at_18%_72%,rgba(168,85,247,0.08),transparent_26%),linear-gradient(180deg,#05070c_0%,#0a1018_38%,#070b12_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[38rem] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_58%)]" />
      <div className="pointer-events-none absolute inset-0 tech-grid opacity-[0.34]" />
      <div className="pointer-events-none absolute inset-0 tech-orbits opacity-85" />
      <div className="pointer-events-none absolute inset-0 report-noise opacity-50" />
      <div className="pointer-events-none absolute left-[-10rem] top-[4rem] h-[24rem] w-[24rem] rounded-full bg-[#CF1041]/[0.18] blur-3xl sm:left-[-6rem] sm:h-[30rem] sm:w-[30rem]" />
      <div className="pointer-events-none absolute right-[-7rem] top-[7rem] h-[20rem] w-[20rem] rounded-full bg-sky-400/20 blur-3xl sm:h-[28rem] sm:w-[28rem]" />
      <div className="pointer-events-none absolute right-[12%] top-[24rem] h-[18rem] w-[18rem] rounded-full bg-fuchsia-500/10 blur-3xl sm:h-[22rem] sm:w-[22rem]" />
      <div className="pointer-events-none absolute inset-x-2 top-[4.5rem] bottom-6 rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] shadow-[0_40px_120px_rgba(0,0,0,0.34)] backdrop-blur-[4px] sm:inset-x-4 sm:top-[5.25rem] lg:inset-x-6" />

      <ReportHeader
        backHref={backHref}
        reportId={reportId}
        onShare={handleShare}
        copied={isCopied}
        shareDisabled={isTrainingAgePreview || reportSyncState === "saving"}
      />

      <main className="max-w-7xl mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6 relative z-10">
        <section aria-label={t("Report settings")} className="report-module rounded-2xl p-4 sm:p-5">
          <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_11rem] sm:gap-4 lg:grid-cols-[minmax(0,26rem)_11rem_minmax(0,1fr)]">
            <div className="min-w-0">
              <label htmlFor="report-template" className="report-field-label">{t("Select Action Template")}</label>
              <div className="relative">
                <select
                  id="report-template"
                  className="report-select"
                  value={selectedTemplateId}
                  onChange={(e) => {
                    setSelectedTemplateId(e.target.value);
                    if (reportId) setLegacySelectionEdited(true);
                  }}
                  disabled={
                    Boolean(reportId) &&
                    (!dbSavedMetrics || selectedMode === "training" || dbTemplateSnapshot !== null)
                  }
                >
                  {templates.map((t) => (
                    <option key={t.templateId} value={t.templateId}>
                      {templateDisplayName(t.templateId, dbTemplateSnapshot?.templateId === t.templateId ? dbTemplateSnapshot.displayName : t.displayName, language)}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} aria-hidden="true" className="report-chevron" />
              </div>
            </div>

            <div className="min-w-0">
              <label htmlFor="report-age" className="report-field-label">{t("Age Group")}</label>
              <div className="relative">
                <select
                  className="report-select"
                  value={ageGroup}
                  id="report-age"
                  onChange={(e) => {
                    setAgeGroup(e.target.value);
                    setAgeSaveError(null);
                    setReportSyncState("idle");
                    if (reportId && selectedMode !== "training") setLegacySelectionEdited(true);
                  }}
                  disabled={Boolean(reportId) && (selectedMode === "training"
                    ? isSharedView || !canReanalyzeAge || !dbTemplateSnapshot || !dbSavedMetrics?.length || reportSyncState === "saving"
                    : dbTemplateSnapshot !== null)}
                >
                  {Object.keys(globalConfig.ageToleranceScale).map((age) => (
                    <option key={age} value={age}>
                      {age} {t("Years")}</option>
                  ))}
                </select>
                <ChevronDown size={16} aria-hidden="true" className="report-chevron" />
              </div>
            </div>

            {reportId && (
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 sm:col-span-2 lg:col-span-1 lg:min-h-11">
                <span role="status" className="report-sync-state" data-state={isTrainingAgePreview && reportSyncState === "idle" ? "preview" : reportSyncState}>
                  {t(reportSyncLabel)}
                </span>
                {user && !isSharedView && (
                  <a className="ui-button" href="#coach-feedback">
                    <MessageCircle size={16} aria-hidden="true" /> {t("Coach feedback")}</a>
                )}
              </div>
            )}
          </div>
          {isTrainingAgePreview && (
            <div className="report-secondary mt-4 flex flex-wrap items-center gap-3 text-sm">
              <p className="w-full">{language === "zh-CN" ? `正在预览 ${ageGroup} 岁年龄组。可另存为新报告以保留此次结果，原报告和测量值会保留。` : `Preview for ages ${ageGroup}. Save as a new report to keep this result. The original report and measured values stay unchanged.`}</p>
              <Button className="ui-button ui-primary" onClick={handleSaveAgeReport} disabled={reportSyncState === "saving" || agePreviewResult?.analysisStatus !== "ready" || !canReanalyzeAge}>
                {t(reportSyncState === "saving" ? "Saving…" : "Save as new report")}
              </Button>
              <Button className="ui-button" variant="outline" disabled={reportSyncState === "saving"} onClick={() => {
                setAgeGroup(savedAgeGroup);
                setAgeSaveError(null);
                setReportSyncState("idle");
              }}>{t("Cancel")}</Button>
              {ageSaveError && <p role="alert" className="w-full text-red-300">{t(ageSaveError)}</p>}
            </div>
          )}
        </section>

        {hasCameraMismatch && (
          <div className="flex items-start gap-3 rounded-lg border border-sky-300/25 bg-sky-300/10 p-4 text-sky-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" />
            <div>
              <h5 className="text-sm font-semibold">{t("Check the camera view")}</h5>
              <p className="mt-1 text-xs leading-5 text-sky-100/85 sm:text-sm">
                {language === "zh-CN"
                  ? `该动作应从${t(dbCameraContext?.expected ?? selectedTemplate?.camera ?? "")}拍摄。`
                  : `This movement is designed for a ${dbCameraContext?.expected ?? selectedTemplate?.camera} view.`}
                {dbCameraContext?.instructions
                  ? ` ${t(dbCameraContext.instructions)}`
                  : ` ${t("Keep the full body and required joints visible.")}`}
              </p>
              <p className="mt-1 text-xs text-sky-100/65">{t("This is a filming tip only and does not change the score.")}</p>
            </div>
          </div>
        )}

        {trainingTemplateContractError && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-300/25 bg-amber-300/10 p-4 text-amber-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <div>
              <h5 className="text-sm font-semibold">{t("Template version data needs attention")}</h5>
              <p className="mt-1 text-xs leading-5 text-amber-100/85 sm:text-sm">
                {t(trainingTemplateContractError)}
              </p>
            </div>
          </div>
        )}

        {isDataMissing && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-amber-900 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <h5 className="text-amber-800 font-semibold text-sm">{t("Insufficient Data")}</h5>
              <p className="text-amber-700/90 mt-1 text-xs sm:text-sm">{t("The clip did not contain a complete, clearly visible movement for this exercise. Check the required camera view and keep the full body and required joints visible.")}</p>
            </div>
          </div>
        )}

        {finalResult ? (
          <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-500">
            <ReportScoreSummary result={finalResult} />

            <div className="report-detail-grid grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
              <div className="min-w-0 space-y-4 sm:space-y-6 lg:col-span-2">
                <section aria-labelledby="report-replay-title" className="report-module overflow-hidden rounded-2xl">
                  <div className="report-module-header flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3.5 sm:px-5">
                    <h2 id="report-replay-title" className="flex items-center gap-2 text-base font-semibold">
                      <Activity size={17} aria-hidden="true" />{t("Analysis Replay")}</h2>
                    {finalVideoUrl && <span className="report-secondary text-xs">{t("Recommended playback: ~10s")}</span>}
                  </div>
                  <div className="aspect-video bg-black">
                    {finalVideoUrl ? (
                      <video
                        src={finalVideoUrl}
                        className="h-full w-full object-contain"
                        aria-label={t("Analysis replay")}
                        controls
                        playsInline
                        loop
                      />
                    ) : (
                      <p className="report-video-empty grid h-full place-items-center text-sm">{t("Video Not Found")}</p>
                    )}
                  </div>
                </section>

                {hasPerformanceCurves && (
                  <MetricTimelineCard
                    timeline={finalTimeline}
                    templateId={selectedTemplateId}
                    template={selectedTemplate}
                    savedMetrics={finalSavedMetrics}
                    scoringContext={{
                      ...(reportId ? persistedScoringOptions : {}),
                      ageGroup,
                      handedness: reportId ? persistedScoringOptions.handedness || "right" : "right",
                    }}
                  />
                )}
              </div>

              <div className="relative min-w-0">
                <section aria-labelledby="report-findings-title" className="report-findings-panel report-module flex flex-col overflow-hidden rounded-2xl lg:absolute lg:inset-0">
                  <div className="report-module-header flex shrink-0 items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                    <h2 id="report-findings-title" className="text-base font-semibold">{t("Top Findings")}</h2>
                    <span className="report-secondary text-xs font-medium">
                      {finalResult.findings.length} {t(finalResult.findings.length === 1 ? "check" : "checks")}
                    </span>
                  </div>
                  <div className="report-findings-scroll min-h-0 lg:overflow-y-auto">
                    {finalResult.findings.length ? (
                      <ul>
                        {finalResult.findings.map((finding, index) => (
                          <ReportFindingItem key={finding.id ?? index} finding={finding} />
                        ))}
                      </ul>
                    ) : (
                      <p className="report-secondary flex items-center justify-center gap-2 p-6 text-sm">
                        <CheckCircle2 size={18} aria-hidden="true" />{t("No critical findings found.")}</p>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>
        ) : (
          <div className="report-module h-64 flex flex-col items-center justify-center text-white/50 rounded-2xl border-dashed gap-4">
            <Activity className="w-6 h-6 opacity-40" />
            <p className="text-sm font-semibold text-white/72">{t("Ready for Analysis")}</p>
          </div>
        )}
        {reportId && user && !isSharedView && <ReportFeedbackPanel key={`${user.public_id}:${reportId}`} reportId={reportId} />}
      </main>
    </div>
  );
}

export default function ReportPage() {
  const { t } = usePoseCopy();
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
           <p className="text-white/75 font-medium">{t("Loading...")}</p>
        </div>
      </div>
    }>
      <ReportContent />
    </Suspense>
  );
}
