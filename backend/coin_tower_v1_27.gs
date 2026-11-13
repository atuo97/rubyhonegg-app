// ═══════════════════════════════════════════════
// v1.27 赤心幣加倍規則＋塔防新積分＋樂園「赤心幣規則」＋首頁「今天要處理」（2026-11-13）
// 貼在「食安SOP v1.26」之後、「路由v1.27」之前。部署後執行一次 gm27_setup()
// 1. 工時幣：每小時 1 枚 × 階層加成（Lv.1～5：1／1.2／1.3／1.4／1.5）× 每一個符合的加倍事件（全部相乘）
//    事件：生日當月 ×2、活動場次 ×2、春節 ×3、國定假日 ×2、颱風日 ×2、接班／代班 ×1.5、到職週年當月 ×1.5、
//          品牌週年日 ×2、帶新人 ×1.2、管理者手動加倍活動（〈加倍活動〉表：颱風照常營業、開幕、旺季…）
//    全勤之星 +50（原本就有）；食安確實 +30（當月上下班冰箱溫度、儀容都有填，每月 1 日結算）
// 2. 塔防：本週積分＝營業額 1 元 1 分＋捐獻 1 枚 100 分；每週一結算；累積總分每 50 萬分升 1 級（只升不降）；
//    捐獻要自己選櫃位（最近 30 天上過班的百貨櫃位）
// 覆蓋：gm_payHours_、td_myCounter_、td_simulate_、td_weekly_、td_me_、td_give_
// ═══════════════════════════════════════════════

var GM27_PARAMS = [
  ['生日月工時倍率', 2, '壽星生日所在月份的工時加倍'],
  ['春節工時倍率', 3, '春節期間上班的工時倍率'],
  ['春節期間', '2027-02-05~2027-02-10', '除夕～初五，格式 yyyy-MM-dd~yyyy-MM-dd，多段用逗號分隔'],
  ['國定假日工時倍率', 2, '〈行事曆設定〉國定假日上班'],
  ['颱風日工時倍率', 2, '〈行事曆設定〉颱風日照常營業'],
  ['代班工時倍率', 1.5, '接別人轉讓、釋出的班或開放空班（已核准）'],
  ['到職週年工時倍率', 1.5, '到職滿 1 年起，每年到職月份'],
  ['品牌週年工時倍率', 2, '品牌週年日當天'],
  ['帶新人工時倍率', 1.2, '和到職未滿「新人天數」的夥伴同一天同櫃位上班'],
  ['新人天數', 30, ''],
  ['食安確實獎勵', 30, '當月上下班冰箱溫度、儀容勾選全部完成，每月 1 日結算上月'],
  ['塔防營業額積分倍率', 1, '本週營業額 1 元＝幾分'],
  ['塔防捐獻積分倍率', 100, '捐 1 枚赤心幣＝幾分'],
  ['塔防升級分數', 500000, '累積總分每多少分升 1 級']
];
GM27_PARAMS.forEach(function (p) { GM_PARAM_DEFAULTS.push(p); });
var GM27_ROLE = { 1: 1, 2: 1.2, 3: 1.3, 4: 1.4, 5: 1.5 };
var GM27_BOOST_HEAD = ['名稱', '開始日', '結束日', '櫃位', '倍率', '建立人', '建立時間'];

