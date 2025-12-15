'use client'
import React, { useMemo, useState, useRef } from 'react'
import { Canvas, useFrame, invalidate } from '@react-three/fiber'
import { OrbitControls, Line, Bounds, Grid, PerformanceMonitor, AdaptiveDpr } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { computeAngles, type V3, synthDemo } from '../utils/angles'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'

/* ---------- 关节名：给出全集 + 高亮子集（无 any） ---------- */
const ALL_JOINTS = [
  'l_shoulder','r_shoulder','l_elbow','r_elbow','l_wrist','r_wrist',
  'l_hip','r_hip','l_knee','r_knee','l_ankle','r_ankle',
] as const
type JointName = typeof ALL_JOINTS[number]
const HIGHLIGHT = [
  'l_shoulder','r_shoulder','l_elbow','r_elbow','l_wrist','r_wrist','l_knee','r_knee',
] as const satisfies readonly JointName[]
const HIGHLIGHT_SET = new Set<JointName>(HIGHLIGHT)

/** 将字符串窄化为 JointName 的类型守卫（去掉 any） */
function isJointName(s: string): s is JointName {
  return (ALL_JOINTS as readonly string[]).includes(s)
}

/* ---------- 骨段连线 ---------- */
const EDGES: ReadonlyArray<readonly [JointName, JointName]> = [
  ['l_shoulder','r_shoulder'],
  ['l_shoulder','l_elbow'], ['l_elbow','l_wrist'],
  ['r_shoulder','r_elbow'], ['r_elbow','r_wrist'],
  ['l_shoulder','l_hip'], ['r_shoulder','r_hip'],
  ['l_hip','r_hip'],
  ['l_hip','l_knee'], ['l_knee','l_ankle'],
  ['r_hip','r_knee'], ['r_knee','r_ankle'],
] as const

/* ---------- 角度区间 & 徽章 ---------- */
const TARGETS = {
  r_elbow:      { good: [165, 175] as const, warn: [155, 185] as const },
  r_wrist_ext:  { good: [45, 60]   as const, warn: [35, 70]   as const },
  r_knee:       { good: [165, 180] as const, warn: [150, 180] as const },
  r_sh_abd:     { good: [85, 100]  as const, warn: [70, 110]  as const },
} as const
type AngleKey = keyof typeof TARGETS
type Status = 'GOOD' | 'WARN' | 'OUT'
const inRange = (v: number, r: readonly [number, number]) => v >= r[0] && v <= r[1]
const classify = (v: number | undefined, k: AngleKey): Status => { //角度转为标签
  if (v == null || Number.isNaN(v)) return 'OUT'
  const t = TARGETS[k]
  if (inRange(v, t.good)) return 'GOOD'
  if (inRange(v, t.warn)) return 'WARN'
  return 'OUT'
}
const fmt = (v?: number) => (v == null || Number.isNaN(v) ? '—' : `${v.toFixed(1)}°`)//格式化输出角度xxx.x°

function AngleRow({ label, value, keyName }: { label: string; value: number | undefined; keyName: AngleKey }) {
  const st = classify(value, keyName)
  const badgeClass =
    st === 'GOOD'
      ? 'bg-emerald-600/90 hover:bg-emerald-600'
      : st === 'WARN'
      ? 'bg-amber-500/90 hover:bg-amber-500'
      : 'bg-rose-600/90 hover:bg-rose-600'
  const [lo, hi] = TARGETS[keyName].good
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-slate-200">
        <b className="text-sky-300">{label}:</b> {fmt(value)}
        <span className="ml-2 text-xs text-slate-400">Target {lo}–{hi}°</span>
      </div>
      <Badge className={`ml-2 ${badgeClass}`}>{st}</Badge>
    </div>
  )
}

