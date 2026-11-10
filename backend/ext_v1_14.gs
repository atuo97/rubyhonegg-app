// ═══════════════════════════════════════════════
// 修改密碼 後端模組 v2(2026-11-10,對齊現有後端:SHEET_ID、extHandler_ 路由)
// 貼在「程式碼.gs」最底部;再於 extHandler_ 內加 2 行(見最下方)。
// 密碼欄位:優先找夥伴資料表頭為「密碼」的欄,找不到時用第 37 欄(AK,與登入相同)。
// ═══════════════════════════════════════════════
function pw_change_(p) {
  var empId = String(p.empId || '').trim();
  var oldPw = String(p.oldPassword || '').trim();
  var newPw = String(p.newPassword || '').trim();
  if (!empId || !oldPw || !newPw) return { error: '資料不完整' };
  if (newPw.length < 6 || newPw.length > 20 || /\s/.test(newPw)) return { error: '新密碼需為 6 到 20 個字元，且不可有空白' };
  if (newPw === oldPw) return { error: '新密碼不能與目前密碼相同' };

  // 防暴力猜測:同一員工 10 分鐘內目前密碼錯 5 次就先鎖住
  var cache = CacheService.getScriptCache(), key = 'pwfail_' + empId;
  var fails = Number(cache.get(key) || 0);
  if (fails >= 5) return { error: '嘗試次數過多，請 10 分鐘後再試，或聯絡門市總監' };

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('夥伴資料');
    var v = sh.getDataRange().getValues(), h = v[0];
    var pwC = 36;                                   // 預設第 37 欄(與登入一致)
    for (var i = 0; i < h.length; i++) {
      var t = String(h[i]).trim();
      if (t === '密碼' || t === '登入密碼') { pwC = i; break; }
    }
    for (var r = 1; r < v.length; r++) {
      if (String(v[r][0]).trim() !== empId) continue;          // 員工編號在 A 欄(與登入回傳的 id 一致)
      if (String(v[r][pwC] || '').trim() !== oldPw) {
        cache.put(key, String(fails + 1), 600);
        return { error: '目前密碼不正確' };
      }
      var cell = sh.getRange(r + 1, pwC + 1);
      cell.setNumberFormat('@');                               // 存成文字,避免 000123 變成 123
      cell.setValue(newPw);
      cache.remove(key);
      return { success: true };
    }
    return { error: '找不到此帳號' };
  } finally {
    lock.releaseLock();
  }
}

function pwHandler_(action, p) {
  try {
    if (action === 'changePassword') return pw_change_(p || {});
  } catch (e) { return { error: '修改密碼失敗:' + e.message }; }
  return null;
}

// 路由:在 extHandler_ 內、`var pr = pollHandler_(action, p); if (pr) return pr;` 的下一行,加入:
//   var pw = pwHandler_(action, p); if (pw) return pw;
// (extHandler_ 在 doGet / doPost 開頭都會先被呼叫;前端用 POST 送出,密碼不會出現在網址)

// ═══════════════════════════════════════════════
// 角色造型(紙娃娃)後端模組 v1(2026-11-10)
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
  hairColor: ['black','dbrown','brown','chestnut','blonde','red','pink','blue'],
  top: ['ruby','white','navy','matcha','pink','yellow','black','orange'],
  pants: ['gray','black','jeans','khaki'],
  face: ['none','glasses','sunglasses','mask'],
  hat: ['none','cap','chef','beanie','santa','pumpkin','crown','goldchef'],
  mascot: ['none','trex','penguin']
};

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
  for (var i = 1; i < v.length; i++) {
    var id = String(v[i][0]).trim(); if (!id) continue;
    var c = av_clean_(v[i][1]);
    if (AV_LIMITED_ITEMS.indexOf(c.hat) >= 0 && (g[id] || []).indexOf(c.hat) < 0) c.hat = 'none';
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


// ═══════════════════════════════════════════════
// 宇宙辦公室 · 在班名單 v1.14(2026-11-10)
// 一次讀「打卡紀錄」算出今天所有在班夥伴(判斷方式同 getActiveSegment),全員可用。
// 只回傳 員工編號、姓名、櫃位、上班時間。
// ═══════════════════════════════════════════════
function uo_onDutyCrew_(p) {
  var date = String((p && p.date) || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var staff = ss.getSheetByName('夥伴資料').getDataRange().getValues(), names = {};
  for (var s = 1; s < staff.length; s++) {
    if (!staff[s][0] || staff[s][10]) continue;          // 跳過離職
    names[String(staff[s][0])] = String(staff[s][1] || '');
  }
  var punch = ss.getSheetByName('打卡紀錄').getDataRange().getValues(), byEmp = {};
  for (var i = 1; i < punch.length; i++) {
    var r = punch[i], id = String(r[2]);
    if (!names.hasOwnProperty(id) || dateNorm(r[1]) !== date) continue;
    (byEmp[id] = byEmp[id] || []).push({ type: String(r[5]), time: r[6] ? new Date(r[6]) : null, loc: String(r[9] || '') });
  }
  var out = [];
  Object.keys(byEmp).forEach(function (id) {
    var rows = byEmp[id].sort(function (a, b) { return (a.time && b.time) ? a.time - b.time : 0; }), open = null;
    rows.forEach(function (x) {
      if (x.type === '上班') { if (!open) open = { location: x.loc, inTime: x.time }; }
      else if (x.type === '下班') { if (open && open.location === x.loc) open = null; }
    });
    if (open && open.location) out.push({ id: id, name: names[id], location: open.location, inTime: open.inTime ? open.inTime.toISOString() : null });
  });
  return { success: true, data: out };
}
