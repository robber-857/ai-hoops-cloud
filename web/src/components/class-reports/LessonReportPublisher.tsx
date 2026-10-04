"use client";
import { useEffect, useRef, useState } from 'react';
import type { CampLesson } from '@/services/campLessons';
import {classReportService,type ReportPreview,type Publication} from '@/services/classReports';
import { ClassReportDetails } from './ClassReportDetails';
import { button, ErrorNotice } from '@/components/recipes/RecipeShared';
export function LessonReportPublisher({lesson,disabled,onBusy}:{lesson:CampLesson;disabled:boolean;onBusy:(busy:boolean)=>void}) {
 const [preview,setPreview]=useState<ReportPreview|null>(null),[receipt,setReceipt]=useState<Publication|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState(0);
 const inFlight=useRef(false);
 useEffect(()=>{let active=true;setLoading(true);setError('');classReportService.preview(lesson).then(p=>{if(active)setPreview(p);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[lesson,attempt]);
 async function publish(){if(inFlight.current||!preview||(!preview.already_published&&!preview.preview_fingerprint))return;inFlight.current=true;setBusy(true);onBusy(true);setError('');try{const result=await classReportService.publish(lesson,preview.preview_fingerprint);setReceipt(result);}catch(e){setError(e instanceof Error?e.message:'Could not publish. Reload the preview and review this saved lesson version.');}finally{inFlight.current=false;setBusy(false);onBusy(false);}}
 return <section className="mt-8 space-y-4 border-t border-white/20 pt-6"><h2 className="text-2xl font-semibold">Publish class records</h2>
 <p className="text-white/75">Publish saved lesson v{lesson.version} to each player. Their recorded activities, participation, measurements and available training energy estimates are saved with this publication.</p>
 {disabled&&!busy&&<p className="text-amber-200">Save your changes before publishing or reviewing this lesson.</p>}
 {error&&<ErrorNotice error={error} retry={()=>setAttempt(v=>v+1)}/>}
 {loading?<p role="status">Preparing reports…</p>:preview&&<>
 {preview.blockers.length>0&&<ul className="list-inside list-disc text-amber-200">{preview.blockers.map((b,i)=><li key={i}>{b}</li>)}</ul>}
 {!preview.already_published&&!preview.preview_fingerprint&&!preview.blockers.length&&<p className="text-amber-200">Reload the preview before publishing.<button type="button" className={`${button} ml-2`} onClick={()=>setAttempt(v=>v+1)}>Reload preview</button></p>}
 <button type="button" className={button} disabled={disabled||busy||preview.blockers.length>0||preview.lesson_version!==lesson.version||(!preview.already_published&&!preview.preview_fingerprint)} onClick={publish}>{busy?'Publishing…':preview.already_published||receipt?'View published receipt':'Publish saved class records'}</button>
 {receipt&&<p role="status">Published lesson v{receipt.lesson_version} for {receipt.reports.length} players. Retrying this version does not duplicate reports or notifications.</p>}
 <details><summary className="cursor-pointer py-3">{receipt||preview.already_published?'Published records':'Preview player records'} ({preview.reports.length})</summary><div className="space-y-4">{(receipt?.reports||preview.reports).map((r,i)=><ClassReportDetails key={r.public_id||i} report={r}/>)}</div></details>
 </>}
 </section>;
}