function gm27_n_(name, def) { var v = Number(gm_param_(name)); return isFinite(v) && v > 0 ? v : def; }
function gm27_roleMult_(role) { var r = Math.min(5, Math.max(1, Number(role) || 1)); return gm27_n_('工時倍率_' + r, GM27_ROLE[r]); }
function gm27_ymd_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Taipei', 'yyyy-MM-dd');
  var s = String(v || '').trim(); if (!s) return '';
  var p = s.split(/[\/\-.]/); if (p.length < 3) return '';
  var y = Number(p[0]); if (y < 1911) y += 1911;
  return y + '-' + ('0' + Number(p[1])).slice(-2) + '-' + ('0' + Number(p[2])).slice(-2);
}
function gm27_ranges_(s) {
  return String(s || '').split(/[,，]/).map(function (x) { var a = x.split(/[~～]/); return { from: gm27_ymd_(a[0]), to: gm27_ymd_(a[1] || a[0]) }; }).filter(function (r) { return r.from; });
}
function gm27_boostSheet_() {
  var ss = gm_ss_(), sh = ss.getSheetByName('加倍活動');
  if (!sh) { sh = ss.insertSheet('加倍活動'); sh.getRange(1, 1, 1, GM27_BOOST_HEAD.length).setValues([GM27_BOOST_HEAD]); sh.setFrozenRows(1); }
  return sh;
}
function gm27_boosts_() {
  if (GM_CACHE_.boosts) return GM_CACHE_.boosts;
  var sh = gm27_boostSheet_(), out = [];
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, GM27_BOOST_HEAD.length).getValues().forEach(function (r, i) {
    var from = gm27_ymd_(r[1]), m = Number(r[4]); if (!String(r[0]).trim() || !from || !(m > 0)) return;
    out.push({ row: i + 2, name: String(r[0]).trim(), from: from, to: gm27_ymd_(r[2]) || from, loc: String(r[3] || '').trim(), mult: m, by: String(r[5] || '') });
  });
  return (GM_CACHE_.boosts = out);
}

// 準備：判斷加倍事件需要的資料（一次讀完）
function gm27_ctx_() {
  if (GM_CACHE_.g27) return GM_CACHE_.g27;
  var emps = gm_emps_(), act = gm_activityLocs_(), cal = {}, swaps = {}, newbies = {}, byDateLoc = {};
  try {
    var sh = gm_ss_().getSheetByName('行事曆設定');
    if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) {
      var d = gm27_ymd_(r[0]), ty = String(r[1]); if (!d) return;
      if (/颱風/.test(ty)) cal[d] = '颱風'; else if (/國定/.test(ty) && cal[d] !== '颱風') cal[d] = '國定';
    });
  } catch (e) {}
  try { if (typeof sch_reqs_ === 'function') sch_reqs_().forEach(function (q) { if (q.status === '已核准' && q.toId) swaps[q.toId + '|' + q.date] = 1; }); } catch (e) {}
  var nd = gm27_n_('新人天數', 30);
  Object.keys(emps).forEach(function (id) { var s = gm27_ymd_(emps[id].start); if (s) newbies[id] = s; });
  gm_rows_('hours').forEach(function (r) { var k = String(r[0]) + '|' + r[2]; (byDateLoc[k] = byDateLoc[k] || []).push(String(r[1])); });
  return (GM_CACHE_.g27 = { emps: emps, act: act, cal: cal, swaps: swaps, newbies: newbies, newDays: nd, byDateLoc: byDateLoc,
    spring: gm27_ranges_(gm_param_('春節期間')), brand: String(gm_param_('品牌週年日') || '').trim(), boosts: gm27_boosts_() });
}
function gm27_isNew_(X, id, date) {
  var s = X.newbies[id]; if (!s || s > date) return false;
  return (new Date(date + 'T00:00:00Z') - new Date(s + 'T00:00:00Z')) / 86400000 < X.newDays;
}
// 某人某天某櫃位符合哪些加倍事件 → [{k, name, m}]
function gm27_events_(emp, date, loc, X) {
  X = X || gm27_ctx_();
  var e = X.emps[emp] || {}, out = [], md = date.slice(5), mm = date.slice(5, 7);
  var bd = e.birthday ? gm_bdMD_(e.birthday) : '';
  if (bd && bd.slice(0, 2) === mm) out.push({ k: 'bday', name: '🎂 生日月', m: gm27_n_('生日月工時倍率', 2) });
  if (loc && (X.act[loc] || /^00|^66/.test(loc))) out.push({ k: 'act', name: '🎪 活動場次', m: gm27_n_('活動工時倍率', 2) });
  if (X.spring.some(function (r) { return date >= r.from && date <= r.to; })) out.push({ k: 'spring', name: '🧧 春節', m: gm27_n_('春節工時倍率', 3) });
  if (X.cal[date] === '國定') out.push({ k: 'holiday', name: '🎌 國定假日', m: gm27_n_('國定假日工時倍率', 2) });
  if (X.cal[date] === '颱風') out.push({ k: 'typhoon', name: '🌀 颱風日', m: gm27_n_('颱風日工時倍率', 2) });
  if (X.swaps[emp + '|' + date]) out.push({ k: 'swap', name: '🙋 代班', m: gm27_n_('代班工時倍率', 1.5) });
  var st = X.newbies[emp];
  if (st && st.slice(5, 7) === mm && st.slice(0, 4) < date.slice(0, 4)) out.push({ k: 'anniv', name: '🎉 到職週年月', m: gm27_n_('到職週年工時倍率', 1.5) });
  if (X.brand && X.brand.slice(-5) === md) out.push({ k: 'brand', name: '🔴 品牌週年日', m: gm27_n_('品牌週年工時倍率', 2) });
  if (loc && !gm27_isNew_(X, emp, date) && (X.byDateLoc[date + '|' + loc] || []).some(function (o) { return o !== emp && gm27_isNew_(X, o, date); }))
    out.push({ k: 'mentor', name: '👩‍🏫 帶新人', m: gm27_n_('帶新人工時倍率', 1.2) });
  X.boosts.forEach(function (b, i) {
    if (date >= b.from && date <= b.to && (!b.loc || b.loc === loc || (loc && loc.replace(/^\d+/, '').indexOf(b.loc.replace(/^\d+/, '')) >= 0)))
      out.push({ k: 'boost' + i, name: '⚡ ' + b.name, m: b.mult });
  });
  return out;
}
function gm27_mult_(ev) { return ev.reduce(function (a, x) { return a * x.m; }, 1); }

