// ═══════════════════════════════════════════════
// 營運管理 後端模組 v1（2026-11-12，v1.20 批次）
// 貼在「程式碼.gs」最底部；extHandler_ 內、secHandler_ 那行的下一行加：
//   var op = opsHandler_(action, p); if (op) return op;
// 部署後在編輯器執行一次 ops_setup()（建表、補欄位、補參數，不動既有資料）。
//
// 內容：
//   櫃位管理（Lv.3）：opsLocList／opsLocSave／opsLocStatus（刪除＝停用並隱藏，不真刪）
//   新增夥伴（Lv.3）：opsStaffList／opsStaffAdd（身分證字號、地址只回給 Lv.3）
//   到職檢查（Lv.2 看得到）：opsOnboard／opsOnboardCheck
//   物料需求（全員可送；合作夥伴、加盟店主要用）：opsMatItems／opsMatCreate／opsMatList／opsMatStatus／opsMatMonthly
//   加盟店損益（加盟主＝該店 Lv.2、總部 Lv.3）：opsPnl／opsExpAdd／opsExpDel／opsFixedSave／opsPnlClose／opsPnlReopen
//   供貨價格（Lv.3）：opsPriceList／opsPriceSave
// 敏感動作（夥伴個資、損益）需要登入 token（v1.18 登入安全模組發的）。
// ═══════════════════════════════════════════════

var OPS_MAT_HEAD   = ['需求編號','建立時間','員工編號','姓名','櫃位','品項明細(JSON)','希望到貨日','備註','狀態','處理人','處理時間','出貨日','金額','狀態紀錄(JSON)'];
var OPS_PRICE_HEAD = ['品項','單位','單價','備註'];
var OPS_EXP_HEAD   = ['費用編號','櫃位','年月','日期','分類','金額','備註','收據照片','建立者','建立時間'];
var OPS_FIX_HEAD   = ['櫃位','分類','金額','起始年月','結束年月','備註'];
var OPS_CLOSE_HEAD = ['櫃位','年月','狀態','處理人','處理時間','結帳快照(JSON)'];
var OPS_ONB_HEAD   = ['員工編號','姓名','建立時間','勞保','健保','銀行帳戶','體檢','完成時間'];
var OPS_ONB_ITEMS  = ['勞保', '健保', '銀行帳戶', '體檢'];
var OPS_MAT_ITEMS  = [['麵糊', '包'], ['麵粉', '袋'], ['二砂糖', '包'], ['紅玉紅茶粉', '包'], ['機器鍍膜', '次'], ['包材', '箱'], ['其他', '']];
var OPS_INCOME_CATS = ['外送平台收入', '其他收入'];
var OPS_EXP_CATS   = ['租金／百貨抽成', '水費', '電費', '瓦斯', '電信網路', '刷卡手續費', '外送平台抽成', '政府費用', '勞健保公司負擔', '勞退提繳', '設備維修', '機器鍍膜', '包材', '其他物料', '雜支'];
var OPS_C_ = {};

function ops_ss_() { return OPS_C_.ss || (OPS_C_.ss = SpreadsheetApp.openById(SHEET_ID)); }
function ops_sheet_(name, head) {
  var ss = ops_ss_(), sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(head); sh.setFrozenRows(1); }
  return sh;
}
function ops_rows_(sh, w) { return sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, w).getValues() : []; }
function ops_now_() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss'); }
function ops_today_() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd'); }
function ops_d_(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, 'Asia/Taipei', 'yyyy-MM-dd');
  var m = String(v).match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : String(v).slice(0, 10);
}
function ops_json_(s, d) { try { return s ? JSON.parse(s) : d; } catch (e) { return d; } }
function ops_arr_(x) { if (Object.prototype.toString.call(x) === '[object Array]') return x; return ops_json_(x, []); }
function ops_num_(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }

// ── 夥伴資料欄位（依表頭找，找不到用預設位置）──
function ops_cols_(head) {
  var c = { id: 0, name: 1, nick: 2, sex: 3, bday: 4, idno: 5, phone: 6, addr: 7, addr2: 8, hire: 9, left: 10, pos: 11, role: 12, wage: 13, pw: 36, managed: 46, type: -1 };
  head.forEach(function (h, i) {
    h = String(h).trim();
    if (h === '身分證號' || h === '身分證字號') c.idno = i;
    else if (h === '戶籍地址') c.addr = i;
    else if (h === '聯絡地址' || h === '通訊地址') c.addr2 = i;
    else if (h === '密碼' || h === '登入密碼') c.pw = i;
    else if (/負責櫃位/.test(h)) c.managed = i;
    else if (h === '帳號類型') c.type = i;
  });
  return c;
}
function ops_staff_() {
  if (OPS_C_.staff) return OPS_C_.staff;
  var sh = ops_ss_().getSheetByName('夥伴資料'), v = sh.getDataRange().getValues(), c = ops_cols_(v[0] || []), map = {}, list = [];
  for (var r = 1; r < v.length; r++) {
    var id = String(v[r][c.id]).trim(); if (!id) continue;
    var role = parseInt(v[r][c.role]) || 1;
    var o = { row: r + 1, id: id, name: String(v[r][c.name]).trim(), nick: String(v[r][c.nick] || ''), role: role, pos: String(v[r][c.pos] || ''),
      left: String(v[r][c.left] || '').trim() !== '', managed: String(v[r][c.managed] || ''),
      type: c.type >= 0 ? (String(v[r][c.type] || '').trim() || '員工') : '員工', raw: v[r] };
    map[id] = o; list.push(o);
  }
  OPS_C_.staffCols = c; OPS_C_.staffHead = v[0];
  return (OPS_C_.staff = { map: map, list: list });
}
function ops_me_(empId) {
  var me = ops_staff_().map[String(empId || '').trim()];
  if (!me || me.left) throw new Error('找不到夥伴資料');
  me.top = me.role >= 4 || me.pos === '大隊長';
  if (me.top && me.role < 3) me.role = 3;
  return me;
}
function ops_need_(p, minRole, needToken) {
  var me = ops_me_(p.empId);
  if (needToken && !sec_verifyToken_(p.token, me.id)) throw new Error('請重新登入後再試');
  if (me.role < minRole) throw new Error('需要 Lv.' + minRole + ' 以上');
  return me;
}

