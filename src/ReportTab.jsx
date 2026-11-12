// 請總部處理（門市回報）v1.24：機器報修、水電場地、人力支援、客訴、金流、其他
// 全員可回報（含桃機合作夥伴、加盟店）；分隊長（自己的櫃位）以上可接手、完成；費用只有總部（Lv.3）填
import { useState, useEffect } from "react";

const CAT_ICON = { "機器報修":"🔧", "水電場地":"⚡", "人力支援":"👥", "客訴與客人狀況":"😟", "金流":"💰", "其他":"📝" };
const URG_COLOR = (C, u) => u === "現在就要" ? C.red : u === "今天要處理" ? C.gold : C.muted;
const ST_COLOR = (C, s) => s === "已完成" ? C.green : s === "處理中" ? C.accent : s === "已取消" ? C.light : C.gold;
const ymOf = d => d.slice(0, 7);
const addMonth = (ym, k) => { const [y, m] = ym.split("-").map(Number); const t = new Date(y, m - 1 + k, 1); return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0"); };
const fmt = s => String(s || "").replace("T", " ").slice(5, 16);

export default function ReportPage({ user, apiGet, apiPost, C, s, me, locations, todayStr, uploadPhoto, onChanged }) {
  const [view, setView] = useState(user.role >= 2 ? "open" : "new");   // 分隊長以上先看待處理
  const [meta, setMeta] = useState(null);
  const [cnt, setCnt] = useState(null);
  useEffect(() => {
    apiGet({ action:"rpMeta", empId:user.id }, 1).then(r => r && r.success && setMeta(r));
    apiGet({ action:"rpCount", empId:user.id }, 0).then(r => r && r.success && setCnt(r));
  }, [view]);
  const pend = meta?.canManage ? (cnt?.pending || 0) : (cnt?.mineOpen || 0);
  const seg = (k, label, n) => (
    <button key={k} onClick={() => setView(k)} style={{ flex:1, border:"none", borderRadius:10, padding:"9px 4px", fontSize:14, fontFamily:"inherit", cursor:"pointer",
      background: view === k ? C.card : "transparent", color: view === k ? C.text : C.muted, fontWeight: view === k ? 600 : 400, boxShadow: view === k ? "0 1px 3px rgba(0,0,0,.08)" : "none" }}>
      {label}{n ? <span style={{ marginLeft:5, fontSize:11, color:"#fff", background:C.red, borderRadius:999, padding:"0 6px" }}>{n}</span> : null}
    </button>
  );
  return (
    <div>
      <div style={{ display:"flex", background:C.warm, borderRadius:12, padding:3, gap:2, marginBottom:12 }}>
        {seg("new", "回報")}{seg("open", "處理中", pend)}{seg("done", "紀錄")}
      </div>
      {view === "new" && <NewReport {...{ user, apiPost, C, s, me, locations, meta, uploadPhoto }} onDone={() => { setView("open"); onChanged && onChanged(); }}/>}
      {view !== "new" && <ReportList key={view} mode={view} {...{ user, apiGet, apiPost, C, s, todayStr, meta }} onChanged={() => { apiGet({ action:"rpCount", empId:user.id }, 0).then(r => r && r.success && setCnt(r)); onChanged && onChanged(); }}/>}
    </div>
  );
}

function NewReport({ user, apiPost, C, s, me, locations, meta, uploadPhoto, onDone }) {
  const myLocs = (me?.myLocs?.length ? me.myLocs : Object.keys(locations || {})).filter(Boolean);
  const [loc, setLoc] = useState(myLocs[0] || "");
  const [cat, setCat] = useState("");
  const [item, setItem] = useState("");
  const [desc, setDesc] = useState("");
  const [urg, setUrg] = useState("一般");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { if (!loc && myLocs[0]) setLoc(myLocs[0]); }, [myLocs.join()]);
  const c = meta?.cats?.find(x => x.cat === cat);
  const chip = (on, label, onClick, color) => (
    <button key={label} onClick={onClick} style={{ border:`1px solid ${on ? (color || C.accent) : C.border}`, background: on ? (color || C.accent) : C.card, color: on ? "#fff" : C.text,
      borderRadius:999, padding:"7px 12px", fontSize:13, fontFamily:"inherit", cursor:"pointer" }}>{label}</button>
  );
  const submit = async () => {
    setMsg("");
    if (!loc) return setMsg("請選櫃位");
    if (!cat) return setMsg("請選分類");
    if (c && c.items.length && !item) return setMsg("請選項目");
    if ((!c?.items.length || /其他/.test(item)) && !desc.trim()) return setMsg("請寫一下狀況");
    setBusy(true);
    let photo = "";
    try { if (file) photo = await uploadPhoto(file, { folder:"門市回報照片", date:new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10), loc, name:user.name }); }
    catch (e) { setBusy(false); return setMsg(e.message); }
    const r = await apiPost({ action:"rpCreate", empId:user.id, loc, cat, item, desc, urg, photo }, 0);
    setBusy(false);
    if (r && r.success) { setCat(""); setItem(""); setDesc(""); setUrg("一般"); setFile(null); onDone(); }
    else setMsg((r && r.error) || "送出失敗");
  };
  if (!meta) return <div className="rh-skel" style={{ height:200 }}/>;
  return (
    <div style={s.card}>
      <label style={s.label}>櫃位</label>
      <select value={loc} onChange={e => setLoc(e.target.value)} style={{ ...s.input, marginBottom:12 }}>
        {!loc && <option value="">請選擇</option>}
        {myLocs.map(l => <option key={l} value={l}>{l}</option>)}
      </select>
      <label style={s.label}>分類</label>
      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
        {meta.cats.map(x => chip(cat === x.cat, `${CAT_ICON[x.cat] || ""} ${x.cat}`, () => { setCat(x.cat); setItem(""); }))}
      </div>
      {c && c.items.length > 0 && <>
        <label style={s.label}>項目</label>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>{c.items.map(it => chip(item === it, it, () => setItem(it)))}</div>
      </>}
      <label style={s.label}>狀況說明{c && c.items.length && !/其他/.test(item) ? "（選填）" : ""}</label>
      <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} maxLength={300} placeholder="例：右邊烤爐開了 30 分鐘還不到 150 度" style={{ ...s.input, resize:"vertical", marginBottom:12 }}/>
      <label style={s.label}>照片（選填）</label>
      <input type="file" accept="image/*" capture="environment" onChange={e => setFile(e.target.files && e.target.files[0])} style={{ fontSize:13, marginBottom:12 }}/>
      <label style={s.label}>緊急程度</label>
      <div style={{ display:"flex", gap:6, marginBottom:14 }}>
        {meta.urg.map(u => chip(urg === u, u === "現在就要" ? "🚨 現在就要" : u, () => setUrg(u), u === "現在就要" ? C.red : u === "今天要處理" ? C.gold : C.accent))}
      </div>
      <button disabled={busy} onClick={submit} style={{ ...s.btn("primary"), opacity:busy ? .6 : 1 }}>{busy ? "送出中…" : "送出給總部"}</button>
      {msg && <div style={{ fontSize:12.5, color:C.red, marginTop:8, textAlign:"center" }}>{msg}</div>}
      <div style={{ fontSize:11.5, color:C.light, marginTop:10, lineHeight:1.6 }}>送出後會通知總部的 LINE 群組。要叫貨（麵糊、包材、器具…）請用「叫貨」。</div>
    </div>
  );
}

