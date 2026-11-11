// ═══════════════════════════════════════════════════════════════
// 紅玉滿宇宙:PvP 對戰(自動＋即時)、百貨櫃位塔防戰、夥伴小店   v1.19(2026-11-11:寵物屬性與相剋)
// 需要先安裝「後端_宇宙遊戲化」模組(共用 gm_ 開頭的工具、赤心幣、商品目錄)。
// 安裝:貼到 Apps Script 最底部;extHandler_ 內加一行:
//   var pv = pvHandler_(action, p); if (pv) return pv;
// 執行一次 pv_setup() 建立工作表與預設參數。塔防週戰由 gm_dailyJob 每週一自動結算。
// ═══════════════════════════════════════════════════════════════
var PV_SHEETS = {
  equip:  ['對戰裝備', ['員工編號', '武器', '防具', '卡片', '參加']],
  duels:  ['對戰紀錄', ['時間', '日期', '挑戰者', '對手', '勝者', '模式', '紀錄']],
  live:   ['即時對戰', ['編號', '挑戰者', '對手', '狀態', '建立時間', '更新時間', '狀態資料']],
  towers: ['塔防', ['櫃位', '箭塔', '砲塔', '城牆', '累計投入']],
  tdLog:  ['塔防戰報', ['週', '櫃位A', '櫃位B', '勝者', '紀錄']],
  tdGive: ['塔防投入', ['時間', '員工編號', '櫃位', '塔', '數量']],
  shops:  ['小店', ['員工編號', '店名', '店型', '開店時間', '價格', '營收', '銷售次數', '公告']],
  sales:  ['小店交易', ['時間', '店主', '買家', '物品編號', '價格', '店主收入', '收件人']],
  gifts:  ['禮物', ['時間', '送禮人', '收禮人', '物品編號', '已讀']]
};
var PV_PARAMS = [
  ['對戰每日次數', 5, '自動切磋每天可以挑戰幾次'],
  ['對戰勝利獎勵', 2, '贏一場給幾枚(自動與即時合計每天上限見下)'],
  ['對戰每日獎勵上限', 10, ''],
  ['即時對戰每回合秒數', 20, '時間到沒出招,自動普通攻擊'],
  ['塔防升級基本價', 50, '升到 n+1 級要投入 基本價×n 枚'],
  ['塔防營業額換算', 10000, '每週營業額每多少元 = 1 點攻擊加成'],
  ['塔防冠軍獎勵', 300, '每週冠軍櫃位,依該週上班時數分給夥伴'],
  ['小店開店費', 100, ''],
  ['小店店主分潤', 80, '百分比,其餘由系統回收'],
  ['小店價格下限', 80, '建議價的百分比'],
  ['小店價格上限', 150, '建議價的百分比']
];
var PV_SHOP_TYPES = ['咖啡店', '甜點店', '花店', '武器鋪', '卡片屋', '雜貨店'];
var PV_BASE = { hp: 100, atk: 10, def: 5, spd: 5 };

function pv_sh_(k) {
  var key = 'pv_' + k; if (GM_CACHE_['sh_' + key]) return GM_CACHE_['sh_' + key];
  var d = PV_SHEETS[k], sh = gm_ss_().getSheetByName(d[0]);
  if (!sh) { sh = gm_ss_().insertSheet(d[0]); sh.getRange(1, 1, 1, d[1].length).setValues([d[1]]); sh.setFrozenRows(1); }
  GM_SHEETS[key] = d; return (GM_CACHE_['sh_' + key] = sh);
}
function pv_rows_(k) { pv_sh_(k); return gm_rows_('pv_' + k); }
function pv_append_(k, rows) { pv_sh_(k); gm_append_('pv_' + k, rows); }
function pv_param_(n) { var v = gm_param_(n); if (v === undefined) PV_PARAMS.forEach(function (p) { if (p[0] === n) v = p[1]; }); return Number(v); }
function pv_setup() {
  Object.keys(PV_SHEETS).forEach(function (k) { pv_sh_(k); });
  var have = {}; gm_rows_('params').forEach(function (r) { have[String(r[0]).trim()] = 1; });
  var add = PV_PARAMS.filter(function (p) { return !have[p[0]]; }); if (add.length) gm_append_('params', add);
  if (typeof gm_setup === 'function') gm_setup();
  return '已建立對戰、塔防、小店工作表';
}
function pv_stats_(itemId) {    // "atk:3,spd:1" → {atk:3,spd:1};"card:heal:30" → {card:'heal',val:30}
  var c = gm_catalog_()[itemId]; if (!c) return {};
  var s = String(c.note || ''), o = {};
  if (/^card:/.test(s)) { var a = s.split(':'); return { card: a[1], val: Number(a[2]) || 0 }; }
  s.split(',').forEach(function (kv) { var a = kv.split(':'); if (a.length === 2 && PV_BASE[a[0]] != null) o[a[0]] = Number(a[1]) || 0; });
  return o;
}

