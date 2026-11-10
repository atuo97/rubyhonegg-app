// ─────────────────────────────────────────────
// 紅玉滿宇宙辦公室 · 3D 場景引擎
// 只負責畫面：誰在哪個場景、走路動畫、對話框。資料由 UniverseTab 傳入。
// ─────────────────────────────────────────────
import * as THREE from "three";
import { toSceneOpts } from "./avatarCatalog.js";

export const SCENES = {
  office:  { x: 0,   name: "辦公室",       short: "辦公室", icon: "💼", aisle: 2.6 },
  factory: { x: 40,  name: "工廠",         short: "工廠",   icon: "🏭", aisle: 2.6 },
  xinyi:   { x: 80,  name: "遠百信義",     short: "信義",   icon: "🏙️", aisle: -2.8, store: true },
  hall:    { x: 120, name: "國家音樂廳",   short: "音樂廳", icon: "🎻", aisle: -2.8, store: true },
  nangang: { x: 160, name: "南港 LaLaport", short: "南港",  icon: "🛍️", aisle: -2.8, store: true },
  zhubei:  { x: 200, name: "遠百竹北",     short: "竹北",   icon: "🏬", aisle: -2.8, store: true },
  other:   { x: 240, name: "其他櫃位・活動", short: "其他", icon: "🎪", aisle: -2.8, store: true },
};
export const SCENE_KEYS = Object.keys(SCENES);

// 打卡地點 → 場景
export function sceneOf(loc = "") {
  if (/信義/.test(loc)) return "xinyi";
  if (/音樂廳/.test(loc)) return "hall";
  if (/南港/.test(loc)) return "nangang";
  if (/竹北/.test(loc)) return "zhubei";
  if (/工廠|中央廚房/.test(loc)) return "factory";
  if (/辦公/.test(loc)) return "office";
  return "other";
}
// "01正櫃遠百信義" → "遠百信義"
export function shortLoc(loc = "") {
  return String(loc).replace(/^\d+/, "").replace(/^(正櫃|快閃櫃|展覽|活動|分隊長)/, "") || loc;
}

// ── 夥伴外型 ──
// 有指定的照名字套用，其餘依員工編號自動產生（每次都一樣）
const UNI = 0xc0392b;
export const AVATAR_PRESETS = {
  "雞蛋": { penguin: true, shirt: 0xf8a5c2 },
  "宛芸": { ponytail: true, slim: true, hair: 0x2b1a10 },
  "瑜珍": { bob: true, hair: 0x3b2314 },
  "千芊": { glasses: true, hair: 0x1a1a1a },
};
function hash(str) { let h = 0; for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }
// 夥伴自選的紙娃娃造型(empId → cfg),由 UniverseTab 從後端取得後用 setAvatars 設定
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

const SHOP_LINES = ["歡迎光臨～現烤雞蛋糕！", "剛出爐的喔！", "原味一盒，好的～", "小暴龍可以拍照喔 📸", "紅玉跟抹茶都很推！", "謝謝光臨，慢走～"];
const FACTORY_LINES = ["麵糊備好了！", "這批烤色漂亮 👍", "今天要烤幾百顆呢～", "翻模！翻模！", "預拌粉補好了"];
const OFFICE_LINES = ["排班表更新好了 📋", "這個月業績不錯喔！", "來開個小會吧～", "報表整理中…"];
const PENGUIN_LINES = ["企鵝不怕熱 🐧", "翻模！翻模！", "這批烤色漂亮 👍", "麵糊備好了！"];
const GUEST_LINES = ["我要一盒原味！", "紅玉跟抹茶各一盒～", "小暴龍好可愛，先拍照 📸", "現烤的好香喔！", "可以刷卡嗎？", "買回去給小孩吃 😊", "逛街逛到餓了～"];
const pick = a => a[(Math.random() * a.length) | 0];

