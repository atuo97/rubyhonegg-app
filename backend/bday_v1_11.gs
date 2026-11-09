// ═══════════════════════════════════════════════
// 今日壽星 後端模組 v1.11(2026-11-10)
// 只回傳「今天生日的在職夥伴姓名」,不回傳生日日期或其他個資。
// 欄位沿用既有程式:夥伴資料 [1]姓名、[4]生日、[10]離職(有值=離職)
// 路由:extHandler_ 內 action === 'getTodayBirthdays'
// ═══════════════════════════════════════════════

// 把各種生日寫法轉成 [月, 日];認不出來回 null
function bday_parse_(v) {
  if (v instanceof Date) {
    return [Number(Utilities.formatDate(v, 'Asia/Taipei', 'M')), Number(Utilities.formatDate(v, 'Asia/Taipei', 'd'))];
  }
  var s = String(v == null ? '' : v).trim();
  if (!s) return null;
  var m = s.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);            // 1990-06-07、1990/6/7
  if (m) return [Number(m[2]), Number(m[3])];
  m = s.match(/^(\d{1,2})\s*[\/\-.月]\s*(\d{1,2})/);               // 06/07、6月7日
  if (m) return [Number(m[1]), Number(m[2])];
  var d = s.replace(/\D/g, '');
  if (d.length === 8) return [Number(d.slice(4, 6)), Number(d.slice(6, 8))];  // 19900607
  if (d.length === 4) return [Number(d.slice(0, 2)), Number(d.slice(2, 4))];  // 0607
  return null;
}

function bday_today_(p) {
  var today = String((p && p.date) || Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd'));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
  var mm = Number(today.slice(5, 7)), dd = Number(today.slice(8, 10));
  var v = SpreadsheetApp.openById(SHEET_ID).getSheetByName('夥伴資料').getDataRange().getValues();
  var out = [];
  for (var r = 1; r < v.length; r++) {
    if (!v[r][0] || v[r][10]) continue;                 // 沒編號或已離職
    var name = String(v[r][1] || '').trim();
    if (!name) continue;
    var md = bday_parse_(v[r][4]);
    if (md && md[0] === mm && md[1] === dd) out.push(name);
  }
  return { success: true, data: out };
}
