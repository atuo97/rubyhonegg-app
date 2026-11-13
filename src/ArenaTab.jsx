// ─────────────────────────────────────────────
// 對戰(PvP):裝備、自動切磋、即時對戰。後端:pvMe / pvEquip / pvDuel / pvLive*
// ─────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { Flash } from "./TopToast.jsx";
import { Coin, Heart } from "./Coin.jsx";
import { PET_ATTR, PET_COUNTER, PET_TYPE_NAME } from "./pets/petSprites.jsx";

const MOVE_NAME = { attack: "攻擊", defend: "防禦", skill: "必殺", card: "卡片" };
const CARD_NAME = { heal: "補血", power: "增強攻擊", shield: "護盾" };
const statText = s => Object.keys(s || {}).filter(k => k !== "card" && k !== "val").map(k => ({ atk: "攻", def: "防", hp: "血", spd: "速" }[k] + "+" + s[k])).join(" ") || (s && s.card ? `${CARD_NAME[s.card]} ${s.val}${s.card === "power" ? "%" : ""}` : "");

function Bar({ v, max, color }) {
  return <div style={{ height: 8, background: "#e8e0d5", borderRadius: 4, overflow: "hidden" }}><div style={{ width: Math.max(0, v / max * 100) + "%", height: "100%", background: color, transition: "width .4s" }} /></div>;
}
function Fighter({ f, hp, max, side, hit, C }) {
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div style={{ fontSize: 40, transform: `${side === "B" ? "scaleX(-1) " : ""}${hit ? "translateX(" + (side === "A" ? -6 : 6) + "px)" : ""}`, transition: "transform .15s", filter: hp <= 0 ? "grayscale(1)" : "none" }}>🧑‍🍳</div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{f.name}</div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{f.weapon || "空手"}・{f.armor || "便服"}</div>
      <Bar v={hp} max={max} color={side === "A" ? C.accent : "#3d5a80"} />
      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{hp}/{max}</div>
    </div>
  );
}
function evText(e, A, B) {
  const one = (s, o) => {
    const x = e[s], parts = [];
    if (x.card) parts.push(`使用「${x.card}」${x.heal ? `回復 ${x.heal}` : ""}`);
    if (x.move === "defend") parts.push(`防禦${x.heal ? `並回復 ${x.heal}` : ""}`);
    if (x.dmg != null) parts.push(`${x.move === "skill" ? "必殺！" : ""}造成 ${x.dmg} 傷害${x.crit ? "（爆擊）" : ""}${x.counter ? "（屬性相剋！）" : ""}`);
    if (e[o].absorb) parts.push(`（被護盾擋下 ${e[o].absorb}）`);
    return (s === "A" ? A : B).name + " " + parts.join("，");
  };
  return [one("A", "B"), one("B", "A")];
}

