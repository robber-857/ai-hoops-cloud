'use client';

import * as React from 'react';

//TypeScript 类型别名：约束传入的 props 形状与类型
type Props = {
  current: number;        // 当前播放时间（秒）
  duration: number;       // 总时长（秒）
  onScrub: (sec: number) => void;      // 拖动中（可选：用来预览/显示时间）
  onScrubEnd: (sec: number) => void;   // 松手后，真正触发 seek
};

//将秒转为 m:ss 格式用于左/右两侧显示；处理非有限数值返回 "0:00"。
function fmt(sec: number) {
  if (!isFinite(sec)) return '0:00';
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60);//Math.floor 向下取整；padStart(2, '0') 保证 2 位秒。
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function Scrubber({ current, duration, onScrub, onScrubEnd }: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const isDraggingRef = React.useRef(false); // 防止本地 & 全局双触发
  const [dragVal, setDragVal] = React.useState<number | null>(null);
  const value = dragVal ?? current;//?? 空值合并运算符：仅在左侧为 null/undefined 时取右侧
  //没在拖动时（dragVal === null），value 就等于current，左侧时间与滑块位置都会随 current 的变化而更新
  const max = isFinite(duration) && duration > 0 ? duration : 0;
  
  React.useEffect(() => {
    const finish = () => {
        if (!isDraggingRef.current) return;   // 已处理过就跳过
        isDraggingRef.current = false;

        const el = inputRef.current;
        if (!el) return;
        const v = Number(el.value);

        setDragVal(null);                     // 退出拖拽态 → 用 props.current
        onScrubEnd?.(v);                      // 真正触发 seek
    };

    // 用 pointerup 覆盖鼠标与触控；再加 mouseup/touchend 兼容老环境
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
    <div className="w-full px-4 py-3">
      <div className="flex items-center gap-3 text-sm text-slate-300">
        <span className="tabular-nums">{fmt(value)}</span>
        <input
          ref = {inputRef}
          type="range"
          min={0}
          step={0.01}
          max={max}
          value={Math.min(value, max)}
          disabled={max <= 0}//当没有有效时长
          onPointerDown={() => { isDraggingRef.current = true; }}
          onChange={(e) => {//滑动时触发
            const v = Number(e.target.value);
            setDragVal(v);//进入拖动状态
            onScrub?.(v);
          }}
          onMouseUp={(e) => {//鼠标/触摸结束：清空 dragVal（退出拖动态），触发真正 seek。
            if (!isDraggingRef.current) return;
            isDraggingRef.current = false;
            const v = Number((e.target as HTMLInputElement).value);
            setDragVal(null);
            onScrubEnd?.(v);
          }}
          onTouchEnd={(e) => {//鼠标/触摸结束：清空 dragVal（退出拖动态），触发真正 seek。
            if (!isDraggingRef.current) return;
            isDraggingRef.current = false;
            const v = Number((e.target as HTMLInputElement).value);
            setDragVal(null);
            onScrubEnd?.(v);
          }}
          className="w-full accent-sky-400"
        />
        <span className="tabular-nums">{fmt(duration)}</span>
      </div>
    </div>
  );
}
