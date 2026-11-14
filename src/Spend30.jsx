// v1.30 赤心幣新花費：我的座位、進場特效、稱號、寵物進階、裝備強化、季節扭蛋＋扭蛋券、全員大魔王、和隊長吃飯
import { useState, useEffect } from "react";
import { Flash } from "./TopToast.jsx";
import { PetSprite, PET_SKINS } from "./pets/petSprites.jsx";

const TABS = [["seat", "🪑 座位"], ["fx", "✨ 進場"], ["title", "🏷️ 稱號"], ["pet", "🐾 寵物"], ["enh", "⚔️ 強化"], ["gacha", "🎰 扭蛋"], ["boss", "👹 魔王"], ["meal", "🍽️ 吃飯"]];
const TIER = { "普通": "#8a7e72", "稀有": "#3d5a80", "傳說": "#a8741a" };
const ICON = { seat: "🪑", desk: "🖥️", chair: "💺", entry: "✨", title: "🏷️", petskin: "🎨", petden: "🏠", hat: "🎩", acc: "🎀", outfit: "👕", frame: "🪪" };
const FX_ICON = { fx_firework: "🎆", fx_rainbow: "🌈", fx_stars: "🌠", fx_trex: "🦖" };
const BOSS_ICON = { "燒焦怪": "🔥", "麵糊黏黏怪": "🫠", "停電魔王": "⚡", "排隊大暴龍": "🦖", "漏氣烤盤怪": "💨", "打翻糖漿怪": "🍯" };
const STAT = { atk: "攻擊", def: "防禦", hp: "體力", spd: "速度" };
const statTxt = o => Object.keys(o || {}).map(k => (STAT[k] || k) + " +" + o[k]).join("、");