// ───────── 角色與裝備 ─────────
function pv_equipRow_(emp) {
  var rows = pv_rows_('equip');
  for (var i = 0; i < rows.length; i++) if (rows[i][0] === emp) return { row: i + 2, weapon: String(rows[i][1] || ''), armor: String(rows[i][2] || ''), cards: pv_json_(rows[i][3], []), join: String(rows[i][4]) !== 'N' };
  return { row: 0, weapon: '', armor: '', cards: [], join: true };
}
function pv_json_(v, d) { try { return v ? JSON.parse(v) : d; } catch (e) { return d; } }
function pv_fighter_(emp) {
  var e = gm_emp_(emp); if (!e) return null;
  var q = pv_equipRow_(emp), own = gm_owned_(emp), st = { hp: PV_BASE.hp, atk: PV_BASE.atk, def: PV_BASE.def, spd: PV_BASE.spd };
  [q.weapon, q.armor].forEach(function (id) { if (id && own[id]) { var s = pv_stats_(id); Object.keys(s).forEach(function (k) { if (st[k] != null) st[k] += s[k]; }); } });
  var pet = gm_pet_(emp); if (pet) st.hp += pet.stage * 4;           // 寵物陪伴:每階段 +4 體力
  st.crit = 0;
  if (pet && pet.type && PV_PET_ATTR[pet.type]) {                    // v1.19 寵物屬性:第 2~5 階段發揮 25/50/75/100%
    var at = PV_PET_ATTR[pet.type], pct = [0, 0, 0.25, 0.5, 0.75, 1][pet.stage] || 0;
    st[at.stat] += at.stat === 'crit' ? at.val * pct : Math.round(at.val * pct);
  }
  var cards = q.cards.filter(function (c) { return own[c]; }).slice(0, 3).map(function (c) { var s = pv_stats_(c); return { id: c, name: gm_catalog_()[c].name, kind: s.card, val: s.val }; });
  var cat = gm_catalog_();
  return { id: emp, name: e.nick || e.name, stats: st, weapon: q.weapon && own[q.weapon] ? cat[q.weapon].name : '', armor: q.armor && own[q.armor] ? cat[q.armor].name : '', cards: cards, join: q.join, pet: pet ? pet.stage : 0,
           petType: pet && pet.type ? pet.type : '', petTypeName: pet && pet.type ? pet.typeName : '' };
}
function pv_setEquip_(p) {
  var emp = String(p.empId || '').trim(); if (!gm_emp_(emp)) return { error: '找不到此帳號' };
  var own = gm_owned_(emp), cat = gm_catalog_(), q = pv_equipRow_(emp);
  var w = p.weapon != null ? String(p.weapon) : q.weapon, a = p.armor != null ? String(p.armor) : q.armor;
  var cards = p.cards != null ? pv_json_(p.cards, []) : q.cards, join = p.join != null ? String(p.join) !== 'N' && p.join !== false : q.join;
  if (w && (!own[w] || cat[w].cat !== 'weapon')) return { error: '還沒擁有這把武器' };
  if (a && (!own[a] || cat[a].cat !== 'armor')) return { error: '還沒擁有這件防具' };
  cards = cards.filter(function (c, i) { return own[c] && cat[c].cat === 'card' && cards.indexOf(c) === i; }).slice(0, 3);
  var row = [emp, w, a, JSON.stringify(cards), join ? 'Y' : 'N'];
  if (q.row) { var rng = pv_sh_('equip').getRange(q.row, 1, 1, 5); rng.setNumberFormat('@'); rng.setValues([row]); GM_CACHE_.rows_pv_equip = null; }
  else pv_append_('equip', [row]);
  return { success: true, data: pv_fighter_(emp) };
}

// ───────── 寵物屬性與相剋(v1.19,隊長 11/11 定案)─────────
// 暴龍攻擊型、三角龍防禦型、火車速度型、挖土機體力型、雞幸運型(爆擊率,百分點)
var PV_PET_ATTR = { trex: { stat: 'atk', val: 3, label: '攻擊型' }, trice: { stat: 'def', val: 2, label: '防禦型' },
                    train: { stat: 'spd', val: 2, label: '速度型' }, digger: { stat: 'hp', val: 15, label: '體力型' }, chicken: { stat: 'crit', val: 5, label: '幸運型' } };
// 五種循環相剋:每種剋 2 種、被 2 種剋
var PV_COUNTER = { trex: ['trice', 'digger'], trice: ['digger', 'train'], digger: ['train', 'chicken'], train: ['chicken', 'trex'], chicken: ['trex', 'trice'] };
function pv_counterMult_(a, b) {
  var ta = a.petType, tb = b.petType;
  return ta && tb && (PV_COUNTER[ta] || []).indexOf(tb) >= 0 ? (Number(gm_param_('相剋傷害倍率')) || 1.2) : 1;
}

