// ─────────────────────────────────────────────
// 夥伴小店(商店街)。累計工時達門檻可開店;收入店主 80%、系統 20%。後端:spList / spOpen / spUpdate / spBuy / spGiftRead
// ─────────────────────────────────────────────
import { useEffect, useState } from "react";
import { Flash } from "./TopToast.jsx";
import { Coin, Heart } from "./Coin.jsx";
import { TryOn } from "./GameTab.jsx";   // v1.33 點商品看詳細

const TYPE_ICON = { "咖啡店": "☕", "甜點店": "🧁", "花店": "💐", "武器鋪": "⚔️", "卡片屋": "🃏", "雜貨店": "🧸" };
const CAT_LABEL = { gift: "禮物（送同事）", petsnack: "寵物零食", decor: "收藏", weapon: "武器", armor: "防具", card: "對戰卡片" };
const effectText = e => { const a = String(e || "").split(":"); if (a[0] === "petsnack") return `寵物成長 +${a[1]} 小時`; if (a[0] === "card") return { heal: "補血", power: "增強攻擊", shield: "護盾" }[a[1]] + " " + a[2]; if (a[0] === "gift" || a[0] === "decor") return a[1]; return String(e || "").replace(/atk/g, "攻").replace(/def/g, "防").replace(/hp/g, "血").replace(/spd/g, "速").replace(/:/g, "+"); };

