// ═══════════════════════════════════════════════
// v1.28 寵物隊伍與寵物市集＋塔防戰報 A～D＋行事曆（2026-11-13）
// 貼在「赤心幣塔防 v1.27」之後、「路由v1.28」之前。部署後執行一次 p28_setup()
// 1. 寵物隊伍：每人最多 5 隻（第 1 隻免費，第 2～5 隻 200／300／400／500），全部跟在身後；「身邊」＝主寵物，其他是「隊伍」
//    賣回系統：蛋 30・雛形 60・嬰兒 90・兒童 130・完全體 180；寵物市集：賣家自訂 100～1,000，成交拿 80%，掛 3 天沒賣出自動收回
//    至少留 1 隻；賣掉的寵物留在自己的圖鑑和相簿
// 2. 塔防：A 每週戰報（首頁公告＋LINE）B 進步獎（比前 4 週平均成長最多 +100）C 櫃位 MVP 徽章 D 等級稱號
// 3. 行事曆：公司「紅玉滿行事曆」（全員看，Lv.3 以上新增修改）＋大隊長個人行事曆（只有大隊長看得到）；與 Google 日曆雙向同步
// 覆蓋：gm_petSyncAll_、gm_petDex_、td_weekly_（加 A～C）、td_simulate_（加 D 稱號）
// ═══════════════════════════════════════════════

var P28_PARAMS = [
  ['寵物上限', 5, '每人最多幾隻寵物'],
  ['寵物價格_2', 200, '第 2 隻'], ['寵物價格_3', 300, '第 3 隻'], ['寵物價格_4', 400, '第 4 隻'], ['寵物價格_5', 500, '第 5 隻'],
  ['寵物回收價', '30,60,90,130,180', '賣回系統：蛋、雛形、嬰兒、兒童、完全體'],
  ['寵物市集最低價', 100, ''], ['寵物市集最高價', 1000, ''], ['寵物市集賣家比例', 0.8, '成交後賣家拿幾成，其餘系統回收'], ['寵物市集天數', 3, '掛賣幾天沒賣出自動收回'],
  ['塔防進步獎', 100, '本週積分比前 4 週平均成長最多的櫃位，依上班時數分'],
  ['塔防等級稱號', '小攤,人氣攤,名店,排隊名店,傳奇櫃位', 'Lv.1、2、3、4、5 以上']
];
P28_PARAMS.forEach(function (p) { GM_PARAM_DEFAULTS.push(p); });
['黑糖', '芝麻'].forEach(function (f) { if (GM_PET_FLAVORS.indexOf(f) < 0) GM_PET_FLAVORS.push(f); });
GM_BADGES.push(['td_mvp', '本週 MVP', '🏅', '櫃位當週上班時數最多', 0, true]);
GM_BADGES.push(['td_progress', '進步之星', '📈', '塔防進步獎的櫃位', 0, true]);
var P28_MKT_HEAD = ['編號', '賣家', '寵物編號', '價格', '狀態', '掛賣時間', '買家', '成交時間'];

