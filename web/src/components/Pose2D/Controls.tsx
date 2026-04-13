"use client";

import React from "react";

import { Button } from "@/components/ui/button";

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

export default function Controls({
  isPlaying,
  onTogglePlay,
  onClear,
}: ControlsProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <Button
        onClick={onTogglePlay}
        size="lg"
        className="min-h-12 rounded-full border border-sky-300/20 bg-sky-300 px-5 text-slate-950 shadow-[0_14px_30px_rgba(125,211,252,0.22)] hover:bg-sky-200"
      >
        {isPlaying ? (
          <PauseIcon className="mr-1 h-4 w-4" />
        ) : (
          <PlayIcon className="mr-1 h-4 w-4" />
        )}
        {isPlaying ? "Pause" : "Play"}
      </Button>

      <Button
        onClick={onClear}
        variant="destructive"
        size="lg"
        className="min-h-12 rounded-full border border-rose-300/15 bg-rose-400/90 px-5 text-white hover:bg-rose-400"
      >
        <XIcon className="mr-1 h-4 w-4" />
        Clear clip
      </Button>
    </div>
  );
}
