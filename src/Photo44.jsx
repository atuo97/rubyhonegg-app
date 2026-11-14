// ─────────────────────────────────────────────
// v1.44 v3 遊戲室拍貼機＋我的相簿
// 拍貼機：真人自拍（可讓寵物、坐騎入鏡）或虛擬人像（宇宙辦公室的角色＋寵物＋坐騎＋背景＋姿勢）
// → 單張／四格 → App 風格相框、貼圖、寫字 → 存進相簿（存一張 1 枚赤心幣，重拍免費）
// 我的相簿：每位隊員在「我的 → 我的相簿」，只有自己看得到；可下載、刪除
// ─────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const OW = 480, OH = 640;   // 成品尺寸（直式）
// App 風格相框：紅玉滿經典、宇宙辦公室、赤心幣、像素樂園、聖誕、生日
const FRAMES = [
  { k: "red", name: "紅玉滿經典", bg: "#c0392b", fg: "#fff3e0" },
  { k: "space", name: "宇宙辦公室", bg: "#1d1b2e", fg: "#ffe066" },
  { k: "coin", name: "赤心幣", bg: "#f6c343", fg: "#7a2a1a" },
  { k: "pixel", name: "像素樂園", bg: "#ffd1e3", fg: "#7a2a4a" },
  { k: "xmas", name: "聖誕", bg: "#1e8449", fg: "#fff" },
  { k: "bday", name: "生日", bg: "#f39c12", fg: "#fff" },
];
const STK = ["❤️", "⭐", "✨", "😎", "🥚", "🧇", "🎉", "👑", "🐣", "🦖", "💪", "🌸"];
const SPOTS = [[0.18, 0.2], [0.82, 0.22], [0.2, 0.78], [0.8, 0.76], [0.5, 0.14], [0.5, 0.86], [0.12, 0.5], [0.88, 0.5]];
const POSES = [["wave", "揮手"], ["like", "比讚"], ["cheer", "歡呼"], ["ride", "騎坐騎"]];
const BGS = [["seat", "我的座位"], ["game", "遊戲室"], ["plain", "粉紅攝影棚"]];
const PAD = 26, TOP = 64, BOT = 100;
// 品牌 Logo：深色相框用白字、淺色相框用墨色
const LOGO = {};
["white", "ink"].forEach(k => { if (typeof Image === "undefined") return; const im = new Image(); im.src = k === "white" ? "/logo_white_sm.png" : "/logo_ink.png"; LOGO[k] = im; });
const LIGHT = { coin: 1, pixel: 1 };