export function SpendPage({ user, apiGet, apiPost, C, s, initial, onChanged, only, hideBalance }) {   // v1.33 only：只顯示某一類（給赤心幣商店用）
  const [d, setD] = useState(null), [tab, setTab] = useState(only || initial || "seat"), [busy, setBusy] = useState(false), [msg, setMsg] = useState("");
  const [hit, setHit] = useState(""), [gres, setGres] = useState(null), [mealNote, setMealNote] = useState(""), [mealDate, setMealDate] = useState({}), [demo, setDemo] = useState("");
  const load = () => apiGet({ action: "s30Me" }, 0).then(r => setD(r && r.success ? r.data : { error: (r && r.error) || "讀取失敗" }));
  useEffect(() => { load(); }, []);
  const act = async (payload, ok) => {
    setBusy(true); setMsg("");
    const r = await apiPost(payload, 0); setBusy(false);
    if (r && r.success) { setMsg("✅ " + (typeof ok === "function" ? ok(r) : ok)); if (r.data && r.data.items) setD(r.data); else load(); onChanged && onChanged(); return r; }
    setMsg((r && r.error) || "操作失敗"); return null;
  };
  if (!d) return <div className="rh-skel" style={{ height: 220, borderRadius: 18 }} />;
  if (d.error) return <div style={{ ...s.card, color: C.muted, textAlign: "center" }}>{/未知/.test(d.error) ? "新的花費項目還沒開通（後端更新到 v1.30 後就會出現）" : d.error}</div>;

  const it = cat => d.items.filter(i => i.cat === cat);
  const byId = id => d.items.find(i => i.id === id) || {};
  const chip = on => ({ border: `1px solid ${on ? C.accent : C.border}`, background: on ? C.accentBg : C.card, color: on ? C.accent : C.text, borderRadius: 999, padding: "6px 11px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" });
  const small = (v = "primary") => ({ ...s.btn(v), width: "auto", padding: "7px 12px", fontSize: 13 });
  const coin = n => <b style={{ color: C.gold }}>{Number(n).toLocaleString()} 枚</b>;
  const buyBtn = i => <button disabled={busy || d.balance < i.price} onClick={() => act({ action: "s30Buy", item: i.id }, `買到「${i.name}」了`)} style={{ ...small(), opacity: d.balance < i.price ? .5 : 1 }}>❤️ {i.price}</button>;

  // 一格商品：已擁有 → 換上／使用中；沒有 → 買
  const Tile = ({ i, using, onUse, extra }) => (
    <div style={{ border: `1px solid ${using ? C.accent : C.border}`, borderRadius: 14, padding: 10, background: using ? C.accentBg : i.owned ? C.warm : C.card }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}><span style={{ fontSize: 22 }}>{i.note && /\p{Extended_Pictographic}/u.test(i.note) ? i.note : FX_ICON[i.id] || ICON[i.cat] || "🎁"}</span>
        {i.owned && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", background: using ? C.accent : C.green, borderRadius: 999, padding: "1px 8px" }}>{using ? "✓ 使用中" : "✓ 已擁有"}</span>}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 4 }}>{i.name}</div>
      <div style={{ fontSize: 11, color: TIER[i.tier] }}>{i.tier}{extra ? " · " + extra : ""}</div>
      <div style={{ marginTop: 8 }}>{i.owned ? (using ? null : onUse ? <button disabled={busy} onClick={onUse} style={small("secondary")}>換上</button> : null) : i.where === "工時" ? <span style={{ fontSize: 12, color: C.muted }}>累計 {i.need} 小時解鎖</span> : buyBtn(i)}</div>
    </div>);
  const Grid = ({ children }) => <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{children}</div>;
  const Head = ({ t, sub }) => <div style={{ marginBottom: 10 }}><div style={{ fontSize: 15, fontWeight: 700 }}>{t}</div>{sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 1.6 }}>{sub}</div>}</div>;

  const Seat = () => {
    const st = d.seat;
    if (!st) { const b = byId("seat_basic"); return <div style={s.card}>
      <Head t="開通我的座位" sub="宇宙辦公室多了一區「隊員座位區」。開通後你有自己的桌子和椅子，人在辦公室或沒上班的時候，小人就會坐在自己的座位上。之後可以再換桌子、椅子，桌上擺 3 個擺飾，旁邊放寵物小窩。" />
      <div style={{ textAlign: "center", fontSize: 44, margin: "6px 0 10px" }}>🪑🖥️🪴</div>
      <button disabled={busy || d.balance < b.price} onClick={() => act({ action: "s30Buy", item: "seat_basic" }, "座位開通了！到宇宙辦公室 → 座位區看看")} style={s.btn("primary")}>開通座位 ❤️ {b.price}</button>
    </div>; }
    const deco = st.deco || [];
    const toggleDeco = id => { const nx = deco.includes(id) ? deco.filter(x => x !== id) : [...deco, id]; if (nx.length > d.decoMax) { setMsg(`桌上最多擺 ${d.decoMax} 個，先拿掉一個`); return; } act({ action: "s30Set", deco: JSON.stringify(nx) }, "擺好了"); };
    const basic = (k, label) => <div style={{ border: `1px solid ${!st[k] ? C.accent : C.border}`, borderRadius: 14, padding: 10, background: !st[k] ? C.accentBg : C.warm }}>
      <div style={{ fontSize: 22 }}>{k === "desk" ? "🪵" : "🪑"}</div><div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 4 }}>{label}</div><div style={{ fontSize: 11, color: C.muted }}>開通附贈</div>
      <div style={{ marginTop: 8 }}>{!st[k] ? <span style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>✓ 使用中</span> : <button disabled={busy} onClick={() => act({ action: "s30Set", [k]: "" }, "換回基本款")} style={small("secondary")}>換上</button>}</div></div>;
    return <>
      <div style={{ ...s.card, display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ fontSize: 34 }}>🪑</div>
        <div style={{ flex: 1, fontSize: 12.5, color: C.muted, lineHeight: 1.7 }}>
          桌子：<b style={{ color: C.text }}>{byId(st.desk).name || "基本木桌"}</b>・椅子：<b style={{ color: C.text }}>{byId(st.chair).name || "基本木椅"}</b><br />
          擺飾：{deco.length ? deco.map(x => byId(x).note + byId(x).name).join("、") : "還沒擺"}（{deco.length}/{d.decoMax}）{st.den ? "・小窩：" + byId(st.den).name : ""}
        </div>
      </div>
      <div style={s.card}><Head t="桌子" /><Grid>{basic("desk", "基本木桌")}{it("desk").map(i => <Tile key={i.id} i={i} using={st.desk === i.id} onUse={() => act({ action: "s30Set", desk: i.id }, `換上「${i.name}」`)} />)}</Grid></div>
      <div style={s.card}><Head t="椅子" /><Grid>{basic("chair", "基本木椅")}{it("chair").map(i => <Tile key={i.id} i={i} using={st.chair === i.id} onUse={() => act({ action: "s30Set", chair: i.id }, `換上「${i.name}」`)} />)}</Grid></div>
      <div style={s.card}><Head t={`桌上擺飾（最多 ${d.decoMax} 個）`} sub="已擁有的點「擺上／拿下」切換。" />
        <Grid>{it("deco").map(i => <div key={i.id} style={{ border: `1px solid ${deco.includes(i.id) ? C.accent : C.border}`, borderRadius: 14, padding: 10, background: deco.includes(i.id) ? C.accentBg : i.owned ? C.warm : C.card }}>
          <div style={{ fontSize: 22 }}>{i.note}</div><div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 4 }}>{i.name}</div><div style={{ fontSize: 11, color: TIER[i.tier] }}>{i.tier}</div>
          <div style={{ marginTop: 8 }}>{i.owned ? <button disabled={busy} onClick={() => toggleDeco(i.id)} style={small(deco.includes(i.id) ? "ghost" : "secondary")}>{deco.includes(i.id) ? "拿下" : "擺上"}</button> : buyBtn(i)}</div>
        </div>)}</Grid></div>
    </>;
  };

  const Fx = () => <div style={s.card}>
    <Head t="進場特效" sub="打卡上班成功時，手機會播一次你的特效；宇宙辦公室裡，你的小人也會帶著特效進場（上班 30 分鐘內）。" />
    <Grid>
      <div style={{ border: `1px solid ${!d.fx ? C.accent : C.border}`, borderRadius: 14, padding: 10, background: !d.fx ? C.accentBg : C.warm }}>
        <div style={{ fontSize: 22 }}>🚶</div><div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 4 }}>不用特效</div><div style={{ fontSize: 11, color: C.muted }}>一般走進來</div>
        <div style={{ marginTop: 8 }}>{!d.fx ? <span style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>✓ 使用中</span> : <button disabled={busy} onClick={() => act({ action: "s30Set", fx: "" }, "取消特效")} style={small("secondary")}>換上</button>}</div>
      </div>
      {it("entry").map(i => <div key={i.id}><Tile i={i} using={d.fx === i.id} onUse={() => act({ action: "s30Set", fx: i.id }, `換上「${i.name}」`)} />
        <button onClick={() => { setDemo(""); setTimeout(() => setDemo(i.id), 30); }} style={{ ...chip(false), marginTop: 4, width: "100%" }}>▶ 預覽</button></div>)}
    </Grid>
    {demo && <EntryFxShow kind={demo} onDone={() => setDemo("")} />}
  </div>;

  const Title = () => <div style={s.card}>
    <Head t="稱號" sub={`顯示在宇宙辦公室你的名牌上。你目前累計工時 ${d.hours.toLocaleString()} 小時。`} />
    <Grid>
      <div style={{ border: `1px solid ${!d.title ? C.accent : C.border}`, borderRadius: 14, padding: 10, background: !d.title ? C.accentBg : C.warm }}>
        <div style={{ fontSize: 22 }}>🙂</div><div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 4 }}>不戴稱號</div>
        <div style={{ marginTop: 8 }}>{!d.title ? <span style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>✓ 使用中</span> : <button disabled={busy} onClick={() => act({ action: "s30Set", title: "" }, "拿掉稱號")} style={small("secondary")}>換上</button>}</div>
      </div>
      {it("title").map(i => <Tile key={i.id} i={i} using={d.title === i.id} extra={i.where === "工時" ? `工時 ${Math.min(d.hours, i.need)}/${i.need}` : ""} onUse={() => act({ action: "s30Set", title: i.id }, `戴上「${i.name}」`)} />)}
    </Grid>
  </div>;

  const Pet = () => <>
    <div style={s.card}>
      <Head t="寵物特殊顏色" sub="買一次，可以套在自己任何一隻寵物上，也可以隨時換回原本的顏色。" />
      <Grid>{it("petskin").map(i => <div key={i.id} style={{ border: `1px solid ${C.border}`, borderRadius: 14, padding: 10, background: i.owned ? C.warm : C.card, textAlign: "center", position: "relative" }}>
        {i.owned && <span style={{ position: "absolute", top: 8, right: 8, fontSize: 10.5, fontWeight: 700, color: "#fff", background: C.green, borderRadius: 999, padding: "1px 8px" }}>✓ 已擁有</span>}
        <PetSprite type="trex" stage={4} flavor={i.note} size={52} />
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{i.name}</div><div style={{ fontSize: 11, color: TIER[i.tier] }}>{i.tier}</div>
        <div style={{ marginTop: 8, display: "flex", justifyContent: "center" }}>{i.owned ? null : buyBtn(i)}</div>
      </div>)}</Grid>
    </div>
    {d.pets.length > 0 && <div style={s.card}>
      <Head t="幫寵物換顏色" />
      {d.pets.map(p => <div key={p.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderTop: `1px solid ${C.border}` }}>
        <PetSprite type={p.type} stage={p.stage} flavor={p.skin ? byId(p.skin).note : p.flavor} size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{p.name}{p.main ? "（主寵物）" : ""}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
            <button disabled={busy} onClick={() => act({ action: "s30Set", pet: p.id, skin: "" }, `${p.name} 換回${p.flavor}`)} style={chip(!p.skin)}>{p.flavor}（原色）</button>
            {it("petskin").filter(i => i.owned).map(i => <button key={i.id} disabled={busy} onClick={() => act({ action: "s30Set", pet: p.id, skin: i.id }, `${p.name} 換成${i.note}`)} style={{ ...chip(p.skin === i.id), display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 11, height: 11, borderRadius: 4, background: (PET_SKINS[i.note] || ["#ccc"])[0] }} />{i.note}</button>)}
          </div>
        </div>
      </div>)}
    </div>}
    <div style={s.card}>
      <Head t="寵物小窩" sub={d.seat ? "放在你的座位旁邊。" : "放在你的座位旁邊，要先到「座位」開通我的座位。"} />
      <Grid>{it("petden").map(i => <Tile key={i.id} i={i} using={d.seat && d.seat.den === i.id} onUse={d.seat ? () => act({ action: "s30Set", den: i.id }, `換上「${i.name}」`) : null} />)}</Grid>
    </div>
  </>;

  const Enh = () => <div style={s.card}>
    <Head t="裝備強化" sub="武器、防具可以強化到 +5。失敗只扣這次的費用，裝備不會壞、等級也不會掉。" />
    {!d.gear.length && <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: "14px 0" }}>你還沒有武器或防具，先到「我和寵物 → 商店」或扭蛋拿一件吧。</div>}
    {d.gear.map(g => <div key={g.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "10px 0", borderTop: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 26 }}>{g.cat === "weapon" ? "🗡️" : "🛡️"}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{g.name} {g.level > 0 && <span style={{ color: C.gold }}>+{g.level}</span>}</div>
        <div style={{ fontSize: 11.5, color: C.muted }}>{g.level ? "強化加成：" + statTxt(g.bonus) : "還沒強化"}{g.cost != null ? `｜下一級 ${statTxt(g.next)}・成功率 ${g.rate}%` : ""}</div>
        <div style={{ display: "flex", gap: 3, marginTop: 4 }}>{[1, 2, 3, 4, 5].map(n => <span key={n} style={{ width: 16, height: 6, borderRadius: 3, background: n <= g.level ? C.gold : C.border }} />)}</div>
      </div>
      {g.cost != null ? <button disabled={busy || d.balance < g.cost} onClick={() => act({ action: "s30Enhance", item: g.id }, r => r.ok ? `強化成功！${g.name} +${r.level}` : `差一點…這次失敗了（扣 ${r.cost} 枚，裝備沒事）`)} style={small()}>強化 ❤️ {g.cost}</button>
        : <span style={{ fontSize: 12, color: C.gold, fontWeight: 700 }}>MAX</span>}
    </div>)}
  </div>;

  const Gacha = () => {
    const sea = d.season.now, roll = async (machine, ticket) => { setGres(null); const r = await act({ action: "gmGacha", machine, ticket }, r => r.data.duplicate ? `重複了，退回 ${r.data.refund} 枚` : `抽到「${r.data.item.name}」！`); if (r) setGres(r.data); };
    return <>
      <div style={{ ...s.card, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 34 }}>🎟️</div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 700 }}>扭蛋券 {d.tickets} 張</div><div style={{ fontSize: 12, color: C.muted }}>打全員大魔王拿到的。一般、季節扭蛋都能用，不扣幣、不算每月次數。</div></div>
      </div>
      <div style={{ ...s.card, textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>🎰 一般扭蛋</div>
        <div style={{ fontSize: 12, color: C.muted, margin: "2px 0 10px" }}>用幣轉請到「我和寵物 → 扭蛋」（一次 {d.gachaPrice} 枚，每月 5 次）</div>
        <button disabled={busy || d.tickets < 1} onClick={() => roll("", true)} style={{ ...s.btn("secondary"), opacity: d.tickets < 1 ? .5 : 1 }}>🎟️ 用 1 張券轉一般扭蛋</button>
      </div>
      <div style={{ ...s.card, textAlign: "center", background: sea ? "linear-gradient(#fff6f0,#fffdfa)" : C.card }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{sea ? (/聖誕/.test(sea.series) ? "🎄 " : /新春/.test(sea.series) ? "🧧 " : "🎁 ") + sea.series + "扭蛋" : "季節扭蛋"}</div>
        {sea ? <>
          <div style={{ fontSize: 12, color: C.muted, margin: "2px 0 10px" }}>開放到 {sea.to.replace("-", "/")}・一次 {d.season.price} 枚，不算每月次數・集滿整套得「季節收藏家」徽章</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button disabled={busy || d.balance < d.season.price} onClick={() => roll("season", false)} style={{ ...s.btn("primary"), flex: 1 }}>轉一次 ❤️ {d.season.price}</button>
            <button disabled={busy || d.tickets < 1} onClick={() => roll("season", true)} style={{ ...s.btn("secondary"), flex: 1, opacity: d.tickets < 1 ? .5 : 1 }}>🎟️ 用券</button>
          </div>
        </> : <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4, lineHeight: 1.7 }}>現在沒有開放。檔期：{d.season.list.map(x => `${x.series} ${x.from.replace("-", "/")}～${x.to.replace("-", "/")}`).join("、")}</div>}
        {gres && <div style={{ marginTop: 12, padding: 12, borderRadius: 14, background: gres.tier === "傳說" ? "#fff2e0" : gres.tier === "稀有" ? "#eef3fb" : C.warm }}>
          <div style={{ fontSize: 12, color: TIER[gres.tier], fontWeight: 600 }}>{gres.tier}{gres.tier !== "普通" ? "！" : ""}</div>
          <div style={{ fontSize: 17, fontWeight: 600, marginTop: 2 }}>{ICON[gres.item.cat] || "🎁"} {gres.item.name}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{gres.duplicate ? `已經有了，自動分解退回 ${gres.refund} 枚` : "已放進你的衣櫃，到換裝頁穿上"}</div>
        </div>}
      </div>
      {d.season.list.map(x => { const list = d.items.filter(i => i.where === "季節扭蛋" && i.series === x.series), have = list.filter(i => i.owned).length; return <div key={x.series} style={s.card}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><b style={{ fontSize: 14 }}>{x.series}圖鑑</b><span style={{ fontSize: 12, color: C.muted }}>{have}/{list.length}</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>{list.map(i => <div key={i.id} style={{ textAlign: "center", padding: "8px 2px", borderRadius: 12, border: `1px solid ${C.border}`, background: i.owned ? C.card : C.warm }}>
          <div style={{ fontSize: 20, filter: i.owned ? "none" : "grayscale(1) opacity(.35)" }}>{ICON[i.cat] || "🎁"}</div>
          <div style={{ fontSize: 10.5, marginTop: 2, color: i.owned ? C.text : C.light }}>{i.owned ? i.name : "？？？"}</div><div style={{ fontSize: 9.5, color: TIER[i.tier] }}>{i.tier}</div></div>)}</div>
      </div>; })}
    </>;
  };

  const Boss = () => {
    const b = d.boss, pct = Math.round(b.left / b.hp * 100);
    return <>
      <div style={{ ...s.card, textAlign: "center", background: b.killed ? "#eef7ef" : "linear-gradient(#2b1d2e,#4a2440)", color: b.killed ? C.text : "#fff" }}>
        <div style={{ fontSize: 12, opacity: .8 }}>{b.ym.replace("-", " 年 ")} 月的大魔王</div>
        <div style={{ fontSize: 58, lineHeight: 1.2, filter: b.killed ? "grayscale(1)" : "none", animation: b.killed ? "none" : "rhWob 1.6s infinite" }}>{BOSS_ICON[b.name] || "👹"}</div>
        <div style={{ fontSize: 19, fontWeight: 800 }}>{b.name}{b.killed ? " 被打倒了！" : ""}</div>
        <div style={{ height: 12, borderRadius: 6, background: "rgba(255,255,255,.18)", margin: "10px 0 4px", overflow: "hidden", border: b.killed ? `1px solid ${C.border}` : "none" }}>
          <div style={{ width: pct + "%", height: "100%", background: "linear-gradient(90deg,#ff5e5e,#ffb35e)", transition: "width .4s" }} /></div>
        <div style={{ fontSize: 12, opacity: .85 }}>血量 {b.left.toLocaleString()} / {b.hp.toLocaleString()}・你投入了 {b.mine} 枚</div>
        <style>{`@keyframes rhWob{0%,100%{transform:rotate(0)}25%{transform:rotate(-8deg)}75%{transform:rotate(8deg)}}`}</style>
      </div>
      {!b.killed && <div style={s.card}>
        <Head t="投幣攻擊" sub={`全員一起打，投入的赤心幣就是傷害（一次至少 ${b.min} 枚）。打倒後依投入排名送扭蛋券；月底沒打倒，有參加的人每人 1 張。`} />
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>{[10, 50, 100, 300].map(n => <button key={n} onClick={() => setHit(String(n))} style={chip(hit === String(n))}>{n}</button>)}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="number" inputMode="numeric" value={hit} onChange={e => setHit(e.target.value)} placeholder={`至少 ${b.min} 枚`} style={{ ...s.input, flex: 1 }} />
          <button disabled={busy || !(Number(hit) >= b.min) || d.balance < Number(hit)} onClick={() => act({ action: "s30Boss", coins: hit }, r => r.killed ? `⚔️ 最後一擊！打倒了${b.name}，扭蛋券已發放` : `命中！造成 ${r.hit} 點傷害`).then(r => r && setHit(""))} style={small()}>⚔️ 攻擊</button>
        </div>
      </div>}
      <div style={s.card}>
        <Head t="投入排行" sub="打倒後的獎勵：第 1 名 5 張、2～3 名 3 張、4～10 名 2 張、其他有參加的 1 張扭蛋券；第 1 名另得「魔王剋星」徽章。" />
        {!b.rank.length && <div style={{ fontSize: 13, color: C.muted }}>還沒有人出手，搶頭香！</div>}
        {b.rank.map((x, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: i ? `1px solid ${C.border}` : "none", fontWeight: x.mine ? 700 : 400 }}>
          <span style={{ width: 26 }}>{["🥇", "🥈", "🥉"][i] || i + 1}</span><span style={{ flex: 1 }}>{x.name}{x.mine ? "（你）" : ""}</span>
          <span style={{ fontSize: 12.5, color: C.gold }}>{x.coins} 枚</span><span style={{ fontSize: 11.5, color: C.muted, width: 50, textAlign: "right" }}>🎟️×{x.reward}</span></div>)}
      </div>
    </>;
  };

  const Meal = () => {
    const m = d.meal, full = m.used >= m.quota, mine = m.mine.find(x => x.ym === d.boss.ym && x.status !== "已取消");
    return <>
      <div style={{ ...s.card, textAlign: "center" }}>
        <div style={{ fontSize: 44 }}>🍽️</div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>和隊長吃飯</div>
        <div style={{ fontSize: 12.5, color: C.muted, margin: "4px 0 12px", lineHeight: 1.7 }}>每月 {m.quota} 個名額，先申請先得。聊聊工作、想法、未來想做的事。<br />申請後隊長會跟你約時間；如果取消，赤心幣全額退回。</div>
        {d.role >= 5 ? <div style={{ fontSize: 13, color: C.muted }}>你是隊長，下面可以處理大家的申請。</div>
          : mine ? <div style={{ fontSize: 13.5, color: C.green, fontWeight: 600 }}>✓ 你已經申請了（{mine.status}{mine.date ? "・" + mine.date : ""}）</div>
          : full ? <div style={{ fontSize: 13, color: C.muted }}>這個月的名額已經被搶走了，下個月 1 號再來。</div>
          : <>
            <input value={mealNote} onChange={e => setMealNote(e.target.value)} maxLength={100} placeholder="想聊什麼？（選填）" style={{ ...s.input, marginBottom: 8 }} />
            <button disabled={busy || d.balance < m.price} onClick={() => { if (confirm(`用 ${m.price} 枚赤心幣申請這個月和隊長吃飯？`)) act({ action: "s30Meal", note: mealNote }, "申請成功！隊長會跟你約時間").then(r => r && setMealNote("")); }} style={s.btn("primary")}>申請 ❤️ {m.price.toLocaleString()}</button>
          </>}
      </div>
      {m.mine.length > 0 && d.role < 5 && <div style={s.card}><Head t="我的申請" />
        {m.mine.map(x => <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: `1px solid ${C.border}`, fontSize: 13 }}>
          <span style={{ flex: 1 }}>{x.ym}・{x.status}{x.date ? "・" + x.date : ""}</span>
          {x.status === "已申請" && <button disabled={busy} onClick={() => { if (confirm("取消申請？赤心幣會全額退回。")) act({ action: "s30MealSet", id: x.id, status: "已取消" }, "已取消，赤心幣退回了"); }} style={small("ghost")}>取消</button>}
        </div>)}</div>}
      {d.role >= 5 && <div style={s.card}><Head t="大家的申請" sub="約好時間後會寫進你的個人行事曆（有設定的話），也會出現在對方首頁。" />
        {!m.all.length && <div style={{ fontSize: 13, color: C.muted }}>目前沒有申請。</div>}
        {m.all.map(x => <div key={x.id} style={{ padding: "10px 0", borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{x.name} <span style={{ fontSize: 12, color: x.status === "已申請" ? C.accent : C.muted, fontWeight: 400 }}>{x.ym}・{x.status}{x.date ? "・" + x.date : ""}</span></div>
          {x.note && <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>想聊：{x.note}</div>}
          {(x.status === "已申請" || x.status === "已約好") && <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            <input type="datetime-local" value={mealDate[x.id] || ""} onChange={e => setMealDate(o => ({ ...o, [x.id]: e.target.value }))} style={{ ...s.input, flex: "1 1 160px", padding: "7px 9px" }} />
            <button disabled={busy || !mealDate[x.id]} onClick={() => act({ action: "s30MealSet", id: x.id, status: "已約好", date: String(mealDate[x.id]).replace("T", " ") }, "約好了")} style={small()}>約時間</button>
            {x.status === "已約好" && <button disabled={busy} onClick={() => act({ action: "s30MealSet", id: x.id, status: "已完成" }, "完成！對方拿到「和隊長吃過飯」徽章")} style={small("secondary")}>吃完了</button>}
            <button disabled={busy} onClick={() => { if (confirm(`取消 ${x.name} 的申請？赤心幣會退回給對方。`)) act({ action: "s30MealSet", id: x.id, status: "已取消" }, "已取消並退幣"); }} style={small("ghost")}>取消</button>
          </div>}
        </div>)}</div>}
    </>;
  };

  const body = { seat: Seat, fx: Fx, title: Title, pet: Pet, enh: Enh, gacha: Gacha, boss: Boss, meal: Meal }[tab];
  return (
    <div>
      {!hideBalance && <div style={{ ...s.card, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px" }}>
        <span style={{ fontSize: 13 }}>餘額 {coin(d.balance)}</span>
        {d.tickets > 0 && <span style={{ fontSize: 12.5, color: C.muted }}>🎟️ 扭蛋券 {d.tickets}</span>}
      </div>}
      {!only && <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 4, scrollbarWidth: "none" }}>
        {TABS.map(([k, l]) => <button key={k} onClick={() => { setTab(k); setMsg(""); setGres(null); }} style={chip(tab === k)}>{l}</button>)}
      </div>}
      <Flash text={msg} />{msg && <div style={{ ...s.card, padding: "10px 14px", fontSize: 13, color: /^✅/.test(msg) ? C.green : C.red }}>{msg}</div>}
      {body()}
    </div>
  );
}

