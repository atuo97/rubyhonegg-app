// ═══════════════════════════════════════════════
// LINE 公告推播 後端模組 v1（2026-11-12，v1.20 批次）
// 貼在「程式碼.gs」最底部；extHandler_ 內、payHandler_ 那行的下一行加：
//   var ln = lineHandler_(action, p); if (ln) return ln;
// 需要「指令碼屬性」：LINE_TOKEN（Channel access token）、LINE_SECRET（Channel secret）——隊長 11/12 已設定。
//
// 流程：
//   LINE → Cloudflare Worker（/line 路徑，原封不動轉送內容與簽章）→ Apps Script lineWebhook
//   → 驗證簽章 → 官方帳號被邀進群組時記到〈LINE群組〉（只記加入／離開，不讀、不存聊天內容）
//   App「發公告」→ 寫〈公告〉→ 推播到勾選的群組
// 動作：lineWebhook、lineGroups、lineGroupSave、lineQuota、annPost、annList、annStop、annFeed、annRead、annReaders、annOptions
// 公告：分隊長（Lv.2）可發給自己負責的櫃位；可要求夥伴按「我知道了」；發布者看得到已讀／我知道了人數與名單
// ═══════════════════════════════════════════════

var LINE_GROUP_HEAD = ['群組ID', '名稱', '狀態', '用途', '加入時間', '更新時間', '綁定櫃位'];
var LINE_API = 'https://api.line.me/v2/bot/';
var LINE_APP_URL = 'https://rubyhonegg-app.vercel.app';

function line_prop_(k) { return PropertiesService.getScriptProperties().getProperty(k) || ''; }
function line_sheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID), sh = ss.getSheetByName('LINE群組');
  if (!sh) { sh = ss.insertSheet('LINE群組'); sh.appendRow(LINE_GROUP_HEAD); sh.setFrozenRows(1); }
  return sh;
}
function line_now_() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss'); }
function line_groups_() {
  var sh = line_sheet_();
  if (String(sh.getRange(1, 7).getValue() || '') !== '綁定櫃位') sh.getRange(1, 7).setValue('綁定櫃位');
  return (sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues() : []).map(function (r, i) {
    return { row: i + 2, id: String(r[0]), name: String(r[1] || ''), status: String(r[2] || ''), use: String(r[3] || '公告'), joined: String(r[4] || ''),
      locs: String(r[6] || '').split(/[、,，]+/).map(function (x) { return x.trim(); }).filter(String) };
  }).filter(function (g) { return g.id; });
}
function line_fetch_(method, path, body) {
  var token = line_prop_('LINE_TOKEN'); if (!token) throw new Error('還沒設定 LINE_TOKEN');
  var o = { method: method, muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + token } };
  if (body) { o.contentType = 'application/json'; o.payload = JSON.stringify(body); }
  var r = UrlFetchApp.fetch(LINE_API + path, o), code = r.getResponseCode(), txt = r.getContentText();
  var js = {}; try { js = txt ? JSON.parse(txt) : {}; } catch (e) {}
  if (code >= 300) throw new Error('LINE 回應 ' + code + '：' + (js.message || txt).slice(0, 120));
  return js;
}

// ── Webhook（由 Worker 轉送；p.body＝LINE 原始內容字串，p.sig＝x-line-signature）──
function line_webhook_(p) {
  var secret = line_prop_('LINE_SECRET'), body = String(p.body || '');
  if (!secret) return { error: 'no secret' };
  var sig = Utilities.base64Encode(Utilities.computeHmacSha256Signature(body, secret, Utilities.Charset.UTF_8));
  if (sig !== String(p.sig || '')) return { error: 'bad signature' };
  var ev = []; try { ev = JSON.parse(body).events || []; } catch (e) { return { error: 'bad body' }; }
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = line_sheet_(), groups = line_groups_();
    ev.forEach(function (e) {
      var src = e.source || {}, gid = src.groupId || src.roomId; if (!gid) return;
      var g = groups.filter(function (x) { return x.id === gid; })[0];
      if (e.type === 'join' || (!g && e.type !== 'leave')) {   // 部署端 11/12：官方帳號在 Worker v2 前就已加入的群組，群組裡任何人說一句話就會登記（不存聊天內容）
        var name = '';
        try { if (src.groupId) name = line_fetch_('get', 'group/' + gid + '/summary').groupName || ''; } catch (er) {}
        if (g) sh.getRange(g.row, 2, 1, 5).setValues([[g.name || name, '使用中', g.use || '公告', g.joined || line_now_(), line_now_()]]);
        else { sh.appendRow([gid, name || '新群組', '使用中', '公告', line_now_(), line_now_()]); groups = line_groups_(); }
      } else if (e.type === 'leave' && g) {
        sh.getRange(g.row, 3).setValue('已離開'); sh.getRange(g.row, 6).setValue(line_now_());
      }
      // 其他事件（群組聊天訊息等）一律不處理、不儲存
    });
    return { success: true };
  } finally { lock.releaseLock(); }
}

