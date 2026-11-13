// 麵糊用量（v1.22）：各櫃位平日／假日暫定用量（原味、其他口味）、實際平均、還夠幾天＋建議叫貨、活動按日期預估
// Lv.2 以上；Lv.2 只看到自己負責的櫃位
import { useState, useEffect } from "react";
import { Flash } from "./TopToast.jsx";

const num = v => (v === null || v === undefined || v === "" ? "" : String(v));
const daysTxt = f => !f || f.days === null || f.days === undefined ? "—" : f.days >= 60 ? "60 天以上" : `${f.days} 天`;

export default function BatterPage({ user, apiGet, apiPost, C, s, todayStr }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(null);
  const load = async () => {
    setErr("");
    const r = await apiGet({ action:"buList", empId:user.id }, 0);
    if (r && r.success) setData(r); else { setData({ data:[] }); setErr((r && r.error) || "讀取失敗"); }
  };
  useEffect(() => { load(); }, []);
  const list = data?.data || [];
  const p = data?.params || { cover:3, warn:2, from:"2026-12-01" };

  return (
    <div>
      <div style={{ ...s.card, padding:"12px 14px", fontSize:12.5, color:C.muted, lineHeight:1.7 }}>
        每個櫃位填「平日／假日」一天大約用幾包：<b style={{ color:C.text }}>原味</b>一格、<b style={{ color:C.text }}>其他口味</b>（可可、紅玉、抹茶、黑糖、芝麻合計）一格。
        系統依最近一次收店盤點的剩餘，推算<b style={{ color:C.text }}>還夠幾天</b>，並建議叫貨量（未來 {p.cover} 天用量－剩餘）。
        {p.from} 起會自動算出實際平均，可一鍵套用。活動櫃位改成按日期填預估用量。
      </div>
      {data === null && <div className="rh-skel" style={{ height:120 }}/>}
      <Flash text={err} />{err && <div style={{ ...s.card, color:C.red, fontSize:13 }}>{err}</div>}
      {data && !err && list.length === 0 && <div style={{ ...s.card, color:C.muted, fontSize:13, textAlign:"center" }}>沒有可設定的櫃位</div>}
      {list.map(x => (
        <LocCard key={x.code} x={x} open={open === x.code} onToggle={() => setOpen(open === x.code ? null : x.code)}
          user={user} apiPost={apiPost} C={C} s={s} todayStr={todayStr} p={p} onSaved={load}/>
      ))}
    </div>
  );
}

