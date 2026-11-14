// v1.35 設備檢查清單：活動出攤／百貨快閃／設櫃／出國（各國）
// 一張清單三關：① 出發前打包 → ② 到場確認 → ③ 收攤點收（少了、壞了 → 待補購）
// Lv.3 以上：建立、修改清單與模板（可匯入／匯出 Excel）；隊員：勾自己被排進的清單
import { useState, useEffect, useRef } from "react";
import { topToast } from "./TopToast.jsx";

const TYPE_ICON = { "活動": "🎪", "快閃": "🛍️", "設櫃": "🏬", "出國": "✈️" };
const TYPE_LABEL = { "活動": "活動出攤", "快閃": "百貨快閃", "設櫃": "設櫃", "出國": "出國" };
const CAL_CAT = { "活動": "活動", "快閃": "快閃", "設櫃": "進撤櫃", "出國": "活動" };
const FLAG = { "新加坡": "🇸🇬", "馬來西亞": "🇲🇾", "越南": "🇻🇳", "印尼": "🇮🇩", "日本": "🇯🇵" };
const fmtN = n => Number(n || 0).toLocaleString();
const md = d => d ? d.slice(5).replace("-", "/") : "";
const range = (a, b) => !a ? "" : (!b || a === b) ? md(a) : `${md(a)}～${md(b)}`;
const addDays = (d, n) => { const x = new Date(d + "T00:00:00+08:00"); x.setDate(x.getDate() + n); return new Date(x.getTime() + 8 * 3600e3).toISOString().slice(0, 10); };
const daysBetween = (a, b) => { const out = []; if (!a) return out; for (let d = a, i = 0; d <= (b || a) && i < 60; d = addDays(d, 1), i++) out.push(d); return out; };
const qtyText = it => `${Number(it.q) >= 1000 ? fmtN(it.q) : it.q}${it.u || ""}`;

