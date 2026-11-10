// ═══════════════════════════════════════════════
// SOP 清單 ＋ 每日營運日報   v1(2026-11-10)
// 安裝:貼到 Apps Script 最底部;extHandler_ 內加一行:
//   var so = sopHandler_(action, p); if (so) return so;
// 「SOP」工作表第一次使用自動建立並填入初稿(請隊長修改內容;啟用欄填「否」可隱藏某一步)。
// ═══════════════════════════════════════════════
var SOP_HEAD = ['類型', '順序', '步驟', '說明', '圖片連結', '啟用'];
var SOP_SEED = [
  ['開店', 1, '儀容整理', '戴好帽子、口罩、制服與圍裙,頭髮全部收進帽子,拍儀容照打卡', '', '是'],
  ['開店', 2, '洗手消毒', '洗手 20 秒以上並以酒精消毒,之後再碰食材', '', '是'],
  ['開店', 3, '烤爐預熱', '開啟烤爐電源,確認上下模溫度達到設定值', '', '是'],
  ['開店', 4, '麵糊檢查', '確認四種口味麵糊數量與保存期限,在 App 填寫開店盤點', '', '是'],
  ['開店', 5, '備品與零錢', '確認紙袋、竹籤、包材與零用金,不足就登記缺貨看板', '', '是'],
  ['開店', 6, '環境與陳列', '擦拭櫃台與價目牌,擺好試吃與陳列', '', '是'],
  ['收店', 1, '清點麵糊', '清點四種口味剩餘包數並記錄進貨', '', '是'],
  ['收店', 2, '烤爐清潔', '關閉電源,待降溫後清潔烤盤與爐體,拍清潔照', '', '是'],
  ['收店', 3, '環境清潔', '清理櫃台、地面與垃圾,拍環境照', '', '是'],
  ['收店', 4, '營業額結算', '依品項填寫營業額,核對零用金', '', '是'],
  ['收店', 5, '交接事項', '把需要下一班知道的事寫在交接備註', '', '是'],
  ['收店', 6, '關閉電源門窗', '確認所有電源關閉、食材冷藏,才打下班卡', '', '是']
];
function sop_sheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID), sh = ss.getSheetByName('SOP');
  if (!sh) { sh = ss.insertSheet('SOP'); sh.getRange(1, 1, 1, SOP_HEAD.length).setValues([SOP_HEAD]); sh.getRange(2, 1, SOP_SEED.length, SOP_HEAD.length).setValues(SOP_SEED); sh.setFrozenRows(1); }
  return sh;
}
function sop_get_() {
  var c = CacheService.getScriptCache(), hit = c.get('sop_all'); if (hit) return { success: true, data: JSON.parse(hit) };
  var v = sop_sheet_().getDataRange().getValues(), out = { '開店': [], '收店': [] };
  for (var r = 1; r < v.length; r++) {
    var t = String(v[r][0]).trim(); if (!out[t] || /^(否|N|FALSE)$/i.test(String(v[r][5]).trim())) continue;
    out[t].push({ n: Number(v[r][1]) || r, title: String(v[r][2]), desc: String(v[r][3] || ''), img: String(v[r][4] || '') });
  }
  Object.keys(out).forEach(function (k) { out[k].sort(function (a, b) { return a.n - b.n; }); });
  c.put('sop_all', JSON.stringify(out), 300);
  return { success: true, data: out };
}

