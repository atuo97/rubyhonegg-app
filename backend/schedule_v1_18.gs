// ═══════════════════════════════════════════════
// v1.18 排班系統 2.0（2026-11-11）
// 正式班表仍是〈班表〉（打卡檢查、達標、全勤之星、薪資估算照舊讀它），本模組只負責：
//   1. 分隊長排班看板：週／月檢視、批次發布（草稿存在手機，發布才寫入〈班表〉）
//   2. 班型設定：各櫃位平日／假日班型一鍵套用
//   3. 夥伴每月填空檔（可上班／想休）
//   4. 換班：轉讓給指定夥伴／釋出給大家認領／分隊長開放空班 → 分隊長核准才生效
//   5. 排班當下估工資（規格書第 1 節：196 元、跨櫃合併加班、國定／颱風 ×2）與 180hr＋4 假日達標進度
//   6. 排班 vs 打卡對帳（給月底薪資核對用；薪資一律仍依實際打卡計算）
//   7. 整理班表（Lv.3）：在 Google Sheets 直接改完後，一鍵重算星期／時數／單雙人／假日並列出重複
//
// 安裝：
//   1. 新增指令碼檔案 schedule_v1_18，貼上本檔
//   2. extHandler_ 內、pollHandler_ 那行的下一行加入：
//        var sc = schHandler_(action, p); if (sc) return sc;
//   3. 第一次執行 sch_setup()（建立〈班型設定〉〈可上班登記〉〈換班申請〉三張表與參數）
//   4. 部署 → 管理部署作業 → 編輯「進行中」→ 新版本
//
// 新增的表（全部自動建立，不動既有表）：
//   〈班型設定〉 櫃位｜班型｜上班｜下班｜適用（平日/假日/全部）｜人數
//   〈可上班登記〉年月｜員工編號｜姓名｜空檔JSON｜希望時數｜備註｜更新時間
//   〈換班申請〉 申請ID｜類型｜狀態｜班表編號｜日期｜櫃位｜上班｜下班｜申請人ID｜申請人｜對象ID｜對象｜備註｜建立時間｜處理人｜處理時間
// ═══════════════════════════════════════════════

var SCH_TPL_HEAD   = ['櫃位', '班型', '上班', '下班', '適用', '人數'];
var SCH_AVAIL_HEAD = ['年月', '員工編號', '姓名', '空檔JSON', '希望時數', '備註', '更新時間'];
var SCH_REQ_HEAD   = ['申請ID', '類型', '狀態', '班表編號', '日期', '櫃位', '上班', '下班',
                      '申請人ID', '申請人', '對象ID', '對象', '備註', '建立時間', '處理人', '處理時間'];
var SCH_DEFAULT = { wage: 196, monthHours: 180, studentHours: 72, holidayDays: 4, availDeadline: 20 };
var SCH_C_ = {};   // 單次請求快取

// ───────── 共用 ─────────
function sch_ss_() { return SCH_C_.ss || (SCH_C_.ss = SpreadsheetApp.openById(SHEET_ID)); }
function sch_sheet_(name, head) {
  var sh = sch_ss_().getSheetByName(name);
  if (!sh) { sh = sch_ss_().insertSheet(name); sh.appendRow(head); sh.setFrozenRows(1); sh.getRange(1, 1, 1, head.length).setFontWeight('bold'); }
  return sh;
}
function sch_today_() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd'); }
function sch_now_()   { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss'); }
function sch_d_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Taipei', 'yyyy-MM-dd');
  var s = String(v || '').trim().replace(/\//g, '-'), m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : '';
}
function sch_t_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Taipei', 'HH:mm');
  var m = /(\d{1,2}):(\d{2})/.exec(String(v || ''));
  return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : '';
}
function sch_min_(t) { var m = /^(\d{2}):(\d{2})$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; }
function sch_hours_(a, b) {                      // 不扣午休；跨午夜視為隔天
  var x = sch_min_(a), y = sch_min_(b); if (x == null || y == null) return 0;
  if (y <= x) y += 1440;
  return Math.round((y - x) / 6) / 10;
}
function sch_arr_(v) { if (Array.isArray(v)) return v; try { return JSON.parse(v || '[]'); } catch (e) { return []; } }
function sch_obj_(v) { if (v && typeof v === 'object') return v; try { return JSON.parse(v || '{}'); } catch (e) { return {}; } }
function sch_week_(d) { return '日一二三四五六'.charAt(new Date(d + 'T12:00:00+08:00').getDay()); }
function sch_param_(name, def) {
  var sh = sch_ss_().getSheetByName('參數設定'); if (!sh) return def;
  var v = sh.getDataRange().getValues();
  for (var i = 0; i < v.length; i++) if (String(v[i][0]).trim() === name && v[i][1] !== '') return Number(v[i][1]) || def;
  return def;
}
function sch_params_() {
  return {
    wage: sch_param_('排班估算時薪', SCH_DEFAULT.wage),
    monthHours: sch_param_('每月達標時數', SCH_DEFAULT.monthHours),
    studentHours: sch_param_('學生每月達標時數', SCH_DEFAULT.studentHours),
    holidayDays: sch_param_('每月達標假日天數', SCH_DEFAULT.holidayDays),
    availDeadline: sch_param_('空檔填寫截止日', SCH_DEFAULT.availDeadline)
  };
}