function line_me_(p, minRole) {
  var me = ops_me_(p.empId);
  if (!sec_verifyToken_(p.token, me.id)) throw new Error('請重新登入後再試');
  if (me.role < minRole) throw new Error('需要 Lv.' + minRole + ' 以上');
  return me;
}
function line_groupList_(p) {
  line_me_(p, 3);
  return { success: true, data: line_groups_().filter(function (g) { return g.status !== '已離開'; }).map(function (g) { delete g.row; return g; }) };
}
function line_groupSave_(p) {
  line_me_(p, 3);
  var g = line_groups_().filter(function (x) { return x.id === String(p.id || ''); })[0]; if (!g) return { error: '找不到群組' };
  var use = String(p.use || '公告').split(/[,，、]/).filter(function (x) { return /公告|物料/.test(x); }).join('、') || '公告';
  var locs = (Object.prototype.toString.call(p.locs) === '[object Array]' ? p.locs : String(p.locs || '').split(/[、,，]+/)).map(String).filter(String);
  line_sheet_().getRange(g.row, 2, 1, 6).setValues([[String(p.name || g.name).slice(0, 30), g.status || '使用中', use, g.joined, line_now_(), locs.join('、')]]);
  return { success: true };
}
function line_quota_() {
  var q = {}, used = null;
  try { q = line_fetch_('get', 'message/quota'); } catch (e) { return { error: e.message }; }
  try { used = line_fetch_('get', 'message/quota/consumption').totalUsage; } catch (e) {}
  return { success: true, type: q.type, limit: q.value === undefined ? null : q.value, used: used };
}
// 推播文字到群組；回傳成功數
function line_push_(groupIds, text) {
  var ok = 0, fail = [];
  groupIds.forEach(function (gid) {
    try { line_fetch_('post', 'message/push', { to: gid, messages: [{ type: 'text', text: String(text).slice(0, 4900) }] }); ok++; }
    catch (e) { fail.push(e.message); }
  });
  return { ok: ok, fail: fail };
}
// 其他模組用：推到用途含 use 的群組（例：物料需求）
function line_notify_(use, text) {
  if (!line_prop_('LINE_TOKEN')) return null;
  var ids = line_groups_().filter(function (g) { return g.status !== '已離開' && g.use.indexOf(use) >= 0; }).map(function (g) { return g.id; });
  return ids.length ? line_push_(ids, text) : null;
}

