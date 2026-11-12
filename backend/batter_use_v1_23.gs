// ═══════════════════════════════════════════════
// 麵糊用量模組 v1.23（2026-11-12）— 貼在「營運管理」「薪資引擎v3」「LINE推播」之後、「路由v1.23」之前
// 1. 開店／收店盤點加「黑糖」口味（新欄附加在表尾，不動舊欄）
// 2. 修正收店盤點寫入位置：舊版從「當日營業額」起整列往左偏一格（P 寫成營業額…），改回和標題一致；
//    bu_fixClosePreview() 預覽、bu_fixCloseApply() 修正舊資料
// 3. 各櫃位平日／假日「暫定用量」（原味、其他口味）；Lv.2 以上在 App 填改（Lv.2 只能改自己負責的櫃位）
// 4. 實際平均：自〈參數設定〉「麵糊平均起始日」（預設 2026-12-01）起，依開店＋進貨－收店算每日用量，平日／假日分開平均
// 5. 活動櫃位：按日期提前填預估用量
// 6. 還夠幾天＋建議叫貨量（管理儀表板「各店剩餘麵糊」、麵糊用量頁、物料需求頁提醒）
// 覆蓋：saveOpenStore、saveCloseStore、checkFirstOpener、bt_get_（getBatterStock）、ops_revenueByDay_、gm_closeRows_
// ═══════════════════════════════════════════════

var BU_FL = ['原味', '可可', '紅玉', '抹茶', '黑糖'];
var BU_PLAN_HEAD = ['櫃位編號', '櫃位名稱', '平日原味(包)', '平日其他口味(包)', '假日原味(包)', '假日其他口味(包)', '更新者', '更新時間'];
var BU_EVT_HEAD = ['日期', '櫃位編號', '櫃位名稱', '活動名稱', '原味(包)', '其他口味(包)', '填寫者', '填寫時間'];
// 收店盤點（和標題一致，0 起算）：F 櫃位5、G~J 剩餘6~9、K 剩餘總計10、L~O 消耗11~14、P 總消耗15、Q 當日營業額16、R 零用金17、
// S 照片18、T 交班備注19、U 填寫時間20、V 備注21、W~Z 進貨22~25、AA 每包產值26、AD JSON 29、AE 營業額合計30、AF 黑糖剩餘31、AG 黑糖進貨32
var BU_C = { rem: [6, 7, 8, 9, 31], rs: [22, 23, 24, 25, 32], egg: 16, total: 30 };
var BU_C_OLD = { rem: [6, 7, 8, 9, -1], rs: [21, 22, 23, 24, -1], egg: 15, total: 32 };   // 舊版偏移列
// 開店盤點：G~J 起始6~9、K 總計10、O 黑糖起始14
var BU_O = [6, 7, 8, 9, 14];
var BU_C_ = {};

function bu_n_(v) { var n = parseFloat(String(v == null ? '' : v).replace(/[^\d.\-]/g, '')); return isFinite(n) ? n : 0; }
function bu_blank_(v) { return v === '' || v === null || v === undefined; }
function bu_r2_(x) { return Math.round(x * 100) / 100; }
function bu_isOld_(r) { return String(r[31] == null ? '' : r[31]).charAt(0) === '{'; }   // 舊版：JSON 落在 AF
function bu_addDays_(d, k) { var t = new Date(d + 'T12:00:00+08:00'); t.setDate(t.getDate() + k); return Utilities.formatDate(t, 'Asia/Taipei', 'yyyy-MM-dd'); }

