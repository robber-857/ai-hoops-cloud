"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  Video,
} from "lucide-react";

import {
  AdminForbiddenSurface,
  AdminLoadingSurface,
  AdminShell,
} from "@/components/admin/AdminShell";
import { analysisTypeLabels, formatDateTime } from "@/components/coach/coachUtils";
import {
  adminService,
  type AdminTemplateExampleVideoRead,
  type AdminTrainingTemplateRead,
  type AdminTrainingTemplateVersionRead,
} from "@/services/admin";
import type { ReportAnalysisType } from "@/services/reports";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";

const fieldClass =
  "min-h-11 w-full rounded-lg border border-white/10 bg-black/24 px-3 text-sm text-white outline-none transition placeholder:text-white/28 focus:border-[#65f7ff]/46 focus:bg-black/34 focus:ring-2 focus:ring-[#65f7ff]/12";
const labelClass = "text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-white/46";
const analysisTypes: ReportAnalysisType[] = ["shooting", "dribbling", "training", "comprehensive"];

function parseJsonField(value: string, fallback: Record<string, unknown> | null = null) {
  if (!value.trim()) {
    return fallback;
  }

  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JSON field must be an object.");
  }
  return parsed as Record<string, unknown>;
}

function numberOrNull(value: string) {
  if (!value.trim()) {
    return null;
  }
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function statusTone(status: string) {
  if (status === "active" || status === "published") {
    return "border-[#d8ff5d]/24 bg-[#d8ff5d]/10 text-[#e8ff9a]";
  }
  if (status === "archived" || status === "deleted" || status === "hidden") {
    return "border-white/10 bg-white/[0.04] text-white/48";
  }
  return "border-[#65f7ff]/24 bg-[#65f7ff]/10 text-[#dffbff]";
}

export default function AdminTemplatesPage() {
  const user = useAuthStore((state) => state.user);
  const hasInitialized = useAuthStore((state) => state.hasInitialized);
  const isInitializing = useAuthStore((state) => state.isInitializing);
  const [templates, setTemplates] = useState<AdminTrainingTemplateRead[]>([]);
  const [versions, setVersions] = useState<AdminTrainingTemplateVersionRead[]>([]);
  const [exampleVideos, setExampleVideos] = useState<AdminTemplateExampleVideoRead[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const [templateCode, setTemplateCode] = useState("");
  const [name, setName] = useState("");
  const [analysisType, setAnalysisType] = useState<ReportAnalysisType>("shooting");
  const [difficultyLevel, setDifficultyLevel] = useState("");
  const [description, setDescription] = useState("");

  const [editTemplateCode, setEditTemplateCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editAnalysisType, setEditAnalysisType] = useState<ReportAnalysisType>("shooting");
  const [editDifficultyLevel, setEditDifficultyLevel] = useState("");
  const [editStatus, setEditStatus] = useState("draft");
  const [editCurrentVersion, setEditCurrentVersion] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [version, setVersion] = useState("v1");
  const [scoringRules, setScoringRules] = useState("{\n  \"target_score\": 85\n}");
  const [isDefault, setIsDefault] = useState(true);

  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [videoVersion, setVideoVersion] = useState("");
  const [videoDescription, setVideoDescription] = useState("");
  const [videoBucket, setVideoBucket] = useState("");
  const [videoObjectKey, setVideoObjectKey] = useState("");
  const [videoFileName, setVideoFileName] = useState("");
  const [videoContentType, setVideoContentType] = useState("video/mp4");
  const [videoDuration, setVideoDuration] = useState("");
  const [videoCoverUrl, setVideoCoverUrl] = useState("");
  const [videoSortOrder, setVideoSortOrder] = useState("0");
  const [videoStatus, setVideoStatus] = useState("active");

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isSubmittingTemplate, setIsSubmittingTemplate] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isSubmittingVersion, setIsSubmittingVersion] = useState(false);
  const [isSavingVideo, setIsSavingVideo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isAdmin = user?.role === "admin";
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.public_id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  );

  const loadTemplates = async () => {
    const response = await adminService.listTrainingTemplates();
    setTemplates(response.items);
    setSelectedTemplateId((current) => current || response.items[0]?.public_id || "");
  };

  const loadSelectedDetails = async (templatePublicId: string) => {
    if (!templatePublicId) {
      setVersions([]);
      setExampleVideos([]);
      return;
    }

    setIsLoadingDetails(true);
    try {
      const [versionsResponse, videosResponse] = await Promise.all([
        adminService.listTrainingTemplateVersions(templatePublicId),
        adminService.listTemplateExampleVideos(templatePublicId),
      ]);
      setVersions(versionsResponse.items);
      setExampleVideos(videosResponse.items);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  useEffect(() => {
    if (!hasInitialized || !user || !isAdmin) {
      setIsLoading(false);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setError(null);

    void adminService
      .listTrainingTemplates()
      .then((response) => {
        if (!isActive) {
          return;
        }
        setTemplates(response.items);
        setSelectedTemplateId((current) => current || response.items[0]?.public_id || "");
      })
      .catch((fetchError) => {
        if (isActive) {
          setError(fetchError instanceof Error ? fetchError.message : "Unable to load templates.");
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [hasInitialized, isAdmin, user]);

  useEffect(() => {
    if (!selectedTemplate) {
      return;
    }
    setEditTemplateCode(selectedTemplate.template_code);
    setEditName(selectedTemplate.name);
    setEditAnalysisType(selectedTemplate.analysis_type);
    setEditDifficultyLevel(selectedTemplate.difficulty_level || "");
    setEditStatus(selectedTemplate.status);
    setEditCurrentVersion(selectedTemplate.current_version || "");
    setEditDescription(selectedTemplate.description || "");
  }, [selectedTemplate]);

  useEffect(() => {
    if (!selectedTemplateId || !isAdmin) {
      return;
    }
    void loadSelectedDetails(selectedTemplateId).catch((fetchError) => {
      setError(fetchError instanceof Error ? fetchError.message : "Unable to load template detail.");
    });
  }, [isAdmin, selectedTemplateId]);

  const resetExampleForm = () => {
    setEditingVideoId(null);
    setVideoTitle("");
    setVideoVersion("");
    setVideoDescription("");
    setVideoBucket("");
    setVideoObjectKey("");
    setVideoFileName("");
    setVideoContentType("video/mp4");
    setVideoDuration("");
    setVideoCoverUrl("");
    setVideoSortOrder("0");
    setVideoStatus("active");
  };

  const startEditExample = (videoItem: AdminTemplateExampleVideoRead) => {
    setEditingVideoId(videoItem.public_id);
    setVideoTitle(videoItem.title);
    setVideoVersion(videoItem.template_version || "");
    setVideoDescription(videoItem.description || "");
    setVideoBucket(videoItem.bucket_name);
    setVideoObjectKey(videoItem.object_key);
    setVideoFileName(videoItem.file_name);
    setVideoContentType(videoItem.content_type);
    setVideoDuration(videoItem.duration_seconds === null ? "" : String(videoItem.duration_seconds));
    setVideoCoverUrl(videoItem.cover_url || "");
    setVideoSortOrder(String(videoItem.sort_order));
    setVideoStatus(videoItem.status);
  };

  const createTemplate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmittingTemplate(true);
    setError(null);
    setMessage(null);

    try {
      const template = await adminService.createTrainingTemplate({
        template_code: templateCode.trim(),
        name: name.trim(),
        analysis_type: analysisType,
        description: description.trim() || null,
        difficulty_level: difficultyLevel.trim() || null,
        status: "draft",
      });
      setMessage(`Created template ${template.name}.`);
      setTemplateCode("");
      setName("");
      setDescription("");
      setDifficultyLevel("");
      await loadTemplates();
      setSelectedTemplateId(template.public_id);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create template.");
    } finally {
      setIsSubmittingTemplate(false);
    }
  };

  const saveTemplate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTemplate) {
      return;
    }
    setIsSavingTemplate(true);
    setError(null);
    setMessage(null);

    try {
      const template = await adminService.updateTrainingTemplate(selectedTemplate.public_id, {
        template_code: editTemplateCode.trim(),
        name: editName.trim(),
        analysis_type: editAnalysisType,
        description: editDescription.trim() || null,
        difficulty_level: editDifficultyLevel.trim() || null,
        status: editStatus,
        current_version: editCurrentVersion.trim() || null,
      });
      setMessage(`Updated template ${template.name}.`);
      await loadTemplates();
      setSelectedTemplateId(template.public_id);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to update template.");
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const createVersion = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTemplateId) {
      return;
    }
    setIsSubmittingVersion(true);
    setError(null);
    setMessage(null);

    try {
      const createdVersion = await adminService.createTrainingTemplateVersion(selectedTemplateId, {
        version: version.trim(),
        scoring_rules: parseJsonField(scoringRules, {}) ?? {},
        status: "active",
        is_default: isDefault,
      });
      setMessage(`Created version ${createdVersion.version}.`);
      setVersion("v1");
      setScoringRules("{\n  \"target_score\": 85\n}");
      await loadTemplates();
      await loadSelectedDetails(selectedTemplateId);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create version.");
    } finally {
      setIsSubmittingVersion(false);
    }
  };

  const updateVersionStatus = async (
    versionItem: AdminTrainingTemplateVersionRead,
    patch: { status?: string; is_default?: boolean },
  ) => {
    if (!selectedTemplateId) {
      return;
    }
    setError(null);
    setMessage(null);
    try {
      const updatedVersion = await adminService.updateTrainingTemplateVersion(
        selectedTemplateId,
        versionItem.public_id,
        patch,
      );
      setMessage(`Updated version ${updatedVersion.version}.`);
      await loadTemplates();
      await loadSelectedDetails(selectedTemplateId);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to update version.");
    }
  };

  const saveExampleVideo = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTemplateId) {
      return;
    }
    setIsSavingVideo(true);
    setError(null);
    setMessage(null);

    const payload = {
      template_version: videoVersion.trim() || null,
      title: videoTitle.trim(),
      description: videoDescription.trim() || null,
      storage_provider: "supabase" as const,
      bucket_name: videoBucket.trim(),
      object_key: videoObjectKey.trim(),
      file_name: videoFileName.trim(),
      content_type: videoContentType.trim() || "video/mp4",
      duration_seconds: numberOrNull(videoDuration),
      cover_url: videoCoverUrl.trim() || null,
      sort_order: numberOrNull(videoSortOrder) ?? 0,
      status: videoStatus,
    };

    try {
      const savedVideo = editingVideoId
        ? await adminService.updateTemplateExampleVideo(selectedTemplateId, editingVideoId, payload)
        : await adminService.createTemplateExampleVideo(selectedTemplateId, payload);
      setMessage(`Saved example video ${savedVideo.title}.`);
      resetExampleForm();
      await loadSelectedDetails(selectedTemplateId);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save example video.");
    } finally {
      setIsSavingVideo(false);
    }
  };

  const deleteExampleVideo = async (videoItem: AdminTemplateExampleVideoRead) => {
    if (!selectedTemplateId) {
      return;
    }
    setError(null);
    setMessage(null);
    try {
      await adminService.deleteTemplateExampleVideo(selectedTemplateId, videoItem.public_id);
      setMessage(`Deleted example video ${videoItem.title}.`);
      if (editingVideoId === videoItem.public_id) {
        resetExampleForm();
      }
      await loadSelectedDetails(selectedTemplateId);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to delete example video.");
    }
  };

  const updateExampleVideoStatus = async (
    videoItem: AdminTemplateExampleVideoRead,
    status: string,
  ) => {
    if (!selectedTemplateId) {
      return;
    }
    setError(null);
    setMessage(null);
    try {
      const updatedVideo = await adminService.updateTemplateExampleVideo(
        selectedTemplateId,
        videoItem.public_id,
        { status },
      );
      setMessage(`${updatedVideo.title} is now ${updatedVideo.status}.`);
      if (editingVideoId === videoItem.public_id) {
        setVideoStatus(updatedVideo.status);
      }
      await loadSelectedDetails(selectedTemplateId);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to update example video status.",
      );
    }
  };

  if (!hasInitialized || isInitializing || !user) {
    return <AdminLoadingSurface />;
  }

  if (!isAdmin) {
    return <AdminForbiddenSurface user={user} />;
  }

  return (
    <AdminShell user={user} title="Training Templates" breadcrumb={["Templates"]}>
      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}
      {message ? (
        <div className="flex items-center gap-2 rounded-lg border border-[#d8ff5d]/24 bg-[#d8ff5d]/10 px-4 py-3 text-sm font-medium text-[#efffb8]">
          <CheckCircle2 className="h-4 w-4" />
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_28rem]">
        <section className="min-w-0 rounded-lg border border-white/10 bg-white/[0.055] p-5 backdrop-blur-2xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[0.68rem] uppercase tracking-[0.22em] text-white/42">
                Template registry
              </div>
              <h1 className="mt-2 font-[var(--font-display)] text-2xl font-bold text-white">
                Training templates
              </h1>
            </div>
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-[#65f7ff]" /> : null}
          </div>

          <div className="mt-5 overflow-hidden rounded-lg border border-white/10 bg-black/18">
            <div className="overflow-x-auto">
              <table className="min-w-[920px] w-full border-collapse text-left text-sm">
                <thead className="border-b border-white/10 bg-white/[0.035] text-[0.68rem] uppercase tracking-[0.18em] text-white/42">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Template</th>
                    <th className="px-4 py-3 font-semibold">Motion</th>
                    <th className="px-4 py-3 text-right font-semibold">Versions</th>
                    <th className="px-4 py-3 font-semibold">Current</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {templates.map((template) => {
                    const isSelected = selectedTemplateId === template.public_id;
                    return (
                      <tr
                        key={template.public_id}
                        className={cn(
                          "cursor-pointer transition hover:bg-[#65f7ff]/[0.055]",
                          isSelected ? "bg-[#65f7ff]/[0.075]" : "",
                        )}
                        onClick={() => setSelectedTemplateId(template.public_id)}
                      >
                        <td className="px-4 py-4">
                          <div className="font-semibold text-white">{template.name}</div>
                          <div className="mt-1 text-xs uppercase tracking-[0.16em] text-white/38">
                            {template.template_code}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-white/62">
                          {analysisTypeLabels[template.analysis_type]}
                        </td>
                        <td className="px-4 py-4 text-right font-semibold text-white">
                          {template.version_count}
                        </td>
                        <td className="px-4 py-4 text-white/62">{template.current_version || "--"}</td>
                        <td className="px-4 py-4">
                          <span
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em]",
                              statusTone(template.status),
                            )}
                          >
                            {template.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {templates.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-white/48">
                        No templates yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 grid gap-6 2xl:grid-cols-2">
            <section className="rounded-lg border border-white/10 bg-black/16 p-4">
              <div className={labelClass}>Template editor</div>
              <h2 className="mt-2 font-[var(--font-display)] text-xl font-bold text-white">
                {selectedTemplate ? selectedTemplate.name : "Select a template"}
              </h2>
              {selectedTemplate ? (
                <form className="mt-5 space-y-4" onSubmit={saveTemplate}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-2">
                      <span className={labelClass}>Code</span>
                      <input className={fieldClass} value={editTemplateCode} onChange={(event) => setEditTemplateCode(event.target.value)} required />
                    </label>
                    <label className="block space-y-2">
                      <span className={labelClass}>Name</span>
                      <input className={fieldClass} value={editName} onChange={(event) => setEditName(event.target.value)} required />
                    </label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="block space-y-2">
                      <span className={labelClass}>Motion</span>
                      <select className={fieldClass} value={editAnalysisType} onChange={(event) => setEditAnalysisType(event.target.value as ReportAnalysisType)}>
                        {analysisTypes.map((type) => (
                          <option key={type} value={type}>
                            {analysisTypeLabels[type]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-2">
                      <span className={labelClass}>Status</span>
                      <select className={fieldClass} value={editStatus} onChange={(event) => setEditStatus(event.target.value)}>
                        <option value="draft">draft</option>
                        <option value="active">active</option>
                        <option value="archived">archived</option>
                      </select>
                    </label>
                    <label className="block space-y-2">
                      <span className={labelClass}>Current</span>
                      <input className={fieldClass} value={editCurrentVersion} onChange={(event) => setEditCurrentVersion(event.target.value)} />
                    </label>
                  </div>
                  <label className="block space-y-2">
                    <span className={labelClass}>Difficulty</span>
                    <input className={fieldClass} value={editDifficultyLevel} onChange={(event) => setEditDifficultyLevel(event.target.value)} />
                  </label>
                  <label className="block space-y-2">
                    <span className={labelClass}>Description</span>
                    <textarea className={`${fieldClass} min-h-20 resize-none py-3`} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} />
                  </label>
                  <button
                    type="submit"
                    disabled={isSavingTemplate}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#d8ff5d]/32 bg-[#d8ff5d]/10 px-4 text-sm font-semibold text-[#f1ffc1] transition hover:bg-[#d8ff5d]/16 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save template
                  </button>
                </form>
              ) : (
                <p className="mt-4 text-sm leading-6 text-white/50">
                  Pick a template to edit its metadata, versions, and example videos.
                </p>
              )}
            </section>

            <section className="rounded-lg border border-white/10 bg-black/16 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className={labelClass}>Versions</div>
                  <h2 className="mt-2 font-[var(--font-display)] text-xl font-bold text-white">
                    Status maintenance
                  </h2>
                </div>
                {isLoadingDetails ? <Loader2 className="h-5 w-5 animate-spin text-[#65f7ff]" /> : null}
              </div>
              <div className="mt-4 space-y-3">
                {versions.map((versionItem) => (
                  <div key={versionItem.public_id} className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-white">{versionItem.version}</div>
                        <div className="mt-1 text-xs text-white/42">
                          {formatDateTime(versionItem.published_at || versionItem.created_at)}
                        </div>
                      </div>
                      <span className={cn("rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em]", statusTone(versionItem.status))}>
                        {versionItem.is_default ? "default" : versionItem.status}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => updateVersionStatus(versionItem, { status: versionItem.status === "active" ? "draft" : "active" })}
                        className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[#65f7ff]/24 bg-[#65f7ff]/10 px-3 text-xs font-semibold text-[#dffbff] transition hover:bg-[#65f7ff]/16"
                      >
                        {versionItem.status === "active" ? "Move to draft" : "Activate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateVersionStatus(versionItem, { is_default: true })}
                        disabled={versionItem.is_default}
                        className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[#d8ff5d]/24 bg-[#d8ff5d]/10 px-3 text-xs font-semibold text-[#f1ffc1] transition hover:bg-[#d8ff5d]/16 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Set default
                      </button>
                    </div>
                  </div>
                ))}
                {versions.length === 0 ? (
                  <div className="rounded-lg border border-white/10 bg-black/18 p-5 text-center text-sm text-white/48">
                    No versions for this template.
                  </div>
                ) : null}
              </div>
            </section>
          </div>

          <section className="mt-6 rounded-lg border border-white/10 bg-black/16 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className={labelClass}>Example videos</div>
                <h2 className="mt-2 font-[var(--font-display)] text-xl font-bold text-white">
                  Metadata maintenance
                </h2>
              </div>
              <button
                type="button"
                onClick={resetExampleForm}
                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3 text-xs font-semibold text-white/72 transition hover:border-[#65f7ff]/32 hover:bg-[#65f7ff]/10"
              >
                <Plus className="h-4 w-4" />
                New example
              </button>
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
              <div className="overflow-hidden rounded-lg border border-white/10 bg-black/18">
                <div className="overflow-x-auto">
                  <table className="min-w-[820px] w-full border-collapse text-left text-sm">
                    <thead className="border-b border-white/10 bg-white/[0.035] text-[0.68rem] uppercase tracking-[0.18em] text-white/42">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Video</th>
                        <th className="px-4 py-3 font-semibold">Object</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 text-right font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/8">
                      {exampleVideos.map((videoItem) => (
                        <tr key={videoItem.public_id} className="hover:bg-[#65f7ff]/[0.055]">
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2 font-semibold text-white">
                              <Video className="h-4 w-4 text-[#65f7ff]" />
                              {videoItem.title}
                            </div>
                            <div className="mt-1 text-xs text-white/42">
                              {videoItem.template_version || "any version"} / order {videoItem.sort_order}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-white/58">
                            <div className="max-w-[24rem] truncate">{videoItem.bucket_name}</div>
                            <div className="mt-1 max-w-[24rem] truncate text-xs text-white/38">
                              {videoItem.object_key}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className={cn("rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.14em]", statusTone(videoItem.status))}>
                              {videoItem.status}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  updateExampleVideoStatus(
                                    videoItem,
                                    videoItem.status === "active" ? "hidden" : "active",
                                  )
                                }
                                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3 text-xs font-semibold text-white/72 transition hover:border-[#d8ff5d]/28 hover:bg-[#d8ff5d]/10"
                              >
                                {videoItem.status === "active" ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                                {videoItem.status === "active" ? "Hide" : "Show"}
                              </button>
                              <button
                                type="button"
                                onClick={() => startEditExample(videoItem)}
                                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-[#65f7ff]/24 bg-[#65f7ff]/10 px-3 text-xs font-semibold text-[#dffbff] transition hover:bg-[#65f7ff]/16"
                              >
                                <Pencil className="h-4 w-4" />
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteExampleVideo(videoItem)}
                                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-red-300/24 bg-red-400/10 px-3 text-xs font-semibold text-red-100 transition hover:bg-red-400/16"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {exampleVideos.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-sm text-white/48">
                            No example videos yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              <form className="rounded-lg border border-white/10 bg-white/[0.035] p-4" onSubmit={saveExampleVideo}>
                <div className={labelClass}>{editingVideoId ? "Edit example" : "Add example"}</div>
                <div className="mt-4 space-y-3">
                  <label className="block space-y-2">
                    <span className={labelClass}>Title</span>
                    <input className={fieldClass} value={videoTitle} onChange={(event) => setVideoTitle(event.target.value)} required />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-2">
                      <span className={labelClass}>Version</span>
                      <input className={fieldClass} value={videoVersion} onChange={(event) => setVideoVersion(event.target.value)} />
                    </label>
                    <label className="block space-y-2">
                      <span className={labelClass}>Status</span>
                      <select className={fieldClass} value={videoStatus} onChange={(event) => setVideoStatus(event.target.value)}>
                        <option value="active">active</option>
                        <option value="hidden">hidden</option>
                        <option value="draft">draft</option>
                        <option value="archived">archived</option>
                      </select>
                    </label>
                  </div>
                  <label className="block space-y-2">
                    <span className={labelClass}>Description</span>
                    <textarea className={`${fieldClass} min-h-20 resize-none py-3`} value={videoDescription} onChange={(event) => setVideoDescription(event.target.value)} />
                  </label>
                  <label className="block space-y-2">
                    <span className={labelClass}>Bucket</span>
                    <input className={fieldClass} value={videoBucket} onChange={(event) => setVideoBucket(event.target.value)} required />
                  </label>
                  <label className="block space-y-2">
                    <span className={labelClass}>Object key</span>
                    <input className={fieldClass} value={videoObjectKey} onChange={(event) => setVideoObjectKey(event.target.value)} required />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-2">
                      <span className={labelClass}>File</span>
                      <input className={fieldClass} value={videoFileName} onChange={(event) => setVideoFileName(event.target.value)} required />
                    </label>
                    <label className="block space-y-2">
                      <span className={labelClass}>Content type</span>
                      <input className={fieldClass} value={videoContentType} onChange={(event) => setVideoContentType(event.target.value)} required />
                    </label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-2">
                      <span className={labelClass}>Duration</span>
                      <input className={fieldClass} value={videoDuration} onChange={(event) => setVideoDuration(event.target.value)} inputMode="decimal" />
                    </label>
                    <label className="block space-y-2">
                      <span className={labelClass}>Sort</span>
                      <input className={fieldClass} value={videoSortOrder} onChange={(event) => setVideoSortOrder(event.target.value)} inputMode="numeric" />
                    </label>
                  </div>
                  <label className="block space-y-2">
                    <span className={labelClass}>Cover URL</span>
                    <input className={fieldClass} value={videoCoverUrl} onChange={(event) => setVideoCoverUrl(event.target.value)} />
                  </label>
                  <button
                    type="submit"
                    disabled={isSavingVideo || !selectedTemplateId}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#d8ff5d]/32 bg-[#d8ff5d]/10 px-4 text-sm font-semibold text-[#f1ffc1] transition hover:bg-[#d8ff5d]/16 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingVideo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save example
                  </button>
                </div>
              </form>
            </div>
          </section>
        </section>

        <aside className="space-y-5">
          <section className="rounded-lg border border-white/10 bg-white/[0.055] p-5 backdrop-blur-2xl">
            <div className={labelClass}>Create template</div>
            <h2 className="mt-2 font-[var(--font-display)] text-xl font-bold text-white">
              Add template
            </h2>
            <form className="mt-5 space-y-4" onSubmit={createTemplate}>
              <label className="block space-y-2">
                <span className={labelClass}>Code</span>
                <input className={fieldClass} value={templateCode} onChange={(event) => setTemplateCode(event.target.value)} required />
              </label>
              <label className="block space-y-2">
                <span className={labelClass}>Name</span>
                <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} required />
              </label>
              <label className="block space-y-2">
                <span className={labelClass}>Motion</span>
                <select className={fieldClass} value={analysisType} onChange={(event) => setAnalysisType(event.target.value as ReportAnalysisType)}>
                  {analysisTypes.map((type) => (
                    <option key={type} value={type}>
                      {analysisTypeLabels[type]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2">
                <span className={labelClass}>Difficulty</span>
                <input className={fieldClass} value={difficultyLevel} onChange={(event) => setDifficultyLevel(event.target.value)} />
              </label>
              <label className="block space-y-2">
                <span className={labelClass}>Description</span>
                <textarea className={`${fieldClass} min-h-20 resize-none py-3`} value={description} onChange={(event) => setDescription(event.target.value)} />
              </label>
              <button
                type="submit"
                disabled={isSubmittingTemplate}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#65f7ff]/34 bg-[#65f7ff]/12 px-4 text-sm font-semibold text-[#dffbff] transition hover:bg-[#65f7ff]/18 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmittingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create template
              </button>
            </form>
          </section>

          <section className="rounded-lg border border-white/10 bg-white/[0.055] p-5 backdrop-blur-2xl">
            <div className={labelClass}>Create version</div>
            <h2 className="mt-2 font-[var(--font-display)] text-xl font-bold text-white">
              Add version
            </h2>
            <form className="mt-5 space-y-4" onSubmit={createVersion}>
              <label className="block space-y-2">
                <span className={labelClass}>Template</span>
                <select className={fieldClass} value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)} required>
                  <option value="">Select template</option>
                  {templates.map((template) => (
                    <option key={template.public_id} value={template.public_id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2">
                <span className={labelClass}>Version</span>
                <input className={fieldClass} value={version} onChange={(event) => setVersion(event.target.value)} required />
              </label>
              <label className="block space-y-2">
                <span className={labelClass}>Scoring rules JSON</span>
                <textarea
                  className={`${fieldClass} min-h-36 resize-y py-3 font-mono text-xs`}
                  value={scoringRules}
                  onChange={(event) => setScoringRules(event.target.value)}
                  required
                />
              </label>
              <label className="flex min-h-11 items-center justify-between gap-4 rounded-lg border border-white/10 bg-black/20 px-3">
                <span className="text-sm font-semibold text-white/72">Set as default</span>
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(event) => setIsDefault(event.target.checked)}
                  className="h-4 w-4 accent-[#d8ff5d]"
                />
              </label>
              <button
                type="submit"
                disabled={isSubmittingVersion || !selectedTemplateId}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#d8ff5d]/32 bg-[#d8ff5d]/10 px-4 text-sm font-semibold text-[#f1ffc1] transition hover:bg-[#d8ff5d]/16 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmittingVersion ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create version
              </button>
            </form>
          </section>
        </aside>
      </div>
    </AdminShell>
  );
}
