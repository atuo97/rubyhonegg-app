// ═══════════════════════════════════════════════
// v1.26 食安稽查＋叫貨品項＋常用物料＋補貨看板＋SOP 教學（2026-11-13）
// 貼在「登入驗證 v1.25」之後、「路由v1.26」之前。部署後執行一次 fs_setup()
// 1. 叫貨：新分類「清潔用品」、製作器具／其他新增品項；〈供貨價格〉F 欄「常用」（宇宙辦公室快速選項）
// 2. 補貨看板：未處理 → 已發貨（Lv.3）→ 已補齊；〈缺貨看板〉J「發貨時間」K「發貨人」
// 3. 食安：冰箱溫度（上下班每台都填，0～7°C）、儀容勾選、櫃位證照、夥伴體檢表（只有本人與管理者看得到）
// 4. SOP 教學：〈SOP〉可放任何類型（開店、收店、攪拌麵糊、烤雞蛋糕…）；G 欄「注意事項」；Lv.3 可在 App 編輯
// 覆蓋：RP_MAT_CATALOG、RP_MAT_CATS、OPS_PRICE_HEAD、ops_prices_、rp_priceSorted_、ops_priceList_、ops_priceSave_、
//       uo_getShortages、uo_resolveShortage、sop_get_、AU_READ
// ═══════════════════════════════════════════════

// ── 1. 叫貨品項 ──
RP_MAT_CATALOG = [
  ['原物料', [['原味麵糊', '包'], ['可可麵糊', '包'], ['紅玉麵糊', '包'], ['抹茶麵糊', '包'], ['黑糖麵糊', '包'], ['芝麻麵糊', '包'],
              ['可可粉', '包'], ['紅玉紅茶粉', '包'], ['抹茶粉', '包'], ['黑糖粉', '包'], ['芝麻粉', '包'], ['低筋麵粉', '袋'], ['泡打粉', '罐'], ['二砂糖', '包']]],
  ['包材', [['紙袋', '包'], ['空白紙袋', '包'], ['紙盒', '個'], ['竹籤', '包'], ['塑膠提袋', '包']]],
  ['製作器具', [['攪拌機', '台'], ['麵糊桶', '個'], ['麵糊漏斗', '個'], ['麵糊叉子', '支'], ['毛刷', '支'], ['平刀', '支'], ['測溫槍', '支'],
                ['秤重器', '台'], ['湯匙', '支'], ['過篩網', '個'], ['六角扳手5號', '支'], ['六角扳手3號', '支'], ['十字起子', '支'], ['剪刀', '支'],
                ['推車', '台'], ['保冷袋', '個'], ['延長線', '條'], ['轉接頭', '個'], ['計時器', '個'], ['降溫風扇', '台'], ['鐵盤', '個'], ['塑膠桌墊', '張'], ['電池', '顆']]],
  ['清潔用品', [['濕紙巾', '包'], ['清潔劑', '瓶'], ['菜瓜布', '個'], ['烤盤油', '瓶'], ['模布', '條'], ['漂白水', '瓶'], ['一點絕', '盒'], ['黏鼠板', '片'], ['有蓋垃圾桶', '個']]],
  ['文具', [['菜單表', '張'], ['原子筆', '支'], ['白板筆', '支'], ['訂書機', '個'], ['訂書針', '盒'], ['膠水', '瓶']]],
  ['機器保養', [['機器鍍膜', '次']]],
  ['其他', [['桌布', '條'], ['椅子', '張'], ['其他', '']]]
];
RP_MAT_CATS = RP_MAT_CATALOG.map(function (c) { return c[0]; });
OPS_PRICE_HEAD = ['品項', '單位', '單價', '備註', '分類', '常用'];
var FS_FAV_DEFAULT = ['原味麵糊', '可可麵糊', '紅玉麵糊', '抹茶麵糊', '黑糖麵糊', '芝麻麵糊', '紙袋', '紙盒', '竹籤', '塑膠提袋', '機器鍍膜'];
var FS_FLAVOR_BATTER = ['可可麵糊', '紅玉麵糊', '抹茶麵糊', '黑糖麵糊', '芝麻麵糊'];
function fs_yes_(v) { return /^(是|Y|TRUE|v|✓|✔|1)$/i.test(String(v == null ? '' : v).trim()); }