export default function ShopStreetTab({ user, apiGet, apiPost, C, s, staff }) {
  const [peek, setPeek] = useState(null);
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(null);       // 正在逛的店
  const [manage, setManage] = useState(false);
  const [form, setForm] = useState({ type: "咖啡店", name: "" });
  const [edit, setEdit] = useState(null);
  const [giftTo, setGiftTo] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => { const r = await apiGet({ action: "spList", empId: user.id }, 1); if (r && r.success) { setD(r.data); setErr(""); } else setErr((r && r.error) || "小店功能尚未開通"); };
  useEffect(() => { load(); }, []);
  const flash = t => { setToast(t); setTimeout(() => setToast(""), 2600); };
  const post = async (payload, ok) => { setBusy(true); const r = await apiPost({ empId: user.id, ...payload }, 0); setBusy(false); if (r && r.success) { ok && flash(ok); await load(); return true; } flash((r && r.error) || "失敗"); return false; };
  if (err) return <div style={{ ...s.card, textAlign: "center", color: C.muted }}>{err}</div>;
  if (!d) return <div className="rh-skel" style={{ height: 160, borderRadius: 18 }} />;
  const people = d.people || (staff || []).filter(p => String(p.id) !== String(user.id));

  // 逛某一家店
  if (open) {
    const shop = d.shops.find(x => x.owner === open.owner) || open;
    return (
      <div>
        <button onClick={() => setOpen(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontFamily: "inherit", fontSize: 14, marginBottom: 8 }}>‹ 回商店街</button>
        <div style={{ ...s.card, textAlign: "center" }}>
          <div style={{ fontSize: 36 }}>{TYPE_ICON[shop.type]}</div>
          <div style={{ fontSize: 17, fontWeight: 600 }}>{shop.name}</div>
          <div style={{ fontSize: 12, color: C.muted }}>{shop.type}・店主 {shop.ownerName}・Lv.{shop.level}</div>
          {shop.notice && <div style={{ fontSize: 12.5, marginTop: 6 }}>「{shop.notice}」</div>}
          <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>我的餘額 {d.balance} 枚</div>
        </div>
        {shop.items.map(it => (
          <div key={it.id} style={{ ...s.card, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setPeek(it)}><div style={{ fontSize: 14, fontWeight: 600 }}>{it.name} <span style={{ fontSize: 10.5, color: C.accent, fontWeight: 500 }}>看看</span></div><div style={{ fontSize: 11.5, color: C.muted }}>{CAT_LABEL[it.cat]}・{effectText(it.effect)}</div></div>
            {it.cat === "gift" && <select value={giftTo} onChange={e => setGiftTo(e.target.value)} style={{ ...s.input, width: 100, padding: "7px 8px", fontSize: 12.5 }}>
              <option value="">送給…</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
            <button disabled={busy || shop.owner === user.id || (it.cat === "gift" && !giftTo)} onClick={() => post({ action: "spBuy", owner: shop.owner, item: it.id, to: giftTo }, it.cat === "gift" ? "禮物送出了！" : "買到了！")}
              style={{ ...s.btn("primary"), width: "auto", padding: "7px 12px", fontSize: 12.5, opacity: busy || shop.owner === user.id || (it.cat === "gift" && !giftTo) ? .5 : 1 }}><Coin n={it.price} size={12} /></button>
          </div>))}
        {peek && <TryOn item={{ ...peek, note: CAT_LABEL[peek.cat] + "・" + effectText(peek.effect), price: peek.cat === "gift" && !giftTo ? 0 : peek.price, where: peek.cat === "gift" && !giftTo ? "先在清單選「送給…」" : "" }}
          user={user} apiGet={apiGet} balance={d.balance} busy={busy} C={C} s={s} onClose={() => setPeek(null)}
          onBuy={async () => { const it = peek; setPeek(null); await post({ action: "spBuy", owner: shop.owner, item: it.id, to: giftTo }, it.cat === "gift" ? "禮物送出了！" : "買到了！"); }} />}
        {toast && <Flash text={toast} />}
      </div>
    );
  }

  const my = d.mine;
  return (
    <div>
      {d.gifts.some(g => g.unread) && (
        <div style={{ ...s.card, background: "#fff6e8" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><div style={s.sectionTitle}>收到的禮物</div>
            <button onClick={() => post({ action: "spGiftRead" })} style={{ border: "none", background: "none", fontSize: 12, color: C.muted, cursor: "pointer" }}>全部已讀</button></div>
          {d.gifts.filter(g => g.unread).map((g, i) => <div key={i} style={{ fontSize: 13, padding: "4px 0" }}>{g.icon} <b>{g.from}</b> 送你一份{g.item}</div>)}
        </div>)}

      <div style={s.card}>
        <div style={s.sectionTitle}>我的小店</div>
        {!my && !d.eligible && <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>累計工時達 {d.threshold} 小時（資歷・銅徽章）就可以開自己的小店，賣東西給夥伴賺赤心幣。</div>}
        {!my && d.eligible && (!manage ? <button onClick={() => setManage(true)} style={s.btn("primary")}>🏪 開一家小店（開店費 {d.fee} 枚）</button> : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 10 }}>
              {d.types.map(t => <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))} style={{ border: `1.5px solid ${form.type === t ? C.accent : C.border}`, background: form.type === t ? C.accentBg : C.card, borderRadius: 12, padding: "8px 0", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5 }}>{TYPE_ICON[t]}<br />{t}</button>)}
            </div>
            <input value={form.name} maxLength={12} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="店名（12 字內）" style={{ ...s.input, marginBottom: 10 }} />
            <button disabled={busy || !form.name.trim()} onClick={async () => { if (await post({ action: "spOpen", ...form }, "開店成功！")) setManage(false); }} style={{ ...s.btn("primary"), opacity: busy || !form.name.trim() ? .5 : 1 }}>確定開店（{d.fee} 枚）</button>
          </>))}
        {my && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 30 }}>{TYPE_ICON[my.type]}</span>
              <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 600 }}>{my.name}</div><div style={{ fontSize: 12, color: C.muted }}>{my.type}・Lv.{my.level}・已售出 {my.sales} 件</div></div>
              <button onClick={() => setEdit(edit ? null : { name: my.name, notice: my.notice || "", prices: Object.fromEntries(my.items.map(i => [i.id, i.price])) })} style={{ ...s.btn("secondary"), width: "auto", padding: "6px 12px", fontSize: 12.5 }}>{edit ? "收起" : "管理"}</button>
            </div>
            {edit && <div style={{ marginTop: 12 }}>
              <input value={edit.name} maxLength={12} onChange={e => setEdit(x => ({ ...x, name: e.target.value }))} style={{ ...s.input, marginBottom: 8 }} />
              <input value={edit.notice} maxLength={40} onChange={e => setEdit(x => ({ ...x, notice: e.target.value }))} placeholder="店內公告（40 字內）" style={{ ...s.input, marginBottom: 8 }} />
              {my.items.map(i => <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                <span style={{ flex: 1, fontSize: 13 }}>{i.name}<span style={{ fontSize: 11, color: C.light }}>（{i.min}～{i.max}）</span></span>
                <input type="number" value={edit.prices[i.id]} min={i.min} max={i.max} onChange={e => setEdit(x => ({ ...x, prices: { ...x.prices, [i.id]: e.target.value } }))} style={{ ...s.input, width: 80, padding: "7px 8px" }} /></div>)}
              <button disabled={busy} onClick={async () => { if (await post({ action: "spUpdate", name: edit.name, notice: edit.notice, prices: JSON.stringify(edit.prices) }, "已更新")) setEdit(null); }} style={{ ...s.btn("primary"), marginTop: 8 }}>儲存</button>
              <div style={{ fontSize: 11, color: C.light, marginTop: 6 }}>每筆收入你拿 {d.share}%，其餘由系統回收</div>
            </div>}
          </>)}
      </div>

      <div style={s.card}>
        <div style={s.sectionTitle}>商店街（{d.shops.length} 家）</div>
        {d.shops.length === 0 && <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: 10 }}>還沒有夥伴開店</div>}
        {d.shops.map(x => (
          <button key={x.owner} onClick={() => { setOpen(x); setGiftTo(""); }} style={{ display: "flex", width: "100%", alignItems: "center", gap: 10, border: "none", borderBottom: `1px solid ${C.border}`, background: "none", padding: "10px 0", cursor: "pointer", fontFamily: "inherit", textAlign: "left", color: C.text }}>
            <span style={{ fontSize: 26 }}>{TYPE_ICON[x.type]}</span>
            <span style={{ flex: 1 }}><b style={{ fontSize: 14 }}>{x.name}</b>{x.owner === user.id ? <span style={{ fontSize: 11, color: C.accent, marginLeft: 6 }}>我的店</span> : null}<div style={{ fontSize: 11.5, color: C.muted }}>{x.type}・{x.ownerName}・Lv.{x.level}</div></span>
            <span style={{ color: C.light }}>›</span>
          </button>))}
      </div>
      {toast && <Flash text={toast} />}
    </div>
  );
}
