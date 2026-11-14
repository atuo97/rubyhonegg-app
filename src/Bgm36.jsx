// v1.36 背景音樂：4 首原創曲（紅玉滿自己寫的，沒有版權問題），用 Web Audio 即時演奏，不用下載音樂檔
//   park     樂園圓舞曲（3/4，輕快）
//   office   宇宙辦公室（悠閒的城鎮感）
//   battle   麵糊大作戰（對戰、塔防，節奏快）
//   birthday 生日派對（有人生日時，宇宙辦公室改播這首）
// 只在樂園、宇宙辦公室、遊戲頁播放；工作頁（首頁、打卡、叫貨…）不播。第一次進樂園會問要不要開，之後在「我的」可以調音量或關掉
// 其他遊戲要換曲：window.rhBgm.push("battle") 開始、window.rhBgm.pop() 結束（回到原本那一首）
import { useEffect, useState } from "react";

const KEY = "rh_bgm";
const load = () => { try { return Object.assign({ on: null, vol: 0.5 }, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { return { on: null, vol: 0.5 }; } };
const save = st => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };

// ── 音名 → 頻率 ──
const NOTE = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
const hz = n => { const m = /^([A-G][#b]?)(\d)$/.exec(n); if (!m) return 0; return 440 * Math.pow(2, (NOTE[m[1]] + (Number(m[2]) + 1) * 12 - 69) / 12); };
const tr = (n, oct) => { const m = /^([A-G][#b]?)(\d)$/.exec(n); return m ? m[1] + (Number(m[2]) + oct) : n; };

// ── 曲子 ──
// mel：每小節一串「音:拍數(step)」，- 是休止；chords：每小節的和弦（可以一小節兩個，用 / 分開）
const CH = {
  F: ["F3", "A3", "C4"], C: ["C3", "E3", "G3"], Dm: ["D3", "F3", "A3"], Bb: ["Bb2", "D3", "F3"], Am: ["A2", "C3", "E3"], Gm: ["G2", "Bb2", "D3"],
  G: ["G2", "B2", "D3"], E: ["E2", "G#2", "B2"], Em: ["E3", "G3", "B3"], D: ["D3", "F#3", "A3"]
};
const SONGS = {
  park: { bpm: 138, steps: 6, beat: 2, style: "waltz",
    chords: ["F", "C", "Dm", "Bb", "F", "C", "Bb/C", "F", "Dm", "Am", "Bb", "F", "Gm", "C", "Bb/C", "F"],
    mel: ["A4:2 C5:2 F5:2", "E5:3 D5:1 C5:2", "D5:2 F5:2 A5:2", "G5:4 F5:2", "A5:2 G5:1 F5:1 C5:2", "D5:2 E5:2 G5:2", "D5:3 E5:3", "F5:4 -:2",
          "A5:2 F5:2 D5:2", "C6:3 A5:1 E5:2", "D5:2 F5:2 Bb5:2", "A5:4 C5:2", "Bb5:2 A5:1 G5:1 D5:2", "E5:2 G5:2 C6:2", "Bb5:3 G5:3", "F5:4 -:2"],
    bell: [8, 9, 10, 11, 12, 13, 14, 15] },
  office: { bpm: 96, steps: 8, beat: 2, style: "town",
    chords: ["C", "Am", "F", "G", "C", "Am", "Dm/G", "C"],
    mel: ["E5:4 G5:2 E5:2", "C5:4 E5:4", "F5:2 A5:2 C6:2 A5:2", "G5:6 -:2", "E5:2 D5:2 C5:2 E5:2", "A5:4 G5:2 E5:2", "F5:2 D5:2 B4:2 D5:2", "C5:6 -:2"] },
  battle: { bpm: 150, steps: 8, beat: 2, style: "battle",
    chords: ["Am", "F", "G", "E", "Am", "F", "G", "E"],
    mel: ["A4:1 C5:1 E5:2 A5:2 G5:1 E5:1", "F5:2 E5:1 C5:1 A4:2 C5:2", "D5:1 G5:1 B5:2 A5:1 G5:1 D5:2", "E5:3 G#5:1 B5:2 G#5:2",
          "A5:1 A5:1 C6:2 B5:1 A5:1 E5:2", "F5:1 A5:1 C6:2 A5:2 F5:2", "G5:1 B5:1 D6:2 C6:1 B5:1 G5:2", "G#5:2 B5:2 E6:3 -:1"] },
  birthday: { bpm: 120, steps: 8, beat: 2, style: "party",
    chords: ["G", "C", "D", "G", "Em", "C", "D", "G"],
    mel: ["B4:2 D5:2 G5:3 -:1", "E5:2 G5:2 C6:2 B5:2", "A5:2 F#5:2 D5:2 F#5:2", "G5:6 -:2", "G5:2 B5:2 E6:2 D6:2", "C6:2 B5:2 A5:2 G5:2", "F#5:2 A5:2 D6:2 C6:2", "B5:4 G5:2 -:2"] }
};

// 把曲子展開成事件：[step, 樂器, 音, 長度(step)]
function build(song) {
  const ev = [], S = song.steps, bars = song.chords.length;
  song.mel.forEach((bar, b) => {
    let t = b * S;
    bar.trim().split(/\s+/).forEach(tok => { const [n, d] = tok.split(":"), len = Number(d) || 1; if (n !== "-") ev.push([t, song.style === "town" || song.style === "party" ? "bell" : "lead", n, len]); t += len; });
  });
  song.chords.forEach((c, b) => {
    const parts = c.split("/"), half = S / parts.length;
    parts.forEach((name, k) => {
      const ch = CH[name], t0 = b * S + k * half;
      if (song.style === "waltz") {        // 碰 - 恰 - 恰
        for (let q = 0; q < half; q += 2) { if (q === 0) ev.push([t0, "bass", tr(ch[0], -1 + (ch[0].endsWith("2") ? 1 : 0)), 2]); else ch.forEach(n => ev.push([t0 + q, "pluck", tr(n, 1), 1])); }
        if ((song.bell || []).includes(b) && k === 0) ev.push([t0, "bell", tr(ch[2], 2), 3]);
      } else if (song.style === "town") {   // 長音鋪底＋琶音
        ch.forEach(n => ev.push([t0, "pad", tr(n, 1), half]));
        ev.push([t0, "bass", tr(ch[0], ch[0].endsWith("2") ? 0 : -1), 2]); ev.push([t0 + half / 2, "bass", tr(ch[2], ch[2].endsWith("2") ? 0 : -1), 2]);
        const arp = [ch[0], ch[1], ch[2], tr(ch[0], 1), ch[2], ch[1], ch[0], ch[1]];
        for (let q = 0; q < half; q++) ev.push([t0 + q, "pluck", tr(arp[q % arp.length], 1), 1]);
      } else if (song.style === "battle") { // 八分音符低音＋鼓
        for (let q = 0; q < half; q++) ev.push([t0 + q, "bass", tr(ch[0], ch[0].endsWith("2") ? 0 : -1), 1]);
        ch.forEach(n => ev.push([t0, "pad", tr(n, 1), half]));
      } else {                              // party：跳躍低音＋和弦
        for (let q = 0; q < half; q += 2) ev.push([t0 + q, "bass", q % 4 ? tr(ch[2], ch[2].endsWith("2") ? 0 : -1) : tr(ch[0], ch[0].endsWith("2") ? 0 : -1), 1]);
        for (let q = 1; q < half; q += 2) ch.forEach(n => ev.push([t0 + q, "pluck", tr(n, 1), 1]));
      }
    });
  });
  if (song.style === "battle" || song.style === "party") for (let t = 0; t < bars * S; t++) {
    const q = t % S;
    if (q % 4 === 0) ev.push([t, "kick", "", 1]);
    if (q % 4 === 2 && song.style === "battle") ev.push([t, "snare", "", 1]);
    if (song.style === "battle" || q % 2 === 1) ev.push([t, "hat", "", 1]);
  }
  return { ev: ev.sort((a, b) => a[0] - b[0]), len: bars * S, stepSec: 60 / song.bpm / song.beat };
}

// ── 播放器 ──
let ctx = null, master = null, bus = null, noise = null, cur = null, timer = null, stack = [], page = null, state = load(), unlocked = false;
function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  try { if (navigator.audioSession) navigator.audioSession.type = "ambient"; } catch (e) {}   // iPhone 靜音模式時不出聲
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; comp.connect(master);
  bus = ctx.createGain(); bus.gain.value = 0.32; bus.connect(comp);
  noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  document.addEventListener("visibilitychange", () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (cur) ctx.resume(); });
  return ctx;
}
function env(g, t, a, peak, dur, rel) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setTargetAtTime(peak * 0.6, t + a, dur * 0.4); g.gain.setTargetAtTime(0.0001, t + dur, rel); }
function voice(inst, note, t, dur) {
  const f = hz(note), g = ctx.createGain(); g.connect(bus);
  const osc = (type, freq, gain, det) => { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = freq; if (det) o.detune.value = det; og.gain.value = gain; o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + 1.2); return o; };
  if (inst === "lead") { const o = osc("triangle", f, 0.9); osc("square", f, 0.06); const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.5; lg.gain.value = f * 0.006; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t + 0.12); lfo.stop(t + dur + 1); env(g, t, 0.02, 0.5, dur * 0.9, 0.08); }
  else if (inst === "bell") { osc("sine", f, 0.8); osc("sine", f * 2, 0.25); osc("sine", f * 3.01, 0.12); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.42, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0008, t + Math.max(0.5, dur * 1.6)); }
  else if (inst === "pluck") { const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1800; g.disconnect(); g.connect(lp); lp.connect(bus); osc("square", f, 0.35); osc("triangle", f, 0.6); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.22, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.32); }
  else if (inst === "bass") { osc("triangle", f, 1); osc("sine", f / 2, 0.4); env(g, t, 0.01, 0.55, dur * 0.85, 0.05); }
  else if (inst === "pad") { const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900; g.disconnect(); g.connect(lp); lp.connect(bus); osc("sawtooth", f, 0.25, -7); osc("sawtooth", f, 0.25, 7); env(g, t, Math.min(0.4, dur * 0.3), 0.12, dur * 0.95, 0.3); }
  else if (inst === "kick") { const o = ctx.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12); o.connect(g); g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); o.start(t); o.stop(t + 0.2); }
  else { const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(); s.buffer = noise; fl.type = inst === "hat" ? "highpass" : "bandpass"; fl.frequency.value = inst === "hat" ? 7000 : 1800; s.connect(fl); fl.connect(g);
    const len = inst === "hat" ? 0.04 : 0.12; g.gain.setValueAtTime(inst === "hat" ? 0.09 : 0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + len); s.start(t); s.stop(t + len + 0.02); }
}
function startSong(name) {
  if (!ensure()) return;
  const song = build(SONGS[name]); let step = 0, next = ctx.currentTime + 0.12, idx = 0;
  const me = { name, song };
  const tick = () => {
    if (cur !== me) return;
    while (next < ctx.currentTime + 0.25) {
      while (idx < song.ev.length && song.ev[idx][0] === step) { const [, inst, n, len] = song.ev[idx]; try { voice(inst, n, next, len * song.stepSec); } catch (e) {} idx++; }
      step++; next += song.stepSec;
      if (step >= song.len) { step = 0; idx = 0; }
    }
  };
  cur = me; clearInterval(timer); timer = setInterval(tick, 40); tick();
}
function fadeTo(v, sec) { if (!ctx) return; const t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(v, t + sec); }
function apply() {
  const want = stack.length ? stack[stack.length - 1] : page;
  if (!state.on || !want) { if (cur) { fadeTo(0, 0.6); const c = cur; setTimeout(() => { if (cur === c) { cur = null; clearInterval(timer); } }, 700); } return; }
  if (!ensure()) return;
  if (ctx.state === "suspended" && unlocked) ctx.resume();
  if (cur && cur.name === want) { fadeTo(state.vol * 0.9, 0.4); return; }
  if (cur) { fadeTo(0, 0.5); setTimeout(() => { startSong(want); fadeTo(state.vol * 0.9, 1.2); }, 520); }
  else { startSong(want); fadeTo(state.vol * 0.9, 1.5); }
}
// 瀏覽器規定要先點一下畫面才能出聲
function unlockOnce() {
  if (unlocked) return; unlocked = true;
  const go = () => { if (ctx && ctx.state === "suspended") ctx.resume(); };
  ["pointerdown", "touchend", "keydown"].forEach(e => window.addEventListener(e, go, { passive: true }));
}