/* ---------- 平滑插值（滑动不跳帧） ---------- */
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
function mixKps(a: Record<string, V3>, b: Record<string, V3>, t: number): Record<string, V3> {
  const out: Record<string, V3> = {}
  for (const k in a) {
    const pa = a[k], pb = (b && b[k]) || pa
    out[k] = { x: lerp(pa.x, pb.x, t), y: lerp(pa.y, pb.y, t), z: lerp(pa.z, pb.z, t) }
  }
  return out
}

/* ---------- 骨架：呼吸发光 + 重点高亮 ---------- */
function Skeleton3D({ pts, focus }: { pts: Record<string, V3>; focus?: Partial<Record<JointName, Status>> }) {
  const tRef = useRef(0)
  useFrame((_, delta) => { tRef.current += delta })

  const joints = Object.entries(pts)
  return (
    <>
      {joints.map(([name, p]) => {
        if (!isJointName(name)) return null
        const highlight = HIGHLIGHT_SET.has(name)
        const st = focus?.[name]

        // 基础色：普通=淡灰，重点=蓝；WARN/OUT 橙/红
        let base = '#cbd5e1'
        if (highlight) base = '#8ab4ff'
        if (st === 'WARN') base = '#f59e0b'
        if (st === 'OUT')  base = '#f43f5e'

        // 呼吸发光（更柔和的幅度）
        const glow = 0.22 + (highlight ? 0.18 : 0.08) * (0.5 + 0.5 * Math.sin(tRef.current * 2.2))

        return (
          <mesh key={name} position={[p.x, p.y, p.z]} castShadow>
            <sphereGeometry args={[0.022, 24, 24]} />
            <meshStandardMaterial
              color={base}
              emissive={base}
              emissiveIntensity={glow}
              metalness={0.2}
              roughness={0.6}
            />
          </mesh>
        )
      })}

      {EDGES.map(([a, b], i) => {
        const pa = pts[a], pb = pts[b]
        if (!pa || !pb) return null
        // 若线段连接到 WARN/OUT 关节，线条更粗、更亮
        const sA = focus?.[a], sB = focus?.[b]
        const bad = (sA === 'WARN' || sA === 'OUT' || sB === 'WARN' || sB === 'OUT')
        const color = bad ? '#f59e0b' : '#a6b7d6'
        const alpha = bad ? 1.0 : 0.75
        return (
          <Line
            key={i}
            points={[[pa.x, pa.y, pa.z], [pb.x, pb.y, pb.z]]}
            lineWidth={bad ? 3.2 : 2}
            color={color}
            transparent
            opacity={alpha}
          />
        )
      })}
    </>
  )
}

