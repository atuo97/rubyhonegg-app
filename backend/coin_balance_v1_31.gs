// ═════════════════════════════════════════════════════════════
// v1.31 赤心幣平衡（隊長 11/13 定案）
// 本檔放在 Apps Script 專案「最後面」，會覆蓋前面同名的函式。
//   1 升等不追溯：工時幣只計算「新增的工時」，用結算當下的等級；升等之後才開始用新倍率
//   2 節日類（春節、國定假日、颱風、品牌週年）同一段工時只取最高的一個；每小時總倍率（含階層）上限預設 ×6
//   3 小店：同一位買家對同一家店每天最多買 3 件；成交抽 20%，明細拆成租金／水電／清潔；
//          每月 1 日收上個月的攤位月租（只從上月營收裡扣，營收不夠就扣到 0，不會變負債）
//     寵物市集：每個階段有價格範圍；每人每月最多賣出 1 隻、買進 1 隻；成交抽 20% 市集管理費（攤位費＋清潔費）
//   4 對戰每日獎勵上限 10 → 4：請執行一次 coin31_setup()（會更新〈遊戲參數〉並補上新參數）
// 新參數全部放在〈遊戲參數〉，之後可直接改數字。
// ═════════════════════════════════════════════════════════════

var C31_PARAMS = [
  ['工時倍率上限', 6, 'v1.31：每小時工時幣的總倍率上限（階層 × 所有加倍事件相乘後）'],
  ['小店同店每日購買上限', 3, 'v1.31：同一位買家對同一家小店，每天最多買幾件'],
  ['小店月租', 30, 'v1.31：每月 1 日收上月攤位月租；只從上月營收扣，營收不夠就扣到 0'],
  ['小店抽成明細', '租金 50,水電 25,清潔 25', 'v1.31：成交抽成（100% − 店主分潤）在明細裡怎麼拆，數字是比例'],
  ['寵物市集價格範圍', '100-150,150-250,200-350,300-500,400-700', 'v1.31：蛋、雛形、嬰兒、兒童、完全體各自可掛賣的價格範圍'],
  ['寵物市集每月賣出上限', 1, 'v1.31：每人每月最多賣出幾隻（含掛賣中）'],
  ['寵物市集每月買進上限', 1, 'v1.31：每人每月最多買進幾隻']
];
var C31_HOLIDAY = { spring: 1, holiday: 1, typhoon: 1, brand: 1 };
var C31_SET_HEAD = ['員工編號', '日期|櫃位', '已結算分鐘', '更新時間'];

function c31_n_(k, d) { var v = Number(gm_param_(k)); return isFinite(v) && v > 0 ? v : d; }

// 執行一次：補上新參數、對戰每日獎勵上限改成 4
function coin31_setup() {
  var sh = gm_sh_('params'), rows = gm_rows_('params'), have = {};
  rows.forEach(function (r, i) { have[String(r[0]).trim()] = i + 2; });
  if (have['對戰每日獎勵上限']) sh.getRange(have['對戰每日獎勵上限'], 2).setValue(4);
  else sh.appendRow(['對戰每日獎勵上限', 4, 'v1.31：贏對戰每天最多拿幾枚']);
  C31_PARAMS.forEach(function (p) { if (!have[p[0]]) sh.appendRow(p); });
  c31_setSheet_();
  GM_CACHE_ = {};
  return '完成：對戰每日獎勵上限 = 4，新增參數 ' + C31_PARAMS.length + ' 項，〈工時幣結算〉表已建立';
}

// ── 2 加倍事件（覆蓋）：節日類只取最高一個 ──
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
      out.push({ k: 'boost' + i, name: '⚡ ' + b.name, m: b.mult, holiday: /颱風|豪雨/.test(b.name) });
  });
  // 節日類（含名稱有颱風／豪雨的手動加倍）只留倍率最高的一個
  var best = null;
  out.forEach(function (v) { if (C31_HOLIDAY[v.k] || v.holiday) { if (!best || v.m > best.m) best = v; } });
  return out.filter(function (v) { return !(C31_HOLIDAY[v.k] || v.holiday) || v === best; });
}

