// v1.47 結果視窗共用：「立刻裝上」「去背包看」（獨立小檔，避免和 GameTab、Spend30 互相 import）
import { useState } from "react";

// 任何地方都能叫 App 換頁（結果視窗的「去背包看」等）
export const goTo = (t) => { try { window.dispatchEvent(new CustomEvent("rh:nav", { detail: t })); } catch (e) {} };
// 結果視窗的「立刻裝上」「去背包看」
//   kind: deco（桌上擺飾，直接擺上）｜macc（坐騎配件，直接裝上）｜look（造型，到背包造型頁穿上）｜pet｜ticket
export function BagButtons({ kind, item, apiGet, apiPost, C, s, onDone }) {
  const [msg, setMsg] = useState(""), [busy, setBusy] = useState(false);
  const bagTab = { deco: "seat", macc: "mount", look: "look", pet: "pet", ticket: "ticket" }[kind] || "look";
  const equip = async () => {
    setBusy(true); setMsg("");
    try {
      if (kind === "deco") {
        const r = await apiGet({ action: "s30Me" }, 0), d = r && r.success ? r.data : null;
        if (!d || !d.seat) { setMsg("要先開通我的座位（官方商店 → 座位）"); return; }
        const deco = (d.seat.deco || []).filter(x => x !== item);
        if (deco.length >= (d.decoMax || 3)) { setMsg(`桌上已經擺滿 ${d.decoMax || 3} 個，到背包換一個`); return; }
        const w = await apiPost({ action: "s30Set", deco: JSON.stringify([...deco, item]) }, 0);
        setMsg(w && w.success ? "✅ 擺到你的辦公桌了" : (w && w.error) || "擺不上去");
      } else if (kind === "macc") {
        const r = await apiGet({ action: "v44MaccMe" }, 0), d = r && r.success ? r.data : null;
        const on = ((d && d.on) || []).filter(x => x !== item);
        if (on.length >= ((d && d.max) || 3)) { setMsg(`已經裝滿 ${(d && d.max) || 3} 個，到背包換一個`); return; }
        const w = await apiPost({ action: "v44MaccSet", on: [...on, item] }, 0);
        setMsg(w && w.success ? "✅ 裝到你的坐騎上了" : (w && w.error) || "裝不上去");
      } else { goTo({ tab: "bag", bag: bagTab }); onDone && onDone(); }
    } finally { setBusy(false); }
  };
  const b = (bg, fg) => ({ flex: 1, border: bg ? "none" : `1px solid ${C.border}`, borderRadius: 10, padding: "8px 0", background: bg || "#fff", color: fg || C.text, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" });
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 6 }}>
        {kind !== "ticket" && <button disabled={busy} onClick={equip} style={b(C.accent, "#fff")}>{kind === "deco" ? "立刻擺上" : kind === "look" ? "立刻穿上" : "立刻裝上"}</button>}
        <button onClick={() => { goTo({ tab: "bag", bag: bagTab }); onDone && onDone(); }} style={b()}>🎒 去背包看</button>
      </div>
      {msg && <div style={{ fontSize: 12.5, marginTop: 6, color: msg.startsWith("✅") ? C.green : C.red }}>{msg}</div>}
    </div>
  );
}
