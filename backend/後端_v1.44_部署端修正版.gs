// ═══════════════════════════════════════════════
// 紅玉滿夥伴 App 後端模組 v1.44（2026-11-14，檔案 v2＝前端 0020 v3）＋部署端修正：夾娃娃「對準加成」改成參數，預設 0.1（原 0.25）
// 貼在第 44 版全文最下面（v1.43 勞健保合併版之後），檔案最後的「路由 v1.44」取代 v1.43 合併版的 extHandler_
// （保留 getMyIns 那段與 v41_wordRes_ 外層）。
// 內容：
//   1. 心情簽到（每天一次；只有 Lv.3 以上看得到；連續 3 次心情低落提醒主管關心）
//   2. 隊長室敲門留言（寫給隊長，非匿名，隊長在意見箱回覆）
//   3. 客人讚美榮譽牆（Lv.2 以上貼）
//   4. 遊戲室排行榜（本週各遊戲前 3 名）
//   5. 飯堂：請吃雞蛋糕、今日菜單（Lv.3 以上編輯）、今天和隊長吃飯的人
//   6. 意見箱不匿名（隊長 11/14 19:02）：一律記員工編號、姓名；每人每天 5 則
//   7. gmScene 加 praise、rank、canteen、macc（坐騎配件）
//   8. 夾娃娃機改版（覆蓋 v42_claw_）：約 3 次中 1 次、6 次保底；大多 1～10 枚，桌面小配件稀有
//   9. 遊戲室拍貼機＋我的相簿：原圖存雲端〈拍貼相簿（不公開）〉，只有本人看得到
//  10. 坐騎配件＋商店街新店種「坐騎改裝店」（8 種配件）
// v1.45（薪資修正）要放在本模組之後、最後的「路由 v1.44」之前。
// 安全：所有動作都用 au_verifiedId_()（經 v39_me_），沒有通行證就擋。
// 執行一次 v44_setup()：建立〈心情簽到〉〈客人讚美〉〈拍貼相簿〉分頁、〈遊戲參數〉補參數、〈商品目錄〉加坐騎配件。
// 拍貼機用 DriveApp（和體檢表同一個權限，不用重新授權）。
// ═══════════════════════════════════════════════

var V44_MOOD_HEAD = ['時間', '日期', '員工編號', '心情', '一句話'];
var V44_PRAISE_HEAD = ['時間', '日期', '貼文者', '櫃位', '隊員', '來源', '內容'];
var V44_MOODS = ['', '😢 很低落', '😟 有點累', '😐 普通', '🙂 不錯', '😄 很棒'];
if (V41_ROOMS.indexOf('隊長室') < 0) V41_ROOMS.push('隊長室');

function v44_isMgr_(me) { return me && (me.role >= 3 || me.pos === '大隊長'); }

