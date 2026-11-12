// ═══════════════════════════════════════════════
// 登入驗證＋夥伴視角 v1.25（2026-11-12）— 貼在「叫貨報修」之後、「路由v1.25」之前
// 1. 統一驗證：除了登入、LINE Webhook 等公開動作，其他呼叫都要帶登入通行證（token）。
//    〈參數設定〉「登入驗證模式」：記錄（預設，只記下沒帶或錯誤的次數，不擋）／強制（擋下並要求重新登入）。
//    舊版 App 沒帶 token；全員更新到 v1.25 一週後，再把模式改成「強制」。執行 au_report() 看記錄。
// 2. 記住登入：auWho（用 token 換最新的使用者資料，離職或權限變更立即生效）。
// 3. 夥伴視角（Lv.5）：auViewAs 取得某位夥伴的使用者資料；之後帶 viewAs＝對方編號，後端以對方身分「只讀」，
//    任何新增、修改、刪除、打卡一律擋下。
// 4. 叫貨單與門市回報編號改成不會重複。
// 覆蓋：ops_matCreate_（只改編號）
// v2（部署端，2026-11-12）：LINE 叫貨通知保留原本的「備註」與署名格式（v1 少了備註）
// ═══════════════════════════════════════════════

var AU_PUBLIC = ['login', 'lineWebhook', 'getLocations', 'getLocationsApi', 'ping'];
// 夥伴視角時「只放行讀取」的動作（其餘新增、修改、刪除、打卡、送出、玩遊戲…一律擋下）
var AU_READ = /^(get|check|estimate)|List$|^(annFeed|annOptions|annReaders|buList|opsFranchise|opsMatItems|opsMatMonthly|opsMe|opsOnboard|opsPnl|opsPriceList|opsReceivable|payRecon|pvLiveMine|pvLiveState|pvMe|rpCount|rpMeta|schBoard|schMine|schReconcile|spList|spScene|tdMe|gmMe|gmScene|gmGames|lineGroups|lineQuota|login)$/;
// 一定要登入且達到等級才能用的動作（不受「記錄」模式影響，舊版 App 呼叫也會擋）
var AU_ADMIN = { estimateSalaryFromSchedule: 3, applyInsuranceGrade: 3 };
// 允許 empId 是別人（看別人上班狀態、替別人補登）；身分以 token 為準
var AU_OTHER = ['getActiveSegment', 'applyInsuranceGrade', 'manualCloseSegment'];
var AU_ROLE_CACHE = {};

function au_mode_() {
  var c = CacheService.getScriptCache(), v = c.get('au_mode');
  if (v) return v;
  v = '記錄';
  try { if (typeof ops_param_ === 'function') v = String(ops_param_('登入驗證模式', '記錄')).trim() || '記錄'; } catch (e) {}
  c.put('au_mode', v, 300);
  return v;
}
function au_log_(kind, action) {
  try {
    var c = CacheService.getScriptCache(), k = 'au_log_' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMdd');
    var o = JSON.parse(c.get(k) || '{}'); o[kind] = (o[kind] || 0) + 1;
    var ak = kind + ':' + action; o.a = o.a || {}; o.a[ak] = (o.a[ak] || 0) + 1;
    c.put(k, JSON.stringify(o), 21600);
  } catch (e) {}
}
// 看最近的驗證記錄（Apps Script 執行後看「執行紀錄」）
function au_report() {
  var c = CacheService.getScriptCache(), out = [];
  for (var i = 0; i < 1; i++) {
    var d = new Date(Date.now() - i * 86400000), k = 'au_log_' + Utilities.formatDate(d, 'Asia/Taipei', 'yyyyMMdd');
    out.push(k + '：' + (c.get(k) || '（無）'));
  }
  Logger.log('目前模式：' + au_mode_() + '\n' + out.join('\n') + '\n說明：miss＝沒帶 token（多半是還沒更新的舊版 App）、bad＝token 不對或過期、mismatch＝token 與員工編號不一致');
  return out;
}
function au_role_(empId) {
  if (AU_ROLE_CACHE[empId] !== undefined) return AU_ROLE_CACHE[empId];
  var v = SpreadsheetApp.openById(SHEET_ID).getSheetByName('夥伴資料').getDataRange().getValues(), r = 0;
  for (var i = 1; i < v.length; i++) if (String(v[i][0]).trim() === String(empId)) { r = v[i][10] ? -1 : (parseInt(v[i][12]) || 1); break; }
  return (AU_ROLE_CACHE[empId] = r);
}
function au_tokenId_(token) { var a = String(token || '').split('.'); return a.length === 3 ? a[0] : ''; }