// ── 1 工時幣（覆蓋）：只算新增的工時、用當下等級、套用倍率上限 ──
function c31_setSheet_() {
  var ss = gm_ss_(), sh = ss.getSheetByName('工時幣結算');
  if (!sh) { sh = ss.insertSheet('工時幣結算'); sh.getRange(1, 1, 1, C31_SET_HEAD.length).setValues([C31_SET_HEAD]); sh.setFrozenRows(1); sh.getRange('B:B').setNumberFormat('@'); }
  return sh;
}
function gm_payHours_(runDate) {
  var start = gm_param_('測試版開始日'), X = gm27_ctx_(), yday = gm_addDays_(runDate, -1), cap = c31_n_('工時倍率上限', 6);
  // 目前工時（同一人、同一天、同一櫃位合併）
  var cur = {};
  gm_rows_('hours').forEach(function (r) {
    var d = String(r[0]); if (d < start) return;
    var emp = String(r[1]), key = d + '|' + String(r[2]);
    (cur[emp] = cur[emp] || {})[key] = (cur[emp][key] || 0) + (Number(r[3]) || 0);
  });
  // 已結算紀錄
  var sh = c31_setSheet_(), S = {};
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().forEach(function (r, i) {
    var emp = String(r[0]); if (!emp) return;
    (S[emp] = S[emp] || {})[String(r[1])] = { row: i + 2, v: Number(r[2]) || 0 };
  });
  var paid = {};
  gm_rows_('ledger').forEach(function (r) { if (r[2] === '工時') paid[r[1]] = (paid[r[1]] || 0) + (Number(r[3]) || 0); });
  var app = [], upd = [], now = gm_now_();
  Object.keys(cur).forEach(function (emp) {
    var e = gm_emp_(emp); if (!e || e.resigned) return;
    var s = S[emp] = S[emp] || {}, rm = gm27_roleMult_(e.role), add = 0, parts = [];
    var set = function (k, v) { if (s[k]) { if (s[k].v !== v) upd.push([s[k].row, v]); s[k].v = v; } else { app.push([emp, k, v, now]); s[k] = { v: v }; } };
    // 舊制已發過工時幣、但還沒有結算紀錄 → 目前工時全部當作已結算，不重發
    if (!s._acc && (paid[emp] || 0) > 0) {
      Object.keys(cur[emp]).forEach(function (k) { set(k, cur[emp][k]); });
      set('_acc', paid[emp] * 60);
      return;
    }
    Object.keys(cur[emp]).forEach(function (k) {
      var old = s[k] ? s[k].v : 0, dm = cur[emp][k] - old;
      if (dm <= 0) return;                                   // 工時被改少：不倒扣
      var d = k.split('|')[0], loc = k.slice(d.length + 1), ev = gm27_events_(emp, d, loc, X);
      var raw = rm * gm27_mult_(ev), m = Math.min(cap, raw);
      add += dm * m; set(k, cur[emp][k]);
      parts.push((d === yday ? '' : d.slice(5).replace('-', '/') + ' ') + Math.round(dm / 6) / 10 + 'h' + (rm !== 1 ? ' × Lv.' + e.role + ' ' + rm : '') +
        ev.map(function (v) { return ' × ' + v.name + ' ' + v.m; }).join('') + (raw > cap ? '（上限 ×' + cap + '）' : ''));
    });
    if (!add) return;
    var acc = (s._acc ? s._acc.v : 0) + add; set('_acc', Math.round(acc * 1000) / 1000);
    var diff = Math.floor(acc / 60) - (paid[emp] || 0);
    if (diff > 0) gm_credit_(emp, '工時', diff, '工時結算至 ' + yday + '：' + parts.join('；'), 'HOURS|' + emp + '|' + runDate);
  });
  upd.forEach(function (u) { sh.getRange(u[0], 3, 1, 2).setValues([[u[1], now]]); });
  if (app.length) sh.getRange(sh.getLastRow() + 1, 1, app.length, 4).setValues(app);
  try { gm27_monthly_(runDate); } catch (e) {}
  try { c31_shopRent_(runDate); } catch (e) {}
}