// 試聽檔用：離線把一首歌算成音訊（不影響 App 播放）
export async function renderOffline(name, loops = 1) {
  const song = build(SONGS[name]), sec = song.len * song.stepSec * loops + 2, sr = 44100;
  const off = new OfflineAudioContext(2, Math.ceil(sec * sr), sr), keep = [ctx, master, bus, noise];
  ctx = off; master = off.createGain(); master.gain.value = 0.85; master.connect(off.destination);
  const comp = off.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; comp.connect(master);
  bus = off.createGain(); bus.gain.value = 0.32; bus.connect(comp);
  noise = off.createBuffer(1, sr * 0.5, sr); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  for (let l = 0; l < loops; l++) song.ev.forEach(([st, inst, n, len]) => voice(inst, n, 0.1 + (l * song.len + st) * song.stepSec, len * song.stepSec));
  const buf = await off.startRendering(); [ctx, master, bus, noise] = keep; return buf;
}

export const bgm = {
  setPage(name) { page = name || null; if (page && state.on) unlockOnce(); apply(); },
  push(name) { if (!SONGS[name]) return; stack.push(name); apply(); },
  pop(name) { const i = name ? stack.lastIndexOf(name) : stack.length - 1; if (i >= 0) stack.splice(i, 1); apply(); },
  get() { return { ...state }; },
  set(p) { state = Object.assign({}, state, p); save(state); if (state.on) { unlockOnce(); ensure(); if (ctx && ctx.state === "suspended") ctx.resume(); } apply(); window.dispatchEvent(new Event("rh-bgm")); },
  songs: Object.keys(SONGS)
};
if (typeof window !== "undefined") window.rhBgm = bgm;