// ───────── 戰鬥核心(自動與即時共用)─────────
// 招式:attack 普通攻擊、defend 防禦(受傷×0.4,回 3)、skill 必殺(×1.8,冷卻 3 回合)、card 使用卡片(每張一場一次)
function pv_rand_(seed) { var x = Math.sin(seed) * 10000; return x - Math.floor(x); }
function pv_newBattle_(A, B) {
  return { round: 0, hp: { A: A.stats.hp, B: B.stats.hp }, max: { A: A.stats.hp, B: B.stats.hp }, cd: { A: 0, B: 0 }, used: { A: [], B: [] },
           buff: { A: 0, B: 0 }, shield: { A: 0, B: 0 }, log: [], f: { A: A, B: B }, done: false, winner: '' };
}
function pv_round_(S, mA, mB, seed) {   // m = {move:'attack'|'defend'|'skill'|'card', card:id}
  S.round++;
  var side = ['A', 'B'], m = { A: mA, B: mB }, ev = { round: S.round, A: {}, B: {} };
  side.forEach(function (s) {           // 先處理卡片、冷卻
    var mv = m[s] || { move: 'attack' };
    if (mv.move === 'skill' && S.cd[s] > 0) mv = { move: 'attack' };
    if (mv.move === 'card') {
      var c = (S.f[s].cards || []).filter(function (x) { return x.id === mv.card && S.used[s].indexOf(x.id) < 0; })[0];
      if (!c) mv = { move: 'attack' };
      else {
        S.used[s].push(c.id); ev[s].card = c.name;
        if (c.kind === 'heal') { var h = Math.min(c.val, S.max[s] - S.hp[s]); S.hp[s] += h; ev[s].heal = h; }
        if (c.kind === 'power') S.buff[s] = c.val;
        if (c.kind === 'shield') S.shield[s] += c.val;
      }
    }
    m[s] = mv; ev[s].move = mv.move;
  });
  side.forEach(function (s, i) {        // 攻擊
    var o = side[1 - i], mv = m[s];
    if (mv.move === 'defend') { var hh = Math.min(3, S.max[s] - S.hp[s]); S.hp[s] += hh; ev[s].heal = (ev[s].heal || 0) + hh; return; }
    var atk = S.f[s].stats.atk * (1 + S.buff[s] / 100), r = 0.85 + pv_rand_(seed + i * 7 + S.round) * 0.3;
    var mult = mv.move === 'skill' ? 1.8 : mv.move === 'card' ? 0.6 : 1;
    var crit = pv_rand_(seed * 3 + i + S.round * 11) < 0.05 + S.f[s].stats.spd / 200 + (S.f[s].stats.crit || 0) / 100;
    var dmg = Math.max(1, Math.round((atk * mult - S.f[o].stats.def * 0.5) * r * (crit ? 1.5 : 1) * pv_counterMult_(S.f[s], S.f[o])));
    if (pv_counterMult_(S.f[s], S.f[o]) > 1) ev[s].counter = true;
    if (m[o].move === 'defend') dmg = Math.max(1, Math.round(dmg * 0.4));
    if (S.shield[o] > 0) { var ab = Math.min(S.shield[o], dmg); S.shield[o] -= ab; dmg -= ab; ev[o].absorb = ab; }
    S.hp[o] = Math.max(0, S.hp[o] - dmg); ev[s].dmg = dmg; ev[s].crit = crit;
    if (mv.move === 'skill') S.cd[s] = 3;
    if (S.buff[s] && mv.move !== 'card') S.buff[s] = 0;
  });
  side.forEach(function (s) { if (S.cd[s] > 0 && m[s].move !== 'skill') S.cd[s]--; });
  ev.hp = { A: S.hp.A, B: S.hp.B }; S.log.push(ev);
  if (S.hp.A <= 0 || S.hp.B <= 0 || S.round >= 20) {
    S.done = true;
    S.winner = S.hp.A === S.hp.B ? (S.f.A.stats.spd >= S.f.B.stats.spd ? 'A' : 'B') : (S.hp.A / S.max.A >= S.hp.B / S.max.B ? 'A' : 'B');
  }
  return S;
}
function pv_ai_(S, s, seed) {           // 自動對戰的出招
  var me = S.f[s], hpPct = S.hp[s] / S.max[s], r = pv_rand_(seed + S.round * 13);
  var avail = (me.cards || []).filter(function (c) { return S.used[s].indexOf(c.id) < 0; });
  var heal = avail.filter(function (c) { return c.kind === 'heal'; })[0];
  if (heal && hpPct < 0.45) return { move: 'card', card: heal.id };
  var other = avail.filter(function (c) { return c.kind !== 'heal'; })[0];
  if (other && r < 0.25) return { move: 'card', card: other.id };
  if (S.cd[s] === 0 && r < 0.6) return { move: 'skill' };
  if (r > 0.85) return { move: 'defend' };
  return { move: 'attack' };
}
function pv_reward_(winner, loser, mode) {
  var today = gm_today_(), cap = pv_param_('對戰每日獎勵上限'), got = 0;
  gm_rows_('ledger').forEach(function (r) { if (r[1] === winner && r[2] === '對戰勝利' && String(r[0]).slice(0, 10) === today) got += Number(r[3]) || 0; });
  var amt = Math.min(pv_param_('對戰勝利獎勵'), Math.max(0, cap - got));
  if (amt > 0) gm_credit_(winner, '對戰勝利', amt, mode + '勝過 ' + (gm_emp_(loser).nick || gm_emp_(loser).name), 'DUELWIN|' + winner + '|' + gm_now_() + '|' + Math.random());
  return amt;
}

// ───────── 自動切磋 ─────────
function pv_duel_(p) {
  var a = String(p.empId || '').trim(), b = String(p.to || '').trim(), today = gm_today_();
  if (!gm_emp_(a) || gm_isFrozen_(a)) return { error: '帳號無法使用' };
  if (!gm_emp_(b) || gm_isFrozen_(b) || a === b) return { error: '找不到對手' };
  if (today < gm_param_('測試版開始日')) return { error: '對戰將於測試版開始後開放' };
  var used = pv_rows_('duels').filter(function (r) { return String(r[1]) === today && r[2] === a && r[5] === '自動'; }).length;
  if (used >= pv_param_('對戰每日次數')) return { error: '今天的切磋次數用完了' };
  var A = pv_fighter_(a), B = pv_fighter_(b);
  if (!B.join) return { error: '對方設定為不參加對戰' };
  var S = pv_newBattle_(A, B), seed = gm_hash_(a + b + gm_now_()) % 100000;
  while (!S.done) pv_round_(S, pv_ai_(S, 'A', seed), pv_ai_(S, 'B', seed + 50), seed);
  var win = S.winner === 'A' ? a : b, lose = win === a ? b : a;
  pv_append_('duels', [[gm_now_(), today, a, b, win, '自動', JSON.stringify(S.log)]]);
  var coin = pv_reward_(win, lose, '切磋');
  return { success: true, data: { A: A, B: B, log: S.log, winner: win, reward: win === a ? coin : 0, left: pv_param_('對戰每日次數') - used - 1 } };
}

