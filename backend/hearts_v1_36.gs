// ═══════════════════════════════════════════════
// v1.36 無敵8心（2026-11-14）
// 貼在「設備檢查清單 v1.35 v2」之後、「路由 v1.36」之前。部署後執行一次 h36_setup()
// 8 顆心：愛心、耐心、決心、雄心、誠心、信心、善心、良心。每顆心銅、銀、金三階，依平常工作與遊戲的紀錄自動點亮
// 8 顆都到銅 →「無敵8心」稱號＋光環；8 顆都到金 →「傳說・無敵8心」。點亮後不會收回、不扣幣，和薪資考核無關
// 愛心、善心另外可以由夥伴推薦（每人每月 3 次）、管理者頒發（Lv.3 以上，分數較高）
// 分數規則與門檻都在〈遊戲參數〉（八心門檻_愛心 = 15,60,150 …），可以直接改
// 計算：自己打開 8 心頁時重算自己；每天第一次有人打開時重算全部（不另外加排程）
// 赤心幣：每升一階給一次（測試期與正式版各一次——12/1 正式版赤心幣歸零後，已點亮的心會在正式版補發一次）
// 覆蓋：無（只新增 h36_*、h36Handler_；在 gmScene、homeTodo 回傳裡加資料）
// ═══════════════════════════════════════════════

var H36_HEARTS = [
  ['love', '愛心', '❤️', '關心夥伴、照顧寵物', '送出互動、摸摸頭、生日祝福 1 分；收到夥伴推薦 5 分、管理者頒發 10 分；好導師 10 分'],
  ['patience', '耐心', '💪', '一步一步累積', '累計工時 1 小時 1 分'],
  ['resolve', '決心', '🔥', '說到做到、挑戰到底', '每日一題答對 1 分；小遊戲破紀錄 2 分；大魔王出手 1 分'],
  ['ambition', '雄心', '🦁', '走出舒適圈', '上過班的不同櫃位每個 3 分；活動場次每天 1 分；代班接班 2 分；出國活動 10 分'],
  ['sincere', '誠心', '🤝', '準時、確實', '準時上班每天 1 分；全勤之星每月 10 分'],
  ['confidence', '信心', '⭐', '獨當一面', '收店盤點 1 分；對戰勝場 1 分；開門紅 5 分；業績爆發 10 分'],
  ['kindness', '善心', '🌱', '善待顧客與同伴', '捐團隊基金與塔防投入每 20 枚 1 分；回報門市問題 1 分；收到夥伴推薦 5 分、管理者頒發 10 分'],
  ['conscience', '良心', '🍀', '把品質放心上', '食安紀錄、開店盤點 1 分；設備清單打勾每 10 項 1 分；食安與 SOP 題答對 1 分；上傳體檢 10 分']
];
var H36_DEF = {   // 門檻（銅,銀,金）
  love: '15,60,150', patience: '360,1080,2160', resolve: '20,80,200', ambition: '10,30,70',
  sincere: '20,80,200', confidence: '15,60,150', kindness: '10,40,100', conscience: '30,120,300'
};
var H36_LV = ['', '銅', '銀', '金'];
GM_SHEETS.h36 = ['八心', ['員工編號', '分數(JSON)', '階級(JSON)', '更新時間', '點亮紀錄(JSON)']];
GM_SHEETS.h36rec = ['八心推薦', ['時間', '月份', '推薦人', '對象', '心', '理由', '分數', '推薦人權限']];

function h36_n_(k, d) { var v = Number(gm_param_(k)); return isFinite(v) && String(gm_param_(k) || '') !== '' ? v : d; }
function h36_th_(key) {
  var h = H36_HEARTS.filter(function (x) { return x[0] === key; })[0];
  var s = String(gm_param_('八心門檻_' + h[1]) || H36_DEF[key]).split(/[,，、\s]+/).map(Number).filter(function (n) { return n > 0; });
  return s.length === 3 ? s : H36_DEF[key].split(',').map(Number);
}
function h36_lv_(key, pts) { var t = h36_th_(key), l = 0; for (var i = 0; i < 3; i++) if (pts >= t[i]) l = i + 1; return l; }
function h36_sheetRows_(name, cols) {
  var sh = gm_ss_().getSheetByName(name); if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, Math.min(cols, Math.max(1, sh.getLastColumn()))).getValues();
}
function h36_hm_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Taipei', 'HH:mm');
  var m = /^(\d{1,2}):(\d{2})/.exec(String(v || '').trim()); return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : '';
}