// 工時幣（覆蓋）：分鐘 × 事件倍率相乘 × 階層加成 ÷ 60，累計後補發差額（不倒扣）
function gm_payHours_(runDate) {
  var start = gm_param_('測試版開始日'), X = gm27_ctx_(), w = {}, yday = gm_addDays_(runDate, -1), note = {};
  gm_rows_('hours').forEach(function (r) {
    var d = String(r[0]); if (d < start) return;
    var emp = String(r[1]), loc = String(r[2]), min = Number(r[3]) || 0, ev = gm27_events_(emp, d, loc, X);
    w[emp] = (w[emp] || 0) + min * gm27_mult_(ev);
    if (d === yday) (note[emp] = note[emp] || []).push({ loc: loc, min: min, ev: ev });
  });
  var paid = {};
  gm_rows_('ledger').forEach(function (r) { if (r[2] === '工時') paid[r[1]] = (paid[r[1]] || 0) + (Number(r[3]) || 0); });
  Object.keys(w).forEach(function (emp) {
    var e = gm_emp_(emp); if (!e || e.resigned) return;
    var rm = gm27_roleMult_(e.role), due = Math.floor(w[emp] * rm / 60), diff = due - (paid[emp] || 0);
    if (diff <= 0) return;
    var parts = (note[emp] || []).map(function (x) {
      return Math.round(x.min / 6) / 10 + 'h' + (rm !== 1 ? ' × Lv.' + e.role + ' ' + rm : '') + x.ev.map(function (v) { return ' × ' + v.name + ' ' + v.m; }).join('');
    });
    gm_credit_(emp, '工時', diff, '工時結算至 ' + yday + (parts.length ? '：' + parts.join('；') : ''), 'HOURS|' + emp + '|' + runDate);
  });
  try { gm27_monthly_(runDate); } catch (e) {}
}

