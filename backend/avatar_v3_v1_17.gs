// ═══════════════════════════════════════════════
// 角色造型(紙娃娃)後端模組 v3(2026-11-10:新增配件 acc、服裝 outfit、名牌框 frame 與商店物品擁有檢查)。v2(2026-11-10,新增「頭頂一句話」;v1 已部署者,整段覆蓋即可)
// 貼在「程式碼.gs」最底部;再於 extHandler_ 內加 1 行(見最下方)。
// 會自動建立兩張工作表(第一次使用時):
//   「角色造型」 A 員工編號 · B 造型設定(JSON) · C 更新時間
//   「造型道具」 A 員工編號 · B 道具 id · C 發放者 · D 發放時間   ← 想收回限定款,直接刪掉那一列
// 限定款清單 LIMITED_ITEMS 要與前端 avatarCatalog.js 裡 kind:"limited" 的帽子 id 一致。
// ═══════════════════════════════════════════════
var AV_LIMITED_ITEMS = ['crown', 'goldchef'];
var AV_ALLOWED = {
  skin: ['s1','s2','s3','s4','s5'],
  hairStyle: ['short','ponytail','bob','long','bun','buzz'],
  hairColor: ['black','dbrown','brown','chestnut','blonde','red','pink','blue','hc_mint','hc_purple','hc_silver'],
  top: ['ruby','white','navy','matcha','pink','yellow','black','orange'],
  pants: ['gray','black','jeans','khaki'],
  face: ['none','glasses','sunglasses','mask'],
  hat: ['none','cap','chef','beanie','santa','pumpkin','crown','goldchef','g_antenna','g_helmet','g_ufo'],
  mascot: ['none','trex','penguin'],
  // v3 新增(赤心幣商店/扭蛋):要先擁有才能穿,擁有清單在「擁有物品」(宇宙遊戲化模組)
  acc: ['none','bowtie','scarf','backpack','wings','cape','halo','g_starclip','g_moonpin','g_rocket','g_galaxy','g_saturn'],
  outfit: ['none','raincoat','chefsuit','spacesuit','goldtrex'],
  frame: ['none','frame_wood','frame_glow']
};
var AV_DEFAULTS_ = { hairColor: 'dbrown', hat: 'none', acc: 'none', outfit: 'none', frame: 'none' };
// 商店／扭蛋物品:沒擁有就不能穿(回傳第一個沒擁有的物品編號;都有則回傳空字串)
function av_unowned_(empId, c, owned) {
  if (typeof gm_catalog_ !== 'function') return '';
  var cat = gm_catalog_(); owned = owned || gm_owned_(empId);
  var keys = ['hairColor', 'hat', 'acc', 'outfit', 'frame'];
  for (var i = 0; i < keys.length; i++) { var v = c[keys[i]]; if (v && cat[v] && !owned[v]) return v; }
  return '';
}
function av_stripUnowned_(empId, c, owned) {
  if (typeof gm_catalog_ !== 'function') return c;
  var cat = gm_catalog_();
  ['hairColor', 'hat', 'acc', 'outfit', 'frame'].forEach(function (k) { var v = c[k]; if (v && cat[v] && !owned[v]) c[k] = AV_DEFAULTS_[k]; });
  return c;
}

function av_sheet_(name, headers) {
  var ss = SpreadsheetApp.openById(SHEET_ID), sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(headers); sh.setFrozenRows(1); }
  return sh;
}
function av_grantedMap_() {            // empId → [item,...]
  var v = av_sheet_('造型道具', ['員工編號', '道具', '發放者', '發放時間']).getDataRange().getValues(), m = {};
  for (var i = 1; i < v.length; i++) {
    var id = String(v[i][0]).trim(), it = String(v[i][1]).trim();
    if (id && it) (m[id] = m[id] || []).push(it);
  }
  return m;
}
function av_clean_(raw) {              // 只留合法欄位與值
  var c = {};
  try { c = typeof raw === 'string' ? JSON.parse(raw) : (raw || {}); } catch (e) { c = {}; }
  var out = {};
  Object.keys(AV_ALLOWED).forEach(function (k) { if (AV_ALLOWED[k].indexOf(c[k]) >= 0) out[k] = c[k]; });
  out.apron = c.apron === false ? false : true;
  // 頭頂一句話:去控制字元與 < >,最多 24 字(前端用 textContent 顯示,不會執行任何程式)
  out.saying = String(c.saying == null ? '' : c.saying).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 24);
  return out;
}
function av_empExists_(empId) {
  var v = SpreadsheetApp.openById(SHEET_ID).getSheetByName('夥伴資料').getDataRange().getValues();
  for (var r = 1; r < v.length; r++) if (String(v[r][0]).trim() === empId) return v[r];
  return null;
}

