// ═══════════════════════════════════════════════
// 排班系統 2.0(v1.18,2026-11-11)
//   ScheduleManager:分隊長/管理員排班(個人月曆「刷子」連點、櫃位週檢視、換班核准、打卡對帳、班型設定)
//   MyShifts:夥伴「我的班表」(本月/下月班、填空檔、轉讓/釋出/認領空班)
// 規則(隊長定案):一人一天預設只能一個櫃位;Lv.3 以上可加排第二個櫃位,但時間不能重疊。
// 改動先存在手機(草稿),按「發布」才一次寫入〈班表〉。
// v1.20:已排的班可「改時間」;對帳頁加「待確認（影響薪資）」:核准加班、確認無打卡、核准臨時支援(新工時規則,2026-12 起)。
// ═══════════════════════════════════════════════
import { useState, useEffect, useMemo } from "react";
import { Flash } from "./TopToast.jsx";
import { createPortal } from "react-dom";

const WD = ["日","一","二","三","四","五","六"];
const LOC_COLORS = ["#b9381c","#3d5a80","#3a7a56","#a8741a","#7a4b8c","#2f7f86","#9a5b3c","#5b6b2e"];
const pad = n => String(n).padStart(2, "0");
const addMonth = (ym, n) => { let [y, m] = ym.split("-").map(Number); m += n; y += Math.floor((m - 1) / 12); m = ((m - 1) % 12 + 12) % 12 + 1; return `${y}-${pad(m)}`; };
const daysOf = ym => { const [y, m] = ym.split("-").map(Number); const n = new Date(Date.UTC(y, m, 0)).getUTCDate(); return Array.from({ length: n }, (_, i) => `${ym}-${pad(i + 1)}`); };
const wd = d => new Date(d + "T12:00:00Z").getUTCDay();
const addDays = (d, n) => { const t = new Date(d + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const toMin = t => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : null; };
const hoursOf = (a, b) => { const x = toMin(a); let y = toMin(b); if (x == null || y == null) return 0; if (y <= x) y += 1440; return Math.round((y - x) / 6) / 10; };
const overlap = (a, b) => { const a1 = toMin(a.start), b1 = toMin(b.start); let a2 = toMin(a.end), b2 = toMin(b.end); if (a1 == null || b1 == null) return false; if (a2 <= a1) a2 += 1440; if (b2 <= b1) b2 += 1440; return a1 < b2 && b1 < a2; };
const shortLoc = n => (n || "").replace(/^\d+/, "").replace(/^(正櫃|快閃櫃位?|展覽|分隊長)/, "") || n;
const md = d => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`;
const isHol = (d, hol) => hol[d] === "補班" ? false : (hol[d] === "國定" || hol[d] === "颱風" || hol[d] === "連假" || wd(d) === 0 || wd(d) === 6);
const tplFits = (t, d, hol) => t.apply === "全部" || (t.apply === "假日") === isHol(d, hol);
const money = n => "$" + Math.round(n).toLocaleString();

// 規格書第 1 節:196 元、同日跨櫃合併後套加班倍率、國定/颱風 ×2,無條件進位
function dayWage(h, wage, dbl) {
  let p = Math.min(h, 8) * wage;
  if (h > 8) p += (Math.min(h, 10) - 8) * wage * 1.33;
  if (h > 10) p += (Math.min(h, 12) - 10) * wage * 1.67;
  if (h > 12) p += (h - 12) * wage * 2;
  return dbl ? p * 2 : p;
}
function statsOf(rows, hol, wage) {
  const byDay = {}; rows.forEach(r => { (byDay[r.date] = byDay[r.date] || []).push(r); });
  let hours = 0, days = 0, holidayDays = 0, pay = 0;
  Object.keys(byDay).forEach(d => {
    const h = byDay[d].reduce((a, r) => a + hoursOf(r.start, r.end), 0);
    hours += h; days++; if (isHol(d, hol)) holidayDays++;
    pay += dayWage(h, wage, hol[d] === "國定" || hol[d] === "颱風");
  });
  return { hours: Math.round(hours * 10) / 10, days, holidayDays, wage: Math.ceil(pay) };
}
// 同一人同一天的重複:overlap 時段重疊 / twoLoc 同日兩個櫃位 / twice 同櫃位兩段
function dayIssues(rows) {
  const by = {}, out = [];
  rows.forEach(r => { const k = r.empId + "|" + r.date; (by[k] = by[k] || []).push(r); });
  Object.values(by).forEach(l => {
    for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) {
      const a = l[i], b = l[j], ov = overlap(a, b);
      out.push({ date: a.date, empId: a.empId, name: a.name, kind: ov ? "overlap" : a.loc !== b.loc ? "twoLoc" : "twice", a, b });
    }
  });
  return out.sort((x, y) => x.date < y.date ? -1 : 1);
}
// App 從背景切回來時自動重新載入(在 Google Sheets 改完切回 App 就會更新)
function useForeground(fn) {
  useEffect(() => {
    let last = Date.now();
    const h = () => { if (document.visibilityState === "visible" && Date.now() - last > 3000) { last = Date.now(); fn(); } };
    document.addEventListener("visibilitychange", h); window.addEventListener("focus", h);
    return () => { document.removeEventListener("visibilitychange", h); window.removeEventListener("focus", h); };
  });
}
const ISSUE_TXT = { overlap: "時段重疊", twoLoc: "同日兩個櫃位", twice: "同櫃位排兩段" };

function Sheet({ C, onClose, title, children }) {
  return createPortal(
    <div style={{ position:"fixed", inset:0, background:"rgba(43,34,28,.38)", zIndex:1000, display:"flex", alignItems:"flex-end" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:C.card, borderRadius:"22px 22px 0 0", width:"100%", maxWidth:480, margin:"0 auto",
        maxHeight:"84vh", overflowY:"auto", padding:"18px 18px calc(22px + env(safe-area-inset-bottom))", boxSizing:"border-box",
        fontFamily:"'Noto Sans TC','PingFang TC',sans-serif", color:C.text }}>
        <div style={{ width:36, height:4, borderRadius:2, background:C.border, margin:"-6px auto 14px" }}/>
        <div style={{ fontSize:16, fontWeight:600, marginBottom:14 }}>{title}</div>
        {children}
      </div>
    </div>, document.body
  );
}
function Seg({ C, items, value, onChange }) {
  return (
    <div style={{ display:"flex", background:C.warm, borderRadius:12, padding:3, gap:2 }}>
      {items.map(([k, label, badge]) => (
        <button key={k} onClick={() => onChange(k)} style={{ flex:1, border:"none", borderRadius:10, padding:"8px 4px", fontSize:13, fontFamily:"inherit", cursor:"pointer",
          background: value === k ? C.card : "transparent", color: value === k ? C.text : C.muted, fontWeight: value === k ? 600 : 500,
          boxShadow: value === k ? "0 1px 2px rgba(43,34,28,.08)" : "none", position:"relative" }}>
          {label}{badge ? <span style={{ marginLeft:4, background:C.accent, color:"#fff", borderRadius:8, fontSize:10.5, padding:"0 5px" }}>{badge}</span> : null}
        </button>
      ))}
    </div>
  );
}
const chip = (C, on, color) => ({ border:`1px solid ${on ? (color || C.accent) : C.border}`, background: on ? (color || C.accent) : C.card, color: on ? "#fff" : C.text,
  borderRadius:20, padding:"6px 12px", fontSize:12.5, fontFamily:"inherit", cursor:"pointer", whiteSpace:"nowrap", flexShrink:0 });

// ═══════════════════════════════════════════════
// 分隊長 / 管理員
// ═══════════════════════════════════════════════
export default function ScheduleManager({ user, apiGet, apiPost, C, s, todayStr }) {
  const today = todayStr();
  const [ym, setYm] = useState(addMonth(today.slice(0, 7), today.slice(8) >= "15" ? 1 : 0));
  const [view, setView] = useState("person");
  const [b, setB] = useState(null);            // board
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const opsKey = `rh_schops_${user.id}_${ym}`;
  const [ops, setOps] = useState([]);           // 草稿:{op:'add', key, date, loc, empId, name, start, end} | {op:'del', id}
  const [publishing, setPublishing] = useState(null);
  const [tplOpen, setTplOpen] = useState(false);
  const [tidy, setTidy] = useState(null);

  const load = async () => {
    setLoading(true); setErr("");
    const r = await apiGet({ action:"schBoard", empId:user.id, ym });
    if (r.success) setB(r); else setErr(r.error || "讀取失敗");
    setLoading(false);
  };
  useEffect(() => { load(); try { setOps(JSON.parse(localStorage.getItem(opsKey) || "[]")); } catch (e) { setOps([]); } }, [ym]);
  useForeground(load);
  const runTidy = async () => {
    if (!confirm(`整理 ${+ym.slice(5)} 月班表?\n會重算星期、時數、單雙人、是否假日、假日類型,補空白編號與發布狀態。\n不會改日期、人、櫃位、時間。`)) return;
    setTidy({ busy:true });
    const r = await apiPost({ action:"schTidy", managerId:user.id, ym });
    setTidy(r.success ? r : { error:r.error || "整理失敗" }); load();
  };
  const saveOps = next => { setOps(next); try { localStorage.setItem(opsKey, JSON.stringify(next)); } catch (e) {} };

  const hol = b?.holidays || {};
  const wage = b?.params?.wage || 196;
  const role = b?.role || user.role;
  const managed = b?.managed || [];
  const locColor = useMemo(() => { const m = {}; managed.forEach((l, i) => { m[l] = LOC_COLORS[i % LOC_COLORS.length]; }); return m; }, [b]);

  // 有效班表 = 已發布 − 刪除 + 新增
  const effOf = curOps => {
    if (!b) return [];
    const del = new Set(curOps.filter(o => o.op === "del").map(o => o.id));
    return b.shifts.filter(x => !del.has(x.id)).map(x => ({ ...x, published:true }))
      .concat(curOps.filter(o => o.op === "add").map(o => ({ ...o, id:o.key, draft:true })));
  };
  const eff = useMemo(() => effOf(ops), [b, ops]);

  // 指派:把某人某天(在我管的櫃位)的班換成新的;Lv.3 加排第二櫃位需 add=true
  const planAssign = (curOps, empId, date, loc, start, end, add) => {
    const emp = b.staff.find(x => x.id === empId);
    const sameDay = effOf(curOps).filter(x => x.empId === empId && x.date === date);
    const replace = add ? [] : sameDay.filter(x => managed.includes(x.loc));
    const others = sameDay.filter(x => !replace.includes(x));
    const cand = { empId, date, loc, start, end };
    const hit = others.find(o => overlap(o, cand));
    if (hit) return { err:`時段重疊:${emp.name} 當天已排 ${shortLoc(hit.loc)} ${hit.start}–${hit.end}` };
    if (others.length && role < 3) return { err:`${emp.name} 當天已排在 ${shortLoc(others[0].loc)},同日第二個櫃位需要 Lv.3` };
    let next = curOps.slice();
    replace.forEach(x => { next = x.draft ? next.filter(o => o.key !== x.id) : next.concat([{ op:"del", id:x.id }]); });
    next.push({ op:"add", key:"d" + Date.now() + Math.random().toString(36).slice(2, 8), date, loc, empId, name:emp.name, start, end });
    return { err:"", next };
  };
  const assign = (empId, date, loc, start, end, { add = false } = {}) => {
    const r = planAssign(ops, empId, date, loc, start, end, add);
    if (!r.err) saveOps(r.next);
    return r.err;
  };
  const assignMany = items => {        // 批次(複製上週)→ 回傳失敗清單
    let cur = ops; const fails = [];
    items.forEach(it => { const r = planAssign(cur, it.empId, it.date, it.loc, it.start, it.end, false); if (r.err) fails.push(it); else cur = r.next; });
    saveOps(cur); return fails;
  };
  const removeShift = x => saveOps(x.draft ? ops.filter(o => o.key !== x.id) : ops.concat([{ op:"del", id:x.id }]));
  // v1.20:已排的班改時間(活動時間常變)= 刪掉原本那班 + 同櫃位排入新時間,一樣先存草稿、按發布才生效
  const retime = (x, start, end) => {
    if (!start || !end) return "請填上下班時間";
    const base = x.draft ? ops.filter(o => o.key !== x.id) : ops.concat([{ op:"del", id:x.id }]);
    const r = planAssign(base, x.empId, x.date, x.loc, start, end, true);
    if (!r.err) saveOps(r.next);
    return r.err;
  };

  const publish = async () => {
    const payload = ops.map(o => o.op === "del" ? { op:"del", id:o.id } : { op:"add", date:o.date, loc:o.loc, empId:o.empId, start:o.start, end:o.end });
    setPublishing({ busy:true });
    const r = await apiPost({ action:"schPublish", managerId:user.id, ops:payload });
    if (r.success) { saveOps([]); setPublishing({ done:`已發布:新增 ${r.added}、刪除 ${r.deleted}` }); load(); }
    else setPublishing({ error:r.error || "發布失敗", conflicts:r.conflicts || [] });
  };

  const pendingReq = (b?.requests || []).filter(q => q.status === "待核准").length;
  const monthIssues = useMemo(() => dayIssues(eff.filter(x => x.date.slice(0, 7) === ym)), [eff, ym]);

  return (
    <div style={{ paddingBottom: ops.length ? 76 : 0 }}>
      <div style={s.card}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
          <button onClick={() => setYm(addMonth(ym, -1))} style={navBtn(C)}>‹</button>
          <div style={{ fontSize:16, fontWeight:600 }}>{+ym.slice(0, 4)} 年 {+ym.slice(5)} 月</div>
          <div style={{ display:"flex", gap:6 }}>
            <button onClick={() => setYm(addMonth(ym, 1))} style={navBtn(C)}>›</button>
            <button onClick={load} title="重新整理" style={{ ...navBtn(C), opacity: loading ? .4 : 1 }}>↻</button>
            <button onClick={() => setTplOpen(true)} title="各櫃位平日／假日上班時間" style={{ ...navBtn(C), width:"auto", padding:"0 10px", fontSize:13 }}>⏰ 上班時間</button>
          </div>
        </div>
        <Seg C={C} value={view} onChange={setView} items={[["person","個人"],["loc","櫃位"],["req","申請",pendingReq],["rec","對帳"]]}/>
        {role >= 3 && (
          <button onClick={runTidy} style={{ ...s.btn("ghost"), marginTop:10, padding:"9px 12px", fontSize:13 }}>
            整理班表(在 Google Sheets 改過後按這裡)
          </button>
        )}
        {monthIssues.length > 0 && view !== "rec" && (
          <div style={{ marginTop:10, fontSize:12, color:C.red, background:C.redBg, borderRadius:10, padding:"7px 10px" }}>
            本月有 {monthIssues.length} 筆重複排班,請到「個人」檢查({[...new Set(monthIssues.map(x => x.name))].join("、")})
          </div>
        )}
      </div>

      <Flash text={err} />{err && <div style={{ ...s.card, background:C.redBg, color:C.red, fontSize:13 }}>{err}</div>}
      {!b && loading && <div style={{ ...s.card, textAlign:"center", color:C.muted, fontSize:13 }}>載入中…</div>}

      {b && view === "person" && <PersonView {...{ b, ym, eff, ops, hol, wage, role, managed, locColor, assign, removeShift, retime, C, s, today }}/>}
      {b && view === "loc"    && <LocView {...{ b, ym, eff, hol, role, managed, locColor, assign, assignMany, removeShift, retime, C, s, today }}/>}
      {b && view === "req"    && <ReqView {...{ b, user, apiPost, reload:load, managed, hol, C, s, today }}/>}
      {b && view === "rec"    && <RecView {...{ user, ym, apiGet, apiPost, C, s }}/>}

      {ops.length > 0 && (
        <div style={{ position:"fixed", left:"50%", transform:"translateX(-50%)", bottom:"calc(74px + env(safe-area-inset-bottom))", width:"calc(100% - 24px)", maxWidth:456,
          background:C.text, color:"#fff", borderRadius:16, padding:"10px 12px 10px 16px", display:"flex", alignItems:"center", gap:8, zIndex:150, boxSizing:"border-box",
          boxShadow:"0 6px 20px rgba(43,34,28,.25)" }}>
          <div style={{ flex:1, fontSize:13 }}>{ops.length} 項變更未發布</div>
          <button onClick={() => saveOps(ops.slice(0, -1))} style={{ ...barBtn, background:"transparent", color:"#e8e0d5" }}>復原</button>
          <button onClick={() => { if (confirm("放棄所有未發布的變更?")) saveOps([]); }} style={{ ...barBtn, background:"transparent", color:"#e8e0d5" }}>清除</button>
          <button onClick={publish} style={{ ...barBtn, background:C.accent, color:"#fff" }}>發布</button>
        </div>
      )}

      {/* v1.34 部署端：發布結果也在頂端跳提醒 */}
      <Flash text={publishing && (publishing.done ? "✅ " + publishing.done : publishing.error)} kind={publishing && publishing.done ? "ok" : "bad"} />
      {publishing && (
        <Sheet C={C} title={publishing.busy ? "發布中…" : publishing.done ? "發布完成" : "未發布"} onClose={() => !publishing.busy && setPublishing(null)}>
          {publishing.busy && <div style={{ color:C.muted, fontSize:13 }}>正在寫入班表,請稍候</div>}
          {publishing.done && <div style={{ color:C.green, fontSize:14 }}>✓ {publishing.done}。夥伴 App 已看得到新班表。</div>}
          {publishing.error && <>
            <div style={{ color:C.red, fontSize:14, marginBottom:8 }}>{publishing.error}</div>
            {publishing.conflicts.map((t, i) => <div key={i} style={{ fontSize:12.5, padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>{t}</div>)}
            <div style={{ fontSize:12, color:C.muted, marginTop:10 }}>變更仍保留在手機上,修正後可再按發布。</div>
          </>}
          {!publishing.busy && <button onClick={() => setPublishing(null)} style={{ ...s.btn("ghost"), marginTop:14 }}>關閉</button>}
        </Sheet>
      )}
      {tidy && (
        <Sheet C={C} title={tidy.busy ? "整理中…" : tidy.error ? "整理失敗" : `${+ym.slice(5)} 月班表整理完成`} onClose={() => !tidy.busy && setTidy(null)}>
          {tidy.busy && <div style={{ color:C.muted, fontSize:13 }}>正在檢查班表,請稍候</div>}
          {tidy.error && <div style={{ color:C.red, fontSize:14 }}>{tidy.error}</div>}
          {tidy.success && <>
            <div style={{ fontSize:14, marginBottom:10 }}>共 {tidy.rows} 個班,補正 <b style={{ color: tidy.changed ? C.gold : C.green }}>{tidy.changed}</b> 列</div>
            {tidy.details.map((x, i) => <div key={i} style={{ fontSize:12.5, padding:"5px 0", borderBottom:`1px solid ${C.border}` }}>{x}</div>)}
            <div style={{ ...s.sectionTitle, marginTop:14 }}>重複排班</div>
            {!tidy.issues.length ? <div style={{ fontSize:13, color:C.green }}>✓ 沒有重複</div>
              : tidy.issues.map((x, i) => <div key={i} style={{ fontSize:12.5, color:C.red, padding:"5px 0", borderBottom:`1px solid ${C.border}` }}>{x}</div>)}
            {tidy.issues.length > 0 && <div style={{ fontSize:12, color:C.muted, marginTop:8 }}>重複的班不會自動刪,請到「個人」選那位夥伴處理,或回 Sheets 修改。</div>}
          </>}
          {!tidy.busy && <button onClick={() => setTidy(null)} style={{ ...s.btn("ghost"), marginTop:14 }}>關閉</button>}
        </Sheet>
      )}
      {tplOpen && b && <TemplateEditor {...{ b, user, apiPost, managed, onClose:() => setTplOpen(false), onSaved:load, C, s }}/>}
    </div>
  );
}
const navBtn = C => ({ width:34, height:34, borderRadius:10, border:`1px solid ${C.border}`, background:C.card, color:C.text, fontSize:16, cursor:"pointer", fontFamily:"inherit" });
const barBtn = { border:"none", borderRadius:10, padding:"8px 12px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" };

// ── 個人:選夥伴 → 選刷子(櫃位・班型)→ 連點日子 ──
function PersonView({ b, ym, eff, hol, wage, role, managed, locColor, assign, removeShift, retime, C, s, today }) {
  const [q, setQ] = useState("");
  const [empId, setEmpId] = useState("");
  const [brush, setBrush] = useState(null);     // {loc, name, start, end}
  const [day, setDay] = useState(null);
  const [msg, setMsg] = useState("");
  const staff = b.staff;
  const monthRows = eff.filter(x => x.date.slice(0, 7) === ym);
  const hoursBy = useMemo(() => { const m = {}; monthRows.forEach(x => { m[x.empId] = (m[x.empId] || 0) + hoursOf(x.start, x.end); }); return m; }, [monthRows]);
  const list = staff.filter(x => !q || x.name.includes(q)).sort((a, c) => (hoursBy[a.id] || 0) - (hoursBy[c.id] || 0));
  const emp = staff.find(x => x.id === empId);
  const mine = monthRows.filter(x => x.empId === empId);
  const st = statsOf(mine, hol, wage);
  const target = emp?.student ? b.params.studentHours : b.params.monthHours;
  const av = b.avail[empId];
  const issues = dayIssues(mine);
  const days = daysOf(ym), lead = wd(days[0]);
  const flash = t => { setMsg(t); if (t) setTimeout(() => setMsg(""), 3500); };

  const tapDay = d => {
    if (!emp) return;
    const cur = mine.filter(x => x.date === d);
    const lockedElsewhere = cur.filter(x => !managed.includes(x.loc));
    if (!brush) { setDay(d); return; }
    if (lockedElsewhere.length && role < 3) { flash(`${md(d)} 已排在 ${shortLoc(lockedElsewhere[0].loc)}(由其他分隊長排定)`); return; }
    const same = cur.find(x => x.loc === brush.loc && x.start === brush.start && x.end === brush.end);
    if (same) { removeShift(same); return; }   // 同刷子再點一次 = 取消
    flash(assign(empId, d, brush.loc, brush.start, brush.end));
  };

  const brushes = [];
  managed.forEach(l => (b.templates[l] || [{ name:"全天", start:"10:00", end:"20:00", apply:"全部" }]).forEach(t => brushes.push({ loc:l, ...t })));

  return (
    <>
      <div style={s.card}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="搜尋夥伴" style={{ ...s.input, padding:"9px 12px", marginBottom:10 }}/>
        <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:2 }}>
          {list.map(x => {
            const filled = !!b.avail[x.id];
            return (
              <button key={x.id} onClick={() => { setEmpId(x.id); setDay(null); }} style={chip(C, empId === x.id)}>
                {x.name} <span style={{ opacity:.7, fontSize:11 }}>{Math.round(hoursBy[x.id] || 0)}h</span>
                {!filled && <span title="未填空檔" style={{ marginLeft:4, color: empId === x.id ? "#fff" : C.gold }}>·</span>}
              </button>
            );
          })}
        </div>
      </div>

      {!emp && <div style={{ ...s.card, textAlign:"center", color:C.muted, fontSize:13, lineHeight:1.8 }}>先選一位夥伴<br/>再選下方的「櫃位・班型」,點日子就排好了</div>}

      {emp && <>
        <div style={s.card}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:10 }}>
            <div style={{ fontSize:15, fontWeight:600 }}>{emp.name}</div>
            <div style={{ fontSize:12, color:C.muted }}>{av ? `已填空檔${av.hope ? `・希望 ${av.hope}h` : ""}` : "尚未填空檔"}</div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
            <Stat C={C} label="排班時數" value={`${st.hours}`} sub={`/ ${target}h`} ok={st.hours >= target}/>
            <Stat C={C} label="假日天數" value={`${st.holidayDays}`} sub={`/ ${b.params.holidayDays} 天`} ok={st.holidayDays >= b.params.holidayDays}/>
            <Stat C={C} label="預估工資" value={money(st.wage)} sub="依排班"/>
          </div>
          {av?.note && <div style={{ fontSize:12, color:C.muted, marginTop:8 }}>備註:{av.note}</div>}
        </div>

        <div style={s.card}>
          <div style={{ fontSize:12, color:C.muted, marginBottom:8 }}>刷子:選好後點日子即排入,再點一次取消</div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            <button onClick={() => setBrush(null)} style={chip(C, !brush, C.text)}>逐日選</button>
            {brushes.map((t, i) => {
              const on = brush && brush.loc === t.loc && brush.start === t.start && brush.end === t.end;
              return <button key={i} onClick={() => setBrush(t)} style={chip(C, on, locColor[t.loc])}>
                {managed.length > 1 && <b style={{ fontWeight:600 }}>{shortLoc(t.loc)}・</b>}{t.name} {t.start}–{t.end}
              </button>;
            })}
          </div>
          <Flash text={msg} />{msg && <div style={{ marginTop:10, fontSize:12.5, color:C.red, background:C.redBg, borderRadius:10, padding:"7px 10px" }}>{msg}</div>}
        </div>

        <div style={{ ...s.card, padding:10 }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4 }}>
            {WD.map((w, i) => <div key={w} style={{ textAlign:"center", fontSize:11, color: i === 0 || i === 6 ? C.accent : C.muted, padding:"2px 0 4px" }}>{w}</div>)}
            {Array.from({ length: lead }).map((_, i) => <div key={"e" + i}/>)}
            {days.map(d => {
              const cur = mine.filter(x => x.date === d), a = av?.days?.[d], h = isHol(d, hol);
              const bad = issues.some(x => x.date === d);
              const elsewhere = cur.some(x => !managed.includes(x.loc));
              return (
                <button key={d} onClick={() => tapDay(d)} style={{ minHeight:62, borderRadius:10, padding:"4px 3px", fontFamily:"inherit", cursor:"pointer", textAlign:"left",
                  border:`1px solid ${bad ? C.red : d === today ? C.text : C.border}`, background: a === "off" ? "#f4efe9" : C.card,
                  display:"flex", flexDirection:"column", gap:2, opacity: d < today ? .55 : 1 }}>
                  <span style={{ display:"flex", justifyContent:"space-between", fontSize:11.5, color: h ? C.accent : C.text, fontWeight:600 }}>
                    {+d.slice(8)}
                    {a === "ok" && <span style={{ width:6, height:6, borderRadius:3, background:C.green, marginTop:4 }}/>}
                    {a === "off" && <span style={{ fontSize:10, color:C.muted, fontWeight:500 }}>休</span>}
                  </span>
                  {cur.map(x => (
                    <span key={x.id} style={{ fontSize:9.5, lineHeight:1.25, borderRadius:5, padding:"2px 3px", color:"#fff",
                      background: elsewhere && !managed.includes(x.loc) ? C.light : (locColor[x.loc] || C.muted),
                      outline: x.draft ? "1.5px dashed rgba(255,255,255,.9)" : "none", outlineOffset:-3 }}>
                      {shortLoc(x.loc).slice(0, 4)}<br/>{x.start.replace(":00", "")}–{x.end.replace(":00", "")}
                    </span>
                  ))}
                  {hol[d] && hol[d] !== "補班" && !cur.length && <span style={{ fontSize:9, color:C.accent }}>{hol[d]}</span>}
                </button>
              );
            })}
          </div>
          <div style={{ display:"flex", gap:12, fontSize:11, color:C.muted, marginTop:10, flexWrap:"wrap" }}>
            <span><span style={{ display:"inline-block", width:6, height:6, borderRadius:3, background:C.green, marginRight:4 }}/>可上班</span>
            <span>灰底=想休</span><span>虛線框=未發布</span><span>灰色班=其他分隊長排的</span>
          </div>
        </div>

        <div style={s.card}>
          <div style={s.sectionTitle}>重複排班檢查</div>
          {issues.length === 0 ? <div style={{ fontSize:13, color:C.green }}>✓ 本月沒有重複</div> : issues.map((x, i) => (
            <div key={i} style={{ padding:"8px 0", borderBottom:`1px solid ${C.border}`, fontSize:13 }}>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <b style={{ fontWeight:600 }}>{md(x.date)}({WD[wd(x.date)]})</b>
                <span style={{ fontSize:11.5, color:"#fff", background: x.kind === "overlap" ? C.red : C.gold, borderRadius:8, padding:"1px 8px" }}>{ISSUE_TXT[x.kind]}</span>
              </div>
              <div style={{ fontSize:12, color:C.muted, marginTop:3 }}>{shortLoc(x.a.loc)} {x.a.start}–{x.a.end} ／ {shortLoc(x.b.loc)} {x.b.start}–{x.b.end}</div>
              <div style={{ fontSize:11.5, color:C.muted, marginTop:2 }}>
                {x.kind === "overlap" ? "同一時段排了兩個地方,一定要刪掉一個" : x.kind === "twoLoc" ? "時間沒重疊,但同一天跑兩個櫃位(需 Lv.3 確認)" : "同一櫃位排了兩段,確認是否要合併"}
              </div>
            </div>
          ))}
        </div>

        {day && <DaySheet {...{ C, s, b, emp, day, mine, hol, role, managed, locColor, assign, removeShift, retime, onClose:() => setDay(null) }}/>}
      </>}
    </>
  );
}
function Stat({ C, label, value, sub, ok }) {
  return (
    <div style={{ background:C.warm, borderRadius:12, padding:"9px 10px" }}>
      <div style={{ fontSize:11, color:C.muted }}>{label}</div>
      <div style={{ fontSize:17, fontWeight:600, color: ok ? C.green : C.text, marginTop:2 }}>{value}</div>
      <div style={{ fontSize:10.5, color:C.muted }}>{sub}</div>
    </div>
  );
}
// 單日詳細:選櫃位班型、自訂時間、刪除
// 已排的班:改時間(行內編輯)
function Retime({ C, s, x, retime, onDone, setErr }) {
  const [st, setSt] = useState(x.start), [en, setEn] = useState(x.end);
  return (
    <div style={{ display:"flex", gap:6, alignItems:"center", padding:"6px 0 10px", borderBottom:`1px solid ${C.border}` }}>
      <input type="time" step="1800" value={st} onChange={e => setSt(e.target.value)} style={{ ...s.input, padding:"8px", flex:1 }}/>
      <span style={{ color:C.muted }}>–</span>
      <input type="time" step="1800" value={en} onChange={e => setEn(e.target.value)} style={{ ...s.input, padding:"8px", flex:1 }}/>
      <button onClick={() => { const e = retime(x, st, en); if (e) setErr(e); else onDone(); }} style={{ ...s.btn("primary"), width:"auto", padding:"8px 12px", fontSize:12.5 }}>改好了</button>
    </div>
  );
}
function DaySheet({ C, s, b, emp, day, mine, hol, role, managed, locColor, assign, removeShift, retime, onClose }) {
  const [editing, setEditing] = useState(null);
  const [err, setErr] = useState("");
  const [st, setSt] = useState("10:00"), [en, setEn] = useState("20:00"), [loc, setLoc] = useState(managed[0] || "");
  const cur = mine.filter(x => x.date === day);
  const elsewhere = cur.filter(x => !managed.includes(x.loc));
  const locked = elsewhere.length > 0 && role < 3;
  const [second, setSecond] = useState(false);   // Lv.3:加排同日第二個櫃位
  const go = (l, a, z) => { const e = assign(emp.id, day, l, a, z, { add: second || elsewhere.length > 0 }); if (e) setErr(e); else onClose(); };
  return (
    <Sheet C={C} onClose={onClose} title={`${md(day)}(${WD[wd(day)]})${isHol(day, hol) ? "・假日" : ""}  ${emp.name}`}>
      {cur.map(x => (
        <div key={x.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:`1px solid ${C.border}` }}>
          <span style={{ width:8, height:8, borderRadius:4, background: managed.includes(x.loc) ? locColor[x.loc] : C.light }}/>
          <div style={{ flex:1, fontSize:13.5 }}>{x.loc}<div style={{ fontSize:12, color:C.muted }}>{x.start}–{x.end}{x.draft ? "・未發布" : ""}{!managed.includes(x.loc) ? "・其他分隊長排定" : ""}</div></div>
          {managed.includes(x.loc) && <button onClick={() => setEditing(editing === x.id ? null : x.id)} style={{ ...s.btn("ghost"), width:"auto", padding:"6px 10px", fontSize:12 }}>改時間</button>}
          {managed.includes(x.loc) && <button onClick={() => { removeShift(x); onClose(); }} style={{ ...s.btn("ghost"), width:"auto", padding:"6px 12px", fontSize:12, color:C.red }}>刪除</button>}
        </div>
      ))}
      {cur.filter(x => x.id === editing).map(x => <Retime key={x.id} {...{ C, s, x, retime, setErr, onDone:onClose }}/>)}
      {locked ? (
        <div style={{ fontSize:13, color:C.muted, marginTop:12, lineHeight:1.7 }}>這天已排在 {elsewhere[0].loc}。<br/>一人一天只能一個櫃位;如需同日加排第二個櫃位,請 Lv.3 以上處理。</div>
      ) : <>
        {managed.map(l => {
          const ts = (b.templates[l] || []).filter(t => tplFits(t, day, hol));
          return (
            <div key={l} style={{ marginTop:12 }}>
              <div style={{ fontSize:12, color:C.muted, marginBottom:6 }}>{l}</div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {ts.map((t, i) => <button key={i} onClick={() => go(l, t.start, t.end)} style={chip(C, false)}>{t.name} {t.start}–{t.end}</button>)}
                {!ts.length && <span style={{ fontSize:12, color:C.light }}>沒有適用今天的班型</span>}
              </div>
            </div>
          );
        })}
        <div style={{ marginTop:14, fontSize:12, color:C.muted, marginBottom:6 }}>自訂時間</div>
        <div style={{ display:"flex", gap:6 }}>
          {managed.length > 1 && <select value={loc} onChange={e => setLoc(e.target.value)} style={{ ...s.input, padding:"9px 8px", flex:1.4 }}>{managed.map(l => <option key={l} value={l}>{shortLoc(l)}</option>)}</select>}
          <input type="time" value={st} onChange={e => setSt(e.target.value)} style={{ ...s.input, padding:"9px 8px", flex:1 }}/>
          <input type="time" value={en} onChange={e => setEn(e.target.value)} style={{ ...s.input, padding:"9px 8px", flex:1 }}/>
          <button onClick={() => go(managed.length > 1 ? loc : managed[0], st, en)} style={{ ...s.btn("primary"), width:"auto", padding:"9px 14px" }}>排入</button>
        </div>
        {role >= 3 && cur.length > 0 && elsewhere.length === 0 && (
          <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:12.5, marginTop:12, color:C.gold }}>
            <input type="checkbox" checked={second} onChange={e => setSecond(e.target.checked)}/>加排同日第二個櫃位(不勾=取代原本的班;時間不能重疊)
          </label>
        )}
        {elsewhere.length > 0 && <div style={{ fontSize:12, color:C.gold, marginTop:10 }}>已排在 {shortLoc(elsewhere[0].loc)},此處為同日第二個櫃位(Lv.3),時間不能重疊。</div>}
      </>}
      <Flash text={err} />{err && <div style={{ marginTop:10, fontSize:12.5, color:C.red, background:C.redBg, borderRadius:10, padding:"7px 10px" }}>{err}</div>}
    </Sheet>
  );
}

// ── 櫃位:週檢視、人數夠不夠、加人 ──
function LocView({ b, ym, eff, hol, role, managed, locColor, assign, assignMany, removeShift, retime, C, s, today }) {
  const [loc, setLoc] = useState(managed[0] || "");
  const first = daysOf(ym)[0];
  const [wk, setWk] = useState(() => { const base = today.slice(0, 7) === ym ? today : first; return addDays(base, -wd(base)); });
  useEffect(() => { const base = today.slice(0, 7) === ym ? today : first; setWk(addDays(base, -wd(base))); }, [ym]);
  const [day, setDay] = useState(null);
  const week = Array.from({ length:7 }, (_, i) => addDays(wk, i));
  const need = d => Math.max(0, ...(b.templates[loc] || []).filter(t => tplFits(t, d, hol)).map(t => t.count || 1));

  const copyLastWeek = () => {
    const items = [];
    week.forEach(d => {
      const src = eff.filter(x => x.loc === loc && x.date === addDays(d, -7));
      const have = eff.filter(x => x.loc === loc && x.date === d);
      src.forEach(x => { if (!have.some(h => h.empId === x.empId)) items.push({ empId:x.empId, name:x.name, date:d, loc, start:x.start, end:x.end }); });
    });
    if (!items.length) { alert("上週這個櫃位沒有可複製的班(或這週已排好)"); return; }
    const fail = assignMany(items);
    alert(`已複製 ${items.length - fail.length} 個班${fail.length ? `\n略過(當天已排別處):${fail.map(f => md(f.date) + " " + f.name).join("、")}` : ""}`);
  };

  return (
    <>
      <div style={s.card}>
        <div style={{ display:"flex", gap:6, overflowX:"auto", marginBottom:12 }}>
          {managed.map(l => <button key={l} onClick={() => setLoc(l)} style={chip(C, loc === l, locColor[l])}>{shortLoc(l)}</button>)}
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <button onClick={() => setWk(addDays(wk, -7))} style={navBtn(C)}>‹</button>
          <div style={{ fontSize:14, fontWeight:600 }}>{md(week[0])} – {md(week[6])}</div>
          <button onClick={() => setWk(addDays(wk, 7))} style={navBtn(C)}>›</button>
        </div>
        <button onClick={copyLastWeek} style={{ ...s.btn("ghost"), marginTop:10, padding:"9px 12px", fontSize:13 }}>複製上週到這週</button>
      </div>
      {week.map(d => {
        const rows = eff.filter(x => x.loc === loc && x.date === d), n = need(d), h = isHol(d, hol);
        return (
          <button key={d} onClick={() => setDay(d)} style={{ ...s.card, width:"100%", display:"flex", gap:12, alignItems:"center", cursor:"pointer", fontFamily:"inherit", textAlign:"left",
            padding:"12px 14px", marginBottom:8, color:C.text, opacity: d < today ? .6 : 1 }}>
            <div style={{ width:44, textAlign:"center" }}>
              <div style={{ fontSize:17, fontWeight:600, color: h ? C.accent : C.text }}>{+d.slice(8)}</div>
              <div style={{ fontSize:11, color: h ? C.accent : C.muted }}>{WD[wd(d)]}{hol[d] && hol[d] !== "補班" ? "・" + hol[d] : ""}</div>
            </div>
            <div style={{ flex:1, display:"flex", flexWrap:"wrap", gap:5 }}>
              {rows.map(x => <span key={x.id} style={{ fontSize:12, borderRadius:8, padding:"4px 8px", background:C.warm,
                border: x.draft ? `1.5px dashed ${locColor[loc]}` : `1px solid ${C.border}` }}>{x.name} <span style={{ color:C.muted }}>{x.start}–{x.end}</span></span>)}
              {!rows.length && <span style={{ fontSize:12.5, color:C.light }}>尚未排班</span>}
            </div>
            {n > 0 && <span style={{ fontSize:12, fontWeight:600, color: rows.length >= n ? C.green : C.gold }}>{rows.length}/{n}</span>}
          </button>
        );
      })}
      {day && <LocDaySheet {...{ C, s, b, loc, day, eff, hol, role, managed, assign, removeShift, retime, onClose:() => setDay(null) }}/>}
    </>
  );
}
function LocDaySheet({ C, s, b, loc, day, eff, hol, role, managed, assign, removeShift, retime, onClose }) {
  const [editing, setEditing] = useState(null);
  const ts = (b.templates[loc] || []).filter(t => tplFits(t, day, hol));
  const [ti, setTi] = useState(0);
  const t = ts[ti] || { start:"10:00", end:"20:00", name:"全天" };
  const [err, setErr] = useState("");
  const here = eff.filter(x => x.loc === loc && x.date === day);
  const ym = day.slice(0, 7);
  const hrs = {}; eff.forEach(x => { if (x.date.slice(0, 7) === ym) hrs[x.empId] = (hrs[x.empId] || 0) + hoursOf(x.start, x.end); });
  const rank = x => { const a = b.avail[x.id]?.days?.[day]; return a === "ok" ? 0 : a ? 2 : 1; };
  const staff = b.staff.filter(x => !here.some(h => h.empId === x.id)).sort((x, y) => rank(x) - rank(y) || (hrs[x.id] || 0) - (hrs[y.id] || 0));
  return (
    <Sheet C={C} onClose={onClose} title={`${md(day)}(${WD[wd(day)]})${isHol(day, hol) ? "・假日" : ""}  ${shortLoc(loc)}`}>
      {here.map(x => (
        <div key={x.id} style={{ display:"flex", alignItems:"center", padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
          <div style={{ flex:1, fontSize:13.5 }}>{x.name} <span style={{ color:C.muted, fontSize:12 }}>{x.start}–{x.end}{x.draft ? "・未發布" : ""}</span></div>
          <button onClick={() => setEditing(editing === x.id ? null : x.id)} style={{ ...s.btn("ghost"), width:"auto", padding:"5px 10px", fontSize:12, marginRight:6 }}>改時間</button>
          <button onClick={() => removeShift(x)} style={{ ...s.btn("ghost"), width:"auto", padding:"5px 12px", fontSize:12, color:C.red }}>移除</button>
        </div>
      ))}
      {here.filter(x => x.id === editing).map(x => <Retime key={x.id} {...{ C, s, x, retime, setErr, onDone:() => setEditing(null) }}/>)}
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", margin:"12px 0 10px" }}>
        {ts.map((x, i) => <button key={i} onClick={() => setTi(i)} style={chip(C, ti === i)}>{x.name} {x.start}–{x.end}</button>)}
      </div>
      <div style={{ fontSize:12, color:C.muted, marginBottom:4 }}>點夥伴加入(有空的排前面)</div>
      {staff.map(x => {
        const a = b.avail[x.id]?.days?.[day];
        const other = eff.find(y => y.empId === x.id && y.date === day);
        const dis = other && (role < 3 || overlap(other, t));
        return (
          <button key={x.id} disabled={dis} onClick={() => { const e = assign(x.id, day, loc, t.start, t.end, { add: !!other }); setErr(e); }}
            style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"10px 2px", border:"none", borderBottom:`1px solid ${C.border}`,
              background:"none", fontFamily:"inherit", cursor: dis ? "default" : "pointer", opacity: dis ? .45 : 1, textAlign:"left", color:C.text }}>
            <span style={{ flex:1, fontSize:14 }}>{x.name}</span>
            {other ? <span style={{ fontSize:11.5, color:C.muted }}>已排 {shortLoc(other.loc)} {other.start}–{other.end}</span>
              : <span style={{ fontSize:11.5, color: a === "ok" ? C.green : a === "off" ? C.red : C.light }}>{a === "ok" ? "可上班" : a === "off" ? "想休" : "未填"}</span>}
            <span style={{ fontSize:11.5, color:C.muted, width:40, textAlign:"right" }}>{Math.round(hrs[x.id] || 0)}h</span>
          </button>
        );
      })}
      <Flash text={err} />{err && <div style={{ marginTop:10, fontSize:12.5, color:C.red, background:C.redBg, borderRadius:10, padding:"7px 10px" }}>{err}</div>}
    </Sheet>
  );
}

// ── 換班申請核准 + 開放空班 ──
function ReqView({ b, user, apiPost, reload, managed, C, s, today }) {
  const [busy, setBusy] = useState("");
  const [form, setForm] = useState(null);
  const KIND = { give:"轉讓", release:"釋出", open:"空班" };
  const act = async (q, approve) => {
    setBusy(q.id);
    const r = await apiPost({ action:"schApprove", managerId:user.id, reqId:q.id, approve });
    setBusy(""); if (r.success) reload(); else alert(r.error || "失敗");
  };
  const pending = b.requests.filter(q => q.status === "待核准");
  const waiting = b.requests.filter(q => /待對方|開放/.test(q.status));
  const done = b.requests.filter(q => !/待|開放/.test(q.status)).slice(0, 10);
  const Row = ({ q, children }) => (
    <div style={{ padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
      <div style={{ fontSize:13.5 }}><b style={{ fontWeight:600 }}>{md(q.date)}({WD[wd(q.date)]})</b> {shortLoc(q.loc)} {q.start}–{q.end}
        <span style={{ marginLeft:6, fontSize:11, background:C.warm, borderRadius:8, padding:"1px 7px", color:C.muted }}>{KIND[q.kind]}</span></div>
      <div style={{ fontSize:12, color:C.muted, marginTop:3 }}>{q.kind === "open" ? "空班" : q.fromName} → {q.toName || "(等人認領)"}{q.note ? `・${q.note}` : ""}{q.by ? `・${q.status}(${q.by})` : ""}</div>
      {children}
    </div>
  );
  return (
    <>
      <div style={s.card}>
        <div style={s.sectionTitle}>待核准</div>
        {!pending.length && <div style={{ fontSize:13, color:C.muted }}>沒有待核准的申請</div>}
        {pending.map(q => <Row key={q.id} q={q}>
          <div style={{ display:"flex", gap:8, marginTop:8 }}>
            <button disabled={busy === q.id} onClick={() => act(q, false)} style={{ ...s.btn("ghost"), padding:"8px" }}>駁回</button>
            <button disabled={busy === q.id} onClick={() => act(q, true)} style={{ ...s.btn("primary"), padding:"8px" }}>{busy === q.id ? "處理中…" : "核准"}</button>
          </div>
        </Row>)}
      </div>
      <button onClick={() => setForm({ loc:managed[0], date:today, start:"10:00", end:"20:00", count:1, note:"" })} style={{ ...s.btn("primary"), marginBottom:12 }}>＋ 開放空班給夥伴認領</button>
      {waiting.length > 0 && <div style={s.card}><div style={s.sectionTitle}>等待中</div>{waiting.map(q => <Row key={q.id} q={q}/>)}</div>}
      {done.length > 0 && <div style={s.card}><div style={s.sectionTitle}>最近處理</div>{done.map(q => <Row key={q.id} q={q}/>)}</div>}
      {form && (
        <Sheet C={C} title="開放空班" onClose={() => setForm(null)}>
          <label style={s.label}>櫃位</label>
          <select value={form.loc} onChange={e => setForm({ ...form, loc:e.target.value })} style={{ ...s.input, marginBottom:10 }}>{managed.map(l => <option key={l}>{l}</option>)}</select>
          <label style={s.label}>日期</label>
          <input type="date" value={form.date} onChange={e => setForm({ ...form, date:e.target.value })} style={{ ...s.input, marginBottom:10 }}/>
          <div style={{ display:"flex", gap:8, marginBottom:10 }}>
            <input type="time" value={form.start} onChange={e => setForm({ ...form, start:e.target.value })} style={s.input}/>
            <input type="time" value={form.end} onChange={e => setForm({ ...form, end:e.target.value })} style={s.input}/>
            <select value={form.count} onChange={e => setForm({ ...form, count:e.target.value })} style={{ ...s.input, width:90 }}>{[1,2,3].map(n => <option key={n} value={n}>{n} 人</option>)}</select>
          </div>
          <input value={form.note} onChange={e => setForm({ ...form, note:e.target.value })} placeholder="備註(選填)" style={{ ...s.input, marginBottom:14 }}/>
          <button onClick={async () => { const r = await apiPost({ action:"schOpenShift", managerId:user.id, ...form }); if (r.success) { setForm(null); reload(); } else alert(r.error); }} style={s.btn("primary")}>開放認領</button>
        </Sheet>
      )}
    </>
  );
}

// ── 排班 vs 打卡對帳 ──
// v1.20:待確認（影響薪資）— 新工時規則:加班要核准、無打卡要確認出勤或缺勤、沒排班有打卡要核准
const PAY_BTN = { "加班":[["核准","核准"],["不核准","不算"]], "無打卡":[["出勤","確認出勤"],["缺勤","缺勤"]], "臨時支援":[["核准","核准"],["不核准","不算"]] };
const PAY_TIP = { "加班":"下班打卡比排班晚，往前取整點／半點；核准後才算加班", "無打卡":"有排班但沒打卡，目前先依排班時數計", "臨時支援":"沒排班但有打卡，核准後依實際打卡計" };
function PayPending({ user, ym, apiGet, apiPost, C, s }) {
  const [d, setD] = useState(null);
  const [hrs, setHrs] = useState({});
  const [busy, setBusy] = useState("");
  const load = () => apiGet({ action:"payRecon", empId:user.id, ym }, 1).then(r => setD(r && r.success ? r : { error:(r && r.error) || "" }));
  useEffect(() => { setD(null); load(); }, [ym]);
  if (!d) return <div style={{ ...s.card, textAlign:"center", color:C.muted, fontSize:13 }}>讀取待確認…</div>;
  if (d.error !== undefined) return /未知的動作/.test(d.error) || !d.error ? null : <div style={{ ...s.card, color:C.red, fontSize:13 }}>{d.error}</div>;
  if (!d.newRule) return <div style={{ ...s.card, fontSize:12.5, color:C.muted }}>這個月薪資依實際打卡計算。{d.ruleStart} 起改用新工時規則（早到不算、遲到早退 15 分鐘內不扣、加班要核准），到時這裡會列出要確認的項目。</div>;
  const decide = async (x, result) => {
    setBusy(x.key);
    const r = await apiPost({ action:"payDecide", empId:user.id, key:x.key, result, hours: hrs[x.key] ?? x.suggest }, 0);
    setBusy(""); if (r && r.success) load(); else alert((r && r.error) || "失敗");
  };
  const undo = async x => { if (!confirm("撤銷這筆確認？")) return; const r = await apiPost({ action:"payUndo", empId:user.id, key:x.key }, 0); if (r && r.success) load(); else alert(r && r.error); };
  return (
    <div style={{ ...s.card, borderLeft: d.pending.length ? `4px solid ${C.gold}` : undefined }}>
      <div style={s.sectionTitle}>待確認（影響薪資）{d.pending.length ? ` ${d.pending.length}` : ""}</div>
      {!d.pending.length && <div style={{ fontSize:13, color:C.green }}>✓ 沒有待確認的項目</div>}
      {d.pending.map(x => (
        <div key={x.key} style={{ padding:"9px 0", borderBottom:`1px solid ${C.border}`, opacity: busy === x.key ? .5 : 1 }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
            <b style={{ fontWeight:600 }}>{md(x.date)} {x.name}</b>
            <span style={{ fontSize:11.5, color:"#fff", background: x.type === "無打卡" ? C.red : C.gold, borderRadius:8, padding:"1px 8px" }}>{x.type}</span>
          </div>
          <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{shortLoc(x.loc)}・排 {x.plan}{x.planH ? `（${x.planH}h）` : ""}・實際 {x.actual}</div>
          <div style={{ fontSize:11.5, color:C.light, marginTop:2 }}>{PAY_TIP[x.type]}</div>
          <div style={{ display:"flex", gap:6, alignItems:"center", marginTop:8 }}>
            {x.type === "加班" && <select value={hrs[x.key] ?? x.suggest} onChange={e => setHrs({ ...hrs, [x.key]: +e.target.value })} style={{ ...s.input, width:96, padding:"7px" }}>
              {Array.from({ length: Math.max(1, Math.round(Math.min(8, Math.max(x.suggest, 0.5)) * 2)) }, (_, i) => (i + 1) / 2).map(h => <option key={h} value={h}>{h} 小時</option>)}
            </select>}
            {PAY_BTN[x.type].map(([v, label], i) => (
              <button key={v} disabled={!!busy} onClick={() => decide(x, v)} style={{ ...s.btn(i ? "ghost" : "primary"), width:"auto", padding:"7px 12px", fontSize:12.5, color: i ? C.red : undefined }}>{label}</button>
            ))}
          </div>
        </div>
      ))}
      {d.done.length > 0 && <details style={{ marginTop:10 }}>
        <summary style={{ fontSize:12.5, color:C.muted, cursor:"pointer" }}>已確認 {d.done.length} 筆</summary>
        {d.done.map(x => (
          <div key={x.key} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 0", borderBottom:`1px solid ${C.border}`, fontSize:12.5 }}>
            <span style={{ flex:1 }}>{md(x.date)} {x.name}・{x.type}：<b style={{ fontWeight:600 }}>{x.result}{x.type === "加班" && x.result === "核准" ? ` ${x.hours}h` : ""}</b><div style={{ fontSize:11, color:C.light }}>{x.by}</div></span>
            <button onClick={() => undo(x)} style={{ border:"none", background:"none", color:C.muted, fontSize:12, cursor:"pointer" }}>撤銷</button>
          </div>
        ))}
      </details>}
    </div>
  );
}
function RecView({ user, ym, apiGet, apiPost, C, s }) {
  const [d, setD] = useState(null);
  useEffect(() => { setD(null); apiGet({ action:"schReconcile", empId:user.id, ym }).then(setD); }, [ym]);
  if (!d) return <><PayPending {...{ user, ym, apiGet, apiPost, C, s }}/><div style={{ ...s.card, textAlign:"center", color:C.muted, fontSize:13 }}>對帳中…</div></>;
  if (!d.success) return <div style={{ ...s.card, color:C.red, fontSize:13 }}>{d.error}</div>;
  const m = d.summary;
  return (
    <>
      <PayPending {...{ user, ym, apiGet, apiPost, C, s }}/>
      <div style={s.card}>
        <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>到昨天為止・下面是排班與打卡的差異(遲到、早退、未打卡),供參考</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
          <Stat C={C} label="排班時數" value={m.planH} sub={`${m.shifts} 個班`}/>
          <Stat C={C} label="實際時數" value={m.realH} sub="依打卡"/>
          <Stat C={C} label="正常" value={m.ok} sub={`/ ${m.shifts}`} ok={m.ok === m.shifts}/>
        </div>
        <div style={{ display:"flex", gap:12, fontSize:12, color:C.muted, marginTop:10, flexWrap:"wrap" }}>
          <span>未打卡 {m.missing}</span><span>遲到 {m.late}</span><span>早退 {m.early}</span><span>沒排班有打卡 {m.unplanned}</span>
        </div>
      </div>
      <div style={s.card}>
        <div style={s.sectionTitle}>需要確認</div>
        {!d.rows.length && <div style={{ fontSize:13, color:C.green }}>✓ 全部吻合</div>}
        {d.rows.map((r, i) => (
          <div key={i} style={{ padding:"8px 0", borderBottom:`1px solid ${C.border}`, fontSize:13 }}>
            <div style={{ display:"flex", justifyContent:"space-between" }}><b style={{ fontWeight:600 }}>{md(r.date)} {r.name}</b><span style={{ color:C.red, fontSize:12 }}>{r.issue}</span></div>
            <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{shortLoc(r.loc)}・排 {r.plan}({r.planH}h)・實際 {r.realH}h</div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── 班型設定 ──
function TemplateEditor({ b, user, apiPost, managed, onClose, onSaved, C, s }) {
  const [loc, setLoc] = useState(managed[0] || "");
  const [list, setList] = useState(b.templates[managed[0]] || []);
  const [busy, setBusy] = useState(false);
  useEffect(() => setList((b.templates[loc] || []).map(x => ({ ...x }))), [loc]);
  const up = (i, k, v) => setList(list.map((x, j) => j === i ? { ...x, [k]:v } : x));
  return (
    <Sheet C={C} title="各櫃位上班時間（班型）" onClose={onClose}>
      <div style={{ fontSize:12, color:C.muted, marginBottom:10, lineHeight:1.6 }}>「平日」「假日」各設一個班型，排班時會自動帶入；分隊長可以改自己負責的櫃位。</div>
      <select value={loc} onChange={e => setLoc(e.target.value)} style={{ ...s.input, marginBottom:12 }}>{managed.map(l => <option key={l}>{l}</option>)}</select>
      {list.map((t, i) => (
        <div key={i} style={{ background:C.warm, borderRadius:12, padding:10, marginBottom:8 }}>
          <div style={{ display:"flex", gap:6, marginBottom:6 }}>
            <input value={t.name} onChange={e => up(i, "name", e.target.value)} placeholder="名稱" style={{ ...s.input, padding:"8px 10px", flex:1 }}/>
            <select value={t.apply} onChange={e => up(i, "apply", e.target.value)} style={{ ...s.input, padding:"8px", width:80 }}>{["全部","平日","假日"].map(x => <option key={x}>{x}</option>)}</select>
            <button onClick={() => setList(list.filter((_, j) => j !== i))} style={{ ...navBtn(C), color:C.red }}>×</button>
          </div>
          <div style={{ display:"flex", gap:6 }}>
            <input type="time" value={t.start} onChange={e => up(i, "start", e.target.value)} style={{ ...s.input, padding:"8px" }}/>
            <input type="time" value={t.end} onChange={e => up(i, "end", e.target.value)} style={{ ...s.input, padding:"8px" }}/>
            <select value={t.count} onChange={e => up(i, "count", +e.target.value)} style={{ ...s.input, padding:"8px", width:80 }}>{[1,2,3,4].map(n => <option key={n} value={n}>{n} 人</option>)}</select>
          </div>
        </div>
      ))}
      <button onClick={() => setList(list.concat([{ name:"新班型", start:"10:00", end:"20:00", apply:"全部", count:1 }]))} style={{ ...s.btn("ghost"), marginBottom:10 }}>＋ 新增班型</button>
      <button disabled={busy} onClick={async () => { setBusy(true); const r = await apiPost({ action:"schSaveTemplates", managerId:user.id, loc, list }); setBusy(false); if (r.success) { onSaved(); onClose(); } else alert(r.error); }} style={s.btn("primary")}>{busy ? "儲存中…" : "儲存"}</button>
    </Sheet>
  );
}

// ═══════════════════════════════════════════════
// 夥伴:我的班表
// ═══════════════════════════════════════════════
export function MyShifts({ user, apiGet, apiPost, C, s, todayStr }) {
  const today = todayStr();
  const [d, setD] = useState(null);
  const [tab, setTab] = useState("list");
  const [act, setAct] = useState(null);       // 換班 sheet:{shift}
  const load = async () => { const r = await apiGet({ action:"schMine", empId:user.id }); setD(r); };
  useEffect(() => { load(); }, []);
  useForeground(load);
  if (!d) return <div style={{ ...s.card, textAlign:"center", color:C.muted, fontSize:13 }}>載入中…</div>;
  if (!d.success) return <div style={{ ...s.card, color:C.red, fontSize:13 }}>{d.error}</div>;
  const call = async (p) => { const r = await apiPost({ empId:user.id, ...p }); if (r.success) load(); else alert(r.error || "失敗"); return r; };
  const target = d.me.student ? d.params.studentHours : d.params.monthHours;
  const up = d.shifts.filter(x => x.date >= today).sort((a, c) => a.date < c.date ? -1 : 1);
  const reqOf = id => d.myReqs.find(q => q.shiftId === id && /待|開放/.test(q.status));
  const nextYm = addMonth(today.slice(0, 7), 1), deadline = +d.params.availDeadline;
  const late = +today.slice(8) > deadline && !d.avail;

  return (
    <>
      <div style={s.card}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
          <Stat C={C} label="本月排班" value={d.stats.cur.hours} sub={`/ ${target}h`} ok={d.stats.cur.hours >= target}/>
          <Stat C={C} label="假日" value={d.stats.cur.holidayDays} sub={`/ ${d.params.holidayDays} 天`} ok={d.stats.cur.holidayDays >= d.params.holidayDays}/>
          <Stat C={C} label="預估工資" value={money(d.stats.cur.wage)} sub="實際依打卡"/>
        </div>
      </div>
      {!d.avail && <div style={{ ...s.card, background: late ? C.redBg : C.goldBg, fontSize:13, color: late ? C.red : C.gold }}>
        {+nextYm.slice(5)} 月空檔還沒填{late ? `,已過 ${deadline} 號截止,請盡快填寫` : `,請在 ${deadline} 號前填好`} →
        <button onClick={() => setTab("avail")} style={{ border:"none", background:"none", color:"inherit", fontWeight:600, textDecoration:"underline", cursor:"pointer", fontFamily:"inherit" }}>填空檔</button>
      </div>}
      <div style={{ marginBottom:12, display:"flex", gap:8, alignItems:"center" }}>
        <div style={{ flex:1 }}><Seg C={C} value={tab} onChange={setTab} items={[["list","我的班"],["swap","換班",d.incoming.length + d.open.length || null],["avail","填空檔"]]}/></div>
        <button onClick={load} title="重新整理" style={navBtn(C)}>↻</button>
      </div>

      {tab === "list" && <div style={s.card}>
        {!up.length && <div style={{ fontSize:13, color:C.muted }}>目前沒有排班</div>}
        {up.map(x => {
          const q = reqOf(x.id);
          return (
            <div key={x.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
              <div style={{ width:42, textAlign:"center" }}>
                <div style={{ fontSize:16, fontWeight:600, color: isHol(x.date, d.holidays) ? C.accent : C.text }}>{md(x.date)}</div>
                <div style={{ fontSize:11, color:C.muted }}>{x.date === today ? "今天" : WD[wd(x.date)]}</div>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14 }}>{shortLoc(x.loc)} <span style={{ color:C.muted, fontSize:12.5 }}>{x.start}–{x.end}</span></div>
                <div style={{ fontSize:11.5, color:C.muted }}>{x.mates.length ? "搭班:" + x.mates.join("、") : "單人班"}{q ? `・${q.status}` : ""}</div>
              </div>
              {!q && x.date > today && <button onClick={() => setAct(x)} style={{ ...s.btn("ghost"), width:"auto", padding:"6px 12px", fontSize:12 }}>換班</button>}
              {q && q.fromId === user.id && <button onClick={() => call({ action:"schRespond", reqId:q.id, act:"cancel" })} style={{ ...s.btn("ghost"), width:"auto", padding:"6px 12px", fontSize:12 }}>取消申請</button>}
            </div>
          );
        })}
      </div>}

      {tab === "swap" && <>
        {d.incoming.length > 0 && <div style={s.card}>
          <div style={s.sectionTitle}>請你接班</div>
          {d.incoming.map(q => (
            <div key={q.id} style={{ padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
              <div style={{ fontSize:13.5 }}>{q.fromName} 想把 <b style={{ fontWeight:600 }}>{md(q.date)}({WD[wd(q.date)]}){shortLoc(q.loc)} {q.start}–{q.end}</b> 給你</div>
              {q.note && <div style={{ fontSize:12, color:C.muted }}>{q.note}</div>}
              <div style={{ display:"flex", gap:8, marginTop:8 }}>
                <button onClick={() => call({ action:"schRespond", reqId:q.id, act:"decline" })} style={{ ...s.btn("ghost"), padding:8 }}>婉拒</button>
                <button onClick={() => call({ action:"schRespond", reqId:q.id, act:"accept" })} style={{ ...s.btn("primary"), padding:8 }}>同意接班</button>
              </div>
            </div>
          ))}
          <div style={{ fontSize:11.5, color:C.muted, marginTop:8 }}>同意後還需要分隊長核准才會生效</div>
        </div>}
        <div style={s.card}>
          <div style={s.sectionTitle}>可認領的班</div>
          {!d.open.length && <div style={{ fontSize:13, color:C.muted }}>目前沒有空班</div>}
          {d.open.map(q => {
            const busy = d.shifts.find(x => x.date === q.date);
            return (
              <div key={q.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13.5 }}>{md(q.date)}({WD[wd(q.date)]}){shortLoc(q.loc)} <span style={{ color:C.muted }}>{q.start}–{q.end}</span>{isHol(q.date, d.holidays) && <span style={{ color:C.accent, fontSize:11.5 }}> 假日</span>}</div>
                  <div style={{ fontSize:11.5, color:C.muted }}>{q.kind === "open" ? "分隊長開放" : q.fromName + " 釋出"}{busy ? `・你當天已排 ${shortLoc(busy.loc)}` : ""}</div>
                </div>
                <button disabled={!!busy} onClick={() => call({ action:"schRespond", reqId:q.id, act:"claim" })}
                  style={{ ...s.btn("primary"), width:"auto", padding:"7px 14px", fontSize:12.5, opacity: busy ? .4 : 1 }}>認領</button>
              </div>
            );
          })}
        </div>
        {d.myReqs.length > 0 && <div style={s.card}>
          <div style={s.sectionTitle}>我的申請</div>
          {d.myReqs.map(q => <div key={q.id} style={{ fontSize:12.5, padding:"7px 0", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between" }}>
            <span>{md(q.date)} {shortLoc(q.loc)} {q.start}–{q.end}</span><span style={{ color: q.status === "已核准" ? C.green : /駁回|婉拒/.test(q.status) ? C.red : C.gold }}>{q.status}</span></div>)}
        </div>}
      </>}

      {tab === "avail" && <AvailEditor {...{ d, user, apiPost, apiGet, reload:load, C, s, today }}/>}

      {act && (
        <SwapSheet {...{ C, s, d, shift:act, onClose:() => setAct(null), submit: async p => { const r = await call({ action:"schRequest", shiftId:act.id, ...p }); if (r.success) setAct(null); } }}/>
      )}
    </>
  );
}
function SwapSheet({ C, s, d, shift, onClose, submit }) {
  const [mode, setMode] = useState("release"), [to, setTo] = useState(""), [note, setNote] = useState("");
  return (
    <Sheet C={C} onClose={onClose} title={`換班:${md(shift.date)} ${shortLoc(shift.loc)} ${shift.start}–${shift.end}`}>
      <Seg C={C} value={mode} onChange={setMode} items={[["release","釋出給大家"],["give","轉讓給指定夥伴"]]}/>
      <div style={{ fontSize:12, color:C.muted, margin:"10px 0" }}>
        {mode === "release" ? "所有夥伴都看得到,有人認領後由分隊長核准。核准前這個班仍是你的。" : "對方同意後,再由分隊長核准。核准前這個班仍是你的。"}
      </div>
      {mode === "give" && <select value={to} onChange={e => setTo(e.target.value)} style={{ ...s.input, marginBottom:10 }}>
        <option value="">選擇夥伴</option>{d.staff.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>}
      <input value={note} onChange={e => setNote(e.target.value)} placeholder="原因(選填)" style={{ ...s.input, marginBottom:14 }}/>
      <button disabled={mode === "give" && !to} onClick={() => submit({ kind:mode, toId:to, note })} style={{ ...s.btn("primary"), opacity: mode === "give" && !to ? .5 : 1 }}>送出</button>
    </Sheet>
  );
}
// 填空檔:點一下「可」、再點「休」、再點清除
function AvailEditor({ d, user, apiPost, apiGet, reload, C, s, today }) {
  const ym = d.availYm;
  const [days, setDays] = useState(d.avail?.days || {});
  const [hope, setHope] = useState(d.avail?.hope || "");
  const [note, setNote] = useState(d.avail?.note || "");
  const [busy, setBusy] = useState(false), [saved, setSaved] = useState(false);
  const list = daysOf(ym), lead = wd(list[0]);
  const cycle = x => { const v = days[x]; const n = { ...days }; if (!v) n[x] = "ok"; else if (v === "ok") n[x] = "off"; else delete n[x]; setDays(n); setSaved(false); };
  const all = v => { const n = {}; list.forEach(x => { if (v) n[x] = v; }); setDays(n); setSaved(false); };
  const cnt = Object.values(days).filter(v => v === "ok").length, off = Object.values(days).filter(v => v === "off").length;
  return (
    <div style={s.card}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:4 }}>
        <div style={{ fontSize:15, fontWeight:600 }}>{+ym.slice(5)} 月空檔</div>
        <div style={{ fontSize:12, color:C.muted }}>可上班 {cnt} 天・想休 {off} 天</div>
      </div>
      <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>點一下=可上班,再點=想休,再點=清除</div>
      <div style={{ display:"flex", gap:6, marginBottom:10 }}>
        <button onClick={() => all("ok")} style={chip(C, false)}>全部可上班</button>
        <button onClick={() => all("")} style={chip(C, false)}>清除</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:4 }}>
        {WD.map((w, i) => <div key={w} style={{ textAlign:"center", fontSize:11, color: i === 0 || i === 6 ? C.accent : C.muted }}>{w}</div>)}
        {Array.from({ length: lead }).map((_, i) => <div key={"e" + i}/>)}
        {list.map(x => {
          const v = days[x], h = isHol(x, d.holidays);
          return <button key={x} onClick={() => cycle(x)} style={{ height:44, borderRadius:10, fontFamily:"inherit", cursor:"pointer", fontSize:13,
            border:`1px solid ${v === "ok" ? C.green : v === "off" ? C.borderDark : C.border}`,
            background: v === "ok" ? C.greenBg : v === "off" ? C.warm : C.card, color: h ? C.accent : C.text, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
            {+x.slice(8)}<span style={{ fontSize:10, color: v === "ok" ? C.green : C.muted }}>{v === "ok" ? "可" : v === "off" ? "休" : ""}</span>
          </button>;
        })}
      </div>
      <div style={{ display:"flex", gap:8, marginTop:12 }}>
        <input type="number" value={hope} onChange={e => { setHope(e.target.value); setSaved(false); }} placeholder="希望時數" style={{ ...s.input, width:110 }}/>
        <input value={note} onChange={e => { setNote(e.target.value); setSaved(false); }} placeholder="備註(例:週三下課後才能上)" style={s.input}/>
      </div>
      <button disabled={busy} onClick={async () => { setBusy(true); const r = await apiPost({ action:"schSetAvail", empId:user.id, ym, days, hope, note }); setBusy(false); if (r.success) { setSaved(true); reload(); } else alert(r.error); }}
        style={{ ...s.btn("primary"), marginTop:12 }}>{busy ? "儲存中…" : saved ? "✓ 已儲存" : "儲存空檔"}</button>
    </div>
  );
}
