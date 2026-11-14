// ─────────────────────────────────────────────
// v1.44 心情簽到：每天點一個表情（可加一句話）。
// 只有 Lv.3 以上看得到大家的心情；連續 3 次心情低落，主管會收到「關心一下」提醒。
// ─────────────────────────────────────────────
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export const FACES = ["", "😢", "😟", "😐", "🙂", "😄"];
export const LABEL = ["", "很低落", "有點累", "普通", "不錯", "很棒"];

export default function MoodCard({ user, apiGet, apiPost, C, s }) {
  const [today, setToday] = useState(undefined), [pick, setPick] = useState(0), [note, setNote] = useState(""), [msg, setMsg] = useState(""), [team, setTeam] = useState(null), [edit, setEdit] = useState(false);
  useEffect(() => { apiGet({ action: "v44MoodMe" }, 0).then(r => setToday(r && r.success ? r.data.today : null)); }, []);
  const send = async () => {
    const r = await apiPost({ action: "v44Mood", mood: pick, note }, 0);
    if (r && r.success) { setToday({ mood: pick, note }); setEdit(false); setMsg(pick <= 2 ? "收到了，辛苦了 💗 有需要隨時跟主管說" : "收到！今天也一起加油 💪"); }
    else setMsg((r && r.error) || "送出失敗");
  };
  const openTeam = () => apiGet({ action: "v44MoodTeam" }, 0).then(r => setTeam(r && r.success ? r.data : { error: (r && r.error) || "讀取失敗" }));
  if (today === undefined) return null;
  const isMgr = user.role >= 3;
  return (
    <div style={{ ...s.card, background: "linear-gradient(180deg,#fff7f0,#fffdfa)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>💗 今天心情如何？</div>
        {isMgr && <button onClick={openTeam} style={{ border: `1px solid ${C.border}`, background: C.card, color: C.accent, borderRadius: 999, padding: "3px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>隊員心情</button>}
      </div>
      {today && !edit ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 30 }}>{FACES[today.mood]}</span>
          <span style={{ flex: 1, fontSize: 13.5 }}>今天：{LABEL[today.mood]}{today.note ? `｜${today.note}` : ""}<span style={{ display: "block", fontSize: 11.5, color: C.light }}>只有主管看得到</span></span>
          <button onClick={() => { setPick(today.mood); setNote(today.note || ""); setEdit(true); }} style={{ border: "none", background: "transparent", color: C.muted, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>改</button>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", margin: "4px 0 8px" }}>
            {[5, 4, 3, 2, 1].map(v => (
              <button key={v} onClick={() => setPick(v)} style={{ flex: 1, margin: "0 3px", border: `2px solid ${pick === v ? C.accent : "transparent"}`, background: pick === v ? C.accentBg : "transparent", borderRadius: 14, padding: "6px 0", cursor: "pointer", fontFamily: "inherit" }}>
                <div style={{ fontSize: 28 }}>{FACES[v]}</div><div style={{ fontSize: 10.5, color: C.muted }}>{LABEL[v]}</div>
              </button>
            ))}
          </div>
          {pick > 0 && <>
            <input value={note} maxLength={40} onChange={e => setNote(e.target.value)} placeholder="想說的一句話（選填）" style={{ ...s.input, marginBottom: 8 }} />
            <button onClick={send} style={s.btn("primary")}>送出</button>
          </>}
          <div style={{ fontSize: 11.5, color: C.light, marginTop: 6 }}>🔒 只有主管看得到，讓大家互相照顧</div>
        </>
      )}
      {msg && <div style={{ fontSize: 13, color: C.accent, marginTop: 6 }}>{msg}</div>}
      {team && createPortal(
        <div onClick={() => setTeam(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 1600, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.card, width: "100%", maxWidth: 480, borderRadius: "0 0 20px 20px", padding: "calc(16px + env(safe-area-inset-top)) 16px 18px" }}>
            <div style={{ fontSize: 15, fontWeight: 600, textAlign: "center", marginBottom: 4 }}>💗 隊員心情</div>
            <div style={{ fontSize: 12, color: C.muted, textAlign: "center", marginBottom: 10 }}>只有 Lv.3 以上看得到；⚠️ 是連續 3 次心情低落，找時間關心一下</div>
            {team.error && <div style={{ color: C.red }}>{team.error}</div>}
            {team.list && team.list.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>還沒有人簽到</div>}
            {team.list && team.list.map(x => (
              <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 24, width: 30 }}>{x.today ? FACES[x.today] : "・"}</span>
                <span style={{ flex: 1, fontSize: 13.5 }}>{x.low ? "⚠️ " : ""}<b>{x.name}</b>{x.note ? `｜${x.note}` : ""}<span style={{ display: "block", fontSize: 11.5, color: C.muted }}>{x.today ? "今天 " + LABEL[x.today] : "今天還沒簽到"}・近 7 天平均 {x.avg || "—"}</span></span>
              </div>
            ))}
            <button onClick={() => setTeam(null)} style={{ ...s.btn("ghost"), marginTop: 12 }}>關閉</button>
          </div>
        </div>, document.body
      )}
    </div>
  );
}
