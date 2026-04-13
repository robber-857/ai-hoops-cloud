'use client';

import * as React from 'react';

type Props = {
  current: number;
  duration: number;
  onScrub: (sec: number) => void;
  onScrubEnd: (sec: number) => void;
};

function fmt(sec: number) {
  if (!isFinite(sec)) return '0:00';
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function Scrubber({
  current,
  duration,
  onScrub,
  onScrubEnd,
}: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const isDraggingRef = React.useRef(false);
  const [dragVal, setDragVal] = React.useState<number | null>(null);

  const value = dragVal ?? current;
  const max = isFinite(duration) && duration > 0 ? duration : 0;

  React.useEffect(() => {
    const finish = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;

      const el = inputRef.current;
      if (!el) return;
      const nextValue = Number(el.value);

      setDragVal(null);
      onScrubEnd?.(nextValue);
    };

    window.addEventListener('pointerup', finish, true);
    window.addEventListener('mouseup', finish, true);
    window.addEventListener('touchend', finish, true);

    return () => {
      window.removeEventListener('pointerup', finish, true);
      window.removeEventListener('mouseup', finish, true);
      window.removeEventListener('touchend', finish, true);
    };
  }, [onScrubEnd]);

  return (
    <div className="w-full px-2 py-2">
      <div className="flex items-center gap-3 text-sm text-slate-200">
        <span className="w-11 shrink-0 text-left font-medium tabular-nums text-white/70">
          {fmt(value)}
        </span>
        <input
          ref={inputRef}
          type="range"
          min={0}
          step={0.01}
          max={max}
          value={Math.min(value, max)}
          disabled={max <= 0}
          onPointerDown={() => {
            isDraggingRef.current = true;
          }}
          onChange={(e) => {
            const nextValue = Number(e.target.value);
            setDragVal(nextValue);
            onScrub?.(nextValue);
          }}
          onMouseUp={(e) => {
            if (!isDraggingRef.current) return;
            isDraggingRef.current = false;
            const nextValue = Number((e.target as HTMLInputElement).value);
            setDragVal(null);
            onScrubEnd?.(nextValue);
          }}
          onTouchEnd={(e) => {
            if (!isDraggingRef.current) return;
            isDraggingRef.current = false;
            const nextValue = Number((e.target as HTMLInputElement).value);
            setDragVal(null);
            onScrubEnd?.(nextValue);
          }}
          className="analysis-range h-2.5 w-full"
        />
        <span className="w-11 shrink-0 text-right font-medium tabular-nums text-white/48">
          {fmt(duration)}
        </span>
      </div>
    </div>
  );
}