function LocCard({ x, open, onToggle, user, apiPost, C, s, todayStr, p, onSaved }) {
  const pl = x.plan || {};
  const [f, setF] = useState({ wdO:num(pl.wdO), wdX:num(pl.wdX), heO:num(pl.heO), heX:num(pl.heX) });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { setF({ wdO:num(pl.wdO), wdX:num(pl.wdX), heO:num(pl.heO), heX:num(pl.heX) }); }, [x.plan && x.plan.at]);
  const save = async () => {
    setBusy(true); setMsg("");
    const r = await apiPost({ action:"buSave", empId:user.id, code:x.code, ...f }, 0);
    setBusy(false);
    if (r && r.success) { setMsg("已儲存"); onSaved(); } else setMsg((r && r.error) || "儲存失敗");
  };
  const apply = async which => {
    if (!confirm("用實際平均取代暫定用量？")) return;
    setBusy(true);
    const r = await apiPost({ action:"buApplyAvg", empId:user.id, code:x.code, which }, 0);
    setBusy(false);
    if (r && r.success) { setMsg("已套用實際平均"); onSaved(); } else setMsg((r && r.error) || "套用失敗");
  };
  const st = x.stock;
  const head = (
    <button onClick={onToggle} style={{ width:"100%", border:"none", background:"transparent", padding:0, cursor:"pointer", fontFamily:"inherit", color:C.text, textAlign:"left" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontSize:14.5, fontWeight:600 }}>{x.name.replace(/^\d+/, "")}{x.event && <span style={{ fontSize:11, color:C.accent, marginLeft:6 }}>活動</span>}</span>
        <span style={{ fontSize:12, color:C.muted }}>{open ? "收起 ▴" : "設定 ▾"}</span>
      </div>
      <div style={{ fontSize:12, marginTop:4, color: x.low ? C.red : C.muted, lineHeight:1.6 }}>
        {st && st.date ? <>剩 原味 {st.orig}・其他 {st.other} 包<span style={{ color:C.light }}>（{st.date.slice(5)} 收店）</span></> : <span style={{ color:C.light }}>還沒有收店盤點{x.event ? "（以 0 包計）" : ""}</span>}
        {!x.setup && !x.event ? <><br/><span style={{ color:C.gold }}>尚未設定用量</span></> : (x.orig || x.other) ? <>
          <br/>還夠：原味 {daysTxt(x.orig)}・其他 {daysTxt(x.other)}
          {((x.orig && x.orig.suggest) || (x.other && x.other.suggest)) ? <>｜<b>建議叫 {[x.orig && x.orig.suggest ? `原味 ${x.orig.suggest}` : "", x.other && x.other.suggest ? `其他 ${x.other.suggest}` : ""].filter(Boolean).join("、")} 包</b></> : null}
        </> : null}
      </div>
    </button>
  );
  const inp = k => <input type="number" inputMode="decimal" min="0" step="0.5" value={f[k]} placeholder="包" onChange={e => setF(o => ({ ...o, [k]:e.target.value }))} style={{ ...s.input, padding:"8px 10px", textAlign:"center" }}/>;
  const avgCell = (a, k) => a && a.n ? <span>{a[k]}</span> : <span style={{ color:C.light }}>—</span>;
  return (
    <div style={{ ...s.card, border: x.low ? `1px solid ${C.red}` : s.card.border }}>
      {head}
      {open && !x.event && (
        <div style={{ marginTop:12, borderTop:`1px solid ${C.border}`, paddingTop:12 }}>
          <div style={{ display:"grid", gridTemplateColumns:"64px 1fr 1fr", gap:8, alignItems:"center", fontSize:12.5 }}>
            <span/><span style={{ color:C.muted, textAlign:"center" }}>原味（包/天）</span><span style={{ color:C.muted, textAlign:"center" }}>其他口味</span>
            <span style={{ fontWeight:600 }}>平日</span>{inp("wdO")}{inp("wdX")}
            <span style={{ fontWeight:600 }}>假日</span>{inp("heO")}{inp("heX")}
          </div>
          <div style={{ fontSize:11, color:C.light, marginTop:6 }}>假日＝週六日、國定假日、連假（依行事曆設定；補班日算平日）</div>
          <div style={{ marginTop:12, background:C.warm, borderRadius:12, padding:"10px 12px", fontSize:12.5 }}>
            <div style={{ fontWeight:600, marginBottom:6 }}>實際平均（{x.avg.from} 起）</div>
            <div style={{ display:"grid", gridTemplateColumns:"64px 1fr 1fr 1fr", gap:6, textAlign:"center" }}>
              <span/><span style={{ color:C.muted }}>原味</span><span style={{ color:C.muted }}>其他</span><span style={{ color:C.muted }}>天數</span>
              <span style={{ textAlign:"left" }}>平日</span>{avgCell(x.avg.wd, "o")}{avgCell(x.avg.wd, "x")}<span style={{ color: x.avg.wd.n < 4 ? C.gold : C.text }}>{x.avg.wd.n}{x.avg.wd.n && x.avg.wd.n < 4 ? " 樣本少" : ""}</span>
              <span style={{ textAlign:"left" }}>假日</span>{avgCell(x.avg.he, "o")}{avgCell(x.avg.he, "x")}<span style={{ color: x.avg.he.n < 4 ? C.gold : C.text }}>{x.avg.he.n}{x.avg.he.n && x.avg.he.n < 4 ? " 樣本少" : ""}</span>
            </div>
            {(x.avg.wd.n > 0 || x.avg.he.n > 0) && <button disabled={busy} onClick={() => apply("all")} style={{ ...s.btn("secondary"), padding:"7px", fontSize:12.5, marginTop:8 }}>用實際平均取代暫定</button>}
            {!x.avg.wd.n && !x.avg.he.n && <div style={{ fontSize:11.5, color:C.light, marginTop:6 }}>收店盤點累積後會自動算出（每日用量＝開店起始＋當日進貨－收店剩餘）</div>}
          </div>
          {x.plan && x.plan.by && <div style={{ fontSize:11, color:C.light, marginTop:8 }}>上次修改：{x.plan.by}・{String(x.plan.at).slice(0, 16)}</div>}
          <button disabled={busy} onClick={save} style={{ ...s.btn("primary"), marginTop:10, opacity:busy ? .6 : 1 }}>{busy ? "處理中…" : "儲存用量"}</button>
          <Flash text={msg} />{msg && <div style={{ fontSize:12.5, color:/失敗|錯誤|權限/.test(msg) ? C.red : C.green, marginTop:6, textAlign:"center" }}>{msg}</div>}
        </div>
      )}
      {open && x.event && <EventDates x={x} user={user} apiPost={apiPost} C={C} s={s} todayStr={todayStr} onSaved={onSaved}/>}
    </div>
  );
}

