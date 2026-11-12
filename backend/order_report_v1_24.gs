// ═══════════════════════════════════════════════
// 叫貨品項分類＋請總部處理（門市回報）v1.24（2026-11-12）
// 貼在「麵糊用量 v2」之後、「路由v1.24」之前
// 1. 叫貨品項改分類：原物料／包材／製作器具／文具／機器保養／其他；〈供貨價格〉新增 E 欄「分類」，品項以這張表為準（App「供貨價格與應收」可增改）
// 2. 請總部處理：機器報修、水電場地、人力支援、客訴、金流、其他；照片、緊急程度、接手、完成、費用；送出推 LINE「報修」群組
// 3. 費用：門市回報的費用（Lv.3 完成時填）計入加盟店損益「總部維修／服務」與應收；應收也列合作櫃位（桃機：物料＋回報費用）
// 部署後執行一次 rp_setup()
// 覆蓋：ops_prices_、ops_priceList_、ops_priceSave_、ops_matItems_、ops_pnlCalc_、ops_receivable_、line_groupSave_
// ═══════════════════════════════════════════════

var RP_MAT_CATALOG = [
  ['原物料', [['原味麵糊', '包'], ['可可麵糊', '包'], ['紅玉麵糊', '包'], ['抹茶麵糊', '包'], ['黑糖麵糊', '包'], ['芝麻麵糊', '包'],
              ['可可粉', '包'], ['紅玉紅茶粉', '包'], ['抹茶粉', '包'], ['黑糖粉', '包'], ['芝麻粉', '包'], ['低筋麵粉', '袋'], ['泡打粉', '罐'], ['二砂糖', '包']]],
  ['包材', [['紙袋', '包'], ['空白紙袋', '包'], ['紙盒', '個'], ['竹籤', '包'], ['塑膠提袋', '包']]],
  ['製作器具', [['攪拌機', '台'], ['麵糊桶', '個'], ['麵糊漏斗', '個'], ['麵糊叉子', '支'], ['毛刷', '支'], ['平刀', '支'], ['測溫槍', '支'],
                ['秤重器', '台'], ['湯匙', '支'], ['過篩網', '個'], ['六角扳手5號', '支'], ['六角扳手3號', '支'], ['十字起子', '支'], ['剪刀', '支'],
                ['推車', '台'], ['保冷袋', '個'], ['延長線', '條'], ['轉接頭', '個']]],
  ['文具', [['菜單表', '張'], ['原子筆', '支'], ['白板筆', '支'], ['訂書機', '個'], ['訂書針', '盒'], ['膠水', '瓶']]],
  ['機器保養', [['機器鍍膜', '次']]],
  ['其他', [['其他', '']]]
];
var RP_MAT_CATS = RP_MAT_CATALOG.map(function (c) { return c[0]; });
var RP_RENAME = { '麵糊': '原味麵糊', '麵粉': '低筋麵粉' };
var OPS_PRICE_HEAD = ['品項', '單位', '單價', '備註', '分類'];

var RP_HEAD = ['回報編號', '建立時間', '員工編號', '姓名', '櫃位', '分類', '項目', '說明', '照片', '緊急程度', '狀態', '接手人', '處理結果', '費用', '完成時間', '狀態紀錄(JSON)'];
var RP_CATS = [
  ['機器報修', ['不升溫', '不過電', '溫控壞掉', '需要換模具', '冰箱溫度異常', '其他機器問題']],
  ['水電場地', ['停電／跳電', '漏水', '百貨公司通知', '其他']],
  ['人力支援', ['臨時缺人', '需要調班', '其他']],
  ['客訴與客人狀況', []],
  ['金流', ['POS／刷卡機故障', '零用金不足', '其他']],
  ['其他', []]
];
var RP_URG = ['一般', '今天要處理', '現在就要'];
var RP_OPEN = ['已送出', '處理中'];

function rp_idx_(item) {
  for (var i = 0; i < RP_MAT_CATALOG.length; i++) for (var j = 0; j < RP_MAT_CATALOG[i][1].length; j++) if (RP_MAT_CATALOG[i][1][j][0] === item) return j;
  return 500;
}
function rp_catOf_(item) {
  for (var i = 0; i < RP_MAT_CATALOG.length; i++) for (var j = 0; j < RP_MAT_CATALOG[i][1].length; j++) if (RP_MAT_CATALOG[i][1][j][0] === item) return RP_MAT_CATALOG[i][0];
  return '';
}

