// v4（部署端，以製作端 v3 為底）：c31_notMe_ 沒有通行證一律擋（小店購物、寵物市集），見檔案末段
// ═════════════════════════════════════════════════════════════
// v1.40（2026-11-14）宇宙辦公室：休息區／沙發區、Lv.3 視察、視察提醒、跑馬燈、營業額里程碑與超車、
//   工廠／倉庫看板、坐騎（買斷＋每月前 5 名品牌款）、請喝咖啡、提醒
// 底版：後端第 41 版（部署交接 v9）。整個檔案貼在「程式碼.gs」最底部（路由 v1.39 之後）即可：
//   檔案最後的「路由 v1.40」會取代路由 v1.39（同名函式以最後一個為準），內容是 v1.39 再加上 v40Handler_。
// 部署後執行一次 v40_setup()：建立〈宇宙通知〉〈宇宙動態〉〈坐騎〉〈坐騎使用〉分頁、加遊戲參數。
// 安全：本模組所有寫入動作一律以登入通行證本人（au_verifiedId_，經 v39_me_）為準，沒有通行證就擋下。
// 不覆蓋任何既有函式。接手的動作：
//   gmScene（先呼叫 v39Handler_ → h36 → s30，再加 people／visits／mounts／ticker／celebrate／coffee／boards）
//   v39Rev（先呼叫 v39Handler_ 回報，再判斷里程碑、超車、寫跑馬燈）
//   v39Goto（大隊長舊動作，改走 v40 視察：Lv.3 以上都能用）
// ═════════════════════════════════════════════════════════════
var V40_NOTE_HEAD = ['時間', '日期', '收件人', '類型', '內容', '已讀', '來源鍵'];
var V40_EVT_HEAD = ['時間', '日期', '類型', '內容', '櫃位'];
var V40_MOUNT_HEAD = ['員工編號', '坐騎', '取得方式', '取得時間', '到期日'];
var V40_RIDE_HEAD = ['員工編號', '坐騎', '更新時間'];
// 一般款：永久買斷；品牌款：每月依上個月工時前 5 名分配、或管理者發放，期限一個月
var V40_MOUNTS = {
  bike:   { name: '腳踏車', icon: '🚲', price: 50 },
  scooter:{ name: '機車',   icon: '🛵', price: 120 },
  car:    { name: '汽車',   icon: '🚗', price: 250 },
  suv:    { name: '休旅車', icon: '🚙', price: 300 },
  truck:  { name: '貨車',   icon: '🚚', price: 300 },
  sports: { name: '跑車',   icon: '🏎️', price: 500 },
  trex:   { name: '小暴龍', icon: '🦖', brand: true },
  train:  { name: '火車',   icon: '🚂', brand: true },
  digger: { name: '挖土機', icon: '🚜', brand: true },
  trike:  { name: '三角龍', icon: '🦕', brand: true },
  bird:   { name: '赤心大鳥', icon: '🐤', brand: true }
};
var V40_BRAND_ORDER = ['trex', 'train', 'digger', 'trike', 'bird'];   // 上個月工時第 1～5 名

function v40_s_(name, head) { return v39_sheet_(name, head); }
function v40_rows_(name, head) { return v39_rows_(name, head); }
function v40_today_() { return gm_today_(); }
function v40_hm_() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'HH:mm'); }
function v40_nm_(id) { var e = gm_emp_(id); return e ? (e.nick || e.name) : String(id); }
function v40_isMgr_(me) { return me && (me.role >= 3 || me.pos === '大隊長'); }
function v40_isBossId_(id) { var e = gm_emp_(id); return !!e && (e.role >= 5 || e.pos === '大隊長'); }

// ───────── 1. 提醒（站內通知；前端每分鐘讀一次）─────────
// cap：'day' 同一個收件人＋類型每天一次；'pair' 同一個寄件人＋收件人＋類型每天一次
function v40_note_(to, type, text, cap, from) {
  to = String(to || ''); if (!to) return false;
  var d = v40_today_(), key = type + '|' + to + '|' + d + (cap === 'pair' ? '|' + (from || '') : '');
  var rows = v40_rows_('宇宙通知', V40_NOTE_HEAD);
  for (var i = rows.length - 1; i >= 0 && i >= rows.length - 400; i--) if (String(rows[i][6]) === key) return false;
  v40_s_('宇宙通知', V40_NOTE_HEAD).appendRow([v39_now_(), d, to, type, String(text).slice(0, 120), '', key]);
  return true;
}
function v40_notes_(p) {
  var me = v39_me_(), sh = v40_s_('宇宙通知', V40_NOTE_HEAD), rows = v40_rows_('宇宙通知', V40_NOTE_HEAD);
  var since = gm_addDays_(v40_today_(), -2), out = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i]; if (String(r[2]) !== me.id || r[5] || v39_d_(r[1]) < since) continue;
    out.push({ type: String(r[3]), text: String(r[4]), time: (r[0] instanceof Date ? Utilities.formatDate(r[0], 'Asia/Taipei', 'HH:mm') : String(r[0]).slice(11, 16)) });
    sh.getRange(i + 2, 6).setValue('Y');
  }
  return { success: true, data: out };
}

// ───────── 2. 跑馬燈（今日動態）─────────
function v40_event_(type, text, loc) { v40_s_('宇宙動態', V40_EVT_HEAD).appendRow([v39_now_(), v40_today_(), type, String(text).slice(0, 80), loc || '']); }
function v40_ticker_() {
  var d = v40_today_(), out = [];
  v40_rows_('宇宙動態', V40_EVT_HEAD).forEach(function (r) {
    if (v39_d_(r[1]) !== d) return;
    var t = r[0] instanceof Date ? Utilities.formatDate(r[0], 'Asia/Taipei', 'HH:mm') : String(r[0]).slice(11, 16);
    out.push({ time: t, type: String(r[2]), text: String(r[3]), loc: String(r[4] || '') });
  });
  return out.slice(-20).reverse();
}

// ───────── 3. 誰在上班、在哪裡（今天最後一筆打卡是上班）─────────
function v40_dutyMap_() {
  if (GM_CACHE_.v40duty) return GM_CACHE_.v40duty;
  var t = v40_today_(), last = {};
  gm_punchRows_().forEach(function (p) { if (p.date === t && (p.type === '上班' || p.type === '下班') && (!last[p.emp] || p.t >= last[p.emp].t)) last[p.emp] = p; });
  var out = {}; Object.keys(last).forEach(function (e) { if (last[e].type === '上班') out[e] = last[e].loc; });
  return (GM_CACHE_.v40duty = out);
}
function v40_dutyAt_(loc) { var m = v40_dutyMap_(); return Object.keys(m).filter(function (e) { return ops_sameLoc_(m[e], loc); }); }

