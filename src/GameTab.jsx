// ─────────────────────────────────────────────
// 赤心幣(紅玉滿宇宙遊戲化)
// 分頁:總覽、商店、扭蛋、寵物、徽章、團隊。資料來源:後端 gmMe(一次拿齊),各動作 gmBuy/gmGacha/…
// ─────────────────────────────────────────────
import { createContext, useContext, useEffect, useState } from "react";
import { Flash } from "./TopToast.jsx";
import { Coin, Heart } from "./Coin.jsx";
import MiniGames from "./MiniGames.jsx";
import { PetTeam, PetMarket } from "./PetTeam.jsx";
import { Doll } from "./AvatarEditor.jsx";
import { defaultCfg, sanitize } from "./universe/avatarCatalog.js";
import { PetSprite, PET_TYPES, PET_TYPE_NAME, PET_FLAVORS, PET_STAGE_NAMES, PET_ATTR, PET_COUNTER, petLine } from "./pets/petSprites.jsx";

const TABS = [["home", "總覽"], ["shop", "商店"], ["gacha", "扭蛋"], ["pet", "寵物"], ["play", "小遊戲"], ["badge", "徽章"], ["team", "團隊"]];
const CAT_NAME = { haircolor: "髮色", acc: "配件", outfit: "服裝", frame: "名牌框", hat: "頭飾", petacc: "寵物配件", weapon: "對戰武器", armor: "對戰防具", card: "對戰卡片" };
const TIER_COLOR = { "普通": "#8a7e72", "稀有": "#3d5a80", "傳說": "#b9381c" };
const UNLOCK_NAME = { lounge: "咖啡機＋地毯", plants: "植物牆＋水族箱", arcade: "遊戲區（大型電玩＋桌球）", station: "新場景・宇宙太空站", spectrum: "七色光譜大廳" };
const SOON = { station: 1, spectrum: 1 };
const ITEM_ICON = { haircolor: "💇", acc: "🎀", outfit: "👕", frame: "🏷️", hat: "🎩", petacc: "🐣", weapon: "⚔️", armor: "🛡️", card: "🃏" };

export { Coin, Heart };