// ── 寵物 ──
function p28_n_(k, d) { var v = Number(gm_param_(k)); return isFinite(v) && v > 0 ? v : d; }
function p28_alive_(emp) {     // 身邊＋隊伍（含掛賣中），主寵物在最前
  var out = [];
  gm_rows_('pets').forEach(function (r, i) {
    var st = String(r[8] || '身邊') || '身邊';
    if (r[0] === emp && (st === '身邊' || st === '隊伍' || st === '掛賣')) out.push(gm_petFromRow_(r, i));
  });
  return out.sort(function (a, b) { return (a.status === '身邊' ? 0 : 1) - (b.status === '身邊' ? 0 : 1) || (a.since < b.since ? -1 : 1); });
}
function p28_price_(n) { return n <= 1 ? 0 : p28_n_('寵物價格_' + Math.min(5, n), [0, 0, 200, 300, 400, 500][Math.min(5, n)]); }
function p28_buyback_(stage) { var a = String(gm_param_('寵物回收價') || '30,60,90,130,180').split(',').map(Number); return a[Math.max(0, Math.min(4, stage - 1))] || 30; }
function p28_mktSheet_() {
  var ss = gm_ss_(), sh = ss.getSheetByName('寵物市集');
  if (!sh) { sh = ss.insertSheet('寵物市集'); sh.getRange(1, 1, 1, P28_MKT_HEAD.length).setValues([P28_MKT_HEAD]); sh.setFrozenRows(1); }
  return sh;
}
function p28_mkt_() {
  var sh = p28_mktSheet_(); if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 8).getValues().map(function (r, i) {
    return { row: i + 2, id: String(r[0]), seller: String(r[1]), pet: String(r[2]), price: Number(r[3]) || 0, status: String(r[4]), at: String(r[5]), buyer: String(r[6] || ''), done: String(r[7] || '') };
  }).filter(function (x) { return x.id; });
}
function p28_petRow_(petId) {
  var rows = gm_rows_('pets');
  for (var i = 0; i < rows.length; i++) if (String(rows[i][9]) === String(petId)) return gm_petFromRow_(rows[i], i);
  return null;
}
function p28_expire_() {         // 掛賣超過天數 → 收回
  var days = p28_n_('寵物市集天數', 3), lim = Date.now() - days * 86400000;
  p28_mkt_().forEach(function (m) {
    if (m.status !== '掛賣' || new Date(m.at.replace(' ', 'T') + '+08:00').getTime() > lim) return;
    p28_mktSheet_().getRange(m.row, 5).setValue('收回');
    var pt = p28_petRow_(m.pet); if (pt && pt.status === '掛賣') gm_petSet_(pt.row, 9, ['隊伍']);
  });
}
function p28_ensureMain_(emp) {  // 沒有「身邊」的就把隊伍第一隻升上來
  var a = p28_alive_(emp);
  if (a.length && !a.some(function (x) { return x.status === '身邊'; })) {
    var first = a.filter(function (x) { return x.status === '隊伍'; })[0]; if (first) gm_petSet_(first.row, 9, ['身邊']);
  }
}
function p28_team_(emp) {
  p28_expire_();
  var a = p28_alive_(emp), max = p28_n_('寵物上限', 5), mkt = p28_mkt_();
  return { list: a.map(function (x) {
      var m = mkt.filter(function (k) { return k.pet === x.id && k.status === '掛賣'; })[0];
      return { id: x.id, name: x.name, flavor: x.flavor, type: x.type, typeName: x.typeName, stage: x.stage, stageName: x.stageName, hours: x.hours, nextAt: x.nextAt,
        main: x.status === '身邊', listed: m ? { id: m.id, price: m.price, at: m.at } : null, buyback: p28_buyback_(x.stage) };
    }), max: max, count: a.length, nextPrice: a.length >= max ? null : p28_price_(a.length + 1) };
}
function p28_buyMore_(p) {
  var emp = String(p.empId || '').trim(), e = gm_emp_(emp); if (!e || gm_isFrozen_(emp)) return { error: '帳號無法使用' };
  var a = p28_alive_(emp), max = p28_n_('寵物上限', 5);
  if (!a.length) return gm_petBuy_(p);                                 // 第一隻：原本的免費領養
  if (a.length >= max) return { error: '最多 ' + max + ' 隻，請先賣掉一隻' };
  var price = p28_price_(a.length + 1);
  if (gm_balance_(emp) < price) return { error: '赤心幣不足（需要 ' + price + ' 枚）' };
  var flavor = GM_PET_FLAVORS.concat(['黑糖', '芝麻']).indexOf(p.flavor) >= 0 ? p.flavor : '原味';
  var name = String(p.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 8) || '小雞蛋糕';
  var id = gm_petId_();
  gm_credit_(emp, '寵物', -price, '買第 ' + (a.length + 1) + ' 隻寵物「' + name + '」', 'PETBUY|' + emp + '|' + id);
  gm_append_('pets', [[emp, flavor, name, gm_today_(), '', 0, 1, '', '隊伍', id, '']]);
  gm_petEvent_(emp, 'join', (e.nick || e.name) + ' 的隊伍多了一顆蛋「' + name + '」');
  return { success: true, data: p28_team_(emp), balance: gm_balance_(emp) };
}
function p28_setMain_(p) {
  var emp = String(p.empId || '').trim(), a = p28_alive_(emp), t = a.filter(function (x) { return x.id === String(p.pet); })[0];
  if (!t) return { error: '找不到這隻寵物' };
  if (t.status === '掛賣') return { error: '掛賣中的寵物不能當主寵物' };
  a.forEach(function (x) { if (x.status === '身邊') gm_petSet_(x.row, 9, ['隊伍']); });
  gm_petSet_(t.row, 9, ['身邊']);
  return { success: true, data: p28_team_(emp) };
}
function p28_sellSys_(p) {
  var emp = String(p.empId || '').trim(), a = p28_alive_(emp), t = a.filter(function (x) { return x.id === String(p.pet); })[0];
  if (!t) return { error: '找不到這隻寵物' };
  if (t.status === '掛賣') return { error: '請先從市集收回' };
  if (a.filter(function (x) { return x.status !== '掛賣'; }).length <= 1) return { error: '至少要留 1 隻寵物' };
  gm_petSync_(t);
  var amt = p28_buyback_(t.stage);
  gm_petSet_(t.row, 9, ['已售出']);
  gm_credit_(emp, '寵物回收', amt, '「' + t.name + '」（' + t.stageName + '）賣回系統', 'PETSELL|' + t.id);
  p28_ensureMain_(emp);
  return { success: true, data: p28_team_(emp), got: amt, balance: gm_balance_(emp) };
}
function p28_list_(p) {
  var emp = String(p.empId || '').trim(), a = p28_alive_(emp), t = a.filter(function (x) { return x.id === String(p.pet); })[0];
  if (!t) return { error: '找不到這隻寵物' };
  if (t.status === '掛賣') return { error: '已經在市集上了' };
  if (a.filter(function (x) { return x.status !== '掛賣'; }).length <= 1) return { error: '至少要留 1 隻寵物在身邊' };
  var lo = p28_n_('寵物市集最低價', 100), hi = p28_n_('寵物市集最高價', 1000), price = Math.floor(Number(p.price) || 0);
  if (price < lo || price > hi) return { error: '價格要在 ' + lo + '～' + hi + ' 之間' };
  gm_petSync_(t);
  gm_petSet_(t.row, 9, ['掛賣']);
  p28_mktSheet_().appendRow(['K' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10), emp, t.id, price, '掛賣', gm_now_(), '', '']);
  p28_ensureMain_(emp);
  return { success: true, data: p28_team_(emp) };
}
function p28_unlist_(p) {
  var emp = String(p.empId || '').trim(), m = p28_mkt_().filter(function (k) { return k.id === String(p.id) && k.status === '掛賣'; })[0];
  if (!m || m.seller !== emp) return { error: '找不到這筆掛賣' };
  p28_mktSheet_().getRange(m.row, 5).setValue('收回');
  var pt = p28_petRow_(m.pet); if (pt && pt.status === '掛賣') gm_petSet_(pt.row, 9, ['隊伍']);
  p28_ensureMain_(emp);
  return { success: true, data: p28_team_(emp) };
}
function p28_market_(p) {
  p28_expire_();
  var emps = gm_emps_(), emp = String(p.empId || '');
  return { success: true, data: p28_mkt_().filter(function (m) { return m.status === '掛賣'; }).map(function (m) {
    var pt = p28_petRow_(m.pet), s = emps[m.seller]; if (!pt) return null;
    return { id: m.id, price: m.price, at: m.at, mine: m.seller === emp, seller: s ? (s.nick || s.name) : m.seller,
      pet: { name: pt.name, flavor: pt.flavor, type: pt.type, typeName: pt.typeName, stage: pt.stage, stageName: pt.stageName, hours: pt.hours } };
  }).filter(Boolean).reverse(), sellerShare: Number(gm_param_('寵物市集賣家比例')) || 0.8 };
}
function p28_buyMkt_(p) {
  var emp = String(p.empId || '').trim(), e = gm_emp_(emp); if (!e || gm_isFrozen_(emp)) return { error: '帳號無法使用' };
  p28_expire_();
  var m = p28_mkt_().filter(function (k) { return k.id === String(p.id) && k.status === '掛賣'; })[0];
  if (!m) return { error: '這隻已經被買走或收回了' };
  if (m.seller === emp) return { error: '不能買自己的寵物' };
  if (p28_alive_(emp).length >= p28_n_('寵物上限', 5)) return { error: '你的寵物已經滿 5 隻，請先賣掉一隻' };
  if (gm_balance_(emp) < m.price) return { error: '赤心幣不足' };
  var pt = p28_petRow_(m.pet); if (!pt) return { error: '找不到這隻寵物' };
  var share = Number(gm_param_('寵物市集賣家比例')) || 0.8, get = Math.floor(m.price * share);
  gm_credit_(emp, '寵物市集', -m.price, '買下「' + pt.name + '」', 'MKTBUY|' + m.id);
  if (!gm_isFrozen_(m.seller)) gm_credit_(m.seller, '寵物市集', get, '「' + pt.name + '」賣出 ' + m.price + ' 枚（拿 ' + Math.round(share * 100) + '%）', 'MKTSELL|' + m.id);
  // 賣家留一筆紀錄（圖鑑、相簿用），寵物本身交給買家：保留目前的成長時數，之後依新主人的工時繼續長大
  gm_append_('pets', [[m.seller, pt.flavor, pt.name, pt.since, pt.acc, 0, 1, pt.type, '已售出', pt.id + 'S', pt.hatched]]);
  var bonus = pt.hours;
  gm_petSet_(pt.row, 1, [emp]); gm_petSet_(pt.row, 4, [gm_today_(), '', bonus]);
  gm_petSet_(pt.row, 9, [p28_alive_(emp).some(function (x) { return x.status === '身邊'; }) ? '隊伍' : '身邊']);
  p28_mktSheet_().getRange(m.row, 5, 1, 4).setValues([['成交', m.at, emp, gm_now_()]]);
  gm_petEvent_(emp, 'trade', (e.nick || e.name) + ' 在寵物市集帶回了「' + pt.name + '」');
  return { success: true, data: p28_team_(emp), balance: gm_balance_(emp) };
}
// 覆蓋：孵化檢查擴及隊伍
function gm_petSyncAll_() {
  var rows = gm_rows_('pets').slice();
  rows.forEach(function (r, i) { var st = String(r[8] || '身邊') || '身邊'; if (st === '身邊' || st === '隊伍' || st === '掛賣') gm_petSync_(gm_petFromRow_(r, i)); });
}
// 覆蓋：圖鑑包含賣掉的完全體
function gm_petDex_(emp) {
  var out = [], seen = {};
  gm_rows_('pets').forEach(function (r, i) {
    if (r[0] !== emp) return; var pt = gm_petFromRow_(r, i), id = pt.id.replace(/S$/, '');
    var stage = pt.stage;
    if (pt.status === '已售出') { stage = 0; gm_rows_('album').forEach(function (al) { if (String(al[1]) === id && Number(al[2]) > stage) stage = Number(al[2]); }); }
    if (seen[id]) return;
    if (pt.status === '圖鑑' || stage >= 5) { seen[id] = 1; out.push({ id: id, name: pt.name, type: pt.type, typeName: pt.typeName, flavor: pt.flavor, current: pt.status === '身邊', sold: pt.status === '已售出' }); }
  });
  return out;
}
// 宇宙辦公室：每個人的隊伍（主寵物以外）
function p28_sceneTeams_() {
  var out = {};
  gm_rows_('pets').forEach(function (r, i) {
    var st = String(r[8] || ''); if (st !== '隊伍' && st !== '掛賣') return;
    var pt = gm_petFromRow_(r, i); (out[r[0]] = out[r[0]] || []).push({ flavor: pt.flavor, name: pt.name, stage: pt.stage, type: pt.type, acc: '' });
  });
  return out;
}

