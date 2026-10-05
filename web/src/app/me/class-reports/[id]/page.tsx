"use client";
import {useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import {classReportService,type ClassReport} from '@/services/classReports';
import {ClassReportDetails} from '@/components/class-reports/ClassReportDetails';
import {button,ErrorNotice} from '@/components/recipes/RecipeShared';
export default function ClassReportPage(){
 const {id}=useParams<{id:string}>();
 const [report,setReport]=useState<ClassReport|null>(null),[history,setHistory]=useState<ClassReport[]>([]),[more,setMore]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setLoading(true);setError('');Promise.all([classReportService.get(id),classReportService.history(id)]).then(([r,h])=>{if(active){setReport(r);setHistory(h.items);setMore(h.has_more);}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[id,retry]);
 async function older(){setLoading(true);setError('');try{const h=await classReportService.history(id,history.length);setHistory(v=>[...v,...h.items]);setMore(h.has_more);}catch(e){setError(e instanceof Error?e.message:'Could not load history.');}finally{setLoading(false);}}
 return <section className="space-y-5"><Link href="/me/class-reports" className="underline">All class reports</Link><h1 className="text-3xl font-semibold">Published class record</h1>{error&&<ErrorNotice error={error} retry={()=>setRetry(v=>v+1)}/>}{loading&&<p role="status">Loading record…</p>}{!error&&report&&<><ClassReportDetails report={report}/><p className="text-sm text-white/70">Published {new Date(report.published_at).toLocaleString('en-AU',{timeZone:'Australia/Sydney'})} (Australia/Sydney)</p><h2 className="text-xl font-semibold">Publication history</h2><div className="flex flex-wrap gap-3">{history.map(r=><Link key={r.public_id} className={button} aria-current={r.public_id===id?'page':undefined} href={`/me/class-reports/${r.public_id}`}>Lesson v{r.lesson_version}{r.is_latest?' · Latest':''}</Link>)}</div>{more&&<button className={button} disabled={loading} onClick={older}>Older publications</button>}</>}</section>;
}