// ───────── 1. 心情簽到 ─────────
function v44_moodRows_() { return v42_rows_('心情簽到', V44_MOOD_HEAD); }
function v44_mood_(p) {
  var me = v39_me_(), v = Math.round(Number(p.mood) || 0), d = v40_today_();
  if (!(v >= 1 && v <= 5)) return { error: '請選一個心情' };
  var note = v42_txt_(p.note, 40), sh = v42_s_('心情簽到', V44_MOOD_HEAD), rows = v44_moodRows_();
  for (var i = rows.length - 1; i >= 0; i--) if (v39_d_(rows[i][1]) === d && String(rows[i][2]) === me.id) { sh.getRange(i + 2, 4, 1, 2).setValues([[v, note]]); v44_moodAlert_(me.id); return { success: true, data: { mood: v, updated: true } }; }
  sh.appendRow([v39_now_(), d, me.id, v, note]);
  v44_moodAlert_(me.id);
  return { success: true, data: { mood: v } };
}
// 連續 3 次（最近 3 筆）都 ≤2 → 提醒 Lv.3 以上主管關心（同一段低落只提醒一次）
function v44_moodAlert_(emp) {
  var mine = v44_moodRows_().filter(function (r) { return String(r[2]) === emp; }).slice(-3);
  if (mine.length < 3 || !mine.every(function (r) { return Number(r[3]) <= 2; })) return;
  var key = '心情提醒|' + emp + '|' + v39_d_(mine[0][1]);
  if (gm_getState_(key)) return; gm_setState_(key, '1');
  ops_staff_().list.filter(function (x) { return !x.left && x.id !== emp && (x.role >= 3 || x.pos === '大隊長'); })
    .forEach(function (x) { v41_noteAny_(x.id, 'care', '💗 ' + v40_nm_(emp) + ' 最近心情比較低落，找時間關心一下'); });
}
function v44_moodMe_(p) {
  var me = v39_me_(), d = v40_today_(), today = null;
  v44_moodRows_().forEach(function (r) { if (String(r[2]) === me.id && v39_d_(r[1]) === d) today = { mood: Number(r[3]), note: String(r[4] || '') }; });
  return { success: true, data: { today: today, moods: V44_MOODS } };
}
// 主管看：今天每個人的心情、最近 7 天平均、連續低落
function v44_moodTeam_(p) {
  var me = v39_me_(); if (!v44_isMgr_(me)) return { error: 'Lv.3 以上才看得到' };
  var d = v40_today_(), from = gm_addDays_(d, -6), by = {};
  v44_moodRows_().forEach(function (r) {
    var e = String(r[2]), dd = v39_d_(r[1]); if (dd < gm_addDays_(d, -30)) return;
    (by[e] = by[e] || []).push({ d: dd, v: Number(r[3]), note: String(r[4] || '') });
  });
  var list = Object.keys(by).map(function (e) {
    var a = by[e], wk = a.filter(function (x) { return x.d >= from; }), last3 = a.slice(-3);
    var t = a.filter(function (x) { return x.d === d; })[0] || null;
    return { id: e, name: v40_nm_(e), today: t ? t.v : 0, note: t ? t.note : '', avg: wk.length ? Math.round(wk.reduce(function (s, x) { return s + x.v; }, 0) / wk.length * 10) / 10 : 0,
             low: last3.length === 3 && last3.every(function (x) { return x.v <= 2; }) };
  }).sort(function (a, b) { return (b.low - a.low) || (a.today || 9) - (b.today || 9); });
  return { success: true, data: { list: list, moods: V44_MOODS } };
}

// ───────── 2. 隊長室敲門 ─────────
function v44_knock_(p) {
  var me = v39_me_(), text = v42_txt_(p.text, 300);
  if (text.length < 2) return { error: '請寫下想跟隊長說的話' };
  var key = 'IDEA|' + me.id + '|' + v40_today_(), n = Number(gm_getState_(key) || 0);
  if (n >= 5) return { error: '今天已經留了 5 則' };
  gm_setState_(key, String(n + 1));
  v42_s_('意見箱', V42_IDEA_HEAD).appendRow([v39_now_(), me.id, v40_nm_(me.id), '', '【敲門】' + text, '', '']);
  ops_staff_().list.filter(function (x) { return !x.left && (x.role >= 5 || x.pos === '大隊長'); }).forEach(function (x) { v41_noteAny_(x.id, 'care', '🚪 ' + v40_nm_(me.id) + ' 敲了隊長室的門：' + text.slice(0, 30)); });
  return { success: true };
}
// 覆蓋 v1.42 v42_idea_：匿名也有每日上限（以通行證計數，存在 Script Properties，不寫進表格）
function v42_idea_(p) {
  // v1.44 v3：意見箱不匿名，一律記下員工編號與姓名（隊長要知道是誰反映）
  var me = v39_me_(), text = v42_txt_(p.text, 300);
  if (text.length < 2) return { error: '請寫下你的想法' };
  var key = 'IDEA|' + me.id + '|' + v40_today_(), n = Number(gm_getState_(key) || 0);
  if (n >= 5) return { error: '今天已經投了 5 則' };
  gm_setState_(key, String(n + 1));
  v42_s_('意見箱', V42_IDEA_HEAD).appendRow([v39_now_(), me.id, v40_nm_(me.id), '', text, '', '']);
  return { success: true };
}
function v42_ideas_(p) {
  var me = v39_me_(); if (!v42_isBoss_(me)) return { error: '只有大隊長看得到意見箱' };
  return { success: true, data: v42_rows_('意見箱', V42_IDEA_HEAD).map(function (r, i) { var old = String(r[3]) === 'Y' && !r[1]; return { i: i + 2, time: v42_hm_(r[0]), name: old ? '（舊版匿名）' : String(r[2]), anon: old, text: String(r[4]), reply: String(r[5] || '') }; }).reverse().slice(0, 100) };
}

