// ═══════════════════════════════════════════════
// 營運管理畫面（v1.20，2026-11-12）
//   MaterialsPage   物料需求（合作櫃位、加盟店、各櫃位叫貨；總部改狀態；月底結算）
//   OnboardCard     新進夥伴到職檢查（Lv.2 以上首頁提示）
//   StaffManager    夥伴資料：新增夥伴、到職檢查（Lv.3）
//   LocManager      櫃位管理：新增、改資料、開關、停用（Lv.3）
//   AnnouncePage    發公告＋推播 LINE 群組、群組管理、本月則數（Lv.3）
//   PnlPage         加盟店損益（加盟主＝該店分隊長、總部 Lv.3）
//   PricePage       供貨價格（Lv.3）／ReceivablePage 應收加盟店（Lv.3）
//   PartnerHome     合作夥伴的首頁
// ═══════════════════════════════════════════════
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";

const pad = n => String(n).padStart(2, "0");
const ymOf = d => d.slice(0, 7);
const addMonth = (ym, n) => { let [y, m] = ym.split("-").map(Number); m += n; y += Math.floor((m - 1) / 12); m = ((m - 1) % 12 + 12) % 12 + 1; return `${y}-${pad(m)}`; };
const short = n => String(n || "").replace(/^\d+/, "").replace(/^(正櫃|快閃櫃位?|展覽)/, "") || n;
const money = n => (n < 0 ? "−" : "") + "$" + Math.abs(Math.round(n || 0)).toLocaleString();
const md = d => d ? `${+d.slice(5, 7)}/${+d.slice(8, 10)}` : "";
const ST_COLOR = C => ({ "已送出": C.gold, "已收到": C.blue || C.accent, "已出貨": C.accent, "已送達": C.green, "已取消": C.light });

function Sheet({ C, onClose, title, children }) {
  return createPortal(
    <div style={{ position:"fixed", inset:0, background:"rgba(43,34,28,.38)", zIndex:1000, display:"flex", alignItems:"flex-end" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.card, borderRadius:"22px 22px 0 0", width:"100%", maxWidth:480, margin:"0 auto",
        maxHeight:"86vh", overflowY:"auto", padding:"18px 18px calc(22px + env(safe-area-inset-bottom))", boxSizing:"border-box",
        fontFamily:"'Noto Sans TC','PingFang TC',sans-serif", color:C.text }}>
        <div style={{ width:36, height:4, borderRadius:2, background:C.border, margin:"-6px auto 14px" }}/>
        <div style={{ fontSize:16, fontWeight:600, marginBottom:14 }}>{title}</div>
        {children}
      </div>
    </div>, document.body);
}
function Seg({ C, items, value, onChange }) {
  return (
    <div style={{ display:"flex", background:C.warm, borderRadius:12, padding:3, gap:2, marginBottom:12 }}>
      {items.map(([k, label, badge]) => (
        <button key={k} onClick={() => onChange(k)} style={{ flex:1, border:"none", borderRadius:10, padding:"8px 4px", fontSize:13, fontFamily:"inherit", cursor:"pointer",
          background: value === k ? C.card : "transparent", color: value === k ? C.text : C.muted, fontWeight: value === k ? 600 : 500 }}>
          {label}{badge ? <span style={{ marginLeft:4, background:C.accent, color:"#fff", borderRadius:8, fontSize:10.5, padding:"0 5px" }}>{badge}</span> : null}
        </button>
      ))}
    </div>
  );
}
function MonthNav({ C, ym, setYm }) {
  const b = { width:34, height:34, borderRadius:10, border:`1px solid ${C.border}`, background:C.card, color:C.text, fontSize:16, cursor:"pointer", fontFamily:"inherit" };
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
      <button onClick={() => setYm(addMonth(ym, -1))} style={b}>‹</button>
      <div style={{ fontSize:16, fontWeight:600 }}>{+ym.slice(0, 4)} 年 {+ym.slice(5)} 月</div>
      <button onClick={() => setYm(addMonth(ym, 1))} style={b}>›</button>
    </div>
  );
}
const Msg = ({ C, m }) => m ? <div style={{ fontSize:12.5, marginTop:8, padding:"7px 10px", borderRadius:10, background: m.ok ? "#e8f3ea" : C.redBg, color: m.ok ? C.green : C.red }}>{m.text}</div> : null;
const Row = ({ C, l, v, sub, color, bold }) => (
  <div style={{ display:"flex", justifyContent:"space-between", gap:8, padding:"7px 0", borderBottom:`1px solid ${C.border}`, fontSize:13 }}>
    <span style={{ color:C.muted }}>{l}{sub && <div style={{ fontSize:11, color:C.light }}>{sub}</div>}</span>
    <span style={{ fontWeight: bold ? 700 : 600, color: color || C.text, whiteSpace:"nowrap" }}>{v}</span>
  </div>
);

// ═══════════ 物料需求 ═══════════
// v1.24 叫貨品項分類
const CAT_ICON = { "原物料":"🥣", "包材":"🛍", "製作器具":"🍳", "文具":"✏️", "機器保養":"🛠", "其他":"📦" };
const matCats = items => { const m = []; items.forEach(x => { const c = x.cat || "其他"; let g = m.find(y => y[0] === c); if (!g) { g = [c, []]; m.push(g); } g[1].push(x); }); return m; };