// ───────── 4. 視察（Lv.3 以上，含大隊長）─────────
// Script Properties「gm_宇宙前往」：{ 員工編號: { loc, date, time } }，只在當天有效
// loc：''＝辦公室沙發區（平常的位置）、'休息區'、或〈櫃位設定〉中的地點（櫃位、活動、工廠、倉庫）
function v40_visits_() {
  var m = {}; try { m = JSON.parse(gm_getState_('宇宙前往') || '{}') || {}; } catch (e) { m = {}; }
  var d = v40_today_(), out = {};
  Object.keys(m).forEach(function (k) { if (m[k] && m[k].date === d) out[k] = m[k]; });
  return out;
}
function v40_goto_(p) {
  var me = v39_me_(); if (!v40_isMgr_(me)) return { error: 'Lv.3 以上才能視察' };
  var loc = String(p.loc || '').trim().slice(0, 40);
  if (loc === '辦公室' || loc === '沙發區') loc = '';
  var L = null;
  if (loc && loc !== '休息區') { L = ops_locByName_(loc); if (!L) return { error: '找不到這個地點' }; }
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var m = v40_visits_();
    if (loc) m[me.id] = { loc: loc, date: v40_today_(), time: v40_hm_() }; else delete m[me.id];
    gm_setState_('宇宙前往', JSON.stringify(m));
    if (v40_isBossId_(me.id)) gm_setState_('大隊長前往', loc && loc !== '休息區' ? JSON.stringify({ loc: loc, date: v40_today_(), time: v40_hm_() }) : '');   // v1.39 相容
  } finally { lock.releaseLock(); }
  var who = v40_isBossId_(me.id) ? '大隊長' : v40_nm_(me.id);
  if (L) {
    v40_dutyAt_(loc).forEach(function (e) { if (e !== me.id) v40_note_(e, 'visit', who + ' 來看你了 👀', 'day'); });
    v40_event_('visit', who + ' 到 ' + shortLoc_(loc) + ' 視察', loc);
  }
  return { success: true, data: loc ? { loc: loc, date: v40_today_(), time: v40_hm_() } : null };
}
function shortLoc_(loc) { return String(loc || '').replace(/^\d+/, '').replace(/^(正櫃|快閃櫃|展覽|活動|分隊長)/, '') || loc; }
// 主管在名片上按「👍 辛苦了」（可附一句話）
function v40_cheer_(p) {
  var me = v39_me_(); if (!v40_isMgr_(me)) return { error: 'Lv.3 以上才能使用' };
  var to = String(p.to || '').trim(); if (!gm_emp_(to) || to === me.id) return { error: '找不到這位隊員' };
  var msg = String(p.msg || '').trim().slice(0, 40);
  var who = v40_isBossId_(me.id) ? '大隊長' : v40_nm_(me.id);
  var ok = v40_note_(to, 'cheer', who + '：' + (msg || '辛苦了！👍'), 'pair', me.id);
  return ok ? { success: true } : { error: '今天已經跟他說過了' };
}

// ───────── 5. 即時營業額：里程碑、超車、跑馬燈（接在 v1.39 回報之後）─────────
function v40_milestones_() {
  var s = String(gm_param_('即時營業額里程碑') || '3000,5000,10000');
  return s.split(/[,，\s]+/).map(Number).filter(function (n) { return n > 0; }).sort(function (a, b) { return a - b; });
}
function v40_afterRev_(p, before, res) {
  try {
    if (!res || !res.success) return res;
    var loc = String(p.loc || '').trim(), after = res.data || v39_revBoard_();
    var amt = 0, rank = 0; after.forEach(function (x, i) { if (x.loc === loc) { amt = x.amount; rank = i + 1; } });
    var prev = 0; (before || []).forEach(function (x) { if (x.loc === loc) prev = x.amount; });
    var me = v39_me_(), sl = shortLoc_(loc);
    v40_event_('rev', v40_nm_(me.id) + ' 回報 ' + sl + ' $' + amt.toLocaleString() + (rank === 1 && after.length > 1 ? '，暫居第一 🥇' : ''), loc);
    // 里程碑：這次跨過的最高門檻
    var hit = 0; v40_milestones_().forEach(function (th) { if (prev < th && amt >= th) hit = th; });
    if (hit) {
      v40_event_('milestone', '🎆 ' + sl + ' 破 ' + hit.toLocaleString() + '！', loc);
      v40_dutyAt_(loc).concat([]).forEach(function (e) { v40_note_(e, 'milestone', '🎆 ' + sl + ' 今天破 ' + hit.toLocaleString() + ' 了！', 'day'); });
    }
    // 超車：之前在我前面、現在在我後面的櫃位
    var beforeAmt = {}; (before || []).forEach(function (x) { beforeAmt[x.loc] = x.amount; });
    after.forEach(function (x) {
      if (x.loc === loc || beforeAmt[x.loc] == null) return;
      if (beforeAmt[x.loc] > prev && x.amount < amt) {
        v40_dutyAt_(x.loc).forEach(function (e) { v40_note_(e, 'overtake', sl + ' 剛超過你們了！加油 💪', 'day'); });
        v40_event_('overtake', sl + ' 超過 ' + shortLoc_(x.loc) + '！', loc);
      }
    });
    res.milestone = hit || 0;
  } catch (e) { res.v40Error = e.message; }
  return res;
}
function v40_celebrate_() {   // 今天的里程碑（前端放煙火用）
  return v40_ticker_().filter(function (x) { return x.type === 'milestone'; }).map(function (x) { return { loc: x.loc, time: x.time, text: x.text }; });
}