// ── 櫃位 ──
// 〈櫃位設定〉A 名稱 B 縣市 C 業績類型 D 每份抽成 E 狀態 F 場所性質 G 緯度 H 經度 I 品項清單
var OPS_LOC_STATUS = ['營運中', '休賽期', '暫停', '已結束', '已停用'];
var OPS_LOC_KIND   = ['固定櫃位', '快閃櫃位', '活動', '合作品牌', '加盟分隊長'];
function ops_locs_() {
  if (OPS_C_.locs) return OPS_C_.locs;
  var sh = ops_ss_().getSheetByName('櫃位設定'), out = [];
  ops_rows_(sh, 10).forEach(function (r, i) {
    var n = String(r[0]).trim(); if (!n) return;
    var code = String(r[9] === undefined ? '' : r[9]).trim().replace(/^'/, ''); if (/^\d$/.test(code)) code = '0' + code;
    if (!code) { var m = n.match(/^(\d{2})/); code = m ? m[1] : ''; }
    out.push({ row: i + 2, name: n, code: code, county: String(r[1] || ''), type: String(r[2] || ''), unitPrice: r[3] === '' ? '' : ops_num_(r[3]),
      status: String(r[4] || '營運中').trim() || '營運中', kind: String(r[5] || '固定櫃位').trim() || '固定櫃位',
      lat: r[6] === '' ? '' : ops_num_(r[6]), lng: r[7] === '' ? '' : ops_num_(r[7]), items: String(r[8] || '雞蛋糕') });
  });
  return (OPS_C_.locs = out);
}
// 櫃位一律以〈櫃位設定〉J 欄「櫃位編號」連動（空白時用名稱前兩碼）；舊紀錄的舊名稱也用前兩碼對
function ops_code_(n) { return loc_code_(n); }
function ops_sameLoc_(a, b) { if (a === b) return true; var x = ops_code_(a); return !!x && x === ops_code_(b); }
function ops_locByName_(n) { var l = ops_locs_().filter(function (x) { return x.name === n; }); return l[0] || null; }
function ops_isFranchise_(n) { var l = ops_locByName_(n); return !!(l && /加盟/.test(l.kind)); }
function ops_isPartnerLoc_(n) { var l = ops_locByName_(n); return !!(l && /合作/.test(l.kind)); }
function ops_myLocs_(me) {                          // 依「負責櫃位」比對（與排班系統同規則）
  var all = ops_locs_().map(function (x) { return x.name; });
  if (me.role >= 3) return all;
  var toks = String(me.managed || '').split(/[、,，\/\s;；]+/).map(function (x) { return x.trim(); }).filter(String);
  return all.filter(function (n) { return toks.some(function (t) { return n === t || n.indexOf(t) >= 0 || (t.length >= 2 && t.indexOf(n) >= 0); }); });
}

function ops_locList_(p) {
  ops_need_(p, 3);
  return { success: true, data: ops_locs_().map(function (x) { var o = {}; for (var k in x) if (k !== 'row') o[k] = x[k]; return o; }),
    statuses: OPS_LOC_STATUS, kinds: OPS_LOC_KIND, types: ['A百貨', 'B直結', 'C份數', 'D麵糊數'] };
}
function ops_locSave_(p) {
  ops_need_(p, 3);
  var d = typeof p.loc === 'string' ? ops_json_(p.loc, {}) : (p.loc || {});
  var name = String(d.name || '').trim(), orig = String(d.orig || '').trim();
  var code = String(d.code || '').trim(); if (!code) { var mm = name.match(/^(\d{2})/); code = mm ? mm[1] : ''; }
  if (!name) return { error: '請填櫃位名稱' };
  if (!/^\d{2}$/.test(code)) return { error: '請填兩位數的櫃位編號（例：24）；編號是各紀錄連動用的，建立後不要改' };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    OPS_C_.locs = null;
    var sh = ops_ss_().getSheetByName('櫃位設定'), locs = ops_locs_();
    var exist = locs.filter(function (x) { return x.name === (orig || name); })[0];
    if ((!orig || orig !== name) && ops_locByName_(name)) return { error: '已經有同名櫃位' };
    if (locs.some(function (x) { return x.code === code && x.name !== orig; })) return { error: '編號 ' + code + ' 已經被其他櫃位用了' };
    if (exist && exist.code && exist.code !== code) return { error: '櫃位編號建立後不能改（' + exist.code + '）' };
    var lat = d.lat === '' || d.lat === undefined ? '' : ops_num_(d.lat), lng = d.lng === '' || d.lng === undefined ? '' : ops_num_(d.lng);
    var row = [name, String(d.county || ''), String(d.type || 'A百貨'), d.unitPrice === '' || d.unitPrice === undefined ? '' : ops_num_(d.unitPrice),
      OPS_LOC_STATUS.indexOf(d.status) >= 0 ? d.status : '營運中', OPS_LOC_KIND.indexOf(d.kind) >= 0 ? d.kind : '固定櫃位', lat, lng, String(d.items || '雞蛋糕'), "'" + code];
    ops_codeHeader_(sh);
    if (exist) sh.getRange(exist.row, 1, 1, 10).setValues([row]); else sh.appendRow(row);
    var renamed = null;
    if (exist && orig !== name) renamed = ops_renameRefs_(function (v) { return v === orig ? name : null; }, OPS_REF_SHEETS);
    OPS_C_.locs = null;
    return { success: true, renamed: renamed };
  } finally { lock.releaseLock(); }
}
function ops_codeHeader_(sh) { if (String(sh.getRange(1, 10).getValue() || '').trim() !== '櫃位編號') sh.getRange(1, 10).setValue('櫃位編號'); }
// 櫃位名稱改了 → 各分頁的櫃位欄一起改（只換「完全相同」的舊名稱；負責櫃位逐項換）
var OPS_REF_SHEETS = ['班表', '班型設定', '換班申請', '可上班登記', '物料需求', '加盟費用', '加盟固定費用', '加盟結帳', '訂單', '缺貨看板', '塔防', '夥伴資料', '出勤確認'];
var OPS_HIST_SHEETS = ['打卡紀錄', '打卡紀錄_歷史', '收店盤點', '收店盤點_歷史', '開店盤點', '開店盤點_歷史', '工時日結', '塔防投入', '加盟店薪資'];
function ops_renameRefs_(mapFn, sheets) {
  var ss = ops_ss_(), out = {};
  sheets.forEach(function (n) {
    var sh = ss.getSheetByName(n); if (!sh || sh.getLastRow() < 2) return;
    var w = sh.getLastColumn(), head = sh.getRange(1, 1, 1, w).getValues()[0];
    head.forEach(function (h, c) {
      h = String(h).trim();
      var isLoc = /^(櫃位|打卡地點)$/.test(h), isMng = /負責櫃位/.test(h);
      if (!isLoc && !isMng) return;
      var rg = sh.getRange(2, c + 1, sh.getLastRow() - 1, 1), v = rg.getValues(), changed = 0;
      v.forEach(function (r) {
        var cur = String(r[0] || '').trim(); if (!cur) return;
        if (isLoc) { var nv = mapFn(cur); if (nv && nv !== cur) { r[0] = nv; changed++; } }
        else {
          var toks = cur.split(/[、,，;；]+/), hit = false;
          toks = toks.map(function (t) { t = t.trim(); var nv = mapFn(t); if (nv && nv !== t) { hit = true; return nv; } return t; });
          if (hit) { r[0] = toks.join('、'); changed++; }
        }
      });
      if (changed) { rg.setValues(v); out[n + '・' + h] = changed; }
    });
  });
  return out;
}
// 一次性整理：把各分頁裡的舊櫃位名稱（例：01正櫃遠百信義、00活動）依編號換成〈櫃位設定〉現在的名稱，並補上 J 欄編號
function ops_syncLocNames() {
  OPS_C_ = {};
  var sh = ops_ss_().getSheetByName('櫃位設定'); ops_codeHeader_(sh);
  var locs = ops_locs_(), byCode = {}, names = {}, act = null;
  locs.forEach(function (x) {
    if (x.code) { byCode[x.code] = x.name; sh.getRange(x.row, 10).setValue("'" + x.code); }
    names[x.name] = 1;
    if (/活動/.test(x.kind) && /活動/.test(x.name) && x.status !== '已停用' && !act) act = x.name;
  });
  var mapFn = function (v) {
    if (names[v]) return null;
    var m = v.match(/^(\d{2})/);
    if (m && byCode[m[1]]) return byCode[m[1]];
    if (/^00活動$/.test(v) && act) return act;
    return null;
  };
  var res = ops_renameRefs_(mapFn, OPS_REF_SHEETS.concat(OPS_HIST_SHEETS));
  Logger.log(JSON.stringify(res));
  return res;
}
function ops_locStatus_(p) {
  ops_need_(p, 3);
  var l = ops_locByName_(String(p.name || '')); if (!l) return { error: '找不到櫃位' };
  var st = String(p.status || ''); if (OPS_LOC_STATUS.indexOf(st) < 0) return { error: '狀態不正確' };
  ops_ss_().getSheetByName('櫃位設定').getRange(l.row, 5).setValue(st);
  OPS_C_.locs = null;
  return { success: true };
}
// 覆蓋 getLocations：多回傳狀態（舊版沒有），其餘欄位與原本相同
function getLocations() {
  var m = {};
  ops_locs_().forEach(function (x) {
    var items = String(x.items || '雞蛋糕').split(/[,，、]/).map(function (s) { return s.trim(); }).filter(String);
    m[x.name] = { code: x.code, county: x.county, type: x.type || 'A百貨', unitPrice: x.unitPrice === '' ? 70 : (x.unitPrice || 70), kind: x.kind,
      status: x.status, lat: x.lat === '' ? null : x.lat, lng: x.lng === '' ? null : x.lng, items: items.length ? items : ['雞蛋糕'] };
  });
  return m;
}
// 覆蓋 getLocationsApi：App 打卡等畫面不顯示「已停用」「已結束」的櫃位
function getLocationsApi(ss) {
  var all = getLocations(), out = {};
  Object.keys(all).forEach(function (k) { if (!/已停用|已結束/.test(all[k].status)) out[k] = all[k]; });
  return { success: true, data: out };
}

