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

export default function TrainingPage() {
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
          {/* 使用 Emerald 绿色渐变区分 Training 模块 */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-500 leading-tight">
            Basic Training Analysis
          </h1>
          <p
            className="text-sm sm:text-base text-gray-400 mt-3 sm:mt-4 max-w-2xl mx-auto text-justify">
            Upload videos of basic training movements (High Knees, Plank, Wall Sit, Squats). 
            Please ensure the video is filmed from the <strong>SIDE view</strong> for accurate posture analysis. 
            To obtain a stable score, please ensure the video plays for more than 10 seconds before clicking the view analysis button. 
            During the upload process, please stay on the current page.If you see a black screen, please wait a moment as the inference model loads. Please click the pause button two seconds before the video ends, and then click view analysis.
          </p>
        </header>

        <div className="flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-3 sm:gap-4">
          <Button variant="outline" className="w-full sm:w-auto" asChild>
            <Link href={routes.pose2d.shooting}>Shooting</Link>
          </Button>
          
          <Button variant="outline" className="w-full sm:w-auto" asChild>
            <Link href={routes.pose2d.dribbling}>Dribbling</Link>
          </Button>

          {/* 高亮 Training 按钮 */}
          <Button 
            variant="default" 
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 border-none shadow-[0_0_15px_rgba(16,185,129,0.3)]" 
            asChild
          >
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
              // [关键] 传入新的分析类型，这样系统会去加载 Training 目录下的模板
              analysisType="training" 
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