// ── 供貨價格（含分類）──
function ops_prices_() {
  var sh = ops_sheet_('供貨價格', OPS_PRICE_HEAD), out = {};
  ops_rows_(sh, 5).forEach(function (r, i) {
    var n = String(r[0]).trim(); if (!n) return;
    out[n] = { unit: String(r[1] || ''), price: r[2] === '' ? null : ops_num_(r[2]), note: String(r[3] || ''), cat: String(r[4] || '') || rp_catOf_(n) || '其他', order: i };
  });
  if (out['原味麵糊'] && !out['麵糊']) out['麵糊'] = out['原味麵糊'];        // 舊名相容
  return out;
}
function rp_priceSorted_() {
  var pr = ops_prices_();
  return Object.keys(pr).filter(function (k) { return !(k === '麵糊' && pr['原味麵糊'] === pr[k]); }).map(function (k) { return { item: k, unit: pr[k].unit, price: pr[k].price, note: pr[k].note, cat: pr[k].cat, order: pr[k].order }; })
    .sort(function (a, b) {
      var ca = RP_MAT_CATS.indexOf(a.cat), cb = RP_MAT_CATS.indexOf(b.cat); if (ca < 0) ca = 98; if (cb < 0) cb = 98;
      if (a.item === '其他') ca = 99; if (b.item === '其他') cb = 99;
      if (ca !== cb) return ca - cb;
      var ia = rp_idx_(a.item), ib = rp_idx_(b.item);
      return ia !== ib ? ia - ib : a.order - b.order;
    });
}
function ops_priceList_(p) {
  ops_need_(p, 2);
  return { success: true, cats: RP_MAT_CATS, data: rp_priceSorted_().map(function (x) { delete x.order; return x; }) };
}
function ops_priceSave_(p) {
  ops_need_(p, 3, true);
  var list = ops_arr_(p.list), sh = ops_sheet_('供貨價格', OPS_PRICE_HEAD);
  var rows = list.filter(function (x) { return String(x.item || '').trim(); }).map(function (x) {
    var price = x.price === '' || x.price === null || x.price === undefined ? '' : ops_num_(x.price);
    var cat = String(x.cat || '').trim(); if (RP_MAT_CATS.indexOf(cat) < 0) cat = rp_catOf_(String(x.item).trim()) || '其他';
    return [String(x.item).trim().slice(0, 20), String(x.unit || '').slice(0, 6), price, String(x.note || '').slice(0, 60), cat];
  });
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 5).clearContent();
    if (rows.length) sh.getRange(2, 1, rows.length, 5).setValues(rows);
  } finally { lock.releaseLock(); }
  return { success: true };
}
function ops_matItems_(p) {
  var list = rp_priceSorted_();
  if (!list.length) list = [].concat.apply([], RP_MAT_CATALOG.map(function (c) { return c[1].map(function (x) { return { item: x[0], unit: x[1], cat: c[0] }; }); }));
  if (!list.some(function (x) { return x.item === '其他'; })) list.push({ item: '其他', unit: '', cat: '其他' });
  return { success: true, cats: RP_MAT_CATS, items: list.filter(function (x) { return !/停用/.test(x.note || ''); }).map(function (x) { return { item: x.item, unit: x.unit, cat: x.cat }; }) };
}

// ── 部署後執行一次 ──
function rp_setup() {
  var sh = ops_sheet_('供貨價格', OPS_PRICE_HEAD);
  if (!String(sh.getRange(1, 5).getValue()).trim()) sh.getRange(1, 5).setValue('分類');
  var rows = ops_rows_(sh, 5).filter(function (r) { return String(r[0]).trim(); }), have = {}, log = [];
  rows = rows.filter(function (r) {
    var n = String(r[0]).trim();
    if (RP_RENAME[n]) { log.push(n + ' → ' + RP_RENAME[n]); r[0] = RP_RENAME[n]; n = r[0]; }
    if (n === '包材' && r[2] === '') { log.push('移除「包材」（改成紙袋、紙盒…細項）'); return false; }
    if (have[n]) return false;
    have[n] = 1; if (!String(r[4] || '').trim()) r[4] = rp_catOf_(n) || '其他';
    return true;
  });
  RP_MAT_CATALOG.forEach(function (c) { c[1].forEach(function (x) { if (x[0] === '其他' || have[x[0]]) return; rows.push([x[0], x[1], '', '單價待補', c[0]]); have[x[0]] = 1; log.push('新增 ' + c[0] + '／' + x[0]); }); });
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 5).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, 5).setValues(rows.map(function (r) { return [r[0], r[1], r[2], r[3], r[4]]; }));
  ops_sheet_('門市回報', RP_HEAD);
  Logger.log('rp_setup 完成\n' + log.join('\n') + '\n提醒：到 App「發公告→LINE 群組」把要收報修通知的群組勾「報修」');
  return log;
}

