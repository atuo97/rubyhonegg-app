// ─────────────────────────────────────────────
// 寵物小遊戲(寵物階段依序解鎖):接雞蛋糕、翻翻樂、打磚塊、烤爐大挑戰、寵物跑酷
// 後端:gmGames / gmGameStart(用掉寵物零食加的命)/ gmGameScore(破個人紀錄給幣,每天上限)
// ─────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { Coin, Heart } from "./Coin.jsx";
import { spriteCanvas } from "./pets/petSprites.jsx";

const FL = [["原味", "#f3c66b"], ["可可", "#7b4a2e"], ["紅玉", "#d9534f"], ["抹茶", "#8bbf6a"]];
const PETC = { "原味": "#f3c66b", "可可": "#7b4a2e", "紅玉": "#d9534f", "抹茶": "#8bbf6a" };
const ICON = { catch: "🧺", memory: "🃏", breakout: "🧱", oven: "🔥", runner: "🏃", match: "🧇", stack: "🍰", batter1: "⚔️", batter2: "⚔️", batter3: "⚔️" };
// v1.38 樂園新遊戲：獨立的網頁遊戲（public/games），用全螢幕 iframe 開，結束時用 postMessage 把分數交回來
const EXT = {
  match: { file: "match", url: g => `lv=${Math.min(200, (g.best || 0) + 1)}` },
  stack: { file: "stack", url: () => "" },
  batter1: { file: "batter", url: () => "m=1", bgm: "battle" },
  batter2: { file: "batter", url: () => "m=2", bgm: "battle" },
  batter3: { file: "batter", url: () => "m=3", bgm: "battle" },
};
const GV = 38;   // 遊戲檔版本（改遊戲檔時加 1，避免手機用到舊的快取）
function ExtGame({ id, g, onEnd, onClose }) {
  const ref = useRef(null), ended = useRef(false);
  useEffect(() => {
    const h = e => {
      const d = e.data; if (!d || d.rh !== "game" || !ref.current || e.source !== ref.current.contentWindow) return;
      if (d.type === "end" && !ended.current) { ended.current = true; onEnd(Math.max(0, Math.round(Number(d.score) || 0)), d.meta || {}); }
      if (d.type === "close") onClose();
    };
    window.addEventListener("message", h);
    const bgm = EXT[id].bgm && window.rhBgm; if (bgm) try { window.rhBgm.push(EXT[id].bgm); } catch (e) {}
    const ov = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("message", h); if (bgm) try { window.rhBgm.pop(EXT[id].bgm); } catch (e) {} document.body.style.overflow = ov; };
  }, []);
  const q = EXT[id].url(g);
  return <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#2b1a12" }}>
    <iframe ref={ref} title={g.name} src={`/games/${EXT[id].file}.html?embed=1${q ? "&" + q : ""}&v=${GV}`} style={{ width: "100%", height: "100%", border: 0, display: "block" }} allow="autoplay; fullscreen" />
  </div>;
}
const DESC = {
  catch: "左右拖動籃子，接住掉下來的雞蛋糕，金色加倍、燒焦的扣命",
  memory: "翻開兩張相同的牌就配對成功，越快、失誤越少分數越高",
  breakout: "寵物當球，用板子接住它，把麵糊磚塊全部打掉；金磚會讓板子變長",
  oven: "選口味倒麵糊 → 變黃時翻面 → 熟了收進托盤，湊齊客人的訂單就出餐",
  runner: "點畫面跳躍（可二段跳），躲過紙箱和烤爐，沿路收集赤心幣",
  match: "交換相鄰的雞蛋糕連成 3 顆出爐；連 4 顆變烤槍、L 型變糖粉彈、連 5 顆叫出小暴龍。完成客人訂單就過關，一關一關往上挑戰",
  stack: "掉下來的雞蛋糕排滿一排就出爐裝盒；小心底下冒出的燒焦塊，小暴龍集滿氣可以吃掉 2 排",
  batter1: "第一人稱 3D！用麵糊水槍把燒焦怪黏回雞蛋糕，守住烤爐 90 秒",
  batter2: "100 秒內把雞蛋糕送給 14 位客人，被燒焦怪撞到會掉盒子",
  batter3: "四台烤爐輪流過熱，按住降溫救回 10 台，燒焦 3 台就失敗",
};
const CH_GAME = id => (/^batter/.test(id) ? "batter" : id);

