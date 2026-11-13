// ═══════════════════════════════════════════════
// v1.30 赤心幣新花費（2026-11-13）
// 貼在「內帳 v1.29」之後、「路由v1.30」之前。部署後執行一次 s30_setup()
// 1. 我的座位：宇宙「夥伴座位區」，開通 100（附基本木桌椅）；桌子、椅子、擺飾（最多 3 個）、寵物小窩另購
// 2. 進場特效：煙火、彩虹、星星雨、騎小暴龍；打卡上班時播放
// 3. 稱號：翻模達人、雞蛋糕職人依累計工時解鎖；其他稱號用幣買
// 4. 寵物進階：特殊顏色（櫻花、星空、金色，買一次可套在自己任何一隻寵物）、寵物小窩
// 5. 裝備強化：武器、防具 +1～+5，失敗只扣幣、裝備不會壞
// 6. 季節扭蛋：限期機台，一次 100，不算每月 5 次；扭蛋券兩台都能用
// 7. 全員大魔王：每月一隻，全員投幣攻擊；打倒後依投入排名送扭蛋券；月底沒打倒，有參加的人 1 張
// 8. 和隊長吃飯：2,000 枚，每月 1 名，先申請先得；大隊長約時間、完成；取消退幣
// 9. （追加）管理者幫夥伴重設密碼：重設成生日 4 碼，夥伴下次登入一定要先改密碼
// 覆蓋：gm_gacha_（季節機台、扭蛋券）、pv_fighter_（強化數值）
// 所有價格、門檻、機率都在〈遊戲參數〉或〈商品目錄〉，可以直接改
// ═══════════════════════════════════════════════

var S30_PARAMS = [
  ['座位擺飾上限', 3, '桌上最多擺幾個擺飾'],
  ['稱號門檻_翻模達人', 500, '累計工時（小時）達到就解鎖'],
  ['稱號門檻_雞蛋糕職人', 1500, '累計工時（小時）達到就解鎖'],
  ['強化費用', '20,40,80,120,200', '+1～+5 每次嘗試的費用'],
  ['強化成功率', '100,90,75,60,45', '+1～+5 的成功率（百分比）；失敗只扣幣，裝備不會壞'],
  ['強化加成_武器', 'atk:1', '武器每 +1 的加成'],
  ['強化加成_防具', 'def:1,hp:3', '防具每 +1 的加成'],
  ['季節扭蛋價格', 100, ''],
  ['季節扭蛋期間', '聖誕系列:12-01:12-31,新春系列:01-25:02-21', '系列:開始MM-DD:結束MM-DD，逗號分隔'],
  ['大魔王血量', 3000, '每月一隻，全員投入的赤心幣＝傷害'],
  ['大魔王最低投入', 10, '一次至少幾枚'],
  ['大魔王名單', '燒焦怪,麵糊黏黏怪,停電魔王,排隊大暴龍,漏氣烤盤怪,打翻糖漿怪', '依月份輪流'],
  ['大魔王獎勵', '1:5,3:3,10:2,99999:1', '排名上限:扭蛋券張數（第 1 名 5 張、2～3 名 3 張、4～10 名 2 張、其他 1 張）'],
  ['大魔王安慰券', 1, '月底沒打倒，有參加的人每人幾張'],
  ['和隊長吃飯價格', 2000, ''],
  ['和隊長吃飯每月名額', 1, '']
];
S30_PARAMS.forEach(function (p) { GM_PARAM_DEFAULTS.push(p); });