function drawCover(g, img, x, y, w, h, mirror) {
  const iw = img.videoWidth || img.naturalWidth || img.width, ih = img.videoHeight || img.naturalHeight || img.height;
  const sc = Math.max(w / iw, h / ih), sw = w / sc, sh = h / sc, sx = (iw - sw) / 2, sy = (ih - sh) / 2;
  g.save(); if (mirror) { g.translate(x + w, y); g.scale(-1, 1); g.drawImage(img, sx, sy, sw, sh, 0, 0, w, h); } else g.drawImage(img, sx, sy, sw, sh, x, y, w, h); g.restore();
}
const ymd = () => { const d = new Date(); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`; };
const rnd = seed => () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
// 雞蛋糕（小圓餅：金黃色、深一點的邊、上面一點紅）
function eggCake(g, x, y, r) {
  g.fillStyle = "#c98a2b"; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.fillStyle = "#f2b84b"; g.beginPath(); g.arc(x - r * 0.08, y - r * 0.1, r * 0.82, 0, 7); g.fill();
  g.fillStyle = "#ffe08a"; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.35, r * 0.25, 0, 7); g.fill();
}
function coin(g, x, y, r) {
  g.fillStyle = "#b8860b"; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.fillStyle = "#ffd75e"; g.beginPath(); g.arc(x, y, r * 0.84, 0, 7); g.fill();
  g.fillStyle = "#d63031"; g.font = `${Math.round(r * 1.1)}px sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("❤", x, y + 1);
}
function drawFrameBg(g, f) {
  g.fillStyle = f.bg; g.fillRect(0, 0, OW, OH);
  const R = rnd(7);
  const around = (step, fn) => { for (let x = step / 2; x < OW; x += step) { fn(x, 14); fn(x, OH - 14); } for (let y = step / 2 + step; y < OH - step; y += step) { fn(13, y); fn(OW - 13, y); } };
  if (f.k === "red") around(30, (x, y) => eggCake(g, x, y, 10));
  if (f.k === "coin") around(32, (x, y) => coin(g, x, y, 11));
  if (f.k === "space") {
    const gr = g.createLinearGradient(0, 0, 0, OH); gr.addColorStop(0, "#2b2350"); gr.addColorStop(1, "#0e0d1c"); g.fillStyle = gr; g.fillRect(0, 0, OW, OH);
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,${200 + R() * 55},${0.4 + R() * 0.6})`; const z = R() < 0.15 ? 3 : 1.6; g.fillRect(R() * OW, R() * OH, z, z); }
    [[60, 40, 22, "#e67e22"], [OW - 50, OH - 60, 30, "#9b59b6"], [OW - 70, 34, 12, "#3498db"]].forEach(([x, y, r, c]) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); });
    g.strokeStyle = "rgba(255,224,102,.7)"; g.lineWidth = 2; g.beginPath(); g.ellipse(OW - 50, OH - 60, 46, 10, -0.3, 0, 7); g.stroke();
  }
  if (f.k === "pixel") {   // App 宇宙辦公室的方塊風
    const cols = ["#ff6fa8", "#f1c40f", "#2ecc71", "#3498db", "#e74c3c", "#9b59b6"];
    around(22, (x, y) => { g.fillStyle = cols[Math.floor(R() * cols.length)]; g.fillRect(x - 8, y - 8, 16, 16); g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(x - 8, y - 8, 16, 5); });
  }
  if (f.k === "xmas") { g.font = "22px sans-serif"; around(40, (x, y) => g.fillText(R() < 0.5 ? "❄️" : "🎄", x - 11, y + 8)); }
  if (f.k === "bday") { g.font = "22px sans-serif"; around(40, (x, y) => g.fillText(["🎈", "🎉", "🎂"][Math.floor(R() * 3)], x - 11, y + 8)); }
}
function drawFrameText(g, f, title) {
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillStyle = f.fg;
  const lg = LOGO[LIGHT[f.k] ? "ink" : "white"];
  if (lg && lg.complete && lg.naturalWidth) { const h = TOP - 22, w = h * lg.naturalWidth / lg.naturalHeight; g.drawImage(lg, (OW - w) / 2, 10, w, h); }
  else { g.font = "bold 17px sans-serif"; g.fillText("紅玉滿赤心雞蛋糕 Hong Yu Man", OW / 2, TOP / 2 + 4); }
  g.font = "bold 30px sans-serif"; g.fillText(title || (f.k === "red" ? "願食雞蛋糕 常保赤子心" : "紅玉滿遊戲室"), OW / 2, OH - BOT / 2 - 10);
  g.font = "14px sans-serif"; g.fillText(`${f.k === "space" ? "🚀 紅玉滿宇宙辦公室" : f.k === "coin" ? "❤ 赤心幣紀念照" : "紅玉滿夥伴 App"} · ${ymd()}`, OW / 2, OH - BOT / 2 + 24);
}

export default function PhotoBooth44({ apiPost, s, onClose, onSaved, engine, me }) {
  const vid = useRef(null), stream = useRef(null), out = useRef(null), fileIn = useRef(null);
  const has = engine && engine.has ? engine.has(me.id) : { pet: false, mount: false };
  const [step, setStep] = useState("pick");          // pick → shoot → edit
  const [mode, setMode] = useState("real");          // real 真人、avatar 虛擬人像
  const [layout, setLayout] = useState(1);           // 1 單張、4 四格
  const [withPet, setWithPet] = useState(has.pet), [withMount, setWithMount] = useState(false);
  const [bg, setBg] = useState("seat"), [pose, setPose] = useState("wave");
  const [shots, setShots] = useState([]);
  const [cam, setCam] = useState(null);
  const [count, setCount] = useState(0);
  const [frame, setFrame] = useState(FRAMES[0]), [stk, setStk] = useState([]), [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState("");
  const pals = useRef({});   // 真人照旁邊的寵物、坐騎小圖

  const stop = () => { if (stream.current) stream.current.getTracks().forEach(t => t.stop()); stream.current = null; };
  useEffect(() => stop, []);
  const cell = () => (layout === 4 ? [(OW - PAD * 2 - 10) / 2, (OH - TOP - BOT - 10) / 2] : [OW - PAD * 2, OH - TOP - BOT]);

  const prepPals = () => {
    pals.current = {};
    if (!engine) return;
    try {
      if (withPet && has.pet) pals.current.pet = engine.sticker({ id: me.id, kind: "pet" });
      if (withMount && has.mount) pals.current.mount = engine.sticker({ id: me.id, kind: "mount", name: me.name });
    } catch (e) { pals.current = {}; }
  };
  const startCam = async () => {
    prepPals(); setStep("shoot"); setShots([]); setMsg("");
    try {
      const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 1280 } }, audio: false });
      stream.current = st; setCam(true);
      setTimeout(() => { if (vid.current) { vid.current.srcObject = st; vid.current.play().catch(() => {}); } }, 50);
    } catch (e) { setCam(false); }
  };
  const grabFrame = (src, mirror) => {
    const [w, h] = cell(), c = document.createElement("canvas"); c.width = Math.round(w * 2); c.height = Math.round(h * 2);
    drawCover(c.getContext("2d"), src, 0, 0, c.width, c.height, mirror); return c;
  };
  const shoot = async () => {
    const got = [];
    for (let i = 0; i < layout; i++) {
      for (let n = 3; n >= 1; n--) { setCount(n); await new Promise(r => setTimeout(r, 700)); }
      setCount(0); got.push(grabFrame(vid.current, true)); setShots([...got]);
      await new Promise(r => setTimeout(r, 350));
    }
    stop(); setStep("edit");
  };
  const fromFile = e => {
    prepPals();
    const fs = [...(e.target.files || [])].slice(0, layout); if (!fs.length) return;
    Promise.all(fs.map(f => new Promise(res => { const im = new Image(); im.onload = () => res(grabFrame(im)); im.src = URL.createObjectURL(f); })))
      .then(cs => { while (cs.length < layout) cs.push(cs[cs.length - 1]); setShots(cs); setStep("edit"); });
    e.target.value = "";
  };
  // 虛擬人像：用宇宙辦公室的角色拍；四格就是四個不同姿勢
  const shootAvatar = async () => {
    if (!engine) { setMsg("請從宇宙辦公室的拍貼機進來"); return; }
    pals.current = {}; setBusy(true); setMsg("拍照中…");
    await new Promise(r => setTimeout(r, 50));
    try {
      const [w, h] = cell(), list = layout === 4 ? POSES.filter(p => p[0] !== "ride" || has.mount).map(p => p[0]) : [pose];
      while (list.length < layout) list.push(list[list.length % list.length]);
      const cs = list.slice(0, layout).map(ps => engine.portrait({ id: me.id, name: me.name, pet: withPet && has.pet, mount: (withMount || ps === "ride") && has.mount, bg, pose: ps, w: Math.round(w * 2), h: Math.round(h * 2) }));
      setShots(cs); setStep("edit"); setMsg("");
    } catch (e) { setMsg("拍照失敗，再試一次"); }
    setBusy(false);
  };

  // 合成成品
  useEffect(() => {
    if (step !== "edit" || !out.current || !shots.length) return;
    const g = out.current.getContext("2d");
    drawFrameBg(g, frame);
    const [gw, gh] = cell(), aw = OW - PAD * 2, ah = OH - TOP - BOT;
    shots.forEach((c, i) => {
      const x = layout === 4 ? PAD + (i % 2) * (gw + 10) : PAD, y = layout === 4 ? TOP + Math.floor(i / 2) * (gh + 10) : TOP;
      g.fillStyle = "#fff"; g.fillRect(x - 4, y - 4, gw + 8, gh + 8);
      g.drawImage(c, x, y, gw, gh);
      const sz = Math.min(gw, gh) * 0.42;
      if (pals.current.pet) g.drawImage(pals.current.pet, x + gw - sz, y + gh - sz, sz, sz);
      if (pals.current.mount) g.drawImage(pals.current.mount, x, y + gh - sz, sz, sz);
    });
    g.textAlign = "center"; g.textBaseline = "middle"; g.font = "52px sans-serif";
    stk.forEach((e, i) => { const p = SPOTS[i % SPOTS.length]; g.fillText(e, PAD + aw * p[0], TOP + ah * p[1]); });
    drawFrameText(g, frame, title);
  }, [step, shots, frame, stk, title, layout]);

  const save = async () => {
    if (busy) return; setBusy(true); setMsg("存進相簿中…");
    const img = out.current.toDataURL("image/jpeg", 0.8);
    const t = document.createElement("canvas"); t.width = 120; t.height = 160; t.getContext("2d").drawImage(out.current, 0, 0, 120, 160);
    const r = await apiPost({ action: "v44Photo", img, thumb: t.toDataURL("image/jpeg", 0.6), title }, 0);
    setBusy(false);
    if (r && r.success) { setMsg(`✅ 已存進「我的 → 我的相簿」（赤心幣剩 ${r.data.balance}）`); onSaved && onSaved(); }
    else setMsg((r && r.error) || "存檔失敗，再試一次");
  };

  const chip = on => ({ padding: "6px 10px", borderRadius: 999, border: "none", fontSize: 13, cursor: "pointer", fontFamily: "inherit", background: on ? "#ff6fa8" : "#ffe1ee", color: on ? "#fff" : "#7a2a4a", fontWeight: 600 });
  const big = (bgc, fg) => ({ flex: 1, height: 48, borderRadius: 14, border: "none", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: bgc, color: fg || "#fff" });
  const lab = { fontSize: 12.5, color: "#7a5a6a", margin: "10px 0 4px" };
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1700, background: "rgba(20,10,20,.88)", display: "flex", alignItems: "center", justifyContent: "center", padding: "calc(10px + env(safe-area-inset-top)) 10px calc(10px + env(safe-area-inset-bottom))", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 380, background: "#fff7fb", borderRadius: 20, padding: 14, boxShadow: "0 10px 30px rgba(0,0,0,.4)", maxHeight: "100%", overflowY: "auto" }}>
        <div style={{ fontSize: 18, fontWeight: 800, textAlign: "center", color: "#c0392b", marginBottom: 8 }}>📸 紅玉滿拍貼機</div>
        <input ref={fileIn} type="file" accept="image/*" multiple={layout === 4} onChange={fromFile} style={{ display: "none" }} />

        {step === "pick" && <>
          <div style={{ fontSize: 13, color: "#7a5a6a", textAlign: "center", marginBottom: 10 }}>存進相簿才扣 1 枚赤心幣；重拍免費</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            {[["real", "真人自拍", "🤳"], ["avatar", "虛擬人像", "🧑‍🚀"]].map(([k, t, e]) => (
              <button key={k} onClick={() => setMode(k)} style={{ ...big(mode === k ? "#c0392b" : "#ffe1ee", mode === k ? "#fff" : "#7a2a4a"), height: 64 }}>{e}<div style={{ fontSize: 14 }}>{t}</div></button>
            ))}
          </div>
          <div style={lab}>張數</div>
          <div style={{ display: "flex", gap: 6 }}>{[[1, "📷 單張"], [4, "🎞️ 四格"]].map(([n, t]) => <button key={n} onClick={() => setLayout(n)} style={chip(layout === n)}>{t}</button>)}
            {mode === "avatar" && layout === 4 && <span style={{ fontSize: 11.5, color: "#9a7a8a", alignSelf: "center" }}>四格＝四個不同姿勢</span>}</div>
          <div style={lab}>誰要入鏡</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button disabled={!has.pet} onClick={() => setWithPet(v => !v)} style={{ ...chip(withPet && has.pet), opacity: has.pet ? 1 : .45 }}>🐣 我的寵物{has.pet ? "" : "（還沒有）"}</button>
            <button disabled={!has.mount} onClick={() => setWithMount(v => !v)} style={{ ...chip(withMount && has.mount), opacity: has.mount ? 1 : .45 }}>🛵 我的坐騎{has.mount ? "" : "（還沒騎）"}</button>
          </div>
          {mode === "avatar" && <>
            <div style={lab}>背景</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{BGS.map(([k, t]) => <button key={k} onClick={() => setBg(k)} style={chip(bg === k)}>{t}</button>)}</div>
            {layout === 1 && <><div style={lab}>姿勢</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{POSES.filter(p => p[0] !== "ride" || has.mount).map(([k, t]) => <button key={k} onClick={() => setPose(k)} style={chip(pose === k)}>{t}</button>)}</div></>}
            <div style={{ fontSize: 11.5, color: "#9a7a8a", marginTop: 6 }}>角色會穿著你現在的造型和配件；坐騎會帶著改裝店裝的配件</div>
          </>}
          {msg && <div style={{ fontSize: 13, marginTop: 8, color: "#c0392b" }}>{msg}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {mode === "real" ? <>
              <button onClick={startCam} style={big("#c0392b")}>開始拍</button>
              <button onClick={() => fileIn.current.click()} style={big("#fff", "#c0392b")}>從手機相簿選</button>
            </> : <button disabled={busy} onClick={shootAvatar} style={big(busy ? "#ccc" : "#c0392b")}>{busy ? "拍照中…" : "拍！"}</button>}
          </div>
        </>}

        {step === "shoot" && <>
          <div style={{ position: "relative", width: "100%", aspectRatio: "4/5", background: "#222", borderRadius: 12, overflow: "hidden" }}>
            {cam !== false && <video ref={vid} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />}
            {cam === false && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, padding: 20, textAlign: "center" }}>打不開鏡頭（可能沒有允許相機）。<br />可以改用「從手機相簿選」或「虛擬人像」。</div>}
            {count > 0 && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 96, fontWeight: 900, color: "#fff", textShadow: "0 4px 12px rgba(0,0,0,.5)" }}>{count}</div>}
            {layout === 4 && <div style={{ position: "absolute", top: 8, right: 10, color: "#fff", fontSize: 14, fontWeight: 700, background: "rgba(0,0,0,.4)", padding: "2px 8px", borderRadius: 8 }}>{shots.length} / 4</div>}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            {cam && <button disabled={count > 0 || shots.length > 0} onClick={shoot} style={big(count > 0 || shots.length ? "#ccc" : "#c0392b")}>{layout === 4 ? "連拍 4 張" : "拍！"}</button>}
            {cam === false && <button onClick={() => fileIn.current.click()} style={big("#c0392b")}>從手機相簿選</button>}
            <button onClick={() => { stop(); setStep("pick"); }} style={big("#fff", "#c0392b")}>返回</button>
          </div>
        </>}

        {step === "edit" && <>
          <canvas ref={out} width={OW} height={OH} style={{ width: "100%", borderRadius: 10, display: "block", boxShadow: "0 3px 10px rgba(0,0,0,.2)" }} />
          <div style={lab}>相框</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{FRAMES.map(f => <button key={f.k} onClick={() => setFrame(f)} style={chip(frame.k === f.k)}>{f.name}</button>)}</div>
          <div style={lab}>貼圖（點一下加上去，最多 8 個）</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {STK.map(e => <button key={e} onClick={() => setStk(a => a.length >= 8 ? a : [...a, e])} style={{ ...chip(false), fontSize: 20, padding: "2px 6px" }}>{e}</button>)}
            {stk.length > 0 && <button onClick={() => setStk(a => a.slice(0, -1))} style={chip(false)}>↩︎ 收回</button>}
          </div>
          <input value={title} maxLength={12} onChange={e => setTitle(e.target.value)} placeholder="寫一句話（最多 12 字）" style={{ ...s.input, marginTop: 10 }} />
          {msg && <div style={{ fontSize: 13, marginTop: 8, color: msg.startsWith("✅") ? "#27ae60" : msg.endsWith("…") ? "#7a5a6a" : "#c0392b", fontWeight: 600 }}>{msg}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button disabled={busy || msg.startsWith("✅")} onClick={save} style={big(busy || msg.startsWith("✅") ? "#ccc" : "#c0392b")}>存進相簿<span style={{ display: "block", fontSize: 11, fontWeight: 400 }}>1 枚</span></button>
            <button disabled={busy} onClick={() => { setStk([]); setTitle(""); setMsg(""); setStep("pick"); }} style={big("#fff", "#c0392b")}>{msg.startsWith("✅") ? "再拍一張" : "重拍"}</button>
          </div>
        </>}
        <button onClick={() => { stop(); onClose(); }} disabled={busy} style={{ ...s.btn("ghost"), marginTop: 10 }}>離開</button>
      </div>
    </div>, document.body
  );
}

// 我的相簿（我的 → 我的相簿）
export function AlbumPage({ apiPost, C, s, onShoot }) {
  const [list, setList] = useState(null), [view, setView] = useState(null), [err, setErr] = useState("");
  const load = async () => { const r = await apiPost({ action: "v44Photos" }, 0); if (r && r.success) setList(r.data || []); else { setList([]); setErr((r && r.error) || "讀取失敗"); } };
  useEffect(() => { load(); }, []);
  const open = async x => {
    setView({ ...x, src: null });
    const r = await apiPost({ action: "v44PhotoGet", id: x.id }, 0);
    if (r && r.success) setView(v => v && v.id === x.id ? { ...v, src: "data:image/jpeg;base64," + r.data.base64 } : v);
    else setView(v => v && { ...v, err: (r && r.error) || "讀取失敗" });
  };
  const del = async x => {
    if (!window.confirm("刪掉這張拍貼？刪了就找不回來喔")) return;
    const r = await apiPost({ action: "v44PhotoDel", id: x.id }, 0);
    if (r && r.success) { setView(null); load(); } else alert((r && r.error) || "刪除失敗");
  };
  return (
    <div>
      <div style={s.card}>
        <div style={s.sectionTitle}>📸 我的相簿</div>
        <div style={{ fontSize: 12.5, color: C.muted }}>在宇宙辦公室「遊戲室」的拍貼機拍的照片都在這裡，只有你自己看得到。</div>
        {onShoot && <button onClick={onShoot} style={{ ...s.btn("primary"), marginTop: 10 }}>📸 去拍一張</button>}
      </div>
      {list === null && <div style={{ textAlign: "center", color: C.muted, padding: 20 }}>讀取中…</div>}
      {err && <div style={{ color: C.red, fontSize: 13, padding: 8 }}>{err}</div>}
      {list && !list.length && !err && <div style={{ ...s.card, textAlign: "center", color: C.muted }}>還沒有照片。按上面「📸 去拍一張」吧！</div>}
      {list && list.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {list.map(x => (
          <button key={x.id} onClick={() => open(x)} style={{ padding: 0, border: "none", background: "#fff", borderRadius: 10, overflow: "hidden", cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,.12)" }}>
            {x.thumb ? <img src={"data:image/jpeg;base64," + x.thumb} alt="" style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", display: "block" }} /> : <div style={{ aspectRatio: "3/4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>📸</div>}
            <div style={{ fontSize: 11, color: C.muted, padding: "3px 4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.title || x.time}</div>
          </button>
        ))}
      </div>}
      {view && createPortal(
        <div onClick={() => setView(null)} style={{ position: "fixed", inset: 0, zIndex: 1800, background: "rgba(0,0,0,.88)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 380 }}>
            {view.src ? <img src={view.src} alt="" style={{ width: "100%", borderRadius: 10, display: "block" }} /> : <div style={{ color: "#fff", textAlign: "center", padding: 40 }}>{view.err || "載入中…"}</div>}
            <div style={{ color: "#ddd", fontSize: 12, textAlign: "center", margin: "6px 0" }}>{view.time}{view.title ? " · " + view.title : ""}　（長按照片也可以存到手機）</div>
            <div style={{ display: "flex", gap: 8 }}>
              {view.src && <a href={view.src} download={`紅玉滿拍貼_${view.id}.jpg`} style={{ ...s.btn("primary"), flex: 1, textAlign: "center", textDecoration: "none" }}>下載</a>}
              <button onClick={() => del(view)} style={{ ...s.btn("ghost"), flex: 1, color: C.red }}>刪除</button>
              <button onClick={() => setView(null)} style={{ ...s.btn("ghost"), flex: 1 }}>關閉</button>
            </div>
          </div>
        </div>, document.body)}
    </div>
  );
}