// v1.19:改用寵物像素圖(型態、階段、口味都跟寵物頁一樣)。x,y 是中心,s 是大小
function drawPet(g, x, y, s, pet, t = 0) {
  const sz = s * 1.5, smooth = g.imageSmoothingEnabled; g.imageSmoothingEnabled = false;
  g.drawImage(spriteCanvas(pet && pet.type, (pet && pet.stage) || 1, (pet && pet.flavor) || "原味"), x - sz / 2, y - sz / 2, sz, sz);
  g.imageSmoothingEnabled = smooth;
}
function useCanvas(draw, deps) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current, g = cv.getContext("2d"), dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth, H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; g.scale(dpr, dpr);
    return draw(cv, g, W, H);
  }, deps);
  return ref;
}
const Canvas = ({ cref, h = 440 }) => <canvas ref={cref} style={{ width: "100%", height: h, display: "block", borderRadius: 16, background: "#fff8ee", touchAction: "none" }} />;
const Hud = ({ items }) => <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{items.map((x, i) => <span key={i}>{x}</span>)}</div>;

// ── 1 接雞蛋糕 ──
function Catch({ pet, lives0, onEnd, pr }) {
  const [hud, setHud] = useState({ score: 0, lives: lives0, time: 60 });
  const ref = useCanvas((cv, g, W, H) => {
    let bx = W / 2, items = [], spawn = 0, score = 0, lives = lives0, time = 60, last = performance.now(), raf, over = false;
    const move = e => { const r = cv.getBoundingClientRect(); bx = Math.max(35, Math.min(W - 35, (e.touches ? e.touches[0].clientX : e.clientX) - r.left)); };
    cv.addEventListener("pointermove", move); cv.addEventListener("pointerdown", move); cv.addEventListener("touchmove", move, { passive: true });
    const key = e => { if (pr.current) return; if (e.key === "ArrowLeft") bx = Math.max(35, bx - 30); if (e.key === "ArrowRight") bx = Math.min(W - 35, bx + 30); }; window.addEventListener("keydown", key);
    const loop = now => {
      if (pr.current) { last = now; raf = requestAnimationFrame(loop); return; }   // 暫停中
      const dt = Math.min(0.05, (now - last) / 1000); last = now; time -= dt; spawn -= dt;
      if (spawn <= 0) { spawn = Math.max(0.28, 0.75 - (60 - time) * 0.008); const r = Math.random(); items.push({ x: 20 + Math.random() * (W - 40), y: -20, v: 120 + (60 - time) * 3 + Math.random() * 60, k: r < 0.15 ? "burnt" : r < 0.25 ? "gold" : "cake", f: FL[Math.floor(Math.random() * 4)][1] }); }
      g.clearRect(0, 0, W, H); g.fillStyle = "#5b3a29"; g.fillRect(0, 0, W, 26); g.fillStyle = "#ff8c1a"; for (let i = 0; i < W; i += 30) g.fillRect(i + 4, 20, 22, 6);
      items.forEach(it => {
        it.y += it.v * dt;
        g.fillStyle = it.k === "burnt" ? "#2b221c" : it.k === "gold" ? "#f1c40f" : it.f; g.beginPath(); g.arc(it.x, it.y, 13, 0, 7); g.fill();
        if (it.k === "gold") { g.fillStyle = "#fff"; g.font = "12px sans-serif"; g.fillText("★", it.x - 5, it.y + 4); }
        if (it.y > H - 52 && it.y < H - 30 && Math.abs(it.x - bx) < 40) { it.done = true; if (it.k === "burnt") lives--; else score += it.k === "gold" ? 30 : 10; }
        if (it.y > H + 20) it.done = true;
      });
      items = items.filter(i => !i.done);
      g.fillStyle = "#b5651d"; g.fillRect(bx - 38, H - 40, 76, 22); g.fillStyle = "#8b4513"; g.fillRect(bx - 38, H - 44, 76, 6);
      drawPet(g, bx, H - 58, 22, pet);
      setHud({ score, lives, time: Math.max(0, Math.ceil(time)) });
      if ((lives <= 0 || time <= 0) && !over) { over = true; onEnd(score); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("keydown", key); };
  }, []);
  return <><Hud items={[`分數 ${hud.score}`, `❤️ ${hud.lives}`, `⏱ ${hud.time}`]} /><Canvas cref={ref} /></>;
}

// ── 2 翻翻樂 ──
function Memory({ onEnd, pr }) {
  const SYM = ["原味", "可可", "紅玉", "抹茶", "🥚", "🧈", "🍯", "🧁"];
  const [cards] = useState(() => [...SYM, ...SYM].map((s, i) => ({ s, i, r: Math.random() })).sort((a, b) => a.r - b.r));
  const [open, setOpen] = useState([]); const [done, setDone] = useState({}); const [miss, setMiss] = useState(0);
  const el = useRef(0); const [sec, setSec] = useState(0);   // 經過時間（暫停時不算）
  useEffect(() => { const t = setInterval(() => { if (!pr.current) { el.current += 250; setSec(Math.floor(el.current / 1000)); } }, 250); return () => clearInterval(t); }, []);
  const tap = c => {
    if (pr.current || done[c.s] || open.includes(c.i) || open.length === 2) return;
    const nx = [...open, c.i]; setOpen(nx);
    if (nx.length === 2) {
      const [a, b] = nx.map(i => cards.find(x => x.i === i));
      setTimeout(() => {
        if (a.s === b.s) { const d = { ...done, [a.s]: 1 }; setDone(d); if (Object.keys(d).length === 8) onEnd(Math.max(50, 1000 - Math.floor(el.current / 1000) * 8 - miss * 15)); }
        else setMiss(m => m + 1);
        setOpen([]);
      }, 650);
    }
  };
  const col = s => (FL.find(f => f[0] === s) || [])[1];
  return (
    <>
      <Hud items={[`配對 ${Object.keys(done).length}/8`, `失誤 ${miss}`, `⏱ ${sec}s`]} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
        {cards.map(c => { const up = done[c.s] || open.includes(c.i); return (
          <button key={c.i} onClick={() => tap(c)} style={{ aspectRatio: "1", border: "none", borderRadius: 14, cursor: "pointer", fontFamily: "inherit", fontSize: !up ? 24 : col(c.s) ? 14 : 28, fontWeight: 600,
            background: up ? (col(c.s) || "#fff3e0") : "#c0392b", color: up ? (c.s === "可可" ? "#fff" : "#2b221c") : "#fff", opacity: done[c.s] ? .55 : 1, transition: "all .2s" }}>{up ? c.s : "?"}</button>); })}
      </div>
    </>
  );
}

// ── 3 打磚塊 ──
function Breakout({ pet, lives0, onEnd, pr }) {
  const [hud, setHud] = useState({ score: 0, lives: lives0, lv: 1 });
  const ref = useCanvas((cv, g, W, H) => {
    let px = W / 2, pw = 80, wideT = 0, score = 0, lives = lives0, lv = 1, raf, last = performance.now(), over = false, bricks = [], ball = null;
    const reset = () => { ball = { x: px, y: H - 60, vx: 0, vy: 0, stuck: true }; };
    const build = () => { bricks = []; const cols = 7, bw = (W - 16) / cols; for (let r = 0; r < 4 + Math.min(3, lv); r++) for (let c = 0; c < cols; c++) bricks.push({ x: 8 + c * bw, y: 40 + r * 20, w: bw - 4, h: 16, col: FL[r % 4][1], gold: Math.random() < 0.08 }); };
    build(); reset();
    const move = e => { const r = cv.getBoundingClientRect(); px = Math.max(pw / 2, Math.min(W - pw / 2, (e.touches ? e.touches[0].clientX : e.clientX) - r.left)); };
    const launch = () => { if (ball.stuck) { ball.stuck = false; const sp = 260 + lv * 30; ball.vx = (Math.random() - 0.5) * sp * 0.8; ball.vy = -sp; } };
    cv.addEventListener("pointermove", move); cv.addEventListener("pointerdown", e => { move(e); launch(); });
    const key = e => { if (pr.current) return; if (e.key === "ArrowLeft") px = Math.max(pw / 2, px - 30); if (e.key === "ArrowRight") px = Math.min(W - pw / 2, px + 30); if (e.key === " ") launch(); }; window.addEventListener("keydown", key);
    const loop = now => {
      if (pr.current) { last = now; raf = requestAnimationFrame(loop); return; }   // 暫停中
      const dt = Math.min(0.03, (now - last) / 1000); last = now;
      if (wideT > 0) { wideT -= dt; pw = 120; } else pw = 80;
      if (ball.stuck) { ball.x = px; ball.y = H - 52; }
      else {
        ball.x += ball.vx * dt; ball.y += ball.vy * dt;
        if (ball.x < 10 || ball.x > W - 10) { ball.vx *= -1; ball.x = Math.max(10, Math.min(W - 10, ball.x)); }
        if (ball.y < 10) { ball.vy = Math.abs(ball.vy); }
        if (ball.y > H - 44 && ball.y < H - 30 && Math.abs(ball.x - px) < pw / 2 + 8 && ball.vy > 0) { ball.vy = -Math.abs(ball.vy); ball.vx = (ball.x - px) / (pw / 2) * 260; }
        for (const b of bricks) if (!b.hit && ball.x > b.x - 8 && ball.x < b.x + b.w + 8 && ball.y > b.y - 8 && ball.y < b.y + b.h + 8) { b.hit = true; ball.vy *= -1; score += b.gold ? 30 : 10; if (b.gold) wideT = 8; break; }
        if (ball.y > H + 10) { lives--; if (lives <= 0) { if (!over) { over = true; onEnd(score); } return; } reset(); }
        if (bricks.every(b => b.hit)) { score += 50; lv++; build(); reset(); }
      }
      g.clearRect(0, 0, W, H);
      bricks.forEach(b => { if (b.hit) return; g.fillStyle = b.gold ? "#f1c40f" : b.col; g.fillRect(b.x, b.y, b.w, b.h); });
      g.fillStyle = "#2b221c"; g.fillRect(px - pw / 2, H - 38, pw, 10);
      drawPet(g, ball.x, ball.y, 18, pet);
      if (ball.stuck) { g.fillStyle = "#8a7e72"; g.font = "13px sans-serif"; g.textAlign = "center"; g.fillText("點一下發射", W / 2, H / 2); g.textAlign = "left"; }
      setHud({ score, lives, lv });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("keydown", key); };
  }, []);
  return <><Hud items={[`分數 ${hud.score}`, `❤️ ${hud.lives}`, `第 ${hud.lv} 關`]} /><Canvas cref={ref} /></>;
}

// ── 4 烤爐大挑戰 ──
function Oven({ lives0, onEnd, pr, paused }) {
  const mkOrder = n => { const o = {}; const k = 1 + Math.min(3, Math.floor(n / 3)); for (let i = 0; i < k; i++) { const f = FL[Math.floor(Math.random() * 4)][0]; o[f] = (o[f] || 0) + 1; } return o; };
  const [slots, setSlots] = useState(Array(6).fill(null));
  const [pick, setPick] = useState("原味");
  const [tray, setTray] = useState([]);
  const [orders, setOrders] = useState(() => [mkOrder(0), mkOrder(1)]);
  const [st, setSt] = useState({ score: 0, served: 0, burnt: 0, time: 75 });
  const [now, setNow] = useState(Date.now());
  const ended = useRef(false);
  useEffect(() => { const t = setInterval(() => { if (pr.current) return; setNow(Date.now()); setSt(s => ({ ...s, time: s.time - 0.25 })); }, 250); return () => clearInterval(t); }, []);
  const pausedAt = useRef(0);
  useEffect(() => {   // 暫停期間烤模的時間也停住：繼續時把每格的開始時間往後推
    if (paused) { pausedAt.current = Date.now(); return; }
    if (!pausedAt.current) return;
    const d = Date.now() - pausedAt.current; pausedAt.current = 0;
    setSlots(ss => ss.map(sl => (sl ? { ...sl, t: sl.t + d } : sl))); setNow(Date.now());
  }, [paused]);
  useEffect(() => { if (st.time <= 0 && !ended.current) { ended.current = true; onEnd(Math.max(0, st.score)); } }, [st.time]);
  const stage = sl => { if (!sl) return null; const a = (now - sl.t) / 1000; if (!sl.flipped) return a < 2.5 ? "raw" : a < 5.5 ? "flip" : "burnt"; return a < 2 ? "cook" : a < 6 ? "done" : "burnt"; };
  const tap = i => {
    if (pr.current) return;
    const sl = slots[i], s = stage(sl), nx = [...slots];
    if (!sl) nx[i] = { f: pick, t: Date.now(), flipped: false };
    else if (s === "flip") nx[i] = { ...sl, flipped: true, t: Date.now() };
    else if (s === "done") { nx[i] = null; const tr = [...tray, sl.f]; serve(tr); }
    else if (s === "burnt") { nx[i] = null; setSt(x => ({ ...x, score: x.score - 20, burnt: x.burnt + 1 })); }
    setSlots(nx);
  };
  const serve = tr => {
    const o = orders[0], need = { ...o }; const left = [];
    tr.forEach(f => { if (need[f] > 0) need[f]--; else left.push(f); });
    if (Object.values(need).every(v => v === 0)) { setOrders(os => [os[1], mkOrder(st.served + 2)]); setTray(left); setSt(x => ({ ...x, score: x.score + 100 + Object.values(o).reduce((a, b) => a + b, 0) * 20, served: x.served + 1 })); }
    else setTray(tr.slice(-8));
  };
  const LOOK = { raw: ["#f5deb3", "倒好了"], flip: ["#f1c40f", "翻面！"], cook: ["#e0b060", "烤…"], done: ["#c0392b", "收起來"], burnt: ["#2b221c", "焦了"] };
  const orderText = o => Object.keys(o).map(k => `${k}×${o[k]}`).join("、");
  return (
    <>
      <Hud items={[`分數 ${st.score}`, `出餐 ${st.served}`, `⏱ ${Math.max(0, Math.ceil(st.time))}`]} />
      <div style={{ background: "#fff8ee", borderRadius: 16, padding: 12 }}>
        <div style={{ fontSize: 13, marginBottom: 8 }}>🧾 目前訂單：<b>{orderText(orders[0])}</b><span style={{ color: "#8a7e72" }}>　下一單：{orderText(orders[1])}</span></div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {FL.map(([f, c]) => <button key={f} onClick={() => setPick(f)} style={{ flex: 1, border: `2px solid ${pick === f ? "#2b221c" : "transparent"}`, borderRadius: 10, padding: "6px 0", background: c, color: f === "可可" ? "#fff" : "#2b221c", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{f}</button>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {slots.map((sl, i) => { const s = stage(sl), L = s && LOOK[s]; return (
            <button key={i} onClick={() => tap(i)} style={{ height: 76, borderRadius: 14, border: "3px solid #5b3a29", background: L ? L[0] : "#3a2a2a", color: s === "burnt" || s === "done" ? "#fff" : "#2b221c", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", animation: s === "flip" ? "rhShimmer 1s infinite" : "none" }}>
              {sl ? <>{sl.f}<br />{L[1]}</> : <span style={{ color: "#a08070" }}>空烤模<br />點這裡倒 {pick}</span>}</button>); })}
        </div>
        <div style={{ fontSize: 12.5, marginTop: 10 }}>📦 托盤：{tray.length ? tray.join("、") : "（空）"}</div>
      </div>
    </>
  );
}

// ── 5 寵物跑酷 ──
function Runner({ pet, lives0, onEnd, pr }) {
  const [hud, setHud] = useState({ score: 0, lives: lives0 });
  const ref = useCanvas((cv, g, W, H) => {
    const GY = H - 60; let y = GY, vy = 0, jumps = 0, obs = [], coins = [], dist = 0, cnt = 0, sp = 220, spawn = 1, cspawn = 0.6, lives = lives0, inv = 0, raf, last = performance.now(), over = false, t = 0;
    const jump = () => { if (jumps < 2) { vy = -520; jumps++; } };
    cv.addEventListener("pointerdown", jump); const key = e => { if (pr.current) return; if (e.key === " " || e.key === "ArrowUp") jump(); }; window.addEventListener("keydown", key);
    const loop = now => {
      if (pr.current) { last = now; raf = requestAnimationFrame(loop); return; }   // 暫停中
      const dt = Math.min(0.03, (now - last) / 1000); last = now; t += dt; sp += dt * 6; dist += sp * dt; spawn -= dt; cspawn -= dt; inv -= dt;
      vy += 1400 * dt; y += vy * dt; if (y >= GY) { y = GY; vy = 0; jumps = 0; }
      if (spawn <= 0) { spawn = 0.9 + Math.random() * 1.1 - Math.min(0.5, sp / 1500); obs.push({ x: W + 20, w: 22 + Math.random() * 18, h: 24 + Math.random() * 26, oven: Math.random() < 0.3 }); }
      if (cspawn <= 0) { cspawn = 0.5 + Math.random() * 0.8; coins.push({ x: W + 20, y: GY - 30 - Math.random() * 110 }); }
      obs.forEach(o => { o.x -= sp * dt; if (inv <= 0 && 60 + 14 > o.x && 60 - 14 < o.x + o.w && y > GY - o.h - 4) { lives--; inv = 1.2; } });
      coins.forEach(c => { c.x -= sp * dt; if (!c.got && Math.abs(c.x - 60) < 22 && Math.abs(c.y - (y - 14)) < 24) { c.got = true; cnt++; } });
      obs = obs.filter(o => o.x > -60); coins = coins.filter(c => c.x > -20 && !c.got);
      const score = Math.floor(dist / 10) + cnt * 10;
      g.clearRect(0, 0, W, H);
      g.fillStyle = "#e8dcc8"; for (let i = 0; i < 6; i++) { const bx = ((i * 90 - dist * 0.3) % (W + 90) + W + 90) % (W + 90) - 60; g.fillRect(bx, GY - 120, 50, 120); }
      g.fillStyle = "#c9b79c"; g.fillRect(0, GY + 14, W, H - GY);
      obs.forEach(o => { g.fillStyle = o.oven ? "#5b3a29" : "#b5651d"; g.fillRect(o.x, GY + 14 - o.h, o.w, o.h); if (o.oven) { g.fillStyle = "#ff8c1a"; g.fillRect(o.x + 4, GY + 18 - o.h, o.w - 8, 5); } });
      coins.forEach(c => { g.fillStyle = "#f1c40f"; g.beginPath(); g.arc(c.x, c.y, 8, 0, 7); g.fill(); });
      if (inv <= 0 || Math.floor(t * 10) % 2) drawPet(g, 60, y, 28, pet);
      setHud({ score, lives });
      if (lives <= 0 && !over) { over = true; onEnd(score); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("keydown", key); };
  }, []);
  return <><Hud items={[`分數 ${hud.score}`, `❤️ ${hud.lives}`, "點畫面跳躍"]} /><Canvas cref={ref} h={300} /></>;
}

const GAMES = { catch: Catch, memory: Memory, breakout: Breakout, oven: Oven, runner: Runner };
const BASE_LIVES = { catch: 3, breakout: 3, runner: 1, oven: 0, memory: 0 };

// v1.38 一次性挑戰：完成打勾，沒完成顯示獎勵
function Chips({ list, C }) {
  if (!list.length) return null;
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
    {list.map(c => <span key={c.id} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 10, background: c.done ? "#e8f6ec" : "#fff3e0", color: c.done ? "#27ae60" : C.text || "#5a4636", textDecoration: c.done ? "line-through" : "none" }}>
      {c.done ? "✓ " : "🏆 "}{c.name.replace(/^[^・]+・/, "")}{!c.done ? `${c.coins + (c.badgeCoins || 0) ? " +" + (c.coins + (c.badgeCoins || 0)) : ""}${c.tix ? " 🎰" + c.tix : ""}${c.badge ? " " + c.badge : ""}` : ""}
    </span>)}
  </div>;
}
// v1.38 麵糊大作戰：三個任務放同一張卡
function BatterCard({ games, ch, start, C, s }) {
  const g0 = games[0], ok = g0.unlocked;
  return <div style={{ ...s.card, opacity: ok ? 1 : .6, background: ok ? "linear-gradient(135deg,#fff8ee,#ffe9d6)" : undefined }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 30 }}>{ok ? "⚔️" : "🔒"}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600 }}>麵糊大作戰 <span style={{ fontSize: 11, color: C.accent }}>3D</span></div>
        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{ok ? "第一人稱射擊！用麵糊水槍把燒焦怪黏回雞蛋糕，小暴龍會幫忙" : `寵物長到第 ${g0.stage} 階段解鎖`}</div>
      </div>
    </div>
    {ok && games.map(g => <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, paddingTop: 10, borderTop: "1px dashed #ead9c4" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{g.name.replace("麵糊大作戰・", "")}</div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{DESC[g.id]}</div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>個人最佳 {g.best}{g.top.length ? "・本週第一：" + g.top[0].name + " " + g.top[0].score : ""}</div>
        <Chips list={ch.filter(c => c.game === g.id)} C={C} />
      </div>
      <button onClick={() => start(g.id)} style={{ ...s.btn("primary"), width: "auto", padding: "8px 14px", fontSize: 13 }}>開始</button>
    </div>)}
    {ok && <Chips list={ch.filter(c => c.game === "batter*")} C={C} />}
  </div>;
}

export default function MiniGames({ user, apiGet, apiPost, C, s, onChanged }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [play, setPlay] = useState(null);    // {id, extra}
  const [result, setResult] = useState(null);
  const [paused, setPaused] = useState(false);   // 暫停（店裡有客人時用）
  const pr = useRef(false); pr.current = paused;
  useEffect(() => {   // 切到別的 App 或關螢幕：自動暫停
    if (!play || EXT[play.id]) return;
    const h = e => { if (document.hidden || e.type === "blur") setPaused(true); };
    document.addEventListener("visibilitychange", h); window.addEventListener("blur", h);
    return () => { document.removeEventListener("visibilitychange", h); window.removeEventListener("blur", h); };
  }, [play]);
  const load = async () => { const r = await apiGet({ action: "gmGames", empId: user.id }, 1); if (r && r.success) { setD(r.data); setErr(""); } else setErr((r && r.error) || "小遊戲尚未開通"); };
  useEffect(() => { load(); }, []);
  const start = async id => {
    const h = +new Date().toLocaleString("en-GB", { timeZone: "Asia/Taipei", hour: "2-digit", hour12: false });
    if (h >= 10 && h < 21 && !window.confirm("現在可能是上班時間，確定要玩嗎？工作優先喔！")) return;
    const r = await apiPost({ action: "gmGameStart", empId: user.id, game: id }, 0);
    if (r && r.success) { setResult(null); setPaused(false); pend.current = null; pend.closed = false; setPlay({ id, extra: r.data.extra }); } else alert((r && r.error) || "無法開始");
  };
  const pend = useRef(null);
  const endExt = async (score, meta) => {   // 網頁遊戲結束：先送分數，等玩家按「回樂園」再顯示結果
    const id = play.id;
    pend.current = { id, score, meta, wait: true };
    const r = await apiPost({ action: "gmGameScore", empId: user.id, game: id, score, meta }, 0);
    pend.current = { id, score, meta, ...(r && r.success ? r.data : { error: (r && r.error) || "分數上傳失敗" }) };
    if (pend.closed) showPend();
  };
  const showPend = () => { if (pend.current && !pend.current.wait) { setResult(pend.current); pend.current = null; load(); onChanged && onChanged(); } };
  const closeExt = () => { setPlay(null); pend.closed = true; if (pend.current) showPend(); else load(); };
  const end = async score => {
    const id = play.id;
    const r = await apiPost({ action: "gmGameScore", empId: user.id, game: id, score }, 0);
    setResult({ id, score, ...(r && r.success ? r.data : { error: (r && r.error) || "分數上傳失敗" }) });
    setPlay(null); load(); onChanged && onChanged();
  };
  if (err) return <div style={{ ...s.card, textAlign: "center", color: C.muted }}>{err}</div>;
  if (!d) return <div className="rh-skel" style={{ height: 160, borderRadius: 18 }} />;
  if (!d.pet) return <div style={{ ...s.card, textAlign: "center", color: C.muted, fontSize: 13.5, lineHeight: 1.7 }}>先到「寵物」免費領養一顆寵物蛋，就能解鎖小遊戲！<br />寵物越長越大，會依序解鎖更多遊戲。</div>;
  if (play && EXT[play.id]) return <ExtGame id={play.id} g={d.games.find(x => x.id === play.id)} onEnd={endExt} onClose={closeExt} />;
  if (play) {
    const G = GAMES[play.id], g = d.games.find(x => x.id === play.id);
    return <div style={s.card}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><b>{ICON[play.id]} {g.name}</b>{play.extra ? <span style={{ fontSize: 12, color: C.green }}>寵物零食 +1 命</span> : null}</div>
      <div style={{ position: "relative" }}>
        <G pet={d.pet} lives0={BASE_LIVES[play.id] + play.extra} onEnd={end} pr={pr} paused={paused} />
        {paused && <div style={{ position: "absolute", inset: 0, zIndex: 5, borderRadius: 16, background: "rgba(43,34,28,.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: C.card, borderRadius: 18, padding: "18px 16px", width: "100%", maxWidth: 280, textAlign: "center" }}>
            <div style={{ fontSize: 34 }}>☕</div>
            <div style={{ fontSize: 17, fontWeight: 700, margin: "4px 0 2px" }}>暫停中</div>
            <div style={{ fontSize: 12.5, color: C.muted }}>去招呼客人吧，回來再繼續！</div>
            <button onClick={() => setPaused(false)} style={{ ...s.btn("primary"), marginTop: 12 }}>▶ 繼續</button>
            <button onClick={() => { setPaused(false); setPlay(null); }} style={{ ...s.btn("ghost"), marginTop: 8, padding: 8, fontSize: 12.5 }}>離開（不計分）</button>
          </div>
        </div>}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={() => setPaused(true)} disabled={paused} style={{ ...s.btn("primary"), padding: 8, fontSize: 12.5, opacity: paused ? .5 : 1 }}>⏸ 暫停</button>
        <button onClick={() => { setPaused(false); setPlay(null); }} style={{ ...s.btn("ghost"), padding: 8, fontSize: 12.5 }}>離開（不計分）</button>
      </div>
    </div>;
  }
  return (
    <div>
      {result && <div style={{ ...s.card, textAlign: "center", background: result.newRecord ? "#fff6e8" : C.card }}>
        <div style={{ fontSize: 13, color: C.muted }}>{d.games.find(x => x.id === result.id).name}</div>
        <div style={{ fontSize: 34, fontWeight: 600 }}>{result.id === "match" ? (result.meta && result.meta.win ? `第 ${result.meta.level} 關過關` : "這關沒過，再試一次！") : result.score}</div>
        {result.id === "match" && result.meta && result.meta.win ? <div style={{ fontSize: 12.5, color: C.muted }}>{"⭐".repeat(result.meta.stars || 0)}　{result.meta.points} 分</div> : null}
        {result.challenges && result.challenges.length ? <div style={{ margin: "8px 0", padding: "8px 10px", borderRadius: 12, background: "#fff6e8", fontSize: 13, lineHeight: 1.7 }}>
          {result.challenges.map(c => <div key={c.id}>🏆 挑戰達成：<b>{c.name}</b>{c.coins ? <> <Coin n={c.coins} plus size={12} /></> : null}{c.tix ? `　🎰 扭蛋券 ×${c.tix}` : ""}{c.badge ? `　${c.badge}` : ""}</div>)}
        </div> : null}
        {result.error ? <div style={{ fontSize: 12.5, color: C.red }}>{result.error}</div> :
          <div style={{ fontSize: 13, color: result.newRecord ? C.accent : C.muted }}>{result.newRecord ? <>🎉 新紀錄！{result.reward ? <Coin n={result.reward} plus size={12} /> : "（今天的赤心幣已達上限）"}</> : `個人最佳 ${result.best}`}</div>}
        <button onClick={() => start(result.id)} style={{ ...s.btn("primary"), marginTop: 10 }}>{result.id === "match" && result.meta && result.meta.win ? `挑戰第 ${result.meta.level + 1} 關` : "再玩一次"}</button>
      </div>}
      <div style={{ ...s.card, padding: "10px 14px", fontSize: 12.5, color: C.muted }}>
        寵物「{d.pet.name}」第 {d.pet.stage} 階段・今天小遊戲已得 {d.todayGot}/{d.cap} 枚{d.extraLives ? `・寵物零食加命 ${d.extraLives} 次` : ""}<br />破個人紀錄才有赤心幣（每日合計上限）；🏆 挑戰每項可拿一次；每週各遊戲第一名{d.weekBonus ? <> 再加 <Coin n={d.weekBonus} plus size={11} /></> : null}<br />寵物零食（小店購買）可在下一局多一條命（接雞蛋糕、打磚塊、跑酷）
      </div>
      {d.games.filter(g => g.id !== "batter2" && g.id !== "batter3").map(g => g.id === "batter1" ? <BatterCard key="batter" games={d.games.filter(x => /^batter/.test(x.id))} ch={d.challenges || []} start={start} C={C} s={s} /> : (
        <div key={g.id} style={{ ...s.card, opacity: g.unlocked ? 1 : .6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 30 }}>{g.unlocked ? ICON[g.id] : "🔒"}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600 }}>{g.name}</div>
              <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{g.unlocked ? DESC[g.id] : `寵物長到第 ${g.stage} 階段解鎖`}</div>
            </div>
            {g.unlocked && <button onClick={() => start(g.id)} style={{ ...s.btn("primary"), width: "auto", padding: "8px 14px", fontSize: 13 }}>開始</button>}
          </div>
          {g.unlocked && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8 }}>
            {g.id === "match" ? `最高第 ${g.best} 關` : `個人最佳 ${g.best}`}・破紀錄 <Coin n={g.reward} plus size={11} />{g.top.length ? "・本週排行：" + g.top.map((x, i) => `${i + 1}.${x.name} ${g.id === "match" ? "第" + x.score + "關" : x.score}`).join("　") : ""}
          </div>}
          <Chips list={(d.challenges || []).filter(c => c.game === g.id)} C={C} />
        </div>))}
    </div>
  );
}