function ops_prices_() {
  var sh = ops_sheet_('供貨價格', OPS_PRICE_HEAD), out = {};
  ops_rows_(sh, 6).forEach(function (r, i) {
    var n = String(r[0]).trim(); if (!n) return;
    out[n] = { unit: String(r[1] || ''), price: r[2] === '' ? null : ops_num_(r[2]), note: String(r[3] || ''), cat: String(r[4] || '') || rp_catOf_(n) || '其他', fav: fs_yes_(r[5]), order: i };
  });
  if (out['原味麵糊'] && !out['麵糊']) out['麵糊'] = out['原味麵糊'];
  return out;
}
function rp_priceSorted_() {
  var pr = ops_prices_();
  return Object.keys(pr).filter(function (k) { return !(k === '麵糊' && pr['原味麵糊'] === pr[k]); }).map(function (k) { return { item: k, unit: pr[k].unit, price: pr[k].price, note: pr[k].note, cat: pr[k].cat, fav: pr[k].fav, order: pr[k].order }; })
    .sort(function (a, b) {
      var ca = RP_MAT_CATS.indexOf(a.cat), cb = RP_MAT_CATS.indexOf(b.cat); if (ca < 0) ca = 98; if (cb < 0) cb = 98;
      if (a.item === '其他') ca = 99; if (b.item === '其他') cb = 99;
      if (ca !== cb) return ca - cb;
      var ia = rp_idx_(a.item), ib = rp_idx_(b.item);
      return ia !== ib ? ia - ib : a.order - b.order;
    });
}
function ops_priceList_(p) {
  ops_need_(p, 2);
  return { success: true, cats: RP_MAT_CATS, data: rp_priceSorted_().map(function (x) { delete x.order; return x; }) };
}
function ops_priceSave_(p) {
  ops_need_(p, 3, true);
  var list = ops_arr_(p.list), sh = ops_sheet_('供貨價格', OPS_PRICE_HEAD);
  if (!String(sh.getRange(1, 6).getValue()).trim()) sh.getRange(1, 6).setValue('常用');
  var rows = list.filter(function (x) { return String(x.item || '').trim(); }).map(function (x) {
    var price = x.price === '' || x.price === null || x.price === undefined ? '' : ops_num_(x.price);
    var cat = String(x.cat || '').trim(); if (RP_MAT_CATS.indexOf(cat) < 0) cat = rp_catOf_(String(x.item).trim()) || '其他';
    return [String(x.item).trim().slice(0, 20), String(x.unit || '').slice(0, 6), price, String(x.note || '').slice(0, 60), cat, x.fav ? '是' : ''];
  });
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 6).clearContent();
    if (rows.length) sh.getRange(2, 1, rows.length, 6).setValues(rows);
  } finally { lock.releaseLock(); }
  CacheService.getScriptCache().remove('fs_quick');
  return { success: true };
}
// 宇宙辦公室快速選項：勾「常用」的品項；口味麵糊合併成一顆
function fs_quick_() {
  var c = CacheService.getScriptCache(), hit = c.get('fs_quick'); if (hit) return JSON.parse(hit);
  var out = [], flavor = false;
  rp_priceSorted_().forEach(function (x) {
    if (!x.fav || /停用/.test(x.note || '')) return;
    if (FS_FLAVOR_BATTER.indexOf(x.item) >= 0) { if (!flavor) { flavor = true; out.push('口味麵糊'); } return; }
    out.push(x.item);
  });
  c.put('fs_quick', JSON.stringify(out), 300);
  return out;
}

