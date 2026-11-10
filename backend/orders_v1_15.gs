// ═══════════════════════════════════════════════
// 訂單系統 後端模組 v1(2026-11-10)
// 貼在「程式碼.gs」最底部;再於 extHandler_ 內加 1 行(見最下方)。
// 第一次使用時自動建立工作表「訂單」(一單一列)。日期、時間一律存成文字,避免試算表自動轉格式。
// 權限:所有夥伴都能建單、改單、看單;金額欄位所有人可填。每筆自動記錄最後修改人與時間。
// 隱私:已交付／已取消超過 3 天的單,一般夥伴看到的電話與統編會隱藏(分隊長、管理者仍可看)。
// ═══════════════════════════════════════════════
var OD_HEAD = ['訂單編號','櫃位','日期','時間','訂單內容(JSON)','其他內容','預計製作(分)','取貨方式','地點','外送時間','外送方式','外送人員/平台',
               '客戶姓名','電話','統編','注意事項','狀態','總金額','訂金','付款狀態','建單人ID','建單人','建單時間','最後修改人','最後修改時間'];
var OD_STATUS = ['新訂單','製作中','已完成','已交付','已取消'];
var OD_PAY = ['未付款','已付訂金','已付清'];

function od_sheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID), sh = ss.getSheetByName('訂單');
  if (!sh) { sh = ss.insertSheet('訂單'); sh.appendRow(OD_HEAD); sh.setFrozenRows(1); }
  return sh;
}
function od_emp_(empId) {
  var v = SpreadsheetApp.openById(SHEET_ID).getSheetByName('夥伴資料').getDataRange().getValues();
  for (var r = 1; r < v.length; r++) if (String(v[r][0]).trim() === empId) return { name: String(v[r][1] || ''), role: v[r][12] };
  return null;
}
function od_isLead_(role) { return Number(role) >= 2 || /分隊|管理/.test(String(role)); }
function od_now_() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm'); }
function od_str_(v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/g, ' ').trim().slice(0, n); }
function od_num_(v) { var n = Number(String(v == null ? '' : v).replace(/[, ]/g, '')); return isFinite(n) && n >= 0 ? n : 0; }

function od_rowToObj_(r, canSeePrivate) {
  var items = []; try { items = JSON.parse(r[4] || '[]'); } catch (e) {}
  var hide = !canSeePrivate && (r[16] === '已交付' || r[16] === '已取消') &&
             (new Date().getTime() - new Date(String(r[24] || r[22]).replace(' ', 'T') + ':00+08:00').getTime()) > 3 * 86400000;
  return { id: r[0], loc: r[1], date: String(r[2]), time: String(r[3]), items: items, extra: r[5], prep: Number(r[6]) || 0,
    method: r[7], place: r[8], sendTime: String(r[9] || ''), sendBy: r[10], carrier: r[11],
    cname: r[12], phone: hide && r[13] ? '(已隱藏)' : String(r[13] || ''), taxId: hide && r[14] ? '(已隱藏)' : String(r[14] || ''),
    notes: r[15], status: r[16], total: Number(r[17]) || 0, deposit: Number(r[18]) || 0, pay: r[19] || '未付款',
    byId: r[20], byName: r[21], created: String(r[22]), modName: r[23], modTime: String(r[24]) };
}

function od_get_(p) {
  var emp = od_emp_(String(p.empId || '').trim()); if (!emp) return { error: '找不到此帳號' };
  var today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
  var from = /^\d{4}-\d{2}-\d{2}$/.test(p.from || '') ? p.from : today;
  var to = /^\d{4}-\d{2}-\d{2}$/.test(p.to || '') ? p.to : Utilities.formatDate(new Date(Date.now() + 14 * 86400000), 'Asia/Taipei', 'yyyy-MM-dd');
  var back = Utilities.formatDate(new Date(Date.now() - 30 * 86400000), 'Asia/Taipei', 'yyyy-MM-dd');
  var v = od_sheet_().getDataRange().getValues(), out = [], lead = od_isLead_(emp.role);
  for (var i = 1; i < v.length; i++) {
    var d = String(v[i][2]), st = v[i][16];
    var open = st === '新訂單' || st === '製作中' || st === '已完成';
    if ((d >= from && d <= to) || (open && d < from && d >= back)) out.push(od_rowToObj_(v[i], lead));
  }
  out.sort(function (a, b) { return (a.date + a.time) < (b.date + b.time) ? -1 : 1; });
  return { success: true, data: out };
}