// 物品編號, 名稱, 分類, 等級, 價格, 上架, 系列, 說明
var S30_CATALOG = [
  ['seat_basic', '開通我的座位', 'seat', '普通', 100, '花費', '', '附基本木桌、木椅'],
  ['desk_white', '白色簡約桌', 'desk', '普通', 80, '花費', '', ''],
  ['desk_game', '電競桌', 'desk', '稀有', 200, '花費', '', ''],
  ['desk_boss', '紅玉主管桌', 'desk', '傳說', 400, '花費', '', ''],
  ['chair_bean', '懶骨頭', 'chair', '普通', 60, '花費', '', ''],
  ['chair_game', '電競椅', 'chair', '稀有', 150, '花費', '', ''],
  ['chair_throne', '紅玉皇座', 'chair', '傳說', 300, '花費', '', ''],
  ['deco_plant', '小盆栽', 'deco', '普通', 50, '花費', '', '🪴'],
  ['deco_frame', '相框', 'deco', '普通', 50, '花費', '', '🖼️'],
  ['deco_globe', '地球儀', 'deco', '普通', 100, '花費', '', '🌍'],
  ['deco_figure', '雞蛋糕公仔', 'deco', '稀有', 120, '花費', '', '🧸'],
  ['deco_trex', '小暴龍玩偶', 'deco', '稀有', 150, '花費', '', '🦖'],
  ['deco_trophy', '獎盃', 'deco', '稀有', 200, '花費', '', '🏆'],
  ['deco_oven', '迷你金烤爐', 'deco', '傳說', 500, '花費', '', '✨'],
  ['fx_firework', '煙火進場', 'entry', '普通', 100, '花費', '', '🎆'],
  ['fx_rainbow', '彩虹進場', 'entry', '稀有', 150, '花費', '', '🌈'],
  ['fx_stars', '星星雨進場', 'entry', '稀有', 200, '花費', '', '🌠'],
  ['fx_trex', '騎小暴龍進場', 'entry', '傳說', 300, '花費', '', '🦖'],
  ['t_mold', '翻模達人', 'title', '稀有', 0, '工時', '', '稱號門檻_翻模達人'],
  ['t_master', '雞蛋糕職人', 'title', '傳說', 0, '工時', '', '稱號門檻_雞蛋糕職人'],
  ['t_star', '赤心之星', 'title', '普通', 50, '花費', '', ''],
  ['t_travel', '宇宙旅人', 'title', '普通', 100, '花費', '', ''],
  ['t_magic', '甜點魔法師', 'title', '稀有', 150, '花費', '', ''],
  ['t_legend', '傳說烤手', 'title', '傳說', 200, '花費', '', ''],
  ['skin_sakura', '櫻花色寵物', 'petskin', '稀有', 200, '花費', '', '櫻花'],
  ['skin_galaxy', '星空色寵物', 'petskin', '稀有', 250, '花費', '', '星空'],
  ['skin_gold', '金色寵物', 'petskin', '傳說', 300, '花費', '', '金色'],
  ['den_cushion', '寵物軟墊', 'petden', '普通', 100, '花費', '', ''],
  ['den_house', '寵物木屋', 'petden', '稀有', 200, '花費', '', ''],
  ['den_castle', '寵物城堡', 'petden', '傳說', 300, '花費', '', ''],
  // 季節扭蛋（只有期間內的機台開得到）
  ['x_antler', '麋鹿角', 'hat', '普通', 0, '季節扭蛋', '聖誕系列', ''],
  ['x_bell', '鈴鐺項圈', 'acc', '普通', 0, '季節扭蛋', '聖誕系列', ''],
  ['x_scarf', '聖誕圍巾', 'acc', '普通', 0, '季節扭蛋', '聖誕系列', ''],
  ['x_tree', '聖誕樹頭飾', 'hat', '稀有', 0, '季節扭蛋', '聖誕系列', ''],
  ['x_gift', '禮物背包', 'acc', '稀有', 0, '季節扭蛋', '聖誕系列', ''],
  ['x_snowman', '雪人裝', 'outfit', '稀有', 0, '季節扭蛋', '聖誕系列', ''],
  ['x_santa', '聖誕老人裝', 'outfit', '傳說', 0, '季節扭蛋', '聖誕系列', ''],
  ['x_frame', '雪花名牌框', 'frame', '傳說', 0, '季節扭蛋', '聖誕系列', ''],
  ['c_fu', '福字胸章', 'acc', '普通', 0, '季節扭蛋', '新春系列', ''],
  ['c_lantern', '小燈籠', 'acc', '普通', 0, '季節扭蛋', '新春系列', ''],
  ['c_ingot', '元寶頭飾', 'hat', '普通', 0, '季節扭蛋', '新春系列', ''],
  ['c_redpack', '紅包背包', 'acc', '稀有', 0, '季節扭蛋', '新春系列', ''],
  ['c_lion', '舞獅頭', 'hat', '稀有', 0, '季節扭蛋', '新春系列', ''],
  ['c_tang', '紅色唐裝', 'outfit', '稀有', 0, '季節扭蛋', '新春系列', ''],
  ['c_dragon', '金龍披風', 'acc', '傳說', 0, '季節扭蛋', '新春系列', ''],
  ['c_frame', '金色春聯框', 'frame', '傳說', 0, '季節扭蛋', '新春系列', '']
];
S30_CATALOG.forEach(function (c) { GM_CATALOG_SEED.push(c); });
// 紙娃娃可以穿季節扭蛋的新款
(function () {
  if (typeof AV_ALLOWED === 'undefined') return;
  S30_CATALOG.forEach(function (c) { var k = c[2]; if (c[5] === '季節扭蛋' && AV_ALLOWED[k] && AV_ALLOWED[k].indexOf(c[0]) < 0) AV_ALLOWED[k].push(c[0]); });
})();
GM_BADGES.push(['s30_boss', '魔王剋星', '⚔️', '全員大魔王投入第 1 名', 0, true]);
GM_BADGES.push(['s30_season', '季節收藏家', '🎄', '季節扭蛋系列收集完成', 50, true]);
GM_BADGES.push(['s30_meal', '和隊長吃過飯', '🍽️', '和隊長吃飯', 0, true]);

GM_SHEETS.s30me = ['我的花費', ['員工編號', '稱號', '進場特效', '座位', '寵物造型', '更新時間']];
GM_SHEETS.s30enh = ['裝備強化', ['員工編號', '物品編號', '等級', '更新時間']];
GM_SHEETS.s30tix = ['扭蛋券', ['時間', '員工編號', '數量', '說明', '來源鍵']];
GM_SHEETS.s30boss = ['大魔王', ['月份', '員工編號', '投入', '時間']];
GM_SHEETS.s30meal = ['和隊長吃飯', ['編號', '月份', '員工編號', '申請時間', '狀態', '約定日期', '備註', '處理時間']];

function s30_n_(k, d) { var v = Number(gm_param_(k)); return isFinite(v) && v > 0 ? v : d; }
function s30_list_(k, d) { return String(gm_param_(k) || d).split(',').map(function (x) { return Number(x); }); }
function s30_emp_(p) {
  var emp = String(p.empId || '').trim(), e = gm_emp_(emp);
  if (!e || e.resigned) throw new Error('帳號無法使用');
  return { id: emp, e: e };
}
function s30_name_(id) { var e = gm_emp_(id); return e ? (e.nick || e.name) : id; }

// ── 個人設定（稱號、特效、座位、寵物造型）──
function s30_meRow_(emp) {
  var rows = gm_rows_('s30me');
  for (var i = 0; i < rows.length; i++) if (rows[i][0] === emp) {
    var r = rows[i], j = function (v, d) { try { return v ? JSON.parse(v) : d; } catch (e) { return d; } };
    return { row: i + 2, title: String(r[1] || ''), fx: String(r[2] || ''), seat: j(r[3], null), skins: j(r[4], {}) };
  }
  return { row: 0, title: '', fx: '', seat: null, skins: {} };
}
function s30_meSave_(emp, m) {
  var v = [emp, m.title || '', m.fx || '', m.seat ? JSON.stringify(m.seat) : '', JSON.stringify(m.skins || {}), gm_now_()];
  if (m.row) { var rng = gm_sh_('s30me').getRange(m.row, 1, 1, 6); rng.setNumberFormat('@'); rng.setValues([v]); GM_CACHE_.rows_s30me = null; }
  else gm_append_('s30me', [v]);
}

