// v1.40 坐騎：一般款赤心幣永久買斷；品牌款每月依上個月上班時數前 5 名分配（一個月）
// 後端：v40MountMe／v40MountBuy／v40MountRide／v40MountGrant
import { useState, useEffect } from "react";
import { Flash } from "./TopToast.jsx";
import { PeoplePicker } from "./People39.jsx";

export const MOUNT_INFO = {
  bike: { name: "腳踏車", icon: "🚲", price: 50 }, scooter: { name: "機車", icon: "🛵", price: 120 }, car: { name: "汽車", icon: "🚗", price: 250 },
  suv: { name: "休旅車", icon: "🚙", price: 300 }, truck: { name: "貨車", icon: "🚚", price: 300 }, sports: { name: "跑車", icon: "🏎️", price: 500 },
  trex: { name: "小暴龍", icon: "🦖", brand: true }, train: { name: "火車", icon: "🚂", brand: true }, digger: { name: "挖土機", icon: "🚜", brand: true },
  trike: { name: "三角龍", icon: "🦕", brand: true }, bird: { name: "赤心大鳥", icon: "🐤", brand: true },
};
const BRAND_RANK = ["trex", "train", "digger", "trike", "bird"];
const md = d => (d ? String(d).slice(5).replace("-", "/") : "");