// ── 全部夥伴的分數（一次讀完所有資料）──
function h36_compute_() {
  if (GM_CACHE_.h36pts) return GM_CACHE_.h36pts;
  var emps = gm_emps_(), P = {}, add = function (e, k, n) { if (!emps[e] || !n) return; var o = P[e] = P[e] || {}; o[k] = (o[k] || 0) + n; };
  var nameOf = {}; Object.keys(emps).forEach(function (id) { nameOf[emps[id].nick || emps[id].name] = id; nameOf[emps[id].name] = id; });
  // 徽章
  gm_rows_('badges').forEach(function (r) {
    var e = String(r[0]), b = String(r[1]);
    if (b === 'mentor') add(e, 'love', 10);
    if (b === 'attend') add(e, 'sincere', 10);
    if (b === 'first_open') add(e, 'confidence', 5);
    if (b === 'bigday') add(e, 'confidence', 10);
  });
  // 愛心：互動、摸摸頭、生日祝福
  gm_rows_('inter').forEach(function (r) { add(String(r[2]), 'love', 1); });
  gm_rows_('wishes').forEach(function (r) { add(String(r[2]), 'love', 1); });
  // 推薦／頒發
  gm_rows_('h36rec').forEach(function (r) { add(String(r[3]), String(r[4]), Number(r[6]) || 0); });
  // 耐心：累計工時
  Object.keys(emps).forEach(function (id) { try { add(id, 'patience', c31_cumLife_(id)); } catch (e) {} });
  // 決心：每日一題、小遊戲破紀錄、大魔王
  var qcat = {}; gm_rows_('quiz').forEach(function (r) { qcat[String(r[0])] = String(r[1]); });
  gm_rows_('answers').forEach(function (r) {
    if (String(r[4]) !== '對') return; var e = String(r[1]); add(e, 'resolve', 1);
    if (/食安|SOP|衛生/i.test(qcat[String(r[2])] || '')) add(e, 'conscience', 1);
  });
  gm_rows_('games').forEach(function (r) { if (Number(r[5]) > 0) add(String(r[2]), 'resolve', 2); });
  try { gm_rows_('s30boss').forEach(function (r) { add(String(r[1]), 'resolve', 1); }); } catch (e) {}
  // 雄心：不同櫃位、活動場次、代班、出國
  var act = gm_activityLocs_(), locs = {}, actDay = {}, first = {};
  gm_punchRows_().forEach(function (p) {
    if (p.type !== '上班' || !emps[p.emp]) return;
    if (p.loc) (locs[p.emp] = locs[p.emp] || {})[p.loc.replace(/\s.*$/, '')] = 1;
    if (act[p.loc]) (actDay[p.emp] = actDay[p.emp] || {})[p.date] = 1;
    var k = p.emp + '|' + p.date; if (!first[k] || p.t < first[k]) first[k] = p.t;
  });
  Object.keys(locs).forEach(function (e) { add(e, 'ambition', 3 * Object.keys(locs[e]).length); });
  Object.keys(actDay).forEach(function (e) { add(e, 'ambition', Object.keys(actDay[e]).length); });
  try { if (typeof sch_reqs_ === 'function') sch_reqs_().forEach(function (q) { if (q.status === '已核准' && q.toId) add(String(q.toId), 'ambition', 2); }); } catch (e) {}
  // 設備清單：出國出勤、打勾
  h36_sheetRows_('設備清單', 15).forEach(function (r) {
    var crew = String(r[14] || '').split(/[、,\s]+/).filter(String);
    if (String(r[2]) === '出國' && String(r[12]) !== '取消') crew.forEach(function (id) { add(id, 'ambition', 10); });
    var items = []; try { items = JSON.parse(String(r[11] || '[]')); } catch (e) {}
    var cnt = {}; items.forEach(function (it) { (it.st || []).forEach(function (s) { if (s && s.by && nameOf[s.by]) cnt[nameOf[s.by]] = (cnt[nameOf[s.by]] || 0) + 1; }); });
    Object.keys(cnt).forEach(function (id) { (P.__eq = P.__eq || {})[id] = (P.__eq[id] || 0) + cnt[id]; });
  });
  Object.keys(P.__eq || {}).forEach(function (id) { add(id, 'conscience', Math.floor(P.__eq[id] / 10)); }); delete P.__eq;
  // 誠心：準時上班（第一次上班打卡不晚於班表上班時間＋寬限分鐘）
  var grace = h36_n_('八心準時寬限分鐘', 1) * 60000;
  h36_sheetRows_('班表', 7).forEach(function (r) {
    var d = gm_dstr_(r[1]), e = String(r[3]).trim(), st = h36_hm_(r[6]); if (!d || !st || !emps[e]) return;
    var f = first[e + '|' + d]; if (!f) return;
    if (f <= new Date(d + 'T' + st + ':00+08:00').getTime() + grace) add(e, 'sincere', 1);
  });
  // 信心：收店盤點、對戰勝場
  gm_closeRows_().forEach(function (c) { add(c.emp, 'confidence', 1); });
  h36_sheetRows_('對戰紀錄', 5).forEach(function (r) { add(String(r[4]).trim(), 'confidence', 1); });
  // 善心：團隊基金、塔防投入、門市回報
  var give = {};
  gm_rows_('fund').forEach(function (r) { give[r[1]] = (give[r[1]] || 0) + (Number(r[2]) || 0); });
  h36_sheetRows_('塔防投入', 5).forEach(function (r) { var e = String(r[1]); give[e] = (give[e] || 0) + (Number(r[4]) || 0); });
  Object.keys(give).forEach(function (e) { add(e, 'kindness', Math.floor(give[e] / 20)); });
  h36_sheetRows_('門市回報', 3).forEach(function (r) { add(String(r[2]).trim(), 'kindness', 1); });
  // 良心：食安紀錄、開店盤點、體檢
  h36_sheetRows_('食安紀錄', 5).forEach(function (r) { add(String(r[4]).trim(), 'conscience', 1); });
  h36_sheetRows_('開店盤點', 4).forEach(function (r) { add(String(r[3]).trim(), 'conscience', 1); });
  h36_sheetRows_('體檢表', 2).forEach(function (r) { add(String(r[1]).trim(), 'conscience', 10); });
  return (GM_CACHE_.h36pts = P);
}

