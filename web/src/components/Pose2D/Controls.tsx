"use client";

import React from 'react';
import { Button } from '@/components/ui/button';

// --- 图标修复：将 SVG 内联为 React 组件 ---

// Play Icon SVG 组件
const PlayIcon = (props: React.SVGProps<SVGSVGElement>) => (
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
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

// Pause Icon SVG 组件
const PauseIcon = (props: React.SVGProps<SVGSVGElement>) => (
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
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </svg>
);

// X Icon SVG 组件
const XIcon = (props: React.SVGProps<SVGSVGElement>) => (
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
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);


interface ControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onClear: () => void;
}

export default function Controls({ isPlaying, onTogglePlay, onClear }: ControlsProps) {
  return (
    <div className="flex space-x-4 mt-6">
      <Button onClick={onTogglePlay} size="lg" className="w-32">
        {isPlaying ? <PauseIcon className="mr-2 h-5 w-5" /> : <PlayIcon className="mr-2 h-5 w-5" />}
        {isPlaying ? 'pause' : 'play'}
      </Button>
      <Button onClick={onClear} variant="destructive" size="lg">
        <XIcon className="mr-2 h-5 w-5" />
        CLEAN UP
      </Button>
    </div>
  );
}

