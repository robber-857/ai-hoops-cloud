'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileVideo, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseClient'; // 引入刚才建的客户端

interface UploadDropzoneProps {
  onFileSelect: (file: File | null, videoUrl?: string) => void; // 修改接口，增加 videoUrl
}

export default function UploadDropzone({ onFileSelect }: UploadDropzoneProps) {
  const [inviteCode, setInviteCode] = useState('');
  const [isVerified, setIsVerified] = useState(false); // 是否通过验证
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 1. 验证邀请码逻辑
  const handleVerifyCode = async () => {
    setErrorMsg('');
    if (!inviteCode) return;

    try {
      // 查询邀请码是否存在且未使用
      const { data, error } = await supabase
        .from('invite_codes')
        .select('*')
        .eq('code', inviteCode)
        .eq('is_used', false)
        .maybeSingle();

      if (error || !data) {
        setErrorMsg('Invalid or used invite code.');
        return;
      }

      // 验证成功 (暂不立即标记为已使用，简单起见先允许上传)
      setIsVerified(true);
    } catch (err) {
      setErrorMsg('Verification failed.');
    }
  };

  // 2. 视频处理逻辑
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // 如果未验证，不允许上传
    if (!isVerified) {
      setErrorMsg('Please enter a valid invite code first.');
      return;
    }

    setUploading(true);
    setErrorMsg('');

    try {
      // A. 生成唯一文件名 (避免重名覆盖)
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `${fileName}`;

      // B. 上传到 Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from('user-videos') // 你的 Bucket 名字
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // C. 获取临时访问链接 (Signed URL) - 有效期 1 小时 (3600秒)
      const { data: urlData, error: urlError } = await supabase.storage
        .from('user-videos')
        .createSignedUrl(filePath, 3600);

      if (urlError || !urlData) throw urlError;

      console.log('Upload success, Signed URL:', urlData.signedUrl);

      // D. 成功！把文件对象和云端链接传给父组件
      // 注意：父组件需要修改以优先使用 videoUrl
      onFileSelect(file, urlData.signedUrl);

    } catch (error: unknown) {
      console.error('Upload failed:', error);
      const message = error instanceof Error ? error.message : String(error);
      setErrorMsg(message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [isVerified, onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': [] },
    maxFiles: 1,
    disabled: !isVerified || uploading // 未验证或正在上传时禁用
  });

  return (
    <div className="w-full max-w-lg mx-auto space-y-6">
      
      {/* 邀请码输入区 */}
      {!isVerified && (
        <div className="bg-slate-900/80 p-6 rounded-xl border border-slate-700 text-center space-y-4">
          <div className="flex justify-center mb-2">
            <div className="p-3 bg-slate-800 rounded-full">
              <Lock className="w-6 h-6 text-sky-500" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-white">Private Beta Access</h3>
          <p className="text-sm text-slate-400">Enter your invite code to upload videos.</p>
          
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter code (e.g. VIP888)"
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-sky-500"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
            />
            <Button 
              onClick={handleVerifyCode} 
              disabled={!inviteCode}
              className="bg-sky-600 hover:bg-sky-700 text-white"
            >
              Verify
            </Button>
          </div>
          {errorMsg && <p className="text-red-400 text-sm mt-2">{errorMsg}</p>}
        </div>
      )}

      {/* 上传区域 (验证通过后显示) */}
      {isVerified && (
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300
            ${isDragActive ? 'border-sky-500 bg-sky-500/10' : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/50'}
            ${uploading ? 'opacity-50 pointer-events-none' : ''}
          `}
        >
          <input {...getInputProps()} />
          
          <div className="flex flex-col items-center gap-4">
            <div className={`p-4 rounded-full ${isDragActive ? 'bg-sky-500/20' : 'bg-slate-800'}`}>
              {uploading ? (
                <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <UploadCloud className={`w-8 h-8 ${isDragActive ? 'text-sky-500' : 'text-slate-400'}`} />
              )}
            </div>
            
            <div className="space-y-1">
              <p className="text-lg font-medium text-white">
                {uploading ? 'Uploading to Secure Cloud...' : 'Drop your video here'}
              </p>
              <p className="text-sm text-slate-400">
                {uploading ? 'Please wait' : 'or click to browse files'}
              </p>
            </div>

            {!uploading && (
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-900/50 px-3 py-1.5 rounded-full border border-slate-800">
                <FileVideo className="w-3 h-3" />
                <span>MP4, MOV, WEBM up to 50MB</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}