// ═══════════════════════════════════════════════
// v1.43 勞健保公司負擔（2026-11-14，部署端合併版：放在路由 v1.42 之後，最後一行改交給 v42Route_）
// 原檔：後端_勞健保公司負擔_v1.43_20261114_v1.gs（交給 v41Route_）
// 放在檔案「最後」（路由 v1.41 之後）。只新增一個讀取動作 getMyIns（get 開頭＝隊員視角可讀）：
//   回傳「通行證本人」（或管理者 viewAs 的對象）的勞健保自付額與公司負擔。
// 安全：一律以通行證判斷身分，沒有有效通行證就擋（不看 p.empId）。
// 資料來源〈夥伴資料〉：V 勞保員工自付(21)、W 勞保雇主負擔(22)、AA 健保員工自付(26)、
//   AC 健保雇主負擔(28)、「勞退雇主提繳」欄（依表頭名稱找，v1.43 新增在最後一欄）。
// 覆蓋 extHandler_：getMyIns 先處理，其餘一律交給 v41Route_（與 v1.41 完全相同）。
// 若 v1.42 已改了 extHandler_／路由：把下面 extHandler_ 第一段 if 合併進新版 extHandler_ 即可。
// ═══════════════════════════════════════════════
function v43_myIns_(p) {
  var tid = au_tokenId_(p.token);
  if (!tid || !sec_verifyToken_(p.token, tid)) return { error: '登入已過期，請重新登入', relogin: true };
  var f = au_findRow_(tid);
  if (!f) return { error: '找不到隊員資料' };
  var row = f.row, head = f.head, pc = -1;
  for (var i = 0; i < head.length; i++) if (String(head[i]).trim() === '勞退雇主提繳') { pc = i; break; }
  var n = function (v) { return parseFloat(v) || 0; };
  return { success: true, data: {
    labor: n(row[21]), health: n(row[26]),
    laborEmp: n(row[22]), healthEmp: n(row[28]), pensionEmp: pc >= 0 ? n(row[pc]) : 0
  } };
}
function extHandler_(action, p) {
  if (action === 'getMyIns') {
    p = p || {};
    var gate = au_gate_(action, p); if (gate) return v41_wordRes_(gate);   // viewAs 會在這裡換成對象的通行證
    try { return v41_wordRes_(v43_myIns_(p)); } catch (e) { return { error: '勞健保資料錯誤:' + e.message }; }
  }
  return v41_wordRes_(v42Route_(action, p));
}