// ───────── 夥伴、權限、櫃位 ─────────
// 夥伴資料:A 員工編號、B 姓名、K 離職日、M 權限等級、AU(第 47 欄)負責櫃位
function sch_staff_() {
  if (SCH_C_.staff) return SCH_C_.staff;
  var v = sch_ss_().getSheetByName('夥伴資料').getDataRange().getValues(), head = v[0] || [], out = {};
  var iMng = 46, iStu = -1;
  head.forEach(function (h, i) { h = String(h); if (/負責櫃位/.test(h)) iMng = i; if (/學生/.test(h)) iStu = i; });
  for (var r = 1; r < v.length; r++) {
    var id = String(v[r][0]).trim(); if (!id) continue;
    out[id] = {
      id: id, name: String(v[r][1]).trim(), left: String(v[r][10] || '').trim() !== '',
      role: parseInt(v[r][12]) || (/管理/.test(String(v[r][12])) ? 3 : 1),
      managed: String(v[r][iMng] || ''), student: iStu >= 0 && /是|Y|1|學生/i.test(String(v[r][iStu]))
    };
  }
  return (SCH_C_.staff = out);
}
function sch_locNames_() {
  if (SCH_C_.locs) return SCH_C_.locs;
  var sh = sch_ss_().getSheetByName('櫃位設定'), out = [];
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(function (r) {
    var n = String(r[0]).trim(); if (n) out.push(n);
  });
  return (SCH_C_.locs = out);
}
function sch_me_(empId) {
  var me = sch_staff_()[String(empId || '')];
  if (!me || me.left) throw new Error('找不到夥伴資料');
  return me;
}
function sch_managedOf_(me) {                     // Lv.3 以上全部櫃位；Lv.2 依「負責櫃位」欄
  var all = sch_locNames_();
  if (me.role >= 3) return all.slice();
  var toks = me.managed.split(/[、,，\/\s;；]+/).map(function (x) { return x.trim(); }).filter(String);
  return all.filter(function (n) {
    return toks.some(function (t) { return n === t || n.indexOf(t) >= 0 || (t.length >= 2 && t.indexOf(n) >= 0); });
  });
}
function sch_mgr_(empId) {
  var me = sch_me_(empId);
  if (me.role < 2) throw new Error('只有分隊長以上可以排班');
  return { me: me, managed: sch_managedOf_(me) };
}

// ───────── 行事曆 ─────────
// 〈行事曆設定〉A 日期｜B 日別類型(國定假日/颱風日/連假日/假日(六日)/補班)｜C 適用範圍(全部或縣市)
// 畫面標示用:任何範圍有颱風日就標「颱風」(實際寫入班表時改用既有 applyCalendarToSchedule,依櫃位縣市判斷)
function sch_calendar_(ym) {                      // → { 'yyyy-MM-dd': '國定'|'颱風'|'連假'|'補班' }
  var out = {}, sh = sch_ss_().getSheetByName('行事曆設定');
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().forEach(function (r) {
    var d = sch_d_(r[0]), ty = String(r[1]); if (!d || (ym && d.slice(0, 7) !== ym)) return;
    var v = /補班/.test(ty) ? '補班' : /颱風/.test(ty) ? '颱風' : /國定/.test(ty) ? '國定' : /連假/.test(ty) ? '連假' : '';
    var rank = { '': 0, '連假': 1, '國定': 2, '颱風': 3, '補班': 4 };
    if (v && rank[v] > rank[out[d] || '']) out[d] = v;
  });
  return out;
}
function sch_isHoliday_(d, cal) {
  if (cal[d] === '補班') return false;
  if (cal[d] === '國定' || cal[d] === '颱風' || cal[d] === '連假') return true;
  var w = new Date(d + 'T12:00:00+08:00').getDay();
  return w === 0 || w === 6;
}
// 寫入班表的 K 是否假日 / L 假日類型:優先沿用既有後端的日別判定(含櫃位縣市的颱風假)
function sch_dayType_(d, loc, cal) {
  try { if (typeof applyCalendarToSchedule === 'function') return applyCalendarToSchedule(d, loc); } catch (e) {}
  return cal[d] === '颱風' ? '颱風日' : cal[d] === '國定' ? '國定假日' : cal[d] === '連假' ? '連假日' : sch_isHoliday_(d, cal) ? '假日' : '平日';
}
function sch_quotaHoliday_(t) {
  try { if (typeof isHolidayForQuota === 'function') return isHolidayForQuota(t); } catch (e) {}
  return ['假日', '連假日', '國定假日'].indexOf(t) >= 0;
}

