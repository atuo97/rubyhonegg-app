// ═══════════════════════════════════════════════
// 內帳、大隊長個人行事曆、重設密碼、報價單：一定要有效的登入通行證（2026-11-13，部署端）
// v2（v1.30 部署時）：加上 s30_pwReset_（管理者重設夥伴密碼）與 qt_need_（報價單）；本檔改放在「報價單」之後、「路由」之前
// 問題：「登入驗證模式」目前是「記錄」，沒帶通行證的呼叫照樣放行、後端相信傳來的員工編號。
//       內帳（ac_need_）與個人行事曆（cal_isBoss_）只看員工編號，帶大隊長編號就能讀財務資料與個人行程。
// 修正：這兩項不管模式，一律要有效通行證，且通行證本人是 Lv.5（夥伴視角時是被看的人，自然不會是大隊長）。
// 貼在「報價單 v1」之後、「路由v1.30」之前（必須在赤心幣花費之後，覆蓋才會生效）。覆蓋：auHandler_、ac_need_、cal_isBoss_、s30_pwReset_、qt_need_
// ═══════════════════════════════════════════════
var AU_REQ_ = null;
function au_verifiedId_() {
  var p = AU_REQ_; if (!p || !p.token) return '';
  var tid = au_tokenId_(p.token);
  return tid && sec_verifyToken_(p.token, tid) ? tid : '';
}
function auHandler_(action, p) {
  AU_REQ_ = p || null;
  if (action === 'getDailyReport') { try { return au_dailyScoped_(p); } catch (e) { return null; } }
  if (action === 'getBatterStock' && p.mine) {
    try {
      var sc = au_scope_(p.empId), r = bt_get_(p);
      if (sc && !sc.all && r && r.success) r.data = (r.data || []).filter(function (x) { return sc.has(x.loc) || sc.has(x.code); });
      return r;
    } catch (e) { return null; }
  }
  if (!/^au[A-Z]/.test(String(action || ''))) return null;
  try {
    switch (action) {
      case 'auWho':    return au_who_(p);
      case 'auViewAs': return au_viewAs_(p);
      case 'auPeople': return au_people_(p);
    }
  } catch (e) { return { error: e.message }; }
  return null;
}
function ac_need_(p) {
  var tid = au_verifiedId_();
  if (!tid) throw new Error('請更新 App 後重新登入');
  var me = ops_me_(tid); if (me.role < 5) throw new Error('內帳只有大隊長可以使用');
  return me;
}
function cal_isBoss_(emp) {
  var e = gm_emp_(emp); if (!e || e.role < 5) return false;
  if (!AU_REQ_) return true;               // 觸發程序（每天 8 點推播）沒有請求
  return au_verifiedId_() === String(emp);
}

// v1.30：管理者重設密碼 — 原本只看傳來的員工編號；「記錄」模式下沒登入也能冒用管理者編號把別人密碼改成生日
function s30_pwReset_(p) {
  var tid = au_verifiedId_(); if (!tid) return { error: '請更新 App 後重新登入' };
  p.empId = tid;                                   // 重設者一律以通行證本人為準（不能冒用別人編號）
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

// v1.30：報價單 — 報價紀錄有客戶資料與金額，一律要有效通行證、本人 Lv.3 以上
function qt_need_(p) {
  var tid = au_verifiedId_(); if (!tid) throw new Error('請更新 App 後重新登入');
  p.empId = tid;
  var me = ops_me_(tid); if (me.role < 3) throw new Error('報價單需要 Lv.3 以上'); return me;
}