// ── 3 小店（覆蓋購買）：同店每日上限、抽成拆明細 ──
function c31_feeSplit_(fee) {
  var parts = String(gm_param_('小店抽成明細') || '租金 50,水電 25,清潔 25').split(',').map(function (x) {
    var m = String(x).trim().match(/^(\S+)\s+(\d+(?:\.\d+)?)$/); return m ? { n: m[1], w: Number(m[2]) } : null;
  }).filter(Boolean);
  var tw = parts.reduce(function (a, x) { return a + x.w; }, 0) || 1, left = fee;
  return parts.map(function (x, i) { var v = i === parts.length - 1 ? left : Math.round(fee * x.w / tw); left -= v; return x.n + ' ' + v; }).join('、');
}
function sp_buy_(p) {
  var buyer = String(p.empId || '').trim(), owner = String(p.owner || '').trim(), item = String(p.item || ''), to = String(p.to || '').trim();
  if (!gm_emp_(buyer) || gm_isFrozen_(buyer)) return { error: '帳號無法使用' };
  if (buyer === owner) return { error: '不能買自己店裡的東西' };
  var s = sp_shop_(owner); if (!s || gm_isFrozen_(owner)) return { error: '這家店目前沒有營業' };
  var it = sp_items_(s.type, s.prices).filter(function (x) { return x.id === item; })[0]; if (!it) return { error: '這家店沒有賣這個' };
  var lim = c31_n_('小店同店每日購買上限', 3), today = gm_today_(), cnt = 0;
  pv_rows_('sales').forEach(function (r) { if (String(r[1]) === owner && String(r[2]) === buyer && String(r[0]).slice(0, 10) === today) cnt++; });
  if (cnt >= lim) return { error: '今天在這家店已經買了 ' + lim + ' 件，明天再來吧' };
  if (gm_balance_(buyer) < it.price) return { error: '赤心幣不足' };
  var cat = gm_catalog_()[item], kind = cat.cat;
  if (kind === 'gift') { if (!gm_emp_(to) || gm_isFrozen_(to) || to === buyer) return { error: '請選擇要送給哪位夥伴' }; }
  else if (['weapon', 'armor', 'card', 'decor'].indexOf(kind) >= 0 && gm_owned_(buyer)[item]) return { error: '已經擁有了' };
  if (kind === 'petsnack' && !gm_pet_(buyer)) return { error: '還沒有寵物' };
  var share = Math.floor(it.price * pv_param_('小店店主分潤') / 100), k = Date.now() + '|' + Math.random();
  gm_credit_(buyer, '小店消費', -it.price, '在「' + s.name + '」買了' + it.name, 'SPBUY|' + buyer + '|' + k);
  if (share) gm_credit_(owner, '小店營收', share, (gm_emp_(buyer).nick || gm_emp_(buyer).name) + ' 買了' + it.name + '（售價 ' + it.price + '，扣' + c31_feeSplit_(it.price - share) + '）', 'SPINC|' + owner + '|' + k);
  if (kind === 'gift') pv_append_('gifts', [[gm_now_(), buyer, to, item, '']]);
  else if (kind === 'petsnack') {
    var pet = gm_pet_(buyer), add = Number(String(cat.note).split(':')[1]) || 0;
    var prow = gm_rows_('pets')[pet.row - 2];
    var rng = gm_sh_('pets').getRange(pet.row, 6, 1, 2); rng.setNumberFormat('@');
    rng.setValues([[String((Number(prow[5]) || 0) + add), String((Number(prow[6]) || 0) + 1)]]); GM_CACHE_.rows_pets = null;
  } else gm_append_('owned', [[buyer, item, '小店', gm_now_()]]);
  pv_append_('sales', [[gm_now_(), owner, buyer, item, it.price, share, to]]);
  var rr = pv_sh_('shops').getRange(s.row, 6, 1, 2); rr.setNumberFormat('@'); rr.setValues([[String(s.revenue + share), String(s.sales + 1)]]); GM_CACHE_.rows_pv_shops = null;
  return { success: true, data: { balance: gm_balance_(buyer) } };
}
// 每月 1～7 日：收上個月的攤位月租（只從上月營收扣，不會負債）
function c31_shopRent_(runDate) {
  if (runDate.slice(8) > '07') return;
  var ym = gm_prevMonth_(runDate.slice(0, 7)); if (ym < String(gm_param_('測試版開始日')).slice(0, 7)) return;
  var rent = c31_n_('小店月租', 30), inc = {};
  pv_rows_('sales').forEach(function (r) { if (String(r[0]).slice(0, 7) === ym) inc[r[1]] = (inc[r[1]] || 0) + (Number(r[5]) || 0); });
  pv_rows_('shops').forEach(function (r) {
    var owner = String(r[0]); if (!owner || gm_isFrozen_(owner)) return;
    var got = inc[owner] || 0, amt = Math.min(rent, got, Math.max(0, gm_balance_(owner)));
    if (amt > 0) gm_credit_(owner, '小店月租', -amt, ym + ' 攤位月租（上月營收 ' + got + ' 枚' + (amt < rent ? '，營收不足只收 ' + amt : '') + '）', 'SHOPRENT|' + owner + '|' + ym);
  });
}

