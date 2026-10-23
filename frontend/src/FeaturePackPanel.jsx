
import React, { useMemo, useState } from 'react';
export const AI_KINDS = [{"id": "leakage-summary", "title": "Revenue leakage summary"}, {"id": "failed-payment-recovery", "title": "Failed-payment recovery triage"}, {"id": "plan-mismatch", "title": "Plan and entitlement mismatch check"}];
function toCsv(rows){ if(!rows.length) return "id,reference,title,status,risk,amount\n"; const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))]; const cell=v=>{const s=v==null?"":typeof v==="object"?JSON.stringify(v):String(v); return /[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s;}; return [keys.join(","),...rows.map(r=>keys.map(k=>cell(r[k])).join(","))].join("\n")+"\n"; }
function download(name, text, type){ const url=URL.createObjectURL(new Blob([text],{type})); const a=document.createElement('a'); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url); }
export default function FeaturePackPanel({ items=[], request }){
  const [q,setQ]=useState(''); const [status,setStatus]=useState(''); const [risk,setRisk]=useState(''); const [result,setResult]=useState(null); const [error,setError]=useState('');
  const filtered=useMemo(()=> (items||[]).filter(r=>{ if(status && String(r.status??r.state??'')!==status) return false; if(risk && String(r.risk??'')!==risk) return false; if(!q.trim()) return true; return JSON.stringify(r).toLowerCase().includes(q.trim().toLowerCase()); }),[items,q,status,risk]);
  async function runAi(kind){ setError(''); try{ const data=await request('/api/feature-pack/ai/'+kind,{method:'POST',body:JSON.stringify({records:filtered})}); setResult(data.result); }catch(e){ setError(e.message); } }
  return <section className="panel" aria-label="Feature pack">
    <div className="moduleTitle"><div><h3>Search, export and offline AI</h3><p>Labelled deterministic fallback over your own records. aiGenerated: false.</p></div><span className="badge">{filtered.length} matching records</span></div>
    <section aria-label="Search and filter"><h4>Search &amp; filter</h4><div className="buttonRow"><label>Search <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search records"/></label><label>Status <input value={status} onChange={e=>setStatus(e.target.value)} placeholder="Open / Closed"/></label><label>Risk <input value={risk} onChange={e=>setRisk(e.target.value)} placeholder="High / Low"/></label></div><p className="muted">Showing {filtered.length} of {(items||[]).length} records (0 preserved when empty).</p></section>
    <section aria-label="Export"><h4>Export</h4><div className="buttonRow"><button type="button" className="secondary" onClick={()=>download('records.csv',toCsv(filtered),'text/csv')}>Export CSV</button><button type="button" className="secondary" onClick={()=>download('records.json',JSON.stringify({items:filtered,count:filtered.length},null,2),'application/json')}>Export JSON</button></div></section>
    <section aria-label="Offline AI fallback"><h4>Offline AI fallback (deterministic, aiGenerated: false)</h4><div className="buttonRow">{AI_KINDS.map(k=><button type="button" key={k.id} className="secondary" onClick={()=>runAi(k.id)}>{k.title}</button>)}</div>
    {error && <p className="error" role="alert">{error}</p>}
    {result && <div aria-label="Fallback result"><h4>{result.title} — {result.label}</h4><p>{result.summary}</p><div>{Object.entries(result.metrics||{}).map(([k,v])=><div key={k}><span>{k}: </span><strong>{String(v)}</strong></div>)}</div>{(result.sections||[]).map((s,i)=><article key={i}><h5>{s.title}</h5><p>{s.detail}</p></article>)}<small>{result.disclaimer}</small></div>}
    </section>
  </section>;
}