// ── 儲存與發獎 ──
function h36_rowsMap_() {
  var m = {}; gm_rows_('h36').forEach(function (r, i) { m[String(r[0])] = { row: i + 2, pts: ops_json_(r[1], {}), lv: ops_json_(r[2], {}), at: String(r[3]), log: ops_json_(r[4], {}) }; });
  return m;
}
function h36_phase_() { return gm_today_() >= String(gm_param_('正式版開始日') || '2026-12-01') && gm_getState_('正式版已重置') ? 'F' : 'T'; }
// 重算一位或全部；回傳 { emp: {pts, lv, log} }
function h36_refresh_(only) {
  var P = h36_compute_(), emps = gm_emps_(), map = h36_rowsMap_(), now = gm_now_(), phase = h36_phase_(), sh = gm_sh_('h36'), out = {};
  var ids = only ? [only] : Object.keys(emps);
  var appends = [];
  ids.forEach(function (id) {
    var e = emps[id]; if (!e || e.resigned) return;
    var cur = map[id] || { pts: {}, lv: {}, log: {} }, pts = P[id] || {}, lv = {}, log = cur.log || {};
    H36_HEARTS.forEach(function (h) {
      var k = h[0], p = Math.floor(pts[k] || 0), l = Math.max(h36_lv_(k, p), Number(cur.lv[k]) || 0);   // 只升不降
      lv[k] = l; pts[k] = p;
      for (var i = 1; i <= l; i++) {
        var lk = k + i; if (!log[lk]) log[lk] = now.slice(0, 10);
        gm_credit_(id, '無敵8心', h36_n_('八心獎勵_' + H36_LV[i], [0, 30, 80, 200][i]), h[1] + '・' + H36_LV[i] + (phase === 'F' && log[lk] < String(gm_param_('正式版開始日')) ? '（正式版補發）' : ''), 'HEART|' + id + '|' + k + '|' + i + '|' + phase);
      }
    });
    var minLv = Math.min.apply(null, H36_HEARTS.map(function (h) { return lv[h[0]]; }));
    if (minLv >= 1) { if (!log.inv) log.inv = now.slice(0, 10); gm_credit_(id, '無敵8心', h36_n_('無敵8心獎勵', 300), '達成「無敵8心」', 'HEART8|' + id + '|' + phase); }
    if (minLv >= 3) { if (!log.legend) log.legend = now.slice(0, 10); gm_credit_(id, '無敵8心', h36_n_('傳說無敵8心獎勵', 1000), '達成「傳說・無敵8心」', 'HEART8G|' + id + '|' + phase); }
    var v = [id, JSON.stringify(pts), JSON.stringify(lv), now, JSON.stringify(log)];
    if (map[id]) { var rng = sh.getRange(map[id].row, 1, 1, 5); rng.setNumberFormat('@'); rng.setValues([v]); }
    else appends.push(v);
    out[id] = { pts: pts, lv: lv, log: log };
  });
  if (appends.length) gm_append_('h36', appends);
  delete GM_CACHE_['rows_h36'];
  return out;
}
// 每天第一次：全部重算
function h36_daily_() {
  var t = gm_today_(); if (gm_getState_('八心重算日') === t) return false;
  var lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) return false;
  try { if (gm_getState_('八心重算日') === t) return false; h36_refresh_(null); gm_setState_('八心重算日', t); return true; }
  finally { lock.releaseLock(); }
}
function h36_levels_() {   // 給宇宙辦公室、名牌用（只讀已存的）
  var m = h36_rowsMap_(), out = {};
  Object.keys(m).forEach(function (id) {
    var lv = m[id].lv || {}, n = 0, g = 0;
    H36_HEARTS.forEach(function (h) { if (lv[h[0]] >= 1) n++; if (lv[h[0]] >= 3) g++; });
    if (n) out[id] = { n: n, g: g, lv: H36_HEARTS.map(function (h) { return Number(lv[h[0]]) || 0; }) };
  });
  return out;
}
function h36_view_(id, x, self) {
  var e = gm_emp_(id) || {};
  var hearts = H36_HEARTS.map(function (h) {
    var t = h36_th_(h[0]), p = (x.pts || {})[h[0]] || 0, l = (x.lv || {})[h[0]] || 0;
    var o = { key: h[0], name: h[1], icon: h[2], mean: h[3], lv: l, at: (x.log || {})[h[0] + l] || '' };
    if (self) { o.pts = p; o.th = t; o.next = l < 3 ? t[l] : 0; o.how = h[4]; }
    return o;
  });
  var n = hearts.filter(function (h) { return h.lv >= 1; }).length, g = hearts.filter(function (h) { return h.lv >= 3; }).length;
  var out = { id: id, name: e.nick || e.name || '', hearts: hearts, n: n, g: g, inv: n === 8, legend: g === 8, invAt: (x.log || {}).inv || '', legendAt: (x.log || {}).legend || '' };
  if (self) {   // 無敵8心進度條：每顆心到銅（或到金）的完成比例平均
    var pr = function (lvNeed, ti) { return hearts.map(function (h) { return h.lv >= lvNeed ? 1 : Math.min(1, h.pts / h.th[ti]); }); };
    out.parts = pr(1, 0); out.partsG = pr(3, 2);
    out.prog = Math.floor(out.parts.reduce(function (a, b) { return a + b; }, 0) / 8 * 100);
    out.progG = Math.floor(out.partsG.reduce(function (a, b) { return a + b; }, 0) / 8 * 100);
  }
  return out;
}