// ───────── 〈班表〉讀寫 ─────────
// 欄位位置同既有 saveScheduleApi:A 班表編號 B 日期 C 星期 D 員工編號 E 姓名 F 櫃位 G 上班 H 下班
// I 預計時數 J 單雙人(single/double/triple) K 是否假日(是/否) L 假日類型 M 發布狀態
function sch_cols_(sh) {
  var c = { id: 0, date: 1, week: 2, emp: 3, name: 4, loc: 5, start: 6, end: 7, hours: 8, type: 9, hol: 10, htype: 11, status: 12 };
  c.width = Math.max(sh.getLastColumn(), 13);
  return c;
}
function sch_readShifts_(ym) {                    // ym 空白 = 全部
  var sh = sch_ss_().getSheetByName('班表'), c = sch_cols_(sh), out = [];
  if (sh.getLastRow() < 2) return { sh: sh, c: c, rows: out, raw: [] };
  var raw = sh.getRange(2, 1, sh.getLastRow() - 1, c.width).getValues();
  raw.forEach(function (r, i) {
    var d = sch_d_(r[c.date]); if (!d || (ym && d.slice(0, 7) !== ym)) return;
    var emp = String(r[c.emp]).trim(); if (!emp) return;
    var st = String(r[c.status] || '').trim();
    if (/刪除|取消/.test(st)) return;
    out.push({ id: String(r[c.id]).trim(), row: i + 2, date: d, empId: emp, name: String(r[c.name]).trim(),
               loc: String(r[c.loc]).trim(), start: sch_t_(r[c.start]), end: sch_t_(r[c.end]),
               hours: Number(r[c.hours]) || 0, holiday: /是|Y|true/i.test(String(r[c.hol])), status: st });
  });
  return { sh: sh, c: c, rows: out, raw: raw };
}
function sch_typeWord_(raw, c, n) {               // 沿用表內既有寫法(英文或中文)
  var en = raw.some(function (r) { return /single|double|triple/.test(String(r[c.type])); });
  return en ? (n >= 3 ? 'triple' : n === 2 ? 'double' : 'single') : (n >= 3 ? '三人' : n === 2 ? '雙人' : '單人');
}
// 只寫回有改到的列(連續列合併成一次寫入),不碰其他列
function sch_writeRows_(sh, raw, idx, width) {
  var list = Object.keys(idx).map(Number).sort(function (a, b) { return a - b; });
  for (var i = 0; i < list.length;) {
    var j = i; while (j + 1 < list.length && list[j + 1] === list[j] + 1) j++;
    sh.getRange(list[i] + 2, 1, j - i + 1, width).setValues(raw.slice(list[i], list[j] + 1));
    i = j + 1;
  }
}
function sch_newId_() { return 'S' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss') + Math.floor(Math.random() * 900 + 100); }

// ───────── 工資估算(規格書第 1 節)─────────
function sch_dayWage_(hours, wage, double) {
  var h = hours, pay = 0;
  pay += Math.min(h, 8) * wage;
  if (h > 8)  pay += (Math.min(h, 10) - 8) * wage * 1.33;
  if (h > 10) pay += (Math.min(h, 12) - 10) * wage * 1.67;
  if (h > 12) pay += (h - 12) * wage * 2;
  return double ? pay * 2 : pay;
}
function sch_stats_(rows, cal, prm) {             // → { empId: {hours, days, holidayDays, wage, byLoc:{loc:wage}} }
  var byEmpDay = {}, out = {};
  rows.forEach(function (r) {
    var k = r.empId + '|' + r.date;
    (byEmpDay[k] = byEmpDay[k] || []).push(r);
  });
  Object.keys(byEmpDay).forEach(function (k) {
    var list = byEmpDay[k], emp = list[0].empId, d = list[0].date, sum = 0;
    list.forEach(function (r) { sum += r.hours || sch_hours_(r.start, r.end); });
    var dbl = cal[d] === '國定' || cal[d] === '颱風';   // 估算用;颱風依縣市的精確判定以實際薪資引擎為準
    var w = sch_dayWage_(sum, prm.wage, dbl);
    var o = out[emp] = out[emp] || { hours: 0, days: 0, holidayDays: 0, wage: 0, byLoc: {} };
    o.hours += sum; o.days += 1; o.wage += w;
    if (sch_isHoliday_(d, cal)) o.holidayDays += 1;
    list.forEach(function (r) { var hh = r.hours || sch_hours_(r.start, r.end); o.byLoc[r.loc] = (o.byLoc[r.loc] || 0) + (sum ? w * hh / sum : 0); });
  });
  Object.keys(out).forEach(function (e) {
    out[e].hours = Math.round(out[e].hours * 10) / 10; out[e].wage = Math.ceil(out[e].wage);
    Object.keys(out[e].byLoc).forEach(function (l) { out[e].byLoc[l] = Math.ceil(out[e].byLoc[l]); });
  });
  return out;
}

// ───────── 衝突檢查(隊長 2026-11-11 定案:方案 B)─────────
// 一人一天預設只能一個櫃位;Lv.3 以上可以加排第二個櫃位,但時間不能重疊。
// 個人班表會列出每個重複的原因:overlap=同時段重疊(一律不允許)/ twoLoc=同日兩個櫃位(需 Lv.3)/ twice=同櫃位同日排兩段
function sch_dayCheck_(rows) {
  var by = {}, out = [];
  rows.forEach(function (r) { (by[r.empId + '|' + r.date] = by[r.empId + '|' + r.date] || []).push(r); });
  Object.keys(by).forEach(function (k) {
    var l = by[k]; if (l.length < 2) return;
    for (var i = 0; i < l.length; i++) for (var j = i + 1; j < l.length; j++) {
      var a = l[i], b = l[j], ov = sch_overlap_(a, b);
      var kind = ov ? 'overlap' : (a.loc !== b.loc ? 'twoLoc' : 'twice');
      out.push({ date: a.date, empId: a.empId, name: a.name, kind: kind, ids: [a.id || '', b.id || ''],
        text: a.date + ' ' + a.name + ':' + a.loc + ' ' + a.start + '–' + a.end + ' 與 ' + b.loc + ' ' + b.start + '–' + b.end +
              (ov ? '(時段重疊)' : kind === 'twoLoc' ? '(同日兩個櫃位)' : '(同櫃位兩段班)') });
    }
  });
  return out;
}
// 依權限判斷哪些問題要擋下:overlap 一律擋;twoLoc/twice 只有 Lv.3 以上可以
function sch_blocking_(issues, role) {
  return issues.filter(function (x) { return x.kind === 'overlap' || role < 3; }).map(function (x) { return x.text; });
}
function sch_overlap_(a, b) {
  var a1 = sch_min_(a.start), a2 = sch_min_(a.end), b1 = sch_min_(b.start), b2 = sch_min_(b.end);
  if (a1 == null || b1 == null) return false;
  if (a2 <= a1) a2 += 1440; if (b2 <= b1) b2 += 1440;
  return a1 < b2 && b1 < a2;
}
function sch_conflicts_(rows) {                   // (舊)只檢查時間重疊
  var by = {}, errs = [];
  rows.forEach(function (r) { (by[r.empId + '|' + r.date] = by[r.empId + '|' + r.date] || []).push(r); });
  Object.keys(by).forEach(function (k) {
    var l = by[k];
    for (var i = 0; i < l.length; i++) for (var j = i + 1; j < l.length; j++)
      if (sch_overlap_(l[i], l[j])) errs.push(l[i].date + ' ' + l[i].name + ':' + l[i].loc + ' ' + l[i].start + '–' + l[i].end + ' 與 ' + l[j].loc + ' ' + l[j].start + '–' + l[j].end + ' 時間重疊');
  });
  return errs;
}

// ───────── 班型 ─────────
function sch_templates_(locs) {
  var sh = sch_sheet_('班型設定', SCH_TPL_HEAD), out = {};
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues().forEach(function (r) {
    var loc = String(r[0]).trim(); if (!loc || (locs && locs.indexOf(loc) < 0)) return;
    (out[loc] = out[loc] || []).push({ name: String(r[1]).trim() || '全天', start: sch_t_(r[2]), end: sch_t_(r[3]),
      apply: String(r[4]).trim() || '全部', count: Math.max(1, parseInt(r[5]) || 1) });
  });
  return out;
}
function sch_saveTemplates_(p) {
  var m = sch_mgr_(p.managerId), loc = String(p.loc || '');
  if (m.managed.indexOf(loc) < 0) return { error: '您沒有這個櫃位的排班權限' };
  var list = sch_arr_(p.list).filter(function (t) { return sch_t_(t.start) && sch_t_(t.end); });
  var sh = sch_sheet_('班型設定', SCH_TPL_HEAD);
  var keep = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues().filter(function (r) { return String(r[0]).trim() !== loc && String(r[0]).trim(); }) : [];
  list.forEach(function (t) { keep.push([loc, String(t.name || '全天').slice(0, 12), "'" + sch_t_(t.start), "'" + sch_t_(t.end), /平日|假日/.test(t.apply) ? t.apply : '全部', Math.max(1, Math.min(5, parseInt(t.count) || 1))]); });
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 6).clearContent();
  if (keep.length) sh.getRange(2, 1, keep.length, 6).setValues(keep);
  return { success: true, templates: sch_templates_([loc])[loc] || [] };
}

