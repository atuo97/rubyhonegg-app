// ═══════════════════════════════════════════════
// 內帳與大隊長個人行事曆：一定要有效的登入通行證（2026-11-13，部署端）
// 問題：「登入驗證模式」目前是「記錄」，沒帶通行證的呼叫照樣放行、後端相信傳來的員工編號。
//       內帳（ac_need_）與個人行事曆（cal_isBoss_）只看員工編號，帶大隊長編號就能讀財務資料與個人行程。
// 修正：這兩項不管模式，一律要有效通行證，且通行證本人是 Lv.5（夥伴視角時是被看的人，自然不會是大隊長）。
// 貼在「內帳 v1」之後、「路由v1.29」之前。覆蓋：auHandler_（只多記下本次請求）、ac_need_、cal_isBoss_
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