// ───────── 6. 坐騎 ─────────
function v40_mountRows_() { return v40_rows_('坐騎', V40_MOUNT_HEAD); }
function v40_owned_(emp) {   // { 坐騎: 到期日（''＝永久） }，只列還有效的
  var d = v40_today_(), out = {};
  v40_mountRows_().forEach(function (r) {
    if (String(r[0]) !== emp) return;
    var id = String(r[1]), exp = r[4] ? v39_d_(r[4]) : '';
    if (exp && exp < d) return;
    if (!exp) out[id] = '';
    else if (out[id] !== '' && (out[id] === undefined || exp > out[id])) out[id] = exp;
  });
  return out;
}
function v40_rideMap_() {   // 全部人目前騎的坐騎（只回有效的）
  if (GM_CACHE_.v40ride) return GM_CACHE_.v40ride;
  var d = v40_today_(), valid = {}, chosen = {};
  v40_mountRows_().forEach(function (r) {
    var e = String(r[0]), id = String(r[1]), exp = r[4] ? v39_d_(r[4]) : '';
    if (exp && exp < d) return;
    (valid[e] = valid[e] || {})[id] = 1;
  });
  v40_rows_('坐騎使用', V40_RIDE_HEAD).forEach(function (r) { chosen[String(r[0])] = String(r[1]); });
  var out = {};
  Object.keys(valid).forEach(function (e) {
    var c = chosen[e];
    if (c === 'none') return;
    if (c && valid[e][c]) { out[e] = c; return; }
    // 沒選或選的已到期：品牌款優先，其次最貴的一般款
    var ids = Object.keys(valid[e]);
    var brand = ids.filter(function (x) { return V40_MOUNTS[x] && V40_MOUNTS[x].brand; })[0];
    out[e] = brand || ids.sort(function (a, b) { return ((V40_MOUNTS[b] || {}).price || 0) - ((V40_MOUNTS[a] || {}).price || 0); })[0];
  });
  return (GM_CACHE_.v40ride = out);
}
function v40_setRide_(emp, id) {
  var sh = v40_s_('坐騎使用', V40_RIDE_HEAD), rows = v40_rows_('坐騎使用', V40_RIDE_HEAD);
  for (var i = 0; i < rows.length; i++) if (String(rows[i][0]) === emp) { sh.getRange(i + 2, 2, 1, 2).setValues([[id, v39_now_()]]); GM_CACHE_.v40ride = null; return; }
  sh.appendRow([emp, id, v39_now_()]); GM_CACHE_.v40ride = null;
}
function v40_monthEnd_(d) { var y = +d.slice(0, 4), m = +d.slice(5, 7); var t = new Date(Date.UTC(y, m, 0)); return t.toISOString().slice(0, 10); }
function v40_plusMonth_(d) { var y = +d.slice(0, 4), m = +d.slice(5, 7), dd = +d.slice(8, 10); var t = new Date(Date.UTC(y, m, Math.min(dd, 28))); return t.toISOString().slice(0, 10); }
function v40_mountMe_(p) {
  var me = v39_me_(), own = v40_owned_(me.id), ride = v40_rideMap_()[me.id] || '';
  return { success: true, data: { owned: own, ride: ride, catalog: V40_MOUNTS, balance: gm_balance_(me.id), alloc: v40_lastAlloc_() } };
}
function v40_mountBuy_(p) {
  var me = v39_me_(), id = String(p.id || ''), M = V40_MOUNTS[id];
  if (!M || M.brand) return { error: '這台不能買（品牌款靠每月上班時數前 5 名拿到）' };
  if (gm_isFrozen_(me.id)) return { error: '帳號不能使用赤心幣' };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    if (v40_owned_(me.id)[id] !== undefined) return { error: '你已經有這台了' };
    var bal = gm_balance_(me.id); if (bal < M.price) return { error: '赤心幣不足，還差 ' + (M.price - bal) + ' 枚' };
    if (!gm_credit_(me.id, '坐騎', -M.price, '買 ' + M.name, 'MOUNT|' + me.id + '|' + id)) return { error: '你已經有這台了' };
    v40_s_('坐騎', V40_MOUNT_HEAD).appendRow([me.id, id, '購買', v39_now_(), '']);
    v40_setRide_(me.id, id);
    v40_event_('mount', v40_nm_(me.id) + ' 買了' + M.icon + M.name, '');
    return { success: true, balance: gm_balance_(me.id) };
  } finally { lock.releaseLock(); }
}
function v40_mountRide_(p) {
  var me = v39_me_(), id = String(p.id || '');
  if (id && id !== 'none' && v40_owned_(me.id)[id] === undefined) return { error: '你沒有這台坐騎' };
  v40_setRide_(me.id, id || 'none');
  return { success: true };
}
// 管理者發放：一般款永久、品牌款一個月
function v40_mountGrant_(p) {
  var me = v39_me_(); if (me.role < 3) return { error: '只有管理者可以發放' };
  var to = String(p.target || '').trim(), id = String(p.id || ''), M = V40_MOUNTS[id];
  if (!M) return { error: '請選坐騎' };
  if (!gm_emp_(to)) return { error: '找不到這位隊員' };
  var exp = M.brand ? v40_plusMonth_(v40_today_()) : '';
  if (!M.brand && v40_owned_(to)[id] !== undefined) return { error: '他已經有這台了' };
  v40_s_('坐騎', V40_MOUNT_HEAD).appendRow([to, id, '發放（' + me.name + '）', v39_now_(), exp]);
  v40_setRide_(to, id);
  v40_note_(to, 'mount', '🎁 你獲得了' + M.icon + M.name + (exp ? '（到 ' + exp.slice(5).replace('-', '/') + '）' : '') + '！', 'pair', me.id + id);
  v40_event_('mount', v40_nm_(to) + ' 獲得' + M.icon + M.name, '');
  return { success: true };
}
// 每月 1 日（第一次有人打開宇宙辦公室時）：上個月工時前 5 名拿品牌款，到這個月底
function v40_lastAlloc_() { try { return JSON.parse(gm_getState_('坐騎分配') || 'null'); } catch (e) { return null; } }
function v40_allocMonthly_() {
  var d = v40_today_(), ym = d.slice(0, 7), last = v40_lastAlloc_();
  if (last && last.month === ym) return;
  var lock = LockService.getScriptLock(); if (!lock.tryLock(5000)) return;
  try {
    last = v40_lastAlloc_(); if (last && last.month === ym) return;
    var prevYm = gm_addDays_(ym + '-01', -1).slice(0, 7), sum = {}, staff = ops_staff_().map;
    gm_rows_('hours').forEach(function (r) {
      if (v39_d_(r[0]).slice(0, 7) !== prevYm) return;
      var e = String(r[1]), s = staff[e]; if (!s || s.left || (s.type && s.type !== '員工')) return;
      sum[e] = (sum[e] || 0) + (Number(r[3]) || 0);
    });
    var top = Object.keys(sum).filter(function (e) { return sum[e] > 0; }).sort(function (a, b) { return sum[b] - sum[a]; }).slice(0, 5);
    var exp = v40_monthEnd_(d), win = [];
    top.forEach(function (e, i) {
      var id = V40_BRAND_ORDER[i], M = V40_MOUNTS[id];
      v40_s_('坐騎', V40_MOUNT_HEAD).appendRow([e, id, prevYm + ' 工時第 ' + (i + 1) + ' 名', v39_now_(), exp]);
      v40_setRide_(e, id);
      v40_note_(e, 'mount', '🏆 上個月上班時數第 ' + (i + 1) + ' 名！這個月可以騎' + M.icon + M.name + '（到 ' + exp.slice(5).replace('-', '/') + '）', 'day');
      win.push({ emp: e, name: v40_nm_(e), mount: id, hours: Math.round(sum[e] / 60) });
    });
    gm_setState_('坐騎分配', JSON.stringify({ month: ym, from: prevYm, winners: win }));
    if (win.length) v40_event_('mount', '本月坐騎得主：' + win.map(function (w) { return V40_MOUNTS[w.mount].icon + w.name; }).join('、'), '');
  } finally { lock.releaseLock(); }
}