// ── 進場特效動畫（手機畫面）──
export function EntryFxShow({ kind, onDone }) {
  useEffect(() => { const t = setTimeout(() => onDone && onDone(), 3200); return () => clearTimeout(t); }, [kind]);
  const R = (n, f) => Array.from({ length: n }, (_, i) => f(i));
  const css = `
@keyframes efBurst{0%{transform:translate(0,0) scale(.3);opacity:1}100%{transform:translate(var(--x),var(--y)) scale(1);opacity:0}}
@keyframes efFall{0%{transform:translateY(-12vh) rotate(0);opacity:0}15%{opacity:1}100%{transform:translateY(105vh) rotate(260deg);opacity:.2}}
@keyframes efArc{0%{transform:translateX(-50%) scale(.2);opacity:0}25%{transform:translateX(-50%) scale(1);opacity:1}80%{opacity:1}100%{opacity:0}}
@keyframes efRun{0%{transform:translateX(-30vw) scaleX(-1)}100%{transform:translateX(120vw) scaleX(-1)}}
@keyframes efHop{0%,100%{margin-bottom:0}50%{margin-bottom:18px}}
@keyframes efText{0%{opacity:0;transform:translate(-50%,10px)}20%,80%{opacity:1;transform:translate(-50%,0)}100%{opacity:0}}`;
  const text = { fx_firework: "🎆 華麗進場！", fx_rainbow: "🌈 今天也閃閃發光！", fx_stars: "🌠 星星為你落下！", fx_trex: "🦖 騎著小暴龍來上班！" }[kind] || "✨";
  const COL = ["#ff5e5e", "#ffd166", "#6ee7b7", "#7cc4ff", "#f9a8d4"];
  return (
    <div onClick={onDone} style={{ position: "fixed", inset: 0, zIndex: 600, pointerEvents: "auto", overflow: "hidden", background: "rgba(20,12,30,.35)" }}>
      <style>{css}</style>
      {kind === "fx_firework" && R(4, b => <div key={b} style={{ position: "absolute", left: [25, 70, 45, 80][b] + "%", top: [28, 22, 45, 50][b] + "%" }}>
        {R(18, i => { const a = i / 18 * Math.PI * 2, r = 70 + (b % 2) * 30; return <span key={i} style={{ position: "absolute", width: 7, height: 7, borderRadius: 4, background: COL[(i + b) % 5], "--x": Math.cos(a) * r + "px", "--y": Math.sin(a) * r + "px", animation: `efBurst 1.1s ${b * 0.45}s ease-out both` }} />; })}</div>)}
      {kind === "fx_stars" && R(26, i => <span key={i} style={{ position: "absolute", left: (i * 37) % 100 + "%", top: 0, fontSize: 14 + (i % 3) * 6, animation: `efFall ${1.6 + (i % 4) * 0.3}s ${(i % 9) * 0.15}s linear both` }}>{i % 3 ? "⭐" : "✨"}</span>)}
      {kind === "fx_rainbow" && <div style={{ position: "absolute", left: "50%", top: "22%", width: 300, height: 150, borderRadius: "150px 150px 0 0", animation: "efArc 3s ease-out both",
        background: "radial-gradient(circle at 50% 100%, transparent 54%, #9b59b6 54%, #9b59b6 60%, #3498db 60%, #3498db 66%, #2ecc71 66%, #2ecc71 72%, #f1c40f 72%, #f1c40f 78%, #e67e22 78%, #e67e22 84%, #e74c3c 84%, #e74c3c 90%, transparent 90%)" }} />}
      {kind === "fx_trex" && <div style={{ position: "absolute", bottom: "30%", left: 0, fontSize: 72, animation: "efRun 2.8s linear both" }}><div style={{ animation: "efHop .35s infinite" }}>🦖</div></div>}
      <div style={{ position: "absolute", left: "50%", bottom: "16%", background: "#fffaf2", color: "#2b221c", fontWeight: 800, fontSize: 18, padding: "10px 18px", borderRadius: 16, boxShadow: "0 8px 24px rgba(0,0,0,.25)", animation: "efText 3.1s both", whiteSpace: "nowrap" }}>{text}</div>
    </div>
  );
}

// 打卡上班成功時播放自己的進場特效
export function EntryFxOnPunch({ apiGet }) {
  const [k, setK] = useState("");
  useEffect(() => {
    const on = e => { if (!e.detail || e.detail.kind !== "in") return; apiGet({ action: "s30Me" }, 0).then(r => { if (r && r.success && r.data.fx) setTimeout(() => setK(r.data.fx), 400); }).catch(() => {}); };
    window.addEventListener("rh-pet-greet", on); return () => window.removeEventListener("rh-pet-greet", on);
  }, []);
  return k ? <EntryFxShow kind={k} onDone={() => setK("")} /> : null;
}
