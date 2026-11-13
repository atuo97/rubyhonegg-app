// ═══════════════════════════════════════════════
// 路由 extHandler_ v1.29（2026-11-13）
// 整段貼在「程式碼.gs」最底部即可（Apps Script 以檔案中最後一個同名函式為準，不必改原本那一個）。
// 與 v1.28 路由的差別：p28Handler_ 之後加 acHandler_（內帳，只有大隊長）。
// ═══════════════════════════════════════════════
function extHandler_(action, p) {
  p = p || {};
  var gate = au_gate_(action, p); if (gate) return gate;
  var au = auHandler_(action, p); if (au) return au;
  var sec = secHandler_(action, p); if (sec) return sec;
  var op = opsHandler_(action, p); if (op) return op;
  var bu = buHandler_(action, p); if (bu) return bu;
  var rp = rpHandler_(action, p); if (rp) return rp;
  var fs = fsHandler_(action, p); if (fs) return fs;
  var p28 = p28Handler_(action, p); if (p28) return p28;
  var ac = acHandler_(action, p); if (ac) return ac;
  var g27 = gm27Handler_(action, p); if (g27) return g27;
  var py = payHandler_(action, p); if (py) return py;
  var ln = lineHandler_(action, p); if (ln) return ln;
  var pr = pollHandler_(action, p);
  if (pr) return pr;
  var sc = schHandler_(action, p); if (sc) return sc;
  var pw = pwHandler_(action, p); if (pw) return pw;
  var av = avHandler_(action, p); if (av) return av;
  var od = odHandler_(action, p); if (od) return od;
  var bt = btHandler_(action, p); if (bt) return bt;
  var gm = gmHandler_(action, p); if (gm) return gm;
  var pv = pvHandler_(action, p); if (pv) return pv;
  var so = sopHandler_(action, p); if (so) return so;
  if (action === 'getOnDutyCrew') { try { return uo_onDutyCrew_(p); } catch (e) { return { error: '在班名單錯誤:' + e.message }; } }
  try {
    if (action === 'getTodayBirthdays') return bday_today_(p);
    if (action === 'getShortages')    return uo_getShortages();
    if (action === 'addShortage')     return uo_addShortage(p);
    if (action === 'resolveShortage') return uo_resolveShortage(p);
  } catch (e) { return { error: '缺貨看板錯誤:' + e.message }; }
  return null;
}