// ───────── 空檔 ─────────
function sch_availAll_(ym) {
  var sh = sch_sheet_('可上班登記', SCH_AVAIL_HEAD), out = {};
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues().forEach(function (r, i) {
    if (String(r[0]).trim() !== ym) return;
    out[String(r[1]).trim()] = { days: sch_obj_(r[3]), hope: Number(r[4]) || 0, note: String(r[5] || ''), updated: String(r[6] || ''), row: i + 2 };
  });
  return out;
}
function sch_setAvail_(p) {
  var me = sch_me_(p.empId), ym = String(p.ym || '');
  if (!/^\d{4}-\d{2}$/.test(ym)) return { error: '月份格式錯誤' };
  var days = sch_obj_(p.days), clean = {};
  Object.keys(days).forEach(function (d) { if (d.slice(0, 7) === ym && (days[d] === 'ok' || days[d] === 'off')) clean[d] = days[d]; });
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = sch_sheet_('可上班登記', SCH_AVAIL_HEAD), cur = sch_availAll_(ym)[me.id];
    var row = [ym, me.id, me.name, JSON.stringify(clean), Number(p.hope) || '', String(p.note || '').slice(0, 100), sch_now_()];
    if (cur) sh.getRange(cur.row, 1, 1, 7).setValues([row]); else sh.appendRow(row);
  } finally { lock.releaseLock(); }
  return { success: true };
}

// ───────── 換班申請 ─────────
function sch_reqs_() {
  var sh = sch_sheet_('換班申請', SCH_REQ_HEAD), out = [];
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, SCH_REQ_HEAD.length).getValues().forEach(function (r, i) {
    if (!String(r[0]).trim()) return;
    out.push({ id: String(r[0]), kind: String(r[1]), status: String(r[2]), shiftId: String(r[3]), date: sch_d_(r[4]), loc: String(r[5]),
      start: sch_t_(r[6]), end: sch_t_(r[7]), fromId: String(r[8]), fromName: String(r[9]), toId: String(r[10]), toName: String(r[11]),
      note: String(r[12] || ''), created: String(r[13]), by: String(r[14] || ''), at: String(r[15] || ''), row: i + 2 });
  });
  return out;
}
function sch_writeReq_(q) {
  var sh = sch_sheet_('換班申請', SCH_REQ_HEAD);
  var row = [q.id, q.kind, q.status, q.shiftId, q.date, q.loc, "'" + q.start, "'" + q.end, q.fromId, q.fromName, q.toId, q.toName, q.note, q.created, q.by || '', q.at || ''];
  if (q.row) sh.getRange(q.row, 1, 1, row.length).setValues([row]); else sh.appendRow(row);
}
// 夥伴提出:give=轉讓給指定夥伴 / release=釋出給大家認領
function sch_request_(p) {
  var me = sch_me_(p.empId), kind = String(p.kind);
  if (kind !== 'give' && kind !== 'release') return { error: '申請類型錯誤' };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = sch_readShifts_(''), s = null;
    sh.rows.forEach(function (r) { if (r.id === String(p.shiftId)) s = r; });
    if (!s || s.empId !== me.id) return { error: '找不到您的這個班' };
    if (s.date < sch_today_()) return { error: '已經過去的班不能換' };
    if (sch_reqs_().some(function (q) { return q.shiftId === s.id && /待|開放/.test(q.status); })) return { error: '這個班已經有進行中的換班申請' };
    var to = kind === 'give' ? sch_staff_()[String(p.toId)] : null;
    if (kind === 'give') {
      if (!to || to.left || to.id === me.id) return { error: '請選擇要轉讓的夥伴' };
      var busy = sh.rows.filter(function (r) { return r.empId === to.id && r.date === s.date; })[0];
      if (busy) return { error: to.name + ' 當天已排在 ' + busy.loc + ' ' + busy.start + '–' + busy.end };
    }
    sch_writeReq_({ id: 'R' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10),
      kind: kind, status: kind === 'give' ? '待對方同意' : '開放認領', shiftId: s.id, date: s.date, loc: s.loc, start: s.start, end: s.end,
      fromId: me.id, fromName: me.name, toId: to ? to.id : '', toName: to ? to.name : '', note: String(p.note || '').slice(0, 60), created: sch_now_() });
  } finally { lock.releaseLock(); }
  return { success: true };
}
// 分隊長開放空班(沒有人的班,認領後核准才寫入班表)
function sch_openShift_(p) {
  var m = sch_mgr_(p.managerId), loc = String(p.loc || ''), d = sch_d_(p.date), st = sch_t_(p.start), en = sch_t_(p.end);
  if (m.managed.indexOf(loc) < 0) return { error: '您沒有這個櫃位的排班權限' };
  if (!d || !st || !en) return { error: '請填寫日期與時間' };
  var n = Math.max(1, Math.min(5, parseInt(p.count) || 1));
  for (var i = 0; i < n; i++) sch_writeReq_({ id: 'R' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss') + i + Math.floor(Math.random() * 90 + 10),
    kind: 'open', status: '開放認領', shiftId: '', date: d, loc: loc, start: st, end: en, fromId: m.me.id, fromName: m.me.name,
    toId: '', toName: '', note: String(p.note || '').slice(0, 60), created: sch_now_() });
  return { success: true };
}
// 夥伴回應:accept(被轉讓者同意)/ decline / claim(認領)/ cancel(申請人取消)
function sch_respond_(p) {
  var me = sch_me_(p.empId), act = String(p.act);
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var q = sch_reqs_().filter(function (x) { return x.id === String(p.reqId); })[0];
    if (!q) return { error: '找不到這筆申請' };
    if (act === 'cancel') {
      if (q.fromId !== me.id && !(q.kind === 'open' && me.role >= 2)) return { error: '只有申請人可以取消' };
      if (!/待|開放/.test(q.status)) return { error: '這筆申請已經處理完了' };
      q.status = '已取消'; q.by = me.name; q.at = sch_now_(); sch_writeReq_(q); return { success: true };
    }
    if (act === 'accept' || act === 'decline') {
      if (q.kind !== 'give' || q.toId !== me.id || q.status !== '待對方同意') return { error: '這筆申請不需要您回覆' };
      q.status = act === 'accept' ? '待核准' : '對方婉拒'; q.at = sch_now_(); sch_writeReq_(q); return { success: true };
    }
    if (act === 'claim') {
      if (q.status !== '開放認領') return { error: '這個空班已經有人認領了' };
      if (q.fromId === me.id && q.kind !== 'open') return { error: '這是您自己釋出的班' };
      var busy = sch_readShifts_(q.date.slice(0, 7)).rows.filter(function (r) { return r.empId === me.id && r.date === q.date; })[0];
      if (busy) return { error: '您當天已排在 ' + busy.loc + ' ' + busy.start + '–' + busy.end };
      q.toId = me.id; q.toName = me.name; q.status = '待核准'; q.at = sch_now_(); sch_writeReq_(q); return { success: true };
    }
  } finally { lock.releaseLock(); }
  return { error: '動作錯誤' };
}
// 分隊長核准/駁回 → 核准時改寫〈班表〉
function sch_approve_(p) {
  var m = sch_mgr_(p.managerId), ok = String(p.approve) === 'true' || p.approve === true;
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var q = sch_reqs_().filter(function (x) { return x.id === String(p.reqId); })[0];
    if (!q) return { error: '找不到這筆申請' };
    if (m.managed.indexOf(q.loc) < 0) return { error: '您沒有這個櫃位的權限' };
    if (q.status !== '待核准') return { error: '這筆申請目前不能核准' };
    if (!ok) { q.status = '已駁回'; q.by = m.me.name; q.at = sch_now_(); q.note = (q.note + ' ' + String(p.reason || '')).trim(); sch_writeReq_(q); return { success: true }; }
    var to = sch_staff_()[q.toId]; if (!to) return { error: '找不到接班夥伴' };
    var data = sch_readShifts_(''), c = data.c;
    var same = data.rows.filter(function (r) { return r.empId === to.id && r.date === q.date && r.id !== q.shiftId; });
    var errs = sch_blocking_(sch_dayCheck_(same.concat([{ empId: to.id, name: to.name, date: q.date, loc: q.loc, start: q.start, end: q.end }])), m.me.role);
    if (errs.length) return { error: errs[0] + (m.me.role < 3 ? '。同日第二個櫃位需要 Lv.3 以上核准' : '') };
    if (q.kind === 'open') {
      sch_applyOps_(data, [{ op: 'add', date: q.date, loc: q.loc, empId: to.id, start: q.start, end: q.end }], m.me);
    } else {
      var s = data.rows.filter(function (r) { return r.id === q.shiftId; })[0];
      if (!s) return { error: '原本的班已不存在' };
      data.sh.getRange(s.row, c.emp + 1).setValue(to.id);
      data.sh.getRange(s.row, c.name + 1).setValue(to.name);
    }
    q.status = '已核准'; q.by = m.me.name; q.at = sch_now_(); sch_writeReq_(q);
  } finally { lock.releaseLock(); }
  return { success: true };
}