// 頁面對應的曲子（App 換頁時呼叫）
export const BGM_OF_TAB = { park: "park", avatar: "park", game: "park", street: "park", spend: "park", rules: "park", hearts: "park", universe: "office", arena: "battle", tower: "battle", minigame: "battle" };

// 第一次進樂園時詢問
export function BgmAsk({ C, s }) {
  const [st, setSt] = useState(bgm.get());
  useEffect(() => { const f = () => setSt(bgm.get()); window.addEventListener("rh-bgm", f); return () => window.removeEventListener("rh-bgm", f); }, []);
  if (st.on !== null) return null;
  return (
    <div style={{ ...s.card, display: "flex", alignItems: "center", gap: 10, background: "#fff7e6", border: `1px solid ${C.goldBg}` }}>
      <span style={{ fontSize: 24 }}>🎵</span>
      <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}><b>要開背景音樂嗎？</b><br /><span style={{ color: C.muted, fontSize: 12 }}>只在樂園、宇宙辦公室和遊戲播放；之後隨時按右上角 🔊 開關，音量在首頁最下面調</span></div>
      <button onClick={() => bgm.set({ on: true })} style={{ ...s.btn("primary"), width: "auto", padding: "8px 12px", fontSize: 13 }}>開</button>
      <button onClick={() => bgm.set({ on: false })} style={{ ...s.btn("ghost"), width: "auto", padding: "8px 10px", fontSize: 13 }}>不用</button>
    </div>
  );
}

