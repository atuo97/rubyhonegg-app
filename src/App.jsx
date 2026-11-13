import { useState, useEffect, useRef, useMemo, lazy, Suspense } from "react";
const UniverseTab = lazy(() => import("./universe/UniverseTab.jsx"));
import VotesTab from "./VotesTab.jsx";
import AvatarEditor, { Doll } from "./AvatarEditor.jsx";
import BatterPage from "./BatterTab.jsx";
import ReportPage from "./ReportTab.jsx";
import { RulesPage, BoostAdmin, BrandPage, LoginSlogan } from "./Park27.jsx";
import { useFsMeta, FridgeInputs, fridgesFilled, fridgePayload, GroomChecks, GROOM, AuditPage, HealthPage, FoodSafetyAdmin, SopPage } from "./FoodSafety.jsx";
import { sanitize as sanitizeAvatar } from "./universe/avatarCatalog.js";
import GameTab from "./GameTab.jsx";
import { Coin } from "./Coin.jsx";
import { PetSprite } from "./pets/petSprites.jsx";
import ArenaTab from "./ArenaTab.jsx";
import TowerTab from "./TowerTab.jsx";
import ShopStreetTab from "./ShopStreetTab.jsx";
import OrdersTab from "./OrdersTab.jsx";
import ScheduleManager, { MyShifts } from "./ScheduleTab.jsx";
import MePet from "./MePet.jsx";
import { MaterialsPage, OnboardCard, StaffManager, LocManager, AnnouncePage, PnlPage, PricePage, PartnerHome, AnnInbox } from "./OpsTab.jsx";

// ─────────────────────────────────────────────
// Google Sheets API 設定
// ─────────────────────────────────────────────
// Cloudflare Worker 代理(解決 CORS)
const API_URL = "https://royal-hat-f2df.atuo97.workers.dev";

const sleep = ms => new Promise(r => setTimeout(r, ms));

// 本機快取(只放非敏感資料:公告、櫃位),讓畫面先秒開、背景再更新
const cacheGet = k => { try { const v = localStorage.getItem("rh_" + k); return v ? JSON.parse(v) : null; } catch(e) { return null; } };
const cacheSet = (k, v) => { try { localStorage.setItem("rh_" + k, JSON.stringify(v)); } catch(e) {} };

// 活動地點(一天可能有多場活動,每次上班打卡都要填;下班時沿用)
const getVenue = (userId, loc) => {
  const v = cacheGet("venue_" + userId);
  return v && v.date === todayStr() && v.loc === loc ? v.venue : "";
};

// v1.25 登入通行證：每次呼叫自動帶 token；大隊長預覽時帶 viewAs（後端只讀）
const AUTH = { token:"", viewAs:"", onRelogin:null };
const AUTH_KEY = "rh_auth";
const authLoad = () => { try { const v = JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); return v && v.token && v.user ? v : null; } catch(e) { return null; } };
const authSave = (user) => { try { if (user && user.token) localStorage.setItem(AUTH_KEY, JSON.stringify({ token:user.token, user })); } catch(e) {} };
const authClear = () => { try { localStorage.removeItem(AUTH_KEY); } catch(e) {} AUTH.token = ""; AUTH.viewAs = ""; };
const withAuth = (o) => {
  const x = { ...o };
  if (AUTH.token && !x.token) x.token = AUTH.token;
  if (AUTH.viewAs && x.action !== "login") x.viewAs = AUTH.viewAs;
  return x;
};
const checkRelogin = (r) => { if (r && r.relogin && AUTH.token && AUTH.onRelogin) AUTH.onRelogin(r.error); return r; };