// ── 2. 補貨看板（工廠出貨）──
var UO_HEADERS = ['編號', '登記時間', '櫃位', '品項', '登記人編號', '登記人', '狀態', '補齊時間', '補齊人', '發貨時間', '發貨人'];
function uo_getShortages() {
  var sh = uo_sheet_(), last = sh.getLastRow(), quick = [];
  try { quick = fs_quick_(); } catch (e) {}
  if (last < 2) return { success: true, data: [], quick: quick };
  var w = Math.min(11, Math.max(9, sh.getLastColumn()));
  var data = sh.getRange(2, 1, last - 1, w).getValues()
    .filter(function (r) { return r[0] && r[6] !== '已補齊'; })
    .map(function (r) {
      var ship = r[9] instanceof Date ? Utilities.formatDate(r[9], 'Asia/Taipei', 'yyyy-MM-dd HH:mm') : String(r[9] || '');
      return { id: String(r[0]), time: r[1] instanceof Date ? r[1].toISOString() : String(r[1]), location: String(r[2]), item: String(r[3]), by: String(r[5]),
        status: r[6] === '已發貨' ? '已發貨' : '未處理', shipAt: ship, shipBy: String(r[10] || '') };
    });
  return { success: true, data: data, quick: quick };
}
function uo_setStatus_(id, status, who) {
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var sh = uo_sheet_(), last = sh.getLastRow();
    if (last < 2) return { success: false, error: '找不到這筆需求' };
    if (!String(sh.getRange(1, 10).getValue()).trim()) sh.getRange(1, 10, 1, 2).setValues([['發貨時間', '發貨人']]);
    var ids = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) !== String(id)) continue;
      if (status === '已發貨') { sh.getRange(i + 2, 7).setValue('已發貨'); sh.getRange(i + 2, 10, 1, 2).setValues([[new Date(), who]]); }
      else sh.getRange(i + 2, 7, 1, 3).setValues([['已補齊', new Date(), who]]);
      return { success: true };
    }
    return { success: false, error: '找不到這筆需求' };
  } finally { lock.releaseLock(); }
}
function uo_shipShortage_(p) {
  var me = ops_me_(p.empId);
  if (me.role < 3) return { error: '「已發貨」由總部按（Lv.3 以上）' };
  return uo_setStatus_(p.id, '已發貨', me.name);
}
function uo_resolveShortage(d) {
  var who = d.name || d.empId || '';
  try { who = ops_me_(d.empId).name; } catch (e) {}
  return uo_setStatus_(d.id, '已補齊', who);
}

// ── 3. 食安 ──
var FS_LOG_HEAD = ['編號', '時間', '日期', '櫃位', '員工編號', '姓名', '上下班', '冰箱溫度(JSON)', '異常', '儀容(JSON)'];
var FS_CERT_HEAD = ['櫃位', '食品業者登錄字號', '產品責任險公司', '產品責任險保單號碼', '產品責任險到期日', '產品責任險照片',
  '公共意外險公司', '公共意外險保單號碼', '公共意外險到期日', '公共意外險照片', '其他證照', '更新人', '更新時間'];
var FS_HEALTH_HEAD = ['編號', '員工編號', '姓名', '上傳時間', '檔案ID', '體檢日期', '到期日', '狀態', '確認人', '確認時間', '備註'];
var FS_GROOM = ['帽子', '口罩', '品牌制服', '沒有穿拖鞋'];
var FS_HQ = '總部';

function fs_range_() {
  var lo = 0, hi = 7;
  try { lo = Number(ops_param_('冰箱溫度下限', 0)); hi = Number(ops_param_('冰箱溫度上限', 7)); } catch (e) {}
  return { min: isFinite(lo) ? lo : 0, max: isFinite(hi) ? hi : 7 };
}
function fs_fridges_() {
  var sh = ops_ss_().getSheetByName('櫃位設定'), v = sh.getDataRange().getValues(), h = (v[0] || []).map(String), c = h.indexOf('冰箱'), out = {};
  for (var r = 1; r < v.length; r++) {
    var n = String(v[r][0]).trim(); if (!n) continue;
    var list = c >= 0 ? String(v[r][c] || '').split(/[,，、]/).map(function (s) { return s.trim(); }).filter(String) : [];
    out[n] = list.length ? list : ['冰箱'];
  }
  return out;
}
function fs_meta_(p) { return { success: true, range: fs_range_(), fridges: fs_fridges_(), groom: FS_GROOM }; }

