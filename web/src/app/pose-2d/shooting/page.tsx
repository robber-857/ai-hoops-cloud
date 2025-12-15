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

export default function ShootingPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  // [New] 增加云端 URL 状态
  const [cloudVideoUrl, setCloudVideoUrl] = useState<string | null>(null);

  const handleClear = () => {
    setVideoFile(null);
    setCloudVideoUrl(null);
  };

  // [修复核心] 确保同时接收 File 和 URL
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
            2D Pose Analysis
          </h1>
          <p className="text-sm sm:text-base text-gray-400 mt-3 sm:mt-4 max-w-2xl mx-auto">
            Upload the video to analysis shooting form.
          </p>
        </header>

        <div className="flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-3 sm:gap-4">
          {/* Shooting 按钮高亮 */}
          <Button 
            variant="default" 
            className="w-full sm:w-auto bg-sky-600 hover:bg-sky-700 border-none shadow-[0_0_15px_rgba(2,132,199,0.3)]" 
            asChild
          >
            <Link href={routes.pose2d.shooting}>Shooting form analysis</Link>
          </Button>
          
          <Button variant="outline" className="w-full sm:w-auto" asChild>
            <Link href={routes.pose2d.dribbling}>Dribbling Posture Analysis</Link>
          </Button>
          
          <Button variant="outline" className="w-full sm:w-auto" asChild>
            <Link href={routes.pose2d.report}>Export report</Link>
          </Button>
        </div>

        <Card className="border-slate-800/70 bg-slate-900/65 backdrop-blur-xl shadow-2xl overflow-hidden min-h-[400px]">
          {/* [关键逻辑] 优先传递 cloudVideoUrl */}
          {(videoFile || cloudVideoUrl) ? (
            <PoseAnalysisView 
              file={videoFile} 
              videoUrl={cloudVideoUrl} // [New] 传入 HTTPS 链接
              onClear={handleClear} 
              analysisType="shooting" 
            />
          ) : (
            <div className="p-2 sm:p-4 h-full flex flex-col justify-center">
               <UploadDropzone onFileSelect={handleFileSelect} />
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}