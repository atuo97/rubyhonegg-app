// ═════════════════════════════════════════════════════════════
// v1.34 開店資格修正（隊長 11/13 23:52：「我無法領到開店要的徽章」）
// 底版：後端第 36 版（部署交接 v4）。放在「測試期提前開放 v1.33」之後、路由之前。
// 問題：v1.33 只改了「開店」(sp_open_) 在測試期不需要「資歷・銅」徽章，
//       但「小店街列表」(sp_list_) 回傳的 eligible 仍然只看徽章 → 前端不顯示開店按鈕，
//       畫面只寫「累計工時達 1080 小時（資歷・銅徽章）就可以開店」，等於還是開不了。
// 修正：覆蓋 sp_list_，正式版開始日之前 eligible 一律為 true（與 v1.33 sp_open_ 同一個判斷）；
//       正式版之後恢復只看徽章。另外回傳 testing 讓前端之後可以顯示「測試期免門檻」。
// 覆蓋的函式：sp_list_（唯讀查詢，不在交接第 3 節清單內；不花幣、不改資料，不需通行證）
// 不需要執行 setup。
// ═════════════════════════════════════════════════════════════
function sp_list_(p) {
  var emps = gm_emps_(), me = String(p.empId || '').trim();
  var shops = pv_rows_('shops').map(function (r) {
    var s = sp_shop_(r[0]); var e = emps[s.owner];
    return { owner: s.owner, ownerName: e ? (e.nick || e.name) : s.owner, name: s.name, type: s.type, level: sp_level_(s.sales), sales: s.sales, notice: s.notice, items: sp_items_(s.type, s.prices) };
  });
  var offV = gm_param_('正式版開始日');   // 儲存格若被試算表轉成日期，先轉回 yyyy-MM-dd 再比
  var off = String(offV instanceof Date ? Utilities.formatDate(offV, 'Asia/Taipei', 'yyyy-MM-dd') : (offV || '')).trim(), testing = !off || gm_today_() < off;
  var eligible = testing || gm_hasBadge_(me, 'tenure_1', '');
  var gifts = pv_rows_('gifts').filter(function (r) { return r[2] === me; }).slice(-10).reverse().map(function (r) {
    var f = emps[r[1]], c = gm_catalog_()[r[3]] || {}; return { time: String(r[0]), from: f ? (f.nick || f.name) : r[1], item: c.name, icon: String(c.note || '').split(':')[1] || '🎁', unread: !r[4] };
  });
  var people = Object.keys(emps).filter(function (k) { return !emps[k].resigned && k !== me; }).map(function (k) { return { id: k, name: emps[k].nick || emps[k].name }; });
  return { success: true, data: { people: people, shops: shops, mine: sp_shop_(me) ? shops.filter(function (s) { return s.owner === me; })[0] : null, eligible: eligible, testing: testing,
    types: PV_SHOP_TYPES, fee: pv_param_('小店開店費'), share: pv_param_('小店店主分潤'), threshold: String(gm_param_('資歷門檻') || '1080').split(',')[0], gifts: gifts, balance: gm_balance_(me) } };
}
