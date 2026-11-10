// ═══════════════════════════════════════════════
// 登入安全＋本月薪資概況 後端模組 v1（2026-11-10，v1.18 批次）
// 貼在「程式碼.gs」最底部（或新增一個 .gs 檔），再於 extHandler_ 的「第一行」加入：
//   var sec = secHandler_(action, p); if (sec) return sec;
// （要放在 pollHandler_、pwHandler_ 之前，才會接手 login 與 changePassword）
//
// 做了什麼：
// 1. 登入 login：密碼改存「加鹽雜湊」（h1$鹽$SHA-256），舊的明碼密碼第一次登入成功時自動換成雜湊。
//    同一支手機 10 分鐘內錯 5 次先鎖住。回傳的 user 物件與原本 loginUser 完全相同，
//    另外多兩個欄位：weakPw（密碼仍是生日預設值）、token（之後查薪資用的通行證，30 天有效）。
//    前端新版改用 POST 登入；舊版前端的 GET 登入仍可用（同一套驗證），等全員更新後可再關閉 GET。
// 2. 修改密碼 changePassword：驗證雜湊或明碼，新密碼一律存雜湊。
// 3. 管理員重設密碼：直接在〈夥伴資料〉密碼欄打明碼即可，該夥伴下次登入時會自動轉成雜湊。
// 4. getSalaryToDate：本月 1 日到「昨天」的實際薪資與獎金（只讀不寫，規則與 calcSalaryV2 相同）。
//    需要 token，只能查自己的。
// 第一次執行會自動在「指令碼屬性」建立 SEC_SECRET（簽 token 用），不需手動設定。
// ═══════════════════════════════════════════════

var SEC_FAIL_MAX = 5, SEC_FAIL_TTL = 600, SEC_TOKEN_DAYS = 30;

function secHandler_(action, p) {
  p = p || {};
  try {
    if (action === 'login')           return sec_login_(p);
    if (action === 'changePassword')  return sec_changePw_(p);
    if (action === 'getSalaryToDate') return sec_salaryToDate_(p);
  } catch (e) { return { error: '系統錯誤:' + e.message }; }
  return null;
}

// ── 雜湊工具 ──
function sec_hex_(bytes) {
  var s = '';
  for (var i = 0; i < bytes.length; i++) { var b = (bytes[i] + 256) % 256; s += (b < 16 ? '0' : '') + b.toString(16); }
  return s;
}
function sec_hash_(pw, salt) {
  return 'h1$' + salt + '$' + sec_hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + pw, Utilities.Charset.UTF_8));
}
function sec_newSalt_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 16); }
function sec_isHashed_(stored) { return /^h1\$[0-9a-f]+\$[0-9a-f]{64}$/.test(String(stored || '')); }
function sec_check_(pw, stored) {
  stored = String(stored || '').trim();
  if (!stored) return false;
  if (sec_isHashed_(stored)) return sec_hash_(pw, stored.split('$')[1]) === stored;
  return stored === pw;                                  // 舊的明碼（或管理員剛重設的）
}
// 生日 → 預設密碼 MMDD（〈夥伴資料〉E 欄，可能是 Date 或「85/06/07」「1996-06-07」等文字）
function sec_bdayPw_(b) {
  if (!b) return '';
  if (b instanceof Date || Object.prototype.toString.call(b) === '[object Date]') return Utilities.formatDate(b, 'Asia/Taipei', 'MMdd');
  var m = String(b).trim().split(/[\/\-\.年月日\s]+/).filter(String);
  if (m.length < 3) return '';
  return ('0' + parseInt(m[1], 10)).slice(-2) + ('0' + parseInt(m[2], 10)).slice(-2);
}
function sec_pwCol_(head) {
  for (var i = 0; i < head.length; i++) { var t = String(head[i]).trim(); if (t === '密碼' || t === '登入密碼') return i; }
  return 36;                                             // AK 欄（與原本 loginUser 相同）
}

// ── token：empId.到期日.簽章（HMAC-SHA256，金鑰放指令碼屬性）──
function sec_secret_() {
  var pr = PropertiesService.getScriptProperties(), k = pr.getProperty('SEC_SECRET');
  if (!k) { k = Utilities.getUuid() + Utilities.getUuid(); pr.setProperty('SEC_SECRET', k); }
  return k;
}
function sec_sign_(s) { return sec_hex_(Utilities.computeHmacSha256Signature(s, sec_secret_())).slice(0, 32); }
function sec_makeToken_(empId) {
  var exp = Date.now() + SEC_TOKEN_DAYS * 86400000, body = empId + '.' + exp;
  return body + '.' + sec_sign_(body);
}
function sec_verifyToken_(token, empId) {
  var a = String(token || '').split('.');
  if (a.length !== 3 || a[0] !== String(empId)) return false;
  if (Number(a[1]) < Date.now()) return false;
  return sec_sign_(a[0] + '.' + a[1]) === a[2];
}

