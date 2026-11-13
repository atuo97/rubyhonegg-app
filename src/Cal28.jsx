// v1.28 行事曆：公司「紅玉滿行事曆」（全員看，Lv.3 以上編輯）＋大隊長個人行事曆（只有大隊長看得到），與 Google 日曆雙向同步
import { useState, useEffect } from "react";

const CAT_COLOR = { "進撤櫃": "#b9381c", "快閃": "#d68a1a", "活動": "#3f7d4e", "會議": "#3d5a80", "其他": "#8a7e72" };
const WD = ["日", "一", "二", "三", "四", "五", "六"];
const addDays = (d, n) => { const x = new Date(d + "T00:00:00+08:00"); x.setDate(x.getDate() + n); return new Date(x.getTime() + 8 * 3600e3).toISOString().slice(0, 10); };

export function CalendarPage({ user, apiGet, apiPost, C, s, todayStr }) {
  const today = todayStr();
  const [from, setFrom] = useState(today);
  const [d, setD] = useState(null), [edit, setEdit] = useState(null), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false), [show, setShow] = useState("all");
  const to = addDays(from, 41);
  const load = () => { setD(null); apiGet({ action: "calList", from, to }, 1).then(r => setD(r && r.success ? r : { error: (r && r.error) || "讀取失敗", data: [] })); };
  useEffect(() => { load(); }, [from]);
  const save = async () => {
    setBusy(true); const r = await apiPost({ action: "calSave", ...edit }, 0); setBusy(false);
    if (r && r.success) { setMsg("✅ 已儲存，Google 日曆也同步了"); setEdit(null); load(); } else setMsg((r && r.error) || "儲存失敗");
  };
  const del = async () => {
    if (!confirm(`刪除「${edit.title}」？Google 日曆上也會一起刪除。`)) return;
    setBusy(true); const r = await apiPost({ action: "calDel", id: edit.id, src: edit.src }, 0); setBusy(false);
    if (r && r.success) { setMsg("已刪除"); setEdit(null); load(); } else setMsg((r && r.error) || "刪除失敗");
  };
  if (d && d.error) return <div style={{ ...s.card, color: C.muted, textAlign: "center" }}>{/未知/.test(d.error) ? "行事曆還沒開通（後端更新到 v1.28 後就會出現）" : d.error}</div>;
  if (edit) return (
    <div style={s.card}>
      <div style={s.sectionTitle}>{edit.id ? "修改行程" : "新增行程"}</div>
      {d && d.isBoss && !edit.id && <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {[["company", "📅 公司行事曆"], ["personal", "🔒 我的個人行事曆"]].map(([k, l]) => <button key={k} onClick={() => setEdit(e => ({ ...e, src: k }))} style={{ flex: 1, border: `1px solid ${edit.src === k ? C.accent : C.border}`, background: edit.src === k ? C.accentBg : C.card, color: edit.src === k ? C.accent : C.text, borderRadius: 999, padding: "7px 0", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>)}
      </div>}
      <input value={edit.title} onChange={e => setEdit({ ...edit, title: e.target.value })} placeholder="標題，例：華泰名品城快閃進櫃" style={{ ...s.input, marginBottom: 8 }} />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {Object.keys(CAT_COLOR).map(c => <button key={c} onClick={() => setEdit({ ...edit, cat: c })} style={{ border: `1.5px solid ${edit.cat === c ? CAT_COLOR[c] : C.border}`, background: edit.cat === c ? CAT_COLOR[c] : C.card, color: edit.cat === c ? "#fff" : C.text, borderRadius: 999, padding: "5px 12px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>{c}</button>)}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <label style={{ flex: 1, fontSize: 12, color: C.muted }}>開始日<input type="date" value={edit.date} onChange={e => setEdit({ ...edit, date: e.target.value, end: edit.end < e.target.value ? e.target.value : edit.end })} style={s.input} /></label>
        <label style={{ flex: 1, fontSize: 12, color: C.muted }}>結束日<input type="date" value={edit.end} min={edit.date} onChange={e => setEdit({ ...edit, end: e.target.value })} style={s.input} /></label>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
        <label style={{ flex: 1, fontSize: 12, color: C.muted }}>開始時間<input type="time" value={edit.start} onChange={e => setEdit({ ...edit, start: e.target.value })} style={s.input} /></label>
        <label style={{ flex: 1, fontSize: 12, color: C.muted }}>結束時間<input type="time" value={edit.endTime} onChange={e => setEdit({ ...edit, endTime: e.target.value })} style={s.input} /></label>
      </div>
      <div style={{ fontSize: 11.5, color: C.light, marginBottom: 8 }}>時間空白＝整天</div>
      <input value={edit.loc} onChange={e => setEdit({ ...edit, loc: e.target.value })} placeholder="地點（選填）" style={{ ...s.input, marginBottom: 8 }} />
      <textarea value={edit.desc} onChange={e => setEdit({ ...edit, desc: e.target.value })} placeholder="備註（選填）" rows={3} style={{ ...s.input, marginBottom: 10, resize: "vertical" }} />
      <div style={{ display: "flex", gap: 8 }}>
        {edit.id && <button disabled={busy} onClick={del} style={{ ...s.btn("ghost"), flex: 1, color: C.red }}>刪除</button>}
        <button onClick={() => setEdit(null)} style={{ ...s.btn("ghost"), flex: 1 }}>取消</button>
        <button disabled={busy || !edit.title.trim() || !edit.date} onClick={save} style={{ ...s.btn("primary"), flex: 2, opacity: busy || !edit.title.trim() ? .5 : 1 }}>儲存</button>
      </div>
      {msg && <div style={{ fontSize: 13, marginTop: 8, color: C.red }}>{msg}</div>}
    </div>
  );
  const list = (d ? d.data : []).filter(x => show === "all" || x.src === show || x.cat === show);
  const days = {}; list.forEach(x => { for (let k = x.date; k <= x.end && k <= to; k = addDays(k, 1)) { if (k >= from) (days[k] = days[k] || []).push(x); if (Object.keys(days).length > 60) break; } });
  const keys = Object.keys(days).sort();
  return (
    <div>
      <div style={{ ...s.card, display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={() => setFrom(addDays(from, -42))} style={{ border: `1px solid ${C.border}`, background: C.card, borderRadius: 999, width: 34, height: 34, cursor: "pointer" }}>‹</button>
        <div style={{ flex: 1, textAlign: "center", fontSize: 14, fontWeight: 600 }}>{from.slice(5).replace("-", "/")} ～ {to.slice(5).replace("-", "/")}</div>
        <button onClick={() => setFrom(addDays(from, 42))} style={{ border: `1px solid ${C.border}`, background: C.card, borderRadius: 999, width: 34, height: 34, cursor: "pointer" }}>›</button>
        {from !== today && <button onClick={() => setFrom(today)} style={{ border: "none", background: "none", color: C.accent, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>今天</button>}
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 10, paddingBottom: 2 }}>
        {[["all", "全部"], ...(d && d.isBoss ? [["personal", "🔒 我的"], ["company", "📅 公司"]] : []), ...Object.keys(CAT_COLOR).map(c => [c, c])].map(([k, l]) =>
          <button key={k} onClick={() => setShow(k)} style={{ flex: "0 0 auto", border: `1px solid ${show === k ? C.accent : C.border}`, background: show === k ? C.accentBg : C.card, color: show === k ? C.accent : C.text, borderRadius: 999, padding: "5px 12px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>)}
      </div>
      {d && d.canEdit && <button onClick={() => { setMsg(""); setEdit({ src: "company", title: "", cat: "活動", date: today, end: today, start: "", endTime: "", loc: "", desc: "" }); }} style={{ ...s.btn("primary"), marginBottom: 10 }}>＋ 新增行程</button>}
      {d && d.ready && !d.ready.company && <div style={{ ...s.card, color: C.gold, fontSize: 13 }}>還沒找到 Google 日曆「紅玉滿行事曆」，請後端執行 p28_setup</div>}
      {d && d.isBoss && d.ready && d.ready.personal === false && <div style={{ ...s.card, color: C.muted, fontSize: 12.5 }}>🔒 個人行事曆還沒連結：把你的 Google 日曆共用給公司帳號，再到〈遊戲參數〉填「大隊長行事曆ID」</div>}
      {!d && <div className="rh-skel" style={{ height: 160, borderRadius: 18 }} />}
      {d && keys.length === 0 && <div style={{ ...s.card, textAlign: "center", color: C.muted, fontSize: 13 }}>這段期間沒有行程</div>}
      {keys.map(k => {
        const dt = new Date(k + "T00:00:00+08:00");
        return <div key={k} style={{ ...s.card, padding: "10px 14px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: k === today ? C.accent : C.text, marginBottom: 6 }}>{k.slice(5).replace("-", "/")}（{WD[dt.getDay()]}）{k === today ? "・今天" : ""}</div>
          {days[k].map((x, i) => <button key={x.id + i} onClick={() => { if (d.canEdit && (x.src === "company" || d.isBoss)) { setMsg(""); setEdit({ ...x }); } }}
            style={{ display: "flex", width: "100%", gap: 10, alignItems: "flex-start", border: "none", background: "none", padding: "6px 0", textAlign: "left", fontFamily: "inherit", color: C.text, cursor: d.canEdit ? "pointer" : "default", borderTop: i ? `1px dashed ${C.border}` : "none" }}>
            <span style={{ width: 4, alignSelf: "stretch", borderRadius: 2, background: CAT_COLOR[x.cat] || C.muted, flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{x.src === "personal" ? "🔒 " : ""}{x.title}</span>
              <span style={{ display: "block", fontSize: 11.5, color: C.muted, marginTop: 1 }}>【{x.cat}】{x.allDay ? (x.date !== x.end ? `${x.date.slice(5).replace("-", "/")}～${x.end.slice(5).replace("-", "/")}` : "整天") : `${x.start}～${x.endTime}`}{x.loc ? "・" + x.loc : ""}</span>
              {x.desc && <span style={{ display: "block", fontSize: 12, color: C.text, marginTop: 2, whiteSpace: "pre-wrap" }}>{x.desc}</span>}
            </span>
          </button>)}
        </div>;
      })}
      <div style={{ fontSize: 11.5, color: C.light, textAlign: "center", margin: "6px 0 12px" }}>和 Google 日曆「紅玉滿行事曆」同步；在 Google 日曆上改，這裡也會跟著變</div>
      {msg && <div style={{ fontSize: 13, color: C.green, textAlign: "center" }}>{msg}</div>}
    </div>
  );
}
