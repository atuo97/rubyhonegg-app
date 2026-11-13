// ═══════════════════════════════════════════════
// v1.35 設備檢查清單（2026-11-14）
// 貼在「開店資格修正 v1.34」之後、「路由 v1.35」之前。部署後執行一次 eq_setup()（建〈設備模板〉〈設備清單〉，放入隊長給的 8 份模板）
// 三種用途：🎪 活動出攤／百貨快閃、🏬 設櫃、✈️ 出國（新加坡、馬來西亞、越南、印尼、日本）
// 一張清單三關：① 出發前打包 → ② 到場確認 → ③ 收攤點收（少了、壞了 → 待補購，用單價算補購金額）
// 權限：建立、修改清單與模板要 Lv.3 以上且有有效登入通行證（au_verifiedId_）；勾選：Lv.2 以上，或被排進這張清單的夥伴
// 數量自動算：項目「計算」= 人 → × 出團人數；= 百顆 → 預計總顆數 ÷ 100 無條件進位（1 包麵粉約 100 顆）
// 出國當地採購：1 包麵粉＝1 批麵糊＝約 100 顆；每天預計顆數 → 批數 → 雞蛋、牛奶、油、糖…（每批用量在模板裡，可改）
// ═══════════════════════════════════════════════

var EQ_TPL_HEAD = ['模板', '類型', '國家', '電壓', '資訊欄', '項目', '當地採購', '裝箱', '排序', '更新人', '更新時間'];
var EQ_HEAD = ['編號', '模板', '類型', '名稱', '開始日', '結束日', '地點', '人數', '預計顆數', '每日顆數', '資訊', '項目', '狀態', '報價單', '出勤夥伴', '建立人', '建立時間', '更新時間', '當地採購', '裝箱', '國家', '電壓'];
var EQ_TYPES = ['活動', '快閃', '設櫃', '出國'];
var EQ_STAGES = {
  '活動': ['出發前打包', '到場確認', '收攤點收'],
  '快閃': ['出發前打包', '進櫃確認', '撤櫃點收'],
  '設櫃': ['出發前打包', '進櫃確認', '撤櫃點收'],
  '出國': ['打包裝箱', '抵達確認', '回國點收']
};
var EQ_PER_BATCH = 100;   // 1 包麵粉／1 批麵糊約幾顆（〈參數設定〉「每包麵粉顆數」可改）

function eq_perBatch_() { var n = 0; try { n = Number(ops_param_('每包麵粉顆數')) || 0; } catch (e) {} return n > 0 ? n : EQ_PER_BATCH; }
function eq_sheet_(name, head) {
  var ss = ops_ss_(), sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.getRange(1, 1, 1, head.length).setValues([head]); sh.setFrozenRows(1); }
  return sh;
}
function eq_rows_(name, head) {
  var sh = eq_sheet_(name, head); if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, head.length).getValues().map(function (r, i) { return { row: i + 2, v: r }; });
}
function eq_j_(s, d) { if (s && typeof s === 'object') return s; try { return s ? JSON.parse(String(s)) : d; } catch (e) { return d; } }
function eq_str_(v, n) { return String(v == null ? '' : v).trim().slice(0, n || 200); }
function eq_num_(v) { var n = Number(v); return isFinite(n) ? n : 0; }
function eq_day_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Taipei', 'yyyy-MM-dd');
  var s = String(v || '').trim().replace(/\//g, '-'); var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : '';
}
function eq_today_() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd'); }
function eq_addDay_(d, n) { var t = new Date(d + 'T00:00:00+08:00'); t.setDate(t.getDate() + n); return Utilities.formatDate(t, 'Asia/Taipei', 'yyyy-MM-dd'); }

// ── 身分 ──
// 管理動作：一律以通行證本人為準，沒有通行證就擋下（依《部署交接》安全規則）
function eq_admin_() {
  var tid = au_verifiedId_();
  if (!tid) throw new Error('請更新 App 後重新登入');
  var me = ops_me_(tid); if (me.role < 3) throw new Error('建立和修改設備清單需要 Lv.3 以上');
  return me;
}
// 查看、勾選：有通行證用通行證本人；「記錄」模式下沒帶通行證才退回 empId（只能勾自己被排到的清單，Lv.2 以上可以勾全部）
function eq_who_(p) {
  var tid = au_verifiedId_();
  return ops_me_(tid || p.empId);
}
function eq_canSee_(me, L) { return me.role >= 2 || L.crew.indexOf(me.id) >= 0 || L.by === me.id; }

// ── 模板 ──
function eq_item_(x, i) {
  x = x || {};
  var o = { id: eq_str_(x.id, 20) || ('i' + (i + 1)), c: eq_str_(x.c, 30) || '其他', n: eq_str_(x.n, 40), d: eq_str_(x.d, 80), q: eq_num_(x.q === undefined || x.q === '' ? 1 : x.q),
    u: eq_str_(x.u, 10), p: Math.max(0, eq_num_(x.p)), m: eq_str_(x.m, 120), k: ['人', '百顆'].indexOf(String(x.k || '')) >= 0 ? String(x.k) : '', b: eq_str_(x.b, 30) };
  return o;
}
function eq_cleanItems_(arr) {
  var out = [], ids = {};
  (arr || []).forEach(function (x, i) {
    var o = eq_item_(x, i); if (!o.n) return;
    if (ids[o.id]) o.id = 'i' + (i + 1) + '_' + Utilities.getUuid().slice(0, 4);
    ids[o.id] = 1; out.push(o);
  });
  return out.slice(0, 300);
}
function eq_tplOf_(r) {
  var v = r.v;
  return { row: r.row, name: String(v[0]), type: String(v[1] || '活動'), country: String(v[2] || ''), volt: String(v[3] || ''),
    info: eq_j_(v[4], []), items: eq_j_(v[5], []), buy: eq_j_(v[6], []), boxes: eq_j_(v[7], []), sort: eq_num_(v[8]), by: String(v[9] || ''), at: String(v[10] || '') };
}
function eq_tpls_() {
  return eq_rows_('設備模板', EQ_TPL_HEAD).filter(function (r) { return String(r.v[0]).trim(); }).map(eq_tplOf_)
    .sort(function (a, b) { return a.sort - b.sort; });
}
function eq_tplRow_(t, me) {
  return [t.name, t.type, t.country || '', t.volt || '', JSON.stringify(t.info || []), JSON.stringify(t.items || []), JSON.stringify(t.buy || []),
    JSON.stringify(t.boxes || []), t.sort || 0, me ? me.name : '系統', ops_now_()];
}

// ── 清單 ──
function eq_listOf_(r) {
  var v = r.v;
  return { row: r.row, id: String(v[0]), tpl: String(v[1]), type: String(v[2] || '活動'), name: String(v[3]), from: eq_day_(v[4]), to: eq_day_(v[5]) || eq_day_(v[4]),
    loc: String(v[6] || ''), people: eq_num_(v[7]), cakes: eq_num_(v[8]), days: eq_j_(v[9], []), info: eq_j_(v[10], {}), items: eq_j_(v[11], []),
    status: String(v[12] || '準備中'), quote: String(v[13] || ''), crew: String(v[14] || '').split(/[、,\s]+/).filter(String),
    by: String(v[15] || ''), at: String(v[16] || ''), updated: String(v[17] || ''), buy: eq_j_(v[18], []), boxes: eq_j_(v[19], []), country: String(v[20] || ''), volt: String(v[21] || '') };
}
function eq_lists_() { return eq_rows_('設備清單', EQ_HEAD).filter(function (r) { return String(r.v[0]).trim(); }).map(eq_listOf_); }
function eq_find_(id) { var L = eq_lists_().filter(function (x) { return x.id === String(id || ''); })[0]; if (!L) throw new Error('找不到這張清單'); return L; }
function eq_write_(L) {
  var v = [L.id, L.tpl, L.type, L.name, L.from, L.to, L.loc, L.people || '', L.cakes || '', JSON.stringify(L.days || []), JSON.stringify(L.info || {}),
    JSON.stringify(L.items || []), L.status, L.quote || '', (L.crew || []).join('、'), L.by, L.at, ops_now_(), JSON.stringify(L.buy || []), JSON.stringify(L.boxes || []), L.country || '', L.volt || ''];
  var sh = eq_sheet_('設備清單', EQ_HEAD), row = L.row || sh.getLastRow() + 1, rng = sh.getRange(row, 1, 1, EQ_HEAD.length);
  rng.setNumberFormat('@'); rng.setValues([v.map(String)]); L.row = row;
}
// 依人數、顆數算數量（只算有「計算」的項目；手動改過的 qm=1 不再自動算）
function eq_calcQty_(L) {
  var per = eq_perBatch_(), total = eq_num_(L.cakes);
  if (L.days && L.days.length) total = L.days.reduce(function (a, d) { return a + eq_num_(d.n); }, 0) || total;
  (L.items || []).forEach(function (it) {
    if (it.qm) return;
    if (it.k === '人' && L.people > 0) it.q = L.people;
    if (it.k === '百顆' && total > 0) it.q = Math.ceil(total / per);
  });
}
// 當地採購：每天批數 × 每批用量
function eq_buyPlan_(L) {
  var per = eq_perBatch_(), days = (L.days || []).filter(function (d) { return eq_num_(d.n) > 0; });
  if (!(L.buy || []).length || !days.length) return null;
  var rows = days.map(function (d) {
    var b = Math.ceil(eq_num_(d.n) / per);
    return { d: d.d, n: eq_num_(d.n), batches: b, items: L.buy.map(function (x) { return { n: x.n, u: x.u, a: Math.round(eq_num_(x.a) * b * 10) / 10 }; }) };
  });
  var tb = rows.reduce(function (a, r) { return a + r.batches; }, 0);
  return { per: per, days: rows, batches: tb, total: L.buy.map(function (x) { return { n: x.n, u: x.u, a: Math.round(eq_num_(x.a) * tb * 10) / 10, each: eq_num_(x.a) }; }) };
}
function eq_stageCount_(L) {
  var n = L.items.length, c = [0, 0, 0], bad = 0, fix = 0, cost = 0;
  L.items.forEach(function (it) {
    var st = it.st || [];
    for (var i = 0; i < 3; i++) if (st[i]) c[i]++;
    if (it.back && it.back !== 'ok') { bad++; if (!it.fixed) { fix++; cost += (it.p || 0) * Math.max(1, eq_num_(it.miss) || 1); } }
  });
  return { n: n, done: c, bad: bad, fix: fix, cost: cost };
}
function eq_summary_(L) {
  var sc = eq_stageCount_(L);
  return { id: L.id, tpl: L.tpl, type: L.type, name: L.name, from: L.from, to: L.to, loc: L.loc, status: L.status, quote: L.quote, crew: L.crew,
    by: L.by, at: L.at, updated: L.updated, n: sc.n, done: sc.done, bad: sc.bad, fix: sc.fix, cost: sc.cost, stages: EQ_STAGES[L.type] || EQ_STAGES['活動'], country: L.country };
}
function eq_full_(L) {
  var o = eq_summary_(L);
  ['people', 'cakes', 'days', 'info', 'items', 'buy', 'boxes', 'volt'].forEach(function (k) { o[k] = L[k]; });
  o.plan = eq_buyPlan_(L);
  var names = {}; try { ops_staff_().list.forEach(function (s) { names[s.id] = s.nick || s.name; }); } catch (e) {}
  o.crewNames = L.crew.map(function (id) { return names[id] || id; });
  return o;
}
function eq_staffNames_() {
  var out = []; try { ops_staff_().list.forEach(function (s) { if (!s.left) out.push({ id: s.id, name: s.nick || s.name, role: s.role }); }); } catch (e) {}
  return out;
}