export function MaterialsPage({ user, apiGet, apiPost, C, s, locations, me, todayStr }) {
  const today = todayStr();
  const [view, setView] = useState("new");
  const [items, setItems] = useState([]);
  const myLocs = (me?.myLocs?.length ? me.myLocs : Object.keys(locations || {})).filter(Boolean);
  const [loc, setLoc] = useState(myLocs[0] || "");
  const [qty, setQty] = useState({});
  const [other, setOther] = useState("");
  const [want, setWant] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState(null);
  const [canManage, setCanManage] = useState(false);
  const [ym, setYm] = useState(ymOf(today));
  const [monthly, setMonthly] = useState(null);
  const [openCat, setOpenCat] = useState({});
  useEffect(() => { apiGet({ action:"opsMatItems", empId:user.id }, 1).then(r => r && r.success && setItems(r.items)); }, []);
  const [bu, setBu] = useState(null);   // v1.22 麵糊建議叫貨（Lv.2 以上）
  useEffect(() => { if (user.role >= 2) apiGet({ action:"buList", empId:user.id }, 1).then(r => r && r.success && setBu(r.data)); }, []);
  const buLoc = bu && bu.find(b => b.name === loc || (b.code && String(loc).slice(0, 2) === b.code));
  const buSug = buLoc ? ((buLoc.orig && buLoc.orig.suggest) || 0) + ((buLoc.other && buLoc.other.suggest) || 0) : 0;
  useEffect(() => { if (!loc && myLocs[0]) setLoc(myLocs[0]); }, [myLocs.join()]);
  const loadList = () => apiGet({ action:"opsMatList", empId:user.id, ym, open:1 }, 1).then(r => { if (r && r.success) { setList(r.data); setCanManage(r.canManage); } else setList([]); });
  const loadMonthly = () => { setMonthly(null); apiGet({ action:"opsMatMonthly", empId:user.id, ym }, 1).then(r => setMonthly(r && r.success ? r.data : [])); };
  useEffect(() => { if (view === "list") loadList(); if (view === "month") loadMonthly(); }, [view, ym]);

  const submit = async () => {
    const its = items.map(x => ({ item:x.item, unit:x.unit, qty:+qty[x.item] || 0, note: x.item === "其他" ? other : "" })).filter(x => x.qty > 0);
    if (!loc) { setMsg({ text:"請選櫃位" }); return; }
    if (!its.length) { setMsg({ text:"請至少填一項數量" }); return; }
    if (its.some(x => x.item === "其他") && !other.trim()) { setMsg({ text:"「其他」請寫是什麼" }); return; }
    setBusy(true);
    const r = await apiPost({ action:"opsMatCreate", empId:user.id, loc, items:its.map(x => x.item === "其他" ? { ...x, item:"其他:" + other.trim().slice(0, 14) } : x), want, note }, 0);
    setBusy(false);
    if (r && r.success) { setMsg({ ok:true, text:"已送出，總部會盡快處理" }); setQty({}); setOther(""); setNote(""); setWant(""); }
    else setMsg({ text:(r && r.error) || "送出失敗" });
  };
  const setStatus = async (x, status) => {
    if (status === "已取消" && !confirm("取消這張需求單？")) return;
    const r = await apiPost({ action:"opsMatStatus", empId:user.id, id:x.id, status }, 0);
    if (r && r.success) loadList(); else alert((r && r.error) || "更新失敗");
  };
  const stC = ST_COLOR(C);

  return (
    <div>
      <Seg C={C} value={view} onChange={setView} items={[["new","叫貨"],["list","需求單", canManage && me?.matPending ? me.matPending : 0],["month","月結"]]}/>
      {view === "new" && (
        <div style={s.card}>
          <label style={s.label}>櫃位</label>
          <select value={loc} onChange={e => setLoc(e.target.value)} style={{ ...s.input, marginBottom:12 }}>
            {!loc && <option value="">請選擇</option>}
            {myLocs.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          {buLoc && buSug > 0 && (
            <div style={{ background: buLoc.low ? C.redBg : C.warm, borderRadius:12, padding:"10px 12px", marginBottom:12, fontSize:12.5, lineHeight:1.6 }}>
              <b style={{ color: buLoc.low ? C.red : C.text }}>🥣 建議叫麵糊 {buSug} 包</b>（原味 {(buLoc.orig && buLoc.orig.suggest) || 0}・其他口味 {(buLoc.other && buLoc.other.suggest) || 0}）
              <div style={{ color:C.muted }}>剩 原味 {buLoc.stock ? buLoc.stock.orig : "—"}・其他 {buLoc.stock ? buLoc.stock.other : "—"} 包，還夠 原味 {buLoc.orig && buLoc.orig.days !== null ? buLoc.orig.days + " 天" : "—"}・其他 {buLoc.other && buLoc.other.days !== null ? buLoc.other.days + " 天" : "—"}</div>
              {items.some(x => x.item === "原味麵糊") && buLoc.orig && buLoc.orig.suggest > 0 && <button onClick={() => { setQty(q => ({ ...q, "原味麵糊":String(buLoc.orig.suggest) })); setOpenCat(o => ({ ...o, "原物料":true })); }} style={{ ...s.btn("secondary"), width:"auto", padding:"5px 12px", fontSize:12, marginTop:6 }}>原味麵糊帶入 {buLoc.orig.suggest} 包</button>}
              {buLoc.other && buLoc.other.suggest > 0 && <div style={{ fontSize:11.5, color:C.muted, marginTop:4 }}>其他口味共 {buLoc.other.suggest} 包，請依各口味剩餘自行分配</div>}
            </div>
          )}
          <div style={s.sectionTitle}>需要什麼（填數量）</div>
          {matCats(items).map(([cat, its]) => {
            const n = its.filter(x => +qty[x.item] > 0).length, isOpen = openCat[cat] ?? (cat === "原物料" || n > 0);
            return (
              <div key={cat} style={{ border:`1px solid ${C.border}`, borderRadius:12, marginBottom:8, overflow:"hidden" }}>
                <button onClick={() => setOpenCat(o => ({ ...o, [cat]: !isOpen }))} style={{ width:"100%", border:"none", background:C.warm, padding:"10px 12px", display:"flex", alignItems:"center", cursor:"pointer", fontFamily:"inherit", color:C.text }}>
                  <span style={{ flex:1, textAlign:"left", fontWeight:600, fontSize:14 }}>{CAT_ICON[cat] || "📦"} {cat}</span>
                  {n > 0 && <span style={{ fontSize:12, color:"#fff", background:C.accent, borderRadius:999, padding:"1px 8px", marginRight:8 }}>{n}</span>}
                  <span style={{ fontSize:12, color:C.muted }}>{isOpen ? "▴" : `${its.length} 項 ▾`}</span>
                </button>
                {isOpen && <div style={{ padding:"2px 12px" }}>{its.map((x, k) => (
                  <div key={x.item} style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 0", borderTop: k ? `1px solid ${C.border}` : "none" }}>
                    <span style={{ flex:1, fontSize:14 }}>{x.item}</span>
                    {x.item === "其他" && <input value={other} onChange={e => setOther(e.target.value)} placeholder="品名" style={{ ...s.input, width:110, padding:"8px" }}/>}
                    <input type="number" inputMode="decimal" min="0" value={qty[x.item] || ""} onChange={e => setQty({ ...qty, [x.item]:e.target.value })} placeholder="0" style={{ ...s.input, width:70, padding:"8px", textAlign:"center" }}/>
                    <span style={{ width:24, fontSize:12.5, color:C.muted }}>{x.unit}</span>
                  </div>
                ))}</div>}
              </div>
            );
          })}
          <label style={{ ...s.label, marginTop:12 }}>希望到貨日（選填）</label>
          <input type="date" value={want} min={today} onChange={e => setWant(e.target.value)} style={{ ...s.input, marginBottom:10 }}/>
          <label style={s.label}>備註（選填）</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} style={{ ...s.input, resize:"vertical", marginBottom:12 }} placeholder="例：週末活動用，麻煩週五前送到"/>
          <button disabled={busy} onClick={submit} style={{ ...s.btn("primary"), opacity:busy ? .6 : 1 }}>{busy ? "送出中…" : "送出需求"}</button>
          <Msg C={C} m={msg}/>
        </div>
      )}
      {view === "list" && (
        <div>
          {list === null && <div style={{ ...s.card, textAlign:"center", color:C.muted, fontSize:13 }}>載入中…</div>}
          {list && !list.length && <div style={{ ...s.card, textAlign:"center", color:C.muted, fontSize:13 }}>目前沒有需求單</div>}
          {(list || []).map(x => (
            <div key={x.id} style={s.card}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <b style={{ fontSize:14, fontWeight:600 }}>{short(x.loc)}</b>
                <span style={{ fontSize:12, color:"#fff", background:stC[x.status] || C.muted, borderRadius:10, padding:"2px 10px" }}>{x.status}</span>
              </div>
              <div style={{ fontSize:13, marginTop:6, lineHeight:1.7 }}>{x.items.map(it => `${it.item} ${it.qty}${it.unit || ""}`).join("、")}</div>
              <div style={{ fontSize:11.5, color:C.muted, marginTop:4 }}>
                {x.name}・{x.created.slice(5, 16)}{x.want ? `・希望 ${md(x.want)} 到` : ""}{x.amount !== null && x.amount !== undefined ? `・${money(x.amount)}` : ""}
              </div>
              {x.note && <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>備註：{x.note}</div>}
              <div style={{ display:"flex", gap:6, marginTop:10, flexWrap:"wrap" }}>
                {canManage && x.status === "已送出" && <button onClick={() => setStatus(x, "已收到")} style={{ ...s.btn("secondary"), width:"auto", padding:"7px 12px", fontSize:12.5 }}>已收到</button>}
                {canManage && /已送出|已收到/.test(x.status) && <button onClick={() => setStatus(x, "已出貨")} style={{ ...s.btn("primary"), width:"auto", padding:"7px 12px", fontSize:12.5 }}>已出貨</button>}
                {x.status === "已出貨" && <button onClick={() => setStatus(x, "已送達")} style={{ ...s.btn("secondary"), width:"auto", padding:"7px 12px", fontSize:12.5 }}>已送達</button>}
                {((canManage && !/已送達|已取消/.test(x.status)) || (x.empId === user.id && x.status === "已送出")) &&
                  <button onClick={() => setStatus(x, "已取消")} style={{ ...s.btn("ghost"), width:"auto", padding:"7px 12px", fontSize:12.5, color:C.red }}>取消</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {view === "month" && (
        <div style={s.card}>
          <MonthNav C={C} ym={ym} setYm={setYm}/>
          {monthly === null && <div style={{ textAlign:"center", color:C.muted, fontSize:13 }}>計算中…</div>}
          {monthly && !monthly.length && <div style={{ textAlign:"center", color:C.muted, fontSize:13 }}>這個月沒有叫貨</div>}
          {(monthly || []).map(L => (
            <div key={L.loc} style={{ marginBottom:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:14, fontWeight:600, marginBottom:4 }}>
                <span>{short(L.loc)}</span><span>{L.orders} 張{L.amount ? `・${money(L.amount)}` : ""}</span>
              </div>
              {L.items.map(it => <Row key={it.item + it.unit} C={C} l={it.item} v={`${it.qty} ${it.unit || ""}`}/>)}
              {L.pending > 0 && <div style={{ fontSize:11.5, color:C.gold, marginTop:4 }}>還有 {L.pending} 張未出貨（金額以出貨時的單價計算）</div>}
            </div>
          ))}
          <div style={{ fontSize:11.5, color:C.light }}>不含已取消。金額＝出貨時〈供貨價格〉的單價 × 數量。</div>
        </div>
      )}
    </div>
  );
}

// ═══════════ 到職檢查（首頁卡片＋夥伴管理頁共用）═══════════
export function OnboardCard({ user, apiGet, apiPost, C, s, compact }) {
  const [d, setD] = useState(null);
  const load = () => apiGet({ action:"opsOnboard", empId:user.id }, 0).then(r => setD(r && r.success ? r : null));
  useEffect(() => { load(); }, []);
  if (!d || !d.data.length) return compact ? null : <div style={{ ...s.card, fontSize:13, color:C.green }}>✓ 沒有待完成的到職檢查</div>;
  const tick = async (id, item, on) => {
    setD({ ...d, data:d.data.map(x => x.id === id ? { ...x, items:{ ...x.items, [item]: on ? { by:user.name } : null } } : x) });
    const r = await apiPost({ action:"opsOnboardCheck", empId:user.id, target:id, item, on }, 0);
    if (!r || !r.success) { alert((r && r.error) || "更新失敗"); }
    load();
  };
  return (
    <div style={{ ...s.card, borderLeft:`4px solid ${C.gold}` }}>
      <div style={{ fontSize:14, fontWeight:600, marginBottom:6 }}>🧾 新進夥伴到職檢查（{d.data.length}）</div>
      {d.data.map(x => (
        <div key={x.id} style={{ padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
          <div style={{ fontSize:13.5, fontWeight:600 }}>{x.name} <span style={{ fontSize:11.5, color:C.muted, fontWeight:400 }}>{x.id}・{String(x.created).slice(0, 10)} 建檔</span></div>
          <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginTop:6 }}>
            {d.items.map(k => (
              <label key={k} style={{ display:"flex", alignItems:"center", gap:5, fontSize:13 }} title={x.items[k] ? `${x.items[k].by} ${x.items[k].at || ""}` : ""}>
                <input type="checkbox" checked={!!x.items[k]} onChange={e => tick(x.id, k, e.target.checked)}/>{k}
              </label>
            ))}
          </div>
        </div>
      ))}
      <div style={{ fontSize:11.5, color:C.muted, marginTop:6 }}>四項都勾完，這張提示就會消失；系統會記下誰、何時勾的。</div>
    </div>
  );
}

// ═══════════ 夥伴資料（新增夥伴）═══════════
const ROLE_NAME = { 1:"夥伴", 2:"分隊長", 3:"管理者", 4:"總經理", 5:"大隊長" };
export function StaffManager({ user, apiGet, apiPost, C, s, locations }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState("");
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState(null);
  const [ver, setVer] = useState(0);
  const saveEdit = async () => {
    setBusy(true);
    const r = await apiPost({ action:"opsStaffUpdate", empId:user.id, token:user.token || "", staff:{ ...edit, managed:edit.mlist.join("、") } }, 0);
    setBusy(false);
    if (r && r.success) { setEdit(null); setMsg({ ok:true, text:`已更新 ${edit.name}` }); load(); } else alert((r && r.error) || "更新失敗");
  };
  const load = () => apiGet({ action:"opsStaffList", empId:user.id, token:user.token || "" }, 1).then(r => { if (r && r.success) setList(r.data); else { setList([]); setErr((r && r.error) || "讀取失敗"); } });
  useEffect(() => { load(); }, []);
  const blank = { name:"", nick:"", sex:"", phone:"", bday:"", hire:new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10), role:1, pos:"夥伴", type:"員工", managed:"", idno:"", addr:"", addr1:"" };
  const up = (k, v) => setForm({ ...form, [k]:v });
  const save = async () => {
    setBusy(true); setMsg(null);
    const r = await apiPost({ action:"opsStaffAdd", empId:user.id, token:user.token || "", staff:form }, 0);
    setBusy(false);
    if (r && r.success) { setMsg({ ok:true, text:`已新增 ${form.name}（${r.id}）。登入帳號＝手機，第一次密碼＝生日 ${r.password}。` }); setForm(null); load(); setVer(v => v + 1); }
    else setMsg({ text:(r && r.error) || "新增失敗" });
  };
  const F = (k, label, props = {}) => (
    <div style={{ marginBottom:10 }}>
      <label style={s.label}>{label}</label>
      <input value={form[k]} onChange={e => up(k, e.target.value)} style={s.input} {...props}/>
    </div>
  );
  const shown = (list || []).filter(x => !q || (x.name + x.nick + x.id + (x.phone || "")).includes(q));
  return (
    <div>
      <OnboardCard key={ver} user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s}/>
      <button onClick={() => { setForm(blank); setMsg(null); }} style={{ ...s.btn("primary"), marginBottom:12 }}>＋ 新增夥伴</button>
      <Msg C={C} m={msg}/>
      {err && <div style={{ ...s.card, color:C.red, fontSize:13 }}>{err}</div>}
      <div style={s.card}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="搜尋姓名、編號、手機" style={{ ...s.input, marginBottom:8 }}/>
        {list && list[0] && list[0].idno !== undefined && <div style={{ fontSize:11.5, color:C.muted, marginBottom:4 }}>點夥伴可以改權限、職務、負責櫃位、帳號類型</div>}
        {list === null && <div style={{ color:C.muted, fontSize:13 }}>載入中…</div>}
        {shown.map(x => (
          <div key={x.id} onClick={() => x.idno !== undefined && setEdit({ id:x.id, name:x.name, role:x.role, pos:x.pos, type:x.type, left:x.leftDate || "",
              mlist: String(x.managed || "").split(/[、,，;；]+/).map(t => t.trim()).filter(Boolean).map(t => Object.keys(locations || {}).find(l => l === t || l.includes(t)) || t) })}
            style={{ padding:"9px 0", borderBottom:`1px solid ${C.border}`, opacity: x.left ? .5 : 1, cursor: x.idno !== undefined ? "pointer" : "default" }}>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <b style={{ fontSize:14, fontWeight:600 }}>{x.name} <span style={{ fontWeight:400, fontSize:12, color:C.muted }}>{x.nick}・{x.id}</span></b>
              <span style={{ fontSize:12, color:C.muted }}>{x.left ? "已離職" : `Lv.${x.role} ${ROLE_NAME[x.role] || ""}`}</span>
            </div>
            <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>
              {x.pos}{x.type !== "員工" ? `・${x.type}` : ""}{x.managed ? `・負責 ${x.managed}` : ""}{x.hire ? `・到職 ${x.hire}` : ""}{x.onboard === false ? "・到職檢查未完成" : ""}
            </div>
            {x.idno !== undefined && <div style={{ fontSize:11.5, color:C.light, marginTop:2 }}>{x.phone}・{x.idno ? x.idno.slice(0, 3) + "＊＊＊＊" + x.idno.slice(-3) : "未填身分證"}{x.addr2 ? `・${x.addr2}` : ""}</div>}
          </div>
        ))}
      </div>
      {edit && (
        <Sheet C={C} title={`修改 ${edit.name}（${edit.id}）`} onClose={() => !busy && setEdit(null)}>
          <div style={{ display:"flex", gap:8, marginBottom:10 }}>
            <div style={{ flex:1 }}><label style={s.label}>權限等級</label>
              <select value={edit.role} onChange={e => setEdit({ ...edit, role:+e.target.value })} style={s.input}>
                {[1,2,3,4,5].filter(n => n <= Math.max(user.role || 3, 3)).map(n => <option key={n} value={n}>Lv.{n} {ROLE_NAME[n]}</option>)}</select></div>
            <div style={{ flex:1 }}><label style={s.label}>職務</label><input value={edit.pos} onChange={e => setEdit({ ...edit, pos:e.target.value })} style={s.input}/></div>
          </div>
          <label style={s.label}>帳號類型</label>
          <select value={edit.type} onChange={e => setEdit({ ...edit, type:e.target.value })} style={{ ...s.input, marginBottom:10 }}><option>員工</option><option>加盟店夥伴</option><option>合作夥伴</option></select>
          <label style={s.label}>負責櫃位（分隊長排班、對帳看得到這些櫃位；可複選）</label>
          <div style={{ background:C.warm, borderRadius:12, padding:"6px 10px", marginBottom:10 }}>
            {Object.keys(locations || {}).map(l => (
              <label key={l} style={{ display:"flex", alignItems:"center", gap:8, fontSize:13.5, padding:"5px 0" }}>
                <input type="checkbox" checked={edit.mlist.includes(l)} onChange={e => setEdit({ ...edit, mlist: e.target.checked ? edit.mlist.concat([l]) : edit.mlist.filter(x => x !== l) })}/>{l}
              </label>
            ))}
          </div>
          <label style={s.label}>離職日（填了就不能登入、不再計薪；留空＝在職）</label>
          <input type="date" value={edit.left} onChange={e => setEdit({ ...edit, left:e.target.value })} style={{ ...s.input, marginBottom:12 }}/>
          <button disabled={busy} onClick={saveEdit} style={{ ...s.btn("primary"), opacity:busy ? .6 : 1 }}>{busy ? "儲存中…" : "儲存"}</button>
        </Sheet>
      )}
      {form && (
        <Sheet C={C} title="新增夥伴" onClose={() => !busy && setForm(null)}>
          {F("name", "姓名 *")}{F("nick", "暱稱 *（App 和宇宙辦公室顯示用）")}
          {F("phone", "手機 *（登入帳號）", { inputMode:"tel", placeholder:"09xxxxxxxx" })}
          {F("bday", "生日 *（第一次登入的密碼＝月日 4 碼）", { type:"date" })}
          {F("hire", "到職日 *", { type:"date" })}
          {F("idno", "身分證字號 *（勞健保加保用，只有 Lv.3 看得到）", { placeholder:"A123456789", style:{ ...s.input, textTransform:"uppercase" } })}
          {F("addr", "通訊地址 *（勞健保加保用）")}
          {F("addr1", "戶籍地址（選填）")}
          <div style={{ display:"flex", gap:8, marginBottom:10 }}>
            <div style={{ flex:1 }}><label style={s.label}>性別</label>
              <select value={form.sex} onChange={e => up("sex", e.target.value)} style={s.input}><option value="">—</option><option>男</option><option>女</option></select></div>
            <div style={{ flex:1 }}><label style={s.label}>帳號類型</label>
              <select value={form.type} onChange={e => up("type", e.target.value)} style={s.input}><option>員工</option><option>加盟店夥伴</option><option>合作夥伴</option></select></div>
          </div>
          <div style={{ display:"flex", gap:8, marginBottom:10 }}>
            <div style={{ flex:1 }}><label style={s.label}>權限等級 *</label>
              <select value={form.role} onChange={e => { const v = +e.target.value; setForm({ ...form, role:v, pos: v === 2 ? "分隊長" : v === 1 ? "夥伴" : form.pos }); }} style={s.input}>
                {[1,2,3,4,5].filter(n => n <= (user.role || 3)).map(n => <option key={n} value={n}>Lv.{n} {ROLE_NAME[n]}</option>)}
              </select></div>
            <div style={{ flex:1 }}><label style={s.label}>職務 *</label><input value={form.pos} onChange={e => up("pos", e.target.value)} style={s.input}/></div>
          </div>
          {(form.role === 2 || form.type !== "員工") && (
            <div style={{ marginBottom:10 }}>
              <label style={s.label}>負責櫃位{form.role === 2 ? " *" : "（合作／加盟夥伴請選所屬櫃位）"}</label>
              <select value={form.managed} onChange={e => up("managed", e.target.value)} style={s.input}>
                <option value="">請選擇</option>{Object.keys(locations || {}).map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          )}
          <div style={{ fontSize:11.5, color:C.muted, margin:"4px 0 12px", lineHeight:1.6 }}>時薪預設 196。銀行帳戶、勞健保級距等其他欄位請之後到 Google 試算表補。新增後首頁會出現「到職檢查」。</div>
          <button disabled={busy} onClick={save} style={{ ...s.btn("primary"), opacity:busy ? .6 : 1 }}>{busy ? "新增中…" : "確認新增"}</button>
          <Msg C={C} m={msg && !msg.ok ? msg : null}/>
        </Sheet>
      )}
    </div>
  );
}

// ═══════════ 櫃位管理 ═══════════
const ST_TAG = C => ({ "營運中": C.green, "休賽期": C.gold, "暫停": C.gold, "已結束": C.light, "已停用": C.light });
export function LocManager({ user, apiGet, apiPost, C, s }) {
  const [d, setD] = useState(null);
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showOff, setShowOff] = useState(false);
  const load = () => apiGet({ action:"opsLocList", empId:user.id }, 1).then(r => setD(r && r.success ? r : { error:(r && r.error) || "讀取失敗" }));
  useEffect(() => { load(); }, []);
  if (!d) return <div style={{ ...s.card, textAlign:"center", color:C.muted, fontSize:13 }}>載入中…</div>;
  if (d.error) return <div style={{ ...s.card, color:C.red, fontSize:13 }}>{d.error}</div>;
  const up = (k, v) => setForm({ ...form, [k]:v });
  const save = async () => {
    setBusy(true); setMsg(null);
    if (form.orig && form.orig !== form.name && !confirm(`把「${form.orig}」改名為「${form.name}」？\n班表、班型、負責櫃位、物料單、訂單等會一起改成新名稱；舊的打卡和收店紀錄用編號 ${form.code} 對，不受影響。`)) { setBusy(false); return; }
    const r = await apiPost({ action:"opsLocSave", empId:user.id, loc:form }, 0);
    setBusy(false);
    if (r && r.success) { setForm(null); load(); if (r.renamed && Object.keys(r.renamed).length) alert("已一起更新：\n" + Object.keys(r.renamed).map(k => `${k}：${r.renamed[k]} 筆`).join("\n")); }
    else setMsg({ text:(r && r.error) || "儲存失敗" });
  };
  const setStatus = async (x, status) => {
    if (status === "已停用" && !confirm(`停用「${x.name}」？\n停用後打卡、排班、宇宙辦公室都不會再出現；舊的打卡和薪資紀錄會保留。之後可以再開啟。`)) return;
    const r = await apiPost({ action:"opsLocStatus", empId:user.id, name:x.name, status }, 0);
    if (r && r.success) load(); else alert((r && r.error) || "更新失敗");
  };
  const tag = ST_TAG(C);
  const list = d.data.filter(x => showOff || x.status !== "已停用");
  return (
    <div>
      <button onClick={() => { setForm({ code:"", name:"", county:"台北市", type:"A百貨", unitPrice:"", status:"營運中", kind:"固定櫃位", lat:"", lng:"", items:"雞蛋糕" }); setMsg(null); }} style={{ ...s.btn("primary"), marginBottom:12 }}>＋ 新增櫃位</button>
      {list.map(x => (
        <div key={x.name} style={s.card}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <b style={{ fontSize:14.5, fontWeight:600 }}>{x.name} <span style={{ fontSize:11.5, color:C.muted, fontWeight:400 }}>#{x.code || "—"}</span></b>
            <span style={{ fontSize:12, color:"#fff", background:tag[x.status] || C.muted, borderRadius:10, padding:"2px 10px" }}>{x.status}</span>
          </div>
          <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>{x.county}・{x.type}・{x.kind}{x.lat !== "" ? "・有座標" : "・沒有座標（打卡不檢查距離）"}</div>
          <div style={{ display:"flex", gap:6, marginTop:10, flexWrap:"wrap" }}>
            <button onClick={() => { setForm({ ...x, orig:x.name }); setMsg(null); }} style={{ ...s.btn("secondary"), width:"auto", padding:"7px 12px", fontSize:12.5 }}>編輯</button>
            {x.status !== "營運中" && <button onClick={() => setStatus(x, "營運中")} style={{ ...s.btn("ghost"), width:"auto", padding:"7px 12px", fontSize:12.5 }}>開啟</button>}
            {x.status === "營運中" && <button onClick={() => setStatus(x, "暫停")} style={{ ...s.btn("ghost"), width:"auto", padding:"7px 12px", fontSize:12.5 }}>暫停</button>}
            {x.status !== "已停用" && <button onClick={() => setStatus(x, "已停用")} style={{ ...s.btn("ghost"), width:"auto", padding:"7px 12px", fontSize:12.5, color:C.red }}>停用並隱藏</button>}
          </div>
        </div>
      ))}
      <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:12.5, color:C.muted, margin:"4px 4px 12px" }}>
        <input type="checkbox" checked={showOff} onChange={e => setShowOff(e.target.checked)}/>顯示已停用的櫃位（{d.data.filter(x => x.status === "已停用").length}）
      </label>
      {form && (
        <Sheet C={C} title={form.orig ? "編輯櫃位" : "新增櫃位"} onClose={() => !busy && setForm(null)}>
          <div style={{ display:"flex", gap:8, marginBottom:10 }}>
            <div style={{ width:86 }}><label style={s.label}>編號</label>
              <input value={form.code} inputMode="numeric" maxLength={2} disabled={!!(form.orig && form.code)} onChange={e => up("code", e.target.value.replace(/\D/g, ""))} placeholder="24" style={{ ...s.input, opacity: form.orig && form.code ? .6 : 1 }}/></div>
            <div style={{ flex:1 }}><label style={s.label}>櫃位名稱（可隨時改）</label>
              <input value={form.name} onChange={e => up("name", e.target.value)} placeholder="24新光三越-B1" style={s.input}/></div>
          </div>
          <div style={{ fontSize:11.5, color:C.muted, margin:"-4px 0 10px", lineHeight:1.6 }}>編號是打卡、薪資、損益等紀錄連動用的，建立後不能改；名稱改了，其他分頁會一起換成新名稱。</div>
          <div style={{ display:"flex", gap:8, marginBottom:10 }}>
            <div style={{ flex:1 }}><label style={s.label}>縣市（颱風假依此判斷）</label><input value={form.county} onChange={e => up("county", e.target.value)} style={s.input}/></div>
            <div style={{ flex:1 }}><label style={s.label}>業績類型</label><select value={form.type} onChange={e => up("type", e.target.value)} style={s.input}>{d.types.map(t => <option key={t}>{t}</option>)}</select></div>
          </div>
          <div style={{ display:"flex", gap:8, marginBottom:10 }}>
            <div style={{ flex:1 }}><label style={s.label}>場所性質</label><select value={form.kind} onChange={e => up("kind", e.target.value)} style={s.input}>{d.kinds.map(t => <option key={t}>{t}</option>)}</select></div>
            <div style={{ flex:1 }}><label style={s.label}>狀態</label><select value={form.status} onChange={e => up("status", e.target.value)} style={s.input}>{d.statuses.map(t => <option key={t}>{t}</option>)}</select></div>
          </div>
          {form.type === "C份數" && <><label style={s.label}>每份抽成</label><input type="number" value={form.unitPrice} onChange={e => up("unitPrice", e.target.value)} style={{ ...s.input, marginBottom:10 }}/></>}
          <div style={{ display:"flex", gap:8, marginBottom:6 }}>
            <div style={{ flex:1 }}><label style={s.label}>緯度（可留空）</label><input inputMode="decimal" value={form.lat} onChange={e => up("lat", e.target.value)} style={s.input}/></div>
            <div style={{ flex:1 }}><label style={s.label}>經度（可留空）</label><input inputMode="decimal" value={form.lng} onChange={e => up("lng", e.target.value)} style={s.input}/></div>
          </div>
          <button onClick={() => navigator.geolocation && navigator.geolocation.getCurrentPosition(p => setForm(f => ({ ...f, lat:p.coords.latitude.toFixed(7), lng:p.coords.longitude.toFixed(7) })), () => alert("拿不到定位"))}
            style={{ ...s.btn("ghost"), padding:"8px", fontSize:12.5, marginBottom:10 }}>📍 用我現在的位置（人在櫃位時按）</button>
          <label style={s.label}>品項（逗號分隔）</label>
          <input value={form.items} onChange={e => up("items", e.target.value)} style={{ ...s.input, marginBottom:12 }}/>
          <button disabled={busy} onClick={save} style={{ ...s.btn("primary"), opacity:busy ? .6 : 1 }}>{busy ? "儲存中…" : "儲存"}</button>
          <Msg C={C} m={msg}/>
          <div style={{ fontSize:11.5, color:C.muted, marginTop:10, lineHeight:1.6 }}>平日／假日上班時間請到「排班管理 → ⏰ 上班時間」設定（分隊長也可以改）。</div>
        </Sheet>
      )}
    </div>
  );
}

// ═══════════ 公告收件匣（首頁）：未讀與待按「我知道了」═══════════
export function AnnInbox({ user, list, apiPost, C, s, onChanged }) {
  const [open, setOpen] = useState(null);
  const [local, setLocal] = useState({});
  const st = a => ({ ...a, ...(local[a.id] || {}) });
  const todo = (list || []).map(st).filter(a => a.read === false || (a.ack && !a.acked && !a.mine));
  if (!todo.length) return null;
  const view = async a => {
    setOpen(a);
    if (!a.read) { setLocal(l => ({ ...l, [a.id]: { ...(l[a.id] || {}), read:true } })); apiPost({ action:"annRead", empId:user.id, id:a.id }, 0); }
  };
  const ack = async a => {
    setLocal(l => ({ ...l, [a.id]: { read:true, acked:true } })); setOpen(null);
    await apiPost({ action:"annRead", empId:user.id, id:a.id, kind:"ack" }, 0); onChanged && onChanged();
  };
  return (
    <div style={{ ...s.card, borderLeft:`4px solid ${C.accent}` }}>
      <div style={{ fontSize:14, fontWeight:600, marginBottom:4 }}>📢 新公告（{todo.length}）</div>
      {todo.slice(0, 6).map(a => (
        <button key={a.id} onClick={() => view(a)} style={{ width:"100%", display:"flex", alignItems:"center", gap:8, padding:"9px 0", border:"none", borderBottom:`1px solid ${C.border}`, background:"none", fontFamily:"inherit", textAlign:"left", cursor:"pointer", color:C.text }}>
          {!a.read && <span style={{ width:7, height:7, borderRadius:4, background:C.accent, flexShrink:0 }}/>}
          <span style={{ flex:1, fontSize:13.5, fontWeight: a.read ? 400 : 600, color: a.urgent ? C.accent : C.text }}>{a.urgent ? "🚨 " : ""}{a.title}</span>
          {a.ack && !a.acked && <span style={{ fontSize:11, color:C.gold, whiteSpace:"nowrap" }}>待按我知道了</span>}
        </button>
      ))}
      {open && (
        <Sheet C={C} title={(open.urgent ? "🚨 " : "📢 ") + open.title} onClose={() => setOpen(null)}>
          <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>{open.by}・{String(open.time || open.date).slice(0, 16)}{open.target && open.target.length ? `・${open.target.map(short).join("、")}` : ""}</div>
          <div style={{ fontSize:14, lineHeight:1.8, whiteSpace:"pre-wrap" }}>{open.body}</div>
          {open.ack && !st(open).acked && !open.mine
            ? <button onClick={() => ack(open)} style={{ ...s.btn("primary"), marginTop:16 }}>✅ 我知道了</button>
            : <button onClick={() => setOpen(null)} style={{ ...s.btn("ghost"), marginTop:16 }}>關閉</button>}
        </Sheet>
      )}
    </div>
  );
}

// ═══════════ 發公告＋LINE 群組 ═══════════
export function AnnouncePage({ user, apiGet, apiPost, C, s }) {
  const [view, setView] = useState("new");
  const [opt, setOpt] = useState(null);
  const [groups, setGroups] = useState(null);
  const [quota, setQuota] = useState(null);
  const [f, setF] = useState({ title:"", body:"", urgent:false, ack:false, groups:[], target:[] });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState(null);
  const [readers, setReaders] = useState(null);
  const [allLocs, setAllLocs] = useState([]);
  const tk = { empId:user.id, token:user.token || "" };
  const isTop = user.role >= 3;
  const loadGroups = () => isTop && apiGet({ action:"lineGroups", ...tk }, 1).then(r => setGroups(r && r.success ? r.data : []));
  useEffect(() => {
    apiGet({ action:"annOptions", ...tk }, 1).then(r => setOpt(r && r.success ? r : { error:(r && r.error) || "讀取失敗", locs:[], groups:[] }));
    if (isTop) { loadGroups(); apiGet({ action:"lineQuota", ...tk }, 0).then(r => r && r.success && setQuota(r)); apiGet({ action:"getLocations" }, 0).then(r => r && r.success && setAllLocs(Object.keys(r.data || {}))); }
  }, []);
  const loadList = () => apiGet({ action:"annList", ...tk }, 1).then(r => setList(r && r.success ? r.data : []));
  useEffect(() => { if (view === "list") loadList(); }, [view]);
  const tog = (k, id) => setF({ ...f, [k]: f[k].includes(id) ? f[k].filter(x => x !== id) : f[k].concat([id]) });
  const post = async () => {
    if (!f.title.trim() || !f.body.trim()) { setMsg({ text:"請填標題和內容" }); return; }
    if (!isTop && !f.target.length) { setMsg({ text:"請選要發給哪個櫃位" }); return; }
    if (!confirm(`發布「${f.title}」給${f.target.length ? f.target.map(short).join("、") : "全員"}？${f.groups.length ? `\n會推播到 ${f.groups.length} 個 LINE 群組。` : ""}`)) return;
    setBusy(true); setMsg(null);
    const r = await apiPost({ action:"annPost", ...tk, ...f }, 0);
    setBusy(false);
    if (r && r.success) {
      const p = r.pushed;
      setMsg({ ok:true, text:"已發布到 App" + (p ? `，LINE 推播成功 ${p.ok} 群${p.fail.length ? `、失敗 ${p.fail.length} 群（${p.fail[0]}）` : ""}` : "") });
      setF({ title:"", body:"", urgent:false, ack:false, groups:[], target:[] });
      isTop && apiGet({ action:"lineQuota", ...tk }, 0).then(q => q && q.success && setQuota(q));
    } else setMsg({ text:(r && r.error) || "發布失敗" });
  };
  const saveGroup = async (g, name, use, locs) => {
    const r = await apiPost({ action:"lineGroupSave", ...tk, id:g.id, name, use, locs }, 0);
    if (r && r.success) loadGroups(); else alert((r && r.error) || "儲存失敗");
  };
  const showReaders = async a => { setReaders({ a, data:null }); const r = await apiGet({ action:"annReaders", ...tk, id:a.id }, 1); setReaders({ a, data: r && r.success ? r.data : [], err: r && r.error }); };
  const gList = (opt && opt.groups) || [];
  return (
    <div>
      <Seg C={C} value={view} onChange={setView} items={isTop ? [["new","發公告"],["list","已發布"],["groups","LINE 群組"]] : [["new","發公告"],["list","我發的"]]}/>
      {isTop && quota && quota.limit !== undefined && (
        <div style={{ fontSize:12, color: quota.limit && quota.used / quota.limit > .8 ? C.red : C.muted, margin:"-4px 4px 10px" }}>
          LINE 本月已用 {quota.used ?? "—"}{quota.limit ? ` / ${quota.limit}` : ""} 則（推到群組＝群組人數則）{quota.limit && quota.used / quota.limit > .8 ? "・快用完了" : ""}
        </div>
      )}
      {view === "new" && (
        <div style={s.card}>
          <label style={s.label}>標題</label>
          <input value={f.title} maxLength={60} onChange={e => setF({ ...f, title:e.target.value })} style={{ ...s.input, marginBottom:10 }}/>
          <label style={s.label}>內容</label>
          <textarea value={f.body} rows={6} onChange={e => setF({ ...f, body:e.target.value })} style={{ ...s.input, resize:"vertical", marginBottom:10 }}/>
          <div style={s.sectionTitle}>發給誰</div>
          {isTop && <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13.5, padding:"5px 0" }}>
            <input type="radio" checked={!f.target.length} onChange={() => setF({ ...f, target:[] })}/>全員</label>}
          {(opt?.locs || []).map(l => (
            <label key={l} style={{ display:"flex", alignItems:"center", gap:8, fontSize:13.5, padding:"5px 0" }}>
              <input type="checkbox" checked={f.target.includes(l)} onChange={() => tog("target", l)}/>{l}
            </label>
          ))}
          {!isTop && <div style={{ fontSize:11.5, color:C.muted, marginBottom:4 }}>分隊長只能發給自己負責的櫃位；那些櫃位的夥伴（負責或近 60 天有排班）才看得到。</div>}
          <div style={{ marginTop:10 }}>
            <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13.5, marginBottom:8 }}>
              <input type="checkbox" checked={f.ack} onChange={e => setF({ ...f, ack:e.target.checked })}/>要夥伴按「我知道了」（重要規定、制度變更）
            </label>
            <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13.5, marginBottom:12 }}>
              <input type="checkbox" checked={f.urgent} onChange={e => setF({ ...f, urgent:e.target.checked })}/>緊急（首頁置頂紅框、LINE 標「緊急公告」）
            </label>
          </div>
          <div style={s.sectionTitle}>同步推播到 LINE 群組</div>
          {opt === null && <div style={{ fontSize:13, color:C.muted }}>載入中…</div>}
          {opt && !gList.length && <div style={{ fontSize:12.5, color:C.muted, lineHeight:1.6 }}>{isTop ? "還沒有群組。把官方帳號「紅玉滿赤心雞蛋糕之有愛小幫手」邀進 LINE 群組後，就會出現在這裡。" : "沒有綁定你負責櫃位的群組（請管理者到「LINE 群組」設定綁定櫃位）。"}</div>}
          {gList.length > 1 && <button onClick={() => setF({ ...f, groups: f.groups.length === gList.length ? [] : gList.map(g => g.id) })} style={{ ...s.btn("ghost"), padding:"6px", fontSize:12.5, marginBottom:6 }}>{f.groups.length === gList.length ? "全部取消" : "全選"}</button>}
          {gList.map(g => (
            <label key={g.id} style={{ display:"flex", alignItems:"center", gap:8, fontSize:13.5, padding:"6px 0" }}>
              <input type="checkbox" checked={f.groups.includes(g.id)} onChange={() => tog("groups", g.id)}/>{g.name}
            </label>
          ))}
          <button disabled={busy} onClick={post} style={{ ...s.btn("primary"), marginTop:12, opacity:busy ? .6 : 1 }}>{busy ? "發布中…" : "📢 發布公告"}</button>
          <Msg C={C} m={msg}/>
        </div>
      )}
      {view === "list" && list && !list.length && <div style={{ ...s.card, textAlign:"center", color:C.muted, fontSize:13 }}>還沒有發布過公告</div>}
      {view === "list" && (list === null ? <div style={{ ...s.card, textAlign:"center", color:C.muted, fontSize:13 }}>載入中…</div> : list.map(a => (
        <div key={a.id} style={{ ...s.card, opacity: a.status === "停用" ? .55 : 1 }}>
          <div style={{ display:"flex", justifyContent:"space-between" }}><b style={{ fontSize:14, fontWeight:600, color: a.urgent ? C.accent : C.text }}>{a.urgent ? "🚨 " : ""}{a.title}</b><span style={{ fontSize:11.5, color:C.muted }}>{a.status}</span></div>
          <div style={{ fontSize:12.5, color:C.muted, marginTop:4, whiteSpace:"pre-wrap", lineHeight:1.6 }}>{a.body.length > 120 ? a.body.slice(0, 120) + "…" : a.body}</div>
          <button onClick={() => showReaders(a)} style={{ border:"none", background:C.warm, borderRadius:10, padding:"6px 10px", fontSize:12.5, marginTop:8, cursor:"pointer", fontFamily:"inherit", color:C.text }}>
            👀 已讀 {a.readCount}／{a.audience}{a.ack ? `・我知道了 ${a.ackCount}／${a.audience}` : ""} ›
          </button>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:6 }}>
            <span style={{ fontSize:11, color:C.light }}>{a.by}・{String(a.time).slice(0, 16)}・{a.target && a.target.length ? a.target.map(short).join("、") : "全員"}{a.groups ? `・推 ${a.groups} 群` : ""}</span>
            <button onClick={async () => { await apiPost({ action:"annStop", ...tk, id:a.id, on: a.status === "停用" }, 0); setList(list.map(x => x.id === a.id ? { ...x, status: a.status === "停用" ? "發布" : "停用" } : x)); }}
              style={{ ...s.btn("ghost"), width:"auto", padding:"5px 10px", fontSize:12 }}>{a.status === "停用" ? "恢復" : "下架"}</button>
          </div>
        </div>
      )))}
      {view === "groups" && isTop && (
        <div style={s.card}>
          <div style={{ fontSize:12.5, color:C.muted, marginBottom:8, lineHeight:1.6 }}>官方帳號被邀進群組時自動加入這裡（只記群組，不讀、不存聊天內容）。「用途」決定哪些通知推到這個群；「綁定櫃位」讓該櫃位的分隊長也能推到這個群。</div>
          {(groups || []).map(g => <GroupRow key={g.id} g={g} C={C} s={s} locs={allLocs} onSave={saveGroup}/>)}
          {groups && !groups.length && <div style={{ fontSize:13, color:C.muted }}>還沒有群組</div>}
        </div>
      )}
      {readers && (
        <Sheet C={C} title={`「${readers.a.title}」已讀名單`} onClose={() => setReaders(null)}>
          {!readers.data && <div style={{ color:C.muted, fontSize:13 }}>載入中…</div>}
          {readers.err && <div style={{ color:C.red, fontSize:13 }}>{readers.err}</div>}
          {(readers.data || []).map(x => (
            <div key={x.id} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.border}`, fontSize:13.5 }}>
              <span>{x.name}</span>
              <span style={{ fontSize:12, color: x.read ? C.green : C.red }}>{x.read ? (readers.a.ack ? (x.ack ? "✅ 我知道了" : "已讀・未按我知道了") : "已讀 " + x.read.slice(5, 16)) : "未讀"}</span>
            </div>
          ))}
        </Sheet>
      )}
    </div>
  );
}
function GroupRow({ g, C, s, locs, onSave }) {
  const [name, setName] = useState(g.name);
  const [use, setUse] = useState(g.use.split("、"));
  const [bind, setBind] = useState(g.locs || []);
  const tog = k => setUse(use.includes(k) ? use.filter(x => x !== k) : use.concat([k]));
  const dirty = name !== g.name || use.join("、") !== g.use || bind.join("、") !== (g.locs || []).join("、");
  return (
    <div style={{ padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
      <input value={name} onChange={e => setName(e.target.value)} style={{ ...s.input, padding:"8px 10px", marginBottom:6 }}/>
      <div style={{ display:"flex", alignItems:"center", gap:14, fontSize:13 }}>
        {["公告", "物料", "報修"].map(k => <label key={k} style={{ display:"flex", gap:5, alignItems:"center" }}><input type="checkbox" checked={use.includes(k)} onChange={() => tog(k)}/>{k === "物料" ? "物料需求" : k === "報修" ? "門市回報" : k}</label>)}
      </div>
      <div style={{ fontSize:12, color:C.muted, margin:"6px 0 2px" }}>綁定櫃位（選填）</div>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
        {locs.map(l => <button key={l} onClick={() => setBind(bind.includes(l) ? bind.filter(x => x !== l) : bind.concat([l]))}
          style={{ border:`1px solid ${bind.includes(l) ? C.accent : C.border}`, background: bind.includes(l) ? C.accent : C.card, color: bind.includes(l) ? "#fff" : C.text, borderRadius:16, padding:"4px 10px", fontSize:12, fontFamily:"inherit", cursor:"pointer" }}>{short(l)}</button>)}
      </div>
      {dirty && <button onClick={() => onSave(g, name, use.join("、"), bind)} style={{ ...s.btn("primary"), marginTop:8, padding:"7px 12px", fontSize:12.5 }}>儲存</button>}
    </div>
  );
}

// ═══════════ 加盟店損益 ═══════════
export function PnlPage({ user, apiGet, apiPost, C, s, todayStr }) {
  const today = todayStr();
  const [locs, setLocs] = useState(null);
  const [cats, setCats] = useState({ inc:[], exp:[] });
  const [loc, setLoc] = useState("");
  const [ym, setYm] = useState(ymOf(today));
  const [d, setD] = useState(null);
  const [add, setAdd] = useState(null);
  const [fixed, setFixed] = useState(null);
  const [busy, setBusy] = useState(false);
  const tk = { empId:user.id, token:user.token || "" };
  useEffect(() => { apiGet({ action:"opsFranchise", empId:user.id }, 1).then(r => { if (r && r.success) { setLocs(r.data); setLoc(r.data[0] || ""); setCats({ inc:r.incomeCats, exp:r.expCats }); } else setLocs([]); }); }, []);
  const load = () => { if (!loc) return; setD(null); apiGet({ action:"opsPnl", ...tk, loc, ym }, 1).then(r => setD(r && r.success ? r : { error:(r && r.error) || "讀取失敗" })); };
  useEffect(load, [loc, ym]);
  if (locs === null) return <div style={{ ...s.card, textAlign:"center", color:C.muted, fontSize:13 }}>載入中…</div>;
  if (!locs.length) return <div style={{ ...s.card, color:C.muted, fontSize:13 }}>沒有可查看的加盟店。（〈櫃位設定〉場所性質＝加盟分隊長，且您是該店分隊長或 Lv.3 以上）</div>;
  const p = d && d.pnl, closed = d && d.closed && d.closed.status === "已結帳";
  const saveExp = async () => {
    setBusy(true);
    const r = await apiPost({ action:"opsExpAdd", ...tk, loc, ...add }, 0);
    setBusy(false);
    if (r && r.success) { setAdd(null); load(); } else alert((r && r.error) || "新增失敗");
  };
  const delExp = async e => { if (!confirm(`刪除「${e.cat} ${money(e.amount)}」？`)) return; const r = await apiPost({ action:"opsExpDel", ...tk, loc, id:e.id }, 0); if (r && r.success) load(); else alert(r && r.error); };
  const close = async () => { if (!confirm(`${+ym.slice(5)} 月結帳？結帳後數字鎖定，要修改需總部解鎖。`)) return; const r = await apiPost({ action:"opsPnlClose", ...tk, loc, ym }, 0); if (r && r.success) load(); else alert(r && r.error); };
  const reopen = async () => { if (!confirm("解鎖這個月？")) return; const r = await apiPost({ action:"opsPnlReopen", ...tk, loc, ym }, 0); if (r && r.success) load(); else alert(r && r.error); };
  const saveFixed = async () => { setBusy(true); const r = await apiPost({ action:"opsFixedSave", ...tk, loc, list:fixed }, 0); setBusy(false); if (r && r.success) { setFixed(null); load(); } else alert(r && r.error); };
  const diff = (a, b) => b === undefined || b === null ? "" : (a - b >= 0 ? "▲" : "▼") + money(Math.abs(a - b)).replace("−", "");
  return (
    <div>
      <div style={s.card}>
        {locs.length > 1 && <select value={loc} onChange={e => setLoc(e.target.value)} style={{ ...s.input, marginBottom:10 }}>{locs.map(l => <option key={l}>{l}</option>)}</select>}
        <MonthNav C={C} ym={ym} setYm={setYm}/>
        {!d && <div style={{ textAlign:"center", color:C.muted, fontSize:13 }}>計算中…</div>}
        {d && d.error && <div style={{ color:C.red, fontSize:13 }}>{d.error}</div>}
        {p && <>
          <div style={{ textAlign:"center", margin:"4px 0 10px" }}>
            <div style={{ fontSize:12, color:C.muted }}>{short(loc)}・{closed ? "已結帳" : ym === ymOf(today) ? "本月到今天" : "未結帳"}・營業淨利</div>
            <div style={{ fontSize:30, fontWeight:700, color: p.net >= 0 ? C.green : C.red }}>{money(p.net)}</div>
            <div style={{ fontSize:12, color:C.muted }}>淨利率 {p.margin}%{d.prev ? `・比上月 ${diff(p.net, d.prev.net)}` : ""}</div>
            {p.labor.ownerHours > 0 && <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>扣掉加盟主自己的人力（{p.labor.ownerHours}h × ${p.ownerWage}）後：{money(p.netOwner)}</div>}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:10 }}>
            {[["營業天數", p.openDays + " 天"], ["日均營業額", money(p.avgDaily)], ["損益兩平", p.breakEvenDaily ? money(p.breakEvenDaily) + "/天" : "—"]].map(([l, v]) => (
              <div key={l} style={{ background:C.warm, borderRadius:12, padding:"9px 10px" }}><div style={{ fontSize:11, color:C.muted }}>{l}</div><div style={{ fontSize:15, fontWeight:600, marginTop:2 }}>{v}</div></div>
            ))}
          </div>
          {p.missingPrice.length > 0 && <div style={{ fontSize:12, color:C.gold, background:C.goldBg, borderRadius:10, padding:"7px 10px", marginBottom:8 }}>⚠ 待填單價：{p.missingPrice.join("、")}（總部到「供貨價格」填好後才會算進成本）</div>}
          <div style={s.sectionTitle}>收入</div>
          <Row C={C} l="營業額" v={money(p.revenue)} sub="收店盤點自動帶入"/>
          {Object.keys(p.income).map(k => <Row key={k} C={C} l={k} v={money(p.income[k])}/>)}
          <Row C={C} l="收入合計" v={money(p.sales)} bold/>
          <div style={{ ...s.sectionTitle, marginTop:12 }}>成本與費用</div>
          {p.vat > 0 && <Row C={C} l="營業稅 5%" v={money(p.vat)} sub="收入 ÷ 1.05 × 5%"/>}
          <Row C={C} l="麵糊" v={p.batterPrice === null ? "待填單價" : money(p.batterCost)} sub={`收店用量 ${p.batterUse} 包${p.batterPrice !== null ? ` × $${p.batterPrice}` : ""}`}/>
          {Object.keys(p.materials).map(k => <Row key={k} C={C} l={k} v={money(p.materials[k])} sub="物料需求單出貨"/>)}
          <Row C={C} l="夥伴薪資" v={money(p.labor.staff)} sub={p.labor.list.map(x => `${x.name} ${x.hours}h`).join("、") || "系統依總部制度代算"}/>
          {Object.keys(p.costs).map(k => <Row key={k} C={C} l={k} v={money(p.costs[k])} sub={p.fixedApplied.includes(k) ? "固定費用自動帶入" : ""}/>)}
          <Row C={C} l={`品牌權利金 ${Math.round(p.royaltyRate * 1000) / 10}%`} v={money(p.royalty)} sub="營業額 × 比率"/>
          <Row C={C} l="成本合計" v={money(p.totalCost)} bold/>
        </>}
      </div>
      {p && <>
        <div style={s.card}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <div style={{ ...s.sectionTitle, marginBottom:0 }}>本月填寫的收入／費用</div>
            {!closed && <button onClick={() => setAdd({ cat:cats.exp[0], amount:"", date: ym === ymOf(today) ? today : ym + "-01", note:"" })} style={{ ...s.btn("primary"), width:"auto", padding:"6px 12px", fontSize:12.5 }}>＋ 新增</button>}
          </div>
          {!d.expenses.length && <div style={{ fontSize:13, color:C.muted }}>還沒有填寫。水電、瓦斯、政府費用、外送收入等都在這裡填。</div>}
          {d.expenses.map(e => (
            <div key={e.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 0", borderBottom:`1px solid ${C.border}`, fontSize:13 }}>
              <span style={{ flex:1 }}>{e.cat}<div style={{ fontSize:11, color:C.light }}>{md(e.date)}{e.note ? `・${e.note}` : ""}・{e.by}</div></span>
              <b style={{ fontWeight:600, color: cats.inc.includes(e.cat) ? C.green : C.text }}>{cats.inc.includes(e.cat) ? "+" : ""}{money(e.amount)}</b>
              {!closed && <button onClick={() => delExp(e)} style={{ border:"none", background:"none", color:C.red, fontSize:16, cursor:"pointer" }}>×</button>}
            </div>
          ))}
          {!closed && <button onClick={() => setFixed(d.fixed.map(f => ({ cat:f.cat, amount:f.amount })))} style={{ ...s.btn("ghost"), marginTop:10, padding:"8px", fontSize:12.5 }}>設定每月固定費用（租金等，自動帶入）</button>}
        </div>
        <div style={s.card}>
          {closed ? <>
            <div style={{ fontSize:13, color:C.green }}>✓ {+ym.slice(5)} 月已結帳（{d.closed.by}・{String(d.closed.at).slice(0, 16)}）</div>
            {d.canReopen && <button onClick={reopen} style={{ ...s.btn("ghost"), marginTop:8, padding:"8px", fontSize:12.5 }}>解鎖（Lv.3）</button>}
          </> : ym < ymOf(today)
            ? <button onClick={close} style={s.btn("primary")}>{+ym.slice(5)} 月結帳（鎖定數字）</button>
            : <div style={{ fontSize:12.5, color:C.muted }}>月份過完後可以按「結帳」鎖定數字，總部會看到同一份報表。</div>}
        </div>
      </>}
      {add && (
        <Sheet C={C} title="新增收入／費用" onClose={() => !busy && setAdd(null)}>
          <label style={s.label}>分類</label>
          <select value={add.cat} onChange={e => setAdd({ ...add, cat:e.target.value })} style={{ ...s.input, marginBottom:10 }}>
            <optgroup label="費用">{cats.exp.map(c => <option key={c}>{c}</option>)}</optgroup>
            <optgroup label="收入">{cats.inc.map(c => <option key={c}>{c}</option>)}</optgroup>
          </select>
          <div style={{ display:"flex", gap:8, marginBottom:10 }}>
            <div style={{ flex:1 }}><label style={s.label}>金額</label><input type="number" inputMode="numeric" value={add.amount} onChange={e => setAdd({ ...add, amount:e.target.value })} style={s.input}/></div>
            <div style={{ flex:1 }}><label style={s.label}>日期</label><input type="date" value={add.date} onChange={e => setAdd({ ...add, date:e.target.value })} style={s.input}/></div>
          </div>
          <label style={s.label}>備註</label>
          <input value={add.note} onChange={e => setAdd({ ...add, note:e.target.value })} placeholder="例：10 月電費" style={{ ...s.input, marginBottom:12 }}/>
          <button disabled={busy} onClick={saveExp} style={{ ...s.btn("primary"), opacity:busy ? .6 : 1 }}>{busy ? "儲存中…" : "儲存"}</button>
        </Sheet>
      )}
      {fixed && (
        <Sheet C={C} title="每月固定費用" onClose={() => !busy && setFixed(null)}>
          <div style={{ fontSize:12, color:C.muted, marginBottom:10, lineHeight:1.6 }}>每個月自動帶入損益表；當月如果另外填了同分類的金額，就以填的為準。</div>
          {fixed.map((f, i) => (
            <div key={i} style={{ display:"flex", gap:6, marginBottom:8 }}>
              <select value={f.cat} onChange={e => setFixed(fixed.map((x, j) => j === i ? { ...x, cat:e.target.value } : x))} style={{ ...s.input, flex:1.4, padding:"8px" }}>{cats.exp.map(c => <option key={c}>{c}</option>)}</select>
              <input type="number" value={f.amount} onChange={e => setFixed(fixed.map((x, j) => j === i ? { ...x, amount:e.target.value } : x))} style={{ ...s.input, flex:1, padding:"8px" }}/>
              <button onClick={() => setFixed(fixed.filter((_, j) => j !== i))} style={{ border:"none", background:"none", color:C.red, fontSize:18 }}>×</button>
            </div>
          ))}
          <button onClick={() => setFixed(fixed.concat([{ cat:cats.exp[0], amount:"" }]))} style={{ ...s.btn("ghost"), marginBottom:10 }}>＋ 新增一項</button>
          <button disabled={busy} onClick={saveFixed} style={s.btn("primary")}>{busy ? "儲存中…" : "儲存"}</button>
        </Sheet>
      )}
    </div>
  );
}

// ═══════════ 供貨價格／應收加盟店（Lv.3）═══════════
export function PricePage({ user, apiGet, apiPost, C, s, todayStr }) {
  const [list, setList] = useState(null);
  const [msg, setMsg] = useState(null);
  const [rcv, setRcv] = useState(null);
  const [ym, setYm] = useState(addMonth(todayStr().slice(0, 7), -1));
  const tk = { empId:user.id, token:user.token || "" };
  const [cats, setCats] = useState([]);
  useEffect(() => { apiGet({ action:"opsPriceList", empId:user.id }, 1).then(r => { setList(r && r.success ? r.data : []); setCats((r && r.cats) || []); }); }, []);
  useEffect(() => { setRcv(null); apiGet({ action:"opsReceivable", ...tk, ym }, 1).then(r => setRcv(r && r.success ? r.data : [])); }, [ym]);
  const up = (i, k, v) => setList(list.map((x, j) => j === i ? { ...x, [k]:v } : x));
  const save = async () => { const r = await apiPost({ action:"opsPriceSave", ...tk, list }, 0); setMsg(r && r.success ? { ok:true, text:"已儲存" } : { text:(r && r.error) || "儲存失敗" }); };
  return (
    <div>
      <div style={s.card}>
        <div style={s.sectionTitle}>供貨價格（給加盟店、合作櫃位的單價）</div>
        <div style={{ fontSize:12, color:C.muted, marginBottom:8 }}>品項會出現在「叫貨」頁，依分類排列；備註寫「停用」就不會出現在叫貨頁</div>
        {(list || []).map((x, i) => (
          <div key={i}>
          {(i === 0 || (list[i - 1].cat || "其他") !== (x.cat || "其他")) && <div style={{ fontSize:13, fontWeight:600, margin:"12px 0 6px", color:C.accent }}>{x.cat || "其他"}</div>}
          <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:8 }}>
            <input value={x.item} onChange={e => up(i, "item", e.target.value)} style={{ ...s.input, flex:1.4, padding:"8px" }}/>
            <input value={x.unit} onChange={e => up(i, "unit", e.target.value)} placeholder="單位" style={{ ...s.input, width:54, padding:"8px" }}/>
            <input type="number" value={x.price ?? ""} onChange={e => up(i, "price", e.target.value)} placeholder="單價" style={{ ...s.input, width:72, padding:"8px" }}/>
          </div>
          {x.isNew && <div style={{ display:"flex", gap:6, marginBottom:8 }}>
            <select value={x.cat || "其他"} onChange={e => up(i, "cat", e.target.value)} style={{ ...s.input, padding:"6px 8px", flex:1 }}>{(cats || []).map(c => <option key={c} value={c}>{c}</option>)}</select>
            <input value={x.note || ""} onChange={e => up(i, "note", e.target.value)} placeholder="備註" style={{ ...s.input, padding:"6px 8px", flex:1 }}/>
          </div>}
          </div>
        ))}
        <button onClick={() => setList((list || []).concat([{ item:"", unit:"", price:"", cat:"其他", isNew:true }]))} style={{ ...s.btn("ghost"), marginBottom:8 }}>＋ 新增品項</button>
        <button onClick={save} style={s.btn("primary")}>儲存</button>
        <Msg C={C} m={msg}/>
      </div>
      <div style={s.card}>
        <div style={s.sectionTitle}>應收（加盟店、合作櫃位）</div>
        <MonthNav C={C} ym={ym} setYm={setYm}/>
        {rcv === null && <div style={{ color:C.muted, fontSize:13 }}>計算中…</div>}
        {(rcv || []).map(x => (
          <div key={x.loc} style={{ marginBottom:10 }}>
            <div style={{ fontWeight:600, fontSize:14 }}>{short(x.loc)} <span style={{ fontSize:11, color:C.muted, fontWeight:400 }}>{x.kind === "合作" ? "合作櫃位" : "加盟店"}</span></div>
            {x.kind !== "合作" && <><Row C={C} l="營業額" v={money(x.revenue)}/>
            <Row C={C} l="權利金" v={money(x.royalty)}/>
            <Row C={C} l="麵糊（收店用量）" v={money(x.batter)}/></>}
            <Row C={C} l={x.kind === "合作" ? "物料（含麵糊）" : "物料"} v={money(x.materials)}/>
            {x.fee > 0 && <Row C={C} l="總部維修／服務" v={money(x.fee)}/>}
            <Row C={C} l="應收合計" v={money(x.total)} bold/>
            {x.missingPrice.length > 0 && <div style={{ fontSize:11.5, color:C.gold }}>待填單價：{x.missingPrice.join("、")}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════ 合作夥伴首頁 ═══════════
export function PartnerHome({ user, me, announcements, C, s, onOpenMaterials, onOpenReport, apiGet, apiPost, onAnnChanged }) {
  const [open, setOpen] = useState(null);
  useEffect(() => { apiGet({ action:"opsMatList", empId:user.id, open:1, ym:"x" }, 1).then(r => setOpen(r && r.success ? r.data.filter(x => !/已送達|已取消/.test(x.status)) : [])); }, []);
  return (
    <div>
      <div style={{ ...s.card, background:C.accentBg }}>
        <div style={{ fontSize:17, fontWeight:600 }}>{user.name}，您好 👋</div>
        <div style={{ fontSize:12.5, color:C.muted, marginTop:4 }}>{(me?.myLocs || []).map(short).join("、") || "合作櫃位"}・紅玉滿合作夥伴</div>
      </div>
      <AnnInbox user={user} list={announcements} apiPost={apiPost} C={C} s={s} onChanged={onAnnChanged}/>
      <button onClick={onOpenMaterials} style={{ ...s.btn("primary"), marginBottom:8 }}>📦 叫貨（麵糊、粉料、包材、器具…）</button>
      {onOpenReport && <button onClick={onOpenReport} style={{ ...s.btn("secondary"), marginBottom:12 }}>🔧 請總部處理（機器報修、狀況回報）</button>}
      <div style={s.card}>
        <div style={s.sectionTitle}>處理中的需求單</div>
        {open === null && <div style={{ fontSize:13, color:C.muted }}>載入中…</div>}
        {open && !open.length && <div style={{ fontSize:13, color:C.muted }}>目前沒有</div>}
        {(open || []).map(x => <Row key={x.id} C={C} l={x.items.map(it => `${it.item} ${it.qty}${it.unit || ""}`).join("、")} sub={x.created.slice(5, 16)} v={x.status} color={ST_COLOR(C)[x.status]}/>)}
      </div>
      <div style={s.card}>
        <div style={s.sectionTitle}>公告</div>
        {!announcements.length && <div style={{ fontSize:13, color:C.muted }}>目前無公告</div>}
        {announcements.slice(0, 10).map(a => (
          <div key={a.id} style={{ padding:"9px 0", borderBottom:`1px solid ${C.border}` }}>
            <div style={{ fontSize:13.5, fontWeight:600, color: a.urgent ? C.accent : C.text }}>{a.title}</div>
            <div style={{ fontSize:12.5, color:C.muted, marginTop:3, whiteSpace:"pre-wrap", lineHeight:1.6 }}>{a.body}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