// ── 新增夥伴（Lv.3）──
function ops_rocDate_(s) {                           // 1996-06-07 → 85/06/07（生日沿用民國格式）
  var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(s || '');
  return (parseInt(m[1], 10) - 1911) + '/' + m[2] + '/' + m[3];
}
function ops_staffList_(p) {
  var me = ops_need_(p, 2, true), st = ops_staff_(), c = OPS_C_.staffCols, full = me.role >= 3;
  var onb = ops_onbMap_();
  return { success: true, full: full, data: st.list.filter(function (x) { return full || !x.left; }).map(function (x) {
    var o = { id: x.id, name: x.name, nick: x.nick, role: x.role, pos: x.pos, left: x.left, managed: x.managed, type: x.type,
      phone: String(x.raw[c.phone] || ''), hire: ops_d_(x.raw[c.hire]), onboard: onb[x.id] ? onb[x.id].done : null };
    if (full) { o.leftDate = ops_d_(x.raw[c.left]); o.idno = String(x.raw[c.idno] || ''); o.addr = String(x.raw[c.addr] || ''); o.addr2 = String(x.raw[c.addr2] || ''); o.bday = String(x.raw[c.bday] || ''); }
    return o;
  }) };
}
function ops_staffAdd_(p) {
  var me = ops_need_(p, 3, true);
  var d = typeof p.staff === 'string' ? ops_json_(p.staff, {}) : (p.staff || {});
  var req = { name: '姓名', nick: '暱稱', phone: '手機', bday: '生日', hire: '到職日', role: '權限等級', pos: '職務', idno: '身分證字號', addr: '通訊地址' };
  for (var k in req) if (!String(d[k] || '').trim()) return { error: '請填「' + req[k] + '」' };
  var phone = String(d.phone).replace(/\D/g, '');
  if (!/^09\d{8}$/.test(phone)) return { error: '手機格式不正確（09 開頭共 10 碼）' };
  var idno = String(d.idno).trim().toUpperCase();
  if (!/^[A-Z][0-9A-Z]\d{8}$/.test(idno)) return { error: '身分證字號格式不正確（含居留證號）' };
  var role = parseInt(d.role, 10); if (!(role >= 1 && role <= 5)) return { error: '權限等級要 1～5' };
  if (role > me.role) return { error: '不能新增比自己權限高的帳號' };
  var type = /加盟/.test(d.type) ? '加盟店夥伴' : /合作/.test(d.type) ? '合作夥伴' : '員工';
  if (role === 2 && !String(d.managed || '').trim()) return { error: '分隊長要填負責櫃位' };
  var bm = String(d.bday).match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!bm) return { error: '生日格式不正確' };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    OPS_C_.staff = null;
    var st = ops_staff_(), c = OPS_C_.staffCols, sh = ops_ss_().getSheetByName('夥伴資料');
    if (st.list.some(function (x) { return String(x.raw[c.phone] || '').replace(/\D/g, '') === phone && !x.left; })) return { error: '這支手機已經有帳號了' };
    var max = 0; st.list.forEach(function (x) { var n = parseInt(String(x.id).replace(/\D/g, ''), 10); if (n > max) max = n; });
    var id = 'E' + ('00' + (max + 1)).slice(-3);
    if (c.type < 0) { c.type = sh.getLastColumn(); sh.getRange(1, c.type + 1).setValue('帳號類型'); }
    var width = Math.max(sh.getLastColumn(), c.type + 1, c.managed + 1, c.pw + 1), row = [];
    for (var i = 0; i < width; i++) row.push('');
    row[c.id] = id; row[c.name] = String(d.name).trim(); row[c.nick] = String(d.nick).trim(); row[c.sex] = String(d.sex || '');
    row[c.bday] = ops_rocDate_(d.bday); row[c.idno] = idno; row[c.phone] = phone; row[c.addr2] = String(d.addr).trim();
    if (d.addr1) row[c.addr] = String(d.addr1).trim();
    row[c.hire] = String(d.hire); row[c.pos] = String(d.pos).trim(); row[c.role] = role; row[c.wage] = 196;
    row[c.pw] = bm[2] + bm[3];                      // 預設密碼＝生日 MMDD（登入時自動加密，首頁會提醒改）
    row[c.managed] = String(d.managed || ''); row[c.type] = type;
    var r = sh.getLastRow() + 1;
    sh.getRange(r, 1, 1, width).setNumberFormat('@').setValues([row.map(String)]);
    sh.getRange(r, c.role + 1).setNumberFormat('0').setValue(role);
    sh.getRange(r, c.wage + 1).setNumberFormat('0').setValue(196);
    if (type !== '合作夥伴') ops_sheet_('到職檢查', OPS_ONB_HEAD).appendRow([id, String(d.name).trim(), ops_now_(), '', '', '', '', '']);
    OPS_C_.staff = null;
    return { success: true, id: id, password: bm[2] + bm[3] };
  } finally { lock.releaseLock(); }
}