// ── 請總部處理（門市回報）──
function rp_rows_() {
  var sh = ops_sheet_('門市回報', RP_HEAD);
  return ops_rows_(sh, RP_HEAD.length).map(function (r, i) {
    return { row: i + 2, id: String(r[0]), created: String(r[1]), empId: String(r[2]), name: String(r[3]), loc: String(r[4]), cat: String(r[5]), item: String(r[6] || ''),
      desc: String(r[7] || ''), photo: String(r[8] || ''), urg: String(r[9] || '一般'), status: String(r[10] || '已送出'), handler: String(r[11] || ''),
      result: String(r[12] || ''), fee: r[13] === '' ? null : ops_num_(r[13]), done: String(r[14] || ''), log: ops_json_(String(r[15] || ''), []) };
  }).filter(function (x) { return x.id; });
}
function rp_canSee_(me, x) { return me.role >= 3 || x.empId === me.id || ops_myLocs_(me).indexOf(x.loc) >= 0; }
function rp_canHandle_(me, x) { return me.role >= 3 || (me.role >= 2 && ops_myLocs_(me).indexOf(x.loc) >= 0); }
function rp_meta_(p) {
  var me = ops_me_(p.empId);
  return { success: true, cats: RP_CATS.map(function (c) { return { cat: c[0], items: c[1] }; }), urg: RP_URG, canManage: me.role >= 2, canFee: me.role >= 3 };
}
function rp_create_(p) {
  var me = ops_me_(p.empId), loc = String(p.loc || '').trim();
  if (!ops_locByName_(loc)) return { error: '請選櫃位' };
  if (me.role < 3 && ops_myLocs_(me).indexOf(loc) < 0 && me.type !== '員工') return { error: '只能回報自己的櫃位' };
  var cat = String(p.cat || ''), c = RP_CATS.filter(function (x) { return x[0] === cat; })[0];
  if (!c) return { error: '請選分類' };
  var item = String(p.item || '').trim().slice(0, 20);
  if (c[1].length && c[1].indexOf(item) < 0) return { error: '請選項目' };
  var desc = String(p.desc || '').trim().slice(0, 300);
  if (!c[1].length && !desc) return { error: '請寫一下狀況' };
  if (/其他/.test(item) && !desc) return { error: '「其他」請寫一下狀況' };
  var urg = RP_URG.indexOf(String(p.urg)) >= 0 ? String(p.urg) : '一般';
  var id = typeof au_id_ === 'function' ? au_id_('R') : 'R' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
  var log = [{ s: '已送出', by: me.name, at: ops_now_() }];
  ops_sheet_('門市回報', RP_HEAD).appendRow([id, ops_now_(), me.id, me.name, loc, cat, item, desc, String(p.photo || '').slice(0, 500), urg, '已送出', '', '', '', '', JSON.stringify(log)]);
  try {
    if (typeof line_notify_ === 'function') line_notify_('報修', (urg === '現在就要' ? '🚨 ' : urg === '今天要處理' ? '⚠️ ' : '🔧 ') + '門市回報｜' + loc.replace(/^\d+/, '') + '\n' +
      cat + (item ? '／' + item : '') + (urg !== '一般' ? '（' + urg + '）' : '') + (desc ? '\n' + desc.slice(0, 120) : '') + '\n回報：' + me.name + (p.photo ? '\n📷 有附照片（App 內查看）' : ''));
  } catch (e) {}
  return { success: true, id: id };
}
function rp_list_(p) {
  var me = ops_me_(p.empId), ym = String(p.ym || '');
  var list = rp_rows_().filter(function (x) {
    if (!rp_canSee_(me, x)) return false;
    if (p.open) return RP_OPEN.indexOf(x.status) >= 0;
    return !ym || x.created.slice(0, 7) === ym;
  });
  var u = function (x) { return RP_URG.indexOf(x.urg); };
  list.sort(function (a, b) {
    var oa = RP_OPEN.indexOf(a.status) >= 0 ? 0 : 1, ob = RP_OPEN.indexOf(b.status) >= 0 ? 0 : 1;
    if (oa !== ob) return oa - ob;
    if (!oa && u(a) !== u(b)) return u(b) - u(a);
    return a.created < b.created ? 1 : -1;
  });
  return { success: true, canManage: me.role >= 2, canFee: me.role >= 3, data: list.slice(0, 200).map(function (x) {
    x.canHandle = rp_canHandle_(me, x); x.mine = x.empId === me.id; delete x.row; return x;
  }) };
}
function rp_update_(p) {
  var me = ops_me_(p.empId), st = String(p.status || '');
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var x = rp_rows_().filter(function (r) { return r.id === String(p.id || ''); })[0];
    if (!x) return { error: '找不到這筆回報' };
    if (!rp_canSee_(me, x)) return { error: '沒有權限' };
    var sh = ops_ss_().getSheetByName('門市回報'), text = String(p.text || '').trim().slice(0, 300);
    if (st === '留言') {
      if (!text) return { error: '請輸入內容' };
      x.log.push({ s: '留言', by: me.name, at: ops_now_(), t: text });
      sh.getRange(x.row, 16).setValue(JSON.stringify(x.log));
      return { success: true };
    }
    if (st === '已取消') {
      if (!(me.role >= 3 || (x.empId === me.id && x.status === '已送出'))) return { error: '只有回報人（總部還沒接手前）或總部可以取消' };
    } else if (st === '處理中' || st === '已完成') {
      if (!rp_canHandle_(me, x)) return { error: '只有分隊長（自己的櫃位）以上可以處理' };
      if (st === '已完成' && !text) return { error: '請寫處理結果' };
    } else return { error: '狀態不正確' };
    var fee = x.fee;
    if (st === '已完成' && p.fee !== undefined && p.fee !== '' && p.fee !== null) {
      if (me.role < 3) return { error: '費用只有總部（Lv.3）可以填' };
      fee = Math.max(0, Math.round(ops_num_(p.fee)));
    }
    x.log.push({ s: st, by: me.name, at: ops_now_(), t: text });
    var handler = st === '處理中' ? me.name : (x.handler || (st === '已完成' ? me.name : ''));
    sh.getRange(x.row, 11, 1, 6).setValues([[st, handler, st === '已完成' ? text : x.result, fee === null ? '' : fee, st === '已完成' || st === '已取消' ? ops_today_() : '', JSON.stringify(x.log)]]);
    if (st === '已完成') { try { if (typeof line_notify_ === 'function' && x.urg !== '一般') line_notify_('報修', '✅ 已處理｜' + x.loc.replace(/^\d+/, '') + '　' + x.cat + (x.item ? '／' + x.item : '') + '\n' + text.slice(0, 100)); } catch (e) {} }
    return { success: true };
  } finally { lock.releaseLock(); }
}
function rp_count_(p) {
  var me = ops_me_(p.empId), n = 0, urgent = 0, mineOpen = 0;
  rp_rows_().forEach(function (x) {
    if (RP_OPEN.indexOf(x.status) < 0) return;
    if (x.empId === me.id) mineOpen++;
    if (me.role >= 2 && rp_canHandle_(me, x)) { n++; if (x.urg !== '一般' && x.status === '已送出') urgent++; }
  });
  return { success: true, pending: n, urgent: urgent, mineOpen: mineOpen };
}
function rp_feeSum_(loc, ym) {
  var s = 0;
  rp_rows_().forEach(function (x) { if (x.status === '已完成' && x.fee && ops_sameLoc_(x.loc, loc) && String(x.done || x.created).slice(0, 7) === ym) s += x.fee; });
  return s;
}
function rpHandler_(action, p) {
  if (!/^rp[A-Z]/.test(String(action || ''))) return null;
  p = p || {}; if (typeof OPS_C_ !== 'undefined') OPS_C_ = {};
  try {
    switch (action) {
      case 'rpMeta':   return rp_meta_(p);
      case 'rpCreate': return rp_create_(p);
      case 'rpList':   return rp_list_(p);
      case 'rpUpdate': return rp_update_(p);
      case 'rpCount':  return rp_count_(p);
    }
  } catch (e) { return { error: e.message }; }
  return null;
}