// ───────── 發布(批次寫入〈班表〉)─────────
// ops: [{op:'add', date, loc, empId, start, end} | {op:'edit', id, empId, start, end} | {op:'del', id}]
function sch_applyOps_(data, ops, me) {
  var sh = data.sh, c = data.c, raw = data.raw, staff = sch_staff_(), touched = {}, adds = [], dels = [];
  var rowsById = {}; data.rows.forEach(function (r) { rowsById[r.id] = r; });
  ops.forEach(function (o) {
    if (o.op === 'add') {
      var e = staff[o.empId]; if (!e) throw new Error('找不到夥伴 ' + o.empId);
      var line = []; for (var i = 0; i < c.width; i++) line.push('');
      line[c.id] = sch_newId_() + adds.length; line[c.date] = o.date; line[c.week] = sch_week_(o.date);
      line[c.emp] = e.id; line[c.name] = e.name; line[c.loc] = o.loc; line[c.start] = "'" + o.start; line[c.end] = "'" + o.end;
      line[c.hours] = sch_hours_(o.start, o.end); line[c.status] = '已發布';
      adds.push(line); touched[o.date + '|' + o.loc] = 1;
    } else {
      var r = rowsById[o.id]; if (!r) throw new Error('找不到班表 ' + o.id + '(可能已被其他人修改,請重新整理)');
      touched[r.date + '|' + r.loc] = 1;
      if (o.op === 'del') { dels.push(r.row); return; }
      var e2 = staff[o.empId || r.empId], line2 = raw[r.row - 2];
      line2[c.emp] = e2.id; line2[c.name] = e2.name; line2[c.start] = "'" + (o.start || r.start); line2[c.end] = "'" + (o.end || r.end);
      line2[c.hours] = sch_hours_(o.start || r.start, o.end || r.end);
    }
  });
  // 重算受影響日期/櫃位的「單雙人」「是否假日」
  var cal = sch_calendar_(''), cnt = {};
  raw.forEach(function (line, i) {
    if (dels.indexOf(i + 2) >= 0 || /刪除|取消/.test(String(line[c.status]))) return;
    var k = sch_d_(line[c.date]) + '|' + String(line[c.loc]).trim(); if (touched[k]) cnt[k] = (cnt[k] || 0) + 1;
  });
  adds.forEach(function (line) { var k = line[c.date] + '|' + line[c.loc]; cnt[k] = (cnt[k] || 0) + 1; });
  var dirty = {};
  ops.forEach(function (o) { if (o.op === 'edit' && rowsById[o.id]) dirty[rowsById[o.id].row - 2] = 1; });
  var fix = function (line) {
    var d = sch_d_(line[c.date]), k = d + '|' + String(line[c.loc]).trim(); if (!touched[k]) return false;
    var dt = sch_dayType_(d, String(line[c.loc]).trim(), cal);
    line[c.type] = sch_typeWord_(raw, c, cnt[k] || 1); line[c.hol] = sch_quotaHoliday_(dt) ? '是' : '否'; line[c.htype] = dt; return true;
  };
  raw.forEach(function (line, i) {
    if (dels.indexOf(i + 2) >= 0) return;
    var before = JSON.stringify([line[c.type], line[c.hol], line[c.htype]]);
    if (fix(line) && JSON.stringify([line[c.type], line[c.hol], line[c.htype]]) !== before) dirty[i] = 1;
  });
  adds.forEach(fix);
  sch_writeRows_(sh, raw, dirty, c.width);
  if (adds.length) sh.getRange(sh.getLastRow() + 1, 1, adds.length, c.width).setValues(adds);
  dels.sort(function (a, b) { return b - a; }).forEach(function (rn) { sh.deleteRow(rn); });
  return { added: adds.length, deleted: dels.length };
}
function sch_publish_(p) {
  var m = sch_mgr_(p.managerId), ops = sch_arr_(p.ops);
  if (!ops.length) return { error: '沒有要發布的變更' };
  var today = sch_today_();
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    SCH_C_.cols = null;
    var data = sch_readShifts_(''), byId = {};
    data.rows.forEach(function (r) { byId[r.id] = r; });
    // 權限與日期檢查
    for (var i = 0; i < ops.length; i++) {
      var o = ops[i], loc = o.op === 'add' ? o.loc : (byId[o.id] || {}).loc, d = o.op === 'add' ? o.date : (byId[o.id] || {}).date;
      if (!loc) return { error: '有一筆班表已被其他人修改或刪除,請重新整理後再發布' };
      if (m.managed.indexOf(loc) < 0) return { error: '您沒有「' + loc + '」的排班權限' };
      if (d < today && m.me.role < 3) return { error: d + ' 已經過去,只有管理員可以修改' };
      if (o.op !== 'del' && (!sch_t_(o.start || 'x') && o.op === 'add')) return { error: d + ' 有一筆沒有填時間' };
    }
    // 模擬套用後檢查衝突
    var sim = data.rows.filter(function (r) { return !ops.some(function (o) { return o.op !== 'add' && o.id === r.id; }); });
    var mark = {};   // 這次有動到的「人|日」
    ops.forEach(function (o, n) {
      if (o.op === 'del') return;
      var base = o.op === 'edit' ? byId[o.id] : o, e = sch_staff_()[o.empId || base.empId];
      if (!e) throw new Error('找不到夥伴 ' + (o.empId || base.empId));
      sim.push({ id: o.id || ('new' + n), empId: e.id, name: e.name, date: base.date, loc: base.loc, start: o.start || base.start, end: o.end || base.end });
      mark[e.id + '|' + base.date] = 1;
    });
    var issues = sch_dayCheck_(sim.filter(function (r) { return mark[r.empId + '|' + r.date]; }));
    var errs = sch_blocking_(issues, m.me.role);
    if (errs.length) return { error: '有重複排班,未發布', conflicts: errs.slice(0, 10) };
    var res = sch_applyOps_(data, ops, m.me);
    return { success: true, added: res.added, deleted: res.deleted, edited: ops.filter(function (o) { return o.op === 'edit'; }).length };
  } catch (e) { return { error: e.message }; }
  finally { lock.releaseLock(); }
}