// ───────── v1.44 v3 夾娃娃機改版：變好夾；大多夾到 1～10 枚赤心幣，桌面小配件是稀有驚喜 ─────────
// 機率 = 夾娃娃好夾機率(預設 0.25) + 對準度 × 0.25（對很準最高 50%）；連續 夾娃娃好夾保底(預設 6) 次沒中，下一次必中
// 獎品（權重合計 100）：赤心幣 75（1 枚 30、2 枚 22、3 枚 14、5 枚 7、10 枚 2）、桌面小配件 20、扭蛋券 5
// 平均每夾一次約拿回 0.6 枚，花的比拿的多，但常常有東西；小配件直接放進「我的物品」，已經有的換成 3 枚
var V44_CLAW_PRIZES = [
  [30, 'coin', '', '1 枚赤心幣', '🪙', 1], [22, 'coin', '', '2 枚赤心幣', '🪙', 2], [14, 'coin', '', '3 枚赤心幣', '🪙', 3],
  [7, 'coin', '', '5 枚赤心幣', '💰', 5], [2, 'coin', '', '10 枚赤心幣', '💰', 10],
  [6, 'deco', 'deco_plant', '小盆栽', '🪴', 3], [5, 'deco', 'deco_frame', '相框', '🖼️', 3],
  [3, 'deco', 'deco_globe', '地球儀', '🌍', 3], [2.5, 'deco', 'deco_figure', '雞蛋糕公仔', '🧸', 3],
  [1.8, 'deco', 'deco_trex', '小暴龍玩偶', '🦖', 3], [1.2, 'deco', 'deco_trophy', '獎盃', '🏆', 3],
  [0.5, 'deco', 'deco_oven', '迷你金烤爐', '✨', 3],
  [5, 'tix', '', '扭蛋券 1 張', '🎟️', 1]
];
function v42_claw_(p) {
  var me = v39_me_(); if (gm_isFrozen_(me.id)) return { error: '帳號不能使用赤心幣' };
  var cost = v42_n_('夾娃娃價格', 1), pity = v42_n_('夾娃娃好夾保底', 6), align = Math.max(0, Math.min(1, Number(p.align) || 0));
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    if (gm_balance_(me.id) < cost) return { error: '赤心幣不足' };
    var m = {}; try { m = JSON.parse(gm_getState_('夾娃娃保底') || '{}') || {}; } catch (e) { m = {}; }
    var miss = Number(m[me.id]) || 0, key = 'CLAW|' + me.id + '|' + Date.now() + '|' + Math.random();
    gm_credit_(me.id, '夾娃娃機', -cost, '夾娃娃機', key);
    var prob = Math.min(0.9, v42_n_('夾娃娃好夾機率', 0.25) + align * v42_n_('夾娃娃對準加成', 0.1))   // 部署端：對準加成最多 10%（align 由前端送，可被改成 1；25% 時期望值會超過 1 枚）, win = miss + 1 >= pity || Math.random() < prob;
    var out = { win: win, prize: '', emoji: '', item: '', dup: false };
    if (win) {
      var tot = V44_CLAW_PRIZES.reduce(function (a, x) { return a + x[0]; }, 0), r = Math.random() * tot, pz = null;
      for (var i = 0; i < V44_CLAW_PRIZES.length; i++) { r -= V44_CLAW_PRIZES[i][0]; if (r < 0) { pz = V44_CLAW_PRIZES[i]; break; } }
      pz = pz || V44_CLAW_PRIZES[0]; out.emoji = pz[4];
      if (pz[1] === 'deco') {
        if (gm_owned_(me.id)[pz[2]]) { gm_credit_(me.id, '夾娃娃機', pz[5], '夾到重複的' + pz[3] + '，換成赤心幣', key + '|W'); out.dup = true; out.prize = pz[3] + '（已經有了，換成 ' + pz[5] + ' 枚赤心幣）'; }
        else { gm_append_('owned', [[me.id, pz[2], '夾娃娃', gm_now_()]]); out.item = pz[2]; out.prize = pz[3] + '（已放進我的物品，可擺到辦公桌）'; }
      } else if (pz[1] === 'coin') { gm_credit_(me.id, '夾娃娃機', pz[5], '夾到 ' + pz[3], key + '|W'); out.prize = pz[3]; }
      else { s30_tixAdd_(me.id, pz[5], '夾娃娃機', key + '|W'); out.prize = pz[3]; }
      m[me.id] = 0;
      if (!out.dup && (pz[5] >= 10 || (pz[1] === 'deco' && pz[0] <= 2.5) || pz[1] === 'tix')) v40_event_('claw', '🧸 ' + v40_nm_(me.id) + ' 夾到 ' + pz[4] + pz[3] + '！', '遊戲室');
    } else m[me.id] = miss + 1;
    gm_setState_('夾娃娃保底', JSON.stringify(m));
    out.miss = m[me.id]; out.pity = pity; out.balance = gm_balance_(me.id);
    return { success: true, data: out };
  } finally { lock.releaseLock(); }
}