// 修改夥伴的權限、職務、負責櫃位、帳號類型（Lv.3）
function ops_staffUpdate_(p) {
  var me = ops_need_(p, 3, true), d = typeof p.staff === 'string' ? ops_json_(p.staff, {}) : (p.staff || {});
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    OPS_C_.staff = null;
    var st = ops_staff_(), c = OPS_C_.staffCols, x = st.map[String(d.id || '')], sh = ops_ss_().getSheetByName('夥伴資料');
    if (!x) return { error: '找不到夥伴' };
    var role = parseInt(d.role, 10);
    if (!(role >= 1 && role <= 5)) return { error: '權限等級要 1～5' };
    if (role > me.role || (x.role > me.role)) return { error: '不能設定比自己高的權限' };
    if (role === 2 && !String(d.managed || '').trim()) return { error: '分隊長要選負責櫃位' };
    if (c.type < 0) { c.type = sh.getLastColumn(); sh.getRange(1, c.type + 1).setValue('帳號類型'); }
    sh.getRange(x.row, c.role + 1).setValue(role);
    sh.getRange(x.row, c.pos + 1).setValue(String(d.pos || x.pos));
    sh.getRange(x.row, c.managed + 1).setValue(String(d.managed || ''));
    sh.getRange(x.row, c.type + 1).setValue(/加盟/.test(d.type) ? '加盟店夥伴' : /合作/.test(d.type) ? '合作夥伴' : '員工');
    if (d.left !== undefined) sh.getRange(x.row, 11).setValue(String(d.left || ''));
    OPS_C_.staff = null;
    return { success: true };
  } finally { lock.releaseLock(); }
}

// ── 到職檢查 ──
function ops_onbMap_() {
  var sh = ops_ss_().getSheetByName('到職檢查'), out = {};
  if (!sh) return out;
  ops_rows_(sh, 8).forEach(function (r, i) {
    var id = String(r[0]).trim(); if (!id) return;
    var items = {}; OPS_ONB_ITEMS.forEach(function (k, j) { items[k] = ops_json_(String(r[3 + j] || ''), null) || (r[3 + j] ? { by: String(r[3 + j]) } : null); });
    out[id] = { row: i + 2, id: id, name: String(r[1]), created: String(r[2]), items: items, done: !!String(r[7] || '').trim() };
  });
  return out;
}
function ops_onboard_(p) {
  ops_need_(p, 2);
  var m = ops_onbMap_();
  return { success: true, items: OPS_ONB_ITEMS, data: Object.keys(m).map(function (k) { var o = m[k]; delete o.row; return o; }).filter(function (o) { return !o.done || p.all; }) };
}
function ops_onboardCheck_(p) {
  var me = ops_need_(p, 2), item = String(p.item || ''), j = OPS_ONB_ITEMS.indexOf(item);
  if (j < 0) return { error: '項目不正確' };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var m = ops_onbMap_(), o = m[String(p.target || '')]; if (!o) return { error: '找不到這位新夥伴' };
    var sh = ops_ss_().getSheetByName('到職檢查'), on = p.on !== false && p.on !== 'false';
    sh.getRange(o.row, 4 + j).setValue(on ? JSON.stringify({ by: me.name, at: ops_now_() }) : '');
    o.items[item] = on ? { by: me.name } : null;
    var all = OPS_ONB_ITEMS.every(function (k) { return o.items[k]; });
    sh.getRange(o.row, 8).setValue(all ? ops_now_() : '');
    return { success: true, done: all };
  } finally { lock.releaseLock(); }
}

// ── 供貨價格 ──
function ops_prices_() {
  var sh = ops_sheet_('供貨價格', OPS_PRICE_HEAD), out = {};
  ops_rows_(sh, 4).forEach(function (r) { var n = String(r[0]).trim(); if (n) out[n] = { unit: String(r[1] || ''), price: r[2] === '' ? null : ops_num_(r[2]), note: String(r[3] || '') }; });
  return out;
}
function ops_priceList_(p) { ops_need_(p, 2); var pr = ops_prices_(); return { success: true, data: Object.keys(pr).map(function (k) { return { item: k, unit: pr[k].unit, price: pr[k].price, note: pr[k].note }; }) }; }
function ops_priceSave_(p) {
  ops_need_(p, 3, true);
  var list = ops_arr_(p.list), sh = ops_sheet_('供貨價格', OPS_PRICE_HEAD);
  var rows = list.filter(function (x) { return String(x.item || '').trim(); }).map(function (x) { return [String(x.item).trim(), String(x.unit || ''), x.price === '' || x.price === null || x.price === undefined ? '' : ops_num_(x.price), String(x.note || '')]; });
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 4).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, 4).setValues(rows);
  return { success: true };
}