// ───────── 分隊長看板(一次載入) ─────────
function sch_board_(p) {
  var m = sch_mgr_(p.empId), ym = String(p.ym || sch_today_().slice(0, 7)), prm = sch_params_();
  var prev = Utilities.formatDate(new Date(ym + '-01T12:00:00+08:00').getTime() - 86400000 * 7 > 0 ? new Date(new Date(ym + '-01T12:00:00+08:00').getTime() - 86400000 * 7) : new Date(), 'Asia/Taipei', 'yyyy-MM');
  var cal = sch_calendar_(''), all = sch_readShifts_('').rows;
  var inRange = function (d) { return d.slice(0, 7) === ym || d.slice(0, 7) === prev || d.slice(0, 7) === sch_addMonth_(ym, 1); };
  var shifts = all.filter(function (r) { return inRange(r.date); }).map(function (r) {
    return { id: r.id, date: r.date, empId: r.empId, name: r.name, loc: r.loc, start: r.start, end: r.end, hours: r.hours || sch_hours_(r.start, r.end) };
  });
  var staff = sch_staff_(), list = [];
  Object.keys(staff).forEach(function (id) { var x = staff[id]; if (!x.left) list.push({ id: id, name: x.name, role: x.role, student: x.student }); });
  var reqs = sch_reqs_().filter(function (q) { return m.managed.indexOf(q.loc) >= 0 && (/待|開放/.test(q.status) || q.date >= sch_today_()); })
    .map(function (q) { delete q.row; return q; });
  var holidays = {};
  Object.keys(cal).forEach(function (d) { if (inRange(d)) holidays[d] = cal[d]; });
  return { success: true, ym: ym, managed: m.managed, role: m.me.role, staff: list, shifts: shifts,
    templates: sch_templates_(m.managed), avail: sch_availStrip_(sch_availAll_(ym)), holidays: holidays,
    stats: sch_stats_(all.filter(function (r) { return r.date.slice(0, 7) === ym; }), cal, prm), requests: reqs, params: prm,
    issues: sch_dayCheck_(all.filter(function (r) { return r.date.slice(0, 7) === ym; })) };
}
function sch_addMonth_(ym, n) { var y = +ym.slice(0, 4), mo = +ym.slice(5, 7) - 1 + n; y += Math.floor(mo / 12); mo = ((mo % 12) + 12) % 12; return y + '-' + ('0' + (mo + 1)).slice(-2); }
function sch_availStrip_(a) { Object.keys(a).forEach(function (k) { delete a[k].row; }); return a; }