// ── 覆蓋：LINE 群組用途多「報修」──
function line_groupSave_(p) {
  line_me_(p, 3);
  var g = line_groups_().filter(function (x) { return x.id === String(p.id || ''); })[0]; if (!g) return { error: '找不到群組' };
  var use = String(p.use || '公告').split(/[,，、]/).filter(function (x) { return /^(公告|物料|報修)$/.test(x); }).join('、') || '公告';
  var locs = (Object.prototype.toString.call(p.locs) === '[object Array]' ? p.locs : String(p.locs || '').split(/[、,，]+/)).map(String).filter(String);
  line_sheet_().getRange(g.row, 2, 1, 6).setValues([[String(p.name || g.name).slice(0, 30), g.status || '使用中', use, g.joined, line_now_(), locs.join('、')]]);
  return { success: true };
}

// ── 覆蓋：應收（加盟店＋合作櫃位）──
function rp_partnerCalc_(loc, ym) {
  var pr = ops_prices_(), mat = 0, missing = [];
  ops_matRows_().forEach(function (x) {
    if (!ops_sameLoc_(x.loc, loc) || !/已出貨|已送達/.test(x.status) || (x.shipDate || x.created).slice(0, 7) !== ym) return;
    x.items.forEach(function (it) { var u = pr[it.item]; if (!u || u.price === null) { if (missing.indexOf(it.item) < 0) missing.push(it.item); return; } mat += u.price * it.qty; });
  });
  return { materials: Math.round(mat), missing: missing };
}
function ops_receivable_(p) {
  ops_need_(p, 3, true);
  var ym = String(p.ym || ops_prevYm_(ops_today_().slice(0, 7)));
  return { success: true, ym: ym, data: ops_locs_().filter(function (x) { return /加盟|合作/.test(x.kind) && x.status !== '已停用'; }).map(function (x) {
    var fee = rp_feeSum_(x.name, ym);
    if (/合作/.test(x.kind)) {
      var c2 = rp_partnerCalc_(x.name, ym);
      return { loc: x.name, kind: '合作', revenue: null, royalty: 0, batter: 0, materials: c2.materials, fee: fee, total: c2.materials + fee, missingPrice: c2.missing };
    }
    var c = ops_pnlCalc_(x.name, ym);
    return { loc: x.name, kind: '加盟', revenue: c.revenue, royalty: c.royalty, batter: c.batterCost, materials: c.matCost, fee: fee, total: c.royalty + c.batterCost + c.matCost + fee, missingPrice: c.missingPrice };
  }) };
}

