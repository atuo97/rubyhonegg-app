// ─────────────────────────────────────────────
// 百貨櫃位塔防戰。後端:tdMe / tdGive
// 戰力 = 箭塔、砲塔(攻擊)、城牆(防禦)等級 ＋ 本週營業額;每週一結算上週,冠軍櫃位依時數分獎勵
// ─────────────────────────────────────────────
import { useEffect, useState } from "react";

const TOWER = { arrow: ["🏹", "箭塔", "攻擊 +8/級"], cannon: ["💣", "砲塔", "攻擊 +15/級"], wall: ["🧱", "城牆", "防禦 +6/級、城堡血量 +50/級"] };
const short = l => String(l || "").replace(/^\d+/, "").replace(/^(正櫃|快閃櫃)/, "");

function Castle({ name, hp, max, dmg, side, C }) {
  return (
    <div style={{ flex: 1, textAlign: "center", position: "relative" }}>
      <div style={{ fontSize: 46, filter: hp <= 0 ? "grayscale(1) opacity(.5)" : "none", transform: side === "B" ? "scaleX(-1)" : "none" }}>🏰</div>
      {dmg ? <div key={dmg + "-" + hp} style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", color: C.red, fontWeight: 700, fontSize: 14, animation: "rhFade .5s" }}>-{dmg}</div> : null}
      <div style={{ fontSize: 12.5, fontWeight: 600 }}>{short(name)}</div>
      <div style={{ height: 8, background: "#e8e0d5", borderRadius: 4, overflow: "hidden", marginTop: 4 }}><div style={{ width: Math.max(0, hp / max * 100) + "%", height: "100%", background: side === "A" ? C.accent : "#3d5a80", transition: "width .4s" }} /></div>
      <div style={{ fontSize: 10.5, color: C.muted }}>{Math.max(0, hp)}/{max}</div>
    </div>
  );
}
function WarReplay({ m, C, s, onClose }) {
  const [i, setI] = useState(0);
  useEffect(() => { if (i >= m.waves.length) return; const t = setTimeout(() => setI(i + 1), 800); return () => clearTimeout(t); }, [i]);
  const w = i ? m.waves[i - 1] : null, maxA = m.hpA || (m.waves[0] ? m.waves[0][2] + m.waves[0][1] : 1000), maxB = m.hpB || (m.waves[0] ? m.waves[0][3] + m.waves[0][0] : 1000);
  return (
    <div style={{ ...s.card, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
        <Castle name={m.a} hp={w ? w[2] : maxA} max={maxA} dmg={w && w[1]} side="A" C={C} />
        <div style={{ fontSize: 22, paddingBottom: 30 }}>{i && i <= m.waves.length ? (i % 2 ? "🏹➡️" : "⬅️💣") : "⚔️"}</div>
        <Castle name={m.b} hp={w ? w[3] : maxB} max={maxB} dmg={w && w[0]} side="B" C={C} />
      </div>
      <div style={{ textAlign: "center", fontSize: 12.5, color: C.muted, marginTop: 8 }}>{i < m.waves.length ? `第 ${i + 1} 波進攻…` : <b style={{ color: C.text, fontSize: 15 }}>🏆 {short(m.winner)} 獲勝</b>}</div>
      <button onClick={i < m.waves.length ? () => setI(m.waves.length) : onClose} style={{ ...s.btn(i < m.waves.length ? "ghost" : "secondary"), marginTop: 10, padding: 8, fontSize: 12.5 }}>{i < m.waves.length ? "跳過" : "回到塔防"}</button>
    </div>
  );
}

export default function TowerTab({ user, apiGet, apiPost, C, s }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [amt, setAmt] = useState({ arrow: "", cannon: "", wall: "" });
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [rep, setRep] = useState(null);
  const load = async () => { const r = await apiGet({ action: "tdMe", empId: user.id }, 1); if (r && r.success) { setD(r.data); setErr(""); } else setErr((r && r.error) || "塔防功能尚未開通"); };
  useEffect(() => { load(); }, []);
  const flash = t => { setToast(t); setTimeout(() => setToast(""), 2500); };
  if (err) return <div style={{ ...s.card, textAlign: "center", color: C.muted }}>{err}</div>;
  if (!d) return <div className="rh-skel" style={{ height: 160, borderRadius: 18 }} />;
  if (rep) return <WarReplay m={rep} C={C} s={s} onClose={() => setRep(null)} />;
  const mine = d.towers.find(t => t.loc === d.myCounter);
  const give = async k => {
    setBusy(true);
    const r = await apiPost({ action: "tdGive", empId: user.id, tower: k, amount: amt[k] }, 0);
    setBusy(false);
    if (r && r.success) { flash(`已投入！${TOWER[k][1]} 目前 ${r.data.tower[k]} 級（升級進度 ${r.data.progress}/${r.data.need}）`); setAmt(a => ({ ...a, [k]: "" })); load(); }
    else flash((r && r.error) || "投入失敗");
  };
  return (
    <div>
      <div style={{ ...s.card, textAlign: "center" }}>
        <div style={{ fontSize: 30 }}>🏰⚔️🏰</div>
        <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>百貨櫃位塔防戰</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 1.6 }}>每週一結算上週：各櫃位互相攻城，積分最高的櫃位夥伴依上班時數分赤心幣<br />戰力＝本週營業額＋夥伴投入赤心幣升級的塔</div>
      </div>

      <div style={s.card}>
        <div style={s.sectionTitle}>我的櫃位{d.myCounter ? `：${short(d.myCounter)}` : ""}</div>
        {!d.myCounter && <div style={{ fontSize: 13, color: C.muted }}>最近 30 天沒有在百貨櫃位上班，暫時不能投入，但可以看戰況。</div>}
        {mine && Object.keys(TOWER).map(k => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 22 }}>{TOWER[k][0]}</span>
            <span style={{ flex: 1 }}><b style={{ fontSize: 13.5 }}>{TOWER[k][1]} Lv.{mine[k]}</b><div style={{ fontSize: 11, color: C.muted }}>{TOWER[k][2]}・升下一級 {d.base * mine[k]} 枚</div></span>
            <input type="number" inputMode="numeric" min="10" value={amt[k]} onChange={e => setAmt(a => ({ ...a, [k]: e.target.value }))} placeholder="幣" style={{ ...s.input, width: 70, padding: "8px 10px" }} />
            <button disabled={busy || !amt[k]} onClick={() => give(k)} style={{ ...s.btn("primary"), width: "auto", padding: "8px 12px", fontSize: 12.5, opacity: busy || !amt[k] ? .5 : 1 }}>投入</button>
          </div>))}
        {mine && <div style={{ fontSize: 11, color: C.light, marginTop: 8 }}>我的餘額 {d.balance} 枚・投入的幣不退回，會累積到升級為止</div>}
      </div>

      <div style={s.card}>
        <div style={s.sectionTitle}>本週戰況（{d.week.from.slice(5)}～{d.week.to.slice(5)}，即時預測）</div>
        {d.standings.length === 0 && <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: 8 }}>目前沒有百貨櫃位</div>}
        {d.standings.map((t, i) => (
          <div key={t.loc} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${C.border}`, background: t.loc === d.myCounter ? C.accentBg : "transparent" }}>
            <span style={{ width: 26 }}>{["🥇", "🥈", "🥉"][i] || i + 1}</span>
            <span style={{ flex: 1, fontSize: 13.5 }}>{short(t.loc)}<div style={{ fontSize: 10.5, color: C.light }}>攻 {t.power.atk}・防 {t.power.def}・城 {t.power.hp}（營業額加成 +{t.power.revAtk}）</div></span>
            <span style={{ fontSize: 12.5 }}>{t.w} 勝 {t.l} 敗</span><b style={{ width: 40, textAlign: "right" }}>{t.pts}</b>
          </div>))}
        {d.preview.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          {d.preview.map((m, i) => <button key={i} onClick={() => setRep(m)} style={{ border: `1px solid ${C.border}`, background: C.card, borderRadius: 999, padding: "5px 10px", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}>▶ {short(m.a)} vs {short(m.b)}</button>)}
        </div>}
      </div>

      <div style={s.card}>
        <div style={s.sectionTitle}>上週戰報（{d.lastWeek.from.slice(5)} 起）</div>
        {d.lastWeek.champion && <div style={{ fontSize: 14, fontWeight: 600, color: C.gold, marginBottom: 8 }}>🏆 冠軍：{short(d.lastWeek.champion)}</div>}
        {d.lastWeek.matches.length === 0 && <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: 8 }}>上週還沒有戰報</div>}
        {d.lastWeek.matches.map((m, i) => (
          <button key={i} onClick={() => setRep(m)} style={{ display: "flex", width: "100%", justifyContent: "space-between", border: "none", borderBottom: `1px solid ${C.border}`, background: "none", padding: "7px 0", fontSize: 13, cursor: "pointer", fontFamily: "inherit", color: C.text }}>
            <span>{short(m.a)} vs {short(m.b)}</span><span style={{ color: C.muted }}>勝：{short(m.winner)} ▶</span>
          </button>))}
      </div>
      {toast && <div style={{ position: "fixed", left: "50%", bottom: 96, transform: "translateX(-50%)", background: C.text, color: "#fff", fontSize: 13, padding: "9px 16px", borderRadius: 999, zIndex: 400, maxWidth: "86%", textAlign: "center" }}>{toast}</div>}
    </div>
  );
}