// v1.33 試穿預覽：點商品就能看到穿在自己（或寵物）身上的樣子，買不起也能看
const WEAR_FIELD = { haircolor: "hairColor", acc: "acc", outfit: "outfit", hat: "hat", frame: "frame" };
const FRAME_STYLE = {
  frame_wood: { background: "#8e5b3a", border: "1.5px solid #d4a373" },
  frame_glow: { background: "#c0392b", border: "1.5px solid #ffe066", boxShadow: "0 0 8px #ffe066" },
  x_frame: { background: "#2f6fb0", border: "1.5px solid #fff", boxShadow: "0 0 6px #bfe3ff" },
  c_frame: { background: "#b81d1d", border: "1.5px solid #f1c40f", boxShadow: "0 0 6px #f1c40f" },
  og_frame: { background: "linear-gradient(90deg,#8a5a00,#f1c40f,#8a5a00)", color: "#2b1d14", border: "1.5px solid #fff3b0", boxShadow: "0 0 8px #f1c40f" },
};
export function TryOn({ item, user, apiGet, pet, balance, frozen, busy, C, s, onBuy, onClose, onEditAvatar }) {
  const [cfg, setCfg] = useState(null);
  useEffect(() => { apiGet({ action: "getMyAvatar", empId: user.id }, 1).then(r => setCfg(sanitize(r && r.success && r.data ? r.data.cfg : null))).catch(() => setCfg(defaultCfg())); }, []);
  const f = WEAR_FIELD[item.cat], short = Math.max(0, item.price - balance);
  const tag = st => <span style={{ display: "inline-block", fontSize: 13, fontWeight: 700, color: "#fff", background: "rgba(0,0,0,.45)", padding: "2px 10px", borderRadius: 7, ...st }}>{user.name}</span>;
  let body;
  if (f && cfg) {
    const now = cfg, after = { ...cfg, [f]: item.id };
    body = <div style={{ display: "flex", justifyContent: "space-around", alignItems: "flex-end" }}>
      <div style={{ textAlign: "center", opacity: .55 }}><Doll cfg={now} size={96} /><div style={{ fontSize: 11, color: C.muted }}>現在</div></div>
      <div style={{ fontSize: 20, color: C.light, paddingBottom: 50 }}>→</div>
      <div style={{ textAlign: "center" }}>
        {f === "frame" && <div style={{ marginBottom: 6 }}>{tag(FRAME_STYLE[item.id] || {})}</div>}
        <Doll cfg={after} size={150} /><div style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>穿上之後</div></div>
    </div>;
  } else if (item.cat === "petacc") {
    body = pet && pet.stage ? <div style={{ display: "flex", justifyContent: "space-around", alignItems: "flex-end" }}>
      <div style={{ textAlign: "center", opacity: .55 }}><PetSprite type={pet.type} stage={pet.stage} flavor={pet.flavor} acc={pet.acc} size={84} /><div style={{ fontSize: 11, color: C.muted }}>現在</div></div>
      <div style={{ fontSize: 20, color: C.light, paddingBottom: 40 }}>→</div>
      <div style={{ textAlign: "center" }}><PetSprite type={pet.type} stage={pet.stage} flavor={pet.flavor} acc={item.id} size={132} /><div style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>戴上之後</div></div>
    </div> : <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: 20 }}>先領養寵物，就能幫牠戴配件</div>;
  } else if (f && !cfg) body = <div className="rh-skel" style={{ height: 180, borderRadius: 14 }} />;
  else body = <div style={{ textAlign: "center", fontSize: 64, padding: "10px 0" }}>{ITEM_ICON[item.cat] || "🎁"}</div>;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,14,10,.55)", zIndex: 500, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto" }}>
      {/* v1.34：試穿改從畫面頂端出現（原本從底部滑出，容易沒注意到） */}
      <style>{`@keyframes rhDropIn{from{opacity:0;transform:translateY(-24px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div onClick={e => e.stopPropagation()} style={{ background: C.card, width: "100%", maxWidth: 480, borderRadius: "0 0 20px 20px", padding: "calc(16px + env(safe-area-inset-top)) 16px 18px", animation: "rhDropIn .25s ease-out", boxShadow: "0 10px 30px rgba(0,0,0,.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div><div style={{ fontSize: 17, fontWeight: 700 }}>{item.name}</div>
            <div style={{ fontSize: 12, color: TIER_COLOR[item.tier] || C.muted }}>{item.tier}・{CAT_NAME[item.cat] || item.cat}{item.note && !/^\p{Extended_Pictographic}/u.test(item.note) ? "・" + item.note : ""}</div></div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", fontSize: 20, color: C.light, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ background: C.warm, borderRadius: 16, padding: "14px 8px", marginBottom: 14 }}>{body}</div>
        {item.owned ? <button onClick={() => { onClose(); onEditAvatar && f && onEditAvatar(); }} style={s.btn("secondary")}>✓ 已擁有{f && onEditAvatar ? "・去換裝穿上" : ""}</button>
          : item.price > 0 ? <button disabled={busy || frozen || short > 0} onClick={onBuy} style={{ ...s.btn("primary"), opacity: short > 0 ? .5 : 1 }}>{short > 0 ? `還差 ${short} 枚・上班賺工時幣就能買` : <>買下 <Coin n={item.price} size={13} /></>}</button>
          : <div style={{ textAlign: "center", fontSize: 12.5, color: C.muted }}>{item.where === "扭蛋" ? "扭蛋機限定，抽到就能戴" : item.where || "限定款，不在商店販售"}</div>}
      </div>
    </div>
  );
}

// v1.19：這三個小元件原本寫在 GameTab 裡面，每次重畫都被當成新元件 → 裡面的輸入框一打字就失去焦點（一次只能打一個字）。
// 改到外層定義，透過 context 拿樣式與忙碌狀態。
const GCtx = createContext({});
function Card({ children, style }) { const { s } = useContext(GCtx); return <div style={{ ...s.card, ...style }}>{children}</div>; }
function Title({ children, right }) { const { s } = useContext(GCtx); return <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><div style={{ ...s.sectionTitle, marginBottom: 0 }}>{children}</div>{right}</div>; }
function Btn({ children, onClick, disabled, kind = "primary", style }) { const { s, busy } = useContext(GCtx); return <button onClick={onClick} disabled={disabled || busy} style={{ ...s.btn(kind), padding: "9px 14px", fontSize: 13, opacity: disabled || busy ? .5 : 1, ...style }}>{children}</button>; }

export default function GameTab({ user, apiGet, apiPost, C, s, initialTab, onEditAvatar, onChanged, onlyTab, onNav, shopCats }) {
  const [tryItem, setTryItem] = useState(null);   // v1.33 試穿預覽
  const [tab, setTab] = useState(onlyTab || initialTab || "home");
  const go = (k) => { if (onlyTab && onNav) onNav(k); else setTab(k); };
  const [me, setMe] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [gres, setGres] = useState(null);
  const [petForm, setPetForm] = useState({ flavor: "原味", name: "" });
  const [petView, setPetView] = useState("main");
  const [hatch, setHatch] = useState(null);       // 孵化儀式：{pet, phase}
  useEffect(() => {        // 寵物剛孵化（有型態、這支手機還沒看過）→ 播孵化動畫
    const pt = me && me.pet; if (!pt || !pt.type || !pt.id) return;
    let seen = ""; try { seen = localStorage.getItem("rh_hatch_" + pt.id) || ""; } catch (e) {}
    if (!seen && (!onlyTab || onlyTab === "pet")) { setHatch({ pet: pt, phase: 0 }); setTimeout(() => setHatch(h => h && { ...h, phase: 1 }), 1800); try { localStorage.setItem("rh_hatch_" + pt.id, "1"); } catch (e) {} }
  }, [me && me.pet && me.pet.id, me && me.pet && me.pet.type]);
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

  // ───── 總覽 ─────
  const Home = () => (
    <>
      <Card style={{ textAlign: "center", padding: "20px 16px", background: "linear-gradient(180deg,#fff6e8,#fffdfa)" }}>
        <div style={{ fontSize: 12, color: C.muted }}>我的赤心幣</div>
        <div style={{ fontSize: 38, fontWeight: 600, marginTop: 4 }}><Coin n={me.balance} size={30} /></div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 8, lineHeight: 1.6 }}>
          {!started ? `${P["測試版開始日"]} 測試版開始累積` : !official ? `測試期間：${P["正式版開始日"]} 正式版上線時，當下餘額 ×${P["正式版加倍倍率"]}` : "正式版"}
          <br />每工作 1 小時 1 枚{me.role >= 3 ? "（管理層 ×1.5）" : me.role >= 2 ? "（分隊長 ×1.2）" : ""}，活動場次再 ×2，每天凌晨結算到前一天
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
      {me.isTop && Admin()}
    </>
  );

  // ───── 商店 ─────
  const Shop = () => {
    const items = me.catalog.filter(c => c.where === "商店" && (!shopCats || shopCats.includes(c.cat)));
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
                <div key={i.id} onClick={() => setTryItem(i)} style={{ border: `1px solid ${C.border}`, borderRadius: 14, padding: 10, background: i.owned ? C.warm : C.card, cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 22 }}>{ITEM_ICON[i.cat] || "🎁"}</span>{i.owned ? <span style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", background: C.green, borderRadius: 999, padding: "1px 8px" }}>✓ 已擁有</span> : <span style={{ fontSize: 10.5, color: C.accent }}>{WEAR_FIELD[i.cat] || i.cat === "petacc" ? "👀 試穿" : "看看"}</span>}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 4 }}>{i.name}</div>
                  <div style={{ fontSize: 11, color: TIER_COLOR[i.tier] }}>{i.tier}</div>
                  <div style={{ marginTop: 8 }}>
                    {i.owned ? <span style={{ fontSize: 11.5, color: C.accent }}>{WEAR_FIELD[i.cat] || i.cat === "petacc" ? "👀 點一下試穿・換裝" : ""}</span>
                      : <span onClick={e => e.stopPropagation()}><Btn disabled={me.balance < i.price || me.frozen} onClick={() => act({ action: "gmBuy", item: i.id }, `買到「${i.name}」了！到換裝頁穿上吧`)}><Coin n={i.price} size={12} /></Btn></span>}
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

  // ───── 寵物（v1.19 改版）─────
  const Pet = () => {
    const pt = me.pet;
    const typeOf = id => PET_TYPE_NAME[id] || "";
    if (!pt) return (
      <Card>
        <Title>{me.petEverOwned ? "孵一顆新的蛋" : "免費領養寵物蛋"}</Title>
        <div style={{ textAlign: "center", margin: "6px 0 10px" }}><PetSprite stage={1} size={88} /></div>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, marginBottom: 12 }}>
          每個人的寵物都從一顆蛋開始。你上班累積工時，牠就會長大；滿 40 小時孵化，隨機開出<b>雞、暴龍、挖土機、火車、三角龍</b>其中一種。不用餵食，也不會生病。
        </div>
        <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 6 }}>選一個口味顏色</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {Object.keys(PET_FLAVORS).map(f => <button key={f} onClick={() => setPetForm(x => ({ ...x, flavor: f }))} style={{ flex: 1, border: `2px solid ${petForm.flavor === f ? C.text : C.border}`, borderRadius: 14, padding: "10px 0", background: C.card, cursor: "pointer", fontFamily: "inherit" }}>
            <div style={{ width: 26, height: 26, margin: "0 auto", borderRadius: 8, background: PET_FLAVORS[f][0] }} /><div style={{ fontSize: 12, marginTop: 4 }}>{f}</div></button>)}
        </div>
        <input value={petForm.name} maxLength={8} onChange={e => setPetForm(x => ({ ...x, name: e.target.value }))} placeholder="幫牠取名字（8 字內）" style={s.input} />
        <Btn style={{ marginTop: 12 }} disabled={me.frozen} onClick={async () => { const ok = await act({ action: "gmPetBuy", flavor: petForm.flavor, name: petForm.name }, "領養成功！到宇宙辦公室看看牠吧"); if (ok) setPetForm(x => ({ ...x, name: "" })); }}>免費領養</Btn>
      </Card>);
    const next = pt.nextAt, prevAt = [0, 40, 120, 300, 600][pt.stage - 1] || 0;
    const pct = next ? Math.min(100, Math.round((pt.hours - prevAt) / (next - prevAt) * 100)) : 100;
    const accs = me.catalog.filter(c => c.cat === "petacc");
    const SUB = [["main", "我的寵物"], ["team", "隊伍"], ["market", "市集"], ["album", "相簿"], ["diary", "日記"], ["dex", "圖鑑"], ["trade", "交換"]];
    const incoming = (me.petTrades || []).filter(t => !t.mine), outgoing = (me.petTrades || []).filter(t => t.mine);
    return (
      <>
        <div style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto" }}>
          {SUB.map(([k, l]) => <button key={k} onClick={() => setPetView(k)} style={{ ...chip(petView === k), flex: "0 0 auto" }}>{l}{k === "trade" && incoming.length ? ` ・${incoming.length}` : ""}</button>)}
        </div>

        {petView === "main" && <>
          <Card style={{ textAlign: "center", padding: "20px 16px" }}>
            <PetSprite type={pt.type} stage={pt.stage} flavor={pt.flavor} acc={pt.acc} size={128} />
            {pt.stage >= 3 && petLine(pt, 0) && <div style={{ display: "inline-block", marginTop: 6, background: C.warm, borderRadius: 12, padding: "4px 12px", fontSize: 13 }}>「{petLine(pt)}」</div>}
            <div style={{ fontSize: 17, fontWeight: 600, marginTop: 10 }}>{pt.name}</div>
            <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>{pt.flavor}{pt.type ? "・" + typeOf(pt.type) : ""}・第 {pt.stage} 階段「{pt.stageName}」</div>
            {!pt.type && <div style={{ fontSize: 12.5, color: C.accent, marginTop: 4 }}>上班滿 40 小時就會孵化，到時才知道是什麼喔！</div>}
            <div style={{ marginTop: 14, textAlign: "left" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.muted }}><span>陪你上班 {pt.hours} 小時</span><span>{next ? `${next} 小時長大` : "已是完全體"}</span></div>
              <div style={{ height: 6, background: C.border, borderRadius: 4, overflow: "hidden", marginTop: 4 }}><div style={{ width: pct + "%", height: "100%", background: C.accent }} /></div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
              {PET_STAGE_NAMES.map((n, i) => <div key={i} style={{ fontSize: 10.5, color: i < pt.stage ? C.accent : C.light, textAlign: "center", width: "20%" }}>
                <PetSprite type={pt.type} stage={i + 1} flavor={pt.flavor} size={30} silhouette={i >= pt.stage} /><br />{n}</div>)}
            </div>
          </Card>
          {pt.type && <Card>
            <Title>對戰屬性</Title>
            <div style={{ fontSize: 13, lineHeight: 1.8 }}>{PET_ATTR[pt.type]}（第 2～5 階段發揮 25%～100%）<br />
              剋制：{PET_COUNTER[pt.type].map(typeOf).join("、")}（傷害 ×1.2）<br />
              被剋：{Object.keys(PET_COUNTER).filter(k => PET_COUNTER[k].includes(pt.type)).map(typeOf).join("、")}</div>
          </Card>}
          {pt.stage >= 5 && <Card style={{ background: "#fff6e8" }}>
            <Title>收進圖鑑，再孵一顆蛋</Title>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 10 }}>{pt.name}已經是完全體了！可以把牠收進圖鑑永久保存，再免費孵一顆新的蛋（型態一樣隨機）。五種都養到完全體可得「寵物圖鑑大師」徽章。</div>
            <div style={{ display: "flex", gap: 8 }}>
              <select value={petForm.flavor} onChange={e => setPetForm(x => ({ ...x, flavor: e.target.value }))} style={{ ...s.input, width: 90 }}>{Object.keys(PET_FLAVORS).map(f => <option key={f}>{f}</option>)}</select>
              <input value={petForm.name} maxLength={8} onChange={e => setPetForm(x => ({ ...x, name: e.target.value }))} placeholder="新寵物名字" style={{ ...s.input, flex: 1 }} />
            </div>
            <Btn style={{ marginTop: 10 }} onClick={async () => { if (!window.confirm(`把${pt.name}收進圖鑑，再孵一顆新的蛋？`)) return; const ok = await act({ action: "gmPetBuy", flavor: petForm.flavor, name: petForm.name }, "新的蛋來了！"); if (ok) setPetForm(x => ({ ...x, name: "" })); }}>收進圖鑑・孵新蛋</Btn>
          </Card>}
          <Card>
            <Title>改名字</Title>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={petForm.name} maxLength={8} onChange={e => setPetForm(x => ({ ...x, name: e.target.value }))} placeholder={pt.name} style={{ ...s.input, flex: 1 }} />
              <Btn style={{ width: "auto" }} disabled={!petForm.name.trim()} onClick={async () => { const ok = await act({ action: "gmPetUpdate", name: petForm.name }, "改好名字了"); if (ok) setPetForm(x => ({ ...x, name: "" })); }}>改名</Btn>
            </div>
            <Btn kind="secondary" style={{ marginTop: 10 }} onClick={() => go("play")}>🎮 和{pt.name}玩小遊戲</Btn>
          </Card>
          <Card>
            <Title>寵物配件</Title>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => act({ action: "gmPetUpdate", acc: "" }, "已拿下配件")} style={chip(!pt.acc)}>不戴</button>
              {accs.map(a => a.owned
                ? <button key={a.id} onClick={() => act({ action: "gmPetUpdate", acc: a.id }, "幫牠戴上了")} style={chip(pt.acc === a.id)}>{a.name}</button>
                : <button key={a.id} onClick={() => go("shop")} style={{ ...chip(false), color: C.light }}>🔒 {a.name}・{a.price}</button>)}
            </div>
          </Card>
        </>}

        {petView === "team" && <PetTeam user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} balance={me.balance} onChanged={() => { load(); onChanged && onChanged(); }} />}
        {petView === "market" && <PetMarket user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} balance={me.balance} onChanged={() => { load(); onChanged && onChanged(); }} />}
        {petView === "album" && <Card>
          <Title>{pt.name}的成長相簿</Title>
          {(me.petAlbum || []).map(a => (
            <div key={a.stage} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
              <PetSprite type={pt.type} stage={a.stage} flavor={pt.flavor} size={56} style={{ background: C.warm, borderRadius: 12 }} />
              <div><div style={{ fontSize: 14, fontWeight: 600 }}>{a.stage === 1 ? "領養了一顆蛋" : a.stage === 2 && pt.type ? `孵出了${typeOf(pt.type)}！` : `長成「${a.stageName}」`}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{a.date.slice(5).replace("-", "/")}・陪你上班 {a.hours} 小時</div></div>
            </div>))}
          {pt.stage < 5 && <div style={{ fontSize: 12.5, color: C.light, padding: "10px 0 2px" }}>下一張：上班滿 {pt.nextAt} 小時（還差 {Math.max(0, pt.nextAt - pt.hours)} 小時）</div>}
        </Card>}

        {petView === "diary" && <Card>
          <Title>{pt.name}的日記</Title>
          {!(me.petDiary || []).length && <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>每週一早上，{pt.name}會寫一篇上週陪你上班的日記。</div>}
          {(me.petDiary || []).map(d => (
            <div key={d.week} style={{ padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11.5, color: C.light }}>{d.week.slice(5).replace("-", "/")} 那一週</div>
              <div style={{ fontSize: 13.5, lineHeight: 1.7, marginTop: 2 }}>{d.text}</div>
            </div>))}
        </Card>}

        {petView === "dex" && <Card>
          <Title right={<span style={{ fontSize: 12, color: C.muted }}>{new Set((me.petDex || []).map(d => d.type)).size}/5</span>}>寵物圖鑑</Title>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6, textAlign: "center" }}>
            {PET_TYPES.map(([k, n]) => { const got = (me.petDex || []).find(d => d.type === k); return (
              <div key={k}><PetSprite type={k} stage={5} flavor={got ? got.flavor : "原味"} silhouette={!got} size={56} style={{ background: C.warm, borderRadius: 10 }} />
                <div style={{ fontSize: 11.5, color: got ? C.text : C.light }}>{got ? n : "？？？"}</div></div>); })}
          </div>
          {(me.petDex || []).length > 0 && <div style={{ marginTop: 12 }}>{me.petDex.map(d => <div key={d.id} style={{ fontSize: 12.5, color: C.muted, padding: "3px 0" }}>📖 {d.name}（{d.flavor}{typeOf(d.type)}）{d.current ? "・還在身邊" : ""}</div>)}</div>}
          <div style={{ fontSize: 11.5, color: C.light, marginTop: 10 }}>親手養到完全體才會收進圖鑑；五種集滿得「寵物圖鑑大師」徽章（+100）。</div>
        </Card>}

        {petView === "trade" && <>
          {incoming.map(t => <Card key={t.id} style={{ background: "#fff6e8" }}>
            <Title>{t.otherName} 想跟你交換寵物</Title>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", marginBottom: 10 }}>
              <div style={{ textAlign: "center", fontSize: 12 }}><PetSprite type={pt.type} stage={pt.stage} flavor={pt.flavor} size={56} /><br />你的{pt.name}</div>
              <div style={{ fontSize: 20 }}>⇄</div>
              {t.otherPet && <div style={{ textAlign: "center", fontSize: 12 }}><PetSprite type={t.otherPet.type} stage={t.otherPet.stage} flavor={t.otherPet.flavor} size={56} /><br />{t.otherPet.name}（{t.otherPet.typeName}）</div>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn kind="ghost" onClick={() => act({ action: "gmPetTradeReply", id: t.id, accept: false }, "已婉拒")}>婉拒</Btn>
              <Btn onClick={() => { if (window.confirm("確定交換嗎？交換後配件會留在你身上，30 天內不能再換。")) act({ action: "gmPetTradeReply", id: t.id, accept: true }, "交換成功！"); }}>同意交換</Btn>
            </div>
          </Card>)}
          {outgoing.map(t => <Card key={t.id}>
            <div style={{ fontSize: 13.5 }}>已向 <b>{t.otherName}</b> 提出交換，等對方回覆中…</div>
            <Btn kind="ghost" style={{ marginTop: 8 }} onClick={() => act({ action: "gmPetTradeReply", id: t.id, cancel: true }, "已取消")}>取消</Btn>
          </Card>)}
          <Card>
            <Title>提出交換</Title>
            <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.7, marginBottom: 10 }}>
              一隻換一隻、雙方都同意才成立，不能加赤心幣。只能換<b>相同階段</b>、還沒到完全體的寵物（第 2～4 階段）。交換後寵物照新主人的工時繼續長大；配件留在原主人身上；每人 30 天限換 1 次。
              {me.petTradeNext && me.petTradeNext > me.today ? <><br /><span style={{ color: C.accent }}>你在 {me.petTradeNext} 之後才能再交換。</span></> : null}
            </div>
            {(pt.stage < 2 || pt.stage >= 5) && <div style={{ fontSize: 13, color: C.muted }}>{pt.stage < 2 ? "孵化之後才能交換喔。" : "完全體不能交換。"}</div>}
            {pt.stage >= 2 && pt.stage < 5 && !(me.petPartners || []).length && <div style={{ fontSize: 13, color: C.muted }}>目前沒有同階段的夥伴可以交換。</div>}
            {(me.petPartners || []).map(p => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                <PetSprite type={p.pet.type} stage={p.pet.stage} flavor={p.pet.flavor} size={44} />
                <div style={{ flex: 1, fontSize: 13 }}><b>{p.name}</b> 的 {p.pet.name}<div style={{ fontSize: 11.5, color: C.muted }}>{p.pet.flavor}{p.pet.typeName}</div></div>
                <Btn kind="secondary" style={{ width: "auto" }} disabled={!!outgoing.length || (me.petTradeNext && me.petTradeNext > me.today)} onClick={() => act({ action: "gmPetTrade", to: p.id }, "已送出交換邀請")}>提出交換</Btn>
              </div>))}
          </Card>
        </>}
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
      <Title>大隊長工具</Title>
      <input value={adm.target} onChange={e => setAdm(a => ({ ...a, target: e.target.value }))} placeholder="夥伴員工編號（例：E003）" style={{ ...s.input, marginBottom: 8 }} />
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <select value={adm.badge} onChange={e => setAdm(a => ({ ...a, badge: e.target.value }))} style={{ ...s.input, flex: 1 }}>
          <option value="">補發／扣回赤心幣</option><option value="mentor">頒發「好導師」徽章（+50）</option><option value="special">頒發「特別貢獻」徽章</option><option value="debugger">頒發「除錯大師」徽章（+20，每人最多 5 次）</option>
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
    <GCtx.Provider value={{ s, C, busy }}><div>
      {!onlyTab && <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12, paddingBottom: 2 }}>
        {TABS.map(([k, label]) => <button key={k} onClick={() => { setTab(k); setGres(null); }} style={{ flex: "0 0 auto", ...chip(tab === k), fontWeight: tab === k ? 600 : 400 }}>{label}</button>)}
      </div>}
      {me.frozen && <Card style={{ background: C.goldBg, color: C.gold, fontSize: 13 }}>帳號已停用，赤心幣已凍結。</Card>}
      {tab === "home" && Home()}
      {tab === "shop" && Shop()}
      {tryItem && me && <TryOn item={{ ...tryItem, owned: (me.catalog.find(c => c.id === tryItem.id) || tryItem).owned }} user={user} apiGet={apiGet} pet={me.pet} balance={me.balance} frozen={me.frozen} busy={busy} C={C} s={s}
        onClose={() => setTryItem(null)} onEditAvatar={onEditAvatar}
        onBuy={async () => { const ok = await act({ action: "gmBuy", item: tryItem.id }, `買到「${tryItem.name}」了！到換裝頁穿上吧`); if (ok) setTryItem(null); }} />}
      {tab === "gacha" && Gacha()}
      {tab === "pet" && Pet()}
      {tab === "play" && <MiniGames user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} onChanged={() => { load(); onChanged && onChanged(); }} />}
      {tab === "badge" && Badge()}
      {tab === "team" && Team()}
      {hatch && <div onClick={() => hatch.phase && setHatch(null)} style={{ position: "fixed", inset: 0, background: "rgba(20,12,6,.72)", zIndex: 500, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff", textAlign: "center" }}>
        <style>{`@keyframes rhShake{0%,100%{transform:rotate(0)}20%{transform:rotate(-12deg)}40%{transform:rotate(10deg)}60%{transform:rotate(-8deg)}80%{transform:rotate(6deg)}}@keyframes rhPop{0%{transform:scale(.3);opacity:0}70%{transform:scale(1.15);opacity:1}100%{transform:scale(1)}}`}</style>
        {hatch.phase === 0
          ? <><div style={{ animation: "rhShake .45s infinite" }}><PetSprite stage={1} size={160} /></div><div style={{ marginTop: 16, fontSize: 16 }}>蛋在動了…！</div></>
          : <><div style={{ animation: "rhPop .6s ease-out" }}><PetSprite type={hatch.pet.type} stage={Math.max(2, hatch.pet.stage)} flavor={hatch.pet.flavor} size={180} /></div>
              <div style={{ marginTop: 14, fontSize: 20, fontWeight: 600 }}>{hatch.pet.name} 孵出了{PET_TYPE_NAME[hatch.pet.type]}！</div>
              <div style={{ fontSize: 13, opacity: .85, marginTop: 6 }}>{PET_ATTR[hatch.pet.type]}</div>
              <div style={{ fontSize: 12, opacity: .6, marginTop: 18 }}>點一下繼續</div></>}
      </div>}
      {toast && <Flash text={toast} />}
    </div></GCtx.Provider>
  );
}