// ── 1. 寫入（覆蓋舊版）──
function saveOpenStore(ss, data) {
  var sheet = ss.getSheetByName('開店盤點');
  var id = 'O' + Date.now(), n = function (v) { return parseFloat(v) || 0; };
  var f = [n(data.original), n(data.cocoa), n(data.ruby), n(data.matcha), n(data.brown)];
  var total = bu_r2_(f.reduce(function (a, b) { return a + b; }, 0));
  sheet.appendRow([id, String(data.date || ''), String(data.scheduleId || ''), String(data.empId || ''), String(data.name || ''), String(data.location || ''),
    f[0], f[1], f[2], f[3], total, String(data.note || ''), new Date().toISOString(), '', f[4]]);
  return { success: true, id: id };
}
function saveCloseStore(ss, data) {
  var sheet = ss.getSheetByName('收店盤點');
  var id = 'C' + Date.now(), n = function (v) { return parseFloat(v) || 0; };
  var rem = [n(data.remOriginal), n(data.remCocoa), n(data.remRuby), n(data.remMatcha), n(data.remBrown)];
  var remT = bu_r2_(rem.reduce(function (a, b) { return a + b; }, 0));
  var itemRev = {};
  try { itemRev = data.itemRevenue ? JSON.parse(data.itemRevenue) : {}; } catch (e) {}
  var eggRevenue = n(itemRev['雞蛋糕'] !== undefined ? itemRev['雞蛋糕'] : data.revenue);
  var vals = Object.keys(itemRev).map(function (k) { return itemRev[k]; });
  var totalRevenue = vals.length ? vals.reduce(function (a, b) { return a + (parseFloat(b) || 0); }, 0) : n(data.revenue);
  sheet.appendRow([
    id, String(data.date || ''), String(data.scheduleId || ''), String(data.empId || ''), String(data.name || ''), String(data.location || ''),
    rem[0], rem[1], rem[2], rem[3], remT,
    '', '', '', '', '',                                           // L~O 各口味消耗、P 總消耗（由程式計算）
    eggRevenue, n(data.cash), String(data.photoUrl || ''), String(data.handoverNote || ''), new Date().toISOString(), '',
    n(data.rsOriginal), n(data.rsCocoa), n(data.rsRuby), n(data.rsMatcha),
    '', '', '',                                                    // AA 每包產值、AB、AC
    JSON.stringify(itemRev), totalRevenue,
    rem[4], n(data.rsBrown)
  ]);
  return { success: true, id: id };
}

// 覆蓋 checkFirstOpener：多回黑糖
function checkFirstOpener(ss, params) {
  var date = String(params.date || ''), loc = String(params.location || '');
  var open = ss.getSheetByName('開店盤點').getDataRange().getValues();
  for (var i = 1; i < open.length; i++) {
    if (dateNorm(open[i][1]) === date && String(open[i][5]) === loc)
      return { success: true, isFirst: false, openedBy: String(open[i][4]), original: open[i][6], cocoa: open[i][7], ruby: open[i][8], matcha: open[i][9], brown: open[i][14] === undefined ? '' : open[i][14] };
  }
  return { success: true, isFirst: true };
}

// ── 2. 修正舊資料（偏移一格的列）──
function bu_fixRows_(apply) {
  var ss = SpreadsheetApp.openById(SHEET_ID), log = [];
  ['收店盤點', '收店盤點_歷史'].forEach(function (name) {
    var sh = ss.getSheetByName(name); if (!sh || sh.getLastRow() < 2) return;
    var w = Math.min(sh.getMaxColumns(), Math.max(sh.getLastColumn(), 33)), v = sh.getRange(2, 1, sh.getLastRow() - 1, w).getValues();
    v.forEach(function (r, i) {
      if (!bu_isOld_(r)) return;
      var nr = r.slice(0, 15).concat([''], r.slice(15, 25), ['', '', ''], [r[31], r[32]], ['', '']);
      while (nr.length < w) nr.push('');
      log.push(name + ' 第 ' + (i + 2) + ' 列 ' + bu_dstr_(r[1]) + ' ' + r[5] + '：營業額 ' + r[15] + '、零用金 ' + r[16] + '、原味進貨 ' + r[21] + ' → 移到正確欄位');
      if (apply) sh.getRange(i + 2, 1, 1, w).setValues([nr.slice(0, w)]);
    });
  });
  return log;
}
function bu_fixClosePreview() { var l = bu_fixRows_(false); Logger.log(l.length ? l.join('\n') : '沒有需要修正的列'); return l; }
function bu_fixCloseApply() { var l = bu_fixRows_(true); Logger.log('已修正 ' + l.length + ' 列\n' + l.join('\n')); return l; }