// 打卡後記錄冰箱溫度與儀容；超出範圍 → 門市回報＋LINE
function fs_log_(p) {
  var me = ops_me_(p.empId), loc = String(p.loc || '').trim(), type = p.type === '下班' ? '下班' : '上班';
  if (!loc) return { error: '缺少櫃位' };
  var rg = fs_range_(), temps = ops_arr_(p.temps).map(function (x) { return { name: String(x.name || '冰箱').slice(0, 12), t: Number(x.t) }; })
    .filter(function (x) { return isFinite(x.t) && String(x.t) !== ''; });
  var bad = temps.filter(function (x) { return x.t < rg.min || x.t > rg.max; });
  var groom = type === '上班' ? ops_arr_(p.groom).map(String).filter(function (g) { return FS_GROOM.indexOf(g) >= 0; }) : [];
  var id = typeof au_id_ === 'function' ? au_id_('F') : 'F' + Date.now();
  ops_sheet_('食安紀錄', FS_LOG_HEAD).appendRow([id, ops_now_(), Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd'), loc, me.id, me.name, type,
    JSON.stringify(temps), bad.length ? '是' : '', type === '上班' ? JSON.stringify(groom) : '']);
  var report = '';
  if (bad.length) {
    try {
      var desc = type + '打卡量到：' + bad.map(function (x) { return x.name + ' ' + x.t + '°C'; }).join('、') + '（正常 ' + rg.min + '～' + rg.max + '°C）';
      var r = rp_create_({ empId: me.id, loc: loc, cat: '機器報修', item: '冰箱溫度異常', desc: desc, urg: '今天要處理' });
      report = r && r.id || '';
    } catch (e) {}
  }
  return { success: true, id: id, abnormal: bad.length > 0, report: report, range: rg };
}
// 溫度紀錄（儀表板／匯出）：Lv.2 只看負責櫃位
function fs_temps_(p) {
  var me = ops_me_(p.empId); if (me.role < 2) return { error: '需要 Lv.2 以上' };
  var ym = /^\d{4}-\d{2}$/.test(p.ym || '') ? p.ym : Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM'), mine = ops_myLocs_(me), loc = String(p.loc || '');
  var rows = ops_rows_(ops_sheet_('食安紀錄', FS_LOG_HEAD), FS_LOG_HEAD.length).filter(function (r) {
    var l = String(r[3]); return String(r[2]).slice(0, 7) === ym && (!loc || l === loc) && (me.role >= 3 || mine.indexOf(l) >= 0);
  }).map(function (r) { return { at: String(r[1]), date: String(r[2]), loc: String(r[3]), name: String(r[5]), type: String(r[6]), temps: ops_json_(String(r[7] || ''), []), bad: String(r[8]) === '是', groom: ops_json_(String(r[9] || ''), null) }; });
  return { success: true, ym: ym, range: fs_range_(), data: rows.reverse() };
}

