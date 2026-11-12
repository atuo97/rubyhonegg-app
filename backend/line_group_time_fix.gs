// ═══════════════════════════════════════════════
// LINE 群組時間格式修正（2026-11-12，部署端）
// 問題：〈LINE群組〉E 加入時間／F 最後更新 被試算表自動轉成日期，讀回時變成「Thu Nov 12 2026 …」英文字串，
//       存群組設定時又把這串寫回去。改成讀取時一律格式化為 yyyy-MM-dd HH:mm:ss。
// 一次性：line_fixGroupTimes() 把已經變成英文字串的格子改回正確格式。
// ═══════════════════════════════════════════════
function line_fmtTime_(v) {
  if (v === '' || v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v.getTime()) ? '' : Utilities.formatDate(v, 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
  var s = String(v);
  if (/^[A-Z][a-z]{2} [A-Z][a-z]{2} \d{1,2} \d{4} \d{2}:\d{2}:\d{2}/.test(s)) { var d = new Date(s); if (!isNaN(d.getTime())) return Utilities.formatDate(d, 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss'); }
  return s;
}
function line_groups_() {
  var sh = line_sheet_();
  if (String(sh.getRange(1, 7).getValue() || '') !== '綁定櫃位') sh.getRange(1, 7).setValue('綁定櫃位');
  return (sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues() : []).map(function (r, i) {
    return { row: i + 2, id: String(r[0]), name: String(r[1] || ''), status: String(r[2] || ''), use: String(r[3] || '公告'), joined: line_fmtTime_(r[4]),
      locs: String(r[6] || '').split(/[、,，]+/).map(function (x) { return x.trim(); }).filter(String) };
  }).filter(function (g) { return g.id; });
}
function line_fixGroupTimes() {
  var sh = line_sheet_(), n = sh.getLastRow() - 1, fixed = 0;
  if (n < 1) { Logger.log('沒有群組'); return; }
  var rg = sh.getRange(2, 5, n, 2), v = rg.getValues();
  var out = v.map(function (r) { return r.map(function (c) { var f = line_fmtTime_(c); if (f !== String(c === null ? '' : c)) fixed++; return f; }); });
  rg.setNumberFormat('@').setValues(out);
  Logger.log('〈LINE群組〉E、F 欄已統一為 yyyy-MM-dd HH:mm:ss 文字格式；共 ' + n + ' 列，改寫 ' + fixed + ' 格');
}
