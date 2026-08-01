'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

import PoseWorkspaceShell from '@/components/Pose2D/PoseWorkspaceShell';
import TrainingTemplatePicker from '@/components/Pose2D/TrainingTemplatePicker';
import { getAllTemplates } from '@/config/templates';
import {
  buildTrainingTemplateCatalog,
  type TrainingTemplateCatalogItem,
} from '@/lib/trainingTemplateCatalog';
import { meService } from '@/services/me';
import { templateService } from '@/services/templates';
import type { CompletedUploadSession } from '@/services/uploads';

const UploadDropzone = dynamic(
  () => import('../../../components/Pose2D/UploadDropZone'),
  { ssr: false }
);

const PoseAnalysisView = dynamic(
  () => import('../../../components/Pose2D/PoseAnalysisView'),
  { ssr: false }
);

export default function TrainingPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [cloudVideoUrl, setCloudVideoUrl] = useState<string | null>(null);
  const [uploadSession, setUploadSession] = useState<CompletedUploadSession | null>(null);
  const [catalog, setCatalog] = useState<TrainingTemplateCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [taskLoading, setTaskLoading] = useState(true);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [selectedTemplateCode, setSelectedTemplateCode] = useState<string | null>(null);
  const [taskContext, setTaskContext] = useState({
    classPublicId: null as string | null,
    taskAssignmentPublicId: null as string | null,
    templateCode: null as string | null,
  });

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const taskAssignmentPublicId = params.get('taskAssignmentId');

    if (!taskAssignmentPublicId) {
      const requestedTemplateCode = params.get('templateCode');
      setTaskContext({
        classPublicId: params.get('classId'),
        taskAssignmentPublicId: null,
        templateCode: null,
      });
      setSelectedTemplateCode(requestedTemplateCode);
      setTaskLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setTaskLoading(true);
    meService
      .getTask(taskAssignmentPublicId)
      .then((task) => {
        if (cancelled) return;
        if (task.analysis_type !== 'training' || !task.template_code) {
          throw new Error('This coach task does not have a valid training exercise.');
        }
        setTaskContext({
          classPublicId: task.class_public_id,
          taskAssignmentPublicId: task.public_id,
          templateCode: task.template_code,
        });
        setSelectedTemplateCode(task.template_code);
        setTaskError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setTaskError(
          error instanceof Error ? error.message : 'Unable to load the coach task.',
        );
      })
      .finally(() => {
        if (!cancelled) setTaskLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setCatalogLoading(true);
    templateService
      .listTemplates(false, 'training')
      .then((remoteTemplates) =>
        buildTrainingTemplateCatalog(
          getAllTemplates('training'),
          remoteTemplates,
        ),
      )
      .then((items) => {
        if (cancelled) return;
        setCatalog(items);
        setCatalogError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setCatalog([]);
        setCatalogError(
          error instanceof Error
            ? error.message
            : 'Unable to load the training template catalog.',
        );
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleClear = () => {
    setVideoFile(null);
    setCloudVideoUrl(null);
    setUploadSession(null);
  };

  const handleFileSelect = (
    file: File | null,
    url?: string,
    session?: CompletedUploadSession,
  ) => {
    console.log('File Selected:', file?.name);
    console.log('Cloud URL Received:', url);

    setVideoFile(file);
    if (url) {
      setCloudVideoUrl(url);
    }
    setUploadSession(session ?? null);
  };

  const selectedCatalogItem =
    catalog.find((item) => item.template.templateId === selectedTemplateCode) ?? null;
  const selectedTemplateReady = selectedCatalogItem?.availability === 'ready';
  const pickerError = taskError ?? catalogError;
  const uploadDisabled =
    taskLoading || catalogLoading || Boolean(pickerError) || !selectedTemplateReady;
  const disabledReason = pickerError
    ?? (selectedTemplateCode
      ? selectedCatalogItem?.availabilityMessage
        ?? 'The selected exercise is not available in this app build.'
      : 'Choose one exercise before uploading your video.');

  return (
    <PoseWorkspaceShell mode="training" hasUpload={Boolean(videoFile || cloudVideoUrl)}>
      {videoFile || cloudVideoUrl ? (
        <PoseAnalysisView
          file={videoFile}
          videoUrl={cloudVideoUrl}
          uploadSession={uploadSession}
          onClear={handleClear}
          analysisType="training"
          templateCode={uploadSession?.templateCode ?? selectedTemplateCode}
          templateVersion={uploadSession?.templateVersion ?? selectedCatalogItem?.template.version}
        />
      ) : (
        <div className="space-y-6 py-2">
          <TrainingTemplatePicker
            items={catalog}
            selectedCode={selectedTemplateCode}
            lockedCode={taskContext.templateCode}
            loading={catalogLoading || taskLoading}
            error={pickerError}
            onSelect={setSelectedTemplateCode}
          />
          <UploadDropzone
            analysisType="training"
            classPublicId={taskContext.classPublicId}
            taskAssignmentPublicId={taskContext.taskAssignmentPublicId}
            templateCode={selectedTemplateCode}
            templateVersion={selectedCatalogItem?.template.version}
            templateContentHash={selectedCatalogItem?.contentHash}
            uploadDisabled={uploadDisabled}
            disabledReason={disabledReason}
            onFileSelect={handleFileSelect}
          />
        </div>
      )}
    </PoseWorkspaceShell>
  );
}
