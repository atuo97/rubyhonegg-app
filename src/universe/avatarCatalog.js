// ─────────────────────────────────────────────
// 紙娃娃造型目錄(宇宙辦公室小人)
// 純資料＋小函式,不依賴 three / React;編輯畫面與 3D 場景共用。
// 新增造型:在對應清單加一列即可(限定款還要把 id 加到後端 LIMITED_ITEMS)。
// ─────────────────────────────────────────────

export const SKINS = [
  { id: "s1", name: "白皙", c: 0xf8d9bd }, { id: "s2", name: "自然", c: 0xf5c9a0 },
  { id: "s3", name: "小麥", c: 0xe0a878 }, { id: "s4", name: "古銅", c: 0xb97c52 },
  { id: "s5", name: "深棕", c: 0x8a5a3c },
];
export const HAIR_STYLES = [
  { id: "short", name: "短髮" }, { id: "ponytail", name: "馬尾" }, { id: "bob", name: "鮑伯頭" },
  { id: "long", name: "長髮" }, { id: "bun", name: "包包頭" }, { id: "buzz", name: "小平頭" },
];
export const HAIR_COLORS = [
  { id: "black", name: "墨黑", c: 0x1a1a1a }, { id: "dbrown", name: "深棕", c: 0x2b1a10 },
  { id: "brown", name: "咖啡", c: 0x5a3825 }, { id: "chestnut", name: "栗色", c: 0x8a5a2b },
  { id: "blonde", name: "亞麻金", c: 0xd9b45a }, { id: "red", name: "赤紅", c: 0xb83227 },
  { id: "pink", name: "櫻粉", c: 0xe58fb0 }, { id: "blue", name: "靛藍", c: 0x3d5a9a },
  // 以下為赤心幣商店款(要先買)
  { id: "hc_mint", name: "薄荷綠", c: 0x7fd8be, shop: true }, { id: "hc_purple", name: "夢幻紫", c: 0x9b7fd8, shop: true },
  { id: "hc_silver", name: "銀白", c: 0xd9dde3, shop: true },
];
export const TOPS = [
  { id: "ruby", name: "紅玉制服", c: 0xc0392b }, { id: "white", name: "米白", c: 0xf1ece2 },
  { id: "navy", name: "深藍", c: 0x2f3e5c }, { id: "matcha", name: "抹茶綠", c: 0x6f9a5a },
  { id: "pink", name: "粉色", c: 0xf08fb0 }, { id: "yellow", name: "奶油黃", c: 0xf0c64a },
  { id: "black", name: "黑色", c: 0x2a2a30 }, { id: "orange", name: "澄橘", c: 0xe8833a },
];
export const PANTS = [
  { id: "gray", name: "深灰", c: 0x2c2c3a }, { id: "black", name: "黑色", c: 0x18181e },
  { id: "jeans", name: "牛仔藍", c: 0x3b5b8c }, { id: "khaki", name: "卡其", c: 0xb59b6a },
];
export const FACES = [
  { id: "none", name: "無" }, { id: "glasses", name: "眼鏡" },
  { id: "sunglasses", name: "墨鏡" }, { id: "mask", name: "口罩" },
];
// 帽子/頭飾:kind = free 全員可選 · season 只在期間內開放 · limited 管理者發放
export const HATS = [
  { id: "none", name: "無", kind: "free" },
  { id: "cap", name: "鴨舌帽", kind: "free" },
  { id: "chef", name: "廚師帽", kind: "free" },
  { id: "beanie", name: "毛帽", kind: "free" },
  { id: "santa", name: "聖誕帽", kind: "season", from: "12-01", to: "12-31", note: "12/1–12/31" },
  { id: "pumpkin", name: "南瓜頭飾", kind: "season", from: "10-15", to: "10-31", note: "10/15–10/31" },
  { id: "crown", name: "皇冠", kind: "limited", note: "管理者發放" },
  { id: "goldchef", name: "金廚師帽", kind: "limited", note: "管理者發放" },
  { id: "g_antenna", name: "外星觸角", kind: "shop" }, { id: "g_helmet", name: "太空頭盔", kind: "shop" },
  { id: "g_ufo", name: "小飛碟頭飾", kind: "shop" },
];
// 赤心幣商店／扭蛋:配件、服裝、名牌框(要先擁有才能穿,價格與來源以後端「商品目錄」為準)
export const ACCS = [
  { id: "none", name: "無" }, { id: "bowtie", name: "領結" }, { id: "scarf", name: "圍巾" }, { id: "backpack", name: "背包" },
  { id: "wings", name: "小翅膀" }, { id: "cape", name: "紅玉披風" }, { id: "halo", name: "光環" },
  { id: "g_starclip", name: "星星髮夾" }, { id: "g_moonpin", name: "月亮胸章" }, { id: "g_rocket", name: "火箭背包" },
  { id: "g_galaxy", name: "銀河披風" }, { id: "g_saturn", name: "土星光環" },
];
export const OUTFITS = [
  { id: "none", name: "無(穿上衣)" }, { id: "raincoat", name: "黃色雨衣" }, { id: "chefsuit", name: "主廚服" },
  { id: "spacesuit", name: "太空服" }, { id: "goldtrex", name: "金色小暴龍裝" },
];
export const FRAMES = [{ id: "none", name: "無" }, { id: "frame_wood", name: "木質名牌框" }, { id: "frame_glow", name: "發光名牌框" }];
export const MASCOTS = [
  { id: "none", name: "夥伴本人" }, { id: "trex", name: "小暴龍" }, { id: "penguin", name: "企鵝" },
];

