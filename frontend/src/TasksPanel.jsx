
import React, { useEffect, useState } from 'react';
export default function TasksPanel({ request }){
  const [tasks,setTasks]=useState([]); const [title,setTitle]=useState(''); const [error,setError]=useState('');
  async function load(){ try{ const d=await request('/api/tasks'); setTasks(d.tasks||[]); }catch(e){ setError(e.message); } }
  useEffect(()=>{ load(); },[]);
  async function create(e){ e.preventDefault(); try{ await request('/api/tasks',{method:'POST',body:JSON.stringify({title})}); setTitle(''); load(); }catch(err){ setError(err.message); } }
  async function done(t){ try{ await request('/api/tasks/'+t.id,{method:'PATCH',body:JSON.stringify({status:'DONE'})}); load(); }catch(err){ setError(err.message); } }
  return <section className="panel" aria-label="Staff tasks"><div className="moduleTitle"><div><h3>Staff tasks</h3><p>Authenticated tasks: list, create, and update.</p></div><span className="badge">{tasks.length} tasks</span></div>
  {error && <p className="error" role="alert">{error}</p>}
  <form onSubmit={create}><div className="buttonRow"><label>New task <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Task title"/></label><button className="primary" type="submit">Create task</button></div></form>
  {tasks.length ? <ul>{tasks.map(t=><li key={t.id}><strong>{t.title}</strong> — {String(t.status)} <button type="button" className="secondary" onClick={()=>done(t)}>Mark done</button></li>)}</ul> : <p className="muted">No tasks found (0).</p>}
  </section>;
}