// 櫃位證照
function fs_certRows_() {
  var out = {};
  ops_rows_(ops_sheet_('櫃位證照', FS_CERT_HEAD), FS_CERT_HEAD.length).forEach(function (r) {
    var n = String(r[0]).trim(); if (!n) return;
    var d = function (v) { return v instanceof Date ? Utilities.formatDate(v, 'Asia/Taipei', 'yyyy-MM-dd') : String(v || ''); };
    out[n] = { loc: n, reg: String(r[1] || ''), plCo: String(r[2] || ''), plNo: String(r[3] || ''), plExp: d(r[4]), plPhoto: String(r[5] || ''),
      paCo: String(r[6] || ''), paNo: String(r[7] || ''), paExp: d(r[8]), paPhoto: String(r[9] || ''), other: String(r[10] || ''), by: String(r[11] || ''), at: String(r[12] || '') };
  });
  return out;
}
function fs_certFor_(all, loc) {               // 櫃位沒填的欄位用「總部」那一筆補
  var hq = all[FS_HQ] || {}, own = all[loc] || {}, o = { loc: loc };
  ['reg', 'plCo', 'plNo', 'plExp', 'plPhoto', 'paCo', 'paNo', 'paExp', 'paPhoto', 'other'].forEach(function (k) { o[k] = own[k] || hq[k] || ''; });
  o.fromHq = !all[loc];
  return o;
}
function fs_checkup_(raw) {                    // 夥伴資料 AF 欄（index 31）體檢到期
  var v = raw[31], d = v instanceof Date ? Utilities.formatDate(v, 'Asia/Taipei', 'yyyy-MM-dd') : String(v || '').trim().replace(/\//g, '-');
  if (!/^\d{4}-\d{1,2}-\d{1,2}/.test(d)) return { exp: '', status: '未上傳' };
  var days = Math.floor((new Date(d + 'T23:59:59+08:00').getTime() - Date.now()) / 86400000);
  return { exp: d.slice(0, 10), status: days < 0 ? '過期' : days <= 30 ? '即將到期' : '有效', days: days };
}
function fs_onDuty_(loc) {
  var sh = ops_ss_().getSheetByName('打卡紀錄'); if (!sh || sh.getLastRow() < 2) return [];
  var today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd'), last = {}, n = sh.getLastRow(), from = Math.max(2, n - 600);
  sh.getRange(from, 1, n - from + 1, 10).getValues().forEach(function (r) {
    var d = r[1] instanceof Date ? Utilities.formatDate(r[1], 'Asia/Taipei', 'yyyy-MM-dd') : String(r[1]).slice(0, 10);
    if (d !== today) return;
    last[String(r[2])] = { type: String(r[5]), loc: String(r[9]) };
  });
  return Object.keys(last).filter(function (e) { return last[e].type === '上班' && ops_sameLoc_(last[e].loc, loc); });
}
// 稽查資料：本櫃位證照＋今天在班夥伴的體檢狀態（不含體檢內容）
function fs_audit_(p) {
  var me = ops_me_(p.empId), loc = String(p.loc || '').trim();
  if (!loc) return { error: '請選櫃位' };
  var staff = ops_staff_().map, ids = fs_onDuty_(loc);
  if (ids.indexOf(me.id) < 0 && me.role < 2) ids.push(me.id);
  var crew = ids.map(function (id) { var s = staff[id]; if (!s) return null; var c = fs_checkup_(s.raw); return { name: s.name, exp: c.exp, status: c.status }; }).filter(Boolean);
  return { success: true, cert: fs_certFor_(fs_certRows_(), loc), crew: crew };
}
function fs_certList_(p) {
  ops_need_(p, 3);
  var all = fs_certRows_(), locs = [FS_HQ].concat(ops_locs_().filter(function (x) { return !/已停用|已結束/.test(x.status); }).map(function (x) { return x.name; }));
  return { success: true, data: locs.map(function (l) { var o = all[l] || { loc: l }; o.loc = l; return o; }) };
}
function fs_certSave_(p) {
  var me = ops_need_(p, 3, true), c = p.cert || {}; if (typeof c === 'string') c = ops_json_(c, {});
  var loc = String(c.loc || '').trim(); if (!loc) return { error: '缺少櫃位' };
  if (loc !== FS_HQ && !ops_locByName_(loc)) return { error: '找不到櫃位' };
  var sh = ops_sheet_('櫃位證照', FS_CERT_HEAD), s = function (v, n) { return String(v || '').trim().slice(0, n || 60); };
  var row = [loc, s(c.reg), s(c.plCo), s(c.plNo), s(c.plExp, 10), s(c.plPhoto, 300), s(c.paCo), s(c.paNo), s(c.paExp, 10), s(c.paPhoto, 300), s(c.other, 300), me.name, ops_now_()];
  var rows = ops_rows_(sh, 1), at = -1;
  for (var i = 0; i < rows.length; i++) if (String(rows[i][0]).trim() === loc) { at = i + 2; break; }
  if (at > 0) sh.getRange(at, 1, 1, row.length).setValues([row]); else sh.appendRow(row);
  return { success: true };
}

// 體檢表：檔案不公開（只有 Apps Script 擁有者），App 透過 fsHealthView 讀圖
function fs_healthFolder_() {
  var roots = DriveApp.getFoldersByName(DRIVE_ROOT), root = roots.hasNext() ? roots.next() : DriveApp.createFolder(DRIVE_ROOT);
  var subs = root.getFoldersByName('體檢表（不公開）');
  return subs.hasNext() ? subs.next() : root.createFolder('體檢表（不公開）');
}
function fs_healthUpload_(p) {
  var me = ops_me_(p.empId); if (p._viewAs) return { error: '預覽模式只能看' };
  if (!p.base64) return { error: '請拍體檢表' };
  var date = String(p.examDate || '').trim(); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: '請填體檢日期' };
  var f = fs_healthFolder_().createFile(Utilities.newBlob(Utilities.base64Decode(p.base64), 'image/jpeg', me.id + '_' + date + '_' + Date.now() + '.jpg'));
  try { f.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE); } catch (e) {}
  var id = typeof au_id_ === 'function' ? au_id_('H') : 'H' + Date.now();
  ops_sheet_('體檢表', FS_HEALTH_HEAD).appendRow([id, me.id, me.name, ops_now_(), f.getId(), date, '', '待確認', '', '', '']);
  return { success: true, id: id };
}
function fs_healthRows_() {
  return ops_rows_(ops_sheet_('體檢表', FS_HEALTH_HEAD), FS_HEALTH_HEAD.length).map(function (r, i) {
    var d = function (v) { return v instanceof Date ? Utilities.formatDate(v, 'Asia/Taipei', 'yyyy-MM-dd') : String(v || ''); };
    return { row: i + 2, id: String(r[0]), empId: String(r[1]), name: String(r[2]), at: String(r[3]), file: String(r[4]), exam: d(r[5]), exp: d(r[6]), status: String(r[7] || '待確認'), by: String(r[8] || ''), note: String(r[10] || '') };
  }).filter(function (x) { return x.id; });
}
function fs_healthMine_(p) {
  var me = ops_me_(p.empId), c = fs_checkup_(me.raw);
  var list = fs_healthRows_().filter(function (x) { return x.empId === me.id; }).reverse().map(function (x) { delete x.file; delete x.row; return x; });
  return { success: true, exp: c.exp, status: c.status, days: c.days, list: list };
}
function fs_healthList_(p) {
  var me = ops_need_(p, 3), staff = ops_staff_();
  var rows = fs_healthRows_(), pending = rows.filter(function (x) { return x.status === '待確認'; }).map(function (x) { delete x.file; delete x.row; return x; });
  var people = staff.list.filter(function (s) { return !s.left; }).map(function (s) { var c = fs_checkup_(s.raw); return { id: s.id, name: s.name, exp: c.exp, status: c.status, days: c.days }; })
    .sort(function (a, b) { var o = { '過期': 0, '未上傳': 1, '即將到期': 2, '有效': 3 }; return o[a.status] - o[b.status] || (a.days || 0) - (b.days || 0); });
  return { success: true, pending: pending, people: people };
}
function fs_healthView_(p) {
  var me = ops_me_(p.empId), x = fs_healthRows_().filter(function (r) { return r.id === String(p.id); })[0];
  if (!x) return { error: '找不到' };
  var viewer = p._viewAs ? ops_me_(p._viewAs) : me;
  if (viewer.id !== x.empId && viewer.role < 3) return { error: '體檢表只有本人與管理者可以看' };
  var b = DriveApp.getFileById(x.file).getBlob();
  return { success: true, mime: b.getContentType(), base64: Utilities.base64Encode(b.getBytes()) };
}
function fs_healthDecide_(p) {
  var me = ops_need_(p, 3, true), x = fs_healthRows_().filter(function (r) { return r.id === String(p.id); })[0];
  if (!x) return { error: '找不到' };
  var sh = ops_sheet_('體檢表', FS_HEALTH_HEAD);
  if (p.ok) {
    var exp = String(p.exp || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(exp)) { var d = new Date(x.exam + 'T00:00:00+08:00'); d.setFullYear(d.getFullYear() + 1); exp = Utilities.formatDate(d, 'Asia/Taipei', 'yyyy-MM-dd'); }
    sh.getRange(x.row, 7, 1, 5).setValues([[exp, '已確認', me.name, ops_now_(), String(p.note || '').slice(0, 100)]]);
    var s = ops_staff_().map[x.empId]; if (s) ops_ss_().getSheetByName('夥伴資料').getRange(s.row, 32).setValue(exp);
    OPS_C_.staff = null;
  } else {
    sh.getRange(x.row, 8, 1, 4).setValues([['退回', me.name, ops_now_(), String(p.note || '看不清楚，請重拍').slice(0, 100)]]);
  }
  return { success: true };
}

