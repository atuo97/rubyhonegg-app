// ═════════════════════════════════════════════════════════════
// v1.31 赤心幣平衡（隊長 11/13 定案）｜v2：花幣動作加登入通行證本人檢查｜v4（部署端）：gm_admin_ 沒有有效通行證一律擋下
// 位置：第 33 版之後、路由之前（與部署端「權限修正 v2」、v1.32 夥伴權限保護沒有重疊的函式，前後皆可）。
// 底版：後端第 33 版（部署交接 11/13 19:50）。
//   1 升等不追溯：工時幣只計算「新增的工時」，用結算當下的等級；升等之後才開始用新倍率
//   2 節日類（春節、國定假日、颱風、品牌週年）同一段工時只取最高的一個；每小時總倍率（含階層）上限預設 ×6
//   3 小店：同一位買家對同一家店每天最多買 3 件；成交抽 20%，明細拆成租金／水電／清潔；
//          每月 1 日收上個月的攤位月租（只從上月營收裡扣，營收不夠就扣到 0，不會變負債）
//     寵物市集：每個階段有價格範圍；每人每月最多賣出 1 隻、買進 1 隻；成交抽 20% 市集管理費（攤位費＋清潔費）
//   4 對戰每日獎勵上限 10 → 4：請執行一次 coin31_setup()（會更新〈遊戲參數〉並補上新參數）
//   5 正式版（〈遊戲參數〉正式版開始日，預設 2026-12-01）當天凌晨自動：
//     先發完前一天工時幣 → 封存測試期資料（隱藏分頁「封存_…」）→ 赤心幣歸零（流水帳留「正式版歸零」）
//     → 用幣買的東西、扭蛋、紀錄、徽章歸零（只留資歷徽章）→ 第一隻寵物保留（已孵化的從雛形期重新長）
//     → 發測試版創始夥伴禮包 → 工時從正式版開始日重新計算。取消原本的「餘額 ×2」。
//   6 「除錯大師」徽章：大隊長工具頒發，每次 +20 幣，每人最多 5 次
// 新參數全部放在〈遊戲參數〉，之後可直接改數字。
// ═════════════════════════════════════════════════════════════

var C31_PARAMS = [
  ['工時倍率上限', 6, 'v1.31：每小時工時幣的總倍率上限（階層 × 所有加倍事件相乘後）'],
  ['小店同店每日購買上限', 3, 'v1.31：同一位買家對同一家小店，每天最多買幾件'],
  ['小店月租', 30, 'v1.31：每月 1 日收上月攤位月租；只從上月營收扣，營收不夠就扣到 0'],
  ['小店抽成明細', '租金 50,水電 25,清潔 25', 'v1.31：成交抽成（100% − 店主分潤）在明細裡怎麼拆，數字是比例'],
  ['寵物市集價格範圍', '100-150,150-250,200-350,300-500,400-700', 'v1.31：蛋、雛形、嬰兒、兒童、完全體各自可掛賣的價格範圍'],
  ['寵物市集每月賣出上限', 1, 'v1.31：每人每月最多賣出幾隻（含掛賣中）'],
  ['寵物市集每月買進上限', 1, 'v1.31：每人每月最多買進幾隻'],
  ['創始夥伴禮包赤心幣', 100, 'v1.31：正式版開始時，測試期有上班的夥伴得到的赤心幣'],
  ['創始夥伴禮包扭蛋券', 3, 'v1.31：同上，扭蛋券張數'],
  ['創始夥伴加碼工時', 40, 'v1.31：測試期工時滿幾小時，扭蛋券再加碼'],
  ['創始夥伴加碼扭蛋券', 2, 'v1.31：加碼的扭蛋券張數'],
  ['除錯大師獎勵', 20, 'v1.31：每頒一次「除錯大師」給幾枚'],
  ['除錯大師上限', 5, 'v1.31：每人最多可以拿幾次「除錯大師」'],
  ['稱號工時起算', '正式版', 'v1.31：工時稱號的累計工時從哪裡算。正式版＝從正式版開始日；累計＝薪資系統的總累計工時']
];
var C31_CATALOG = [
  ['og_cap', 'OG 紅帽', 'hat', '傳說', 0, '限定', '', '測試版創始夥伴限定'],
  ['og_frame', '創始夥伴金框', 'frame', '傳說', 0, '限定', '', '測試版創始夥伴限定']
];
GM_BADGES.push(['og', '創始夥伴', '🏅', '參與 11/16～11/30 測試版（永不再發）', 0, false]);
GM_BADGES.push(['debugger', '除錯大師', '🛠️', '回報問題被大隊長採用', 20, true]);
C31_CATALOG.forEach(function (c) { if (typeof GM_CATALOG_SEED !== 'undefined') GM_CATALOG_SEED.push(c); });
(function () {
  if (typeof AV_ALLOWED === 'undefined') return;
  if (AV_ALLOWED.hat && AV_ALLOWED.hat.indexOf('og_cap') < 0) AV_ALLOWED.hat.push('og_cap');
  if (AV_ALLOWED.frame && AV_ALLOWED.frame.indexOf('og_frame') < 0) AV_ALLOWED.frame.push('og_frame');
})();
var C31_HOLIDAY = { spring: 1, holiday: 1, typhoon: 1, brand: 1 };
var C31_SET_HEAD = ['員工編號', '日期|櫃位', '已結算分鐘', '更新時間'];