// ── 塔防 A～D ──
function td_title_(lv) { var a = String(gm_param_('塔防等級稱號') || '小攤,人氣攤,名店,排隊名店,傳奇櫃位').split(','); return a[Math.min(a.length, Math.max(1, lv)) - 1] || ''; }
function td_weekly_(today) {
  if (((new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7) !== 0) return;
  var last = td_weekRange_(gm_addDays_(today, -1)), key = last.from;
  if (gm_getState_('塔防已結算') === key || last.to < gm_param_('測試版開始日')) return;
  var R = td_simulate_(last.from, last.to);
  R.matches.forEach(function (m) { pv_append_('tdLog', [[key, m.a, m.b, m.winner, JSON.stringify(m.waves)]]); });
  var hrs = function (loc) { var mins = {}, tot = 0; gm_rows_('hours').forEach(function (r) { if (r[2] === loc && String(r[0]) >= last.from && String(r[0]) <= last.to) { mins[r[1]] = (mins[r[1]] || 0) + (Number(r[3]) || 0); tot += Number(r[3]) || 0; } }); return { mins: mins, tot: tot }; };
  var pay = function (loc, pool, kind, label) { var h = hrs(loc); if (h.tot) Object.keys(h.mins).forEach(function (emp) { if (!gm_isFrozen_(emp)) gm_credit_(emp, kind, Math.round(pool * h.mins[emp] / h.tot), key + ' ' + label + ' ' + loc, kind + '|' + emp + '|' + key); }); return h; };
  var champ = '', champCrew = [], prog = null, mvps = [];
  if (R.standings.length && R.standings[0].score > 0) {
    champ = R.standings[0].loc;
    var h = pay(champ, pv_param_('塔防冠軍獎勵'), '塔防冠軍', '週塔防冠軍');
    champCrew = Object.keys(h.mins).map(function (e) { var x = gm_emp_(e); return x ? (x.nick || x.name) : e; });
    gm_setState_('塔防冠軍_' + key, champ);
  }
  // B 進步獎：本週積分 ÷ 前 4 週平均，成長最多的櫃位
  R.standings.forEach(function (s) {
    var sum = 0, n = 0;
    for (var w = 1; w <= 4; w++) { var f = gm_addDays_(last.from, -7 * w), t = gm_addDays_(f, 6); if (t < gm_param_('測試版開始日')) continue; sum += td_score_(s.loc, f, t).score; n++; }
    if (!n || !sum) return;
    var g = s.score / (sum / n) - 1;
    if (g > 0 && (!prog || g > prog.g)) prog = { loc: s.loc, g: g };
  });
  if (prog) { var hp = pay(prog.loc, p28_n_('塔防進步獎', 100), '塔防進步獎', '塔防進步獎（+' + Math.round(prog.g * 100) + '%）'); Object.keys(hp.mins).forEach(function (e) { gm_award_(e, 'td_progress', key); }); }
  // C 櫃位 MVP：每個百貨櫃位本週上班時數最多
  R.standings.forEach(function (s) {
    var h = hrs(s.loc), best = '', bm = 0; Object.keys(h.mins).forEach(function (e) { if (h.mins[e] > bm) { bm = h.mins[e]; best = e; } });
    if (best) { gm_award_(best, 'td_mvp', key + '|' + s.loc); var x = gm_emp_(best); mvps.push(String(s.loc).replace(/^\d+/, '') + ' ' + (x ? (x.nick || x.name) : best)); }
  });
  gm_setState_('塔防戰報_' + key, JSON.stringify(R.standings.map(function (s) { return [s.loc, s.score, s.revScore, s.giveScore]; })));
  // A 每週戰報：首頁公告＋LINE
  if (champ) {
    var title = '🏰 上週塔防戰報：' + champ.replace(/^\d+/, '') + ' 奪冠！';
    var body = R.standings.map(function (s, i) { return (['🥇', '🥈', '🥉'][i] || (i + 1) + '.') + ' ' + s.loc.replace(/^\d+/, '') + '　' + s.score.toLocaleString() + ' 分（Lv.' + s.level + ' ' + td_title_(s.level) + '）'; }).join('\n') +
      '\n\n辛苦了！冠軍夥伴：' + (champCrew.join('、') || '—') +
      (prog ? '\n📈 進步獎：' + prog.loc.replace(/^\d+/, '') + '（比前 4 週平均成長 ' + Math.round(prog.g * 100) + '%）' : '') +
      (mvps.length ? '\n🏅 本週 MVP：' + mvps.join('、') : '');
    try {
      var sh = ann_sheet_();
      if (sh) sh.appendRow(['A' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss') + 'TD', title, body, '一般', '否', '系統', Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss'), gm_addDays_(today, 6), '發布', JSON.stringify({ by: 'system', groups: [], target: [] })]);
    } catch (e) {}
    try { if (typeof line_notify_ === 'function') line_notify_('公告', title + '\n\n' + body); } catch (e) {}
  }
  gm_setState_('塔防已結算', key);
}

