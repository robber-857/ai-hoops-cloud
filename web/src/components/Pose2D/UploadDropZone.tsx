"use client";

import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils'; // 引入你的 cn 工具函数

// --- 图标修复：将 UploadCloud SVG 内联为 React 组件 ---
const UploadCloudIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
    <path d="M12 12v9" />
    <path d="m16 16-4-4-4 4" />
  </svg>
);

//用 TypeScript 定义组件的 props 类型：需要一个名为 onFileSelect 的回调
//接收 File 并返回 void。意思是父组件会传入一个函数来接收用户选中的文件。
interface UploadDropzoneProps {
  onFileSelect: (file: File) => void;
}
//导出默认的函数组件
//解构得到父组件传入的 onFileSelect 回调，并按照上面的类型约束接收 props。
//const onDrop 定义并 memo 化 onDrop 回调：当用户通过拖放或选择文件时被调用，
//取第一个文件并通过 onFileSelect 传回父组件。
//useCallback 的依赖是 onFileSelect，保证引用稳定以便优化。
export default function UploadDropzone({ onFileSelect }: UploadDropzoneProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileSelect(acceptedFiles[0]);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': ['.mp4', '.mov', '.webm', '.avi'] },
    multiple: false,
  });

  return (
    <div
      {...getRootProps()}//悬停改背景色增强对比
      className={cn(
        'flex flex-col items-center justify-center h-80 w-full rounded-xl border-2 border-dashed border-slate-700 cursor-pointer transition-colors duration-300',
        isDragActive ? 'bg-slate-800/80 border-sky-500' : 'bg-slate-900/50 hover:bg-slate-800/70'
      )}
    >
      <input {...getInputProps()} /> 
      <div className="text-center space-y-4">
        <UploadCloudIcon className="mx-auto h-16 w-16 text-slate-500" strokeWidth={1.5} />
        {isDragActive ? (
          <p className="text-lg font-semibold text-sky-400">Drag a file here</p>
        ) : (
          <div>
            <p className="text-lg font-semibold text-slate-300">Drag and drop the video file or click to upload</p>
            <p className="text-sm text-slate-500">Supports MP4, MOV, WebM and other formats</p>
          </div>
        )}
      </div>
    </div>
  );//条件渲染悬停提示，渲染SVG图片
}