// 累計工時（小時）：〈累計工時〉最新一個月的「累計工時總計」，加上之後〈工時日結〉的分鐘
function s30_cumHours_(emp) {
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
function s30_titleOK_(emp, id, own) {
  var c = gm_catalog_()[id]; if (!c || c.cat !== 'title') return false;
  if (c.where === '工時') return s30_cumHours_(emp) >= s30_n_(c.note, 99999);
  return !!(own || gm_owned_(emp))[id];
}

function s30_buy_(p) {
  var me = s30_emp_(p), item = String(p.item || '').trim(), c = gm_catalog_()[item];
  if (!c || c.where !== '花費') return { error: '這個項目目前沒有販售' };
  var own = gm_owned_(me.id); if (own[item]) return { error: '已經擁有了' };
  if (/^(desk|chair|deco|petden)$/.test(c.cat) && !own.seat_basic) return { error: '要先開通我的座位' };
  if (gm_balance_(me.id) < c.price) return { error: '赤心幣不足' };
  gm_credit_(me.id, '購買', -c.price, '購買「' + c.name + '」', 'BUY|' + me.id + '|' + item);
  gm_append_('owned', [[me.id, item, '購買', gm_now_()]]);
  var m = s30_meRow_(me.id);       // 買了就直接換上（開通座位＝基本桌椅）
  if (c.cat === 'seat') m.seat = { desk: '', chair: '', deco: [], den: '' };
  else if (c.cat === 'entry') m.fx = item;
  else if (c.cat === 'title') m.title = item;
  else if (m.seat && (c.cat === 'desk' || c.cat === 'chair' || c.cat === 'petden')) m.seat[c.cat === 'petden' ? 'den' : c.cat] = item;
  else if (m.seat && c.cat === 'deco' && m.seat.deco.length < s30_n_('座位擺飾上限', 3)) m.seat.deco.push(item);
  s30_meSave_(me.id, m);
  return { success: true, data: s30_me_(p).data };
}
// 換穿：title / fx / desk / chair / den / deco（陣列）/ skin（pet＋skin，空白＝原色）
function s30_set_(p) {
  var me = s30_emp_(p), own = gm_owned_(me.id), cat = gm_catalog_(), m = s30_meRow_(me.id);
  var ok = function (id, k) { return !id || (own[id] && cat[id] && cat[id].cat === k); };
  if (p.title != null) { var t = String(p.title); if (t && !s30_titleOK_(me.id, t, own)) return { error: '還沒有這個稱號' }; m.title = t; }
  if (p.fx != null) { if (!ok(String(p.fx), 'entry')) return { error: '還沒有這個特效' }; m.fx = String(p.fx); }
  if (p.desk != null || p.chair != null || p.den != null || p.deco != null) {
    if (!m.seat) return { error: '要先開通我的座位' };
    if (p.desk != null) { if (!ok(String(p.desk), 'desk')) return { error: '還沒有這張桌子' }; m.seat.desk = String(p.desk); }
    if (p.chair != null) { if (!ok(String(p.chair), 'chair')) return { error: '還沒有這張椅子' }; m.seat.chair = String(p.chair); }
    if (p.den != null) { if (!ok(String(p.den), 'petden')) return { error: '還沒有這個小窩' }; m.seat.den = String(p.den); }
    if (p.deco != null) {
      var d = typeof p.deco === 'string' ? (p.deco ? (p.deco.charAt(0) === '[' ? JSON.parse(p.deco) : p.deco.split(',')) : []) : p.deco;
      d = d.filter(function (x, i) { return x && d.indexOf(x) === i; });
      if (d.length > s30_n_('座位擺飾上限', 3)) return { error: '最多擺 ' + s30_n_('座位擺飾上限', 3) + ' 個' };
      if (!d.every(function (x) { return ok(x, 'deco'); })) return { error: '還沒有這個擺飾' };
      m.seat.deco = d;
    }
  }
  if (p.pet != null) {
    var pet = String(p.pet), skin = String(p.skin || '');
    var mine = gm_rows_('pets').some(function (r) { return r[0] === me.id && String(r[9]) === pet && /^(身邊|隊伍|掛賣)$/.test(String(r[8] || '身邊') || '身邊'); });
    if (!mine) return { error: '找不到這隻寵物' };
    if (skin && !ok(skin, 'petskin')) return { error: '還沒有這個顏色' };
    if (skin) m.skins[pet] = skin; else delete m.skins[pet];
  }
  s30_meSave_(me.id, m);
  return { success: true, data: s30_me_(p).data };
}

// ── 裝備強化 ──
function s30_enhMap_(emp) { var o = {}; gm_rows_('s30enh').forEach(function (r) { if (r[0] === emp) o[r[1]] = Number(r[2]) || 0; }); return o; }
function s30_enhBonus_(cat, lv) {
  var o = {}; if (!lv) return o;
  String(gm_param_(cat === 'weapon' ? '強化加成_武器' : '強化加成_防具') || '').split(',').forEach(function (x) { var a = x.split(':'); if (a[0]) o[a[0].trim()] = (Number(a[1]) || 0) * lv; });
  return o;
}
function s30_enhance_(p) {
  var me = s30_emp_(p), item = String(p.item || ''), c = gm_catalog_()[item];
  if (!c || (c.cat !== 'weapon' && c.cat !== 'armor')) return { error: '只有武器和防具可以強化' };
  if (!gm_owned_(me.id)[item]) return { error: '還沒擁有這件裝備' };
  var cur = s30_enhMap_(me.id)[item] || 0; if (cur >= 5) return { error: '已經強化到 +5 了' };
  var cost = s30_list_('強化費用', '20,40,80,120,200')[cur] || 200, rate = s30_list_('強化成功率', '100,90,75,60,45')[cur];
  if (!isFinite(rate)) rate = 50;
  if (gm_balance_(me.id) < cost) return { error: '赤心幣不足' };
  var ok = (p._roll != null ? Number(p._roll) : Math.random() * 100) < rate;
  gm_credit_(me.id, '裝備強化', -cost, '強化「' + c.name + '」+' + (cur + 1) + (ok ? ' 成功' : ' 失敗'), 'ENH|' + me.id + '|' + item + '|' + Date.now() + Math.random());
  if (ok) {
    var rows = gm_rows_('s30enh'), at = 0;
    for (var i = 0; i < rows.length; i++) if (rows[i][0] === me.id && rows[i][1] === item) at = i + 2;
    if (at) { var rng = gm_sh_('s30enh').getRange(at, 3, 1, 2); rng.setNumberFormat('@'); rng.setValues([[String(cur + 1), gm_now_()]]); GM_CACHE_.rows_s30enh = null; }
    else gm_append_('s30enh', [[me.id, item, cur + 1, gm_now_()]]);
  }
  return { success: true, ok: ok, level: ok ? cur + 1 : cur, cost: cost, rate: rate, balance: gm_balance_(me.id) };
}
// 覆蓋：對戰數值加上強化
function pv_fighter_(emp) {
  var e = gm_emp_(emp); if (!e) return null;
  var q = pv_equipRow_(emp), own = gm_owned_(emp), st = { hp: PV_BASE.hp, atk: PV_BASE.atk, def: PV_BASE.def, spd: PV_BASE.spd }, enh = s30_enhMap_(emp), cat = gm_catalog_();
  [q.weapon, q.armor].forEach(function (id) {
    if (!id || !own[id]) return;
    var s = pv_stats_(id); Object.keys(s).forEach(function (k) { if (st[k] != null) st[k] += s[k]; });
    var b = s30_enhBonus_(cat[id] ? cat[id].cat : '', enh[id] || 0); Object.keys(b).forEach(function (k) { if (st[k] != null) st[k] += b[k]; });
  });
  var pet = gm_pet_(emp); if (pet) st.hp += pet.stage * 4;
  st.crit = 0;
  if (pet && pet.type && PV_PET_ATTR[pet.type]) {
    var at = PV_PET_ATTR[pet.type], pct = [0, 0, 0.25, 0.5, 0.75, 1][pet.stage] || 0;
    st[at.stat] += at.stat === 'crit' ? at.val * pct : Math.round(at.val * pct);
  }
  var cards = q.cards.filter(function (c) { return own[c]; }).slice(0, 3).map(function (c) { var s = pv_stats_(c); return { id: c, name: cat[c].name, kind: s.card, val: s.val }; });
  var nm = function (id) { return id && own[id] ? cat[id].name + (enh[id] ? ' +' + enh[id] : '') : ''; };
  return { id: emp, name: e.nick || e.name, stats: st, weapon: nm(q.weapon), armor: nm(q.armor), cards: cards, join: q.join, pet: pet ? pet.stage : 0,
           petType: pet && pet.type ? pet.type : '', petTypeName: pet && pet.type ? pet.typeName : '' };
}

// ── 扭蛋券 ──
function s30_tickets_(emp) { var n = 0; gm_rows_('s30tix').forEach(function (r) { if (r[1] === emp) n += Number(r[2]) || 0; }); return n; }
function s30_tixAdd_(emp, n, note, key) {
  if (!n) return false;
  if (key && gm_rows_('s30tix').some(function (r) { return r[4] === key; })) return false;
  gm_append_('s30tix', [[gm_now_(), emp, n, note, key || '']]); return true;
}
// 目前開放的季節機台
function s30_season_(today) {
  var md = String(today || gm_today_()).slice(5, 10), out = null;
  String(gm_param_('季節扭蛋期間') || '').split(',').forEach(function (x) {
    var a = x.split(':'); if (a.length < 3 || out) return;
    var f = a[1].trim(), t = a[2].trim(), inR = f <= t ? md >= f && md <= t : md >= f || md <= t;
    if (inR) out = { series: a[0].trim(), from: f, to: t };
  });
  return out;
}
function s30_seasonList_() {
  return String(gm_param_('季節扭蛋期間') || '').split(',').map(function (x) { var a = x.split(':'); return a.length >= 3 ? { series: a[0].trim(), from: a[1].trim(), to: a[2].trim() } : null; }).filter(Boolean);
}
// 覆蓋：扭蛋（machine＝season 季節機台；ticket＝用扭蛋券，不扣幣、不算每月次數）
function gm_gacha_(p) {
  var emp = String(p.empId || '').trim(), e = gm_emp_(emp);
  if (!e || e.resigned) return { error: '帳號無法使用' };
  var season = String(p.machine || '') === 'season', useTix = !!p.ticket && String(p.ticket) !== 'false', sea = null;
  if (season) { sea = s30_season_(); if (!sea) return { error: '季節扭蛋現在沒有開放' }; }
  var price = season ? s30_n_('季節扭蛋價格', 100) : (Number(gm_param_('扭蛋價格')) || 50), ym = gm_today_().slice(0, 7), mine = [];
  gm_rows_('gacha').forEach(function (r) { if (r[1] === emp) mine.push(r); });
  var limit = Number(gm_param_('扭蛋每月上限')) || 5;
  var thisMonth = mine.filter(function (r) { return String(r[0]).slice(0, 7) === ym && !/^(季節|券)/.test(String(r[5] || '')); }).length;
  if (useTix) { if (s30_tickets_(emp) < 1) return { error: '沒有扭蛋券' }; }
  else {
    if (!season && thisMonth >= limit) return { error: '本月扭蛋次數已用完' };
    if (gm_balance_(emp) < price) return { error: '赤心幣不足' };
  }
  var cat = gm_catalog_(), pool = { '普通': [], '稀有': [], '傳說': [] };
  Object.keys(cat).forEach(function (k) { var c = cat[k]; if ((season ? c.where === '季節扭蛋' && c.series === sea.series : c.where === '扭蛋') && pool[c.tier]) pool[c.tier].push(c); });
  var streak = 0; for (var i = mine.length - 1; i >= 0 && String(mine[i][3]) === '普通'; i--) streak++;
  var pity = Number(gm_param_('扭蛋保底次數')) || 10, roll = p._roll != null ? Number(p._roll) : Math.random() * 100;
  var leg = Number(gm_param_('扭蛋機率_傳說')) || 5, rare = Number(gm_param_('扭蛋機率_稀有')) || 25;
  var tier = roll < leg ? '傳說' : roll < leg + rare ? '稀有' : '普通';
  if (tier === '普通' && streak + 1 >= pity) tier = Math.random() * (leg + rare) < leg ? '傳說' : '稀有';
  if (!pool[tier].length) tier = pool['普通'].length ? '普通' : pool['稀有'].length ? '稀有' : '傳說';
  var got = pool[tier][Math.floor(Math.random() * pool[tier].length)];
  if (!got) return { error: '扭蛋機目前沒有商品' };
  var dup = !!gm_owned_(emp)[got.id], refund = dup ? Number(gm_param_('扭蛋重複退幣')) || 0 : 0, n = mine.length + 1;
  var label = (useTix ? '券' : '') + (season ? '季節' : '');
  if (useTix) s30_tixAdd_(emp, -1, '用扭蛋券轉' + (season ? sea.series : '扭蛋'), 'TIXUSE|' + emp + '|' + n);
  else gm_credit_(emp, '扭蛋', -price, (season ? sea.series + '扭蛋' : '扭蛋') + '第 ' + n + ' 次', 'GACHA|' + emp + '|' + n);
  if (dup) gm_credit_(emp, '扭蛋退幣', refund, '重複「' + got.name + '」分解', 'GREF|' + emp + '|' + n);
  else gm_append_('owned', [[emp, got.id, season ? '季節扭蛋' : '扭蛋', gm_now_()]]);
  gm_append_('gacha', [[gm_now_(), emp, got.id, tier, refund, label]]);
  if (!dup && got.series) {
    var own = gm_owned_(emp), all = Object.keys(cat).filter(function (k) { return cat[k].series === got.series && cat[k].where === got.where; });
    if (all.every(function (k) { return own[k]; })) gm_award_(emp, season ? 's30_season' : 'collector', got.series);
  }
  gm_checkSocialBadges_(emp);
  return { success: true, data: { item: got, tier: tier, duplicate: dup, refund: refund, balance: gm_balance_(emp), tickets: s30_tickets_(emp),
    left: Math.max(0, limit - thisMonth - (useTix || season ? 0 : 1)), machine: season ? sea.series : '' } };
}
GM_SHEETS.gacha = ['扭蛋紀錄', ['時間', '員工編號', '物品編號', '等級', '重複退幣', '機台']];

// ── 全員大魔王 ──
function s30_bossOf_(ym) {
  var names = String(gm_param_('大魔王名單') || '燒焦怪').split(',').map(function (x) { return x.trim(); }).filter(String);
  var idx = (Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1) % names.length;
  return { ym: ym, name: names[idx], hp: s30_n_('大魔王血量', 3000) };
}
function s30_bossState_(ym) {
  var by = {}, dmg = 0, killed = gm_getState_('大魔王打倒_' + ym);
  gm_rows_('s30boss').forEach(function (r) { if (String(r[0]) === ym) { by[r[1]] = (by[r[1]] || 0) + (Number(r[2]) || 0); dmg += Number(r[2]) || 0; } });
  var rank = Object.keys(by).map(function (id) { return { id: id, name: s30_name_(id), coins: by[id] }; }).sort(function (a, b) { return b.coins - a.coins; });
  var b = s30_bossOf_(ym);
  return { ym: ym, name: b.name, hp: b.hp, dmg: Math.min(dmg, b.hp), left: Math.max(0, b.hp - dmg), killed: killed, rank: rank, settled: gm_getState_('大魔王結算_' + ym) };
}
function s30_bossReward_(rank) {   // 第幾名 → 幾張
  var rules = String(gm_param_('大魔王獎勵') || '1:5,3:3,10:2,99999:1').split(',').map(function (x) { var a = x.split(':'); return [Number(a[0]), Number(a[1])]; });
  for (var i = 0; i < rules.length; i++) if (rank <= rules[i][0]) return rules[i][1];
  return 0;
}
function s30_bossSettle_(ym, defeated) {
  if (gm_getState_('大魔王結算_' + ym)) return;
  var st = s30_bossState_(ym); if (!st.rank.length) { gm_setState_('大魔王結算_' + ym, '無人參加'); return; }
  st.rank.forEach(function (x, i) {
    var n = defeated ? s30_bossReward_(i + 1) : s30_n_('大魔王安慰券', 1);
    s30_tixAdd_(x.id, n, ym + ' 大魔王「' + st.name + '」' + (defeated ? '第 ' + (i + 1) + ' 名' : '參加獎'), 'BOSS|' + ym + '|' + x.id);
  });
  if (defeated) gm_award_(st.rank[0].id, 's30_boss', ym);
  gm_setState_('大魔王結算_' + ym, defeated ? '打倒' : '逃走');
}
function s30_bossCatchUp_() {     // 上個月沒結算的 → 魔王逃走，發安慰券
  var prev = gm_prevMonth_(gm_today_().slice(0, 7));
  if (!gm_getState_('大魔王結算_' + prev) && gm_rows_('s30boss').some(function (r) { return String(r[0]) === prev; })) s30_bossSettle_(prev, false);
}
function s30_bossHit_(p) {
  var me = s30_emp_(p), ym = gm_today_().slice(0, 7), n = Math.floor(Number(p.coins) || 0), min = s30_n_('大魔王最低投入', 10);
  if (n < min) return { error: '一次至少投入 ' + min + ' 枚' };
  var st = s30_bossState_(ym); if (st.killed) return { error: '這個月的魔王已經被打倒了' };
  n = Math.min(n, st.left);
  if (gm_balance_(me.id) < n) return { error: '赤心幣不足' };
  gm_credit_(me.id, '大魔王', -n, ym + ' 攻擊大魔王「' + st.name + '」', 'BOSSHIT|' + me.id + '|' + Date.now() + Math.random());
  gm_append_('s30boss', [[ym, me.id, n, gm_now_()]]);
  var after = s30_bossState_(ym), killed = false;
  if (after.left <= 0) {
    gm_setState_('大魔王打倒_' + ym, gm_now_()); killed = true;
    s30_bossSettle_(ym, true);
    try { gm_petEvent_(me.id, 'boss', '⚔️ 全員合力打倒了大魔王「' + after.name + '」！最後一擊：' + s30_name_(me.id)); } catch (e) {}
    try { if (typeof line_notify_ === 'function') line_notify_('公告', '⚔️ 全員合力打倒了本月大魔王「' + after.name + '」！\n' + after.rank.slice(0, 3).map(function (x, i) { return ['🥇', '🥈', '🥉'][i] + ' ' + x.name + ' ' + x.coins + ' 枚'; }).join('\n') + '\n扭蛋券已發放，到樂園 → 花費 → 扭蛋使用。'); } catch (e) {}
  }
  return { success: true, hit: n, killed: killed, data: s30_me_(p).data };
}

// ── 和隊長吃飯 ──
function s30_meals_() {
  return gm_rows_('s30meal').map(function (r, i) { return { row: i + 2, id: String(r[0]), ym: String(r[1]), emp: String(r[2]), name: s30_name_(String(r[2])), at: String(r[3]), status: String(r[4]), date: String(r[5] || ''), note: String(r[6] || '') }; });
}
function s30_mealApply_(p) {
  var me = s30_emp_(p), ym = gm_today_().slice(0, 7), price = s30_n_('和隊長吃飯價格', 2000);
  if (me.e.role >= 5) return { error: '大隊長不用申請' };
  var live = s30_meals_().filter(function (m) { return m.ym === ym && m.status !== '已取消'; });
  if (live.some(function (m) { return m.emp === me.id; })) return { error: '你這個月已經申請了' };
  if (live.length >= s30_n_('和隊長吃飯每月名額', 1)) return { error: '這個月的名額已經滿了，下個月再來' };
  if (gm_balance_(me.id) < price) return { error: '赤心幣不足' };
  var id = 'M' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
  gm_credit_(me.id, '和隊長吃飯', -price, ym + ' 和隊長吃飯', 'MEAL|' + id);
  gm_append_('s30meal', [[id, ym, me.id, gm_now_(), '已申請', '', String(p.note || '').slice(0, 100), '']]);
  try { gm_petEvent_(me.id, 'meal', '🍽️ ' + s30_name_(me.id) + ' 用赤心幣換到了這個月和隊長吃飯！'); } catch (e) {}
  return { success: true, data: s30_me_(p).data };
}
// 大隊長：約時間（date）、完成、取消（退幣）；夥伴自己在「已申請」時可以取消
function s30_mealSet_(p) {
  var me = s30_emp_(p), m = s30_meals_().filter(function (x) { return x.id === String(p.id); })[0];
  if (!m) return { error: '找不到這筆申請' };
  var boss = me.e.role >= 5, st = String(p.status || '');
  if (!boss && !(m.emp === me.id && st === '已取消' && m.status === '已申請')) return { error: '只有大隊長可以處理' };
  if (m.status === '已取消' || m.status === '已完成') return { error: '這筆已經' + m.status.slice(1) };
  var sh = gm_sh_('s30meal');
  if (st === '已取消') {
    gm_credit_(m.emp, '和隊長吃飯退幣', s30_n_('和隊長吃飯價格', 2000), m.ym + ' 和隊長吃飯取消退回', 'MEALBACK|' + m.id);
  } else if (st === '已完成') { gm_award_(m.emp, 's30_meal', m.ym); }
  else if (st === '已約好') { if (!/^\d{4}-\d{2}-\d{2}/.test(String(p.date || ''))) return { error: '請選日期' }; }
  else return { error: '狀態不對' };
  var rng = sh.getRange(m.row, 5, 1, 4); rng.setNumberFormat('@');
  rng.setValues([[st, st === '已約好' ? String(p.date).slice(0, 16) : m.date, p.note != null ? String(p.note).slice(0, 100) : m.note, gm_now_()]]);
  GM_CACHE_.rows_s30meal = null;
  if (st === '已約好' && boss) {   // 寫進大隊長個人行事曆（有設定的話）
    try { var cal = typeof cal_personal_ === 'function' ? cal_personal_() : null; if (cal) { var d = new Date(String(p.date).slice(0, 10) + 'T' + (String(p.date).slice(11, 16) || '12:00') + ':00+08:00'); cal.createEvent('和 ' + m.name + ' 吃飯（赤心幣）', d, new Date(d.getTime() + 90 * 60000), { description: '分類：其他' }); } } catch (e) {}
  }
  return { success: true, data: s30_me_(p).data };
}

// ── 給前端：我的花費頁 ──
function s30_me_(p) {
  var me = s30_emp_(p), cat = gm_catalog_(), own = gm_owned_(me.id), m = s30_meRow_(me.id), ym = gm_today_().slice(0, 7);
  try { s30_bossCatchUp_(); } catch (e) {}
  var items = Object.keys(cat).filter(function (k) { return cat[k].where === '花費' || cat[k].where === '工時' || cat[k].where === '季節扭蛋'; }).map(function (k) {
    var c = cat[k], o = { id: c.id, name: c.name, cat: c.cat, tier: c.tier, price: c.price, where: c.where, series: c.series, note: c.note, owned: !!own[k] };
    if (c.where === '工時') { o.need = s30_n_(c.note, 99999); o.owned = s30_cumHours_(me.id) >= o.need; }
    return o;
  });
  var enh = s30_enhMap_(me.id), gear = Object.keys(own).filter(function (k) { return cat[k] && (cat[k].cat === 'weapon' || cat[k].cat === 'armor'); }).map(function (k) {
    var lv = enh[k] || 0; return { id: k, name: cat[k].name, cat: cat[k].cat, stats: cat[k].note, level: lv, cost: lv < 5 ? s30_list_('強化費用', '20,40,80,120,200')[lv] : null, rate: lv < 5 ? s30_list_('強化成功率', '100,90,75,60,45')[lv] : null, bonus: s30_enhBonus_(cat[k].cat, lv), next: s30_enhBonus_(cat[k].cat, lv + 1) };
  });
  var pets = [];
  try { gm_rows_('pets').forEach(function (r, i) { var s = String(r[8] || '身邊') || '身邊'; if (r[0] === me.id && /^(身邊|隊伍|掛賣)$/.test(s)) { var pt = gm_petFromRow_(r, i); pets.push({ id: pt.id, name: pt.name, flavor: pt.flavor, type: pt.type, stage: pt.stage, main: s === '身邊', skin: m.skins[pt.id] || '' }); } }); } catch (e) {}
  var meals = s30_meals_(), mealLive = meals.filter(function (x) { return x.ym === ym && x.status !== '已取消'; });
  var sea = s30_season_(), boss = s30_bossState_(ym);
  return { success: true, data: {
    balance: gm_balance_(me.id), hours: s30_cumHours_(me.id), role: me.e.role,
    items: items, title: m.title, fx: m.fx, seat: m.seat, decoMax: s30_n_('座位擺飾上限', 3), pets: pets, gear: gear,
    tickets: s30_tickets_(me.id),
    season: { now: sea, list: s30_seasonList_(), price: s30_n_('季節扭蛋價格', 100) },
    gachaPrice: Number(gm_param_('扭蛋價格')) || 50,
    boss: { ym: ym, name: boss.name, hp: boss.hp, dmg: boss.dmg, left: boss.left, killed: boss.killed, min: s30_n_('大魔王最低投入', 10),
            rank: boss.rank.slice(0, 20).map(function (x, i) { return { name: x.name, coins: x.coins, mine: x.id === me.id, reward: s30_bossReward_(i + 1) }; }),
            mine: (boss.rank.filter(function (x) { return x.id === me.id; })[0] || {}).coins || 0, rules: String(gm_param_('大魔王獎勵') || '') },
    meal: { price: s30_n_('和隊長吃飯價格', 2000), quota: s30_n_('和隊長吃飯每月名額', 1), used: mealLive.length,
            mine: meals.filter(function (x) { return x.emp === me.id; }).slice(-5).reverse(),
            all: me.e.role >= 5 ? meals.filter(function (x) { return x.status !== '已取消'; }).slice(-24).reverse() : [] }
  } };
}

// ── 宇宙辦公室：稱號、特效、座位、寵物造型 ──
function s30_scene_() {
  var cat = gm_catalog_(), out = { titles: {}, fx: {}, seats: [], skins: {} };
  gm_rows_('s30me').forEach(function (r) {
    var emp = String(r[0]), e = gm_emp_(emp); if (!e || e.resigned) return;
    var m = s30_meRow_(emp);
    if (m.title && cat[m.title] && s30_titleOK_(emp, m.title)) out.titles[emp] = cat[m.title].name;
    if (m.fx) out.fx[emp] = m.fx;
    if (m.seat) out.seats.push({ id: emp, name: e.nick || e.name, desk: m.seat.desk || '', chair: m.seat.chair || '', deco: m.seat.deco || [], den: m.seat.den || '' });
    Object.keys(m.skins || {}).forEach(function (pid) { var s = cat[m.skins[pid]]; if (s) out.skins[pid] = s.note; });
  });
  return out;
}
// 寵物顏色換成特殊色（宇宙辦公室的主寵物、隊伍）
function s30_applySkins_(d, sc) {
  var byEmp = {};
  gm_rows_('pets').forEach(function (r) { var s = String(r[8] || '身邊') || '身邊'; if (/^(身邊|隊伍|掛賣)$/.test(s) && sc.skins[String(r[9])]) (byEmp[r[0]] = byEmp[r[0]] || []).push({ main: s === '身邊', name: String(r[2]), skin: sc.skins[String(r[9])] }); });
  Object.keys(byEmp).forEach(function (emp) {
    byEmp[emp].forEach(function (x) {
      if (x.main && d.pets && d.pets[emp]) d.pets[emp].flavor = x.skin;
      else if (!x.main && d.teams && d.teams[emp]) { var t = d.teams[emp].filter(function (y) { return y.name === x.name && !y._s; })[0]; if (t) { t.flavor = x.skin; t._s = 1; } }
    });
  });
}

// ── 管理者幫夥伴重設密碼（v1.30 追加）──
// Lv.3 以上可以重設「權限比自己低」的夥伴（大隊長可以重設所有人，自己除外）；密碼重設成生日 4 碼，夥伴下次登入一定要先改密碼
GM_SHEETS.s30pw = ['密碼重設紀錄', ['時間', '重設者', '被重設的夥伴', '說明']];
function s30_pwReset_(p) {
  var me = gm_emp_(p.empId), target = String(p.target || '').trim();
  if (!me || me.resigned || me.role < 3) return { error: '需要 Lv.3 以上才能重設密碼' };
  if (!target || target === me.id) return { error: '自己的密碼請到「我的」修改' };
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('夥伴資料'), v = sh.getDataRange().getValues(), pwC = sec_pwCol_(v[0]);
  for (var r = 1; r < v.length; r++) {
    if (String(v[r][0]).trim() !== target) continue;
    var role = Number(v[r][12]) || 1;
    if (me.role < 5 && role >= me.role) return { error: '只能重設權限比你低的夥伴' };
    if (String(v[r][10] || '').trim()) return { error: '這位夥伴已經離職' };
    var bd = sec_bdayPw_(v[r][4]); if (!bd) return { error: '這位夥伴沒有填生日，請先到試算表補上生日' };
    var cell = sh.getRange(r + 1, pwC + 1); cell.setNumberFormat('@'); cell.setValue(sec_hash_(bd, sec_newSalt_()));
    var cache = CacheService.getScriptCache(); cache.remove('pwfail_' + target); cache.remove('lgfail_' + String(v[r][6] || '').replace(/\D/g, ''));
    PropertiesService.getScriptProperties().setProperty('pwMust_' + target, gm_now_());
    gm_append_('s30pw', [[gm_now_(), me.id + ' ' + (me.nick || me.name), target + ' ' + String(v[r][1] || ''), '重設成生日 4 碼']]);
    return { success: true, name: String(v[r][1] || ''), hint: bd.length === 4 ? '生日月日 4 碼' : '生日' };
  }
  return { error: '找不到這位夥伴' };
}
// 登入後：被重設過、而且密碼還是生日 → 一定要先改密碼（改好之後自動解除）
function s30_pwMust_(p) {
  var emp = String(p.empId || '').trim(), props = PropertiesService.getScriptProperties(), k = 'pwMust_' + emp;
  if (!props.getProperty(k)) return { success: true, must: false };
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('夥伴資料'), v = sh.getDataRange().getValues(), pwC = sec_pwCol_(v[0]);
  for (var r = 1; r < v.length; r++) if (String(v[r][0]).trim() === emp) {
    var bd = sec_bdayPw_(v[r][4]), st = String(v[r][pwC] || '');
    var weak = !!bd && (st === bd || (sec_isHashed_(st) && sec_check_(bd, st)));
    if (!weak) { props.deleteProperty(k); return { success: true, must: false }; }
    return { success: true, must: true };
  }
  return { success: true, must: false };
}

AU_READ = new RegExp(AU_READ.source.replace('|acMeta|acSummary)$', '|acMeta|acSummary|s30Me|s30PwMust)$'));

function s30Handler_(action, p) {
  if (action === 'gmScene') {           // 先拿 v1.28 的場景（含隊伍），再加上稱號、特效、座位、寵物顏色
    try {
      var r = p28Handler_('gmScene', p); if (!r || !r.data) return r;
      var sc = s30_scene_(); r.data.titles = sc.titles; r.data.fx = sc.fx; r.data.seats = sc.seats;
      s30_applySkins_(r.data, sc); return r;
    } catch (e) { return null; }
  }
  if (action === 'homeTodo') {          // 大隊長：和隊長吃飯待約
    try {
      var t = p28Handler_('homeTodo', p); var me = gm_emp_(p.empId);
      if (t && t.success && me && me.role >= 5) s30_meals_().filter(function (m) { return m.status === '已申請'; }).forEach(function (m) { t.data.unshift({ icon: '🍽️', text: m.name + ' 申請和你吃飯，請約時間', tab: 'spend', red: false }); });
      if (t && t.success && me) s30_meals_().filter(function (m) { return m.emp === me.id && m.status === '已約好' && m.date.slice(0, 10) >= gm_today_(); }).forEach(function (m) { t.data.unshift({ icon: '🍽️', text: m.date + ' 和隊長吃飯', tab: 'spend', red: false }); });
      return t;
    } catch (e) { return null; }
  }
  if (action === 'gmRules') {           // 赤心幣規則頁「怎麼用」加上新的花費
    try {
      var g = gm27Handler_('gmRules', p); if (!g || !g.data) return g;
      g.data.spend = g.data.spend.concat([
        { name: '🪑 我的座位', how: '開通 ' + (gm_catalog_().seat_basic || {}).price + ' 枚；桌子、椅子、擺飾、寵物小窩另購' },
        { name: '✨ 進場特效', how: '煙火、彩虹、星星雨、騎小暴龍，打卡上班時播放' },
        { name: '🏷️ 稱號', how: '翻模達人 ' + s30_n_('稱號門檻_翻模達人', 500) + ' 小時、雞蛋糕職人 ' + s30_n_('稱號門檻_雞蛋糕職人', 1500) + ' 小時自動解鎖；其他稱號用幣買' },
        { name: '🎨 寵物顏色', how: '櫻花、星空、金色，買一次可以套在自己任何一隻寵物' },
        { name: '⚔️ 裝備強化', how: '+1～+5，失敗只扣幣、裝備不會壞' },
        { name: '🎄 季節扭蛋', how: s30_n_('季節扭蛋價格', 100) + ' 枚一次，限期開放，不算每月次數' },
        { name: '👹 全員大魔王', how: '每月一隻，全員投幣攻擊，打倒後依排名送扭蛋券' },
        { name: '🍽️ 和隊長吃飯', how: s30_n_('和隊長吃飯價格', 2000) + ' 枚，每月 ' + s30_n_('和隊長吃飯每月名額', 1) + ' 名，先申請先得' }
      ]);
      return g;
    } catch (e) { return null; }
  }
  var map = { s30PwReset: s30_pwReset_, s30PwMust: s30_pwMust_, s30Me: s30_me_, s30Buy: s30_buy_, s30Set: s30_set_, s30Enhance: s30_enhance_, s30Boss: s30_bossHit_, s30Meal: s30_mealApply_, s30MealSet: s30_mealSet_, gmGacha: gm_gacha_ };
  if (!map[action]) return null;
  var lock = action === 's30Me' ? null : LockService.getScriptLock();
  try { if (lock) lock.waitLock(20000); GM_CACHE_ = {}; return map[action](p); }
  catch (e) { return { error: e.message }; }
  finally { if (lock) lock.releaseLock(); }
}

function s30_setup() {
  var log = [];
  ['s30me', 's30enh', 's30tix', 's30boss', 's30meal', 's30pw'].forEach(function (k) { gm_sh_(k); });
  var gs = gm_sh_('gacha'); if (String(gs.getRange(1, 6).getValue()).trim() === '') { gs.getRange(1, 6).setValue('機台'); log.push('扭蛋紀錄加「機台」欄'); }
  var sh = gm_sh_('params'), v = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues() : [], have = {};
  v.forEach(function (r) { have[String(r[0]).trim()] = 1; });
  S30_PARAMS.forEach(function (x) { if (!have[x[0]]) { sh.appendRow(x); log.push('新增參數 ' + x[0]); } });
  var cat = {}; gm_rows_('catalog').forEach(function (r) { cat[r[0]] = 1; });
  var add = S30_CATALOG.filter(function (c) { return !cat[c[0]]; }); if (add.length) { gm_append_('catalog', add); log.push('商品目錄新增 ' + add.length + ' 項'); }
  GM_CACHE_ = {};
  Logger.log('s30_setup 完成\n' + log.join('\n'));
  return log;
}
