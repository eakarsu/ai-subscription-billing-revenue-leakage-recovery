
// Feature pack: search/filter, CSV/JSON export, and deterministic offline AI fallback over own records.
// No provider calls are made here; fallback results are labelled aiGenerated:false.
export const AI_KINDS = [
  {
    "id": "leakage-summary",
    "title": "Revenue leakage summary",
    "description": "Summarizes leakage exposure across billing records."
  },
  {
    "id": "failed-payment-recovery",
    "title": "Failed-payment recovery triage",
    "description": "Triages open high-risk billing records by amount."
  },
  {
    "id": "plan-mismatch",
    "title": "Plan and entitlement mismatch check",
    "description": "Flags open records for plan/entitlement mismatch review."
  }
];
const KIND_MAP = Object.fromEntries(AI_KINDS.map(k=>[k.id,k]));
export function filterRecords(records,{q="",status="",risk="",featureId=""}={}){
  const needle=String(q).trim().toLowerCase();
  return (Array.isArray(records)?records:[]).filter(r=>{
    if(status && String(r.status??r.state??"")!==status) return false;
    if(risk && String(r.risk??"")!==risk) return false;
    if(featureId && String(r.feature_id??r.workflow_id??"")!==featureId) return false;
    if(!needle) return true;
    return JSON.stringify(r).toLowerCase().includes(needle);
  });
}
function csvCell(v){ if(v==null) return ""; const s=typeof v==="object"?JSON.stringify(v):String(v); return /[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s; }
export function recordsToCsv(records){
  const rows=Array.isArray(records)?records:[];
  if(!rows.length) return "id,reference,title,status,risk,amount\n";
  const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];
  return [keys.join(","),...rows.map(r=>keys.map(k=>csvCell(r[k])).join(","))].join("\n")+"\n";
}
export function recordsToJson(records){ return JSON.stringify({items:Array.isArray(records)?records:[],count:Array.isArray(records)?records.length:0},null,2); }
export function runFallbackAi(kind,records){
  const def=KIND_MAP[kind]; if(!def) return null;
  const rows=Array.isArray(records)?records:[];
  const totalAmount=rows.reduce((s,r)=>s+(Number(r.amount)||0),0);
  const openCount=rows.filter(r=>!["Closed","Approved","closed","approved"].includes(String(r.status??r.state??""))).length;
  const highRiskCount=rows.filter(r=>["High","Critical"].includes(String(r.risk??""))).length;
  const top=[...rows].sort((a,b)=>(Number(b.amount)||0)-(Number(a.amount)||0)).slice(0,3).map(r=>({reference:String(r.reference??r.id??""),title:String(r.title??r.subject??""),amount:Number(r.amount)||0,status:String(r.status??r.state??""),risk:String(r.risk??"")}));
  return { aiGenerated:false, source:"deterministic-fallback", label:"Deterministic fallback (offline) — not AI-generated", kind:def.id, title:def.title,
    summary: rows.length? `${def.description} Analyzed ${rows.length} own record(s).` : `${def.description} No records supplied; counts are preserved as 0.`,
    metrics:{ recordCount:rows.length, totalAmount, openCount, highRiskCount, hasRecords:rows.length>0, empty:rows.length===0 },
    findings: top, sections:[
      {title:"Record count", detail:`${rows.length} record(s) analyzed (0 preserved when empty).`},
      {title:"Exposure", detail:`Total amount ${totalAmount}; open ${openCount}; high-risk ${highRiskCount}.`},
      {title:"Review", detail:"Operational review only. Validate source evidence before action. Not tax, legal, or clinical advice."}],
    disclaimer:"Deterministic offline fallback over your own records. aiGenerated:false. Operational only; not tax advice and no diagnosis." };
}
export function mountFeaturePack(app,{pool,auth,table="feature_records"}={}){
  const guard = typeof auth==="function" ? auth : ((_req,_res,next)=>next());
  const safeTable = table==="workflow_cases" ? "workflow_cases" : "feature_records";
  app.get("/api/feature-pack/records/search", guard, async (req,res)=>{
    const rows=(await pool.query(`SELECT * FROM ${safeTable} ORDER BY id DESC LIMIT 500`)).rows;
    const items=filterRecords(rows,{q:req.query.q||"",status:req.query.status||"",risk:req.query.risk||"",featureId:req.query.featureId||""});
    res.json({items,count:items.length});
  });
  app.get("/api/feature-pack/records/export", guard, async (req,res)=>{
    const rows=(await pool.query(`SELECT * FROM ${safeTable} ORDER BY id DESC LIMIT 500`)).rows;
    const items=filterRecords(rows,{q:req.query.q||"",status:req.query.status||"",risk:req.query.risk||"",featureId:req.query.featureId||""});
    if(String(req.query.format||"csv").toLowerCase()==="json"){ res.setHeader("Content-Type","application/json"); res.setHeader("Content-Disposition","attachment; filename=records.json"); return res.send(recordsToJson(items)); }
    res.setHeader("Content-Type","text/csv"); res.setHeader("Content-Disposition","attachment; filename=records.csv"); return res.send(recordsToCsv(items));
  });
  app.post("/api/feature-pack/ai/:kind", guard, async (req,res)=>{
    if(!KIND_MAP[req.params.kind]) return res.status(404).json({error:"Unknown AI feature"});
    let rows=Array.isArray(req.body?.records)?req.body.records:null;
    if(!rows){ rows=(await pool.query(`SELECT * FROM ${safeTable} ORDER BY id DESC LIMIT 500`)).rows; }
    res.json({result:runFallbackAi(req.params.kind, rows)});
  });
}