// 全員造型(宇宙辦公室用)。限定款沒被發放的人,這裡會自動拿掉帽子。
function av_getAll_() {
  var cache = CacheService.getScriptCache(), hit = cache.get('av_all');
  if (hit) return { success: true, data: JSON.parse(hit) };
  var v = av_sheet_('角色造型', ['員工編號', '造型設定', '更新時間']).getDataRange().getValues(), g = av_grantedMap_(), out = {};
  var ownAll = null;
  if (typeof gm_rows_ === 'function') { GM_CACHE_ = {}; ownAll = {}; gm_rows_('owned').forEach(function (r) { (ownAll[r[0]] = ownAll[r[0]] || {})[r[1]] = 1; }); }
  for (var i = 1; i < v.length; i++) {
    var id = String(v[i][0]).trim(); if (!id) continue;
    var c = av_clean_(v[i][1]);
    if (AV_LIMITED_ITEMS.indexOf(c.hat) >= 0 && (g[id] || []).indexOf(c.hat) < 0) c.hat = 'none';
    if (ownAll) c = av_stripUnowned_(id, c, ownAll[id] || {});
    out[id] = c;
  }
  var s = JSON.stringify(out); if (s.length < 90000) cache.put('av_all', s, 60);
  return { success: true, data: out };
}
function av_getMy_(p) {
  var empId = String(p.empId || '').trim(); if (!empId) return { error: '缺少員工編號' };
  var v = av_sheet_('角色造型', ['員工編號', '造型設定', '更新時間']).getDataRange().getValues(), cfg = null;
  for (var i = 1; i < v.length; i++) if (String(v[i][0]).trim() === empId) { cfg = av_clean_(v[i][1]); break; }
  return { success: true, data: { cfg: cfg, granted: av_grantedMap_()[empId] || [] } };
}
function av_save_(p) {
  var empId = String(p.empId || '').trim(); if (!empId) return { error: '缺少員工編號' };
  if (!av_empExists_(empId)) return { error: '找不到此帳號' };
  var c = av_clean_(p.cfg);
  if (AV_LIMITED_ITEMS.indexOf(c.hat) >= 0 && (av_grantedMap_()[empId] || []).indexOf(c.hat) < 0) return { error: '這個造型尚未解鎖' };
  var un = av_unowned_(empId, c);
  if (un) return { error: '還沒擁有「' + ((gm_catalog_()[un] || {}).name || un) + '」' };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = av_sheet_('角色造型', ['員工編號', '造型設定', '更新時間']), v = sh.getDataRange().getValues(), now = new Date();
    for (var r = 1; r < v.length; r++) if (String(v[r][0]).trim() === empId) {
      sh.getRange(r + 1, 2, 1, 2).setValues([[JSON.stringify(c), now]]);
      CacheService.getScriptCache().remove('av_all'); return { success: true };
    }
    var row = sh.getLastRow() + 1;
    sh.getRange(row, 1).setNumberFormat('@').setValue(empId);
    sh.getRange(row, 2, 1, 2).setValues([[JSON.stringify(c), now]]);
    CacheService.getScriptCache().remove('av_all'); return { success: true };
  } finally { lock.releaseLock(); }
}
function av_grant_(p) {                // 管理者發放限定款
  var empId = String(p.empId || '').trim(), target = String(p.target || '').trim(), item = String(p.item || '').trim();
  if (!empId || !target || !item) return { error: '資料不完整' };
  if (AV_LIMITED_ITEMS.indexOf(item) < 0) return { error: '不是限定款' };
  var me = av_empExists_(empId), role = me ? me[12] : '';
  if (!(Number(role) >= 3 || /管理/.test(String(role)))) return { error: '只有管理者可以發放' };   // 夥伴資料第 13 欄為角色
  if (!av_empExists_(target)) return { error: '找不到員工編號 ' + target };
  if ((av_grantedMap_()[target] || []).indexOf(item) >= 0) return { success: true };
  av_sheet_('造型道具', ['員工編號', '道具', '發放者', '發放時間']).appendRow([target, item, empId, new Date()]);
  CacheService.getScriptCache().remove('av_all');
  return { success: true };
}

function avHandler_(action, p) {
  try {
    if (action === 'getAvatars') return av_getAll_();
    if (action === 'getMyAvatar') return av_getMy_(p || {});
    if (action === 'saveAvatar') return av_save_(p || {});
    if (action === 'grantItem') return av_grant_(p || {});
  } catch (e) { return { error: '造型功能發生錯誤:' + e.message }; }
  return null;
}

// 路由:在 extHandler_ 內、pollHandler_ / pwHandler_ 那幾行的下一行,加入:
//   var av = avHandler_(action, p); if (av) return av;
