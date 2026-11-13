// v1.28 寵物隊伍（最多 5 隻跟在身後）與寵物市集
import { useState, useEffect } from "react";
import { Flash } from "./TopToast.jsx";
import { PetSprite, PET_FLAVORS, PET_TYPE_NAME } from "./pets/petSprites.jsx";

const FLAVORS = ["原味", "可可", "紅玉", "抹茶", "黑糖", "芝麻"];

export function PetTeam({ user, apiGet, apiPost, C, s, balance, onChanged }) {
  const [d, setD] = useState(null), [busy, setBusy] = useState(false), [msg, setMsg] = useState("");
  const [buy, setBuy] = useState({ flavor: "原味", name: "" }), [sellAt, setSellAt] = useState({});
  const load = () => apiGet({ action: "gmPetTeam" }, 0).then(r => setD(r && r.success ? r.data : { error: (r && r.error) || "讀取失敗" }));
  useEffect(() => { load(); }, []);
  const act = async (payload, ok) => {
    setBusy(true); setMsg("");
    const r = await apiPost(payload, 0); setBusy(false);
    if (r && r.success) { setMsg("✅ " + (typeof ok === "function" ? ok(r) : ok)); if (r.data && r.data.list) setD(r.data); else load(); onChanged && onChanged(); }
    else setMsg((r && r.error) || "操作失敗");
  };
  if (!d) return <div className="rh-skel" style={{ height: 160, borderRadius: 18 }} />;
  if (d.error) return <div style={{ ...s.card, color: C.muted, textAlign: "center" }}>{/未知/.test(d.error) ? "寵物隊伍還沒開通（後端更新到 v1.28 後就會出現）" : d.error}</div>;
  const chip = on => ({ border: `1px solid ${on ? C.accent : C.border}`, background: on ? C.accentBg : C.card, color: on ? C.accent : C.text, borderRadius: 999, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" });
  return (
    <div>
      <div style={{ ...s.card, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 2, minHeight: 70 }}>
          {d.list.slice().reverse().map((p, i) => <PetSprite key={p.id} type={p.type} stage={p.stage} flavor={p.flavor} size={p.main ? 64 : 44} />)}
          <div style={{ fontSize: 30, marginLeft: 6 }}>🚶</div>
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 6 }}>我的寵物隊伍 {d.count} / {d.max}</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>在宇宙辦公室，牠們會排成一列跟在你身後</div>
      </div>

      {d.list.map(p => (
        <div key={p.id} style={{ ...s.card, display: "flex", gap: 12, alignItems: "center", opacity: p.listed ? .7 : 1 }}>
          <PetSprite type={p.type} stage={p.stage} flavor={p.flavor} size={52} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>{p.name} {p.main && <span style={{ fontSize: 11, color: "#fff", background: C.accent, borderRadius: 999, padding: "1px 7px", marginLeft: 4 }}>主寵物</span>}{p.listed && <span style={{ fontSize: 11, color: C.gold, marginLeft: 6 }}>市集掛賣中 {p.listed.price} 枚</span>}</div>
            <div style={{ fontSize: 11.5, color: C.muted }}>{p.flavor}{p.type ? "・" + (PET_TYPE_NAME[p.type] || "") : ""}・{p.stageName}・陪你 {p.hours} 小時</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              {!p.main && !p.listed && <button disabled={busy} onClick={() => act({ action: "gmPetMain", pet: p.id }, `${p.name} 當主寵物了`)} style={chip(false)}>⭐ 當主寵物</button>}
              {!p.listed && d.list.filter(x => !x.listed).length > 1 && <>
                <button disabled={busy} onClick={() => { if (confirm(`把「${p.name}」賣回系統，拿 ${p.buyback} 枚？\n牠會留在你的圖鑑和相簿裡。`)) act({ action: "gmPetSell", pet: p.id }, r => `賣回系統，拿到 ${r.got} 枚`); }} style={chip(false)}>💰 賣回系統 {p.buyback}</button>
                <button onClick={() => setSellAt(m => ({ ...m, [p.id]: m[p.id] != null ? undefined : "" }))} style={chip(sellAt[p.id] != null)}>🏪 掛到市集</button>
              </>}
              {p.listed && <button disabled={busy} onClick={() => act({ action: "gmPetUnlist", id: p.listed.id }, "已從市集收回")} style={chip(false)}>收回</button>}
            </div>
            {sellAt[p.id] != null && !p.listed && <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <input type="number" inputMode="numeric" value={sellAt[p.id]} onChange={e => setSellAt(m => ({ ...m, [p.id]: e.target.value }))} placeholder="價格 100～1000" style={{ ...s.input, flex: 1, padding: "7px 9px" }} />
              <button disabled={busy || !sellAt[p.id]} onClick={() => act({ action: "gmPetList", pet: p.id, price: sellAt[p.id] }, "已掛到市集，3 天沒賣出會自動收回").then(() => setSellAt(m => ({ ...m, [p.id]: undefined })))} style={{ ...s.btn("primary"), width: "auto", padding: "7px 12px", fontSize: 13 }}>掛賣</button>
            </div>}
            {sellAt[p.id] != null && !p.listed && sellAt[p.id] > 0 && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3 }}>成交後你拿 {Math.floor(sellAt[p.id] * 0.8)} 枚（80%）</div>}
          </div>
        </div>
      ))}

      {d.nextPrice != null ? <div style={s.card}>
        <div style={s.sectionTitle}>再養一隻（第 {d.count + 1} 隻・{d.nextPrice} 枚）</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {FLAVORS.map(f => <button key={f} onClick={() => setBuy(b => ({ ...b, flavor: f }))} style={{ ...chip(buy.flavor === f), display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 12, height: 12, borderRadius: 4, background: (PET_FLAVORS[f] || PET_FLAVORS["原味"] || ["#e8c48a"])[0] }} />{f}</button>)}
        </div>
        <input value={buy.name} maxLength={8} onChange={e => setBuy(b => ({ ...b, name: e.target.value }))} placeholder="幫牠取名字（8 字內）" style={{ ...s.input, marginBottom: 8 }} />
        <button disabled={busy || balance < d.nextPrice} onClick={() => act({ action: "gmPetBuyMore", flavor: buy.flavor, name: buy.name }, "新的蛋加入隊伍了！").then(() => setBuy(b => ({ ...b, name: "" })))} style={{ ...s.btn("primary"), opacity: busy || balance < d.nextPrice ? .5 : 1 }}>
          {balance < d.nextPrice ? `還差 ${d.nextPrice - balance} 枚` : `花 ${d.nextPrice} 枚領養`}</button>
        <div style={{ fontSize: 11.5, color: C.light, marginTop: 6 }}>第 2～5 隻：200／300／400／500 枚。孵化時隨機開出型態，依你之後的工時長大。</div>
      </div> : <div style={{ ...s.card, fontSize: 13, color: C.muted, textAlign: "center" }}>隊伍滿 {d.max} 隻了，想養新的可以先賣掉一隻</div>}
      <Flash text={msg} />{msg && <div style={{ fontSize: 13, color: /✅/.test(msg) ? C.green : C.red, textAlign: "center", margin: "4px 0 10px" }}>{msg}</div>}
      <div style={{ fontSize: 11.5, color: C.light, lineHeight: 1.7, padding: "0 4px" }}>賣回系統：蛋 30・雛形 60・嬰兒 90・兒童 130・完全體 180。至少要留 1 隻；賣掉的寵物會留在你的圖鑑和相簿。</div>
    </div>
  );
}

