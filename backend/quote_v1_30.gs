// ═══════════════════════════════════════════════
// v1.30 報價單（2026-11-13）— Lv.3 以上
// 貼在「赤心幣花費 v1.30」之後、「路由v1.30」之前。部署後執行一次 qt_setup()
// 做法：隊長原本的「紅玉滿報價系統」網頁放在雲端「紅玉滿赤心員工系統／報價單」資料夾，App 直接打開這個網頁；
//       網頁按「☁️ 存到雲端」→ 這裡把 Word 存進同一個資料夾，再轉一份 PDF，並記在〈報價紀錄〉
// 檔名：活動日期＋紅玉滿報價單＋報價日期，例：20260516-17-31紅玉滿報價單20260421.docx／.pdf（同名已存在就加 _v2、_v3）
// 之後要改報價網頁：把新的網頁（檔名以「報價系統」開頭、.html 結尾）放進「報價單」資料夾即可，App 會用最新的那一份
// ═══════════════════════════════════════════════

var QT_HEAD = ['編號', '報價日期', '活動日期', '客戶', '活動名稱', '金額', '狀態', '業務', 'Word', 'PDF', '檔名', '建立人', '建立時間', '表單資料', '更新時間'];
var QT_STATUS = ['已報價', '成交', '取消'];

