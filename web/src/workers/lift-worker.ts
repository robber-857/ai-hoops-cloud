/// <reference lib="webworker" />
/**
 * src/workers/lift-worker.ts
 * 2D→3D lifting worker (onnxruntime-web)
 *
 * Messages:
 *  - { type: 'init', modelUrl: string, prefer?: 'webgpu'|'wasm', inputName?: string, outputName?: string, joints?: number }
 *  - { type: 'infer', seq: Frame2D[], returnAll?: boolean }
 * Replies:
 *  - { type: 'ready', provider: 'webgpu'|'wasm', input: string, output: string, joints: number }
 *  - { type: '3d', frame?: Frame3D, frames?: Frame3D[] }
 *  - { type: 'error', error: { name?: string; message: string; stack?: string } }
 */

import * as ort from 'onnxruntime-web'
export {} // keep file a module (avoid Window typings)

type KP = { x:number; y:number; conf?:number } | [number, number] | [number, number, number]
type Frame2D = { t?: number; joints: KP[] }
type V3 = { x:number; y:number; z:number }
type Frame3D = { t?: number; joints: V3[] }

type InitMsg = {
  type: 'init'
  modelUrl: string
  prefer?: 'webgpu' | 'wasm'
  inputName?: string
  outputName?: string
  joints?: number
}
type InferMsg = { type: 'infer'; seq: Frame2D[]; returnAll?: boolean }
type Msg = InitMsg | InferMsg

let session: ort.InferenceSession | null = null
let providerUsed: 'webgpu' | 'wasm' | null = null
let INPUT = ''
let OUTPUT = ''
let JOINTS = 17 // COCO-17 默认

// —— 适度调教 WASM 线程数（无 any）——
const cores = (typeof navigator !== 'undefined' && 'hardwareConcurrency' in navigator && navigator.hardwareConcurrency) ? navigator.hardwareConcurrency : 1
ort.env.wasm.numThreads = Math.max(1, Math.min(4, cores))

self.onmessage = async (e: MessageEvent<Msg>) => {
  try {
    if (e.data.type === 'init') {
      const { modelUrl, prefer='webgpu', inputName, outputName, joints } = e.data
      await initSession(modelUrl, prefer, inputName, outputName, joints)
      self.postMessage({ type: 'ready', provider: providerUsed, input: INPUT, output: OUTPUT, joints: JOINTS })
      return
    }

    if (e.data.type === 'infer') {
      if (!session) throw new Error('Worker not initialized. Send {type:"init"} first.')
      const { seq, returnAll } = e.data
      const feeds: Record<string, ort.Tensor> = { [INPUT]: preprocess(seq, JOINTS) }
      const outputs = await session.run(feeds)
      const out = outputs[OUTPUT] ?? outputs[Object.keys(outputs)[0]]
      if (!out) throw new Error('ONNX session returned no output.')

      const frames = postprocess(out, seq.map(s => s.t))
      if (returnAll) {
        self.postMessage({ type: '3d', frames })
      } else {
        const mid = frames[Math.floor(frames.length / 2)] ?? frames[0]
        self.postMessage({ type: '3d', frame: mid })
      }
    }
  } catch (err) {
    self.postMessage({ type: 'error', error: toErr(err) })
  }
}

async function initSession(
  modelUrl: string,
  prefer: 'webgpu'|'wasm' = 'webgpu',
  inputName?: string,
  outputName?: string,
  joints?: number
) {
  JOINTS = joints ?? JOINTS
type MaybeGPU = WorkerNavigator & { gpu?: unknown }
const wantGPU = prefer === 'webgpu' && typeof (navigator as MaybeGPU).gpu !== 'undefined'


  // WebGPU → WASM 回退（用 unknown 避免 any）
  try {
    if (wantGPU) {
      const opts = { executionProviders: ['webgpu'] as const } as unknown as ort.InferenceSession.SessionOptions
      session = await ort.InferenceSession.create(modelUrl, opts)
      providerUsed = 'webgpu'
    } else {
      throw new Error('WebGPU not available')
    }
  } catch {
    const opts = { executionProviders: ['wasm'] as const } as unknown as ort.InferenceSession.SessionOptions
    session = await ort.InferenceSession.create(modelUrl, opts)
    providerUsed = 'wasm'
  }

  INPUT  = inputName  ?? session.inputNames[0]
  OUTPUT = outputName ?? session.outputNames[0]
}