// ── 登入 ──
function sec_login_(p) {
  var phone = String(p.phone || '').trim(), pw = String(p.password || '').trim();
  if (!phone || !pw) return { success: false, error: '請填入帳號與密碼' };
  var cache = CacheService.getScriptCache(), fk = 'lgfail_' + phone.replace(/\D/g, '');
  var fails = Number(cache.get(fk) || 0);
  if (fails >= SEC_FAIL_MAX) return { success: false, error: '嘗試次數過多，請 10 分鐘後再試，或聯絡門市總監' };

  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('夥伴資料');
  var data = sh.getDataRange().getValues(), pwC = sec_pwCol_(data[0]);
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (String(row[6] || '').trim() !== phone) continue;
    if (row[10]) continue;                                // 已離職
    var stored = String(row[pwC] || '').trim();
    if (!sec_check_(pw, stored)) continue;                // 同一支手機若有兩列，繼續找
    cache.remove(fk);
    if (!sec_isHashed_(stored)) {                         // 舊明碼 → 換成雜湊
      try {
        var lock = LockService.getScriptLock(); lock.waitLock(10000);
        try { var cell = sh.getRange(i + 1, pwC + 1); cell.setNumberFormat('@'); cell.setValue(sec_hash_(pw, sec_newSalt_())); }
        finally { lock.releaseLock(); }
      } catch (e) { /* 換不成功也讓他登入，下次再換 */ }
    }
    var bd = sec_bdayPw_(row[4]);
    return { success: true, user: {
      id: String(row[0]), name: String(row[1]), avatar: String(row[1]).slice(0, 1), role: parseInt(row[12]) || 1,
      position: String(row[11]), birthday: String(row[4]), hourly: parseFloat(row[13]) || 190, labor: parseFloat(row[21]) || 0,
      health: parseFloat(row[26]) || 0, noInsure: parseFloat(row[29]) || 0, skillLevel: parseFloat(row[32]) || 0,
      contribLevel: parseFloat(row[33]) || 0, longAge: parseFloat(row[34]) || 0, checkupExpiry: String(row[31] || ''),
      weakPw: !!bd && pw === bd,
      token: sec_makeToken_(String(row[0])) } };
  }
  cache.put(fk, String(fails + 1), SEC_FAIL_TTL);
  return { success: false, error: '帳號或密碼錯誤' };
}

// ── 修改密碼（取代 pw_change_；規則相同，改存雜湊）──
function sec_changePw_(p) {
  var empId = String(p.empId || '').trim(), oldPw = String(p.oldPassword || '').trim(), newPw = String(p.newPassword || '').trim();
  if (!empId || !oldPw || !newPw) return { error: '資料不完整' };
  if (newPw.length < 6 || newPw.length > 20 || /\s/.test(newPw)) return { error: '新密碼需為 6 到 20 個字元，且不可有空白' };
  if (newPw === oldPw) return { error: '新密碼不能與目前密碼相同' };
  var cache = CacheService.getScriptCache(), key = 'pwfail_' + empId, fails = Number(cache.get(key) || 0);
  if (fails >= SEC_FAIL_MAX) return { error: '嘗試次數過多，請 10 分鐘後再試，或聯絡門市總監' };

  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('夥伴資料');
    var v = sh.getDataRange().getValues(), pwC = sec_pwCol_(v[0]);
    for (var r = 1; r < v.length; r++) {
      if (String(v[r][0]).trim() !== empId) continue;
      if (!sec_check_(oldPw, v[r][pwC])) { cache.put(key, String(fails + 1), SEC_FAIL_TTL); return { error: '目前密碼不正確' }; }
      if (newPw === sec_bdayPw_(v[r][4])) return { error: '新密碼不能是生日，請換一組' };
      var cell = sh.getRange(r + 1, pwC + 1); cell.setNumberFormat('@'); cell.setValue(sec_hash_(newPw, sec_newSalt_()));
      cache.remove(key);
      return { success: true };
    }
    return { error: '找不到此帳號' };
  } finally { lock.releaseLock(); }
}

