"use client";

import { usePoseCopy } from "@/components/Pose2D/poseCopy";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { getAllTemplates, type ActionTemplate } from "@/config/templates";
import { buildTrainingTemplateCatalog, type TrainingTemplateCatalogItem } from "@/lib/trainingTemplateCatalog";
import { meService, type TaskDetailRead } from "@/services/me";
import { templateService } from "@/services/templates";
import type { CompletedUploadSession } from "@/services/uploads";
import PoseWorkspaceShell from "./PoseWorkspaceShell";
import MovementPreview from "./TrainingMovementPreview";
import MovementTemplatePicker from "./TrainingTemplatePicker";

const UploadDropzone = dynamic(() => import("./UploadDropZone"), { ssr: false });
const PoseAnalysisView = dynamic(() => import("./PoseAnalysisView"), { ssr: false });

type Mode = ActionTemplate["mode"];
const templatesByMode: Record<Mode, ActionTemplate[]> = {
  training: getAllTemplates("training"),
  dribbling: getAllTemplates("dribbling"),
  shooting: getAllTemplates("shooting"),
};

type CatalogLookup = { mode: Mode; items: TrainingTemplateCatalogItem[]; error?: string };
type TaskLookup = { assignmentId: string; task?: TaskDetailRead; error?: string };
type Upload = { file: File | null; url: string | null; session: CompletedUploadSession | null };

export default function MovementAnalysisWorkspace({ mode }: { mode: Mode }) {
  const { language } = usePoseCopy();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const assignmentId = searchParams.get("taskAssignmentId");
  const linkedCode = searchParams.get("templateCode");
  const linkedVersion = searchParams.get("templateVersion");
  const templates = templatesByMode[mode];
  const [catalogLookup, setCatalogLookup] = useState<CatalogLookup>();
  const [taskLookup, setTaskLookup] = useState<TaskLookup>();
  const [selection, setSelection] = useState<{ search: string; code: string }>();
  const [upload, setUpload] = useState<Upload | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    templateService.listTemplates(false, mode)
      .then((remoteTemplates) => buildTrainingTemplateCatalog(templates, remoteTemplates))
      .then((items) => {
        if (!cancelled) setCatalogLookup({ mode, items });
      })
      .catch((error: unknown) => {
        if (!cancelled) setCatalogLookup({
          mode,
          items: [],
          error: error instanceof Error ? error.message : "Unable to load the movement catalog.",
        });
      });
    return () => { cancelled = true; };
  }, [mode, templates]);

  useEffect(() => {
    if (!assignmentId) return;
    let cancelled = false;
    meService.getTask(assignmentId)
      .then((task) => {
        if (!cancelled) setTaskLookup({ assignmentId, task });
      })
      .catch((error: unknown) => {
        if (!cancelled) setTaskLookup({
          assignmentId,
          error: error instanceof Error ? error.message : "Unable to load the coach task.",
        });
      });
    return () => { cancelled = true; };
  }, [assignmentId]);

  const catalog = catalogLookup?.mode === mode ? catalogLookup : null;
  const lookup = taskLookup?.assignmentId === assignmentId ? taskLookup : null;
  const task = lookup?.task;
  const taskLoading = Boolean(assignmentId && !lookup);
  const taskIsValid = Boolean(task?.analysis_type === mode && task.template_code);
  const taskError = lookup?.error ?? (task && !taskIsValid
    ? "This coach task does not have a movement for this analysis type."
    : null);
  const manualSelection = selection?.search === search ? selection.code : null;
  const selectedCode = assignmentId ? (taskIsValid ? task?.template_code ?? null : null) : manualSelection ?? linkedCode;
  const selectedTemplate = templates.find((template) => template.templateId === selectedCode);
  const selectedItem = catalog?.items.find((item) => item.template.templateId === selectedCode) ?? null;
  const selectedVersion = selectedItem?.remoteVersion?.version;
  const linkedVersionIsStale = Boolean(!assignmentId && !manualSelection && linkedVersion && selectedVersion && linkedVersion !== selectedVersion);
  const pickerError = taskError ?? catalog?.error;
  const uploadDisabled = taskLoading || !catalog || Boolean(pickerError) || linkedVersionIsStale || selectedItem?.availability !== "ready";
  const disabledReason = pickerError
    ?? (taskLoading || !catalog ? "Checking which movements are available…" : null)
    ?? (linkedVersionIsStale ? "This link uses an older version. Select the movement again to use the active version." : null)
    ?? (selectedCode
      ? selectedItem?.availabilityMessage ?? "This movement is unavailable in this app."
      : "Choose a movement before uploading your video.");

  function select(code: string) {
    if (!assignmentId && !uploading) setSelection({ search, code });
  }

  function handleFileSelect(file: File | null, url?: string, session?: CompletedUploadSession) {
    setUpload(file || url ? { file, url: url ?? null, session: session ?? null } : null);
  }

  return (
    <PoseWorkspaceShell
      mode={mode}
      hasUpload={Boolean(upload)}
      movementPreview={!upload && (
        <MovementPreview
          templates={templates}
          selectedTemplate={selectedTemplate}
          catalogItem={selectedItem}
          locked={Boolean(assignmentId)}
          loading={taskLoading}
          selectionDisabled={uploading}
          canUpload={!uploadDisabled && !uploading}
          onSelect={select}
        />
      )}
    >
      {upload ? (
        <PoseAnalysisView
          language={language}
          file={upload.file}
          videoUrl={upload.url}
          uploadSession={upload.session}
          onClear={() => setUpload(null)}
          analysisType={mode}
          templateCode={upload.session?.templateCode ?? selectedCode}
          templateVersion={upload.session?.templateVersion ?? selectedVersion}
        />
      ) : (
        <div className="space-y-6 py-2">
          <MovementTemplatePicker
            items={catalog?.items ?? []}
            selectedCode={selectedCode}
            locked={Boolean(assignmentId)}
            selectionDisabled={uploading}
            loading={!catalog || taskLoading}
            error={pickerError}
            onSelect={select}
          />
          <div id="movement-video-upload" tabIndex={-1} className="scroll-mt-6">
            <UploadDropzone
              analysisType={mode}
              classPublicId={assignmentId ? task?.class_public_id : searchParams.get("classId")}
              taskAssignmentPublicId={assignmentId ? task?.public_id : null}
              templateCode={selectedCode}
              templateVersion={selectedVersion}
              templateContentHash={selectedItem?.contentHash}
              uploadDisabled={uploadDisabled}
              disabledReason={disabledReason}
              onUploadingChange={setUploading}
              onFileSelect={handleFileSelect}
            />
          </div>
        </div>
      )}
    </PoseWorkspaceShell>
  );
}
