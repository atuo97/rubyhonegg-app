// v1.39：選人選單（不用再輸入員工編號）＋ 發幣與限定造型頁
// 後端：pplPick（Lv.3 以上，以登入通行證本人為準）
import { useState, useEffect } from "react";
import { Flash } from "./TopToast.jsx";
import { HATS } from "./universe/avatarCatalog.js";
import { MountGrant } from "./Mount40.jsx";

const TYPES = [["員工", "隊員"], ["合作夥伴", "合作品牌"], ["加盟店夥伴", "加盟店"]];

// 選人：先選類別，再點名字（可搜尋）。value 是員工編號
export function PeoplePicker({ apiGet, C, s, value, onChange }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState("");
  const [type, setType] = useState("員工");
  const [q, setQ] = useState("");
  useEffect(() => {
    apiGet({ action: "pplPick" }, 1).then(r => {
      if (r && r.success) setList(r.data || []);
      else { setList([]); setErr(r && /未知的動作/.test(r.error || "") ? "後端更新到 v1.39 後才能用選人選單" : (r && r.error) || "讀不到隊員清單"); }
    });
  }, []);
  const picked = (list || []).find(p => p.id === value);
  const chip = on => ({ border: `1px solid ${on ? C.accent : C.border}`, background: on ? C.accentBg : C.card, color: on ? C.accent : C.text, borderRadius: 999, padding: "6px 12px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" });
  if (picked) return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", border: `1.5px solid ${C.accent}`, borderRadius: 12, background: C.accentBg, marginBottom: 8 }}>
      <span style={{ flex: 1, fontSize: 14 }}><b>{picked.name}</b><span style={{ fontSize: 11.5, color: C.muted, marginLeft: 6 }}>{(TYPES.find(t => t[0] === picked.type) || [, picked.type])[1]}{picked.locs ? "・" + picked.locs : ""}</span></span>
      <button onClick={() => onChange("")} style={{ border: "none", background: "none", color: C.muted, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>換人</button>
    </div>
  );
  const shown = (list || []).filter(p => (q ? true : p.type === type) && (!q || (p.name + p.id + p.locs).includes(q.trim())));
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        {TYPES.map(([k, label]) => <button key={k} onClick={() => { setType(k); setQ(""); }} style={chip(!q && type === k)}>{label}{list ? ` ${list.filter(p => p.type === k).length}` : ""}</button>)}
      </div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="搜尋名字或櫃位" style={{ ...s.input, marginBottom: 6 }} />
      {list === null && <div className="rh-skel" style={{ height: 48 }} />}
      {err && <div style={{ fontSize: 12.5, color: C.red }}>{err}</div>}
      <div style={{ maxHeight: 220, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 12, display: list && list.length ? "block" : "none" }}>
        {shown.map(p => (
          <button key={p.id} onClick={() => onChange(p.id)} style={{ display: "flex", width: "100%", gap: 8, alignItems: "center", padding: "9px 12px", border: "none", borderBottom: `1px solid ${C.border}`, background: C.card, cursor: "pointer", fontFamily: "inherit", textAlign: "left", color: C.text }}>
            <span style={{ flex: 1, fontSize: 13.5 }}>{p.name}</span>
            <span style={{ fontSize: 11, color: C.muted }}>{p.locs || p.pos}</span>
          </button>
        ))}
        {list && shown.length === 0 && <div style={{ fontSize: 12.5, color: C.muted, textAlign: "center", padding: 10 }}>這一類目前沒有人</div>}
      </div>
    </div>
  );
}

export function GrantPage({ user, apiGet, apiPost, C, s }) {
  const isTop = user.role >= 5;
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [adm, setAdm] = useState({ target: "", amount: "", reason: "", badge: "" });
  const [g, setG] = useState({ target: "", item: (HATS.find(h => h.kind === "limited") || {}).id || "crown" });
  const flash = (text, ok) => setMsg({ text, ok, t: Date.now() });

  const sendCoin = async () => {
    setBusy(true);
    const r = await apiPost({ action: "gmAdmin", empId: user.id, ...adm }, 0);
    setBusy(false);
    if (r && r.success) { flash("✅ 已完成", true); setAdm({ target: "", amount: "", reason: "", badge: "" }); } else flash((r && r.error) || "操作失敗", false);
  };
  const sendItem = async () => {
    setBusy(true);
    const r = await apiPost({ action: "grantItem", empId: user.id, target: g.target, item: g.item }, 0);
    setBusy(false);
    if (r && r.success) { flash("✅ 已發放", true); setG(x => ({ ...x, target: "" })); } else flash((r && r.error) || "發放失敗", false);
  };

  return (
    <div>
      {msg && <Flash key={msg.t} text={msg.text} kind={msg.ok ? "ok" : "bad"} />}
      {isTop && (
        <div style={s.card}>
          <div style={s.sectionTitle}>補發／扣回赤心幣・頒徽章</div>
          <PeoplePicker apiGet={apiGet} C={C} s={s} value={adm.target} onChange={v => setAdm(a => ({ ...a, target: v }))} />
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <select value={adm.badge} onChange={e => setAdm(a => ({ ...a, badge: e.target.value }))} style={{ ...s.input, flex: 1 }}>
              <option value="">補發／扣回赤心幣</option><option value="mentor">頒發「好導師」徽章（+50）</option><option value="special">頒發「特別貢獻」徽章</option><option value="debugger">頒發「除錯大師」徽章（+20，每人最多 5 次）</option>
            </select>
            <input type="number" value={adm.amount} onChange={e => setAdm(a => ({ ...a, amount: e.target.value }))} placeholder={adm.badge ? "加幣（選填）" : "數量（可負）"} style={{ ...s.input, width: 110 }} />
          </div>
          <input value={adm.reason} onChange={e => setAdm(a => ({ ...a, reason: e.target.value }))} placeholder="理由（必填，會留紀錄）" style={{ ...s.input, marginBottom: 8 }} />
          <button disabled={busy || !adm.target || !adm.reason.trim()} onClick={sendCoin} style={{ ...s.btn("primary"), opacity: busy || !adm.target || !adm.reason.trim() ? .5 : 1 }}>送出</button>
        </div>
      )}
      <div style={s.card}>
        <div style={s.sectionTitle}>發放限定造型</div>
        <PeoplePicker apiGet={apiGet} C={C} s={s} value={g.target} onChange={v => setG(x => ({ ...x, target: v }))} />
        <select value={g.item} onChange={e => setG(x => ({ ...x, item: e.target.value }))} style={{ ...s.input, marginBottom: 8 }}>
          {HATS.filter(h => h.kind === "limited").map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <button disabled={busy || !g.target} onClick={sendItem} style={{ ...s.btn("primary"), opacity: busy || !g.target ? .5 : 1 }}>發放</button>
      </div>
      <MountGrant apiGet={apiGet} apiPost={apiPost} C={C} s={s} />
    </div>
  );
}