// ───────── 夥伴「我的班表」(一次載入) ─────────
function sch_mine_(p) {
  var me = sch_me_(p.empId), today = sch_today_(), ym = today.slice(0, 7), nx = sch_addMonth_(ym, 1), prm = sch_params_();
  var cal = sch_calendar_(''), rows = sch_readShifts_('').rows.filter(function (r) { var m = r.date.slice(0, 7); return m === ym || m === nx; });
  var mine = rows.filter(function (r) { return r.empId === me.id; });
  var mates = {};
  rows.forEach(function (r) { var k = r.date + '|' + r.loc; (mates[k] = mates[k] || []).push(r.name); });
  var reqs = sch_reqs_(), staff = sch_staff_(), list = [];
  Object.keys(staff).forEach(function (id) { if (!staff[id].left && id !== me.id) list.push({ id: id, name: staff[id].name }); });
  var availYm = String(p.availYm || nx), av = sch_availAll_(availYm)[me.id] || null;
  if (av) delete av.row;
  var st = sch_stats_(mine.filter(function (r) { return r.date.slice(0, 7) === ym; }), cal, prm)[me.id] || { hours: 0, days: 0, holidayDays: 0, wage: 0 };
  var stN = sch_stats_(mine.filter(function (r) { return r.date.slice(0, 7) === nx; }), cal, prm)[me.id] || { hours: 0, days: 0, holidayDays: 0, wage: 0 };
  return { success: true, me: { id: me.id, name: me.name, student: me.student },
    shifts: mine.map(function (r) { return { id: r.id, date: r.date, loc: r.loc, start: r.start, end: r.end, hours: r.hours || sch_hours_(r.start, r.end),
      mates: (mates[r.date + '|' + r.loc] || []).filter(function (n) { return n !== me.name; }) }; }),
    stats: { cur: st, next: stN }, holidays: cal, staff: list, params: prm,
    open: reqs.filter(function (q) { return q.status === '開放認領' && q.date >= today && q.fromId !== me.id; }).map(function (q) { delete q.row; return q; }),
    incoming: reqs.filter(function (q) { return q.kind === 'give' && q.toId === me.id && q.status === '待對方同意'; }).map(function (q) { delete q.row; return q; }),
    myReqs: reqs.filter(function (q) { return (q.fromId === me.id || q.toId === me.id) && (q.date >= today); }).map(function (q) { delete q.row; return q; }),
    availYm: availYm, avail: av };
}

// ───────── 排班 vs 打卡對帳(薪資核對用) ─────────
// 打卡紀錄:B 日期、C 員工編號、F 打卡類型(上班/下班)、G 打卡時間、J 打卡地點
function sch_reconcile_(p) {
  var m = sch_mgr_(p.empId), ym = String(p.ym || sch_today_().slice(0, 7)), today = sch_today_();
  var plan = sch_readShifts_(ym).rows.filter(function (r) { return m.managed.indexOf(r.loc) >= 0 && r.date < today; });
  var punches = {};
  ['打卡紀錄', '打卡紀錄_歷史'].forEach(function (n) {
    var sh = sch_ss_().getSheetByName(n); if (!sh || sh.getLastRow() < 2) return;
    sh.getRange(2, 1, sh.getLastRow() - 1, 10).getValues().forEach(function (r) {
      var d = sch_d_(r[1]); if (d.slice(0, 7) !== ym) return;
      var t = r[6] instanceof Date ? r[6] : new Date(String(r[6])); if (isNaN(t.getTime())) return;
      var k = String(r[2]).trim() + '|' + d;
      (punches[k] = punches[k] || []).push({ type: String(r[5]).trim(), t: t.getTime(), loc: String(r[9] || '').trim() });
    });
  });
  var rows = [], planned = {}, sum = { shifts: plan.length, ok: 0, late: 0, early: 0, missing: 0, unplanned: 0, planH: 0, realH: 0 };
  plan.forEach(function (s) {
    planned[s.empId + '|' + s.date] = 1;
    var ps = (punches[s.empId + '|' + s.date] || []).filter(function (x) { return !x.loc || x.loc === s.loc; }).sort(function (a, b) { return a.t - b.t; });
    var ins = ps.filter(function (x) { return x.type === '上班'; }), outs = ps.filter(function (x) { return x.type === '下班'; });
    var due = new Date(s.date + 'T' + s.start + ':00+08:00').getTime(), endT = new Date(s.date + 'T' + s.end + ':00+08:00').getTime();
    if (endT <= due) endT += 86400000;
    var real = 0, open = null;
    ps.forEach(function (x) { if (x.type === '上班') open = x; else if (x.type === '下班' && open) { real += (x.t - open.t) / 3600000; open = null; } });
    var issue = [], ph = s.hours || sch_hours_(s.start, s.end);
    if (!ins.length) issue.push('未打上班卡');
    else if (ins[0].t > due + 5 * 60000) issue.push('遲到 ' + Math.round((ins[0].t - due) / 60000) + ' 分');
    if (ins.length && !outs.length) issue.push('未打下班卡');
    else if (outs.length && outs[outs.length - 1].t < endT - 5 * 60000) issue.push('早退 ' + Math.round((endT - outs[outs.length - 1].t) / 60000) + ' 分');
    sum.planH += ph; sum.realH += real;
    if (!ins.length) sum.missing++; else if (/遲到/.test(issue.join())) sum.late++;
    if (/早退/.test(issue.join())) sum.early++;
    if (!issue.length) sum.ok++;
    if (issue.length || Math.abs(real - ph) >= 1) rows.push({ date: s.date, name: s.name, loc: s.loc, plan: s.start + '–' + s.end, planH: ph,
      realH: Math.round(real * 10) / 10, issue: issue.join('、') || (real > ph ? '比排班多 ' : '比排班少 ') + Math.round(Math.abs(real - ph) * 10) / 10 + ' 小時' });
  });
  // 沒排班卻有打卡(只列負責櫃位)
  var staff = sch_staff_();
  Object.keys(punches).forEach(function (k) {
    if (planned[k]) return;
    var ps = punches[k], loc = (ps.filter(function (x) { return x.type === '上班'; })[0] || {}).loc || '';
    if (!loc || m.managed.indexOf(loc) < 0) return;
    var parts = k.split('|'); sum.unplanned++;
    rows.push({ date: parts[1], name: (staff[parts[0]] || {}).name || parts[0], loc: loc, plan: '—', planH: 0, realH: 0, issue: '沒有排班但有打卡' });
  });
  sum.planH = Math.round(sum.planH * 10) / 10; sum.realH = Math.round(sum.realH * 10) / 10;
  rows.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  return { success: true, ym: ym, summary: sum, rows: rows };
}

