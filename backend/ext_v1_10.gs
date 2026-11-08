// ═══════════════════════════════════════════════
// v1.10 擴充（2026-11-09）：投票系統 + 宇宙辦公室缺貨看板
// 路由：doGet / doPost 開頭先呼叫 extHandler_()，不是這裡的動作就回傳 null 走原流程
// ═══════════════════════════════════════════════

function extHandler_(action, p) {
  p = p || {};
  var pr = pollHandler_(action, p);
  if (pr) return pr;
  try {
    if (action === 'getShortages')    return uo_getShortages();
    if (action === 'addShortage')     return uo_addShortage(p);
    if (action === 'resolveShortage') return uo_resolveShortage(p);
  } catch (e) { return { error: '缺貨看板錯誤:' + e.message }; }
  return null;
}

// ── 投票系統 v1（2026-11-01，管理員判斷改用夥伴資料第13欄權限）──
var POLL_ADMIN_IDS = [];   // 後備名單：若需要額外指定管理員，填員工編號，例如 ['E001']
var POLL_HEAD = ['投票ID','標題','說明','選項','複選','截止日','狀態','建立者ID','建立者','建立時間'];
var VOTE_HEAD = ['投票ID','員工ID','姓名','選擇','時間'];

function poll_sheet_(name, head) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(head); sh.setFrozenRows(1); }
  return sh;
}
function poll_today_() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd'); }
function poll_now_()   { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss'); }

function poll_isAdmin_(empId) {
  empId = String(empId || '');
  if (!empId) return false;
  if (POLL_ADMIN_IDS.indexOf(empId) >= 0) return true;
  var v = SpreadsheetApp.openById(SHEET_ID).getSheetByName('夥伴資料').getDataRange().getValues();
  for (var r = 1; r < v.length; r++) {
    if (String(v[r][0]) === empId) return (parseInt(v[r][12]) || 1) >= 3;
  }
  return false;
}

function poll_status_(status, deadline) {
  if (status === '已關閉') return '已關閉';
  if (deadline && poll_today_() > deadline) return '已關閉';
  return '進行中';
}

function poll_list_(p) {
  var empId = String(p.empId || ''), admin = poll_isAdmin_(empId);
  var ps = poll_sheet_('投票', POLL_HEAD).getDataRange().getValues();
  var vs = poll_sheet_('投票紀錄', VOTE_HEAD).getDataRange().getValues();
  var byPoll = {};
  for (var i = 1; i < vs.length; i++) {
    var k = String(vs[i][0]);
    (byPoll[k] = byPoll[k] || []).push({ empId: String(vs[i][1]), name: vs[i][2], choice: JSON.parse(vs[i][3] || '[]'), time: String(vs[i][4]) });
  }
  var out = [];
  for (var r = ps.length - 1; r >= 1; r--) {
    var row = ps[r], id = String(row[0]); if (!id) continue;
    var opts = JSON.parse(row[3] || '[]'), votes = byPoll[id] || [];
    var dl = row[5] instanceof Date ? Utilities.formatDate(row[5], 'Asia/Taipei', 'yyyy-MM-dd') : String(row[5] || '');
    var status = poll_status_(String(row[6]), dl);
    var mine = null, counts = opts.map(function () { return 0; });
    votes.forEach(function (v) {
      if (v.empId === empId) mine = v.choice;
      v.choice.forEach(function (c) { if (counts[c] !== undefined) counts[c]++; });
    });
    var showResult = admin || mine !== null || status === '已關閉';
    var o = { id: id, title: row[1], desc: row[2], options: opts, multi: row[4] === true || row[4] === 'TRUE' || row[4] === '是',
              deadline: dl, status: status, creator: row[8], createdAt: String(row[9]),
              myChoice: mine, voterCount: votes.length, counts: showResult ? counts : null };
    if (admin) o.voters = votes;   // 記名：只有管理員拿得到「誰投什麼」
    out.push(o);
  }
  return { success: true, data: out, isAdmin: admin };
}

function poll_create_(p) {
  if (!poll_isAdmin_(p.empId)) return { error: '只有管理員(Lv.3)可以發起投票' };
  var title = String(p.title || '').trim(), opts = (p.options || []).map(function (s) { return String(s).trim(); }).filter(String);
  if (!title) return { error: '請輸入投票標題' };
  if (opts.length < 2) return { error: '至少需要 2 個選項' };
  if (opts.length > 12) return { error: '選項最多 12 個' };
  var id = 'P' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss');
  poll_sheet_('投票', POLL_HEAD).appendRow([id, title, String(p.desc || ''), JSON.stringify(opts), p.multi ? '是' : '否',
    String(p.deadline || ''), '進行中', String(p.empId), String(p.name || ''), poll_now_()]);
  return { success: true, id: id };
}

function poll_vote_(p) {
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var empId = String(p.empId || ''); if (!empId) return { error: '未登入' };
    var psh = poll_sheet_('投票', POLL_HEAD), pv = psh.getDataRange().getValues(), poll = null;
    for (var i = 1; i < pv.length; i++) if (String(pv[i][0]) === String(p.pollId)) { poll = pv[i]; break; }
    if (!poll) return { error: '找不到這個投票' };
    var dl = poll[5] instanceof Date ? Utilities.formatDate(poll[5], 'Asia/Taipei', 'yyyy-MM-dd') : String(poll[5] || '');
    if (poll_status_(String(poll[6]), dl) !== '進行中') return { error: '這個投票已結束' };
    var opts = JSON.parse(poll[3] || '[]'), multi = poll[4] === '是' || poll[4] === true;
    var ch = (p.choice || []).map(Number).filter(function (n, k, a) { return n >= 0 && n < opts.length && a.indexOf(n) === k; });
    if (ch.length === 0) return { error: '請至少選一個選項' };
    if (!multi && ch.length > 1) return { error: '此投票為單選' };
    var vsh = poll_sheet_('投票紀錄', VOTE_HEAD), vv = vsh.getDataRange().getValues();
    for (var r = 1; r < vv.length; r++) {
      if (String(vv[r][0]) === String(p.pollId) && String(vv[r][1]) === empId) {   // 已投過 → 改票
        vsh.getRange(r + 1, 3, 1, 3).setValues([[String(p.name || ''), JSON.stringify(ch), poll_now_()]]);
        return { success: true, changed: true };
      }
    }
    vsh.appendRow([String(p.pollId), empId, String(p.name || ''), JSON.stringify(ch), poll_now_()]);
    return { success: true };
  } finally { lock.releaseLock(); }
}