// ── API ──
function h36_me_(p) {
  var vid = au_verifiedId_(), id = vid || String(p.empId || '').trim();     // 只讀自己的分數；記錄模式下沒通行證才用 empId
  var me = gm_emp_(id); if (!me || me.resigned) return { error: '找不到夥伴資料' };
  var x;
  if (p.lite) x = h36_rowsMap_()[id] || { pts: {}, lv: {}, log: {} };       // 樂園卡片：只讀已存的，不重算（快）
  else { h36_daily_(); x = h36_refresh_(id)[id] || { pts: {}, lv: {}, log: {} }; }
  var who = String(p.who || '').trim(), other = null;
  if (who && who !== id) { var lv = h36_rowsMap_()[who]; other = h36_view_(who, lv || { lv: {} }, false); }
  var ym = gm_today_().slice(0, 7), used = gm_rows_('h36rec').filter(function (r) { return String(r[1]) === ym && String(r[2]) === id; }).length;
  var mgr = (me.role >= 3 || gm_isTop_(me)) && !!vid;
  return { success: true, data: h36_view_(id, x, true), other: other, recLeft: Math.max(0, h36_n_('八心每月推薦次數', 3) - used), recPts: h36_n_('八心推薦分數', 5), mgr: mgr, mgrPts: h36_n_('八心頒發分數', 10),
    lvNames: H36_LV, rewards: [0, h36_n_('八心獎勵_銅', 30), h36_n_('八心獎勵_銀', 80), h36_n_('八心獎勵_金', 200)], invReward: h36_n_('無敵8心獎勵', 300), legendReward: h36_n_('傳說無敵8心獎勵', 1000),
    people: Object.keys(gm_emps_()).filter(function (k) { var e = gm_emps_()[k]; return k !== id && !e.resigned; }).map(function (k) { var e = gm_emps_()[k]; return { id: k, name: e.nick || e.name }; }) };
}
// 推薦（夥伴）／頒發（Lv.3 以上）：只能給愛心、善心；一律要有效通行證
function h36_rec_(p) {
  var vid = au_verifiedId_(); if (!vid) return { error: '請更新 App 後重新登入' };
  var me = gm_emp_(vid); if (!me || me.resigned) return { error: '找不到夥伴資料' };
  var to = String(p.to || '').trim(), heart = String(p.heart || ''), why = String(p.reason || '').trim().slice(0, 100), give = String(p.mode || '') === 'give';
  if (!gm_emp_(to) || gm_emp_(to).resigned) return { error: '找不到這位夥伴' };
  if (to === vid) return { error: '不能推薦自己' };
  if (['love', 'kindness'].indexOf(heart) < 0) return { error: '只有愛心和善心可以推薦' };
  if (why.length < 4) return { error: '請寫一句推薦的原因（至少 4 個字）' };
  var ym = gm_today_().slice(0, 7), rows = gm_rows_('h36rec');
  if (give) {
    if (!(me.role >= 3 || gm_isTop_(me))) return { error: '管理者頒發需要 Lv.3 以上' };
  } else {
    if (rows.filter(function (r) { return String(r[1]) === ym && String(r[2]) === vid && Number(r[7]) < 3; }).length >= h36_n_('八心每月推薦次數', 3)) return { error: '這個月的推薦次數用完了，下個月再來' };
  }
  if (rows.some(function (r) { return String(r[1]) === ym && String(r[2]) === vid && String(r[3]) === to && String(r[4]) === heart; })) return { error: '這個月已經' + (give ? '頒發' : '推薦') + '過他這顆心了' };
  var pts = give ? h36_n_('八心頒發分數', 10) : h36_n_('八心推薦分數', 5), name = H36_HEARTS.filter(function (h) { return h[0] === heart; })[0][1];
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try { gm_append_('h36rec', [[gm_now_(), ym, vid, to, heart, why, pts, give ? Math.max(3, me.role) : 1]]); } finally { lock.releaseLock(); }
  GM_CACHE_.h36pts = null; delete GM_CACHE_['rows_h36rec'];
  var x = h36_refresh_(to)[to];
  return { success: true, msg: (give ? '已頒發' : '已推薦') + (gm_emp_(to).nick || gm_emp_(to).name) + '「' + name + '」+' + pts + ' 分', lv: x ? x.lv[heart] : 0 };
}
// 收到的推薦（自己看）
function h36_recv_(p) {
  var vid = au_verifiedId_() || String(p.empId || '').trim(), emps = gm_emps_();
  var data = gm_rows_('h36rec').filter(function (r) { return String(r[3]) === vid; }).slice(-30).reverse().map(function (r) {
    var f = emps[String(r[2])] || {}; return { at: String(r[0]).slice(0, 10), from: f.nick || f.name || '', heart: String(r[4]), reason: String(r[5]), pts: Number(r[6]) || 0, give: Number(r[7]) >= 3 };
  });
  return { success: true, data: data };
}

