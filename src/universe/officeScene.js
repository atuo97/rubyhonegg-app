// ─────────────────────────────────────────────
// 紅玉滿宇宙辦公室 · 3D 場景引擎
// 只負責畫面：誰在哪個場景、走路動畫、對話框。資料由 UniverseTab 傳入。
// ─────────────────────────────────────────────
import * as THREE from "three";
import { toSceneOpts } from "./avatarCatalog.js";
import { petLine } from "../pets/petSprites.jsx";

export const SCENES = {
  // v1.41 紅玉滿宇宙大樓：大廳｜辦公區｜休息區｜飯堂｜遊戲室｜運動室 相連（bld），中間有門可以走過去
  lobby:   { x: -16, name: "大廳",         short: "大廳",   icon: "🚪", aisle: 4.6, bld: true, w: 16 },
  office:  { x: 0,   name: "辦公區",       short: "辦公室", icon: "💼", aisle: 4.6, bld: true, w: 16 },
  seats:   { x: 20,  name: "休息區",       short: "休息區", icon: "🛋️", aisle: 4.6, bld: true, w: 24, focus: { x: 0, z: 0.4, zoom: 0.8 } },   // v1.44 改回獨立房間（和櫃位一樣切換場景）
  meet:    { x: 0,   name: "會議桌",       short: "開會",   icon: "📋", aisle: 4.6, bld: true, w: 16, tab: "office", virtual: true },   // v1.41 開會（辦公區會議桌）
  canteen: { x: 40,  name: "飯堂",         short: "飯堂",   icon: "🍱", aisle: 4.6, bld: true, w: 16 },
  gameroom:{ x: 56,  name: "遊戲室",       short: "遊戲室", icon: "🎮", aisle: 4.6, bld: true, w: 16 },
  gym:     { x: 72,  name: "運動室",       short: "運動室", icon: "💪", aisle: 4.6, bld: true, w: 16 },
  study:   { x: 88,  name: "學習室",       short: "學習室", icon: "📚", aisle: 4.6, bld: true, w: 16 },   // v1.42 證照、課程、SOP
  captain: { x: 104, name: "隊長室",       short: "隊長室", icon: "🚪", aisle: 4.6, bld: true, w: 16 },   // v1.44 敲門留言
  factory: { x: 120, name: "工廠",         short: "工廠",   icon: "🏭", aisle: 2.6 },
  xinyi:   { x: 160, name: "遠百信義",     short: "信義",   icon: "🏙️", aisle: -2.8, store: true, focus: { x: 0.5, z: -0.8, zoom: 1.7 } },
  hall:    { x: 200, name: "國家音樂廳",   short: "音樂廳", icon: "🎻", aisle: -2.8, store: true, focus: { x: 0.2, z: -1.2, zoom: 1.6 } },
  nangang: { x: 240, name: "南港 LaLaport", short: "南港",  icon: "🛍️", aisle: -2.8, store: true, focus: { x: 0.2, z: -0.8, zoom: 1.6 } },
  zhubei:  { x: 280, name: "遠百竹北",     short: "竹北",   icon: "🏬", aisle: -2.8, store: true, focus: { x: 0.3, z: -0.8, zoom: 1.6 } },
  other:   { x: 320, name: "其他櫃位・活動", short: "其他", icon: "🎪", aisle: -2.8, store: true },
  street:  { x: 360, name: "隊員商店街",   short: "商店街", icon: "🏪", aisle: 2.6 },
  meili:   { x: 400, name: "美麗華",       short: "美麗華", icon: "🎡", aisle: -2.8, store: true, focus: { x: -0.6, z: -1.0, zoom: 1.45 } },
  airport: { x: 440, name: "桃園機場 × 山海豆花", short: "桃機", icon: "✈️", aisle: -5.2, store: true, focus: { x: -0.2, z: -2.0, zoom: 1.5 } },
  huatai:  { x: 480, name: "華泰名品城",   short: "華泰",   icon: "🛒", aisle: -2.8, store: true, focus: { x: -0.8, z: -1.2, zoom: 1.3 } },
  event:   { x: 520, name: "活動",         short: "活動",   icon: "⛺", aisle: -2.8, store: true, focus: { x: 1.4, z: -0.6, zoom: 1.35 } },
  guangfu: { x: 560, name: "新竹光復隊",   short: "光復",   icon: "🏠", aisle: -3.6, store: true, focus: { x: 0.6, z: -1.2, zoom: 1.9, az: 0.3 } },
  warehouse: { x: 600, name: "倉庫",       short: "倉庫",   icon: "📦", aisle: 2.6 },   // v1.40 倉庫獨立場景（之後接 ERP）
};
// v1.41 畫面分頁：休息區、會議桌都顯示在「辦公室」分頁
export const tabOf = k => (SCENES[k] && SCENES[k].tab) || k;
export const SCENE_KEYS = Object.keys(SCENES);

// 打卡地點 → 場景
export function sceneOf(loc = "") {
  if (/信義/.test(loc)) return "xinyi";
  if (/音樂廳|兩廳院/.test(loc)) return "hall";
  if (/南港/.test(loc)) return "nangang";
  if (/竹北/.test(loc)) return "zhubei";
  if (/倉庫/.test(loc)) return "warehouse";   // v1.40 倉庫獨立場景
  if (/工廠|中央廚房/.test(loc)) return "factory";
  if (/休息區/.test(loc)) return "seats";
  if (/大廳/.test(loc)) return "lobby";
  if (/飯堂|餐廳/.test(loc)) return "canteen";
  if (/遊戲室/.test(loc)) return "gameroom";
  if (/運動室|健身/.test(loc)) return "gym";
  if (/學習室/.test(loc)) return "study";
  if (/隊長室/.test(loc)) return "captain";
  if (/辦公/.test(loc)) return "office";
  if (/商店街/.test(loc)) return "street";
  if (/美麗華/.test(loc)) return "meili";
  if (/機場|山海/.test(loc)) return "airport";
  if (/華泰/.test(loc)) return "huatai";
  if (/光復/.test(loc)) return "guangfu";
  if (/活動/.test(loc)) return "event";
  return "other";
}
// "01正櫃遠百信義" → "遠百信義"
export function shortLoc(loc = "") {
  return String(loc).replace(/^\d+/, "").replace(/^(正櫃|快閃櫃|展覽|活動|分隊長)/, "") || loc;
}

// ── 隊員外型 ──
// 有指定的照名字套用，其餘依員工編號自動產生（每次都一樣）
const UNI = 0xc0392b;
export const AVATAR_PRESETS = {
  "雞蛋": { penguin: true, shirt: 0xf8a5c2 },
  "宛芸": { ponytail: true, slim: true, hair: 0x2b1a10 },
  "瑜珍": { bob: true, hair: 0x3b2314 },
  "千芊": { glasses: true, hair: 0x1a1a1a },
};
function hash(str) { let h = 0; for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }
// 隊員自選的紙娃娃造型(empId → cfg),由 UniverseTab 從後端取得後用 setAvatars 設定
let AV_CFG = {};
const todayTW = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" });
export function avatarFor(p) {
  const mine = AV_CFG[String(p.id)];
  if (mine) return toSceneOpts(mine, todayTW());
  const preset = Object.keys(AVATAR_PRESETS).find(k => (p.name || "").includes(k));
  const h = hash(p.id || p.name);
  const hairs = [0x1a1a1a, 0x2b1a10, 0x3b2314, 0x5a3825, 0x6b4423];
  const base = {
    shirt: UNI, pants: 0x2c2c3a, apron: true,
    hair: hairs[h % hairs.length],
    ponytail: h % 5 === 1, bob: h % 5 === 2, glasses: (h >> 3) % 4 === 0,
  };
  return preset ? { ...base, ponytail: false, bob: false, glasses: false, ...AVATAR_PRESETS[preset] } : base;
}

const SHOP_LINES = ["歡迎光臨～現烤雞蛋糕！", "剛出爐的喔！", "原味一盒，好的～", "現烤的喔，小心燙！", "紅玉跟抹茶都很推！", "謝謝光臨，慢走～"];
const FACTORY_LINES = ["麵糊備好了！", "預拌粉秤好了 ⚖️", "攪拌機開始轉囉～", "安全・衛生・可靠！", "預拌粉補好了"];
const WAREHOUSE_LINES = ["這批要送信義 📦", "盤點中…", "棧板排好了！", "叫貨單出貨囉 🚚"];
const OFFICE_LINES = ["排班表更新好了 📋", "這個月業績不錯喔！", "來開個小會吧～", "報表整理中…"];
const REST_LINES = ["今天休假～", "休息一下 ☕", "大家加油！", "明天見 👋"];
const GYM_LINES = { run: ["再跑一公里！🏃", "流汗好舒服～"], punch: ["吃我一拳！👊", "大魔王倒下吧！"], yoga: ["深呼吸～🧘", "放鬆、放鬆…"], lift: ["再一下！💪", "練出好體力搬麵糊！"], stretch: ["伸展一下筋骨～", "久站要動一動 🙆"] };
const MEET_LINES = ["收到！📋", "這週目標是…", "我來報告一下", "大家辛苦了！"];
const PENGUIN_LINES = ["企鵝不怕熱 🐧", "翻模！翻模！", "這批烤色漂亮 👍", "麵糊備好了！"];
const GUEST_LINES = ["我要一盒原味！", "紅玉跟抹茶各一盒～", "造型好可愛，先拍照 📸", "現烤的好香喔！", "可以刷卡嗎？", "買回去給小孩吃 😊", "逛街逛到餓了～"];
const pick = a => a[(Math.random() * a.length) | 0];

export function createOffice(container, opts) {
  opts = opts || {};
  // ── 基本設定 ──
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  // v1.33 換場景時的淡入遮罩
  const fadeEl = document.createElement("div");
  fadeEl.style.cssText = "position:absolute;inset:0;background:#1d1b2e;opacity:0;pointer-events:none;z-index:2";
  container.appendChild(fadeEl);
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.touchAction = "pan-y";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1d1b2e);
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
  let camZ = 0, lastView = null, azT = null; let view = "office", camX = 0, az = Math.PI / 4;
  // v1.21 放大：使用者縮放倍率 uz、平移 pan、點人跟拍 follow、全螢幕 full
  let uz = 1, panX = 0, panZ = 0, follow = null, full = false;
  const ZMIN = 0.6, ZMAX = 3.5;

  function size() {
    const w = container.clientWidth || 360;
    // 一般模式：畫面上限＝螢幕高度 65%；全螢幕：鋪滿
    const h = full ? (container.clientHeight || window.innerHeight) : Math.round(Math.max(260, Math.min(w * 1.15, window.innerHeight * 0.65)));
    renderer.setSize(w, h);
    // 直式畫面較高：左右可視範圍收窄一點，小人更大（可再用雙指縮放）
    const a = w / h, s = a < 1 ? 10.5 / a : Math.max(7.5, 12.5 / a);
    camera.left = -s * a; camera.right = s * a; camera.top = s; camera.bottom = -s;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", size);
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => size()) : null;
  ro && ro.observe(container);

  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x3a3350, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 0.75);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26 });
  scene.add(sun); scene.add(sun.target);

  // ── 小工具 ──
  const mats = {};
  const mat = c => mats[c] || (mats[c] = new THREE.MeshLambertMaterial({ color: c }));
  function box(w, h, d, c, x, y, z, p) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; (p || scene).add(m); return m;
  }
  function glassBox(w, h, d, c, op) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: c, transparent: true, opacity: op })); }
  function textPlane(txt, w, h, opt = {}) {
    const c = document.createElement("canvas"); c.width = 512; c.height = Math.max(64, Math.round(512 * h / w));
    const g = c.getContext("2d");
    if (opt.bg) { g.fillStyle = opt.bg; g.fillRect(0, 0, c.width, c.height); }
    g.fillStyle = opt.color || "rgba(90,50,30,.55)"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "bold " + (opt.size || 64) + 'px "PingFang TC","Noto Sans TC",sans-serif';
    g.fillText(txt, c.width / 2, c.height / 2);
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
  }
  function put(P, m, x, y, z, ry, rx) { m.position.set(x, y, z); if (ry) m.rotation.y = ry; if (rx) m.rotation.x = rx; P.add(m); return m; }
  const GROUPS = [];
  const GROUP_OF = {};   // v1.41 依場景名稱找群組（v1.40 起群組建立順序和 SCENE_KEYS 不同，用索引會放錯場景）
  function group(k) { const g = new THREE.Group(); g.position.x = SCENES[k].x; g.userData.k = k; scene.add(g); GROUPS.push(g); GROUP_OF[k] = g; return g; }
  // v1.41 大樓房間：寬 w、後牆＋左側隔間（solid 實牆／door 有門口的牆／glass 玻璃牆＋玻璃門）；前方 z 3.6～6 是走廊，房間之間互通
  function bldRoom(P, w, floor, wall, trim, left, checker) {
    const hw = w / 2;
    box(w, 0.4, 12, floor, 0, -0.2, 0, P);
    if (checker) for (let i = -hw + 1; i < hw; i += 2) for (let j = -5; j < 6; j += 2) box(1.96, 0.02, 1.96, ((Math.round(i + hw) + j + 5) / 2) % 2 ? checker[0] : checker[1], i, 0.01, j, P);
    box(w + 0.4, 4, 0.4, wall, 0, 2, -6.2, P); box(w + 0.4, 0.3, 0.44, trim, 0, 3.2, -6.2, P);
    const lx = -hw - 0.2;
    if (left === "solid") { box(0.4, 4, 12.4, wall, lx, 2, 0, P); box(0.44, 0.3, 12.4, trim, lx, 3.2, 0, P); }
    else if (left === "glass") {   // 玻璃隔間：後段玻璃牆、前段玻璃門（開著）
      const gw = glassBox(0.14, 3.6, 9.4, 0xbfe7ff, 0.28); gw.position.set(lx, 1.8, -1.5); P.add(gw);
      box(0.2, 0.16, 12.4, 0x8a9aa6, lx, 3.68, 0, P); box(0.2, 3.7, 0.16, 0x8a9aa6, lx, 1.85, 3.25, P); box(0.2, 3.7, 0.16, 0x8a9aa6, lx, 1.85, -6.1, P);
      const door = glassBox(0.1, 3.2, 1.3, 0xbfe7ff, 0.32); door.position.set(lx + 0.75, 1.6, 3.95); door.rotation.y = Math.PI / 2.6; P.add(door);
      box(0.06, 0.5, 0.06, 0xd0d6dc, lx + 0.55, 1.4, 4.4, P);
    } else {   // 有門口的牆（門口在前方走廊）
      box(0.4, 4, 9.6, wall, lx, 2, -1.4, P); box(0.44, 0.3, 9.6, trim, lx, 3.2, -1.4, P);
      box(0.4, 0.8, 2.8, wall, lx, 3.6, 4.6, P);
    }
  }
  function plant(P, x, z) { box(0.6, 0.6, 0.6, 0xb5532d, x, 0.3, z, P); box(0.7, 0.7, 0.7, 0x2ecc71, x, 0.95, z, P); box(0.45, 0.5, 0.45, 0x27ae60, x, 1.5, z, P); }
  function room(P, floor, wall, trim, checker) {
    box(16, 0.4, 12, floor, 0, -0.2, 0, P);
    if (checker) for (let i = -7; i < 8; i += 2) for (let j = -5; j < 6; j += 2) if (i < 1) box(1.96, 0.02, 1.96, ((i + j) / 2) % 2 ? checker[0] : checker[1], i, 0.01, j, P);
    box(16.4, 4, 0.4, wall, 0, 2, -6.2, P); box(0.4, 4, 12.4, wall, -8.2, 2, 0, P);
    box(16.4, 0.3, 0.44, trim, 0, 3.2, -6.2, P); box(0.44, 0.3, 12.4, trim, -8.2, 3.2, 0, P);
  }
  function shelf(P, x, z, rot, kind) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot || 0; P.add(g);
    if (kind === "book") {
      box(2.4, 2.6, 0.6, 0x7a4b2a, 0, 1.3, 0, g);
      const cols = [0xe74c3c, 0xf39c12, 0xf1c40f, 0x27ae60, 0x2980b9, 0x8e44ad, 0xecf0f1];
      for (let r = 0; r < 3; r++) { let px = -1.05, i = 0; while (px < 1.0) { const w = 0.14 + ((i * 7 + r) % 4) * 0.03, h = 0.45 + ((i * 3 + r) % 3) * 0.08;
        box(w, h, 0.4, cols[(i + r * 2) % cols.length], px + w / 2, 0.25 + r * 0.8 + h / 2, 0.12, g); px += w + 0.02; i++; } }
      return;
    }
    [[-1.1, -0.25], [1.1, -0.25], [-1.1, 0.25], [1.1, 0.25]].forEach(p => box(0.08, 2.6, 0.08, 0x9aa3ad, p[0], 1.3, p[1], g));
    for (let r = 0; r < 3; r++) box(2.3, 0.06, 0.6, 0xc4ccd4, 0, 0.2 + r * 0.85, 0, g);
    for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) {
      const px = -0.8 + i * 0.53, py = 0.23 + r * 0.85;
      if (kind === "mold") { const c = (i + r) % 2 ? 0xb03a2e : 0x3d3d44; box(0.42, 0.12, 0.4, c, px, py + 0.06, 0, g); box(0.42, 0.12, 0.4, c, px, py + 0.19, 0, g); }
      else { box(0.46, 0.42, 0.38, 0xf4efe6, px, py + 0.21, 0, g); box(0.47, 0.08, 0.39, 0xc0392b, px, py + 0.26, 0, g); }
    }
  }

  // ── 工作站（電腦、烤爐、收銀機）──
  const FX = [];
  function desk(P, x, z) {
    box(2, 0.12, 1.1, 0x9b6b43, x, 1.0, z, P);
    [[-0.9, -0.45], [0.9, -0.45], [-0.9, 0.45], [0.9, 0.45]].forEach(p => box(0.1, 0.95, 0.1, 0x5d3a1f, x + p[0], 0.47, z + p[1], P));
    box(0.95, 0.62, 0.08, 0x2c2c34, x, 1.55, z - 0.3, P); box(0.12, 0.3, 0.12, 0x2c2c34, x, 1.15, z - 0.3, P);
    const scr = put(P, new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.5), new THREE.MeshBasicMaterial({ color: 0x2a2f45 })), x, 1.55, z - 0.255);
    box(0.6, 0.04, 0.22, 0xdddddd, x, 1.08, z + 0.1, P);
    box(0.75, 0.12, 0.7, 0x34495e, x, 0.6, z + 0.9, P); box(0.75, 0.7, 0.12, 0x34495e, x, 0.95, z + 1.25, P); box(0.12, 0.55, 0.12, 0x222222, x, 0.28, z + 0.9, P);
    const fx = { kind: "screen", mesh: scr, on: false }; FX.push(fx); return fx;
  }
  function oven(P, x, z, rot = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; P.add(g);
    box(2.2, 0.95, 1.2, 0xb8c0c8, 0, 0.475, 0, g); box(2.26, 0.06, 1.26, 0xdfe4e8, 0, 0.98, 0, g);
    box(1.5, 0.42, 0.9, 0x3d3d44, 0, 1.22, -0.05, g);
    const glow = put(g, new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.16), new THREE.MeshBasicMaterial({ color: 0x3a2a2a })), 0, 1.12, 0.405);
    box(0.1, 0.5, 0.1, 0x666666, -0.78, 1.55, -0.05, g); box(0.1, 0.5, 0.1, 0x666666, 0.78, 1.55, -0.05, g);
    const mold = new THREE.Group(); mold.position.set(0, 1.72, -0.05); g.add(mold);
    box(1.3, 0.13, 0.72, 0xb03a2e, 0, 0.07, 0, mold); box(1.3, 0.13, 0.72, 0x7b241c, 0, -0.07, 0, mold);
    box(1.9, 0.07, 0.07, 0x888888, 0, 0, 0, mold); box(0.08, 0.08, 0.45, 0x222222, 0.95, 0, 0.25, mold);
    box(0.45, 0.03, 0.6, 0xffffff, 0.88, 1.03, 0.15, g);
    for (let i = 0; i < 4; i++) box(0.17, 0.12, 0.17, 0xf0b429, 0.78 + (i % 2) * 0.2, 1.1, 0.02 + ((i / 2) | 0) * 0.25, g);
    const puffs = [];
    for (let i = 0; i < 3; i++) { const m = glassBox(0.22, 0.22, 0.22, 0xffffff, 0); m.material.opacity = 0; m.position.set(-0.4 + i * 0.4, 1.95, -0.05); m.userData.t = i * 0.6; g.add(m); puffs.push(m); }
    const fx = { kind: "oven", mesh: glow, mold, puffs, flipT: 0, seed: x, on: false }; FX.push(fx); return fx;
  }

  // ── 場景：辦公室 ──
  const SLOTS = {};
  const MEETSIGN = {};   // v1.41 會議倒數牌
  const REVB = {};   // v1.40 營業額布告欄（辦公室排名、工廠產線、倉庫庫存）
  // v1.41 看板：可以點一下放大（BOARD_HIT：mesh → 看板代號）
  const BOARD_HIT = [];
  function wallBoard(P, key, x, y, z, w, h, ry) {
    const bc = document.createElement("canvas"); bc.width = 512; bc.height = Math.round(512 * h / w);
    if (ry) box(0.1, h + 0.2, w + 0.2, 0x6e4b2a, x, y, z, P); else box(w + 0.2, h + 0.2, 0.1, 0x6e4b2a, x, y, z, P);   // v1.44 左牆看板（ry＝π/2）
    const bm = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bc) }));
    if (ry) bm.position.set(x + 0.06, y, z); else bm.position.set(x, y, z + 0.06); if (ry) bm.rotation.y = ry; P.add(bm);
    BOARD_HIT.push({ mesh: bm, key }); return { canvas: bc, mesh: bm };
  }
  // ── v1.41 辦公區：工作桌、營業額 PK、櫃位狀態看板、會議桌（左邊有門通大廳，右邊玻璃門通休息區）──
  {
    const P = group("office");
    bldRoom(P, 16, 0xdcae82, 0x8a5a3b, 0xc0392b, "door", [0xd4a274, 0xe3b98f]);
    put(P, textPlane("紅玉滿赤心 · 宇宙辦公室", 5, 0.8, { bg: "#c0392b", color: "#fff3e0", size: 46 }), -4.6, 3.55, -5.95);
    put(P, textPlane("辦公區 OFFICE", 5, 1.2), -4.5, 0.03, 3.0, 0, -Math.PI / 2);
    REVB.office = wallBoard(P, "rev", 4.2, 1.9, -6.0, 3.3, 2.27);
    REVB.status = wallBoard(P, "status", 0.4, 1.9, -6.0, 3.3, 2.27);
    REVB.praise = wallBoard(P, "praise", -7.95, 1.9, -1.6, 3.3, 2.27, Math.PI / 2);   // v1.44 客人讚美榮譽牆（左牆）
    shelf(P, -6.6, -5.65, 0, "book"); shelf(P, -3.6, -5.65, 0, "book");
    const d1 = desk(P, -6, 0), d2 = desk(P, -3, 0), d3 = desk(P, -6, -3.0), d4 = desk(P, -3, -3.0);
    // 會議桌（12 個位子）
    box(5.2, 0.12, 1.9, 0x6e4b2a, 3.8, 0.95, -1.4, P); box(0.3, 0.9, 1.2, 0x4a3220, 2.2, 0.45, -1.4, P); box(0.3, 0.9, 1.2, 0x4a3220, 5.4, 0.45, -1.4, P);
    box(0.5, 0.06, 0.35, 0xffffff, 3.2, 1.04, -1.3, P); box(0.5, 0.06, 0.35, 0xffffff, 4.6, 1.04, -1.6, P);
    const MEET = [];
    [1.8, 2.8, 3.8, 4.8, 5.8].forEach(x => {
      box(0.6, 0.1, 0.55, 0x2c3e50, x, 0.55, -2.75, P); box(0.6, 0.6, 0.1, 0x2c3e50, x, 0.85, -3.05, P);
      box(0.6, 0.1, 0.55, 0x2c3e50, x, 0.55, -0.05, P); box(0.6, 0.6, 0.1, 0x2c3e50, x, 0.85, 0.25, P);
      MEET.push({ x, z: -2.75, rotY: 0, sit: true, anim: "talk" }, { x, z: -0.05, rotY: Math.PI, sit: true, anim: "sit" });
    });
    MEET.push({ x: 0.7, z: -1.4, rotY: Math.PI / 2, anim: "talk" }, { x: 6.9, z: -1.4, rotY: -Math.PI / 2, sit: false, anim: "stand" });
    // 會議倒數牌（開會時才出現）
    const mc = document.createElement("canvas"); mc.width = 512; mc.height = 128;
    const meetSign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(mc), transparent: true, side: THREE.DoubleSide }));
    meetSign.position.set(3.8, 3.0, -1.4); meetSign.visible = false; P.add(meetSign);
    MEETSIGN.c = mc; MEETSIGN.mesh = meetSign;
    plant(P, 7.2, -5.3); plant(P, -1.6, -5.3); plant(P, 7.2, 2.6); plant(P, -7.4, 2.6);
    const via = [{ x: -4.5, z: -1.5 }];
    SLOTS.office = [
      { x: -6, z: 0.9, rotY: Math.PI, sit: true, anim: "type", fx: d1 },
      { x: -3, z: 0.9, rotY: Math.PI, sit: true, anim: "type", fx: d2 },
      { x: -6, z: -2.1, rotY: Math.PI, sit: true, anim: "type", fx: d3, via },
      { x: -3, z: -2.1, rotY: Math.PI, sit: true, anim: "type", fx: d4, via },
      { x: 4.2, z: -4.4, rotY: Math.PI, anim: "stand" },
      { x: 0.4, z: -4.4, rotY: Math.PI, anim: "stand" },
      { x: 1.2, z: 2.4, rotY: -Math.PI / 4, anim: "stand" },   // 6：大隊長平常站的位置
      { x: -1.0, z: 2.4, rotY: Math.PI / 4, anim: "stand" },
      { x: 6.4, z: 2.0, rotY: -Math.PI / 2, anim: "stand" },
    ];
    SLOTS.meet = MEET;
  }

  // ── 場景：工廠（v1.40 分成「預拌粉區」與「製作麵糊區」，標語：安全・衛生・可靠）──
  function mixerFloor(P, x, z) {   // 落地型攪拌機：底座、立柱、機頭、攪拌缸、攪拌棒
    const g = new THREE.Group(); g.position.set(x, 0, z); P.add(g);
    box(1.2, 0.25, 1.2, 0x9aa3ad, 0, 0.12, 0, g); box(0.45, 2.2, 0.45, 0xdfe4e8, 0, 1.3, -0.45, g);
    box(0.7, 0.55, 1.2, 0xdfe4e8, 0, 2.55, -0.05, g); box(0.72, 0.08, 1.22, 0xc0392b, 0, 2.3, -0.05, g);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.42, 0.75, 18), mat(0xc4ccd4)); bowl.position.set(0, 0.85, 0.25); g.add(bowl);
    const bat = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 18), mat(0xf2c46d)); bat.position.set(0, 1.18, 0.25); g.add(bat);
    box(1.1, 0.08, 0.12, 0x9aa3ad, 0, 0.55, -0.15, g);
    const wh = new THREE.Group(); wh.position.set(0, 1.6, 0.25); g.add(wh);
    box(0.06, 0.8, 0.06, 0x888888, 0, 0.2, 0, wh); box(0.32, 0.36, 0.04, 0xaaaaaa, 0, -0.25, 0, wh); box(0.04, 0.36, 0.32, 0xaaaaaa, 0, -0.25, 0, wh);
    const fx = { kind: "mixer", whisk: wh, on: false }; FX.push(fx); return fx;
  }
  {
    const P = group("factory");
    room(P, 0x8fa3a0, 0x6b7b83, 0xc0392b);
    [1.9, 3.3].forEach(z => box(16, 0.03, 0.12, 0xf1c40f, 0, 0.02, z, P));
    box(0.12, 0.03, 8, 0xf1c40f, -0.5, 0.02, -2.1, P);   // 兩區分隔線
    put(P, textPlane("紅玉滿赤心 · 中央工廠", 5, 0.9, { bg: "#c0392b", color: "#fff3e0", size: 46 }), -4, 3.0, -5.98);
    put(P, textPlane("安全・衛生・可靠", 4.6, 0.9, { bg: "#1e8449", color: "#ffffff", size: 54 }), 3.6, 3.0, -5.98);
    put(P, textPlane("預拌粉區 PREMIX", 5, 1.2, { color: "rgba(255,255,255,.5)" }), -4.2, 0.03, 4.6, 0, -Math.PI / 2);
    put(P, textPlane("製作麵糊區 BATTER", 5.4, 1.2, { color: "rgba(255,255,255,.5)" }), 3.4, 0.03, 4.6, 0, -Math.PI / 2);
    // 預拌粉區：麵粉架、混粉機、磅秤、工作台、麵粉袋棧板
    shelf(P, -5.5, -5.65, 0, "flour"); shelf(P, -2.5, -5.65, 0, "flour");
    const blender = (() => {   // 混粉機（橫式攪拌槽）
      const g = new THREE.Group(); g.position.set(-5.2, 0, -2.6); P.add(g);
      [[-0.9, -0.4], [0.9, -0.4], [-0.9, 0.4], [0.9, 0.4]].forEach(q => box(0.12, 0.8, 0.12, 0x7f8c8d, q[0], 0.4, q[1], g));
      box(2.2, 0.75, 1.0, 0xdfe4e8, 0, 1.15, 0, g); const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 2.2, 16, 1, false, 0, Math.PI), mat(0xc4ccd4)); lid.rotation.z = Math.PI / 2; lid.position.set(0, 1.5, 0); g.add(lid);
      box(0.45, 0.5, 0.5, 0x2c3e50, 1.35, 1.2, 0, g); box(0.5, 0.3, 0.06, 0xf4efe6, 0, 1.15, 0.53, g);
      const sh = new THREE.Group(); sh.position.set(0, 1.25, 0); g.add(sh); box(2.0, 0.06, 0.06, 0x888888, 0, 0, 0, sh); box(0.06, 0.5, 0.06, 0x999999, -0.5, 0, 0, sh); box(0.06, 0.5, 0.06, 0x999999, 0.5, 0, 0, sh);
      const fx = { kind: "mixer", whisk: sh, axis: "x", on: false }; FX.push(fx); return fx;
    })();
    box(1.0, 0.9, 0.9, 0x7f8c8d, -2.2, 0.45, -2.6, P); box(1.05, 0.06, 0.95, 0xdfe4e8, -2.2, 0.93, -2.6, P);   // 磅秤
    box(0.08, 0.6, 0.08, 0x555555, -2.2, 1.25, -3.0, P); const scr = put(P, new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshBasicMaterial({ color: 0x2a2f45 })), -2.2, 1.6, -2.96);
    box(0.5, 0.3, 0.06, 0x2c2c34, -2.2, 1.6, -3.0, P);
    const scaleFx = { kind: "screen", mesh: scr, on: false }; FX.push(scaleFx);
    box(0.55, 0.42, 0.38, 0xf4efe6, -2.2, 1.17, -2.55, P); box(0.56, 0.08, 0.39, 0xc0392b, -2.2, 1.2, -2.55, P);
    box(1.8, 0.95, 0.9, 0xb8c0c8, -3.6, 0.475, 0.9, P); box(1.86, 0.06, 0.96, 0xdfe4e8, -3.6, 0.98, 0.9, P);
    for (let i = 0; i < 3; i++) box(0.4, 0.12, 0.3, 0xf7f7f7, -4.1 + i * 0.5, 1.07, 0.9, P);
    box(1.6, 0.15, 1.2, 0x9b6b43, -7.0, 0.07, 4.4, P);
    for (let i = 0; i < 6; i++) box(0.65, 0.3, 0.45, 0xf4efe6, -7.3 + (i % 2) * 0.68, 0.3 + Math.floor(i / 2) * 0.3, 4.4, P);
    // 製作麵糊區：兩台落地型攪拌機、麵糊桶、冷藏庫、產線看板
    const m1 = mixerFloor(P, 1.6, -2.6), m2 = mixerFloor(P, 4.4, -2.6);
    for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.23, 0.55, 14), mat(i % 2 ? 0xb83227 : 0xf2c46d)); c.position.set(2.4 + (i % 2) * 0.6, 0.28, 0.7 + Math.floor(i / 2) * 0.6); P.add(c); }
    box(2.2, 2.8, 2.6, 0xdfe6ec, 6.9, 1.4, 0.2, P); box(0.1, 1.2, 0.1, 0x7f8c8d, 6.2, 1.4, 1.55, P);
    put(P, textPlane("冷藏庫", 1.4, 0.4, { bg: "#2980b9", color: "#fff", size: 60 }), 6.9, 2.4, 1.52);
    {
      const bc = document.createElement("canvas"); bc.width = 512; bc.height = 352;
      box(2.9, 2.05, 0.1, 0x6e4b2a, -0.2 + 0, 1.75, -5.95, P);
      const bm = new THREE.Mesh(new THREE.PlaneGeometry(2.75, 1.9), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bc) }));
      bm.position.set(-0.2, 1.75, -5.89); P.add(bm);
      REVB.factory = { canvas: bc, mesh: bm }; BOARD_HIT.push({ mesh: bm, key: "factory" });
    }
    SLOTS.factory = [
      { x: -5.2, z: -1.4, rotY: Math.PI, anim: "cook", fx: blender },
      { x: 1.6, z: -1.3, rotY: Math.PI, anim: "cook", fx: m1 },
      { x: -2.2, z: -1.5, rotY: Math.PI, anim: "serve", fx: scaleFx },
      { x: 4.4, z: -1.3, rotY: Math.PI, anim: "cook", fx: m2 },
      { x: -3.6, z: 1.8, rotY: Math.PI, anim: "cook" },
      { x: 3.0, z: 2.2, rotY: Math.PI, anim: "serve" },
      { x: -6.2, z: 3.4, rotY: Math.PI * 0.75, anim: "stand" },
      { x: 5.0, z: 2.8, rotY: Math.PI, anim: "stand" },
    ];
  }

  // ── 場景：倉庫（v1.40；之後接 ERP 庫存）──
  {
    const P = group("warehouse");
    room(P, 0x9c8f7a, 0x6d6152, 0xc0392b);
    [1.9, 3.3].forEach(z => box(16, 0.03, 0.12, 0xf1c40f, 0, 0.02, z, P));
    put(P, textPlane("紅玉滿赤心 · 倉庫", 5, 0.9, { bg: "#c0392b", color: "#fff3e0", size: 46 }), -4, 3.0, -5.98);
    put(P, textPlane("倉儲區 STORAGE", 5, 1.2, { color: "rgba(255,255,255,.45)" }), -3.5, 0.03, 4.6, 0, -Math.PI / 2);
    const rack = (x, z, rot) => {   // 重型貨架＋紙箱
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot || 0; P.add(g);
      [[-1.4, -0.45], [1.4, -0.45], [-1.4, 0.45], [1.4, 0.45]].forEach(q => box(0.1, 3.0, 0.1, 0x2e6da4, q[0], 1.5, q[1], g));
      for (let r = 0; r < 3; r++) { box(2.9, 0.08, 1.0, 0xe67e22, 0, 0.3 + r * 1.1, 0, g);
        for (let i = 0; i < 4; i++) { const c = (i + r) % 3 === 0 ? 0xc0392b : 0xc49a6c; box(0.6, 0.5, 0.7, c, -1.0 + i * 0.68, 0.6 + r * 1.1, 0, g); if (c !== 0xc0392b) box(0.61, 0.05, 0.12, 0xe8dcc0, -1.0 + i * 0.68, 0.86 + r * 1.1, 0, g); } }
    };
    rack(-5.5, -5.2); rack(-1.8, -5.2); rack(-7.3, -1.2, Math.PI / 2);
    [[1.6, -2.4], [3.4, -2.4], [1.6, 0.4]].forEach(([x, z], j) => { box(1.3, 0.14, 1.1, 0x9b6b43, x, 0.07, z, P); for (let i = 0; i < 4 + j; i++) box(0.55, 0.42, 0.45, i % 3 ? 0xc49a6c : 0xc0392b, x - 0.3 + (i % 2) * 0.6, 0.35 + Math.floor(i / 2) * 0.42, z, P); });
    // 手推車
    box(0.7, 0.06, 1.0, 0x555555, 4.6, 0.25, 1.2, P); box(0.06, 1.1, 0.06, 0x555555, 4.3, 0.8, 1.7, P); box(0.06, 1.1, 0.06, 0x555555, 4.9, 0.8, 1.7, P); box(0.66, 0.06, 0.06, 0x555555, 4.6, 1.35, 1.7, P);
    // 出貨桌
    box(2.2, 0.95, 1.0, 0xb8c0c8, -3.6, 0.475, 0.9, P); box(2.26, 0.06, 1.06, 0xdfe4e8, -3.6, 0.98, 0.9, P);
    box(0.5, 0.35, 0.4, 0xc49a6c, -4.1, 1.18, 0.9, P); box(0.4, 0.04, 0.3, 0xffffff, -3.2, 1.03, 0.9, P);
    {   // 庫存看板（目前用叫貨單；之後接 ERP）
      const bc = document.createElement("canvas"); bc.width = 512; bc.height = 352;
      box(2.9, 2.05, 0.1, 0x6e4b2a, 4.8, 1.75, -5.95, P);
      const bm = new THREE.Mesh(new THREE.PlaneGeometry(2.75, 1.9), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bc) }));
      bm.position.set(4.8, 1.75, -5.89); P.add(bm);
      REVB.warehouse = { canvas: bc, mesh: bm }; BOARD_HIT.push({ mesh: bm, key: "warehouse" });
    }
    plant(P, 7.3, 5.2);
    SLOTS.warehouse = [
      { x: -3.6, z: 1.8, rotY: Math.PI, anim: "serve" },
      { x: -5.5, z: -4.1, rotY: Math.PI, anim: "cook" },
      { x: 2.5, z: -1.2, rotY: Math.PI, anim: "cook" },
      { x: -1.8, z: -4.1, rotY: Math.PI, anim: "cook" },
      { x: 4.6, z: 2.4, rotY: Math.PI, anim: "stand" },
      { x: -6.0, z: 3.4, rotY: Math.PI * 0.75, anim: "stand" },
    ];
  }

  // ── 場景：各櫃位 ──
  function trex(P, x, z, o = {}) {
    const g = new THREE.Group(); g.position.set(x, o.y || 0, z); g.rotation.y = o.rotY != null ? o.rotY : Math.PI / 4; if (o.scale) g.scale.setScalar(o.scale); P.add(g);
    const R = o.color || 0xd94a3a, Cr = o.belly || 0xffe6c7, D = o.dark || 0xa8322a;
    const pm = {}; const ph = c => pm[c] || (pm[c] = new THREE.MeshPhongMaterial({ color: c, shininess: 90, specular: 0x666666 }));
    function pb(w, h, d, c, x, y, z, rx) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), ph(c)); m.position.set(x, y, z); if (rx) m.rotation.x = rx; m.castShadow = true; g.add(m); return m; }
    if (o.round) {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.85, 0.5, 24), new THREE.MeshPhongMaterial({ color: 0xd62b2b, shininess: 80 })); base.position.y = 0.25; g.add(base);
    } else {
      box(1.9, 0.5, 1.9, 0xf4f1ec, 0, 0.25, 0, g); box(1.92, 0.1, 1.92, 0xc0392b, 0, 0.42, 0, g);
      put(g, textPlane("小暴龍", 1.2, 0.3, { color: "#c0392b", size: 72 }), 0, 0.22, 0.96);
    }
    const y = 0.5;
    pb(0.42, 0.6, 0.5, R, -0.32, y + 0.3, 0); pb(0.42, 0.6, 0.5, R, 0.32, y + 0.3, 0);
    pb(0.5, 0.16, 0.7, D, -0.32, y + 0.08, 0.12); pb(0.5, 0.16, 0.7, D, 0.32, y + 0.08, 0.12);
    pb(1.1, 1.1, 1.0, R, 0, y + 1.1, -0.05); pb(0.78, 0.85, 0.06, Cr, 0, y + 1.05, 0.47);
    pb(0.7, 0.6, 0.7, R, 0, y + 0.8, -0.8); pb(0.5, 0.45, 0.6, R, 0, y + 0.6, -1.35); pb(0.3, 0.3, 0.5, R, 0, y + 0.45, -1.8);
    pb(1.05, 0.85, 1.1, R, 0, y + 2.05, 0.25); pb(0.95, 0.22, 0.65, Cr, 0, y + 1.68, 0.48);
    [-0.25, 0.25].forEach(sx => { pb(0.24, 0.26, 0.04, 0xffffff, sx, y + 2.2, 0.81); pb(0.12, 0.14, 0.03, 0x222222, sx, y + 2.18, 0.835); pb(0.16, 0.08, 0.02, 0xff9aa2, sx * 1.6, y + 1.95, 0.81); });
    pb(0.08, 0.08, 0.03, 0xffffff, -0.15, y + 1.82, 0.81); pb(0.08, 0.08, 0.03, 0xffffff, 0.15, y + 1.82, 0.81);
    pb(0.15, 0.32, 0.15, R, -0.45, y + 1.35, 0.5, -0.9); pb(0.15, 0.32, 0.15, R, 0.45, y + 1.35, 0.5, -0.9);
    pb(0.42, 0.26, 0.36, 0xf0b429, 0, y + 1.3, 0.72);
    [[2.55, 0.15], [2.6, -0.25], [1.75, -0.55], [1.25, -0.95]].forEach(s => pb(0.18, 0.22, 0.2, 0xf1c40f, 0, y + s[0], s[1]));
    return g;
  }
  function storeScene(k, th) {
    const P = group(k);
    box(16, 0.4, 12, th.floor[0], 0, -0.2, 0, P);
    for (let i = -6; i < 8; i += 4) for (let j = -4; j < 6; j += 4) box(3.9, 0.02, 3.9, (i + j) % 8 ? th.floor[0] : th.floor[1], i, 0.01, j, P);
    box(16.4, 4, 0.4, th.wall, 0, 2, -6.2, P); box(16.4, 0.25, 0.44, th.trim, 0, 3.9, -6.2, P);
    put(P, textPlane("紅玉滿赤心雞蛋糕", 6, 1.0, { bg: "#c0392b", color: "#fff3e0", size: 72 }), -2, 3.0, th.signZ || -5.98);
    ["原味", "可可", "紅玉", "抹茶"].forEach((t, i) => put(P, textPlane(t, 1.4, 0.65, { bg: "#2b2b2b", color: "#ffe08a", size: 80 }), -5.1 + i * 1.8, 1.85, -5.98));
    box(8.5, 0.95, 1, 0xb8c0c8, -2.2, 0.475, -4.9, P); box(8.56, 0.06, 1.06, 0xdfe4e8, -2.2, 0.98, -4.9, P);
    [-5.6, -5.0].forEach(px => { box(0.5, 0.6, 0.5, 0xf7f7f7, px, 1.31, -4.9, P); box(0.52, 0.06, 0.52, 0xf1c40f, px, 1.64, -4.9, P); });
    for (let i = 0; i < 8; i++) box(0.6, 0.28, 0.45, 0xc0392b, -2.5 + (i % 4) * 0.7, 1.15 + ((i / 4) | 0) * 0.28, -4.9, P);
    const ov = oven(P, -5, -1.2, Math.PI);
    box(6.9, 1.05, 1, th.counter, -0.45, 0.525, -1.2, P); box(6.95, 0.06, 1.1, 0xfffaf2, -0.45, 1.08, -1.2, P);
    box(6.9, 0.35, 0.04, 0xc0392b, -0.45, 0.65, -0.68, P);
    put(P, textPlane("現烤雞蛋糕", 3, 0.35, { color: "#fff3e0", size: 56 }), -0.45, 0.65, -0.655);
    put(P, glassBox(2.4, 0.6, 0.85, 0xcfefff, 0.28), -2.2, 1.41, -1.2);
    for (let i = 0; i < 8; i++) box(0.2, 0.14, 0.2, [0xf0b429, 0xe8a317, 0x8e4b2a][i % 3], -3.2 + i * 0.28, 1.18, -1.2, P);
    box(0.7, 0.4, 0.5, 0x2c2c34, 1.0, 1.31, -1.2, P);
    const scr = put(P, new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.28), new THREE.MeshBasicMaterial({ color: 0x2a2f45 })), 1.0, 1.35, -1.46, Math.PI);
    put(P, new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.22), new THREE.MeshBasicMaterial({ color: 0x58d68d })), 1.0, 1.35, -0.945);
    const posFx = { kind: "pos", mesh: scr, on: false }; FX.push(posFx);
    put(P, textPlane(th.title, 5, 0.9, { color: th.titleColor || "rgba(120,40,30,.4)", size: 60 }), -4.2, 0.03, 4.3, 0, -Math.PI / 2);
    box(0.08, 1.4, 0.08, 0x555555, -2.5, 3.9, -1.2, P); box(0.08, 1.4, 0.08, 0x555555, 1.6, 3.9, -1.2, P);
    put(P, textPlane("紅玉滿赤心｜" + th.title, 4.4, 0.6, { bg: th.signBg || "#c0392b", color: "#fff", size: 50 }), -0.45, 3.3, -1.15);
    plant(P, 7.3, 5.0);
    // 缺貨看板（立牌）
    stockBoard(P, k, 6.6, -1.4);
    th.deco && th.deco(P);
    SLOTS[k] = [
      { x: -5, z: -2.2, rotY: 0, anim: "cook", fx: ov },
      { x: 1.0, z: -2.2, rotY: 0, anim: "serve", fx: posFx },
      { x: -2.2, z: -2.2, rotY: 0, anim: "serve" },
      { x: -0.6, z: -2.2, rotY: 0, anim: "serve" },
      { x: 2.6, z: -3.2, rotY: Math.PI / 4, anim: "stand" },
      { x: -3.6, z: -3.4, rotY: Math.PI, anim: "cook" },
    ];
    // 客人：櫃位有人在班才出現
    GUESTS[k] = [[1.0, 0.4, Math.PI], [1.0, 1.5, Math.PI], [3.6, 3.4, -Math.PI * 0.75]].map((p, i) => {
      const cols = [[0xf5b7b1, 0x2e4053, 0x5d4037], [0x85c1e9, 0x34495e, 0x1c1c1c], [0xa9dfbf, 0x5d6d7e, 0x8d6e63], [0xf9e79f, 0x4a235a, 0x3e2723]];
      const c = cols[(SCENE_KEYS.indexOf(k) + i) % cols.length];
      const g = makeChar({ shirt: c[0], pants: c[1], hair: c[2], ponytail: i === 2 });
      g.g.position.set(SCENES[k].x + p[0], 0, p[1]); g.g.rotation.y = p[2]; g.bubble.classList.add("uo-guest"); g.scene = k;
      return g;
    });
  }

  // ── 角色 ──
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden";
  container.appendChild(overlay);
  function bubbleEl(cls) { const b = document.createElement("div"); b.className = cls; b.style.opacity = 0; overlay.appendChild(b); return b; }
  // 帽子/頭飾(y = 帽子底部中心高度)
  function addHat(g, hat, y, c) {
    const W = 0xffffff;
    switch (hat) {
      case "cap": box(0.74, 0.26, 0.7, c, 0, y - 0.05, 0, g); box(0.74, 0.06, 0.32, c, 0, y - 0.17, 0.48, g); break;
      case "chef": case "goldchef": { const k = hat === "goldchef" ? 0xf1c40f : W;
        box(0.7, 0.2, 0.66, k, 0, y - 0.05, 0, g); box(0.62, 0.5, 0.58, k, 0, y + 0.28, 0, g); box(0.84, 0.28, 0.72, k, 0, y + 0.6, 0, g); break; }
      case "beanie": box(0.76, 0.3, 0.7, 0x3b6ea5, 0, y, 0, g); box(0.2, 0.2, 0.2, W, 0, y + 0.24, 0, g); break;
      case "santa": box(0.78, 0.2, 0.72, W, 0, y - 0.05, 0, g); box(0.62, 0.3, 0.6, 0xd62828, 0, y + 0.2, 0, g);
        box(0.4, 0.26, 0.4, 0xd62828, 0, y + 0.42, -0.12, g); box(0.2, 0.2, 0.2, W, 0, y + 0.5, -0.32, g); break;
      case "pumpkin": box(0.52, 0.4, 0.52, 0xe67e22, 0, y + 0.12, 0, g); box(0.1, 0.16, 0.1, 0x2e8b3a, 0, y + 0.4, 0, g); break;
      case "party": { const m = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 8), mat(0xff6fa8)); m.position.set(0, y + 0.22, 0); g.add(m);
        box(0.14, 0.14, 0.14, 0xffe066, 0, y + 0.56, 0, g); break; }
      case "g_antenna": [-0.2, 0.2].forEach(sx => { box(0.05, 0.4, 0.05, 0x2ecc71, sx, y + 0.1, 0, g); box(0.14, 0.14, 0.14, 0x7dff7d, sx, y + 0.34, 0, g); }); break;
      case "g_helmet": { const m = glassBox(0.95, 0.9, 0.9, 0xbfe7ff, 0.35); m.position.set(0, y - 0.45, 0.02); g.add(m); box(0.98, 0.1, 0.92, 0xdfe6ec, 0, y - 0.88, 0.02, g); break; }
      case "g_ufo": box(0.8, 0.08, 0.8, 0x9aa3ad, 0, y + 0.05, 0, g); box(0.4, 0.2, 0.4, 0x8fd3ff, 0, y + 0.18, 0, g);
        [[-0.3, 0], [0.3, 0], [0, 0.3], [0, -0.3]].forEach(s => box(0.07, 0.05, 0.07, 0xffe066, s[0], y + 0.02, s[1], g)); break;
      // v1.30 季節扭蛋
      case "x_antler": [-1, 1].forEach(sx => { box(0.07, 0.42, 0.07, 0x8b5a2b, sx * 0.24, y + 0.12, 0, g); box(0.24, 0.07, 0.07, 0x8b5a2b, sx * 0.33, y + 0.26, 0, g); box(0.07, 0.18, 0.07, 0x8b5a2b, sx * 0.42, y + 0.36, 0, g); }); break;
      case "x_tree": { const m = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 8), mat(0x1e8449)); m.position.set(0, y + 0.3, 0); g.add(m);
        box(0.14, 0.14, 0.14, 0xffe066, 0, y + 0.7, 0, g); [[0.12, 0.2, 0.2], [-0.15, 0.35, 0.12], [0.08, 0.48, -0.1]].forEach(b => box(0.07, 0.07, 0.07, 0xe74c3c, b[0], y + b[1], b[2], g)); break; }
      case "c_ingot": box(0.5, 0.14, 0.32, 0xf1c40f, 0, y + 0.02, 0, g); box(0.26, 0.16, 0.2, 0xf7dc6f, 0, y + 0.16, 0, g); [-1, 1].forEach(sx => box(0.12, 0.16, 0.3, 0xf1c40f, sx * 0.28, y + 0.12, 0, g)); break;
      case "c_lion": box(0.98, 0.7, 0.9, 0xd62828, 0, y - 0.2, 0.06, g); box(1.02, 0.14, 0.94, 0xf1c40f, 0, y + 0.1, 0.06, g);
        [-0.22, 0.22].forEach(sx => { box(0.18, 0.18, 0.05, 0xffffff, sx, y - 0.1, 0.53, g); box(0.09, 0.09, 0.05, 0x111111, sx, y - 0.1, 0.56, g); });
        box(0.5, 0.12, 0.05, 0xf1c40f, 0, y - 0.42, 0.53, g); box(0.16, 0.22, 0.16, 0xffffff, 0, y + 0.3, 0.1, g); break;
      case "og_cap": box(0.74, 0.26, 0.7, 0xc0392b, 0, y - 0.05, 0, g); box(0.74, 0.06, 0.32, 0xc0392b, 0, y - 0.17, 0.48, g); box(0.3, 0.14, 0.04, 0xf1c40f, 0, y - 0.02, 0.36, g); break;   // v1.31 OG 紅帽（金色徽記）
      case "crown": box(0.7, 0.14, 0.64, 0xf1c40f, 0, y - 0.02, 0, g);
        [[-0.26, -0.22], [0.26, -0.22], [-0.26, 0.22], [0.26, 0.22], [0, 0]].forEach(s => box(0.12, 0.24, 0.12, 0xf1c40f, s[0], y + 0.16, s[1], g)); break;
    }
  }
  // 配件(商店/扭蛋)。身體:中心 y1.09、前面 z0.23、背面 z-0.23;頭頂 y2.11
  function addAcc(g, acc, o) {
    const ring = (rad, c, y, tilt) => { const m = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.05, 6, 20), new THREE.MeshBasicMaterial({ color: c })); m.position.set(0, y, 0); m.rotation.x = Math.PI / 2 + (tilt || 0); g.add(m); return m; };
    switch (acc) {
      case "bowtie": box(0.14, 0.14, 0.05, 0xc0392b, -0.1, 1.42, 0.25, g); box(0.14, 0.14, 0.05, 0xc0392b, 0.1, 1.42, 0.25, g); box(0.08, 0.08, 0.06, 0x922b21, 0, 1.42, 0.26, g); break;
      case "scarf": box(0.84, 0.14, 0.52, 0xe74c3c, 0, 1.46, 0, g); box(0.14, 0.38, 0.05, 0xe74c3c, 0.22, 1.25, 0.26, g); break;
      case "backpack": box(0.6, 0.6, 0.26, 0x8e5b3a, 0, 1.12, -0.36, g); box(0.4, 0.2, 0.05, 0xa9744f, 0, 1.0, -0.5, g); break;
      case "wings": [-1, 1].forEach(s => { const w = box(0.06, 0.6, 0.5, 0xffffff, s * 0.28, 1.35, -0.36, g); w.rotation.z = s * 0.5; }); break;
      case "cape": box(0.82, 1.0, 0.05, 0xc0392b, 0, 0.98, -0.27, g); box(0.84, 0.1, 0.5, 0xf1c40f, 0, 1.46, 0, g); break;
      case "halo": ring(0.28, 0xffe066, 2.62); break;
      case "g_starclip": box(0.16, 0.16, 0.05, 0xffe066, 0.3, 2.12, 0.22, g); break;
      case "g_moonpin": box(0.13, 0.13, 0.04, 0xf1c40f, -0.2, 1.3, 0.25, g); box(0.07, 0.13, 0.05, o.shirt || 0xc0392b, -0.17, 1.3, 0.26, g); break;
      case "g_rocket": box(0.22, 0.55, 0.22, 0xdfe6ec, -0.16, 1.15, -0.36, g); box(0.22, 0.55, 0.22, 0xdfe6ec, 0.16, 1.15, -0.36, g);
        box(0.22, 0.14, 0.22, 0xc0392b, -0.16, 1.48, -0.36, g); box(0.22, 0.14, 0.22, 0xc0392b, 0.16, 1.48, -0.36, g);
        box(0.14, 0.18, 0.14, 0xff8c1a, -0.16, 0.8, -0.36, g); box(0.14, 0.18, 0.14, 0xff8c1a, 0.16, 0.8, -0.36, g); break;
      case "g_galaxy": box(0.82, 1.0, 0.05, 0x2c2c6e, 0, 0.98, -0.27, g);
        [[-0.25, 1.2], [0.2, 0.9], [0.05, 1.3], [-0.1, 0.7], [0.28, 1.15]].forEach(s => box(0.06, 0.06, 0.02, 0xffffff, s[0], s[1], -0.3, g)); break;
      case "g_saturn": ring(0.62, 0xf5b041, 1.85, 0.35); break;
      // v1.30 季節扭蛋
      case "x_bell": box(0.84, 0.08, 0.52, 0xc0392b, 0, 1.5, 0, g); box(0.16, 0.16, 0.12, 0xf1c40f, 0, 1.38, 0.27, g); break;
      case "x_scarf": box(0.84, 0.14, 0.52, 0x1e8449, 0, 1.46, 0, g); box(0.84, 0.05, 0.53, 0xffffff, 0, 1.46, 0, g); box(0.14, 0.38, 0.05, 0xc0392b, -0.22, 1.25, 0.26, g); break;
      case "x_gift": box(0.56, 0.56, 0.4, 0xc0392b, 0, 1.12, -0.42, g); box(0.1, 0.58, 0.42, 0xf1c40f, 0, 1.12, -0.42, g); box(0.58, 0.1, 0.42, 0xf1c40f, 0, 1.12, -0.42, g); box(0.24, 0.12, 0.12, 0xf1c40f, 0, 1.46, -0.42, g); break;
      case "c_fu": box(0.2, 0.2, 0.04, 0xd62828, -0.2, 1.3, 0.25, g); box(0.1, 0.1, 0.05, 0xf1c40f, -0.2, 1.3, 0.26, g); break;
      case "c_lantern": box(0.05, 0.4, 0.05, 0x8b5a2b, 0.5, 1.1, 0.25, g); box(0.26, 0.3, 0.26, 0xd62828, 0.5, 0.8, 0.25, g); box(0.28, 0.05, 0.28, 0xf1c40f, 0.5, 0.97, 0.25, g); box(0.28, 0.05, 0.28, 0xf1c40f, 0.5, 0.63, 0.25, g); break;
      case "c_redpack": box(0.5, 0.62, 0.14, 0xd62828, 0, 1.1, -0.34, g); box(0.22, 0.22, 0.04, 0xf1c40f, 0, 1.2, -0.42, g); break;
      case "c_dragon": box(0.82, 1.0, 0.05, 0xf1c40f, 0, 0.98, -0.27, g); box(0.84, 0.1, 0.5, 0xd62828, 0, 1.46, 0, g);
        [[-0.25, 1.25], [-0.1, 1.05], [0.1, 0.9], [0.25, 0.7]].forEach(s2 => box(0.14, 0.14, 0.02, 0xd62828, s2[0], s2[1], -0.3, g)); break;
    }
  }
  // 服裝(取代上衣/圍裙的細節)
  function addOutfit(g, outfit) {
    switch (outfit) {
      case "chefsuit": [1.3, 1.1, 0.9].forEach(y => { box(0.06, 0.06, 0.02, 0x333333, -0.12, y, 0.24, g); box(0.06, 0.06, 0.02, 0x333333, 0.12, y, 0.24, g); }); box(0.8, 0.1, 0.48, 0xc0392b, 0, 1.46, 0, g); break;
      case "spacesuit": box(0.4, 0.3, 0.04, 0x2e86de, 0, 1.15, 0.24, g); box(0.1, 0.1, 0.03, 0xe74c3c, -0.1, 1.17, 0.27, g); box(0.1, 0.1, 0.03, 0x2ecc71, 0.08, 1.17, 0.27, g); box(0.6, 0.55, 0.3, 0xdfe6ec, 0, 1.12, -0.36, g); break;
      case "raincoat": box(0.8, 0.3, 0.7, 0xf4d03f, 0, 2.05, -0.06, g); break;
      case "x_santa": box(0.8, 0.1, 0.48, 0xffffff, 0, 1.46, 0, g); box(0.8, 0.1, 0.48, 0x1a1a1a, 0, 0.92, 0, g); box(0.16, 0.1, 0.03, 0xf1c40f, 0, 0.92, 0.25, g); box(0.1, 0.5, 0.03, 0xffffff, 0, 1.2, 0.25, g); break;
      case "x_snowman": [1.3, 1.1].forEach(y => box(0.08, 0.08, 0.03, 0x1a1a1a, 0, y, 0.25, g)); box(0.8, 0.12, 0.5, 0xc0392b, 0, 1.46, 0, g); break;
      case "c_tang": box(0.06, 0.6, 0.03, 0xf1c40f, 0.1, 1.15, 0.25, g); [1.35, 1.15, 0.95].forEach(y => box(0.14, 0.04, 0.03, 0xf1c40f, 0.1, y, 0.26, g)); box(0.8, 0.1, 0.5, 0xf1c40f, 0, 1.46, 0, g); break;
      case "goldtrex": {   // v1.41 金色小暴龍裝：人穿布偶裝，看得到臉（頭套、背刺、尾巴、肚子）
        const Y = 0xf1c40f, D = 0xc49a12;
        box(0.84, 0.36, 0.8, Y, 0, 2.25, -0.02, g); box(0.84, 0.7, 0.14, Y, 0, 1.85, -0.37, g); box(0.12, 0.62, 0.72, Y, -0.4, 1.82, -0.02, g); box(0.12, 0.62, 0.72, Y, 0.4, 1.82, -0.02, g);
        [-0.22, 0.22].forEach(x => { box(0.16, 0.14, 0.04, 0xffffff, x, 2.3, 0.38, g); box(0.08, 0.08, 0.03, 0x222222, x, 2.3, 0.4, g); });
        for (let i = 0; i < 4; i++) box(0.84 - i * 0.1, 0.06, 0.06, 0xffffff, 0, 2.08, 0.4, g);
        [[2.45, -0.15], [2.2, -0.45], [1.8, -0.5], [1.4, -0.4]].forEach(q => box(0.12, 0.18, 0.16, D, 0, q[0], q[1], g));
        box(0.5, 0.55, 0.04, 0xffe6c7, 0, 1.05, 0.25, g);
        box(0.36, 0.3, 0.5, Y, 0, 0.75, -0.5, g); box(0.24, 0.22, 0.45, Y, 0, 0.6, -0.9, g);
        break;
      }
    }
  }
  // 小暴龍裝(品牌吉祥物,可自選穿上)
  function makeTrex(o) {
    const g = new THREE.Group(); scene.add(g);
    const R = o.trexColor || 0xd94a3a, Cr = 0xffe6c7, D = o.trexColor ? 0xc49a12 : 0xa8322a;
    const legL = new THREE.Group(); legL.position.set(-0.22, 0.65, 0); g.add(legL); box(0.3, 0.65, 0.34, R, 0, -0.32, 0, legL); box(0.34, 0.12, 0.5, D, 0, -0.6, 0.1, legL);
    const legR = new THREE.Group(); legR.position.set(0.22, 0.65, 0); g.add(legR); box(0.3, 0.65, 0.34, R, 0, -0.32, 0, legR); box(0.34, 0.12, 0.5, D, 0, -0.6, 0.1, legR);
    box(0.9, 0.95, 0.7, R, 0, 1.1, 0, g); box(0.6, 0.7, 0.05, Cr, 0, 1.05, 0.36, g);
    box(0.5, 0.4, 0.5, R, 0, 1.0, -0.5, g); box(0.32, 0.3, 0.5, R, 0, 0.85, -0.9, g); box(0.2, 0.2, 0.4, R, 0, 0.75, -1.25, g);
    [[1.7, -0.25], [1.5, -0.55], [1.3, -0.9]].forEach(s => box(0.14, 0.2, 0.18, 0xf1c40f, 0, s[0], s[1], g));
    const armL = new THREE.Group(); armL.position.set(-0.52, 1.35, 0.2); g.add(armL); box(0.14, 0.36, 0.14, R, 0, -0.16, 0.08, armL);
    const armR = new THREE.Group(); armR.position.set(0.52, 1.35, 0.2); g.add(armR); box(0.14, 0.36, 0.14, R, 0, -0.16, 0.08, armR);
    box(0.95, 0.75, 0.85, R, 0, 2.0, 0.12, g); box(0.8, 0.2, 0.62, Cr, 0, 1.7, 0.3, g);
    [-0.25, 0.25].forEach(sx => { box(0.2, 0.22, 0.03, 0xffffff, sx, 2.15, 0.555, g); box(0.1, 0.12, 0.03, 0x222222, sx, 2.13, 0.575, g); box(0.16, 0.08, 0.02, 0xff9aa2, sx * 1.6, 1.95, 0.555, g); });
    box(0.07, 0.07, 0.03, 0xffffff, -0.15, 1.85, 0.555, g); box(0.07, 0.07, 0.03, 0xffffff, 0.15, 1.85, 0.555, g);
    addHat(g, o.hat, 2.55, R);
    if (o.acc && ["cape", "g_galaxy", "wings", "halo", "g_saturn", "scarf", "bowtie"].indexOf(o.acc) >= 0) { const a = new THREE.Group(); a.position.y = 0.05; a.scale.set(1.1, 1, 1.4); g.add(a); addAcc(a, o.acc, o); }
    return { g, legL, legR, armL, armR, bubble: bubbleEl("uo-bubble"), t: Math.random() * 5, anim: "stand", sit: false, path: [], speed: 3.2, trex: true };
  }
  function buildChar(av) { const c = av.mascot === "trex" ? makeTrex(av) : av.mascot === "robot" ? makeRobot(av) : av.penguin ? makePenguin(av) : makeChar(av); c.saying = av.saying || ""; return c; }
  // v1.41 機器人角色（傳說 8 心解鎖）：銀色身體、螢幕臉、天線燈、胸口赤心
  function makeRobot(o) {
    const g = new THREE.Group(); scene.add(g);
    const S = 0xbfc8d2, D = 0x7f8c99, A = o.shirt && o.shirt !== 0xc0392b ? o.shirt : 0xc0392b;
    const legL = new THREE.Group(); legL.position.set(-0.2, 0.7, 0); g.add(legL); box(0.26, 0.6, 0.3, D, 0, -0.3, 0, legL); box(0.34, 0.14, 0.44, 0x4a5560, 0, -0.62, 0.06, legL);
    const legR = new THREE.Group(); legR.position.set(0.2, 0.7, 0); g.add(legR); box(0.26, 0.6, 0.3, D, 0, -0.3, 0, legR); box(0.34, 0.14, 0.44, 0x4a5560, 0, -0.62, 0.06, legR);
    box(0.86, 0.82, 0.56, S, 0, 1.1, 0, g); box(0.5, 0.42, 0.04, 0x2c3e50, 0, 1.12, 0.29, g);
    box(0.2, 0.18, 0.03, A, 0, 1.16, 0.315, g); box(0.1, 0.1, 0.03, A, -0.07, 1.25, 0.315, g); box(0.1, 0.1, 0.03, A, 0.07, 1.25, 0.315, g);
    const armL = new THREE.Group(); armL.position.set(-0.54, 1.42, 0); g.add(armL); box(0.2, 0.62, 0.24, D, 0, -0.28, 0, armL); box(0.24, 0.16, 0.26, S, 0, -0.62, 0, armL);
    const armR = new THREE.Group(); armR.position.set(0.54, 1.42, 0); g.add(armR); box(0.2, 0.62, 0.24, D, 0, -0.28, 0, armR); box(0.24, 0.16, 0.26, S, 0, -0.62, 0, armR);
    box(0.2, 0.12, 0.2, D, 0, 1.56, 0, g);
    box(0.82, 0.66, 0.66, S, 0, 1.92, 0, g); box(0.66, 0.44, 0.03, 0x1b2631, 0, 1.92, 0.335, g);
    [-0.15, 0.15].forEach(x => { const e = box(0.12, 0.12, 0.02, 0x5dfdcb, x, 1.97, 0.355, g); e.material = new THREE.MeshBasicMaterial({ color: 0x5dfdcb }); });
    box(0.22, 0.04, 0.02, 0x5dfdcb, 0, 1.82, 0.355, g);
    box(0.08, 0.2, 0.42, D, -0.45, 1.92, 0, g); box(0.08, 0.2, 0.42, D, 0.45, 1.92, 0, g);
    box(0.05, 0.3, 0.05, D, 0, 2.38, 0, g); const bulb = box(0.14, 0.14, 0.14, 0xff5a5a, 0, 2.56, 0, g); bulb.material = new THREE.MeshBasicMaterial({ color: 0xff5a5a });
    addHat(g, o.hat, 2.28, A);
    if (o.acc) addAcc(g, o.acc, o);
    return { g, legL, legR, armL, armR, bubble: bubbleEl("uo-bubble"), t: Math.random() * 5, anim: "stand", sit: false, path: [], speed: 3.2, robot: true };
  }
  function makeChar(o) {
    const g = new THREE.Group(); scene.add(g);
    const legL = new THREE.Group(); legL.position.set(-0.18, 0.7, 0); g.add(legL); box(0.3, 0.7, 0.32, o.pants, 0, -0.35, 0, legL);
    const legR = new THREE.Group(); legR.position.set(0.18, 0.7, 0); g.add(legR); box(0.3, 0.7, 0.32, o.pants, 0, -0.35, 0, legR);
    box(0.78, 0.78, 0.46, o.shirt, 0, 1.09, 0, g);
    if (o.apron && !o.outfit) box(0.6, 0.6, 0.04, 0xffffff, 0, 1.0, 0.24, g);
    const armL = new THREE.Group(); armL.position.set(-0.5, 1.42, 0); g.add(armL); box(0.22, 0.66, 0.26, o.shirt, 0, -0.3, 0, armL);
    const armR = new THREE.Group(); armR.position.set(0.5, 1.42, 0); g.add(armR); box(0.22, 0.66, 0.26, o.shirt, 0, -0.3, 0, armR);
    box(0.68, 0.62, 0.62, o.skin || 0xf5c9a0, 0, 1.8, 0, g);
    if (o.hairStyle === "buzz") box(0.7, 0.1, 0.64, o.hair, 0, 2.1, 0, g);
    else box(0.72, 0.2, 0.66, o.hair, 0, 2.15, 0, g);
    if (o.hairStyle === "long") { box(0.1, 0.8, 0.62, o.hair, -0.37, 1.75, -0.02, g); box(0.1, 0.8, 0.62, o.hair, 0.37, 1.75, -0.02, g); box(0.72, 0.8, 0.1, o.hair, 0, 1.75, -0.33, g); }
    if (o.hairStyle === "bun" && !o.hat) box(0.3, 0.3, 0.3, o.hair, 0, 2.42, -0.05, g);
    addHat(g, o.hat, 2.3, o.shirt);
    if (o.cap) { box(0.74, 0.26, 0.7, o.cap, 0, 2.22, 0, g); box(0.74, 0.06, 0.32, o.cap, 0, 2.1, 0.48, g); }
    if (o.glasses) box(0.56, 0.12, 0.03, 0x222222, 0, 1.84, 0.32, g);
    if (o.ponytail) { box(0.72, 0.45, 0.12, o.hair, 0, 1.95, -0.33, g); box(0.2, 0.2, 0.2, o.hair, 0, 2.05, -0.45, g); box(0.18, 0.55, 0.18, o.hair, 0, 1.7, -0.5, g); }
    if (o.bob) { box(0.1, 0.4, 0.62, o.hair, -0.37, 1.9, -0.02, g); box(0.1, 0.4, 0.62, o.hair, 0.37, 1.9, -0.02, g); box(0.72, 0.45, 0.1, o.hair, 0, 1.92, -0.33, g); }
    if (o.slim) g.scale.set(0.86, 1, 0.86);
    box(0.09, 0.11, 0.02, 0x222222, -0.15, 1.83, 0.315, g); box(0.09, 0.11, 0.02, 0x222222, 0.15, 1.83, 0.315, g);
box(0.18, 0.04, 0.02, 0xb03a2e, 0, 1.64, 0.315, g);
    if (o.face === "sunglasses") box(0.62, 0.15, 0.03, 0x111111, 0, 1.84, 0.335, g);
    if (o.face === "mask") box(0.5, 0.26, 0.03, 0xffffff, 0, 1.62, 0.335, g);
    if (o.outfit) addOutfit(g, o.outfit);
    if (o.acc) addAcc(g, o.acc, o);
    return { g, legL, legR, armL, armR, bubble: bubbleEl("uo-bubble"), t: Math.random() * 5, anim: "stand", sit: false, path: [], speed: 3.4 };
  }
  function makePenguin(o) {
    const g = new THREE.Group(); scene.add(g);
    const B = 0x1c1c24;
    const legL = new THREE.Group(); legL.position.set(-0.22, 0.3, 0); g.add(legL); box(0.26, 0.25, 0.26, B, 0, -0.12, 0, legL); box(0.32, 0.08, 0.45, 0xf39c12, 0, -0.26, 0.08, legL);
    const legR = new THREE.Group(); legR.position.set(0.22, 0.3, 0); g.add(legR); box(0.26, 0.25, 0.26, B, 0, -0.12, 0, legR); box(0.32, 0.08, 0.45, 0xf39c12, 0, -0.26, 0.08, legR);
    box(1.0, 1.2, 0.82, B, 0, 0.9, 0, g); box(0.7, 0.9, 0.05, 0xffffff, 0, 0.85, 0.42, g);
    box(1.05, 0.55, 0.86, o.shirt, 0, 1.05, 0, g); box(0.18, 0.16, 0.02, 0xe74c3c, 0.22, 1.12, 0.44, g);
    box(0.6, 0.4, 0.05, 0xffffff, 0, 0.6, 0.44, g);
    const armL = new THREE.Group(); armL.position.set(-0.56, 1.35, 0); g.add(armL); box(0.14, 0.75, 0.42, B, 0, -0.32, 0, armL);
    const armR = new THREE.Group(); armR.position.set(0.56, 1.35, 0); g.add(armR); box(0.14, 0.75, 0.42, B, 0, -0.32, 0, armR);
    box(0.9, 0.72, 0.78, B, 0, 1.86, 0, g); box(0.66, 0.46, 0.04, 0xffffff, 0, 1.82, 0.39, g);
    box(0.1, 0.12, 0.02, 0x111111, -0.15, 1.9, 0.415, g); box(0.1, 0.12, 0.02, 0x111111, 0.15, 1.9, 0.415, g);
    box(0.24, 0.12, 0.22, 0xf39c12, 0, 1.76, 0.5, g); box(0.14, 0.07, 0.02, 0xff9aa2, -0.27, 1.74, 0.415, g); box(0.14, 0.07, 0.02, 0xff9aa2, 0.27, 1.74, 0.415, g);
    box(0.95, 0.12, 0.82, o.shirt, 0, 2.27, 0, g);
    addHat(g, o.hat, 2.5, o.shirt);
    return { g, legL, legR, armL, armR, bubble: bubbleEl("uo-bubble"), t: Math.random() * 5, anim: "stand", sit: false, path: [], speed: 3, penguin: true };
  }

  const GUESTS = {};
  const ROBOTS = [];
  const TWINKLE = [], SNOW = [];
  const BOARDS = {};
  const BOARD_ITEMS = {}, REV_BY_SCENE = {};   // v1.40 看板內容（缺貨＋即時營業額）
  const FONT = s => `bold ${s}px "PingFang TC","Noto Sans TC",sans-serif`;
  function drawBoard(k, items) {
    const b = BOARDS[k]; if (!b) return;
    BOARD_ITEMS[k] = items = items || [];
    const rv = REV_BY_SCENE[k];
    const g = b.canvas.getContext("2d"), W = 512, H = 384;
    g.fillStyle = "#fbfaf5"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#c0392b"; g.fillRect(0, 0, W, 70);
    g.fillStyle = "#fff"; g.font = 'bold 40px "PingFang TC","Noto Sans TC",sans-serif'; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("📋 缺貨看板", W / 2, 36);
    g.textAlign = "left";
    const maxN = rv ? 4 : 6;
    if (!items.length) { g.fillStyle = "#2a7040"; g.font = 'bold 44px "PingFang TC","Noto Sans TC",sans-serif'; g.fillText("✅ 目前不缺", 40, rv ? 160 : 200); }
    else {
      g.fillStyle = "#c03030"; g.font = 'bold 38px "PingFang TC","Noto Sans TC",sans-serif';
      items.slice(0, maxN).forEach((it, i) => g.fillText("• " + it, 30 + (i % 2) * 240, 120 + Math.floor(i / 2) * 80));
      if (items.length > maxN) { g.fillStyle = "#8a7a68"; g.font = '28px sans-serif'; g.fillText("…還有 " + (items.length - maxN) + " 項", 30, rv ? 268 : 355); }
    }
    if (rv) {   // v1.40 即時營業額（這個櫃位最新一次回報）
      g.fillStyle = "#7a1f16"; g.fillRect(0, 290, W, 94);
      g.fillStyle = "#ffd98a"; g.font = FONT(30); g.textAlign = "left"; g.fillText("⚡ " + rv.time + " 營業額", 22, 337);
      g.fillStyle = "#fff"; g.font = FONT(46); g.textAlign = "right"; g.fillText("$" + Number(rv.amount).toLocaleString(), W - 22, 337); g.textAlign = "left";
    }
    b.mesh.material.map.needsUpdate = true;
  }
  // v1.40 辦公室布告欄：全部櫃位即時營業額排名
  function drawRevOffice(list) {
    const b = REVB.office; if (!b) return;
    const g = b.canvas.getContext("2d"), W = 512, H = 352;
    g.fillStyle = "#fbfaf5"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#c0392b"; g.fillRect(0, 0, W, 64);
    g.fillStyle = "#fff"; g.font = FONT(34); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("⚡ 今日即時營業額 PK", W / 2, 33);
    g.textAlign = "left";
    if (!list.length) { g.fillStyle = "#8a7a68"; g.font = FONT(32); g.fillText("今天還沒有櫃位回報", 40, 190); }
    list.slice(0, 6).forEach((x, i) => {
      const y = 100 + i * 46;
      g.fillStyle = i === 0 ? "#fff3cd" : i % 2 ? "#f6efe3" : "#fbfaf5"; g.fillRect(8, y - 21, W - 16, 42);
      g.fillStyle = "#3a2a1a"; g.font = FONT(28); g.fillText((["🥇", "🥈", "🥉"][i] || (i + 1) + ".") + " " + shortLoc(x.loc).slice(0, 7), 16, y);
      g.fillStyle = "#8a7a68"; g.font = FONT(22); g.fillText(x.time, 268, y);
      g.fillStyle = i === 0 ? "#c0392b" : "#3a2a1a"; g.font = FONT(30); g.textAlign = "right"; g.fillText("$" + Number(x.amount).toLocaleString(), W - 16, y); g.textAlign = "left";
    });
    b.mesh.material.map.needsUpdate = true;
  }
  // v1.40 工廠產線看板、倉庫庫存看板（目前用叫貨單，之後接 ERP）
  function drawPanel(key, title, rows, foot) {
    const b = REVB[key]; if (!b) return;
    const g = b.canvas.getContext("2d"), W = 512, H = 352;
    g.fillStyle = "#fbfaf5"; g.fillRect(0, 0, W, H);
    g.fillStyle = key === "factory" ? "#1e8449" : "#2e6da4"; g.fillRect(0, 0, W, 64);
    g.fillStyle = "#fff"; g.font = FONT(34); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(title, W / 2, 33);
    g.textAlign = "left";
    rows.forEach(([l, v], i) => {
      const y = 108 + i * 52;
      g.fillStyle = "#3a2a1a"; g.font = FONT(30); g.fillText(l, 24, y);
      g.fillStyle = "#c0392b"; g.font = FONT(36); g.textAlign = "right"; g.fillText(String(v), W - 24, y); g.textAlign = "left";
    });
    if (foot) { g.fillStyle = "#8a7a68"; g.font = FONT(20); g.fillText(foot, 24, H - 22); }
    b.mesh.material.map.needsUpdate = true;
  }
  function drawOpsBoards(bd) {
    bd = bd || {};
    const f = bd.factory || {}, w = bd.warehouse || {};
    drawPanel("factory", "🏭 今日產線", [["待做麵糊", (f.batter || 0) + " 包"], ["預拌粉需求", (f.flour || 0) + " 袋"], ...(f.byLoc || []).slice(0, 2).map(x => ["・" + x.loc, x.qty + " 包"])], "依各櫃位叫貨單（未出貨）");
    drawPanel("warehouse", "📦 倉庫看板", [["待出貨叫貨單", (w.pending || 0) + " 張"], ["配送中", (w.shipped || 0) + " 張"], ["今天新進叫貨", (w.todayIn || 0) + " 張"]], "之後接 ERP 顯示真實庫存");
  }
  // v1.41 大樓看板：櫃位狀態、今日出勤、菜單、排行榜、運動
  function drawList(key, title, color, rows, foot) {
    const b = REVB[key]; if (!b) return;
    const g = b.canvas.getContext("2d"), W = 512, H = 352;
    g.fillStyle = "#fbfaf5"; g.fillRect(0, 0, W, H);
    g.fillStyle = color; g.fillRect(0, 0, W, 64);
    g.fillStyle = "#fff"; g.font = FONT(34); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(title, W / 2, 33);
    g.textAlign = "left";
    if (!rows.length) { g.fillStyle = "#8a7a68"; g.font = FONT(30); g.fillText(foot || "—", 30, 190); }
    rows.slice(0, 6).forEach(([l, v, c], i) => {
      const y = 100 + i * 44;
      g.fillStyle = i % 2 ? "#f6efe3" : "#fbfaf5"; g.fillRect(8, y - 20, W - 16, 40);
      g.fillStyle = "#3a2a1a"; g.font = FONT(26); g.fillText(String(l).slice(0, 12), 18, y);
      g.fillStyle = c || "#c0392b"; g.font = FONT(26); g.textAlign = "right"; g.fillText(String(v), W - 18, y); g.textAlign = "left";
    });
    if (rows.length && foot) { g.fillStyle = "#8a7a68"; g.font = FONT(20); g.fillText(foot, 18, H - 18); }
    b.mesh.material.map.needsUpdate = true;
  }
  const ST_TXT = { open: ["營業中", "#1e8449"], before: ["準備中", "#b9770e"], closed: ["已打烊", "#7f8c8d"] };
  function drawStatus(map) {
    map = map || {};
    const rows = Object.keys(map).filter(k => SCENES[k] && SCENES[k].store && map[k] && (map[k].state === "open" || map[k].batterLow || map[k].pickup))
      .map(k => { const m = map[k], t = ST_TXT[m.state] || ST_TXT.before; return [SCENES[k].short, (m.batterLow ? "⚠️麵糊 " : "") + (m.pickup ? "取貨" + m.pickup + " " : "") + t[0], m.batterLow ? "#c0392b" : t[1]]; });
    drawList("status", "🏪 櫃位狀態", "#2e6da4", rows, "目前沒有櫃位營業");
  }
  function drawAttend(list) {
    const on = (list || []).filter(p => !p.resting && !p.isBoss), lb = GAME.lobby || {};
    const top = [...(lb.welcome || []).map(x => ["🎉 歡迎 " + x.name, "新隊員", "#c0392b"]), ...(lb.anniv || []).map(x => ["🎂 " + x.name, "到職 " + x.years + " 週年", "#c0392b"])];
    drawList("attend", "☀️ 今日出勤 " + on.length + " 人", "#e67e22", [...top, ...on.map(p => [p.name, shortLoc(p.location || "").slice(0, 6), "#1e8449"])], "大家早安！今天也加油");
  }
  // v1.44 遊戲排行榜、今日菜單、客人讚美、壽星蛋糕
  function drawV44() {
    const rk = (GAME.rank || []).filter(g => g.top.length);
    drawList("rank", "🏆 本週排行榜", "#8e44ad", [["🧸 夾娃娃機", "點機台就能玩", "#ff6fa8"], ...rk.slice(0, 5).map(g => [g.name + "・" + g.top[0].name, String(g.top[0].score), "#8e44ad"])], "");
    const mn = (GAME.canteen && GAME.canteen.menu && GAME.canteen.menu.lines) || [];
    drawList("menu", "🍱 今日菜單", "#c0392b", mn.length ? mn.map((l, i) => [(i + 1) + ". " + l, ""]) : [["主廚推薦", "敬請期待"], ["飯後甜點", "現烤雞蛋糕"]], "");
    drawList("praise", "⭐ 客人的讚美", "#f39c12", (GAME.praise || []).slice(0, 6).map(x => [(x.who || x.loc || "紅玉滿") + "", x.text.slice(0, 10), "#b9770e"]), "主管點看板可以貼客人的好評");
    if (cakeG) { cakeG.parent.remove(cakeG); cakeG = null; }
    if ((GAME.birthdays || []).length) {   // 壽星蛋糕放在飯堂第三張桌子
      cakeG = new THREE.Group(); GROUP_OF.canteen.add(cakeG);
      box(0.9, 0.35, 0.9, 0xfff3e0, 1.4, 1.05, 1.0, cakeG); box(0.92, 0.08, 0.92, 0xe84393, 1.4, 1.2, 1.0, cakeG);
      [-0.25, 0, 0.25].forEach(dx => { box(0.05, 0.22, 0.05, 0xf1c40f, 1.4 + dx, 1.36, 1.0, cakeG); const f = box(0.06, 0.08, 0.06, 0xff6a1a, 1.4 + dx, 1.5, 1.0, cakeG); f.material = new THREE.MeshBasicMaterial({ color: 0xff8c1a }); });
      put(cakeG, textPlane("🎂 生日快樂 " + GAME.birthdays.map(b => b.name).join("、").slice(0, 10), 3.2, 0.5, { bg: "#e84393", color: "#fff", size: 54 }), 1.4, 2.1, 1.0);
    }
  }
  let cakeG = null;
  // v1.42 感謝牆、證照榮譽牆、運動室（比賽公告＋完賽榮譽牆）
  function drawWalls() {
    drawList("thanks", "💌 感謝牆", "#e84393", (GAME.thanks || []).slice(0, 6).map(t => [t.fromName + " → " + t.toName, t.text.slice(0, 9), "#7a2a4a"]), "點隊員 →「💌 謝謝」貼一張");
    const w = GAME.bfWall || {};
    drawList("cert", "🎓 證照榮譽牆", "#2e86c1", (w.cert || []).map(x => [x.name, x.title.slice(0, 9), "#2e6da4"]), "考取證照，學費補 50%");
    const ev = (GAME.events || []).slice(0, 3).map(x => ["🏃 " + x.name, x.date.slice(5).replace("-", "/"), "#27ae60"]);
    drawList("sport", "🏃 比賽公告・完賽榜", "#27ae60", [...ev, ...(w.sport || []).slice(0, 6 - ev.length).map(x => ["🏅 " + x.name, x.title.slice(0, 8), "#c0392b"])], "到大廳服務台貼比賽，一起報名！");
  }
  // 小型雙軸烤爐（攤車、櫃屋用）：一組三台，中間那台有人就三台一起開
  function miniOvens(P, xs, y, z) {
    const ovens = xs.map((x, idx) => {
      const g = new THREE.Group(); g.position.set(x, y, z); P.add(g);
      box(0.46, 0.22, 0.6, 0xb8bec4, 0, 0.11, 0, g);
      box(0.06, 0.55, 0.06, 0x777777, -0.2, 0.45, 0, g); box(0.06, 0.55, 0.06, 0x777777, 0.2, 0.45, 0, g);
      const mold = new THREE.Group(); mold.position.set(0, 0.5, 0); g.add(mold);
      box(0.36, 0.42, 0.08, 0x8f969c, 0, 0, 0.03, mold); box(0.36, 0.42, 0.08, 0x6d7378, 0, 0, -0.06, mold);
      box(0.05, 0.05, 0.3, 0x222222, 0, -0.1, 0.22, mold);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.06), new THREE.MeshBasicMaterial({ color: 0x3a2a2a })); glow.position.set(0, 0.1, 0.305); g.add(glow);
      const puffs = [];
      for (let i = 0; i < 2; i++) { const m = glassBox(0.14, 0.14, 0.14, 0xffffff, 0); m.material.opacity = 0; m.position.set(-0.08 + i * 0.16, 0.9, 0); m.userData.t = i * 0.9; g.add(m); puffs.push(m); }
      const fx = { kind: "oven", mesh: glow, mold, puffs, flipT: 0, seed: idx * 0.7, on: false, small: true }; FX.push(fx); return fx;
    });
    ovens[1].link = [ovens[0], ovens[2]];
    return ovens;
  }
  function stockBoard(P, k, x, z) {
    const bg = new THREE.Group(); bg.position.set(x, 0, z); bg.rotation.y = Math.PI / 4; P.add(bg);
    box(0.08, 1.6, 0.08, 0x555555, -0.9, 0.8, 0, bg); box(0.08, 1.6, 0.08, 0x555555, 0.9, 0.8, 0, bg);
    box(2.3, 1.7, 0.08, 0x6e4b2a, 0, 2.1, -0.05, bg);
    const bc = document.createElement("canvas"); bc.width = 512; bc.height = 384;
    const bm = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.55), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bc) }));
    bm.position.set(0, 2.1, 0.0); bg.add(bm);
    BOARDS[k] = { canvas: bc, mesh: bm }; BOARD_HIT.push({ mesh: bm, key: "store:" + k }); drawBoard(k, []);
    opsProps(k, bg);
  }
  // ── v1.21 櫃位營運連動：麵糊桶（四口味）、待取貨紙箱、準備中／已打烊立牌 ──
  const OPS = {}, OPS_STATE = {};
  const BATTER = [["原味", 0xf2c46d], ["其他口味", 0xb83227]];   // v1.24：只分原味／其他口味
  const BATTER_FULL = 10, BATTER_LOW = 2;
  function canvasTex(cw, ch) { const c = document.createElement("canvas"); c.width = cw; c.height = ch; const t = new THREE.CanvasTexture(c); return { c, t }; }
  function opsProps(k, bg) {
    const o = { k };
    // 麵糊桶：看板前方的木棧板上，四個半透明桶，桶內液面高度＝剩餘包數
    const bat = new THREE.Group(); bg.add(bat); o.bat = bat;
    box(2.1, 0.08, 0.62, 0x8a6a4a, 0, 0.04, 0.55, bat);
    const shell = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.32 });
    o.fills = BATTER.map(([, col], i) => {
      const x = -0.42 + i * 0.84;
      const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.21, 0.56, 14), shell); sh.position.set(x, 0.36, 0.55); bat.add(sh);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.025, 6, 16), mat(0xdddddd)); rim.rotation.x = Math.PI / 2; rim.position.set(x, 0.64, 0.55); bat.add(rim);
      const f = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.2, 1, 14), mat(col)); f.position.set(x, 0.09, 0.55); f.scale.y = 0.001; bat.add(f);
      return f;
    });
    const st = canvasTex(512, 64); o.strip = st;
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.26), new THREE.MeshBasicMaterial({ map: st.t, transparent: true }));
    sm.position.set(0, 1.12, 0.01); bat.add(sm);
    bat.visible = false;
    // 待取貨紙箱：看板左側小桌，最多疊 4 箱，上方標示筆數
    const box2 = new THREE.Group(); box2.position.set(-1.65, 0, 0.35); bg.add(box2); o.boxes = box2;
    box(0.7, 0.06, 0.55, 0x6e4b2a, 0, 0.62, 0, box2); [-0.3, 0.3].forEach(x => box(0.06, 0.6, 0.06, 0x555555, x, 0.3, 0, box2));
    o.boxMeshes = [0, 1, 2, 3].map(i => { const g = new THREE.Group(); g.position.set((i % 2 ? 0.04 : -0.03), 0.8 + i * 0.27, 0); box(0.5, 0.26, 0.38, 0xc0392b, 0, 0, 0, g); box(0.52, 0.06, 0.4, 0xf6e7c8, 0, 0, 0, g); box2.add(g); return g; });
    const bl = canvasTex(256, 96); o.boxLbl = bl;
    o.boxLblMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.3), new THREE.MeshBasicMaterial({ map: bl.t, transparent: true })); box2.add(o.boxLblMesh);
    box2.visible = false;
    // 營業狀態立牌：準備中／今日已打烊
    const sg = new THREE.Group(); sg.position.set(1.7, 0, 0.6); bg.add(sg); o.sign = sg;
    box(0.06, 0.9, 0.06, 0x333333, 0, 0.45, 0, sg); box(0.5, 0.04, 0.4, 0x333333, 0, 0.02, 0, sg);
    const sc = canvasTex(256, 160); o.signTex = sc;
    const sp = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.56), new THREE.MeshBasicMaterial({ map: sc.t })); sp.position.set(0, 1.15, 0.04); sg.add(sp);
    box(0.94, 0.6, 0.04, 0x222222, 0, 1.15, 0, sg);
    sg.visible = false;
    OPS[k] = o;
  }
  function drawOps(k, d) {
    const o = OPS[k]; if (!o) return;
    d = d || {};
    OPS_STATE[k] = d.state || null;
    // 麵糊
    const rem = d.batter;
    if (rem && BATTER.some(([f]) => rem[f] != null)) {
      o.bat.visible = true;
      BATTER.forEach(([f], i) => { const v = rem[f], h = v == null ? 0 : Math.max(0.02, Math.min(1, v / BATTER_FULL)) * 0.5; o.fills[i].scale.y = Math.max(0.001, h); o.fills[i].position.y = 0.09 + h / 2; });
      const g = o.strip.c.getContext("2d"), W = 512, H = 64; g.clearRect(0, 0, W, H);
      g.fillStyle = d.batterLow ? "rgba(251,226,222,.95)" : "rgba(255,250,242,.92)"; g.fillRect(0, 6, W, H - 12);
      g.font = "bold 30px sans-serif"; g.textBaseline = "middle"; g.textAlign = "center";
      const lowOf = (v, i) => (d.batterLowK ? !!d.batterLowK[i] : v != null && v <= BATTER_LOW);
      BATTER.forEach(([f], i) => { const v = rem[f]; g.fillStyle = v == null ? "#999" : lowOf(v, i) ? "#c0392b" : "#2b1d14"; g.fillText(f + " " + (v == null ? "—" : v), W / 4 + i * W / 2, H / 2); });
      o.strip.t.needsUpdate = true;
    } else o.bat.visible = false;
    // 待取貨
    const n = d.pickup || 0;
    o.boxes.visible = n > 0;
    if (n > 0) {
      o.boxMeshes.forEach((b, i) => (b.visible = i < Math.min(4, n)));
      const g = o.boxLbl.c.getContext("2d"); g.clearRect(0, 0, 256, 96);
      g.fillStyle = "#c0392b"; g.beginPath(); g.roundRect ? g.roundRect(4, 8, 248, 80, 18) : g.rect(4, 8, 248, 80); g.fill();
      g.fillStyle = "#fff"; g.font = "bold 40px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("待取貨 " + n, 128, 50);
      o.boxLbl.t.needsUpdate = true;
      o.boxLblMesh.position.set(0, 0.8 + Math.min(4, n) * 0.27 + 0.12, 0);
    }
    // 營業狀態
    const s = d.state;
    o.sign.visible = s === "before" || s === "closed";
    if (o.sign.visible) {
      const g = o.signTex.c.getContext("2d");
      g.fillStyle = s === "closed" ? "#2b2b3a" : "#fff6e0"; g.fillRect(0, 0, 256, 160);
      g.fillStyle = s === "closed" ? "#ffd27a" : "#c0392b"; g.font = "bold 52px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(s === "closed" ? "今日已打烊" : "準備中", 128, 66);
      g.font = "24px sans-serif"; g.fillStyle = s === "closed" ? "#c9c3e0" : "#8a6a4a"; g.fillText(s === "closed" ? "明天見 🌙" : "等隊員開店 ☕", 128, 122);
      o.signTex.t.needsUpdate = true;
    }
  }
  function makeGuests(k, spots) {
    const cols = [[0xf5b7b1, 0x2e4053, 0x5d4037], [0x85c1e9, 0x34495e, 0x1c1c1c], [0xa9dfbf, 0x5d6d7e, 0x8d6e63], [0xf9e79f, 0x4a235a, 0x3e2723]];
    GUESTS[k] = spots.map((p, i) => {
      const c = cols[(SCENE_KEYS.indexOf(k) + i) % cols.length];
      const g = makeChar({ shirt: c[0], pants: c[1], hair: c[2], ponytail: i === 2 });
      g.g.position.set(SCENES[k].x + p[0], 0, p[1]); g.g.rotation.y = p[2]; g.bubble.classList.add("uo-guest"); g.scene = k;
      return g;
    });
  }
  function canvasPlane(w, h, cw, ch, draw, opt = {}) {
    const c = document.createElement("canvas"); c.width = cw; c.height = ch; draw(c.getContext("2d"), cw, ch);
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), side: opt.double ? THREE.DoubleSide : THREE.FrontSide, transparent: !!opt.transparent }));
  }
  // ── 遠百信義 A13 4F：依 2026-11-12 實景照片（木頭攤車＋布簾＋三台雙軸烤爐，大稻埕木樑、玻璃帷幕）──
  function xinyiScene(k) {
    const P = group(k);
    const WOOD = 0x3b2b22, WOOD2 = 0x5a4232, BLACK = 0x1e1e22;
    // 地板：淺灰石材大地磚
    box(16, 0.4, 12, 0xa8a59e, 0, -0.2, 0, P);
    for (let i = -7; i < 8; i += 2) for (let j = -5; j < 6; j += 2) box(1.96, 0.02, 1.96, ((i + j) / 2) % 2 ? 0xa3a099 : 0xafaca5, i, 0.01, j, P);
    // 後方：左半白牆＋圓窗，右半玻璃帷幕
    box(9.6, 4.6, 0.3, 0xefece6, -3.2, 2.3, -6.15, P);
    const moon = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.08, 8, 32), mat(0xc8a57a)); moon.position.set(-1.6, 2.3, -5.98); P.add(moon);
    put(P, new THREE.Mesh(new THREE.CircleGeometry(1.05, 32), new THREE.MeshBasicMaterial({ color: 0xfff3dd })), -1.6, 2.3, -5.99);
    put(P, glassBox(6.4, 4.6, 0.12, 0x2b3f5c, 0.55), 4.8, 2.3, -6.15);
    for (let x = 1.6; x <= 8; x += 1.6) box(0.12, 4.6, 0.16, 0x9aa3ad, x, 2.3, -6.1, P);
    box(16, 0.14, 0.2, 0x9aa3ad, 0, 4.6, -6.1, P);
    // 窗外夜景大樓（黃色窗燈）＋ 101
    [[3, -9, 6, 0x3a4250], [6.5, -10, 8, 0x313846], [9, -8.5, 5, 0x3d4655]].forEach(b => {
      box(2.2, b[2], 2, b[3], b[0], b[2] / 2, b[1], P);
      for (let y = 0.8; y < b[2] - 0.4; y += 0.8) for (let xx = -0.6; xx <= 0.6; xx += 0.6) if ((y * 10 + xx * 7 + b[0]) % 3 > 1) box(0.25, 0.3, 0.04, 0xf5c86b, b[0] + xx, y, b[1] + 1.02, P);
    });
    const T = 0x5e9c94; box(1.6, 1.2, 1.6, T, 1, 0.6, -12, P);
    for (let i = 0; i < 8; i++) { box(1.1, 0.12, 1.1, 0x3d7068, 1, 1.3 + i * 0.85, -12, P); box(0.9, 0.7, 0.9, T, 1, 1.75 + i * 0.85, -12, P); }
    box(0.5, 1, 0.5, T, 1, 8.6, -12, P); box(0.12, 1.4, 0.12, 0xcccccc, 1, 9.8, -12, P);
    // 大稻埕木造樑柱（只做後半，避免擋住攤車）
    [[-7.6, -5.6], [-7.6, -1.4], [-3.6, -5.6], [0.6, -5.6]].forEach(p => box(0.35, 4.8, 0.35, WOOD, p[0], 2.4, p[1], P));
    box(8.6, 0.3, 0.3, WOOD, -3.5, 4.6, -5.6, P); box(0.3, 0.3, 4.6, WOOD, -7.6, 4.6, -3.5, P);
    const roof = box(8.8, 0.14, 2.4, WOOD2, -3.5, 5.0, -4.9, P); roof.rotation.x = -0.25;
    for (let x = -7.2; x <= 0.2; x += 1.2) { box(0.18, 0.18, 0.18, BLACK, x, 4.35, -5.45, P); box(0.12, 0.12, 0.12, 0xfff1c1, x, 4.22, -5.38, P); }
    // 左側：中藥櫃式木抽屜櫃台
    box(3.2, 1.15, 1.0, 0x8b5a2b, -5.6, 0.575, -1.6, P); box(3.3, 0.08, 1.1, 0xa86c3c, -5.6, 1.19, -1.6, P);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      box(0.7, 0.22, 0.03, 0x9b6a3c, -6.8 + c * 0.8, 0.22 + r * 0.26, -1.08, P);
      box(0.08, 0.05, 0.04, 0xc9a24a, -6.8 + c * 0.8, 0.22 + r * 0.26, -1.06, P);
    }
    box(1.2, 0.4, 0.5, 0xa86c3c, -5.6, 1.43, -1.85, P);
    // 右側：綠色皮沙發座位區＋小木桌
    function armchair(x, z, ry) {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; P.add(g);
      box(0.9, 0.4, 0.85, 0x3f4f3a, 0, 0.45, 0, g); box(0.9, 0.75, 0.18, 0x3f4f3a, 0, 0.85, -0.36, g);
      box(0.14, 0.55, 0.85, 0x4a5b44, -0.45, 0.6, 0, g); box(0.14, 0.55, 0.85, 0x4a5b44, 0.45, 0.6, 0, g);
      [[-0.35, -0.3], [0.35, -0.3], [-0.35, 0.3], [0.35, 0.3]].forEach(q => box(0.06, 0.25, 0.06, 0x6b4423, q[0], 0.12, q[1], g));
    }
    [[3.4, -3.8, 0.3], [5.0, -3.8, -0.3], [3.4, -5.1, Math.PI - 0.2], [5.0, -5.1, Math.PI + 0.2], [6.8, -4.4, -Math.PI / 2]].forEach(a => armchair(a[0], a[1], a[2]));
    box(1.0, 0.06, 0.7, 0x8b5a2b, 4.2, 0.62, -4.45, P); box(0.08, 0.6, 0.08, 0x6b4423, 4.2, 0.3, -4.45, P);
    // 橄欖樹
    [[2.3, -5.3], [-7.2, 0.6], [7.4, -2.6]].forEach(t => {
      box(0.6, 0.6, 0.6, 0xd9d4cc, t[0], 0.3, t[1], P); box(0.1, 1.6, 0.1, 0x6b4f3a, t[0], 1.4, t[1], P);
      box(1.0, 0.8, 1.0, 0x6f8f5a, t[0], 2.4, t[1], P); box(0.7, 0.6, 0.7, 0x7fa168, t[0] + 0.2, 2.9, t[1] - 0.1, P);
    });

    // ── 紅玉滿攤車（正面朝客人 +z）──
    const CX = -1.0, CZ = -1.2;
    box(3.6, 1.0, 1.4, WOOD, CX, 0.62, CZ, P);
    for (let x = -1.7; x <= 1.7; x += 0.3) box(0.03, 0.95, 0.02, 0x2a1f19, CX + x, 0.62, CZ + 0.71, P);
    box(3.65, 0.06, 1.45, BLACK, CX, 1.15, CZ, P);
    [[-1.6, -0.6], [1.6, -0.6], [-1.6, 0.6], [1.6, 0.6]].forEach(q => box(0.14, 0.14, 0.14, 0x111111, CX + q[0], 0.07, CZ + q[1], P));
    // 正面紅布條
    {
      const c = document.createElement("canvas"); c.width = 512; c.height = 300; const g = c.getContext("2d");
      g.fillStyle = "#c8262c"; g.fillRect(0, 0, 512, 300);
      g.fillStyle = "#fff4e6"; g.textAlign = "center"; g.textBaseline = "middle";
      g.font = 'bold 58px "PingFang TC","Noto Sans TC",serif'; g.fillText("紅玉滿 赤心雞蛋糕", 256, 62);
      g.font = '22px sans-serif'; g.fillText("Hong Yu Man Egg Pancakes", 256, 108);
      g.fillStyle = "#e8a04a"; [[200, 170], [256, 158], [312, 170]].forEach(p => { g.beginPath(); g.arc(p[0] - 10, p[1], 13, 0, Math.PI * 2); g.arc(p[0] + 10, p[1], 13, 0, Math.PI * 2); g.fill(); g.beginPath(); g.moveTo(p[0] - 23, p[1] + 4); g.lineTo(p[0] + 23, p[1] + 4); g.lineTo(p[0], p[1] + 30); g.fill(); });
      g.fillStyle = "#fff4e6"; g.font = '26px "PingFang TC","Noto Sans TC",sans-serif'; g.fillText("♡ 願食雞蛋糕 常保赤子心 ♡", 256, 232);
      g.font = '18px sans-serif'; g.fillText("「台灣十大人氣造型雞蛋糕」", 256, 272);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) }));
      m.position.set(CX - 0.4, 0.62, CZ + 0.73); P.add(m);
    }
    // 黑鐵柱＋木屋頂（半透明，才看得到裡面的隊員）
    [[-1.75, -0.65], [1.75, -0.65], [-1.75, 0.65], [1.75, 0.65]].forEach(q => box(0.07, 1.9, 0.07, BLACK, CX + q[0], 2.12, CZ + q[1], P));
    box(3.6, 0.08, 0.08, BLACK, CX, 3.05, CZ + 0.65, P);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.14, 2.2), new THREE.MeshLambertMaterial({ color: WOOD, transparent: true, opacity: 0.45 }));
    canopy.position.set(CX, 3.2, CZ); canopy.rotation.x = -0.1; P.add(canopy);
    // 五片米色布簾
    ["紅", "玉", "滿", "赤心", "雞蛋糕"].forEach((t, i) => {
      const c = document.createElement("canvas"); c.width = 128; c.height = 128; const g = c.getContext("2d");
      g.fillStyle = "#e9dfc8"; g.fillRect(0, 0, 128, 128); g.fillStyle = "#1f1a16"; g.textAlign = "center"; g.textBaseline = "middle";
      g.font = 'bold ' + (t.length === 1 ? 84 : t.length === 2 ? 44 : 32) + 'px "PingFang TC","Noto Sans TC",serif'; g.fillText(t, 64, 64);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.62), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), side: THREE.DoubleSide }));
      m.position.set(CX - 1.4 + i * 0.7, 2.68, CZ + 0.68); P.add(m);
    });
    // 檯面：散熱風扇、三台雙軸烤爐、收銀平板、瓶罐
    box(0.7, 0.45, 0.3, 0xdfe2e5, CX - 1.35, 1.42, CZ - 0.1, P);
    [-0.15, 0.15].forEach(dx => { const f = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), mat(0x333333)); f.position.set(CX - 1.35 + dx, 1.42, CZ + 0.06); P.add(f); });
    const ovens = miniOvens(P, [CX - 0.6, CX, CX + 0.6], 1.18, CZ);
    box(0.32, 0.22, 0.04, 0x222222, CX + 1.25, 1.35, CZ - 0.1, P);
    const scr = put(P, new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.18), new THREE.MeshBasicMaterial({ color: 0x2a2f45 })), CX + 1.25, 1.35, CZ - 0.125, Math.PI);
    const posFx = { kind: "pos", mesh: scr, on: false }; FX.push(posFx);
    [[1.55, 0xffffff], [1.62, 0xc0392b], [1.48, 0x2ecc71]].forEach((b, i) => box(0.1, 0.3, 0.1, b[1], CX + b[0], 1.33, CZ + 0.3 - i * 0.15, P));
    // 高溫警示立牌
    {
      box(0.06, 1.6, 0.06, BLACK, CX + 2.3, 0.8, CZ + 1.1, P); box(0.5, 0.04, 0.4, BLACK, CX + 2.3, 0.02, CZ + 1.1, P);
      const c = document.createElement("canvas"); c.width = 128; c.height = 320; const g = c.getContext("2d");
      g.fillStyle = "#fff"; g.fillRect(0, 0, 128, 320); g.fillStyle = "#c0392b"; g.fillRect(0, 210, 128, 110);
      g.fillStyle = "#c0392b"; g.textAlign = "center"; g.font = "bold 40px sans-serif"; g.fillText("⚠", 64, 50);
      g.fillStyle = "#222"; g.font = 'bold 22px "PingFang TC",sans-serif'; ["機器高溫", "運作中", "請勿靠近"].forEach((t, i) => g.fillText(t, 64, 100 + i * 32));
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.25), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), side: THREE.DoubleSide }));
      m.position.set(CX + 2.3, 1.95, CZ + 1.12); m.rotation.y = Math.PI / 8; P.add(m);
    }
    put(P, textPlane("遠百信義 A13・4F", 5, 0.9, { color: "rgba(90,70,50,.35)", size: 56 }), -4.2, 0.03, 4.3, 0, -Math.PI / 2);
    // 缺貨看板（立牌）
    stockBoard(P, k, 6.6, -0.6);
    // 隊員站位：攤車後方，面向客人
    SLOTS[k] = [
      { x: CX, z: CZ - 1.15, rotY: 0, anim: "cook", fx: ovens[1] },
      { x: CX + 1.2, z: CZ - 1.15, rotY: 0, anim: "serve", fx: posFx },
      { x: CX - 0.6, z: CZ - 1.15, rotY: 0, anim: "cook", fx: ovens[0] },
      { x: CX + 0.6, z: CZ - 1.15, rotY: 0, anim: "cook", fx: ovens[2] },
      { x: CX - 1.6, z: CZ - 1.6, rotY: Math.PI / 6, anim: "stand" },
      { x: CX + 2.2, z: CZ - 1.6, rotY: -Math.PI / 6, anim: "stand" },
    ];
    GUESTS[k] = [[CX + 1.3, 0.55, Math.PI], [CX + 1.6, 1.65, Math.PI], [3.6, 3.4, -Math.PI * 0.75]].map((p, i) => {
      const cols = [[0xf5b7b1, 0x2e4053, 0x5d4037], [0x85c1e9, 0x34495e, 0x1c1c1c], [0xa9dfbf, 0x5d6d7e, 0x8d6e63]];
      const g = makeChar({ shirt: cols[i][0], pants: cols[i][1], hair: cols[i][2], ponytail: i === 2 });
      g.g.position.set(SCENES[k].x + p[0], 0, p[1]); g.g.rotation.y = p[2]; g.bubble.classList.add("uo-guest"); g.scene = k;
      return g;
    });
  }
  xinyiScene("xinyi");
  // ── 02 兩廳院・音樂廳 2 號門：依 2026-11-12 實景照片（淺木紋櫃屋、三格窗、仙人走獸紅布簾、屋脊神獸燈箱）──
  function hallScene(k) {
    const P = group(k);
    const OAK = 0xc8a57c, OAK2 = 0xd8bb92, BRICK = 0x5a3a2e;
    // 地板：灰色小方磚（貼圖）
    const fl = canvasPlane(16, 12, 512, 384, (g, w, h) => {
      g.fillStyle = "#8e8c88"; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? -12 : 0; x < w; x += 24) { g.fillStyle = ["#a3a19c", "#9b9994", "#aaa8a3"][((x + y) / 8) % 3 | 0]; g.fillRect(x + 1, y + 1, 22, 14); }
    });
    fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0.011, 0); P.add(fl);
    box(16, 0.4, 12, 0x8e8c88, 0, -0.2, 0, P);
    // 騎樓後牆：深咖啡磚牆＋上方白牆
    const bw = canvasPlane(16.4, 2.4, 512, 80, (g, w, h) => {
      g.fillStyle = "#3e2a22"; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 8) for (let x = (y / 8) % 2 ? -10 : 0; x < w; x += 20) { g.fillStyle = (x * 7 + y) % 3 ? "#5a3a2e" : "#4d3228"; g.fillRect(x + 1, y + 1, 18, 6); }
    });
    box(16.4, 4.6, 0.4, 0xf0eee9, 0, 2.3, -6.2, P); bw.position.set(0, 1.2, -5.99); P.add(bw);
    box(0.4, 4.6, 12.4, 0xf0eee9, -8.2, 2.3, 0, P);
    // 右牆上：屋脊神獸燈箱（紅色翹脊＋黃琉璃瓦＋兩隻金色神獸）
    {
      const g = new THREE.Group(); g.position.set(4.2, 3.0, -5.85); P.add(g);
      box(2.6, 0.35, 0.3, 0xd62e2e, 0, 0, 0, g); const tip = box(0.7, 0.3, 0.3, 0xd62e2e, 1.45, 0.25, 0, g); tip.rotation.z = 0.6;
      for (let x = -1.1; x <= 1.1; x += 0.36) box(0.3, 0.22, 0.32, 0xf2c230, x, 0.27, 0.02, g);
      box(2.6, 0.12, 0.32, 0x2f9e5a, 0, -0.24, 0.01, g);
      [-0.4, 0.3].forEach(x => { box(0.3, 0.45, 0.25, 0xe8b23a, x, 0.65, 0.05, g); box(0.25, 0.25, 0.3, 0xe8b23a, x + 0.08, 0.95, 0.08, g); });
      const lt = new THREE.PointLight(0xffd27a, 0.5, 5); lt.position.set(0, 0.5, 0.8); g.add(lt);
    }
    // 左側：不鏽鋼回收桶兩個
    [-7.2, -6.4].forEach((x, i) => { box(0.75, 1.2, 0.7, 0xc5cacf, x, 0.6, -5.4, P); box(0.3, 0.3, 0.02, i ? 0x2e8b57 : 0x2e6fb5, x, 0.8, -5.04, P); box(0.2, 0.12, 0.02, 0x222222, x, 1.05, -5.04, P); });

    // ── 紅玉滿櫃屋（正面朝 +z）──
    const X0 = -3.75, X1 = 1.75, ZF = -1.2, ZB = -3.4, CX = (X0 + X1) / 2;
    // 正面下牆＋木頭靠台
    box(X1 - X0, 1.45, 0.12, OAK, CX, 0.725, ZF, P);
    for (let y = 0.15; y < 1.45; y += 0.18) box(X1 - X0, 0.01, 0.13, 0xb8956c, CX, y, ZF, P);
    box(X1 - X0 + 0.2, 0.07, 0.35, OAK2, CX, 1.5, ZF + 0.17, P);
    for (let x = X0 + 0.4; x < X1; x += 0.9) box(0.05, 0.25, 0.25, OAK2, x, 1.35, ZF + 0.12, P);
    // 開放式窗口（第二張照片：窗框捲簾已拆）：上橫樑＋軌道投射燈
    box(X1 - X0, 0.12, 0.14, OAK2, CX, 2.82, ZF, P);
    for (let x = X0 + 0.9; x < X1; x += 1.3) { box(0.1, 0.12, 0.16, 0x222222, x, 2.7, ZF - 0.12, P); box(0.06, 0.06, 0.06, 0xfff1c1, x, 2.62, ZF - 0.12, P); }
    // 櫃內原木屋架（只做後半）
    [X0 + 0.6, CX, X1 - 0.6].forEach(x => { box(0.12, 0.12, ZF - ZB, OAK2, x, 3.3, (ZF + ZB) / 2 - 0.3, P); });
    box(X1 - X0, 0.12, 0.12, OAK2, CX, 2.9, ZB + 0.3, P);
    // 仙人走獸紅布簾
    {
      const m = canvasPlane(X1 - X0 - 0.5, 0.5, 512, 64, (g, w, h) => {
        g.fillStyle = "#a8222b"; g.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x += 46) { g.fillStyle = "#7d1820"; g.fillRect(x, 0, 2, 12); }
        g.fillStyle = "#c98a4b"; for (let i = 0; i < 5; i++) { const x = 30 + i * 52; g.beginPath(); g.ellipse(x, 38, 12, 16, 0, 0, Math.PI * 2); g.fill(); g.fillRect(x - 4, 18, 8, 10); }
        g.fillStyle = "#fff4e6"; g.font = 'bold 30px "PingFang TC","Noto Sans TC",serif'; g.textAlign = "right"; g.textBaseline = "middle"; g.fillText("仙人走獸雞蛋糕", w - 10, 36);
      });
      m.position.set(CX + 0.1, 3.08, ZF + 0.02); P.add(m);
    }
    for (let x = X0 + 0.5; x < X1; x += 0.16) box(0.05, 0.3, 0.05, OAK2, x, 3.48, ZF - 0.02, P);
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, X1 - X0, 10), mat(0xd9b98c)); log.rotation.z = Math.PI / 2; log.position.set(CX, 3.7, ZF); P.add(log);
    // 側牆（只做到檯面高度，鏡頭才看得到裡面）＋後側門口
    box(0.12, 1.45, ZF - ZB, OAK, X0, 0.725, (ZF + ZB) / 2, P);
    box(0.12, 1.45, 0.9, OAK, X1, 0.725, ZF - 0.45, P);
    box(0.12, 3.75, 0.12, OAK2, X1, 1.87, ZF, P);
    // 櫃內：磚牆、工作檯、電扇、三台烤爐、價目牌、收銀
    const ib = canvasPlane(X1 - X0, 2.7, 512, 160, (g, w, h) => {
      g.fillStyle = "#6b4535"; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 10) for (let x = (y / 10) % 2 ? -14 : 0; x < w; x += 28) { g.fillStyle = (x + y) % 3 ? "#7e5240" : "#6a4334"; g.fillRect(x + 1, y + 1, 26, 8); }
    });
    box(X1 - X0, 2.7, 0.15, 0x6b4535, CX, 1.35, ZB, P); ib.position.set(CX, 1.35, ZB + 0.08); P.add(ib);
    box(X1 - X0 - 0.3, 1.0, 0.55, 0xd0b48c, CX, 0.5, ZF - 0.4, P); box(X1 - X0 - 0.3, 0.05, 0.6, 0xe8d8bc, CX, 1.02, ZF - 0.4, P);
    { const g = new THREE.Group(); g.position.set(X0 + 0.55, 1.05, ZF - 0.45); P.add(g); box(0.06, 0.6, 0.06, 0x555555, 0, 0.3, 0, g); const f = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 16), mat(0xd9c49a)); f.rotation.x = Math.PI / 2; f.position.set(0, 0.7, 0.05); g.add(f); }
    const ovens = miniOvens(P, [-2.45, -1.65, -0.85], 1.05, ZF - 0.45);
    for (let i = 0; i < 2; i++) box(0.5, 0.05, 0.3, 0xd2552e, -0.2 + i * 0.45, 1.08, ZF - 0.25, P);
    box(0.32, 0.45, 0.32, 0xf2a7a0, -3.1, 1.28, ZF - 0.45, P); box(0.34, 0.06, 0.34, 0xf7c9c4, -3.1, 1.53, ZF - 0.45, P);
    put(P, canvasPlane(0.7, 0.5, 140, 100, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.strokeStyle = "#1f4fa8"; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6); g.fillStyle = "#c0392b"; g.font = "bold 13px sans-serif"; g.textAlign = "center"; g.fillText("兩廳院造型雞蛋糕", w / 2, 22); g.fillStyle = "#444"; for (let i = 0; i < 3; i++) g.fillRect(14, 36 + i * 18, w - 28, 8); }), -1.25, 1.33, ZF - 0.14);
    box(0.32, 0.22, 0.04, 0x222222, 0.6, 1.2, ZF - 0.5, P);
    const scr = put(P, new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.18), new THREE.MeshBasicMaterial({ color: 0x2a2f45 })), 0.6, 1.2, ZF - 0.525, Math.PI);
    const posFx = { kind: "pos", mesh: scr, on: false }; FX.push(posFx);
    put(P, canvasPlane(0.6, 0.75, 120, 150, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.fillStyle = "#c0392b"; g.fillRect(0, 0, w, 30); g.fillStyle = "#fff"; g.font = "bold 13px sans-serif"; g.textAlign = "center"; g.fillText("兩廳院 X 紅玉滿", w / 2, 13); g.fillText("雞蛋糕 Menu", w / 2, 27); g.fillStyle = "#555"; for (let i = 0; i < 6; i++) g.fillRect(12, 44 + i * 16, w - 24, 6); }), 1.3, 1.42, ZF - 0.16);
    // 左側立柱：兩廳院＋紅玉滿 logo、電視、海報
    {
      const PX = X0 - 0.55;
      box(1.1, 3.8, 0.7, OAK, PX, 1.9, ZF - 0.25, P);
      put(P, canvasPlane(1.0, 0.75, 200, 150, (g, w, h) => {
        g.fillStyle = "#c8a57c"; g.fillRect(0, 0, w, h);
        g.fillStyle = "#3a2a22"; g.font = 'bold 22px "PingFang TC",serif'; g.fillText("國家", 14, 50); g.fillText("兩廳院", 14, 80);
        g.fillStyle = "#a8222b"; g.fillRect(14, 96, 20, 30); g.fillRect(40, 104, 14, 22);
        g.fillStyle = "#a8222b"; g.beginPath(); g.arc(148, 72, 44, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#fff"; g.font = 'bold 22px "PingFang TC",serif'; g.textAlign = "center"; g.fillText("紅玉滿", 148, 70); g.font = "11px sans-serif"; g.fillText("赤心雞蛋糕", 148, 90);
      }), PX, 3.2, ZF + 0.11);
      box(0.85, 0.5, 0.06, 0x111111, PX, 2.5, ZF + 0.13, P);
      put(P, canvasPlane(0.78, 0.43, 156, 86, (g, w, h) => { g.fillStyle = "#3a8fe0"; g.fillRect(0, 0, w, h); g.fillStyle = "#e8b06a"; g.beginPath(); g.ellipse(110, 46, 22, 30, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = "#e9f2fb"; g.fillRect(14, 50, 70, 22); }), PX, 2.5, ZF + 0.17);
      put(P, canvasPlane(0.85, 1.1, 120, 156, (g, w, h) => { g.fillStyle = "#6a3b22"; g.fillRect(0, 0, w, h); g.fillStyle = "#e9c99b"; g.fillRect(10, 70, 100, 70); g.fillStyle = "#c98a4b"; for (let i = 0; i < 4; i++) g.fillRect(18 + i * 22, 90 - i * 4, 12, 40 + i * 4); g.fillStyle = "#f3e1c2"; g.font = "10px sans-serif"; g.fillText("音樂廳鎮館之寶雞蛋糕", 8, 30); }), PX, 1.4, ZF + 0.11);
    }
    put(P, textPlane("國家音樂廳・2 號門", 5, 0.9, { color: "rgba(60,50,40,.35)", size: 56 }), -4.2, 0.03, 4.3, 0, -Math.PI / 2);
    stockBoard(P, k, 6.6, -0.6);
    // 隊員站位：櫃屋內，面向窗口
    SLOTS[k] = [
      { x: -1.65, z: -2.3, rotY: 0, anim: "cook", fx: ovens[1] },
      { x: 0.6, z: -2.3, rotY: 0, anim: "serve", fx: posFx },
      { x: -2.45, z: -2.3, rotY: 0, anim: "cook", fx: ovens[0] },
      { x: -0.85, z: -2.3, rotY: 0, anim: "cook", fx: ovens[2] },
      { x: -3.1, z: -3.0, rotY: Math.PI / 6, anim: "stand" },
      { x: 1.2, z: -3.0, rotY: -Math.PI / 6, anim: "stand" },
    ];
    makeGuests(k, [[0.4, 0.2, Math.PI], [0.7, 1.3, Math.PI], [3.6, 3.4, -Math.PI * 0.75]]);
  }
  hallScene("hall");
  // ── 21 南港 LaLaport 5F：依 2026-11-12 實景照片 IMG_8127（原木攤車、木條人字屋頂、藏青布簾、腳踏車輪、橘色 FRP 小暴龍、藏青旗幟）──
  function nangangScene(k) {
    const P = group(k);
    const PINE = 0xc99a5c, PINE2 = 0xb4874d, NAVY = "#1f2f5c";
    // 地板：米色六角磚（貼圖）
    const fl = canvasPlane(16, 12, 512, 384, (g, w, h) => {
      g.fillStyle = "#cdbfa9"; g.fillRect(0, 0, w, h); g.strokeStyle = "#f2ece2"; g.lineWidth = 2;
      const r = 18, dx = r * Math.sqrt(3);
      for (let row = 0, y = 0; y < h + r; row++, y += r * 1.5) for (let x = (row % 2) * dx / 2; x < w + dx; x += dx) {
        g.fillStyle = ["#d6c9b4", "#cfc1aa", "#dacdb9"][(row + Math.round(x / dx)) % 3]; g.beginPath();
        for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; g.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); }
        g.closePath(); g.fill(); g.stroke();
      }
    });
    fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0.011, 0); P.add(fl);
    box(16, 0.4, 12, 0xcdbfa9, 0, -0.2, 0, P);
    // 後方：白磚柱、美食街桌椅、吊掛綠植、玻璃球燈
    box(1.6, 5, 1.6, 0xefe9dc, -0.5, 2.5, -5.4, P);
    for (let y = 0.3; y < 5; y += 0.35) box(1.62, 0.02, 1.62, 0xdcd4c4, -0.5, y, -5.4, P);
    box(9, 0.6, 1.2, 0x9e3326, -4.5, 4.8, -4.5, P);
    function table(x, z) { box(1.1, 0.06, 1.1, 0xc9a77c, x, 0.78, z, P); box(0.08, 0.76, 0.08, 0xa88458, x, 0.38, z, P);
      [[-0.75, 0], [0.75, 0]].forEach(c => { box(0.5, 0.06, 0.5, 0xb89468, x + c[0], 0.48, z, P); box(0.5, 0.5, 0.06, 0xb89468, x + c[0], 0.75, z + (c[0] < 0 ? -0.25 : 0.25), P); }); }
    [[-6.5, -4.5], [-4.2, -4.8], [-6.8, -2.4], [-4.4, -2.6]].forEach(t => table(t[0], t[1]));
    [[-3.2, -3.6], [2.0, -3.0], [4.2, -4.6], [-6.0, 1.0]].forEach(l => {
      box(0.02, 1.2, 0.02, 0x666666, l[0], 4.4, l[1], P);
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0.9 })); m.position.set(l[0], 3.7, l[1]); P.add(m);
    });
    [[-2.0, -4.6], [3.0, -5.2], [6.0, -4.2]].forEach(h => { box(0.02, 0.8, 0.02, 0x666666, h[0], 4.6, h[1], P); box(0.5, 0.35, 0.5, 0x8a6a4c, h[0], 4.05, h[1], P); box(0.8, 0.5, 0.8, 0x4f8a45, h[0], 3.75, h[1], P); });
    box(6.5, 0.12, 0.1, 0xeeeeee, 4.5, 1.1, -6.1, P); box(6.5, 1.0, 0.04, 0xcfe6f0, 4.5, 0.6, -6.1, P);

    // ── 紅玉滿原木攤車（正面朝 +z）──
    const CX = 0.4, CZ = -1.2, W = 3.2;
    box(W, 1.1, 1.3, PINE, CX, 0.72, CZ, P);
    for (let x = -W / 2 + 0.2; x < W / 2; x += 0.32) box(0.02, 1.05, 0.02, PINE2, CX + x, 0.72, CZ + 0.66, P);
    box(W + 0.15, 0.08, 1.45, PINE2, CX, 1.3, CZ, P);
    [[-1.4, -0.55], [1.4, -0.55], [-1.4, 0.55], [1.4, 0.55]].forEach(q => box(0.12, 0.12, 0.12, 0x333333, CX + q[0], 0.08, CZ + q[1], P));
    // 腳踏車輪
    {
      const g = new THREE.Group(); g.position.set(CX + 0.3, 0.68, CZ + 0.72); P.add(g);
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 6, 28), mat(0x1c1c1c)); g.add(tire);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.025, 6, 28), mat(0xeeeeee)); g.add(rim);
      for (let a = 0; a < 12; a++) { const sp = box(0.012, 1.1, 0.012, 0xcccccc, 0, 0, 0, g); sp.rotation.z = a * Math.PI / 12; }
      box(0.1, 0.1, 0.06, 0x888888, 0, 0, 0.02, g);
    }
    // 柱子＋木條人字屋頂（條狀有縫，看得到裡面）
    [[-1.5, -0.6], [1.5, -0.6], [-1.5, 0.6], [1.5, 0.6]].forEach(q => box(0.1, 1.75, 0.1, PINE2, CX + q[0], 2.2, CZ + q[1], P));
    [-1, 1].forEach(side => {
      const r = new THREE.Group(); r.position.set(CX, 3.35, CZ); r.rotation.x = side * 0.42; P.add(r);
      const sm = new THREE.MeshLambertMaterial({ color: PINE, transparent: true, opacity: 0.55 });
      for (let x = -W / 2 - 0.25; x <= W / 2 + 0.25; x += 0.26) { const sl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 1.0), sm); sl.position.set(x, 0, side * 0.45); r.add(sl); }
    });
    box(W + 0.5, 0.12, 0.12, PINE2, CX, 3.08, CZ + 0.62, P); box(W + 0.5, 0.12, 0.12, PINE2, CX, 3.08, CZ - 0.62, P);
    // 藏青布簾
    put(P, canvasPlane(2.6, 0.75, 400, 115, (g, w, h) => {
      g.fillStyle = NAVY; g.fillRect(0, 0, w, h); g.fillStyle = "#16234a"; for (let i = 1; i < 3; i++) g.fillRect(i * w / 3, 0, 3, h);
      g.fillStyle = "#f3ead8"; g.textBaseline = "middle"; g.font = 'bold 44px "PingFang TC","Noto Sans TC",serif'; g.fillText("紅玉滿赤心 雞蛋糕", 18, 48);
      g.font = '16px sans-serif'; g.fillText("홍차계란빵  紅玉心形燒", 150, 95);
    }), CX - 0.2, 2.72, CZ + 0.64);
    // 正面白招牌、Menu、乾洗手、小盆栽
    put(P, canvasPlane(1.4, 0.42, 280, 84, (g, w, h) => { g.fillStyle = "#fbfaf6"; g.fillRect(0, 0, w, h); g.fillStyle = "#b8202a"; g.font = 'bold 30px "PingFang TC",serif'; g.fillText("紅玉滿", 8, 40); g.fillStyle = "#222"; g.font = 'bold 22px "PingFang TC",serif'; g.fillText("赤心雞蛋糕", 112, 40); g.font = "13px sans-serif"; g.fillText("Hong Yu Man Egg Pancakes  紅玉心形燒", 8, 70); }), CX - 0.8, 1.55, CZ + 0.62);
    put(P, canvasPlane(0.5, 0.42, 100, 84, (g, w, h) => { g.fillStyle = "#c62828"; g.fillRect(0, 0, w, h); g.fillStyle = "#fff"; g.fillRect(4, 18, w - 8, h - 22); g.fillStyle = "#fff"; g.font = "bold 13px sans-serif"; g.fillText("Menu", 6, 14); g.fillStyle = "#555"; for (let i = 0; i < 4; i++) g.fillRect(10, 26 + i * 13, 80, 5); g.fillStyle = "#06c755"; g.fillRect(60, 68, 30, 10); }), CX + 0.2, 1.55, CZ + 0.63);
    put(P, canvasPlane(0.32, 0.42, 64, 84, (g, w, h) => { g.fillStyle = "#f2e3c9"; g.fillRect(0, 0, w, h); g.fillStyle = "#b5651d"; g.beginPath(); g.arc(32, 40, 18, 0, Math.PI * 2); g.fill(); }), CX + 0.6, 1.55, CZ + 0.63);
    box(0.1, 0.3, 0.1, 0xf6f6f6, CX - 1.4, 1.48, CZ + 0.55, P);
    [CX + 0.95, CX + 1.35].forEach(x => { box(0.14, 0.12, 0.14, 0xf4f4f4, x, 1.4, CZ + 0.5, P); box(0.18, 0.12, 0.18, 0x5a9e5a, x, 1.52, CZ + 0.5, P); });
    // 攤車內：白色冷凍櫃、三台烤爐、收銀螢幕
    box(1.1, 0.75, 0.6, 0xf2f2f2, CX - 0.7, 1.7, CZ - 0.3, P);
    const ovens = miniOvens(P, [CX - 0.2, CX + 0.35, CX + 0.9], 1.34, CZ - 0.25);
    box(0.08, 0.4, 0.08, 0x222222, CX + 0.9, 1.9, CZ - 0.5, P); box(0.6, 0.4, 0.05, 0x1a1a1a, CX + 0.9, 2.25, CZ - 0.5, P);
    const scr = put(P, new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.32), new THREE.MeshBasicMaterial({ color: 0x2a2f45 })), CX + 0.9, 2.25, CZ - 0.53, Math.PI);
    const posFx = { kind: "pos", mesh: scr, on: false }; FX.push(posFx);
    // 左側：粉紅放射圖案木櫃＋橘色 FRP 小暴龍（紅色圓底座）
    {
      const SX = CX - 2.6;
      box(1.7, 1.25, 0.9, PINE2, SX, 0.625, CZ + 0.1, P); box(1.85, 0.06, 1.0, PINE, SX, 1.28, CZ + 0.1, P);
      put(P, canvasPlane(1.55, 1.1, 300, 214, (g, w, h) => {
        g.fillStyle = "#fbeee9"; g.fillRect(0, 0, w, h); g.strokeStyle = "#f2b8a8"; g.lineWidth = 3;
        for (let a = 0; a < 24; a++) { g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + Math.cos(a * Math.PI / 12) * w, h / 2 + Math.sin(a * Math.PI / 12) * w); g.stroke(); }
        g.fillStyle = "#fff"; g.beginPath(); g.arc(w / 2, h / 2 + 6, 82, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#1f1a16"; g.textAlign = "center"; g.font = 'bold 34px "PingFang TC",serif'; g.fillText("紅玉滿", w / 2, 90); g.font = 'bold 22px "PingFang TC",serif'; g.fillText("赤心雞蛋糕", w / 2, 122);
        g.font = "bold 12px sans-serif"; g.fillText("Hong Yu Man Egg Pancakes", w / 2, 146); g.font = "11px sans-serif"; g.fillText("홍차계란빵 紅玉心形燒", w / 2, 164);
      }), SX, 0.62, CZ + 0.56);
      trex(P, SX, CZ + 0.1, { y: 1.31, round: true, scale: 0.6, rotY: Math.PI / 5, color: 0xf08a24, belly: 0xf59a3a, dark: 0xd9731a });
      box(0.6, 0.2, 0.35, 0x8b5a2b, SX + 0.55, 1.42, CZ + 0.3, P);
    }
    // 右側：藏青直立旗（竹竿）＋紅龍柱
    {
      const FX0 = CX + 2.2;
      box(0.08, 3.6, 0.08, 0xd8c08a, FX0 + 0.55, 1.8, CZ + 0.3, P); box(0.9, 0.05, 0.05, 0xd8c08a, FX0 + 0.1, 3.4, CZ + 0.3, P);
      put(P, canvasPlane(0.85, 2.6, 120, 368, (g, w, h) => {
        g.fillStyle = NAVY; g.fillRect(0, 0, w, h); g.fillStyle = "#f3ead8"; g.textAlign = "center";
        g.font = 'bold 48px "PingFang TC",serif'; ["紅", "玉", "滿"].forEach((t, i) => g.fillText(t, 50, 70 + i * 62));
        g.font = 'bold 22px "PingFang TC",serif'; ["赤", "心", "雞", "蛋", "糕"].forEach((t, i) => g.fillText(t, 50, 240 + i * 25));
        g.font = "12px sans-serif"; g.fillText("有心，八顆無敵。", 60, 22);
      }, { double: true }), FX0 + 0.1, 2.05, CZ + 0.32);
      [[FX0 + 1.3, 0.4], [FX0 + 1.3, 1.6]].forEach(q => { box(0.12, 1.0, 0.12, 0x222222, q[0], 0.5, q[1], P); box(0.35, 0.04, 0.35, 0x222222, q[0], 0.02, q[1], P); });
      box(0.04, 0.06, 1.2, 0x333333, FX0 + 1.3, 0.9, 1.0, P);
    }
    put(P, textPlane("南港 LaLaport・5F", 5, 0.9, { color: "rgba(90,70,50,.35)", size: 56 }), -4.2, 0.03, 4.3, 0, -Math.PI / 2);
    stockBoard(P, k, 6.6, -0.4);
    SLOTS[k] = [
      { x: CX + 0.35, z: CZ - 1.1, rotY: 0, anim: "cook", fx: ovens[1] },
      { x: CX + 1.1, z: CZ - 1.1, rotY: 0, anim: "serve", fx: posFx },
      { x: CX - 0.2, z: CZ - 1.1, rotY: 0, anim: "cook", fx: ovens[0] },
      { x: CX - 0.9, z: CZ - 1.1, rotY: 0, anim: "stand" },
      { x: CX - 2.4, z: CZ - 1.4, rotY: Math.PI / 6, anim: "stand" },
      { x: CX + 2.0, z: CZ - 1.6, rotY: -Math.PI / 6, anim: "stand" },
    ];
    makeGuests(k, [[CX + 1.7, 0.8, Math.PI], [CX + 2.0, 1.9, Math.PI], [4.6, 3.0, -Math.PI * 0.75]]);
  }
  nangangScene("nangang");
  // ── 03 遠百竹北 6F：依 2026-11-12 實景照片 IMG_3296（大木輪攤車、灰木屋頂、米色布簾、美食街紅牆燈籠、日式格窗）──
  function zhubeiScene(k) {
    const P = group(k);
    const WOOD = 0x4a3b30, POST = 0x6b6158, ROOF = 0xa8a39b;
    // 地板：前方灰石地磚、右後方木地板
    box(16, 0.4, 12, 0xa9a7a2, 0, -0.2, 0, P);
    for (let i = -7; i < 8; i += 2) for (let j = -5; j < 6; j += 2) box(1.96, 0.02, 1.96, ((i + j) / 2) % 2 ? 0xb4b2ad : 0xaaa8a3, i, 0.01, j, P);
    box(5, 0.03, 4, 0x8a6a4c, 5.5, 0.03, -4, P);
    for (let x = 3.2; x < 8; x += 0.5) box(0.02, 0.035, 4, 0x6e533b, x, 0.035, -4, P);
    // 後方：美食街紅牆、木框、紙燈籠
    box(9.5, 4.6, 0.4, 0x9e2b25, -3.25, 2.3, -6.2, P);
    [-7.6, -4.5, -1.4].forEach(x => box(0.15, 4.6, 0.12, 0xd8c3a0, x, 2.3, -5.98, P));
    box(9.5, 0.12, 0.12, 0xd8c3a0, -3.25, 3.2, -5.98, P);
    put(P, canvasPlane(1.2, 0.9, 120, 90, (g, w, h) => { g.fillStyle = "#2b2b2b"; g.fillRect(0, 0, w, h); g.fillStyle = "#e8b06a"; g.beginPath(); g.ellipse(60, 50, 40, 25, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = "#c0392b"; g.fillRect(30, 40, 60, 10); }), -3.0, 2.2, -5.97);
    [[-6.0, -5.0], [-4.8, -4.6], [-2.4, -5.0], [-0.6, -4.7]].forEach(l => {
      box(0.03, 1.2, 0.03, 0x333333, l[0], 4.0, l[1], P);
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffe9b8 })); m.scale.set(1, 0.85, 1); m.position.set(l[0], 3.2, l[1]); P.add(m);
    });
    // 右後方：日式格子窗＋灰磚牆
    box(6.5, 1.1, 0.4, 0x8d8d88, 4.75, 0.55, -6.2, P);
    box(6.5, 3.5, 0.4, 0x3b2b22, 4.75, 2.85, -6.2, P);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) box(0.7, 0.68, 0.04, 0xe9e6df, 2.6 + c * 1.45 + (c > 1 ? 0.3 : 0), 1.55 + r * 0.78, -5.98, P);
    // 左邊鄰櫃（其他品牌甜點攤車，不放品牌名）
    {
      box(2.6, 1.0, 1.2, WOOD, -6.0, 0.6, -1.4, P); box(2.65, 0.05, 1.25, 0x222222, -6.0, 1.12, -1.4, P);
      [[-7.0, -0.75], [-5.0, -0.75]].forEach(w => { const t = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 6, 16), mat(0x2b211b)); t.position.set(w[0], 0.55, w[1]); P.add(t); });
      [-7.2, -4.8].forEach(x => box(0.1, 2.3, 0.1, 0x3b2b22, x, 2.25, -1.4, P));
      box(2.8, 0.1, 1.6, 0x3b2b22, -6.0, 3.4, -1.4, P);
      for (let i = 0; i < 4; i++) box(0.5, 0.55, 0.02, 0xf1e8d6, -6.75 + i * 0.5, 2.9, -0.62, P);
      for (let i = 0; i < 5; i++) box(0.35, 0.22, 0.3, [0xe67e22, 0xf1c40f][i % 2], -6.9 + i * 0.42, 1.25, -1.5, P);
    }
    // 吊掛指示牌
    box(0.03, 1.0, 0.03, 0x333333, -6.5, 4.7, 1.2, P);
    put(P, canvasPlane(2.0, 0.5, 200, 50, (g, w, h) => { g.fillStyle = "#e6e8ea"; g.fillRect(0, 0, w, h); g.fillStyle = "#334"; g.font = "bold 26px sans-serif"; g.fillText("← 🚻", 14, 35); }, { double: true }), -6.5, 4.0, 1.2);

    // ── 紅玉滿大木輪攤車（正面朝 +z）──
    const CX = -0.6, CZ = -1.2, W = 4.4;
    box(W, 0.95, 1.4, WOOD, CX, 0.7, CZ, P);
    for (let x = -W / 2 + 0.25; x < W / 2; x += 0.35) box(0.02, 0.9, 0.02, 0x3b2f27, CX + x, 0.7, CZ + 0.71, P);
    box(W + 0.1, 0.06, 1.5, 0x2a2622, CX, 1.2, CZ, P);
    [CX - W / 2 + 0.6, CX + W / 2 - 0.6].forEach(wx => {
      const g = new THREE.Group(); g.position.set(wx, 0.68, CZ + 0.78); P.add(g);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.07, 6, 20), mat(0x2b211b)); g.add(rim);
      for (let a = 0; a < 6; a++) { const sp = box(0.05, 1.22, 0.04, 0x3a2c22, 0, 0, 0, g); sp.rotation.z = a * Math.PI / 6; }
      box(0.18, 0.18, 0.1, 0x2b211b, 0, 0, 0.02, g);
    });
    // 灰木屋頂＋柱子＋斜撐＋軌道燈（屋頂半透明）
    [[-W / 2 + 0.15, -0.6], [W / 2 - 0.15, -0.6], [-W / 2 + 0.15, 0.6], [W / 2 - 0.15, 0.6]].forEach(q => box(0.12, 2.3, 0.12, POST, CX + q[0], 2.35, CZ + q[1], P));
    [-1, 1].forEach(sx => { const b = box(0.08, 1.0, 0.08, POST, CX + sx * (W / 2 - 0.5), 3.1, CZ + 0.6, P); b.rotation.z = sx * 0.6; });
    const roofM = new THREE.Mesh(new THREE.BoxGeometry(W + 0.9, 0.14, 2.3), new THREE.MeshLambertMaterial({ color: ROOF, transparent: true, opacity: 0.45 }));
    roofM.position.set(CX, 3.55, CZ + 0.15); roofM.rotation.x = 0.08; P.add(roofM);
    box(W - 0.4, 0.04, 0.04, 0x111111, CX, 3.35, CZ + 0.45, P);
    for (let i = 0; i < 4; i++) { box(0.14, 0.18, 0.2, 0x111111, CX - 1.4 + i * 0.95, 3.2, CZ + 0.45, P); box(0.08, 0.08, 0.06, 0xfff1c1, CX - 1.4 + i * 0.95, 3.1, CZ + 0.56, P); }
    // 米色布簾：紅玉滿｜赤心雞蛋糕（英韓日）
    put(P, canvasPlane(3.8, 0.85, 512, 115, (g, w, h) => {
      g.fillStyle = "#efe7d4"; g.fillRect(0, 0, w, h);
      g.fillStyle = "#cfc5ae"; for (let i = 1; i < 5; i++) g.fillRect(i * w / 5, 0, 2, h);
      g.fillStyle = "#1f1a16"; g.textBaseline = "middle"; g.textAlign = "center";
      g.font = 'bold 60px "PingFang TC","Noto Sans TC",serif'; ["紅", "玉", "滿"].forEach((t, i) => g.fillText(t, w / 10 + i * w / 5, 48));
      g.font = 'bold 26px "PingFang TC","Noto Sans TC",serif'; g.fillText("赤心雞蛋糕", w * 0.8, 38);
      g.font = "bold 15px sans-serif"; g.fillText("Hong Yu Man   Egg Pancakes", w * 0.32, 98); g.fillText("홍차계란   玉心形焼", w * 0.8, 74);
    }), CX + 0.1, 2.75, CZ + 0.62);
    // 檯面：木箱、三台烤爐、Menu 牌、收銀螢幕、多肉、乾洗手
    box(0.7, 0.45, 0.5, 0x6b5a4a, CX - 1.75, 1.45, CZ - 0.05, P);
    const ovens = miniOvens(P, [CX - 1.05, CX - 0.45, CX + 0.15], 1.23, CZ - 0.05);
    put(P, canvasPlane(0.75, 0.5, 150, 100, (g, w, h) => { g.fillStyle = "#d62b2b"; g.fillRect(0, 0, w, h); g.fillStyle = "#1f5fbf"; g.beginPath(); g.moveTo(0, h); g.lineTo(w, h * 0.45); g.lineTo(w, h); g.fill(); g.fillStyle = "#fff"; g.font = "bold 16px sans-serif"; g.fillText("Menu", 8, 18); g.font = "11px sans-serif"; g.fillText("初心原味  5入 8入", 8, 38); g.fillText("綜合口味  5入 8入", 8, 56); g.fillText("今日口味", 8, 80); }), CX + 0.75, 1.5, CZ + 0.4);
    box(0.08, 0.35, 0.08, 0x222222, CX + 1.45, 1.4, CZ - 0.2, P); box(0.6, 0.4, 0.05, 0x1a1a1a, CX + 1.45, 1.75, CZ - 0.2, P);
    const scr = put(P, new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.32), new THREE.MeshBasicMaterial({ color: 0x2a2f45 })), CX + 1.45, 1.75, CZ - 0.23, Math.PI);
    const posFx = { kind: "pos", mesh: scr, on: false }; FX.push(posFx);
    [CX + 1.0, CX + 1.25].forEach(x => { box(0.14, 0.14, 0.14, 0xf4f4f4, x, 1.3, CZ + 0.45, P); box(0.12, 0.12, 0.12, 0x5a9e5a, x, 1.43, CZ + 0.45, P); });
    box(0.12, 0.3, 0.1, 0xf6f6f6, CX + 1.95, 1.38, CZ + 0.45, P); box(0.03, 0.1, 0.03, 0x333333, CX + 1.95, 1.58, CZ + 0.45, P);
    [1.7, 2.3].forEach(y => box(0.6, 0.04, 0.35, POST, CX + W / 2 + 0.15, y, CZ + 0.4, P));
    put(P, textPlane("遠百竹北・6F", 5, 0.9, { color: "rgba(60,50,40,.35)", size: 56 }), -4.2, 0.03, 4.3, 0, -Math.PI / 2);
    stockBoard(P, k, 6.6, -0.4);
    SLOTS[k] = [
      { x: CX - 0.45, z: CZ - 1.15, rotY: 0, anim: "cook", fx: ovens[1] },
      { x: CX + 1.45, z: CZ - 1.15, rotY: 0, anim: "serve", fx: posFx },
      { x: CX - 1.05, z: CZ - 1.15, rotY: 0, anim: "cook", fx: ovens[0] },
      { x: CX + 0.3, z: CZ - 1.15, rotY: 0, anim: "cook", fx: ovens[2] },
      { x: CX - 1.9, z: CZ - 1.6, rotY: Math.PI / 6, anim: "stand" },
      { x: CX + 2.3, z: CZ - 1.6, rotY: -Math.PI / 6, anim: "stand" },
    ];
    makeGuests(k, [[CX + 1.5, 0.6, Math.PI], [CX + 1.8, 1.7, Math.PI], [3.6, 3.4, -Math.PI * 0.75]]);
  }
  zhubeiScene("zhubei");
  storeScene("other", { floor: [0xf2e6d8, 0xe8d8c4], wall: 0xfdf0e2, trim: 0xc0392b, counter: 0x6e4b2a, title: "其他櫃位・活動", deco: P => {
    box(0.1, 3, 0.1, 0x888888, 6.5, 1.5, -2.5, P); box(0.1, 3, 0.1, 0x888888, 6.5, 1.5, 0.5, P);
    const tent = box(3.4, 0.2, 3.4, 0xc0392b, 6.5, 3.1, -1, P); tent.rotation.z = 0.12;
    [0, 1, 2].forEach(i => box(0.5, 0.7, 0.05, [0xe74c3c, 0xf1c40f, 0x3498db][i], 4.2 + i * 0.5, 3.6, 3.0, P));
  } });

  // ── 場景:隊員商店街(攤位依 setGame({shops}) 動態產生)──
  let streetStalls = null;
  {
    const P = group("street");
    box(16, 0.4, 12, 0xc9b79c, 0, -0.2, 0, P);
    for (let i = -7; i < 8; i += 2) box(1.9, 0.02, 11.6, i % 4 ? 0xbfa98a : 0xd2c2a6, i, 0.01, 0, P);
    box(16.4, 4, 0.4, 0xe8dcc8, 0, 2, -6.2, P);
    put(P, textPlane("紅玉滿・隊員商店街", 6, 1.0, { bg: "#c0392b", color: "#fff3e0", size: 64 }), 0, 3.2, -5.98);
    [-7, 7].forEach(x => { box(0.2, 3.4, 0.2, 0x6e4b2a, x, 1.7, 5.5, P); });
    for (let x = -6.5; x <= 6.5; x += 1.3) box(0.5, 0.5, 0.5, [0xe74c3c, 0xf1c40f, 0x3498db, 0x2ecc71][Math.round(x * 10) % 4 < 0 ? 0 : Math.round(x * 10) % 4], x, 3.3, 5.5, P);
    plant(P, -7.3, -5.3); plant(P, 7.3, -5.3);
    SLOTS.street = [{ x: 0, z: 3.5, rotY: Math.PI, anim: "stand" }];
    streetStalls = new THREE.Group(); P.add(streetStalls);
  }

  // 共用：花崗岩拼色地板、六角磚地板
  function floorCanvas(P, draw, base) {
    const fl = canvasPlane(16, 12, 512, 384, draw); fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0.011, 0); P.add(fl);
    box(16, 0.4, 12, base, 0, -0.2, 0, P);
  }
  function hexFloor(cols) {
    return (g, w, h) => {
      g.fillStyle = cols[0]; g.fillRect(0, 0, w, h); g.strokeStyle = "#f4f1ea"; g.lineWidth = 2;
      const r = 18, dx = r * Math.sqrt(3);
      for (let row = 0, y = 0; y < h + r; row++, y += r * 1.5) for (let x = (row % 2) * dx / 2; x < w + dx; x += dx) {
        g.fillStyle = cols[(row * 7 + Math.round(x / dx) * 3) % cols.length]; g.beginPath();
        for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; g.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); }
        g.closePath(); g.fill(); g.stroke();
      }
    };
  }

  // ── 22 美麗華 B1：依 2026-11-12 實景照片 IMG_9429～9431（原木攤車＋L 型木板櫃台四台烤爐、紅色 FRP 大機器人、彩色磚柱）──
  function miramarScene(k) {
    const P = group(k);
    const PINE = 0xd2a868, PINE2 = 0xbb8f52, NAVY = "#1f2f5c";
    floorCanvas(P, (g, w, h) => {
      g.fillStyle = "#b9b2a6"; g.fillRect(0, 0, w, h);
      const cs = ["#8f8a83", "#c9bfae", "#5e5b58", "#d8cdb9", "#a49d92"];
      for (let y = 0; y < h; y += 48) for (let x = -((y / 48) % 2) * 60; x < w; x += 120) { g.fillStyle = cs[((x + y) / 24 | 0) % cs.length]; g.fillRect(x, y, 118, 46); for (let i = 0; i < 40; i++) { g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(x + Math.random() * 118, y + Math.random() * 46, 2, 2); } }
    }, 0xb9b2a6);
    // 後方：白牆、不鏽鋼電梯門、彩色磚柱
    box(16.4, 4.6, 0.4, 0xf2efe8, 0, 2.3, -6.2, P);
    box(2.2, 3.2, 0.1, 0xb8bdc2, -5.6, 1.6, -5.96, P); box(0.04, 3.2, 0.12, 0x8a9096, -5.6, 1.6, -5.94, P);
    put(P, canvasPlane(0.5, 0.2, 100, 40, (g, w, h) => { g.fillStyle = "#1aa37a"; g.fillRect(0, 0, w, h); g.fillStyle = "#fff"; g.font = "bold 22px sans-serif"; g.fillText("🏃 EXIT", 8, 28); }), -5.6, 3.5, -5.94);
    {
      const T = canvasPlane(1.6, 4.6, 120, 345, (g, w, h) => {
        const cs = ["#c0392b", "#e8d36a", "#3d7a4f"];
        for (let y = 0; y < h; y += 15) for (let x = ((y / 15) % 2) * -15; x < w; x += 30) { g.fillStyle = cs[(x / 30 + y / 15 * 2 + 9) % 3 | 0]; g.fillRect(x + 1, y + 1, 28, 13); }
      });
      box(1.6, 4.6, 1.6, 0xe8d36a, -2.6, 2.3, -5.1, P);
      const a = T.clone(); a.position.set(-2.6, 2.3, -4.29); P.add(a);
      const b = T.clone(); b.position.set(-1.79, 2.3, -5.1); b.rotation.y = Math.PI / 2; P.add(b);
    }
    // 左邊鄰櫃：薄荷綠木櫃（不放品牌）
    box(1.6, 1.2, 1.2, 0xbfe0d6, -7.0, 0.6, -1.4, P); box(1.65, 0.06, 1.25, 0xc9a77c, -7.0, 1.22, -1.4, P);

    // ── L 型木板櫃台（四台烤爐）──
    const LX0 = -5.2, LX1 = -1.5, LZ = -0.7;
    box(LX1 - LX0, 1.25, 0.15, PINE, (LX0 + LX1) / 2, 0.62, LZ, P);
    for (let y = 0.12; y < 1.25; y += 0.21) box(LX1 - LX0, 0.015, 0.16, PINE2, (LX0 + LX1) / 2, y, LZ, P);
    box(0.15, 1.25, 2.4, PINE, LX0, 0.62, LZ - 1.2, P);
    box(LX1 - LX0, 0.95, 0.7, 0x9a8f80, (LX0 + LX1) / 2, 0.47, LZ - 0.6, P); box(LX1 - LX0, 0.05, 0.75, 0x7d756b, (LX0 + LX1) / 2, 0.97, LZ - 0.6, P);
    // 正面大圖：愛心雞蛋糕照片＋藏青品牌板＋機器人雞蛋糕
    put(P, canvasPlane(1.6, 1.15, 240, 172, (g, w, h) => {
      g.fillStyle = "#d9b98d"; g.fillRect(0, 0, w, h); g.strokeStyle = "#8a7a62"; g.lineWidth = 1; for (let i = 0; i < w; i += 10) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i - 40, h); g.stroke(); }
      [[60, 50, "#7a3b1c"], [120, 40, "#8e4522"], [180, 60, "#6a3216"], [80, 110, "#b5612c"], [150, 115, "#a05428"], [100, 150, "#c06a33"]].forEach(c => { g.fillStyle = c[2]; g.beginPath(); g.arc(c[0] - 12, c[1], 16, 0, Math.PI * 2); g.arc(c[0] + 12, c[1], 16, 0, Math.PI * 2); g.fill(); g.beginPath(); g.moveTo(c[0] - 28, c[1] + 4); g.lineTo(c[0] + 28, c[1] + 4); g.lineTo(c[0], c[1] + 32); g.fill(); });
    }), -4.35, 0.68, LZ + 0.08);
    put(P, canvasPlane(1.9, 1.15, 286, 172, (g, w, h) => {
      g.fillStyle = "#1f2f5c"; g.fillRect(0, 0, w, h); g.fillStyle = "#f3ead8"; g.textAlign = "center";
      g.font = 'bold 30px "PingFang TC",serif'; g.fillText("紅玉滿 赤心雞蛋糕", w / 2, 72);
      g.font = "11px sans-serif"; g.fillText("Hong Yu Man Egg Pancakes 홍차계란빵 紅玉心形燒", w / 2, 92);
      g.font = '15px "PingFang TC",serif'; g.fillText("吃心", 34, 60); g.fillText("補心", w - 34, 60); g.fillText("願食雞蛋糕 常保赤子心", w / 2 + 40, 135);
      g.fillStyle = "#c06a33"; [[60, 125], [80, 115], [100, 125]].forEach(c => { g.beginPath(); g.arc(c[0], c[1], 9, 0, Math.PI * 2); g.fill(); });
      g.fillStyle = "#f3ead8"; g.font = "10px sans-serif"; g.fillText("「台灣十大人氣造型雞蛋糕」", w / 2, 162);
    }), -2.55, 0.68, LZ + 0.08);
    { // 上緣機器人雞蛋糕剪影
      const r = canvasPlane(0.7, 0.55, 112, 88, (g) => { g.fillStyle = "#1f2f5c"; g.fillRect(0, 0, 112, 88); g.fillStyle = "#d9773a"; [18, 62].forEach(x => { g.fillRect(x + 6, 10, 22, 18); g.fillRect(x, 30, 34, 30); g.fillRect(x + 4, 62, 10, 20); g.fillRect(x + 20, 62, 10, 20); }); });
      r.position.set(-2.0, 1.52, LZ + 0.08); P.add(r);
    }
    const lOvens = miniOvens(P, [-4.4, -3.7, -3.0, -2.3], 1.0, LZ - 0.6);
    lOvens[1].link = [lOvens[0], lOvens[2], lOvens[3]];
    box(1.1, 0.8, 0.8, 0xf2f2f2, -4.4, 0.4, LZ - 2.0, P);

    // ── 原木攤車 ──
    const CX = 0.2, CZ = -1.1, W = 3.0;
    box(W, 1.1, 1.3, PINE, CX, 0.72, CZ, P);
    for (let x = -W / 2 + 0.2; x < W / 2; x += 0.32) box(0.02, 1.05, 0.02, PINE2, CX + x, 0.72, CZ + 0.66, P);
    box(W + 0.15, 0.08, 1.45, PINE2, CX, 1.3, CZ, P);
    put(P, glassBox(W - 0.3, 0.35, 0.5, 0xcfefff, 0.35), CX, 1.52, CZ + 0.35);
    {
      const g = new THREE.Group(); g.position.set(CX, 0.68, CZ + 0.72); P.add(g);
      g.add(new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 6, 28), mat(0x1c1c1c)));
      g.add(new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.025, 6, 28), mat(0xeeeeee)));
      for (let a = 0; a < 12; a++) { const sp = box(0.012, 1.1, 0.012, 0xcccccc, 0, 0, 0, g); sp.rotation.z = a * Math.PI / 12; }
    }
    [[-1.4, -0.6], [1.4, -0.6], [-1.4, 0.6], [1.4, 0.6]].forEach(q => box(0.1, 1.75, 0.1, PINE2, CX + q[0], 2.2, CZ + q[1], P));
    [-1, 1].forEach(side => {
      const r = new THREE.Group(); r.position.set(CX, 3.35, CZ); r.rotation.x = side * 0.42; P.add(r);
      const sm = new THREE.MeshLambertMaterial({ color: PINE, transparent: true, opacity: 0.55 });
      for (let x = -W / 2 - 0.25; x <= W / 2 + 0.25; x += 0.26) { const sl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 1.0), sm); sl.position.set(x, 0, side * 0.45); r.add(sl); }
    });
    put(P, canvasPlane(2.4, 0.7, 380, 110, (g, w, h) => {
      g.fillStyle = NAVY; g.fillRect(0, 0, w, h); g.fillStyle = "#16234a"; for (let i = 1; i < 3; i++) g.fillRect(i * w / 3, 0, 3, h);
      g.fillStyle = "#f3ead8"; g.font = 'bold 42px "PingFang TC","Noto Sans TC",serif'; g.fillText("紅玉滿赤心 雞蛋糕", 14, 50); g.font = "15px sans-serif"; g.fillText("홍차계란빵  紅玉心形燒", 140, 92);
    }), CX + 0.1, 2.72, CZ + 0.64);
    // 藍色圓燈箱「三角龍［阿萌］」
    put(P, canvasPlane(0.7, 0.7, 128, 128, (g) => { g.fillStyle = "#2f80d1"; g.beginPath(); g.arc(64, 64, 62, 0, Math.PI * 2); g.fill(); g.fillStyle = "#f2a48a"; g.beginPath(); g.ellipse(64, 66, 34, 20, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = "#fff"; g.font = "bold 14px sans-serif"; g.textAlign = "center"; g.fillText("紅玉滿", 64, 28); g.fillText("三角龍[阿萌]", 64, 108); }, { transparent: true }), CX - 1.62, 2.75, CZ + 0.62);
    put(P, canvasPlane(0.55, 0.42, 110, 84, (g, w, h) => { g.fillStyle = "#c62828"; g.fillRect(0, 0, w, h); g.fillStyle = "#fff"; g.fillRect(4, 18, w - 8, h - 22); g.font = "bold 13px sans-serif"; g.fillText("Menu", 6, 14); g.fillStyle = "#555"; for (let i = 0; i < 4; i++) g.fillRect(10, 26 + i * 13, 90, 5); g.fillStyle = "#1f5fbf"; g.fillRect(4, 70, w - 8, 10); }), CX + 0.3, 1.55, CZ + 0.62);
    box(0.2, 0.15, 0.2, 0xb8bec4, CX + 1.1, 1.42, CZ + 0.45, P); box(0.26, 0.2, 0.26, 0x5a9e5a, CX + 1.1, 1.6, CZ + 0.45, P);
    box(0.08, 0.4, 0.08, 0x222222, CX + 0.8, 1.55, CZ - 0.35, P); box(0.55, 0.38, 0.05, 0x1a1a1a, CX + 0.8, 1.9, CZ - 0.35, P);
    const scr = put(P, new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.3), new THREE.MeshBasicMaterial({ color: 0x2a2f45 })), CX + 0.8, 1.9, CZ - 0.38, Math.PI);
    const posFx = { kind: "pos", mesh: scr, on: false }; FX.push(posFx);
    // 後方木板牆＋紅色看板
    box(0.15, 1.6, 1.8, PINE, 2.4, 0.8, -3.9, P);
    for (let y = 0.15; y < 1.6; y += 0.22) box(0.16, 0.015, 1.8, PINE2, 2.4, y, -3.9, P);
    put(P, canvasPlane(1.3, 1.05, 200, 162, (g, w, h) => { g.fillStyle = "#c62828"; g.fillRect(0, 0, w, h); g.fillStyle = "#fff"; g.font = "bold 14px sans-serif"; g.fillText("台灣最有型雞蛋糕品牌", 12, 22); g.font = 'bold 22px "PingFang TC",serif'; g.fillText("紅玉滿 赤心雞蛋糕", 18, 70); g.fillStyle = "#8e3b1c"; [80, 100, 120].forEach((x, i) => { g.beginPath(); g.arc(x, 100 + (i % 2) * 8, 10, 0, Math.PI * 2); g.fill(); }); g.fillStyle = "#fff"; g.font = "11px sans-serif"; g.fillText("♡ 願食雞蛋糕 常保赤子心 ♡", 30, 145); }), 2.49, 0.95, -3.9, Math.PI / 2);
    // 紅色 FRP 大機器人（揮手）
    {
      const g = new THREE.Group(); g.position.set(2.7, 0, -1.2); g.rotation.y = -Math.PI / 10; P.add(g);
      const pm = {}; const ph = c => pm[c] || (pm[c] = new THREE.MeshPhongMaterial({ color: c, shininess: 100, specular: 0x777777 }));
      const pb = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), ph(c)); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
      const RED = 0xd8222a, NAV = 0x1f3a8a, SIL = 0xb9bcc0;
      [-0.38, 0.38].forEach(x => { pb(0.55, 0.3, 0.8, NAV, x, 0.15, 0.08); pb(0.45, 1.0, 0.5, RED, x, 0.8, 0); });
      pb(1.7, 1.75, 0.9, RED, 0, 2.15, 0);
      const chest = canvasPlane(1.55, 1.6, 200, 206, (c) => {
        c.fillStyle = "#d8222a"; c.fillRect(0, 0, 200, 206);
        [10, 104].forEach(x => { c.fillStyle = "#f4e6c8"; c.fillRect(x + 20, 10, 50, 10); c.fillStyle = "#f2c76a"; c.beginPath(); c.arc(x + 35, 50, 12, 0, Math.PI * 2); c.arc(x + 55, 50, 12, 0, Math.PI * 2); c.fill(); c.beginPath(); c.moveTo(x + 22, 54); c.lineTo(x + 68, 54); c.lineTo(x + 45, 76); c.fill(); c.fillStyle = "#e9e3d6"; c.fillRect(x + 10, 90, 70, 34); c.fillStyle = "#d8222a"; c.beginPath(); c.ellipse(x + 45, 107, 16, 9, 0, 0, Math.PI * 2); c.fill(); });
        c.fillStyle = "#efeae0"; c.fillRect(8, 140, 184, 60);
        for (let i = 0; i < 8; i++) { c.fillStyle = ["#888", "#c0392b", "#e0a030"][i % 3]; c.beginPath(); c.arc(22 + i * 22, 158, 7, 0, Math.PI * 2); c.fill(); }
        [[30, "#e0a030"], [70, "#a0241f"], [130, "#a0241f"], [170, "#e0a030"]].forEach(p => { c.fillStyle = p[1]; c.beginPath(); c.arc(p[0], 184, 12, 0, Math.PI * 2); c.fill(); });
      });
      chest.position.set(0, 2.15, 0.46); g.add(chest);
      pb(1.2, 1.0, 0.9, RED, 0, 3.55, 0); pb(1.0, 0.6, 0.1, SIL, 0, 3.55, 0.46);
      [-0.24, 0.24].forEach(x => { const e = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 16), ph(0xd8dadc)); e.rotation.x = Math.PI / 2; e.position.set(x, 3.6, 0.52); g.add(e); const s2 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.12, 8), ph(0x8a8d90)); s2.rotation.x = Math.PI / 2; s2.position.set(x, 3.6, 0.55); g.add(s2); });
      [-0.7, 0.7].forEach(x => { pb(0.2, 0.45, 0.2, SIL, x, 3.55, 0); const ball = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), ph(SIL)); ball.position.set(x * 0.75, 4.2, 0); g.add(ball); pb(0.05, 0.3, 0.05, SIL, x * 0.75, 4.05, 0); });
      // 右臂舉起揮手、左臂平舉
      const armR = new THREE.Group(); armR.position.set(1.05, 2.8, 0); g.add(armR);
      const a1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.9, 0.45), ph(RED)); a1.position.set(0.2, 0.3, 0); a1.rotation.z = -0.6; armR.add(a1);
      const a2 = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.8, 0.42), ph(RED)); a2.position.set(0.45, 0.95, 0); armR.add(a2);
      g.userData.wave = armR;
      const armL = new THREE.Group(); armL.position.set(-1.05, 2.8, 0); g.add(armL);
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.9, 0.45), ph(RED)); b1.position.set(-0.15, -0.35, 0.15); b1.rotation.x = -0.5; armL.add(b1);
      ROBOTS.push(g);
    }
    put(P, textPlane("美麗華・B1", 5, 0.9, { color: "rgba(60,50,40,.35)", size: 56 }), -4.2, 0.03, 4.3, 0, -Math.PI / 2);
    stockBoard(P, k, 6.6, -0.4);
    SLOTS[k] = [
      { x: -3.35, z: LZ - 1.4, rotY: 0, anim: "cook", fx: lOvens[1] },
      { x: CX + 0.8, z: CZ - 1.1, rotY: 0, anim: "serve", fx: posFx },
      { x: -4.4, z: LZ - 1.4, rotY: 0, anim: "cook", fx: lOvens[0] },
      { x: CX - 0.5, z: CZ - 1.1, rotY: 0, anim: "serve" },
      { x: -2.3, z: LZ - 1.4, rotY: 0, anim: "cook", fx: lOvens[3] },
      { x: -1.2, z: -3.2, rotY: Math.PI / 6, anim: "stand" },
    ];
    makeGuests(k, [[CX + 0.9, 0.7, Math.PI], [CX + 1.2, 1.8, Math.PI], [-3.0, 1.2, Math.PI]]);
  }

  // ── 41 桃園機場 T2 4F（合作品牌：山海豆花）：依 2026-11-12 實景照片 IMG_4336（轉角雙面櫃、白布簾、紅色檯面板、聖誕花圈、兒童遊戲區）──
  function airportScene(k) {
    const P = group(k);
    const CREAM = 0xe9e1d2;
    floorCanvas(P, hexFloor(["#b7b2a6", "#c9c3b5", "#a8a397", "#d4cdbf"]), 0xb7b2a6);
    // 後牆：白色地鐵磚（櫃內那段）＋米白牆
    box(16.4, 4.6, 0.4, 0xf3efe7, 0, 2.3, -6.2, P);
    put(P, canvasPlane(5, 3, 300, 180, (g, w, h) => { g.fillStyle = "#fbfbf8"; g.fillRect(0, 0, w, h); g.strokeStyle = "#d8d8d2"; for (let y = 0; y < h; y += 14) for (let x = (y / 14) % 2 ? -14 : 0; x < w; x += 28) g.strokeRect(x, y, 28, 14); }), -1.7, 1.6, -5.99);
    // 天花六角燈框（只做左側一列）
    for (let i = 0; i < 4; i++) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.05, 4, 6), new THREE.MeshBasicMaterial({ color: 0xdfe8ff })); h.rotation.x = Math.PI / 2; h.position.set(-6.4 + (i % 2) * 1.1, 4.8, -4.8 + i * 1.6); P.add(h); }
    // 左側鄰櫃（速食店，不放品牌）
    box(1.8, 1.2, 3.5, 0xf2f2f2, -7.1, 0.6, -3.2, P); box(0.05, 0.7, 3.2, 0xb02a2a, -6.18, 0.7, -3.2, P);

    // ── 轉角雙面櫃：+z 面山海豆花、+x 面紅玉滿 ──
    const XL = -3.8, XR = 0.75, ZF = -0.5, ZB = -4.6;
    // 山海豆花面（+z）下牆＋食物照片板
    box(XR - XL - 0.85, 1.1, 0.85, CREAM, (XL + XR - 0.85) / 2, 0.55, ZF - 0.42, P);
    box(XR - XL - 0.85, 0.05, 0.9, 0x222222, (XL + XR - 0.85) / 2, 1.12, ZF - 0.42, P);
    put(P, canvasPlane(3.4, 1.0, 340, 100, (g, w, h) => { g.fillStyle = "#f4f2ee"; g.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) { const x = 30 + (i % 4) * 85, y = 28 + (i / 4 | 0) * 48; g.fillStyle = "#e8e2d6"; g.beginPath(); g.arc(x, y, 18, 0, Math.PI * 2); g.fill(); g.fillStyle = ["#c79a5a", "#8a3b2e", "#e8d9b0", "#6b4a2a"][i % 4]; g.beginPath(); g.arc(x, y, 11, 0, Math.PI * 2); g.fill(); } }), (XL + XR - 0.85) / 2, 0.55, ZF + 0.03);
    // 紅玉滿面（+x）下牆＋紅色檯面板
    box(0.85, 1.1, ZF - ZB, CREAM, XR - 0.42, 0.55, (ZF + ZB) / 2, P);
    box(0.9, 0.05, ZF - ZB, 0x222222, XR - 0.42, 1.12, (ZF + ZB) / 2, P);
    put(P, canvasPlane(3.8, 0.95, 380, 95, (g, w, h) => { g.fillStyle = "#c8262c"; g.fillRect(0, 0, w, h); g.fillStyle = "#fff"; g.font = "bold 16px sans-serif"; g.fillText("台灣最有型雞蛋糕品牌", 12, 22); g.font = "10px sans-serif"; g.fillText("The most stylish Taiwanese Traditional Egg Pancake brand", 12, 38); g.font = 'bold 24px "PingFang TC",serif'; g.fillText("紅玉滿 赤心雞蛋糕", 150, 72); }), XR + 0.03, 0.55, (ZF + ZB) / 2, Math.PI / 2);
    // 聖誕花圈
    const garland = (x0, z0, x1, z1) => { const n = 14; for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n; box(0.28, 0.16, 0.28, 0x2f6b34, x, 1.22, z, P); if (i % 2) box(0.08, 0.08, 0.08, i % 4 === 1 ? 0xd62b2b : 0xe8c547, x + 0.05, 1.32, z + 0.05, P); } };
    garland(XL + 0.2, ZF - 0.1, XR - 0.9, ZF - 0.1); garland(XR - 0.1, ZF - 0.2, XR - 0.1, ZB + 0.2);
    // 轉角柱、門楣與斜屋頂線條
    box(0.22, 4.2, 0.22, CREAM, XR, 2.1, ZF, P); box(0.22, 4.2, 0.22, CREAM, XL, 2.1, ZF, P); box(0.22, 4.2, 0.22, CREAM, XR, 2.1, ZB, P);
    box(XR - XL, 0.25, 0.2, CREAM, (XL + XR) / 2, 4.1, ZF, P); box(0.2, 0.25, ZF - ZB, CREAM, XR, 4.1, (ZF + ZB) / 2, P);
    // 白布簾：山海豆花（+z）、紅玉滿（+x）
    put(P, canvasPlane(XR - XL - 0.3, 1.25, 400, 110, (g, w, h) => {
      g.fillStyle = "#fbfaf6"; g.fillRect(0, 0, w, h); g.fillStyle = "#e3ded3"; for (let i = 1; i < 4; i++) g.fillRect(i * w / 4, 0, 2, h);
      g.fillStyle = "#1f1a16"; g.font = 'bold 52px "PingFang TC",serif'; g.fillText("山海", 18, 70); g.fillText("豆花", 270, 70);
      g.strokeStyle = "#c0392b"; g.lineWidth = 4; g.beginPath(); g.moveTo(140, 70); g.lineTo(170, 30); g.lineTo(190, 55); g.lineTo(210, 30); g.lineTo(240, 70); g.stroke();
      g.fillStyle = "#555"; g.font = "11px sans-serif"; g.fillText("MATA Tofu Pudding", 140, 92);
    }), (XL + XR) / 2, 3.35, ZF + 0.02);
    put(P, canvasPlane(ZF - ZB - 0.3, 1.25, 400, 110, (g, w, h) => {
      g.fillStyle = "#fbfaf6"; g.fillRect(0, 0, w, h); g.fillStyle = "#e3ded3"; for (let i = 1; i < 3; i++) g.fillRect(i * w / 3, 0, 2, h);
      g.fillStyle = "#1f1a16"; g.font = 'bold 50px "PingFang TC",serif'; g.fillText("紅玉滿", 12, 58); g.font = 'bold 28px "PingFang TC",serif'; g.fillText("赤心 雞蛋糕", 196, 56);
      g.font = "bold 12px sans-serif"; g.fillText("Hong Yu Man Egg Pancakes 홍차계란빵 紅玉心形燒", 14, 94);
    }), XR + 0.02, 3.35, (ZF + ZB) / 2, Math.PI / 2);
    // 櫃內：不鏽鋼機器、鍋具、三台烤爐（朝 +x）、收銀
    box(0.7, 0.6, 0.6, 0xc4c9ce, -0.9, 1.45, -3.9, P); box(0.4, 0.3, 0.4, 0x9aa0a6, -1.6, 1.3, -3.9, P);
    box(1.4, 1.1, 0.8, 0xdcdcdc, -2.6, 0.55, -3.9, P);
    const OG = new THREE.Group(); OG.position.set(XR - 0.45, 0, -2.6); OG.rotation.y = Math.PI / 2; P.add(OG);
    const ovens = miniOvens(OG, [-0.6, 0, 0.6], 1.15, 0);
    box(0.08, 0.3, 0.08, 0x222222, XR - 0.45, 1.3, -1.0, P); box(0.04, 0.25, 0.35, 0x1a1a1a, XR - 0.4, 1.55, -1.0, P);
    const scr = put(P, new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2), new THREE.MeshBasicMaterial({ color: 0x2a2f45 })), XR - 0.43, 1.55, -1.0, -Math.PI / 2);
    const posFx = { kind: "pos", mesh: scr, on: false }; FX.push(posFx);
    // 右側兒童遊戲區：拱窗矮牆、紅色六角座、木溜板、黃色玩具飛機、藍柱
    box(0.2, 1.8, 3.6, 0xf3efe7, 7.6, 0.9, -3.0, P);
    [-4.0, -2.4].forEach(z => box(0.05, 0.9, 0.6, 0xd9d2c4, 7.48, 0.75, z, P));
    { const hx = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.5, 6), mat(0xd9422e)); hx.position.set(6.2, 0.25, -2.6); P.add(hx); }
    { const pl = box(2.4, 0.08, 0.9, 0xd9a65c, 5.0, 0.6, -4.2, P); pl.rotation.z = 0.35; }
    { const ap = new THREE.Group(); ap.position.set(5.6, 4.0, -3.6); P.add(ap); box(1.4, 0.35, 0.35, 0xf2c230, 0, 0, 0, ap); box(0.3, 0.06, 1.8, 0xf2c230, 0.1, 0, 0, ap); box(0.15, 0.4, 0.06, 0xf2c230, -0.65, 0.2, 0, ap); box(0.02, 1.0, 0.02, 0x666666, 0, 0.6, 0, ap); }
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 4.8, 12), mat(0xa9c6e0)); pole.position.set(3.4, 2.4, -5.0); P.add(pole);
    put(P, textPlane("桃園機場 T2・4F", 5, 0.9, { color: "rgba(60,50,40,.35)", size: 56 }), -4.2, 0.03, 4.3, 0, -Math.PI / 2);
    stockBoard(P, k, 6.0, 1.6);
    // 隊員站位：櫃內面向 +x（紅玉滿那面）
    const RY = Math.PI / 2;
    SLOTS[k] = [
      { x: -0.55, z: -2.6, rotY: RY, anim: "cook", fx: ovens[1] },
      { x: -0.55, z: -1.1, rotY: RY, anim: "serve", fx: posFx },
      { x: -0.55, z: -2.0, rotY: RY, anim: "cook", fx: ovens[0] },
      { x: -0.55, z: -3.2, rotY: RY, anim: "cook", fx: ovens[2] },
      { x: -2.0, z: -1.7, rotY: 0, anim: "serve" },
      { x: -3.0, z: -1.7, rotY: 0, anim: "serve" },
    ];
    makeGuests(k, [[2.3, -0.5, -Math.PI / 2], [3.4, -0.3, -Math.PI / 2], [-1.6, 0.6, Math.PI]]);
  }

  // ── 3 米帳（3m×3m 快速帳篷）：華泰名品城與活動場景共用 ──
  function tent3m(P, x, z, o = {}) {
    const S = 4.0, H = 2.8, col = o.color || 0xc8262c;
    const g = new THREE.Group(); g.position.set(x, 0, z); P.add(g);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(q => { box(0.1, H, 0.1, 0xc9ced3, q[0] * S / 2, H / 2, q[1] * S / 2, g); box(0.3, 0.05, 0.3, 0x555555, q[0] * S / 2, 0.03, q[1] * S / 2, g); });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(S / Math.SQRT2 + 0.15, 1.3, 4, 1, true), new THREE.MeshLambertMaterial({ color: col, transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
    roof.rotation.y = Math.PI / 4; roof.position.y = H + 0.65; g.add(roof);
    // 帳篷前沿與右側垂邊（印品牌）
    const val = (w, txt) => canvasPlane(w, 0.42, 400, 42, (c, cw, ch) => { c.fillStyle = o.css || "#c8262c"; c.fillRect(0, 0, cw, ch); c.fillStyle = "#fff4e6"; c.font = 'bold 28px "PingFang TC","Noto Sans TC",serif'; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(txt, cw / 2, ch / 2 + 1); }, { double: true });
    const vf = val(S, o.valance || "紅玉滿 赤心雞蛋糕"); vf.position.set(0, H - 0.2, S / 2 + 0.01); g.add(vf);
    const vr = val(S, o.valance || "紅玉滿 赤心雞蛋糕"); vr.position.set(S / 2 + 0.01, H - 0.2, 0); vr.rotation.y = Math.PI / 2; g.add(vr);
    // 前方折疊桌（紅桌布）＋烤爐＋收銀＋菜單立牌
    box(3.4, 0.05, 0.8, 0xf4f4f4, 0, 0.98, S / 2 - 0.7, g);
    box(3.4, 0.9, 0.02, 0xc8262c, 0, 0.53, S / 2 - 0.3, g);
    put(g, canvasPlane(2.2, 0.6, 330, 90, (c, w, h) => { c.fillStyle = "#c8262c"; c.fillRect(0, 0, w, h); c.fillStyle = "#fff4e6"; c.font = 'bold 34px "PingFang TC",serif'; c.textAlign = "center"; c.fillText("紅玉滿 赤心雞蛋糕", w / 2, 44); c.font = "13px sans-serif"; c.fillText("♡ 願食雞蛋糕 常保赤子心 ♡", w / 2, 74); }), -0.3, 0.55, S / 2 - 0.28);
    const ovens = miniOvens(g, [-1.1, -0.5, 0.1], 1.0, S / 2 - 0.75);
    box(0.32, 0.22, 0.04, 0x222222, 1.0, 1.15, S / 2 - 0.85, g);
    const scr = put(g, new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.18), new THREE.MeshBasicMaterial({ color: 0x2a2f45 })), 1.0, 1.15, S / 2 - 0.875, Math.PI);
    const posFx = { kind: "pos", mesh: scr, on: false }; FX.push(posFx);
    put(g, canvasPlane(0.45, 0.6, 90, 120, (c, w, h) => { c.fillStyle = "#fff"; c.fillRect(0, 0, w, h); c.fillStyle = "#c62828"; c.fillRect(0, 0, w, 24); c.fillStyle = "#fff"; c.font = "bold 13px sans-serif"; c.fillText("Menu", 8, 17); c.fillStyle = "#555"; for (let i = 0; i < 5; i++) c.fillRect(8, 36 + i * 15, w - 16, 5); }), 1.5, 1.32, S / 2 - 0.5);
    // 後方工作桌、麵糊桶、紙箱
    box(3.0, 0.05, 0.7, 0xf4f4f4, 0, 0.8, -S / 2 + 0.6, g); [-1.3, 1.3].forEach(x2 => box(0.05, 0.8, 0.6, 0x999999, x2, 0.4, -S / 2 + 0.6, g));
    [-1.0, -0.5].forEach(x2 => { box(0.4, 0.5, 0.4, 0xf7f7f7, x2, 1.08, -S / 2 + 0.6, g); box(0.42, 0.05, 0.42, 0xf1c40f, x2, 1.35, -S / 2 + 0.6, g); });
    for (let i = 0; i < 4; i++) box(0.5, 0.3, 0.4, 0xc0392b, 0.4 + (i % 2) * 0.55, 0.98 + ((i / 2) | 0) * 0.3, -S / 2 + 0.6, g);
    // 側邊羽毛旗
    if (o.flag !== false) {
      box(0.04, 3.2, 0.04, 0xcccccc, S / 2 + 0.5, 1.6, S / 2 - 0.2, g);
      put(g, canvasPlane(0.6, 2.4, 80, 320, (c, w, h) => { c.fillStyle = "#c8262c"; c.fillRect(0, 0, w, h); c.fillStyle = "#fff4e6"; c.font = 'bold 40px "PingFang TC",serif'; c.textAlign = "center"; ["紅", "玉", "滿"].forEach((t, i) => c.fillText(t, w / 2, 60 + i * 52)); c.font = 'bold 20px "PingFang TC",serif'; ["雞", "蛋", "糕"].forEach((t, i) => c.fillText(t, w / 2, 230 + i * 26)); }, { double: true }), S / 2 + 0.82, 1.9, S / 2 - 0.2, Math.PI / 4);
    }
    const tz = z + S / 2 - 1.45;
    return {
      ovens, posFx,
      slots: [
        { x: x - 0.5, z: tz, rotY: 0, anim: "cook", fx: ovens[1] },
        { x: x + 1.0, z: tz, rotY: 0, anim: "serve", fx: posFx },
        { x: x - 1.1, z: tz, rotY: 0, anim: "cook", fx: ovens[0] },
        { x: x + 0.1, z: tz, rotY: 0, anim: "cook", fx: ovens[2] },
        { x: x - 0.7, z: z - S / 2 + 1.3, rotY: Math.PI, anim: "cook" },
        { x: x + 0.8, z: z - S / 2 + 1.3, rotY: Math.PI, anim: "stand" },
      ],
      front: z + S / 2,
    };
  }

  // ── 23 華泰名品城（聖誕樹旁）：大聖誕樹＋一頂 3 米帳（隊長 11/12 指示）──
  function huataiScene(k) {
    const P = group(k);
    floorCanvas(P, (g, w, h) => { g.fillStyle = "#9c9488"; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? -16 : 0; x < w; x += 32) { g.fillStyle = ["#a89f92", "#948b7f", "#b0a79a"][((x + y) / 16 | 0) % 3]; g.fillRect(x + 1, y + 1, 30, 14); } }, 0x9c9488);
    // 大聖誕樹（左後方）
    {
      const T = new THREE.Group(); T.position.set(-4.6, 0, -3.4); P.add(T);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.0, 10), mat(0x6b4423)); trunk.position.y = 0.5; T.add(trunk);
      [[3.0, 3.0, 2.4], [2.4, 2.6, 4.3], [1.7, 2.2, 6.0], [1.0, 1.8, 7.4]].forEach(l => { const c = new THREE.Mesh(new THREE.ConeGeometry(l[0], l[1], 10), mat(0x1f6b3a)); c.position.y = l[2]; c.castShadow = true; T.add(c); });
      const cols = [0xd62b2b, 0xf1c40f, 0xffffff, 0x3498db];
      for (let i = 0; i < 46; i++) { const y = 1.6 + Math.random() * 6.4, r = (8.3 - y) * 0.36 + 0.1, a = Math.random() * Math.PI * 2; const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: cols[i % 4] })); b.position.set(Math.cos(a) * r, y, Math.sin(a) * r); T.add(b); TWINKLE.push(b); }
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), new THREE.MeshBasicMaterial({ color: 0xffd84a })); star.position.y = 8.6; T.add(star);
      [[1.4, 0.8, 0xc0392b], [-1.2, 1.3, 0x2e86de], [0.4, 1.8, 0xf1c40f], [1.9, -0.4, 0x27ae60]].forEach(gf => { box(0.7, 0.55, 0.7, gf[2], gf[0], 0.28, gf[1], T); box(0.72, 0.1, 0.12, 0xffffff, gf[0], 0.56, gf[1], T); });
    }
    // 掛燈串路燈
    [[3.6, -5.0], [7.2, -1.0], [-7.2, 2.6]].forEach(l => { box(0.1, 4.2, 0.1, 0x333333, l[0], 2.1, l[1], P); box(0.4, 0.3, 0.4, 0xfff1c1, l[0], 4.3, l[1], P); });
    for (let i = 0; i <= 16; i++) { const t = i / 16, x = 3.6 + (7.2 - 3.6) * t, z = -5 + 4 * t, y = 4.0 - Math.sin(t * Math.PI) * 0.6; const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ color: 0xfff1a8 })); b.position.set(x, y, z); P.add(b); }
    // 飄雪（整點飄雪的氣氛，持續小量）
    for (let i = 0; i < 40; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: 0xffffff })); f.position.set(Math.random() * 14 - 7, Math.random() * 9, Math.random() * 10 - 6); P.add(f); SNOW.push(f); }
    const t = tent3m(P, 1.2, -1.6);
    put(P, textPlane("華泰名品城・聖誕樹旁", 5.5, 0.9, { color: "rgba(255,255,255,.4)", size: 52 }), -4.0, 0.03, 4.3, 0, -Math.PI / 2);
    stockBoard(P, k, 6.6, 1.4);
    SLOTS[k] = t.slots;
    makeGuests(k, [[2.3, 1.2, Math.PI], [2.5, 2.3, Math.PI], [-2.2, 0.4, -Math.PI * 0.7]]);
  }

  // ── 66 活動：3 米帳市集（招牌顯示當天活動名稱）──
  let eventSign = null, EVENT_CAR = null;
  function eventScene(k) {
    const P = group(k);
    floorCanvas(P, (g, w, h) => { g.fillStyle = "#7fa865"; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { g.fillStyle = Math.random() > 0.5 ? "#8cb571" : "#729b59"; g.fillRect(Math.random() * w, Math.random() * h, 3, 5); } g.fillStyle = "#cbbd9e"; g.fillRect(0, h * 0.62, w, h * 0.2); }, 0x7fa865);
    // 隔壁的攤位帳篷（不同顏色，不放品牌）
    [[-5.6, -2.0, 0x2e86de], [-5.6, 3.2, 0xf1c40f], [6.0, -3.6, 0x27ae60]].forEach(n => {
      const g = new THREE.Group(); g.position.set(n[0], 0, n[1]); P.add(g);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(q => box(0.08, 2.6, 0.08, 0xc9ced3, q[0] * 1.6, 1.3, q[1] * 1.6, g));
      const r = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.0, 4), mat(n[2])); r.rotation.y = Math.PI / 4; r.position.y = 3.1; g.add(r);
      box(2.8, 0.05, 0.7, 0xf4f4f4, 0, 0.95, 1.0, g); box(2.8, 0.9, 0.02, 0xeeeeee, 0, 0.5, 1.33, g);
    });
    const t = tent3m(P, 0.6, -1.6);
    // 大隊長開 Volvo XC60 載物資到 3 米帳（每次切到活動場景就重播一次）
    {
      const car = new THREE.Group(); P.add(car);
      const pm = {}; const ph = c => pm[c] || (pm[c] = new THREE.MeshPhongMaterial({ color: c, shininess: 80, specular: 0x555555 }));
      const cb = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), ph(c)); m.position.set(x, y, z); m.castShadow = true; car.add(m); return m; };
      const BODY = 0xe9ecee, GLASS = 0x26323d, DARK = 0x2a2d30;
      // 車身朝 -x 前進：x 負方向是車頭
      cb(3.9, 0.85, 1.75, BODY, 0, 0.78, 0);
      cb(2.5, 0.7, 1.62, BODY, 0.25, 1.52, 0);
      cb(2.3, 0.55, 1.64, GLASS, 0.25, 1.53, 0);
      cb(0.06, 0.55, 1.5, GLASS, -1.0, 1.5, 0).rotation.z = -0.5;
      cb(0.08, 0.5, 1.55, GLASS, 1.48, 1.52, 0).rotation.z = 0.25;
      cb(0.1, 0.4, 1.0, DARK, -1.96, 0.78, 0);
      [-0.55, 0.55].forEach(z => { cb(0.08, 0.06, 0.4, 0xffffff, -1.96, 0.98, z); cb(0.08, 0.2, 0.06, 0xffffff, -1.96, 0.92, z + (z < 0 ? 0.15 : -0.15)); });
      [-0.6, 0.6].forEach(z => cb(0.06, 0.45, 0.12, 0xc0392b, 1.96, 0.95, z));
      cb(1.9, 0.05, 0.06, 0xc8ccd0, 0.25, 1.9, -0.7); cb(1.9, 0.05, 0.06, 0xc8ccd0, 0.25, 1.9, 0.7);
      cb(3.95, 0.2, 1.8, DARK, 0, 0.36, 0);
      const plate = canvasPlane(0.6, 0.18, 120, 36, (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.fillStyle = "#222"; g.font = "bold 30px sans-serif"; g.textAlign = "center"; g.fillText("XC60", w / 2, 27); }); plate.position.set(1.99, 0.62, 0); plate.rotation.y = Math.PI / 2; car.add(plate);
      [[-1.25, -0.88], [-1.25, 0.88], [1.25, -0.88], [1.25, 0.88]].forEach(q => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 14), ph(0x1b1b1b)); w.rotation.x = Math.PI / 2; w.position.set(q[0], 0.42, q[1]); car.add(w); const r = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.32, 10), ph(0xb8bcc0)); r.rotation.x = Math.PI / 2; r.position.set(q[0], 0.42, q[1]); car.add(r); });
      // 後車廂物資紙箱
      [[1.0, 0], [1.3, 0.35]].forEach(b2 => cb(0.4, 0.3, 0.4, 0xc0392b, b2[0], 1.3, b2[1]));
      const cap = makeChar({ shirt: 0x2c3e50, pants: 0x1b2631, hair: 0x222222, cap: 0xc0392b });
      nameTag(cap, "大隊長"); cap.bubble.classList.add("uo-boss"); cap.g.visible = false;
      EVENT_CAR = { car, cap, x0: SCENES[k].x + 11, x1: SCENES[k].x + 5.0, z: 1.0, t: 0, state: "idle" };
      car.position.set(11, 0, 1.3);
    }
    // 活動名稱看板（打卡時填的活動名稱）
    {
      const g = new THREE.Group(); g.position.set(-2.4, 0, 1.6); g.rotation.y = Math.PI / 4; P.add(g);
      box(0.06, 1.4, 0.06, 0x8b5a2b, -0.55, 0.7, 0, g); box(0.06, 1.4, 0.06, 0x8b5a2b, 0.55, 0.7, 0, g);
      const c = document.createElement("canvas"); c.width = 256; c.height = 160;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.8), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), side: THREE.DoubleSide })); m.position.set(0, 1.6, 0); g.add(m);
      eventSign = { c, m }; drawEventSign("今日活動");
    }
    put(P, textPlane("活動・3 米帳", 5, 0.9, { color: "rgba(255,255,255,.45)", size: 56 }), -4.2, 0.03, 4.6, 0, -Math.PI / 2);
    stockBoard(P, k, -3.0, 4.2);
    SLOTS[k] = t.slots;
    makeGuests(k, [[1.6, 1.2, Math.PI], [1.9, 2.3, Math.PI], [-0.6, 2.6, -Math.PI * 0.8]]);
  }
  function drawEventSign(name) {
    if (!eventSign) return; const g = eventSign.c.getContext("2d");
    g.fillStyle = "#fff8ec"; g.fillRect(0, 0, 256, 160); g.fillStyle = "#c8262c"; g.fillRect(0, 0, 256, 40);
    g.fillStyle = "#fff"; g.font = 'bold 24px "PingFang TC",sans-serif'; g.textAlign = "center"; g.fillText("紅玉滿 出攤中", 128, 28);
    g.fillStyle = "#333"; g.font = 'bold ' + (name.length > 8 ? 20 : 28) + 'px "PingFang TC",sans-serif'; g.fillText(name.slice(0, 14), 128, 100);
    eventSign.m.material.map.needsUpdate = true;
  }

  // ── 51 新竹光復（加盟）：依 2026-11-12 實景照片 IMG_0769～0771（店面右側外帶窗口：上掀霧面玻璃窗、風扇條、米白布簾）──
  function guangfuScene(k) {
    const P = group(k);
    const OAK = 0xe6d9c3, OAK2 = 0xd8c6a6, BROWN = 0x5a3e2b;
    floorCanvas(P, (g, w, h) => { g.fillStyle = "#c9c2b6"; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 22) for (let x = (y / 22) % 2 ? -22 : 0; x < w; x += 44) { g.fillStyle = ["#d3ccc0", "#c4bdb1", "#cdc6ba"][((x + y) / 22 | 0) % 3]; g.fillRect(x + 1, y + 1, 42, 20); } }, 0xc9c2b6);
    // 門口人工草皮
    box(8.6, 0.04, 1.6, 0x4f8a3c, -0.6, 0.03, -1.0, P);
    // 店面立面（朝 +z），z = -1.9
    const FZ = -1.9;
    box(5.2, 3.3, 0.25, 0xf3eee5, -3.4, 1.65, FZ - 0.15, P); box(3.0, 3.3, 0.25, 0xf3eee5, 3.5, 1.65, FZ - 0.15, P);
    // 店內（地板與後牆，從窗口看進去）
    box(11, 2.6, 0.25, 0xe8e2d8, -0.5, 1.3, -4.8, P);
    // 淺木人字形框
    box(9.2, 0.18, 0.2, OAK2, -1.0, 3.2, FZ + 0.05, P);
    // 上方招牌（只寫「日式飯糰」，不放同店品牌名）
    box(9.6, 0.8, 0.3, 0xf7f5f0, -1.0, 3.7, FZ + 0.1, P);
    put(P, canvasPlane(9.4, 0.75, 600, 48, (g, w, h) => { g.fillStyle = "#f7f5f0"; g.fillRect(0, 0, w, h); g.strokeStyle = "#5a3e2b"; g.lineWidth = 3; g.beginPath(); g.arc(120, 24, 18, 0, Math.PI * 2); g.stroke(); g.fillStyle = "#5a3e2b"; g.font = 'bold 28px "PingFang TC",sans-serif'; g.fillText("日式飯糰", 160, 34); g.font = "15px sans-serif"; g.fillText("新竹光復店", 470, 32); }), -1.0, 3.7, FZ + 0.26);
    // 左側：點餐機、菜單板
    box(0.9, 1.9, 0.5, 0xf2f2f2, -5.2, 0.95, FZ + 0.3, P); box(0.6, 0.5, 0.04, 0x222222, -5.2, 1.4, FZ + 0.56, P);
    put(P, canvasPlane(2.2, 1.6, 220, 160, (g, w, h) => { g.fillStyle = "#6b4a33"; g.fillRect(0, 0, w, h); g.fillStyle = "#f4e9d8"; g.fillRect(8, 8, w - 16, 90); for (let i = 0; i < 8; i++) { g.fillStyle = "#d8a35a"; g.fillRect(16 + (i % 4) * 50, 18 + (i / 4 | 0) * 40, 36, 22); } g.fillStyle = "#fff"; g.font = 'bold 22px "PingFang TC",sans-serif'; g.fillText("休息中", 70, 135); }), -3.4, 2.0, FZ + 0.02);
    // 中間玻璃門
    box(1.4, 2.6, 0.06, 0xd8c6a6, -1.6, 1.3, FZ + 0.02, P);
    put(P, glassBox(1.2, 2.4, 0.04, 0xcfe6f0, 0.35), -1.6, 1.3, FZ + 0.06);
    box(0.8, 0.5, 0.06, 0x111111, -1.6, 2.5, FZ + 0.1, P);

    // ── 紅玉滿外帶窗口（右側）──
    const WX = 0.6, W = 2.2, WY0 = 1.25, WY1 = 2.55;
    // 窗洞：用四塊牆遮出開口（覆蓋立面該區域）
    box(W + 0.6, WY0, 0.3, OAK, WX, WY0 / 2, FZ + 0.02, P);
    box(0.3, WY1 - WY0, 0.3, OAK, WX - W / 2 - 0.15, (WY0 + WY1) / 2, FZ + 0.02, P);
    box(W + 0.6, 3.3 - WY1, 0.3, OAK, WX, (WY1 + 3.3) / 2, FZ + 0.02, P);
    // 木窗框、白底紅字招牌
    box(W, 0.08, 0.32, BROWN, WX, WY1, FZ + 0.04, P); box(0.08, WY1 - WY0, 0.32, BROWN, WX - W / 2, (WY0 + WY1) / 2, FZ + 0.04, P);
    put(P, canvasPlane(W, 0.6, 360, 98, (g, w, h) => { g.fillStyle = "#fbfaf7"; g.fillRect(0, 0, w, h); g.fillStyle = "#c8262c"; g.font = 'bold 44px "PingFang TC","Noto Sans TC",serif'; g.fillText("紅玉滿", 14, 52); g.font = 'bold 26px "PingFang TC",serif'; g.fillText("赤心雞蛋糕", 176, 50); g.font = "bold 12px sans-serif"; g.fillText("Hong Yu Man Egg Pancakes 홍차계란빵 紅玉心形燒", 14, 84); }), WX, WY1 + 0.36, FZ + 0.19);
    // 上掀霧面玻璃窗（兩片）
    [0, 1].forEach(i => {
      const g = new THREE.Group(); g.position.set(WX - 0.2, WY1 - i * 0.02, FZ + 0.18); g.rotation.x = -1.5 - i * 0.05; P.add(g);
      box(W - 0.5, 0.06, 0.48, BROWN, 0, 0, 0.24 + i * 0.5, g);
      const gl = glassBox(W - 0.65, 0.04, 0.36, 0xe6eef0, 0.35); gl.position.set(0, 0.02, 0.24 + i * 0.5); g.add(gl);
      box(0.12, 0.07, 0.06, 0xc9a24a, -0.5, 0.03, 0.02 + i * 0.5, g); box(0.12, 0.07, 0.06, 0xc9a24a, 0.5, 0.03, 0.02 + i * 0.5, g);
    });
    // 右側黑色風扇條
    box(0.42, WY1 - WY0 + 0.2, 0.3, 0x1a1a1a, WX + W / 2 + 0.05, (WY0 + WY1) / 2, FZ + 0.03, P);
    for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.CircleGeometry(0.15, 12), mat(0x444444)); f.position.set(WX + W / 2 + 0.05, WY0 + 0.2 + i * 0.32, FZ + 0.19); P.add(f); }
    // 窗台：木層板＋Menu、草皮墊木托盤、竹籤杯、乾洗手、兩層木架雞蛋糕
    box(W + 0.4, 0.06, 0.45, 0xeadfcb, WX, WY0, FZ + 0.32, P);
    put(P, canvasPlane(0.42, 0.52, 84, 104, (g, w, h) => { g.fillStyle = "#c63b2b"; g.fillRect(0, 0, w, h); g.fillStyle = "#f3d29b"; g.fillRect(6, 30, w - 12, 50); g.fillStyle = "#fff"; g.font = "bold 13px sans-serif"; g.fillText("Menu", 6, 20); g.font = "10px sans-serif"; g.fillText("初心原味", 10, 96); }), WX - 0.8, WY0 + 0.29, FZ + 0.4);
    box(0.55, 0.03, 0.28, 0x4f8a3c, WX - 0.25, WY0 + 0.05, FZ + 0.36, P); box(0.5, 0.04, 0.22, 0x5a3e2b, WX - 0.25, WY0 + 0.08, FZ + 0.36, P);
    box(0.12, 0.16, 0.12, 0xc9a24a, WX + 0.12, WY0 + 0.11, FZ + 0.38, P);
    box(0.1, 0.3, 0.08, 0xf2f2f2, WX + 0.32, WY0 + 0.18, FZ + 0.38, P);
    box(0.5, 0.03, 0.3, 0x4f8a3c, WX + 0.75, WY0 + 0.05, FZ + 0.36, P);
    [0.12, 0.42].forEach(y => box(0.42, 0.03, 0.26, 0xc9a77c, WX + 0.75, WY0 + y, FZ + 0.36, P));
    [0, 1, 2].forEach(i => box(0.1, 0.07, 0.1, 0xb5651d, WX + 0.6 + i * 0.13, WY0 + 0.17, FZ + 0.36, P));
    // 窗下米白布簾＋綠葉束、醒獅吊飾
    put(P, canvasPlane(W + 0.1, 1.05, 330, 160, (g, w, h) => { g.fillStyle = "#f3efe4"; g.fillRect(0, 0, w, h); g.fillStyle = "#2b2420"; g.textAlign = "center"; g.font = 'bold 30px "PingFang TC",serif'; g.fillText("紅玉滿 赤心雞蛋糕", w / 2, 70); g.font = "11px sans-serif"; g.fillText("Hong Yu Man Egg Pancakes 홍차계란빵 紅玉心形燒", w / 2, 92); g.font = '14px "PingFang TC",sans-serif'; g.fillText("願食雞蛋糕，常保赤子心。", w / 2, 122); }), WX, 0.62, FZ + 0.19);
    box(0.28, 0.5, 0.12, 0x3f7a3a, WX - W / 2 + 0.05, 0.95, FZ + 0.25, P);
    box(0.22, 0.26, 0.06, 0xe8e2d6, WX - W / 2 - 0.25, 2.05, FZ + 0.2, P); box(0.04, 0.3, 0.04, 0xc0392b, WX - W / 2 - 0.25, 1.75, FZ + 0.2, P);
    // 鐵桶垃圾桶
    { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.25, 0.75, 14), mat(0x555a5e)); c.position.set(WX + W / 2 + 0.25, 0.38, FZ + 0.5); P.add(c); }
    // 窗內：三台烤爐、收銀
    const ovens = miniOvens(P, [WX - 0.6, WX, WX + 0.6], 0.8, FZ - 0.42);
    box(W + 0.4, 0.8, 0.4, 0xd9d4ca, WX, 0.4, FZ - 0.42, P);
    box(0.32, 0.22, 0.04, 0x222222, WX + 0.9, 1.15, FZ - 0.6, P);
    const scr = put(P, new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.18), new THREE.MeshBasicMaterial({ color: 0x2a2f45 })), WX + 0.9, 1.15, FZ - 0.625, Math.PI);
    const posFx = { kind: "pos", mesh: scr, on: false }; FX.push(posFx);
    // 右側不鏽鋼柱＋灰磚柱＋瓦斯錶
    box(0.5, 4.4, 0.5, 0xb8bdc2, 2.6, 2.2, FZ + 0.05, P);
    box(1.6, 4.4, 0.8, 0x8e857c, 3.7, 2.2, FZ - 0.1, P);
    for (let y = 0.2; y < 4.4; y += 0.22) box(1.62, 0.02, 0.82, 0x6f675f, 3.7, y, FZ - 0.1, P);
    [2.6, 2.0].forEach(y => { box(0.45, 0.4, 0.2, 0xcfd3d6, 3.6, y, FZ + 0.4, P); box(0.04, 1.2, 0.04, 0xc9b26a, 3.3, y - 0.2, FZ + 0.35, P); });
    // 左前方：棕色桌布長桌＋保溫箱＋直立看板「流心芋圓豆花」
    box(2.4, 0.05, 1.0, 0x8b6a52, -4.3, 0.95, 0.4, P); box(2.4, 0.9, 1.02, 0x7d5d47, -4.3, 0.5, 0.4, P);
    box(0.9, 0.45, 0.6, 0x6b6b6b, -4.6, 1.2, 0.3, P); box(0.7, 0.4, 0.5, 0x333333, -3.8, 1.18, 0.3, P);
    put(P, canvasPlane(0.45, 1.8, 60, 240, (g, w, h) => { g.fillStyle = "#2b2b30"; g.fillRect(0, 0, w, h); g.fillStyle = "#f4f1ea"; g.font = 'bold 30px "PingFang TC",serif'; g.textAlign = "center"; ["流", "心", "芋", "圓", "豆", "花"].forEach((t, i) => g.fillText(t, 30, 36 + i * 36)); }), -5.6, 0.9, 1.1, Math.PI / 6);
    put(P, textPlane("新竹光復・加盟店", 5, 0.9, { color: "rgba(80,70,60,.35)", size: 56 }), -4.0, 0.03, 4.3, 0, -Math.PI / 2);
    stockBoard(P, k, 6.4, 0.8);
    SLOTS[k] = [
      { x: WX, z: FZ - 0.95, rotY: 0, anim: "cook", fx: ovens[1] },
      { x: WX + 0.9, z: FZ - 0.95, rotY: 0, anim: "serve", fx: posFx },
      { x: WX - 0.6, z: FZ - 0.95, rotY: 0, anim: "cook", fx: ovens[0] },
      { x: WX + 0.6, z: FZ - 1.5, rotY: 0, anim: "cook", fx: ovens[2] },
      { x: -1.6, z: -3.0, rotY: 0, anim: "stand" },
      { x: -3.4, z: -3.0, rotY: 0, anim: "stand" },
    ];
    makeGuests(k, [[WX - 0.9, -0.9, Math.PI * 0.85], [WX - 1.4, 0.1, Math.PI * 0.85], [-4.3, 1.5, Math.PI]]);
  }
  miramarScene("meili");
  airportScene("airport");
  huataiScene("huatai");
  eventScene("event");
  guangfuScene("guangfu");

  // ── v1.30 隊員座位區 → v1.41 休息區（寬 24）：左半買來的座位（最多 12 張桌子），右半與前排公用座位 40 個 ──
  const SEAT_IDX = {}; let seatsG = null;
  const PUBLIC = [];   // 公用座位（沙發 24、吧檯椅 8、懶骨頭 8）
  {
    const P = group("seats");
    bldRoom(P, 24, 0xe9d6b6, 0x8a5a3b, 0xc0392b, "glass", [0xe2c9a1, 0xefdcbc]);
    put(P, textPlane("休息區 · 隊員座位", 6, 0.9, { bg: "#c0392b", color: "#fff3e0", size: 46 }), -5.5, 3.5, -5.95);
    put(P, textPlane("休息區 LOUNGE", 6, 1.4), 6.5, 0.03, 4.7, 0, -Math.PI / 2);
    REVB.thanks = wallBoard(P, "thanks", 6.0, 1.9, -6.0, 3.3, 2.27);   // v1.42 感謝牆
    // 右半：三排長沙發（每排 8 位）＋茶几
    const SOFA = [0x2e86c1, 0x27ae60, 0xe67e22];
    [-4.3, -1.7, 0.9].forEach((z, r) => [3.6, 8.4].forEach(cx => {
      const col = SOFA[r];
      box(4.4, 0.45, 0.9, col, cx, 0.32, z, P); box(4.4, 0.8, 0.3, col, cx, 0.75, z - 0.45, P);
      box(0.3, 0.65, 0.9, col, cx - 2.2, 0.45, z, P); box(0.3, 0.65, 0.9, col, cx + 2.2, 0.45, z, P);
      for (let i = 0; i < 4; i++) { box(0.95, 0.1, 0.8, 0xf4efe6, cx - 1.5 + i * 1.0, 0.58, z + 0.05, P); PUBLIC.push({ x: cx - 1.5 + i * 1.0, z: z + 0.05, rotY: 0, sit: true, anim: "sit" }); }
      box(2.4, 0.4, 0.7, 0x8b5a2b, cx, 0.2, z + 1.15, P);
    }));
    // 左前：吧檯＋8 張吧檯椅（面向吧檯）
    box(8.6, 1.1, 0.6, 0x6f4e37, -6.6, 0.55, 2.6, P); box(8.8, 0.08, 0.8, 0xc49a6c, -6.6, 1.12, 2.6, P);
    for (let i = 0; i < 8; i++) { const x = -10.4 + i * 1.08; box(0.42, 0.08, 0.42, 0xc0392b, x, 0.85, 3.3, P); box(0.08, 0.8, 0.08, 0x555555, x, 0.42, 3.3, P); PUBLIC.push({ x, z: 3.3, rotY: Math.PI, sit: true, anim: "sit", hi: true }); }
    // 咖啡機
    box(0.6, 0.5, 0.45, 0x2c2c34, -2.6, 1.42, 2.55, P); put(P, textPlane("☕", 0.5, 0.5, { size: 90 }), -2.6, 2.0, 2.6);
    // 右前：懶骨頭 8 個
    for (let i = 0; i < 8; i++) { const x = 1.6 + i * 1.3, col = [0xe67e22, 0x9b59b6, 0xf1c40f, 0x1abc9c][i % 4]; box(0.95, 0.42, 0.9, col, x, 0.22, 3.0, P); box(0.95, 0.5, 0.28, col, x, 0.48, 2.6, P); PUBLIC.push({ x, z: 3.0, rotY: 0, sit: true, anim: "sit", low: true }); }
    plant(P, 11.3, -5.3); plant(P, -11.4, 5.2); plant(P, 11.3, 5.2);
    SLOTS.seats = PUBLIC_SEATS_INIT();
  }
  function PUBLIC_SEATS_INIT() { return new Array(12).fill(null).concat(PUBLIC.map(x => ({ ...x }))); }   // 0～11 是買來的座位（syncSeats 填），12 起是公用座位
  function seatXZ(i) { return { x: -10.2 + (i % 4) * 3.0, z: -3.9 + Math.floor(i / 4) * 2.45 }; }   // v1.42 桌子轉向，人坐在桌子後面
  function seatDesk(P, x, z, kind) {
    const top = { desk_white: 0xf4f1ea, desk_game: 0x23232b, desk_boss: 0xa93226 }[kind] || 0x9b6b43;
    const leg = { desk_white: 0xd0d0d0, desk_game: 0x111111, desk_boss: 0x7b241c }[kind] || 0x5d3a1f;
    const w = kind === "desk_boss" ? 2.4 : 2;
    box(w, 0.12, 1.1, top, x, 1.0, z, P);
    if (kind === "desk_boss") { box(w, 0.86, 0.08, 0x7b241c, x, 0.5, z - 0.5, P); box(w + 0.04, 0.07, 0.07, 0xf1c40f, x, 1.0, z + 0.56, P); box(w + 0.04, 0.07, 0.07, 0xf1c40f, x, 1.0, z - 0.56, P); }
    else [[-w / 2 + 0.1, -0.45], [w / 2 - 0.1, -0.45], [-w / 2 + 0.1, 0.45], [w / 2 - 0.1, 0.45]].forEach(q => box(0.1, 0.95, 0.1, leg, x + q[0], 0.47, z + q[1], P));
    if (kind === "desk_game") { const strip = box(w, 0.05, 0.04, 0x00e5ff, x, 0.92, z + 0.56, P); strip.material = new THREE.MeshBasicMaterial({ color: 0x00e5ff }); FX.push({ kind: "rgb", mesh: strip }); }
    box(0.95, 0.62, 0.08, 0x2c2c34, x, 1.55, z - 0.3, P); box(0.12, 0.3, 0.12, 0x2c2c34, x, 1.15, z - 0.3, P);
    const scr = put(P, new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.5), new THREE.MeshBasicMaterial({ color: 0x2a2f45 })), x, 1.55, z - 0.255);
    box(0.6, 0.04, 0.22, 0xdddddd, x, 1.08, z + 0.1, P);
    const fx = { kind: "screen", mesh: scr, on: false }; FX.push(fx); return fx;
  }
  function seatChair(P, x, z, kind) {
    if (kind === "chair_bean") { box(0.95, 0.45, 0.9, 0xe67e22, x, 0.24, z, P); box(0.95, 0.5, 0.3, 0xd35400, x, 0.5, z + 0.4, P); return; }
    const c = { chair_game: 0x1a1a1a, chair_throne: 0xc0392b }[kind] || 0x8b5a2b, hi = kind === "chair_throne" ? 1.9 : kind === "chair_game" ? 1.6 : 0.7;
    box(0.75, 0.12, 0.7, c, x, 0.6, z, P); box(0.75, hi, 0.12, c, x, 0.6 + hi / 2, z + 0.35, P); box(0.12, 0.55, 0.12, 0x222222, x, 0.28, z, P);
    if (kind === "chair_game") { box(0.2, hi * 0.8, 0.13, 0xc0392b, x, 0.7 + hi / 2, z + 0.36, P); box(0.12, 0.3, 0.6, 0x1a1a1a, x - 0.42, 0.8, z, P); box(0.12, 0.3, 0.6, 0x1a1a1a, x + 0.42, 0.8, z, P); }
    if (kind === "chair_throne") { box(0.85, 0.08, 0.16, 0xf1c40f, x, 0.6 + hi, z + 0.35, P); [-0.3, 0, 0.3].forEach(dx => box(0.1, 0.22, 0.1, 0xf1c40f, x + dx, 0.75 + hi, z + 0.35, P)); box(0.12, 0.4, 0.62, 0xf1c40f, x - 0.43, 0.82, z, P); box(0.12, 0.4, 0.62, 0xf1c40f, x + 0.43, 0.82, z, P); }
  }
  function seatDeco(P, x, z, kind) {
    const y = 1.06;
    switch (kind) {
      case "deco_plant": box(0.22, 0.2, 0.22, 0xb5532d, x, y + 0.1, z, P); box(0.3, 0.3, 0.3, 0x2ecc71, x, y + 0.36, z, P); break;
      case "deco_frame": { const f = box(0.34, 0.28, 0.04, 0x8e5b3a, x, y + 0.16, z, P); f.rotation.y = 0.3; box(0.26, 0.2, 0.02, 0xffe7c2, x + 0.01, y + 0.16, z + 0.03, P); break; }
      case "deco_globe": { const m = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), mat(0x3498db)); m.position.set(x, y + 0.3, z); P.add(m); box(0.2, 0.05, 0.2, 0x8b5a2b, x, y + 0.03, z, P); box(0.05, 0.12, 0.05, 0x8b5a2b, x, y + 0.1, z, P); break; }
      case "deco_figure": box(0.26, 0.24, 0.2, 0xf0b429, x, y + 0.12, z, P); [-0.06, 0.06].forEach(dx => box(0.04, 0.05, 0.02, 0x222222, x + dx, y + 0.16, z + 0.11, P)); box(0.08, 0.03, 0.02, 0xd9534f, x, y + 0.08, z + 0.11, P); break;
      case "deco_trex": box(0.2, 0.22, 0.18, 0xd94a3a, x, y + 0.11, z, P); box(0.22, 0.18, 0.22, 0xd94a3a, x, y + 0.3, z + 0.04, P); box(0.12, 0.08, 0.14, 0xd94a3a, x, y + 0.08, z - 0.16, P); [-0.05, 0.05].forEach(dx => box(0.03, 0.04, 0.02, 0x222222, x + dx, y + 0.33, z + 0.16, P)); break;
      case "deco_trophy": box(0.2, 0.06, 0.2, 0x7b5a2b, x, y + 0.03, z, P); box(0.06, 0.12, 0.06, 0xf1c40f, x, y + 0.12, z, P); box(0.24, 0.2, 0.24, 0xf1c40f, x, y + 0.28, z, P); break;
      case "deco_oven": box(0.36, 0.2, 0.24, 0xf1c40f, x, y + 0.1, z, P); box(0.3, 0.06, 0.2, 0xb8860b, x, y + 0.28, z, P); box(0.26, 0.05, 0.02, 0xff6a1a, x, y + 0.12, z + 0.13, P); break;
    }
  }
  function seatDen(P, x, z, kind) {
    if (kind === "den_cushion") { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.14, 14), mat(0xf5a3c7)); m.position.set(x, 0.07, z); P.add(m); return; }
    if (kind === "den_house") { box(0.8, 0.6, 0.7, 0xc49a6c, x, 0.3, z, P); const r = box(0.95, 0.12, 0.85, 0x8b4513, x, 0.68, z, P); r.rotation.z = 0.0; box(0.3, 0.35, 0.04, 0x3a2a1a, x, 0.2, z + 0.36, P); return; }
    if (kind === "den_castle") { box(0.9, 0.55, 0.8, 0xbfc5cc, x, 0.28, z, P); [[-0.4, -0.35], [0.4, -0.35], [-0.4, 0.35], [0.4, 0.35]].forEach(q => { box(0.2, 0.85, 0.2, 0xa9b0b8, x + q[0], 0.42, z + q[1], P); box(0.04, 0.18, 0.12, 0xd62828, x + q[0], 0.95, z + q[1], P); }); box(0.3, 0.35, 0.04, 0x5a3a1a, x, 0.18, z + 0.41, P); }
  }
  function syncSeats() {
    if (seatsG) { GROUP_OF.seats.remove(seatsG); for (let i = FX.length - 1; i >= 0; i--) if (FX[i].seat) FX.splice(i, 1); }
    Object.keys(SEAT_IDX).forEach(k => delete SEAT_IDX[k]); SLOTS.seats = PUBLIC_SEATS_INIT();
    const P = seatsG = new THREE.Group(); GROUP_OF.seats.add(P);
    (GAME.seats || []).slice(0, 12).forEach((st, i) => {
      const { x, z } = seatXZ(i);
      // v1.42 桌子面向鏡頭：桌子、椅子、擺飾畫在轉 180° 的小群組裡，人坐在桌子後面、臉朝畫面
      const D = new THREE.Group(); D.position.set(x, 0, z); D.rotation.y = Math.PI; P.add(D);
      const fx = seatDesk(D, 0, 0, st.desk); fx.seat = true;
      seatChair(D, 0, 0.9, st.chair);
      (st.deco || []).slice(0, 3).forEach((d, j) => seatDeco(D, [-0.7, 0.72, -0.42][j], [0.2, 0.15, -0.2][j], d));
      if (st.den) seatDen(P, x - 1.3, z - 0.9, st.den);
      put(P, textPlane(st.name, 1.1, 0.26, { bg: "#fff3e0", color: "#7a2a1a", size: 40 }), x, 0.72, z + 0.565);
      SEAT_IDX[String(st.id)] = i;
      SLOTS.seats[i] = { x, z: z - 0.9, rotY: 0, sit: st.chair !== "chair_bean", anim: "type", fx, via: [{ x: x + 1.5, z: z - 0.9 }] };
    });
  }

  // ── v1.41 大廳：櫃檯、品牌牆、今日出勤早安牆、等候沙發（左邊是大門）──
  {
    const P = group("lobby");
    bldRoom(P, 16, 0xd8d2c8, 0x7a5a44, 0xc0392b, "solid", [0xcfc8bc, 0xe2ddd4]);
    // 大門（左牆玻璃門）
    const gd = glassBox(0.12, 3.0, 2.6, 0xbfe7ff, 0.35); gd.position.set(-8.0, 1.5, 3.8); P.add(gd); box(0.2, 0.2, 2.8, 0x8a9aa6, -8.0, 3.05, 3.8, P);
    box(5.6, 1.6, 0.3, 0xc0392b, -2.0, 2.4, -5.85, P);
    put(P, textPlane("紅玉滿赤心", 5.2, 1.1, { color: "#fff3e0", size: 120 }), -2.0, 2.45, -5.68);
    put(P, textPlane("光譜餐飲品牌集團 · 紅色品牌", 5, 0.5, { color: "rgba(90,50,30,.7)", size: 40 }), -2.0, 1.2, -5.95);
    REVB.attend = wallBoard(P, "attend", 4.6, 1.9, -6.0, 3.3, 2.27);
    // 櫃檯
    box(4.2, 1.1, 0.9, 0x6e4b2a, -2.0, 0.55, -2.4, P); box(4.4, 0.08, 1.1, 0xc49a6c, -2.0, 1.12, -2.4, P); box(4.2, 0.3, 0.06, 0xc0392b, -2.0, 0.8, -1.93, P);
    box(0.5, 0.35, 0.06, 0x2c2c34, -2.6, 1.35, -2.6, P); box(0.3, 0.25, 0.3, 0xf1c40f, -0.9, 1.28, -2.3, P);
    // 等候沙發＋茶几
    box(3.6, 0.45, 0.9, 0x8e5b3a, 4.4, 0.3, -0.6, P); box(3.6, 0.8, 0.3, 0x8e5b3a, 4.4, 0.7, -1.05, P);
    box(1.6, 0.4, 0.8, 0x6e4b2a, 4.4, 0.2, 0.6, P); box(0.4, 0.06, 0.3, 0xffffff, 4.2, 0.43, 0.6, P);
    plant(P, -7.3, -5.3); plant(P, 7.2, -5.3); plant(P, -7.3, 2.0);
    put(P, textPlane("歡迎光臨 WELCOME", 5, 1.2), -1.5, 0.03, 3.2, 0, -Math.PI / 2);
    // v1.42 福利櫃檯（點一下申請補助）＋意見箱
    box(2.6, 1.1, 0.8, 0x2e86c1, -5.4, 0.55, -0.6, P); box(2.8, 0.08, 1.0, 0xdfe6ec, -5.4, 1.12, -0.6, P);
    const bfSign = put(P, textPlane("🎁 福利櫃檯", 2.6, 0.6, { bg: "#2e86c1", color: "#fff", size: 64 }), -5.4, 1.8, -0.6);
    const bfFront = put(P, textPlane("點我申請補助", 2.4, 0.45, { bg: "#fff", color: "#2e86c1", size: 52 }), -5.4, 0.6, -0.19);
    BOARD_HIT.push({ mesh: bfSign, key: "benefit" }, { mesh: bfFront, key: "benefit" });
    box(0.7, 1.1, 0.6, 0xc0392b, -5.4, 0.55, 1.6, P); box(0.4, 0.06, 0.1, 0x222222, -5.4, 1.0, 1.91, P);
    const ideaSign = put(P, textPlane("📮 意見箱", 1.4, 0.4, { bg: "#c0392b", color: "#fff", size: 60 }), -5.4, 1.4, 1.92);
    BOARD_HIT.push({ mesh: ideaSign, key: "idea" });
    SLOTS.lobby = [
      { x: -2.0, z: -3.4, rotY: 0, anim: "stand" },
      { x: 3.6, z: -0.6, rotY: 0, sit: true, anim: "sit" }, { x: 5.2, z: -0.6, rotY: 0, sit: true, anim: "sit" },
      { x: -2.6, z: -1.2, rotY: Math.PI, anim: "talk" }, { x: -1.2, z: -1.2, rotY: Math.PI, anim: "stand" },
      { x: 4.6, z: -4.4, rotY: Math.PI, anim: "stand" }, { x: 1.0, z: 2.0, rotY: -Math.PI / 4, anim: "stand" },
    ];
  }
  // ── v1.41 飯堂：三張長桌、自助餐檯、今日菜單、隊長的桌子 ──
  {
    const P = group("canteen");
    bldRoom(P, 16, 0xe8dcc6, 0x8a5a3b, 0xc0392b, "door", [0xe0d2b8, 0xefe4d0]);
    put(P, textPlane("飯堂 · 吃飽才有力氣", 5, 0.8, { bg: "#c0392b", color: "#fff3e0", size: 46 }), -4.5, 3.55, -5.95);
    REVB.menu = wallBoard(P, "menu", 4.4, 1.9, -6.0, 3.3, 2.27);
    // 自助餐檯
    box(6.0, 1.0, 0.9, 0xb8c0c8, -4.3, 0.5, -5.2, P); box(6.1, 0.06, 1.0, 0xdfe4e8, -4.3, 1.02, -5.2, P);
    [0xf2c46d, 0xb83227, 0x27ae60, 0xe67e22, 0xf4efe6].forEach((c, i) => box(0.9, 0.12, 0.6, c, -6.5 + i * 1.1, 1.1, -5.2, P));
    const CAN = [];
    [[-4.6, -2.0], [-4.6, 1.0], [1.4, 1.0]].forEach(([cx, z]) => {
      box(4.2, 0.1, 1.1, 0xc49a6c, cx, 0.82, z, P); [[-1.8, -0.4], [1.8, -0.4], [-1.8, 0.4], [1.8, 0.4]].forEach(q => box(0.1, 0.8, 0.1, 0x6e4b2a, cx + q[0], 0.4, z + q[1], P));
      box(4.2, 0.1, 0.4, 0x8b5a2b, cx, 0.48, z - 0.85, P); box(4.2, 0.1, 0.4, 0x8b5a2b, cx, 0.48, z + 0.85, P);
      for (let i = 0; i < 4; i++) { const x = cx - 1.5 + i * 1.0; CAN.push({ x, z: z - 0.85, rotY: 0, sit: true, anim: "cook" }, { x, z: z + 0.85, rotY: Math.PI, sit: true, anim: "cook" }); box(0.36, 0.06, 0.36, 0xffffff, x, 0.9, z - 0.3, P); box(0.36, 0.06, 0.36, 0xffffff, x, 0.9, z + 0.3, P); }
    });
    // 隊長的桌子（和隊長吃飯）
    const rt = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.1, 20), mat(0xa93226)); rt.position.set(2.6, 0.85, -2.4); P.add(rt);
    box(0.2, 0.8, 0.2, 0x5d3a1f, 2.6, 0.4, -2.4, P); put(P, textPlane("隊長的桌子", 1.8, 0.4, { bg: "#f1c40f", color: "#7a2a1a", size: 56 }), 2.6, 1.5, -2.4);
    CAN.push({ x: 2.6, z: -3.5, rotY: 0, sit: false, anim: "talk" }, { x: 2.6, z: -1.3, rotY: Math.PI, sit: false, anim: "talk" });
    plant(P, 7.2, -5.3); plant(P, 7.2, 2.6);
    SLOTS.canteen = CAN;
  }
  // ── v1.41 遊戲室：三台大型機台、夾娃娃機、扭蛋機、對戰桌、排行榜 ──
  {
    const P = group("gameroom");
    bldRoom(P, 16, 0x3b3456, 0x2c2440, 0x9b59b6, "door", [0x342d4d, 0x433a63]);
    put(P, textPlane("遊戲室 GAME ROOM", 5, 0.8, { bg: "#8e44ad", color: "#fff", size: 46 }), -4.5, 3.55, -5.95);
    REVB.rank = wallBoard(P, "rank", 4.4, 1.9, -6.0, 3.3, 2.27);
    const SCR = [];
    [["消消樂", 0xe74c3c], ["疊疊樂", 0x3498db], ["麵糊大作戰", 0xf39c12]].forEach(([n, c], i) => {
      const x = -6.4 + i * 2.2;
      box(1.5, 2.4, 1.1, c, x, 1.2, -5.2, P); box(1.3, 0.5, 0.2, 0x1a1a1a, x, 1.15, -4.6, P);
      const sc = put(P, new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), new THREE.MeshBasicMaterial({ color: 0x2a2f45 })), x, 1.85, -4.64);
      put(P, textPlane(n, 1.4, 0.35, { bg: "#111", color: "#ffe066", size: 60 }), x, 2.62, -4.64);
      const fx = { kind: "screen", mesh: sc, on: false }; FX.push(fx); SCR.push(fx);
    });
    // 夾娃娃機
    box(1.6, 1.0, 1.6, 0xff6fa8, 0.8, 0.5, -4.6, P);
    const cg = glassBox(1.5, 1.5, 1.5, 0xffffff, 0.22); cg.position.set(0.8, 1.75, -4.6); P.add(cg); box(1.6, 0.3, 1.6, 0xff6fa8, 0.8, 2.65, -4.6, P);
    [[0.5, -4.9, 0xf1c40f], [1.0, -4.4, 0xe74c3c], [0.6, -4.3, 0x3498db], [1.1, -4.9, 0x2ecc71]].forEach(q => box(0.3, 0.3, 0.3, q[2], q[0], 1.16, q[1], P));
    box(0.05, 0.5, 0.05, 0xcccccc, 0.8, 2.25, -4.6, P); box(0.3, 0.08, 0.3, 0xcccccc, 0.8, 1.98, -4.6, P);
    const clawSign = put(P, textPlane("夾娃娃機", 1.5, 0.3, { bg: "#ff6fa8", color: "#fff", size: 60 }), 0.8, 2.65, -3.78);
    BOARD_HIT.push({ mesh: clawSign, key: "claw" }, { mesh: cg, key: "claw" });   // v1.42 點夾娃娃機就能玩
    // 扭蛋機
    box(0.9, 0.8, 0.9, 0xc0392b, 2.6, 0.4, -5.0, P); const gb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 })); gb.position.set(2.6, 1.3, -5.0); P.add(gb);
    [[2.4, 1.2, -5.0, 0xf1c40f], [2.8, 1.25, -4.9, 0x3498db], [2.6, 1.05, -4.8, 0xe74c3c]].forEach(q => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), mat(q[3])); b.position.set(q[0], q[1], q[2]); P.add(b); });
    // v1.44 v3 拍貼機（左前方，布簾朝房間中間；點了就能拍）
    {
      const bx = -6.6, bz = 2.6;
      box(1.6, 2.5, 2.0, 0xff8fb8, bx, 1.25, bz, P); box(1.7, 0.35, 2.1, 0xc0392b, bx, 2.6, bz, P);
      const cur = box(0.04, 1.7, 1.2, 0xffe1ee, bx + 0.82, 1.15, bz + 0.2, P);
      [-0.2, 0.2, 0.6].forEach(dz => box(0.05, 1.7, 0.04, 0xffb6d0, bx + 0.84, 1.15, bz + dz, P));
      box(0.06, 0.5, 0.5, 0x2a2f45, bx + 0.83, 1.6, bz - 0.7, P);
      const sign = put(P, textPlane("📸 拍貼機", 2.2, 0.55, { bg: "#c0392b", color: "#fff", size: 64 }), bx + 0.3, 3.15, bz + 0.3, Math.PI / 4);
      BOARD_HIT.push({ mesh: sign, key: "photo" }, { mesh: cur, key: "photo" });
    }
    // 對戰桌
    box(2.0, 0.1, 1.2, 0x16a085, -2.0, 0.85, 0.4, P); box(0.3, 0.8, 0.3, 0x2c3e50, -2.0, 0.4, 0.4, P);
    put(P, textPlane("VS", 0.8, 0.5, { color: "#fff", size: 90 }), -2.0, 0.91, 0.4, 0, -Math.PI / 2);
    // 陀螺台
    const arena = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.8, 0.5, 20), mat(0x7f8c8d)); arena.position.set(3.6, 0.25, 0.6); P.add(arena);
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.25, 8), mat(0xe74c3c)); top.position.set(3.4, 0.62, 0.5); top.rotation.x = Math.PI; P.add(top); FX.push({ kind: "spin", obj: top, on: true, always: true });
    plant(P, 7.2, 2.6);
    SLOTS.gameroom = [
      { x: -6.4, z: -3.9, rotY: Math.PI, anim: "type", fx: SCR[0] }, { x: -4.2, z: -3.9, rotY: Math.PI, anim: "type", fx: SCR[1] }, { x: -2.0, z: -3.9, rotY: Math.PI, anim: "type", fx: SCR[2] },
      { x: 0.8, z: -3.3, rotY: Math.PI, anim: "type" }, { x: 2.6, z: -4.0, rotY: Math.PI, anim: "serve" },
      { x: -3.4, z: 0.4, rotY: Math.PI / 2, anim: "cheer" }, { x: -0.6, z: 0.4, rotY: -Math.PI / 2, anim: "talk" },
      { x: 3.6, z: 2.0, rotY: Math.PI, anim: "cheer" }, { x: 5.4, z: -3.8, rotY: Math.PI, anim: "stand" },
    ];
  }
  // ── v1.41 運動室：跑步機、大魔王沙包、瑜伽墊、重訓椅、伸展區 ──
  {
    const P = group("gym");
    bldRoom(P, 16, 0x9fb8c8, 0x5d7180, 0x27ae60, "door", [0x95aebe, 0xa9c2d2]);
    put(P, textPlane("運動室 · 健康最重要", 5, 0.8, { bg: "#27ae60", color: "#fff", size: 46 }), -4.5, 3.55, -5.95);
    REVB.sport = wallBoard(P, "sport", 4.4, 1.9, -6.0, 3.3, 2.27);
    const mirror = glassBox(5.0, 2.2, 0.06, 0xdff3ff, 0.5); mirror.position.set(-4.5, 1.7, -5.95); P.add(mirror);
    const G = [];
    [-6.4, -4.4].forEach(x => {   // 跑步機
      box(1.0, 0.25, 2.0, 0x2c2c34, x, 0.13, -3.6, P); box(0.8, 0.04, 1.8, 0x555555, x, 0.28, -3.6, P);
      box(0.1, 1.2, 0.1, 0x7f8c8d, x - 0.4, 0.8, -4.5, P); box(0.1, 1.2, 0.1, 0x7f8c8d, x + 0.4, 0.8, -4.5, P); box(0.9, 0.3, 0.2, 0x2c2c34, x, 1.4, -4.5, P);
      G.push({ x, z: -3.4, rotY: Math.PI, anim: "run", act: "run", y: 0.3 });
    });
    // 大魔王沙包
    box(0.1, 0.1, 1.6, 0x555555, -1.6, 3.4, -3.6, P); box(0.05, 0.6, 0.05, 0x555555, -1.6, 3.05, -3.6, P);
    const bag = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.5, 14), mat(0xc0392b)); bag.position.set(-1.6, 2.0, -3.6); P.add(bag);
    put(P, textPlane("大魔王", 0.9, 0.3, { bg: "#111", color: "#ffe066", size: 64 }), -1.6, 2.2, -3.16);
    const bagFx = { kind: "bag", bag, on: false, t: 0 }; FX.push(bagFx);
    G.push({ x: -1.6, z: -2.6, rotY: Math.PI, anim: "punch", act: "punch", fx: bagFx });
    // 瑜伽墊
    [[1.4, 0x9b59b6], [3.0, 0x1abc9c], [4.6, 0xf39c12]].forEach(([x, c]) => { box(1.0, 0.03, 1.9, c, x, 0.02, -0.8, P); G.push({ x, z: -0.8, rotY: Math.PI, sit: true, anim: "yoga", act: "yoga" }); });
    // 重訓椅＋啞鈴架
    box(0.6, 0.45, 1.6, 0x2c3e50, 1.6, 0.25, -4.2, P); box(1.8, 0.9, 0.5, 0x7f8c8d, 4.2, 0.45, -5.4, P);
    for (let i = 0; i < 5; i++) box(0.3, 0.2, 0.2, 0x2c2c34, 3.5 + i * 0.35, 0.98, -5.4, P);
    G.push({ x: 1.6, z: -3.2, rotY: Math.PI, sit: true, anim: "lift", act: "lift" }, { x: 4.2, z: -4.6, rotY: Math.PI, anim: "lift", act: "lift" });
    // 伸展區
    put(P, textPlane("伸展區 STRETCH", 4, 1), -4.0, 0.03, 0.8, 0, -Math.PI / 2);
    [-5.6, -4.0, -2.4].forEach(x => G.push({ x, z: 0.8, rotY: Math.PI / 4, anim: "stretch", act: "stretch" }));
    plant(P, 7.2, 2.6);
    SLOTS.gym = G;
  }
  // ── v1.42 學習室：課程與證照公告、證照榮譽牆、白板、讀書桌、SOP 教學螢幕 ──
  {
    const P = group("study");
    bldRoom(P, 16, 0xe6dccb, 0x6e5a48, 0x2e86c1, "door", [0xddd2bf, 0xece3d3]);
    put(P, textPlane("學習室 · 一起變更強", 5, 0.8, { bg: "#2e86c1", color: "#fff", size: 46 }), -4.5, 3.55, -5.95);
    REVB.cert = wallBoard(P, "cert", 4.4, 1.9, -6.0, 3.3, 2.27);
    box(3.6, 2.0, 0.08, 0xffffff, -4.6, 1.9, -5.92, P); box(3.7, 0.08, 0.2, 0x95a5a6, -4.6, 0.86, -5.85, P);
    put(P, textPlane("烘焙・中餐・衛生・管理", 3.3, 0.5, { color: "#2e6da4", size: 54 }), -4.6, 2.4, -5.86);
    put(P, textPlane("證照考取 → 學費補 50%", 3.3, 0.45, { color: "#c0392b", size: 50 }), -4.6, 1.7, -5.86);
    shelf(P, 7.3, -2.5, -Math.PI / 2, "book"); shelf(P, 7.3, 0.5, -Math.PI / 2, "book");
    const ST = [];
    [[-4.6, -2.4], [-1.4, -2.4], [-4.6, 0.4], [-1.4, 0.4]].forEach(([x, z]) => {
      box(2.2, 0.1, 1.0, 0xc49a6c, x, 0.85, z, P); [[-1, -0.4], [1, -0.4], [-1, 0.4], [1, 0.4]].forEach(q => box(0.08, 0.82, 0.08, 0x6e4b2a, x + q[0], 0.41, z + q[1], P));
      box(0.5, 0.08, 0.36, [0xe74c3c, 0x3498db, 0x27ae60][ST.length % 3], x - 0.5, 0.94, z, P); box(0.36, 0.05, 0.26, 0xffffff, x + 0.4, 0.92, z, P);
      [-0.5, 0.5].forEach(dx => { box(0.6, 0.1, 0.55, 0x34495e, x + dx, 0.55, z + 0.85, P); ST.push({ x: x + dx, z: z + 0.85, rotY: Math.PI, sit: true, anim: "type" }); });
    });
    // SOP 教學螢幕
    box(2.4, 1.4, 0.12, 0x1b2631, 2.6, 2.0, -5.9, P);
    put(P, textPlane("▶ SOP 教學", 2.2, 1.2, { bg: "#2c3e50", color: "#ffe066", size: 70 }), 2.6, 2.0, -5.83);
    plant(P, 7.2, 2.6); plant(P, -7.3, 2.6);
    SLOTS.study = ST;
  }
  // ── v1.44 隊長室：大辦公桌、旗幟、獎盃櫃、沙發、門口「敲門留言」──
  {
    const P = group("captain");
    bldRoom(P, 16, 0x8b5a2b, 0x5d3a1f, 0xf1c40f, "door", [0x7d4f26, 0x96633a]);
    put(P, textPlane("隊長室", 4, 0.9, { bg: "#c0392b", color: "#ffd700", size: 64 }), -1, 3.5, -5.95);
    // 大辦公桌＋大椅子
    box(3.6, 0.14, 1.6, 0x4a2c1a, 0, 1.0, -3.2, P); box(3.6, 0.9, 0.1, 0x3a2010, 0, 0.5, -2.45, P); box(0.1, 0.9, 1.6, 0x3a2010, -1.75, 0.5, -3.2, P); box(0.1, 0.9, 1.6, 0x3a2010, 1.75, 0.5, -3.2, P);
    box(1.0, 0.7, 0.08, 0x2c2c34, 0.6, 1.45, -3.6, P); box(0.36, 0.3, 0.3, 0xf1c40f, -1.2, 1.22, -3.2, P);
    box(1.0, 0.14, 0.9, 0xc0392b, 0, 0.62, -4.4, P); box(1.0, 1.5, 0.14, 0xc0392b, 0, 1.3, -4.85, P); box(1.1, 0.12, 0.2, 0xf1c40f, 0, 2.08, -4.85, P);
    // 旗幟、獎盃櫃
    box(0.06, 2.6, 0.06, 0x999999, -3.2, 1.3, -5.4, P); put(P, textPlane("紅玉滿", 1.2, 0.8, { bg: "#c0392b", color: "#fff", size: 80 }), -2.55, 2.2, -5.4);
    box(2.4, 2.4, 0.6, 0x5d3a1f, 4.6, 1.2, -5.5, P); [0.7, 1.4, 2.1].forEach(y => box(2.2, 0.06, 0.5, 0x8b5a2b, 4.6, y, -5.45, P));
    [[3.9, 0.95], [4.6, 0.95], [5.3, 0.95], [4.2, 1.65], [5.0, 1.65]].forEach(q => box(0.26, 0.32, 0.26, 0xf1c40f, q[0], q[1], -5.4, P));
    // 會客沙發
    box(3.0, 0.45, 0.9, 0x6e2c00, -4.6, 0.3, 0.8, P); box(3.0, 0.8, 0.3, 0x6e2c00, -4.6, 0.7, 0.35, P); box(1.4, 0.4, 0.8, 0x4a2c1a, -4.6, 0.2, 2.0, P);
    // 門口敲門牌
    const knock = put(P, textPlane("🚪 敲門留言給隊長", 3.2, 0.6, { bg: "#fff3e0", color: "#7a2a1a", size: 56 }), -7.7, 1.8, 3.0, Math.PI / 2);
    BOARD_HIT.push({ mesh: knock, key: "knock" });
    plant(P, 7.2, 2.6); plant(P, -7.3, -5.3);
    SLOTS.captain = [
      { x: 0, z: -4.2, rotY: 0, sit: true, anim: "type" },
      { x: -5.4, z: 0.8, rotY: 0, sit: true, anim: "sit" }, { x: -3.8, z: 0.8, rotY: 0, sit: true, anim: "sit" },
      { x: -0.8, z: -1.6, rotY: Math.PI, anim: "talk" }, { x: 0.8, z: -1.6, rotY: Math.PI, anim: "stand" },
    ];
  }
  // 會議桌和大廳共用辦公區的座標系
  SLOTS.meet = SLOTS.meet || [];

  // ── v1.30 進場特效：打卡上班 30 分鐘內第一次出現在宇宙時播放 ──
  const fresh = p => p && p.inTime && Date.now() - Date.parse(p.inTime) < 30 * 60e3;
  const ENTRY = [];
  function burst(cx, cy, cz, col, n = 26, down) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: col, transparent: true }));
      m.position.set(cx, cy, cz); const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2, sp = down ? 0.6 : 2.5 + Math.random() * 1.5;
      m.userData = { v: down ? new THREE.Vector3(Math.cos(a) * sp, -1.2 - Math.random(), Math.sin(a) * sp) : new THREE.Vector3(Math.cos(a) * Math.cos(b) * sp, Math.sin(b) * sp + 1, Math.sin(a) * Math.cos(b) * sp), life: 1.4 };
      scene.add(m); SPARKS.push(m);
    }
  }
  function rideTrex() {
    const g = new THREE.Group(), R = 0xd94a3a, D = 0xa8322a; scene.add(g);
    box(0.9, 0.6, 1.4, R, 0, 0.75, 0, g); box(0.7, 0.6, 0.7, R, 0, 1.15, 0.85, g); box(0.6, 0.15, 0.5, 0xffe6c7, 0, 0.92, 1.1, g);
    [-0.2, 0.2].forEach(sx => { box(0.12, 0.12, 0.03, 0xffffff, sx, 1.3, 1.21, g); box(0.06, 0.06, 0.03, 0x222222, sx, 1.3, 1.23, g); });
    box(0.3, 0.3, 0.6, R, 0, 0.75, -0.95, g); box(0.18, 0.18, 0.4, R, 0, 0.7, -1.4, g);
    const legs = [-0.28, 0.28].map(sx => { const l = new THREE.Group(); l.position.set(sx, 0.55, 0.1); g.add(l); box(0.24, 0.55, 0.3, D, 0, -0.27, 0, l); return l; });
    return { g, legs, t: 0 };
  }
  // ── v1.40 坐騎：走路時騎著，休息時停在旁邊 ──
  function wheel(g, r, x, y, z, list) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.14, 12), mat(0x222222)); w.rotation.z = Math.PI / 2; w.position.set(x, y, z); g.add(w);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.45, 0.16, 8), mat(0xbbbbbb)); hub.rotation.z = Math.PI / 2; hub.position.set(x, y, z); g.add(hub);
    list.push(w); return w;
  }
  function legOf(g, x, y, z, w, h, c, list) { const l = new THREE.Group(); l.position.set(x, y, z); g.add(l); box(w, h, w * 1.1, c, 0, -h / 2, 0, l); list.push(l); return l; }
  function mountModel(id) {
    const g = new THREE.Group(); scene.add(g);
    const legs = [], wheels = []; let h = 0.45;
    switch (id) {
      case "bike":
        wheel(g, 0.34, 0, 0.34, 0.6, wheels); wheel(g, 0.34, 0, 0.34, -0.6, wheels);
        box(0.08, 0.08, 1.1, 0xc0392b, 0, 0.62, 0, g); box(0.08, 0.5, 0.08, 0xc0392b, 0, 0.5, 0.45, g); box(0.5, 0.06, 0.06, 0x333333, 0, 0.82, 0.5, g); box(0.26, 0.08, 0.36, 0x333333, 0, 0.72, -0.2, g);
        h = 0.42; break;
      case "scooter":
        wheel(g, 0.24, 0, 0.24, 0.62, wheels); wheel(g, 0.24, 0, 0.24, -0.62, wheels);
        box(0.5, 0.12, 1.1, 0xf4f1ec, 0, 0.32, 0, g); box(0.55, 0.5, 0.55, 0xc0392b, 0, 0.6, -0.4, g); box(0.42, 0.12, 0.6, 0x333333, 0, 0.9, -0.35, g);
        box(0.12, 0.8, 0.12, 0xf4f1ec, 0, 0.75, 0.55, g); box(0.6, 0.06, 0.06, 0x333333, 0, 1.15, 0.55, g);
        h = 0.48; break;
      case "car": case "suv": case "sports": case "truck": {
        const col = { car: 0xc0392b, suv: 0x1e8449, sports: 0xf1c40f, truck: 0x2e6da4 }[id], tall = id === "suv" ? 0.62 : id === "sports" ? 0.36 : 0.48, len = id === "truck" ? 2.3 : 1.8;
        [0.62, -0.62].forEach(z => [-0.55, 0.55].forEach(x => wheel(g, 0.24, x, 0.24, z * (len / 1.8), wheels)));
        box(1.1, tall, len, col, 0, 0.24 + tall / 2, 0, g);
        if (id === "truck") { box(1.1, 0.75, 0.9, 0xf4f1ec, 0, 0.62 + 0.4, -0.65, g); box(1.12, 0.06, 0.92, col, 0, 1.4, -0.65, g); }
        box(0.9, 0.06, 0.04, 0x9fd3f0, 0, 0.3 + tall, len / 2 - 0.55, g);
        box(0.2, 0.12, 0.04, 0xfff3b0, -0.35, 0.3 + tall / 2, len / 2 + 0.01, g); box(0.2, 0.12, 0.04, 0xfff3b0, 0.35, 0.3 + tall / 2, len / 2 + 0.01, g);
        if (id === "sports") box(1.0, 0.06, 0.25, 0x222222, 0, 0.75, -len / 2 + 0.1, g);
        h = id === "sports" ? 0.12 : 0.22; break;
      }
      case "trex": { const t = rideTrex(); scene.remove(t.g); g.add(t.g); legs.push(...t.legs); h = 0.72; break; }
      case "train":
        [0.5, 0, -0.5].forEach(z => [-0.42, 0.42].forEach(x => wheel(g, 0.2, x, 0.2, z, wheels)));
        box(0.9, 0.3, 1.6, 0x222222, 0, 0.35, 0, g);
        { const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.9, 14), mat(0xc0392b)); boiler.rotation.x = Math.PI / 2; boiler.position.set(0, 0.78, 0.35); g.add(boiler); }
        box(0.18, 0.4, 0.18, 0x222222, 0, 1.25, 0.6, g); box(0.95, 0.75, 0.6, 0xc0392b, 0, 0.85, -0.5, g); box(1.0, 0.08, 0.66, 0xf1c40f, 0, 1.24, -0.5, g);
        h = 0.62; break;
      case "digger":
        box(1.0, 0.3, 1.5, 0x333333, 0, 0.15, 0, g); box(0.95, 0.6, 1.0, 0xf1c40f, 0, 0.6, -0.15, g); box(0.6, 0.55, 0.5, 0xf1c40f, 0.15, 1.15, -0.3, g);
        { const arm = new THREE.Group(); arm.position.set(-0.3, 0.8, 0.35); g.add(arm); box(0.14, 0.14, 1.0, 0xe67e22, 0, 0.25, 0.45, arm).rotation.x = -0.5; box(0.45, 0.3, 0.3, 0x555555, 0, 0.0, 1.0, arm); legs.push(arm); }
        h = 0.62; break;
      case "trike":
        box(0.9, 0.7, 1.4, 0x58b368, 0, 0.85, 0, g); box(0.7, 0.5, 0.6, 0x58b368, 0, 0.95, 0.9, g); box(1.2, 0.9, 0.12, 0x3f8f50, 0, 1.25, 0.6, g);
        [[-0.22, 1.25, 1.2], [0.22, 1.25, 1.2], [0, 1.05, 1.25]].forEach(q => { const hr = box(0.1, 0.1, 0.4, 0xf4efe6, q[0], q[1], q[2], g); hr.rotation.x = -0.4; });
        [-0.2, 0.2].forEach(x => box(0.08, 0.08, 0.03, 0x222222, x, 1.05, 1.2, g));
        box(0.3, 0.3, 0.5, 0x58b368, 0, 0.75, -0.9, g);
        [[-0.3, 0.45], [0.3, 0.45], [-0.3, -0.45], [0.3, -0.45]].forEach(q => legOf(g, q[0], 0.55, q[1], 0.25, 0.55, 0x3f8f50, legs));
        h = 0.9; break;
      case "bird":   // 赤心大鳥（原創：紅玉滿配色的大鳥）
        box(0.8, 0.7, 1.0, 0xc0392b, 0, 1.15, 0, g); box(0.62, 0.5, 0.06, 0xffe6c7, 0, 1.1, 0.5, g);
        box(0.3, 0.6, 0.3, 0xc0392b, 0, 1.6, 0.45, g); box(0.42, 0.4, 0.45, 0xc0392b, 0, 1.95, 0.55, g); box(0.2, 0.12, 0.3, 0xf1c40f, 0, 1.92, 0.88, g);
        [-0.12, 0.12].forEach(x => box(0.07, 0.07, 0.03, 0x222222, x, 2.02, 0.78, g)); box(0.12, 0.3, 0.12, 0xf1c40f, 0, 2.25, 0.5, g);
        box(0.12, 0.45, 0.6, 0xa93226, -0.45, 1.2, -0.05, g); box(0.12, 0.45, 0.6, 0xa93226, 0.45, 1.2, -0.05, g); box(0.5, 0.35, 0.3, 0xffe6c7, 0, 1.35, -0.6, g);
        legOf(g, -0.2, 0.85, 0, 0.12, 0.85, 0xe67e22, legs); legOf(g, 0.2, 0.85, 0, 0.12, 0.85, 0xe67e22, legs);
        h = 1.1; break;
      default: scene.remove(g); return null;
    }
    return { id, g, legs, wheels, h, t: 0 };
  }
  // v1.44 v3 坐騎配件（坐騎改裝店買的）：裝在任何一台坐騎上
  function mountAcc(M, acc, nm) {
    if (!acc || !acc.length) return;
    const g = M.g, bb = new THREE.Box3().setFromObject(g), top = Math.max(bb.max.y, 0.6), back = bb.min.z, wd = bb.max.x - bb.min.x, dp = bb.max.z - bb.min.z;
    const A = (M.acc = {});
    if (acc.includes("macc_gold")) { const wh = new Set(M.wheels); g.traverse(o => { if (o.isMesh && !wh.has(o)) o.material = mat(0xf1c40f); }); }
    if (acc.includes("macc_flag")) { box(0.05, 1.0, 0.05, 0x8b5a2b, wd / 2 - 0.12, top + 0.45, back + 0.15, g); A.flag = box(0.04, 0.3, 0.46, 0xc0392b, wd / 2 - 0.12, top + 0.8, back + 0.38, g); }
    if (acc.includes("macc_balloon")) {
      box(0.015, 1.0, 0.015, 0xffffff, -wd / 2 + 0.15, top + 0.5, back + 0.2, g);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mat(0xff5c8a)); b.position.set(-wd / 2 + 0.15, top + 1.15, back + 0.2); g.add(b); A.balloon = b;
    }
    if (acc.includes("macc_plate")) { const t = textPlane(String(nm || "紅玉滿").slice(0, 4), 0.62, 0.2, { bg: "#ffffff", color: "#c0392b", size: 70 }); t.position.set(0, 0.32, back - 0.02); t.rotation.y = Math.PI; g.add(t); }
    if (acc.includes("macc_neon")) { const n = new THREE.Mesh(new THREE.PlaneGeometry(wd + 0.4, dp + 0.4), new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.5 })); n.rotation.x = -Math.PI / 2; n.position.y = 0.03; g.add(n); A.neon = n; }
    if (acc.includes("macc_flame")) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 8), new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.85 })); f.rotation.x = -Math.PI / 2; f.position.set(0, 0.35, back - 0.25); g.add(f); A.flame = f; }
    if (acc.includes("macc_wings")) { A.wings = [-1, 1].map(sd => { const w = new THREE.Group(); w.position.set(sd * (wd / 2 + 0.02), top - 0.1, 0); g.add(w); box(0.5, 0.06, 0.7, 0xffffff, sd * 0.25, 0, 0, w); return w; }); }
    if (acc.includes("macc_star")) { A.stars = [0, 1, 2, 3, 4].map(i => { const st = box(0.12, 0.12, 0.12, 0xffe066, 0, top + 0.3, 0, g); st.userData.i = i; return st; }); A.top = top; }
  }
  function tickAcc(M, walking) {
    const A = M.acc; if (!A) return; const t = M.t;
    if (A.balloon) A.balloon.position.x += (Math.sin(t * 2) * 0.002);
    if (A.flag) A.flag.rotation.y = Math.sin(t * 6) * 0.25;
    if (A.neon) A.neon.material.opacity = 0.35 + Math.sin(t * 4) * 0.15;
    if (A.flame) { A.flame.visible = walking; A.flame.scale.setScalar(0.8 + Math.random() * 0.4); }
    if (A.wings) A.wings.forEach((w, i) => (w.rotation.z = (i ? -1 : 1) * (walking ? Math.sin(t * 12) * 0.5 : 0.15)));
    if (A.stars) A.stars.forEach(st => { const a = t * 2 + st.userData.i * 1.257; st.position.set(Math.cos(a) * 0.8, A.top + 0.3 + Math.sin(t * 3 + st.userData.i) * 0.15, Math.sin(a) * 0.8); st.rotation.y = t * 3; });
  }
  function syncMounts() {
    const want = GAME.mounts || {}, acc = GAME.macc || {};
    for (const [id, m] of crew) {
      const w = m.leaving ? "" : want[id] || "", key = w ? w + "|" + (acc[id] || []).join(",") : "";
      if (m.mount && m.mount.key !== key) { scene.remove(m.mount.g); m.mount = null; m.c.rideY = 0; }
      if (w && !m.mount) { m.mount = mountModel(w); if (m.mount) { m.mount.key = key; mountAcc(m.mount, acc[id], m.p && m.p.name); } }
    }
  }
  function tickMount(m, dt) {
    const M = m.mount; if (!M) return;
    const c = m.c, p = c.g.position;
    if (ENTRY.some(e => e.m === m && e.mount)) { M.g.visible = false; return; }
    const walking = c.anim === "walk" && c.path.length > 0;
    M.t += dt;
    tickAcc(M, walking);
    if (walking) {
      M.g.visible = c.g.visible; M.g.position.set(p.x, 0, p.z); M.g.rotation.y = c.g.rotation.y; c.rideY = M.h;
      M.legs.forEach((l, j) => (l.rotation.x = Math.sin(M.t * 10 + j * Math.PI) * 0.5));
      M.wheels.forEach(w => (w.rotation.x += dt * 8));
    } else {
      c.rideY = 0; M.legs.forEach(l => (l.rotation.x = 0));
      // 休息區、沙發區：停在旁邊；工作中：收起來
      const park = m.p.resting || m.scene === "seats";
      M.g.visible = park && c.g.visible;
      if (park) { const a = c.g.rotation.y; M.g.position.set(p.x + Math.sin(a) * 1.35, 0, p.z + Math.cos(a) * 1.35); M.g.rotation.y = a; }   // 停在面前，朝同一個方向（不會跟隔壁座位的坐騎疊在一起）
    }
  }
  // v1.40 營業額里程碑：在那個場景放一陣煙火
  const CELE = [];
  function celebrate(k) { if (SCENES[k]) CELE.push({ k, t: 0, clock: 0 }); }
  function tickCele(dt) {
    for (let i = CELE.length - 1; i >= 0; i--) {
      const e = CELE[i]; e.t += dt; e.clock -= dt;
      if (e.clock <= 0) { e.clock = 0.45; burst(SCENES[e.k].x + (Math.random() * 10 - 5), 5.5 + Math.random() * 2, -2 + Math.random() * 3, [0xff5e5e, 0xffd166, 0x6ee7b7, 0x7cc4ff, 0xf9a8d4][Math.floor(Math.random() * 5)]); }
      if (e.t > 5) CELE.splice(i, 1);
    }
  }
  function playEntry(m) {
    const kind = (GAME.fx || {})[String(m.p.id)]; if (!kind || m.fxDone) return;
    m.fxDone = true;
    const label = { fx_firework: "🎆 煙火進場！", fx_rainbow: "🌈 彩虹進場！", fx_stars: "🌠 星星雨進場！", fx_trex: "🦖 騎小暴龍上班！" }[kind] || "✨";
    setTimeout(() => say(m.c, label, 2600), 300);
    const e = { m, kind, t: 0, dur: kind === "fx_trex" ? 30 : kind === "fx_rainbow" ? 5 : 3.2, clock: 0 };
    if (kind === "fx_trex") { e.mount = rideTrex(); m.c.rideY = 0.72; }
    if (kind === "fx_rainbow") {
      e.g = new THREE.Group(); scene.add(e.g);
      [0xe74c3c, 0xe67e22, 0xf1c40f, 0x2ecc71, 0x3498db, 0x5b2c83, 0x9b59b6].forEach((c, i) => {
        const r = 1.6 - i * 0.14;
        for (let a = 0; a <= 12; a++) { const th = Math.PI * a / 12, b = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9 })); b.position.set(Math.cos(th) * r, Math.sin(th) * r + 2.6, 0); e.g.add(b); }
      });
    }
    ENTRY.push(e);
  }
  function tickEntry(dt) {
    for (let i = ENTRY.length - 1; i >= 0; i--) {
      const e = ENTRY[i], c = e.m.c, p = c.g.position; e.t += dt; e.clock -= dt;
      const gone = !crew.has(String(e.m.p.id)) || e.m.leaving;
      if (e.kind === "fx_firework" && e.clock <= 0 && e.t < e.dur) { e.clock = 0.55; burst(p.x + (Math.random() - 0.5) * 2, 3.6 + Math.random(), p.z + (Math.random() - 0.5) * 1.5, [0xff5e5e, 0xffd166, 0x6ee7b7, 0x7cc4ff, 0xf9a8d4][Math.floor(Math.random() * 5)]); }
      if (e.kind === "fx_stars" && e.clock <= 0 && e.t < e.dur) { e.clock = 0.18; burst(p.x + (Math.random() - 0.5) * 1.6, 4.2, p.z + (Math.random() - 0.5) * 1.2, Math.random() < 0.6 ? 0xffe066 : 0xffffff, 5, true); }
      if (e.g) { e.g.position.set(p.x, 0, p.z); e.g.rotation.y = c.g.rotation.y + Math.PI / 2; const k = Math.max(0, Math.min(1, (e.dur - e.t) / 1.2)); e.g.children.forEach(b => (b.material.opacity = 0.9 * k)); }
      if (e.mount) {
        e.mount.g.position.set(p.x, 0, p.z); e.mount.g.rotation.y = c.g.rotation.y; e.mount.t += dt;
        const walking = c.anim === "walk"; e.mount.legs.forEach((l, j) => (l.rotation.x = walking ? Math.sin(e.mount.t * 10 + j * Math.PI) * 0.6 : 0));
        e.mount.g.visible = c.g.visible;
        if (e.m.arrived && !e.arr) e.arr = e.t;
        if (e.arr != null && e.t - e.arr > 1.2) e.t = e.dur;
      }
      if (e.t >= e.dur || gone) {
        if (e.g) scene.remove(e.g);
        if (e.mount) { scene.remove(e.mount.g); c.rideY = 0; if (e.m.arrived) settle(e.m); }
        ENTRY.splice(i, 1);
      }
    }
  }
  const STALL_COLOR = { "咖啡店": 0x6f4e37, "甜點店": 0xf8a5c2, "花店": 0x58b368, "武器鋪": 0x7f8c8d, "卡片屋": 0x8e44ad, "雜貨店": 0xe67e22 };
  const STALL_ICON = { "咖啡店": "☕", "甜點店": "🧁", "花店": "💐", "武器鋪": "⚔️", "卡片屋": "🃏", "雜貨店": "🧸" };
  function syncShops(list) {
    while (streetStalls.children.length) streetStalls.remove(streetStalls.children[0]);
    (list || []).slice(0, 8).forEach((sh, i) => {
      const x = -5.6 + (i % 4) * 3.7, z = i < 4 ? -3.6 : 1.2, col = STALL_COLOR[sh.type] || 0xc0392b, g = new THREE.Group(); g.position.set(x, 0, z); streetStalls.add(g);
      box(2.6, 1.0, 1.0, 0xfff3e0, 0, 0.5, 0, g); box(2.7, 0.08, 1.1, col, 0, 1.04, 0, g);
      [-1.2, 1.2].forEach(px => box(0.1, 2.2, 0.1, 0x6e4b2a, px, 1.1, -0.45, g));
      for (let k = 0; k < 5; k++) box(0.55, 0.12, 1.4, k % 2 ? col : 0xffffff, -1.1 + k * 0.55, 2.25, 0.05, g);
      put(g, textPlane((STALL_ICON[sh.type] || "") + " " + sh.name, 2.6, 0.55, { bg: "#fffaf2", color: "#2b1d14", size: 52 }), 0, 1.65, -0.38);
      put(g, textPlane("店主 " + sh.ownerName + (sh.level > 1 ? " ・Lv." + sh.level : ""), 2.4, 0.4, { color: "rgba(255,255,255,.9)", bg: "rgba(0,0,0,.35)", size: 40 }), 0, 0.55, 0.52);
      for (let k = 0; k < sh.level + 1; k++) box(0.22, 0.22, 0.22, [0xf1c40f, 0xe74c3c, 0x3498db][k % 3], -0.8 + k * 0.4, 1.19, 0.1, g);
    });
    if (!(list || []).length) put(streetStalls, textPlane("累計工時 1080 小時就能來這裡開店", 8, 0.8, { color: "rgba(60,40,20,.55)", size: 44 }), 0, 0.05, 0, 0, -Math.PI / 2);
  }
  syncShops([]);

  const boss = makeChar({ shirt: 0x2c3e50, pants: 0x1b2631, hair: 0x222222, cap: 0xc0392b });
  boss.g.position.set(0.6, 0, 4.6); boss.g.rotation.y = -Math.PI / 4; boss.bubble.classList.add("uo-boss");
  nameTag(boss, "隊長");

  // v1.19:名牌上方常駐顯示「頭頂的一句話」;沒上班的人名字前加 💤
  function nameTag(c, name, opt) {
    opt = opt || {};
    const w = document.createElement("div"); w.className = "uo-tagw";
    if (opt.saying) { const sy = document.createElement("div"); sy.className = "uo-say"; sy.textContent = opt.saying; w.appendChild(sy); }
    if (opt.title) { const ti = document.createElement("div"); ti.className = "uo-title"; ti.textContent = "「" + opt.title + "」"; w.appendChild(ti); }   // v1.30 稱號
    const t = document.createElement("div");
    t.className = "uo-tag" + (opt.frame ? " uo-" + opt.frame : "") + (opt.rest ? " uo-rest" : "");
    t.textContent = (opt.rest ? "💤 " : "") + name + (opt.icons && opt.icons.length ? " " + opt.icons.join("") : "");
    w.appendChild(t); overlay.appendChild(w); c.tagEl = w; c.hasSay = !!opt.saying; c.restTag = !!opt.rest;
  }
  const timers = new WeakMap();
  function say(c, txt, ms) {
    c.bubble.textContent = txt; c.bubble.style.opacity = 1; clearTimeout(timers.get(c));
    if (ms) timers.set(c, setTimeout(() => (c.bubble.style.opacity = 0), ms));
  }

  // ── 隊員管理 ──
  const crew = new Map(); // id → { p, c, scene, slot, leaving }
  const occupied = {}; SCENE_KEYS.forEach(k => (occupied[k] = new Set()));

  const BOSS_SLOT = 6, RESERVED = new Set([6]);
  function freeSlot(k, p) {
    const list = SLOTS[k];
    if (k === "seats") {   // v1.41 休息區：自己的座位 → 固定的公用座位（依員工編號）→ 其他空位
      if (p && SEAT_IDX[String(p.id)] != null) return SEAT_IDX[String(p.id)];
      const n = list.length - 12, st = p ? hash(String(p.id)) % n : 0;
      for (let j = 0; j < n; j++) { const i = 12 + (st + j) % n; if (list[i] && !occupied.seats.has(i)) return i; }
      let i = list.length; while (occupied.seats.has(i)) i++; return i;
    }
    if (k === "gym" && p && p.act) { for (let i = 0; i < list.length; i++) if (list[i].act === p.act && !occupied.gym.has(i)) return i; }
    if (p && p.isBoss && k === "office" && !occupied.office.has(BOSS_SLOT)) return BOSS_SLOT;
    if (k === "canteen" && p && (p.meal || p.bday)) { const r = p.meal ? [24, 25] : [16, 17, 18, 19, 20, 21, 22, 23]; for (const i of r) if (!occupied.canteen.has(i)) return i; }
    for (let i = 0; i < list.length; i++) if (!occupied[k].has(i) && !(k === "office" && RESERVED.has(i))) return i;
    let i = list.length; while (occupied[k].has(i)) i++; return i;
  }
  function slotPos(k, i) {
    const list = SLOTS[k];
    if (i < list.length) return list[i];
    const n = i - list.length; // 人太多時，在後方排一排
    if (SCENES[k].bld) return { x: -5 + (n % 10) * 1.1, z: 5.2 - Math.floor(n / 10) * 0.8, rotY: Math.PI, anim: "stand" };   // v1.41 大樓：人太多時站在走廊
    const z = SCENES[k].store ? -3.3 - Math.floor(n / 5) * 0.9 : 4.2 + Math.floor(n / 5) * 0.9;
    return { x: 3 + (n % 5) * 1.0, z, rotY: SCENES[k].store ? 0 : Math.PI, anim: "stand" };
  }
  function worldX(k, x) { return SCENES[k].x + x; }

  function route(m, toScene, toSlot, cb) {
    const c = m.c, p = c.g.position;
    c.sit = false; c.anim = "walk"; m.arrived = false;
    const back = [];
    // v1.30 走到一半又換目的地時，以實際所在的場景為準（例：剛從辦公室出發要去座位區）
    c.baseY = 0;
    const halfW = k => (SCENES[k].w || 16) / 2;
    const here = !m.scene ? null : Math.abs(p.x - SCENES[m.scene].x) < halfW(m.scene) + 2 ? m.scene : (SCENE_KEYS.find(k => !SCENES[k].virtual && Math.abs(p.x - SCENES[k].x) < halfW(k) + 2) || m.scene);
    if (m.slot != null && m.scene && here === m.scene) { const s = slotPos(m.scene, m.slot); if (s.via) for (let i = s.via.length - 1; i >= 0; i--) back.push({ x: worldX(m.scene, s.via[i].x), z: s.via[i].z }); }
    const intoPath = (k, s) => {
      const a = SCENES[k].aisle, pts = [];
      if (s.via) { pts.push({ x: worldX(k, s.via[0].x), z: a }); s.via.forEach(v => pts.push({ x: worldX(k, v.x), z: v.z })); }
      else pts.push({ x: worldX(k, s.x), z: a });
      pts.push({ x: worldX(k, s.x), z: s.z }); return pts;
    };
    const cur = here;
    if (cur === toScene || (cur && toScene && tabOf(cur) === tabOf(toScene))) {   // v1.44 大樓房間改成像櫃位一樣切換（只有會議桌和辦公區同一間）
      const s = slotPos(toScene, toSlot);
      c.path = [...back, { x: (back.length ? back[back.length - 1].x : p.x), z: SCENES[cur].aisle }, ...intoPath(toScene, s)];
      c.onArrive = cb;
    } else {
      const exitPts = cur ? [...back, { x: (back.length ? back[back.length - 1].x : p.x), z: SCENES[cur].aisle }, { x: SCENES[cur].x + halfW(cur) + 0.2, z: SCENES[cur].aisle }] : [];
      const enter = () => {
        if (!toScene) { cb && cb(); return; }
        p.set(SCENES[toScene].x + (SCENES[toScene].bld ? halfW(toScene) - 0.6 : 8.2), 0, SCENES[toScene].aisle);
        c.path = intoPath(toScene, slotPos(toScene, toSlot)); c.onArrive = cb;
      };
      if (exitPts.length) { c.path = exitPts; c.onArrive = enter; } else enter();
    }
  }
  function settle(m) {
    const s = slotPos(m.scene, m.slot);
    m.c.g.rotation.y = s.rotY; m.c.sit = !!s.sit; m.c.anim = s.anim; m.arrived = true;
    m.c.baseY = s.y || (s.hi ? 0.25 : s.low ? -0.2 : 0);   // v1.41 跑步機、吧檯椅、懶骨頭的高度
  }

  let lastList = [];
  // ── 遊戲化資料(setGame 傳入)──
  let GAME = { pets: {}, worn: {}, birthdays: [], champion: "", fireworks: false, unlocks: [], holiday: "", weather: {} };
  const tagOpt = (p, av) => ({ frame: av.frame && av.frame !== "none" ? av.frame : "", icons: GAME.worn[String(p.id)] || [], saying: av.saying || "", rest: !!p.resting, title: (GAME.titles || {})[String(p.id)] || "" });
  const sigOf = (p, av) => JSON.stringify(av) + (p.resting ? "R" : "") + ((GAME.titles || {})[String(p.id)] || "") + auraKind(p);
  // v1.36 無敵8心：8 顆心都點亮 → 腳下粉紅光環；8 顆都到金 → 金色光環
  function auraKind(p) { const h = (GAME.hearts || {})[String(p.id)]; return h && h.n >= 8 ? (h.g >= 8 ? "L" : "H") : ""; }
  function addAura(c, p) {
    const k = auraKind(p); if (!k) return;
    const col = k === "L" ? 0xffd34d : 0xff6f9c, g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.72, 40), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; g.add(ring);
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 2.2, 28, 1, true), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }));
    glow.position.y = 1.1; g.add(glow);
    c.g.add(g); c.aura = { ring, glow, t: Math.random() * 6 };
  }
  function avatarOf(p) {
    const av = Object.assign({}, avatarFor(p));
    if (GAME.birthdays.some(b => String(b.id) === String(p.id)) && (!av.hat || av.hat === "none")) av.hat = "party";
    av._icons = (GAME.worn[String(p.id)] || []).join("");
    return av;
  }
  function rebuildChar(m, av) {
    const old = m.c, c = buildChar(av);
    c.g.position.copy(old.g.position); c.g.rotation.y = old.g.rotation.y;
    c.path = old.path; c.onArrive = old.onArrive; c.anim = old.anim; c.sit = old.sit; c.t = old.t;
    scene.remove(old.g); old.bubble.remove(); old.tagEl && old.tagEl.remove();
    addAura(c, m.p);
    nameTag(c, m.p.name, tagOpt(m.p, av)); m.c = c;
  }
  function setCrew(list) {
    lastList = list; drawAttend(list);
    const ids = new Set(list.map(p => String(p.id)));
    // 下班：揮手離場
    for (const [id, m] of crew) if (!ids.has(id) && !m.leaving) {
      m.leaving = true; occupied[m.scene].delete(m.slot);
      say(m.c, "下班囉，掰掰～ 👋", 2500);
      const k = m.scene; m.slot = m.slot; // 保留以便走出
      if (m.mount) { scene.remove(m.mount.g); m.mount = null; }
      route(m, null, 0, () => { scene.remove(m.c.g); m.c.bubble.remove(); m.c.tagEl.remove(); removePet(m); crew.delete(id); });
      m.scene = k;
    }
    list.forEach(p => {
      // v1.41 開會 → 會議桌；運動 → 運動室；沒上班 → 休息區（有買座位坐自己的，主管也一樣）；視察中照選的地點
      const id = String(p.id), k0 = sceneOf(p.location), k = p.meeting ? "meet" : p.act ? "gym" : (p.meal || p.bday) ? "canteen" : p.resting && !p.visiting ? "seats" : k0;   // v1.44 和隊長吃飯、壽星到飯堂
      let m = crew.get(id);
      if (m && m.leaving) return;
      const wasRest = m ? !!m.p.resting : false;
      if (m) { const av = avatarOf(p), sig = sigOf(p, av); if (sig !== m.sig) { m.p = p; rebuildChar(m, av); m.sig = sig; } }
      if (!m) {
        const av = avatarOf(p);
        const c = buildChar(av);
        addAura(c, p);
        nameTag(c, p.name, tagOpt(p, av));
        m = { p, c, sig: sigOf(p, av), scene: null, slot: null, clock: 4 + Math.random() * 6, talk: 2 + Math.random() * 6 };
        crew.set(id, m);
        const slot = freeSlot(k, p); occupied[k].add(slot);
        // 還沒有場景 → 從該場景入口走進來
        route(m, k, slot, () => { settle(m); if (p.visiting) say(m.c, p.visitLabel || "視察中 👀", 4000); else if (!p.resting && !p.isBoss) say(m.c, "上班囉！💪", 3200); });
        m.scene = k; m.slot = slot;
        if (!p.resting && !p.isBoss && fresh(p)) playEntry(m);
      } else if (m.scene !== k || wasRest !== !!p.resting || (m.p.act || "") !== (p.act || "") || !!m.p.meal !== !!p.meal || !!m.p.bday !== !!p.bday || (k === "seats" && SEAT_IDX[id] != null && m.slot !== SEAT_IDX[id])) {
        occupied[m.scene].delete(m.slot);
        const slot = freeSlot(k, p); occupied[k].add(slot);
        route(m, k, slot, () => { settle(m); if (p.meeting) say(m.c, "開會中 📋", 4000); else if (p.act) say(m.c, pick(GYM_LINES[p.act] || ["💪"]), 3000); else if (p.visiting) say(m.c, p.visitLabel || "視察中 👀", 4000); });   // v1.39 大隊長前往（v1.40 Lv.3 以上）
        m.scene = k; m.slot = slot;
      }
      m.p = p;
    });
    if (typeof syncPets === "function") syncPets();
    syncMounts();
  }

  // ── 動畫 ──
  function animChar(c, dt) {
    c.t += dt; const t = c.t; let ly = 0, aL = 0, aR = 0, zL = 0, zR = 0;
    switch (c.anim) {
      case "type": aL = -1.25 + Math.sin(t * 18) * 0.08; aR = -1.25 + Math.cos(t * 17) * 0.08; break;
      case "cook": aL = -1.1 + Math.sin(t * 4) * 0.25; aR = -1.1 - Math.sin(t * 4) * 0.25; break;
      case "serve": aL = -0.3; aR = -0.9 + Math.sin(t * 3) * 0.4; break;
      case "talk": aL = -0.3; aR = -0.6 + Math.sin(t * 6) * 0.35; break;
      case "sit": aL = aR = -0.3; break;
      case "cheer": aL = aR = -2.8 + Math.sin(t * 12) * 0.3; break;
      case "like": aL = -0.1; aR = -2.6; break;
      case "wave": aL = -0.1; aR = -2.4 + Math.sin(t * 10) * 0.4; break;
      case "punch": { const k = Math.sin(t * 9); aL = -1.5 + Math.max(0, k) * 0.2; aR = -1.5 + Math.max(0, -k) * 0.2; zL = 0.2; zR = -0.2; break; }   // v1.41 運動
      case "yoga": aL = aR = -2.9 + Math.sin(t * 1.2) * 0.12; break;
      case "lift": aL = aR = -1.6 - (Math.sin(t * 3) + 1) * 0.6; break;
      case "stretch": aL = -3.0; aR = -0.2; zL = Math.sin(t * 1.5) * 0.4; break;
      default: aL = aR = Math.sin(t * 1.5) * 0.05;
    }
    if (c.anim === "walk" || c.anim === "run") { const sp = c.anim === "run" ? 14 : 10, s = Math.sin(t * sp) * 0.6; c.legL.rotation.x = s; c.legR.rotation.x = -s; aL = -s; aR = s; }
    else if (c.sit) { c.legL.rotation.x = c.legR.rotation.x = -Math.PI / 2; ly = 0.05; }
    else c.legL.rotation.x = c.legR.rotation.x = 0;
    c.armL.rotation.x = aL; c.armR.rotation.x = aR; c.armL.rotation.z = zL; c.armR.rotation.z = zR; c.g.position.y = ly + (c.rideY || 0) + (c.baseY || 0);
    if (c.rideY) { c.legL.rotation.x = c.legR.rotation.x = -0.9; }
    c.g.rotation.x = c.anim === "nod" ? Math.max(0, Math.sin(t * 7)) * 0.18 : 0;
  }
  function stepMove(c, dt) {
    if (!c.path.length) return;
    const p = c.g.position, n = c.path[0], dx = n.x - p.x, dz = n.z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.05) { p.x = n.x; p.z = n.z; c.path.shift(); if (!c.path.length && c.onArrive) { const f = c.onArrive; c.onArrive = null; f(); } return; }
    const s = Math.min(d, c.speed * dt); p.x += dx / d * s; p.z += dz / d * s; c.g.rotation.y = Math.atan2(dx, dz);
  }
  const v = new THREE.Vector3();
  function place(c) {
    const vis = c.g.visible && (v.set(c.g.position.x, c.g.position.y + (c.hasSay ? 3.45 : 2.95), c.g.position.z).project(camera), Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.1);
    c.bubble.style.visibility = vis ? "visible" : "hidden";
    if (c.tagEl) c.tagEl.style.visibility = vis && !(c.restTag && camera.zoom < 0.75) ? "visible" : "hidden";   // v1.41 大樓全景時，休息中的人先不顯示名牌（拉近才出現）
    if (!vis) return;
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    c.bubble.style.left = ((v.x + 1) / 2 * w) + "px"; c.bubble.style.top = ((1 - v.y) / 2 * h) + "px";
    if (c.tagEl) { v.set(c.g.position.x, c.g.position.y + 2.5, c.g.position.z).project(camera); c.tagEl.style.left = ((v.x + 1) / 2 * w) + "px"; c.tagEl.style.top = ((1 - v.y) / 2 * h + 4) + "px"; }
  }

  // ── v1.21 手勢：單指（全螢幕）拖曳平移／（一般模式）左右旋轉；雙指縮放＋平移＋旋轉；滑鼠滾輪縮放；點人拉近 ──
  const ptrs = new Map(); let tap = null, pinch = null;
  const cv = renderer.domElement;
  cv.style.touchAction = "pan-y";
  function worldPerPx() { return (camera.right - camera.left) / camera.zoom / (cv.clientWidth || 1); }
  function unfollowKeep() {
    if (!follow) return;
    const m = crew.get(follow), fc = SCENES[view].focus || { x: 0, z: 0 };
    if (m) { panX = m.c.g.position.x - SCENES[view].x - (fc.x || 0); panZ = m.c.g.position.z - (fc.z || 0); }
    follow = null; opts.onPick && opts.onPick(null);
  }
  function panBy(dx, dy) {
    unfollowKeep();
    const k = worldPerPx(), rx = Math.cos(az), rz = -Math.sin(az), fx = -Math.sin(az), fz = -Math.cos(az);
    panX += -rx * dx * k + fx * dy * k / 0.625; panZ += -rz * dx * k + fz * dy * k / 0.625;
    const px = SCENES[view].pan || 14; panX = Math.max(-px, Math.min(px, panX)); panZ = Math.max(-10, Math.min(10, panZ));
  }
  const clampZ = () => (uz = Math.max(ZMIN, Math.min(ZMAX, uz)));
  const pinchOf = () => { const [a, b] = [...ptrs.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, ang: Math.atan2(b.y - a.y, b.x - a.x), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; };
  const onDown = e => {
    if (e.target !== cv) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    if (ptrs.size === 1) tap = { x: e.clientX, y: e.clientY, t: performance.now() };
    else { tap = null; if (ptrs.size === 2) pinch = pinchOf(); }
  };
  const onUp = e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (tap && e.type === "pointerup" && performance.now() - tap.t < 400 && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 10) pickAt(e.clientX, e.clientY);
    tap = null;
  };
  const onMove = e => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) >= 10) tap = null;
    if (ptrs.size === 1) {
      if (tap) return;
      if (full || (e.pointerType === "mouse" && !e.shiftKey)) panBy(dx, dy);
      else { azT = null; az -= dx * 0.008; az = Math.max(-0.2, Math.min(Math.PI / 2 + 0.2, az)); }
    } else if (ptrs.size === 2 && pinch) {
      const q = pinchOf();
      uz *= q.d / pinch.d; clampZ();
      azT = null; let da = q.ang - pinch.ang; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
      az = Math.max(-0.2, Math.min(Math.PI / 2 + 0.2, az - da));
      panBy(q.mx - pinch.mx, q.my - pinch.my);
      pinch = q;
    }
  };
  const onWheel = e => {
    if (!full && !e.ctrlKey) return;
    e.preventDefault(); uz *= Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)); clampZ();
  };
  // 點人：用射線找被點到的隊員
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  // ── v1.33 點自己 → 再點地面，小人走過去；停 60 秒後回到原本的位置 ──
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), gp = new THREE.Vector3();
  const marker = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.34, 24), new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  marker.rotation.x = -Math.PI / 2; marker.visible = false; scene.add(marker); let markerT = 0;
  function moveSelf(cx, cy, r) {
    const m = crew.get(String(opts.selfId)); if (!m || m.leaving) return;
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(ground, gp)) return;
    const bld = SCENES[m.scene].bld, sx = SCENES[m.scene].x, hw = (SCENES[m.scene].w || 16) / 2 - 0.6;
    const x = Math.max(sx - hw, Math.min(sx + hw, gp.x)), z = Math.max(-5.2, Math.min(5.2, gp.z));   // v1.44 只能在自己的房間裡走
    const c = m.c, id = (m.manualId = (m.manualId || 0) + 1);
    c.sit = false; c.anim = "walk"; m.arrived = false; c.baseY = 0;
    const roomAt = X => SCENE_KEYS.find(k => SCENES[k].bld && !SCENES[k].virtual && Math.abs(X - SCENES[k].x) <= SCENES[k].w / 2);
    // v1.41 大樓裡跨房間：先走到前方走廊，經過門口再走進去
    c.path = [{ x, z }];
    c.onArrive = () => {
      c.anim = "idle"; c.g.rotation.y = Math.atan2(sx + (SCENES[m.scene].focus ? SCENES[m.scene].focus.x || 0 : 0) - c.g.position.x, 6 - c.g.position.z);
      setTimeout(() => { if (m.manualId === id && !m.leaving && crew.get(String(opts.selfId)) === m) route(m, m.scene, m.slot, () => settle(m)); }, 180000);   // v1.39 停 3 分鐘再回工作位置
    };
    marker.position.set(x, 0.03, z); marker.visible = true; markerT = 1.2;
    opts.onPick && opts.onPick(null);   // v1.39 走動時收起名片（不擋地圖），再點自己才出現
    opts.onMove && opts.onMove();
  }
  function pickAt(cx, cy) {
    const r = cv.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const list = [...crew.values()].filter(m => !m.leaving && m.c.g.visible && tabOf(m.scene) === view);
    const hits = ray.intersectObjects(list.map(m => m.c.g), true);
    let hit = null;
    if (hits.length) { let o = hits[0].object; while (o && !hit) { hit = list.find(m => m.c.g === o) || null; o = o.parent; } }
    if (!hit) {
      // 點在名牌附近也算（小人在手機上很小）
      let best = null, bd = 34;
      list.forEach(m => { v.set(m.c.g.position.x, m.c.g.position.y + 1.2, m.c.g.position.z).project(camera); const sx = r.left + (v.x + 1) / 2 * r.width, sy = r.top + (1 - v.y) / 2 * r.height, d = Math.hypot(sx - cx, sy - cy); if (d < bd) { bd = d; best = m; } });
      hit = best;
    }
    if (hit) { focusCrew(String(hit.p.id)); return; }
    // v1.41 點看板 → 放大
    const bh = ray.intersectObjects(BOARD_HIT.filter(b => b.mesh.parent && b.mesh.parent.visible).map(b => b.mesh), false);
    if (bh.length && opts.onBoard) { const b = BOARD_HIT.find(x => x.mesh === bh[0].object); if (b) { opts.onBoard(b.key); return; } }
    if (follow && opts.selfId && follow === String(opts.selfId)) moveSelf(cx, cy, r);   // v1.33 選了自己 → 點地面走過去
    else if (follow) { follow = null; opts.onPick && opts.onPick(null); }
    else { const me = opts.selfId && crew.get(String(opts.selfId)); if (me && !me.leaving && me.scene === view) moveSelf(cx, cy, r); }   // v1.39 沒選人時，點地面就是自己走過去
  }
  function focusCrew(id) {
    const m = id && crew.get(String(id));
    if (!m) { if (follow) { follow = null; opts.onPick && opts.onPick(null); } return false; }
    if (tabOf(m.scene) !== view) { view = tabOf(m.scene); resetCam(); }
    follow = String(id);
    const fc = SCENES[view].focus || { zoom: 1 };
    uz = Math.max(uz, 2.8 / (fc.zoom || 1)); clampZ();
    opts.onPick && opts.onPick(m.p);
    return true;
  }
  function resetCam() { uz = 1; panX = panZ = 0; const fc = SCENES[view].focus || {}; azT = fc.az != null ? fc.az : Math.PI / 4; }
  cv.addEventListener("pointerdown", onDown);
  cv.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("pointerup", onUp); window.addEventListener("pointercancel", onUp); window.addEventListener("pointermove", onMove);

  // ════════ 遊戲化圖層:寵物(v1.19:5 型態 × 5 階段、會說話、會互相玩)、派對、冠軍旗、煙火、天氣、節日、基金解鎖、互動 ════════
  const PET_COL = { "原味": [0xe0a050, 0xb06a2c, 0xf5d29c], "可可": [0x8a5a3c, 0x5e3a24, 0xb8876a], "紅玉": [0xd9534f, 0xa8322e, 0xf08a80], "抹茶": [0x8bbf6a, 0x5f8f45, 0xbfe0a4], "黑糖": [0x7a4a2a, 0x4f2c16, 0xa9744f], "芝麻": [0x5b5550, 0x3a3532, 0x8d8680],
    "櫻花": [0xf4a6c0, 0xd9708f, 0xfbd3e0], "星空": [0x3b4a9c, 0x232c66, 0x8f9de0], "金色": [0xf1c40f, 0xb8860b, 0xffe680] };
  const EYE = 0x1e1e1e, WHITE = 0xffffff, CREAM = 0xf6e7c8;
  // 完全體模型(朝 +z 方向),高約 0.7~0.9;回傳頭頂高度
  function petModel(type, P, b, d, l) {
    const eyes = (x, y, z) => { box(0.05, 0.05, 0.02, EYE, -x, y, z, P); box(0.05, 0.05, 0.02, EYE, x, y, z, P); };
    if (type === "chicken") {
      box(0.05, 0.18, 0.05, 0xe67e22, -0.08, 0.09, 0, P); box(0.05, 0.18, 0.05, 0xe67e22, 0.08, 0.09, 0, P);
      box(0.4, 0.34, 0.46, b, 0, 0.35, 0, P); box(0.04, 0.18, 0.26, d, -0.22, 0.38, 0, P); box(0.04, 0.18, 0.26, d, 0.22, 0.38, 0, P);
      box(0.16, 0.24, 0.08, d, 0, 0.52, -0.26, P);
      box(0.26, 0.26, 0.26, b, 0, 0.64, 0.14, P); box(0.06, 0.1, 0.16, 0xc0392b, 0, 0.82, 0.14, P);
      box(0.08, 0.06, 0.1, 0xf2c14e, 0, 0.62, 0.31, P); box(0.04, 0.08, 0.03, 0xc0392b, 0, 0.55, 0.28, P); eyes(0.08, 0.68, 0.275); return 0.87;
    }
    if (type === "trex") {
      const tail = box(0.12, 0.12, 0.42, b, 0, 0.3, -0.34, P); tail.rotation.x = -0.35;
      box(0.12, 0.24, 0.14, d, -0.1, 0.12, 0, P); box(0.12, 0.24, 0.14, d, 0.1, 0.12, 0, P);
      box(0.34, 0.4, 0.34, b, 0, 0.44, 0, P); box(0.22, 0.28, 0.02, l, 0, 0.42, 0.175, P);
      box(0.05, 0.05, 0.12, b, -0.12, 0.5, 0.22, P); box(0.05, 0.05, 0.12, b, 0.12, 0.5, 0.22, P);
      box(0.32, 0.2, 0.38, b, 0, 0.8, 0.14, P); box(0.3, 0.07, 0.3, 0x7a2e1e, 0, 0.67, 0.2, P); box(0.3, 0.08, 0.32, b, 0, 0.6, 0.19, P);
      [-0.09, 0, 0.09].forEach(x => { box(0.03, 0.04, 0.02, WHITE, x, 0.68, 0.34, P); });
      box(0.09, 0.09, 0.02, WHITE, -0.12, 0.86, 0.33, P); box(0.09, 0.09, 0.02, WHITE, 0.12, 0.86, 0.33, P); eyes(0.12, 0.86, 0.34); return 0.92;
    }
    if (type === "digger") {
      box(0.44, 0.16, 0.56, d, 0, 0.08, 0, P); [-0.18, 0, 0.18].forEach(z => { box(0.46, 0.06, 0.06, l, 0, 0.08, z, P); });
      box(0.38, 0.08, 0.42, b, 0, 0.2, 0, P); box(0.34, 0.18, 0.12, d, 0, 0.33, -0.2, P);
      box(0.3, 0.32, 0.3, b, 0, 0.4, -0.02, P); box(0.22, 0.14, 0.02, l, 0, 0.46, 0.135, P); box(0.02, 0.12, 0.14, l, 0.16, 0.46, 0, P); box(0.02, 0.12, 0.14, l, -0.16, 0.46, 0, P);
      eyes(0.06, 0.46, 0.15);
      const boom = box(0.08, 0.08, 0.36, b, 0.08, 0.66, 0.2, P); boom.rotation.x = -0.6;
      box(0.07, 0.34, 0.07, b, 0.08, 0.6, 0.38, P);
      box(0.18, 0.12, 0.14, b, 0.08, 0.36, 0.44, P); box(0.06, 0.06, 0.02, 0xc0392b, 0.08, 0.36, 0.515, P); return 0.82;
    }
    if (type === "train") {
      box(0.34, 0.06, 0.68, d, 0, 0.14, 0, P);
      [[-0.22, 0.13], [0.02, 0.17], [0.24, 0.13]].forEach(([z, r]) => [-0.19, 0.19].forEach(x => { box(0.06, r * 2, r * 2, d, x, r, z, P); box(0.07, r * 0.8, r * 0.8, l, x, r, z, P); }));
      box(0.3, 0.08, 0.08, d, 0, 0.08, 0.38, P);
      box(0.28, 0.26, 0.4, b, 0, 0.32, 0.1, P); box(0.3, 0.3, 0.04, b, 0, 0.32, 0.31, P);
      eyes(0.07, 0.36, 0.335); box(0.12, 0.03, 0.02, 0x7a2e1e, 0, 0.27, 0.335, P);
      box(0.1, 0.18, 0.1, d, 0, 0.54, 0.22, P); box(0.14, 0.04, 0.14, d, 0, 0.64, 0.22, P);
      box(0.12, 0.08, 0.12, b, 0, 0.49, 0.06, P); box(0.12, 0.06, 0.12, b, 0, 0.48, -0.05, P);
      box(0.34, 0.4, 0.24, b, 0, 0.4, -0.2, P); box(0.38, 0.04, 0.3, d, 0, 0.62, -0.2, P);
      box(0.02, 0.12, 0.12, l, 0.175, 0.46, -0.2, P); box(0.02, 0.12, 0.12, l, -0.175, 0.46, -0.2, P); return 0.68;
    }
    if (type === "robot") {   // v1.41 機器人寵物
      box(0.12, 0.16, 0.14, d, -0.1, 0.08, 0, P); box(0.12, 0.16, 0.14, d, 0.1, 0.08, 0, P);
      box(0.36, 0.32, 0.28, b, 0, 0.32, 0, P); box(0.12, 0.1, 0.02, 0xc0392b, 0, 0.34, 0.145, P);
      box(0.08, 0.22, 0.1, d, -0.23, 0.32, 0, P); box(0.08, 0.22, 0.1, d, 0.23, 0.32, 0, P);
      box(0.4, 0.32, 0.32, b, 0, 0.66, 0, P); box(0.32, 0.22, 0.02, 0x1b2631, 0, 0.66, 0.165, P);
      const e1 = box(0.06, 0.06, 0.02, 0x5dfdcb, -0.08, 0.69, 0.18, P), e2 = box(0.06, 0.06, 0.02, 0x5dfdcb, 0.08, 0.69, 0.18, P); e1.material = e2.material = new THREE.MeshBasicMaterial({ color: 0x5dfdcb });
      box(0.03, 0.14, 0.03, d, 0, 0.88, 0, P); const bl = box(0.08, 0.08, 0.08, 0xff5a5a, 0, 0.97, 0, P); bl.material = new THREE.MeshBasicMaterial({ color: 0xff5a5a }); return 1.0;
    }
    // trice
    box(0.1, 0.1, 0.26, b, 0, 0.26, -0.38, P);
    [[-0.14, 0.18], [0.14, 0.18], [-0.14, -0.18], [0.14, -0.18]].forEach(([x, z]) => box(0.1, 0.2, 0.1, d, x, 0.1, z, P));
    box(0.38, 0.28, 0.56, b, 0, 0.32, 0, P); box(0.26, 0.04, 0.4, l, 0, 0.17, 0, P);
    [[0, 0.47, -0.15], [0, 0.47, 0.05], [0.1, 0.45, -0.05], [-0.1, 0.45, -0.05], [0, 0.46, -0.22]].forEach(([x, y, z]) => box(0.07, 0.04, 0.07, d, x, y, z, P));
    box(0.44, 0.38, 0.06, d, 0, 0.52, 0.26, P); [[-0.18, 0.68], [0, 0.72], [0.18, 0.68], [-0.22, 0.5], [0.22, 0.5]].forEach(([x, y]) => box(0.05, 0.05, 0.02, l, x, y, 0.235, P));
    box(0.26, 0.22, 0.24, b, 0, 0.38, 0.38, P); box(0.14, 0.1, 0.1, b, 0, 0.32, 0.53, P);
    const h1 = box(0.04, 0.04, 0.18, l, -0.08, 0.5, 0.5, P), h2 = box(0.04, 0.04, 0.18, l, 0.08, 0.5, 0.5, P); h1.rotation.x = h2.rotation.x = 0.4;
    box(0.04, 0.08, 0.04, l, 0, 0.42, 0.58, P); eyes(0.13, 0.42, 0.45); return 0.72;
  }
  function makePet(pt) {
    const g = new THREE.Group(); scene.add(g);
    const pal = PET_COL[pt.flavor] || PET_COL["原味"], [b, d, l] = pal, st = Math.max(1, Math.min(5, pt.stage || 1));
    const body = new THREE.Group(); g.add(body);
    let top = 0.5;
    if (st === 1 || !pt.type) {       // 蛋
      box(0.3, 0.42, 0.3, CREAM, 0, 0.23, 0, body); box(0.36, 0.3, 0.36, CREAM, 0, 0.2, 0, body); box(0.2, 0.06, 0.2, CREAM, 0, 0.46, 0, body);
      [[0.1, 0.3, 0.18], [-0.12, 0.2, 0.18], [0.18, 0.15, -0.05]].forEach(([x, y, z]) => box(0.05, 0.05, 0.02, 0xc0392b, x, y, z, body));
      top = 0.5;
    } else if (st === 2) {            // 雛形期:蛋殼裡探出小小的型態
      const inner = new THREE.Group(); body.add(inner); inner.scale.setScalar(0.5); inner.position.y = 0.12; petModel(pt.type, inner, b, d, l);
      box(0.42, 0.2, 0.42, CREAM, 0, 0.1, 0, body); [-0.14, 0, 0.14].forEach(x => box(0.08, 0.08, 0.02, CREAM, x, 0.23, 0.2, body));
      top = 0.6;
    } else {                          // 3 嬰兒(含奶嘴) 4 兒童(縮小版) 5 完全體
      const sc = [0, 0, 0, 0.6, 0.78, 1][st], inner = new THREE.Group(); body.add(inner); inner.scale.setScalar(sc);
      top = petModel(pt.type, inner, b, d, l) * sc;
      if (st === 3) { const fz = pt.type === "train" ? 0.36 : pt.type === "trice" ? 0.58 : pt.type === "digger" ? 0.16 : 0.34;
        const fy = pt.type === "trex" ? 0.66 : pt.type === "chicken" ? 0.56 : pt.type === "trice" ? 0.32 : pt.type === "digger" ? 0.4 : 0.3;
        box(0.12, 0.07, 0.03, 0xf48fb1, 0, fy * sc, fz * sc, body); box(0.05, 0.05, 0.03, 0x5dade2, 0, fy * sc - 0.02, fz * sc + 0.02, body); }
    }
    if (pt.acc === "pet_bow") { box(0.12, 0.08, 0.03, 0xc0392b, -0.06, top * 0.55, 0.2, body); box(0.12, 0.08, 0.03, 0xc0392b, 0.06, top * 0.55, 0.2, body); }
    if (pt.acc === "pet_wings") [-1, 1].forEach(k => { const w = box(0.04, 0.24, 0.2, 0xffffff, k * 0.24, top * 0.6, -0.08, body); w.rotation.z = k * 0.6; });
    if (pt.acc === "pet_crown") box(0.22, 0.1, 0.22, 0xf1c40f, 0, top + 0.05, 0, body);
    const sparks = [];
    if (st >= 5) for (let i = 0; i < 3; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: 0xffe066 })); g.add(sp); sparks.push(sp); }
    const PS = 1.7; g.scale.setScalar(PS);   // 寵物整體放大，辦公室裡才看得清楚
    const bubble = bubbleEl("uo-bubble uo-petsay");
    return { g, body, stage: st, type: pt.type, sparks, t: Math.random() * 5, sig: JSON.stringify(pt), top: top * PS, bubble, info: pt, talk: 6 + Math.random() * 10, n: 0 };
  }
  function removeTeam(m) { (m.team || []).forEach(f => { scene.remove(f.g); f.bubble.remove(); }); m.team = null; m.teamSig = ""; }
  function removePet(m) { if (m.pet) { scene.remove(m.pet.g); m.pet.bubble.remove(); m.pet = null; } removeTeam(m); }
  function syncPets() {
    for (const [id, m] of crew) {
      const pt = GAME.pets[id], sig = pt ? JSON.stringify(pt) : "";
      if (m.pet && m.pet.sig !== sig) removePet(m);
      if (pt && !m.pet && !m.leaving) { m.pet = makePet(pt); m.pet.g.position.copy(m.c.g.position); }
      // v1.28 寵物隊伍：主寵物以外的寵物排成一列跟在後面（最多 4 隻）
      const team = ((GAME.teams || {})[id] || []).slice(0, 4), tsig = JSON.stringify(team);
      if (m.teamSig !== tsig) { removeTeam(m); }
      if (m.pet && !m.team && team.length && !m.leaving) {
        m.team = team.map(tp => { const f = makePet(tp); f.g.scale.multiplyScalar(0.8); f.top *= 0.8; f.g.position.copy(m.c.g.position); return f; });
        m.teamSig = tsig;
      }
    }
  }
  function tickTeam(m, dt) {
    if (!m.team || !m.pet) return;
    let lead = m.pet.g.position;
    m.team.forEach((f, i) => {
      f.t += dt;
      const p = f.g.position, dx = lead.x - p.x, dz = lead.z - p.z, d = Math.hypot(dx, dz), gap = 0.62;
      if (d > 6) p.set(lead.x, 0, lead.z);
      else if (d > gap) { const s = Math.min(d - gap, dt * 3.8); p.x += dx / d * s; p.z += dz / d * s; f.g.rotation.y = Math.atan2(dx, dz); }
      const hop = f.stage === 1 ? 0.04 : f.stage <= 3 ? 0.06 : 0.1;
      f.body.position.y = Math.abs(Math.sin(f.t * (d > gap + 0.05 ? 10 : 3) + i)) * hop;
      if (f.stage === 1) f.body.rotation.z = Math.sin(f.t * 2 + i) * 0.15;
      f.sparks.forEach((sp, k) => { const a = f.t * 2 + k * 2.1; sp.position.set(Math.cos(a) * 0.4, 0.5 + Math.sin(f.t * 3 + k) * 0.15, Math.sin(a) * 0.4); });
      f.g.visible = m.c.g.visible; f.bubble.style.visibility = "hidden";
      lead = p;
    });
  }
  function petSay(pt, txt, ms = 2600) { if (!pt || !txt) return; pt.bubble.textContent = txt; pt.bubble.style.opacity = 1; clearTimeout(pt.sayT); pt.sayT = setTimeout(() => (pt.bubble.style.opacity = 0), ms); }
  const pv = new THREE.Vector3();
  function placePet(pt) {
    const vis = pt.g.visible && (pv.set(pt.g.position.x, pt.top + 0.55, pt.g.position.z).project(camera), Math.abs(pv.x) < 1.05 && Math.abs(pv.y) < 1.1);
    pt.bubble.style.visibility = vis ? "visible" : "hidden"; if (!vis) return;
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    pt.bubble.style.left = ((pv.x + 1) / 2 * w) + "px"; pt.bubble.style.top = ((1 - pv.y) / 2 * h) + "px";
  }
  function tickPet(m, dt) {
    const pt = m.pet; if (!pt) return; pt.t += dt;
    const o = m.c.g.position, ry = m.c.g.rotation.y;
    let tx = o.x - Math.sin(ry) * 0.2 + Math.cos(ry) * 0.75, tz = o.z - Math.cos(ry) * 0.2 - Math.sin(ry) * 0.75;
    if (pt.play && pt.play.until > pt.t && pt.play.with && pt.play.with.g.parent) {   // 和別隻寵物玩:跑到牠旁邊(暴龍會追)
      const q = pt.play.with.g.position; tx = q.x + Math.sin(pt.t * 2) * 0.5; tz = q.z + Math.cos(pt.t * 2) * 0.5;
    } else if (pt.play) pt.play = null;
    const p = pt.g.position, dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
    if (d > 6) p.set(tx, 0, tz);
    else if (d > 0.05) { const s = Math.min(d, dt * 3.6); p.x += dx / d * s; p.z += dz / d * s; pt.g.rotation.y = Math.atan2(dx, dz); }
    else pt.g.rotation.y += (ry - pt.g.rotation.y) * Math.min(1, dt * 3);
    const hop = pt.stage === 1 ? 0.04 : pt.stage === 2 ? 0.06 : pt.stage === 3 ? 0.08 : 0.14;
    pt.body.position.y = Math.abs(Math.sin(pt.t * (d > 0.1 ? 10 : 3))) * hop;
    if (pt.stage === 1) pt.body.rotation.z = Math.sin(pt.t * 2) * 0.15;
    if (pt.stage >= 3 && d <= 0.1) pt.body.rotation.y = Math.sin(pt.t * 1.3) * 0.8;
    pt.sparks.forEach((s, i) => { const a = pt.t * 2 + i * 2.1; s.position.set(Math.cos(a) * 0.4, 0.5 + Math.sin(pt.t * 3 + i) * 0.15, Math.sin(a) * 0.4); });
    pt.g.visible = m.c.g.visible;
    if (pt.stage >= 3 && pt.type && m.arrived) { pt.talk -= dt; if (pt.talk <= 0) { pt.talk = 9 + Math.random() * 9; petSay(pt, petLine(pt.info, pt.n++)); } }
    placePet(pt);
  }
  // 同一場景有兩隻以上寵物時,偶爾湊在一起玩
  const PLAY_LINES = { "chicken|robot": ["咕咕？", "嗶嗶！"], "robot|trex": ["嗶…是暴龍！", "吼～鐵罐頭？"], "digger|robot": ["一起蓋工地！", "嗶嗶～收到"], "digger|train": ["一起蓋鐵路！", "嗯嗯～嗚嗚～"], "trex|trice": ["吼～追追追", "萌萌救命～"], "chicken|trex": ["咕咕！", "吼…是祖先？"],
    "chicken|digger": ["挖到蟲了嗎？", "嗯嗯～"], "train|trex": ["嗚嗚～讓一讓！", "吼！"], "digger|trice": ["來挖寶！", "萌萌～"], "chicken|train": ["載我一程～", "鏗鏘！"] };
  let playClock = 15;
  function tickPlay(dt) {
    playClock -= dt; if (playClock > 0) return; playClock = 18 + Math.random() * 14;
    const by = {}; for (const m of crew.values()) if (m.pet && m.arrived && !m.leaving && m.pet.stage >= 2 && m.pet.type) (by[m.scene] = by[m.scene] || []).push(m.pet);
    const ks = Object.keys(by).filter(k => by[k].length >= 2); if (!ks.length) return;
    const list = by[pick(ks)], a = list.splice(Math.floor(Math.random() * list.length), 1)[0], b = pick(list);
    a.play = { with: b, until: a.t + 5 };
    const key = [a.type, b.type].sort().join("|"), L = PLAY_LINES[key] || ["一起玩～", "嘻嘻～"];
    const first = key.split("|")[0], la = a.type === first ? L[0] : L[1], lb = a.type === first ? L[1] : L[0];
    petSay(a, la, 3000); setTimeout(() => petSay(b, lb, 3000), 900);
  }

  // 生日派對:辦公室放蛋糕、氣球、布條,在辦公室的小人定時一起說生日快樂
  let partyG = null, partyClock = 20;
  function syncParty() {
    if (partyG) { partyG.parent.remove(partyG); partyG = null; }
    if (!GAME.birthdays.length) return;
    partyG = new THREE.Group(); GROUP_OF.office.add(partyG);
    box(1.4, 0.5, 1.4, 0xfff3e0, 0.8, 0.25, 2.2, partyG); box(1.0, 0.45, 1.0, 0xf8a5c2, 0.8, 0.72, 2.2, partyG); box(0.6, 0.35, 0.6, 0xfff3e0, 0.8, 1.12, 2.2, partyG);
    [-0.2, 0, 0.2].forEach(x => { box(0.06, 0.25, 0.06, 0xffffff, 0.8 + x, 1.42, 2.2, partyG); box(0.07, 0.09, 0.07, 0xffb020, 0.8 + x, 1.6, 2.2, partyG); });
    [[-1, 0xe74c3c], [1.3, 0x3498db], [2.6, 0xf1c40f], [-2.3, 0x9b59b6], [3.9, 0x2ecc71]].forEach(b => { box(0.02, 1.6, 0.02, 0xdddddd, b[0], 2.0, -4.6, partyG); box(0.5, 0.6, 0.5, b[1], b[0], 3.0, -4.6, partyG); });
    put(partyG, textPlane("生日快樂 " + GAME.birthdays.map(b => b.name).join("、"), 7, 0.9, { bg: "#ff6fa8", color: "#fff", size: 54 }), -3.6, 3.5, -5.95);
    partyClock = 6;
  }
  function tickParty(dt) {
    if (!partyG) return;
    partyClock -= dt; if (partyClock > 0) return;
    partyClock = 45 + Math.random() * 30;
    [...crew.values()].filter(m => m.arrived && !m.leaving).forEach((m, i) => setTimeout(() => say(m.c, i % 2 ? "🎉 祝你生日快樂！" : "🎂 生日快樂～", 3500), i * 600));
  }

  // 冠軍櫃位旗＋煙火
  let flagG = null, fwClock = 1; const SPARKS = [];
  function syncChampion() {
    if (flagG) { flagG.parent.remove(flagG); flagG = null; }
    const k = GAME.champion ? sceneOf(GAME.champion) : "";
    if (!k || !SCENES[k] || k === "other") return;
    flagG = new THREE.Group(); GROUP_OF[k].add(flagG);
    box(0.12, 4.2, 0.12, 0xd0d0d0, 6.8, 2.1, -5.4, flagG); box(0.25, 0.25, 0.25, 0xf1c40f, 6.8, 4.3, -5.4, flagG);
    put(flagG, textPlane("本月冠軍", 2.2, 1.2, { bg: "#c0392b", color: "#ffe08a", size: 64 }), 7.95, 3.6, -5.4);
    flagG.userData.scene = k;
  }
  function tickFireworks(dt) {
    for (let i = SPARKS.length - 1; i >= 0; i--) {
      const s = SPARKS[i]; s.userData.life -= dt; s.position.addScaledVector(s.userData.v, dt); s.userData.v.y -= 2.5 * dt;
      s.material.opacity = Math.max(0, s.userData.life / 1.4);
      if (s.userData.life <= 0) { scene.remove(s); s.geometry.dispose(); s.material.dispose(); SPARKS.splice(i, 1); }
    }
    if (!GAME.fireworks || !flagG) return;
    fwClock -= dt; if (fwClock > 0) return; fwClock = 1.2 + Math.random() * 1.5;
    const k = flagG.userData.scene, cx = SCENES[k].x + (Math.random() * 10 - 5), cy = 6 + Math.random() * 2, cz = -3 + Math.random() * 3;
    const col = [0xff5e5e, 0xffd166, 0x6ee7b7, 0x7cc4ff, 0xf9a8d4][Math.floor(Math.random() * 5)];
    for (let i = 0; i < 26; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), new THREE.MeshBasicMaterial({ color: col, transparent: true }));
      m.position.set(cx, cy, cz); const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2, sp = 2.5 + Math.random() * 1.5;
      m.userData = { v: new THREE.Vector3(Math.cos(a) * Math.cos(b) * sp, Math.sin(b) * sp + 1, Math.sin(a) * Math.cos(b) * sp), life: 1.4 };
      scene.add(m); SPARKS.push(m);
    }
  }

  // 團隊基金解鎖的家具(辦公室)
  let unlockG = null;
  function syncUnlocks() {
    if (unlockG) { unlockG.parent.remove(unlockG); unlockG = null; }
    const U = GAME.unlocks || []; if (!U.length) return;
    unlockG = new THREE.Group(); GROUP_OF.office.add(unlockG);
    if (U.indexOf("lounge") >= 0) {   // 咖啡機＋地毯
      box(0.9, 1.3, 0.7, 0x2c3e50, 7.3, 0.65, -1.2, unlockG); box(0.5, 0.3, 0.05, 0x5dade2, 7.3, 1.0, -0.84, unlockG); box(0.3, 0.2, 0.3, 0xffffff, 7.3, 0.4, -0.9, unlockG);
      box(2.6, 0.06, 2.0, 0xe8c07a, 4.5, 0.04, 1.2, unlockG);
    }
    if (U.indexOf("plants") >= 0) {   // 植物牆＋水族箱
      for (let x = -7.6; x <= -4; x += 0.6) for (let y = 0.6; y <= 3.2; y += 0.6) box(0.55, 0.55, 0.15, Math.round((x + y) * 10) % 2 ? 0x27ae60 : 0x2ecc71, x, y, -5.95, unlockG);
      box(2.2, 1.2, 0.8, 0x2c3e50, -1.8, 0.6, 5.3, unlockG); const tank = glassBox(2.0, 1.0, 0.7, 0x5dade2, 0.45); tank.position.set(-1.8, 1.7, 5.3); unlockG.add(tank);
      [[-2.3, 1.6], [-1.6, 1.9], [-1.3, 1.5]].forEach(f => box(0.18, 0.1, 0.06, 0xff8c1a, f[0], f[1], 5.3, unlockG));
    }
    if (U.indexOf("arcade") >= 0) {   // 大型電玩＋桌球桌
      box(0.9, 1.9, 0.8, 0x6c3483, 7.3, 0.95, 2.6, unlockG); box(0.7, 0.5, 0.05, 0x58d68d, 7.3, 1.4, 2.98, unlockG);
      box(2.4, 0.08, 1.3, 0x1e8449, 4.5, 0.85, 3.6, unlockG); box(2.4, 0.2, 0.04, 0xffffff, 4.5, 0.98, 3.6, unlockG);
      [[3.5, 3.1], [5.5, 3.1], [3.5, 4.1], [5.5, 4.1]].forEach(l => box(0.08, 0.8, 0.08, 0x333333, l[0], 0.4, l[1], unlockG));
    }
  }

  // 節日裝飾(辦公室)
  let holiG = null;
  function syncHoliday() {
    if (holiG) { holiG.parent.remove(holiG); holiG = null; }
    const h = GAME.holiday; if (!h) return;
    holiG = new THREE.Group(); GROUP_OF.office.add(holiG);
    if (h === "xmas") {
      box(0.3, 0.5, 0.3, 0x6e4b2a, -7, 0.25, 4.4, holiG);
      [[1.6, 0.6], [1.2, 1.1], [0.8, 1.55], [0.4, 1.95]].forEach(l => box(l[0], 0.5, l[0], 0x1e8449, -7, l[1] + 0.2, 4.4, holiG));
      box(0.3, 0.3, 0.3, 0xf1c40f, -7, 2.5, 4.4, holiG);
      [[-7.5, 1.0, 4.9, 0xe74c3c], [-6.5, 1.4, 4.9, 0x3498db], [-7.2, 1.8, 4.9, 0xf1c40f]].forEach(b => box(0.14, 0.14, 0.14, b[3], b[0], b[1], b[2], holiG));
    } else if (h === "lunar" || h === "lantern") {
      [-6, -2, 2, 6].forEach(x => { box(0.03, 0.6, 0.03, 0x333333, x, 3.6, -4.8, holiG); box(0.6, 0.7, 0.6, 0xe74c3c, x, 3.0, -4.8, holiG); box(0.64, 0.08, 0.64, 0xf1c40f, x, 3.38, -4.8, holiG); box(0.64, 0.08, 0.64, 0xf1c40f, x, 2.62, -4.8, holiG); });
      if (h === "lunar") put(holiG, textPlane("新春快樂", 3, 0.8, { bg: "#c0392b", color: "#ffd700", size: 70 }), 4.5, 3.6, -5.95);
    } else if (h === "midautumn") {
      const moon = new THREE.Mesh(new THREE.SphereGeometry(1.0, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff1b5 })); moon.position.set(-6, 6.5, -7.5); holiG.add(moon);
      [[3.8, -1.2], [4.2, -1.5], [5.0, -1.3]].forEach(p => box(0.3, 0.26, 0.3, 0x9acd32, p[0], 0.7, p[1], holiG));
    } else if (h === "dragonboat") {
      box(2.4, 0.3, 0.5, 0xc0392b, 4.5, 0.65, -1.6, holiG); box(0.4, 0.4, 0.4, 0x27ae60, 3.4, 0.9, -1.6, holiG);
      [[4.2, 0], [4.6, 0.1], [5.0, -0.1]].forEach(z => box(0.22, 0.22, 0.22, 0x2e8b57, z[0], 0.9, -1.6 + z[1], holiG));
    } else if (h === "halloween") {
      [[-7, 4.6], [7, 4.6], [0.5, 5.2]].forEach(p => { box(0.6, 0.5, 0.6, 0xe67e22, p[0], 0.25, p[1], holiG); box(0.1, 0.15, 0.1, 0x2e8b3a, p[0], 0.58, p[1], holiG); box(0.12, 0.1, 0.02, 0x222222, p[0] - 0.12, 0.3, p[1] + 0.31, holiG); box(0.12, 0.1, 0.02, 0x222222, p[0] + 0.12, 0.3, p[1] + 0.31, holiG); });
    } else if (h === "newyear") {
      put(holiG, textPlane("Happy New Year", 4, 0.8, { bg: "#2c3e50", color: "#ffd700", size: 60 }), 4.5, 3.6, -5.95);
    } else if (h === "anniversary") {
      box(1.6, 0.6, 1.6, 0xc0392b, -1.5, 0.3, 2.5, holiG); box(1.2, 0.5, 1.2, 0xfff3e0, -1.5, 0.85, 2.5, holiG);
      put(holiG, textPlane("紅玉滿 週年快樂", 4, 0.8, { bg: "#c0392b", color: "#fff3e0", size: 60 }), 4.5, 3.6, -5.95);
    }
  }

  // v1.44 大廳也跟著節日佈置（入口橫幅＋聖誕樹／燈籠）
  let holiL = null;
  function syncHolidayL() {
    if (holiL) { holiL.parent.remove(holiL); holiL = null; }
    const h = GAME.holiday; if (!h || !GROUP_OF.lobby) return;
    holiL = new THREE.Group(); GROUP_OF.lobby.add(holiL);
    const TXT = { xmas: "Merry Christmas 🎄", newyear: "新年快樂 🎉", lunar: "新春快樂 🧧", lantern: "元宵節快樂 🏮", dragonboat: "端午節快樂", midautumn: "中秋節快樂 🌕", halloween: "Happy Halloween 🎃", anniversary: "紅玉滿 週年快樂 🎂" };
    put(holiL, textPlane(TXT[h] || "節日快樂", 5, 0.7, { bg: "#c0392b", color: "#ffd700", size: 56 }), -2.0, 3.55, -5.9);
    if (h === "xmas") { box(0.3, 0.5, 0.3, 0x6e4b2a, 6.4, 0.25, 2.6, holiL); [[1.6, 0.6], [1.2, 1.1], [0.8, 1.55], [0.4, 1.95]].forEach(l => box(l[0], 0.5, l[0], 0x1e8449, 6.4, l[1] + 0.2, 2.6, holiL)); box(0.3, 0.3, 0.3, 0xf1c40f, 6.4, 2.5, 2.6, holiL); }
    if (h === "lunar" || h === "lantern") [-6, 2, 6].forEach(x => { box(0.6, 0.7, 0.6, 0xe74c3c, x, 3.0, -4.8, holiL); box(0.64, 0.08, 0.64, 0xf1c40f, x, 3.38, -4.8, holiL); });
    if (h === "halloween") [[6.4, 2.6], [-6.4, 3.2]].forEach(p => box(0.6, 0.5, 0.6, 0xe67e22, p[0], 0.25, p[1], holiL));
  }
  // 天氣:下雨、夜晚
  const hemi = scene.children.find(o => o.isHemisphereLight);
  let baseHemi = 0.75, baseSun = 0.75, lightK = 1;
  let rain = null;
  function syncWeather() {
    const w = GAME.weather || {}, night = !!w.night;
    baseHemi = night ? 0.5 : 0.75; baseSun = night ? 0.35 : 0.75;
    scene.background.setHex(night ? 0x0e0d1c : w.rain ? 0x2a2f3d : 0x1d1b2e);
    if (w.rain && !rain) {
      const n = 900, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { pos[i * 3] = Math.random() * 40 - 20; pos[i * 3 + 1] = Math.random() * 14; pos[i * 3 + 2] = Math.random() * 30 - 15; }
      const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      rain = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x9ec9ff, size: 0.08, transparent: true, opacity: 0.7 }));
      scene.add(rain);
    } else if (!w.rain && rain) { scene.remove(rain); rain.geometry.dispose(); rain = null; }
  }
  function tickRain(dt) {
    if (!rain) return;
    rain.position.x = camX;
    const a = rain.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) { let y = a.getY(i) - dt * 14; if (y < 0) y += 14; a.setY(i, y); }
    a.needsUpdate = true;
  }

  // 互動表演:兩人在同一場景就面對面做動作,否則只在看得到的那一位頭上顯示
  const INTER = { cheer: ["cheer", "💪 加油！", "謝謝！💪"], like: ["like", "👍 讚！", "😆 謝啦"], nod: ["nod", "🙇 你好", "🙇"], smile: ["wave", "😊", "😊"] };
  function emote(fromId, toId, type, fromName, toName) {
    const A = crew.get(String(fromId)), B = crew.get(String(toId)), d = INTER[type]; if (!d) return;
    const act = (m, anim, txt) => { const c = m.c, keep = c.anim; c.anim = anim; say(c, txt, 3000); setTimeout(() => { if (m.c === c && c.anim === anim) c.anim = keep; }, 2600); };
    if (A && B && A.scene === B.scene && !A.leaving && !B.leaving) {
      const pa = A.c.g.position, pb = B.c.g.position;
      A.c.g.rotation.y = Math.atan2(pb.x - pa.x, pb.z - pa.z); B.c.g.rotation.y = Math.atan2(pa.x - pb.x, pa.z - pb.z);
      act(A, d[0], d[1]); setTimeout(() => act(B, d[0], d[2]), 900);
    } else if (B && !B.leaving) act(B, d[0], (fromName || "") + " " + d[1]);
    else if (A && !A.leaving) act(A, d[0], d[1] + " → " + (toName || ""));
  }

  function tickGame(dt) {
    for (const m of crew.values()) { tickPet(m, dt); tickTeam(m, dt); }
    tickPlay(dt);
    tickParty(dt); tickFireworks(dt); tickRain(dt);
  }

  let raf, last = performance.now(), guestClock = 3; const talkUntil = {};
  // v1.21 名牌避讓：同一畫面的名牌重疊時，後面的往上錯開
  const tagSz = new WeakMap(); let tagN = 0;
  function declutter() {
    tagN++;
    const arr = [];
    const add = c => { const el = c && c.tagEl; if (!el || el.style.visibility === "hidden" || !c.g.visible) return;
      let sz = tagSz.get(el); if (!sz || tagN % 30 === 0) { sz = [el.offsetWidth || 50, el.offsetHeight || 16]; tagSz.set(el, sz); }
      // 正在說話：泡泡算進這一疊的高度，上面的名牌會讓出位置
      const b = c.bubble, talking = b && b.style.opacity === "1" && b.textContent;
      const bh = talking ? (b.offsetHeight || 24) + 3 : 0, bw = talking ? (b.offsetWidth || 60) : 0;
      arr.push({ el, c, x: parseFloat(el.style.left) || 0, y: parseFloat(el.style.top) || 0, w: Math.max(sz[0], bw), h: sz[1] + bh, th: sz[1], talking }); };
    for (const m of crew.values()) add(m.c);
    add(boss); if (EVENT_CAR) add(EVENT_CAR.cap);
    arr.sort((a, b) => b.y - a.y);
    const done = [];
    arr.forEach(t => {
      for (let i = 0; i < 8; i++) {
        const o = done.find(d => Math.abs(d.x - t.x) < (d.w + t.w) / 2 && t.y > d.y - d.h - 1 && t.y - t.h < d.y);
        if (!o) break; t.y = o.y - o.h - 2;
      }
      t.el.style.top = t.y + "px"; done.push(t);
      // v1.33 說話泡泡固定疊在名牌（一句話、徽章、名字）的正上方，不會蓋住
      if (t.c.bubble) { t.c.bubble.style.left = t.x + "px"; t.c.bubble.style.top = (t.y - t.th - 3) + "px"; }
    });
  }
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const fc = SCENES[view].focus || { x: 0, z: 0, zoom: 1 };
    let cut = false;
    if (view !== lastView) { cut = lastView !== null; lastView = view; azT = fc.az != null ? fc.az : Math.PI / 4; }
    if (azT != null) { az += (azT - az) * Math.min(1, dt * 4); if (Math.abs(azT - az) < 0.002) azT = null; }
    const kk = Math.min(1, dt * (ptrs.size ? 12 : 4));
    let tx = SCENES[view].x + fc.x + panX, tz = fc.z + panZ;
    if (follow) {
      const fm = crew.get(follow);
      if (!fm || fm.leaving) { follow = null; opts.onPick && opts.onPick(null); }
      else { tx = fm.c.g.position.x; tz = fm.c.g.position.z; }
    }
    const tzoom = fc.zoom * uz;
    if (cut) {   // v1.33 換場景：直接切過去＋淡入，不再從別的場景前面滑過
      camX = tx; camZ = tz; if (azT != null) az = azT; azT = null; camera.zoom = tzoom; camera.updateProjectionMatrix();   // v1.40 修正：視角已到位時 azT 會先變 null，換場景後畫面變成正面平視
      fadeEl.style.transition = "none"; fadeEl.style.opacity = "1";
      requestAnimationFrame(() => { fadeEl.style.transition = "opacity .35s"; fadeEl.style.opacity = "0"; });
    }
    if (MEETSIGN.end) {   // v1.41 會議倒數
      const left = Math.max(0, Math.ceil((MEETSIGN.end - Date.now()) / 1000));
      if (left !== MEETSIGN.left) {
        MEETSIGN.left = left; const g = MEETSIGN.c.getContext("2d");
        g.clearRect(0, 0, 512, 128); g.fillStyle = "rgba(192,57,43,.92)"; g.fillRect(0, 0, 512, 128);
        g.fillStyle = "#fff"; g.font = FONT(44); g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText("📋 開會中 " + String(Math.floor(left / 60)).padStart(2, "0") + ":" + String(left % 60).padStart(2, "0"), 256, 64);
        MEETSIGN.mesh.material.map.needsUpdate = true;
        if (!left) { MEETSIGN.end = 0; MEETSIGN.mesh.visible = false; opts.onMeetEnd && opts.onMeetEnd(); }
      }
    }
    if (markerT > 0) { markerT -= dt; marker.material.opacity = Math.max(0, Math.min(0.9, markerT)); marker.scale.setScalar(1 + (1.2 - markerT) * 0.4); if (markerT <= 0) marker.visible = false; }
    camX += (tx - camX) * kk; camZ += (tz - camZ) * kk;
    if (Math.abs(camera.zoom - tzoom) > 0.002) { camera.zoom += (tzoom - camera.zoom) * kk; camera.updateProjectionMatrix(); }
    camera.position.set(camX + Math.sin(az) * 30, 24, camZ + Math.cos(az) * 30); camera.lookAt(camX, 0.5, camZ);
    sun.position.set(camX + 8, 18, 10); sun.target.position.set(camX, 0, 0);
    // v1.21 櫃位燈光：已打烊最暗、準備中稍暗、營業中全亮
    const os = OPS_STATE[view], lk = os === "closed" ? 0.42 : os === "before" ? 0.72 : 1;
    lightK += (lk - lightK) * Math.min(1, dt * 3);
    // v1.44 v3 室內開燈：總部大樓各房間、工廠、倉庫晚上照樣亮（只有天空和戶外變暗）
    // 晚上預設關燈；只要有隊員在這間（或正走過來），這間就亮
    const sv = SCENES[view] || SCENES[tabOf(view)] || {}, indoor = !!sv.bld || view === "factory" || view === "warehouse" || view === "meet";
    let lit = !(GAME.weather && GAME.weather.night);
    if (indoor && !lit) { const vk = tabOf(view); for (const m of crew.values()) if (!m.leaving && m.scene && tabOf(m.scene) === vk) { lit = true; break; } }
    const bh = indoor && lit ? 0.8 : baseHemi, bs = indoor && lit ? 0.7 : baseSun;
    if (hemi) hemi.intensity = bh * lightK; sun.intensity = bs * lightK;
    // v1.44 大樓房間各自獨立：只顯示目前這間（其他場景照舊依距離）
    GROUPS.forEach(g => { const k = g.userData.k; g.visible = SCENES[k] && SCENES[k].bld ? k === view : !SCENES[view].bld && Math.abs(g.position.x - camX) < 46; });

    FX.forEach(f => (f.on = false));
    for (const m of crew.values()) {
      const c = m.c; stepMove(c, dt); tickMount(m, dt); animChar(c, dt);
      if (c.aura) { c.aura.t += dt; const a = 0.5 + Math.sin(c.aura.t * 2.4) * 0.5; c.aura.ring.material.opacity = 0.35 + a * 0.35; c.aura.ring.scale.setScalar(1 + a * 0.12); c.aura.glow.material.opacity = 0.05 + a * 0.08; }
      c.g.visible = SCENES[m.scene] && SCENES[m.scene].bld ? tabOf(m.scene) === view && Math.abs(c.g.position.x - SCENES[tabOf(m.scene)].x) < (SCENES[tabOf(m.scene)].w || 16) / 2 + 1 : !SCENES[view].bld && Math.abs(c.g.position.x - camX) < 46; place(c);
      if (m.arrived && !m.leaving) {
        const s = slotPos(m.scene, m.slot); if (s.fx) s.fx.on = true;
        m.talk -= dt;
        if (m.talk <= 0 && (talkUntil[m.scene] || 0) > now) m.talk = 1.5 + Math.random() * 2.5;
        if (m.talk <= 0) {
          talkUntil[m.scene] = now + 3200;
          m.talk = 10 + Math.random() * 12;
          m.sayN = (m.sayN || 0) + 1;
          const lines = m.p.meeting ? MEET_LINES : m.p.act ? (GYM_LINES[m.p.act] || REST_LINES) : m.p.resting ? REST_LINES : c.penguin ? PENGUIN_LINES : m.scene === "factory" ? FACTORY_LINES : m.scene === "warehouse" ? WAREHOUSE_LINES : (m.scene === "office" || m.scene === "seats") ? OFFICE_LINES : SHOP_LINES;
          say(c, pick(lines), 2800);
        }
      }
    }
    boss.g.visible = view === "office" && !GAME.boss; animChar(boss, dt); place(boss);
    tickGame(dt); tickEntry(dt); tickCele(dt);
    TWINKLE.forEach((b, i) => b.visible = Math.sin(now / 300 + i * 1.7) > -0.6);
    SNOW.forEach(f => { f.position.y -= dt * 0.8; if (f.position.y < 0) f.position.y = 9; });
    if (EVENT_CAR) {
      const E = EVENT_CAR, cx = E.car.position, wx = SCENES.event.x;
      if (view === "event" && E.state === "idle") { E.state = "drive"; cx.x = 11; E.cap.g.visible = false; }
      if (view !== "event" && E.state !== "idle" && Math.abs(camX - wx) > 20) { E.state = "idle"; cx.x = 11; E.cap.g.visible = false; }
      if (E.state === "drive") { cx.x = Math.max(5.0, cx.x - dt * 4.0); if (cx.x <= 5.0) { E.state = "park"; E.t = 0; } }
      if (E.state === "park") { E.t += dt; if (E.t > 0.6 && !E.cap.g.visible) { E.cap.g.visible = true; E.cap.g.position.set(wx + 4.4, 0, 2.6); E.cap.g.rotation.y = -Math.PI * 0.75; say(E.cap, "物資送到了！加油 💪", 3500); } }
      if (E.cap.g.visible) { animChar(E.cap, dt); place(E.cap); } else E.cap.bubble.style.visibility = E.cap.tagEl.style.visibility = "hidden";
    }
    ROBOTS.forEach(r => { if (r.userData.wave) r.userData.wave.rotation.z = Math.sin(now / 400) * 0.25; });
    const blinkFast = now / 90;
    FX.forEach(f => { if (f.link && f.on) f.link.forEach(l => (l.on = true)); });
    FX.forEach(f => {
      if (f.kind === "screen") f.mesh.material.color.setHex(f.on ? (Math.sin(now / 120 + f.mesh.position.x) > -0.6 ? 0x5dade2 : 0x85c1e9) : 0x2a2f45);
      if (f.kind === "pos") f.mesh.material.color.setHex(f.on ? 0x58d68d : 0x2a2f45);
      if (f.kind === "rgb") f.mesh.material.color.setHSL((now / 3000) % 1, 0.9, 0.55);
      if (f.kind === "spin") f.obj.rotation.y += dt * 14;   // v1.41 陀螺台
      if (f.kind === "bag") { f.t += dt; f.bag.rotation.x = f.on ? Math.sin(f.t * 9) * 0.18 : f.bag.rotation.x * 0.9; }
      if (f.kind === "mixer" && f.on) { if (f.axis === "x") f.whisk.rotation.x += dt * 6; else f.whisk.rotation.y += dt * 9; }   // v1.40 攪拌機
      if (f.kind === "oven") {
        if (f.link && f.on) f.link.forEach(l => (l.on = true));
        f.mesh.material.color.setHex(f.on ? (Math.sin(blinkFast + f.seed) > -0.5 ? 0xff6a1a : 0xffa040) : 0x3a2a2a);
        if (f.on) { f.flipT += dt; const k = Math.floor(f.flipT / 1.8), ph = Math.min(1, (f.flipT % 1.8) / 0.45); f.mold.rotation.x = (k + ph) * Math.PI; }
        f.puffs.forEach(p => { if (f.on) { p.userData.t += dt; const tt = p.userData.t % 1.8; p.position.y = (f.small ? 0.75 : 1.95) + tt * (f.small ? 0.6 : 0.9); p.material.opacity = 0.55 * (1 - tt / 1.8); } else p.material.opacity = Math.max(0, p.material.opacity - dt); });
      }
    });
    // 客人
    const staffed = {}; for (const m of crew.values()) if (!m.leaving) staffed[m.scene] = true;
    Object.keys(GUESTS).forEach(k => GUESTS[k].forEach(g => { g.g.visible = !!staffed[k] && Math.abs(g.g.position.x - camX) < 34; animChar(g, dt); place(g); }));
    guestClock -= dt;
    if (guestClock <= 0) {
      guestClock = 3 + Math.random() * 4;
      const gs = staffed[view] && GUESTS[view];
      if (gs && (talkUntil[view] || 0) < now) { talkUntil[view] = now + 2900; const g = pick(gs); g.anim = "talk"; say(g, pick(GUEST_LINES), 2600); setTimeout(() => (g.anim = "stand"), 2600); }
    }
    declutter();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  drawRevOffice([]); drawOpsBoards({}); drawStatus({}); drawAttend([]);
  drawV44();
  
  drawWalls();
  size(); raf = requestAnimationFrame(loop);

  return {
    setCrew,
    setAvatars(map) { AV_CFG = map || {}; setCrew(lastList); },
    setEventName(n) { drawEventSign(n || "今日活動"); },
    // v1.21 櫃位營運連動：{ 場景: { state: "open"|"before"|"closed", batter: {原味,其他口味}, batterLow: 麵糊不夠（v1.22 依平假日用量推算）, pickup: 筆數 } }
    setOps(map) { Object.keys(OPS).forEach(k => drawOps(k, map && map[k])); drawStatus(map); },
    // v1.41 開會：end＝結束時間（毫秒），0＝沒有開會
    setMeeting(end) { MEETSIGN.end = end > Date.now() ? end : 0; MEETSIGN.left = -1; if (MEETSIGN.mesh) MEETSIGN.mesh.visible = !!MEETSIGN.end; },
    // v1.41 找自己：回傳所在場景，並切過去鏡頭拉近、腳下閃光
    locate(id) {
      const m = crew.get(String(id)); if (!m || m.leaving) return null;
      if (tabOf(m.scene) !== view) { view = tabOf(m.scene); resetCam(); }
      follow = String(id); uz = Math.max(1, 2.2 / ((SCENES[view].focus || {}).zoom || 1)); clampZ();   // 鏡頭跟著自己，但不跳出名片
      marker.position.set(m.c.g.position.x, 0.03, m.c.g.position.z); marker.visible = true; markerT = 2.0;
      return m.scene;
    },
    whereIs(id) { const m = crew.get(String(id)); if (!m || m.leaving) return null; const p = m.c.g.position.x; const k = SCENE_KEYS.find(x => SCENES[x].bld && !SCENES[x].virtual && Math.abs(p - SCENES[x].x) <= SCENES[x].w / 2) || m.scene; return m.scene === "meet" ? "meet" : k; },
    setBoards(map) { Object.keys(BOARDS).forEach(k => drawBoard(k, (map && map[k]) || [])); },
    setView(k) { k = tabOf(k); if (SCENES[k] && k !== view) { view = k; if (follow) { follow = null; opts.onPick && opts.onPick(null); } resetCam(); } },
    // v1.21 放大
    setFullscreen(b) { full = !!b; cv.style.touchAction = full ? "none" : "pan-y"; size(); },
    resetView() { if (follow) { follow = null; opts.onPick && opts.onPick(null); } resetCam(); },
    zoomBy(f) { uz *= f; clampZ(); },
    focusCrew,
    // 遊戲化資料:{ pets, worn, birthdays, champion, fireworks, unlocks, holiday, weather }
    setGame(g) {
      const prev = GAME; GAME = Object.assign({}, GAME, g || {});
      const ch = k => JSON.stringify(prev[k]) !== JSON.stringify(GAME[k]);
      if (ch("seats")) syncSeats();
      if (ch("worn") || ch("birthdays") || ch("titles") || ch("seats") || ch("hearts")) setCrew(lastList);
      if (ch("fx")) for (const m of crew.values()) if (!m.fxDone && !m.arrived && !m.leaving && !m.p.resting && !m.p.isBoss && fresh(m.p)) playEntry(m);
      syncPets();
      if (ch("birthdays")) syncParty();
      if (ch("champion")) syncChampion();
      if (ch("unlocks")) syncUnlocks();
      if (ch("holiday")) syncHoliday();
      if (ch("weather")) syncWeather();
      if (ch("shops")) syncShops(GAME.shops);
      if (ch("mounts") || ch("macc")) syncMounts();
      if (ch("boards")) drawOpsBoards(GAME.boards);
      if (ch("thanks") || ch("bfWall") || ch("events")) drawWalls();
      if (ch("lobby")) drawAttend(lastList);
      if (ch("rank") || ch("canteen") || ch("praise") || ch("birthdays")) drawV44();
      if (ch("holiday")) syncHolidayL();
    },
    // v1.40 即時營業額：辦公室布告欄排名＋各櫃位看板
    setRev(list) {
      list = list || [];
      Object.keys(REV_BY_SCENE).forEach(k => delete REV_BY_SCENE[k]);
      list.forEach(x => { const k = sceneOf(x.loc); if (SCENES[k] && SCENES[k].store && (!REV_BY_SCENE[k] || x.amount > REV_BY_SCENE[k].amount)) REV_BY_SCENE[k] = x; });
      Object.keys(BOARDS).forEach(k => drawBoard(k, BOARD_ITEMS[k] || []));
      drawRevOffice(list);
    },
    celebrate(loc) { celebrate(SCENES[loc] ? loc : sceneOf(loc)); },
    // v1.44 v3 拍貼機「虛擬人像」：用自己的角色（造型）＋寵物＋坐騎（含配件）＋背景，在遠處小攝影棚拍一張
    // opts: { id, name, pet: bool, mount: bool, bg: "seat"|"game"|"plain", pose: "wave"|"like"|"cheer"|"ride", w, h } → dataURL
    portrait(o) {
      o = o || {}; const W = o.w || 480, H = o.h || 600, id = String(o.id || ""), X = 1500;
      const m = crew.get(id), p = (m && m.p) || { id, name: o.name || "" };
      const P = new THREE.Group(); P.position.set(X, 0, 0); scene.add(P);
      const tmp = [], fx0 = FX.length;
      try {
        // 背景
        if (o.bg === "game") {
          box(12, 0.1, 10, 0x3b3456, 0, -0.05, 0, P); box(12, 6, 0.2, 0x2c2440, 0, 3, -3, P);
          [[-2.6, 0xe74c3c], [-1.2, 0x3498db], [2.6, 0xf39c12]].forEach(([x, c]) => { box(1.2, 2.2, 0.9, c, x, 1.1, -2.4, P); box(1.0, 0.7, 0.05, 0x2a2f45, x, 1.7, -1.93, P); });
          box(1.4, 0.9, 1.2, 0xff6fa8, 1.2, 0.45, -2.3, P); const gl = glassBox(1.3, 1.2, 1.1, 0xffffff, 0.25); gl.position.set(1.2, 1.5, -2.3); P.add(gl);
        } else if (o.bg === "seat") {
          box(12, 0.1, 10, 0xc9a77c, 0, -0.05, 0, P); box(12, 6, 0.2, 0x8a5a3c, 0, 3, -3, P); box(12, 0.25, 0.25, 0xc0392b, 0, 2.6, -2.85, P);
          const st = (GAME.seats || []).find(x => String(x.id) === id);
          const D = new THREE.Group(); D.position.set(0, 0, -1.3); D.rotation.y = Math.PI; P.add(D);
          seatDesk(D, 0, 0, st ? st.desk : "desk_white"); seatChair(D, 0, 0.9, st ? st.chair : "chair_basic");
          ((st && st.deco) || []).slice(0, 3).forEach((d, j) => seatDeco(D, [-0.7, 0.72, -0.42][j], [0.2, 0.15, -0.2][j], d));
        } else { box(12, 0.1, 10, 0xf2b8cc, 0, -0.05, 0, P); box(12, 6, 0.2, 0xffd1e3, 0, 3, -3, P); }
        // 角色
        const c = buildChar(avatarOf(p)); tmp.push(() => { scene.remove(c.g); c.bubble && c.bubble.remove(); });
        c.g.position.set(X, 0, 0.4); c.g.rotation.y = 0.25;
        let M = null;
        if (o.mount && (GAME.mounts || {})[id]) {
          M = mountModel(GAME.mounts[id]);
          if (M) { mountAcc(M, (GAME.macc || {})[id], p.name); M.g.position.set(X, 0, 0.4); M.g.rotation.y = 0.25 + (o.pose === "ride" ? 0 : -1.2); if (o.pose !== "ride") M.g.position.set(X - 1.5, 0, 0.1); tmp.push(() => scene.remove(M.g)); tickAcc(M, false); }
        }
        c.rideY = M && o.pose === "ride" ? M.h : 0;
        c.anim = o.pose === "like" ? "like" : o.pose === "cheer" ? "cheer" : o.pose === "ride" ? "wave" : "wave"; c.t = 0.4; animChar(c, 0);
        if (o.pet && GAME.pets && GAME.pets[id]) { const pt = makePet(GAME.pets[id]); pt.g.position.set(X + 1.2, 0, 0.9); pt.g.rotation.y = -0.3; tmp.push(() => { scene.remove(pt.g); pt.bubble.remove(); }); }
        // 鏡頭：把角色（含坐騎、寵物）框在畫面中間
        const box3 = new THREE.Box3(); box3.expandByObject(c.g); if (M) box3.expandByObject(M.g);
        if (o.pet && GAME.pets && GAME.pets[id]) box3.expandByPoint(new THREE.Vector3(X + 1.6, 1.2, 0.9));
        const ctr = box3.getCenter(new THREE.Vector3()), sz = box3.getSize(new THREE.Vector3());
        const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 100), span = Math.max(sz.y * 1.7, sz.x * 1.6 / (W / H), 3.6), dist = span / (2 * Math.tan(15 * Math.PI / 180));
        cam.position.set(ctr.x + dist * 0.18, ctr.y + dist * 0.12, ctr.z + dist); cam.lookAt(ctr.x, ctr.y - sz.y * 0.12, ctr.z);
        const hi = hemi ? hemi.intensity : 0, si = sun.intensity, sp = sun.position.clone(), stp = sun.target.position.clone();
        if (hemi) hemi.intensity = 0.85; sun.intensity = 0.75; sun.position.set(ctr.x + 5, 12, 10); sun.target.position.set(ctr.x, 0, 0);
        const rt = new THREE.WebGLRenderTarget(W, H); renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(null);
        const px = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(rt, 0, 0, W, H, px); rt.dispose();
        if (hemi) hemi.intensity = hi; sun.intensity = si; sun.position.copy(sp); sun.target.position.copy(stp);
        const cv2 = document.createElement("canvas"); cv2.width = W; cv2.height = H; const g2 = cv2.getContext("2d"), im = g2.createImageData(W, H);
        for (let y = 0; y < H; y++) im.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
        g2.putImageData(im, 0, 0);
        return cv2;
      } finally { tmp.forEach(f => f()); scene.remove(P); FX.length = Math.min(FX.length, fx0); }
    },
    // 真人自拍用：只拍寵物或坐騎（透明背景小圖，貼在照片旁）
    sticker(o) {
      o = o || {}; const W = 256, H = 256, id = String(o.id || ""), X = 1500;
      let obj = null, M = null, pt = null;
      if (o.kind === "pet" && GAME.pets && GAME.pets[id]) { pt = makePet(GAME.pets[id]); pt.g.position.set(X, 0, 0); pt.g.rotation.y = 0.4; obj = pt.g; }
      if (o.kind === "mount" && (GAME.mounts || {})[id]) { M = mountModel(GAME.mounts[id]); if (M) { mountAcc(M, (GAME.macc || {})[id], o.name); tickAcc(M, false); M.g.position.set(X, 0, 0); M.g.rotation.y = 0.7; obj = M.g; } }
      if (!obj) return null;
      try {
        const b = new THREE.Box3().setFromObject(obj), ctr = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3());
        const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100), span = Math.max(sz.x, sz.y, sz.z) * 1.3, dist = span / (2 * Math.tan(15 * Math.PI / 180));
        cam.position.set(ctr.x + dist * 0.3, ctr.y + dist * 0.3, ctr.z + dist); cam.lookAt(ctr);
        const bg = scene.background; scene.background = null;
        const rt = new THREE.WebGLRenderTarget(W, H); renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam); renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 1); scene.background = bg;
        const px = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(rt, 0, 0, W, H, px); rt.dispose();
        const cv2 = document.createElement("canvas"); cv2.width = W; cv2.height = H; const g2 = cv2.getContext("2d"), im = g2.createImageData(W, H);
        for (let y = 0; y < H; y++) im.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
        g2.putImageData(im, 0, 0); return cv2;
      } finally { if (pt) { scene.remove(pt.g); pt.bubble.remove(); } if (M) scene.remove(M.g); }
    },
    has(id) { id = String(id); return { pet: !!(GAME.pets && GAME.pets[id]), mount: !!(GAME.mounts || {})[id] }; },
    sayTo(id, txt) { const B = crew.get(String(id)); if (B && !B.leaving) say(B.c, txt, 3500); },   // v1.44
    coffee(toId, fromName) { const B = crew.get(String(toId)); if (B && !B.leaving) say(B.c, "☕ " + (fromName ? fromName + " 請喝咖啡！" : "謝謝請客！"), 3500); },
    emote,
    petSay(id, txt) { const m = crew.get(String(id)); if (m && m.pet) { petSay(m.pet, txt, 3000); m.pet.body.rotation.y += Math.PI * 2; } },
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
      window.removeEventListener("pointerup", onUp); window.removeEventListener("pointercancel", onUp); window.removeEventListener("pointermove", onMove);
      ro && ro.disconnect();
      renderer.dispose(); overlay.remove(); fadeEl.remove(); renderer.domElement.remove();
    },
  };
}