// ── 4. SOP 教學 ──
var SOP_TYPES = ['開店', '收店', '攪拌麵糊', '烤雞蛋糕'];
function sop_get_() {
  var c = CacheService.getScriptCache(), hit = c.get('sop_all2'); if (hit) return JSON.parse(hit);
  var sh = sop_sheet_(), v = sh.getDataRange().getValues(), out = {};
  SOP_TYPES.forEach(function (t) { out[t] = []; });
  for (var r = 1; r < v.length; r++) {
    var t = String(v[r][0]).trim(); if (!t || /^(否|N|FALSE)$/i.test(String(v[r][5]).trim())) continue;
    (out[t] = out[t] || []).push({ n: Number(v[r][1]) || r, title: String(v[r][2]), desc: String(v[r][3] || ''), img: String(v[r][4] || ''), warn: String(v[r][6] || '') });
  }
  Object.keys(out).forEach(function (k) { out[k].sort(function (a, b) { return a.n - b.n; }); });
  var res = { success: true, data: out, types: Object.keys(out) };
  c.put('sop_all2', JSON.stringify(res), 300);
  return res;
}
function sop_save_(p) {
  ops_need_(p, 3, true);
  var type = String(p.type || '').trim().slice(0, 12); if (!type) return { error: '請填 SOP 名稱' };
  var steps = ops_arr_(p.steps).filter(function (x) { return String(x.title || '').trim(); });
  var sh = sop_sheet_();
  if (!String(sh.getRange(1, 7).getValue()).trim()) sh.getRange(1, 7).setValue('注意事項');
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var v = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues() : [];
    var keep = v.filter(function (r) { return String(r[0]).trim() && String(r[0]).trim() !== type; });
    var add = steps.map(function (x, i) { return [type, i + 1, String(x.title).trim().slice(0, 30), String(x.desc || '').slice(0, 500), String(x.img || '').slice(0, 300), '是', String(x.warn || '').slice(0, 300)]; });
    var rows = keep.concat(add);
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 7).clearContent();
    if (rows.length) sh.getRange(2, 1, rows.length, 7).setValues(rows);
  } finally { lock.releaseLock(); }
  CacheService.getScriptCache().remove('sop_all2'); CacheService.getScriptCache().remove('sop_all');
  return { success: true };
}