// 每月 1 日：食安確實獎勵（上月每次上班都有填冰箱溫度＋儀容 4 項、每次下班都有填冰箱溫度）
function gm27_monthly_(runDate) {
  var ym = gm_prevMonth_(runDate.slice(0, 7)); if (runDate.slice(8) > '07') return;   // 1～7 日內補跑
  var fs = gm_ss_().getSheetByName('食安紀錄'); if (!fs || fs.getLastRow() < 2) return;
  if (ym < String(gm_param_('測試版開始日')).slice(0, 7)) return;
  var have = {};
  fs.getRange(2, 1, fs.getLastRow() - 1, 10).getValues().forEach(function (r) {
    var d = String(r[2]).slice(0, 10); if (d.slice(0, 7) !== ym) return;
    var groom = []; try { groom = JSON.parse(r[9] || '[]'); } catch (e) {}
    var ok = String(r[6]) === '下班' || groom.length >= 4, k = r[4] + '|' + d + '|' + r[6];
    have[k] = (have[k] || 0) + (ok ? 1 : 0);
  });
  var need = {}, fsStart = String(gm_getState_('食安開始日') || '');
  gm_punchRows_().forEach(function (p) {
    if (p.date.slice(0, 7) !== ym || (fsStart && p.date < fsStart) || (p.type !== '上班' && p.type !== '下班')) return;
    var k = p.emp + '|' + p.date + '|' + p.type; need[k] = (need[k] || 0) + 1;
  });
  var byEmp = {};
  Object.keys(need).forEach(function (k) { var emp = k.split('|')[0]; if (byEmp[emp] === false) return; byEmp[emp] = (have[k] || 0) >= need[k]; });
  var amt = gm27_n_('食安確實獎勵', 30);
  Object.keys(byEmp).forEach(function (emp) { if (byEmp[emp] && !gm_isFrozen_(emp)) gm_credit_(emp, '食安確實', amt, ym + ' 冰箱溫度、儀容都確實填寫', 'FSOK|' + emp + '|' + ym); });
}

