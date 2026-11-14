// ═══════════════════════════════════════════════
// 投票系統 App 元件 v1(2026-11-01,2026-11-09 接入 App v1.10)
// 入口:首頁「🗳️ 隊員投票」卡片。user.role===3 為管理員。
// ═══════════════════════════════════════════════
import { useState, useEffect } from "react";
import { Flash } from "./TopToast.jsx";

export default function VotesTab({ user, apiGet, apiPost, C, s, onBack }) {
  const isAdmin = user.role === 3;
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ title:"", desc:"", opts:["",""], multi:false, deadline:"" });
  const [pick, setPick] = useState({});       // { pollId: [idx...] }
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState({});       // 管理員展開誰投了什麼

  const load = async () => {
    setLoading(true);
    const r = await apiGet({ action:"getPolls", empId:user.id });
    if (r.success) { setPolls(r.data || []); setErr(""); } else setErr(r.error || "載入失敗");
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggle = (p, i) => setPick(prev => {
    const cur = prev[p.id] ?? p.myChoice ?? [];
    const next = p.multi ? (cur.includes(i) ? cur.filter(x=>x!==i) : [...cur, i]) : [i];
    return { ...prev, [p.id]: next };
  });

  const submitVote = async (p) => {
    const choice = pick[p.id] ?? p.myChoice ?? [];
    if (!choice.length) { setErr("請先選擇選項"); return; }
    setBusy(p.id); setErr("");
    const r = await apiPost({ action:"votePoll", pollId:p.id, empId:user.id, name:user.name, choice });
    setBusy("");
    if (r.success) load(); else setErr(r.error || "投票失敗");
  };

  const closePoll = async (p) => {
    if (!window.confirm(`確定要結束「${p.title}」嗎?結束後不能再投。`)) return;
    setBusy(p.id);
    const r = await apiPost({ action:"closePoll", pollId:p.id, empId:user.id });
    setBusy("");
    if (r.success) load(); else setErr(r.error || "操作失敗");
  };

  const createPoll = async () => {
    const options = draft.opts.map(o=>o.trim()).filter(Boolean);
    if (!draft.title.trim()) { setErr("請輸入標題"); return; }
    if (options.length < 2) { setErr("至少 2 個選項"); return; }
    setBusy("new"); setErr("");
    const r = await apiPost({ action:"createPoll", empId:user.id, name:user.name,
      title:draft.title, desc:draft.desc, options, multi:draft.multi, deadline:draft.deadline });
    setBusy("");
    if (r.success) { setCreating(false); setDraft({ title:"", desc:"", opts:["",""], multi:false, deadline:"" }); load(); }
    else setErr(r.error || "建立失敗");
  };

  return (
    <div>
      {onBack && (
        <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer",
          color:C.muted, fontSize:13, padding:"0 0 10px", fontFamily:"inherit" }}>‹ 回首頁</button>
      )}
      <div style={{ ...s.card, textAlign:"center", padding:18 }}>
        <div style={{ fontSize:16, fontWeight:600 }}>隊員投票</div>
        <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>投票為記名，管理員可查看投票內容</div>
      </div>

      <Flash text={err} />{err && <div style={{ ...s.card, background:C.redBg, color:C.red, fontSize:13 }}>⚠️ {err}</div>}

      {isAdmin && !creating && (
        <button onClick={()=>setCreating(true)} style={{ ...s.btn("primary"), marginBottom:12 }}>＋ 發起新投票</button>
      )}

      {isAdmin && creating && (
        <div style={s.card}>
          <label style={s.label}>標題</label>
          <input style={s.input} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})} placeholder="例:12 月聚餐想吃哪一種?"/>
          <label style={{ ...s.label, marginTop:10 }}>說明(選填)</label>
          <input style={s.input} value={draft.desc} onChange={e=>setDraft({...draft,desc:e.target.value})}/>
          <label style={{ ...s.label, marginTop:10 }}>選項</label>
          {draft.opts.map((o,i)=>(
            <input key={i} style={{ ...s.input, marginBottom:6 }} value={o} placeholder={`選項 ${i+1}`}
              onChange={e=>setDraft({...draft,opts:draft.opts.map((x,j)=>j===i?e.target.value:x)})}/>
          ))}
          {draft.opts.length < 12 && (
            <button onClick={()=>setDraft({...draft,opts:[...draft.opts,""]})} style={{ ...s.btn("ghost"), marginBottom:10 }}>＋ 新增選項</button>
          )}
          <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, marginBottom:10 }}>
            <input type="checkbox" checked={draft.multi} onChange={e=>setDraft({...draft,multi:e.target.checked})}/> 可複選
          </label>
          <label style={s.label}>截止日(選填,當天結束後自動關閉)</label>
          <input type="date" style={{ ...s.input, marginBottom:12 }} value={draft.deadline} onChange={e=>setDraft({...draft,deadline:e.target.value})}/>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={()=>setCreating(false)} style={{ ...s.btn("ghost"), flex:1 }}>取消</button>
            <button disabled={busy==="new"} onClick={createPoll} style={{ ...s.btn("primary"), flex:1 }}>{busy==="new"?"建立中…":"發佈"}</button>
          </div>
        </div>
      )}

      {loading && <div style={{ textAlign:"center", color:C.muted, padding:20 }}>載入中…</div>}
      {!loading && polls.length===0 && <div style={{ ...s.card, textAlign:"center", color:C.muted, fontSize:13 }}>目前沒有投票</div>}

      {polls.map(p => {
        const live = p.status==="進行中";
        const sel = pick[p.id] ?? p.myChoice ?? [];
        const total = p.voterCount || 0;
        return (
          <div key={p.id} style={{ ...s.card, opacity: live?1:.85 }}>
            <div style={{ display:"flex", justifyContent:"space-between", gap:8 }}>
              <div style={{ fontSize:15, fontWeight:600 }}>{p.title}</div>
              <span style={{ fontSize:11, fontWeight:700, color: live?C.green:C.muted, whiteSpace:"nowrap" }}>{live?"進行中":"已結束"}</span>
            </div>
            {p.desc && <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>{p.desc}</div>}
            <div style={{ fontSize:11, color:C.light, margin:"6px 0 10px" }}>
              {p.multi?"可複選":"單選"}{p.deadline?` · 截止 ${p.deadline}`:""} · 已 {total} 人投票
            </div>

            {p.options.map((o,i)=>{
              const n = p.counts ? p.counts[i] : null;
              const pct = n!==null && total ? Math.round(n/total*100) : 0;
              const on = sel.includes(i);
              return (
                <button key={i} disabled={!live} onClick={()=>toggle(p,i)} style={{
                  position:"relative", overflow:"hidden", width:"100%", textAlign:"left", marginBottom:6,
                  padding:"11px 12px", borderRadius:12, cursor:live?"pointer":"default", fontSize:14, fontFamily:"inherit",
                  border:`1.5px solid ${on?C.accent:C.border}`, background:on?C.accentBg:C.warm, color:C.text }}>
                  {n!==null && <div style={{ position:"absolute", left:0, top:0, bottom:0, width:pct+"%", background:C.goldBg, zIndex:0 }}/>}
                  <div style={{ position:"relative", zIndex:1, display:"flex", justifyContent:"space-between" }}>
                    <span>{on?"✓ ":""}{o}</span>
                    {n!==null && <span style={{ fontWeight:600, color:C.gold }}>{n} 票 · {pct}%</span>}
                  </div>
                </button>
              );
            })}

            {live && (
              <button disabled={busy===p.id} onClick={()=>submitVote(p)} style={{ ...s.btn(p.myChoice?"blue":"green"), marginTop:6 }}>
                {busy===p.id?"送出中…":p.myChoice?"更改我的投票":"送出投票"}
              </button>
            )}

            {isAdmin && (
              <div style={{ marginTop:10 }}>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={()=>setOpen({...open,[p.id]:!open[p.id]})} style={{ ...s.btn("ghost"), flex:1, padding:"9px" }}>
                    {open[p.id]?"收合":"查看誰投了什麼"}
                  </button>
                  {live && <button onClick={()=>closePoll(p)} style={{ ...s.btn("ghost"), flex:1, padding:"9px", color:C.red }}>結束投票</button>}
                </div>
                {open[p.id] && (
                  <div style={{ marginTop:8, fontSize:13 }}>
                    {(p.voters||[]).length===0 && <div style={{ color:C.muted }}>還沒有人投票</div>}
                    {(p.voters||[]).map(v=>(
                      <div key={v.empId} style={{ padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
                        <b>{v.name}</b>:{v.choice.map(c=>p.options[c]).join("、")}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