function EventDates({ x, user, apiPost, C, s, todayStr, onSaved }) {
  const [d, setD] = useState("");
  const [name, setName] = useState("");
  const [o, setO] = useState("");
  const [ot, setOt] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const today = todayStr();
  const add = async () => {
    if (!d) { setMsg("請選日期"); return; }
    if (o === "" && ot === "") { setMsg("請填預估用量"); return; }
    setBusy(true); setMsg("");
    const r = await apiPost({ action:"buEvtSave", empId:user.id, code:x.code, date:d, name, orig:o || 0, other:ot || 0 }, 0);
    setBusy(false);
    if (r && r.success) { setD(""); setName(""); setO(""); setOt(""); setMsg("已儲存"); onSaved(); } else setMsg((r && r.error) || "儲存失敗");
  };
  const del = async e => {
    if (!confirm(`刪除 ${e.date} 的預估？`)) return;
    const r = await apiPost({ action:"buEvtDel", empId:user.id, code:x.code, date:e.date }, 0);
    if (r && r.success) onSaved(); else alert((r && r.error) || "刪除失敗");
  };
  const edit = e => { setD(e.date); setName(e.name); setO(String(e.orig)); setOt(String(e.other)); };
  return (
    <div style={{ marginTop:12, borderTop:`1px solid ${C.border}`, paddingTop:12 }}>
      <div style={{ fontSize:12.5, color:C.muted, marginBottom:8 }}>活動沒有固定平假日，請按日期提前填預估用量（同一天再填一次會覆蓋）。</div>
      {x.events.length === 0 && <div style={{ fontSize:12.5, color:C.light, marginBottom:8 }}>還沒有填任何活動日期</div>}
      {x.events.map(e => (
        <div key={e.date} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 0", borderBottom:`1px solid ${C.border}`, fontSize:13, opacity: e.date < today ? .5 : 1 }}>
          <span style={{ width:46, fontVariantNumeric:"tabular-nums" }}>{e.date.slice(5)}</span>
          <span style={{ flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.name || "活動"}</span>
          <span style={{ color:C.muted }}>原 {e.orig}・其他 {e.other}</span>
          <button onClick={() => edit(e)} style={{ border:"none", background:"none", color:C.accent, fontSize:12, cursor:"pointer", padding:"2px 4px" }}>改</button>
          <button onClick={() => del(e)} style={{ border:"none", background:"none", color:C.light, fontSize:12, cursor:"pointer", padding:"2px 4px" }}>刪</button>
        </div>
      ))}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:10 }}>
        <div><label style={s.label}>日期</label><input type="date" value={d} min={today} onChange={e => setD(e.target.value)} style={s.input}/></div>
        <div><label style={s.label}>活動名稱</label><input value={name} maxLength={40} placeholder="例：華山市集" onChange={e => setName(e.target.value)} style={s.input}/></div>
        <div><label style={s.label}>原味（包）</label><input type="number" inputMode="decimal" min="0" step="0.5" value={o} onChange={e => setO(e.target.value)} style={s.input}/></div>
        <div><label style={s.label}>其他口味（包）</label><input type="number" inputMode="decimal" min="0" step="0.5" value={ot} onChange={e => setOt(e.target.value)} style={s.input}/></div>
      </div>
      <button disabled={busy} onClick={add} style={{ ...s.btn("primary"), marginTop:10, opacity:busy ? .6 : 1 }}>{busy ? "儲存中…" : "儲存這天的預估"}</button>
      <Flash text={msg} />{msg && <div style={{ fontSize:12.5, color:/失敗|請/.test(msg) ? C.red : C.green, marginTop:6, textAlign:"center" }}>{msg}</div>}
    </div>
  );
}