// ── 物料需求 ──
function ops_matRows_() {
  var sh = ops_sheet_('物料需求', OPS_MAT_HEAD);
  return ops_rows_(sh, OPS_MAT_HEAD.length).map(function (r, i) {
    return { row: i + 2, id: String(r[0]), created: String(r[1]), empId: String(r[2]), name: String(r[3]), loc: String(r[4]),
      items: ops_json_(String(r[5] || ''), []), want: ops_d_(r[6]), note: String(r[7] || ''), status: String(r[8] || '已送出'),
      by: String(r[9] || ''), at: String(r[10] || ''), shipDate: ops_d_(r[11]), amount: r[12] === '' ? null : ops_num_(r[12]), log: ops_json_(String(r[13] || ''), []) };
  }).filter(function (x) { return x.id; });
}
function ops_matItems_(p) {
  var pr = ops_prices_();
  return { success: true, items: OPS_MAT_ITEMS.map(function (x) { return { item: x[0], unit: (pr[x[0]] && pr[x[0]].unit) || x[1] }; }) };
}
function ops_matCreate_(p) {
  var me = ops_me_(p.empId), loc = String(p.loc || '').trim();
  if (!ops_locByName_(loc)) return { error: '請選櫃位' };
  if (me.role < 3 && ops_myLocs_(me).indexOf(loc) < 0 && me.type !== '員工') return { error: '只能替自己的櫃位叫貨' };
  var items = ops_arr_(p.items).map(function (x) { return { item: String(x.item || '').trim().slice(0, 20), qty: ops_num_(x.qty), unit: String(x.unit || '').slice(0, 6), note: String(x.note || '').slice(0, 40) }; })
    .filter(function (x) { return x.item && x.qty > 0; });
  if (!items.length) return { error: '請至少填一項數量' };
  var id = 'M' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
  var log = [{ s: '已送出', by: me.name, at: ops_now_() }];
  ops_sheet_('物料需求', OPS_MAT_HEAD).appendRow([id, ops_now_(), me.id, me.name, loc, JSON.stringify(items), String(p.want || ''), String(p.note || '').slice(0, 200), '已送出', '', '', '', '', JSON.stringify(log)]);
  try { if (typeof line_notify_ === 'function') line_notify_('物料', '📦 物料需求｜' + loc.replace(/^\d+/, '') + '\n' + items.map(function (x) { return '・' + x.item + ' ' + x.qty + (x.unit || ''); }).join('\n') + (p.want ? '\n希望到貨：' + p.want : '') + (p.note ? '\n備註：' + p.note : '') + '\n（' + me.name + '）'); } catch (e) {}
  return { success: true, id: id };
}
function ops_matCanSee_(me, x) {
  if (me.role >= 3) return true;
  if (x.empId === me.id) return true;
  return ops_myLocs_(me).indexOf(x.loc) >= 0;
}
function ops_matList_(p) {
  var me = ops_me_(p.empId), ym = String(p.ym || '');
  var list = ops_matRows_().filter(function (x) { return ops_matCanSee_(me, x) && (!ym || x.created.slice(0, 7) === ym || (p.open && !/已送達|已取消/.test(x.status))); });
  list.sort(function (a, b) { return a.created < b.created ? 1 : -1; });
  return { success: true, canManage: me.role >= 3, data: list.slice(0, 200).map(function (x) { delete x.row; return x; }) };
}
function ops_matStatus_(p) {
  var me = ops_me_(p.empId), st = String(p.status || '');
  if (['已收到', '已出貨', '已送達', '已取消'].indexOf(st) < 0) return { error: '狀態不正確' };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var x = ops_matRows_().filter(function (r) { return r.id === String(p.id || ''); })[0];
    if (!x) return { error: '找不到這張需求單' };
    if (me.role < 3 && !(st === '已取消' && x.empId === me.id && x.status === '已送出') && !(st === '已送達' && ops_matCanSee_(me, x) && x.status === '已出貨')) return { error: '只有總部（Lv.3）可以改狀態' };
    var sh = ops_ss_().getSheetByName('物料需求');
    x.log.push({ s: st, by: me.name, at: ops_now_() });
    var amount = x.amount, ship = x.shipDate;
    if (st === '已出貨') {
      ship = String(p.shipDate || ops_today_());
      var pr = ops_prices_(), total = 0, miss = false;
      x.items.forEach(function (it) { var u = pr[it.item]; if (u && u.price !== null) total += u.price * it.qty; else miss = true; });
      amount = miss && !total ? '' : Math.round(total);
    }
    sh.getRange(x.row, 9, 1, 6).setValues([[st, me.name, ops_now_(), ship || '', amount === null ? '' : amount, JSON.stringify(x.log)]]);
    return { success: true };
  } finally { lock.releaseLock(); }
}
// 月底結算：各櫃位各品項數量合計（不含已取消），金額依出貨時的單價
function ops_matMonthly_(p) {
  var me = ops_need_(p, 2), ym = String(p.ym || ops_today_().slice(0, 7));
  var mine = ops_myLocs_(me), by = {};
  ops_matRows_().forEach(function (x) {
    if (x.created.slice(0, 7) !== ym || x.status === '已取消') return;
    if (me.role < 3 && mine.indexOf(x.loc) < 0) return;
    var L = by[x.loc] = by[x.loc] || { loc: x.loc, orders: 0, items: {}, amount: 0, pending: 0 };
    L.orders++; if (x.amount !== null) L.amount += x.amount;
    if (!/已出貨|已送達/.test(x.status)) L.pending++;
    x.items.forEach(function (it) { var k = it.item + '|' + (it.unit || ''); L.items[k] = (L.items[k] || 0) + it.qty; });
  });
  return { success: true, ym: ym, data: Object.keys(by).map(function (k) {
    var L = by[k]; L.items = Object.keys(L.items).map(function (q) { var a = q.split('|'); return { item: a[0], unit: a[1], qty: Math.round(L.items[q] * 100) / 100 }; });
    return L;
  }) };
}

