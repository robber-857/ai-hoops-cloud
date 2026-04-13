'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';

import PoseWorkspaceShell from '@/components/Pose2D/PoseWorkspaceShell';

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

  const handleClear = () => {
    setVideoFile(null);
    setCloudVideoUrl(null);
  };

  const handleFileSelect = (file: File | null, url?: string) => {
    console.log('File Selected:', file?.name);
    console.log('Cloud URL Received:', url);

    setVideoFile(file);
    if (url) {
      setCloudVideoUrl(url);
    }
  };

  return (
    <PoseWorkspaceShell mode="dribbling" hasUpload={Boolean(videoFile || cloudVideoUrl)}>
      {videoFile || cloudVideoUrl ? (
        <PoseAnalysisView
          file={videoFile}
          videoUrl={cloudVideoUrl}
          onClear={handleClear}
          analysisType="dribbling"
        />
      ) : (
        <div className="py-2">
          <UploadDropzone onFileSelect={handleFileSelect} />
        </div>
      )}
    </PoseWorkspaceShell>
  );
}