// 安全（部署交接第 3 節規則）：花幣的動作，若有登入通行證就必須是本人
function c31_notMe_(emp) {
  var v = typeof au_verifiedId_ === 'function' ? au_verifiedId_() : '';
  return !!(v && v !== emp);
}
function c31_n_(k, d) { var v = Number(gm_param_(k)); return isFinite(v) && v > 0 ? v : d; }

// 執行一次：補上新參數、對戰每日獎勵上限改成 4
function coin31_setup() {
  var sh = gm_sh_('params'), rows = gm_rows_('params'), have = {};
  rows.forEach(function (r, i) { have[String(r[0]).trim()] = i + 2; });
  if (have['對戰每日獎勵上限']) sh.getRange(have['對戰每日獎勵上限'], 2).setValue(4);
  else sh.appendRow(['對戰每日獎勵上限', 4, 'v1.31：贏對戰每天最多拿幾枚']);
  // 取消「正式版餘額 ×2」，改成歸零＋禮包
  if (have['正式版加倍倍率']) sh.getRange(have['正式版加倍倍率'], 2, 1, 2).setValues([[1, 'v1.31：已取消（正式版改成歸零＋創始夥伴禮包）']]);
  else sh.appendRow(['正式版加倍倍率', 1, 'v1.31：已取消（正式版改成歸零＋創始夥伴禮包）']);
  if (!have['正式版開始日']) sh.appendRow(['正式版開始日', '2026-12-01', '']);
  // 商品目錄：OG 紅帽、創始夥伴金框（不上架）
  var cat = {}; gm_rows_('catalog').forEach(function (r) { cat[String(r[0]).trim()] = 1; });
  C31_CATALOG.forEach(function (c) { if (!cat[c[0]]) gm_sh_('catalog').appendRow(c); });
  C31_PARAMS.forEach(function (p) { if (!have[p[0]]) sh.appendRow(p); });
  c31_setSheet_();
  GM_CACHE_ = {};
  return '完成：對戰每日獎勵上限 = 4、取消正式版 ×2、新增參數 ' + C31_PARAMS.length + ' 項、商品目錄加 OG 紅帽與金框、〈工時幣結算〉表已建立。正式版開始日＝' + gm_param_('正式版開始日');
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
  c31_payHoursCore_(runDate);
  var off = String(gm_param_('正式版開始日') || '').trim();
  if (off && runDate >= off && gm_getState_('正式版已重置') !== off) c31_officialReset_(off);
}
function c31_payHoursCore_(runDate) {
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
  var since = gm_getState_('正式版重置時間');   // 正式版之後只算重置後發的工時幣
  gm_rows_('ledger').forEach(function (r) { if (r[2] === '工時' && (!since || String(r[0]) >= since)) paid[r[1]] = (paid[r[1]] || 0) + (Number(r[3]) || 0); });
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
  if (c31_notMe_(buyer)) return { error: '登入身分不符，請重新登入' };
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
  if (c31_notMe_(emp)) return { error: '登入身分不符，請重新登入' };
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
  if (c31_notMe_(emp)) return { error: '登入身分不符，請重新登入' };
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

// ── 5 正式版：封存、歸零、保留第一隻寵物、發創始夥伴禮包 ──
var C31_ARCHIVE = ['擁有物品', '扭蛋紀錄', '小遊戲紀錄', '團隊基金', '對戰裝備', '對戰紀錄', '即時對戰', '塔防投入',
  '小店', '小店交易', '我的花費', '裝備強化', '扭蛋券', '大魔王', '工時幣結算'];
var C31_KEEP_BADGES = { tenure_1: 1, tenure_2: 1, tenure_3: 1 };   // 資歷看薪資系統的真實累計工時，保留（清掉也會立刻再發）
function c31_archive_(ss, name, tag, clear) {
  var sh = ss.getSheetByName(name); if (!sh) return null;
  var arc = '封存_' + name + '_' + tag;
  if (!ss.getSheetByName(arc)) { var c = sh.copyTo(ss); c.setName(arc); c.hideSheet(); }
  if (clear && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
  return sh;
}
function c31_officialReset_(off) {
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    if (gm_getState_('正式版已重置') === off) return;
    var ss = gm_ss_(), tag = off.replace(/-/g, ''), now = gm_now_(), emps = gm_emps_();
    var testFrom = String(gm_param_('測試版開始日') || '');
    // 測試期參與者（上過班）與工時
    var mins = {};
    gm_rows_('hours').forEach(function (r) { var d = String(r[0]); if (d >= testFrom && d < off) mins[r[1]] = (mins[r[1]] || 0) + (Number(r[3]) || 0); });
    // 1 封存並清空
    c31_archive_(ss, '赤心幣流水帳', tag, false);
    c31_archive_(ss, '寵物', tag, false);
    c31_archive_(ss, '徽章紀錄', tag, false);
    C31_ARCHIVE.forEach(function (n) { c31_archive_(ss, n, tag, true); });
    var tw = ss.getSheetByName('塔防');   // 箭塔、砲塔、城牆、累計投入歸零，櫃位保留
    if (tw && tw.getLastRow() > 1) tw.getRange(2, 2, tw.getLastRow() - 1, 4).setValue(0);
    // 2 徽章：只留資歷
    var bs = gm_sh_('badges'), keep = gm_rows_('badges').filter(function (r) { return C31_KEEP_BADGES[r[1]]; });
    if (bs.getLastRow() > 1) bs.getRange(2, 1, bs.getLastRow() - 1, bs.getLastColumn()).clearContent();
    if (keep.length) bs.getRange(2, 1, keep.length, keep[0].length).setValues(keep);
    // 3 寵物市集：掛賣中的收回
    var mk = ss.getSheetByName('寵物市集');
    if (mk && mk.getLastRow() > 1) { var mv = mk.getRange(2, 5, mk.getLastRow() - 1, 1).getValues(); mv.forEach(function (r, i) { if (r[0] === '掛賣') mk.getRange(i + 2, 5).setValue('收回'); }); }
    // 4 寵物：每人保留第一隻（最早領養、還在身邊或隊伍的那隻），其他回收；成長從正式版重新算，已孵化的保底雛形期
    var hatchH = (GM_PET_STAGES[1] && GM_PET_STAGES[1][0]) || 40, rows = gm_rows_('pets'), first = {};
    rows.forEach(function (r, i) {
      var st = String(r[8] || '身邊') || '身邊'; if (['身邊', '隊伍', '掛賣'].indexOf(st) < 0) return;
      var k = String(r[0]); if (first[k] === undefined || String(r[3]) < String(rows[first[k]][3])) first[k] = i;
    });
    rows.forEach(function (r, i) {
      var st = String(r[8] || '身邊') || '身邊'; if (['身邊', '隊伍', '掛賣'].indexOf(st) < 0) return;
      if (first[String(r[0])] === i) {
        var rg = gm_sh_('pets').getRange(i + 2, 4, 1, 6); rg.setNumberFormat('@');
        rg.setValues([[off, '', String(r[7] ? hatchH : 0), '0', String(r[7] || ''), '身邊']]);   // 購買日期、配件、加成小時、遊戲加命、型態、狀態
      } else gm_petSet_(i + 2, 9, ['已售出']);
    });
    GM_CACHE_ = {};
    // 5 先把測試期最後一個月的月結（互動之星、冠軍櫃位、全勤…）跑完，一起歸零，避免算進正式版
    var pm = gm_prevMonth_(off.slice(0, 7));
    if (off.slice(8) === '01' && gm_getState_('已月結') !== pm) { try { gm_monthly_(pm); } catch (e) {} gm_setState_('已月結', pm); GM_CACHE_ = {}; }
    // 赤心幣歸零
    var bal = {}; gm_rows_('ledger').forEach(function (r) { bal[r[1]] = (bal[r[1]] || 0) + (Number(r[3]) || 0); });
    var zero = [];
    Object.keys(bal).forEach(function (id) { if (bal[id]) zero.push([now, id, '正式版歸零', -bal[id], '測試期結束，赤心幣歸零（原本 ' + bal[id] + ' 枚）', 'RESET|' + id + '|' + off]); });
    if (zero.length) gm_append_('ledger', zero);
    gm_setState_('正式版重置時間', now);
    gm_setState_('工時已結算到', gm_addDays_(off, -1));
    // 6 工時從正式版開始日重新計算
    var ps = gm_sh_('params'), pr = gm_rows_('params');
    for (var i = 0; i < pr.length; i++) if (String(pr[i][0]).trim() === '測試版開始日') { ps.getRange(i + 2, 2).setValue(off); break; }
    GM_CACHE_ = {};
    // 7 創始夥伴禮包
    var coin = c31_n_('創始夥伴禮包赤心幣', 100), tix = c31_n_('創始夥伴禮包扭蛋券', 3), bonusH = c31_n_('創始夥伴加碼工時', 40), bonusT = c31_n_('創始夥伴加碼扭蛋券', 2), n = 0;
    Object.keys(mins).forEach(function (id) {
      var e = emps[id]; if (!e || e.resigned || !(mins[id] > 0)) return;
      gm_award_(id, 'og', '');
      gm_credit_(id, '測試獎勵', coin, '測試版創始夥伴禮包', 'OGCOIN|' + id);
      var t = tix + (mins[id] >= bonusH * 60 ? bonusT : 0);
      gm_append_('s30tix', [[now, id, t, '測試版創始夥伴禮包' + (t > tix ? '（測試期滿 ' + bonusH + ' 小時加碼）' : ''), 'OGTIX|' + id]]);
      gm_append_('owned', [[id, 'og_cap', '創始夥伴', now], [id, 'og_frame', '創始夥伴', now]]);
      n++;
    });
    gm_setState_('正式版已重置', off);
    try { var a = ann_sheet_(); if (a) a.appendRow(['A' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss') + 'OG', '🎉 紅玉滿宇宙正式版開始！',
      '測試期的赤心幣已歸零，工時從今天重新累計。\n參與測試的 ' + n + ' 位創始夥伴已收到禮包：🏅 創始夥伴徽章、🪙 ' + coin + ' 赤心幣、🎰 扭蛋券、🎩 OG 紅帽、創始夥伴金框。謝謝大家！',
      '一般', '否', '系統', Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss'), gm_addDays_(off, 6)]); } catch (e) {}
  } finally { lock.releaseLock(); }
}

// ── 稱號工時：正式版之後從正式版開始日算（參數「稱號工時起算」＝累計 則用薪資系統總累計）──
// 原本的算法（薪資系統〈累計工時〉最新一個月＋之後的工時日結）。不能直接引用原函式：同名函式會被這裡的覆蓋取代
function c31_cumLife_(emp) {
  if (!GM_CACHE_.s30cum) {
    var cum = {}, cs = gm_ss_().getSheetByName('累計工時');
    if (cs && cs.getLastRow() > 1) cs.getRange(2, 1, cs.getLastRow() - 1, 7).getValues().forEach(function (r) {
      var id = String(r[0]).trim(); if (!id) return;
      var ym = r[2] instanceof Date ? Utilities.formatDate(r[2], 'Asia/Taipei', 'yyyy-MM') : String(r[2]).trim().replace('/', '-');
      if (!cum[id] || ym >= cum[id].ym) cum[id] = { ym: ym, h: Number(String(r[6]).replace(/[^\d.]/g, '')) || 0 };
    });
    GM_CACHE_.s30cum = cum;
  }
  var c = GM_CACHE_.s30cum[emp], h = c ? c.h : 0, after = c ? c.ym : '';
  gm_rows_('hours').forEach(function (r) { if (r[1] === emp && (!after || String(r[0]).slice(0, 7) > after)) h += (Number(r[3]) || 0) / 60; });
  return Math.floor(h);
}
function s30_cumHours_(emp) {
  var off = gm_getState_('正式版已重置');
  if (!off || String(gm_param_('稱號工時起算') || '正式版') === '累計') return c31_cumLife_(emp);
  return Math.floor(gm_minutesSince_(emp, off) / 60);
}

// ── 6 大隊長工具（覆蓋）：可頒「除錯大師」；身分以登入通行證本人為準 ──
function gm_admin_(p) {
  var vid = typeof au_verifiedId_ === 'function' ? au_verifiedId_() : '';
  if (vid && vid !== String(p.empId || '').trim()) return { error: '登入身分不符，請重新登入' };
  if (!vid) return { error: '請更新 App 後重新登入' };   // v4（部署端）：大隊長工具一律要有效登入通行證（記錄模式下不能只靠員工編號）
  var me = gm_emp_(vid); if (!gm_isTop_(me)) return { error: '只有大隊長(第 5 級)與總經理(第 4 級)可以使用' };
  var target = String(p.target || '').trim(), reason = String(p.reason || '').trim().slice(0, 100);
  if (!gm_emp_(target)) return { error: '找不到員工編號 ' + target };
  if (!reason) return { error: '請填寫理由' };
  if (p.badge) {
    if (['mentor', 'special', 'debugger'].indexOf(p.badge) < 0) return { error: '只能手動頒發「好導師」「特別貢獻」「除錯大師」' };
    var amt = p.amount != null && p.amount !== '' ? Number(p.amount) : null, got = 0;
    if (p.badge === 'debugger') {
      var lim = c31_n_('除錯大師上限', 5); got = gm_rows_('badges').filter(function (r) { return r[0] === target && r[1] === 'debugger'; }).length;
      if (got >= lim) return { error: '這位夥伴的「除錯大師」已經拿滿 ' + lim + ' 次' };
      amt = c31_n_('除錯大師獎勵', 20);
    }
    var period = gm_now_();
    if (p.badge === 'debugger') period = '第 ' + (got + 1) + ' 次';   // 每次都不同，避免同一秒按兩次被當成重複
    var ok = gm_award_(target, p.badge, period, amt);
    gm_append_('ledger', [[gm_now_(), target, '管理紀錄', 0, me.name + ' 頒發徽章 ' + p.badge + ':' + reason, '']]);
    return ok ? { success: true } : { error: '頒發失敗' };
  }
  var n = Math.round(Number(p.amount) || 0); if (!n) return { error: '請輸入數量' };
  gm_credit_(target, '管理調整', n, me.name + ':' + reason, 'ADMIN|' + target + '|' + gm_now_() + '|' + Math.random());
  return { success: true, data: { balance: gm_balance_(target) } };
}
