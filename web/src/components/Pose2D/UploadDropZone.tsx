'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  FileVideo,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from 'lucide-react';

import { getAllTemplates } from '@/config/templates';
import { supabase } from '@/lib/supabaseClient';
import {
  uploadService,
  type CompletedUploadSession,
  type UploadInitResponse,
} from '@/services/uploads';

import type { AnalysisType } from './types';

interface UploadDropzoneProps {
  analysisType?: AnalysisType;
  classPublicId?: string | null;
  taskAssignmentPublicId?: string | null;
  templateCode?: string | null;
  templateVersion?: string | null;
  onFileSelect: (
    file: File | null,
    videoUrl?: string,
    uploadSession?: CompletedUploadSession,
  ) => void;
}

function getContentType(file: File): string {
  return file.type || 'application/octet-stream';
}

type SupabaseUploadResult = {
  signedUrl: string;
};

function getUploadErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }

  return String(error);
}

function isFetchNetworkError(error: unknown): boolean {
  const message = getUploadErrorMessage(error).toLowerCase();
  return message === 'failed to fetch' || message.includes('networkerror');
}

async function uploadThroughLocalProxy(
  file: File,
  uploadInit: UploadInitResponse,
): Promise<SupabaseUploadResult> {
  const formData = new FormData();
  formData.set('file', file);
  formData.set('bucketName', uploadInit.bucket_name);
  formData.set('objectKey', uploadInit.object_key);
  formData.set('contentType', getContentType(file));

  const response = await fetch('/api/storage/upload', {
    method: 'POST',
    body: formData,
  });

  const payload = (await response.json().catch(() => null)) as {
    signedUrl?: string;
    error?: string;
  } | null;

  if (!response.ok || !payload?.signedUrl) {
    throw new Error(payload?.error || `Local upload proxy failed with ${response.status}`);
  }

  return { signedUrl: payload.signedUrl };
}

async function uploadVideoToStorage(
  file: File,
  uploadInit: UploadInitResponse,
): Promise<SupabaseUploadResult> {
  try {
    const { error: uploadError } = await supabase.storage
      .from(uploadInit.bucket_name)
      .upload(uploadInit.object_key, file, {
        contentType: getContentType(file),
      });

    if (uploadError) throw uploadError;

    const { data: urlData, error: urlError } = await supabase.storage
      .from(uploadInit.bucket_name)
      .createSignedUrl(uploadInit.object_key, 315360000);

    if (urlError) throw urlError;
    if (!urlData?.signedUrl) {
      throw new Error('Supabase did not return a signed video URL.');
    }

    return { signedUrl: urlData.signedUrl };
  } catch (error) {
    if (isFetchNetworkError(error)) {
      console.warn('Supabase browser upload failed; retrying through local proxy.', error);
      return uploadThroughLocalProxy(file, uploadInit);
    }

    throw error;
  }
}