// ── 行事曆 ──
var CAL_CATS = ['進撤櫃', '快閃', '活動', '會議', '其他'];
function cal_company_() {
  var id = String(gm_param_('公司行事曆ID') || '').trim();
  if (id) { var c = CalendarApp.getCalendarById(id); if (c) return c; }
  var list = CalendarApp.getCalendarsByName('紅玉滿行事曆');
  return list && list.length ? list[0] : null;
}
function cal_personal_() { var id = String(gm_param_('大隊長行事曆ID') || '').trim(); return id ? CalendarApp.getCalendarById(id) : null; }
function cal_cat_(desc) { var m = String(desc || '').match(/分類[:：]\s*(\S+)/); return m && CAL_CATS.indexOf(m[1]) >= 0 ? m[1] : '其他'; }
function cal_ev_(ev, src) {
  var all = ev.isAllDayEvent(), st = ev.getStartTime(), en = ev.getEndTime(), f = function (d, fmt) { return Utilities.formatDate(d, 'Asia/Taipei', fmt); };
  var desc = String(ev.getDescription() || '');
  return { id: ev.getId(), src: src, title: ev.getTitle(), allDay: all, date: f(st, 'yyyy-MM-dd'), end: f(all ? new Date(en.getTime() - 1) : en, 'yyyy-MM-dd'),
    start: all ? '' : f(st, 'HH:mm'), endTime: all ? '' : f(en, 'HH:mm'), loc: String(ev.getLocation() || ''), cat: cal_cat_(desc),
    desc: desc.replace(/\n?分類[:：]\s*\S+/, '').trim() };
}
function cal_isBoss_(emp) { var e = gm_emp_(emp); return !!e && e.role >= 5; }
function cal_list_(p) {
  var emp = String(p.empId || ''), from = gm27_ymd_(p.from) || gm_today_(), to = gm27_ymd_(p.to) || gm_addDays_(from, 41);
  var a = new Date(from + 'T00:00:00+08:00'), b = new Date(to + 'T23:59:59+08:00'), out = [];
  var c = cal_company_(); if (c) c.getEvents(a, b).forEach(function (ev) { out.push(cal_ev_(ev, 'company')); });
  if (cal_isBoss_(emp)) { var pc = cal_personal_(); if (pc) pc.getEvents(a, b).forEach(function (ev) { out.push(cal_ev_(ev, 'personal')); }); }
  out.sort(function (x, y) { return (x.date + x.start) < (y.date + y.start) ? -1 : 1; });
  return { success: true, data: out, cats: CAL_CATS, ready: { company: !!c, personal: cal_isBoss_(emp) ? !!cal_personal_() : null },
    canEdit: (gm_emp_(emp) || {}).role >= 3, isBoss: cal_isBoss_(emp) };
}
function cal_save_(p) {
  var emp = String(p.empId || ''), me = gm_emp_(emp); if (!me || me.role < 3) return { error: '需要 Lv.3 以上' };
  var src = p.src === 'personal' ? 'personal' : 'company';
  if (src === 'personal' && !cal_isBoss_(emp)) return { error: '只有大隊長可以使用個人行事曆' };
  var cal = src === 'personal' ? cal_personal_() : cal_company_(); if (!cal) return { error: src === 'personal' ? '個人行事曆還沒連結（〈遊戲參數〉大隊長行事曆ID）' : '找不到「紅玉滿行事曆」' };
  var title = String(p.title || '').trim().slice(0, 60); if (!title) return { error: '請填標題' };
  var date = gm27_ymd_(p.date), end = gm27_ymd_(p.end) || date; if (!date) return { error: '請選日期' };
  var cat = CAL_CATS.indexOf(p.cat) >= 0 ? p.cat : '其他';
  var desc = (String(p.desc || '').trim().slice(0, 1000) + '\n分類：' + cat).trim(), opt = { description: desc, location: String(p.loc || '').slice(0, 100) };
  var allDay = !p.start, ev;
  var s = allDay ? new Date(date + 'T00:00:00+08:00') : new Date(date + 'T' + p.start + ':00+08:00');
  var e = allDay ? new Date(new Date(end + 'T00:00:00+08:00').getTime() + 86400000) : new Date(end + 'T' + (p.endTime || p.start) + ':00+08:00');
  if (e <= s && !allDay) e = new Date(s.getTime() + 3600000);
  if (p.id) {
    ev = cal.getEventById(String(p.id)); if (!ev) return { error: '找不到這個行程' };
    ev.setTitle(title); ev.setDescription(desc); ev.setLocation(opt.location);
    if (allDay) ev.setAllDayDates(s, e); else ev.setTime(s, e);
  } else ev = allDay ? cal.createAllDayEvent(title, s, e, opt) : cal.createEvent(title, s, e, opt);
  return { success: true, id: ev.getId() };
}
function cal_del_(p) {
  var emp = String(p.empId || ''), me = gm_emp_(emp); if (!me || me.role < 3) return { error: '需要 Lv.3 以上' };
  var src = p.src === 'personal' ? 'personal' : 'company';
  if (src === 'personal' && !cal_isBoss_(emp)) return { error: '只有大隊長可以使用個人行事曆' };
  var cal = src === 'personal' ? cal_personal_() : cal_company_(), ev = cal && cal.getEventById(String(p.id || ''));
  if (!ev) return { error: '找不到這個行程' };
  ev.deleteEvent(); return { success: true };
}
// 每天早上提醒今天的公司行程（LINE，選用）：〈遊戲參數〉行事曆LINE提醒＝是；p28_setup 會建立每天 8 點的觸發
function cal_morningPush() {
  if (!/^(是|Y|TRUE|1)$/i.test(String(gm_param_('行事曆LINE提醒') || ''))) return;
  var c = cal_company_(); if (!c) return;
  var today = gm_today_(), evs = c.getEvents(new Date(today + 'T00:00:00+08:00'), new Date(today + 'T23:59:59+08:00')).map(function (ev) { return cal_ev_(ev, 'company'); });
  if (!evs.length) return;
  try { line_notify_('公告', '📅 今天的行程\n' + evs.map(function (x) { return '・' + (x.start ? x.start + ' ' : '') + '【' + x.cat + '】' + x.title + (x.loc ? '（' + x.loc + '）' : ''); }).join('\n')); } catch (e) {}
}
function cal_todayTodo_(emp) {
  var out = [], today = gm_today_(), tmr = gm_addDays_(today, 1);
  try {
    var r = cal_list_({ empId: emp, from: today, to: tmr });
    r.data.forEach(function (x) { out.push({ icon: x.src === 'personal' ? '🔒' : '📅', text: (x.date === today ? '今天' : '明天') + (x.start ? ' ' + x.start : '') + '【' + x.cat + '】' + x.title, tab: 'calendar', red: false }); });
  } catch (e) {}
  return out;
}