// ───────── v1.44 v3 遊戲室拍貼機＋我的相簿 ─────────
// 拍一次（存進相簿時）扣 拍貼機價格(預設 1) 枚；原圖存雲端硬碟〈拍貼相簿（不公開）〉，縮圖存在〈拍貼相簿〉分頁
// 只有本人看得到自己的相簿（每位隊員在「我的 → 我的相簿」）
var V44_PH_HEAD = ['時間', '員工編號', '姓名', '相片ID', '標題', '檔案', '縮圖', '刪除'];
function v44_phFolder_() {
  var roots = DriveApp.getFoldersByName(DRIVE_ROOT), root = roots.hasNext() ? roots.next() : DriveApp.createFolder(DRIVE_ROOT);
  var subs = root.getFoldersByName('拍貼相簿（不公開）');
  return subs.hasNext() ? subs.next() : root.createFolder('拍貼相簿（不公開）');
}
function v44_b64_(v) { return String(v || '').replace(/^data:image\/\w+;base64,/, ''); }
function v44_photo_(p) {
  var me = v39_me_(); if (p._viewAs) return { error: '預覽模式只能看' };
  if (gm_isFrozen_(me.id)) return { error: '帳號不能使用赤心幣' };
  var img = v44_b64_(p.img), th = v44_b64_(p.thumb);
  if (!/^[A-Za-z0-9+\/=]+$/.test(img) || img.length < 1000 || img.length > 1400000) return { error: '照片格式不對，請重拍' };
  if (!/^[A-Za-z0-9+\/=]*$/.test(th) || th.length > 45000) th = '';
  var cost = v42_n_('拍貼機價格', 1), d = v40_today_(), key = 'PHOTO|' + me.id + '|' + d, n = Number(gm_getState_(key) || 0);
  if (n >= v42_n_('拍貼機每日上限', 20)) return { error: '今天已經拍很多張了，明天再來' };
  if (gm_balance_(me.id) < cost) return { error: '赤心幣不足（拍一次 ' + cost + ' 枚）' };
  var id = 'PH' + Date.now() + Math.floor(Math.random() * 1000);
  var f = v44_phFolder_().createFile(Utilities.newBlob(Utilities.base64Decode(img), 'image/jpeg', me.id + '_' + id + '.jpg'));
  try { f.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE); } catch (e) {}
  if (cost > 0) gm_credit_(me.id, '拍貼機', -cost, '遊戲室拍貼機', id);
  gm_setState_(key, String(n + 1));
  v42_s_('拍貼相簿', V44_PH_HEAD).appendRow([v39_now_(), me.id, v40_nm_(me.id), id, v42_txt_(p.title, 20), f.getId(), th, '']);
  if (n === 0) v40_event_('photo', '📸 ' + v40_nm_(me.id) + ' 在遊戲室拍了拍貼', '遊戲室');
  return { success: true, data: { id: id, balance: gm_balance_(me.id) } };
}
function v44_phRows_(emp) {
  var sh = v42_s_('拍貼相簿', V44_PH_HEAD), n = sh.getLastRow(); if (n < 2) return [];
  var a = sh.getRange(2, 1, n - 1, 6).getValues(), b = sh.getRange(2, 7, n - 1, 2).getValues(), out = [];
  for (var i = 0; i < a.length; i++) if (String(a[i][1]) === emp && !b[i][1]) out.push({ row: i + 2, time: v42_hm_(a[i][0]), id: String(a[i][3]), title: String(a[i][4] || ''), file: String(a[i][5]), thumb: String(b[i][0] || '') });
  return out;
}
function v44_photos_(p) {
  var me = v39_me_();
  return { success: true, data: v44_phRows_(me.id).reverse().slice(0, 200).map(function (x) { return { id: x.id, time: x.time, title: x.title, thumb: x.thumb }; }) };
}
function v44_photoGet_(p) {
  var me = v39_me_(), x = v44_phRows_(me.id).filter(function (r) { return r.id === String(p.id); })[0];
  if (!x) return { error: '找不到這張照片' };
  var b = DriveApp.getFileById(x.file).getBlob();
  return { success: true, data: { id: x.id, base64: Utilities.base64Encode(b.getBytes()) } };
}
function v44_photoDel_(p) {
  var me = v39_me_(), x = v44_phRows_(me.id).filter(function (r) { return r.id === String(p.id); })[0];
  if (!x) return { error: '找不到這張照片' };
  v42_s_('拍貼相簿', V44_PH_HEAD).getRange(x.row, 8).setValue(v39_now_());
  try { DriveApp.getFileById(x.file).setTrashed(true); } catch (e) {}
  return { success: true };
}