export function MountShop({ apiGet, apiPost, C, s, onChanged }) {
  const [d, setD] = useState(null), [busy, setBusy] = useState(false), [msg, setMsg] = useState(null);
  const load = () => apiGet({ action: "v40MountMe" }, 0).then(r => setD(r && r.success ? r.data : { error: (r && r.error) || "讀取失敗" }));
  useEffect(() => { load(); }, []);
  const act = async (payload, ok) => {
    setBusy(true); const r = await apiPost(payload, 0); setBusy(false);
    if (r && r.success) { setMsg({ ok: true, text: "✅ " + ok, t: Date.now() }); load(); onChanged && onChanged(); }
    else setMsg({ ok: false, text: (r && r.error) || "操作失敗", t: Date.now() });
  };
  if (!d) return <div className="rh-skel" style={{ height: 200, borderRadius: 18 }} />;
  if (d.error) return <div style={{ ...s.card, color: C.muted, textAlign: "center" }}>{/未知/.test(d.error) ? "坐騎還沒開通（後端更新到 v1.40 後就會出現）" : d.error}</div>;
  const own = d.owned || {};
  const tile = (id) => {
    const M = MOUNT_INFO[id], has = own[id] !== undefined, using = d.ride === id;
    return (
      <div key={id} style={{ border: `1px solid ${using ? C.accent : C.border}`, borderRadius: 14, padding: 10, background: using ? C.accentBg : has ? C.warm : C.card }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <span style={{ fontSize: 28 }}>{M.icon}</span>
          {has && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", background: using ? C.accent : C.green, borderRadius: 999, padding: "1px 8px" }}>{using ? "✓ 騎乘中" : "✓ 已擁有"}</span>}
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 4 }}>{M.name}</div>
        <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 6 }}>{M.brand ? (has && own[id] ? `到 ${md(own[id])}` : "每月工時前 5 名") : has ? "永久" : `${M.price} 枚・永久`}</div>
        {has ? (!using && <button disabled={busy} onClick={() => act({ action: "v40MountRide", id }, `換騎 ${M.name}`)} style={{ ...s.btn("secondary"), padding: "7px 0", fontSize: 13 }}>騎這台</button>)
          : !M.brand && <button disabled={busy || d.balance < M.price} onClick={() => act({ action: "v40MountBuy", id }, `買到${M.icon}${M.name}了！`)} style={{ ...s.btn("primary"), padding: "7px 0", fontSize: 13, opacity: d.balance < M.price ? .5 : 1 }}>❤️ {M.price}</button>}
      </div>
    );
  };
  const al = d.alloc;
  return (
    <div>
      {msg && <Flash key={msg.t} text={msg.text} kind={msg.ok ? "ok" : "bad"} />}
      <div style={{ ...s.card, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px" }}>
        <span style={{ fontSize: 13 }}>餘額 <b style={{ color: C.gold }}>{Number(d.balance || 0).toLocaleString()} 枚</b></span>
        {d.ride && <button disabled={busy} onClick={() => act({ action: "v40MountRide", id: "none" }, "下車，改走路")} style={{ border: "none", background: "none", color: C.muted, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>🚶 改走路</button>}
      </div>
      <div style={s.sectionTitle}>一般款（永久買斷）</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>{["bike", "scooter", "car", "suv", "truck", "sports"].map(tile)}</div>
      <div style={s.sectionTitle}>品牌款（每月上班時數前 5 名，期限一個月）</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>{BRAND_RANK.map(tile)}</div>
      <MountAcc apiGet={apiGet} apiPost={apiPost} C={C} s={s} onChanged={onChanged} />
      <div style={{ ...s.card, fontSize: 12.5, lineHeight: 1.7 }}>
        <b>本月得主</b>{al && al.winners && al.winners.length ? al.winners.map((w, i) => <div key={w.emp}>第 {i + 1} 名 {MOUNT_INFO[w.mount].icon} {w.name}（{al.from} 共 {w.hours} 小時）</div>) : <div style={{ color: C.muted }}>每月 1 日公布，依上個月上班時數排名</div>}
      </div>
    </div>
  );
}

// 管理者發坐騎（放在「發幣與限定造型」頁）
export function MountGrant({ apiGet, apiPost, C, s }) {
  const [target, setTarget] = useState(""), [id, setId] = useState("trex"), [busy, setBusy] = useState(false), [msg, setMsg] = useState(null);
  const send = async () => {
    setBusy(true); const r = await apiPost({ action: "v40MountGrant", target, id }, 0); setBusy(false);
    if (r && r.success) { setMsg({ ok: true, text: "✅ 已發放", t: Date.now() }); setTarget(""); } else setMsg({ ok: false, text: (r && r.error) || "發放失敗", t: Date.now() });
  };
  return (
    <div style={s.card}>
      {msg && <Flash key={msg.t} text={msg.text} kind={msg.ok ? "ok" : "bad"} />}
      <div style={s.sectionTitle}>發放坐騎（一般款永久、品牌款一個月）</div>
      <PeoplePicker apiGet={apiGet} C={C} s={s} value={target} onChange={setTarget} />
      <select value={id} onChange={e => setId(e.target.value)} style={{ ...s.input, marginBottom: 8 }}>
        {Object.keys(MOUNT_INFO).map(k => <option key={k} value={k}>{MOUNT_INFO[k].icon} {MOUNT_INFO[k].name}{MOUNT_INFO[k].brand ? "（一個月）" : "（永久）"}</option>)}
      </select>
      <button disabled={busy || !target} onClick={send} style={{ ...s.btn("primary"), opacity: busy || !target ? .5 : 1 }}>發放</button>
    </div>
  );
}

// v1.44 v3 坐騎配件：在商店街「坐騎改裝店」買，這裡裝上（最多 3 個，換哪台坐騎都跟著）
function MountAcc({ apiGet, apiPost, C, s, onChanged }) {
  const [d, setD] = useState(null), [busy, setBusy] = useState(false), [msg, setMsg] = useState(null);
  const load = () => apiGet({ action: "v44MaccMe" }, 0).then(r => setD(r && r.success ? r.data : null));
  useEffect(() => { load(); }, []);
  if (!d) return null;
  const own = d.owned || [], on = d.on || [];
  const toggle = async id => {
    const next = on.includes(id) ? on.filter(x => x !== id) : [...on, id];
    if (next.length > d.max) { setMsg({ ok: false, text: `最多同時裝 ${d.max} 個，先拆下一個`, t: Date.now() }); return; }
    setBusy(true); const r = await apiPost({ action: "v44MaccSet", on: next }, 0); setBusy(false);
    if (r && r.success) { setD({ ...d, on: r.data.on }); onChanged && onChanged(); } else setMsg({ ok: false, text: (r && r.error) || "失敗", t: Date.now() });
  };
  return (
    <div style={{ marginBottom: 14 }}>
      {msg && <Flash key={msg.t} text={msg.text} kind={msg.ok ? "ok" : "bad"} />}
      <div style={s.sectionTitle}>🔧 坐騎配件（裝上 {on.length}／{d.max}）</div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>到「隊員商店街」的坐騎改裝店買配件，買到後在這裡點一下裝上或拆下；換騎哪一台都會跟著。</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
        {d.list.map(m => { const has = own.includes(m.id), u = on.includes(m.id); return (
          <button key={m.id} disabled={!has || busy} onClick={() => toggle(m.id)} style={{ border: `1.5px solid ${u ? C.accent : C.border}`, background: u ? C.accentBg : has ? C.card : C.warm, borderRadius: 12, padding: "8px 2px", cursor: has ? "pointer" : "default", fontFamily: "inherit", opacity: has ? 1 : .5 }}>
            <div style={{ fontSize: 22 }}>{m.icon}</div><div style={{ fontSize: 11, color: C.text }}>{m.name}</div>
            <div style={{ fontSize: 10, color: u ? C.accent : C.muted }}>{u ? "✓ 裝上中" : has ? "點一下裝上" : "未擁有"}</div>
          </button>); })}
      </div>
    </div>
  );
}
