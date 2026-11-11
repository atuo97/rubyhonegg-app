// ═══════════════════════════════════════════════
// 薪資引擎 v3 後端模組 v1（2026-11-12，v1.20 批次；v3＝部署端修正日期格式的民國生日）
// 貼在「程式碼.gs」最底部（要在登入安全模組、排班系統模組、營運管理模組之後）；
// extHandler_ 內、opsHandler_ 那行的下一行加：
//   var py = payHandler_(action, p); if (py) return py;
//
// 1. 新工時規則（隊長 11/12 定案；〈參數設定〉「新工時規則起始月」起適用，預設 2026-12）
//    排班定框、打卡定實際、加班要核准：
//    - 早到不算，從排班上班時間起算
//    - 遲到／早退 ≤ 寬限（「遲到早退寬限分鐘」，預設 15）視同準時；超過依實際打卡時間（只少算實際的分鐘）
//    - 晚走：下班打卡往前取最近的整點或半點，比排班多出的時數列為「待核准加班」，分隊長核准後才計入
//    - 有排班沒打卡：先依排班時數計，薪資表標「⚠ 無打卡，請確認」，分隊長在對帳頁確認出勤或缺勤
//    - 有打卡沒排班（臨時支援）：分隊長核准後才計入（依實際打卡）
//    - 活動（場所性質＝活動）：依打卡實際時數
//    起始月以前的月份：照舊依打卡（與原 calcSalaryV2 相同）。
// 2. calcSalaryV2 改用本引擎（覆蓋原本最後一個版本）。其餘獎金、津貼、勞健保算法完全照舊。
//    加盟店夥伴（帳號類型＝加盟店夥伴，或只在加盟櫃位上班）寫進〈加盟店薪資〉，不進〈薪資明細〉；
//    合作夥伴不算薪資。
// 3. sec_salaryToDate_（我的→本月薪資概況）改用本引擎，提醒也一起顯示。
// 4. 對帳頁：payRecon（待確認清單）、payDecide（核准加班／確認出勤或缺勤／核准臨時支援）。
// ═══════════════════════════════════════════════

var PAY_DEC_HEAD = ['鍵值', '日期', '員工編號', '姓名', '櫃位', '類型', '結果', '時數', '處理人', '處理時間', '備註'];
var PAY_FR_HEAD = ['薪資編號', '年月', '員工編號', '姓名', '櫃位', '正常工時', '假日工時', '總工時', '基本8小時薪', '加班薪資1(1.33)', '加班薪資2(1.67)', '加班薪資3(2倍)',
  '假日加倍薪資', '基本薪資小計', '團體獎金', '業績獎金', '技能津貼', '貢獻津貼', '長青津貼', '生日津貼', '三節津貼', '職務加給', '薪資合計', '勞保自付', '健保自付',
  '未投保補貼', '轉帳手續費', '實領金額', '發放方式', '發布狀態', '備注', '假日出勤獎金', '保費加發', '系統提醒', '加盟店'];