// ── API ──
function eq_meta_(p) {
  var me = eq_who_(p), admin = me.role >= 3;
  var tpls = eq_tpls_().map(function (t) {
    var o = { name: t.name, type: t.type, country: t.country, volt: t.volt, info: t.info, n: t.items.length, buy: t.buy, boxes: t.boxes, by: t.by, at: t.at };
    if (admin && p.full) o.items = t.items;
    return o;
  });
  return { success: true, types: EQ_TYPES, stages: EQ_STAGES, perBatch: eq_perBatch_(), tpls: tpls, admin: admin, people: admin ? eq_staffNames_() : [] };
}
function eq_list_(p) {
  var me = eq_who_(p), all = eq_lists_().filter(function (L) { return eq_canSee_(me, L); });
  var t = eq_today_(), lim = eq_addDay_(t, -60);
  var data = all.filter(function (L) { return p.all || L.status === '準備中' || L.to >= lim || eq_stageCount_(L).fix > 0; })
    .sort(function (a, b) { return (a.status === '準備中' ? 0 : 1) - (b.status === '準備中' ? 0 : 1) || (a.from < b.from ? -1 : a.from > b.from ? 1 : 0); })
    .map(eq_summary_);
  return { success: true, data: data.slice(0, 200), admin: me.role >= 3 };
}
function eq_get_(p) {
  var me = eq_who_(p), L = eq_find_(p.id);
  if (!eq_canSee_(me, L)) throw new Error('你沒有被排進這張清單');
  var o = eq_full_(L); o.admin = me.role >= 3; o.me = me.id; return { success: true, data: o };
}
// 建立：從模板（可帶報價單）
function eq_create_(p) {
  var me = eq_admin_();
  var t = eq_tpls_().filter(function (x) { return x.name === String(p.tpl || ''); })[0]; if (!t) return { error: '找不到模板「' + (p.tpl || '') + '」' };
  var L = { id: 'EQ' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss') + Utilities.getUuid().replace(/-/g, '').slice(0, 4).toUpperCase(),
    tpl: t.name, type: t.type, name: eq_str_(p.name, 60), from: eq_day_(p.from), to: eq_day_(p.to) || eq_day_(p.from), loc: eq_str_(p.loc, 80),
    people: Math.max(0, Math.round(eq_num_(p.people))), cakes: Math.max(0, Math.round(eq_num_(p.cakes))), days: [], info: {}, items: [], status: '準備中',
    quote: '', crew: [], by: me.id, at: ops_now_(), buy: t.buy || [], boxes: t.boxes || [], country: t.country || '', volt: t.volt || '' };
  var info = eq_j_(p.info, {}); (t.info || []).forEach(function (k) { if (info[k] !== undefined) L.info[k] = eq_str_(info[k], 200); });
  var crew = eq_j_(p.crew, []); var staff = ops_staff_().map;
  L.crew = (Array.isArray(crew) ? crew : String(crew).split(/[、,\s]+/)).map(String).filter(function (id) { return staff[id] && !staff[id].left; }).slice(0, 30);
  var days = eq_j_(p.days, []); if (Array.isArray(days)) L.days = days.map(function (d) { return { d: eq_day_(d.d), n: Math.max(0, Math.round(eq_num_(d.n))) }; }).filter(function (d) { return d.d; }).slice(0, 60);
  var opt = eq_j_(p.opts, {});
  // 報價單帶入
  if (p.quote) {
    var q = null; try { q = qt_rows_().filter(function (x) { return x.id === String(p.quote); })[0]; } catch (e) {}
    if (!q) return { error: '找不到這張報價單' };
    var f = eq_j_(q.form, {}) || {}, dates = String(q.dates || '').split('、').map(eq_day_).filter(String).sort();
    L.quote = q.id;
    if (!L.name) L.name = (q.event || '活動') + (q.client ? '｜' + q.client : '');
    if (!L.from && dates.length) { L.from = dates[0]; L.to = dates[dates.length - 1]; }
    if (!L.loc) L.loc = String(f.eLoc || '');
    var perDay = Math.max(0, Math.round(eq_num_(f.qty)));
    if (!L.cakes && perDay) L.cakes = perDay * Math.max(1, dates.length);
    if (!L.days.length && perDay && t.type === '出國') L.days = dates.map(function (d) { return { d: d, n: perDay }; });
    var set = function (k, v) { if (v && (t.info || []).indexOf(k) >= 0 && !L.info[k]) L.info[k] = eq_str_(v, 200); };
    set('活動名稱', q.event); set('活動日期', q.dates); set('活動地點', f.eLoc); set('活動時間', [f.eS, f.eE].filter(String).join('～'));
    set('進場日期與時間', f.eS ? (dates[0] || '') + ' ' + f.eS : ''); set('雞蛋糕數量', perDay ? perDay + ' 顆／天 × ' + dates.length + ' 天' : '');
    set('包材類別', f.pkg1n); set('品牌客戶抬頭', q.client); set('客戶統編', f.cT); set('客戶聯絡人', f.wN); set('客戶電話', f.wP);
    set('電力準備', f.ovenQty ? '烤爐 ' + f.ovenQty + ' 台（每台 1,500W）' : '');
    opt.ovens = opt.ovens || eq_num_(f.ovenQty); if (f.mold === false) opt.noMold = true;
  }
  if (!L.name) return { error: '請填清單名稱' };
  if (!L.from) return { error: '請選日期' };
  if (L.to < L.from) L.to = L.from;
  L.items = eq_cleanItems_(t.items).map(function (it) {
    if (opt.ovens > 0 && it.n === '機器') it.q = opt.ovens;
    it.st = [null, null, null]; return it;
  }).filter(function (it) { return !(opt.noMold && it.n === '客製模具'); });
  eq_calcQty_(L);
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try { eq_write_(L); } finally { lock.releaseLock(); }
  return { success: true, id: L.id, data: eq_full_(L) };
}
// 勾選：stage 0/1/2；on=true/false；第三關可帶 back='ok'|'少'|'壞'、miss=數量
function eq_check_(p) {
  var me = eq_who_(p), lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var L = eq_find_(p.id);
    if (!(me.role >= 2 || L.crew.indexOf(me.id) >= 0 || L.by === me.id)) throw new Error('你沒有被排進這張清單，請管理者把你加進出勤夥伴');
    if (L.status !== '準備中') throw new Error('這張清單已經' + L.status + '，不能再勾');
    var stage = Math.round(eq_num_(p.stage)); if (stage < 0 || stage > 2) throw new Error('關卡不對');
    var ids = eq_j_(p.items, null); if (!Array.isArray(ids)) ids = [String(p.item || '')];
    var on = !(p.on === false || p.on === 'false' || p.on === 0 || p.on === '0'), back = String(p.back || ''), hit = 0, now = ops_now_();
    L.items.forEach(function (it) {
      if (ids.indexOf(it.id) < 0) return; hit++;
      it.st = it.st || [null, null, null];
      if (stage === 2 && back) {
        if (['ok', '少', '壞'].indexOf(back) < 0) throw new Error('點收狀態不對');
        it.back = back; it.miss = back === 'ok' ? 0 : Math.max(1, Math.min(eq_num_(it.q) || 1, Math.round(eq_num_(p.miss) || 1)));
        it.st[2] = { by: me.nick || me.name, at: now }; if (back === 'ok') { delete it.fixed; }
        if (p.note !== undefined) it.bn = eq_str_(p.note, 100);
      } else {
        it.st[stage] = on ? { by: me.nick || me.name, at: now } : null;
        if (stage === 2 && !on) { delete it.back; delete it.miss; delete it.fixed; delete it.bn; }
        if (stage === 2 && on && !it.back) it.back = 'ok';
      }
    });
    if (!hit) throw new Error('找不到這個項目');
    eq_write_(L);
    return { success: true, data: eq_full_(L) };
  } finally { lock.releaseLock(); }
}
// 修改清單（Lv.3）：基本資料、資訊欄、項目、每日顆數、出勤夥伴、狀態
function eq_save_(p) {
  var me = eq_admin_(), lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var L = eq_find_(p.id), d = eq_j_(p.data, {}) || {};
    if (d.name !== undefined) L.name = eq_str_(d.name, 60) || L.name;
    if (d.from !== undefined) L.from = eq_day_(d.from) || L.from;
    if (d.to !== undefined) L.to = eq_day_(d.to) || L.from;
    if (L.to < L.from) L.to = L.from;
    if (d.loc !== undefined) L.loc = eq_str_(d.loc, 80);
    if (d.people !== undefined) L.people = Math.max(0, Math.round(eq_num_(d.people)));
    if (d.cakes !== undefined) L.cakes = Math.max(0, Math.round(eq_num_(d.cakes)));
    if (d.days !== undefined) L.days = (d.days || []).map(function (x) { return { d: eq_day_(x.d), n: Math.max(0, Math.round(eq_num_(x.n))) }; }).filter(function (x) { return x.d; }).slice(0, 60);
    if (d.info !== undefined) { var o = {}; for (var k in d.info) o[eq_str_(k, 30)] = eq_str_(d.info[k], 200); L.info = o; }
    if (d.crew !== undefined) { var staff = ops_staff_().map; L.crew = (d.crew || []).map(String).filter(function (id) { return staff[id] && !staff[id].left; }).slice(0, 30); }
    if (d.buy !== undefined) L.buy = (d.buy || []).map(function (x) { return { n: eq_str_(x.n, 20), a: eq_num_(x.a), u: eq_str_(x.u, 8) }; }).filter(function (x) { return x.n; }).slice(0, 30);
    if (d.items !== undefined) {         // 保留已勾的紀錄
      var old = {}; L.items.forEach(function (it) { old[it.id] = it; });
      L.items = eq_cleanItems_(d.items).map(function (it, i) {
        var o = old[it.id], src = d.items[i] || {};
        if (o) { ['st', 'back', 'miss', 'fixed', 'bn', 'qm'].forEach(function (k) { if (o[k] !== undefined) it[k] = o[k]; }); if (Number(o.q) !== Number(it.q)) it.qm = 1; }
        else { it.id = 'n' + Date.now().toString(36) + i; it.st = [null, null, null]; }
        if (src.qm === 0) delete it.qm;
        return it;
      });
    }
    if (d.status !== undefined) { if (['準備中', '已完成', '取消'].indexOf(d.status) < 0) return { error: '狀態不對' }; L.status = d.status; }
    eq_calcQty_(L);
    eq_write_(L);
    return { success: true, data: eq_full_(L) };
  } finally { lock.releaseLock(); }
}
// 待補購：標「已補購」（Lv.3）
function eq_fix_(p) {
  var me = eq_admin_(), lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var L = eq_find_(p.id), ids = eq_j_(p.items, null); if (!Array.isArray(ids)) ids = [String(p.item || '')];
    var on = !(p.on === false || p.on === 'false'), hit = 0;
    L.items.forEach(function (it) { if (ids.indexOf(it.id) >= 0 && it.back && it.back !== 'ok') { hit++; if (on) it.fixed = { by: me.nick || me.name, at: ops_now_() }; else delete it.fixed; } });
    if (!hit) return { error: '沒有要補購的項目' };
    eq_write_(L);
    return { success: true, data: eq_full_(L) };
  } finally { lock.releaseLock(); }
}
// 全部待補購（跨清單）
function eq_fixList_(p) {
  var me = eq_who_(p); if (me.role < 2) throw new Error('需要 Lv.2 以上');
  var out = [];
  eq_lists_().forEach(function (L) {
    L.items.forEach(function (it) {
      if (it.back && it.back !== 'ok' && !it.fixed) out.push({ list: L.id, listName: L.name, date: L.from, id: it.id, n: it.n, c: it.c, back: it.back, miss: it.miss || 1, u: it.u, p: it.p || 0, cost: (it.p || 0) * (it.miss || 1), note: it.bn || '', by: it.st && it.st[2] ? it.st[2].by : '' });
    });
  });
  return { success: true, data: out, total: out.reduce(function (a, x) { return a + x.cost; }, 0) };
}
// 模板：存（新增或修改；改名時 old 帶舊名）
function eq_tplSave_(p) {
  var me = eq_admin_(), t = eq_j_(p.tpl, {}) || {};
  var name = eq_str_(t.name, 30); if (!name) return { error: '請填模板名稱' };
  if (EQ_TYPES.indexOf(t.type) < 0) return { error: '類型要是 ' + EQ_TYPES.join('／') };
  var items = eq_cleanItems_(t.items); if (!items.length) return { error: '模板至少要有一個項目' };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var all = eq_tpls_(), old = String(p.old || ''), hit = old ? all.filter(function (x) { return x.name === old; })[0] : null;
    if (old && !hit) return { error: '找不到原本的模板「' + old + '」' };
    if (all.some(function (x) { return x.name === name && (!hit || x.row !== hit.row); })) return { error: '已經有叫「' + name + '」的模板' };
    var row = { name: name, type: t.type, country: eq_str_(t.country, 20), volt: eq_str_(t.volt, 10),
      info: (t.info || []).map(function (x) { return eq_str_(x, 30); }).filter(String).slice(0, 40), items: items,
      buy: (t.buy || []).map(function (x) { return { n: eq_str_(x.n, 20), a: eq_num_(x.a), u: eq_str_(x.u, 8) }; }).filter(function (x) { return x.n; }).slice(0, 30),
      boxes: (t.boxes || []).map(function (x) { return eq_str_(x, 30); }).filter(String).slice(0, 20), sort: hit ? hit.sort : all.length + 1 };
    var sh = eq_sheet_('設備模板', EQ_TPL_HEAD), r = hit ? hit.row : sh.getLastRow() + 1;
    sh.getRange(r, 1, 1, EQ_TPL_HEAD.length).setValues([eq_tplRow_(row, me)]);
  } finally { lock.releaseLock(); }
  return { success: true, name: name };
}
function eq_tplDel_(p) {
  var me = eq_admin_(), hit = eq_tpls_().filter(function (x) { return x.name === String(p.name || ''); })[0];
  if (!hit) return { error: '找不到這個模板' };
  if (eq_tpls_().length <= 1) return { error: '至少要留一個模板' };
  eq_sheet_('設備模板', EQ_TPL_HEAD).deleteRow(hit.row);
  return { success: true };
}
// 首頁提醒：3 天內要出發、打包還沒完成；收攤後還沒點收；待補購（Lv.3）
function eq_todo_(empId) {
  var out = [];
  try {
    var me = ops_me_(au_verifiedId_() || empId), t = eq_today_(), soon = eq_addDay_(t, 3), fixN = 0, fixCost = 0;
    eq_lists_().forEach(function (L) {
      var mine = L.crew.indexOf(me.id) >= 0 || L.by === me.id || (me.role >= 3 && !L.crew.length);
      var sc = eq_stageCount_(L); fixN += sc.fix; fixCost += sc.cost;
      if (L.status !== '準備中' || !mine) return;
      var stg = EQ_STAGES[L.type] || EQ_STAGES['活動'];
      if (L.from >= t && L.from <= soon && sc.done[0] < sc.n) {
        var when = L.from === t ? '今天' : L.from === eq_addDay_(t, 1) ? '明天' : L.from.slice(5).replace('-', '/');
        out.push({ icon: '🧰', text: when + '「' + L.name + '」' + stg[0] + '還有 ' + (sc.n - sc.done[0]) + ' 項沒打勾', tab: 'equip', red: L.from <= eq_addDay_(t, 1), eq: L.id });
      } else if (L.to < t && L.to >= eq_addDay_(t, -7) && sc.done[2] < sc.n) {
        out.push({ icon: '📦', text: '「' + L.name + '」' + stg[2] + '還有 ' + (sc.n - sc.done[2]) + ' 項', tab: 'equip', red: false, eq: L.id });
      }
    });
    if (me.role >= 3 && fixN) out.push({ icon: '🛒', text: '設備待補購 ' + fixN + ' 項' + (fixCost ? '（約 ' + fixCost.toLocaleString() + ' 元）' : ''), tab: 'equip', red: false });
  } catch (e) {}
  return out;
}