// ───────── v1.44 v3 坐騎配件＋坐騎改裝店 ─────────
// 商店街新店種「坐騎改裝店」賣 8 種配件（隊員開店來賣）；買到後在「赤心幣商店 → 坐騎」裝上，最多同時裝 3 個
// 配件不分坐騎：換騎哪一台都會跟著裝上。用 wear 類商品機制（買了就擁有、不能重複買）
var V44_MACC = [
  ['macc_flag', '紅玉滿小旗', '普通', 15, '🚩'], ['macc_balloon', '愛心氣球', '普通', 15, '🎈'],
  ['macc_plate', '專屬車牌', '普通', 20, '🔖'], ['macc_star', '星星特效', '普通', 30, '✨'],
  ['macc_neon', '霓虹底燈', '稀有', 35, '💡'], ['macc_flame', '火焰尾氣', '稀有', 40, '🔥'],
  ['macc_wings', '天使翅膀', '稀有', 45, '🪽'], ['macc_gold', '黃金塗裝', '傳說', 90, '👑']
];
var V44_MACC_ITEMS = V44_MACC.map(function (m) { return ['s_' + m[0], m[1], 'wear', m[2], m[3], '小店:坐騎改裝店', '', 'wear:' + m[0]]; });
if (PV_SHOP_TYPES.indexOf('坐騎改裝店') < 0) PV_SHOP_TYPES.push('坐騎改裝店');
if (typeof GM_CATALOG_SEED !== 'undefined') V44_MACC_ITEMS.forEach(function (r) { if (!GM_CATALOG_SEED.some(function (x) { return x[0] === r[0]; })) GM_CATALOG_SEED.push(r); });
var V44_MACC_MAX = 3;
function v44_maccAll_() { var m = {}; try { m = JSON.parse(gm_getState_('坐騎配件') || '{}') || {}; } catch (e) { m = {}; } return m; }
function v44_maccOwned_(emp) { var o = gm_owned_(emp); return V44_MACC.filter(function (m) { return o[m[0]]; }).map(function (m) { return m[0]; }); }
function v44_maccMe_(p) {
  var me = v39_me_(), own = v44_maccOwned_(me.id), on = (v44_maccAll_()[me.id] || []).filter(function (x) { return own.indexOf(x) >= 0; });
  return { success: true, data: { list: V44_MACC.map(function (m) { return { id: m[0], name: m[1], tier: m[2], price: m[3], icon: m[4] }; }), owned: own, on: on, max: V44_MACC_MAX } };
}
function v44_maccSet_(p) {
  var me = v39_me_(), own = v44_maccOwned_(me.id), want = [].concat(p.on || []).map(String);
  want = want.filter(function (x, i) { return own.indexOf(x) >= 0 && want.indexOf(x) === i; });
  if (want.length > V44_MACC_MAX) return { error: '最多同時裝 ' + V44_MACC_MAX + ' 個配件' };
  var m = v44_maccAll_(); if (want.length) m[me.id] = want; else delete m[me.id];
  gm_setState_('坐騎配件', JSON.stringify(m));
  return { success: true, data: { on: want } };
}
function v44_maccScene_() {   // 只回目前有騎坐騎、而且還擁有的配件
  var m = v44_maccAll_(), ride = v40_rideMap_(), out = {}, rows = gm_rows_('owned'), own = {};
  rows.forEach(function (r) { if (/^macc_/.test(String(r[1]))) (own[String(r[0])] = own[String(r[0])] || {})[String(r[1])] = 1; });
  Object.keys(m).forEach(function (e) { if (!ride[e]) return; var a = (m[e] || []).filter(function (x) { return own[e] && own[e][x]; }); if (a.length) out[e] = a.slice(0, V44_MACC_MAX); });
  return out;
}