function od_clean_(o, old) {
  o = typeof o === 'string' ? JSON.parse(o) : (o || {});
  var e = null;
  var loc = od_str_(o.loc, 40), date = od_str_(o.date, 10), time = od_str_(o.time, 5);
  if (!loc) return { error: '請選擇櫃位' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: '日期格式不正確' };
  if (!/^\d{2}:\d{2}$/.test(time)) return { error: '請填取貨/送達時間' };
  var items = [];
  (Array.isArray(o.items) ? o.items : []).slice(0, 30).forEach(function (it) {
    var nm = od_str_(it && it.name, 30), q = Math.min(999, Math.max(0, Math.round(Number(it && it.qty) || 0)));
    if (nm && q > 0) items.push({ name: nm, qty: q });
  });
  var extra = od_str_(o.extra, 500);
  if (!items.length && !extra) return { error: '請填寫訂單內容' };
  var method = o.method === '外送' ? '外送' : '自取';
  var cname = od_str_(o.cname, 30);
  if (!cname) return { error: '請填客戶姓名' };
  var phone = od_str_(o.phone, 20).replace(/[^\d+\-() ]/g, '');
  var taxId = od_str_(o.taxId, 8);
  if (taxId && !/^\d{8}$/.test(taxId)) return { error: '統編需為 8 碼數字' };
  var place = od_str_(o.place, 120), sendTime = od_str_(o.sendTime, 5);
  if (method === '外送') {
    if (!place) return { error: '請填外送地址' };
    if (!/^\d{2}:\d{2}$/.test(sendTime)) return { error: '請填外送時間' };
  } else sendTime = '';
  var st = OD_STATUS.indexOf(o.status) >= 0 ? o.status : (old ? old.status : '新訂單');
  var pay = OD_PAY.indexOf(o.pay) >= 0 ? o.pay : '未付款';
  return { ok: { loc: loc, date: date, time: time, items: items, extra: extra, prep: Math.min(1440, Math.round(od_num_(o.prep))),
    method: method, place: place, sendTime: sendTime, sendBy: method === '外送' ? (o.sendBy === '外送平台' ? '外送平台' : '自己送') : '',
    carrier: method === '外送' ? od_str_(o.carrier, 40) : '', cname: cname, phone: phone, taxId: taxId, notes: od_str_(o.notes, 500),
    status: st, total: od_num_(o.total), deposit: od_num_(o.deposit), pay: pay } };
}

function od_save_(p) {
  var empId = String(p.empId || '').trim(), emp = od_emp_(empId); if (!emp) return { error: '找不到此帳號' };
  var id = od_str_((typeof p.order === 'string' ? JSON.parse(p.order) : (p.order || {})).id, 30);
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = od_sheet_(), v = sh.getDataRange().getValues(), now = od_now_(), rowIdx = -1;
    if (id) for (var r = 1; r < v.length; r++) if (v[r][0] === id) { rowIdx = r; break; }
    if (id && rowIdx < 0) return { error: '找不到這筆訂單' };
    var c = od_clean_(p.order, rowIdx >= 0 ? { status: v[rowIdx][16] } : null); if (c.error) return c;
    var o = c.ok, row, created = now, byId = empId, byName = emp.name;
    if (rowIdx >= 0) { created = v[rowIdx][22]; byId = v[rowIdx][20]; byName = v[rowIdx][21]; }
    else {
      var pre = 'O' + now.slice(0, 10).replace(/-/g, '') + '-', n = 0;
      for (var i = 1; i < v.length; i++) if (String(v[i][0]).indexOf(pre) === 0) n++;
      id = pre + ('00' + (n + 1)).slice(-3);
    }
    row = [id, o.loc, o.date, o.time, JSON.stringify(o.items), o.extra, o.prep, o.method, o.place, o.sendTime, o.sendBy, o.carrier,
           o.cname, o.phone, o.taxId, o.notes, o.status, o.total, o.deposit, o.pay, byId, byName, created, emp.name, now];
    var target = rowIdx >= 0 ? rowIdx + 1 : sh.getLastRow() + 1;
    var rng = sh.getRange(target, 1, 1, OD_HEAD.length);
    rng.setNumberFormat('@');                    // 全部存成文字(電話開頭 0、統編、日期不被轉換)
    rng.setValues([row]);
    return { success: true, data: od_rowToObj_(row, true) };
  } finally { lock.releaseLock(); }
}

function od_status_(p) {
  var empId = String(p.empId || '').trim(), emp = od_emp_(empId); if (!emp) return { error: '找不到此帳號' };
  var id = od_str_(p.id, 30), st = String(p.status || '');
  if (OD_STATUS.indexOf(st) < 0) return { error: '狀態不正確' };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = od_sheet_(), v = sh.getDataRange().getValues();
    for (var r = 1; r < v.length; r++) if (v[r][0] === id) {
      var rng = sh.getRange(r + 1, 17); rng.setNumberFormat('@'); rng.setValue(st);
      var m = sh.getRange(r + 1, 24, 1, 2); m.setNumberFormat('@'); m.setValues([[emp.name, od_now_()]]);
      return { success: true };
    }
    return { error: '找不到這筆訂單' };
  } finally { lock.releaseLock(); }
}

function odHandler_(action, p) {
  try {
    if (action === 'getOrders') return od_get_(p || {});
    if (action === 'saveOrder') return od_save_(p || {});
    if (action === 'setOrderStatus') return od_status_(p || {});
  } catch (e) { return { error: '訂單功能發生錯誤:' + e.message }; }
  return null;
}

// 路由:在 extHandler_ 內、avHandler_ 那行的下一行,加入:
//   var od = odHandler_(action, p); if (od) return od;