AU_READ = new RegExp(AU_READ.source.replace('|quotePage|quoteList)$', '|quotePage|quoteList|eqMeta|eqGet|eqFixList)$'));

function eqHandler_(action, p) {
  if (action === 'homeTodo') {            // 接在 v1.30 的首頁待辦後面
    try {
      var t = s30Handler_('homeTodo', p);
      if (t && t.success) { var ex = eq_todo_(p.empId); if (ex.length) t.data = ex.concat(t.data || []); }
      return t;
    } catch (e) { return null; }
  }
  var map = { eqMeta: eq_meta_, eqList: eq_list_, eqGet: eq_get_, eqCreate: eq_create_, eqCheck: eq_check_, eqSave: eq_save_,
    eqFix: eq_fix_, eqFixList: eq_fixList_, eqTplSave: eq_tplSave_, eqTplDel: eq_tplDel_ };
  if (!map[action]) return null;
  try { OPS_C_ = {}; return map[action](p); } catch (e) { return { error: e.message }; }
}

// 部署後執行一次：建分頁、放入模板（已經有同名模板就不動，不會蓋掉你改過的）
function eq_setup() {
  OPS_C_ = {};
  eq_sheet_('設備清單', EQ_HEAD);
  var have = {}; eq_tpls_().forEach(function (t) { have[t.name] = 1; });
  var sh = eq_sheet_('設備模板', EQ_TPL_HEAD), add = 0;
  EQ_SEED.forEach(function (t, i) {
    if (have[t.name]) return;
    t.items = eq_cleanItems_(t.items); t.sort = i + 1;
    sh.getRange(sh.getLastRow() + 1, 1, 1, EQ_TPL_HEAD.length).setValues([eq_tplRow_(t, null)]); add++;
  });
  try { if (!String(ops_param_('每包麵粉顆數') || '')) { var ps = ops_ss_().getSheetByName('參數設定'); if (ps) ps.appendRow(['每包麵粉顆數', EQ_PER_BATCH, '設備檢查清單：1 包麵粉／1 批麵糊約幾顆']); } } catch (e) {}
  Logger.log('eq_setup 完成：新增模板 ' + add + ' 份');
  return add;
}

