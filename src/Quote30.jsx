// v1.30 報價單（Lv.3 以上）：打開雲端「紅玉滿赤心員工系統／報價單」裡的報價系統網頁，存到雲端（Word＋PDF）、報價紀錄
import { useState, useEffect, useRef } from "react";

let PAGE_CACHE = null;   // 同一次開 App 只下載一次網頁

export function QuotePage({ user, apiGet, apiPost, C, s }) {
  const [tab, setTab] = useState("make");
  const [page, setPage] = useState(PAGE_CACHE), [err, setErr] = useState("");
  const [list, setList] = useState(null), [busy, setBusy] = useState(false), [msg, setMsg] = useState("");
  const [h, setH] = useState(1600);
  const frame = useRef(null), editing = useRef(null), pendingForm = useRef(null), ready = useRef(false);

  const loadPage = (force) => {
    if (PAGE_CACHE && !force) { setPage(PAGE_CACHE); return; }
    setErr(""); setPage(null);
    apiGet({ action: "quotePage" }, 0).then(r => { if (r && r.success) { PAGE_CACHE = r; setPage(r); } else setErr((r && r.error) || "讀取報價網頁失敗"); });
  };
  const loadList = () => apiGet({ action: "quoteList" }, 0).then(r => setList(r && r.success ? r : { error: (r && r.error) || "讀取失敗" }));
  useEffect(() => { loadPage(); loadList(); }, []);

  const post = m => frame.current && frame.current.contentWindow && frame.current.contentWindow.postMessage(m, "*");
  useEffect(() => {
    const on = async ev => {
      if (!frame.current || ev.source !== frame.current.contentWindow) return;
      const m = ev.data || {};
      if (m.type === "rh-quote-ready") {
        ready.current = true;
        post({ type: "rh-quote-agent", agent: page && page.agent });
        if (pendingForm.current) { post({ type: "rh-quote-load", form: pendingForm.current }); pendingForm.current = null; }
      }
      if (m.type === "rh-quote-height") setH(Math.max(900, Math.min(20000, m.h + 20)));
      if (m.type === "rh-quote-save") {
        const r = await apiPost({ action: "quoteSave", docx: m.docx, form: JSON.stringify(m.form), meta: JSON.stringify(m.meta), id: editing.current || "" }, 0);
        if (r && r.success) { editing.current = r.id; loadList(); post({ type: "rh-quote-saved", ok: true, ...r }); }
        else post({ type: "rh-quote-saved", ok: false, error: (r && r.error) || "存檔失敗" });
      }
    };
    window.addEventListener("message", on); return () => window.removeEventListener("message", on);
  }, [page]);

  const openForm = (q, copy) => {
    let f = null; try { f = JSON.parse(q.form || "null"); } catch (e) {}
    if (!f) { setMsg("這張報價單沒有存表單內容，無法帶回"); return; }
    editing.current = copy ? null : q.id;
    setTab("make"); setMsg(copy ? `已複製「${q.client || q.event}」的內容，改好後存成新的一張` : `正在修改「${q.file}」，存到雲端會另存一份新檔`);
    if (ready.current) post({ type: "rh-quote-load", form: f }); else pendingForm.current = f;
  };
  const newQuote = () => { editing.current = null; setMsg(""); ready.current = false; const p = page; setPage(null); setTimeout(() => setPage(p), 30); };
  const setStatus = async (q, st) => {
    setBusy(true); const r = await apiPost({ action: "quoteStatus", id: q.id, status: st }, 0); setBusy(false);
    if (r && r.success) { setMsg(`「${q.client || q.event}」改成${st}`); loadList(); } else setMsg((r && r.error) || "更新失敗");
  };
  const toCalendar = async q => {
    const dates = String(q.dates || "").split("、").filter(Boolean); if (!dates.length) return;
    if (!confirm(`把「${q.event || q.client}」${dates.length} 天加進公司行事曆（分類：活動）？`)) return;
    setBusy(true); let ok = 0;
    for (const d of dates) { const r = await apiPost({ action: "calSave", title: `${q.event || "活動"}｜${q.client}`, date: d, cat: "活動", desc: "報價單 " + q.file }, 0); if (r && r.success) ok++; }
    setBusy(false); setMsg(`已加進公司行事曆 ${ok} 天`);
  };

  const chip = on => ({ border: `1px solid ${on ? C.accent : C.border}`, background: on ? C.accentBg : C.card, color: on ? C.accent : C.text, borderRadius: 999, padding: "6px 12px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" });
  const ST_COLOR = { "已報價": C.blue, "成交": C.green, "取消": C.light };
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <button onClick={() => setTab("make")} style={chip(tab === "make")}>📝 製作報價單</button>
        <button onClick={() => { setTab("list"); loadList(); }} style={chip(tab === "list")}>📂 報價紀錄{list && list.data ? ` ${list.data.length}` : ""}</button>
      </div>
      {msg && <div style={{ ...s.card, padding: "10px 14px", fontSize: 13, color: C.text, background: C.goldBg }}>{msg}</div>}

      <div style={{ display: tab === "make" ? "block" : "none" }}>
        {err ? <div style={{ ...s.card, color: C.red, fontSize: 13.5, lineHeight: 1.7 }}>{err}<br /><button onClick={() => loadPage(true)} style={{ ...s.btn("secondary"), marginTop: 10 }}>重新讀取</button></div>
          : !page ? <div className="rh-skel" style={{ height: 300, borderRadius: 18 }} />
          : <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11.5, color: C.muted, margin: "0 2px 6px" }}>
              <span>網頁：{page.name}（{page.updated}）</span>
              <span><button onClick={newQuote} style={{ ...chip(false), padding: "3px 9px", fontSize: 11.5 }}>＋ 新的一張</button> <button onClick={() => { ready.current = false; loadPage(true); }} style={{ ...chip(false), padding: "3px 9px", fontSize: 11.5 }}>↻</button></span>
            </div>
            <iframe ref={frame} title="報價系統" srcDoc={page.html} onLoad={() => { /* 網頁載入後會自己送 ready */ }}
              style={{ width: "100%", height: h, border: `1px solid ${C.border}`, borderRadius: 14, background: "#faf7f4", display: "block" }} />
          </>}
      </div>

      {tab === "list" && (!list ? <div className="rh-skel" style={{ height: 200, borderRadius: 18 }} />
        : list.error ? <div style={{ ...s.card, color: C.muted }}>{/未知/.test(list.error) ? "報價紀錄還沒開通（後端更新到 v1.30 後就會出現）" : list.error}</div>
        : !list.data.length ? <div style={{ ...s.card, color: C.muted, textAlign: "center", fontSize: 13 }}>還沒有報價紀錄。到「製作報價單」按「☁️ 存到雲端」就會出現在這裡。</div>
        : list.data.map(q => (
          <div key={q.id} style={s.card}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600 }}>{q.client || "（未填客戶）"}{q.event ? "｜" + q.event : ""}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>活動 {q.dates || "—"}・報價 {q.qd}・{q.agent}</div>
              </div>
              <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.gold }}>{Number(q.amount || 0).toLocaleString()}</div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: ST_COLOR[q.status] || C.muted }}>{q.status}</div>
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: C.light, marginTop: 4, wordBreak: "break-all" }}>{q.file}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {q.word && <a href={q.word} target="_blank" rel="noreferrer" style={{ ...chip(false), textDecoration: "none" }}>📄 Word</a>}
              {q.pdf && <a href={q.pdf} target="_blank" rel="noreferrer" style={{ ...chip(false), textDecoration: "none" }}>📑 PDF</a>}
              <button onClick={() => openForm(q, false)} style={chip(false)}>✏️ 打開修改</button>
              <button onClick={() => openForm(q, true)} style={chip(false)}>📋 複製一張</button>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: C.muted }}>狀態</span>
              {(list.statuses || ["已報價", "成交", "取消"]).map(st => <button key={st} disabled={busy || q.status === st} onClick={() => setStatus(q, st)} style={{ ...chip(q.status === st), padding: "4px 10px", fontSize: 12 }}>{st}</button>)}
              {q.status === "成交" && <button disabled={busy} onClick={() => toCalendar(q)} style={{ ...chip(false), padding: "4px 10px", fontSize: 12 }}>📅 加進公司行事曆</button>}
            </div>
          </div>)))}
    </div>
  );
}