function ReportList({ mode, user, apiGet, apiPost, C, s, todayStr, meta, onChanged }) {
  const [ym, setYm] = useState(ymOf(todayStr()));
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null);
  const load = () => apiGet(mode === "open" ? { action:"rpList", empId:user.id, open:1 } : { action:"rpList", empId:user.id, ym }, 0)
    .then(r => setList(r && r.success ? r.data.filter(x => mode === "open" || !/已送出|處理中/.test(x.status)) : []));
  useEffect(() => { setList(null); load(); }, [ym]);
  return (
    <div>
      {mode === "done" && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:14, marginBottom:10 }}>
          <button onClick={() => setYm(addMonth(ym, -1))} style={{ border:"none", background:"none", fontSize:18, cursor:"pointer", color:C.muted }}>‹</button>
          <span style={{ fontWeight:600 }}>{ym}</span>
          <button onClick={() => setYm(addMonth(ym, 1))} style={{ border:"none", background:"none", fontSize:18, cursor:"pointer", color:C.muted }}>›</button>
        </div>
      )}
      {list === null && <div className="rh-skel" style={{ height:120 }}/>}
      {list && list.length === 0 && <div style={{ ...s.card, textAlign:"center", color:C.muted, fontSize:13 }}>{mode === "open" ? "目前沒有待處理的回報 👍" : "這個月沒有紀錄"}</div>}
      {(list || []).map(x => <ReportCard key={x.id} x={x} open={open === x.id} onToggle={() => setOpen(open === x.id ? null : x.id)} {...{ user, apiPost, C, s, meta }} onSaved={() => { load(); onChanged(); }}/>)}
    </div>
  );
}

