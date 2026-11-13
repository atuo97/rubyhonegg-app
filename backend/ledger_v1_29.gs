// ═══════════════════════════════════════════════
// v1.29 內帳（2026-11-13）— 只有大隊長（Lv.5）可以用
// 貼在「寵物行事曆 v1.28」之後、「路由v1.29」之前。部署後執行一次 ac_setup()
// 〈內帳〉欄位和「營收總表」一樣：日期、公司、收支、記帳類別、子類別、單位、銷貨金額、稅額、發票金額、備註，另加照片、登記人、登記時間、編號、來源
// 動作：acMeta 類別清單、acList 明細、acSave 記一筆／修改、acDel 刪除、acImport 匯入（重複的自動跳過）、acSummary 損益看板
// 匯出營收總表 Excel 在 App 前端產生（格式和原本一樣）
// ═══════════════════════════════════════════════

var AC_HEAD = ['日期', '公司', '收支', '記帳類別', '子類別', '單位', '銷貨金額', '稅額', '發票金額', '備註', '照片', '登記人', '登記時間', '編號', '來源'];
var AC_COMPANY = ['90011886', '42274298'];
var AC_EXP = ['薪資人事', '通路費用', '食材成本', '租金費用', '政府費用', '生財器具', '交通費用', '包材費用', '物流費用', '輸出費用', '保險費用', '會計費用', '辦公費用', '電信費用', '其他費用', '裝潢費用', '水電費用', '公益捐贈',
  '金融費用', '餐飲費用', '清潔費用', '差旅費用', '通路押金', '系統費用'];
var AC_INC = ['百貨營收', '通路營收', '活動營收', '展覽營收', '技術營收', '加盟營收', '其他營收'];

function ac_need_(p) { var me = ops_me_(p.empId); if (me.role < 5) throw new Error('內帳只有大隊長可以使用'); return me; }
function ac_sheet_() {
  var ss = ops_ss_(), sh = ss.getSheetByName('內帳');
  if (!sh) { sh = ss.insertSheet('內帳'); sh.getRange(1, 1, 1, AC_HEAD.length).setValues([AC_HEAD]); sh.setFrozenRows(1); }
  return sh;
}
function ac_d_(v) { return v instanceof Date ? Utilities.formatDate(v, 'Asia/Taipei', 'yyyy-MM-dd') : String(v || '').slice(0, 10).replace(/\//g, '-'); }
function ac_rows_() {
  var sh = ac_sheet_(); if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, AC_HEAD.length).getValues().map(function (r, i) {
    return { row: i + 2, date: ac_d_(r[0]), co: String(r[1] || ''), io: String(r[2] || ''), cat: String(r[3] || ''), sub: String(r[4] || ''), unit: String(r[5] || ''),
      net: r[6] === '' ? null : Number(r[6]), tax: r[7] === '' ? null : Number(r[7]), amt: Number(r[8]) || 0, note: String(r[9] || ''), photo: String(r[10] || ''),
      by: String(r[11] || ''), at: String(r[12] || ''), id: String(r[13] || ''), src: String(r[14] || '') };
  }).filter(function (x) { return x.date; });
}
function ac_key_(x) { return [x.date, x.io, Math.round(Number(x.amt) || 0), String(x.unit || '').trim(), String(x.note || '').trim()].join('|'); }
function ac_period_(ym) { var y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)), s = m % 2 ? m : m - 1; return { from: y + '-' + ('0' + s).slice(-2) + '-01', to: y + '-' + ('0' + (s + 1)).slice(-2) + '-31', label: (y - 1911) + '年' + s + '-' + (s + 1) + '月' }; }

