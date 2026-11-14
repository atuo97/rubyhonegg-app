import { createPortal } from "react-dom";
// ─────────────────────────────────────────────
// 🌌 宇宙辦公室分頁(全員可見)
// 依打卡狀態，讓隊員的角色出現在他上班的櫃位
// v1.17:寵物、徽章、生日派對、冠軍旗＋煙火、天氣、節日、基金解鎖家具、隊員互動
// ─────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { Flash } from "../TopToast.jsx";
import { MOUNT_INFO } from "../Mount40.jsx";
import { createOffice, SCENES, SCENE_KEYS, sceneOf, shortLoc, tabOf } from "./officeScene.js";
import BoardModal41 from "./BoardModal41.jsx";
import Claw42 from "../Claw42.jsx";
import PhotoBooth44 from "../Photo44.jsx";
import GameTab from "../GameTab.jsx";
import { PetSprite, petLine } from "../pets/petSprites.jsx";
import { HeartDots } from "../Hearts36.jsx";
import { bgm, BgmAsk } from "../Bgm36.jsx";

const CSS = `
.uo-wrap{position:relative;border-radius:16px;overflow:hidden;background:#1d1b2e}
.uo-bubble{position:absolute;transform:translate(-50%,-100%);background:#fffaf2;color:#2b1d14;font-size:11px;line-height:1.35;padding:5px 8px;border-radius:9px;max-width:150px;box-shadow:0 3px 10px rgba(0,0,0,.35);transition:opacity .25s;white-space:normal}
.uo-bubble:after{content:"";position:absolute;left:50%;bottom:-5px;margin-left:-5px;border:5px solid transparent;border-top-color:#fffaf2;border-bottom:0}
.uo-boss{background:#ffe08a}.uo-boss:after{border-top-color:#ffe08a}
.uo-guest{background:#d6f5e3}.uo-guest:after{border-top-color:#d6f5e3}
.uo-tag{position:absolute;transform:translate(-50%,0);font-size:10px;font-weight:700;color:#fff;background:rgba(0,0,0,.45);padding:1px 6px;border-radius:6px;white-space:nowrap}
.uo-tagw{position:absolute;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:none}
.uo-tagw .uo-tag{position:static;transform:none}
.uo-say{font-size:10px;line-height:1.3;color:#2b1d14;background:rgba(255,250,242,.93);padding:1px 7px;border-radius:7px;max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.uo-rest{background:rgba(90,90,110,.6)}
.uo-petsay{background:#fff3c4;font-size:10.5px;padding:3px 7px}.uo-petsay:after{border-top-color:#fff3c4}
.uo-frame_wood{background:#8e5b3a;border:1.5px solid #d4a373}
.uo-ctl{position:absolute;z-index:3;display:flex;gap:6px}
.uo-ctl button{width:34px;height:34px;border-radius:10px;border:none;background:rgba(20,18,36,.62);color:#fff;font-size:17px;line-height:34px;padding:0;cursor:pointer;font-family:inherit;backdrop-filter:blur(4px)}
.uo-full{position:fixed!important;inset:0;z-index:250;border-radius:0!important}
.uo-ftabs{position:absolute;z-index:3;left:0;right:50px;top:calc(8px + env(safe-area-inset-top));padding:0 6px 0 10px;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}
.uo-ftabs button{flex:0 0 auto;border:none;border-radius:10px;padding:6px 9px;font-size:12px;font-weight:600;cursor:pointer;background:rgba(20,18,36,.55);color:#fff;font-family:inherit;backdrop-filter:blur(4px)}
.uo-ftabs button.on{background:rgba(192,57,43,.92)}
.uo-card{position:absolute;z-index:4;left:10px;right:10px;bottom:calc(10px + env(safe-area-inset-bottom));max-width:420px;margin:0 auto;background:rgba(255,250,242,.97);border-radius:14px;padding:10px 12px;box-shadow:0 6px 20px rgba(0,0,0,.35);color:#2b1d14}
.uo-frame_glow{background:#c0392b;border:1.5px solid #ffe066;box-shadow:0 0 8px #ffe066}
.uo-title{font-size:9.5px;font-weight:700;color:#6b3d00;background:linear-gradient(#fff1b8,#ffd36b);padding:0 6px;border-radius:6px;white-space:nowrap}
.uo-x_frame{background:#2f6fb0;border:1.5px solid #fff;box-shadow:0 0 6px #bfe3ff}
.uo-c_frame{background:#b81d1d;border:1.5px solid #f1c40f;box-shadow:0 0 6px #f1c40f}
.uo-og_frame{background:linear-gradient(90deg,#8a5a00,#f1c40f,#8a5a00);color:#2b1d14;border:1.5px solid #fff3b0;box-shadow:0 0 8px #f1c40f}
`;

// 節日(農曆日期每年要更新;週年日由後端「遊戲參數」提供)
const HOLIDAYS = [
  ["xmas", "12-20", "12-26"], ["newyear", "12-31", "12-31"], ["newyear", "01-01", "01-02"], ["halloween", "10-25", "10-31"],
  ["lunar", "2027-02-03", "2027-02-12"], ["lantern", "2027-02-19", "2027-02-21"], ["dragonboat", "2027-06-07", "2027-06-09"],
  ["midautumn", "2027-09-13", "2027-09-15"],
];
function holidayOf(today, anniv) {
  const md = today.slice(5);
  if (anniv && md === anniv) return "anniversary";
  for (const [k, a, b] of HOLIDAYS) {
    if (a.length === 10 ? (today >= a && today <= b) : (md >= a && md <= b)) return k;
  }
  return "";
}
// v1.47 房間功能列（也給樂園「大樓導覽」用）
export const ROOM_FUNCS = {
  lobby: [["benefit", "🎁 福利補助"], ["idea", "📮 意見箱"], ["attend", "☀️ 早安牆"]],
  office: [["rev", "⚡ 即時營業額 PK"], ["praise", "⭐ 讚美牆"], ["status", "📋 各櫃位看板"]],
  seats: [["thanks", "💌 感謝牆"], ["seat", "🪑 我的座位"]],
  canteen: [["menu", "🍱 今日菜單"], ["cake", "🧇 請吃雞蛋糕"]],
  gameroom: [["games", "🕹️ 8 款小遊戲"], ["claw", "🧸 夾娃娃"], ["gacha", "🎰 扭蛋機"], ["photo", "📸 拍貼機"], ["arena", "⚔️ 切磋對戰"], ["rank", "🏆 本週排行榜"]],
  gym: [["exercise", "💪 去運動"], ["sport", "🏃 比賽公告・完賽榜"], ["boss", "👹 大魔王"]],
  study: [["sop", "📖 SOP 教學"], ["cert", "🎓 證照榮譽牆"]],
  captain: [["knock", "🚪 敲門留言"]],
};
export const ARCADE_GAMES = [["catch", "🧺", "接雞蛋糕"], ["memory", "🃏", "翻翻樂"], ["breakout", "🧱", "打磚塊"], ["oven", "🔥", "烤爐大挑戰"], ["runner", "🏃", "寵物跑酷"], ["match", "🧇", "消消樂"], ["stack", "🍰", "疊疊樂"], ["batter1", "⚔️", "麵糊大作戰"]];
const INTERACTIONS = [["cheer", "💪", "加油打氣"], ["like", "👍", "按讚"], ["nod", "🙇", "點頭致意"], ["smile", "😊", "微笑"]];

// 示範用：沒人上班時也能看到效果
const DEMO = [
  { id: "demo-egg", name: "雞蛋", location: "工廠" },
  { id: "demo-wy", name: "宛芸", location: "21快閃櫃南港Lalaport" },
  { id: "demo-yz", name: "瑜珍", location: "02正櫃國家音樂廳" },
  { id: "demo-qq", name: "千芊", location: "01正櫃遠百信義" },
  { id: "demo-a", name: "小安", location: "03正櫃遠百竹北" },
  { id: "demo-b", name: "阿德", location: "11正櫃新莊棒球場" },
  { id: "demo-c", name: "小米", location: "01正櫃遠百信義" },
];

async function pool(items, n, fn, onProgress) {
  const out = []; let i = 0, done = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); onProgress && onProgress(++done); }
  }));
  return out;
}

// v1.26 快速選項改讀〈供貨價格〉勾「常用」的品項（後端 getShortages 帶 quick）；後端沒回傳時用這組
const QUICK_DEFAULT = ["原味麵糊", "口味麵糊", "紙袋", "紙盒", "竹籤", "塑膠提袋", "機器鍍膜"];

