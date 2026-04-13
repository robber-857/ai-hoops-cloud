'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  FileVideo,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from 'lucide-react';

import { supabase } from '@/lib/supabaseClient';

interface UploadDropzoneProps {
  onFileSelect: (file: File | null, videoUrl?: string) => void;
}

export default function UploadDropzone({ onFileSelect }: UploadDropzoneProps) {
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setUploading(true);
      setErrorMsg('');

      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('user-videos')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: urlData, error: urlError } = await supabase.storage
          .from('user-videos')
          .createSignedUrl(filePath, 3600);

        if (urlError || !urlData) throw urlError;

        console.log('Upload success, Signed URL:', urlData.signedUrl);
        onFileSelect(file, urlData.signedUrl);
      } catch (error: unknown) {
        console.error('Upload failed:', error);
        const message = error instanceof Error ? error.message : String(error);
        setErrorMsg(message || 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [onFileSelect]
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
              Stay on the page during upload and let the player load before generating the report.
            </p>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-300/18 bg-emerald-300/10 px-4 py-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />
            <p className="text-sm leading-6 text-white/58">
              Please wait patiently for the video to load after uploading.
            </p>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-white/70" />
            <p className="text-sm leading-6 text-white/58">
              Drag and drop is now active as soon as this upload panel is shown.
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
                  Same upload and storage logic
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
