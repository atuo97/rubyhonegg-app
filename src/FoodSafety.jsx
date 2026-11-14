// v1.26 食安稽查：冰箱溫度、儀容勾選、稽查資料、體檢表、食安管理、SOP 教學
import { BenefitForm } from "./Benefit42.jsx";
import { useState, useEffect } from "react";
import { Flash } from "./TopToast.jsx";

let FS_META = null;
export function useFsMeta(apiGet) {
  const [meta, setMeta] = useState(FS_META);
  useEffect(() => {
    if (FS_META) return;
    apiGet({ action: "fsMeta" }, 1).then(r => { if (r && r.success) { FS_META = r; setMeta(r); } });
  }, []);
  return meta;
}
// v1.40 辦公室、工廠、倉庫（場所性質＝內部）和活動，上下班不用填冰箱溫度
let NO_FRIDGE = new Set();
export function setNoFridgeLocs(list) { NO_FRIDGE = new Set(list || []); }
const fridgesOf = (meta, loc) => NO_FRIDGE.has(loc) ? [] : (meta && meta.fridges && meta.fridges[loc]) || ["冰箱"];
const outOf = (meta, v) => { if (v === "" || v == null || !meta) return false; const n = Number(v); return n < meta.range.min || n > meta.range.max; };

// 冰箱溫度：每台都要填（上班、下班）
export function FridgeInputs({ meta, loc, values, setValues, C, s }) {
  if (!loc) return null;
  const list = fridgesOf(meta, loc), rg = meta ? meta.range : { min: 0, max: 7 };
  if (!list.length) return null;
  const bad = list.filter(n => outOf(meta, values[n]));
  return (
    <div style={{ ...s.card, marginBottom: 12 }}>
      <div style={s.sectionTitle}>🧊 冰箱溫度 <span style={{ color: C.accent }}>*必填</span></div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>看冰箱溫度計填寫，正常是 {rg.min}～{rg.max}°C</div>
      {list.map(n => (
        <div key={n} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ flex: 1, fontSize: 14 }}>{n}</span>
          <input type="number" inputMode="decimal" step="0.1" value={values[n] ?? ""} onChange={e => setValues(v => ({ ...v, [n]: e.target.value }))}
            placeholder="°C" aria-label={n + "溫度"} style={{ ...s.input, width: 96, textAlign: "center", borderColor: outOf(meta, values[n]) ? C.red : undefined }} />
          <span style={{ fontSize: 13, color: C.muted }}>°C</span>
        </div>
      ))}
      {bad.length > 0 && <div style={{ background: C.redBg, color: C.red, borderRadius: 10, padding: "8px 10px", fontSize: 12.5, lineHeight: 1.6 }}>
        ⚠️ {bad.join("、")} 超出 {rg.min}～{rg.max}°C。請先檢查門有沒有關好、溫度設定對不對，調整後 10 分鐘再量一次。<br />送出後系統會自動通知總部（門市回報：冰箱溫度異常）。
      </div>}
    </div>
  );
}
export const fridgesFilled = (meta, loc, values) => !!loc && fridgesOf(meta, loc).every(n => values[n] !== undefined && String(values[n]).trim() !== "" && isFinite(Number(values[n])));
export const fridgePayload = (meta, loc, values) => fridgesOf(meta, loc).map(n => ({ name: n, t: Number(values[n]) }));