function poll_close_(p) {
  if (!poll_isAdmin_(p.empId)) return { error: '只有管理員(Lv.3)可以結束投票' };
  var sh = poll_sheet_('投票', POLL_HEAD), v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]) === String(p.pollId)) { sh.getRange(i + 1, 7).setValue('已關閉'); return { success: true }; }
  return { error: '找不到這個投票' };
}

function pollHandler_(action, p) {
  p = p || {};
  try {
    if (action === 'getPolls')   return poll_list_(p);
    if (action === 'createPoll') return poll_create_(p);
    if (action === 'votePoll')   return poll_vote_(p);
    if (action === 'closePoll')  return poll_close_(p);
  } catch (e) { return { error: '投票功能錯誤:' + e.message }; }
  return null;
}

// ── 宇宙辦公室 · 缺貨看板（2026-11-09，改用 SHEET_ID 開啟試算表）──
var UO_SHEET = '缺貨看板';
var UO_HEADERS = ['編號', '登記時間', '櫃位', '品項', '登記人編號', '登記人', '狀態', '補齊時間', '補齊人'];

function uo_sheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(UO_SHEET);
  if (!sh) {
    sh = ss.insertSheet(UO_SHEET);
    sh.getRange(1, 1, 1, UO_HEADERS.length).setValues([UO_HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function uo_getShortages() {
  var sh = uo_sheet_();
  var last = sh.getLastRow();
  if (last < 2) return { success: true, data: [] };
  var rows = sh.getRange(2, 1, last - 1, UO_HEADERS.length).getValues();
  var data = rows
    .filter(function (r) { return r[0] && r[6] !== '已補齊'; })
    .map(function (r) {
      return { id: String(r[0]), time: r[1] instanceof Date ? r[1].toISOString() : String(r[1]),
               location: String(r[2]), item: String(r[3]), by: String(r[5]) };
    });
  return { success: true, data: data };
}

function uo_addShortage(d) {
  if (!d.location || !d.item) return { success: false, error: '缺少櫃位或品項' };
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var sh = uo_sheet_();
    var open = uo_getShortages().data.filter(function (x) { return x.location === d.location && x.item === d.item; })[0];
    if (open) return { success: true, id: open.id, duplicate: true };
    var id = 'S' + new Date().getTime();
    sh.appendRow([id, new Date(), d.location, d.item, d.empId || '', d.name || '', '未補齊', '', '']);
    return { success: true, id: id };
  } finally { lock.releaseLock(); }
}

function uo_resolveShortage(d) {
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var sh = uo_sheet_();
    var last = sh.getLastRow();
    if (last < 2) return { success: false, error: '找不到這筆缺貨' };
    var ids = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(d.id)) {
        sh.getRange(i + 2, 7, 1, 3).setValues([['已補齊', new Date(), d.name || d.empId || '']]);
        return { success: true };
      }
    }
    return { success: false, error: '找不到這筆缺貨' };
  } finally { lock.releaseLock(); }
}