// ── 覆蓋：加盟店損益（原味麵糊改名、各口味麵糊以用量計、加總部維修／服務費）──
function ops_pnlCalc_(loc, ym) {
  var days = ops_revenueByDay_(loc, ym), revenue = 0, batterUse = 0, openDays = 0;
  Object.keys(days).forEach(function (d) { revenue += days[d].rev; batterUse += days[d].batter; if (days[d].rev > 0) openDays++; });
  var exps = ops_expRows_(loc, ym), fixed = ops_fixedRows_(loc).filter(function (f) { return (!f.from || f.from <= ym) && (!f.to || f.to >= ym); });
  var income = {}, cost = {};
  exps.forEach(function (e) { if (OPS_INCOME_CATS.indexOf(e.cat) >= 0) income[e.cat] = (income[e.cat] || 0) + e.amount; else cost[e.cat] = (cost[e.cat] || 0) + e.amount; });
  var fixedApplied = [];
  fixed.forEach(function (f) {                       // 當月若已手動填同分類，就不再自動帶入
    if (exps.some(function (e) { return e.cat === f.cat; })) return;
    cost[f.cat] = (cost[f.cat] || 0) + f.amount; fixedApplied.push(f.cat);
  });
  var otherIncome = Object.keys(income).reduce(function (s, k) { return s + income[k]; }, 0);
  var sales = revenue + otherIncome;
  var vat = /是|Y|1|有/.test(String(ops_param_('加盟店開發票', '是'))) ? Math.round(sales / 1.05 * 0.05) : 0;
  var pr = ops_prices_(), missing = [];
  var bp = pr['原味麵糊'] || pr['麵糊'];
  var batterPrice = bp && bp.price !== null ? bp.price : null;
  if (batterPrice === null && batterUse) missing.push('原味麵糊');
  var batterCost = batterPrice === null ? 0 : Math.round(batterUse * batterPrice);
  // 物料（麵糊以收店用量計，避免重複；其他品項以當月出貨的物料需求單計）
  var mat = {}, matCost = 0;
  ops_matRows_().forEach(function (x) {
    if (!ops_sameLoc_(x.loc, loc) || !/已出貨|已送達/.test(x.status) || (x.shipDate || x.created).slice(0, 7) !== ym) return;
    x.items.forEach(function (it) {
      if (/麵糊$/.test(it.item)) return;           // 各口味麵糊以收店用量計
      var u = pr[it.item];
      if (!u || u.price === null) { if (missing.indexOf(it.item) < 0) missing.push(it.item); return; }
      mat[it.item] = (mat[it.item] || 0) + u.price * it.qty; matCost += u.price * it.qty;
    });
  });
  matCost = Math.round(matCost);
  var rate = ops_num_(ops_param_('加盟權利金比率', 0.01)); if (rate > 1) rate = rate / 100;
  var royalty = Math.round(revenue * rate);
  // 人事：系統代算的加盟店夥伴薪資（薪資引擎 v3）＋加盟主自評人力
  var labor = { staff: 0, list: [], owner: 0, ownerHours: 0 };
  try {
    if (typeof pay3_compute_ === 'function') {
      var res = pay3_compute_(ym, {});
      Object.keys(res.emps).forEach(function (id) {
        var e = res.emps[id]; if (!e.franchise || !ops_sameLoc_(e.franchiseLoc, loc)) return;
        if (e.isOwner) { labor.ownerHours += e.totalH; return; }
        labor.staff += e.gross; labor.list.push({ id: id, name: e.name, hours: e.totalH, gross: e.gross, notes: e.notes });
      });
    }
  } catch (e) { labor.err = e.message; }
  var ownerWage = ops_num_(ops_param_('加盟主自評時薪_' + loc, ops_param_('加盟主自評時薪', 0)));
  labor.owner = Math.round(labor.ownerHours * ownerWage);
  // v1.24：總部處理門市回報的費用（完成月份計）
  var rpFee = rp_feeSum_(loc, ym); if (rpFee) cost['總部維修／服務'] = (cost['總部維修／服務'] || 0) + rpFee;
  var opex = Object.keys(cost).reduce(function (s, k) { return s + cost[k]; }, 0);
  var totalCost = vat + batterCost + matCost + labor.staff + opex + royalty;
  var net = sales - totalCost, netOwner = net - labor.owner;
  var variable = vat + batterCost + matCost + royalty;
  var fixedCost = totalCost - variable, varRatio = sales ? variable / sales : 0;
  var be = openDays && varRatio < 1 ? Math.ceil(fixedCost / (1 - varRatio) / openDays) : null;
  return { loc: loc, ym: ym, revenue: Math.round(revenue), income: income, sales: Math.round(sales), vat: vat, openDays: openDays,
    avgDaily: openDays ? Math.round(revenue / openDays) : 0, batterUse: Math.round(batterUse * 100) / 100, batterPrice: batterPrice, batterCost: batterCost,
    materials: mat, matCost: matCost, labor: labor, ownerWage: ownerWage, costs: cost, fixedApplied: fixedApplied, royaltyRate: rate, royalty: royalty, rpFee: rpFee,
    totalCost: Math.round(totalCost), net: Math.round(net), netOwner: Math.round(netOwner), margin: sales ? Math.round(net / sales * 1000) / 10 : 0,
    breakEvenDaily: be, missingPrice: missing, days: Object.keys(days).sort().map(function (d) { return { date: d, rev: days[d].rev, batter: days[d].batter }; }) };
}