function qt_need_(p) { var me = ops_me_(p.empId); if (me.role < 3) throw new Error('報價單需要 Lv.3 以上'); return me; }
function qt_sheet_() {
  var ss = ops_ss_(), sh = ss.getSheetByName('報價紀錄');
  if (!sh) { sh = ss.insertSheet('報價紀錄'); sh.getRange(1, 1, 1, QT_HEAD.length).setValues([QT_HEAD]); sh.setFrozenRows(1); }
  return sh;
}
// 「紅玉滿赤心員工系統／報價單」資料夾（〈參數設定〉「報價資料夾ID」可以指定）
function qt_folder_() {
  var id = '';
  try { id = String(ops_param_('報價資料夾ID') || '').trim(); } catch (e) {}
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var root = DriveApp.getFoldersByName('紅玉滿赤心員工系統'), parent = root.hasNext() ? root.next() : DriveApp.getRootFolder();
  var it = parent.getFoldersByName('報價單');
  return it.hasNext() ? it.next() : parent.createFolder('報價單');
}
// 最新的報價系統網頁
function qt_pageFile_() {
  var it = qt_folder_().getFiles(), best = null;
  while (it.hasNext()) { var f = it.next(), n = f.getName(); if (/^報價系統.*\.html?$/i.test(n) && (!best || f.getLastUpdated() > best.getLastUpdated())) best = f; }
  return best;
}
function qt_page_(p) {
  var me = qt_need_(p), f = qt_pageFile_();
  if (!f) return { error: '雲端「紅玉滿赤心員工系統／報價單」資料夾裡找不到報價系統網頁（檔名要以「報價系統」開頭、.html 結尾）' };
  var phone = '';
  try { var c = OPS_C_.staffCols; phone = c && c.phone >= 0 ? String(me.raw[c.phone] || '') : String(me.raw[6] || ''); } catch (e) {}
  return { success: true, name: f.getName(), updated: Utilities.formatDate(f.getLastUpdated(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm'),
    html: f.getBlob().getDataAsString('UTF-8'), agent: { name: me.name, phone: phone.replace(/^(\d{4})(\d{3})(\d{3})$/, '$1-$2-$3') } };
}
// 活動日期 → 檔名：20260516-17-31（同月只寫日、同年寫月日、跨年寫完整）
function qt_datePart_(dates) {
  var d = (dates || []).map(function (x) { return String(x).replace(/\D/g, '').slice(0, 8); }).filter(function (x) { return x.length === 8; }).sort();
  d = d.filter(function (x, i) { return d.indexOf(x) === i; });
  if (!d.length) return '';
  var out = d[0];
  for (var i = 1; i < d.length; i++) {
    var a = d[i - 1], b = d[i];
    out += '-' + (b.slice(0, 6) === a.slice(0, 6) ? b.slice(6) : b.slice(0, 4) === a.slice(0, 4) ? b.slice(4) : b);
  }
  return out;
}
function qt_uniqueName_(folder, base) {
  var n = 1, name = base;
  while (folder.getFilesByName(name + '.docx').hasNext() || folder.getFilesByName(name + '.pdf').hasNext()) { n++; name = base + '_v' + n; }
  return name;
}
// Word → Google 文件 → PDF（轉完把暫存的 Google 文件丟垃圾桶）
function qt_toPdf_(docxBlob, folder, name) {
  var boundary = 'rhq' + Date.now(), meta = JSON.stringify({ name: name + '（轉檔暫存）', mimeType: 'application/vnd.google-apps.document', parents: [folder.getId()] });
  var body = Utilities.newBlob('--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + meta + '\r\n--' + boundary +
    '\r\nContent-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document\r\n\r\n').getBytes()
    .concat(docxBlob.getBytes()).concat(Utilities.newBlob('\r\n--' + boundary + '--').getBytes());
  var res = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', {
    method: 'post', contentType: 'multipart/related; boundary=' + boundary, payload: body, muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } });
  if (res.getResponseCode() >= 300) throw new Error('轉檔失敗（' + res.getResponseCode() + '）');
  var gid = JSON.parse(res.getContentText()).id, g = DriveApp.getFileById(gid);
  var pdf = folder.createFile(g.getAs('application/pdf').setName(name + '.pdf'));
  try { g.setTrashed(true); } catch (e) {}
  return pdf;
}
function qt_rows_() {
  var sh = qt_sheet_(); if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, QT_HEAD.length).getValues().map(function (r, i) {
    return { row: i + 2, id: String(r[0]), qd: String(r[1]), dates: String(r[2]), client: String(r[3]), event: String(r[4]), amount: Number(r[5]) || 0,
      status: String(r[6] || '已報價'), agent: String(r[7]), word: String(r[8]), pdf: String(r[9]), file: String(r[10]), by: String(r[11]), at: String(r[12]),
      form: String(r[13] || ''), updated: String(r[14] || '') };
  }).filter(function (x) { return x.id; });
}
function qt_save_(p) {
  var me = qt_need_(p), meta = typeof p.meta === 'string' ? ops_json_(p.meta, {}) : (p.meta || {});
  var b64 = String(p.docx || ''); if (!b64) return { error: '沒有收到 Word 檔' };
  var dp = qt_datePart_(meta.dates); if (!dp) return { error: '請先選活動日期' };
  var qd = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMdd');
  var folder = qt_folder_(), name = qt_uniqueName_(folder, dp + '紅玉滿報價單' + qd);
  var docx = folder.createFile(Utilities.newBlob(Utilities.base64Decode(b64), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', name + '.docx'));
  var pdf = null, pdfErr = '';
  try { pdf = qt_toPdf_(docx.getBlob(), folder, name); } catch (e) { pdfErr = e.message; }
  [docx, pdf].forEach(function (f) { if (f) try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {} });
  var form = typeof p.form === 'string' ? p.form : JSON.stringify(p.form || {});
  var now = ops_now_(), lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var id = String(p.id || ''), hit = id ? qt_rows_().filter(function (x) { return x.id === id; })[0] : null;
    var v = [hit ? hit.id : 'Q' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss') + Utilities.getUuid().replace(/-/g, '').slice(0, 4).toUpperCase(), qd, (meta.dates || []).join('、'), String(meta.client || '').slice(0, 60), String(meta.event || '').slice(0, 60),
      Number(meta.amount) || 0, hit ? hit.status : '已報價', String(meta.agent || me.name).slice(0, 30), docx.getUrl(), pdf ? pdf.getUrl() : '', name, me.name, hit ? hit.at : now, form, now];
    var sh = qt_sheet_();
    if (hit) { var rng = sh.getRange(hit.row, 1, 1, QT_HEAD.length); rng.setNumberFormat('@'); rng.setValues([v.map(String)]); }
    else { var r2 = sh.getRange(sh.getLastRow() + 1, 1, 1, QT_HEAD.length); r2.setNumberFormat('@'); r2.setValues([v.map(String)]); }
  } finally { lock.releaseLock(); }
  return { success: true, id: v[0], name: name, word: docx.getUrl(), pdf: pdf ? pdf.getUrl() : '', pdfError: pdfErr, folder: folder.getUrl() };
}
function qt_list_(p) {
  qt_need_(p);
  return { success: true, data: qt_rows_().reverse().slice(0, 200).map(function (x) { var o = {}; for (var k in x) if (k !== 'row') o[k] = x[k]; return o; }), statuses: QT_STATUS };
}
function qt_status_(p) {
  qt_need_(p);
  var st = String(p.status || ''); if (QT_STATUS.indexOf(st) < 0) return { error: '狀態不對' };
  var hit = qt_rows_().filter(function (x) { return x.id === String(p.id); })[0]; if (!hit) return { error: '找不到這張報價單' };
  qt_sheet_().getRange(hit.row, 7, 1, 1).setValue(st); qt_sheet_().getRange(hit.row, 15, 1, 1).setValue(ops_now_());
  return { success: true };
}

AU_READ = new RegExp(AU_READ.source.replace('|s30PwMust)$', '|s30PwMust|quotePage|quoteList)$'));

function qtHandler_(action, p) {
  var map = { quotePage: qt_page_, quoteSave: qt_save_, quoteList: qt_list_, quoteStatus: qt_status_ };
  if (!map[action]) return null;
  try { OPS_C_ = {}; return map[action](p); } catch (e) { return { error: e.message }; }
}
function qt_setup() {
  qt_sheet_();
  var f = qt_folder_();
  Logger.log('qt_setup 完成：〈報價紀錄〉已建立；報價資料夾：' + f.getUrl());
  return f.getUrl();
}