export const SAYING_MAX = 24;
export const defaultCfg = () => ({
  saying: "", skin: "s2", hairStyle: "short", hairColor: "dbrown", top: "ruby", pants: "gray",
  face: "none", hat: "none", apron: true, mascot: "none", acc: "none", outfit: "none", frame: "none",
});

const has = (list, id) => list.some(x => x.id === id);
// 夥伴自己寫的一句話:去掉換行/控制字元與 < >,最多 24 字
export function cleanSaying(v) {
  return String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, SAYING_MAX);
}
// 只留下合法欄位與合法值(前後端各做一次,避免髒資料)
export function sanitize(cfg) {
  const d = defaultCfg(), c = cfg && typeof cfg === "object" ? cfg : {};
  return {
    skin: has(SKINS, c.skin) ? c.skin : d.skin,
    hairStyle: has(HAIR_STYLES, c.hairStyle) ? c.hairStyle : d.hairStyle,
    hairColor: has(HAIR_COLORS, c.hairColor) ? c.hairColor : d.hairColor,
    top: has(TOPS, c.top) ? c.top : d.top,
    pants: has(PANTS, c.pants) ? c.pants : d.pants,
    face: has(FACES, c.face) ? c.face : d.face,
    hat: has(HATS, c.hat) ? c.hat : d.hat,
    apron: c.apron === false ? false : true,
    mascot: has(MASCOTS, c.mascot) ? c.mascot : d.mascot,
    saying: cleanSaying(c.saying),
    acc: has(ACCS, c.acc) ? c.acc : "none",
    outfit: has(OUTFITS, c.outfit) ? c.outfit : "none",
    frame: has(FRAMES, c.frame) ? c.frame : "none",
  };
}

// 今天是否在期間內(mmdd 字串比較,例 "12-05")
export function inSeason(item, today /* "YYYY-MM-DD" */) {
  const md = String(today).slice(5, 10);
  return md >= item.from && md <= item.to;
}
// 這件帽子現在能不能戴:granted = 管理者發放給此人的 id 陣列
export function hatUnlocked(item, today, granted = [], owned = {}) {
  if (!item || item.kind === "free") return true;
  if (item.kind === "shop") return !!owned[item.id];
  if (item.kind === "season") return inSeason(item, today);
  return granted.includes(item.id);
}
export function hatLockText(item) {
  return item.kind === "season" ? "限定期間 " + item.note : item.kind === "shop" ? "扭蛋限定" : "限定款・" + item.note;
}

const pickC = (list, id) => (list.find(x => x.id === id) || list[0]).c;

// 設定 → 3D 場景用的參數(場景的 makeChar / makePenguin / makeTrex 讀這個)
// 期間過了的季節帽自動不戴;限定款以後端存檔時的檢查為準
const OUTFIT_COLORS = { chefsuit: [0xffffff, 0x2c2c3a], spacesuit: [0xdfe6ec, 0xdfe6ec], raincoat: [0xf4d03f, null] };
export function toSceneOpts(rawCfg, today) {
  const cfg = sanitize(rawCfg);
  const hatItem = HATS.find(h => h.id === cfg.hat);
  const hat = hatItem && hatItem.kind === "season" && !inSeason(hatItem, today) ? "none" : cfg.hat;
  const oc = OUTFIT_COLORS[cfg.outfit];
  const gold = cfg.outfit === "goldtrex";
  return {
    skin: pickC(SKINS, cfg.skin), hair: pickC(HAIR_COLORS, cfg.hairColor),
    hairStyle: cfg.hairStyle, shirt: oc ? oc[0] : pickC(TOPS, cfg.top), pants: oc && oc[1] ? oc[1] : pickC(PANTS, cfg.pants),
    face: cfg.face, hat, apron: cfg.apron, mascot: gold ? "trex" : cfg.mascot, saying: cfg.saying,
    acc: cfg.acc !== "none" ? cfg.acc : "", outfit: oc ? cfg.outfit : "", frame: cfg.frame !== "none" ? cfg.frame : "",
    trexColor: gold ? 0xf1c40f : 0,
    ponytail: cfg.hairStyle === "ponytail", bob: cfg.hairStyle === "bob", glasses: cfg.face === "glasses",
    penguin: !gold && cfg.mascot === "penguin",
  };
}