// ── 公告 ──
// 〈公告〉A 編號 B 標題 C 內容 D 類型 E 是否緊急 F 發布者 G 發布時間 H 有效期限 I 狀態 J 備注(JSON：photo、groups、by、target、ack)
// 〈公告已讀〉A 公告編號 B 員工編號 C 姓名 D 已讀時間 E 我知道了時間
// 對象：target 空白＝全員；否則為櫃位名稱清單（只有那些櫃位的夥伴看得到）。
// 分隊長（Lv.2）只能發給自己負責的櫃位、只能推到綁定那些櫃位的 LINE 群組；Lv.3 以上可發全員。
var ANN_READ_HEAD = ['公告編號', '員工編號', '姓名', '已讀時間', '我知道了時間'];
function ann_sheet_() { return SpreadsheetApp.openById(SHEET_ID).getSheetByName('公告'); }
function ann_rows_() {
  var sh = ann_sheet_(); if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 10).getValues().map(function (r, i) {
    var n = {}; try { n = JSON.parse(String(r[9] || '{}')) || {}; } catch (e) { n = {}; }
    return { row: i + 2, id: String(r[0]), title: String(r[1]), body: String(r[2]), urgent: String(r[4]) === '是', by: String(r[5]), byId: String(n.by || ''),
      time: String(r[6]), expire: String(r[7] || ''), status: String(r[8] || ''), groups: n.groups || [], target: n.target || [], ack: !!n.ack, photo: n.photo || '' };
  }).filter(function (x) { return x.id; });
}
function ann_readSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID), sh = ss.getSheetByName('公告已讀');
  if (!sh) { sh = ss.insertSheet('公告已讀'); sh.appendRow(ANN_READ_HEAD); sh.setFrozenRows(1); }
  return sh;
}
function ann_reads_() {
  var sh = ann_readSheet_(), out = {};
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues().forEach(function (r, i) {
    var a = String(r[0]), e = String(r[1]); if (!a || !e) return;
    (out[a] = out[a] || {})[e] = { row: i + 2, name: String(r[2]), read: String(r[3] || ''), ack: String(r[4] || '') };
  });
  return out;
}
// 每位夥伴「所屬櫃位」：負責櫃位＋近 60 天排過班的櫃位（用櫃位編號比對，改名不影響）
function ann_staffLocs_() {
  var st = ops_staff_(), out = {}, codes = function (txt) {
    return String(txt || '').split(/[、,，;；]+/).map(function (t) { t = t.trim(); var l = ops_locs_().filter(function (x) { return x.name === t || (t.length >= 2 && x.name.indexOf(t) >= 0); })[0]; return l ? l.code : loc_code_(t); }).filter(String);
  };
  st.list.forEach(function (x) { if (!x.left) out[x.id] = { name: x.name, role: x.role, codes: codes(x.managed) }; });
  try {
    var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('班表'), since = Utilities.formatDate(new Date(Date.now() - 60 * 86400000), 'Asia/Taipei', 'yyyy-MM-dd');
    if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues().forEach(function (r) {
      var d = ops_d_(r[1]), e = String(r[3]).trim(); if (!out[e] || d < since) return;
      var c = loc_code_(String(r[5]).trim()); if (c && out[e].codes.indexOf(c) < 0) out[e].codes.push(c);
    });
  } catch (er) {}
  return out;
}
function ann_canSee_(a, empId, sl) {
  if (!a.target.length) return true;
  var me = sl[empId]; if (!me) return false;
  if (me.role >= 3 || a.byId === empId) return true;
  return a.target.some(function (t) { return me.codes.indexOf(loc_code_(t)) >= 0; });
}
function ann_audience_(a, sl) { return Object.keys(sl).filter(function (id) { return ann_canSee_(a, id, sl) && id !== a.byId; }); }
function ann_myLocs_(me) { return me.role >= 3 ? ops_locs_().filter(function (x) { return x.status !== '已停用'; }).map(function (x) { return x.name; }) : ops_myLocs_(me); }
function ann_groupsFor_(me) {                         // 這個人可以推的群組：Lv.3 全部；Lv.2 只有綁定自己櫃位的群組
  var mine = ann_myLocs_(me).map(loc_code_);
  return line_groups_().filter(function (g) {
    if (g.status === '已離開' || g.use.indexOf('公告') < 0) return false;
    if (me.role >= 3) return true;
    return g.locs.length > 0 && g.locs.every(function (l) { return mine.indexOf(loc_code_(l)) >= 0; });
  });
}