// ───────── 即時對戰 ─────────
function pv_liveFind_(id) {
  var rows = pv_rows_('live');
  for (var i = 0; i < rows.length; i++) if (String(rows[i][0]) === String(id)) return { row: i + 2, r: rows[i], S: pv_json_(rows[i][6], null) };
  return null;
}
function pv_liveSave_(L, status, S) {
  var rng = pv_sh_('live').getRange(L.row, 4, 1, 4); rng.setNumberFormat('@');
  rng.setValues([[status, String(L.r[4]), gm_now_(), JSON.stringify(S)]]);
  GM_CACHE_.rows_pv_live = null;
}
function pv_liveInvite_(p) {
  var a = String(p.empId || '').trim(), b = String(p.to || '').trim();
  if (!gm_emp_(a) || gm_isFrozen_(a) || !gm_emp_(b) || gm_isFrozen_(b) || a === b) return { error: '找不到對手' };
  if (gm_today_() < gm_param_('測試版開始日')) return { error: '對戰將於測試版開始後開放' };
  if (!pv_fighter_(b).join) return { error: '對方設定為不參加對戰' };
  var id = 'L' + Date.now().toString(36) + Math.floor(Math.random() * 1000);
  pv_append_('live', [[id, a, b, '邀請中', gm_now_(), gm_now_(), JSON.stringify({ invitedAt: Date.now() })]]);
  return { success: true, data: { id: id } };
}
function pv_liveMine_(p) {
  var me = String(p.empId || '').trim(), now = Date.now(), out = [];
  pv_rows_('live').forEach(function (r) {
    if (r[1] !== me && r[2] !== me) return;
    var S = pv_json_(r[6], {}), st = String(r[3]);
    if (st === '邀請中' && now - (S.invitedAt || 0) > 120000) st = '已過期';
    if (st === '對戰中' && S.deadline && now - S.deadline > 120000) st = '已中斷';
    if (st !== '邀請中' && st !== '對戰中') return;
    var a = gm_emp_(r[1]), b = gm_emp_(r[2]);
    out.push({ id: r[0], from: r[1], to: r[2], fromName: a ? (a.nick || a.name) : r[1], toName: b ? (b.nick || b.name) : r[2], status: st, mine: r[1] === me });
  });
  return { success: true, data: out };
}
function pv_liveAccept_(p) {
  var me = String(p.empId || '').trim(), L = pv_liveFind_(p.id); if (!L) return { error: '找不到這場對戰' };
  if (L.r[2] !== me) return { error: '這不是給你的邀請' };
  if (String(L.r[3]) !== '邀請中' || Date.now() - (L.S.invitedAt || 0) > 120000) return { error: '邀請已過期' };
  if (p.decline) { pv_liveSave_(L, '已拒絕', L.S); return { success: true }; }
  var S = pv_newBattle_(pv_fighter_(L.r[1]), pv_fighter_(L.r[2]));
  S.moves = { A: null, B: null }; S.deadline = Date.now() + pv_param_('即時對戰每回合秒數') * 1000;
  pv_liveSave_(L, '對戰中', S);
  return { success: true, data: pv_livePublic_(L.r, S, me) };
}
function pv_livePublic_(r, S, me) {
  var side = r[1] === me ? 'A' : 'B';
  return { id: r[0], side: side, round: S.round, hp: S.hp, max: S.max, cd: S.cd, used: S.used, shield: S.shield, buff: S.buff,
           fighters: { A: S.f.A, B: S.f.B }, waiting: S.moves ? { A: !!S.moves.A, B: !!S.moves.B } : {}, deadline: S.deadline,
           log: S.log.slice(-6), done: S.done, winner: S.done ? (S.winner === 'A' ? r[1] : r[2]) : '', reward: S.reward || 0, now: Date.now() };
}
function pv_liveTick_(L) {   // 雙方都出招或時間到 → 結算一回合
  var S = L.S; if (!S || S.done || String(L.r[3]) !== '對戰中') return S;
  var bothIn = S.moves.A && S.moves.B, timeout = Date.now() > S.deadline;
  if (!bothIn && !timeout) return S;
  pv_round_(S, S.moves.A || { move: 'attack' }, S.moves.B || { move: 'attack' }, gm_hash_(L.r[0]) % 100000);
  S.moves = { A: null, B: null }; S.deadline = Date.now() + pv_param_('即時對戰每回合秒數') * 1000;
  if (S.done) {
    var win = S.winner === 'A' ? L.r[1] : L.r[2], lose = win === L.r[1] ? L.r[2] : L.r[1];
    S.reward = pv_reward_(win, lose, '即時對戰');
    pv_append_('duels', [[gm_now_(), gm_today_(), L.r[1], L.r[2], win, '即時', JSON.stringify(S.log)]]);
    pv_liveSave_(L, '已結束', S);
  } else pv_liveSave_(L, '對戰中', S);
  return S;
}
function pv_liveMove_(p) {
  var me = String(p.empId || '').trim(), L = pv_liveFind_(p.id); if (!L) return { error: '找不到這場對戰' };
  if (L.r[1] !== me && L.r[2] !== me) return { error: '你不在這場對戰裡' };
  var S = pv_liveTick_(L); if (S.done) return { success: true, data: pv_livePublic_(L.r, S, me) };
  var side = L.r[1] === me ? 'A' : 'B', mv = String(p.move || 'attack');
  if (['attack', 'defend', 'skill', 'card'].indexOf(mv) < 0) mv = 'attack';
  S.moves[side] = { move: mv, card: String(p.card || '') };
  pv_liveSave_(L, '對戰中', S); L.S = S;
  S = pv_liveTick_(L);
  return { success: true, data: pv_livePublic_(L.r, S, me) };
}
function pv_liveState_(p) {
  var me = String(p.empId || '').trim(), L = pv_liveFind_(p.id); if (!L) return { error: '找不到這場對戰' };
  if (String(L.r[3]) === '邀請中') return { success: true, data: { id: L.r[0], status: '邀請中', now: Date.now() } };
  if (String(L.r[3]) === '已拒絕') return { success: true, data: { id: L.r[0], status: '已拒絕' } };
  var S = pv_liveTick_(L);
  return { success: true, data: pv_livePublic_(L.r, S, me) };
}