// 同一時間相同的 GET 只送一次(避免重複請求拖慢後端)
const inflightGets = {};
function apiGet(params, retries = 2) {
  const qs = new URLSearchParams(withAuth(params)).toString();
  if (inflightGets[qs]) return inflightGets[qs];
  const p = apiGetRaw(qs, retries).then(checkRelogin).finally(() => { delete inflightGets[qs]; });
  inflightGets[qs] = p;
  return p;
}
async function apiGetRaw(qs, retries) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${API_URL}?${qs}`);
      const text = await res.text();
      return JSON.parse(text);
    } catch(e) {
      if (attempt < retries) { await sleep(800 * (attempt + 1)); continue; }
      return { error: "連線失敗:" + e.message };
    }
  }
}

async function apiPost(data, retries = 2) {
  data = withAuth(data);
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(data),
      });
      const text = await res.text();
      return checkRelogin(JSON.parse(text));
    } catch(e) {
      if (attempt < retries) { await sleep(800 * (attempt + 1)); continue; }
      return { error: "連線失敗:" + e.message };
    }
  }
}

// 照片壓縮(長邊800px JPEG)→ base64
function compressPhoto(file, maxSide) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const max = maxSide || 800;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = img.width * scale; cv.height = img.height * scale;
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      resolve(cv.toDataURL("image/jpeg", 0.7).split(",")[1]);
    };
    img.onerror = () => reject("照片讀取失敗");
    img.src = URL.createObjectURL(file);
  });
}

// 上傳照片到 Google Drive,回傳檔案連結
async function uploadPhoto(file, meta) {
  const b64 = await compressPhoto(file);
  const res = await apiPost({ action:"uploadPhoto", base64:b64, ...meta });
  if (!res.success || !res.url) {
    throw new Error("照片上傳失敗(" + (res.error || "請檢查網路後重試") + ")");
  }
  return res.url;
}

// ─────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────
const C = {
  bg:"#f8f5f0", warm:"#f3eee6", card:"#fffdfa",
  border:"#e8e0d5", borderDark:"#d6cbbb",
  accent:"#b9381c", accentL:"#b9381c", accentBg:"#f7e6df",
  gold:"#a8741a", goldL:"#a8741a", goldBg:"#f8efdc",
  green:"#3a7a56", greenL:"#3a7a56", greenBg:"#e8f1ea",
  blue:"#3d5a80", blueL:"#3d5a80", blueBg:"#e9eef5",
  red:"#b42318", redBg:"#fbeae8",
  text:"#2b221c", muted:"#8a7e72", light:"#b3a798",
  shadow:"0 1px 2px rgba(43,34,28,.04)",
};

const s = {
  app:{ background:C.bg, minHeight:"100vh",
        fontFamily:"'Noto Sans TC','PingFang TC',sans-serif",
        color:C.text, maxWidth:480, margin:"0 auto" },
  card:{ background:C.card, border:`1px solid ${C.border}`,
         borderRadius:18, padding:16, marginBottom:12, boxShadow:C.shadow },
  btn:(v="primary")=>({
    display:"flex", alignItems:"center", justifyContent:"center",
    gap:8, padding:"13px 20px", borderRadius:14, border:"1px solid transparent",
    cursor:"pointer", fontWeight:600, fontSize:14, width:"100%", fontFamily:"inherit",
    transition:"all .18s",
    ...(v==="primary" || v==="green" || v==="blue"
      ? { background:C.accent, color:"#fff" }
      : v==="ghost"
      ? { background:"transparent", color:C.muted, border:`1px solid ${C.border}` }
      : { background:C.card, color:C.text, border:`1px solid ${C.border}` }),
  }),
  input:{ width:"100%", background:C.card, border:`1px solid ${C.border}`,
          borderRadius:12, padding:"12px 14px", color:C.text, fontSize:14,
          outline:"none", boxSizing:"border-box", fontFamily:"inherit" },
  label:{ fontSize:12, fontWeight:500, color:C.muted, marginBottom:6,
          display:"block", letterSpacing:.3 },
  sectionTitle:{ fontSize:12, fontWeight:600, color:C.muted, letterSpacing:1.5,
                 marginBottom:10 },
};

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const todayStr = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
const timeNow  = () => new Date().toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
const dateStr  = () => new Date().toLocaleDateString("zh-TW",{year:"numeric",month:"long",day:"numeric",weekday:"long"});
const ymStr    = () => todayStr().slice(0,7);
const daysUntil = d => Math.ceil((new Date(d)-new Date())/86400000);
function useTime(){ const [t,setT]=useState(timeNow()); useEffect(()=>{const i=setInterval(()=>setT(timeNow()),1000);return()=>clearInterval(i);},[]);return t; }


// ─────────────────────────────────────────────
// 共用 UI:線條圖示、全域樣式、離線偵測、時間卡
// ─────────────────────────────────────────────
const ICONS = {
  home:'<path d="M4 11l8-7 8 7"/><path d="M6 10v9h12v-9"/>',
  clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  user:'<circle cx="12" cy="8.5" r="3.5"/><path d="M5 19.5c1-3.5 4-5 7-5s6 1.5 7 5"/>',
  grid:'<rect x="4.5" y="4.5" width="6" height="6" rx="1.5"/><rect x="13.5" y="4.5" width="6" height="6" rx="1.5"/><rect x="4.5" y="13.5" width="6" height="6" rx="1.5"/><rect x="13.5" y="13.5" width="6" height="6" rx="1.5"/>',
  vote:'<rect x="4" y="9" width="16" height="10" rx="2"/><path d="M8 9V6h8v3M9.5 14l1.8 1.8L15 12"/>',
  book:'<path d="M5 5.5A1.5 1.5 0 016.5 4H19v15H6.5A1.5 1.5 0 005 20.5z"/><path d="M5 5.5v15"/>',
  cal:'<rect x="4" y="5.5" width="16" height="14" rx="2"/><path d="M4 10h16M8.5 4v3M15.5 4v3"/>',
  chart:'<path d="M5 19V9M12 19V5M19 19v-7"/>',
  cube:'<path d="M12 3.5l7.5 4v9L12 20.5l-7.5-4v-9z"/><path d="M12 12l7.5-4.5M12 12L4.5 7.5M12 12v8.5"/>',
  chev:'<path d="M9 6l6 6-6 6"/>',
  coin:'<path d="M12 20s-7-4.3-8.9-8.6C1.7 8.1 3.6 4.8 6.9 4.8c1.9 0 3.3 1.1 4.1 2.4.8-1.3 2.2-2.4 4.1-2.4 3.3 0 5.2 3.3 3.8 6.6C17 15.7 12 20 12 20z"/>',
  sword:'<path d="M14.5 4.5h5v5L9 20l-5-5z"/><path d="M7 13l4 4M4 20l2-2"/>',
  tower:'<path d="M6 20V9h12v11"/><path d="M6 9V5h2v2h2V5h4v2h2V5h2v4M10 20v-4h4v4"/>',
  order:'<rect x="5" y="4.5" width="14" height="16" rx="2"/><path d="M9 4.5h6v3H9zM8.5 12h7M8.5 16h5"/>',
  back:'<path d="M15 6l-6 6 6 6"/>',
  tool:'<path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3l-2.6 2.6-2.3-.6-.6-2.3z"/>',
  park:'<circle cx="12" cy="9" r="5"/><path d="M12 14v6M9.5 20h5M12 4v-.5M9.7 6.5c.6-.6 1.4-1 2.3-1"/>',
  shield:'<path d="M12 3.5l7 2.8v5.2c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6.3z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
  mng:'<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
};
function Ic({ n, size=22, color="currentColor", sw=1.6, style }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink:0, ...style }}
    dangerouslySetInnerHTML={{ __html: ICONS[n] || "" }} />;
}

const GLOBAL_CSS = `
html,body{background:#efe9e0;margin:0}
*{-webkit-tap-highlight-color:transparent}
@keyframes rhFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes rhShimmer{0%{background-position:-300px 0}100%{background-position:300px 0}}
.rh-page{animation:rhFade .28s ease both}
.rh-skel{background:linear-gradient(90deg,#efe8dd 25%,#f7f2ea 50%,#efe8dd 75%);background-size:600px 100%;animation:rhShimmer 1.3s infinite linear;border-radius:12px}
input:focus,select:focus,textarea:focus{border-color:#b9381c !important;box-shadow:0 0 0 3px rgba(185,56,28,.12) !important;outline:none !important}
button:focus-visible{outline:2px solid #b9381c;outline-offset:2px}
button:active{transform:scale(.985)}
`;
function GlobalStyle() { return <style>{GLOBAL_CSS}</style>; }

function useOnline() {
  const [on, setOn] = useState(typeof navigator === "undefined" ? true : navigator.onLine !== false);
  useEffect(() => {
    const a = () => setOn(true), b = () => setOn(false);
    window.addEventListener("online", a); window.addEventListener("offline", b);
    return () => { window.removeEventListener("online", a); window.removeEventListener("offline", b); };
  }, []);
  return on;
}

// 淺色時間卡(取代原本各分頁的深色時鐘卡)
function TimeHeader({ sub, tag }) {
  const time = useTime();
  return (
    <div style={{ ...s.card, textAlign:"center", padding:"18px 16px" }}>
      <div style={{ fontSize:12, color:C.muted }}>{dateStr()}</div>
      <div style={{ fontSize:44, fontWeight:300, color:C.text, letterSpacing:2, marginTop:2,
                    fontVariantNumeric:"tabular-nums" }}>{time}</div>
      {sub && <div style={{ marginTop:6, fontSize:12.5, color:C.muted }}>{sub}{tag}</div>}
    </div>
  );
}

// 子頁頁首:返回「更多」
function SubHeader({ title, onBack }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:4, margin:"0 0 12px -6px" }}>
      <button onClick={onBack} aria-label="返回" style={{ background:"none", border:"none", cursor:"pointer",
        color:C.muted, padding:6, display:"flex", fontFamily:"inherit" }}><Ic n="back" size={22}/></button>
      <div style={{ fontSize:16, fontWeight:600 }}>{title}</div>
    </div>
  );
}

// 載入骨架
function HomeSkeleton() {
  return (
    <div>
      <div className="rh-skel" style={{ height:120, marginBottom:12, borderRadius:18 }}/>
      <div className="rh-skel" style={{ height:56, marginBottom:10, borderRadius:18 }}/>
      <div className="rh-skel" style={{ height:56, marginBottom:10, borderRadius:18 }}/>
      <div className="rh-skel" style={{ height:96, borderRadius:18 }}/>
    </div>
  );
}

// 白色圓角列表項
// 小人＋寵物（頂部與赤心幣樂園共用）
function MeBuddy({ cfg, pet, scale = 1 }) {
  const h = Math.round(26 * scale);
  return (
    <span style={{ display:"inline-flex", alignItems:"flex-end", gap:2, height:h, overflow:"hidden" }}>
      {cfg ? <span style={{ display:"block", height:h, lineHeight:0 }}><Doll cfg={cfg} size={Math.round(h / 1.5)} /></span>
           : <span style={{ color:C.accent, display:"flex" }}><Ic n="user" size={h * 0.8}/></span>}
      {pet && pet.type ? <span style={{ display:"block", lineHeight:0 }}><PetSprite type={pet.type} stage={pet.stage} flavor={pet.flavor} size={Math.round(h * 0.9)} /></span> : null}
    </span>
  );
}

// 商店街街口的官方扭蛋機（點開才載入）
function GachaBooth({ user, C, s, onChanged }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ ...s.card, padding:"12px 14px", marginBottom:12, background:C.accentBg }}>
      <button onClick={()=>setOpen(o=>!o)} style={{ width:"100%", border:"none", background:"transparent", display:"flex", alignItems:"center", gap:12, cursor:"pointer", fontFamily:"inherit", color:C.text, padding:0, textAlign:"left" }}>
        <span style={{ fontSize:30, lineHeight:1 }}>🎰</span>
        <span style={{ flex:1 }}>
          <span style={{ display:"block", fontSize:14.5, fontWeight:600 }}>紅玉滿官方扭蛋機</span>
          <span style={{ display:"block", fontSize:12, color:C.muted, marginTop:2 }}>用赤心幣轉扭蛋，抽造型與限定小物</span>
        </span>
        <span style={{ fontSize:12.5, color:C.accent, fontWeight:600 }}>{open ? "收起" : "去轉"}</span>
      </button>
      {open && <div style={{ marginTop:12 }}><GameTab user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} onlyTab="gacha" onChanged={onChanged} /></div>}
    </div>
  );
}

function GameTile({ title, sub, icon, art, onClick }) {
  return (
    <button onClick={onClick} style={{ ...s.card, margin:0, display:"flex", flexDirection:"column", alignItems:"flex-start", gap:6,
      cursor:"pointer", textAlign:"left", fontFamily:"inherit", padding:"12px 14px", color:C.text, minHeight:92 }}>
      <span style={{ color:C.accent, display:"flex", alignItems:"flex-end", height:34 }}>{art || <Ic n={icon} size={28}/>}</span>
      <span>
        <span style={{ display:"block", fontSize:14, fontWeight:600 }}>{title}</span>
        {sub && <span style={{ display:"block", fontSize:11.5, color:C.muted, marginTop:1 }}>{sub}</span>}
      </span>
    </button>
  );
}

function ListItem({ icon, title, desc, onClick, badge, badgeRed }) {
  return (
    <button onClick={onClick} style={{ ...s.card, width:"100%", display:"flex", alignItems:"center", gap:14,
      cursor:"pointer", textAlign:"left", fontFamily:"inherit", padding:"14px 16px", marginBottom:8, color:C.text }}>
      <span style={{ color:C.accent, display:"flex" }}><Ic n={icon}/></span>
      <span style={{ flex:1 }}>
        <span style={{ display:"block", fontSize:14.5, fontWeight:500 }}>{title}</span>
        {desc && <span style={{ display:"block", fontSize:12, color:C.muted, marginTop:2 }}>{desc}</span>}
      </span>
      {badge ? <span style={{ minWidth:22, height:22, padding:"0 7px", borderRadius:11, boxSizing:"border-box", background: badgeRed ? C.red : C.accent,
                               color:"#fff", fontSize:12, fontWeight:600, display:"flex", alignItems:"center", justifyContent:"center" }}>{badge}</span> : null}
      <Ic n="chev" size={18} color={C.light}/>
    </button>
  );
}


// ─────────────────────────────────────────────
// 訂單提醒(App 內):每分鐘查今天的訂單 → 頂端提醒列、底部「更多」數字、快到時震動＋提示音＋系統通知
// 只在 App 開著時有效(手機鎖定或 App 完全關閉時收不到,之後由 LINE 推播補上)
// ─────────────────────────────────────────────
const ORDER_SOON_MIN = 15;   // 「最晚開始製作」前幾分鐘先提醒
const orderStartMin = o => {
  const m = /^(\d{2}):(\d{2})$/.exec(o.method === "外送" && o.sendTime ? o.sendTime : o.time || "");
  return m ? +m[1] * 60 + +m[2] - (Number(o.prep) || 0) : null;
};
const nowMinTW = () => { const [h, m] = new Date().toLocaleTimeString("en-GB", { timeZone:"Asia/Taipei", hour:"2-digit", minute:"2-digit" }).split(":"); return +h * 60 + +m; };
const fmtMin = n => { n = ((n % 1440) + 1440) % 1440; return String(Math.floor(n / 60)).padStart(2, "0") + ":" + String(n % 60).padStart(2, "0"); };

let audioCtx = null;
function chime() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    [0, 0.22].forEach((d, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = "sine"; o.frequency.value = i ? 1046 : 784;
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime + d);
      g.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + d + 0.35);
      o.connect(g).connect(audioCtx.destination); o.start(audioCtx.currentTime + d); o.stop(audioCtx.currentTime + d + 0.4);
    });
  } catch (e) {}
}
// iOS / Chrome 要使用者先點過畫面才能出聲:第一次點擊時先把音效解鎖
if (typeof window !== "undefined") {
  const unlock = () => { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch (e) {} window.removeEventListener("pointerdown", unlock); };
  window.addEventListener("pointerdown", unlock);
}
function sysNotify(title, body) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const opt = { body, icon:"/logo_ink.png", tag:"rh-order", renotify:true };
    if (navigator.serviceWorker && navigator.serviceWorker.controller)
      navigator.serviceWorker.ready.then(reg => reg.showNotification(title, opt)).catch(() => new Notification(title, opt));
    else new Notification(title, opt);
  } catch (e) {}
}

function useOrderAlerts(user) {
  const [ords, setOrds] = useState(null);
  const [now, setNow] = useState(nowMinTW());
  const [soundOn, setSoundOn] = useState(() => { try { return localStorage.getItem("rh_ordSound") !== "0"; } catch (e) { return true; } });
  const [perm, setPerm] = useState(() => (typeof Notification !== "undefined" ? Notification.permission : "unsupported"));
  const notified = useRef(new Set());
  const first = useRef(true);
  const refresh = () => { if (user) apiGet({ action:"getOrders", empId:user.id, from:todayStr(), to:todayStr() }, 0).then(r => { if (r && r.success) setOrds(r.data || []); }); };
  useEffect(() => {
    if (!user) return;
    refresh();
    const t = setInterval(() => { refresh(); setNow(nowMinTW()); }, 60000);
    const vis = () => { if (!document.hidden) { refresh(); setNow(nowMinTW()); } };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [user && user.id]);

  const today = todayStr();
  const open = (ords || []).filter(o => o.date === today && ["新訂單","製作中","已完成"].includes(o.status))
                           .sort((a, b) => (orderStartMin(a) ?? 9999) - (orderStartMin(b) ?? 9999));
  const todo = open.filter(o => ["新訂單","製作中"].includes(o.status) && orderStartMin(o) != null);
  const late = todo.filter(o => now >= orderStartMin(o));
  const soon = todo.filter(o => now < orderStartMin(o) && orderStartMin(o) - now <= ORDER_SOON_MIN);
  const next = [...open].sort((a, b) => (a.time < b.time ? -1 : 1))[0] || null;

  // 新進入「快到了／該開始了」的訂單 → 震動＋提示音＋系統通知(每筆每階段只響一次)
  useEffect(() => {
    if (!ords) return;
    const fresh = [];
    soon.forEach(o => { const k = o.id + "|soon"; if (!notified.current.has(k)) { notified.current.add(k); fresh.push([o, "soon"]); } });
    late.forEach(o => { const k = o.id + "|late"; if (!notified.current.has(k)) { notified.current.add(k); notified.current.add(o.id + "|soon"); fresh.push([o, "late"]); } });
    if (first.current) { first.current = false; if (!fresh.length) return; }
    if (!fresh.length) return;
    try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {}
    if (soundOn) chime();
    const [o, st] = fresh[0];
    const more = fresh.length > 1 ? `（另有 ${fresh.length - 1} 筆）` : "";
    sysNotify(st === "late" ? "訂單該開始製作了" : `訂單 ${ORDER_SOON_MIN} 分鐘內要開始製作`,
              `${o.time} ${o.method}・${o.cname}・${(o.items || []).map(i => i.name + "×" + i.qty).join("、") || o.extra || ""}${more}`);
  }, [ords, now]);

  const setSound = v => { setSoundOn(v); try { localStorage.setItem("rh_ordSound", v ? "1" : "0"); } catch (e) {} if (v) chime(); };
  const askPerm = async () => { try { const p = await Notification.requestPermission(); setPerm(p); if (p === "granted") sysNotify("訂單通知已開啟", "訂單快到製作時間時會通知你"); } catch (e) {} };
  return { ready: !!ords, open, late, soon, next, now, soundOn, setSound, perm, askPerm, refresh };
}

// 每頁頂端的訂單提醒列
function OrderBanner({ ord, onOpen }) {
  if (!ord.late.length && !ord.soon.length) return null;
  const late = ord.late.length > 0, o = late ? ord.late[0] : ord.soon[0];
  const left = orderStartMin(o) - ord.now;
  return (
    <button onClick={onOpen} style={{ width:"100%", border:"none", cursor:"pointer", fontFamily:"inherit", textAlign:"left",
      display:"flex", alignItems:"center", gap:10, padding:"10px 16px", background: late ? C.red : C.goldBg, color: late ? "#fff" : C.gold,
      borderBottom:`1px solid ${late ? C.red : C.border}` }}>
      <Ic n="order" size={20}/>
      <span style={{ flex:1, fontSize:13, lineHeight:1.4 }}>
        {late ? <><b>{ord.late.length} 筆訂單該開始製作了</b>・{o.time} {o.method} {o.cname}</>
              : <><b>{left} 分鐘後</b>要開始做 {o.cname} 的訂單（{o.time} {o.method}）{ord.soon.length > 1 ? `等 ${ord.soon.length} 筆` : ""}</>}
      </span>
      <Ic n="chev" size={16}/>
    </button>
  );
}

// 赤心幣資料(gmMe):首頁卡片、頂欄餘額共用;每 5 分鐘與切回 App 時更新
function useGameMe(user) {
  const [me, setMe] = useState(null);
  const refresh = () => { if (user) apiGet({ action:"gmMe", empId:user.id }, 0).then(r => { if (r && r.success) setMe(r.data); }); };
  useEffect(() => {
    if (!user) return; refresh();
    const t = setInterval(refresh, 5 * 60000);
    const vis = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [user && user.id]);
  return { me, refresh };
}

// v1.19 寵物上下班打招呼:打卡成功時跳出(上班/下班/隔 3 天以上回來)
function PetGreeting({ user, game }) {
  const [g, setG] = useState(null);
  useEffect(() => {
    const on = e => {
      const pet = game.me && game.me.pet; if (!pet) return;
      const nm = user.nick || user.name, last = game.me.lastWork, today = todayStr();
      const away = last ? Math.round((new Date(today) - new Date(last)) / 86400000) : 0;
      const txt = e.detail.kind === "out" ? "辛苦了，明天見" : away >= 3 ? `${nm}你回來了！好想你` : `${nm}早安！今天一起加油`;
      setG({ pet, txt }); clearTimeout(on.t); on.t = setTimeout(() => setG(null), 4200);
      game.refresh();
    };
    window.addEventListener("rh-pet-greet", on); return () => window.removeEventListener("rh-pet-greet", on);
  }, [game.me, user]);
  if (!g) return null;
  return (
    <div onClick={() => setG(null)} style={{ position:"fixed", left:"50%", bottom:"calc(96px + env(safe-area-inset-bottom))", transform:"translateX(-50%)", zIndex:450, display:"flex", alignItems:"center", gap:10, background:"#fffaf2", border:`1px solid ${C.border}`, borderRadius:18, padding:"8px 14px 8px 8px", boxShadow:"0 8px 24px rgba(0,0,0,.15)", maxWidth:"90%" }}>
      <style>{`@keyframes rhWob{0%,100%{transform:rotate(0)}25%{transform:rotate(-10deg)}75%{transform:rotate(10deg)}}`}</style>
      <div style={{ animation:"rhWob .6s 3" }}><PetSprite type={g.pet.type} stage={g.pet.stage} flavor={g.pet.flavor} size={56} /></div>
      <div><div style={{ fontSize:11.5, color:C.muted }}>{g.pet.name}</div><div style={{ fontSize:14.5, fontWeight:600, color:C.text }}>{g.txt}</div></div>
    </div>
  );
}

// 首頁:每日一題、生日祝福、收到的互動
const INTER_ICON = { cheer:"💪", like:"👍", nod:"🙇", smile:"😊", pat:"🐾" };
function GameHomeCards({ user, game, onOpenGame }) {
  const me = game.me;
  const [ans, setAns] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  if (!me) return null;
  const started = me.today >= me.params["測試版開始日"];
  const q = me.quiz;
  const answer = async (k) => {
    setBusy(true);
    const r = await apiPost({ action:"gmAnswer", empId:user.id, qid:q.question.id, answer:k }, 0);
    setBusy(false);
    if (r && r.success) { setAns({ ...r.data, choice:k }); game.refresh(); } else setNote((r && r.error) || "送出失敗");
  };
  const post = async (payload, msg) => { const r = await apiPost({ empId:user.id, ...payload }, 0); setNote(r && r.success ? msg : (r && r.error) || "送出失敗"); game.refresh(); setTimeout(()=>setNote(""), 2500); };
  const unread = (me.inbox || []).filter(x => x.unread);
  const shownQ = ans ? ans.question : q && q.question;
  const done = ans || (q && q.answered);
  return (
    <>
      {note && <div style={{ ...s.card, padding:"10px 14px", fontSize:13, background:C.accentBg, color:C.accent }}>{note}</div>}

      {(me.birthdays || []).map(b => b.id === user.id ? (
        <div key={b.id} style={{ ...s.card, background:"#fff0f6", border:"1px solid #f8c8dc", textAlign:"center" }}>
          <div style={{ fontSize:28 }}>🎂🎉</div>
          <div style={{ fontSize:16, fontWeight:600, marginTop:4 }}>生日快樂，{b.name}！</div>
          <div style={{ fontSize:12.5, color:C.muted, marginTop:4 }}>宇宙辦公室正在幫你開派對{b.from.length ? `・${b.from.length} 位夥伴送上祝福：${b.from.join("、")}` : ""}</div>
        </div>
      ) : (
        <div key={b.id} style={{ ...s.card, display:"flex", alignItems:"center", gap:12, background:"#fff0f6", border:"1px solid #f8c8dc" }}>
          <span style={{ fontSize:26 }}>🎂</span>
          <div style={{ flex:1 }}><div style={{ fontSize:14, fontWeight:600 }}>今天是 {b.name} 的生日！</div><div style={{ fontSize:11.5, color:C.muted }}>已有 {b.wishes} 位夥伴送上祝福</div></div>
          <button disabled={b.wished} onClick={()=>post({ action:"gmWish", to:b.id }, `已祝 ${b.name} 生日快樂！`)} style={{ border:"none", borderRadius:999, padding:"7px 12px", fontSize:12.5, background:b.wished ? C.warm : "#ff6fa8", color:b.wished ? C.muted : "#fff", cursor:b.wished ? "default" : "pointer", fontFamily:"inherit" }}>{b.wished ? "已祝福" : "送祝福"}</button>
        </div>
      ))}

      {started && q && !q.none && shownQ && (
        <div style={s.card}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <div style={{ ...s.sectionTitle, marginBottom:0 }}>每日一題・{shownQ.cat}</div>
            {!done && <span style={{ fontSize:11.5, color:C.gold }}>答對 <Coin n={1} plus size={11}/></span>}
          </div>
          <div style={{ fontSize:14.5, fontWeight:500, lineHeight:1.5, marginBottom:10 }}>{shownQ.text}</div>
          <div style={{ display:"grid", gap:6 }}>
            {["A","B","C","D"].filter(k => shownQ.options[k] !== "" && shownQ.options[k] != null).map(k => {
              const chosen = (ans ? ans.choice : q.choice) === k, right = done && shownQ.answer === k;
              return <button key={k} disabled={done || busy} onClick={()=>answer(k)} style={{ textAlign:"left", border:`1px solid ${right ? C.green : chosen ? C.red : C.border}`, background:right ? C.greenBg : chosen ? C.redBg : C.card, borderRadius:12, padding:"10px 12px", fontSize:13.5, cursor:done ? "default" : "pointer", fontFamily:"inherit", color:C.text }}>
                <b style={{ marginRight:8 }}>{k}</b>{shownQ.options[k]}</button>;
            })}
          </div>
          {done && <div style={{ fontSize:12.5, marginTop:10, color:(ans ? ans.correct : q.correct) ? C.green : C.red }}>
            {(ans ? ans.correct : q.correct) ? `答對了！+1 枚${ans && ans.bonus ? `，連續答對再 +${ans.bonus}` : ""}` : "答錯了，明天再挑戰"}
            {shownQ.explain && <div style={{ color:C.muted, marginTop:4 }}>{shownQ.explain}</div>}</div>}
        </div>
      )}

      {(me.gifts || []).length > 0 && (
        <div style={{ ...s.card, background:"#fff6e8" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
            <div style={{ ...s.sectionTitle, marginBottom:0 }}>收到 {me.gifts.length} 份禮物</div>
            <button onClick={()=>post({ action:"spGiftRead" }, "已收下")} style={{ border:"none", background:"none", color:C.muted, fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>收下</button>
          </div>
          {me.gifts.slice(0, 5).map((g, i) => <div key={i} style={{ fontSize:13, padding:"4px 0" }}>{g.icon} <b>{g.from}</b> 送你一份{g.item}</div>)}
        </div>
      )}

      {unread.length > 0 && (
        <div style={s.card}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
            <div style={{ ...s.sectionTitle, marginBottom:0 }}>收到 {unread.length} 個互動</div>
            <button onClick={()=>post({ action:"gmInboxRead" }, "已讀")} style={{ border:"none", background:"none", color:C.muted, fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>全部已讀</button>
          </div>
          {unread.slice(0, 5).map((x, i) => {
            const back = (me.sentToday || []).includes(x.from + "|" + x.type);
            return <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 0", borderTop:i ? `1px solid ${C.border}` : "none" }}>
              <span style={{ fontSize:20 }}>{INTER_ICON[x.type]}</span>
              <span style={{ flex:1, fontSize:13 }}><b>{x.fromName}</b> 對你{x.label}<span style={{ fontSize:11, color:C.light, marginLeft:6 }}>{x.time.slice(11,16)}</span></span>
              <button disabled={back} onClick={()=>post({ action:"gmInteract", to:x.from, type:x.type }, `已回禮給 ${x.fromName}`)} style={{ border:`1px solid ${C.accent}`, background:C.card, color:back ? C.light : C.accent, borderColor:back ? C.border : C.accent, borderRadius:999, padding:"4px 10px", fontSize:12, cursor:back ? "default" : "pointer", fontFamily:"inherit" }}>{back ? "已回禮" : "回禮"}</button>
            </div>;
          })}
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────
// APP ROOT
// ─────────────────────────────────────────────
export default function App(){
  // v1.25 記住登入（30 天）＋大隊長預覽（以等級檢視／夥伴視角，只能看不能改）
  const [realUser, setRealUser] = useState(() => { const a = authLoad(); if (a) AUTH.token = a.token; return a ? a.user : null; });
  const [reloginMsg, setReloginMsg] = useState("");
  const setUser = (u) => setRealUser(prev => { const n = typeof u === "function" ? u(prev) : u; if (n && n.token) { AUTH.token = n.token; authSave(n); } return n; });
  const [preview, setPreview] = useState(null);   // { mode:"role", role, type } | { mode:"as", user }
  const user = useMemo(() => !realUser ? null : !preview ? realUser
    : preview.mode === "role" ? { ...realUser, role: preview.role, weakPw:false }
    : { ...preview.user, token: realUser.token, weakPw:false }, [realUser, preview]);
  const uKey = user ? user.id + "|" + (preview ? (preview.mode === "role" ? "r" + preview.role + (preview.type || "") : "as") : "") : "";
  const logout = () => { authClear(); location.reload(); };
  useEffect(() => {
    AUTH.onRelogin = (msg) => { authClear(); setPreview(null); setRealUser(null); setReloginMsg(msg || "請重新登入"); };
    const a = authLoad(); if (!a) return;
    apiPost({ action:"auWho", token:a.token }, 1).then(r => { if (r && r.success && r.user) setUser(r.user); });   // 舊後端或沒網路：先用手機上的資料
  }, []);
  const [tab, setTab]         = useState("home");
  const [activeSeg, setActiveSeg] = useState(null); // {location, inTime} 進行中的班,null=無
  const [segRefreshKey, setSegRefreshKey] = useState(0); // 用來觸發 WorkTab/LeaveTab 重新查詢
  const [checklistDone, setChecklistDone] = useState({ open:false, close:false });
  const [staffInfo, setStaffInfo] = useState(null);
  const [announcements, setAnnouncements] = useState(() => cacheGet("ann") || []);
  const [schedule, setSchedule] = useState([]);
  const [salary, setSalary]   = useState([]);
  const [quota, setQuota]     = useState(null);
  const [locations, setLocations] = useState(() => cacheGet("loc") || {});
  const [workLoc, setWorkLoc] = useState("");
  const [loading, setLoading] = useState(false);
  const [rpCnt, setRpCnt] = useState(null);   // v1.24 門市回報待處理數
  const [homeTodo, setHomeTodo] = useState(null);   // v1.27 今天要處理（後端彙整）
  const loadRp = () => apiGet({ action:"rpCount", empId:user.id }, 0).then(r => r && r.success && setRpCnt(r)).catch(() => {});
  const [opsMeRaw, setOpsMe] = useState(null);   // v1.20:帳號類型、負責櫃位、加盟店、待辦數
  const opsMe = useMemo(() => preview && preview.mode === "role" && preview.type && opsMeRaw ? { ...opsMeRaw, type: preview.type } : opsMeRaw, [opsMeRaw, preview]);
  const startPreview = (pv) => {
    AUTH.viewAs = pv.mode === "as" ? pv.user.id : realUser.id;
    setOpsMe(null); setStaffInfo(null); setSchedule([]); setSalary([]); setQuota(null); setActiveSeg(null); setRpCnt(null);
    setPreview(pv); setTab("home"); window.scrollTo(0, 0);
  };
  const endPreview = () => { AUTH.viewAs = ""; setOpsMe(null); setPreview(null); setTab("info"); window.scrollTo(0, 0); };

  // 登入後載入資料
  useEffect(() => {
    if (!user) return;
    loadAllData();
    loadActiveSegment();
  }, [uKey]);
  useEffect(() => {
    if (!user || tab !== "home") return;
    apiGet({ action:"homeTodo" }, 0).then(r => setHomeTodo(r && r.success ? (r.data || []) : null));
  }, [uKey, tab]);

  useEffect(() => {
    if (!user || segRefreshKey === 0) return;   // 登入時已查過一次,這裡只處理之後的刷新
    loadActiveSegment();
  }, [segRefreshKey]);

  const loadActiveSegment = async () => {
    const res = await apiGet({ action:"getActiveSegment", empId:user.id, date:todayStr() });
    if (res.success) setActiveSeg(res.active);
  };

  // v1.20:公告改用 annFeed(依對象櫃位過濾＋已讀狀態);後端還沒更新時退回 getAnnouncements
  const loadAnn = () => apiGet({ action:"annFeed", empId:user.id }).then(r => {
    if (r && r.success) { setAnnouncements(r.data || []); cacheSet("ann", r.data || []); return; }
    return apiGet({ action:"getAnnouncements" }).then(r2 => { if (r2 && r2.success) { const d = r2.data || []; setAnnouncements(d); cacheSet("ann", d); } });
  });
  const loadAllData = async () => {
    setLoading(true);
    // 每個請求一回來就先更新畫面,不必等最慢的那一個
    const run = (req, fn) => req.then(res => { try { if (res && res.success) fn(res); } catch(e) { console.error(e); } });
    try {
      await Promise.all([
        run(apiGet({ action:"getStaffInfo", empId:user.id }), r => setStaffInfo(r.data)),
        loadAnn(),
        run(apiGet({ action:"getSchedule", empId:user.id, ym:ymStr() }), r => setSchedule(r.data || [])),
        run(apiGet({ action:"getSalary", empId:user.id }), r => setSalary(r.data || [])),
        run(apiGet({ action:"getQuota", empId:user.id, ym:ymStr() }), r => setQuota(r.data)),
        run(apiGet({ action:"getLocations" }), r => { const d = r.data || {}; setLocations(d); cacheSet("loc", d); }),
        run(apiGet({ action:"opsMe", empId:user.id }), r => setOpsMe(r)),
        run(apiGet({ action:"rpCount", empId:user.id }), r => setRpCnt(r)),
      ]);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const online = useOnline();
  const ord = useOrderAlerts(user);
  const game = useGameMe(user);
  const lastMain = useRef("home");   // v1.26 子頁返回到哪一個底部分頁
  const [gameTab, setGameTab] = useState("home");
  const [meView, setMeView] = useState("avatar");
  const [meKey, setMeKey] = useState(0);
  const openMe = (v) => { setMeView(v || "avatar"); setMeKey(k => k + 1); setTab("avatar"); };
  const setPetFirst = (b) => setMeView(b ? "pet" : "avatar");
  // v1.22：赤心幣拆開——商店/寵物/小遊戲/徽章→我和寵物；扭蛋→商店街；團隊→塔防；總覽＝我的錢包
  const openGame = (t2) => {
    if (["shop","pet","play","badge"].includes(t2)) return openMe(t2);
    if (t2 === "gacha") { setTab("street"); return; }
    if (t2 === "team") { setTab("tower"); return; }
    setGameTab("home"); setTab("game");
  };
  const [avatarCfg, setAvatarCfg] = useState(null);
  const inAvatar = tab === "avatar";
  useEffect(() => {
    if (!user || inAvatar) return;
    apiGet({ action: "getMyAvatar", empId: user.id }, 1).then(r => { if (r && r.success) setAvatarCfg(sanitizeAvatar(r.data && r.data.cfg)); }).catch(() => {});
  }, [user && user.id, inAvatar]);
  const openMePet = () => openMe("avatar");
  if (!user) return <><GlobalStyle/>{!online && <OfflineBar/>}<LoginScreen notice={reloginMsg} onLogin={u => { setReloginMsg(""); setUser(u); }} /></>;
  // v1.25 管理者（Lv.3 以上）密碼還是生日：先改密碼才能用
  if (!preview && realUser.role >= 3 && realUser.weakPw) return <><GlobalStyle/><ForcePwScreen user={realUser} onDone={() => setUser(u => ({ ...u, weakPw:false }))} onLogout={logout} /></>;
  const roleName = r => r>=5?"大隊長":r===4?"總經理":r===3?"管理者":r===2?"分隊長":"夥伴";
  const previewLabel = !preview ? "" : preview.mode === "role" ? `Lv.${preview.role} ${roleName(preview.role)}${preview.type && preview.type !== "員工" ? "（" + preview.type + "）" : ""}` : `${user.name}（Lv.${user.role} ${roleName(user.role)}）`;

  // v1.26 底部選單：首頁｜出勤｜我的｜樂園｜管理（管理 Lv.2 以上）
  const PARENT = { orders:"punch", rp:"punch", mat:"punch", sop:"punch", audit:"punch",
    myshift:"info", guide:"info", vote:"info", health:"info",
    universe:"park", avatar:"park", game:"park", arena:"park", tower:"park", street:"park", rules:"park", about:"info",
    schedule_mgr:"manage", admin:"manage", batter:"manage", locs:"manage", staff:"manage", ann:"manage", price:"manage", pnl:"manage", foodsafe:"manage", boost:"manage" };
  const SUB = Object.keys(PARENT);
  const partner = opsMe && opsMe.type === "合作夥伴";
  const franchiseOwner = user.role < 3 && !!(opsMe && opsMe.franchiseLocs && opsMe.franchiseLocs.length);
  const navItems = partner ? [
    { id:"home",  icon:"home",  label:"首頁" },
    { id:"mat",   icon:"order", label:"叫貨" },
    { id:"rp",    icon:"tool",  label:"回報" },
    { id:"info",  icon:"user",  label:"我的" },
  ] : [
    { id:"home",   icon:"home",  label:"首頁" },
    { id:"punch",  icon:"clock", label:"出勤", badge: ord.open.length, red: ord.late.length > 0 },
    { id:"info",   icon:"user",  label:"我的" },
    { id:"park",   icon:"park",  label:"樂園" },
    ...(user.role >= 2 ? [{ id:"manage", icon:"mng", label:"管理", badge: (rpCnt?.pending || 0) + (user.role >= 3 ? (opsMe?.matPending || 0) : 0), red: rpCnt?.urgent > 0 }] : []),
  ];
  if (!SUB.includes(tab)) lastMain.current = tab;
  if (SUB.includes(tab) && !navItems.some(n => n.id === lastMain.current)) lastMain.current = PARENT[tab];
  const navActive = partner ? tab : SUB.includes(tab) ? lastMain.current : tab;
  const goBack = () => setTab(lastMain.current && lastMain.current !== tab ? lastMain.current : (PARENT[tab] || "home"));
  const subTitle = { vote:"夥伴投票", guide:"薪資制度說明", schedule_mgr:"排班管理", myshift:"我的班表", admin:"管理儀表板", universe:"宇宙辦公室", avatar:"我和寵物", orders:"訂單", mat:"物料需求", pnl:"門市損益", locs:"櫃位管理", staff:"夥伴資料", ann:"發公告／LINE 推播", price:"供貨價格與應收", batter:"麵糊用量", rp:"請總部處理", game:"我的錢包", arena:"對戰", tower:"百貨櫃位塔防戰", street:"夥伴商店街", sop:"SOP 教學", audit:"稽查資料", health:"我的健康檢查", foodsafe:"食安管理", rules:"赤心幣規則", boost:"赤心幣加倍活動", about:"關於紅玉滿" }[tab];

  const baseSchedule = schedule.find(s => s.date === todayStr());
  const effLoc = activeSeg?.location || workLoc || baseSchedule?.location || "";
  const todaySchedule = effLoc ? { ...(baseSchedule||{ id:"", start:"", end:"" }), location: effLoc } : baseSchedule;

  return (
    <div style={s.app}>
      <GlobalStyle/>
      <PetGreeting user={user} game={game} />
      {!online && <OfflineBar/>}
      {/* TOP BAR(＋訂單提醒列,一起固定在頂端) */}
      <div style={{ position:"sticky", top:0, zIndex:50 }}>
      {preview && <div role="status" style={{ background:C.red, color:"#fff", padding:"7px 12px 7px 16px", fontSize:12.5, display:"flex", alignItems:"center", gap:8 }}>
        <span style={{ flex:1, lineHeight:1.4 }}>👀 預覽中：<b>{previewLabel}</b><span style={{ opacity:.85 }}>・只能看，不能修改</span></span>
        <button onClick={endPreview} style={{ border:"1px solid rgba(255,255,255,.7)", background:"transparent", color:"#fff", borderRadius:999, padding:"4px 12px", fontSize:12.5, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>結束預覽</button>
      </div>}
      <div style={{ background:"rgba(248,245,240,.94)", backdropFilter:"blur(8px)",
                    padding:"12px 18px", display:"flex", justifyContent:"space-between", alignItems:"center",
                    borderBottom:`1px solid ${C.border}` }}>
        <div>
          <div style={{ fontSize:11, color:C.muted, letterSpacing:2 }}>紅玉滿赤心雞蛋糕</div>
          <div style={{ fontSize:16, fontWeight:600, marginTop:1 }}>
            {user.name}
            <span style={{ fontSize:11, fontWeight:400, color:C.muted, marginLeft:8 }}>
              {roleName(user.role)}
            </span>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {loading && <div style={{ fontSize:11, color:C.muted }}>同步中…</div>}
          {game.me && !partner && avatarCfg && <button onClick={openMePet} aria-label="我和寵物" style={{ border:`1px solid ${C.border}`, background:C.card, borderRadius:999, padding:"0 8px", height:30, cursor:"pointer", display:"flex", alignItems:"center", overflow:"hidden" }}><MeBuddy cfg={avatarCfg} pet={game.me.pet} scale={1} /></button>}
          {game.me && !partner && <button onClick={()=>openGame("home")} aria-label="我的錢包" style={{ border:`1px solid ${C.border}`, background:C.card, borderRadius:999, padding:"4px 10px", fontSize:12.5, cursor:"pointer", fontFamily:"inherit", color:C.text }}><Coin n={game.me.balance} size={12}/></button>}
          <div style={{ width:38, height:38, borderRadius:19, background:C.accentBg, color:C.accent,
                        border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:15, fontWeight:600 }}>{user.avatar}</div>
        </div>
      </div>

      {tab!=="orders" && <OrderBanner ord={ord} onOpen={()=>setTab("orders")} />}
      </div>

      {/* CONTENT */}
      <div key={tab} className="rh-page" style={{ padding:"14px 14px 96px" }}>
        {SUB.includes(tab) && !partner && <SubHeader title={subTitle} onBack={goBack} />}
        {partner && tab==="home" && <PartnerHome user={user} me={opsMe} announcements={announcements} C={C} s={s} apiGet={apiGet} apiPost={apiPost} onAnnChanged={loadAnn} onOpenMaterials={()=>setTab("mat")} onOpenReport={()=>setTab("rp")} />}
        {partner && tab==="info" && <PartnerInfo user={user} onPwChanged={()=>setUser(u => ({ ...u, weakPw:false }))} onLogout={logout} />}
        {tab==="rp" && <ReportPage user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} me={opsMe} locations={locations} todayStr={todayStr} uploadPhoto={uploadPhoto} onChanged={loadRp} />}
        {tab==="mat" && <MaterialsPage user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} locations={locations} me={opsMe} todayStr={todayStr} />}
        {!partner && tab==="home"  && (loading && !staffInfo
                          ? <HomeSkeleton/>
                          : <HomeTab user={user} staffInfo={staffInfo} announcements={announcements}
                                   activeSeg={activeSeg} checklistDone={checklistDone}
                                   todaySchedule={todaySchedule} quota={quota} schedule={schedule}
                                   showStats={!opsMe || (opsMe.type === "員工" && !(opsMe.franchiseLocs && opsMe.franchiseLocs.length) && user.role < 4)}
                                   todoExtra={homeTodo} onGo={t => setTab(t)}
                                   onOpenVotes={()=>setTab("vote")} onOpenUniverse={()=>setTab("universe")} onOpenOrders={()=>setTab("orders")} orderInfo={ord} game={game} onOpenGame={openGame} onOpenInfo={()=>setTab("info")}
                                   onboard={<>
                                     <AnnInbox user={user} list={announcements} apiPost={apiPost} C={C} s={s} onChanged={loadAnn} />
                                     {!homeTodo && user.role>=2 && rpCnt?.pending > 0 && <button onClick={()=>setTab("rp")} style={{ ...s.card, width:"100%", display:"flex", alignItems:"center", gap:10, cursor:"pointer", fontFamily:"inherit", textAlign:"left", color:C.text, border: rpCnt.urgent ? `1px solid ${C.red}` : s.card.border, background: rpCnt.urgent ? C.redBg : C.card }}><span style={{ fontSize:22 }}>{rpCnt.urgent ? "🚨" : "🔧"}</span><span style={{ flex:1 }}><b style={{ fontSize:14 }}>門市回報待處理 {rpCnt.pending} 件</b>{rpCnt.urgent ? <span style={{ display:"block", fontSize:12, color:C.red }}>其中 {rpCnt.urgent} 件緊急</span> : null}</span><Ic n="chev" size={18} color={C.light}/></button>}
                                     {user.role>=2 && <OnboardCard user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} compact />}
                                   </>} />)}
        {!partner && tab==="punch" && <PunchTab user={user} activeSeg={activeSeg} todaySchedule={todaySchedule}
                                   locations={locations} workLoc={workLoc} setWorkLoc={setWorkLoc}
                                   checklistDone={checklistDone} setChecklistDone={setChecklistDone}
                                   onWorkChange={()=>setSegRefreshKey(k=>k+1)}
                                   onLeaveChange={()=>{ setSegRefreshKey(k=>k+1); setWorkLoc(""); }} />}
        {!partner && tab==="punch" && <div style={{ marginTop:18 }}>
          <div style={s.sectionTitle}>門市工作</div>
          <ListItem icon="order" title="訂單" desc={ord.open.length ? `今日 ${ord.open.length} 筆待處理${ord.late.length ? `，${ord.late.length} 筆該開始做了` : ""}` : "自取／外送訂單：新增、查看、換狀態"} badge={ord.open.length || null} badgeRed={ord.late.length > 0} onClick={()=>setTab("orders")}/>
          <ListItem icon="order" title="叫貨（物料需求）" desc="原物料、包材、製作器具、清潔用品…" onClick={()=>setTab("mat")}/>
          <ListItem icon="tool" title="請總部處理" desc="機器報修、水電場地、人力支援、客訴、金流…" badge={(user.role>=2 ? null : rpCnt?.mineOpen) || null} onClick={()=>setTab("rp")}/>
          <ListItem icon="book" title="SOP 教學" desc="開店、收店、攪拌麵糊、烤雞蛋糕" onClick={()=>setTab("sop")}/>
          <ListItem icon="shield" title="稽查資料" desc="食品業者登錄字號、保險、在班夥伴體檢狀態" onClick={()=>setTab("audit")}/>
        </div>}
        {!partner && tab==="info"  && <InfoTab user={user} staffInfo={staffInfo} salary={salary}
                                   schedule={schedule} announcements={announcements} onRefresh={loadAllData}
                                   onPwChanged={()=>setUser(u => ({ ...u, weakPw:false }))} onLogout={logout}
                                   viewAs={realUser.role>=5 && !preview ? <ViewAsCard onStart={startPreview} /> : null}
                                   links={<>
                                     <ListItem icon="cal" title="我的班表" desc="查看班表、填下個月空檔、換班與認領空班" onClick={()=>setTab("myshift")}/>
                                     <ListItem icon="shield" title="我的健康檢查" desc="上傳體檢表、看到期日（只有你和管理者看得到）" onClick={()=>setTab("health")}/>
                                     <ListItem icon="vote" title="夥伴投票" desc="查看進行中的投票" onClick={()=>setTab("vote")}/>
                                     <ListItem icon="book" title="薪資制度說明" onClick={()=>setTab("guide")}/>
                                     <ListItem icon="home" title="關於紅玉滿" desc="品牌精神、名字的由來、品牌故事" onClick={()=>setTab("about")}/>
                                   </>} />}
        {!partner && tab==="park" && (
          <div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
              <GameTile title="我和寵物" sub="造型・寵物・商店・小遊戲・徽章" art={<MeBuddy cfg={avatarCfg} pet={game.me && game.me.pet} scale={1.25} />} onClick={openMePet}/>
              <GameTile title="宇宙辦公室" sub="看看夥伴在哪個櫃位" icon="cube" onClick={()=>setTab("universe")}/>
              <GameTile title="對戰" sub="和夥伴切磋" icon="sword" onClick={()=>setTab("arena")}/>
              <GameTile title="櫃位塔防戰" sub="升級塔・營業額排行" icon="tower" onClick={()=>setTab("tower")}/>
              <GameTile title="夥伴商店街" sub="逛店・開店・扭蛋機" icon="home" onClick={()=>setTab("street")}/>
              <GameTile title="我的錢包" sub="赤心幣餘額與明細" icon="coin" onClick={()=>openGame("home")}/>
            </div>
            <ListItem icon="book" title="赤心幣規則" desc="怎麼賺、加倍怎麼算、怎麼用、你現在套用中的加倍" onClick={()=>setTab("rules")}/>
          </div>
        )}
        {!partner && tab==="manage" && user.role>=2 && (
          <div>
            <div style={s.sectionTitle}>排班與營運</div>
            <ListItem icon="cal" title="排班管理" desc="依個人或櫃位排班、核准換班、打卡對帳" onClick={()=>setTab("schedule_mgr")}/>
            <ListItem icon="chart" title="管理儀表板" onClick={()=>setTab("admin")}/>
            <ListItem icon="order" title="麵糊用量" desc="平日／假日用量、還夠幾天、建議叫貨、活動預估" onClick={()=>setTab("batter")}/>
            <ListItem icon="tool" title="門市回報處理" desc="機器報修、水電場地、人力支援…" badge={rpCnt?.pending || null} badgeRed={rpCnt?.urgent > 0} onClick={()=>setTab("rp")}/>
            <ListItem icon="order" title="叫貨單" desc="各櫃位物料需求" badge={user.role>=3 && opsMe?.matPending ? opsMe.matPending : null} onClick={()=>setTab("mat")}/>
            {opsMe?.franchiseLocs?.length > 0 && <ListItem icon="chart" title="門市損益" desc="加盟店營收、成本、薪資、淨利（每月結帳）" onClick={()=>setTab("pnl")}/>}
            <ListItem icon="shield" title="食安管理" desc={user.role>=3 ? "冰箱溫度紀錄、櫃位證照、體檢確認" : "冰箱溫度紀錄"} onClick={()=>setTab("foodsafe")}/>
            {user.role>=3 && <ListItem icon="coin" title="赤心幣加倍活動" desc="颱風照常營業、開幕、旺季…開一個加倍期間" onClick={()=>setTab("boost")}/>}
            {!franchiseOwner && user.role>=(opsMe?.annMinRole || 3) && <ListItem icon="vote" title="發公告／LINE 推播" desc="發布公告，同步推到 LINE 群組" onClick={()=>setTab("ann")}/>}
            {user.role>=3 && <>
              <div style={{ ...s.sectionTitle, marginTop:16 }}>人員與設定</div>
              <ListItem icon="user" title="夥伴資料" desc="新增夥伴、改權限與負責櫃位、到職檢查" badge={opsMe?.onboardPending || null} onClick={()=>setTab("staff")}/>
              <ListItem icon="home" title="櫃位管理" desc="新增、改名、開關、停用櫃位" onClick={()=>setTab("locs")}/>
              <ListItem icon="coin" title="供貨價格與應收" desc="物料單價、常用物料、加盟店應收" onClick={()=>setTab("price")}/>
            </>}
          </div>
        )}
        {tab==="rules" && <RulesPage user={user} apiGet={apiGet} C={C} s={s} loc={activeSeg?.location || ""} onOpenLedger={()=>openGame("home")} />}
        {tab==="boost" && user.role>=3 && <BoostAdmin user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} locations={locations} todayStr={todayStr} />}
        {tab==="about" && <BrandPage C={C} s={s} locations={locations} />}
        {tab==="sop" && <SopPage user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} uploadPhoto={uploadPhoto} />}
        {tab==="audit" && <AuditPage user={user} apiGet={apiGet} C={C} s={s} locations={locations} defaultLoc={effLoc} />}
        {tab==="health" && <HealthPage user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} compressPhoto={compressPhoto} todayStr={todayStr} />}
        {tab==="foodsafe" && user.role>=2 && <FoodSafetyAdmin user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} uploadPhoto={uploadPhoto} todayStr={todayStr} />}
        {tab==="guide" && <GuideTab />}
        {tab==="admin" && user.role>=2 && <AdminTab user={user} onOpenBatter={()=>setTab("batter")} />}
        {tab==="batter" && user.role>=2 && <BatterPage user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} todayStr={todayStr} />}
        {tab==="schedule_mgr" && user.role>=2 && <ScheduleManager user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} todayStr={todayStr} />}
        {tab==="myshift" && <MyShifts user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} todayStr={todayStr} />}
        {tab==="universe" && (
          <Suspense fallback={<div style={{ ...s.card, textAlign:"center", color:C.muted }}>宇宙辦公室載入中…</div>}>
            <UniverseTab user={user} apiGet={apiGet} apiPost={apiPost} todayStr={todayStr} C={C} s={s} onEditAvatar={()=>openMe("avatar")} onOpenMaterials={()=>setTab("mat")} />
          </Suspense>
        )}
        {tab==="orders" && <OrdersTab user={user} apiGet={apiGet} apiPost={apiPost} locations={locations} defaultLoc={effLoc} todayStr={todayStr} C={C} s={s} alerts={ord} />}
        {tab==="avatar" && <MePet key={meKey} user={user} apiGet={apiGet} apiPost={apiPost} todayStr={todayStr} C={C} s={s} initial={meView} onOpenShop={()=>openMe("shop")} onChanged={game.refresh} />}
        {tab==="pnl" && <PnlPage user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} todayStr={todayStr} />}
        {tab==="locs" && user.role>=3 && <LocManager user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} />}
        {tab==="staff" && user.role>=3 && <StaffManager user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} locations={locations} />}
        {tab==="ann" && <AnnouncePage user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} />}
        {tab==="price" && user.role>=3 && <PricePage user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} todayStr={todayStr} />}
        {tab==="arena" && <ArenaTab user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} />}
        {tab==="tower" && <>
          <TowerTab user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} />
          <div style={{ ...s.sectionTitle, marginTop:18 }}>本月櫃位營業額排行</div>
          <GameTab user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} onlyTab="team" onNav={openGame} onChanged={game.refresh} />
        </>}
        {tab==="street" && <>
          <GachaBooth user={user} C={C} s={s} onChanged={game.refresh} />
          <ShopStreetTab user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} />
        </>}
        {tab==="game" && <GameTab key="wallet" user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} onlyTab="home" onNav={openGame} onEditAvatar={()=>openMe("avatar")} onChanged={game.refresh} />}
        {tab==="vote"  && <VotesTab user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} />}
      </div>

      {/* BOTTOM NAV */}
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)",
                    width:"100%", maxWidth:480, background:"rgba(255,253,250,.94)", backdropFilter:"blur(10px)",
                    borderTop:`1px solid ${C.border}`, display:"grid", gridTemplateColumns:`repeat(${navItems.length},1fr)`,
                    padding:"6px 8px calc(10px + env(safe-area-inset-bottom))", zIndex:100, boxSizing:"border-box" }}>
        {navItems.map(n => (
          <button key={n.id} onClick={()=>setTab(n.id)} aria-current={navActive===n.id?"page":undefined} style={{
            display:"flex", flexDirection:"column", alignItems:"center", gap:2, padding:"6px 0",
            background:"none", border:"none", cursor:"pointer", fontFamily:"inherit",
            color: navActive===n.id ? C.accent : C.muted, transition:"color .15s",
          }}>
            <span style={{ position:"relative", display:"flex" }}>
              <Ic n={n.icon} size={23} sw={navActive===n.id?1.9:1.6}/>
              {n.badge > 0 && <span style={{ position:"absolute", top:-4, right:-9, minWidth:17, height:17, padding:"0 4px", boxSizing:"border-box",
                borderRadius:9, background: n.red ? C.red : C.accent, color:"#fff", fontSize:10.5, fontWeight:600, lineHeight:"17px", textAlign:"center",
                border:"1.5px solid #fffdfa" }}>{n.badge}</span>}
            </span>
            <span style={{ fontSize:11, fontWeight:500 }}>{n.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function OfflineBar() {
  return <div style={{ position:"sticky", top:0, zIndex:200, background:C.red, color:"#fff", textAlign:"center",
                       fontSize:12.5, padding:"6px 12px" }}>目前沒有網路連線，部分功能暫時無法使用</div>;
}

// 打卡:上班資料 / 下班 合併為同一頁
function PunchTab(p) {
  const { activeSeg, checklistDone } = p;
  const segKey = activeSeg ? activeSeg.location + "|" + activeSeg.inTime : "";
  const pick = () => activeSeg ? (checklistDone.open ? "leave" : "work") : "work";
  const [mode, setMode] = useState(pick);
  useEffect(() => { setMode(pick()); }, [segKey]);
  const eff = activeSeg ? mode : "work";
  const Seg = ({ id, label }) => (
    <button onClick={()=>setMode(id)} style={{ flex:1, padding:"9px 0", border:"none", borderRadius:999, cursor:"pointer",
      fontFamily:"inherit", fontSize:13.5, fontWeight:500,
      background: eff===id ? C.text : "transparent", color: eff===id ? "#fff" : C.muted, transition:"all .15s" }}>{label}</button>
  );
  return (
    <div>
      {activeSeg && (
        <div style={{ display:"flex", background:C.card, border:`1px solid ${C.border}`, borderRadius:999, padding:3, marginBottom:12 }}>
          <Seg id="work" label="上班資料"/><Seg id="leave" label="下班"/>
        </div>
      )}
      {eff==="work"
        ? <WorkTab user={p.user} activeSeg={activeSeg} todaySchedule={p.todaySchedule}
                   locations={p.locations} workLoc={p.workLoc} setWorkLoc={p.setWorkLoc}
                   checklistDone={checklistDone} setChecklistDone={p.setChecklistDone}
                   onSegmentChange={p.onWorkChange} />
        : <LeaveTab user={p.user} activeSeg={activeSeg} locations={p.locations}
                    checklistDone={checklistDone} setChecklistDone={p.setChecklistDone}
                    onSegmentChange={p.onLeaveChange} />}
    </div>
  );
}

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────
function LoginScreen({ onLogin, notice }) {
  const [about, setAbout]   = useState(false);
  const [phone, setPhone]   = useState("");
  const [pw, setPw]         = useState("");
  const [err, setErr]       = useState(notice || "");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!phone || !pw) { setErr("請填入帳號與密碼"); return; }
    setErr(""); setLoading(true);
    try {
      // v1.18:走 POST,密碼不會出現在網址;後端還沒更新時(回「未知的動作」)退回舊的 GET
      let res = await apiPost({ action:"login", phone, password:pw }, 1);
      if (res && !res.success && /未知的動作/.test(res.error || "")) res = await apiGet({ action:"login", phone, password:pw });
      if (res.success) {
        onLogin(res.user);
      } else {
        setErr(res.error || "帳號或密碼錯誤");
      }
    } catch(e) {
      setErr("連線失敗，請檢查網路");
    }
    setLoading(false);
  };

  return (
    <div style={{ ...s.app, display:"flex", flexDirection:"column", minHeight:"100vh" }}>
      <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center", padding:"28px 28px 36px" }}>
        <div style={{ textAlign:"center", marginBottom:34 }}>
          <img src="/logo_ink.png" alt="紅玉滿赤心雞蛋糕" style={{ width:"74%", maxWidth:300, marginBottom:14 }}/>
          <div style={{ fontSize:12, color:C.muted, letterSpacing:4 }}>夥伴系統</div>
          <LoginSlogan C={C} />
        </div>

        <div style={{ ...s.card, padding:22, borderRadius:22 }}>
          <div style={{ marginBottom:16 }}>
            <label style={s.label}>帳號(預設為手機號碼)</label>
            <input value={phone} onChange={e=>setPhone(e.target.value)} inputMode="tel" autoComplete="username"
              placeholder="請輸入帳號" style={s.input}/>
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={s.label}>密碼(預設為夥伴生日，如6月7日為0607)</label>
            <input type="password" value={pw} onChange={e=>setPw(e.target.value)} autoComplete="current-password"
              placeholder="請輸入密碼"
              onKeyDown={e=>e.key==="Enter"&&handleLogin()} style={s.input}/>
          </div>
          {err && <div style={{ color:C.red, fontSize:12.5, textAlign:"center", marginBottom:12 }}>{err}</div>}
          <button onClick={handleLogin} disabled={loading}
            style={{ ...s.btn("primary"), opacity:loading?.7:1 }}>
            {loading ? "驗證中…" : "登入"}
          </button>
        </div>

        <div style={{ textAlign:"center", marginTop:18, fontSize:11.5, color:C.muted, lineHeight:1.7 }}>
          忘記或要修改密碼，請聯絡門市總監、營運總監
        </div>
        <button onClick={() => setAbout(true)} style={{ display:"block", margin:"14px auto 0", border:"none", background:"none", color:C.accent, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>關於紅玉滿 ›</button>
        {about && <div style={{ position:"fixed", inset:0, background:C.bg, zIndex:300, overflowY:"auto", padding:"14px 14px 40px" }}>
          <div style={{ maxWidth:480, margin:"0 auto" }}>
            <button onClick={() => setAbout(false)} style={{ border:"none", background:"none", color:C.muted, fontSize:14, cursor:"pointer", padding:"6px 0 10px", fontFamily:"inherit" }}>‹ 回到登入</button>
            <BrandPage C={C} s={s} locations={null} />
          </div>
        </div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// HOME TAB
// ─────────────────────────────────────────────
function HomeTab({ user, staffInfo, announcements, activeSeg, checklistDone, todaySchedule, quota, schedule, showStats = true, todoExtra, onGo, onOpenVotes, onOpenUniverse, onOpenOrders, orderInfo, game, onOpenGame, onOpenInfo, onboard }) {
  const time = useTime();
  // 今日壽星(後端尚未部署 getTodayBirthdays 時會安靜略過,不影響首頁)
  const [bdays, setBdays] = useState([]);
  useEffect(() => {
    let on = true;
    apiGet({ action:"getTodayBirthdays", date:todayStr() }, 0).then(r => {
      if (on && r && r.success) setBdays(r.data || []);
    });
    return () => { on = false; };
  }, []);
  // 今日訂單提醒(資料由 App 統一輪詢,見 useOrderAlerts)
  const openOrds = orderInfo ? orderInfo.open : [], lateOrds = orderInfo ? orderInfo.late : [], nextOrd = orderInfo ? orderInfo.next : null;
  const checkupDays = staffInfo?.checkupExpiry ? daysUntil(staffInfo.checkupExpiry) : 999;
  const urgentAnn = announcements.filter(a => a.urgent);

  const todos = [
    todaySchedule && todaySchedule.start && !activeSeg && !checklistDone.close && { icon:"⏱", label:`今天 ${todaySchedule.start} 要上班，記得打卡`, color:C.accent },
    activeSeg && !checklistDone.open && { icon:"📋", label:"開店盤點尚未完成", color:C.gold },
    activeSeg && { icon:"🌙", label:`「${activeSeg.location}」尚未下班`, color:C.blue },
    !todoExtra && checkupDays <= 30 && checkupDays > 0 && { icon:"🩺", label:`體檢將於 ${checkupDays} 天後到期`, color:C.red },
    ...(todoExtra || []).map(x => ({ icon:x.icon, label:x.text, color: x.red ? C.red : C.gold, onClick: x.tab && onGo ? () => onGo(x.tab) : undefined })),
    user.weakPw && { icon:"🔒", label:"密碼還是生日，建議改一組自己的（點這裡）", color:C.gold, onClick:onOpenInfo },
  ].filter(Boolean);

  const Bar = ({ label, cur, max, unit, color }) => {
    const pct = Math.min(100, Math.round(cur / max * 100));
    const ok = cur >= max;
    return (
      <div style={{ marginBottom:10 }}>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
          <span style={{ color:C.muted }}>{label}</span>
          <span style={{ fontWeight:600, color: ok ? C.green : color }}>
            {cur} / {max} {unit} {ok ? "✅" : ""}
          </span>
        </div>
        <div style={{ height:6, background:C.border, borderRadius:4, overflow:"hidden" }}>
          <div style={{ width:pct+"%", height:"100%", borderRadius:4,
            background: ok ? C.green : color,
            transition:"width .4s" }}/>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Clock */}
      <TimeHeader
        sub={todaySchedule ? <>{todaySchedule.location} · {todaySchedule.start}–{todaySchedule.end}</> : "今日無排班"}
        tag={todaySchedule && (todaySchedule.type==="double"||todaySchedule.type==="triple") &&
          <span style={{ marginLeft:8, fontSize:10.5, background:C.accentBg, color:C.accent,
                         padding:"1px 8px", borderRadius:10 }}>{todaySchedule.type==="triple"?"三人班":"雙人班"}</span>} />

      {/* 今日壽星 */}
      {bdays.length > 0 && (() => {
        const mine = bdays.includes(user.name);
        const others = bdays.filter(n => n !== user.name);
        return (
          <div style={{ ...s.card, display:"flex", alignItems:"center", gap:12,
                        background:C.accentBg,
                        border:`1px solid ${C.border}` }}>
            <span style={{ fontSize:26 }}>🎂</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:600, color:C.accent }}>
                {mine ? `${user.name}，生日快樂！🎉` : "今日壽星"}
              </div>
              <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>
                {mine
                  ? (others.length ? `今天也是 ${others.join("、")} 的生日` : "紅玉滿全體夥伴祝你有個甜甜的一天")
                  : `${others.join("、")} 今天生日，記得送上祝福`}
              </div>
            </div>
          </div>
        );
      })()}

      {onboard}

      {/* Todos */}
      {todos.length > 0 && (
        <div style={{ marginBottom:12 }}>
          <div style={s.sectionTitle}>今天要處理</div>
          {todos.map((t,i) => (
            <div key={i} onClick={t.onClick} style={{ ...s.card, padding:"10px 14px", marginBottom:8,
                                   borderLeft:`3px solid ${t.color}`, cursor:t.onClick ? "pointer" : "default",
                                   display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:18 }}>{t.icon}</span>
              <span style={{ fontSize:13, flex:1 }}>{t.label}</span>
              {t.onClick && <Ic n="chev" size={16} color={C.light}/>}
            </div>
          ))}
        </div>
      )}

      {/* 赤心幣:生日、每日一題、收到的互動 */}
      {game && <GameHomeCards user={user} game={game} onOpenGame={onOpenGame} />}

      {/* 今日訂單提醒 */}
      {onOpenOrders && openOrds.length > 0 && (
        <button onClick={onOpenOrders} style={{ ...s.card, width:"100%", display:"flex", alignItems:"center", gap:12,
          cursor:"pointer", textAlign:"left", fontFamily:"inherit", padding:"12px 14px", color:C.text,
          borderLeft:`3px solid ${lateOrds.length ? C.red : C.accent}`, background: lateOrds.length ? C.redBg : C.card }}>
          <span style={{ color: lateOrds.length ? C.red : C.accent, display:"flex" }}><Ic n="order"/></span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:600 }}>今日訂單 {openOrds.length} 筆待處理{lateOrds.length ? `，${lateOrds.length} 筆該開始做了` : ""}</div>
            <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>下一筆 {nextOrd.time} {nextOrd.method}・{nextOrd.cname}</div>
          </div>
          <Ic n="chev" size={18} color={C.light}/>
        </button>
      )}

      {/* 宇宙辦公室入口 */}
      {onOpenUniverse && (
        <button onClick={onOpenUniverse} style={{ ...s.card, width:"100%", display:"flex", alignItems:"center", gap:12,
          cursor:"pointer", textAlign:"left", fontFamily:"inherit", padding:"12px 14px", color:C.text }}>
          <span style={{ color:C.accent, display:"flex" }}><Ic n="cube"/></span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:600 }}>紅玉滿宇宙辦公室</div>
            <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>看看夥伴們現在在哪個櫃位上班</div>
          </div>
          <Ic n="chev" size={18} color={C.light}/>
        </button>
      )}

      {/* 夥伴投票入口 */}
      {onOpenVotes && (
        <button onClick={onOpenVotes} style={{ ...s.card, width:"100%", display:"flex", alignItems:"center", gap:12,
          cursor:"pointer", textAlign:"left", fontFamily:"inherit", padding:"12px 14px" }}>
          <span style={{ color:C.accent, display:"flex" }}><Ic n="vote"/></span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:600, color:C.text }}>夥伴投票</div>
            <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>查看進行中的投票、送出你的選擇</div>
          </div>
          <Ic n="chev" size={18} color={C.light}/>
        </button>
      )}

      {/* Urgent announcements */}
      {urgentAnn.length > 0 && (
        <div style={{ marginBottom:12 }}>
          <div style={s.sectionTitle}>重要公告</div>
          {urgentAnn.map(a => (
            <div key={a.id} style={{ ...s.card, borderLeft:`3px solid ${C.accent}`, padding:"12px 14px" }}>
              <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>{a.title}</div>
              <div style={{ fontSize:12, color:C.muted, lineHeight:1.6 }}>{a.body}</div>
              <div style={{ fontSize:10, color:C.light, marginTop:4 }}>{a.date}</div>
            </div>
          ))}
        </div>
      )}

      {/* 本月達標進度 */}
      {showStats && quota && (
        <div style={{ ...s.card, marginBottom:12 }}>
          <div style={s.sectionTitle}>📊 本月達標進度({quota.identity})</div>
          <Bar label="工時" cur={quota.hours} max={quota.hourTarget} unit="hr" color={C.gold} />
          <Bar label="假日出勤" cur={quota.holidayDays} max={quota.holidayTarget} unit="天" color={C.blue} />
          {quota.hours >= quota.hourTarget && quota.holidayDays >= quota.holidayTarget
            ? <div style={{ fontSize:12, color:C.green, fontWeight:600, textAlign:"center", marginTop:4 }}>
                🎉 本月已達標!年終資格保住了
              </div>
            : <div style={{ fontSize:11, color:C.muted, textAlign:"center", marginTop:4 }}>
                還差 {Math.max(0, quota.hourTarget - quota.hours).toFixed(1)}hr
                {quota.holidayDays < quota.holidayTarget && ` + ${quota.holidayTarget - quota.holidayDays}天假日班`}
                ,加油!💪
              </div>}
        </div>
      )}

      {/* Quick stats（v1.25 縮成一列；加盟主、總經理以上不顯示） */}
      {showStats && <div style={{ ...s.card, display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:4, padding:"10px 6px" }}>
        {[
          { label:"累計工時", value: staffInfo ? `${staffInfo.accumulated}h` : "—", color:C.gold },
          { label:"特休剩餘", value: staffInfo ? `${staffInfo.leaveBalance ?? "—"}天` : "—", color:C.green },
          { label:"技能津貼", value: user.skillLevel !== undefined ? `+$${user.skillLevel}` : "—", color:C.blue },
          { label:"貢獻津貼", value: user.contribLevel !== undefined ? `+$${user.contribLevel}` : "—", color:C.gold },
        ].map(st => (
          <div key={st.label} style={{ textAlign:"center", minWidth:0 }}>
            <div style={{ fontSize:15, fontWeight:600, color:st.color, whiteSpace:"nowrap" }}>{st.value}</div>
            <div style={{ fontSize:10.5, color:C.muted, marginTop:2 }}>{st.label}</div>
          </div>
        ))}
      </div>}
    </div>
  );
}

// ─────────────────────────────────────────────
// PUNCH TAB
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// WORK TAB(上班：打卡優先，事後補盤點)
// ─────────────────────────────────────────────
function WorkTab({ user, activeSeg, todaySchedule, locations, workLoc, setWorkLoc, checklistDone, setChecklistDone, onSegmentChange }) {
  const time = useTime();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const [groomFile, setGroomFile] = useState(null);
  const [groomPreview, setGroomPreview] = useState("");
  const groomRef = useRef();
  const [firstInfo, setFirstInfo] = useState(null);
  const [handover, setHandover] = useState(null);
  const [openAmounts, setOpenAmounts] = useState({ 原味:"",可可:"",紅玉:"",抹茶:"",黑糖:"",芝麻:"" });
  const [cashReceived, setCashReceived] = useState("");
  const [openSubmitting, setOpenSubmitting] = useState(false);
  const [venue, setVenue] = useState("");   // 活動名稱／地點(僅活動櫃位需要)
  // v1.26 食安：儀容勾選、冰箱溫度
  const fsMeta = useFsMeta(apiGet);
  const [groom, setGroom] = useState([]);
  const [temps, setTemps] = useState({});
  const groomOk = GROOM.every(([k]) => groom.includes(k));
  const tempsOk = fridgesFilled(fsMeta, workLoc, temps);

  const flavors = ["原味","可可","紅玉","抹茶","黑糖","芝麻"];
  // v1.25 有排班就先幫你選好今天的櫃位（還是可以改）
  const schedLoc = todaySchedule && todaySchedule.start ? todaySchedule.location : "";
  useEffect(() => {
    if (!activeSeg && !workLoc && schedLoc && locations && locations[schedLoc]) setWorkLoc(schedLoc);
  }, [schedLoc, locations, activeSeg]);
  const inSegment = !!activeSeg; // 目前是否有進行中的上班段
  const isActivity = locations?.[workLoc]?.kind === "活動";

  useEffect(() => {
    if (!inSegment) return;
    (async () => {
      const [fRes, hRes] = await Promise.all([
        apiGet({ action:"checkFirstOpener", date:todayStr(), location:activeSeg.location }),
        apiGet({ action:"getYesterdayHandover", location:activeSeg.location }),
      ]);
      if (fRes.success) setFirstInfo(fRes);
      if (hRes.success) setHandover(hRes);
    })();
  }, [inSegment, activeSeg?.location]);

  const getGPS = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject("此裝置不支援GPS"); return; }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => reject("無法取得位置，請確認已開啟定位權限"),
      { timeout:10000 }
    );
  });

  const handleGroomPhoto = (e) => {
    const f = e.target.files[0]; if (!f) return;
    setGroomFile(f); setGroomPreview(URL.createObjectURL(f));
  };

  const doPunchIn = async () => {
    if (!workLoc) { setErr("請先選擇今日上班地點"); return; }
    if (isActivity && !venue.trim()) { setErr("這是活動場次，請填寫活動名稱或地點"); return; }
    if (!groomOk) { setErr("請先確認儀容：帽子、口罩、品牌制服、沒有穿拖鞋"); return; }
    if (!groomFile) { setErr("請先拍攝儀容照(帽子、口罩、制服)再打卡"); return; }
    if (!tempsOk) { setErr("請填寫每台冰箱的溫度"); return; }
    setLoading(true); setErr(""); setMsg("");
    try {
      const coords = await getGPS();
      const now = new Date();
      const timeStr = now.toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"});
      setMsg("儀容照上傳中…");
      const photoUrl = await uploadPhoto(groomFile, { folder:"儀容照片", date:todayStr(), loc:workLoc, name:user.name });
      setMsg("打卡處理中…");
      const res = await apiPost({
        action: "punch", date: todayStr(), empId: user.id, name: user.name,
        scheduleId: todaySchedule?.id || "", type: "上班", time: now.toISOString(),
        lat: coords.lat, lng: coords.lng, location: workLoc, offline: false, photoUrl,
        note: isActivity ? "活動:" + venue.trim() : "",
      });
      if (!res.success) { setErr(res.error || "打卡失敗，請重試"); setLoading(false); return; }
      const fs = await apiPost({ action:"fsLog", loc: workLoc, type:"上班", temps: fridgePayload(fsMeta, workLoc, temps), groom }, 1).catch(() => null);
      setTemps({}); setGroom([]);
      if (isActivity) { cacheSet("venue_" + user.id, { date: todayStr(), loc: workLoc, venue: venue.trim() }); setVenue(""); }
      window.dispatchEvent(new CustomEvent("rh-pet-greet", { detail:{ kind:"in" } }));
      setMsg(`✅ 上班打卡成功！${timeStr}　定位:${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}　請繼續完成下方盤點資料${fs && fs.abnormal ? "｜⚠️ 冰箱溫度異常，已通知總部" : ""}`);
      setGroomFile(null); setGroomPreview("");
      onSegmentChange && onSegmentChange();
    } catch(e) {
      setErr(typeof e === "string" ? e : (e?.message || "打卡失敗，請重試"));
    }
    setLoading(false);
  };

  const openAllFilled = firstInfo?.isFirst === false ? cashReceived !== ""
    : (flavors.every(f => openAmounts[f] !== "") && cashReceived !== "");

  const submitOpenData = async () => {
    if (!openAllFilled) { setErr("請完整填寫麵糊起始量與接手零用金"); return; }
    setOpenSubmitting(true); setErr("");
    try {
      await apiPost({ action:"punchExtra", date:todayStr(), empId:user.id, location:activeSeg.location,
        type:"上班", cashReceived });
      if (firstInfo?.isFirst) {
        await apiPost({
          action:"openStore", date:todayStr(), scheduleId:todaySchedule?.id||"",
          empId:user.id, name:user.name, location:activeSeg.location,
          original:openAmounts["原味"], cocoa:openAmounts["可可"],
          ruby:openAmounts["紅玉"], matcha:openAmounts["抹茶"], brown:openAmounts["黑糖"], sesame:openAmounts["芝麻"], note:"",
        });
      }
      setChecklistDone && setChecklistDone(p=>({...p, open:true}));
      setMsg("✅ 開店盤點已送出");
    } catch(e) { setErr("送出失敗，請重試"); }
    setOpenSubmitting(false);
  };

  return (
    <div>
      <TimeHeader sub={inSegment ? <>目前上班中：{activeSeg.location}</> : null} />
      <SopCard type="開店" />

      {msg && <div style={{ ...s.card, padding:"10px 14px", marginBottom:12,
                             background:C.greenBg, border:`1px solid ${C.green}44` }}>
        <div style={{ fontSize:13, color:C.green, fontWeight:700 }}>{msg}</div>
      </div>}
      {err && <div style={{ ...s.card, padding:"10px 14px", marginBottom:12,
                             background:C.redBg, border:`1px solid ${C.red}44` }}>
        <div style={{ fontSize:13, color:C.red }}>{err}</div>
      </div>}

      {/* 尚無進行中的班 → 顯示打卡入口 */}
      {!inSegment && (
        <>
          <div style={{ ...s.card, marginBottom:12 }}>
            <div style={s.sectionTitle}>今日上班地點{schedLoc && workLoc === schedLoc ? <span style={{ fontSize:11, color:C.green, fontWeight:400, marginLeft:6 }}>依班表</span> : null}</div>
            <select value={workLoc} onChange={e=>setWorkLoc(e.target.value)} style={s.input}>
              <option value="">請選擇地點</option>
              {Object.entries(locations||{}).map(([name,info]) => (
                <option key={name} value={name}>
                  {info.kind==="活動" ? "🎪 " : "🏪 "}{name}{info.kind==="活動" ? "(活動 +$500)" : ""}
                </option>
              ))}
            </select>
            {Object.keys(locations||{}).length===0 && (
              <div style={{ fontSize:12, color:C.red, marginTop:8, textAlign:"center" }}>
                ⚠️ 地點清單載入失敗，請下拉重新整理頁面後再試
              </div>
            )}
            {isActivity && (
              <div style={{ marginTop:12 }}>
                <label style={s.label}>活動名稱／地點 <span style={{ color:C.accent }}>*必填</span></label>
                <input value={venue} onChange={e=>setVenue(e.target.value)} maxLength={40}
                  placeholder="例：新莊棒球場 週末市集" style={s.input}/>
                <div style={{ fontSize:11, color:C.muted, marginTop:6 }}>
                  同一天有多場活動時，每一場上班打卡都請各填一次
                </div>
              </div>
            )}
          </div>

          {workLoc && (
            <div style={{ ...s.card, marginBottom:12 }}>
              <div style={s.sectionTitle}>儀容照 <span style={{ color:C.accent }}>*上班必拍</span></div>
              <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>先確認下面 4 項都做到了，全部勾完才能拍照</div>
              <GroomChecks checked={groom} setChecked={setGroom} C={C} />
              <div style={{ display:"flex", gap:10, alignItems:"center", opacity: groomOk ? 1 : .45, pointerEvents: groomOk ? "auto" : "none" }}>
                {groomPreview && <img src={groomPreview} alt="" style={{ width:72, height:72, objectFit:"cover", borderRadius:12, border:`2px solid ${C.green}` }}/>}
                <input ref={groomRef} type="file" accept="image/*" capture="user" onChange={handleGroomPhoto} style={{ display:"none" }}/>
                <button onClick={()=>groomRef.current.click()} style={{ ...s.btn("ghost"), flex:1, gap:8,
                  border:`2px dashed ${groomFile?C.green:C.border}`, color:groomFile?C.green:C.muted }}>
                  🤳 {groomFile ? "重新拍攝" : "拍攝儀容照"}
                </button>
              </div>
            </div>
          )}

          {workLoc && <FridgeInputs meta={fsMeta} loc={workLoc} values={temps} setValues={setTemps} C={C} s={s} />}

          <button disabled={!workLoc || !groomFile || !groomOk || !tempsOk || loading} onClick={doPunchIn}
            style={{ ...s.btn("green"), opacity:(!workLoc||!groomFile||!groomOk||!tempsOk||loading)?.5:1 }}>
            {loading ? "處理中…" : "⬆ 上班打卡"}
          </button>
          <div style={{ fontSize:11, color:C.muted, textAlign:"center", marginTop:8 }}>
            打卡後請儘速完成盤點資料，首頁會持續提醒未完成事項
          </div>
        </>
      )}

      {/* 已打卡，尚未完成開店盤點 → 補資料 */}
      {inSegment && !checklistDone.open && (
        <>
          {handover && (handover.note || handover.cash!=="") && (
            <div style={{ ...s.card, marginBottom:12, background:C.blueBg, border:`1px solid ${C.blue}44` }}>
              <div style={s.sectionTitle}>📋 前一天({handover.date})交接事項</div>
              {handover.note && <div style={{ fontSize:13, color:C.text, marginBottom:6 }}>{handover.note}</div>}
              {handover.cash!=="" && <div style={{ fontSize:12, color:C.muted }}>交接零用金:${handover.cash}</div>}
            </div>
          )}

          {firstInfo?.isFirst === true && (
            <div style={{ ...s.card, marginBottom:12 }}>
              <div style={s.sectionTitle}>🌅 開店盤點 <span style={{ color:C.accent }}>*您是今日第一位</span></div>
              {flavors.map(f => (
                <div key={f} style={{ marginBottom:10 }}>
                  <label style={s.label}>{f}面糊起始量(包)</label>
                  <input type="number" placeholder="請輸入包數" value={openAmounts[f]}
                    onChange={e=>setOpenAmounts(p=>({...p,[f]:e.target.value}))} style={s.input}/>
                </div>
              ))}
            </div>
          )}
          {firstInfo?.isFirst === false && (
            <div style={{ ...s.card, marginBottom:12, background:C.greenBg }}>
              <div style={{ fontSize:13, color:C.green, fontWeight:700 }}>
                ✓ 麵糊已由 {firstInfo.openedBy} 完成開店盤點
              </div>
              <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>
                原味{firstInfo.original} 可可{firstInfo.cocoa} 紅玉{firstInfo.ruby} 抹茶{firstInfo.matcha}{firstInfo.brown !== undefined && firstInfo.brown !== "" ? ` 黑糖${firstInfo.brown}` : ""}{firstInfo.sesame !== undefined && firstInfo.sesame !== "" ? ` 芝麻${firstInfo.sesame}` : ""}(包)
              </div>
            </div>
          )}

          <div style={{ ...s.card, marginBottom:12 }}>
            <div style={s.sectionTitle}>💰 接手零用金</div>
            <input type="number" placeholder="請輸入接手時零用金金額" value={cashReceived}
              onChange={e=>setCashReceived(e.target.value)} style={s.input}/>
          </div>

          <button disabled={!openAllFilled || openSubmitting} onClick={submitOpenData}
            style={{ ...s.btn("primary"), opacity:(!openAllFilled||openSubmitting)?.5:1 }}>
            {openSubmitting ? "送出中…" : "✓ 確認送出開店盤點"}
          </button>
        </>
      )}

      {inSegment && checklistDone.open && (
        <div style={{ ...s.card, textAlign:"center", padding:30, background:C.greenBg }}>
          <div style={{ fontSize:40, marginBottom:10 }}>✅</div>
          <div style={{ fontSize:15, fontWeight:600, color:C.green }}>「{activeSeg.location}」上班程序已完成</div>
          {getVenue(user.id, activeSeg.location) && (
            <div style={{ fontSize:13, color:C.text, marginTop:6 }}>活動：{getVenue(user.id, activeSeg.location)}</div>
          )}
          <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>要收店時，請切換到上方「下班」。</div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// LEAVE TAB(下班：全部填完才能打卡)
// ─────────────────────────────────────────────
function LeaveTab({ user, activeSeg, locations, checklistDone, setChecklistDone, onSegmentChange }) {
  const time = useTime();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [isLast, setIsLast] = useState(null); // null=查詢中, true/false

  const [closeAmounts, setCloseAmounts] = useState({ 原味:"",可可:"",紅玉:"",抹茶:"",黑糖:"",芝麻:"" });
  const [restock, setRestock] = useState({ 原味:"0",可可:"0",紅玉:"0",抹茶:"0",黑糖:"0",芝麻:"0" });
  const [itemRevenue, setItemRevenue] = useState({});
  const [cashHandover, setCashHandover] = useState("");
  const fsMeta = useFsMeta(apiGet);
  const [temps, setTemps] = useState({});
  const tempsOk = fridgesFilled(fsMeta, activeSeg?.location, temps);
  const [handoverNote, setHandoverNote] = useState("");
  const [ovenPhotos, setOvenPhotos] = useState([]);
  const [envPhotos, setEnvPhotos] = useState([]);
  const ovenRef = useRef(); const envRef = useRef();

  const flavors = ["原味","可可","紅玉","抹茶","黑糖","芝麻"];
  const locInfo = activeSeg ? (locations||{})[activeSeg.location] || {} : {};
  const isCount = locInfo.type === "C份數";
  const revItems = locInfo.items && locInfo.items.length ? locInfo.items : ["雞蛋糕"];
  const revenueAllFilled = isCount
    ? (itemRevenue["雞蛋糕"] !== undefined && itemRevenue["雞蛋糕"] !== "")
    : revItems.every(it => itemRevenue[it] !== undefined && itemRevenue[it] !== "");
  const revenueTotal = revItems.reduce((sum,it)=> sum + (parseFloat(itemRevenue[it])||0), 0);

  useEffect(() => {
    if (!activeSeg || !checklistDone.open) return;
    (async () => {
      const res = await apiGet({ action:"checkLastLeaver", date:todayStr(), location:activeSeg.location, empId:user.id });
      if (res.success) setIsLast(res.isLast);
    })();
  }, [activeSeg?.location, checklistDone.open]);

  const getGPS = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject("此裝置不支援GPS"); return; }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => reject("無法取得位置，請確認已開啟定位權限"),
      { timeout:10000 }
    );
  });

  const handleMultiPhoto = (setter) => (e) => {
    const files = Array.from(e.target.files);
    setter(p => [...p, ...files.map(f => ({ name:f.name, url:URL.createObjectURL(f), file:f }))]);
  };

  // 簡易流程（非最晚下班者）：只需交接零用金即可打卡
  const simpleAllFilled = cashHandover !== "";
  // 完整流程（最晚下班者）：全部欄位皆須填寫
  const fullAllFilled = flavors.every(f => closeAmounts[f] !== "") && revenueAllFilled &&
    cashHandover !== "" && ovenPhotos.length>0 && envPhotos.length>0;
  const allFilled = (isLast ? fullAllFilled : simpleAllFilled) && tempsOk;

  const doPunchOut = async () => {
    if (!tempsOk) { setErr("請填寫每台冰箱的溫度"); return; }
    if (!allFilled) { setErr(isLast ? "請完整填寫剩餘量、營業額、零用金並上傳兩組照片" : "請填寫交接零用金"); return; }
    setLoading(true); setErr(""); setMsg("");
    try {
      const coords = await getGPS();
      const now = new Date();
      const timeStr = now.toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"});

      if (isLast) {
        setMsg("清潔照片上傳中…");
        const ovenUrls = [];
        for (const p of ovenPhotos) {
          const u = await uploadPhoto(p.file, { folder:"烤爐清潔照片", date:todayStr(), loc:activeSeg.location, name:user.name });
          if (u) ovenUrls.push(u);
        }
        const envUrls = [];
        for (const p of envPhotos) {
          const u = await uploadPhoto(p.file, { folder:"環境清潔照片", date:todayStr(), loc:activeSeg.location, name:user.name });
          if (u) envUrls.push(u);
        }
        setMsg("送出收店盤點…");
        await apiPost({
          action:"closeStore", date:todayStr(), scheduleId:"",
          empId:user.id, name:user.name, location:activeSeg.location,
          remOriginal:closeAmounts["原味"], remCocoa:closeAmounts["可可"],
          remRuby:closeAmounts["紅玉"], remMatcha:closeAmounts["抹茶"], remBrown:closeAmounts["黑糖"], remSesame:closeAmounts["芝麻"],
          rsOriginal:restock["原味"], rsCocoa:restock["可可"],
          rsRuby:restock["紅玉"], rsMatcha:restock["抹茶"], rsBrown:restock["黑糖"], rsSesame:restock["芝麻"],
          itemRevenue: JSON.stringify(itemRevenue), cash:cashHandover,
          photoUrl: [...ovenUrls, ...envUrls].join(" , "),
          handoverNote,
        });
        setChecklistDone && setChecklistDone(p=>({...p, close:true}));
      }

      setMsg("下班打卡中…");
      const res = await apiPost({
        action:"punch", date:todayStr(), empId:user.id, name:user.name,
        scheduleId:"", type:"下班", time:now.toISOString(),
        lat:coords.lat, lng:coords.lng, location:activeSeg.location, offline:false,
        note: getVenue(user.id, activeSeg.location) ? "活動:" + getVenue(user.id, activeSeg.location) : "",
      });
      if (!res.success) { setErr(res.error || "打卡失敗，請重試"); setLoading(false); return; }
      await apiPost({ action:"punchExtra", date:todayStr(), empId:user.id, location:activeSeg.location,
        type:"下班", cashHandover });
      await apiPost({ action:"fsLog", loc: activeSeg.location, type:"下班", temps: fridgePayload(fsMeta, activeSeg.location, temps) }, 1).catch(() => null);
      setTemps({});

      window.dispatchEvent(new CustomEvent("rh-pet-greet", { detail:{ kind:"out" } }));
      setMsg(`✅ 下班打卡成功！${timeStr}　定位:${coords.lat.toFixed(5)},${coords.lng.toFixed(5)} 辛苦了！`);
      setChecklistDone && setChecklistDone({ open:false, close:false });
      onSegmentChange && onSegmentChange();
    } catch(e) {
      setErr(typeof e === "string" ? e : (e?.message || "打卡失敗，請重試"));
    }
    setLoading(false);
  };

  return (
    <div>
      <TimeHeader sub={activeSeg ? <>準備下班：{activeSeg.location}{getVenue(user.id, activeSeg.location) ? `（${getVenue(user.id, activeSeg.location)}）` : ""}</> : null} />
      {activeSeg && <SopCard type="收店" />}

      {msg && <div style={{ ...s.card, padding:"10px 14px", marginBottom:12,
                             background:C.greenBg, border:`1px solid ${C.green}44` }}>
        <div style={{ fontSize:13, color:C.green, fontWeight:700 }}>{msg}</div>
      </div>}
      {err && <div style={{ ...s.card, padding:"10px 14px", marginBottom:12,
                             background:C.redBg, border:`1px solid ${C.red}44` }}>
        <div style={{ fontSize:13, color:C.red }}>{err}</div>
      </div>}

      {!activeSeg && (
        <div style={{ ...s.card, textAlign:"center", color:C.muted, fontSize:13, padding:30 }}>
          目前沒有進行中的上班紀錄，請先到「打卡」頁完成上班打卡
        </div>
      )}

      {activeSeg && !checklistDone.open && (
        <div style={{ ...s.card, textAlign:"center", color:C.gold, fontSize:13, padding:20 }}>
          ⚠️ 請先切換到上方「上班資料」完成開店盤點，才能進行下班結算
        </div>
      )}

      {activeSeg && checklistDone.open && isLast === null && (
        <div style={{ textAlign:"center", color:C.muted, fontSize:13, padding:20 }}>查詢中…</div>
      )}

      {activeSeg && checklistDone.open && isLast === false && (
        <>
          <div style={{ ...s.card, marginBottom:12, background:C.blueBg }}>
            <div style={{ fontSize:13, color:C.blue, fontWeight:700 }}>還有其他夥伴在班上</div>
            <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>您不需回報營業額與盤點，只需交接零用金即可下班</div>
          </div>
          <div style={{ ...s.card, marginBottom:12 }}>
            <div style={s.sectionTitle}>💰 交接零用金</div>
            <input type="number" placeholder="請輸入交接時零用金金額" value={cashHandover}
              onChange={e=>setCashHandover(e.target.value)} style={s.input}/>
          </div>
          <FridgeInputs meta={fsMeta} loc={activeSeg.location} values={temps} setValues={setTemps} C={C} s={s} />
          <button disabled={!allFilled || loading} onClick={doPunchOut}
            style={{ ...s.btn("blue"), opacity:(!allFilled||loading)?.5:1 }}>
            {loading ? (msg || "處理中…") : "⬇ 下班打卡"}
          </button>
        </>
      )}

      {activeSeg && checklistDone.open && isLast === true && (
        <>
          <div style={{ ...s.card, marginBottom:12, background:C.goldBg }}>
            <div style={{ fontSize:13, color:C.gold, fontWeight:700 }}>您是今日最後下班者</div>
            <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>請完整填寫收店資料，全部完成後才能打下班卡</div>
          </div>

          <div style={{ ...s.card, marginBottom:12 }}>
            <div style={s.sectionTitle}>面糊剩餘數量（包）</div>
            {flavors.map(f => (
              <div key={f} style={{ marginBottom:10 }}>
                <label style={s.label}>{f}面糊剩餘</label>
                <input type="number" placeholder="請輸入剩餘包數" value={closeAmounts[f]}
                  onChange={e=>setCloseAmounts(p=>({...p,[f]:e.target.value}))} style={s.input}/>
              </div>
            ))}
          </div>

          <div style={{ ...s.card, marginBottom:12 }}>
            <div style={s.sectionTitle}>當日進貨量（包,無進貨免填）</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {flavors.map(f => (
                <div key={f}>
                  <label style={s.label}>{f}進貨</label>
                  <input type="number" placeholder="0" value={restock[f]}
                    onChange={e=>setRestock(p=>({...p,[f]:e.target.value}))} style={s.input}/>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...s.card, marginBottom:12 }}>
            <div style={s.sectionTitle}>營業數據{isCount && <span style={{ color:C.accent }}>(份數櫃位)</span>}</div>
            {isCount ? (
              <div style={{ marginBottom:12 }}>
                <label style={s.label}>當日販售份數(份)</label>
                <input type="number" placeholder={`請輸入份數(每份$${locInfo.unitPrice||70}自動換算)`}
                  value={itemRevenue["雞蛋糕"]||""} onChange={e=>setItemRevenue(p=>({...p,"雞蛋糕":e.target.value}))} style={s.input}/>
              </div>
            ) : (
              <>
                {revItems.map(it => (
                  <div key={it} style={{ marginBottom:12 }}>
                    <label style={s.label}>{it}營業額（元）</label>
                    <input type="number" placeholder={`請輸入${it}今日實際營業額`}
                      value={itemRevenue[it]||""} onChange={e=>setItemRevenue(p=>({...p,[it]:e.target.value}))} style={s.input}/>
                  </div>
                ))}
                {revItems.length > 1 && (
                  <div style={{ fontSize:13, fontWeight:600, color:C.accent, textAlign:"right", marginBottom:12 }}>
                    合計：${revenueTotal.toLocaleString()}
                  </div>
                )}
              </>
            )}
            <div>
              <label style={s.label}>交接零用金（元）</label>
              <input type="number" placeholder="請輸入交接時零用金金額" value={cashHandover}
                onChange={e=>setCashHandover(e.target.value)} style={s.input}/>
            </div>
          </div>

          <div style={{ ...s.card, marginBottom:12 }}>
            <div style={s.sectionTitle}>清潔烤爐照片 <span style={{ color:C.accent }}>*必填</span></div>
            {ovenPhotos.length>0 && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }}>
                {ovenPhotos.map((p,i)=>(
                  <div key={i} style={{ position:"relative", borderRadius:10, overflow:"hidden", aspectRatio:"1", background:C.warm }}>
                    <img src={p.url} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }}/>
                    <button onClick={()=>setOvenPhotos(ps=>ps.filter((_,idx)=>idx!==i))} style={{
                      position:"absolute", top:4, right:4, width:20, height:20, borderRadius:10,
                      background:"rgba(0,0,0,0.6)", color:"#fff", border:"none", cursor:"pointer", fontSize:12,
                      display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <input ref={ovenRef} type="file" accept="image/*" multiple capture="environment"
              onChange={handleMultiPhoto(setOvenPhotos)} style={{ display:"none" }}/>
            <button onClick={()=>ovenRef.current.click()} style={{ ...s.btn("ghost"), gap:8,
              border:`2px dashed ${ovenPhotos.length>0?C.green:C.border}`, color:ovenPhotos.length>0?C.green:C.muted }}>
              🔥 {ovenPhotos.length>0 ? `再新增（已拍 ${ovenPhotos.length} 張）` : "拍攝烤爐清潔照"}
            </button>
          </div>

          <div style={{ ...s.card, marginBottom:12 }}>
            <div style={s.sectionTitle}>清潔環境照片 <span style={{ color:C.accent }}>*必填</span></div>
            {envPhotos.length>0 && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }}>
                {envPhotos.map((p,i)=>(
                  <div key={i} style={{ position:"relative", borderRadius:10, overflow:"hidden", aspectRatio:"1", background:C.warm }}>
                    <img src={p.url} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }}/>
                    <button onClick={()=>setEnvPhotos(ps=>ps.filter((_,idx)=>idx!==i))} style={{
                      position:"absolute", top:4, right:4, width:20, height:20, borderRadius:10,
                      background:"rgba(0,0,0,0.6)", color:"#fff", border:"none", cursor:"pointer", fontSize:12,
                      display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <input ref={envRef} type="file" accept="image/*" multiple capture="environment"
              onChange={handleMultiPhoto(setEnvPhotos)} style={{ display:"none" }}/>
            <button onClick={()=>envRef.current.click()} style={{ ...s.btn("ghost"), gap:8,
              border:`2px dashed ${envPhotos.length>0?C.green:C.border}`, color:envPhotos.length>0?C.green:C.muted }}>
              📸 {envPhotos.length>0 ? `再新增（已拍 ${envPhotos.length} 張）` : "拍攝環境清潔照"}
            </button>
          </div>

          <div style={{ ...s.card, marginBottom:12 }}>
            <div style={s.sectionTitle}>交班備注</div>
            <textarea value={handoverNote} onChange={e=>setHandoverNote(e.target.value)}
              placeholder="留給下一班/下一天的注意事項（選填）" style={{ ...s.input, minHeight:80, resize:"vertical" }}/>
          </div>

          <FridgeInputs meta={fsMeta} loc={activeSeg.location} values={temps} setValues={setTemps} C={C} s={s} />

          {!allFilled && (
            <div style={{ fontSize:12, color:C.muted, textAlign:"center", marginBottom:10 }}>
              ⚠️ 請完整填寫面糊剩餘、營業額、零用金、冰箱溫度並上傳兩組照片，全部完成才能打下班卡
            </div>
          )}
          <button disabled={!allFilled || loading} onClick={doPunchOut}
            style={{ ...s.btn("blue"), opacity:(!allFilled||loading)?.5:1 }}>
            {loading ? (msg || "處理中…") : "⬇ 下班打卡"}
          </button>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// OPS TAB
// ─────────────────────────────────────────────
function InfoTab({ user, staffInfo, salary, schedule, announcements, onRefresh, onPwChanged, onLogout, viewAs, links }) {
  const checkupDays = staffInfo?.checkupExpiry ? daysUntil(staffInfo.checkupExpiry) : 999;
  const latestSalary = salary.sort((a,b)=>String(b["年月"]).localeCompare(String(a["年月"])))[0];

  return (
    <div>
      <div style={{ ...s.card, display:"flex", gap:16, alignItems:"center" }}>
        <div style={{ width:56, height:56, borderRadius:28, flexShrink:0,
                      background:C.accentBg, color:C.accent, border:`1px solid ${C.border}`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:22, fontWeight:600 }}>{user.avatar}</div>
        <div>
          <div style={{ fontSize:18, fontWeight:600 }}>{user.name}</div>
          <div style={{ fontSize:12.5, color:C.muted, marginTop:2 }}>{user.position} · {user.id}</div>
          <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>🎂 {user.birthday}</div>
        </div>
      </div>

      <button onClick={onRefresh} style={{ ...s.btn("secondary"), marginBottom:12 }}>🔄 重新整理資料</button>
      {viewAs}

      {user.weakPw && (
        <div style={{ ...s.card, background:C.goldBg, border:`1px solid ${C.gold}44`, borderLeft:`4px solid ${C.gold}` }}>
          <div style={{ fontSize:13, fontWeight:600 }}>🔒 你的密碼還是生日</div>
          <div style={{ fontSize:12, color:C.muted, marginTop:4, lineHeight:1.6 }}>生日很容易被猜到，建議到下方「帳號安全」改成自己的密碼。不改也能繼續使用。</div>
        </div>
      )}

      <SalaryToDateCard user={user} />
      {links && <div style={{ marginBottom:12 }}>{links}</div>}

      {checkupDays <= 30 && checkupDays > 0 && (
        <div style={{ ...s.card, background:C.redBg, border:`1px solid ${C.red}44`,
                      borderLeft:`4px solid ${C.red}` }}>
          <div style={{ fontSize:13, fontWeight:600, color:C.red }}>
            🩺 體檢即將到期！還有 {checkupDays} 天
          </div>
          <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>
            請盡快完成體檢並向公司請款。
          </div>
        </div>
      )}

      {latestSalary && (
        <div style={{ ...s.card, background:C.goldBg, border:`1px solid ${C.gold}44` }}>
          <div style={s.sectionTitle}>最近薪資 · {latestSalary["年月"]}</div>
          <div style={{ fontSize:32, fontWeight:600, color:C.gold, textAlign:"center" }}>
            NT$ {Number(latestSalary["實領金額"]||0).toLocaleString()}
          </div>
          <div style={{ fontSize:11, color:C.muted, textAlign:"center", marginTop:4 }}>
            狀態：{latestSalary["發布狀態"] || "待確認"}
          </div>
        </div>
      )}

      <div style={s.card}>
        <div style={s.sectionTitle}>出勤統計</div>
        {[
          ["累計工時", staffInfo ? `${staffInfo.accumulated} 小時` : "—"],
          ["特休剩餘", staffInfo?.leaveBalance !== undefined ? `${staffInfo.leaveBalance} 天` : "—"],
          ["本月排班", `${schedule.length} 天`],
          ["體檢到期", staffInfo?.checkupExpiry || user.checkupExpiry || "—"],
        ].map(([l,v]) => (
          <div key={l} style={{ display:"flex", justifyContent:"space-between",
                                padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
            <span style={{ fontSize:13, color:C.muted }}>{l}</span>
            <span style={{ fontSize:13, fontWeight:700 }}>{v}</span>
          </div>
        ))}
      </div>

      <div style={s.card}>
        <div style={s.sectionTitle}>津貼等級</div>
        {[
          ["技能津貼", `每小時 +$${user.skillLevel ?? 0}`, C.blue],
          ["貢獻津貼", `每小時 +$${user.contribLevel ?? 0}`, C.green],
        ].map(([l,v,c]) => (
          <div key={l} style={{ display:"flex", justifyContent:"space-between",
                                padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
            <span style={{ fontSize:13, color:C.muted }}>{l}</span>
            <span style={{ fontSize:13, fontWeight:700, color:c }}>{v}</span>
          </div>
        ))}
      </div>

      <div style={s.card}>
        <div style={s.sectionTitle}>勞健保自付額</div>
        {[
          ["勞保自付", `NT$ ${user.labor ?? 0}`],
          ["健保自付", `NT$ ${user.health ?? 0}`],
          ["未投保補貼", user.noInsure > 0 ? `+NT$ ${user.noInsure}` : "已投保"],
        ].map(([l,v]) => (
          <div key={l} style={{ display:"flex", justifyContent:"space-between",
                                padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
            <span style={{ fontSize:13, color:C.muted }}>{l}</span>
            <span style={{ fontSize:13, fontWeight:700 }}>{v}</span>
          </div>
        ))}
      </div>

      <ChangePasswordCard user={user} onChanged={onPwChanged} />

      <div style={s.card}>
        <div style={s.sectionTitle}>所有公告</div>
        {announcements.length === 0
          ? <div style={{ fontSize:13, color:C.muted, textAlign:"center", padding:12 }}>目前無公告</div>
          : announcements.map(a => (
            <div key={a.id} style={{ padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
              <div style={{ fontSize:13, fontWeight:700, color:a.urgent?C.accent:C.text }}>{a.title}</div>
              <div style={{ fontSize:12, color:C.muted, marginTop:4, lineHeight:1.6 }}>{a.body}</div>
              <div style={{ fontSize:10, color:C.light, marginTop:4 }}>{a.date}</div>
            </div>
          ))
        }
      </div>
      {onLogout && <button onClick={() => { if (confirm("登出後，下次要重新輸入帳號密碼。確定登出？")) onLogout(); }} style={{ ...s.btn("ghost"), marginTop:4 }}>登出</button>}
      <div style={{ fontSize:11, color:C.light, textAlign:"center", marginTop:10 }}>這支手機會記住登入 30 天；借別人手機登入，用完記得登出</div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 本月薪資概況(1 日～昨天,實際打卡＋收店業績;後端 getSalaryToDate,需登入 token)
// ─────────────────────────────────────────────
function SalaryToDateCard({ user }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);
  const [hide, setHide] = useState(() => { try { return localStorage.getItem("rh_salHide") === "1"; } catch (e) { return false; } });
  const load = () => {
    if (!user.token) { setErr("請登出再登入一次，就能看到本月薪資概況"); return; }
    setErr("");
    apiPost({ action:"getSalaryToDate", empId:user.id, token:user.token }, 1).then(r => {
      if (r && r.success) setD(r);
      else setErr(r && /未知的動作/.test(r.error || "") ? "本月薪資概況即將開放" : ((r && r.error) || "暫時讀不到，稍後再試"));
    });
  };
  useEffect(load, [user.id, user.token]);
  const toggleHide = () => { const v = !hide; setHide(v); try { localStorage.setItem("rh_salHide", v ? "1" : "0"); } catch (e) {} };
  const money = n => hide ? "＊＊＊" : "NT$ " + Number(n || 0).toLocaleString();
  const md = x => String(x || "").slice(5).replace("-", "/");
  const row = (l, v, note, color, key) => (
    <div key={key || l} style={{ padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
      <div style={{ display:"flex", justifyContent:"space-between", gap:8 }}>
        <span style={{ fontSize:13, color:C.muted }}>{l}</span>
        <span style={{ fontSize:13, fontWeight:700, color:color || C.text, whiteSpace:"nowrap" }}>{v}</span>
      </div>
      {note && <div style={{ fontSize:11, color:C.light, marginTop:2 }}>{note}</div>}
    </div>
  );
  return (
    <div style={{ ...s.card, background:C.goldBg, border:`1px solid ${C.gold}44` }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={s.sectionTitle}>本月薪資概況{d && d.asOf ? ` · 至 ${md(d.asOf)}` : ""}</div>
        <button onClick={toggleHide} aria-label={hide ? "顯示金額" : "隱藏金額"} style={{ border:"none", background:"transparent", fontSize:12, color:C.muted, cursor:"pointer", fontFamily:"inherit" }}>{hide ? "👁 顯示" : "🙈 隱藏"}</button>
      </div>
      {err && <div style={{ fontSize:12.5, color:C.muted, textAlign:"center", padding:10 }}>{err}</div>}
      {!d && !err && <div style={{ fontSize:12.5, color:C.muted, textAlign:"center", padding:10 }}>計算中…</div>}
      {d && (
        <div>
          <div style={{ textAlign:"center", margin:"4px 0 10px" }}>
            <div style={{ fontSize:11.5, color:C.muted }}>目前累積應發（扣勞健保前）</div>
            <div style={{ fontSize:30, fontWeight:600, color:C.gold }}>{money(d.gross)}</div>
            <div style={{ fontSize:11.5, color:C.muted }}>{d.hours.total} 小時 · {d.days.length} 個班 · 扣勞健保後約 {money(d.net)}</div>
          </div>
          {d.items.length === 0 && d.notes.map((n, i) => <div key={i} style={{ fontSize:12, color:C.muted, textAlign:"center" }}>{n}</div>)}
          {d.items.map(x => row(x.label, money(x.amt), x.note, null, x.key))}
          {d.deductions.map(x => row(x.label, hide ? "＊＊＊" : "−NT$ " + Number(x.amt).toLocaleString(), "", C.red))}
          {d.days.length > 0 && (
            <button onClick={()=>setOpen(!open)} style={{ ...s.btn("ghost"), marginTop:10 }}>{open ? "收起每日明細" : "看每日明細"}</button>
          )}
          {open && d.days.map(x => (
            <div key={x.date + x.loc} style={{ padding:"8px 0", borderBottom:`1px solid ${C.border}`, fontSize:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span><b>{md(x.date)}</b> {x.loc} <span style={{ color:C.muted }}>{x.dayType !== "平日" ? x.dayType : ""}</span></span>
                <span style={{ fontWeight:700 }}>{x.hrs} 小時</span>
              </div>
              <div style={{ color:C.muted, marginTop:2 }}>
                工資 {money(x.pay)}
                {x.perf > 0 && <> · 業績獎金 {money(x.perf)}</>}
                {x.holBonus > 0 && <> · 假日獎金 {money(x.holBonus)}</>}
                {x.rev === null && <> · 當天業績還沒登記</>}
                {x.rev !== null && x.next > 0 && !hide && <> · 再 {Number(x.next).toLocaleString()} 業績到下一級</>}
              </div>
            </div>
          ))}
          {d.items.length > 0 && d.notes.map((n, i) => <div key={i} style={{ fontSize:11, color:C.light, marginTop:8, lineHeight:1.6 }}>※ {n}</div>)}
        </div>
      )}
    </div>
  );
}

// 合作夥伴的「我的」:基本資料＋修改密碼
function PartnerInfo({ user, onPwChanged, onLogout }) {
  return (
    <div>
      <div style={{ ...s.card, display:"flex", gap:16, alignItems:"center" }}>
        <div style={{ width:56, height:56, borderRadius:28, background:C.accentBg, color:C.accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, fontWeight:600 }}>{user.avatar}</div>
        <div><div style={{ fontSize:18, fontWeight:600 }}>{user.name}</div><div style={{ fontSize:12.5, color:C.muted, marginTop:2 }}>合作夥伴 · {user.id}</div></div>
      </div>
      {user.weakPw && <div style={{ ...s.card, background:C.goldBg, borderLeft:`4px solid ${C.gold}`, fontSize:13 }}>🔒 你的密碼還是生日，建議改一組自己的。</div>}
      <ChangePasswordCard user={user} onChanged={onPwChanged} />
      <button onClick={() => { if (confirm("確定登出？")) (onLogout ? onLogout() : location.reload()); }} style={{ ...s.btn("ghost") }}>登出</button>
    </div>
  );
}

// v1.25 管理者（Lv.3 以上）密碼還是生日：一定要先改
function ForcePwScreen({ user, onDone, onLogout }) {
  return (
    <div style={{ ...s.app, padding:"36px 18px" }}>
      <div style={{ textAlign:"center", marginBottom:18 }}>
        <div style={{ fontSize:34 }}>🔒</div>
        <div style={{ fontSize:18, fontWeight:600, marginTop:6 }}>{user.name}，請先改一組新密碼</div>
        <div style={{ fontSize:12.5, color:C.muted, marginTop:8, lineHeight:1.7 }}>
          你的帳號可以看到夥伴資料、薪資與營運數字，<br/>密碼還是生日很容易被猜到。改好就能繼續使用。
        </div>
      </div>
      <ChangePasswordCard user={user} onChanged={onDone} force />
      <button onClick={onLogout} style={{ ...s.btn("ghost"), marginTop:4 }}>先登出</button>
    </div>
  );
}

// v1.25 大隊長預覽：以等級檢視（看各等級的畫面）／夥伴視角（看某位夥伴實際看到的畫面）。都只能看，不能改。
function ViewAsCard({ onStart }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(1);
  const [type, setType] = useState("員工");
  const [people, setPeople] = useState(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  useEffect(() => {
    if (!open || people) return;
    apiGet({ action:"auPeople" }, 1).then(r => { if (r && r.success) setPeople(r.data || []); else { setPeople([]); setErr(r && /未知的動作/.test(r.error || "") ? "後端更新到 v1.25 後才能用夥伴視角" : (r && r.error) || "讀不到夥伴清單"); } });
  }, [open]);
  const pick = async (p) => {
    setBusy(p.id); setErr("");
    const r = await apiPost({ action:"auViewAs", target:p.id }, 1);
    setBusy("");
    if (r && r.success && r.user) onStart({ mode:"as", user:r.user }); else setErr((r && r.error) || "讀取失敗");
  };
  const roles = [[1,"夥伴"],[2,"分隊長"],[3,"管理者"],[4,"總經理"]];
  const types = ["員工","加盟店夥伴","合作夥伴"];
  const chip = (on) => ({ border:`1px solid ${on ? C.accent : C.border}`, background: on ? C.accentBg : C.card, color: on ? C.accent : C.text, borderRadius:999, padding:"6px 12px", fontSize:12.5, cursor:"pointer", fontFamily:"inherit" });
  const list = (people || []).filter(p => !q || (p.name + p.id + p.pos + p.locs).includes(q.trim()));
  return (
    <div style={{ ...s.card, borderLeft:`4px solid ${C.accent}` }}>
      <button onClick={() => setOpen(o => !o)} style={{ display:"flex", width:"100%", alignItems:"center", gap:10, border:"none", background:"none", padding:0, cursor:"pointer", fontFamily:"inherit", color:C.text, textAlign:"left" }}>
        <span style={{ fontSize:22 }}>👀</span>
        <span style={{ flex:1 }}><b style={{ fontSize:14 }}>以等級檢視／夥伴視角</b><span style={{ display:"block", fontSize:12, color:C.muted, marginTop:2 }}>看看夥伴的畫面長什麼樣子（只能看，不能改）</span></span>
        <span style={{ color:C.muted }}>{open ? "▴" : "▾"}</span>
      </button>
      {open && <div style={{ marginTop:12 }}>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:6 }}>以等級檢視</div>
        <div style={{ fontSize:11.5, color:C.muted, marginBottom:8 }}>用你自己的資料，換成該等級的選單與畫面</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:8 }}>
          {roles.map(([r, n]) => <button key={r} onClick={() => setRole(r)} style={chip(role === r)}>Lv.{r} {n}</button>)}
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
          {types.map(x => <button key={x} onClick={() => setType(x)} style={chip(type === x)}>{x}</button>)}
        </div>
        <button onClick={() => onStart({ mode:"role", role, type })} style={s.btn("primary")}>開始預覽 Lv.{role}{type !== "員工" ? "・" + type : ""}</button>

        <div style={{ fontSize:13, fontWeight:600, margin:"18px 0 6px" }}>夥伴視角</div>
        <div style={{ fontSize:11.5, color:C.muted, marginBottom:8 }}>選一位夥伴，看他實際看到的首頁、班表、薪資概況</div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="搜尋姓名、職務或櫃位" style={{ ...s.input, marginBottom:8 }}/>
        {err && <div style={{ fontSize:12.5, color:C.red, marginBottom:8 }}>{err}</div>}
        {people === null && <div className="rh-skel" style={{ height:60 }}/>}
        <div style={{ maxHeight:300, overflowY:"auto" }}>
          {list.map(p => (
            <button key={p.id} onClick={() => pick(p)} disabled={!!busy} style={{ display:"flex", width:"100%", alignItems:"center", gap:10, padding:"9px 2px", border:"none", borderTop:`1px solid ${C.border}`, background:"none", cursor:"pointer", fontFamily:"inherit", color:C.text, textAlign:"left" }}>
              <span style={{ width:30, height:30, borderRadius:15, background:C.accentBg, color:C.accent, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:600, flexShrink:0 }}>{p.name.slice(0, 1)}</span>
              <span style={{ flex:1, minWidth:0 }}>
                <span style={{ fontSize:13.5 }}>{p.name}</span>
                <span style={{ fontSize:11.5, color:C.muted, marginLeft:6 }}>Lv.{p.role}{p.pos ? "・" + p.pos : ""}{p.type && p.type !== "員工" ? "・" + p.type : ""}</span>
                {p.locs && <span style={{ display:"block", fontSize:11, color:C.light, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{p.locs}</span>}
              </span>
              <span style={{ fontSize:12, color:C.accent }}>{busy === p.id ? "讀取中…" : "看他的畫面"}</span>
            </button>
          ))}
          {people && people.length > 0 && list.length === 0 && <div style={{ fontSize:12.5, color:C.muted, textAlign:"center", padding:10 }}>找不到符合的夥伴</div>}
        </div>
      </div>}
    </div>
  );
}

// ─────────────────────────────────────────────
// 修改密碼(夥伴自行修改;走 POST,密碼不會出現在網址列)
// ─────────────────────────────────────────────
function ChangePasswordCard({ user, onChanged, force }) {
  const [open, setOpen] = useState(!!force);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPw2, setNewPw2] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const submit = async () => {
    setErr(""); setOk("");
    if (!oldPw || !newPw || !newPw2) { setErr("請完整填寫三個欄位"); return; }
    if (newPw.length < 6 || newPw.length > 20 || /\s/.test(newPw)) { setErr("新密碼需為 6 到 20 個字元，且不可有空白"); return; }
    if (newPw === oldPw) { setErr("新密碼不能與目前密碼相同"); return; }
    if (newPw !== newPw2) { setErr("兩次輸入的新密碼不一致"); return; }
    setBusy(true);
    const res = await apiPost({ action:"changePassword", empId:user.id, oldPassword:oldPw, newPassword:newPw }, 0);
    setBusy(false);
    if (res && res.success) {
      setOk("密碼已更新，下次登入請使用新密碼");
      setOldPw(""); setNewPw(""); setNewPw2(""); setOpen(!!force);
      onChanged && onChanged();
    } else {
      setErr((res && res.error) || "修改失敗，請稍後再試");
    }
  };

  const field = (label, val, set, ph) => (
    <div style={{ marginBottom:10 }}>
      <label style={s.label}>{label}</label>
      <input type={show ? "text" : "password"} value={val} onChange={e=>set(e.target.value)}
        placeholder={ph} autoComplete="off" style={s.input}/>
    </div>
  );

  return (
    <div style={s.card}>
      <div style={s.sectionTitle}>帳號安全</div>
      {ok && <div style={{ fontSize:13, color:C.green, fontWeight:700, marginBottom:10 }}>{ok}</div>}
      {!open ? (
        <button onClick={()=>{ setOpen(true); setOk(""); }} style={s.btn("ghost")}>🔒 修改密碼</button>
      ) : (
        <div>
          {field("目前密碼", oldPw, setOldPw, "預設為生日，如 0607")}
          {field("新密碼", newPw, setNewPw, "6 到 20 個字元，不可有空白")}
          {field("再輸入一次新密碼", newPw2, setNewPw2, "")}
          <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, color:C.muted, marginBottom:12 }}>
            <input type="checkbox" checked={show} onChange={e=>setShow(e.target.checked)}/> 顯示密碼
          </label>
          {err && <div style={{ fontSize:13, color:C.red, marginBottom:10 }}>⚠️ {err}</div>}
          <div style={{ display:"flex", gap:8 }}>
            {!force && <button onClick={()=>{ setOpen(false); setErr(""); setOldPw(""); setNewPw(""); setNewPw2(""); }}
              style={{ ...s.btn("ghost"), flex:1 }}>取消</button>}
            <button disabled={busy} onClick={submit} style={{ ...s.btn(), flex:1, opacity:busy?.6:1 }}>
              {busy ? "更新中…" : "確認修改"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// GUIDE TAB
// ─────────────────────────────────────────────
function GuideTab() {
  const [open, setOpen] = useState(null);
  const sections = [
    { id:"basic", icon:"⏱", title:"基本工時薪資", color:C.accent, content:(
      <div>
        <div style={{ fontSize:12, color:C.muted, marginBottom:8, lineHeight:1.8 }}>
          工時＝上、下班打卡之間的時數，<strong style={{color:C.text}}>不扣午休</strong>。
          同一天在不同櫃位上班，工時<strong style={{color:C.text}}>合併累計</strong>後再計算加班。
        </div>
        {[["第1–8小時","× 1.00 基本工資"],["第9–10小時","× 1.33 加班薪資1"],
          ["第11–12小時","× 1.67 加班薪資2"],["超過12小時","× 2.00 加班薪資3"],
          ["國定假日／颱風停班日","當日全部工資 × 2"]].map(([r,v]) => (
          <div key={r} style={{ display:"flex", justifyContent:"space-between",
                                padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
            <span style={{ fontSize:13, color:C.muted }}>{r}</span>
            <span style={{ fontSize:13, fontWeight:700, color:C.accent }}>{v}</span>
          </div>
        ))}
      </div>
    )},
    { id:"bonus", icon:"🎯", title:"業績獎金（單/雙/三人）", color:C.gold, content:(
      <div>
        <div style={{ fontSize:12, color:C.muted, marginBottom:12 }}>
          以當天該櫃位「計算業績」合計判斷，<strong style={{color:C.text}}>達到門檻即發</strong>；
          雙人門檻×2、三人門檻×3，達標後每人各領全額獎金。<br/>
          百貨櫃位：計算業績＝登記業績 × 80%（例：單人 $500 獎金需登記 $12,500）。
        </div>
        {[["單人≥$10,000 / 雙人≥$20,000 / 三人≥$30,000","$500"],
          ["單人≥$12,500 / 雙人≥$25,000 / 三人≥$37,500","$700"],
          ["單人≥$15,000 / 雙人≥$30,000 / 三人≥$45,000","$1,000"]].map(([r,v]) => (
          <div key={r} style={{ display:"flex", justifyContent:"space-between",
                                padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
            <span style={{ fontSize:12, color:C.muted, flex:2 }}>{r}</span>
            <span style={{ fontSize:16, fontWeight:600, color:C.gold }}>{v}</span>
          </div>
        ))}
      </div>
    )},
    { id:"group", icon:"🏪", title:"團體獎金", color:C.green, content:(
      <div style={{ fontSize:13, color:C.muted, lineHeight:2 }}>
        每個櫃位每月計算一次：<br/>
        月換算業績 ＝ 當月計算業績 ÷ 當月營業天數 × 30<br/>
        月換算業績 &gt; <strong style={{color:C.text}}>$200,000</strong> → 發放<br/>
        獎金 ＝ 當月計算業績 × <strong style={{color:C.text}}>1%</strong>，依各人當月在該櫃的工時比例分配
      </div>
    )},
    { id:"allowance", icon:"🌟", title:"各項津貼", color:C.blue, content:(
      <div>
        {[["O 技能津貼","累計工時 > 180hr","每小時 +$20"],
          ["P 貢獻津貼","累計工時 > 1,080 / 2,160 / 3,240 / 4,320hr","每小時 +$5 / $10 / $15 / $20"],
          ["Q 長青津貼","暫不計算","日後實施時另行公告"],
          ["R 生日津貼","生日當月工時 ≥ 80hr","累計 >4,320hr：$2,400／>2,160hr：$1,200／其餘：$600；當月未滿 80hr 發 $200"],
          ["S 三節津貼","春節（1月）、端午（6月）、中秋（9月）當月工時 ≥ 80hr","金額級距同生日津貼；當月未滿 80hr 發 $200"],
          ["T 職務加給","有額外任務","另行議定，每月沿用上月金額"]
        ].map(([col,cond,amount]) => (
          <div key={col} style={{ padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
            <div style={{ fontSize:12, fontWeight:700, color:C.blueL }}>{col}</div>
            <div style={{ fontSize:11, color:C.muted }}>{cond}</div>
            <div style={{ fontSize:12, color:C.text }}>{amount}</div>
          </div>
        ))}
      </div>
    )},
    { id:"notice", icon:"📢", title:"行政公告", color:C.muted, content:(
      <div style={{ fontSize:13, color:C.muted, lineHeight:2 }}>
        • 請申請<strong style={{color:C.text}}>新光帳戶</strong>，2月起未約定者扣轉帳費<br/>
        • 請完成<strong style={{color:C.text}}>體檢</strong>並向公司請款<br/>
        • 領現金請提前告知大隊長
      </div>
    )},
  ];

  return (
    <div>
      <div style={{ ...s.card, textAlign:"center", padding:20, marginBottom:16 }}>
        <div style={{ fontSize:16, fontWeight:600 }}>薪資制度說明書</div>
        <div style={{ fontSize:12, color:C.muted, marginTop:6 }}>
          排越多 × 業績越好 × 待越久 → 領越多
        </div>
      </div>
      {sections.map(sec => (
        <div key={sec.id} style={{ ...s.card, padding:0, overflow:"hidden", marginBottom:10 }}>
          <button onClick={()=>setOpen(open===sec.id?null:sec.id)} style={{
            width:"100%", display:"flex", alignItems:"center", gap:12,
            padding:"14px 16px", background:"none", border:"none", cursor:"pointer", textAlign:"left",
          }}>
            <span style={{ fontSize:20 }}>{sec.icon}</span>
            <span style={{ fontSize:14, fontWeight:600, color:sec.color, flex:1 }}>{sec.title}</span>
            <span style={{ color:C.light, transition:"transform .2s",
                           display:"inline-block",
                           transform:open===sec.id?"rotate(90deg)":"none" }}>›</span>
          </button>
          {open === sec.id && (
            <div style={{ padding:"0 16px 16px", borderTop:`1px solid ${C.border}` }}>
              <div style={{ marginTop:12 }}>{sec.content}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}


// ─────────────────────────────────────────────
// ADMIN TAB(分隊長/管理員)
// ─────────────────────────────────────────────
function AdminTab({ user, onOpenBatter }) {
  const [ym, setYm] = useState(ymStr());
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const load = async (m) => {
    setLoading(true); setErr("");
    const res = await apiGet({ action:"getAdminDashboard", empId:user.id, ym:m });
    if (res.success) setD(res.data); else setErr(res.error||"讀取失敗");
    setLoading(false);
  };
  useEffect(()=>{ load(ym); }, [ym]);

  const months = [];
  for (let i=0;i<6;i++){ const dt=new Date(); dt.setDate(1); dt.setMonth(dt.getMonth()-i);
    months.push(dt.toISOString().slice(0,7)); }
  const fmt = n => "$"+Number(n||0).toLocaleString();
  const Pct = ({v}) => v===null||v===undefined ? <span style={{ color:C.light, fontSize:11 }}>無上月資料</span>
    : <span style={{ fontSize:11, fontWeight:600, color: v>=0?C.green:C.red }}>{v>=0?"▲":"▼"} {Math.abs(v)}%</span>;

  return (
    <div>
      <div style={s.card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:12, color:C.muted }}>管理儀表板 · {user.role>=3?"全部櫃位":"負責櫃位"}</div>
            <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{d?.asOf||"—"}累積營業額</div>
          </div>
          <select value={ym} onChange={e=>setYm(e.target.value)}
            style={{ ...s.input, width:"auto", padding:"6px 10px", fontSize:12 }}>
            {months.map(m=><option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div style={{ fontSize:36, fontWeight:600, color:C.text, marginTop:8, letterSpacing:1 }}>
          {loading?"…":fmt(d?.total)}
        </div>
        {d && <div style={{ fontSize:12, color:C.muted }}>上月同期 {fmt(d.totalPrev)} &nbsp;<Pct v={d.totalPct}/></div>}
      </div>

      {err && <div style={{ ...s.card, background:C.redBg, color:C.red, fontSize:13 }}>{err}</div>}

      {d && d.today.length>0 && (
        <div style={s.card}>
          <div style={s.sectionTitle}>今日即時(已收店)</div>
          {d.today.map(t=>(
            <div key={t.name} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
              <span style={{ fontSize:13 }}>{t.name}</span>
              <span style={{ fontSize:13, fontWeight:600, color:C.green }}>{fmt(t.rev)} ✅</span>
            </div>
          ))}
        </div>
      )}

      <BatterStockPanel user={user} onOpen={onOpenBatter} />
      <DailyReportPanel user={user} />

      {d && (
        <div style={s.card}>
          <div style={s.sectionTitle}>各櫃位累積({d.asOf})</div>
          {d.locations.length===0 && <div style={{ fontSize:13, color:C.muted, textAlign:"center", padding:10 }}>本月尚無營業資料</div>}
          {d.locations.map(l=>{
            const w = d.locations[0].rev>0 ? Math.round(l.rev/d.locations[0].rev*100) : 0;
            return (
              <div key={l.name} style={{ marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}>
                  <span>{l.kind==="活動"?"🎪 ":"🏪 "}{l.name}</span>
                  <span><b>{fmt(l.rev)}</b> &nbsp;<Pct v={l.pct}/></span>
                </div>
                <div style={{ height:8, background:C.border, borderRadius:4, overflow:"hidden" }}>
                  <div style={{ width:w+"%", height:"100%", background:C.accent, borderRadius:4 }}/>
                </div>
                <div style={{ fontSize:10, color:C.light, marginTop:2 }}>上月同期 {fmt(l.prevRev)}</div>
              </div>
            );
          })}
        </div>
      )}

      {d && (
        <div style={s.card}>
          <div style={s.sectionTitle}>夥伴出勤時數({ym})</div>
          {d.staff.length===0 && <div style={{ fontSize:13, color:C.muted, textAlign:"center", padding:10 }}>尚無出勤資料</div>}
          {d.staff.map(p=>{
            const pct=Math.min(100,Math.round(p.hours/p.target*100)); const ok=p.hours>=p.target;
            return (
              <div key={p.id} style={{ marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}>
                  <span>{p.name}</span>
                  <span style={{ fontWeight:600, color: ok?C.green:C.gold }}>{p.hours} / {p.target} hr {ok?"✅":""}</span>
                </div>
                <div style={{ height:6, background:C.border, borderRadius:3, overflow:"hidden" }}>
                  <div style={{ width:pct+"%", height:"100%", background: ok?C.green:C.gold, borderRadius:3 }}/>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button onClick={()=>load(ym)} style={{ ...s.btn(), marginTop:4 }}>🔄 重新整理</button>

      <div style={{ marginTop:20 }}>
        <AbnormalShiftPanel user={user} />
      </div>
      {user.role >= 3 && <div style={{ marginTop:12 }}>
        <InsuranceGradePanel user={user} ym={ym} />
      </div>}
    </div>
  );
}

// ── 每日營運日報(分隊長以上)──
function DailyReportPanel({ user }) {
  const yday = () => { const d = new Date(Date.now() + 8 * 3600e3 - 86400e3); return d.toISOString().slice(0, 10); };
  const [date, setDate] = useState(yday());
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(null);
  useEffect(() => { setD(null); setErr(""); apiGet({ action:"getDailyReport", empId:user.id, date }, 1).then(r => { if (r && r.success) setD(r.data); else setErr((r && r.error) || "日報功能尚未開通"); }); }, [date]);
  const shift = n => { const t = new Date(date + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + n); const v = t.toISOString().slice(0, 10); if (v <= todayStr()) setDate(v); };
  const fmt = n => "$" + Number(n || 0).toLocaleString();
  return (
    <div style={s.card}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <div style={{ ...s.sectionTitle, marginBottom:0 }}>每日營運日報</div>
        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
          <button onClick={()=>shift(-1)} aria-label="前一天" style={{ border:"none", background:"none", fontSize:18, color:C.muted, cursor:"pointer" }}>‹</button>
          <span style={{ fontSize:12.5 }}>{date.slice(5).replace("-", "/")}</span>
          <button onClick={()=>shift(1)} aria-label="後一天" style={{ border:"none", background:"none", fontSize:18, color:C.muted, cursor:"pointer" }}>›</button>
        </div>
      </div>
      {!d && !err && <div className="rh-skel" style={{ height:80 }}/>}
      {err && <div style={{ fontSize:12.5, color:C.muted, textAlign:"center", padding:8 }}>{err}</div>}
      {d && <>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6, textAlign:"center", marginBottom:10 }}>
          {[["營業額", fmt(d.total.rev)], ["工時", d.total.hours + "h"], ["每小時產值", fmt(d.perHour)], ["訂單", d.total.orders]].map(x =>
            <div key={x[0]} style={{ background:C.warm, borderRadius:12, padding:"8px 2px" }}><div style={{ fontSize:14, fontWeight:600 }}>{x[1]}</div><div style={{ fontSize:10.5, color:C.muted }}>{x[0]}</div></div>)}
        </div>
        {d.stores.length === 0 && <div style={{ fontSize:13, color:C.muted, textAlign:"center", padding:8 }}>這天沒有營運資料</div>}
        {d.stores.map(st => (
          <div key={st.loc} style={{ borderTop:`1px solid ${C.border}`, padding:"8px 0" }}>
            <button onClick={()=>setOpen(open === st.loc ? null : st.loc)} style={{ display:"flex", width:"100%", justifyContent:"space-between", border:"none", background:"none", padding:0, cursor:"pointer", fontFamily:"inherit", color:C.text }}>
              <span style={{ fontSize:13.5 }}>{st.loc.replace(/^\d+/, "")}</span>
              <span style={{ fontSize:13 }}><b>{fmt(st.rev)}</b><span style={{ color:C.muted, marginLeft:8 }}>{st.hours}h{st.orders ? `・${st.orders} 單` : ""}</span> {open === st.loc ? "▴" : "▾"}</span>
            </button>
            {st.closes === 0 && st.hours > 0 && <div style={{ fontSize:11.5, color:C.gold, marginTop:2 }}>⚠️ 有人上班但沒有收店盤點</div>}
            {open === st.loc && <div style={{ fontSize:12, color:C.muted, marginTop:6, lineHeight:1.7 }}>
              麵糊消耗：{["原味","可可","紅玉","抹茶"].map(f => `${f} ${st.use[f]}`).join("、")}（共 {st.useTotal} 包）<br/>
              {st.rem && <>收店剩餘：{["原味","可可","紅玉","抹茶"].map(f => `${f} ${st.rem[f]}`).join("、")}<br/></>}
              {st.orders ? <>訂單：{st.orders} 筆（已交付 {st.ordersDone}）<br/></> : null}
              上班：{st.staff.length ? st.staff.map(x => `${x.name} ${x.hours}h`).join("、") : "—"}
            </div>}
          </div>))}
        {d.abnormal.length > 0 && <div style={{ marginTop:10, background:C.redBg, borderRadius:12, padding:"8px 10px" }}>
          <div style={{ fontSize:12.5, fontWeight:600, color:C.red, marginBottom:4 }}>異常打卡 {d.abnormal.length} 筆</div>
          {d.abnormal.map((a, i) => <div key={i} style={{ fontSize:12, color:C.text }}>{a.name}・{String(a.loc).replace(/^\d+/, "")}・{a.note}</div>)}
        </div>}
      </>}
    </div>
  );
}

// ── SOP 清單(上班頁＝開店、下班頁＝收店;勾選只存在這支手機,當天有效)──
let SOP_CACHE = null;
function SopCard({ type }) {
  const [list, setList] = useState(SOP_CACHE ? SOP_CACHE[type] : null);
  const [open, setOpen] = useState(false);
  const key = "rh_sop_" + type + "_" + todayStr();
  const [done, setDone] = useState(() => { try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch (e) { return {}; } });
  useEffect(() => { if (!SOP_CACHE) apiGet({ action:"getSop" }, 0).then(r => { if (r && r.success) { SOP_CACHE = r.data; setList(r.data[type] || []); } }); }, []);
  if (!list || !list.length) return null;
  const toggle = n => { const nx = { ...done, [n]: !done[n] }; setDone(nx); try { localStorage.setItem(key, JSON.stringify(nx)); } catch (e) {} };
  const cnt = list.filter(x => done[x.n]).length;
  return (
    <div style={s.card}>
      <button onClick={()=>setOpen(o => !o)} style={{ display:"flex", width:"100%", justifyContent:"space-between", alignItems:"center", border:"none", background:"none", padding:0, cursor:"pointer", fontFamily:"inherit", color:C.text }}>
        <span style={{ fontSize:14, fontWeight:600 }}>📋 {type} SOP</span>
        <span style={{ fontSize:12, color: cnt === list.length ? C.green : C.muted }}>{cnt}/{list.length} {open ? "▴" : "▾"}</span>
      </button>
      {open && <div style={{ marginTop:8 }}>
        {list.map(x => (
          <label key={x.n} style={{ display:"flex", gap:10, padding:"8px 0", borderTop:`1px solid ${C.border}`, cursor:"pointer" }}>
            <input type="checkbox" checked={!!done[x.n]} onChange={()=>toggle(x.n)} style={{ marginTop:3, accentColor:C.accent }}/>
            <span style={{ flex:1 }}>
              <span style={{ fontSize:13.5, fontWeight:500, textDecoration: done[x.n] ? "line-through" : "none", color: done[x.n] ? C.muted : C.text }}>{x.n}. {x.title}</span>
              {x.desc && <span style={{ display:"block", fontSize:12, color:C.muted, marginTop:2 }}>{x.desc}</span>}
              {x.img && /^https:\/\//.test(x.img) && <img src={x.img} alt={x.title} style={{ width:"100%", borderRadius:10, marginTop:6 }}/>}
            </span>
          </label>))}
        <div style={{ fontSize:11, color:C.light, marginTop:6 }}>勾選紀錄只存在這支手機、當天有效，不會影響打卡</div>
      </div>}
    </div>
  );
}

const batterDays = f => !f || f.days === null || f.days === undefined ? "—" : f.days >= 60 ? "60 天以上" : `${f.days} 天`;
// ── 各店剩餘麵糊(取各櫃位最新一筆收店盤點)──
const BATTER_FLAVORS = ["原味","可可","紅玉","抹茶","黑糖","芝麻"];
const BATTER_LOW = 2;   // 剩餘 ≤ 這個包數就標紅提醒
function BatterStockPanel({ user, onOpen }) {
  const [list, setList] = useState(null);
  const [err, setErr] = useState("");
  const load = async () => {
    setErr("");
    const r = await apiGet({ action:"getBatterStock", empId:user.id, mine:1 }, 1);
    if (r && r.success) setList(r.data || []); else { setList([]); setErr((r && r.error) || "剩餘麵糊功能尚未開通"); }
  };
  useEffect(() => { load(); }, []);
  const today = todayStr();
  const ago = d => { const n = Math.round((new Date(today) - new Date(d)) / 86400000); return n <= 0 ? "今天" : n === 1 ? "昨天" : `${n} 天前`; };
  const isLow = x => x.fc && x.fc.setup ? !!x.fc.low : BATTER_FLAVORS.some(f => x.rem[f] != null && x.rem[f] <= BATTER_LOW);
  const totalLow = (list || []).filter(isLow).length;
  return (
    <div style={s.card}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
        <div style={s.sectionTitle}>各店剩餘麵糊(包)</div>
        {totalLow > 0 && <span style={{ fontSize:11.5, color:C.red, fontWeight:600 }}>{totalLow} 店需補貨</span>}
      </div>
      <div style={{ fontSize:11.5, color:C.muted, marginBottom:10 }}>依各店最近一次收店盤點；「還夠」依各櫃位平日／假日用量推算</div>
      {list === null && <div className="rh-skel" style={{ height:70 }}/>}
      {err && <div style={{ fontSize:12.5, color:C.muted, textAlign:"center", padding:8 }}>{err}</div>}
      {list && !err && list.length === 0 && <div style={{ fontSize:13, color:C.muted, textAlign:"center", padding:10 }}>尚無收店盤點資料</div>}
      {list && list.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr repeat(6, 32px)", columnGap:3, rowGap:0, alignItems:"center" }}>
          <span/>{BATTER_FLAVORS.map(f => <span key={f} style={{ fontSize:11, color:C.muted, textAlign:"center", paddingBottom:6 }}>{f}</span>)}
          {list.map(x => {
            const stale = x.date < today && ago(x.date) !== "昨天";
            return [
              <div key={x.loc+"n"} style={{ padding:"8px 0", borderTop:`1px solid ${C.border}`, minWidth:0 }}>
                <div style={{ fontSize:13, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{x.loc.replace(/^\d+/, "")}</div>
                <div style={{ fontSize:10.5, color: stale ? C.gold : C.light }}>{ago(x.date)}{x.by ? `・${x.by}` : ""}</div>
              </div>,
              ...BATTER_FLAVORS.map(f => {
                const v = x.rem[f], low = v != null && v <= BATTER_LOW;
                return <div key={x.loc+f} style={{ borderTop:`1px solid ${C.border}`, alignSelf:"stretch", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <span style={{ minWidth:34, textAlign:"center", padding:"3px 0", borderRadius:8, fontSize:14, fontWeight:600,
                    fontVariantNumeric:"tabular-nums", background: low ? C.redBg : "transparent", color: v == null ? C.light : low ? C.red : C.text }}>{v == null ? "—" : v}</span>
                </div>;
              }),
              <div key={x.loc+"fc"} style={{ gridColumn:"1 / -1", fontSize:11.5, paddingBottom:8, marginTop:-2, color: isLow(x) ? C.red : C.muted }}>
                {!x.fc ? null : !x.fc.setup ? <span style={{ color:C.light }}>尚未設定用量</span> : <>
                  還夠：原味 {batterDays(x.fc.orig)}・其他 {batterDays(x.fc.other)}
                  {(x.fc.orig && x.fc.orig.suggest > 0) || (x.fc.other && x.fc.other.suggest > 0) ? <>｜建議叫 {[x.fc.orig && x.fc.orig.suggest > 0 ? `原味 ${x.fc.orig.suggest}` : "", x.fc.other && x.fc.other.suggest > 0 ? `其他 ${x.fc.other.suggest}` : ""].filter(Boolean).join("、")} 包</> : null}
                </>}
              </div>
            ];
          })}
        </div>
      )}
      <div style={{ display:"flex", gap:8, marginTop:10 }}>
        <button onClick={load} style={{ ...s.btn("ghost"), padding:"7px", fontSize:12, flex:1 }}>重新整理</button>
        {onOpen && <button onClick={onOpen} style={{ ...s.btn("ghost"), padding:"7px", fontSize:12, flex:1 }}>麵糊用量設定 →</button>}
      </div>
    </div>
  );
}

// ── 異常打卡處理面板 ──
function AbnormalShiftPanel({ user }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [closeTime, setCloseTime] = useState("");
  const [reason, setReason] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await apiGet({ action:"getAbnormalShifts", empId:user.id });
    if (res.success) setList(res.data);
    setLoading(false);
  };
  useEffect(()=>{ load(); }, []);

  const submitClose = async (item) => {
    if (!closeTime) return;
    await apiPost({
      action:"manualCloseSegment", managerId:user.id, empId:item.empId, name:item.name,
      location:item.location, date:item.date, closeTime, reason,
    });
    setEditRow(null); setCloseTime(""); setReason("");
    load();
  };

  return (
    <div style={s.card}>
      <div style={s.sectionTitle}>⚠️ 異常未下班紀錄</div>
      {loading && <div style={{ fontSize:12, color:C.muted }}>載入中…</div>}
      {!loading && list.length===0 && <div style={{ fontSize:12, color:C.muted, textAlign:"center", padding:10 }}>目前無異常紀錄 ✅</div>}
      {list.map(item => (
        <div key={item.row} style={{ padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
          <div style={{ fontSize:13, fontWeight:700, color:C.red }}>
            {item.name} · {item.location} · {item.date}
          </div>
          <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>
            上班時間:{item.inTime ? new Date(item.inTime).toLocaleString("zh-TW") : "—"}，超時未打下班卡
          </div>
          {editRow===item.row ? (
            <div>
              <input type="datetime-local" value={closeTime} onChange={e=>setCloseTime(e.target.value)}
                style={{ ...s.input, marginBottom:6 }}/>
              <input placeholder="補登原因(選填)" value={reason} onChange={e=>setReason(e.target.value)}
                style={{ ...s.input, marginBottom:6 }}/>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>setEditRow(null)} style={{ ...s.btn("ghost"), flex:1, padding:"8px" }}>取消</button>
                <button onClick={()=>submitClose(item)} style={{ ...s.btn("primary"), flex:1, padding:"8px" }}>確認補登</button>
              </div>
            </div>
          ) : (
            <button onClick={()=>setEditRow(item.row)} style={{ ...s.btn("ghost"), padding:"6px 12px", fontSize:12, width:"auto" }}>
              補登下班時間
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ── 勞健保級距校對面板 ──
function InsuranceGradePanel({ user, ym }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState({});

  const load = async () => {
    setLoading(true);
    const res = await apiGet({ action:"estimateSalaryFromSchedule", ym });
    if (res.success) setList(res.data);
    setLoading(false);
  };
  useEffect(()=>{ load(); }, [ym]);

  const apply = async (item) => {
    const r = await apiPost({ action:"applyInsuranceGrade", empId:item.empId, ym, estimatedSalary:item.estimatedSalary });
    if (!r || !r.success) { alert((r && r.error) || "套用失敗"); return; }
    setApplied(p=>({...p, [item.empId]:true}));
  };

  return (
    <div style={s.card}>
      <div style={s.sectionTitle}>💰 {ym} 排班薪資預估 / 勞健保級距校對</div>
      <div style={{ fontSize:11, color:C.muted, marginBottom:10 }}>依本月已排班表估算，供月初確認投保級距使用</div>
      {loading && <div style={{ fontSize:12, color:C.muted }}>計算中…</div>}
      {!loading && list.length===0 && <div style={{ fontSize:12, color:C.muted, textAlign:"center", padding:10 }}>本月尚無排班資料</div>}
      {list.map(item => (
        <div key={item.empId} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                                       padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
          <div>
            <div style={{ fontSize:13, fontWeight:700 }}>{item.name}</div>
            <div style={{ fontSize:11, color:C.muted }}>預估工時 {item.estimatedHours}hr</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:14, fontWeight:600, color:C.gold }}>${item.estimatedSalary.toLocaleString()}</div>
            <button onClick={()=>apply(item)} disabled={applied[item.empId]} style={{
              ...s.btn(applied[item.empId] ? "ghost" : "primary"), width:"auto", padding:"4px 10px", fontSize:11, marginTop:4 }}>
              {applied[item.empId] ? "✓ 已套用" : "套用此級距"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// SCHEDULE MANAGER TAB(分隊長/管理員排班)
// ─────────────────────────────────────────────
function ScheduleManagerTab({ user }) {
  const [ym, setYm] = useState(ymStr());
  const [rows, setRows] = useState([]);
  const [managed, setManaged] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(null); // null=關閉, {}=新增, {...}=編輯

  const load = async () => {
    setLoading(true); setErr("");
    const [schedRes, staffRes] = await Promise.all([
      apiGet({ action:"getManagedSchedule", empId:user.id, ym }),
      apiGet({ action:"getStaffList", empId:user.id }),
    ]);
    if (schedRes.success) { setRows(schedRes.data); setManaged(schedRes.managed||[]); }
    else setErr(schedRes.error||"讀取失敗");
    if (staffRes.success) setStaffList(staffRes.data);
    setLoading(false);
  };
  useEffect(()=>{ load(); }, [ym]);

  const months = [];
  for (let i=-1;i<3;i++){ const dt=new Date(); dt.setDate(1); dt.setMonth(dt.getMonth()+i);
    months.push(dt.toISOString().slice(0,7)); }

  const grouped = {};
  rows.forEach(r => { (grouped[r.date] = grouped[r.date]||[]).push(r); });
  const dates = Object.keys(grouped).sort();

  const handleDelete = async (row) => {
    if (!confirm("確定刪除這筆排班?")) return;
    const res = await apiPost({ action:"deleteSchedule", managerId:user.id, row });
    if (res.success) load(); else alert("刪除失敗:"+(res.error||""));
  };

  return (
    <div>
      <div style={s.card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:14, fontWeight:600 }}>排班管理</div>
          <select value={ym} onChange={e=>setYm(e.target.value)}
            style={{ ...s.input, width:"auto", padding:"6px 10px", fontSize:12 }}>
            {months.map(m=><option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div style={{ fontSize:12, color:C.muted, marginTop:6 }}>
          負責櫃位:{managed.join("、")||"—"}
        </div>
      </div>

      <button onClick={()=>setEditing({})} style={{ ...s.btn("blue"), marginBottom:12 }}>
        ＋ 新增排班
      </button>

      {err && <div style={{ ...s.card, background:C.redBg, color:C.red, fontSize:13 }}>{err}</div>}
      {loading && <div style={{ textAlign:"center", color:C.muted, fontSize:13, padding:10 }}>載入中…</div>}

      {dates.map(d => (
        <div key={d} style={s.card}>
          <div style={{ ...s.sectionTitle, display:"flex", justifyContent:"space-between" }}>
            <span>{d} ({["日","一","二","三","四","五","六"][new Date(d).getDay()]})</span>
          </div>
          {grouped[d].map(r => (
            <div key={r.row} style={{ display:"flex", alignItems:"center", gap:8,
                                       padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700 }}>{r.name} · {r.location}</div>
                <div style={{ fontSize:11, color:C.muted }}>
                  {r.start}–{r.end} ({r.hours}hr) {r.type==="triple"?"👥👤三人":r.type==="double"?"👥雙人":""} {r.holiday==="是"?"🎉假日":""}
                </div>
              </div>
              <button onClick={()=>setEditing(r)} style={{ ...s.btn("ghost"), width:"auto", padding:"6px 12px", fontSize:11 }}>編輯</button>
              <button onClick={()=>handleDelete(r.row)} style={{ ...s.btn("ghost"), width:"auto", padding:"6px 12px", fontSize:11, color:C.red, borderColor:C.red+"55" }}>刪除</button>
            </div>
          ))}
        </div>
      ))}
      {!loading && dates.length===0 && (
        <div style={{ ...s.card, textAlign:"center", color:C.muted, fontSize:13 }}>本月尚無排班,點上方新增</div>
      )}

      {editing && (
        <ScheduleEditModal user={user} managed={managed} staffList={staffList} initial={editing}
          onClose={()=>setEditing(null)} onSaved={()=>{ setEditing(null); load(); }} />
      )}
    </div>
  );
}

function ScheduleEditModal({ user, managed, staffList, initial, onClose, onSaved }) {
  const isEdit = !!initial.row;
  const [date, setDate] = useState(initial.date || todayStr());  // todayStr 已修正為台灣時區
  const [empId, setEmpId] = useState(initial.empId || "");
  const [location, setLocation] = useState(initial.location || managed[0] || "");
  const [start, setStart] = useState(initial.start || "10:00");
  const [end, setEnd] = useState(initial.end || "20:00");
  const [type, setType] = useState(initial.type || "single");
  const [holiday, setHoliday] = useState(initial.holiday === "是");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const handleSave = async () => {
    const emp = staffList.find(s => s.id === empId);
    if (!empId || !location || !date) { setErr("請完整填寫日期、地點、夥伴"); return; }
    setSaving(true); setErr("");
    const res = await apiPost({
      action: "saveSchedule", managerId: user.id, row: initial.row || "",
      date, empId, name: emp?.name || "", location, start, end, type,
      holiday, status: "已發布",
    });
    if (res.success) onSaved();
    else setErr(res.error || "儲存失敗");
    setSaving(false);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:200,
                  display:"flex", alignItems:"flex-end" }} onClick={onClose}>
      <div style={{ background:C.card, borderRadius:"20px 20px 0 0", padding:20, width:"100%",
                    maxWidth:480, margin:"0 auto" }} onClick={e=>e.stopPropagation()}>
        <div style={{ fontSize:16, fontWeight:600, marginBottom:16 }}>
          {isEdit ? "編輯排班" : "新增排班"}
        </div>

        <label style={s.label}>日期</label>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{...s.input, marginBottom:12}}/>

        <label style={s.label}>夥伴</label>
        <select value={empId} onChange={e=>setEmpId(e.target.value)} style={{...s.input, marginBottom:12}}>
          <option value="">請選擇夥伴</option>
          {staffList.map(st=><option key={st.id} value={st.id}>{st.name}</option>)}
        </select>

        <label style={s.label}>櫃位/地點</label>
        <select value={location} onChange={e=>setLocation(e.target.value)} style={{...s.input, marginBottom:12}}>
          {managed.map(m=><option key={m} value={m}>{m}</option>)}
        </select>

        <div style={{ display:"flex", gap:10, marginBottom:12 }}>
          <div style={{ flex:1 }}>
            <label style={s.label}>上班時間</label>
            <input type="time" value={start} onChange={e=>setStart(e.target.value)} style={s.input}/>
          </div>
          <div style={{ flex:1 }}>
            <label style={s.label}>下班時間</label>
            <input type="time" value={end} onChange={e=>setEnd(e.target.value)} style={s.input}/>
          </div>
        </div>

        <div style={{ display:"flex", gap:10, marginBottom:16 }}>
          <button onClick={()=>setType(type==="single"?"double":type==="double"?"triple":"single")}
            style={{ ...s.btn("ghost"), flex:1, color:type!=="single"?C.blue:C.muted,
                     border:`1px solid ${type!=="single"?C.blue:C.border}` }}>
            {type==="triple" ? "👥👤 三人班" : type==="double" ? "👥 雙人班" : "👤 單人班"}
          </button>
          <button onClick={()=>setHoliday(!holiday)}
            style={{ ...s.btn("ghost"), flex:1, color:holiday?C.accent:C.muted,
                     border:`1px solid ${holiday?C.accent:C.border}` }}>
            {holiday ? "🎉 假日班" : "平日班"}
          </button>
        </div>

        {err && <div style={{ ...s.card, background:C.redBg, color:C.red, fontSize:12, padding:"8px 12px" }}>{err}</div>}

        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onClose} style={{ ...s.btn("ghost"), flex:1 }}>取消</button>
          <button onClick={handleSave} disabled={saving} style={{ ...s.btn("blue"), flex:2, opacity:saving?.6:1 }}>
            {saving ? "儲存中…" : "確認送出"}
          </button>
        </div>
      </div>
    </div>
  );
}
