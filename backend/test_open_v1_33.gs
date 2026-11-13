// ═════════════════════════════════════════════════════════════
// v1.33 測試期提前開放（隊長 11/13 21:59：「現在都要開放了，我現在就在測試了」）
// 底版：後端第 35 版（部署交接 v3）。放在「夥伴權限保護 v1.32 v2」之後、路由之前。
//   1 執行一次 coin33_setup()：把〈遊戲參數〉「測試版開始日」改成今天（只會往前改，不會往後）
//      → 對戰、塔防、小遊戲、工時幣等「測試版開始後才開放」的功能立刻開放
//      → 12/1 正式版照常歸零；創始夥伴禮包的「測試期」會從今天算起
//   2 開店（覆蓋 sp_open_）：正式版開始日之前，不需要「資歷・銅」徽章（測試期大家都能試開店）；
//      正式版之後恢復原本門檻。開店費照收。
//      依交接第 3 節安全規則：花幣動作以登入通行證本人為準，沒有通行證就擋下。
// 覆蓋的函式：sp_open_（不在交接第 3 節清單內）
// ═════════════════════════════════════════════════════════════
function coin33_setup() {
  var today = gm_today_(), sh = gm_sh_('params'), rows = gm_rows_('params'), msg = '';
  for (var i = 0; i < rows.length; i++) if (String(rows[i][0]).trim() === '測試版開始日') {
    var cur = String(rows[i][1] instanceof Date ? Utilities.formatDate(rows[i][1], 'Asia/Taipei', 'yyyy-MM-dd') : rows[i][1]).trim();
    if (!cur || cur > today) { sh.getRange(i + 2, 2).setNumberFormat('@'); sh.getRange(i + 2, 2).setValue(today); msg = '測試版開始日 ' + cur + ' → ' + today; }
    else msg = '測試版開始日已經是 ' + cur + '，不用改';
    break;
  }
  if (!msg) { sh.appendRow(['測試版開始日', today, 'v1.33：測試期提前開放']); msg = '新增測試版開始日 ' + today; }
  GM_CACHE_ = {};
  return msg;
}
function sp_open_(p) {
  var vid = typeof au_verifiedId_ === 'function' ? au_verifiedId_() : '';
  var emp = String(p.empId || '').trim();
  if (!vid) return { error: '請重新登入後再開店' };
  if (vid !== emp) return { error: '登入身分不符，請重新登入' };
  if (!gm_emp_(emp) || gm_isFrozen_(emp)) return { error: '帳號無法使用' };
  var off = String(gm_param_('正式版開始日') || '').trim(), testing = !off || gm_today_() < off;
  if (!testing && !gm_hasBadge_(emp, 'tenure_1', '')) return { error: '累計工時達 ' + String(gm_param_('資歷門檻')).split(',')[0] + ' 小時才能開店' };
  if (sp_shop_(emp)) return { error: '已經有小店了' };
  var type = String(p.type || ''), name = String(p.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12);
  if (PV_SHOP_TYPES.indexOf(type) < 0) return { error: '店型不正確' };
  if (!name) return { error: '請幫小店取名字' };
  var fee = pv_param_('小店開店費'); if (gm_balance_(emp) < fee) return { error: '赤心幣不足(開店費 ' + fee + ' 枚)' };
  gm_credit_(emp, '開店費', -fee, '開了「' + name + '」' + (testing ? '（測試期免資歷門檻）' : ''), 'SHOPOPEN|' + emp + '|' + gm_today_());
  pv_append_('shops', [[emp, name, type, gm_now_(), '{}', 0, 0, '']]);
  return { success: true };
}