// ── 加盟店損益 ──
function ops_param_(name, def) {
  var sh = ops_ss_().getSheetByName('參數設定'); if (!sh) return def;
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]).trim() === name) return v[i][1] === '' ? def : v[i][1];
  return def;
}
function ops_pnlAuth_(p) {
  var me = ops_need_(p, 2, true), loc = String(p.loc || '');
  if (!ops_isFranchise_(loc)) throw new Error('這個櫃位不是加盟店');
  if (me.role < 3 && ops_myLocs_(me).indexOf(loc) < 0) throw new Error('只能看自己的加盟店');
  return me;
}
function ops_franchiseLocs_(p) {
  var me = ops_need_(p, 2), mine = ops_myLocs_(me);
  return { success: true, data: ops_locs_().filter(function (x) { return /加盟/.test(x.kind) && x.status !== '已停用' && (me.role >= 3 || mine.indexOf(x.name) >= 0); }).map(function (x) { return x.name; }),
    incomeCats: OPS_INCOME_CATS, expCats: OPS_EXP_CATS };
}
function ops_closed_(loc, ym) {
  var sh = ops_sheet_('加盟結帳', OPS_CLOSE_HEAD), hit = null;
  ops_rows_(sh, 6).forEach(function (r, i) { if (String(r[0]) === loc && String(r[1]) === ym) hit = { row: i + 2, status: String(r[2]), by: String(r[3]), at: String(r[4]) }; });
  return hit;
}
function ops_expRows_(loc, ym) {
  var sh = ops_sheet_('加盟費用', OPS_EXP_HEAD);
  return ops_rows_(sh, OPS_EXP_HEAD.length).map(function (r, i) { return { row: i + 2, id: String(r[0]), loc: String(r[1]), ym: String(r[2]), date: ops_d_(r[3]), cat: String(r[4]), amount: ops_num_(r[5]), note: String(r[6] || ''), photo: String(r[7] || ''), by: String(r[8] || '') }; })
    .filter(function (x) { return x.id && x.loc === loc && (!ym || x.ym === ym); });
}
function ops_fixedRows_(loc) {
  var sh = ops_sheet_('加盟固定費用', OPS_FIX_HEAD);
  return ops_rows_(sh, 6).map(function (r) { return { loc: String(r[0]), cat: String(r[1]), amount: ops_num_(r[2]), from: String(r[3] || ''), to: String(r[4] || ''), note: String(r[5] || '') }; })
    .filter(function (x) { return x.loc === loc && x.cat; });
}
function ops_revenueByDay_(loc, ym) {
  var out = {};
  ['收店盤點_歷史', '收店盤點'].forEach(function (n) {
    var sh = ops_ss_().getSheetByName(n); if (!sh || sh.getLastRow() < 2) return;
    var v = sh.getRange(2, 1, sh.getLastRow() - 1, Math.min(sh.getLastColumn(), 31)).getValues();
    v.forEach(function (r) {
      if (!ops_sameLoc_(String(r[5]).trim(), loc)) return;
      var d = ops_d_(r[1]); if (d.slice(0, 7) !== ym) return;
      var tot = r[30] !== '' && r[30] !== undefined ? ops_num_(r[30]) : ops_num_(r[16]);
      out[d] = { rev: tot, batter: ops_num_(r[15]) };       // 同櫃同日以最後一筆為準
    });
  });
  return out;
}
function ops_pnlCalc_(loc, ym) {
  var days = ops_revenueByDay_(loc, ym), revenue = 0, batterUse = 0, openDays = 0;
  Object.keys(days).forEach(function (d) { revenue += days[d].rev; batterUse += days[d].batter; if (days[d].rev > 0) openDays++; });
  var exps = ops_expRows_(loc, ym), fixed = ops_fixedRows_(loc).filter(function (f) { return (!f.from || f.from <= ym) && (!f.to || f.to >= ym); });
  var income = {}, cost = {};
  exps.forEach(function (e) { if (OPS_INCOME_CATS.indexOf(e.cat) >= 0) income[e.cat] = (income[e.cat] || 0) + e.amount; else cost[e.cat] = (cost[e.cat] || 0) + e.amount; });
  var fixedApplied = [];
  fixed.forEach(function (f) {                       // 當月若已手動填同分類，就不再自動帶入
    if (exps.some(function (e) { return e.cat === f.cat; })) return;
    cost[f.cat] = (cost[f.cat] || 0) + f.amount; fixedApplied.push(f.cat);
  });
  var otherIncome = Object.keys(income).reduce(function (s, k) { return s + income[k]; }, 0);
  var sales = revenue + otherIncome;
  var vat = /是|Y|1|有/.test(String(ops_param_('加盟店開發票', '是'))) ? Math.round(sales / 1.05 * 0.05) : 0;
  var pr = ops_prices_(), missing = [];
  var batterPrice = pr['麵糊'] && pr['麵糊'].price !== null ? pr['麵糊'].price : null;
  if (batterPrice === null && batterUse) missing.push('麵糊');
  var batterCost = batterPrice === null ? 0 : Math.round(batterUse * batterPrice);
  // 物料（麵糊以收店用量計，避免重複；其他品項以當月出貨的物料需求單計）
  var mat = {}, matCost = 0;
  ops_matRows_().forEach(function (x) {
    if (!ops_sameLoc_(x.loc, loc) || !/已出貨|已送達/.test(x.status) || (x.shipDate || x.created).slice(0, 7) !== ym) return;
    x.items.forEach(function (it) {
      if (it.item === '麵糊') return;
      var u = pr[it.item];
      if (!u || u.price === null) { if (missing.indexOf(it.item) < 0) missing.push(it.item); return; }
      mat[it.item] = (mat[it.item] || 0) + u.price * it.qty; matCost += u.price * it.qty;
    });
  });
  matCost = Math.round(matCost);
  var rate = ops_num_(ops_param_('加盟權利金比率', 0.01)); if (rate > 1) rate = rate / 100;
  var royalty = Math.round(revenue * rate);
  // 人事：系統代算的加盟店夥伴薪資（薪資引擎 v3）＋加盟主自評人力
  var labor = { staff: 0, list: [], owner: 0, ownerHours: 0 };
  try {
    if (typeof pay3_compute_ === 'function') {
      var res = pay3_compute_(ym, {});
      Object.keys(res.emps).forEach(function (id) {
        var e = res.emps[id]; if (!e.franchise || !ops_sameLoc_(e.franchiseLoc, loc)) return;
        if (e.isOwner) { labor.ownerHours += e.totalH; return; }
        labor.staff += e.gross; labor.list.push({ id: id, name: e.name, hours: e.totalH, gross: e.gross, notes: e.notes });
      });
    }
  } catch (e) { labor.err = e.message; }
  var ownerWage = ops_num_(ops_param_('加盟主自評時薪_' + loc, ops_param_('加盟主自評時薪', 0)));
  labor.owner = Math.round(labor.ownerHours * ownerWage);
  var opex = Object.keys(cost).reduce(function (s, k) { return s + cost[k]; }, 0);
  var totalCost = vat + batterCost + matCost + labor.staff + opex + royalty;
  var net = sales - totalCost, netOwner = net - labor.owner;
  var variable = vat + batterCost + matCost + royalty;
  var fixedCost = totalCost - variable, varRatio = sales ? variable / sales : 0;
  var be = openDays && varRatio < 1 ? Math.ceil(fixedCost / (1 - varRatio) / openDays) : null;
  return { loc: loc, ym: ym, revenue: Math.round(revenue), income: income, sales: Math.round(sales), vat: vat, openDays: openDays,
    avgDaily: openDays ? Math.round(revenue / openDays) : 0, batterUse: Math.round(batterUse * 100) / 100, batterPrice: batterPrice, batterCost: batterCost,
    materials: mat, matCost: matCost, labor: labor, ownerWage: ownerWage, costs: cost, fixedApplied: fixedApplied, royaltyRate: rate, royalty: royalty,
    totalCost: Math.round(totalCost), net: Math.round(net), netOwner: Math.round(netOwner), margin: sales ? Math.round(net / sales * 1000) / 10 : 0,
    breakEvenDaily: be, missingPrice: missing, days: Object.keys(days).sort().map(function (d) { return { date: d, rev: days[d].rev, batter: days[d].batter }; }) };
}
function ops_prevYm_(ym) { var y = +ym.slice(0, 4), m = +ym.slice(5) - 1; if (!m) { y--; m = 12; } return y + '-' + ('0' + m).slice(-2); }
function ops_pnl_(p) {
  var me = ops_pnlAuth_(p), loc = String(p.loc), ym = String(p.ym || ops_today_().slice(0, 7));
  var cl = ops_closed_(loc, ym), cur;
  if (cl && cl.status === '已結帳') {
    var snap = ops_json_(String(ops_ss_().getSheetByName('加盟結帳').getRange(cl.row, 6).getValue() || ''), null);
    cur = snap || ops_pnlCalc_(loc, ym);
  } else cur = ops_pnlCalc_(loc, ym);
  var pc = ops_closed_(loc, ops_prevYm_(ym)), prev = null;
  try {
    if (pc && pc.status === '已結帳') prev = ops_json_(String(ops_ss_().getSheetByName('加盟結帳').getRange(pc.row, 6).getValue() || ''), null);
    if (!prev && p.withPrev !== false) prev = ops_pnlCalc_(loc, ops_prevYm_(ym));
  } catch (e) {}
  return { success: true, pnl: cur, prev: prev ? { revenue: prev.revenue, net: prev.net, margin: prev.margin } : null,
    closed: cl, expenses: ops_expRows_(loc, ym).map(function (e) { delete e.row; return e; }), fixed: ops_fixedRows_(loc),
    canReopen: me.role >= 3, incomeCats: OPS_INCOME_CATS, expCats: OPS_EXP_CATS };
}
function ops_lockedCheck_(loc, ym) { var cl = ops_closed_(loc, ym); if (cl && cl.status === '已結帳') throw new Error(ym + ' 已結帳，要修改請總部（Lv.3）解鎖'); }
function ops_expAdd_(p) {
  var me = ops_pnlAuth_(p), loc = String(p.loc), d = String(p.date || ops_today_()), ym = d.slice(0, 7);
  ops_lockedCheck_(loc, ym);
  var cat = String(p.cat || ''); if (OPS_INCOME_CATS.indexOf(cat) < 0 && OPS_EXP_CATS.indexOf(cat) < 0) return { error: '請選分類' };
  var amt = ops_num_(p.amount); if (!(amt > 0)) return { error: '金額要大於 0' };
  var id = 'X' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
  ops_sheet_('加盟費用', OPS_EXP_HEAD).appendRow([id, loc, ym, d, cat, amt, String(p.note || '').slice(0, 100), String(p.photo || ''), me.name, ops_now_()]);
  return { success: true, id: id };
}
function ops_expDel_(p) {
  ops_pnlAuth_(p);
  var x = ops_expRows_(String(p.loc), '').filter(function (e) { return e.id === String(p.id || ''); })[0];
  if (!x) return { error: '找不到這筆' };
  ops_lockedCheck_(x.loc, x.ym);
  ops_ss_().getSheetByName('加盟費用').deleteRow(x.row);
  return { success: true };
}
function ops_fixedSave_(p) {
  ops_pnlAuth_(p);
  var loc = String(p.loc), list = ops_arr_(p.list), sh = ops_sheet_('加盟固定費用', OPS_FIX_HEAD);
  var keep = ops_rows_(sh, 6).filter(function (r) { return String(r[0]) !== loc && String(r[0]).trim(); });
  list.forEach(function (f) { if (OPS_EXP_CATS.indexOf(f.cat) >= 0 && ops_num_(f.amount) > 0) keep.push([loc, f.cat, ops_num_(f.amount), String(f.from || ''), String(f.to || ''), String(f.note || '')]); });
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 6).clearContent();
  if (keep.length) sh.getRange(2, 1, keep.length, 6).setValues(keep);
  return { success: true };
}
function ops_pnlClose_(p) {
  var me = ops_pnlAuth_(p), loc = String(p.loc), ym = String(p.ym || '');
  if (!/^\d{4}-\d{2}$/.test(ym) || ym >= ops_today_().slice(0, 7)) return { error: '只能結帳已經過完的月份' };
  var snap = ops_pnlCalc_(loc, ym), cl = ops_closed_(loc, ym), sh = ops_sheet_('加盟結帳', OPS_CLOSE_HEAD);
  var row = [loc, ym, '已結帳', me.name, ops_now_(), JSON.stringify(snap)];
  if (cl) sh.getRange(cl.row, 1, 1, 6).setValues([row]); else sh.appendRow(row);
  try { if (typeof pay3_writeFranchise_ === 'function') pay3_writeFranchise_(ym, loc); } catch (e) {}
  return { success: true };
}
function ops_pnlReopen_(p) {
  var me = ops_need_(p, 3, true), cl = ops_closed_(String(p.loc), String(p.ym));
  if (!cl) return { error: '這個月還沒結帳' };
  ops_ss_().getSheetByName('加盟結帳').getRange(cl.row, 3, 1, 3).setValues([['已解鎖', me.name, ops_now_()]]);
  return { success: true };
}
// 總部：應收加盟店（物料款＋權利金）
function ops_receivable_(p) {
  ops_need_(p, 3, true);
  var ym = String(p.ym || ops_prevYm_(ops_today_().slice(0, 7)));
  return { success: true, ym: ym, data: ops_locs_().filter(function (x) { return /加盟/.test(x.kind); }).map(function (x) {
    var c = ops_pnlCalc_(x.name, ym);
    return { loc: x.name, revenue: c.revenue, royalty: c.royalty, batter: c.batterCost, materials: c.matCost, total: c.royalty + c.batterCost + c.matCost, missingPrice: c.missingPrice };
  }) };
}