// 首頁：自己剛升階（7 天內）、全公司「無敵8心」公告（3 天內）
function h36_todo_(empId) {
  var out = [];
  try {
    var id = au_verifiedId_() || String(empId || '').trim(), m = h36_rowsMap_(), t = gm_today_(), d7 = gm_addDays_(t, -7), d3 = gm_addDays_(t, -3), emps = gm_emps_();
    Object.keys(m).forEach(function (k) {
      var log = m[k].log || {}, e = emps[k]; if (!e || e.resigned) return;
      var nm = e.nick || e.name;
      if (log.legend && log.legend >= d3) out.push({ icon: '👑', text: '恭喜 ' + nm + ' 達成「傳說・無敵8心」！', tab: 'hearts', red: false, who: k });
      else if (log.inv && log.inv >= d3) out.push({ icon: '💖', text: '恭喜 ' + nm + ' 達成「無敵8心」！', tab: 'hearts', red: false, who: k });
    });
    var mine = (m[id] || {}).log || {}, ups = [];
    H36_HEARTS.forEach(function (h) { for (var i = 3; i >= 1; i--) if (mine[h[0] + i] && mine[h[0] + i] >= d7) { ups.push(h[2] + h[1] + '・' + H36_LV[i]); break; } });
    if (ups.length) out.push({ icon: '💗', text: '你點亮了 ' + ups.slice(0, 3).join('、') + (ups.length > 3 ? ' 等 ' + ups.length + ' 顆心' : ''), tab: 'hearts', red: false });
  } catch (e) {}
  return out;
}