// 路由最前面呼叫；回傳物件＝擋下，null＝放行（可能已把 p 改成夥伴視角）
function au_gate_(action, p) {
  if (!action && p && p.payload) {                          // 舊版 GET 寫入（payload 包 JSON）
    try { var d = JSON.parse(decodeURIComponent(p.payload)); action = d.action; p.token = p.token || d.token; p.empId = p.empId || d.empId; } catch (e) {}
  }
  if (!action || AU_PUBLIC.indexOf(action) >= 0) return null;
  var strict = au_mode_() === '強制', tok = p.token, tid = au_tokenId_(tok);
  if (AU_ADMIN[action]) {                                    // 薪資預估、勞健保級距：只限管理者
    if (!tok || !tid || !sec_verifyToken_(tok, tid)) return { error: '請更新 App 後重新登入', relogin: true };
    if (au_role_(tid) < AU_ADMIN[action] && !p.viewAs) return { error: '無權限' };
  }
  if (!tok) { au_log_('miss', action); return strict ? { error: '請重新登入（App 已更新）', relogin: true } : null; }
  if (!tid || !sec_verifyToken_(tok, tid)) { au_log_('bad', action); return strict ? { error: '登入已過期，請重新登入', relogin: true } : null; }
  if (p.viewAs) {                                            // 夥伴視角（只讀）
    if (au_role_(tid) < 5) return { error: '只有大隊長可以用夥伴視角' };
    if (!AU_READ.test(action)) return { error: '預覽模式只能看，不能修改', viewOnly: true };
    var target = String(p.viewAs);
    if (au_role_(target) === 0) return { error: '找不到這位夥伴' };
    p.empId = target; p.token = sec_makeToken_(target); p._viewAs = tid; if (p.managerId) p.managerId = target;
    return null;
  }
  p._by = tid;
  if (p.managerId !== undefined && p.managerId !== '') p.managerId = tid;   // 排班、補登：管理者身分以 token 為準
  else if (p.empId && String(p.empId) !== tid && AU_OTHER.indexOf(action) < 0) { au_log_('mismatch', action); if (strict) return { error: '身分不一致，請重新登入', relogin: true }; }
  if (!p.empId) p.empId = tid;
  return null;
}