// ───────── 對戰總覽 ─────────
function pv_me_(p) {
  var emp = String(p.empId || '').trim(), e = gm_emp_(emp); if (!e) return { error: '找不到此帳號' };
  var cat = gm_catalog_(), own = gm_owned_(emp), today = gm_today_(), ym = today.slice(0, 7);
  var inv = Object.keys(own).filter(function (k) { return cat[k] && ['weapon', 'armor', 'card'].indexOf(cat[k].cat) >= 0; })
    .map(function (k) { var c = cat[k], s = pv_stats_(k); return { id: k, name: c.name, cat: c.cat, tier: c.tier, stats: s }; });
  var opp = [], emps = gm_emps_();
  Object.keys(emps).forEach(function (id) { if (id !== emp && !emps[id].resigned) { var f = pv_fighter_(id); if (f.join) opp.push({ id: id, name: f.name, power: f.stats.atk * 3 + f.stats.def * 2 + f.stats.hp / 5 + f.stats.spd, petType: f.petType, petTypeName: f.petTypeName }); } });
  var wins = {}, mine = [];
  pv_rows_('duels').forEach(function (r) {
    if (String(r[1]).slice(0, 7) === ym) wins[r[4]] = (wins[r[4]] || 0) + 1;
    if (r[2] === emp || r[3] === emp) mine.push({ time: String(r[0]), vs: r[2] === emp ? r[3] : r[2], win: r[4] === emp, mode: r[5] });
  });
  var rank = Object.keys(wins).map(function (k) { return { id: k, name: emps[k] ? (emps[k].nick || emps[k].name) : k, wins: wins[k] }; }).sort(function (a, b) { return b.wins - a.wins; }).slice(0, 10);
  var used = pv_rows_('duels').filter(function (r) { return String(r[1]) === today && r[2] === emp && r[5] === '自動'; }).length;
  var q = pv_equipRow_(emp);
  return { success: true, data: { me: pv_fighter_(emp), equip: { weapon: q.weapon, armor: q.armor, cards: q.cards, join: q.join }, inventory: inv, opponents: opp,
    ranking: rank, history: mine.slice(-10).reverse().map(function (h) { var x = emps[h.vs]; h.vsName = x ? (x.nick || x.name) : h.vs; return h; }),
    left: Math.max(0, pv_param_('對戰每日次數') - used), roundSec: pv_param_('即時對戰每回合秒數') } };
}

