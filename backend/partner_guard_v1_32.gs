// ═══════════════════════════════════════════════
// v1.32 夥伴資料權限保護（2026-11-13，隊長 19:37「管理等級 3 不可以改我的權限」）
// 貼在「內帳與個人行事曆權限修正 v2」（部署端）與「赤心幣平衡 v1.31」之後（如果已部署）、「路由v1.30」之前（放最後面也可以，路由不用換）
// 覆蓋：ops_staffUpdate_（夥伴資料修改）、s30_pwReset_（重設密碼，保留部署端的通行證檢查）
// 規則：
// 1. 大隊長（權限等級 5，或職務寫「大隊長」）的資料只有大隊長本人可以修改；密碼也只有本人能改
// 2. 其他管理者只能修改「權限比自己低」的夥伴；同等級、更高等級、自己都不能改；權限只能設到自己的等級為止
// 3. 大隊長不能把自己的權限調低、不能幫自己填離職日（避免誤按把自己鎖在外面）
// 4. 修改者一律以登入通行證本人為準（不能冒用別人的員工編號）
// ═══════════════════════════════════════════════
// ── v2（部署端，11/13 20:40）──
// 漏洞：系統把「職務＝大隊長」的人當成大隊長（gm_isTop_、ops_me_、p31_isBoss_）。v1 只擋改大隊長本人，
//       Lv.3 仍可把某位夥伴（或自己能重設密碼的帳號）的職務改成「大隊長」、或新增職務「大隊長」的帳號，進而改大隊長資料、發幣。
// 修正：只有大隊長本人可以把職務設成含「大隊長」；ops_staffAdd_ 覆蓋一份（原文＋同一行檢查）。
function p31_isBoss_(o) { return !!o && (Number(o.role) >= 5 || String(o.pos || '') === '大隊長'); }
function p31_canEdit_(me, x) {
  if (!me || !x) return false;
  if (p31_isBoss_(x)) return p31_isBoss_(me) && me.id === x.id ? 'self' : p31_isBoss_(me);
  if (p31_isBoss_(me)) return true;
  if (me.id === x.id) return false;
  return Number(x.role) < Number(me.role);
}
function p31_tid_(p) {   // 通行證本人；部署端的 au_verifiedId_ 不在時，退回驗證 p.token
  if (typeof au_verifiedId_ === 'function') return au_verifiedId_();
  return p.token && sec_verifyToken_(p.token, String(p.empId || '')) ? String(p.empId) : '';
}
function ops_staffUpdate_(p) {
  var tid = p31_tid_(p); if (!tid) return { error: '請更新 App 後重新登入' };
  p.empId = tid;
  var me = ops_need_(p, 3, true), d = typeof p.staff === 'string' ? ops_json_(p.staff, {}) : (p.staff || {});
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    OPS_C_.staff = null;
    var st = ops_staff_(), c = OPS_C_.staffCols, x = st.map[String(d.id || '')], sh = ops_ss_().getSheetByName('夥伴資料');
    if (!x) return { error: '找不到夥伴' };
    var real = st.map[me.id] || me, ok = p31_canEdit_({ id: me.id, role: real.role, pos: real.pos }, x);
    if (!ok) return { error: p31_isBoss_(x) ? '大隊長的資料只有大隊長本人可以修改' : x.id === me.id ? '不能修改自己的權限，請找大隊長' : '只能修改權限比你低的夥伴' };
    var role = parseInt(d.role, 10);
    if (!(role >= 1 && role <= 5)) return { error: '權限等級要 1～5' };
    if (role > Math.max(Number(real.role) || 0, p31_isBoss_(real) ? 5 : 0)) return { error: '不能設定比自己高的權限' };
    if (ok === 'self' && role < 5) return { error: '大隊長不能把自己的權限調低' };
    if (ok === 'self' && d.left) return { error: '不能幫自己填離職日' };
    if (!p31_isBoss_(real) && /大隊長/.test(String(d.pos || '')) && String(d.pos || '').trim() !== String(x.pos || '').trim()) return { error: '只有大隊長可以設定「大隊長」職務' };   // v2（部署端）
    if (role === 2 && !String(d.managed || '').trim()) return { error: '分隊長要選負責櫃位' };
    if (c.type < 0) { c.type = sh.getLastColumn(); sh.getRange(1, c.type + 1).setValue('帳號類型'); }
    sh.getRange(x.row, c.role + 1).setValue(role);
    sh.getRange(x.row, c.pos + 1).setValue(String(d.pos || x.pos));
    sh.getRange(x.row, c.managed + 1).setValue(String(d.managed || ''));
    sh.getRange(x.row, c.type + 1).setValue(/加盟/.test(d.type) ? '加盟店夥伴' : /合作/.test(d.type) ? '合作夥伴' : '員工');
    if (d.left !== undefined) sh.getRange(x.row, 11).setValue(String(d.left || ''));
    OPS_C_.staff = null;
    return { success: true };
  } finally { lock.releaseLock(); }
}
// 重設密碼：部署端 v2 版（通行證本人）＋大隊長保護
function s30_pwReset_(p) {
  var tid = p31_tid_(p); if (!tid) return { error: '請更新 App 後重新登入' };
  p.empId = tid;
  var me = gm_emp_(p.empId), target = String(p.target || '').trim();
  if (!me || me.resigned || me.role < 3) return { error: '需要 Lv.3 以上才能重設密碼' };
  if (!target || target === me.id) return { error: '自己的密碼請到「我的」修改' };
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('夥伴資料'), v = sh.getDataRange().getValues(), pwC = sec_pwCol_(v[0]);
  for (var r = 1; r < v.length; r++) {
    if (String(v[r][0]).trim() !== target) continue;
    var role = Number(v[r][12]) || 1, x = { id: target, role: role, pos: String(v[r][11] || '').trim() };
    if (p31_isBoss_(x) && !p31_isBoss_(me)) return { error: '大隊長的密碼只有大隊長本人可以改' };
    if (!p31_isBoss_(me) && role >= me.role) return { error: '只能重設權限比你低的夥伴' };
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
// v2（部署端）：新增夥伴也不能由非大隊長設定「大隊長」職務
function ops_staffAdd_(p) {
  var me = ops_need_(p, 3, true);
  var d = typeof p.staff === 'string' ? ops_json_(p.staff, {}) : (p.staff || {});
  var req = { name: '姓名', nick: '暱稱', phone: '手機', bday: '生日', hire: '到職日', role: '權限等級', pos: '職務', idno: '身分證字號', addr: '通訊地址' };
  for (var k in req) if (!String(d[k] || '').trim()) return { error: '請填「' + req[k] + '」' };
  var phone = String(d.phone).replace(/\D/g, '');
  if (!/^09\d{8}$/.test(phone)) return { error: '手機格式不正確（09 開頭共 10 碼）' };
  var idno = String(d.idno).trim().toUpperCase();
  if (!/^[A-Z][0-9A-Z]\d{8}$/.test(idno)) return { error: '身分證字號格式不正確（含居留證號）' };
  var role = parseInt(d.role, 10); if (!(role >= 1 && role <= 5)) return { error: '權限等級要 1～5' };
  if (role > me.role) return { error: '不能新增比自己權限高的帳號' };
  if (!p31_isBoss_(me) && /大隊長/.test(String(d.pos || ''))) return { error: '只有大隊長可以設定「大隊長」職務' };   // v2（部署端）
  var type = /加盟/.test(d.type) ? '加盟店夥伴' : /合作/.test(d.type) ? '合作夥伴' : '員工';
  if (role === 2 && !String(d.managed || '').trim()) return { error: '分隊長要填負責櫃位' };
  var bm = String(d.bday).match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!bm) return { error: '生日格式不正確' };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    OPS_C_.staff = null;
    var st = ops_staff_(), c = OPS_C_.staffCols, sh = ops_ss_().getSheetByName('夥伴資料');
    if (st.list.some(function (x) { return String(x.raw[c.phone] || '').replace(/\D/g, '') === phone && !x.left; })) return { error: '這支手機已經有帳號了' };
    var max = 0; st.list.forEach(function (x) { var n = parseInt(String(x.id).replace(/\D/g, ''), 10); if (n > max) max = n; });
    var id = 'E' + ('00' + (max + 1)).slice(-3);
    if (c.type < 0) { c.type = sh.getLastColumn(); sh.getRange(1, c.type + 1).setValue('帳號類型'); }
    var width = Math.max(sh.getLastColumn(), c.type + 1, c.managed + 1, c.pw + 1), row = [];
    for (var i = 0; i < width; i++) row.push('');
    row[c.id] = id; row[c.name] = String(d.name).trim(); row[c.nick] = String(d.nick).trim(); row[c.sex] = String(d.sex || '');
    row[c.bday] = ops_rocDate_(d.bday); row[c.idno] = idno; row[c.phone] = phone; row[c.addr2] = String(d.addr).trim();
    if (d.addr1) row[c.addr] = String(d.addr1).trim();
    row[c.hire] = String(d.hire); row[c.pos] = String(d.pos).trim(); row[c.role] = role; row[c.wage] = 196;
    row[c.pw] = bm[2] + bm[3];                      // 預設密碼＝生日 MMDD（登入時自動加密，首頁會提醒改）
    row[c.managed] = String(d.managed || ''); row[c.type] = type;
    var r = sh.getLastRow() + 1;
    sh.getRange(r, 1, 1, width).setNumberFormat('@').setValues([row.map(String)]);
    sh.getRange(r, c.role + 1).setNumberFormat('0').setValue(role);
    sh.getRange(r, c.wage + 1).setNumberFormat('0').setValue(196);
    if (type !== '合作夥伴') ops_sheet_('到職檢查', OPS_ONB_HEAD).appendRow([id, String(d.name).trim(), ops_now_(), '', '', '', '', '']);
    OPS_C_.staff = null;
    return { success: true, id: id, password: bm[2] + bm[3] };
  } finally { lock.releaseLock(); }
}