// 隊長 11/13 給的 Excel：《出攤準備檢查清單》《生財工具箱》（各國＋價格表）＋ 11/14 補的設櫃項目
var EQ_SEED = [{"name":"活動出攤","type":"活動","info":["活動名稱","活動日期","活動地點","活動時間","進場日期與時間","雞蛋糕數量","雞蛋糕份數","每份數量","包材類別","發放方式","電力準備","桌子準備","其他事項","品牌客戶抬頭","客戶統編","客戶聯絡人","客戶電話"],"items":[{"c":"食材與麵糊準備","n":"保冰桶","q":1},{"c":"食材與麵糊準備","n":"冰磚","q":1},{"c":"食材與麵糊準備","n":"保冷袋","q":1},{"c":"食材與麵糊準備","n":"麵糊","q":1},{"c":"食材與麵糊準備","n":"低筋麵粉","q":1},{"c":"食材與麵糊準備","n":"二砂糖","q":1},{"c":"食材與麵糊準備","n":"攪拌器","q":1},{"c":"食材與麵糊準備","n":"攪拌器盒子","q":1},{"c":"食材與麵糊準備","n":"冷水壺","q":1},{"c":"食材與麵糊準備","n":"麵糊器","q":1},{"c":"食材與麵糊準備","n":"鐵盤","q":1},{"c":"食材與麵糊準備","n":"夾子","q":1,"p":50},{"c":"用電與機具","n":"機器","q":1},{"c":"用電與機具","n":"烙鐵棒","q":1},{"c":"用電與機具","n":"烙鐵架","q":1},{"c":"用電與機具","n":"烙鐵刷子","q":1},{"c":"用電與機具","n":"烙鐵頭","q":1},{"c":"用電與機具","n":"客製模具","q":1},{"c":"用電與機具","n":"電風扇","q":1},{"c":"用電與機具","n":"延長線","q":1,"p":300},{"c":"用電與機具","n":"多頭延長線","q":1},{"c":"用電與機具","n":"轉接頭","q":1},{"c":"用電與機具","n":"變壓器","q":1},{"c":"用電與機具","n":"測電壓器","q":1},{"c":"製作與維修器具","n":"器具桶","q":1},{"c":"製作與維修器具","n":"雞蛋蛋糕專屬叉子","q":1},{"c":"製作與維修器具","n":"毛刷","q":1},{"c":"製作與維修器具","n":"烤盤油","q":1,"p":150},{"c":"製作與維修器具","n":"平刀","q":1},{"c":"製作與維修器具","n":"測溫槍","q":1,"p":400},{"c":"製作與維修器具","n":"計時器","q":1,"p":100},{"c":"製作與維修器具","n":"六角扳手 5 號","q":1},{"c":"製作與維修器具","n":"六角扳手 2 號","q":1},{"c":"製作與維修器具","n":"十字起子","q":1,"p":30},{"c":"製作與維修器具","n":"大力膠帶","q":1},{"c":"製作與維修器具","n":"雙面膠帶","q":1},{"c":"包材","n":"空白紙袋或品牌紙袋","q":1},{"c":"包材","n":"紙盒","q":1},{"c":"包材","n":"薯條杯","q":1},{"c":"包材","n":"竹籤","q":1},{"c":"包材","n":"竹籤筒","q":1},{"c":"包材","n":"塑膠袋","q":1},{"c":"攤位陳設","n":"置物桶","q":1},{"c":"攤位陳設","n":"保溫箱","q":1},{"c":"攤位陳設","n":"桌布","q":1},{"c":"攤位陳設","n":"布招牌","q":1},{"c":"攤位陳設","n":"品牌輸出","q":1},{"c":"攤位陳設","n":"品牌簡介","q":1},{"c":"攤位陳設","n":"擺飾用草皮","q":1},{"c":"攤位陳設","n":"擺飾用盆栽","q":1},{"c":"攤位陳設","n":"竹籃","q":1},{"c":"攤位陳設","n":"推車","q":1},{"c":"清潔與衛生","n":"酒精","q":1},{"c":"清潔與衛生","n":"口罩","q":1},{"c":"清潔與衛生","n":"衛生手套","q":1},{"c":"清潔與衛生","n":"濕紙巾","q":1},{"c":"清潔與衛生","n":"抹布","q":1,"p":15},{"c":"人員服裝","n":"帽子","q":1},{"c":"人員服裝","n":"品牌制服","q":1},{"c":"人員服裝","n":"圍裙","q":1}]},{"name":"百貨快閃","type":"快閃","info":["活動名稱","活動日期","活動地點","活動時間","進場日期與時間","雞蛋糕數量","雞蛋糕份數","每份數量","包材類別","發放方式","電力準備","桌子準備","其他事項","品牌客戶抬頭","客戶統編","客戶聯絡人","客戶電話"],"items":[{"c":"食材與麵糊準備","n":"保冰桶","q":1},{"c":"食材與麵糊準備","n":"冰磚","q":1},{"c":"食材與麵糊準備","n":"保冷袋","q":1},{"c":"食材與麵糊準備","n":"麵糊","q":1},{"c":"食材與麵糊準備","n":"低筋麵粉","q":1},{"c":"食材與麵糊準備","n":"二砂糖","q":1},{"c":"食材與麵糊準備","n":"攪拌器","q":1},{"c":"食材與麵糊準備","n":"攪拌器盒子","q":1},{"c":"食材與麵糊準備","n":"冷水壺","q":1},{"c":"食材與麵糊準備","n":"麵糊器","q":1},{"c":"食材與麵糊準備","n":"鐵盤","q":1},{"c":"食材與麵糊準備","n":"夾子","q":1,"p":50},{"c":"用電與機具","n":"機器","q":1},{"c":"用電與機具","n":"烙鐵棒","q":1},{"c":"用電與機具","n":"烙鐵架","q":1},{"c":"用電與機具","n":"烙鐵刷子","q":1},{"c":"用電與機具","n":"烙鐵頭","q":1},{"c":"用電與機具","n":"客製模具","q":1},{"c":"用電與機具","n":"電風扇","q":1},{"c":"用電與機具","n":"延長線","q":1,"p":300},{"c":"用電與機具","n":"多頭延長線","q":1},{"c":"用電與機具","n":"轉接頭","q":1},{"c":"用電與機具","n":"變壓器","q":1},{"c":"用電與機具","n":"測電壓器","q":1},{"c":"製作與維修器具","n":"器具桶","q":1},{"c":"製作與維修器具","n":"雞蛋蛋糕專屬叉子","q":1},{"c":"製作與維修器具","n":"毛刷","q":1},{"c":"製作與維修器具","n":"烤盤油","q":1,"p":150},{"c":"製作與維修器具","n":"平刀","q":1},{"c":"製作與維修器具","n":"測溫槍","q":1,"p":400},{"c":"製作與維修器具","n":"計時器","q":1,"p":100},{"c":"製作與維修器具","n":"六角扳手 5 號","q":1},{"c":"製作與維修器具","n":"六角扳手 2 號","q":1},{"c":"製作與維修器具","n":"十字起子","q":1,"p":30},{"c":"製作與維修器具","n":"大力膠帶","q":1},{"c":"製作與維修器具","n":"雙面膠帶","q":1},{"c":"包材","n":"空白紙袋或品牌紙袋","q":1},{"c":"包材","n":"紙盒","q":1},{"c":"包材","n":"薯條杯","q":1},{"c":"包材","n":"竹籤","q":1},{"c":"包材","n":"竹籤筒","q":1},{"c":"包材","n":"塑膠袋","q":1},{"c":"攤位陳設","n":"置物桶","q":1},{"c":"攤位陳設","n":"保溫箱","q":1},{"c":"攤位陳設","n":"桌布","q":1},{"c":"攤位陳設","n":"布招牌","q":1},{"c":"攤位陳設","n":"品牌輸出","q":1},{"c":"攤位陳設","n":"品牌簡介","q":1},{"c":"攤位陳設","n":"擺飾用草皮","q":1},{"c":"攤位陳設","n":"擺飾用盆栽","q":1},{"c":"攤位陳設","n":"竹籃","q":1},{"c":"攤位陳設","n":"推車","q":1},{"c":"清潔與衛生","n":"酒精","q":1},{"c":"清潔與衛生","n":"口罩","q":1},{"c":"清潔與衛生","n":"衛生手套","q":1},{"c":"清潔與衛生","n":"濕紙巾","q":1},{"c":"清潔與衛生","n":"抹布","q":1,"p":15},{"c":"人員服裝","n":"帽子","q":1},{"c":"人員服裝","n":"品牌制服","q":1},{"c":"人員服裝","n":"圍裙","q":1}]},{"name":"設櫃","type":"設櫃","info":["櫃位名稱","進櫃日期","撤櫃日期","進場時間","百貨聯絡人","聯絡電話","電力","櫃位尺寸","其他事項"],"items":[{"c":"設櫃專屬","n":"上掀式冰箱","q":1,"u":"台"},{"c":"設櫃專屬","n":"工作桌","q":1,"u":"張"},{"c":"設櫃專屬","n":"零用金","d":"開櫃找零","q":1,"u":"份"},{"c":"設櫃專屬","n":"價目表","q":1,"u":"份"},{"c":"設櫃專屬","n":"輸出","d":"品牌輸出／海報","q":1,"u":"份"},{"c":"設櫃專屬","n":"裝潢木板","q":1,"u":"組"},{"c":"設櫃專屬","n":"收銀機","q":1,"u":"台"},{"c":"設櫃專屬","n":"櫃位衛生證照","d":"影本，放櫃上","q":1,"u":"份"},{"c":"設櫃專屬","n":"保險資料","d":"產品責任險／公共意外險","q":1,"u":"份"},{"c":"設櫃專屬","n":"每日手寫報表","q":1,"u":"本"},{"c":"食材與麵糊準備","n":"保冰桶","q":1},{"c":"食材與麵糊準備","n":"冰磚","q":1},{"c":"食材與麵糊準備","n":"保冷袋","q":1},{"c":"食材與麵糊準備","n":"麵糊","q":1},{"c":"食材與麵糊準備","n":"低筋麵粉","q":1},{"c":"食材與麵糊準備","n":"二砂糖","q":1},{"c":"食材與麵糊準備","n":"攪拌器","q":1},{"c":"食材與麵糊準備","n":"攪拌器盒子","q":1},{"c":"食材與麵糊準備","n":"冷水壺","q":1},{"c":"食材與麵糊準備","n":"麵糊器","q":1},{"c":"食材與麵糊準備","n":"鐵盤","q":1},{"c":"用電與機具","n":"機器","q":1},{"c":"用電與機具","n":"烙鐵棒","q":1},{"c":"用電與機具","n":"烙鐵架","q":1},{"c":"用電與機具","n":"烙鐵刷子","q":1},{"c":"用電與機具","n":"烙鐵頭","q":1},{"c":"用電與機具","n":"客製模具","q":1},{"c":"用電與機具","n":"電風扇","q":1},{"c":"用電與機具","n":"多頭延長線","q":1},{"c":"用電與機具","n":"轉接頭","q":1},{"c":"用電與機具","n":"變壓器","q":1},{"c":"用電與機具","n":"測電壓器","q":1},{"c":"製作與維修器具","n":"器具桶","q":1},{"c":"製作與維修器具","n":"雞蛋蛋糕專屬叉子","q":1},{"c":"製作與維修器具","n":"毛刷","q":1},{"c":"製作與維修器具","n":"平刀","q":1},{"c":"製作與維修器具","n":"六角扳手 5 號","q":1},{"c":"製作與維修器具","n":"六角扳手 2 號","q":1},{"c":"製作與維修器具","n":"大力膠帶","q":1},{"c":"製作與維修器具","n":"雙面膠帶","q":1},{"c":"包材","n":"空白紙袋或品牌紙袋","q":1},{"c":"包材","n":"紙盒","q":1},{"c":"包材","n":"薯條杯","q":1},{"c":"包材","n":"竹籤","q":1},{"c":"包材","n":"竹籤筒","q":1},{"c":"包材","n":"塑膠袋","q":1},{"c":"攤位陳設","n":"置物桶","q":1},{"c":"攤位陳設","n":"保溫箱","q":1},{"c":"攤位陳設","n":"桌布","q":1},{"c":"攤位陳設","n":"布招牌","q":1},{"c":"攤位陳設","n":"品牌輸出","q":1},{"c":"攤位陳設","n":"品牌簡介","q":1},{"c":"攤位陳設","n":"擺飾用草皮","q":1},{"c":"攤位陳設","n":"擺飾用盆栽","q":1},{"c":"攤位陳設","n":"竹籃","q":1},{"c":"攤位陳設","n":"推車","q":1},{"c":"清潔與衛生","n":"酒精","q":1},{"c":"清潔與衛生","n":"衛生手套","q":1},{"c":"人員服裝","n":"帽子","q":1},{"c":"人員服裝","n":"品牌制服","q":1},{"c":"人員服裝","n":"圍裙","q":1},{"c":"生財工具盒","n":"工具盒","d":"22.8*16*6","q":1,"u":"個","p":150},{"c":"生財工具盒","n":"挑棒","d":"KAI 貝印 18*2.2*2.2cm","q":2,"u":"支","p":99,"m":"230度"},{"c":"生財工具盒","n":"夾子","d":"8寸","q":1,"u":"支","p":50,"m":"不鏽鋼"},{"c":"生財工具盒","n":"刷子","d":"20*3.5*3cm","q":1,"u":"支","p":50,"m":"210度"},{"c":"生財工具盒","n":"油刷","d":"2.3*17cm","q":1,"u":"支","p":10},{"c":"生財工具盒","n":"白鐵漆刀","d":"宏牌 19*6cm","q":1,"u":"支","p":35},{"c":"生財工具盒","n":"測溫槍","d":"標智 GM320","q":1,"u":"支","p":400},{"c":"生財工具盒","n":"六角3/5號","d":"3mm、5mm","q":1,"u":"組","p":50},{"c":"生財工具盒","n":"十字起子","d":"16cm","q":1,"u":"支","p":30},{"c":"生財工具盒","n":"計時器","d":"聖岡 CT-68","q":2,"u":"個","p":100},{"c":"生財工具盒","n":"鹼性電池","d":"4號","q":2,"u":"個","p":10},{"c":"生財工具盒","n":"水銀電池","d":"LR44","q":2,"u":"個","p":10},{"c":"生財工具盒","n":"原子筆","d":"藍","q":1,"u":"支","p":15},{"c":"生財工具盒","n":"白板筆","d":"百樂 WMBM-12L","q":1,"u":"支","p":36},{"c":"生財工具盒","n":"補充液","d":"百樂 WMBM-12L","q":1,"u":"支","p":23},{"c":"生財工具盒","n":"轉接頭T","d":"萬國 WD-21(2500W)","q":1,"u":"個","p":290},{"c":"生財工具盒","n":"轉接頭H","d":"萬寶 WA-6(1500W)","q":1,"u":"個","p":100},{"c":"生財工具盒","n":"定量器彈簧","d":"線徑1.2mm","q":2,"u":"個","p":50},{"c":"生財工具箱","n":"工具箱","d":"KEYWAY聯府 58*42*34cm","q":1,"u":"組","p":500},{"c":"生財工具箱","n":"紙袋盒","d":"IKEA 33.5*24*14.5cm","q":1,"u":"個","p":110},{"c":"生財工具箱","n":"紙袋","q":6,"u":"捆","p":0},{"c":"生財工具箱","n":"打洞器","d":"SDI手牌 BN07102","q":1,"u":"個","p":300},{"c":"生財工具箱","n":"塑膠提袋","q":1,"u":"包","p":0},{"c":"生財工具箱","n":"布膠","d":"12mm","q":1,"u":"捲","p":110},{"c":"生財工具箱","n":"烤盤油","d":"卡羅 650ml","q":1,"u":"罐","p":150},{"c":"生財工具箱","n":"冷卻盤+網","d":"32*22*4.8","q":1,"u":"個","p":250},{"c":"生財工具箱","n":"風扇","d":"四寸單顆","q":1,"u":"個","p":400},{"c":"生財工具箱","n":"小掃把","d":"IKEA 16.5*20.5*4cm","q":1,"u":"組","p":60},{"c":"生財工具箱","n":"濕紙巾","q":1,"u":"包","p":0},{"c":"生財工具箱","n":"衛生紙","q":1,"u":"包","p":0},{"c":"生財工具箱","n":"餐巾紙","q":1,"u":"捲","p":0},{"c":"生財工具箱","n":"營收報表","q":1,"u":"張","p":0},{"c":"生財工具箱","n":"零用金盒","d":"17*14*3.1cm","q":1,"u":"個","p":100},{"c":"生財工具箱","n":"延長線","d":"心安規 6尺","q":1,"u":"條","p":300},{"c":"生財工具箱","n":"圍裙帽子","q":1,"u":"組","p":0},{"c":"生財工具箱","n":"口罩","q":5,"u":"個","p":0},{"c":"生財工具箱","n":"菜單/口味牌","q":1,"u":"組","p":0},{"c":"生財清潔組","n":"垃圾桶","d":"IKEA 10公升","q":1,"u":"個","p":50},{"c":"生財清潔組","n":"水桶","d":"2公升","q":1,"u":"個","p":40},{"c":"生財清潔組","n":"抹布","d":"30*30cm","q":1,"u":"條","p":15},{"c":"生財清潔組","n":"海綿菜瓜布","d":"10*7*2cm","q":1,"u":"個","p":15},{"c":"生財清潔組","n":"洗碗精","d":"白熊 300g","q":1,"u":"瓶","p":50}]},{"name":"出國-新加坡","type":"出國","country":"新加坡","volt":"220V","items":[{"c":"證件與零用金","n":"護照","d":"護照","q":1,"u":"本","k":"人"},{"c":"證件與零用金","n":"簽證","d":"簽證","q":1,"u":"張","k":"人"},{"c":"證件與零用金","n":"SIM卡","d":"當地漫遊","q":1,"u":"張","k":"人"},{"c":"證件與零用金","n":"零用金","d":"購買食材","q":10000,"u":"元"},{"c":"食材","n":"麵粉","d":"100顆/包","q":18,"u":"包","m":"3000顆","k":"百顆","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕烤爐","n":"烤爐1","d":"台灣造型","q":1,"u":"臺","m":"220v/1500W","b":"保冰桶②｜烤爐"},{"c":"雞蛋糕烤爐","n":"延長線","d":"短","q":1,"u":"條","m":"機器x2、烙鐵、電風扇、攪拌機","b":"保冰桶②｜烤爐","p":300},{"c":"雞蛋糕烤爐","n":"轉接頭","d":"機器","q":2,"u":"個","m":"當地插座/展場2、飯店1","b":"保冰桶②｜烤爐"},{"c":"雞蛋糕製作器具","n":"測溫槍","d":"測量烤爐溫度","q":1,"u":"支","m":"電池x2","b":"保冰桶①｜製作器具","p":400},{"c":"雞蛋糕製作器具","n":"隔熱手套","d":"操作機器","q":1,"u":"雙","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"挑棒","d":"挑雞蛋糕工具","q":1,"u":"支","b":"保冰桶①｜製作器具","p":99},{"c":"雞蛋糕製作器具","n":"計時器","d":"製作計時","q":1,"u":"個","m":"電池x1","b":"保冰桶①｜製作器具","p":100},{"c":"雞蛋糕製作器具","n":"電風扇","d":"雞蛋糕降溫","q":1,"u":"個","m":"50W","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"不鏽鋼盤子","d":"承裝雞蛋糕","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"不鏽鋼架子","d":"承裝雞蛋糕","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"夾子","d":"雞蛋糕包裝","q":1,"u":"支","b":"保冰桶①｜製作器具","p":50},{"c":"雞蛋糕製作器具","n":"烙鐵銅頭","d":"活動LOGO銅頭","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"烙鐵加熱棒","d":"銅頭烙印加熱器具","q":1,"u":"支","m":"150W","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"烙鐵棒架子","d":"烙鐵棒架","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"烙鐵棒刷子","d":"烙鐵頭清潔","q":1,"u":"支","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"冷水壺","d":"麵糊容器","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"定量器","d":"麵糊定量","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"定量器蓋子","d":"麵糊定量器蓋子","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"麵糊製作器具","n":"電子秤","d":"原物料秤重","q":1,"u":"個","m":"電池x2","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"攪拌鍋","d":"麵糊容器","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"量杯","d":"500cc植物油","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"量杯","d":"1000cc雞蛋、牛奶","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"塑膠碗","d":"裝糖容器","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"攪拌機","d":"麵糊攪拌","q":1,"u":"支","m":"用電","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"過濾網","d":"過濾麵糊","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"刮刀","d":"麵糊攪拌","q":1,"u":"支","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"封口夾","d":"糖封口","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"五斤袋","d":"麵糊容器","q":1,"u":"包","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"工具盒","d":"打麵糊工具盒","q":1,"u":"個","b":"登機箱｜麵糊製作器具","p":150},{"c":"清潔相關用具","n":"刷子","d":"烤爐清潔","q":2,"u":"支","b":"保冰桶①｜製作器具","p":50},{"c":"清潔相關用具","n":"刮刀","d":"麵糊清潔","q":1,"u":"支","b":"保冰桶①｜製作器具"},{"c":"清潔相關用具","n":"小掃把","d":"桌面清潔","q":1,"u":"組","b":"保冰桶①｜製作器具","p":60},{"c":"清潔相關用具","n":"手套","d":"衛生手套","q":1,"u":"盒","b":"保冰桶①｜製作器具"},{"c":"清潔相關用具","n":"菜瓜布","d":"洗器具","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"清潔相關用具","n":"濕紙巾","d":"整理清潔","q":2,"u":"包","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕包材","n":"牛皮紙袋","d":"雞蛋糕包材(100pcs)","q":3,"u":"疊","m":"推廣會用/貴賓用","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕包材","n":"5寸竹籤","d":"雞蛋糕包材","q":2,"u":"包","m":"展場活動","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕包材","n":"竹籤桶","d":"竹籤容器","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"六角組","d":"烤爐機器維修","q":1,"u":"組","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"十字起子","d":"烙鐵機器使用","q":1,"u":"支","b":"保冰桶①｜製作器具","p":30},{"c":"其他工具及備品","n":"電線","d":"烤爐機器維修備品","q":1,"u":"條","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"4號電池","d":"測溫槍2、計時器1、電子秤2","q":5,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"電工膠帶","d":"烤爐機器維修備品","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"雙面膠帶","d":"固定器具用","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"強力膠帶","d":"固定器具用","q":2,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"定量器塞頭","d":"麵糊定量器備品","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"定量器彈簧","d":"麵糊定量器備品","q":1,"u":"個","b":"保冰桶①｜製作器具","p":50},{"c":"其他工具及備品","n":"工具桶","d":"裝雞蛋糕工具","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"制服與裝飾物","n":"制服","d":"工作人員","q":2,"u":"件","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"圍裙","d":"工作人員","q":2,"u":"件","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"竹籃","d":"擺設","q":1,"u":"個","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"桌布","d":"桌布、隔熱","q":3,"u":"條","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"隔熱布","d":"隔熱、蓋機器","q":2,"u":"條","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"布招牌","d":"裝飾佈置","q":2,"u":"條","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"品牌介紹","d":"裝飾佈置","q":1,"u":"個","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"裝飾物","d":"裝飾佈置","q":2,"u":"個","b":"背包①｜衣服"},{"c":"行李","n":"保冰桶","d":"裝雞蛋糕製作器具、裝麵粉","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"保冰桶","d":"裝烤爐","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"登機箱","d":"裝麵糊製作器具","q":1,"u":"個"},{"c":"行李","n":"背包","d":"裝衣服","q":1,"u":"個"},{"c":"行李","n":"背包","d":"裝電腦","q":1,"u":"個"}],"buy":[{"n":"雞蛋","a":15,"u":"顆"},{"n":"牛奶","a":750,"u":"ml"},{"n":"油","a":75,"u":"g"},{"n":"糖","a":550,"u":"g"}],"boxes":["保冰桶①｜製作器具","保冰桶②｜烤爐","登機箱｜麵糊製作器具","背包①｜衣服","背包②｜電腦"],"info":["國家／城市","展場名稱","展場地址","飯店","去程航班","回程航班","當地聯絡人","當地電話","其他事項"]},{"name":"出國-馬來西亞","type":"出國","country":"馬來西亞","volt":"220V","items":[{"c":"證件與零用金","n":"護照","d":"護照","q":2,"u":"本","k":"人"},{"c":"證件與零用金","n":"簽證","d":"簽證","q":2,"u":"張","k":"人"},{"c":"證件與零用金","n":"SIM卡","d":"當地漫遊","q":2,"u":"張","k":"人"},{"c":"證件與零用金","n":"零用金","d":"購買食材","q":10000,"u":"元"},{"c":"食材","n":"麵粉","d":"100顆/包","q":18,"u":"包","m":"3000顆","k":"百顆","b":"塑膠箱②｜麵粉"},{"c":"雞蛋糕烤爐","n":"烤爐1","d":"台灣造型","q":1,"u":"臺","m":"220v/1500W","b":"保冰桶②｜烤爐"},{"c":"雞蛋糕烤爐","n":"烤爐2","d":"愛心烙印","q":1,"u":"臺","m":"220v/1500W","b":"保冰桶②｜烤爐"},{"c":"雞蛋糕烤爐","n":"延長線","d":"短","q":3,"u":"條","m":"機器x2、烙鐵、電風扇、攪拌機","b":"保冰桶②｜烤爐","p":300},{"c":"雞蛋糕烤爐","n":"轉接頭","d":"機器","q":3,"u":"個","m":"當地插座/展場2、飯店1","b":"保冰桶②｜烤爐"},{"c":"雞蛋糕製作器具","n":"測溫槍","d":"測量烤爐溫度","q":1,"u":"支","m":"電池x2","b":"保冰桶①｜製作器具","p":400},{"c":"雞蛋糕製作器具","n":"隔熱手套","d":"操作機器","q":1,"u":"雙","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"挑棒","d":"挑雞蛋糕工具","q":1,"u":"支","b":"保冰桶①｜製作器具","p":99},{"c":"雞蛋糕製作器具","n":"計時器","d":"製作計時","q":1,"u":"個","m":"電池x1","b":"保冰桶①｜製作器具","p":100},{"c":"雞蛋糕製作器具","n":"電風扇","d":"雞蛋糕降溫","q":1,"u":"個","m":"50W","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"不鏽鋼盤子","d":"承裝雞蛋糕","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"不鏽鋼架子","d":"承裝雞蛋糕","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"夾子","d":"雞蛋糕包裝","q":1,"u":"支","b":"保冰桶①｜製作器具","p":50},{"c":"雞蛋糕製作器具","n":"烙鐵銅頭","d":"活動LOGO銅頭","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"烙鐵加熱棒","d":"銅頭烙印加熱器具","q":1,"u":"支","m":"150W","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"烙鐵棒架子","d":"烙鐵棒架","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"烙鐵棒刷子","d":"烙鐵頭清潔","q":1,"u":"支","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"冷水壺","d":"麵糊容器","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"定量器","d":"麵糊定量","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"定量器蓋子","d":"麵糊定量器蓋子","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"麵糊製作器具","n":"電子秤","d":"原物料秤重","q":1,"u":"個","m":"電池x2","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"攪拌鍋","d":"麵糊容器","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"量杯","d":"500cc植物油","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"量杯","d":"1000cc雞蛋、牛奶","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"塑膠碗","d":"裝糖容器","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"攪拌機","d":"麵糊攪拌","q":1,"u":"支","m":"用電","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"過濾網","d":"過濾麵糊","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"刮刀","d":"麵糊攪拌","q":1,"u":"支","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"封口夾","d":"糖封口","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"五斤袋","d":"麵糊容器","q":1,"u":"包","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"工具盒","d":"打麵糊工具盒","q":1,"u":"個","b":"登機箱｜麵糊製作器具","p":150},{"c":"清潔相關用具","n":"刷子","d":"烤爐清潔","q":2,"u":"支","b":"保冰桶①｜製作器具","p":50},{"c":"清潔相關用具","n":"刮刀","d":"麵糊清潔","q":1,"u":"支","b":"保冰桶①｜製作器具"},{"c":"清潔相關用具","n":"小掃把","d":"桌面清潔","q":1,"u":"組","b":"保冰桶①｜製作器具","p":60},{"c":"清潔相關用具","n":"手套","d":"衛生手套","q":1,"u":"盒","b":"保冰桶①｜製作器具"},{"c":"清潔相關用具","n":"菜瓜布","d":"洗器具","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"清潔相關用具","n":"濕紙巾","d":"整理清潔","q":2,"u":"包","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕包材","n":"牛皮紙袋","d":"雞蛋糕包材(100pcs)","q":3,"u":"疊","m":"推廣會用/貴賓用","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕包材","n":"5寸竹籤","d":"雞蛋糕包材","q":2,"u":"包","m":"展場活動","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕包材","n":"竹籤桶","d":"竹籤容器","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"六角組","d":"烤爐機器維修","q":1,"u":"組","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"十字起子","d":"烙鐵機器使用","q":1,"u":"支","b":"保冰桶①｜製作器具","p":30},{"c":"其他工具及備品","n":"電線","d":"烤爐機器維修備品","q":1,"u":"條","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"4號電池","d":"測溫槍2、計時器1、電子秤2","q":5,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"電工膠帶","d":"烤爐機器維修備品","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"雙面膠帶","d":"固定器具用","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"強力膠帶","d":"固定器具用","q":2,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"定量器塞頭","d":"麵糊定量器備品","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"定量器彈簧","d":"麵糊定量器備品","q":1,"u":"個","b":"保冰桶①｜製作器具","p":50},{"c":"其他工具及備品","n":"工具桶","d":"裝雞蛋糕工具","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"制服與裝飾物","n":"制服","d":"工作人員","q":2,"u":"件","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"圍裙","d":"工作人員","q":2,"u":"件","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"竹籃","d":"擺設","q":1,"u":"個","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"桌布","d":"桌布、隔熱","q":3,"u":"條","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"隔熱布","d":"隔熱、蓋機器","q":2,"u":"條","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"布招牌","d":"裝飾佈置","q":2,"u":"條","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"品牌介紹","d":"裝飾佈置","q":1,"u":"個","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"裝飾物","d":"裝飾佈置","q":2,"u":"個","b":"背包①｜衣服"},{"c":"行李","n":"保冰桶","d":"裝雞蛋糕製作器具","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"保冰桶","d":"裝烤爐","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"塑膠箱","d":"裝烤爐","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"塑膠箱","d":"裝麵粉","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"登機箱","d":"裝麵糊製作器具","q":1,"u":"個"},{"c":"行李","n":"背包","d":"裝衣服","q":1,"u":"個"},{"c":"行李","n":"背包","d":"裝電腦","q":1,"u":"個"}],"buy":[{"n":"雞蛋","a":15,"u":"顆"},{"n":"牛奶","a":750,"u":"ml"},{"n":"油","a":75,"u":"g"},{"n":"糖","a":550,"u":"g"}],"boxes":["保冰桶①｜製作器具","保冰桶②｜烤爐","塑膠箱①｜烤爐","塑膠箱②｜麵粉","登機箱｜麵糊製作器具","背包①｜衣服","背包②｜電腦"],"info":["國家／城市","展場名稱","展場地址","飯店","去程航班","回程航班","當地聯絡人","當地電話","其他事項"]},{"name":"出國-越南","type":"出國","country":"越南","volt":"220V","items":[{"c":"證件與零用金","n":"護照","d":"護照","q":2,"u":"本","k":"人"},{"c":"證件與零用金","n":"簽證","d":"簽證","q":2,"u":"張","k":"人"},{"c":"證件與零用金","n":"SIM卡","d":"當地漫遊","q":2,"u":"張","k":"人"},{"c":"證件與零用金","n":"零用金","d":"購買食材","q":10000,"u":"元"},{"c":"食材","n":"麵粉","d":"100顆/包","q":18,"u":"包","m":"3000顆","k":"百顆","b":"塑膠箱②｜麵粉"},{"c":"雞蛋糕烤爐","n":"烤爐1","d":"台灣造型","q":1,"u":"臺","m":"220v/1500W","b":"保冰桶②｜烤爐"},{"c":"雞蛋糕烤爐","n":"烤爐2","d":"愛心烙印","q":1,"u":"臺","m":"220v/1500W","b":"保冰桶②｜烤爐"},{"c":"雞蛋糕烤爐","n":"延長線","d":"短","q":3,"u":"條","m":"機器x2、烙鐵、電風扇、攪拌機","b":"保冰桶②｜烤爐","p":300},{"c":"雞蛋糕烤爐","n":"轉接頭","d":"機器","q":3,"u":"個","m":"當地插座/展場2、飯店1","b":"保冰桶②｜烤爐"},{"c":"雞蛋糕製作器具","n":"測溫槍","d":"測量烤爐溫度","q":1,"u":"支","m":"電池x2","b":"保冰桶①｜製作器具","p":400},{"c":"雞蛋糕製作器具","n":"隔熱手套","d":"操作機器","q":1,"u":"雙","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"挑棒","d":"挑雞蛋糕工具","q":1,"u":"支","b":"保冰桶①｜製作器具","p":99},{"c":"雞蛋糕製作器具","n":"計時器","d":"製作計時","q":1,"u":"個","m":"電池x1","b":"保冰桶①｜製作器具","p":100},{"c":"雞蛋糕製作器具","n":"電風扇","d":"雞蛋糕降溫","q":1,"u":"個","m":"50W","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"不鏽鋼盤子","d":"承裝雞蛋糕","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"不鏽鋼架子","d":"承裝雞蛋糕","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"夾子","d":"雞蛋糕包裝","q":1,"u":"支","b":"保冰桶①｜製作器具","p":50},{"c":"雞蛋糕製作器具","n":"烙鐵銅頭","d":"活動LOGO銅頭","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"烙鐵加熱棒","d":"銅頭烙印加熱器具","q":1,"u":"支","m":"150W","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"烙鐵棒架子","d":"烙鐵棒架","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"烙鐵棒刷子","d":"烙鐵頭清潔","q":1,"u":"支","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"冷水壺","d":"麵糊容器","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"定量器","d":"麵糊定量","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"定量器蓋子","d":"麵糊定量器蓋子","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"麵糊製作器具","n":"電子秤","d":"原物料秤重","q":1,"u":"個","m":"電池x2","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"攪拌鍋","d":"麵糊容器","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"量杯","d":"500cc植物油","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"量杯","d":"1000cc雞蛋、牛奶","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"塑膠碗","d":"裝糖容器","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"攪拌機","d":"麵糊攪拌","q":1,"u":"支","m":"用電","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"過濾網","d":"過濾麵糊","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"刮刀","d":"麵糊攪拌","q":1,"u":"支","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"封口夾","d":"糖封口","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"五斤袋","d":"麵糊容器","q":1,"u":"包","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"工具盒","d":"打麵糊工具盒","q":1,"u":"個","b":"登機箱｜麵糊製作器具","p":150},{"c":"清潔相關用具","n":"刷子","d":"烤爐清潔","q":2,"u":"支","b":"保冰桶①｜製作器具","p":50},{"c":"清潔相關用具","n":"刮刀","d":"麵糊清潔","q":1,"u":"支","b":"保冰桶①｜製作器具"},{"c":"清潔相關用具","n":"小掃把","d":"桌面清潔","q":1,"u":"組","b":"保冰桶①｜製作器具","p":60},{"c":"清潔相關用具","n":"手套","d":"衛生手套","q":1,"u":"盒","b":"保冰桶①｜製作器具"},{"c":"清潔相關用具","n":"菜瓜布","d":"洗器具","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"清潔相關用具","n":"濕紙巾","d":"整理清潔","q":2,"u":"包","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕包材","n":"牛皮紙袋","d":"雞蛋糕包材(100pcs)","q":3,"u":"疊","m":"推廣會用/貴賓用","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕包材","n":"5寸竹籤","d":"雞蛋糕包材","q":2,"u":"包","m":"展場活動","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕包材","n":"竹籤桶","d":"竹籤容器","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"六角組","d":"烤爐機器維修","q":1,"u":"組","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"十字起子","d":"烙鐵機器使用","q":1,"u":"支","b":"保冰桶①｜製作器具","p":30},{"c":"其他工具及備品","n":"電線","d":"烤爐機器維修備品","q":1,"u":"條","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"4號電池","d":"測溫槍2、計時器1、電子秤2","q":5,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"電工膠帶","d":"烤爐機器維修備品","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"雙面膠帶","d":"固定器具用","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"強力膠帶","d":"固定器具用","q":2,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"定量器塞頭","d":"麵糊定量器備品","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"定量器彈簧","d":"麵糊定量器備品","q":1,"u":"個","b":"保冰桶①｜製作器具","p":50},{"c":"其他工具及備品","n":"工具桶","d":"裝雞蛋糕工具","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"制服與裝飾物","n":"制服","d":"工作人員","q":2,"u":"件","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"圍裙","d":"工作人員","q":2,"u":"件","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"竹籃","d":"擺設","q":1,"u":"個","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"桌布","d":"桌布、隔熱","q":3,"u":"條","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"隔熱布","d":"隔熱、蓋機器","q":2,"u":"條","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"布招牌","d":"裝飾佈置","q":2,"u":"條","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"品牌介紹","d":"裝飾佈置","q":1,"u":"個","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"裝飾物","d":"裝飾佈置","q":2,"u":"個","b":"背包①｜衣服"},{"c":"行李","n":"保冰桶","d":"裝雞蛋糕製作器具","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"保冰桶","d":"裝烤爐","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"塑膠箱","d":"裝烤爐","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"塑膠箱","d":"裝麵粉","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"登機箱","d":"裝麵糊製作器具","q":1,"u":"個"},{"c":"行李","n":"背包","d":"裝衣服","q":1,"u":"個"},{"c":"行李","n":"背包","d":"裝電腦","q":1,"u":"個"}],"buy":[{"n":"雞蛋","a":15,"u":"顆"},{"n":"牛奶","a":750,"u":"ml"},{"n":"油","a":75,"u":"g"},{"n":"糖","a":550,"u":"g"}],"boxes":["保冰桶①｜製作器具","保冰桶②｜烤爐","塑膠箱①｜烤爐","塑膠箱②｜麵粉","登機箱｜麵糊製作器具","背包①｜衣服","背包②｜電腦"],"info":["國家／城市","展場名稱","展場地址","飯店","去程航班","回程航班","當地聯絡人","當地電話","其他事項"]},{"name":"出國-印尼","type":"出國","country":"印尼","volt":"220V","items":[{"c":"證件與零用金","n":"護照","d":"護照","q":2,"u":"本","k":"人"},{"c":"證件與零用金","n":"簽證","d":"簽證","q":2,"u":"張","k":"人"},{"c":"證件與零用金","n":"SIM卡","d":"當地漫遊","q":2,"u":"張","k":"人"},{"c":"證件與零用金","n":"零用金","d":"購買食材","q":10000,"u":"元"},{"c":"食材","n":"麵粉","d":"100顆/包","q":18,"u":"包","m":"3000顆","k":"百顆","b":"塑膠箱②｜麵粉"},{"c":"雞蛋糕烤爐","n":"烤爐1","d":"台灣造型","q":1,"u":"臺","m":"220v/1500W","b":"保冰桶②｜烤爐"},{"c":"雞蛋糕烤爐","n":"烤爐2","d":"愛心烙印","q":1,"u":"臺","m":"220v/1500W","b":"保冰桶②｜烤爐"},{"c":"雞蛋糕烤爐","n":"延長線","d":"短","q":3,"u":"條","m":"機器x2、烙鐵、電風扇、攪拌機","b":"保冰桶②｜烤爐","p":300},{"c":"雞蛋糕烤爐","n":"轉接頭","d":"機器","q":3,"u":"個","m":"當地插座/展場2、飯店1","b":"保冰桶②｜烤爐"},{"c":"雞蛋糕製作器具","n":"測溫槍","d":"測量烤爐溫度","q":1,"u":"支","m":"電池x2","b":"保冰桶①｜製作器具","p":400},{"c":"雞蛋糕製作器具","n":"隔熱手套","d":"操作機器","q":1,"u":"雙","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"挑棒","d":"挑雞蛋糕工具","q":1,"u":"支","b":"保冰桶①｜製作器具","p":99},{"c":"雞蛋糕製作器具","n":"計時器","d":"製作計時","q":1,"u":"個","m":"電池x1","b":"保冰桶①｜製作器具","p":100},{"c":"雞蛋糕製作器具","n":"電風扇","d":"雞蛋糕降溫","q":1,"u":"個","m":"50W","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"不鏽鋼盤子","d":"承裝雞蛋糕","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"不鏽鋼架子","d":"承裝雞蛋糕","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"夾子","d":"雞蛋糕包裝","q":1,"u":"支","b":"保冰桶①｜製作器具","p":50},{"c":"雞蛋糕製作器具","n":"烙鐵銅頭","d":"活動LOGO銅頭","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"烙鐵加熱棒","d":"銅頭烙印加熱器具","q":1,"u":"支","m":"150W","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"烙鐵棒架子","d":"烙鐵棒架","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"烙鐵棒刷子","d":"烙鐵頭清潔","q":1,"u":"支","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"冷水壺","d":"麵糊容器","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"定量器","d":"麵糊定量","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"定量器蓋子","d":"麵糊定量器蓋子","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"麵糊製作器具","n":"電子秤","d":"原物料秤重","q":1,"u":"個","m":"電池x2","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"攪拌鍋","d":"麵糊容器","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"量杯","d":"500cc植物油","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"量杯","d":"1000cc雞蛋、牛奶","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"塑膠碗","d":"裝糖容器","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"攪拌機","d":"麵糊攪拌","q":1,"u":"支","m":"用電","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"過濾網","d":"過濾麵糊","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"刮刀","d":"麵糊攪拌","q":1,"u":"支","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"封口夾","d":"糖封口","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"五斤袋","d":"麵糊容器","q":1,"u":"包","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"工具盒","d":"打麵糊工具盒","q":1,"u":"個","b":"登機箱｜麵糊製作器具","p":150},{"c":"清潔相關用具","n":"刷子","d":"烤爐清潔","q":2,"u":"支","b":"保冰桶①｜製作器具","p":50},{"c":"清潔相關用具","n":"刮刀","d":"麵糊清潔","q":1,"u":"支","b":"保冰桶①｜製作器具"},{"c":"清潔相關用具","n":"小掃把","d":"桌面清潔","q":1,"u":"組","b":"保冰桶①｜製作器具","p":60},{"c":"清潔相關用具","n":"手套","d":"衛生手套","q":1,"u":"盒","b":"保冰桶①｜製作器具"},{"c":"清潔相關用具","n":"菜瓜布","d":"洗器具","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"清潔相關用具","n":"濕紙巾","d":"整理清潔","q":2,"u":"包","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕包材","n":"牛皮紙袋","d":"雞蛋糕包材(100pcs)","q":3,"u":"疊","m":"推廣會用/貴賓用","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕包材","n":"5寸竹籤","d":"雞蛋糕包材","q":2,"u":"包","m":"展場活動","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕包材","n":"竹籤桶","d":"竹籤容器","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"六角組","d":"烤爐機器維修","q":1,"u":"組","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"十字起子","d":"烙鐵機器使用","q":1,"u":"支","b":"保冰桶①｜製作器具","p":30},{"c":"其他工具及備品","n":"電線","d":"烤爐機器維修備品","q":1,"u":"條","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"4號電池","d":"測溫槍2、計時器1、電子秤2","q":5,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"電工膠帶","d":"烤爐機器維修備品","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"雙面膠帶","d":"固定器具用","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"強力膠帶","d":"固定器具用","q":2,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"定量器塞頭","d":"麵糊定量器備品","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"定量器彈簧","d":"麵糊定量器備品","q":1,"u":"個","b":"保冰桶①｜製作器具","p":50},{"c":"其他工具及備品","n":"工具桶","d":"裝雞蛋糕工具","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"制服與裝飾物","n":"制服","d":"工作人員","q":2,"u":"件","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"圍裙","d":"工作人員","q":2,"u":"件","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"竹籃","d":"擺設","q":1,"u":"個","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"桌布","d":"桌布、隔熱","q":3,"u":"條","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"隔熱布","d":"隔熱、蓋機器","q":2,"u":"條","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"布招牌","d":"裝飾佈置","q":2,"u":"條","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"品牌介紹","d":"裝飾佈置","q":1,"u":"個","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"裝飾物","d":"裝飾佈置","q":2,"u":"個","b":"背包①｜衣服"},{"c":"行李","n":"保冰桶","d":"裝雞蛋糕製作器具","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"保冰桶","d":"裝烤爐","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"塑膠箱","d":"裝烤爐","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"塑膠箱","d":"裝麵粉","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"登機箱","d":"裝麵糊製作器具","q":1,"u":"個"},{"c":"行李","n":"背包","d":"裝衣服","q":1,"u":"個"},{"c":"行李","n":"背包","d":"裝電腦","q":1,"u":"個"}],"buy":[{"n":"雞蛋","a":15,"u":"顆"},{"n":"牛奶","a":750,"u":"ml"},{"n":"油","a":75,"u":"g"},{"n":"糖","a":550,"u":"g"}],"boxes":["保冰桶①｜製作器具","保冰桶②｜烤爐","塑膠箱①｜烤爐","塑膠箱②｜麵粉","登機箱｜麵糊製作器具","背包①｜衣服","背包②｜電腦"],"info":["國家／城市","展場名稱","展場地址","飯店","去程航班","回程航班","當地聯絡人","當地電話","其他事項"]},{"name":"出國-日本","type":"出國","country":"日本","volt":"110V","items":[{"c":"食材","n":"麵粉","d":"100顆/包","q":27,"u":"包","m":"3000顆","k":"百顆","b":"塑膠箱②｜麵粉"},{"c":"雞蛋糕烤爐","n":"烤爐1","d":"台灣造型","q":1,"u":"臺","m":"110V/1500W","b":"保冰桶②｜烤爐"},{"c":"雞蛋糕烤爐","n":"烤爐2","d":"愛心烙印","q":1,"u":"臺","m":"110V/1500W","b":"保冰桶②｜烤爐"},{"c":"雞蛋糕烤爐","n":"延長線","d":"短","q":3,"u":"條","m":"機器x2、烙鐵、電風扇、攪拌機","b":"保冰桶②｜烤爐","p":300},{"c":"雞蛋糕烤爐","n":"轉接頭","d":"機器","q":3,"u":"個","m":"當地插座/展場2、飯店1","b":"保冰桶②｜烤爐"},{"c":"雞蛋糕製作器具","n":"測溫槍","d":"測量烤爐溫度","q":1,"u":"支","m":"電池x2","b":"保冰桶①｜製作器具","p":400},{"c":"雞蛋糕製作器具","n":"隔熱手套","d":"操作機器","q":1,"u":"雙","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"挑棒","d":"挑雞蛋糕工具","q":1,"u":"支","b":"保冰桶①｜製作器具","p":99},{"c":"雞蛋糕製作器具","n":"計時器","d":"製作計時","q":1,"u":"個","m":"電池x1","b":"保冰桶①｜製作器具","p":100},{"c":"雞蛋糕製作器具","n":"電風扇","d":"雞蛋糕降溫","q":1,"u":"個","m":"50W","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"不鏽鋼盤子","d":"承裝雞蛋糕","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"不鏽鋼架子","d":"承裝雞蛋糕","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"夾子","d":"雞蛋糕包裝","q":1,"u":"支","b":"保冰桶①｜製作器具","p":50},{"c":"雞蛋糕製作器具","n":"烙鐵銅頭","d":"活動LOGO銅頭","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"烙鐵加熱棒","d":"銅頭烙印加熱器具","q":1,"u":"支","m":"150W","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"烙鐵棒架子","d":"烙鐵棒架","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"烙鐵棒刷子","d":"烙鐵頭清潔","q":1,"u":"支","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"冷水壺","d":"麵糊容器","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"定量器","d":"麵糊定量","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"定量器蓋子","d":"麵糊定量器蓋子","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"麵糊製作器具","n":"電子秤","d":"原物料秤重","q":1,"u":"個","m":"電池x2","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"攪拌鍋","d":"麵糊容器","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"量杯","d":"500cc植物油","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"量杯","d":"1000cc雞蛋、牛奶","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"塑膠碗","d":"裝糖容器","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"攪拌機","d":"麵糊攪拌","q":1,"u":"支","m":"用電","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"過濾網","d":"過濾麵糊","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"刮刀","d":"麵糊攪拌","q":1,"u":"支","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"五斤袋","d":"麵糊容器","q":1,"u":"包","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"工具盒","d":"打麵糊工具盒","q":1,"u":"個","b":"登機箱｜麵糊製作器具","p":150},{"c":"清潔相關用具","n":"刷子","d":"烤爐清潔","q":2,"u":"支","b":"保冰桶①｜製作器具","p":50},{"c":"清潔相關用具","n":"刮刀","d":"麵糊清潔","q":1,"u":"支","b":"保冰桶①｜製作器具"},{"c":"清潔相關用具","n":"小掃把","d":"桌面清潔","q":1,"u":"組","b":"保冰桶①｜製作器具","p":60},{"c":"清潔相關用具","n":"手套","d":"衛生手套","q":1,"u":"盒","b":"保冰桶①｜製作器具"},{"c":"清潔相關用具","n":"菜瓜布","d":"洗器具","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"清潔相關用具","n":"濕紙巾","d":"整理清潔","q":2,"u":"包","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕包材","n":"牛皮紙袋","d":"雞蛋糕包材(100pcs)","q":10,"u":"疊","m":"推廣會用/貴賓用","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕包材","n":"5寸竹籤","d":"雞蛋糕包材","q":3,"u":"包","m":"展場活動","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕包材","n":"竹籤桶","d":"竹籤容器","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"六角組","d":"烤爐機器維修","q":1,"u":"組","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"十字起子","d":"烙鐵機器使用","q":1,"u":"支","b":"保冰桶①｜製作器具","p":30},{"c":"其他工具及備品","n":"電線","d":"烤爐機器維修備品","q":1,"u":"條","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"4號電池","d":"測溫槍2、計時器1、電子秤2","q":5,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"電工膠帶","d":"烤爐機器維修備品","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"雙面膠帶","d":"固定器具用","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"強力膠帶","d":"固定器具用","q":2,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"定量器塞頭","d":"麵糊定量器備品","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"定量器彈簧","d":"麵糊定量器備品","q":1,"u":"個","b":"保冰桶①｜製作器具","p":50},{"c":"其他工具及備品","n":"工具桶","d":"裝雞蛋糕工具","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"制服與裝飾物","n":"制服","d":"工作人員","q":2,"u":"件","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"圍裙","d":"工作人員","q":2,"u":"件","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"竹籃","d":"擺設","q":1,"u":"個","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"桌布","d":"桌布、隔熱","q":3,"u":"條","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"隔熱布","d":"隔熱、蓋機器","q":2,"u":"條","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"布招牌","d":"裝飾佈置","q":2,"u":"條","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"品牌介紹","d":"裝飾佈置","q":1,"u":"個","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"裝飾物","d":"裝飾佈置","q":2,"u":"個","b":"背包①｜衣服"},{"c":"行李","n":"保冰桶","d":"裝雞蛋糕製作器具","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"保冰桶","d":"裝烤爐","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"塑膠箱","d":"裝烤爐","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"塑膠箱","d":"裝麵粉","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"登機箱","d":"裝麵糊製作器具","q":1,"u":"個"},{"c":"行李","n":"背包","d":"裝衣服","q":1,"u":"個"},{"c":"行李","n":"背包","d":"裝電腦","q":1,"u":"個"}],"buy":[{"n":"雞蛋","a":15,"u":"顆"},{"n":"牛奶","a":750,"u":"ml"},{"n":"油","a":75,"u":"g"},{"n":"糖","a":550,"u":"g"},{"n":"低筋麵粉","a":700,"u":"g"},{"n":"地瓜粉","a":425,"u":"g"},{"n":"糯米粉","a":175,"u":"g"},{"n":"玉米粉","a":100,"u":"g"},{"n":"泡打粉","a":50,"u":"g"},{"n":"奶粉","a":50,"u":"g"},{"n":"香草糖","a":15,"u":"g"}],"boxes":["保冰桶①｜製作器具","保冰桶②｜烤爐","塑膠箱①｜烤爐","塑膠箱②｜麵粉","登機箱｜麵糊製作器具","背包①｜衣服","背包②｜電腦"],"info":["國家／城市","展場名稱","展場地址","飯店","去程航班","回程航班","當地聯絡人","當地電話","其他事項"]}];