// ── 夥伴視角：新增的讀取動作放行 ──
AU_READ = /^(get|check|estimate)|List$|^(annFeed|annOptions|annReaders|buList|opsFranchise|opsMatItems|opsMatMonthly|opsMe|opsOnboard|opsPnl|opsPriceList|opsReceivable|payRecon|pvLiveMine|pvLiveState|pvMe|rpCount|rpMeta|schBoard|schMine|schReconcile|spList|spScene|tdMe|gmMe|gmScene|gmGames|lineGroups|lineQuota|login|fsMeta|fsTemps|fsAudit|fsHealthMine|fsHealthView)$/;

function fsHandler_(action, p) {
  var map = {
    fsMeta: fs_meta_, fsLog: fs_log_, fsTemps: fs_temps_, fsAudit: fs_audit_, fsCertList: fs_certList_, fsCertSave: fs_certSave_,
    fsHealthUpload: fs_healthUpload_, fsHealthMine: fs_healthMine_, fsHealthList: fs_healthList_, fsHealthView: fs_healthView_, fsHealthDecide: fs_healthDecide_,
    sopSave: sop_save_, shipShortage: uo_shipShortage_
  };
  try {
    if (action === 'getSop') return sop_get_();
    if (action === 'getShortages') return uo_getShortages();
    if (action === 'resolveShortage') return uo_resolveShortage(p);
    if (!map[action]) return null;
    return map[action](p);
  } catch (e) { return { error: e.message }; }
}

