// ─────────────────────────────────────────────
// 我的小人造型(紙娃娃)
// 隊員自選:吉祥物、膚色、髮型/髮色、上衣、圍裙、褲子、臉部配件、帽子;v1.17 起加上官方商店的配件、服裝、名牌框。
// 存檔後,宇宙辦公室裡的小人就會換成這個造型。
// ─────────────────────────────────────────────
import { useEffect, useState } from "react";
import { Flash } from "./TopToast.jsx";
import { Coin, Heart } from "./Coin.jsx";
import { PeoplePicker } from "./People39.jsx";
import {
  SKINS, HAIR_STYLES, HAIR_COLORS, TOPS, PANTS, FACES, HATS, MASCOTS, ACCS, OUTFITS, FRAMES,
  defaultCfg, sanitize, hatUnlocked, hatLockText, SAYING_MAX, mascotUnlocked, mascotNeedText, MASCOT_KEEP_UNTIL,
} from "./universe/avatarCatalog.js";

const hex = n => "#" + n.toString(16).padStart(6, "0");
const col = (list, id) => hex((list.find(x => x.id === id) || list[0]).c);

// 2D 像素預覽(20×30 格,與 3D 小人同樣的配件組合)
export function Doll({ cfg, size = 190 }) {
  const OC = { chefsuit: ["#ffffff", "#2c2c3a"], spacesuit: ["#dfe6ec", "#dfe6ec"], raincoat: ["#f4d03f", null], goldtrex: ["#f1c40f", "#f1c40f"] }[cfg.outfit];
  const skin = col(SKINS, cfg.skin), hair = col(HAIR_COLORS, cfg.hairColor), top = OC ? OC[0] : col(TOPS, cfg.top), pants = OC && OC[1] ? OC[1] : col(PANTS, cfg.pants);
  const R = (x, y, w, h, f, k) => <rect key={k} x={x} y={y} width={w} height={h} fill={f} />;
  const hat = cfg.hat, hs = [];
  const hatTop = cfg.mascot === "trex" ? 3 : cfg.mascot === "penguin" ? 5 : cfg.mascot === "robot" ? 3 : cfg.outfit === "goldtrex" ? 1 : 2;
  const hy = hatTop; // 帽子底部 y
  if (hat === "cap") hs.push(R(5, hy, 10, 2, top, "h1"), R(5, hy + 1.5, 12, 1, top, "h2"));
  if (hat === "chef" || hat === "goldchef") { const k = hat === "goldchef" ? "#f1c40f" : "#ffffff";
    hs.push(R(6, hy - 1, 8, 2, k, "h1"), R(5, hy - 4, 10, 3, k, "h2"), R(7, hy - 1, 6, 1, "#e8e2d6", "h3")); }
  if (hat === "beanie") hs.push(R(5, hy - 1, 10, 3, "#3b6ea5", "h1"), R(9, hy - 3, 2, 2, "#fff", "h2"));
  if (hat === "santa") hs.push(R(5, hy, 10, 2, "#fff", "h1"), R(6, hy - 3, 8, 3, "#d62828", "h2"), R(12, hy - 4, 3, 2, "#d62828", "h3"), R(14, hy - 4, 2, 2, "#fff", "h4"));
  if (hat === "pumpkin") hs.push(R(7, hy - 2, 6, 4, "#e67e22", "h1"), R(9, hy - 3, 2, 1, "#2e8b3a", "h2"));
  if (hat === "g_antenna") hs.push(R(7, hy - 3, 0.6, 3, "#2ecc71", "h1"), R(12.4, hy - 3, 0.6, 3, "#2ecc71", "h2"), R(6.5, hy - 4, 1.6, 1.6, "#7dff7d", "h3"), R(11.9, hy - 4, 1.6, 1.6, "#7dff7d", "h4"));
  if (hat === "g_helmet") hs.push(<rect key="h1" x="4.5" y={hy + 0.5} width="11" height="11" rx="3" fill="#bfe7ff" opacity=".45" stroke="#9fb3c8" strokeWidth=".4" />);
  if (hat === "g_ufo") hs.push(R(4, hy, 12, 1.2, "#9aa3ad", "h1"), R(7.5, hy - 1.8, 5, 2, "#8fd3ff", "h2"));
  if (hat === "party") hs.push(<polygon key="h1" points={`10,${hy - 5} 7,${hy + 1} 13,${hy + 1}`} fill="#ff6fa8" />);
  if (hat === "og_cap") hs.push(R(5, hy, 10, 2, "#c0392b", "h1"), R(5, hy + 1.5, 12, 1, "#c0392b", "h2"), R(8, hy + 0.4, 4, 1.2, "#f1c40f", "h3"));
  if (hat === "crown") hs.push(R(6, hy, 8, 2, "#f1c40f", "h1"), R(6, hy - 2, 1.5, 2, "#f1c40f", "h2"), R(9.2, hy - 2, 1.6, 2, "#f1c40f", "h3"), R(12.5, hy - 2, 1.5, 2, "#f1c40f", "h4"));

  let body;
  if (cfg.mascot === "trex") {
    body = <>
      {R(14, 19, 5, 3, (cfg._gold ? "#f1c40f" : "#d94a3a"), "t1")}{R(16, 21, 3, 2, (cfg._gold ? "#f1c40f" : "#d94a3a"), "t2")}
      {R(7, 22, 3, 6, (cfg._gold ? "#f1c40f" : "#d94a3a"), "l1")}{R(11, 22, 3, 6, (cfg._gold ? "#f1c40f" : "#d94a3a"), "l2")}{R(6, 27, 4, 1.5, "#a8322a", "f1")}{R(10.5, 27, 4, 1.5, "#a8322a", "f2")}
      {R(6, 14, 9, 9, (cfg._gold ? "#f1c40f" : "#d94a3a"), "b")}{R(8, 15, 5, 7, "#ffe6c7", "bl")}
      {R(4, 16, 2, 3, (cfg._gold ? "#f1c40f" : "#d94a3a"), "a1")}{R(15, 16, 2, 3, (cfg._gold ? "#f1c40f" : "#d94a3a"), "a2")}
      {R(9, 12, 2, 2, "#f1c40f", "s1")}
      {R(4, 4, 12, 10, (cfg._gold ? "#f1c40f" : "#d94a3a"), "hd")}{R(5, 11.5, 10, 2.5, "#ffe6c7", "jw")}
      {R(6, 6, 3, 3, "#fff", "e1")}{R(11, 6, 3, 3, "#fff", "e2")}{R(7.5, 7, 1.5, 1.8, "#222", "p1")}{R(12.5, 7, 1.5, 1.8, "#222", "p2")}
      {R(5, 9.5, 2, 1, "#ff9aa2", "c1")}{R(13, 9.5, 2, 1, "#ff9aa2", "c2")}</>;
  } else if (cfg.mascot === "robot") {   // v1.41 機器人
    body = <>
      {R(6, 22, 3, 5, "#7f8c99", "l1")}{R(11, 22, 3, 5, "#7f8c99", "l2")}{R(5.5, 26.5, 4, 1.5, "#4a5560", "f1")}{R(10.5, 26.5, 4, 1.5, "#4a5560", "f2")}
      {R(4, 14, 12, 9, "#bfc8d2", "b")}{R(7, 15.5, 6, 5, "#2c3e50", "pn")}{R(8.6, 17, 2.8, 2, "#c0392b", "ht")}{R(8.2, 16.4, 1.4, 1.2, "#c0392b", "h1")}{R(10.4, 16.4, 1.4, 1.2, "#c0392b", "h2")}
      {R(2, 14, 2, 7, "#7f8c99", "a1")}{R(16, 14, 2, 7, "#7f8c99", "a2")}{R(1.6, 20.5, 2.8, 2, "#bfc8d2", "k1")}{R(15.6, 20.5, 2.8, 2, "#bfc8d2", "k2")}
      {R(4, 4, 12, 9, "#bfc8d2", "hd")}{R(5.5, 5.5, 9, 6, "#1b2631", "sc")}{R(7, 7.3, 2, 2, "#5dfdcb", "e1")}{R(11, 7.3, 2, 2, "#5dfdcb", "e2")}{R(8.5, 10, 3, 0.7, "#5dfdcb", "m")}
      {R(9.6, 1.5, 0.8, 2.5, "#7f8c99", "an")}{R(9, 0.4, 2, 1.6, "#ff5a5a", "bl")}</>;
  } else if (cfg.mascot === "penguin") {
    body = <>
      {R(6, 25, 4, 1.5, "#f39c12", "f1")}{R(11, 25, 4, 1.5, "#f39c12", "f2")}
      {R(5, 13, 11, 13, "#1c1c24", "b")}{R(7, 15, 7, 10, "#fff", "bl")}{R(4, 14, 1.5, 8, "#1c1c24", "a1")}{R(15.5, 14, 1.5, 8, "#1c1c24", "a2")}
      {R(5, 13, 11, 2.5, top, "sc")}
      {R(5, 6, 11, 8, "#1c1c24", "hd")}{R(7, 8, 7, 5, "#fff", "fc")}{R(7.5, 9, 1.4, 1.6, "#111", "e1")}{R(12, 9, 1.4, 1.6, "#111", "e2")}{R(9.2, 10.8, 2.6, 1.4, "#f39c12", "bk")}</>;
  } else {
    const back = [];
    if (cfg.hairStyle === "long") back.push(R(5, 5, 10, 14, hair, "hb"));
    if (cfg.hairStyle === "bob") back.push(R(5, 5, 10, 9, hair, "hb"));
    if (cfg.hairStyle === "ponytail") back.push(R(14, 6, 2.5, 8, hair, "hb"));
    const hairTop = cfg.hairStyle === "buzz" ? R(6, 4, 8, 1.5, hair, "ht") : R(6, 3.5, 8, 3, hair, "ht");
    body = <>
      {back}
      {R(6, 22, 3, 6, pants, "l1")}{R(11, 22, 3, 6, pants, "l2")}{R(6, 27.5, 3.5, 1.2, "#2a2a30", "s1")}{R(10.5, 27.5, 3.5, 1.2, "#2a2a30", "s2")}
      {R(4, 14, 12, 9, top, "b")}{R(2, 14, 2, 7, top, "a1")}{R(16, 14, 2, 7, top, "a2")}{R(2, 20.5, 2, 1.5, skin, "h1")}{R(16, 20.5, 2, 1.5, skin, "h2")}
      {cfg.apron && !OC && R(6.5, 16, 7, 7, "#fff", "ap")}
      {R(6, 5, 8, 8.5, skin, "hd")}{hairTop}
      {cfg.hairStyle === "bun" && hat === "none" && R(8.5, 1.5, 3, 3, hair, "bun")}
      {R(7.5, 8.5, 1.4, 1.6, "#222", "e1")}{R(11.1, 8.5, 1.4, 1.6, "#222", "e2")}{R(8.7, 11.3, 2.6, 0.8, "#b03a2e", "m")}
      {cfg.face === "glasses" && <g fill="none" stroke="#222" strokeWidth=".5"><rect x="6.8" y="8" width="3" height="2.4"/><rect x="10.2" y="8" width="3" height="2.4"/><path d="M9.8 9h.4"/></g>}
      {cfg.face === "sunglasses" && R(6.8, 8, 6.4, 2.4, "#111", "sg")}
      {cfg.face === "mask" && R(6.5, 10.2, 7, 3, "#fff", "mk")}</>;
  }
  const a = cfg.acc, behind = [], front = [];
  if (a === "cape" || a === "g_galaxy") behind.push(R(3, 14, 14, 13, a === "cape" ? "#c0392b" : "#2c2c6e", "ab"));
  if (a === "g_galaxy") [[5, 24], [14, 20], [15, 25]].forEach((p, i) => front.push(R(p[0], p[1], 0.8, 0.8, "#fff", "gs" + i)));
  if (a === "wings") behind.push(<polygon key="w1" points="4,15 0,11 1,20" fill="#fff" stroke="#ddd" strokeWidth=".3" />, <polygon key="w2" points="16,15 20,11 19,20" fill="#fff" stroke="#ddd" strokeWidth=".3" />);
  if (a === "backpack" || a === "g_rocket") behind.push(R(15, 15, 3.5, 7, a === "backpack" ? "#8e5b3a" : "#dfe6ec", "bp"));
  if (a === "g_rocket") behind.push(R(15.5, 22, 2.5, 2, "#ff8c1a", "fl"));
  if (a === "halo") front.push(<ellipse key="hl" cx="10" cy="1.6" rx="4" ry="1" fill="none" stroke="#ffe066" strokeWidth=".8" />);
  if (a === "g_saturn") front.push(<ellipse key="sr" cx="10" cy="9" rx="8" ry="2" fill="none" stroke="#f5b041" strokeWidth=".7" />);
  if (a === "scarf") front.push(R(4.5, 13.2, 11, 2, "#e74c3c", "sf"), R(12, 15, 2, 4, "#e74c3c", "sf2"));
  if (a === "bowtie") front.push(R(8, 14, 1.8, 1.4, "#c0392b", "bt1"), R(10.2, 14, 1.8, 1.4, "#c0392b", "bt2"));
  if (a === "g_starclip") front.push(R(13, 4.5, 1.6, 1.6, "#ffe066", "sc"));
  if (a === "g_moonpin") front.push(R(7, 16, 1.4, 1.4, "#f1c40f", "mp"));
  if (cfg.outfit === "chefsuit") [17, 19, 21].forEach(y => front.push(R(8.6, y, 0.6, 0.6, "#333", "cb" + y), R(10.8, y, 0.6, 0.6, "#333", "cc" + y)));
  if (cfg.outfit === "spacesuit") front.push(R(7.5, 17, 5, 3, "#2e86de", "sp"));
  if (cfg.outfit === "goldtrex" && cfg.mascot === "none") {   // v1.41 金色小暴龍裝：頭套露出臉、背刺、尾巴
    behind.push(R(15, 19, 4, 3, "#f1c40f", "tt1"), R(17, 21, 2.5, 2, "#f1c40f", "tt2"));
    front.push(R(5, 2, 10, 3, "#f1c40f", "hd1"), R(5, 2, 1.4, 11, "#f1c40f", "hd2"), R(13.6, 2, 1.4, 11, "#f1c40f", "hd3"), R(6.5, 2.6, 2, 1.6, "#fff", "he1"), R(11.5, 2.6, 2, 1.6, "#fff", "he2"), R(7.2, 3, 0.9, 0.9, "#222", "hp1"), R(12.2, 3, 0.9, 0.9, "#222", "hp2"),
      R(6.4, 4.6, 7.2, 0.6, "#fff", "tth"), R(9, 0.8, 2, 1.4, "#c49a12", "sp1"), R(7.5, 16, 5, 6, "#ffe6c7", "bly"));
  }
  return (
    <svg viewBox="0 0 20 30" width={size} height={size * 1.5} shapeRendering="crispEdges" role="img" aria-label="造型預覽">
      {behind}{body}{front}{hs}
    </svg>
  );
}

