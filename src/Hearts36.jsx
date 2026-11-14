// v1.36 無敵8心：愛心、耐心、決心、雄心、誠心、信心、善心、良心
// 每顆心銅、銀、金三階，依平常工作與遊戲紀錄自動點亮；8 顆都到銅＝無敵8心、都到金＝傳說・無敵8心
// 愛心、善心可以由隊員推薦（每月 3 次）或管理者頒發
import { useEffect, useState } from "react";
import { topToast } from "./TopToast.jsx";

export const HEART_ORDER = ["愛", "耐", "決", "雄", "誠", "信", "善", "良"];
const LV_COLOR = ["#d9d0c5", "#c27c4a", "#9aa5b1", "#e0a91b"];
const LV_BG = ["#f3eee6", "#f6e6da", "#eef1f4", "#fbf1d6"];
const LV_NAME = ["未點亮", "銅", "銀", "金"];

function HeartSvg({ size, color, glow, text }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block", filter: glow ? `drop-shadow(0 0 ${size / 6}px ${color})` : "none" }}>
      <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.6 4.5c2.1 0 3.6 1.2 4.4 2.6.8-1.4 2.3-2.6 4.4-2.6 3.6 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21z" fill={color} />
      {text && <text x="12" y="13.6" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#fff" fontFamily="'Noto Sans TC',sans-serif">{text}</text>}
    </svg>
  );
}

// 名片、清單用的 8 顆小心
export function HeartDots({ lv, size = 12 }) {
  const a = Array.isArray(lv) ? lv : [];
  return <span style={{ display: "inline-flex", gap: 1 }}>{HEART_ORDER.map((_, i) => <HeartSvg key={i} size={size} color={LV_COLOR[a[i] || 0]} />)}</span>;
}

// 8 顆心排成一圈
function HeartRing({ hearts, size = 220, C }) {
  const n = hearts.filter(h => h.lv >= 1).length, g = hearts.filter(h => h.lv >= 3).length, r = size / 2 - 26;
  const inv = n === 8, legend = g === 8;
  return (
    <div style={{ position: "relative", width: size, height: size, margin: "0 auto" }}>
      {inv && <div style={{ position: "absolute", inset: 18, borderRadius: "50%", background: `radial-gradient(circle, ${legend ? "rgba(255,211,77,.35)" : "rgba(255,111,156,.28)"} 0%, transparent 70%)`, animation: "h36pulse 2.4s ease-in-out infinite" }} />}
      {hearts.map((h, i) => {
        const ang = -Math.PI / 2 + i * Math.PI / 4, x = size / 2 + Math.cos(ang) * r, y = size / 2 + Math.sin(ang) * r;
        return <div key={h.key} style={{ position: "absolute", left: x - 21, top: y - 21 }}><HeartSvg size={42} color={LV_COLOR[h.lv]} glow={h.lv >= 1} text={HEART_ORDER[i]} /></div>;
      })}
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        {inv ? <>
          <div style={{ fontSize: 26 }}>{legend ? "👑" : "💖"}</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: legend ? "#b8860b" : "#c2185b" }}>{legend ? "傳說・無敵8心" : "無敵8心"}</div>
        </> : <>
          <div style={{ fontSize: 30, fontWeight: 800, color: C.accent, lineHeight: 1 }}>{n}<span style={{ fontSize: 16, color: C.muted }}>／8</span></div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>顆心已點亮</div>
        </>}
      </div>
      <style>{`@keyframes h36pulse{0%,100%{transform:scale(.92);opacity:.7}50%{transform:scale(1.04);opacity:1}}`}</style>
    </div>
  );
}

// 無敵8心進度條：8 段，每段是一顆心到銅（達成無敵8心後改成到金）的進度
export function HeartsProgress({ me, C, compact }) {
  if (!me || !me.parts) return null;
  const goldMode = me.inv, parts = goldMode ? me.partsG : me.parts, pct = goldMode ? me.progG : me.prog;
  const label = me.legend ? "傳說・無敵8心 達成！" : goldMode ? "傳說・無敵8心進度" : "無敵8心進度";
  const lack = me.hearts.map((h, i) => ({ h, i, p: parts[i] })).filter(x => x.p < 1).sort((a, b) => b.p - a.p);
  const fill = goldMode ? "#e0a91b" : "#e8457a";
  return (
    <div style={{ textAlign: "left" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: compact ? 13 : 14, fontWeight: 700, color: goldMode ? "#9a6b00" : "#c2185b" }}>{goldMode ? "👑 " : "💖 "}{label}</span>
        <span style={{ fontSize: compact ? 18 : 22, fontWeight: 800, color: fill }}>{me.legend ? 100 : pct}<span style={{ fontSize: 12 }}>%</span></span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 3 }}>
        {parts.map((p, i) => (
          <div key={i} title={me.hearts[i].name} style={{ position: "relative", height: compact ? 10 : 14, background: C.warm, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: Math.round(p * 100) + "%", height: "100%", background: p >= 1 ? fill : fill + "99", transition: "width .5s" }} />
          </div>))}
      </div>
      {!compact && <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 3, marginTop: 3 }}>{HEART_ORDER.map((c, i) => <div key={c} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: parts[i] >= 1 ? fill : C.light }}>{c}</div>)}</div>}
      {!me.legend && lack.length > 0 && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6, lineHeight: 1.6 }}>
        {compact ? `還差 ${lack.length} 顆心${goldMode ? "升到金" : ""}` : <>最接近的：{lack.slice(0, 3).map(x => `${x.h.name}還差 ${(x.h.th[goldMode ? 2 : 0] - x.h.pts).toLocaleString()} 分`).join("、")}</>}
      </div>}
    </div>
  );
}