// ───────── 整理班表(Lv.3 以上;在 Google Sheets 直接改完後按一下)─────────
// 重算該月每一列:C 星期、I 預計時數、J 單雙人、K 是否假日、L 假日類型;M 空白補「已發布」;A 編號空白或重複就補新的;E 姓名對齊〈夥伴資料〉
// 不改日期、人、櫃位、時間;重複排班只列出來,不自動刪
var SCH_COLNAME = ['編號','日期','星期','員工編號','姓名','櫃位','上班','下班','時數','單雙人','是否假日','假日類型','發布狀態'];
function sch_tidy_(p) {
  var m = sch_mgr_(p.managerId), ym = String(p.ym || sch_today_().slice(0, 7));
  if (m.me.role < 3) return { error: '整理班表需要 Lv.3 以上' };
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var sh = sch_ss_().getSheetByName('班表'), c = sch_cols_(sh);
    if (sh.getLastRow() < 2) return { success: true, ym: ym, rows: 0, changed: 0, details: [], issues: [] };
    var raw = sh.getRange(2, 1, sh.getLastRow() - 1, c.width).getValues(), cal = sch_calendar_(''), staff = sch_staff_();
    var seen = {}, cnt = {}, details = [], changed = 0, rowsInMonth = 0, list = [], dirty = {};
    var live = function (r) { var d = sch_d_(r[c.date]); return d && d.slice(0, 7) === ym && String(r[c.emp]).trim() && !/刪除|取消/.test(String(r[c.status])); };
    raw.forEach(function (r) { if (!live(r)) return; var k = sch_d_(r[c.date]) + '|' + String(r[c.loc]).trim(); cnt[k] = (cnt[k] || 0) + 1; });
    raw.forEach(function (r, i) {
      var id = String(r[c.id]).trim();
      if (!live(r)) { if (id) seen[id] = 1; return; }
      rowsInMonth++;
      var d = sch_d_(r[c.date]), loc = String(r[c.loc]).trim(), st = sch_t_(r[c.start]), en = sch_t_(r[c.end]), emp = String(r[c.emp]).trim();
      var dt = sch_dayType_(d, loc, cal), want = {};
      want[c.week] = sch_week_(d);
      if (st && en) want[c.hours] = sch_hours_(st, en);
      want[c.type] = sch_typeWord_(raw, c, cnt[d + '|' + loc] || 1);
      want[c.hol] = sch_quotaHoliday_(dt) ? '是' : '否';
      want[c.htype] = dt;
      if (!String(r[c.status]).trim()) want[c.status] = '已發布';
      if (!id || seen[id]) want[c.id] = sch_newId_() + i;
      if (staff[emp] && String(r[c.name]).trim() !== staff[emp].name) want[c.name] = staff[emp].name;
      var fix = [];
      Object.keys(want).forEach(function (k) { var col = +k; if (String(r[col]) !== String(want[col])) { r[col] = want[col]; fix.push(SCH_COLNAME[col]); } });
      seen[String(r[c.id])] = 1;
      if (fix.length) { changed++; dirty[i] = 1; if (details.length < 30) details.push('第 ' + (i + 2) + ' 列 ' + d + ' ' + r[c.name] + ':補正 ' + fix.join('、')); }
      if (!st || !en) details.push('第 ' + (i + 2) + ' 列 ' + d + ' ' + r[c.name] + ':上下班時間看不懂,請手動確認');
      if (!staff[emp]) details.push('第 ' + (i + 2) + ' 列 ' + d + ':員工編號 ' + emp + ' 在〈夥伴資料〉找不到');
      list.push({ id: String(r[c.id]), date: d, empId: emp, name: String(r[c.name]), loc: loc, start: st, end: en });
    });
    sch_writeRows_(sh, raw, dirty, c.width);
    return { success: true, ym: ym, rows: rowsInMonth, changed: changed, details: details, issues: sch_dayCheck_(list).map(function (x) { return x.text; }) };
  } finally { lock.releaseLock(); }
}

// ───────── 路由 ─────────
function schHandler_(action, p) {
  if (!/^sch/.test(String(action || ''))) return null;
  p = p || {}; SCH_C_ = {};
  try {
    switch (action) {
      case 'schBoard':         return sch_board_(p);
      case 'schPublish':       return sch_publish_(p);
      case 'schSaveTemplates': return sch_saveTemplates_(p);
      case 'schMine':          return sch_mine_(p);
      case 'schSetAvail':      return sch_setAvail_(p);
      case 'schRequest':       return sch_request_(p);
      case 'schOpenShift':     return sch_openShift_(p);
      case 'schRespond':       return sch_respond_(p);
      case 'schApprove':       return sch_approve_(p);
      case 'schReconcile':     return sch_reconcile_(p);
      case 'schTidy':          return sch_tidy_(p);
    }
  } catch (e) { return { error: '排班系統錯誤:' + e.message }; }
  return null;
}

// 第一次安裝執行一次
function sch_setup() {
  sch_sheet_('班型設定', SCH_TPL_HEAD); sch_sheet_('可上班登記', SCH_AVAIL_HEAD); sch_sheet_('換班申請', SCH_REQ_HEAD);
  var sh = sch_ss_().getSheetByName('參數設定');
  if (sh) {
    var have = sh.getDataRange().getValues().map(function (r) { return String(r[0]).trim(); });
    [['排班估算時薪', 196, '排班頁預估工資用(實際薪資仍依打卡)'], ['每月達標時數', 180, ''], ['學生每月達標時數', 72, ''],
     ['每月達標假日天數', 4, ''], ['空檔填寫截止日', 20, '每月幾號前填好下個月空檔']]
      .forEach(function (x) { if (have.indexOf(x[0]) < 0) sh.appendRow(x); });
  }
  // 範例班型(只在表是空的時候放):每個櫃位平日/假日各一個 10 小時班
  var t = sch_sheet_('班型設定', SCH_TPL_HEAD);
  if (t.getLastRow() < 2) {
    var rows = [];
    sch_locNames_().forEach(function (n) { if (/^00/.test(n)) return; rows.push([n, '平日', "'11:00", "'21:00", '平日', 1], [n, '假日', "'10:30", "'21:30", '假日', 2]); });
    if (rows.length) t.getRange(2, 1, rows.length, 6).setValues(rows);
  }
  return '排班系統 v1.18 安裝完成';
}
