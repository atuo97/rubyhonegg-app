// ─────────────────────────────────────────────
// 赤心幣(紅玉滿宇宙遊戲化)
// 分頁:總覽、商店、扭蛋、寵物、徽章、團隊。資料來源:後端 gmMe(一次拿齊),各動作 gmBuy/gmGacha/…
// ─────────────────────────────────────────────
import { useEffect, useState } from "react";

const TABS = [["home", "總覽"], ["shop", "商店"], ["gacha", "扭蛋"], ["pet", "寵物"], ["badge", "徽章"], ["team", "團隊"]];
const CAT_NAME = { haircolor: "髮色", acc: "配件", outfit: "服裝", frame: "名牌框", hat: "頭飾", petacc: "寵物配件", weapon: "對戰武器", armor: "對戰防具", card: "對戰卡片" };
const TIER_COLOR = { "普通": "#8a7e72", "稀有": "#3d5a80", "傳說": "#b9381c" };
const UNLOCK_NAME = { lounge: "咖啡機＋地毯", plants: "植物牆＋水族箱", arcade: "遊戲區（大型電玩＋桌球）", station: "新場景・宇宙太空站", spectrum: "七色光譜大廳" };
const SOON = { station: 1, spectrum: 1 };
const PET_FLAVORS = [["原味", "#f3c66b"], ["可可", "#7b4a2e"], ["紅玉", "#d9534f"], ["抹茶", "#8bbf6a"]];
const ITEM_ICON = { haircolor: "💇", acc: "🎀", outfit: "👕", frame: "🏷️", hat: "🎩", petacc: "🐣", weapon: "⚔️", armor: "🛡️", card: "🃏" };

export function Coin({ n, size = 14 }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
    <span style={{ fontSize: size }}>🪙</span>{Number(n || 0).toLocaleString()}</span>;
}

