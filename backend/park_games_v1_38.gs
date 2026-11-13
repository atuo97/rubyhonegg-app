// ═══════════════════════════════════════════════════════════════
// v1.38 樂園新遊戲＋挑戰獎勵（2026-11-14）
//   新遊戲：雞蛋糕消消樂（寵物第 1 階段）、雞蛋糕疊疊樂（第 2 階段）、麵糊大作戰三個任務（第 3 階段）
//   1. 一次性挑戰：通關、三星、關卡里程碑 → 赤心幣／扭蛋券／徽章（每人每項一次；12/1 封存後可再拿）
//   2. 每日破紀錄：沿用原規則，小遊戲每日上限 5 → 6（g38_setup 會改〈遊戲參數〉）
//   3. 週冠軍：原本的「小遊戲週冠軍」徽章外，每款第一名再 +20（〈遊戲參數〉「小遊戲週冠軍獎勵」）
//   4. 防作弊：開局時間記在伺服器，過關要玩滿最短秒數；消消樂一天最多 30 局；分數有上限
// 覆蓋：gm_games_、gm_gameStart_、gm_gameScore_、gm_gameWeekly_
//   ★ gm_gameStart_、gm_gameScore_ 會發幣 → 一律以通行證本人為準，沒有通行證就擋下（不退回 p.empId）
// 位置：貼在「無敵8心 v1.36」之後、路由之前。路由不用改（gmGames／gmGameStart／gmGameScore 原本就有）。
// 部署後執行一次 g38_setup()
// ═══════════════════════════════════════════════════════════════

// 編號、名稱、需要的寵物階段、破個人紀錄的獎勵、分數上限
GM_GAMES.push(
  ['match', '雞蛋糕消消樂', 1, 1, 200],          // 分數＝通過的最高關卡
  ['stack', '雞蛋糕疊疊樂', 2, 2, 3000000],
  ['batter1', '麵糊大作戰・守烤爐', 3, 2, 30000],
  ['batter2', '麵糊大作戰・送訂單', 3, 2, 30000],
  ['batter3', '麵糊大作戰・拆過熱烤爐', 3, 2, 30000]
);
GM_SHEETS.g38ch = ['小遊戲挑戰', ['時間', '員工編號', '挑戰編號', '名稱', '赤心幣', '扭蛋券', '徽章']];
GM_BADGES.push(
  ['b38_batter', '麵糊特攻隊', '🍰', '麵糊大作戰三個任務都拿到三星', 30, false],
  ['b38_match', '消消樂達人', '🧇', '雞蛋糕消消樂通過第 20 關', 20, false],
  ['b38_stack', '疊疊樂大師', '🧱', '雞蛋糕疊疊樂單局出爐 50 排', 20, false]
);
GM_PARAM_DEFAULTS.push(['小遊戲週冠軍獎勵', 20, 'v1.38：每款小遊戲週排行第一名，除了徽章再加幾枚']);
if (typeof C31_ARCHIVE !== 'undefined' && C31_ARCHIVE.indexOf('小遊戲挑戰') < 0) C31_ARCHIVE.push('小遊戲挑戰');   // 12/1 一起封存，正式版可再拿

// 過關（或拿分）最短秒數：比這個短就不算
var G38_MIN_WIN = { match: 15, stack: 20, batter1: 85, batter2: 30, batter3: 40 };
var G38_MATCH_DAY_MAX = 30;