// 登入後 App 查一次：帳號類型、可管理的櫃位、加盟店、待辦數
function ops_meInfo_(p) {
  var me = ops_me_(p.empId), mine = ops_myLocs_(me), locs = ops_locs_();
  var fr = locs.filter(function (x) { return /加盟/.test(x.kind) && x.status !== '已停用' && (me.role >= 3 || (me.role >= 2 && mine.indexOf(x.name) >= 0)); }).map(function (x) { return x.name; });
  var home = locs.filter(function (x) { return x.status !== '已停用' && mine.indexOf(x.name) >= 0; }).map(function (x) { return x.name; });
  var tokens = String(me.managed || '').split(/[、,，\/\s;；]+/).filter(String);
  var myLoc = locs.filter(function (x) { return tokens.some(function (t) { return x.name === t || x.name.indexOf(t) >= 0; }); }).map(function (x) { return x.name; });
  var onb = 0; if (me.role >= 2) { var m = ops_onbMap_(); Object.keys(m).forEach(function (k) { if (!m[k].done) onb++; }); }
  var mat = 0; if (me.role >= 3) ops_matRows_().forEach(function (x) { if (/已送出|已收到/.test(x.status)) mat++; });
  return { success: true, type: me.type, role: me.role, top: me.top, myLocs: myLoc, manageLocs: me.role >= 3 ? [] : home, franchiseLocs: fr,
    onboardPending: onb, matPending: mat, annMinRole: Number(ops_param_('公告發布最低權限', 2)) || 2 };
}

// ── 路由 ──
function opsHandler_(action, p) {
  if (!/^ops/.test(String(action || ''))) return null;
  p = p || {}; OPS_C_ = {};
  try {
    switch (action) {
      case 'opsMe':           return ops_meInfo_(p);
      case 'opsLocList':      return ops_locList_(p);
      case 'opsLocSave':      return ops_locSave_(p);
      case 'opsLocStatus':    return ops_locStatus_(p);
      case 'opsStaffList':    return ops_staffList_(p);
      case 'opsStaffAdd':     return ops_staffAdd_(p);
      case 'opsStaffUpdate':  return ops_staffUpdate_(p);
      case 'opsOnboard':      return ops_onboard_(p);
      case 'opsOnboardCheck': return ops_onboardCheck_(p);
      case 'opsPriceList':    return ops_priceList_(p);
      case 'opsPriceSave':    return ops_priceSave_(p);
      case 'opsMatItems':     return ops_matItems_(p);
      case 'opsMatCreate':    return ops_matCreate_(p);
      case 'opsMatList':      return ops_matList_(p);
      case 'opsMatStatus':    return ops_matStatus_(p);
      case 'opsMatMonthly':   return ops_matMonthly_(p);
      case 'opsFranchise':    return ops_franchiseLocs_(p);
      case 'opsPnl':          return ops_pnl_(p);
      case 'opsExpAdd':       return ops_expAdd_(p);
      case 'opsExpDel':       return ops_expDel_(p);
      case 'opsFixedSave':    return ops_fixedSave_(p);
      case 'opsPnlClose':     return ops_pnlClose_(p);
      case 'opsPnlReopen':    return ops_pnlReopen_(p);
      case 'opsReceivable':   return ops_receivable_(p);
    }
  } catch (e) { return { error: e.message }; }
  return null;
}