AU_READ = /^(get|check|estimate)|List$|^(annFeed|annOptions|annReaders|buList|opsFranchise|opsMatItems|opsMatMonthly|opsMe|opsOnboard|opsPnl|opsPriceList|opsReceivable|payRecon|pvLiveMine|pvLiveState|pvMe|rpCount|rpMeta|schBoard|schMine|schReconcile|spList|spScene|tdMe|gmMe|gmScene|gmGames|lineGroups|lineQuota|login|fsMeta|fsTemps|fsAudit|fsHealthMine|fsHealthView|gmRules|gmBoostList|homeTodo|gmPetTeam|gmPetMarket|calList)$/;

function p28Handler_(action, p) {
  var map = { gmPetTeam: function (q) { return { success: true, data: p28_team_(String(q.empId || '')) }; }, gmPetBuyMore: p28_buyMore_, gmPetMain: p28_setMain_, gmPetSell: p28_sellSys_,
    gmPetList: p28_list_, gmPetUnlist: p28_unlist_, gmPetMarket: p28_market_, gmPetMarketBuy: p28_buyMkt_, calList: cal_list_, calSave: cal_save_, calDel: cal_del_ };
  if (action === 'gmScene') {           // 加上每個人的隊伍
    try { GM_CACHE_ = {}; var r = gm_scene_(); if (r && r.data) r.data.teams = p28_sceneTeams_(); return r; } catch (e) { return null; }
  }
  if (action === 'homeTodo') {          // 加上今天／明天的行程
    try { var t = gm27_todo_(p); GM_CACHE_ = {}; if (t && t.success) t.data = cal_todayTodo_(String(p.empId || '')).concat(t.data); return t; } catch (e) { return null; }
  }
  if (action === 'tdMe') {              // 加上等級稱號
    try { GM_CACHE_ = {}; var d = td_me_(p); if (d && d.data) d.data.standings.forEach(function (s) { s.title = td_title_(s.level); }); return d; } catch (e) { return null; }
  }
  if (!map[action]) return null;
  var lock = /^(gmPetBuyMore|gmPetMain|gmPetSell|gmPetList|gmPetUnlist|gmPetMarketBuy)$/.test(action) ? LockService.getScriptLock() : null;
  try { if (lock) lock.waitLock(20000); GM_CACHE_ = {}; return map[action](p); }
  catch (e) { return { error: e.message }; }
  finally { if (lock) lock.releaseLock(); }
}