// ── 部署後執行一次 ──
function bu_setup() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  ['開店盤點', '開店盤點_歷史'].forEach(function (n) { var sh = ss.getSheetByName(n); if (sh && !String(sh.getRange(1, 15).getValue()).trim()) sh.getRange(1, 15).setValue('黑糖起始(包)'); });
  ['收店盤點', '收店盤點_歷史'].forEach(function (n) {
    var sh = ss.getSheetByName(n); if (!sh) return;
    if (!String(sh.getRange(1, 32).getValue()).trim()) sh.getRange(1, 32).setValue('黑糖剩餘(包)');
    if (!String(sh.getRange(1, 33).getValue()).trim()) sh.getRange(1, 33).setValue('黑糖進貨(包)');
  });
  ops_sheet_('麵糊用量設定', BU_PLAN_HEAD); ops_sheet_('活動麵糊預估', BU_EVT_HEAD);
  var ps = ss.getSheetByName('參數設定'), have = {};
  ps.getDataRange().getValues().forEach(function (r) { have[String(r[0]).trim()] = 1; });
  [['麵糊平均起始日', '2026-12-01', '實際平均用量從這天起算'], ['麵糊建議備量天數', 3, '建議叫貨量＝未來幾天的用量－目前剩餘'],
   ['麵糊提醒天數', 2, '還夠天數少於這個數字標紅']].forEach(function (x) { if (!have[x[0]]) ps.appendRow(x); });
  Logger.log('bu_setup 完成；接著執行 bu_fixClosePreview() 看要修正的舊資料，確認後執行 bu_fixCloseApply()');
}