AU_READ = new RegExp(AU_READ.source.replace('|eqMeta|eqGet|eqFixList)$', '|eqMeta|eqGet|eqFixList|h36Me|h36Recv)$'));

function h36Handler_(action, p) {
  if (action === 'homeTodo') {           // 接在 v1.35 設備清單（eqHandler_）的首頁待辦後面
    try {
      var t = eqHandler_('homeTodo', p);
      if (t && t.success) { var ex = h36_todo_(p.empId); if (ex.length) t.data = (t.data || []).concat(ex); }
      return t;
    } catch (e) { return null; }
  }
  if (action === 'gmScene') {            // 宇宙辦公室：加上 8 心（光環、點小人看得到）
    try {
      var r = s30Handler_('gmScene', p); if (!r || !r.data) return r;
      var hv = h36_levels_(); r.data.hearts = hv;
      Object.keys(hv).forEach(function (id) { if (hv[id].n === 8 && !r.data.titles[id]) r.data.titles[id] = hv[id].g === 8 ? '傳說・無敵8心' : '無敵8心'; });
      return r;
    } catch (e) { return null; }
  }
  var map = { h36Me: h36_me_, h36Rec: h36_rec_, h36Recv: h36_recv_ };
  if (!map[action]) return null;
  try { GM_CACHE_ = {}; return map[action](p); } catch (e) { return { error: e.message }; }
}

function h36_setup() {
  gm_sh_('h36'); gm_sh_('h36rec');
  var have = {}; gm_rows_('params').forEach(function (r) { have[String(r[0]).trim()] = 1; });
  var add = [];
  H36_HEARTS.forEach(function (h) { if (!have['八心門檻_' + h[1]]) add.push(['八心門檻_' + h[1], H36_DEF[h[0]], '無敵8心：' + h[1] + '銅,銀,金門檻（' + h[4] + '）']); });
  [['八心獎勵_銅', 30, '每顆心升到銅給幾枚'], ['八心獎勵_銀', 80, ''], ['八心獎勵_金', 200, ''], ['無敵8心獎勵', 300, '8 顆心都到銅'], ['傳說無敵8心獎勵', 1000, '8 顆心都到金'],
   ['八心每月推薦次數', 3, '每位夥伴每月可以推薦別人愛心／善心幾次'], ['八心推薦分數', 5, ''], ['八心頒發分數', 10, 'Lv.3 以上頒發'], ['八心準時寬限分鐘', 1, '誠心：比班表上班時間晚幾分鐘內還算準時']]
    .forEach(function (x) { if (!have[x[0]]) add.push(x); });
  if (add.length) gm_append_('params', add);
  GM_CACHE_ = {};
  gm_setState_('八心重算日', '');
  var n = Object.keys(h36_refresh_(null)).length;
  gm_setState_('八心重算日', gm_today_());
  Logger.log('h36_setup 完成：新增參數 ' + add.length + ' 個，計算 ' + n + ' 位夥伴');
  return n;
}
