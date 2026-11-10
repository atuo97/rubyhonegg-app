// ═══════════════════════════════════════════════
// 各店剩餘麵糊(管理儀表板用)後端模組 v1(2026-11-10)
// 資料來源:夥伴下班「收店盤點」(closeStore)寫入的那張工作表,取每個櫃位「最新一筆」的四種口味剩餘包數。
// 部署後可開 …workers.dev/?action=getBatterStock&debug=1 檢查兩張表各用了哪些欄位。
// ═══════════════════════════════════════════════
// 實際試算表(11/10 確認):「收店盤點」(目前空白、沒有標題列)與「收店盤點_歷史」(有標題列)。
// 欄位:A 紀錄編號、B 日期、C 班表編號、D 員工編號、E 姓名、F 櫃位、G~J 原味/可可/紅玉/抹茶剩餘(包)、…、W~Z 原味/可可/紅玉/抹茶進貨(包)
// 兩張表都讀,每個櫃位取最新一筆。有標題列就依標題找欄位;沒有標題列就用下面 BT_FIXED 的固定欄位(從 0 起算)。
var BT_SHEETS = ['收店盤點', '收店盤點_歷史'];
var BT_FIXED = { date: 1, name: 4, loc: 5, original: 6, cocoa: 7, ruby: 8, matcha: 9,
                 rsOriginal: 22, rsCocoa: 23, rsRuby: 24, rsMatcha: 25 };
var BT_CFG = { cols: {} };   // 若標題文字改了,可在這裡指定,例:{ cols: { loc: '櫃位' } }
var BT_FLAVORS = [['original', '原味'], ['cocoa', '可可'], ['ruby', '紅玉'], ['matcha', '抹茶']];
var BT_EN = { original: 'original', cocoa: 'cocoa', ruby: 'ruby', matcha: 'matcha' };

function bt_findCol_(head, want, rx) {
  if (want) return head.indexOf(want);
  for (var c = 0; c < head.length; c++) if (rx.test(head[c])) return c;
  return -1;
}
function bt_map_(head) {
  var k = BT_CFG.cols, m = {};
  m.date = bt_findCol_(head, k.date, /^(日期|date)$|日期/i);
  m.loc = bt_findCol_(head, k.loc, /櫃位|地點|location|店/i);
  m.name = bt_findCol_(head, k.name, /姓名|夥伴|name|回報/i);
  BT_FLAVORS.forEach(function (f) {
    var key = f[0], zh = '(?:' + f[1] + '|' + BT_EN[f[0]] + ')', rk = 'rs' + key.charAt(0).toUpperCase() + key.slice(1);
    // 剩餘:含口味且含「剩」(或 rem);排除「進貨/補貨」
    m[key] = bt_findCol_(head, k[key], new RegExp('^(?!.*(進貨|補貨|rs)).*(' + zh + '.*(剩|rem)|(剩|rem).*' + zh + ')', 'i'));
    m[rk] = bt_findCol_(head, k[rk], new RegExp('(' + zh + '.*(進貨|補貨)|(進貨|補貨).*' + zh + ')'));
  });
  return m;
}
function bt_sources_() {          // → [{ sh, m, start }]
  var ss = SpreadsheetApp.openById(SHEET_ID), out = [];
  BT_SHEETS.forEach(function (n) {
    var sh = ss.getSheetByName(n); if (!sh || sh.getLastRow() < 1) return;
    var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0].map(function (x) { return String(x).trim(); });
    var m = bt_map_(head);
    var hasHead = m.date >= 0 && m.loc >= 0 && m.original >= 0 && m.cocoa >= 0 && m.ruby >= 0 && m.matcha >= 0;
    out.push({ sh: sh, head: hasHead ? head : null, m: hasHead ? m : BT_FIXED, start: hasHead ? 1 : 0 });
  });
  return out;
}
function bt_dateStr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Taipei', 'yyyy-MM-dd');
  var s = String(v || '').trim().replace(/\//g, '-'), mm = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  return mm ? mm[1] + '-' + ('0' + mm[2]).slice(-2) + '-' + ('0' + mm[3]).slice(-2) : s;
}
function bt_num_(v) { var n = Number(String(v == null ? '' : v).replace(/[^\d.\-]/g, '')); return String(v).trim() === '' || !isFinite(n) ? null : n; }

function bt_get_(p) {
  var src = bt_sources_();
  if (p && String(p.debug) === '1') {
    return { success: true, sources: src.map(function (s) {
      return { sheet: s.sh.getName(), rows: s.sh.getLastRow(), mode: s.head ? '依標題' : '固定欄位(無標題列)',
               columns: Object.keys(s.m).reduce(function (o, k) { o[k] = s.m[k] < 0 ? '(找不到)' : s.head ? s.head[s.m[k]] : '第 ' + (s.m[k] + 1) + ' 欄'; return o; }, {}) };
    }) };
  }
  var latest = {};
  src.forEach(function (s) {
    var v = s.sh.getDataRange().getValues(), m = s.m;
    for (var r = s.start; r < v.length; r++) {
      var loc = String(v[r][m.loc] || '').trim(); if (!loc) continue;
      var d = bt_dateStr_(v[r][m.date]); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
      var rec = { loc: loc, date: d, by: m.name >= 0 ? String(v[r][m.name] || '') : '', rem: {}, restock: {} }, any = false;
      BT_FLAVORS.forEach(function (fl) {
        var k = fl[0], rk = 'rs' + k.charAt(0).toUpperCase() + k.slice(1);
        rec.rem[fl[1]] = bt_num_(v[r][m[k]]); if (rec.rem[fl[1]] !== null) any = true;
        rec.restock[fl[1]] = m[rk] >= 0 ? bt_num_(v[r][m[rk]]) : null;
      });
      if (!any) continue;                                            // 只交接零用金、沒盤點的列略過
      if (!latest[loc] || d >= latest[loc].date) latest[loc] = rec;  // 同日多筆取後面那筆
    }
  });
  var out = Object.keys(latest).map(function (k) { return latest[k]; });
  out.sort(function (a, b) { return a.loc < b.loc ? -1 : 1; });
  return { success: true, data: out };
}

function btHandler_(action, p) {
  try { if (action === 'getBatterStock') return bt_get_(p || {}); }
  catch (e) { return { error: '剩餘麵糊讀取錯誤:' + e.message }; }
  return null;
}
// 路由:在 extHandler_ 內加一行:  var bt = btHandler_(action, p); if (bt) return bt;