// 樂園頁的小卡：8 顆小心＋進度條，點了進 8 心頁
export function HeartsCard({ apiGet, C, s, onOpen }) {
  const [me, setMe] = useState(null);
  useEffect(() => { apiGet({ action: "h36Me", lite: 1 }, 0).then(r => { if (r && r.success) setMe(r.data); }); }, []);
  if (!me) return (
    <button onClick={onOpen} style={{ ...s.card, width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: C.text, display: "flex", alignItems: "center", gap: 10 }}>
      <HeartDots lv={[]} size={15} /><span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>無敵8心</span><span style={{ fontSize: 12, color: C.accent }}>›</span>
    </button>);
  return (
    <button onClick={onOpen} style={{ ...s.card, width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit", color: C.text, display: "block", background: me.inv ? (me.legend ? "#fff8e1" : "#fff0f5") : C.card }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <HeartDots lv={me.hearts.map(h => h.lv)} size={17} />
        <span style={{ fontSize: 12, color: C.accent }}>看我的 8 心 ›</span>
      </div>
      <HeartsProgress me={me} C={C} compact />
    </button>
  );
}

export function HeartsPage({ user, apiGet, apiPost, C, s, who }) {
  const [d, setD] = useState(null), [open, setOpen] = useState(null), [recv, setRecv] = useState(null);
  const [rec, setRec] = useState({ to: "", heart: "love", reason: "", give: false }), [busy, setBusy] = useState(false);
  const load = () => apiGet({ action: "h36Me", who: who || "" }, 0).then(r => setD(r && r.success ? r : { error: (r && r.error) || "讀取失敗" }));
  useEffect(() => { load(); apiGet({ action: "h36Recv" }, 0).then(r => setRecv(r && r.success ? r.data : [])); }, [who]);
  if (!d) return <div className="rh-skel" style={{ height: 320, borderRadius: 18 }} />;
  if (d.error) return <div style={{ ...s.card, color: C.muted, fontSize: 13.5, lineHeight: 1.7 }}>{/未知/.test(d.error) ? "無敵8心還沒開通（後端更新到 v1.36 後就會出現）" : d.error}</div>;
  const me = d.data, other = d.other;
  const send = async () => {
    if (!rec.to) { topToast("請先選要推薦的隊員"); return; }
    if (rec.reason.trim().length < 4) { topToast("請寫一句推薦的原因（至少 4 個字）"); return; }
    setBusy(true);
    const r = await apiPost({ action: "h36Rec", to: rec.to, heart: rec.heart, reason: rec.reason.trim(), mode: rec.give ? "give" : "" }, 0);
    setBusy(false);
    if (r && r.success) { topToast("✅ " + r.msg); setRec({ to: "", heart: rec.heart, reason: "", give: rec.give }); load(); } else topToast((r && r.error) || "推薦失敗");
  };
  const chip = on => ({ border: `1px solid ${on ? C.accent : C.border}`, background: on ? C.accentBg : C.card, color: on ? C.accent : C.text, borderRadius: 999, padding: "6px 12px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" });

  if (other) return (
    <div>
      <div style={{ ...s.card, textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{other.name} 的 8 心</div>
        <HeartRing hearts={other.hearts} C={C} size={200} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 10, textAlign: "left" }}>
          {other.hearts.map(h => <div key={h.key} style={{ fontSize: 12.5, padding: "6px 10px", borderRadius: 10, background: LV_BG[h.lv] }}>{h.icon} {h.name}・<b style={{ color: LV_COLOR[h.lv] === "#d9d0c5" ? C.muted : LV_COLOR[h.lv] }}>{LV_NAME[h.lv]}</b></div>)}
        </div>
      </div>
    </div>);

  return (
    <div>
      <div style={{ ...s.card, textAlign: "center", background: me.inv ? (me.legend ? "#fff8e1" : "#fff0f5") : C.card }}>
        <HeartRing hearts={me.hearts} C={C} />
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 8, lineHeight: 1.7 }}>
          {me.legend ? `${me.legendAt} 達成傳說・無敵8心 👑` : me.inv ? `${me.invAt} 達成無敵8心！再把 8 顆心都升到金，就是「傳說・無敵8心」` : `再點亮 ${8 - me.n} 顆心就是「無敵8心」`}
        </div>
        <div style={{ margin: "12px 2px 4px" }}><HeartsProgress me={me} C={C} /></div>
        <div style={{ fontSize: 11.5, color: C.light, marginTop: 4 }}>每升一階：銅 +{d.rewards[1]}、銀 +{d.rewards[2]}、金 +{d.rewards[3]} 枚；無敵8心 +{d.invReward}、傳說 +{d.legendReward}</div>
      </div>

      {me.hearts.map((h, i) => {
        const pct = h.lv >= 3 ? 100 : Math.min(100, Math.round(h.pts / h.next * 100)), prev = h.lv ? h.th[h.lv - 1] : 0;
        return (
          <div key={h.key} style={{ ...s.card, padding: "12px 14px", borderLeft: `4px solid ${LV_COLOR[h.lv]}` }}>
            <button onClick={() => setOpen(open === h.key ? null : h.key)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", border: "none", background: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", color: C.text, textAlign: "left" }}>
              <HeartSvg size={34} color={LV_COLOR[h.lv]} glow={h.lv >= 1} text={HEART_ORDER[i]} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{h.name} <span style={{ fontSize: 12, fontWeight: 400, color: C.muted }}>{h.mean}</span></span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: h.lv ? LV_COLOR[h.lv] : C.light }}>{LV_NAME[h.lv]}</span>
                </div>
                <div style={{ height: 7, background: C.warm, borderRadius: 4, overflow: "hidden", marginTop: 6 }}><div style={{ width: pct + "%", height: "100%", background: LV_COLOR[Math.min(3, h.lv + 1)], transition: "width .4s" }} /></div>
                <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>{h.lv >= 3 ? `已滿階・${h.pts.toLocaleString()} 分` : `${h.pts.toLocaleString()}／${h.next.toLocaleString()} 分，還差 ${(h.next - h.pts).toLocaleString()} 分到${LV_NAME[h.lv + 1]}`}</div>
              </div>
            </button>
            {open === h.key && <div style={{ fontSize: 12.5, lineHeight: 1.7, marginTop: 8, padding: "8px 10px", background: C.warm, borderRadius: 10 }}>
              <b>怎麼累積：</b>{h.how}<br /><b>門檻：</b>銅 {h.th[0]}・銀 {h.th[1]}・金 {h.th[2]} 分{h.at ? <><br />{LV_NAME[h.lv]}點亮於 {h.at}</> : null}
              {(h.key === "love" || h.key === "kindness") && <><br />也可以請隊員推薦你，或由管理者頒發。</>}
            </div>}
          </div>);
      })}

      <div style={{ ...s.card }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 4 }}>💌 推薦隊員</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 8, lineHeight: 1.6 }}>看到隊員很有愛心、善心，推薦他一下！每位隊員的愛心或善心 +{rec.give ? d.mgrPts : d.recPts} 分。{rec.give ? "管理者頒發不占推薦次數。" : `這個月還可以推薦 ${d.recLeft} 次。`}</div>
        {d.mgr && <div style={{ display: "flex", gap: 6, marginBottom: 8 }}><button onClick={() => setRec({ ...rec, give: false })} style={chip(!rec.give)}>隊員推薦</button><button onClick={() => setRec({ ...rec, give: true })} style={chip(rec.give)}>🎖️ 管理者頒發</button></div>}
        <select value={rec.to} onChange={e => setRec({ ...rec, to: e.target.value })} style={{ ...s.input, marginBottom: 8 }}>
          <option value="">選擇隊員…</option>
          {(d.people || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <button onClick={() => setRec({ ...rec, heart: "love" })} style={chip(rec.heart === "love")}>❤️ 愛心</button>
          <button onClick={() => setRec({ ...rec, heart: "kindness" })} style={chip(rec.heart === "kindness")}>🌱 善心</button>
        </div>
        <textarea value={rec.reason} onChange={e => setRec({ ...rec, reason: e.target.value.slice(0, 100) })} rows={2} placeholder="為什麼推薦？例：下雨天主動幫客人撐傘" style={{ ...s.input, resize: "vertical", marginBottom: 8 }} />
        <button disabled={busy || (!rec.give && d.recLeft <= 0)} onClick={send} style={{ ...s.btn("primary"), opacity: busy || (!rec.give && d.recLeft <= 0) ? .5 : 1 }}>{busy ? "送出中…" : !rec.give && d.recLeft <= 0 ? "這個月的推薦用完了" : rec.give ? "頒發" : "推薦"}</button>
      </div>

      {recv && recv.length > 0 && <div style={{ ...s.card }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 6 }}>收到的推薦</div>
        {recv.map((x, i) => <div key={i} style={{ fontSize: 13, padding: "6px 0", borderTop: i ? `1px solid ${C.border}` : "none" }}>
          {x.heart === "love" ? "❤️" : "🌱"} <b>{x.from}</b>{x.give ? "（管理者頒發）" : ""}：{x.reason} <span style={{ color: C.light, fontSize: 11.5 }}>{x.at}・+{x.pts}</span>
        </div>)}
      </div>}
      <div style={{ fontSize: 11.5, color: C.light, textAlign: "center", margin: "4px 0 20px", lineHeight: 1.6 }}>心點亮後不會收回、不扣幣，和薪資考核無關。每天自動更新一次，打開這頁時會更新你自己的。</div>
    </div>
  );
}