// 一次性挑戰：編號、遊戲、名稱、赤心幣、扭蛋券、徽章、條件
var G38_CH = [
  ['b1_clear', 'batter1', '守烤爐・第一次過關', 10, 0, '', function (s, m) { return m.win; }],
  ['b1_star3', 'batter1', '守烤爐・三星', 10, 0, '', function (s, m) { return m.win && m.stars >= 3; }],
  ['b2_clear', 'batter2', '送訂單・第一次過關', 10, 0, '', function (s, m) { return m.win; }],
  ['b2_star3', 'batter2', '送訂單・三星', 10, 0, '', function (s, m) { return m.win && m.stars >= 3; }],
  ['b3_clear', 'batter3', '拆過熱烤爐・第一次過關', 10, 0, '', function (s, m) { return m.win; }],
  ['b3_star3', 'batter3', '拆過熱烤爐・三星', 10, 0, '', function (s, m) { return m.win && m.stars >= 3; }],
  ['b_all3', 'batter*', '麵糊大作戰・三個任務都三星', 0, 0, 'b38_batter', null],   // 另外判斷
  ['m_5', 'match', '消消樂・通過第 5 關', 10, 0, '', function (s, m) { return m.win && s >= 5; }],
  ['m_10', 'match', '消消樂・通過第 10 關', 15, 0, '', function (s, m) { return m.win && s >= 10; }],
  ['m_15', 'match', '消消樂・通過第 15 關', 20, 0, '', function (s, m) { return m.win && s >= 15; }],
  ['m_20', 'match', '消消樂・通過第 20 關', 30, 1, 'b38_match', function (s, m) { return m.win && s >= 20; }],
  ['s_lv5', 'stack', '疊疊樂・升到 Lv 5', 10, 0, '', function (s, m) { return m.level >= 5; }],
  ['s_lv10', 'stack', '疊疊樂・升到 Lv 10', 20, 0, '', function (s, m) { return m.level >= 10; }],
  ['s_50', 'stack', '疊疊樂・單局出爐 50 排', 0, 1, 'b38_stack', function (s, m) { return m.lines >= 50; }]
];

function g38_done_(emp) { var d = {}; gm_rows_('g38ch').forEach(function (r) { if (r[1] === emp) d[r[2]] = r[0]; }); return d; }
function g38_cache_() { return CacheService.getScriptCache(); }
function g38_me_(p) {   // 會發幣的動作：只認通行證本人
  var id = typeof au_verifiedId_ === 'function' ? au_verifiedId_() : '';
  if (!id) return { error: '請更新 App 後重新登入' };
  if (p.empId && String(p.empId).trim() !== id) return { error: '登入身分不符，請重新登入' };
  return { id: id };
}

// 覆蓋：遊戲清單（多回傳挑戰清單）
function gm_games_(p) {
  var emp = String(p.empId || '').trim(), pet = gm_pet_(emp), today = gm_today_(), wk = gm_weekFrom_(today), emps = gm_emps_();
  var best = {}, week = {}, todayGot = 0;
  gm_rows_('games').forEach(function (r) {
    var g = r[3], sc = Number(r[4]) || 0;
    if (r[2] === emp) { best[g] = Math.max(best[g] || 0, sc); if (String(r[1]) === today) todayGot += Number(r[5]) || 0; }
    if (String(r[1]) >= wk) { var k = g + '|' + r[2]; week[k] = Math.max(week[k] || 0, sc); }
  });
  var games = GM_GAMES.map(function (g) {
    var top = Object.keys(week).filter(function (k) { return k.split('|')[0] === g[0]; }).map(function (k) { var id = k.split('|')[1]; return { name: emps[id] ? (emps[id].nick || emps[id].name) : id, score: week[k], me: id === emp }; })
      .sort(function (a, b) { return b.score - a.score; }).slice(0, 5);
    return { id: g[0], name: g[1], stage: g[2], reward: g[3], unlocked: !!pet && pet.stage >= g[2], best: best[g[0]] || 0, top: top };
  });
  var lives = pet ? Number((gm_rows_('pets')[pet.row - 2] || [])[6]) || 0 : 0;
  var done = g38_done_(emp);
  var ch = G38_CH.map(function (c) { return { id: c[0], game: c[1], name: c[2], coins: c[3], tix: c[4], badge: c[5] ? (gm_badgeDef_(c[5]) || [])[1] || '' : '', badgeCoins: c[5] ? (gm_badgeDef_(c[5]) || [])[4] || 0 : 0, done: !!done[c[0]] }; });
  return { success: true, data: { pet: pet, games: games, todayGot: todayGot, cap: Number(gm_param_('小遊戲每日上限')) || 6, extraLives: lives,
    challenges: ch, weekBonus: Number(gm_param_('小遊戲週冠軍獎勵')) || 0, v: 38 } };
}