// ── 3 寵物市集（覆蓋掛賣、購買）：階段價格範圍、每月買賣上限、管理費明細 ──
function c31_mktRange_(stage) {
  var a = String(gm_param_('寵物市集價格範圍') || '100-150,150-250,200-350,300-500,400-700').split(',');
  var m = String(a[Math.max(0, Math.min(a.length - 1, (stage || 1) - 1))] || '').match(/(\d+)\s*-\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : [p28_n_('寵物市集最低價', 100), p28_n_('寵物市集最高價', 1000)];
}
function c31_mktCount_(emp, role) {   // 本月賣出（含掛賣中）／買進次數
  var ym = gm_today_().slice(0, 7), n = 0;
  p28_mkt_().forEach(function (m) {
    if (role === 'sell' && m.seller === emp && (m.status === '掛賣' || (m.status === '成交' && String(m.done).slice(0, 7) === ym))) n++;
    if (role === 'buy' && m.buyer === emp && m.status === '成交' && String(m.done).slice(0, 7) === ym) n++;
  });
  return n;
}
function p28_list_(p) {
  var emp = String(p.empId || '').trim(), a = p28_alive_(emp), t = a.filter(function (x) { return x.id === String(p.pet); })[0];
  if (!t) return { error: '找不到這隻寵物' };
  if (t.status === '掛賣') return { error: '已經在市集上了' };
  if (a.filter(function (x) { return x.status !== '掛賣'; }).length <= 1) return { error: '至少要留 1 隻寵物在身邊' };
  p28_expire_();
  var lim = c31_n_('寵物市集每月賣出上限', 1);
  if (c31_mktCount_(emp, 'sell') >= lim) return { error: '每個月最多賣出 ' + lim + ' 隻（掛賣中的也算），下個月再來' };
  gm_petSync_(t);
  var rg = c31_mktRange_(t.stage), price = Math.floor(Number(p.price) || 0);
  if (price < rg[0] || price > rg[1]) return { error: t.stageName + '的價格要在 ' + rg[0] + '～' + rg[1] + ' 之間' };
  gm_petSet_(t.row, 9, ['掛賣']);
  p28_mktSheet_().appendRow(['K' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10), emp, t.id, price, '掛賣', gm_now_(), '', '']);
  p28_ensureMain_(emp);
  return { success: true, data: p28_team_(emp) };
}
function p28_buyMkt_(p) {
  var emp = String(p.empId || '').trim(), e = gm_emp_(emp); if (!e || gm_isFrozen_(emp)) return { error: '帳號無法使用' };
  p28_expire_();
  var m = p28_mkt_().filter(function (k) { return k.id === String(p.id) && k.status === '掛賣'; })[0];
  if (!m) return { error: '這隻已經被買走或收回了' };
  if (m.seller === emp) return { error: '不能買自己的寵物' };
  var lim = c31_n_('寵物市集每月買進上限', 1);
  if (c31_mktCount_(emp, 'buy') >= lim) return { error: '每個月最多在市集買 ' + lim + ' 隻，下個月再來' };
  if (p28_alive_(emp).length >= p28_n_('寵物上限', 5)) return { error: '你的寵物已經滿 5 隻，請先賣掉一隻' };
  if (gm_balance_(emp) < m.price) return { error: '赤心幣不足' };
  var pt = p28_petRow_(m.pet); if (!pt) return { error: '找不到這隻寵物' };
  var share = Number(gm_param_('寵物市集賣家比例')) || 0.8, get = Math.floor(m.price * share), fee = m.price - get;
  gm_credit_(emp, '寵物市集', -m.price, '買下「' + pt.name + '」', 'MKTBUY|' + m.id);
  if (!gm_isFrozen_(m.seller)) gm_credit_(m.seller, '寵物市集', get, '「' + pt.name + '」賣出 ' + m.price + ' 枚（扣市集管理費 ' + fee + '：攤位費 ' + Math.round(fee / 2) + '、清潔費 ' + (fee - Math.round(fee / 2)) + '）', 'MKTSELL|' + m.id);
  gm_append_('pets', [[m.seller, pt.flavor, pt.name, pt.since, pt.acc, 0, 1, pt.type, '已售出', pt.id + 'S', pt.hatched]]);
  var bonus = pt.hours;
  gm_petSet_(pt.row, 1, [emp]); gm_petSet_(pt.row, 4, [gm_today_(), '', bonus]);
  gm_petSet_(pt.row, 9, [p28_alive_(emp).some(function (x) { return x.status === '身邊'; }) ? '隊伍' : '身邊']);
  p28_mktSheet_().getRange(m.row, 5, 1, 4).setValues([['成交', m.at, emp, gm_now_()]]);
  gm_petEvent_(emp, 'trade', (e.nick || e.name) + ' 在寵物市集帶回了「' + pt.name + '」');
  return { success: true, data: p28_team_(emp), balance: gm_balance_(emp) };
}