export function EquipPage({ user, apiGet, apiPost, C, s, todayStr, openId, onOpened, quote, onQuoteUsed }) {
  const [view, setView] = useState(openId ? "detail" : quote ? "create" : "list");
  const [cur, setCur] = useState(openId || null);
  const [list, setList] = useState(null), [meta, setMeta] = useState(null);
  const setMsg = t => topToast(t);
  const [showDone, setShowDone] = useState(false);
  const admin = user.role >= 3;

  const loadList = (all) => apiGet({ action: "eqList", all: all ? 1 : "" }, 0).then(r => setList(r && r.success ? r : { error: (r && r.error) || "讀取失敗" }));
  const loadMeta = (full) => apiGet({ action: "eqMeta", full: full ? 1 : "" }, 0).then(r => { if (r && r.success) setMeta(r); return r; });
  useEffect(() => { loadList(false); loadMeta(false); }, []);
  useEffect(() => { if (openId) { setCur(openId); setView("detail"); onOpened && onOpened(); } }, [openId]);
  useEffect(() => { if (quote) setView("create"); }, [quote]);

  const chip = on => ({ border: `1px solid ${on ? C.accent : C.border}`, background: on ? C.accentBg : C.card, color: on ? C.accent : C.text, borderRadius: 999, padding: "6px 12px", fontSize: 13, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" });
  const back = () => { setView("list"); setCur(null); loadList(showDone); };
  const props = { user, apiGet, apiPost, C, s, chip, admin, meta, setMsg, todayStr };

  if (list && list.error && /未知/.test(list.error)) return <div style={{ ...s.card, color: C.muted, fontSize: 13.5, lineHeight: 1.7 }}>設備檢查清單還沒開通（後端更新到 v1.35、執行 eq_setup 之後就會出現）。</div>;

  return (
    <div>
      {view === "list" && <>
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          {admin && <button onClick={() => setView("create")} style={{ ...chip(true), fontWeight: 600 }}>＋ 建立清單</button>}
          {user.role >= 2 && <button onClick={() => setView("fix")} style={chip(false)}>🛒 待補購</button>}
          {admin && <button onClick={() => setView("tpls")} style={chip(false)}>🗂️ 模板</button>}
          <button onClick={() => { const v = !showDone; setShowDone(v); loadList(v); }} style={chip(showDone)}>{showDone ? "✓ 含已結束" : "含已結束"}</button>
        </div>
        {!list ? <div className="rh-skel" style={{ height: 160, borderRadius: 18 }} />
          : list.error ? <div style={{ ...s.card, color: C.red, fontSize: 13 }}>{list.error}</div>
          : !list.data.length ? <div style={{ ...s.card, color: C.muted, textAlign: "center", fontSize: 13, lineHeight: 1.8 }}>目前沒有設備清單。{admin ? <><br />按「＋ 建立清單」，選活動、設櫃或出國的模板就能開始。</> : <><br />管理者把你排進清單後，會出現在這裡和首頁。</>}</div>
          : list.data.map(L => <ListCard key={L.id} L={L} C={C} s={s} todayStr={todayStr} onClick={() => { setCur(L.id); setView("detail"); }} />)}
      </>}
      {view === "detail" && cur && <Detail id={cur} onBack={back} {...props} />}
      {view === "create" && <Create {...props} quote={quote} onCancel={() => { onQuoteUsed && onQuoteUsed(); back(); }} onDone={id => { onQuoteUsed && onQuoteUsed(); setCur(id); setView("detail"); loadList(showDone); }} />}
      {view === "tpls" && <Templates {...props} loadMeta={loadMeta} onBack={back} />}
      {view === "fix" && <FixList {...props} onBack={back} onOpen={id => { setCur(id); setView("detail"); }} />}
    </div>
  );
}

function Bar({ v, n, color, C }) {
  const pct = n ? Math.round(v / n * 100) : 0;
  return <div style={{ height: 6, background: C.warm, borderRadius: 4, overflow: "hidden" }}><div style={{ width: pct + "%", height: "100%", background: pct === 100 ? C.green : color, transition: "width .3s" }} /></div>;
}

function ListCard({ L, C, s, todayStr, onClick }) {
  const t = todayStr(), soon = L.status === "準備中" && L.from >= t && L.from <= addDays(t, 1) && L.done[0] < L.n;
  const tag = L.status !== "準備中" ? L.status : L.to < t ? "待點收" : L.from <= t ? "進行中" : L.from === addDays(t, 1) ? "明天" : "準備中";
  return (
    <button onClick={onClick} style={{ ...s.card, width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: C.text, border: soon ? `1px solid ${C.red}` : s.card.border, opacity: L.status === "取消" ? .55 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{TYPE_ICON[L.type] || "🧰"} {L.name}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{range(L.from, L.to)}{L.loc ? "・" + L.loc : ""}{L.country ? "・" + (FLAG[L.country] || "") + L.country : ""}</div>
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap", background: soon ? C.redBg : L.status === "已完成" ? C.greenBg : C.warm, color: soon ? C.red : L.status === "已完成" ? C.green : C.muted }}>{tag}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 10 }}>
        {L.stages.map((st, i) => <div key={i}><div style={{ fontSize: 11, color: C.muted, marginBottom: 3 }}>{st} {L.done[i]}/{L.n}</div><Bar v={L.done[i]} n={L.n} color={[C.accent, C.blue, C.gold][i]} C={C} /></div>)}
      </div>
      {L.fix > 0 && <div style={{ fontSize: 12, color: C.red, marginTop: 8 }}>🛒 待補購 {L.fix} 項{L.cost ? `（約 ${fmtN(L.cost)} 元）` : ""}</div>}
    </button>
  );
}

// ── 清單內容：三關勾選 ──
function Detail({ id, onBack, user, apiGet, apiPost, C, s, chip, admin, meta, setMsg, todayStr }) {
  const [L, setL] = useState(null), [err, setErr] = useState("");
  const [stage, setStage] = useState(0), [group, setGroup] = useState("cat"), [onlyTodo, setOnlyTodo] = useState(false);
  const [edit, setEdit] = useState(false), [showInfo, setShowInfo] = useState(false), [missFor, setMissFor] = useState(null);
  const seq = useRef(0);
  const load = () => apiGet({ action: "eqGet", id }, 0).then(r => {
    if (r && r.success) {
      setL(r.data); const t = todayStr();
      setStage(r.data.to < t ? 2 : r.data.from <= t ? (r.data.done[1] < r.data.n ? 1 : 2) : 0);
      if (r.data.type === "出國" && (r.data.boxes || []).length) setGroup("box");
    } else setErr((r && r.error) || "讀取失敗");
  });
  useEffect(() => { load(); }, [id]);
  if (err) return <div><button onClick={onBack} style={{ ...chip(false), marginBottom: 10 }}>‹ 返回</button><div style={{ ...s.card, color: C.red }}>{err}</div></div>;
  if (!L) return <div className="rh-skel" style={{ height: 300, borderRadius: 18 }} />;
  if (edit) return <EditList L={L} {...{ apiPost, C, s, chip, meta, setMsg }} onDone={d => { if (d) setL(d); setEdit(false); }} />;

  const locked = L.status !== "準備中";
  const me = user.nick || user.name;
  // 樂觀更新：先改畫面，再送後端；只採用最後一次回應，避免連點時畫面跳回去
  const send = async (ids, patch, payload) => {
    if (locked) { setMsg(`這張清單已經${L.status}，不能再勾`); return; }
    const now = new Date().toTimeString().slice(0, 5);
    setL(prev => ({ ...prev, items: prev.items.map(it => ids.includes(it.id) ? patch(it, now) : it) }));
    const my = ++seq.current;
    const r = await apiPost({ action: "eqCheck", id, stage, items: JSON.stringify(ids), ...payload }, 1);
    if (my !== seq.current) return;
    if (r && r.success) setL(r.data); else { setMsg((r && r.error) || "沒有存到，請再試一次"); load(); }
  };
  const mark = (it, on) => send([it.id], (x, now) => { const st = [...(x.st || [null, null, null])]; st[stage] = on ? { by: me, at: now } : null; const y = { ...x, st }; if (stage === 2) { if (on) y.back = y.back || "ok"; else { delete y.back; delete y.miss; } } return y; }, { on });
  const markBack = (it, back, miss) => send([it.id], (x, now) => { const st = [...(x.st || [null, null, null])]; st[2] = { by: me, at: now }; return { ...x, st, back, miss: back === "ok" ? 0 : miss || 1 }; }, { back, miss: miss || 1 });
  const markAll = (items, on) => send(items.map(x => x.id), (x, now) => { const st = [...(x.st || [null, null, null])]; st[stage] = on ? { by: me, at: now } : null; const y = { ...x, st }; if (stage === 2 && on) y.back = y.back || "ok"; return y; }, { on });

  const items = L.items || [];
  const done = items.filter(it => it.st && it.st[stage]).length;
  const key = it => group === "box" ? (it.b || "隨身／行李") : (it.c || "其他");
  const groups = []; const gi = {};
  items.forEach(it => { const k = key(it); if (!(k in gi)) { gi[k] = groups.length; groups.push({ k, items: [] }); } groups[gi[k]].items.push(it); });
  const fixItems = items.filter(it => it.back && it.back !== "ok");
  const fixCost = fixItems.filter(it => !it.fixed).reduce((a, it) => a + (it.p || 0) * (it.miss || 1), 0);

  const setStatus = async st => {
    if (st === "取消" && !confirm(`取消「${L.name}」這張清單？`)) return;
    const r = await apiPost({ action: "eqSave", id, data: JSON.stringify({ status: st }) }, 0);
    if (r && r.success) { setL(r.data); setMsg(st === "已完成" ? "✅ 清單已結案" : st === "取消" ? "已取消這張清單" : "已重新打開"); } else setMsg((r && r.error) || "更新失敗");
  };
  const toCal = async () => {
    if (!confirm(`把「${L.name}」${range(L.from, L.to)} 加進公司行事曆？`)) return;
    // v1.39：清單和行程綁在一起（之後改日期、取消清單，行事曆會跟著改；重按不會重複建立）
    const r = await apiPost({ action: "eqCal", id: L.id, icon: TYPE_ICON[L.type] || "", cat: CAL_CAT[L.type] || "活動" }, 0);
    setMsg(r && r.success ? (r.updated ? "✅ 行事曆已更新成 " + range(L.from, L.to) : "✅ 已加進公司行事曆") : (r && r.error) || "加入失敗");
  };
  const fix = async (it, on) => { const r = await apiPost({ action: "eqFix", id, items: JSON.stringify([it.id]), on }, 0); if (r && r.success) setL(r.data); else setMsg((r && r.error) || "更新失敗"); };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <button onClick={onBack} style={chip(false)}>‹ 全部清單</button>
        {admin && !locked && <button onClick={() => setEdit(true)} style={chip(false)}>✏️ 修改清單</button>}
      </div>

      <div style={{ ...s.card }}>
        <div style={{ fontSize: 16.5, fontWeight: 700 }}>{TYPE_ICON[L.type]} {L.name}</div>
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3, lineHeight: 1.7 }}>
          {range(L.from, L.to)}{L.loc ? "・" + L.loc : ""}{L.country ? `・${FLAG[L.country] || ""}${L.country}` : ""}{L.volt ? `・電壓 ${L.volt}` : ""}{L.people ? `・${L.people} 人` : ""}
          {L.crewNames && L.crewNames.length > 0 && <><br />出勤：{L.crewNames.join("、")}</>}
          {L.quote && <><br />來自報價單</>}
        </div>
        {locked && <div style={{ fontSize: 12.5, color: L.status === "已完成" ? C.green : C.muted, marginTop: 6, fontWeight: 600 }}>這張清單{L.status}{admin ? "，" : ""}{admin && <button onClick={() => setStatus("準備中")} style={{ border: "none", background: "none", color: C.accent, cursor: "pointer", padding: 0, fontFamily: "inherit", fontSize: 12.5 }}>重新打開</button>}</div>}
        {Object.keys(L.info || {}).some(k => L.info[k]) && <>
          <button onClick={() => setShowInfo(!showInfo)} style={{ ...chip(showInfo), marginTop: 8, padding: "4px 10px", fontSize: 12 }}>{showInfo ? "收起" : "📋 活動資訊"}</button>
          {showInfo && <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.8 }}>{Object.keys(L.info).filter(k => L.info[k]).map(k => <div key={k}><span style={{ color: C.muted }}>{k}：</span>{L.info[k]}</div>)}</div>}
        </>}
      </div>

      {L.plan && <BuyPlan plan={L.plan} C={C} s={s} />}

      {/* 三關 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 10, position: "sticky", top: 0, zIndex: 5, background: C.bg, padding: "6px 0" }}>
        {L.stages.map((st, i) => { const d = items.filter(it => it.st && it.st[i]).length; return (
          <button key={i} onClick={() => setStage(i)} style={{ border: `1.5px solid ${stage === i ? C.accent : C.border}`, background: stage === i ? C.accentBg : C.card, borderRadius: 12, padding: "8px 4px", cursor: "pointer", fontFamily: "inherit", color: C.text }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: stage === i ? C.accent : C.text }}>{"①②③"[i]} {st}</div>
            <div style={{ fontSize: 11.5, color: d === items.length ? C.green : C.muted, marginTop: 2 }}>{d === items.length ? "✓ 全部完成" : `${d}／${items.length}`}</div>
          </button>); })}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {(L.boxes || []).length > 0 && <><button onClick={() => setGroup("cat")} style={{ ...chip(group === "cat"), padding: "4px 10px", fontSize: 12 }}>依分類</button><button onClick={() => setGroup("box")} style={{ ...chip(group === "box"), padding: "4px 10px", fontSize: 12 }}>🧳 依裝箱</button></>}
        <button onClick={() => setOnlyTodo(!onlyTodo)} style={{ ...chip(onlyTodo), padding: "4px 10px", fontSize: 12 }}>{onlyTodo ? "✓ 只看還沒勾的" : "只看還沒勾的"}</button>
      </div>
      {stage === 2 && <div style={{ fontSize: 12, color: C.muted, margin: "-2px 2px 10px", lineHeight: 1.6 }}>點「✓」代表齊全；少了或壞了按「少」「壞」，會列進待補購。</div>}

      {done === items.length && items.length > 0 && <div style={{ ...s.card, background: C.greenBg, color: C.green, fontWeight: 600, fontSize: 13.5, textAlign: "center" }}>🎉 {L.stages[stage]}全部完成！</div>}

      {groups.map(g => {
        const rows = onlyTodo ? g.items.filter(it => !(it.st && it.st[stage])) : g.items;
        if (!rows.length) return null;
        const gd = g.items.filter(it => it.st && it.st[stage]).length;
        return (
          <div key={g.k} style={{ ...s.card, padding: "10px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.muted }}>{group === "box" ? "🧳 " : ""}{g.k} <span style={{ fontWeight: 400 }}>{gd}/{g.items.length}</span></div>
              {!locked && stage < 2 && gd < g.items.length && <button onClick={() => markAll(g.items.filter(it => !(it.st && it.st[stage])), true)} style={{ ...chip(false), padding: "3px 9px", fontSize: 11.5 }}>這一{group === "box" ? "箱" : "組"}全部勾</button>}
            </div>
            {rows.map(it => <ItemRow key={it.id} it={it} stage={stage} C={C} locked={locked} onToggle={on => mark(it, on)} onBack={(b, m) => markBack(it, b, m)} missOpen={missFor === it.id} setMissOpen={v => setMissFor(v ? it.id : null)} />)}
          </div>);
      })}

      {fixItems.length > 0 && (
        <div style={{ ...s.card, border: `1px solid ${C.red}` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.red, marginBottom: 6 }}>🛒 待補購{fixCost ? `（約 ${fmtN(fixCost)} 元）` : ""}</div>
          {fixItems.map(it => (
            <div key={it.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "6px 0", borderTop: `1px solid ${C.border}`, opacity: it.fixed ? .5 : 1 }}>
              <div style={{ minWidth: 0, fontSize: 13 }}>
                <b>{it.n}</b> <span style={{ color: C.red }}>{it.back}{it.back === "少" ? ` ${it.miss || 1}${it.u || ""}` : ""}</span>
                <div style={{ fontSize: 11.5, color: C.muted }}>{it.p ? `單價 ${fmtN(it.p)}・` : "未設單價・"}{it.st && it.st[2] ? it.st[2].by : ""}{it.bn ? "・" + it.bn : ""}{it.fixed ? `・✓ ${it.fixed.by} 已補購` : ""}</div>
              </div>
              {admin && <button onClick={() => fix(it, !it.fixed)} style={{ ...chip(!!it.fixed), padding: "4px 10px", fontSize: 12 }}>{it.fixed ? "取消" : "已補購"}</button>}
            </div>))}
        </div>)}

      {admin && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "4px 0 20px" }}>
          {L.status === "準備中" && <button onClick={() => setStatus("已完成")} style={chip(false)}>✅ 結案</button>}
          <button onClick={toCal} style={chip(false)}>📅 加進公司行事曆</button>
          {L.status === "準備中" && <button onClick={() => setStatus("取消")} style={{ ...chip(false), color: C.muted }}>取消這張清單</button>}
        </div>)}
    </div>
  );
}

function ItemRow({ it, stage, C, locked, onToggle, onBack, missOpen, setMissOpen }) {
  const st = it.st && it.st[stage];
  const sub = [it.d !== it.n ? it.d : "", it.m].filter(Boolean).join("・");
  const btn = (on, color) => ({ minWidth: 38, height: 34, borderRadius: 10, border: `1.5px solid ${on ? color : C.border}`, background: on ? color : C.card, color: on ? "#fff" : C.muted, fontWeight: 700, fontSize: 13, cursor: locked ? "default" : "pointer", fontFamily: "inherit", padding: "0 8px" });
  if (stage === 2) return (
    <div style={{ padding: "8px 0", borderTop: `1px solid ${C.border}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{it.n} <span style={{ color: C.muted, fontWeight: 400, fontSize: 12.5 }}>{qtyText(it)}</span></div>
          {(sub || st) && <div style={{ fontSize: 11.5, color: C.light, marginTop: 1 }}>{sub}{st ? `${sub ? "・" : ""}${st.by} ${String(st.at).slice(-8, -3) || st.at}` : ""}</div>}
        </div>
        <button disabled={locked} onClick={() => st && it.back === "ok" ? onToggle(false) : onBack("ok")} style={btn(st && it.back === "ok", C.green)}>✓</button>
        <button disabled={locked} onClick={() => it.back === "少" ? onToggle(false) : (Number(it.q) > 1 ? setMissOpen(!missOpen) : onBack("少", 1))} style={btn(it.back === "少", C.gold)}>少{it.back === "少" && Number(it.q) > 1 ? it.miss : ""}</button>
        <button disabled={locked} onClick={() => it.back === "壞" ? onToggle(false) : onBack("壞", 1)} style={btn(it.back === "壞", C.red)}>壞</button>
      </div>
      {missOpen && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: C.muted }}>少了幾{it.u || "個"}？</span>
        {Array.from({ length: Math.min(10, Number(it.q) || 1) }, (_, i) => i + 1).map(n => <button key={n} onClick={() => { setMissOpen(false); onBack("少", n); }} style={{ ...btn(false, C.gold), minWidth: 32, height: 30 }}>{n}</button>)}
      </div>}
    </div>);
  return (
    <button disabled={locked} onClick={() => onToggle(!st)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 0", border: "none", borderTop: `1px solid ${C.border}`, background: "none", cursor: locked ? "default" : "pointer", fontFamily: "inherit", textAlign: "left", color: C.text }}>
      <span style={{ width: 26, height: 26, flex: "0 0 26px", borderRadius: 8, border: `2px solid ${st ? C.green : C.borderDark}`, background: st ? C.green : "transparent", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700 }}>{st ? "✓" : ""}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 500, textDecoration: st ? "line-through" : "none", color: st ? C.muted : C.text }}>{it.n}</span>
        {sub && <span style={{ display: "block", fontSize: 11.5, color: C.light, marginTop: 1 }}>{sub}</span>}
      </span>
      <span style={{ textAlign: "right", whiteSpace: "nowrap" }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>{qtyText(it)}</span>
        {st && <span style={{ display: "block", fontSize: 10.5, color: C.light }}>{st.by}</span>}
      </span>
    </button>);
}

function BuyPlan({ plan, C, s }) {
  const [open, setOpen] = useState(false);
  const cols = plan.total.map(x => x.n);
  return (
    <div style={{ ...s.card }}>
      <button onClick={() => setOpen(!open)} style={{ display: "flex", justifyContent: "space-between", width: "100%", border: "none", background: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", color: C.text }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>🥚 當地採購（共 {plan.batches} 批）</span><span style={{ fontSize: 12, color: C.accent }}>{open ? "收起" : "每天要買多少"}</span>
      </button>
      <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6, lineHeight: 1.7 }}>總共：{plan.total.map(x => `${x.n} ${fmtN(x.a)}${x.u}`).join("、")}</div>
      {open && <div style={{ overflowX: "auto", marginTop: 8 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%", whiteSpace: "nowrap" }}>
          <thead><tr>{["日期", "顆數", "批", ...cols].map(h => <th key={h} style={{ textAlign: "right", padding: "4px 6px", color: C.muted, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{h}</th>)}</tr></thead>
          <tbody>{plan.days.map(d => <tr key={d.d}><td style={{ padding: "4px 6px", textAlign: "right" }}>{md(d.d)}</td><td style={{ padding: "4px 6px", textAlign: "right" }}>{fmtN(d.n)}</td><td style={{ padding: "4px 6px", textAlign: "right", fontWeight: 600 }}>{d.batches}</td>{d.items.map(x => <td key={x.n} style={{ padding: "4px 6px", textAlign: "right" }}>{fmtN(x.a)}{x.u}</td>)}</tr>)}</tbody>
        </table>
        <div style={{ fontSize: 11.5, color: C.light, marginTop: 6 }}>1 批麵糊＝1 包麵粉＝約 {plan.per} 顆。每批用量：{plan.total.map(x => `${x.n} ${x.each}${x.u}`).join("、")}</div>
      </div>}
    </div>);
}

// ── 建立 ──
function Create({ apiGet, apiPost, C, s, chip, meta, setMsg, todayStr, quote, onCancel, onDone }) {
  const tpls = (meta && meta.tpls) || [];
  const [type, setType] = useState(quote ? "活動" : "");
  const [tpl, setTpl] = useState("");
  const [f, setF] = useState({ name: "", from: "", to: "", loc: "", people: "", cakes: "" });
  const [days, setDays] = useState({}), [info, setInfo] = useState({}), [crew, setCrew] = useState([]), [cal, setCal] = useState(!quote), [busy, setBusy] = useState(false), [showInfo, setShowInfo] = useState(false);
  const T = tpls.find(t => t.name === tpl);
  useEffect(() => { const list = tpls.filter(t => t.type === type); if (list.length === 1) setTpl(list[0].name); else if (!list.some(t => t.name === tpl)) setTpl(""); }, [type, meta]);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const dlist = T && T.type === "出國" ? daysBetween(f.from, f.to || f.from) : [];
  const totalCakes = dlist.length ? dlist.reduce((a, d) => a + (Number(days[d]) || 0), 0) : Number(f.cakes) || 0;
  const per = (meta && meta.perBatch) || 100;
  const submit = async () => {
    if (!T) { setMsg("請先選模板"); return; }
    if (!quote && !f.name.trim()) { setMsg("請先填清單名稱"); return; }
    if (!quote && !f.from) { setMsg("請先選開始日期"); return; }
    setBusy(true);
    const r = await apiPost({ action: "eqCreate", tpl: T.name, name: f.name, from: f.from, to: f.to || f.from, loc: f.loc, people: f.people, cakes: f.cakes,
      days: JSON.stringify(dlist.map(d => ({ d, n: Number(days[d]) || 0 }))), info: JSON.stringify(info), crew: JSON.stringify(crew), quote: quote ? quote.id : "" }, 0);
    if (r && r.success) {
      if (cal) { const L = r.data; await apiPost({ action: "eqCal", id: L.id || r.id, icon: TYPE_ICON[L.type] || "", cat: CAL_CAT[L.type] || "活動" }, 0); }
      setBusy(false); setMsg(`✅ 已建立「${r.data.name}」`); onDone(r.id);
    } else { setBusy(false); setMsg((r && r.error) || "建立失敗"); }
  };
  if (!meta) return <div className="rh-skel" style={{ height: 240, borderRadius: 18 }} />;
  const lbl = { ...s.label, marginTop: 10 };
  return (
    <div>
      <button onClick={onCancel} style={{ ...chip(false), marginBottom: 10 }}>‹ 取消</button>
      {quote && <div style={{ ...s.card, background: C.goldBg, fontSize: 13, lineHeight: 1.7 }}>從報價單「{quote.client || quote.event}」建立：名稱、日期、地點、客戶抬頭、統編、聯絡人、數量、烤爐台數會自動帶入，下面沒填的都可以留空。</div>}
      <div style={s.card}>
        <div style={s.label}>這次是</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{(meta.types || []).map(t => <button key={t} onClick={() => setType(t)} style={chip(type === t)}>{TYPE_ICON[t]} {TYPE_LABEL[t]}</button>)}</div>
        {type && <>
          <div style={lbl}>{type === "出國" ? "國家" : "模板"}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{tpls.filter(t => t.type === type).map(t => <button key={t.name} onClick={() => setTpl(t.name)} style={chip(tpl === t.name)}>{t.country ? `${FLAG[t.country] || ""} ${t.country}` : t.name} <span style={{ color: C.light, fontSize: 11.5 }}>{t.n}項</span></button>)}</div>
          {!tpls.some(t => t.type === type) && <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6 }}>這個類型還沒有模板，請到「🗂️ 模板」新增。</div>}
        </>}
      </div>
      {T && <div style={s.card}>
        <label style={s.label}>清單名稱{quote ? "（可留空）" : ""}</label>
        <input value={f.name} onChange={e => set("name", e.target.value)} placeholder={T.type === "設櫃" ? "例：遠百竹北 進櫃" : T.type === "出國" ? "例：越南食品展" : "例：台大校慶"} style={s.input} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div><label style={lbl}>開始日</label><input type="date" value={f.from} onChange={e => { set("from", e.target.value); if (!f.to || f.to < e.target.value) set("to", e.target.value); }} style={s.input} /></div>
          <div><label style={lbl}>結束日</label><input type="date" value={f.to} min={f.from} onChange={e => set("to", e.target.value)} style={s.input} /></div>
        </div>
        <label style={lbl}>{T.type === "設櫃" ? "櫃位" : "地點"}</label>
        <input value={f.loc} onChange={e => set("loc", e.target.value)} style={s.input} />
        {T.type === "出國" ? <>
          <label style={lbl}>出團人數（護照、簽證、SIM 卡依人數）</label>
          <input type="number" inputMode="numeric" value={f.people} onChange={e => set("people", e.target.value)} style={s.input} placeholder="例：2" />
          {dlist.length > 0 && <>
            <label style={lbl}>每天預計顆數（算麵粉包數和當地採購）</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>{dlist.map(d => <div key={d}><div style={{ fontSize: 11.5, color: C.muted, marginBottom: 2 }}>{md(d)}</div><input type="number" inputMode="numeric" value={days[d] || ""} onChange={e => setDays(p => ({ ...p, [d]: e.target.value }))} style={{ ...s.input, padding: "9px 10px" }} placeholder="0" /></div>)}</div>
          </>}
        </> : <>
          <label style={lbl}>預計總顆數（選填，算麵粉包數）</label>
          <input type="number" inputMode="numeric" value={f.cakes} onChange={e => set("cakes", e.target.value)} style={s.input} placeholder={quote ? "報價單會帶入" : "例：1000"} />
        </>}
        {totalCakes > 0 && <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>共 {fmtN(totalCakes)} 顆 → 麵粉約 {Math.ceil(totalCakes / per)} 包{T.buy && T.buy.length && dlist.length ? `、當地採購 ${dlist.reduce((a, d) => a + Math.ceil((Number(days[d]) || 0) / per), 0)} 批` : ""}</div>}
        {T.volt && <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>⚡ 當地電壓 {T.volt}（烤爐、轉接頭請對應）</div>}
      </div>}
      {T && (meta.people || []).length > 0 && <div style={s.card}>
        <div style={s.label}>出勤隊員（會收到首頁提醒、可以打勾）</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{meta.people.map(p => <button key={p.id} onClick={() => setCrew(c => c.includes(p.id) ? c.filter(x => x !== p.id) : [...c, p.id])} style={{ ...chip(crew.includes(p.id)), padding: "5px 10px", fontSize: 12.5 }}>{p.name}</button>)}</div>
        <div style={{ fontSize: 11.5, color: C.light, marginTop: 6 }}>Lv.2 以上本來就看得到所有清單。</div>
      </div>}
      {T && (T.info || []).length > 0 && <div style={s.card}>
        <button onClick={() => setShowInfo(!showInfo)} style={{ display: "flex", justifyContent: "space-between", width: "100%", border: "none", background: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", color: C.text }}><span style={{ fontSize: 13.5, fontWeight: 600 }}>📋 {T.type === "設櫃" ? "櫃位資訊" : T.type === "出國" ? "行程資訊" : "活動資訊"}（選填）</span><span style={{ color: C.accent, fontSize: 12 }}>{showInfo ? "收起" : "展開"}</span></button>
        {showInfo && T.info.map(k => <div key={k}><label style={lbl}>{k}</label><input value={info[k] || ""} onChange={e => setInfo(p => ({ ...p, [k]: e.target.value }))} style={s.input} /></div>)}
      </div>}
      {T && <>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, margin: "4px 4px 12px", cursor: "pointer" }}><input type="checkbox" checked={cal} onChange={e => setCal(e.target.checked)} style={{ width: 18, height: 18 }} />同時加進公司行事曆</label>
        <button disabled={busy} onClick={submit} style={{ ...s.btn("primary"), opacity: busy ? .6 : 1, marginBottom: 20 }}>{busy ? "建立中…" : `建立清單（${T.n} 項）`}</button>
      </>}
    </div>
  );
}

// ── 修改清單（Lv.3） ──
function EditList({ L, apiPost, C, s, chip, meta, setMsg, onDone }) {
  const [f, setF] = useState({ name: L.name, from: L.from, to: L.to, loc: L.loc, people: L.people || "", cakes: L.cakes || "" });
  const [items, setItems] = useState(L.items.map(x => ({ ...x }))), [info, setInfo] = useState({ ...(L.info || {}) }), [crew, setCrew] = useState(L.crew || []);
  const [days, setDays] = useState(Object.fromEntries((L.days || []).map(d => [d.d, d.n]))), [busy, setBusy] = useState(false), [add, setAdd] = useState({ c: "", n: "", q: 1, u: "" });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const dlist = L.type === "出國" ? daysBetween(f.from, f.to || f.from) : [];
  const cats = [...new Set(items.map(x => x.c))];
  const save = async () => {
    setBusy(true);
    const data = { ...f, info, crew, items, days: dlist.map(d => ({ d, n: Number(days[d]) || 0 })) };
    const r = await apiPost({ action: "eqSave", id: L.id, data: JSON.stringify(data) }, 0); setBusy(false);
    if (r && r.success) { setMsg("✅ 清單已更新"); onDone(r.data); } else setMsg((r && r.error) || "儲存失敗");
  };
  const lbl = { ...s.label, marginTop: 10 };
  const inp = { ...s.input, padding: "8px 10px", fontSize: 13 };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><button onClick={() => onDone(null)} style={chip(false)}>‹ 不改了</button><button disabled={busy} onClick={save} style={{ ...chip(true), fontWeight: 700 }}>{busy ? "儲存中…" : "💾 儲存"}</button></div>
      <div style={s.card}>
        <label style={s.label}>名稱</label><input value={f.name} onChange={e => set("name", e.target.value)} style={s.input} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div><label style={lbl}>開始日</label><input type="date" value={f.from} onChange={e => set("from", e.target.value)} style={s.input} /></div>
          <div><label style={lbl}>結束日</label><input type="date" value={f.to} min={f.from} onChange={e => set("to", e.target.value)} style={s.input} /></div>
        </div>
        <label style={lbl}>地點</label><input value={f.loc} onChange={e => set("loc", e.target.value)} style={s.input} />
        {L.type === "出國" ? <><label style={lbl}>出團人數</label><input type="number" value={f.people} onChange={e => set("people", e.target.value)} style={s.input} />
          {dlist.length > 0 && <><label style={lbl}>每天預計顆數</label><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>{dlist.map(d => <div key={d}><div style={{ fontSize: 11.5, color: C.muted }}>{md(d)}</div><input type="number" value={days[d] || ""} onChange={e => setDays(p => ({ ...p, [d]: e.target.value }))} style={inp} /></div>)}</div></>}</>
          : <><label style={lbl}>預計總顆數</label><input type="number" value={f.cakes} onChange={e => set("cakes", e.target.value)} style={s.input} /></>}
      </div>
      {(meta && meta.people || []).length > 0 && <div style={s.card}><div style={s.label}>出勤隊員</div><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{meta.people.map(p => <button key={p.id} onClick={() => setCrew(c => c.includes(p.id) ? c.filter(x => x !== p.id) : [...c, p.id])} style={{ ...chip(crew.includes(p.id)), padding: "5px 10px", fontSize: 12.5 }}>{p.name}</button>)}</div></div>}
      {Object.keys(info).length > 0 || ((meta && meta.tpls) || []).some(t => t.name === L.tpl) ? <div style={s.card}>
        <div style={s.label}>資訊</div>
        {[...new Set([...(((meta && meta.tpls) || []).find(t => t.name === L.tpl) || {}).info || [], ...Object.keys(info)])].map(k => <div key={k} style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 6, alignItems: "center", marginBottom: 6 }}><span style={{ fontSize: 12, color: C.muted }}>{k}</span><input value={info[k] || ""} onChange={e => setInfo(p => ({ ...p, [k]: e.target.value }))} style={inp} /></div>)}
      </div> : null}
      <div style={s.card}>
        <div style={s.label}>項目（{items.length}）— 改數量、刪掉不用的，已打勾的紀錄會保留</div>
        {cats.map(c => <div key={c}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.muted, margin: "10px 0 4px" }}>{c}</div>
          {items.map((it, i) => it.c !== c ? null : (
            <div key={it.id || i} style={{ display: "grid", gridTemplateColumns: "1fr 64px 46px 30px", gap: 5, alignItems: "center", marginBottom: 5 }}>
              <input value={it.n} onChange={e => setItems(a => a.map((x, j) => j === i ? { ...x, n: e.target.value } : x))} style={inp} />
              <input type="number" value={it.q} onChange={e => setItems(a => a.map((x, j) => j === i ? { ...x, q: e.target.value } : x))} style={{ ...inp, textAlign: "right" }} />
              <input value={it.u || ""} onChange={e => setItems(a => a.map((x, j) => j === i ? { ...x, u: e.target.value } : x))} style={inp} placeholder="單位" />
              <button onClick={() => setItems(a => a.filter((_, j) => j !== i))} style={{ border: "none", background: "none", color: C.red, fontSize: 18, cursor: "pointer" }}>×</button>
            </div>))}
        </div>)}
        <div style={{ borderTop: `1px dashed ${C.border}`, marginTop: 10, paddingTop: 10 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>＋ 加一項</div>
          <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 54px 46px", gap: 5 }}>
            <input list="eq-cats" value={add.c} onChange={e => setAdd({ ...add, c: e.target.value })} placeholder="分類" style={inp} />
            <datalist id="eq-cats">{cats.map(c => <option key={c} value={c} />)}</datalist>
            <input value={add.n} onChange={e => setAdd({ ...add, n: e.target.value })} placeholder="項目" style={inp} />
            <input type="number" value={add.q} onChange={e => setAdd({ ...add, q: e.target.value })} style={inp} />
            <input value={add.u} onChange={e => setAdd({ ...add, u: e.target.value })} placeholder="單位" style={inp} />
          </div>
          <button onClick={() => { if (!add.n.trim()) return; setItems(a => [...a, { c: add.c.trim() || "其他", n: add.n.trim(), q: Number(add.q) || 1, u: add.u.trim() }]); setAdd({ c: add.c, n: "", q: 1, u: "" }); }} style={{ ...chip(false), marginTop: 6 }}>加入</button>
        </div>
      </div>
      <button disabled={busy} onClick={save} style={{ ...s.btn("primary"), marginBottom: 20 }}>{busy ? "儲存中…" : "💾 儲存修改"}</button>
    </div>
  );
}

// ── 跨清單待補購 ──
function FixList({ apiGet, apiPost, C, s, chip, admin, setMsg, onBack, onOpen }) {
  const [d, setD] = useState(null);
  const load = () => apiGet({ action: "eqFixList" }, 0).then(r => setD(r && r.success ? r : { error: (r && r.error) || "讀取失敗" }));
  useEffect(() => { load(); }, []);
  const fix = async x => { const r = await apiPost({ action: "eqFix", id: x.list, items: JSON.stringify([x.id]), on: true }, 0); if (r && r.success) { setMsg(`✅ ${x.n} 已補購`); load(); } else setMsg((r && r.error) || "更新失敗"); };
  return (
    <div>
      <button onClick={onBack} style={{ ...chip(false), marginBottom: 10 }}>‹ 全部清單</button>
      {!d ? <div className="rh-skel" style={{ height: 160, borderRadius: 18 }} /> : d.error ? <div style={{ ...s.card, color: C.red }}>{d.error}</div>
        : !d.data.length ? <div style={{ ...s.card, color: C.muted, textAlign: "center", fontSize: 13 }}>🎉 沒有待補購的設備</div>
        : <>
          <div style={{ ...s.card, fontSize: 14, fontWeight: 700 }}>🛒 待補購 {d.data.length} 項{d.total ? `・約 ${fmtN(d.total)} 元` : ""}<div style={{ fontSize: 11.5, color: C.muted, fontWeight: 400, marginTop: 4 }}>金額依模板單價計算；沒有單價的項目不算在內。</div></div>
          {d.data.map(x => (
            <div key={x.list + x.id} style={{ ...s.card, padding: "10px 14px", display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: 0, fontSize: 13, cursor: "pointer" }} onClick={() => onOpen(x.list)}>
                <b>{x.n}</b> <span style={{ color: C.red }}>{x.back}{x.back === "少" ? ` ${x.miss}${x.u || ""}` : ""}</span>{x.cost ? <span style={{ color: C.gold }}>・{fmtN(x.cost)} 元</span> : ""}
                <div style={{ fontSize: 11.5, color: C.muted }}>{md(x.date)}「{x.listName}」{x.by ? "・" + x.by : ""}{x.note ? "・" + x.note : ""}</div>
              </div>
              {admin && <button onClick={() => fix(x)} style={{ ...chip(false), padding: "4px 10px", fontSize: 12 }}>已補購</button>}
            </div>))}
        </>}
    </div>
  );
}

// ── 模板管理（Lv.3）：修改、複製、刪除、匯入／匯出 Excel ──
const XL_HEAD = ["分類", "項目", "說明", "數量", "單位", "單價", "計算", "裝箱", "備註"];
function Templates({ apiPost, C, s, chip, setMsg, loadMeta, onBack }) {
  const [m, setM] = useState(null), [edit, setEdit] = useState(null);
  const load = () => loadMeta(true).then(r => setM(r && r.success ? r : { error: (r && r.error) || "讀取失敗" }));
  useEffect(() => { load(); }, []);
  if (edit) return <TplEdit t={edit} {...{ apiPost, C, s, chip, setMsg }} types={(m && m.types) || []} onDone={ok => { setEdit(null); if (ok) load(); }} />;
  const del = async t => { if (!confirm(`刪除模板「${t.name}」？（已建立的清單不受影響）`)) return; const r = await apiPost({ action: "eqTplDel", name: t.name }, 0); if (r && r.success) { setMsg("已刪除模板"); load(); } else setMsg((r && r.error) || "刪除失敗"); };
  const exportX = async t => {
    const XLSX = await import("xlsx");
    const aoa = [XL_HEAD, ...t.items.map(it => [it.c, it.n, it.d || "", it.q, it.u || "", it.p || "", it.k || "", it.b || "", it.m || ""])];
    const ws = XLSX.utils.aoa_to_sheet(aoa); ws["!cols"] = [14, 18, 22, 6, 6, 8, 6, 18, 24].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, t.name.slice(0, 31));
    if ((t.buy || []).length) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["當地採購（每批用量）", "用量", "單位"], ...t.buy.map(b => [b.n, b.a, b.u])]), "當地採購");
    const d = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10).replace(/-/g, "");
    XLSX.writeFile(wb, `設備模板_${t.name}_${d}_v1.xlsx`);
  };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <button onClick={onBack} style={chip(false)}>‹ 全部清單</button>
        <button onClick={() => setEdit({ name: "", type: "活動", items: [], info: [], buy: [], boxes: [], _new: true })} style={chip(true)}>＋ 新模板</button>
      </div>
      <div style={{ fontSize: 12, color: C.muted, margin: "0 2px 10px", lineHeight: 1.7 }}>改模板只影響之後建立的清單。可以先「匯出 Excel」改好再「匯入」。</div>
      {!m ? <div className="rh-skel" style={{ height: 200, borderRadius: 18 }} /> : m.error ? <div style={{ ...s.card, color: C.red }}>{m.error}</div>
        : m.tpls.map(t => (
          <div key={t.name} style={s.card}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div><div style={{ fontSize: 14.5, fontWeight: 600 }}>{TYPE_ICON[t.type]} {t.name}</div><div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{t.n} 項{t.volt ? "・" + t.volt : ""}{(t.buy || []).length ? "・含當地採購" : ""}{t.at ? `・${t.by} ${String(t.at).slice(5, 16)}` : ""}</div></div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              <button onClick={() => setEdit({ ...t, old: t.name })} style={{ ...chip(false), padding: "4px 10px", fontSize: 12 }}>✏️ 修改</button>
              <button onClick={() => setEdit({ ...t, name: t.name + "（複製）", old: "", _new: true })} style={{ ...chip(false), padding: "4px 10px", fontSize: 12 }}>📋 複製</button>
              <button onClick={() => exportX(t)} style={{ ...chip(false), padding: "4px 10px", fontSize: 12 }}>⬇️ 匯出 Excel</button>
              <button onClick={() => del(t)} style={{ ...chip(false), padding: "4px 10px", fontSize: 12, color: C.muted }}>刪除</button>
            </div>
          </div>))}
    </div>
  );
}

function TplEdit({ t, types, apiPost, C, s, chip, setMsg, onDone }) {
  const [x, setX] = useState({ ...t, info: (t.info || []).join("、"), boxes: (t.boxes || []).join("、"), items: (t.items || []).map(i => ({ ...i })), buy: (t.buy || []).map(b => ({ ...b })) });
  const [busy, setBusy] = useState(false), [open, setOpen] = useState(null);
  const file = useRef(null);
  const set = (k, v) => setX(p => ({ ...p, [k]: v }));
  const setItem = (i, k, v) => setX(p => ({ ...p, items: p.items.map((it, j) => j === i ? { ...it, [k]: v } : it) }));
  const cats = [...new Set(x.items.map(i => i.c || "其他"))];
  const importX = async f => {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" });
      const hi = rows.findIndex(r => r.some(c => /^(項目|名稱|品項)$/.test(String(c).trim())));
      if (hi < 0) { setMsg("找不到標題列（要有「項目」或「名稱」欄）"); return; }
      const h = rows[hi].map(c => String(c).trim()), col = (...ns) => h.findIndex(c => ns.includes(c));
      const ci = col("分類", "類別"), ni = col("項目", "名稱", "品項"), di = col("說明", "產品規格", "數量／內容"), qi = col("數量"), ui = col("單位"), pi = col("單價"), ki = col("計算"), bi = col("裝箱"), mi = col("備註");
      let cat = "", out = [];
      rows.slice(hi + 1).forEach(r => {
        const g = i => i >= 0 ? String(r[i] ?? "").trim() : "";
        if (g(ci)) cat = g(ci).replace(/^[一二三四五六七八九十]+、/, "");
        const n = g(ni); if (!n || n === "合計") return;
        const q = Number(g(qi)); out.push({ c: cat || "其他", n, d: g(di), q: isFinite(q) && g(qi) !== "" ? q : 1, u: g(ui), p: Number(g(pi)) || 0, k: g(ki), b: g(bi), m: g(mi) });
      });
      if (!out.length) { setMsg("檔案裡沒有讀到項目"); return; }
      if (!confirm(`讀到 ${out.length} 項，取代目前的 ${x.items.length} 項？（按「儲存」才會生效）`)) return;
      set("items", out); setMsg(`已讀入 ${out.length} 項，確認後按「儲存」`);
    } catch (e) { setMsg("讀取 Excel 失敗：" + e.message); }
  };
  const save = async () => {
    setBusy(true);
    const tpl = { name: x.name.trim(), type: x.type, country: x.country || "", volt: x.volt || "", info: x.info.split(/[、,，\n]/).map(v => v.trim()).filter(Boolean), boxes: x.boxes.split(/[、,，\n]/).map(v => v.trim()).filter(Boolean),
      items: x.items.map(i => ({ ...i, q: Number(i.q) || 0, p: Number(i.p) || 0 })), buy: x.buy.map(b => ({ ...b, a: Number(b.a) || 0 })) };
    const r = await apiPost({ action: "eqTplSave", old: x._new ? "" : (t.old || t.name), tpl: JSON.stringify(tpl) }, 0); setBusy(false);
    if (r && r.success) { setMsg(`✅ 模板「${r.name}」已儲存`); onDone(true); } else setMsg((r && r.error) || "儲存失敗");
  };
  const inp = { ...s.input, padding: "8px 10px", fontSize: 13 };
  const lbl = { ...s.label, marginTop: 10 };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><button onClick={() => onDone(false)} style={chip(false)}>‹ 不改了</button><button disabled={busy} onClick={save} style={{ ...chip(true), fontWeight: 700 }}>{busy ? "儲存中…" : "💾 儲存"}</button></div>
      <div style={s.card}>
        <label style={s.label}>模板名稱</label><input value={x.name} onChange={e => set("name", e.target.value)} style={s.input} />
        <label style={lbl}>類型</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{types.map(v => <button key={v} onClick={() => set("type", v)} style={chip(x.type === v)}>{TYPE_ICON[v]} {TYPE_LABEL[v]}</button>)}</div>
        {x.type === "出國" && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div><label style={lbl}>國家</label><input value={x.country || ""} onChange={e => set("country", e.target.value)} style={s.input} /></div>
          <div><label style={lbl}>電壓</label><input value={x.volt || ""} onChange={e => set("volt", e.target.value)} placeholder="220V" style={s.input} /></div>
        </div>}
        <label style={lbl}>資訊欄（用「、」隔開）</label><textarea value={x.info} onChange={e => set("info", e.target.value)} rows={2} style={{ ...s.input, resize: "vertical" }} />
        {x.type === "出國" && <><label style={lbl}>行李箱（用「、」隔開）</label><textarea value={x.boxes} onChange={e => set("boxes", e.target.value)} rows={2} style={{ ...s.input, resize: "vertical" }} /></>}
      </div>
      {x.type === "出國" && <div style={s.card}>
        <div style={s.label}>當地採購：每批（1 包麵粉）用量</div>
        {x.buy.map((b, i) => <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 70px 50px 30px", gap: 5, marginBottom: 5 }}>
          <input value={b.n} onChange={e => set("buy", x.buy.map((y, j) => j === i ? { ...y, n: e.target.value } : y))} style={inp} />
          <input type="number" value={b.a} onChange={e => set("buy", x.buy.map((y, j) => j === i ? { ...y, a: e.target.value } : y))} style={inp} />
          <input value={b.u} onChange={e => set("buy", x.buy.map((y, j) => j === i ? { ...y, u: e.target.value } : y))} style={inp} />
          <button onClick={() => set("buy", x.buy.filter((_, j) => j !== i))} style={{ border: "none", background: "none", color: C.red, fontSize: 18, cursor: "pointer" }}>×</button>
        </div>)}
        <button onClick={() => set("buy", [...x.buy, { n: "", a: 0, u: "g" }])} style={{ ...chip(false), padding: "4px 10px", fontSize: 12 }}>＋ 加一項</button>
      </div>}
      <div style={s.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={s.label}>項目（{x.items.length}）</div>
          <button onClick={() => file.current && file.current.click()} style={{ ...chip(false), padding: "4px 10px", fontSize: 12 }}>⬆️ 匯入 Excel</button>
          <input ref={file} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) importX(f); }} />
        </div>
        <div style={{ fontSize: 11.5, color: C.light, marginBottom: 6 }}>點項目可以改說明、單價、裝箱；「計算」選「人」會乘出團人數，選「百顆」會依顆數算包數。</div>
        {cats.map(c => <div key={c}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.muted, margin: "10px 0 4px" }}>{c}</div>
          {x.items.map((it, i) => (it.c || "其他") !== c ? null : (
            <div key={i} style={{ marginBottom: 5 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 58px 44px 26px 26px", gap: 4, alignItems: "center" }}>
                <input value={it.n} onChange={e => setItem(i, "n", e.target.value)} style={inp} />
                <input type="number" value={it.q} onChange={e => setItem(i, "q", e.target.value)} style={{ ...inp, textAlign: "right" }} />
                <input value={it.u || ""} onChange={e => setItem(i, "u", e.target.value)} style={inp} />
                <button onClick={() => setOpen(open === i ? null : i)} style={{ border: "none", background: "none", color: C.muted, fontSize: 14, cursor: "pointer" }}>{open === i ? "▴" : "▾"}</button>
                <button onClick={() => set("items", x.items.filter((_, j) => j !== i))} style={{ border: "none", background: "none", color: C.red, fontSize: 18, cursor: "pointer" }}>×</button>
              </div>
              {open === i && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, margin: "4px 0 8px", padding: 8, background: C.warm, borderRadius: 10 }}>
                <input value={it.c || ""} onChange={e => setItem(i, "c", e.target.value)} placeholder="分類" style={inp} />
                <input type="number" value={it.p || ""} onChange={e => setItem(i, "p", e.target.value)} placeholder="單價" style={inp} />
                <input value={it.d || ""} onChange={e => setItem(i, "d", e.target.value)} placeholder="說明" style={{ ...inp, gridColumn: "1/-1" }} />
                <input value={it.m || ""} onChange={e => setItem(i, "m", e.target.value)} placeholder="備註" style={{ ...inp, gridColumn: "1/-1" }} />
                <select value={it.k || ""} onChange={e => setItem(i, "k", e.target.value)} style={inp}><option value="">固定數量</option><option value="人">× 人數</option><option value="百顆">依顆數（包）</option></select>
                <input list="eq-boxes" value={it.b || ""} onChange={e => setItem(i, "b", e.target.value)} placeholder="裝箱" style={inp} />
              </div>}
            </div>))}
        </div>)}
        <datalist id="eq-boxes">{x.boxes.split(/[、,，\n]/).map(v => v.trim()).filter(Boolean).map(b => <option key={b} value={b} />)}</datalist>
        <button onClick={() => { set("items", [...x.items, { c: cats[cats.length - 1] || "其他", n: "", q: 1, u: "" }]); setOpen(x.items.length); }} style={{ ...chip(false), marginTop: 8 }}>＋ 加一項</button>
      </div>
      <button disabled={busy} onClick={save} style={{ ...s.btn("primary"), marginBottom: 20 }}>{busy ? "儲存中…" : "💾 儲存模板"}</button>
    </div>
  );
}
