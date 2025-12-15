'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Card } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { routes } from '@/lib/routes';

// 动态加载上传组件，避免 SSR
const UploadDropzone = dynamic(
  () => import('../../../components/Pose2D/UploadDropZone'),
  { ssr: false }
);

// 动态加载分析视图组件
const PoseAnalysisView = dynamic(
  () => import('../../../components/Pose2D/PoseAnalysisView'),
  { ssr: false }
);

export default function ShootingPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null); // 保存用户上传的视频文件

  const handleClear = () => {
    setVideoFile(null);
  };

  return (
    <main className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-8 flex flex-col items-center">
      {/* 限制最大宽度，保证在大屏上不拉伸太长 */}
      <div className="w-full max-w-5xl mx-auto space-y-6 sm:space-y-8">
        
        {/* Header 区域：字体大小自适应 */}
        <header className="text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-blue-500 leading-tight">
            2D Pose Analysis
          </h1>
          <p className="text-sm sm:text-base text-gray-400 mt-3 sm:mt-4 max-w-2xl mx-auto">
            Upload the video to analysis shooting form.
          </p>
        </header>

        {/* --- 导航栏 --- 
            响应式布局：手机端垂直堆叠(flex-col)，平板/电脑端水平排列(sm:flex-row)
        */}
        <div className="flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-3 sm:gap-4">
          {/* 当前是 Shooting 页面，所以高亮这个按钮 */}
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
        {/* --- 结束导航栏 --- */}

        {/* 主卡片容器：增加 overflow-hidden 和 min-h 提升质感 */}
        <Card className="border-slate-800/70 bg-slate-900/65 backdrop-blur-xl shadow-2xl overflow-hidden min-h-[400px]">
          {videoFile ? (
            <PoseAnalysisView 
              file={videoFile} 
              onClear={handleClear} 
              analysisType="shooting" // 关键：传入投篮模式
            />
          ) : (
            <div className="p-2 sm:p-4 h-full flex flex-col justify-center">
               {/* 这里的 Padding 调整是为了让 UploadDropzone 在手机上不至于贴边太紧 */}
               <UploadDropzone onFileSelect={setVideoFile} />
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}