'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';

import PoseWorkspaceShell from '@/components/Pose2D/PoseWorkspaceShell';
import type { CompletedUploadSession } from '@/services/uploads';

const UploadDropzone = dynamic(
  () => import('../../../components/Pose2D/UploadDropZone'),
  { ssr: false }
);

const PoseAnalysisView = dynamic(
  () => import('../../../components/Pose2D/PoseAnalysisView'),
  { ssr: false }
);

export default function DribblingPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [cloudVideoUrl, setCloudVideoUrl] = useState<string | null>(null);
  const [uploadSession, setUploadSession] = useState<CompletedUploadSession | null>(null);

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

  return (
    <PoseWorkspaceShell mode="dribbling" hasUpload={Boolean(videoFile || cloudVideoUrl)}>
      {videoFile || cloudVideoUrl ? (
        <PoseAnalysisView
          file={videoFile}
          videoUrl={cloudVideoUrl}
          uploadSession={uploadSession}
          onClear={handleClear}
          analysisType="dribbling"
        />
      ) : (
        <div className="py-2">
          <UploadDropzone analysisType="dribbling" onFileSelect={handleFileSelect} />
        </div>
      )}
    </PoseWorkspaceShell>
  );
}