// ───────── 塔防戰(百貨櫃位)─────────
function td_counters_() {   // 業績類型含「百貨」的營運中固定櫃位
  var sh = gm_ss_().getSheetByName('櫃位設定'), out = [];
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues().forEach(function (r) {
    var n = String(r[0]).trim(); if (!n) return;
    if (/百貨/.test(String(r[2])) && !/結束|停/.test(String(r[4])) && String(r[5]).trim() !== '活動') out.push(n);
  });
  return out;
}
function td_tower_(loc) {
  var rows = pv_rows_('towers');
  for (var i = 0; i < rows.length; i++) if (rows[i][0] === loc) return { row: i + 2, loc: loc, arrow: Number(rows[i][1]) || 1, cannon: Number(rows[i][2]) || 1, wall: Number(rows[i][3]) || 1, total: Number(rows[i][4]) || 0 };
  return { row: 0, loc: loc, arrow: 1, cannon: 1, wall: 1, total: 0 };
}
function td_weekRange_(d) {   // 週一~週日
  var t = new Date(d + 'T00:00:00Z'), wd = (t.getUTCDay() + 6) % 7, mon = gm_addDays_(d, -wd);
  return { from: mon, to: gm_addDays_(mon, 6) };
}
function td_revenue_(loc, from, to) { var s = 0; gm_closeRows_().forEach(function (c) { if (c.loc === loc && c.date >= from && c.date <= to) s += c.rev; }); return s; }
function td_myCounter_(emp) {    // 最近 30 天上班時數最多的百貨櫃位
  var list = td_counters_(), since = gm_addDays_(gm_today_(), -30), m = {};
  gm_rows_('hours').forEach(function (r) { if (r[1] === emp && String(r[0]) >= since && list.indexOf(r[2]) >= 0) m[r[2]] = (m[r[2]] || 0) + (Number(r[3]) || 0); });
  var best = ''; Object.keys(m).forEach(function (k) { if (!best || m[k] > m[best]) best = k; });
  return best;
}
function td_power_(T, rev) {
  var revAtk = Math.floor(rev / (pv_param_('塔防營業額換算') || 10000));
  return { atk: T.arrow * 8 + T.cannon * 15 + revAtk, def: T.wall * 6, hp: 1000 + Math.floor(rev / 100) + T.wall * 50, revAtk: revAtk };
}
function td_battle_(A, B, seed) {   // 10 波:雙方輪流進攻,剩餘城堡血量比例高者勝
  var hpA = A.p.hp, hpB = B.p.hp, waves = [];
  for (var w = 1; w <= 10; w++) {
    var dA = Math.max(5, Math.round((A.p.atk - B.p.def * 0.6) * (0.85 + pv_rand_(seed + w) * 0.3)));
    var dB = Math.max(5, Math.round((B.p.atk - A.p.def * 0.6) * (0.85 + pv_rand_(seed + w * 7) * 0.3)));
    hpB = Math.max(0, hpB - dA); hpA = Math.max(0, hpA - dB); waves.push([dA, dB, hpA, hpB]);
    if (!hpA || !hpB) break;
  }
  var win = hpA / A.p.hp === hpB / B.p.hp ? (A.rev >= B.rev ? 'A' : 'B') : hpA / A.p.hp > hpB / B.p.hp ? 'A' : 'B';
  return { waves: waves, winner: win };
}
function td_simulate_(from, to) {
  var locs = td_counters_(), teams = locs.map(function (l) { var T = td_tower_(l), rev = td_revenue_(l, from, to); return { loc: l, T: T, rev: rev, p: td_power_(T, rev) }; });
  var table = {}, matches = [];
  teams.forEach(function (t) { table[t.loc] = { loc: t.loc, w: 0, l: 0, pts: 0, rev: t.rev, power: t.p }; });
  for (var i = 0; i < teams.length; i++) for (var j = i + 1; j < teams.length; j++) {
    var res = td_battle_(teams[i], teams[j], gm_hash_(from + teams[i].loc + teams[j].loc) % 100000);
    var w = res.winner === 'A' ? teams[i] : teams[j], l = w === teams[i] ? teams[j] : teams[i];
    table[w.loc].w++; table[w.loc].pts += 3; table[l.loc].l++;
    matches.push({ a: teams[i].loc, b: teams[j].loc, winner: w.loc, waves: res.waves, hpA: teams[i].p.hp, hpB: teams[j].p.hp });
  }
  var standings = Object.keys(table).map(function (k) { return table[k]; }).sort(function (a, b) { return b.pts - a.pts || b.rev - a.rev; });
  return { standings: standings, matches: matches };
}
function td_weekly_(today) {   // 每週一結算上週
  if (((new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7) !== 0) return;
  var last = td_weekRange_(gm_addDays_(today, -1)), key = last.from;
  if (gm_getState_('塔防已結算') === key || last.to < gm_param_('測試版開始日')) return;
  var R = td_simulate_(last.from, last.to);
  R.matches.forEach(function (m) { pv_append_('tdLog', [[key, m.a, m.b, m.winner, JSON.stringify(m.waves)]]); });
  if (R.standings.length && R.standings[0].pts > 0) {
    var champ = R.standings[0].loc, mins = {}, tot = 0, pool = pv_param_('塔防冠軍獎勵');
    gm_rows_('hours').forEach(function (r) { if (r[2] === champ && String(r[0]) >= last.from && String(r[0]) <= last.to) { mins[r[1]] = (mins[r[1]] || 0) + (Number(r[3]) || 0); tot += Number(r[3]) || 0; } });
    if (tot) Object.keys(mins).forEach(function (emp) { if (!gm_isFrozen_(emp)) gm_credit_(emp, '塔防冠軍', Math.round(pool * mins[emp] / tot), key + ' 週塔防冠軍 ' + champ, 'TDCHAMP|' + emp + '|' + key); });
    gm_setState_('塔防冠軍_' + key, champ);
  }
  gm_setState_('塔防已結算', key);
}
function td_me_(p) {
  var emp = String(p.empId || '').trim(); if (!gm_emp_(emp)) return { error: '找不到此帳號' };
  var today = gm_today_(), wk = td_weekRange_(today), mine = td_myCounter_(emp);
  var live = td_simulate_(wk.from, today);     // 本週到目前為止的戰況預測
  var last = td_weekRange_(gm_addDays_(wk.from, -1)), logs = pv_rows_('tdLog').filter(function (r) { return String(r[0]) === last.from; })
    .map(function (r) { return { a: r[1], b: r[2], winner: r[3], waves: pv_json_(r[4], []) }; });
  var towers = td_counters_().map(function (l) { var T = td_tower_(l); return { loc: l, arrow: T.arrow, cannon: T.cannon, wall: T.wall, total: T.total }; });
  return { success: true, data: { myCounter: mine, week: wk, standings: live.standings, preview: live.matches, lastWeek: { from: last.from, champion: gm_getState_('塔防冠軍_' + last.from), matches: logs },
    towers: towers, base: pv_param_('塔防升級基本價'), balance: gm_balance_(emp) } };
}
function td_give_(p) {
  var emp = String(p.empId || '').trim(), kind = String(p.tower || ''), amt = Math.floor(Number(p.amount) || 0);
  if (!gm_emp_(emp) || gm_isFrozen_(emp)) return { error: '帳號無法使用' };
  var loc = td_myCounter_(emp); if (!loc) return { error: '最近 30 天沒有在百貨櫃位上班,無法投入' };
  if (['arrow', 'cannon', 'wall'].indexOf(kind) < 0) return { error: '塔的種類不正確' };
  if (amt < 10) return { error: '一次至少投入 10 枚' };
  if (gm_balance_(emp) < amt) return { error: '赤心幣不足' };
  var T = td_tower_(loc), base = pv_param_('塔防升級基本價');
  var pool = Number(gm_getState_('塔防進度_' + loc + '_' + kind)) || 0, lv = T[kind];
  pool += amt; while (pool >= base * lv) { pool -= base * lv; lv++; }
  T[kind] = lv; T.total += amt;
  gm_credit_(emp, '塔防投入', -amt, '投入 ' + loc + ' ' + { arrow: '箭塔', cannon: '砲塔', wall: '城牆' }[kind], 'TDGIVE|' + emp + '|' + gm_now_() + '|' + Math.random());
  pv_append_('tdGive', [[gm_now_(), emp, loc, kind, amt]]);
  var row = [loc, T.arrow, T.cannon, T.wall, T.total];
  if (T.row) { var rng = pv_sh_('towers').getRange(T.row, 1, 1, 5); rng.setNumberFormat('@'); rng.setValues([row]); GM_CACHE_.rows_pv_towers = null; } else pv_append_('towers', [row]);
  gm_setState_('塔防進度_' + loc + '_' + kind, pool);
  return { success: true, data: { tower: { loc: loc, arrow: T.arrow, cannon: T.cannon, wall: T.wall }, progress: pool, need: base * lv, balance: gm_balance_(emp) } };
}

// ───────── 夥伴小店 ─────────
function sp_shop_(emp) {
  var rows = pv_rows_('shops');
  for (var i = 0; i < rows.length; i++) if (rows[i][0] === emp) return { row: i + 2, owner: emp, name: String(rows[i][1]), type: String(rows[i][2]), opened: String(rows[i][3]), prices: pv_json_(rows[i][4], {}), revenue: Number(rows[i][5]) || 0, sales: Number(rows[i][6]) || 0, notice: String(rows[i][7] || '') };
  return null;
}
function sp_items_(type, prices) {
  var cat = gm_catalog_(), lo = pv_param_('小店價格下限'), hi = pv_param_('小店價格上限');
  return Object.keys(cat).filter(function (k) { return cat[k].where === '小店:' + type; }).map(function (k) {
    var c = cat[k], p = Number(prices && prices[k]) || c.price;
    return { id: k, name: c.name, cat: c.cat, tier: c.tier, base: c.price, price: p, min: Math.ceil(c.price * lo / 100), max: Math.floor(c.price * hi / 100), effect: c.note };
  });
}
function sp_level_(sales) { return sales >= 60 ? 3 : sales >= 20 ? 2 : 1; }
function sp_list_(p) {
  var emps = gm_emps_(), me = String(p.empId || '').trim();
  var shops = pv_rows_('shops').map(function (r) {
    var s = sp_shop_(r[0]); var e = emps[s.owner];
    return { owner: s.owner, ownerName: e ? (e.nick || e.name) : s.owner, name: s.name, type: s.type, level: sp_level_(s.sales), sales: s.sales, notice: s.notice, items: sp_items_(s.type, s.prices) };
  });
  var eligible = gm_hasBadge_(me, 'tenure_1', '');
  var gifts = pv_rows_('gifts').filter(function (r) { return r[2] === me; }).slice(-10).reverse().map(function (r) {
    var f = emps[r[1]], c = gm_catalog_()[r[3]] || {}; return { time: String(r[0]), from: f ? (f.nick || f.name) : r[1], item: c.name, icon: String(c.note || '').split(':')[1] || '🎁', unread: !r[4] };
  });
  var people = Object.keys(emps).filter(function (k) { return !emps[k].resigned && k !== me; }).map(function (k) { return { id: k, name: emps[k].nick || emps[k].name }; });
  return { success: true, data: { people: people, shops: shops, mine: sp_shop_(me) ? shops.filter(function (s) { return s.owner === me; })[0] : null, eligible: eligible,
    types: PV_SHOP_TYPES, fee: pv_param_('小店開店費'), share: pv_param_('小店店主分潤'), threshold: String(gm_param_('資歷門檻') || '1080').split(',')[0], gifts: gifts, balance: gm_balance_(me) } };
}
function sp_open_(p) {
  var emp = String(p.empId || '').trim(); if (!gm_emp_(emp) || gm_isFrozen_(emp)) return { error: '帳號無法使用' };
  if (!gm_hasBadge_(emp, 'tenure_1', '')) return { error: '累計工時達 ' + String(gm_param_('資歷門檻')).split(',')[0] + ' 小時才能開店' };
  if (sp_shop_(emp)) return { error: '已經有小店了' };
  var type = String(p.type || ''), name = String(p.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12);
  if (PV_SHOP_TYPES.indexOf(type) < 0) return { error: '店型不正確' };
  if (!name) return { error: '請幫小店取名字' };
  var fee = pv_param_('小店開店費'); if (gm_balance_(emp) < fee) return { error: '赤心幣不足(開店費 ' + fee + ' 枚)' };
  gm_credit_(emp, '開店費', -fee, '開了「' + name + '」', 'SHOPOPEN|' + emp);
  pv_append_('shops', [[emp, name, type, gm_now_(), '{}', 0, 0, '']]);
  return { success: true };
}
function sp_update_(p) {
  var emp = String(p.empId || '').trim(), s = sp_shop_(emp); if (!s) return { error: '還沒有小店' };
  var name = p.name != null ? String(p.name).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12) || s.name : s.name;
  var notice = p.notice != null ? String(p.notice).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40) : s.notice;
  var prices = s.prices, want = p.prices != null ? pv_json_(p.prices, {}) : null;
  if (want) {
    var items = sp_items_(s.type, {}); prices = {};
    items.forEach(function (it) { var v = Math.round(Number(want[it.id]) || it.base); prices[it.id] = Math.min(it.max, Math.max(it.min, v)); });
  }
  var type = s.type;
  if (p.type && PV_SHOP_TYPES.indexOf(p.type) >= 0 && p.type !== s.type) { type = p.type; prices = {}; }
  var rng = pv_sh_('shops').getRange(s.row, 2, 1, 7); rng.setNumberFormat('@');
  rng.setValues([[name, type, s.opened, JSON.stringify(prices), s.revenue, s.sales, notice]]); GM_CACHE_.rows_pv_shops = null;
  return { success: true };
}
function sp_buy_(p) {
  var buyer = String(p.empId || '').trim(), owner = String(p.owner || '').trim(), item = String(p.item || ''), to = String(p.to || '').trim();
  if (!gm_emp_(buyer) || gm_isFrozen_(buyer)) return { error: '帳號無法使用' };
  if (buyer === owner) return { error: '不能買自己店裡的東西' };
  var s = sp_shop_(owner); if (!s || gm_isFrozen_(owner)) return { error: '這家店目前沒有營業' };
  var it = sp_items_(s.type, s.prices).filter(function (x) { return x.id === item; })[0]; if (!it) return { error: '這家店沒有賣這個' };
  if (gm_balance_(buyer) < it.price) return { error: '赤心幣不足' };
  var cat = gm_catalog_()[item], kind = cat.cat;
  if (kind === 'gift') { if (!gm_emp_(to) || gm_isFrozen_(to) || to === buyer) return { error: '請選擇要送給哪位夥伴' }; }
  else if (['weapon', 'armor', 'card', 'decor'].indexOf(kind) >= 0 && gm_owned_(buyer)[item]) return { error: '已經擁有了' };
  if (kind === 'petsnack' && !gm_pet_(buyer)) return { error: '還沒有寵物' };
  var share = Math.floor(it.price * pv_param_('小店店主分潤') / 100), k = Date.now() + '|' + Math.random();
  gm_credit_(buyer, '小店消費', -it.price, '在「' + s.name + '」買了' + it.name, 'SPBUY|' + buyer + '|' + k);
  if (share) gm_credit_(owner, '小店營收', share, (gm_emp_(buyer).nick || gm_emp_(buyer).name) + ' 買了' + it.name, 'SPINC|' + owner + '|' + k);
  if (kind === 'gift') pv_append_('gifts', [[gm_now_(), buyer, to, item, '']]);
  else if (kind === 'petsnack') {
    var pet = gm_pet_(buyer), add = Number(String(cat.note).split(':')[1]) || 0;
    var prow = gm_rows_('pets')[pet.row - 2];
    var rng = gm_sh_('pets').getRange(pet.row, 6, 1, 2); rng.setNumberFormat('@');
    rng.setValues([[String((Number(prow[5]) || 0) + add), String((Number(prow[6]) || 0) + 1)]]); GM_CACHE_.rows_pets = null;   // 成長時數＋小遊戲加一條命
  } else gm_append_('owned', [[buyer, item, '小店', gm_now_()]]);
  pv_append_('sales', [[gm_now_(), owner, buyer, item, it.price, share, to]]);
  var rr = pv_sh_('shops').getRange(s.row, 6, 1, 2); rr.setNumberFormat('@'); rr.setValues([[String(s.revenue + share), String(s.sales + 1)]]); GM_CACHE_.rows_pv_shops = null;
  return { success: true, data: { balance: gm_balance_(buyer) } };
}
function sp_giftRead_(p) {
  var me = String(p.empId || '').trim(), sh = pv_sh_('gifts');
  pv_rows_('gifts').forEach(function (r, i) { if (r[2] === me && !r[4]) sh.getRange(i + 2, 5).setValue('Y'); });
  return { success: true };
}
function sp_scene_() {   // 宇宙辦公室「商店街」
  var emps = gm_emps_();
  return pv_rows_('shops').map(function (r) { var s = sp_shop_(r[0]), e = emps[s.owner]; return { owner: s.owner, ownerName: e ? (e.nick || e.name) : '', name: s.name, type: s.type, level: sp_level_(s.sales) }; });
}

// ───────── 路由 ─────────
function pvHandler_(action, p) {
  var map = { pvMe: pv_me_, pvEquip: pv_setEquip_, pvDuel: pv_duel_, pvLiveInvite: pv_liveInvite_, pvLiveMine: pv_liveMine_, pvLiveAccept: pv_liveAccept_,
              pvLiveMove: pv_liveMove_, pvLiveState: pv_liveState_, tdMe: td_me_, tdGive: td_give_, spList: sp_list_, spOpen: sp_open_, spUpdate: sp_update_,
              spBuy: sp_buy_, spGiftRead: sp_giftRead_, spScene: function () { return { success: true, data: sp_scene_() }; } };
  if (!map[action]) return null;
  p = p || {};
  var write = /Equip|Duel|Invite|Accept|Move|State|Give|Open|Update|Buy|Read/.test(action), lock = null;
  try {
    GM_CACHE_ = {};
    if (write) { lock = LockService.getScriptLock(); lock.waitLock(20000); }
    return map[action](p);
  } catch (e) { return { error: '對戰/小店功能發生錯誤:' + e.message }; }
  finally { if (lock) lock.releaseLock(); }
}
