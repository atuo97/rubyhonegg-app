// v1.40 宇宙提醒：視察、辛苦了、超車、營業額里程碑、請喝咖啡、坐騎
// App 開著時每 90 秒讀一次（後端 v40Notes：讀完就標已讀；每種提醒每天最多一次）
// 隊員可以在「我的 → 提醒設定」分別關掉
import { useState, useEffect } from "react";
import { topToast } from "./TopToast.jsx";

const KEY = "rh_noteSet";
export const NOTE_TYPES = [
  ["visit", "👀 主管來視察、說辛苦了", ["visit", "cheer"]],
  ["overtake", "🏁 別的櫃位超過你們", ["overtake"]],
  ["milestone", "🎆 你的櫃位營業額破門檻", ["milestone"]],
  ["coffee", "☕ 有人請你喝咖啡", ["coffee"]],
  ["mount", "🏆 拿到坐騎", ["mount"]],
];
export function noteSettings() { try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { return {}; } }
function enabled(type) { const st = noteSettings(), g = NOTE_TYPES.find(x => x[2].includes(type)); return !g || st[g[0]] !== false; }
function sys(title, body) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted" || !document.hidden) return;
    const opt = { body, icon: "/logo_ink.png", tag: "rh-uni" };
    if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.ready.then(reg => reg.showNotification(title, opt)).catch(() => {});
    else new Notification(title, opt);
  } catch (e) {}
}

export function useUniverseNotes(user, apiGet) {
  useEffect(() => {
    if (!user || !user.id) return;
    let stop = false, busy = false;
    const tick = async () => {
      if (stop || busy || document.hidden) return;
      busy = true;
      try {
        const r = await apiGet({ action: "v40Notes" }, 0);
        if (r && r.success) (r.data || []).filter(n => enabled(n.type)).forEach((n, i) => setTimeout(() => {
          topToast(n.text, n.type === "overtake" ? "info" : "ok");
          sys("紅玉滿宇宙", n.text);
          try { navigator.vibrate && navigator.vibrate(120); } catch (e) {}
        }, i * 3200));
      } catch (e) {}
      busy = false;
    };
    const t0 = setTimeout(tick, 4000), t = setInterval(tick, 90000);
    const vis = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", vis);
    return () => { stop = true; clearTimeout(t0); clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [user && user.id]);
}

export function NoteSettings({ C, s }) {
  const [st, setSt] = useState(noteSettings());
  const set = (k, v) => { const n = { ...st, [k]: v }; setSt(n); try { localStorage.setItem(KEY, JSON.stringify(n)); } catch (e) {} };
  return (
    <div style={s.card}>
      <div style={s.sectionTitle}>提醒設定</div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>宇宙辦公室的小提醒，每一種每天最多跳一次。不想收的可以關掉。</div>
      {NOTE_TYPES.map(([k, label]) => {
        const on = st[k] !== false;
        return (
          <div key={k} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 13.5 }}>{label}</span>
            <button onClick={() => set(k, !on)} aria-label={label} style={{ width: 46, height: 26, borderRadius: 13, border: "none", background: on ? C.accent : C.border, position: "relative", cursor: "pointer", flexShrink: 0 }}>
              <span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: 10, background: "#fff", transition: "left .15s" }} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