// ── 讀盤點 ──
function bu_dstr_(v) { return typeof ops_d_ === 'function' ? ops_d_(v) : String(v).slice(0, 10); }
function bu_read_(name, fn) {
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(name); if (!sh || sh.getLastRow() < 2) return;
  sh.getRange(2, 1, sh.getLastRow() - 1, Math.min(sh.getMaxColumns(), Math.max(sh.getLastColumn(), 33))).getValues().forEach(fn);
}
function bu_closes_() {                 // → { code: [{date, loc, by, rem[5], rs[5], rev, egg, any}] }（同櫃同日取最後一筆）
  if (BU_C_.closes) return BU_C_.closes;
  var by = {};
  ['收店盤點_歷史', '收店盤點'].forEach(function (n) {
    bu_read_(n, function (r) {
      var loc = String(r[5] || '').trim(), d = bu_dstr_(r[1]); if (!loc || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
      var L = bu_isOld_(r) ? BU_C_OLD : BU_C, any = false;
      var rem = L.rem.map(function (c) { if (c < 0 || bu_blank_(r[c])) return 0; any = true; return bu_n_(r[c]); });
      var rs = L.rs.map(function (c) { return c < 0 ? 0 : bu_n_(r[c]); });
      var tot = bu_blank_(r[L.total]) ? bu_n_(r[L.egg]) : bu_n_(r[L.total]);
      var code = loc_code_(loc) || loc;
      (by[code] = by[code] || {})[d] = { date: d, loc: loc, by: String(r[4] || ''), rem: rem, rs: rs, rev: tot, egg: bu_n_(r[L.egg]), any: any };
    });
  });
  var out = {};
  Object.keys(by).forEach(function (c) { out[c] = Object.keys(by[c]).sort().map(function (d) { return by[c][d]; }); });
  return (BU_C_.closes = out);
}
function bu_opens_() {                  // → { code: { date: f[5] } }
  if (BU_C_.opens) return BU_C_.opens;
  var out = {};
  ['開店盤點_歷史', '開店盤點'].forEach(function (n) {
    bu_read_(n, function (r) {
      var loc = String(r[5] || '').trim(), d = bu_dstr_(r[1]); if (!loc || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
      var code = loc_code_(loc) || loc;
      (out[code] = out[code] || {})[d] = BU_O.map(function (c) { return bu_n_(r[c]); });
    });
  });
  return (BU_C_.opens = out);
}
// 每日用量：開店起始（沒有就用前一次收店剩餘，7 天內）＋當日進貨－收店剩餘
function bu_daily_(code) {
  var cl = bu_closes_()[code] || [], op = bu_opens_()[code] || {}, out = {};
  cl.forEach(function (c, i) {
    if (!c.any) return;
    var start = op[c.date], prev = i > 0 ? cl[i - 1] : null;
    if (!start && prev && prev.any && prev.date >= bu_addDays_(c.date, -7)) start = prev.rem;
    if (!start) return;
    var u = BU_FL.map(function (f, k) { return Math.max(0, bu_r2_(start[k] + c.rs[k] - c.rem[k])); });
    out[c.date] = { use: u, orig: u[0], other: bu_r2_(u[1] + u[2] + u[3] + u[4]) };
  });
  return out;
}

// ── 設定與預估 ──
function bu_plans_() {
  if (BU_C_.plans) return BU_C_.plans;
  var sh = ops_sheet_('麵糊用量設定', BU_PLAN_HEAD), out = {};
  ops_rows_(sh, 8).forEach(function (r, i) {
    var c = String(r[0]).replace(/^'/, '').trim(); if (/^\d$/.test(c)) c = '0' + c; if (!c) return;
    out[c] = { row: i + 2, wdO: bu_blank_(r[2]) ? null : bu_n_(r[2]), wdX: bu_blank_(r[3]) ? null : bu_n_(r[3]),
      heO: bu_blank_(r[4]) ? null : bu_n_(r[4]), heX: bu_blank_(r[5]) ? null : bu_n_(r[5]), by: String(r[6] || ''), at: String(r[7] || '') };
  });
  return (BU_C_.plans = out);
}
function bu_events_() {
  if (BU_C_.evts) return BU_C_.evts;
  var sh = ops_sheet_('活動麵糊預估', BU_EVT_HEAD), out = {};
  ops_rows_(sh, 8).forEach(function (r, i) {
    var d = bu_dstr_(r[0]), c = String(r[1]).replace(/^'/, '').trim(); if (/^\d$/.test(c)) c = '0' + c; if (!d || !c) return;
    (out[c] = out[c] || []).push({ row: i + 2, date: d, name: String(r[3] || ''), orig: bu_n_(r[4]), other: bu_n_(r[5]), by: String(r[6] || '') });
  });
  Object.keys(out).forEach(function (c) { out[c].sort(function (a, b) { return a.date < b.date ? -1 : 1; }); });
  return (BU_C_.evts = out);
}
function bu_cal_() { return BU_C_.cal || (BU_C_.cal = (typeof sch_calendar_ === 'function' ? sch_calendar_('') : {})); }
function bu_isHol_(d) {
  var cal = bu_cal_();
  if (typeof sch_isHoliday_ === 'function') return sch_isHoliday_(d, cal);
  var w = new Date(d + 'T12:00:00+08:00').getDay(); return w === 0 || w === 6;
}
function bu_avg_(code) {
  var start = bu_dstr_(ops_param_('麵糊平均起始日', '2026-12-01')), today = ops_today_(), daily = bu_daily_(code);
  var s = { wd: { o: 0, x: 0, n: 0 }, he: { o: 0, x: 0, n: 0 } };
  Object.keys(daily).forEach(function (d) {
    if (d < start || d >= today) return;
    var k = bu_isHol_(d) ? 'he' : 'wd'; s[k].o += daily[d].orig; s[k].x += daily[d].other; s[k].n++;
  });
  var f = function (a) { return a.n ? { o: bu_r2_(a.o / a.n), x: bu_r2_(a.x / a.n), n: a.n } : { o: null, x: null, n: 0 }; };
  return { from: start, wd: f(s.wd), he: f(s.he) };
}
function bu_isEventLoc_(l) { return /活動/.test(l.kind || ''); }
// 某天的預估用量 { o, x }；null＝沒設定
function bu_need_(l, plan, avg, evByDate, d) {
  if (bu_isEventLoc_(l)) { var e = evByDate[d]; return e ? { o: e.orig, x: e.other } : { o: 0, x: 0 }; }
  var h = bu_isHol_(d), po = plan ? (h ? plan.heO : plan.wdO) : null, px = plan ? (h ? plan.heX : plan.wdX) : null;
  var a = avg ? (h ? avg.he : avg.wd) : null;
  if (po === null && a && a.n >= 4) po = a.o;
  if (px === null && a && a.n >= 4) px = a.x;
  if (po === null && px === null) return null;
  return { o: po || 0, x: px || 0 };
}
function bu_forecast_(l) {
  var code = l.code, plan = bu_plans_()[code] || null, avg = bu_avg_(code), evs = bu_events_()[code] || [], evBy = {};
  evs.forEach(function (e) { evBy[e.date] = e; });
  var cl = (bu_closes_()[code] || []).filter(function (c) { return c.any; }), last = cl.length ? cl[cl.length - 1] : null;
  var today = ops_today_(), cover = parseInt(ops_param_('麵糊建議備量天數', 3)) || 3, warn = parseFloat(ops_param_('麵糊提醒天數', 2)) || 2;
  var res = { plan: plan, avg: avg, stock: null, orig: null, other: null, low: false, setup: true };
  if (last) res.stock = { date: last.date, by: last.by, rem: BU_FL.reduce(function (o, f, k) { o[f] = last.rem[k]; return o; }, {}),
    orig: last.rem[0], other: bu_r2_(last.rem[1] + last.rem[2] + last.rem[3] + last.rem[4]) };
  if (!bu_need_(l, plan, avg, evBy, today) && !bu_isEventLoc_(l)) { res.setup = false; return res; }
  if (!last) { if (!bu_isEventLoc_(l)) return res; last = { date: bu_addDays_(today, -1), rem: [0, 0, 0, 0, 0] }; res.stock = { date: '', by: '', rem: {}, orig: 0, other: 0 }; }
  ['orig', 'other'].forEach(function (k) {
    var s = k === 'orig' ? res.stock.orig : res.stock.other, kk = k === 'orig' ? 'o' : 'x', d = bu_addDays_(last.date, 1);
    while (d < today) { var nd = bu_need_(l, plan, avg, evBy, d); s -= nd ? nd[kk] : 0; d = bu_addDays_(d, 1); }   // 盤點日到今天之間的估計用量
    s = Math.max(0, bu_r2_(s));
    var days = 0, rest = s, any = false;
    for (var i = 0; i < 60; i++) {
      var nd2 = bu_need_(l, plan, avg, evBy, bu_addDays_(today, i)), q = nd2 ? nd2[kk] : 0; if (q > 0) any = true;
      if (rest - q < 0) break; rest -= q; days++;
    }
    var need = 0, span = bu_isEventLoc_(l) ? 7 : cover;
    for (var j = 0; j < span; j++) { var n3 = bu_need_(l, plan, avg, evBy, bu_addDays_(today, j)); need += n3 ? n3[kk] : 0; }
    res[k] = { now: s, days: any ? (days >= 60 ? 60 : days) : null, suggest: Math.max(0, Math.ceil(bu_r2_(need - s))), span: span };
    if (any && days < warn) res.low = true;
  });
  return res;
}

// ── API ──
function bu_locsFor_(me) {
  var mine = ops_myLocs_(me);
  return ops_locs_().filter(function (l) { return mine.indexOf(l.name) >= 0 && ['已停用', '已結束'].indexOf(l.status) < 0 && !/合作/.test(l.kind); })
    .sort(function (a, b) { return a.code < b.code ? -1 : 1; });
}
function bu_list_(p) {
  var me = ops_need_(p, 2), today = ops_today_();
  var data = bu_locsFor_(me).map(function (l) {
    var f = bu_forecast_(l);
    return { code: l.code, name: l.name, kind: l.kind, status: l.status, event: bu_isEventLoc_(l), plan: f.plan ? { wdO: f.plan.wdO, wdX: f.plan.wdX, heO: f.plan.heO, heX: f.plan.heX, by: f.plan.by, at: f.plan.at } : null,
      avg: f.avg, stock: f.stock, orig: f.orig, other: f.other, low: f.low, setup: f.setup,
      events: bu_isEventLoc_(l) ? (bu_events_()[l.code] || []).filter(function (e) { return e.date >= bu_addDays_(today, -7); }).map(function (e) { return { date: e.date, name: e.name, orig: e.orig, other: e.other, by: e.by }; }) : [] };
  });
  return { success: true, data: data, today: today, todayHoliday: bu_isHol_(today), params: { from: bu_dstr_(ops_param_('麵糊平均起始日', '2026-12-01')), cover: parseInt(ops_param_('麵糊建議備量天數', 3)) || 3, warn: parseFloat(ops_param_('麵糊提醒天數', 2)) || 2 } };
}
function bu_checkLoc_(me, code) {
  var l = bu_locsFor_(me).filter(function (x) { return x.code === String(code || '').trim(); })[0];
  if (!l) throw new Error('沒有這個櫃位的權限');
  return l;
}
function bu_save_(p) {
  var me = ops_need_(p, 2), l = bu_checkLoc_(me, p.code);
  var v = function (x) { return x === '' || x === null || x === undefined ? '' : Math.max(0, bu_n_(x)); };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = ops_sheet_('麵糊用量設定', BU_PLAN_HEAD); BU_C_.plans = null;
    var ex = bu_plans_()[l.code], row = ["'" + l.code, l.name, v(p.wdO), v(p.wdX), v(p.heO), v(p.heX), me.name, ops_now_()];
    if (ex) sh.getRange(ex.row, 1, 1, 8).setValues([row]); else sh.appendRow(row);
    BU_C_.plans = null;
    return { success: true };
  } finally { lock.releaseLock(); }
}
function bu_applyAvg_(p) {
  var me = ops_need_(p, 2), l = bu_checkLoc_(me, p.code), a = bu_avg_(l.code), pl = bu_plans_()[l.code] || {};
  var which = String(p.which || 'all');
  var q = { code: l.code, empId: p.empId, wdO: pl.wdO, wdX: pl.wdX, heO: pl.heO, heX: pl.heX };
  if ((which === 'all' || which === 'wd') && a.wd.n) { q.wdO = a.wd.o; q.wdX = a.wd.x; }
  if ((which === 'all' || which === 'he') && a.he.n) { q.heO = a.he.o; q.heX = a.he.x; }
  if (!a.wd.n && !a.he.n) return { error: '還沒有實際用量資料（' + a.from + ' 起算）' };
  return bu_save_(q);
}
function bu_evtSave_(p) {
  var me = ops_need_(p, 2), l = bu_checkLoc_(me, p.code), d = bu_dstr_(p.date);
  if (!bu_isEventLoc_(l)) return { error: '只有活動櫃位要按日期填' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return { error: '請選日期' };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = ops_sheet_('活動麵糊預估', BU_EVT_HEAD); BU_C_.evts = null;
    var ex = (bu_events_()[l.code] || []).filter(function (e) { return e.date === d; })[0];
    var row = [d, "'" + l.code, l.name, String(p.name || '').slice(0, 40), Math.max(0, bu_n_(p.orig)), Math.max(0, bu_n_(p.other)), me.name, ops_now_()];
    if (ex) sh.getRange(ex.row, 1, 1, 8).setValues([row]); else sh.appendRow(row);
    BU_C_.evts = null;
    return { success: true };
  } finally { lock.releaseLock(); }
}
function bu_evtDel_(p) {
  var me = ops_need_(p, 2), l = bu_checkLoc_(me, p.code), d = bu_dstr_(p.date);
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    BU_C_.evts = null;
    var ex = (bu_events_()[l.code] || []).filter(function (e) { return e.date === d; })[0];
    if (!ex) return { error: '找不到這一天的預估' };
    ops_sheet_('活動麵糊預估', BU_EVT_HEAD).deleteRow(ex.row); BU_C_.evts = null;
    return { success: true };
  } finally { lock.releaseLock(); }
}
function buHandler_(action, p) {
  if (!/^bu[A-Z]/.test(String(action || ''))) return null;
  p = p || {}; BU_C_ = {}; if (typeof OPS_C_ !== 'undefined') OPS_C_ = {};
  try {
    switch (action) {
      case 'buList':     return bu_list_(p);
      case 'buSave':     return bu_save_(p);
      case 'buApplyAvg': return bu_applyAvg_(p);
      case 'buEvtSave':  return bu_evtSave_(p);
      case 'buEvtDel':   return bu_evtDel_(p);
    }
  } catch (e) { return { error: e.message }; }
  return null;
}

// ── 覆蓋：各店剩餘麵糊（管理儀表板、宇宙辦公室）──多回黑糖與預估 ──
function bt_get_(p) {
  BU_C_ = {}; if (typeof OPS_C_ !== 'undefined') OPS_C_ = {};
  var locs = ops_locs_(), out = [];
  var cl = bu_closes_();
  Object.keys(cl).forEach(function (code) {
    var rows = cl[code].filter(function (c) { return c.any; }); if (!rows.length) return;
    var last = rows[rows.length - 1], l = locs.filter(function (x) { return x.code === code; })[0];
    var rec = { loc: l ? l.name : last.loc, code: code, date: last.date, by: last.by, rem: {}, restock: {} };
    BU_FL.forEach(function (f, k) { rec.rem[f] = last.rem[k]; rec.restock[f] = last.rs[k]; });
    if (l) { var fc = bu_forecast_(l); rec.fc = { orig: fc.orig, other: fc.other, low: fc.low, setup: fc.setup }; }
    out.push(rec);
  });
  out.sort(function (a, b) { return (a.code || a.loc) < (b.code || b.loc) ? -1 : 1; });
  return { success: true, data: out };
}

// ── 覆蓋：加盟損益的每日營業額與麵糊用量（改依正確欄位＋實際用量）──
function ops_revenueByDay_(loc, ym) {
  BU_C_ = {};
  var code = loc_code_(loc) || loc, out = {}, daily = bu_daily_(code);
  (bu_closes_()[code] || []).forEach(function (c) {
    if (c.date.slice(0, 7) !== ym) return;
    out[c.date] = { rev: c.rev, batter: daily[c.date] ? bu_r2_(daily[c.date].orig + daily[c.date].other) : 0 };
  });
  return out;
}
// ── 覆蓋：赤心幣讀營業額（AE 營業額合計，空白時 Q 當日營業額）──
function gm_closeRows_() {
  if (GM_CACHE_.close) return GM_CACHE_.close;
  var out = [];
  ['收店盤點', '收店盤點_歷史'].forEach(function (n) {
    var sh = gm_ss_().getSheetByName(n); if (!sh || sh.getLastRow() < 2) return;
    sh.getRange(2, 1, sh.getLastRow() - 1, Math.min(sh.getMaxColumns(), 40)).getValues().forEach(function (r) {
      var L = bu_isOld_(r) ? BU_C_OLD : BU_C;
      var rev = bu_blank_(r[L.total]) || String(r[L.total]).trim() === '' ? gm_num_(r[L.egg]) : gm_num_(r[L.total]);
      out.push({ date: gm_dstr_(r[1]), emp: String(r[3]).trim(), loc: String(r[5]).trim(), rev: rev });
    });
  });
  return (GM_CACHE_.close = out);
}