function pay3_ss_() { return SpreadsheetApp.openById(SHEET_ID); }
function pay3_sheet_(name, head) {
  var ss = pay3_ss_(), sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(head); sh.setFrozenRows(1); }
  return sh;
}
function pay3_param_(P, name, def) { return P[name] === undefined || P[name] === '' || P[name] === 0 && def !== 0 ? def : P[name]; }
function pay3_rawParam_(name, def) {                 // getParams 只轉數字；文字參數另外讀
  var sh = pay3_ss_().getSheetByName('參數設定'); if (!sh) return def;
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]).trim() === name) return v[i][1] === '' ? def : v[i][1];
  return def;
}
function pay3_ruleStart_() {
  var v = pay3_rawParam_('新工時規則起始月', '2026-12');
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, 'Asia/Taipei', 'yyyy-MM');
  return String(v).slice(0, 7);
}
function pay3_decisions_() {
  var sh = pay3_sheet_('出勤確認', PAY_DEC_HEAD), out = {};
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 11).getValues().forEach(function (r, i) {
    var k = String(r[0]).trim(); if (!k) return;
    out[k] = { row: i + 2, result: String(r[6]), hours: Number(r[7]) || 0, by: String(r[8] || ''), at: String(r[9] || '') };
  });
  return out;
}
// 櫃位改名後，舊紀錄（例：01正櫃遠百信義）用前兩碼編號對到新名稱（01遠百信義-4樓）；名稱含「活動」視為活動
function pay3_locAlias_(locs) {
  var byCode = {}, actKey = null;
  Object.keys(locs).forEach(function (n) { var cd = locs[n].code || (n.match(/^(\d{2})/) || [])[1]; if (cd && !byCode[cd]) byCode[cd] = locs[n]; if (/活動/.test(locs[n].kind || '') && /活動/.test(n) && !actKey) actKey = locs[n]; });
  var get = function (n) {
    if (locs[n]) return locs[n];
    var m = String(n || '').match(/^(\d{2})/);
    if (m && byCode[m[1]]) return byCode[m[1]];
    if (/活動/.test(String(n || ''))) return actKey || { kind: '活動', type: 'B直結', county: '' };
    return undefined;
  };
  if (typeof Proxy === 'function') return new Proxy(locs, { get: function (t, k) { return typeof k === 'string' ? get(k) : t[k]; } });
  return locs;
}
// 生日：〈夥伴資料〉是民國年（67/09/07），原引擎直接 new Date 會當成西元 1967 年，年齡多算 11 歲（長青津貼會誤發）→ 這裡改正
function pay3_bday_(v) {
  if (!v) return null;
  if (Object.prototype.toString.call(v) === '[object Date]') {      // 部署端修正 11/12：生日欄多半是以 yy/mm/dd「日期格式」存的民國年，
    var y0 = v.getFullYear();                                        // 67/09/07 會被試算表存成 1967 → 加 11 才是 1978（隊長 11/12 決定一律當民國年）
    if (y0 < 1912) y0 += 1911; else if (y0 >= 1930 && y0 <= 1999) y0 += 11;
    return new Date(y0, v.getMonth(), v.getDate());
  }
  var m = String(v).trim().match(/^(\d{2,4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (!m) { var d = new Date(v); return isNaN(d) ? null : d; }
  var y = parseInt(m[1], 10); if (y < 1000) y += 1911;
  return new Date(y, parseInt(m[2], 10) - 1, parseInt(m[3], 10));
}
function pay3_code_(n) { var c = typeof loc_code_ === 'function' ? loc_code_(n) : ((String(n || '').match(/^(\d{2})/) || [])[1] || ''); return c || '名:' + String(n || ''); }
function pay3_same_(a, b) { return a === b || pay3_code_(a) === pay3_code_(b); }
function pay3_t_(date, hhmm) { return new Date(date + 'T' + hhmm + ':00+08:00').getTime(); }
function pay3_hhmm_(t) { return Utilities.formatDate(new Date(t), 'Asia/Taipei', 'HH:mm'); }
// 一組打卡 → 依上下班配對出的時數（同一個地點）
function pay3_pairHours_(ps) {
  var h = 0, open = null, first = null;
  ps.slice().sort(function (a, b) { return a.t - b.t; }).forEach(function (x) {
    if (x.type === '上班') { open = x; if (first === null) first = x.t; }
    else if (x.type === '下班' && open) { h += Math.max(0, (x.t - open.t) / 3600000); open = null; }
  });
  return { hrs: h, first: first };
}

// ── 核心：算出每位夥伴某月（到 cutoff 為止）的工時與薪資 ──
// opt: { cutoff:'yyyy-MM-dd'（含）, only:'E001', overview:true（我的→本月薪資概況） }
function pay3_compute_(ym, opt) {
  opt = opt || {};
  var ss = pay3_ss_(), P = getParams(), cal = getCalendar(), locs = pay3_locAlias_(getLocations());
  var wage = P['基準時薪'] || 196, targetMonth = parseInt(ym.slice(5), 10), FEST = [1, 6, 9];
  var newRule = ym >= pay3_ruleStart_(), grace = (Number(pay3_rawParam_('遲到早退寬限分鐘', 15)) || 15) * 60000;
  var cutoff = opt.cutoff || '9999-12-31';
  var staffV = ss.getSheetByName('夥伴資料').getDataRange().getValues(), head = staffV[0] || [];
  var iType = -1, iMng = 46; head.forEach(function (h, i) { h = String(h).trim(); if (h === '帳號類型') iType = i; if (/負責櫃位/.test(h)) iMng = i; });
  var staff = {}; for (var si = 1; si < staffV.length; si++) { var id0 = String(staffV[si][0]).trim(); if (id0) staff[id0] = staffV[si]; }
  var cum = ss.getSheetByName('累計工時').getDataRange().getValues();
  var dec = newRule ? pay3_decisions_() : {};
  var isAct = function (loc) { return /活動/.test((locs[loc] || {}).kind || ''); };
  var isFr = function (loc) { return /加盟/.test((locs[loc] || {}).kind || ''); };

  // 打卡（含歷史）
  var punches = {};
  ['打卡紀錄_歷史', '打卡紀錄'].forEach(function (n) {
    var sh = ss.getSheetByName(n); if (!sh || sh.getLastRow() < 2) return;
    sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(17, Math.min(sh.getLastColumn(), 17))).getValues().forEach(function (r) {
      var eid = String(r[2]).trim(); if (!eid) return;
      var flag = String(r[16] || '');
      if (flag.indexOf('異常未下班') >= 0 && flag.indexOf('已由管理員補登') < 0) return;
      var t = r[6] ? new Date(r[6]) : null; if (!t || isNaN(t)) return;
      var d = Utilities.formatDate(t, 'Asia/Taipei', 'yyyy-MM-dd');
      if (d.slice(0, 7) !== ym || d > cutoff) return;
      if (opt.only && eid !== opt.only) return;
      var k = eid + '|' + d;
      (punches[k] = punches[k] || []).push({ type: String(r[5]).trim(), t: t.getTime(), loc: String(r[9] || '').trim() });
    });
  });

  // 計薪「段」：{ empId, date, loc, hrs, first, note }
  var segs = [], pending = [], flags = {};
  var addFlag = function (eid, txt) { (flags[eid] = flags[eid] || []).push(txt); };
  if (!newRule) {
    Object.keys(punches).forEach(function (k) {
      var a = k.split('|'), byLoc = {};
      punches[k].forEach(function (x) { (byLoc[x.loc] = byLoc[x.loc] || []).push(x); });
      Object.keys(byLoc).forEach(function (loc) {
        var r = pay3_pairHours_(byLoc[loc]); if (!r.hrs) return;
        segs.push({ empId: a[0], date: a[1], loc: loc, hrs: r.hrs, first: r.first, how: '打卡' });
      });
    });
  } else {
    SCH_C_ = {};
    var plan = sch_readShifts_(ym).rows.filter(function (s) { return s.date <= cutoff && (!opt.only || s.empId === opt.only); });
    var planned = {};
    plan.forEach(function (s) { (planned[s.empId + '|' + s.date] = planned[s.empId + '|' + s.date] || []).push(s); });
    var keys = {}; Object.keys(planned).forEach(function (k) { keys[k] = 1; }); Object.keys(punches).forEach(function (k) { keys[k] = 1; });
    Object.keys(keys).forEach(function (k) {
      var a = k.split('|'), eid = a[0], d = a[1], ps = punches[k] || [], used = {};
      var name = staff[eid] ? String(staff[eid][1]) : eid;
      (planned[k] || []).forEach(function (s) {
        if (isAct(s.loc)) return;                       // 活動：依打卡（下面處理）
        used[pay3_code_(s.loc)] = 1;
        var mine = ps.filter(function (x) { return !x.loc || pay3_same_(x.loc, s.loc); });
        var ins = mine.filter(function (x) { return x.type === '上班'; }).sort(function (x, y) { return x.t - y.t; });
        var outs = mine.filter(function (x) { return x.type === '下班'; }).sort(function (x, y) { return x.t - y.t; });
        var ps0 = pay3_t_(d, s.start), pe0 = pay3_t_(d, s.end); if (pe0 <= ps0) pe0 += 86400000;
        var key = d + '|' + eid + '|' + s.loc, planH = (pe0 - ps0) / 3600000;
        if (!ins.length && !outs.length) {
          var dn = dec[key + '|無打卡'];
          if (dn && dn.result === '缺勤') return;
          segs.push({ empId: eid, date: d, loc: s.loc, hrs: planH, first: ps0, how: '排班（無打卡）' });
          if (!dn) { addFlag(eid, d.slice(5) + ' 無打卡'); pending.push({ key: key + '|無打卡', type: '無打卡', date: d, empId: eid, name: name, loc: s.loc, plan: s.start + '–' + s.end, planH: planH, actual: '—', suggest: planH }); }
          return;
        }
        var st = ps0, en = pe0, note = [];
        if (ins.length && ins[0].t > ps0 + grace) { st = ins[0].t; note.push('遲到 ' + Math.round((ins[0].t - ps0) / 60000) + ' 分'); }
        if (outs.length) {
          var lo = outs[outs.length - 1].t;
          if (lo < pe0 - grace) { en = lo; note.push('早退 ' + Math.round((pe0 - lo) / 60000) + ' 分'); }
          var extra = Math.floor((lo - pe0) / 1800000) * 0.5;        // 往前取最近的整點或半點
          if (extra >= 0.5) {
            var dk = key + '|加班', dv = dec[dk];
            if (dv && dv.result === '核准') { en = pe0 + dv.hours * 3600000; note.push('加班 ' + dv.hours + 'h（已核准）'); }
            else if (!dv) { addFlag(eid, d.slice(5) + ' 加班 ' + extra + 'h 待核准'); pending.push({ key: dk, type: '加班', date: d, empId: eid, name: name, loc: s.loc, plan: s.start + '–' + s.end, planH: planH, actual: pay3_hhmm_(lo) + ' 下班', suggest: extra }); }
          }
        } else { note.push('未打下班卡，依排班'); addFlag(eid, d.slice(5) + ' 未打下班卡'); }
        var h = Math.max(0, (en - st) / 3600000);
        if (h > 0) segs.push({ empId: eid, date: d, loc: s.loc, hrs: h, first: st, how: note.join('、') || '準時' });
      });
      // 打卡但不在排班內的地點：活動依打卡；其他＝臨時支援，核准後才算
      var byLoc = {};
      ps.forEach(function (x) { if (x.loc ? !used[pay3_code_(x.loc)] : !Object.keys(used).length) (byLoc[x.loc] = byLoc[x.loc] || []).push(x); });
      Object.keys(byLoc).forEach(function (loc) {
        var r = pay3_pairHours_(byLoc[loc]); if (!r.hrs) return;
        if (isAct(loc) || !loc) { segs.push({ empId: eid, date: d, loc: loc, hrs: r.hrs, first: r.first, how: '活動（依打卡）' }); return; }
        var dk = d + '|' + eid + '|' + loc + '|臨時支援', dv = dec[dk];
        if (dv && dv.result === '核准') segs.push({ empId: eid, date: d, loc: loc, hrs: r.hrs, first: r.first, how: '臨時支援（已核准）' });
        else if (!dv) { addFlag(eid, d.slice(5) + ' 沒排班有打卡 待核准'); pending.push({ key: dk, type: '臨時支援', date: d, empId: eid, name: name, loc: loc, plan: '—', planH: 0, actual: Math.round(r.hrs * 10) / 10 + 'h', suggest: Math.round(r.hrs * 10) / 10 }); }
      });
    });
  }

  // 櫃位每日工時、人數（假日獎金分攤、業績門檻人數、團體獎金比例）
  var locDayHours = {}, locDayCount = {}, locMonthHours = {}, empLocHours = {}, seen = {};
  segs.forEach(function (s) {
    var k = s.date + '_' + s.loc;
    locDayHours[k] = (locDayHours[k] || 0) + s.hrs;
    if (!seen[k + s.empId]) { locDayCount[k] = (locDayCount[k] || 0) + 1; seen[k + s.empId] = 1; }
    locMonthHours[s.loc] = (locMonthHours[s.loc] || 0) + s.hrs;
    empLocHours[s.empId + '_' + s.loc] = (empLocHours[s.empId + '_' + s.loc] || 0) + s.hrs;
  });
  // 業績
  var calcRev = function (loc, rev) {
    var lc = locs[loc] || {};
    if (lc.type === 'A百貨') return rev * 0.8;
    if (lc.type === 'C份數') return rev * (lc.unitPrice || P['C類預設抽成'] || 70);
    return rev;
  };
  var dayRevenue = {};
  ['收店盤點_歷史', '收店盤點'].forEach(function (n) {
    var sh = ss.getSheetByName(n); if (!sh || sh.getLastRow() < 2) return;
    sh.getRange(2, 1, sh.getLastRow() - 1, Math.min(sh.getLastColumn(), 31)).getValues().forEach(function (r) {
      if (!r[1]) return;
      var d = Utilities.formatDate(new Date(r[1]), 'Asia/Taipei', 'yyyy-MM-dd');
      if (d.slice(0, 7) !== ym || d > cutoff) return;
      var tot = r[30] !== '' && r[30] !== undefined ? parseFloat(r[30]) : parseFloat(r[16]) || 0;
      dayRevenue[d + '_' + String(r[5])] = tot || 0;
    });
  });
  var locRev = {}, locDays = {}, groupPool = {}, groupEq = {};
  Object.keys(dayRevenue).forEach(function (k) { var loc = k.slice(11), c = calcRev(loc, dayRevenue[k]); if (!c) return; locRev[loc] = (locRev[loc] || 0) + c; locDays[loc] = (locDays[loc] || 0) + 1; });
  Object.keys(locRev).forEach(function (loc) { var eq = locRev[loc] / locDays[loc] * 30; groupEq[loc] = eq; if (eq > (P['團體獎金門檻'] || 200000)) groupPool[loc] = locRev[loc] * 0.01; });

  // 逐人
  var bySeg = {}; segs.forEach(function (s) { (bySeg[s.empId] = bySeg[s.empId] || []).push(s); });
  var emps = {}, tier = function (c) { return c > 4320 ? 2400 : c > 2160 ? 1200 : 600; };
  var salSh = ss.getSheetByName('薪資明細'), salEx = salSh ? salSh.getDataRange().getValues() : [];
  Object.keys(bySeg).forEach(function (empId) {
    var emp = staff[empId]; if (!emp) return;
    if (emp[10] && !opt.only) return;                   // 已離職（與原引擎相同）
    var type = iType >= 0 ? String(emp[iType] || '').trim() : '';
    if (/合作/.test(type)) return;
    var home = String(emp[38] || ''), birthday = pay3_bday_(emp[4]);
    var laborSt = String(emp[41] || '公司投保'), healthSt = String(emp[42] || '公司投保'), deps = parseInt(emp[27]) || 0;
    var cumHrs = 0; for (var i = cum.length - 1; i >= 1; i--) if (String(cum[i][0]) === empId) { cumHrs = parseFloat(cum[i][6]) || 0; break; }
    var basic = 0, ot1 = 0, ot2 = 0, ot3 = 0, dblPay = 0, holBonus = 0, perfBonus = 0, group = 0, normalH = 0, holH = 0;
    var locSet = {}, perfAwarded = {}, days = [], byDay = {};
    bySeg[empId].forEach(function (s) { (byDay[s.date] = byDay[s.date] || []).push(s); });
    Object.keys(byDay).sort().forEach(function (date) {
      var list = byDay[date]; list.sort(function (a, b) { return a.first - b.first; });
      var off = 0;
      list.forEach(function (s) {
        var lc = locs[s.loc] || {}; locSet[s.loc] = 1;
        var dt = getDayType(s.date, lc.county || '', home, cal);
        var h = s.hrs, a = off, z = off + h;
        var seg = function (lo, hi) { return Math.max(0, Math.min(z, hi) - Math.max(a, lo)); };
        var b = seg(0, 8) * wage, o1 = seg(8, 10) * wage * 1.33, o2 = seg(10, 12) * wage * 1.67, o3 = seg(12, 999) * wage * 2;
        off = z;
        var row = { date: s.date, loc: s.loc, hrs: Math.round(h * 100) / 100, how: s.how, dayType: dt, pay: 0, holBonus: 0, perf: 0, rev: null };
        if (dt === '國定假日' || dt === '颱風日') { dblPay += b + o1 + o2 + o3; holH += h; row.pay = (b + o1 + o2 + o3) * 2; }
        else { basic += b; ot1 += o1; ot2 += o2; ot3 += o3; normalH += h; row.pay = b + o1 + o2 + o3; }
        if (dt === '假日' || dt === '連假日' || (lc.kind === '活動' && dt === '平日')) {
          var tot = locDayHours[s.date + '_' + s.loc] || h, hb = CEIL((P['假日出勤獎金'] || 500) / tot * h);
          holBonus += hb; row.holBonus = hb;
        }
        var ak = s.date + '_' + s.loc;
        if (!perfAwarded[ak]) {
          var rev = dayRevenue[ak];
          if (rev !== undefined) {
            var cv = calcRev(s.loc, rev), th = perfBonusTable(locDayCount[ak] || 1, P), pb = 0;
            if (cv >= th[2]) pb = 1000; else if (cv >= th[1]) pb = 700; else if (cv >= th[0]) pb = 500;
            perfBonus += pb; row.perf = pb; row.rev = Math.round(cv);
            row.next = pb >= 1000 ? 0 : Math.ceil((pb >= 700 ? th[2] : pb >= 500 ? th[1] : th[0]) - cv);
          }
          perfAwarded[ak] = 1;
        }
        row.pay = CEIL(row.pay); days.push(row);
      });
    });
    var groupNotes = [];
    Object.keys(locSet).forEach(function (loc) {
      if (groupPool[loc] && locMonthHours[loc]) group += groupPool[loc] * (empLocHours[empId + '_' + loc] || 0) / locMonthHours[loc];
      else if (groupEq[loc]) groupNotes.push(loc + ' 月換算業績目前約 ' + Math.round(groupEq[loc]).toLocaleString() + '，超過 ' + (P['團體獎金門檻'] || 200000).toLocaleString() + ' 才有團體獎金');
    });
    var totalH = normalH + holH;
    basic = CEIL(basic); ot1 = CEIL(ot1); ot2 = CEIL(ot2); ot3 = CEIL(ot3); dblPay = CEIL(dblPay * 2); group = CEIL(group);
    var basicTotal = basic + ot1 + ot2 + ot3 + dblPay;
    var skill = cumHrs > 180 ? CEIL(totalH * 20) : 0;
    var cl = cumHrs > 4320 ? 20 : cumHrs > 3240 ? 15 : cumHrs > 2160 ? 10 : cumHrs > 1080 ? 5 : 0;
    var contrib = CEIL(totalH * cl);
    var age = 0;
    if (birthday && !isNaN(birthday)) { var ref = new Date(ym + '-01'); age = ref.getFullYear() - birthday.getFullYear(); if (ref.getMonth() < birthday.getMonth()) age--; }
    var evergreen = age >= 50 ? CEIL(totalH * (10 + (age - 50))) : 0;   // 長青津貼：隊長 11/12 定案要發（年滿 50 歲，每小時 +(年齡−50+10)）
    var isBday = !!(birthday && !isNaN(birthday) && birthday.getMonth() + 1 === targetMonth), isFest = FEST.indexOf(targetMonth) >= 0;
    var bday = isBday ? (totalH >= 80 ? tier(cumHrs) : 200) : 0, fest = isFest ? (totalH >= 80 ? tier(cumHrs) : 200) : 0;
    var laborDed = 0, healthDed = 0, insAdd = 0;
    try {
      if (laborSt === '公司投保') laborDed = parseFloat(emp[21]) || 0;
      else insAdd += CEIL(parseFloat(getInsuranceRow(ss, empId, '勞保級距表')[3]) || 0);
      if (healthSt === '公司投保') healthDed = (parseFloat(emp[26]) || 0) * (1 + Math.min(deps, 3));
      else if (healthSt === '無投保') insAdd += CEIL(parseFloat(getInsuranceRow(ss, empId, '健保級距表')[3]) || 0);
    } catch (e) {}
    var fee = parseFloat(emp[17]) || 0, duty = 0, ri = -1;
    for (var k = 1; k < salEx.length; k++) if (String(salEx[k][2]) === empId && ymNorm(salEx[k][1]) === ym) { ri = k; duty = parseFloat(salEx[k][21]) || 0; break; }
    var gross = basicTotal + group + perfBonus + skill + contrib + evergreen + bday + fest + duty + holBonus + insAdd;
    // 加盟店：帳號類型＝加盟店夥伴，或所有工時都在加盟櫃位
    var frHours = {}, frAll = true;
    Object.keys(locSet).forEach(function (l) { if (isFr(l)) frHours[l] = empLocHours[empId + '_' + l] || 0; else if (l) frAll = false; });
    var frLocs = Object.keys(frHours).sort(function (a, b) { return frHours[b] - frHours[a]; });
    var franchise = /加盟/.test(type) || (frAll && frLocs.length > 0);
    var mng = String(emp[iMng] || '');
    var franchiseLoc = franchise ? (frLocs[0] || mng.split(/[、,，\/\s;；]+/)[0] || '') : '';
    var isOwner = franchise && (parseInt(emp[12]) || 1) >= 2 && !!franchiseLoc && (mng.indexOf(franchiseLoc) >= 0 || franchiseLoc.indexOf(mng.trim()) >= 0 && mng.trim().length >= 2);
    emps[empId] = { empId: empId, name: String(emp[1]), locs: Object.keys(locSet), normalH: normalH, holH: holH, totalH: Math.round(totalH * 100) / 100,
      basic: basic, ot1: ot1, ot2: ot2, ot3: ot3, dblPay: dblPay, basicTotal: basicTotal, group: group, perfBonus: perfBonus, skill: skill, contrib: contrib, cl: cl,
      evergreen: evergreen, age: age, bday: bday, fest: fest, isBday: isBday, isFest: isFest, tier: tier(cumHrs), duty: duty, holBonus: holBonus, insAdd: insAdd,
      laborDed: laborDed, healthDed: healthDed, deps: deps, fee: fee, gross: gross, net: gross - laborDed - healthDed - fee, cumHrs: cumHrs, ri: ri,
      days: days, groupNotes: groupNotes, notes: flags[empId] || [], franchise: franchise, franchiseLoc: franchiseLoc, isOwner: isOwner, wage: wage };
  });
  return { ym: ym, newRule: newRule, emps: emps, pending: pending, segs: segs };
}

function pay3_row_(ym, e, salEx) {
  var ri = e.ri;
  return [ym + '-' + e.empId, ym, e.empId, e.name, e.locs.join('、'),
    Math.round(e.normalH * 10) / 10, Math.round(e.holH * 10) / 10, Math.round(e.totalH * 10) / 10,
    e.basic, e.ot1, e.ot2, e.ot3, e.dblPay, e.basicTotal, e.group, e.perfBonus, e.skill, e.contrib, e.evergreen,
    e.bday, e.fest, e.duty, e.gross, e.laborDed, e.healthDed, e.insAdd, e.fee, e.net, '匯款',
    ri > 0 ? (salEx[ri][29] || '待確認') : '待確認', ri > 0 ? (salEx[ri][30] || '') : '',
    e.holBonus, e.insAdd, e.notes.length ? '⚠ ' + e.notes.join('；') + '（請到排班→對帳確認）' : ''];
}

// 覆蓋 calcSalaryV2：總部夥伴寫〈薪資明細〉，加盟店夥伴寫〈加盟店薪資〉
function calcSalaryV2(ym) {
  var ss = pay3_ss_(), res = pay3_compute_(ym, {});
  var salSheet = ss.getSheetByName('薪資明細'), salEx = salSheet.getDataRange().getValues();
  if (String(salEx[0][33] || '') !== '系統提醒') salSheet.getRange(1, 34).setValue('系統提醒');
  var count = 0;
  Object.keys(res.emps).forEach(function (id) {
    var e = res.emps[id]; if (e.franchise) return;
    var row = pay3_row_(ym, e, salEx);
    if (e.ri > 0) salSheet.getRange(e.ri + 1, 1, 1, 34).setValues([row]); else salSheet.appendRow(row);
    count++;
  });
  pay3_writeFranchise_(ym, '', res);
  return count;
}
function pay3_writeFranchise_(ym, onlyLoc, res) {
  res = res || pay3_compute_(ym, {});
  var sh = pay3_sheet_('加盟店薪資', PAY_FR_HEAD), ex = sh.getDataRange().getValues(), n = 0;
  Object.keys(res.emps).forEach(function (id) {
    var e = res.emps[id]; if (!e.franchise || (onlyLoc && e.franchiseLoc !== onlyLoc)) return;
    var ri = -1; for (var i = 1; i < ex.length; i++) if (String(ex[i][2]) === id && ymNorm(ex[i][1]) === ym) { ri = i; break; }
    var copy = {}; for (var k in e) copy[k] = e[k]; copy.ri = ri;
    var row = pay3_row_(ym, copy, ex).concat([e.franchiseLoc + (e.isOwner ? '（加盟主）' : '')]);
    if (ri > 0) sh.getRange(ri + 1, 1, 1, row.length).setValues([row]); else sh.appendRow(row);
    n++;
  });
  return n;
}

// 覆蓋 sec_salaryToDate_：本月 1 日～昨天（我的→本月薪資概況）
function sec_salaryToDate_(p) {
  var empId = String(p.empId || '').trim();
  if (!sec_verifyToken_(p.token, empId)) return { error: '請重新登入後再查看', relogin: true };
  var today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd'), ym = today.slice(0, 7);
  var asOf = Utilities.formatDate(new Date(new Date(today + 'T00:00:00+08:00').getTime() - 86400000), 'Asia/Taipei', 'yyyy-MM-dd');
  var base = { success: true, ym: ym, asOf: asOf, hours: { normal: 0, holiday: 0, total: 0 }, days: [], items: [], deductions: [], gross: 0, net: 0, notes: [] };
  if (asOf.slice(0, 7) !== ym) { base.notes.push('今天是本月第一天，明天起就會看到本月的累計。'); return base; }
  var res = pay3_compute_(ym, { cutoff: asOf, only: empId, overview: true }), e = res.emps[empId];
  base.newRule = res.newRule;
  if (!e) { base.notes.push(res.newRule ? '本月到昨天還沒有計薪的班。' : '本月到昨天還沒有打卡紀錄。'); return base; }
  var it = function (key, label, amt, note) { if (amt || note) base.items.push({ key: key, label: label, amt: amt || 0, note: note || '' }); };
  it('basic', '基本工資', e.basic, Math.round(e.normalH * 10) / 10 + ' 小時 × $' + e.wage);
  it('ot', '加班費', e.ot1 + e.ot2 + e.ot3, (e.ot1 + e.ot2 + e.ot3) ? '第 9 小時起 ×1.33／×1.67／×2' : '');
  it('dbl', '國定假日／颱風日加倍', e.dblPay, e.dblPay ? Math.round(e.holH * 10) / 10 + ' 小時，工資 ×2' : '');
  it('perf', '每日業績獎金', e.perfBonus, '');
  it('hol', '假日出勤獎金', e.holBonus, '');
  it('group', '團體獎金（預估）', e.group, e.group ? '依目前業績預估，月底結算為準' : '');
  it('skill', '技能津貼', e.skill, e.skill ? '每小時 +$20' : '');
  it('contrib', '貢獻津貼', e.contrib, e.contrib ? '每小時 +$' + e.cl : '');
  it('ever', '長青津貼', e.evergreen, e.evergreen ? e.age + ' 歲，每小時 +$' + (10 + e.age - 50) : '');
  if (e.isBday) it('bday', '生日津貼', e.bday, e.totalH >= 80 ? '本月已滿 80 小時' : '目前 ' + Math.round(e.totalH) + ' 小時，滿 80 小時可領 $' + e.tier);
  if (e.isFest) it('fest', '三節津貼', e.fest, e.totalH >= 80 ? '本月已滿 80 小時' : '目前 ' + Math.round(e.totalH) + ' 小時，滿 80 小時可領 $' + e.tier);
  it('duty', '職務加給', e.duty, '');
  it('ins', '勞健保補貼', e.insAdd, '');
  base.gross = base.items.reduce(function (s, x) { return s + x.amt; }, 0);
  if (e.laborDed) base.deductions.push({ label: '勞保自付', amt: e.laborDed });
  if (e.healthDed) base.deductions.push({ label: '健保自付' + (e.deps ? '（含眷屬 ' + Math.min(e.deps, 3) + ' 人）' : ''), amt: e.healthDed });
  if (e.fee) base.deductions.push({ label: '轉帳手續費', amt: e.fee });
  base.net = base.gross - base.deductions.reduce(function (s, x) { return s + x.amt; }, 0);
  base.hours = { normal: Math.round(e.normalH * 10) / 10, holiday: Math.round(e.holH * 10) / 10, total: Math.round(e.totalH * 10) / 10 };
  base.days = e.days; base.cumHrs = e.cumHrs; base.franchise = e.franchise;
  base.notes = (e.notes.length ? ['待分隊長確認：' + e.notes.join('、') + '（確認後金額可能變動）'] : []).concat(e.groupNotes)
    .concat([(res.newRule ? '依排班時間計薪：早到不算，遲到早退 15 分鐘內不扣，加班要分隊長核准。' : '依打卡時數計算。') + '只算到昨天；勞健保是整月金額。正式薪資以月底結算的薪資單為準。']);
  return base;
}

// ── 對帳頁：待確認清單、核准 ──
function pay3_recon_(p) {
  var m = sch_mgr_(p.empId), ym = String(p.ym || Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM'));
  var today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
  var res = pay3_compute_(ym, { cutoff: Utilities.formatDate(new Date(new Date(today + 'T00:00:00+08:00').getTime() - 86400000), 'Asia/Taipei', 'yyyy-MM-dd') });
  var dec = pay3_decisions_(), done = [], inM = function (l) { return m.managed.some(function (x) { return pay3_same_(x, l); }); };
  Object.keys(dec).forEach(function (k) {
    var a = k.split('|'); if (a[0].slice(0, 7) !== ym || !inM(a[2])) return;
    done.push({ key: k, date: a[0], empId: a[1], name: (sch_staff_()[a[1]] || {}).name || a[1], loc: a[2], type: a[3], result: dec[k].result, hours: dec[k].hours, by: dec[k].by, at: dec[k].at });
  });
  return { success: true, ym: ym, newRule: res.newRule, ruleStart: pay3_ruleStart_(),
    pending: res.pending.filter(function (x) { return inM(x.loc); }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }),
    done: done.sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 60) };
}
function pay3_decide_(p) {
  var m = sch_mgr_(p.empId), key = String(p.key || ''), a = key.split('|');
  if (a.length !== 4) return { error: '資料不正確' };
  if (!m.managed.some(function (x) { return pay3_same_(x, a[2]); })) return { error: '您不是這個櫃位的分隊長' };
  var type = a[3], result = String(p.result || '');
  var ok = { '加班': ['核准', '不核准'], '無打卡': ['出勤', '缺勤'], '臨時支援': ['核准', '不核准'] }[type];
  if (!ok || ok.indexOf(result) < 0) return { error: '選項不正確' };
  var hours = Number(p.hours) || 0;
  if (type === '加班' && result === '核准') { hours = Math.round(hours * 2) / 2; if (!(hours >= 0.5 && hours <= 8)) return { error: '加班時數要 0.5～8 小時，以半小時為單位' }; }
  if (a[1] === m.me.id && m.me.role < 3) return { error: '自己的出勤請由其他管理者確認' };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = pay3_sheet_('出勤確認', PAY_DEC_HEAD), dec = pay3_decisions_(), staff = sch_staff_();
    var row = [key, a[0], a[1], (staff[a[1]] || {}).name || '', a[2], type, result, hours, m.me.name,
      Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss'), String(p.note || '').slice(0, 60)];
    if (dec[key]) sh.getRange(dec[key].row, 1, 1, 11).setValues([row]); else sh.appendRow(row);
    return { success: true };
  } finally { lock.releaseLock(); }
}
function pay3_undo_(p) {
  var m = sch_mgr_(p.empId), key = String(p.key || ''), a = key.split('|');
  if (!m.managed.some(function (x) { return pay3_same_(x, a[2]); })) return { error: '您不是這個櫃位的分隊長' };
  var dec = pay3_decisions_(); if (!dec[key]) return { error: '找不到這筆' };
  pay3_ss_().getSheetByName('出勤確認').deleteRow(dec[key].row);
  return { success: true };
}

function payHandler_(action, p) {
  if (!/^pay/.test(String(action || ''))) return null;
  p = p || {}; SCH_C_ = {};
  try {
    switch (action) {
      case 'payRecon':  return pay3_recon_(p);
      case 'payDecide': return pay3_decide_(p);
      case 'payUndo':   return pay3_undo_(p);
    }
  } catch (e) { return { error: e.message }; }
  return null;
}