function ReportCard({ x, open, onToggle, user, apiPost, C, s, meta, onSaved }) {
  const [text, setText] = useState("");
  const [fee, setFee] = useState("");
  const [busy, setBusy] = useState(false);
  const act = async (status) => {
    if (status === "已取消" && !confirm("取消這筆回報？")) return;
    if (status === "已完成" && !text.trim()) { alert("請寫處理結果"); return; }
    if (status === "留言" && !text.trim()) return;
    setBusy(true);
    const r = await apiPost({ action:"rpUpdate", empId:user.id, id:x.id, status, text, fee: status === "已完成" ? fee : undefined }, 0);
    setBusy(false);
    if (r && r.success) { setText(""); setFee(""); onSaved(); } else alert((r && r.error) || "更新失敗");
  };
  const live = /已送出|處理中/.test(x.status);
  return (
    <div style={{ ...s.card, borderLeft: x.urg !== "一般" && live ? `4px solid ${URG_COLOR(C, x.urg)}` : undefined }}>
      <button onClick={onToggle} style={{ width:"100%", border:"none", background:"transparent", padding:0, textAlign:"left", cursor:"pointer", fontFamily:"inherit", color:C.text }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:20 }}>{CAT_ICON[x.cat] || "📝"}</span>
          <span style={{ flex:1, minWidth:0 }}>
            <span style={{ display:"block", fontWeight:600, fontSize:14 }}>{x.cat}{x.item ? `／${x.item}` : ""}</span>
            <span style={{ display:"block", fontSize:12, color:C.muted }}>{x.loc.replace(/^\d+/, "")}・{x.name}・{fmt(x.created)}</span>
          </span>
          <span style={{ textAlign:"right" }}>
            <span style={{ display:"block", fontSize:12, fontWeight:600, color:ST_COLOR(C, x.status) }}>{x.status}</span>
            {x.urg !== "一般" && live && <span style={{ display:"block", fontSize:11, color:URG_COLOR(C, x.urg) }}>{x.urg === "現在就要" ? "🚨 " : ""}{x.urg}</span>}
          </span>
        </div>
        {x.desc && <div style={{ fontSize:13, marginTop:6, lineHeight:1.6, whiteSpace:"pre-wrap" }}>{x.desc}</div>}
        {x.handler && <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>接手：{x.handler}</div>}
        {x.status === "已完成" && <div style={{ fontSize:12.5, color:C.green, marginTop:4 }}>✅ {x.result}{x.fee ? `（費用 ${x.fee.toLocaleString()} 元）` : ""}</div>}
      </button>
      {open && (
        <div style={{ marginTop:10, borderTop:`1px solid ${C.border}`, paddingTop:10 }}>
          {x.photo && <a href={x.photo.split(/\s*,\s*/)[0]} target="_blank" rel="noreferrer" style={{ fontSize:13, color:C.accent }}>📷 查看照片</a>}
          <div style={{ marginTop:6 }}>
            {x.log.map((g, i) => <div key={i} style={{ fontSize:12, color:C.muted, padding:"2px 0" }}>{fmt(g.at)}　{g.by}　{g.s}{g.t ? `：${g.t}` : ""}</div>)}
          </div>
          {live && <>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={2} maxLength={300} placeholder={x.canHandle ? "留言，或寫處理結果後按「完成」" : "補充說明"} style={{ ...s.input, resize:"vertical", marginTop:8 }}/>
            {x.canHandle && meta?.canFee && <input type="number" inputMode="numeric" min="0" value={fee} onChange={e => setFee(e.target.value)} placeholder="費用（元，選填，加盟／合作櫃位會列入應收）" style={{ ...s.input, marginTop:6 }}/>}
            <div style={{ display:"flex", gap:6, marginTop:8, flexWrap:"wrap" }}>
              <button disabled={busy} onClick={() => act("留言")} style={{ ...s.btn("ghost"), flex:1, padding:"8px", fontSize:13 }}>留言</button>
              {x.canHandle && x.status === "已送出" && <button disabled={busy} onClick={() => act("處理中")} style={{ ...s.btn("secondary"), flex:1, padding:"8px", fontSize:13 }}>我來處理</button>}
              {x.canHandle && <button disabled={busy} onClick={() => act("已完成")} style={{ ...s.btn("primary"), flex:1, padding:"8px", fontSize:13 }}>完成</button>}
              {(x.mine && x.status === "已送出" || meta?.canFee) && <button disabled={busy} onClick={() => act("已取消")} style={{ ...s.btn("ghost"), flex:1, padding:"8px", fontSize:13, color:C.light }}>取消</button>}
            </div>
          </>}
        </div>
      )}
    </div>
  );
}