// 回放自動對戰
function Replay({ data, C, s, onClose }) {
  const [i, setI] = useState(0);
  useEffect(() => { if (i >= data.log.length) return; const t = setTimeout(() => setI(i + 1), 900); return () => clearTimeout(t); }, [i]);
  const ev = data.log[Math.max(0, i - 1)], hp = i ? ev.hp : { A: data.A.stats.hp, B: data.B.stats.hp }, end = i >= data.log.length;
  return (
    <div style={{ ...s.card, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
        <Fighter f={data.A} hp={hp.A} max={data.A.stats.hp} side="A" hit={i && ev.B.dmg} C={C} />
        <div style={{ fontSize: 13, color: C.muted, paddingBottom: 30 }}>VS</div>
        <Fighter f={data.B} hp={hp.B} max={data.B.stats.hp} side="B" hit={i && ev.A.dmg} C={C} />
      </div>
      <div style={{ minHeight: 48, marginTop: 12, fontSize: 12.5, lineHeight: 1.6, color: C.text, background: C.warm, borderRadius: 12, padding: "8px 10px" }}>
        {i === 0 ? "對戰開始！" : <>第 {ev.round} 回合<br />{evText(ev, data.A, data.B).map((t, k) => <div key={k}>{t}</div>)}</>}
      </div>
      {end && <div style={{ textAlign: "center", marginTop: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: data.winner === data.A.id ? C.green : C.red }}>{data.winner === data.A.id ? "🏆 你贏了！" : "這次輸了，再接再厲"}</div>
        {data.reward ? <div style={{ fontSize: 12.5, color: C.gold, marginTop: 4 }}><Coin n={data.reward} plus size={12} /></div> : null}
        <button onClick={onClose} style={{ ...s.btn("secondary"), marginTop: 10 }}>回到對戰</button>
      </div>}
      {!end && <button onClick={() => setI(data.log.length)} style={{ ...s.btn("ghost"), marginTop: 10, padding: 8, fontSize: 12 }}>跳過動畫</button>}
    </div>
  );
}

// 即時對戰畫面
function Live({ id, user, apiGet, apiPost, C, s, onClose }) {
  const [st, setSt] = useState(null);
  const [card, setCard] = useState("");
  const [now, setNow] = useState(Date.now());
  const skew = useRef(0);
  const poll = async () => {
    const r = await apiGet({ action: "pvLiveState", empId: user.id, id }, 0);
    if (r && r.success) { setSt(r.data); if (r.data.now) skew.current = r.data.now - Date.now(); }
  };
  useEffect(() => { poll(); const t = setInterval(() => { if (!document.hidden) poll(); }, 5000), c = setInterval(() => setNow(Date.now()), 500); return () => { clearInterval(t); clearInterval(c); }; }, []);   // 部署端調整:背景時暫停
  const move = async (m) => { const r = await apiPost({ action: "pvLiveMove", empId: user.id, id, move: m, card }, 0); if (r && r.success) setSt(r.data); setCard(""); };
  if (!st) return <div style={s.card}>連線中…</div>;
  if (st.status === "邀請中") return <div style={{ ...s.card, textAlign: "center" }}>等待對方接受挑戰…<br /><button onClick={onClose} style={{ ...s.btn("ghost"), marginTop: 10 }}>取消</button></div>;
  if (st.status === "已拒絕") return <div style={{ ...s.card, textAlign: "center" }}>對方婉拒了這次挑戰<br /><button onClick={onClose} style={{ ...s.btn("secondary"), marginTop: 10 }}>返回</button></div>;
  const me = st.side, op = me === "A" ? "B" : "A", F = st.fighters, last = st.log[st.log.length - 1];
  const left = Math.max(0, Math.ceil((st.deadline - (now + skew.current)) / 1000));
  const waitingMe = !st.waiting[me], cards = (F[me].cards || []).filter(c => !(st.used[me] || []).includes(c.id));
  return (
    <div style={{ ...s.card, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12 }}>
        <Fighter f={F.A} hp={st.hp.A} max={st.max.A} side="A" C={C} />
        <div style={{ textAlign: "center", paddingBottom: 26 }}><div style={{ fontSize: 11, color: C.muted }}>第 {st.round + 1} 回合</div>{!st.done && <div style={{ fontSize: 20, fontWeight: 600, color: left <= 5 ? C.red : C.text }}>{left}</div>}</div>
        <Fighter f={F.B} hp={st.hp.B} max={st.max.B} side="B" C={C} />
      </div>
      {last && <div style={{ fontSize: 12.5, lineHeight: 1.6, marginTop: 10, background: C.warm, borderRadius: 12, padding: "8px 10px" }}>第 {last.round} 回合<br />{evText(last, F.A, F.B).map((t, k) => <div key={k}>{t}</div>)}</div>}
      {st.done ? (
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: st.winner === user.id ? C.green : C.red }}>{st.winner === user.id ? "🏆 你贏了！" : "這次輸了，再接再厲"}</div>
          {st.winner === user.id && st.reward ? <div style={{ fontSize: 12.5, color: C.gold }}><Coin n={st.reward} plus size={12} /></div> : null}
          <button onClick={onClose} style={{ ...s.btn("secondary"), marginTop: 10 }}>回到對戰</button>
        </div>
      ) : waitingMe ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 12 }}>
            <button onClick={() => move("attack")} style={s.btn("primary")}>⚔️ 攻擊</button>
            <button onClick={() => move("defend")} style={s.btn("secondary")}>🛡️ 防禦</button>
            <button onClick={() => move("skill")} disabled={st.cd[me] > 0} style={{ ...s.btn("secondary"), opacity: st.cd[me] > 0 ? .4 : 1 }}>💥 必殺{st.cd[me] > 0 ? `(${st.cd[me]})` : ""}</button>
          </div>
          {cards.length > 0 && <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {cards.map(c => <button key={c.id} onClick={() => { setCard(c.id); }} style={{ border: `1px solid ${card === c.id ? C.accent : C.border}`, background: card === c.id ? C.accentBg : C.card, borderRadius: 999, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>🃏 {c.name}</button>)}
            {card && <button onClick={() => move("card")} style={{ ...s.btn("primary"), width: "auto", padding: "5px 12px", fontSize: 12 }}>使用卡片</button>}
          </div>}
          <div style={{ fontSize: 11, color: C.light, marginTop: 8 }}>{st.waiting[op] ? "對方已出招，" : ""}時間到沒出招會自動普通攻擊</div>
        </>
      ) : <div style={{ textAlign: "center", fontSize: 13, color: C.muted, marginTop: 14 }}>已出招，等待對方…</div>}
    </div>
  );
}