export function createOffice(container) {
  // ── 基本設定 ──
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.touchAction = "pan-y";

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1d1b2e);
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
  let view = "office", camX = 0, az = Math.PI / 4;

  function size() {
    const w = container.clientWidth || 360, h = Math.round(Math.min(w * 0.85, 460));
    renderer.setSize(w, h);
    const a = w / h, s = Math.max(7.5, 12.5 / a);
    camera.left = -s * a; camera.right = s * a; camera.top = s; camera.bottom = -s;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", size);

  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x3a3350, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 0.75);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 });
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
  function group(k) { const g = new THREE.Group(); g.position.x = SCENES[k].x; scene.add(g); GROUPS.push(g); return g; }
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
  {
    const P = group("office");
    room(P, 0xdcae82, 0x8a5a3b, 0xc0392b, [0xd4a274, 0xe3b98f]);
    box(6.4, 0.05, 5.2, 0x5b7fd6, 4.5, 0.03, -1.4, P);
    put(P, textPlane("紅玉滿赤心 · 宇宙辦公室", 5, 0.9, { bg: "#c0392b", color: "#fff3e0", size: 46 }), 4.5, 2.6, -5.98);
    put(P, textPlane("WORK ZONE", 5, 1.2), -4.5, 0.03, 3.6, 0, -Math.PI / 2);
    put(P, textPlane("LOUNGE", 4, 1), 4.5, 0.07, 1.6, 0, -Math.PI / 2);
    shelf(P, -5.5, -5.65, 0, "book"); shelf(P, -2.5, -5.65, 0, "book"); shelf(P, -7.65, 3.5, Math.PI / 2, "book"); shelf(P, 1.2, -5.65, 0, "book");
    const d1 = desk(P, -6, 0), d2 = desk(P, -3, 0), d3 = desk(P, -6, -3.5), d4 = desk(P, -3, -3.5);
    box(4.4, 0.55, 1.2, 0xc0392b, 4.5, 0.45, -3.6, P); box(4.4, 1.2, 0.4, 0xa93226, 4.5, 0.9, -4.25, P);
    box(0.4, 0.9, 1.2, 0xa93226, 2.3, 0.6, -3.6, P); box(0.4, 0.9, 1.2, 0xa93226, 6.7, 0.6, -3.6, P);
    box(1.4, 0.45, 0.9, 0x8b5a2b, 4.5, 0.3, -1.6, P); box(0.5, 0.08, 0.5, 0xffffff, 4.3, 0.57, -1.6, P);
    for (let i = 0; i < 4; i++) box(0.16, 0.12, 0.16, 0xf0b429, 4.15 + (i % 2) * 0.22, 0.67, -1.7 + ((i / 2) | 0) * 0.2, P);
    plant(P, 7.3, -5.3); plant(P, -0.2, -5.3); plant(P, 7.3, 5.2); plant(P, -7.4, 5.2);
    const via = [{ x: -4.5, z: -1.7 }];
    SLOTS.office = [
      { x: -6, z: 0.9, rotY: Math.PI, sit: true, anim: "type", fx: d1 },
      { x: -3, z: 0.9, rotY: Math.PI, sit: true, anim: "type", fx: d2 },
      { x: -6, z: -2.6, rotY: Math.PI, sit: true, anim: "type", fx: d3, via },
      { x: -3, z: -2.6, rotY: Math.PI, sit: true, anim: "type", fx: d4, via },
      { x: 3.3, z: -3.5, rotY: 0, sit: true, anim: "sit" },
      { x: 5.7, z: -3.5, rotY: 0, sit: true, anim: "sit" },
    ];
  }

  // ── 場景：工廠 ──
  {
    const P = group("factory");
    room(P, 0x8fa3a0, 0x6b7b83, 0xc0392b);
    [1.9, 3.3].forEach(z => box(16, 0.03, 0.12, 0xf1c40f, 0, 0.02, z, P));
    put(P, textPlane("紅玉滿赤心 · 中央工廠", 5, 0.9, { bg: "#c0392b", color: "#fff3e0", size: 46 }), -4, 3.0, -5.98);
    put(P, textPlane("烘焙區 BAKERY", 5, 1.2, { color: "rgba(255,255,255,.45)" }), -4.5, 0.03, 4.6, 0, -Math.PI / 2);
    shelf(P, -5.5, -5.65, 0, "flour"); shelf(P, -2.5, -5.65, 0, "flour"); shelf(P, -7.65, 3.5, Math.PI / 2, "mold"); shelf(P, 1.2, -5.65, 0, "mold");
    const o1 = oven(P, -6, 0), o2 = oven(P, -3, 0), o3 = oven(P, 0, 0);
    box(5.2, 0.95, 1, 0xb8c0c8, -4.5, 0.475, -3.6, P); box(5.26, 0.06, 1.06, 0xdfe4e8, -4.5, 0.98, -3.6, P);
    [-6.4, -5.8].forEach(px => { box(0.5, 0.6, 0.5, 0xf7f7f7, px, 1.31, -3.6, P); box(0.52, 0.06, 0.52, 0xf1c40f, px, 1.64, -3.6, P); });
    box(0.7, 0.25, 0.6, 0x9aa3ad, -4.2, 1.13, -3.6, P); box(0.25, 0.9, 0.25, 0x9aa3ad, -4.2, 1.7, -3.85, P); box(0.6, 0.18, 0.5, 0x9aa3ad, -4.2, 2.05, -3.6, P); box(0.45, 0.4, 0.45, 0xdfe4e8, -4.2, 1.45, -3.55, P);
    box(3, 3, 2.4, 0xdfe6ec, 5, 1.5, -4.8, P); box(0.1, 1.2, 0.1, 0x7f8c8d, 4.2, 1.5, -3.55, P);
    put(P, textPlane("冷藏庫", 1.6, 0.4, { bg: "#2980b9", color: "#fff", size: 60 }), 5, 2.6, -3.58);
    box(3, 0.9, 1.4, 0xb8c0c8, 4.5, 0.45, -0.6, P); box(3.05, 0.05, 1.45, 0xdfe4e8, 4.5, 0.92, -0.6, P);
    for (let i = 0; i < 6; i++) box(0.6, 0.3, 0.45, 0xc0392b, 3.5 + (i % 3) * 0.7, 1.1 + ((i / 3) | 0) * 0.3, -0.6, P);
    for (let i = 0; i < 3; i++) box(0.55, 0.4, 0.4, 0xf4efe6, 6.6, 0.2 + i * 0.4, 4.6, P);
    box(1.4, 0.15, 1.2, 0x9b6b43, 6.6, 0.07, 4.6, P);
    const via = [{ x: -4.5, z: -2.0 }];
    SLOTS.factory = [
      { x: -6, z: 1.0, rotY: Math.PI, anim: "cook", fx: o1 },
      { x: -3, z: 1.0, rotY: Math.PI, anim: "cook", fx: o2 },
      { x: 0, z: 1.0, rotY: Math.PI, anim: "cook", fx: o3 },
      { x: -4.5, z: -2.6, rotY: Math.PI, anim: "cook" },
      { x: -6, z: -2.6, rotY: Math.PI, anim: "cook", via },
      { x: -3, z: -2.6, rotY: Math.PI, anim: "cook", via },
      { x: 3.8, z: 0.4, rotY: Math.PI, anim: "serve" },
      { x: 5.2, z: 0.4, rotY: Math.PI, anim: "serve" },
    ];
  }

  // ── 場景：各櫃位 ──
  function trex(P, x, z) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = Math.PI / 4; P.add(g);
    const R = 0xd94a3a, Cr = 0xffe6c7, D = 0xa8322a;
    const pm = {}; const ph = c => pm[c] || (pm[c] = new THREE.MeshPhongMaterial({ color: c, shininess: 90, specular: 0x666666 }));
    function pb(w, h, d, c, x, y, z, rx) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), ph(c)); m.position.set(x, y, z); if (rx) m.rotation.x = rx; m.castShadow = true; g.add(m); return m; }
    box(1.9, 0.5, 1.9, 0xf4f1ec, 0, 0.25, 0, g); box(1.92, 0.1, 1.92, 0xc0392b, 0, 0.42, 0, g);
    put(g, textPlane("小暴龍", 1.2, 0.3, { color: "#c0392b", size: 72 }), 0, 0.22, 0.96);
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
    trex(P, 5, 1.6);
    plant(P, 7.3, 5.0);
    // 缺貨看板（立牌）
    const bg = new THREE.Group(); bg.position.set(6.6, 0, -1.4); bg.rotation.y = Math.PI / 4; P.add(bg);
    box(0.08, 1.6, 0.08, 0x555555, -0.9, 0.8, 0, bg); box(0.08, 1.6, 0.08, 0x555555, 0.9, 0.8, 0, bg);
    box(2.3, 1.7, 0.08, 0x6e4b2a, 0, 2.1, -0.05, bg);
    const bc = document.createElement("canvas"); bc.width = 512; bc.height = 384;
    const bm = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.55), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bc) }));
    bm.position.set(0, 2.1, 0.0); bg.add(bm);
    BOARDS[k] = { canvas: bc, mesh: bm };
    drawBoard(k, []);
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
      case "crown": box(0.7, 0.14, 0.64, 0xf1c40f, 0, y - 0.02, 0, g);
        [[-0.26, -0.22], [0.26, -0.22], [-0.26, 0.22], [0.26, 0.22], [0, 0]].forEach(s => box(0.12, 0.24, 0.12, 0xf1c40f, s[0], y + 0.16, s[1], g)); break;
    }
  }
  // 小暴龍裝(品牌吉祥物,可自選穿上)
  function makeTrex(o) {
    const g = new THREE.Group(); scene.add(g);
    const R = 0xd94a3a, Cr = 0xffe6c7, D = 0xa8322a;
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
    return { g, legL, legR, armL, armR, bubble: bubbleEl("uo-bubble"), t: Math.random() * 5, anim: "stand", sit: false, path: [], speed: 3.2, trex: true };
  }
  function buildChar(av) { return av.mascot === "trex" ? makeTrex(av) : av.penguin ? makePenguin(av) : makeChar(av); }
  function makeChar(o) {
    const g = new THREE.Group(); scene.add(g);
    const legL = new THREE.Group(); legL.position.set(-0.18, 0.7, 0); g.add(legL); box(0.3, 0.7, 0.32, o.pants, 0, -0.35, 0, legL);
    const legR = new THREE.Group(); legR.position.set(0.18, 0.7, 0); g.add(legR); box(0.3, 0.7, 0.32, o.pants, 0, -0.35, 0, legR);
    box(0.78, 0.78, 0.46, o.shirt, 0, 1.09, 0, g);
    if (o.apron) box(0.6, 0.6, 0.04, 0xffffff, 0, 1.0, 0.24, g);
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
  const BOARDS = {};
  function drawBoard(k, items) {
    const b = BOARDS[k]; if (!b) return;
    const g = b.canvas.getContext("2d"), W = 512, H = 384;
    g.fillStyle = "#fbfaf5"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#c0392b"; g.fillRect(0, 0, W, 70);
    g.fillStyle = "#fff"; g.font = 'bold 40px "PingFang TC","Noto Sans TC",sans-serif'; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("📋 缺貨看板", W / 2, 36);
    g.textAlign = "left";
    if (!items.length) { g.fillStyle = "#2a7040"; g.font = 'bold 44px "PingFang TC","Noto Sans TC",sans-serif'; g.fillText("✅ 目前不缺", 40, 200); }
    else {
      g.fillStyle = "#c03030"; g.font = 'bold 38px "PingFang TC","Noto Sans TC",sans-serif';
      items.slice(0, 6).forEach((it, i) => g.fillText("• " + it, 30 + (i % 2) * 240, 120 + Math.floor(i / 2) * 80));
      if (items.length > 6) { g.fillStyle = "#8a7a68"; g.font = '28px sans-serif'; g.fillText("…還有 " + (items.length - 6) + " 項", 30, 355); }
    }
    b.mesh.material.map.needsUpdate = true;
  }
  storeScene("xinyi", { floor: [0x3b3a40, 0x4a4950], wall: 0xe8dcc8, trim: 0xc9a227, counter: 0x2c2c34, title: "遠百信義", titleColor: "rgba(255,240,200,.45)", signBg: "#2c2c34", deco: P => {
    put(P, glassBox(0.2, 4, 12, 0xbfe0ff, 0.25), -8.2, 2, 0);
    for (let z = -6; z <= 6; z += 3) box(0.25, 4, 0.2, 0x888888, -8.2, 2, z, P);
    const T = 0x5e9c94; box(2, 1.4, 2, T, -11, 0.7, -2, P);
    for (let i = 0; i < 8; i++) { box(1.25, 0.15, 1.25, 0x3d7068, -11, 1.45 + i * 0.95, -2, P); box(1.05, 0.8, 1.05, T, -11, 1.95 + i * 0.95, -2, P); }
    box(0.7, 1.2, 0.7, T, -11, 9.6, -2, P); box(0.15, 1.6, 0.15, 0xcccccc, -11, 11, -2, P);
    box(1.5, 4, 1.5, 0x6f7f8f, -11, 2, 2.5, P); box(1.2, 6, 1.2, 0x7d8b99, -12.5, 3, -5, P);
  } });
  storeScene("hall", { floor: [0xc9c1b0, 0xbdb4a2], wall: 0xf3e9d2, trim: 0xa93226, counter: 0x7b241c, title: "國家音樂廳", deco: P => {
    [-7.6, -3.8, 0.2, 3.8, 7.4].forEach(x => box(0.55, 4.2, 0.55, 0xb0281e, x, 2.1, -5.6, P));
    box(16.6, 0.45, 0.7, 0x8e1f17, 0, 4.25, -5.6, P);
    box(17.4, 0.35, 2.6, 0xe0a526, 0, 4.75, -5.1, P).rotation.x = 0.35;
    box(17.4, 0.25, 0.35, 0xc78a12, 0, 5.15, -5.9, P);
    for (let i = -8; i <= 8; i += 0.8) box(0.12, 0.12, 2.4, 0xc78a12, i, 4.85, -5.1, P).rotation.x = 0.35;
    [-6, -2, 2, 6].forEach(x => { box(0.04, 0.8, 0.04, 0x333333, x, 3.8, -4.4, P); box(0.6, 0.7, 0.6, 0xe74c3c, x, 3.1, -4.4, P); box(0.64, 0.1, 0.64, 0xf1c40f, x, 3.5, -4.4, P); box(0.64, 0.1, 0.64, 0xf1c40f, x, 2.72, -4.4, P); });
    box(2.4, 0.15, 6, 0xb0281e, -6.5, 0.03, 2.5, P);
  } });
  storeScene("nangang", { floor: [0xe8d3b0, 0xdfc6a0], wall: 0xfafafa, trim: 0x7dbb6e, counter: 0xc89f6e, title: "南港 LaLaport", signBg: "#6aa35b", signZ: -5.6, deco: P => {
    for (let x = -7.8; x <= 7.8; x += 0.6) box(0.15, 4, 0.1, 0xc89f6e, x, 2, -5.97, P);
    [[-7.2, 3], [-7.2, -1], [6.8, -4.2]].forEach(p => { box(1.2, 0.6, 1.2, 0xc89f6e, p[0], 0.3, p[1], P); box(1.1, 1.0, 1.1, 0x58b368, p[0], 1.1, p[1], P); box(0.7, 0.8, 0.7, 0x3f9d52, p[0], 1.9, p[1], P); });
    [-4, 0, 4].forEach((x, i) => { box(0.03, 1, 0.03, 0x999999, x, 4.2, 2, P); box(1.4, 0.9, 0.05, [0xf6c1c7, 0xa8e0f0, 0xfde49c][i], x, 3.3, 2, P); });
  } });
  storeScene("zhubei", { floor: [0xefe7da, 0xe5dccc], wall: 0xf0e6d6, trim: 0x2e8b8b, counter: 0x6e4b2a, title: "遠百竹北", signBg: "#2e8b8b", deco: P => {
    [[-7.4, -5.6], [7.4, -5.6], [-7.4, 4.8]].forEach(p => box(0.9, 4.2, 0.9, 0xdcd3c6, p[0], 2.1, p[1], P));
    box(5.5, 0.35, 1.3, 0x7f8c8d, 5.2, 1.6, -4.6, P).rotation.z = 0.55;
    [-5.2, -4.0].forEach(z => { const g = put(P, glassBox(5.5, 0.7, 0.05, 0xcfefff, 0.35), 5.2, 2.1, z); g.rotation.z = 0.55; });
  } });
  storeScene("other", { floor: [0xf2e6d8, 0xe8d8c4], wall: 0xfdf0e2, trim: 0xc0392b, counter: 0x6e4b2a, title: "其他櫃位・活動", deco: P => {
    box(0.1, 3, 0.1, 0x888888, 6.5, 1.5, -2.5, P); box(0.1, 3, 0.1, 0x888888, 6.5, 1.5, 0.5, P);
    const tent = box(3.4, 0.2, 3.4, 0xc0392b, 6.5, 3.1, -1, P); tent.rotation.z = 0.12;
    [0, 1, 2].forEach(i => box(0.5, 0.7, 0.05, [0xe74c3c, 0xf1c40f, 0x3498db][i], 4.2 + i * 0.5, 3.6, 3.0, P));
  } });

  const boss = makeChar({ shirt: 0x2c3e50, pants: 0x1b2631, hair: 0x222222, cap: 0xc0392b });
  boss.g.position.set(0.6, 0, 4.6); boss.g.rotation.y = -Math.PI / 4; boss.bubble.classList.add("uo-boss");
  nameTag(boss, "隊長");

  function nameTag(c, name) { const t = document.createElement("div"); t.className = "uo-tag"; t.textContent = name; overlay.appendChild(t); c.tagEl = t; }
  const timers = new WeakMap();
  function say(c, txt, ms) {
    c.bubble.textContent = txt; c.bubble.style.opacity = 1; clearTimeout(timers.get(c));
    if (ms) timers.set(c, setTimeout(() => (c.bubble.style.opacity = 0), ms));
  }

  // ── 夥伴管理 ──
  const crew = new Map(); // id → { p, c, scene, slot, leaving }
  const occupied = {}; SCENE_KEYS.forEach(k => (occupied[k] = new Set()));

  function freeSlot(k) {
    const list = SLOTS[k];
    for (let i = 0; i < list.length; i++) if (!occupied[k].has(i)) return i;
    let i = list.length; while (occupied[k].has(i)) i++; return i;
  }
  function slotPos(k, i) {
    const list = SLOTS[k];
    if (i < list.length) return list[i];
    const n = i - list.length; // 人太多時，在後方排一排
    const z = SCENES[k].store ? -3.3 - Math.floor(n / 5) * 0.9 : 4.2 + Math.floor(n / 5) * 0.9;
    return { x: 3 + (n % 5) * 1.0, z, rotY: SCENES[k].store ? 0 : Math.PI, anim: "stand" };
  }
  function worldX(k, x) { return SCENES[k].x + x; }

  function route(m, toScene, toSlot, cb) {
    const c = m.c, p = c.g.position;
    c.sit = false; c.anim = "walk"; m.arrived = false;
    const back = [];
    if (m.slot != null && m.scene) { const s = slotPos(m.scene, m.slot); if (s.via) for (let i = s.via.length - 1; i >= 0; i--) back.push({ x: worldX(m.scene, s.via[i].x), z: s.via[i].z }); }
    const intoPath = (k, s) => {
      const a = SCENES[k].aisle, pts = [];
      if (s.via) { pts.push({ x: worldX(k, s.via[0].x), z: a }); s.via.forEach(v => pts.push({ x: worldX(k, v.x), z: v.z })); }
      else pts.push({ x: worldX(k, s.x), z: a });
      pts.push({ x: worldX(k, s.x), z: s.z }); return pts;
    };
    const cur = m.scene;
    if (cur === toScene) {
      const s = slotPos(toScene, toSlot);
      c.path = [...back, { x: (back.length ? back[back.length - 1].x : p.x), z: SCENES[cur].aisle }, ...intoPath(toScene, s)];
      c.onArrive = cb;
    } else {
      const exitPts = cur ? [...back, { x: (back.length ? back[back.length - 1].x : p.x), z: SCENES[cur].aisle }, { x: SCENES[cur].x + 8.2, z: SCENES[cur].aisle }] : [];
      const enter = () => {
        if (!toScene) { cb && cb(); return; }
        p.set(SCENES[toScene].x + 8.2, 0, SCENES[toScene].aisle);
        c.path = intoPath(toScene, slotPos(toScene, toSlot)); c.onArrive = cb;
      };
      if (exitPts.length) { c.path = exitPts; c.onArrive = enter; } else enter();
    }
  }
  function settle(m) {
    const s = slotPos(m.scene, m.slot);
    m.c.g.rotation.y = s.rotY; m.c.sit = !!s.sit; m.c.anim = s.anim; m.arrived = true;
  }

  let lastList = [];
  function rebuildChar(m, av) {
    const old = m.c, c = buildChar(av);
    c.g.position.copy(old.g.position); c.g.rotation.y = old.g.rotation.y;
    c.path = old.path; c.onArrive = old.onArrive; c.anim = old.anim; c.sit = old.sit; c.t = old.t;
    scene.remove(old.g); old.bubble.remove(); old.tagEl && old.tagEl.remove();
    nameTag(c, m.p.name); m.c = c;
  }
  function setCrew(list) {
    lastList = list;
    const ids = new Set(list.map(p => String(p.id)));
    // 下班：揮手離場
    for (const [id, m] of crew) if (!ids.has(id) && !m.leaving) {
      m.leaving = true; occupied[m.scene].delete(m.slot);
      say(m.c, "下班囉，掰掰～ 👋", 2500);
      const k = m.scene; m.slot = m.slot; // 保留以便走出
      route(m, null, 0, () => { scene.remove(m.c.g); m.c.bubble.remove(); m.c.tagEl.remove(); crew.delete(id); });
      m.scene = k;
    }
    list.forEach(p => {
      const id = String(p.id), k = sceneOf(p.location);
      let m = crew.get(id);
      if (m && m.leaving) return;
      if (m) { m.p = p; const av = avatarFor(p), sig = JSON.stringify(av); if (sig !== m.sig) { rebuildChar(m, av); m.sig = sig; } }
      if (!m) {
        const av = avatarFor(p);
        const c = buildChar(av);
        nameTag(c, p.name);
        m = { p, c, sig: JSON.stringify(av), scene: null, slot: null, clock: 4 + Math.random() * 6, talk: 2 + Math.random() * 6 };
        crew.set(id, m);
        const slot = freeSlot(k); occupied[k].add(slot);
        // 還沒有場景 → 從該場景入口走進來
        route(m, k, slot, () => { settle(m); say(m.c, "上班囉！💪", 2200); });
        m.scene = k; m.slot = slot;
      } else if (m.scene !== k) {
        occupied[m.scene].delete(m.slot);
        const slot = freeSlot(k); occupied[k].add(slot);
        route(m, k, slot, () => settle(m));
        m.scene = k; m.slot = slot;
      }
      m.p = p;
    });
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
      default: aL = aR = Math.sin(t * 1.5) * 0.05;
    }
    if (c.anim === "walk") { const s = Math.sin(t * 10) * 0.6; c.legL.rotation.x = s; c.legR.rotation.x = -s; aL = -s; aR = s; }
    else if (c.sit) { c.legL.rotation.x = c.legR.rotation.x = -Math.PI / 2; ly = 0.05; }
    else c.legL.rotation.x = c.legR.rotation.x = 0;
    c.armL.rotation.x = aL; c.armR.rotation.x = aR; c.armL.rotation.z = zL; c.armR.rotation.z = zR; c.g.position.y = ly;
  }
  function stepMove(c, dt) {
    if (!c.path.length) return;
    const p = c.g.position, n = c.path[0], dx = n.x - p.x, dz = n.z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.05) { p.x = n.x; p.z = n.z; c.path.shift(); if (!c.path.length && c.onArrive) { const f = c.onArrive; c.onArrive = null; f(); } return; }
    const s = Math.min(d, c.speed * dt); p.x += dx / d * s; p.z += dz / d * s; c.g.rotation.y = Math.atan2(dx, dz);
  }
  const v = new THREE.Vector3();
  function place(c) {
    const vis = c.g.visible && (v.set(c.g.position.x, c.g.position.y + 2.95, c.g.position.z).project(camera), Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.1);
    c.bubble.style.visibility = vis ? "visible" : "hidden";
    if (c.tagEl) c.tagEl.style.visibility = vis ? "visible" : "hidden";
    if (!vis) return;
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    c.bubble.style.left = ((v.x + 1) / 2 * w) + "px"; c.bubble.style.top = ((1 - v.y) / 2 * h) + "px";
    if (c.tagEl) { v.set(c.g.position.x, c.g.position.y + 2.5, c.g.position.z).project(camera); c.tagEl.style.left = ((v.x + 1) / 2 * w) + "px"; c.tagEl.style.top = ((1 - v.y) / 2 * h - 14) + "px"; }
  }

  // 拖曳旋轉
  let dragX = null;
  const onDown = e => { dragX = e.clientX; };
  const onUp = () => { dragX = null; };
  const onMove = e => { if (dragX === null) return; az -= (e.clientX - dragX) * 0.008; az = Math.max(-0.2, Math.min(Math.PI / 2 + 0.2, az)); dragX = e.clientX; };
  renderer.domElement.addEventListener("pointerdown", onDown);
  window.addEventListener("pointerup", onUp); window.addEventListener("pointermove", onMove);

  let raf, last = performance.now(), guestClock = 3;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    camX += (SCENES[view].x - camX) * Math.min(1, dt * 4);
    camera.position.set(camX + Math.sin(az) * 30, 24, Math.cos(az) * 30); camera.lookAt(camX, 0.5, 0);
    sun.position.set(camX + 8, 18, 10); sun.target.position.set(camX, 0, 0);
    GROUPS.forEach(g => (g.visible = Math.abs(g.position.x - camX) < 34));

    FX.forEach(f => (f.on = false));
    for (const m of crew.values()) {
      const c = m.c; stepMove(c, dt); animChar(c, dt);
      c.g.visible = Math.abs(c.g.position.x - camX) < 34; place(c);
      if (m.arrived && !m.leaving) {
        const s = slotPos(m.scene, m.slot); if (s.fx) s.fx.on = true;
        m.talk -= dt;
        if (m.talk <= 0) {
          m.talk = 8 + Math.random() * 10;
          const lines = c.penguin ? PENGUIN_LINES : m.scene === "factory" ? FACTORY_LINES : m.scene === "office" ? OFFICE_LINES : SHOP_LINES;
          say(c, pick(lines), 2800);
        }
      }
    }
    boss.g.visible = camX < 34; animChar(boss, dt); place(boss);
    const blinkFast = now / 90;
    FX.forEach(f => {
      if (f.kind === "screen") f.mesh.material.color.setHex(f.on ? (Math.sin(now / 120 + f.mesh.position.x) > -0.6 ? 0x5dade2 : 0x85c1e9) : 0x2a2f45);
      if (f.kind === "pos") f.mesh.material.color.setHex(f.on ? 0x58d68d : 0x2a2f45);
      if (f.kind === "oven") {
        f.mesh.material.color.setHex(f.on ? (Math.sin(blinkFast + f.seed) > -0.5 ? 0xff6a1a : 0xffa040) : 0x3a2a2a);
        if (f.on) { f.flipT += dt; const k = Math.floor(f.flipT / 1.8), ph = Math.min(1, (f.flipT % 1.8) / 0.45); f.mold.rotation.x = (k + ph) * Math.PI; }
        f.puffs.forEach(p => { if (f.on) { p.userData.t += dt; const tt = p.userData.t % 1.8; p.position.y = 1.95 + tt * 0.9; p.material.opacity = 0.55 * (1 - tt / 1.8); } else p.material.opacity = Math.max(0, p.material.opacity - dt); });
      }
    });
    // 客人
    const staffed = {}; for (const m of crew.values()) if (!m.leaving) staffed[m.scene] = true;
    Object.keys(GUESTS).forEach(k => GUESTS[k].forEach(g => { g.g.visible = !!staffed[k] && Math.abs(g.g.position.x - camX) < 34; animChar(g, dt); place(g); }));
    guestClock -= dt;
    if (guestClock <= 0) {
      guestClock = 3 + Math.random() * 4;
      const gs = staffed[view] && GUESTS[view];
      if (gs) { const g = pick(gs); g.anim = "talk"; say(g, pick(GUEST_LINES), 2600); setTimeout(() => (g.anim = "stand"), 2600); }
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  size(); raf = requestAnimationFrame(loop);

  return {
    setCrew,
    setAvatars(map) { AV_CFG = map || {}; setCrew(lastList); },
    setBoards(map) { Object.keys(BOARDS).forEach(k => drawBoard(k, (map && map[k]) || [])); },
    setView(k) { if (SCENES[k]) view = k; },
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
      window.removeEventListener("pointerup", onUp); window.removeEventListener("pointermove", onMove);
      renderer.dispose(); overlay.remove(); renderer.domElement.remove();
    },
  };
}