function ac_meta_(p) { ac_need_(p); return { success: true, data: { companies: AC_COMPANY, exp: AC_EXP, inc: AC_INC } }; }
function ac_list_(p) {
  ac_need_(p);
  var from = ac_d_(p.from) || '0000', to = ac_d_(p.to) || '9999', q = String(p.q || '').trim(), cat = String(p.cat || ''), io = String(p.io || '');
  var list = ac_rows_().filter(function (x) {
    return x.date >= from && x.date <= to && (!cat || x.cat === cat) && (!io || x.io === io) && (!q || (x.unit + x.sub + x.note + x.cat).indexOf(q) >= 0);
  }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.row - b.row; });
  return { success: true, data: list };
}
function ac_clean_(x) {
  var date = ac_d_(x.date); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: '日期格式不對' };
  var io = x.io === '收入' ? '收入' : '支出', amt = Math.round(Number(x.amt) * 100) / 100;
  if (!isFinite(amt) || amt === 0) return { error: '請填發票金額' };
  var net = x.net === '' || x.net == null ? '' : Number(x.net), tax = x.tax === '' || x.tax == null ? '' : Number(x.tax);
  if (x.autoTax && net === '' && tax === '') { net = Math.round(amt / 1.05); tax = amt - net; }
  return { v: [date, String(x.co || AC_COMPANY[0]).slice(0, 10), io, String(x.cat || '').slice(0, 10), String(x.sub || '').slice(0, 30), String(x.unit || '').slice(0, 40), net, tax, amt, String(x.note || '').slice(0, 200)] };
}
function ac_save_(p) {
  var me = ac_need_(p), x = p.item || {}; if (typeof x === 'string') x = ops_json_(x, {});
  var c = ac_clean_(x); if (c.error) return c;
  var sh = ac_sheet_(), lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    if (x.id) {
      var hit = ac_rows_().filter(function (r) { return r.id === String(x.id); })[0]; if (!hit) return { error: '找不到這筆' };
      sh.getRange(hit.row, 1, 1, 15).setValues([c.v.concat([String(x.photo || hit.photo || ''), me.name, ops_now_(), hit.id, hit.src || 'App'])]);
      return { success: true, id: hit.id };
    }
    var id = typeof au_id_ === 'function' ? au_id_('B') : 'B' + Date.now();
    sh.appendRow(c.v.concat([String(x.photo || ''), me.name, ops_now_(), id, 'App']));
    return { success: true, id: id };
  } finally { lock.releaseLock(); }
}
function ac_del_(p) {
  ac_need_(p);
  var hit = ac_rows_().filter(function (r) { return r.id === String(p.id); })[0]; if (!hit) return { error: '找不到這筆' };
  ac_sheet_().deleteRow(hit.row); return { success: true };
}
// 匯入（前端讀 Excel 後分批送來，一批最多 500 筆）；日期＋收支＋金額＋單位＋備註都一樣的，已經有幾筆就跳過幾筆（重複匯入不會多算，同一天真的有兩筆一樣的也不會漏）
function ac_import_(p) {
  var me = ac_need_(p), list = ops_arr_(p.rows); if (list.length > 500) return { error: '一次最多 500 筆' };
  var have = {}, seen = {}; ac_rows_().forEach(function (r) { var k = ac_key_(r); have[k] = (have[k] || 0) + 1; });   // 同一天同店同金額可能真的有好幾筆：只跳過已經存在的筆數
  var add = [], skip = 0, bad = 0, src = String(p.src || '匯入').slice(0, 40);
  list.forEach(function (x, i) {
    var c = ac_clean_(x); if (c.error) { bad++; return; }
    var k = ac_key_({ date: c.v[0], io: c.v[2], amt: c.v[8], unit: c.v[5], note: c.v[9] });
    seen[k] = (seen[k] || 0) + 1;
    if (seen[k] <= (have[k] || 0)) { skip++; return; }
    add.push(c.v.concat(['', me.name, ops_now_(), 'B' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss') + ('000' + i).slice(-4) + Math.floor(Math.random() * 90 + 10), String(x.src || src).slice(0, 40)]));
  });
  if (add.length) { var sh = ac_sheet_(), lock = LockService.getScriptLock(); lock.waitLock(20000); try { sh.getRange(sh.getLastRow() + 1, 1, add.length, AC_HEAD.length).setValues(add); } finally { lock.releaseLock(); } }
  return { success: true, added: add.length, skipped: skip, bad: bad };
}
// 損益看板：每月收入、支出（依類別）、淨額；另附 App 收店盤點的營業額做對照，以及要注意的資料
function ac_summary_(p) {
  ac_need_(p);
  var y = String(p.year || Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy')), months = {}, warn = [];
  var mk = function (m) { return months[m] = months[m] || { ym: m, inc: 0, exp: 0, incCat: {}, expCat: {}, storeRev: 0, count: 0 }; };
  ac_rows_().forEach(function (x) {
    if (x.date.slice(0, 4) !== y) return;
    var m = mk(x.date.slice(0, 7)); m.count++;
    if (x.io === '收入') { m.inc += x.amt; m.incCat[x.cat || '未分類'] = (m.incCat[x.cat || '未分類'] || 0) + x.amt; if (AC_INC.indexOf(x.cat) < 0) warn.push({ id: x.id, date: x.date, text: '收入的類別是「' + (x.cat || '空白') + '」', amt: x.amt, unit: x.unit }); }
    else { m.exp += x.amt; m.expCat[x.cat || '未分類'] = (m.expCat[x.cat || '未分類'] || 0) + x.amt; if (!x.cat) warn.push({ id: x.id, date: x.date, text: '支出沒有填類別', amt: x.amt, unit: x.unit }); }
  });
  try {   // App 營業額（收店盤點）對照
    gm_closeRows_().forEach(function (r) { var d = String(r.date || ''); if (d.slice(0, 4) === y) mk(d.slice(0, 7)).storeRev += Number(r.rev) || 0; });
  } catch (e) {}
  var list = Object.keys(months).sort().map(function (k) { var m = months[k]; m.net = m.inc - m.exp; return m; });
  var tot = { inc: 0, exp: 0, expCat: {}, incCat: {} };
  list.forEach(function (m) { tot.inc += m.inc; tot.exp += m.exp; Object.keys(m.expCat).forEach(function (c) { tot.expCat[c] = (tot.expCat[c] || 0) + m.expCat[c]; }); Object.keys(m.incCat).forEach(function (c) { tot.incCat[c] = (tot.incCat[c] || 0) + m.incCat[c]; }); });
  tot.net = tot.inc - tot.exp;
  return { success: true, data: { year: y, months: list, total: tot, warn: warn.slice(0, 50) } };
}

AU_READ = new RegExp(AU_READ.source.replace('|calList)$', '|calList|acMeta|acSummary)$'));

function acHandler_(action, p) {
  var map = { acMeta: ac_meta_, acList: ac_list_, acSave: ac_save_, acDel: ac_del_, acImport: ac_import_, acSummary: ac_summary_ };
  if (!map[action]) return null;
  try { GM_CACHE_ = {}; return map[action](p); } catch (e) { return { error: e.message }; }
}
function ac_setup() {
  ac_sheet_();
  var sh = ac_sheet_(); sh.getRange('A:A').setNumberFormat('yyyy-mm-dd');
  try { var prot = sh.protect().setDescription('內帳：只有擁有者可以直接改'); prot.setWarningOnly(true); } catch (e) {}
  Logger.log('ac_setup 完成：〈內帳〉已建立');
}
