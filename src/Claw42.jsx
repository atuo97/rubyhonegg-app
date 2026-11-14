// ─────────────────────────────────────────────
// v1.42 遊戲室：夾娃娃機（v1.44 v3 改版：約 3 次中 1 次，大多 1～10 枚赤心幣，桌面小配件是稀有驚喜；連續 6 次沒夾到，下一次必中）
// 結果由後端決定（v42Claw），畫面只負責動畫；對準度會稍微提高機率。
// ─────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BagButtons } from "./Bag47.jsx";

const W = 320, H = 400, FLOOR = 330, TOP = 40, CHUTE = 46;
const TOYS = [["🪙", 80], ["🦖", 125], ["💰", 170], ["🧸", 215], ["🪙", 255], ["🪴", 105], ["🎟️", 190], ["🪙", 238]];

export default function Claw42({ apiPost, apiGet, C, s, onClose }) {
  const cv = useRef(null), st = useRef({ x: 160, y: TOP, phase: "idle", open: 1, carry: null, dir: 0, t: 0 });
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState("用 ◀ ▶ 移動夾子，對準了再按「夾！」"), [info, setInfo] = useState(null);
  const toys = useRef(TOYS.map(([e, x], i) => ({ e, x, y: FLOOR - (i >= 5 ? 34 : 4), alive: true })));

  useEffect(() => {
    let raf; const g = cv.current.getContext("2d");
    const loop = () => {
      const S = st.current;
      if (S.phase === "idle" && S.dir) S.x = Math.max(70, Math.min(W - 30, S.x + S.dir * 2.4));
      if (S.phase === "down") { S.y += 3; if (S.y >= S.target) { S.phase = "close"; S.t = 0; } }
      if (S.phase === "close") { S.open = Math.max(0, S.open - 0.06); if (S.open <= 0) { S.phase = "up"; if (S.toy) { S.carry = S.toy; } } }
      if (S.phase === "up") { S.y -= 2.2; if (S.carry && !S.win && S.y < S.dropAt) { S.carry.falling = true; S.carry = null; } if (S.y <= TOP) { S.y = TOP; S.phase = S.win ? "home" : "reset"; } }
      if (S.phase === "home") { S.x -= 2.4; if (S.x <= CHUTE) { S.x = CHUTE; if (S.carry) { S.carry.alive = false; S.carry = null; } S.open = 1; S.phase = "back"; } }
      if (S.phase === "back") { S.x += 3; if (S.x >= 160) { S.x = 160; S.phase = "idle"; S.done && S.done(); } }
      if (S.phase === "reset") { S.open = Math.min(1, S.open + 0.05); if (S.open >= 1) { S.phase = "idle"; S.done && S.done(); } }
      toys.current.forEach(t => { if (t.falling) { t.y += 5; const fy = FLOOR - 4; if (t.y >= fy) { t.y = fy; t.falling = false; } } });
      if (S.carry) { S.carry.x = S.x; S.carry.y = S.y + 52; }
      // 畫面
      g.clearRect(0, 0, W, H);
      g.fillStyle = "#ffe1ee"; g.fillRect(0, 0, W, H);
      g.fillStyle = "#ff6fa8"; g.fillRect(0, 0, W, 26); g.fillStyle = "#fff"; g.font = "bold 15px sans-serif"; g.textAlign = "center"; g.fillText("🧸 紅玉滿夾娃娃機", W / 2, 18);
      g.fillStyle = "rgba(190,230,255,.35)"; g.fillRect(10, 26, W - 20, FLOOR + 14 - 26);
      g.fillStyle = "#c0392b"; g.fillRect(10, FLOOR + 14, W - 20, H - FLOOR - 14);
      g.fillStyle = "#2b1d14"; g.fillRect(14, FLOOR - 40, 58, 54); g.fillStyle = "#fff"; g.font = "11px sans-serif"; g.fillText("出口", 43, FLOOR + 30);
      g.strokeStyle = "#999"; g.lineWidth = 3; g.beginPath(); g.moveTo(10, TOP - 10); g.lineTo(W - 10, TOP - 10); g.stroke();
      g.font = "30px sans-serif"; toys.current.forEach(t => { if (t.alive && t !== S.carry) g.fillText(t.e, t.x, t.y); });
      // 夾子
      const x = S.x, y = S.y, o = S.open;
      g.strokeStyle = "#7f8c8d"; g.lineWidth = 3; g.beginPath(); g.moveTo(x, TOP - 10); g.lineTo(x, y); g.stroke();
      g.fillStyle = "#bfc8d2"; g.fillRect(x - 12, y, 24, 10);
      g.lineWidth = 4; g.strokeStyle = "#95a5a6";
      g.beginPath(); g.moveTo(x - 10, y + 10); g.lineTo(x - 10 - 12 * o, y + 26); g.lineTo(x - 4 - 8 * o, y + 40); g.stroke();
      g.beginPath(); g.moveTo(x + 10, y + 10); g.lineTo(x + 10 + 12 * o, y + 26); g.lineTo(x + 4 + 8 * o, y + 40); g.stroke();
      if (S.carry) { g.font = "30px sans-serif"; g.fillText(S.carry.e, S.carry.x, S.carry.y); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, []);

  const grab = async () => {
    const S = st.current; if (busy || S.phase !== "idle") return;
    const alive = toys.current.filter(t => t.alive && !t.falling);
    const near = alive.reduce((b, t) => (!b || Math.abs(t.x - S.x) < Math.abs(b.x - S.x) ? t : b), null);
    const align = near ? Math.max(0, 1 - Math.abs(near.x - S.x) / 22) : 0;
    setBusy(true); setMsg("夾…夾…");
    const r = await apiPost({ action: "v42Claw", align }, 0);
    if (!(r && r.success)) { setBusy(false); setMsg((r && r.error) || "失敗了，再試一次"); return; }
    const d = r.data; setInfo({ ...d, show: false });
    S.win = d.win; S.toy = near && Math.abs(near.x - S.x) < 40 ? near : null;
    S.target = S.toy ? S.toy.y - 52 : FLOOR - 52; S.dropAt = TOP + 60 + Math.random() * 120;
    if (d.win && !S.toy) S.toy = near;
    if (d.win && S.toy && d.emoji) S.toy.e = d.emoji;   // 夾起來的就是抽中的那個小配件
    S.phase = "down";
    S.done = () => {
      setBusy(false); setInfo(x => x ? { ...x, show: true } : x);
      setMsg(d.win ? `🎉 夾到了！${d.emoji || ""} ${d.prize}` : d.miss >= d.pity - 3 ? `差一點！再 ${d.pity - d.miss} 次一定夾得到` : ["差一點點！", "滑掉了…再來一次？", "好可惜！"][Math.floor(Math.random() * 3)]);
      if (d.win && toys.current.filter(t => t.alive).length < 3) toys.current = TOYS.map(([e, x], i) => ({ e, x, y: FLOOR - (i >= 5 ? 34 : 4), alive: true }));
    };
  };
  const hold = d => () => (st.current.dir = d), release = () => (st.current.dir = 0);
  const btn = { flex: 1, height: 54, borderRadius: 14, border: "none", fontSize: 22, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", touchAction: "none", userSelect: "none" };
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1700, background: "rgba(20,10,20,.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: "calc(10px + env(safe-area-inset-top)) 10px calc(10px + env(safe-area-inset-bottom))" }}>
      <div style={{ width: "100%", maxWidth: 360, background: "#fff7fb", borderRadius: 20, padding: 12, boxShadow: "0 10px 30px rgba(0,0,0,.4)" }}>
        <canvas ref={cv} width={W} height={H} style={{ width: "100%", borderRadius: 12, display: "block" }} />
        <div style={{ fontSize: 13.5, textAlign: "center", margin: "8px 0", minHeight: 20, color: "#7a2a4a", fontWeight: 600 }}>{msg}</div>
        {info && info.show && info.win && (info.item || /扭蛋券/.test(info.prize || "")) && <div style={{ marginBottom: 8 }}><BagButtons kind={info.item ? "deco" : "ticket"} item={info.item} apiGet={apiGet || ((q, n) => apiPost(q, n))} apiPost={apiPost} C={C} s={s} onDone={onClose} /></div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...btn, background: "#ffd1e3" }} onPointerDown={hold(-1)} onPointerUp={release} onPointerLeave={release} onPointerCancel={release}>◀</button>
          <button disabled={busy} onClick={grab} style={{ ...btn, flex: 1.4, background: busy ? "#ccc" : "#ff6fa8", color: "#fff" }}>夾！<span style={{ display: "block", fontSize: 11, fontWeight: 400 }}>1 枚</span></button>
          <button style={{ ...btn, background: "#ffd1e3" }} onPointerDown={hold(1)} onPointerUp={release} onPointerLeave={release} onPointerCancel={release}>▶</button>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#9a7a8a", marginTop: 8 }}>
          <span>{info ? `赤心幣 ${info.balance}` : "獎品：1～10 枚赤心幣、桌面小配件、扭蛋券"}</span><span>{info ? `再 ${Math.max(0, info.pity - info.miss)} 次必中` : "連續 6 次沒夾到，下一次必中"}</span>
        </div>
        <button onClick={onClose} disabled={busy} style={{ ...s.btn("ghost"), marginTop: 10 }}>離開</button>
      </div>
    </div>, document.body
  );
}
