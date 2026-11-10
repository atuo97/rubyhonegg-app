// ─────────────────────────────────────────────
// 我的小人造型(紙娃娃)
// 夥伴自選:吉祥物、膚色、髮型/髮色、上衣、圍裙、褲子、臉部配件、帽子。
// 存檔後,宇宙辦公室裡的小人就會換成這個造型。
// ─────────────────────────────────────────────
import { useEffect, useState } from "react";
import {
  SKINS, HAIR_STYLES, HAIR_COLORS, TOPS, PANTS, FACES, HATS, MASCOTS,
  defaultCfg, sanitize, hatUnlocked, hatLockText,
} from "./universe/avatarCatalog.js";

const hex = n => "#" + n.toString(16).padStart(6, "0");
const col = (list, id) => hex((list.find(x => x.id === id) || list[0]).c);

// 2D 像素預覽(20×30 格,與 3D 小人同樣的配件組合)
function Doll({ cfg, size = 190 }) {
  const skin = col(SKINS, cfg.skin), hair = col(HAIR_COLORS, cfg.hairColor), top = col(TOPS, cfg.top), pants = col(PANTS, cfg.pants);
  const R = (x, y, w, h, f, k) => <rect key={k} x={x} y={y} width={w} height={h} fill={f} />;
  const hat = cfg.hat, hs = [];
  const hatTop = cfg.mascot === "trex" ? 3 : cfg.mascot === "penguin" ? 5 : 2;
  const hy = hatTop; // 帽子底部 y
  if (hat === "cap") hs.push(R(5, hy, 10, 2, top, "h1"), R(5, hy + 1.5, 12, 1, top, "h2"));
  if (hat === "chef" || hat === "goldchef") { const k = hat === "goldchef" ? "#f1c40f" : "#ffffff";
    hs.push(R(6, hy - 1, 8, 2, k, "h1"), R(5, hy - 4, 10, 3, k, "h2"), R(7, hy - 1, 6, 1, "#e8e2d6", "h3")); }
  if (hat === "beanie") hs.push(R(5, hy - 1, 10, 3, "#3b6ea5", "h1"), R(9, hy - 3, 2, 2, "#fff", "h2"));
  if (hat === "santa") hs.push(R(5, hy, 10, 2, "#fff", "h1"), R(6, hy - 3, 8, 3, "#d62828", "h2"), R(12, hy - 4, 3, 2, "#d62828", "h3"), R(14, hy - 4, 2, 2, "#fff", "h4"));
  if (hat === "pumpkin") hs.push(R(7, hy - 2, 6, 4, "#e67e22", "h1"), R(9, hy - 3, 2, 1, "#2e8b3a", "h2"));
  if (hat === "crown") hs.push(R(6, hy, 8, 2, "#f1c40f", "h1"), R(6, hy - 2, 1.5, 2, "#f1c40f", "h2"), R(9.2, hy - 2, 1.6, 2, "#f1c40f", "h3"), R(12.5, hy - 2, 1.5, 2, "#f1c40f", "h4"));

  let body;
  if (cfg.mascot === "trex") {
    body = <>
      {R(14, 19, 5, 3, "#d94a3a", "t1")}{R(16, 21, 3, 2, "#d94a3a", "t2")}
      {R(7, 22, 3, 6, "#d94a3a", "l1")}{R(11, 22, 3, 6, "#d94a3a", "l2")}{R(6, 27, 4, 1.5, "#a8322a", "f1")}{R(10.5, 27, 4, 1.5, "#a8322a", "f2")}
      {R(6, 14, 9, 9, "#d94a3a", "b")}{R(8, 15, 5, 7, "#ffe6c7", "bl")}
      {R(4, 16, 2, 3, "#d94a3a", "a1")}{R(15, 16, 2, 3, "#d94a3a", "a2")}
      {R(9, 12, 2, 2, "#f1c40f", "s1")}
      {R(4, 4, 12, 10, "#d94a3a", "hd")}{R(5, 11.5, 10, 2.5, "#ffe6c7", "jw")}
      {R(6, 6, 3, 3, "#fff", "e1")}{R(11, 6, 3, 3, "#fff", "e2")}{R(7.5, 7, 1.5, 1.8, "#222", "p1")}{R(12.5, 7, 1.5, 1.8, "#222", "p2")}
      {R(5, 9.5, 2, 1, "#ff9aa2", "c1")}{R(13, 9.5, 2, 1, "#ff9aa2", "c2")}</>;
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
      {cfg.apron && R(6.5, 16, 7, 7, "#fff", "ap")}
      {R(6, 5, 8, 8.5, skin, "hd")}{hairTop}
      {cfg.hairStyle === "bun" && hat === "none" && R(8.5, 1.5, 3, 3, hair, "bun")}
      {R(7.5, 8.5, 1.4, 1.6, "#222", "e1")}{R(11.1, 8.5, 1.4, 1.6, "#222", "e2")}{R(8.7, 11.3, 2.6, 0.8, "#b03a2e", "m")}
      {cfg.face === "glasses" && <g fill="none" stroke="#222" strokeWidth=".5"><rect x="6.8" y="8" width="3" height="2.4"/><rect x="10.2" y="8" width="3" height="2.4"/><path d="M9.8 9h.4"/></g>}
      {cfg.face === "sunglasses" && R(6.8, 8, 6.4, 2.4, "#111", "sg")}
      {cfg.face === "mask" && R(6.5, 10.2, 7, 3, "#fff", "mk")}</>;
  }
  return (
    <svg viewBox="0 0 20 30" width={size} height={size * 1.5} shapeRendering="crispEdges" role="img" aria-label="造型預覽">
      {body}{hs}
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

export default function AvatarEditor({ user, apiGet, apiPost, todayStr, C, s }) {
  const [cfg, setCfg] = useState(defaultCfg());
  const [granted, setGranted] = useState([]);
  const [state, setState] = useState("loading"); // loading | ready | saving | saved | error
  const [msg, setMsg] = useState("");
  const [gTarget, setGTarget] = useState(""); const [gItem, setGItem] = useState("crown"); const [gMsg, setGMsg] = useState("");
  const today = todayStr();

  useEffect(() => {
    let on = true;
    apiGet({ action: "getMyAvatar", empId: user.id }, 1).then(r => {
      if (!on) return;
      if (r && r.success) { setCfg(sanitize(r.data && r.data.cfg)); setGranted((r.data && r.data.granted) || []); setState("ready"); }
      else { setState("ready"); setMsg("造型功能後端尚未開通，先用預設造型預覽（暫時無法儲存）"); }
    });
    return () => { on = false; };
  }, []);

  const set = (k, v) => { setCfg(c => ({ ...c, [k]: v })); if (state === "saved") setState("ready"); };

  const save = async () => {
    const h = HATS.find(x => x.id === cfg.hat);
    if (!hatUnlocked(h, today, granted)) { setMsg("這個帽子目前還沒解鎖，請換一個"); return; }
    setState("saving"); setMsg("");
    const r = await apiPost({ action: "saveAvatar", empId: user.id, cfg: JSON.stringify(cfg) }, 0);
    if (r && r.success) setState("saved"); else { setState("ready"); setMsg((r && r.error) || "儲存失敗，請稍後再試"); }
  };

  const grant = async () => {
    setGMsg("");
    const r = await apiPost({ action: "grantItem", empId: user.id, target: gTarget.trim(), item: gItem }, 0);
    setGMsg(r && r.success ? `已發放給 ${gTarget.trim()}` : (r && r.error) || "發放失敗");
  };

  const Title = ({ children }) => <div style={{ ...s.sectionTitle, marginTop: 16, marginBottom: 8 }}>{children}</div>;
  const isMascot = cfg.mascot !== "none";

  return (
    <div>
      <div style={{ ...s.card, display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 16px 14px",
                    background: "linear-gradient(180deg,#f7f0e6,#fffdfa)" }}>
        <Doll cfg={cfg} />
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6 }}>這就是你在宇宙辦公室裡的樣子</div>
      </div>

      {msg && <div style={{ ...s.card, background: C.goldBg, fontSize: 12.5, color: C.gold, padding: "10px 14px" }}>{msg}</div>}

      <div style={s.card}>
        <Title>角色</Title>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {MASCOTS.map(m => <Chip key={m.id} C={C} on={cfg.mascot === m.id} label={m.name} onClick={() => set("mascot", m.id)} />)}
        </div>
        {isMascot && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8 }}>穿上吉祥物裝後，膚色、髮型、衣服會先收起來；帽子仍然可以戴。</div>}

        {!isMascot && <>
          <Title>膚色</Title>
          <div style={{ display: "flex", gap: 10 }}>{SKINS.map(x => <Swatch key={x.id} on={cfg.skin === x.id} c={hex(x.c)} label={x.name} onClick={() => set("skin", x.id)} />)}</div>
          <Title>髮型</Title>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{HAIR_STYLES.map(x => <Chip key={x.id} C={C} on={cfg.hairStyle === x.id} label={x.name} onClick={() => set("hairStyle", x.id)} />)}</div>
          <Title>髮色</Title>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{HAIR_COLORS.map(x => <Swatch key={x.id} on={cfg.hairColor === x.id} c={hex(x.c)} label={x.name} onClick={() => set("hairColor", x.id)} />)}</div>
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
          {HATS.map(h => {
            const ok = hatUnlocked(h, today, granted);
            return <Chip key={h.id} C={C} on={cfg.hat === h.id} locked={!ok} label={h.name}
              sub={h.kind === "free" ? null : ok ? "已解鎖" : hatLockText(h)}
              onClick={() => ok ? set("hat", h.id) : setMsg(`「${h.name}」${hatLockText(h)}，時間到或拿到發放就能戴`)} />;
          })}
        </div>
      </div>

      <button onClick={save} disabled={state === "saving" || state === "loading"} style={{ ...s.btn("primary"), opacity: state === "saving" ? .7 : 1 }}>
        {state === "saving" ? "儲存中…" : state === "saved" ? "已儲存 ✓" : "儲存造型"}
      </button>
      {state === "saved" && <div style={{ fontSize: 12, color: C.muted, textAlign: "center", marginTop: 8 }}>儲存好了，宇宙辦公室下次更新（最多 3 分鐘）就會看到新造型。</div>}

      {user.role >= 3 && (
        <div style={{ ...s.card, marginTop: 16 }}>
          <div style={s.sectionTitle}>發放限定造型（管理者）</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={gTarget} onChange={e => setGTarget(e.target.value)} placeholder="夥伴員工編號" style={{ ...s.input, flex: 1 }} />
            <select value={gItem} onChange={e => setGItem(e.target.value)} style={{ ...s.input, width: "auto" }}>
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