// ───────── 3. 客人讚美 ─────────
function v44_praiseList_() {
  return v42_rows_('客人讚美', V44_PRAISE_HEAD).slice(-20).reverse().map(function (r) { return { date: v39_d_(r[1]), loc: String(r[3] || ''), who: String(r[4] || ''), src: String(r[5] || ''), text: String(r[6] || '') }; });
}
function v44_praise_(p) {
  var me = v39_me_(); if (!(me.role >= 2 || me.pos === '大隊長')) return { error: 'Lv.2 以上才能貼' };
  var text = v42_txt_(p.text, 80); if (text.length < 2) return { error: '請貼上客人說的話' };
  var src = /^(Google 評論|現場|社群|電話|其他)$/.test(String(p.src || '')) ? String(p.src) : '現場';
  v42_s_('客人讚美', V44_PRAISE_HEAD).appendRow([v39_now_(), v40_today_(), me.id, v42_txt_(p.loc, 20), v42_txt_(p.who, 20), src, text]);
  v40_event_('praise', '⭐ 客人稱讚' + (p.who ? ' ' + v42_txt_(p.who, 20) : '') + (p.loc ? '（' + v42_txt_(p.loc, 20) + '）' : '') + '：' + text.slice(0, 20), '辦公區');
  return { success: true, data: v44_praiseList_() };
}