export default function GameTab({ user, apiGet, apiPost, C, s, initialTab, onEditAvatar, onChanged }) {
  const [tab, setTab] = useState(initialTab || "home");
  const [me, setMe] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [gres, setGres] = useState(null);
  const [petForm, setPetForm] = useState({ flavor: "紅玉", name: "" });
  const [donate, setDonate] = useState("");
  const [adm, setAdm] = useState({ target: "", amount: "", reason: "", badge: "" });

  const load = async () => {
    const r = await apiGet({ action: "gmMe", empId: user.id }, 1);
    if (r && r.success) { setMe(r.data); setErr(""); } else setErr((r && r.error) || "赤心幣功能尚未開通");
  };
  useEffect(() => { load(); }, []);
  const flash = t => { setToast(t); setTimeout(() => setToast(""), 2600); };
  const act = async (payload, okMsg) => {
    setBusy(true);
    const r = await apiPost({ empId: user.id, ...payload }, 0);
    setBusy(false);
    if (r && r.success) { if (okMsg) flash(okMsg); await load(); onChanged && onChanged(); return r.data || true; }
    flash((r && r.error) || "操作失敗"); return null;
  };

  if (err) return <div style={{ ...s.card, textAlign: "center", color: C.muted, fontSize: 13 }}>{err}</div>;
  if (!me) return <div className="rh-skel" style={{ height: 160, borderRadius: 18 }} />;

  const P = me.params || {}, started = me.today >= P["測試版開始日"], official = me.today >= P["正式版開始日"];
  const Card = ({ children, style }) => <div style={{ ...s.card, ...style }}>{children}</div>;
  const Title = ({ children, right }) => <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><div style={{ ...s.sectionTitle, marginBottom: 0 }}>{children}</div>{right}</div>;
  const Btn = ({ children, onClick, disabled, kind = "primary", style }) => <button onClick={onClick} disabled={disabled || busy} style={{ ...s.btn(kind), padding: "9px 14px", fontSize: 13, opacity: disabled || busy ? .5 : 1, ...style }}>{children}</button>;

  // ───── 總覽 ─────
  const Home = () => (
    <>
      <Card style={{ textAlign: "center", padding: "20px 16px", background: "linear-gradient(180deg,#fff6e8,#fffdfa)" }}>
        <div style={{ fontSize: 12, color: C.muted }}>我的赤心幣</div>
        <div style={{ fontSize: 38, fontWeight: 600, marginTop: 4 }}><Coin n={me.balance} size={30} /></div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 8, lineHeight: 1.6 }}>
          {!started ? `${P["測試版開始日"]} 測試版開始累積` : !official ? `測試期間：${P["正式版開始日"]} 正式版上線時，當下餘額 ×${P["正式版加倍倍率"]}` : "正式版"}
          <br />每工作 1 小時 1 枚{me.role >= 3 ? "（管理者 ×1.5）" : me.role >= 2 ? "（分隊長 ×1.2）" : ""}，每天凌晨結算到前一天
        </div>
      </Card>
      <Card>
        <Title>怎麼賺幣</Title>
        {[["⏱️", "工時", "每小時 1 枚，依打卡紀錄"], ["❓", "每日一題", "答對 +1，連續 7 天再 +5"], ["🏅", "成就徽章", "達成條件自動發"], ["🌟", "互動之星", `每月 +${P["互動之星獎勵"]}`], ["🏆", "冠軍櫃位", `每月 ${P["冠軍櫃位總獎勵"]} 枚依時數分`], ["🎂", "生日", "壽星 +30，送祝福 +1"]].map(x => (
          <div key={x[1]} style={{ display: "flex", gap: 10, padding: "6px 0", fontSize: 13 }}><span>{x[0]}</span><b style={{ width: 70 }}>{x[1]}</b><span style={{ color: C.muted }}>{x[2]}</span></div>))}
        <div style={{ fontSize: 11, color: C.light, marginTop: 8 }}>赤心幣是福利性質的遊戲點數，不能換現金、不能轉讓，和薪資考核無關。</div>
      </Card>
      <Card>
        <Title>最近明細</Title>
        {me.ledger.length === 0 && <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: 8 }}>還沒有紀錄</div>}
        {me.ledger.map((l, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ minWidth: 0 }}><div style={{ fontSize: 13 }}>{l.type}</div><div style={{ fontSize: 11, color: C.light, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.note} · {l.time.slice(5, 16)}</div></div>
            <div style={{ fontSize: 14, fontWeight: 600, color: l.amount > 0 ? C.green : C.red, whiteSpace: "nowrap" }}>{l.amount > 0 ? "+" : ""}{l.amount}</div>
          </div>))}
      </Card>
      {user.role >= 3 && <Admin />}
    </>
  );

  // ───── 商店 ─────
  const Shop = () => {
    const items = me.catalog.filter(c => c.where === "商店");
    const cats = [...new Set(items.map(i => i.cat))];
    return (
      <>
        <Card style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px" }}>
          <span style={{ fontSize: 13 }}>餘額 <Coin n={me.balance} /></span>
          {onEditAvatar && <Btn kind="secondary" onClick={onEditAvatar} style={{ width: "auto" }}>去換裝</Btn>}
        </Card>
        {cats.map(cat => (
          <Card key={cat}>
            <Title>{CAT_NAME[cat] || cat}</Title>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {items.filter(i => i.cat === cat).map(i => (
                <div key={i.id} style={{ border: `1px solid ${C.border}`, borderRadius: 14, padding: 10, background: i.owned ? C.warm : C.card }}>
                  <div style={{ fontSize: 22 }}>{ITEM_ICON[i.cat] || "🎁"}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 4 }}>{i.name}</div>
                  <div style={{ fontSize: 11, color: TIER_COLOR[i.tier] }}>{i.tier}</div>
                  <div style={{ marginTop: 8 }}>
                    {i.owned ? <span style={{ fontSize: 12, color: C.green }}>✓ 已擁有</span>
                      : <Btn disabled={me.balance < i.price || me.frozen} onClick={() => act({ action: "gmBuy", item: i.id }, `買到「${i.name}」了！到換裝頁穿上吧`)}><Coin n={i.price} size={12} /></Btn>}
                  </div>
                </div>))}
            </div>
          </Card>))}
      </>
    );
  };

  // ───── 扭蛋 ─────
  const Gacha = () => {
    const pool = me.catalog.filter(c => c.where === "扭蛋"), series = [...new Set(pool.map(p => p.series))];
    const roll = async () => { setGres(null); const d = await act({ action: "gmGacha" }); if (d) setGres(d); };
    return (
      <>
        <Card style={{ textAlign: "center", padding: "20px 16px" }}>
          <div style={{ fontSize: 54, lineHeight: 1, animation: busy ? "rhShimmer 1s infinite" : "none" }}>🎰</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 8 }}>一次 <Coin n={P["扭蛋價格"]} size={12} /> · 本月還能抽 <b>{me.gacha.left}</b> 次</div>
          <Btn onClick={roll} disabled={me.gacha.left <= 0 || me.balance < P["扭蛋價格"] || me.frozen} style={{ marginTop: 12 }}>轉一次！</Btn>
          {gres && <div style={{ marginTop: 14, padding: 12, borderRadius: 14, background: gres.tier === "傳說" ? "#fff2e0" : gres.tier === "稀有" ? "#eef3fb" : C.warm }}>
            <div style={{ fontSize: 12, color: TIER_COLOR[gres.tier], fontWeight: 600 }}>{gres.tier}{gres.tier !== "普通" ? "！" : ""}</div>
            <div style={{ fontSize: 17, fontWeight: 600, marginTop: 2 }}>{ITEM_ICON[gres.item.cat] || "🎁"} {gres.item.name}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{gres.duplicate ? `已經有了，自動分解退回 ${gres.refund} 枚` : "已放進你的衣櫃"}</div>
          </div>}
          <div style={{ fontSize: 11, color: C.light, marginTop: 12, lineHeight: 1.6 }}>
            機率：普通 {100 - P["扭蛋機率_稀有"] - P["扭蛋機率_傳說"]}%、稀有 {P["扭蛋機率_稀有"]}%、傳說 {P["扭蛋機率_傳說"]}%<br />
            連續 {P["扭蛋保底次數"]} 次沒中稀有以上，下一次必中 · 重複自動退 {P["扭蛋重複退幣"]} 枚 · 每月最多 {P["扭蛋每月上限"]} 次
          </div>
        </Card>
        {series.map(se => {
          const list = pool.filter(p => p.series === se), have = list.filter(p => p.owned).length;
          return <Card key={se}>
            <Title right={<span style={{ fontSize: 12, color: C.muted }}>{have}/{list.length}</span>}>{se}圖鑑</Title>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
              {list.map(p => <div key={p.id} style={{ textAlign: "center", padding: "8px 2px", borderRadius: 12, border: `1px solid ${C.border}`, background: p.owned ? C.card : C.warm }}>
                <div style={{ fontSize: 20, filter: p.owned ? "none" : "grayscale(1) opacity(.35)" }}>{ITEM_ICON[p.cat] || "🎁"}</div>
                <div style={{ fontSize: 10.5, marginTop: 2, color: p.owned ? C.text : C.light }}>{p.owned ? p.name : "？？？"}</div>
                <div style={{ fontSize: 9.5, color: TIER_COLOR[p.tier] }}>{p.tier}</div>
              </div>)}
            </div>
            {have === list.length && <div style={{ fontSize: 12, color: C.green, marginTop: 8 }}>🏅 收集完成！已獲得「圖鑑大師」徽章</div>}
          </Card>;
        })}
      </>
    );
  };

  // ───── 寵物 ─────
  const Pet = () => {
    const pt = me.pet, stages = me.petStages || [];
    if (!pt) return (
      <Card>
        <Title>領養寵物小雞蛋糕</Title>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 12 }}>會跟在你的小人身邊。你上班累積工時，牠就會長大，總共五個階段；不用餵食，也不會生病。</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {PET_FLAVORS.map(([f, c]) => <button key={f} onClick={() => setPetForm(x => ({ ...x, flavor: f }))} style={{ flex: 1, border: `2px solid ${petForm.flavor === f ? C.text : C.border}`, borderRadius: 14, padding: "10px 0", background: C.card, cursor: "pointer", fontFamily: "inherit" }}>
            <div style={{ width: 26, height: 26, margin: "0 auto", borderRadius: 8, background: c }} /><div style={{ fontSize: 12, marginTop: 4 }}>{f}</div></button>)}
        </div>
        <input value={petForm.name} maxLength={8} onChange={e => setPetForm(x => ({ ...x, name: e.target.value }))} placeholder="幫牠取名字（8 字內）" style={s.input} />
        <Btn style={{ marginTop: 12 }} disabled={me.balance < P["寵物價格"] || me.frozen} onClick={() => act({ action: "gmPetBuy", flavor: petForm.flavor, name: petForm.name }, "領養成功！到宇宙辦公室看看牠吧")}>
          領養（<Coin n={P["寵物價格"]} size={12} />）</Btn>
      </Card>);
    const next = pt.nextAt, pct = next ? Math.min(100, Math.round(pt.hours / next * 100)) : 100;
    const accs = me.catalog.filter(c => c.cat === "petacc");
    return (
      <>
        <Card style={{ textAlign: "center", padding: "20px 16px" }}>
          <div style={{ width: 60 + pt.stage * 8, height: 54 + pt.stage * 8, margin: "0 auto", borderRadius: pt.stage === 1 ? "50%" : 16, background: (PET_FLAVORS.find(f => f[0] === pt.flavor) || [])[1], position: "relative", boxShadow: pt.stage >= 5 ? "0 0 22px #ffe066" : "none" }}>
            <span style={{ position: "absolute", top: "40%", left: "30%", width: 6, height: 6, background: "#222", borderRadius: 2 }} /><span style={{ position: "absolute", top: "40%", right: "30%", width: 6, height: 6, background: "#222", borderRadius: 2 }} />
            {pt.stage >= 4 && <span style={{ position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)", fontSize: 22 }}>👨‍🍳</span>}
          </div>
          <div style={{ fontSize: 17, fontWeight: 600, marginTop: 12 }}>{pt.name}</div>
          <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>{pt.flavor}・第 {pt.stage} 階段「{pt.stageName}」</div>
          <div style={{ marginTop: 14, textAlign: "left" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.muted }}><span>陪你上班 {pt.hours} 小時</span><span>{next ? `${next} 小時長大` : "已是最終型態"}</span></div>
            <div style={{ height: 6, background: C.border, borderRadius: 4, overflow: "hidden", marginTop: 4 }}><div style={{ width: pct + "%", height: "100%", background: C.accent }} /></div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
            {stages.map((st, i) => <div key={i} style={{ fontSize: 10.5, color: i < pt.stage ? C.accent : C.light, textAlign: "center" }}>{["🥚", "🐣", "✨", "👨‍🍳", "🌟"][i]}<br />{st[1]}</div>)}
          </div>
        </Card>
        <Card>
          <Title>寵物配件</Title>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => act({ action: "gmPetUpdate", acc: "" }, "已拿下配件")} style={chip(!pt.acc)}>不戴</button>
            {accs.map(a => a.owned
              ? <button key={a.id} onClick={() => act({ action: "gmPetUpdate", acc: a.id }, "幫牠戴上了")} style={chip(pt.acc === a.id)}>{a.name}</button>
              : <button key={a.id} onClick={() => setTab("shop")} style={{ ...chip(false), color: C.light }}>🔒 {a.name}・{a.price}</button>)}
          </div>
        </Card>
      </>
    );
  };
  const chip = on => ({ border: `1px solid ${on ? C.accent : C.border}`, background: on ? C.accentBg : C.card, color: on ? C.accent : C.text, borderRadius: 999, padding: "6px 12px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" });

  // ───── 徽章 ─────
  const Badge = () => {
    const got = me.badges.filter(b => b.got.length), worn = got.filter(b => b.got.some(g => g.worn)).map(b => b.id);
    const toggle = id => { const next = worn.includes(id) ? worn.filter(x => x !== id) : [...worn, id].slice(-3); act({ action: "gmWear", badges: JSON.stringify(next) }, "配戴已更新"); };
    return (
      <Card>
        <Title right={<span style={{ fontSize: 12, color: C.muted }}>{got.length}/{me.badges.length}</span>}>我的徽章</Title>
        <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 10 }}>點已獲得的徽章可以配戴（最多 3 個），會顯示在宇宙辦公室的名牌旁</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {me.badges.map(b => {
            const has = b.got.length > 0, on = worn.includes(b.id);
            return <button key={b.id} onClick={() => has && toggle(b.id)} style={{ border: `1.5px solid ${on ? C.accent : C.border}`, borderRadius: 14, padding: "10px 4px", background: has ? C.card : C.warm, cursor: has ? "pointer" : "default", fontFamily: "inherit", textAlign: "center" }}>
              <div style={{ fontSize: 24, filter: has ? "none" : "grayscale(1) opacity(.3)" }}>{b.icon}</div>
              <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 2, color: has ? C.text : C.light }}>{b.name}{b.got.length > 1 ? ` ×${b.got.length}` : ""}</div>
              <div style={{ fontSize: 9.5, color: C.light, marginTop: 2, lineHeight: 1.3 }}>{b.desc}</div>
              {on && <div style={{ fontSize: 9.5, color: C.accent, marginTop: 2 }}>配戴中</div>}
            </button>;
          })}
        </div>
      </Card>
    );
  };

  // ───── 團隊 ─────
  const Team = () => {
    const f = me.fund, nextT = f.tiers.find(t => !t.unlocked), max = nextT ? nextT.at : (f.tiers[f.tiers.length - 1] || { at: 1 }).at;
    return (
      <>
        <Card>
          <Title>本月櫃位營業額排行</Title>
          {me.champion && me.champion.loc && <div style={{ fontSize: 12.5, marginBottom: 8, color: C.gold }}>🏆 上月冠軍：{me.champion.loc.replace(/^\d+/, "")}</div>}
          {me.ranking.length === 0 && <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: 8 }}>本月還沒有收店資料</div>}
          {me.ranking.slice(0, 8).map(r => (
            <div key={r.loc} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
              <span>{r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : r.rank + "."} {r.loc.replace(/^\d+/, "")}</span><b>${Number(r.rev).toLocaleString()}</b>
            </div>))}
          <div style={{ fontSize: 11, color: C.light, marginTop: 8 }}>每月 1 日結算，第一名櫃位的夥伴依上班時數分 {P["冠軍櫃位總獎勵"]} 枚（活動場次不列入）</div>
        </Card>
        <Card>
          <Title right={<span style={{ fontSize: 12, color: C.muted }}>我捐了 {f.mine}</span>}>團隊基金</Title>
          <div style={{ fontSize: 26, fontWeight: 600 }}><Coin n={f.total} size={22} /></div>
          <div style={{ height: 8, background: C.border, borderRadius: 4, overflow: "hidden", margin: "8px 0 4px" }}><div style={{ width: Math.min(100, f.total / max * 100) + "%", height: "100%", background: C.accent }} /></div>
          <div style={{ fontSize: 12, color: C.muted }}>{nextT ? `再 ${nextT.at - f.total} 枚解鎖「${UNLOCK_NAME[nextT.key] || nextT.key}」` : "全部解鎖了！"}</div>
          <div style={{ marginTop: 12 }}>
            {f.tiers.map(t => <div key={t.key} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "5px 0", color: t.unlocked ? C.green : C.text }}>
              <span>{t.unlocked ? "✅" : "🔒"} {UNLOCK_NAME[t.key] || t.key}{SOON[t.key] && !t.unlocked ? "（即將開放）" : ""}</span><span>{t.at.toLocaleString()}</span></div>)}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input type="number" inputMode="numeric" min={P["捐獻最低"]} value={donate} onChange={e => setDonate(e.target.value)} placeholder={`至少 ${P["捐獻最低"]} 枚`} style={{ ...s.input, flex: 1 }} />
            <Btn style={{ width: "auto" }} disabled={!donate || me.frozen} onClick={async () => { if (window.confirm(`確定捐出 ${donate} 枚？捐出後不退回`)) { const d = await act({ action: "gmDonate", amount: donate }, "謝謝你的贊助！"); if (d) setDonate(""); } }}>捐獻</Btn>
          </div>
          {f.top.length > 0 && <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>贊助排行</div>
            {f.top.map((t, i) => <div key={t.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "3px 0" }}><span>{i + 1}. {t.name}</span><Coin n={t.amount} size={11} /></div>)}
          </div>}
        </Card>
      </>
    );
  };

  // ───── 管理者 ─────
  const Admin = () => (
    <Card>
      <Title>管理者工具</Title>
      <input value={adm.target} onChange={e => setAdm(a => ({ ...a, target: e.target.value }))} placeholder="夥伴員工編號（例：E003）" style={{ ...s.input, marginBottom: 8 }} />
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <select value={adm.badge} onChange={e => setAdm(a => ({ ...a, badge: e.target.value }))} style={{ ...s.input, flex: 1 }}>
          <option value="">補發／扣回赤心幣</option><option value="mentor">頒發「好導師」徽章（+50）</option><option value="special">頒發「特別貢獻」徽章</option>
        </select>
        <input type="number" value={adm.amount} onChange={e => setAdm(a => ({ ...a, amount: e.target.value }))} placeholder={adm.badge ? "加幣（選填）" : "數量（可負）"} style={{ ...s.input, width: 110 }} />
      </div>
      <input value={adm.reason} onChange={e => setAdm(a => ({ ...a, reason: e.target.value }))} placeholder="理由（必填，會留紀錄）" style={{ ...s.input, marginBottom: 8 }} />
      <div style={{ display: "flex", gap: 8 }}>
        <Btn kind="secondary" disabled={!adm.target || !adm.reason} onClick={async () => { const d = await act({ action: "gmAdmin", ...adm }, "已完成"); if (d) setAdm({ target: "", amount: "", reason: "", badge: "" }); }}>送出</Btn>
        <Btn kind="ghost" onClick={() => act({ action: "gmRunDaily" }, "已手動結算")}>立即結算</Btn>
      </div>
    </Card>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12, paddingBottom: 2 }}>
        {TABS.map(([k, label]) => <button key={k} onClick={() => { setTab(k); setGres(null); }} style={{ flex: "0 0 auto", ...chip(tab === k), fontWeight: tab === k ? 600 : 400 }}>{label}</button>)}
      </div>
      {me.frozen && <Card style={{ background: C.goldBg, color: C.gold, fontSize: 13 }}>帳號已停用，赤心幣已凍結。</Card>}
      {tab === "home" && <Home />}
      {tab === "shop" && <Shop />}
      {tab === "gacha" && <Gacha />}
      {tab === "pet" && <Pet />}
      {tab === "badge" && <Badge />}
      {tab === "team" && <Team />}
      {toast && <div style={{ position: "fixed", left: "50%", bottom: 96, transform: "translateX(-50%)", background: C.text, color: "#fff", fontSize: 13, padding: "9px 16px", borderRadius: 999, zIndex: 400, maxWidth: "86%", textAlign: "center" }}>{toast}</div>}
    </div>
  );
}
