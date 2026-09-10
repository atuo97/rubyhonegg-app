import { useState, useEffect, useRef } from "react";

// ─────────────────────────────────────────────
// Google Sheets API 設定
// ─────────────────────────────────────────────
// Cloudflare Worker 代理(解決 CORS)
const API_URL = "https://royal-hat-f2df.atuo97.workers.dev";
const LOGO_WHITE = "/logo_white.png";

async function apiGet(params) {
  try {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`${API_URL}?${qs}`);
    return JSON.parse(await res.text());
  } catch(e) { return { error: "連線失敗:" + e.message }; }
}

async function apiPost(data) {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(data),
    });
    return JSON.parse(await res.text());
  } catch(e) { return { error: "連線失敗:" + e.message }; }
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
  return res.success ? res.url : "";
}

// ─────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────
const C = {
  bg:"#faf8f4", warm:"#fff9f0", card:"#ffffff",
  border:"#ede5d8", borderDark:"#d4c4b0",
  accent:"#c8490a", accentL:"#e06030", accentBg:"#fff2ec",
  gold:"#a87010", goldL:"#c89030", goldBg:"#fff8e8",
  green:"#2a7040", greenL:"#3a9058", greenBg:"#f0faf4",
  blue:"#1a5080", blueL:"#2a70b0", blueBg:"#f0f6ff",
  red:"#c03030", redBg:"#fff0f0",
  text:"#1a1209", muted:"#8a7a68", light:"#b0a090",
  shadow:"0 2px 12px rgba(0,0,0,0.08)",
};

const s = {
  app:{ background:C.bg, minHeight:"100vh",
        fontFamily:"'Noto Sans TC','PingFang TC',sans-serif",
        color:C.text, maxWidth:480, margin:"0 auto" },
  card:{ background:C.card, border:`1px solid ${C.border}`,
         borderRadius:16, padding:16, marginBottom:12, boxShadow:C.shadow },
  btn:(v="primary")=>({
    display:"flex", alignItems:"center", justifyContent:"center",
    gap:8, padding:"13px 20px", borderRadius:14, border:"none",
    cursor:"pointer", fontWeight:800, fontSize:14, width:"100%",
    transition:"all .18s",
    ...(v==="primary"
      ? { background:`linear-gradient(135deg,${C.accent},${C.accentL})`,
          color:"#fff", boxShadow:`0 4px 16px ${C.accent}44` }
      : v==="green"
      ? { background:`linear-gradient(135deg,${C.green},${C.greenL})`,
          color:"#fff", boxShadow:`0 4px 16px ${C.green}44` }
      : v==="blue"
      ? { background:`linear-gradient(135deg,${C.blue},${C.blueL})`,
          color:"#fff", boxShadow:`0 4px 16px ${C.blue}44` }
      : v==="ghost"
      ? { background:"transparent", color:C.muted, border:`1px solid ${C.border}` }
      : { background:C.card, color:C.muted, border:`1px solid ${C.border}` }),
  }),
  input:{ width:"100%", background:C.warm, border:`1.5px solid ${C.border}`,
          borderRadius:12, padding:"12px 14px", color:C.text, fontSize:14,
          outline:"none", boxSizing:"border-box", fontFamily:"inherit" },
  label:{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:4,
          display:"block", letterSpacing:.5 },
  sectionTitle:{ fontSize:11, fontWeight:800, color:C.muted, letterSpacing:2,
                 textTransform:"uppercase", marginBottom:12 },
};

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const todayStr = () => new Date().toISOString().slice(0,10);
const timeNow  = () => new Date().toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
const dateStr  = () => new Date().toLocaleDateString("zh-TW",{year:"numeric",month:"long",day:"numeric",weekday:"long"});
const ymStr    = () => new Date().toISOString().slice(0,7);
const daysUntil = d => Math.ceil((new Date(d)-new Date())/86400000);
function useTime(){ const [t,setT]=useState(timeNow()); useEffect(()=>{const i=setInterval(()=>setT(timeNow()),1000);return()=>clearInterval(i);},[]);return t; }