// 覆蓋：開局（記下開局時間；有寵物零食的命就用掉一條）
function gm_gameStart_(p) {
  var me = g38_me_(p); if (me.error) return me; var emp = me.id;
  var pet = gm_pet_(emp); if (!pet) return { error: '先領養寵物才能玩' };
  var g = GM_GAMES.filter(function (x) { return x[0] === p.game; })[0]; if (!g) return { error: '沒有這款遊戲' };
  if (pet.stage < g[2]) return { error: '寵物長到第 ' + g[2] + ' 階段才解鎖' };
  if (g[0] === 'match') {
    var today = gm_today_(), n = gm_rows_('games').filter(function (r) { return r[2] === emp && r[3] === 'match' && String(r[1]) === today; }).length;
    if (n >= G38_MATCH_DAY_MAX) return { error: '消消樂今天已經玩 ' + n + ' 局了，明天再來！' };
  }
  var lives = Number(gm_rows_('pets')[pet.row - 2][6]) || 0, extra = 0;
  if (lives > 0 && ['catch', 'breakout', 'runner'].indexOf(g[0]) >= 0) {   // 寵物零食的命只用在有「命」的遊戲
    var rng = gm_sh_('pets').getRange(pet.row, 7); rng.setNumberFormat('@'); rng.setValue(String(lives - 1)); extra = 1; GM_CACHE_.rows_pets = null;
  }
  g38_cache_().put('G38|' + emp + '|' + g[0], String(Date.now()), 21600);
  return { success: true, data: { extra: extra, left: Math.max(0, lives - extra) } };
}

// 覆蓋：送分數（破紀錄獎勵＋一次性挑戰）
function gm_gameScore_(p) {
  var me = g38_me_(p); if (me.error) return me; var emp = me.id;
  var e = gm_emp_(emp); if (!e || e.resigned) return { error: '帳號無法使用' };
  var g = GM_GAMES.filter(function (x) { return x[0] === p.game; })[0]; if (!g) return { error: '沒有這款遊戲' };
  var pet = gm_pet_(emp); if (!pet || pet.stage < g[2]) return { error: '這款遊戲還沒解鎖' };
  var ck = 'G38|' + emp + '|' + g[0], t0 = Number(g38_cache_().get(ck)) || 0;
  if (!t0) return { error: '這一局沒有開局紀錄，請重新開始' };
  g38_cache_().remove(ck);   // 一次開局只能送一次分數
  var sec = (Date.now() - t0) / 1000, meta = p.meta && typeof p.meta === 'object' ? p.meta : {};
  if (typeof p.meta === 'string') { try { meta = JSON.parse(p.meta) || {}; } catch (x) { meta = {}; } }
  var m = { win: meta.win === true || meta.win === 'true' || meta.win === 1, stars: Math.max(0, Math.min(3, Number(meta.stars) || 0)),
            level: Math.max(0, Math.min(99, Number(meta.level) || 0)), lines: Math.max(0, Math.min(9999, Number(meta.lines) || 0)) };
  var score = Math.max(0, Math.min(g[4], Math.round(Number(p.score) || 0))), today = gm_today_();
  // 防作弊：新遊戲過關要玩滿最短秒數；疊疊樂排數不能比時間快太多
  var minS = G38_MIN_WIN[g[0]];
  if (minS && sec < minS && (m.win || g[0] === 'stack')) { score = 0; m.win = false; m.stars = 0; m.level = 0; m.lines = 0; }
  if (g[0] === 'stack' && m.lines > sec / 0.9) m.lines = Math.floor(sec / 0.9);   // 一排至少約 0.9 秒
  if (g[0] === 'match') { if (!m.win) score = 0; else if (score > 0) { var bestLv = 0; gm_rows_('games').forEach(function (r) { if (r[2] === emp && r[3] === 'match') bestLv = Math.max(bestLv, Number(r[4]) || 0); }); if (score > bestLv + 1) score = bestLv + 1; } }   // 一次只能往前推一關
  var best = 0, got = 0;
  gm_rows_('games').forEach(function (r) { if (r[2] === emp) { if (r[3] === g[0]) best = Math.max(best, Number(r[4]) || 0); if (String(r[1]) === today) got += Number(r[5]) || 0; } });
  var open = today >= gm_param_('測試版開始日');
  var cap = Number(gm_param_('小遊戲每日上限')) || 6, reward = 0;
  if (score > best && score > 0 && open) {
    reward = Math.max(0, Math.min(g[3], cap - got));
    if (reward) gm_credit_(emp, '小遊戲', reward, g[1] + ' 破個人紀錄(' + score + ' 分)', 'GAME|' + emp + '|' + g[0] + '|' + gm_now_() + '|' + score);
  }
  gm_append_('games', [[gm_now_(), today, emp, g[0], score, reward]]);
  var newCh = open ? g38_check_(emp, g[0], score, m) : [];
  return { success: true, data: { score: score, best: Math.max(best, score), newRecord: score > best, reward: reward, challenges: newCh } };
}