export default function PoseCanvas() {
  /* 合成序列 */
  const frames = useMemo(() => synthDemo(150, 30), [])
  // 浮点索引插值（更顺滑）
  const [idxF, setIdxF] = useState(0)
  const i0 = Math.floor(idxF)
  const i1 = Math.min(i0 + 1, frames.length - 1)
  const t = Math.min(1, Math.max(0, idxF - i0))
  const interpKps = mixKps(frames[i0].kps, frames[i1].kps, t)

  const ang = computeAngles(interpKps)
  const focusStatuses: Partial<Record<JointName, Status>> = {
    r_elbow: classify(ang.r_elbow, 'r_elbow'),
    r_wrist: classify(ang.r_wrist_ext, 'r_wrist_ext'),
    r_knee:  classify(ang.r_knee,  'r_knee'),
    r_shoulder: classify(ang.r_sh_abd, 'r_sh_abd'),
  }

  // 自适应 DPR（跌帧自动降清晰度）
  const [dpr, setDpr] = useState<[number, number] | number>([1, 2])

  return (
    <div className="mx-auto max-w-[1200px] w-full px-4
                grid grid-cols-1
                md:grid-cols-[minmax(0,1fr)_360px]
                gap-6">
                    
      {/* 左：三维渲染卡片（渐变高光 + 毛玻璃） */}
      <Card className="relative border-slate-800/70 bg-slate-950/40 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-35
                        bg-[radial-gradient(600px_300px_at_20%_-10%,rgba(99,102,241,.20),transparent),
                            radial-gradient(700px_400px_at_120%_120%,rgba(56,189,248,.14),transparent)]" />
        <CardContent className="p-0">
          <div className="h-[560px]">
            <Canvas
              dpr={dpr}
              shadows
              gl={{ antialias: true, powerPreference: 'high-performance' }}
              camera={{ position: [1.2, 1.75, 2.5], fov: 45, near: 0.01, far: 100 }}
              // frameloop="always"  // 如需省电可换 "demand"，并在 slider/controls 调用 invalidate()
            >
              {/* 暗色背景 + 雾化，空间层次 */}
              <color attach="background" args={['#0b1220']} />
              <fog attach="fog" args={['#0b1220', 6, 14]} />

              {/* 更干净的灯光搭配 */}
              <hemisphereLight intensity={0.35} color={'#a3b6ff'} groundColor={'#0b1220'} />
              <ambientLight intensity={0.25} />
              <directionalLight position={[5, 6, 4]} intensity={0.8} castShadow />

              {/* 无尽网格 */}
              <Grid
                infiniteGrid
                cellSize={0.25}
                sectionSize={1}
                cellThickness={0.6}
                sectionThickness={1.2}
                fadeStrength={1}
                fadeDistance={17}
                position={[0, -0.25, 0]}
                cellColor="#2b3549"
                sectionColor="#45506a"
              />

              {/* 骨架 + 自动适配视野 */}
              <Bounds fit clip observe margin={1.1}>
                <Skeleton3D pts={interpKps} focus={focusStatuses} />
              </Bounds>

              {/* 相机交互 */}
              <OrbitControls
                makeDefault
                target={[0, 1.1, 0]}
                enableDamping
                dampingFactor={0.08}
                minDistance={1.2}
                maxDistance={6}
                minPolarAngle={0}
                maxPolarAngle={Math.PI}
                onChange={() => invalidate()}
              />

              {/* 柔光后处理（更柔、不爆白） */}
              <EffectComposer>
                <Bloom
                  mipmapBlur
                  intensity={0.22}           // 0.15–0.35 间自行微调
                  luminanceThreshold={0.55}  // 越大越不易泛光
                  luminanceSmoothing={0.25}  // 边缘更柔
                />
              </EffectComposer>

              {/* 性能守护 */}
              <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr([1, 2])} />
              <AdaptiveDpr /> {/* 去掉 pixelated，降分辨率时不颗粒化 */}
            </Canvas>
          </div>
        </CardContent>
      </Card>

      {/* 右：信息面板 */}
      <Card className="border-slate-800/70 bg-slate-900/65 backdrop-blur-xl">
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-wider text-slate-400">Frame</div>
            <div className="text-2xl font-semibold text-slate-50">
              {Math.round(idxF)} <span className="text-slate-500">/ {frames.length - 1}</span>
            </div>

            {/* 角度 + 徽章 */}
            <div className="mt-2 grid grid-cols-1 gap-3">
              <AngleRow label="Elbow (R)"        value={ang.r_elbow}     keyName="r_elbow" />
              <AngleRow label="Wrist Ext (R)"    value={ang.r_wrist_ext} keyName="r_wrist_ext" />
              <AngleRow label="Knee (R)"         value={ang.r_knee}      keyName="r_knee" />
              <AngleRow label="Shoulder Abd (R)" value={ang.r_sh_abd}    keyName="r_sh_abd" />
            </div>

            {/* 平滑插值滑条 */}
            <div className="mt-4">
              <Slider
                value={[idxF]}
                min={0}
                max={frames.length - 1}
                step={0.01}
                onValueChange={(v) => { setIdxF(v[0] ?? 0); invalidate() }}
                className="w-full"
              />
              <p className="mt-2 text-xs text-slate-400">（当前为合成 demo；接入 2D→3D 模型后即可显示真实角度）</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