// ─────────────────────────────────────────────
// APP ROOT
// ─────────────────────────────────────────────
export default function App(){
  const [user, setUser]       = useState(null);
  const [tab, setTab]         = useState("home");
  const [punchState, setPunchState] = useState({ inTime:null, outTime:null, coords:null });
  const [checklistDone, setChecklistDone] = useState({ open:false, close:false });
  const [staffInfo, setStaffInfo] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [salary, setSalary]   = useState([]);
  const [quota, setQuota]     = useState(null);
  const [locations, setLocations] = useState({});
  const [workLoc, setWorkLoc] = useState("");
  const [loading, setLoading] = useState(false);

  // 登入後載入資料
  useEffect(() => {
    if (!user) return;
    loadAllData();
  }, [user]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [infoRes, annRes, schedRes, salRes, quotaRes, locRes] = await Promise.all([
        apiGet({ action:"getStaffInfo", empId:user.id }),
        apiGet({ action:"getAnnouncements" }),
        apiGet({ action:"getSchedule", empId:user.id, ym:ymStr() }),
        apiGet({ action:"getSalary", empId:user.id }),
        apiGet({ action:"getQuota", empId:user.id, ym:ymStr() }),
        apiGet({ action:"getLocations" }),
      ]);
      if (infoRes.success) setStaffInfo(infoRes.data);
      if (annRes.success)  setAnnouncements(annRes.data || []);
      if (schedRes.success) setSchedule(schedRes.data || []);
      if (salRes.success)  setSalary(salRes.data || []);
      if (quotaRes.success) setQuota(quotaRes.data);
      if (locRes.success)  setLocations(locRes.data || {});
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  if (!user) return <LoginScreen onLogin={u => { setUser(u); }} />;

  const navItems = [
    { id:"home",  icon:"🏠", label:"首頁" },
    { id:"punch", icon:"⏱", label:"打卡" },
    { id:"ops",   icon:"📋", label:"盤點" },
    { id:"info",  icon:"👤", label:"我的" },
    { id:"guide", icon:"📖", label:"制度" },
    ...(user.role>=2 ? [{ id:"admin", icon:"📊", label:"管理" }] : []),
  ];

  const baseSchedule = schedule.find(s => s.date === todayStr());
  const effLoc = workLoc || baseSchedule?.location || "";
  const todaySchedule = effLoc ? { ...(baseSchedule||{ id:"", start:"", end:"" }), location: effLoc } : baseSchedule;

  return (
    <div style={s.app}>
      {/* TOP BAR */}
      <div style={{ background:`linear-gradient(135deg,#2a1008,#3a1c10,#2a1008)`,
                    padding:"14px 18px 12px", display:"flex",
                    justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <img src={LOGO_WHITE} alt="" style={{ height:18, marginBottom:4, opacity:.9 }}/>
          <div style={{ fontSize:16, fontWeight:900, color:"#f0d0b8" }}>
            {user.name}
            <span style={{ fontSize:11, fontWeight:400, color:"#d09078", marginLeft:6 }}>
              {user.role===3?"管理者":user.role===2?"分隊長":"夥伴"}
            </span>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {loading && <div style={{ fontSize:11, color:"#a07060" }}>同步中…</div>}
          <div style={{ width:40,height:40,borderRadius:20,
                        background:`linear-gradient(135deg,${C.accent},${C.accentL})`,
                        display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:16,fontWeight:900,color:"#fff" }}>{user.avatar}</div>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ padding:"14px 14px 80px" }}>
        {tab==="home"  && <HomeTab user={user} staffInfo={staffInfo} announcements={announcements}
                                   punchState={punchState} checklistDone={checklistDone}
                                   todaySchedule={todaySchedule} quota={quota} schedule={schedule} />}
        {tab==="punch" && <PunchTab user={user} punchState={punchState}
                                    setPunchState={setPunchState} todaySchedule={todaySchedule}
                                    locations={locations} workLoc={effLoc} setWorkLoc={setWorkLoc} />}
        {tab==="ops"   && <OpsTab user={user} checklistDone={checklistDone}
                                   setChecklistDone={setChecklistDone} todaySchedule={todaySchedule}
                                   locations={locations} />}
        {tab==="info"  && <InfoTab user={user} staffInfo={staffInfo} salary={salary}
                                   schedule={schedule} announcements={announcements} onRefresh={loadAllData} />}
        {tab==="guide" && <GuideTab />}
        {tab==="admin" && user.role>=2 && <AdminTab user={user} />}
      </div>

      {/* BOTTOM NAV */}
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)",
                    width:"100%", maxWidth:480, background:C.card,
                    borderTop:`1px solid ${C.border}`, display:"flex", zIndex:100 }}>
        {navItems.map(n => (
          <button key={n.id} onClick={()=>setTab(n.id)} style={{
            flex:1, display:"flex", flexDirection:"column", alignItems:"center",
            padding:"10px 4px 14px", background:"none", border:"none", cursor:"pointer",
            color: tab===n.id ? C.accent : C.muted,
            borderTop: tab===n.id ? `2px solid ${C.accent}` : "2px solid transparent",
            transition:"all .15s",
          }}>
            <span style={{ fontSize:20 }}>{n.icon}</span>
            <span style={{ fontSize:10, fontWeight:700, marginTop:3 }}>{n.label}</span>
          </button>
        ))}
      </div>
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
    <div style={{ ...s.app, display:"flex", flexDirection:"column",
                  background:`linear-gradient(160deg,#1a0804,#2e1208,#1a0804)`,
                  minHeight:"100vh" }}>
      <div style={{ flex:1, display:"flex", flexDirection:"column",
                    justifyContent:"center", padding:28 }}>
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <img src={LOGO_WHITE} alt="紅玉滿赤心雞蛋糕" style={{ width:"86%", maxWidth:340, marginBottom:6 }}/>
          <div style={{ fontSize:13, color:"#a07060", marginTop:4 }}>雞蛋糕品牌 · 員工系統</div>
        </div>

        <div style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,200,150,0.15)",
                      borderRadius:20, padding:24 }}>
          <div style={{ marginBottom:16 }}>
            <label style={{ ...s.label, color:"#c09080" }}>手機號碼</label>
            <input value={phone} onChange={e=>setPhone(e.target.value)}
              placeholder="請輸入手機號碼"
              style={{ ...s.input, background:"rgba(255,255,255,0.08)",
                       border:"1px solid rgba(255,200,150,0.2)", color:"#f0e0d0" }}/>
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={{ ...s.label, color:"#c09080" }}>密碼</label>
            <input type="password" value={pw} onChange={e=>setPw(e.target.value)}
              placeholder="請輸入密碼"
              onKeyDown={e=>e.key==="Enter"&&handleLogin()}
              style={{ ...s.input, background:"rgba(255,255,255,0.08)",
                       border:"1px solid rgba(255,200,150,0.2)", color:"#f0e0d0" }}/>
          </div>
          {err && <div style={{ color:"#ff9080", fontSize:12, textAlign:"center", marginBottom:12 }}>⚠️ {err}</div>}
          <button onClick={handleLogin} disabled={loading}
            style={{ ...s.btn("primary"), opacity:loading?.7:1 }}>
            {loading ? "驗證中…" : "登入"}
          </button>
        </div>

        <div style={{ textAlign:"center", marginTop:16, fontSize:11, color:"#705040" }}>
          忘記密碼請聯絡大隊長
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// HOME TAB
// ─────────────────────────────────────────────
function HomeTab({ user, staffInfo, announcements, punchState, checklistDone, todaySchedule, quota, schedule }) {
  const time = useTime();
  const checkupDays = staffInfo?.checkupExpiry ? daysUntil(staffInfo.checkupExpiry) : 999;
  const urgentAnn = announcements.filter(a => a.urgent);

  const todos = [
    !punchState.inTime && { icon:"⏱", label:"今日尚未上班打卡", color:C.accent },
    punchState.inTime && !checklistDone.open && { icon:"📋", label:"開店盤點尚未完成", color:C.gold },
    punchState.inTime && checklistDone.open && !checklistDone.close && { icon:"🌙", label:"記得收店盤點", color:C.blue },
    checkupDays <= 30 && checkupDays > 0 && { icon:"🩺", label:`體檢將於 ${checkupDays} 天後到期`, color:C.red },
  ].filter(Boolean);

  const Bar = ({ label, cur, max, unit, color }) => {
    const pct = Math.min(100, Math.round(cur / max * 100));
    const ok = cur >= max;
    return (
      <div style={{ marginBottom:10 }}>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
          <span style={{ color:C.muted }}>{label}</span>
          <span style={{ fontWeight:800, color: ok ? C.green : color }}>
            {cur} / {max} {unit} {ok ? "✅" : ""}
          </span>
        </div>
        <div style={{ height:8, background:C.border, borderRadius:4, overflow:"hidden" }}>
          <div style={{ width:pct+"%", height:"100%", borderRadius:4,
            background: ok ? C.green : `linear-gradient(90deg,${color},${color}cc)`,
            transition:"width .4s" }}/>
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Clock */}
      <div style={{ ...s.card, background:`linear-gradient(135deg,#2a1008,#3a1c10)`,
                    border:`1px solid #5a2010`, textAlign:"center" }}>
        <div style={{ fontSize:11, color:"#a07060", marginBottom:4 }}>{dateStr()}</div>
        <div style={{ fontSize:46, fontWeight:200, color:"#f0d0b8", letterSpacing:3,
                      fontVariantNumeric:"tabular-nums" }}>{time}</div>
        {todaySchedule
          ? <div style={{ marginTop:6, fontSize:12, color:"#c09070" }}>
              📍 {todaySchedule.location} &nbsp;⏰ {todaySchedule.start}–{todaySchedule.end}
              {todaySchedule.type==="double" &&
                <span style={{ marginLeft:6, fontSize:10, background:"#5a1008",
                               color:"#ff9070", padding:"1px 6px", borderRadius:10 }}>雙人班</span>}
            </div>
          : <div style={{ marginTop:6, fontSize:12, color:"#705040" }}>今日無排班</div>}
      </div>

      {/* Todos */}
      {todos.length > 0 && (
        <div style={{ marginBottom:12 }}>
          <div style={s.sectionTitle}>待辦事項</div>
          {todos.map((t,i) => (
            <div key={i} style={{ ...s.card, padding:"10px 14px", marginBottom:8,
                                   borderLeft:`4px solid ${t.color}`,
                                   display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:18 }}>{t.icon}</span>
              <span style={{ fontSize:13 }}>{t.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Urgent announcements */}
      {urgentAnn.length > 0 && (
        <div style={{ marginBottom:12 }}>
          <div style={s.sectionTitle}>重要公告</div>
          {urgentAnn.map(a => (
            <div key={a.id} style={{ ...s.card, borderLeft:`4px solid ${C.accent}`, padding:"12px 14px" }}>
              <div style={{ fontSize:13, fontWeight:800, marginBottom:4 }}>{a.title}</div>
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
            ? <div style={{ fontSize:12, color:C.green, fontWeight:800, textAlign:"center", marginTop:4 }}>
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
            <div style={{ fontSize:18, fontWeight:800, color:st.color }}>{st.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PUNCH TAB
// ─────────────────────────────────────────────
function PunchTab({ user, punchState, setPunchState, todaySchedule, locations, workLoc, setWorkLoc }) {
  const time = useTime();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [groomFile, setGroomFile] = useState(null);   // 儀容照檔案
  const [groomPreview, setGroomPreview] = useState(""); // 預覽
  const groomRef = useRef();

  const getGPS = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject("此裝置不支援GPS"); return; }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => reject("無法取得位置，請確認已開啟定位權限"),
      { timeout:10000 }
    );
  });

  const handleGroomPhoto = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setGroomFile(f);
    setGroomPreview(URL.createObjectURL(f));
  };

  const doPunch = async (type) => {
    if (type === "in" && !workLoc) { setErr("請先選擇今日上班地點"); return; }
    if (type === "in" && !groomFile) {
      setErr("請先拍攝儀容照(帽子、口罩、制服)再打卡");
      return;
    }
    setLoading(true); setErr(""); setMsg("");
    try {
      const coords = await getGPS();
      const now = new Date();
      const timeStr = now.toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"});
      // 上班:先上傳儀容照
      let photoUrl = "";
      if (type === "in" && groomFile) {
        setMsg("儀容照上傳中…");
        photoUrl = await uploadPhoto(groomFile, {
          folder:"儀容照片", date:todayStr(),
          loc:todaySchedule?.location||"", name:user.name,
        });
        setMsg("");
      }
      const data = {
        action: "punch",
        date: todayStr(),
        empId: user.id,
        name: user.name,
        scheduleId: todaySchedule?.id || "",
        type: type === "in" ? "上班" : "下班",
        time: now.toISOString(),
        lat: coords.lat,
        lng: coords.lng,
        location: todaySchedule?.location || "未知地點",
        offline: false,
        photoUrl,
      };
      const res = await apiPost(data);
      if (res.success) {
        if (type === "in") setPunchState(p => ({...p, inTime:timeStr, coords}));
        else setPunchState(p => ({...p, outTime:timeStr}));
        setMsg(type === "in" ? `✅ 上班打卡成功！${timeStr}` : `✅ 下班打卡成功！${timeStr}`);
      } else {
        setErr("打卡失敗：" + (res.error || "請重試"));
      }
    } catch(e) {
      setErr(typeof e === "string" ? e : "打卡失敗，請重試");
    }
    setLoading(false);
  };

  return (
    <div>
      <div style={{ ...s.card, background:`linear-gradient(135deg,#0a1a2a,#0e2030)`,
                    border:`1px solid #1a3050`, textAlign:"center" }}>
        <div style={{ fontSize:11, color:"#6080a0", marginBottom:4 }}>{dateStr()}</div>
        <div style={{ fontSize:44, fontWeight:200, color:"#b0d0f0", letterSpacing:3,
                      fontVariantNumeric:"tabular-nums" }}>{time}</div>
        {todaySchedule && (
          <div style={{ marginTop:6, fontSize:12, color:"#7090b0" }}>
            📍 {todaySchedule.location} ⏰ {todaySchedule.start}–{todaySchedule.end}
          </div>
        )}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:16 }}>
        <div style={{ ...s.card, textAlign:"center" }}>
          <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>上班打卡</div>
          <div style={{ fontSize:20, fontWeight:800, color:punchState.inTime?C.green:C.light }}>
            {punchState.inTime || "—"}
          </div>
        </div>
        <div style={{ ...s.card, textAlign:"center" }}>
          <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>下班打卡</div>
          <div style={{ fontSize:20, fontWeight:800, color:punchState.outTime?C.blue:C.light }}>
            {punchState.outTime || "—"}
          </div>
        </div>
      </div>

      {punchState.coords && (
        <div style={{ ...s.card, padding:"10px 14px", marginBottom:12,
                      background:C.greenBg, border:`1px solid ${C.green}44` }}>
          <div style={{ fontSize:11, color:C.green }}>
            📍 定位成功：{punchState.coords.lat.toFixed(5)}, {punchState.coords.lng.toFixed(5)}
          </div>
        </div>
      )}

      {msg && <div style={{ ...s.card, padding:"10px 14px", marginBottom:12,
                             background:C.greenBg, border:`1px solid ${C.green}44` }}>
        <div style={{ fontSize:13, color:C.green, fontWeight:700 }}>{msg}</div>
      </div>}

      {err && <div style={{ ...s.card, padding:"10px 14px", marginBottom:12,
                             background:C.redBg, border:`1px solid ${C.red}44` }}>
        <div style={{ fontSize:13, color:C.red }}>{err}</div>
      </div>}

      {/* 上班地點選擇(含活動) */}
      {!punchState.inTime && (
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
        </div>
      )}

      {/* 儀容照(上班打卡前必拍) */}
      {!punchState.inTime && (
        <div style={{ ...s.card, marginBottom:12 }}>
          <div style={s.sectionTitle}>儀容照 <span style={{ color:C.accent }}>*上班必拍</span></div>
          <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>
            請確認帽子、口罩、制服穿戴整齊後自拍
          </div>
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            {groomPreview && (
              <img src={groomPreview} alt="" style={{ width:72, height:72,
                objectFit:"cover", borderRadius:12, border:`2px solid ${C.green}` }}/>
            )}
            <input ref={groomRef} type="file" accept="image/*" capture="user"
              onChange={handleGroomPhoto} style={{ display:"none" }}/>
            <button onClick={()=>groomRef.current.click()} style={{
              ...s.btn("ghost"), flex:1, gap:8,
              border:`2px dashed ${groomFile?C.green:C.border}`,
              color:groomFile?C.green:C.muted }}>
              🤳 {groomFile ? "重新拍攝" : "拍攝儀容照"}
            </button>
          </div>
        </div>
      )}

      <div style={{ display:"flex", gap:10 }}>
        <button disabled={!!punchState.inTime || loading} onClick={()=>doPunch("in")}
          style={{ ...s.btn("green"), flex:1,
                   opacity:(punchState.inTime||(!groomFile&&!punchState.inTime))?.5:1 }}>
          {loading && !punchState.inTime ? "處理中…" : punchState.inTime ? "✓ 已打卡" : "⬆ 上班打卡"}
        </button>
        <button disabled={!punchState.inTime || !!punchState.outTime || loading}
          onClick={()=>doPunch("out")}
          style={{ ...s.btn("blue"), flex:1,
                   opacity:(!punchState.inTime || punchState.outTime)?.5:1 }}>
          {punchState.outTime ? "✓ 已退勤" : "⬇ 下班打卡"}
        </button>
      </div>

      {!todaySchedule && (
        <div style={{ ...s.card, marginTop:12, textAlign:"center", color:C.muted, fontSize:13 }}>
          今日無排班，如有臨時出班請聯絡大隊長
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// OPS TAB
// ─────────────────────────────────────────────
function OpsTab({ user, checklistDone, setChecklistDone, todaySchedule, locations }) {
  const [view, setView] = useState("menu");
  return (
    <div>
      {view==="menu"  && <OpsMenu checklistDone={checklistDone} setView={setView} />}
      {view==="open"  && <OpenChecklist user={user} todaySchedule={todaySchedule}
                            onDone={()=>{ setChecklistDone(p=>({...p,open:true})); setView("menu"); }}
                            onBack={()=>setView("menu")} />}
      {view==="close" && <CloseChecklist user={user} todaySchedule={todaySchedule}
                            locations={locations}
                            onDone={()=>{ setChecklistDone(p=>({...p,close:true})); setView("menu"); }}
                            onBack={()=>setView("menu")} />}
    </div>
  );
}

function OpsMenu({ checklistDone, setView }) {
  return (
    <div>
      <div style={{ ...s.card, background:`linear-gradient(135deg,#0a1a10,#102018)`,
                    border:`1px solid #1a4028`, textAlign:"center", padding:20 }}>
        <div style={{ fontSize:32, marginBottom:8 }}>📋</div>
        <div style={{ fontSize:16, fontWeight:800, color:"#90d0a0" }}>今日盤點</div>
        <div style={{ fontSize:12, color:"#5a8068", marginTop:4 }}>上班填開店，下班填收店</div>
      </div>
      {[
        { key:"open",  icon:"🌅", title:"開店盤點", sub:"面糊起始量登記", color:C.gold, done:checklistDone.open },
        { key:"close", icon:"🌙", title:"收店盤點", sub:"面糊剩餘＋業績＋清潔照片", color:C.blue, done:checklistDone.close },
      ].map(item => (
        <button key={item.key} onClick={()=>setView(item.key)} style={{
          ...s.card, display:"flex", alignItems:"center", gap:14, border:"none",
          cursor:"pointer", textAlign:"left", padding:"16px 18px", width:"100%",
          background: item.done ? C.greenBg : C.card,
          borderLeft:`4px solid ${item.done ? C.green : item.color}`,
        }}>
          <span style={{ fontSize:28 }}>{item.icon}</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:800, color:item.done?C.green:C.text }}>
              {item.title} {item.done ? "✓" : ""}
            </div>
            <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>{item.sub}</div>
          </div>
          {!item.done && <span style={{ color:C.light }}>›</span>}
        </button>
      ))}
    </div>
  );
}

function OpenChecklist({ user, todaySchedule, onDone, onBack }) {
  const flavors = ["原味","可可","紅玉","抹茶"];
  const [amounts, setAmounts] = useState({ 原味:"",可可:"",紅玉:"",抹茶:"" });
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const allFilled = flavors.every(f => amounts[f] !== "");

  const handleSubmit = async () => {
    setSubmitting(true); setErr("");
    try {
      const res = await apiPost({
        action: "openStore",
        date: todayStr(),
        scheduleId: todaySchedule?.id || "",
        empId: user.id, name: user.name,
        location: todaySchedule?.location || "",
        original: amounts["原味"], cocoa: amounts["可可"],
        ruby: amounts["紅玉"], matcha: amounts["抹茶"],
        note,
      });
      if (res.success) { setDone(true); setTimeout(onDone, 1200); }
      else setErr("送出失敗：" + (res.error || "請重試"));
    } catch(e) { setErr("網路錯誤，請重試"); }
    setSubmitting(false);
  };

  if (done) return (
    <div style={{ textAlign:"center", padding:40 }}>
      <div style={{ fontSize:60, marginBottom:16 }}>✅</div>
      <div style={{ fontSize:18, fontWeight:800, color:C.green }}>開店盤點完成！</div>
      <div style={{ fontSize:13, color:C.muted, marginTop:8 }}>資料已上傳至系統</div>
    </div>
  );

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
        <button onClick={onBack} style={{ background:"none", border:"none",
                                          cursor:"pointer", color:C.muted, fontSize:20 }}>‹</button>
        <div style={{ fontSize:16, fontWeight:800 }}>🌅 開店盤點</div>
      </div>
      <div style={s.card}>
        <div style={s.sectionTitle}>面糊起始數量（包）</div>
        {flavors.map(f => (
          <div key={f} style={{ marginBottom:12 }}>
            <label style={s.label}>{f}面糊</label>
            <input type="number" placeholder="請輸入包數"
              value={amounts[f]} onChange={e=>setAmounts(p=>({...p,[f]:e.target.value}))}
              style={s.input}/>
          </div>
        ))}
      </div>
      <div style={s.card}>
        <div style={s.sectionTitle}>前班交接事項</div>
        <textarea value={note} onChange={e=>setNote(e.target.value)}
          placeholder="有任何需要注意的事項（選填）"
          style={{ ...s.input, minHeight:80, resize:"vertical" }}/>
      </div>
      {err && <div style={{ color:C.red, fontSize:12, textAlign:"center", marginBottom:10 }}>{err}</div>}
      <button onClick={handleSubmit} disabled={!allFilled || submitting}
        style={{ ...s.btn("primary"), opacity:allFilled&&!submitting?1:.5 }}>
        {submitting ? "送出中…" : "確認送出開店盤點"}
      </button>
    </div>
  );
}

function CloseChecklist({ user, todaySchedule, locations, onDone, onBack }) {
  const flavors = ["原味","可可","紅玉","抹茶"];
  const [amounts, setAmounts] = useState({ 原味:"",可可:"",紅玉:"",抹茶:"" });
  const [restock, setRestock] = useState({ 原味:"0",可可:"0",紅玉:"0",抹茶:"0" });
  const [revenue, setRevenue] = useState("");
  const [cash, setCash] = useState("");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef();

  // 依櫃位類型切換業績輸入(C份數 → 輸入份數)
  const locInfo = (locations || {})[todaySchedule?.location] || {};
  const isCount = locInfo.type === "C份數";

  const handlePhoto = (e) => {
    const files = Array.from(e.target.files);
    const previews = files.map(f => ({ name:f.name, url:URL.createObjectURL(f), file:f }));
    setPhotos(p => [...p, ...previews]);
  };

  const allFilled = flavors.every(f => amounts[f] !== "") && revenue !== "" && cash !== "" && photos.length > 0;

  const handleSubmit = async () => {
    setSubmitting(true); setErr("");
    try {
      // 逐張上傳清潔照片到 Google Drive
      const urls = [];
      for (let i = 0; i < photos.length; i++) {
        setProgress(`照片上傳中 ${i+1}/${photos.length}…`);
        const u = await uploadPhoto(photos[i].file, {
          folder:"清潔照片", date:todayStr(),
          loc:todaySchedule?.location||"", name:user.name,
        });
        if (u) urls.push(u);
      }
      setProgress("資料送出中…");
      const res = await apiPost({
        action: "closeStore",
        date: todayStr(),
        scheduleId: todaySchedule?.id || "",
        empId: user.id, name: user.name,
        location: todaySchedule?.location || "",
        remOriginal: amounts["原味"], remCocoa: amounts["可可"],
        remRuby: amounts["紅玉"], remMatcha: amounts["抹茶"],
        rsOriginal: restock["原味"], rsCocoa: restock["可可"],
        rsRuby: restock["紅玉"], rsMatcha: restock["抹茶"],
        revenue, cash,
        photoUrl: urls.join(" , "),
        handoverNote: note,
      });
      setProgress("");
      if (res.success) { setDone(true); setTimeout(onDone, 1400); }
      else setErr("送出失敗：" + (res.error || "請重試"));
    } catch(e) { setErr("網路錯誤，請重試"); setProgress(""); }
    setSubmitting(false);
  };

  if (done) return (
    <div style={{ textAlign:"center", padding:40 }}>
      <div style={{ fontSize:60, marginBottom:16 }}>✅</div>
      <div style={{ fontSize:18, fontWeight:800, color:C.green }}>收店盤點完成！</div>
      <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>辛苦了，掰掰！👋</div>
    </div>
  );

  return (
    <div>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
        <button onClick={onBack} style={{ background:"none", border:"none",
                                          cursor:"pointer", color:C.muted, fontSize:20 }}>‹</button>
        <div style={{ fontSize:16, fontWeight:800 }}>🌙 收店盤點</div>
      </div>

      <div style={s.card}>
        <div style={s.sectionTitle}>面糊剩餘數量（包）</div>
        {flavors.map(f => (
          <div key={f} style={{ marginBottom:12 }}>
            <label style={s.label}>{f}面糊剩餘</label>
            <input type="number" placeholder="請輸入剩餘包數"
              value={amounts[f]} onChange={e=>setAmounts(p=>({...p,[f]:e.target.value}))}
              style={s.input}/>
          </div>
        ))}
      </div>

      {/* 當日進貨 */}
      <div style={s.card}>
        <div style={s.sectionTitle}>當日進貨量（包,無進貨免填）</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {flavors.map(f => (
            <div key={f}>
              <label style={s.label}>{f}進貨</label>
              <input type="number" placeholder="0"
                value={restock[f]} onChange={e=>setRestock(p=>({...p,[f]:e.target.value}))}
                style={s.input}/>
            </div>
          ))}
        </div>
        <div style={{ fontSize:11, color:C.muted, marginTop:8 }}>
          ※ 消耗計算:開店量 ＋ 進貨 − 剩餘 = 實際消耗
        </div>
      </div>

      <div style={s.card}>
        <div style={s.sectionTitle}>營業數據{isCount && <span style={{ color:C.accent }}>(份數櫃位)</span>}</div>
        <div style={{ marginBottom:12 }}>
          <label style={s.label}>{isCount ? "當日販售份數(份)" : "當日營業額（元）"}</label>
          <input type="number"
            placeholder={isCount ? `請輸入份數(每份$${locInfo.unitPrice||70}自動換算)` : "請輸入今日實際營業額"}
            value={revenue} onChange={e=>setRevenue(e.target.value)} style={s.input}/>
        </div>
        <div>
          <label style={s.label}>零用金結餘（元）</label>
          <input type="number" placeholder="請輸入零用金結餘"
            value={cash} onChange={e=>setCash(e.target.value)} style={s.input}/>
        </div>
      </div>

      {/* 清潔照片 */}
      <div style={s.card}>
        <div style={s.sectionTitle}>清潔照片 <span style={{ color:C.accent }}>*必填</span></div>
        <div style={{ fontSize:12, color:C.muted, marginBottom:12, lineHeight:1.6 }}>
          請拍攝收店清潔完成照片（檯面、設備、地板），至少1張
        </div>
        {photos.length > 0 && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }}>
            {photos.map((p,i) => (
              <div key={i} style={{ position:"relative", borderRadius:10,
                                     overflow:"hidden", aspectRatio:"1", background:C.warm }}>
                <img src={p.url} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }}/>
                <button onClick={()=>setPhotos(ps=>ps.filter((_,idx)=>idx!==i))} style={{
                  position:"absolute", top:4, right:4, width:20, height:20,
                  borderRadius:10, background:"rgba(0,0,0,0.6)", color:"#fff",
                  border:"none", cursor:"pointer", fontSize:12,
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}>×</button>
                <div style={{ position:"absolute", bottom:0, left:0, right:0,
                               background:"rgba(0,0,0,0.5)", color:"#fff",
                               fontSize:9, padding:"2px 4px", textAlign:"center" }}>
                  {todayStr()}
                </div>
              </div>
            ))}
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple
          capture="environment" onChange={handlePhoto} style={{ display:"none" }}/>
        <button onClick={()=>fileRef.current.click()} style={{
          ...s.btn("ghost"), gap:8,
          border:`2px dashed ${photos.length>0?C.green:C.border}`,
          color:photos.length>0?C.green:C.muted,
        }}>
          <span style={{ fontSize:20 }}>📸</span>
          {photos.length>0 ? `再新增照片（已拍 ${photos.length} 張）` : "拍攝清潔照片"}
        </button>
      </div>

      <div style={s.card}>
        <div style={s.sectionTitle}>交班備注</div>
        <textarea value={note} onChange={e=>setNote(e.target.value)}
          placeholder="留給下一班的注意事項（選填）"
          style={{ ...s.input, minHeight:80, resize:"vertical" }}/>
      </div>

      {err && <div style={{ color:C.red, fontSize:12, textAlign:"center", marginBottom:10 }}>{err}</div>}
      {!allFilled && (
        <div style={{ fontSize:12, color:C.muted, textAlign:"center", marginBottom:10 }}>
          ⚠️ 請完整填寫面糊剩餘、業績、零用金並上傳清潔照片
        </div>
      )}
      <button onClick={handleSubmit} disabled={!allFilled||submitting}
        style={{ ...s.btn("primary"), opacity:allFilled&&!submitting?1:.5 }}>
        {submitting ? (progress || "送出中…") : "確認送出收店盤點"}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// INFO TAB
// ─────────────────────────────────────────────
function InfoTab({ user, staffInfo, salary, schedule, announcements, onRefresh }) {
  const checkupDays = staffInfo?.checkupExpiry ? daysUntil(staffInfo.checkupExpiry) : 999;
  const latestSalary = salary.sort((a,b)=>String(b["年月"]).localeCompare(String(a["年月"])))[0];

  return (
    <div>
      <div style={{ ...s.card, background:`linear-gradient(135deg,#1a0a04,#2e1608)`,
                    border:`1px solid #5a2010`, display:"flex", gap:16, alignItems:"center" }}>
        <div style={{ width:56, height:56, borderRadius:28, flexShrink:0,
                      background:`linear-gradient(135deg,${C.accent},${C.accentL})`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:24, fontWeight:900, color:"#fff" }}>{user.avatar}</div>
        <div>
          <div style={{ fontSize:18, fontWeight:800, color:"#f0d0b8" }}>{user.name}</div>
          <div style={{ fontSize:12, color:"#a07060", marginTop:2 }}>{user.position} · {user.id}</div>
          <div style={{ fontSize:11, color:"#705040", marginTop:4 }}>🎂 {user.birthday}</div>
        </div>
      </div>

      <button onClick={onRefresh} style={{ ...s.btn(), marginBottom:12 }}>🔄 重新整理資料</button>

      {checkupDays <= 30 && checkupDays > 0 && (
        <div style={{ ...s.card, background:C.redBg, border:`1px solid ${C.red}44`,
                      borderLeft:`4px solid ${C.red}` }}>
          <div style={{ fontSize:13, fontWeight:800, color:C.red }}>
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
          <div style={{ fontSize:32, fontWeight:800, color:C.gold, textAlign:"center" }}>
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
// GUIDE TAB
// ─────────────────────────────────────────────
function GuideTab() {
  const [open, setOpen] = useState(null);
  const sections = [
    { id:"basic", icon:"⏱", title:"基本工時薪資", color:C.accent, content:(
      <div>
        {[["第1–8小時","× 1.00 基本工資"],["第9–10小時","× 1.33 加班薪資1"],
          ["第11–12小時","× 1.67 加班薪資2"],["超過12小時","× 2.00 加班薪資3"],
          ["國定假日","全部時段 × 2"]].map(([r,v]) => (
          <div key={r} style={{ display:"flex", justifyContent:"space-between",
                                padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
            <span style={{ fontSize:13, color:C.muted }}>{r}</span>
            <span style={{ fontSize:13, fontWeight:700, color:C.accent }}>{v}</span>
          </div>
        ))}
      </div>
    )},
    { id:"bonus", icon:"🎯", title:"業績獎金（單人/雙人）", color:C.gold, content:(
      <div>
        <div style={{ fontSize:12, color:C.muted, marginBottom:12 }}>
          雙人值班門檻×2，達標後每人各得相同獎金
        </div>
        {[["單人 >$10,000 / 雙人 >$25,000","$500"],
          ["單人 >$12,500 / 雙人 >$30,000","$700"],
          ["單人 >$15,000 / 雙人 >$37,500","$1,000"]].map(([r,v]) => (
          <div key={r} style={{ display:"flex", justifyContent:"space-between",
                                padding:"8px 0", borderBottom:`1px solid ${C.border}` }}>
            <span style={{ fontSize:12, color:C.muted, flex:2 }}>{r}</span>
            <span style={{ fontSize:16, fontWeight:800, color:C.gold }}>{v}</span>
          </div>
        ))}
      </div>
    )},
    { id:"group", icon:"🏪", title:"團體獎金", color:C.green, content:(
      <div style={{ fontSize:13, color:C.muted, lineHeight:2 }}>
        月計算業績超過 <strong style={{color:C.text}}>$200,000</strong> 時，依工時比例分配。<br/>
        計算方式：銷貨額 × 80% → ÷ 當月天數 × 30 = 30天基準<br/>
        30天基準 &gt; $200,000 → 發放
      </div>
    )},
    { id:"allowance", icon:"🌟", title:"各項津貼", color:C.blue, content:(
      <div>
        {[["O 技能津貼","累計工時>180hr","每小時 +$20"],
          ["P 貢獻津貼","≥1080/2160/3240/4320hr","每小時 +$5/10/15/20"],
          ["Q 長青津貼","年滿50歲","每小時 +$10"],
          ["R 生日津貼","當月排班≥80hr","$600/1,200/2,400 依累計工時"],
          ["S 三節津貼","春節/端午/中秋","計算方式同生日津貼"],
          ["T 職務加給","有額外任務","另行議定"],
          ["⭐ 頂級組合","累計≥4320hr＋60歲以上","每小時津貼 $60！"]
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
      <div style={{ ...s.card, background:`linear-gradient(135deg,#1a1208,#2a1e10)`,
                    border:`1px solid #4a3020`, textAlign:"center", padding:20, marginBottom:16 }}>
        <div style={{ fontSize:28, marginBottom:6 }}>📖</div>
        <div style={{ fontSize:16, fontWeight:800, color:"#f0d0a0" }}>薪資制度說明書</div>
        <div style={{ fontSize:11, color:"#907060", marginTop:4 }}>
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
            <span style={{ fontSize:14, fontWeight:800, color:sec.color, flex:1 }}>{sec.title}</span>
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
    : <span style={{ fontSize:11, fontWeight:800, color: v>=0?C.green:C.red }}>{v>=0?"▲":"▼"} {Math.abs(v)}%</span>;

  return (
    <div>
      <div style={{ ...s.card, background:`linear-gradient(135deg,#1a0a04,#2e1608)`, border:`1px solid #5a2010` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:11, color:"#a07060" }}>📊 管理儀表板 · {user.role>=3?"全部櫃位":"負責櫃位"}</div>
            <div style={{ fontSize:12, color:"#c09070", marginTop:2 }}>{d?.asOf||"—"}累積營業額</div>
          </div>
          <select value={ym} onChange={e=>setYm(e.target.value)}
            style={{ ...s.input, width:"auto", padding:"6px 10px", fontSize:12 }}>
            {months.map(m=><option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div style={{ fontSize:38, fontWeight:900, color:"#f0d0b8", marginTop:8, letterSpacing:1 }}>
          {loading?"…":fmt(d?.total)}
        </div>
        {d && <div style={{ fontSize:12, color:"#c09070" }}>上月同期 {fmt(d.totalPrev)} &nbsp;<Pct v={d.totalPct}/></div>}
      </div>

      {err && <div style={{ ...s.card, background:C.redBg, color:C.red, fontSize:13 }}>{err}</div>}

      {d && d.today.length>0 && (
        <div style={s.card}>
          <div style={s.sectionTitle}>今日即時(已收店)</div>
          {d.today.map(t=>(
            <div key={t.name} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
              <span style={{ fontSize:13 }}>{t.name}</span>
              <span style={{ fontSize:13, fontWeight:800, color:C.green }}>{fmt(t.rev)} ✅</span>
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
                  <div style={{ width:w+"%", height:"100%", background:`linear-gradient(90deg,${C.accent},${C.accentL})`, borderRadius:4 }}/>
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
                  <span style={{ fontWeight:800, color: ok?C.green:C.gold }}>{p.hours} / {p.target} hr {ok?"✅":""}</span>
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
    </div>
  );
}
