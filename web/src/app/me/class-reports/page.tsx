"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {classReportService,type ClassReport} from '@/services/classReports';
import {button,ErrorNotice} from '@/components/recipes/RecipeShared';
export default function MyClassReports(){
 const [items,setItems]=useState<ClassReport[]>([]),[more,setMore]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setLoading(true);setError('');classReportService.mine().then(d=>{if(active){setItems(d.items);setMore(d.has_more);}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[retry]);
 async function next(){setLoading(true);setError('');try{const d=await classReportService.mine(items.length);setItems(v=>[...v,...d.items]);setMore(d.has_more);}catch(e){setError(e instanceof Error?e.message:'Could not load reports.');}finally{setLoading(false);}}
 return <section className="space-y-5"><h1 className="text-3xl font-semibold">Class reports</h1><Link className="inline-block underline" href="/me/class-reports/daily">Daily summary</Link><p className="text-white/75">Your latest published training and attendance records. Each class record is separate from your video analysis scores.</p>{error&&<ErrorNotice error={error} retry={()=>setRetry(v=>v+1)}/>}{loading&&<p role="status">Loading class reports…</p>}{!loading&&!error&&!items.length&&<p>Your coach has not published any class records yet.</p>}<ul className="divide-y divide-white/20">{items.map(r=><li key={r.public_id} className="py-4"><Link className="block break-words text-xl underline" href={`/me/class-reports/${r.public_id}`}>{r.title}</Link><p className="mt-2 text-white/70">{r.class_name} · {r.held_on} · {r.total_minutes} minutes · {r.attendance==='absent'?'Absent': 'Training record'} · Lesson v{r.lesson_version}</p></li>)}</ul>{more&&<button className={button} disabled={loading} onClick={next}>Load more class reports</button>}</section>;
}