/** seq[T] -> ort.Tensor<float32>[1,T,J,3] (x,y,conf), 中心化+尺度归一 */
function preprocess(seq: Frame2D[], J: number): ort.Tensor {
  if (!seq || seq.length === 0) throw new Error('Empty sequence')

  const T = seq.length, C = 3
  const data = new Float32Array(1 * T * J * C)

  for (let t = 0; t < T; t++) {
    const kps = normalizeFrame(extractKps(seq[t].joints, J))
    for (let j = 0; j < J; j++) {
      const base = ((t * J) + j) * C
      data[base + 0] = kps[j][0]      // x
      data[base + 1] = kps[j][1]      // y
      data[base + 2] = kps[j][2] ?? 1 // conf
    }
  }
  return new ort.Tensor('float32', data, [1, T, J, C])
}

/** 支持 {x,y,conf} 或 [x,y] / [x,y,conf] */
function extractKps(kps: KP[], J: number): number[][] {
  const out: number[][] = new Array(J)
  for (let j = 0; j < J; j++) {
    const p = kps[j]
    if (Array.isArray(p)) {
      out[j] = [p[0] ?? 0, p[1] ?? 0, (p.length > 2 ? (p[2] ?? 1) : 1)]
    } else if (p && typeof p === 'object') {
      const obj = p as { x?:number; y?:number; conf?:number }
      out[j] = [obj.x ?? 0, obj.y ?? 0, obj.conf ?? 1]
    } else {
      out[j] = [0, 0, 0]
    }
  }
  return out
}

/** 以髋中点为中心；尺度用肩宽或髋宽（取较大） */
function normalizeFrame(kps: number[][]): number[][] {
  const L_SH = 5, R_SH = 6, L_HP = 11, R_HP = 12 // COCO indices
  const shL = kps[L_SH] ?? [0,0,1], shR = kps[R_SH] ?? [0,0,1]
  const hpL = kps[L_HP] ?? [0,0,1], hpR = kps[R_HP] ?? [0,0,1]

  const cx = (hpL[0] + hpR[0]) / 2, cy = (hpL[1] + hpR[1]) / 2
  const shoulder = Math.hypot(shL[0] - shR[0], shL[1] - shR[1])
  const hips     = Math.hypot(hpL[0] - hpR[0], hpL[1] - hpR[1])
  const scale    = Math.max(shoulder, hips, 1e-6)

  return kps.map(([x,y,c]) => [ (x - cx) / scale, (y - cy) / scale, c ?? 1 ])
}

/** ONNX 输出 -> Frame3D[]（维度通常 [1,T,J,3] 或 [1,1,J,3]） */
function postprocess(t: ort.Tensor, times?: (number|undefined)[]): Frame3D[] {
  const dims = t.dims
  const data = t.data as Float32Array

  const T = (dims.length === 4 ? dims[1] : 1) ?? 1
  const J = (dims.length >= 3 ? dims[dims.length - 2] : JOINTS) ?? JOINTS
  const C = dims[dims.length - 1] ?? 3

  const frames: Frame3D[] = new Array(T)
  for (let ti = 0; ti < T; ti++) {
    const joints: V3[] = new Array(J)
    for (let j = 0; j < J; j++) {
      const base = ((ti * J) + j) * C
      joints[j] = { x: data[base], y: data[base + 1], z: data[base + 2] }
    }
    frames[ti] = { t: times?.[ti], joints }
  }
  return frames
}

function toErr(err: unknown) {
  if (err instanceof Error) return { name: err.name, message: err.message, stack: err.stack }
  try { return { message: JSON.stringify(err) } } catch { return { message: String(err) } }
}