// ── 本月薪資概況（1 日～昨天，只讀）──
// 計算方式逐項對照 calcSalaryV2（最後一個版本）：打卡配對不扣午休、同日跨櫃累加後切加班段、
// 國定假日／颱風日 ×2、假日出勤獎金、每日業績獎金（≥門檻，單人×人數）、團體獎金（月換算 >門檻，依工時比例）、
// 技能／貢獻津貼（長青暫不計）、生日與三節（≥80 小時依級距，否則 200）、職務加給（薪資明細手填值）、勞健保。
function sec_salaryToDate_(p) {
  var empId = String(p.empId || '').trim();
  if (!sec_verifyToken_(p.token, empId)) return { error: '請重新登入後再查看', relogin: true };

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
  var ym = today.slice(0, 7), targetMonth = parseInt(ym.slice(5), 10);
  var y = new Date(new Date(today + 'T00:00:00+08:00').getTime() - 86400000);
  var asOf = Utilities.formatDate(y, 'Asia/Taipei', 'yyyy-MM-dd');
  var base = { success: true, ym: ym, asOf: asOf, hours: { normal: 0, holiday: 0, total: 0 }, days: [], items: [], deductions: [], gross: 0, net: 0, notes: [] };
  if (asOf.slice(0, 7) !== ym) { base.notes.push('今天是本月第一天，明天起就會看到本月的累計。'); return base; }

  var P = getParams(), cal = getCalendar(), locs = getLocations();
  var wage = P['基準時薪'] || 196;
  var staff = ss.getSheetByName('夥伴資料').getDataRange().getValues();
  var emp = null;
  for (var si = 1; si < staff.length; si++) if (String(staff[si][0]) === empId) { emp = staff[si]; break; }
  if (!emp) return { error: '找不到夥伴資料' };
  var punch = ss.getSheetByName('打卡紀錄').getDataRange().getValues();
  var closeS = ss.getSheetByName('收店盤點').getDataRange().getValues();
  var cum = ss.getSheetByName('累計工時').getDataRange().getValues();
  var FEST = [1, 6, 9];

  // 1. 打卡配對（全員，算同櫃同日人數與工時比例用）
  var sessions = {};
  for (var i = 1; i < punch.length; i++) {
    var r = punch[i], eid = String(r[2]); if (!eid) continue;
    var flag = String(r[16] || '');
    if (flag.indexOf('異常未下班') >= 0 && flag.indexOf('已由管理員補登') < 0) continue;
    var t = r[6] ? new Date(r[6]) : null; if (!t || isNaN(t)) continue;
    var d = Utilities.formatDate(t, 'Asia/Taipei', 'yyyy-MM-dd');
    if (d.slice(0, 7) !== ym || d > asOf) continue;
    var key = eid + '_' + d + '_' + String(r[9] || '');
    if (!sessions[key]) sessions[key] = { empId: eid, date: d, loc: String(r[9] || ''), hrs: 0, first: t, segs: [] };
    sessions[key].segs.push({ type: String(r[5]), time: t });
    if (t < sessions[key].first) sessions[key].first = t;
  }
  var locDayHours = {}, locDayCount = {}, locMonthHours = {}, empLocHours = {};
  Object.keys(sessions).forEach(function (k) {
    var s = sessions[k];
    s.segs.sort(function (a, b) { return a.time - b.time; });
    var inT = null;
    s.segs.forEach(function (sg) {
      if (sg.type === '上班') inT = sg.time;
      else if (sg.type === '下班' && inT) { s.hrs += Math.max(0, (sg.time - inT) / 3600000); inT = null; }
    });
    if (!s.hrs) return;
    var dk = s.date + '_' + s.loc;
    locDayHours[dk] = (locDayHours[dk] || 0) + s.hrs;
    locDayCount[dk] = (locDayCount[dk] || 0) + 1;
    locMonthHours[s.loc] = (locMonthHours[s.loc] || 0) + s.hrs;
    empLocHours[s.empId + '_' + s.loc] = (empLocHours[s.empId + '_' + s.loc] || 0) + s.hrs;
  });

  // 2. 每日業績
  var calcRev = function (loc, rev) {
    var lc = locs[loc] || {};
    if (lc.type === 'A百貨') return rev * 0.8;
    if (lc.type === 'C份數') return rev * (lc.unitPrice || P['C類預設抽成'] || 70);
    return rev;
  };
  var dayRevenue = {};
  for (var c = 1; c < closeS.length; c++) {
    if (!closeS[c][1]) continue;
    var cd = Utilities.formatDate(new Date(closeS[c][1]), 'Asia/Taipei', 'yyyy-MM-dd');
    if (cd.slice(0, 7) !== ym || cd > asOf) continue;
    var tot = closeS[c][30] !== '' && closeS[c][30] !== undefined ? parseFloat(closeS[c][30]) : parseFloat(closeS[c][16]) || 0;
    dayRevenue[cd + '_' + String(closeS[c][5])] = tot || 0;
  }

  // 3. 團體獎金池（目前為止的月換算）
  var locRev = {}, locDays = {};
  Object.keys(dayRevenue).forEach(function (k) {
    var loc = k.slice(11), cv = calcRev(loc, dayRevenue[k]);
    if (!cv) return;
    locRev[loc] = (locRev[loc] || 0) + cv; locDays[loc] = (locDays[loc] || 0) + 1;
  });
  var groupPool = {}, groupEq = {};
  Object.keys(locRev).forEach(function (loc) {
    var eq = locRev[loc] / locDays[loc] * 30; groupEq[loc] = eq;
    if (eq > (P['團體獎金門檻'] || 200000)) groupPool[loc] = locRev[loc] * 0.01;
  });

  // 4. 本人
  var home = String(emp[38] || ''), birthday = emp[4] ? new Date(emp[4]) : null;
  var laborSt = String(emp[41] || '公司投保'), healthSt = String(emp[42] || '公司投保'), deps = parseInt(emp[27]) || 0;
  var cumHrs = 0;
  for (var ci = cum.length - 1; ci >= 1; ci--) if (String(cum[ci][0]) === empId) { cumHrs = parseFloat(cum[ci][6]) || 0; break; }

  var mine = Object.keys(sessions).map(function (k) { return sessions[k]; }).filter(function (s) { return s.empId === empId && s.hrs; });
  var basic = 0, ot1 = 0, ot2 = 0, ot3 = 0, dblPay = 0, holBonus = 0, perfBonus = 0, group = 0, normalH = 0, holH = 0;
  var locSet = {}, perfAwarded = {}, dayRows = {};
  var byDay = {};
  mine.forEach(function (s) { (byDay[s.date] = byDay[s.date] || []).push(s); });
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
      var row = { date: s.date, loc: s.loc, hrs: Math.round(h * 100) / 100, dayType: dt, pay: 0, holBonus: 0, perf: 0, rev: null };
      if (dt === '國定假日' || dt === '颱風日') { dblPay += b + o1 + o2 + o3; holH += h; row.pay = (b + o1 + o2 + o3) * 2; }
      else { basic += b; ot1 += o1; ot2 += o2; ot3 += o3; normalH += h; row.pay = b + o1 + o2 + o3; }
      if (dt === '假日' || dt === '連假日' || (lc.kind === '活動' && dt === '平日')) {
        var totH = locDayHours[s.date + '_' + s.loc] || h;
        var hb = CEIL((P['假日出勤獎金'] || 500) / totH * h); holBonus += hb; row.holBonus = hb;
      }
      var ak = s.date + '_' + s.loc;
      if (!perfAwarded[ak]) {
        var rev = dayRevenue[ak];
        if (rev !== undefined) {
          var cv = calcRev(s.loc, rev), th = perfBonusTable(locDayCount[ak] || 1, P), pb = 0;
          if (cv >= th[2]) pb = 1000; else if (cv >= th[1]) pb = 700; else if (cv >= th[0]) pb = 500;
          perfBonus += pb; row.perf = pb; row.rev = Math.round(cv); row.next = pb >= 1000 ? 0 : Math.ceil((pb >= 700 ? th[2] : pb >= 500 ? th[1] : th[0]) - cv);
        }
        perfAwarded[ak] = 1;
      }
      row.pay = CEIL(row.pay);
      dayRows[s.date + '_' + s.loc] = row;
    });
  });
  var groupNotes = [];
  Object.keys(locSet).forEach(function (loc) {
    if (groupPool[loc] && locMonthHours[loc]) group += groupPool[loc] * (empLocHours[empId + '_' + loc] || 0) / locMonthHours[loc];
    else if (groupEq[loc]) groupNotes.push(loc + ' 月換算業績目前約 ' + Math.round(groupEq[loc]).toLocaleString() + '，超過 ' + (P['團體獎金門檻'] || 200000).toLocaleString() + ' 才有團體獎金');
  });

  var totalH = normalH + holH;
  basic = CEIL(basic); ot1 = CEIL(ot1); ot2 = CEIL(ot2); ot3 = CEIL(ot3); dblPay = CEIL(dblPay * 2); group = CEIL(group);
  var skill = cumHrs > 180 ? CEIL(totalH * 20) : 0;
  var cl = cumHrs > 4320 ? 20 : cumHrs > 3240 ? 15 : cumHrs > 2160 ? 10 : cumHrs > 1080 ? 5 : 0;
  var contrib = CEIL(totalH * cl);
  // 長青津貼：規格書寫「暫不計算」，而且生日欄是民國年（67/11/07 會被當成 1967 年），這裡先不算
  var evergreen = 0;
  var tier = cumHrs > 4320 ? 2400 : cumHrs > 2160 ? 1200 : 600;
  var isBdayMonth = !!(birthday && !isNaN(birthday) && birthday.getMonth() + 1 === targetMonth), isFest = FEST.indexOf(targetMonth) >= 0;
  var bday = isBdayMonth ? (totalH >= 80 ? tier : 200) : 0, fest = isFest ? (totalH >= 80 ? tier : 200) : 0;

  var salEx = ss.getSheetByName('薪資明細').getDataRange().getValues(), duty = 0;
  for (var k = 1; k < salEx.length; k++) if (String(salEx[k][2]) === empId && ymNorm(salEx[k][1]) === ym) { duty = parseFloat(salEx[k][21]) || 0; break; }

  var laborDed = 0, healthDed = 0, insAdd = 0;
  try {
    if (laborSt === '公司投保') laborDed = parseFloat(emp[21]) || 0;
    else insAdd += CEIL(parseFloat(getInsuranceRow(ss, empId, '勞保級距表')[3]) || 0);
    if (healthSt === '公司投保') healthDed = (parseFloat(emp[26]) || 0) * (1 + Math.min(deps, 3));
    else if (healthSt === '無投保') insAdd += CEIL(parseFloat(getInsuranceRow(ss, empId, '健保級距表')[3]) || 0);
  } catch (e) { /* 級距表讀不到就先略過 */ }
  var fee = parseFloat(emp[17]) || 0;

  var it = function (key, label, amt, note) { if (amt || note) base.items.push({ key: key, label: label, amt: amt || 0, note: note || '' }); };
  it('basic', '基本工資', basic, Math.round(normalH * 10) / 10 + ' 小時 × $' + wage);
  it('ot', '加班費', ot1 + ot2 + ot3, (ot1 + ot2 + ot3) ? '第 9 小時起 ×1.33／×1.67／×2' : '');
  it('dbl', '國定假日／颱風日加倍', dblPay, dblPay ? Math.round(holH * 10) / 10 + ' 小時，工資 ×2' : '');
  it('perf', '每日業績獎金', perfBonus, '');
  it('hol', '假日出勤獎金', holBonus, '');
  it('group', '團體獎金（預估）', group, group ? '依目前業績預估，月底結算為準' : '');
  it('skill', '技能津貼', skill, skill ? '每小時 +$20' : '');
  it('contrib', '貢獻津貼', contrib, contrib ? '每小時 +$' + cl : '');
  it('ever', '長青津貼', evergreen, '');
  if (isBdayMonth) it('bday', '生日津貼', bday, totalH >= 80 ? '本月已滿 80 小時' : '目前 ' + Math.round(totalH) + ' 小時，滿 80 小時可領 $' + tier);
  if (isFest) it('fest', '三節津貼', fest, totalH >= 80 ? '本月已滿 80 小時' : '目前 ' + Math.round(totalH) + ' 小時，滿 80 小時可領 $' + tier);
  it('duty', '職務加給', duty, '');
  it('ins', '勞健保補貼', insAdd, '');
  base.gross = base.items.reduce(function (s, x) { return s + x.amt; }, 0);
  if (laborDed) base.deductions.push({ label: '勞保自付', amt: laborDed });
  if (healthDed) base.deductions.push({ label: '健保自付' + (deps ? '（含眷屬 ' + Math.min(deps, 3) + ' 人）' : ''), amt: healthDed });
  if (fee) base.deductions.push({ label: '已預支', amt: fee });
  base.net = base.gross - base.deductions.reduce(function (s, x) { return s + x.amt; }, 0);
  base.hours = { normal: Math.round(normalH * 10) / 10, holiday: Math.round(holH * 10) / 10, total: Math.round(totalH * 10) / 10 };
  base.days = Object.keys(dayRows).sort().map(function (k) { return dayRows[k]; });
  base.cumHrs = cumHrs;
  base.notes = groupNotes.concat(['只算到昨天、以打卡與收店業績為準；勞健保是整月金額。正式薪資以月底結算的薪資單為準。']);
  return base;
}