export default function UploadDropzone({
  analysisType = 'shooting',
  classPublicId,
  taskAssignmentPublicId,
  templateCode,
  templateVersion,
  onFileSelect,
}: UploadDropzoneProps) {
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setUploading(true);
      setErrorMsg('');

      try {
        const templates = getAllTemplates(analysisType);
        const activeTemplate =
          templates.find((template) => template.templateId === templateCode) ?? templates[0];
        const uploadInit = await uploadService.init({
          analysis_type: analysisType,
          file_name: file.name,
          content_type: getContentType(file),
          file_size: file.size,
          template_code: activeTemplate?.templateId,
          template_version: templateVersion ?? 'v1',
          class_public_id: classPublicId ?? undefined,
          task_assignment_public_id: taskAssignmentPublicId ?? undefined,
          source_type: taskAssignmentPublicId ? 'coach_task' : 'free_practice',
        });

        const storageUpload = await uploadVideoToStorage(file, uploadInit);

        const completedUpload = await uploadService.complete({
          upload_task_public_id: uploadInit.upload_task_public_id,
          original_file_name: file.name,
          url: storageUpload.signedUrl,
        });

        const videoUrl =
          completedUpload.video.cdn_url ?? completedUpload.video.url ?? storageUpload.signedUrl;
        const uploadSession: CompletedUploadSession = {
          sessionPublicId: completedUpload.session_public_id,
          uploadTaskPublicId: completedUpload.upload_task_public_id,
          bucketName: completedUpload.video.bucket_name,
          objectKey: completedUpload.video.object_key,
          videoUrl,
          videoPublicId: completedUpload.video.public_id,
        };

        console.log('Upload completed through backend session:', uploadSession);
        onFileSelect(file, videoUrl, uploadSession);
      } catch (error: unknown) {
        console.error('Upload failed:', error);
        const message = getUploadErrorMessage(error);
        setErrorMsg(message || 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [
      analysisType,
      classPublicId,
      onFileSelect,
      taskAssignmentPublicId,
      templateCode,
      templateVersion,
    ]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': [] },
    maxFiles: 1,
    disabled: uploading,
  });

  return (
    <div className="grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
      <section className="analysis-surface rounded-[28px] border border-white/10 p-5 sm:p-6">
        <div className="font-[var(--font-display)] text-[0.68rem] uppercase tracking-[0.3em] text-white/42">
          Upload access
        </div>
        <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">
          Upload video area
        </h3>
        <p className="mt-3 text-sm leading-6 text-white/58">
          Drag the video to the circular upload icon on the right.
        </p>

        <div className="mt-6 grid gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
            <div className="text-[0.68rem] uppercase tracking-[0.28em] text-white/40">
              Session notes
            </div>
            <p className="mt-3 text-sm leading-6 text-white/58">
              {taskAssignmentPublicId
                ? 'This upload will count toward the selected coach task after you save the report.'
                : 'After upload, the workspace will automatically scan the full video before the report unlocks.'}
            </p>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-300/18 bg-emerald-300/10 px-4 py-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />
            <p className="text-sm leading-6 text-white/58">
              Please keep this page open while upload and automatic analysis complete.
            </p>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-white/70" />
            <p className="text-sm leading-6 text-white/58">
              You can preview the clip after analysis starts; manual playback is only needed as a fallback.
            </p>
          </div>
        </div>
      </section>

      <section className="analysis-surface rounded-[28px] border border-white/10 p-4 sm:p-5">
        <div
          {...getRootProps()}
          className={[
            'group relative min-h-[420px] cursor-pointer overflow-hidden rounded-[26px] border border-dashed p-5 transition-all duration-300 sm:p-6',
            'border-white/14 bg-white/[0.03] hover:border-white/24 hover:bg-white/[0.05]',
            isDragActive ? 'border-sky-300/40 bg-sky-300/10' : '',
            uploading ? 'pointer-events-none opacity-70' : '',
          ].join(' ')}
        >
          <input {...getInputProps()} />

          <div className="mb-4 flex flex-wrap items-center justify-center gap-2 sm:absolute sm:inset-x-6 sm:top-6 sm:mb-0 sm:justify-start">
            <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[0.68rem] uppercase tracking-[0.28em] text-white/55 backdrop-blur-md">
              MP4 / MOV / WEBM
            </div>
          </div>

          <div className="relative flex h-full flex-col justify-between">
            <div />

            <div className="mx-auto flex max-w-xl flex-col items-center text-center">
              <div
                className={[
                  'flex h-20 w-20 items-center justify-center rounded-full border border-white/12 bg-white/10 backdrop-blur-xl transition-transform duration-300',
                  isDragActive ? 'scale-105' : 'group-hover:scale-105',
                ].join(' ')}
              >
                {uploading ? (
                  <div className="h-9 w-9 rounded-full border-2 border-sky-300 border-t-transparent animate-spin" />
                ) : (
                  <UploadCloud
                    className={[
                      'h-9 w-9 transition-colors duration-300',
                      isDragActive ? 'text-sky-200' : 'text-white',
                    ].join(' ')}
                  />
                )}
              </div>

              <h3 className="mt-6 font-[var(--font-display)] text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">
                {uploading ? 'Uploading to cloud workspace' : 'Drop your video here'}
              </h3>
              <p className="mt-3 max-w-lg text-sm leading-7 text-white/60 sm:text-base">
                {uploading
                  ? 'Please keep this page open while the secure upload finishes.'
                  : 'Drag in a clip or tap to browse. The existing upload behavior stays the same, but the layout now feels more intentional on mobile and desktop.'}
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 backdrop-blur-md">
                <div className="text-[0.68rem] uppercase tracking-[0.26em] text-white/42">
                  Formats
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm text-white/72">
                  <FileVideo className="h-4 w-4" />
                  MP4, MOV, WEBM
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 backdrop-blur-md">
                <div className="text-[0.68rem] uppercase tracking-[0.26em] text-white/42">
                  Behavior
                </div>
                <div className="mt-2 text-sm text-white/72">
                  {taskAssignmentPublicId ? 'Task session' : 'Backend session'}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 backdrop-blur-md">
                <div className="text-[0.68rem] uppercase tracking-[0.26em] text-white/42">
                  State
                </div>
                <div className="mt-2 text-sm text-white/72">
                  Ready for upload
                </div>
              </div>
            </div>
          </div>
        </div>

        {errorMsg ? (
          <p className="mt-4 text-sm text-rose-300">{errorMsg}</p>
        ) : null}
      </section>
    </div>
  );
}