export default function ArenaTab({ user, apiGet, apiPost, C, s }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [replay, setReplay] = useState(null);
  const [live, setLive] = useState(null);
  const [inv, setInv] = useState([]);
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => { const r = await apiGet({ action: "pvMe", empId: user.id }, 1); if (r && r.success) { setD(r.data); setErr(""); } else setErr((r && r.error) || "對戰功能尚未開通"); };
  const loadInv = async () => { const r = await apiGet({ action: "pvLiveMine", empId: user.id }, 0); if (r && r.success) setInv(r.data || []); };
  useEffect(() => { load(); loadInv(); const t = setInterval(() => { if (!document.hidden) loadInv(); }, 10000); return () => clearInterval(t); }, []);   // 部署端調整:5 秒→10 秒、背景時暫停
  const flash = t => { setToast(t); setTimeout(() => setToast(""), 2500); };
  const [notice, setNotice] = useState("");   // v1.33 錯誤訊息常駐顯示（例如對戰尚未開放），不只閃一下
  const post = async (payload) => { setBusy(true); const r = await apiPost({ empId: user.id, ...payload }, 0); setBusy(false); if (!(r && r.success)) { const m = (r && r.error) || "失敗"; flash(m); setNotice(m); } else setNotice(""); return r && r.success ? (r.data || true) : null; };

  if (err) return <div style={{ ...s.card, textAlign: "center", color: C.muted }}>{err}</div>;
  if (!d) return <div className="rh-skel" style={{ height: 160, borderRadius: 18 }} />;
  if (replay) return <Replay data={replay} C={C} s={s} onClose={() => { setReplay(null); load(); }} />;
  if (live) return <Live id={live} user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} onClose={() => { setLive(null); load(); loadInv(); }} />;

  const inv2 = d.inventory, eq = d.equip, me = d.me;
  const setEq = async (patch) => { const r = await post({ action: "pvEquip", ...patch }); if (r) { flash("裝備已更新"); load(); } };
  const incoming = inv.filter(x => !x.mine && x.status === "邀請中"), active = inv.filter(x => x.status === "對戰中");
  return (
    <div>
      {incoming.map(x => (
        <div key={x.id} style={{ ...s.card, background: C.accentBg, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>⚔️</span><span style={{ flex: 1, fontSize: 13.5 }}><b>{x.fromName}</b> 邀請你即時對戰！</span>
          <button onClick={async () => { const r = await post({ action: "pvLiveAccept", id: x.id }); if (r) setLive(x.id); }} style={{ ...s.btn("primary"), width: "auto", padding: "6px 12px", fontSize: 12.5 }}>接受</button>
          <button onClick={async () => { await post({ action: "pvLiveAccept", id: x.id, decline: true }); loadInv(); }} style={{ ...s.btn("ghost"), width: "auto", padding: "6px 10px", fontSize: 12.5 }}>婉拒</button>
        </div>))}
      {active.map(x => <button key={x.id} onClick={() => setLive(x.id)} style={{ ...s.card, width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit", background: C.goldBg }}>⚡ 你和 {x.mine ? x.toName : x.fromName} 的即時對戰進行中，點這裡回到戰場</button>)}

      <div style={s.card}>
        <div style={s.sectionTitle}>我的戰鬥數值</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", textAlign: "center", gap: 6 }}>
          {[["體力", me.stats.hp], ["攻擊", me.stats.atk], ["防禦", me.stats.def], ["速度", me.stats.spd]].map(x => <div key={x[0]} style={{ background: C.warm, borderRadius: 12, padding: "8px 0" }}><div style={{ fontSize: 18, fontWeight: 600 }}>{x[1]}</div><div style={{ fontSize: 11, color: C.muted }}>{x[0]}</div></div>)}
        </div>
        {me.pet ? <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6 }}>寵物陪伴加成：體力 +{me.pet * 4}{me.petType ? `・${me.petTypeName}${PET_ATTR[me.petType] ? "（" + PET_ATTR[me.petType].split("・")[0] + "）" : ""}・剋${PET_COUNTER[me.petType].map(k => PET_TYPE_NAME[k]).join("、")}` : ""}</div> : null}
        {[["武器", "weapon"], ["防具", "armor"]].map(([label, k]) => (
          <div key={k} style={{ marginTop: 12 }}>
            <label style={s.label}>{label}</label>
            <select value={eq[k] || ""} onChange={e => setEq({ [k]: e.target.value })} disabled={busy} style={s.input}>
              <option value="">不裝備</option>
              {inv2.filter(i => i.cat === k).map(i => <option key={i.id} value={i.id}>{i.name}（{statText(i.stats)}）</option>)}
            </select>
          </div>))}
        <div style={{ marginTop: 12 }}>
          <label style={s.label}>卡片（最多帶 3 張，每張一場用一次）</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {inv2.filter(i => i.cat === "card").length === 0 && <span style={{ fontSize: 12.5, color: C.light }}>還沒有卡片，可到赤心幣商店、扭蛋或小店取得</span>}
            {inv2.filter(i => i.cat === "card").map(i => { const on = (eq.cards || []).includes(i.id); return (
              <button key={i.id} disabled={busy} onClick={() => setEq({ cards: JSON.stringify(on ? eq.cards.filter(x => x !== i.id) : [...(eq.cards || []), i.id].slice(-3)) })}
                style={{ border: `1px solid ${on ? C.accent : C.border}`, background: on ? C.accentBg : C.card, borderRadius: 12, padding: "6px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                🃏 {i.name}<div style={{ fontSize: 10.5, color: C.muted }}>{statText(i.stats)}</div></button>); })}
          </div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13 }}>
          <input type="checkbox" checked={eq.join} onChange={e => setEq({ join: e.target.checked ? "Y" : "N" })} /> 接受別人挑戰我
        </label>
      </div>

      <div style={s.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ ...s.sectionTitle, marginBottom: 0 }}>選擇對手</div><span style={{ fontSize: 12, color: C.muted }}>今天還能自動切磋 {d.left} 次</span>
        </div>
        {notice && <div style={{ fontSize: 12.5, color: C.red, background: "#fdeceb", borderRadius: 10, padding: "8px 10px", marginBottom: 8 }}>⚠️ {notice}</div>}
        {d.opponents.length === 0 && <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: 8 }}>目前沒有可以挑戰的夥伴</div>}
        {d.opponents.slice().sort((a, b) => b.power - a.power).map(o => (
          <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ flex: 1, fontSize: 13.5 }}>{o.name}<span style={{ fontSize: 11, color: C.light, marginLeft: 6 }}>戰力 {Math.round(o.power)}{o.petTypeName ? `・${o.petTypeName}` : ""}</span>{me.petType && o.petType && PET_COUNTER[me.petType].includes(o.petType) ? <span style={{ fontSize: 11, color: C.green, marginLeft: 6 }}>你剋他</span> : null}{me.petType && o.petType && PET_COUNTER[o.petType].includes(me.petType) ? <span style={{ fontSize: 11, color: C.red, marginLeft: 6 }}>他剋你</span> : null}</span>
            <button disabled={busy || d.left <= 0} onClick={async () => { const r = await post({ action: "pvDuel", to: o.id }); if (r) setReplay(r); }} style={{ ...s.btn("secondary"), width: "auto", padding: "5px 10px", fontSize: 12, opacity: d.left <= 0 ? .4 : 1 }}>自動切磋</button>
            <button disabled={busy} onClick={async () => { const r = await post({ action: "pvLiveInvite", to: o.id }); if (r) { flash("已送出邀請，等對方接受"); setLive(r.id); } }} style={{ ...s.btn("primary"), width: "auto", padding: "5px 10px", fontSize: 12 }}>即時對戰</button>
          </div>))}
        <div style={{ fontSize: 11, color: C.light, marginTop: 8 }}>友善切磋：輸了不扣任何東西；贏了 +2 枚（每天有上限，見「赤心幣規則」）。即時對戰需要對方在 2 分鐘內接受，每回合 {d.roundSec} 秒。</div>
      </div>

      <div style={s.card}>
        <div style={s.sectionTitle}>本月勝場排行</div>
        {d.ranking.length === 0 && <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: 8 }}>還沒有人對戰</div>}
        {d.ranking.map((r, i) => <div key={r.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0" }}><span>{["🥇", "🥈", "🥉"][i] || i + 1 + "."} {r.name}</span><b>{r.wins} 勝</b></div>)}
      </div>
      {d.history.length > 0 && <div style={s.card}>
        <div style={s.sectionTitle}>我的戰績</div>
        {d.history.map((h, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "4px 0" }}><span>{h.mode}・vs {h.vsName}</span><span style={{ color: h.win ? C.green : C.muted }}>{h.win ? "勝" : "敗"}・{h.time.slice(5, 16)}</span></div>)}
      </div>}
      {toast && <Flash text={toast} />}
    </div>
  );
}