// 部署後執行一次（只補缺的，不動資料）
function ops_setup() {
  ops_sheet_('物料需求', OPS_MAT_HEAD); ops_sheet_('加盟費用', OPS_EXP_HEAD); ops_sheet_('加盟固定費用', OPS_FIX_HEAD);
  ops_sheet_('加盟結帳', OPS_CLOSE_HEAD); ops_sheet_('到職檢查', OPS_ONB_HEAD);
  var pr = ops_sheet_('供貨價格', OPS_PRICE_HEAD);
  if (pr.getLastRow() < 2) pr.getRange(2, 1, OPS_MAT_ITEMS.length - 1, 4).setValues(OPS_MAT_ITEMS.slice(0, -1).map(function (x) { return [x[0], x[1], '', '單價待隊長補上'] }));
  var st = ops_ss_().getSheetByName('夥伴資料'), head = st.getRange(1, 1, 1, st.getLastColumn()).getValues()[0];
  if (head.map(String).indexOf('帳號類型') < 0) st.getRange(1, st.getLastColumn() + 1).setValue('帳號類型');
  var ps = ops_ss_().getSheetByName('參數設定'), have = ps.getDataRange().getValues().map(function (r) { return String(r[0]).trim(); });
  [['加盟權利金比率', 0.01, '加盟店權利金＝營業額 × 此比率（1% 填 0.01）'], ['加盟店開發票', '是', '是＝損益自動扣 5% 營業稅'], ['加盟主自評時薪', 0, '加盟主自己上班的人力成本（只用在損益「含加盟主人力」）'],
   ['新工時規則起始月', '2026-12', '此月起：排班定框、打卡定實際、加班需核准'], ['遲到早退寬限分鐘', 15, ''], ['公告發布最低權限', 2, '2＝分隊長也能發（只能發給自己負責的櫃位）；3＝只有管理者']]
    .forEach(function (x) { if (have.indexOf(x[0]) < 0) ps.appendRow(x); });
  return '營運管理 v1 安裝完成';
}

// 櫃位名稱 → 櫃位編號（各模組共用；依〈櫃位設定〉J 欄，空白或找不到時用名稱前兩碼）
function loc_code_(n) {
  n = String(n || '').trim(); if (!n) return '';
  try { if (typeof OPS_C_ !== 'undefined') { var l = ops_locByName_(n); if (l && l.code) return l.code; } } catch (e) {}
  var m = n.match(/^(\d{2})/); return m ? m[1] : '';
}

// 試算表分頁整理：依用途排順序、上顏色，系統用的分頁先隱藏（名稱不改，程式不受影響）。部署後執行一次，之後新增分頁時可再執行。
var OPS_TAB_GROUPS = [
  ['#c0392b', false, ['夥伴資料', '到職檢查']],
  ['#e67e22', false, ['櫃位設定', '物料需求', '供貨價格', '加盟費用', '加盟固定費用', '加盟結帳', '加盟店薪資', '訂單', '缺貨看板']],
  ['#f1c40f', false, ['打卡紀錄', '班表', '班型設定', '換班申請', '可上班登記', '出勤確認', '開店盤點', '收店盤點', '行事曆設定']],
  ['#27ae60', false, ['薪資明細', '累計工時', '達標紀錄', '業績記錄', '特休紀錄', '年終結算', '介紹獎金追蹤', '參數設定', '勞保級距表', '健保級距表', '面糊成本設定']],
  ['#2980b9', false, ['公告', 'LINE群組', '投票', '投票紀錄', 'SOP', '題庫']],
  ['#8e44ad', true,  ['赤心幣流水帳', '遊戲參數', '商品目錄', '擁有物品', '徽章紀錄', '互動紀錄', '答題紀錄', '團隊基金', '寵物', '寵物相簿', '寵物日記', '寵物交換', '寵物動態', '工時日結', '扭蛋紀錄', '生日祝福', '小遊戲紀錄', '對戰裝備', '對戰紀錄', '即時對戰', '塔防', '塔防戰報', '塔防投入', '小店', '小店交易', '禮物', '角色造型', '造型道具']],
  ['#7f8c8d', true,  ['打卡紀錄_歷史', '開店盤點_歷史', '收店盤點_歷史']]
];
function ops_organizeTabs() {
  var ss = ops_ss_(), pos = 1, done = {};
  OPS_TAB_GROUPS.forEach(function (g) {
    g[2].forEach(function (n) {
      var sh = ss.getSheetByName(n); if (!sh) return;
      sh.setTabColor(g[0]); ss.setActiveSheet(sh); ss.moveActiveSheet(pos++); done[n] = 1;
      if (g[1]) sh.hideSheet(); else if (sh.isSheetHidden()) sh.showSheet();
    });
  });
  ss.setActiveSheet(ss.getSheetByName('夥伴資料'));
  var rest = ss.getSheets().map(function (s) { return s.getName(); }).filter(function (n) { return !done[n]; });
  return '已整理 ' + Object.keys(done).length + ' 個分頁' + (rest.length ? '；未分類（放在最後）：' + rest.join('、') : '');
}

// 覆蓋排班系統的 sch_locNames_：排班只列出沒有停用、沒有結束的櫃位（舊班表仍保留）
function sch_locNames_() {
  if (SCH_C_.locs) return SCH_C_.locs;
  var sh = sch_ss_().getSheetByName('櫃位設定'), out = [];
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues().forEach(function (r) {
    var n = String(r[0]).trim(); if (n && !/已停用|已結束/.test(String(r[4] || ''))) out.push(n);
  });
  return (SCH_C_.locs = out);
}

// 覆蓋排班系統的 sch_staff_：合作夥伴（例：桃機山海豆花）不排班，不出現在排班名單
function sch_staff_() {
  if (SCH_C_.staff) return SCH_C_.staff;
  var v = sch_ss_().getSheetByName('夥伴資料').getDataRange().getValues(), head = v[0] || [], out = {};
  var iMng = 46, iStu = -1, iType = -1;
  head.forEach(function (h, i) { h = String(h); if (/負責櫃位/.test(h)) iMng = i; if (/學生/.test(h)) iStu = i; if (h.trim() === '帳號類型') iType = i; });
  for (var r = 1; r < v.length; r++) {
    var id = String(v[r][0]).trim(); if (!id) continue;
    if (iType >= 0 && /合作/.test(String(v[r][iType]))) continue;
    out[id] = {
      id: id, name: String(v[r][1]).trim(), left: String(v[r][10] || '').trim() !== '',
      role: parseInt(v[r][12]) || (/管理/.test(String(v[r][12])) ? 3 : 1),
      managed: String(v[r][iMng] || ''), student: iStu >= 0 && /是|Y|1|學生/i.test(String(v[r][iStu]))
    };
  }
  return (SCH_C_.staff = out);
}