// v1.24：麵糊只分原味／其他口味（其他＝可可＋紅玉＋抹茶＋黑糖＋芝麻）
const batter2 = rem => { if (!rem) return null; let o = 0, any = false; Object.keys(rem).forEach(k => { if (k !== "原味" && rem[k] != null) { o += +rem[k] || 0; any = true; } }); return { 原味: rem["原味"] == null ? null : rem["原味"], 其他口味: any ? Math.round(o * 100) / 100 : null }; };
const fcLow = f => !!(f && f.days !== null && f.days !== undefined && f.days < 2);
const fcDays = f => !f || f.days === null || f.days === undefined ? "—" : f.days >= 60 ? "60 天以上" : `${f.days} 天`;
export default function UniverseTab({ user, apiGet, apiPost, todayStr, C, s, onEditAvatar, onOpenMaterials, onOpenHearts, onOpenBenefit, onOpenGame, initRoom, autoOpen, onAutoDone, onNav }) {
  const boxRef = useRef(null);
  const engine = useRef(null);
  const [view, setView] = useState(initRoom || "seats");   // v1.47 進宇宙辦公室預設在休息區（從別頁返回時回到原本那間）
  const [board, setBoard] = useState(null);         // v1.41 點看板放大
  const [claw, setClaw] = useState(false);          // v1.42 夾娃娃機
  const [photo, setPhoto] = useState(false);        // v1.44 v3 拍貼機
  const [gacha, setGacha] = useState(false);        // v1.46 點扭蛋機直接轉
  const openGame = useRef(() => {}); openGame.current = id => onOpenGame && onOpenGame(id, "gameroom");   // v1.46 桌機 → 那款小遊戲（v1.47 玩完回遊戲室）
  const [gamesOpen, setGamesOpen] = useState(false);  // v1.47 功能列「8 款小遊戲」
  const [cakeOpen, setCakeOpen] = useState(false);    // v1.47 功能列「請吃雞蛋糕」選人
  const doFuncRef = useRef(() => {});
  const [thx, setThx] = useState(null);             // v1.42 感謝牆：要謝謝的人
  const [knock, setKnock] = useState(null);         // v1.44 隊長室敲門（null＝沒開）
  const [thxText, setThxText] = useState("");
  const openBf = useRef(() => {}); openBf.current = t => onOpenBenefit ? onOpenBenefit(t) : null;
  const [nowT, setNowT] = useState(Date.now());     // v1.41 開會、運動到期用
  const [myAct, setMyAct] = useState(null);         // v1.41 自己按的運動（先在畫面上動，不等後端）
  const [actOpen, setActOpen] = useState(false);
  const [where, setWhere] = useState("");           // v1.41 你在：○○
  useEffect(() => { const t = setInterval(() => setNowT(Date.now()), 15000); return () => clearInterval(t); }, []);
  const [full, setFull] = useState(false);          // v1.21 全螢幕
  const [picked, setPicked] = useState(null);       // v1.21 點人拉近 → 名片
  const bdayMusic = useRef(false);
  useEffect(() => () => { if (bdayMusic.current) bgm.pop("birthday"); }, []);
  const [locNo, setLocNo] = useState({});           // 場景 → 〈櫃位設定〉編號(分頁排序用)
  // v1.20:分頁只顯示營運中的門市(依〈櫃位設定〉狀態);辦公室、工廠、商店街一直都在
  const [openScenes, setOpenScenes] = useState(null);
  useEffect(() => {
    apiGet({ action: "getLocations" }, 1).then(r => {
      if (!r || !r.success) return;
      const set = {}, no = {};
      Object.keys(r.data || {}).forEach(n => {
        const st = r.data[n].status, k = sceneOf(n), m = String(n).match(/^\d+/);
        if (!st || st === "營運中") set[k] = 1;
        if (m && (no[k] == null || +m[0] < no[k])) no[k] = +m[0];
      });
      setOpenScenes(set); setLocNo(no); setLocInfo(r.data || {});
    });
  }, []);
  const [locInfo, setLocInfo] = useState({});       // v1.39 地點清單（大隊長前往、即時營業額用）
  const [goOpen, setGoOpen] = useState(false);       // v1.39 大隊長「前往…」選單
  const [revAmt, setRevAmt] = useState("");          // v1.39 即時營業額
  const [revMsg, setRevMsg] = useState(null);
  const [revBusy, setRevBusy] = useState(false);
  const [onDuty, setOnDuty] = useState([]);
  const [demo, setDemo] = useState(false);
  const [progress, setProgress] = useState("");
  const [updated, setUpdated] = useState("");
  const [err, setErr] = useState("");
  const [short, setShort] = useState([]);          // [{id, scene, item, by, time}]
  const [backendOk, setBackendOk] = useState(true);
  const [custom, setCustom] = useState("");
  const [quick, setQuick] = useState(QUICK_DEFAULT);
  const [game, setGame] = useState(null);          // gmScene
  const [feed, setFeed] = useState([]);
  const [target, setTarget] = useState(null);      // 互動對象
  const [imsg, setImsg] = useState("");
  const [sent, setSent] = useState({});            // 今天已送出的 "對象|類型"
  const seenFeed = useRef(null);
  // v1.21 櫃位營運連動：麵糊（最近一次收店盤點）、今日待取貨訂單
  const [batter, setBatter] = useState([]);
  const [orders, setOrders] = useState([]);
  const [pickup, setPickup] = useState(null);
  const loadOps = async () => {
    const [b, o] = await Promise.all([
      apiGet({ action: "getBatterStock", empId: user.id }, 0),
      apiGet({ action: "getOrders", empId: user.id, from: todayStr(), to: todayStr() }, 0),
    ]);
    if (b && b.success) setBatter(b.data || []);
    if (o && o.success) { setOrders(o.data || []); setPickup(o.pickup || null); }   // v1.48 待取貨只回筆數
  };

  useEffect(() => {
    engine.current = createOffice(boxRef.current, { selfId: user.id, onPick: p => setPicked(p ? { ...p } : null), onBoard: k => doFuncRef.current(k), onMeetEnd: () => setNowT(Date.now()) });
    return () => engine.current && engine.current.dispose();
  }, []);
  useEffect(() => { engine.current && engine.current.setView(view); }, [view]);
  const gameReady = !!game;
  useEffect(() => { if (!autoOpen || !gameReady) return; const t = setTimeout(() => { doFuncRef.current(autoOpen); onAutoDone && onAutoDone(); }, 600); return () => clearTimeout(t); }, [autoOpen, gameReady]);   // v1.47 從大樓導覽、相簿直接開功能
  useEffect(() => {
    engine.current && engine.current.setFullscreen && engine.current.setFullscreen(full);
    const prev = document.body.style.overflow;
    if (full) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [full]);
  // v1.19:場景名單＝在班的人＋隊長(連大隊長帳號,常駐辦公室)＋沒上班的自己(在休息區)
  const sceneList = (() => {
    if (demo) return DEMO;
    const people = (game && game.people) || [], pm = {}; people.forEach(p => (pm[String(p.id)] = p));
    const list = onDuty.map(p => ({ ...p, mgr: !!(pm[String(p.id)] || {}).mgr })), has = id => list.some(p => String(p.id) === String(id));
    const boss = game && game.boss;
    if (boss && !has(boss.id)) list.push({ id: boss.id, name: boss.name, location: "辦公室", isBoss: true, mgr: true, resting: true });   // v1.41 大隊長沒上班也在休息區（有座位坐自己的）
    // v1.41 沒上班的隊員全部在休息區（有買座位坐自己的，主管也一樣；最多 40 位）
    people.filter(p => !has(p.id)).slice(0, 40).forEach(p => list.push({ id: p.id, name: p.name, location: "辦公室", resting: true, mgr: !!p.mgr }));
    if (!has(user.id)) list.push({ id: user.id, name: user.nick || user.name, location: "辦公室", resting: true, mgr: user.role >= 3 });
    // v1.40 視察：Lv.3 以上選了「前往」的地點（大隊長舊資料 bossAt 也相容）
    const visits = { ...((game && game.visits) || {}) };
    if (boss && game && game.bossAt && game.bossAt.loc && !visits[boss.id]) visits[boss.id] = game.bossAt;
    Object.keys(visits).forEach(id => {
      const v = visits[id], i = list.findIndex(p => String(p.id) === String(id)); if (i < 0 || !v || !v.loc) return;
      const isB = boss && String(boss.id) === String(id);
      list[i] = v.loc === "休息區"
        ? { ...list[i], location: "休息區", resting: true, visiting: v.time || true, visitLabel: "休息一下 ☕" }
        : { ...list[i], location: v.loc, resting: false, visiting: v.time || true, visitLabel: isB ? "大隊長視察中 👀" : "視察中 👀" };
    });
    // v1.41 開會：Lv.2 以上主管到辦公區會議桌（只是動畫，不影響打卡）
    const mt = game && game.meeting, meetOn = mt && mt.end > nowT;
    // v1.41 運動室：沒上班的人按了運動就去運動室（3 分鐘）
    const acts = { ...((game && game.acts) || {}) }; if (myAct) acts[user.id] = myAct;
    const meal = new Set(((game && game.canteen && game.canteen.meal) || []).map(x => String(x.id)));
    if (meal.size && boss) meal.add(String(boss.id));
    const bday = new Set(((game && game.birthdays) || []).map(b => String(b.id)));
    list.forEach((p, i) => {
      const id = String(p.id);
      if (meetOn && (mt.ids || []).some(x => String(x) === id)) list[i] = { ...p, meeting: true };
      else if (p.resting && acts[id] && acts[id].until > nowT) list[i] = { ...p, act: acts[id].act };
      else if (p.resting && !p.visiting && meal.has(id)) list[i] = { ...p, meal: true };   // v1.44 今天和隊長吃飯 → 飯堂隊長的桌子
      else if (p.resting && !p.visiting && bday.has(id)) list[i] = { ...p, bday: true };   // v1.44 壽星 → 飯堂蛋糕桌
    });
    return list;
  })();
  const sceneSig = JSON.stringify(sceneList.map(p => [p.id, p.location, !!p.resting, !!p.isBoss, !!p.visiting, !!p.mgr, p.visitLabel || "", !!p.meeting, p.act || "", !!p.meal, !!p.bday]));
  useEffect(() => { engine.current && engine.current.setMeeting && engine.current.setMeeting(game && game.meeting ? +game.meeting.end : 0); }, [game && game.meeting && game.meeting.end]);
  // v1.41 你在：○○（每 3 秒看一次自己在哪個房間）
  useEffect(() => { const t = setInterval(() => { const k = engine.current && engine.current.whereIs && engine.current.whereIs(user.id); setWhere(k && SCENES[k] ? SCENES[k].name.replace("辦公區・休息區", "辦公區") : ""); }, 3000); return () => clearInterval(t); }, []);
  const locateMe = () => { const k = engine.current && engine.current.locate && engine.current.locate(user.id); if (k) setView(tabOf(k)); };   // v1.44 休息區是獨立的房間，會議桌仍在辦公區
  useEffect(() => { engine.current && engine.current.setCrew(sceneList); }, [sceneSig]);
  // 活動場景招牌：顯示在「活動」打卡的隊員填的活動名稱（後端 getOnDutyCrew 需回傳打卡備註 note，格式「活動:○○」）
  useEffect(() => {
    const ev = (onDuty || []).find(p => /活動/.test(p.location || "") && p.note);
    const name = ev ? String(ev.note).replace(/^活動[:：]\s*/, "") : "";
    engine.current && engine.current.setEventName && engine.current.setEventName(name || "今日活動");
  }, [onDuty]);
  useEffect(() => {
    const map = {};
    short.forEach(x => (map[x.scene] = map[x.scene] || []).push(x.item));
    engine.current && engine.current.setBoards(map);
  }, [short]);

  // ── 隊員自選造型(後端 getAvatars;尚未部署時安靜略過,小人維持預設外型)──
  const loadAvatars = async () => {
    const r = await apiGet({ action: "getAvatars" }, 0);
    if (r && r.success && engine.current) engine.current.setAvatars(r.data || {});
  };

  // ── 缺貨看板（後端：getShortages / addShortage / resolveShortage）──
  const loadShort = async () => {
    const r = await apiGet({ action: "getShortages" });
    if (r && r.success) { setBackendOk(true); setShort((r.data || []).map(x => ({ ...x, scene: sceneOf(x.location) }))); if (Array.isArray(r.quick) && r.quick.length) setQuick(r.quick); }
    else setBackendOk(false);
  };
  const addShort = async (item) => {
    item = String(item || "").trim(); if (!item) return;
    const loc = SCENES[view].name;
    const tmp = { id: "tmp-" + Date.now(), scene: view, location: loc, item, by: user.name, time: new Date().toISOString() };
    setShort(l => [...l, tmp]); setCustom("");
    if (backendOk) {
      const r = await apiPost({ action: "addShortage", location: loc, item, empId: user.id, name: user.name });
      if (r && r.success) loadShort(); else setBackendOk(false);
    }
  };
  // v1.26 工廠出貨：已發貨（Lv.3）
  const shipShort = async (x) => {
    setShort(l => l.map(y => y.id === x.id ? { ...y, status: "已發貨", shipBy: user.name, shipAt: "剛剛" } : y));
    const r = await apiPost({ action: "shipShortage", id: x.id, empId: user.id });
    if (!(r && r.success)) { alert((r && r.error) || "沒有成功，請再試一次"); loadShort(); }
  };
  const resolveShort = async (x) => {
    setShort(l => l.filter(y => y.id !== x.id));
    if (backendOk && !String(x.id).startsWith("tmp-")) {
      const r = await apiPost({ action: "resolveShortage", id: x.id, empId: user.id, name: user.name });
      if (!(r && r.success)) setBackendOk(false);
    }
  };

  // ── 遊戲化:寵物、徽章、生日、冠軍、基金、互動動態(gmScene)、天氣 ──
  const loadGame = async () => {
    const r = await apiGet({ action: "gmScene" }, 0);
    if (!(r && r.success) || !engine.current) return;
    const d = r.data || {}, today = todayStr();
    setGame(d);
    // v1.36 有人生日 → 背景音樂換成生日派對
    if ((d.birthdays || []).length && !bdayMusic.current) { bdayMusic.current = true; bgm.push("birthday"); }
    // v1.19:互動動態＋寵物動態(孵化、交換、收進圖鑑)合併,依時間排序
    setFeed([...(d.feed || []), ...(d.petFeed || []).map(x => ({ ...x, pet: true }))].sort((a, b) => String(b.time).localeCompare(String(a.time))));
    apiGet({ action: "spScene" }, 0).then(x => { if (x && x.success && engine.current) engine.current.setGame({ shops: x.data || [] }); });
    engine.current.setGame({ pets: d.pets || {}, teams: d.teams || {}, worn: d.worn || {}, titles: d.titles || {}, hearts: d.hearts || {}, fx: d.fx || {}, seats: d.seats || [], boss: d.boss || null, birthdays: d.birthdays || [], champion: d.champion || "",
      fireworks: !!d.champion && +today.slice(8, 10) <= 3, unlocks: d.unlocks || [], holiday: holidayOf(today, d.anniversary),
      mounts: d.mounts || {}, macc: d.macc || {}, boards: d.boards || null, thanks: d.thanks || [], bfWall: d.bfWall || null, events: d.events || [], lobby: d.lobby || null, rank: d.rank || [], canteen: d.canteen || null, praise: d.praise || [] });
    engine.current.setRev && engine.current.setRev(d.liveRev || []);
    // v1.40 營業額里程碑：沒看過的就放一次煙火
    try {
      const seen = JSON.parse(localStorage.getItem("rh_cele") || "{}"), key = x => today + "|" + x.loc + "|" + x.text;
      (d.celebrate || []).forEach((x, i) => { if (!seen[key(x)]) { seen[key(x)] = 1; setTimeout(() => engine.current && engine.current.celebrate(x.loc), 800 + i * 1500); } });
      Object.keys(seen).forEach(k => { if (k.slice(0, 10) !== today) delete seen[k]; });
      localStorage.setItem("rh_cele", JSON.stringify(seen));
    } catch (e) {}
    // 新的互動 → 在 3D 場景表演一次(第一次載入不表演舊的)
    const keys = (d.feed || []).map(f => f.time + f.from + f.to + f.type);
    if (seenFeed.current) (d.feed || []).slice().reverse().forEach((f, i) => {
      if (!seenFeed.current.has(f.time + f.from + f.to + f.type)) setTimeout(() => engine.current && engine.current.emote(f.from, f.to, f.type, f.fromName, f.toName), i * 1500);
    });
    seenFeed.current = new Set(keys);
  };
  const loadWeather = async () => {
    try {
      const r = await fetch("https://api.open-meteo.com/v1/forecast?latitude=25.04&longitude=121.56&current=precipitation,is_day&timezone=Asia%2FTaipei");
      const j = await r.json(), c = j.current || {};
      engine.current && engine.current.setGame({ weather: { rain: (c.precipitation || 0) > 0.1, night: c.is_day === 0 } });
    } catch (e) {
      const h = +new Date().toLocaleString("en-GB", { timeZone: "Asia/Taipei", hour: "2-digit", hour12: false });
      engine.current && engine.current.setGame({ weather: { rain: false, night: h >= 18 || h < 6 } });
    }
  };
  const interact = async (p, type) => {
    setImsg("");
    const r = await apiPost({ action: "gmInteract", empId: user.id, to: p.id, type }, 0);
    if (r && r.success) {
      setSent(x => ({ ...x, [p.id + "|" + type]: 1 }));
      engine.current && engine.current.emote(user.id, p.id, type, user.name, p.name);
      setImsg(`已對 ${p.name} ${INTERACTIONS.find(i => i[0] === type)[2]}！`); setRevMsg({ ok: true, text: `已對 ${p.name} ${INTERACTIONS.find(i => i[0] === type)[2]}！` });
      setTimeout(() => setTarget(null), 900); loadGame();
    } else { const e = (r && r.error) || "送出失敗"; setImsg(e); if (/今天|已經/.test(e)) setSent(x => ({ ...x, [p.id + "|" + type]: 1 })); }
  };

  const pat = async (p) => {
    setImsg("");
    const r = await apiPost({ action: "gmPetPat", empId: user.id, to: p.id }, 0);
    if (r && r.success) {
      setSent(x => ({ ...x, [p.id + "|pat"]: 1 }));
      const pt = r.data || {}, line = petLine(pt) || (pt.stage <= 1 ? "（蛋搖了搖）" : "（開心地蹭蹭你）");
      engine.current && engine.current.petSay(p.id, line);
      setImsg(`${pt.name || "牠"}：「${line}」`); loadGame();
    } else setImsg((r && r.error) || "送出失敗");
  };

  const load = async () => {
    setErr("");
    // 優先用後端一次算好的在班名單(全員可用);後端沒有這支 API 時才退回逐人查詢
    const crew = await apiGet({ action: "getOnDutyCrew", date: todayStr() }, 1);
    if (crew && crew.success) {
      setOnDuty((crew.data || []).filter(p => p.location));
      setProgress("");
      setUpdated(new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }));
      return;
    }
    const staffRes = await apiGet({ action: "getStaffList", empId: user.id });
    if (!staffRes.success) { setErr(staffRes.error || "讀取隊員名單失敗"); return; }
    const staff = staffRes.data || [];
    setProgress(`讀取打卡狀態 0/${staff.length}`);
    const date = todayStr();
    const res = await pool(staff, 6, st => apiGet({ action: "getActiveSegment", empId: st.id, date }),
      d => setProgress(`讀取打卡狀態 ${d}/${staff.length}`));
    const list = [];
    staff.forEach((st, i) => { const a = res[i]?.success && res[i].active; if (a && a.location) list.push({ id: st.id, name: st.name, location: a.location, inTime: a.inTime }); });
    setOnDuty(list); setProgress("");
    setUpdated(new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }));
  };
  useEffect(() => { load(); loadShort(); loadAvatars(); loadOps(); const t = setInterval(() => { load(); loadShort(); loadAvatars(); loadOps(); }, 3 * 60 * 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    loadGame(); loadWeather();
    apiGet({ action: "gmMe", empId: user.id }, 0).then(r => { if (r && r.success) { const m = {}; (r.data.sentToday || []).forEach(k => (m[k] = 1)); setSent(m); } });
    const a = setInterval(loadGame, 60 * 1000), b = setInterval(loadWeather, 30 * 60 * 1000);
    return () => { clearInterval(a); clearInterval(b); };
  }, []);

  const shown = demo ? DEMO : onDuty;
  const count = k => shown.filter(p => sceneOf(p.location) === k).length;
  const here = shown.filter(p => sceneOf(p.location) === view);
  const isStore = SCENES[view].store;
  // v1.21 分頁：辦公室、工廠 → 營運中櫃位(依〈櫃位設定〉編號) → 商店街；「其他」只在有人打卡到未建場景的地點時才出現
  const tabKeys = (() => {
    const stores = SCENE_KEYS.filter(k => SCENES[k].store && (k === "other" ? count(k) > 0 || view === k : !openScenes || openScenes[k] || count(k) || view === k));
    const n = k => (locNo[k] != null ? locNo[k] : 900 + SCENE_KEYS.indexOf(k));
    stores.sort((a, b) => n(a) - n(b));
    return ["office", "lobby", "canteen", "gameroom", "gym", "study", ...stores, "street", "factory", "warehouse"];   // v1.42 加學習室   // v1.41 大樓（辦公室含休息區）→ 櫃位 → 商店街 → 工廠、倉庫
  })();
  // v1.44 場域選單兩列（隊長 11/14 18:40）
  //   上列：總部大樓（點了下面再出現大樓各房間）、工廠、倉庫、商店街
  //   下列：活動 → 百貨櫃位（正櫃在前、快閃在後，各依編號）→ 加盟 → 合作品牌（依〈櫃位設定〉場所性質）
  const BLD = ["lobby", "office", "seats", "canteen", "gameroom", "gym", "study", "captain"];
  const inBld = BLD.includes(view);
  const lastRoom = useRef(initRoom && BLD.includes(initRoom) ? initRoom : "seats"); if (inBld) lastRoom.current = view;
  const storeRow = (() => {
    const stores = tabKeys.filter(k => SCENES[k].store);
    const info = k => { const ns = Object.keys(locInfo).filter(n => sceneOf(n) === k && (!locInfo[n].status || locInfo[n].status === "營運中")); const n0 = ns[0] || ""; return { kind: (locInfo[n0] || {}).kind || "", name: n0 }; };
    const grp = k => { const { kind, name } = info(k); if (k === "event" || /活動/.test(kind)) return 0; if (/加盟/.test(kind)) return 3; if (/合作/.test(kind)) return 4; return /快閃|展覽/.test(name) || /快閃/.test(kind) ? 2 : 1; };
    const n = k => (locNo[k] != null ? locNo[k] : 900 + SCENE_KEYS.indexOf(k));
    return stores.map(k => ({ k, g: grp(k) })).sort((a, b) => a.g - b.g || n(a.k) - n(b.k));
  })();
  const GLABEL = ["活動", "正櫃", "快閃", "加盟", "合作品牌"];
  const tabBtn = (k, on, label, onClick, dark) => (
    <button key={k} onClick={onClick} className={dark && on ? "on" : ""} style={dark ? undefined : { flex: "0 0 auto", border: "none", borderRadius: 10, padding: "7px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", background: on ? C.accent : C.warm, color: on ? "#fff" : C.text, fontFamily: "inherit" }}>{label}</button>
  );
  // v1.47 每顆按鈕顯示目前在場人數（0 不顯示）：和 3D 場景一樣的分配（開會→辦公區、運動→運動室、和隊長吃飯／壽星→飯堂、休息→休息區）
  const roomOf = p => tabOf(p.meeting ? "office" : p.act ? "gym" : (p.meal || p.bday) ? "canteen" : p.resting && !p.visiting ? "seats" : sceneOf(p.location));
  const cntMap = (() => { const m = {}; sceneList.forEach(p => { const k = roomOf(p); m[k] = (m[k] || 0) + 1; }); return m; })();
  const cnt = k => cntMap[k] || 0, hqCnt = BLD.reduce((a, k) => a + cnt(k), 0);
  const sceneTabs = dark => {
    const row = { display: "flex", gap: 6, overflowX: "auto", paddingBottom: dark ? 4 : 6, scrollbarWidth: "none" };
    const lbl = k => `${SCENES[k].icon} ${SCENES[k].short}${cnt(k) ? ` · ${cnt(k)}` : ""}`;
    const sep = (i, g) => i > 0 && storeRow[i - 1].g !== g ? <span key={"s" + i} style={{ flex: "0 0 auto", alignSelf: "center", fontSize: 10, color: dark ? "#ddd" : C.light, padding: "0 2px" }}>｜</span> : null;
    return <>
      <div style={row}>
        {tabBtn("hq", inBld, `🏢 總部大樓${hqCnt ? " · " + hqCnt : ""}`, () => setView(lastRoom.current), dark)}
        {["factory", "warehouse", "street"].map(k => tabBtn(k, view === k, lbl(k), () => setView(k), dark))}
      </div>
      {inBld && <div style={{ ...row, background: dark ? "rgba(255,255,255,.08)" : C.warm, borderRadius: 10, padding: "4px 6px", marginBottom: 6 }}>
        {BLD.map(k => tabBtn(k, view === k, `${SCENES[k].icon} ${SCENES[k].short === "辦公室" ? "辦公區" : SCENES[k].short}${cnt(k) ? " · " + cnt(k) : ""}`, () => setView(k), dark))}
      </div>}
      <div style={row}>
        {storeRow.map(({ k, g }, i) => [sep(i, g), tabBtn(k, view === k, (i === 0 || storeRow[i - 1].g !== g) && SCENES[k].short !== GLABEL[g] ? GLABEL[g] + "・" + lbl(k) : lbl(k), () => setView(k), dark)])}
      </div>
    </>;
  };
  // 營業狀態：有人在班＝營業中；今天已有收店盤點＝已打烊；其餘＝準備中
  const opsMap = (() => {
    const today = todayStr(), map = {};
    SCENE_KEYS.filter(k => SCENES[k].store).forEach(k => (map[k] = { state: count(k) ? "open" : "before", batter: null, bDate: "", fc: null, pickup: 0 }));
    batter.forEach(x => {
      const k = sceneOf(x.loc), m = map[k]; if (!m) return;
      if (!m.bDate || x.date >= m.bDate) { m.bDate = x.date; m.batter = batter2(x.rem); m.fc = x.fc && x.fc.setup ? x.fc : null; if (m.fc) { m.batterLow = !!m.fc.low; m.batterLowK = [fcLow(m.fc.orig), fcLow(m.fc.other)]; } }
      if (x.date === today && !count(k)) m.state = "closed";
    });
    if (pickup) Object.keys(pickup).forEach(loc => { const m = map[sceneOf(loc)]; if (m) m.pickup += Number(pickup[loc]) || 0; });   // v1.48 後端只回各櫃位筆數
    else orders.forEach(o => {
      if (String(o.date) !== today || o.method === "外送" || o.status === "已交付" || o.status === "已取消") return;
      const m = map[sceneOf(o.loc)]; if (m) m.pickup++;
    });
    return map;
  })();
  const opsSig = JSON.stringify(opsMap);
  useEffect(() => { engine.current && engine.current.setOps && engine.current.setOps(opsMap); }, [opsSig]);
  const curOps = opsMap[view];
  const focusPerson = (p) => { const k = tabOf(sceneOf(p.location)); setView(k); engine.current && engine.current.focusCrew && engine.current.focusCrew(p.id); };
  const pk = picked && (sceneList.find(x => String(x.id) === String(picked.id)) || shown.find(x => String(x.id) === String(picked.id)) || picked);
  // v1.39 大隊長前往、即時營業額
  const isMeBoss = !!(game && game.boss && String(game.boss.id) === String(user.id));
  const isMgr = isMeBoss || user.role >= 3;   // v1.40 Lv.3 以上都能視察
  const canMeet = isMeBoss || user.role >= 4;   // v1.41 Lv.4 以上選「辦公區」＝召開會議
  const goPlaces = ["辦公室", "休息區", "大廳", "飯堂", "遊戲室", "運動室", "學習室", "隊長室", ...Object.keys(locInfo).filter(n => !/辦公/.test(n) && (!locInfo[n].status || locInfo[n].status === "營運中"))];
  const myVisit = (game && game.visits && game.visits[user.id]) || (isMeBoss && game && game.bossAt) || null;
  const callMeeting = async () => {
    setGoOpen(false);
    if (!window.confirm("召開會議？所有 Lv.2 以上主管會到辦公區會議桌開會 5 分鐘（只是宇宙辦公室的動畫，不影響打卡），並收到提醒。")) return;
    const r = await apiPost({ action: "v41Meet" }, 0);
    if (r && r.success) { setGame(g => g ? { ...g, meeting: r.data } : g); setView("office"); setRevMsg({ ok: true, text: "📋 已召開會議，主管們正走向會議桌" }); loadGame(); }
    else setRevMsg({ ok: false, text: (r && r.error) || "召開失敗" });
  };
  const ACTS = [["run", "🏃", "跑步機"], ["punch", "👊", "打大魔王沙包"], ["yoga", "🧘", "瑜伽"], ["lift", "🏋️", "舉啞鈴"], ["stretch", "🙆", "伸展"]];
  const doAct = async (a) => {
    setActOpen(false);
    const until = Date.now() + 3 * 60e3; setMyAct({ act: a, until }); setNowT(Date.now()); setView("gym");
    setTimeout(() => { setMyAct(null); setNowT(Date.now()); }, 3 * 60e3 + 500);
    apiPost({ action: "v41Act", act: a }, 0).then(r => { if (r && r.success) loadGame(); });
  };
  const goTo = async (loc) => {
    setGoOpen(false);
    const r = await apiPost({ action: "v40Goto", loc: loc === "辦公室" ? "" : loc }, 0);
    if (r && r.success) {
      setGame(g => { if (!g) return g; const v = { ...(g.visits || {}) }; if (r.data) v[user.id] = r.data; else delete v[user.id]; return { ...g, visits: v, bossAt: isMeBoss && r.data && r.data.loc !== "休息區" ? r.data : isMeBoss ? null : g.bossAt }; });
      setView(loc === "辦公室" ? "office" : sceneOf(loc));
      setRevMsg({ ok: true, text: loc === "辦公室" ? "✅ 回到辦公區" : loc === "休息區" ? "✅ 回到休息區" : /^(大廳|飯堂|遊戲室|運動室|學習室|隊長室|辦公區)$/.test(loc) ? `✅ 前往${loc}` : `✅ 前往 ${loc}，在班隊員會收到「來看你了」` });
      loadGame();
    }
    else setRevMsg({ ok: false, text: (r && r.error) || (r && /未知的動作/.test(r.error || "") ? "後端更新到 v1.39 後才能用" : "前往失敗") });
  };
  const [smallBusy, setSmallBusy] = useState(false);
  const smallAct = async (payload, okText, onErr) => {
    setSmallBusy(true); const r = await apiPost(payload, 0); setSmallBusy(false);
    if (r && r.success) setRevMsg({ ok: true, text: okText(r) }); else { const e = (r && r.error) || "失敗了，再試一次"; setRevMsg({ ok: false, text: e }); onErr && onErr(e); }
  };
  // v1.47 點 3D 物件、房間功能列、大樓導覽都走同一個入口
  doFuncRef.current = k => {
    if (/^card:/.test(k)) {   // v1.47 通知中心點「誰請你喝咖啡」→ 打開他的名片
      const id = k.slice(5), p = sceneList.find(x => String(x.id) === id);
      if (!p) return setRevMsg({ ok: false, text: "他現在不在宇宙辦公室裡" });
      setView(roomOf(p)); setTimeout(() => engine.current && engine.current.focusCrew && engine.current.focusCrew(id), 700); return;
    }
    if (k === "claw") return setClaw(true);
    if (k === "photo") return setPhoto(true);
    if (k === "gacha") return setGacha(true);
    if (k === "games") return setGamesOpen(true);
    if (k === "cake") return setCakeOpen(true);
    if (k === "knock") return setKnock("");
    if (/^arcade:/.test(k)) return openGame.current(k.slice(7));
    if (k === "benefit" || k === "idea") return openBf.current(k === "idea" ? "idea" : "apply");
    if (k === "exercise") return (onDuty || []).some(p => String(p.id) === String(user.id)) ? setRevMsg({ ok: false, text: "上班中先專心工作，下班再來運動喔 💪" }) : setActOpen(true);
    if (k === "arena") return onNav && onNav({ tab: "arena", room: view });
    if (k === "sop") return onNav && onNav({ tab: "sop", room: view });
    if (k === "boss") return onNav && onNav({ tab: "spend", cat: "boss", room: view });
    if (k === "seat") return onNav && onNav({ tab: "spend", cat: "seat", room: view });
    setBoard(k);
  };
  const ticker = (game && game.ticker) || [];
  const meDuty = (onDuty || []).find(p => String(p.id) === String(user.id));
  const revLoc = meDuty && meDuty.location && (locInfo[meDuty.location] || {}).kind !== "內部" ? meDuty.location : (user.role >= 2 && isStore ? (Object.keys(locInfo).find(n => sceneOf(n) === view && (locInfo[n].kind || "") !== "內部" && (!locInfo[n].status || locInfo[n].status === "營運中")) || "") : "");
  const liveRev = (game && game.liveRev) || [];
  const sendRev = async () => {
    if (!revLoc || revAmt === "") return;
    setRevBusy(true);
    const r = await apiPost({ action: "v39Rev", loc: revLoc, amount: revAmt }, 0);
    setRevBusy(false);
    if (r && r.success) { setRevAmt(""); setGame(g => g ? { ...g, liveRev: r.data || [] } : g); engine.current && engine.current.setRev && engine.current.setRev(r.data || []); if (r.milestone) engine.current && engine.current.celebrate(revLoc); setRevMsg({ ok: true, text: `✅ 已回報 ${revLoc} $${Number(revAmt).toLocaleString()}${r.coin ? `（+${r.coin} 枚）` : ""}` }); }
    else setRevMsg({ ok: false, text: (r && r.error) || "回報失敗" });
  };
  const timeOf = t => { if (!t) return ""; const d = new Date(t); return isNaN(d) ? String(t) : d.toLocaleTimeString("zh-TW", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false }); };

  return (
    <div>
      <style>{CSS}</style>
      <BgmAsk C={C} s={s} />
      <div style={{ ...s.card, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>紅玉滿宇宙辦公室 <span style={{ fontSize: 10, color: C.gold, fontWeight: 600 }}>測試版</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: C.muted }}>{progress || (updated && `更新 ${updated}`)}</span>
            {onEditAvatar && <button onClick={onEditAvatar} style={{ border: `1px solid ${C.border}`, background: C.card, color: C.accent, borderRadius: 999, padding: "4px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>我的造型</button>}
          </div>
        </div>
        {sceneTabs(false)}
        <div className={"uo-wrap" + (full ? " uo-full" : "")} ref={boxRef}>
          {full && (
            <div className="uo-ftabs" style={{ flexDirection: "column", gap: 0 }}>{sceneTabs(true)}</div>
          )}
          <div className="uo-ctl" style={{ top: full ? "calc(8px + env(safe-area-inset-top))" : 8, right: 8 }}>
            <button onClick={() => setFull(f => !f)} title={full ? "離開全螢幕" : "全螢幕"}>{full ? "✕" : "⛶"}</button>
          </div>
          {/* v1.41 找自己 */}
          <div className="uo-ctl" style={{ top: full ? "calc(48px + env(safe-area-inset-top))" : 48, right: 8, flexDirection: "column", alignItems: "flex-end" }}>
            <button onClick={locateMe} title="找到我" style={{ width: "auto", padding: "0 10px", fontSize: 13, fontWeight: 700, background: "rgba(192,57,43,.9)" }}>📍我</button>
          </div>
          {where && <div style={{ position: "absolute", zIndex: 3, top: full ? "calc(48px + env(safe-area-inset-top))" : 8, left: "50%", transform: "translateX(-50%)", background: "rgba(20,18,36,.62)", color: "#fff", fontSize: 11.5, padding: "3px 10px", borderRadius: 8, pointerEvents: "none", whiteSpace: "nowrap" }}>你在：{where}</div>}
          <div className="uo-ctl" style={{ bottom: pk ? (full ? "calc(118px + env(safe-area-inset-bottom))" : 112) : (full ? "calc(10px + env(safe-area-inset-bottom))" : 8), right: 8, flexDirection: "column" }}>
            <button onClick={() => engine.current && engine.current.zoomBy(1.25)} title="放大">＋</button>
            <button onClick={() => engine.current && engine.current.zoomBy(0.8)} title="縮小">－</button>
            <button onClick={() => engine.current && engine.current.resetView()} title="回到預設視角">⟲</button>
          </div>
          {isStore && here.length === 0 && (
            <div style={{ position: "absolute", top: full ? "calc(48px + env(safe-area-inset-top))" : 10, left: 10, zIndex: 2, background: "rgba(0,0,0,.55)", color: "#fff", fontSize: 12, padding: "4px 10px", borderRadius: 8 }}>
              {curOps && curOps.state === "closed" ? "🌙 今日已打烊" : curOps && curOps.state === "before" ? "☕ 準備中・尚未開店" : "此櫃位目前無人在班"}
            </div>
          )}
          {pk && (
            <div className="uo-card">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{pk.resting ? "💤 " : ""}{pk.name} <span style={{ fontWeight: 400 }}>{((game && game.worn && game.worn[pk.id]) || []).join("")}</span></div>
                  <div style={{ fontSize: 12, color: "#7a6a5c", marginTop: 2 }}>
                    {pk.meeting ? "📋 開會中" : pk.act ? "💪 運動中" : <>{SCENES[sceneOf(pk.location)].icon} {pk.visiting ? `視察中・${shortLoc(pk.location)}` : pk.resting ? "休息中" : shortLoc(pk.location)}</>}{pk.inTime ? ` · ${timeOf(pk.inTime)} 上班` : ""}
                  </div>
                  {game && game.pets && game.pets[pk.id] && <div style={{ fontSize: 11, color: "#a07b3a", marginTop: 2 }}>🐾 寵物：{game.pets[pk.id].name || "（未命名）"}</div>}
                  {game && game.mounts && MOUNT_INFO[game.mounts[pk.id]] && <div style={{ fontSize: 11, color: "#a07b3a", marginTop: 2 }}>{MOUNT_INFO[game.mounts[pk.id]].icon} 坐騎：{MOUNT_INFO[game.mounts[pk.id]].name}</div>}
                  {game && game.hearts && game.hearts[pk.id] && <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3, cursor: onOpenHearts ? "pointer" : "default" }} onClick={() => onOpenHearts && onOpenHearts(pk.id)}><HeartDots lv={game.hearts[pk.id].lv} size={11} /><span style={{ fontSize: 10.5, color: "#b0466a" }}>{game.hearts[pk.id].n === 8 ? (game.hearts[pk.id].g === 8 ? "傳說・無敵8心" : "無敵8心") : `${game.hearts[pk.id].n}／8 心`}</span></div>}
                </div>
                {game && game.pets && game.pets[pk.id] && <PetSprite type={game.pets[pk.id].type} stage={game.pets[pk.id].stage} flavor={game.pets[pk.id].flavor} acc={game.pets[pk.id].acc} size={40} />}
                <button onClick={() => engine.current && engine.current.resetView()} style={{ border: "none", background: "transparent", fontSize: 18, color: "#9a8a7c", cursor: "pointer", padding: 4 }}>✕</button>
              </div>
              {String(pk.id) === String(user.id) && (
                <div style={{ marginTop: 8, fontSize: 12, color: "#8a6a4a", background: "#fff3d6", borderRadius: 8, padding: "6px 9px" }}>🚶 點畫面上的地面，你的小人就會走過去（走動時這張名片會收起來，再點自己就會出現；停 3 分鐘後回到工作位置）</div>
              )}
              {!demo && String(pk.id) === String(user.id) && (
                <button onClick={() => meDuty ? setRevMsg({ ok: false, text: "上班中先專心工作，下班再來運動喔 💪" }) : setActOpen(true)} style={{ marginTop: 8, width: "100%", border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 0", background: "#eafaf1", color: "#1e8449", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>💪 去運動（不限次數）</button>
              )}
              {!demo && isMgr && String(pk.id) === String(user.id) && (
                <button onClick={() => setGoOpen(true)} style={{ marginTop: 8, width: "100%", border: "none", borderRadius: 10, padding: "8px 0", background: C.accent, color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>📍 前往…（視察、回休息區）</button>
              )}
              {!demo && String(pk.id) !== String(user.id) && (() => {
                // v1.47 名片互動列：（Lv.3 辛苦了）打氣、按讚、謝謝、請喝、更多（點頭、微笑、摸寵物、請吃、切磋）；今天做過的變灰「明天再來」
                const done = k => !!sent[pk.id + "|" + k];
                const b = (k, ic, label, on, dis) => <button key={k} disabled={dis || done(k) || smallBusy} onClick={on} style={{ flex: 1, minWidth: 0, border: `1px solid ${C.border}`, borderRadius: 10, padding: "6px 0", background: done(k) ? "#eee" : "#fff", fontWeight: 600, fontSize: 12, cursor: done(k) ? "default" : "pointer", fontFamily: "inherit", color: done(k) ? "#aaa" : C.text, lineHeight: 1.25 }}>
                  <div style={{ fontSize: 16 }}>{ic}</div>{done(k) ? <span style={{ fontSize: 9.5 }}>明天再來</span> : label}</button>;
                const mark = k => setSent(x => ({ ...x, [pk.id + "|" + k]: 1 }));
                const act2 = (k, payload, okText) => smallAct(payload, r => { mark(k); return okText(r); }, err => { if (/今天|已經/.test(err)) mark(k); });
                return <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                  {isMgr && b("mgrcheer", "👍", "辛苦了", () => act2("mgrcheer", { action: "v40Cheer", to: pk.id }, () => `👍 已跟 ${pk.name} 說辛苦了`))}
                  {b("cheer", "💪", "打氣", () => interact(pk, "cheer"))}
                  {b("like", "👍", "按讚", () => interact(pk, "like"))}
                  {b("thx", "💌", "謝謝", () => { setThx(pk); setThxText(""); })}
                  {b("coffee", "☕", "請喝", () => act2("coffee", { action: "v40Coffee", to: pk.id }, () => { engine.current && engine.current.coffee(pk.id, user.nick || user.name); return `☕ 請 ${pk.name} 喝了一杯`; }))}
                  {b("more", "⋯", "更多", () => { setTarget(pk); setImsg(""); })}
                </div>;
              })()}
            </div>
          )}
        </div>
        {/* v1.47 房間功能列：這間可以做什麼（和點 3D 物件一樣） */}
        {inBld && ROOM_FUNCS[view] && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {ROOM_FUNCS[view].map(([k, label]) => <button key={k} onClick={() => doFuncRef.current(k)} style={{ border: `1px solid ${C.border}`, background: C.card, color: C.text, borderRadius: 999, padding: "6px 11px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{label}</button>)}
          </div>
        )}
        {/* v1.40 跑馬燈：今日動態 */}
        {ticker.length > 0 && (
          <div style={{ marginTop: 8, background: "#2b1d16", color: "#ffe6b0", borderRadius: 10, overflow: "hidden", whiteSpace: "nowrap", fontSize: 12.5, padding: "6px 0" }}>
            <div style={{ display: "inline-block", paddingLeft: "100%", animation: `rhTicker ${Math.max(18, ticker.length * 7)}s linear infinite` }}>
              {ticker.map((t, i) => <span key={i} style={{ marginRight: 28 }}>📣 {t.time} {t.text}</span>)}
            </div>
          </div>
        )}
        <div style={{ fontSize: 10, color: C.light, marginTop: 6 }}>雙指縮放、旋轉 · 左右拖曳旋轉 · 點隊員拉近看名片 · 點地面你的小人就會走過去 · 點看板可以放大 · 📍我 找到自己 · ⛶ 全螢幕可單指拖曳移動</div>
      </div>

      {/* v1.39 即時營業額 PK：不強迫、次數不限，顯示回報時間；全部隊員看得到 */}
      {revMsg && <Flash text={revMsg.text} kind={revMsg.ok ? "ok" : "bad"} />}
      <div style={s.card}>
        <div style={{ ...s.sectionTitle, display: "flex", justifyContent: "space-between" }}><span>⚡ 今日即時營業額 PK</span><span style={{ letterSpacing: 0, fontWeight: 400 }}>各櫃位最新一次回報</span></div>
        {liveRev.length === 0 && <div style={{ fontSize: 13, color: C.muted, padding: "4px 0 8px" }}>今天還沒有櫃位回報，搶頭香！</div>}
        {liveRev.map((x, i) => (
          <div key={x.loc} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: i < liveRev.length - 1 ? `1px solid ${C.border}` : "none" }}>
            <span style={{ width: 22, fontSize: 15 }}>{["🥇", "🥈", "🥉"][i] || `${i + 1}.`}</span>
            <span style={{ flex: 1, fontSize: 13.5 }}>{x.loc}<span style={{ display: "block", fontSize: 11, color: C.muted }}>{x.time} 回報・{x.by}</span></span>
            <b style={{ fontSize: 15, color: i === 0 ? C.accent : C.text }}>${Number(x.amount).toLocaleString()}</b>
          </div>
        ))}
        {revLoc && !demo && (
          <div style={{ marginTop: 10, background: C.warm, borderRadius: 12, padding: 10 }}>
            <div style={{ fontSize: 12.5, marginBottom: 6 }}>回報 <b>{revLoc}</b> 目前營業額（不強迫，隨時都可以報）</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="number" inputMode="numeric" value={revAmt} onChange={e => setRevAmt(e.target.value)} placeholder="例：3852" style={{ ...s.input, flex: 1 }} />
              <button disabled={revBusy || revAmt === ""} onClick={sendRev} style={{ ...s.btn("primary"), width: "auto", padding: "0 16px", opacity: revBusy || revAmt === "" ? .5 : 1 }}>回報</button>
            </div>
          </div>
        )}
      </div>

      {actOpen && createPortal(
        <div onClick={() => setActOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 1500, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.card, width: "100%", maxWidth: 480, borderRadius: "0 0 20px 20px", padding: "calc(16px + env(safe-area-inset-top)) 16px 18px", boxShadow: "0 8px 24px rgba(0,0,0,.18)", animation: "rhDropIn .22s ease-out" }}>
            <div style={{ fontSize: 15, fontWeight: 600, textAlign: "center", marginBottom: 4 }}>💪 想做什麼運動？</div>
            <div style={{ fontSize: 12, color: C.muted, textAlign: "center", marginBottom: 12 }}>你的小人會走到運動室動 3 分鐘，不限次數</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {ACTS.map(([k, ic, n]) => <button key={k} onClick={() => doAct(k)} style={{ border: `1.5px solid ${C.border}`, background: C.card, borderRadius: 12, padding: "12px 8px", cursor: "pointer", fontFamily: "inherit", fontSize: 14, color: C.text }}>{ic} {n}</button>)}
            </div>
            <button onClick={() => setActOpen(false)} style={{ ...s.btn("ghost"), marginTop: 12 }}>關閉</button>
          </div>
        </div>, document.body
      )}
      {claw && <Claw42 apiPost={apiPost} apiGet={apiGet} C={C} s={s} onClose={() => setClaw(false)} />}
      {gamesOpen && createPortal(
        <div onClick={() => setGamesOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 1700, background: "rgba(20,10,20,.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 14 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 400, background: C.card, borderRadius: 20, padding: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 800, textAlign: "center", marginBottom: 10 }}>🕹️ 選一台桌機</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {ARCADE_GAMES.map(([id, ic, n]) => <button key={id} onClick={() => { setGamesOpen(false); openGame.current(id); }} style={{ border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 6px", background: C.warm, cursor: "pointer", fontFamily: "inherit", color: C.text, fontSize: 14, fontWeight: 600 }}>{ic} {n}</button>)}
            </div>
            <button onClick={() => setGamesOpen(false)} style={{ ...s.btn("ghost"), marginTop: 10 }}>關閉</button>
          </div>
        </div>, document.body)}
      {cakeOpen && createPortal(
        <div onClick={() => setCakeOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 1700, background: "rgba(20,10,20,.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 14 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 400, maxHeight: "80vh", overflowY: "auto", background: C.card, borderRadius: 20, padding: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 800, textAlign: "center" }}>🧇 請誰吃雞蛋糕？</div>
            <div style={{ fontSize: 12, color: C.muted, textAlign: "center", margin: "4px 0 10px" }}>休息中的隊員都可以請；同一個人每天一次</div>
            {sceneList.filter(p => p.resting && String(p.id) !== String(user.id)).map(p => { const d = !!sent[p.id + "|cake"]; return (
              <button key={p.id} disabled={d || smallBusy} onClick={() => smallAct({ action: "v44Cake", to: p.id }, () => { setSent(x => ({ ...x, [p.id + "|cake"]: 1 })); engine.current && engine.current.sayTo && engine.current.sayTo(p.id, "🧇 " + (user.nick || user.name) + " 請吃雞蛋糕！"); return `🧇 請 ${p.name} 吃了雞蛋糕`; }, e => { if (/今天|已經/.test(e)) setSent(x => ({ ...x, [p.id + "|cake"]: 1 })); })}
                style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 12px", marginBottom: 6, background: d ? C.warm : C.card, cursor: d ? "default" : "pointer", fontFamily: "inherit", color: C.text, fontSize: 14 }}>
                <span>{p.name}</span><span style={{ fontSize: 12, color: d ? C.muted : C.accent }}>{d ? "明天再來" : "🧇 請吃"}</span></button>); })}
            {!sceneList.some(p => p.resting && String(p.id) !== String(user.id)) && <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: 10 }}>現在沒有休息中的隊員</div>}
            {revMsg && <div style={{ fontSize: 13, textAlign: "center", marginTop: 6, color: revMsg.ok ? C.green : C.red }}>{revMsg.text}</div>}
            <button onClick={() => setCakeOpen(false)} style={{ ...s.btn("ghost"), marginTop: 8 }}>關閉</button>
          </div>
        </div>, document.body)}
      {gacha && createPortal(
        <div onClick={() => setGacha(false)} style={{ position: "fixed", inset: 0, zIndex: 1700, background: "rgba(20,10,20,.85)", display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "calc(14px + env(safe-area-inset-top)) 10px calc(14px + env(safe-area-inset-bottom))" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: C.bg, borderRadius: 20, padding: 12 }}>
            <div style={{ fontSize: 17, fontWeight: 800, textAlign: "center", color: C.accent, margin: "4px 0 8px" }}>🎰 紅玉滿扭蛋機</div>
            <GameTab user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} onlyTab="gacha" />
            <button onClick={() => setGacha(false)} style={{ ...s.btn("ghost"), marginTop: 8 }}>離開</button>
          </div>
        </div>, document.body)}
      {photo && <PhotoBooth44 apiPost={apiPost} s={s} engine={engine.current} me={{ id: user.id, name: user.nick || user.name }} onClose={() => setPhoto(false)} />}
      {knock !== null && createPortal(
        <div onClick={() => setKnock(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 1500, display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.card, width: "100%", maxWidth: 480, borderRadius: "0 0 20px 20px", padding: "calc(16px + env(safe-area-inset-top)) 16px 18px", animation: "rhDropIn .22s ease-out" }}>
            <div style={{ fontSize: 15, fontWeight: 600, textAlign: "center", marginBottom: 4 }}>🚪 叩叩！敲隊長室的門</div>
            <div style={{ fontSize: 12, color: C.muted, textAlign: "center", marginBottom: 10 }}>直接留言給隊長，隊長會收到提醒並回覆你</div>
            <textarea value={knock} maxLength={300} rows={4} onChange={e => setKnock(e.target.value)} placeholder="想跟隊長說的話…" style={{ ...s.input, marginBottom: 10, resize: "vertical" }} />
            <button disabled={knock.trim().length < 2 || smallBusy} onClick={async () => { await smallAct({ action: "v44Knock", text: knock }, () => "🚪 已留言給隊長"); setKnock(null); }} style={{ ...s.btn("primary"), opacity: knock.trim().length < 2 ? .5 : 1 }}>送出</button>
            <button onClick={() => setKnock(null)} style={{ ...s.btn("ghost"), marginTop: 8 }}>取消</button>
          </div>
        </div>, document.body
      )}
      {thx && createPortal(
        <div onClick={() => setThx(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 1500, display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.card, width: "100%", maxWidth: 480, borderRadius: "0 0 20px 20px", padding: "calc(16px + env(safe-area-inset-top)) 16px 18px", animation: "rhDropIn .22s ease-out" }}>
            <div style={{ fontSize: 15, fontWeight: 600, textAlign: "center", marginBottom: 4 }}>💌 謝謝 {thx.name}</div>
            <div style={{ fontSize: 12, color: C.muted, textAlign: "center", marginBottom: 10 }}>貼到休息區的感謝牆，大家都看得到（每天 3 張）</div>
            <input value={thxText} maxLength={40} onChange={e => setThxText(e.target.value)} placeholder="例：謝謝你今天幫我補貨！" style={{ ...s.input, marginBottom: 10 }} />
            <button disabled={!thxText.trim() || smallBusy} onClick={async () => { await smallAct({ action: "v42Thank", to: thx.id, text: thxText }, () => `💌 已貼到感謝牆，${thx.name} 會收到提醒`); setThx(null); loadGame(); }} style={{ ...s.btn("primary"), opacity: thxText.trim() ? 1 : .5 }}>貼上感謝牆</button>
            <button onClick={() => setThx(null)} style={{ ...s.btn("ghost"), marginTop: 8 }}>取消</button>
          </div>
        </div>, document.body
      )}
      {board && <BoardModal41 k={board} onClose={() => setBoard(null)} C={C} s={s} liveRev={liveRev} opsMap={opsMap} short={short} game={game} onDuty={onDuty} user={user} apiPost={apiPost} onChanged={loadGame}
        onGo={k => { setBoard(null); setView(tabOf(k)); }} />}

      {goOpen && createPortal(
        <div onClick={() => setGoOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 1500, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.card, width: "100%", maxWidth: 480, borderRadius: "0 0 20px 20px", padding: "calc(16px + env(safe-area-inset-top)) 16px 18px", boxShadow: "0 8px 24px rgba(0,0,0,.18)", animation: "rhDropIn .22s ease-out" }}>
            <div style={{ fontSize: 15, fontWeight: 600, textAlign: "center", marginBottom: 4 }}>📍 {isMeBoss ? "大隊長" : "你"}要去哪裡？</div>
            <div style={{ fontSize: 12, color: C.muted, textAlign: "center", marginBottom: 12 }}>今天有效。去櫃位時，在班隊員會收到「來看你了 👀」{canMeet ? "；選「辦公區」會召開 5 分鐘會議" : ""}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {goPlaces.map(n => {
                const on = (myVisit && (myVisit.loc === n || (n === "辦公室" && myVisit.loc === "辦公區"))) || (n === "休息區" && !myVisit);
                if (n === "辦公室" && canMeet) return <button key={n} onClick={callMeeting} style={{ border: `1.5px solid ${C.accent}`, background: "#fff3e0", borderRadius: 12, padding: "10px 8px", cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: C.text, textAlign: "left" }}>📋 辦公區（召開會議）</button>;
                return <button key={n} onClick={() => goTo(n === "辦公室" ? "辦公區" : n)} style={{ border: `1.5px solid ${on ? C.accent : C.border}`, background: on ? C.accentBg : C.card, borderRadius: 12, padding: "10px 8px", cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: C.text, textAlign: "left" }}>{n === "辦公室" ? "💼 辦公區" : `${SCENES[sceneOf(n)].icon} ${n}`}</button>;
              })}
            </div>
            <button onClick={() => setGoOpen(false)} style={{ ...s.btn("ghost"), marginTop: 12 }}>關閉</button>
          </div>
        </div>, document.body
      )}

      {game && game.birthdays && game.birthdays.length > 0 && (
        <div style={{ ...s.card, background: "#fff0f6", border: "1px solid #f8c8dc", textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>🎂 今天是 {game.birthdays.map(b => b.name).join("、")} 的生日！</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>辦公室正在開派對，到首頁送上祝福吧</div>
        </div>
      )}

      {feed.length > 0 && (
        <div style={s.card}>
          <div style={s.sectionTitle}>宇宙動態</div>
          {feed.slice(0, 6).map((f, i) => (
            <div key={i} style={{ fontSize: 13, padding: "5px 0", borderBottom: i < Math.min(5, feed.length - 1) ? `1px solid ${C.border}` : "none" }}>
              {f.pet ? <>{{ hatch: "🐣", trade: "🔄", retire: "📖" }[f.kind] || "🐾"} {f.text}</> : <>{f.type === "pat" ? "🐾" : (INTERACTIONS.find(x => x[0] === f.type) || [])[1]} <b>{f.fromName}</b> {f.type === "pat" ? "摸了" : "對"} <b>{f.toName}</b> {f.type === "pat" ? "的寵物" : f.label}</>}
              <span style={{ fontSize: 11, color: C.light, marginLeft: 6 }}>{String(f.time).slice(11, 16)}</span>
            </div>
          ))}
        </div>
      )}

      {isStore && (
        <div style={s.card}>
          <div style={s.sectionTitle}>📋 {SCENES[view].name} 缺貨看板</div>
          {curOps && (curOps.batter || curOps.pickup > 0) && (
            <div style={{ background: C.warm, borderRadius: 10, padding: "7px 10px", marginBottom: 8, fontSize: 12.5 }}>
              {curOps.batter && <div>🥣 麵糊（包）：{["原味", "其他口味"].map(f => { const v = curOps.batter[f]; return <span key={f} style={{ marginRight: 8, fontWeight: 600, color: v != null && (curOps.fc ? fcLow(f === "原味" ? curOps.fc.orig : curOps.fc.other) : v <= 2) ? C.red : C.text }}>{f} {v == null ? "—" : v}</span>; })}
                <span style={{ fontSize: 10.5, color: C.light }}>{curOps.bDate.slice(5).replace("-", "/")} 收店盤點</span>
                {curOps.fc && <div style={{ marginTop: 2, color: curOps.fc.low ? C.red : C.muted, fontWeight: curOps.fc.low ? 600 : 400 }}>
                  {curOps.fc.low ? "⚠️ " : ""}還夠：原味 {fcDays(curOps.fc.orig)}・其他 {fcDays(curOps.fc.other)}
                  {((curOps.fc.orig && curOps.fc.orig.suggest) || (curOps.fc.other && curOps.fc.other.suggest)) ? `｜建議叫 ${[curOps.fc.orig && curOps.fc.orig.suggest ? "原味 " + curOps.fc.orig.suggest : "", curOps.fc.other && curOps.fc.other.suggest ? "其他 " + curOps.fc.other.suggest : ""].filter(Boolean).join("、")} 包` : ""}
                </div>}</div>}
              {curOps.pickup > 0 && <div style={{ marginTop: curOps.batter ? 3 : 0 }}>📦 今日待取貨 <b style={{ color: C.accent }}>{curOps.pickup}</b> 筆</div>}
            </div>
          )}
          <div style={{ fontSize: 11.5, color: C.muted, background: C.warm, borderRadius: 8, padding: "6px 9px", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ flex: 1 }}>這裡只是看板，總部會看到；真的要叫貨請到物料需求</span>
            {onOpenMaterials && <button onClick={onOpenMaterials} style={{ border: `1px solid ${C.accent}`, background: C.card, color: C.accent, borderRadius: 999, padding: "3px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>去叫貨</button>}
          </div>
          {short.filter(x => x.scene === view).length === 0 && <div style={{ fontSize: 13, color: C.green, padding: "4px 0 8px" }}>✅ 目前不缺</div>}
          {short.filter(x => x.scene === view).map(x => (
            <div key={x.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.red }}>{x.item}</div>
                <div style={{ fontSize: 10, color: C.light }}>{x.by || ""}{x.time ? " · " + new Date(x.time).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}</div>
                {x.status === "已發貨" && <div style={{ fontSize: 11.5, color: C.blue, fontWeight: 600 }}>🚚 已發貨 {String(x.shipAt || "").slice(5).replace("-", "/")}{x.shipBy ? "（" + x.shipBy + "）" : ""}</div>}
              </div>
              <button onClick={() => resolveShort(x)} style={{ border: "none", borderRadius: 10, padding: "6px 10px", background: C.greenBg, color: C.green, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>{x.status === "已發貨" ? "✅ 收到了" : "✅ 補好了"}</button>
            </div>
          ))}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {quick.map(q => (
              <button key={q} onClick={() => addShort(q)} style={{ border: `1px solid ${C.border}`, borderRadius: 999, padding: "5px 10px", background: C.warm, fontSize: 12, fontWeight: 700, cursor: "pointer", color: C.text }}>＋ {q}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <input value={custom} onChange={e => setCustom(e.target.value)} placeholder="其他缺的東西…" style={{ ...s.input, padding: "9px 12px" }} />
            <button onClick={() => addShort(custom)} style={{ ...s.btn(), width: "auto", padding: "9px 14px", whiteSpace: "nowrap", flex: "0 0 auto" }}>登記</button>
          </div>
          {!backendOk && <div style={{ fontSize: 11, color: C.gold, marginTop: 8 }}>⚠️ 缺貨看板後端尚未部署，目前登記的內容不會保存。</div>}
        </div>
      )}

      {view === "factory" && (
        <div style={s.card}>
          <div style={s.sectionTitle}>🏭 工廠出貨板</div>
          <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8 }}>各櫃位在看板登記的補貨。總部出貨後按「已發貨」，櫃位收到後按「收到了」就會消失。</div>
          {short.length === 0 && <div style={{ fontSize: 13, color: C.green, padding: "4px 0" }}>✅ 各櫃位目前都不缺</div>}
          {Object.entries(short.reduce((m, x) => { (m[x.location] = m[x.location] || []).push(x); return m; }, {})).map(([loc, list]) => (
            <div key={loc} style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: "8px 10px", marginBottom: 8 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>{shortLoc(loc)} <span style={{ fontSize: 11.5, color: C.muted, fontWeight: 400 }}>待處理 {list.filter(x => x.status !== "已發貨").length}・已發貨 {list.filter(x => x.status === "已發貨").length}</span></div>
              {list.map(x => (
                <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderTop: `1px dashed ${C.border}` }}>
                  <span style={{ flex: 1, fontSize: 13.5, color: x.status === "已發貨" ? C.blue : C.red, fontWeight: 600 }}>{x.item}
                    <span style={{ display: "block", fontSize: 10.5, color: C.light, fontWeight: 400 }}>{x.by}{x.status === "已發貨" ? `・已發貨 ${String(x.shipAt || "").slice(5).replace("-", "/")}` : ""}</span></span>
                  {x.status !== "已發貨" && user.role >= 3 && <button onClick={() => shipShort(x)} style={{ border: "none", borderRadius: 10, padding: "6px 10px", background: C.blueBg, color: C.blue, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>🚚 已發貨</button>}
                  <button onClick={() => resolveShort(x)} style={{ border: "none", borderRadius: 10, padding: "6px 10px", background: C.greenBg, color: C.green, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>✅ 已補齊</button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <Flash text={err} />{err && <div style={{ ...s.card, background: C.redBg, color: C.red, fontSize: 13 }}>{err}</div>}

      <div style={s.card}>
        <div style={s.sectionTitle}>{demo ? "示範名單" : "目前在班"}（{shown.length} 人）</div>
        {shown.length === 0 && <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: 8 }}>目前沒有人上班中</div>}
        {shown.map(p => {
          const k = sceneOf(p.location);
          return (
            <div key={p.id} onClick={() => focusPerson(p)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}>
              <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{p.name} <span style={{ fontWeight: 400 }}>{((game && game.worn && game.worn[p.id]) || []).join("")}</span></span>
              {!demo && String(p.id) !== String(user.id) && <button onClick={e => { e.stopPropagation(); setTarget(p); setImsg(""); setView(k); }} style={{ border: `1px solid ${C.accent}`, background: C.card, color: C.accent, borderRadius: 999, padding: "3px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>互動</button>}
              <span style={{ fontSize: 12, color: C.muted }}>{SCENES[k].icon} {shortLoc(p.location)}{p.inTime ? ` · ${(() => { const d = new Date(p.inTime); return isNaN(d) ? String(p.inTime) : d.toLocaleTimeString("zh-TW", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false }); })()}` : ""}</span>
            </div>
          );
        })}
      </div>

      {/* v1.39：互動選單改從頂端出現（portal，避免被 .rh-page 的 transform 限制在頁框裡） */}
      {target && createPortal(
        <div onClick={() => setTarget(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", zIndex: 1500, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: C.card, width: "100%", maxWidth: 480, borderRadius: "0 0 20px 20px", padding: "calc(16px + env(safe-area-inset-top)) 16px 18px", boxShadow: "0 8px 24px rgba(0,0,0,.18)", animation: "rhDropIn .22s ease-out" }}>
            <div style={{ fontSize: 15, fontWeight: 600, textAlign: "center", marginBottom: 14 }}>要對 {target.name} 做什麼？</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
              {INTERACTIONS.map(([k, ic, label]) => {
                const done = sent[target.id + "|" + k];
                return <button key={k} disabled={done} onClick={() => interact(target, k)} style={{ border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 4px", background: done ? C.warm : C.card, cursor: done ? "default" : "pointer", fontFamily: "inherit", opacity: done ? .5 : 1 }}>
                  <div style={{ fontSize: 26 }}>{ic}</div><div style={{ fontSize: 12, marginTop: 4, color: C.text }}>{label}</div>
                  {done && <div style={{ fontSize: 10, color: C.muted }}>今天送過了</div>}
                </button>;
              })}
            </div>
            {game && game.pets && game.pets[target.id] && (() => { const pt = game.pets[target.id], done = sent[target.id + "|pat"]; return (
              <button disabled={done} onClick={() => pat(target)} style={{ width: "100%", marginTop: 10, display: "flex", alignItems: "center", gap: 10, border: `1px solid ${C.border}`, borderRadius: 14, padding: "8px 12px", background: done ? C.warm : "#fff6e8", cursor: done ? "default" : "pointer", fontFamily: "inherit", textAlign: "left" }}>
                <PetSprite type={pt.type} stage={pt.stage} flavor={pt.flavor} size={44} />
                <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>🐾 摸摸{pt.name}的頭</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{done ? "今天摸過了" : "每天一次，算進互動之星"}</div></div>
              </button>); })()}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>   {/* v1.47 更多：請吃雞蛋糕、切磋對戰 */}
              <button disabled={smallBusy || !!sent[target.id + "|cake"]} onClick={() => { const t = target; smallAct({ action: "v44Cake", to: t.id }, () => { setSent(x => ({ ...x, [t.id + "|cake"]: 1 })); engine.current && engine.current.sayTo && engine.current.sayTo(t.id, "🧇 " + (user.nick || user.name) + " 請吃雞蛋糕！"); setImsg(`🧇 請 ${t.name} 吃了雞蛋糕`); return `🧇 請 ${t.name} 吃了雞蛋糕`; }, e => { setImsg(e); if (/今天|已經/.test(e)) setSent(x => ({ ...x, [t.id + "|cake"]: 1 })); }); }} style={{ flex: 1, border: `1px solid ${C.border}`, borderRadius: 14, padding: "10px 4px", background: sent[target.id + "|cake"] ? C.warm : C.card, cursor: "pointer", fontFamily: "inherit", color: C.text, fontSize: 13, fontWeight: 600 }}>🧇 請吃雞蛋糕{sent[target.id + "|cake"] ? <div style={{ fontSize: 10, color: C.muted }}>明天再來</div> : null}</button>
              {onNav && <button onClick={() => { setTarget(null); onNav({ tab: "arena", room: view }); }} style={{ flex: 1, border: `1px solid ${C.border}`, borderRadius: 14, padding: "10px 4px", background: C.card, cursor: "pointer", fontFamily: "inherit", color: C.text, fontSize: 13, fontWeight: 600 }}>⚔️ 切磋對戰</button>}
            </div>
            {imsg && <div style={{ fontSize: 13, textAlign: "center", marginTop: 12, color: C.accent }}>{imsg}</div>}
            <div style={{ fontSize: 11, color: C.light, textAlign: "center", marginTop: 10 }}>同一個人、同一種互動一天一次 · 每月結算「互動之星」</div>
            <button onClick={() => setTarget(null)} style={{ ...s.btn("ghost"), marginTop: 10 }}>關閉</button>
          </div>
        </div>, document.body
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={load} style={{ ...s.btn() }}>🔄 重新整理</button>
        <button onClick={() => setDemo(d => !d)} style={{ ...s.btn(demo ? "green" : "ghost") }}>{demo ? "🎮 展示中（點我關閉）" : "🎮 展示模式"}</button>
      </div>
    </div>
  );
}