function p28_setup() {
  var sh = gm_sh_('params'), v = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues() : [], have = {}, log = [];
  v.forEach(function (r) { have[String(r[0]).trim()] = 1; });
  P28_PARAMS.concat([['公司行事曆ID', '', '空白＝自動找名為「紅玉滿行事曆」的日曆'], ['大隊長行事曆ID', '', '大隊長個人 Google 日曆共用給公司帳號後，填日曆 ID（通常是 Gmail 地址）'], ['行事曆LINE提醒', '否', '是＝每天早上 8 點把今天的公司行程發到 LINE 公告群組']])
    .forEach(function (x) { if (!have[x[0]]) { sh.appendRow(x); log.push('新增參數 ' + x[0]); } });
  p28_mktSheet_();
  var c = null; try { c = cal_company_(); if (!c) { c = CalendarApp.createCalendar('紅玉滿行事曆', { color: CalendarApp.Color.RED }); log.push('建立 Google 日曆「紅玉滿行事曆」'); } } catch (e) { log.push('日曆：' + e.message); }
  try {
    var has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'cal_morningPush'; });
    if (!has) { ScriptApp.newTrigger('cal_morningPush').timeBased().atHour(8).everyDays(1).inTimezone('Asia/Taipei').create(); log.push('建立每天 8 點行程提醒觸發'); }
  } catch (e) { log.push('觸發：' + e.message); }
  GM_CACHE_ = {};
  Logger.log('p28_setup 完成\n' + log.join('\n'));
  return log;
}