function g38_give_(emp, c, done, out) {
  if (done[c[0]]) return;
  var badge = c[5] ? gm_badgeDef_(c[5]) : null;
  gm_append_('g38ch', [[gm_now_(), emp, c[0], c[2], c[3], c[4], badge ? badge[1] : '']]);
  done[c[0]] = 1;
  if (c[3]) gm_credit_(emp, '小遊戲挑戰', c[3], '挑戰「' + c[2] + '」', 'G38CH|' + emp + '|' + c[0]);
  if (c[4] && typeof s30_tixAdd_ === 'function') s30_tixAdd_(emp, c[4], '挑戰「' + c[2] + '」', 'G38TIX|' + emp + '|' + c[0]);
  if (badge) gm_award_(emp, c[5], '');
  out.push({ id: c[0], name: c[2], coins: c[3] + (badge ? badge[4] || 0 : 0), tix: c[4], badge: badge ? badge[2] + ' ' + badge[1] : '' });
}
function g38_check_(emp, game, score, m) {
  var done = g38_done_(emp), out = [];
  G38_CH.forEach(function (c) { if (c[1] === game && c[6] && c[6](score, m)) g38_give_(emp, c, done, out); });
  if (/^batter/.test(game) && done.b1_star3 && done.b2_star3 && done.b3_star3) g38_give_(emp, G38_CH.filter(function (c) { return c[0] === 'b_all3'; })[0], done, out);
  return out;
}

// 覆蓋：每週一頒上週各遊戲第一名（徽章＋週冠軍獎勵）
function gm_gameWeekly_(today) {
  if (((new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7) !== 0) return;
  var from = gm_addDays_(today, -7), to = gm_addDays_(today, -1), top = {}, bonus = Number(gm_param_('小遊戲週冠軍獎勵')) || 0;
  gm_rows_('games').forEach(function (r) {
    var d = String(r[1]); if (d < from || d > to) return;
    var sc = Number(r[4]) || 0; if (!top[r[3]] || sc > top[r[3]].sc) top[r[3]] = { emp: r[2], sc: sc };
  });
  Object.keys(top).forEach(function (g) {
    if (!(top[g].sc > 0) || gm_isFrozen_(top[g].emp)) return;
    gm_award_(top[g].emp, 'gamer', g + '|' + from);
    var gd = GM_GAMES.filter(function (x) { return x[0] === g; })[0];
    if (bonus) gm_credit_(top[g].emp, '小遊戲', bonus, '小遊戲週冠軍「' + (gd ? gd[1] : g) + '」(' + from + ' 那週)', 'GWEEK|' + g + '|' + from);
  });
}

// 部署後執行一次
function g38_setup() {
  GM_CACHE_ = {};
  gm_sh_('g38ch');
  var sh = gm_sh_('params'), rows = gm_rows_('params'), found = {};
  rows.forEach(function (r, i) { found[String(r[0]).trim()] = i + 2; });
  if (found['小遊戲每日上限']) { var c = sh.getRange(found['小遊戲每日上限'], 2); if (Number(c.getValue()) === 5) c.setValue(6); }
  else gm_append_('params', [['小遊戲每日上限', 6, '小遊戲破紀錄獎勵,每天全部遊戲合計最多幾枚']]);
  if (!found['小遊戲週冠軍獎勵']) gm_append_('params', [['小遊戲週冠軍獎勵', 20, 'v1.38：每款小遊戲週排行第一名，除了徽章再加幾枚']]);
  Logger.log('g38_setup 完成');
  return true;
}