// ───────── 7. 請喝咖啡（花 1 枚；同一個人一天一次）─────────
function v40_coffee_(p) {
  var me = v39_me_(), to = String(p.to || '').trim();
  if (!gm_emp_(to) || to === me.id) return { error: '找不到這位隊員' };
  if (gm_isFrozen_(me.id)) return { error: '帳號不能使用赤心幣' };
  var cost = Number(gm_param_('請喝咖啡價格')); if (!(cost >= 0)) cost = 1;
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var key = 'COFFEE|' + me.id + '|' + to + '|' + v40_today_();
    if (gm_hasKey_(key)) return { error: '今天已經請過他了' };
    if (cost > 0 && gm_balance_(me.id) < cost) return { error: '赤心幣不足' };
    var noted = v40_note_(to, 'coffee', v40_nm_(me.id) + ' 請你喝一杯咖啡 ☕', 'pair', me.id);
    if (!noted) return { error: '今天已經請過他了' };
    if (cost > 0) gm_credit_(me.id, '請喝咖啡', -cost, '請 ' + v40_nm_(to) + ' 喝咖啡', key);
    v40_event_('coffee', v40_nm_(me.id) + ' 請 ' + v40_nm_(to) + ' 喝咖啡 ☕', '');
    return { success: true, balance: gm_balance_(me.id) };
  } finally { lock.releaseLock(); }
}

// ───────── 8. 工廠／倉庫看板（先用叫貨單，之後接 ERP）─────────
function v40_boards_() {
  var d = v40_today_(), batter = 0, flour = 0, pend = 0, shipped = 0, todayIn = 0, byLoc = {};
  try {
    ops_matRows_().forEach(function (x) {
      if (x.status === '已取消') return;
      var open = x.status === '已送出' || x.status === '已收到';
      if (open) { pend++; x.items.forEach(function (it) { if (/麵糊/.test(it.item)) { batter += it.qty; byLoc[x.loc] = (byLoc[x.loc] || 0) + it.qty; } if (/麵粉|預拌/.test(it.item)) flour += it.qty; }); }
      if (x.status === '已出貨') shipped++;
      if (String(x.created).slice(0, 10) === d) todayIn++;
    });
  } catch (e) {}
  return {
    factory: { batter: batter, flour: flour, byLoc: Object.keys(byLoc).map(function (l) { return { loc: shortLoc_(l), qty: byLoc[l] }; }).sort(function (a, b) { return b.qty - a.qty; }).slice(0, 4) },
    warehouse: { pending: pend, shipped: shipped, todayIn: todayIn }
  };
}

// ───────── 9. 休息區名單：全部在職隊員（不含合作品牌、加盟）─────────
function v40_people_() {
  return ops_staff_().list.filter(function (x) { return !x.left && (!x.type || x.type === '員工'); }).slice(0, 80)
    .map(function (x) { return { id: x.id, name: x.nick || x.name, mgr: x.role >= 3 || x.pos === '大隊長', boss: x.role >= 5 || x.pos === '大隊長' }; });
}

// ───────── 10. setup ─────────
function v40_setup() {
  var log = [];
  [['宇宙通知', V40_NOTE_HEAD], ['宇宙動態', V40_EVT_HEAD], ['坐騎', V40_MOUNT_HEAD], ['坐騎使用', V40_RIDE_HEAD]].forEach(function (x) { v40_s_(x[0], x[1]); });
  var have = {}; gm_rows_('params').forEach(function (r) { have[String(r[0]).trim()] = 1; });
  var add = [['即時營業額里程碑', '3000,5000,10000', 'v1.40：櫃位當天即時營業額破這些門檻會放煙火（逗號分隔）'],
             ['請喝咖啡價格', 1, 'v1.40：休息區請喝咖啡花幾枚（0＝免費）']].filter(function (x) { return !have[x[0]]; });
  if (add.length) { gm_append_('params', add); log.push('遊戲參數新增 ' + add.map(function (x) { return x[0]; }).join('、')); }
  log.push('分頁就緒：宇宙通知、宇宙動態、坐騎、坐騎使用');
  v40_shopSetup_(log);
  Logger.log(log.join('\n'));
  return log.join('\n');
}

// ───────── 11. 動作 ─────────
AU_READ = new RegExp(AU_READ.source.replace(/\)\$$/, '|v40MountMe|spProposals)$'));
function v40Handler_(action, p) {
  p = p || {};
  if (action === 'gmScene') {
    var r = v39Handler_('gmScene', p); if (!r || !r.data) return r;
    try { v40_allocMonthly_(); } catch (e) {}
    var safe = function (f, dv) { try { return f(); } catch (e) { return dv; } };
    r.data.people = safe(v40_people_, []);
    r.data.visits = safe(v40_visits_, {});
    r.data.mounts = safe(v40_rideMap_, {});
    r.data.ticker = safe(v40_ticker_, []);
    r.data.celebrate = safe(v40_celebrate_, []);
    r.data.boards = safe(v40_boards_, null);
    r.data.mountAlloc = safe(v40_lastAlloc_, null);
    return r;
  }
  if (action === 'v39Rev') {
    var before = []; try { before = v39_revBoard_(); } catch (e) {}
    var res = v39Handler_('v39Rev', p);
    return v40_afterRev_(p, before, res);
  }
  var map = { v39Goto: v40_goto_, v40Goto: v40_goto_, v40Cheer: v40_cheer_, v40Notes: v40_notes_, v40Coffee: v40_coffee_,
              v40MountMe: v40_mountMe_, v40MountBuy: v40_mountBuy_, v40MountRide: v40_mountRide_, v40MountGrant: v40_mountGrant_,
              spClose: v40_shopClose_, spTopup: v40_shopTopup_, spPropose: v40_propose_, spProposals: v40_proposals_, spProposalSet: v40_proposalSet_ };
  if (!map[action]) return null;
  var lock = null;
  try {
    OPS_C_ = {}; GM_CACHE_ = {};
    if (/^sp(Close|Topup)$/.test(action)) { lock = LockService.getScriptLock(); lock.waitLock(20000); }
    return map[action](p);
  } catch (e) { return { error: e.message }; }
  finally { if (lock) lock.releaseLock(); }
}

