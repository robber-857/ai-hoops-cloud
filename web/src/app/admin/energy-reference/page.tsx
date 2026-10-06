"use client";
import { useEffect, useRef, useState } from 'react';
import { energyReferenceService, type EnergyReferenceMetadata, type EnergyReferencePreview } from '@/services/energyReference';
import { EnergyReferenceResult } from '@/components/class-reports/EnergyReferenceResult';
import { field, primary, ErrorNotice } from '@/components/recipes/RecipeShared';

export default function EnergyReferencePage() {
  const [meta,setMeta]=useState<EnergyReferenceMetadata|null>(null), [result,setResult]=useState<EnergyReferencePreview|null>(null);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  const [age,setAge]=useState(''),[sex,setSex]=useState(''),[pal,setPal]=useState('');
  const [shares,setShares]=useState({breakfast:'',lunch:'',dinner:''});
  const inFlight=useRef(false);
  useEffect(()=>{let active=true;setLoading(true);setError('');energyReferenceService.metadata().then(value=>{if(active)setMeta(value);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[retry]);
  function changed(){setResult(null);setError('');}
  async function preview(e:React.FormEvent){
    e.preventDefault();if(inFlight.current)return;
    setError('');setResult(null);
    const hasShares=Object.values(shares).some(Boolean);
    if(hasShares && Object.values(shares).some(v=>!v)){setError('Enter all three meal percentages, or leave all three empty.');return;}
    if(hasShares && Object.values(shares).reduce((sum,value)=>sum+Math.round(Number(value)*100),0)!==10000){setError('Breakfast, lunch and dinner percentages must total 100.');return;}
    inFlight.current=true;setBusy(true);
    try{setResult(await energyReferenceService.preview({age_years:Number(age),sex:sex as 'male'|'female',pal,...(hasShares?{meal_shares:shares}:{})}));}
    catch(e){setError(e instanceof Error?e.message:'Could not preview the reference. Please try again.');}
    finally{inFlight.current=false;setBusy(false);}
  }
  return <div className="min-w-0 space-y-6">
    <h1 className="text-3xl font-semibold">Energy reference preview</h1>
    <p>Compare the official age-based reference table and try your own meal percentages. This tool uses reference body sizes; it does not calculate a player’s individual needs or publish nutrition guidance.</p>
    <p className="text-amber-100">Regular exercise does not identify a single PAL value. Choose an explicit whole-day activity scenario for review.</p>
    {loading&&<p role="status">Loading energy reference…</p>}
    {error&&<ErrorNotice error={error} retry={!meta?()=>setRetry(v=>v+1):undefined}/>}
    {meta&&<form onSubmit={preview}>
      <fieldset disabled={busy} className="min-w-0 space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <label>Age in completed years<input className={field} type="number" min={meta.min_age} max={meta.max_age} step="1" required value={age} onChange={e=>{changed();setAge(e.target.value);}}/></label>
          <label>Sex used by the source table<select className={field} required value={sex} onChange={e=>{changed();setSex(e.target.value);}}><option value="">Select</option><option value="male">Male</option><option value="female">Female</option></select></label>
          <label>Whole-day activity (PAL)<select className={field} required value={pal} onChange={e=>{changed();setPal(e.target.value);}}><option value="">Select a scenario</option>{meta.pal_options.map(option=><option key={option.value} value={option.value}>{option.value} — {option.label}</option>)}</select></label>
        </div>
        <div><h2 className="text-xl font-semibold">Optional three-meal percentages</h2><p className="mt-2 text-white/70">Leave all empty, or enter three positive percentages totalling 100. No ratio is preselected.</p></div>
        <div className="grid gap-4 sm:grid-cols-3">{(['breakfast','lunch','dinner'] as const).map(name=><label key={name} className="capitalize">{name} (%)<input className={field} type="number" min="0.01" max="99.99" step="0.01" value={shares[name]} onChange={e=>{changed();setShares(v=>({...v,[name]:e.target.value}));}}/></label>)}</div>
        <button className={primary} type="submit">{busy?'Calculating…':'Preview reference'}</button>
      </fieldset>
    </form>}
    {result&&<EnergyReferenceResult result={result}/>}
  </div>;
}
