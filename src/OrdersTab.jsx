// ─────────────────────────────────────────────
// 訂單系統(各櫃位:自取／外送)
// 清單 → 點開看詳情、換狀態 → 修改;「＋新增訂單」表單。所有夥伴都能建單、改單,金額欄位也都能填。
// 後端:getOrders / saveOrder / setOrderStatus
// ─────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { Flash } from "./TopToast.jsx";

const STATUS = ["新訂單", "製作中", "已完成", "已交付"];
const NEXT = { "新訂單": "開始製作", "製作中": "製作完成", "已完成": "已交付客人" };
const PAYS = ["未付款", "已付訂金", "已付清"];
const addDays = (d, n) => { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
const nowHM = () => new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit" });
const toMin = hm => { const m = /^(\d{2}):(\d{2})$/.exec(hm || ""); return m ? +m[1] * 60 + +m[2] : null; };
const fromMin = n => { n = ((n % 1440) + 1440) % 1440; return String(Math.floor(n / 60)).padStart(2, "0") + ":" + String(n % 60).padStart(2, "0"); };
const fmtMoney = n => "$" + Number(n || 0).toLocaleString();
const weekday = d => "日一二三四五六"[new Date(d + "T00:00:00Z").getUTCDay()];
const itemsText = o => [...(o.items || []).map(i => `${i.name}×${i.qty}`), o.extra].filter(Boolean).join("、");

// 最晚開始製作時間(取貨/送達時間 − 預計製作分鐘;外送以外送時間為準)
const startBy = o => { const t = toMin(o.method === "外送" && o.sendTime ? o.sendTime : o.time); return t == null ? null : fromMin(t - (o.prep || 0)); };

const blank = (loc, date) => ({
  loc, date, time: "", prep: 30, items: [{ name: "", qty: 1 }], extra: "", method: "自取", place: "", sendTime: "", sendBy: "自己送", carrier: "",
  cname: "", phone: "", taxId: "", notes: "", total: "", deposit: "", pay: "未付款",
});

export default function OrdersTab({ user, apiGet, apiPost, locations, defaultLoc, todayStr, C, s, alerts }) {
  const today = todayStr();
  const locNames = useMemo(() => {
    const all = Object.keys(locations || {});
    const open = all.filter(n => !locations[n].status || /營運/.test(locations[n].status));
    return (open.length ? open : all);
  }, [locations]);
  const [view, setView] = useState("list");      // list | form | detail
  const [date, setDate] = useState(today);
  const [locF, setLocF] = useState(locations && locations[defaultLoc] ? defaultLoc : "");   // "" = 全部櫃位
  const [showDone, setShowDone] = useState(false);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [sel, setSel] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [tick, setTick] = useState(0);

  const load = async () => {
    setErr("");
    const r = await apiGet({ action: "getOrders", empId: user.id, from: addDays(today, -1), to: addDays(today, 30) }, 1);
    if (r && r.success) setOrders(r.data || []);
    else setErr((r && r.error) || "訂單功能尚未開通或連線失敗");
    setLoading(false);
  };
  useEffect(() => { load(); const t = setInterval(() => { load(); setTick(x => x + 1); }, 60 * 1000); return () => clearInterval(t); }, []);

  const shown = orders.filter(o => o.date === date && (!locF || o.loc === locF) && (showDone || (o.status !== "已交付" && o.status !== "已取消")));
  const overdueOpen = orders.filter(o => o.date < today && ["新訂單", "製作中", "已完成"].includes(o.status) && (!locF || o.loc === locF));
  const counts = d => orders.filter(o => o.date === d && (!locF || o.loc === locF) && o.status !== "已取消" && o.status !== "已交付").length;

  const urgent = o => {
    if (o.date !== today || !["新訂單", "製作中"].includes(o.status)) return false;
    const sb = toMin(startBy(o)), n = toMin(nowHM()); return sb != null && n != null && n >= sb;
  };

  const setStatus = async (o, st) => {
    setSaving(true);
    const r = await apiPost({ action: "setOrderStatus", empId: user.id, id: o.id, status: st }, 0);
    setSaving(false);
    if (r && r.success) { setOrders(l => l.map(x => x.id === o.id ? { ...x, status: st } : x)); setSel(x => x && { ...x, status: st }); setMsg(""); load(); alerts && alerts.refresh(); }
    else setMsg((r && r.error) || "更新失敗，請再試一次");
  };

  const openNew = () => { setForm(blank(locF || defaultLoc || locNames[0] || "", date)); setView("form"); setMsg(""); };
  const openEdit = o => { setForm({ ...blank(o.loc, o.date), ...o, items: o.items && o.items.length ? o.items : [{ name: "", qty: 1 }], total: o.total || "", deposit: o.deposit || "" }); setView("form"); setMsg(""); };

  const submit = async () => {
    const f = form;
    if (!f.loc) return setMsg("請選擇櫃位");
    if (!f.time) return setMsg("請填取貨／送達時間");
    if (!f.items.some(i => i.name.trim()) && !f.extra.trim()) return setMsg("請填寫訂單內容");
    if (!f.cname.trim()) return setMsg("請填客戶姓名");
    if (f.taxId && !/^\d{8}$/.test(f.taxId)) return setMsg("統編需為 8 碼數字");
    if (f.method === "外送" && (!f.place.trim() || !f.sendTime)) return setMsg("外送請填地址與外送時間");
    setSaving(true); setMsg("");
    const r = await apiPost({ action: "saveOrder", empId: user.id, order: JSON.stringify({ ...f, items: f.items.filter(i => i.name.trim()) }) }, 0);
    setSaving(false);
    if (r && r.success) { setDate(r.data.date); await load(); setSel(r.data); setView("detail"); alerts && alerts.refresh(); }
    else setMsg((r && r.error) || "儲存失敗，請再試一次");
  };

  const F = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const lbl = (t, req) => <label style={s.label}>{t}{req && <span style={{ color: C.red }}> *</span>}</label>;
  const Seg = ({ val, opts, onPick }) => (
    <div style={{ display: "flex", background: C.card, border: `1px solid ${C.border}`, borderRadius: 999, padding: 3 }}>
      {opts.map(o => <button key={o} type="button" onClick={() => onPick(o)} style={{ flex: 1, padding: "8px 0", border: "none", borderRadius: 999, cursor: "pointer", fontFamily: "inherit",
        fontSize: 13.5, background: val === o ? C.text : "transparent", color: val === o ? "#fff" : C.muted }}>{o}</button>)}
    </div>
  );
  const Chip = ({ on, children, onClick }) => (
    <button onClick={onClick} style={{ border: `1px solid ${on ? C.accent : C.border}`, background: on ? C.accentBg : C.card, color: on ? C.accent : C.muted,
      borderRadius: 999, padding: "5px 12px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{children}</button>
  );
  const statusColor = st => st === "已完成" ? C.green : st === "製作中" ? C.gold : st === "已取消" ? C.light : st === "已交付" ? C.muted : C.accent;
  const Badge = ({ t, c }) => <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: c + "1f", color: c, fontWeight: 600, whiteSpace: "nowrap" }}>{t}</span>;

  // ───────── 表單 ─────────
  if (view === "form" && form) {
    const itemOpts = (locations[form.loc] && locations[form.loc].items) || ["雞蛋糕"];
    const sb = form.time ? startBy({ ...form, prep: Number(form.prep) || 0 }) : null;
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <button onClick={() => setView(sel && form.id ? "detail" : "list")} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontFamily: "inherit", fontSize: 14 }}>‹ 取消</button>
          <div style={{ fontSize: 15, fontWeight: 600 }}>{form.id ? "修改訂單" : "新增訂單"}</div><span style={{ width: 40 }} />
        </div>
        <Flash text={msg} />{msg && <div style={{ ...s.card, background: C.redBg, color: C.red, fontSize: 13, padding: "10px 14px" }}>{msg}</div>}

        <div style={s.card}>
          <div style={{ marginBottom: 12 }}>{lbl("櫃位", 1)}
            <select value={form.loc} onChange={e => F("loc", e.target.value)} style={s.input}>
              {locNames.map(n => <option key={n} value={n}>{n}</option>)}</select></div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>{lbl("日期", 1)}<input type="date" value={form.date} onChange={e => F("date", e.target.value)} style={s.input} /></div>
            <div style={{ flex: 1 }}>{lbl("取貨／送達時間", 1)}<input type="time" value={form.time} onChange={e => F("time", e.target.value)} style={s.input} /></div>
          </div>
          <div style={{ marginTop: 12 }}>{lbl("預計製作時間(分鐘)")}
            <input type="number" inputMode="numeric" min="0" value={form.prep} onChange={e => F("prep", e.target.value)} style={s.input} />
            {sb && <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>最晚 <b style={{ color: C.accent }}>{sb}</b> 要開始製作</div>}</div>
        </div>

        <div style={s.card}>
          <div style={s.sectionTitle}>訂單內容 <span style={{ color: C.red }}>*</span></div>
          {form.items.map((it, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input list={"od-items"} value={it.name} placeholder="品項" onChange={e => F("items", form.items.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} style={{ ...s.input, flex: 1 }} />
              <input type="number" inputMode="numeric" min="1" value={it.qty} onChange={e => F("items", form.items.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))} style={{ ...s.input, width: 72 }} />
              {form.items.length > 1 && <button onClick={() => F("items", form.items.filter((_, j) => j !== i))} aria-label="刪除此列" style={{ border: "none", background: "none", color: C.light, fontSize: 20, cursor: "pointer" }}>×</button>}
            </div>))}
          <datalist id="od-items">{itemOpts.map(n => <option key={n} value={n} />)}</datalist>
          <button onClick={() => F("items", [...form.items, { name: "", qty: 1 }])} style={{ ...s.btn("secondary"), padding: "9px", fontSize: 13, marginBottom: 10 }}>＋ 新增品項</button>
          {lbl("其他內容(口味備註、客製等)")}
          <textarea value={form.extra} onChange={e => F("extra", e.target.value)} rows={2} style={{ ...s.input, resize: "vertical" }} />
        </div>

        <div style={s.card}>
          <div style={s.sectionTitle}>取貨方式</div>
          <Seg val={form.method} opts={["自取", "外送"]} onPick={v => F("method", v)} />
          <div style={{ marginTop: 12 }}>{lbl(form.method === "外送" ? "外送地址" : "自取地點(可留空,預設為櫃位)", form.method === "外送")}
            <input value={form.place} onChange={e => F("place", e.target.value)} style={s.input} /></div>
          {form.method === "外送" && <>
            <div style={{ marginTop: 12 }}>{lbl("外送時間", 1)}<input type="time" value={form.sendTime} onChange={e => F("sendTime", e.target.value)} style={s.input} /></div>
            <div style={{ marginTop: 12 }}>{lbl("外送方式")}<Seg val={form.sendBy} opts={["自己送", "外送平台"]} onPick={v => F("sendBy", v)} /></div>
            <div style={{ marginTop: 12 }}>{lbl(form.sendBy === "外送平台" ? "外送平台名稱" : "外送人員")}
              <input value={form.carrier} onChange={e => F("carrier", e.target.value)} style={s.input} /></div></>}
        </div>

        <div style={s.card}>
          <div style={s.sectionTitle}>客戶資料</div>
          <div style={{ marginBottom: 12 }}>{lbl("姓名", 1)}<input value={form.cname} onChange={e => F("cname", e.target.value)} style={s.input} /></div>
          <div style={{ marginBottom: 12 }}>{lbl("電話")}<input type="tel" inputMode="tel" value={form.phone} onChange={e => F("phone", e.target.value)} style={s.input} /></div>
          <div>{lbl("統一編號(要開發票才填)")}<input inputMode="numeric" maxLength={8} value={form.taxId} onChange={e => F("taxId", e.target.value.replace(/\D/g, ""))} style={s.input} /></div>
        </div>

        <div style={s.card}>
          <div style={s.sectionTitle}>注意事項</div>
          <textarea value={form.notes} onChange={e => F("notes", e.target.value)} rows={2} placeholder="過敏、包裝、發票、送達方式…" style={{ ...s.input, resize: "vertical" }} />
        </div>

        <div style={s.card}>
          <div style={s.sectionTitle}>金額與收款</div>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>{lbl("訂單總金額")}<input type="number" inputMode="decimal" min="0" value={form.total} onChange={e => F("total", e.target.value)} style={s.input} /></div>
            <div style={{ flex: 1 }}>{lbl("訂金")}<input type="number" inputMode="decimal" min="0" value={form.deposit} onChange={e => F("deposit", e.target.value)} style={s.input} /></div>
          </div>
          {lbl("付款狀態")}<Seg val={form.pay} opts={PAYS} onPick={v => F("pay", v)} />
        </div>

        <button onClick={submit} disabled={saving} style={{ ...s.btn("primary"), opacity: saving ? .7 : 1 }}>{saving ? "儲存中…" : form.id ? "儲存修改" : "建立訂單"}</button>
      </div>
    );
  }

  // ───────── 詳情 ─────────
  if (view === "detail" && sel) {
    const o = sel, sb = startBy(o), canNext = NEXT[o.status];
    const Row = ({ k, v }) => v ? <div style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13.5 }}>
      <span style={{ color: C.muted, width: 84, flexShrink: 0 }}>{k}</span><span style={{ flex: 1, wordBreak: "break-all", whiteSpace: "pre-wrap" }}>{v}</span></div> : null;
    return (
      <div>
        <button onClick={() => { setView("list"); setMsg(""); }} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontFamily: "inherit", fontSize: 14, marginBottom: 8 }}>‹ 回訂單清單</button>
        <Flash text={msg} />{msg && <div style={{ ...s.card, background: C.redBg, color: C.red, fontSize: 13, padding: "10px 14px" }}>{msg}</div>}
        <div style={s.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 17, fontWeight: 600 }}>{o.date.slice(5)}（{weekday(o.date)}）{o.time}</div>
            <Badge t={o.status} c={statusColor(o.status)} />
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{o.loc} · {o.id}</div>
          {sb && ["新訂單", "製作中"].includes(o.status) && <div style={{ fontSize: 13, marginTop: 8, color: urgent(o) ? C.red : C.accent, fontWeight: 600 }}>最晚 {sb} 要開始製作{urgent(o) ? "（該開始了！）" : ""}</div>}
        </div>
        <div style={s.card}>
          <Row k="訂單內容" v={itemsText(o)} /><Row k="預計製作" v={o.prep ? o.prep + " 分鐘" : ""} />
          <Row k="取貨方式" v={o.method + (o.method === "外送" ? `（${o.sendBy}${o.carrier ? "：" + o.carrier : ""}）` : "")} />
          <Row k={o.method === "外送" ? "外送地址" : "自取地點"} v={o.place || (o.method === "自取" ? o.loc : "")} /><Row k="外送時間" v={o.sendTime} />
          <Row k="客戶" v={o.cname} />
          {o.phone && <div style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13.5 }}>
            <span style={{ color: C.muted, width: 84 }}>電話</span>{/^[\d+\-() ]+$/.test(o.phone) ? <a href={"tel:" + o.phone.replace(/[^\d+]/g, "")} style={{ color: C.accent }}>{o.phone}</a> : <span>{o.phone}</span>}</div>}
          <Row k="統編" v={o.taxId} /><Row k="注意事項" v={o.notes} />
        </div>
        <div style={s.card}>
          <Row k="總金額" v={o.total ? fmtMoney(o.total) : ""} /><Row k="訂金" v={o.deposit ? fmtMoney(o.deposit) : ""} /><Row k="付款狀態" v={o.pay} />
          <div style={{ fontSize: 11.5, color: C.light, marginTop: 10 }}>建單：{o.byName}（{o.created}）<br />最後修改：{o.modName}（{o.modTime}）</div>
        </div>
        {canNext && <button onClick={() => setStatus(o, STATUS[STATUS.indexOf(o.status) + 1])} disabled={saving} style={{ ...s.btn("primary"), marginBottom: 8 }}>{canNext}</button>}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => openEdit(o)} style={s.btn("secondary")}>修改</button>
          {o.status !== "已取消" && o.status !== "已交付" && <button onClick={() => { if (window.confirm("確定要取消這筆訂單嗎？")) setStatus(o, "已取消"); }} style={s.btn("ghost")}>取消訂單</button>}
          {o.status === "已取消" && <button onClick={() => setStatus(o, "新訂單")} style={s.btn("ghost")}>恢復訂單</button>}
        </div>
      </div>
    );
  }

  // ───────── 清單 ─────────
  return (
    <div>
      <button onClick={openNew} style={{ ...s.btn("primary"), marginBottom: 12 }}>＋ 新增訂單</button>

      <div style={{ ...s.card, padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button onClick={() => setDate(addDays(date, -1))} aria-label="前一天" style={{ border: "none", background: "none", fontSize: 22, color: C.muted, cursor: "pointer", padding: "0 10px" }}>‹</button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{date.slice(5).replace("-", "/")}（{weekday(date)}）{date === today ? " 今天" : ""}</div>
            <div style={{ fontSize: 11.5, color: C.muted }}>待處理 {counts(date)} 筆</div>
          </div>
          <button onClick={() => setDate(addDays(date, 1))} aria-label="後一天" style={{ border: "none", background: "none", fontSize: 22, color: C.muted, cursor: "pointer", padding: "0 10px" }}>›</button>
        </div>
        {date !== today && <button onClick={() => setDate(today)} style={{ ...s.btn("ghost"), padding: "6px", fontSize: 12, marginTop: 6 }}>回到今天</button>}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingTop: 10 }}>
          <Chip on={!locF} onClick={() => setLocF("")}>全部櫃位</Chip>
          {locNames.map(n => <Chip key={n} on={locF === n} onClick={() => setLocF(n)}>{n.replace(/^\d+/, "")}</Chip>)}
        </div>
      </div>

      <Flash text={err} />{err && <div style={{ ...s.card, background: C.goldBg, color: C.gold, fontSize: 13 }}>{err}</div>}
      {overdueOpen.length > 0 && <div style={{ ...s.card, background: C.redBg, color: C.red, fontSize: 13, padding: "10px 14px" }}>有 {overdueOpen.length} 筆過期但還沒交付的訂單：{overdueOpen.map(o => o.date.slice(5) + " " + o.cname).join("、")}</div>}

      {loading && <div className="rh-skel" style={{ height: 90, borderRadius: 18 }} />}
      {!loading && shown.length === 0 && !err && <div style={{ ...s.card, textAlign: "center", color: C.muted, fontSize: 13.5, padding: 24 }}>這天沒有訂單</div>}

      {shown.map(o => {
        const sb = startBy(o), late = urgent(o);
        return (
          <button key={o.id} onClick={() => { setSel(o); setView("detail"); setMsg(""); }} style={{ ...s.card, width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: C.text,
            borderLeft: `3px solid ${late ? C.red : statusColor(o.status)}`, opacity: o.status === "已取消" ? .55 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{o.time} <span style={{ fontSize: 12, fontWeight: 400, color: C.muted }}>{o.method}{o.method === "外送" && o.sendTime ? ` ${o.sendTime}` : ""}</span></div>
              <Badge t={o.status} c={statusColor(o.status)} />
            </div>
            <div style={{ fontSize: 13.5, marginTop: 6 }}>{itemsText(o) || "（未填內容）"}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{o.cname}{!locF ? ` · ${(o.loc || "").replace(/^\d+/, "")}` : ""}{o.pay && o.pay !== "未付款" ? ` · ${o.pay}` : ""}</div>
            {sb && ["新訂單", "製作中"].includes(o.status) && <div style={{ fontSize: 12, marginTop: 6, fontWeight: 600, color: late ? C.red : C.accent }}>最晚 {sb} 開始製作{late ? "（該開始了！）" : ""}</div>}
          </button>);
      })}

      <button onClick={() => setShowDone(v => !v)} style={{ ...s.btn("ghost"), fontSize: 12.5, padding: "9px" }}>{showDone ? "隱藏已交付／已取消" : "顯示已交付／已取消"}</button>

      {alerts && (
        <div style={{ ...s.card, marginTop: 16 }}>
          <div style={s.sectionTitle}>訂單提醒設定（這支手機）</div>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginBottom: 10 }}>
            「最晚開始製作」前 15 分鐘與時間到時，App 會震動、響提示音，每頁頂端也會出現提醒列。需要 App 開著（可在背景）才收得到。
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 13.5 }}>提示音</span>
            <button onClick={() => alerts.setSound(!alerts.soundOn)} aria-pressed={alerts.soundOn} style={{ width: 48, height: 28, borderRadius: 14, border: "none", cursor: "pointer", position: "relative",
              background: alerts.soundOn ? C.accent : C.border, transition: "background .15s" }}>
              <span style={{ position: "absolute", top: 3, left: alerts.soundOn ? 23 : 3, width: 22, height: 22, borderRadius: 11, background: "#fff", transition: "left .15s" }} />
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 13.5 }}>系統通知</span>
            {alerts.perm === "granted" ? <span style={{ fontSize: 12.5, color: C.green }}>已開啟</span>
              : alerts.perm === "denied" ? <span style={{ fontSize: 12, color: C.muted }}>已被封鎖，請到手機設定開啟</span>
              : alerts.perm === "unsupported" ? <span style={{ fontSize: 12, color: C.muted }}>此瀏覽器不支援</span>
              : <button onClick={alerts.askPerm} style={{ border: `1px solid ${C.accent}`, background: C.card, color: C.accent, borderRadius: 999, padding: "5px 12px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>開啟</button>}
          </div>
        </div>
      )}
    </div>
  );
}