// ── 塔防（覆蓋）──
function td_myCounters_(emp) {     // 最近 30 天上過班的百貨櫃位（時數多的在前）
  var list = td_counters_(), since = gm_addDays_(gm_today_(), -30), m = {};
  gm_rows_('hours').forEach(function (r) { if (r[1] === emp && String(r[0]) >= since && list.indexOf(r[2]) >= 0) m[r[2]] = (m[r[2]] || 0) + (Number(r[3]) || 0); });
  return Object.keys(m).sort(function (a, b) { return m[b] - m[a]; });
}
function td_myCounter_(emp) { return td_myCounters_(emp)[0] || ''; }
function td_gives_(loc, from, to) {
  var s = 0; pv_rows_('tdGive').forEach(function (r) {
    var d = gm_dstr_(r[0]) || String(r[0]).slice(0, 10);
    if (String(r[2]) === loc && (!from || d >= from) && (!to || d <= to)) s += Number(r[4]) || 0;
  }); return s;
}
function td_score_(loc, from, to) {
  var rev = td_revenue_(loc, from, to), give = td_gives_(loc, from, to);
  var rs = Math.round(rev * pv_param_('塔防營業額積分倍率')), gs = Math.round(give * pv_param_('塔防捐獻積分倍率'));
  return { rev: rev, give: give, revScore: rs, giveScore: gs, score: rs + gs };
}
function td_level_(loc, upto) {
  var t = td_score_(loc, gm_param_('測試版開始日'), upto), step = pv_param_('塔防升級分數') || 500000;
  var lv = Math.floor(t.score / step) + 1;
  return { total: t.score, level: lv, toNext: lv * step - t.score, step: step };
}
function td_simulate_(from, to) {        // 輸贏以本週積分為準；動畫戰力由積分換算
  var teams = td_counters_().map(function (l) {
    var sc = td_score_(l, from, to), T = td_tower_(l);
    return { loc: l, sc: sc, rev: sc.score, T: T, p: { atk: 20 + Math.floor(sc.score / 2000), def: 10 + T.wall * 2, hp: 1000 + Math.floor(sc.score / 200) } };
  }).sort(function (a, b) { return b.sc.score - a.sc.score; });
  var matches = [];
  for (var i = 0; i < teams.length; i++) for (var j = i + 1; j < teams.length; j++) {
    var res = td_battle_(teams[i], teams[j], gm_hash_(from + teams[i].loc + teams[j].loc) % 100000);
    var win = teams[i].sc.score === teams[j].sc.score ? (res.winner === 'A' ? teams[i] : teams[j]) : teams[i];   // 積分高的贏
    matches.push({ a: teams[i].loc, b: teams[j].loc, winner: win.loc, waves: res.waves, hpA: teams[i].p.hp, hpB: teams[j].p.hp });
  }
  var standings = teams.map(function (t, k) {
    var lv = td_level_(t.loc, to);
    return { loc: t.loc, rank: k + 1, score: t.sc.score, revScore: t.sc.revScore, giveScore: t.sc.giveScore, rev: t.sc.rev, give: t.sc.give, level: lv.level, total: lv.total, toNext: lv.toNext, pts: t.sc.score };
  });
  return { standings: standings, matches: matches };
}
function td_weekly_(today) {
  if (((new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7) !== 0) return;
  var last = td_weekRange_(gm_addDays_(today, -1)), key = last.from;
  if (gm_getState_('塔防已結算') === key || last.to < gm_param_('測試版開始日')) return;
  var R = td_simulate_(last.from, last.to);
  R.matches.forEach(function (m) { pv_append_('tdLog', [[key, m.a, m.b, m.winner, JSON.stringify(m.waves)]]); });
  if (R.standings.length && R.standings[0].score > 0) {
    var champ = R.standings[0].loc, mins = {}, tot = 0, pool = pv_param_('塔防冠軍獎勵');
    gm_rows_('hours').forEach(function (r) { if (r[2] === champ && String(r[0]) >= last.from && String(r[0]) <= last.to) { mins[r[1]] = (mins[r[1]] || 0) + (Number(r[3]) || 0); tot += Number(r[3]) || 0; } });
    if (tot) Object.keys(mins).forEach(function (emp) { if (!gm_isFrozen_(emp)) gm_credit_(emp, '塔防冠軍', Math.round(pool * mins[emp] / tot), key + ' 週塔防冠軍 ' + champ + '（' + R.standings[0].score + ' 分）', 'TDCHAMP|' + emp + '|' + key); });
    gm_setState_('塔防冠軍_' + key, champ);
    gm_setState_('塔防戰報_' + key, JSON.stringify(R.standings.map(function (s) { return [s.loc, s.score, s.revScore, s.giveScore]; })));
  }
  gm_setState_('塔防已結算', key);
}
function td_me_(p) {
  var emp = String(p.empId || '').trim(); if (!gm_emp_(emp)) return { error: '找不到此帳號' };
  var today = gm_today_(), wk = td_weekRange_(today), mine = td_myCounters_(emp);
  var live = td_simulate_(wk.from, today);
  var last = td_weekRange_(gm_addDays_(wk.from, -1)), logs = pv_rows_('tdLog').filter(function (r) { return String(r[0]) === last.from; })
    .map(function (r) { return { a: r[1], b: r[2], winner: r[3], waves: pv_json_(r[4], []) }; });
  var lastBoard = []; try { lastBoard = JSON.parse(gm_getState_('塔防戰報_' + last.from) || '[]').map(function (x) { return { loc: x[0], score: x[1], revScore: x[2], giveScore: x[3] }; }); } catch (e) {}
  return { success: true, data: { myCounters: mine, myCounter: mine[0] || '', week: wk, standings: live.standings, preview: live.matches,
    lastWeek: { from: last.from, champion: gm_getState_('塔防冠軍_' + last.from), matches: logs, board: lastBoard },
    rule: { rev: pv_param_('塔防營業額積分倍率'), give: pv_param_('塔防捐獻積分倍率'), step: pv_param_('塔防升級分數'), pool: pv_param_('塔防冠軍獎勵') },
    balance: gm_balance_(emp) } };
}
function td_give_(p) {
  var emp = String(p.empId || '').trim(), amt = Math.floor(Number(p.amount) || 0);
  if (!gm_emp_(emp) || gm_isFrozen_(emp)) return { error: '帳號無法使用' };
  var mine = td_myCounters_(emp); if (!mine.length) return { error: '最近 30 天沒有在百貨櫃位上班，無法捐獻' };
  var loc = String(p.loc || '').trim() || mine[0];
  if (mine.indexOf(loc) < 0) return { error: '只能捐給最近 30 天上過班的百貨櫃位' };
  var minAmt = Number(gm_param_('捐獻最低')) || 10;
  if (amt < minAmt) return { error: '一次至少捐 ' + minAmt + ' 枚' };
  if (gm_balance_(emp) < amt) return { error: '赤心幣不足' };
  var kind = ['arrow', 'cannon', 'wall'].indexOf(String(p.tower)) >= 0 ? String(p.tower) : 'arrow';
  var T = td_tower_(loc); T[kind] = (T[kind] || 1); T.total += amt;
  gm_credit_(emp, '塔防捐獻', -amt, '捐給 ' + loc + '（+' + amt * pv_param_('塔防捐獻積分倍率') + ' 分）', 'TDGIVE|' + emp + '|' + gm_now_() + '|' + Math.random());
  pv_append_('tdGive', [[gm_now_(), emp, loc, kind, amt]]);
  var row = [loc, T.arrow, T.cannon, T.wall, T.total];
  if (T.row) { var rng = pv_sh_('towers').getRange(T.row, 1, 1, 5); rng.setNumberFormat('@'); rng.setValues([row]); GM_CACHE_.rows_pv_towers = null; } else pv_append_('towers', [row]);
  GM_CACHE_.rows_pv_tdGive = null;
  var wk = td_weekRange_(gm_today_()), sc = td_score_(loc, wk.from, gm_today_());
  return { success: true, data: { loc: loc, added: amt * pv_param_('塔防捐獻積分倍率'), score: sc.score, balance: gm_balance_(emp) } };
}

// ── 樂園：赤心幣規則（含「你現在套用中」）──
function gm27_rules_(p) {
  var emp = String(p.empId || '').trim(), e = gm_emp_(emp); if (!e) return { error: '找不到此帳號' };
  var today = gm_today_(), X = gm27_ctx_(), loc = String(p.loc || '');
  var mine = gm27_events_(emp, today, loc, X).filter(function (x) { return x.k !== 'act' || loc; });
  var month = []; var bd = e.birthday ? gm_bdMD_(e.birthday) : '';
  var boostsNow = X.boosts.filter(function (b) { return b.to >= today; }).map(function (b) { return { name: b.name, from: b.from, to: b.to, loc: b.loc, mult: b.mult }; });
  var events = [
    ['🎂 生日當月', '生日月工時倍率', '自動：生日那個月的所有工時'],
    ['🎪 活動場次', '活動工時倍率', '自動：在活動場次上班'],
    ['🧧 春節', '春節工時倍率', '自動：' + (String(gm_param_('春節期間') || '').replace(/~/g, '～') || '除夕～初五')],
    ['🎌 國定假日', '國定假日工時倍率', '自動：行事曆的國定假日'],
    ['🌀 颱風日', '颱風日工時倍率', '自動：行事曆的颱風日照常營業'],
    ['🙋 代班', '代班工時倍率', '自動：接別人釋出的班或開放空班（已核准）'],
    ['🎉 到職週年月', '到職週年工時倍率', '自動：到職滿 1 年起，每年到職的那個月'],
    ['🔴 品牌週年日', '品牌週年工時倍率', '自動：' + (String(gm_param_('品牌週年日') || '').replace('-', '/') || '（日期待公布）')],
    ['👩‍🏫 帶新人', '帶新人工時倍率', '自動：和到職未滿 ' + gm27_n_('新人天數', 30) + ' 天的夥伴同一天同櫃位上班']
  ].map(function (x) { return { name: x[0], mult: gm27_n_(x[1], 1), how: x[2] }; });
  var roles = [1, 2, 3, 4, 5].map(function (r) { return { role: r, mult: gm27_roleMult_(r) }; });
  var badges = (typeof GM_BADGES !== 'undefined' ? GM_BADGES : []).filter(function (b) { return Number(b[4]) > 0; }).map(function (b) { return { name: b[1], icon: b[2], how: b[3], coins: Number(b[4]) }; });
  return { success: true, data: {
    me: { role: e.role, roleMult: gm27_roleMult_(e.role), now: mine.map(function (x) { return { name: x.name, mult: x.m }; }), bdayMonth: bd ? Number(bd.slice(0, 2)) : 0 },
    roles: roles, events: events, boosts: boostsNow,
    once: [
      { name: '📝 每日一題答對', coins: gm27_n_('每日一題獎勵', 1), how: '每天一題；連續答對 7 天再 +' + gm27_n_('連續答對7天加碼', 5) },
      { name: '⭐ 全勤之星', coins: 50, how: '當月排班全部出勤、沒有遲到' },
      { name: '🧊 食安確實', coins: gm27_n_('食安確實獎勵', 30), how: '當月每次上下班都有填冰箱溫度、上班都有勾儀容' },
      { name: '🎂 生日', coins: gm27_n_('壽星獎勵', 30), how: '生日當天' },
      { name: '💌 送生日祝福', coins: gm27_n_('送祝福獎勵', 1), how: '每天最多 3 次' },
      { name: '🌟 本月互動之星', coins: gm27_n_('互動之星獎勵', 200), how: '每月 1 日結算' },
      { name: '🏆 月營業額冠軍櫃位', coins: gm27_n_('冠軍櫃位總獎勵', 500), how: '全櫃位夥伴依上班時數分' },
      { name: '🏰 塔防週冠軍', coins: pv_param_('塔防冠軍獎勵'), how: '每週一結算，依上班時數分' }
    ],
    badges: badges,
    spend: [
      { name: '服裝商店', how: '普通 10～30、稀有 50～100、傳說 200～400' },
      { name: '扭蛋機', how: gm27_n_('扭蛋價格', 50) + ' 枚一次，每月最多 ' + gm27_n_('扭蛋每月上限', 5) + ' 次，機率公開' },
      { name: '寵物配件', how: '第一隻寵物免費' },
      { name: '塔防捐獻', how: '1 枚＝' + pv_param_('塔防捐獻積分倍率') + ' 分，幫自己的百貨櫃位衝分' },
      { name: '團隊基金', how: '一次至少 ' + gm27_n_('捐獻最低', 10) + ' 枚，解鎖辦公室新場景' },
      { name: '夥伴商店街', how: '買禮物、寵物零食、裝備；開店費 100 枚' }
    ],
    principles: ['赤心幣是福利性質的遊戲點數，不能換現金', '不能轉給其他夥伴（只能捐團隊基金、塔防）', '和薪資、考核無關', '沒有扣幣處罰，徽章不會被收回', '管理者補發或更正都要填理由，留紀錄'],
    balance: gm_balance_(emp)
  } };
}
// 加倍活動（管理者手動）
function gm27_boostList_(p) { return { success: true, data: gm27_boosts_().map(function (b) { return { row: b.row, name: b.name, from: b.from, to: b.to, loc: b.loc, mult: b.mult, by: b.by }; }) }; }
function gm27_boostSave_(p) {
  var me = gm_emp_(p.empId); if (!me || me.role < 3) return { error: '需要 Lv.3 以上' };
  var name = String(p.name || '').trim().slice(0, 20), from = gm27_ymd_(p.from), to = gm27_ymd_(p.to) || from, m = Number(p.mult);
  if (!name || !from) return { error: '請填名稱和日期' };
  if (!(m > 1 && m <= 5)) return { error: '倍率要在 1～5 之間' };
  if (to < from) return { error: '結束日不能早於開始日' };
  gm27_boostSheet_().appendRow([name, from, to, String(p.loc || '').trim(), m, me.name, gm_now_()]);
  GM_CACHE_.boosts = null; GM_CACHE_.g27 = null;
  return { success: true };
}
function gm27_boostDel_(p) {
  var me = gm_emp_(p.empId); if (!me || me.role < 3) return { error: '需要 Lv.3 以上' };
  var row = Number(p.row); if (!(row >= 2)) return { error: '找不到' };
  gm27_boostSheet_().deleteRow(row); GM_CACHE_.boosts = null; GM_CACHE_.g27 = null;
  return { success: true };
}

// ── 首頁「今天要處理」──
function gm27_todo_(p) {
  var me = ops_me_(p.empId), out = [], today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
  var add = function (icon, text, tab, red) { out.push({ icon: icon, text: text, tab: tab || '', red: !!red }); };
  try { var h = fs_checkup_(me.raw); if (h.status === '過期' || h.status === '未上傳') add('🩺', '健康檢查' + (h.status === '過期' ? '已過期' : '還沒上傳') + '，請上傳新的體檢表', 'health', true); else if (h.status === '即將到期') add('🩺', '健康檢查 ' + h.exp + ' 到期，記得去做新的', 'health'); } catch (e) {}
  if (me.role >= 2) {
    try { var rc = rp_count_({ empId: me.id }); if (rc && rc.pending) add('🛠', '門市回報待處理 ' + rc.pending + ' 件' + (rc.urgent ? '（' + rc.urgent + ' 件緊急）' : ''), 'rp', rc.urgent > 0); } catch (e) {}
    try {
      var mine = ops_myLocs_(me), bad = ops_rows_(ops_sheet_('食安紀錄', FS_LOG_HEAD), 10).filter(function (r) { return String(r[2]) === today && String(r[8]) === '是' && (me.role >= 3 || mine.indexOf(String(r[3])) >= 0); });
      if (bad.length) add('🧊', '今天有 ' + bad.length + ' 筆冰箱溫度異常', 'foodsafe', true);
    } catch (e) {}
    try { var sr = sch_reqs_().filter(function (q) { return /待.*核准|待分隊長/.test(q.status) && (me.role >= 3 || ops_myLocs_(me).indexOf(q.loc) >= 0); }); if (sr.length) add('🔁', '換班／認領待核准 ' + sr.length + ' 件', 'schedule_mgr'); } catch (e) {}
  }
  if (me.role >= 3) {
    try { var hp = fs_healthRows_().filter(function (x) { return x.status === '待確認'; }).length; if (hp) add('🩺', '體檢表待確認 ' + hp + ' 份', 'foodsafe'); } catch (e) {}
    try {
      var lim = Utilities.formatDate(new Date(Date.now() + 30 * 86400000), 'Asia/Taipei', 'yyyy-MM-dd'), all = fs_certRows_();
      Object.keys(all).forEach(function (k) { var c = all[k]; [['plExp', '產品責任險'], ['paExp', '公共意外險']].forEach(function (x) { if (c[x[0]] && c[x[0]] <= lim) add('📄', k + ' ' + x[1] + (c[x[0]] < today ? '已過期' : ' ' + c[x[0]] + ' 到期'), 'foodsafe', c[x[0]] < today); }); });
    } catch (e) {}
    try { var om = ops_meInfo_({ empId: me.id }); if (om && om.matPending) add('📦', '叫貨單待處理 ' + om.matPending + ' 張', 'mat'); } catch (e) {}
  }
  return { success: true, data: out };
}

AU_READ = /^(get|check|estimate)|List$|^(annFeed|annOptions|annReaders|buList|opsFranchise|opsMatItems|opsMatMonthly|opsMe|opsOnboard|opsPnl|opsPriceList|opsReceivable|payRecon|pvLiveMine|pvLiveState|pvMe|rpCount|rpMeta|schBoard|schMine|schReconcile|spList|spScene|tdMe|gmMe|gmScene|gmGames|lineGroups|lineQuota|login|fsMeta|fsTemps|fsAudit|fsHealthMine|fsHealthView|gmRules|gmBoostList|homeTodo)$/;

function gm27Handler_(action, p) {
  var map = { gmRules: gm27_rules_, gmBoostList: gm27_boostList_, gmBoostSave: gm27_boostSave_, gmBoostDel: gm27_boostDel_, homeTodo: gm27_todo_ };
  if (!map[action]) return null;
  try { GM_CACHE_ = {}; return map[action](p); } catch (e) { return { error: e.message }; }
}

function gm27_setup() {
  var sh = gm_sh_('params'), v = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues() : [], have = {}, log = [];
  v.forEach(function (r, i) { have[String(r[0]).trim()] = i + 2; });
  // 階層加成：Lv.2～5 依序 1.2～1.5（隊長 11/12）
  [['工時倍率_2', 1.2], ['工時倍率_3', 1.3], ['工時倍率_4', 1.4], ['工時倍率_5', 1.5]].forEach(function (x) {
    if (have[x[0]]) sh.getRange(have[x[0]], 2).setValue(x[1]); else sh.appendRow([x[0], x[1], '']);
    log.push(x[0] + '＝' + x[1]);
  });
  GM27_PARAMS.forEach(function (x) { if (!have[x[0]]) { sh.appendRow(x); log.push('新增參數 ' + x[0]); } });
  if (!String(gm_param_('品牌週年日') || '').trim() || have['品牌週年日']) { var r = have['品牌週年日']; if (r && !String(sh.getRange(r, 2).getValue()).trim()) { sh.getRange(r, 2).setValue("'02-02"); log.push('品牌週年日＝02-02'); } }
  gm27_boostSheet_();
  if (!gm_getState_('食安開始日')) gm_setState_('食安開始日', gm_today_());
  GM_CACHE_ = {};
  Logger.log('gm27_setup 完成\n' + log.join('\n'));
  return log;
}