// 儀容勾選：全部勾完才能拍照
export const GROOM = [["帽子", "🧢", "戴帽子"], ["口罩", "😷", "戴口罩"], ["品牌制服", "👕", "穿品牌制服"], ["沒有穿拖鞋", "👟", "沒有穿拖鞋"]];
export function GroomChecks({ checked, setChecked, C }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
      {GROOM.map(([k, ic, label]) => {
        const on = checked.includes(k);
        return <button key={k} onClick={() => setChecked(c => on ? c.filter(x => x !== k) : [...c, k])} aria-pressed={on}
          style={{ display: "flex", alignItems: "center", gap: 6, border: `1.5px solid ${on ? C.green : C.border}`, background: on ? C.greenBg : C.card, color: on ? C.green : C.text,
            borderRadius: 12, padding: "9px 10px", fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
          <span style={{ fontSize: 17 }}>{on ? "✅" : ic}</span>{label}
        </button>;
      })}
    </div>
  );
}

// 稽查資料：證照＋今天在班隊員的體檢狀態
const ST_COLOR = (C, st) => st === "有效" ? C.green : st === "即將到期" ? C.gold : C.red;
export function AuditPage({ user, apiGet, C, s, locations, defaultLoc }) {
  const locs = Object.keys(locations || {});
  const [loc, setLoc] = useState(defaultLoc || locs[0] || "");
  const [d, setD] = useState(null);
  useEffect(() => { if (!loc) return; setD(null); apiGet({ action: "fsAudit", loc }, 1).then(r => setD(r && r.success ? r : { error: (r && r.error) || "讀取失敗" })); }, [loc]);
  const c = d && d.cert;
  const Row = ({ l, v, warn }) => <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderBottom: `1px solid ${C.border}`, fontSize: 14 }}>
    <span style={{ color: C.muted, flexShrink: 0 }}>{l}</span><span style={{ textAlign: "right", fontWeight: 600, color: warn ? C.red : C.text, wordBreak: "break-all" }}>{v || "—"}</span></div>;
  const expWarn = (x) => x && new Date(x + "T23:59:59+08:00").getTime() < Date.now();
  return (
    <div>
      <div style={{ ...s.card, marginBottom: 12 }}>
        <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 8 }}>衛生局或百貨來稽查時，打開這頁給對方看就可以。</div>
        <select value={loc} onChange={e => setLoc(e.target.value)} style={s.input}>{locs.map(n => <option key={n} value={n}>{n}</option>)}</select>
      </div>
      {!d && <div style={{ ...s.card, color: C.muted, textAlign: "center" }}>讀取中…</div>}
      {d && d.error && <div style={{ ...s.card, color: C.red }}>{d.error}</div>}
      {c && <div style={s.card}>
        <div style={s.sectionTitle}>📄 證照{c.fromHq ? <span style={{ fontSize: 11, color: C.muted, fontWeight: 400, marginLeft: 6 }}>（全品牌共用）</span> : null}</div>
        <Row l="食品業者登錄字號" v={c.reg} />
        <Row l="產品責任險" v={[c.plCo, c.plNo].filter(Boolean).join("・")} />
        <Row l="保險到期日" v={c.plExp} warn={expWarn(c.plExp)} />
        {c.plPhoto && <a href={c.plPhoto} target="_blank" rel="noreferrer" style={{ display: "block", fontSize: 13, color: C.accent, padding: "8px 0" }}>查看產品責任險保單 ›</a>}
        {(c.paCo || c.paNo) && <><Row l="公共意外責任險" v={[c.paCo, c.paNo].filter(Boolean).join("・")} /><Row l="保險到期日" v={c.paExp} warn={expWarn(c.paExp)} />
          {c.paPhoto && <a href={c.paPhoto} target="_blank" rel="noreferrer" style={{ display: "block", fontSize: 13, color: C.accent, padding: "8px 0" }}>查看公共意外險保單 ›</a>}</>}
        {c.other && <Row l="其他證照" v={c.other} />}
        {!c.reg && !c.plNo && <div style={{ fontSize: 12.5, color: C.gold, marginTop: 8 }}>總部還沒填這個櫃位的證照資料</div>}
      </div>}
      {d && d.crew && <div style={s.card}>
        <div style={s.sectionTitle}>🩺 今天在班隊員的健康檢查</div>
        {d.crew.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>目前沒有人在這個櫃位上班</div>}
        {d.crew.map((p, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${C.border}`, fontSize: 14 }}>
          <span>{p.name}</span><span style={{ color: ST_COLOR(C, p.status), fontWeight: 600 }}>{p.status}{p.exp ? `（到 ${p.exp}）` : ""}</span></div>)}
        <div style={{ fontSize: 11.5, color: C.light, marginTop: 8 }}>體檢表內容只有本人和管理者看得到</div>
      </div>}
    </div>
  );
}

// 我的體檢表
function ImgViewer({ id, apiGet, C, onClose }) {
  const [src, setSrc] = useState(""); const [err, setErr] = useState("");
  useEffect(() => { apiGet({ action: "fsHealthView", id }, 1).then(r => r && r.success ? setSrc(`data:${r.mime};base64,${r.base64}`) : setErr((r && r.error) || "讀取失敗")); }, [id]);
  return <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.8)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
    {src ? <img src={src} alt="體檢表" style={{ maxWidth: "100%", maxHeight: "90vh", borderRadius: 8 }} /> : <div style={{ color: "#fff" }}>{err || "讀取中…"}</div>}
  </div>;
}
export function HealthPage({ user, apiGet, apiPost, C, s, compressPhoto, todayStr }) {
  const [d, setD] = useState(null), [file, setFile] = useState(null), [date, setDate] = useState(""), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false), [view, setView] = useState("");
  const load = () => apiGet({ action: "fsHealthMine" }, 1).then(r => setD(r && r.success ? r : { error: (r && r.error) || "讀取失敗" }));
  useEffect(() => { load(); }, []);
  const send = async () => {
    if (!file || !date) { setMsg("請拍體檢表並填體檢日期"); return; }
    setBusy(true); setMsg("上傳中…");
    try {
      const b64 = await compressPhoto(file, 1600);
      const r = await apiPost({ action: "fsHealthUpload", base64: b64, examDate: date }, 0);
      if (r && r.success) { setMsg("✅ 已送出，管理者確認後就會更新到期日"); setFile(null); setDate(""); load(); } else setMsg((r && r.error) || "上傳失敗");
    } catch (e) { setMsg("照片讀取失敗"); }
    setBusy(false);
  };
  return (
    <div>
      <div style={s.card}>
        <div style={s.sectionTitle}>🩺 我的健康檢查</div>
        {!d && <div style={{ color: C.muted }}>讀取中…</div>}
        {d && d.error && <div style={{ color: C.red }}>{d.error}</div>}
        {d && !d.error && <div style={{ fontSize: 15 }}>狀態：<b style={{ color: ST_COLOR(C, d.status) }}>{d.status}</b>{d.exp ? `，到期日 ${d.exp}` : ""}
          {d.status === "即將到期" && <div style={{ fontSize: 12.5, color: C.gold, marginTop: 4 }}>快到期了，記得去做新的健康檢查</div>}</div>}
        <div style={{ fontSize: 12, color: C.light, marginTop: 8 }}>🔒 體檢表只有你自己和管理者看得到，稽查時同事只會看到「有效／過期」</div>
      </div>
      {/* v1.42 體檢費：另外報帳，和福利補助共用同一張報帳清單 */}
      <div style={s.card}>
        <div style={s.sectionTitle}>🧾 申請體檢費</div>
        <BenefitForm user={user} apiPost={apiPost} compressPhoto={compressPhoto} C={C} s={s} todayStr={todayStr} cats={[]} fixedCat="checkup" />
      </div>
      <div style={s.card}>
        <div style={s.sectionTitle}>上傳新的體檢表</div>
        <label style={s.label}>體檢日期</label>
        <input type="date" value={date} max={todayStr()} onChange={e => setDate(e.target.value)} style={{ ...s.input, marginBottom: 10 }} />
        <label style={{ ...s.btn("ghost"), border: `2px dashed ${file ? C.green : C.border}`, color: file ? C.green : C.muted, cursor: "pointer", marginBottom: 10 }}>
          📷 {file ? "已選好照片（點一下重拍）" : "拍體檢表"}
          <input type="file" accept="image/*" capture="environment" onChange={e => setFile(e.target.files[0] || null)} style={{ display: "none" }} />
        </label>
        <button disabled={busy} onClick={send} style={{ ...s.btn("primary"), opacity: busy ? .6 : 1 }}>送出</button>
        <Flash text={msg} />{msg && <div style={{ fontSize: 13, marginTop: 8, color: /✅/.test(msg) ? C.green : C.red }}>{msg}</div>}
      </div>
      {d && d.list && d.list.length > 0 && <div style={s.card}>
        <div style={s.sectionTitle}>上傳紀錄</div>
        {d.list.map(x => <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13.5 }}>
          <span style={{ flex: 1 }}>{x.exam} 體檢<span style={{ display: "block", fontSize: 11.5, color: x.status === "退回" ? C.red : C.muted }}>{x.status}{x.exp ? `・到 ${x.exp}` : ""}{x.note ? `・${x.note}` : ""}</span></span>
          <button onClick={() => setView(x.id)} style={{ border: `1px solid ${C.border}`, background: C.card, borderRadius: 999, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: C.text }}>看</button>
        </div>)}
      </div>}
      {view && <ImgViewer id={view} apiGet={apiGet} C={C} onClose={() => setView("")} />}
    </div>
  );
}

// 食安管理（Lv.2 看溫度；Lv.3 證照、體檢確認）
export function FoodSafetyAdmin({ user, apiGet, apiPost, C, s, uploadPhoto, todayStr }) {
  const [tab, setTab] = useState("temp");
  const tabs = [["temp", "冰箱溫度"], ...(user.role >= 3 ? [["cert", "櫃位證照"], ["health", "體檢確認"]] : [])];
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} style={{ flex: 1, border: `1px solid ${tab === k ? C.accent : C.border}`, background: tab === k ? C.accentBg : C.card, color: tab === k ? C.accent : C.text, borderRadius: 999, padding: "8px 0", fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>)}
      </div>
      {tab === "temp" && <TempLog user={user} apiGet={apiGet} C={C} s={s} todayStr={todayStr} />}
      {tab === "cert" && <CertEditor user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} uploadPhoto={uploadPhoto} />}
      {tab === "health" && <HealthAdmin user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} />}
    </div>
  );
}
function TempLog({ user, apiGet, C, s, todayStr }) {
  const [ym, setYm] = useState(todayStr().slice(0, 7)), [loc, setLoc] = useState(""), [d, setD] = useState(null);
  useEffect(() => { setD(null); apiGet({ action: "fsTemps", ym, loc }, 1).then(r => setD(r && r.success ? r : { error: (r && r.error) || "讀取失敗", data: [] })); }, [ym, loc]);
  const locs = d && d.data ? [...new Set(d.data.map(x => x.loc))] : [];
  const csv = () => {
    const rows = [["日期", "時間", "櫃位", "上下班", "隊員", "冰箱", "溫度", "異常"]];
    (d.data || []).slice().reverse().forEach(x => x.temps.forEach(t => rows.push([x.date, x.at.slice(11, 16), x.loc, x.type, x.name, t.name, t.t, (t.t < d.range.min || t.t > d.range.max) ? "是" : ""])));
    const blob = new Blob(["﻿" + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `冰箱溫度紀錄表_${ym}${loc ? "_" + loc : ""}.csv`; a.click();
  };
  return (
    <div style={s.card}>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <input type="month" value={ym} onChange={e => setYm(e.target.value)} style={{ ...s.input, flex: 1 }} />
        <select value={loc} onChange={e => setLoc(e.target.value)} style={{ ...s.input, flex: 1.3 }}><option value="">全部櫃位</option>{locs.map(n => <option key={n} value={n}>{n}</option>)}</select>
      </div>
      {!d && <div style={{ color: C.muted }}>讀取中…</div>}
      {d && d.error && <div style={{ color: C.red }}>{d.error}</div>}
      {d && d.data && <>
        <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 6 }}>共 {d.data.length} 筆，異常 <b style={{ color: C.red }}>{d.data.filter(x => x.bad).length}</b> 筆（正常 {d.range.min}～{d.range.max}°C）</div>
        {d.data.length > 0 && <button onClick={csv} style={{ ...s.btn("ghost"), marginBottom: 8 }}>⬇ 匯出冰箱溫度紀錄表（Excel 可開）</button>}
        {d.data.slice(0, 200).map((x, i) => <div key={i} style={{ padding: "7px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span>{x.date.slice(5).replace("-", "/")} {x.at.slice(11, 16)} {x.type}・{x.name}</span><span style={{ color: C.muted, fontSize: 12 }}>{x.loc.replace(/^\d+/, "")}</span></div>
          <div style={{ color: x.bad ? C.red : C.green, fontWeight: 600 }}>{x.temps.map(t => `${t.name} ${t.t}°C`).join("　")}{x.bad ? " ⚠️" : ""}</div>
        </div>)}
      </>}
    </div>
  );
}
const CERT_F = [["reg", "食品業者登錄字號", "例：A-123456789-00000-0"], ["plCo", "產品責任險 保險公司"], ["plNo", "產品責任險 保單號碼"], ["plExp", "產品責任險 到期日", "", "date"],
  ["paCo", "公共意外險 保險公司（百貨有要求才填）"], ["paNo", "公共意外險 保單號碼"], ["paExp", "公共意外險 到期日", "", "date"], ["other", "其他證照（選填）"]];
function CertEditor({ user, apiGet, apiPost, C, s, uploadPhoto }) {
  const [list, setList] = useState(null), [cur, setCur] = useState(null), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  const load = () => apiGet({ action: "fsCertList" }, 1).then(r => setList(r && r.success ? r.data : []));
  useEffect(() => { load(); }, []);
  const up = (k, v) => setCur(c => ({ ...c, [k]: v }));
  const photo = async (k, f) => { if (!f) return; setBusy(true); setMsg("照片上傳中…"); try { up(k, await uploadPhoto(f, { folder: "櫃位證照", loc: cur.loc, name: user.name })); setMsg(""); } catch (e) { setMsg(e.message); } setBusy(false); };
  const save = async () => { setBusy(true); const r = await apiPost({ action: "fsCertSave", cert: cur }, 0); setBusy(false); if (r && r.success) { setMsg("✅ 已儲存"); setCur(null); load(); } else setMsg((r && r.error) || "儲存失敗"); };
  if (cur) return (
    <div style={s.card}>
      <div style={s.sectionTitle}>{cur.loc}{cur.loc === "總部" ? "（全品牌共用，櫃位沒填的欄位都用這筆）" : ""}</div>
      {CERT_F.map(([k, l, ph, type]) => <div key={k} style={{ marginBottom: 8 }}><label style={s.label}>{l}</label><input type={type || "text"} value={cur[k] || ""} placeholder={ph || ""} onChange={e => up(k, e.target.value)} style={s.input} /></div>)}
      {[["plPhoto", "產品責任險保單照片"], ["paPhoto", "公共意外險保單照片"]].map(([k, l]) => <label key={k} style={{ ...s.btn("ghost"), marginBottom: 8, cursor: "pointer", color: cur[k] ? C.green : C.muted }}>
        📷 {cur[k] ? l + "（已上傳，點一下更換）" : "上傳" + l}<input type="file" accept="image/*" onChange={e => photo(k, e.target.files[0])} style={{ display: "none" }} /></label>)}
      <div style={{ display: "flex", gap: 8 }}><button onClick={() => setCur(null)} style={{ ...s.btn("ghost"), flex: 1 }}>取消</button><button disabled={busy} onClick={save} style={{ ...s.btn("primary"), flex: 2, opacity: busy ? .6 : 1 }}>儲存</button></div>
      <Flash text={msg} />{msg && <div style={{ fontSize: 13, marginTop: 8, color: /✅/.test(msg) ? C.green : C.red }}>{msg}</div>}
    </div>
  );
  return (
    <div style={s.card}>
      <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 8 }}>全品牌共用的資料填在「總部」就好；個別櫃位不一樣的才另外填。</div>
      {!list && <div style={{ color: C.muted }}>讀取中…</div>}
      {(list || []).map(x => <button key={x.loc} onClick={() => { setMsg(""); setCur({ ...x }); }} style={{ display: "flex", width: "100%", alignItems: "center", gap: 8, padding: "10px 2px", border: "none", borderBottom: `1px solid ${C.border}`, background: "none", cursor: "pointer", fontFamily: "inherit", color: C.text, textAlign: "left" }}>
        <span style={{ flex: 1, fontSize: 14 }}>{x.loc}<span style={{ display: "block", fontSize: 11.5, color: C.muted }}>{x.reg || x.plNo ? [x.reg && "登錄字號 ✓", x.plNo && "產品責任險 ✓", x.plExp && "到 " + x.plExp].filter(Boolean).join("・") : x.loc === "總部" ? "還沒填" : "沿用總部"}</span></span>
        <span style={{ color: C.light }}>›</span></button>)}
      <Flash text={msg} />{msg && <div style={{ fontSize: 13, marginTop: 8, color: C.green }}>{msg}</div>}
    </div>
  );
}
function HealthAdmin({ user, apiGet, apiPost, C, s }) {
  const [d, setD] = useState(null), [view, setView] = useState(""), [exp, setExp] = useState({});
  const load = () => apiGet({ action: "fsHealthList" }, 1).then(r => setD(r && r.success ? r : { error: (r && r.error) || "讀取失敗" }));
  useEffect(() => { load(); }, []);
  const decide = async (x, ok) => {
    const note = ok ? "" : (prompt("退回原因（隊員會看到）", "看不清楚，請重拍") || "看不清楚，請重拍");
    const r = await apiPost({ action: "fsHealthDecide", id: x.id, ok, exp: exp[x.id] || "", note }, 0);
    if (r && r.success) load(); else alert((r && r.error) || "失敗");
  };
  if (!d) return <div style={{ ...s.card, color: C.muted }}>讀取中…</div>;
  if (d.error) return <div style={{ ...s.card, color: C.red }}>{d.error}</div>;
  return (
    <div>
      <div style={s.card}>
        <div style={s.sectionTitle}>待確認（{d.pending.length}）</div>
        {d.pending.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>沒有待確認的體檢表</div>}
        {d.pending.map(x => <div key={x.id} style={{ padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ flex: 1, fontSize: 14 }}>{x.name}<span style={{ display: "block", fontSize: 11.5, color: C.muted }}>{x.exam} 體檢・{x.at.slice(5, 16)} 上傳</span></span>
            <button onClick={() => setView(x.id)} style={{ border: `1px solid ${C.border}`, background: C.card, borderRadius: 999, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: C.text }}>看</button></div>
          <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: C.muted }}>到期日</span>
            <input type="date" value={exp[x.id] || ""} onChange={e => setExp(m => ({ ...m, [x.id]: e.target.value }))} style={{ ...s.input, padding: "6px 8px", flex: 1 }} title="空白＝體檢日期加一年" />
            <button onClick={() => decide(x, true)} style={{ border: "none", background: C.greenBg, color: C.green, borderRadius: 10, padding: "7px 10px", fontSize: 12.5, cursor: "pointer", fontWeight: 600 }}>確認</button>
            <button onClick={() => decide(x, false)} style={{ border: "none", background: C.redBg, color: C.red, borderRadius: 10, padding: "7px 10px", fontSize: 12.5, cursor: "pointer" }}>退回</button>
          </div>
          <div style={{ fontSize: 11, color: C.light, marginTop: 3 }}>到期日空白＝體檢日期加一年</div>
        </div>)}
      </div>
      <div style={s.card}>
        <div style={s.sectionTitle}>全體隊員</div>
        {d.people.map(p => <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13.5 }}>
          <span>{p.name}</span><span style={{ color: ST_COLOR(C, p.status), fontWeight: 600 }}>{p.status}{p.exp ? `（${p.exp}）` : ""}</span></div>)}
      </div>
      {view && <ImgViewer id={view} apiGet={apiGet} C={C} onClose={() => setView("")} />}
    </div>
  );
}

// SOP 教學
export function SopPage({ user, apiGet, apiPost, C, s, uploadPhoto }) {
  const [d, setD] = useState(null), [type, setType] = useState(""), [edit, setEdit] = useState(null), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  const load = () => apiGet({ action: "getSop" }, 1).then(r => { if (r && r.success) { setD(r); setType(t => t || (r.types || Object.keys(r.data))[0]); } else setD({ data: {}, types: [] }); });
  useEffect(() => { load(); }, []);
  if (!d) return <div style={{ ...s.card, color: C.muted }}>讀取中…</div>;
  const types = d.types || Object.keys(d.data), steps = (d.data[type] || []);
  const canEdit = user.role >= 3;
  const upStep = (i, k, v) => setEdit(e => ({ ...e, steps: e.steps.map((x, j) => j === i ? { ...x, [k]: v } : x) }));
  const move = (i, dir) => setEdit(e => { const a = e.steps.slice(), j = i + dir; if (j < 0 || j >= a.length) return e; [a[i], a[j]] = [a[j], a[i]]; return { ...e, steps: a }; });
  const save = async () => { setBusy(true); const r = await apiPost({ action: "sopSave", type: edit.type, steps: edit.steps }, 0); setBusy(false); if (r && r.success) { setMsg("✅ 已儲存"); setType(edit.type); setEdit(null); load(); } else setMsg((r && r.error) || "儲存失敗"); };
  const photo = async (i, f) => { if (!f) return; setBusy(true); try { upStep(i, "img", await uploadPhoto(f, { folder: "SOP照片", name: user.name })); } catch (e) { setMsg(e.message); } setBusy(false); };
  if (edit) return (
    <div>
      <div style={s.card}>
        <label style={s.label}>SOP 名稱</label>
        <input value={edit.type} onChange={e => setEdit(x => ({ ...x, type: e.target.value }))} disabled={!edit.isNew} style={s.input} />
      </div>
      {edit.steps.map((x, i) => <div key={i} style={s.card}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}><b style={{ flex: 1 }}>步驟 {i + 1}</b>
          <button onClick={() => move(i, -1)} style={{ border: `1px solid ${C.border}`, background: C.card, borderRadius: 8, padding: "2px 8px", cursor: "pointer" }}>↑</button>
          <button onClick={() => move(i, 1)} style={{ border: `1px solid ${C.border}`, background: C.card, borderRadius: 8, padding: "2px 8px", cursor: "pointer" }}>↓</button>
          <button onClick={() => setEdit(e => ({ ...e, steps: e.steps.filter((_, j) => j !== i) }))} style={{ border: "none", background: C.redBg, color: C.red, borderRadius: 8, padding: "3px 8px", cursor: "pointer" }}>刪除</button></div>
        <input value={x.title} onChange={e => upStep(i, "title", e.target.value)} placeholder="標題，例：秤預拌粉" style={{ ...s.input, marginBottom: 6 }} />
        <textarea value={x.desc} onChange={e => upStep(i, "desc", e.target.value)} placeholder="怎麼做" rows={3} style={{ ...s.input, marginBottom: 6, resize: "vertical" }} />
        <textarea value={x.warn || ""} onChange={e => upStep(i, "warn", e.target.value)} placeholder="注意事項（選填）" rows={2} style={{ ...s.input, marginBottom: 6, resize: "vertical" }} />
        <label style={{ ...s.btn("ghost"), cursor: "pointer", color: x.img ? C.green : C.muted }}>📷 {x.img ? "已有照片（點一下更換）" : "加照片（選填）"}<input type="file" accept="image/*" onChange={e => photo(i, e.target.files[0])} style={{ display: "none" }} /></label>
      </div>)}
      <button onClick={() => setEdit(e => ({ ...e, steps: [...e.steps, { title: "", desc: "", warn: "", img: "" }] }))} style={{ ...s.btn("ghost"), marginBottom: 8 }}>＋ 加一個步驟</button>
      <div style={{ display: "flex", gap: 8 }}><button onClick={() => setEdit(null)} style={{ ...s.btn("ghost"), flex: 1 }}>取消</button><button disabled={busy || !edit.type.trim()} onClick={save} style={{ ...s.btn("primary"), flex: 2, opacity: busy ? .6 : 1 }}>儲存</button></div>
      <Flash text={msg} />{msg && <div style={{ fontSize: 13, marginTop: 8, color: C.red }}>{msg}</div>}
    </div>
  );
  return (
    <div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12, paddingBottom: 2 }}>
        {types.map(t => <button key={t} onClick={() => setType(t)} style={{ flex: "0 0 auto", border: `1px solid ${type === t ? C.accent : C.border}`, background: type === t ? C.accentBg : C.card, color: type === t ? C.accent : C.text, borderRadius: 999, padding: "7px 14px", fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>{t}</button>)}
      </div>
      {steps.length === 0 && <div style={{ ...s.card, color: C.muted, textAlign: "center" }}>這份 SOP 還沒有內容</div>}
      {steps.map((x, i) => <div key={i} style={{ ...s.card, display: "flex", gap: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: 14, background: C.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{i + 1}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{x.title}</div>
          {x.desc && <div style={{ fontSize: 13.5, color: C.text, marginTop: 4, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{x.desc}</div>}
          {x.warn && <div style={{ fontSize: 12.5, color: C.gold, background: C.goldBg, borderRadius: 8, padding: "6px 9px", marginTop: 6, whiteSpace: "pre-wrap" }}>⚠️ {x.warn}</div>}
          {x.img && <a href={x.img} target="_blank" rel="noreferrer" style={{ display: "inline-block", fontSize: 12.5, color: C.accent, marginTop: 6 }}>📷 看照片 ›</a>}
        </div>
      </div>)}
      {canEdit && <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => { setMsg(""); setEdit({ type, steps: steps.map(x => ({ ...x })) }); }} style={{ ...s.btn("ghost"), flex: 1 }}>✏️ 編輯這份</button>
        <button onClick={() => { setMsg(""); setEdit({ type: "", isNew: true, steps: [{ title: "", desc: "", warn: "", img: "" }] }); }} style={{ ...s.btn("ghost"), flex: 1 }}>＋ 新增 SOP</button>
      </div>}
      <Flash text={msg} />{msg && <div style={{ fontSize: 13, marginTop: 8, color: C.green }}>{msg}</div>}
    </div>
  );
}
