// ─────────────────────────────────────────────
// 隊員小店(商店街)。累計工時達門檻可開店;收入店主 80%、系統 20%。後端:spList / spOpen / spUpdate / spBuy / spGiftRead
// ─────────────────────────────────────────────
import { useEffect, useState } from "react";
import { Flash } from "./TopToast.jsx";
import { Coin, Heart } from "./Coin.jsx";
import { TryOn } from "./GameTab.jsx";   // v1.33 點商品看詳細

const TYPE_ICON = { "咖啡店": "☕", "甜點店": "🧁", "花店": "💐", "武器鋪": "⚔️", "卡片屋": "🃏", "雜貨店": "🧸",
  "服飾店": "👕", "陀螺對戰店": "🌀", "寵物用品店": "🐾", "書店": "📚", "照相館": "📸", "家具行": "🛋️", "冰店": "🍧", "玩具店": "🧸", "坐騎改裝店": "🔧" };   // v1.40 新店種
const CAT_LABEL = { gift: "禮物（送同事）", petsnack: "寵物零食", decor: "收藏", weapon: "武器", armor: "防具", card: "對戰卡片", wear: "造型（買了就能穿）" };
const effectText = e => { const a = String(e || "").split(":"); if (a[0] === "wear") return /^macc_/.test(a[1]) ? "坐騎配件，到「赤心幣商店 → 坐騎」裝上" : "到「我的造型」換上"; if (a[0] === "petsnack") return `寵物成長 +${a[1]} 小時`; if (a[0] === "card") return { heal: "補血", power: "增強攻擊", shield: "護盾" }[a[1]] + " " + a[2]; if (a[0] === "gift" || a[0] === "decor") return a[1]; return String(e || "").replace(/atk/g, "攻").replace(/def/g, "防").replace(/hp/g, "血").replace(/spd/g, "速").replace(/:/g, "+"); };

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
  const [editKey, setEditKey] = useState("");       // v1.40 正在管理哪一家
  const [topup, setTopup] = useState("");
  const [prop, setProp] = useState({ name: "", idea: "" });
  const load = async () => { const r = await apiGet({ action: "spList", empId: user.id }, 1); if (r && r.success) { setD(r.data); setErr(""); } else setErr((r && r.error) || "小店功能尚未開通"); };
  useEffect(() => { load(); }, []);
  const flash = t => { setToast(t); setTimeout(() => setToast(""), 2600); };
  const post = async (payload, ok) => { setBusy(true); const r = await apiPost({ empId: user.id, ...payload }, 0); setBusy(false); if (r && r.success) { ok && flash(ok); await load(); return true; } flash((r && r.error) || "失敗"); return false; };
  if (err) return <div style={{ ...s.card, textAlign: "center", color: C.muted }}>{err}</div>;
  if (!d) return <div className="rh-skel" style={{ height: 160, borderRadius: 18 }} />;
  const people = d.people || (staff || []).filter(p => String(p.id) !== String(user.id));

  // 逛某一家店
  if (open) {
    const shop = d.shops.find(x => (x.key || x.owner) === (open.key || open.owner)) || open;
    return (
      <div>
        <button onClick={() => setOpen(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontFamily: "inherit", fontSize: 14, marginBottom: 8 }}>‹ 回商店街</button>
        <div style={{ ...s.card, textAlign: "center" }}>
          <div style={{ fontSize: 36 }}>{TYPE_ICON[shop.type] || "🏪"}</div>
          <div style={{ fontSize: 17, fontWeight: 600 }}>{shop.name}</div>
          <div style={{ fontSize: 12, color: C.muted }}>{shop.type}・店主 {shop.ownerName}・Lv.{shop.level}</div>
          {shop.notice && <div style={{ fontSize: 12.5, marginTop: 6 }}>「{shop.notice}」</div>}
          {shop.status === "暫停營業" && <div style={{ fontSize: 12.5, marginTop: 6, color: C.red }}>⏸ 營運金不足，暫停營業中</div>}
          <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>我的餘額 {d.balance} 枚</div>
        </div>
        {shop.items.map(it => (
          <div key={it.id} style={{ ...s.card, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, cursor: "pointer" }} onClick={() => setPeek(it)}><div style={{ fontSize: 14, fontWeight: 600 }}>{it.name} <span style={{ fontSize: 10.5, color: C.accent, fontWeight: 500 }}>看看</span></div><div style={{ fontSize: 11.5, color: C.muted }}>{CAT_LABEL[it.cat]}・{effectText(it.effect)}</div></div>
            {it.cat === "gift" && <select value={giftTo} onChange={e => setGiftTo(e.target.value)} style={{ ...s.input, width: 100, padding: "7px 8px", fontSize: 12.5 }}>
              <option value="">送給…</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
            <button disabled={busy || shop.owner === user.id || (it.cat === "gift" && !giftTo)} onClick={() => post({ action: "spBuy", owner: shop.key || shop.owner, item: it.id, to: giftTo }, it.cat === "gift" ? "禮物送出了！" : "買到了！")}
              style={{ ...s.btn("primary"), width: "auto", padding: "7px 12px", fontSize: 12.5, opacity: busy || shop.owner === user.id || (it.cat === "gift" && !giftTo) ? .5 : 1 }}><Coin n={it.price} size={12} /></button>
          </div>))}
        {peek && <TryOn item={{ ...peek, note: CAT_LABEL[peek.cat] + "・" + effectText(peek.effect), price: peek.cat === "gift" && !giftTo ? 0 : peek.price, where: peek.cat === "gift" && !giftTo ? "先在清單選「送給…」" : "" }}
          user={user} apiGet={apiGet} balance={d.balance} busy={busy} C={C} s={s} onClose={() => setPeek(null)}
          onBuy={async () => { const it = peek; setPeek(null); await post({ action: "spBuy", owner: shop.key || shop.owner, item: it.id, to: giftTo }, it.cat === "gift" ? "禮物送出了！" : "買到了！"); }} />}
        {toast && <Flash text={toast} />}
      </div>
    );
  }

  const mine = d.myShops || (d.mine ? [d.mine] : []);
  const cost = d.cost || { rent: 30, util: 10, month: 40 };
  const maxN = d.maxShops || 1;
  const openForm = (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 10 }}>
        {d.types.map(t => <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))} style={{ border: `1.5px solid ${form.type === t ? C.accent : C.border}`, background: form.type === t ? C.accentBg : C.card, borderRadius: 12, padding: "8px 0", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5 }}>{TYPE_ICON[t] || "🏪"}<br />{t}</button>)}
      </div>
      <input value={form.name} maxLength={12} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="店名（12 字內）" style={{ ...s.input, marginBottom: 8 }} />
      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginBottom: 8, background: C.warm, borderRadius: 10, padding: "8px 10px" }}>
        開店要先付：開店費 {d.fee} 枚 ＋ 預付營運金 {cost.month} 枚（一個月）。<br />
        營運成本每月 {cost.month} 枚（月租 {cost.rent}＋水電 {cost.util}），每天按比例從營運金扣；扣不夠會暫停營業，儲值後恢復。結束營業時，剩下的營運金退回。
      </div>
      <button disabled={busy || !form.name.trim()} onClick={async () => { if (await post({ action: "spOpen", ...form }, "開店成功！")) setManage(false); }} style={{ ...s.btn("primary"), opacity: busy || !form.name.trim() ? .5 : 1 }}>確定開店（{d.fee + cost.month} 枚）</button>
      <button onClick={() => setManage(false)} style={{ ...s.btn("ghost"), marginTop: 6 }}>取消</button>
    </>
  );
  return (
    <div>
      {d.gifts.some(g => g.unread) && (
        <div style={{ ...s.card, background: "#fff6e8" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><div style={s.sectionTitle}>收到的禮物</div>
            <button onClick={() => post({ action: "spGiftRead" })} style={{ border: "none", background: "none", fontSize: 12, color: C.muted, cursor: "pointer" }}>全部已讀</button></div>
          {d.gifts.filter(g => g.unread).map((g, i) => <div key={i} style={{ fontSize: 13, padding: "4px 0" }}>{g.icon} <b>{g.from}</b> 送你一份{g.item}</div>)}
        </div>)}

      <div style={s.card}>
        <div style={{ ...s.sectionTitle, display: "flex", justifyContent: "space-between" }}><span>我的小店</span>{maxN > 1 && <span style={{ letterSpacing: 0, fontWeight: 400 }}>{mine.length}／{maxN} 家</span>}</div>
        {mine.length === 0 && !d.eligible && <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>累計工時達 {d.threshold} 小時（資歷・銅徽章）就可以開自己的小店，賣東西給隊員賺赤心幣。</div>}
        {mine.map(my => {
          const k = my.key || my.owner, on = editKey === k;
          const days = my.fund != null && cost.month ? Math.floor(my.fund / (cost.month / 30)) : null;
          return (
            <div key={k} style={{ borderBottom: `1px solid ${C.border}`, padding: "8px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 30 }}>{TYPE_ICON[my.type] || "🏪"}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{my.name}{my.status === "暫停營業" && <span style={{ fontSize: 11, color: C.red, marginLeft: 6 }}>⏸ 暫停營業</span>}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{my.type}・Lv.{my.level}・已售出 {my.sales} 件</div>
                  {my.fund != null && <div style={{ fontSize: 12, color: my.status === "暫停營業" || (days != null && days < 7) ? C.red : C.muted }}>營運金 {my.fund} 枚{days != null ? `（約可再營業 ${days} 天）` : ""}</div>}
                </div>
                <button onClick={() => { setEditKey(on ? "" : k); setTopup(""); setEdit(on ? null : { name: my.name, notice: my.notice || "", prices: Object.fromEntries(my.items.map(i => [i.id, i.price])) }); }} style={{ ...s.btn("secondary"), width: "auto", padding: "6px 12px", fontSize: 12.5 }}>{on ? "收起" : "管理"}</button>
              </div>
              {on && edit && <div style={{ marginTop: 12 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <input type="number" inputMode="numeric" value={topup} onChange={e => setTopup(e.target.value)} placeholder={`儲值營運金（每月 ${cost.month}）`} style={{ ...s.input, flex: 1 }} />
                  <button disabled={busy || !(Number(topup) > 0)} onClick={async () => { if (await post({ action: "spTopup", shop: k, amount: topup }, "已儲值營運金")) setTopup(""); }} style={{ ...s.btn("primary"), width: "auto", padding: "0 14px", opacity: busy || !(Number(topup) > 0) ? .5 : 1 }}>儲值</button>
                </div>
                <input value={edit.name} maxLength={12} onChange={e => setEdit(x => ({ ...x, name: e.target.value }))} style={{ ...s.input, marginBottom: 8 }} />
                <input value={edit.notice} maxLength={40} onChange={e => setEdit(x => ({ ...x, notice: e.target.value }))} placeholder="店內公告（40 字內）" style={{ ...s.input, marginBottom: 8 }} />
                {my.items.map(i => <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                  <span style={{ flex: 1, fontSize: 13 }}>{i.name}<span style={{ fontSize: 11, color: C.light }}>（{i.min}～{i.max}）</span></span>
                  <input type="number" value={edit.prices[i.id]} min={i.min} max={i.max} onChange={e => setEdit(x => ({ ...x, prices: { ...x.prices, [i.id]: e.target.value } }))} style={{ ...s.input, width: 80, padding: "7px 8px" }} /></div>)}
                <button disabled={busy} onClick={async () => { if (await post({ action: "spUpdate", shop: k, name: edit.name, notice: edit.notice, prices: JSON.stringify(edit.prices) }, "已更新")) { setEdit(null); setEditKey(""); } }} style={{ ...s.btn("primary"), marginTop: 8 }}>儲存</button>
                <div style={{ fontSize: 11, color: C.light, marginTop: 6 }}>每筆收入你拿 {d.share}%，其餘由系統回收</div>
                <button disabled={busy} onClick={async () => { if (confirm(`確定讓「${my.name}」結束營業？\n會按天數結算這個月的月租和水電，剩下的營運金退回給你；開店費不退。`)) { if (await post({ action: "spClose", shop: k }, "已結束營業，剩下的營運金已退回")) { setEdit(null); setEditKey(""); } } }} style={{ ...s.btn("ghost"), marginTop: 10, color: C.red }}>結束營業</button>
              </div>}
            </div>
          );
        })}
        {d.eligible && mine.length < maxN && (!manage
          ? <button onClick={() => setManage(true)} style={{ ...s.btn(mine.length ? "secondary" : "primary"), marginTop: mine.length ? 10 : 0 }}>🏪 {mine.length ? "再開一家" : "開一家小店"}（開店費 {d.fee}＋營運金 {cost.month} 枚）</button>
          : <div style={{ marginTop: 10 }}>{openForm}</div>)}
      </div>

      {/* v1.40 店種提案：天馬行空也可以，管理者會幫你規劃 */}
      <div style={s.card}>
        <div style={s.sectionTitle}>💡 想開別的店？提案給總部</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 8, lineHeight: 1.6 }}>說說你想開什麼店、想賣什麼，天馬行空也可以。總部規劃好商品後就會上架成新店種。</div>
        <input value={prop.name} maxLength={12} onChange={e => setProp(x => ({ ...x, name: e.target.value }))} placeholder="店種名稱，例如：夜市小吃攤" style={{ ...s.input, marginBottom: 8 }} />
        <textarea value={prop.idea} maxLength={200} onChange={e => setProp(x => ({ ...x, idea: e.target.value }))} placeholder="想賣什麼？有什麼用途？（200 字內）" rows={3} style={{ ...s.input, marginBottom: 8, resize: "vertical", fontFamily: "inherit" }} />
        <button disabled={busy || !prop.name.trim() || !prop.idea.trim()} onClick={async () => { if (await post({ action: "spPropose", name: prop.name, idea: prop.idea }, "提案送出了！總部會回覆你")) setProp({ name: "", idea: "" }); }} style={{ ...s.btn("primary"), opacity: busy || !prop.name.trim() || !prop.idea.trim() ? .5 : 1 }}>送出提案</button>
        {(d.proposals || []).length > 0 && <div style={{ marginTop: 10 }}>
          {d.proposals.map(x => <div key={x.id} style={{ fontSize: 12.5, padding: "6px 0", borderTop: `1px solid ${C.border}` }}><b>{x.name}</b>・<span style={{ color: x.status === "已上架" ? C.green : x.status === "婉拒" ? C.muted : C.accent }}>{x.status}</span>{x.reply && <div style={{ color: C.muted }}>總部：{x.reply}</div>}</div>)}
        </div>}
      </div>

      <div style={s.card}>
        <div style={s.sectionTitle}>商店街（{d.shops.length} 家）</div>
        {d.shops.length === 0 && <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: 10 }}>還沒有隊員開店</div>}
        {d.shops.map(x => (
          <button key={x.key || x.owner} onClick={() => { setOpen(x); setGiftTo(""); }} style={{ display: "flex", width: "100%", alignItems: "center", gap: 10, border: "none", borderBottom: `1px solid ${C.border}`, background: "none", padding: "10px 0", cursor: "pointer", fontFamily: "inherit", textAlign: "left", color: C.text }}>
            <span style={{ fontSize: 26 }}>{TYPE_ICON[x.type] || "🏪"}</span>
            <span style={{ flex: 1 }}><b style={{ fontSize: 14 }}>{x.name}</b>{x.owner === user.id ? <span style={{ fontSize: 11, color: C.accent, marginLeft: 6 }}>我的店</span> : null}{x.status === "暫停營業" ? <span style={{ fontSize: 11, color: C.red, marginLeft: 6 }}>⏸ 暫停</span> : null}<div style={{ fontSize: 11.5, color: C.muted }}>{x.type}・{x.ownerName}・Lv.{x.level}</div></span>
            <span style={{ color: C.light }}>›</span>
          </button>))}
      </div>
      {toast && <Flash text={toast} />}
    </div>
  );
}

// v1.40 管理：隊員店種提案（待規劃／規劃中／已上架／婉拒，可以回覆；隊員會收到提醒）
export function ShopProposals({ apiGet, apiPost, C, s }) {
  const [list, setList] = useState(null), [reply, setReply] = useState({}), [msg, setMsg] = useState("");
  const load = () => apiGet({ action: "spProposals" }, 0).then(r => setList(r && r.success ? r.data || [] : []));
  useEffect(() => { load(); }, []);
  const set = async (id, status) => {
    const r = await apiPost({ action: "spProposalSet", id, status, reply: reply[id] || "" }, 0);
    setMsg(r && r.success ? "✅ 已更新，隊員會收到提醒" : (r && r.error) || "更新失敗"); if (r && r.success) load();
  };
  if (!list) return <div className="rh-skel" style={{ height: 160, borderRadius: 18 }} />;
  return (
    <div>
      <Flash text={msg} />
      <div style={{ fontSize: 12.5, color: C.muted, margin: "0 4px 10px", lineHeight: 1.6 }}>隊員提出想開的店和想賣的東西。決定上架後，請交給製作端規劃商品（名稱、價格、用途），下一版加進店種。</div>
      {list.length === 0 && <div style={{ ...s.card, textAlign: "center", color: C.muted, fontSize: 13 }}>目前沒有提案</div>}
      {list.map(x => (
        <div key={x.id} style={s.card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b style={{ fontSize: 15 }}>{x.name}</b><span style={{ fontSize: 12, color: x.status === "已上架" ? C.green : x.status === "婉拒" ? C.muted : C.accent }}>{x.status}</span></div>
          <div style={{ fontSize: 12, color: C.muted, margin: "2px 0 6px" }}>{x.who}・{x.time}</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 8 }}>{x.idea}</div>
          {x.reply && <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 8 }}>已回覆：{x.reply}</div>}
          <input value={reply[x.id] || ""} onChange={e => setReply(v => ({ ...v, [x.id]: e.target.value }))} placeholder="回覆隊員（選填）" style={{ ...s.input, marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 6 }}>
            {["規劃中", "已上架", "婉拒"].map(st => <button key={st} onClick={() => set(x.id, st)} style={{ flex: 1, border: `1px solid ${C.border}`, background: x.status === st ? C.accentBg : C.card, borderRadius: 10, padding: "7px 0", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", color: C.text }}>{st}</button>)}
          </div>
        </div>
      ))}
    </div>
  );
}