// ── 使用者資料（與登入回傳相同格式）──
function au_userObj_(row) {
  return { id: String(row[0]), name: String(row[1]), avatar: String(row[1]).slice(0, 1), role: parseInt(row[12]) || 1,
    position: String(row[11]), birthday: String(row[4]), hourly: parseFloat(row[13]) || 190, labor: parseFloat(row[21]) || 0,
    health: parseFloat(row[26]) || 0, noInsure: parseFloat(row[29]) || 0, skillLevel: parseFloat(row[32]) || 0,
    contribLevel: parseFloat(row[33]) || 0, longAge: parseFloat(row[34]) || 0, checkupExpiry: String(row[31] || '') };
}
function au_findRow_(empId) {
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('夥伴資料'), v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]).trim() === String(empId)) return { row: v[i], head: v[0] };
  return null;
}
// 記住登入：用 token 換最新資料
function au_who_(p) {
  var tid = au_tokenId_(p.token);
  if (!tid || !sec_verifyToken_(p.token, tid)) return { error: '登入已過期，請重新登入', relogin: true };
  var f = au_findRow_(tid); if (!f) return { error: '找不到帳號', relogin: true };
  if (f.row[10]) return { error: '帳號已停用', relogin: true };
  var u = au_userObj_(f.row), pwC = sec_pwCol_(f.head), bd = sec_bdayPw_(f.row[4]), st = String(f.row[pwC] || '');
  u.weakPw = !!bd && (st === bd || (sec_isHashed_(st) && sec_check_(bd, st)));
  u.token = p.token;
  var a = String(p.token).split('.'); if (Number(a[1]) - Date.now() < 7 * 86400000) u.token = sec_makeToken_(tid);   // 剩不到 7 天就換新
  return { success: true, user: u };
}
// 夥伴視角：取得對方的使用者資料（Lv.5）
function au_viewAs_(p) {
  var tid = au_tokenId_(p.token);
  if (!tid || !sec_verifyToken_(p.token, tid)) return { error: '請重新登入', relogin: true };
  if (au_role_(tid) < 5) return { error: '只有大隊長可以用夥伴視角' };
  var f = au_findRow_(p.target); if (!f) return { error: '找不到這位夥伴' };
  var u = au_userObj_(f.row); u.weakPw = false;
  return { success: true, user: u };
}
// 夥伴清單（給 Lv.5 選夥伴視角）
function au_people_(p) {
  var tid = au_tokenId_(p.token);
  if (!tid || !sec_verifyToken_(p.token, tid) || au_role_(tid) < 5) return { error: '只有大隊長可以用夥伴視角' };
  var v = SpreadsheetApp.openById(SHEET_ID).getSheetByName('夥伴資料').getDataRange().getValues(), h = v[0].map(String), tc = h.indexOf('帳號類型'), mc = h.indexOf('負責櫃位');
  var out = [];
  for (var i = 1; i < v.length; i++) {
    var r = v[i]; if (!r[0] || r[10]) continue;
    out.push({ id: String(r[0]), name: String(r[1]), role: parseInt(r[12]) || 1, pos: String(r[11] || ''), type: tc >= 0 ? String(r[tc] || '員工') : '員工', locs: mc >= 0 ? String(r[mc] || '') : '' });
  }
  out.sort(function (a, b) { return b.role - a.role || (a.id < b.id ? -1 : 1); });
  return { success: true, data: out };
}
// 分隊長／加盟主（Lv.2）只看自己負責的櫃位
function au_scope_(empId) {
  var f = au_findRow_(empId); if (!f) return null;
  var role = parseInt(f.row[12]) || 1;
  if (role >= 3) return { role: role, all: true };
  var mine = String(f.row[46] || '').split(/[,，、]/).map(function (s) { return s.trim(); }).filter(Boolean);
  return { role: role, all: false, has: function (loc) { var a = String(loc || '').trim(), b = a.replace(/^\d+/, ''); return mine.some(function (m) { var mb = m.replace(/^\d+/, ''); return m === a || mb === b || (mb.length >= 2 && b.indexOf(mb) >= 0); }); } };
}
function au_dailyScoped_(p) {
  var sc = au_scope_(p.empId); if (!sc || sc.all) return null;   // null＝交給原本的日報
  var r = rp_report_(p); if (!r || !r.success || !r.data) return r;
  var d = r.data;
  d.stores = (d.stores || []).filter(function (s) { return sc.has(s.loc); });
  d.abnormal = (d.abnormal || []).filter(function (a) { return sc.has(a.loc); });
  var rev = 0, hrs = 0, ord = 0, use = 0;
  d.stores.forEach(function (s) { rev += Number(s.rev) || 0; hrs += Number(s.hours) || 0; ord += Number(s.orders) || 0; use += Number(s.useTotal) || 0; });
  d.total = { rev: rev, orders: ord, useTotal: use, hours: Math.round(hrs * 10) / 10 };
  d.perHour = hrs ? Math.round(rev / hrs) : 0;
  return r;
}
function auHandler_(action, p) {
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

// ── 不會重複的編號 ──
function au_id_(prefix) { return prefix + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss') + Utilities.getUuid().replace(/-/g, '').slice(0, 4).toUpperCase(); }
// 覆蓋 ops_matCreate_：只改編號（原本秒＋2 位亂數，同一秒可能撞號）
function ops_matCreate_(p) {
  var me = ops_me_(p.empId), loc = String(p.loc || '').trim();
  if (!ops_locByName_(loc)) return { error: '請選櫃位' };
  if (me.role < 3 && ops_myLocs_(me).indexOf(loc) < 0 && me.type !== '員工') return { error: '只能替自己的櫃位叫貨' };
  var items = ops_arr_(p.items).map(function (x) { return { item: String(x.item || '').trim().slice(0, 20), qty: ops_num_(x.qty), unit: String(x.unit || '').slice(0, 6), note: String(x.note || '').slice(0, 40) }; })
    .filter(function (x) { return x.item && x.qty > 0; });
  if (!items.length) return { error: '請至少填一項數量' };
  var id = au_id_('M');
  var log = [{ s: '已送出', by: me.name, at: ops_now_() }];
  ops_sheet_('物料需求', OPS_MAT_HEAD).appendRow([id, ops_now_(), me.id, me.name, loc, JSON.stringify(items), String(p.want || ''), String(p.note || '').slice(0, 200), '已送出', '', '', '', '', JSON.stringify(log)]);
  try { if (typeof line_notify_ === 'function') line_notify_('物料', '📦 物料需求｜' + loc.replace(/^\d+/, '') + '\n' + items.map(function (x) { return '・' + x.item + ' ' + x.qty + (x.unit || ''); }).join('\n') + (p.want ? '\n希望到貨：' + p.want : '') + (p.note ? '\n備註：' + p.note : '') + '\n（' + me.name + '）'); } catch (e) {}
  return { success: true, id: id };
}

// 部署後執行一次：〈參數設定〉補「登入驗證模式」（預設：記錄）
function au_setup() {
  var ps = SpreadsheetApp.openById(SHEET_ID).getSheetByName('參數設定'), have = ps.getDataRange().getValues().map(function (r) { return String(r[0]).trim(); });
  if (have.indexOf('登入驗證模式') < 0) ps.appendRow(['登入驗證模式', '記錄', '記錄＝只記下沒帶通行證的呼叫，不擋；強制＝擋下並要求重新登入（全員更新 App 一週後再改）']);
  CacheService.getScriptCache().remove('au_mode');
  Logger.log('au_setup 完成，目前模式：' + au_mode_());
}
