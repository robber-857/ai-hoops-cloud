"use client";
import { useCallback, useRef, useState } from 'react';
import type { CampLesson } from '@/services/campLessons';
import {personalEnergyService,type ActivityCategory,type PersonalEnergyPreview} from '@/services/personalEnergy';
import {PersonalEnergyDetails} from './PersonalEnergyDetails';
import {EnergyDraftHistory} from './EnergyDraftHistory';
import {button,field,ErrorNotice} from '@/components/recipes/RecipeShared';
export function LessonEnergyPreview({lesson,disabled,onBusy}:{lesson:CampLesson;disabled:boolean;onBusy:(busy:boolean)=>void}){
  const [activity,setActivity]=useState<ActivityCategory|''>(''),[result,setResult]=useState<PersonalEnergyPreview|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const inFlight=useRef(false);
  const [shares,setShares]=useState({breakfast:'',lunch:'',dinner:''});
  const [pending,setPending]=useState(false);
  const [overrides,setOverrides]=useState<Record<string,ActivityCategory>>({});
  const eligible=lesson.participants.filter(p=>p.status!=='absent'&&p.status!=='unconfirmed');
  const staleOverrides=Object.keys(overrides).some(id=>!eligible.some(p=>p.student_public_id===id));
  const restore=useCallback((snapshot:PersonalEnergyPreview)=>{setActivity(snapshot.activity_category);setOverrides(snapshot.activity_overrides??{});setShares(snapshot.meal_shares??{breakfast:'',lunch:'',dinner:''});setResult(null);setError('');},[]);
  async function preview(){
    if(!activity||disabled||pending||inFlight.current)return;
    setError('');setResult(null);
    const hasShares=Object.values(shares).some(Boolean);
    if(hasShares&&Object.values(shares).some(v=>!/^\d+(\.\d{1,2})?$/.test(v)||Number(v)<=0||Number(v)>=100)){
      setError('Enter three positive meal percentages with at most two decimal places, or leave all empty.');return;
    }
    if(hasShares&&Object.values(shares).reduce((sum,v)=>sum+Math.round(Number(v)*100),0)!==10000){
      setError('Breakfast, lunch and dinner percentages must total 100.');return;
    }
    inFlight.current=true;setBusy(true);onBusy(true);setError('');setResult(null);
    try{setResult(await personalEnergyService.preview(lesson,activity,hasShares?shares:undefined,overrides));}
    catch(e){setError(e instanceof Error?e.message:'Could not load personal energy preview. Please try again.');}
    finally{inFlight.current=false;setBusy(false);onBusy(false);}
  }
  return <section className="mt-8 space-y-4 border-t border-white/20 pt-6">
    <h2 className="text-2xl font-semibold">Personal energy review</h2>
    <p>This candidate uses each player’s recorded body measurements and Health Canada’s DRI equations. It is a separate review from the Australian reference table. Previewing does not save, notify or publish a nutrition target.</p>
    <p>Select one whole-day activity scenario to compare across this class. This selection does not confirm that every player has that activity level.</p>
    <label className="block max-w-lg">Activity scenario<select className={field} disabled={disabled||busy||pending} value={activity} onChange={e=>{setActivity(e.target.value as ActivityCategory|'');setResult(null);setError('');}}><option value="">Select a scenario</option><option value="inactive">Inactive</option><option value="low_active">Low active</option><option value="active">Active</option><option value="very_active">Very active</option></select></label>
    <fieldset disabled={disabled||busy||pending} className="min-w-0 space-y-3">
      <legend className="font-semibold">Individual activity scenarios</legend>
      <p>Optionally choose a different whole-day scenario for a player. These remain review inputs, not confirmed activity assessments. Changing the class scenario keeps individual selections.</p>
      {eligible.map(p=>{const person=lesson.roster.find(r=>r.student_public_id===p.student_public_id);const name=person?.name||'Name not added';return <label key={p.student_public_id} className="block max-w-lg break-words">{name}{person?.contact&&<span className="block text-sm text-white/70">{person.contact}</span>}<select aria-label={`Activity for ${name}`} className={field} value={overrides[p.student_public_id]??''} onChange={e=>{const value=e.target.value;setOverrides(previous=>{const next={...previous};if(value)next[p.student_public_id]=value as ActivityCategory;else delete next[p.student_public_id];return next;});setResult(null);setError('');}}><option value="">Use class scenario</option><option value="inactive">Inactive</option><option value="low_active">Low active</option><option value="active">Active</option><option value="very_active">Very active</option></select></label>;})}
      {staleOverrides&&<p className="text-amber-100">The restored draft includes individual selections for players who are no longer participating. Clear individual selections and review the current roster before previewing.</p>}
      {!!Object.keys(overrides).length&&<button type="button" className={button} onClick={()=>{setOverrides({});setResult(null);setError('');}}>Clear individual selections</button>}
    </fieldset>
    {disabled&&!busy&&<p className="text-amber-100">Save the lesson changes before reviewing personal energy.</p>}
    <fieldset disabled={disabled||busy||pending} className="min-w-0 space-y-3">
      <legend className="font-semibold">Optional meal split for this review</legend>
      <p>Enter three percentages totalling 100, or leave all empty. These are your scenario inputs, not approved meal recommendations.</p>
      <div className="grid gap-3 sm:grid-cols-3">{(['breakfast','lunch','dinner'] as const).map(name=><label key={name} className="capitalize">{name} (%)<input aria-label={`Personal ${name} percentage`} className={field} type="number" min="0.01" max="99.99" step="0.01" value={shares[name]} onChange={e=>{setShares(v=>({...v,[name]:e.target.value}));setResult(null);setError('');}}/></label>)}</div>
    </fieldset>
    <button type="button" className={button} disabled={!activity||disabled||busy||pending||staleOverrides} onClick={preview}>{busy?'Calculating energy…':'Preview personal energy'}</button>
    {error&&<ErrorNotice error={error}/>}
    {!disabled&&result&&<PersonalEnergyDetails result={result}/>}
    <EnergyDraftHistory lesson={lesson} result={result} disabled={disabled||busy} onRestore={restore} onPending={setPending} onBusy={onBusy}/>
  </section>;
}