// ───────── 每日營運日報(分隊長以上)─────────
function rp_num_(v) { var n = Number(String(v == null ? '' : v).replace(/[^\d.\-]/g, '')); return String(v).trim() === '' || !isFinite(n) ? 0 : n; }
function rp_d_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Taipei', 'yyyy-MM-dd');
  var s = String(v || '').trim().replace(/\//g, '-'), m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : '';
}
function rp_report_(p) {
  var ss = SpreadsheetApp.openById(SHEET_ID), emp = String(p.empId || '').trim(), role = 0, names = {};
  var pv = ss.getSheetByName('夥伴資料').getDataRange().getValues();
  for (var i = 1; i < pv.length; i++) { var id = String(pv[i][0]).trim(); names[id] = String(pv[i][2] || pv[i][1] || id); if (id === emp) role = Number(pv[i][12]) || 0; }
  if (role < 2) return { error: '日報只開放分隊長以上查看' };
  var date = /^\d{4}-\d{2}-\d{2}$/.test(p.date || '') ? p.date : Utilities.formatDate(new Date(Date.now() - 86400000), 'Asia/Taipei', 'yyyy-MM-dd');
  var stores = {}, S = function (l) { return stores[l] || (stores[l] = { loc: l, rev: 0, closes: 0, use: { '原味': 0, '可可': 0, '紅玉': 0, '抹茶': 0 }, useTotal: 0, rem: null, orders: 0, ordersDone: 0, staff: {}, minutes: 0 }); };
  // 收店盤點:B 日期、E 姓名、F 櫃位、G~J 剩餘、L~O 消耗、P 總消耗、Q 當日營業額、AC 營業額合計
  ['收店盤點', '收店盤點_歷史'].forEach(function (n) {
    var sh = ss.getSheetByName(n); if (!sh || sh.getLastRow() < 2) return;
    sh.getRange(2, 1, sh.getLastRow() - 1, Math.min(29, sh.getLastColumn())).getValues().forEach(function (r) {
      if (rp_d_(r[1]) !== date || !String(r[5]).trim()) return;
      var s = S(String(r[5]).trim());
      s.rev += String(r[28] == null ? '' : r[28]).trim() !== '' ? rp_num_(r[28]) : rp_num_(r[16]); s.closes++;
      ['原味', '可可', '紅玉', '抹茶'].forEach(function (f, k) { s.use[f] += rp_num_(r[11 + k]); });
      s.useTotal += rp_num_(r[15]);
      s.rem = { '原味': rp_num_(r[6]), '可可': rp_num_(r[7]), '紅玉': rp_num_(r[8]), '抹茶': rp_num_(r[9]) };
    });
  });
  // 訂單:B 櫃位、C 日期、Q 狀態
  var od = ss.getSheetByName('訂單');
  if (od && od.getLastRow() > 1) od.getRange(2, 1, od.getLastRow() - 1, 17).getValues().forEach(function (r) {
    if (rp_d_(r[2]) !== date || String(r[16]) === '已取消') return;
    var s = S(String(r[1]).trim()); s.orders++; if (String(r[16]) === '已交付') s.ordersDone++;
  });
  // 打卡:B 日期、C 員工編號、F 類型、G 時間、J 地點、O 異常標記
  var abn = [], open = {};
  ['打卡紀錄', '打卡紀錄_歷史'].forEach(function (n) {
    var sh = ss.getSheetByName(n); if (!sh || sh.getLastRow() < 2) return;
    sh.getRange(2, 1, sh.getLastRow() - 1, 15).getValues().forEach(function (r) {
      if (rp_d_(r[1]) !== date) return;
      var e = String(r[2]).trim(), t = r[6] instanceof Date ? r[6] : new Date(String(r[6])), loc = String(r[9] || '').trim(), type = String(r[5]).trim();
      if (String(r[14] || '').trim()) abn.push({ name: names[e] || e, loc: loc, type: type, note: String(r[14]) });
      (open[e] = open[e] || []).push({ type: type, t: t.getTime(), loc: loc });
    });
  });
  Object.keys(open).forEach(function (e) {
    var list = open[e].sort(function (a, b) { return a.t - b.t; }), cur = null;
    list.forEach(function (x) {
      if (x.type === '上班') { if (cur) abn.push({ name: names[e] || e, loc: cur.loc, type: '上班', note: '重複上班打卡,前一段沒有下班' }); cur = x; }
      else if (x.type === '下班' && cur) { var s = S(cur.loc), m = Math.round((x.t - cur.t) / 60000); if (m > 0) { s.minutes += m; s.staff[names[e] || e] = (s.staff[names[e] || e] || 0) + m; } cur = null; }
    });
    if (cur) abn.push({ name: names[e] || e, loc: cur.loc, type: '上班', note: '有上班沒有下班' });
  });
  var list = Object.keys(stores).map(function (k) { var s = stores[k]; s.staff = Object.keys(s.staff).map(function (n) { return { name: n, hours: Math.round(s.staff[n] / 6) / 10 }; }); s.hours = Math.round(s.minutes / 6) / 10; return s; })
    .sort(function (a, b) { return b.rev - a.rev; });
  var tot = { rev: 0, orders: 0, useTotal: 0, hours: 0 }; list.forEach(function (s) { tot.rev += s.rev; tot.orders += s.orders; tot.useTotal += s.useTotal; tot.hours += s.hours; });
  tot.hours = Math.round(tot.hours * 10) / 10;
  return { success: true, data: { date: date, total: tot, stores: list, abnormal: abn, perHour: tot.hours ? Math.round(tot.rev / tot.hours) : 0 } };
}

function sopHandler_(action, p) {
  try {
    if (action === 'getSop') return sop_get_();
    if (action === 'getDailyReport') return rp_report_(p || {});
  } catch (e) { return { error: 'SOP/日報功能錯誤:' + e.message }; }
  return null;
}
