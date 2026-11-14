// ═══════════════════════════════════════════════
// 紅玉滿夥伴 App 後端模組 v1.46（2026-11-14）
// 貼在第 45 版「v1.45 薪資修正」之後、最後的「路由 v1.44」之前（不用換路由）。
// 內容：
//   1. 修正夾娃娃機「win is not defined」：部署端在 v42_claw_ 加註解時，註解吃掉了「, win = …」，
//      每夾一次都先扣 1 枚、接著出錯（沒有獎品、保底也沒累計）。重寫 v42_claw_，保留部署端參數「夾娃娃對準加成」（預設 0.1，最多 0.15）。
//   2. v46_clawRefund()：把 11/14 19:33（部署端改，第 45 版上線時間）之後出錯被扣的夾娃娃費用退回（每筆 1 枚，用來源鍵防止重複退）。部署後執行一次。
// 安全：v42_claw_ 照舊用 v39_me_()（au_verifiedId_，沒有通行證就擋）。
// ═══════════════════════════════════════════════
function v42_claw_(p) {
  var me = v39_me_(); if (gm_isFrozen_(me.id)) return { error: '帳號不能使用赤心幣' };
  var cost = v42_n_('夾娃娃價格', 1), pity = v42_n_('夾娃娃好夾保底', 6), align = Math.max(0, Math.min(1, Number(p.align) || 0));
  // 部署端：對準加成用參數（預設 0.1），align 是前端送的、可被改成 1，所以加成最多 0.15
  var bonus = Math.min(0.15, Math.max(0, v42_n_('夾娃娃對準加成', 0.1)));
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    if (gm_balance_(me.id) < cost) return { error: '赤心幣不足' };
    var m = {}; try { m = JSON.parse(gm_getState_('夾娃娃保底') || '{}') || {}; } catch (e) { m = {}; }
    var miss = Number(m[me.id]) || 0, key = 'CLAW2|' + me.id + '|' + Date.now() + '|' + Math.random();
    var prob = Math.min(0.9, v42_n_('夾娃娃好夾機率', 0.25) + align * bonus);
    var win = miss + 1 >= pity || Math.random() < prob;
    gm_credit_(me.id, '夾娃娃機', -cost, '夾娃娃機', key);
    var out = { win: win, prize: '', emoji: '', item: '', dup: false };
    if (win) {
      var tot = V44_CLAW_PRIZES.reduce(function (a, x) { return a + x[0]; }, 0), r = Math.random() * tot, pz = null;
      for (var i = 0; i < V44_CLAW_PRIZES.length; i++) { r -= V44_CLAW_PRIZES[i][0]; if (r < 0) { pz = V44_CLAW_PRIZES[i]; break; } }
      pz = pz || V44_CLAW_PRIZES[0]; out.emoji = pz[4];
      if (pz[1] === 'deco') {
        if (gm_owned_(me.id)[pz[2]]) { gm_credit_(me.id, '夾娃娃機', pz[5], '夾到重複的' + pz[3] + '，換成赤心幣', key + '|W'); out.dup = true; out.prize = pz[3] + '（已經有了，換成 ' + pz[5] + ' 枚赤心幣）'; }
        else { gm_append_('owned', [[me.id, pz[2], '夾娃娃', gm_now_()]]); out.item = pz[2]; out.prize = pz[3] + '（已放進我的物品，可擺到辦公桌）'; }
      } else if (pz[1] === 'coin') { gm_credit_(me.id, '夾娃娃機', pz[5], '夾到 ' + pz[3], key + '|W'); out.prize = pz[3]; }
      else { s30_tixAdd_(me.id, pz[5], '夾娃娃機', key + '|W'); out.prize = pz[3]; }
      m[me.id] = 0;
      if (!out.dup && (pz[5] >= 10 || (pz[1] === 'deco' && pz[0] <= 2.5) || pz[1] === 'tix')) v40_event_('claw', '🧸 ' + v40_nm_(me.id) + ' 夾到 ' + pz[4] + pz[3] + '！', '遊戲室');
    } else m[me.id] = miss + 1;
    gm_setState_('夾娃娃保底', JSON.stringify(m));
    out.miss = m[me.id]; out.pity = pity; out.balance = gm_balance_(me.id);
    return { success: true, data: out };
  } finally { lock.releaseLock(); }
}

// 退回 11/14 19:30 之後出錯被扣的夾娃娃費用（舊鍵 CLAW|…，沒有 |W 中獎紀錄的）。可重複執行，不會退兩次。
function v46_clawRefund() {
  var from = Date.parse('2026-11-14T19:33:00+08:00')   /* 部署端：第 45 版 19:33 上線，19:30～19:33 仍是正常的舊版 */, rows = gm_rows_('ledger'), keys = {}, n = 0, who = {};
  rows.forEach(function (r) { if (r[5]) keys[String(r[5])] = 1; });
  rows.forEach(function (r) {
    var k = String(r[5] || ''), mm = /^CLAW\|([^|]+)\|(\d+)\|/.exec(k);
    if (!mm || /\|W$/.test(k) || Number(mm[2]) < from || keys[k + '|W'] || Number(r[3]) >= 0) return;
    if (gm_credit_(mm[1], '夾娃娃機', -Number(r[3]), '夾娃娃機故障退費（11/14）', 'CLAWREFUND|' + k)) { n++; who[mm[1]] = (who[mm[1]] || 0) - Number(r[3]); }
  });
  Object.keys(who).forEach(function (e) { try { v41_noteAny_(e, 'claw', '🧸 夾娃娃機剛剛故障，已退回 ' + who[e] + ' 枚赤心幣，現在可以正常夾了！'); } catch (x) {} });
  var log = '夾娃娃退費：' + n + ' 筆，' + Object.keys(who).map(function (e) { return v40_nm_(e) + ' ' + who[e] + ' 枚'; }).join('、');
  Logger.log(log); return log;
}