// ───────── 4. 遊戲排行榜（本週一到今天，各遊戲前 3 名）─────────
function v44_rank_() {
  var d = v40_today_(), wd = (new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7, from = gm_addDays_(d, -wd), best = {};
  gm_rows_('games').forEach(function (r) {
    var dd = String(r[1]); if (dd < from || dd > d) return;
    var g = String(r[3]), e = String(r[2]), sc = Number(r[4]) || 0, m = (best[g] = best[g] || {});
    if (!m[e] || sc > m[e]) m[e] = sc;
  });
  return GM_GAMES.map(function (g) {
    var m = best[g[0]] || {};
    return { game: g[0], name: g[1], top: Object.keys(m).map(function (e) { return { name: v40_nm_(e), score: m[e] }; }).sort(function (a, b) { return b.score - a.score; }).slice(0, 3) };
  }).filter(function (x) { return x.top.length; });
}

// ───────── 5. 飯堂 ─────────
function v44_menu_() { try { return JSON.parse(gm_getState_('今日菜單') || '{}') || {}; } catch (e) { return {}; } }
function v44_menuSet_(p) {
  var me = v39_me_(); if (!v44_isMgr_(me)) return { error: 'Lv.3 以上才能改菜單' };
  var lines = String(p.lines || '').split(/\n/).map(function (x) { return v42_txt_(x, 24); }).filter(String).slice(0, 6);
  var m = { lines: lines, by: v40_nm_(me.id), date: v40_today_() };
  gm_setState_('今日菜單', JSON.stringify(m)); return { success: true, data: m };
}
function v44_cake_(p) {   // 請吃雞蛋糕（像請喝咖啡：同一個人每天一次）
  var me = v39_me_(), to = String(p.to || '').trim();
  if (!gm_emp_(to) || to === me.id) return { error: '找不到這位隊員' };
  if (gm_isFrozen_(me.id)) return { error: '帳號不能使用赤心幣' };
  var cost = v42_n_('請吃雞蛋糕價格', 2);
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var key = 'CAKE|' + me.id + '|' + to + '|' + v40_today_();
    if (gm_hasKey_(key)) return { error: '今天已經請過他了' };
    if (cost > 0 && gm_balance_(me.id) < cost) return { error: '赤心幣不足' };
    if (!v40_note_(to, 'coffee', v40_nm_(me.id) + ' 請你吃雞蛋糕 🧇', 'pair', me.id + '|cake')) return { error: '今天已經請過他了' };
    if (cost > 0) gm_credit_(me.id, '請吃雞蛋糕', -cost, '請 ' + v40_nm_(to) + ' 吃雞蛋糕', key);
    v40_event_('cake', v40_nm_(me.id) + ' 請 ' + v40_nm_(to) + ' 吃雞蛋糕 🧇', '飯堂');
    return { success: true, balance: gm_balance_(me.id) };
  } finally { lock.releaseLock(); }
}
function v44_canteen_() {
  var d = v40_today_(), meal = [];
  try { s30_meals_().forEach(function (x) { if (String(x.date).slice(0, 10) === d && x.status !== '已取消') meal.push({ id: x.emp, name: x.name }); }); } catch (e) {}
  return { menu: v44_menu_(), meal: meal };
}

// ───────── setup ─────────
function v44_setup() {
  var log = [];
  [['心情簽到', V44_MOOD_HEAD], ['客人讚美', V44_PRAISE_HEAD], ['拍貼相簿', V44_PH_HEAD]].forEach(function (x) { v42_s_(x[0], x[1]); });
  log.push('分頁就緒：心情簽到、客人讚美、拍貼相簿');
  var have = {}; gm_rows_('params').forEach(function (r) { have[String(r[0]).trim()] = 1; });
  var add = [['請吃雞蛋糕價格', 2, 'v1.44：飯堂請吃雞蛋糕花幾枚（0＝免費）'], ['夾娃娃好夾機率', 0.25, 'v1.44：夾娃娃基本中獎率，對準再加最多 0.25'], ['夾娃娃好夾保底', 6, 'v1.44：連續幾次沒夾到，下一次必中'], ['拍貼機價格', 1, 'v1.44：拍貼機存一張花幾枚'], ['拍貼機每日上限', 20, 'v1.44：每人每天最多存幾張']].filter(function (x) { return !have[x[0]]; });
  if (add.length) { gm_append_('params', add); log.push('遊戲參數新增 ' + add.map(function (x) { return x[0]; }).join('、')); }
  var cat = gm_catalog_(), addc = V44_MACC_ITEMS.filter(function (r) { return !cat[r[0]]; });
  if (addc.length && gm_rows_('catalog').length) { gm_append_('catalog', addc); GM_CACHE_.catalog = null; log.push('〈商品目錄〉新增坐騎改裝店 ' + addc.length + ' 項配件'); }
  Logger.log(log.join('\n')); return log.join('\n');
}

