// utils/angles.ts
export type V3 = { x:number; y:number; z:number }
const add=(a:V3,b:V3):V3=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z})
const sub=(a:V3,b:V3):V3=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z})
const dot=(a:V3,b:V3)=>a.x*b.x+a.y*b.y+a.z*b.z
const cross=(a:V3,b:V3):V3=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x})
const nrm=(a:V3)=>{const l=Math.hypot(a.x,a.y,a.z)||1; return {x:a.x/l,y:a.y/l,z:a.z/l}}
const deg=(r:number)=>r*180/Math.PI
const clamp=(v:number,mn=-1,mx=1)=>Math.min(mx,Math.max(mn,v))

export function bodyFrame(hipsL:V3, hipsR:V3, shL:V3, shR:V3){
  const hipMid = {x:(hipsL.x+hipsR.x)/2,y:(hipsL.y+hipsR.y)/2,z:(hipsL.z+hipsR.z)/2}
  const shMid  = {x:(shL.x+shR.x)/2,y:(shL.y+shR.y)/2,z:(shL.z+shR.z)/2}
  const fx = nrm(sub(hipsL, hipsR))
  const fz = nrm(sub(hipMid, shMid))
  const fy = nrm(cross(fx, fz))
  const fz2 = nrm(cross(fy, fx))
  return { fx, fy, fz: fz2 }
}

function angleBetween(u:V3, v:V3){
  const nu=Math.hypot(u.x,u.y,u.z), nv=Math.hypot(v.x,v.y,v.z)
  if(nu===0||nv===0) return NaN
  const c=clamp((u.x*v.x+u.y*v.y+u.z*v.z)/(nu*nv))
  return deg(Math.acos(c))
}

function angleAt(B:V3, A:V3, C:V3){ return angleBetween(sub(A,B), sub(C,B)) }

function projectAngle(vec:V3, a:V3, b:V3, ref:V3){
  const n = nrm(cross(a,b))
  const dotn = vec.x*n.x + vec.y*n.y + vec.z*n.z
  const vp = sub(vec, {x:n.x*dotn, y:n.y*dotn, z:n.z*dotn})
  const vpu = nrm(vp)
  const refu = nrm(ref)
  return angleBetween(vpu, refu)
}

export function computeAngles(kps: Record<string,V3>){
  const {fx, fy, fz} = bodyFrame(kps['l_hip'],kps['r_hip'],kps['l_shoulder'],kps['r_shoulder'])
  const l_elbow = (kps['l_elbow']&&kps['l_shoulder']&&kps['l_wrist']) ? angleAt(kps['l_elbow'], kps['l_shoulder'], kps['l_wrist']) : NaN
  const r_elbow = (kps['r_elbow']&&kps['r_shoulder']&&kps['r_wrist']) ? angleAt(kps['r_elbow'], kps['r_shoulder'], kps['r_wrist']) : NaN
  const l_knee  = (kps['l_knee']&&kps['l_hip']&&kps['l_ankle']) ? angleAt(kps['l_knee'], kps['l_hip'], kps['l_ankle']) : NaN
  const r_knee  = (kps['r_knee']&&kps['r_hip']&&kps['r_ankle']) ? angleAt(kps['r_knee'], kps['r_hip'], kps['r_ankle']) : NaN

  const l_upper = (kps['l_elbow']&&kps['l_shoulder']) ? sub(kps['l_elbow'], kps['l_shoulder']) : {x:0,y:0,z:0}
  const r_upper = (kps['r_elbow']&&kps['r_shoulder']) ? sub(kps['r_elbow'], kps['r_shoulder']) : {x:0,y:0,z:0}
  const l_sh_abd = projectAngle(l_upper, fy, fx, fy)
  const r_sh_abd = projectAngle(r_upper, fy, fx, fy)

  function wristExt(side:'l'|'r'){
    const sh=kps[`${side}_shoulder`], el=kps[`${side}_elbow`], wr=kps[`${side}_wrist`]
    if(!sh||!el||!wr) return NaN
    const fore=sub(wr,el), upper=sub(el,sh)
    const upProj=sub(upper, {x:fy.x*(upper.x*fy.x+upper.y*fy.y+upper.z*fy.z), y:fy.y*(upper.x*fy.x+upper.y*fy.y+upper.z*fy.z), z:fy.z*(upper.x*fy.x+upper.y*fy.y+upper.z*fy.z)})
    const n = nrm(cross(upProj, fy))
    return 180 - angleBetween(fore, n)
  }

  const l_wrist_ext = wristExt('l')
  const r_wrist_ext = wristExt('r')
  
  return { l_elbow, r_elbow, l_knee, r_knee, l_sh_abd, r_sh_abd, l_wrist_ext, r_wrist_ext }
}

// 合成 demo 数据（与 earlier 说明一致）
export function synthDemo(n=120, fps=30){
  const frames:{t:number;kps:Record<string,V3>}[]=[]
  for(let i=0;i<n;i++){
    const t=i/fps
    const base:Record<string,V3>={
      l_shoulder:{x:-0.2,y:1.5,z:0}, r_shoulder:{x:0.2,y:1.5,z:0},
      l_hip:{x:-0.15,y:1.0,z:0}, r_hip:{x:0.15,y:1.0,z:0},
      l_knee:{x:-0.15,y:0.6,z:0}, r_knee:{x:0.15,y:0.6,z:0},
      l_ankle:{x:-0.15,y:0.1,z:0}, r_ankle:{x:0.15,y:0.1,z:0},
    }
    const shR=base['r_shoulder']
    const upper:V3={x:0.2, y:0.05+0.1*Math.sin(2*Math.PI*(t/2)), z:0}
    const elbow:V3={x:shR.x+upper.x, y:shR.y+upper.y, z:0}
    const prog=Math.min(1,Math.max(0,(t-1.0)/1.2))
    const fore:V3={x:0.25+0.15*prog, y:0.02+0.1*prog, z:0}
    const wrist:V3={x:elbow.x+fore.x, y:elbow.y+fore.y, z:0}
    const l_elbow = add(base['l_shoulder'], {x: -0.25, y: 0.03 * Math.sin(2 * Math.PI * t), z: 0})
    const l_wrist = add(l_elbow, {x: -0.25, y: 0.05, z: 0})
    const bend=0.05*Math.cos(2*Math.PI*(t/2))

    frames.push({ t, kps:{
      ...base,
      r_elbow:elbow, r_wrist:wrist,
      l_elbow, l_wrist,
      r_knee:{x:base['r_knee'].x, y:base['r_knee'].y-Math.abs(bend), z:0},
      l_knee:{x:base['l_knee'].x, y:base['l_knee'].y-Math.abs(bend), z:0},
    } })
  }
  return frames
}