// ═════════════════════════════════════════════════════════════
// v1.40 第二部分：隊員商店街（隊長 11/14 16:06）
//   ① 開店要先預付「營運金」；每天依（月租＋水電）÷ 當月天數，從營運金扣；扣不夠 → 暫停營業，儲值後恢復
//   ② 可以結束營業：結算到今天（按天數比例），剩下的營運金退回；開店費不退
//   ③ 一個人最多開 2 家（每〈遊戲參數〉小店每人上限），條件一樣：資歷 1080 小時（測試期免）＋開店費
//   ④ 新店種：服飾店、陀螺對戰店、寵物用品店、書店、照相館、家具行、冰店、玩具店
//   ⑤ 店種提案：隊員可以提出想開的店與想賣的東西，管理者規劃後上架
// 覆蓋的函式：sp_shop_、sp_list_、sp_open_、sp_update_、sp_buy_（以 v1.31 版為底，保留通行證身分檢查、同店每日上限、抽成明細）、
//            sp_scene_、c31_shopRent_（改成空的：月租改由營運金每天扣，不再從上月營營收扣，避免重複收）
// 〈小店〉分頁新增欄位：店號、營運金、結算日、狀態（v40_setup 會補標題）
// ═════════════════════════════════════════════════════════════
if (PV_SHEETS.shops && PV_SHEETS.shops[1].length === 8) PV_SHEETS.shops[1] = PV_SHEETS.shops[1].concat(['店號', '營運金', '結算日', '狀態']);
var V40_NEW_TYPES = ['服飾店', '陀螺對戰店', '寵物用品店', '書店', '照相館', '家具行', '冰店', '玩具店'];
V40_NEW_TYPES.forEach(function (t) { if (PV_SHOP_TYPES.indexOf(t) < 0) PV_SHOP_TYPES.push(t); });
// 新店種的商品（wear:xxx＝買到就擁有造型 xxx；card／petsnack／gift／decor 用法和原本一樣）
var V40_SHOP_ITEMS = [
  ['s_tee', '紅玉滿 T 恤（領結）', 'wear', '普通', 15, '小店:服飾店', '', 'wear:bowtie'],
  ['s_knit', '手織圍巾', 'wear', '普通', 20, '小店:服飾店', '', 'wear:scarf'],
  ['s_rain', '黃色雨衣', 'wear', '稀有', 55, '小店:服飾店', '', 'wear:raincoat'],
  ['s_chef', '主廚服', 'wear', '稀有', 65, '小店:服飾店', '', 'wear:chefsuit'],
  ['s_giftbag', '衣服禮盒', 'gift', '普通', 25, '小店:服飾店', '', 'gift:👕'],
  ['s_topatk', '攻擊型陀螺', 'card', '普通', 35, '小店:陀螺對戰店', '', 'card:power:55'],
  ['s_topdef', '防禦型陀螺', 'card', '普通', 35, '小店:陀螺對戰店', '', 'card:shield:40'],
  ['s_topsta', '持久型陀螺', 'card', '普通', 35, '小店:陀螺對戰店', '', 'card:heal:45'],
  ['s_topstorm', '旋風陀螺', 'card', '稀有', 80, '小店:陀螺對戰店', '', 'card:power:90'],
  ['s_jerky', '寵物肉乾', 'petsnack', '普通', 12, '小店:寵物用品店', '', 'petsnack:3'],
  ['s_petfeast', '寵物大餐', 'petsnack', '稀有', 30, '小店:寵物用品店', '', 'petsnack:8'],
  ['s_petbow', '寵物領結', 'wear', '普通', 22, '小店:寵物用品店', '', 'wear:pet_bow'],
  ['s_petwing', '寵物小翅膀', 'wear', '稀有', 65, '小店:寵物用品店', '', 'wear:pet_wings'],
  ['s_novel', '小說', 'gift', '普通', 15, '小店:書店', '', 'gift:📖'],
  ['s_comic', '漫畫', 'gift', '普通', 12, '小店:書店', '', 'gift:📚'],
  ['s_bookmark', '紀念書籤(收藏)', 'decor', '普通', 15, '小店:書店', '', 'decor:🔖'],
  ['s_polaroid', '拍立得', 'gift', '普通', 18, '小店:照相館', '', 'gift:📸'],
  ['s_photo', '合照(收藏)', 'decor', '普通', 20, '小店:照相館', '', 'decor:🖼️'],
  ['s_woodframe', '木質名牌框', 'wear', '稀有', 55, '小店:照相館', '', 'wear:frame_wood'],
  ['s_pot', '小盆栽(收藏)', 'decor', '普通', 15, '小店:家具行', '', 'decor:🪴'],
  ['s_minisofa', '迷你沙發(收藏)', 'decor', '稀有', 40, '小店:家具行', '', 'decor:🛋️'],
  ['s_candle', '香氛蠟燭', 'gift', '普通', 18, '小店:家具行', '', 'gift:🕯️'],
  ['s_shaveice', '剉冰', 'gift', '普通', 15, '小店:冰店', '', 'gift:🍧'],
  ['s_icecream', '冰淇淋', 'gift', '普通', 12, '小店:冰店', '', 'gift:🍦'],
  ['s_peticecream', '寵物冰淇淋', 'petsnack', '普通', 15, '小店:冰店', '', 'petsnack:4'],
  ['s_teddy', '泰迪熊(收藏)', 'decor', '普通', 25, '小店:玩具店', '', 'decor:🧸'],
  ['s_balloon', '氣球', 'gift', '普通', 10, '小店:玩具店', '', 'gift:🎈'],
  ['s_trikedoll', '三角龍玩偶(收藏)', 'decor', '稀有', 40, '小店:玩具店', '', 'decor:🦕']
];
if (typeof GM_CATALOG_SEED !== 'undefined') V40_SHOP_ITEMS.forEach(function (r) { if (!GM_CATALOG_SEED.some(function (x) { return x[0] === r[0]; })) GM_CATALOG_SEED.push(r); });
function v40_shopCost_() {
  var rent = Number(gm_param_('小店月租')), util = Number(gm_param_('小店水電'));
  if (!(rent >= 0)) rent = 30; if (!(util >= 0)) util = 10;
  return { rent: rent, util: util, month: rent + util };
}
function v40_dim_(d) { var y = +d.slice(0, 4), m = +d.slice(5, 7); return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
// 從 from（不含）到 to（含）每天的成本合計（跨月時各月依當月天數）
function v40_accrue_(from, to) {
  var c = v40_shopCost_().month, sum = 0, d = from;
  for (var i = 0; i < 400 && d < to; i++) { d = gm_addDays_(d, 1); sum += c / v40_dim_(d); }
  return sum;
}
function v40_rowToShop_(r, i) {
  var owner = String(r[0] || '').trim(); if (!owner) return null;
  return { row: i + 2, owner: owner, key: String(r[8] || '').trim() || owner, name: String(r[1]), type: String(r[2]), opened: String(r[3]), prices: pv_json_(r[4], {}),
    revenue: Number(r[5]) || 0, sales: Number(r[6]) || 0, notice: String(r[7] || ''), fund: Number(r[9]) || 0, settled: String(r[10] || '').slice(0, 10), status: String(r[11] || '營業中') };
}
function v40_shops_() { return pv_rows_('shops').map(v40_rowToShop_).filter(function (s) { return s && s.status !== '已結束'; }); }
function v40_writeShop_(s, fields) {
  var sh = pv_sh_('shops'), rng = sh.getRange(s.row, 9, 1, 4); rng.setNumberFormat('@');
  var v = [fields.key != null ? fields.key : s.key, String(Math.round((fields.fund != null ? fields.fund : s.fund) * 100) / 100), fields.settled || s.settled || gm_today_(), fields.status || s.status];
  rng.setValues([v]); GM_CACHE_.rows_pv_shops = null;
}
// 結算營運金到今天；不夠 → 暫停營業。回傳最新的 shop
function v40_settle_(s) {
  var t = gm_today_();
  if (!s.settled) { var f0 = s.fund || v40_shopCost_().month; v40_writeShop_(s, { settled: t, fund: f0 }); s.settled = t; s.fund = f0; return s; }   // v1.40 前開的舊店：送一個月營運金，從今天開始算
  if (s.settled >= t) return s;
  var cost = v40_accrue_(s.settled, t), fund = s.fund - cost, st = s.status;
  if (fund < 0) { fund = 0; st = '暫停營業'; }
  v40_writeShop_(s, { fund: fund, settled: t, status: st });
  s.fund = fund; s.settled = t; s.status = st; return s;
}
function sp_shop_(key) {   // key：店號（第 1 家就是員工編號，第 2 家是「員工編號-2」）
  key = String(key || '').trim();
  var all = v40_shops_(), s = all.filter(function (x) { return x.key === key; })[0] || all.filter(function (x) { return x.owner === key; })[0];
  return s ? v40_settle_(s) : null;
}
function v40_myShops_(emp) { return v40_shops_().filter(function (s) { return s.owner === emp; }).map(v40_settle_); }
function v40_vid_(p) { var v = typeof au_verifiedId_ === 'function' ? au_verifiedId_() : ''; return v || ''; }

function sp_list_(p) {
  var emps = gm_emps_(), me = v40_vid_(p) || String(p.empId || '').trim(), cost = v40_shopCost_();
  var shops = v40_shops_().map(v40_settle_).map(function (s) {
    var e = emps[s.owner];
    return { key: s.key, owner: s.owner, ownerName: e ? (e.nick || e.name) : s.owner, name: s.name, type: s.type, level: sp_level_(s.sales), sales: s.sales, notice: s.notice,
      items: sp_items_(s.type, s.prices), status: s.status, fund: s.owner === me ? Math.floor(s.fund) : undefined };
  });
  var off = String(gm_param_('正式版開始日') || '').trim(), testing = !off || gm_today_() < off;
  var max = Number(gm_param_('小店每人上限')) || 2, mine = shops.filter(function (s) { return s.owner === me; });
  var eligible = (testing || gm_hasBadge_(me, 'tenure_1', '')) && mine.length < max;
  var gifts = pv_rows_('gifts').filter(function (r) { return r[2] === me; }).slice(-10).reverse().map(function (r) {
    var f = emps[r[1]], c = gm_catalog_()[r[3]] || {}; return { time: String(r[0]), from: f ? (f.nick || f.name) : r[1], item: c.name, icon: String(c.note || '').split(':')[1] || '🎁', unread: !r[4] };
  });
  var people = Object.keys(emps).filter(function (k) { return !emps[k].resigned && k !== me; }).map(function (k) { return { id: k, name: emps[k].nick || emps[k].name }; });
  return { success: true, data: { people: people, shops: shops, mine: mine[0] || null, myShops: mine, maxShops: max, eligible: eligible, testing: testing,
    types: PV_SHOP_TYPES, fee: pv_param_('小店開店費'), share: pv_param_('小店店主分潤'), threshold: String(gm_param_('資歷門檻') || '1080').split(',')[0], gifts: gifts, balance: gm_balance_(me),
    cost: cost, proposals: v40_myProposals_(me) } };
}
function sp_open_(p) {
  var emp = v40_vid_(p); if (!emp) return { error: '請重新登入後再開店' };
  if (!gm_emp_(emp) || gm_isFrozen_(emp)) return { error: '帳號無法使用' };
  var off = String(gm_param_('正式版開始日') || '').trim(), testing = !off || gm_today_() < off;
  if (!testing && !gm_hasBadge_(emp, 'tenure_1', '')) return { error: '累計工時達 ' + String(gm_param_('資歷門檻')).split(',')[0] + ' 小時才能開店' };
  var mine = v40_myShops_(emp), max = Number(gm_param_('小店每人上限')) || 2;
  if (mine.length >= max) return { error: '一個人最多開 ' + max + ' 家' };
  var type = String(p.type || ''), name = String(p.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12);
  if (PV_SHOP_TYPES.indexOf(type) < 0) return { error: '店型不正確' };
  if (!name) return { error: '請幫小店取名字' };
  var fee = pv_param_('小店開店費'), cost = v40_shopCost_(), pre = Math.max(cost.month, Math.round(Number(p.prepay) || 0));
  if (gm_balance_(emp) < fee + pre) return { error: '赤心幣不足（開店費 ' + fee + ' ＋ 預付營運金 ' + pre + ' 枚）' };
  var used = {}; mine.forEach(function (s) { used[s.key] = 1; });
  var key = !used[emp] ? emp : emp + '-2'; if (used[key]) key = emp + '-' + (mine.length + 1);
  gm_credit_(emp, '開店費', -fee, '開了「' + name + '」' + (testing ? '（測試期免資歷門檻）' : ''), 'SHOPOPEN|' + key + '|' + gm_now_());
  gm_credit_(emp, '小店營運金', -pre, '「' + name + '」預付營運金', 'SHOPFUND|' + key + '|' + gm_now_());
  pv_append_('shops', [[emp, name, type, gm_now_(), '{}', 0, 0, '', key, String(pre), gm_today_(), '營業中']]);
  return { success: true, key: key };
}
function v40_ownShop_(p) {
  var emp = v40_vid_(p); if (!emp) throw new Error('請重新登入後再試');
  var s = sp_shop_(p.shop || p.key || emp); if (!s || s.owner !== emp) throw new Error('這不是你的店');
  return s;
}
function sp_update_(p) {
  var s; try { s = v40_ownShop_(p); } catch (e) { return { error: e.message }; }
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
// 儲值營運金（暫停營業的店儲值後自動恢復）
function v40_shopTopup_(p) {
  var s; try { s = v40_ownShop_(p); } catch (e) { return { error: e.message }; }
  var amt = Math.round(Number(p.amount) || 0); if (amt < 1) return { error: '請填儲值金額' };
  if (gm_balance_(s.owner) < amt) return { error: '赤心幣不足' };
  gm_credit_(s.owner, '小店營運金', -amt, '「' + s.name + '」儲值營運金', 'SHOPFUND|' + s.key + '|' + gm_now_() + '|' + Math.random());
  v40_writeShop_(s, { fund: s.fund + amt, status: '營業中' });
  return { success: true, fund: Math.floor(s.fund + amt) };
}
// 結束營業：結算到今天（按天數比例收月租＋水電），剩下的營運金退回；開店費不退
function v40_shopClose_(p) {
  var s; try { s = v40_ownShop_(p); } catch (e) { return { error: e.message }; }
  var left = Math.floor(s.fund);
  if (left > 0) gm_credit_(s.owner, '小店營運金退回', left, '「' + s.name + '」結束營業，退回剩餘營運金', 'SHOPREFUND|' + s.key + '|' + gm_now_());
  v40_writeShop_(s, { fund: 0, status: '已結束' });
  var sh = pv_sh_('shops'); sh.getRange(s.row, 9).setValue(s.key + '@' + gm_today_());   // 店號加日期，之後可以用同一個店號再開
  GM_CACHE_.rows_pv_shops = null;
  try { v40_event_('shop', v40_nm_(s.owner) + ' 的「' + s.name + '」結束營業', ''); } catch (e) {}
  return { success: true, refund: left };
}
function sp_buy_(p) {   // 以 v1.31 版為底：通行證身分、同店每日上限、抽成明細；v1.40 多店、暫停營業、wear 類商品
  var buyer = String(p.empId || '').trim(), key = String(p.owner || p.shop || '').trim(), item = String(p.item || ''), to = String(p.to || '').trim();
  if (!gm_emp_(buyer) || gm_isFrozen_(buyer)) return { error: '帳號無法使用' };
  if (c31_notMe_(buyer)) return { error: '登入身分不符，請重新登入' };
  var s = sp_shop_(key); if (!s || gm_isFrozen_(s.owner)) return { error: '這家店目前沒有營業' };
  if (s.status === '暫停營業') return { error: '這家店營運金不足，暫停營業中' };
  var owner = s.owner;
  if (buyer === owner) return { error: '不能買自己店裡的東西' };
  var it = sp_items_(s.type, s.prices).filter(function (x) { return x.id === item; })[0]; if (!it) return { error: '這家店沒有賣這個' };
  var lim = c31_n_('小店同店每日購買上限', 3), today = gm_today_(), cnt = 0;
  pv_rows_('sales').forEach(function (r) { if (String(r[1]) === s.key && String(r[2]) === buyer && String(r[0]).slice(0, 10) === today) cnt++; });
  if (cnt >= lim) return { error: '今天在這家店已經買了 ' + lim + ' 件，明天再來吧' };
  if (gm_balance_(buyer) < it.price) return { error: '赤心幣不足' };
  var cat = gm_catalog_()[item], kind = cat.cat, wear = /^wear:/.test(cat.note) ? String(cat.note).slice(5) : '';
  if (kind === 'gift') { if (!gm_emp_(to) || gm_isFrozen_(to) || to === buyer) return { error: '請選擇要送給哪位隊員' }; }
  else if (wear) { if (gm_owned_(buyer)[wear]) return { error: '已經擁有了' }; }
  else if (['weapon', 'armor', 'card', 'decor'].indexOf(kind) >= 0 && gm_owned_(buyer)[item]) return { error: '已經擁有了' };
  if (kind === 'petsnack' && !gm_pet_(buyer)) return { error: '還沒有寵物' };
  var share = Math.floor(it.price * pv_param_('小店店主分潤') / 100), k = Date.now() + '|' + Math.random();
  gm_credit_(buyer, '小店消費', -it.price, '在「' + s.name + '」買了' + it.name, 'SPBUY|' + buyer + '|' + k);
  if (share) gm_credit_(owner, '小店營收', share, (gm_emp_(buyer).nick || gm_emp_(buyer).name) + ' 在「' + s.name + '」買了' + it.name + '（售價 ' + it.price + '，扣' + c31_feeSplit_(it.price - share) + '）', 'SPINC|' + owner + '|' + k);
  if (kind === 'gift') pv_append_('gifts', [[gm_now_(), buyer, to, item, '']]);
  else if (kind === 'petsnack') {
    var pet = gm_pet_(buyer), add = Number(String(cat.note).split(':')[1]) || 0;
    var prow = gm_rows_('pets')[pet.row - 2];
    var rng = gm_sh_('pets').getRange(pet.row, 6, 1, 2); rng.setNumberFormat('@');
    rng.setValues([[String((Number(prow[5]) || 0) + add), String((Number(prow[6]) || 0) + 1)]]); GM_CACHE_.rows_pets = null;
  } else gm_append_('owned', [[buyer, wear || item, '小店', gm_now_()]]);
  pv_append_('sales', [[gm_now_(), s.key, buyer, item, it.price, share, to]]);
  var rr = pv_sh_('shops').getRange(s.row, 6, 1, 2); rr.setNumberFormat('@'); rr.setValues([[String(s.revenue + share), String(s.sales + 1)]]); GM_CACHE_.rows_pv_shops = null;
  return { success: true, data: { balance: gm_balance_(buyer) } };
}
function sp_scene_() {   // 宇宙辦公室「商店街」（暫停營業的店也顯示，前端可以標示）
  var emps = gm_emps_();
  return v40_shops_().map(function (s) { var e = emps[s.owner]; return { key: s.key, owner: s.owner, ownerName: e ? (e.nick || e.name) : '', name: s.name, type: s.type, level: sp_level_(s.sales), status: s.status }; });
}
function c31_shopRent_(runDate) { /* v1.40：月租改由營運金每天扣（v40_settle_），這裡不再從上月營收扣，避免重複收 */ }

// ── 店種提案：隊員說想開什麼店、想賣什麼，管理者規劃後上架 ──
var V40_PROP_HEAD = ['編號', '時間', '員工編號', '店種名稱', '想賣什麼', '狀態', '回覆', '處理人', '處理時間'];
function v40_myProposals_(emp) {
  try {
    return v40_rows_('小店提案', V40_PROP_HEAD).filter(function (r) { return String(r[2]) === emp; }).slice(-5).reverse()
      .map(function (r) { return { id: String(r[0]), name: String(r[3]), idea: String(r[4]), status: String(r[5] || '待規劃'), reply: String(r[6] || '') }; });
  } catch (e) { return []; }
}
function v40_propose_(p) {
  var me = v39_me_();
  var name = String(p.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12), idea = String(p.idea || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 200);
  if (!name || !idea) return { error: '請填店種名稱和想賣什麼' };
  var open = v40_rows_('小店提案', V40_PROP_HEAD).filter(function (r) { return String(r[2]) === me.id && /待規劃|規劃中/.test(String(r[5] || '待規劃')); }).length;
  if (open >= 3) return { error: '同時最多 3 個提案在等規劃' };
  var id = 'SP' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss');
  v40_s_('小店提案', V40_PROP_HEAD).appendRow([id, v39_now_(), me.id, name, idea, '待規劃', '', '', '']);
  try { if (typeof line_notify_ === 'function') line_notify_('公告', '💡 隊員商店街新店提案｜' + v40_nm_(me.id) + '\n店種：' + name + '\n想賣：' + idea); } catch (e) {}
  return { success: true };
}
function v40_proposals_(p) {
  var me = v39_me_(); if (me.role < 3) return { success: true, data: v40_myProposals_(me.id) };
  return { success: true, data: v40_rows_('小店提案', V40_PROP_HEAD).slice(-50).reverse().map(function (r) {
    return { id: String(r[0]), time: String(r[1]).slice(0, 16), emp: String(r[2]), who: v40_nm_(r[2]), name: String(r[3]), idea: String(r[4]), status: String(r[5] || '待規劃'), reply: String(r[6] || '') };
  }) };
}
function v40_proposalSet_(p) {
  var me = v39_me_(); if (me.role < 3) return { error: '需要 Lv.3 以上' };
  var st = String(p.status || ''); if (['待規劃', '規劃中', '已上架', '婉拒'].indexOf(st) < 0) return { error: '狀態不正確' };
  var rows = v40_rows_('小店提案', V40_PROP_HEAD), sh = v40_s_('小店提案', V40_PROP_HEAD);
  for (var i = 0; i < rows.length; i++) if (String(rows[i][0]) === String(p.id)) {
    sh.getRange(i + 2, 6, 1, 4).setValues([[st, String(p.reply || '').slice(0, 200), me.name, v39_now_()]]);
    v40_note_(String(rows[i][2]), 'shop', '💡 你的店種提案「' + rows[i][3] + '」：' + st + (p.reply ? '｜' + String(p.reply).slice(0, 40) : ''), 'pair', String(p.id) + st);
    return { success: true };
  }
  return { error: '找不到這個提案' };
}
function v40_shopSetup_(log) {
  var sh = pv_sh_('shops'), h = sh.getRange(1, 1, 1, 12).getValues()[0];
  if (String(h[8]) !== '店號') { sh.getRange(1, 9, 1, 4).setValues([['店號', '營運金', '結算日', '狀態']]); log.push('〈小店〉加欄位：店號、營運金、結算日、狀態'); }
  v40_s_('小店提案', V40_PROP_HEAD);
  var cat = gm_catalog_(), add = V40_SHOP_ITEMS.filter(function (r) { return !cat[r[0]]; });
  if (add.length && gm_rows_('catalog').length) { gm_append_('catalog', add); log.push('〈商品目錄〉新增 ' + add.length + ' 項新店種商品'); }
  GM_CACHE_.catalog = null;
  var have = {}; gm_rows_('params').forEach(function (r) { have[String(r[0]).trim()] = 1; });
  var pa = [['小店水電', 10, 'v1.40：每家小店每月水電（和小店月租一起，從營運金每天按比例扣）'], ['小店每人上限', 2, 'v1.40：一個人最多開幾家小店']]
    .filter(function (x) { return !have[x[0]]; });
  if (!have['小店月租']) pa.push(['小店月租', 30, 'v1.40：每家小店每月租金（從營運金每天按比例扣）']);
  if (pa.length) { gm_append_('params', pa); log.push('遊戲參數新增 ' + pa.map(function (x) { return x[0]; }).join('、')); }
}

// ═════════════════════════════════════════════════════════════
// v1.40 部署端修正（11/14 16:40）：花幣動作一律要有效通行證
// 漏洞：c31_notMe_（v1.31）只在「有通行證」時檢查本人，沒有通行證就放行用 p.empId。
//   記錄模式下，可冒用別人編號在自己的小店（sp_buy_，店主拿 80%）或寵物市集（p28_buyMkt_）消費，把對方的赤心幣轉給自己。
// 修正：沒有有效通行證也算「不是本人」→ 擋下。影響 sp_buy_、p28_list_、p28_buyMkt_（都用 c31_notMe_）。
// ═════════════════════════════════════════════════════════════
function c31_notMe_(emp) {
  var v = typeof au_verifiedId_ === 'function' ? au_verifiedId_() : '';
  return !v || v !== String(emp || '').trim();
}

// ═══════════════════════════════════════════════
// 路由 extHandler_ v1.40（2026-11-14）
// 放在檔案最後，取代路由 v1.39（Apps Script 以檔案中最後一個同名函式為準）。
// 與 v1.39 路由的差別：v39Handler_ 之前加 v40Handler_（視察、提醒、坐騎、請喝咖啡；
//   接手 gmScene → v39 → h36 → s30，接手 v39Rev → v39，接手 v39Goto）。
// ═══════════════════════════════════════════════
function extHandler_(action, p) {
  p = p || {};
  var gate = au_gate_(action, p); if (gate) return gate;
  var au = auHandler_(action, p); if (au) return au;
  var sec = secHandler_(action, p); if (sec) return sec;
  var op = opsHandler_(action, p); if (op) return op;
  var bu = buHandler_(action, p); if (bu) return bu;
  var rp = rpHandler_(action, p); if (rp) return rp;
  var fs = fsHandler_(action, p); if (fs) return fs;
  var v40 = v40Handler_(action, p); if (v40) return v40;
  var v39 = v39Handler_(action, p); if (v39) return v39;
  var h36 = h36Handler_(action, p); if (h36) return h36;
  var eq = eqHandler_(action, p); if (eq) return eq;
  var qt = qtHandler_(action, p); if (qt) return qt;
  var s30 = s30Handler_(action, p); if (s30) return s30;
  var p28 = p28Handler_(action, p); if (p28) return p28;
  var ac = acHandler_(action, p); if (ac) return ac;
  var g27 = gm27Handler_(action, p); if (g27) return g27;
  var py = payHandler_(action, p); if (py) return py;
  var ln = lineHandler_(action, p); if (ln) return ln;
  var pr = pollHandler_(action, p);
  if (pr) return pr;
  var sc = schHandler_(action, p); if (sc) return sc;
  var pw = pwHandler_(action, p); if (pw) return pw;
  var av = avHandler_(action, p); if (av) return av;
  var od = odHandler_(action, p); if (od) return od;
  var bt = btHandler_(action, p); if (bt) return bt;
  var gm = gmHandler_(action, p); if (gm) return gm;
  var pv = pvHandler_(action, p); if (pv) return pv;
  var so = sopHandler_(action, p); if (so) return so;
  if (action === 'getOnDutyCrew') { try { return uo_onDutyCrew_(p); } catch (e) { return { error: '在班名單錯誤:' + e.message }; } }
  try {
    if (action === 'getTodayBirthdays') return bday_today_(p);
    if (action === 'getShortages')    return uo_getShortages();
    if (action === 'addShortage')     return uo_addShortage(p);
    if (action === 'resolveShortage') return uo_resolveShortage(p);
  } catch (e) { return { error: '缺貨看板錯誤:' + e.message }; }
  return null;
}