// ───────── 動作 ─────────
AU_READ = new RegExp(AU_READ.source.replace(/\)\$$/, '|v44MoodMe|v44MoodTeam|v44Photos|v44PhotoGet|v44MaccMe)$'));
function v44Handler_(action, p) {
  p = p || {};
  if (action === 'gmScene') {
    var r = v42Handler_('gmScene', p); if (!r || !r.data) return r;
    var safe = function (f, dv) { try { return f(); } catch (e) { return dv; } };
    r.data.praise = safe(v44_praiseList_, []);
    r.data.rank = safe(v44_rank_, []);
    r.data.canteen = safe(v44_canteen_, null);
    r.data.macc = safe(v44_maccScene_, {});
    return r;
  }
  var map = { v44Mood: v44_mood_, v44MoodMe: v44_moodMe_, v44MoodTeam: v44_moodTeam_, v44Knock: v44_knock_, v44Praise: v44_praise_,
              v44MenuSet: v44_menuSet_, v44Cake: v44_cake_,
              v44Photo: v44_photo_, v44Photos: v44_photos_, v44PhotoGet: v44_photoGet_, v44PhotoDel: v44_photoDel_,
              v44MaccMe: v44_maccMe_, v44MaccSet: v44_maccSet_ };
  if (!map[action]) return null;
  var lock = null;
  try {
    OPS_C_ = {}; GM_CACHE_ = {};
    if (/^v44(Mood|Knock|Praise|MenuSet|Photo|PhotoDel|MaccSet)$/.test(action)) { lock = LockService.getScriptLock(); lock.waitLock(15000); }
    return map[action](p);
  } catch (e) { return { error: e.message }; }
  finally { if (lock) lock.releaseLock(); }
}

// ═══════════════════════════════════════════════
// 路由 extHandler_ v1.44（2026-11-14）
// 放在檔案最後，取代 v1.43 勞健保合併版的 extHandler_（Apps Script 以檔案中最後一個同名函式為準）。
// 與前一版的差別：v42Handler_ 之前加 v44Handler_（心情簽到、敲門、客人讚美、排行榜、飯堂；
//   接手 gmScene → v42 → v41 → v40 → v39 → h36 → s30）。保留 v1.43 的 getMyIns 與 v41_wordRes_ 外層。
// ═══════════════════════════════════════════════
function extHandler_(action, p) {
  if (action === 'getMyIns') {   // v1.43（部署端合併版）照舊
    p = p || {};
    var gate = au_gate_(action, p); if (gate) return v41_wordRes_(gate);
    try { return v41_wordRes_(v43_myIns_(p)); } catch (e) { return { error: '勞健保資料錯誤:' + e.message }; }
  }
  return v41_wordRes_(v44Route_(action, p));
}
function v44Route_(action, p) {
  p = p || {};
  var gate = au_gate_(action, p); if (gate) return gate;
  var au = auHandler_(action, p); if (au) return au;
  var sec = secHandler_(action, p); if (sec) return sec;
  var op = opsHandler_(action, p); if (op) return op;
  var bu = buHandler_(action, p); if (bu) return bu;
  var rp = rpHandler_(action, p); if (rp) return rp;
  var fs = fsHandler_(action, p); if (fs) return fs;
  var v44 = v44Handler_(action, p); if (v44) return v44;
  var v42 = v42Handler_(action, p); if (v42) return v42;
  var v41 = v41Handler_(action, p); if (v41) return v41;
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