function line_annPost_(p) {
  var min = Number(ops_param_('公告發布最低權限', 2)) || 2, me = line_me_(p, min);
  var title = String(p.title || '').trim(), body = String(p.body || '').trim();
  if (!title || !body) return { error: '請填標題和內容' };
  var urgent = p.urgent === true || p.urgent === 'true', ack = p.ack === true || p.ack === 'true';
  var arr = function (x) { return (Object.prototype.toString.call(x) === '[object Array]' ? x : String(x || '').split(',')).map(String).filter(String); };
  var target = arr(p.target), groups = arr(p.groups), mine = ann_myLocs_(me);
  if (me.role < 3) {
    if (!target.length) return { error: '分隊長發公告要選對象櫃位（只能選自己負責的櫃位）' };
    var bad = target.filter(function (t) { return mine.indexOf(t) < 0; });
    if (bad.length) return { error: '不能發給非負責的櫃位：' + bad.join('、') };
  }
  var allowed = ann_groupsFor_(me).map(function (g) { return g.id; });
  groups = groups.filter(function (g) { return allowed.indexOf(g) >= 0; });
  var id = 'A' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
  var note = { photo: String(p.photo || ''), groups: groups, by: me.id, target: target, ack: ack };
  ann_sheet_().appendRow([id, title.slice(0, 60), body.slice(0, 2000), urgent ? '緊急' : '一般', urgent ? '是' : '否',
    me.name, line_now_(), String(p.expire || ''), '發布', JSON.stringify(note)]);
  var pushed = null;
  if (groups.length) {
    var text = (urgent ? '🚨【緊急公告】' : '📢【公告】') + title + (target.length ? '（' + target.map(function (t) { return t.replace(/^\d+/, ''); }).join('、') + '）' : '') + '\n\n' +
      (body.length > 600 ? body.slice(0, 600) + '…' : body) + (p.photo ? '\n\n📷 公告附有照片' : '') +
      (ack ? '\n\n✅ 請打開 App 按「我知道了」' : '') + '\n\n👉 紅玉滿夥伴 App：' + LINE_APP_URL + '\n（' + me.name + ' 發布）';
    pushed = line_push_(groups, text);
  }
  return { success: true, id: id, pushed: pushed };
}
// 夥伴：我看得到的公告＋已讀狀態（取代原本的 getAnnouncements；未設對象的舊公告全員看得到）
function ann_feed_(p) {
  var me = ops_me_(p.empId), sl = ann_staffLocs_(), reads = ann_reads_(), today = ops_today_();
  var list = ann_rows_().filter(function (a) { return a.status !== '停用' && (!a.expire || ops_d_(a.expire) >= today) && ann_canSee_(a, me.id, sl); });
  list.reverse();
  return { success: true, data: list.slice(0, 60).map(function (a) {
    var r = (reads[a.id] || {})[me.id] || {};
    return { id: a.id, title: a.title, body: a.body, urgent: a.urgent, by: a.by, time: a.time, date: a.time, target: a.target, ack: a.ack, photo: a.photo,
      read: !!r.read || a.byId === me.id, acked: !!r.ack, mine: a.byId === me.id };
  }) };
}
function ann_read_(p) {
  var me = ops_me_(p.empId), id = String(p.id || ''), kind = p.kind === 'ack' ? 'ack' : 'read';
  var a = ann_rows_().filter(function (x) { return x.id === id; })[0]; if (!a) return { error: '找不到公告' };
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var sh = ann_readSheet_(), r = (ann_reads_()[id] || {})[me.id], now = line_now_();
    if (!r) sh.appendRow([id, me.id, me.name, now, kind === 'ack' ? now : '']);
    else if (kind === 'ack' && !r.ack) sh.getRange(r.row, 5).setValue(now);
    return { success: true };
  } finally { lock.releaseLock(); }
}
// 發布者：已發布清單（Lv.2 只看自己發的；Lv.3 全部）＋已讀人數
function line_annList_(p) {
  var me = line_me_(p, 2), sl = ann_staffLocs_(), reads = ann_reads_();
  return { success: true, data: ann_rows_().filter(function (a) { return me.role >= 3 || a.byId === me.id; }).reverse().slice(0, 50).map(function (a) {
    var aud = ann_audience_(a, sl), rd = reads[a.id] || {};
    return { id: a.id, title: a.title, body: a.body, urgent: a.urgent, by: a.by, time: a.time, status: a.status, groups: a.groups.length, target: a.target, ack: a.ack,
      audience: aud.length, readCount: aud.filter(function (x) { return rd[x] && rd[x].read; }).length, ackCount: aud.filter(function (x) { return rd[x] && rd[x].ack; }).length };
  }) };
}
function ann_readers_(p) {
  var me = line_me_(p, 2), a = ann_rows_().filter(function (x) { return x.id === String(p.id || ''); })[0];
  if (!a) return { error: '找不到公告' };
  if (me.role < 3 && a.byId !== me.id) return { error: '只能看自己發的公告' };
  var sl = ann_staffLocs_(), rd = ann_reads_()[a.id] || {};
  return { success: true, ack: a.ack, data: ann_audience_(a, sl).map(function (id) {
    var r = rd[id] || {}; return { id: id, name: sl[id].name, read: r.read || '', ack: r.ack || '' };
  }).sort(function (x, y) { return (x.read ? 1 : 0) - (y.read ? 1 : 0); }) };
}
function line_annStop_(p) {
  var me = line_me_(p, 2), a = ann_rows_().filter(function (x) { return x.id === String(p.id || ''); })[0];
  if (!a) return { error: '找不到公告' };
  if (me.role < 3 && a.byId !== me.id) return { error: '只能下架自己發的公告' };
  ann_sheet_().getRange(a.row, 9).setValue(p.on ? '發布' : '停用');
  return { success: true };
}
// 發公告頁用：我可以選的對象櫃位、可以推的群組
function ann_options_(p) {
  var me = line_me_(p, Number(ops_param_('公告發布最低權限', 2)) || 2);
  return { success: true, canAll: me.role >= 3, locs: ann_myLocs_(me), groups: ann_groupsFor_(me).map(function (g) { return { id: g.id, name: g.name, locs: g.locs }; }) };
}

function lineHandler_(action, p) {
  if (!/^(line|ann)/.test(String(action || ''))) return null;
  p = p || {}; if (typeof OPS_C_ !== 'undefined') OPS_C_ = {};
  try {
    switch (action) {
      case 'lineWebhook':   return line_webhook_(p);
      case 'lineGroups':    return line_groupList_(p);
      case 'lineGroupSave': return line_groupSave_(p);
      case 'lineQuota':     line_me_(p, 3); return line_quota_();
      case 'annPost':       return line_annPost_(p);
      case 'annFeed':       return ann_feed_(p);
      case 'annRead':       return ann_read_(p);
      case 'annReaders':    return ann_readers_(p);
      case 'annOptions':    return ann_options_(p);
      case 'annList':       return line_annList_(p);
      case 'annStop':       return line_annStop_(p);
    }
  } catch (e) { return { error: e.message }; }
  return null;
}