const Swatch = ({ on, c, label, onClick, locked }) => (
  <button onClick={onClick} title={label} aria-label={label} style={{
    width: 34, height: 34, borderRadius: 17, cursor: "pointer", background: c, opacity: locked ? .35 : 1,
    border: on ? "2.5px solid #2b221c" : "1px solid #d6cbbb", boxShadow: on ? "0 0 0 2px #fffdfa inset" : "none", padding: 0,
  }} />
);
const Chip = ({ on, label, sub, onClick, locked, C }) => (
  <button onClick={onClick} style={{
    padding: "8px 12px", borderRadius: 12, cursor: locked ? "not-allowed" : "pointer", fontFamily: "inherit", textAlign: "left",
    border: `1px solid ${on ? C.accent : C.border}`, background: on ? C.accentBg : C.card, color: locked ? C.light : C.text, fontSize: 13,
  }}>
    <div style={{ fontWeight: on ? 600 : 400 }}>{locked ? "🔒 " : ""}{label}</div>
    {sub && <div style={{ fontSize: 10.5, color: C.muted, marginTop: 1 }}>{sub}</div>}
  </button>
);

export default function AvatarEditor({ user, apiGet, apiPost, todayStr, C, s, onOpenShop }) {
  const [cfg, setCfg] = useState(defaultCfg());
  const [granted, setGranted] = useState([]);
  const [owned, setOwned] = useState({});
  const [prices, setPrices] = useState({});
  const [state, setState] = useState("loading"); // loading | ready | saving | saved | error
  const [msg, setMsg] = useState("");
  const [hearts, setHearts] = useState(null);       // v1.41 角色解鎖用 {n,g}
  const [origMascot, setOrigMascot] = useState("none");
  const [gTarget, setGTarget] = useState(""); const [gItem, setGItem] = useState("crown"); const [gMsg, setGMsg] = useState("");
  const today = todayStr();

  useEffect(() => {
    let on = true;
    apiGet({ action: "getMyAvatar", empId: user.id }, 1).then(r => {
      if (!on) return;
      if (r && r.success) { const c0 = sanitize(r.data && r.data.cfg); setCfg(c0); setOrigMascot(c0.mascot); setGranted((r.data && r.data.granted) || []); setState("ready"); }
      else { setState("ready"); setMsg("造型功能後端尚未開通，先用預設造型預覽（暫時無法儲存）"); }
    });
    apiGet({ action: "h36Me", empId: user.id }, 0).then(r => { if (on && r && r.success && r.data) setHearts({ n: r.data.n || 0, g: r.data.g || 0 }); else if (on) setHearts({ n: 0, g: 0 }); });
    apiGet({ action: "gmMe", empId: user.id }, 0).then(r => {
      if (!on || !r || !r.success) return;
      const o = {}, pr = {}; (r.data.catalog || []).forEach(c => { if (c.owned) o[c.id] = 1; pr[c.id] = c; });
      setOwned(o); setPrices(pr);
    });
    return () => { on = false; };
  }, []);
  // 商店／扭蛋物品:有在商品目錄裡、但還沒擁有 → 鎖住
  const lockedItem = id => !!prices[id] && !owned[id];
  const lockText = id => { const c = prices[id]; return !c ? "" : c.where === "扭蛋" ? "扭蛋限定" : c.where === "季節扭蛋" ? (c.series || "季節") + "扭蛋" : `❤️ ${c.price}`; };
  const tryPick = (k, id, name) => lockedItem(id) ? setMsg(`「${name}」要先${prices[id].where === "扭蛋" ? "從扭蛋機抽到" : prices[id].where === "季節扭蛋" ? "從" + (prices[id].series || "季節") + "扭蛋抽到" : "到官方商店購買"}才能穿`) : set(k, id);

  const set = (k, v) => { setCfg(c => ({ ...c, [k]: v })); if (state === "saved") setState("ready"); };

  // v1.41 角色解鎖（12/1 前已經在用的人可以繼續用）
  const canMascot = id => mascotUnlocked(id, hearts) || (id === origMascot && today < MASCOT_KEEP_UNTIL);
  const save = async () => {
    if (!canMascot(cfg.mascot)) { setMsg(`「${(MASCOTS.find(m => m.id === cfg.mascot) || {}).name}」要${mascotNeedText(cfg.mascot)}，請換一個角色`); return; }
    const h = HATS.find(x => x.id === cfg.hat);
    if (!hatUnlocked(h, today, granted, owned)) { setMsg("這個帽子目前還沒解鎖，請換一個"); return; }
    const bad = ["hairColor", "acc", "outfit", "frame"].find(k => lockedItem(cfg[k]));
    if (bad) { setMsg("有還沒擁有的物品，請先換掉或購買"); return; }
    setState("saving"); setMsg("");
    const r = await apiPost({ action: "saveAvatar", empId: user.id, cfg: JSON.stringify(cfg) }, 0);
    if (r && r.success) setState("saved"); else { setState("ready"); setMsg((r && r.error) || "儲存失敗，請稍後再試"); }
  };

  const grant = async () => {
    setGMsg("");
    const r = await apiPost({ action: "grantItem", empId: user.id, target: gTarget.trim(), item: gItem }, 0);
    setGMsg(r && r.success ? "✅ 已發放" : (r && r.error) || "發放失敗"); if (r && r.success) setGTarget("");
  };

  const Title = ({ children }) => <div style={{ ...s.sectionTitle, marginTop: 16, marginBottom: 8 }}>{children}</div>;
  const isMascot = cfg.mascot !== "none";

  return (
    <div>
      <div style={{ ...s.card, display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 16px 14px",
                    background: "linear-gradient(180deg,#f7f0e6,#fffdfa)" }}>
        <div style={{ minHeight: 30, maxWidth: 260, marginBottom: 8, padding: cfg.saying ? "6px 12px" : 0, borderRadius: 12, background: "#fffaf2", border: cfg.saying ? `1px solid ${C.border}` : "none", fontSize: 12.5, color: "#2b1d14", textAlign: "center", lineHeight: 1.4 }}>{cfg.saying}</div>
        <Doll cfg={cfg} />
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6 }}>這就是你在宇宙辦公室裡的樣子</div>
      </div>

      <Flash text={msg} />{msg && <div style={{ ...s.card, background: C.goldBg, fontSize: 12.5, color: C.gold, padding: "10px 14px" }}>{msg}</div>}

      <div style={s.card}>
        <div style={s.sectionTitle}>頭頂的一句話</div>
        <input value={cfg.saying} maxLength={SAYING_MAX} onChange={e => set("saying", e.target.value)} placeholder="例如：今天也要加油！" style={s.input} />
        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6 }}>會出現在宇宙辦公室你的頭頂，所有隊員都看得到（{[...cfg.saying].length}/{SAYING_MAX} 字）。請友善、正向喔。</div>
        <Title>角色</Title>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {MASCOTS.map(m => { const ok = canMascot(m.id); return <Chip key={m.id} C={C} on={cfg.mascot === m.id} label={m.name} locked={!ok} sub={m.need ? (ok && !mascotUnlocked(m.id, hearts) ? "可用到 11/30" : mascotNeedText(m.id)) : ""}
            onClick={() => ok ? set("mascot", m.id) : setMsg(`「${m.name}」要${mascotNeedText(m.id)}${hearts ? `（你目前點亮 ${hearts.n} 心、金心 ${hearts.g} 顆）` : ""}`)} />; })}
        </div>
        {isMascot && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8 }}>穿上吉祥物裝後，膚色、髮型、衣服會先收起來；帽子仍然可以戴。</div>}

        {!isMascot && <>
          <Title>膚色</Title>
          <div style={{ display: "flex", gap: 10 }}>{SKINS.map(x => <Swatch key={x.id} on={cfg.skin === x.id} c={hex(x.c)} label={x.name} onClick={() => set("skin", x.id)} />)}</div>
          <Title>髮型</Title>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{HAIR_STYLES.map(x => <Chip key={x.id} C={C} on={cfg.hairStyle === x.id} label={x.name} onClick={() => set("hairStyle", x.id)} />)}</div>
          <Title>髮色</Title>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{HAIR_COLORS.map(x => <Swatch key={x.id} on={cfg.hairColor === x.id} c={hex(x.c)} label={x.name + (lockedItem(x.id) ? "（" + lockText(x.id) + "）" : "")} locked={lockedItem(x.id)} onClick={() => tryPick("hairColor", x.id, x.name)} />)}</div>
          <Title>上衣</Title>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{TOPS.map(x => <Swatch key={x.id} on={cfg.top === x.id} c={hex(x.c)} label={x.name} onClick={() => set("top", x.id)} />)}</div>
          <div style={{ marginTop: 10 }}>
            <Chip C={C} on={cfg.apron} label={cfg.apron ? "穿圍裙" : "不穿圍裙"} onClick={() => set("apron", !cfg.apron)} />
          </div>
          <Title>褲子</Title>
          <div style={{ display: "flex", gap: 10 }}>{PANTS.map(x => <Swatch key={x.id} on={cfg.pants === x.id} c={hex(x.c)} label={x.name} onClick={() => set("pants", x.id)} />)}</div>
          <Title>臉部配件</Title>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{FACES.map(x => <Chip key={x.id} C={C} on={cfg.face === x.id} label={x.name} onClick={() => set("face", x.id)} />)}</div>
        </>}

        <Title>帽子・頭飾</Title>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {HATS.filter(h => h.kind === "og" ? owned[h.id] : (h.kind !== "shop" || owned[h.id] || prices[h.id])).map(h => {
            const ok = hatUnlocked(h, today, granted, owned);
            return <Chip key={h.id} C={C} on={cfg.hat === h.id} locked={!ok} label={h.name}
              sub={h.kind === "free" ? null : ok ? "已解鎖" : hatLockText(h)}
              onClick={() => ok ? set("hat", h.id) : setMsg(`「${h.name}」${hatLockText(h)}，${h.kind === "shop" ? "從扭蛋機抽到就能戴" : "時間到或拿到發放就能戴"}`)} />;
          })}
        </div>

        {[["配件", "acc", ACCS], ["服裝", "outfit", OUTFITS], ["名牌框", "frame", FRAMES]].map(([title, k, list]) => (
          <div key={k}>
            <Title>{title}</Title>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {list.filter(x => x.id === "none" || (prices[x.id] && (!/^og_/.test(x.id) || owned[x.id]))).map(x => (
                <Chip key={x.id} C={C} on={cfg[k] === x.id} locked={lockedItem(x.id)} label={x.name}
                  sub={x.id !== "none" ? (lockedItem(x.id) ? lockText(x.id) : "已擁有") : null}
                  onClick={() => tryPick(k, x.id, x.name)} />))}
            </div>
          </div>
        ))}
        {onOpenShop && <button onClick={onOpenShop} style={{ ...s.btn("secondary"), marginTop: 14 }}><Heart size={13} /> 去官方商店逛逛</button>}
      </div>

      <button onClick={save} disabled={state === "saving" || state === "loading"} style={{ ...s.btn("primary"), opacity: state === "saving" ? .7 : 1 }}>
        {state === "saving" ? "儲存中…" : state === "saved" ? "已儲存 ✓" : "儲存造型"}
      </button>
      {state === "saved" && <div style={{ fontSize: 12, color: C.muted, textAlign: "center", marginTop: 8 }}>儲存好了，宇宙辦公室下次更新（最多 3 分鐘）就會看到新造型。</div>}

      {user.role >= 3 && (
        <div style={{ ...s.card, marginTop: 16 }}>
          <div style={s.sectionTitle}>發放限定造型（管理者）</div>
          <PeoplePicker apiGet={apiGet} C={C} s={s} value={gTarget} onChange={setGTarget} />
          <div style={{ display: "flex", gap: 8 }}>
            <select value={gItem} onChange={e => setGItem(e.target.value)} style={{ ...s.input, flex: 1 }}>
              {HATS.filter(h => h.kind === "limited").map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
          <button onClick={grant} disabled={!gTarget.trim()} style={{ ...s.btn("secondary"), marginTop: 10, opacity: gTarget.trim() ? 1 : .5 }}>發放</button>
          {gMsg && <div style={{ fontSize: 12.5, color: C.muted, marginTop: 8 }}>{gMsg}</div>}
        </div>
      )}
    </div>
  );
}
