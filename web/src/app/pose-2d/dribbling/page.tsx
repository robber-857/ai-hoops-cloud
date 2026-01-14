'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Card } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { routes } from '@/lib/routes';

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
    console.log("📂 File Selected:", file?.name);
    console.log("☁️ Cloud URL Received:", url); 
    
    setVideoFile(file);
    if (url) {
      setCloudVideoUrl(url); 
    }
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      <div className="w-full max-w-5xl mx-auto space-y-6 sm:space-y-8">
        
        <header className="text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500 leading-tight">
            Dribbling motion analysis
          </h1>
          <p
            className="text-sm sm:text-base text-gray-400 mt-3 sm:mt-4 max-w-2xl mx-auto text-justify">
            To drag the progress bar, double-click the position you want to jump to. The video will automatically replay after it finishes. To obtain a stable score, please ensure the video plays for more than 10 seconds before clicking the view analysis button. During the upload process, please stay on the current page and do not switch screens. If you see a black screen, please wait a moment as the inference model loads. Please click the pause button two seconds before the video ends, and then click view analysis.
          </p>
        </header>

        {/* 导航按钮组 */}
        <div className="flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-3 sm:gap-4">
          <Button variant="outline" className="w-full sm:w-auto" asChild>
            <Link href={routes.pose2d.shooting}>Shooting</Link>
          </Button>
          
          {/* 当前页面高亮 (Dribbling) */}
          <Button 
            variant="default" 
            className="w-full sm:w-auto bg-sky-600 hover:bg-sky-700 border-none shadow-[0_0_15px_rgba(2,132,199,0.3)]" 
            asChild
          >
            <Link href={routes.pose2d.dribbling}>Dribbling</Link>
          </Button>

          {/* [New] Training 按钮 */}
          <Button variant="outline" className="w-full sm:w-auto" asChild>
            <Link href={routes.pose2d.training}>Basic Training</Link>
          </Button>
          
          <Button variant="outline" className="w-full sm:w-auto" asChild>
            <Link href={routes.pose2d.report}>Export report</Link>
          </Button>
        </div>

        <Card className="border-slate-800/70 bg-slate-900/65 backdrop-blur-xl shadow-2xl overflow-hidden min-h-[400px]">
          {(videoFile || cloudVideoUrl) ? (
            <PoseAnalysisView 
              file={videoFile} 
              videoUrl={cloudVideoUrl} 
              onClear={handleClear} 
              analysisType="dribbling" 
            />
          ) : (
            <div className="p-4 sm:p-8 h-full flex flex-col justify-center">
              <UploadDropzone onFileSelect={handleFileSelect} />
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}