// 部署後執行一次
function fs_setup() {
  var log = [], ss = ops_ss_();
  // 供貨價格：F 欄常用、新品項
  var sh = ops_sheet_('供貨價格', OPS_PRICE_HEAD);
  if (!String(sh.getRange(1, 5).getValue()).trim()) sh.getRange(1, 5).setValue('分類');
  if (String(sh.getRange(1, 6).getValue()).trim() !== '常用') sh.getRange(1, 6).setValue('常用');
  var rows = ops_rows_(sh, 6).filter(function (r) { return String(r[0]).trim(); }), have = {};
  var hadFav = rows.some(function (r) { return String(r[5] || '').trim(); });   // 還沒人勾過常用 → 套預設
  rows.forEach(function (r) { var n = String(r[0]).trim(); have[n] = 1; if (!String(r[4] || '').trim()) r[4] = rp_catOf_(n) || '其他'; if (!hadFav && FS_FAV_DEFAULT.indexOf(n) >= 0) r[5] = '是'; });
  RP_MAT_CATALOG.forEach(function (c) { c[1].forEach(function (x) { if (x[0] === '其他' || have[x[0]]) return; rows.push([x[0], x[1], '', '單價待補', c[0], FS_FAV_DEFAULT.indexOf(x[0]) >= 0 ? '是' : '']); have[x[0]] = 1; log.push('新增 ' + c[0] + '／' + x[0]); }); });
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 6).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, 6).setValues(rows.map(function (r) { return [r[0], r[1], r[2], r[3], r[4], r[5] || '']; }));
  if (!hadFav) log.push('預設常用：' + FS_FAV_DEFAULT.join('、'));
  // 缺貨看板
  var uo = uo_sheet_(); if (!String(uo.getRange(1, 10).getValue()).trim()) { uo.getRange(1, 10, 1, 2).setValues([['發貨時間', '發貨人']]); log.push('〈缺貨看板〉加發貨時間、發貨人'); }
  // 櫃位設定：冰箱欄
  var ls = ss.getSheetByName('櫃位設定'), h = ls.getRange(1, 1, 1, ls.getLastColumn()).getValues()[0].map(String);
  if (h.indexOf('冰箱') < 0) { ls.getRange(1, ls.getLastColumn() + 1).setValue('冰箱').setNote('這個櫃位的冰箱名稱，多台用逗號分隔，例如：冰箱1,冰箱2。空白＝1 台「冰箱」'); log.push('〈櫃位設定〉加「冰箱」欄'); }
  // 參數
  var ps = ss.getSheetByName('參數設定'), have2 = ps.getDataRange().getValues().map(function (r) { return String(r[0]).trim(); });
  if (have2.indexOf('冰箱溫度下限') < 0) ps.appendRow(['冰箱溫度下限', 0, '°C，打卡時冰箱溫度低於這個值會提醒並開門市回報']);
  if (have2.indexOf('冰箱溫度上限') < 0) ps.appendRow(['冰箱溫度上限', 7, '°C，打卡時冰箱溫度高於這個值會提醒並開門市回報']);
  // 新表
  ops_sheet_('食安紀錄', FS_LOG_HEAD); ops_sheet_('體檢表', FS_HEALTH_HEAD);
  var cs = ops_sheet_('櫃位證照', FS_CERT_HEAD); if (cs.getLastRow() < 2) cs.appendRow([FS_HQ, '', '', '', '', '', '', '', '', '', '', '', '']);
  // SOP：注意事項欄＋新類型範本
  var so = sop_sheet_(); if (!String(so.getRange(1, 7).getValue()).trim()) so.getRange(1, 7).setValue('注意事項');
  var types = so.getLastRow() > 1 ? so.getRange(2, 1, so.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]).trim(); }) : [];
  [['攪拌麵糊', '（待隊長補內容）', '隊長用語音講解後，小雲整理成步驟'], ['烤雞蛋糕', '（待隊長補內容）', '隊長用語音講解後，小雲整理成步驟']].forEach(function (x) {
    if (types.indexOf(x[0]) < 0) { so.appendRow([x[0], 1, x[1], x[2], '', '是', '']); log.push('SOP 新增「' + x[0] + '」範本'); }
  });
  CacheService.getScriptCache().removeAll(['fs_quick', 'sop_all', 'sop_all2']);
  Logger.log('fs_setup 完成\n' + log.join('\n'));
  return log;
}
