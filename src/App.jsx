import { useState, useEffect, useRef, lazy, Suspense } from "react";
const UniverseTab = lazy(() => import("./universe/UniverseTab.jsx"));
import VotesTab from "./VotesTab.jsx";
import AvatarEditor from "./AvatarEditor.jsx";

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

// 同一時間相同的 GET 只送一次(避免重複請求拖慢後端)
const inflightGets = {};
function apiGet(params, retries = 2) {
  const qs = new URLSearchParams(params).toString();
  if (inflightGets[qs]) return inflightGets[qs];
  const p = apiGetRaw(qs, retries).finally(() => { delete inflightGets[qs]; });
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
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify(data),
      });
      const text = await res.text();
      return JSON.parse(text);
    } catch(e) {
      if (attempt < retries) { await sleep(800 * (attempt + 1)); continue; }
      return { error: "連線失敗:" + e.message };
    }
  }
}

// 照片壓縮(長邊800px JPEG)→ base64
function compressPhoto(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const max = 800;
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
  back:'<path d="M15 6l-6 6 6 6"/>',
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
function ListItem({ icon, title, desc, onClick }) {
  return (
    <button onClick={onClick} style={{ ...s.card, width:"100%", display:"flex", alignItems:"center", gap:14,
      cursor:"pointer", textAlign:"left", fontFamily:"inherit", padding:"14px 16px", marginBottom:8, color:C.text }}>
      <span style={{ color:C.accent, display:"flex" }}><Ic n={icon}/></span>
      <span style={{ flex:1 }}>
        <span style={{ display:"block", fontSize:14.5, fontWeight:500 }}>{title}</span>
        {desc && <span style={{ display:"block", fontSize:12, color:C.muted, marginTop:2 }}>{desc}</span>}
      </span>
      <Ic n="chev" size={18} color={C.light}/>
    </button>
  );
}

// ─────────────────────────────────────────────
// APP ROOT
// ─────────────────────────────────────────────
export default function App(){
  const [user, setUser]       = useState(null);
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

  // 登入後載入資料
  useEffect(() => {
    if (!user) return;
    loadAllData();
    loadActiveSegment();
  }, [user]);

  useEffect(() => {
    if (!user || segRefreshKey === 0) return;   // 登入時已查過一次,這裡只處理之後的刷新
    loadActiveSegment();
  }, [segRefreshKey]);

  const loadActiveSegment = async () => {
    const res = await apiGet({ action:"getActiveSegment", empId:user.id, date:todayStr() });
    if (res.success) setActiveSeg(res.active);
  };

  const loadAllData = async () => {
    setLoading(true);
    // 每個請求一回來就先更新畫面,不必等最慢的那一個
    const run = (req, fn) => req.then(res => { try { if (res && res.success) fn(res); } catch(e) { console.error(e); } });
    try {
      await Promise.all([
        run(apiGet({ action:"getStaffInfo", empId:user.id }), r => setStaffInfo(r.data)),
        run(apiGet({ action:"getAnnouncements" }), r => { const d = r.data || []; setAnnouncements(d); cacheSet("ann", d); }),
        run(apiGet({ action:"getSchedule", empId:user.id, ym:ymStr() }), r => setSchedule(r.data || [])),
        run(apiGet({ action:"getSalary", empId:user.id }), r => setSalary(r.data || [])),
        run(apiGet({ action:"getQuota", empId:user.id, ym:ymStr() }), r => setQuota(r.data)),
        run(apiGet({ action:"getLocations" }), r => { const d = r.data || {}; setLocations(d); cacheSet("loc", d); }),
      ]);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const online = useOnline();
  if (!user) return <><GlobalStyle/>{!online && <OfflineBar/>}<LoginScreen onLogin={u => { setUser(u); }} /></>;

  const SUB = ["vote","guide","schedule_mgr","admin","universe","avatar"];
  const navItems = [
    { id:"home",  icon:"home",  label:"首頁" },
    { id:"punch", icon:"clock", label:"打卡" },
    { id:"info",  icon:"user",  label:"我的" },
    { id:"more",  icon:"grid",  label:"更多" },
  ];
  const navActive = SUB.includes(tab) ? "more" : tab;
  const goMore = () => setTab("more");
  const subTitle = { vote:"夥伴投票", guide:"薪資制度說明", schedule_mgr:"排班管理", admin:"管理儀表板", universe:"宇宙辦公室", avatar:"我的小人造型" }[tab];

  const baseSchedule = schedule.find(s => s.date === todayStr());
  const effLoc = activeSeg?.location || workLoc || baseSchedule?.location || "";
  const todaySchedule = effLoc ? { ...(baseSchedule||{ id:"", start:"", end:"" }), location: effLoc } : baseSchedule;

  return (
    <div style={s.app}>
      <GlobalStyle/>
      {!online && <OfflineBar/>}
      {/* TOP BAR */}
      <div style={{ background:"rgba(248,245,240,.94)", backdropFilter:"blur(8px)", position:"sticky", top:0, zIndex:50,
                    padding:"12px 18px", display:"flex", justifyContent:"space-between", alignItems:"center",
                    borderBottom:`1px solid ${C.border}` }}>
        <div>
          <div style={{ fontSize:11, color:C.muted, letterSpacing:2 }}>紅玉滿赤心雞蛋糕</div>
          <div style={{ fontSize:16, fontWeight:600, marginTop:1 }}>
            {user.name}
            <span style={{ fontSize:11, fontWeight:400, color:C.muted, marginLeft:8 }}>
              {user.role===3?"管理者":user.role===2?"分隊長":"夥伴"}
            </span>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {loading && <div style={{ fontSize:11, color:C.muted }}>同步中…</div>}
          <div style={{ width:38, height:38, borderRadius:19, background:C.accentBg, color:C.accent,
                        border:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:15, fontWeight:600 }}>{user.avatar}</div>
        </div>
      </div>

      {/* CONTENT */}
      <div key={tab} className="rh-page" style={{ padding:"14px 14px 96px" }}>
        {SUB.includes(tab) && <SubHeader title={subTitle} onBack={goMore} />}
        {tab==="home"  && (loading && !staffInfo
                          ? <HomeSkeleton/>
                          : <HomeTab user={user} staffInfo={staffInfo} announcements={announcements}
                                   activeSeg={activeSeg} checklistDone={checklistDone}
                                   todaySchedule={todaySchedule} quota={quota} schedule={schedule}
                                   onOpenVotes={()=>setTab("vote")} onOpenUniverse={()=>setTab("universe")} />)}
        {tab==="punch" && <PunchTab user={user} activeSeg={activeSeg} todaySchedule={todaySchedule}
                                   locations={locations} workLoc={workLoc} setWorkLoc={setWorkLoc}
                                   checklistDone={checklistDone} setChecklistDone={setChecklistDone}
                                   onWorkChange={()=>setSegRefreshKey(k=>k+1)}
                                   onLeaveChange={()=>{ setSegRefreshKey(k=>k+1); setWorkLoc(""); }} />}
        {tab==="info"  && <InfoTab user={user} staffInfo={staffInfo} salary={salary}
                                   schedule={schedule} announcements={announcements} onRefresh={loadAllData} />}
        {tab==="more"  && (
          <div>
            <div style={s.sectionTitle}>功能</div>
            <ListItem icon="cube" title="宇宙辦公室" desc="看看夥伴現在在哪個櫃位" onClick={()=>setTab("universe")}/>
            <ListItem icon="user" title="我的小人造型" desc="換髮型、衣服、帽子，或變身小暴龍" onClick={()=>setTab("avatar")}/>
            <ListItem icon="vote" title="夥伴投票" desc="查看進行中的投票" onClick={()=>setTab("vote")}/>
            <ListItem icon="book" title="薪資制度說明" onClick={()=>setTab("guide")}/>
            {user.role>=2 && <>
              <div style={{ ...s.sectionTitle, marginTop:16 }}>管理</div>
              <ListItem icon="cal" title="排班管理" onClick={()=>setTab("schedule_mgr")}/>
              <ListItem icon="chart" title="管理儀表板" onClick={()=>setTab("admin")}/>
            </>}
          </div>
        )}
        {tab==="guide" && <GuideTab />}
        {tab==="admin" && user.role>=2 && <AdminTab user={user} />}
        {tab==="schedule_mgr" && user.role>=2 && <ScheduleManagerTab user={user} />}
        {tab==="universe" && (
          <Suspense fallback={<div style={{ ...s.card, textAlign:"center", color:C.muted }}>宇宙辦公室載入中…</div>}>
            <UniverseTab user={user} apiGet={apiGet} apiPost={apiPost} todayStr={todayStr} C={C} s={s} onEditAvatar={()=>setTab("avatar")} />
          </Suspense>
        )}
        {tab==="avatar" && <AvatarEditor user={user} apiGet={apiGet} apiPost={apiPost} todayStr={todayStr} C={C} s={s} />}
        {tab==="vote"  && <VotesTab user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} />}
      </div>

      {/* BOTTOM NAV */}
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)",
                    width:"100%", maxWidth:480, background:"rgba(255,253,250,.94)", backdropFilter:"blur(10px)",
                    borderTop:`1px solid ${C.border}`, display:"grid", gridTemplateColumns:"repeat(4,1fr)",
                    padding:"6px 8px calc(10px + env(safe-area-inset-bottom))", zIndex:100, boxSizing:"border-box" }}>
        {navItems.map(n => (
          <button key={n.id} onClick={()=>setTab(n.id)} aria-current={navActive===n.id?"page":undefined} style={{
            display:"flex", flexDirection:"column", alignItems:"center", gap:2, padding:"6px 0",
            background:"none", border:"none", cursor:"pointer", fontFamily:"inherit",
            color: navActive===n.id ? C.accent : C.muted, transition:"color .15s",
          }}>
            <Ic n={n.icon} size={23} sw={navActive===n.id?1.9:1.6}/>
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
function LoginScreen({ onLogin }) {
  const [phone, setPhone]   = useState("");
  const [pw, setPw]         = useState("");
  const [err, setErr]       = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!phone || !pw) { setErr("請填入帳號與密碼"); return; }
    setErr(""); setLoading(true);
    try {
      const res = await apiGet({ action:"login", phone, password:pw });
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
          <div style={{ fontSize:14, color:C.text, marginTop:14, letterSpacing:2 }}>願食雞蛋糕，常保赤子心</div>
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
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// HOME TAB
// ─────────────────────────────────────────────
function HomeTab({ user, staffInfo, announcements, activeSeg, checklistDone, todaySchedule, quota, schedule, onOpenVotes, onOpenUniverse }) {
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
  const checkupDays = staffInfo?.checkupExpiry ? daysUntil(staffInfo.checkupExpiry) : 999;
  const urgentAnn = announcements.filter(a => a.urgent);

  const todos = [
    !activeSeg && !checklistDone.close && { icon:"⏱", label:"今日尚未上班打卡", color:C.accent },
    activeSeg && !checklistDone.open && { icon:"📋", label:"開店盤點尚未完成", color:C.gold },
    activeSeg && { icon:"🌙", label:`「${activeSeg.location}」尚未下班`, color:C.blue },
    checkupDays <= 30 && checkupDays > 0 && { icon:"🩺", label:`體檢將於 ${checkupDays} 天後到期`, color:C.red },
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

      {/* Todos */}
      {todos.length > 0 && (
        <div style={{ marginBottom:12 }}>
          <div style={s.sectionTitle}>待辦事項</div>
          {todos.map((t,i) => (
            <div key={i} style={{ ...s.card, padding:"10px 14px", marginBottom:8,
                                   borderLeft:`3px solid ${t.color}`,
                                   display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:18 }}>{t.icon}</span>
              <span style={{ fontSize:13 }}>{t.label}</span>
            </div>
          ))}
        </div>
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
      {quota && (
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

      {/* Quick stats */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
        {[
          { label:"累計工時", value: staffInfo ? `${staffInfo.accumulated} hr` : "—", color:C.gold },
          { label:"特休剩餘", value: staffInfo ? `${staffInfo.leaveBalance ?? "—"} 天` : "—", color:C.green },
          { label:"技能津貼", value: user.skillLevel !== undefined ? `$${user.skillLevel}/hr` : "—", color:C.blue },
          { label:"貢獻津貼", value: user.contribLevel !== undefined ? `$${user.contribLevel}/hr` : "—", color:C.gold },
        ].map(st => (
          <div key={st.label} style={{ ...s.card, textAlign:"center", padding:"14px 8px" }}>
            <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>{st.label}</div>
            <div style={{ fontSize:18, fontWeight:600, color:st.color }}>{st.value}</div>
          </div>
        ))}
      </div>
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
  const [openAmounts, setOpenAmounts] = useState({ 原味:"",可可:"",紅玉:"",抹茶:"" });
  const [cashReceived, setCashReceived] = useState("");
  const [openSubmitting, setOpenSubmitting] = useState(false);
  const [venue, setVenue] = useState("");   // 活動名稱／地點(僅活動櫃位需要)

  const flavors = ["原味","可可","紅玉","抹茶"];
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
    if (!groomFile) { setErr("請先拍攝儀容照(帽子、口罩、制服)再打卡"); return; }
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
      if (isActivity) { cacheSet("venue_" + user.id, { date: todayStr(), loc: workLoc, venue: venue.trim() }); setVenue(""); }
      setMsg(`✅ 上班打卡成功！${timeStr}　定位:${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}　請繼續完成下方盤點資料`);
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
          ruby:openAmounts["紅玉"], matcha:openAmounts["抹茶"], note:"",
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
            <div style={s.sectionTitle}>今日上班地點</div>
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
              <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>請確認帽子、口罩、制服穿戴整齊後自拍</div>
              <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                {groomPreview && <img src={groomPreview} alt="" style={{ width:72, height:72, objectFit:"cover", borderRadius:12, border:`2px solid ${C.green}` }}/>}
                <input ref={groomRef} type="file" accept="image/*" capture="user" onChange={handleGroomPhoto} style={{ display:"none" }}/>
                <button onClick={()=>groomRef.current.click()} style={{ ...s.btn("ghost"), flex:1, gap:8,
                  border:`2px dashed ${groomFile?C.green:C.border}`, color:groomFile?C.green:C.muted }}>
                  🤳 {groomFile ? "重新拍攝" : "拍攝儀容照"}
                </button>
              </div>
            </div>
          )}

          <button disabled={!workLoc || !groomFile || loading} onClick={doPunchIn}
            style={{ ...s.btn("green"), opacity:(!workLoc||!groomFile||loading)?.5:1 }}>
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
                原味{firstInfo.original} 可可{firstInfo.cocoa} 紅玉{firstInfo.ruby} 抹茶{firstInfo.matcha}(包)
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

  const [closeAmounts, setCloseAmounts] = useState({ 原味:"",可可:"",紅玉:"",抹茶:"" });
  const [restock, setRestock] = useState({ 原味:"0",可可:"0",紅玉:"0",抹茶:"0" });
  const [itemRevenue, setItemRevenue] = useState({});
  const [cashHandover, setCashHandover] = useState("");
  const [handoverNote, setHandoverNote] = useState("");
  const [ovenPhotos, setOvenPhotos] = useState([]);
  const [envPhotos, setEnvPhotos] = useState([]);
  const ovenRef = useRef(); const envRef = useRef();

  const flavors = ["原味","可可","紅玉","抹茶"];
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
  const allFilled = isLast ? fullAllFilled : simpleAllFilled;

  const doPunchOut = async () => {
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
          remRuby:closeAmounts["紅玉"], remMatcha:closeAmounts["抹茶"],
          rsOriginal:restock["原味"], rsCocoa:restock["可可"],
          rsRuby:restock["紅玉"], rsMatcha:restock["抹茶"],
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

          {!allFilled && (
            <div style={{ fontSize:12, color:C.muted, textAlign:"center", marginBottom:10 }}>
              ⚠️ 請完整填寫面糊剩餘、營業額、零用金並上傳兩組照片，全部完成才能打下班卡
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
function InfoTab({ user, staffInfo, salary, schedule, announcements, onRefresh }) {
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

      <ChangePasswordCard user={user} />

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
    </div>
  );
}

// ─────────────────────────────────────────────
// 修改密碼(夥伴自行修改;走 POST,密碼不會出現在網址列)
// ─────────────────────────────────────────────
function ChangePasswordCard({ user }) {
  const [open, setOpen] = useState(false);
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
      setOldPw(""); setNewPw(""); setNewPw2(""); setOpen(false);
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
            <button onClick={()=>{ setOpen(false); setErr(""); setOldPw(""); setNewPw(""); setNewPw2(""); }}
              style={{ ...s.btn("ghost"), flex:1 }}>取消</button>
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
function AdminTab({ user }) {
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
      <div style={{ marginTop:12 }}>
        <InsuranceGradePanel user={user} ym={ym} />
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
    await apiPost({ action:"applyInsuranceGrade", empId:item.empId, ym, estimatedSalary:item.estimatedSalary });
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