// v1.39：頂端列的一鍵開關（隨時能關）
export function BgmToggle({ C }) {
  const [st, setSt] = useState(bgm.get());
  useEffect(() => { const f = () => setSt(bgm.get()); window.addEventListener("rh-bgm", f); return () => window.removeEventListener("rh-bgm", f); }, []);
  const on = !!st.on;
  return (
    <button onClick={() => bgm.set({ on: !on })} aria-label={on ? "關閉背景音樂" : "開啟背景音樂"} title={on ? "關閉背景音樂" : "開啟背景音樂"}
      style={{ width: 38, height: 38, borderRadius: 19, border: `1px solid ${C.border}`, background: on ? C.accentBg : C.card, fontSize: 17, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0, flexShrink: 0 }}>
      {on ? "🔊" : "🔇"}
    </button>
  );
}

// 首頁最下面的設定（v1.39 從「我的」移過來）
export function BgmSettings({ C, s }) {
  const [st, setSt] = useState(bgm.get());
  useEffect(() => { const f = () => setSt(bgm.get()); window.addEventListener("rh-bgm", f); return () => window.removeEventListener("rh-bgm", f); }, []);
  const [demo, setDemo] = useState(null);
  useEffect(() => () => { if (demo) bgm.pop(demo); }, [demo]);
  const NAMES = { park: "樂園圓舞曲", office: "宇宙辦公室", battle: "麵糊大作戰", birthday: "生日派對" };
  return (
    <div style={{ ...s.card }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div><div style={{ fontSize: 14.5, fontWeight: 600 }}>🎵 背景音樂</div><div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>樂園、宇宙辦公室、遊戲時播放；手機靜音時不會出聲</div></div>
        <button onClick={() => bgm.set({ on: !st.on })} style={{ width: 50, height: 28, borderRadius: 14, border: "none", background: st.on ? C.green : C.border, position: "relative", cursor: "pointer", flex: "0 0 50px" }}>
          <span style={{ position: "absolute", top: 3, left: st.on ? 25 : 3, width: 22, height: 22, borderRadius: 11, background: "#fff", transition: "left .2s" }} />
        </button>
      </div>
      {st.on && <>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
          <span style={{ fontSize: 12, color: C.muted }}>音量</span>
          <input type="range" min="0.05" max="1" step="0.05" value={st.vol} onChange={e => bgm.set({ vol: Number(e.target.value) })} style={{ flex: 1, accentColor: C.accent }} />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          {bgm.songs.map(k => <button key={k} onClick={() => { if (demo) bgm.pop(demo); if (demo === k) { setDemo(null); return; } bgm.push(k); setDemo(k); }} style={{ border: `1px solid ${demo === k ? C.accent : C.border}`, background: demo === k ? C.accentBg : C.card, color: demo === k ? C.accent : C.text, borderRadius: 999, padding: "5px 11px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>{demo === k ? "⏹ " : "▶ "}{NAMES[k]}</button>)}
        </div>
      </>}
    </div>
  );
}
