"use client";
import {useEffect,useRef,useState} from 'react';
import type {CampLesson} from '@/services/campLessons';
import {personalEnergyService,type PersonalEnergyPreview,type EnergyDraft,type EnergyDraftRequest} from '@/services/personalEnergy';
import {PersonalEnergyDetails} from './PersonalEnergyDetails';
import {button,ErrorNotice} from '@/components/recipes/RecipeShared';

export function EnergyDraftHistory({lesson,result,disabled,onRestore,onPending,onBusy}:{lesson:CampLesson;result:PersonalEnergyPreview|null;disabled:boolean;onRestore:(snapshot:PersonalEnergyPreview)=>void;onPending:(value:boolean)=>void;onBusy:(value:boolean)=>void}){
 const [items,setItems]=useState<EnergyDraft[]>([]),[revision,setRevision]=useState(0),[more,setMore]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const pending=useRef<EnergyDraftRequest|null>(null),inFlight=useRef(false);
 const [retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setLoading(true);setReady(false);onPending(true);personalEnergyService.drafts(lesson).then(data=>{
   if(!active)return;setItems(data.items);setRevision(data.latest_revision);setMore(data.has_more);setReady(true);setError('');pending.current=null;onPending(false);
   if(data.items[0])onRestore(data.items[0].snapshot);
 }).catch(e=>{if(active){setError(e.message);if(!pending.current)onPending(false);}}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[lesson,retry,onRestore,onPending]);
 async function save(){
   if(inFlight.current||disabled||!ready)return;
   if(!pending.current){
     if(!result?.preview_token)return;
     pending.current={request_id:crypto.randomUUID(),expected_revision:revision,expected_version:result.lesson_version,preview_token:result.preview_token,activity_category:result.activity_category,meal_shares:result.meal_shares,activity_overrides:result.activity_overrides};
   }
   onPending(true);inFlight.current=true;setBusy(true);onBusy(true);setError('');setNotice('');
   try{const saved=await personalEnergyService.saveDraft(lesson,pending.current);setItems(v=>[saved,...v.filter(r=>r.public_id!==saved.public_id)]);setRevision(saved.revision);pending.current=null;onPending(false);onRestore(saved.snapshot);setNotice(`Saved review draft r${saved.revision}. Players have not been notified.`);}
   catch(e){setError(e instanceof Error?e.message:'Save failed. Retry the same request or reload history.');}
   finally{inFlight.current=false;setBusy(false);onBusy(false);}
 }
 async function next(){setLoading(true);try{const data=await personalEnergyService.drafts(lesson,items.length);setItems(v=>[...v,...data.items]);setMore(data.has_more);}catch(e){setError(e instanceof Error?e.message:'Could not load history.');}finally{setLoading(false);}}
 return <div className="space-y-3 border-t border-white/20 pt-4">
   <h3 className="text-xl font-semibold">Saved energy review drafts</h3>
   <p>Drafts are staff-only, pending review. Saving keeps the inputs and results shown in your preview; it does not publish a nutrition target.</p>
   {error&&<ErrorNotice error={error}/>}{notice&&<p role="status">{notice}</p>}
   <div className="flex flex-wrap gap-3"><button className={button} type="button" disabled={disabled||busy||!ready||(!pending.current&&(!result?.preview_token||!!result.blockers.length))} onClick={save}>{busy?'Saving review…':pending.current?'Retry same draft save':'Save energy review draft'}</button><button className={button} type="button" disabled={disabled||busy||loading} onClick={()=>setRetry(v=>v+1)}>Reload draft history</button></div>
   {pending.current&&!busy&&<p className="text-amber-100">The save outcome is unresolved. Retry the same draft, or reload history before editing.</p>}
   {loading&&<p role="status">Loading review drafts…</p>}
   {!loading&&ready&&!items.length&&<p>No saved energy reviews for this lesson.</p>}
   {items.map(row=><details key={row.public_id} className="rounded-lg border border-white/20 p-3"><summary className="cursor-pointer">Review draft r{row.revision} · Lesson v{row.snapshot.lesson_version} · Pending review</summary>
     <p className="my-2">Saved {new Date(row.created_at).toLocaleString()}</p>
     {row.lesson_changed&&<p className="text-amber-100">The lesson has changed since this draft. Preview again before saving a new revision.</p>}
     <button className={button} type="button" disabled={disabled||busy||!!pending.current} onClick={()=>onRestore(row.snapshot)}>Use these review inputs</button>
     <PersonalEnergyDetails result={row.snapshot}/>
   </details>)}
   {more&&<button type="button" className={button} disabled={loading||busy||disabled} onClick={next}>Load older review drafts</button>}
 </div>;
}