export function PetMarket({ user, apiGet, apiPost, C, s, balance, onChanged }) {
  const [d, setD] = useState(null), [busy, setBusy] = useState(false), [msg, setMsg] = useState("");
  const load = () => apiGet({ action: "gmPetMarket" }, 0).then(r => setD(r && r.success ? r.data : []));
  useEffect(() => { load(); }, []);
  const buy = async (x) => {
    if (!confirm(`花 ${x.price} 枚買下 ${x.seller} 的「${x.pet.name}」？`)) return;
    setBusy(true); const r = await apiPost({ action: "gmPetMarketBuy", id: x.id }, 0); setBusy(false);
    if (r && r.success) { setMsg(`✅ 「${x.pet.name}」加入你的隊伍了！`); load(); onChanged && onChanged(); } else setMsg((r && r.error) || "購買失敗");
  };
  if (!d) return <div className="rh-skel" style={{ height: 120, borderRadius: 18 }} />;
  return (
    <div>
      <div style={{ ...s.card, fontSize: 12.5, color: C.muted, lineHeight: 1.7 }}>🏪 同事掛賣的寵物。買到的寵物保留目前的階段，之後依你的工時繼續長大。賣家拿 80%，20% 由系統回收；掛 3 天沒賣出會自動收回。</div>
      {d.length === 0 && <div style={{ ...s.card, textAlign: "center", color: C.muted, fontSize: 13 }}>目前沒有寵物在賣</div>}
      {d.map(x => <div key={x.id} style={{ ...s.card, display: "flex", gap: 12, alignItems: "center" }}>
        <PetSprite type={x.pet.type} stage={x.pet.stage} flavor={x.pet.flavor} size={52} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600 }}>{x.pet.name}</div>
          <div style={{ fontSize: 11.5, color: C.muted }}>{x.pet.flavor}{x.pet.type ? "・" + (PET_TYPE_NAME[x.pet.type] || "") : ""}・{x.pet.stageName}・{x.pet.hours} 小時｜賣家 {x.seller}</div>
        </div>
        {x.mine ? <span style={{ fontSize: 12, color: C.muted }}>我的</span> :
          <button disabled={busy || balance < x.price} onClick={() => buy(x)} style={{ ...s.btn("primary"), width: "auto", padding: "8px 12px", fontSize: 13, opacity: busy || balance < x.price ? .5 : 1 }}>{x.price} 枚</button>}
      </div>)}
      <Flash text={msg} />{msg && <div style={{ fontSize: 13, color: /✅/.test(msg) ? C.green : C.red, textAlign: "center" }}>{msg}</div>}
    </div>
  );
}
