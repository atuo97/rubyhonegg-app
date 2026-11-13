// ─────────────────────────────────────────────
// 百貨櫃位塔防戰 v1.27。後端:tdMe / tdGive
// 本週積分＝營業額 1 元 1 分＋捐獻 1 枚 100 分；每週一結算，冠軍櫃位依時數分獎勵；累積總分每 50 萬分升 1 級
// ─────────────────────────────────────────────
import { useEffect, useState } from "react";
import { Flash } from "./TopToast.jsx";

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
  const [amt, setAmt] = useState("");
  const [loc, setLoc] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [rep, setRep] = useState(null);
  const load = async () => { const r = await apiGet({ action: "tdMe", empId: user.id }, 1); if (r && r.success) { setD(r.data); setErr(""); setLoc(l => l || (r.data.myCounters || [])[0] || ""); } else setErr((r && r.error) || "塔防功能尚未開通"); };
  useEffect(() => { load(); }, []);
  const flash = t => { setToast(t); setTimeout(() => setToast(""), 2800); };
  if (err) return <div style={{ ...s.card, textAlign: "center", color: C.muted }}>{err}</div>;
  if (!d) return <div className="rh-skel" style={{ height: 160, borderRadius: 18 }} />;
  if (rep) return <WarReplay m={rep} C={C} s={s} onClose={() => setRep(null)} />;
  const rule = d.rule || { rev: 1, give: 100, step: 500000, pool: 300 };
  const fmt = n => Number(n || 0).toLocaleString("zh-TW");
  const wan = n => n >= 10000 ? (Math.round(n / 1000) / 10) + " 萬" : fmt(n);
  const mine = d.myCounters || (d.myCounter ? [d.myCounter] : []);
  const give = async () => {
    setBusy(true);
    const r = await apiPost({ action: "tdGive", empId: user.id, loc, amount: amt }, 0);
    setBusy(false);
    if (r && r.success) { flash(`已捐給 ${short(r.data.loc)}，+${fmt(r.data.added)} 分！本週 ${fmt(r.data.score)} 分`); setAmt(""); load(); }
    else flash((r && r.error) || "捐獻失敗");
  };
  const top = d.standings[0] ? d.standings[0].score : 0;
  return (
    <div>
      <div style={{ ...s.card, textAlign: "center" }}>
        <div style={{ fontSize: 30 }}>🏰⚔️🏰</div>
        <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>百貨櫃位塔防戰</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 1.7 }}>
          本週積分＝營業額 1 元 {rule.rev} 分＋捐獻 1 枚 {fmt(rule.give)} 分<br />每週一結算，冠軍櫃位的夥伴依上班時數分 {rule.pool} 枚<br />累積總分每 {wan(rule.step)} 分升 1 級，只升不降
        </div>
      </div>

      <div style={s.card}>
        <div style={s.sectionTitle}>本週排名（{d.week.from.slice(5).replace("-", "/")}～{d.week.to.slice(5).replace("-", "/")}）</div>
        {d.standings.length === 0 && <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: 8 }}>目前沒有百貨櫃位</div>}
        {d.standings.map((t, i) => (
          <div key={t.loc} style={{ padding: "9px 6px", borderBottom: `1px solid ${C.border}`, background: mine.includes(t.loc) ? C.accentBg : "transparent", borderRadius: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 26, fontSize: 16 }}>{["🥇", "🥈", "🥉"][i] || i + 1}</span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{short(t.loc)} <span style={{ fontSize: 11.5, color: C.gold, fontWeight: 700 }}>Lv.{t.level}{t.title ? " " + t.title : ""}</span></span>
              <b style={{ fontSize: 15, color: C.accent }}>{fmt(t.score)}</b><span style={{ fontSize: 11, color: C.muted }}>分</span>
            </div>
            <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: "hidden", margin: "6px 0 4px 34px", display: "flex" }}>
              <div style={{ width: (top ? t.revScore / top * 100 : 0) + "%", background: C.accent }} />
              <div style={{ width: (top ? t.giveScore / top * 100 : 0) + "%", background: C.gold }} />
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginLeft: 34 }}>營業額 {fmt(t.revScore)}・捐獻 {fmt(t.giveScore)}（{fmt(t.give)} 枚）・距離 Lv.{t.level + 1} 還差 {wan(t.toNext)}</div>
          </div>))}
        {d.preview.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          {d.preview.map((m, i) => <button key={i} onClick={() => setRep(m)} style={{ border: `1px solid ${C.border}`, background: C.card, borderRadius: 999, padding: "5px 10px", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit", color: C.text }}>▶ {short(m.a)} vs {short(m.b)}</button>)}
        </div>}
      </div>

      <div style={s.card}>
        <div style={s.sectionTitle}>捐赤心幣幫櫃位衝分</div>
        {mine.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>最近 30 天沒有在百貨櫃位上班，暫時不能捐，但可以看戰況。</div>}
        {mine.length > 0 && <>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>只能捐給最近 30 天上過班的百貨櫃位；1 枚 ＝ {fmt(rule.give)} 分，捐了不退回</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {mine.map(l => <button key={l} onClick={() => setLoc(l)} style={{ border: `1.5px solid ${loc === l ? C.accent : C.border}`, background: loc === l ? C.accentBg : C.card, color: loc === l ? C.accent : C.text, borderRadius: 999, padding: "6px 12px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{short(l)}</button>)}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input type="number" inputMode="numeric" min="10" value={amt} onChange={e => setAmt(e.target.value)} placeholder="捐幾枚（至少 10）" style={{ ...s.input, flex: 1 }} />
            <button disabled={busy || !amt || !loc} onClick={give} style={{ ...s.btn("primary"), width: "auto", padding: "10px 16px", opacity: busy || !amt || !loc ? .5 : 1 }}>捐獻</button>
          </div>
          {amt > 0 && <div style={{ fontSize: 12, color: C.gold, marginTop: 6 }}>＝ +{fmt(amt * rule.give)} 分給 {short(loc)}</div>}
          <div style={{ fontSize: 11, color: C.light, marginTop: 8 }}>我的餘額 {fmt(d.balance)} 枚</div>
        </>}
      </div>

      <div style={s.card}>
        <div style={s.sectionTitle}>上週戰報（{d.lastWeek.from.slice(5).replace("-", "/")} 起）</div>
        {d.lastWeek.champion && <div style={{ fontSize: 14, fontWeight: 600, color: C.gold, marginBottom: 8 }}>🏆 冠軍：{short(d.lastWeek.champion)}　辛苦了！</div>}
        {(d.lastWeek.board || []).map((b, i) => <div key={b.loc} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", borderBottom: `1px solid ${C.border}` }}><span>{["🥇", "🥈", "🥉"][i] || i + 1} {short(b.loc)}</span><span style={{ color: C.muted }}>{fmt(b.score)} 分</span></div>)}
        {d.lastWeek.matches.length === 0 && !(d.lastWeek.board || []).length && <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: 8 }}>上週還沒有戰報</div>}
        {d.lastWeek.matches.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {d.lastWeek.matches.map((m, i) => <button key={i} onClick={() => setRep(m)} style={{ border: `1px solid ${C.border}`, background: C.card, borderRadius: 999, padding: "5px 10px", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit", color: C.text }}>▶ {short(m.a)} vs {short(m.b)}</button>)}
        </div>}
      </div>
      {toast && <Flash text={toast} />}
    </div>
  );
}
