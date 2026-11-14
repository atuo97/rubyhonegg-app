// ═══════════════════════════════════════════════════════
// 紅玉滿赤心 員工系統 - Google Apps Script 完整版
// ═══════════════════════════════════════════════════════

const SHEET_ID = "1-5J00Ox6qCDlj4-SVpYbiCfKwnlz1YttrUXYu3DSkCo";

// ── Web App 入口 ─────────────────────────────────────
function doGet(e) {
  const params = e.parameter;
  const action = params.action;
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let result;

  try {
    // 寫入類（透過 GET + payload 傳入）
    if (params.payload) {
      const data = JSON.parse(decodeURIComponent(params.payload));
      const a = data.action;
      if (a === "punch")      result = savePunch(ss, data);
      else if (a === "openStore")  result = saveOpenStore(ss, data);
      else if (a === "closeStore") result = saveCloseStore(ss, data);
      else result = { error: "未知的寫入動作" };
    }
    // 讀取類
    else {
      if (action === "login")              result = loginUser(ss, params);
      else if (action === "getSchedule")   result = getSchedule(ss, params);
      else if (action === "getSalary")     result = getSalary(ss, params);
      else if (action === "getAnnouncements") result = getAnnouncements(ss);
      else if (action === "getStaffInfo")  result = getStaffInfo(ss, params);
      else result = { error: "未知的動作: " + action };
    }
  } catch(err) {
    result = { error: err.toString() };
  }

  const json = JSON.stringify(result);

  // 支援 JSONP（callback 參數）
  if (params.callback) {
    return ContentService
      .createTextOutput(params.callback + "(" + json + ")")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let result;

  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    if (action === "punch")       result = savePunch(ss, data);
    else if (action === "openStore")  result = saveOpenStore(ss, data);
    else if (action === "closeStore") result = saveCloseStore(ss, data);
    else result = { error: "未知的動作" };
  } catch(err) {
    result = { error: err.toString() };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── 登入驗證 ─────────────────────────────────────────
function loginUser(ss, params) {
  const sheet = ss.getSheetByName("夥伴資料");
  const data = sheet.getDataRange().getValues();
  const phone = String(params.phone || "").trim();
  const password = String(params.password || "").trim();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowPhone = String(row[6] || "").trim();
    const rowPw = String(row[36] || "").trim();

    if (rowPhone === phone && rowPw === password) {
      return {
        success: true,
        user: {
          id:           String(row[0] || ""),
          name:         String(row[1] || ""),
          avatar:       String(row[1] || "").slice(0, 1),
          role:         parseInt(row[12]) || 1,
          position:     String(row[11] || ""),
          birthday:     String(row[4] || ""),
          hourly:       parseFloat(row[13]) || 190,
          labor:        parseFloat(row[21]) || 0,
          health:       parseFloat(row[26]) || 0,
          noInsure:     parseFloat(row[29]) || 0,
          skillLevel:   parseFloat(row[32]) || 0,
          contribLevel: parseFloat(row[33]) || 0,
          longAge:      parseFloat(row[34]) || 0,
          checkupExpiry: String(row[31] || ""),
        }
      };
    }
  }
  return { success: false, error: "帳號或密碼錯誤" };
}

// ── 讀取班表 ─────────────────────────────────────────
function getSchedule(ss, params) {
  const sheet = ss.getSheetByName("班表");
  const data = sheet.getDataRange().getValues();
  const empId = String(params.empId || "");
  const ym = String(params.ym || "");
  const result = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[3]) !== empId) continue;
    if (ym && !String(row[1]).startsWith(ym)) continue;
    result.push({
      id:       String(row[0]),
      date:     String(row[1]),
      weekday:  String(row[2]),
      location: String(row[5]),
      start:    String(row[6]),
      end:      String(row[7]),
      hours:    row[8],
      type:     String(row[9]),
      holiday:  row[10],
    });
  }
  return { success: true, data: result };
}

// ── 讀取薪資 ─────────────────────────────────────────
function getSalary(ss, params) {
  const sheet = ss.getSheetByName("薪資明細");
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const empId = String(params.empId || "");
  const ym = String(params.ym || "");
  const result = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[2]) !== empId) continue;
    if (ym && String(row[1]) !== ym) continue;
    const obj = {};
    headers.forEach((h, idx) => { obj[String(h)] = row[idx]; });
    result.push(obj);
  }
  return { success: true, data: result };
}

// ── 讀取公告 ─────────────────────────────────────────
function getAnnouncements(ss) {
  const sheet = ss.getSheetByName("公告");
  const data = sheet.getDataRange().getValues();
  const result = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    if (String(row[8]) === "停用") continue;
    result.push({
      id:     String(row[0]),
      title:  String(row[1]),
      body:   String(row[2]),
      type:   String(row[3]),
      urgent: String(row[4]) === "是",
      date:   String(row[6]),
    });
  }
  return { success: true, data: result };
}

// ── 讀取個人資料 ──────────────────────────────────────
function getStaffInfo(ss, params) {
  const empId = String(params.empId || "");
  const staffSheet = ss.getSheetByName("夥伴資料");
  const hoursSheet = ss.getSheetByName("累計工時");
  const staffData = staffSheet.getDataRange().getValues();
  const hoursData = hoursSheet.getDataRange().getValues();

  const emp = staffData.find(r => String(r[0]) === empId);
  if (!emp) return { error: "找不到夥伴資料" };

  // 累計工時（取最新一行）
  let accumulated = 0;
  for (let i = hoursData.length - 1; i >= 1; i--) {
    if (String(hoursData[i][0]) === empId) {
      accumulated = parseFloat(hoursData[i][6]) || 0;
      break;
    }
  }

  return {
    success: true,
    data: {
      accumulated,
      leaveBalance:  0,
      skillLevel:    parseFloat(emp[32]) || 0,
      contribLevel:  parseFloat(emp[33]) || 0,
      longAge:       parseFloat(emp[34]) || 0,
      labor:         parseFloat(emp[21]) || 0,
      health:        parseFloat(emp[26]) || 0,
      noInsure:      parseFloat(emp[29]) || 0,
      checkupExpiry: String(emp[31] || ""),
      bank:          String(emp[15] || ""),
      accountStatus: String(emp[16] || ""),
    }
  };
}

// ── 儲存打卡 ──────────────────────────────────────────
function savePunch(ss, data) {
  const sheet = ss.getSheetByName("打卡紀錄");
  const id = "P" + Date.now();
  sheet.appendRow([
    id,
    String(data.date || ""),
    String(data.empId || ""),
    String(data.name || ""),
    String(data.scheduleId || ""),
    String(data.type || ""),
    String(data.time || ""),
    data.lat || "",
    data.lng || "",
    String(data.location || ""),
    data.offline ? "是" : "否",
    new Date().toISOString(),
    String(data.photoUrl || ""),
    String(data.note || ""),
  ]);
  return { success: true, id };
}

// ── 儲存開店盤點 ──────────────────────────────────────
function saveOpenStore(ss, data) {
  const sheet = ss.getSheetByName("開店盤點");
  const id = "O" + Date.now();
  const original = parseFloat(data.original) || 0;
  const cocoa    = parseFloat(data.cocoa)    || 0;
  const ruby     = parseFloat(data.ruby)     || 0;
  const matcha   = parseFloat(data.matcha)   || 0;
  const total    = Math.round((original + cocoa + ruby + matcha) * 100) / 100;

  sheet.appendRow([
    id,
    String(data.date || ""),
    String(data.scheduleId || ""),
    String(data.empId || ""),
    String(data.name || ""),
    String(data.location || ""),
    original, cocoa, ruby, matcha, total,
    String(data.note || ""),
    new Date().toISOString(),
    "",
  ]);
  return { success: true, id };
}

// ── 儲存收店盤點 ──────────────────────────────────────
function saveCloseStore(ss, data) {
  const sheet = ss.getSheetByName("收店盤點");
  const id = "C" + Date.now();

  const remOriginal = parseFloat(data.remOriginal) || 0;
  const remCocoa    = parseFloat(data.remCocoa)    || 0;
  const remRuby     = parseFloat(data.remRuby)     || 0;
  const remMatcha   = parseFloat(data.remMatcha)   || 0;
  const remTotal    = Math.round((remOriginal + remCocoa + remRuby + remMatcha) * 100) / 100;

  const startOriginal = parseFloat(data.startOriginal) || 0;
  const startCocoa    = parseFloat(data.startCocoa)    || 0;
  const startRuby     = parseFloat(data.startRuby)     || 0;
  const startMatcha   = parseFloat(data.startMatcha)   || 0;

  const usedOriginal = Math.max(0, Math.round((startOriginal - remOriginal) * 100) / 100);
  const usedCocoa    = Math.max(0, Math.round((startCocoa    - remCocoa)    * 100) / 100);
  const usedRuby     = Math.max(0, Math.round((startRuby     - remRuby)     * 100) / 100);
  const usedMatcha   = Math.max(0, Math.round((startMatcha   - remMatcha)   * 100) / 100);
  const totalUsed    = Math.round((usedOriginal + usedCocoa + usedRuby + usedMatcha) * 100) / 100;

  sheet.appendRow([
    id,
    String(data.date || ""),
    String(data.scheduleId || ""),
    String(data.empId || ""),
    String(data.name || ""),
    String(data.location || ""),
    remOriginal, remCocoa, remRuby, remMatcha, remTotal,
    usedOriginal, usedCocoa, usedRuby, usedMatcha, totalUsed,
    parseFloat(data.revenue) || 0,
    parseFloat(data.cash)    || 0,
    String(data.photoUrl || ""),
    String(data.handoverNote || ""),
    new Date().toISOString(),
    "",
  ]);
  return { success: true, id };
}

// ── 每日自動更新（定時觸發）────────────────────────────
function setDailyTrigger() {
  // 先刪除舊的觸發器
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "dailyAutoUpdate") {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger("dailyAutoUpdate")
    .timeBased().atHour(2).everyDays(1).create();
  SpreadsheetApp.getUi().alert("✅ 每日自動更新已設定，每天凌晨2點執行。");
}

function dailyAutoUpdate() {
  updateAccumulatedHours();
  updateInsuranceLevels();
}

// ── 更新累計工時 ──────────────────────────────────────
function updateAccumulatedHours() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const punchSheet = ss.getSheetByName("打卡紀錄");
  const hoursSheet = ss.getSheetByName("累計工時");
  const staffSheet = ss.getSheetByName("夥伴資料");

  const punches = punchSheet.getDataRange().getValues();
  const staff   = staffSheet.getDataRange().getValues();

  const monthlyHours = {};
  const punchPairs   = {};

  for (let i = 1; i < punches.length; i++) {
    const row   = punches[i];
    const empId = String(row[2]);
    const type  = String(row[5]);
    const time  = row[6] ? new Date(row[6]) : null;
    const sid   = String(row[4]);
    if (!empId || !time || isNaN(time.getTime())) continue;

    const ym = time.getFullYear() + "-" + String(time.getMonth() + 1).padStart(2, "0");
    if (!punchPairs[empId]) punchPairs[empId] = {};
    if (!punchPairs[empId][sid]) punchPairs[empId][sid] = { ym };

    if (type === "上班") punchPairs[empId][sid].in  = time;
    if (type === "下班") punchPairs[empId][sid].out = time;
  }

  Object.entries(punchPairs).forEach(([empId, sessions]) => {
    Object.values(sessions).forEach(sess => {
      if (!sess.in || !sess.out) return;
      const hrs = Math.max(0, (sess.out - sess.in) / 3600000);
      if (!monthlyHours[empId]) monthlyHours[empId] = {};
      monthlyHours[empId][sess.ym] = (monthlyHours[empId][sess.ym] || 0) + hrs;
    });
  });

  const existing = hoursSheet.getDataRange().getValues();
  const existingMap = {};
  for (let i = 1; i < existing.length; i++) {
    existingMap[`${existing[i][0]}_${existing[i][2]}`] = i + 1;
  }

  Object.entries(monthlyHours).forEach(([empId, months]) => {
    const empRow = staff.find(r => String(r[0]) === empId);
    const name = empRow ? String(empRow[1]) : "";
    Object.entries(months).forEach(([ym, totalHrs]) => {
      const key = `${empId}_${ym}`;
      const hrs = Math.round(totalHrs * 10) / 10;
      if (existingMap[key]) {
        hoursSheet.getRange(existingMap[key], 4).setValue(hrs);
        hoursSheet.getRange(existingMap[key], 6).setValue(hrs);
      } else {
        hoursSheet.appendRow([empId, name, ym, hrs, 0, hrs, 0, "", "", ""]);
      }
    });
  });

  // 重新計算累計總工時
  const allHours = hoursSheet.getDataRange().getValues();
  const cumulative = {};
  for (let i = 1; i < allHours.length; i++) {
    const empId   = String(allHours[i][0]);
    const monthly = parseFloat(allHours[i][5]) || 0;
    cumulative[empId] = (cumulative[empId] || 0) + monthly;
    hoursSheet.getRange(i + 1, 7).setValue(Math.round(cumulative[empId] * 10) / 10);
  }
}

// ── 更新津貼等級 ──────────────────────────────────────
function updateInsuranceLevels() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const hoursSheet = ss.getSheetByName("累計工時");
  const staffSheet = ss.getSheetByName("夥伴資料");
  const allHours   = hoursSheet.getDataRange().getValues();
  const staffData  = staffSheet.getDataRange().getValues();

  for (let i = 1; i < allHours.length; i++) {
    const empId    = String(allHours[i][0]);
    const cumHours = parseFloat(allHours[i][6]) || 0;
    const skillLevel = cumHours >= 180 ? 20 : 0;
    let contribLevel = 0;
    if      (cumHours >= 4320) contribLevel = 20;
    else if (cumHours >= 3240) contribLevel = 15;
    else if (cumHours >= 2160) contribLevel = 10;
    else if (cumHours >= 1080) contribLevel = 5;

    hoursSheet.getRange(i + 1, 8).setValue(skillLevel);
    hoursSheet.getRange(i + 1, 9).setValue(contribLevel);

    for (let j = 1; j < staffData.length; j++) {
      if (String(staffData[j][0]) === empId) {
        staffSheet.getRange(j + 1, 33).setValue(skillLevel);
        staffSheet.getRange(j + 1, 34).setValue(contribLevel);
        break;
      }
    }
  }
}

// ── 月底薪資自動計算 ───────────────────────────────────
function calculateMonthlySalary() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt("薪資計算", "請輸入要計算的年月（格式：2026-05）：", ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return;
  const targetYM = response.getResponseText().trim();

  const staffSheet  = ss.getSheetByName("夥伴資料");
  const punchSheet  = ss.getSheetByName("打卡紀錄");
  const perfSheet   = ss.getSheetByName("業績記錄");
  const salarySheet = ss.getSheetByName("薪資明細");
  const hoursSheet  = ss.getSheetByName("累計工時");

  const staffData  = staffSheet.getDataRange().getValues();
  const punchData  = punchSheet.getDataRange().getValues();
  const perfData   = perfSheet.getDataRange().getValues();
  const hoursData  = hoursSheet.getDataRange().getValues();

  const perfMap = {};
  for (let i = 1; i < perfData.length; i++) {
    const ym = String(perfData[i][1]);
    if (ym !== targetYM) continue;
    const loc = String(perfData[i][3]);
    perfMap[`${ym}_${loc}`] = {
      groupBonus: String(perfData[i][8]) === "是",
      isSingle: String(perfData[i][9]) === "單人",
      perfBonusLevel: parseInt(perfData[i][11]) || 0,
    };
  }

  let addedCount = 0;
  const targetMonth = parseInt(targetYM.slice(5));

  for (let s = 1; s < staffData.length; s++) {
    const emp = staffData[s];
    const empId = String(emp[0]);
    const name  = String(emp[1]);
    if (!empId || !name || emp[10]) continue;

    const hourly       = parseFloat(emp[13]) || 190;
    const laborSelf    = parseFloat(emp[21]) || 0;
    const healthSelf   = parseFloat(emp[26]) || 0;
    const noInsure     = parseFloat(emp[29]) || 0;
    const transferFee  = parseFloat(emp[17]) || 0;
    const skillLevel   = parseFloat(emp[32]) || 0;
    const contribLevel = parseFloat(emp[33]) || 0;
    const longAge      = parseFloat(emp[34]) || 0;
    const birthday     = emp[4] ? new Date(emp[4]) : null;

    // 累計工時
    let cumHours = 0;
    for (let h = hoursData.length - 1; h >= 1; h--) {
      if (String(hoursData[h][0]) === empId) {
        cumHours = parseFloat(hoursData[h][6]) || 0;
        break;
      }
    }

    // 統計打卡工時
    const punchPairs = {};
    const locations  = new Set();
    let normalHours  = 0;

    for (let p = 1; p < punchData.length; p++) {
      const row = punchData[p];
      if (String(row[2]) !== empId) continue;
      if (!String(row[6]).startsWith(targetYM)) continue;
      const sid = String(row[4]);
      if (!punchPairs[sid]) punchPairs[sid] = {};
      if (String(row[5]) === "上班") punchPairs[sid].in  = new Date(row[6]);
      if (String(row[5]) === "下班") punchPairs[sid].out = new Date(row[6]);
      if (row[9]) locations.add(String(row[9]));
    }

    Object.values(punchPairs).forEach(pair => {
      if (!pair.in || !pair.out) return;
      normalHours += Math.max(0, (pair.out - pair.in) / 3600000);
    });

    if (normalHours === 0) continue;
    normalHours = Math.round(normalHours * 10) / 10;

    // 基本薪資
    const sessions = Object.values(punchPairs).filter(p => p.in && p.out);
    let basicPay = 0, ot1Pay = 0, ot2Pay = 0, ot3Pay = 0;
    sessions.forEach(sess => {
      const h = Math.max(0, (sess.out - sess.in) / 3600000);
      basicPay += Math.min(h, 8) * hourly;
      ot1Pay   += Math.max(0, Math.min(h - 8, 2)) * hourly * 1.33;
      ot2Pay   += Math.max(0, Math.min(h - 10, 2)) * hourly * 1.67;
      ot3Pay   += Math.max(0, h - 12) * hourly * 2;
    });

    basicPay = Math.round(basicPay);
    ot1Pay   = Math.round(ot1Pay);
    ot2Pay   = Math.round(ot2Pay);
    ot3Pay   = Math.round(ot3Pay);
    const basicTotal = basicPay + ot1Pay + ot2Pay + ot3Pay;

    // 津貼
    const skillBonus   = Math.round(normalHours * skillLevel);
    const contribBonus = Math.round(normalHours * contribLevel);
    const longBonus    = Math.round(normalHours * longAge);

    // 生日津貼
    let birthdayBonus = 0;
    if (birthday && !isNaN(birthday.getTime()) && (birthday.getMonth() + 1) === targetMonth) {
      if (normalHours >= 80) {
        birthdayBonus = cumHours >= 2160 ? 2400 : cumHours >= 1080 ? 1200 : 600;
      } else if (normalHours > 0) {
        birthdayBonus = 200;
      }
    }

    // 三節津貼
    let festivalBonus = 0;
    if ([1, 5, 9].includes(targetMonth)) {
      festivalBonus = normalHours >= 80 ? 600 : normalHours > 0 ? 200 : 0;
    }

    // 業績獎金
    let perfBonus = 0;
    locations.forEach(loc => {
      const key = `${targetYM}_${loc}`;
      if (perfMap[key]) perfBonus += perfMap[key].perfBonusLevel;
    });

    const totalSalary = basicTotal + skillBonus + contribBonus + longBonus +
                        birthdayBonus + festivalBonus + perfBonus + noInsure;
    const netSalary   = totalSalary - laborSelf - healthSelf - transferFee;

    salarySheet.appendRow([
      `${targetYM}-${empId}`, targetYM, empId, name,
      Array.from(locations).join("、"),
      normalHours, 0, normalHours,
      basicPay, ot1Pay, ot2Pay, ot3Pay, 0, basicTotal,
      0, perfBonus, skillBonus, contribBonus, longBonus,
      birthdayBonus, festivalBonus, 0,
      totalSalary, laborSelf, healthSelf, noInsure, transferFee,
      netSalary, "匯款", "待確認", "",
    ]);
    addedCount++;
  }

  ui.alert(`✅ 完成！共計算 ${addedCount} 位夥伴的 ${targetYM} 薪資。`);
}

// ── 面糊消耗計算 ──────────────────────────────────────
function calcFlourUsage() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const openSheet  = ss.getSheetByName("開店盤點");
  const closeSheet = ss.getSheetByName("收店盤點");
  const openData   = openSheet.getDataRange().getValues();
  const closeData  = closeSheet.getDataRange().getValues();

  for (let c = 1; c < closeData.length; c++) {
    const cr  = closeData[c];
    const date = String(cr[1]);
    const loc  = String(cr[5]);
    const openRow = openData.find(o => String(o[1]) === date && String(o[5]) === loc);
    if (!openRow) continue;

    const used = [6,7,8,9].map((fi, idx) => {
      const u = Math.max(0, Math.round(((parseFloat(openRow[fi])||0) - (parseFloat(cr[fi])||0)) * 100) / 100);
      closeSheet.getRange(c + 1, 12 + idx).setValue(u);
      return u;
    });

    const total = Math.round(used.reduce((a,b) => a+b, 0) * 100) / 100;
    closeSheet.getRange(c + 1, 16).setValue(total);
  }
  SpreadsheetApp.getUi().alert("✅ 面糊消耗量計算完成！");
}

// ── 自訂選單 ─────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🥚 紅玉系統")
    .addItem("📅 設定每日自動更新", "setDailyTrigger")
    .addSeparator()
    .addItem("⏱ 更新累計工時", "updateAccumulatedHours")
    .addItem("💰 計算當月薪資", "calculateMonthlySalary")
    .addItem("🥚 計算面糊消耗量", "calcFlourUsage")
    .addSeparator()
    .addItem("🔄 全部更新", "dailyAutoUpdate")
    .addToUi();
}

// ═══════════════════════════════════════════
// Phase 1:v1.0 結構更新(執行一次即可)
// ═══════════════════════════════════════════
function setupV2() {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  // ── 1. 夥伴資料:修正密碼欄標題 + 新增欄位 ──
  const staff = ss.getSheetByName("夥伴資料");
  staff.getRange("AK1").setValue("密碼"); // 原AK欄實際存放密碼,正名
  const newStaffCols = ["居住縣市","學生身份","介紹人員編","勞保狀態","健保狀態","約定書簽署日","團體意外險","緊急聯絡電話(補)"];
  staff.getRange(1, 39, 1, newStaffCols.length).setValues([newStaffCols]);
  staff.getRange(1, 39, 1, newStaffCols.length)
    .setBackground("#3a1c10").setFontColor("#f0d0b8").setFontWeight("bold");

  // 下拉選單
  const counties = ["台北市","新北市","基隆市","桃園市","新竹市","新竹縣","苗栗縣","台中市","彰化縣","南投縣","雲林縣","嘉義市","嘉義縣","台南市","高雄市","屏東縣","宜蘭縣","花蓮縣","台東縣","澎湖縣","金門縣","連江縣"];
  const dv = (list) => SpreadsheetApp.newDataValidation().requireValueInList(list, true).build();
  staff.getRange(2, 39, 500, 1).setDataValidation(dv(counties));            // 居住縣市
  staff.getRange(2, 40, 500, 1).setDataValidation(dv(["是","否"]));          // 學生身份
  staff.getRange(2, 42, 500, 1).setDataValidation(dv(["公司投保","自願自保"])); // 勞保狀態
  staff.getRange(2, 43, 500, 1).setDataValidation(dv(["公司投保","他處已保","無投保"])); // 健保狀態
  staff.getRange(2, 45, 500, 1).setDataValidation(dv(["是","否"]));          // 團體意外險

  // ── 2. 收店盤點:進貨欄位 ──
  const close = ss.getSheetByName("收店盤點");
  const closeCols = ["原味進貨kg","可可進貨kg","紅玉進貨kg","抹茶進貨kg"];
  close.getRange(1, 23, 1, 4).setValues([closeCols]);
  close.getRange(1, 23, 1, 4).setBackground("#3a1c10").setFontColor("#f0d0b8").setFontWeight("bold");

  // ── 3. 業績記錄:業績類型 ──
  const perf = ss.getSheetByName("業績記錄");
  perf.getRange(1, 14).setValue("業績類型");
  perf.getRange(1, 14).setBackground("#3a1c10").setFontColor("#f0d0b8").setFontWeight("bold");

  // ── 4. 薪資明細:新欄位 ──
  const sal = ss.getSheetByName("薪資明細");
  sal.getRange(1, 32, 1, 2).setValues([["假日出勤獎金","保費加發"]]);
  sal.getRange(1, 32, 1, 2).setBackground("#3a1c10").setFontColor("#f0d0b8").setFontWeight("bold");

  // ── 5. 新工作表 ──
  const mkSheet = (name, headers, prefill) => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.getRange(1, 1, 1, headers.length)
      .setBackground("#3a1c10").setFontColor("#f0d0b8").setFontWeight("bold");
    sh.setFrozenRows(1);
    if (prefill && prefill.length) sh.getRange(2, 1, prefill.length, prefill[0].length).setValues(prefill);
    return sh;
  };

  // 行事曆設定
  const cal = mkSheet("行事曆設定", ["日期","日別類型","適用範圍","備注"], []);
  cal.getRange(2, 2, 500, 1).setDataValidation(dv(["平日","假日(六日)","國定假日","連假日","颱風日"]));
  cal.getRange(2, 3, 500, 1).setDataValidation(dv(["全部", ...counties]));

  // 勞保級距表(2026請依最新公告校對)
  mkSheet("勞保級距表", ["級距","投保薪資","員工自付","雇主負擔","政府補助"], [
    [1,27600,313,1134,126],[2,28800,326,1184,131],[3,30300,344,1246,138],
    [4,31800,361,1308,145],[5,33300,378,1369,152],[6,34800,395,1430,159],
    [7,36300,412,1492,165],[8,37800,429,1553,172],[9,38700,439,1590,176],
    [10,40100,455,1649,183],[11,42000,476,1726,191],[12,43900,498,1804,200],
  ]);

  // 健保級距表
  mkSheet("健保級距表", ["級距","投保金額","員工自付(本人)","雇主負擔","眷屬每人自付"], [
    [1,27470,447,2010,447],[2,28800,469,2109,469],[3,30300,494,2220,494],
    [4,31800,518,2330,518],[5,33300,542,2439,542],[6,34800,567,2550,567],
    [7,36300,591,2659,591],[8,38200,622,2797,622],[9,40100,653,2937,653],
    [10,42000,684,3076,684],
  ]);

  // 參數設定
  mkSheet("參數設定", ["參數名","數值","說明"], [
    ["基準時薪",196,"勞動部法定最低時薪,每年1月校對"],
    ["C類預設抽成",70,"份數計算每份抽成,可調"],
    ["假日出勤獎金",500,"每櫃每日總額,依時數比例拆分"],
    ["一般達標時數",180,"每月工時門檻"],
    ["學生達標時數",72,"學生夥伴每月工時門檻"],
    ["假日達標天數",4,"每月假日出勤天數門檻"],
    ["年終緩衝月數",2,"全年容許未達標月數"],
    ["業績門檻1",10000,"單人,獎金500"],
    ["業績門檻2",12500,"單人,獎金700"],
    ["業績門檻3",15000,"單人,獎金1000"],
    ["團體獎金門檻",200000,"月30天基準業績"],
    ["介紹門檻1",180,"新夥伴累計hr,發2000"],
    ["介紹門檻2",360,"新夥伴累計hr,發3000"],
    ["介紹門檻3",720,"新夥伴累計hr,發5000"],
  ]);

  // 櫃位設定
  const loc = mkSheet("櫃位設定", ["櫃位名稱","地區縣市","業績類型","每份抽成","狀態"], []);
  loc.getRange(2, 2, 200, 1).setDataValidation(dv(counties));
  loc.getRange(2, 3, 200, 1).setDataValidation(dv(["A百貨","B直結","C份數"]));
  loc.getRange(2, 5, 200, 1).setDataValidation(dv(["營運中","已結束"]));

  // 達標紀錄
  mkSheet("達標紀錄", ["員工編號","姓名","年月","當月工時","假日出勤天數","身份別","工時門檻","是否達標","寬免","備注"], []);

  // 介紹獎金追蹤
  mkSheet("介紹獎金追蹤", ["介紹人編號","介紹人姓名","新夥伴編號","新夥伴姓名","累計工時","已發180階段","已發360階段","已發720階段","已發總額","備注"], []);

  SpreadsheetApp.getUi().alert("✅ Phase 1 完成!新增7張工作表、更新4張現有表欄位。");
}
// ═══════════════════════════════════════════
// Phase 2-1:共用工具 + 日別判定 + 達標引擎
// ═══════════════════════════════════════════

// 補建特休紀錄表(執行一次)
function setupV2b() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName("特休紀錄");
  if (!sh) sh = ss.insertSheet("特休紀錄");
  const h = ["員工編號","姓名","日期","類型","時數","備注"];
  sh.getRange(1,1,1,h.length).setValues([h]);
  sh.getRange(1,1,1,h.length).setBackground("#3a1c10").setFontColor("#f0d0b8").setFontWeight("bold");
  sh.setFrozenRows(1);
  sh.getRange(2,4,500,1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(["特休","事假","病假"],true).build());
  SpreadsheetApp.getUi().alert("✅ 特休紀錄表建立完成");
}

// ── 讀取參數設定 ──
function getParams() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const data = ss.getSheetByName("參數設定").getDataRange().getValues();
  const p = {};
  for (let i=1; i<data.length; i++) p[String(data[i][0])] = parseFloat(data[i][1]) || 0;
  return p;
}

// ── 讀取櫃位設定 → {櫃位名: {county, type, unitPrice}} ──
function getLocations() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const data = ss.getSheetByName("櫃位設定").getDataRange().getValues();
  const m = {};
  for (let i=1; i<data.length; i++) {
    if (!data[i][0]) continue;
    m[String(data[i][0])] = {
      county: String(data[i][1]||""),
      type: String(data[i][2]||"A百貨"),
      unitPrice: parseFloat(data[i][3]) || 70,
    };
  }
  return m;
}

// ── 讀取行事曆 → {日期字串: [{type, scope}]} ──
function getCalendar() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const data = ss.getSheetByName("行事曆設定").getDataRange().getValues();
  const cal = {};
  for (let i=1; i<data.length; i++) {
    if (!data[i][0]) continue;
    const d = Utilities.formatDate(new Date(data[i][0]), "Asia/Taipei", "yyyy-MM-dd");
    if (!cal[d]) cal[d] = [];
    cal[d].push({ type:String(data[i][1]), scope:String(data[i][2]||"全部") });
  }
  return cal;
}

// ── 日別判定核心 ──
// 回傳:平日/假日/連假日/國定假日/颱風日
function getDayType(dateStr, locCounty, homeCounty, cal) {
  const entries = cal[dateStr] || [];
  const hit = t => entries.some(e => e.type===t &&
    (e.scope==="全部" || e.scope===locCounty || e.scope===homeCounty));
  if (hit("颱風日"))   return "颱風日";
  if (hit("國定假日")) return "國定假日";
  if (hit("連假日"))   return "連假日";
  if (hit("假日(六日)")) return "假日";
  const wd = new Date(dateStr).getDay();
  if (wd===0 || wd===6) return "假日";
  return "平日";
}

// 是否計入「假日達標天數」
function isHolidayForQuota(dayType) {
  return ["假日","連假日","國定假日"].includes(dayType);
}

// ── 達標引擎:計算指定年月全員達標狀況 ──
function runQualification() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.prompt("達標判定","請輸入年月(格式:2026-05):",ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton()!==ui.Button.OK) return;
  const ym = resp.getResponseText().trim();
  calcQualification(ym);
  ui.alert("✅ " + ym + " 達標判定完成,請查看「達標紀錄」表");
}

function calcQualification(ym) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const params = getParams();
  const cal = getCalendar();
  const locs = getLocations();
  const staff = ss.getSheetByName("夥伴資料").getDataRange().getValues();
  const punch = ss.getSheetByName("打卡紀錄").getDataRange().getValues();
  const leave = ss.getSheetByName("特休紀錄").getDataRange().getValues();
  const sched = ss.getSheetByName("班表").getDataRange().getValues();
  const rec = ss.getSheetByName("達標紀錄");

  // 整理打卡:empId → {date → {in, out, loc}}
  const days = {};
  for (let i=1; i<punch.length; i++) {
    const r = punch[i];
    const empId = String(r[2]); if (!empId) continue;
    const t = r[6] ? new Date(r[6]) : null; if (!t||isNaN(t)) continue;
    const d = Utilities.formatDate(t,"Asia/Taipei","yyyy-MM-dd");
    if (!d.startsWith(ym)) continue;
    if (!days[empId]) days[empId] = {};
    if (!days[empId][d]) days[empId][d] = { loc:String(r[9]||"") };
    if (String(r[5])==="上班") days[empId][d].in = t;
    if (String(r[5])==="下班") days[empId][d].out = t;
  }

  // 逐位夥伴計算
  for (let s=1; s<staff.length; s++) {
    const emp = staff[s];
    const empId = String(emp[0]); if (!empId || emp[10]) continue; // 跳過離職
    const name = String(emp[1]);
    const home = String(emp[38]||"");          // 居住縣市
    const isStudent = String(emp[39])==="是";  // 學生身份
    let hours = 0, holidayDays = 0;
    const holidaySet = new Set();

    // 出勤時數 + 假日天數
    const empDays = days[empId] || {};
    Object.entries(empDays).forEach(([d, v]) => {
      const locCounty = (locs[v.loc]||{}).county || "";
      const dt = getDayType(d, locCounty, home, cal);
      if (v.in && v.out) {
        hours += Math.max(0, (v.out - v.in)/ 3600000);
        if (isHolidayForQuota(dt)) holidaySet.add(d);
      }
    });

    // 特休:計入時數(8hr/天)與假日天數
    for (let i=1; i<leave.length; i++) {
      if (String(leave[i][0])!==empId) continue;
      if (String(leave[i][3])!=="特休") continue;
      const d = Utilities.formatDate(new Date(leave[i][2]),"Asia/Taipei","yyyy-MM-dd");
      if (!d.startsWith(ym)) continue;
      hours += parseFloat(leave[i][4]) || 8;
      const dt = getDayType(d, "", home, cal);
      if (isHolidayForQuota(dt)) holidaySet.add(d);
    }

    // 颱風日未出勤:依排班時數計入達標(不計薪在薪資引擎處理)
    for (let i=1; i<sched.length; i++) {
      if (String(sched[i][3])!==empId) continue;
      const d = Utilities.formatDate(new Date(sched[i][1]),"Asia/Taipei","yyyy-MM-dd");
      if (!d.startsWith(ym)) continue;
      if (empDays[d] && empDays[d].in) continue; // 有出勤就跳過
      const locCounty = (locs[String(sched[i][5])]||{}).county || "";
      if (getDayType(d, locCounty, home, cal)==="颱風日") {
        hours += parseFloat(sched[i][8]) || 8;
      }
    }

    holidayDays = holidaySet.size;
    hours = Math.round(hours*10)/10;
    const threshold = isStudent ? (params["學生達標時數"]||72) : (params["一般達標時數"]||180);
    const hOK = hours >= threshold;
    const dOK = holidayDays >= (params["假日達標天數"]||4);
    const pass = (hOK && dOK) ? "是" : "否";

    // 寫入/更新達標紀錄
    const exist = rec.getDataRange().getValues();
    let rowIdx = -1;
    for (let i=1; i<exist.length; i++) {
      if (String(exist[i][0])===empId && ymNorm(exist[i][2])===ym) { rowIdx=i+1; break; }
    }
    const rowData = [empId, name, ym, hours, holidayDays,
      isStudent?"學生":"一般", threshold, pass, "", ""];
    if (rowIdx>0) rec.getRange(rowIdx,1,1,10).setValues([rowData]);
    else rec.appendRow(rowData);
  }
}
// ═══════════════════════════════════════════
// Phase 2-2:薪資計算引擎 v2(v3制度完整版)
// ═══════════════════════════════════════════
const CEIL = v => Math.ceil(v); // 全面無條件進位

// 滾動6個月平均薪資 → 對應級距
function getInsuranceRow(ss, empId, tableName) {
  const sal = ss.getSheetByName("薪資明細").getDataRange().getValues();
  let sum=0, n=0;
  for (let i=sal.length-1; i>=1 && n<6; i--) {
    if (String(sal[i][2])===empId) { sum+=parseFloat(sal[i][22])||0; n++; }
  }
  const avg = n>0 ? sum/n : 28000;
  const tbl = ss.getSheetByName(tableName).getDataRange().getValues();
  for (let i=1; i<tbl.length; i++) {
    if (avg <= parseFloat(tbl[i][1])) return tbl[i];
  }
  return tbl[tbl.length-1];
}

function runSalaryV2() {
  const ui = SpreadsheetUi_();
  const resp = ui.prompt("薪資計算v2","請輸入年月(2026-05):",ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton()!==ui.Button.OK) return;
  const ym = resp.getResponseText().trim();
  calcQualification(ym); // 先跑達標
  const cnt = calcSalaryV2(ym);
  ui.alert("✅ "+ym+" 薪資計算完成,共 "+cnt+" 位。請至薪資明細確認後發布。");
}
function SpreadsheetUi_(){ return SpreadsheetApp.getUi(); }

function calcSalaryV2(ym) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const P = getParams(), cal = getCalendar(), locs = getLocations();
  const baseWage = P["基準時薪"]||196;
  const staff = ss.getSheetByName("夥伴資料").getDataRange().getValues();
  const punch = ss.getSheetByName("打卡紀錄").getDataRange().getValues();
  const closeS = ss.getSheetByName("收店盤點").getDataRange().getValues();
  const qual = ss.getSheetByName("達標紀錄").getDataRange().getValues();
  const cum = ss.getSheetByName("累計工時").getDataRange().getValues();
  const salSheet = ss.getSheetByName("薪資明細");
  const targetMonth = parseInt(ym.slice(5));

  // ── 整理:每人每日 session ──
  const sessions = {}; // empId → [{date,loc,hrs,dayType}]
  const locDayHours = {}; // "date_loc" → 總時數(拆假日獎金用)
  for (let i=1; i<punch.length; i++) {
    const r = punch[i], empId = String(r[2]); if (!empId) continue;
    const t = r[6]?new Date(r[6]):null; if(!t||isNaN(t)) continue;
    const d = Utilities.formatDate(t,"Asia/Taipei","yyyy-MM-dd");
    if (!d.startsWith(ym)) continue;
    const key = empId+"_"+d;
    sessions[key] = sessions[key] || {empId, date:d, loc:String(r[9]||"")};
    if (String(r[5])==="上班") sessions[key].in = t;
    if (String(r[5])==="下班") sessions[key].out = t;
  }
  Object.values(sessions).forEach(s => {
    if (!s.in || !s.out) return;
    s.hrs = Math.max(0,(s.out-s.in)/ 3600000);
    const k = s.date+"_"+s.loc;
    locDayHours[k] = (locDayHours[k]||0) + s.hrs;
  });

  // ── 當日營業額(收店盤點) ──
  const dayRevenue = {}; // "date_loc" → 金額或份數
  for (let i=1; i<closeS.length; i++) {
    const d = closeS[i][1] ? Utilities.formatDate(new Date(closeS[i][1]),"Asia/Taipei","yyyy-MM-dd") : "";
    if (!d.startsWith(ym)) continue;
    dayRevenue[d+"_"+String(closeS[i][5])] = parseFloat(closeS[i][16])||0;
  }
  // 當日同櫃人數(判單雙人)
  const locDayCount = {};
  Object.values(sessions).forEach(s => {
    if (!s.hrs) return;
    const k = s.date+"_"+s.loc;
    locDayCount[k] = (locDayCount[k]||0)+1;
  });

  let count = 0;
  for (let si=1; si<staff.length; si++) {
    const emp = staff[si], empId = String(emp[0]);
    if (!empId || emp[10]) continue;
    const name = String(emp[1]);
    const hourly = Math.max(parseFloat(emp[13])||baseWage, baseWage);
    const home = String(emp[38]||"");
    const birthday = emp[4] ? new Date(emp[4]) : null;
    const laborSt = String(emp[41]||"公司投保");
    const healthSt = String(emp[42]||"公司投保");
    const deps = parseInt(emp[27])||0;

    // 累計工時(津貼判定)
    let cumHrs = 0;
    for (let i=cum.length-1; i>=1; i--) {
      if (String(cum[i][0])===empId) { cumHrs = parseFloat(cum[i][6])||0; break; }
    }

    let basic=0, ot1=0, ot2=0, ot3=0, dblPay=0, holBonus=0;
    let normalH=0, holH=0; const locSet=new Set(); let perfBonus=0;

    Object.values(sessions).filter(s=>s.empId===empId && s.hrs).forEach(s=>{
      const lc = (locs[s.loc]||{}); locSet.add(s.loc);
      const dt = getDayType(s.date, lc.county||"", home, cal);
      const h = s.hrs;
      const b = Math.min(h,8)*hourly, o1=Math.max(0,Math.min(h-8,2))*hourly*1.33,
            o2=Math.max(0,Math.min(h-10,2))*hourly*1.67, o3=Math.max(0,h-12)*hourly*2;
      const dayPay = b+o1+o2+o3;
      if (dt==="國定假日"||dt==="颱風日") { dblPay += dayPay; holH+=h; }
      else { basic+=b; ot1+=o1; ot2+=o2; ot3+=o3; normalH+=h; }
      // 假日$500拆分(六日/連假,非雙倍日)
      if (dt==="假日"||dt==="連假日"||(lc.kind==="活動"&&dt==="平日")) {
        const tot = locDayHours[s.date+"_"+s.loc]||h;
        holBonus += CEIL((P["假日出勤獎金"]||500)/tot*h);
      }
      // 業績獎金(單日)
      const rev = dayRevenue[s.date+"_"+s.loc];
      if (rev!==undefined) {
        let calc = rev;
        if (lc.type==="A百貨") calc = rev*0.8;
        else if (lc.type==="C份數") calc = rev*(lc.unitPrice||P["C類預設抽成"]||70);
        const dual = (locDayCount[s.date+"_"+s.loc]||1) >= 2;
        const th = dual ? [25000,30000,37500] : [P["業績門檻1"]||10000,P["業績門檻2"]||12500,P["業績門檻3"]||15000];
        if (calc>th[2]) perfBonus+=1000; else if (calc>th[1]) perfBonus+=700; else if (calc>th[0]) perfBonus+=500;
      }
    });

    const totalH = normalH+holH;
    if (totalH===0) continue;
    basic=CEIL(basic); ot1=CEIL(ot1); ot2=CEIL(ot2); ot3=CEIL(ot3);
    dblPay=CEIL(dblPay*2); // 雙倍日整日×2
    const basicTotal = basic+ot1+ot2+ot3+dblPay;

    // 津貼
    const skill = cumHrs>180 ? CEIL(totalH*20) : 0;
    let cl=0; if(cumHrs>=4320)cl=20; else if(cumHrs>=3240)cl=15; else if(cumHrs>=2160)cl=10; else if(cumHrs>=1080)cl=5;
    const contrib = CEIL(totalH*cl);
    let age=0;
    if (birthday&&!isNaN(birthday)) {
      const ref=new Date(ym+"-01");
      age=ref.getFullYear()-birthday.getFullYear();
      if (ref.getMonth()<birthday.getMonth()) age--;
    }
    const evergreen = age>=50 ? CEIL(totalH*(10+(age-50))) : 0;
    // 生日/三節
    let bday=0;
    if (birthday && birthday.getMonth()+1===targetMonth) {
      bday = totalH>=80 ? (cumHrs>=4320?2400:cumHrs>=2160?1200:cumHrs>=1080?600:600) : (totalH>0?200:0);
    }
    let fest=0;
    if ([1,5,9].includes(targetMonth)) fest = totalH>=80 ? (cumHrs>=4320?2400:cumHrs>=2160?1200:cumHrs>=1080?600:600) : (totalH>0?200:0);

    // 勞健保
    let laborDed=0, healthDed=0, insAdd=0;
    if (laborSt==="公司投保") laborDed=parseFloat(emp[21])||0;
    else insAdd += CEIL(parseFloat(getInsuranceRow(ss,empId,"勞保級距表")[3])||0);
    if (healthSt==="公司投保") healthDed=(parseFloat(emp[26])||0)*(1+Math.min(deps,3));
    else if (healthSt==="無投保") insAdd += CEIL(parseFloat(getInsuranceRow(ss,empId,"健保級距表")[3])||0);

    const fee = parseFloat(emp[17])||0;
    const gross = basicTotal+perfBonus+skill+contrib+evergreen+bday+fest+holBonus+insAdd;
    const net = gross-laborDed-healthDed-fee;

    // 寫入(覆蓋同月同人)
    const ex = salSheet.getDataRange().getValues();
    let ri=-1;
    for (let i=1;i<ex.length;i++) if(String(ex[i][2])===empId&&ymNorm(ex[i][1])===ym){ri=i+1;break;}
    const row=[ym+"-"+empId,ym,empId,name,Array.from(locSet).join("、"),
      Math.round(normalH*10)/10,Math.round(holH*10)/10,Math.round(totalH*10)/10,
      basic,ot1,ot2,ot3,dblPay,basicTotal,0,perfBonus,skill,contrib,evergreen,
      bday,fest,0,gross,laborDed,healthDed,insAdd,fee,net,"匯款","待確認","",
      holBonus,insAdd];
    if (ri>0) salSheet.getRange(ri,1,1,33).setValues([row]);
    else salSheet.appendRow(row);
    count++;
  }
  return count;
}
// ── 修正:年月欄轉文字格式 + 清除重複列 ──
function fixYmBug() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  ["達標紀錄","薪資明細","累計工時"].forEach(name => {
    const sh = ss.getSheetByName(name);
    if (sh) sh.getRange("A:E").setNumberFormat("@"); // 整區設為純文字
  });
  // 清除達標紀錄重複(保留最後一筆)
  const rec = ss.getSheetByName("達標紀錄");
  const data = rec.getDataRange().getValues();
  const seen = {}; const dupRows = [];
  for (let i=data.length-1; i>=1; i--) {
    const key = String(data[i][0]) + "_" + ymNorm(data[i][2]);
    if (seen[key]) dupRows.push(i+1); else seen[key]=true;
  }
  dupRows.sort((a,b)=>b-a).forEach(r => rec.deleteRow(r));
  SpreadsheetApp.getUi().alert("✅ 修正完成,清除 "+dupRows.length+" 筆重複");
}
function ymNorm(v) {
  if (v instanceof Date) return Utilities.formatDate(v,"Asia/Taipei","yyyy-MM");
  return String(v).trim();
}

// ═══════════════════════════════════════════
// Phase 2-3:年終引擎 + 介紹獎金 + 選單
// ═══════════════════════════════════════════

// ── 介紹獎金引擎(每月結算時執行) ──
function runReferralBonus() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const P = getParams();
  const staff = ss.getSheetByName("夥伴資料").getDataRange().getValues();
  const cum = ss.getSheetByName("累計工時").getDataRange().getValues();
  const track = ss.getSheetByName("介紹獎金追蹤");
  const tData = track.getDataRange().getValues();
  let msg = [];

  for (let s=1; s<staff.length; s++) {
    const newId = String(staff[s][0]);
    const refId = String(staff[s][40]||""); // 介紹人員編
    if (!newId || !refId) continue;

    // 新夥伴累計工時
    let hrs = 0;
    for (let i=cum.length-1; i>=1; i--) {
      if (String(cum[i][0])===newId) { hrs=parseFloat(cum[i][6])||0; break; }
    }

    // 找/建追蹤列
    let ri = -1;
    for (let i=1; i<tData.length; i++) {
      if (String(tData[i][2])===newId) { ri=i+1; break; }
    }
    const refName = (staff.find(r=>String(r[0])===refId)||[])[1]||"";
    if (ri<0) {
      track.appendRow([refId, refName, newId, String(staff[s][1]), hrs, "","","",0,""]);
      ri = track.getLastRow();
    }
    const row = track.getRange(ri,1,1,10).getValues()[0];
    let total = parseFloat(row[8])||0;
    const stages = [
      { th:P["介紹門檻1"]||180, amt:2000, col:6 },
      { th:P["介紹門檻2"]||360, amt:3000, col:7 },
      { th:P["介紹門檻3"]||720, amt:5000, col:8 },
    ];
    stages.forEach(st => {
      if (hrs>=st.th && !row[st.col-1]) {
        track.getRange(ri,st.col).setValue(new Date());
        total += st.amt;
        msg.push(refName+" 因 "+staff[s][1]+" 滿"+st.th+"hr → 發$"+st.amt);
      }
    });
    track.getRange(ri,5).setValue(hrs);
    track.getRange(ri,9).setValue(total);
  }
  SpreadsheetApp.getUi().alert(msg.length ? "✅ 介紹獎金:\n"+msg.join("\n")+"\n\n請手動加入介紹人當月薪資「職務加給」欄" : "本月無新達標的介紹獎金");
}

// ── 年終引擎(每年1月執行) ──
function runYearEndBonus() {
  const ui = SpreadsheetApp.getUi();
  let resp = ui.prompt("年終計算","請輸入年度(如2026):",ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton()!==ui.Button.OK) return;
  const year = resp.getResponseText().trim();
  resp = ui.prompt("年度盈餘","請輸入公司年度盈餘(數字):",ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton()!==ui.Button.OK) return;
  const profit = parseFloat(resp.getResponseText().replace(/,/g,""))||0;

  let rate = 5;
  if (profit>=2000000) rate=20;
  else if (profit>=1500000) rate=15;
  else if (profit>=1000000) rate=10;

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const P = getParams();
  const buffer = P["年終緩衝月數"]||2;
  const staff = ss.getSheetByName("夥伴資料").getDataRange().getValues();
  const qual = ss.getSheetByName("達標紀錄").getDataRange().getValues();

  // 結果表
  let out = ss.getSheetByName("年終結算");
  if (!out) out = ss.insertSheet("年終結算");
  out.clear();
  const h = ["年度","員工編號","姓名","到職月","達標月數","未達標月數","寬免月數","達標月工時合計","提撥/hr","年終獎金","資格"];
  out.getRange(1,1,1,h.length).setValues([h]);
  out.getRange(1,1,1,h.length).setBackground("#3a1c10").setFontColor("#f0d0b8").setFontWeight("bold");

  for (let s=1; s<staff.length; s++) {
    const empId=String(staff[s][0]); if(!empId||staff[s][10]) continue;
    const name=String(staff[s][1]);
    const hire = staff[s][9] ? new Date(staff[s][9]) : null;
    let startM = 1;
    if (hire && hire.getFullYear()===parseInt(year)) startM = hire.getMonth()+1;

    let passM=0, failM=0, waiveM=0, hrsSum=0;
    for (let m=startM; m<=12; m++) {
      const ym = year+"-"+String(m).padStart(2,"0");
      let found=null;
      for (let i=1;i<qual.length;i++) {
        if (String(qual[i][0])===empId && ymNorm(qual[i][2])===ym) { found=qual[i]; break; }
      }
      if (!found) { failM++; continue; }
      const waived = String(found[8]||"").indexOf("寬免")>=0;
      if (String(found[7])==="是" || waived) {
        passM++; if(waived) waiveM++;
        hrsSum += parseFloat(found[3])||0;
      } else failM++;
    }
    const eligible = failM<=buffer;
    const bonus = eligible ? CEIL(hrsSum*rate) : 0;
    out.appendRow([year,empId,name,startM+"月",passM,failM,waiveM,
      Math.round(hrsSum*10)/10,rate,bonus,eligible?"✅發放":"❌超過緩衝"]);
  }
  ui.alert("✅ "+year+" 年終結算完成(盈餘$"+profit.toLocaleString()+" → $"+rate+"/hr)\n請查看「年終結算」表");
}

// ── 更新選單(覆蓋原本的 onOpen) ──
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🥚 紅玉系統")
    .addItem("📅 設定每日自動更新","setDailyTrigger")
    .addSeparator()
    .addItem("⏱ 更新累計工時","updateAccumulatedHours")
    .addItem("✅ 達標判定(月)","runQualification")
    .addItem("💰 薪資計算v2(月)","runSalaryV2")
    .addItem("🤝 介紹獎金結算(月)","runReferralBonus")
    .addSeparator()
    .addItem("🎊 年終結算(年)","runYearEndBonus")
    .addItem("🥚 麵糊消耗計算","calcFlourUsage")
    .addToUi();
}
// ═══════════════════════════════════════════
// Phase 3 後端:新API + 進貨欄 + 照片上傳
// ═══════════════════════════════════════════
const DRIVE_ROOT = "紅玉滿赤心員工系統"; // Google Drive 根資料夾名

// ── 覆蓋 doGet:加入 getQuota / getLocations ──
function doGet(e) {
  const params = e.parameter;
  const action = params.action;
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let result;
  try {
    if (params.payload) {
      const data = JSON.parse(decodeURIComponent(params.payload));
      const a = data.action;
      if (a === "punch")      result = savePunch(ss, data);
      else if (a === "openStore")  result = saveOpenStore(ss, data);
      else if (a === "closeStore") result = saveCloseStore(ss, data);
      else result = { error: "未知的寫入動作" };
    } else {
      if (action === "login")              result = loginUser(ss, params);
      else if (action === "getSchedule")   result = getSchedule(ss, params);
      else if (action === "getSalary")     result = getSalary(ss, params);
      else if (action === "getAnnouncements") result = getAnnouncements(ss);
      else if (action === "getStaffInfo")  result = getStaffInfo(ss, params);
      else if (action === "getQuota")      result = getQuotaApi(ss, params);
      else if (action === "getLocations")  result = getLocationsApi(ss);
      else result = { error: "未知的動作: " + action };
    }
  } catch(err) { result = { error: err.toString() }; }
  const json = JSON.stringify(result);
  if (params.callback) return ContentService.createTextOutput(params.callback+"("+json+")").setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

// ── 覆蓋 doPost:加入 uploadPhoto ──
function doPost(e) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let result;
  try {
    const data = JSON.parse(e.postData.contents);
    const a = data.action;
    if (a === "punch")       result = savePunch(ss, data);
    else if (a === "openStore")  result = saveOpenStore(ss, data);
    else if (a === "closeStore") result = saveCloseStore(ss, data);
    else if (a === "uploadPhoto") result = savePhotoToDrive(data);
    else result = { error: "未知的動作" };
  } catch(err) { result = { error: err.toString() }; }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

// ── 照片存入 Drive ──
function savePhotoToDrive(data) {
  const roots = DriveApp.getFoldersByName(DRIVE_ROOT);
  const root = roots.hasNext() ? roots.next() : DriveApp.createFolder(DRIVE_ROOT);
  const subName = String(data.folder||"其他照片");
  const subs = root.getFoldersByName(subName);
  const sub = subs.hasNext() ? subs.next() : root.createFolder(subName);
  const fname = [data.date, data.loc, data.name, Date.now()].filter(Boolean).join("_") + ".jpg";
  const blob = Utilities.newBlob(Utilities.base64Decode(data.base64), "image/jpeg", fname);
  const file = sub.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { success: true, url: file.getUrl() };
}

// ── 櫃位設定 API ──
function getLocationsApi(ss) {
  return { success: true, data: getLocations() };
}

// ── 即時達標進度 API ──
function getQuotaApi(ss, params) {
  const empId = String(params.empId||"");
  const ym = String(params.ym||"");
  const P = getParams(), cal = getCalendar(), locs = getLocations();
  const staff = ss.getSheetByName("夥伴資料").getDataRange().getValues();
  const punch = ss.getSheetByName("打卡紀錄").getDataRange().getValues();
  const leave = ss.getSheetByName("特休紀錄").getDataRange().getValues();
  const emp = staff.find(r=>String(r[0])===empId);
  if (!emp) return { error:"查無夥伴" };
  const home = String(emp[38]||"");
  const isStudent = String(emp[39])==="是";

  const days = {};
  for (let i=1;i<punch.length;i++){
    const r=punch[i]; if(String(r[2])!==empId) continue;
    const t=r[6]?new Date(r[6]):null; if(!t||isNaN(t)) continue;
    const d=Utilities.formatDate(t,"Asia/Taipei","yyyy-MM-dd");
    if(!d.startsWith(ym)) continue;
    days[d]=days[d]||{loc:String(r[9]||"")};
    if(String(r[5])==="上班") days[d].in=t;
    if(String(r[5])==="下班") days[d].out=t;
  }
  let hours=0; const hset=new Set();
  Object.entries(days).forEach(([d,v])=>{
    if(!v.in||!v.out) return;
    hours+=Math.max(0,(v.out-v.in)/ 3600000);
    const lc=(locs[v.loc]||{}).county||"";
    if(isHolidayForQuota(getDayType(d,lc,home,cal))) hset.add(d);
  });
  for (let i=1;i<leave.length;i++){
    if(String(leave[i][0])!==empId||String(leave[i][3])!=="特休") continue;
    const d=Utilities.formatDate(new Date(leave[i][2]),"Asia/Taipei","yyyy-MM-dd");
    if(!d.startsWith(ym)) continue;
    hours+=parseFloat(leave[i][4])||8;
    if(isHolidayForQuota(getDayType(d,"",home,cal))) hset.add(d);
  }
  return { success:true, data:{
    hours: Math.round(hours*10)/10,
    hourTarget: isStudent?(P["學生達標時數"]||72):(P["一般達標時數"]||180),
    holidayDays: hset.size,
    holidayTarget: P["假日達標天數"]||4,
    identity: isStudent?"學生":"一般",
  }};
}

// ── 覆蓋 saveCloseStore:含進貨欄(W-Z) ──
function saveCloseStore(ss, data) {
  const sheet = ss.getSheetByName("收店盤點");
  const id = "C"+Date.now();
  const n = v => parseFloat(v)||0;
  const rem=[n(data.remOriginal),n(data.remCocoa),n(data.remRuby),n(data.remMatcha)];
  const remT=Math.round(rem.reduce((a,b)=>a+b,0)*100)/100;
  sheet.appendRow([
    id, String(data.date||""), String(data.scheduleId||""), String(data.empId||""),
    String(data.name||""), String(data.location||""),
    rem[0],rem[1],rem[2],rem[3],remT,
    "","","","","", // 消耗欄由 calcFlourUsage 計算
    n(data.revenue), n(data.cash),
    String(data.photoUrl||""), String(data.handoverNote||""),
    new Date().toISOString(), "",
    n(data.rsOriginal), n(data.rsCocoa), n(data.rsRuby), n(data.rsMatcha),
  ]);
  return { success:true, id };
}

// ── 覆蓋 calcFlourUsage:消耗 = 開店+進貨−剩餘 ──
function calcFlourUsage() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const openS = ss.getSheetByName("開店盤點").getDataRange().getValues();
  const closeSh = ss.getSheetByName("收店盤點");
  const closeD = closeSh.getDataRange().getValues();
  for (let c=1;c<closeD.length;c++){
    const cr=closeD[c];
    const d = cr[1] ? Utilities.formatDate(new Date(cr[1]),"Asia/Taipei","yyyy-MM-dd") : "";
    const loc = String(cr[5]);
    const openRow = openS.find(o => o[1] && Utilities.formatDate(new Date(o[1]),"Asia/Taipei","yyyy-MM-dd")===d && String(o[5])===loc);
    if(!openRow) continue;
    let total=0;
    [0,1,2,3].forEach(i=>{
      const start=parseFloat(openRow[6+i])||0;
      const rs=parseFloat(cr[22+i])||0;   // 進貨 W-Z
      const rem=parseFloat(cr[6+i])||0;
      const used=Math.max(0,Math.round((start+rs-rem)*100)/100);
      closeSh.getRange(c+1,12+i).setValue(used);
      total+=used;
    });
    closeSh.getRange(c+1,16).setValue(Math.round(total*100)/100);
  }
  SpreadsheetApp.getUi().alert("✅ 面糊消耗計算完成(開店+進貨−剩餘)");
}
// ═══════════════════════════════════════════
// v1.1 整合補丁(2026-09-08):活動場所 + 麵糊包數 + 每包產值核對
// 貼在 Apps Script 最下方,儲存後執行 setupV3 一次,再重新部署
// ═══════════════════════════════════════════

// ── 1. 結構更新(執行一次) ──
function setupV3() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const hdr = rg => rg.setBackground("#3a1c10").setFontColor("#f0d0b8").setFontWeight("bold");
  const dv = l => SpreadsheetApp.newDataValidation().requireValueInList(l,true).build();

  // 櫃位設定:場所性質
  const loc = ss.getSheetByName("櫃位設定");
  hdr(loc.getRange(1,6).setValue("場所性質"));
  loc.getRange(2,6,200,1).setDataValidation(dv(["固定櫃位","活動"]));

  // 參數設定:活動出勤獎金
  const p = ss.getSheetByName("參數設定");
  const pv = p.getDataRange().getValues().map(r=>String(r[0]));
  if (!pv.includes("活動出勤獎金")) p.appendRow(["活動出勤獎金",500,"平日活動每櫃每日,與假日$500擇一"]);

  // 盤點表:單位改包 + 收店加每包產值欄
  const o = ss.getSheetByName("開店盤點");
  o.getRange(1,7,1,5).setValues([["原味起始(包)","可可起始(包)","紅玉起始(包)","抹茶起始(包)","總計(包)"]]);
  const c = ss.getSheetByName("收店盤點");
  c.getRange(1,7,1,10).setValues([["原味剩餘(包)","可可剩餘(包)","紅玉剩餘(包)","抹茶剩餘(包)","剩餘總計(包)",
    "原味消耗(包)","可可消耗(包)","紅玉消耗(包)","抹茶消耗(包)","總消耗(包)"]]);
  c.getRange(1,23,1,4).setValues([["原味進貨(包)","可可進貨(包)","紅玉進貨(包)","抹茶進貨(包)"]]);
  hdr(c.getRange(1,27).setValue("每包產值"));

  SpreadsheetApp.getUi().alert("✅ v1.1 結構更新完成\n請到「櫃位設定」填每列的「場所性質」,活動類場所業績類型選 B直結");
}

// ── 2. 覆蓋 getLocations:含場所性質 ──
function getLocations() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const d = ss.getSheetByName("櫃位設定").getDataRange().getValues();
  const m = {};
  for (let i=1;i<d.length;i++){
    if(!d[i][0]) continue;
    m[String(d[i][0])] = { county:String(d[i][1]||""), type:String(d[i][2]||"A百貨"),
      unitPrice:parseFloat(d[i][3])||70, kind:String(d[i][5]||"固定櫃位") };
  }
  return m;
}

// ── 3. 覆蓋 calcFlourUsage:消耗 = 開店+進貨−剩餘,每包產值 = 營業額÷消耗 ──
function calcFlourUsage() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const locs = getLocations();
  const openS = ss.getSheetByName("開店盤點").getDataRange().getValues();
  const sh = ss.getSheetByName("收店盤點");
  const cd = sh.getDataRange().getValues();
  const f = v => v ? Utilities.formatDate(new Date(v),"Asia/Taipei","yyyy-MM-dd") : "";
  for (let r=1;r<cd.length;r++){
    const cr=cd[r], d=f(cr[1]), loc=String(cr[5]);
    const op = openS.find(o=>f(o[1])===d && String(o[5])===loc); if(!op) continue;
    let total=0;
    [0,1,2,3].forEach(i=>{
      const used=Math.max(0,Math.round(((parseFloat(op[6+i])||0)+(parseFloat(cr[22+i])||0)-(parseFloat(cr[6+i])||0))*100)/100);
      sh.getRange(r+1,12+i).setValue(used); total+=used;
    });
    total=Math.round(total*100)/100;
    const lc=locs[loc]||{};
    const rev=(lc.type==="C份數") ? (parseFloat(cr[16])||0)*(lc.unitPrice||70) : (parseFloat(cr[16])||0);
    sh.getRange(r+1,16).setValue(total);
    sh.getRange(r+1,27).setValue(total>0?Math.round(rev/total):"");
  }
}

// ── 4. 麵糊核對表(月) ──
function runFlourAudit() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt("麵糊核對","請輸入年月(2026-09):",ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton()!==ui.Button.OK) return;
  const ym = r.getResponseText().trim();
  calcFlourUsage();
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const locs = getLocations();
  const cd = ss.getSheetByName("收店盤點").getDataRange().getValues();
  const f = v => v ? Utilities.formatDate(new Date(v),"Asia/Taipei","yyyy-MM-dd") : "";
  const rows=[]; const locSum={};
  for (let i=1;i<cd.length;i++){
    const d=f(cd[i][1]); if(!d.startsWith(ym)) continue;
    const loc=String(cd[i][5]), used=parseFloat(cd[i][15])||0; const lc=locs[loc]||{};
    const rev=(lc.type==="C份數") ? (parseFloat(cd[i][16])||0)*(lc.unitPrice||70) : (parseFloat(cd[i][16])||0);
    const pv = used>0 ? Math.round(rev/used) : 0;
    rows.push({d,loc,name:String(cd[i][4]),used,rev,pv});
    if(used>0){ locSum[loc]=locSum[loc]||{s:0,n:0}; locSum[loc].s+=pv; locSum[loc].n++; }
  }
  let sh = ss.getSheetByName("麵糊核對表");
  if(!sh) sh=ss.insertSheet("麵糊核對表");
  sh.clear();
  const h=["日期","櫃位","夥伴","消耗(包)","營業額","每包產值","櫃位月均產值","偏差%","判定"];
  sh.getRange(1,1,1,h.length).setValues([h]).setBackground("#3a1c10").setFontColor("#f0d0b8").setFontWeight("bold");
  sh.setFrozenRows(1);
  const out = rows.map(x=>{
    const avg = locSum[x.loc] ? Math.round(locSum[x.loc].s/locSum[x.loc].n) : 0;
    const dev = (avg>0&&x.pv>0) ? Math.round((x.pv-avg)/avg*100) : 0;
    let flag="正常";
    if(x.used===0&&x.rev>0) flag="⚠️無消耗有營業";
    else if(dev<=-20) flag="⚠️產值偏低(耗損?)";
    else if(dev>=20) flag="⚠️產值偏高(少報用量?)";
    return [x.d,x.loc,x.name,x.used,x.rev,x.pv,avg,dev+"%",flag];
  });
  if(out.length) sh.getRange(2,1,out.length,h.length).setValues(out);
  out.forEach((row,i)=>{ if(row[8]!=="正常") sh.getRange(i+2,1,1,h.length).setBackground("#fff0f0"); });
  ui.alert("✅ "+ym+" 麵糊核對表完成,共 "+out.length+" 筆,異常 "+out.filter(x=>x[8]!=="正常").length+" 筆");
}

// ── 5. 覆蓋選單 ──
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🥚 紅玉系統")
    .addItem("📅 設定每日自動更新","setDailyTrigger")
    .addSeparator()
    .addItem("⏱ 更新累計工時","updateAccumulatedHours")
    .addItem("✅ 達標判定(月)","runQualification")
    .addItem("💰 薪資計算v2(月)","runSalaryV2")
    .addItem("🤝 介紹獎金結算(月)","runReferralBonus")
    .addSeparator()
    .addItem("🥚 麵糊消耗計算","calcFlourUsage")
    .addItem("🔍 麵糊核對表(月)","runFlourAudit")
    .addSeparator()
    .addItem("🎊 年終結算(年)","runYearEndBonus")
    .addToUi();
}
// ═══════════════════════════════════════════
// v1.2 補丁(2026-09-10):管理儀表板 API
// 貼在最下方 → 儲存 → 執行 setupV4 一次 → 重新部署
// ═══════════════════════════════════════════

// ── 1. 夥伴資料加「負責櫃位」欄(AU,第47欄) ──
function setupV4() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const st = ss.getSheetByName("夥伴資料");
  st.getRange(1,47).setValue("負責櫃位").setBackground("#3a1c10").setFontColor("#f0d0b8").setFontWeight("bold");
  st.getRange(2,47).setNote("分隊長填負責櫃位名稱,多個用逗號分隔,需與櫃位設定名稱一致");
  SpreadsheetApp.getUi().alert("✅ 已新增「負責櫃位」欄,請幫分隊長填入(逗號分隔)");
}

// ── 2. 覆蓋 doGet:加入 getAdminDashboard ──
function doGet(e) {
  const params = e.parameter, action = params.action;
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let result;
  try {
    if (params.payload) {
      const data = JSON.parse(decodeURIComponent(params.payload)); const a = data.action;
      if (a==="punch") result=savePunch(ss,data);
      else if (a==="openStore") result=saveOpenStore(ss,data);
      else if (a==="closeStore") result=saveCloseStore(ss,data);
      else result={error:"未知的寫入動作"};
    } else {
      if (action==="login") result=loginUser(ss,params);
      else if (action==="getSchedule") result=getSchedule(ss,params);
      else if (action==="getSalary") result=getSalary(ss,params);
      else if (action==="getAnnouncements") result=getAnnouncements(ss);
      else if (action==="getStaffInfo") result=getStaffInfo(ss,params);
      else if (action==="getQuota") result=getQuotaApi(ss,params);
      else if (action==="getLocations") result=getLocationsApi(ss);
      else if (action==="getAdminDashboard") result=getAdminDashboard(ss,params);
      else result={error:"未知的動作: "+action};
    }
  } catch(err) { result={error:err.toString()}; }
  const json=JSON.stringify(result);
  if (params.callback) return ContentService.createTextOutput(params.callback+"("+json+")").setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

// ── 3. 管理儀表板 API ──
function getAdminDashboard(ss, params) {
  const empId = String(params.empId||"");
  const ym = String(params.ym||Utilities.formatDate(new Date(),"Asia/Taipei","yyyy-MM"));
  const staff = ss.getSheetByName("夥伴資料").getDataRange().getValues();
  const me = staff.find(r=>String(r[0])===empId);
  if (!me) return {error:"查無夥伴"};
  const role = parseInt(me[12])||1;
  if (role<2) return {error:"無權限"};
  const managed = String(me[46]||"").split(/[,，、]/).map(s=>s.trim()).filter(Boolean);
  const canSee = loc => role>=3 || managed.includes(loc);

  const P = getParams(), locs = getLocations();
  const fmt = v => v ? Utilities.formatDate(new Date(v),"Asia/Taipei","yyyy-MM-dd") : "";
  const today = Utilities.formatDate(new Date(),"Asia/Taipei","yyyy-MM-dd");
  const [y,m] = ym.split("-").map(Number);
  const isCur = today.startsWith(ym);
  const cutDay = isCur ? (new Date().getDate()-1) : 31;           // 截至昨日
  const prevYm = (m===1 ? (y-1)+"-12" : y+"-"+String(m-1).padStart(2,"0"));

  // ── 營業額(收店盤點) ──
  const cd = ss.getSheetByName("收店盤點").getDataRange().getValues();
  const revOf = r => { const lc=locs[String(r[5])]||{}; const v=parseFloat(r[16])||0;
    return lc.type==="C份數" ? v*(lc.unitPrice||70) : v; };
  const cur={}, prev={}, todayRev={};
  for (let i=1;i<cd.length;i++){
    const d=fmt(cd[i][1]); if(!d) continue;
    const loc=String(cd[i][5]); if(!canSee(loc)) continue;
    const day=parseInt(d.slice(8));
    if (d.startsWith(ym)) {
      if (d===today) todayRev[loc]=(todayRev[loc]||0)+revOf(cd[i]);
      else if (day<=cutDay) cur[loc]=(cur[loc]||0)+revOf(cd[i]);
    } else if (d.startsWith(prevYm) && day<=cutDay) prev[loc]=(prev[loc]||0)+revOf(cd[i]);
  }
  const locList = Object.keys(locs).filter(canSee).map(name=>{
    const c=Math.round(cur[name]||0), p=Math.round(prev[name]||0);
    return { name, rev:c, prevRev:p, pct: p>0 ? Math.round((c-p)/p*100) : null, kind:locs[name].kind };
  }).filter(x=>x.rev>0||x.prevRev>0).sort((a,b)=>b.rev-a.rev);
  const total = locList.reduce((s,x)=>s+x.rev,0);
  const totalPrev = locList.reduce((s,x)=>s+x.prevRev,0);

  // ── 夥伴出勤時數 ──
  const punch = ss.getSheetByName("打卡紀錄").getDataRange().getValues();
  const sess={};
  for (let i=1;i<punch.length;i++){
    const r=punch[i]; const t=r[6]?new Date(r[6]):null; if(!t||isNaN(t)) continue;
    const d=Utilities.formatDate(t,"Asia/Taipei","yyyy-MM-dd"); if(!d.startsWith(ym)) continue;
    const loc=String(r[9]||""); if(!canSee(loc)) continue;
    const k=String(r[2])+"_"+d; sess[k]=sess[k]||{emp:String(r[2])};
    if(String(r[5])==="上班") sess[k].in=t; if(String(r[5])==="下班") sess[k].out=t;
  }
  const hrs={};
  Object.values(sess).forEach(s=>{ if(s.in&&s.out) hrs[s.emp]=(hrs[s.emp]||0)+Math.max(0,(s.out-s.in)/ 3600000); });
  const staffList = Object.entries(hrs).map(([id,h])=>{
    const r=staff.find(x=>String(x[0])===id)||[];
    const student=String(r[39])==="是";
    return { id, name:String(r[1]||id), hours:Math.round(h*10)/10,
      target: student?(P["學生達標時數"]||72):(P["一般達標時數"]||180) };
  }).sort((a,b)=>b.hours-a.hours);

  return { success:true, data:{ ym, prevYm, asOf: isCur ? "截至昨日" : "全月", role,
    total, totalPrev, totalPct: totalPrev>0 ? Math.round((total-totalPrev)/totalPrev*100) : null,
    locations: locList, today: Object.entries(todayRev).map(([n,v])=>({name:n,rev:Math.round(v)})),
    staff: staffList } };
}
// ═══════════════════════════════════════════
// v1.2 補丁(2026-09-10):管理儀表板 API
// 貼在最下方 → 儲存 → 執行 setupV4 一次 → 重新部署
// ═══════════════════════════════════════════

// ── 1. 夥伴資料加「負責櫃位」欄(AU,第47欄) ──
function setupV4() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const st = ss.getSheetByName("夥伴資料");
  st.getRange(1,47).setValue("負責櫃位").setBackground("#3a1c10").setFontColor("#f0d0b8").setFontWeight("bold");
  st.getRange(2,47).setNote("分隊長填負責櫃位名稱,多個用逗號分隔,需與櫃位設定名稱一致");
  SpreadsheetApp.getUi().alert("✅ 已新增「負責櫃位」欄,請幫分隊長填入(逗號分隔)");
}

// ── 2. 覆蓋 doGet:加入 getAdminDashboard ──
function doGet(e) {
  const params = e.parameter, action = params.action;
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let result;
  try {
    if (params.payload) {
      const data = JSON.parse(decodeURIComponent(params.payload)); const a = data.action;
      if (a==="punch") result=savePunch(ss,data);
      else if (a==="openStore") result=saveOpenStore(ss,data);
      else if (a==="closeStore") result=saveCloseStore(ss,data);
      else result={error:"未知的寫入動作"};
    } else {
      if (action==="login") result=loginUser(ss,params);
      else if (action==="getSchedule") result=getSchedule(ss,params);
      else if (action==="getSalary") result=getSalary(ss,params);
      else if (action==="getAnnouncements") result=getAnnouncements(ss);
      else if (action==="getStaffInfo") result=getStaffInfo(ss,params);
      else if (action==="getQuota") result=getQuotaApi(ss,params);
      else if (action==="getLocations") result=getLocationsApi(ss);
      else if (action==="getAdminDashboard") result=getAdminDashboard(ss,params);
      else result={error:"未知的動作: "+action};
    }
  } catch(err) { result={error:err.toString()}; }
  const json=JSON.stringify(result);
  if (params.callback) return ContentService.createTextOutput(params.callback+"("+json+")").setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

// ── 3. 管理儀表板 API ──
function getAdminDashboard(ss, params) {
  const empId = String(params.empId||"");
  const ym = String(params.ym||Utilities.formatDate(new Date(),"Asia/Taipei","yyyy-MM"));
  const staff = ss.getSheetByName("夥伴資料").getDataRange().getValues();
  const me = staff.find(r=>String(r[0])===empId);
  if (!me) return {error:"查無夥伴"};
  const role = parseInt(me[12])||1;
  if (role<2) return {error:"無權限"};
  const managed = String(me[46]||"").split(/[,，、]/).map(s=>s.trim()).filter(Boolean);
  const canSee = loc => role>=3 || managed.includes(loc);

  const P = getParams(), locs = getLocations();
  const fmt = v => v ? Utilities.formatDate(new Date(v),"Asia/Taipei","yyyy-MM-dd") : "";
  const today = Utilities.formatDate(new Date(),"Asia/Taipei","yyyy-MM-dd");
  const [y,m] = ym.split("-").map(Number);
  const isCur = today.startsWith(ym);
  const cutDay = isCur ? (new Date().getDate()-1) : 31;           // 截至昨日
  const prevYm = (m===1 ? (y-1)+"-12" : y+"-"+String(m-1).padStart(2,"0"));

  // ── 營業額(收店盤點) ──
  const cd = ss.getSheetByName("收店盤點").getDataRange().getValues();
  const revOf = r => { const lc=locs[String(r[5])]||{}; const v=parseFloat(r[16])||0;
    return lc.type==="C份數" ? v*(lc.unitPrice||70) : v; };
  const cur={}, prev={}, todayRev={};
  for (let i=1;i<cd.length;i++){
    const d=fmt(cd[i][1]); if(!d) continue;
    const loc=String(cd[i][5]); if(!canSee(loc)) continue;
    const day=parseInt(d.slice(8));
    if (d.startsWith(ym)) {
      if (d===today) todayRev[loc]=(todayRev[loc]||0)+revOf(cd[i]);
      else if (day<=cutDay) cur[loc]=(cur[loc]||0)+revOf(cd[i]);
    } else if (d.startsWith(prevYm) && day<=cutDay) prev[loc]=(prev[loc]||0)+revOf(cd[i]);
  }
  const locList = Object.keys(locs).filter(canSee).map(name=>{
    const c=Math.round(cur[name]||0), p=Math.round(prev[name]||0);
    return { name, rev:c, prevRev:p, pct: p>0 ? Math.round((c-p)/p*100) : null, kind:locs[name].kind };
  }).filter(x=>x.rev>0||x.prevRev>0).sort((a,b)=>b.rev-a.rev);
  const total = locList.reduce((s,x)=>s+x.rev,0);
  const totalPrev = locList.reduce((s,x)=>s+x.prevRev,0);

  // ── 夥伴出勤時數 ──
  const punch = ss.getSheetByName("打卡紀錄").getDataRange().getValues();
  const sess={};
  for (let i=1;i<punch.length;i++){
    const r=punch[i]; const t=r[6]?new Date(r[6]):null; if(!t||isNaN(t)) continue;
    const d=Utilities.formatDate(t,"Asia/Taipei","yyyy-MM-dd"); if(!d.startsWith(ym)) continue;
    const loc=String(r[9]||""); if(!canSee(loc)) continue;
    const k=String(r[2])+"_"+d; sess[k]=sess[k]||{emp:String(r[2])};
    if(String(r[5])==="上班") sess[k].in=t; if(String(r[5])==="下班") sess[k].out=t;
  }
  const hrs={};
  Object.values(sess).forEach(s=>{ if(s.in&&s.out) hrs[s.emp]=(hrs[s.emp]||0)+Math.max(0,(s.out-s.in)/ 3600000); });
  const staffList = Object.entries(hrs).map(([id,h])=>{
    const r=staff.find(x=>String(x[0])===id)||[];
    const student=String(r[39])==="是";
    return { id, name:String(r[1]||id), hours:Math.round(h*10)/10,
      target: student?(P["學生達標時數"]||72):(P["一般達標時數"]||180) };
  }).sort((a,b)=>b.hours-a.hours);

  return { success:true, data:{ ym, prevYm, asOf: isCur ? "截至昨日" : "全月", role,
    total, totalPrev, totalPct: totalPrev>0 ? Math.round((total-totalPrev)/totalPrev*100) : null,
    locations: locList, today: Object.entries(todayRev).map(([n,v])=>({name:n,rev:Math.round(v)})),
    staff: staffList } };
}

// ═══════════════════════════════════════════
// v1.2.1 補丁(期初累計工時)
// ═══════════════════════════════════════════
function setupV4b() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const st = ss.getSheetByName("夥伴資料");
  st.getRange(1,48).setValue("期初累計工時(2023/01起~系統啟用前)")
    .setBackground("#3a1c10").setFontColor("#f0d0b8").setFontWeight("bold");
  st.getRange(2,48).setNote("請填入該夥伴自2023年1月起、到系統開始使用前的累計工時,系統會以此為基礎繼續累加");
  SpreadsheetApp.getUi().alert("✅ 已新增「期初累計工時」欄(AV欄),請逐一填入舊員工的累計數字");
}

// ── 覆蓋:累計總工時計算,起跳加上「期初累計工時」(AV欄,第48欄) ──
function updateAccumulatedHours() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const punchSheet = ss.getSheetByName("打卡紀錄");
  const hoursSheet = ss.getSheetByName("累計工時");
  const staffSheet = ss.getSheetByName("夥伴資料");

  const punches = punchSheet.getDataRange().getValues();
  const staff   = staffSheet.getDataRange().getValues();

  const monthlyHours = {};
  const punchPairs   = {};

  for (let i = 1; i < punches.length; i++) {
    const row = punches[i];
    const empId = String(row[2]);
    const type  = String(row[5]);
    const time  = row[6] ? new Date(row[6]) : null;
    const sid   = String(row[4]);
    if (!empId || !time || isNaN(time.getTime())) continue;
    const ym = time.getFullYear() + "-" + String(time.getMonth() + 1).padStart(2, "0");
    if (!punchPairs[empId]) punchPairs[empId] = {};
    if (!punchPairs[empId][sid]) punchPairs[empId][sid] = { ym };
    if (type === "上班") punchPairs[empId][sid].in  = time;
    if (type === "下班") punchPairs[empId][sid].out = time;
  }

  Object.entries(punchPairs).forEach(([empId, sessions]) => {
    Object.values(sessions).forEach(sess => {
      if (!sess.in || !sess.out) return;
      const hrs = Math.max(0, (sess.out - sess.in) / 3600000);
      if (!monthlyHours[empId]) monthlyHours[empId] = {};
      monthlyHours[empId][sess.ym] = (monthlyHours[empId][sess.ym] || 0) + hrs;
    });
  });

  const existing = hoursSheet.getDataRange().getValues();
  const existingMap = {};
  for (let i = 1; i < existing.length; i++) existingMap[`${existing[i][0]}_${existing[i][2]}`] = i + 1;

  Object.entries(monthlyHours).forEach(([empId, months]) => {
    const empRow = staff.find(r => String(r[0]) === empId);
    const name = empRow ? String(empRow[1]) : "";
    Object.entries(months).forEach(([ym, totalHrs]) => {
      const key = `${empId}_${ym}`;
      const hrs = Math.round(totalHrs * 10) / 10;
      if (existingMap[key]) {
        hoursSheet.getRange(existingMap[key], 4).setValue(hrs);
        hoursSheet.getRange(existingMap[key], 6).setValue(hrs);
      } else {
        hoursSheet.appendRow([empId, name, ym, hrs, 0, hrs, 0, "", "", ""]);
      }
    });
  });

  // 重新計算累計總工時(以「期初累計工時」為起跳基礎)
  const allHours = hoursSheet.getDataRange().getValues();
  const baseline = {};
  staff.forEach(r => { if (r[0]) baseline[String(r[0])] = parseFloat(r[47]) || 0; }); // AV欄=index 47
  const cumulative = {};
  for (let i = 1; i < allHours.length; i++) {
    const empId   = String(allHours[i][0]);
    const monthly = parseFloat(allHours[i][5]) || 0;
    if (cumulative[empId] === undefined) cumulative[empId] = baseline[empId] || 0;
    cumulative[empId] += monthly;
    hoursSheet.getRange(i + 1, 7).setValue(Math.round(cumulative[empId] * 10) / 10);
  }
}
// ═══════════════════════════════════════════
// v1.2 補丁(2026-09-10):管理儀表板 API
// 貼在最下方 → 儲存 → 執行 setupV4 一次 → 重新部署
// ═══════════════════════════════════════════

// ── 1. 夥伴資料加「負責櫃位」欄(AU,第47欄) ──
function setupV4() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const st = ss.getSheetByName("夥伴資料");
  st.getRange(1,47).setValue("負責櫃位").setBackground("#3a1c10").setFontColor("#f0d0b8").setFontWeight("bold");
  st.getRange(2,47).setNote("分隊長填負責櫃位名稱,多個用逗號分隔,需與櫃位設定名稱一致");
  SpreadsheetApp.getUi().alert("✅ 已新增「負責櫃位」欄,請幫分隊長填入(逗號分隔)");
}

// ── 2. 覆蓋 doGet:加入 getAdminDashboard ──
function doGet(e) {
  const params = e.parameter, action = params.action;
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let result;
  try {
    if (params.payload) {
      const data = JSON.parse(decodeURIComponent(params.payload)); const a = data.action;
      if (a==="punch") result=savePunch(ss,data);
      else if (a==="openStore") result=saveOpenStore(ss,data);
      else if (a==="closeStore") result=saveCloseStore(ss,data);
      else result={error:"未知的寫入動作"};
    } else {
      if (action==="login") result=loginUser(ss,params);
      else if (action==="getSchedule") result=getSchedule(ss,params);
      else if (action==="getSalary") result=getSalary(ss,params);
      else if (action==="getAnnouncements") result=getAnnouncements(ss);
      else if (action==="getStaffInfo") result=getStaffInfo(ss,params);
      else if (action==="getQuota") result=getQuotaApi(ss,params);
      else if (action==="getLocations") result=getLocationsApi(ss);
      else if (action==="getAdminDashboard") result=getAdminDashboard(ss,params);
      else result={error:"未知的動作: "+action};
    }
  } catch(err) { result={error:err.toString()}; }
  const json=JSON.stringify(result);
  if (params.callback) return ContentService.createTextOutput(params.callback+"("+json+")").setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

// ── 3. 管理儀表板 API ──
function getAdminDashboard(ss, params) {
  const empId = String(params.empId||"");
  const ym = String(params.ym||Utilities.formatDate(new Date(),"Asia/Taipei","yyyy-MM"));
  const staff = ss.getSheetByName("夥伴資料").getDataRange().getValues();
  const me = staff.find(r=>String(r[0])===empId);
  if (!me) return {error:"查無夥伴"};
  const role = parseInt(me[12])||1;
  if (role<2) return {error:"無權限"};
  const managed = String(me[46]||"").split(/[,，、]/).map(s=>s.trim()).filter(Boolean);
  const canSee = loc => role>=3 || managed.includes(loc);

  const P = getParams(), locs = getLocations();
  const fmt = v => v ? Utilities.formatDate(new Date(v),"Asia/Taipei","yyyy-MM-dd") : "";
  const today = Utilities.formatDate(new Date(),"Asia/Taipei","yyyy-MM-dd");
  const [y,m] = ym.split("-").map(Number);
  const isCur = today.startsWith(ym);
  const cutDay = isCur ? (new Date().getDate()-1) : 31;           // 截至昨日
  const prevYm = (m===1 ? (y-1)+"-12" : y+"-"+String(m-1).padStart(2,"0"));

  // ── 營業額(收店盤點) ──
  const cd = ss.getSheetByName("收店盤點").getDataRange().getValues();
  const revOf = r => { const lc=locs[String(r[5])]||{}; const v=parseFloat(r[16])||0;
    return lc.type==="C份數" ? v*(lc.unitPrice||70) : v; };
  const cur={}, prev={}, todayRev={};
  for (let i=1;i<cd.length;i++){
    const d=fmt(cd[i][1]); if(!d) continue;
    const loc=String(cd[i][5]); if(!canSee(loc)) continue;
    const day=parseInt(d.slice(8));
    if (d.startsWith(ym)) {
      if (d===today) todayRev[loc]=(todayRev[loc]||0)+revOf(cd[i]);
      else if (day<=cutDay) cur[loc]=(cur[loc]||0)+revOf(cd[i]);
    } else if (d.startsWith(prevYm) && day<=cutDay) prev[loc]=(prev[loc]||0)+revOf(cd[i]);
  }
  const locList = Object.keys(locs).filter(canSee).map(name=>{
    const c=Math.round(cur[name]||0), p=Math.round(prev[name]||0);
    return { name, rev:c, prevRev:p, pct: p>0 ? Math.round((c-p)/p*100) : null, kind:locs[name].kind };
  }).filter(x=>x.rev>0||x.prevRev>0).sort((a,b)=>b.rev-a.rev);
  const total = locList.reduce((s,x)=>s+x.rev,0);
  const totalPrev = locList.reduce((s,x)=>s+x.prevRev,0);

  // ── 夥伴出勤時數 ──
  const punch = ss.getSheetByName("打卡紀錄").getDataRange().getValues();
  const sess={};
  for (let i=1;i<punch.length;i++){
    const r=punch[i]; const t=r[6]?new Date(r[6]):null; if(!t||isNaN(t)) continue;
    const d=Utilities.formatDate(t,"Asia/Taipei","yyyy-MM-dd"); if(!d.startsWith(ym)) continue;
    const loc=String(r[9]||""); if(!canSee(loc)) continue;
    const k=String(r[2])+"_"+d; sess[k]=sess[k]||{emp:String(r[2])};
    if(String(r[5])==="上班") sess[k].in=t; if(String(r[5])==="下班") sess[k].out=t;
  }
  const hrs={};
  Object.values(sess).forEach(s=>{ if(s.in&&s.out) hrs[s.emp]=(hrs[s.emp]||0)+Math.max(0,(s.out-s.in)/ 3600000); });
  const staffList = Object.entries(hrs).map(([id,h])=>{
    const r=staff.find(x=>String(x[0])===id)||[];
    const student=String(r[39])==="是";
    return { id, name:String(r[1]||id), hours:Math.round(h*10)/10,
      target: student?(P["學生達標時數"]||72):(P["一般達標時數"]||180) };
  }).sort((a,b)=>b.hours-a.hours);

  return { success:true, data:{ ym, prevYm, asOf: isCur ? "截至昨日" : "全月", role,
    total, totalPrev, totalPct: totalPrev>0 ? Math.round((total-totalPrev)/totalPrev*100) : null,
    locations: locList, today: Object.entries(todayRev).map(([n,v])=>({name:n,rev:Math.round(v)})),
    staff: staffList } };
}

// ═══════════════════════════════════════════
// v1.2.1 補丁(期初累計工時)
// ═══════════════════════════════════════════
function setupV4b() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const st = ss.getSheetByName("夥伴資料");
  st.getRange(1,48).setValue("期初累計工時(2023/01起~系統啟用前)")
    .setBackground("#3a1c10").setFontColor("#f0d0b8").setFontWeight("bold");
  st.getRange(2,48).setNote("請填入該夥伴自2023年1月起、到系統開始使用前的累計工時,系統會以此為基礎繼續累加");
  SpreadsheetApp.getUi().alert("✅ 已新增「期初累計工時」欄(AV欄),請逐一填入舊員工的累計數字");
}

// ── 覆蓋:累計總工時計算,起跳加上「期初累計工時」(AV欄,第48欄) ──
function updateAccumulatedHours() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const punchSheet = ss.getSheetByName("打卡紀錄");
  const hoursSheet = ss.getSheetByName("累計工時");
  const staffSheet = ss.getSheetByName("夥伴資料");

  const punches = punchSheet.getDataRange().getValues();
  const staff   = staffSheet.getDataRange().getValues();

  const monthlyHours = {};
  const punchPairs   = {};

  for (let i = 1; i < punches.length; i++) {
    const row = punches[i];
    const empId = String(row[2]);
    const type  = String(row[5]);
    const time  = row[6] ? new Date(row[6]) : null;
    const sid   = String(row[4]);
    if (!empId || !time || isNaN(time.getTime())) continue;
    const ym = time.getFullYear() + "-" + String(time.getMonth() + 1).padStart(2, "0");
    if (!punchPairs[empId]) punchPairs[empId] = {};
    if (!punchPairs[empId][sid]) punchPairs[empId][sid] = { ym };
    if (type === "上班") punchPairs[empId][sid].in  = time;
    if (type === "下班") punchPairs[empId][sid].out = time;
  }

  Object.entries(punchPairs).forEach(([empId, sessions]) => {
    Object.values(sessions).forEach(sess => {
      if (!sess.in || !sess.out) return;
      const hrs = Math.max(0, (sess.out - sess.in) / 3600000);
      if (!monthlyHours[empId]) monthlyHours[empId] = {};
      monthlyHours[empId][sess.ym] = (monthlyHours[empId][sess.ym] || 0) + hrs;
    });
  });

  const existing = hoursSheet.getDataRange().getValues();
  const existingMap = {};
  for (let i = 1; i < existing.length; i++) existingMap[`${existing[i][0]}_${existing[i][2]}`] = i + 1;

  Object.entries(monthlyHours).forEach(([empId, months]) => {
    const empRow = staff.find(r => String(r[0]) === empId);
    const name = empRow ? String(empRow[1]) : "";
    Object.entries(months).forEach(([ym, totalHrs]) => {
      const key = `${empId}_${ym}`;
      const hrs = Math.round(totalHrs * 10) / 10;
      if (existingMap[key]) {
        hoursSheet.getRange(existingMap[key], 4).setValue(hrs);
        hoursSheet.getRange(existingMap[key], 6).setValue(hrs);
      } else {
        hoursSheet.appendRow([empId, name, ym, hrs, 0, hrs, 0, "", "", ""]);
      }
    });
  });

  // 重新計算累計總工時(以「期初累計工時」為起跳基礎)
  const allHours = hoursSheet.getDataRange().getValues();
  const baseline = {};
  staff.forEach(r => { if (r[0]) baseline[String(r[0])] = parseFloat(r[47]) || 0; }); // AV欄=index 47
  const cumulative = {};
  for (let i = 1; i < allHours.length; i++) {
    const empId   = String(allHours[i][0]);
    const monthly = parseFloat(allHours[i][5]) || 0;
    if (cumulative[empId] === undefined) cumulative[empId] = baseline[empId] || 0;
    cumulative[empId] += monthly;
    hoursSheet.getRange(i + 1, 7).setValue(Math.round(cumulative[empId] * 10) / 10);
  }
}

// ═══════════════════════════════════════════
// v1.2.2 補丁:期初值同步(即使當月無打卡也套用)
// ═══════════════════════════════════════════
function syncBaselineForAll() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const staffSheet = ss.getSheetByName("夥伴資料");
  const hoursSheet = ss.getSheetByName("累計工時");
  const staff = staffSheet.getDataRange().getValues();
  const hours = hoursSheet.getDataRange().getValues();
  const thisYm = Utilities.formatDate(new Date(),"Asia/Taipei","yyyy-MM");

  // 找每人在「累計工時」表最新一筆的累計總工時(G欄),若查無則用0
  const latestCum = {};
  for (let i=1; i<hours.length; i++) {
    const empId = String(hours[i][0]);
    latestCum[empId] = parseFloat(hours[i][6]) || 0; // 取最後一筆覆蓋,保持最新
  }

  let count = 0;
  for (let s=1; s<staff.length; s++) {
    const empId = String(staff[s][0]); if (!empId || staff[s][10]) continue;
    const name  = String(staff[s][1]);
    const baseline = parseFloat(staff[s][47]) || 0; // AV欄:期初累計工時

    // 若此人「累計工時」表完全沒有任何紀錄列,補一筆本月列,值=期初值
    const hasRow = hours.some(r => String(r[0]) === empId);
    let cumHours;
    if (!hasRow) {
      hoursSheet.appendRow([empId, name, thisYm, 0, 0, 0, baseline, "", "", "(期初值,無打卡紀錄)"]);
      cumHours = baseline;
    } else {
      // 已有紀錄列,但若累計值小於期初值(代表還沒套用過期初值),校正最新一列
      cumHours = Math.max(latestCum[empId] || 0, baseline);
      if ((latestCum[empId] || 0) < baseline) {
        let lastRow = -1;
        for (let i=1;i<hours.length;i++) if (String(hours[i][0])===empId) lastRow=i+1;
        if (lastRow>0) hoursSheet.getRange(lastRow,7).setValue(cumHours);
      }
    }

    // 同步技能/貢獻津貼到夥伴資料
    const skillLevel = cumHours >= 180 ? 20 : 0;
    let contribLevel = 0;
    if      (cumHours >= 4320) contribLevel = 20;
    else if (cumHours >= 3240) contribLevel = 15;
    else if (cumHours >= 2160) contribLevel = 10;
    else if (cumHours >= 1080) contribLevel = 5;
    staffSheet.getRange(s+1,33).setValue(skillLevel);
    staffSheet.getRange(s+1,34).setValue(contribLevel);
     count++;
  }
  SpreadsheetApp.getUi().alert("✅ 期初值同步完成,共處理 "+count+" 位夥伴");
}

// ═══════════════════════════════════════════
// v1.3 補丁 補丁(排班模組):新增/查詢/衝突檢查/發布
// 貼在最下方 → 儲存 → 重新部署
// ═══════════════════════════════════════════

// ── 覆蓋 doGet:加入 getManagedSchedule ──
function doGet(e) {
  const params = e.parameter, action = params.action;
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let result;
  try {
    if (params.payload) {
      const data = JSON.parse(decodeURIComponent(params.payload)); const a = data.action;
      if (a==="punch") result=savePunch(ss,data);
      else if (a==="openStore") result=saveOpenStore(ss,data);
      else if (a==="closeStore") result=saveCloseStore(ss,data);
      else if (a==="saveSchedule") result=saveScheduleApi(ss,data);
      else if (a==="deleteSchedule") result=deleteScheduleApi(ss,data);
      else result={error:"未知的寫入動作"};
    } else {
      if (action==="login") result=loginUser(ss,params);
      else if (action==="getSchedule") result=getSchedule(ss,params);
      else if (action==="getSalary") result=getSalary(ss,params);
      else if (action==="getAnnouncements") result=getAnnouncements(ss);
      else if (action==="getStaffInfo") result=getStaffInfo(ss,params);
      else if (action==="getQuota") result=getQuotaApi(ss,params);
      else if (action==="getLocations") result=getLocationsApi(ss);
      else if (action==="getAdminDashboard") result=getAdminDashboard(ss,params);
      else if (action==="getManagedSchedule") result=getManagedSchedule(ss,params);
      else if (action==="getStaffList") result=getStaffList(ss,params);
      else result={error:"未知的動作: "+action};
    }
  } catch(err) { result={error:err.toString()}; }
  const json=JSON.stringify(result);
  if (params.callback) return ContentService.createTextOutput(params.callback+"("+json+")").setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

// ── 覆蓋 doPost:加入 saveSchedule / deleteSchedule ──
function doPost(e) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let result;
  try {
    const data = JSON.parse(e.postData.contents); const a = data.action;
    const _ext = extHandler_(a, data);
    if (_ext) result=_ext;
    else if (a==="punch") result=savePunch(ss,data);
    else if (a==="openStore") result=saveOpenStore(ss,data);
    else if (a==="closeStore") result=saveCloseStore(ss,data);
    else if (a==="uploadPhoto") result=savePhotoToDrive(data);
    else if (a==="saveSchedule") result=saveScheduleApi(ss,data);
    else if (a==="deleteSchedule") result=deleteScheduleApi(ss,data);
    else result={error:"未知的動作"};
  } catch(err) { result={error:err.toString()}; }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}

// ── 排班者權限與範圍檢查 ──
function getManagerScope(ss, empId) {
  const staff = ss.getSheetByName("夥伴資料").getDataRange().getValues();
  const me = staff.find(r=>String(r[0])===String(empId));
  if (!me) return null;
  const role = parseInt(me[12])||1;
  if (role<2) return null;
  const managed = role>=3 ? Object.keys(getLocations())
    : String(me[46]||"").split(/[,，、]/).map(s=>s.trim()).filter(Boolean);
  return { role, managed };
}

// ── 取得負責範圍內的夥伴清單(排班用選單) ──
function getStaffList(ss, params) {
  const scope = getManagerScope(ss, params.empId);
  if (!scope) return { error:"無權限" };
  const staff = ss.getSheetByName("夥伴資料").getDataRange().getValues();
  const list = [];
  for (let i=1;i<staff.length;i++){
    if (!staff[i][0] || staff[i][10]) continue; // 跳過離職
    list.push({ id:String(staff[i][0]), name:String(staff[i][1]) });
  }
  return { success:true, data:list };
}

// ── 讀取指定範圍/月份的班表(供排班介面使用,含衝突用途) ──
function getManagedSchedule(ss, params) {
  const scope = getManagerScope(ss, params.empId);
  if (!scope) return { error:"無權限" };
  const ym = String(params.ym||"");
  const sched = ss.getSheetByName("班表").getDataRange().getValues();
  const out = [];
  for (let i=1;i<sched.length;i++){
    const r = sched[i];
    const d = r[1] ? Utilities.formatDate(new Date(r[1]),"Asia/Taipei","yyyy-MM-dd") : "";
    if (!d.startsWith(ym)) continue;
    if (!scope.managed.includes(String(r[5]))) continue;
    out.push({ row:i+1, id:String(r[0]), date:d, empId:String(r[3]), name:String(r[4]),
      location:String(r[5]), start:String(r[6]), end:String(r[7]),
      hours:r[8], type:String(r[9]), holiday:r[10], status:String(r[12]||"未發布") });
  }
  return { success:true, data: out, managed: scope.managed };
}

// ── 新增/編輯班表(含衝突檢查) ──
function saveScheduleApi(ss, data) {
  const scope = getManagerScope(ss, data.managerId);
  if (!scope) return { error:"無權限排班" };
  if (!scope.managed.includes(String(data.location))) return { error:"您不能排「"+data.location+"」的班,不在您的負責範圍" };

  const sheet = ss.getSheetByName("班表");
  const all = sheet.getDataRange().getValues();
  const date = String(data.date);
  const empId = String(data.empId);

  // 衝突檢查:同一人同一天已有其他地點的班(排除本次編輯的那一列)
  const editRow = data.row ? parseInt(data.row) : -1;
  const conflict = all.find((r,idx) => {
    if (idx===0 || idx+1===editRow) return false;
    const d = r[1] ? Utilities.formatDate(new Date(r[1]),"Asia/Taipei","yyyy-MM-dd") : "";
    return String(r[3])===empId && d===date && String(r[5])!==String(data.location);
  });
  if (conflict) {
    return { error:"⚠️ 衝突:"+data.name+" 於 "+date+" 已排在「"+conflict[5]+"」("+conflict[6]+"-"+conflict[7]+"),請先調整" };
  }

  const wd = ["日","一","二","三","四","五","六"][new Date(date).getDay()];
  const start = new Date(date+"T"+data.start+":00"), end = new Date(date+"T"+data.end+":00");
  let hrs = (end-start)/3600000; if (hrs<0) hrs+=24;

  if (editRow > 1) {
    // 編輯既有列
    sheet.getRange(editRow,1,1,13).setValues([[
      all[editRow-1][0], date, wd, empId, data.name, data.location,
      data.start, data.end, Math.round(hrs*10)/10, data.type||"single",
      data.holiday?"是":"否", data.holidayType||"", data.status||"已發布"
    ]]);
    return { success:true, id: all[editRow-1][0], updated:true };
  } else {
    const id = "S"+Date.now();
    sheet.appendRow([id, date, wd, empId, data.name, data.location,
      data.start, data.end, Math.round(hrs*10)/10, data.type||"single",
      data.holiday?"是":"否", data.holidayType||"", data.status||"已發布"]);
    return { success:true, id };
  }
}

// ── 刪除班表 ──
function deleteScheduleApi(ss, data) {
  const scope = getManagerScope(ss, data.managerId);
  if (!scope) return { error:"無權限" };
  const sheet = ss.getSheetByName("班表");
  const row = parseInt(data.row);
  if (!row || row<2) return { error:"無效的列號" };
  const loc = String(sheet.getRange(row,6).getValue());
  if (!scope.managed.includes(loc)) return { error:"不在您的負責範圍" };
  sheet.deleteRow(row);
  return { success:true };
}

// ── 一鍵套用行事曆日別(排班時自動判斷國定/颱風/連假) ──
function applyCalendarToSchedule(dateStr, location) {
  const cal = getCalendar();
  const locs = getLocations();
  const lc = (locs[location]||{}).county || "";
  return getDayType(dateStr, lc, "", cal); // 排班階段先不比對居住縣市,以櫃位地區為準
}

// ── 補「班表」表第13欄:發布狀態 ──
function setupV5() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName("班表");
  const h = sh.getRange(1,13).getValue();
  if (!h) {
    sh.getRange(1,13).setValue("發布狀態")
      .setBackground("#3a1c10").setFontColor("#f0d0b8").setFontWeight("bold");
  }
  SpreadsheetApp.getUi().alert("✅ 班表表已補「發布狀態」欄(第13欄)");
}

// ═══════════════════════════════════════════
// v1.3.1 修正:時間欄位格式化(避免顯示1899年錯誤日期)
// 貼在最下方,取代 getSchedule 與 getManagedSchedule 的時間讀取方式
// ═══════════════════════════════════════════

// 統一把 Sheets 儲存格(可能是 Date物件或字串)轉成純 HH:mm
function hhmm(v) {
  if (!v) return "";
  if (v instanceof Date) return Utilities.formatDate(v, "Asia/Taipei", "HH:mm");
  const s = String(v);
  const m = s.match(/(\d{1,2}):(\d{2})/);
  return m ? m[1].padStart(2,"0")+":"+m[2] : s;
}

// ── 覆蓋 getSchedule(夥伴查詢自己的班表用) ──
function getSchedule(ss, params) {
  const sheet = ss.getSheetByName("班表");
  const data = sheet.getDataRange().getValues();
  const empId = String(params.empId || "");
  const ym = String(params.ym || "");
  const result = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[3]) !== empId) continue;
    const d = row[1] ? Utilities.formatDate(new Date(row[1]),"Asia/Taipei","yyyy-MM-dd") : "";
    if (ym && !d.startsWith(ym)) continue;
    result.push({
      id: String(row[0]), date: d, weekday: String(row[2]),
      location: String(row[5]), start: hhmm(row[6]), end: hhmm(row[7]),
      hours: row[8], type: String(row[9]), holiday: row[10],
    });
  }
  return { success: true, data: result };
}

// ── 覆蓋 getManagedSchedule(排班管理頁用) ──
function getManagedSchedule(ss, params) {
  const scope = getManagerScope(ss, params.empId);
  if (!scope) return { error:"無權限" };
  const ym = String(params.ym||"");
  const sched = ss.getSheetByName("班表").getDataRange().getValues();
  const out = [];
  for (let i=1;i<sched.length;i++){
    const r = sched[i];
    const d = r[1] ? Utilities.formatDate(new Date(r[1]),"Asia/Taipei","yyyy-MM-dd") : "";
    if (!d.startsWith(ym)) continue;
    if (!scope.managed.includes(String(r[5]))) continue;
    out.push({ row:i+1, id:String(r[0]), date:d, empId:String(r[3]), name:String(r[4]),
      location:String(r[5]), start:hhmm(r[6]), end:hhmm(r[7]),
      hours:r[8], type:String(r[9]), holiday:r[10], status:String(r[12]||"未發布") });
  }
  return { success:true, data: out, managed: scope.managed };
}

// ═══════════════════════════════════════════
// v1.5 補丁:多品項營業額 + 單/雙/三人業績獎金修正
// 貼在最下方 → 儲存 → 執行 setupV7 一次 → 重新部署
// ═══════════════════════════════════════════

// ── 1. 結構更新 ──
function setupV7() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const hdr = rg => rg.setBackground("#3a1c10").setFontColor("#f0d0b8").setFontWeight("bold");

  const loc = ss.getSheetByName("櫃位設定");
  hdr(loc.getRange(1,9).setValue("品項清單"));
  const locData = loc.getDataRange().getValues();
  for (let i=1;i<locData.length;i++){
    if (locData[i][0] && !locData[i][8]) loc.getRange(i+1,9).setValue("雞蛋糕");
  }

  const close = ss.getSheetByName("收店盤點");
  hdr(close.getRange(1,30).setValue("品項營業額明細(JSON)"));
  hdr(close.getRange(1,31).setValue("營業額合計"));

  SpreadsheetApp.getUi().alert("✅ v1.5 結構更新完成\n請至「櫃位設定」為多品項櫃位(如南港Lalaport)填入品項清單,以逗號分隔,例如:雞蛋糕,豆花");
}

// ── 2. 覆蓋 getLocations:含品項清單 ──
function getLocations() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const d = ss.getSheetByName("櫃位設定").getDataRange().getValues();
  const m = {};
  for (let i=1;i<d.length;i++){
    if(!d[i][0]) continue;
    const items = String(d[i][8]||"雞蛋糕").split(/[,，、]/).map(s=>s.trim()).filter(Boolean);
    m[String(d[i][0])] = { county:String(d[i][1]||""), type:String(d[i][2]||"A百貨"),
      unitPrice:parseFloat(d[i][3])||70, kind:String(d[i][5]||"固定櫃位"),
      lat: d[i][6]!=="" ? parseFloat(d[i][6]) : null,
      lng: d[i][7]!=="" ? parseFloat(d[i][7]) : null,
      items: items.length ? items : ["雞蛋糕"] };
  }
  return m;
}

// ── 3. 覆蓋 getLocationsApi ──
function getLocationsApi(ss) {
  return { success: true, data: getLocations() };
}

// ── 4. 覆蓋 saveCloseStore:支援多品項營業額 ──
function saveCloseStore(ss, data) {
  const sheet = ss.getSheetByName("收店盤點");
  const id = "C"+Date.now();
  const n = v => parseFloat(v)||0;
  const rem=[n(data.remOriginal),n(data.remCocoa),n(data.remRuby),n(data.remMatcha)];
  const remT=Math.round(rem.reduce((a,b)=>a+b,0)*100)/100;

  let itemRev = {};
  try { itemRev = data.itemRevenue ? JSON.parse(data.itemRevenue) : {}; } catch(e) {}
  const eggRevenue = n(itemRev["雞蛋糕"] !== undefined ? itemRev["雞蛋糕"] : data.revenue);
  const totalRevenue = Object.values(itemRev).length
    ? Object.values(itemRev).reduce((a,b)=>a+(parseFloat(b)||0),0)
    : n(data.revenue);

  sheet.appendRow([
    id, String(data.date||""), String(data.scheduleId||""), String(data.empId||""),
    String(data.name||""), String(data.location||""),
    rem[0],rem[1],rem[2],rem[3],remT,
    "","","","",
    eggRevenue, n(data.cash),
    String(data.photoUrl||""), String(data.handoverNote||""),
    new Date().toISOString(), "",
    n(data.rsOriginal), n(data.rsCocoa), n(data.rsRuby), n(data.rsMatcha),
    "","","","","","",
    JSON.stringify(itemRev), totalRevenue,
  ]);
  return { success:true, id };
}

// ── 5. 覆蓋 calcFlourUsage:核對只用雞蛋糕營業額 ──
function calcFlourUsage() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const locs = getLocations();
  const openS = ss.getSheetByName("開店盤點").getDataRange().getValues();
  const sh = ss.getSheetByName("收店盤點");
  const cd = sh.getDataRange().getValues();
  const f = v => v ? Utilities.formatDate(new Date(v),"Asia/Taipei","yyyy-MM-dd") : "";
  for (let r=1;r<cd.length;r++){
    const cr=cd[r], d=f(cr[1]), loc=String(cr[5]);
    const op = openS.find(o=>f(o[1])===d && String(o[5])===loc); if(!op) continue;
    let total=0;
    [0,1,2,3].forEach(i=>{
      const used=Math.max(0,Math.round(((parseFloat(op[6+i])||0)+(parseFloat(cr[22+i])||0)-(parseFloat(cr[6+i])||0))*100)/100);
      sh.getRange(r+1,12+i).setValue(used); total+=used;
    });
    total=Math.round(total*100)/100;
    const lc=locs[loc]||{};
    const eggRev=(lc.type==="C份數") ? (parseFloat(cr[16])||0)*(lc.unitPrice||70) : (parseFloat(cr[16])||0);
    sh.getRange(r+1,27).setValue(total>0?Math.round(eggRev/total):"");
  }
}

// ── 6. 業績獎金門檻表(單/雙/三人) ──
function perfBonusTable(headcount, P) {
  const base = [P["業績門檻1"]||10000, P["業績門檻2"]||12500, P["業績門檻3"]||15000];
  return base.map(v => v * Math.max(1, headcount));
}

// ── 7. 覆蓋 calcSalaryV2:讀合計營業額 + 支援三人班 ──
function calcSalaryV2(ym) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const P = getParams(), cal = getCalendar(), locs = getLocations();
  const baseWage = P["基準時薪"]||196;
  const staff = ss.getSheetByName("夥伴資料").getDataRange().getValues();
  const punch = ss.getSheetByName("打卡紀錄").getDataRange().getValues();
  const closeS = ss.getSheetByName("收店盤點").getDataRange().getValues();
  const cum = ss.getSheetByName("累計工時").getDataRange().getValues();
  const salSheet = ss.getSheetByName("薪資明細");
  const targetMonth = parseInt(ym.slice(5));

  const sessions = {};
  const locDayHours = {};
  for (let i=1; i<punch.length; i++) {
    const r = punch[i], empId = String(r[2]); if (!empId) continue;
    const t = r[6]?new Date(r[6]):null; if(!t||isNaN(t)) continue;
    const d = Utilities.formatDate(t,"Asia/Taipei","yyyy-MM-dd");
    if (!d.startsWith(ym)) continue;
    const key = empId+"_"+d;
    sessions[key] = sessions[key] || {empId, date:d, loc:String(r[9]||"")};
    if (String(r[5])==="上班") sessions[key].in = t;
    if (String(r[5])==="下班") sessions[key].out = t;
  }
  Object.values(sessions).forEach(s => {
    if (!s.in || !s.out) return;
    s.hrs = Math.max(0,(s.out-s.in)/ 3600000);
    const k = s.date+"_"+s.loc;
    locDayHours[k] = (locDayHours[k]||0) + s.hrs;
  });

  const dayRevenue = {};
  for (let i=1; i<closeS.length; i++) {
    const d = closeS[i][1] ? Utilities.formatDate(new Date(closeS[i][1]),"Asia/Taipei","yyyy-MM-dd") : "";
    if (!d.startsWith(ym)) continue;
    const total = closeS[i][30] !== "" && closeS[i][30] !== undefined ? parseFloat(closeS[i][30]) : parseFloat(closeS[i][16])||0;
    dayRevenue[d+"_"+String(closeS[i][5])] = total || 0;
  }
  const locDayCount = {};
  Object.values(sessions).forEach(s => {
    if (!s.hrs) return;
    const k = s.date+"_"+s.loc;
    locDayCount[k] = (locDayCount[k]||0)+1;
  });

  let count = 0;
  for (let si=1; si<staff.length; si++) {
    const emp = staff[si], empId = String(emp[0]);
    if (!empId || emp[10]) continue;
    const name = String(emp[1]);
    const hourly = Math.max(parseFloat(emp[13])||baseWage, baseWage);
    const home = String(emp[38]||"");
    const birthday = emp[4] ? new Date(emp[4]) : null;
    const laborSt = String(emp[41]||"公司投保");
    const healthSt = String(emp[42]||"公司投保");
    const deps = parseInt(emp[27])||0;

    let cumHrs = 0;
    for (let i=cum.length-1; i>=1; i--) {
      if (String(cum[i][0])===empId) { cumHrs = parseFloat(cum[i][6])||0; break; }
    }

    let basic=0, ot1=0, ot2=0, ot3=0, dblPay=0, holBonus=0;
    let normalH=0, holH=0; const locSet=new Set(); let perfBonus=0;

    Object.values(sessions).filter(s=>s.empId===empId && s.hrs).forEach(s=>{
      const lc = (locs[s.loc]||{}); locSet.add(s.loc);
      const dt = getDayType(s.date, lc.county||"", home, cal);
      const h = s.hrs;
      const b = Math.min(h,8)*hourly, o1=Math.max(0,Math.min(h-8,2))*hourly*1.33,
            o2=Math.max(0,Math.min(h-10,2))*hourly*1.67, o3=Math.max(0,h-12)*hourly*2;
      const dayPay = b+o1+o2+o3;
      if (dt==="國定假日"||dt==="颱風日") { dblPay += dayPay; holH+=h; }
      else { basic+=b; ot1+=o1; ot2+=o2; ot3+=o3; normalH+=h; }
      if (dt==="假日"||dt==="連假日"||(lc.kind==="活動"&&dt==="平日")) {
        const tot = locDayHours[s.date+"_"+s.loc]||h;
        holBonus += CEIL((P["假日出勤獎金"]||500)/tot*h);
      }
      const rev = dayRevenue[s.date+"_"+s.loc];
      if (rev!==undefined) {
        let calc = rev;
        if (lc.type==="A百貨") calc = rev*0.8;
        else if (lc.type==="C份數") calc = rev*(lc.unitPrice||P["C類預設抽成"]||70);
        const headcount = locDayCount[s.date+"_"+s.loc]||1;
        const th = perfBonusTable(headcount, P);
        if (calc>th[2]) perfBonus+=1000; else if (calc>th[1]) perfBonus+=700; else if (calc>th[0]) perfBonus+=500;
      }
    });

    const totalH = normalH+holH;
    if (totalH===0) continue;
    basic=CEIL(basic); ot1=CEIL(ot1); ot2=CEIL(ot2); ot3=CEIL(ot3);
    dblPay=CEIL(dblPay*2);
    const basicTotal = basic+ot1+ot2+ot3+dblPay;

    const skill = cumHrs>180 ? CEIL(totalH*20) : 0;
    let cl=0; if(cumHrs>=4320)cl=20; else if(cumHrs>=3240)cl=15; else if(cumHrs>=2160)cl=10; else if(cumHrs>=1080)cl=5;
    const contrib = CEIL(totalH*cl);
    let age=0;
    if (birthday&&!isNaN(birthday)) {
      const ref=new Date(ym+"-01");
      age=ref.getFullYear()-birthday.getFullYear();
      if (ref.getMonth()<birthday.getMonth()) age--;
    }
    const evergreen = age>=50 ? CEIL(totalH*(10+(age-50))) : 0;
    let bday=0;
    if (birthday && birthday.getMonth()+1===targetMonth) {
      bday = totalH>=80 ? (cumHrs>=4320?2400:cumHrs>=2160?1200:cumHrs>=1080?600:600) : (totalH>0?200:0);
    }
    let fest=0;
    if ([1,5,9].includes(targetMonth)) fest = totalH>=80 ? (cumHrs>=4320?2400:cumHrs>=2160?1200:cumHrs>=1080?600:600) : (totalH>0?200:0);

    let laborDed=0, healthDed=0, insAdd=0;
    if (laborSt==="公司投保") laborDed=parseFloat(emp[21])||0;
    else insAdd += CEIL(parseFloat(getInsuranceRow(ss,empId,"勞保級距表")[3])||0);
    if (healthSt==="公司投保") healthDed=(parseFloat(emp[26])||0)*(1+Math.min(deps,3));
    else if (healthSt==="無投保") insAdd += CEIL(parseFloat(getInsuranceRow(ss,empId,"健保級距表")[3])||0);

    const fee = parseFloat(emp[17])||0;
    const gross = basicTotal+perfBonus+skill+contrib+evergreen+bday+fest+holBonus+insAdd;
    const net = gross-laborDed-healthDed-fee;

    const ex = salSheet.getDataRange().getValues();
    let ri=-1;
    for (let i=1;i<ex.length;i++) if(String(ex[i][2])===empId&&ymNorm(ex[i][1])===ym){ri=i+1;break;}
    const row=[ym+"-"+empId,ym,empId,name,Array.from(locSet).join("、"),
      Math.round(normalH*10)/10,Math.round(holH*10)/10,Math.round(totalH*10)/10,
      basic,ot1,ot2,ot3,dblPay,basicTotal,0,perfBonus,skill,contrib,evergreen,
      bday,fest,0,gross,laborDed,healthDed,insAdd,fee,net,"匯款","待確認","",
      holBonus,insAdd];
    if (ri>0) salSheet.getRange(ri,1,1,33).setValues([row]);
    else salSheet.appendRow(row);
    count++;
  }
  return count;
}

// ═══════════════════════════════════════════
// v1.7 補丁:薪資計算修正 + 異常下班保護 + 排班薪資預估 + 月結防呆
// 貼在最下方 → 儲存 → 執行 setupV8 一次 → 重新部署
// ═══════════════════════════════════════════

// ── 1. 結構更新 ──
function setupV8() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const hdr = rg => rg.setBackground("#3a1c10").setFontColor("#f0d0b8").setFontWeight("bold");
  const dv = l => SpreadsheetApp.newDataValidation().requireValueInList(l,true).build();

  // 打卡紀錄:異常標記欄
  const punch = ss.getSheetByName("打卡紀錄");
  hdr(punch.getRange(1,17).setValue("異常標記"));

  // 夥伴資料:本月排班預估薪資對應級距(校對用欄位)
  const staff = ss.getSheetByName("夥伴資料");
  hdr(staff.getRange(1,49).setValue("勞健保級距校對月份"));
  hdr(staff.getRange(1,50).setValue("勞健保級距校對薪資"));

  // 參數設定:異常下班門檻
  const p = ss.getSheetByName("參數設定");
  const pv = p.getDataRange().getValues().map(r=>String(r[0]));
  if (!pv.includes("異常未下班門檻小時")) p.appendRow(["異常未下班門檻小時",16,"上班超過此時數未打下班卡,自動標記異常"]);

  SpreadsheetApp.getUi().alert("✅ v1.7 結構更新完成");
}

// ── 2. 異常下班偵測(每日觸發時執行) ──
function detectAbnormalShifts() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const P = getParams();
  const limit = (P["異常未下班門檻小時"]||16) * 3600000;
  const punch = ss.getSheetByName("打卡紀錄");
  const data = punch.getDataRange().getValues();
  const now = new Date();

  // 找出「上班無對應下班」且已超過門檻的紀錄
  const openMap = {}; // empId+loc+date → {row, inTime}
  for (let i=1;i<data.length;i++){
    const r = data[i];
    const key = String(r[2])+"_"+String(r[9])+"_"+String(r[1]);
    if (String(r[5])==="上班") {
      openMap[key] = { row:i+1, inTime: r[6]?new Date(r[6]):null };
    } else if (String(r[5])==="下班") {
      delete openMap[key];
    }
  }
  let flagged = 0;
  Object.values(openMap).forEach(seg => {
    if (!seg.inTime) return;
    if (now - seg.inTime > limit) {
      const cur = String(punch.getRange(seg.row,17).getValue());
      if (!cur.includes("異常未下班")) {
        punch.getRange(seg.row,17).setValue((cur?cur+";":"")+"異常未下班");
        flagged++;
      }
    }
  });
  return flagged;
}

// ── 3. 管理員手動補登下班時間 ──
function manualCloseSegment(ss, data) {
  const scope = getManagerScope(ss, data.managerId);
  if (!scope) return { error:"無權限" };
  const punch = ss.getSheetByName("打卡紀錄");
  const all = punch.getDataRange().getValues();
  const empId = String(data.empId), loc = String(data.location), date = String(data.date);

  // 找到對應的上班列,確認有異常標記
  let inRow = -1;
  for (let i=1;i<all.length;i++){
    if (String(all[i][2])===empId && String(all[i][9])===loc && String(all[i][1])===date && String(all[i][5])==="上班") {
      inRow = i+1; break;
    }
  }
  if (inRow<0) return { error:"找不到對應的上班紀錄" };

  const id = "P"+Date.now();
  punch.appendRow([id, date, empId, String(data.name||""), "", "下班", data.closeTime,
    "", "", loc, "否", new Date().toISOString(), "", "管理員補登:"+String(data.reason||""), "", "", "管理員補登"]);
  punch.getRange(inRow,17).setValue(String(all[inRow-1][16]||"")+";已由管理員補登下班");
  return { success:true };
}

// ── 4. 查詢異常未下班清單(管理端) ──
function getAbnormalShifts(ss, params) {
  const scope = getManagerScope(ss, params.empId);
  if (!scope) return { error:"無權限" };
  const punch = ss.getSheetByName("打卡紀錄").getDataRange().getValues();
  const out = [];
  for (let i=1;i<punch.length;i++){
    const r = punch[i];
    if (!String(r[16]||"").includes("異常未下班")) continue;
    if (String(r[16]||"").includes("已由管理員補登")) continue;
    if (!scope.managed.includes(String(r[9]))) continue;
    out.push({ row:i+1, empId:String(r[2]), name:String(r[3]), date:String(r[1]),
      location:String(r[9]), inTime:r[6] });
  }
  return { success:true, data: out };
}

// ── 5. 覆蓋:業績獎金計算改為「每人每天每櫃位判斷一次」(修正重複發放bug) ──
function calcSalaryV2(ym) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const P = getParams(), cal = getCalendar(), locs = getLocations();
  const baseWage = P["基準時薪"]||196;
  const staff = ss.getSheetByName("夥伴資料").getDataRange().getValues();
  const punch = ss.getSheetByName("打卡紀錄").getDataRange().getValues();
  const closeS = ss.getSheetByName("收店盤點").getDataRange().getValues();
  const cum = ss.getSheetByName("累計工時").getDataRange().getValues();
  const salSheet = ss.getSheetByName("薪資明細");
  const targetMonth = parseInt(ym.slice(5));

  const sessions = {};
  const locDayHours = {};
  for (let i=1; i<punch.length; i++) {
    const r = punch[i], empId = String(r[2]); if (!empId) continue;
    if (String(r[16]||"").includes("異常未下班") && !String(r[16]||"").includes("已由管理員補登")) continue; // 排除未結算的異常段
    const t = r[6]?new Date(r[6]):null; if(!t||isNaN(t)) continue;
    const d = Utilities.formatDate(t,"Asia/Taipei","yyyy-MM-dd");
    if (!d.startsWith(ym)) continue;
    // 用「人+日期+地點」當key,同一人同天同地點若有多段合併計算(多段班場景:視為同一天同櫃只留一組時數加總)
    const key = empId+"_"+d+"_"+String(r[9]||"");
    if (!sessions[key]) sessions[key] = { empId, date:d, loc:String(r[9]||""), hrs:0, segs:[] };
    sessions[key].segs.push({ type:String(r[5]), time:t });
  }
  // 逐key計算配對時數(支援同一人同天同地點多段上下班)
  Object.values(sessions).forEach(s => {
    s.segs.sort((a,b)=>a.time-b.time);
    let inT = null;
    s.segs.forEach(seg => {
      if (seg.type==="上班") inT = seg.time;
      else if (seg.type==="下班" && inT) { s.hrs += Math.max(0,(seg.time-inT)/ 3600000); inT=null; }
    });
    const k = s.date+"_"+s.loc;
    locDayHours[k] = (locDayHours[k]||0) + s.hrs;
  });

  const dayRevenue = {};
  for (let i=1; i<closeS.length; i++) {
    const d = closeS[i][1] ? Utilities.formatDate(new Date(closeS[i][1]),"Asia/Taipei","yyyy-MM-dd") : "";
    if (!d.startsWith(ym)) continue;
    const total = closeS[i][30] !== "" && closeS[i][30] !== undefined ? parseFloat(closeS[i][30]) : parseFloat(closeS[i][16])||0;
    dayRevenue[d+"_"+String(closeS[i][5])] = total || 0;
  }
  const locDayCount = {};
  Object.values(sessions).forEach(s => {
    if (!s.hrs) return;
    const k = s.date+"_"+s.loc;
    locDayCount[k] = (locDayCount[k]||0)+1;
  });

  // 每人每天每櫃位的業績獎金只算一次(用 set 記錄已發放的 key)
  const perfAwarded = new Set();

  let count = 0;
  for (let si=1; si<staff.length; si++) {
    const emp = staff[si], empId = String(emp[0]);
    if (!empId || emp[10]) continue;
    const name = String(emp[1]);
    const hourly = Math.max(parseFloat(emp[13])||baseWage, baseWage);
    const home = String(emp[38]||"");
    const birthday = emp[4] ? new Date(emp[4]) : null;
    const laborSt = String(emp[41]||"公司投保");
    const healthSt = String(emp[42]||"公司投保");
    const deps = parseInt(emp[27])||0;

    let cumHrs = 0;
    for (let i=cum.length-1; i>=1; i--) {
      if (String(cum[i][0])===empId) { cumHrs = parseFloat(cum[i][6])||0; break; }
    }

    let basic=0, ot1=0, ot2=0, ot3=0, dblPay=0, holBonus=0;
    let normalH=0, holH=0; const locSet=new Set(); let perfBonus=0;

    Object.values(sessions).filter(s=>s.empId===empId && s.hrs).forEach(s=>{
      const lc = (locs[s.loc]||{}); locSet.add(s.loc);
      const dt = getDayType(s.date, lc.county||"", home, cal);
      const h = s.hrs;
      const b = Math.min(h,8)*hourly, o1=Math.max(0,Math.min(h-8,2))*hourly*1.33,
            o2=Math.max(0,Math.min(h-10,2))*hourly*1.67, o3=Math.max(0,h-12)*hourly*2;
      const dayPay = b+o1+o2+o3;
      if (dt==="國定假日"||dt==="颱風日") { dblPay += dayPay; holH+=h; }
      else { basic+=b; ot1+=o1; ot2+=o2; ot3+=o3; normalH+=h; }
      if (dt==="假日"||dt==="連假日"||(lc.kind==="活動"&&dt==="平日")) {
        const tot = locDayHours[s.date+"_"+s.loc]||h;
        holBonus += CEIL((P["假日出勤獎金"]||500)/tot*h);
      }

      // 業績獎金:每人每天每櫃位只判斷一次(用key去重)
      const awardKey = empId+"_"+s.date+"_"+s.loc;
      if (!perfAwarded.has(awardKey)) {
        const rev = dayRevenue[s.date+"_"+s.loc];
        if (rev!==undefined) {
          let calc = rev;
          if (lc.type==="A百貨") calc = rev*0.8;
          else if (lc.type==="C份數") calc = rev*(lc.unitPrice||P["C類預設抽成"]||70);
          const headcount = locDayCount[s.date+"_"+s.loc]||1;
          const th = perfBonusTable(headcount, P);
          // 每人各自全額領取(三人達標,三人各領同額)
          if (calc>th[2]) perfBonus+=1000; else if (calc>th[1]) perfBonus+=700; else if (calc>th[0]) perfBonus+=500;
          perfAwarded.add(awardKey);
        }
      }
    });

    const totalH = normalH+holH;
    if (totalH===0) continue;
    basic=CEIL(basic); ot1=CEIL(ot1); ot2=CEIL(ot2); ot3=CEIL(ot3);
    dblPay=CEIL(dblPay*2);
    const basicTotal = basic+ot1+ot2+ot3+dblPay;

    const skill = cumHrs>180 ? CEIL(totalH*20) : 0;
    let cl=0; if(cumHrs>=4320)cl=20; else if(cumHrs>=3240)cl=15; else if(cumHrs>=2160)cl=10; else if(cumHrs>=1080)cl=5;
    const contrib = CEIL(totalH*cl);
    let age=0;
    if (birthday&&!isNaN(birthday)) {
      const ref=new Date(ym+"-01");
      age=ref.getFullYear()-birthday.getFullYear();
      if (ref.getMonth()<birthday.getMonth()) age--;
    }
    const evergreen = age>=50 ? CEIL(totalH*(10+(age-50))) : 0;

    // 生日/三節津貼修正:排班<80hr 或 累計<1080hr → 一律200;否則依累計級距
    const tierBonus = () => {
      if (totalH < 80 || cumHrs < 1080) return totalH>0 ? 200 : 0;
      return cumHrs>=4320 ? 2400 : cumHrs>=2160 ? 1200 : 600;
    };
    let bday=0;
    if (birthday && birthday.getMonth()+1===targetMonth) bday = tierBonus();
    let fest=0;
    if ([1,5,9].includes(targetMonth)) fest = tierBonus();

    let laborDed=0, healthDed=0, insAdd=0;
    if (laborSt==="公司投保") laborDed=parseFloat(emp[21])||0;
    else insAdd += CEIL(parseFloat(getInsuranceRow(ss,empId,"勞保級距表")[3])||0);
    if (healthSt==="公司投保") healthDed=(parseFloat(emp[26])||0)*(1+Math.min(deps,3));
    else if (healthSt==="無投保") insAdd += CEIL(parseFloat(getInsuranceRow(ss,empId,"健保級距表")[3])||0);

    const fee = parseFloat(emp[17])||0;
    const gross = basicTotal+perfBonus+skill+contrib+evergreen+bday+fest+holBonus+insAdd;
    const net = gross-laborDed-healthDed-fee;

    const ex = salSheet.getDataRange().getValues();
    let ri=-1;
    for (let i=1;i<ex.length;i++) if(String(ex[i][2])===empId&&ymNorm(ex[i][1])===ym){ri=i+1;break;}
    const row=[ym+"-"+empId,ym,empId,name,Array.from(locSet).join("、"),
      Math.round(normalH*10)/10,Math.round(holH*10)/10,Math.round(totalH*10)/10,
      basic,ot1,ot2,ot3,dblPay,basicTotal,0,perfBonus,skill,contrib,evergreen,
      bday,fest,0,gross,laborDed,healthDed,insAdd,fee,net,"匯款","待確認","",
      holBonus,insAdd];
    if (ri>0) salSheet.getRange(ri,1,1,33).setValues([row]);
    else salSheet.appendRow(row);
    count++;
  }
  return count;
}

// ── 6. 排班薪資預估引擎 ──
function estimateSalaryFromSchedule(ss, params) {
  const ym = String(params.ym||Utilities.formatDate(new Date(),"Asia/Taipei","yyyy-MM"));
  const cal = getCalendar(), locs = getLocations();
  const staff = ss.getSheetByName("夥伴資料").getDataRange().getValues();
  const sched = ss.getSheetByName("班表").getDataRange().getValues();

  const byEmp = {};
  for (let i=1;i<sched.length;i++){
    const r = sched[i];
    const d = r[1] ? Utilities.formatDate(new Date(r[1]),"Asia/Taipei","yyyy-MM-dd") : "";
    if (!d.startsWith(ym)) continue;
    const empId = String(r[3]);
    const hrs = parseFloat(r[8])||0;
    const loc = String(r[5]);
    const lc = locs[loc]||{};
    const dt = getDayType(d, lc.county||"", "", cal);
    if (!byEmp[empId]) byEmp[empId] = { normalH:0, holH:0, holidayCount:0 };
    if (dt==="國定假日"||dt==="颱風日") byEmp[empId].holH += hrs;
    else byEmp[empId].normalH += hrs;
  }

  const out = [];
  for (let s=1;s<staff.length;s++){
    const emp = staff[s]; const empId = String(emp[0]);
    if (!empId || emp[10]) continue;
    const hourly = parseFloat(emp[13])||196;
    const b = byEmp[empId]; if (!b) continue;
    const basicPay = Math.min(b.normalH,b.normalH) * hourly; // 簡化:全按基本倍率估(不含加班細分,預估用)
    const holPay = b.holH * hourly * 2;

    let cumHrs=0;
    const cum = ss.getSheetByName("累計工時").getDataRange().getValues();
    for (let i=cum.length-1;i>=1;i--) if(String(cum[i][0])===empId){cumHrs=parseFloat(cum[i][6])||0;break;}
    const skill = cumHrs>180 ? (b.normalH+b.holH)*20 : 0;
    let cl=0; if(cumHrs>=4320)cl=20; else if(cumHrs>=3240)cl=15; else if(cumHrs>=2160)cl=10; else if(cumHrs>=1080)cl=5;
    const contrib = (b.normalH+b.holH)*cl;

    const estTotal = Math.round(basicPay+holPay+skill+contrib);
    out.push({ empId, name:String(emp[1]), estimatedHours:Math.round((b.normalH+b.holH)*10)/10, estimatedSalary:estTotal });
  }
  return { success:true, ym, data: out };
}

// ── 7. 套用勞健保級距校對(門市總監月初確認後執行) ──
function applyInsuranceGrade(ss, data) {
  const staff = ss.getSheetByName("夥伴資料");
  const all = staff.getDataRange().getValues();
  let row=-1;
  for (let i=1;i<all.length;i++) if(String(all[i][0])===String(data.empId)){row=i+1;break;}
  if (row<0) return { error:"找不到夥伴" };
  staff.getRange(row,49).setValue(data.ym);
  staff.getRange(row,50).setValue(parseFloat(data.estimatedSalary)||0);
  return { success:true };
}

// ── 8. 覆蓋 getInsuranceRow:優先使用「校對薪資」而非過去平均 ──
function getInsuranceRow(ss, empId, tableName) {
  const staff = ss.getSheetByName("夥伴資料").getDataRange().getValues();
  const emp = staff.find(r=>String(r[0])===empId);
  let avg = 28000;
  if (emp && emp[49]) {
    avg = parseFloat(emp[49]);
  } else {
    const sal = ss.getSheetByName("薪資明細").getDataRange().getValues();
    let sum=0, n=0;
    for (let i=sal.length-1; i>=1 && n<6; i--) {
      if (String(sal[i][2])===empId) { sum+=parseFloat(sal[i][22])||0; n++; }
    }
    avg = n>0 ? sum/n : 28000;
  }
  const tbl = ss.getSheetByName(tableName).getDataRange().getValues();
  for (let i=1; i<tbl.length; i++) {
    if (avg <= parseFloat(tbl[i][1])) return tbl[i];
  }
  return tbl[tbl.length-1];
}

// ── 9. 月結防呆:一鍵跑完整流程 ──
function runMonthlyClosing() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.prompt("月結防呆","請輸入要結算的年月(2026-09):",ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton()!==ui.Button.OK) return;
  const ym = resp.getResponseText().trim();

  const flagged = detectAbnormalShifts();
  if (flagged>0) {
    const cont = ui.alert("⚠️ 偵測異常","發現 "+flagged+" 筆異常未下班紀錄,已標記。\n建議先於「打卡紀錄」表確認並補登後再繼續。\n\n是否仍要繼續進行月結?", ui.ButtonSet.YES_NO);
    if (cont !== ui.Button.YES) return;
  }

  calcQualification(ym);
  const salCount = calcSalaryV2(ym);
  runReferralBonusInternal();

  ui.alert("✅ "+ym+" 月結流程完成!\n1. 達標判定 ✓\n2. 薪資計算 ✓ 共"+salCount+"位\n3. 介紹獎金結算 ✓\n\n請至「薪資明細」確認後發布。");
}
function runReferralBonusInternal() {
  try { runReferralBonus(); } catch(e) {}
}

// ── 10. 覆蓋選單 ──
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🥚 紅玉系統")
    .addItem("🚀 一鍵月結(防呆)","runMonthlyClosing")
    .addSeparator()
    .addItem("📅 設定每日自動更新","setDailyTrigger")
    .addItem("⏱ 更新累計工時","updateAccumulatedHours")
    .addItem("✅ 達標判定(月)","runQualification")
    .addItem("💰 薪資計算v2(月)","runSalaryV2")
    .addItem("🤝 介紹獎金結算(月)","runReferralBonus")
    .addSeparator()
    .addItem("⚠️ 異常打卡偵測","detectAbnormalShifts")
    .addItem("🥚 麵糊消耗計算","calcFlourUsage")
    .addItem("🔍 麵糊核對表(月)","runFlourAudit")
    .addSeparator()
    .addItem("🎊 年終結算(年)","runYearEndBonus")
    .addToUi();
}

// ── 11. 覆蓋 doGet:加入新API ──
function doGet(e) {
  const params = e.parameter, action = params.action;
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let result;
  try {
    if (params.payload) {
      const data = JSON.parse(decodeURIComponent(params.payload)); const a = data.action;
      if (a==="punch") result=savePunch(ss,data);
      else if (a==="openStore") result=saveOpenStore(ss,data);
      else if (a==="closeStore") result=saveCloseStore(ss,data);
      else if (a==="saveSchedule") result=saveScheduleApi(ss,data);
      else if (a==="deleteSchedule") result=deleteScheduleApi(ss,data);
      else if (a==="punchExtra") result=punchExtra(ss,data);
      else if (a==="manualCloseSegment") result=manualCloseSegment(ss,data);
      else if (a==="applyInsuranceGrade") result=applyInsuranceGrade(ss,data);
      else result={error:"未知的寫入動作: "+a};
    } else {
      if (action==="login") result=loginUser(ss,params);
      else if (action==="getSchedule") result=getSchedule(ss,params);
      else if (action==="getSalary") result=getSalary(ss,params);
      else if (action==="getAnnouncements") result=getAnnouncements(ss);
      else if (action==="getStaffInfo") result=getStaffInfo(ss,params);
      else if (action==="getQuota") result=getQuotaApi(ss,params);
      else if (action==="getLocations") result=getLocationsApi(ss);
      else if (action==="getAdminDashboard") result=getAdminDashboard(ss,params);
      else if (action==="getManagedSchedule") result=getManagedSchedule(ss,params);
      else if (action==="getStaffList") result=getStaffList(ss,params);
      else if (action==="checkFirstOpener") result=checkFirstOpener(ss,params);
      else if (action==="getYesterdayHandover") result=getYesterdayHandover(ss,params);
      else if (action==="getActiveSegment") result=getActiveSegment(ss,params);
      else if (action==="checkLastLeaver") result=checkLastLeaver(ss,params);
      else if (action==="getAbnormalShifts") result=getAbnormalShifts(ss,params);
      else if (action==="estimateSalaryFromSchedule") result=estimateSalaryFromSchedule(ss,params);
      else result={error:"未知的動作: "+action};
    }
  } catch(err) { result={error:err.toString()}; }
  const json=JSON.stringify(result);
  if (params.callback) return ContentService.createTextOutput(params.callback+"("+json+")").setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

// ═══════════════════════════════════════════
// v1.7.1 緊急修正:getActiveSegment / checkLastLeaver 日期比對格式錯誤
// 貼在最下方 → 儲存 → 重新部署(這次不用執行setup,純函式覆蓋)
// ═══════════════════════════════════════════

// 統一日期格式轉換工具(Sheets可能存Date物件或字串,一律轉yyyy-MM-dd字串比對)
function dateNorm(v) {
  if (!v) return "";
  if (v instanceof Date) return Utilities.formatDate(v, "Asia/Taipei", "yyyy-MM-dd");
  // 若是字串但看起來像完整時間戳(含冒號或T),嘗試轉換
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return Utilities.formatDate(d, "Asia/Taipei", "yyyy-MM-dd");
  } catch(e) {}
  return s;
}

// ── 覆蓋:查詢今日進行中的班(修正日期比對) ──
function getActiveSegment(ss, params) {
  const empId = String(params.empId||"");
  const date = String(params.date||"");
  const punch = ss.getSheetByName("打卡紀錄").getDataRange().getValues();
  const rows = [];
  for (let i=1;i<punch.length;i++){
    const r = punch[i];
    if (String(r[2])!==empId) continue;
    if (dateNorm(r[1])!==date) continue;
    rows.push({ type:String(r[5]), time:r[6]?new Date(r[6]):null, loc:String(r[9]||"") });
  }
  rows.sort((a,b)=> (a.time&&b.time) ? a.time-b.time : 0);
  let openSeg = null;
  rows.forEach(r => {
    if (r.type==="上班") {
      if (!openSeg) openSeg = { location:r.loc, inTime:r.time };
    } else if (r.type==="下班") {
      if (openSeg && openSeg.location===r.loc) openSeg = null;
    }
  });
  return { success:true, active: openSeg ? { location:openSeg.location, inTime:openSeg.inTime ? openSeg.inTime.toISOString() : null } : null };
}

// ── 覆蓋:判斷是否最晚下班者(修正日期比對) ──
function checkLastLeaver(ss, params) {
  const empId = String(params.empId||"");
  const date = String(params.date||"");
  const location = String(params.location||"");
  const punch = ss.getSheetByName("打卡紀錄").getDataRange().getValues();

  const byEmp = {};
  for (let i=1;i<punch.length;i++){
    const r = punch[i];
    if (dateNorm(r[1])!==date) continue;
    if (String(r[9])!==location) continue;
    const id = String(r[2]);
    if (!byEmp[id]) byEmp[id] = { in:0, out:0 };
    if (String(r[5])==="上班") byEmp[id].in++;
    if (String(r[5])==="下班") byEmp[id].out++;
  }

  let othersStillWorking = false;
  Object.entries(byEmp).forEach(([id, v]) => {
    if (id===empId) return;
    if (v.in > v.out) othersStillWorking = true;
  });

  return { success:true, isLast: !othersStillWorking };
}

// ── 覆蓋:checkFirstOpener 同樣修正日期比對(以防同樣問題) ──
function checkFirstOpener(ss, params) {
  const date = String(params.date||""), loc = String(params.location||"");
  const open = ss.getSheetByName("開店盤點").getDataRange().getValues();
  for (let i=1;i<open.length;i++){
    if (dateNorm(open[i][1])===date && String(open[i][5])===loc) {
      return { success:true, isFirst:false, openedBy:String(open[i][4]),
        original:open[i][6], cocoa:open[i][7], ruby:open[i][8], matcha:open[i][9] };
    }
  }
  return { success:true, isFirst:true };
}

// ── 覆蓋:getYesterdayHandover 同樣修正 ──
function getYesterdayHandover(ss, params) {
  const loc = String(params.location||"");
  const y = new Date(); y.setDate(y.getDate()-1);
  const yStr = Utilities.formatDate(y,"Asia/Taipei","yyyy-MM-dd");
  const close = ss.getSheetByName("收店盤點").getDataRange().getValues();
  for (let i=close.length-1;i>=1;i--){
    if (dateNorm(close[i][1])===yStr && String(close[i][5])===loc) {
      return { success:true, note:String(close[i][20]||""), cash:close[i][18], date:yStr };
    }
  }
  return { success:true, note:"", cash:"", date:yStr };
}

// ── 覆蓋:punchExtra 同樣修正日期比對 ──
function punchExtra(ss, data) {
  const sheet = ss.getSheetByName("打卡紀錄");
  const all = sheet.getDataRange().getValues();
  const empId = String(data.empId), date = String(data.date), loc = String(data.location), type = String(data.type);
  for (let i = all.length - 1; i >= 1; i--) {
    const r = all[i];
    if (String(r[2])===empId && dateNorm(r[1])===date && String(r[9])===loc && String(r[5])===type) {
      if (data.cashReceived !== undefined) sheet.getRange(i+1, 15).setValue(parseFloat(data.cashReceived)||0);
      if (data.cashHandover !== undefined) sheet.getRange(i+1, 16).setValue(parseFloat(data.cashHandover)||0);
      return { success:true };
    }
  }
  return { success:false, error:"找不到對應的打卡紀錄" };
}

// ═══════════════════════════════════════════
// v1.8 補丁:資料歸檔機制(定期搬移舊資料,維持系統速度)
// 貼在最下方 → 儲存 → 執行 setupV9 一次 → 設定觸發器 → 重新部署
// ═══════════════════════════════════════════

// ── 1. 建立歷史封存工作表 ──
function setupV9() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const archiveSheets = [
    { name:"打卡紀錄_歷史", from:"打卡紀錄" },
    { name:"開店盤點_歷史", from:"開店盤點" },
    { name:"收店盤點_歷史", from:"收店盤點" },
  ];
  archiveSheets.forEach(a => {
    let sh = ss.getSheetByName(a.name);
    if (!sh) {
      const src = ss.getSheetByName(a.from);
      sh = ss.insertSheet(a.name);
      const headers = src.getRange(1,1,1,src.getLastColumn()).getValues();
      sh.getRange(1,1,1,headers[0].length).setValues(headers);
      sh.getRange(1,1,1,headers[0].length)
        .setBackground("#2a2520").setFontColor("#c0b8a8").setFontWeight("bold");
      sh.setFrozenRows(1);
    }
  });
  SpreadsheetApp.getUi().alert("✅ 歷史封存表建立完成:打卡紀錄_歷史、開店盤點_歷史、收店盤點_歷史");
}

// ── 2. 歸檔引擎:把超過保留月數的資料搬到歷史表 ──
function archiveOldData() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const KEEP_MONTHS = 6; // 主表只保留最近6個月,可自行調整
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - KEEP_MONTHS);
  const cutoffStr = Utilities.formatDate(cutoff, "Asia/Taipei", "yyyy-MM-dd");

  const jobs = [
    { main:"打卡紀錄", archive:"打卡紀錄_歷史", dateCol:2 },   // B欄=日期(index1,1-based=2)
    { main:"開店盤點", archive:"開店盤點_歷史", dateCol:2 },
    { main:"收店盤點", archive:"收店盤點_歷史", dateCol:2 },
  ];

  let totalArchived = 0;
  const report = [];

  jobs.forEach(job => {
    const mainSh = ss.getSheetByName(job.main);
    const archSh = ss.getSheetByName(job.archive);
    if (!mainSh || !archSh) return;

    const data = mainSh.getDataRange().getValues();
    const keepRows = [data[0]]; // 保留標題列
    const archiveRows = [];

    for (let i=1; i<data.length; i++) {
      const raw = data[i][job.dateCol-1];
      const dStr = raw instanceof Date ? Utilities.formatDate(raw,"Asia/Taipei","yyyy-MM-dd") : String(raw).slice(0,10);
      if (dStr && dStr < cutoffStr) {
        archiveRows.push(data[i]);
      } else {
        keepRows.push(data[i]);
      }
    }

    if (archiveRows.length > 0) {
      // 寫入歷史表(附加在後面)
      const startRow = archSh.getLastRow() + 1;
      archSh.getRange(startRow, 1, archiveRows.length, archiveRows[0].length).setValues(archiveRows);
      // 主表清空重寫(只留未過期資料)
      mainSh.clearContents();
      mainSh.getRange(1, 1, keepRows.length, keepRows[0].length).setValues(keepRows);
      totalArchived += archiveRows.length;
      report.push(job.main + ": 歸檔 " + archiveRows.length + " 筆(保留 " + (keepRows.length-1) + " 筆)");
    } else {
      report.push(job.main + ": 無需歸檔(共 " + (keepRows.length-1) + " 筆)");
    }
  });

  return { totalArchived, report };
}

// ── 3. 手動觸發歸檔(選單用,含確認提示) ──
function runArchive() {
  const ui = SpreadsheetApp.getUi();
  const confirm = ui.alert("資料歸檔",
    "此操作會把6個月前的打卡紀錄/開店盤點/收店盤點資料搬到歷史表,\n主表只保留近6個月資料,速度會提升。\n\n注意:薪資計算若需要查詢6個月以前的資料會抓不到(但正常月結不受影響)。\n\n是否繼續?",
    ui.ButtonSet.YES_NO);
  if (confirm !== ui.Button.YES) return;

  const result = archiveOldData();
  ui.alert("✅ 歸檔完成!\n\n" + result.report.join("\n") + "\n\n共歸檔 " + result.totalArchived + " 筆資料。");
}

// ── 4. 設定每月自動歸檔觸發器 ──
function setMonthlyArchiveTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "archiveOldData") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("archiveOldData")
    .timeBased().onMonthDay(1).atHour(3).create();
  SpreadsheetApp.getUi().alert("✅ 已設定每月1號凌晨3點自動歸檔");
}

// ── 5. 查詢歷史資料(若需要調閱超過6個月前的紀錄) ──
function queryArchivedData(ss, params) {
  const sheetMap = { "打卡紀錄":"打卡紀錄_歷史", "開店盤點":"開店盤點_歷史", "收店盤點":"收店盤點_歷史" };
  const target = sheetMap[String(params.table||"打卡紀錄")];
  if (!target) return { error:"不支援的資料表" };
  const sh = ss.getSheetByName(target);
  if (!sh) return { success:true, data:[] };
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const empId = String(params.empId||"");
  const ym = String(params.ym||"");
  const out = [];
  for (let i=1;i<data.length;i++){
    const row = data[i];
    if (empId && String(row[2]||row[3])!==empId) continue; // 依表結構,打卡紀錄empId在index2,盤點在index3
    const dStr = row[1] instanceof Date ? Utilities.formatDate(row[1],"Asia/Taipei","yyyy-MM-dd") : String(row[1]).slice(0,10);
    if (ym && !dStr.startsWith(ym)) continue;
    const obj = {};
    headers.forEach((h,idx)=>{ obj[String(h)] = row[idx]; });
    out.push(obj);
  }
  return { success:true, data: out };
}

// ── 6. 覆蓋選單:加入歸檔選項 ──
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🥚 紅玉系統")
    .addItem("🚀 一鍵月結(防呆)","runMonthlyClosing")
    .addSeparator()
    .addItem("📅 設定每日自動更新","setDailyTrigger")
    .addItem("⏱ 更新累計工時","updateAccumulatedHours")
    .addItem("✅ 達標判定(月)","runQualification")
    .addItem("💰 薪資計算v2(月)","runSalaryV2")
    .addItem("🤝 介紹獎金結算(月)","runReferralBonus")
    .addSeparator()
    .addItem("⚠️ 異常打卡偵測","detectAbnormalShifts")
    .addItem("🥚 麵糊消耗計算","calcFlourUsage")
    .addItem("🔍 麵糊核對表(月)","runFlourAudit")
    .addSeparator()
    .addItem("📦 資料歸檔(手動)","runArchive")
    .addItem("📅 設定每月自動歸檔","setMonthlyArchiveTrigger")
    .addSeparator()
    .addItem("🎊 年終結算(年)","runYearEndBonus")
    .addToUi();
}

// ── 7. 覆蓋 doGet:加入 queryArchivedData ──
function doGet(e) {
  const params = e.parameter, action = params.action;
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let result;
  try {
    const _ext = extHandler_(action, params);
    if (_ext) result = _ext;
    else if (params.payload) {
      const data = JSON.parse(decodeURIComponent(params.payload)); const a = data.action;
      if (a==="punch") result=savePunch(ss,data);
      else if (a==="openStore") result=saveOpenStore(ss,data);
      else if (a==="closeStore") result=saveCloseStore(ss,data);
      else if (a==="saveSchedule") result=saveScheduleApi(ss,data);
      else if (a==="deleteSchedule") result=deleteScheduleApi(ss,data);
      else if (a==="punchExtra") result=punchExtra(ss,data);
      else if (a==="manualCloseSegment") result=manualCloseSegment(ss,data);
      else if (a==="applyInsuranceGrade") result=applyInsuranceGrade(ss,data);
      else result={error:"未知的寫入動作: "+a};
    } else {
      if (action==="login") result=loginUser(ss,params);
      else if (action==="getSchedule") result=getSchedule(ss,params);
      else if (action==="getSalary") result=getSalary(ss,params);
      else if (action==="getAnnouncements") result=getAnnouncements(ss);
      else if (action==="getStaffInfo") result=getStaffInfo(ss,params);
      else if (action==="getQuota") result=getQuotaApi(ss,params);
      else if (action==="getLocations") result=getLocationsApi(ss);
      else if (action==="getAdminDashboard") result=getAdminDashboard(ss,params);
      else if (action==="getManagedSchedule") result=getManagedSchedule(ss,params);
      else if (action==="getStaffList") result=getStaffList(ss,params);
      else if (action==="checkFirstOpener") result=checkFirstOpener(ss,params);
      else if (action==="getYesterdayHandover") result=getYesterdayHandover(ss,params);
      else if (action==="getActiveSegment") result=getActiveSegment(ss,params);
      else if (action==="checkLastLeaver") result=checkLastLeaver(ss,params);
      else if (action==="getAbnormalShifts") result=getAbnormalShifts(ss,params);
      else if (action==="estimateSalaryFromSchedule") result=estimateSalaryFromSchedule(ss,params);
      else if (action==="queryArchivedData") result=queryArchivedData(ss,params);
      else result={error:"未知的動作: "+action};
    }
  } catch(err) { result={error:err.toString()}; }
  const json=JSON.stringify(result);
  if (params.callback) return ContentService.createTextOutput(params.callback+"("+json+")").setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}
// ═══════════════════════════════════════════
// v1.8.1 修正:管理儀表板夥伴出勤時數,支援多段班次(依地點分開配對)
// 貼在最下方 → 儲存 → 重新部署
// ═══════════════════════════════════════════
function getAdminDashboard(ss, params) {
  const empId = String(params.empId||"");
  const ym = String(params.ym||Utilities.formatDate(new Date(),"Asia/Taipei","yyyy-MM"));
  const staff = ss.getSheetByName("夥伴資料").getDataRange().getValues();
  const me = staff.find(r=>String(r[0])===empId);
  if (!me) return {error:"查無夥伴"};
  const role = parseInt(me[12])||1;
  if (role<2) return {error:"無權限"};
  const managed = role>=3 ? Object.keys(getLocations())
    : String(me[46]||"").split(/[,，、]/).map(s=>s.trim()).filter(Boolean);
  const canSee = loc => role>=3 || managed.includes(loc);

  const P = getParams(), locs = getLocations();
  const fmt = v => v ? (v instanceof Date ? Utilities.formatDate(v,"Asia/Taipei","yyyy-MM-dd") : String(v).slice(0,10)) : "";
  const today = Utilities.formatDate(new Date(),"Asia/Taipei","yyyy-MM-dd");
  const [y,m] = ym.split("-").map(Number);
  const isCur = today.startsWith(ym);
  const cutDay = isCur ? (new Date().getDate()-1) : 31;
  const prevYm = (m===1 ? (y-1)+"-12" : y+"-"+String(m-1).padStart(2,"0"));

  // ── 營業額(收店盤點) ──
  const cd = ss.getSheetByName("收店盤點").getDataRange().getValues();
  const revOf = r => {
    const lc=locs[String(r[5])]||{};
    const totalCol = r[30]!==""&&r[30]!==undefined ? parseFloat(r[30]) : parseFloat(r[16])||0;
    return lc.type==="C份數" ? (parseFloat(r[16])||0)*(lc.unitPrice||70) : totalCol;
  };
  const cur={}, prev={}, todayRev={};
  for (let i=1;i<cd.length;i++){
    const d=fmt(cd[i][1]); if(!d) continue;
    const loc=String(cd[i][5]); if(!canSee(loc)) continue;
    const day=parseInt(d.slice(8));
    if (d.startsWith(ym)) {
      if (d===today) todayRev[loc]=(todayRev[loc]||0)+revOf(cd[i]);
      else if (day<=cutDay) cur[loc]=(cur[loc]||0)+revOf(cd[i]);
    } else if (d.startsWith(prevYm) && day<=cutDay) prev[loc]=(prev[loc]||0)+revOf(cd[i]);
  }
  const locList = Object.keys(locs).filter(canSee).map(name=>{
    const c=Math.round(cur[name]||0), p=Math.round(prev[name]||0);
    return { name, rev:c, prevRev:p, pct: p>0 ? Math.round((c-p)/p*100) : null, kind:locs[name].kind };
  }).filter(x=>x.rev>0||x.prevRev>0).sort((a,b)=>b.rev-a.rev);
  const total = locList.reduce((s,x)=>s+x.rev,0);
  const totalPrev = locList.reduce((s,x)=>s+x.prevRev,0);

  // ── 夥伴出勤時數(修正:依「人+日期+地點」配對,支援同天多段班次) ──
  const punch = ss.getSheetByName("打卡紀錄").getDataRange().getValues();
  const sess={};
  for (let i=1;i<punch.length;i++){
    const r=punch[i]; const t=r[6]?new Date(r[6]):null; if(!t||isNaN(t)) continue;
    const d=Utilities.formatDate(t,"Asia/Taipei","yyyy-MM-dd"); if(!d.startsWith(ym)) continue;
    const loc=String(r[9]||""); if(!canSee(loc)) continue;
    const empK=String(r[2]);
    const k=empK+"_"+d+"_"+loc; // 加入地點,避免同天不同地點互相覆蓋
    if(!sess[k]) sess[k]={emp:empK, segs:[]};
    sess[k].segs.push({ type:String(r[5]), time:t });
  }
  const hrs={};
  Object.values(sess).forEach(s=>{
    s.segs.sort((a,b)=>a.time-b.time);
    let inT=null;
    s.segs.forEach(seg=>{
      if (seg.type==="上班") inT=seg.time;
      else if (seg.type==="下班" && inT) { hrs[s.emp]=(hrs[s.emp]||0)+Math.max(0,(seg.time-inT)/ 3600000); inT=null; }
    });
  });
  const staffList = Object.entries(hrs).map(([id,h])=>{
    const r=staff.find(x=>String(x[0])===id)||[];
    const student=String(r[39])==="是";
    return { id, name:String(r[1]||id), hours:Math.round(h*10)/10,
      target: student?(P["學生達標時數"]||72):(P["一般達標時數"]||180) };
  }).sort((a,b)=>b.hours-a.hours);

  return { success:true, data:{ ym, prevYm, asOf: isCur ? "截至昨日" : "全月", role,
    total, totalPrev, totalPct: totalPrev>0 ? Math.round((total-totalPrev)/totalPrev*100) : null,
    locations: locList, today: Object.entries(todayRev).map(([n,v])=>({name:n,rev:Math.round(v)})),
    staff: staffList } };
}

function authorizeDriveAccess() {
  // 實際測試「寫入」權限：建立測試檔後立即移到垃圾桶（2026-11-09）
  const it = DriveApp.getFoldersByName(DRIVE_ROOT);
  const root = it.hasNext() ? it.next() : DriveApp.createFolder(DRIVE_ROOT);
  const f = root.createFile('授權測試.txt', 'ok');
  f.setTrashed(true);
  Logger.log('Drive 完整授權成功（可寫入）');
}


// ═══════════════════════════════════════════
// v1.9 薪資規格對齊（2026-10-21，依《薪資計算規格書 v1》）
// 貼在程式碼最下方 → 儲存 → 部署新版本
// 1. 工時不扣午休（另外將全檔「/3600000-1」改為「/3600000」）
// 2. 時薪一律採基準時薪（2026：196）
// 3. 同一天跨櫃位：工時合併後再套加班倍率
// 4. 新增團體獎金（月換算業績 > 門檻 → 計算業績 1% 依工時比例分配）
// 5. 三節月份 1、6、9（端午落在其他月份的年份，修改 FEST 常數）
// 6. 生日：當月 ≥80 小時依累計級距（600/1200/2400），未滿 80 小時發 200
//    三節：同生日（當月 ≥80 小時依累計級距，未滿 80 小時發 200）
// 7. 職務加給（第 22 欄）保留管理員手填值並計入總額
// 其餘（假日出勤獎金、勞健保補貼、轉帳費、長青）維持原樣
// ═══════════════════════════════════════════
function calcSalaryV2(ym) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const P = getParams(), cal = getCalendar(), locs = getLocations();
  const wage = P["基準時薪"] || 196;
  const staff = ss.getSheetByName("夥伴資料").getDataRange().getValues();
  const punch = ss.getSheetByName("打卡紀錄").getDataRange().getValues();
  const closeS = ss.getSheetByName("收店盤點").getDataRange().getValues();
  const cum = ss.getSheetByName("累計工時").getDataRange().getValues();
  const salSheet = ss.getSheetByName("薪資明細");
  const targetMonth = parseInt(ym.slice(5));
  const FEST = [1, 6, 9];   // 三節發放月份：春節(1月)、端午(6月)、中秋(9月)；端午落在5月的年份請改這裡

  // ── 1. 打卡配對：人+日期+地點，不扣午休 ──
  const sessions = {};
  for (let i = 1; i < punch.length; i++) {
    const r = punch[i], empId = String(r[2]); if (!empId) continue;
    if (String(r[16] || "").includes("異常未下班") && !String(r[16] || "").includes("已由管理員補登")) continue;
    const t = r[6] ? new Date(r[6]) : null; if (!t || isNaN(t)) continue;
    const d = Utilities.formatDate(t, "Asia/Taipei", "yyyy-MM-dd");
    if (!d.startsWith(ym)) continue;
    const key = empId + "_" + d + "_" + String(r[9] || "");
    if (!sessions[key]) sessions[key] = { empId, date: d, loc: String(r[9] || ""), hrs: 0, first: t, segs: [] };
    sessions[key].segs.push({ type: String(r[5]), time: t });
    if (t < sessions[key].first) sessions[key].first = t;
  }
  const locDayHours = {}, locDayCount = {}, locMonthHours = {}, empLocHours = {};
  Object.values(sessions).forEach(s => {
    s.segs.sort((a, b) => a.time - b.time);
    let inT = null;
    s.segs.forEach(seg => {
      if (seg.type === "上班") inT = seg.time;
      else if (seg.type === "下班" && inT) { s.hrs += Math.max(0, (seg.time - inT) / 3600000); inT = null; }
    });
    if (!s.hrs) return;
    const k = s.date + "_" + s.loc;
    locDayHours[k] = (locDayHours[k] || 0) + s.hrs;
    locDayCount[k] = (locDayCount[k] || 0) + 1;
    locMonthHours[s.loc] = (locMonthHours[s.loc] || 0) + s.hrs;
    const ek = s.empId + "_" + s.loc;
    empLocHours[ek] = (empLocHours[ek] || 0) + s.hrs;
  });

  // ── 2. 每日業績（每櫃每天一筆）→ 計算業績 ──
  const calcRev = (loc, rev) => {
    const lc = locs[loc] || {};
    if (lc.type === "A百貨") return rev * 0.8;
    if (lc.type === "C份數") return rev * (lc.unitPrice || P["C類預設抽成"] || 70);
    return rev;
  };
  const dayRevenue = {};
  for (let i = 1; i < closeS.length; i++) {
    const d = closeS[i][1] ? Utilities.formatDate(new Date(closeS[i][1]), "Asia/Taipei", "yyyy-MM-dd") : "";
    if (!d.startsWith(ym)) continue;
    const total = closeS[i][30] !== "" && closeS[i][30] !== undefined ? parseFloat(closeS[i][30]) : parseFloat(closeS[i][16]) || 0;
    dayRevenue[d + "_" + String(closeS[i][5])] = total || 0;   // 同櫃同日以最後一筆為準（不重複加總）
  }

  // ── 3. 團體獎金池（每櫃每月）──
  const locRev = {}, locDays = {};
  Object.entries(dayRevenue).forEach(([k, rev]) => {
    const loc = k.slice(11);
    const c = calcRev(loc, rev);
    if (!c) return;
    locRev[loc] = (locRev[loc] || 0) + c;
    locDays[loc] = (locDays[loc] || 0) + 1;
  });
  const groupPool = {};
  Object.keys(locRev).forEach(loc => {
    const eq = locRev[loc] / locDays[loc] * 30;
    if (eq > (P["團體獎金門檻"] || 200000)) groupPool[loc] = locRev[loc] * 0.01;
  });

  // ── 4. 逐人計算 ──
  const salEx = salSheet.getDataRange().getValues();
  const perfAwarded = new Set();
  const tier = c => c > 4320 ? 2400 : c > 2160 ? 1200 : 600;
  let count = 0;
  for (let si = 1; si < staff.length; si++) {
    const emp = staff[si], empId = String(emp[0]);
    if (!empId || emp[10]) continue;
    const name = String(emp[1]);
    const home = String(emp[38] || "");
    const birthday = emp[4] ? new Date(emp[4]) : null;
    const laborSt = String(emp[41] || "公司投保");
    const healthSt = String(emp[42] || "公司投保");
    const deps = parseInt(emp[27]) || 0;

    let cumHrs = 0;
    for (let i = cum.length - 1; i >= 1; i--) if (String(cum[i][0]) === empId) { cumHrs = parseFloat(cum[i][6]) || 0; break; }

    const mine = Object.values(sessions).filter(s => s.empId === empId && s.hrs);
    if (!mine.length) continue;

    let basic = 0, ot1 = 0, ot2 = 0, ot3 = 0, dblPay = 0, holBonus = 0, perfBonus = 0, group = 0;
    let normalH = 0, holH = 0; const locSet = new Set();

    // 同一天依上班時間排序，工時累加後切分加班段
    const byDay = {};
    mine.forEach(s => { (byDay[s.date] = byDay[s.date] || []).push(s); });
    Object.values(byDay).forEach(list => {
      list.sort((a, b) => a.first - b.first);
      let off = 0;
      list.forEach(s => {
        const lc = locs[s.loc] || {}; locSet.add(s.loc);
        const dt = getDayType(s.date, lc.county || "", home, cal);
        const h = s.hrs, a = off, z = off + h;
        const seg = (lo, hi) => Math.max(0, Math.min(z, hi) - Math.max(a, lo));
        const b = seg(0, 8) * wage, o1 = seg(8, 10) * wage * 1.33, o2 = seg(10, 12) * wage * 1.67, o3 = seg(12, 999) * wage * 2;
        off = z;
        if (dt === "國定假日" || dt === "颱風日") { dblPay += b + o1 + o2 + o3; holH += h; }
        else { basic += b; ot1 += o1; ot2 += o2; ot3 += o3; normalH += h; }
        if (dt === "假日" || dt === "連假日" || (lc.kind === "活動" && dt === "平日")) {
          const tot = locDayHours[s.date + "_" + s.loc] || h;
          holBonus += CEIL((P["假日出勤獎金"] || 500) / tot * h);
        }
        const awardKey = empId + "_" + s.date + "_" + s.loc;
        if (!perfAwarded.has(awardKey)) {
          const rev = dayRevenue[s.date + "_" + s.loc];
          if (rev !== undefined) {
            const c = calcRev(s.loc, rev);
            const th = perfBonusTable(locDayCount[s.date + "_" + s.loc] || 1, P);   // 單人×人數
            if (c >= th[2]) perfBonus += 1000; else if (c >= th[1]) perfBonus += 700; else if (c >= th[0]) perfBonus += 500;   // 達到門檻即發
          }
          perfAwarded.add(awardKey);
        }
      });
    });
    locSet.forEach(loc => {
      if (groupPool[loc] && locMonthHours[loc]) group += groupPool[loc] * (empLocHours[empId + "_" + loc] || 0) / locMonthHours[loc];
    });

    const totalH = normalH + holH;
    basic = CEIL(basic); ot1 = CEIL(ot1); ot2 = CEIL(ot2); ot3 = CEIL(ot3);
    dblPay = CEIL(dblPay * 2); group = CEIL(group);
    const basicTotal = basic + ot1 + ot2 + ot3 + dblPay;

    const skill = cumHrs > 180 ? CEIL(totalH * 20) : 0;
    const cl = cumHrs > 4320 ? 20 : cumHrs > 3240 ? 15 : cumHrs > 2160 ? 10 : cumHrs > 1080 ? 5 : 0;
    const contrib = CEIL(totalH * cl);
    let age = 0;
    if (birthday && !isNaN(birthday)) {
      const ref = new Date(ym + "-01");
      age = ref.getFullYear() - birthday.getFullYear();
      if (ref.getMonth() < birthday.getMonth()) age--;
    }
    const evergreen = age >= 50 ? CEIL(totalH * (10 + (age - 50))) : 0;
    const bday = (birthday && birthday.getMonth() + 1 === targetMonth) ? (totalH >= 80 ? tier(cumHrs) : 200) : 0;
    const fest = FEST.includes(targetMonth) ? (totalH >= 80 ? tier(cumHrs) : 200) : 0;

    let laborDed = 0, healthDed = 0, insAdd = 0;
    if (laborSt === "公司投保") laborDed = parseFloat(emp[21]) || 0;
    else insAdd += CEIL(parseFloat(getInsuranceRow(ss, empId, "勞保級距表")[3]) || 0);
    if (healthSt === "公司投保") healthDed = (parseFloat(emp[26]) || 0) * (1 + Math.min(deps, 3));
    else if (healthSt === "無投保") insAdd += CEIL(parseFloat(getInsuranceRow(ss, empId, "健保級距表")[3]) || 0);
    const fee = parseFloat(emp[17]) || 0;

    let ri = -1;
    for (let i = 1; i < salEx.length; i++) if (String(salEx[i][2]) === empId && ymNorm(salEx[i][1]) === ym) { ri = i + 1; break; }
    const duty = ri > 0 ? (parseFloat(salEx[ri - 1][21]) || 0) : 0;   // 職務加給：保留手填

    const gross = basicTotal + group + perfBonus + skill + contrib + evergreen + bday + fest + duty + holBonus + insAdd;
    const net = gross - laborDed - healthDed - fee;
    const row = [ym + "-" + empId, ym, empId, name, Array.from(locSet).join("、"),
      Math.round(normalH * 10) / 10, Math.round(holH * 10) / 10, Math.round(totalH * 10) / 10,
      basic, ot1, ot2, ot3, dblPay, basicTotal, group, perfBonus, skill, contrib, evergreen,
      bday, fest, duty, gross, laborDed, healthDed, insAdd, fee, net, "匯款",
      ri > 0 ? (salEx[ri - 1][29] || "待確認") : "待確認", ri > 0 ? (salEx[ri - 1][30] || "") : "",
      holBonus, insAdd];
    if (ri > 0) salSheet.getRange(ri, 1, 1, 33).setValues([row]);
    else salSheet.appendRow(row);
    count++;
  }
  return count;
}

// ═══════════════════════════════════════════════
// v1.10 擴充（2026-11-09）：投票系統 + 宇宙辦公室缺貨看板
// 路由：doGet / doPost 開頭先呼叫 extHandler_()，不是這裡的動作就回傳 null 走原流程
// ═══════════════════════════════════════════════

function extHandler_(action, p) {
  p = p || {};
  var sec = secHandler_(action, p); if (sec) return sec;
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

// ── 投票系統 v1（2026-11-01，管理員判斷改用夥伴資料第13欄權限）──
var POLL_ADMIN_IDS = [];   // 後備名單：若需要額外指定管理員，填員工編號，例如 ['E001']
var POLL_HEAD = ['投票ID','標題','說明','選項','複選','截止日','狀態','建立者ID','建立者','建立時間'];
var VOTE_HEAD = ['投票ID','員工ID','姓名','選擇','時間'];

function poll_sheet_(name, head) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(head); sh.setFrozenRows(1); }
  return sh;
}
function poll_today_() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd'); }
function poll_now_()   { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss'); }

function poll_isAdmin_(empId) {
  empId = String(empId || '');
  if (!empId) return false;
  if (POLL_ADMIN_IDS.indexOf(empId) >= 0) return true;
  var v = SpreadsheetApp.openById(SHEET_ID).getSheetByName('夥伴資料').getDataRange().getValues();
  for (var r = 1; r < v.length; r++) {
    if (String(v[r][0]) === empId) return (parseInt(v[r][12]) || 1) >= 3;
  }
  return false;
}

function poll_status_(status, deadline) {
  if (status === '已關閉') return '已關閉';
  if (deadline && poll_today_() > deadline) return '已關閉';
  return '進行中';
}

function poll_list_(p) {
  var empId = String(p.empId || ''), admin = poll_isAdmin_(empId);
  var ps = poll_sheet_('投票', POLL_HEAD).getDataRange().getValues();
  var vs = poll_sheet_('投票紀錄', VOTE_HEAD).getDataRange().getValues();
  var byPoll = {};
  for (var i = 1; i < vs.length; i++) {
    var k = String(vs[i][0]);
    (byPoll[k] = byPoll[k] || []).push({ empId: String(vs[i][1]), name: vs[i][2], choice: JSON.parse(vs[i][3] || '[]'), time: String(vs[i][4]) });
  }
  var out = [];
  for (var r = ps.length - 1; r >= 1; r--) {
    var row = ps[r], id = String(row[0]); if (!id) continue;
    var opts = JSON.parse(row[3] || '[]'), votes = byPoll[id] || [];
    var dl = row[5] instanceof Date ? Utilities.formatDate(row[5], 'Asia/Taipei', 'yyyy-MM-dd') : String(row[5] || '');
    var status = poll_status_(String(row[6]), dl);
    var mine = null, counts = opts.map(function () { return 0; });
    votes.forEach(function (v) {
      if (v.empId === empId) mine = v.choice;
      v.choice.forEach(function (c) { if (counts[c] !== undefined) counts[c]++; });
    });
    var showResult = admin || mine !== null || status === '已關閉';
    var o = { id: id, title: row[1], desc: row[2], options: opts, multi: row[4] === true || row[4] === 'TRUE' || row[4] === '是',
              deadline: dl, status: status, creator: row[8], createdAt: String(row[9]),
              myChoice: mine, voterCount: votes.length, counts: showResult ? counts : null };
    if (admin) o.voters = votes;   // 記名：只有管理員拿得到「誰投什麼」
    out.push(o);
  }
  return { success: true, data: out, isAdmin: admin };
}

function poll_create_(p) {
  if (!poll_isAdmin_(p.empId)) return { error: '只有管理員(Lv.3)可以發起投票' };
  var title = String(p.title || '').trim(), opts = (p.options || []).map(function (s) { return String(s).trim(); }).filter(String);
  if (!title) return { error: '請輸入投票標題' };
  if (opts.length < 2) return { error: '至少需要 2 個選項' };
  if (opts.length > 12) return { error: '選項最多 12 個' };
  var id = 'P' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss');
  poll_sheet_('投票', POLL_HEAD).appendRow([id, title, String(p.desc || ''), JSON.stringify(opts), p.multi ? '是' : '否',
    String(p.deadline || ''), '進行中', String(p.empId), String(p.name || ''), poll_now_()]);
  return { success: true, id: id };
}

function poll_vote_(p) {
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var empId = String(p.empId || ''); if (!empId) return { error: '未登入' };
    var psh = poll_sheet_('投票', POLL_HEAD), pv = psh.getDataRange().getValues(), poll = null;
    for (var i = 1; i < pv.length; i++) if (String(pv[i][0]) === String(p.pollId)) { poll = pv[i]; break; }
    if (!poll) return { error: '找不到這個投票' };
    var dl = poll[5] instanceof Date ? Utilities.formatDate(poll[5], 'Asia/Taipei', 'yyyy-MM-dd') : String(poll[5] || '');
    if (poll_status_(String(poll[6]), dl) !== '進行中') return { error: '這個投票已結束' };
    var opts = JSON.parse(poll[3] || '[]'), multi = poll[4] === '是' || poll[4] === true;
    var ch = (p.choice || []).map(Number).filter(function (n, k, a) { return n >= 0 && n < opts.length && a.indexOf(n) === k; });
    if (ch.length === 0) return { error: '請至少選一個選項' };
    if (!multi && ch.length > 1) return { error: '此投票為單選' };
    var vsh = poll_sheet_('投票紀錄', VOTE_HEAD), vv = vsh.getDataRange().getValues();
    for (var r = 1; r < vv.length; r++) {
      if (String(vv[r][0]) === String(p.pollId) && String(vv[r][1]) === empId) {   // 已投過 → 改票
        vsh.getRange(r + 1, 3, 1, 3).setValues([[String(p.name || ''), JSON.stringify(ch), poll_now_()]]);
        return { success: true, changed: true };
      }
    }
    vsh.appendRow([String(p.pollId), empId, String(p.name || ''), JSON.stringify(ch), poll_now_()]);
    return { success: true };
  } finally { lock.releaseLock(); }
}

function poll_close_(p) {
  if (!poll_isAdmin_(p.empId)) return { error: '只有管理員(Lv.3)可以結束投票' };
  var sh = poll_sheet_('投票', POLL_HEAD), v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]) === String(p.pollId)) { sh.getRange(i + 1, 7).setValue('已關閉'); return { success: true }; }
  return { error: '找不到這個投票' };
}

function pollHandler_(action, p) {
  p = p || {};
  try {
    if (action === 'getPolls')   return poll_list_(p);
    if (action === 'createPoll') return poll_create_(p);
    if (action === 'votePoll')   return poll_vote_(p);
    if (action === 'closePoll')  return poll_close_(p);
  } catch (e) { return { error: '投票功能錯誤:' + e.message }; }
  return null;
}

// ── 宇宙辦公室 · 缺貨看板（2026-11-09，改用 SHEET_ID 開啟試算表）──
var UO_SHEET = '缺貨看板';
var UO_HEADERS = ['編號', '登記時間', '櫃位', '品項', '登記人編號', '登記人', '狀態', '補齊時間', '補齊人'];

function uo_sheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName(UO_SHEET);
  if (!sh) {
    sh = ss.insertSheet(UO_SHEET);
    sh.getRange(1, 1, 1, UO_HEADERS.length).setValues([UO_HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function uo_getShortages() {
  var sh = uo_sheet_();
  var last = sh.getLastRow();
  if (last < 2) return { success: true, data: [] };
  var rows = sh.getRange(2, 1, last - 1, UO_HEADERS.length).getValues();
  var data = rows
    .filter(function (r) { return r[0] && r[6] !== '已補齊'; })
    .map(function (r) {
      return { id: String(r[0]), time: r[1] instanceof Date ? r[1].toISOString() : String(r[1]),
               location: String(r[2]), item: String(r[3]), by: String(r[5]) };
    });
  return { success: true, data: data };
}

function uo_addShortage(d) {
  if (!d.location || !d.item) return { success: false, error: '缺少櫃位或品項' };
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var sh = uo_sheet_();
    var open = uo_getShortages().data.filter(function (x) { return x.location === d.location && x.item === d.item; })[0];
    if (open) return { success: true, id: open.id, duplicate: true };
    var id = 'S' + new Date().getTime();
    sh.appendRow([id, new Date(), d.location, d.item, d.empId || '', d.name || '', '未補齊', '', '']);
    return { success: true, id: id };
  } finally { lock.releaseLock(); }
}

function uo_resolveShortage(d) {
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var sh = uo_sheet_();
    var last = sh.getLastRow();
    if (last < 2) return { success: false, error: '找不到這筆缺貨' };
    var ids = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(d.id)) {
        sh.getRange(i + 2, 7, 1, 3).setValues([['已補齊', new Date(), d.name || d.empId || '']]);
        return { success: true };
      }
    }
    return { success: false, error: '找不到這筆缺貨' };
  } finally { lock.releaseLock(); }
}

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

// ═══════════════════════════════════════════════
// 修改密碼 後端模組 v2(2026-11-10,對齊現有後端:SHEET_ID、extHandler_ 路由)
// 貼在「程式碼.gs」最底部;再於 extHandler_ 內加 2 行(見最下方)。
// 密碼欄位:優先找夥伴資料表頭為「密碼」的欄,找不到時用第 37 欄(AK,與登入相同)。
// ═══════════════════════════════════════════════
function pw_change_(p) {
  var empId = String(p.empId || '').trim();
  var oldPw = String(p.oldPassword || '').trim();
  var newPw = String(p.newPassword || '').trim();
  if (!empId || !oldPw || !newPw) return { error: '資料不完整' };
  if (newPw.length < 6 || newPw.length > 20 || /\s/.test(newPw)) return { error: '新密碼需為 6 到 20 個字元，且不可有空白' };
  if (newPw === oldPw) return { error: '新密碼不能與目前密碼相同' };

  // 防暴力猜測:同一員工 10 分鐘內目前密碼錯 5 次就先鎖住
  var cache = CacheService.getScriptCache(), key = 'pwfail_' + empId;
  var fails = Number(cache.get(key) || 0);
  if (fails >= 5) return { error: '嘗試次數過多，請 10 分鐘後再試，或聯絡門市總監' };

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('夥伴資料');
    var v = sh.getDataRange().getValues(), h = v[0];
    var pwC = 36;                                   // 預設第 37 欄(與登入一致)
    for (var i = 0; i < h.length; i++) {
      var t = String(h[i]).trim();
      if (t === '密碼' || t === '登入密碼') { pwC = i; break; }
    }
    for (var r = 1; r < v.length; r++) {
      if (String(v[r][0]).trim() !== empId) continue;          // 員工編號在 A 欄(與登入回傳的 id 一致)
      if (String(v[r][pwC] || '').trim() !== oldPw) {
        cache.put(key, String(fails + 1), 600);
        return { error: '目前密碼不正確' };
      }
      var cell = sh.getRange(r + 1, pwC + 1);
      cell.setNumberFormat('@');                               // 存成文字,避免 000123 變成 123
      cell.setValue(newPw);
      cache.remove(key);
      return { success: true };
    }
    return { error: '找不到此帳號' };
  } finally {
    lock.releaseLock();
  }
}

function pwHandler_(action, p) {
  try {
    if (action === 'changePassword') return pw_change_(p || {});
  } catch (e) { return { error: '修改密碼失敗:' + e.message }; }
  return null;
}

// 路由:在 extHandler_ 內、`var pr = pollHandler_(action, p); if (pr) return pr;` 的下一行,加入:
//   var pw = pwHandler_(action, p); if (pw) return pw;
// (extHandler_ 在 doGet / doPost 開頭都會先被呼叫;前端用 POST 送出,密碼不會出現在網址)

// ═══════════════════════════════════════════════
// 角色造型(紙娃娃)後端模組 v3(2026-11-10:新增配件 acc、服裝 outfit、名牌框 frame 與商店物品擁有檢查)。v2(2026-11-10,新增「頭頂一句話」;v1 已部署者,整段覆蓋即可)
// 貼在「程式碼.gs」最底部;再於 extHandler_ 內加 1 行(見最下方)。
// 會自動建立兩張工作表(第一次使用時):
//   「角色造型」 A 員工編號 · B 造型設定(JSON) · C 更新時間
//   「造型道具」 A 員工編號 · B 道具 id · C 發放者 · D 發放時間   ← 想收回限定款,直接刪掉那一列
// 限定款清單 LIMITED_ITEMS 要與前端 avatarCatalog.js 裡 kind:"limited" 的帽子 id 一致。
// ═══════════════════════════════════════════════
var AV_LIMITED_ITEMS = ['crown', 'goldchef'];
var AV_ALLOWED = {
  skin: ['s1','s2','s3','s4','s5'],
  hairStyle: ['short','ponytail','bob','long','bun','buzz'],
  hairColor: ['black','dbrown','brown','chestnut','blonde','red','pink','blue','hc_mint','hc_purple','hc_silver'],
  top: ['ruby','white','navy','matcha','pink','yellow','black','orange'],
  pants: ['gray','black','jeans','khaki'],
  face: ['none','glasses','sunglasses','mask'],
  hat: ['none','cap','chef','beanie','santa','pumpkin','crown','goldchef','g_antenna','g_helmet','g_ufo'],
  mascot: ['none','trex','penguin'],
  // v3 新增(赤心幣商店/扭蛋):要先擁有才能穿,擁有清單在「擁有物品」(宇宙遊戲化模組)
  acc: ['none','bowtie','scarf','backpack','wings','cape','halo','g_starclip','g_moonpin','g_rocket','g_galaxy','g_saturn'],
  outfit: ['none','raincoat','chefsuit','spacesuit','goldtrex'],
  frame: ['none','frame_wood','frame_glow']
};
var AV_DEFAULTS_ = { hairColor: 'dbrown', hat: 'none', acc: 'none', outfit: 'none', frame: 'none' };
// 商店／扭蛋物品:沒擁有就不能穿(回傳第一個沒擁有的物品編號;都有則回傳空字串)
function av_unowned_(empId, c, owned) {
  if (typeof gm_catalog_ !== 'function') return '';
  var cat = gm_catalog_(); owned = owned || gm_owned_(empId);
  var keys = ['hairColor', 'hat', 'acc', 'outfit', 'frame'];
  for (var i = 0; i < keys.length; i++) { var v = c[keys[i]]; if (v && cat[v] && !owned[v]) return v; }
  return '';
}
function av_stripUnowned_(empId, c, owned) {
  if (typeof gm_catalog_ !== 'function') return c;
  var cat = gm_catalog_();
  ['hairColor', 'hat', 'acc', 'outfit', 'frame'].forEach(function (k) { var v = c[k]; if (v && cat[v] && !owned[v]) c[k] = AV_DEFAULTS_[k]; });
  return c;
}

function av_sheet_(name, headers) {
  var ss = SpreadsheetApp.openById(SHEET_ID), sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(headers); sh.setFrozenRows(1); }
  return sh;
}
function av_grantedMap_() {            // empId → [item,...]
  var v = av_sheet_('造型道具', ['員工編號', '道具', '發放者', '發放時間']).getDataRange().getValues(), m = {};
  for (var i = 1; i < v.length; i++) {
    var id = String(v[i][0]).trim(), it = String(v[i][1]).trim();
    if (id && it) (m[id] = m[id] || []).push(it);
  }
  return m;
}
function av_clean_(raw) {              // 只留合法欄位與值
  var c = {};
  try { c = typeof raw === 'string' ? JSON.parse(raw) : (raw || {}); } catch (e) { c = {}; }
  var out = {};
  Object.keys(AV_ALLOWED).forEach(function (k) { if (AV_ALLOWED[k].indexOf(c[k]) >= 0) out[k] = c[k]; });
  out.apron = c.apron === false ? false : true;
  // 頭頂一句話:去控制字元與 < >,最多 24 字(前端用 textContent 顯示,不會執行任何程式)
  out.saying = String(c.saying == null ? '' : c.saying).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 24);
  return out;
}
function av_empExists_(empId) {
  var v = SpreadsheetApp.openById(SHEET_ID).getSheetByName('夥伴資料').getDataRange().getValues();
  for (var r = 1; r < v.length; r++) if (String(v[r][0]).trim() === empId) return v[r];
  return null;
}

// 全員造型(宇宙辦公室用)。限定款沒被發放的人,這裡會自動拿掉帽子。
function av_getAll_() {
  var cache = CacheService.getScriptCache(), hit = cache.get('av_all');
  if (hit) return { success: true, data: JSON.parse(hit) };
  var v = av_sheet_('角色造型', ['員工編號', '造型設定', '更新時間']).getDataRange().getValues(), g = av_grantedMap_(), out = {};
  var ownAll = null;
  if (typeof gm_rows_ === 'function') { GM_CACHE_ = {}; ownAll = {}; gm_rows_('owned').forEach(function (r) { (ownAll[r[0]] = ownAll[r[0]] || {})[r[1]] = 1; }); }
  for (var i = 1; i < v.length; i++) {
    var id = String(v[i][0]).trim(); if (!id) continue;
    var c = av_clean_(v[i][1]);
    if (AV_LIMITED_ITEMS.indexOf(c.hat) >= 0 && (g[id] || []).indexOf(c.hat) < 0) c.hat = 'none';
    if (ownAll) c = av_stripUnowned_(id, c, ownAll[id] || {});
    out[id] = c;
  }
  var s = JSON.stringify(out); if (s.length < 90000) cache.put('av_all', s, 60);
  return { success: true, data: out };
}
function av_getMy_(p) {
  var empId = String(p.empId || '').trim(); if (!empId) return { error: '缺少員工編號' };
  var v = av_sheet_('角色造型', ['員工編號', '造型設定', '更新時間']).getDataRange().getValues(), cfg = null;
  for (var i = 1; i < v.length; i++) if (String(v[i][0]).trim() === empId) { cfg = av_clean_(v[i][1]); break; }
  return { success: true, data: { cfg: cfg, granted: av_grantedMap_()[empId] || [] } };
}
function av_save_(p) {
  var empId = String(p.empId || '').trim(); if (!empId) return { error: '缺少員工編號' };
  if (!av_empExists_(empId)) return { error: '找不到此帳號' };
  var c = av_clean_(p.cfg);
  if (AV_LIMITED_ITEMS.indexOf(c.hat) >= 0 && (av_grantedMap_()[empId] || []).indexOf(c.hat) < 0) return { error: '這個造型尚未解鎖' };
  var un = av_unowned_(empId, c);
  if (un) return { error: '還沒擁有「' + ((gm_catalog_()[un] || {}).name || un) + '」' };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = av_sheet_('角色造型', ['員工編號', '造型設定', '更新時間']), v = sh.getDataRange().getValues(), now = new Date();
    for (var r = 1; r < v.length; r++) if (String(v[r][0]).trim() === empId) {
      sh.getRange(r + 1, 2, 1, 2).setValues([[JSON.stringify(c), now]]);
      CacheService.getScriptCache().remove('av_all'); return { success: true };
    }
    var row = sh.getLastRow() + 1;
    sh.getRange(row, 1).setNumberFormat('@').setValue(empId);
    sh.getRange(row, 2, 1, 2).setValues([[JSON.stringify(c), now]]);
    CacheService.getScriptCache().remove('av_all'); return { success: true };
  } finally { lock.releaseLock(); }
}
function av_grant_(p) {                // 管理者發放限定款
  var empId = String(p.empId || '').trim(), target = String(p.target || '').trim(), item = String(p.item || '').trim();
  if (!empId || !target || !item) return { error: '資料不完整' };
  if (AV_LIMITED_ITEMS.indexOf(item) < 0) return { error: '不是限定款' };
  var me = av_empExists_(empId), role = me ? me[12] : '';
  if (!(Number(role) >= 3 || /管理/.test(String(role)))) return { error: '只有管理者可以發放' };   // 夥伴資料第 13 欄為角色
  if (!av_empExists_(target)) return { error: '找不到員工編號 ' + target };
  if ((av_grantedMap_()[target] || []).indexOf(item) >= 0) return { success: true };
  av_sheet_('造型道具', ['員工編號', '道具', '發放者', '發放時間']).appendRow([target, item, empId, new Date()]);
  CacheService.getScriptCache().remove('av_all');
  return { success: true };
}

function avHandler_(action, p) {
  try {
    if (action === 'getAvatars') return av_getAll_();
    if (action === 'getMyAvatar') return av_getMy_(p || {});
    if (action === 'saveAvatar') return av_save_(p || {});
    if (action === 'grantItem') return av_grant_(p || {});
  } catch (e) { return { error: '造型功能發生錯誤:' + e.message }; }
  return null;
}

// 路由:在 extHandler_ 內、pollHandler_ / pwHandler_ 那幾行的下一行,加入:
//   var av = avHandler_(action, p); if (av) return av;


// ═══════════════════════════════════════════════
// 宇宙辦公室 · 在班名單 v1.14(2026-11-10)
// 一次讀「打卡紀錄」算出今天所有在班夥伴(判斷方式同 getActiveSegment),全員可用。
// 只回傳 員工編號、姓名、櫃位、上班時間。
// ═══════════════════════════════════════════════
function uo_onDutyCrew_(p) {
  var date = String((p && p.date) || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var staff = ss.getSheetByName('夥伴資料').getDataRange().getValues(), names = {};
  for (var s = 1; s < staff.length; s++) {
    if (!staff[s][0] || staff[s][10]) continue;          // 跳過離職
    names[String(staff[s][0])] = String(staff[s][1] || '');
  }
  var punch = ss.getSheetByName('打卡紀錄').getDataRange().getValues(), byEmp = {};
  for (var i = 1; i < punch.length; i++) {
    var r = punch[i], id = String(r[2]);
    if (!names.hasOwnProperty(id) || dateNorm(r[1]) !== date) continue;
    (byEmp[id] = byEmp[id] || []).push({ type: String(r[5]), time: r[6] ? new Date(r[6]) : null, loc: String(r[9] || '') });
  }
  var out = [];
  Object.keys(byEmp).forEach(function (id) {
    var rows = byEmp[id].sort(function (a, b) { return (a.time && b.time) ? a.time - b.time : 0; }), open = null;
    rows.forEach(function (x) {
      if (x.type === '上班') { if (!open) open = { location: x.loc, inTime: x.time }; }
      else if (x.type === '下班') { if (open && open.location === x.loc) open = null; }
    });
    if (open && open.location) out.push({ id: id, name: names[id], location: open.location, inTime: open.inTime ? open.inTime.toISOString() : null });
  });
  return { success: true, data: out };
}

// ═══════════════════════════════════════════════
// 訂單系統 後端模組 v1(2026-11-10)
// 貼在「程式碼.gs」最底部;再於 extHandler_ 內加 1 行(見最下方)。
// 第一次使用時自動建立工作表「訂單」(一單一列)。日期、時間一律存成文字,避免試算表自動轉格式。
// 權限:所有夥伴都能建單、改單、看單;金額欄位所有人可填。每筆自動記錄最後修改人與時間。
// 隱私:已交付／已取消超過 3 天的單,一般夥伴看到的電話與統編會隱藏(分隊長、管理者仍可看)。
// ═══════════════════════════════════════════════
var OD_HEAD = ['訂單編號','櫃位','日期','時間','訂單內容(JSON)','其他內容','預計製作(分)','取貨方式','地點','外送時間','外送方式','外送人員/平台',
               '客戶姓名','電話','統編','注意事項','狀態','總金額','訂金','付款狀態','建單人ID','建單人','建單時間','最後修改人','最後修改時間'];
var OD_STATUS = ['新訂單','製作中','已完成','已交付','已取消'];
var OD_PAY = ['未付款','已付訂金','已付清'];

function od_sheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID), sh = ss.getSheetByName('訂單');
  if (!sh) { sh = ss.insertSheet('訂單'); sh.appendRow(OD_HEAD); sh.setFrozenRows(1); }
  return sh;
}
function od_emp_(empId) {
  var v = SpreadsheetApp.openById(SHEET_ID).getSheetByName('夥伴資料').getDataRange().getValues();
  for (var r = 1; r < v.length; r++) if (String(v[r][0]).trim() === empId) return { name: String(v[r][1] || ''), role: v[r][12] };
  return null;
}
function od_isLead_(role) { return Number(role) >= 2 || /分隊|管理/.test(String(role)); }
function od_now_() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm'); }
function od_str_(v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/g, ' ').trim().slice(0, n); }
function od_num_(v) { var n = Number(String(v == null ? '' : v).replace(/[, ]/g, '')); return isFinite(n) && n >= 0 ? n : 0; }

function od_rowToObj_(r, canSeePrivate) {
  var items = []; try { items = JSON.parse(r[4] || '[]'); } catch (e) {}
  var hide = !canSeePrivate && (r[16] === '已交付' || r[16] === '已取消') &&
             (new Date().getTime() - new Date(String(r[24] || r[22]).replace(' ', 'T') + ':00+08:00').getTime()) > 3 * 86400000;
  return { id: r[0], loc: r[1], date: String(r[2]), time: String(r[3]), items: items, extra: r[5], prep: Number(r[6]) || 0,
    method: r[7], place: r[8], sendTime: String(r[9] || ''), sendBy: r[10], carrier: r[11],
    cname: r[12], phone: hide && r[13] ? '(已隱藏)' : String(r[13] || ''), taxId: hide && r[14] ? '(已隱藏)' : String(r[14] || ''),
    notes: r[15], status: r[16], total: Number(r[17]) || 0, deposit: Number(r[18]) || 0, pay: r[19] || '未付款',
    byId: r[20], byName: r[21], created: String(r[22]), modName: r[23], modTime: String(r[24]) };
}

function od_get_(p) {
  var emp = od_emp_(String(p.empId || '').trim()); if (!emp) return { error: '找不到此帳號' };
  var today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
  var from = /^\d{4}-\d{2}-\d{2}$/.test(p.from || '') ? p.from : today;
  var to = /^\d{4}-\d{2}-\d{2}$/.test(p.to || '') ? p.to : Utilities.formatDate(new Date(Date.now() + 14 * 86400000), 'Asia/Taipei', 'yyyy-MM-dd');
  var back = Utilities.formatDate(new Date(Date.now() - 30 * 86400000), 'Asia/Taipei', 'yyyy-MM-dd');
  var v = od_sheet_().getDataRange().getValues(), out = [], lead = od_isLead_(emp.role);
  for (var i = 1; i < v.length; i++) {
    var d = String(v[i][2]), st = v[i][16];
    var open = st === '新訂單' || st === '製作中' || st === '已完成';
    if ((d >= from && d <= to) || (open && d < from && d >= back)) out.push(od_rowToObj_(v[i], lead));
  }
  out.sort(function (a, b) { return (a.date + a.time) < (b.date + b.time) ? -1 : 1; });
  return { success: true, data: out };
}

function od_clean_(o, old) {
  o = typeof o === 'string' ? JSON.parse(o) : (o || {});
  var e = null;
  var loc = od_str_(o.loc, 40), date = od_str_(o.date, 10), time = od_str_(o.time, 5);
  if (!loc) return { error: '請選擇櫃位' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: '日期格式不正確' };
  if (!/^\d{2}:\d{2}$/.test(time)) return { error: '請填取貨/送達時間' };
  var items = [];
  (Array.isArray(o.items) ? o.items : []).slice(0, 30).forEach(function (it) {
    var nm = od_str_(it && it.name, 30), q = Math.min(999, Math.max(0, Math.round(Number(it && it.qty) || 0)));
    if (nm && q > 0) items.push({ name: nm, qty: q });
  });
  var extra = od_str_(o.extra, 500);
  if (!items.length && !extra) return { error: '請填寫訂單內容' };
  var method = o.method === '外送' ? '外送' : '自取';
  var cname = od_str_(o.cname, 30);
  if (!cname) return { error: '請填客戶姓名' };
  var phone = od_str_(o.phone, 20).replace(/[^\d+\-() ]/g, '');
  var taxId = od_str_(o.taxId, 8);
  if (taxId && !/^\d{8}$/.test(taxId)) return { error: '統編需為 8 碼數字' };
  var place = od_str_(o.place, 120), sendTime = od_str_(o.sendTime, 5);
  if (method === '外送') {
    if (!place) return { error: '請填外送地址' };
    if (!/^\d{2}:\d{2}$/.test(sendTime)) return { error: '請填外送時間' };
  } else sendTime = '';
  var st = OD_STATUS.indexOf(o.status) >= 0 ? o.status : (old ? old.status : '新訂單');
  var pay = OD_PAY.indexOf(o.pay) >= 0 ? o.pay : '未付款';
  return { ok: { loc: loc, date: date, time: time, items: items, extra: extra, prep: Math.min(1440, Math.round(od_num_(o.prep))),
    method: method, place: place, sendTime: sendTime, sendBy: method === '外送' ? (o.sendBy === '外送平台' ? '外送平台' : '自己送') : '',
    carrier: method === '外送' ? od_str_(o.carrier, 40) : '', cname: cname, phone: phone, taxId: taxId, notes: od_str_(o.notes, 500),
    status: st, total: od_num_(o.total), deposit: od_num_(o.deposit), pay: pay } };
}

function od_save_(p) {
  var empId = String(p.empId || '').trim(), emp = od_emp_(empId); if (!emp) return { error: '找不到此帳號' };
  var id = od_str_((typeof p.order === 'string' ? JSON.parse(p.order) : (p.order || {})).id, 30);
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = od_sheet_(), v = sh.getDataRange().getValues(), now = od_now_(), rowIdx = -1;
    if (id) for (var r = 1; r < v.length; r++) if (v[r][0] === id) { rowIdx = r; break; }
    if (id && rowIdx < 0) return { error: '找不到這筆訂單' };
    var c = od_clean_(p.order, rowIdx >= 0 ? { status: v[rowIdx][16] } : null); if (c.error) return c;
    var o = c.ok, row, created = now, byId = empId, byName = emp.name;
    if (rowIdx >= 0) { created = v[rowIdx][22]; byId = v[rowIdx][20]; byName = v[rowIdx][21]; }
    else {
      var pre = 'O' + now.slice(0, 10).replace(/-/g, '') + '-', n = 0;
      for (var i = 1; i < v.length; i++) if (String(v[i][0]).indexOf(pre) === 0) n++;
      id = pre + ('00' + (n + 1)).slice(-3);
    }
    row = [id, o.loc, o.date, o.time, JSON.stringify(o.items), o.extra, o.prep, o.method, o.place, o.sendTime, o.sendBy, o.carrier,
           o.cname, o.phone, o.taxId, o.notes, o.status, o.total, o.deposit, o.pay, byId, byName, created, emp.name, now];
    var target = rowIdx >= 0 ? rowIdx + 1 : sh.getLastRow() + 1;
    var rng = sh.getRange(target, 1, 1, OD_HEAD.length);
    rng.setNumberFormat('@');                    // 全部存成文字(電話開頭 0、統編、日期不被轉換)
    rng.setValues([row]);
    return { success: true, data: od_rowToObj_(row, true) };
  } finally { lock.releaseLock(); }
}

function od_status_(p) {
  var empId = String(p.empId || '').trim(), emp = od_emp_(empId); if (!emp) return { error: '找不到此帳號' };
  var id = od_str_(p.id, 30), st = String(p.status || '');
  if (OD_STATUS.indexOf(st) < 0) return { error: '狀態不正確' };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = od_sheet_(), v = sh.getDataRange().getValues();
    for (var r = 1; r < v.length; r++) if (v[r][0] === id) {
      var rng = sh.getRange(r + 1, 17); rng.setNumberFormat('@'); rng.setValue(st);
      var m = sh.getRange(r + 1, 24, 1, 2); m.setNumberFormat('@'); m.setValues([[emp.name, od_now_()]]);
      return { success: true };
    }
    return { error: '找不到這筆訂單' };
  } finally { lock.releaseLock(); }
}

function odHandler_(action, p) {
  try {
    if (action === 'getOrders') return od_get_(p || {});
    if (action === 'saveOrder') return od_save_(p || {});
    if (action === 'setOrderStatus') return od_status_(p || {});
  } catch (e) { return { error: '訂單功能發生錯誤:' + e.message }; }
  return null;
}

// 路由:在 extHandler_ 內、avHandler_ 那行的下一行,加入:
//   var od = odHandler_(action, p); if (od) return od;

// ═══════════════════════════════════════════════
// 各店剩餘麵糊(管理儀表板用)後端模組 v1(2026-11-10)
// 資料來源:夥伴下班「收店盤點」(closeStore)寫入的那張工作表,取每個櫃位「最新一筆」的四種口味剩餘包數。
// 部署後可開 …workers.dev/?action=getBatterStock&debug=1 檢查兩張表各用了哪些欄位。
// ═══════════════════════════════════════════════
// 實際試算表(11/10 確認):「收店盤點」(目前空白、沒有標題列)與「收店盤點_歷史」(有標題列)。
// 欄位:A 紀錄編號、B 日期、C 班表編號、D 員工編號、E 姓名、F 櫃位、G~J 原味/可可/紅玉/抹茶剩餘(包)、…、W~Z 原味/可可/紅玉/抹茶進貨(包)
// 兩張表都讀,每個櫃位取最新一筆。有標題列就依標題找欄位;沒有標題列就用下面 BT_FIXED 的固定欄位(從 0 起算)。
var BT_SHEETS = ['收店盤點', '收店盤點_歷史'];
var BT_FIXED = { date: 1, name: 4, loc: 5, original: 6, cocoa: 7, ruby: 8, matcha: 9,
                 rsOriginal: 22, rsCocoa: 23, rsRuby: 24, rsMatcha: 25 };
var BT_CFG = { cols: {} };   // 若標題文字改了,可在這裡指定,例:{ cols: { loc: '櫃位' } }
var BT_FLAVORS = [['original', '原味'], ['cocoa', '可可'], ['ruby', '紅玉'], ['matcha', '抹茶']];
var BT_EN = { original: 'original', cocoa: 'cocoa', ruby: 'ruby', matcha: 'matcha' };

function bt_findCol_(head, want, rx) {
  if (want) return head.indexOf(want);
  for (var c = 0; c < head.length; c++) if (rx.test(head[c])) return c;
  return -1;
}
function bt_map_(head) {
  var k = BT_CFG.cols, m = {};
  m.date = bt_findCol_(head, k.date, /^(日期|date)$|日期/i);
  m.loc = bt_findCol_(head, k.loc, /櫃位|地點|location|店/i);
  m.name = bt_findCol_(head, k.name, /姓名|夥伴|name|回報/i);
  BT_FLAVORS.forEach(function (f) {
    var key = f[0], zh = '(?:' + f[1] + '|' + BT_EN[f[0]] + ')', rk = 'rs' + key.charAt(0).toUpperCase() + key.slice(1);
    // 剩餘:含口味且含「剩」(或 rem);排除「進貨/補貨」
    m[key] = bt_findCol_(head, k[key], new RegExp('^(?!.*(進貨|補貨|rs)).*(' + zh + '.*(剩|rem)|(剩|rem).*' + zh + ')', 'i'));
    m[rk] = bt_findCol_(head, k[rk], new RegExp('(' + zh + '.*(進貨|補貨)|(進貨|補貨).*' + zh + ')'));
  });
  return m;
}
function bt_sources_() {          // → [{ sh, m, start }]
  var ss = SpreadsheetApp.openById(SHEET_ID), out = [];
  BT_SHEETS.forEach(function (n) {
    var sh = ss.getSheetByName(n); if (!sh || sh.getLastRow() < 1) return;
    var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0].map(function (x) { return String(x).trim(); });
    var m = bt_map_(head);
    var hasHead = m.date >= 0 && m.loc >= 0 && m.original >= 0 && m.cocoa >= 0 && m.ruby >= 0 && m.matcha >= 0;
    out.push({ sh: sh, head: hasHead ? head : null, m: hasHead ? m : BT_FIXED, start: hasHead ? 1 : 0 });
  });
  return out;
}
function bt_dateStr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Taipei', 'yyyy-MM-dd');
  var s = String(v || '').trim().replace(/\//g, '-'), mm = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  return mm ? mm[1] + '-' + ('0' + mm[2]).slice(-2) + '-' + ('0' + mm[3]).slice(-2) : s;
}
function bt_num_(v) { var n = Number(String(v == null ? '' : v).replace(/[^\d.\-]/g, '')); return String(v).trim() === '' || !isFinite(n) ? null : n; }

function bt_get_(p) {
  var src = bt_sources_();
  if (p && String(p.debug) === '1') {
    return { success: true, sources: src.map(function (s) {
      return { sheet: s.sh.getName(), rows: s.sh.getLastRow(), mode: s.head ? '依標題' : '固定欄位(無標題列)',
               columns: Object.keys(s.m).reduce(function (o, k) { o[k] = s.m[k] < 0 ? '(找不到)' : s.head ? s.head[s.m[k]] : '第 ' + (s.m[k] + 1) + ' 欄'; return o; }, {}) };
    }) };
  }
  var latest = {};
  src.forEach(function (s) {
    var v = s.sh.getDataRange().getValues(), m = s.m;
    for (var r = s.start; r < v.length; r++) {
      var loc = String(v[r][m.loc] || '').trim(); if (!loc) continue;
      var d = bt_dateStr_(v[r][m.date]); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
      var rec = { loc: loc, date: d, by: m.name >= 0 ? String(v[r][m.name] || '') : '', rem: {}, restock: {} }, any = false;
      BT_FLAVORS.forEach(function (fl) {
        var k = fl[0], rk = 'rs' + k.charAt(0).toUpperCase() + k.slice(1);
        rec.rem[fl[1]] = bt_num_(v[r][m[k]]); if (rec.rem[fl[1]] !== null) any = true;
        rec.restock[fl[1]] = m[rk] >= 0 ? bt_num_(v[r][m[rk]]) : null;
      });
      if (!any) continue;                                            // 只交接零用金、沒盤點的列略過
      if (!latest[loc] || d >= latest[loc].date) latest[loc] = rec;  // 同日多筆取後面那筆
    }
  });
  var out = Object.keys(latest).map(function (k) { return latest[k]; });
  out.sort(function (a, b) { return a.loc < b.loc ? -1 : 1; });
  return { success: true, data: out };
}

function btHandler_(action, p) {
  try { if (action === 'getBatterStock') return bt_get_(p || {}); }
  catch (e) { return { error: '剩餘麵糊讀取錯誤:' + e.message }; }
  return null;
}
// 路由:在 extHandler_ 內加一行:  var bt = btHandler_(action, p); if (bt) return bt;

// ═══════════════════════════════════════════════════════════════
// 紅玉滿宇宙 遊戲化模組 v1.19(2026-11-11:寵物改版)
// v1.19 更新步驟:整份取代舊的遊戲化模組後,在編輯器執行一次 gm_setup()(補新工作表與新欄位、新參數)。
// 赤心幣、服裝商店、扭蛋、寵物、成就徽章、互動、每日一題、生日、團隊基金、冠軍櫃位、月結。
// 安裝:
//   1. 貼到 Apps Script 最底部。
//   2. extHandler_ 內加一行: var gm = gmHandler_(action, p); if (gm) return gm;
//   3. 在編輯器執行一次 gm_installTriggers()(建立每日 03:10 的自動結算),第一次會要求授權。
//   4. 執行一次 gm_setup()(建立所有工作表、填入預設參數、商品目錄、題庫範本)。
// 所有數值都在「遊戲參數」工作表,改了立即生效。
// 寫法:ES5(不用箭頭函式),相容舊版 Apps Script。
// ═══════════════════════════════════════════════════════════════

var GM_SHEETS = {
  ledger:  ['赤心幣流水帳', ['時間', '員工編號', '類型', '數量', '說明', '來源鍵']],
  params:  ['遊戲參數', ['參數名', '數值', '說明']],
  catalog: ['商品目錄', ['物品編號', '名稱', '分類', '等級', '價格', '上架', '扭蛋系列', '說明']],
  owned:   ['擁有物品', ['員工編號', '物品編號', '取得方式', '時間']],
  badges:  ['徽章紀錄', ['員工編號', '徽章編號', '期別', '取得時間', '配戴']],
  inter:   ['互動紀錄', ['時間', '日期', '送出人', '接收人', '類型', '已讀']],
  quiz:    ['題庫', ['題號', '分類', '題目', 'A', 'B', 'C', 'D', '正解', '解說', '啟用']],
  answers: ['答題紀錄', ['日期', '員工編號', '題號', '作答', '對錯', '時間']],
  fund:    ['團隊基金', ['時間', '員工編號', '數量']],
  pets:    ['寵物', ['員工編號', '口味', '名字', '購買日期', '配戴配件', '加成小時', '遊戲加命', '型態', '狀態', '寵物編號', '孵化日']],
  album:   ['寵物相簿', ['員工編號', '寵物編號', '階段', '型態', '口味', '日期', '累積工時']],
  diary:   ['寵物日記', ['員工編號', '週別', '內容', '時間']],
  trades:  ['寵物交換', ['編號', '發起人', '對象', '狀態', '建立時間', '處理時間']],
  petlog:  ['寵物動態', ['時間', '員工編號', '類型', '內容']],
  games:   ['小遊戲紀錄', ['時間', '日期', '員工編號', '遊戲', '分數', '獎勵']],
  hours:   ['工時日結', ['日期', '員工編號', '櫃位', '分鐘']],
  gacha:   ['扭蛋紀錄', ['時間', '員工編號', '物品編號', '等級', '重複退幣']],
  wishes:  ['生日祝福', ['日期', '壽星', '送出人', '時間']]
};

var GM_PARAM_DEFAULTS = [
  ['測試版開始日', '2026-11-16', '赤心幣從這天開始累積'],
  ['正式版開始日', '2026-12-01', '這天把餘額乘上加倍倍率(只做一次)'],
  ['正式版加倍倍率', 2, ''],
  ['工時倍率_1', 1, '權限等級 1 每小時幾枚'],
  ['工時倍率_2', 1.2, '權限等級 2(分隊長)'],
  ['工時倍率_3', 1.5, '權限等級 3(管理者)'],
  ['工時倍率_4', 1.5, '權限等級 4(總經理,預留)'],
  ['工時倍率_5', 1.5, '權限等級 5(大隊長)'],
  ['活動工時倍率', 2, '在活動場次(櫃位設定「場所性質」=活動,或 00 開頭)的工時加倍'],
  ['每日一題獎勵', 1, ''],
  ['連續答對7天加碼', 5, ''],
  ['互動之星獎勵', 200, '每月 1 日結算上月'],
  ['互動之星最低人數', 5, '送出＋收到的不同人數至少要這麼多'],
  ['冠軍櫃位總獎勵', 500, '依該櫃位當月上班時數比例分配'],
  ['壽星獎勵', 30, ''],
  ['送祝福獎勵', 1, '每天上限 3 次'],
  ['扭蛋價格', 50, ''],
  ['扭蛋每月上限', 5, ''],
  ['扭蛋機率_稀有', 25, '百分比'],
  ['扭蛋機率_傳說', 5, '百分比'],
  ['扭蛋保底次數', 10, '連續幾次沒中稀有以上,下一次必中'],
  ['扭蛋重複退幣', 20, ''],
  ['寵物價格', 0, 'v1.19 起寵物免費(此參數停用)'],
  ['寵物交換間隔天數', 30, '每人完成一次寵物交換後,隔幾天才能再換'],
  ['相剋傷害倍率', 1.2, '對戰時打被自己剋的型態,傷害乘上此數'],
  ['捐獻最低', 10, ''],
  ['單日營業額門檻', 20000, '「業績爆發」徽章:單日單店營業額達到此數'],
  ['基金解鎖', '500:lounge,1500:plants,3000:arcade,6000:station,10000:spectrum', '累積數:解鎖代號'],
  ['品牌週年日', '', 'MM-DD,待隊長確認'],
  ['小遊戲每日上限', 5, '小遊戲破紀錄獎勵,每天全部遊戲合計最多幾枚'],
  ['資歷門檻', '1080,2160,3240', '資歷徽章銅/銀/金的累計工時(小時);依「累計工時」表的「累計工時總計」']
];

// 商品:物品編號, 名稱, 分類(haircolor/acc/outfit/frame/hat/petacc), 等級, 價格, 上架(商店/扭蛋/否), 扭蛋系列, 說明
var GM_CATALOG_SEED = [
  ['hc_mint', '薄荷綠髮色', 'haircolor', '普通', 10, '商店', '', ''],
  ['hc_purple', '夢幻紫髮色', 'haircolor', '普通', 10, '商店', '', ''],
  ['hc_silver', '銀白髮色', 'haircolor', '普通', 15, '商店', '', ''],
  ['bowtie', '領結', 'acc', '普通', 10, '商店', '', ''],
  ['scarf', '圍巾', 'acc', '普通', 15, '商店', '', ''],
  ['backpack', '背包', 'acc', '普通', 25, '商店', '', ''],
  ['wings', '小翅膀', 'acc', '稀有', 80, '商店', '', ''],
  ['cape', '紅玉披風', 'acc', '傳說', 220, '商店', '', ''],
  ['halo', '光環', 'acc', '傳說', 300, '商店', '', ''],
  ['raincoat', '黃色雨衣', 'outfit', '稀有', 50, '商店', '', ''],
  ['chefsuit', '主廚服', 'outfit', '稀有', 60, '商店', '', ''],
  ['spacesuit', '太空服', 'outfit', '稀有', 100, '商店', '', ''],
  ['goldtrex', '金色小暴龍裝', 'outfit', '傳說', 400, '商店', '', ''],
  ['frame_wood', '木質名牌框', 'frame', '稀有', 50, '商店', '', ''],
  ['frame_glow', '發光名牌框', 'frame', '傳說', 250, '商店', '', ''],
  ['pet_bow', '寵物領結', 'petacc', '普通', 20, '商店', '', ''],
  ['pet_wings', '寵物小翅膀', 'petacc', '稀有', 60, '商店', '', ''],
  ['pet_crown', '寵物皇冠', 'petacc', '稀有', 120, '商店', '', ''],
  ['g_antenna', '外星觸角', 'hat', '普通', 0, '扭蛋', '宇宙系列', ''],
  ['g_starclip', '星星髮夾', 'acc', '普通', 0, '扭蛋', '宇宙系列', ''],
  ['g_moonpin', '月亮胸章', 'acc', '普通', 0, '扭蛋', '宇宙系列', ''],
  ['g_helmet', '太空頭盔', 'hat', '稀有', 0, '扭蛋', '宇宙系列', ''],
  ['g_rocket', '火箭背包', 'acc', '稀有', 0, '扭蛋', '宇宙系列', ''],
  ['g_ufo', '小飛碟頭飾', 'hat', '稀有', 0, '扭蛋', '宇宙系列', ''],
  ['g_galaxy', '銀河披風', 'acc', '傳說', 0, '扭蛋', '宇宙系列', ''],
  ['g_saturn', '土星光環', 'acc', '傳說', 0, '扭蛋', '宇宙系列', ''],
  // ── 對戰裝備(說明欄放數值:atk 攻擊、def 防禦、hp 體力、spd 速度;卡片 card:效果:數值)──
  ['w_spatula', '木鍋鏟', 'weapon', '普通', 40, '商店', '', 'atk:3'],
  ['w_whisk', '打蛋器', 'weapon', '普通', 60, '商店', '', 'atk:5,spd:1'],
  ['w_mold', '雞蛋糕烤盤', 'weapon', '稀有', 150, '商店', '', 'atk:9'],
  ['w_star', '星光權杖', 'weapon', '稀有', 0, '扭蛋', '戰鬥系列', 'atk:8,spd:3'],
  ['w_flame', '紅玉火焰劍', 'weapon', '傳說', 0, '扭蛋', '戰鬥系列', 'atk:15,spd:2'],
  ['w_champ', '冠軍之劍', 'weapon', '傳說', 0, '徽章:champion', '', 'atk:14,spd:1'],
  ['w_knife', '削皮小刀', 'weapon', '普通', 0, '掉落', '', 'atk:4,spd:2'],
  ['a_apron', '厚圍裙', 'armor', '普通', 40, '商店', '', 'def:3,hp:10'],
  ['a_mitt', '隔熱手套', 'armor', '普通', 60, '商店', '', 'def:5'],
  ['a_chef', '主廚護甲', 'armor', '稀有', 150, '商店', '', 'def:8,hp:20'],
  ['a_galaxy', '銀河戰甲', 'armor', '傳說', 0, '扭蛋', '戰鬥系列', 'def:12,hp:40'],
  ['a_star', '星塵斗篷', 'armor', '稀有', 0, '扭蛋', '戰鬥系列', 'def:6,hp:20,spd:2'],
  ['a_attend', '全勤護甲', 'armor', '稀有', 0, '徽章:attend', '', 'def:7,hp:30'],
  ['a_cap', '防燙帽', 'armor', '普通', 0, '掉落', '', 'def:3,hp:15'],
  ['c_heal', '熱騰騰雞蛋糕', 'card', '普通', 30, '商店', '', 'card:heal:30'],
  ['c_power', '紅玉能量', 'card', '普通', 30, '商店', '', 'card:power:50'],
  ['c_shield', '奶油護盾', 'card', '普通', 30, '商店', '', 'card:shield:25'],
  ['c_gift', '全家福大禮盒', 'card', '稀有', 0, '扭蛋', '戰鬥系列', 'card:heal:60'],
  ['c_meteor', '流星雨', 'card', '傳說', 0, '扭蛋', '戰鬥系列', 'card:power:100'],
  ['c_book', '博學之書', 'card', '稀有', 0, '徽章:quiz_30', '', 'card:power:80'],
  ['c_lucky', '幸運籤', 'card', '普通', 0, '掉落', '', 'card:shield:40'],
  ['c_tea', '下午茶時光', 'card', '普通', 0, '掉落', '', 'card:heal:40'],
  // ── 夥伴小店販售(「小店:店型」,價格為建議價,店主可在 80%~150% 間調整)──
  ['s_coffee', '美式咖啡', 'gift', '普通', 15, '小店:咖啡店', '', 'gift:☕'],
  ['s_latte', '拿鐵', 'gift', '普通', 25, '小店:咖啡店', '', 'gift:☕'],
  ['s_espresso', '濃縮咖啡卡', 'card', '普通', 20, '小店:咖啡店', '', 'card:power:30'],
  ['s_cookie', '寵物餅乾', 'petsnack', '普通', 10, '小店:甜點店', '', 'petsnack:2'],
  ['s_petcake', '寵物蛋糕', 'petsnack', '普通', 25, '小店:甜點店', '', 'petsnack:6'],
  ['s_macaron', '馬卡龍', 'gift', '普通', 20, '小店:甜點店', '', 'gift:🍬'],
  ['s_rose', '玫瑰', 'gift', '普通', 20, '小店:花店', '', 'gift:🌹'],
  ['s_bouquet', '花束', 'gift', '稀有', 40, '小店:花店', '', 'gift:💐'],
  ['s_wreath', '花冠(收藏)', 'decor', '稀有', 50, '小店:花店', '', 'decor:🌸'],
  ['s_woodsword', '練習木劍', 'weapon', '普通', 50, '小店:武器鋪', '', 'atk:4'],
  ['s_buckler', '小圓盾', 'armor', '普通', 50, '小店:武器鋪', '', 'def:4,hp:5'],
  ['s_ironsword', '鐵劍', 'weapon', '稀有', 120, '小店:武器鋪', '', 'atk:7,spd:1'],
  ['s_cardheal', '補血卡', 'card', '普通', 35, '小店:卡片屋', '', 'card:heal:40'],
  ['s_cardpow', '力量卡', 'card', '普通', 35, '小店:卡片屋', '', 'card:power:60'],
  ['s_cardshield', '護盾卡', 'card', '普通', 35, '小店:卡片屋', '', 'card:shield:35'],
  ['s_plush', '小暴龍玩偶(收藏)', 'decor', '普通', 30, '小店:雜貨店', '', 'decor:🦖'],
  ['s_keychain', '雞蛋糕吊飾(收藏)', 'decor', '普通', 15, '小店:雜貨店', '', 'decor:🧁'],
  ['s_snackpack', '寵物零食包', 'petsnack', '普通', 18, '小店:雜貨店', '', 'petsnack:4']
];

// 徽章:編號, 名稱, 圖示, 說明, 獎勵, 是否每期可再得
var GM_BADGES = [
  ['first_punch', '初心者', '🌱', '第一次上班打卡', 10, false],
  ['first_open', '開門紅', '🌅', '第一次當天第一位開店', 10, false],
  ['close_10', '收店達人・銅', '🥉', '完成收店盤點 10 次', 20, false],
  ['close_50', '收店達人・銀', '🥈', '完成收店盤點 50 次', 50, false],
  ['close_100', '收店達人・金', '🥇', '完成收店盤點 100 次', 100, false],
  ['attend', '全勤之星', '⭐', '當月排班全部出勤、無遲到', 50, true],
  ['target', '達標之星', '🎯', '當月工時達標', 30, true],
  ['bigday', '業績爆發', '🔥', '單日單店營業額達門檻', 50, false],
  ['quiz_30', '博學家', '📘', '每日一題累計答對 30 題', 20, false],
  ['quiz_100', '大博學家', '📚', '每日一題累計答對 100 題', 50, false],
  ['fashion', '時尚達人', '👗', '擁有 10 件付費服裝', 20, false],
  ['collector', '圖鑑大師', '🏅', '扭蛋系列收集完成', 100, true],
  ['popular', '人氣王', '💖', '收到互動的不同夥伴滿 10 人', 20, false],
  ['star', '互動之星', '🌟', '當月互動之星', 0, true],
  ['champion', '冠軍櫃位', '🏆', '在當月營業額第一名櫃位上班', 0, true],
  ['donor_1', '團隊贊助者・銅', '🤝', '捐獻累計 100 枚', 0, false],
  ['donor_2', '團隊贊助者・銀', '🤝', '捐獻累計 500 枚', 0, false],
  ['donor_3', '團隊贊助者・金', '🤝', '捐獻累計 1,000 枚', 0, false],
  ['tenure_1', '資歷・銅', '🎖️', '累計工時滿 1,080 小時(可開自己的小店)', 100, false],
  ['tenure_2', '資歷・銀', '🎖️', '累計工時滿 2,160 小時', 200, false],
  ['tenure_3', '資歷・金', '🎖️', '累計工時滿 3,240 小時', 300, false],
  ['birthday', '生日派對', '🎂', '在紅玉滿過生日', 0, true],
  ['mentor', '好導師', '🧑‍🏫', '帶新人(管理者頒發)', 50, true],
  ['special', '特別貢獻', '💎', '管理者頒發', 0, true],
  ['gamer', '小遊戲週冠軍', '🎮', '任一款小遊戲週排行第一', 10, true],
  ['pet_dex', '寵物圖鑑大師', '📖', '五種寵物都親手養到完全體', 100, false]
];
// 寵物小遊戲:編號、名稱、需要的寵物階段、破個人紀錄的獎勵、分數上限(防止異常分數)
var GM_GAMES = [['catch', '接雞蛋糕', 1, 1, 5000], ['memory', '雞蛋糕翻翻樂', 2, 1, 1000], ['breakout', '打磚塊', 3, 2, 20000],
                ['oven', '烤爐大挑戰', 4, 2, 20000], ['runner', '寵物跑酷', 5, 3, 100000]];

var GM_INTER_TYPES = { cheer: '加油打氣', like: '按讚', nod: '點頭致意', smile: '微笑', pat: '摸摸寵物的頭' };
var GM_PET_FLAVORS = ['原味', '可可', '紅玉', '抹茶'];
var GM_PET_STAGES = [[0, '蛋寶寶'], [40, '雛形期'], [120, '嬰兒期'], [300, '兒童期'], [600, '完全體']];   // v1.19

// 每日一題初稿 30 題(2026-11-10,待隊長審)
var GM_QUIZ_SEED = [["Q01", "品牌", "紅玉滿赤心雞蛋糕的品牌標語是？", "願食雞蛋糕，常保赤子心", "一口雞蛋糕，滿滿好心情", "赤心相待，紅玉滿堂", "雞蛋糕，最懂台灣味", "A", "登入頁上的標語就是「願食雞蛋糕，常保赤子心」。", "是"], ["Q02", "品牌", "我們目前的四種麵糊口味是？", "原味、可可、紅玉、抹茶", "原味、巧克力、草莓、抹茶", "原味、可可、芋頭、紅豆", "原味、紅玉、黑糖、抹茶", "A", "盤點和收店都要分別填這四種口味。", "是"], ["Q03", "品牌", "紅玉滿赤心雞蛋糕在光譜餐飲品牌集團中代表哪個顏色？", "紅色", "橙色", "黃色", "綠色", "A", "集團以光譜七色規劃七個品牌，紅玉滿是紅色，澄司吐司是橙色。", "是"], ["Q04", "品牌", "光譜餐飲品牌集團規劃發展幾個品牌？", "3 個", "5 個", "7 個", "10 個", "C", "對應光譜的七種顏色。", "是"], ["Q05", "品牌", "下列哪一個是我們的固定櫃位？", "遠百信義", "台北101", "新光三越南西", "微風南山", "A", "固定櫃位有遠百信義、國家音樂廳、南港 LaLaport、遠百竹北。", "是"], ["Q06", "品牌", "紅玉滿至今參加過大約多少場活動？", "50 場以上", "100 場以上", "300 場以上", "500 場以上", "D", "品牌累積參加 500 場以上活動，也和許多政府單位合作。", "是"], ["Q07", "制度", "2026 年夥伴的基本時薪是多少？", "183 元", "190 元", "196 元", "200 元", "C", "2026 年所有夥伴都以 196 元為基準時薪。", "是"], ["Q08", "制度", "一般夥伴每月達標的條件是？", "160 小時＋假日 2 天", "180 小時＋假日 4 天", "200 小時＋假日 4 天", "180 小時，不看假日", "B", "一般夥伴 180 小時＋4 天假日出勤；學生夥伴是 72 小時＋4 天。", "是"], ["Q09", "制度", "學生夥伴每月達標的工時門檻是？", "60 小時", "72 小時", "90 小時", "120 小時", "B", "學生夥伴是 72 小時＋4 天假日出勤。", "是"], ["Q10", "制度", "國定假日或颱風天上班，時薪怎麼算？", "×1.33", "×1.5", "×2", "照原時薪", "C", "國定假日和颱風天都是 2 倍。", "是"], ["Q11", "制度", "上班時數會扣掉午餐 1 小時嗎？", "會", "不會", "滿 8 小時才扣", "看櫃位規定", "B", "制度明訂工時不扣午餐時間。", "是"], ["Q12", "制度", "制度中所有金額的計算，零頭怎麼處理？", "四捨五入", "無條件捨去", "無條件進位（對夥伴有利）", "由主管決定", "C", "所有金額採無條件進位，對夥伴有利。", "是"], ["Q13", "制度", "介紹新夥伴的介紹獎金總共多少？", "3,000 元", "5,000 元", "8,000 元", "10,000 元", "D", "10,000 元，在被介紹人累計 180、360、720 小時時分三次發放。", "是"], ["Q14", "制度", "生日津貼在什麼時候發放？", "每年年底", "生日當月", "到職週年", "三節時一起發", "B", "生日津貼在夥伴生日當月發放。", "是"], ["Q15", "制度", "假日出勤獎金是每櫃每天多少元，再依時數比例分配？", "300 元", "500 元", "800 元", "1,000 元", "B", "每櫃每天 500 元，非雙倍薪日才有。", "是"], ["Q16", "制度", "百貨櫃位（A 類）的業績是以銷貨額的多少計算？", "70%", "80%", "90%", "100%", "B", "A 類百貨以銷貨額 ×80% 計算業績。", "是"], ["Q17", "SOP", "上班打卡前，App 會要求你先拍什麼？", "櫃位環境照", "儀容照（帽子、口罩、制服）", "麵糊照", "發票照", "B", "沒有儀容照就不能打上班卡。", "是"], ["Q18", "SOP", "洗手消毒時，至少要洗多久？", "5 秒", "10 秒", "20 秒", "1 分鐘", "C", "開店 SOP：洗手 20 秒以上並用酒精消毒。", "是"], ["Q19", "SOP", "當天第一位到櫃位的夥伴，打卡後要完成什麼？", "開店盤點（麵糊起始量與零用金）", "收店盤點", "訂單確認", "排班確認", "A", "第一位開店的人要填四種口味麵糊起始量與接手零用金。", "是"], ["Q20", "SOP", "收店時，最後離開的夥伴要上傳哪兩組照片？", "儀容照、麵糊照", "烤爐清潔照、環境清潔照", "發票照、零用金照", "商品照、客人照", "B", "收店要上傳烤爐清潔與環境清潔照片，才能打下班卡。", "是"], ["Q21", "SOP", "竹籤、紙袋快用完時，最好的做法是？", "下班後再說", "在宇宙辦公室的缺貨看板登記", "自己去買", "跟客人借", "B", "缺貨看板登記後，大家和管理者都看得到。", "是"], ["Q22", "SOP", "收店盤點要填寫哪些麵糊數量？", "只填總數", "四種口味各自的剩餘包數與當日進貨", "只填原味", "不用填", "B", "四種口味的剩餘與進貨要分別填寫，管理儀表板會依此顯示各店剩餘麵糊。", "是"], ["Q23", "SOP", "烤爐清潔應該在什麼時候進行？", "剛關電源時馬上擦", "關閉電源、降溫後再清潔", "開著電源邊烤邊擦", "隔天開店再清", "B", "降溫後清潔才安全，也能保護烤盤。", "是"], ["Q24", "食安", "帽子的正確戴法是？", "露出瀏海比較好看", "頭髮全部收進帽子裡", "只要有戴就好", "熱的時候可以拿下", "B", "頭髮全部收進帽子，避免掉落到食物裡。", "是"], ["Q25", "食安", "麵糊開封後，最需要注意的是？", "顏色是否好看", "保存期限與冷藏保存", "放在烤爐旁保溫", "倒在一起比較省空間", "B", "開店 SOP 要確認麵糊數量與保存期限。", "是"], ["Q26", "食安", "收銀找零後，要再碰食物前應該？", "直接拿", "洗手或消毒手部", "擦一下圍裙", "戴上手套就不用管", "B", "錢幣容易沾附細菌，碰食物前要清潔雙手。", "是"], ["Q27", "服務", "客人想訂大量雞蛋糕外送，夥伴應該怎麼做？", "請客人改天再來", "在 App「訂單」建立外送訂單", "用便條紙記下來", "口頭記住就好", "B", "訂單系統會提醒最晚開始製作時間，避免漏單。", "是"], ["Q28", "服務", "訂單上的「最晚開始製作時間」是怎麼算的？", "取貨時間減掉預計製作時間", "取貨時間加 30 分鐘", "建單時間加 1 小時", "固定上午 10 點", "A", "系統用取貨（外送則用外送時間）減預計製作分鐘數，時間到會在頂端提醒。", "是"], ["Q29", "App", "赤心幣每工作 1 小時可以得到幾枚？（一般夥伴）", "1 枚", "2 枚", "5 枚", "10 枚", "A", "一般夥伴每小時 1 枚，分隊長 ×1.2、管理者 ×1.5，活動場次再 ×2。", "是"], ["Q30", "App", "忘記或要修改密碼，可以怎麼做？", "在「我的」頁的帳號安全修改，或聯絡門市總監、營運總監", "重新申請帳號", "問其他夥伴的密碼", "不用管它", "A", "可以自己在「我的」頁修改；忘記密碼請聯絡門市總監或營運總監。", "是"]];

// ───────── 基本工具 ─────────
var GM_CACHE_ = {};
function gm_ss_() { return GM_CACHE_.ss || (GM_CACHE_.ss = SpreadsheetApp.openById(SHEET_ID)); }
function gm_sh_(key) {
  if (GM_CACHE_['sh_' + key]) return GM_CACHE_['sh_' + key];
  var d = GM_SHEETS[key], sh = gm_ss_().getSheetByName(d[0]);
  if (!sh) { sh = gm_ss_().insertSheet(d[0]); sh.getRange(1, 1, 1, d[1].length).setValues([d[1]]); sh.setFrozenRows(1); }
  return (GM_CACHE_['sh_' + key] = sh);
}
function gm_rows_(key) {           // 不含標題列
  if (GM_CACHE_['rows_' + key]) return GM_CACHE_['rows_' + key];
  var sh = gm_sh_(key), n = sh.getLastRow();
  var v = n > 1 ? sh.getRange(2, 1, n - 1, GM_SHEETS[key][1].length).getValues() : [];
  return (GM_CACHE_['rows_' + key] = v);
}
function gm_append_(key, rows) {
  if (!rows.length) return;
  var sh = gm_sh_(key), start = sh.getLastRow() + 1;
  var rng = sh.getRange(start, 1, rows.length, rows[0].length);
  rng.setNumberFormat('@'); rng.setValues(rows.map(function (r) { return r.map(function (x) { return x == null ? '' : String(x); }); }));
  var c = GM_CACHE_['rows_' + key]; if (c) rows.forEach(function (r) { c.push(r.map(function (x) { return x == null ? '' : String(x); })); });
}
function gm_now_() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss'); }
function gm_today_() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd'); }
function gm_dstr_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Taipei', 'yyyy-MM-dd');
  var s = String(v || '').trim().replace(/\//g, '-'), m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : '';
}
function gm_addDays_(d, n) { var t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
function gm_prevMonth_(ym) { var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1; if (!m) { y--; m = 12; } return y + '-' + ('0' + m).slice(-2); }
function gm_num_(v) { var n = Number(String(v == null ? '' : v).replace(/[^\d.\-]/g, '')); return String(v).trim() === '' || !isFinite(n) ? 0 : n; }

function gm_param_(name) {
  if (!GM_CACHE_.params) {
    var m = {}; GM_PARAM_DEFAULTS.forEach(function (p) { m[p[0]] = p[1]; });
    gm_rows_('params').forEach(function (r) { if (String(r[0]).trim() !== '' && String(r[1]).trim() !== '') m[String(r[0]).trim()] = r[1]; });
    GM_CACHE_.params = m;
  }
  var v = GM_CACHE_.params[name];
  return typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : v;
}

// 夥伴資料:A 員工編號、B 姓名、C 暱稱、E 生日(民國 yy/mm/dd)、J 到職日、K 離職日、M 權限等級
function gm_emps_() {
  if (GM_CACHE_.emps) return GM_CACHE_.emps;
  var v = gm_ss_().getSheetByName('夥伴資料').getDataRange().getValues(), out = {};
  for (var r = 1; r < v.length; r++) {
    var id = String(v[r][0]).trim(); if (!id) continue;
    out[id] = { id: id, name: String(v[r][1] || ''), nick: String(v[r][2] || ''), birthday: v[r][4], start: v[r][9],
                resigned: String(v[r][10] || '').trim() !== '', role: Number(v[r][12]) || 1, pos: String(v[r][11] || '').trim() };
  }
  return (GM_CACHE_.emps = out);
}
function gm_emp_(id) { return gm_emps_()[String(id || '').trim()] || null; }
// 權限:1 夥伴、2 分隊長、3 管理者、4 總經理(預留)、5 大隊長(全部權限)。
// 遊戲最高管理(補發赤心幣、頒徽章、手動結算)限 4 級以上;過渡期職務為「大隊長」者也算(權限等級還沒改成 5 之前)。
function gm_isTop_(e) { return !!e && (e.role >= 4 || e.pos === '大隊長'); }
function gm_bdMD_(v) {          // 生日 → "MM-DD"
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Taipei', 'MM-dd');
  var p = String(v || '').trim().split(/[\/\-.]/); if (p.length < 2) return '';
  var m = p[p.length - 2], d = p[p.length - 1]; return ('0' + Number(m)).slice(-2) + '-' + ('0' + Number(d)).slice(-2);
}

// ───────── 赤心幣 ─────────
function gm_hasKey_(key) {
  if (!GM_CACHE_.keys) { GM_CACHE_.keys = {}; gm_rows_('ledger').forEach(function (r) { if (r[5]) GM_CACHE_.keys[r[5]] = 1; }); }
  return !!GM_CACHE_.keys[key];
}
function gm_credit_(emp, type, amount, note, key) {   // key 相同只會入帳一次
  amount = Math.round(Number(amount) || 0); if (!amount) return false;
  if (key && gm_hasKey_(key)) return false;
  gm_append_('ledger', [[gm_now_(), emp, type, amount, note || '', key || '']]);
  if (key) GM_CACHE_.keys[key] = 1;
  return true;
}
function gm_balance_(emp) {
  var s = 0; gm_rows_('ledger').forEach(function (r) { if (r[1] === emp) s += Number(r[3]) || 0; }); return s;
}
function gm_isFrozen_(emp) { var e = gm_emp_(emp); return !e || e.resigned; }

// ───────── 工時日結(打卡紀錄:B 日期、C 員工編號、F 打卡類型、G 打卡時間 ISO、J 打卡地點)─────────
function gm_punchRows_() {
  if (GM_CACHE_.punch) return GM_CACHE_.punch;
  var out = [];
  ['打卡紀錄', '打卡紀錄_歷史'].forEach(function (n) {
    var sh = gm_ss_().getSheetByName(n); if (!sh || sh.getLastRow() < 2) return;
    var v = sh.getRange(2, 1, sh.getLastRow() - 1, 10).getValues();
    v.forEach(function (r) {
      var t = r[6] instanceof Date ? r[6] : new Date(String(r[6]));
      if (isNaN(t.getTime())) return;
      out.push({ date: gm_dstr_(r[1]), emp: String(r[2]).trim(), type: String(r[5]).trim(), t: t.getTime(), loc: String(r[9] || '').trim() });
    });
  });
  return (GM_CACHE_.punch = out);
}
function gm_minutesFor_(date) {      // → [{emp, loc, min}]
  var by = {};
  gm_punchRows_().forEach(function (p) { if (p.date === date) (by[p.emp] = by[p.emp] || []).push(p); });
  var res = {};
  Object.keys(by).forEach(function (emp) {
    var list = by[emp].sort(function (a, b) { return a.t - b.t; }), open = null;
    list.forEach(function (p) {
      if (p.type === '上班') open = p;
      else if (p.type === '下班' && open) {
        var min = Math.round((p.t - open.t) / 60000);
        if (min > 0 && min <= 16 * 60) { var k = emp + '|' + open.loc; res[k] = (res[k] || 0) + min; }
        open = null;
      }
    });
  });
  return Object.keys(res).map(function (k) { var a = k.split('|'); return { emp: a[0], loc: a.slice(1).join('|'), min: res[k] }; });
}
// 重算某天的工時日結(先刪該日舊資料再寫入,補打卡後也會更新)
function gm_settleHoursDay_(date) {
  var sh = gm_sh_('hours'), v = gm_rows_('hours');
  for (var i = v.length - 1; i >= 0; i--) if (String(v[i][0]) === date) sh.deleteRow(i + 2);
  GM_CACHE_.rows_hours = null;
  var rows = gm_minutesFor_(date).map(function (x) { return [date, x.emp, x.loc, x.min]; });
  gm_append_('hours', rows);
}
// 工時幣:累計分鐘 × 倍率 ÷ 60 取整數,扣掉已發放的,補發差額(不倒扣)
function gm_payHours_(runDate) {
  // 活動場次的工時給 2 倍(隊長 11/10;倍數見參數「活動工時倍率」)
  var start = gm_param_('測試版開始日'), mins = {}, act = gm_activityLocs_(), actMult = Number(gm_param_('活動工時倍率')) || 1;
  gm_rows_('hours').forEach(function (r) {
    if (String(r[0]) < start) return;
    var w = (act[r[2]] || /^00/.test(String(r[2]))) ? actMult : 1;
    mins[r[1]] = (mins[r[1]] || 0) + (Number(r[3]) || 0) * w;
  });
  var paid = {};
  gm_rows_('ledger').forEach(function (r) { if (r[2] === '工時') paid[r[1]] = (paid[r[1]] || 0) + (Number(r[3]) || 0); });
  Object.keys(mins).forEach(function (emp) {
    var e = gm_emp_(emp); if (!e || e.resigned) return;
    var mult = Number(gm_param_('工時倍率_' + Math.min(5, Math.max(1, e.role)))) || 1;
    var due = Math.floor(mins[emp] * mult / 60), diff = due - (paid[emp] || 0);
    if (diff > 0) gm_credit_(emp, '工時', diff, '工時結算至 ' + gm_addDays_(runDate, -1) + '(加權後 ' + Math.round(mins[emp] / 6) / 10 + ' 小時 ×' + mult + ',活動場次 ×' + (Number(gm_param_('活動工時倍率')) || 1) + ')', 'HOURS|' + emp + '|' + runDate);
  });
}
function gm_minutesSince_(emp, fromDate, toDate, loc) {
  var s = 0; gm_rows_('hours').forEach(function (r) {
    if (r[1] === emp && String(r[0]) >= fromDate && (!toDate || String(r[0]) <= toDate) && (!loc || r[2] === loc)) s += Number(r[3]) || 0;
  }); return s;
}

// ───────── 徽章 ─────────
function gm_badgeDef_(id) { for (var i = 0; i < GM_BADGES.length; i++) if (GM_BADGES[i][0] === id) return GM_BADGES[i]; return null; }
function gm_hasBadge_(emp, id, period) {
  var rows = gm_rows_('badges');
  for (var i = 0; i < rows.length; i++) if (rows[i][0] === emp && rows[i][1] === id && String(rows[i][2]) === String(period || '')) return true;
  return false;
}
function gm_award_(emp, id, period, coinsOverride) {
  var d = gm_badgeDef_(id); if (!d || !gm_emp_(emp)) return false;
  period = d[5] ? String(period || '') : '';
  if (gm_hasBadge_(emp, id, period)) return false;
  gm_append_('badges', [[emp, id, period, gm_now_(), '']]);
  var coins = coinsOverride != null ? coinsOverride : d[4];
  if (coins) gm_credit_(emp, '徽章', coins, '獲得徽章「' + d[1] + '」' + (period ? '(' + period + ')' : ''), 'BADGE|' + emp + '|' + id + '|' + period);
  // 徽章解鎖的專屬裝備
  var cat = gm_catalog_(), own = gm_owned_(emp);
  Object.keys(cat).forEach(function (k) { if (cat[k].where === '徽章:' + id && !own[k]) gm_append_('owned', [[emp, k, '徽章', gm_now_()]]); });
  return true;
}

// 每日自動檢查徽章
function gm_autoBadges_() {
  var start = gm_param_('測試版開始日'), emps = gm_emps_(), ss = gm_ss_();
  // 初心者
  gm_punchRows_().forEach(function (p) { if (p.type === '上班' && p.date >= start && emps[p.emp]) gm_award_(p.emp, 'first_punch'); });
  // 開門紅(開店盤點:B 日期、D 員工編號)
  var op = ss.getSheetByName('開店盤點');
  if (op && op.getLastRow() > 1) op.getRange(2, 1, op.getLastRow() - 1, 6).getValues().forEach(function (r) {
    if (gm_dstr_(r[1]) >= start && emps[String(r[3]).trim()]) gm_award_(String(r[3]).trim(), 'first_open');
  });
  // 收店達人、業績爆發(收店盤點:B 日期、D 員工編號、F 櫃位、Q 當日營業額、AC 營業額合計)
  var closeCnt = {}, th = Number(gm_param_('單日營業額門檻')) || 0;
  gm_closeRows_().forEach(function (c) {
    if (c.date < start || !emps[c.emp]) return;
    closeCnt[c.emp] = (closeCnt[c.emp] || 0) + 1;
    if (gm_hash_(c.emp + c.date + c.loc) % 100 < 15) gm_drop_(c.emp, '確實完成收店盤點(' + c.date + ')', 'CLOSE|' + c.emp + '|' + c.date + '|' + c.loc);
    if (th && c.rev >= th) gm_award_(c.emp, 'bigday');
  });
  Object.keys(closeCnt).forEach(function (e) {
    if (closeCnt[e] >= 10) gm_award_(e, 'close_10');
    if (closeCnt[e] >= 50) gm_award_(e, 'close_50');
    if (closeCnt[e] >= 100) gm_award_(e, 'close_100');
  });
  // 達標之星(達標紀錄:A 員工編號、C 年月、H 是否達標)
  var tg = ss.getSheetByName('達標紀錄');
  if (tg && tg.getLastRow() > 1) tg.getRange(2, 1, tg.getLastRow() - 1, 8).getValues().forEach(function (r) {
    var ym = String(r[2]).trim(); if (r[2] instanceof Date) ym = Utilities.formatDate(r[2], 'Asia/Taipei', 'yyyy-MM');
    if (ym >= start.slice(0, 7) && /^(是|TRUE|true|Y|✓|達標)$/.test(String(r[7]).trim()) && emps[String(r[0]).trim()]) gm_award_(String(r[0]).trim(), 'target', ym);
  });
  // 資歷(隊長 11/10:以累計工時為主,不看到職日)。累計工時表:A 員工編號、C 年月、G 累計工時總計 → 取每人最新年月那筆
  var cum = {}, cs = ss.getSheetByName('累計工時');
  if (cs && cs.getLastRow() > 1) cs.getRange(2, 1, cs.getLastRow() - 1, 7).getValues().forEach(function (r) {
    var id = String(r[0]).trim(); if (!id) return;
    var ym = r[2] instanceof Date ? Utilities.formatDate(r[2], 'Asia/Taipei', 'yyyy-MM') : String(r[2]).trim();
    if (!cum[id] || ym >= cum[id].ym) cum[id] = { ym: ym, h: gm_num_(r[6]) };
  });
  var th3 = String(gm_param_('資歷門檻') || '1000,2000,3000').split(',').map(Number);
  Object.keys(cum).forEach(function (id) {
    if (!emps[id] || emps[id].resigned) return;
    for (var y = 1; y <= 3; y++) if (th3[y - 1] && cum[id].h >= th3[y - 1]) gm_award_(id, 'tenure_' + y);
  });
  // 人氣王、時尚達人、博學家、贊助者
  Object.keys(emps).forEach(function (id) { gm_checkSocialBadges_(id); });
}
function gm_checkSocialBadges_(id) {
  var from = {}; gm_rows_('inter').forEach(function (r) { if (r[3] === id) from[r[2]] = 1; });
  if (Object.keys(from).length >= 10) gm_award_(id, 'popular');
  var paidItems = 0, cat = gm_catalog_();
  gm_rows_('owned').forEach(function (r) { if (r[0] === id && cat[r[1]] && ['acc', 'outfit', 'frame', 'haircolor', 'hat'].indexOf(cat[r[1]].cat) >= 0) paidItems++; });
  if (paidItems >= 10) gm_award_(id, 'fashion');
  var right = 0; gm_rows_('answers').forEach(function (r) { if (r[1] === id && String(r[4]) === '對') right++; });
  if (right >= 30) gm_award_(id, 'quiz_30');
  if (right >= 100) gm_award_(id, 'quiz_100');
  var don = 0; gm_rows_('fund').forEach(function (r) { if (r[1] === id) don += Number(r[2]) || 0; });
  if (don >= 100) gm_award_(id, 'donor_1');
  if (don >= 500) gm_award_(id, 'donor_2');
  if (don >= 1000) gm_award_(id, 'donor_3');
}

// 工作表現掉落:從「掉落」物品中挑一件還沒有的(都有了就不掉)
function gm_drop_(emp, reason, key) {
  if (gm_hasKey_('DROP|' + key)) return null;
  var cat = gm_catalog_(), own = gm_owned_(emp);
  var pool = Object.keys(cat).filter(function (k) { return cat[k].where === '掉落' && !own[k]; });
  GM_CACHE_.keys['DROP|' + key] = 1;
  gm_append_('ledger', [[gm_now_(), emp, '掉落', 0, reason, 'DROP|' + key]]);
  if (!pool.length) return null;
  var got = pool[gm_hash_(key) % pool.length];
  gm_append_('owned', [[emp, got, '掉落', gm_now_()]]);
  gm_append_('ledger', [[gm_now_(), emp, '掉落', 0, reason + ':獲得「' + cat[got].name + '」', '']]);
  return cat[got];
}

// ───────── 營業額(收店盤點)─────────
function gm_closeRows_() {
  if (GM_CACHE_.close) return GM_CACHE_.close;
  var out = [];
  ['收店盤點', '收店盤點_歷史'].forEach(function (n) {
    var sh = gm_ss_().getSheetByName(n); if (!sh || sh.getLastRow() < 2) return;
    var v = sh.getRange(2, 1, sh.getLastRow() - 1, Math.min(29, sh.getLastColumn())).getValues();
    v.forEach(function (r) {
      var rev = String(r[28] == null ? '' : r[28]).trim() !== '' ? gm_num_(r[28]) : gm_num_(r[16]);
      out.push({ date: gm_dstr_(r[1]), emp: String(r[3]).trim(), loc: String(r[5]).trim(), rev: rev });
    });
  });
  return (GM_CACHE_.close = out);
}
function gm_activityLocs_() {
  var sh = gm_ss_().getSheetByName('櫃位設定'), out = {};
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues().forEach(function (r) {
    if (String(r[5]).trim() === '活動') out[String(r[0]).trim()] = 1;
  });
  return out;
}
function gm_revenueRank_(ym) {      // 固定櫃位當月營業額排行
  var act = gm_activityLocs_(), sum = {};
  gm_closeRows_().forEach(function (c) {
    if (c.date.slice(0, 7) !== ym || !c.loc || act[c.loc] || /^00/.test(c.loc)) return;
    sum[c.loc] = (sum[c.loc] || 0) + c.rev;
  });
  return Object.keys(sum).map(function (k) { return { loc: k, rev: sum[k] }; }).sort(function (a, b) { return b.rev - a.rev; });
}

// ───────── 月結(每月 1 日):互動之星、冠軍櫃位、全勤 ─────────
function gm_monthly_(ym) {
  var start = gm_param_('測試版開始日');
  if (ym + '-31' < start) return;
  // 互動之星
  var sent = {}, recv = {};
  gm_rows_('inter').forEach(function (r) {
    if (String(r[1]).slice(0, 7) !== ym) return;
    (sent[r[2]] = sent[r[2]] || {})[r[3]] = 1; (recv[r[3]] = recv[r[3]] || {})[r[2]] = 1;
  });
  var score = {}, minN = Number(gm_param_('互動之星最低人數')) || 0;
  Object.keys(gm_emps_()).forEach(function (id) {
    var s = Object.keys(sent[id] || {}).length + Object.keys(recv[id] || {}).length;
    if (s >= minN && s > 0) score[id] = s;
  });
  var best = 0; Object.keys(score).forEach(function (k) { if (score[k] > best) best = score[k]; });
  if (best) Object.keys(score).forEach(function (k) {
    if (score[k] === best && !gm_isFrozen_(k)) { gm_award_(k, 'star', ym); gm_credit_(k, '互動之星', gm_param_('互動之星獎勵'), ym + ' 本月互動之星', 'STAR|' + k + '|' + ym); }
  });
  // 冠軍櫃位
  var rank = gm_revenueRank_(ym);
  if (rank.length && rank[0].rev > 0) {
    var loc = rank[0].loc, mins = {}, total = 0;
    gm_rows_('hours').forEach(function (r) {
      if (String(r[0]).slice(0, 7) === ym && r[2] === loc && String(r[0]) >= start) { mins[r[1]] = (mins[r[1]] || 0) + (Number(r[3]) || 0); total += Number(r[3]) || 0; }
    });
    var pool = Number(gm_param_('冠軍櫃位總獎勵')) || 0;
    if (total > 0) Object.keys(mins).forEach(function (emp) {
      if (gm_isFrozen_(emp)) return;
      var amt = Math.round(pool * mins[emp] / total);
      gm_award_(emp, 'champion', ym);
      gm_credit_(emp, '冠軍櫃位', amt, ym + ' 冠軍櫃位 ' + loc + '(上班 ' + Math.round(mins[emp] / 6) / 10 + ' / ' + Math.round(total / 6) / 10 + ' 小時)', 'CHAMP|' + emp + '|' + ym);
    });
    gm_setState_('冠軍櫃位_' + ym, loc);
  }
  // 全勤之星(班表:B 日期、D 員工編號、F 櫃位、G 上班時間)
  var sch = gm_ss_().getSheetByName('班表'), plan = {};
  if (sch && sch.getLastRow() > 1) sch.getRange(2, 1, sch.getLastRow() - 1, 7).getValues().forEach(function (r) {
    var d = gm_dstr_(r[1]), emp = String(r[3]).trim(); if (!emp || d.slice(0, 7) !== ym || d < start) return;
    var st = r[6] instanceof Date ? Utilities.formatDate(r[6], 'Asia/Taipei', 'HH:mm') : String(r[6]).trim();
    (plan[emp] = plan[emp] || []).push({ date: d, start: st });
  });
  var firstIn = {};
  gm_punchRows_().forEach(function (p) {
    if (p.type !== '上班') return; var k = p.emp + '|' + p.date;
    if (!firstIn[k] || p.t < firstIn[k]) firstIn[k] = p.t;
  });
  Object.keys(plan).forEach(function (emp) {
    var ok = plan[emp].every(function (s) {
      var t = firstIn[emp + '|' + s.date]; if (!t) return false;
      var m = /^(\d{1,2}):(\d{2})/.exec(s.start); if (!m) return true;
      var due = new Date(s.date + 'T' + ('0' + m[1]).slice(-2) + ':' + m[2] + ':00+08:00').getTime();
      return t <= due + 5 * 60000;
    });
    if (ok && plan[emp].length && !gm_isFrozen_(emp)) { gm_award_(emp, 'attend', ym); gm_drop_(emp, ym + ' 全勤', 'ATTEND|' + emp + '|' + ym); }
  });
}
function gm_setState_(k, v) { PropertiesService.getScriptProperties().setProperty('gm_' + k, String(v)); }
function gm_getState_(k) { return PropertiesService.getScriptProperties().getProperty('gm_' + k) || ''; }

// ───────── 每日排程 ─────────
function gm_dailyJob() {
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    GM_CACHE_ = {};
    var today = gm_today_(), start = gm_param_('測試版開始日');
    if (today <= start) return;
    // 1. 工時:前 3 天重算(補打卡也會更新),第一次執行會從開始日一路補到昨天
    var last = gm_getState_('工時已結算到') || gm_addDays_(start, -1);
    var from = last < gm_addDays_(today, -3) ? gm_addDays_(last, 1) : gm_addDays_(today, -3);
    if (from < start) from = start;
    for (var d = from; d < today; d = gm_addDays_(d, 1)) gm_settleHoursDay_(d);
    gm_setState_('工時已結算到', gm_addDays_(today, -1));
    gm_payHours_(today);
    // 2. 壽星
    var md = today.slice(5), emps = gm_emps_();
    Object.keys(emps).forEach(function (id) {
      var e = emps[id]; if (e.resigned || gm_bdMD_(e.birthday) !== md) return;
      gm_award_(id, 'birthday', today.slice(0, 4));
      gm_credit_(id, '生日', gm_param_('壽星獎勵'), '生日快樂!', 'BDAY|' + id + '|' + today.slice(0, 4));
    });
    // 3. 徽章
    gm_autoBadges_();
    // 4. 月結(每月 1 日結算上月;若漏跑,下次執行會補)
    var ym = today.slice(0, 7), prev = gm_prevMonth_(ym);
    if (gm_getState_('已月結') !== prev) { gm_monthly_(prev); gm_setState_('已月結', prev); }
    // 4b. 塔防週戰(每週一結算上週;模組有安裝才執行)
    if (typeof td_weekly_ === 'function') td_weekly_(today);
    gm_gameWeekly_(today);
    // 4c. 寵物:孵化、相簿補齊;每週一寫寵物日記(v1.19)
    gm_petSyncAll_(); gm_petDiaryWeekly_(today);
    // 5. 正式版加倍(只做一次)
    var off = gm_param_('正式版開始日');
    if (off && today >= off && gm_getState_('已加倍') !== off) {
      var mult = Number(gm_param_('正式版加倍倍率')) || 1;
      Object.keys(emps).forEach(function (id) {
        if (emps[id].resigned) return;
        var bal = gm_balance_(id);
        if (bal > 0 && mult > 1) gm_credit_(id, '正式版加倍', bal * (mult - 1), '測試期餘額 ' + bal + ' ×' + mult, 'DOUBLE|' + id + '|' + off);
      });
      gm_setState_('已加倍', off);
    }
  } finally { lock.releaseLock(); }
}
function gm_installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'gm_dailyJob') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('gm_dailyJob').timeBased().atHour(3).nearMinute(10).everyDays(1).inTimezone('Asia/Taipei').create();
  return '已建立每日 03:10 自動結算';
}
function gm_setup() {
  Object.keys(GM_SHEETS).forEach(function (k) {   // 建表；舊表缺的標題欄(例如寵物 G 欄「遊戲加命」)只補空白格，不動資料
    var sh = gm_sh_(k), head = GM_SHEETS[k][1], cur = sh.getRange(1, 1, 1, head.length).getValues()[0];
    head.forEach(function (h, i) { if (String(cur[i]).trim() === '') sh.getRange(1, i + 1).setValue(h); });
  });
  var have = {}; gm_rows_('params').forEach(function (r) { have[String(r[0]).trim()] = 1; });
  var add = GM_PARAM_DEFAULTS.filter(function (p) { return !have[p[0]]; });
  if (add.length) gm_append_('params', add);
  var cat = {}; gm_rows_('catalog').forEach(function (r) { cat[r[0]] = 1; });
  var addC = GM_CATALOG_SEED.filter(function (c) { return !cat[c[0]]; });
  if (addC.length) gm_append_('catalog', addC);
  if (!gm_rows_('quiz').length) gm_append_('quiz', GM_QUIZ_SEED);   // 題庫初稿 30 題(隊長審核後可直接改試算表)
  return '已建立工作表與預設資料';
}

// ───────── 商品、擁有 ─────────
function gm_catalog_() {
  if (GM_CACHE_.catalog) return GM_CACHE_.catalog;
  var m = {}, rows = gm_rows_('catalog'); if (!rows.length) rows = GM_CATALOG_SEED;
  rows.forEach(function (r) {
    var id = String(r[0]).trim(); if (!id) return;
    m[id] = { id: id, name: String(r[1]), cat: String(r[2]), tier: String(r[3]), price: Number(r[4]) || 0, where: String(r[5]), series: String(r[6] || ''), note: String(r[7] || '') };
  });
  return (GM_CACHE_.catalog = m);
}
function gm_owned_(emp) { var o = {}; gm_rows_('owned').forEach(function (r) { if (r[0] === emp) o[r[1]] = 1; }); return o; }
// 給角色造型模組用:這個物品是不是要擁有才能穿
function gm_requiresOwn_(itemId) { var c = gm_catalog_()[itemId]; return !!c; }

function gm_buy_(p) {
  var emp = String(p.empId || '').trim(), item = String(p.item || '').trim(), e = gm_emp_(emp);
  if (!e || e.resigned) return { error: '帳號無法使用' };
  var c = gm_catalog_()[item]; if (!c || c.where !== '商店') return { error: '這個商品目前沒有販售' };
  if (gm_owned_(emp)[item]) return { error: '已經擁有了' };
  if (gm_balance_(emp) < c.price) return { error: '赤心幣不足' };
  gm_credit_(emp, '購買', -c.price, '購買「' + c.name + '」', 'BUY|' + emp + '|' + item);
  gm_append_('owned', [[emp, item, '購買', gm_now_()]]);
  try { CacheService.getScriptCache().remove('av_all'); } catch (e) {}
  gm_checkSocialBadges_(emp);
  return { success: true, data: { balance: gm_balance_(emp) } };
}

// ───────── 扭蛋 ─────────
function gm_gacha_(p) {
  var emp = String(p.empId || '').trim(), e = gm_emp_(emp);
  if (!e || e.resigned) return { error: '帳號無法使用' };
  var price = Number(gm_param_('扭蛋價格')) || 50, ym = gm_today_().slice(0, 7), mine = [];
  gm_rows_('gacha').forEach(function (r) { if (r[1] === emp) mine.push(r); });
  var thisMonth = mine.filter(function (r) { return String(r[0]).slice(0, 7) === ym; }).length;
  if (thisMonth >= (Number(gm_param_('扭蛋每月上限')) || 5)) return { error: '本月扭蛋次數已用完' };
  if (gm_balance_(emp) < price) return { error: '赤心幣不足' };
  var cat = gm_catalog_(), pool = { '普通': [], '稀有': [], '傳說': [] };
  Object.keys(cat).forEach(function (k) { if (cat[k].where === '扭蛋' && pool[cat[k].tier]) pool[cat[k].tier].push(cat[k]); });
  // 保底:最近連續幾次都是普通
  var streak = 0; for (var i = mine.length - 1; i >= 0 && String(mine[i][3]) === '普通'; i--) streak++;
  var pity = Number(gm_param_('扭蛋保底次數')) || 10, roll = Math.random() * 100;
  var leg = Number(gm_param_('扭蛋機率_傳說')) || 5, rare = Number(gm_param_('扭蛋機率_稀有')) || 25;
  var tier = roll < leg ? '傳說' : roll < leg + rare ? '稀有' : '普通';
  if (tier === '普通' && streak + 1 >= pity) tier = Math.random() * (leg + rare) < leg ? '傳說' : '稀有';
  if (!pool[tier].length) tier = pool['普通'].length ? '普通' : '稀有';
  var got = pool[tier][Math.floor(Math.random() * pool[tier].length)];
  if (!got) return { error: '扭蛋機目前沒有商品' };
  var dup = !!gm_owned_(emp)[got.id], refund = dup ? Number(gm_param_('扭蛋重複退幣')) || 0 : 0;
  var n = mine.length + 1;
  gm_credit_(emp, '扭蛋', -price, '扭蛋第 ' + n + ' 次', 'GACHA|' + emp + '|' + n);
  if (dup) gm_credit_(emp, '扭蛋退幣', refund, '重複「' + got.name + '」分解', 'GREF|' + emp + '|' + n);
  else gm_append_('owned', [[emp, got.id, '扭蛋', gm_now_()]]);
  gm_append_('gacha', [[gm_now_(), emp, got.id, tier, refund]]);
  // 系列收集完成
  if (!dup && got.series) {
    var own = gm_owned_(emp), all = Object.keys(cat).filter(function (k) { return cat[k].series === got.series; });
    if (all.every(function (k) { return own[k]; })) gm_award_(emp, 'collector', got.series);
  }
  gm_checkSocialBadges_(emp);
  return { success: true, data: { item: got, tier: tier, duplicate: dup, refund: refund, balance: gm_balance_(emp), left: (Number(gm_param_('扭蛋每月上限')) || 5) - thisMonth - 1 } };
}

// ───────── 寵物(v1.19 改版:第一隻免費、孵化時隨機型態、圖鑑再孵、交換、摸摸頭、相簿、日記)─────────
// 寵物表一列一隻;狀態「身邊」是目前帶著的那隻,「圖鑑」是長到完全體後收藏的。
// 成長時數 = 主人從「領養日期」起的工時 + 「加成小時」(寵物零食、交換前累積的時數)。
var GM_PET_TYPES = [['chicken', '雞'], ['trex', '暴龍'], ['digger', '挖土機'], ['train', '火車'], ['trice', '三角龍']];
function gm_petTypeName_(id) { for (var i = 0; i < GM_PET_TYPES.length; i++) if (GM_PET_TYPES[i][0] === id) return GM_PET_TYPES[i][1]; return ''; }
function gm_petId_() { return 'P' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10); }
function gm_petFromRow_(r, i) {
  var emp = r[0], hrs = Math.floor(gm_minutesSince_(emp, String(r[3])) / 60) + (Number(r[5]) || 0), stage = 0;
  GM_PET_STAGES.forEach(function (s, k) { if (hrs >= s[0]) stage = k; });
  var next = GM_PET_STAGES[stage + 1];
  return { id: String(r[9] || ''), owner: emp, flavor: r[1], name: r[2], since: String(r[3]), acc: String(r[4] || ''), hours: hrs,
           stage: stage + 1, stageName: GM_PET_STAGES[stage][1], nextAt: next ? next[0] : null,
           type: String(r[7] || ''), typeName: gm_petTypeName_(String(r[7] || '')), status: String(r[8] || '身邊') || '身邊',
           hatched: String(r[10] || ''), row: i + 2 };
}
function gm_pet_(emp) {      // 目前帶在身邊的那隻
  var rows = gm_rows_('pets');
  for (var i = 0; i < rows.length; i++) if (rows[i][0] === emp && (String(rows[i][8] || '身邊') || '身邊') === '身邊') return gm_petFromRow_(rows[i], i);
  return null;
}
function gm_petSet_(row, col, vals) {   // col 從 1 起算
  var rng = gm_sh_('pets').getRange(row, col, 1, vals.length); rng.setNumberFormat('@'); rng.setValues([vals.map(String)]);
  GM_CACHE_.rows_pets = null;
}
function gm_petEvent_(emp, kind, text) { gm_append_('petlog', [[gm_now_(), emp, kind, text]]); }
// 補齊:沒有寵物編號的舊資料補編號;滿 40 小時還沒型態的 → 隨機開出型態(孵化);每升一階段記一張相簿
function gm_petSync_(pet) {
  if (!pet) return pet;
  if (!pet.id) { pet.id = gm_petId_(); gm_petSet_(pet.row, 10, [pet.id]); }
  if (pet.stage >= 2 && !pet.type) {
    var t = GM_PET_TYPES[Math.floor(Math.random() * GM_PET_TYPES.length)][0];
    gm_petSet_(pet.row, 8, [t]); gm_petSet_(pet.row, 11, [gm_today_()]);
    pet.type = t; pet.typeName = gm_petTypeName_(t); pet.hatched = gm_today_();
    var e = gm_emp_(pet.owner);
    gm_petEvent_(pet.owner, 'hatch', (e ? (e.nick || e.name) : pet.owner) + ' 的蛋孵出了' + pet.typeName + '!');
  }
  var have = {}; gm_rows_('album').forEach(function (r) { if (r[1] === pet.id) have[String(r[2])] = 1; });
  var add = [];
  for (var st = 1; st <= pet.stage; st++) if (!have[String(st)]) add.push([pet.owner, pet.id, st, pet.type, pet.flavor, gm_today_(), st === pet.stage ? pet.hours : GM_PET_STAGES[st - 1][0]]);
  if (add.length) gm_append_('album', add);
  return pet;
}
function gm_petSyncAll_() {
  var rows = gm_rows_('pets').slice();
  rows.forEach(function (r, i) { if ((String(r[8] || '身邊') || '身邊') === '身邊') gm_petSync_(gm_petFromRow_(r, i)); });
}
// 領養:第一隻免費;之後只有身邊那隻長到完全體才能「收進圖鑑、再孵一顆」(也免費)
function gm_petBuy_(p) {
  var emp = String(p.empId || '').trim(), e = gm_emp_(emp);
  if (!e || e.resigned) return { error: '帳號無法使用' };
  var cur = gm_pet_(emp);
  if (cur && cur.stage < 5) return { error: '寵物長到完全體,才能收進圖鑑再孵新的蛋' };
  var flavor = GM_PET_FLAVORS.indexOf(p.flavor) >= 0 ? p.flavor : '原味';
  var name = String(p.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 8) || '小雞蛋糕';
  if (cur) { gm_petSync_(cur); gm_petSet_(cur.row, 9, ['圖鑑']); gm_petEvent_(emp, 'retire', cur.name + '(' + cur.typeName + ')收進圖鑑'); gm_petDexBadge_(emp); }
  gm_append_('pets', [[emp, flavor, name, gm_today_(), '', 0, 1, '', '身邊', gm_petId_(), '']]);
  return { success: true, data: gm_pet_(emp) };
}
function gm_petUpdate_(p) {
  var emp = String(p.empId || '').trim(), pet = gm_pet_(emp); if (!pet) return { error: '還沒有寵物' };
  var acc = p.acc != null ? String(p.acc) : pet.acc, cat = gm_catalog_();
  if (acc && (!cat[acc] || cat[acc].cat !== 'petacc' || !gm_owned_(emp)[acc])) return { error: '還沒擁有這個配件' };
  var name = p.name != null ? String(p.name).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 8) : pet.name;
  gm_petSet_(pet.row, 3, [name || pet.name, pet.since, acc]);
  return { success: true, data: gm_pet_(emp) };
}
function gm_petDex_(emp) {   // 圖鑑:自己養到完全體的(收進圖鑑的,加上身邊已是完全體的)
  var out = [];
  gm_rows_('pets').forEach(function (r, i) {
    if (r[0] !== emp) return; var pt = gm_petFromRow_(r, i);
    if (pt.status === '圖鑑' || (pt.status === '身邊' && pt.stage >= 5)) out.push({ id: pt.id, name: pt.name, type: pt.type, typeName: pt.typeName, flavor: pt.flavor, current: pt.status === '身邊' });
  });
  return out;
}
function gm_petDexBadge_(emp) {
  var got = {}; gm_petDex_(emp).forEach(function (d) { if (d.type) got[d.type] = 1; });
  if (Object.keys(got).length >= GM_PET_TYPES.length) gm_award_(emp, 'pet_dex');
}
function gm_petAlbum_(petId) {
  return gm_rows_('album').filter(function (r) { return r[1] === petId; }).map(function (r) {
    return { stage: Number(r[2]), stageName: (GM_PET_STAGES[Number(r[2]) - 1] || [])[1], type: r[3], flavor: r[4], date: String(r[5]), hours: Number(r[6]) || 0 };
  }).sort(function (a, b) { return a.stage - b.stage; });
}
// 摸摸頭:每人對同一隻寵物每天一次;記在互動紀錄(類型 pat),算進互動之星
function gm_petPat_(p) {
  var from = String(p.empId || '').trim(), to = String(p.to || '').trim();
  if (!gm_emp_(from) || gm_isFrozen_(from)) return { error: '帳號無法使用' };
  if (from === to) return { error: '自己的寵物每天都能抱抱,不用摸頭啦' };
  var pet = gm_petSync_(gm_pet_(to)); if (!pet) return { error: '對方還沒有寵物' };
  var today = gm_today_();
  if (gm_rows_('inter').some(function (r) { return String(r[1]) === today && r[2] === from && r[3] === to && r[4] === 'pat'; })) return { error: '今天已經摸過牠了' };
  gm_append_('inter', [[gm_now_(), today, from, to, 'pat', '']]);
  gm_checkSocialBadges_(to);
  return { success: true, data: { stage: pet.stage, type: pet.type, name: pet.name } };
}
// ───── 交換:一對一、同階段、第 2~4 階段、雙方同意、每人 30 天一次、配件不跟著走 ─────
function gm_tradeLast_(emp) {
  var last = ''; gm_rows_('trades').forEach(function (r) { if (r[3] === '完成' && (r[1] === emp || r[2] === emp) && String(r[5]) > last) last = String(r[5]); });
  return last.slice(0, 10);
}
function gm_tradeCheck_(a, b) {
  var pa = gm_petSync_(gm_pet_(a)), pb = gm_petSync_(gm_pet_(b)), days = Number(gm_param_('寵物交換間隔天數')) || 30, today = gm_today_();
  if (!pa) return '你還沒有寵物'; if (!pb) return '對方還沒有寵物';
  if (pa.stage < 2 || pb.stage < 2 || !pa.type || !pb.type) return '還在蛋的階段不能交換';
  if (pa.stage >= 5 || pb.stage >= 5) return '完全體不能交換';
  if (pa.stage !== pb.stage) return '只能交換相同階段的寵物(你:第 ' + pa.stage + ' 階段,對方:第 ' + pb.stage + ' 階段)';
  var la = gm_tradeLast_(a), lb = gm_tradeLast_(b);
  if (la && gm_addDays_(la, days) > today) return '你在 ' + gm_addDays_(la, days) + ' 之後才能再交換';
  if (lb && gm_addDays_(lb, days) > today) return '對方在 ' + gm_addDays_(lb, days) + ' 之後才能再交換';
  return '';
}
function gm_tradeOffer_(p) {
  var from = String(p.empId || '').trim(), to = String(p.to || '').trim();
  if (!gm_emp_(from) || gm_isFrozen_(from)) return { error: '帳號無法使用' };
  if (!gm_emp_(to) || gm_isFrozen_(to) || from === to) return { error: '找不到這位夥伴' };
  var err = gm_tradeCheck_(from, to); if (err) return { error: err };
  if (gm_rows_('trades').some(function (r) { return r[3] === '等待中' && (r[1] === from || r[2] === from); })) return { error: '你已經有一筆等待中的交換,先處理完再提出' };
  var id = 'T' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss');
  gm_append_('trades', [[id, from, to, '等待中', gm_now_(), '']]);
  return { success: true };
}
function gm_tradeReply_(p) {
  var me = String(p.empId || '').trim(), id = String(p.id || ''), rows = gm_rows_('trades'), i = -1;
  for (var k = 0; k < rows.length; k++) if (rows[k][0] === id) i = k;
  if (i < 0) return { error: '找不到這筆交換' };
  var r = rows[i], row = i + 2, set = function (st) { var rng = gm_sh_('trades').getRange(row, 4, 1, 3); rng.setNumberFormat('@'); rng.setValues([[st, String(r[4]), gm_now_()]]); GM_CACHE_.rows_trades = null; };
  if (r[3] !== '等待中') return { error: '這筆交換已經處理過了' };
  if (p.cancel) { if (r[1] !== me) return { error: '只有提出的人可以取消' }; set('已取消'); return { success: true }; }
  if (r[2] !== me) return { error: '這筆交換不是給你的' };
  if (!p.accept) { set('已拒絕'); return { success: true }; }
  var err = gm_tradeCheck_(r[1], r[2]); if (err) { set('已失效'); return { error: '條件已經不符合:' + err }; }
  var pa = gm_pet_(r[1]), pb = gm_pet_(r[2]), today = gm_today_();
  // 交換後:換主人、領養日期改今天、累積時數存進「加成小時」(之後依新主人的工時繼續長)、配件拿下(留在原主人物品裡)
  gm_petSet_(pa.row, 1, [r[2]]); gm_petSet_(pa.row, 4, [today, '', String(pa.hours)]);
  gm_petSet_(pb.row, 1, [r[1]]); gm_petSet_(pb.row, 4, [today, '', String(pb.hours)]);
  set('完成');
  var ea = gm_emp_(r[1]), eb = gm_emp_(r[2]);
  gm_petEvent_(r[1], 'trade', (ea.nick || ea.name) + ' 和 ' + (eb.nick || eb.name) + ' 交換了寵物(' + pa.typeName + ' ⇄ ' + pb.typeName + ')');
  return { success: true, data: gm_pet_(me) };
}
function gm_tradesFor_(emp) {
  var emps = gm_emps_(), nm = function (id) { var e = emps[id]; return e ? (e.nick || e.name) : id; };
  return gm_rows_('trades').filter(function (r) { return r[3] === '等待中' && (r[1] === emp || r[2] === emp); }).map(function (r) {
    var other = r[1] === emp ? r[2] : r[1], op = gm_pet_(other);
    return { id: r[0], mine: r[1] === emp, other: other, otherName: nm(other), otherPet: op ? { name: op.name, type: op.type, typeName: op.typeName, stage: op.stage, flavor: op.flavor } : null, time: String(r[4]) };
  });
}
// ───── 寵物日記:每週一寫上週,只寫有上班的人 ─────
function gm_petDiaryWeekly_(today) {
  var t = new Date(today + 'T00:00:00Z'); if (t.getUTCDay() !== 1) return;
  var from = gm_addDays_(today, -7), to = gm_addDays_(today, -1), wk = from;
  var done = {}; gm_rows_('diary').forEach(function (r) { done[r[0] + '|' + r[1]] = 1; });
  var add = [];
  gm_rows_('pets').forEach(function (r, i) {
    if ((String(r[8] || '身邊') || '身邊') !== '身邊' || done[r[0] + '|' + wk] || gm_isFrozen_(r[0])) return;
    var pet = gm_petFromRow_(r, i), emp = r[0], mins = 0, locs = {};
    gm_rows_('hours').forEach(function (h) { if (h[1] === emp && String(h[0]) >= from && String(h[0]) <= to) { mins += Number(h[3]) || 0; locs[h[2]] = (locs[h[2]] || 0) + (Number(h[3]) || 0); } });
    if (mins < 60) return;
    var top = Object.keys(locs).sort(function (a, b) { return locs[b] - locs[a]; })[0] || '';
    var shortLoc = String(top).replace(/^\d+/, '').replace(/^(正櫃|快閃櫃|展覽|活動|分隊長)/, '');
    var recv = {}; gm_rows_('inter').forEach(function (x) { if (x[3] === emp && String(x[1]) >= from && String(x[1]) <= to) recv[x[2]] = 1; });
    var right = 0; gm_rows_('answers').forEach(function (x) { if (x[1] === emp && String(x[0]) >= from && String(x[0]) <= to && String(x[4]) === '對') right++; });
    var grew = gm_rows_('album').filter(function (x) { return x[1] === pet.id && String(x[5]) >= from && String(x[5]) <= to && Number(x[2]) >= 2; }).map(function (x) { return Number(x[2]); });
    var parts = ['這週陪主人在' + (shortLoc || '櫃位') + '上了 ' + Math.round(mins / 6) / 10 + ' 小時班'];
    if (Object.keys(recv).length) parts.push('主人收到 ' + Object.keys(recv).length + ' 位夥伴的加油');
    if (right) parts.push('我們一起答對了 ' + right + ' 題');
    var txt = parts.join(',') + '。';
    if (grew.length) txt += '我長大了,現在是「' + GM_PET_STAGES[Math.max.apply(null, grew) - 1][1] + '」!';
    txt += ['下週也一起加油!', '主人辛苦了~', '最喜歡陪主人上班了!'][Math.floor(Math.random() * 3)];
    add.push([emp, wk, txt, gm_now_()]);
  });
  if (add.length) gm_append_('diary', add);
}
function gm_lastWorkDate_(emp) {
  var today = gm_today_(), last = ''; gm_rows_('hours').forEach(function (r) { if (r[1] === emp && String(r[0]) < today && String(r[0]) > last && Number(r[3]) > 0) last = String(r[0]); });
  return last;
}

// ───────── 互動 ─────────
function gm_interact_(p) {
  var from = String(p.empId || '').trim(), to = String(p.to || '').trim(), type = String(p.type || '');
  if (!gm_emp_(from) || gm_isFrozen_(from)) return { error: '帳號無法使用' };
  if (!gm_emp_(to) || gm_isFrozen_(to)) return { error: '找不到這位夥伴' };
  if (from === to) return { error: '不能對自己互動' };
  if (!GM_INTER_TYPES[type] || type === 'pat') return { error: '互動類型不正確' };
  var today = gm_today_(), dup = gm_rows_('inter').some(function (r) { return String(r[1]) === today && r[2] === from && r[3] === to && r[4] === type; });
  if (dup) return { error: '今天已經對他' + GM_INTER_TYPES[type] + '過了' };
  gm_append_('inter', [[gm_now_(), today, from, to, type, '']]);
  gm_checkSocialBadges_(to);
  return { success: true };
}
function gm_inboxRead_(p) {
  var emp = String(p.empId || '').trim(), sh = gm_sh_('inter'), rows = gm_rows_('inter');
  rows.forEach(function (r, i) { if (r[3] === emp && !r[5]) sh.getRange(i + 2, 6).setValue('Y'); });
  return { success: true };
}

// ───────── 每日一題 ─────────
function gm_hash_(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
function gm_todayQuestion_(emp) {
  var today = gm_today_(), done = {}, todayRow = null;
  gm_rows_('answers').forEach(function (r) { if (r[1] === emp) { done[r[2]] = 1; if (String(r[0]) === today) todayRow = r; } });
  var qs = gm_rows_('quiz').filter(function (r) { return String(r[0]).trim() && !/^(否|N|FALSE|false)$/.test(String(r[9]).trim()); });
  if (todayRow) {
    var q0 = qs.filter(function (r) { return String(r[0]) === String(todayRow[2]); })[0];
    return { answered: true, correct: String(todayRow[4]) === '對', choice: todayRow[3], q: q0 };
  }
  var pool = qs.filter(function (r) { return !done[r[0]]; }); if (!pool.length) pool = qs;
  if (!pool.length) return { none: true };
  return { answered: false, q: pool[gm_hash_(emp + today) % pool.length] };
}
function gm_qOut_(r, withAnswer) {
  if (!r) return null;
  var o = { id: String(r[0]), cat: r[1], text: r[2], options: { A: r[3], B: r[4], C: r[5], D: r[6] } };
  if (withAnswer) { o.answer = String(r[7]).trim().toUpperCase(); o.explain = r[8]; }
  return o;
}
function gm_answer_(p) {
  var emp = String(p.empId || '').trim(); if (!gm_emp_(emp) || gm_isFrozen_(emp)) return { error: '帳號無法使用' };
  if (gm_today_() < gm_param_('測試版開始日')) return { error: '每日一題將於測試版開始後開放' };
  var st = gm_todayQuestion_(emp); if (st.none) return { error: '題庫還沒有題目' };
  if (st.answered) return { error: '今天已經作答過了' };
  if (String(p.qid) !== String(st.q[0])) return { error: '題目已更新,請重新整理' };
  var ans = String(p.answer || '').toUpperCase(), right = ans === String(st.q[7]).trim().toUpperCase(), today = gm_today_();
  gm_append_('answers', [[today, emp, st.q[0], ans, right ? '對' : '錯', gm_now_()]]);
  var bonus = 0;
  if (right) {
    gm_credit_(emp, '每日一題', gm_param_('每日一題獎勵'), '每日一題答對', 'QUIZ|' + emp + '|' + today);
    // 連續 7 天答對
    var map = {}; gm_rows_('answers').forEach(function (r) { if (r[1] === emp) map[String(r[0])] = String(r[4]) === '對'; });
    var n = 0; for (var d = today; map[d]; d = gm_addDays_(d, -1)) n++;
    if (n > 0 && n % 7 === 0) { bonus = Number(gm_param_('連續答對7天加碼')) || 0; gm_credit_(emp, '每日一題', bonus, '連續答對 ' + n + ' 天', 'QSTREAK|' + emp + '|' + today); gm_drop_(emp, '每日一題連續答對 ' + n + ' 天', 'QDROP|' + emp + '|' + today); }
  }
  gm_checkSocialBadges_(emp);
  return { success: true, data: { correct: right, question: gm_qOut_(st.q, true), bonus: bonus, balance: gm_balance_(emp) } };
}

// ───────── 生日祝福 ─────────
function gm_birthdaysToday_() {
  var md = gm_today_().slice(5), emps = gm_emps_(), out = [];
  Object.keys(emps).forEach(function (id) { var e = emps[id]; if (!e.resigned && gm_bdMD_(e.birthday) === md) out.push({ id: id, name: e.nick || e.name }); });
  return out;
}
function gm_wish_(p) {
  var from = String(p.empId || '').trim(), to = String(p.to || '').trim(), today = gm_today_();
  if (!gm_emp_(from) || gm_isFrozen_(from)) return { error: '帳號無法使用' };
  if (!gm_birthdaysToday_().some(function (b) { return b.id === to; })) return { error: '今天不是他的生日' };
  if (from === to) return { error: '不能祝福自己' };
  var rows = gm_rows_('wishes');
  if (rows.some(function (r) { return String(r[0]) === today && r[1] === to && r[2] === from; })) return { error: '已經送過祝福了' };
  gm_append_('wishes', [[today, to, from, gm_now_()]]);
  var sentToday = rows.filter(function (r) { return String(r[0]) === today && r[2] === from; }).length;
  if (sentToday <= 3) gm_credit_(from, '送祝福', gm_param_('送祝福獎勵'), '祝 ' + (gm_emp_(to).nick || gm_emp_(to).name) + ' 生日快樂', 'WISH|' + from + '|' + to + '|' + today);
  return { success: true };
}

// ───────── 團隊基金 ─────────
function gm_fundInfo_() {
  var total = 0, by = {};
  gm_rows_('fund').forEach(function (r) { var n = Number(r[2]) || 0; total += n; by[r[1]] = (by[r[1]] || 0) + n; });
  var tiers = String(gm_param_('基金解鎖') || '').split(',').map(function (s) { var a = s.split(':'); return { at: Number(a[0]), key: String(a[1] || '').trim() }; })
    .filter(function (x) { return x.at > 0 && x.key; }).sort(function (a, b) { return a.at - b.at; });
  var emps = gm_emps_();
  var top = Object.keys(by).map(function (k) { return { id: k, name: emps[k] ? (emps[k].nick || emps[k].name) : k, amount: by[k] }; })
    .sort(function (a, b) { return b.amount - a.amount; }).slice(0, 5);
  return { total: total, tiers: tiers.map(function (t) { return { at: t.at, key: t.key, unlocked: total >= t.at }; }), top: top, by: by };
}
function gm_donate_(p) {
  var emp = String(p.empId || '').trim(), amt = Math.floor(Number(p.amount) || 0);
  if (!gm_emp_(emp) || gm_isFrozen_(emp)) return { error: '帳號無法使用' };
  if (amt < (Number(gm_param_('捐獻最低')) || 10)) return { error: '一次至少捐 ' + gm_param_('捐獻最低') + ' 枚' };
  if (gm_balance_(emp) < amt) return { error: '赤心幣不足' };
  var n = gm_rows_('fund').length + 1;
  gm_credit_(emp, '捐獻', -amt, '捐入團隊基金', 'FUND|' + emp + '|' + n + '|' + gm_now_());
  gm_append_('fund', [[gm_now_(), emp, amt]]);
  gm_checkSocialBadges_(emp);
  return { success: true, data: { balance: gm_balance_(emp), fund: gm_fundInfo_() } };
}

// ───────── 徽章配戴 ─────────
function gm_wear_(p) {
  var emp = String(p.empId || '').trim(), want = [];
  try { want = typeof p.badges === 'string' ? JSON.parse(p.badges) : (p.badges || []); } catch (e) { want = []; }
  want = want.slice(0, 3);
  var sh = gm_sh_('badges'), rows = gm_rows_('badges'), seen = {};
  rows.forEach(function (r, i) {
    if (r[0] !== emp) return;
    var on = want.indexOf(r[1]) >= 0 && !seen[r[1]];
    if (on) seen[r[1]] = 1;
    if ((r[4] === 'Y') !== on) sh.getRange(i + 2, 5).setValue(on ? 'Y' : '');
  });
  return { success: true };
}

// ───────── 寵物小遊戲 ─────────
function gm_weekFrom_(d) { var t = new Date(d + 'T00:00:00Z'); return gm_addDays_(d, -((t.getUTCDay() + 6) % 7)); }
function gm_games_(p) {
  var emp = String(p.empId || '').trim(), pet = gm_pet_(emp), today = gm_today_(), wk = gm_weekFrom_(today), emps = gm_emps_();
  var best = {}, week = {}, todayGot = 0;
  gm_rows_('games').forEach(function (r) {
    var g = r[3], sc = Number(r[4]) || 0;
    if (r[2] === emp) { best[g] = Math.max(best[g] || 0, sc); if (String(r[1]) === today) todayGot += Number(r[5]) || 0; }
    if (String(r[1]) >= wk) { var k = g + '|' + r[2]; week[k] = Math.max(week[k] || 0, sc); }
  });
  var games = GM_GAMES.map(function (g) {
    var top = Object.keys(week).filter(function (k) { return k.split('|')[0] === g[0]; }).map(function (k) { var id = k.split('|')[1]; return { name: emps[id] ? (emps[id].nick || emps[id].name) : id, score: week[k], me: id === emp }; })
      .sort(function (a, b) { return b.score - a.score; }).slice(0, 5);
    return { id: g[0], name: g[1], stage: g[2], reward: g[3], unlocked: !!pet && pet.stage >= g[2], best: best[g[0]] || 0, top: top };
  });
  var lives = pet ? Number((gm_rows_('pets')[pet.row - 2] || [])[6]) || 0 : 0;
  return { success: true, data: { pet: pet, games: games, todayGot: todayGot, cap: Number(gm_param_('小遊戲每日上限')) || 5, extraLives: lives } };
}
function gm_gameStart_(p) {   // 開局:有寵物零食加的命就用掉一條
  var emp = String(p.empId || '').trim(), pet = gm_pet_(emp); if (!pet) return { error: '先領養寵物才能玩' };
  var g = GM_GAMES.filter(function (x) { return x[0] === p.game; })[0]; if (!g) return { error: '沒有這款遊戲' };
  if (pet.stage < g[2]) return { error: '寵物長到第 ' + g[2] + ' 階段才解鎖' };
  var lives = Number(gm_rows_('pets')[pet.row - 2][6]) || 0, extra = 0;
  if (lives > 0) { var rng = gm_sh_('pets').getRange(pet.row, 7); rng.setNumberFormat('@'); rng.setValue(String(lives - 1)); extra = 1; GM_CACHE_.rows_pets = null; }
  return { success: true, data: { extra: extra, left: Math.max(0, lives - extra) } };
}
function gm_gameScore_(p) {
  var emp = String(p.empId || '').trim(), e = gm_emp_(emp); if (!e || e.resigned) return { error: '帳號無法使用' };
  var g = GM_GAMES.filter(function (x) { return x[0] === p.game; })[0]; if (!g) return { error: '沒有這款遊戲' };
  var pet = gm_pet_(emp); if (!pet || pet.stage < g[2]) return { error: '這款遊戲還沒解鎖' };
  var score = Math.max(0, Math.min(g[4], Math.round(Number(p.score) || 0))), today = gm_today_();
  var best = 0, got = 0;
  gm_rows_('games').forEach(function (r) { if (r[2] === emp) { if (r[3] === g[0]) best = Math.max(best, Number(r[4]) || 0); if (String(r[1]) === today) got += Number(r[5]) || 0; } });
  var cap = Number(gm_param_('小遊戲每日上限')) || 5, reward = 0;
  if (score > best && score > 0 && today >= gm_param_('測試版開始日')) {
    reward = Math.max(0, Math.min(g[3], cap - got));
    if (reward) gm_credit_(emp, '小遊戲', reward, g[1] + ' 破個人紀錄(' + score + ' 分)', 'GAME|' + emp + '|' + g[0] + '|' + gm_now_() + '|' + score);
  }
  gm_append_('games', [[gm_now_(), today, emp, g[0], score, reward]]);
  return { success: true, data: { score: score, best: Math.max(best, score), newRecord: score > best, reward: reward } };
}
function gm_gameWeekly_(today) {   // 每週一:上週各遊戲第一名頒「小遊戲週冠軍」
  if (((new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7) !== 0) return;
  var from = gm_addDays_(today, -7), to = gm_addDays_(today, -1), top = {};
  gm_rows_('games').forEach(function (r) {
    var d = String(r[1]); if (d < from || d > to) return;
    var sc = Number(r[4]) || 0; if (!top[r[3]] || sc > top[r[3]].sc) top[r[3]] = { emp: r[2], sc: sc };
  });
  Object.keys(top).forEach(function (g) { if (top[g].sc > 0 && !gm_isFrozen_(top[g].emp)) gm_award_(top[g].emp, 'gamer', g + '|' + from); });
}

// ───────── 管理者 ─────────
function gm_admin_(p) {
  var me = gm_emp_(p.empId); if (!gm_isTop_(me)) return { error: '只有大隊長(第 5 級)與總經理(第 4 級)可以使用' };
  var target = String(p.target || '').trim(), reason = String(p.reason || '').trim().slice(0, 100);
  if (!gm_emp_(target)) return { error: '找不到員工編號 ' + target };
  if (!reason) return { error: '請填寫理由' };
  if (p.badge) {
    if (['mentor', 'special'].indexOf(p.badge) < 0) return { error: '只能手動頒發「好導師」或「特別貢獻」' };
    var ok = gm_award_(target, p.badge, gm_now_(), p.amount != null && p.amount !== '' ? Number(p.amount) : null);
    gm_append_('ledger', [[gm_now_(), target, '管理紀錄', 0, me.name + ' 頒發徽章 ' + p.badge + ':' + reason, '']]);
    return ok ? { success: true } : { error: '頒發失敗' };
  }
  var amt = Math.round(Number(p.amount) || 0); if (!amt) return { error: '請輸入數量' };
  gm_credit_(target, '管理調整', amt, me.name + ':' + reason, 'ADMIN|' + target + '|' + gm_now_() + '|' + Math.random());
  return { success: true, data: { balance: gm_balance_(target) } };
}

// ───────── 給 App 的資料包 ─────────
function gm_me_(p) {
  var emp = String(p.empId || '').trim(), e = gm_emp_(emp); if (!e) return { error: '找不到此帳號' };
  var today = gm_today_(), ym = today.slice(0, 7), cat = gm_catalog_(), owned = gm_owned_(emp);
  var myPet = gm_petSync_(gm_pet_(emp));   // 順便處理孵化與相簿
  var ledger = gm_rows_('ledger').filter(function (r) { return r[1] === emp && Number(r[3]); }).slice(-30).reverse()
    .map(function (r) { return { time: String(r[0]), type: r[2], amount: Number(r[3]), note: r[4] }; });
  var mine = {}; gm_rows_('badges').forEach(function (r) { if (r[0] === emp) (mine[r[1]] = mine[r[1]] || []).push({ period: String(r[2]), time: String(r[3]), worn: r[4] === 'Y' }); });
  var badges = GM_BADGES.map(function (b) { return { id: b[0], name: b[1], icon: b[2], desc: b[3], coins: b[4], got: mine[b[0]] || [] }; });
  var qs = gm_todayQuestion_(emp);
  var inbox = gm_rows_('inter').filter(function (r) { return r[3] === emp; }).slice(-20).reverse().map(function (r) {
    var f = gm_emp_(r[2]); return { time: String(r[0]), from: r[2], fromName: f ? (f.nick || f.name) : r[2], type: r[4], label: GM_INTER_TYPES[r[4]] || r[4], unread: !r[5] };
  });
  var sentToday = gm_rows_('inter').filter(function (r) { return r[2] === emp && String(r[1]) === today; }).map(function (r) { return r[3] + '|' + r[4]; });
  var bdays = gm_birthdaysToday_().map(function (b) {
    var w = gm_rows_('wishes').filter(function (r) { return String(r[0]) === today && r[1] === b.id; });
    return { id: b.id, name: b.name, wishes: w.length, wished: w.some(function (r) { return r[2] === emp; }),
             from: b.id === emp ? w.map(function (r) { var f = gm_emp_(r[2]); return f ? (f.nick || f.name) : r[2]; }) : [] };
  });
  var gThis = gm_rows_('gacha').filter(function (r) { return r[1] === emp && String(r[0]).slice(0, 7) === ym; }).length;
  var fund = gm_fundInfo_();
  var params = {}; ['測試版開始日', '正式版開始日', '正式版加倍倍率', '扭蛋價格', '扭蛋每月上限', '扭蛋機率_稀有', '扭蛋機率_傳說', '扭蛋保底次數', '扭蛋重複退幣', '寵物價格', '捐獻最低', '冠軍櫃位總獎勵', '互動之星獎勵']
    .forEach(function (k) { params[k] = gm_param_(k); });
  return { success: true, data: {
    balance: gm_balance_(emp), frozen: e.resigned, role: e.role, isTop: gm_isTop_(e), today: today, params: params, ledger: ledger,
    catalog: Object.keys(cat).map(function (k) { var c = cat[k]; return { id: c.id, name: c.name, cat: c.cat, tier: c.tier, price: c.price, where: c.where, series: c.series, owned: !!owned[k] }; }),
    badges: badges, pet: myPet, petStages: GM_PET_STAGES, petTypes: GM_PET_TYPES,
    petAlbum: myPet ? gm_petAlbum_(myPet.id) : [], petDex: gm_petDex_(emp), petEverOwned: gm_rows_('pets').some(function (r) { return r[0] === emp; }),
    petDiary: gm_rows_('diary').filter(function (r) { return r[0] === emp; }).slice(-12).reverse().map(function (r) { return { week: String(r[1]), text: r[2] }; }),
    petTrades: gm_tradesFor_(emp), petTradeNext: (function () { var l = gm_tradeLast_(emp); return l ? gm_addDays_(l, Number(gm_param_('寵物交換間隔天數')) || 30) : ''; })(),
    lastWork: gm_lastWorkDate_(emp),
    petPartners: (function () {   // 可以提出交換的夥伴(同階段、第 2~4 階段)
      if (!myPet || myPet.stage < 2 || myPet.stage >= 5) return [];
      var out = [], emps = gm_emps_();
      gm_rows_('pets').forEach(function (r, i) {
        if (r[0] === emp || (String(r[8] || '身邊') || '身邊') !== '身邊' || !emps[r[0]] || emps[r[0]].resigned) return;
        var pt = gm_petFromRow_(r, i); if (pt.stage !== myPet.stage || !pt.type) return;
        out.push({ id: r[0], name: emps[r[0]].nick || emps[r[0]].name, pet: { name: pt.name, type: pt.type, typeName: pt.typeName, flavor: pt.flavor, stage: pt.stage } });
      });
      return out;
    })(),
    quiz: qs.none ? { none: true } : { answered: qs.answered, correct: qs.correct, choice: qs.choice, question: gm_qOut_(qs.q, qs.answered) },
    inbox: inbox, sentToday: sentToday, birthdays: bdays,
    gifts: typeof pv_rows_ === 'function' ? pv_rows_('gifts').filter(function (r) { return r[2] === emp && !r[4]; }).map(function (r) {
      var f = gm_emp_(r[1]), c = gm_catalog_()[r[3]] || {}; return { from: f ? (f.nick || f.name) : r[1], item: c.name, icon: String(c.note || '').split(':')[1] || '🎁' }; }) : [],
    gacha: { used: gThis, left: Math.max(0, (Number(gm_param_('扭蛋每月上限')) || 5) - gThis) },
    fund: { total: fund.total, tiers: fund.tiers, top: fund.top, mine: fund.by[emp] || 0 },
    ranking: gm_revenueRank_(ym).map(function (x, i) { return { rank: i + 1, loc: x.loc, rev: x.rev }; }),
    champion: { ym: gm_prevMonth_(ym), loc: gm_getState_('冠軍櫃位_' + gm_prevMonth_(ym)) }
  } };
}
// 宇宙辦公室用的公開資料(不含金額):寵物、配戴徽章、生日、冠軍、基金解鎖、最近互動
function gm_scene_() {
  var emps = gm_emps_(), pets = {}, worn = {};
  gm_rows_('pets').forEach(function (r, i) { if ((String(r[8] || '身邊') || '身邊') !== '身邊') return; var pt = gm_petFromRow_(r, i); pets[r[0]] = { flavor: pt.flavor, name: pt.name, stage: pt.stage, acc: pt.acc, type: pt.type }; });
  var icon = {}; GM_BADGES.forEach(function (b) { icon[b[0]] = b[2]; });
  gm_rows_('badges').forEach(function (r) { if (r[4] === 'Y') (worn[r[0]] = worn[r[0]] || []).push(icon[r[1]] || ''); });
  var feed = gm_rows_('inter').slice(-15).reverse().map(function (r) {
    var a = emps[r[2]], b = emps[r[3]];
    return { time: String(r[0]), from: r[2], to: r[3], fromName: a ? (a.nick || a.name) : r[2], toName: b ? (b.nick || b.name) : r[3], type: r[4], label: GM_INTER_TYPES[r[4]] };
  });
  var petFeed = gm_rows_('petlog').slice(-10).reverse().map(function (r) { return { time: String(r[0]), emp: r[1], kind: r[2], text: r[3] }; });
  var ym = gm_today_().slice(0, 7);
  var boss = null; Object.keys(emps).forEach(function (id) { var e = emps[id]; if (!boss && !e.resigned && (e.pos === '大隊長' || e.role >= 5)) boss = { id: id, name: e.nick || e.name }; });
  return { success: true, data: { pets: pets, worn: worn, birthdays: gm_birthdaysToday_(), feed: feed, petFeed: petFeed, boss: boss,
    champion: gm_getState_('冠軍櫃位_' + gm_prevMonth_(ym)), unlocks: gm_fundInfo_().tiers.filter(function (t) { return t.unlocked; }).map(function (t) { return t.key; }),
    anniversary: String(gm_param_('品牌週年日') || '') } };
}

// ───────── 路由 ─────────
function gmHandler_(action, p) {
  if (!/^gm[A-Z]/.test(String(action || ''))) return null;
  p = p || {};
  try {
    GM_CACHE_ = {};
    var write = ['gmGameStart', 'gmGameScore', 'gmBuy', 'gmGacha', 'gmPetBuy', 'gmPetUpdate', 'gmPetPat', 'gmPetTrade', 'gmPetTradeReply', 'gmInteract', 'gmInboxRead', 'gmAnswer', 'gmWish', 'gmDonate', 'gmWear', 'gmAdmin', 'gmRunDaily'];
    var lock = null;
    if (write.indexOf(action) >= 0) { lock = LockService.getScriptLock(); lock.waitLock(20000); }
    try {
      switch (action) {
        case 'gmMe': return gm_me_(p);
        case 'gmScene': return gm_scene_();
        case 'gmBuy': return gm_buy_(p);
        case 'gmGacha': return gm_gacha_(p);
        case 'gmPetBuy': return gm_petBuy_(p);
        case 'gmPetUpdate': return gm_petUpdate_(p);
        case 'gmPetPat': return gm_petPat_(p);
        case 'gmPetTrade': return gm_tradeOffer_(p);
        case 'gmPetTradeReply': return gm_tradeReply_(p);
        case 'gmInteract': return gm_interact_(p);
        case 'gmInboxRead': return gm_inboxRead_(p);
        case 'gmAnswer': return gm_answer_(p);
        case 'gmWish': return gm_wish_(p);
        case 'gmDonate': return gm_donate_(p);
        case 'gmWear': return gm_wear_(p);
        case 'gmAdmin': return gm_admin_(p);
        case 'gmGames': return gm_games_(p);
        case 'gmGameStart': return gm_gameStart_(p);
        case 'gmGameScore': return gm_gameScore_(p);
        case 'gmRunDaily': { var me = gm_emp_(p.empId); if (!gm_isTop_(me)) return { error: '只有大隊長與總經理可以使用' };
          if (lock) { lock.releaseLock(); lock = null; } gm_dailyJob(); return { success: true }; }
      }
    } finally { if (lock) lock.releaseLock(); }
    return { error: '未知的遊戲動作' };
  } catch (e) { return { error: '遊戲功能發生錯誤:' + e.message }; }
}

// ═══════════════════════════════════════════════════════════════
// 紅玉滿宇宙:PvP 對戰(自動＋即時)、百貨櫃位塔防戰、夥伴小店   v1.19(2026-11-11:寵物屬性與相剋)
// 需要先安裝「後端_宇宙遊戲化」模組(共用 gm_ 開頭的工具、赤心幣、商品目錄)。
// 安裝:貼到 Apps Script 最底部;extHandler_ 內加一行:
//   var pv = pvHandler_(action, p); if (pv) return pv;
// 執行一次 pv_setup() 建立工作表與預設參數。塔防週戰由 gm_dailyJob 每週一自動結算。
// ═══════════════════════════════════════════════════════════════
var PV_SHEETS = {
  equip:  ['對戰裝備', ['員工編號', '武器', '防具', '卡片', '參加']],
  duels:  ['對戰紀錄', ['時間', '日期', '挑戰者', '對手', '勝者', '模式', '紀錄']],
  live:   ['即時對戰', ['編號', '挑戰者', '對手', '狀態', '建立時間', '更新時間', '狀態資料']],
  towers: ['塔防', ['櫃位', '箭塔', '砲塔', '城牆', '累計投入']],
  tdLog:  ['塔防戰報', ['週', '櫃位A', '櫃位B', '勝者', '紀錄']],
  tdGive: ['塔防投入', ['時間', '員工編號', '櫃位', '塔', '數量']],
  shops:  ['小店', ['員工編號', '店名', '店型', '開店時間', '價格', '營收', '銷售次數', '公告']],
  sales:  ['小店交易', ['時間', '店主', '買家', '物品編號', '價格', '店主收入', '收件人']],
  gifts:  ['禮物', ['時間', '送禮人', '收禮人', '物品編號', '已讀']]
};
var PV_PARAMS = [
  ['對戰每日次數', 5, '自動切磋每天可以挑戰幾次'],
  ['對戰勝利獎勵', 2, '贏一場給幾枚(自動與即時合計每天上限見下)'],
  ['對戰每日獎勵上限', 10, ''],
  ['即時對戰每回合秒數', 20, '時間到沒出招,自動普通攻擊'],
  ['塔防升級基本價', 50, '升到 n+1 級要投入 基本價×n 枚'],
  ['塔防營業額換算', 10000, '每週營業額每多少元 = 1 點攻擊加成'],
  ['塔防冠軍獎勵', 300, '每週冠軍櫃位,依該週上班時數分給夥伴'],
  ['小店開店費', 100, ''],
  ['小店店主分潤', 80, '百分比,其餘由系統回收'],
  ['小店價格下限', 80, '建議價的百分比'],
  ['小店價格上限', 150, '建議價的百分比']
];
var PV_SHOP_TYPES = ['咖啡店', '甜點店', '花店', '武器鋪', '卡片屋', '雜貨店'];
var PV_BASE = { hp: 100, atk: 10, def: 5, spd: 5 };

function pv_sh_(k) {
  var key = 'pv_' + k; if (GM_CACHE_['sh_' + key]) return GM_CACHE_['sh_' + key];
  var d = PV_SHEETS[k], sh = gm_ss_().getSheetByName(d[0]);
  if (!sh) { sh = gm_ss_().insertSheet(d[0]); sh.getRange(1, 1, 1, d[1].length).setValues([d[1]]); sh.setFrozenRows(1); }
  GM_SHEETS[key] = d; return (GM_CACHE_['sh_' + key] = sh);
}
function pv_rows_(k) { pv_sh_(k); return gm_rows_('pv_' + k); }
function pv_append_(k, rows) { pv_sh_(k); gm_append_('pv_' + k, rows); }
function pv_param_(n) { var v = gm_param_(n); if (v === undefined) PV_PARAMS.forEach(function (p) { if (p[0] === n) v = p[1]; }); return Number(v); }
function pv_setup() {
  Object.keys(PV_SHEETS).forEach(function (k) { pv_sh_(k); });
  var have = {}; gm_rows_('params').forEach(function (r) { have[String(r[0]).trim()] = 1; });
  var add = PV_PARAMS.filter(function (p) { return !have[p[0]]; }); if (add.length) gm_append_('params', add);
  if (typeof gm_setup === 'function') gm_setup();
  return '已建立對戰、塔防、小店工作表';
}
function pv_stats_(itemId) {    // "atk:3,spd:1" → {atk:3,spd:1};"card:heal:30" → {card:'heal',val:30}
  var c = gm_catalog_()[itemId]; if (!c) return {};
  var s = String(c.note || ''), o = {};
  if (/^card:/.test(s)) { var a = s.split(':'); return { card: a[1], val: Number(a[2]) || 0 }; }
  s.split(',').forEach(function (kv) { var a = kv.split(':'); if (a.length === 2 && PV_BASE[a[0]] != null) o[a[0]] = Number(a[1]) || 0; });
  return o;
}

// ───────── 角色與裝備 ─────────
function pv_equipRow_(emp) {
  var rows = pv_rows_('equip');
  for (var i = 0; i < rows.length; i++) if (rows[i][0] === emp) return { row: i + 2, weapon: String(rows[i][1] || ''), armor: String(rows[i][2] || ''), cards: pv_json_(rows[i][3], []), join: String(rows[i][4]) !== 'N' };
  return { row: 0, weapon: '', armor: '', cards: [], join: true };
}
function pv_json_(v, d) { try { return v ? JSON.parse(v) : d; } catch (e) { return d; } }
function pv_fighter_(emp) {
  var e = gm_emp_(emp); if (!e) return null;
  var q = pv_equipRow_(emp), own = gm_owned_(emp), st = { hp: PV_BASE.hp, atk: PV_BASE.atk, def: PV_BASE.def, spd: PV_BASE.spd };
  [q.weapon, q.armor].forEach(function (id) { if (id && own[id]) { var s = pv_stats_(id); Object.keys(s).forEach(function (k) { if (st[k] != null) st[k] += s[k]; }); } });
  var pet = gm_pet_(emp); if (pet) st.hp += pet.stage * 4;           // 寵物陪伴:每階段 +4 體力
  st.crit = 0;
  if (pet && pet.type && PV_PET_ATTR[pet.type]) {                    // v1.19 寵物屬性:第 2~5 階段發揮 25/50/75/100%
    var at = PV_PET_ATTR[pet.type], pct = [0, 0, 0.25, 0.5, 0.75, 1][pet.stage] || 0;
    st[at.stat] += at.stat === 'crit' ? at.val * pct : Math.round(at.val * pct);
  }
  var cards = q.cards.filter(function (c) { return own[c]; }).slice(0, 3).map(function (c) { var s = pv_stats_(c); return { id: c, name: gm_catalog_()[c].name, kind: s.card, val: s.val }; });
  var cat = gm_catalog_();
  return { id: emp, name: e.nick || e.name, stats: st, weapon: q.weapon && own[q.weapon] ? cat[q.weapon].name : '', armor: q.armor && own[q.armor] ? cat[q.armor].name : '', cards: cards, join: q.join, pet: pet ? pet.stage : 0,
           petType: pet && pet.type ? pet.type : '', petTypeName: pet && pet.type ? pet.typeName : '' };
}
function pv_setEquip_(p) {
  var emp = String(p.empId || '').trim(); if (!gm_emp_(emp)) return { error: '找不到此帳號' };
  var own = gm_owned_(emp), cat = gm_catalog_(), q = pv_equipRow_(emp);
  var w = p.weapon != null ? String(p.weapon) : q.weapon, a = p.armor != null ? String(p.armor) : q.armor;
  var cards = p.cards != null ? pv_json_(p.cards, []) : q.cards, join = p.join != null ? String(p.join) !== 'N' && p.join !== false : q.join;
  if (w && (!own[w] || cat[w].cat !== 'weapon')) return { error: '還沒擁有這把武器' };
  if (a && (!own[a] || cat[a].cat !== 'armor')) return { error: '還沒擁有這件防具' };
  cards = cards.filter(function (c, i) { return own[c] && cat[c].cat === 'card' && cards.indexOf(c) === i; }).slice(0, 3);
  var row = [emp, w, a, JSON.stringify(cards), join ? 'Y' : 'N'];
  if (q.row) { var rng = pv_sh_('equip').getRange(q.row, 1, 1, 5); rng.setNumberFormat('@'); rng.setValues([row]); GM_CACHE_.rows_pv_equip = null; }
  else pv_append_('equip', [row]);
  return { success: true, data: pv_fighter_(emp) };
}

// ───────── 寵物屬性與相剋(v1.19,隊長 11/11 定案)─────────
// 暴龍攻擊型、三角龍防禦型、火車速度型、挖土機體力型、雞幸運型(爆擊率,百分點)
var PV_PET_ATTR = { trex: { stat: 'atk', val: 3, label: '攻擊型' }, trice: { stat: 'def', val: 2, label: '防禦型' },
                    train: { stat: 'spd', val: 2, label: '速度型' }, digger: { stat: 'hp', val: 15, label: '體力型' }, chicken: { stat: 'crit', val: 5, label: '幸運型' } };
// 五種循環相剋:每種剋 2 種、被 2 種剋
var PV_COUNTER = { trex: ['trice', 'digger'], trice: ['digger', 'train'], digger: ['train', 'chicken'], train: ['chicken', 'trex'], chicken: ['trex', 'trice'] };
function pv_counterMult_(a, b) {
  var ta = a.petType, tb = b.petType;
  return ta && tb && (PV_COUNTER[ta] || []).indexOf(tb) >= 0 ? (Number(gm_param_('相剋傷害倍率')) || 1.2) : 1;
}

// ───────── 戰鬥核心(自動與即時共用)─────────
// 招式:attack 普通攻擊、defend 防禦(受傷×0.4,回 3)、skill 必殺(×1.8,冷卻 3 回合)、card 使用卡片(每張一場一次)
function pv_rand_(seed) { var x = Math.sin(seed) * 10000; return x - Math.floor(x); }
function pv_newBattle_(A, B) {
  return { round: 0, hp: { A: A.stats.hp, B: B.stats.hp }, max: { A: A.stats.hp, B: B.stats.hp }, cd: { A: 0, B: 0 }, used: { A: [], B: [] },
           buff: { A: 0, B: 0 }, shield: { A: 0, B: 0 }, log: [], f: { A: A, B: B }, done: false, winner: '' };
}
function pv_round_(S, mA, mB, seed) {   // m = {move:'attack'|'defend'|'skill'|'card', card:id}
  S.round++;
  var side = ['A', 'B'], m = { A: mA, B: mB }, ev = { round: S.round, A: {}, B: {} };
  side.forEach(function (s) {           // 先處理卡片、冷卻
    var mv = m[s] || { move: 'attack' };
    if (mv.move === 'skill' && S.cd[s] > 0) mv = { move: 'attack' };
    if (mv.move === 'card') {
      var c = (S.f[s].cards || []).filter(function (x) { return x.id === mv.card && S.used[s].indexOf(x.id) < 0; })[0];
      if (!c) mv = { move: 'attack' };
      else {
        S.used[s].push(c.id); ev[s].card = c.name;
        if (c.kind === 'heal') { var h = Math.min(c.val, S.max[s] - S.hp[s]); S.hp[s] += h; ev[s].heal = h; }
        if (c.kind === 'power') S.buff[s] = c.val;
        if (c.kind === 'shield') S.shield[s] += c.val;
      }
    }
    m[s] = mv; ev[s].move = mv.move;
  });
  side.forEach(function (s, i) {        // 攻擊
    var o = side[1 - i], mv = m[s];
    if (mv.move === 'defend') { var hh = Math.min(3, S.max[s] - S.hp[s]); S.hp[s] += hh; ev[s].heal = (ev[s].heal || 0) + hh; return; }
    var atk = S.f[s].stats.atk * (1 + S.buff[s] / 100), r = 0.85 + pv_rand_(seed + i * 7 + S.round) * 0.3;
    var mult = mv.move === 'skill' ? 1.8 : mv.move === 'card' ? 0.6 : 1;
    var crit = pv_rand_(seed * 3 + i + S.round * 11) < 0.05 + S.f[s].stats.spd / 200 + (S.f[s].stats.crit || 0) / 100;
    var dmg = Math.max(1, Math.round((atk * mult - S.f[o].stats.def * 0.5) * r * (crit ? 1.5 : 1) * pv_counterMult_(S.f[s], S.f[o])));
    if (pv_counterMult_(S.f[s], S.f[o]) > 1) ev[s].counter = true;
    if (m[o].move === 'defend') dmg = Math.max(1, Math.round(dmg * 0.4));
    if (S.shield[o] > 0) { var ab = Math.min(S.shield[o], dmg); S.shield[o] -= ab; dmg -= ab; ev[o].absorb = ab; }
    S.hp[o] = Math.max(0, S.hp[o] - dmg); ev[s].dmg = dmg; ev[s].crit = crit;
    if (mv.move === 'skill') S.cd[s] = 3;
    if (S.buff[s] && mv.move !== 'card') S.buff[s] = 0;
  });
  side.forEach(function (s) { if (S.cd[s] > 0 && m[s].move !== 'skill') S.cd[s]--; });
  ev.hp = { A: S.hp.A, B: S.hp.B }; S.log.push(ev);
  if (S.hp.A <= 0 || S.hp.B <= 0 || S.round >= 20) {
    S.done = true;
    S.winner = S.hp.A === S.hp.B ? (S.f.A.stats.spd >= S.f.B.stats.spd ? 'A' : 'B') : (S.hp.A / S.max.A >= S.hp.B / S.max.B ? 'A' : 'B');
  }
  return S;
}
function pv_ai_(S, s, seed) {           // 自動對戰的出招
  var me = S.f[s], hpPct = S.hp[s] / S.max[s], r = pv_rand_(seed + S.round * 13);
  var avail = (me.cards || []).filter(function (c) { return S.used[s].indexOf(c.id) < 0; });
  var heal = avail.filter(function (c) { return c.kind === 'heal'; })[0];
  if (heal && hpPct < 0.45) return { move: 'card', card: heal.id };
  var other = avail.filter(function (c) { return c.kind !== 'heal'; })[0];
  if (other && r < 0.25) return { move: 'card', card: other.id };
  if (S.cd[s] === 0 && r < 0.6) return { move: 'skill' };
  if (r > 0.85) return { move: 'defend' };
  return { move: 'attack' };
}
function pv_reward_(winner, loser, mode) {
  var today = gm_today_(), cap = pv_param_('對戰每日獎勵上限'), got = 0;
  gm_rows_('ledger').forEach(function (r) { if (r[1] === winner && r[2] === '對戰勝利' && String(r[0]).slice(0, 10) === today) got += Number(r[3]) || 0; });
  var amt = Math.min(pv_param_('對戰勝利獎勵'), Math.max(0, cap - got));
  if (amt > 0) gm_credit_(winner, '對戰勝利', amt, mode + '勝過 ' + (gm_emp_(loser).nick || gm_emp_(loser).name), 'DUELWIN|' + winner + '|' + gm_now_() + '|' + Math.random());
  return amt;
}

// ───────── 自動切磋 ─────────
function pv_duel_(p) {
  var a = String(p.empId || '').trim(), b = String(p.to || '').trim(), today = gm_today_();
  if (!gm_emp_(a) || gm_isFrozen_(a)) return { error: '帳號無法使用' };
  if (!gm_emp_(b) || gm_isFrozen_(b) || a === b) return { error: '找不到對手' };
  if (today < gm_param_('測試版開始日')) return { error: '對戰將於測試版開始後開放' };
  var used = pv_rows_('duels').filter(function (r) { return String(r[1]) === today && r[2] === a && r[5] === '自動'; }).length;
  if (used >= pv_param_('對戰每日次數')) return { error: '今天的切磋次數用完了' };
  var A = pv_fighter_(a), B = pv_fighter_(b);
  if (!B.join) return { error: '對方設定為不參加對戰' };
  var S = pv_newBattle_(A, B), seed = gm_hash_(a + b + gm_now_()) % 100000;
  while (!S.done) pv_round_(S, pv_ai_(S, 'A', seed), pv_ai_(S, 'B', seed + 50), seed);
  var win = S.winner === 'A' ? a : b, lose = win === a ? b : a;
  pv_append_('duels', [[gm_now_(), today, a, b, win, '自動', JSON.stringify(S.log)]]);
  var coin = pv_reward_(win, lose, '切磋');
  return { success: true, data: { A: A, B: B, log: S.log, winner: win, reward: win === a ? coin : 0, left: pv_param_('對戰每日次數') - used - 1 } };
}

// ───────── 即時對戰 ─────────
function pv_liveFind_(id) {
  var rows = pv_rows_('live');
  for (var i = 0; i < rows.length; i++) if (String(rows[i][0]) === String(id)) return { row: i + 2, r: rows[i], S: pv_json_(rows[i][6], null) };
  return null;
}
function pv_liveSave_(L, status, S) {
  var rng = pv_sh_('live').getRange(L.row, 4, 1, 4); rng.setNumberFormat('@');
  rng.setValues([[status, String(L.r[4]), gm_now_(), JSON.stringify(S)]]);
  GM_CACHE_.rows_pv_live = null;
}
function pv_liveInvite_(p) {
  var a = String(p.empId || '').trim(), b = String(p.to || '').trim();
  if (!gm_emp_(a) || gm_isFrozen_(a) || !gm_emp_(b) || gm_isFrozen_(b) || a === b) return { error: '找不到對手' };
  if (gm_today_() < gm_param_('測試版開始日')) return { error: '對戰將於測試版開始後開放' };
  if (!pv_fighter_(b).join) return { error: '對方設定為不參加對戰' };
  var id = 'L' + Date.now().toString(36) + Math.floor(Math.random() * 1000);
  pv_append_('live', [[id, a, b, '邀請中', gm_now_(), gm_now_(), JSON.stringify({ invitedAt: Date.now() })]]);
  return { success: true, data: { id: id } };
}
function pv_liveMine_(p) {
  var me = String(p.empId || '').trim(), now = Date.now(), out = [];
  pv_rows_('live').forEach(function (r) {
    if (r[1] !== me && r[2] !== me) return;
    var S = pv_json_(r[6], {}), st = String(r[3]);
    if (st === '邀請中' && now - (S.invitedAt || 0) > 120000) st = '已過期';
    if (st === '對戰中' && S.deadline && now - S.deadline > 120000) st = '已中斷';
    if (st !== '邀請中' && st !== '對戰中') return;
    var a = gm_emp_(r[1]), b = gm_emp_(r[2]);
    out.push({ id: r[0], from: r[1], to: r[2], fromName: a ? (a.nick || a.name) : r[1], toName: b ? (b.nick || b.name) : r[2], status: st, mine: r[1] === me });
  });
  return { success: true, data: out };
}
function pv_liveAccept_(p) {
  var me = String(p.empId || '').trim(), L = pv_liveFind_(p.id); if (!L) return { error: '找不到這場對戰' };
  if (L.r[2] !== me) return { error: '這不是給你的邀請' };
  if (String(L.r[3]) !== '邀請中' || Date.now() - (L.S.invitedAt || 0) > 120000) return { error: '邀請已過期' };
  if (p.decline) { pv_liveSave_(L, '已拒絕', L.S); return { success: true }; }
  var S = pv_newBattle_(pv_fighter_(L.r[1]), pv_fighter_(L.r[2]));
  S.moves = { A: null, B: null }; S.deadline = Date.now() + pv_param_('即時對戰每回合秒數') * 1000;
  pv_liveSave_(L, '對戰中', S);
  return { success: true, data: pv_livePublic_(L.r, S, me) };
}
function pv_livePublic_(r, S, me) {
  var side = r[1] === me ? 'A' : 'B';
  return { id: r[0], side: side, round: S.round, hp: S.hp, max: S.max, cd: S.cd, used: S.used, shield: S.shield, buff: S.buff,
           fighters: { A: S.f.A, B: S.f.B }, waiting: S.moves ? { A: !!S.moves.A, B: !!S.moves.B } : {}, deadline: S.deadline,
           log: S.log.slice(-6), done: S.done, winner: S.done ? (S.winner === 'A' ? r[1] : r[2]) : '', reward: S.reward || 0, now: Date.now() };
}
function pv_liveTick_(L) {   // 雙方都出招或時間到 → 結算一回合
  var S = L.S; if (!S || S.done || String(L.r[3]) !== '對戰中') return S;
  var bothIn = S.moves.A && S.moves.B, timeout = Date.now() > S.deadline;
  if (!bothIn && !timeout) return S;
  pv_round_(S, S.moves.A || { move: 'attack' }, S.moves.B || { move: 'attack' }, gm_hash_(L.r[0]) % 100000);
  S.moves = { A: null, B: null }; S.deadline = Date.now() + pv_param_('即時對戰每回合秒數') * 1000;
  if (S.done) {
    var win = S.winner === 'A' ? L.r[1] : L.r[2], lose = win === L.r[1] ? L.r[2] : L.r[1];
    S.reward = pv_reward_(win, lose, '即時對戰');
    pv_append_('duels', [[gm_now_(), gm_today_(), L.r[1], L.r[2], win, '即時', JSON.stringify(S.log)]]);
    pv_liveSave_(L, '已結束', S);
  } else pv_liveSave_(L, '對戰中', S);
  return S;
}
function pv_liveMove_(p) {
  var me = String(p.empId || '').trim(), L = pv_liveFind_(p.id); if (!L) return { error: '找不到這場對戰' };
  if (L.r[1] !== me && L.r[2] !== me) return { error: '你不在這場對戰裡' };
  var S = pv_liveTick_(L); if (S.done) return { success: true, data: pv_livePublic_(L.r, S, me) };
  var side = L.r[1] === me ? 'A' : 'B', mv = String(p.move || 'attack');
  if (['attack', 'defend', 'skill', 'card'].indexOf(mv) < 0) mv = 'attack';
  S.moves[side] = { move: mv, card: String(p.card || '') };
  pv_liveSave_(L, '對戰中', S); L.S = S;
  S = pv_liveTick_(L);
  return { success: true, data: pv_livePublic_(L.r, S, me) };
}
function pv_liveState_(p) {
  var me = String(p.empId || '').trim(), L = pv_liveFind_(p.id); if (!L) return { error: '找不到這場對戰' };
  if (String(L.r[3]) === '邀請中') return { success: true, data: { id: L.r[0], status: '邀請中', now: Date.now() } };
  if (String(L.r[3]) === '已拒絕') return { success: true, data: { id: L.r[0], status: '已拒絕' } };
  var S = pv_liveTick_(L);
  return { success: true, data: pv_livePublic_(L.r, S, me) };
}

// ───────── 對戰總覽 ─────────
function pv_me_(p) {
  var emp = String(p.empId || '').trim(), e = gm_emp_(emp); if (!e) return { error: '找不到此帳號' };
  var cat = gm_catalog_(), own = gm_owned_(emp), today = gm_today_(), ym = today.slice(0, 7);
  var inv = Object.keys(own).filter(function (k) { return cat[k] && ['weapon', 'armor', 'card'].indexOf(cat[k].cat) >= 0; })
    .map(function (k) { var c = cat[k], s = pv_stats_(k); return { id: k, name: c.name, cat: c.cat, tier: c.tier, stats: s }; });
  var opp = [], emps = gm_emps_();
  Object.keys(emps).forEach(function (id) { if (id !== emp && !emps[id].resigned) { var f = pv_fighter_(id); if (f.join) opp.push({ id: id, name: f.name, power: f.stats.atk * 3 + f.stats.def * 2 + f.stats.hp / 5 + f.stats.spd, petType: f.petType, petTypeName: f.petTypeName }); } });
  var wins = {}, mine = [];
  pv_rows_('duels').forEach(function (r) {
    if (String(r[1]).slice(0, 7) === ym) wins[r[4]] = (wins[r[4]] || 0) + 1;
    if (r[2] === emp || r[3] === emp) mine.push({ time: String(r[0]), vs: r[2] === emp ? r[3] : r[2], win: r[4] === emp, mode: r[5] });
  });
  var rank = Object.keys(wins).map(function (k) { return { id: k, name: emps[k] ? (emps[k].nick || emps[k].name) : k, wins: wins[k] }; }).sort(function (a, b) { return b.wins - a.wins; }).slice(0, 10);
  var used = pv_rows_('duels').filter(function (r) { return String(r[1]) === today && r[2] === emp && r[5] === '自動'; }).length;
  var q = pv_equipRow_(emp);
  return { success: true, data: { me: pv_fighter_(emp), equip: { weapon: q.weapon, armor: q.armor, cards: q.cards, join: q.join }, inventory: inv, opponents: opp,
    ranking: rank, history: mine.slice(-10).reverse().map(function (h) { var x = emps[h.vs]; h.vsName = x ? (x.nick || x.name) : h.vs; return h; }),
    left: Math.max(0, pv_param_('對戰每日次數') - used), roundSec: pv_param_('即時對戰每回合秒數') } };
}

// ───────── 塔防戰(百貨櫃位)─────────
function td_counters_() {   // 業績類型含「百貨」的營運中固定櫃位
  var sh = gm_ss_().getSheetByName('櫃位設定'), out = [];
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues().forEach(function (r) {
    var n = String(r[0]).trim(); if (!n) return;
    if (/百貨/.test(String(r[2])) && !/結束|停/.test(String(r[4])) && String(r[5]).trim() !== '活動') out.push(n);
  });
  return out;
}
function td_tower_(loc) {
  var rows = pv_rows_('towers');
  for (var i = 0; i < rows.length; i++) if (rows[i][0] === loc) return { row: i + 2, loc: loc, arrow: Number(rows[i][1]) || 1, cannon: Number(rows[i][2]) || 1, wall: Number(rows[i][3]) || 1, total: Number(rows[i][4]) || 0 };
  return { row: 0, loc: loc, arrow: 1, cannon: 1, wall: 1, total: 0 };
}
function td_weekRange_(d) {   // 週一~週日
  var t = new Date(d + 'T00:00:00Z'), wd = (t.getUTCDay() + 6) % 7, mon = gm_addDays_(d, -wd);
  return { from: mon, to: gm_addDays_(mon, 6) };
}
function td_revenue_(loc, from, to) { var s = 0; gm_closeRows_().forEach(function (c) { if (c.loc === loc && c.date >= from && c.date <= to) s += c.rev; }); return s; }
function td_myCounter_(emp) {    // 最近 30 天上班時數最多的百貨櫃位
  var list = td_counters_(), since = gm_addDays_(gm_today_(), -30), m = {};
  gm_rows_('hours').forEach(function (r) { if (r[1] === emp && String(r[0]) >= since && list.indexOf(r[2]) >= 0) m[r[2]] = (m[r[2]] || 0) + (Number(r[3]) || 0); });
  var best = ''; Object.keys(m).forEach(function (k) { if (!best || m[k] > m[best]) best = k; });
  return best;
}
function td_power_(T, rev) {
  var revAtk = Math.floor(rev / (pv_param_('塔防營業額換算') || 10000));
  return { atk: T.arrow * 8 + T.cannon * 15 + revAtk, def: T.wall * 6, hp: 1000 + Math.floor(rev / 100) + T.wall * 50, revAtk: revAtk };
}
function td_battle_(A, B, seed) {   // 10 波:雙方輪流進攻,剩餘城堡血量比例高者勝
  var hpA = A.p.hp, hpB = B.p.hp, waves = [];
  for (var w = 1; w <= 10; w++) {
    var dA = Math.max(5, Math.round((A.p.atk - B.p.def * 0.6) * (0.85 + pv_rand_(seed + w) * 0.3)));
    var dB = Math.max(5, Math.round((B.p.atk - A.p.def * 0.6) * (0.85 + pv_rand_(seed + w * 7) * 0.3)));
    hpB = Math.max(0, hpB - dA); hpA = Math.max(0, hpA - dB); waves.push([dA, dB, hpA, hpB]);
    if (!hpA || !hpB) break;
  }
  var win = hpA / A.p.hp === hpB / B.p.hp ? (A.rev >= B.rev ? 'A' : 'B') : hpA / A.p.hp > hpB / B.p.hp ? 'A' : 'B';
  return { waves: waves, winner: win };
}
function td_simulate_(from, to) {
  var locs = td_counters_(), teams = locs.map(function (l) { var T = td_tower_(l), rev = td_revenue_(l, from, to); return { loc: l, T: T, rev: rev, p: td_power_(T, rev) }; });
  var table = {}, matches = [];
  teams.forEach(function (t) { table[t.loc] = { loc: t.loc, w: 0, l: 0, pts: 0, rev: t.rev, power: t.p }; });
  for (var i = 0; i < teams.length; i++) for (var j = i + 1; j < teams.length; j++) {
    var res = td_battle_(teams[i], teams[j], gm_hash_(from + teams[i].loc + teams[j].loc) % 100000);
    var w = res.winner === 'A' ? teams[i] : teams[j], l = w === teams[i] ? teams[j] : teams[i];
    table[w.loc].w++; table[w.loc].pts += 3; table[l.loc].l++;
    matches.push({ a: teams[i].loc, b: teams[j].loc, winner: w.loc, waves: res.waves, hpA: teams[i].p.hp, hpB: teams[j].p.hp });
  }
  var standings = Object.keys(table).map(function (k) { return table[k]; }).sort(function (a, b) { return b.pts - a.pts || b.rev - a.rev; });
  return { standings: standings, matches: matches };
}
function td_weekly_(today) {   // 每週一結算上週
  if (((new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7) !== 0) return;
  var last = td_weekRange_(gm_addDays_(today, -1)), key = last.from;
  if (gm_getState_('塔防已結算') === key || last.to < gm_param_('測試版開始日')) return;
  var R = td_simulate_(last.from, last.to);
  R.matches.forEach(function (m) { pv_append_('tdLog', [[key, m.a, m.b, m.winner, JSON.stringify(m.waves)]]); });
  if (R.standings.length && R.standings[0].pts > 0) {
    var champ = R.standings[0].loc, mins = {}, tot = 0, pool = pv_param_('塔防冠軍獎勵');
    gm_rows_('hours').forEach(function (r) { if (r[2] === champ && String(r[0]) >= last.from && String(r[0]) <= last.to) { mins[r[1]] = (mins[r[1]] || 0) + (Number(r[3]) || 0); tot += Number(r[3]) || 0; } });
    if (tot) Object.keys(mins).forEach(function (emp) { if (!gm_isFrozen_(emp)) gm_credit_(emp, '塔防冠軍', Math.round(pool * mins[emp] / tot), key + ' 週塔防冠軍 ' + champ, 'TDCHAMP|' + emp + '|' + key); });
    gm_setState_('塔防冠軍_' + key, champ);
  }
  gm_setState_('塔防已結算', key);
}
function td_me_(p) {
  var emp = String(p.empId || '').trim(); if (!gm_emp_(emp)) return { error: '找不到此帳號' };
  var today = gm_today_(), wk = td_weekRange_(today), mine = td_myCounter_(emp);
  var live = td_simulate_(wk.from, today);     // 本週到目前為止的戰況預測
  var last = td_weekRange_(gm_addDays_(wk.from, -1)), logs = pv_rows_('tdLog').filter(function (r) { return String(r[0]) === last.from; })
    .map(function (r) { return { a: r[1], b: r[2], winner: r[3], waves: pv_json_(r[4], []) }; });
  var towers = td_counters_().map(function (l) { var T = td_tower_(l); return { loc: l, arrow: T.arrow, cannon: T.cannon, wall: T.wall, total: T.total }; });
  return { success: true, data: { myCounter: mine, week: wk, standings: live.standings, preview: live.matches, lastWeek: { from: last.from, champion: gm_getState_('塔防冠軍_' + last.from), matches: logs },
    towers: towers, base: pv_param_('塔防升級基本價'), balance: gm_balance_(emp) } };
}
function td_give_(p) {
  var emp = String(p.empId || '').trim(), kind = String(p.tower || ''), amt = Math.floor(Number(p.amount) || 0);
  if (!gm_emp_(emp) || gm_isFrozen_(emp)) return { error: '帳號無法使用' };
  var loc = td_myCounter_(emp); if (!loc) return { error: '最近 30 天沒有在百貨櫃位上班,無法投入' };
  if (['arrow', 'cannon', 'wall'].indexOf(kind) < 0) return { error: '塔的種類不正確' };
  if (amt < 10) return { error: '一次至少投入 10 枚' };
  if (gm_balance_(emp) < amt) return { error: '赤心幣不足' };
  var T = td_tower_(loc), base = pv_param_('塔防升級基本價');
  var pool = Number(gm_getState_('塔防進度_' + loc + '_' + kind)) || 0, lv = T[kind];
  pool += amt; while (pool >= base * lv) { pool -= base * lv; lv++; }
  T[kind] = lv; T.total += amt;
  gm_credit_(emp, '塔防投入', -amt, '投入 ' + loc + ' ' + { arrow: '箭塔', cannon: '砲塔', wall: '城牆' }[kind], 'TDGIVE|' + emp + '|' + gm_now_() + '|' + Math.random());
  pv_append_('tdGive', [[gm_now_(), emp, loc, kind, amt]]);
  var row = [loc, T.arrow, T.cannon, T.wall, T.total];
  if (T.row) { var rng = pv_sh_('towers').getRange(T.row, 1, 1, 5); rng.setNumberFormat('@'); rng.setValues([row]); GM_CACHE_.rows_pv_towers = null; } else pv_append_('towers', [row]);
  gm_setState_('塔防進度_' + loc + '_' + kind, pool);
  return { success: true, data: { tower: { loc: loc, arrow: T.arrow, cannon: T.cannon, wall: T.wall }, progress: pool, need: base * lv, balance: gm_balance_(emp) } };
}

// ───────── 夥伴小店 ─────────
function sp_shop_(emp) {
  var rows = pv_rows_('shops');
  for (var i = 0; i < rows.length; i++) if (rows[i][0] === emp) return { row: i + 2, owner: emp, name: String(rows[i][1]), type: String(rows[i][2]), opened: String(rows[i][3]), prices: pv_json_(rows[i][4], {}), revenue: Number(rows[i][5]) || 0, sales: Number(rows[i][6]) || 0, notice: String(rows[i][7] || '') };
  return null;
}
function sp_items_(type, prices) {
  var cat = gm_catalog_(), lo = pv_param_('小店價格下限'), hi = pv_param_('小店價格上限');
  return Object.keys(cat).filter(function (k) { return cat[k].where === '小店:' + type; }).map(function (k) {
    var c = cat[k], p = Number(prices && prices[k]) || c.price;
    return { id: k, name: c.name, cat: c.cat, tier: c.tier, base: c.price, price: p, min: Math.ceil(c.price * lo / 100), max: Math.floor(c.price * hi / 100), effect: c.note };
  });
}
function sp_level_(sales) { return sales >= 60 ? 3 : sales >= 20 ? 2 : 1; }
function sp_list_(p) {
  var emps = gm_emps_(), me = String(p.empId || '').trim();
  var shops = pv_rows_('shops').map(function (r) {
    var s = sp_shop_(r[0]); var e = emps[s.owner];
    return { owner: s.owner, ownerName: e ? (e.nick || e.name) : s.owner, name: s.name, type: s.type, level: sp_level_(s.sales), sales: s.sales, notice: s.notice, items: sp_items_(s.type, s.prices) };
  });
  var eligible = gm_hasBadge_(me, 'tenure_1', '');
  var gifts = pv_rows_('gifts').filter(function (r) { return r[2] === me; }).slice(-10).reverse().map(function (r) {
    var f = emps[r[1]], c = gm_catalog_()[r[3]] || {}; return { time: String(r[0]), from: f ? (f.nick || f.name) : r[1], item: c.name, icon: String(c.note || '').split(':')[1] || '🎁', unread: !r[4] };
  });
  var people = Object.keys(emps).filter(function (k) { return !emps[k].resigned && k !== me; }).map(function (k) { return { id: k, name: emps[k].nick || emps[k].name }; });
  return { success: true, data: { people: people, shops: shops, mine: sp_shop_(me) ? shops.filter(function (s) { return s.owner === me; })[0] : null, eligible: eligible,
    types: PV_SHOP_TYPES, fee: pv_param_('小店開店費'), share: pv_param_('小店店主分潤'), threshold: String(gm_param_('資歷門檻') || '1080').split(',')[0], gifts: gifts, balance: gm_balance_(me) } };
}
function sp_open_(p) {
  var emp = String(p.empId || '').trim(); if (!gm_emp_(emp) || gm_isFrozen_(emp)) return { error: '帳號無法使用' };
  if (!gm_hasBadge_(emp, 'tenure_1', '')) return { error: '累計工時達 ' + String(gm_param_('資歷門檻')).split(',')[0] + ' 小時才能開店' };
  if (sp_shop_(emp)) return { error: '已經有小店了' };
  var type = String(p.type || ''), name = String(p.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12);
  if (PV_SHOP_TYPES.indexOf(type) < 0) return { error: '店型不正確' };
  if (!name) return { error: '請幫小店取名字' };
  var fee = pv_param_('小店開店費'); if (gm_balance_(emp) < fee) return { error: '赤心幣不足(開店費 ' + fee + ' 枚)' };
  gm_credit_(emp, '開店費', -fee, '開了「' + name + '」', 'SHOPOPEN|' + emp);
  pv_append_('shops', [[emp, name, type, gm_now_(), '{}', 0, 0, '']]);
  return { success: true };
}
function sp_update_(p) {
  var emp = String(p.empId || '').trim(), s = sp_shop_(emp); if (!s) return { error: '還沒有小店' };
  var name = p.name != null ? String(p.name).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12) || s.name : s.name;
  var notice = p.notice != null ? String(p.notice).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40) : s.notice;
  var prices = s.prices, want = p.prices != null ? pv_json_(p.prices, {}) : null;
  if (want) {
    var items = sp_items_(s.type, {}); prices = {};
    items.forEach(function (it) { var v = Math.round(Number(want[it.id]) || it.base); prices[it.id] = Math.min(it.max, Math.max(it.min, v)); });
  }
  var type = s.type;
  if (p.type && PV_SHOP_TYPES.indexOf(p.type) >= 0 && p.type !== s.type) { type = p.type; prices = {}; }
  var rng = pv_sh_('shops').getRange(s.row, 2, 1, 7); rng.setNumberFormat('@');
  rng.setValues([[name, type, s.opened, JSON.stringify(prices), s.revenue, s.sales, notice]]); GM_CACHE_.rows_pv_shops = null;
  return { success: true };
}
function sp_buy_(p) {
  var buyer = String(p.empId || '').trim(), owner = String(p.owner || '').trim(), item = String(p.item || ''), to = String(p.to || '').trim();
  if (!gm_emp_(buyer) || gm_isFrozen_(buyer)) return { error: '帳號無法使用' };
  if (buyer === owner) return { error: '不能買自己店裡的東西' };
  var s = sp_shop_(owner); if (!s || gm_isFrozen_(owner)) return { error: '這家店目前沒有營業' };
  var it = sp_items_(s.type, s.prices).filter(function (x) { return x.id === item; })[0]; if (!it) return { error: '這家店沒有賣這個' };
  if (gm_balance_(buyer) < it.price) return { error: '赤心幣不足' };
  var cat = gm_catalog_()[item], kind = cat.cat;
  if (kind === 'gift') { if (!gm_emp_(to) || gm_isFrozen_(to) || to === buyer) return { error: '請選擇要送給哪位夥伴' }; }
  else if (['weapon', 'armor', 'card', 'decor'].indexOf(kind) >= 0 && gm_owned_(buyer)[item]) return { error: '已經擁有了' };
  if (kind === 'petsnack' && !gm_pet_(buyer)) return { error: '還沒有寵物' };
  var share = Math.floor(it.price * pv_param_('小店店主分潤') / 100), k = Date.now() + '|' + Math.random();
  gm_credit_(buyer, '小店消費', -it.price, '在「' + s.name + '」買了' + it.name, 'SPBUY|' + buyer + '|' + k);
  if (share) gm_credit_(owner, '小店營收', share, (gm_emp_(buyer).nick || gm_emp_(buyer).name) + ' 買了' + it.name, 'SPINC|' + owner + '|' + k);
  if (kind === 'gift') pv_append_('gifts', [[gm_now_(), buyer, to, item, '']]);
  else if (kind === 'petsnack') {
    var pet = gm_pet_(buyer), add = Number(String(cat.note).split(':')[1]) || 0;
    var prow = gm_rows_('pets')[pet.row - 2];
    var rng = gm_sh_('pets').getRange(pet.row, 6, 1, 2); rng.setNumberFormat('@');
    rng.setValues([[String((Number(prow[5]) || 0) + add), String((Number(prow[6]) || 0) + 1)]]); GM_CACHE_.rows_pets = null;   // 成長時數＋小遊戲加一條命
  } else gm_append_('owned', [[buyer, item, '小店', gm_now_()]]);
  pv_append_('sales', [[gm_now_(), owner, buyer, item, it.price, share, to]]);
  var rr = pv_sh_('shops').getRange(s.row, 6, 1, 2); rr.setNumberFormat('@'); rr.setValues([[String(s.revenue + share), String(s.sales + 1)]]); GM_CACHE_.rows_pv_shops = null;
  return { success: true, data: { balance: gm_balance_(buyer) } };
}
function sp_giftRead_(p) {
  var me = String(p.empId || '').trim(), sh = pv_sh_('gifts');
  pv_rows_('gifts').forEach(function (r, i) { if (r[2] === me && !r[4]) sh.getRange(i + 2, 5).setValue('Y'); });
  return { success: true };
}
function sp_scene_() {   // 宇宙辦公室「商店街」
  var emps = gm_emps_();
  return pv_rows_('shops').map(function (r) { var s = sp_shop_(r[0]), e = emps[s.owner]; return { owner: s.owner, ownerName: e ? (e.nick || e.name) : '', name: s.name, type: s.type, level: sp_level_(s.sales) }; });
}

// ───────── 路由 ─────────
function pvHandler_(action, p) {
  var map = { pvMe: pv_me_, pvEquip: pv_setEquip_, pvDuel: pv_duel_, pvLiveInvite: pv_liveInvite_, pvLiveMine: pv_liveMine_, pvLiveAccept: pv_liveAccept_,
              pvLiveMove: pv_liveMove_, pvLiveState: pv_liveState_, tdMe: td_me_, tdGive: td_give_, spList: sp_list_, spOpen: sp_open_, spUpdate: sp_update_,
              spBuy: sp_buy_, spGiftRead: sp_giftRead_, spScene: function () { return { success: true, data: sp_scene_() }; } };
  if (!map[action]) return null;
  p = p || {};
  var write = /Equip|Duel|Invite|Accept|Move|State|Give|Open|Update|Buy|Read/.test(action), lock = null;
  try {
    GM_CACHE_ = {};
    if (write) { lock = LockService.getScriptLock(); lock.waitLock(20000); }
    return map[action](p);
  } catch (e) { return { error: '對戰/小店功能發生錯誤:' + e.message }; }
  finally { if (lock) lock.releaseLock(); }
}

// ═══════════════════════════════════════════════
// SOP 清單 ＋ 每日營運日報   v1(2026-11-10)
// 安裝:貼到 Apps Script 最底部;extHandler_ 內加一行:
//   var so = sopHandler_(action, p); if (so) return so;
// 「SOP」工作表第一次使用自動建立並填入初稿(請隊長修改內容;啟用欄填「否」可隱藏某一步)。
// ═══════════════════════════════════════════════
var SOP_HEAD = ['類型', '順序', '步驟', '說明', '圖片連結', '啟用'];
var SOP_SEED = [
  ['開店', 1, '儀容整理', '戴好帽子、口罩、制服與圍裙,頭髮全部收進帽子,拍儀容照打卡', '', '是'],
  ['開店', 2, '洗手消毒', '洗手 20 秒以上並以酒精消毒,之後再碰食材', '', '是'],
  ['開店', 3, '烤爐預熱', '開啟烤爐電源,確認上下模溫度達到設定值', '', '是'],
  ['開店', 4, '麵糊檢查', '確認四種口味麵糊數量與保存期限,在 App 填寫開店盤點', '', '是'],
  ['開店', 5, '備品與零錢', '確認紙袋、竹籤、包材與零用金,不足就登記缺貨看板', '', '是'],
  ['開店', 6, '環境與陳列', '擦拭櫃台與價目牌,擺好試吃與陳列', '', '是'],
  ['收店', 1, '清點麵糊', '清點四種口味剩餘包數並記錄進貨', '', '是'],
  ['收店', 2, '烤爐清潔', '關閉電源,待降溫後清潔烤盤與爐體,拍清潔照', '', '是'],
  ['收店', 3, '環境清潔', '清理櫃台、地面與垃圾,拍環境照', '', '是'],
  ['收店', 4, '營業額結算', '依品項填寫營業額,核對零用金', '', '是'],
  ['收店', 5, '交接事項', '把需要下一班知道的事寫在交接備註', '', '是'],
  ['收店', 6, '關閉電源門窗', '確認所有電源關閉、食材冷藏,才打下班卡', '', '是']
];
function sop_sheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID), sh = ss.getSheetByName('SOP');
  if (!sh) { sh = ss.insertSheet('SOP'); sh.getRange(1, 1, 1, SOP_HEAD.length).setValues([SOP_HEAD]); sh.getRange(2, 1, SOP_SEED.length, SOP_HEAD.length).setValues(SOP_SEED); sh.setFrozenRows(1); }
  return sh;
}
function sop_get_() {
  var c = CacheService.getScriptCache(), hit = c.get('sop_all'); if (hit) return { success: true, data: JSON.parse(hit) };
  var v = sop_sheet_().getDataRange().getValues(), out = { '開店': [], '收店': [] };
  for (var r = 1; r < v.length; r++) {
    var t = String(v[r][0]).trim(); if (!out[t] || /^(否|N|FALSE)$/i.test(String(v[r][5]).trim())) continue;
    out[t].push({ n: Number(v[r][1]) || r, title: String(v[r][2]), desc: String(v[r][3] || ''), img: String(v[r][4] || '') });
  }
  Object.keys(out).forEach(function (k) { out[k].sort(function (a, b) { return a.n - b.n; }); });
  c.put('sop_all', JSON.stringify(out), 300);
  return { success: true, data: out };
}

// ───────── 每日營運日報(分隊長以上)─────────
function rp_num_(v) { var n = Number(String(v == null ? '' : v).replace(/[^\d.\-]/g, '')); return String(v).trim() === '' || !isFinite(n) ? 0 : n; }
function rp_d_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Taipei', 'yyyy-MM-dd');
  var s = String(v || '').trim().replace(/\//g, '-'), m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : '';
}
function rp_report_(p) {
  var ss = SpreadsheetApp.openById(SHEET_ID), emp = String(p.empId || '').trim(), role = 0, names = {};
  var pv = ss.getSheetByName('夥伴資料').getDataRange().getValues();
  for (var i = 1; i < pv.length; i++) { var id = String(pv[i][0]).trim(); names[id] = String(pv[i][2] || pv[i][1] || id); if (id === emp) role = Number(pv[i][12]) || 0; }
  if (role < 2) return { error: '日報只開放分隊長以上查看' };
  var date = /^\d{4}-\d{2}-\d{2}$/.test(p.date || '') ? p.date : Utilities.formatDate(new Date(Date.now() - 86400000), 'Asia/Taipei', 'yyyy-MM-dd');
  var stores = {}, S = function (l) { return stores[l] || (stores[l] = { loc: l, rev: 0, closes: 0, use: { '原味': 0, '可可': 0, '紅玉': 0, '抹茶': 0 }, useTotal: 0, rem: null, orders: 0, ordersDone: 0, staff: {}, minutes: 0 }); };
  // 收店盤點:B 日期、E 姓名、F 櫃位、G~J 剩餘、L~O 消耗、P 總消耗、Q 當日營業額、AC 營業額合計
  ['收店盤點', '收店盤點_歷史'].forEach(function (n) {
    var sh = ss.getSheetByName(n); if (!sh || sh.getLastRow() < 2) return;
    sh.getRange(2, 1, sh.getLastRow() - 1, Math.min(29, sh.getLastColumn())).getValues().forEach(function (r) {
      if (rp_d_(r[1]) !== date || !String(r[5]).trim()) return;
      var s = S(String(r[5]).trim());
      s.rev += String(r[28] == null ? '' : r[28]).trim() !== '' ? rp_num_(r[28]) : rp_num_(r[16]); s.closes++;
      ['原味', '可可', '紅玉', '抹茶'].forEach(function (f, k) { s.use[f] += rp_num_(r[11 + k]); });
      s.useTotal += rp_num_(r[15]);
      s.rem = { '原味': rp_num_(r[6]), '可可': rp_num_(r[7]), '紅玉': rp_num_(r[8]), '抹茶': rp_num_(r[9]) };
    });
  });
  // 訂單:B 櫃位、C 日期、Q 狀態
  var od = ss.getSheetByName('訂單');
  if (od && od.getLastRow() > 1) od.getRange(2, 1, od.getLastRow() - 1, 17).getValues().forEach(function (r) {
    if (rp_d_(r[2]) !== date || String(r[16]) === '已取消') return;
    var s = S(String(r[1]).trim()); s.orders++; if (String(r[16]) === '已交付') s.ordersDone++;
  });
  // 打卡:B 日期、C 員工編號、F 類型、G 時間、J 地點、O 異常標記
  var abn = [], open = {};
  ['打卡紀錄', '打卡紀錄_歷史'].forEach(function (n) {
    var sh = ss.getSheetByName(n); if (!sh || sh.getLastRow() < 2) return;
    sh.getRange(2, 1, sh.getLastRow() - 1, 15).getValues().forEach(function (r) {
      if (rp_d_(r[1]) !== date) return;
      var e = String(r[2]).trim(), t = r[6] instanceof Date ? r[6] : new Date(String(r[6])), loc = String(r[9] || '').trim(), type = String(r[5]).trim();
      if (String(r[14] || '').trim()) abn.push({ name: names[e] || e, loc: loc, type: type, note: String(r[14]) });
      (open[e] = open[e] || []).push({ type: type, t: t.getTime(), loc: loc });
    });
  });
  Object.keys(open).forEach(function (e) {
    var list = open[e].sort(function (a, b) { return a.t - b.t; }), cur = null;
    list.forEach(function (x) {
      if (x.type === '上班') { if (cur) abn.push({ name: names[e] || e, loc: cur.loc, type: '上班', note: '重複上班打卡,前一段沒有下班' }); cur = x; }
      else if (x.type === '下班' && cur) { var s = S(cur.loc), m = Math.round((x.t - cur.t) / 60000); if (m > 0) { s.minutes += m; s.staff[names[e] || e] = (s.staff[names[e] || e] || 0) + m; } cur = null; }
    });
    if (cur) abn.push({ name: names[e] || e, loc: cur.loc, type: '上班', note: '有上班沒有下班' });
  });
  var list = Object.keys(stores).map(function (k) { var s = stores[k]; s.staff = Object.keys(s.staff).map(function (n) { return { name: n, hours: Math.round(s.staff[n] / 6) / 10 }; }); s.hours = Math.round(s.minutes / 6) / 10; return s; })
    .sort(function (a, b) { return b.rev - a.rev; });
  var tot = { rev: 0, orders: 0, useTotal: 0, hours: 0 }; list.forEach(function (s) { tot.rev += s.rev; tot.orders += s.orders; tot.useTotal += s.useTotal; tot.hours += s.hours; });
  tot.hours = Math.round(tot.hours * 10) / 10;
  return { success: true, data: { date: date, total: tot, stores: list, abnormal: abn, perHour: tot.hours ? Math.round(tot.rev / tot.hours) : 0 } };
}

function sopHandler_(action, p) {
  try {
    if (action === 'getSop') return sop_get_();
    if (action === 'getDailyReport') return rp_report_(p || {});
  } catch (e) { return { error: 'SOP/日報功能錯誤:' + e.message }; }
  return null;
}

// ═══════════════════════════════════════════════
// 登入安全＋本月薪資概況 後端模組 v1（2026-11-10，v1.18 批次）
// 貼在「程式碼.gs」最底部（或新增一個 .gs 檔），再於 extHandler_ 的「第一行」加入：
//   var sec = secHandler_(action, p); if (sec) return sec;
// （要放在 pollHandler_、pwHandler_ 之前，才會接手 login 與 changePassword）
//
// 做了什麼：
// 1. 登入 login：密碼改存「加鹽雜湊」（h1$鹽$SHA-256），舊的明碼密碼第一次登入成功時自動換成雜湊。
//    同一支手機 10 分鐘內錯 5 次先鎖住。回傳的 user 物件與原本 loginUser 完全相同，
//    另外多兩個欄位：weakPw（密碼仍是生日預設值）、token（之後查薪資用的通行證，30 天有效）。
//    前端新版改用 POST 登入；舊版前端的 GET 登入仍可用（同一套驗證），等全員更新後可再關閉 GET。
// 2. 修改密碼 changePassword：驗證雜湊或明碼，新密碼一律存雜湊。
// 3. 管理員重設密碼：直接在〈夥伴資料〉密碼欄打明碼即可，該夥伴下次登入時會自動轉成雜湊。
// 4. getSalaryToDate：本月 1 日到「昨天」的實際薪資與獎金（只讀不寫，規則與 calcSalaryV2 相同）。
//    需要 token，只能查自己的。
// 第一次執行會自動在「指令碼屬性」建立 SEC_SECRET（簽 token 用），不需手動設定。
// ═══════════════════════════════════════════════

var SEC_FAIL_MAX = 5, SEC_FAIL_TTL = 600, SEC_TOKEN_DAYS = 30;

function secHandler_(action, p) {
  p = p || {};
  try {
    if (action === 'login')           return sec_login_(p);
    if (action === 'changePassword')  return sec_changePw_(p);
    if (action === 'getSalaryToDate') return sec_salaryToDate_(p);
  } catch (e) { return { error: '系統錯誤:' + e.message }; }
  return null;
}

// ── 雜湊工具 ──
function sec_hex_(bytes) {
  var s = '';
  for (var i = 0; i < bytes.length; i++) { var b = (bytes[i] + 256) % 256; s += (b < 16 ? '0' : '') + b.toString(16); }
  return s;
}
function sec_hash_(pw, salt) {
  return 'h1$' + salt + '$' + sec_hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + pw, Utilities.Charset.UTF_8));
}
function sec_newSalt_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 16); }
function sec_isHashed_(stored) { return /^h1\$[0-9a-f]+\$[0-9a-f]{64}$/.test(String(stored || '')); }
function sec_check_(pw, stored) {
  stored = String(stored || '').trim();
  if (!stored) return false;
  if (sec_isHashed_(stored)) return sec_hash_(pw, stored.split('$')[1]) === stored;
  return stored === pw;                                  // 舊的明碼（或管理員剛重設的）
}
// 生日 → 預設密碼 MMDD（〈夥伴資料〉E 欄，可能是 Date 或「85/06/07」「1996-06-07」等文字）
function sec_bdayPw_(b) {
  if (!b) return '';
  if (b instanceof Date || Object.prototype.toString.call(b) === '[object Date]') return Utilities.formatDate(b, 'Asia/Taipei', 'MMdd');
  var m = String(b).trim().split(/[\/\-\.年月日\s]+/).filter(String);
  if (m.length < 3) return '';
  return ('0' + parseInt(m[1], 10)).slice(-2) + ('0' + parseInt(m[2], 10)).slice(-2);
}
function sec_pwCol_(head) {
  for (var i = 0; i < head.length; i++) { var t = String(head[i]).trim(); if (t === '密碼' || t === '登入密碼') return i; }
  return 36;                                             // AK 欄（與原本 loginUser 相同）
}

// ── token：empId.到期日.簽章（HMAC-SHA256，金鑰放指令碼屬性）──
function sec_secret_() {
  var pr = PropertiesService.getScriptProperties(), k = pr.getProperty('SEC_SECRET');
  if (!k) { k = Utilities.getUuid() + Utilities.getUuid(); pr.setProperty('SEC_SECRET', k); }
  return k;
}
function sec_sign_(s) { return sec_hex_(Utilities.computeHmacSha256Signature(s, sec_secret_())).slice(0, 32); }
function sec_makeToken_(empId) {
  var exp = Date.now() + SEC_TOKEN_DAYS * 86400000, body = empId + '.' + exp;
  return body + '.' + sec_sign_(body);
}
function sec_verifyToken_(token, empId) {
  var a = String(token || '').split('.');
  if (a.length !== 3 || a[0] !== String(empId)) return false;
  if (Number(a[1]) < Date.now()) return false;
  return sec_sign_(a[0] + '.' + a[1]) === a[2];
}

// ── 登入 ──
function sec_login_(p) {
  var phone = String(p.phone || '').trim(), pw = String(p.password || '').trim();
  if (!phone || !pw) return { success: false, error: '請填入帳號與密碼' };
  var cache = CacheService.getScriptCache(), fk = 'lgfail_' + phone.replace(/\D/g, '');
  var fails = Number(cache.get(fk) || 0);
  if (fails >= SEC_FAIL_MAX) return { success: false, error: '嘗試次數過多，請 10 分鐘後再試，或聯絡門市總監' };

  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('夥伴資料');
  var data = sh.getDataRange().getValues(), pwC = sec_pwCol_(data[0]);
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (String(row[6] || '').trim() !== phone) continue;
    if (row[10]) continue;                                // 已離職
    var stored = String(row[pwC] || '').trim();
    if (!sec_check_(pw, stored)) continue;                // 同一支手機若有兩列，繼續找
    cache.remove(fk);
    if (!sec_isHashed_(stored)) {                         // 舊明碼 → 換成雜湊
      try {
        var lock = LockService.getScriptLock(); lock.waitLock(10000);
        try { var cell = sh.getRange(i + 1, pwC + 1); cell.setNumberFormat('@'); cell.setValue(sec_hash_(pw, sec_newSalt_())); }
        finally { lock.releaseLock(); }
      } catch (e) { /* 換不成功也讓他登入，下次再換 */ }
    }
    var bd = sec_bdayPw_(row[4]);
    return { success: true, user: {
      id: String(row[0]), name: String(row[1]), avatar: String(row[1]).slice(0, 1), role: parseInt(row[12]) || 1,
      position: String(row[11]), birthday: String(row[4]), hourly: parseFloat(row[13]) || 190, labor: parseFloat(row[21]) || 0,
      health: parseFloat(row[26]) || 0, noInsure: parseFloat(row[29]) || 0, skillLevel: parseFloat(row[32]) || 0,
      contribLevel: parseFloat(row[33]) || 0, longAge: parseFloat(row[34]) || 0, checkupExpiry: String(row[31] || ''),
      weakPw: !!bd && pw === bd,
      token: sec_makeToken_(String(row[0])) } };
  }
  cache.put(fk, String(fails + 1), SEC_FAIL_TTL);
  return { success: false, error: '帳號或密碼錯誤' };
}

// ── 修改密碼（取代 pw_change_；規則相同，改存雜湊）──
function sec_changePw_(p) {
  var empId = String(p.empId || '').trim(), oldPw = String(p.oldPassword || '').trim(), newPw = String(p.newPassword || '').trim();
  if (!empId || !oldPw || !newPw) return { error: '資料不完整' };
  if (newPw.length < 6 || newPw.length > 20 || /\s/.test(newPw)) return { error: '新密碼需為 6 到 20 個字元，且不可有空白' };
  if (newPw === oldPw) return { error: '新密碼不能與目前密碼相同' };
  var cache = CacheService.getScriptCache(), key = 'pwfail_' + empId, fails = Number(cache.get(key) || 0);
  if (fails >= SEC_FAIL_MAX) return { error: '嘗試次數過多，請 10 分鐘後再試，或聯絡門市總監' };

  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('夥伴資料');
    var v = sh.getDataRange().getValues(), pwC = sec_pwCol_(v[0]);
    for (var r = 1; r < v.length; r++) {
      if (String(v[r][0]).trim() !== empId) continue;
      if (!sec_check_(oldPw, v[r][pwC])) { cache.put(key, String(fails + 1), SEC_FAIL_TTL); return { error: '目前密碼不正確' }; }
      if (newPw === sec_bdayPw_(v[r][4])) return { error: '新密碼不能是生日，請換一組' };
      var cell = sh.getRange(r + 1, pwC + 1); cell.setNumberFormat('@'); cell.setValue(sec_hash_(newPw, sec_newSalt_()));
      cache.remove(key);
      return { success: true };
    }
    return { error: '找不到此帳號' };
  } finally { lock.releaseLock(); }
}

// ── 本月薪資概況（1 日～昨天，只讀）──
// 計算方式逐項對照 calcSalaryV2（最後一個版本）：打卡配對不扣午休、同日跨櫃累加後切加班段、
// 國定假日／颱風日 ×2、假日出勤獎金、每日業績獎金（≥門檻，單人×人數）、團體獎金（月換算 >門檻，依工時比例）、
// 技能／貢獻津貼（長青暫不計）、生日與三節（≥80 小時依級距，否則 200）、職務加給（薪資明細手填值）、勞健保。
function sec_salaryToDate_(p) {
  var empId = String(p.empId || '').trim();
  if (!sec_verifyToken_(p.token, empId)) return { error: '請重新登入後再查看', relogin: true };

  var ss = SpreadsheetApp.openById(SHEET_ID);
  var today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
  var ym = today.slice(0, 7), targetMonth = parseInt(ym.slice(5), 10);
  var y = new Date(new Date(today + 'T00:00:00+08:00').getTime() - 86400000);
  var asOf = Utilities.formatDate(y, 'Asia/Taipei', 'yyyy-MM-dd');
  var base = { success: true, ym: ym, asOf: asOf, hours: { normal: 0, holiday: 0, total: 0 }, days: [], items: [], deductions: [], gross: 0, net: 0, notes: [] };
  if (asOf.slice(0, 7) !== ym) { base.notes.push('今天是本月第一天，明天起就會看到本月的累計。'); return base; }

  var P = getParams(), cal = getCalendar(), locs = getLocations();
  var wage = P['基準時薪'] || 196;
  var staff = ss.getSheetByName('夥伴資料').getDataRange().getValues();
  var emp = null;
  for (var si = 1; si < staff.length; si++) if (String(staff[si][0]) === empId) { emp = staff[si]; break; }
  if (!emp) return { error: '找不到夥伴資料' };
  var punch = ss.getSheetByName('打卡紀錄').getDataRange().getValues();
  var closeS = ss.getSheetByName('收店盤點').getDataRange().getValues();
  var cum = ss.getSheetByName('累計工時').getDataRange().getValues();
  var FEST = [1, 6, 9];

  // 1. 打卡配對（全員，算同櫃同日人數與工時比例用）
  var sessions = {};
  for (var i = 1; i < punch.length; i++) {
    var r = punch[i], eid = String(r[2]); if (!eid) continue;
    var flag = String(r[16] || '');
    if (flag.indexOf('異常未下班') >= 0 && flag.indexOf('已由管理員補登') < 0) continue;
    var t = r[6] ? new Date(r[6]) : null; if (!t || isNaN(t)) continue;
    var d = Utilities.formatDate(t, 'Asia/Taipei', 'yyyy-MM-dd');
    if (d.slice(0, 7) !== ym || d > asOf) continue;
    var key = eid + '_' + d + '_' + String(r[9] || '');
    if (!sessions[key]) sessions[key] = { empId: eid, date: d, loc: String(r[9] || ''), hrs: 0, first: t, segs: [] };
    sessions[key].segs.push({ type: String(r[5]), time: t });
    if (t < sessions[key].first) sessions[key].first = t;
  }
  var locDayHours = {}, locDayCount = {}, locMonthHours = {}, empLocHours = {};
  Object.keys(sessions).forEach(function (k) {
    var s = sessions[k];
    s.segs.sort(function (a, b) { return a.time - b.time; });
    var inT = null;
    s.segs.forEach(function (sg) {
      if (sg.type === '上班') inT = sg.time;
      else if (sg.type === '下班' && inT) { s.hrs += Math.max(0, (sg.time - inT) / 3600000); inT = null; }
    });
    if (!s.hrs) return;
    var dk = s.date + '_' + s.loc;
    locDayHours[dk] = (locDayHours[dk] || 0) + s.hrs;
    locDayCount[dk] = (locDayCount[dk] || 0) + 1;
    locMonthHours[s.loc] = (locMonthHours[s.loc] || 0) + s.hrs;
    empLocHours[s.empId + '_' + s.loc] = (empLocHours[s.empId + '_' + s.loc] || 0) + s.hrs;
  });

  // 2. 每日業績
  var calcRev = function (loc, rev) {
    var lc = locs[loc] || {};
    if (lc.type === 'A百貨') return rev * 0.8;
    if (lc.type === 'C份數') return rev * (lc.unitPrice || P['C類預設抽成'] || 70);
    return rev;
  };
  var dayRevenue = {};
  for (var c = 1; c < closeS.length; c++) {
    if (!closeS[c][1]) continue;
    var cd = Utilities.formatDate(new Date(closeS[c][1]), 'Asia/Taipei', 'yyyy-MM-dd');
    if (cd.slice(0, 7) !== ym || cd > asOf) continue;
    var tot = closeS[c][30] !== '' && closeS[c][30] !== undefined ? parseFloat(closeS[c][30]) : parseFloat(closeS[c][16]) || 0;
    dayRevenue[cd + '_' + String(closeS[c][5])] = tot || 0;
  }

  // 3. 團體獎金池（目前為止的月換算）
  var locRev = {}, locDays = {};
  Object.keys(dayRevenue).forEach(function (k) {
    var loc = k.slice(11), cv = calcRev(loc, dayRevenue[k]);
    if (!cv) return;
    locRev[loc] = (locRev[loc] || 0) + cv; locDays[loc] = (locDays[loc] || 0) + 1;
  });
  var groupPool = {}, groupEq = {};
  Object.keys(locRev).forEach(function (loc) {
    var eq = locRev[loc] / locDays[loc] * 30; groupEq[loc] = eq;
    if (eq > (P['團體獎金門檻'] || 200000)) groupPool[loc] = locRev[loc] * 0.01;
  });

  // 4. 本人
  var home = String(emp[38] || ''), birthday = emp[4] ? new Date(emp[4]) : null;
  var laborSt = String(emp[41] || '公司投保'), healthSt = String(emp[42] || '公司投保'), deps = parseInt(emp[27]) || 0;
  var cumHrs = 0;
  for (var ci = cum.length - 1; ci >= 1; ci--) if (String(cum[ci][0]) === empId) { cumHrs = parseFloat(cum[ci][6]) || 0; break; }

  var mine = Object.keys(sessions).map(function (k) { return sessions[k]; }).filter(function (s) { return s.empId === empId && s.hrs; });
  var basic = 0, ot1 = 0, ot2 = 0, ot3 = 0, dblPay = 0, holBonus = 0, perfBonus = 0, group = 0, normalH = 0, holH = 0;
  var locSet = {}, perfAwarded = {}, dayRows = {};
  var byDay = {};
  mine.forEach(function (s) { (byDay[s.date] = byDay[s.date] || []).push(s); });
  Object.keys(byDay).sort().forEach(function (date) {
    var list = byDay[date]; list.sort(function (a, b) { return a.first - b.first; });
    var off = 0;
    list.forEach(function (s) {
      var lc = locs[s.loc] || {}; locSet[s.loc] = 1;
      var dt = getDayType(s.date, lc.county || '', home, cal);
      var h = s.hrs, a = off, z = off + h;
      var seg = function (lo, hi) { return Math.max(0, Math.min(z, hi) - Math.max(a, lo)); };
      var b = seg(0, 8) * wage, o1 = seg(8, 10) * wage * 1.33, o2 = seg(10, 12) * wage * 1.67, o3 = seg(12, 999) * wage * 2;
      off = z;
      var row = { date: s.date, loc: s.loc, hrs: Math.round(h * 100) / 100, dayType: dt, pay: 0, holBonus: 0, perf: 0, rev: null };
      if (dt === '國定假日' || dt === '颱風日') { dblPay += b + o1 + o2 + o3; holH += h; row.pay = (b + o1 + o2 + o3) * 2; }
      else { basic += b; ot1 += o1; ot2 += o2; ot3 += o3; normalH += h; row.pay = b + o1 + o2 + o3; }
      if (dt === '假日' || dt === '連假日' || (lc.kind === '活動' && dt === '平日')) {
        var totH = locDayHours[s.date + '_' + s.loc] || h;
        var hb = CEIL((P['假日出勤獎金'] || 500) / totH * h); holBonus += hb; row.holBonus = hb;
      }
      var ak = s.date + '_' + s.loc;
      if (!perfAwarded[ak]) {
        var rev = dayRevenue[ak];
        if (rev !== undefined) {
          var cv = calcRev(s.loc, rev), th = perfBonusTable(locDayCount[ak] || 1, P), pb = 0;
          if (cv >= th[2]) pb = 1000; else if (cv >= th[1]) pb = 700; else if (cv >= th[0]) pb = 500;
          perfBonus += pb; row.perf = pb; row.rev = Math.round(cv); row.next = pb >= 1000 ? 0 : Math.ceil((pb >= 700 ? th[2] : pb >= 500 ? th[1] : th[0]) - cv);
        }
        perfAwarded[ak] = 1;
      }
      row.pay = CEIL(row.pay);
      dayRows[s.date + '_' + s.loc] = row;
    });
  });
  var groupNotes = [];
  Object.keys(locSet).forEach(function (loc) {
    if (groupPool[loc] && locMonthHours[loc]) group += groupPool[loc] * (empLocHours[empId + '_' + loc] || 0) / locMonthHours[loc];
    else if (groupEq[loc]) groupNotes.push(loc + ' 月換算業績目前約 ' + Math.round(groupEq[loc]).toLocaleString() + '，超過 ' + (P['團體獎金門檻'] || 200000).toLocaleString() + ' 才有團體獎金');
  });

  var totalH = normalH + holH;
  basic = CEIL(basic); ot1 = CEIL(ot1); ot2 = CEIL(ot2); ot3 = CEIL(ot3); dblPay = CEIL(dblPay * 2); group = CEIL(group);
  var skill = cumHrs > 180 ? CEIL(totalH * 20) : 0;
  var cl = cumHrs > 4320 ? 20 : cumHrs > 3240 ? 15 : cumHrs > 2160 ? 10 : cumHrs > 1080 ? 5 : 0;
  var contrib = CEIL(totalH * cl);
  // 長青津貼：規格書寫「暫不計算」，而且生日欄是民國年（67/11/07 會被當成 1967 年），這裡先不算
  var evergreen = 0;
  var tier = cumHrs > 4320 ? 2400 : cumHrs > 2160 ? 1200 : 600;
  var isBdayMonth = !!(birthday && !isNaN(birthday) && birthday.getMonth() + 1 === targetMonth), isFest = FEST.indexOf(targetMonth) >= 0;
  var bday = isBdayMonth ? (totalH >= 80 ? tier : 200) : 0, fest = isFest ? (totalH >= 80 ? tier : 200) : 0;

  var salEx = ss.getSheetByName('薪資明細').getDataRange().getValues(), duty = 0;
  for (var k = 1; k < salEx.length; k++) if (String(salEx[k][2]) === empId && ymNorm(salEx[k][1]) === ym) { duty = parseFloat(salEx[k][21]) || 0; break; }

  var laborDed = 0, healthDed = 0, insAdd = 0;
  try {
    if (laborSt === '公司投保') laborDed = parseFloat(emp[21]) || 0;
    else insAdd += CEIL(parseFloat(getInsuranceRow(ss, empId, '勞保級距表')[3]) || 0);
    if (healthSt === '公司投保') healthDed = (parseFloat(emp[26]) || 0) * (1 + Math.min(deps, 3));
    else if (healthSt === '無投保') insAdd += CEIL(parseFloat(getInsuranceRow(ss, empId, '健保級距表')[3]) || 0);
  } catch (e) { /* 級距表讀不到就先略過 */ }
  var fee = parseFloat(emp[17]) || 0;

  var it = function (key, label, amt, note) { if (amt || note) base.items.push({ key: key, label: label, amt: amt || 0, note: note || '' }); };
  it('basic', '基本工資', basic, Math.round(normalH * 10) / 10 + ' 小時 × $' + wage);
  it('ot', '加班費', ot1 + ot2 + ot3, (ot1 + ot2 + ot3) ? '第 9 小時起 ×1.33／×1.67／×2' : '');
  it('dbl', '國定假日／颱風日加倍', dblPay, dblPay ? Math.round(holH * 10) / 10 + ' 小時，工資 ×2' : '');
  it('perf', '每日業績獎金', perfBonus, '');
  it('hol', '假日出勤獎金', holBonus, '');
  it('group', '團體獎金（預估）', group, group ? '依目前業績預估，月底結算為準' : '');
  it('skill', '技能津貼', skill, skill ? '每小時 +$20' : '');
  it('contrib', '貢獻津貼', contrib, contrib ? '每小時 +$' + cl : '');
  it('ever', '長青津貼', evergreen, '');
  if (isBdayMonth) it('bday', '生日津貼', bday, totalH >= 80 ? '本月已滿 80 小時' : '目前 ' + Math.round(totalH) + ' 小時，滿 80 小時可領 $' + tier);
  if (isFest) it('fest', '三節津貼', fest, totalH >= 80 ? '本月已滿 80 小時' : '目前 ' + Math.round(totalH) + ' 小時，滿 80 小時可領 $' + tier);
  it('duty', '職務加給', duty, '');
  it('ins', '勞健保補貼', insAdd, '');
  base.gross = base.items.reduce(function (s, x) { return s + x.amt; }, 0);
  if (laborDed) base.deductions.push({ label: '勞保自付', amt: laborDed });
  if (healthDed) base.deductions.push({ label: '健保自付' + (deps ? '（含眷屬 ' + Math.min(deps, 3) + ' 人）' : ''), amt: healthDed });
  if (fee) base.deductions.push({ label: '已預支', amt: fee });
  base.net = base.gross - base.deductions.reduce(function (s, x) { return s + x.amt; }, 0);
  base.hours = { normal: Math.round(normalH * 10) / 10, holiday: Math.round(holH * 10) / 10, total: Math.round(totalH * 10) / 10 };
  base.days = Object.keys(dayRows).sort().map(function (k) { return dayRows[k]; });
  base.cumHrs = cumHrs;
  base.notes = groupNotes.concat(['只算到昨天、以打卡與收店業績為準；勞健保是整月金額。正式薪資以月底結算的薪資單為準。']);
  return base;
}

// ═══════════════════════════════════════════════
// v1.18 排班系統 2.0（2026-11-11）
// 正式班表仍是〈班表〉（打卡檢查、達標、全勤之星、薪資估算照舊讀它），本模組只負責：
//   1. 分隊長排班看板：週／月檢視、批次發布（草稿存在手機，發布才寫入〈班表〉）
//   2. 班型設定：各櫃位平日／假日班型一鍵套用
//   3. 夥伴每月填空檔（可上班／想休）
//   4. 換班：轉讓給指定夥伴／釋出給大家認領／分隊長開放空班 → 分隊長核准才生效
//   5. 排班當下估工資（規格書第 1 節：196 元、跨櫃合併加班、國定／颱風 ×2）與 180hr＋4 假日達標進度
//   6. 排班 vs 打卡對帳（給月底薪資核對用；薪資一律仍依實際打卡計算）
//   7. 整理班表（Lv.3）：在 Google Sheets 直接改完後，一鍵重算星期／時數／單雙人／假日並列出重複
//
// 安裝：
//   1. 新增指令碼檔案 schedule_v1_18，貼上本檔
//   2. extHandler_ 內、pollHandler_ 那行的下一行加入：
//        var sc = schHandler_(action, p); if (sc) return sc;
//   3. 第一次執行 sch_setup()（建立〈班型設定〉〈可上班登記〉〈換班申請〉三張表與參數）
//   4. 部署 → 管理部署作業 → 編輯「進行中」→ 新版本
//
// 新增的表（全部自動建立，不動既有表）：
//   〈班型設定〉 櫃位｜班型｜上班｜下班｜適用（平日/假日/全部）｜人數
//   〈可上班登記〉年月｜員工編號｜姓名｜空檔JSON｜希望時數｜備註｜更新時間
//   〈換班申請〉 申請ID｜類型｜狀態｜班表編號｜日期｜櫃位｜上班｜下班｜申請人ID｜申請人｜對象ID｜對象｜備註｜建立時間｜處理人｜處理時間
// ═══════════════════════════════════════════════

var SCH_TPL_HEAD   = ['櫃位', '班型', '上班', '下班', '適用', '人數'];
var SCH_AVAIL_HEAD = ['年月', '員工編號', '姓名', '空檔JSON', '希望時數', '備註', '更新時間'];
var SCH_REQ_HEAD   = ['申請ID', '類型', '狀態', '班表編號', '日期', '櫃位', '上班', '下班',
                      '申請人ID', '申請人', '對象ID', '對象', '備註', '建立時間', '處理人', '處理時間'];
var SCH_DEFAULT = { wage: 196, monthHours: 180, studentHours: 72, holidayDays: 4, availDeadline: 20 };
var SCH_C_ = {};   // 單次請求快取

// ───────── 共用 ─────────
function sch_ss_() { return SCH_C_.ss || (SCH_C_.ss = SpreadsheetApp.openById(SHEET_ID)); }
function sch_sheet_(name, head) {
  var sh = sch_ss_().getSheetByName(name);
  if (!sh) { sh = sch_ss_().insertSheet(name); sh.appendRow(head); sh.setFrozenRows(1); sh.getRange(1, 1, 1, head.length).setFontWeight('bold'); }
  return sh;
}
function sch_today_() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd'); }
function sch_now_()   { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss'); }
function sch_d_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Taipei', 'yyyy-MM-dd');
  var s = String(v || '').trim().replace(/\//g, '-'), m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : '';
}
function sch_t_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Taipei', 'HH:mm');
  var m = /(\d{1,2}):(\d{2})/.exec(String(v || ''));
  return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : '';
}
function sch_min_(t) { var m = /^(\d{2}):(\d{2})$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : null; }
function sch_hours_(a, b) {                      // 不扣午休；跨午夜視為隔天
  var x = sch_min_(a), y = sch_min_(b); if (x == null || y == null) return 0;
  if (y <= x) y += 1440;
  return Math.round((y - x) / 6) / 10;
}
function sch_arr_(v) { if (Array.isArray(v)) return v; try { return JSON.parse(v || '[]'); } catch (e) { return []; } }
function sch_obj_(v) { if (v && typeof v === 'object') return v; try { return JSON.parse(v || '{}'); } catch (e) { return {}; } }
function sch_week_(d) { return '日一二三四五六'.charAt(new Date(d + 'T12:00:00+08:00').getDay()); }
function sch_param_(name, def) {
  var sh = sch_ss_().getSheetByName('參數設定'); if (!sh) return def;
  var v = sh.getDataRange().getValues();
  for (var i = 0; i < v.length; i++) if (String(v[i][0]).trim() === name && v[i][1] !== '') return Number(v[i][1]) || def;
  return def;
}
function sch_params_() {
  return {
    wage: sch_param_('排班估算時薪', SCH_DEFAULT.wage),
    monthHours: sch_param_('每月達標時數', SCH_DEFAULT.monthHours),
    studentHours: sch_param_('學生每月達標時數', SCH_DEFAULT.studentHours),
    holidayDays: sch_param_('每月達標假日天數', SCH_DEFAULT.holidayDays),
    availDeadline: sch_param_('空檔填寫截止日', SCH_DEFAULT.availDeadline)
  };
}

// ───────── 夥伴、權限、櫃位 ─────────
// 夥伴資料:A 員工編號、B 姓名、K 離職日、M 權限等級、AU(第 47 欄)負責櫃位
function sch_staff_() {
  if (SCH_C_.staff) return SCH_C_.staff;
  var v = sch_ss_().getSheetByName('夥伴資料').getDataRange().getValues(), head = v[0] || [], out = {};
  var iMng = 46, iStu = -1;
  head.forEach(function (h, i) { h = String(h); if (/負責櫃位/.test(h)) iMng = i; if (/學生/.test(h)) iStu = i; });
  for (var r = 1; r < v.length; r++) {
    var id = String(v[r][0]).trim(); if (!id) continue;
    out[id] = {
      id: id, name: String(v[r][1]).trim(), left: String(v[r][10] || '').trim() !== '',
      role: parseInt(v[r][12]) || (/管理/.test(String(v[r][12])) ? 3 : 1),
      managed: String(v[r][iMng] || ''), student: iStu >= 0 && /是|Y|1|學生/i.test(String(v[r][iStu]))
    };
  }
  return (SCH_C_.staff = out);
}
function sch_locNames_() {
  if (SCH_C_.locs) return SCH_C_.locs;
  var sh = sch_ss_().getSheetByName('櫃位設定'), out = [];
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(function (r) {
    var n = String(r[0]).trim(); if (n) out.push(n);
  });
  return (SCH_C_.locs = out);
}
function sch_me_(empId) {
  var me = sch_staff_()[String(empId || '')];
  if (!me || me.left) throw new Error('找不到夥伴資料');
  return me;
}
function sch_managedOf_(me) {                     // Lv.3 以上全部櫃位；Lv.2 依「負責櫃位」欄
  var all = sch_locNames_();
  if (me.role >= 3) return all.slice();
  var toks = me.managed.split(/[、,，\/\s;；]+/).map(function (x) { return x.trim(); }).filter(String);
  return all.filter(function (n) {
    return toks.some(function (t) { return n === t || n.indexOf(t) >= 0 || (t.length >= 2 && t.indexOf(n) >= 0); });
  });
}
function sch_mgr_(empId) {
  var me = sch_me_(empId);
  if (me.role < 2) throw new Error('只有分隊長以上可以排班');
  return { me: me, managed: sch_managedOf_(me) };
}

// ───────── 行事曆 ─────────
// 〈行事曆設定〉A 日期｜B 日別類型(國定假日/颱風日/連假日/假日(六日)/補班)｜C 適用範圍(全部或縣市)
// 畫面標示用:任何範圍有颱風日就標「颱風」(實際寫入班表時改用既有 applyCalendarToSchedule,依櫃位縣市判斷)
function sch_calendar_(ym) {                      // → { 'yyyy-MM-dd': '國定'|'颱風'|'連假'|'補班' }
  var out = {}, sh = sch_ss_().getSheetByName('行事曆設定');
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().forEach(function (r) {
    var d = sch_d_(r[0]), ty = String(r[1]); if (!d || (ym && d.slice(0, 7) !== ym)) return;
    var v = /補班/.test(ty) ? '補班' : /颱風/.test(ty) ? '颱風' : /國定/.test(ty) ? '國定' : /連假/.test(ty) ? '連假' : '';
    var rank = { '': 0, '連假': 1, '國定': 2, '颱風': 3, '補班': 4 };
    if (v && rank[v] > rank[out[d] || '']) out[d] = v;
  });
  return out;
}
function sch_isHoliday_(d, cal) {
  if (cal[d] === '補班') return false;
  if (cal[d] === '國定' || cal[d] === '颱風' || cal[d] === '連假') return true;
  var w = new Date(d + 'T12:00:00+08:00').getDay();
  return w === 0 || w === 6;
}
// 寫入班表的 K 是否假日 / L 假日類型:優先沿用既有後端的日別判定(含櫃位縣市的颱風假)
function sch_dayType_(d, loc, cal) {
  try { if (typeof applyCalendarToSchedule === 'function') return applyCalendarToSchedule(d, loc); } catch (e) {}
  return cal[d] === '颱風' ? '颱風日' : cal[d] === '國定' ? '國定假日' : cal[d] === '連假' ? '連假日' : sch_isHoliday_(d, cal) ? '假日' : '平日';
}
function sch_quotaHoliday_(t) {
  try { if (typeof isHolidayForQuota === 'function') return isHolidayForQuota(t); } catch (e) {}
  return ['假日', '連假日', '國定假日'].indexOf(t) >= 0;
}

// ───────── 〈班表〉讀寫 ─────────
// 欄位位置同既有 saveScheduleApi:A 班表編號 B 日期 C 星期 D 員工編號 E 姓名 F 櫃位 G 上班 H 下班
// I 預計時數 J 單雙人(single/double/triple) K 是否假日(是/否) L 假日類型 M 發布狀態
function sch_cols_(sh) {
  var c = { id: 0, date: 1, week: 2, emp: 3, name: 4, loc: 5, start: 6, end: 7, hours: 8, type: 9, hol: 10, htype: 11, status: 12 };
  c.width = Math.max(sh.getLastColumn(), 13);
  return c;
}
function sch_readShifts_(ym) {                    // ym 空白 = 全部
  var sh = sch_ss_().getSheetByName('班表'), c = sch_cols_(sh), out = [];
  if (sh.getLastRow() < 2) return { sh: sh, c: c, rows: out, raw: [] };
  var raw = sh.getRange(2, 1, sh.getLastRow() - 1, c.width).getValues();
  raw.forEach(function (r, i) {
    var d = sch_d_(r[c.date]); if (!d || (ym && d.slice(0, 7) !== ym)) return;
    var emp = String(r[c.emp]).trim(); if (!emp) return;
    var st = String(r[c.status] || '').trim();
    if (/刪除|取消/.test(st)) return;
    out.push({ id: String(r[c.id]).trim(), row: i + 2, date: d, empId: emp, name: String(r[c.name]).trim(),
               loc: String(r[c.loc]).trim(), start: sch_t_(r[c.start]), end: sch_t_(r[c.end]),
               hours: Number(r[c.hours]) || 0, holiday: /是|Y|true/i.test(String(r[c.hol])), status: st });
  });
  return { sh: sh, c: c, rows: out, raw: raw };
}
function sch_typeWord_(raw, c, n) {               // 沿用表內既有寫法(英文或中文)
  var en = raw.some(function (r) { return /single|double|triple/.test(String(r[c.type])); });
  return en ? (n >= 3 ? 'triple' : n === 2 ? 'double' : 'single') : (n >= 3 ? '三人' : n === 2 ? '雙人' : '單人');
}
// 只寫回有改到的列(連續列合併成一次寫入),不碰其他列
function sch_writeRows_(sh, raw, idx, width) {
  var list = Object.keys(idx).map(Number).sort(function (a, b) { return a - b; });
  for (var i = 0; i < list.length;) {
    var j = i; while (j + 1 < list.length && list[j + 1] === list[j] + 1) j++;
    sh.getRange(list[i] + 2, 1, j - i + 1, width).setValues(raw.slice(list[i], list[j] + 1));
    i = j + 1;
  }
}
function sch_newId_() { return 'S' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss') + Math.floor(Math.random() * 900 + 100); }

// ───────── 工資估算(規格書第 1 節)─────────
function sch_dayWage_(hours, wage, double) {
  var h = hours, pay = 0;
  pay += Math.min(h, 8) * wage;
  if (h > 8)  pay += (Math.min(h, 10) - 8) * wage * 1.33;
  if (h > 10) pay += (Math.min(h, 12) - 10) * wage * 1.67;
  if (h > 12) pay += (h - 12) * wage * 2;
  return double ? pay * 2 : pay;
}
function sch_stats_(rows, cal, prm) {             // → { empId: {hours, days, holidayDays, wage, byLoc:{loc:wage}} }
  var byEmpDay = {}, out = {};
  rows.forEach(function (r) {
    var k = r.empId + '|' + r.date;
    (byEmpDay[k] = byEmpDay[k] || []).push(r);
  });
  Object.keys(byEmpDay).forEach(function (k) {
    var list = byEmpDay[k], emp = list[0].empId, d = list[0].date, sum = 0;
    list.forEach(function (r) { sum += r.hours || sch_hours_(r.start, r.end); });
    var dbl = cal[d] === '國定' || cal[d] === '颱風';   // 估算用;颱風依縣市的精確判定以實際薪資引擎為準
    var w = sch_dayWage_(sum, prm.wage, dbl);
    var o = out[emp] = out[emp] || { hours: 0, days: 0, holidayDays: 0, wage: 0, byLoc: {} };
    o.hours += sum; o.days += 1; o.wage += w;
    if (sch_isHoliday_(d, cal)) o.holidayDays += 1;
    list.forEach(function (r) { var hh = r.hours || sch_hours_(r.start, r.end); o.byLoc[r.loc] = (o.byLoc[r.loc] || 0) + (sum ? w * hh / sum : 0); });
  });
  Object.keys(out).forEach(function (e) {
    out[e].hours = Math.round(out[e].hours * 10) / 10; out[e].wage = Math.ceil(out[e].wage);
    Object.keys(out[e].byLoc).forEach(function (l) { out[e].byLoc[l] = Math.ceil(out[e].byLoc[l]); });
  });
  return out;
}

// ───────── 衝突檢查(隊長 2026-11-11 定案:方案 B)─────────
// 一人一天預設只能一個櫃位;Lv.3 以上可以加排第二個櫃位,但時間不能重疊。
// 個人班表會列出每個重複的原因:overlap=同時段重疊(一律不允許)/ twoLoc=同日兩個櫃位(需 Lv.3)/ twice=同櫃位同日排兩段
function sch_dayCheck_(rows) {
  var by = {}, out = [];
  rows.forEach(function (r) { (by[r.empId + '|' + r.date] = by[r.empId + '|' + r.date] || []).push(r); });
  Object.keys(by).forEach(function (k) {
    var l = by[k]; if (l.length < 2) return;
    for (var i = 0; i < l.length; i++) for (var j = i + 1; j < l.length; j++) {
      var a = l[i], b = l[j], ov = sch_overlap_(a, b);
      var kind = ov ? 'overlap' : (a.loc !== b.loc ? 'twoLoc' : 'twice');
      out.push({ date: a.date, empId: a.empId, name: a.name, kind: kind, ids: [a.id || '', b.id || ''],
        text: a.date + ' ' + a.name + ':' + a.loc + ' ' + a.start + '–' + a.end + ' 與 ' + b.loc + ' ' + b.start + '–' + b.end +
              (ov ? '(時段重疊)' : kind === 'twoLoc' ? '(同日兩個櫃位)' : '(同櫃位兩段班)') });
    }
  });
  return out;
}
// 依權限判斷哪些問題要擋下:overlap 一律擋;twoLoc/twice 只有 Lv.3 以上可以
function sch_blocking_(issues, role) {
  return issues.filter(function (x) { return x.kind === 'overlap' || role < 3; }).map(function (x) { return x.text; });
}
function sch_overlap_(a, b) {
  var a1 = sch_min_(a.start), a2 = sch_min_(a.end), b1 = sch_min_(b.start), b2 = sch_min_(b.end);
  if (a1 == null || b1 == null) return false;
  if (a2 <= a1) a2 += 1440; if (b2 <= b1) b2 += 1440;
  return a1 < b2 && b1 < a2;
}
function sch_conflicts_(rows) {                   // (舊)只檢查時間重疊
  var by = {}, errs = [];
  rows.forEach(function (r) { (by[r.empId + '|' + r.date] = by[r.empId + '|' + r.date] || []).push(r); });
  Object.keys(by).forEach(function (k) {
    var l = by[k];
    for (var i = 0; i < l.length; i++) for (var j = i + 1; j < l.length; j++)
      if (sch_overlap_(l[i], l[j])) errs.push(l[i].date + ' ' + l[i].name + ':' + l[i].loc + ' ' + l[i].start + '–' + l[i].end + ' 與 ' + l[j].loc + ' ' + l[j].start + '–' + l[j].end + ' 時間重疊');
  });
  return errs;
}

// ───────── 班型 ─────────
function sch_templates_(locs) {
  var sh = sch_sheet_('班型設定', SCH_TPL_HEAD), out = {};
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues().forEach(function (r) {
    var loc = String(r[0]).trim(); if (!loc || (locs && locs.indexOf(loc) < 0)) return;
    (out[loc] = out[loc] || []).push({ name: String(r[1]).trim() || '全天', start: sch_t_(r[2]), end: sch_t_(r[3]),
      apply: String(r[4]).trim() || '全部', count: Math.max(1, parseInt(r[5]) || 1) });
  });
  return out;
}
function sch_saveTemplates_(p) {
  var m = sch_mgr_(p.managerId), loc = String(p.loc || '');
  if (m.managed.indexOf(loc) < 0) return { error: '您沒有這個櫃位的排班權限' };
  var list = sch_arr_(p.list).filter(function (t) { return sch_t_(t.start) && sch_t_(t.end); });
  var sh = sch_sheet_('班型設定', SCH_TPL_HEAD);
  var keep = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues().filter(function (r) { return String(r[0]).trim() !== loc && String(r[0]).trim(); }) : [];
  list.forEach(function (t) { keep.push([loc, String(t.name || '全天').slice(0, 12), "'" + sch_t_(t.start), "'" + sch_t_(t.end), /平日|假日/.test(t.apply) ? t.apply : '全部', Math.max(1, Math.min(5, parseInt(t.count) || 1))]); });
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 6).clearContent();
  if (keep.length) sh.getRange(2, 1, keep.length, 6).setValues(keep);
  return { success: true, templates: sch_templates_([loc])[loc] || [] };
}

// ───────── 空檔 ─────────
function sch_availAll_(ym) {
  var sh = sch_sheet_('可上班登記', SCH_AVAIL_HEAD), out = {};
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues().forEach(function (r, i) {
    if (String(r[0]).trim() !== ym) return;
    out[String(r[1]).trim()] = { days: sch_obj_(r[3]), hope: Number(r[4]) || 0, note: String(r[5] || ''), updated: String(r[6] || ''), row: i + 2 };
  });
  return out;
}
function sch_setAvail_(p) {
  var me = sch_me_(p.empId), ym = String(p.ym || '');
  if (!/^\d{4}-\d{2}$/.test(ym)) return { error: '月份格式錯誤' };
  var days = sch_obj_(p.days), clean = {};
  Object.keys(days).forEach(function (d) { if (d.slice(0, 7) === ym && (days[d] === 'ok' || days[d] === 'off')) clean[d] = days[d]; });
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = sch_sheet_('可上班登記', SCH_AVAIL_HEAD), cur = sch_availAll_(ym)[me.id];
    var row = [ym, me.id, me.name, JSON.stringify(clean), Number(p.hope) || '', String(p.note || '').slice(0, 100), sch_now_()];
    if (cur) sh.getRange(cur.row, 1, 1, 7).setValues([row]); else sh.appendRow(row);
  } finally { lock.releaseLock(); }
  return { success: true };
}

// ───────── 換班申請 ─────────
function sch_reqs_() {
  var sh = sch_sheet_('換班申請', SCH_REQ_HEAD), out = [];
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, SCH_REQ_HEAD.length).getValues().forEach(function (r, i) {
    if (!String(r[0]).trim()) return;
    out.push({ id: String(r[0]), kind: String(r[1]), status: String(r[2]), shiftId: String(r[3]), date: sch_d_(r[4]), loc: String(r[5]),
      start: sch_t_(r[6]), end: sch_t_(r[7]), fromId: String(r[8]), fromName: String(r[9]), toId: String(r[10]), toName: String(r[11]),
      note: String(r[12] || ''), created: String(r[13]), by: String(r[14] || ''), at: String(r[15] || ''), row: i + 2 });
  });
  return out;
}
function sch_writeReq_(q) {
  var sh = sch_sheet_('換班申請', SCH_REQ_HEAD);
  var row = [q.id, q.kind, q.status, q.shiftId, q.date, q.loc, "'" + q.start, "'" + q.end, q.fromId, q.fromName, q.toId, q.toName, q.note, q.created, q.by || '', q.at || ''];
  if (q.row) sh.getRange(q.row, 1, 1, row.length).setValues([row]); else sh.appendRow(row);
}
// 夥伴提出:give=轉讓給指定夥伴 / release=釋出給大家認領
function sch_request_(p) {
  var me = sch_me_(p.empId), kind = String(p.kind);
  if (kind !== 'give' && kind !== 'release') return { error: '申請類型錯誤' };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = sch_readShifts_(''), s = null;
    sh.rows.forEach(function (r) { if (r.id === String(p.shiftId)) s = r; });
    if (!s || s.empId !== me.id) return { error: '找不到您的這個班' };
    if (s.date < sch_today_()) return { error: '已經過去的班不能換' };
    if (sch_reqs_().some(function (q) { return q.shiftId === s.id && /待|開放/.test(q.status); })) return { error: '這個班已經有進行中的換班申請' };
    var to = kind === 'give' ? sch_staff_()[String(p.toId)] : null;
    if (kind === 'give') {
      if (!to || to.left || to.id === me.id) return { error: '請選擇要轉讓的夥伴' };
      var busy = sh.rows.filter(function (r) { return r.empId === to.id && r.date === s.date; })[0];
      if (busy) return { error: to.name + ' 當天已排在 ' + busy.loc + ' ' + busy.start + '–' + busy.end };
    }
    sch_writeReq_({ id: 'R' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10),
      kind: kind, status: kind === 'give' ? '待對方同意' : '開放認領', shiftId: s.id, date: s.date, loc: s.loc, start: s.start, end: s.end,
      fromId: me.id, fromName: me.name, toId: to ? to.id : '', toName: to ? to.name : '', note: String(p.note || '').slice(0, 60), created: sch_now_() });
  } finally { lock.releaseLock(); }
  return { success: true };
}
// 分隊長開放空班(沒有人的班,認領後核准才寫入班表)
function sch_openShift_(p) {
  var m = sch_mgr_(p.managerId), loc = String(p.loc || ''), d = sch_d_(p.date), st = sch_t_(p.start), en = sch_t_(p.end);
  if (m.managed.indexOf(loc) < 0) return { error: '您沒有這個櫃位的排班權限' };
  if (!d || !st || !en) return { error: '請填寫日期與時間' };
  var n = Math.max(1, Math.min(5, parseInt(p.count) || 1));
  for (var i = 0; i < n; i++) sch_writeReq_({ id: 'R' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss') + i + Math.floor(Math.random() * 90 + 10),
    kind: 'open', status: '開放認領', shiftId: '', date: d, loc: loc, start: st, end: en, fromId: m.me.id, fromName: m.me.name,
    toId: '', toName: '', note: String(p.note || '').slice(0, 60), created: sch_now_() });
  return { success: true };
}
// 夥伴回應:accept(被轉讓者同意)/ decline / claim(認領)/ cancel(申請人取消)
function sch_respond_(p) {
  var me = sch_me_(p.empId), act = String(p.act);
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var q = sch_reqs_().filter(function (x) { return x.id === String(p.reqId); })[0];
    if (!q) return { error: '找不到這筆申請' };
    if (act === 'cancel') {
      if (q.fromId !== me.id && !(q.kind === 'open' && me.role >= 2)) return { error: '只有申請人可以取消' };
      if (!/待|開放/.test(q.status)) return { error: '這筆申請已經處理完了' };
      q.status = '已取消'; q.by = me.name; q.at = sch_now_(); sch_writeReq_(q); return { success: true };
    }
    if (act === 'accept' || act === 'decline') {
      if (q.kind !== 'give' || q.toId !== me.id || q.status !== '待對方同意') return { error: '這筆申請不需要您回覆' };
      q.status = act === 'accept' ? '待核准' : '對方婉拒'; q.at = sch_now_(); sch_writeReq_(q); return { success: true };
    }
    if (act === 'claim') {
      if (q.status !== '開放認領') return { error: '這個空班已經有人認領了' };
      if (q.fromId === me.id && q.kind !== 'open') return { error: '這是您自己釋出的班' };
      var busy = sch_readShifts_(q.date.slice(0, 7)).rows.filter(function (r) { return r.empId === me.id && r.date === q.date; })[0];
      if (busy) return { error: '您當天已排在 ' + busy.loc + ' ' + busy.start + '–' + busy.end };
      q.toId = me.id; q.toName = me.name; q.status = '待核准'; q.at = sch_now_(); sch_writeReq_(q); return { success: true };
    }
  } finally { lock.releaseLock(); }
  return { error: '動作錯誤' };
}
// 分隊長核准/駁回 → 核准時改寫〈班表〉
function sch_approve_(p) {
  var m = sch_mgr_(p.managerId), ok = String(p.approve) === 'true' || p.approve === true;
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var q = sch_reqs_().filter(function (x) { return x.id === String(p.reqId); })[0];
    if (!q) return { error: '找不到這筆申請' };
    if (m.managed.indexOf(q.loc) < 0) return { error: '您沒有這個櫃位的權限' };
    if (q.status !== '待核准') return { error: '這筆申請目前不能核准' };
    if (!ok) { q.status = '已駁回'; q.by = m.me.name; q.at = sch_now_(); q.note = (q.note + ' ' + String(p.reason || '')).trim(); sch_writeReq_(q); return { success: true }; }
    var to = sch_staff_()[q.toId]; if (!to) return { error: '找不到接班夥伴' };
    var data = sch_readShifts_(''), c = data.c;
    var same = data.rows.filter(function (r) { return r.empId === to.id && r.date === q.date && r.id !== q.shiftId; });
    var errs = sch_blocking_(sch_dayCheck_(same.concat([{ empId: to.id, name: to.name, date: q.date, loc: q.loc, start: q.start, end: q.end }])), m.me.role);
    if (errs.length) return { error: errs[0] + (m.me.role < 3 ? '。同日第二個櫃位需要 Lv.3 以上核准' : '') };
    if (q.kind === 'open') {
      sch_applyOps_(data, [{ op: 'add', date: q.date, loc: q.loc, empId: to.id, start: q.start, end: q.end }], m.me);
    } else {
      var s = data.rows.filter(function (r) { return r.id === q.shiftId; })[0];
      if (!s) return { error: '原本的班已不存在' };
      data.sh.getRange(s.row, c.emp + 1).setValue(to.id);
      data.sh.getRange(s.row, c.name + 1).setValue(to.name);
    }
    q.status = '已核准'; q.by = m.me.name; q.at = sch_now_(); sch_writeReq_(q);
  } finally { lock.releaseLock(); }
  return { success: true };
}

// ───────── 發布(批次寫入〈班表〉)─────────
// ops: [{op:'add', date, loc, empId, start, end} | {op:'edit', id, empId, start, end} | {op:'del', id}]
function sch_applyOps_(data, ops, me) {
  var sh = data.sh, c = data.c, raw = data.raw, staff = sch_staff_(), touched = {}, adds = [], dels = [];
  var rowsById = {}; data.rows.forEach(function (r) { rowsById[r.id] = r; });
  ops.forEach(function (o) {
    if (o.op === 'add') {
      var e = staff[o.empId]; if (!e) throw new Error('找不到夥伴 ' + o.empId);
      var line = []; for (var i = 0; i < c.width; i++) line.push('');
      line[c.id] = sch_newId_() + adds.length; line[c.date] = o.date; line[c.week] = sch_week_(o.date);
      line[c.emp] = e.id; line[c.name] = e.name; line[c.loc] = o.loc; line[c.start] = "'" + o.start; line[c.end] = "'" + o.end;
      line[c.hours] = sch_hours_(o.start, o.end); line[c.status] = '已發布';
      adds.push(line); touched[o.date + '|' + o.loc] = 1;
    } else {
      var r = rowsById[o.id]; if (!r) throw new Error('找不到班表 ' + o.id + '(可能已被其他人修改,請重新整理)');
      touched[r.date + '|' + r.loc] = 1;
      if (o.op === 'del') { dels.push(r.row); return; }
      var e2 = staff[o.empId || r.empId], line2 = raw[r.row - 2];
      line2[c.emp] = e2.id; line2[c.name] = e2.name; line2[c.start] = "'" + (o.start || r.start); line2[c.end] = "'" + (o.end || r.end);
      line2[c.hours] = sch_hours_(o.start || r.start, o.end || r.end);
    }
  });
  // 重算受影響日期/櫃位的「單雙人」「是否假日」
  var cal = sch_calendar_(''), cnt = {};
  raw.forEach(function (line, i) {
    if (dels.indexOf(i + 2) >= 0 || /刪除|取消/.test(String(line[c.status]))) return;
    var k = sch_d_(line[c.date]) + '|' + String(line[c.loc]).trim(); if (touched[k]) cnt[k] = (cnt[k] || 0) + 1;
  });
  adds.forEach(function (line) { var k = line[c.date] + '|' + line[c.loc]; cnt[k] = (cnt[k] || 0) + 1; });
  var dirty = {};
  ops.forEach(function (o) { if (o.op === 'edit' && rowsById[o.id]) dirty[rowsById[o.id].row - 2] = 1; });
  var fix = function (line) {
    var d = sch_d_(line[c.date]), k = d + '|' + String(line[c.loc]).trim(); if (!touched[k]) return false;
    var dt = sch_dayType_(d, String(line[c.loc]).trim(), cal);
    line[c.type] = sch_typeWord_(raw, c, cnt[k] || 1); line[c.hol] = sch_quotaHoliday_(dt) ? '是' : '否'; line[c.htype] = dt; return true;
  };
  raw.forEach(function (line, i) {
    if (dels.indexOf(i + 2) >= 0) return;
    var before = JSON.stringify([line[c.type], line[c.hol], line[c.htype]]);
    if (fix(line) && JSON.stringify([line[c.type], line[c.hol], line[c.htype]]) !== before) dirty[i] = 1;
  });
  adds.forEach(fix);
  sch_writeRows_(sh, raw, dirty, c.width);
  if (adds.length) sh.getRange(sh.getLastRow() + 1, 1, adds.length, c.width).setValues(adds);
  dels.sort(function (a, b) { return b - a; }).forEach(function (rn) { sh.deleteRow(rn); });
  return { added: adds.length, deleted: dels.length };
}
function sch_publish_(p) {
  var m = sch_mgr_(p.managerId), ops = sch_arr_(p.ops);
  if (!ops.length) return { error: '沒有要發布的變更' };
  var today = sch_today_();
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    SCH_C_.cols = null;
    var data = sch_readShifts_(''), byId = {};
    data.rows.forEach(function (r) { byId[r.id] = r; });
    // 權限與日期檢查
    for (var i = 0; i < ops.length; i++) {
      var o = ops[i], loc = o.op === 'add' ? o.loc : (byId[o.id] || {}).loc, d = o.op === 'add' ? o.date : (byId[o.id] || {}).date;
      if (!loc) return { error: '有一筆班表已被其他人修改或刪除,請重新整理後再發布' };
      if (m.managed.indexOf(loc) < 0) return { error: '您沒有「' + loc + '」的排班權限' };
      if (d < today && m.me.role < 3) return { error: d + ' 已經過去,只有管理員可以修改' };
      if (o.op !== 'del' && (!sch_t_(o.start || 'x') && o.op === 'add')) return { error: d + ' 有一筆沒有填時間' };
    }
    // 模擬套用後檢查衝突
    var sim = data.rows.filter(function (r) { return !ops.some(function (o) { return o.op !== 'add' && o.id === r.id; }); });
    var mark = {};   // 這次有動到的「人|日」
    ops.forEach(function (o, n) {
      if (o.op === 'del') return;
      var base = o.op === 'edit' ? byId[o.id] : o, e = sch_staff_()[o.empId || base.empId];
      if (!e) throw new Error('找不到夥伴 ' + (o.empId || base.empId));
      sim.push({ id: o.id || ('new' + n), empId: e.id, name: e.name, date: base.date, loc: base.loc, start: o.start || base.start, end: o.end || base.end });
      mark[e.id + '|' + base.date] = 1;
    });
    var issues = sch_dayCheck_(sim.filter(function (r) { return mark[r.empId + '|' + r.date]; }));
    var errs = sch_blocking_(issues, m.me.role);
    if (errs.length) return { error: '有重複排班,未發布', conflicts: errs.slice(0, 10) };
    var res = sch_applyOps_(data, ops, m.me);
    return { success: true, added: res.added, deleted: res.deleted, edited: ops.filter(function (o) { return o.op === 'edit'; }).length };
  } catch (e) { return { error: e.message }; }
  finally { lock.releaseLock(); }
}

// ───────── 分隊長看板(一次載入) ─────────
function sch_board_(p) {
  var m = sch_mgr_(p.empId), ym = String(p.ym || sch_today_().slice(0, 7)), prm = sch_params_();
  var prev = Utilities.formatDate(new Date(ym + '-01T12:00:00+08:00').getTime() - 86400000 * 7 > 0 ? new Date(new Date(ym + '-01T12:00:00+08:00').getTime() - 86400000 * 7) : new Date(), 'Asia/Taipei', 'yyyy-MM');
  var cal = sch_calendar_(''), all = sch_readShifts_('').rows;
  var inRange = function (d) { return d.slice(0, 7) === ym || d.slice(0, 7) === prev || d.slice(0, 7) === sch_addMonth_(ym, 1); };
  var shifts = all.filter(function (r) { return inRange(r.date); }).map(function (r) {
    return { id: r.id, date: r.date, empId: r.empId, name: r.name, loc: r.loc, start: r.start, end: r.end, hours: r.hours || sch_hours_(r.start, r.end) };
  });
  var staff = sch_staff_(), list = [];
  Object.keys(staff).forEach(function (id) { var x = staff[id]; if (!x.left) list.push({ id: id, name: x.name, role: x.role, student: x.student }); });
  var reqs = sch_reqs_().filter(function (q) { return m.managed.indexOf(q.loc) >= 0 && (/待|開放/.test(q.status) || q.date >= sch_today_()); })
    .map(function (q) { delete q.row; return q; });
  var holidays = {};
  Object.keys(cal).forEach(function (d) { if (inRange(d)) holidays[d] = cal[d]; });
  return { success: true, ym: ym, managed: m.managed, role: m.me.role, staff: list, shifts: shifts,
    templates: sch_templates_(m.managed), avail: sch_availStrip_(sch_availAll_(ym)), holidays: holidays,
    stats: sch_stats_(all.filter(function (r) { return r.date.slice(0, 7) === ym; }), cal, prm), requests: reqs, params: prm,
    issues: sch_dayCheck_(all.filter(function (r) { return r.date.slice(0, 7) === ym; })) };
}
function sch_addMonth_(ym, n) { var y = +ym.slice(0, 4), mo = +ym.slice(5, 7) - 1 + n; y += Math.floor(mo / 12); mo = ((mo % 12) + 12) % 12; return y + '-' + ('0' + (mo + 1)).slice(-2); }
function sch_availStrip_(a) { Object.keys(a).forEach(function (k) { delete a[k].row; }); return a; }

// ───────── 夥伴「我的班表」(一次載入) ─────────
function sch_mine_(p) {
  var me = sch_me_(p.empId), today = sch_today_(), ym = today.slice(0, 7), nx = sch_addMonth_(ym, 1), prm = sch_params_();
  var cal = sch_calendar_(''), rows = sch_readShifts_('').rows.filter(function (r) { var m = r.date.slice(0, 7); return m === ym || m === nx; });
  var mine = rows.filter(function (r) { return r.empId === me.id; });
  var mates = {};
  rows.forEach(function (r) { var k = r.date + '|' + r.loc; (mates[k] = mates[k] || []).push(r.name); });
  var reqs = sch_reqs_(), staff = sch_staff_(), list = [];
  Object.keys(staff).forEach(function (id) { if (!staff[id].left && id !== me.id) list.push({ id: id, name: staff[id].name }); });
  var availYm = String(p.availYm || nx), av = sch_availAll_(availYm)[me.id] || null;
  if (av) delete av.row;
  var st = sch_stats_(mine.filter(function (r) { return r.date.slice(0, 7) === ym; }), cal, prm)[me.id] || { hours: 0, days: 0, holidayDays: 0, wage: 0 };
  var stN = sch_stats_(mine.filter(function (r) { return r.date.slice(0, 7) === nx; }), cal, prm)[me.id] || { hours: 0, days: 0, holidayDays: 0, wage: 0 };
  return { success: true, me: { id: me.id, name: me.name, student: me.student },
    shifts: mine.map(function (r) { return { id: r.id, date: r.date, loc: r.loc, start: r.start, end: r.end, hours: r.hours || sch_hours_(r.start, r.end),
      mates: (mates[r.date + '|' + r.loc] || []).filter(function (n) { return n !== me.name; }) }; }),
    stats: { cur: st, next: stN }, holidays: cal, staff: list, params: prm,
    open: reqs.filter(function (q) { return q.status === '開放認領' && q.date >= today && q.fromId !== me.id; }).map(function (q) { delete q.row; return q; }),
    incoming: reqs.filter(function (q) { return q.kind === 'give' && q.toId === me.id && q.status === '待對方同意'; }).map(function (q) { delete q.row; return q; }),
    myReqs: reqs.filter(function (q) { return (q.fromId === me.id || q.toId === me.id) && (q.date >= today); }).map(function (q) { delete q.row; return q; }),
    availYm: availYm, avail: av };
}

// ───────── 排班 vs 打卡對帳(薪資核對用) ─────────
// 打卡紀錄:B 日期、C 員工編號、F 打卡類型(上班/下班)、G 打卡時間、J 打卡地點
function sch_reconcile_(p) {
  var m = sch_mgr_(p.empId), ym = String(p.ym || sch_today_().slice(0, 7)), today = sch_today_();
  var plan = sch_readShifts_(ym).rows.filter(function (r) { return m.managed.indexOf(r.loc) >= 0 && r.date < today; });
  var punches = {};
  ['打卡紀錄', '打卡紀錄_歷史'].forEach(function (n) {
    var sh = sch_ss_().getSheetByName(n); if (!sh || sh.getLastRow() < 2) return;
    sh.getRange(2, 1, sh.getLastRow() - 1, 10).getValues().forEach(function (r) {
      var d = sch_d_(r[1]); if (d.slice(0, 7) !== ym) return;
      var t = r[6] instanceof Date ? r[6] : new Date(String(r[6])); if (isNaN(t.getTime())) return;
      var k = String(r[2]).trim() + '|' + d;
      (punches[k] = punches[k] || []).push({ type: String(r[5]).trim(), t: t.getTime(), loc: String(r[9] || '').trim() });
    });
  });
  var rows = [], planned = {}, sum = { shifts: plan.length, ok: 0, late: 0, early: 0, missing: 0, unplanned: 0, planH: 0, realH: 0 };
  plan.forEach(function (s) {
    planned[s.empId + '|' + s.date] = 1;
    var ps = (punches[s.empId + '|' + s.date] || []).filter(function (x) { return !x.loc || x.loc === s.loc; }).sort(function (a, b) { return a.t - b.t; });
    var ins = ps.filter(function (x) { return x.type === '上班'; }), outs = ps.filter(function (x) { return x.type === '下班'; });
    var due = new Date(s.date + 'T' + s.start + ':00+08:00').getTime(), endT = new Date(s.date + 'T' + s.end + ':00+08:00').getTime();
    if (endT <= due) endT += 86400000;
    var real = 0, open = null;
    ps.forEach(function (x) { if (x.type === '上班') open = x; else if (x.type === '下班' && open) { real += (x.t - open.t) / 3600000; open = null; } });
    var issue = [], ph = s.hours || sch_hours_(s.start, s.end);
    if (!ins.length) issue.push('未打上班卡');
    else if (ins[0].t > due + 5 * 60000) issue.push('遲到 ' + Math.round((ins[0].t - due) / 60000) + ' 分');
    if (ins.length && !outs.length) issue.push('未打下班卡');
    else if (outs.length && outs[outs.length - 1].t < endT - 5 * 60000) issue.push('早退 ' + Math.round((endT - outs[outs.length - 1].t) / 60000) + ' 分');
    sum.planH += ph; sum.realH += real;
    if (!ins.length) sum.missing++; else if (/遲到/.test(issue.join())) sum.late++;
    if (/早退/.test(issue.join())) sum.early++;
    if (!issue.length) sum.ok++;
    if (issue.length || Math.abs(real - ph) >= 1) rows.push({ date: s.date, name: s.name, loc: s.loc, plan: s.start + '–' + s.end, planH: ph,
      realH: Math.round(real * 10) / 10, issue: issue.join('、') || (real > ph ? '比排班多 ' : '比排班少 ') + Math.round(Math.abs(real - ph) * 10) / 10 + ' 小時' });
  });
  // 沒排班卻有打卡(只列負責櫃位)
  var staff = sch_staff_();
  Object.keys(punches).forEach(function (k) {
    if (planned[k]) return;
    var ps = punches[k], loc = (ps.filter(function (x) { return x.type === '上班'; })[0] || {}).loc || '';
    if (!loc || m.managed.indexOf(loc) < 0) return;
    var parts = k.split('|'); sum.unplanned++;
    rows.push({ date: parts[1], name: (staff[parts[0]] || {}).name || parts[0], loc: loc, plan: '—', planH: 0, realH: 0, issue: '沒有排班但有打卡' });
  });
  sum.planH = Math.round(sum.planH * 10) / 10; sum.realH = Math.round(sum.realH * 10) / 10;
  rows.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  return { success: true, ym: ym, summary: sum, rows: rows };
}

// ───────── 整理班表(Lv.3 以上;在 Google Sheets 直接改完後按一下)─────────
// 重算該月每一列:C 星期、I 預計時數、J 單雙人、K 是否假日、L 假日類型;M 空白補「已發布」;A 編號空白或重複就補新的;E 姓名對齊〈夥伴資料〉
// 不改日期、人、櫃位、時間;重複排班只列出來,不自動刪
var SCH_COLNAME = ['編號','日期','星期','員工編號','姓名','櫃位','上班','下班','時數','單雙人','是否假日','假日類型','發布狀態'];
function sch_tidy_(p) {
  var m = sch_mgr_(p.managerId), ym = String(p.ym || sch_today_().slice(0, 7));
  if (m.me.role < 3) return { error: '整理班表需要 Lv.3 以上' };
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var sh = sch_ss_().getSheetByName('班表'), c = sch_cols_(sh);
    if (sh.getLastRow() < 2) return { success: true, ym: ym, rows: 0, changed: 0, details: [], issues: [] };
    var raw = sh.getRange(2, 1, sh.getLastRow() - 1, c.width).getValues(), cal = sch_calendar_(''), staff = sch_staff_();
    var seen = {}, cnt = {}, details = [], changed = 0, rowsInMonth = 0, list = [], dirty = {};
    var live = function (r) { var d = sch_d_(r[c.date]); return d && d.slice(0, 7) === ym && String(r[c.emp]).trim() && !/刪除|取消/.test(String(r[c.status])); };
    raw.forEach(function (r) { if (!live(r)) return; var k = sch_d_(r[c.date]) + '|' + String(r[c.loc]).trim(); cnt[k] = (cnt[k] || 0) + 1; });
    raw.forEach(function (r, i) {
      var id = String(r[c.id]).trim();
      if (!live(r)) { if (id) seen[id] = 1; return; }
      rowsInMonth++;
      var d = sch_d_(r[c.date]), loc = String(r[c.loc]).trim(), st = sch_t_(r[c.start]), en = sch_t_(r[c.end]), emp = String(r[c.emp]).trim();
      var dt = sch_dayType_(d, loc, cal), want = {};
      want[c.week] = sch_week_(d);
      if (st && en) want[c.hours] = sch_hours_(st, en);
      want[c.type] = sch_typeWord_(raw, c, cnt[d + '|' + loc] || 1);
      want[c.hol] = sch_quotaHoliday_(dt) ? '是' : '否';
      want[c.htype] = dt;
      if (!String(r[c.status]).trim()) want[c.status] = '已發布';
      if (!id || seen[id]) want[c.id] = sch_newId_() + i;
      if (staff[emp] && String(r[c.name]).trim() !== staff[emp].name) want[c.name] = staff[emp].name;
      var fix = [];
      Object.keys(want).forEach(function (k) { var col = +k; if (String(r[col]) !== String(want[col])) { r[col] = want[col]; fix.push(SCH_COLNAME[col]); } });
      seen[String(r[c.id])] = 1;
      if (fix.length) { changed++; dirty[i] = 1; if (details.length < 30) details.push('第 ' + (i + 2) + ' 列 ' + d + ' ' + r[c.name] + ':補正 ' + fix.join('、')); }
      if (!st || !en) details.push('第 ' + (i + 2) + ' 列 ' + d + ' ' + r[c.name] + ':上下班時間看不懂,請手動確認');
      if (!staff[emp]) details.push('第 ' + (i + 2) + ' 列 ' + d + ':員工編號 ' + emp + ' 在〈夥伴資料〉找不到');
      list.push({ id: String(r[c.id]), date: d, empId: emp, name: String(r[c.name]), loc: loc, start: st, end: en });
    });
    sch_writeRows_(sh, raw, dirty, c.width);
    return { success: true, ym: ym, rows: rowsInMonth, changed: changed, details: details, issues: sch_dayCheck_(list).map(function (x) { return x.text; }) };
  } finally { lock.releaseLock(); }
}

// ───────── 路由 ─────────
function schHandler_(action, p) {
  if (!/^sch/.test(String(action || ''))) return null;
  p = p || {}; SCH_C_ = {};
  try {
    switch (action) {
      case 'schBoard':         return sch_board_(p);
      case 'schPublish':       return sch_publish_(p);
      case 'schSaveTemplates': return sch_saveTemplates_(p);
      case 'schMine':          return sch_mine_(p);
      case 'schSetAvail':      return sch_setAvail_(p);
      case 'schRequest':       return sch_request_(p);
      case 'schOpenShift':     return sch_openShift_(p);
      case 'schRespond':       return sch_respond_(p);
      case 'schApprove':       return sch_approve_(p);
      case 'schReconcile':     return sch_reconcile_(p);
      case 'schTidy':          return sch_tidy_(p);
    }
  } catch (e) { return { error: '排班系統錯誤:' + e.message }; }
  return null;
}

// 第一次安裝執行一次
function sch_setup() {
  sch_sheet_('班型設定', SCH_TPL_HEAD); sch_sheet_('可上班登記', SCH_AVAIL_HEAD); sch_sheet_('換班申請', SCH_REQ_HEAD);
  var sh = sch_ss_().getSheetByName('參數設定');
  if (sh) {
    var have = sh.getDataRange().getValues().map(function (r) { return String(r[0]).trim(); });
    [['排班估算時薪', 196, '排班頁預估工資用(實際薪資仍依打卡)'], ['每月達標時數', 180, ''], ['學生每月達標時數', 72, ''],
     ['每月達標假日天數', 4, ''], ['空檔填寫截止日', 20, '每月幾號前填好下個月空檔']]
      .forEach(function (x) { if (have.indexOf(x[0]) < 0) sh.appendRow(x); });
  }
  // 範例班型(只在表是空的時候放):每個櫃位平日/假日各一個 10 小時班
  var t = sch_sheet_('班型設定', SCH_TPL_HEAD);
  if (t.getLastRow() < 2) {
    var rows = [];
    sch_locNames_().forEach(function (n) { if (/^00/.test(n)) return; rows.push([n, '平日', "'11:00", "'21:00", '平日', 1], [n, '假日', "'10:30", "'21:30", '假日', 2]); });
    if (rows.length) t.getRange(2, 1, rows.length, 6).setValues(rows);
  }
  return '排班系統 v1.18 安裝完成';
}

// ═══════════════════════════════════════════════
// 營運管理 後端模組 v1（2026-11-12，v1.20 批次）
// 貼在「程式碼.gs」最底部；extHandler_ 內、secHandler_ 那行的下一行加：
//   var op = opsHandler_(action, p); if (op) return op;
// 部署後在編輯器執行一次 ops_setup()（建表、補欄位、補參數，不動既有資料）。
//
// 內容：
//   櫃位管理（Lv.3）：opsLocList／opsLocSave／opsLocStatus（刪除＝停用並隱藏，不真刪）
//   新增夥伴（Lv.3）：opsStaffList／opsStaffAdd（身分證字號、地址只回給 Lv.3）
//   到職檢查（Lv.2 看得到）：opsOnboard／opsOnboardCheck
//   物料需求（全員可送；合作夥伴、加盟店主要用）：opsMatItems／opsMatCreate／opsMatList／opsMatStatus／opsMatMonthly
//   加盟店損益（加盟主＝該店 Lv.2、總部 Lv.3）：opsPnl／opsExpAdd／opsExpDel／opsFixedSave／opsPnlClose／opsPnlReopen
//   供貨價格（Lv.3）：opsPriceList／opsPriceSave
// 敏感動作（夥伴個資、損益）需要登入 token（v1.18 登入安全模組發的）。
// ═══════════════════════════════════════════════

var OPS_MAT_HEAD   = ['需求編號','建立時間','員工編號','姓名','櫃位','品項明細(JSON)','希望到貨日','備註','狀態','處理人','處理時間','出貨日','金額','狀態紀錄(JSON)'];
var OPS_PRICE_HEAD = ['品項','單位','單價','備註'];
var OPS_EXP_HEAD   = ['費用編號','櫃位','年月','日期','分類','金額','備註','收據照片','建立者','建立時間'];
var OPS_FIX_HEAD   = ['櫃位','分類','金額','起始年月','結束年月','備註'];
var OPS_CLOSE_HEAD = ['櫃位','年月','狀態','處理人','處理時間','結帳快照(JSON)'];
var OPS_ONB_HEAD   = ['員工編號','姓名','建立時間','勞保','健保','銀行帳戶','體檢','完成時間'];
var OPS_ONB_ITEMS  = ['勞保', '健保', '銀行帳戶', '體檢'];
var OPS_MAT_ITEMS  = [['麵糊', '包'], ['麵粉', '袋'], ['二砂糖', '包'], ['紅玉紅茶粉', '包'], ['機器鍍膜', '次'], ['包材', '箱'], ['其他', '']];
var OPS_INCOME_CATS = ['外送平台收入', '其他收入'];
var OPS_EXP_CATS   = ['租金／百貨抽成', '水費', '電費', '瓦斯', '電信網路', '刷卡手續費', '外送平台抽成', '政府費用', '勞健保公司負擔', '勞退提繳', '設備維修', '機器鍍膜', '包材', '其他物料', '雜支'];
var OPS_C_ = {};

function ops_ss_() { return OPS_C_.ss || (OPS_C_.ss = SpreadsheetApp.openById(SHEET_ID)); }
function ops_sheet_(name, head) {
  var ss = ops_ss_(), sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(head); sh.setFrozenRows(1); }
  return sh;
}
function ops_rows_(sh, w) { return sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, w).getValues() : []; }
function ops_now_() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss'); }
function ops_today_() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd'); }
function ops_d_(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, 'Asia/Taipei', 'yyyy-MM-dd');
  var m = String(v).match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : String(v).slice(0, 10);
}
function ops_json_(s, d) { try { return s ? JSON.parse(s) : d; } catch (e) { return d; } }
function ops_arr_(x) { if (Object.prototype.toString.call(x) === '[object Array]') return x; return ops_json_(x, []); }
function ops_num_(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }

// ── 夥伴資料欄位（依表頭找，找不到用預設位置）──
function ops_cols_(head) {
  var c = { id: 0, name: 1, nick: 2, sex: 3, bday: 4, idno: 5, phone: 6, addr: 7, addr2: 8, hire: 9, left: 10, pos: 11, role: 12, wage: 13, pw: 36, managed: 46, type: -1 };
  head.forEach(function (h, i) {
    h = String(h).trim();
    if (h === '身分證號' || h === '身分證字號') c.idno = i;
    else if (h === '戶籍地址') c.addr = i;
    else if (h === '聯絡地址' || h === '通訊地址') c.addr2 = i;
    else if (h === '密碼' || h === '登入密碼') c.pw = i;
    else if (/負責櫃位/.test(h)) c.managed = i;
    else if (h === '帳號類型') c.type = i;
  });
  return c;
}
function ops_staff_() {
  if (OPS_C_.staff) return OPS_C_.staff;
  var sh = ops_ss_().getSheetByName('夥伴資料'), v = sh.getDataRange().getValues(), c = ops_cols_(v[0] || []), map = {}, list = [];
  for (var r = 1; r < v.length; r++) {
    var id = String(v[r][c.id]).trim(); if (!id) continue;
    var role = parseInt(v[r][c.role]) || 1;
    var o = { row: r + 1, id: id, name: String(v[r][c.name]).trim(), nick: String(v[r][c.nick] || ''), role: role, pos: String(v[r][c.pos] || ''),
      left: String(v[r][c.left] || '').trim() !== '', managed: String(v[r][c.managed] || ''),
      type: c.type >= 0 ? (String(v[r][c.type] || '').trim() || '員工') : '員工', raw: v[r] };
    map[id] = o; list.push(o);
  }
  OPS_C_.staffCols = c; OPS_C_.staffHead = v[0];
  return (OPS_C_.staff = { map: map, list: list });
}
function ops_me_(empId) {
  var me = ops_staff_().map[String(empId || '').trim()];
  if (!me || me.left) throw new Error('找不到夥伴資料');
  me.top = me.role >= 4 || me.pos === '大隊長';
  if (me.top && me.role < 3) me.role = 3;
  return me;
}
function ops_need_(p, minRole, needToken) {
  var me = ops_me_(p.empId);
  if (needToken && !sec_verifyToken_(p.token, me.id)) throw new Error('請重新登入後再試');
  if (me.role < minRole) throw new Error('需要 Lv.' + minRole + ' 以上');
  return me;
}

// ── 櫃位 ──
// 〈櫃位設定〉A 名稱 B 縣市 C 業績類型 D 每份抽成 E 狀態 F 場所性質 G 緯度 H 經度 I 品項清單
var OPS_LOC_STATUS = ['營運中', '休賽期', '暫停', '已結束', '已停用'];
var OPS_LOC_KIND   = ['固定櫃位', '快閃櫃位', '活動', '合作品牌', '加盟分隊長'];
function ops_locs_() {
  if (OPS_C_.locs) return OPS_C_.locs;
  var sh = ops_ss_().getSheetByName('櫃位設定'), out = [];
  ops_rows_(sh, 10).forEach(function (r, i) {
    var n = String(r[0]).trim(); if (!n) return;
    var code = String(r[9] === undefined ? '' : r[9]).trim().replace(/^'/, ''); if (/^\d$/.test(code)) code = '0' + code;
    if (!code) { var m = n.match(/^(\d{2})/); code = m ? m[1] : ''; }
    out.push({ row: i + 2, name: n, code: code, county: String(r[1] || ''), type: String(r[2] || ''), unitPrice: r[3] === '' ? '' : ops_num_(r[3]),
      status: String(r[4] || '營運中').trim() || '營運中', kind: String(r[5] || '固定櫃位').trim() || '固定櫃位',
      lat: r[6] === '' ? '' : ops_num_(r[6]), lng: r[7] === '' ? '' : ops_num_(r[7]), items: String(r[8] || '雞蛋糕') });
  });
  return (OPS_C_.locs = out);
}
// 櫃位一律以〈櫃位設定〉J 欄「櫃位編號」連動（空白時用名稱前兩碼）；舊紀錄的舊名稱也用前兩碼對
function ops_code_(n) { return loc_code_(n); }
function ops_sameLoc_(a, b) { if (a === b) return true; var x = ops_code_(a); return !!x && x === ops_code_(b); }
function ops_locByName_(n) { var l = ops_locs_().filter(function (x) { return x.name === n; }); return l[0] || null; }
function ops_isFranchise_(n) { var l = ops_locByName_(n); return !!(l && /加盟/.test(l.kind)); }
function ops_isPartnerLoc_(n) { var l = ops_locByName_(n); return !!(l && /合作/.test(l.kind)); }
function ops_myLocs_(me) {                          // 依「負責櫃位」比對（與排班系統同規則）
  var all = ops_locs_().map(function (x) { return x.name; });
  if (me.role >= 3) return all;
  var toks = String(me.managed || '').split(/[、,，\/\s;；]+/).map(function (x) { return x.trim(); }).filter(String);
  return all.filter(function (n) { return toks.some(function (t) { return n === t || n.indexOf(t) >= 0 || (t.length >= 2 && t.indexOf(n) >= 0); }); });
}

function ops_locList_(p) {
  ops_need_(p, 3);
  return { success: true, data: ops_locs_().map(function (x) { var o = {}; for (var k in x) if (k !== 'row') o[k] = x[k]; return o; }),
    statuses: OPS_LOC_STATUS, kinds: OPS_LOC_KIND, types: ['A百貨', 'B直結', 'C份數', 'D麵糊數'] };
}
function ops_locSave_(p) {
  ops_need_(p, 3);
  var d = typeof p.loc === 'string' ? ops_json_(p.loc, {}) : (p.loc || {});
  var name = String(d.name || '').trim(), orig = String(d.orig || '').trim();
  var code = String(d.code || '').trim(); if (!code) { var mm = name.match(/^(\d{2})/); code = mm ? mm[1] : ''; }
  if (!name) return { error: '請填櫃位名稱' };
  if (!/^\d{2}$/.test(code)) return { error: '請填兩位數的櫃位編號（例：24）；編號是各紀錄連動用的，建立後不要改' };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    OPS_C_.locs = null;
    var sh = ops_ss_().getSheetByName('櫃位設定'), locs = ops_locs_();
    var exist = locs.filter(function (x) { return x.name === (orig || name); })[0];
    if ((!orig || orig !== name) && ops_locByName_(name)) return { error: '已經有同名櫃位' };
    if (locs.some(function (x) { return x.code === code && x.name !== orig; })) return { error: '編號 ' + code + ' 已經被其他櫃位用了' };
    if (exist && exist.code && exist.code !== code) return { error: '櫃位編號建立後不能改（' + exist.code + '）' };
    var lat = d.lat === '' || d.lat === undefined ? '' : ops_num_(d.lat), lng = d.lng === '' || d.lng === undefined ? '' : ops_num_(d.lng);
    var row = [name, String(d.county || ''), String(d.type || 'A百貨'), d.unitPrice === '' || d.unitPrice === undefined ? '' : ops_num_(d.unitPrice),
      OPS_LOC_STATUS.indexOf(d.status) >= 0 ? d.status : '營運中', OPS_LOC_KIND.indexOf(d.kind) >= 0 ? d.kind : '固定櫃位', lat, lng, String(d.items || '雞蛋糕'), "'" + code];
    ops_codeHeader_(sh);
    if (exist) sh.getRange(exist.row, 1, 1, 10).setValues([row]); else sh.appendRow(row);
    var renamed = null;
    if (exist && orig !== name) renamed = ops_renameRefs_(function (v) { return v === orig ? name : null; }, OPS_REF_SHEETS);
    OPS_C_.locs = null;
    return { success: true, renamed: renamed };
  } finally { lock.releaseLock(); }
}
function ops_codeHeader_(sh) { if (String(sh.getRange(1, 10).getValue() || '').trim() !== '櫃位編號') sh.getRange(1, 10).setValue('櫃位編號'); }
// 櫃位名稱改了 → 各分頁的櫃位欄一起改（只換「完全相同」的舊名稱；負責櫃位逐項換）
var OPS_REF_SHEETS = ['班表', '班型設定', '換班申請', '可上班登記', '物料需求', '加盟費用', '加盟固定費用', '加盟結帳', '訂單', '缺貨看板', '塔防', '夥伴資料', '出勤確認'];
var OPS_HIST_SHEETS = ['打卡紀錄', '打卡紀錄_歷史', '收店盤點', '收店盤點_歷史', '開店盤點', '開店盤點_歷史', '工時日結', '塔防投入', '加盟店薪資'];
function ops_renameRefs_(mapFn, sheets) {
  var ss = ops_ss_(), out = {};
  sheets.forEach(function (n) {
    var sh = ss.getSheetByName(n); if (!sh || sh.getLastRow() < 2) return;
    var w = sh.getLastColumn(), head = sh.getRange(1, 1, 1, w).getValues()[0];
    head.forEach(function (h, c) {
      h = String(h).trim();
      var isLoc = /^(櫃位|打卡地點)$/.test(h), isMng = /負責櫃位/.test(h);
      if (!isLoc && !isMng) return;
      var rg = sh.getRange(2, c + 1, sh.getLastRow() - 1, 1), v = rg.getValues(), changed = 0;
      v.forEach(function (r) {
        var cur = String(r[0] || '').trim(); if (!cur) return;
        if (isLoc) { var nv = mapFn(cur); if (nv && nv !== cur) { r[0] = nv; changed++; } }
        else {
          var toks = cur.split(/[、,，;；]+/), hit = false;
          toks = toks.map(function (t) { t = t.trim(); var nv = mapFn(t); if (nv && nv !== t) { hit = true; return nv; } return t; });
          if (hit) { r[0] = toks.join('、'); changed++; }
        }
      });
      if (changed) { rg.setValues(v); out[n + '・' + h] = changed; }
    });
  });
  return out;
}
// 一次性整理：把各分頁裡的舊櫃位名稱（例：01正櫃遠百信義、00活動）依編號換成〈櫃位設定〉現在的名稱，並補上 J 欄編號
function ops_syncLocNames() {
  OPS_C_ = {};
  var sh = ops_ss_().getSheetByName('櫃位設定'); ops_codeHeader_(sh);
  var locs = ops_locs_(), byCode = {}, names = {}, act = null;
  locs.forEach(function (x) {
    if (x.code) { byCode[x.code] = x.name; sh.getRange(x.row, 10).setValue("'" + x.code); }
    names[x.name] = 1;
    if (/活動/.test(x.kind) && /活動/.test(x.name) && x.status !== '已停用' && !act) act = x.name;
  });
  var mapFn = function (v) {
    if (names[v]) return null;
    var m = v.match(/^(\d{2})/);
    if (m && byCode[m[1]]) return byCode[m[1]];
    if (/^00活動$/.test(v) && act) return act;
    return null;
  };
  var res = ops_renameRefs_(mapFn, OPS_REF_SHEETS.concat(OPS_HIST_SHEETS));
  Logger.log(JSON.stringify(res));
  return res;
}
function ops_locStatus_(p) {
  ops_need_(p, 3);
  var l = ops_locByName_(String(p.name || '')); if (!l) return { error: '找不到櫃位' };
  var st = String(p.status || ''); if (OPS_LOC_STATUS.indexOf(st) < 0) return { error: '狀態不正確' };
  ops_ss_().getSheetByName('櫃位設定').getRange(l.row, 5).setValue(st);
  OPS_C_.locs = null;
  return { success: true };
}
// 覆蓋 getLocations：多回傳狀態（舊版沒有），其餘欄位與原本相同
function getLocations() {
  var m = {};
  ops_locs_().forEach(function (x) {
    var items = String(x.items || '雞蛋糕').split(/[,，、]/).map(function (s) { return s.trim(); }).filter(String);
    m[x.name] = { code: x.code, county: x.county, type: x.type || 'A百貨', unitPrice: x.unitPrice === '' ? 70 : (x.unitPrice || 70), kind: x.kind,
      status: x.status, lat: x.lat === '' ? null : x.lat, lng: x.lng === '' ? null : x.lng, items: items.length ? items : ['雞蛋糕'] };
  });
  return m;
}
// 覆蓋 getLocationsApi：App 打卡等畫面不顯示「已停用」「已結束」的櫃位
function getLocationsApi(ss) {
  var all = getLocations(), out = {};
  Object.keys(all).forEach(function (k) { if (!/已停用|已結束/.test(all[k].status)) out[k] = all[k]; });
  return { success: true, data: out };
}

// ── 新增夥伴（Lv.3）──
function ops_rocDate_(s) {                           // 1996-06-07 → 85/06/07（生日沿用民國格式）
  var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(s || '');
  return (parseInt(m[1], 10) - 1911) + '/' + m[2] + '/' + m[3];
}
function ops_staffList_(p) {
  var me = ops_need_(p, 2, true), st = ops_staff_(), c = OPS_C_.staffCols, full = me.role >= 3;
  var onb = ops_onbMap_();
  return { success: true, full: full, data: st.list.filter(function (x) { return full || !x.left; }).map(function (x) {
    var o = { id: x.id, name: x.name, nick: x.nick, role: x.role, pos: x.pos, left: x.left, managed: x.managed, type: x.type,
      phone: String(x.raw[c.phone] || ''), hire: ops_d_(x.raw[c.hire]), onboard: onb[x.id] ? onb[x.id].done : null };
    if (full) { o.leftDate = ops_d_(x.raw[c.left]); o.idno = String(x.raw[c.idno] || ''); o.addr = String(x.raw[c.addr] || ''); o.addr2 = String(x.raw[c.addr2] || ''); o.bday = String(x.raw[c.bday] || ''); }
    return o;
  }) };
}
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

// 修改夥伴的權限、職務、負責櫃位、帳號類型（Lv.3）
function ops_staffUpdate_(p) {
  var me = ops_need_(p, 3, true), d = typeof p.staff === 'string' ? ops_json_(p.staff, {}) : (p.staff || {});
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    OPS_C_.staff = null;
    var st = ops_staff_(), c = OPS_C_.staffCols, x = st.map[String(d.id || '')], sh = ops_ss_().getSheetByName('夥伴資料');
    if (!x) return { error: '找不到夥伴' };
    var role = parseInt(d.role, 10);
    if (!(role >= 1 && role <= 5)) return { error: '權限等級要 1～5' };
    if (role > me.role || (x.role > me.role)) return { error: '不能設定比自己高的權限' };
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

// ── 到職檢查 ──
function ops_onbMap_() {
  var sh = ops_ss_().getSheetByName('到職檢查'), out = {};
  if (!sh) return out;
  ops_rows_(sh, 8).forEach(function (r, i) {
    var id = String(r[0]).trim(); if (!id) return;
    var items = {}; OPS_ONB_ITEMS.forEach(function (k, j) { items[k] = ops_json_(String(r[3 + j] || ''), null) || (r[3 + j] ? { by: String(r[3 + j]) } : null); });
    out[id] = { row: i + 2, id: id, name: String(r[1]), created: String(r[2]), items: items, done: !!String(r[7] || '').trim() };
  });
  return out;
}
function ops_onboard_(p) {
  ops_need_(p, 2);
  var m = ops_onbMap_();
  return { success: true, items: OPS_ONB_ITEMS, data: Object.keys(m).map(function (k) { var o = m[k]; delete o.row; return o; }).filter(function (o) { return !o.done || p.all; }) };
}
function ops_onboardCheck_(p) {
  var me = ops_need_(p, 2), item = String(p.item || ''), j = OPS_ONB_ITEMS.indexOf(item);
  if (j < 0) return { error: '項目不正確' };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var m = ops_onbMap_(), o = m[String(p.target || '')]; if (!o) return { error: '找不到這位新夥伴' };
    var sh = ops_ss_().getSheetByName('到職檢查'), on = p.on !== false && p.on !== 'false';
    sh.getRange(o.row, 4 + j).setValue(on ? JSON.stringify({ by: me.name, at: ops_now_() }) : '');
    o.items[item] = on ? { by: me.name } : null;
    var all = OPS_ONB_ITEMS.every(function (k) { return o.items[k]; });
    sh.getRange(o.row, 8).setValue(all ? ops_now_() : '');
    return { success: true, done: all };
  } finally { lock.releaseLock(); }
}

// ── 供貨價格 ──
function ops_prices_() {
  var sh = ops_sheet_('供貨價格', OPS_PRICE_HEAD), out = {};
  ops_rows_(sh, 4).forEach(function (r) { var n = String(r[0]).trim(); if (n) out[n] = { unit: String(r[1] || ''), price: r[2] === '' ? null : ops_num_(r[2]), note: String(r[3] || '') }; });
  return out;
}
function ops_priceList_(p) { ops_need_(p, 2); var pr = ops_prices_(); return { success: true, data: Object.keys(pr).map(function (k) { return { item: k, unit: pr[k].unit, price: pr[k].price, note: pr[k].note }; }) }; }
function ops_priceSave_(p) {
  ops_need_(p, 3, true);
  var list = ops_arr_(p.list), sh = ops_sheet_('供貨價格', OPS_PRICE_HEAD);
  var rows = list.filter(function (x) { return String(x.item || '').trim(); }).map(function (x) { return [String(x.item).trim(), String(x.unit || ''), x.price === '' || x.price === null || x.price === undefined ? '' : ops_num_(x.price), String(x.note || '')]; });
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 4).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, 4).setValues(rows);
  return { success: true };
}

// ── 物料需求 ──
function ops_matRows_() {
  var sh = ops_sheet_('物料需求', OPS_MAT_HEAD);
  return ops_rows_(sh, OPS_MAT_HEAD.length).map(function (r, i) {
    return { row: i + 2, id: String(r[0]), created: String(r[1]), empId: String(r[2]), name: String(r[3]), loc: String(r[4]),
      items: ops_json_(String(r[5] || ''), []), want: ops_d_(r[6]), note: String(r[7] || ''), status: String(r[8] || '已送出'),
      by: String(r[9] || ''), at: String(r[10] || ''), shipDate: ops_d_(r[11]), amount: r[12] === '' ? null : ops_num_(r[12]), log: ops_json_(String(r[13] || ''), []) };
  }).filter(function (x) { return x.id; });
}
function ops_matItems_(p) {
  var pr = ops_prices_();
  return { success: true, items: OPS_MAT_ITEMS.map(function (x) { return { item: x[0], unit: (pr[x[0]] && pr[x[0]].unit) || x[1] }; }) };
}
function ops_matCreate_(p) {
  var me = ops_me_(p.empId), loc = String(p.loc || '').trim();
  if (!ops_locByName_(loc)) return { error: '請選櫃位' };
  if (me.role < 3 && ops_myLocs_(me).indexOf(loc) < 0 && me.type !== '員工') return { error: '只能替自己的櫃位叫貨' };
  var items = ops_arr_(p.items).map(function (x) { return { item: String(x.item || '').trim().slice(0, 20), qty: ops_num_(x.qty), unit: String(x.unit || '').slice(0, 6), note: String(x.note || '').slice(0, 40) }; })
    .filter(function (x) { return x.item && x.qty > 0; });
  if (!items.length) return { error: '請至少填一項數量' };
  var id = 'M' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
  var log = [{ s: '已送出', by: me.name, at: ops_now_() }];
  ops_sheet_('物料需求', OPS_MAT_HEAD).appendRow([id, ops_now_(), me.id, me.name, loc, JSON.stringify(items), String(p.want || ''), String(p.note || '').slice(0, 200), '已送出', '', '', '', '', JSON.stringify(log)]);
  try { if (typeof line_notify_ === 'function') line_notify_('物料', '📦 物料需求｜' + loc.replace(/^\d+/, '') + '\n' + items.map(function (x) { return '・' + x.item + ' ' + x.qty + (x.unit || ''); }).join('\n') + (p.want ? '\n希望到貨：' + p.want : '') + (p.note ? '\n備註：' + p.note : '') + '\n（' + me.name + '）'); } catch (e) {}
  return { success: true, id: id };
}
function ops_matCanSee_(me, x) {
  if (me.role >= 3) return true;
  if (x.empId === me.id) return true;
  return ops_myLocs_(me).indexOf(x.loc) >= 0;
}
function ops_matList_(p) {
  var me = ops_me_(p.empId), ym = String(p.ym || '');
  var list = ops_matRows_().filter(function (x) { return ops_matCanSee_(me, x) && (!ym || x.created.slice(0, 7) === ym || (p.open && !/已送達|已取消/.test(x.status))); });
  list.sort(function (a, b) { return a.created < b.created ? 1 : -1; });
  return { success: true, canManage: me.role >= 3, data: list.slice(0, 200).map(function (x) { delete x.row; return x; }) };
}
function ops_matStatus_(p) {
  var me = ops_me_(p.empId), st = String(p.status || '');
  if (['已收到', '已出貨', '已送達', '已取消'].indexOf(st) < 0) return { error: '狀態不正確' };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var x = ops_matRows_().filter(function (r) { return r.id === String(p.id || ''); })[0];
    if (!x) return { error: '找不到這張需求單' };
    if (me.role < 3 && !(st === '已取消' && x.empId === me.id && x.status === '已送出') && !(st === '已送達' && ops_matCanSee_(me, x) && x.status === '已出貨')) return { error: '只有總部（Lv.3）可以改狀態' };
    var sh = ops_ss_().getSheetByName('物料需求');
    x.log.push({ s: st, by: me.name, at: ops_now_() });
    var amount = x.amount, ship = x.shipDate;
    if (st === '已出貨') {
      ship = String(p.shipDate || ops_today_());
      var pr = ops_prices_(), total = 0, miss = false;
      x.items.forEach(function (it) { var u = pr[it.item]; if (u && u.price !== null) total += u.price * it.qty; else miss = true; });
      amount = miss && !total ? '' : Math.round(total);
    }
    sh.getRange(x.row, 9, 1, 6).setValues([[st, me.name, ops_now_(), ship || '', amount === null ? '' : amount, JSON.stringify(x.log)]]);
    return { success: true };
  } finally { lock.releaseLock(); }
}
// 月底結算：各櫃位各品項數量合計（不含已取消），金額依出貨時的單價
function ops_matMonthly_(p) {
  var me = ops_need_(p, 2), ym = String(p.ym || ops_today_().slice(0, 7));
  var mine = ops_myLocs_(me), by = {};
  ops_matRows_().forEach(function (x) {
    if (x.created.slice(0, 7) !== ym || x.status === '已取消') return;
    if (me.role < 3 && mine.indexOf(x.loc) < 0) return;
    var L = by[x.loc] = by[x.loc] || { loc: x.loc, orders: 0, items: {}, amount: 0, pending: 0 };
    L.orders++; if (x.amount !== null) L.amount += x.amount;
    if (!/已出貨|已送達/.test(x.status)) L.pending++;
    x.items.forEach(function (it) { var k = it.item + '|' + (it.unit || ''); L.items[k] = (L.items[k] || 0) + it.qty; });
  });
  return { success: true, ym: ym, data: Object.keys(by).map(function (k) {
    var L = by[k]; L.items = Object.keys(L.items).map(function (q) { var a = q.split('|'); return { item: a[0], unit: a[1], qty: Math.round(L.items[q] * 100) / 100 }; });
    return L;
  }) };
}

// ── 加盟店損益 ──
function ops_param_(name, def) {
  var sh = ops_ss_().getSheetByName('參數設定'); if (!sh) return def;
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]).trim() === name) return v[i][1] === '' ? def : v[i][1];
  return def;
}
function ops_pnlAuth_(p) {
  var me = ops_need_(p, 2, true), loc = String(p.loc || '');
  if (!ops_isFranchise_(loc)) throw new Error('這個櫃位不是加盟店');
  if (me.role < 3 && ops_myLocs_(me).indexOf(loc) < 0) throw new Error('只能看自己的加盟店');
  return me;
}
function ops_franchiseLocs_(p) {
  var me = ops_need_(p, 2), mine = ops_myLocs_(me);
  return { success: true, data: ops_locs_().filter(function (x) { return /加盟/.test(x.kind) && x.status !== '已停用' && (me.role >= 3 || mine.indexOf(x.name) >= 0); }).map(function (x) { return x.name; }),
    incomeCats: OPS_INCOME_CATS, expCats: OPS_EXP_CATS };
}
function ops_closed_(loc, ym) {
  var sh = ops_sheet_('加盟結帳', OPS_CLOSE_HEAD), hit = null;
  ops_rows_(sh, 6).forEach(function (r, i) { if (String(r[0]) === loc && String(r[1]) === ym) hit = { row: i + 2, status: String(r[2]), by: String(r[3]), at: String(r[4]) }; });
  return hit;
}
function ops_expRows_(loc, ym) {
  var sh = ops_sheet_('加盟費用', OPS_EXP_HEAD);
  return ops_rows_(sh, OPS_EXP_HEAD.length).map(function (r, i) { return { row: i + 2, id: String(r[0]), loc: String(r[1]), ym: String(r[2]), date: ops_d_(r[3]), cat: String(r[4]), amount: ops_num_(r[5]), note: String(r[6] || ''), photo: String(r[7] || ''), by: String(r[8] || '') }; })
    .filter(function (x) { return x.id && x.loc === loc && (!ym || x.ym === ym); });
}
function ops_fixedRows_(loc) {
  var sh = ops_sheet_('加盟固定費用', OPS_FIX_HEAD);
  return ops_rows_(sh, 6).map(function (r) { return { loc: String(r[0]), cat: String(r[1]), amount: ops_num_(r[2]), from: String(r[3] || ''), to: String(r[4] || ''), note: String(r[5] || '') }; })
    .filter(function (x) { return x.loc === loc && x.cat; });
}
function ops_revenueByDay_(loc, ym) {
  var out = {};
  ['收店盤點_歷史', '收店盤點'].forEach(function (n) {
    var sh = ops_ss_().getSheetByName(n); if (!sh || sh.getLastRow() < 2) return;
    var v = sh.getRange(2, 1, sh.getLastRow() - 1, Math.min(sh.getLastColumn(), 31)).getValues();
    v.forEach(function (r) {
      if (!ops_sameLoc_(String(r[5]).trim(), loc)) return;
      var d = ops_d_(r[1]); if (d.slice(0, 7) !== ym) return;
      var tot = r[30] !== '' && r[30] !== undefined ? ops_num_(r[30]) : ops_num_(r[16]);
      out[d] = { rev: tot, batter: ops_num_(r[15]) };       // 同櫃同日以最後一筆為準
    });
  });
  return out;
}
function ops_pnlCalc_(loc, ym) {
  var days = ops_revenueByDay_(loc, ym), revenue = 0, batterUse = 0, openDays = 0;
  Object.keys(days).forEach(function (d) { revenue += days[d].rev; batterUse += days[d].batter; if (days[d].rev > 0) openDays++; });
  var exps = ops_expRows_(loc, ym), fixed = ops_fixedRows_(loc).filter(function (f) { return (!f.from || f.from <= ym) && (!f.to || f.to >= ym); });
  var income = {}, cost = {};
  exps.forEach(function (e) { if (OPS_INCOME_CATS.indexOf(e.cat) >= 0) income[e.cat] = (income[e.cat] || 0) + e.amount; else cost[e.cat] = (cost[e.cat] || 0) + e.amount; });
  var fixedApplied = [];
  fixed.forEach(function (f) {                       // 當月若已手動填同分類，就不再自動帶入
    if (exps.some(function (e) { return e.cat === f.cat; })) return;
    cost[f.cat] = (cost[f.cat] || 0) + f.amount; fixedApplied.push(f.cat);
  });
  var otherIncome = Object.keys(income).reduce(function (s, k) { return s + income[k]; }, 0);
  var sales = revenue + otherIncome;
  var vat = /是|Y|1|有/.test(String(ops_param_('加盟店開發票', '是'))) ? Math.round(sales / 1.05 * 0.05) : 0;
  var pr = ops_prices_(), missing = [];
  var batterPrice = pr['麵糊'] && pr['麵糊'].price !== null ? pr['麵糊'].price : null;
  if (batterPrice === null && batterUse) missing.push('麵糊');
  var batterCost = batterPrice === null ? 0 : Math.round(batterUse * batterPrice);
  // 物料（麵糊以收店用量計，避免重複；其他品項以當月出貨的物料需求單計）
  var mat = {}, matCost = 0;
  ops_matRows_().forEach(function (x) {
    if (!ops_sameLoc_(x.loc, loc) || !/已出貨|已送達/.test(x.status) || (x.shipDate || x.created).slice(0, 7) !== ym) return;
    x.items.forEach(function (it) {
      if (it.item === '麵糊') return;
      var u = pr[it.item];
      if (!u || u.price === null) { if (missing.indexOf(it.item) < 0) missing.push(it.item); return; }
      mat[it.item] = (mat[it.item] || 0) + u.price * it.qty; matCost += u.price * it.qty;
    });
  });
  matCost = Math.round(matCost);
  var rate = ops_num_(ops_param_('加盟權利金比率', 0.01)); if (rate > 1) rate = rate / 100;
  var royalty = Math.round(revenue * rate);
  // 人事：系統代算的加盟店夥伴薪資（薪資引擎 v3）＋加盟主自評人力
  var labor = { staff: 0, list: [], owner: 0, ownerHours: 0 };
  try {
    if (typeof pay3_compute_ === 'function') {
      var res = pay3_compute_(ym, {});
      Object.keys(res.emps).forEach(function (id) {
        var e = res.emps[id]; if (!e.franchise || !ops_sameLoc_(e.franchiseLoc, loc)) return;
        if (e.isOwner) { labor.ownerHours += e.totalH; return; }
        labor.staff += e.gross; labor.list.push({ id: id, name: e.name, hours: e.totalH, gross: e.gross, notes: e.notes });
      });
    }
  } catch (e) { labor.err = e.message; }
  var ownerWage = ops_num_(ops_param_('加盟主自評時薪_' + loc, ops_param_('加盟主自評時薪', 0)));
  labor.owner = Math.round(labor.ownerHours * ownerWage);
  var opex = Object.keys(cost).reduce(function (s, k) { return s + cost[k]; }, 0);
  var totalCost = vat + batterCost + matCost + labor.staff + opex + royalty;
  var net = sales - totalCost, netOwner = net - labor.owner;
  var variable = vat + batterCost + matCost + royalty;
  var fixedCost = totalCost - variable, varRatio = sales ? variable / sales : 0;
  var be = openDays && varRatio < 1 ? Math.ceil(fixedCost / (1 - varRatio) / openDays) : null;
  return { loc: loc, ym: ym, revenue: Math.round(revenue), income: income, sales: Math.round(sales), vat: vat, openDays: openDays,
    avgDaily: openDays ? Math.round(revenue / openDays) : 0, batterUse: Math.round(batterUse * 100) / 100, batterPrice: batterPrice, batterCost: batterCost,
    materials: mat, matCost: matCost, labor: labor, ownerWage: ownerWage, costs: cost, fixedApplied: fixedApplied, royaltyRate: rate, royalty: royalty,
    totalCost: Math.round(totalCost), net: Math.round(net), netOwner: Math.round(netOwner), margin: sales ? Math.round(net / sales * 1000) / 10 : 0,
    breakEvenDaily: be, missingPrice: missing, days: Object.keys(days).sort().map(function (d) { return { date: d, rev: days[d].rev, batter: days[d].batter }; }) };
}
function ops_prevYm_(ym) { var y = +ym.slice(0, 4), m = +ym.slice(5) - 1; if (!m) { y--; m = 12; } return y + '-' + ('0' + m).slice(-2); }
function ops_pnl_(p) {
  var me = ops_pnlAuth_(p), loc = String(p.loc), ym = String(p.ym || ops_today_().slice(0, 7));
  var cl = ops_closed_(loc, ym), cur;
  if (cl && cl.status === '已結帳') {
    var snap = ops_json_(String(ops_ss_().getSheetByName('加盟結帳').getRange(cl.row, 6).getValue() || ''), null);
    cur = snap || ops_pnlCalc_(loc, ym);
  } else cur = ops_pnlCalc_(loc, ym);
  var pc = ops_closed_(loc, ops_prevYm_(ym)), prev = null;
  try {
    if (pc && pc.status === '已結帳') prev = ops_json_(String(ops_ss_().getSheetByName('加盟結帳').getRange(pc.row, 6).getValue() || ''), null);
    if (!prev && p.withPrev !== false) prev = ops_pnlCalc_(loc, ops_prevYm_(ym));
  } catch (e) {}
  return { success: true, pnl: cur, prev: prev ? { revenue: prev.revenue, net: prev.net, margin: prev.margin } : null,
    closed: cl, expenses: ops_expRows_(loc, ym).map(function (e) { delete e.row; return e; }), fixed: ops_fixedRows_(loc),
    canReopen: me.role >= 3, incomeCats: OPS_INCOME_CATS, expCats: OPS_EXP_CATS };
}
function ops_lockedCheck_(loc, ym) { var cl = ops_closed_(loc, ym); if (cl && cl.status === '已結帳') throw new Error(ym + ' 已結帳，要修改請總部（Lv.3）解鎖'); }
function ops_expAdd_(p) {
  var me = ops_pnlAuth_(p), loc = String(p.loc), d = String(p.date || ops_today_()), ym = d.slice(0, 7);
  ops_lockedCheck_(loc, ym);
  var cat = String(p.cat || ''); if (OPS_INCOME_CATS.indexOf(cat) < 0 && OPS_EXP_CATS.indexOf(cat) < 0) return { error: '請選分類' };
  var amt = ops_num_(p.amount); if (!(amt > 0)) return { error: '金額要大於 0' };
  var id = 'X' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
  ops_sheet_('加盟費用', OPS_EXP_HEAD).appendRow([id, loc, ym, d, cat, amt, String(p.note || '').slice(0, 100), String(p.photo || ''), me.name, ops_now_()]);
  return { success: true, id: id };
}
function ops_expDel_(p) {
  ops_pnlAuth_(p);
  var x = ops_expRows_(String(p.loc), '').filter(function (e) { return e.id === String(p.id || ''); })[0];
  if (!x) return { error: '找不到這筆' };
  ops_lockedCheck_(x.loc, x.ym);
  ops_ss_().getSheetByName('加盟費用').deleteRow(x.row);
  return { success: true };
}
function ops_fixedSave_(p) {
  ops_pnlAuth_(p);
  var loc = String(p.loc), list = ops_arr_(p.list), sh = ops_sheet_('加盟固定費用', OPS_FIX_HEAD);
  var keep = ops_rows_(sh, 6).filter(function (r) { return String(r[0]) !== loc && String(r[0]).trim(); });
  list.forEach(function (f) { if (OPS_EXP_CATS.indexOf(f.cat) >= 0 && ops_num_(f.amount) > 0) keep.push([loc, f.cat, ops_num_(f.amount), String(f.from || ''), String(f.to || ''), String(f.note || '')]); });
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 6).clearContent();
  if (keep.length) sh.getRange(2, 1, keep.length, 6).setValues(keep);
  return { success: true };
}
function ops_pnlClose_(p) {
  var me = ops_pnlAuth_(p), loc = String(p.loc), ym = String(p.ym || '');
  if (!/^\d{4}-\d{2}$/.test(ym) || ym >= ops_today_().slice(0, 7)) return { error: '只能結帳已經過完的月份' };
  var snap = ops_pnlCalc_(loc, ym), cl = ops_closed_(loc, ym), sh = ops_sheet_('加盟結帳', OPS_CLOSE_HEAD);
  var row = [loc, ym, '已結帳', me.name, ops_now_(), JSON.stringify(snap)];
  if (cl) sh.getRange(cl.row, 1, 1, 6).setValues([row]); else sh.appendRow(row);
  try { if (typeof pay3_writeFranchise_ === 'function') pay3_writeFranchise_(ym, loc); } catch (e) {}
  return { success: true };
}
function ops_pnlReopen_(p) {
  var me = ops_need_(p, 3, true), cl = ops_closed_(String(p.loc), String(p.ym));
  if (!cl) return { error: '這個月還沒結帳' };
  ops_ss_().getSheetByName('加盟結帳').getRange(cl.row, 3, 1, 3).setValues([['已解鎖', me.name, ops_now_()]]);
  return { success: true };
}
// 總部：應收加盟店（物料款＋權利金）
function ops_receivable_(p) {
  ops_need_(p, 3, true);
  var ym = String(p.ym || ops_prevYm_(ops_today_().slice(0, 7)));
  return { success: true, ym: ym, data: ops_locs_().filter(function (x) { return /加盟/.test(x.kind); }).map(function (x) {
    var c = ops_pnlCalc_(x.name, ym);
    return { loc: x.name, revenue: c.revenue, royalty: c.royalty, batter: c.batterCost, materials: c.matCost, total: c.royalty + c.batterCost + c.matCost, missingPrice: c.missingPrice };
  }) };
}

// 登入後 App 查一次：帳號類型、可管理的櫃位、加盟店、待辦數
function ops_meInfo_(p) {
  var me = ops_me_(p.empId), mine = ops_myLocs_(me), locs = ops_locs_();
  var fr = locs.filter(function (x) { return /加盟/.test(x.kind) && x.status !== '已停用' && (me.role >= 3 || (me.role >= 2 && mine.indexOf(x.name) >= 0)); }).map(function (x) { return x.name; });
  var home = locs.filter(function (x) { return x.status !== '已停用' && mine.indexOf(x.name) >= 0; }).map(function (x) { return x.name; });
  var tokens = String(me.managed || '').split(/[、,，\/\s;；]+/).filter(String);
  var myLoc = locs.filter(function (x) { return tokens.some(function (t) { return x.name === t || x.name.indexOf(t) >= 0; }); }).map(function (x) { return x.name; });
  var onb = 0; if (me.role >= 2) { var m = ops_onbMap_(); Object.keys(m).forEach(function (k) { if (!m[k].done) onb++; }); }
  var mat = 0; if (me.role >= 3) ops_matRows_().forEach(function (x) { if (/已送出|已收到/.test(x.status)) mat++; });
  return { success: true, type: me.type, role: me.role, top: me.top, myLocs: myLoc, manageLocs: me.role >= 3 ? [] : home, franchiseLocs: fr,
    onboardPending: onb, matPending: mat, annMinRole: Number(ops_param_('公告發布最低權限', 2)) || 2 };
}

// ── 路由 ──
function opsHandler_(action, p) {
  if (!/^ops/.test(String(action || ''))) return null;
  p = p || {}; OPS_C_ = {};
  try {
    switch (action) {
      case 'opsMe':           return ops_meInfo_(p);
      case 'opsLocList':      return ops_locList_(p);
      case 'opsLocSave':      return ops_locSave_(p);
      case 'opsLocStatus':    return ops_locStatus_(p);
      case 'opsStaffList':    return ops_staffList_(p);
      case 'opsStaffAdd':     return ops_staffAdd_(p);
      case 'opsStaffUpdate':  return ops_staffUpdate_(p);
      case 'opsOnboard':      return ops_onboard_(p);
      case 'opsOnboardCheck': return ops_onboardCheck_(p);
      case 'opsPriceList':    return ops_priceList_(p);
      case 'opsPriceSave':    return ops_priceSave_(p);
      case 'opsMatItems':     return ops_matItems_(p);
      case 'opsMatCreate':    return ops_matCreate_(p);
      case 'opsMatList':      return ops_matList_(p);
      case 'opsMatStatus':    return ops_matStatus_(p);
      case 'opsMatMonthly':   return ops_matMonthly_(p);
      case 'opsFranchise':    return ops_franchiseLocs_(p);
      case 'opsPnl':          return ops_pnl_(p);
      case 'opsExpAdd':       return ops_expAdd_(p);
      case 'opsExpDel':       return ops_expDel_(p);
      case 'opsFixedSave':    return ops_fixedSave_(p);
      case 'opsPnlClose':     return ops_pnlClose_(p);
      case 'opsPnlReopen':    return ops_pnlReopen_(p);
      case 'opsReceivable':   return ops_receivable_(p);
    }
  } catch (e) { return { error: e.message }; }
  return null;
}

// 部署後執行一次（只補缺的，不動資料）
function ops_setup() {
  ops_sheet_('物料需求', OPS_MAT_HEAD); ops_sheet_('加盟費用', OPS_EXP_HEAD); ops_sheet_('加盟固定費用', OPS_FIX_HEAD);
  ops_sheet_('加盟結帳', OPS_CLOSE_HEAD); ops_sheet_('到職檢查', OPS_ONB_HEAD);
  var pr = ops_sheet_('供貨價格', OPS_PRICE_HEAD);
  if (pr.getLastRow() < 2) pr.getRange(2, 1, OPS_MAT_ITEMS.length - 1, 4).setValues(OPS_MAT_ITEMS.slice(0, -1).map(function (x) { return [x[0], x[1], '', '單價待隊長補上'] }));
  var st = ops_ss_().getSheetByName('夥伴資料'), head = st.getRange(1, 1, 1, st.getLastColumn()).getValues()[0];
  if (head.map(String).indexOf('帳號類型') < 0) st.getRange(1, st.getLastColumn() + 1).setValue('帳號類型');
  var ps = ops_ss_().getSheetByName('參數設定'), have = ps.getDataRange().getValues().map(function (r) { return String(r[0]).trim(); });
  [['加盟權利金比率', 0.01, '加盟店權利金＝營業額 × 此比率（1% 填 0.01）'], ['加盟店開發票', '是', '是＝損益自動扣 5% 營業稅'], ['加盟主自評時薪', 0, '加盟主自己上班的人力成本（只用在損益「含加盟主人力」）'],
   ['新工時規則起始月', '2026-12', '此月起：排班定框、打卡定實際、加班需核准'], ['遲到早退寬限分鐘', 15, ''], ['公告發布最低權限', 2, '2＝分隊長也能發（只能發給自己負責的櫃位）；3＝只有管理者']]
    .forEach(function (x) { if (have.indexOf(x[0]) < 0) ps.appendRow(x); });
  return '營運管理 v1 安裝完成';
}

// 櫃位名稱 → 櫃位編號（各模組共用；依〈櫃位設定〉J 欄，空白或找不到時用名稱前兩碼）
function loc_code_(n) {
  n = String(n || '').trim(); if (!n) return '';
  try { if (typeof OPS_C_ !== 'undefined') { var l = ops_locByName_(n); if (l && l.code) return l.code; } } catch (e) {}
  var m = n.match(/^(\d{2})/); return m ? m[1] : '';
}

// 試算表分頁整理：依用途排順序、上顏色，系統用的分頁先隱藏（名稱不改，程式不受影響）。部署後執行一次，之後新增分頁時可再執行。
var OPS_TAB_GROUPS = [
  ['#c0392b', false, ['夥伴資料', '到職檢查']],
  ['#e67e22', false, ['櫃位設定', '物料需求', '供貨價格', '加盟費用', '加盟固定費用', '加盟結帳', '加盟店薪資', '訂單', '缺貨看板']],
  ['#f1c40f', false, ['打卡紀錄', '班表', '班型設定', '換班申請', '可上班登記', '出勤確認', '開店盤點', '收店盤點', '行事曆設定']],
  ['#27ae60', false, ['薪資明細', '累計工時', '達標紀錄', '業績記錄', '特休紀錄', '年終結算', '介紹獎金追蹤', '參數設定', '勞保級距表', '健保級距表', '面糊成本設定']],
  ['#2980b9', false, ['公告', 'LINE群組', '投票', '投票紀錄', 'SOP', '題庫']],
  ['#8e44ad', true,  ['赤心幣流水帳', '遊戲參數', '商品目錄', '擁有物品', '徽章紀錄', '互動紀錄', '答題紀錄', '團隊基金', '寵物', '寵物相簿', '寵物日記', '寵物交換', '寵物動態', '工時日結', '扭蛋紀錄', '生日祝福', '小遊戲紀錄', '對戰裝備', '對戰紀錄', '即時對戰', '塔防', '塔防戰報', '塔防投入', '小店', '小店交易', '禮物', '角色造型', '造型道具']],
  ['#7f8c8d', true,  ['打卡紀錄_歷史', '開店盤點_歷史', '收店盤點_歷史']]
];
function ops_organizeTabs() {
  var ss = ops_ss_(), pos = 1, done = {};
  OPS_TAB_GROUPS.forEach(function (g) {
    g[2].forEach(function (n) {
      var sh = ss.getSheetByName(n); if (!sh) return;
      sh.setTabColor(g[0]); ss.setActiveSheet(sh); ss.moveActiveSheet(pos++); done[n] = 1;
      if (g[1]) sh.hideSheet(); else if (sh.isSheetHidden()) sh.showSheet();
    });
  });
  ss.setActiveSheet(ss.getSheetByName('夥伴資料'));
  var rest = ss.getSheets().map(function (s) { return s.getName(); }).filter(function (n) { return !done[n]; });
  return '已整理 ' + Object.keys(done).length + ' 個分頁' + (rest.length ? '；未分類（放在最後）：' + rest.join('、') : '');
}

// 覆蓋排班系統的 sch_locNames_：排班只列出沒有停用、沒有結束的櫃位（舊班表仍保留）
function sch_locNames_() {
  if (SCH_C_.locs) return SCH_C_.locs;
  var sh = sch_ss_().getSheetByName('櫃位設定'), out = [];
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues().forEach(function (r) {
    var n = String(r[0]).trim(); if (n && !/已停用|已結束/.test(String(r[4] || ''))) out.push(n);
  });
  return (SCH_C_.locs = out);
}

// 覆蓋排班系統的 sch_staff_：合作夥伴（例：桃機山海豆花）不排班，不出現在排班名單
function sch_staff_() {
  if (SCH_C_.staff) return SCH_C_.staff;
  var v = sch_ss_().getSheetByName('夥伴資料').getDataRange().getValues(), head = v[0] || [], out = {};
  var iMng = 46, iStu = -1, iType = -1;
  head.forEach(function (h, i) { h = String(h); if (/負責櫃位/.test(h)) iMng = i; if (/學生/.test(h)) iStu = i; if (h.trim() === '帳號類型') iType = i; });
  for (var r = 1; r < v.length; r++) {
    var id = String(v[r][0]).trim(); if (!id) continue;
    if (iType >= 0 && /合作/.test(String(v[r][iType]))) continue;
    out[id] = {
      id: id, name: String(v[r][1]).trim(), left: String(v[r][10] || '').trim() !== '',
      role: parseInt(v[r][12]) || (/管理/.test(String(v[r][12])) ? 3 : 1),
      managed: String(v[r][iMng] || ''), student: iStu >= 0 && /是|Y|1|學生/i.test(String(v[r][iStu]))
    };
  }
  return (SCH_C_.staff = out);
}

// ═══════════════════════════════════════════════
// 薪資引擎 v3 後端模組 v1（2026-11-12，v1.20 批次；v3＝部署端修正日期格式的民國生日）
// 貼在「程式碼.gs」最底部（要在登入安全模組、排班系統模組、營運管理模組之後）；
// extHandler_ 內、opsHandler_ 那行的下一行加：
//   var py = payHandler_(action, p); if (py) return py;
//
// 1. 新工時規則（隊長 11/12 定案；〈參數設定〉「新工時規則起始月」起適用，預設 2026-12）
//    排班定框、打卡定實際、加班要核准：
//    - 早到不算，從排班上班時間起算
//    - 遲到／早退 ≤ 寬限（「遲到早退寬限分鐘」，預設 15）視同準時；超過依實際打卡時間（只少算實際的分鐘）
//    - 晚走：下班打卡往前取最近的整點或半點，比排班多出的時數列為「待核准加班」，分隊長核准後才計入
//    - 有排班沒打卡：先依排班時數計，薪資表標「⚠ 無打卡，請確認」，分隊長在對帳頁確認出勤或缺勤
//    - 有打卡沒排班（臨時支援）：分隊長核准後才計入（依實際打卡）
//    - 活動（場所性質＝活動）：依打卡實際時數
//    起始月以前的月份：照舊依打卡（與原 calcSalaryV2 相同）。
// 2. calcSalaryV2 改用本引擎（覆蓋原本最後一個版本）。其餘獎金、津貼、勞健保算法完全照舊。
//    加盟店夥伴（帳號類型＝加盟店夥伴，或只在加盟櫃位上班）寫進〈加盟店薪資〉，不進〈薪資明細〉；
//    合作夥伴不算薪資。
// 3. sec_salaryToDate_（我的→本月薪資概況）改用本引擎，提醒也一起顯示。
// 4. 對帳頁：payRecon（待確認清單）、payDecide（核准加班／確認出勤或缺勤／核准臨時支援）。
// ═══════════════════════════════════════════════

var PAY_DEC_HEAD = ['鍵值', '日期', '員工編號', '姓名', '櫃位', '類型', '結果', '時數', '處理人', '處理時間', '備註'];
var PAY_FR_HEAD = ['薪資編號', '年月', '員工編號', '姓名', '櫃位', '正常工時', '假日工時', '總工時', '基本8小時薪', '加班薪資1(1.33)', '加班薪資2(1.67)', '加班薪資3(2倍)',
  '假日加倍薪資', '基本薪資小計', '團體獎金', '業績獎金', '技能津貼', '貢獻津貼', '長青津貼', '生日津貼', '三節津貼', '職務加給', '薪資合計', '勞保自付', '健保自付',
  '未投保補貼', '轉帳手續費', '實領金額', '發放方式', '發布狀態', '備注', '假日出勤獎金', '保費加發', '系統提醒', '加盟店'];

function pay3_ss_() { return SpreadsheetApp.openById(SHEET_ID); }
function pay3_sheet_(name, head) {
  var ss = pay3_ss_(), sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(head); sh.setFrozenRows(1); }
  return sh;
}
function pay3_param_(P, name, def) { return P[name] === undefined || P[name] === '' || P[name] === 0 && def !== 0 ? def : P[name]; }
function pay3_rawParam_(name, def) {                 // getParams 只轉數字；文字參數另外讀
  var sh = pay3_ss_().getSheetByName('參數設定'); if (!sh) return def;
  var v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]).trim() === name) return v[i][1] === '' ? def : v[i][1];
  return def;
}
function pay3_ruleStart_() {
  var v = pay3_rawParam_('新工時規則起始月', '2026-12');
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, 'Asia/Taipei', 'yyyy-MM');
  return String(v).slice(0, 7);
}
function pay3_decisions_() {
  var sh = pay3_sheet_('出勤確認', PAY_DEC_HEAD), out = {};
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 11).getValues().forEach(function (r, i) {
    var k = String(r[0]).trim(); if (!k) return;
    out[k] = { row: i + 2, result: String(r[6]), hours: Number(r[7]) || 0, by: String(r[8] || ''), at: String(r[9] || '') };
  });
  return out;
}
// 櫃位改名後，舊紀錄（例：01正櫃遠百信義）用前兩碼編號對到新名稱（01遠百信義-4樓）；名稱含「活動」視為活動
function pay3_locAlias_(locs) {
  var byCode = {}, actKey = null;
  Object.keys(locs).forEach(function (n) { var cd = locs[n].code || (n.match(/^(\d{2})/) || [])[1]; if (cd && !byCode[cd]) byCode[cd] = locs[n]; if (/活動/.test(locs[n].kind || '') && /活動/.test(n) && !actKey) actKey = locs[n]; });
  var get = function (n) {
    if (locs[n]) return locs[n];
    var m = String(n || '').match(/^(\d{2})/);
    if (m && byCode[m[1]]) return byCode[m[1]];
    if (/活動/.test(String(n || ''))) return actKey || { kind: '活動', type: 'B直結', county: '' };
    return undefined;
  };
  if (typeof Proxy === 'function') return new Proxy(locs, { get: function (t, k) { return typeof k === 'string' ? get(k) : t[k]; } });
  return locs;
}
// 生日：〈夥伴資料〉是民國年（67/09/07），原引擎直接 new Date 會當成西元 1967 年，年齡多算 11 歲（長青津貼會誤發）→ 這裡改正
function pay3_bday_(v) {
  if (!v) return null;
  if (Object.prototype.toString.call(v) === '[object Date]') {      // 部署端修正 11/12：生日欄多半是以 yy/mm/dd「日期格式」存的民國年，
    var y0 = v.getFullYear();                                        // 67/09/07 會被試算表存成 1967 → 加 11 才是 1978（隊長 11/12 決定一律當民國年）
    if (y0 < 1912) y0 += 1911; else if (y0 >= 1930 && y0 <= 1999) y0 += 11;
    return new Date(y0, v.getMonth(), v.getDate());
  }
  var m = String(v).trim().match(/^(\d{2,4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (!m) { var d = new Date(v); return isNaN(d) ? null : d; }
  var y = parseInt(m[1], 10); if (y < 1000) y += 1911;
  return new Date(y, parseInt(m[2], 10) - 1, parseInt(m[3], 10));
}
function pay3_code_(n) { var c = typeof loc_code_ === 'function' ? loc_code_(n) : ((String(n || '').match(/^(\d{2})/) || [])[1] || ''); return c || '名:' + String(n || ''); }
function pay3_same_(a, b) { return a === b || pay3_code_(a) === pay3_code_(b); }
function pay3_t_(date, hhmm) { return new Date(date + 'T' + hhmm + ':00+08:00').getTime(); }
function pay3_hhmm_(t) { return Utilities.formatDate(new Date(t), 'Asia/Taipei', 'HH:mm'); }
// 一組打卡 → 依上下班配對出的時數（同一個地點）
function pay3_pairHours_(ps) {
  var h = 0, open = null, first = null;
  ps.slice().sort(function (a, b) { return a.t - b.t; }).forEach(function (x) {
    if (x.type === '上班') { open = x; if (first === null) first = x.t; }
    else if (x.type === '下班' && open) { h += Math.max(0, (x.t - open.t) / 3600000); open = null; }
  });
  return { hrs: h, first: first };
}

// ── 核心：算出每位夥伴某月（到 cutoff 為止）的工時與薪資 ──
// opt: { cutoff:'yyyy-MM-dd'（含）, only:'E001', overview:true（我的→本月薪資概況） }
function pay3_compute_(ym, opt) {
  opt = opt || {};
  var ss = pay3_ss_(), P = getParams(), cal = getCalendar(), locs = pay3_locAlias_(getLocations());
  var wage = P['基準時薪'] || 196, targetMonth = parseInt(ym.slice(5), 10), FEST = [1, 6, 9];
  var newRule = ym >= pay3_ruleStart_(), grace = (Number(pay3_rawParam_('遲到早退寬限分鐘', 15)) || 15) * 60000;
  var cutoff = opt.cutoff || '9999-12-31';
  var staffV = ss.getSheetByName('夥伴資料').getDataRange().getValues(), head = staffV[0] || [];
  var iType = -1, iMng = 46; head.forEach(function (h, i) { h = String(h).trim(); if (h === '帳號類型') iType = i; if (/負責櫃位/.test(h)) iMng = i; });
  var staff = {}; for (var si = 1; si < staffV.length; si++) { var id0 = String(staffV[si][0]).trim(); if (id0) staff[id0] = staffV[si]; }
  var cum = ss.getSheetByName('累計工時').getDataRange().getValues();
  var dec = newRule ? pay3_decisions_() : {};
  var isAct = function (loc) { return /活動/.test((locs[loc] || {}).kind || ''); };
  var isFr = function (loc) { return /加盟/.test((locs[loc] || {}).kind || ''); };

  // 打卡（含歷史）
  var punches = {};
  ['打卡紀錄_歷史', '打卡紀錄'].forEach(function (n) {
    var sh = ss.getSheetByName(n); if (!sh || sh.getLastRow() < 2) return;
    sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(17, Math.min(sh.getLastColumn(), 17))).getValues().forEach(function (r) {
      var eid = String(r[2]).trim(); if (!eid) return;
      var flag = String(r[16] || '');
      if (flag.indexOf('異常未下班') >= 0 && flag.indexOf('已由管理員補登') < 0) return;
      var t = r[6] ? new Date(r[6]) : null; if (!t || isNaN(t)) return;
      var d = Utilities.formatDate(t, 'Asia/Taipei', 'yyyy-MM-dd');
      if (d.slice(0, 7) !== ym || d > cutoff) return;
      if (opt.only && eid !== opt.only) return;
      var k = eid + '|' + d;
      (punches[k] = punches[k] || []).push({ type: String(r[5]).trim(), t: t.getTime(), loc: String(r[9] || '').trim() });
    });
  });

  // 計薪「段」：{ empId, date, loc, hrs, first, note }
  var segs = [], pending = [], flags = {};
  var addFlag = function (eid, txt) { (flags[eid] = flags[eid] || []).push(txt); };
  if (!newRule) {
    Object.keys(punches).forEach(function (k) {
      var a = k.split('|'), byLoc = {};
      punches[k].forEach(function (x) { (byLoc[x.loc] = byLoc[x.loc] || []).push(x); });
      Object.keys(byLoc).forEach(function (loc) {
        var r = pay3_pairHours_(byLoc[loc]); if (!r.hrs) return;
        segs.push({ empId: a[0], date: a[1], loc: loc, hrs: r.hrs, first: r.first, how: '打卡' });
      });
    });
  } else {
    SCH_C_ = {};
    var plan = sch_readShifts_(ym).rows.filter(function (s) { return s.date <= cutoff && (!opt.only || s.empId === opt.only); });
    var planned = {};
    plan.forEach(function (s) { (planned[s.empId + '|' + s.date] = planned[s.empId + '|' + s.date] || []).push(s); });
    var keys = {}; Object.keys(planned).forEach(function (k) { keys[k] = 1; }); Object.keys(punches).forEach(function (k) { keys[k] = 1; });
    Object.keys(keys).forEach(function (k) {
      var a = k.split('|'), eid = a[0], d = a[1], ps = punches[k] || [], used = {};
      var name = staff[eid] ? String(staff[eid][1]) : eid;
      (planned[k] || []).forEach(function (s) {
        if (isAct(s.loc)) return;                       // 活動：依打卡（下面處理）
        used[pay3_code_(s.loc)] = 1;
        var mine = ps.filter(function (x) { return !x.loc || pay3_same_(x.loc, s.loc); });
        var ins = mine.filter(function (x) { return x.type === '上班'; }).sort(function (x, y) { return x.t - y.t; });
        var outs = mine.filter(function (x) { return x.type === '下班'; }).sort(function (x, y) { return x.t - y.t; });
        var ps0 = pay3_t_(d, s.start), pe0 = pay3_t_(d, s.end); if (pe0 <= ps0) pe0 += 86400000;
        var key = d + '|' + eid + '|' + s.loc, planH = (pe0 - ps0) / 3600000;
        if (!ins.length && !outs.length) {
          var dn = dec[key + '|無打卡'];
          if (dn && dn.result === '缺勤') return;
          segs.push({ empId: eid, date: d, loc: s.loc, hrs: planH, first: ps0, how: '排班（無打卡）' });
          if (!dn) { addFlag(eid, d.slice(5) + ' 無打卡'); pending.push({ key: key + '|無打卡', type: '無打卡', date: d, empId: eid, name: name, loc: s.loc, plan: s.start + '–' + s.end, planH: planH, actual: '—', suggest: planH }); }
          return;
        }
        var st = ps0, en = pe0, note = [];
        if (ins.length && ins[0].t > ps0 + grace) { st = ins[0].t; note.push('遲到 ' + Math.round((ins[0].t - ps0) / 60000) + ' 分'); }
        if (outs.length) {
          var lo = outs[outs.length - 1].t;
          if (lo < pe0 - grace) { en = lo; note.push('早退 ' + Math.round((pe0 - lo) / 60000) + ' 分'); }
          var extra = Math.floor((lo - pe0) / 1800000) * 0.5;        // 往前取最近的整點或半點
          if (extra >= 0.5) {
            var dk = key + '|加班', dv = dec[dk];
            if (dv && dv.result === '核准') { en = pe0 + dv.hours * 3600000; note.push('加班 ' + dv.hours + 'h（已核准）'); }
            else if (!dv) { addFlag(eid, d.slice(5) + ' 加班 ' + extra + 'h 待核准'); pending.push({ key: dk, type: '加班', date: d, empId: eid, name: name, loc: s.loc, plan: s.start + '–' + s.end, planH: planH, actual: pay3_hhmm_(lo) + ' 下班', suggest: extra }); }
          }
        } else { note.push('未打下班卡，依排班'); addFlag(eid, d.slice(5) + ' 未打下班卡'); }
        var h = Math.max(0, (en - st) / 3600000);
        if (h > 0) segs.push({ empId: eid, date: d, loc: s.loc, hrs: h, first: st, how: note.join('、') || '準時' });
      });
      // 打卡但不在排班內的地點：活動依打卡；其他＝臨時支援，核准後才算
      var byLoc = {};
      ps.forEach(function (x) { if (x.loc ? !used[pay3_code_(x.loc)] : !Object.keys(used).length) (byLoc[x.loc] = byLoc[x.loc] || []).push(x); });
      Object.keys(byLoc).forEach(function (loc) {
        var r = pay3_pairHours_(byLoc[loc]); if (!r.hrs) return;
        if (isAct(loc) || !loc) { segs.push({ empId: eid, date: d, loc: loc, hrs: r.hrs, first: r.first, how: '活動（依打卡）' }); return; }
        var dk = d + '|' + eid + '|' + loc + '|臨時支援', dv = dec[dk];
        if (dv && dv.result === '核准') segs.push({ empId: eid, date: d, loc: loc, hrs: r.hrs, first: r.first, how: '臨時支援（已核准）' });
        else if (!dv) { addFlag(eid, d.slice(5) + ' 沒排班有打卡 待核准'); pending.push({ key: dk, type: '臨時支援', date: d, empId: eid, name: name, loc: loc, plan: '—', planH: 0, actual: Math.round(r.hrs * 10) / 10 + 'h', suggest: Math.round(r.hrs * 10) / 10 }); }
      });
    });
  }

  // 櫃位每日工時、人數（假日獎金分攤、業績門檻人數、團體獎金比例）
  var locDayHours = {}, locDayCount = {}, locMonthHours = {}, empLocHours = {}, seen = {};
  segs.forEach(function (s) {
    var k = s.date + '_' + s.loc;
    locDayHours[k] = (locDayHours[k] || 0) + s.hrs;
    if (!seen[k + s.empId]) { locDayCount[k] = (locDayCount[k] || 0) + 1; seen[k + s.empId] = 1; }
    locMonthHours[s.loc] = (locMonthHours[s.loc] || 0) + s.hrs;
    empLocHours[s.empId + '_' + s.loc] = (empLocHours[s.empId + '_' + s.loc] || 0) + s.hrs;
  });
  // 業績
  var calcRev = function (loc, rev) {
    var lc = locs[loc] || {};
    if (lc.type === 'A百貨') return rev * 0.8;
    if (lc.type === 'C份數') return rev * (lc.unitPrice || P['C類預設抽成'] || 70);
    return rev;
  };
  var dayRevenue = {};
  ['收店盤點_歷史', '收店盤點'].forEach(function (n) {
    var sh = ss.getSheetByName(n); if (!sh || sh.getLastRow() < 2) return;
    sh.getRange(2, 1, sh.getLastRow() - 1, Math.min(sh.getLastColumn(), 31)).getValues().forEach(function (r) {
      if (!r[1]) return;
      var d = Utilities.formatDate(new Date(r[1]), 'Asia/Taipei', 'yyyy-MM-dd');
      if (d.slice(0, 7) !== ym || d > cutoff) return;
      var tot = r[30] !== '' && r[30] !== undefined ? parseFloat(r[30]) : parseFloat(r[16]) || 0;
      dayRevenue[d + '_' + String(r[5])] = tot || 0;
    });
  });
  var locRev = {}, locDays = {}, groupPool = {}, groupEq = {};
  Object.keys(dayRevenue).forEach(function (k) { var loc = k.slice(11), c = calcRev(loc, dayRevenue[k]); if (!c) return; locRev[loc] = (locRev[loc] || 0) + c; locDays[loc] = (locDays[loc] || 0) + 1; });
  Object.keys(locRev).forEach(function (loc) { var eq = locRev[loc] / locDays[loc] * 30; groupEq[loc] = eq; if (eq > (P['團體獎金門檻'] || 200000)) groupPool[loc] = locRev[loc] * 0.01; });

  // 逐人
  var bySeg = {}; segs.forEach(function (s) { (bySeg[s.empId] = bySeg[s.empId] || []).push(s); });
  var emps = {}, tier = function (c) { return c > 4320 ? 2400 : c > 2160 ? 1200 : 600; };
  var salSh = ss.getSheetByName('薪資明細'), salEx = salSh ? salSh.getDataRange().getValues() : [];
  Object.keys(bySeg).forEach(function (empId) {
    var emp = staff[empId]; if (!emp) return;
    if (emp[10] && !opt.only) return;                   // 已離職（與原引擎相同）
    var type = iType >= 0 ? String(emp[iType] || '').trim() : '';
    if (/合作/.test(type)) return;
    var home = String(emp[38] || ''), birthday = pay3_bday_(emp[4]);
    var laborSt = String(emp[41] || '公司投保'), healthSt = String(emp[42] || '公司投保'), deps = parseInt(emp[27]) || 0;
    var cumHrs = 0; for (var i = cum.length - 1; i >= 1; i--) if (String(cum[i][0]) === empId) { cumHrs = parseFloat(cum[i][6]) || 0; break; }
    var basic = 0, ot1 = 0, ot2 = 0, ot3 = 0, dblPay = 0, holBonus = 0, perfBonus = 0, group = 0, normalH = 0, holH = 0;
    var locSet = {}, perfAwarded = {}, days = [], byDay = {};
    bySeg[empId].forEach(function (s) { (byDay[s.date] = byDay[s.date] || []).push(s); });
    Object.keys(byDay).sort().forEach(function (date) {
      var list = byDay[date]; list.sort(function (a, b) { return a.first - b.first; });
      var off = 0;
      list.forEach(function (s) {
        var lc = locs[s.loc] || {}; locSet[s.loc] = 1;
        var dt = getDayType(s.date, lc.county || '', home, cal);
        var h = s.hrs, a = off, z = off + h;
        var seg = function (lo, hi) { return Math.max(0, Math.min(z, hi) - Math.max(a, lo)); };
        var b = seg(0, 8) * wage, o1 = seg(8, 10) * wage * 1.33, o2 = seg(10, 12) * wage * 1.67, o3 = seg(12, 999) * wage * 2;
        off = z;
        var row = { date: s.date, loc: s.loc, hrs: Math.round(h * 100) / 100, how: s.how, dayType: dt, pay: 0, holBonus: 0, perf: 0, rev: null };
        if (dt === '國定假日' || dt === '颱風日') { dblPay += b + o1 + o2 + o3; holH += h; row.pay = (b + o1 + o2 + o3) * 2; }
        else { basic += b; ot1 += o1; ot2 += o2; ot3 += o3; normalH += h; row.pay = b + o1 + o2 + o3; }
        if (dt === '假日' || dt === '連假日' || (lc.kind === '活動' && dt === '平日')) {
          var tot = locDayHours[s.date + '_' + s.loc] || h, hb = CEIL((P['假日出勤獎金'] || 500) / tot * h);
          holBonus += hb; row.holBonus = hb;
        }
        var ak = s.date + '_' + s.loc;
        if (!perfAwarded[ak]) {
          var rev = dayRevenue[ak];
          if (rev !== undefined) {
            var cv = calcRev(s.loc, rev), th = perfBonusTable(locDayCount[ak] || 1, P), pb = 0;
            if (cv >= th[2]) pb = 1000; else if (cv >= th[1]) pb = 700; else if (cv >= th[0]) pb = 500;
            perfBonus += pb; row.perf = pb; row.rev = Math.round(cv);
            row.next = pb >= 1000 ? 0 : Math.ceil((pb >= 700 ? th[2] : pb >= 500 ? th[1] : th[0]) - cv);
          }
          perfAwarded[ak] = 1;
        }
        row.pay = CEIL(row.pay); days.push(row);
      });
    });
    var groupNotes = [];
    Object.keys(locSet).forEach(function (loc) {
      if (groupPool[loc] && locMonthHours[loc]) group += groupPool[loc] * (empLocHours[empId + '_' + loc] || 0) / locMonthHours[loc];
      else if (groupEq[loc]) groupNotes.push(loc + ' 月換算業績目前約 ' + Math.round(groupEq[loc]).toLocaleString() + '，超過 ' + (P['團體獎金門檻'] || 200000).toLocaleString() + ' 才有團體獎金');
    });
    var totalH = normalH + holH;
    basic = CEIL(basic); ot1 = CEIL(ot1); ot2 = CEIL(ot2); ot3 = CEIL(ot3); dblPay = CEIL(dblPay * 2); group = CEIL(group);
    var basicTotal = basic + ot1 + ot2 + ot3 + dblPay;
    var skill = cumHrs > 180 ? CEIL(totalH * 20) : 0;
    var cl = cumHrs > 4320 ? 20 : cumHrs > 3240 ? 15 : cumHrs > 2160 ? 10 : cumHrs > 1080 ? 5 : 0;
    var contrib = CEIL(totalH * cl);
    var age = 0;
    if (birthday && !isNaN(birthday)) { var ref = new Date(ym + '-01'); age = ref.getFullYear() - birthday.getFullYear(); if (ref.getMonth() < birthday.getMonth()) age--; }
    var evergreen = age >= 50 ? CEIL(totalH * (10 + (age - 50))) : 0;   // 長青津貼：隊長 11/12 定案要發（年滿 50 歲，每小時 +(年齡−50+10)）
    var isBday = !!(birthday && !isNaN(birthday) && birthday.getMonth() + 1 === targetMonth), isFest = FEST.indexOf(targetMonth) >= 0;
    var bday = isBday ? (totalH >= 80 ? tier(cumHrs) : 200) : 0, fest = isFest ? (totalH >= 80 ? tier(cumHrs) : 200) : 0;
    var laborDed = 0, healthDed = 0, insAdd = 0;
    try {
      if (laborSt === '公司投保') laborDed = parseFloat(emp[21]) || 0;
      else insAdd += CEIL(parseFloat(getInsuranceRow(ss, empId, '勞保級距表')[3]) || 0);
      if (healthSt === '公司投保') healthDed = (parseFloat(emp[26]) || 0) * (1 + Math.min(deps, 3));
      else if (healthSt === '無投保') insAdd += CEIL(parseFloat(getInsuranceRow(ss, empId, '健保級距表')[3]) || 0);
    } catch (e) {}
    var fee = parseFloat(emp[17]) || 0, duty = 0, ri = -1;
    for (var k = 1; k < salEx.length; k++) if (String(salEx[k][2]) === empId && ymNorm(salEx[k][1]) === ym) { ri = k; duty = parseFloat(salEx[k][21]) || 0; break; }
    var gross = basicTotal + group + perfBonus + skill + contrib + evergreen + bday + fest + duty + holBonus + insAdd;
    // 加盟店：帳號類型＝加盟店夥伴，或所有工時都在加盟櫃位
    var frHours = {}, frAll = true;
    Object.keys(locSet).forEach(function (l) { if (isFr(l)) frHours[l] = empLocHours[empId + '_' + l] || 0; else if (l) frAll = false; });
    var frLocs = Object.keys(frHours).sort(function (a, b) { return frHours[b] - frHours[a]; });
    var franchise = /加盟/.test(type) || (frAll && frLocs.length > 0);
    var mng = String(emp[iMng] || '');
    var franchiseLoc = franchise ? (frLocs[0] || mng.split(/[、,，\/\s;；]+/)[0] || '') : '';
    var isOwner = franchise && (parseInt(emp[12]) || 1) >= 2 && !!franchiseLoc && (mng.indexOf(franchiseLoc) >= 0 || franchiseLoc.indexOf(mng.trim()) >= 0 && mng.trim().length >= 2);
    emps[empId] = { empId: empId, name: String(emp[1]), locs: Object.keys(locSet), normalH: normalH, holH: holH, totalH: Math.round(totalH * 100) / 100,
      basic: basic, ot1: ot1, ot2: ot2, ot3: ot3, dblPay: dblPay, basicTotal: basicTotal, group: group, perfBonus: perfBonus, skill: skill, contrib: contrib, cl: cl,
      evergreen: evergreen, age: age, bday: bday, fest: fest, isBday: isBday, isFest: isFest, tier: tier(cumHrs), duty: duty, holBonus: holBonus, insAdd: insAdd,
      laborDed: laborDed, healthDed: healthDed, deps: deps, fee: fee, gross: gross, net: gross - laborDed - healthDed - fee, cumHrs: cumHrs, ri: ri,
      days: days, groupNotes: groupNotes, notes: flags[empId] || [], franchise: franchise, franchiseLoc: franchiseLoc, isOwner: isOwner, wage: wage };
  });
  return { ym: ym, newRule: newRule, emps: emps, pending: pending, segs: segs };
}

function pay3_row_(ym, e, salEx) {
  var ri = e.ri;
  return [ym + '-' + e.empId, ym, e.empId, e.name, e.locs.join('、'),
    Math.round(e.normalH * 10) / 10, Math.round(e.holH * 10) / 10, Math.round(e.totalH * 10) / 10,
    e.basic, e.ot1, e.ot2, e.ot3, e.dblPay, e.basicTotal, e.group, e.perfBonus, e.skill, e.contrib, e.evergreen,
    e.bday, e.fest, e.duty, e.gross, e.laborDed, e.healthDed, e.insAdd, e.fee, e.net, '匯款',
    ri > 0 ? (salEx[ri][29] || '待確認') : '待確認', ri > 0 ? (salEx[ri][30] || '') : '',
    e.holBonus, e.insAdd, e.notes.length ? '⚠ ' + e.notes.join('；') + '（請到排班→對帳確認）' : ''];
}

// 覆蓋 calcSalaryV2：總部夥伴寫〈薪資明細〉，加盟店夥伴寫〈加盟店薪資〉
function calcSalaryV2(ym) {
  var ss = pay3_ss_(), res = pay3_compute_(ym, {});
  var salSheet = ss.getSheetByName('薪資明細'), salEx = salSheet.getDataRange().getValues();
  if (String(salEx[0][33] || '') !== '系統提醒') salSheet.getRange(1, 34).setValue('系統提醒');
  var count = 0;
  Object.keys(res.emps).forEach(function (id) {
    var e = res.emps[id]; if (e.franchise) return;
    var row = pay3_row_(ym, e, salEx);
    if (e.ri > 0) salSheet.getRange(e.ri + 1, 1, 1, 34).setValues([row]); else salSheet.appendRow(row);
    count++;
  });
  pay3_writeFranchise_(ym, '', res);
  return count;
}
function pay3_writeFranchise_(ym, onlyLoc, res) {
  res = res || pay3_compute_(ym, {});
  var sh = pay3_sheet_('加盟店薪資', PAY_FR_HEAD), ex = sh.getDataRange().getValues(), n = 0;
  Object.keys(res.emps).forEach(function (id) {
    var e = res.emps[id]; if (!e.franchise || (onlyLoc && e.franchiseLoc !== onlyLoc)) return;
    var ri = -1; for (var i = 1; i < ex.length; i++) if (String(ex[i][2]) === id && ymNorm(ex[i][1]) === ym) { ri = i; break; }
    var copy = {}; for (var k in e) copy[k] = e[k]; copy.ri = ri;
    var row = pay3_row_(ym, copy, ex).concat([e.franchiseLoc + (e.isOwner ? '（加盟主）' : '')]);
    if (ri > 0) sh.getRange(ri + 1, 1, 1, row.length).setValues([row]); else sh.appendRow(row);
    n++;
  });
  return n;
}

// 覆蓋 sec_salaryToDate_：本月 1 日～昨天（我的→本月薪資概況）
function sec_salaryToDate_(p) {
  var empId = String(p.empId || '').trim();
  if (!sec_verifyToken_(p.token, empId)) return { error: '請重新登入後再查看', relogin: true };
  var today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd'), ym = today.slice(0, 7);
  var asOf = Utilities.formatDate(new Date(new Date(today + 'T00:00:00+08:00').getTime() - 86400000), 'Asia/Taipei', 'yyyy-MM-dd');
  var base = { success: true, ym: ym, asOf: asOf, hours: { normal: 0, holiday: 0, total: 0 }, days: [], items: [], deductions: [], gross: 0, net: 0, notes: [] };
  if (asOf.slice(0, 7) !== ym) { base.notes.push('今天是本月第一天，明天起就會看到本月的累計。'); return base; }
  var res = pay3_compute_(ym, { cutoff: asOf, only: empId, overview: true }), e = res.emps[empId];
  base.newRule = res.newRule;
  if (!e) { base.notes.push(res.newRule ? '本月到昨天還沒有計薪的班。' : '本月到昨天還沒有打卡紀錄。'); return base; }
  var it = function (key, label, amt, note) { if (amt || note) base.items.push({ key: key, label: label, amt: amt || 0, note: note || '' }); };
  it('basic', '基本工資', e.basic, Math.round(e.normalH * 10) / 10 + ' 小時 × $' + e.wage);
  it('ot', '加班費', e.ot1 + e.ot2 + e.ot3, (e.ot1 + e.ot2 + e.ot3) ? '第 9 小時起 ×1.33／×1.67／×2' : '');
  it('dbl', '國定假日／颱風日加倍', e.dblPay, e.dblPay ? Math.round(e.holH * 10) / 10 + ' 小時，工資 ×2' : '');
  it('perf', '每日業績獎金', e.perfBonus, '');
  it('hol', '假日出勤獎金', e.holBonus, '');
  it('group', '團體獎金（預估）', e.group, e.group ? '依目前業績預估，月底結算為準' : '');
  it('skill', '技能津貼', e.skill, e.skill ? '每小時 +$20' : '');
  it('contrib', '貢獻津貼', e.contrib, e.contrib ? '每小時 +$' + e.cl : '');
  it('ever', '長青津貼', e.evergreen, e.evergreen ? e.age + ' 歲，每小時 +$' + (10 + e.age - 50) : '');
  if (e.isBday) it('bday', '生日津貼', e.bday, e.totalH >= 80 ? '本月已滿 80 小時' : '目前 ' + Math.round(e.totalH) + ' 小時，滿 80 小時可領 $' + e.tier);
  if (e.isFest) it('fest', '三節津貼', e.fest, e.totalH >= 80 ? '本月已滿 80 小時' : '目前 ' + Math.round(e.totalH) + ' 小時，滿 80 小時可領 $' + e.tier);
  it('duty', '職務加給', e.duty, '');
  it('ins', '勞健保補貼', e.insAdd, '');
  base.gross = base.items.reduce(function (s, x) { return s + x.amt; }, 0);
  if (e.laborDed) base.deductions.push({ label: '勞保自付', amt: e.laborDed });
  if (e.healthDed) base.deductions.push({ label: '健保自付' + (e.deps ? '（含眷屬 ' + Math.min(e.deps, 3) + ' 人）' : ''), amt: e.healthDed });
  if (e.fee) base.deductions.push({ label: '轉帳手續費', amt: e.fee });
  base.net = base.gross - base.deductions.reduce(function (s, x) { return s + x.amt; }, 0);
  base.hours = { normal: Math.round(e.normalH * 10) / 10, holiday: Math.round(e.holH * 10) / 10, total: Math.round(e.totalH * 10) / 10 };
  base.days = e.days; base.cumHrs = e.cumHrs; base.franchise = e.franchise;
  base.notes = (e.notes.length ? ['待分隊長確認：' + e.notes.join('、') + '（確認後金額可能變動）'] : []).concat(e.groupNotes)
    .concat([(res.newRule ? '依排班時間計薪：早到不算，遲到早退 15 分鐘內不扣，加班要分隊長核准。' : '依打卡時數計算。') + '只算到昨天；勞健保是整月金額。正式薪資以月底結算的薪資單為準。']);
  return base;
}

// ── 對帳頁：待確認清單、核准 ──
function pay3_recon_(p) {
  var m = sch_mgr_(p.empId), ym = String(p.ym || Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM'));
  var today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
  var res = pay3_compute_(ym, { cutoff: Utilities.formatDate(new Date(new Date(today + 'T00:00:00+08:00').getTime() - 86400000), 'Asia/Taipei', 'yyyy-MM-dd') });
  var dec = pay3_decisions_(), done = [], inM = function (l) { return m.managed.some(function (x) { return pay3_same_(x, l); }); };
  Object.keys(dec).forEach(function (k) {
    var a = k.split('|'); if (a[0].slice(0, 7) !== ym || !inM(a[2])) return;
    done.push({ key: k, date: a[0], empId: a[1], name: (sch_staff_()[a[1]] || {}).name || a[1], loc: a[2], type: a[3], result: dec[k].result, hours: dec[k].hours, by: dec[k].by, at: dec[k].at });
  });
  return { success: true, ym: ym, newRule: res.newRule, ruleStart: pay3_ruleStart_(),
    pending: res.pending.filter(function (x) { return inM(x.loc); }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }),
    done: done.sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 60) };
}
function pay3_decide_(p) {
  var m = sch_mgr_(p.empId), key = String(p.key || ''), a = key.split('|');
  if (a.length !== 4) return { error: '資料不正確' };
  if (!m.managed.some(function (x) { return pay3_same_(x, a[2]); })) return { error: '您不是這個櫃位的分隊長' };
  var type = a[3], result = String(p.result || '');
  var ok = { '加班': ['核准', '不核准'], '無打卡': ['出勤', '缺勤'], '臨時支援': ['核准', '不核准'] }[type];
  if (!ok || ok.indexOf(result) < 0) return { error: '選項不正確' };
  var hours = Number(p.hours) || 0;
  if (type === '加班' && result === '核准') { hours = Math.round(hours * 2) / 2; if (!(hours >= 0.5 && hours <= 8)) return { error: '加班時數要 0.5～8 小時，以半小時為單位' }; }
  if (a[1] === m.me.id && m.me.role < 3) return { error: '自己的出勤請由其他管理者確認' };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = pay3_sheet_('出勤確認', PAY_DEC_HEAD), dec = pay3_decisions_(), staff = sch_staff_();
    var row = [key, a[0], a[1], (staff[a[1]] || {}).name || '', a[2], type, result, hours, m.me.name,
      Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss'), String(p.note || '').slice(0, 60)];
    if (dec[key]) sh.getRange(dec[key].row, 1, 1, 11).setValues([row]); else sh.appendRow(row);
    return { success: true };
  } finally { lock.releaseLock(); }
}
function pay3_undo_(p) {
  var m = sch_mgr_(p.empId), key = String(p.key || ''), a = key.split('|');
  if (!m.managed.some(function (x) { return pay3_same_(x, a[2]); })) return { error: '您不是這個櫃位的分隊長' };
  var dec = pay3_decisions_(); if (!dec[key]) return { error: '找不到這筆' };
  pay3_ss_().getSheetByName('出勤確認').deleteRow(dec[key].row);
  return { success: true };
}

function payHandler_(action, p) {
  if (!/^pay/.test(String(action || ''))) return null;
  p = p || {}; SCH_C_ = {};
  try {
    switch (action) {
      case 'payRecon':  return pay3_recon_(p);
      case 'payDecide': return pay3_decide_(p);
      case 'payUndo':   return pay3_undo_(p);
    }
  } catch (e) { return { error: e.message }; }
  return null;
}

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

// ═══════════════════════════════════════════════
// 路由 extHandler_ v1.20（2026-11-12）
// 整段貼在「程式碼.gs」最底部即可（Apps Script 以檔案中最後一個同名函式為準，不必改原本那一個）。
// 與 v1.19 的差別：secHandler_ 之後依序加 opsHandler_、payHandler_、lineHandler_。
// ═══════════════════════════════════════════════
function extHandler_(action, p) {
  p = p || {};
  var sec = secHandler_(action, p); if (sec) return sec;
  var op = opsHandler_(action, p); if (op) return op;
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

// ═══════════════════════════════════════════════
// 麵糊用量模組 v1.23（2026-11-12）— 貼在「營運管理」「薪資引擎v3」「LINE推播」之後、「路由v1.23」之前
// 1. 開店／收店盤點加「黑糖」口味（新欄附加在表尾，不動舊欄）
// 2. 修正收店盤點寫入位置：舊版從「當日營業額」起整列往左偏一格（P 寫成營業額…），改回和標題一致；
//    bu_fixClosePreview() 預覽、bu_fixCloseApply() 修正舊資料
// 3. 各櫃位平日／假日「暫定用量」（原味、其他口味）；Lv.2 以上在 App 填改（Lv.2 只能改自己負責的櫃位）
// 4. 實際平均：自〈參數設定〉「麵糊平均起始日」（預設 2026-12-01）起，依開店＋進貨－收店算每日用量，平日／假日分開平均
// 5. 活動櫃位：按日期提前填預估用量
// 6. 還夠幾天＋建議叫貨量（管理儀表板「各店剩餘麵糊」、麵糊用量頁、物料需求頁提醒）
// 覆蓋：saveOpenStore、saveCloseStore、checkFirstOpener、bt_get_（getBatterStock）、ops_revenueByDay_、gm_closeRows_
// ═══════════════════════════════════════════════

var BU_FL = ['原味', '可可', '紅玉', '抹茶', '黑糖'];
var BU_PLAN_HEAD = ['櫃位編號', '櫃位名稱', '平日原味(包)', '平日其他口味(包)', '假日原味(包)', '假日其他口味(包)', '更新者', '更新時間'];
var BU_EVT_HEAD = ['日期', '櫃位編號', '櫃位名稱', '活動名稱', '原味(包)', '其他口味(包)', '填寫者', '填寫時間'];
// 收店盤點（和標題一致，0 起算）：F 櫃位5、G~J 剩餘6~9、K 剩餘總計10、L~O 消耗11~14、P 總消耗15、Q 當日營業額16、R 零用金17、
// S 照片18、T 交班備注19、U 填寫時間20、V 備注21、W~Z 進貨22~25、AA 每包產值26、AD JSON 29、AE 營業額合計30、AF 黑糖剩餘31、AG 黑糖進貨32
var BU_C = { rem: [6, 7, 8, 9, 31], rs: [22, 23, 24, 25, 32], egg: 16, total: 30 };
var BU_C_OLD = { rem: [6, 7, 8, 9, -1], rs: [21, 22, 23, 24, -1], egg: 15, total: 32 };   // 舊版偏移列
// 開店盤點：G~J 起始6~9、K 總計10、O 黑糖起始14
var BU_O = [6, 7, 8, 9, 14];
var BU_C_ = {};

function bu_n_(v) { var n = parseFloat(String(v == null ? '' : v).replace(/[^\d.\-]/g, '')); return isFinite(n) ? n : 0; }
function bu_blank_(v) { return v === '' || v === null || v === undefined; }
function bu_r2_(x) { return Math.round(x * 100) / 100; }
function bu_isOld_(r) { return String(r[31] == null ? '' : r[31]).charAt(0) === '{'; }   // 舊版：JSON 落在 AF
function bu_addDays_(d, k) { var t = new Date(d + 'T12:00:00+08:00'); t.setDate(t.getDate() + k); return Utilities.formatDate(t, 'Asia/Taipei', 'yyyy-MM-dd'); }

// ── 1. 寫入（覆蓋舊版）──
function saveOpenStore(ss, data) {
  var sheet = ss.getSheetByName('開店盤點');
  var id = 'O' + Date.now(), n = function (v) { return parseFloat(v) || 0; };
  var f = [n(data.original), n(data.cocoa), n(data.ruby), n(data.matcha), n(data.brown)];
  var total = bu_r2_(f.reduce(function (a, b) { return a + b; }, 0));
  sheet.appendRow([id, String(data.date || ''), String(data.scheduleId || ''), String(data.empId || ''), String(data.name || ''), String(data.location || ''),
    f[0], f[1], f[2], f[3], total, String(data.note || ''), new Date().toISOString(), '', f[4]]);
  return { success: true, id: id };
}
function saveCloseStore(ss, data) {
  var sheet = ss.getSheetByName('收店盤點');
  var id = 'C' + Date.now(), n = function (v) { return parseFloat(v) || 0; };
  var rem = [n(data.remOriginal), n(data.remCocoa), n(data.remRuby), n(data.remMatcha), n(data.remBrown)];
  var remT = bu_r2_(rem.reduce(function (a, b) { return a + b; }, 0));
  var itemRev = {};
  try { itemRev = data.itemRevenue ? JSON.parse(data.itemRevenue) : {}; } catch (e) {}
  var eggRevenue = n(itemRev['雞蛋糕'] !== undefined ? itemRev['雞蛋糕'] : data.revenue);
  var vals = Object.keys(itemRev).map(function (k) { return itemRev[k]; });
  var totalRevenue = vals.length ? vals.reduce(function (a, b) { return a + (parseFloat(b) || 0); }, 0) : n(data.revenue);
  sheet.appendRow([
    id, String(data.date || ''), String(data.scheduleId || ''), String(data.empId || ''), String(data.name || ''), String(data.location || ''),
    rem[0], rem[1], rem[2], rem[3], remT,
    '', '', '', '', '',                                           // L~O 各口味消耗、P 總消耗（由程式計算）
    eggRevenue, n(data.cash), String(data.photoUrl || ''), String(data.handoverNote || ''), new Date().toISOString(), '',
    n(data.rsOriginal), n(data.rsCocoa), n(data.rsRuby), n(data.rsMatcha),
    '', '', '',                                                    // AA 每包產值、AB、AC
    JSON.stringify(itemRev), totalRevenue,
    rem[4], n(data.rsBrown)
  ]);
  return { success: true, id: id };
}

// 覆蓋 checkFirstOpener：多回黑糖
function checkFirstOpener(ss, params) {
  var date = String(params.date || ''), loc = String(params.location || '');
  var open = ss.getSheetByName('開店盤點').getDataRange().getValues();
  for (var i = 1; i < open.length; i++) {
    if (dateNorm(open[i][1]) === date && String(open[i][5]) === loc)
      return { success: true, isFirst: false, openedBy: String(open[i][4]), original: open[i][6], cocoa: open[i][7], ruby: open[i][8], matcha: open[i][9], brown: open[i][14] === undefined ? '' : open[i][14] };
  }
  return { success: true, isFirst: true };
}

// ── 2. 修正舊資料（偏移一格的列）──
function bu_fixRows_(apply) {
  var ss = SpreadsheetApp.openById(SHEET_ID), log = [];
  ['收店盤點', '收店盤點_歷史'].forEach(function (name) {
    var sh = ss.getSheetByName(name); if (!sh || sh.getLastRow() < 2) return;
    var w = Math.min(sh.getMaxColumns(), Math.max(sh.getLastColumn(), 33)), v = sh.getRange(2, 1, sh.getLastRow() - 1, w).getValues();
    v.forEach(function (r, i) {
      if (!bu_isOld_(r)) return;
      var nr = r.slice(0, 15).concat([''], r.slice(15, 25), ['', '', ''], [r[31], r[32]], ['', '']);
      while (nr.length < w) nr.push('');
      log.push(name + ' 第 ' + (i + 2) + ' 列 ' + bu_dstr_(r[1]) + ' ' + r[5] + '：營業額 ' + r[15] + '、零用金 ' + r[16] + '、原味進貨 ' + r[21] + ' → 移到正確欄位');
      if (apply) sh.getRange(i + 2, 1, 1, w).setValues([nr.slice(0, w)]);
    });
  });
  return log;
}
function bu_fixClosePreview() { var l = bu_fixRows_(false); Logger.log(l.length ? l.join('\n') : '沒有需要修正的列'); return l; }
function bu_fixCloseApply() { var l = bu_fixRows_(true); Logger.log('已修正 ' + l.length + ' 列\n' + l.join('\n')); return l; }

// ── 部署後執行一次 ──
function bu_setup() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  ['開店盤點', '開店盤點_歷史'].forEach(function (n) { var sh = ss.getSheetByName(n); if (sh && !String(sh.getRange(1, 15).getValue()).trim()) sh.getRange(1, 15).setValue('黑糖起始(包)'); });
  ['收店盤點', '收店盤點_歷史'].forEach(function (n) {
    var sh = ss.getSheetByName(n); if (!sh) return;
    if (!String(sh.getRange(1, 32).getValue()).trim()) sh.getRange(1, 32).setValue('黑糖剩餘(包)');
    if (!String(sh.getRange(1, 33).getValue()).trim()) sh.getRange(1, 33).setValue('黑糖進貨(包)');
  });
  ops_sheet_('麵糊用量設定', BU_PLAN_HEAD); ops_sheet_('活動麵糊預估', BU_EVT_HEAD);
  var ps = ss.getSheetByName('參數設定'), have = {};
  ps.getDataRange().getValues().forEach(function (r) { have[String(r[0]).trim()] = 1; });
  [['麵糊平均起始日', '2026-12-01', '實際平均用量從這天起算'], ['麵糊建議備量天數', 3, '建議叫貨量＝未來幾天的用量－目前剩餘'],
   ['麵糊提醒天數', 2, '還夠天數少於這個數字標紅']].forEach(function (x) { if (!have[x[0]]) ps.appendRow(x); });
  Logger.log('bu_setup 完成；接著執行 bu_fixClosePreview() 看要修正的舊資料，確認後執行 bu_fixCloseApply()');
}

// ── 讀盤點 ──
function bu_dstr_(v) { return typeof ops_d_ === 'function' ? ops_d_(v) : String(v).slice(0, 10); }
function bu_read_(name, fn) {
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(name); if (!sh || sh.getLastRow() < 2) return;
  sh.getRange(2, 1, sh.getLastRow() - 1, Math.min(sh.getMaxColumns(), Math.max(sh.getLastColumn(), 33))).getValues().forEach(fn);
}
function bu_closes_() {                 // → { code: [{date, loc, by, rem[5], rs[5], rev, egg, any}] }（同櫃同日取最後一筆）
  if (BU_C_.closes) return BU_C_.closes;
  var by = {};
  ['收店盤點_歷史', '收店盤點'].forEach(function (n) {
    bu_read_(n, function (r) {
      var loc = String(r[5] || '').trim(), d = bu_dstr_(r[1]); if (!loc || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
      var L = bu_isOld_(r) ? BU_C_OLD : BU_C, any = false;
      var rem = L.rem.map(function (c) { if (c < 0 || bu_blank_(r[c])) return 0; any = true; return bu_n_(r[c]); });
      var rs = L.rs.map(function (c) { return c < 0 ? 0 : bu_n_(r[c]); });
      var tot = bu_blank_(r[L.total]) ? bu_n_(r[L.egg]) : bu_n_(r[L.total]);
      var code = loc_code_(loc) || loc;
      (by[code] = by[code] || {})[d] = { date: d, loc: loc, by: String(r[4] || ''), rem: rem, rs: rs, rev: tot, egg: bu_n_(r[L.egg]), any: any };
    });
  });
  var out = {};
  Object.keys(by).forEach(function (c) { out[c] = Object.keys(by[c]).sort().map(function (d) { return by[c][d]; }); });
  return (BU_C_.closes = out);
}
function bu_opens_() {                  // → { code: { date: f[5] } }
  if (BU_C_.opens) return BU_C_.opens;
  var out = {};
  ['開店盤點_歷史', '開店盤點'].forEach(function (n) {
    bu_read_(n, function (r) {
      var loc = String(r[5] || '').trim(), d = bu_dstr_(r[1]); if (!loc || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
      var code = loc_code_(loc) || loc;
      (out[code] = out[code] || {})[d] = BU_O.map(function (c) { return bu_n_(r[c]); });
    });
  });
  return (BU_C_.opens = out);
}
// 每日用量：開店起始（沒有就用前一次收店剩餘，7 天內）＋當日進貨－收店剩餘
function bu_daily_(code) {
  var cl = bu_closes_()[code] || [], op = bu_opens_()[code] || {}, out = {};
  cl.forEach(function (c, i) {
    if (!c.any) return;
    var start = op[c.date], prev = i > 0 ? cl[i - 1] : null;
    if (!start && prev && prev.any && prev.date >= bu_addDays_(c.date, -7)) start = prev.rem;
    if (!start) return;
    var u = BU_FL.map(function (f, k) { return Math.max(0, bu_r2_(start[k] + c.rs[k] - c.rem[k])); });
    out[c.date] = { use: u, orig: u[0], other: bu_r2_(u[1] + u[2] + u[3] + u[4]) };
  });
  return out;
}

// ── 設定與預估 ──
function bu_plans_() {
  if (BU_C_.plans) return BU_C_.plans;
  var sh = ops_sheet_('麵糊用量設定', BU_PLAN_HEAD), out = {};
  ops_rows_(sh, 8).forEach(function (r, i) {
    var c = String(r[0]).replace(/^'/, '').trim(); if (/^\d$/.test(c)) c = '0' + c; if (!c) return;
    out[c] = { row: i + 2, wdO: bu_blank_(r[2]) ? null : bu_n_(r[2]), wdX: bu_blank_(r[3]) ? null : bu_n_(r[3]),
      heO: bu_blank_(r[4]) ? null : bu_n_(r[4]), heX: bu_blank_(r[5]) ? null : bu_n_(r[5]), by: String(r[6] || ''), at: String(r[7] || '') };
  });
  return (BU_C_.plans = out);
}
function bu_events_() {
  if (BU_C_.evts) return BU_C_.evts;
  var sh = ops_sheet_('活動麵糊預估', BU_EVT_HEAD), out = {};
  ops_rows_(sh, 8).forEach(function (r, i) {
    var d = bu_dstr_(r[0]), c = String(r[1]).replace(/^'/, '').trim(); if (/^\d$/.test(c)) c = '0' + c; if (!d || !c) return;
    (out[c] = out[c] || []).push({ row: i + 2, date: d, name: String(r[3] || ''), orig: bu_n_(r[4]), other: bu_n_(r[5]), by: String(r[6] || '') });
  });
  Object.keys(out).forEach(function (c) { out[c].sort(function (a, b) { return a.date < b.date ? -1 : 1; }); });
  return (BU_C_.evts = out);
}
function bu_cal_() { return BU_C_.cal || (BU_C_.cal = (typeof sch_calendar_ === 'function' ? sch_calendar_('') : {})); }
function bu_isHol_(d) {
  var cal = bu_cal_();
  if (typeof sch_isHoliday_ === 'function') return sch_isHoliday_(d, cal);
  var w = new Date(d + 'T12:00:00+08:00').getDay(); return w === 0 || w === 6;
}
function bu_avg_(code) {
  var start = bu_dstr_(ops_param_('麵糊平均起始日', '2026-12-01')), today = ops_today_(), daily = bu_daily_(code);
  var s = { wd: { o: 0, x: 0, n: 0 }, he: { o: 0, x: 0, n: 0 } };
  Object.keys(daily).forEach(function (d) {
    if (d < start || d >= today) return;
    var k = bu_isHol_(d) ? 'he' : 'wd'; s[k].o += daily[d].orig; s[k].x += daily[d].other; s[k].n++;
  });
  var f = function (a) { return a.n ? { o: bu_r2_(a.o / a.n), x: bu_r2_(a.x / a.n), n: a.n } : { o: null, x: null, n: 0 }; };
  return { from: start, wd: f(s.wd), he: f(s.he) };
}
function bu_isEventLoc_(l) { return /活動/.test(l.kind || ''); }
// 某天的預估用量 { o, x }；null＝沒設定
function bu_need_(l, plan, avg, evByDate, d) {
  if (bu_isEventLoc_(l)) { var e = evByDate[d]; return e ? { o: e.orig, x: e.other } : { o: 0, x: 0 }; }
  var h = bu_isHol_(d), po = plan ? (h ? plan.heO : plan.wdO) : null, px = plan ? (h ? plan.heX : plan.wdX) : null;
  var a = avg ? (h ? avg.he : avg.wd) : null;
  if (po === null && a && a.n >= 4) po = a.o;
  if (px === null && a && a.n >= 4) px = a.x;
  if (po === null && px === null) return null;
  return { o: po || 0, x: px || 0 };
}
function bu_forecast_(l) {
  var code = l.code, plan = bu_plans_()[code] || null, avg = bu_avg_(code), evs = bu_events_()[code] || [], evBy = {};
  evs.forEach(function (e) { evBy[e.date] = e; });
  var cl = (bu_closes_()[code] || []).filter(function (c) { return c.any; }), last = cl.length ? cl[cl.length - 1] : null;
  var today = ops_today_(), cover = parseInt(ops_param_('麵糊建議備量天數', 3)) || 3, warn = parseFloat(ops_param_('麵糊提醒天數', 2)) || 2;
  var res = { plan: plan, avg: avg, stock: null, orig: null, other: null, low: false, setup: true };
  if (last) res.stock = { date: last.date, by: last.by, rem: BU_FL.reduce(function (o, f, k) { o[f] = last.rem[k]; return o; }, {}),
    orig: last.rem[0], other: bu_r2_(last.rem[1] + last.rem[2] + last.rem[3] + last.rem[4]) };
  if (!bu_need_(l, plan, avg, evBy, today) && !bu_isEventLoc_(l)) { res.setup = false; return res; }
  if (!last) { if (!bu_isEventLoc_(l)) return res; last = { date: bu_addDays_(today, -1), rem: [0, 0, 0, 0, 0] }; res.stock = { date: '', by: '', rem: {}, orig: 0, other: 0 }; }
  ['orig', 'other'].forEach(function (k) {
    var s = k === 'orig' ? res.stock.orig : res.stock.other, kk = k === 'orig' ? 'o' : 'x', d = bu_addDays_(last.date, 1);
    while (d < today) { var nd = bu_need_(l, plan, avg, evBy, d); s -= nd ? nd[kk] : 0; d = bu_addDays_(d, 1); }   // 盤點日到今天之間的估計用量
    s = Math.max(0, bu_r2_(s));
    var days = 0, rest = s, any = false;
    for (var i = 0; i < 60; i++) {
      var nd2 = bu_need_(l, plan, avg, evBy, bu_addDays_(today, i)), q = nd2 ? nd2[kk] : 0; if (q > 0) any = true;
      if (rest - q < 0) break; rest -= q; days++;
    }
    var need = 0, span = bu_isEventLoc_(l) ? 7 : cover;
    for (var j = 0; j < span; j++) { var n3 = bu_need_(l, plan, avg, evBy, bu_addDays_(today, j)); need += n3 ? n3[kk] : 0; }
    res[k] = { now: s, days: any ? (days >= 60 ? 60 : days) : null, suggest: Math.max(0, Math.ceil(bu_r2_(need - s))), span: span };
    if (any && days < warn) res.low = true;
  });
  return res;
}

// ── API ──
function bu_locsFor_(me) {
  var mine = ops_myLocs_(me);
  return ops_locs_().filter(function (l) { return mine.indexOf(l.name) >= 0 && ['已停用', '已結束'].indexOf(l.status) < 0 && !/合作/.test(l.kind); })
    .sort(function (a, b) { return a.code < b.code ? -1 : 1; });
}
function bu_list_(p) {
  var me = ops_need_(p, 2), today = ops_today_();
  var data = bu_locsFor_(me).map(function (l) {
    var f = bu_forecast_(l);
    return { code: l.code, name: l.name, kind: l.kind, status: l.status, event: bu_isEventLoc_(l), plan: f.plan ? { wdO: f.plan.wdO, wdX: f.plan.wdX, heO: f.plan.heO, heX: f.plan.heX, by: f.plan.by, at: f.plan.at } : null,
      avg: f.avg, stock: f.stock, orig: f.orig, other: f.other, low: f.low, setup: f.setup,
      events: bu_isEventLoc_(l) ? (bu_events_()[l.code] || []).filter(function (e) { return e.date >= bu_addDays_(today, -7); }).map(function (e) { return { date: e.date, name: e.name, orig: e.orig, other: e.other, by: e.by }; }) : [] };
  });
  return { success: true, data: data, today: today, todayHoliday: bu_isHol_(today), params: { from: bu_dstr_(ops_param_('麵糊平均起始日', '2026-12-01')), cover: parseInt(ops_param_('麵糊建議備量天數', 3)) || 3, warn: parseFloat(ops_param_('麵糊提醒天數', 2)) || 2 } };
}
function bu_checkLoc_(me, code) {
  var l = bu_locsFor_(me).filter(function (x) { return x.code === String(code || '').trim(); })[0];
  if (!l) throw new Error('沒有這個櫃位的權限');
  return l;
}
function bu_save_(p) {
  var me = ops_need_(p, 2), l = bu_checkLoc_(me, p.code);
  var v = function (x) { return x === '' || x === null || x === undefined ? '' : Math.max(0, bu_n_(x)); };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = ops_sheet_('麵糊用量設定', BU_PLAN_HEAD); BU_C_.plans = null;
    var ex = bu_plans_()[l.code], row = ["'" + l.code, l.name, v(p.wdO), v(p.wdX), v(p.heO), v(p.heX), me.name, ops_now_()];
    if (ex) sh.getRange(ex.row, 1, 1, 8).setValues([row]); else sh.appendRow(row);
    BU_C_.plans = null;
    return { success: true };
  } finally { lock.releaseLock(); }
}
function bu_applyAvg_(p) {
  var me = ops_need_(p, 2), l = bu_checkLoc_(me, p.code), a = bu_avg_(l.code), pl = bu_plans_()[l.code] || {};
  var which = String(p.which || 'all');
  var q = { code: l.code, empId: p.empId, wdO: pl.wdO, wdX: pl.wdX, heO: pl.heO, heX: pl.heX };
  if ((which === 'all' || which === 'wd') && a.wd.n) { q.wdO = a.wd.o; q.wdX = a.wd.x; }
  if ((which === 'all' || which === 'he') && a.he.n) { q.heO = a.he.o; q.heX = a.he.x; }
  if (!a.wd.n && !a.he.n) return { error: '還沒有實際用量資料（' + a.from + ' 起算）' };
  return bu_save_(q);
}
function bu_evtSave_(p) {
  var me = ops_need_(p, 2), l = bu_checkLoc_(me, p.code), d = bu_dstr_(p.date);
  if (!bu_isEventLoc_(l)) return { error: '只有活動櫃位要按日期填' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return { error: '請選日期' };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = ops_sheet_('活動麵糊預估', BU_EVT_HEAD); BU_C_.evts = null;
    var ex = (bu_events_()[l.code] || []).filter(function (e) { return e.date === d; })[0];
    var row = [d, "'" + l.code, l.name, String(p.name || '').slice(0, 40), Math.max(0, bu_n_(p.orig)), Math.max(0, bu_n_(p.other)), me.name, ops_now_()];
    if (ex) sh.getRange(ex.row, 1, 1, 8).setValues([row]); else sh.appendRow(row);
    BU_C_.evts = null;
    return { success: true };
  } finally { lock.releaseLock(); }
}
function bu_evtDel_(p) {
  var me = ops_need_(p, 2), l = bu_checkLoc_(me, p.code), d = bu_dstr_(p.date);
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    BU_C_.evts = null;
    var ex = (bu_events_()[l.code] || []).filter(function (e) { return e.date === d; })[0];
    if (!ex) return { error: '找不到這一天的預估' };
    ops_sheet_('活動麵糊預估', BU_EVT_HEAD).deleteRow(ex.row); BU_C_.evts = null;
    return { success: true };
  } finally { lock.releaseLock(); }
}
function buHandler_(action, p) {
  if (!/^bu[A-Z]/.test(String(action || ''))) return null;
  p = p || {}; BU_C_ = {}; if (typeof OPS_C_ !== 'undefined') OPS_C_ = {};
  try {
    switch (action) {
      case 'buList':     return bu_list_(p);
      case 'buSave':     return bu_save_(p);
      case 'buApplyAvg': return bu_applyAvg_(p);
      case 'buEvtSave':  return bu_evtSave_(p);
      case 'buEvtDel':   return bu_evtDel_(p);
    }
  } catch (e) { return { error: e.message }; }
  return null;
}

// ── 覆蓋：各店剩餘麵糊（管理儀表板、宇宙辦公室）──多回黑糖與預估 ──
function bt_get_(p) {
  BU_C_ = {}; if (typeof OPS_C_ !== 'undefined') OPS_C_ = {};
  var locs = ops_locs_(), out = [];
  var cl = bu_closes_();
  Object.keys(cl).forEach(function (code) {
    var rows = cl[code].filter(function (c) { return c.any; }); if (!rows.length) return;
    var last = rows[rows.length - 1], l = locs.filter(function (x) { return x.code === code; })[0];
    var rec = { loc: l ? l.name : last.loc, code: code, date: last.date, by: last.by, rem: {}, restock: {} };
    BU_FL.forEach(function (f, k) { rec.rem[f] = last.rem[k]; rec.restock[f] = last.rs[k]; });
    if (l) { var fc = bu_forecast_(l); rec.fc = { orig: fc.orig, other: fc.other, low: fc.low, setup: fc.setup }; }
    out.push(rec);
  });
  out.sort(function (a, b) { return (a.code || a.loc) < (b.code || b.loc) ? -1 : 1; });
  return { success: true, data: out };
}

// ── 覆蓋：加盟損益的每日營業額與麵糊用量（改依正確欄位＋實際用量）──
function ops_revenueByDay_(loc, ym) {
  BU_C_ = {};
  var code = loc_code_(loc) || loc, out = {}, daily = bu_daily_(code);
  (bu_closes_()[code] || []).forEach(function (c) {
    if (c.date.slice(0, 7) !== ym) return;
    out[c.date] = { rev: c.rev, batter: daily[c.date] ? bu_r2_(daily[c.date].orig + daily[c.date].other) : 0 };
  });
  return out;
}
// ── 覆蓋：赤心幣讀營業額（AE 營業額合計，空白時 Q 當日營業額）──
function gm_closeRows_() {
  if (GM_CACHE_.close) return GM_CACHE_.close;
  var out = [];
  ['收店盤點', '收店盤點_歷史'].forEach(function (n) {
    var sh = gm_ss_().getSheetByName(n); if (!sh || sh.getLastRow() < 2) return;
    sh.getRange(2, 1, sh.getLastRow() - 1, Math.min(sh.getMaxColumns(), 40)).getValues().forEach(function (r) {
      var L = bu_isOld_(r) ? BU_C_OLD : BU_C;
      var rev = bu_blank_(r[L.total]) || String(r[L.total]).trim() === '' ? gm_num_(r[L.egg]) : gm_num_(r[L.total]);
      out.push({ date: gm_dstr_(r[1]), emp: String(r[3]).trim(), loc: String(r[5]).trim(), rev: rev });
    });
  });
  return (GM_CACHE_.close = out);
}

// ═══════════════════════════════════════════════
// 路由 extHandler_ v1.23（2026-11-12）
// 整段貼在「程式碼.gs」最底部即可（Apps Script 以檔案中最後一個同名函式為準，不必改原本那一個）。
// 與 v1.20 路由的差別：opsHandler_ 之後加 buHandler_（麵糊用量）。其餘不變。
// ═══════════════════════════════════════════════
function extHandler_(action, p) {
  p = p || {};
  var sec = secHandler_(action, p); if (sec) return sec;
  var op = opsHandler_(action, p); if (op) return op;
  var bu = buHandler_(action, p); if (bu) return bu;
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

// ═══════════════════════════════════════════════
// 麵糊用量模組 v1.24（2026-11-12）— 第 2 版：加芝麻口味。整段貼在最底部即可（覆蓋 v1.23 第 1 版），再貼「叫貨報修」與「路由v1.24」
// 1. 開店／收店盤點加「黑糖」「芝麻」口味（新欄附加在表尾，不動舊欄）
// 2. 修正收店盤點寫入位置：舊版從「當日營業額」起整列往左偏一格（P 寫成營業額…），改回和標題一致；
//    bu_fixClosePreview() 預覽、bu_fixCloseApply() 修正舊資料
// 3. 各櫃位平日／假日「暫定用量」（原味、其他口味）；Lv.2 以上在 App 填改（Lv.2 只能改自己負責的櫃位）
// 4. 實際平均：自〈參數設定〉「麵糊平均起始日」（預設 2026-12-01）起，依開店＋進貨－收店算每日用量，平日／假日分開平均
// 5. 活動櫃位：按日期提前填預估用量
// 6. 還夠幾天＋建議叫貨量（管理儀表板「各店剩餘麵糊」、麵糊用量頁、物料需求頁提醒）
// 覆蓋：saveOpenStore、saveCloseStore、checkFirstOpener、bt_get_（getBatterStock）、ops_revenueByDay_、gm_closeRows_
// ═══════════════════════════════════════════════

var BU_FL = ['原味', '可可', '紅玉', '抹茶', '黑糖', '芝麻'];
var BU_PLAN_HEAD = ['櫃位編號', '櫃位名稱', '平日原味(包)', '平日其他口味(包)', '假日原味(包)', '假日其他口味(包)', '更新者', '更新時間'];
var BU_EVT_HEAD = ['日期', '櫃位編號', '櫃位名稱', '活動名稱', '原味(包)', '其他口味(包)', '填寫者', '填寫時間'];
// 收店盤點（和標題一致，0 起算）：F 櫃位5、G~J 剩餘6~9、K 剩餘總計10、L~O 消耗11~14、P 總消耗15、Q 當日營業額16、R 零用金17、
// S 照片18、T 交班備注19、U 填寫時間20、V 備注21、W~Z 進貨22~25、AA 每包產值26、AD JSON 29、AE 營業額合計30、AF 黑糖剩餘31、AG 黑糖進貨32、AH 芝麻剩餘33、AI 芝麻進貨34
var BU_C = { rem: [6, 7, 8, 9, 31, 33], rs: [22, 23, 24, 25, 32, 34], egg: 16, total: 30 };
var BU_C_OLD = { rem: [6, 7, 8, 9, -1, -1], rs: [21, 22, 23, 24, -1, -1], egg: 15, total: 32 };   // 舊版偏移列
// 開店盤點：G~J 起始6~9、K 總計10、O 黑糖起始14、P 芝麻起始15
var BU_O = [6, 7, 8, 9, 14, 15];
var BU_C_ = {};

function bu_n_(v) { var n = parseFloat(String(v == null ? '' : v).replace(/[^\d.\-]/g, '')); return isFinite(n) ? n : 0; }
function bu_blank_(v) { return v === '' || v === null || v === undefined; }
function bu_r2_(x) { return Math.round(x * 100) / 100; }
function bu_isOld_(r) { return String(r[31] == null ? '' : r[31]).charAt(0) === '{'; }   // 舊版：JSON 落在 AF
function bu_addDays_(d, k) { var t = new Date(d + 'T12:00:00+08:00'); t.setDate(t.getDate() + k); return Utilities.formatDate(t, 'Asia/Taipei', 'yyyy-MM-dd'); }

// ── 1. 寫入（覆蓋舊版）──
function saveOpenStore(ss, data) {
  var sheet = ss.getSheetByName('開店盤點');
  var id = 'O' + Date.now(), n = function (v) { return parseFloat(v) || 0; };
  var f = [n(data.original), n(data.cocoa), n(data.ruby), n(data.matcha), n(data.brown), n(data.sesame)];
  var total = bu_r2_(f.reduce(function (a, b) { return a + b; }, 0));
  sheet.appendRow([id, String(data.date || ''), String(data.scheduleId || ''), String(data.empId || ''), String(data.name || ''), String(data.location || ''),
    f[0], f[1], f[2], f[3], total, String(data.note || ''), new Date().toISOString(), '', f[4], f[5]]);
  return { success: true, id: id };
}
function saveCloseStore(ss, data) {
  var sheet = ss.getSheetByName('收店盤點');
  var id = 'C' + Date.now(), n = function (v) { return parseFloat(v) || 0; };
  var rem = [n(data.remOriginal), n(data.remCocoa), n(data.remRuby), n(data.remMatcha), n(data.remBrown), n(data.remSesame)];
  var remT = bu_r2_(rem.reduce(function (a, b) { return a + b; }, 0));
  var itemRev = {};
  try { itemRev = data.itemRevenue ? JSON.parse(data.itemRevenue) : {}; } catch (e) {}
  var eggRevenue = n(itemRev['雞蛋糕'] !== undefined ? itemRev['雞蛋糕'] : data.revenue);
  var vals = Object.keys(itemRev).map(function (k) { return itemRev[k]; });
  var totalRevenue = vals.length ? vals.reduce(function (a, b) { return a + (parseFloat(b) || 0); }, 0) : n(data.revenue);
  sheet.appendRow([
    id, String(data.date || ''), String(data.scheduleId || ''), String(data.empId || ''), String(data.name || ''), String(data.location || ''),
    rem[0], rem[1], rem[2], rem[3], remT,
    '', '', '', '', '',                                           // L~O 各口味消耗、P 總消耗（由程式計算）
    eggRevenue, n(data.cash), String(data.photoUrl || ''), String(data.handoverNote || ''), new Date().toISOString(), '',
    n(data.rsOriginal), n(data.rsCocoa), n(data.rsRuby), n(data.rsMatcha),
    '', '', '',                                                    // AA 每包產值、AB、AC
    JSON.stringify(itemRev), totalRevenue,
    rem[4], n(data.rsBrown), rem[5], n(data.rsSesame)
  ]);
  return { success: true, id: id };
}

// 覆蓋 checkFirstOpener：多回黑糖
function checkFirstOpener(ss, params) {
  var date = String(params.date || ''), loc = String(params.location || '');
  var open = ss.getSheetByName('開店盤點').getDataRange().getValues();
  for (var i = 1; i < open.length; i++) {
    if (dateNorm(open[i][1]) === date && String(open[i][5]) === loc)
      return { success: true, isFirst: false, openedBy: String(open[i][4]), original: open[i][6], cocoa: open[i][7], ruby: open[i][8], matcha: open[i][9], brown: open[i][14] === undefined ? '' : open[i][14], sesame: open[i][15] === undefined ? '' : open[i][15] };
  }
  return { success: true, isFirst: true };
}

// ── 2. 修正舊資料（偏移一格的列）──
function bu_fixRows_(apply) {
  var ss = SpreadsheetApp.openById(SHEET_ID), log = [];
  ['收店盤點', '收店盤點_歷史'].forEach(function (name) {
    var sh = ss.getSheetByName(name); if (!sh || sh.getLastRow() < 2) return;
    var w = Math.min(sh.getMaxColumns(), Math.max(sh.getLastColumn(), 35)), v = sh.getRange(2, 1, sh.getLastRow() - 1, w).getValues();
    v.forEach(function (r, i) {
      if (!bu_isOld_(r)) return;
      var nr = r.slice(0, 15).concat([''], r.slice(15, 25), ['', '', ''], [r[31], r[32]], ['', '', '', '']);
      while (nr.length < w) nr.push('');
      log.push(name + ' 第 ' + (i + 2) + ' 列 ' + bu_dstr_(r[1]) + ' ' + r[5] + '：營業額 ' + r[15] + '、零用金 ' + r[16] + '、原味進貨 ' + r[21] + ' → 移到正確欄位');
      if (apply) sh.getRange(i + 2, 1, 1, w).setValues([nr.slice(0, w)]);
    });
  });
  return log;
}
function bu_fixClosePreview() { var l = bu_fixRows_(false); Logger.log(l.length ? l.join('\n') : '沒有需要修正的列'); return l; }
function bu_fixCloseApply() { var l = bu_fixRows_(true); Logger.log('已修正 ' + l.length + ' 列\n' + l.join('\n')); return l; }

// ── 部署後執行一次 ──
function bu_setup() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  ['開店盤點', '開店盤點_歷史'].forEach(function (n) { var sh = ss.getSheetByName(n); if (!sh) return; if (!String(sh.getRange(1, 15).getValue()).trim()) sh.getRange(1, 15).setValue('黑糖起始(包)'); if (!String(sh.getRange(1, 16).getValue()).trim()) sh.getRange(1, 16).setValue('芝麻起始(包)'); });
  ['收店盤點', '收店盤點_歷史'].forEach(function (n) {
    var sh = ss.getSheetByName(n); if (!sh) return;
    if (!String(sh.getRange(1, 32).getValue()).trim()) sh.getRange(1, 32).setValue('黑糖剩餘(包)');
    if (!String(sh.getRange(1, 33).getValue()).trim()) sh.getRange(1, 33).setValue('黑糖進貨(包)');
    if (!String(sh.getRange(1, 34).getValue()).trim()) sh.getRange(1, 34).setValue('芝麻剩餘(包)');
    if (!String(sh.getRange(1, 35).getValue()).trim()) sh.getRange(1, 35).setValue('芝麻進貨(包)');
  });
  ops_sheet_('麵糊用量設定', BU_PLAN_HEAD); ops_sheet_('活動麵糊預估', BU_EVT_HEAD);
  var ps = ss.getSheetByName('參數設定'), have = {};
  ps.getDataRange().getValues().forEach(function (r) { have[String(r[0]).trim()] = 1; });
  [['麵糊平均起始日', '2026-12-01', '實際平均用量從這天起算'], ['麵糊建議備量天數', 3, '建議叫貨量＝未來幾天的用量－目前剩餘'],
   ['麵糊提醒天數', 2, '還夠天數少於這個數字標紅']].forEach(function (x) { if (!have[x[0]]) ps.appendRow(x); });
  Logger.log('bu_setup 完成；接著執行 bu_fixClosePreview() 看要修正的舊資料，確認後執行 bu_fixCloseApply()');
}

// ── 讀盤點 ──
function bu_dstr_(v) { return typeof ops_d_ === 'function' ? ops_d_(v) : String(v).slice(0, 10); }
function bu_read_(name, fn) {
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(name); if (!sh || sh.getLastRow() < 2) return;
  sh.getRange(2, 1, sh.getLastRow() - 1, Math.min(sh.getMaxColumns(), Math.max(sh.getLastColumn(), 35))).getValues().forEach(fn);
}
function bu_closes_() {                 // → { code: [{date, loc, by, rem[5], rs[5], rev, egg, any}] }（同櫃同日取最後一筆）
  if (BU_C_.closes) return BU_C_.closes;
  var by = {};
  ['收店盤點_歷史', '收店盤點'].forEach(function (n) {
    bu_read_(n, function (r) {
      var loc = String(r[5] || '').trim(), d = bu_dstr_(r[1]); if (!loc || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
      var L = bu_isOld_(r) ? BU_C_OLD : BU_C, any = false;
      var rem = L.rem.map(function (c) { if (c < 0 || bu_blank_(r[c])) return 0; any = true; return bu_n_(r[c]); });
      var rs = L.rs.map(function (c) { return c < 0 ? 0 : bu_n_(r[c]); });
      var tot = bu_blank_(r[L.total]) ? bu_n_(r[L.egg]) : bu_n_(r[L.total]);
      var code = loc_code_(loc) || loc;
      (by[code] = by[code] || {})[d] = { date: d, loc: loc, by: String(r[4] || ''), rem: rem, rs: rs, rev: tot, egg: bu_n_(r[L.egg]), any: any };
    });
  });
  var out = {};
  Object.keys(by).forEach(function (c) { out[c] = Object.keys(by[c]).sort().map(function (d) { return by[c][d]; }); });
  return (BU_C_.closes = out);
}
function bu_opens_() {                  // → { code: { date: f[5] } }
  if (BU_C_.opens) return BU_C_.opens;
  var out = {};
  ['開店盤點_歷史', '開店盤點'].forEach(function (n) {
    bu_read_(n, function (r) {
      var loc = String(r[5] || '').trim(), d = bu_dstr_(r[1]); if (!loc || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
      var code = loc_code_(loc) || loc;
      (out[code] = out[code] || {})[d] = BU_O.map(function (c) { return bu_n_(r[c]); });
    });
  });
  return (BU_C_.opens = out);
}
// 每日用量：開店起始（沒有就用前一次收店剩餘，7 天內）＋當日進貨－收店剩餘
function bu_daily_(code) {
  var cl = bu_closes_()[code] || [], op = bu_opens_()[code] || {}, out = {};
  cl.forEach(function (c, i) {
    if (!c.any) return;
    var start = op[c.date], prev = i > 0 ? cl[i - 1] : null;
    if (!start && prev && prev.any && prev.date >= bu_addDays_(c.date, -7)) start = prev.rem;
    if (!start) return;
    var u = BU_FL.map(function (f, k) { return Math.max(0, bu_r2_(start[k] + c.rs[k] - c.rem[k])); });
    out[c.date] = { use: u, orig: u[0], other: bu_r2_(u.slice(1).reduce(function (a, b) { return a + b; }, 0)) };
  });
  return out;
}

// ── 設定與預估 ──
function bu_plans_() {
  if (BU_C_.plans) return BU_C_.plans;
  var sh = ops_sheet_('麵糊用量設定', BU_PLAN_HEAD), out = {};
  ops_rows_(sh, 8).forEach(function (r, i) {
    var c = String(r[0]).replace(/^'/, '').trim(); if (/^\d$/.test(c)) c = '0' + c; if (!c) return;
    out[c] = { row: i + 2, wdO: bu_blank_(r[2]) ? null : bu_n_(r[2]), wdX: bu_blank_(r[3]) ? null : bu_n_(r[3]),
      heO: bu_blank_(r[4]) ? null : bu_n_(r[4]), heX: bu_blank_(r[5]) ? null : bu_n_(r[5]), by: String(r[6] || ''), at: String(r[7] || '') };
  });
  return (BU_C_.plans = out);
}
function bu_events_() {
  if (BU_C_.evts) return BU_C_.evts;
  var sh = ops_sheet_('活動麵糊預估', BU_EVT_HEAD), out = {};
  ops_rows_(sh, 8).forEach(function (r, i) {
    var d = bu_dstr_(r[0]), c = String(r[1]).replace(/^'/, '').trim(); if (/^\d$/.test(c)) c = '0' + c; if (!d || !c) return;
    (out[c] = out[c] || []).push({ row: i + 2, date: d, name: String(r[3] || ''), orig: bu_n_(r[4]), other: bu_n_(r[5]), by: String(r[6] || '') });
  });
  Object.keys(out).forEach(function (c) { out[c].sort(function (a, b) { return a.date < b.date ? -1 : 1; }); });
  return (BU_C_.evts = out);
}
function bu_cal_() { return BU_C_.cal || (BU_C_.cal = (typeof sch_calendar_ === 'function' ? sch_calendar_('') : {})); }
function bu_isHol_(d) {
  var cal = bu_cal_();
  if (typeof sch_isHoliday_ === 'function') return sch_isHoliday_(d, cal);
  var w = new Date(d + 'T12:00:00+08:00').getDay(); return w === 0 || w === 6;
}
function bu_avg_(code) {
  var start = bu_dstr_(ops_param_('麵糊平均起始日', '2026-12-01')), today = ops_today_(), daily = bu_daily_(code);
  var s = { wd: { o: 0, x: 0, n: 0 }, he: { o: 0, x: 0, n: 0 } };
  Object.keys(daily).forEach(function (d) {
    if (d < start || d >= today) return;
    var k = bu_isHol_(d) ? 'he' : 'wd'; s[k].o += daily[d].orig; s[k].x += daily[d].other; s[k].n++;
  });
  var f = function (a) { return a.n ? { o: bu_r2_(a.o / a.n), x: bu_r2_(a.x / a.n), n: a.n } : { o: null, x: null, n: 0 }; };
  return { from: start, wd: f(s.wd), he: f(s.he) };
}
function bu_isEventLoc_(l) { return /活動/.test(l.kind || ''); }
// 某天的預估用量 { o, x }；null＝沒設定
function bu_need_(l, plan, avg, evByDate, d) {
  if (bu_isEventLoc_(l)) { var e = evByDate[d]; return e ? { o: e.orig, x: e.other } : { o: 0, x: 0 }; }
  var h = bu_isHol_(d), po = plan ? (h ? plan.heO : plan.wdO) : null, px = plan ? (h ? plan.heX : plan.wdX) : null;
  var a = avg ? (h ? avg.he : avg.wd) : null;
  if (po === null && a && a.n >= 4) po = a.o;
  if (px === null && a && a.n >= 4) px = a.x;
  if (po === null && px === null) return null;
  return { o: po || 0, x: px || 0 };
}
function bu_forecast_(l) {
  var code = l.code, plan = bu_plans_()[code] || null, avg = bu_avg_(code), evs = bu_events_()[code] || [], evBy = {};
  evs.forEach(function (e) { evBy[e.date] = e; });
  var cl = (bu_closes_()[code] || []).filter(function (c) { return c.any; }), last = cl.length ? cl[cl.length - 1] : null;
  var today = ops_today_(), cover = parseInt(ops_param_('麵糊建議備量天數', 3)) || 3, warn = parseFloat(ops_param_('麵糊提醒天數', 2)) || 2;
  var res = { plan: plan, avg: avg, stock: null, orig: null, other: null, low: false, setup: true };
  if (last) res.stock = { date: last.date, by: last.by, rem: BU_FL.reduce(function (o, f, k) { o[f] = last.rem[k]; return o; }, {}),
    orig: last.rem[0], other: bu_r2_(last.rem.slice(1).reduce(function (a, b) { return a + b; }, 0)) };
  if (!bu_need_(l, plan, avg, evBy, today) && !bu_isEventLoc_(l)) { res.setup = false; return res; }
  if (!last) { if (!bu_isEventLoc_(l)) return res; last = { date: bu_addDays_(today, -1), rem: [0, 0, 0, 0, 0, 0] }; res.stock = { date: '', by: '', rem: {}, orig: 0, other: 0 }; }
  ['orig', 'other'].forEach(function (k) {
    var s = k === 'orig' ? res.stock.orig : res.stock.other, kk = k === 'orig' ? 'o' : 'x', d = bu_addDays_(last.date, 1);
    while (d < today) { var nd = bu_need_(l, plan, avg, evBy, d); s -= nd ? nd[kk] : 0; d = bu_addDays_(d, 1); }   // 盤點日到今天之間的估計用量
    s = Math.max(0, bu_r2_(s));
    var days = 0, rest = s, any = false;
    for (var i = 0; i < 60; i++) {
      var nd2 = bu_need_(l, plan, avg, evBy, bu_addDays_(today, i)), q = nd2 ? nd2[kk] : 0; if (q > 0) any = true;
      if (rest - q < 0) break; rest -= q; days++;
    }
    var need = 0, span = bu_isEventLoc_(l) ? 7 : cover;
    for (var j = 0; j < span; j++) { var n3 = bu_need_(l, plan, avg, evBy, bu_addDays_(today, j)); need += n3 ? n3[kk] : 0; }
    res[k] = { now: s, days: any ? (days >= 60 ? 60 : days) : null, suggest: Math.max(0, Math.ceil(bu_r2_(need - s))), span: span };
    if (any && days < warn) res.low = true;
  });
  return res;
}

// ── API ──
function bu_locsFor_(me) {
  var mine = ops_myLocs_(me);
  return ops_locs_().filter(function (l) { return mine.indexOf(l.name) >= 0 && ['已停用', '已結束'].indexOf(l.status) < 0 && !/合作/.test(l.kind); })
    .sort(function (a, b) { return a.code < b.code ? -1 : 1; });
}
function bu_list_(p) {
  var me = ops_need_(p, 2), today = ops_today_();
  var data = bu_locsFor_(me).map(function (l) {
    var f = bu_forecast_(l);
    return { code: l.code, name: l.name, kind: l.kind, status: l.status, event: bu_isEventLoc_(l), plan: f.plan ? { wdO: f.plan.wdO, wdX: f.plan.wdX, heO: f.plan.heO, heX: f.plan.heX, by: f.plan.by, at: f.plan.at } : null,
      avg: f.avg, stock: f.stock, orig: f.orig, other: f.other, low: f.low, setup: f.setup,
      events: bu_isEventLoc_(l) ? (bu_events_()[l.code] || []).filter(function (e) { return e.date >= bu_addDays_(today, -7); }).map(function (e) { return { date: e.date, name: e.name, orig: e.orig, other: e.other, by: e.by }; }) : [] };
  });
  return { success: true, data: data, today: today, todayHoliday: bu_isHol_(today), params: { from: bu_dstr_(ops_param_('麵糊平均起始日', '2026-12-01')), cover: parseInt(ops_param_('麵糊建議備量天數', 3)) || 3, warn: parseFloat(ops_param_('麵糊提醒天數', 2)) || 2 } };
}
function bu_checkLoc_(me, code) {
  var l = bu_locsFor_(me).filter(function (x) { return x.code === String(code || '').trim(); })[0];
  if (!l) throw new Error('沒有這個櫃位的權限');
  return l;
}
function bu_save_(p) {
  var me = ops_need_(p, 2), l = bu_checkLoc_(me, p.code);
  var v = function (x) { return x === '' || x === null || x === undefined ? '' : Math.max(0, bu_n_(x)); };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = ops_sheet_('麵糊用量設定', BU_PLAN_HEAD); BU_C_.plans = null;
    var ex = bu_plans_()[l.code], row = ["'" + l.code, l.name, v(p.wdO), v(p.wdX), v(p.heO), v(p.heX), me.name, ops_now_()];
    if (ex) sh.getRange(ex.row, 1, 1, 8).setValues([row]); else sh.appendRow(row);
    BU_C_.plans = null;
    return { success: true };
  } finally { lock.releaseLock(); }
}
function bu_applyAvg_(p) {
  var me = ops_need_(p, 2), l = bu_checkLoc_(me, p.code), a = bu_avg_(l.code), pl = bu_plans_()[l.code] || {};
  var which = String(p.which || 'all');
  var q = { code: l.code, empId: p.empId, wdO: pl.wdO, wdX: pl.wdX, heO: pl.heO, heX: pl.heX };
  if ((which === 'all' || which === 'wd') && a.wd.n) { q.wdO = a.wd.o; q.wdX = a.wd.x; }
  if ((which === 'all' || which === 'he') && a.he.n) { q.heO = a.he.o; q.heX = a.he.x; }
  if (!a.wd.n && !a.he.n) return { error: '還沒有實際用量資料（' + a.from + ' 起算）' };
  return bu_save_(q);
}
function bu_evtSave_(p) {
  var me = ops_need_(p, 2), l = bu_checkLoc_(me, p.code), d = bu_dstr_(p.date);
  if (!bu_isEventLoc_(l)) return { error: '只有活動櫃位要按日期填' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return { error: '請選日期' };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = ops_sheet_('活動麵糊預估', BU_EVT_HEAD); BU_C_.evts = null;
    var ex = (bu_events_()[l.code] || []).filter(function (e) { return e.date === d; })[0];
    var row = [d, "'" + l.code, l.name, String(p.name || '').slice(0, 40), Math.max(0, bu_n_(p.orig)), Math.max(0, bu_n_(p.other)), me.name, ops_now_()];
    if (ex) sh.getRange(ex.row, 1, 1, 8).setValues([row]); else sh.appendRow(row);
    BU_C_.evts = null;
    return { success: true };
  } finally { lock.releaseLock(); }
}
function bu_evtDel_(p) {
  var me = ops_need_(p, 2), l = bu_checkLoc_(me, p.code), d = bu_dstr_(p.date);
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    BU_C_.evts = null;
    var ex = (bu_events_()[l.code] || []).filter(function (e) { return e.date === d; })[0];
    if (!ex) return { error: '找不到這一天的預估' };
    ops_sheet_('活動麵糊預估', BU_EVT_HEAD).deleteRow(ex.row); BU_C_.evts = null;
    return { success: true };
  } finally { lock.releaseLock(); }
}
function buHandler_(action, p) {
  if (!/^bu[A-Z]/.test(String(action || ''))) return null;
  p = p || {}; BU_C_ = {}; if (typeof OPS_C_ !== 'undefined') OPS_C_ = {};
  try {
    switch (action) {
      case 'buList':     return bu_list_(p);
      case 'buSave':     return bu_save_(p);
      case 'buApplyAvg': return bu_applyAvg_(p);
      case 'buEvtSave':  return bu_evtSave_(p);
      case 'buEvtDel':   return bu_evtDel_(p);
    }
  } catch (e) { return { error: e.message }; }
  return null;
}

// ── 覆蓋：各店剩餘麵糊（管理儀表板、宇宙辦公室）──多回黑糖與預估 ──
function bt_get_(p) {
  BU_C_ = {}; if (typeof OPS_C_ !== 'undefined') OPS_C_ = {};
  var locs = ops_locs_(), out = [];
  var cl = bu_closes_();
  Object.keys(cl).forEach(function (code) {
    var rows = cl[code].filter(function (c) { return c.any; }); if (!rows.length) return;
    var last = rows[rows.length - 1], l = locs.filter(function (x) { return x.code === code; })[0];
    var rec = { loc: l ? l.name : last.loc, code: code, date: last.date, by: last.by, rem: {}, restock: {} };
    BU_FL.forEach(function (f, k) { rec.rem[f] = last.rem[k]; rec.restock[f] = last.rs[k]; });
    if (l) { var fc = bu_forecast_(l); rec.fc = { orig: fc.orig, other: fc.other, low: fc.low, setup: fc.setup }; }
    out.push(rec);
  });
  out.sort(function (a, b) { return (a.code || a.loc) < (b.code || b.loc) ? -1 : 1; });
  return { success: true, data: out };
}

// ── 覆蓋：加盟損益的每日營業額與麵糊用量（改依正確欄位＋實際用量）──
function ops_revenueByDay_(loc, ym) {
  BU_C_ = {};
  var code = loc_code_(loc) || loc, out = {}, daily = bu_daily_(code);
  (bu_closes_()[code] || []).forEach(function (c) {
    if (c.date.slice(0, 7) !== ym) return;
    out[c.date] = { rev: c.rev, batter: daily[c.date] ? bu_r2_(daily[c.date].orig + daily[c.date].other) : 0 };
  });
  return out;
}
// ── 覆蓋：赤心幣讀營業額（AE 營業額合計，空白時 Q 當日營業額）──
function gm_closeRows_() {
  if (GM_CACHE_.close) return GM_CACHE_.close;
  var out = [];
  ['收店盤點', '收店盤點_歷史'].forEach(function (n) {
    var sh = gm_ss_().getSheetByName(n); if (!sh || sh.getLastRow() < 2) return;
    sh.getRange(2, 1, sh.getLastRow() - 1, Math.min(sh.getMaxColumns(), 40)).getValues().forEach(function (r) {
      var L = bu_isOld_(r) ? BU_C_OLD : BU_C;
      var rev = bu_blank_(r[L.total]) || String(r[L.total]).trim() === '' ? gm_num_(r[L.egg]) : gm_num_(r[L.total]);
      out.push({ date: gm_dstr_(r[1]), emp: String(r[3]).trim(), loc: String(r[5]).trim(), rev: rev });
    });
  });
  return (GM_CACHE_.close = out);
}

// ═══════════════════════════════════════════════
// 叫貨品項分類＋請總部處理（門市回報）v1.24（2026-11-12）
// 貼在「麵糊用量 v2」之後、「路由v1.24」之前
// 1. 叫貨品項改分類：原物料／包材／製作器具／文具／機器保養／其他；〈供貨價格〉新增 E 欄「分類」，品項以這張表為準（App「供貨價格與應收」可增改）
// 2. 請總部處理：機器報修、水電場地、人力支援、客訴、金流、其他；照片、緊急程度、接手、完成、費用；送出推 LINE「報修」群組
// 3. 費用：門市回報的費用（Lv.3 完成時填）計入加盟店損益「總部維修／服務」與應收；應收也列合作櫃位（桃機：物料＋回報費用）
// 部署後執行一次 rp_setup()
// 覆蓋：ops_prices_、ops_priceList_、ops_priceSave_、ops_matItems_、ops_pnlCalc_、ops_receivable_、line_groupSave_
// ═══════════════════════════════════════════════

var RP_MAT_CATALOG = [
  ['原物料', [['原味麵糊', '包'], ['可可麵糊', '包'], ['紅玉麵糊', '包'], ['抹茶麵糊', '包'], ['黑糖麵糊', '包'], ['芝麻麵糊', '包'],
              ['可可粉', '包'], ['紅玉紅茶粉', '包'], ['抹茶粉', '包'], ['黑糖粉', '包'], ['芝麻粉', '包'], ['低筋麵粉', '袋'], ['泡打粉', '罐'], ['二砂糖', '包']]],
  ['包材', [['紙袋', '包'], ['空白紙袋', '包'], ['紙盒', '個'], ['竹籤', '包'], ['塑膠提袋', '包']]],
  ['製作器具', [['攪拌機', '台'], ['麵糊桶', '個'], ['麵糊漏斗', '個'], ['麵糊叉子', '支'], ['毛刷', '支'], ['平刀', '支'], ['測溫槍', '支'],
                ['秤重器', '台'], ['湯匙', '支'], ['過篩網', '個'], ['六角扳手5號', '支'], ['六角扳手3號', '支'], ['十字起子', '支'], ['剪刀', '支'],
                ['推車', '台'], ['保冷袋', '個'], ['延長線', '條'], ['轉接頭', '個']]],
  ['文具', [['菜單表', '張'], ['原子筆', '支'], ['白板筆', '支'], ['訂書機', '個'], ['訂書針', '盒'], ['膠水', '瓶']]],
  ['機器保養', [['機器鍍膜', '次']]],
  ['其他', [['其他', '']]]
];
var RP_MAT_CATS = RP_MAT_CATALOG.map(function (c) { return c[0]; });
var RP_RENAME = { '麵糊': '原味麵糊', '麵粉': '低筋麵粉' };
var OPS_PRICE_HEAD = ['品項', '單位', '單價', '備註', '分類'];

var RP_HEAD = ['回報編號', '建立時間', '員工編號', '姓名', '櫃位', '分類', '項目', '說明', '照片', '緊急程度', '狀態', '接手人', '處理結果', '費用', '完成時間', '狀態紀錄(JSON)'];
var RP_CATS = [
  ['機器報修', ['不升溫', '不過電', '溫控壞掉', '需要換模具', '冰箱溫度異常', '其他機器問題']],
  ['水電場地', ['停電／跳電', '漏水', '百貨公司通知', '其他']],
  ['人力支援', ['臨時缺人', '需要調班', '其他']],
  ['客訴與客人狀況', []],
  ['金流', ['POS／刷卡機故障', '零用金不足', '其他']],
  ['其他', []]
];
var RP_URG = ['一般', '今天要處理', '現在就要'];
var RP_OPEN = ['已送出', '處理中'];

function rp_idx_(item) {
  for (var i = 0; i < RP_MAT_CATALOG.length; i++) for (var j = 0; j < RP_MAT_CATALOG[i][1].length; j++) if (RP_MAT_CATALOG[i][1][j][0] === item) return j;
  return 500;
}
function rp_catOf_(item) {
  for (var i = 0; i < RP_MAT_CATALOG.length; i++) for (var j = 0; j < RP_MAT_CATALOG[i][1].length; j++) if (RP_MAT_CATALOG[i][1][j][0] === item) return RP_MAT_CATALOG[i][0];
  return '';
}

// ── 供貨價格（含分類）──
function ops_prices_() {
  var sh = ops_sheet_('供貨價格', OPS_PRICE_HEAD), out = {};
  ops_rows_(sh, 5).forEach(function (r, i) {
    var n = String(r[0]).trim(); if (!n) return;
    out[n] = { unit: String(r[1] || ''), price: r[2] === '' ? null : ops_num_(r[2]), note: String(r[3] || ''), cat: String(r[4] || '') || rp_catOf_(n) || '其他', order: i };
  });
  if (out['原味麵糊'] && !out['麵糊']) out['麵糊'] = out['原味麵糊'];        // 舊名相容
  return out;
}
function rp_priceSorted_() {
  var pr = ops_prices_();
  return Object.keys(pr).filter(function (k) { return !(k === '麵糊' && pr['原味麵糊'] === pr[k]); }).map(function (k) { return { item: k, unit: pr[k].unit, price: pr[k].price, note: pr[k].note, cat: pr[k].cat, order: pr[k].order }; })
    .sort(function (a, b) {
      var ca = RP_MAT_CATS.indexOf(a.cat), cb = RP_MAT_CATS.indexOf(b.cat); if (ca < 0) ca = 98; if (cb < 0) cb = 98;
      if (a.item === '其他') ca = 99; if (b.item === '其他') cb = 99;
      if (ca !== cb) return ca - cb;
      var ia = rp_idx_(a.item), ib = rp_idx_(b.item);
      return ia !== ib ? ia - ib : a.order - b.order;
    });
}
function ops_priceList_(p) {
  ops_need_(p, 2);
  return { success: true, cats: RP_MAT_CATS, data: rp_priceSorted_().map(function (x) { delete x.order; return x; }) };
}
function ops_priceSave_(p) {
  ops_need_(p, 3, true);
  var list = ops_arr_(p.list), sh = ops_sheet_('供貨價格', OPS_PRICE_HEAD);
  var rows = list.filter(function (x) { return String(x.item || '').trim(); }).map(function (x) {
    var price = x.price === '' || x.price === null || x.price === undefined ? '' : ops_num_(x.price);
    var cat = String(x.cat || '').trim(); if (RP_MAT_CATS.indexOf(cat) < 0) cat = rp_catOf_(String(x.item).trim()) || '其他';
    return [String(x.item).trim().slice(0, 20), String(x.unit || '').slice(0, 6), price, String(x.note || '').slice(0, 60), cat];
  });
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 5).clearContent();
    if (rows.length) sh.getRange(2, 1, rows.length, 5).setValues(rows);
  } finally { lock.releaseLock(); }
  return { success: true };
}
function ops_matItems_(p) {
  var list = rp_priceSorted_();
  if (!list.length) list = [].concat.apply([], RP_MAT_CATALOG.map(function (c) { return c[1].map(function (x) { return { item: x[0], unit: x[1], cat: c[0] }; }); }));
  if (!list.some(function (x) { return x.item === '其他'; })) list.push({ item: '其他', unit: '', cat: '其他' });
  return { success: true, cats: RP_MAT_CATS, items: list.filter(function (x) { return !/停用/.test(x.note || ''); }).map(function (x) { return { item: x.item, unit: x.unit, cat: x.cat }; }) };
}

// ── 部署後執行一次 ──
function rp_setup() {
  var sh = ops_sheet_('供貨價格', OPS_PRICE_HEAD);
  if (!String(sh.getRange(1, 5).getValue()).trim()) sh.getRange(1, 5).setValue('分類');
  var rows = ops_rows_(sh, 5).filter(function (r) { return String(r[0]).trim(); }), have = {}, log = [];
  rows = rows.filter(function (r) {
    var n = String(r[0]).trim();
    if (RP_RENAME[n]) { log.push(n + ' → ' + RP_RENAME[n]); r[0] = RP_RENAME[n]; n = r[0]; }
    if (n === '包材' && r[2] === '') { log.push('移除「包材」（改成紙袋、紙盒…細項）'); return false; }
    if (have[n]) return false;
    have[n] = 1; if (!String(r[4] || '').trim()) r[4] = rp_catOf_(n) || '其他';
    return true;
  });
  RP_MAT_CATALOG.forEach(function (c) { c[1].forEach(function (x) { if (x[0] === '其他' || have[x[0]]) return; rows.push([x[0], x[1], '', '單價待補', c[0]]); have[x[0]] = 1; log.push('新增 ' + c[0] + '／' + x[0]); }); });
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 5).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, 5).setValues(rows.map(function (r) { return [r[0], r[1], r[2], r[3], r[4]]; }));
  ops_sheet_('門市回報', RP_HEAD);
  Logger.log('rp_setup 完成\n' + log.join('\n') + '\n提醒：到 App「發公告→LINE 群組」把要收報修通知的群組勾「報修」');
  return log;
}

// ── 請總部處理（門市回報）──
function rp_rows_() {
  var sh = ops_sheet_('門市回報', RP_HEAD);
  return ops_rows_(sh, RP_HEAD.length).map(function (r, i) {
    return { row: i + 2, id: String(r[0]), created: String(r[1]), empId: String(r[2]), name: String(r[3]), loc: String(r[4]), cat: String(r[5]), item: String(r[6] || ''),
      desc: String(r[7] || ''), photo: String(r[8] || ''), urg: String(r[9] || '一般'), status: String(r[10] || '已送出'), handler: String(r[11] || ''),
      result: String(r[12] || ''), fee: r[13] === '' ? null : ops_num_(r[13]), done: String(r[14] || ''), log: ops_json_(String(r[15] || ''), []) };
  }).filter(function (x) { return x.id; });
}
function rp_canSee_(me, x) { return me.role >= 3 || x.empId === me.id || ops_myLocs_(me).indexOf(x.loc) >= 0; }
function rp_canHandle_(me, x) { return me.role >= 3 || (me.role >= 2 && ops_myLocs_(me).indexOf(x.loc) >= 0); }
function rp_meta_(p) {
  var me = ops_me_(p.empId);
  return { success: true, cats: RP_CATS.map(function (c) { return { cat: c[0], items: c[1] }; }), urg: RP_URG, canManage: me.role >= 2, canFee: me.role >= 3 };
}
function rp_create_(p) {
  var me = ops_me_(p.empId), loc = String(p.loc || '').trim();
  if (!ops_locByName_(loc)) return { error: '請選櫃位' };
  if (me.role < 3 && ops_myLocs_(me).indexOf(loc) < 0 && me.type !== '員工') return { error: '只能回報自己的櫃位' };
  var cat = String(p.cat || ''), c = RP_CATS.filter(function (x) { return x[0] === cat; })[0];
  if (!c) return { error: '請選分類' };
  var item = String(p.item || '').trim().slice(0, 20);
  if (c[1].length && c[1].indexOf(item) < 0) return { error: '請選項目' };
  var desc = String(p.desc || '').trim().slice(0, 300);
  if (!c[1].length && !desc) return { error: '請寫一下狀況' };
  if (/其他/.test(item) && !desc) return { error: '「其他」請寫一下狀況' };
  var urg = RP_URG.indexOf(String(p.urg)) >= 0 ? String(p.urg) : '一般';
  var id = typeof au_id_ === 'function' ? au_id_('R') : 'R' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
  var log = [{ s: '已送出', by: me.name, at: ops_now_() }];
  ops_sheet_('門市回報', RP_HEAD).appendRow([id, ops_now_(), me.id, me.name, loc, cat, item, desc, String(p.photo || '').slice(0, 500), urg, '已送出', '', '', '', '', JSON.stringify(log)]);
  try {
    if (typeof line_notify_ === 'function') line_notify_('報修', (urg === '現在就要' ? '🚨 ' : urg === '今天要處理' ? '⚠️ ' : '🔧 ') + '門市回報｜' + loc.replace(/^\d+/, '') + '\n' +
      cat + (item ? '／' + item : '') + (urg !== '一般' ? '（' + urg + '）' : '') + (desc ? '\n' + desc.slice(0, 120) : '') + '\n回報：' + me.name + (p.photo ? '\n📷 有附照片（App 內查看）' : ''));
  } catch (e) {}
  return { success: true, id: id };
}
function rp_list_(p) {
  var me = ops_me_(p.empId), ym = String(p.ym || '');
  var list = rp_rows_().filter(function (x) {
    if (!rp_canSee_(me, x)) return false;
    if (p.open) return RP_OPEN.indexOf(x.status) >= 0;
    return !ym || x.created.slice(0, 7) === ym;
  });
  var u = function (x) { return RP_URG.indexOf(x.urg); };
  list.sort(function (a, b) {
    var oa = RP_OPEN.indexOf(a.status) >= 0 ? 0 : 1, ob = RP_OPEN.indexOf(b.status) >= 0 ? 0 : 1;
    if (oa !== ob) return oa - ob;
    if (!oa && u(a) !== u(b)) return u(b) - u(a);
    return a.created < b.created ? 1 : -1;
  });
  return { success: true, canManage: me.role >= 2, canFee: me.role >= 3, data: list.slice(0, 200).map(function (x) {
    x.canHandle = rp_canHandle_(me, x); x.mine = x.empId === me.id; delete x.row; return x;
  }) };
}
function rp_update_(p) {
  var me = ops_me_(p.empId), st = String(p.status || '');
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var x = rp_rows_().filter(function (r) { return r.id === String(p.id || ''); })[0];
    if (!x) return { error: '找不到這筆回報' };
    if (!rp_canSee_(me, x)) return { error: '沒有權限' };
    var sh = ops_ss_().getSheetByName('門市回報'), text = String(p.text || '').trim().slice(0, 300);
    if (st === '留言') {
      if (!text) return { error: '請輸入內容' };
      x.log.push({ s: '留言', by: me.name, at: ops_now_(), t: text });
      sh.getRange(x.row, 16).setValue(JSON.stringify(x.log));
      return { success: true };
    }
    if (st === '已取消') {
      if (!(me.role >= 3 || (x.empId === me.id && x.status === '已送出'))) return { error: '只有回報人（總部還沒接手前）或總部可以取消' };
    } else if (st === '處理中' || st === '已完成') {
      if (!rp_canHandle_(me, x)) return { error: '只有分隊長（自己的櫃位）以上可以處理' };
      if (st === '已完成' && !text) return { error: '請寫處理結果' };
    } else return { error: '狀態不正確' };
    var fee = x.fee;
    if (st === '已完成' && p.fee !== undefined && p.fee !== '' && p.fee !== null) {
      if (me.role < 3) return { error: '費用只有總部（Lv.3）可以填' };
      fee = Math.max(0, Math.round(ops_num_(p.fee)));
    }
    x.log.push({ s: st, by: me.name, at: ops_now_(), t: text });
    var handler = st === '處理中' ? me.name : (x.handler || (st === '已完成' ? me.name : ''));
    sh.getRange(x.row, 11, 1, 6).setValues([[st, handler, st === '已完成' ? text : x.result, fee === null ? '' : fee, st === '已完成' || st === '已取消' ? ops_today_() : '', JSON.stringify(x.log)]]);
    if (st === '已完成') { try { if (typeof line_notify_ === 'function' && x.urg !== '一般') line_notify_('報修', '✅ 已處理｜' + x.loc.replace(/^\d+/, '') + '　' + x.cat + (x.item ? '／' + x.item : '') + '\n' + text.slice(0, 100)); } catch (e) {} }
    return { success: true };
  } finally { lock.releaseLock(); }
}
function rp_count_(p) {
  var me = ops_me_(p.empId), n = 0, urgent = 0, mineOpen = 0;
  rp_rows_().forEach(function (x) {
    if (RP_OPEN.indexOf(x.status) < 0) return;
    if (x.empId === me.id) mineOpen++;
    if (me.role >= 2 && rp_canHandle_(me, x)) { n++; if (x.urg !== '一般' && x.status === '已送出') urgent++; }
  });
  return { success: true, pending: n, urgent: urgent, mineOpen: mineOpen };
}
function rp_feeSum_(loc, ym) {
  var s = 0;
  rp_rows_().forEach(function (x) { if (x.status === '已完成' && x.fee && ops_sameLoc_(x.loc, loc) && String(x.done || x.created).slice(0, 7) === ym) s += x.fee; });
  return s;
}
function rpHandler_(action, p) {
  if (!/^rp[A-Z]/.test(String(action || ''))) return null;
  p = p || {}; if (typeof OPS_C_ !== 'undefined') OPS_C_ = {};
  try {
    switch (action) {
      case 'rpMeta':   return rp_meta_(p);
      case 'rpCreate': return rp_create_(p);
      case 'rpList':   return rp_list_(p);
      case 'rpUpdate': return rp_update_(p);
      case 'rpCount':  return rp_count_(p);
    }
  } catch (e) { return { error: e.message }; }
  return null;
}

// ── 覆蓋：LINE 群組用途多「報修」──
function line_groupSave_(p) {
  line_me_(p, 3);
  var g = line_groups_().filter(function (x) { return x.id === String(p.id || ''); })[0]; if (!g) return { error: '找不到群組' };
  var use = String(p.use || '公告').split(/[,，、]/).filter(function (x) { return /^(公告|物料|報修)$/.test(x); }).join('、') || '公告';
  var locs = (Object.prototype.toString.call(p.locs) === '[object Array]' ? p.locs : String(p.locs || '').split(/[、,，]+/)).map(String).filter(String);
  line_sheet_().getRange(g.row, 2, 1, 6).setValues([[String(p.name || g.name).slice(0, 30), g.status || '使用中', use, g.joined, line_now_(), locs.join('、')]]);
  return { success: true };
}

// ── 覆蓋：應收（加盟店＋合作櫃位）──
function rp_partnerCalc_(loc, ym) {
  var pr = ops_prices_(), mat = 0, missing = [];
  ops_matRows_().forEach(function (x) {
    if (!ops_sameLoc_(x.loc, loc) || !/已出貨|已送達/.test(x.status) || (x.shipDate || x.created).slice(0, 7) !== ym) return;
    x.items.forEach(function (it) { var u = pr[it.item]; if (!u || u.price === null) { if (missing.indexOf(it.item) < 0) missing.push(it.item); return; } mat += u.price * it.qty; });
  });
  return { materials: Math.round(mat), missing: missing };
}
function ops_receivable_(p) {
  ops_need_(p, 3, true);
  var ym = String(p.ym || ops_prevYm_(ops_today_().slice(0, 7)));
  return { success: true, ym: ym, data: ops_locs_().filter(function (x) { return /加盟|合作/.test(x.kind) && x.status !== '已停用'; }).map(function (x) {
    var fee = rp_feeSum_(x.name, ym);
    if (/合作/.test(x.kind)) {
      var c2 = rp_partnerCalc_(x.name, ym);
      return { loc: x.name, kind: '合作', revenue: null, royalty: 0, batter: 0, materials: c2.materials, fee: fee, total: c2.materials + fee, missingPrice: c2.missing };
    }
    var c = ops_pnlCalc_(x.name, ym);
    return { loc: x.name, kind: '加盟', revenue: c.revenue, royalty: c.royalty, batter: c.batterCost, materials: c.matCost, fee: fee, total: c.royalty + c.batterCost + c.matCost + fee, missingPrice: c.missingPrice };
  }) };
}

// ── 覆蓋：加盟店損益（原味麵糊改名、各口味麵糊以用量計、加總部維修／服務費）──
function ops_pnlCalc_(loc, ym) {
  var days = ops_revenueByDay_(loc, ym), revenue = 0, batterUse = 0, openDays = 0;
  Object.keys(days).forEach(function (d) { revenue += days[d].rev; batterUse += days[d].batter; if (days[d].rev > 0) openDays++; });
  var exps = ops_expRows_(loc, ym), fixed = ops_fixedRows_(loc).filter(function (f) { return (!f.from || f.from <= ym) && (!f.to || f.to >= ym); });
  var income = {}, cost = {};
  exps.forEach(function (e) { if (OPS_INCOME_CATS.indexOf(e.cat) >= 0) income[e.cat] = (income[e.cat] || 0) + e.amount; else cost[e.cat] = (cost[e.cat] || 0) + e.amount; });
  var fixedApplied = [];
  fixed.forEach(function (f) {                       // 當月若已手動填同分類，就不再自動帶入
    if (exps.some(function (e) { return e.cat === f.cat; })) return;
    cost[f.cat] = (cost[f.cat] || 0) + f.amount; fixedApplied.push(f.cat);
  });
  var otherIncome = Object.keys(income).reduce(function (s, k) { return s + income[k]; }, 0);
  var sales = revenue + otherIncome;
  var vat = /是|Y|1|有/.test(String(ops_param_('加盟店開發票', '是'))) ? Math.round(sales / 1.05 * 0.05) : 0;
  var pr = ops_prices_(), missing = [];
  var bp = pr['原味麵糊'] || pr['麵糊'];
  var batterPrice = bp && bp.price !== null ? bp.price : null;
  if (batterPrice === null && batterUse) missing.push('原味麵糊');
  var batterCost = batterPrice === null ? 0 : Math.round(batterUse * batterPrice);
  // 物料（麵糊以收店用量計，避免重複；其他品項以當月出貨的物料需求單計）
  var mat = {}, matCost = 0;
  ops_matRows_().forEach(function (x) {
    if (!ops_sameLoc_(x.loc, loc) || !/已出貨|已送達/.test(x.status) || (x.shipDate || x.created).slice(0, 7) !== ym) return;
    x.items.forEach(function (it) {
      if (/麵糊$/.test(it.item)) return;           // 各口味麵糊以收店用量計
      var u = pr[it.item];
      if (!u || u.price === null) { if (missing.indexOf(it.item) < 0) missing.push(it.item); return; }
      mat[it.item] = (mat[it.item] || 0) + u.price * it.qty; matCost += u.price * it.qty;
    });
  });
  matCost = Math.round(matCost);
  var rate = ops_num_(ops_param_('加盟權利金比率', 0.01)); if (rate > 1) rate = rate / 100;
  var royalty = Math.round(revenue * rate);
  // 人事：系統代算的加盟店夥伴薪資（薪資引擎 v3）＋加盟主自評人力
  var labor = { staff: 0, list: [], owner: 0, ownerHours: 0 };
  try {
    if (typeof pay3_compute_ === 'function') {
      var res = pay3_compute_(ym, {});
      Object.keys(res.emps).forEach(function (id) {
        var e = res.emps[id]; if (!e.franchise || !ops_sameLoc_(e.franchiseLoc, loc)) return;
        if (e.isOwner) { labor.ownerHours += e.totalH; return; }
        labor.staff += e.gross; labor.list.push({ id: id, name: e.name, hours: e.totalH, gross: e.gross, notes: e.notes });
      });
    }
  } catch (e) { labor.err = e.message; }
  var ownerWage = ops_num_(ops_param_('加盟主自評時薪_' + loc, ops_param_('加盟主自評時薪', 0)));
  labor.owner = Math.round(labor.ownerHours * ownerWage);
  // v1.24：總部處理門市回報的費用（完成月份計）
  var rpFee = rp_feeSum_(loc, ym); if (rpFee) cost['總部維修／服務'] = (cost['總部維修／服務'] || 0) + rpFee;
  var opex = Object.keys(cost).reduce(function (s, k) { return s + cost[k]; }, 0);
  var totalCost = vat + batterCost + matCost + labor.staff + opex + royalty;
  var net = sales - totalCost, netOwner = net - labor.owner;
  var variable = vat + batterCost + matCost + royalty;
  var fixedCost = totalCost - variable, varRatio = sales ? variable / sales : 0;
  var be = openDays && varRatio < 1 ? Math.ceil(fixedCost / (1 - varRatio) / openDays) : null;
  return { loc: loc, ym: ym, revenue: Math.round(revenue), income: income, sales: Math.round(sales), vat: vat, openDays: openDays,
    avgDaily: openDays ? Math.round(revenue / openDays) : 0, batterUse: Math.round(batterUse * 100) / 100, batterPrice: batterPrice, batterCost: batterCost,
    materials: mat, matCost: matCost, labor: labor, ownerWage: ownerWage, costs: cost, fixedApplied: fixedApplied, royaltyRate: rate, royalty: royalty, rpFee: rpFee,
    totalCost: Math.round(totalCost), net: Math.round(net), netOwner: Math.round(netOwner), margin: sales ? Math.round(net / sales * 1000) / 10 : 0,
    breakEvenDaily: be, missingPrice: missing, days: Object.keys(days).sort().map(function (d) { return { date: d, rev: days[d].rev, batter: days[d].batter }; }) };
}

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

// ═══════════════════════════════════════════════
// 路由 extHandler_ v1.24（2026-11-12）
// 整段貼在「程式碼.gs」最底部即可（Apps Script 以檔案中最後一個同名函式為準，不必改原本那一個）。
// 與 v1.23 路由的差別：buHandler_ 之後加 rpHandler_（請總部處理）。其餘不變。
// ═══════════════════════════════════════════════
function extHandler_(action, p) {
  p = p || {};
  var sec = secHandler_(action, p); if (sec) return sec;
  var op = opsHandler_(action, p); if (op) return op;
  var bu = buHandler_(action, p); if (bu) return bu;
  var rp = rpHandler_(action, p); if (rp) return rp;
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

// ═══════════════════════════════════════════════
// 路由 extHandler_ v1.25（2026-11-12）
// 整段貼在「程式碼.gs」最底部即可（Apps Script 以檔案中最後一個同名函式為準，不必改原本那一個）。
// 與 v1.24 路由的差別：最前面加 au_gate_（登入驗證、夥伴視角）與 auHandler_。其餘不變。
// ═══════════════════════════════════════════════
function extHandler_(action, p) {
  p = p || {};
  var gate = au_gate_(action, p); if (gate) return gate;
  var au = auHandler_(action, p); if (au) return au;
  var sec = secHandler_(action, p); if (sec) return sec;
  var op = opsHandler_(action, p); if (op) return op;
  var bu = buHandler_(action, p); if (bu) return bu;
  var rp = rpHandler_(action, p); if (rp) return rp;
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

// ═══════════════════════════════════════════════
// v1.26 食安稽查＋叫貨品項＋常用物料＋補貨看板＋SOP 教學（2026-11-13）
// 貼在「登入驗證 v1.25」之後、「路由v1.26」之前。部署後執行一次 fs_setup()
// 1. 叫貨：新分類「清潔用品」、製作器具／其他新增品項；〈供貨價格〉F 欄「常用」（宇宙辦公室快速選項）
// 2. 補貨看板：未處理 → 已發貨（Lv.3）→ 已補齊；〈缺貨看板〉J「發貨時間」K「發貨人」
// 3. 食安：冰箱溫度（上下班每台都填，0～7°C）、儀容勾選、櫃位證照、夥伴體檢表（只有本人與管理者看得到）
// 4. SOP 教學：〈SOP〉可放任何類型（開店、收店、攪拌麵糊、烤雞蛋糕…）；G 欄「注意事項」；Lv.3 可在 App 編輯
// 覆蓋：RP_MAT_CATALOG、RP_MAT_CATS、OPS_PRICE_HEAD、ops_prices_、rp_priceSorted_、ops_priceList_、ops_priceSave_、
//       uo_getShortages、uo_resolveShortage、sop_get_、AU_READ
// ═══════════════════════════════════════════════

// ── 1. 叫貨品項 ──
RP_MAT_CATALOG = [
  ['原物料', [['原味麵糊', '包'], ['可可麵糊', '包'], ['紅玉麵糊', '包'], ['抹茶麵糊', '包'], ['黑糖麵糊', '包'], ['芝麻麵糊', '包'],
              ['可可粉', '包'], ['紅玉紅茶粉', '包'], ['抹茶粉', '包'], ['黑糖粉', '包'], ['芝麻粉', '包'], ['低筋麵粉', '袋'], ['泡打粉', '罐'], ['二砂糖', '包']]],
  ['包材', [['紙袋', '包'], ['空白紙袋', '包'], ['紙盒', '個'], ['竹籤', '包'], ['塑膠提袋', '包']]],
  ['製作器具', [['攪拌機', '台'], ['麵糊桶', '個'], ['麵糊漏斗', '個'], ['麵糊叉子', '支'], ['毛刷', '支'], ['平刀', '支'], ['測溫槍', '支'],
                ['秤重器', '台'], ['湯匙', '支'], ['過篩網', '個'], ['六角扳手5號', '支'], ['六角扳手3號', '支'], ['十字起子', '支'], ['剪刀', '支'],
                ['推車', '台'], ['保冷袋', '個'], ['延長線', '條'], ['轉接頭', '個'], ['計時器', '個'], ['降溫風扇', '台'], ['鐵盤', '個'], ['塑膠桌墊', '張'], ['電池', '顆']]],
  ['清潔用品', [['濕紙巾', '包'], ['清潔劑', '瓶'], ['菜瓜布', '個'], ['烤盤油', '瓶'], ['模布', '條'], ['漂白水', '瓶'], ['一點絕', '盒'], ['黏鼠板', '片'], ['有蓋垃圾桶', '個']]],
  ['文具', [['菜單表', '張'], ['原子筆', '支'], ['白板筆', '支'], ['訂書機', '個'], ['訂書針', '盒'], ['膠水', '瓶']]],
  ['機器保養', [['機器鍍膜', '次']]],
  ['其他', [['桌布', '條'], ['椅子', '張'], ['其他', '']]]
];
RP_MAT_CATS = RP_MAT_CATALOG.map(function (c) { return c[0]; });
OPS_PRICE_HEAD = ['品項', '單位', '單價', '備註', '分類', '常用'];
var FS_FAV_DEFAULT = ['原味麵糊', '可可麵糊', '紅玉麵糊', '抹茶麵糊', '黑糖麵糊', '芝麻麵糊', '紙袋', '紙盒', '竹籤', '塑膠提袋', '機器鍍膜'];
var FS_FLAVOR_BATTER = ['可可麵糊', '紅玉麵糊', '抹茶麵糊', '黑糖麵糊', '芝麻麵糊'];
function fs_yes_(v) { return /^(是|Y|TRUE|v|✓|✔|1)$/i.test(String(v == null ? '' : v).trim()); }

function ops_prices_() {
  var sh = ops_sheet_('供貨價格', OPS_PRICE_HEAD), out = {};
  ops_rows_(sh, 6).forEach(function (r, i) {
    var n = String(r[0]).trim(); if (!n) return;
    out[n] = { unit: String(r[1] || ''), price: r[2] === '' ? null : ops_num_(r[2]), note: String(r[3] || ''), cat: String(r[4] || '') || rp_catOf_(n) || '其他', fav: fs_yes_(r[5]), order: i };
  });
  if (out['原味麵糊'] && !out['麵糊']) out['麵糊'] = out['原味麵糊'];
  return out;
}
function rp_priceSorted_() {
  var pr = ops_prices_();
  return Object.keys(pr).filter(function (k) { return !(k === '麵糊' && pr['原味麵糊'] === pr[k]); }).map(function (k) { return { item: k, unit: pr[k].unit, price: pr[k].price, note: pr[k].note, cat: pr[k].cat, fav: pr[k].fav, order: pr[k].order }; })
    .sort(function (a, b) {
      var ca = RP_MAT_CATS.indexOf(a.cat), cb = RP_MAT_CATS.indexOf(b.cat); if (ca < 0) ca = 98; if (cb < 0) cb = 98;
      if (a.item === '其他') ca = 99; if (b.item === '其他') cb = 99;
      if (ca !== cb) return ca - cb;
      var ia = rp_idx_(a.item), ib = rp_idx_(b.item);
      return ia !== ib ? ia - ib : a.order - b.order;
    });
}
function ops_priceList_(p) {
  ops_need_(p, 2);
  return { success: true, cats: RP_MAT_CATS, data: rp_priceSorted_().map(function (x) { delete x.order; return x; }) };
}
function ops_priceSave_(p) {
  ops_need_(p, 3, true);
  var list = ops_arr_(p.list), sh = ops_sheet_('供貨價格', OPS_PRICE_HEAD);
  if (!String(sh.getRange(1, 6).getValue()).trim()) sh.getRange(1, 6).setValue('常用');
  var rows = list.filter(function (x) { return String(x.item || '').trim(); }).map(function (x) {
    var price = x.price === '' || x.price === null || x.price === undefined ? '' : ops_num_(x.price);
    var cat = String(x.cat || '').trim(); if (RP_MAT_CATS.indexOf(cat) < 0) cat = rp_catOf_(String(x.item).trim()) || '其他';
    return [String(x.item).trim().slice(0, 20), String(x.unit || '').slice(0, 6), price, String(x.note || '').slice(0, 60), cat, x.fav ? '是' : ''];
  });
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 6).clearContent();
    if (rows.length) sh.getRange(2, 1, rows.length, 6).setValues(rows);
  } finally { lock.releaseLock(); }
  CacheService.getScriptCache().remove('fs_quick');
  return { success: true };
}
// 宇宙辦公室快速選項：勾「常用」的品項；口味麵糊合併成一顆
function fs_quick_() {
  var c = CacheService.getScriptCache(), hit = c.get('fs_quick'); if (hit) return JSON.parse(hit);
  var out = [], flavor = false;
  rp_priceSorted_().forEach(function (x) {
    if (!x.fav || /停用/.test(x.note || '')) return;
    if (FS_FLAVOR_BATTER.indexOf(x.item) >= 0) { if (!flavor) { flavor = true; out.push('口味麵糊'); } return; }
    out.push(x.item);
  });
  c.put('fs_quick', JSON.stringify(out), 300);
  return out;
}

// ── 2. 補貨看板（工廠出貨）──
var UO_HEADERS = ['編號', '登記時間', '櫃位', '品項', '登記人編號', '登記人', '狀態', '補齊時間', '補齊人', '發貨時間', '發貨人'];
function uo_getShortages() {
  var sh = uo_sheet_(), last = sh.getLastRow(), quick = [];
  try { quick = fs_quick_(); } catch (e) {}
  if (last < 2) return { success: true, data: [], quick: quick };
  var w = Math.min(11, Math.max(9, sh.getLastColumn()));
  var data = sh.getRange(2, 1, last - 1, w).getValues()
    .filter(function (r) { return r[0] && r[6] !== '已補齊'; })
    .map(function (r) {
      var ship = r[9] instanceof Date ? Utilities.formatDate(r[9], 'Asia/Taipei', 'yyyy-MM-dd HH:mm') : String(r[9] || '');
      return { id: String(r[0]), time: r[1] instanceof Date ? r[1].toISOString() : String(r[1]), location: String(r[2]), item: String(r[3]), by: String(r[5]),
        status: r[6] === '已發貨' ? '已發貨' : '未處理', shipAt: ship, shipBy: String(r[10] || '') };
    });
  return { success: true, data: data, quick: quick };
}
function uo_setStatus_(id, status, who) {
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var sh = uo_sheet_(), last = sh.getLastRow();
    if (last < 2) return { success: false, error: '找不到這筆需求' };
    if (!String(sh.getRange(1, 10).getValue()).trim()) sh.getRange(1, 10, 1, 2).setValues([['發貨時間', '發貨人']]);
    var ids = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) !== String(id)) continue;
      if (status === '已發貨') { sh.getRange(i + 2, 7).setValue('已發貨'); sh.getRange(i + 2, 10, 1, 2).setValues([[new Date(), who]]); }
      else sh.getRange(i + 2, 7, 1, 3).setValues([['已補齊', new Date(), who]]);
      return { success: true };
    }
    return { success: false, error: '找不到這筆需求' };
  } finally { lock.releaseLock(); }
}
function uo_shipShortage_(p) {
  var me = ops_me_(p.empId);
  if (me.role < 3) return { error: '「已發貨」由總部按（Lv.3 以上）' };
  return uo_setStatus_(p.id, '已發貨', me.name);
}
function uo_resolveShortage(d) {
  var who = d.name || d.empId || '';
  try { who = ops_me_(d.empId).name; } catch (e) {}
  return uo_setStatus_(d.id, '已補齊', who);
}

// ── 3. 食安 ──
var FS_LOG_HEAD = ['編號', '時間', '日期', '櫃位', '員工編號', '姓名', '上下班', '冰箱溫度(JSON)', '異常', '儀容(JSON)'];
var FS_CERT_HEAD = ['櫃位', '食品業者登錄字號', '產品責任險公司', '產品責任險保單號碼', '產品責任險到期日', '產品責任險照片',
  '公共意外險公司', '公共意外險保單號碼', '公共意外險到期日', '公共意外險照片', '其他證照', '更新人', '更新時間'];
var FS_HEALTH_HEAD = ['編號', '員工編號', '姓名', '上傳時間', '檔案ID', '體檢日期', '到期日', '狀態', '確認人', '確認時間', '備註'];
var FS_GROOM = ['帽子', '口罩', '品牌制服', '沒有穿拖鞋'];
var FS_HQ = '總部';

function fs_range_() {
  var lo = 0, hi = 7;
  try { lo = Number(ops_param_('冰箱溫度下限', 0)); hi = Number(ops_param_('冰箱溫度上限', 7)); } catch (e) {}
  return { min: isFinite(lo) ? lo : 0, max: isFinite(hi) ? hi : 7 };
}
function fs_fridges_() {
  var sh = ops_ss_().getSheetByName('櫃位設定'), v = sh.getDataRange().getValues(), h = (v[0] || []).map(String), c = h.indexOf('冰箱'), out = {};
  for (var r = 1; r < v.length; r++) {
    var n = String(v[r][0]).trim(); if (!n) continue;
    var list = c >= 0 ? String(v[r][c] || '').split(/[,，、]/).map(function (s) { return s.trim(); }).filter(String) : [];
    out[n] = list.length ? list : ['冰箱'];
  }
  return out;
}
function fs_meta_(p) { return { success: true, range: fs_range_(), fridges: fs_fridges_(), groom: FS_GROOM }; }

// 打卡後記錄冰箱溫度與儀容；超出範圍 → 門市回報＋LINE
function fs_log_(p) {
  var me = ops_me_(p.empId), loc = String(p.loc || '').trim(), type = p.type === '下班' ? '下班' : '上班';
  if (!loc) return { error: '缺少櫃位' };
  var rg = fs_range_(), temps = ops_arr_(p.temps).map(function (x) { return { name: String(x.name || '冰箱').slice(0, 12), t: Number(x.t) }; })
    .filter(function (x) { return isFinite(x.t) && String(x.t) !== ''; });
  var bad = temps.filter(function (x) { return x.t < rg.min || x.t > rg.max; });
  var groom = type === '上班' ? ops_arr_(p.groom).map(String).filter(function (g) { return FS_GROOM.indexOf(g) >= 0; }) : [];
  var id = typeof au_id_ === 'function' ? au_id_('F') : 'F' + Date.now();
  ops_sheet_('食安紀錄', FS_LOG_HEAD).appendRow([id, ops_now_(), Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd'), loc, me.id, me.name, type,
    JSON.stringify(temps), bad.length ? '是' : '', type === '上班' ? JSON.stringify(groom) : '']);
  var report = '';
  if (bad.length) {
    try {
      var desc = type + '打卡量到：' + bad.map(function (x) { return x.name + ' ' + x.t + '°C'; }).join('、') + '（正常 ' + rg.min + '～' + rg.max + '°C）';
      var r = rp_create_({ empId: me.id, loc: loc, cat: '機器報修', item: '冰箱溫度異常', desc: desc, urg: '今天要處理' });
      report = r && r.id || '';
    } catch (e) {}
  }
  return { success: true, id: id, abnormal: bad.length > 0, report: report, range: rg };
}
// 溫度紀錄（儀表板／匯出）：Lv.2 只看負責櫃位
function fs_temps_(p) {
  var me = ops_me_(p.empId); if (me.role < 2) return { error: '需要 Lv.2 以上' };
  var ym = /^\d{4}-\d{2}$/.test(p.ym || '') ? p.ym : Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM'), mine = ops_myLocs_(me), loc = String(p.loc || '');
  var rows = ops_rows_(ops_sheet_('食安紀錄', FS_LOG_HEAD), FS_LOG_HEAD.length).filter(function (r) {
    var l = String(r[3]); return String(r[2]).slice(0, 7) === ym && (!loc || l === loc) && (me.role >= 3 || mine.indexOf(l) >= 0);
  }).map(function (r) { return { at: String(r[1]), date: String(r[2]), loc: String(r[3]), name: String(r[5]), type: String(r[6]), temps: ops_json_(String(r[7] || ''), []), bad: String(r[8]) === '是', groom: ops_json_(String(r[9] || ''), null) }; });
  return { success: true, ym: ym, range: fs_range_(), data: rows.reverse() };
}

// 櫃位證照
function fs_certRows_() {
  var out = {};
  ops_rows_(ops_sheet_('櫃位證照', FS_CERT_HEAD), FS_CERT_HEAD.length).forEach(function (r) {
    var n = String(r[0]).trim(); if (!n) return;
    var d = function (v) { return v instanceof Date ? Utilities.formatDate(v, 'Asia/Taipei', 'yyyy-MM-dd') : String(v || ''); };
    out[n] = { loc: n, reg: String(r[1] || ''), plCo: String(r[2] || ''), plNo: String(r[3] || ''), plExp: d(r[4]), plPhoto: String(r[5] || ''),
      paCo: String(r[6] || ''), paNo: String(r[7] || ''), paExp: d(r[8]), paPhoto: String(r[9] || ''), other: String(r[10] || ''), by: String(r[11] || ''), at: String(r[12] || '') };
  });
  return out;
}
function fs_certFor_(all, loc) {               // 櫃位沒填的欄位用「總部」那一筆補
  var hq = all[FS_HQ] || {}, own = all[loc] || {}, o = { loc: loc };
  ['reg', 'plCo', 'plNo', 'plExp', 'plPhoto', 'paCo', 'paNo', 'paExp', 'paPhoto', 'other'].forEach(function (k) { o[k] = own[k] || hq[k] || ''; });
  o.fromHq = !all[loc];
  return o;
}
function fs_checkup_(raw) {                    // 夥伴資料 AF 欄（index 31）體檢到期
  var v = raw[31], d = v instanceof Date ? Utilities.formatDate(v, 'Asia/Taipei', 'yyyy-MM-dd') : String(v || '').trim().replace(/\//g, '-');
  if (!/^\d{4}-\d{1,2}-\d{1,2}/.test(d)) return { exp: '', status: '未上傳' };
  var days = Math.floor((new Date(d + 'T23:59:59+08:00').getTime() - Date.now()) / 86400000);
  return { exp: d.slice(0, 10), status: days < 0 ? '過期' : days <= 30 ? '即將到期' : '有效', days: days };
}
function fs_onDuty_(loc) {
  var sh = ops_ss_().getSheetByName('打卡紀錄'); if (!sh || sh.getLastRow() < 2) return [];
  var today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd'), last = {}, n = sh.getLastRow(), from = Math.max(2, n - 600);
  sh.getRange(from, 1, n - from + 1, 10).getValues().forEach(function (r) {
    var d = r[1] instanceof Date ? Utilities.formatDate(r[1], 'Asia/Taipei', 'yyyy-MM-dd') : String(r[1]).slice(0, 10);
    if (d !== today) return;
    last[String(r[2])] = { type: String(r[5]), loc: String(r[9]) };
  });
  return Object.keys(last).filter(function (e) { return last[e].type === '上班' && ops_sameLoc_(last[e].loc, loc); });
}
// 稽查資料：本櫃位證照＋今天在班夥伴的體檢狀態（不含體檢內容）
function fs_audit_(p) {
  var me = ops_me_(p.empId), loc = String(p.loc || '').trim();
  if (!loc) return { error: '請選櫃位' };
  var staff = ops_staff_().map, ids = fs_onDuty_(loc);
  if (ids.indexOf(me.id) < 0 && me.role < 2) ids.push(me.id);
  var crew = ids.map(function (id) { var s = staff[id]; if (!s) return null; var c = fs_checkup_(s.raw); return { name: s.name, exp: c.exp, status: c.status }; }).filter(Boolean);
  return { success: true, cert: fs_certFor_(fs_certRows_(), loc), crew: crew };
}
function fs_certList_(p) {
  ops_need_(p, 3);
  var all = fs_certRows_(), locs = [FS_HQ].concat(ops_locs_().filter(function (x) { return !/已停用|已結束/.test(x.status); }).map(function (x) { return x.name; }));
  return { success: true, data: locs.map(function (l) { var o = all[l] || { loc: l }; o.loc = l; return o; }) };
}
function fs_certSave_(p) {
  var me = ops_need_(p, 3, true), c = p.cert || {}; if (typeof c === 'string') c = ops_json_(c, {});
  var loc = String(c.loc || '').trim(); if (!loc) return { error: '缺少櫃位' };
  if (loc !== FS_HQ && !ops_locByName_(loc)) return { error: '找不到櫃位' };
  var sh = ops_sheet_('櫃位證照', FS_CERT_HEAD), s = function (v, n) { return String(v || '').trim().slice(0, n || 60); };
  var row = [loc, s(c.reg), s(c.plCo), s(c.plNo), s(c.plExp, 10), s(c.plPhoto, 300), s(c.paCo), s(c.paNo), s(c.paExp, 10), s(c.paPhoto, 300), s(c.other, 300), me.name, ops_now_()];
  var rows = ops_rows_(sh, 1), at = -1;
  for (var i = 0; i < rows.length; i++) if (String(rows[i][0]).trim() === loc) { at = i + 2; break; }
  if (at > 0) sh.getRange(at, 1, 1, row.length).setValues([row]); else sh.appendRow(row);
  return { success: true };
}

// 體檢表：檔案不公開（只有 Apps Script 擁有者），App 透過 fsHealthView 讀圖
function fs_healthFolder_() {
  var roots = DriveApp.getFoldersByName(DRIVE_ROOT), root = roots.hasNext() ? roots.next() : DriveApp.createFolder(DRIVE_ROOT);
  var subs = root.getFoldersByName('體檢表（不公開）');
  return subs.hasNext() ? subs.next() : root.createFolder('體檢表（不公開）');
}
function fs_healthUpload_(p) {
  var me = ops_me_(p.empId); if (p._viewAs) return { error: '預覽模式只能看' };
  if (!p.base64) return { error: '請拍體檢表' };
  var date = String(p.examDate || '').trim(); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: '請填體檢日期' };
  var f = fs_healthFolder_().createFile(Utilities.newBlob(Utilities.base64Decode(p.base64), 'image/jpeg', me.id + '_' + date + '_' + Date.now() + '.jpg'));
  try { f.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE); } catch (e) {}
  var id = typeof au_id_ === 'function' ? au_id_('H') : 'H' + Date.now();
  ops_sheet_('體檢表', FS_HEALTH_HEAD).appendRow([id, me.id, me.name, ops_now_(), f.getId(), date, '', '待確認', '', '', '']);
  return { success: true, id: id };
}
function fs_healthRows_() {
  return ops_rows_(ops_sheet_('體檢表', FS_HEALTH_HEAD), FS_HEALTH_HEAD.length).map(function (r, i) {
    var d = function (v) { return v instanceof Date ? Utilities.formatDate(v, 'Asia/Taipei', 'yyyy-MM-dd') : String(v || ''); };
    return { row: i + 2, id: String(r[0]), empId: String(r[1]), name: String(r[2]), at: String(r[3]), file: String(r[4]), exam: d(r[5]), exp: d(r[6]), status: String(r[7] || '待確認'), by: String(r[8] || ''), note: String(r[10] || '') };
  }).filter(function (x) { return x.id; });
}
function fs_healthMine_(p) {
  var me = ops_me_(p.empId), c = fs_checkup_(me.raw);
  var list = fs_healthRows_().filter(function (x) { return x.empId === me.id; }).reverse().map(function (x) { delete x.file; delete x.row; return x; });
  return { success: true, exp: c.exp, status: c.status, days: c.days, list: list };
}
function fs_healthList_(p) {
  var me = ops_need_(p, 3), staff = ops_staff_();
  var rows = fs_healthRows_(), pending = rows.filter(function (x) { return x.status === '待確認'; }).map(function (x) { delete x.file; delete x.row; return x; });
  var people = staff.list.filter(function (s) { return !s.left; }).map(function (s) { var c = fs_checkup_(s.raw); return { id: s.id, name: s.name, exp: c.exp, status: c.status, days: c.days }; })
    .sort(function (a, b) { var o = { '過期': 0, '未上傳': 1, '即將到期': 2, '有效': 3 }; return o[a.status] - o[b.status] || (a.days || 0) - (b.days || 0); });
  return { success: true, pending: pending, people: people };
}
function fs_healthView_(p) {
  var me = ops_me_(p.empId), x = fs_healthRows_().filter(function (r) { return r.id === String(p.id); })[0];
  if (!x) return { error: '找不到' };
  var viewer = p._viewAs ? ops_me_(p._viewAs) : me;
  if (viewer.id !== x.empId && viewer.role < 3) return { error: '體檢表只有本人與管理者可以看' };
  var b = DriveApp.getFileById(x.file).getBlob();
  return { success: true, mime: b.getContentType(), base64: Utilities.base64Encode(b.getBytes()) };
}
function fs_healthDecide_(p) {
  var me = ops_need_(p, 3, true), x = fs_healthRows_().filter(function (r) { return r.id === String(p.id); })[0];
  if (!x) return { error: '找不到' };
  var sh = ops_sheet_('體檢表', FS_HEALTH_HEAD);
  if (p.ok) {
    var exp = String(p.exp || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(exp)) { var d = new Date(x.exam + 'T00:00:00+08:00'); d.setFullYear(d.getFullYear() + 1); exp = Utilities.formatDate(d, 'Asia/Taipei', 'yyyy-MM-dd'); }
    sh.getRange(x.row, 7, 1, 5).setValues([[exp, '已確認', me.name, ops_now_(), String(p.note || '').slice(0, 100)]]);
    var s = ops_staff_().map[x.empId]; if (s) ops_ss_().getSheetByName('夥伴資料').getRange(s.row, 32).setValue(exp);
    OPS_C_.staff = null;
  } else {
    sh.getRange(x.row, 8, 1, 4).setValues([['退回', me.name, ops_now_(), String(p.note || '看不清楚，請重拍').slice(0, 100)]]);
  }
  return { success: true };
}

// ── 4. SOP 教學 ──
var SOP_TYPES = ['開店', '收店', '攪拌麵糊', '烤雞蛋糕'];
function sop_get_() {
  var c = CacheService.getScriptCache(), hit = c.get('sop_all2'); if (hit) return JSON.parse(hit);
  var sh = sop_sheet_(), v = sh.getDataRange().getValues(), out = {};
  SOP_TYPES.forEach(function (t) { out[t] = []; });
  for (var r = 1; r < v.length; r++) {
    var t = String(v[r][0]).trim(); if (!t || /^(否|N|FALSE)$/i.test(String(v[r][5]).trim())) continue;
    (out[t] = out[t] || []).push({ n: Number(v[r][1]) || r, title: String(v[r][2]), desc: String(v[r][3] || ''), img: String(v[r][4] || ''), warn: String(v[r][6] || '') });
  }
  Object.keys(out).forEach(function (k) { out[k].sort(function (a, b) { return a.n - b.n; }); });
  var res = { success: true, data: out, types: Object.keys(out) };
  c.put('sop_all2', JSON.stringify(res), 300);
  return res;
}
function sop_save_(p) {
  ops_need_(p, 3, true);
  var type = String(p.type || '').trim().slice(0, 12); if (!type) return { error: '請填 SOP 名稱' };
  var steps = ops_arr_(p.steps).filter(function (x) { return String(x.title || '').trim(); });
  var sh = sop_sheet_();
  if (!String(sh.getRange(1, 7).getValue()).trim()) sh.getRange(1, 7).setValue('注意事項');
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var v = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues() : [];
    var keep = v.filter(function (r) { return String(r[0]).trim() && String(r[0]).trim() !== type; });
    var add = steps.map(function (x, i) { return [type, i + 1, String(x.title).trim().slice(0, 30), String(x.desc || '').slice(0, 500), String(x.img || '').slice(0, 300), '是', String(x.warn || '').slice(0, 300)]; });
    var rows = keep.concat(add);
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 7).clearContent();
    if (rows.length) sh.getRange(2, 1, rows.length, 7).setValues(rows);
  } finally { lock.releaseLock(); }
  CacheService.getScriptCache().remove('sop_all2'); CacheService.getScriptCache().remove('sop_all');
  return { success: true };
}

// ── 夥伴視角：新增的讀取動作放行 ──
AU_READ = /^(get|check|estimate)|List$|^(annFeed|annOptions|annReaders|buList|opsFranchise|opsMatItems|opsMatMonthly|opsMe|opsOnboard|opsPnl|opsPriceList|opsReceivable|payRecon|pvLiveMine|pvLiveState|pvMe|rpCount|rpMeta|schBoard|schMine|schReconcile|spList|spScene|tdMe|gmMe|gmScene|gmGames|lineGroups|lineQuota|login|fsMeta|fsTemps|fsAudit|fsHealthMine|fsHealthView)$/;

function fsHandler_(action, p) {
  var map = {
    fsMeta: fs_meta_, fsLog: fs_log_, fsTemps: fs_temps_, fsAudit: fs_audit_, fsCertList: fs_certList_, fsCertSave: fs_certSave_,
    fsHealthUpload: fs_healthUpload_, fsHealthMine: fs_healthMine_, fsHealthList: fs_healthList_, fsHealthView: fs_healthView_, fsHealthDecide: fs_healthDecide_,
    sopSave: sop_save_, shipShortage: uo_shipShortage_
  };
  try {
    if (action === 'getSop') return sop_get_();
    if (action === 'getShortages') return uo_getShortages();
    if (action === 'resolveShortage') return uo_resolveShortage(p);
    if (!map[action]) return null;
    return map[action](p);
  } catch (e) { return { error: e.message }; }
}

// 部署後執行一次
function fs_setup() {
  var log = [], ss = ops_ss_();
  // 供貨價格：F 欄常用、新品項
  var sh = ops_sheet_('供貨價格', OPS_PRICE_HEAD);
  if (!String(sh.getRange(1, 5).getValue()).trim()) sh.getRange(1, 5).setValue('分類');
  if (String(sh.getRange(1, 6).getValue()).trim() !== '常用') sh.getRange(1, 6).setValue('常用');
  var rows = ops_rows_(sh, 6).filter(function (r) { return String(r[0]).trim(); }), have = {};
  var hadFav = rows.some(function (r) { return String(r[5] || '').trim(); });   // 還沒人勾過常用 → 套預設
  rows.forEach(function (r) { var n = String(r[0]).trim(); have[n] = 1; if (!String(r[4] || '').trim()) r[4] = rp_catOf_(n) || '其他'; if (!hadFav && FS_FAV_DEFAULT.indexOf(n) >= 0) r[5] = '是'; });
  RP_MAT_CATALOG.forEach(function (c) { c[1].forEach(function (x) { if (x[0] === '其他' || have[x[0]]) return; rows.push([x[0], x[1], '', '單價待補', c[0], FS_FAV_DEFAULT.indexOf(x[0]) >= 0 ? '是' : '']); have[x[0]] = 1; log.push('新增 ' + c[0] + '／' + x[0]); }); });
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 6).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, 6).setValues(rows.map(function (r) { return [r[0], r[1], r[2], r[3], r[4], r[5] || '']; }));
  if (!hadFav) log.push('預設常用：' + FS_FAV_DEFAULT.join('、'));
  // 缺貨看板
  var uo = uo_sheet_(); if (!String(uo.getRange(1, 10).getValue()).trim()) { uo.getRange(1, 10, 1, 2).setValues([['發貨時間', '發貨人']]); log.push('〈缺貨看板〉加發貨時間、發貨人'); }
  // 櫃位設定：冰箱欄
  var ls = ss.getSheetByName('櫃位設定'), h = ls.getRange(1, 1, 1, ls.getLastColumn()).getValues()[0].map(String);
  if (h.indexOf('冰箱') < 0) { ls.getRange(1, ls.getLastColumn() + 1).setValue('冰箱').setNote('這個櫃位的冰箱名稱，多台用逗號分隔，例如：冰箱1,冰箱2。空白＝1 台「冰箱」'); log.push('〈櫃位設定〉加「冰箱」欄'); }
  // 參數
  var ps = ss.getSheetByName('參數設定'), have2 = ps.getDataRange().getValues().map(function (r) { return String(r[0]).trim(); });
  if (have2.indexOf('冰箱溫度下限') < 0) ps.appendRow(['冰箱溫度下限', 0, '°C，打卡時冰箱溫度低於這個值會提醒並開門市回報']);
  if (have2.indexOf('冰箱溫度上限') < 0) ps.appendRow(['冰箱溫度上限', 7, '°C，打卡時冰箱溫度高於這個值會提醒並開門市回報']);
  // 新表
  ops_sheet_('食安紀錄', FS_LOG_HEAD); ops_sheet_('體檢表', FS_HEALTH_HEAD);
  var cs = ops_sheet_('櫃位證照', FS_CERT_HEAD); if (cs.getLastRow() < 2) cs.appendRow([FS_HQ, '', '', '', '', '', '', '', '', '', '', '', '']);
  // SOP：注意事項欄＋新類型範本
  var so = sop_sheet_(); if (!String(so.getRange(1, 7).getValue()).trim()) so.getRange(1, 7).setValue('注意事項');
  var types = so.getLastRow() > 1 ? so.getRange(2, 1, so.getLastRow() - 1, 1).getValues().map(function (r) { return String(r[0]).trim(); }) : [];
  [['攪拌麵糊', '（待隊長補內容）', '隊長用語音講解後，小雲整理成步驟'], ['烤雞蛋糕', '（待隊長補內容）', '隊長用語音講解後，小雲整理成步驟']].forEach(function (x) {
    if (types.indexOf(x[0]) < 0) { so.appendRow([x[0], 1, x[1], x[2], '', '是', '']); log.push('SOP 新增「' + x[0] + '」範本'); }
  });
  CacheService.getScriptCache().removeAll(['fs_quick', 'sop_all', 'sop_all2']);
  Logger.log('fs_setup 完成\n' + log.join('\n'));
  return log;
}

// ═══════════════════════════════════════════════
// 路由 extHandler_ v1.26（2026-11-13）
// 整段貼在「程式碼.gs」最底部即可（Apps Script 以檔案中最後一個同名函式為準，不必改原本那一個）。
// 與 v1.25 路由的差別：rpHandler_ 之後加 fsHandler_（食安、補貨看板發貨、SOP 編輯、常用物料）。其餘不變。
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

// ═══════════════════════════════════════════════
// v1.27 赤心幣加倍規則＋塔防新積分＋樂園「赤心幣規則」＋首頁「今天要處理」（2026-11-13）
// 貼在「食安SOP v1.26」之後、「路由v1.27」之前。部署後執行一次 gm27_setup()
// 1. 工時幣：每小時 1 枚 × 階層加成（Lv.1～5：1／1.2／1.3／1.4／1.5）× 每一個符合的加倍事件（全部相乘）
//    事件：生日當月 ×2、活動場次 ×2、春節 ×3、國定假日 ×2、颱風日 ×2、接班／代班 ×1.5、到職週年當月 ×1.5、
//          品牌週年日 ×2、帶新人 ×1.2、管理者手動加倍活動（〈加倍活動〉表：颱風照常營業、開幕、旺季…）
//    全勤之星 +50（原本就有）；食安確實 +30（當月上下班冰箱溫度、儀容都有填，每月 1 日結算）
// 2. 塔防：本週積分＝營業額 1 元 1 分＋捐獻 1 枚 100 分；每週一結算；累積總分每 50 萬分升 1 級（只升不降）；
//    捐獻要自己選櫃位（最近 30 天上過班的百貨櫃位）
// 覆蓋：gm_payHours_、td_myCounter_、td_simulate_、td_weekly_、td_me_、td_give_
// ═══════════════════════════════════════════════

var GM27_PARAMS = [
  ['生日月工時倍率', 2, '壽星生日所在月份的工時加倍'],
  ['春節工時倍率', 3, '春節期間上班的工時倍率'],
  ['春節期間', '2027-02-05~2027-02-10', '除夕～初五，格式 yyyy-MM-dd~yyyy-MM-dd，多段用逗號分隔'],
  ['國定假日工時倍率', 2, '〈行事曆設定〉國定假日上班'],
  ['颱風日工時倍率', 2, '〈行事曆設定〉颱風日照常營業'],
  ['代班工時倍率', 1.5, '接別人轉讓、釋出的班或開放空班（已核准）'],
  ['到職週年工時倍率', 1.5, '到職滿 1 年起，每年到職月份'],
  ['品牌週年工時倍率', 2, '品牌週年日當天'],
  ['帶新人工時倍率', 1.2, '和到職未滿「新人天數」的夥伴同一天同櫃位上班'],
  ['新人天數', 30, ''],
  ['食安確實獎勵', 30, '當月上下班冰箱溫度、儀容勾選全部完成，每月 1 日結算上月'],
  ['塔防營業額積分倍率', 1, '本週營業額 1 元＝幾分'],
  ['塔防捐獻積分倍率', 100, '捐 1 枚赤心幣＝幾分'],
  ['塔防升級分數', 500000, '累積總分每多少分升 1 級']
];
GM27_PARAMS.forEach(function (p) { GM_PARAM_DEFAULTS.push(p); });
var GM27_ROLE = { 1: 1, 2: 1.2, 3: 1.3, 4: 1.4, 5: 1.5 };
var GM27_BOOST_HEAD = ['名稱', '開始日', '結束日', '櫃位', '倍率', '建立人', '建立時間'];

function gm27_n_(name, def) { var v = Number(gm_param_(name)); return isFinite(v) && v > 0 ? v : def; }
function gm27_roleMult_(role) { var r = Math.min(5, Math.max(1, Number(role) || 1)); return gm27_n_('工時倍率_' + r, GM27_ROLE[r]); }
function gm27_ymd_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Taipei', 'yyyy-MM-dd');
  var s = String(v || '').trim(); if (!s) return '';
  var p = s.split(/[\/\-.]/); if (p.length < 3) return '';
  var y = Number(p[0]); if (y < 1911) y += 1911;
  return y + '-' + ('0' + Number(p[1])).slice(-2) + '-' + ('0' + Number(p[2])).slice(-2);
}
function gm27_ranges_(s) {
  return String(s || '').split(/[,，]/).map(function (x) { var a = x.split(/[~～]/); return { from: gm27_ymd_(a[0]), to: gm27_ymd_(a[1] || a[0]) }; }).filter(function (r) { return r.from; });
}
function gm27_boostSheet_() {
  var ss = gm_ss_(), sh = ss.getSheetByName('加倍活動');
  if (!sh) { sh = ss.insertSheet('加倍活動'); sh.getRange(1, 1, 1, GM27_BOOST_HEAD.length).setValues([GM27_BOOST_HEAD]); sh.setFrozenRows(1); }
  return sh;
}
function gm27_boosts_() {
  if (GM_CACHE_.boosts) return GM_CACHE_.boosts;
  var sh = gm27_boostSheet_(), out = [];
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, GM27_BOOST_HEAD.length).getValues().forEach(function (r, i) {
    var from = gm27_ymd_(r[1]), m = Number(r[4]); if (!String(r[0]).trim() || !from || !(m > 0)) return;
    out.push({ row: i + 2, name: String(r[0]).trim(), from: from, to: gm27_ymd_(r[2]) || from, loc: String(r[3] || '').trim(), mult: m, by: String(r[5] || '') });
  });
  return (GM_CACHE_.boosts = out);
}

// 準備：判斷加倍事件需要的資料（一次讀完）
function gm27_ctx_() {
  if (GM_CACHE_.g27) return GM_CACHE_.g27;
  var emps = gm_emps_(), act = gm_activityLocs_(), cal = {}, swaps = {}, newbies = {}, byDateLoc = {};
  try {
    var sh = gm_ss_().getSheetByName('行事曆設定');
    if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) {
      var d = gm27_ymd_(r[0]), ty = String(r[1]); if (!d) return;
      if (/颱風/.test(ty)) cal[d] = '颱風'; else if (/國定/.test(ty) && cal[d] !== '颱風') cal[d] = '國定';
    });
  } catch (e) {}
  try { if (typeof sch_reqs_ === 'function') sch_reqs_().forEach(function (q) { if (q.status === '已核准' && q.toId) swaps[q.toId + '|' + q.date] = 1; }); } catch (e) {}
  var nd = gm27_n_('新人天數', 30);
  Object.keys(emps).forEach(function (id) { var s = gm27_ymd_(emps[id].start); if (s) newbies[id] = s; });
  gm_rows_('hours').forEach(function (r) { var k = String(r[0]) + '|' + r[2]; (byDateLoc[k] = byDateLoc[k] || []).push(String(r[1])); });
  return (GM_CACHE_.g27 = { emps: emps, act: act, cal: cal, swaps: swaps, newbies: newbies, newDays: nd, byDateLoc: byDateLoc,
    spring: gm27_ranges_(gm_param_('春節期間')), brand: String(gm_param_('品牌週年日') || '').trim(), boosts: gm27_boosts_() });
}
function gm27_isNew_(X, id, date) {
  var s = X.newbies[id]; if (!s || s > date) return false;
  return (new Date(date + 'T00:00:00Z') - new Date(s + 'T00:00:00Z')) / 86400000 < X.newDays;
}
// 某人某天某櫃位符合哪些加倍事件 → [{k, name, m}]
function gm27_events_(emp, date, loc, X) {
  X = X || gm27_ctx_();
  var e = X.emps[emp] || {}, out = [], md = date.slice(5), mm = date.slice(5, 7);
  var bd = e.birthday ? gm_bdMD_(e.birthday) : '';
  if (bd && bd.slice(0, 2) === mm) out.push({ k: 'bday', name: '🎂 生日月', m: gm27_n_('生日月工時倍率', 2) });
  if (loc && (X.act[loc] || /^00|^66/.test(loc))) out.push({ k: 'act', name: '🎪 活動場次', m: gm27_n_('活動工時倍率', 2) });
  if (X.spring.some(function (r) { return date >= r.from && date <= r.to; })) out.push({ k: 'spring', name: '🧧 春節', m: gm27_n_('春節工時倍率', 3) });
  if (X.cal[date] === '國定') out.push({ k: 'holiday', name: '🎌 國定假日', m: gm27_n_('國定假日工時倍率', 2) });
  if (X.cal[date] === '颱風') out.push({ k: 'typhoon', name: '🌀 颱風日', m: gm27_n_('颱風日工時倍率', 2) });
  if (X.swaps[emp + '|' + date]) out.push({ k: 'swap', name: '🙋 代班', m: gm27_n_('代班工時倍率', 1.5) });
  var st = X.newbies[emp];
  if (st && st.slice(5, 7) === mm && st.slice(0, 4) < date.slice(0, 4)) out.push({ k: 'anniv', name: '🎉 到職週年月', m: gm27_n_('到職週年工時倍率', 1.5) });
  if (X.brand && X.brand.slice(-5) === md) out.push({ k: 'brand', name: '🔴 品牌週年日', m: gm27_n_('品牌週年工時倍率', 2) });
  if (loc && !gm27_isNew_(X, emp, date) && (X.byDateLoc[date + '|' + loc] || []).some(function (o) { return o !== emp && gm27_isNew_(X, o, date); }))
    out.push({ k: 'mentor', name: '👩‍🏫 帶新人', m: gm27_n_('帶新人工時倍率', 1.2) });
  X.boosts.forEach(function (b, i) {
    if (date >= b.from && date <= b.to && (!b.loc || b.loc === loc || (loc && loc.replace(/^\d+/, '').indexOf(b.loc.replace(/^\d+/, '')) >= 0)))
      out.push({ k: 'boost' + i, name: '⚡ ' + b.name, m: b.mult });
  });
  return out;
}
function gm27_mult_(ev) { return ev.reduce(function (a, x) { return a * x.m; }, 1); }

// 工時幣（覆蓋）：分鐘 × 事件倍率相乘 × 階層加成 ÷ 60，累計後補發差額（不倒扣）
function gm_payHours_(runDate) {
  var start = gm_param_('測試版開始日'), X = gm27_ctx_(), w = {}, yday = gm_addDays_(runDate, -1), note = {};
  gm_rows_('hours').forEach(function (r) {
    var d = String(r[0]); if (d < start) return;
    var emp = String(r[1]), loc = String(r[2]), min = Number(r[3]) || 0, ev = gm27_events_(emp, d, loc, X);
    w[emp] = (w[emp] || 0) + min * gm27_mult_(ev);
    if (d === yday) (note[emp] = note[emp] || []).push({ loc: loc, min: min, ev: ev });
  });
  var paid = {};
  gm_rows_('ledger').forEach(function (r) { if (r[2] === '工時') paid[r[1]] = (paid[r[1]] || 0) + (Number(r[3]) || 0); });
  Object.keys(w).forEach(function (emp) {
    var e = gm_emp_(emp); if (!e || e.resigned) return;
    var rm = gm27_roleMult_(e.role), due = Math.floor(w[emp] * rm / 60), diff = due - (paid[emp] || 0);
    if (diff <= 0) return;
    var parts = (note[emp] || []).map(function (x) {
      return Math.round(x.min / 6) / 10 + 'h' + (rm !== 1 ? ' × Lv.' + e.role + ' ' + rm : '') + x.ev.map(function (v) { return ' × ' + v.name + ' ' + v.m; }).join('');
    });
    gm_credit_(emp, '工時', diff, '工時結算至 ' + yday + (parts.length ? '：' + parts.join('；') : ''), 'HOURS|' + emp + '|' + runDate);
  });
  try { gm27_monthly_(runDate); } catch (e) {}
}

// 每月 1 日：食安確實獎勵（上月每次上班都有填冰箱溫度＋儀容 4 項、每次下班都有填冰箱溫度）
function gm27_monthly_(runDate) {
  var ym = gm_prevMonth_(runDate.slice(0, 7)); if (runDate.slice(8) > '07') return;   // 1～7 日內補跑
  var fs = gm_ss_().getSheetByName('食安紀錄'); if (!fs || fs.getLastRow() < 2) return;
  if (ym < String(gm_param_('測試版開始日')).slice(0, 7)) return;
  var have = {};
  fs.getRange(2, 1, fs.getLastRow() - 1, 10).getValues().forEach(function (r) {
    var d = String(r[2]).slice(0, 10); if (d.slice(0, 7) !== ym) return;
    var groom = []; try { groom = JSON.parse(r[9] || '[]'); } catch (e) {}
    var ok = String(r[6]) === '下班' || groom.length >= 4, k = r[4] + '|' + d + '|' + r[6];
    have[k] = (have[k] || 0) + (ok ? 1 : 0);
  });
  var need = {}, fsStart = String(gm_getState_('食安開始日') || '');
  gm_punchRows_().forEach(function (p) {
    if (p.date.slice(0, 7) !== ym || (fsStart && p.date < fsStart) || (p.type !== '上班' && p.type !== '下班')) return;
    var k = p.emp + '|' + p.date + '|' + p.type; need[k] = (need[k] || 0) + 1;
  });
  var byEmp = {};
  Object.keys(need).forEach(function (k) { var emp = k.split('|')[0]; if (byEmp[emp] === false) return; byEmp[emp] = (have[k] || 0) >= need[k]; });
  var amt = gm27_n_('食安確實獎勵', 30);
  Object.keys(byEmp).forEach(function (emp) { if (byEmp[emp] && !gm_isFrozen_(emp)) gm_credit_(emp, '食安確實', amt, ym + ' 冰箱溫度、儀容都確實填寫', 'FSOK|' + emp + '|' + ym); });
}

// ── 塔防（覆蓋）──
function td_myCounters_(emp) {     // 最近 30 天上過班的百貨櫃位（時數多的在前）
  var list = td_counters_(), since = gm_addDays_(gm_today_(), -30), m = {};
  gm_rows_('hours').forEach(function (r) { if (r[1] === emp && String(r[0]) >= since && list.indexOf(r[2]) >= 0) m[r[2]] = (m[r[2]] || 0) + (Number(r[3]) || 0); });
  return Object.keys(m).sort(function (a, b) { return m[b] - m[a]; });
}
function td_myCounter_(emp) { return td_myCounters_(emp)[0] || ''; }
function td_gives_(loc, from, to) {
  var s = 0; pv_rows_('tdGive').forEach(function (r) {
    var d = gm_dstr_(r[0]) || String(r[0]).slice(0, 10);
    if (String(r[2]) === loc && (!from || d >= from) && (!to || d <= to)) s += Number(r[4]) || 0;
  }); return s;
}
function td_score_(loc, from, to) {
  var rev = td_revenue_(loc, from, to), give = td_gives_(loc, from, to);
  var rs = Math.round(rev * pv_param_('塔防營業額積分倍率')), gs = Math.round(give * pv_param_('塔防捐獻積分倍率'));
  return { rev: rev, give: give, revScore: rs, giveScore: gs, score: rs + gs };
}
function td_level_(loc, upto) {
  var t = td_score_(loc, gm_param_('測試版開始日'), upto), step = pv_param_('塔防升級分數') || 500000;
  var lv = Math.floor(t.score / step) + 1;
  return { total: t.score, level: lv, toNext: lv * step - t.score, step: step };
}
function td_simulate_(from, to) {        // 輸贏以本週積分為準；動畫戰力由積分換算
  var teams = td_counters_().map(function (l) {
    var sc = td_score_(l, from, to), T = td_tower_(l);
    return { loc: l, sc: sc, rev: sc.score, T: T, p: { atk: 20 + Math.floor(sc.score / 2000), def: 10 + T.wall * 2, hp: 1000 + Math.floor(sc.score / 200) } };
  }).sort(function (a, b) { return b.sc.score - a.sc.score; });
  var matches = [];
  for (var i = 0; i < teams.length; i++) for (var j = i + 1; j < teams.length; j++) {
    var res = td_battle_(teams[i], teams[j], gm_hash_(from + teams[i].loc + teams[j].loc) % 100000);
    var win = teams[i].sc.score === teams[j].sc.score ? (res.winner === 'A' ? teams[i] : teams[j]) : teams[i];   // 積分高的贏
    matches.push({ a: teams[i].loc, b: teams[j].loc, winner: win.loc, waves: res.waves, hpA: teams[i].p.hp, hpB: teams[j].p.hp });
  }
  var standings = teams.map(function (t, k) {
    var lv = td_level_(t.loc, to);
    return { loc: t.loc, rank: k + 1, score: t.sc.score, revScore: t.sc.revScore, giveScore: t.sc.giveScore, rev: t.sc.rev, give: t.sc.give, level: lv.level, total: lv.total, toNext: lv.toNext, pts: t.sc.score };
  });
  return { standings: standings, matches: matches };
}
function td_weekly_(today) {
  if (((new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7) !== 0) return;
  var last = td_weekRange_(gm_addDays_(today, -1)), key = last.from;
  if (gm_getState_('塔防已結算') === key || last.to < gm_param_('測試版開始日')) return;
  var R = td_simulate_(last.from, last.to);
  R.matches.forEach(function (m) { pv_append_('tdLog', [[key, m.a, m.b, m.winner, JSON.stringify(m.waves)]]); });
  if (R.standings.length && R.standings[0].score > 0) {
    var champ = R.standings[0].loc, mins = {}, tot = 0, pool = pv_param_('塔防冠軍獎勵');
    gm_rows_('hours').forEach(function (r) { if (r[2] === champ && String(r[0]) >= last.from && String(r[0]) <= last.to) { mins[r[1]] = (mins[r[1]] || 0) + (Number(r[3]) || 0); tot += Number(r[3]) || 0; } });
    if (tot) Object.keys(mins).forEach(function (emp) { if (!gm_isFrozen_(emp)) gm_credit_(emp, '塔防冠軍', Math.round(pool * mins[emp] / tot), key + ' 週塔防冠軍 ' + champ + '（' + R.standings[0].score + ' 分）', 'TDCHAMP|' + emp + '|' + key); });
    gm_setState_('塔防冠軍_' + key, champ);
    gm_setState_('塔防戰報_' + key, JSON.stringify(R.standings.map(function (s) { return [s.loc, s.score, s.revScore, s.giveScore]; })));
  }
  gm_setState_('塔防已結算', key);
}
function td_me_(p) {
  var emp = String(p.empId || '').trim(); if (!gm_emp_(emp)) return { error: '找不到此帳號' };
  var today = gm_today_(), wk = td_weekRange_(today), mine = td_myCounters_(emp);
  var live = td_simulate_(wk.from, today);
  var last = td_weekRange_(gm_addDays_(wk.from, -1)), logs = pv_rows_('tdLog').filter(function (r) { return String(r[0]) === last.from; })
    .map(function (r) { return { a: r[1], b: r[2], winner: r[3], waves: pv_json_(r[4], []) }; });
  var lastBoard = []; try { lastBoard = JSON.parse(gm_getState_('塔防戰報_' + last.from) || '[]').map(function (x) { return { loc: x[0], score: x[1], revScore: x[2], giveScore: x[3] }; }); } catch (e) {}
  return { success: true, data: { myCounters: mine, myCounter: mine[0] || '', week: wk, standings: live.standings, preview: live.matches,
    lastWeek: { from: last.from, champion: gm_getState_('塔防冠軍_' + last.from), matches: logs, board: lastBoard },
    rule: { rev: pv_param_('塔防營業額積分倍率'), give: pv_param_('塔防捐獻積分倍率'), step: pv_param_('塔防升級分數'), pool: pv_param_('塔防冠軍獎勵') },
    balance: gm_balance_(emp) } };
}
function td_give_(p) {
  var emp = String(p.empId || '').trim(), amt = Math.floor(Number(p.amount) || 0);
  if (!gm_emp_(emp) || gm_isFrozen_(emp)) return { error: '帳號無法使用' };
  var mine = td_myCounters_(emp); if (!mine.length) return { error: '最近 30 天沒有在百貨櫃位上班，無法捐獻' };
  var loc = String(p.loc || '').trim() || mine[0];
  if (mine.indexOf(loc) < 0) return { error: '只能捐給最近 30 天上過班的百貨櫃位' };
  var minAmt = Number(gm_param_('捐獻最低')) || 10;
  if (amt < minAmt) return { error: '一次至少捐 ' + minAmt + ' 枚' };
  if (gm_balance_(emp) < amt) return { error: '赤心幣不足' };
  var kind = ['arrow', 'cannon', 'wall'].indexOf(String(p.tower)) >= 0 ? String(p.tower) : 'arrow';
  var T = td_tower_(loc); T[kind] = (T[kind] || 1); T.total += amt;
  gm_credit_(emp, '塔防捐獻', -amt, '捐給 ' + loc + '（+' + amt * pv_param_('塔防捐獻積分倍率') + ' 分）', 'TDGIVE|' + emp + '|' + gm_now_() + '|' + Math.random());
  pv_append_('tdGive', [[gm_now_(), emp, loc, kind, amt]]);
  var row = [loc, T.arrow, T.cannon, T.wall, T.total];
  if (T.row) { var rng = pv_sh_('towers').getRange(T.row, 1, 1, 5); rng.setNumberFormat('@'); rng.setValues([row]); GM_CACHE_.rows_pv_towers = null; } else pv_append_('towers', [row]);
  GM_CACHE_.rows_pv_tdGive = null;
  var wk = td_weekRange_(gm_today_()), sc = td_score_(loc, wk.from, gm_today_());
  return { success: true, data: { loc: loc, added: amt * pv_param_('塔防捐獻積分倍率'), score: sc.score, balance: gm_balance_(emp) } };
}

// ── 樂園：赤心幣規則（含「你現在套用中」）──
function gm27_rules_(p) {
  var emp = String(p.empId || '').trim(), e = gm_emp_(emp); if (!e) return { error: '找不到此帳號' };
  var today = gm_today_(), X = gm27_ctx_(), loc = String(p.loc || '');
  var mine = gm27_events_(emp, today, loc, X).filter(function (x) { return x.k !== 'act' || loc; });
  var month = []; var bd = e.birthday ? gm_bdMD_(e.birthday) : '';
  var boostsNow = X.boosts.filter(function (b) { return b.to >= today; }).map(function (b) { return { name: b.name, from: b.from, to: b.to, loc: b.loc, mult: b.mult }; });
  var events = [
    ['🎂 生日當月', '生日月工時倍率', '自動：生日那個月的所有工時'],
    ['🎪 活動場次', '活動工時倍率', '自動：在活動場次上班'],
    ['🧧 春節', '春節工時倍率', '自動：' + (String(gm_param_('春節期間') || '').replace(/~/g, '～') || '除夕～初五')],
    ['🎌 國定假日', '國定假日工時倍率', '自動：行事曆的國定假日'],
    ['🌀 颱風日', '颱風日工時倍率', '自動：行事曆的颱風日照常營業'],
    ['🙋 代班', '代班工時倍率', '自動：接別人釋出的班或開放空班（已核准）'],
    ['🎉 到職週年月', '到職週年工時倍率', '自動：到職滿 1 年起，每年到職的那個月'],
    ['🔴 品牌週年日', '品牌週年工時倍率', '自動：' + (String(gm_param_('品牌週年日') || '').replace('-', '/') || '（日期待公布）')],
    ['👩‍🏫 帶新人', '帶新人工時倍率', '自動：和到職未滿 ' + gm27_n_('新人天數', 30) + ' 天的夥伴同一天同櫃位上班']
  ].map(function (x) { return { name: x[0], mult: gm27_n_(x[1], 1), how: x[2] }; });
  var roles = [1, 2, 3, 4, 5].map(function (r) { return { role: r, mult: gm27_roleMult_(r) }; });
  var badges = (typeof GM_BADGES !== 'undefined' ? GM_BADGES : []).filter(function (b) { return Number(b[4]) > 0; }).map(function (b) { return { name: b[1], icon: b[2], how: b[3], coins: Number(b[4]) }; });
  return { success: true, data: {
    me: { role: e.role, roleMult: gm27_roleMult_(e.role), now: mine.map(function (x) { return { name: x.name, mult: x.m }; }), bdayMonth: bd ? Number(bd.slice(0, 2)) : 0 },
    roles: roles, events: events, boosts: boostsNow,
    once: [
      { name: '📝 每日一題答對', coins: gm27_n_('每日一題獎勵', 1), how: '每天一題；連續答對 7 天再 +' + gm27_n_('連續答對7天加碼', 5) },
      { name: '⭐ 全勤之星', coins: 50, how: '當月排班全部出勤、沒有遲到' },
      { name: '🧊 食安確實', coins: gm27_n_('食安確實獎勵', 30), how: '當月每次上下班都有填冰箱溫度、上班都有勾儀容' },
      { name: '🎂 生日', coins: gm27_n_('壽星獎勵', 30), how: '生日當天' },
      { name: '💌 送生日祝福', coins: gm27_n_('送祝福獎勵', 1), how: '每天最多 3 次' },
      { name: '🌟 本月互動之星', coins: gm27_n_('互動之星獎勵', 200), how: '每月 1 日結算' },
      { name: '🏆 月營業額冠軍櫃位', coins: gm27_n_('冠軍櫃位總獎勵', 500), how: '全櫃位夥伴依上班時數分' },
      { name: '🏰 塔防週冠軍', coins: pv_param_('塔防冠軍獎勵'), how: '每週一結算，依上班時數分' }
    ],
    badges: badges,
    spend: [
      { name: '服裝商店', how: '普通 10～30、稀有 50～100、傳說 200～400' },
      { name: '扭蛋機', how: gm27_n_('扭蛋價格', 50) + ' 枚一次，每月最多 ' + gm27_n_('扭蛋每月上限', 5) + ' 次，機率公開' },
      { name: '寵物配件', how: '第一隻寵物免費' },
      { name: '塔防捐獻', how: '1 枚＝' + pv_param_('塔防捐獻積分倍率') + ' 分，幫自己的百貨櫃位衝分' },
      { name: '團隊基金', how: '一次至少 ' + gm27_n_('捐獻最低', 10) + ' 枚，解鎖辦公室新場景' },
      { name: '夥伴商店街', how: '買禮物、寵物零食、裝備；開店費 100 枚' }
    ],
    principles: ['赤心幣是福利性質的遊戲點數，不能換現金', '不能轉給其他夥伴（只能捐團隊基金、塔防）', '和薪資、考核無關', '沒有扣幣處罰，徽章不會被收回', '管理者補發或更正都要填理由，留紀錄'],
    balance: gm_balance_(emp)
  } };
}
// 加倍活動（管理者手動）
function gm27_boostList_(p) { return { success: true, data: gm27_boosts_().map(function (b) { return { row: b.row, name: b.name, from: b.from, to: b.to, loc: b.loc, mult: b.mult, by: b.by }; }) }; }
function gm27_boostSave_(p) {
  var me = gm_emp_(p.empId); if (!me || me.role < 3) return { error: '需要 Lv.3 以上' };
  var name = String(p.name || '').trim().slice(0, 20), from = gm27_ymd_(p.from), to = gm27_ymd_(p.to) || from, m = Number(p.mult);
  if (!name || !from) return { error: '請填名稱和日期' };
  if (!(m > 1 && m <= 5)) return { error: '倍率要在 1～5 之間' };
  if (to < from) return { error: '結束日不能早於開始日' };
  gm27_boostSheet_().appendRow([name, from, to, String(p.loc || '').trim(), m, me.name, gm_now_()]);
  GM_CACHE_.boosts = null; GM_CACHE_.g27 = null;
  return { success: true };
}
function gm27_boostDel_(p) {
  var me = gm_emp_(p.empId); if (!me || me.role < 3) return { error: '需要 Lv.3 以上' };
  var row = Number(p.row); if (!(row >= 2)) return { error: '找不到' };
  gm27_boostSheet_().deleteRow(row); GM_CACHE_.boosts = null; GM_CACHE_.g27 = null;
  return { success: true };
}

// ── 首頁「今天要處理」──
function gm27_todo_(p) {
  var me = ops_me_(p.empId), out = [], today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
  var add = function (icon, text, tab, red) { out.push({ icon: icon, text: text, tab: tab || '', red: !!red }); };
  try { var h = fs_checkup_(me.raw); if (h.status === '過期' || h.status === '未上傳') add('🩺', '健康檢查' + (h.status === '過期' ? '已過期' : '還沒上傳') + '，請上傳新的體檢表', 'health', true); else if (h.status === '即將到期') add('🩺', '健康檢查 ' + h.exp + ' 到期，記得去做新的', 'health'); } catch (e) {}
  if (me.role >= 2) {
    try { var rc = rp_count_({ empId: me.id }); if (rc && rc.pending) add('🛠', '門市回報待處理 ' + rc.pending + ' 件' + (rc.urgent ? '（' + rc.urgent + ' 件緊急）' : ''), 'rp', rc.urgent > 0); } catch (e) {}
    try {
      var mine = ops_myLocs_(me), bad = ops_rows_(ops_sheet_('食安紀錄', FS_LOG_HEAD), 10).filter(function (r) { return String(r[2]) === today && String(r[8]) === '是' && (me.role >= 3 || mine.indexOf(String(r[3])) >= 0); });
      if (bad.length) add('🧊', '今天有 ' + bad.length + ' 筆冰箱溫度異常', 'foodsafe', true);
    } catch (e) {}
    try { var sr = sch_reqs_().filter(function (q) { return /待.*核准|待分隊長/.test(q.status) && (me.role >= 3 || ops_myLocs_(me).indexOf(q.loc) >= 0); }); if (sr.length) add('🔁', '換班／認領待核准 ' + sr.length + ' 件', 'schedule_mgr'); } catch (e) {}
  }
  if (me.role >= 3) {
    try { var hp = fs_healthRows_().filter(function (x) { return x.status === '待確認'; }).length; if (hp) add('🩺', '體檢表待確認 ' + hp + ' 份', 'foodsafe'); } catch (e) {}
    try {
      var lim = Utilities.formatDate(new Date(Date.now() + 30 * 86400000), 'Asia/Taipei', 'yyyy-MM-dd'), all = fs_certRows_();
      Object.keys(all).forEach(function (k) { var c = all[k]; [['plExp', '產品責任險'], ['paExp', '公共意外險']].forEach(function (x) { if (c[x[0]] && c[x[0]] <= lim) add('📄', k + ' ' + x[1] + (c[x[0]] < today ? '已過期' : ' ' + c[x[0]] + ' 到期'), 'foodsafe', c[x[0]] < today); }); });
    } catch (e) {}
    try { var om = ops_meInfo_({ empId: me.id }); if (om && om.matPending) add('📦', '叫貨單待處理 ' + om.matPending + ' 張', 'mat'); } catch (e) {}
  }
  return { success: true, data: out };
}

AU_READ = /^(get|check|estimate)|List$|^(annFeed|annOptions|annReaders|buList|opsFranchise|opsMatItems|opsMatMonthly|opsMe|opsOnboard|opsPnl|opsPriceList|opsReceivable|payRecon|pvLiveMine|pvLiveState|pvMe|rpCount|rpMeta|schBoard|schMine|schReconcile|spList|spScene|tdMe|gmMe|gmScene|gmGames|lineGroups|lineQuota|login|fsMeta|fsTemps|fsAudit|fsHealthMine|fsHealthView|gmRules|gmBoostList|homeTodo)$/;

function gm27Handler_(action, p) {
  var map = { gmRules: gm27_rules_, gmBoostList: gm27_boostList_, gmBoostSave: gm27_boostSave_, gmBoostDel: gm27_boostDel_, homeTodo: gm27_todo_ };
  if (!map[action]) return null;
  try { GM_CACHE_ = {}; return map[action](p); } catch (e) { return { error: e.message }; }
}

function gm27_setup() {
  var sh = gm_sh_('params'), v = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues() : [], have = {}, log = [];
  v.forEach(function (r, i) { have[String(r[0]).trim()] = i + 2; });
  // 階層加成：Lv.2～5 依序 1.2～1.5（隊長 11/12）
  [['工時倍率_2', 1.2], ['工時倍率_3', 1.3], ['工時倍率_4', 1.4], ['工時倍率_5', 1.5]].forEach(function (x) {
    if (have[x[0]]) sh.getRange(have[x[0]], 2).setValue(x[1]); else sh.appendRow([x[0], x[1], '']);
    log.push(x[0] + '＝' + x[1]);
  });
  GM27_PARAMS.forEach(function (x) { if (!have[x[0]]) { sh.appendRow(x); log.push('新增參數 ' + x[0]); } });
  if (!String(gm_param_('品牌週年日') || '').trim() || have['品牌週年日']) { var r = have['品牌週年日']; if (r && !String(sh.getRange(r, 2).getValue()).trim()) { sh.getRange(r, 2).setValue("'02-02"); log.push('品牌週年日＝02-02'); } }
  gm27_boostSheet_();
  if (!gm_getState_('食安開始日')) gm_setState_('食安開始日', gm_today_());
  GM_CACHE_ = {};
  Logger.log('gm27_setup 完成\n' + log.join('\n'));
  return log;
}

// ═══════════════════════════════════════════════
// 路由 extHandler_ v1.27（2026-11-13）
// 整段貼在「程式碼.gs」最底部即可（Apps Script 以檔案中最後一個同名函式為準，不必改原本那一個）。
// 與 v1.26 路由的差別：fsHandler_ 之後加 gm27Handler_（赤心幣規則、加倍活動、今天要處理）。塔防覆蓋在模組內，路由不用改。
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

// ═══════════════════════════════════════════════
// v1.28 寵物隊伍與寵物市集＋塔防戰報 A～D＋行事曆（2026-11-13）
// 貼在「赤心幣塔防 v1.27」之後、「路由v1.28」之前。部署後執行一次 p28_setup()
// 1. 寵物隊伍：每人最多 5 隻（第 1 隻免費，第 2～5 隻 200／300／400／500），全部跟在身後；「身邊」＝主寵物，其他是「隊伍」
//    賣回系統：蛋 30・雛形 60・嬰兒 90・兒童 130・完全體 180；寵物市集：賣家自訂 100～1,000，成交拿 80%，掛 3 天沒賣出自動收回
//    至少留 1 隻；賣掉的寵物留在自己的圖鑑和相簿
// 2. 塔防：A 每週戰報（首頁公告＋LINE）B 進步獎（比前 4 週平均成長最多 +100）C 櫃位 MVP 徽章 D 等級稱號
// 3. 行事曆：公司「紅玉滿行事曆」（全員看，Lv.3 以上新增修改）＋大隊長個人行事曆（只有大隊長看得到）；與 Google 日曆雙向同步
// 覆蓋：gm_petSyncAll_、gm_petDex_、td_weekly_（加 A～C）、td_simulate_（加 D 稱號）
// ═══════════════════════════════════════════════

var P28_PARAMS = [
  ['寵物上限', 5, '每人最多幾隻寵物'],
  ['寵物價格_2', 200, '第 2 隻'], ['寵物價格_3', 300, '第 3 隻'], ['寵物價格_4', 400, '第 4 隻'], ['寵物價格_5', 500, '第 5 隻'],
  ['寵物回收價', '30,60,90,130,180', '賣回系統：蛋、雛形、嬰兒、兒童、完全體'],
  ['寵物市集最低價', 100, ''], ['寵物市集最高價', 1000, ''], ['寵物市集賣家比例', 0.8, '成交後賣家拿幾成，其餘系統回收'], ['寵物市集天數', 3, '掛賣幾天沒賣出自動收回'],
  ['塔防進步獎', 100, '本週積分比前 4 週平均成長最多的櫃位，依上班時數分'],
  ['塔防等級稱號', '小攤,人氣攤,名店,排隊名店,傳奇櫃位', 'Lv.1、2、3、4、5 以上']
];
P28_PARAMS.forEach(function (p) { GM_PARAM_DEFAULTS.push(p); });
['黑糖', '芝麻'].forEach(function (f) { if (GM_PET_FLAVORS.indexOf(f) < 0) GM_PET_FLAVORS.push(f); });
GM_BADGES.push(['td_mvp', '本週 MVP', '🏅', '櫃位當週上班時數最多', 0, true]);
GM_BADGES.push(['td_progress', '進步之星', '📈', '塔防進步獎的櫃位', 0, true]);
var P28_MKT_HEAD = ['編號', '賣家', '寵物編號', '價格', '狀態', '掛賣時間', '買家', '成交時間'];

// ── 寵物 ──
function p28_n_(k, d) { var v = Number(gm_param_(k)); return isFinite(v) && v > 0 ? v : d; }
function p28_alive_(emp) {     // 身邊＋隊伍（含掛賣中），主寵物在最前
  var out = [];
  gm_rows_('pets').forEach(function (r, i) {
    var st = String(r[8] || '身邊') || '身邊';
    if (r[0] === emp && (st === '身邊' || st === '隊伍' || st === '掛賣')) out.push(gm_petFromRow_(r, i));
  });
  return out.sort(function (a, b) { return (a.status === '身邊' ? 0 : 1) - (b.status === '身邊' ? 0 : 1) || (a.since < b.since ? -1 : 1); });
}
function p28_price_(n) { return n <= 1 ? 0 : p28_n_('寵物價格_' + Math.min(5, n), [0, 0, 200, 300, 400, 500][Math.min(5, n)]); }
function p28_buyback_(stage) { var a = String(gm_param_('寵物回收價') || '30,60,90,130,180').split(',').map(Number); return a[Math.max(0, Math.min(4, stage - 1))] || 30; }
function p28_mktSheet_() {
  var ss = gm_ss_(), sh = ss.getSheetByName('寵物市集');
  if (!sh) { sh = ss.insertSheet('寵物市集'); sh.getRange(1, 1, 1, P28_MKT_HEAD.length).setValues([P28_MKT_HEAD]); sh.setFrozenRows(1); }
  return sh;
}
function p28_mkt_() {
  var sh = p28_mktSheet_(); if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 8).getValues().map(function (r, i) {
    return { row: i + 2, id: String(r[0]), seller: String(r[1]), pet: String(r[2]), price: Number(r[3]) || 0, status: String(r[4]), at: String(r[5]), buyer: String(r[6] || ''), done: String(r[7] || '') };
  }).filter(function (x) { return x.id; });
}
function p28_petRow_(petId) {
  var rows = gm_rows_('pets');
  for (var i = 0; i < rows.length; i++) if (String(rows[i][9]) === String(petId)) return gm_petFromRow_(rows[i], i);
  return null;
}
function p28_expire_() {         // 掛賣超過天數 → 收回
  var days = p28_n_('寵物市集天數', 3), lim = Date.now() - days * 86400000;
  p28_mkt_().forEach(function (m) {
    if (m.status !== '掛賣' || new Date(m.at.replace(' ', 'T') + '+08:00').getTime() > lim) return;
    p28_mktSheet_().getRange(m.row, 5).setValue('收回');
    var pt = p28_petRow_(m.pet); if (pt && pt.status === '掛賣') gm_petSet_(pt.row, 9, ['隊伍']);
  });
}
function p28_ensureMain_(emp) {  // 沒有「身邊」的就把隊伍第一隻升上來
  var a = p28_alive_(emp);
  if (a.length && !a.some(function (x) { return x.status === '身邊'; })) {
    var first = a.filter(function (x) { return x.status === '隊伍'; })[0]; if (first) gm_petSet_(first.row, 9, ['身邊']);
  }
}
function p28_team_(emp) {
  p28_expire_();
  var a = p28_alive_(emp), max = p28_n_('寵物上限', 5), mkt = p28_mkt_();
  return { list: a.map(function (x) {
      var m = mkt.filter(function (k) { return k.pet === x.id && k.status === '掛賣'; })[0];
      return { id: x.id, name: x.name, flavor: x.flavor, type: x.type, typeName: x.typeName, stage: x.stage, stageName: x.stageName, hours: x.hours, nextAt: x.nextAt,
        main: x.status === '身邊', listed: m ? { id: m.id, price: m.price, at: m.at } : null, buyback: p28_buyback_(x.stage) };
    }), max: max, count: a.length, nextPrice: a.length >= max ? null : p28_price_(a.length + 1) };
}
function p28_buyMore_(p) {
  var emp = String(p.empId || '').trim(), e = gm_emp_(emp); if (!e || gm_isFrozen_(emp)) return { error: '帳號無法使用' };
  var a = p28_alive_(emp), max = p28_n_('寵物上限', 5);
  if (!a.length) return gm_petBuy_(p);                                 // 第一隻：原本的免費領養
  if (a.length >= max) return { error: '最多 ' + max + ' 隻，請先賣掉一隻' };
  var price = p28_price_(a.length + 1);
  if (gm_balance_(emp) < price) return { error: '赤心幣不足（需要 ' + price + ' 枚）' };
  var flavor = GM_PET_FLAVORS.concat(['黑糖', '芝麻']).indexOf(p.flavor) >= 0 ? p.flavor : '原味';
  var name = String(p.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 8) || '小雞蛋糕';
  var id = gm_petId_();
  gm_credit_(emp, '寵物', -price, '買第 ' + (a.length + 1) + ' 隻寵物「' + name + '」', 'PETBUY|' + emp + '|' + id);
  gm_append_('pets', [[emp, flavor, name, gm_today_(), '', 0, 1, '', '隊伍', id, '']]);
  gm_petEvent_(emp, 'join', (e.nick || e.name) + ' 的隊伍多了一顆蛋「' + name + '」');
  return { success: true, data: p28_team_(emp), balance: gm_balance_(emp) };
}
function p28_setMain_(p) {
  var emp = String(p.empId || '').trim(), a = p28_alive_(emp), t = a.filter(function (x) { return x.id === String(p.pet); })[0];
  if (!t) return { error: '找不到這隻寵物' };
  if (t.status === '掛賣') return { error: '掛賣中的寵物不能當主寵物' };
  a.forEach(function (x) { if (x.status === '身邊') gm_petSet_(x.row, 9, ['隊伍']); });
  gm_petSet_(t.row, 9, ['身邊']);
  return { success: true, data: p28_team_(emp) };
}
function p28_sellSys_(p) {
  var emp = String(p.empId || '').trim(), a = p28_alive_(emp), t = a.filter(function (x) { return x.id === String(p.pet); })[0];
  if (!t) return { error: '找不到這隻寵物' };
  if (t.status === '掛賣') return { error: '請先從市集收回' };
  if (a.filter(function (x) { return x.status !== '掛賣'; }).length <= 1) return { error: '至少要留 1 隻寵物' };
  gm_petSync_(t);
  var amt = p28_buyback_(t.stage);
  gm_petSet_(t.row, 9, ['已售出']);
  gm_credit_(emp, '寵物回收', amt, '「' + t.name + '」（' + t.stageName + '）賣回系統', 'PETSELL|' + t.id);
  p28_ensureMain_(emp);
  return { success: true, data: p28_team_(emp), got: amt, balance: gm_balance_(emp) };
}
function p28_list_(p) {
  var emp = String(p.empId || '').trim(), a = p28_alive_(emp), t = a.filter(function (x) { return x.id === String(p.pet); })[0];
  if (!t) return { error: '找不到這隻寵物' };
  if (t.status === '掛賣') return { error: '已經在市集上了' };
  if (a.filter(function (x) { return x.status !== '掛賣'; }).length <= 1) return { error: '至少要留 1 隻寵物在身邊' };
  var lo = p28_n_('寵物市集最低價', 100), hi = p28_n_('寵物市集最高價', 1000), price = Math.floor(Number(p.price) || 0);
  if (price < lo || price > hi) return { error: '價格要在 ' + lo + '～' + hi + ' 之間' };
  gm_petSync_(t);
  gm_petSet_(t.row, 9, ['掛賣']);
  p28_mktSheet_().appendRow(['K' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10), emp, t.id, price, '掛賣', gm_now_(), '', '']);
  p28_ensureMain_(emp);
  return { success: true, data: p28_team_(emp) };
}
function p28_unlist_(p) {
  var emp = String(p.empId || '').trim(), m = p28_mkt_().filter(function (k) { return k.id === String(p.id) && k.status === '掛賣'; })[0];
  if (!m || m.seller !== emp) return { error: '找不到這筆掛賣' };
  p28_mktSheet_().getRange(m.row, 5).setValue('收回');
  var pt = p28_petRow_(m.pet); if (pt && pt.status === '掛賣') gm_petSet_(pt.row, 9, ['隊伍']);
  p28_ensureMain_(emp);
  return { success: true, data: p28_team_(emp) };
}
function p28_market_(p) {
  p28_expire_();
  var emps = gm_emps_(), emp = String(p.empId || '');
  return { success: true, data: p28_mkt_().filter(function (m) { return m.status === '掛賣'; }).map(function (m) {
    var pt = p28_petRow_(m.pet), s = emps[m.seller]; if (!pt) return null;
    return { id: m.id, price: m.price, at: m.at, mine: m.seller === emp, seller: s ? (s.nick || s.name) : m.seller,
      pet: { name: pt.name, flavor: pt.flavor, type: pt.type, typeName: pt.typeName, stage: pt.stage, stageName: pt.stageName, hours: pt.hours } };
  }).filter(Boolean).reverse(), sellerShare: Number(gm_param_('寵物市集賣家比例')) || 0.8 };
}
function p28_buyMkt_(p) {
  var emp = String(p.empId || '').trim(), e = gm_emp_(emp); if (!e || gm_isFrozen_(emp)) return { error: '帳號無法使用' };
  p28_expire_();
  var m = p28_mkt_().filter(function (k) { return k.id === String(p.id) && k.status === '掛賣'; })[0];
  if (!m) return { error: '這隻已經被買走或收回了' };
  if (m.seller === emp) return { error: '不能買自己的寵物' };
  if (p28_alive_(emp).length >= p28_n_('寵物上限', 5)) return { error: '你的寵物已經滿 5 隻，請先賣掉一隻' };
  if (gm_balance_(emp) < m.price) return { error: '赤心幣不足' };
  var pt = p28_petRow_(m.pet); if (!pt) return { error: '找不到這隻寵物' };
  var share = Number(gm_param_('寵物市集賣家比例')) || 0.8, get = Math.floor(m.price * share);
  gm_credit_(emp, '寵物市集', -m.price, '買下「' + pt.name + '」', 'MKTBUY|' + m.id);
  if (!gm_isFrozen_(m.seller)) gm_credit_(m.seller, '寵物市集', get, '「' + pt.name + '」賣出 ' + m.price + ' 枚（拿 ' + Math.round(share * 100) + '%）', 'MKTSELL|' + m.id);
  // 賣家留一筆紀錄（圖鑑、相簿用），寵物本身交給買家：保留目前的成長時數，之後依新主人的工時繼續長大
  gm_append_('pets', [[m.seller, pt.flavor, pt.name, pt.since, pt.acc, 0, 1, pt.type, '已售出', pt.id + 'S', pt.hatched]]);
  var bonus = pt.hours;
  gm_petSet_(pt.row, 1, [emp]); gm_petSet_(pt.row, 4, [gm_today_(), '', bonus]);
  gm_petSet_(pt.row, 9, [p28_alive_(emp).some(function (x) { return x.status === '身邊'; }) ? '隊伍' : '身邊']);
  p28_mktSheet_().getRange(m.row, 5, 1, 4).setValues([['成交', m.at, emp, gm_now_()]]);
  gm_petEvent_(emp, 'trade', (e.nick || e.name) + ' 在寵物市集帶回了「' + pt.name + '」');
  return { success: true, data: p28_team_(emp), balance: gm_balance_(emp) };
}
// 覆蓋：孵化檢查擴及隊伍
function gm_petSyncAll_() {
  var rows = gm_rows_('pets').slice();
  rows.forEach(function (r, i) { var st = String(r[8] || '身邊') || '身邊'; if (st === '身邊' || st === '隊伍' || st === '掛賣') gm_petSync_(gm_petFromRow_(r, i)); });
}
// 覆蓋：圖鑑包含賣掉的完全體
function gm_petDex_(emp) {
  var out = [], seen = {};
  gm_rows_('pets').forEach(function (r, i) {
    if (r[0] !== emp) return; var pt = gm_petFromRow_(r, i), id = pt.id.replace(/S$/, '');
    var stage = pt.stage;
    if (pt.status === '已售出') { stage = 0; gm_rows_('album').forEach(function (al) { if (String(al[1]) === id && Number(al[2]) > stage) stage = Number(al[2]); }); }
    if (seen[id]) return;
    if (pt.status === '圖鑑' || stage >= 5) { seen[id] = 1; out.push({ id: id, name: pt.name, type: pt.type, typeName: pt.typeName, flavor: pt.flavor, current: pt.status === '身邊', sold: pt.status === '已售出' }); }
  });
  return out;
}
// 宇宙辦公室：每個人的隊伍（主寵物以外）
function p28_sceneTeams_() {
  var out = {};
  gm_rows_('pets').forEach(function (r, i) {
    var st = String(r[8] || ''); if (st !== '隊伍' && st !== '掛賣') return;
    var pt = gm_petFromRow_(r, i); (out[r[0]] = out[r[0]] || []).push({ flavor: pt.flavor, name: pt.name, stage: pt.stage, type: pt.type, acc: '' });
  });
  return out;
}

// ── 塔防 A～D ──
function td_title_(lv) { var a = String(gm_param_('塔防等級稱號') || '小攤,人氣攤,名店,排隊名店,傳奇櫃位').split(','); return a[Math.min(a.length, Math.max(1, lv)) - 1] || ''; }
function td_weekly_(today) {
  if (((new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7) !== 0) return;
  var last = td_weekRange_(gm_addDays_(today, -1)), key = last.from;
  if (gm_getState_('塔防已結算') === key || last.to < gm_param_('測試版開始日')) return;
  var R = td_simulate_(last.from, last.to);
  R.matches.forEach(function (m) { pv_append_('tdLog', [[key, m.a, m.b, m.winner, JSON.stringify(m.waves)]]); });
  var hrs = function (loc) { var mins = {}, tot = 0; gm_rows_('hours').forEach(function (r) { if (r[2] === loc && String(r[0]) >= last.from && String(r[0]) <= last.to) { mins[r[1]] = (mins[r[1]] || 0) + (Number(r[3]) || 0); tot += Number(r[3]) || 0; } }); return { mins: mins, tot: tot }; };
  var pay = function (loc, pool, kind, label) { var h = hrs(loc); if (h.tot) Object.keys(h.mins).forEach(function (emp) { if (!gm_isFrozen_(emp)) gm_credit_(emp, kind, Math.round(pool * h.mins[emp] / h.tot), key + ' ' + label + ' ' + loc, kind + '|' + emp + '|' + key); }); return h; };
  var champ = '', champCrew = [], prog = null, mvps = [];
  if (R.standings.length && R.standings[0].score > 0) {
    champ = R.standings[0].loc;
    var h = pay(champ, pv_param_('塔防冠軍獎勵'), '塔防冠軍', '週塔防冠軍');
    champCrew = Object.keys(h.mins).map(function (e) { var x = gm_emp_(e); return x ? (x.nick || x.name) : e; });
    gm_setState_('塔防冠軍_' + key, champ);
  }
  // B 進步獎：本週積分 ÷ 前 4 週平均，成長最多的櫃位
  R.standings.forEach(function (s) {
    var sum = 0, n = 0;
    for (var w = 1; w <= 4; w++) { var f = gm_addDays_(last.from, -7 * w), t = gm_addDays_(f, 6); if (t < gm_param_('測試版開始日')) continue; sum += td_score_(s.loc, f, t).score; n++; }
    if (!n || !sum) return;
    var g = s.score / (sum / n) - 1;
    if (g > 0 && (!prog || g > prog.g)) prog = { loc: s.loc, g: g };
  });
  if (prog) { var hp = pay(prog.loc, p28_n_('塔防進步獎', 100), '塔防進步獎', '塔防進步獎（+' + Math.round(prog.g * 100) + '%）'); Object.keys(hp.mins).forEach(function (e) { gm_award_(e, 'td_progress', key); }); }
  // C 櫃位 MVP：每個百貨櫃位本週上班時數最多
  R.standings.forEach(function (s) {
    var h = hrs(s.loc), best = '', bm = 0; Object.keys(h.mins).forEach(function (e) { if (h.mins[e] > bm) { bm = h.mins[e]; best = e; } });
    if (best) { gm_award_(best, 'td_mvp', key + '|' + s.loc); var x = gm_emp_(best); mvps.push(String(s.loc).replace(/^\d+/, '') + ' ' + (x ? (x.nick || x.name) : best)); }
  });
  gm_setState_('塔防戰報_' + key, JSON.stringify(R.standings.map(function (s) { return [s.loc, s.score, s.revScore, s.giveScore]; })));
  // A 每週戰報：首頁公告＋LINE
  if (champ) {
    var title = '🏰 上週塔防戰報：' + champ.replace(/^\d+/, '') + ' 奪冠！';
    var body = R.standings.map(function (s, i) { return (['🥇', '🥈', '🥉'][i] || (i + 1) + '.') + ' ' + s.loc.replace(/^\d+/, '') + '　' + s.score.toLocaleString() + ' 分（Lv.' + s.level + ' ' + td_title_(s.level) + '）'; }).join('\n') +
      '\n\n辛苦了！冠軍夥伴：' + (champCrew.join('、') || '—') +
      (prog ? '\n📈 進步獎：' + prog.loc.replace(/^\d+/, '') + '（比前 4 週平均成長 ' + Math.round(prog.g * 100) + '%）' : '') +
      (mvps.length ? '\n🏅 本週 MVP：' + mvps.join('、') : '');
    try {
      var sh = ann_sheet_();
      if (sh) sh.appendRow(['A' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss') + 'TD', title, body, '一般', '否', '系統', Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss'), gm_addDays_(today, 6), '發布', JSON.stringify({ by: 'system', groups: [], target: [] })]);
    } catch (e) {}
    try { if (typeof line_notify_ === 'function') line_notify_('公告', title + '\n\n' + body); } catch (e) {}
  }
  gm_setState_('塔防已結算', key);
}

// ── 行事曆 ──
var CAL_CATS = ['進撤櫃', '快閃', '活動', '會議', '其他'];
function cal_company_() {
  var id = String(gm_param_('公司行事曆ID') || '').trim();
  if (id) { var c = CalendarApp.getCalendarById(id); if (c) return c; }
  var list = CalendarApp.getCalendarsByName('紅玉滿行事曆');
  return list && list.length ? list[0] : null;
}
function cal_personal_() { var id = String(gm_param_('大隊長行事曆ID') || '').trim(); return id ? CalendarApp.getCalendarById(id) : null; }
function cal_cat_(desc) { var m = String(desc || '').match(/分類[:：]\s*(\S+)/); return m && CAL_CATS.indexOf(m[1]) >= 0 ? m[1] : '其他'; }
function cal_ev_(ev, src) {
  var all = ev.isAllDayEvent(), st = ev.getStartTime(), en = ev.getEndTime(), f = function (d, fmt) { return Utilities.formatDate(d, 'Asia/Taipei', fmt); };
  var desc = String(ev.getDescription() || '');
  return { id: ev.getId(), src: src, title: ev.getTitle(), allDay: all, date: f(st, 'yyyy-MM-dd'), end: f(all ? new Date(en.getTime() - 1) : en, 'yyyy-MM-dd'),
    start: all ? '' : f(st, 'HH:mm'), endTime: all ? '' : f(en, 'HH:mm'), loc: String(ev.getLocation() || ''), cat: cal_cat_(desc),
    desc: desc.replace(/\n?分類[:：]\s*\S+/, '').trim() };
}
function cal_isBoss_(emp) { var e = gm_emp_(emp); return !!e && e.role >= 5; }
function cal_list_(p) {
  var emp = String(p.empId || ''), from = gm27_ymd_(p.from) || gm_today_(), to = gm27_ymd_(p.to) || gm_addDays_(from, 41);
  var a = new Date(from + 'T00:00:00+08:00'), b = new Date(to + 'T23:59:59+08:00'), out = [];
  var c = cal_company_(); if (c) c.getEvents(a, b).forEach(function (ev) { out.push(cal_ev_(ev, 'company')); });
  if (cal_isBoss_(emp)) { var pc = cal_personal_(); if (pc) pc.getEvents(a, b).forEach(function (ev) { out.push(cal_ev_(ev, 'personal')); }); }
  out.sort(function (x, y) { return (x.date + x.start) < (y.date + y.start) ? -1 : 1; });
  return { success: true, data: out, cats: CAL_CATS, ready: { company: !!c, personal: cal_isBoss_(emp) ? !!cal_personal_() : null },
    canEdit: (gm_emp_(emp) || {}).role >= 3, isBoss: cal_isBoss_(emp) };
}
function cal_save_(p) {
  var emp = String(p.empId || ''), me = gm_emp_(emp); if (!me || me.role < 3) return { error: '需要 Lv.3 以上' };
  var src = p.src === 'personal' ? 'personal' : 'company';
  if (src === 'personal' && !cal_isBoss_(emp)) return { error: '只有大隊長可以使用個人行事曆' };
  var cal = src === 'personal' ? cal_personal_() : cal_company_(); if (!cal) return { error: src === 'personal' ? '個人行事曆還沒連結（〈遊戲參數〉大隊長行事曆ID）' : '找不到「紅玉滿行事曆」' };
  var title = String(p.title || '').trim().slice(0, 60); if (!title) return { error: '請填標題' };
  var date = gm27_ymd_(p.date), end = gm27_ymd_(p.end) || date; if (!date) return { error: '請選日期' };
  var cat = CAL_CATS.indexOf(p.cat) >= 0 ? p.cat : '其他';
  var desc = (String(p.desc || '').trim().slice(0, 1000) + '\n分類：' + cat).trim(), opt = { description: desc, location: String(p.loc || '').slice(0, 100) };
  var allDay = !p.start, ev;
  var s = allDay ? new Date(date + 'T00:00:00+08:00') : new Date(date + 'T' + p.start + ':00+08:00');
  var e = allDay ? new Date(new Date(end + 'T00:00:00+08:00').getTime() + 86400000) : new Date(end + 'T' + (p.endTime || p.start) + ':00+08:00');
  if (e <= s && !allDay) e = new Date(s.getTime() + 3600000);
  if (p.id) {
    ev = cal.getEventById(String(p.id)); if (!ev) return { error: '找不到這個行程' };
    ev.setTitle(title); ev.setDescription(desc); ev.setLocation(opt.location);
    if (allDay) ev.setAllDayDates(s, e); else ev.setTime(s, e);
  } else ev = allDay ? cal.createAllDayEvent(title, s, e, opt) : cal.createEvent(title, s, e, opt);
  return { success: true, id: ev.getId() };
}
function cal_del_(p) {
  var emp = String(p.empId || ''), me = gm_emp_(emp); if (!me || me.role < 3) return { error: '需要 Lv.3 以上' };
  var src = p.src === 'personal' ? 'personal' : 'company';
  if (src === 'personal' && !cal_isBoss_(emp)) return { error: '只有大隊長可以使用個人行事曆' };
  var cal = src === 'personal' ? cal_personal_() : cal_company_(), ev = cal && cal.getEventById(String(p.id || ''));
  if (!ev) return { error: '找不到這個行程' };
  ev.deleteEvent(); return { success: true };
}
// 每天早上提醒今天的公司行程（LINE，選用）：〈遊戲參數〉行事曆LINE提醒＝是；p28_setup 會建立每天 8 點的觸發
function cal_morningPush() {
  if (!/^(是|Y|TRUE|1)$/i.test(String(gm_param_('行事曆LINE提醒') || ''))) return;
  var c = cal_company_(); if (!c) return;
  var today = gm_today_(), evs = c.getEvents(new Date(today + 'T00:00:00+08:00'), new Date(today + 'T23:59:59+08:00')).map(function (ev) { return cal_ev_(ev, 'company'); });
  if (!evs.length) return;
  try { line_notify_('公告', '📅 今天的行程\n' + evs.map(function (x) { return '・' + (x.start ? x.start + ' ' : '') + '【' + x.cat + '】' + x.title + (x.loc ? '（' + x.loc + '）' : ''); }).join('\n')); } catch (e) {}
}
function cal_todayTodo_(emp) {
  var out = [], today = gm_today_(), tmr = gm_addDays_(today, 1);
  try {
    var r = cal_list_({ empId: emp, from: today, to: tmr });
    r.data.forEach(function (x) { out.push({ icon: x.src === 'personal' ? '🔒' : '📅', text: (x.date === today ? '今天' : '明天') + (x.start ? ' ' + x.start : '') + '【' + x.cat + '】' + x.title, tab: 'calendar', red: false }); });
  } catch (e) {}
  return out;
}

AU_READ = /^(get|check|estimate)|List$|^(annFeed|annOptions|annReaders|buList|opsFranchise|opsMatItems|opsMatMonthly|opsMe|opsOnboard|opsPnl|opsPriceList|opsReceivable|payRecon|pvLiveMine|pvLiveState|pvMe|rpCount|rpMeta|schBoard|schMine|schReconcile|spList|spScene|tdMe|gmMe|gmScene|gmGames|lineGroups|lineQuota|login|fsMeta|fsTemps|fsAudit|fsHealthMine|fsHealthView|gmRules|gmBoostList|homeTodo|gmPetTeam|gmPetMarket|calList)$/;

function p28Handler_(action, p) {
  var map = { gmPetTeam: function (q) { return { success: true, data: p28_team_(String(q.empId || '')) }; }, gmPetBuyMore: p28_buyMore_, gmPetMain: p28_setMain_, gmPetSell: p28_sellSys_,
    gmPetList: p28_list_, gmPetUnlist: p28_unlist_, gmPetMarket: p28_market_, gmPetMarketBuy: p28_buyMkt_, calList: cal_list_, calSave: cal_save_, calDel: cal_del_ };
  if (action === 'gmScene') {           // 加上每個人的隊伍
    try { GM_CACHE_ = {}; var r = gm_scene_(); if (r && r.data) r.data.teams = p28_sceneTeams_(); return r; } catch (e) { return null; }
  }
  if (action === 'homeTodo') {          // 加上今天／明天的行程
    try { var t = gm27_todo_(p); GM_CACHE_ = {}; if (t && t.success) t.data = cal_todayTodo_(String(p.empId || '')).concat(t.data); return t; } catch (e) { return null; }
  }
  if (action === 'tdMe') {              // 加上等級稱號
    try { GM_CACHE_ = {}; var d = td_me_(p); if (d && d.data) d.data.standings.forEach(function (s) { s.title = td_title_(s.level); }); return d; } catch (e) { return null; }
  }
  if (!map[action]) return null;
  var lock = /^(gmPetBuyMore|gmPetMain|gmPetSell|gmPetList|gmPetUnlist|gmPetMarketBuy)$/.test(action) ? LockService.getScriptLock() : null;
  try { if (lock) lock.waitLock(20000); GM_CACHE_ = {}; return map[action](p); }
  catch (e) { return { error: e.message }; }
  finally { if (lock) lock.releaseLock(); }
}

function p28_setup() {
  var sh = gm_sh_('params'), v = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues() : [], have = {}, log = [];
  v.forEach(function (r) { have[String(r[0]).trim()] = 1; });
  P28_PARAMS.concat([['公司行事曆ID', '', '空白＝自動找名為「紅玉滿行事曆」的日曆'], ['大隊長行事曆ID', '', '大隊長個人 Google 日曆共用給公司帳號後，填日曆 ID（通常是 Gmail 地址）'], ['行事曆LINE提醒', '否', '是＝每天早上 8 點把今天的公司行程發到 LINE 公告群組']])
    .forEach(function (x) { if (!have[x[0]]) { sh.appendRow(x); log.push('新增參數 ' + x[0]); } });
  p28_mktSheet_();
  var c = null; try { c = cal_company_(); if (!c) { c = CalendarApp.createCalendar('紅玉滿行事曆', { color: CalendarApp.Color.RED }); log.push('建立 Google 日曆「紅玉滿行事曆」'); } } catch (e) { log.push('日曆：' + e.message); }
  try {
    var has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'cal_morningPush'; });
    if (!has) { ScriptApp.newTrigger('cal_morningPush').timeBased().atHour(8).everyDays(1).inTimezone('Asia/Taipei').create(); log.push('建立每天 8 點行程提醒觸發'); }
  } catch (e) { log.push('觸發：' + e.message); }
  GM_CACHE_ = {};
  Logger.log('p28_setup 完成\n' + log.join('\n'));
  return log;
}

// ═══════════════════════════════════════════════
// v1.29 內帳（2026-11-13）— 只有大隊長（Lv.5）可以用
// 貼在「寵物行事曆 v1.28」之後、「路由v1.29」之前。部署後執行一次 ac_setup()
// 〈內帳〉欄位和「營收總表」一樣：日期、公司、收支、記帳類別、子類別、單位、銷貨金額、稅額、發票金額、備註，另加照片、登記人、登記時間、編號、來源
// 動作：acMeta 類別清單、acList 明細、acSave 記一筆／修改、acDel 刪除、acImport 匯入（重複的自動跳過）、acSummary 損益看板
// 匯出營收總表 Excel 在 App 前端產生（格式和原本一樣）
// ═══════════════════════════════════════════════

var AC_HEAD = ['日期', '公司', '收支', '記帳類別', '子類別', '單位', '銷貨金額', '稅額', '發票金額', '備註', '照片', '登記人', '登記時間', '編號', '來源'];
var AC_COMPANY = ['90011886', '42274298'];
var AC_EXP = ['薪資人事', '通路費用', '食材成本', '租金費用', '政府費用', '生財器具', '交通費用', '包材費用', '物流費用', '輸出費用', '保險費用', '會計費用', '辦公費用', '電信費用', '其他費用', '裝潢費用', '水電費用', '公益捐贈',
  '金融費用', '餐飲費用', '清潔費用', '差旅費用', '通路押金', '系統費用'];
var AC_INC = ['百貨營收', '通路營收', '活動營收', '展覽營收', '技術營收', '加盟營收', '其他營收'];

function ac_need_(p) { var me = ops_me_(p.empId); if (me.role < 5) throw new Error('內帳只有大隊長可以使用'); return me; }
function ac_sheet_() {
  var ss = ops_ss_(), sh = ss.getSheetByName('內帳');
  if (!sh) { sh = ss.insertSheet('內帳'); sh.getRange(1, 1, 1, AC_HEAD.length).setValues([AC_HEAD]); sh.setFrozenRows(1); }
  return sh;
}
function ac_d_(v) { return v instanceof Date ? Utilities.formatDate(v, 'Asia/Taipei', 'yyyy-MM-dd') : String(v || '').slice(0, 10).replace(/\//g, '-'); }
function ac_rows_() {
  var sh = ac_sheet_(); if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, AC_HEAD.length).getValues().map(function (r, i) {
    return { row: i + 2, date: ac_d_(r[0]), co: String(r[1] || ''), io: String(r[2] || ''), cat: String(r[3] || ''), sub: String(r[4] || ''), unit: String(r[5] || ''),
      net: r[6] === '' ? null : Number(r[6]), tax: r[7] === '' ? null : Number(r[7]), amt: Number(r[8]) || 0, note: String(r[9] || ''), photo: String(r[10] || ''),
      by: String(r[11] || ''), at: String(r[12] || ''), id: String(r[13] || ''), src: String(r[14] || '') };
  }).filter(function (x) { return x.date; });
}
function ac_key_(x) { return [x.date, x.io, Math.round(Number(x.amt) || 0), String(x.unit || '').trim(), String(x.note || '').trim()].join('|'); }
function ac_period_(ym) { var y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)), s = m % 2 ? m : m - 1; return { from: y + '-' + ('0' + s).slice(-2) + '-01', to: y + '-' + ('0' + (s + 1)).slice(-2) + '-31', label: (y - 1911) + '年' + s + '-' + (s + 1) + '月' }; }

function ac_meta_(p) { ac_need_(p); return { success: true, data: { companies: AC_COMPANY, exp: AC_EXP, inc: AC_INC } }; }
function ac_list_(p) {
  ac_need_(p);
  var from = ac_d_(p.from) || '0000', to = ac_d_(p.to) || '9999', q = String(p.q || '').trim(), cat = String(p.cat || ''), io = String(p.io || '');
  var list = ac_rows_().filter(function (x) {
    return x.date >= from && x.date <= to && (!cat || x.cat === cat) && (!io || x.io === io) && (!q || (x.unit + x.sub + x.note + x.cat).indexOf(q) >= 0);
  }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.row - b.row; });
  return { success: true, data: list };
}
function ac_clean_(x) {
  var date = ac_d_(x.date); if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: '日期格式不對' };
  var io = x.io === '收入' ? '收入' : '支出', amt = Math.round(Number(x.amt) * 100) / 100;
  if (!isFinite(amt) || amt === 0) return { error: '請填發票金額' };
  var net = x.net === '' || x.net == null ? '' : Number(x.net), tax = x.tax === '' || x.tax == null ? '' : Number(x.tax);
  if (x.autoTax && net === '' && tax === '') { net = Math.round(amt / 1.05); tax = amt - net; }
  return { v: [date, String(x.co || AC_COMPANY[0]).slice(0, 10), io, String(x.cat || '').slice(0, 10), String(x.sub || '').slice(0, 30), String(x.unit || '').slice(0, 40), net, tax, amt, String(x.note || '').slice(0, 200)] };
}
function ac_save_(p) {
  var me = ac_need_(p), x = p.item || {}; if (typeof x === 'string') x = ops_json_(x, {});
  var c = ac_clean_(x); if (c.error) return c;
  var sh = ac_sheet_(), lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    if (x.id) {
      var hit = ac_rows_().filter(function (r) { return r.id === String(x.id); })[0]; if (!hit) return { error: '找不到這筆' };
      sh.getRange(hit.row, 1, 1, 15).setValues([c.v.concat([String(x.photo || hit.photo || ''), me.name, ops_now_(), hit.id, hit.src || 'App'])]);
      return { success: true, id: hit.id };
    }
    var id = typeof au_id_ === 'function' ? au_id_('B') : 'B' + Date.now();
    sh.appendRow(c.v.concat([String(x.photo || ''), me.name, ops_now_(), id, 'App']));
    return { success: true, id: id };
  } finally { lock.releaseLock(); }
}
function ac_del_(p) {
  ac_need_(p);
  var hit = ac_rows_().filter(function (r) { return r.id === String(p.id); })[0]; if (!hit) return { error: '找不到這筆' };
  ac_sheet_().deleteRow(hit.row); return { success: true };
}
// 匯入（前端讀 Excel 後分批送來，一批最多 500 筆）；日期＋收支＋金額＋單位＋備註都一樣的，已經有幾筆就跳過幾筆（重複匯入不會多算，同一天真的有兩筆一樣的也不會漏）
function ac_import_(p) {
  var me = ac_need_(p), list = ops_arr_(p.rows); if (list.length > 500) return { error: '一次最多 500 筆' };
  var have = {}, seen = {}; ac_rows_().forEach(function (r) { var k = ac_key_(r); have[k] = (have[k] || 0) + 1; });   // 同一天同店同金額可能真的有好幾筆：只跳過已經存在的筆數
  var add = [], skip = 0, bad = 0, src = String(p.src || '匯入').slice(0, 40);
  list.forEach(function (x, i) {
    var c = ac_clean_(x); if (c.error) { bad++; return; }
    var k = ac_key_({ date: c.v[0], io: c.v[2], amt: c.v[8], unit: c.v[5], note: c.v[9] });
    seen[k] = (seen[k] || 0) + 1;
    if (seen[k] <= (have[k] || 0)) { skip++; return; }
    add.push(c.v.concat(['', me.name, ops_now_(), 'B' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss') + ('000' + i).slice(-4) + Math.floor(Math.random() * 90 + 10), String(x.src || src).slice(0, 40)]));
  });
  if (add.length) { var sh = ac_sheet_(), lock = LockService.getScriptLock(); lock.waitLock(20000); try { sh.getRange(sh.getLastRow() + 1, 1, add.length, AC_HEAD.length).setValues(add); } finally { lock.releaseLock(); } }
  return { success: true, added: add.length, skipped: skip, bad: bad };
}
// 損益看板：每月收入、支出（依類別）、淨額；另附 App 收店盤點的營業額做對照，以及要注意的資料
function ac_summary_(p) {
  ac_need_(p);
  var y = String(p.year || Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy')), months = {}, warn = [];
  var mk = function (m) { return months[m] = months[m] || { ym: m, inc: 0, exp: 0, incCat: {}, expCat: {}, storeRev: 0, count: 0 }; };
  ac_rows_().forEach(function (x) {
    if (x.date.slice(0, 4) !== y) return;
    var m = mk(x.date.slice(0, 7)); m.count++;
    if (x.io === '收入') { m.inc += x.amt; m.incCat[x.cat || '未分類'] = (m.incCat[x.cat || '未分類'] || 0) + x.amt; if (AC_INC.indexOf(x.cat) < 0) warn.push({ id: x.id, date: x.date, text: '收入的類別是「' + (x.cat || '空白') + '」', amt: x.amt, unit: x.unit }); }
    else { m.exp += x.amt; m.expCat[x.cat || '未分類'] = (m.expCat[x.cat || '未分類'] || 0) + x.amt; if (!x.cat) warn.push({ id: x.id, date: x.date, text: '支出沒有填類別', amt: x.amt, unit: x.unit }); }
  });
  try {   // App 營業額（收店盤點）對照
    gm_closeRows_().forEach(function (r) { var d = String(r.date || ''); if (d.slice(0, 4) === y) mk(d.slice(0, 7)).storeRev += Number(r.rev) || 0; });
  } catch (e) {}
  var list = Object.keys(months).sort().map(function (k) { var m = months[k]; m.net = m.inc - m.exp; return m; });
  var tot = { inc: 0, exp: 0, expCat: {}, incCat: {} };
  list.forEach(function (m) { tot.inc += m.inc; tot.exp += m.exp; Object.keys(m.expCat).forEach(function (c) { tot.expCat[c] = (tot.expCat[c] || 0) + m.expCat[c]; }); Object.keys(m.incCat).forEach(function (c) { tot.incCat[c] = (tot.incCat[c] || 0) + m.incCat[c]; }); });
  tot.net = tot.inc - tot.exp;
  return { success: true, data: { year: y, months: list, total: tot, warn: warn.slice(0, 50) } };
}

AU_READ = new RegExp(AU_READ.source.replace('|calList)$', '|calList|acMeta|acSummary)$'));

function acHandler_(action, p) {
  var map = { acMeta: ac_meta_, acList: ac_list_, acSave: ac_save_, acDel: ac_del_, acImport: ac_import_, acSummary: ac_summary_ };
  if (!map[action]) return null;
  try { GM_CACHE_ = {}; return map[action](p); } catch (e) { return { error: e.message }; }
}
function ac_setup() {
  ac_sheet_();
  var sh = ac_sheet_(); sh.getRange('A:A').setNumberFormat('yyyy-mm-dd');
  try { var prot = sh.protect().setDescription('內帳：只有擁有者可以直接改'); prot.setWarningOnly(true); } catch (e) {}
  Logger.log('ac_setup 完成：〈內帳〉已建立');
}

// ═══════════════════════════════════════════════
// v1.30 赤心幣新花費（2026-11-13）
// 貼在「內帳 v1.29」之後、「路由v1.30」之前。部署後執行一次 s30_setup()
// 1. 我的座位：宇宙「夥伴座位區」，開通 100（附基本木桌椅）；桌子、椅子、擺飾（最多 3 個）、寵物小窩另購
// 2. 進場特效：煙火、彩虹、星星雨、騎小暴龍；打卡上班時播放
// 3. 稱號：翻模達人、雞蛋糕職人依累計工時解鎖；其他稱號用幣買
// 4. 寵物進階：特殊顏色（櫻花、星空、金色，買一次可套在自己任何一隻寵物）、寵物小窩
// 5. 裝備強化：武器、防具 +1～+5，失敗只扣幣、裝備不會壞
// 6. 季節扭蛋：限期機台，一次 100，不算每月 5 次；扭蛋券兩台都能用
// 7. 全員大魔王：每月一隻，全員投幣攻擊；打倒後依投入排名送扭蛋券；月底沒打倒，有參加的人 1 張
// 8. 和隊長吃飯：2,000 枚，每月 1 名，先申請先得；大隊長約時間、完成；取消退幣
// 9. （追加）管理者幫夥伴重設密碼：重設成生日 4 碼，夥伴下次登入一定要先改密碼
// 覆蓋：gm_gacha_（季節機台、扭蛋券）、pv_fighter_（強化數值）
// 所有價格、門檻、機率都在〈遊戲參數〉或〈商品目錄〉，可以直接改
// ═══════════════════════════════════════════════

var S30_PARAMS = [
  ['座位擺飾上限', 3, '桌上最多擺幾個擺飾'],
  ['稱號門檻_翻模達人', 500, '累計工時（小時）達到就解鎖'],
  ['稱號門檻_雞蛋糕職人', 1500, '累計工時（小時）達到就解鎖'],
  ['強化費用', '20,40,80,120,200', '+1～+5 每次嘗試的費用'],
  ['強化成功率', '100,90,75,60,45', '+1～+5 的成功率（百分比）；失敗只扣幣，裝備不會壞'],
  ['強化加成_武器', 'atk:1', '武器每 +1 的加成'],
  ['強化加成_防具', 'def:1,hp:3', '防具每 +1 的加成'],
  ['季節扭蛋價格', 100, ''],
  ['季節扭蛋期間', '聖誕系列:12-01:12-31,新春系列:01-25:02-21', '系列:開始MM-DD:結束MM-DD，逗號分隔'],
  ['大魔王血量', 3000, '每月一隻，全員投入的赤心幣＝傷害'],
  ['大魔王最低投入', 10, '一次至少幾枚'],
  ['大魔王名單', '燒焦怪,麵糊黏黏怪,停電魔王,排隊大暴龍,漏氣烤盤怪,打翻糖漿怪', '依月份輪流'],
  ['大魔王獎勵', '1:5,3:3,10:2,99999:1', '排名上限:扭蛋券張數（第 1 名 5 張、2～3 名 3 張、4～10 名 2 張、其他 1 張）'],
  ['大魔王安慰券', 1, '月底沒打倒，有參加的人每人幾張'],
  ['和隊長吃飯價格', 2000, ''],
  ['和隊長吃飯每月名額', 1, '']
];
S30_PARAMS.forEach(function (p) { GM_PARAM_DEFAULTS.push(p); });

// 物品編號, 名稱, 分類, 等級, 價格, 上架, 系列, 說明
var S30_CATALOG = [
  ['seat_basic', '開通我的座位', 'seat', '普通', 100, '花費', '', '附基本木桌、木椅'],
  ['desk_white', '白色簡約桌', 'desk', '普通', 80, '花費', '', ''],
  ['desk_game', '電競桌', 'desk', '稀有', 200, '花費', '', ''],
  ['desk_boss', '紅玉主管桌', 'desk', '傳說', 400, '花費', '', ''],
  ['chair_bean', '懶骨頭', 'chair', '普通', 60, '花費', '', ''],
  ['chair_game', '電競椅', 'chair', '稀有', 150, '花費', '', ''],
  ['chair_throne', '紅玉皇座', 'chair', '傳說', 300, '花費', '', ''],
  ['deco_plant', '小盆栽', 'deco', '普通', 50, '花費', '', '🪴'],
  ['deco_frame', '相框', 'deco', '普通', 50, '花費', '', '🖼️'],
  ['deco_globe', '地球儀', 'deco', '普通', 100, '花費', '', '🌍'],
  ['deco_figure', '雞蛋糕公仔', 'deco', '稀有', 120, '花費', '', '🧸'],
  ['deco_trex', '小暴龍玩偶', 'deco', '稀有', 150, '花費', '', '🦖'],
  ['deco_trophy', '獎盃', 'deco', '稀有', 200, '花費', '', '🏆'],
  ['deco_oven', '迷你金烤爐', 'deco', '傳說', 500, '花費', '', '✨'],
  ['fx_firework', '煙火進場', 'entry', '普通', 100, '花費', '', '🎆'],
  ['fx_rainbow', '彩虹進場', 'entry', '稀有', 150, '花費', '', '🌈'],
  ['fx_stars', '星星雨進場', 'entry', '稀有', 200, '花費', '', '🌠'],
  ['fx_trex', '騎小暴龍進場', 'entry', '傳說', 300, '花費', '', '🦖'],
  ['t_mold', '翻模達人', 'title', '稀有', 0, '工時', '', '稱號門檻_翻模達人'],
  ['t_master', '雞蛋糕職人', 'title', '傳說', 0, '工時', '', '稱號門檻_雞蛋糕職人'],
  ['t_star', '赤心之星', 'title', '普通', 50, '花費', '', ''],
  ['t_travel', '宇宙旅人', 'title', '普通', 100, '花費', '', ''],
  ['t_magic', '甜點魔法師', 'title', '稀有', 150, '花費', '', ''],
  ['t_legend', '傳說烤手', 'title', '傳說', 200, '花費', '', ''],
  ['skin_sakura', '櫻花色寵物', 'petskin', '稀有', 200, '花費', '', '櫻花'],
  ['skin_galaxy', '星空色寵物', 'petskin', '稀有', 250, '花費', '', '星空'],
  ['skin_gold', '金色寵物', 'petskin', '傳說', 300, '花費', '', '金色'],
  ['den_cushion', '寵物軟墊', 'petden', '普通', 100, '花費', '', ''],
  ['den_house', '寵物木屋', 'petden', '稀有', 200, '花費', '', ''],
  ['den_castle', '寵物城堡', 'petden', '傳說', 300, '花費', '', ''],
  // 季節扭蛋（只有期間內的機台開得到）
  ['x_antler', '麋鹿角', 'hat', '普通', 0, '季節扭蛋', '聖誕系列', ''],
  ['x_bell', '鈴鐺項圈', 'acc', '普通', 0, '季節扭蛋', '聖誕系列', ''],
  ['x_scarf', '聖誕圍巾', 'acc', '普通', 0, '季節扭蛋', '聖誕系列', ''],
  ['x_tree', '聖誕樹頭飾', 'hat', '稀有', 0, '季節扭蛋', '聖誕系列', ''],
  ['x_gift', '禮物背包', 'acc', '稀有', 0, '季節扭蛋', '聖誕系列', ''],
  ['x_snowman', '雪人裝', 'outfit', '稀有', 0, '季節扭蛋', '聖誕系列', ''],
  ['x_santa', '聖誕老人裝', 'outfit', '傳說', 0, '季節扭蛋', '聖誕系列', ''],
  ['x_frame', '雪花名牌框', 'frame', '傳說', 0, '季節扭蛋', '聖誕系列', ''],
  ['c_fu', '福字胸章', 'acc', '普通', 0, '季節扭蛋', '新春系列', ''],
  ['c_lantern', '小燈籠', 'acc', '普通', 0, '季節扭蛋', '新春系列', ''],
  ['c_ingot', '元寶頭飾', 'hat', '普通', 0, '季節扭蛋', '新春系列', ''],
  ['c_redpack', '紅包背包', 'acc', '稀有', 0, '季節扭蛋', '新春系列', ''],
  ['c_lion', '舞獅頭', 'hat', '稀有', 0, '季節扭蛋', '新春系列', ''],
  ['c_tang', '紅色唐裝', 'outfit', '稀有', 0, '季節扭蛋', '新春系列', ''],
  ['c_dragon', '金龍披風', 'acc', '傳說', 0, '季節扭蛋', '新春系列', ''],
  ['c_frame', '金色春聯框', 'frame', '傳說', 0, '季節扭蛋', '新春系列', '']
];
S30_CATALOG.forEach(function (c) { GM_CATALOG_SEED.push(c); });
// 紙娃娃可以穿季節扭蛋的新款
(function () {
  if (typeof AV_ALLOWED === 'undefined') return;
  S30_CATALOG.forEach(function (c) { var k = c[2]; if (c[5] === '季節扭蛋' && AV_ALLOWED[k] && AV_ALLOWED[k].indexOf(c[0]) < 0) AV_ALLOWED[k].push(c[0]); });
})();
GM_BADGES.push(['s30_boss', '魔王剋星', '⚔️', '全員大魔王投入第 1 名', 0, true]);
GM_BADGES.push(['s30_season', '季節收藏家', '🎄', '季節扭蛋系列收集完成', 50, true]);
GM_BADGES.push(['s30_meal', '和隊長吃過飯', '🍽️', '和隊長吃飯', 0, true]);

GM_SHEETS.s30me = ['我的花費', ['員工編號', '稱號', '進場特效', '座位', '寵物造型', '更新時間']];
GM_SHEETS.s30enh = ['裝備強化', ['員工編號', '物品編號', '等級', '更新時間']];
GM_SHEETS.s30tix = ['扭蛋券', ['時間', '員工編號', '數量', '說明', '來源鍵']];
GM_SHEETS.s30boss = ['大魔王', ['月份', '員工編號', '投入', '時間']];
GM_SHEETS.s30meal = ['和隊長吃飯', ['編號', '月份', '員工編號', '申請時間', '狀態', '約定日期', '備註', '處理時間']];

function s30_n_(k, d) { var v = Number(gm_param_(k)); return isFinite(v) && v > 0 ? v : d; }
function s30_list_(k, d) { return String(gm_param_(k) || d).split(',').map(function (x) { return Number(x); }); }
function s30_emp_(p) {
  var emp = String(p.empId || '').trim(), e = gm_emp_(emp);
  if (!e || e.resigned) throw new Error('帳號無法使用');
  return { id: emp, e: e };
}
function s30_name_(id) { var e = gm_emp_(id); return e ? (e.nick || e.name) : id; }

// ── 個人設定（稱號、特效、座位、寵物造型）──
function s30_meRow_(emp) {
  var rows = gm_rows_('s30me');
  for (var i = 0; i < rows.length; i++) if (rows[i][0] === emp) {
    var r = rows[i], j = function (v, d) { try { return v ? JSON.parse(v) : d; } catch (e) { return d; } };
    return { row: i + 2, title: String(r[1] || ''), fx: String(r[2] || ''), seat: j(r[3], null), skins: j(r[4], {}) };
  }
  return { row: 0, title: '', fx: '', seat: null, skins: {} };
}
function s30_meSave_(emp, m) {
  var v = [emp, m.title || '', m.fx || '', m.seat ? JSON.stringify(m.seat) : '', JSON.stringify(m.skins || {}), gm_now_()];
  if (m.row) { var rng = gm_sh_('s30me').getRange(m.row, 1, 1, 6); rng.setNumberFormat('@'); rng.setValues([v]); GM_CACHE_.rows_s30me = null; }
  else gm_append_('s30me', [v]);
}

// 累計工時（小時）：〈累計工時〉最新一個月的「累計工時總計」，加上之後〈工時日結〉的分鐘
function s30_cumHours_(emp) {
  if (!GM_CACHE_.s30cum) {
    var cum = {}, cs = gm_ss_().getSheetByName('累計工時');
    if (cs && cs.getLastRow() > 1) cs.getRange(2, 1, cs.getLastRow() - 1, 7).getValues().forEach(function (r) {
      var id = String(r[0]).trim(); if (!id) return;
      var ym = r[2] instanceof Date ? Utilities.formatDate(r[2], 'Asia/Taipei', 'yyyy-MM') : String(r[2]).trim().replace('/', '-');
      if (!cum[id] || ym >= cum[id].ym) cum[id] = { ym: ym, h: Number(String(r[6]).replace(/[^\d.]/g, '')) || 0 };
    });
    GM_CACHE_.s30cum = cum;
  }
  var c = GM_CACHE_.s30cum[emp], h = c ? c.h : 0, after = c ? c.ym : '';
  gm_rows_('hours').forEach(function (r) { if (r[1] === emp && (!after || String(r[0]).slice(0, 7) > after)) h += (Number(r[3]) || 0) / 60; });
  return Math.floor(h);
}
function s30_titleOK_(emp, id, own) {
  var c = gm_catalog_()[id]; if (!c || c.cat !== 'title') return false;
  if (c.where === '工時') return s30_cumHours_(emp) >= s30_n_(c.note, 99999);
  return !!(own || gm_owned_(emp))[id];
}

function s30_buy_(p) {
  var me = s30_emp_(p), item = String(p.item || '').trim(), c = gm_catalog_()[item];
  if (!c || c.where !== '花費') return { error: '這個項目目前沒有販售' };
  var own = gm_owned_(me.id); if (own[item]) return { error: '已經擁有了' };
  if (/^(desk|chair|deco|petden)$/.test(c.cat) && !own.seat_basic) return { error: '要先開通我的座位' };
  if (gm_balance_(me.id) < c.price) return { error: '赤心幣不足' };
  gm_credit_(me.id, '購買', -c.price, '購買「' + c.name + '」', 'BUY|' + me.id + '|' + item);
  gm_append_('owned', [[me.id, item, '購買', gm_now_()]]);
  var m = s30_meRow_(me.id);       // 買了就直接換上（開通座位＝基本桌椅）
  if (c.cat === 'seat') m.seat = { desk: '', chair: '', deco: [], den: '' };
  else if (c.cat === 'entry') m.fx = item;
  else if (c.cat === 'title') m.title = item;
  else if (m.seat && (c.cat === 'desk' || c.cat === 'chair' || c.cat === 'petden')) m.seat[c.cat === 'petden' ? 'den' : c.cat] = item;
  else if (m.seat && c.cat === 'deco' && m.seat.deco.length < s30_n_('座位擺飾上限', 3)) m.seat.deco.push(item);
  s30_meSave_(me.id, m);
  return { success: true, data: s30_me_(p).data };
}
// 換穿：title / fx / desk / chair / den / deco（陣列）/ skin（pet＋skin，空白＝原色）
function s30_set_(p) {
  var me = s30_emp_(p), own = gm_owned_(me.id), cat = gm_catalog_(), m = s30_meRow_(me.id);
  var ok = function (id, k) { return !id || (own[id] && cat[id] && cat[id].cat === k); };
  if (p.title != null) { var t = String(p.title); if (t && !s30_titleOK_(me.id, t, own)) return { error: '還沒有這個稱號' }; m.title = t; }
  if (p.fx != null) { if (!ok(String(p.fx), 'entry')) return { error: '還沒有這個特效' }; m.fx = String(p.fx); }
  if (p.desk != null || p.chair != null || p.den != null || p.deco != null) {
    if (!m.seat) return { error: '要先開通我的座位' };
    if (p.desk != null) { if (!ok(String(p.desk), 'desk')) return { error: '還沒有這張桌子' }; m.seat.desk = String(p.desk); }
    if (p.chair != null) { if (!ok(String(p.chair), 'chair')) return { error: '還沒有這張椅子' }; m.seat.chair = String(p.chair); }
    if (p.den != null) { if (!ok(String(p.den), 'petden')) return { error: '還沒有這個小窩' }; m.seat.den = String(p.den); }
    if (p.deco != null) {
      var d = typeof p.deco === 'string' ? (p.deco ? (p.deco.charAt(0) === '[' ? JSON.parse(p.deco) : p.deco.split(',')) : []) : p.deco;
      d = d.filter(function (x, i) { return x && d.indexOf(x) === i; });
      if (d.length > s30_n_('座位擺飾上限', 3)) return { error: '最多擺 ' + s30_n_('座位擺飾上限', 3) + ' 個' };
      if (!d.every(function (x) { return ok(x, 'deco'); })) return { error: '還沒有這個擺飾' };
      m.seat.deco = d;
    }
  }
  if (p.pet != null) {
    var pet = String(p.pet), skin = String(p.skin || '');
    var mine = gm_rows_('pets').some(function (r) { return r[0] === me.id && String(r[9]) === pet && /^(身邊|隊伍|掛賣)$/.test(String(r[8] || '身邊') || '身邊'); });
    if (!mine) return { error: '找不到這隻寵物' };
    if (skin && !ok(skin, 'petskin')) return { error: '還沒有這個顏色' };
    if (skin) m.skins[pet] = skin; else delete m.skins[pet];
  }
  s30_meSave_(me.id, m);
  return { success: true, data: s30_me_(p).data };
}

// ── 裝備強化 ──
function s30_enhMap_(emp) { var o = {}; gm_rows_('s30enh').forEach(function (r) { if (r[0] === emp) o[r[1]] = Number(r[2]) || 0; }); return o; }
function s30_enhBonus_(cat, lv) {
  var o = {}; if (!lv) return o;
  String(gm_param_(cat === 'weapon' ? '強化加成_武器' : '強化加成_防具') || '').split(',').forEach(function (x) { var a = x.split(':'); if (a[0]) o[a[0].trim()] = (Number(a[1]) || 0) * lv; });
  return o;
}
function s30_enhance_(p) {
  var me = s30_emp_(p), item = String(p.item || ''), c = gm_catalog_()[item];
  if (!c || (c.cat !== 'weapon' && c.cat !== 'armor')) return { error: '只有武器和防具可以強化' };
  if (!gm_owned_(me.id)[item]) return { error: '還沒擁有這件裝備' };
  var cur = s30_enhMap_(me.id)[item] || 0; if (cur >= 5) return { error: '已經強化到 +5 了' };
  var cost = s30_list_('強化費用', '20,40,80,120,200')[cur] || 200, rate = s30_list_('強化成功率', '100,90,75,60,45')[cur];
  if (!isFinite(rate)) rate = 50;
  if (gm_balance_(me.id) < cost) return { error: '赤心幣不足' };
  var ok = (p._roll != null ? Number(p._roll) : Math.random() * 100) < rate;
  gm_credit_(me.id, '裝備強化', -cost, '強化「' + c.name + '」+' + (cur + 1) + (ok ? ' 成功' : ' 失敗'), 'ENH|' + me.id + '|' + item + '|' + Date.now() + Math.random());
  if (ok) {
    var rows = gm_rows_('s30enh'), at = 0;
    for (var i = 0; i < rows.length; i++) if (rows[i][0] === me.id && rows[i][1] === item) at = i + 2;
    if (at) { var rng = gm_sh_('s30enh').getRange(at, 3, 1, 2); rng.setNumberFormat('@'); rng.setValues([[String(cur + 1), gm_now_()]]); GM_CACHE_.rows_s30enh = null; }
    else gm_append_('s30enh', [[me.id, item, cur + 1, gm_now_()]]);
  }
  return { success: true, ok: ok, level: ok ? cur + 1 : cur, cost: cost, rate: rate, balance: gm_balance_(me.id) };
}
// 覆蓋：對戰數值加上強化
function pv_fighter_(emp) {
  var e = gm_emp_(emp); if (!e) return null;
  var q = pv_equipRow_(emp), own = gm_owned_(emp), st = { hp: PV_BASE.hp, atk: PV_BASE.atk, def: PV_BASE.def, spd: PV_BASE.spd }, enh = s30_enhMap_(emp), cat = gm_catalog_();
  [q.weapon, q.armor].forEach(function (id) {
    if (!id || !own[id]) return;
    var s = pv_stats_(id); Object.keys(s).forEach(function (k) { if (st[k] != null) st[k] += s[k]; });
    var b = s30_enhBonus_(cat[id] ? cat[id].cat : '', enh[id] || 0); Object.keys(b).forEach(function (k) { if (st[k] != null) st[k] += b[k]; });
  });
  var pet = gm_pet_(emp); if (pet) st.hp += pet.stage * 4;
  st.crit = 0;
  if (pet && pet.type && PV_PET_ATTR[pet.type]) {
    var at = PV_PET_ATTR[pet.type], pct = [0, 0, 0.25, 0.5, 0.75, 1][pet.stage] || 0;
    st[at.stat] += at.stat === 'crit' ? at.val * pct : Math.round(at.val * pct);
  }
  var cards = q.cards.filter(function (c) { return own[c]; }).slice(0, 3).map(function (c) { var s = pv_stats_(c); return { id: c, name: cat[c].name, kind: s.card, val: s.val }; });
  var nm = function (id) { return id && own[id] ? cat[id].name + (enh[id] ? ' +' + enh[id] : '') : ''; };
  return { id: emp, name: e.nick || e.name, stats: st, weapon: nm(q.weapon), armor: nm(q.armor), cards: cards, join: q.join, pet: pet ? pet.stage : 0,
           petType: pet && pet.type ? pet.type : '', petTypeName: pet && pet.type ? pet.typeName : '' };
}

// ── 扭蛋券 ──
function s30_tickets_(emp) { var n = 0; gm_rows_('s30tix').forEach(function (r) { if (r[1] === emp) n += Number(r[2]) || 0; }); return n; }
function s30_tixAdd_(emp, n, note, key) {
  if (!n) return false;
  if (key && gm_rows_('s30tix').some(function (r) { return r[4] === key; })) return false;
  gm_append_('s30tix', [[gm_now_(), emp, n, note, key || '']]); return true;
}
// 目前開放的季節機台
function s30_season_(today) {
  var md = String(today || gm_today_()).slice(5, 10), out = null;
  String(gm_param_('季節扭蛋期間') || '').split(',').forEach(function (x) {
    var a = x.split(':'); if (a.length < 3 || out) return;
    var f = a[1].trim(), t = a[2].trim(), inR = f <= t ? md >= f && md <= t : md >= f || md <= t;
    if (inR) out = { series: a[0].trim(), from: f, to: t };
  });
  return out;
}
function s30_seasonList_() {
  return String(gm_param_('季節扭蛋期間') || '').split(',').map(function (x) { var a = x.split(':'); return a.length >= 3 ? { series: a[0].trim(), from: a[1].trim(), to: a[2].trim() } : null; }).filter(Boolean);
}
// 覆蓋：扭蛋（machine＝season 季節機台；ticket＝用扭蛋券，不扣幣、不算每月次數）
function gm_gacha_(p) {
  var emp = String(p.empId || '').trim(), e = gm_emp_(emp);
  if (!e || e.resigned) return { error: '帳號無法使用' };
  var season = String(p.machine || '') === 'season', useTix = !!p.ticket && String(p.ticket) !== 'false', sea = null;
  if (season) { sea = s30_season_(); if (!sea) return { error: '季節扭蛋現在沒有開放' }; }
  var price = season ? s30_n_('季節扭蛋價格', 100) : (Number(gm_param_('扭蛋價格')) || 50), ym = gm_today_().slice(0, 7), mine = [];
  gm_rows_('gacha').forEach(function (r) { if (r[1] === emp) mine.push(r); });
  var limit = Number(gm_param_('扭蛋每月上限')) || 5;
  var thisMonth = mine.filter(function (r) { return String(r[0]).slice(0, 7) === ym && !/^(季節|券)/.test(String(r[5] || '')); }).length;
  if (useTix) { if (s30_tickets_(emp) < 1) return { error: '沒有扭蛋券' }; }
  else {
    if (!season && thisMonth >= limit) return { error: '本月扭蛋次數已用完' };
    if (gm_balance_(emp) < price) return { error: '赤心幣不足' };
  }
  var cat = gm_catalog_(), pool = { '普通': [], '稀有': [], '傳說': [] };
  Object.keys(cat).forEach(function (k) { var c = cat[k]; if ((season ? c.where === '季節扭蛋' && c.series === sea.series : c.where === '扭蛋') && pool[c.tier]) pool[c.tier].push(c); });
  var streak = 0; for (var i = mine.length - 1; i >= 0 && String(mine[i][3]) === '普通'; i--) streak++;
  var pity = Number(gm_param_('扭蛋保底次數')) || 10, roll = p._roll != null ? Number(p._roll) : Math.random() * 100;
  var leg = Number(gm_param_('扭蛋機率_傳說')) || 5, rare = Number(gm_param_('扭蛋機率_稀有')) || 25;
  var tier = roll < leg ? '傳說' : roll < leg + rare ? '稀有' : '普通';
  if (tier === '普通' && streak + 1 >= pity) tier = Math.random() * (leg + rare) < leg ? '傳說' : '稀有';
  if (!pool[tier].length) tier = pool['普通'].length ? '普通' : pool['稀有'].length ? '稀有' : '傳說';
  var got = pool[tier][Math.floor(Math.random() * pool[tier].length)];
  if (!got) return { error: '扭蛋機目前沒有商品' };
  var dup = !!gm_owned_(emp)[got.id], refund = dup ? Number(gm_param_('扭蛋重複退幣')) || 0 : 0, n = mine.length + 1;
  var label = (useTix ? '券' : '') + (season ? '季節' : '');
  if (useTix) s30_tixAdd_(emp, -1, '用扭蛋券轉' + (season ? sea.series : '扭蛋'), 'TIXUSE|' + emp + '|' + n);
  else gm_credit_(emp, '扭蛋', -price, (season ? sea.series + '扭蛋' : '扭蛋') + '第 ' + n + ' 次', 'GACHA|' + emp + '|' + n);
  if (dup) gm_credit_(emp, '扭蛋退幣', refund, '重複「' + got.name + '」分解', 'GREF|' + emp + '|' + n);
  else gm_append_('owned', [[emp, got.id, season ? '季節扭蛋' : '扭蛋', gm_now_()]]);
  gm_append_('gacha', [[gm_now_(), emp, got.id, tier, refund, label]]);
  if (!dup && got.series) {
    var own = gm_owned_(emp), all = Object.keys(cat).filter(function (k) { return cat[k].series === got.series && cat[k].where === got.where; });
    if (all.every(function (k) { return own[k]; })) gm_award_(emp, season ? 's30_season' : 'collector', got.series);
  }
  gm_checkSocialBadges_(emp);
  return { success: true, data: { item: got, tier: tier, duplicate: dup, refund: refund, balance: gm_balance_(emp), tickets: s30_tickets_(emp),
    left: Math.max(0, limit - thisMonth - (useTix || season ? 0 : 1)), machine: season ? sea.series : '' } };
}
GM_SHEETS.gacha = ['扭蛋紀錄', ['時間', '員工編號', '物品編號', '等級', '重複退幣', '機台']];

// ── 全員大魔王 ──
function s30_bossOf_(ym) {
  var names = String(gm_param_('大魔王名單') || '燒焦怪').split(',').map(function (x) { return x.trim(); }).filter(String);
  var idx = (Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1) % names.length;
  return { ym: ym, name: names[idx], hp: s30_n_('大魔王血量', 3000) };
}
function s30_bossState_(ym) {
  var by = {}, dmg = 0, killed = gm_getState_('大魔王打倒_' + ym);
  gm_rows_('s30boss').forEach(function (r) { if (String(r[0]) === ym) { by[r[1]] = (by[r[1]] || 0) + (Number(r[2]) || 0); dmg += Number(r[2]) || 0; } });
  var rank = Object.keys(by).map(function (id) { return { id: id, name: s30_name_(id), coins: by[id] }; }).sort(function (a, b) { return b.coins - a.coins; });
  var b = s30_bossOf_(ym);
  return { ym: ym, name: b.name, hp: b.hp, dmg: Math.min(dmg, b.hp), left: Math.max(0, b.hp - dmg), killed: killed, rank: rank, settled: gm_getState_('大魔王結算_' + ym) };
}
function s30_bossReward_(rank) {   // 第幾名 → 幾張
  var rules = String(gm_param_('大魔王獎勵') || '1:5,3:3,10:2,99999:1').split(',').map(function (x) { var a = x.split(':'); return [Number(a[0]), Number(a[1])]; });
  for (var i = 0; i < rules.length; i++) if (rank <= rules[i][0]) return rules[i][1];
  return 0;
}
function s30_bossSettle_(ym, defeated) {
  if (gm_getState_('大魔王結算_' + ym)) return;
  var st = s30_bossState_(ym); if (!st.rank.length) { gm_setState_('大魔王結算_' + ym, '無人參加'); return; }
  st.rank.forEach(function (x, i) {
    var n = defeated ? s30_bossReward_(i + 1) : s30_n_('大魔王安慰券', 1);
    s30_tixAdd_(x.id, n, ym + ' 大魔王「' + st.name + '」' + (defeated ? '第 ' + (i + 1) + ' 名' : '參加獎'), 'BOSS|' + ym + '|' + x.id);
  });
  if (defeated) gm_award_(st.rank[0].id, 's30_boss', ym);
  gm_setState_('大魔王結算_' + ym, defeated ? '打倒' : '逃走');
}
function s30_bossCatchUp_() {     // 上個月沒結算的 → 魔王逃走，發安慰券
  var prev = gm_prevMonth_(gm_today_().slice(0, 7));
  if (!gm_getState_('大魔王結算_' + prev) && gm_rows_('s30boss').some(function (r) { return String(r[0]) === prev; })) s30_bossSettle_(prev, false);
}
function s30_bossHit_(p) {
  var me = s30_emp_(p), ym = gm_today_().slice(0, 7), n = Math.floor(Number(p.coins) || 0), min = s30_n_('大魔王最低投入', 10);
  if (n < min) return { error: '一次至少投入 ' + min + ' 枚' };
  var st = s30_bossState_(ym); if (st.killed) return { error: '這個月的魔王已經被打倒了' };
  n = Math.min(n, st.left);
  if (gm_balance_(me.id) < n) return { error: '赤心幣不足' };
  gm_credit_(me.id, '大魔王', -n, ym + ' 攻擊大魔王「' + st.name + '」', 'BOSSHIT|' + me.id + '|' + Date.now() + Math.random());
  gm_append_('s30boss', [[ym, me.id, n, gm_now_()]]);
  var after = s30_bossState_(ym), killed = false;
  if (after.left <= 0) {
    gm_setState_('大魔王打倒_' + ym, gm_now_()); killed = true;
    s30_bossSettle_(ym, true);
    try { gm_petEvent_(me.id, 'boss', '⚔️ 全員合力打倒了大魔王「' + after.name + '」！最後一擊：' + s30_name_(me.id)); } catch (e) {}
    try { if (typeof line_notify_ === 'function') line_notify_('公告', '⚔️ 全員合力打倒了本月大魔王「' + after.name + '」！\n' + after.rank.slice(0, 3).map(function (x, i) { return ['🥇', '🥈', '🥉'][i] + ' ' + x.name + ' ' + x.coins + ' 枚'; }).join('\n') + '\n扭蛋券已發放，到樂園 → 花費 → 扭蛋使用。'); } catch (e) {}
  }
  return { success: true, hit: n, killed: killed, data: s30_me_(p).data };
}

// ── 和隊長吃飯 ──
function s30_meals_() {
  return gm_rows_('s30meal').map(function (r, i) { return { row: i + 2, id: String(r[0]), ym: String(r[1]), emp: String(r[2]), name: s30_name_(String(r[2])), at: String(r[3]), status: String(r[4]), date: String(r[5] || ''), note: String(r[6] || '') }; });
}
function s30_mealApply_(p) {
  var me = s30_emp_(p), ym = gm_today_().slice(0, 7), price = s30_n_('和隊長吃飯價格', 2000);
  if (me.e.role >= 5) return { error: '大隊長不用申請' };
  var live = s30_meals_().filter(function (m) { return m.ym === ym && m.status !== '已取消'; });
  if (live.some(function (m) { return m.emp === me.id; })) return { error: '你這個月已經申請了' };
  if (live.length >= s30_n_('和隊長吃飯每月名額', 1)) return { error: '這個月的名額已經滿了，下個月再來' };
  if (gm_balance_(me.id) < price) return { error: '赤心幣不足' };
  var id = 'M' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
  gm_credit_(me.id, '和隊長吃飯', -price, ym + ' 和隊長吃飯', 'MEAL|' + id);
  gm_append_('s30meal', [[id, ym, me.id, gm_now_(), '已申請', '', String(p.note || '').slice(0, 100), '']]);
  try { gm_petEvent_(me.id, 'meal', '🍽️ ' + s30_name_(me.id) + ' 用赤心幣換到了這個月和隊長吃飯！'); } catch (e) {}
  return { success: true, data: s30_me_(p).data };
}
// 大隊長：約時間（date）、完成、取消（退幣）；夥伴自己在「已申請」時可以取消
function s30_mealSet_(p) {
  var me = s30_emp_(p), m = s30_meals_().filter(function (x) { return x.id === String(p.id); })[0];
  if (!m) return { error: '找不到這筆申請' };
  var boss = me.e.role >= 5, st = String(p.status || '');
  if (!boss && !(m.emp === me.id && st === '已取消' && m.status === '已申請')) return { error: '只有大隊長可以處理' };
  if (m.status === '已取消' || m.status === '已完成') return { error: '這筆已經' + m.status.slice(1) };
  var sh = gm_sh_('s30meal');
  if (st === '已取消') {
    gm_credit_(m.emp, '和隊長吃飯退幣', s30_n_('和隊長吃飯價格', 2000), m.ym + ' 和隊長吃飯取消退回', 'MEALBACK|' + m.id);
  } else if (st === '已完成') { gm_award_(m.emp, 's30_meal', m.ym); }
  else if (st === '已約好') { if (!/^\d{4}-\d{2}-\d{2}/.test(String(p.date || ''))) return { error: '請選日期' }; }
  else return { error: '狀態不對' };
  var rng = sh.getRange(m.row, 5, 1, 4); rng.setNumberFormat('@');
  rng.setValues([[st, st === '已約好' ? String(p.date).slice(0, 16) : m.date, p.note != null ? String(p.note).slice(0, 100) : m.note, gm_now_()]]);
  GM_CACHE_.rows_s30meal = null;
  if (st === '已約好' && boss) {   // 寫進大隊長個人行事曆（有設定的話）
    try { var cal = typeof cal_personal_ === 'function' ? cal_personal_() : null; if (cal) { var d = new Date(String(p.date).slice(0, 10) + 'T' + (String(p.date).slice(11, 16) || '12:00') + ':00+08:00'); cal.createEvent('和 ' + m.name + ' 吃飯（赤心幣）', d, new Date(d.getTime() + 90 * 60000), { description: '分類：其他' }); } } catch (e) {}
  }
  return { success: true, data: s30_me_(p).data };
}

// ── 給前端：我的花費頁 ──
function s30_me_(p) {
  var me = s30_emp_(p), cat = gm_catalog_(), own = gm_owned_(me.id), m = s30_meRow_(me.id), ym = gm_today_().slice(0, 7);
  try { s30_bossCatchUp_(); } catch (e) {}
  var items = Object.keys(cat).filter(function (k) { return cat[k].where === '花費' || cat[k].where === '工時' || cat[k].where === '季節扭蛋'; }).map(function (k) {
    var c = cat[k], o = { id: c.id, name: c.name, cat: c.cat, tier: c.tier, price: c.price, where: c.where, series: c.series, note: c.note, owned: !!own[k] };
    if (c.where === '工時') { o.need = s30_n_(c.note, 99999); o.owned = s30_cumHours_(me.id) >= o.need; }
    return o;
  });
  var enh = s30_enhMap_(me.id), gear = Object.keys(own).filter(function (k) { return cat[k] && (cat[k].cat === 'weapon' || cat[k].cat === 'armor'); }).map(function (k) {
    var lv = enh[k] || 0; return { id: k, name: cat[k].name, cat: cat[k].cat, stats: cat[k].note, level: lv, cost: lv < 5 ? s30_list_('強化費用', '20,40,80,120,200')[lv] : null, rate: lv < 5 ? s30_list_('強化成功率', '100,90,75,60,45')[lv] : null, bonus: s30_enhBonus_(cat[k].cat, lv), next: s30_enhBonus_(cat[k].cat, lv + 1) };
  });
  var pets = [];
  try { gm_rows_('pets').forEach(function (r, i) { var s = String(r[8] || '身邊') || '身邊'; if (r[0] === me.id && /^(身邊|隊伍|掛賣)$/.test(s)) { var pt = gm_petFromRow_(r, i); pets.push({ id: pt.id, name: pt.name, flavor: pt.flavor, type: pt.type, stage: pt.stage, main: s === '身邊', skin: m.skins[pt.id] || '' }); } }); } catch (e) {}
  var meals = s30_meals_(), mealLive = meals.filter(function (x) { return x.ym === ym && x.status !== '已取消'; });
  var sea = s30_season_(), boss = s30_bossState_(ym);
  return { success: true, data: {
    balance: gm_balance_(me.id), hours: s30_cumHours_(me.id), role: me.e.role,
    items: items, title: m.title, fx: m.fx, seat: m.seat, decoMax: s30_n_('座位擺飾上限', 3), pets: pets, gear: gear,
    tickets: s30_tickets_(me.id),
    season: { now: sea, list: s30_seasonList_(), price: s30_n_('季節扭蛋價格', 100) },
    gachaPrice: Number(gm_param_('扭蛋價格')) || 50,
    boss: { ym: ym, name: boss.name, hp: boss.hp, dmg: boss.dmg, left: boss.left, killed: boss.killed, min: s30_n_('大魔王最低投入', 10),
            rank: boss.rank.slice(0, 20).map(function (x, i) { return { name: x.name, coins: x.coins, mine: x.id === me.id, reward: s30_bossReward_(i + 1) }; }),
            mine: (boss.rank.filter(function (x) { return x.id === me.id; })[0] || {}).coins || 0, rules: String(gm_param_('大魔王獎勵') || '') },
    meal: { price: s30_n_('和隊長吃飯價格', 2000), quota: s30_n_('和隊長吃飯每月名額', 1), used: mealLive.length,
            mine: meals.filter(function (x) { return x.emp === me.id; }).slice(-5).reverse(),
            all: me.e.role >= 5 ? meals.filter(function (x) { return x.status !== '已取消'; }).slice(-24).reverse() : [] }
  } };
}

// ── 宇宙辦公室：稱號、特效、座位、寵物造型 ──
function s30_scene_() {
  var cat = gm_catalog_(), out = { titles: {}, fx: {}, seats: [], skins: {} };
  gm_rows_('s30me').forEach(function (r) {
    var emp = String(r[0]), e = gm_emp_(emp); if (!e || e.resigned) return;
    var m = s30_meRow_(emp);
    if (m.title && cat[m.title] && s30_titleOK_(emp, m.title)) out.titles[emp] = cat[m.title].name;
    if (m.fx) out.fx[emp] = m.fx;
    if (m.seat) out.seats.push({ id: emp, name: e.nick || e.name, desk: m.seat.desk || '', chair: m.seat.chair || '', deco: m.seat.deco || [], den: m.seat.den || '' });
    Object.keys(m.skins || {}).forEach(function (pid) { var s = cat[m.skins[pid]]; if (s) out.skins[pid] = s.note; });
  });
  return out;
}
// 寵物顏色換成特殊色（宇宙辦公室的主寵物、隊伍）
function s30_applySkins_(d, sc) {
  var byEmp = {};
  gm_rows_('pets').forEach(function (r) { var s = String(r[8] || '身邊') || '身邊'; if (/^(身邊|隊伍|掛賣)$/.test(s) && sc.skins[String(r[9])]) (byEmp[r[0]] = byEmp[r[0]] || []).push({ main: s === '身邊', name: String(r[2]), skin: sc.skins[String(r[9])] }); });
  Object.keys(byEmp).forEach(function (emp) {
    byEmp[emp].forEach(function (x) {
      if (x.main && d.pets && d.pets[emp]) d.pets[emp].flavor = x.skin;
      else if (!x.main && d.teams && d.teams[emp]) { var t = d.teams[emp].filter(function (y) { return y.name === x.name && !y._s; })[0]; if (t) { t.flavor = x.skin; t._s = 1; } }
    });
  });
}

// ── 管理者幫夥伴重設密碼（v1.30 追加）──
// Lv.3 以上可以重設「權限比自己低」的夥伴（大隊長可以重設所有人，自己除外）；密碼重設成生日 4 碼，夥伴下次登入一定要先改密碼
GM_SHEETS.s30pw = ['密碼重設紀錄', ['時間', '重設者', '被重設的夥伴', '說明']];
function s30_pwReset_(p) {
  var me = gm_emp_(p.empId), target = String(p.target || '').trim();
  if (!me || me.resigned || me.role < 3) return { error: '需要 Lv.3 以上才能重設密碼' };
  if (!target || target === me.id) return { error: '自己的密碼請到「我的」修改' };
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('夥伴資料'), v = sh.getDataRange().getValues(), pwC = sec_pwCol_(v[0]);
  for (var r = 1; r < v.length; r++) {
    if (String(v[r][0]).trim() !== target) continue;
    var role = Number(v[r][12]) || 1;
    if (me.role < 5 && role >= me.role) return { error: '只能重設權限比你低的夥伴' };
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
// 登入後：被重設過、而且密碼還是生日 → 一定要先改密碼（改好之後自動解除）
function s30_pwMust_(p) {
  var emp = String(p.empId || '').trim(), props = PropertiesService.getScriptProperties(), k = 'pwMust_' + emp;
  if (!props.getProperty(k)) return { success: true, must: false };
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('夥伴資料'), v = sh.getDataRange().getValues(), pwC = sec_pwCol_(v[0]);
  for (var r = 1; r < v.length; r++) if (String(v[r][0]).trim() === emp) {
    var bd = sec_bdayPw_(v[r][4]), st = String(v[r][pwC] || '');
    var weak = !!bd && (st === bd || (sec_isHashed_(st) && sec_check_(bd, st)));
    if (!weak) { props.deleteProperty(k); return { success: true, must: false }; }
    return { success: true, must: true };
  }
  return { success: true, must: false };
}

AU_READ = new RegExp(AU_READ.source.replace('|acMeta|acSummary)$', '|acMeta|acSummary|s30Me|s30PwMust)$'));

function s30Handler_(action, p) {
  if (action === 'gmScene') {           // 先拿 v1.28 的場景（含隊伍），再加上稱號、特效、座位、寵物顏色
    try {
      var r = p28Handler_('gmScene', p); if (!r || !r.data) return r;
      var sc = s30_scene_(); r.data.titles = sc.titles; r.data.fx = sc.fx; r.data.seats = sc.seats;
      s30_applySkins_(r.data, sc); return r;
    } catch (e) { return null; }
  }
  if (action === 'homeTodo') {          // 大隊長：和隊長吃飯待約
    try {
      var t = p28Handler_('homeTodo', p); var me = gm_emp_(p.empId);
      if (t && t.success && me && me.role >= 5) s30_meals_().filter(function (m) { return m.status === '已申請'; }).forEach(function (m) { t.data.unshift({ icon: '🍽️', text: m.name + ' 申請和你吃飯，請約時間', tab: 'spend', red: false }); });
      if (t && t.success && me) s30_meals_().filter(function (m) { return m.emp === me.id && m.status === '已約好' && m.date.slice(0, 10) >= gm_today_(); }).forEach(function (m) { t.data.unshift({ icon: '🍽️', text: m.date + ' 和隊長吃飯', tab: 'spend', red: false }); });
      return t;
    } catch (e) { return null; }
  }
  if (action === 'gmRules') {           // 赤心幣規則頁「怎麼用」加上新的花費
    try {
      var g = gm27Handler_('gmRules', p); if (!g || !g.data) return g;
      g.data.spend = g.data.spend.concat([
        { name: '🪑 我的座位', how: '開通 ' + (gm_catalog_().seat_basic || {}).price + ' 枚；桌子、椅子、擺飾、寵物小窩另購' },
        { name: '✨ 進場特效', how: '煙火、彩虹、星星雨、騎小暴龍，打卡上班時播放' },
        { name: '🏷️ 稱號', how: '翻模達人 ' + s30_n_('稱號門檻_翻模達人', 500) + ' 小時、雞蛋糕職人 ' + s30_n_('稱號門檻_雞蛋糕職人', 1500) + ' 小時自動解鎖；其他稱號用幣買' },
        { name: '🎨 寵物顏色', how: '櫻花、星空、金色，買一次可以套在自己任何一隻寵物' },
        { name: '⚔️ 裝備強化', how: '+1～+5，失敗只扣幣、裝備不會壞' },
        { name: '🎄 季節扭蛋', how: s30_n_('季節扭蛋價格', 100) + ' 枚一次，限期開放，不算每月次數' },
        { name: '👹 全員大魔王', how: '每月一隻，全員投幣攻擊，打倒後依排名送扭蛋券' },
        { name: '🍽️ 和隊長吃飯', how: s30_n_('和隊長吃飯價格', 2000) + ' 枚，每月 ' + s30_n_('和隊長吃飯每月名額', 1) + ' 名，先申請先得' }
      ]);
      return g;
    } catch (e) { return null; }
  }
  var map = { s30PwReset: s30_pwReset_, s30PwMust: s30_pwMust_, s30Me: s30_me_, s30Buy: s30_buy_, s30Set: s30_set_, s30Enhance: s30_enhance_, s30Boss: s30_bossHit_, s30Meal: s30_mealApply_, s30MealSet: s30_mealSet_, gmGacha: gm_gacha_ };
  if (!map[action]) return null;
  var lock = action === 's30Me' ? null : LockService.getScriptLock();
  try { if (lock) lock.waitLock(20000); GM_CACHE_ = {}; return map[action](p); }
  catch (e) { return { error: e.message }; }
  finally { if (lock) lock.releaseLock(); }
}

function s30_setup() {
  var log = [];
  ['s30me', 's30enh', 's30tix', 's30boss', 's30meal', 's30pw'].forEach(function (k) { gm_sh_(k); });
  var gs = gm_sh_('gacha'); if (String(gs.getRange(1, 6).getValue()).trim() === '') { gs.getRange(1, 6).setValue('機台'); log.push('扭蛋紀錄加「機台」欄'); }
  var sh = gm_sh_('params'), v = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues() : [], have = {};
  v.forEach(function (r) { have[String(r[0]).trim()] = 1; });
  S30_PARAMS.forEach(function (x) { if (!have[x[0]]) { sh.appendRow(x); log.push('新增參數 ' + x[0]); } });
  var cat = {}; gm_rows_('catalog').forEach(function (r) { cat[r[0]] = 1; });
  var add = S30_CATALOG.filter(function (c) { return !cat[c[0]]; }); if (add.length) { gm_append_('catalog', add); log.push('商品目錄新增 ' + add.length + ' 項'); }
  GM_CACHE_ = {};
  Logger.log('s30_setup 完成\n' + log.join('\n'));
  return log;
}

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

// ═══════════════════════════════════════════════
// 內帳、大隊長個人行事曆、重設密碼、報價單：一定要有效的登入通行證（2026-11-13，部署端）
// v2（v1.30 部署時）：加上 s30_pwReset_（管理者重設夥伴密碼）與 qt_need_（報價單）；本檔改放在「報價單」之後、「路由」之前
// 問題：「登入驗證模式」目前是「記錄」，沒帶通行證的呼叫照樣放行、後端相信傳來的員工編號。
//       內帳（ac_need_）與個人行事曆（cal_isBoss_）只看員工編號，帶大隊長編號就能讀財務資料與個人行程。
// 修正：這兩項不管模式，一律要有效通行證，且通行證本人是 Lv.5（夥伴視角時是被看的人，自然不會是大隊長）。
// 貼在「報價單 v1」之後、「路由v1.30」之前（必須在赤心幣花費之後，覆蓋才會生效）。覆蓋：auHandler_、ac_need_、cal_isBoss_、s30_pwReset_、qt_need_
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

// v1.30：管理者重設密碼 — 原本只看傳來的員工編號；「記錄」模式下沒登入也能冒用管理者編號把別人密碼改成生日
function s30_pwReset_(p) {
  var tid = au_verifiedId_(); if (!tid) return { error: '請更新 App 後重新登入' };
  p.empId = tid;                                   // 重設者一律以通行證本人為準（不能冒用別人編號）
  var me = gm_emp_(p.empId), target = String(p.target || '').trim();
  if (!me || me.resigned || me.role < 3) return { error: '需要 Lv.3 以上才能重設密碼' };
  if (!target || target === me.id) return { error: '自己的密碼請到「我的」修改' };
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('夥伴資料'), v = sh.getDataRange().getValues(), pwC = sec_pwCol_(v[0]);
  for (var r = 1; r < v.length; r++) {
    if (String(v[r][0]).trim() !== target) continue;
    var role = Number(v[r][12]) || 1;
    if (me.role < 5 && role >= me.role) return { error: '只能重設權限比你低的夥伴' };
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

// v1.30：報價單 — 報價紀錄有客戶資料與金額，一律要有效通行證、本人 Lv.3 以上
function qt_need_(p) {
  var tid = au_verifiedId_(); if (!tid) throw new Error('請更新 App 後重新登入');
  p.empId = tid;
  var me = ops_me_(tid); if (me.role < 3) throw new Error('報價單需要 Lv.3 以上'); return me;
}

// ═════════════════════════════════════════════════════════════
// v1.31 赤心幣平衡（隊長 11/13 定案）｜v2：花幣動作加登入通行證本人檢查｜v4（部署端）：gm_admin_ 沒有有效通行證一律擋下
// 位置：第 33 版之後、路由之前（與部署端「權限修正 v2」、v1.32 夥伴權限保護沒有重疊的函式，前後皆可）。
// 底版：後端第 33 版（部署交接 11/13 19:50）。
//   1 升等不追溯：工時幣只計算「新增的工時」，用結算當下的等級；升等之後才開始用新倍率
//   2 節日類（春節、國定假日、颱風、品牌週年）同一段工時只取最高的一個；每小時總倍率（含階層）上限預設 ×6
//   3 小店：同一位買家對同一家店每天最多買 3 件；成交抽 20%，明細拆成租金／水電／清潔；
//          每月 1 日收上個月的攤位月租（只從上月營收裡扣，營收不夠就扣到 0，不會變負債）
//     寵物市集：每個階段有價格範圍；每人每月最多賣出 1 隻、買進 1 隻；成交抽 20% 市集管理費（攤位費＋清潔費）
//   4 對戰每日獎勵上限 10 → 4：請執行一次 coin31_setup()（會更新〈遊戲參數〉並補上新參數）
//   5 正式版（〈遊戲參數〉正式版開始日，預設 2026-12-01）當天凌晨自動：
//     先發完前一天工時幣 → 封存測試期資料（隱藏分頁「封存_…」）→ 赤心幣歸零（流水帳留「正式版歸零」）
//     → 用幣買的東西、扭蛋、紀錄、徽章歸零（只留資歷徽章）→ 第一隻寵物保留（已孵化的從雛形期重新長）
//     → 發測試版創始夥伴禮包 → 工時從正式版開始日重新計算。取消原本的「餘額 ×2」。
//   6 「除錯大師」徽章：大隊長工具頒發，每次 +20 幣，每人最多 5 次
// 新參數全部放在〈遊戲參數〉，之後可直接改數字。
// ═════════════════════════════════════════════════════════════

var C31_PARAMS = [
  ['工時倍率上限', 6, 'v1.31：每小時工時幣的總倍率上限（階層 × 所有加倍事件相乘後）'],
  ['小店同店每日購買上限', 3, 'v1.31：同一位買家對同一家小店，每天最多買幾件'],
  ['小店月租', 30, 'v1.31：每月 1 日收上月攤位月租；只從上月營收扣，營收不夠就扣到 0'],
  ['小店抽成明細', '租金 50,水電 25,清潔 25', 'v1.31：成交抽成（100% − 店主分潤）在明細裡怎麼拆，數字是比例'],
  ['寵物市集價格範圍', '100-150,150-250,200-350,300-500,400-700', 'v1.31：蛋、雛形、嬰兒、兒童、完全體各自可掛賣的價格範圍'],
  ['寵物市集每月賣出上限', 1, 'v1.31：每人每月最多賣出幾隻（含掛賣中）'],
  ['寵物市集每月買進上限', 1, 'v1.31：每人每月最多買進幾隻'],
  ['創始夥伴禮包赤心幣', 100, 'v1.31：正式版開始時，測試期有上班的夥伴得到的赤心幣'],
  ['創始夥伴禮包扭蛋券', 3, 'v1.31：同上，扭蛋券張數'],
  ['創始夥伴加碼工時', 40, 'v1.31：測試期工時滿幾小時，扭蛋券再加碼'],
  ['創始夥伴加碼扭蛋券', 2, 'v1.31：加碼的扭蛋券張數'],
  ['除錯大師獎勵', 20, 'v1.31：每頒一次「除錯大師」給幾枚'],
  ['除錯大師上限', 5, 'v1.31：每人最多可以拿幾次「除錯大師」'],
  ['稱號工時起算', '正式版', 'v1.31：工時稱號的累計工時從哪裡算。正式版＝從正式版開始日；累計＝薪資系統的總累計工時']
];
var C31_CATALOG = [
  ['og_cap', 'OG 紅帽', 'hat', '傳說', 0, '限定', '', '測試版創始夥伴限定'],
  ['og_frame', '創始夥伴金框', 'frame', '傳說', 0, '限定', '', '測試版創始夥伴限定']
];
GM_BADGES.push(['og', '創始夥伴', '🏅', '參與 11/16～11/30 測試版（永不再發）', 0, false]);
GM_BADGES.push(['debugger', '除錯大師', '🛠️', '回報問題被大隊長採用', 20, true]);
C31_CATALOG.forEach(function (c) { if (typeof GM_CATALOG_SEED !== 'undefined') GM_CATALOG_SEED.push(c); });
(function () {
  if (typeof AV_ALLOWED === 'undefined') return;
  if (AV_ALLOWED.hat && AV_ALLOWED.hat.indexOf('og_cap') < 0) AV_ALLOWED.hat.push('og_cap');
  if (AV_ALLOWED.frame && AV_ALLOWED.frame.indexOf('og_frame') < 0) AV_ALLOWED.frame.push('og_frame');
})();
var C31_HOLIDAY = { spring: 1, holiday: 1, typhoon: 1, brand: 1 };
var C31_SET_HEAD = ['員工編號', '日期|櫃位', '已結算分鐘', '更新時間'];

// 安全（部署交接第 3 節規則）：花幣的動作，若有登入通行證就必須是本人
function c31_notMe_(emp) {
  var v = typeof au_verifiedId_ === 'function' ? au_verifiedId_() : '';
  return !!(v && v !== emp);
}
function c31_n_(k, d) { var v = Number(gm_param_(k)); return isFinite(v) && v > 0 ? v : d; }

// 執行一次：補上新參數、對戰每日獎勵上限改成 4
function coin31_setup() {
  var sh = gm_sh_('params'), rows = gm_rows_('params'), have = {};
  rows.forEach(function (r, i) { have[String(r[0]).trim()] = i + 2; });
  if (have['對戰每日獎勵上限']) sh.getRange(have['對戰每日獎勵上限'], 2).setValue(4);
  else sh.appendRow(['對戰每日獎勵上限', 4, 'v1.31：贏對戰每天最多拿幾枚']);
  // 取消「正式版餘額 ×2」，改成歸零＋禮包
  if (have['正式版加倍倍率']) sh.getRange(have['正式版加倍倍率'], 2, 1, 2).setValues([[1, 'v1.31：已取消（正式版改成歸零＋創始夥伴禮包）']]);
  else sh.appendRow(['正式版加倍倍率', 1, 'v1.31：已取消（正式版改成歸零＋創始夥伴禮包）']);
  if (!have['正式版開始日']) sh.appendRow(['正式版開始日', '2026-12-01', '']);
  // 商品目錄：OG 紅帽、創始夥伴金框（不上架）
  var cat = {}; gm_rows_('catalog').forEach(function (r) { cat[String(r[0]).trim()] = 1; });
  C31_CATALOG.forEach(function (c) { if (!cat[c[0]]) gm_sh_('catalog').appendRow(c); });
  C31_PARAMS.forEach(function (p) { if (!have[p[0]]) sh.appendRow(p); });
  c31_setSheet_();
  GM_CACHE_ = {};
  return '完成：對戰每日獎勵上限 = 4、取消正式版 ×2、新增參數 ' + C31_PARAMS.length + ' 項、商品目錄加 OG 紅帽與金框、〈工時幣結算〉表已建立。正式版開始日＝' + gm_param_('正式版開始日');
}

// ── 2 加倍事件（覆蓋）：節日類只取最高一個 ──
function gm27_events_(emp, date, loc, X) {
  X = X || gm27_ctx_();
  var e = X.emps[emp] || {}, out = [], md = date.slice(5), mm = date.slice(5, 7);
  var bd = e.birthday ? gm_bdMD_(e.birthday) : '';
  if (bd && bd.slice(0, 2) === mm) out.push({ k: 'bday', name: '🎂 生日月', m: gm27_n_('生日月工時倍率', 2) });
  if (loc && (X.act[loc] || /^00|^66/.test(loc))) out.push({ k: 'act', name: '🎪 活動場次', m: gm27_n_('活動工時倍率', 2) });
  if (X.spring.some(function (r) { return date >= r.from && date <= r.to; })) out.push({ k: 'spring', name: '🧧 春節', m: gm27_n_('春節工時倍率', 3) });
  if (X.cal[date] === '國定') out.push({ k: 'holiday', name: '🎌 國定假日', m: gm27_n_('國定假日工時倍率', 2) });
  if (X.cal[date] === '颱風') out.push({ k: 'typhoon', name: '🌀 颱風日', m: gm27_n_('颱風日工時倍率', 2) });
  if (X.swaps[emp + '|' + date]) out.push({ k: 'swap', name: '🙋 代班', m: gm27_n_('代班工時倍率', 1.5) });
  var st = X.newbies[emp];
  if (st && st.slice(5, 7) === mm && st.slice(0, 4) < date.slice(0, 4)) out.push({ k: 'anniv', name: '🎉 到職週年月', m: gm27_n_('到職週年工時倍率', 1.5) });
  if (X.brand && X.brand.slice(-5) === md) out.push({ k: 'brand', name: '🔴 品牌週年日', m: gm27_n_('品牌週年工時倍率', 2) });
  if (loc && !gm27_isNew_(X, emp, date) && (X.byDateLoc[date + '|' + loc] || []).some(function (o) { return o !== emp && gm27_isNew_(X, o, date); }))
    out.push({ k: 'mentor', name: '👩‍🏫 帶新人', m: gm27_n_('帶新人工時倍率', 1.2) });
  X.boosts.forEach(function (b, i) {
    if (date >= b.from && date <= b.to && (!b.loc || b.loc === loc || (loc && loc.replace(/^\d+/, '').indexOf(b.loc.replace(/^\d+/, '')) >= 0)))
      out.push({ k: 'boost' + i, name: '⚡ ' + b.name, m: b.mult, holiday: /颱風|豪雨/.test(b.name) });
  });
  // 節日類（含名稱有颱風／豪雨的手動加倍）只留倍率最高的一個
  var best = null;
  out.forEach(function (v) { if (C31_HOLIDAY[v.k] || v.holiday) { if (!best || v.m > best.m) best = v; } });
  return out.filter(function (v) { return !(C31_HOLIDAY[v.k] || v.holiday) || v === best; });
}

// ── 1 工時幣（覆蓋）：只算新增的工時、用當下等級、套用倍率上限 ──
function c31_setSheet_() {
  var ss = gm_ss_(), sh = ss.getSheetByName('工時幣結算');
  if (!sh) { sh = ss.insertSheet('工時幣結算'); sh.getRange(1, 1, 1, C31_SET_HEAD.length).setValues([C31_SET_HEAD]); sh.setFrozenRows(1); sh.getRange('B:B').setNumberFormat('@'); }
  return sh;
}
function gm_payHours_(runDate) {
  c31_payHoursCore_(runDate);
  var off = String(gm_param_('正式版開始日') || '').trim();
  if (off && runDate >= off && gm_getState_('正式版已重置') !== off) c31_officialReset_(off);
}
function c31_payHoursCore_(runDate) {
  var start = gm_param_('測試版開始日'), X = gm27_ctx_(), yday = gm_addDays_(runDate, -1), cap = c31_n_('工時倍率上限', 6);
  // 目前工時（同一人、同一天、同一櫃位合併）
  var cur = {};
  gm_rows_('hours').forEach(function (r) {
    var d = String(r[0]); if (d < start) return;
    var emp = String(r[1]), key = d + '|' + String(r[2]);
    (cur[emp] = cur[emp] || {})[key] = (cur[emp][key] || 0) + (Number(r[3]) || 0);
  });
  // 已結算紀錄
  var sh = c31_setSheet_(), S = {};
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().forEach(function (r, i) {
    var emp = String(r[0]); if (!emp) return;
    (S[emp] = S[emp] || {})[String(r[1])] = { row: i + 2, v: Number(r[2]) || 0 };
  });
  var paid = {};
  var since = gm_getState_('正式版重置時間');   // 正式版之後只算重置後發的工時幣
  gm_rows_('ledger').forEach(function (r) { if (r[2] === '工時' && (!since || String(r[0]) >= since)) paid[r[1]] = (paid[r[1]] || 0) + (Number(r[3]) || 0); });
  var app = [], upd = [], now = gm_now_();
  Object.keys(cur).forEach(function (emp) {
    var e = gm_emp_(emp); if (!e || e.resigned) return;
    var s = S[emp] = S[emp] || {}, rm = gm27_roleMult_(e.role), add = 0, parts = [];
    var set = function (k, v) { if (s[k]) { if (s[k].v !== v) upd.push([s[k].row, v]); s[k].v = v; } else { app.push([emp, k, v, now]); s[k] = { v: v }; } };
    // 舊制已發過工時幣、但還沒有結算紀錄 → 目前工時全部當作已結算，不重發
    if (!s._acc && (paid[emp] || 0) > 0) {
      Object.keys(cur[emp]).forEach(function (k) { set(k, cur[emp][k]); });
      set('_acc', paid[emp] * 60);
      return;
    }
    Object.keys(cur[emp]).forEach(function (k) {
      var old = s[k] ? s[k].v : 0, dm = cur[emp][k] - old;
      if (dm <= 0) return;                                   // 工時被改少：不倒扣
      var d = k.split('|')[0], loc = k.slice(d.length + 1), ev = gm27_events_(emp, d, loc, X);
      var raw = rm * gm27_mult_(ev), m = Math.min(cap, raw);
      add += dm * m; set(k, cur[emp][k]);
      parts.push((d === yday ? '' : d.slice(5).replace('-', '/') + ' ') + Math.round(dm / 6) / 10 + 'h' + (rm !== 1 ? ' × Lv.' + e.role + ' ' + rm : '') +
        ev.map(function (v) { return ' × ' + v.name + ' ' + v.m; }).join('') + (raw > cap ? '（上限 ×' + cap + '）' : ''));
    });
    if (!add) return;
    var acc = (s._acc ? s._acc.v : 0) + add; set('_acc', Math.round(acc * 1000) / 1000);
    var diff = Math.floor(acc / 60) - (paid[emp] || 0);
    if (diff > 0) gm_credit_(emp, '工時', diff, '工時結算至 ' + yday + '：' + parts.join('；'), 'HOURS|' + emp + '|' + runDate);
  });
  upd.forEach(function (u) { sh.getRange(u[0], 3, 1, 2).setValues([[u[1], now]]); });
  if (app.length) sh.getRange(sh.getLastRow() + 1, 1, app.length, 4).setValues(app);
  try { gm27_monthly_(runDate); } catch (e) {}
  try { c31_shopRent_(runDate); } catch (e) {}
}

// ── 3 小店（覆蓋購買）：同店每日上限、抽成拆明細 ──
function c31_feeSplit_(fee) {
  var parts = String(gm_param_('小店抽成明細') || '租金 50,水電 25,清潔 25').split(',').map(function (x) {
    var m = String(x).trim().match(/^(\S+)\s+(\d+(?:\.\d+)?)$/); return m ? { n: m[1], w: Number(m[2]) } : null;
  }).filter(Boolean);
  var tw = parts.reduce(function (a, x) { return a + x.w; }, 0) || 1, left = fee;
  return parts.map(function (x, i) { var v = i === parts.length - 1 ? left : Math.round(fee * x.w / tw); left -= v; return x.n + ' ' + v; }).join('、');
}
function sp_buy_(p) {
  var buyer = String(p.empId || '').trim(), owner = String(p.owner || '').trim(), item = String(p.item || ''), to = String(p.to || '').trim();
  if (!gm_emp_(buyer) || gm_isFrozen_(buyer)) return { error: '帳號無法使用' };
  if (c31_notMe_(buyer)) return { error: '登入身分不符，請重新登入' };
  if (buyer === owner) return { error: '不能買自己店裡的東西' };
  var s = sp_shop_(owner); if (!s || gm_isFrozen_(owner)) return { error: '這家店目前沒有營業' };
  var it = sp_items_(s.type, s.prices).filter(function (x) { return x.id === item; })[0]; if (!it) return { error: '這家店沒有賣這個' };
  var lim = c31_n_('小店同店每日購買上限', 3), today = gm_today_(), cnt = 0;
  pv_rows_('sales').forEach(function (r) { if (String(r[1]) === owner && String(r[2]) === buyer && String(r[0]).slice(0, 10) === today) cnt++; });
  if (cnt >= lim) return { error: '今天在這家店已經買了 ' + lim + ' 件，明天再來吧' };
  if (gm_balance_(buyer) < it.price) return { error: '赤心幣不足' };
  var cat = gm_catalog_()[item], kind = cat.cat;
  if (kind === 'gift') { if (!gm_emp_(to) || gm_isFrozen_(to) || to === buyer) return { error: '請選擇要送給哪位夥伴' }; }
  else if (['weapon', 'armor', 'card', 'decor'].indexOf(kind) >= 0 && gm_owned_(buyer)[item]) return { error: '已經擁有了' };
  if (kind === 'petsnack' && !gm_pet_(buyer)) return { error: '還沒有寵物' };
  var share = Math.floor(it.price * pv_param_('小店店主分潤') / 100), k = Date.now() + '|' + Math.random();
  gm_credit_(buyer, '小店消費', -it.price, '在「' + s.name + '」買了' + it.name, 'SPBUY|' + buyer + '|' + k);
  if (share) gm_credit_(owner, '小店營收', share, (gm_emp_(buyer).nick || gm_emp_(buyer).name) + ' 買了' + it.name + '（售價 ' + it.price + '，扣' + c31_feeSplit_(it.price - share) + '）', 'SPINC|' + owner + '|' + k);
  if (kind === 'gift') pv_append_('gifts', [[gm_now_(), buyer, to, item, '']]);
  else if (kind === 'petsnack') {
    var pet = gm_pet_(buyer), add = Number(String(cat.note).split(':')[1]) || 0;
    var prow = gm_rows_('pets')[pet.row - 2];
    var rng = gm_sh_('pets').getRange(pet.row, 6, 1, 2); rng.setNumberFormat('@');
    rng.setValues([[String((Number(prow[5]) || 0) + add), String((Number(prow[6]) || 0) + 1)]]); GM_CACHE_.rows_pets = null;
  } else gm_append_('owned', [[buyer, item, '小店', gm_now_()]]);
  pv_append_('sales', [[gm_now_(), owner, buyer, item, it.price, share, to]]);
  var rr = pv_sh_('shops').getRange(s.row, 6, 1, 2); rr.setNumberFormat('@'); rr.setValues([[String(s.revenue + share), String(s.sales + 1)]]); GM_CACHE_.rows_pv_shops = null;
  return { success: true, data: { balance: gm_balance_(buyer) } };
}
// 每月 1～7 日：收上個月的攤位月租（只從上月營收扣，不會負債）
function c31_shopRent_(runDate) {
  if (runDate.slice(8) > '07') return;
  var ym = gm_prevMonth_(runDate.slice(0, 7)); if (ym < String(gm_param_('測試版開始日')).slice(0, 7)) return;
  var rent = c31_n_('小店月租', 30), inc = {};
  pv_rows_('sales').forEach(function (r) { if (String(r[0]).slice(0, 7) === ym) inc[r[1]] = (inc[r[1]] || 0) + (Number(r[5]) || 0); });
  pv_rows_('shops').forEach(function (r) {
    var owner = String(r[0]); if (!owner || gm_isFrozen_(owner)) return;
    var got = inc[owner] || 0, amt = Math.min(rent, got, Math.max(0, gm_balance_(owner)));
    if (amt > 0) gm_credit_(owner, '小店月租', -amt, ym + ' 攤位月租（上月營收 ' + got + ' 枚' + (amt < rent ? '，營收不足只收 ' + amt : '') + '）', 'SHOPRENT|' + owner + '|' + ym);
  });
}

// ── 3 寵物市集（覆蓋掛賣、購買）：階段價格範圍、每月買賣上限、管理費明細 ──
function c31_mktRange_(stage) {
  var a = String(gm_param_('寵物市集價格範圍') || '100-150,150-250,200-350,300-500,400-700').split(',');
  var m = String(a[Math.max(0, Math.min(a.length - 1, (stage || 1) - 1))] || '').match(/(\d+)\s*-\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : [p28_n_('寵物市集最低價', 100), p28_n_('寵物市集最高價', 1000)];
}
function c31_mktCount_(emp, role) {   // 本月賣出（含掛賣中）／買進次數
  var ym = gm_today_().slice(0, 7), n = 0;
  p28_mkt_().forEach(function (m) {
    if (role === 'sell' && m.seller === emp && (m.status === '掛賣' || (m.status === '成交' && String(m.done).slice(0, 7) === ym))) n++;
    if (role === 'buy' && m.buyer === emp && m.status === '成交' && String(m.done).slice(0, 7) === ym) n++;
  });
  return n;
}
function p28_list_(p) {
  var emp = String(p.empId || '').trim(), a = p28_alive_(emp), t = a.filter(function (x) { return x.id === String(p.pet); })[0];
  if (c31_notMe_(emp)) return { error: '登入身分不符，請重新登入' };
  if (!t) return { error: '找不到這隻寵物' };
  if (t.status === '掛賣') return { error: '已經在市集上了' };
  if (a.filter(function (x) { return x.status !== '掛賣'; }).length <= 1) return { error: '至少要留 1 隻寵物在身邊' };
  p28_expire_();
  var lim = c31_n_('寵物市集每月賣出上限', 1);
  if (c31_mktCount_(emp, 'sell') >= lim) return { error: '每個月最多賣出 ' + lim + ' 隻（掛賣中的也算），下個月再來' };
  gm_petSync_(t);
  var rg = c31_mktRange_(t.stage), price = Math.floor(Number(p.price) || 0);
  if (price < rg[0] || price > rg[1]) return { error: t.stageName + '的價格要在 ' + rg[0] + '～' + rg[1] + ' 之間' };
  gm_petSet_(t.row, 9, ['掛賣']);
  p28_mktSheet_().appendRow(['K' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10), emp, t.id, price, '掛賣', gm_now_(), '', '']);
  p28_ensureMain_(emp);
  return { success: true, data: p28_team_(emp) };
}
function p28_buyMkt_(p) {
  var emp = String(p.empId || '').trim(), e = gm_emp_(emp); if (!e || gm_isFrozen_(emp)) return { error: '帳號無法使用' };
  if (c31_notMe_(emp)) return { error: '登入身分不符，請重新登入' };
  p28_expire_();
  var m = p28_mkt_().filter(function (k) { return k.id === String(p.id) && k.status === '掛賣'; })[0];
  if (!m) return { error: '這隻已經被買走或收回了' };
  if (m.seller === emp) return { error: '不能買自己的寵物' };
  var lim = c31_n_('寵物市集每月買進上限', 1);
  if (c31_mktCount_(emp, 'buy') >= lim) return { error: '每個月最多在市集買 ' + lim + ' 隻，下個月再來' };
  if (p28_alive_(emp).length >= p28_n_('寵物上限', 5)) return { error: '你的寵物已經滿 5 隻，請先賣掉一隻' };
  if (gm_balance_(emp) < m.price) return { error: '赤心幣不足' };
  var pt = p28_petRow_(m.pet); if (!pt) return { error: '找不到這隻寵物' };
  var share = Number(gm_param_('寵物市集賣家比例')) || 0.8, get = Math.floor(m.price * share), fee = m.price - get;
  gm_credit_(emp, '寵物市集', -m.price, '買下「' + pt.name + '」', 'MKTBUY|' + m.id);
  if (!gm_isFrozen_(m.seller)) gm_credit_(m.seller, '寵物市集', get, '「' + pt.name + '」賣出 ' + m.price + ' 枚（扣市集管理費 ' + fee + '：攤位費 ' + Math.round(fee / 2) + '、清潔費 ' + (fee - Math.round(fee / 2)) + '）', 'MKTSELL|' + m.id);
  gm_append_('pets', [[m.seller, pt.flavor, pt.name, pt.since, pt.acc, 0, 1, pt.type, '已售出', pt.id + 'S', pt.hatched]]);
  var bonus = pt.hours;
  gm_petSet_(pt.row, 1, [emp]); gm_petSet_(pt.row, 4, [gm_today_(), '', bonus]);
  gm_petSet_(pt.row, 9, [p28_alive_(emp).some(function (x) { return x.status === '身邊'; }) ? '隊伍' : '身邊']);
  p28_mktSheet_().getRange(m.row, 5, 1, 4).setValues([['成交', m.at, emp, gm_now_()]]);
  gm_petEvent_(emp, 'trade', (e.nick || e.name) + ' 在寵物市集帶回了「' + pt.name + '」');
  return { success: true, data: p28_team_(emp), balance: gm_balance_(emp) };
}

// ── 5 正式版：封存、歸零、保留第一隻寵物、發創始夥伴禮包 ──
var C31_ARCHIVE = ['擁有物品', '扭蛋紀錄', '小遊戲紀錄', '團隊基金', '對戰裝備', '對戰紀錄', '即時對戰', '塔防投入',
  '小店', '小店交易', '我的花費', '裝備強化', '扭蛋券', '大魔王', '工時幣結算'];
var C31_KEEP_BADGES = { tenure_1: 1, tenure_2: 1, tenure_3: 1 };   // 資歷看薪資系統的真實累計工時，保留（清掉也會立刻再發）
function c31_archive_(ss, name, tag, clear) {
  var sh = ss.getSheetByName(name); if (!sh) return null;
  var arc = '封存_' + name + '_' + tag;
  if (!ss.getSheetByName(arc)) { var c = sh.copyTo(ss); c.setName(arc); c.hideSheet(); }
  if (clear && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
  return sh;
}
function c31_officialReset_(off) {
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    if (gm_getState_('正式版已重置') === off) return;
    var ss = gm_ss_(), tag = off.replace(/-/g, ''), now = gm_now_(), emps = gm_emps_();
    var testFrom = String(gm_param_('測試版開始日') || '');
    // 測試期參與者（上過班）與工時
    var mins = {};
    gm_rows_('hours').forEach(function (r) { var d = String(r[0]); if (d >= testFrom && d < off) mins[r[1]] = (mins[r[1]] || 0) + (Number(r[3]) || 0); });
    // 1 封存並清空
    c31_archive_(ss, '赤心幣流水帳', tag, false);
    c31_archive_(ss, '寵物', tag, false);
    c31_archive_(ss, '徽章紀錄', tag, false);
    C31_ARCHIVE.forEach(function (n) { c31_archive_(ss, n, tag, true); });
    var tw = ss.getSheetByName('塔防');   // 箭塔、砲塔、城牆、累計投入歸零，櫃位保留
    if (tw && tw.getLastRow() > 1) tw.getRange(2, 2, tw.getLastRow() - 1, 4).setValue(0);
    // 2 徽章：只留資歷
    var bs = gm_sh_('badges'), keep = gm_rows_('badges').filter(function (r) { return C31_KEEP_BADGES[r[1]]; });
    if (bs.getLastRow() > 1) bs.getRange(2, 1, bs.getLastRow() - 1, bs.getLastColumn()).clearContent();
    if (keep.length) bs.getRange(2, 1, keep.length, keep[0].length).setValues(keep);
    // 3 寵物市集：掛賣中的收回
    var mk = ss.getSheetByName('寵物市集');
    if (mk && mk.getLastRow() > 1) { var mv = mk.getRange(2, 5, mk.getLastRow() - 1, 1).getValues(); mv.forEach(function (r, i) { if (r[0] === '掛賣') mk.getRange(i + 2, 5).setValue('收回'); }); }
    // 4 寵物：每人保留第一隻（最早領養、還在身邊或隊伍的那隻），其他回收；成長從正式版重新算，已孵化的保底雛形期
    var hatchH = (GM_PET_STAGES[1] && GM_PET_STAGES[1][0]) || 40, rows = gm_rows_('pets'), first = {};
    rows.forEach(function (r, i) {
      var st = String(r[8] || '身邊') || '身邊'; if (['身邊', '隊伍', '掛賣'].indexOf(st) < 0) return;
      var k = String(r[0]); if (first[k] === undefined || String(r[3]) < String(rows[first[k]][3])) first[k] = i;
    });
    rows.forEach(function (r, i) {
      var st = String(r[8] || '身邊') || '身邊'; if (['身邊', '隊伍', '掛賣'].indexOf(st) < 0) return;
      if (first[String(r[0])] === i) {
        var rg = gm_sh_('pets').getRange(i + 2, 4, 1, 6); rg.setNumberFormat('@');
        rg.setValues([[off, '', String(r[7] ? hatchH : 0), '0', String(r[7] || ''), '身邊']]);   // 購買日期、配件、加成小時、遊戲加命、型態、狀態
      } else gm_petSet_(i + 2, 9, ['已售出']);
    });
    GM_CACHE_ = {};
    // 5 先把測試期最後一個月的月結（互動之星、冠軍櫃位、全勤…）跑完，一起歸零，避免算進正式版
    var pm = gm_prevMonth_(off.slice(0, 7));
    if (off.slice(8) === '01' && gm_getState_('已月結') !== pm) { try { gm_monthly_(pm); } catch (e) {} gm_setState_('已月結', pm); GM_CACHE_ = {}; }
    // 赤心幣歸零
    var bal = {}; gm_rows_('ledger').forEach(function (r) { bal[r[1]] = (bal[r[1]] || 0) + (Number(r[3]) || 0); });
    var zero = [];
    Object.keys(bal).forEach(function (id) { if (bal[id]) zero.push([now, id, '正式版歸零', -bal[id], '測試期結束，赤心幣歸零（原本 ' + bal[id] + ' 枚）', 'RESET|' + id + '|' + off]); });
    if (zero.length) gm_append_('ledger', zero);
    gm_setState_('正式版重置時間', now);
    gm_setState_('工時已結算到', gm_addDays_(off, -1));
    // 6 工時從正式版開始日重新計算
    var ps = gm_sh_('params'), pr = gm_rows_('params');
    for (var i = 0; i < pr.length; i++) if (String(pr[i][0]).trim() === '測試版開始日') { ps.getRange(i + 2, 2).setValue(off); break; }
    GM_CACHE_ = {};
    // 7 創始夥伴禮包
    var coin = c31_n_('創始夥伴禮包赤心幣', 100), tix = c31_n_('創始夥伴禮包扭蛋券', 3), bonusH = c31_n_('創始夥伴加碼工時', 40), bonusT = c31_n_('創始夥伴加碼扭蛋券', 2), n = 0;
    Object.keys(mins).forEach(function (id) {
      var e = emps[id]; if (!e || e.resigned || !(mins[id] > 0)) return;
      gm_award_(id, 'og', '');
      gm_credit_(id, '測試獎勵', coin, '測試版創始夥伴禮包', 'OGCOIN|' + id);
      var t = tix + (mins[id] >= bonusH * 60 ? bonusT : 0);
      gm_append_('s30tix', [[now, id, t, '測試版創始夥伴禮包' + (t > tix ? '（測試期滿 ' + bonusH + ' 小時加碼）' : ''), 'OGTIX|' + id]]);
      gm_append_('owned', [[id, 'og_cap', '創始夥伴', now], [id, 'og_frame', '創始夥伴', now]]);
      n++;
    });
    gm_setState_('正式版已重置', off);
    try { var a = ann_sheet_(); if (a) a.appendRow(['A' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss') + 'OG', '🎉 紅玉滿宇宙正式版開始！',
      '測試期的赤心幣已歸零，工時從今天重新累計。\n參與測試的 ' + n + ' 位創始夥伴已收到禮包：🏅 創始夥伴徽章、🪙 ' + coin + ' 赤心幣、🎰 扭蛋券、🎩 OG 紅帽、創始夥伴金框。謝謝大家！',
      '一般', '否', '系統', Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss'), gm_addDays_(off, 6)]); } catch (e) {}
  } finally { lock.releaseLock(); }
}

// ── 稱號工時：正式版之後從正式版開始日算（參數「稱號工時起算」＝累計 則用薪資系統總累計）──
// 原本的算法（薪資系統〈累計工時〉最新一個月＋之後的工時日結）。不能直接引用原函式：同名函式會被這裡的覆蓋取代
function c31_cumLife_(emp) {
  if (!GM_CACHE_.s30cum) {
    var cum = {}, cs = gm_ss_().getSheetByName('累計工時');
    if (cs && cs.getLastRow() > 1) cs.getRange(2, 1, cs.getLastRow() - 1, 7).getValues().forEach(function (r) {
      var id = String(r[0]).trim(); if (!id) return;
      var ym = r[2] instanceof Date ? Utilities.formatDate(r[2], 'Asia/Taipei', 'yyyy-MM') : String(r[2]).trim().replace('/', '-');
      if (!cum[id] || ym >= cum[id].ym) cum[id] = { ym: ym, h: Number(String(r[6]).replace(/[^\d.]/g, '')) || 0 };
    });
    GM_CACHE_.s30cum = cum;
  }
  var c = GM_CACHE_.s30cum[emp], h = c ? c.h : 0, after = c ? c.ym : '';
  gm_rows_('hours').forEach(function (r) { if (r[1] === emp && (!after || String(r[0]).slice(0, 7) > after)) h += (Number(r[3]) || 0) / 60; });
  return Math.floor(h);
}
function s30_cumHours_(emp) {
  var off = gm_getState_('正式版已重置');
  if (!off || String(gm_param_('稱號工時起算') || '正式版') === '累計') return c31_cumLife_(emp);
  return Math.floor(gm_minutesSince_(emp, off) / 60);
}

// ── 6 大隊長工具（覆蓋）：可頒「除錯大師」；身分以登入通行證本人為準 ──
function gm_admin_(p) {
  var vid = typeof au_verifiedId_ === 'function' ? au_verifiedId_() : '';
  if (vid && vid !== String(p.empId || '').trim()) return { error: '登入身分不符，請重新登入' };
  if (!vid) return { error: '請更新 App 後重新登入' };   // v4（部署端）：大隊長工具一律要有效登入通行證（記錄模式下不能只靠員工編號）
  var me = gm_emp_(vid); if (!gm_isTop_(me)) return { error: '只有大隊長(第 5 級)與總經理(第 4 級)可以使用' };
  var target = String(p.target || '').trim(), reason = String(p.reason || '').trim().slice(0, 100);
  if (!gm_emp_(target)) return { error: '找不到員工編號 ' + target };
  if (!reason) return { error: '請填寫理由' };
  if (p.badge) {
    if (['mentor', 'special', 'debugger'].indexOf(p.badge) < 0) return { error: '只能手動頒發「好導師」「特別貢獻」「除錯大師」' };
    var amt = p.amount != null && p.amount !== '' ? Number(p.amount) : null, got = 0;
    if (p.badge === 'debugger') {
      var lim = c31_n_('除錯大師上限', 5); got = gm_rows_('badges').filter(function (r) { return r[0] === target && r[1] === 'debugger'; }).length;
      if (got >= lim) return { error: '這位夥伴的「除錯大師」已經拿滿 ' + lim + ' 次' };
      amt = c31_n_('除錯大師獎勵', 20);
    }
    var period = gm_now_();
    if (p.badge === 'debugger') period = '第 ' + (got + 1) + ' 次';   // 每次都不同，避免同一秒按兩次被當成重複
    var ok = gm_award_(target, p.badge, period, amt);
    gm_append_('ledger', [[gm_now_(), target, '管理紀錄', 0, me.name + ' 頒發徽章 ' + p.badge + ':' + reason, '']]);
    return ok ? { success: true } : { error: '頒發失敗' };
  }
  var n = Math.round(Number(p.amount) || 0); if (!n) return { error: '請輸入數量' };
  gm_credit_(target, '管理調整', n, me.name + ':' + reason, 'ADMIN|' + target + '|' + gm_now_() + '|' + Math.random());
  return { success: true, data: { balance: gm_balance_(target) } };
}

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

// ═════════════════════════════════════════════════════════════
// v1.33 測試期提前開放（隊長 11/13 21:59：「現在都要開放了，我現在就在測試了」）
// 底版：後端第 35 版（部署交接 v3）。放在「夥伴權限保護 v1.32 v2」之後、路由之前。
//   1 執行一次 coin33_setup()：把〈遊戲參數〉「測試版開始日」改成今天（只會往前改，不會往後）
//      → 對戰、塔防、小遊戲、工時幣等「測試版開始後才開放」的功能立刻開放
//      → 12/1 正式版照常歸零；創始夥伴禮包的「測試期」會從今天算起
//   2 開店（覆蓋 sp_open_）：正式版開始日之前，不需要「資歷・銅」徽章（測試期大家都能試開店）；
//      正式版之後恢復原本門檻。開店費照收。
//      依交接第 3 節安全規則：花幣動作以登入通行證本人為準，沒有通行證就擋下。
// 覆蓋的函式：sp_open_（不在交接第 3 節清單內）
// ═════════════════════════════════════════════════════════════
function coin33_setup() {
  var today = gm_today_(), sh = gm_sh_('params'), rows = gm_rows_('params'), msg = '';
  for (var i = 0; i < rows.length; i++) if (String(rows[i][0]).trim() === '測試版開始日') {
    var cur = String(rows[i][1] instanceof Date ? Utilities.formatDate(rows[i][1], 'Asia/Taipei', 'yyyy-MM-dd') : rows[i][1]).trim();
    if (!cur || cur > today) { sh.getRange(i + 2, 2).setNumberFormat('@'); sh.getRange(i + 2, 2).setValue(today); msg = '測試版開始日 ' + cur + ' → ' + today; }
    else msg = '測試版開始日已經是 ' + cur + '，不用改';
    break;
  }
  if (!msg) { sh.appendRow(['測試版開始日', today, 'v1.33：測試期提前開放']); msg = '新增測試版開始日 ' + today; }
  GM_CACHE_ = {};
  return msg;
}
function sp_open_(p) {
  var vid = typeof au_verifiedId_ === 'function' ? au_verifiedId_() : '';
  var emp = String(p.empId || '').trim();
  if (!vid) return { error: '請重新登入後再開店' };
  if (vid !== emp) return { error: '登入身分不符，請重新登入' };
  if (!gm_emp_(emp) || gm_isFrozen_(emp)) return { error: '帳號無法使用' };
  var off = String(gm_param_('正式版開始日') || '').trim(), testing = !off || gm_today_() < off;
  if (!testing && !gm_hasBadge_(emp, 'tenure_1', '')) return { error: '累計工時達 ' + String(gm_param_('資歷門檻')).split(',')[0] + ' 小時才能開店' };
  if (sp_shop_(emp)) return { error: '已經有小店了' };
  var type = String(p.type || ''), name = String(p.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12);
  if (PV_SHOP_TYPES.indexOf(type) < 0) return { error: '店型不正確' };
  if (!name) return { error: '請幫小店取名字' };
  var fee = pv_param_('小店開店費'); if (gm_balance_(emp) < fee) return { error: '赤心幣不足(開店費 ' + fee + ' 枚)' };
  gm_credit_(emp, '開店費', -fee, '開了「' + name + '」' + (testing ? '（測試期免資歷門檻）' : ''), 'SHOPOPEN|' + emp + '|' + gm_today_());
  pv_append_('shops', [[emp, name, type, gm_now_(), '{}', 0, 0, '']]);
  return { success: true };
}

// ═════════════════════════════════════════════════════════════
// v1.34 開店資格修正（隊長 11/13 23:52：「我無法領到開店要的徽章」）
// 底版：後端第 36 版（部署交接 v4）。放在「測試期提前開放 v1.33」之後、路由之前。
// 問題：v1.33 只改了「開店」(sp_open_) 在測試期不需要「資歷・銅」徽章，
//       但「小店街列表」(sp_list_) 回傳的 eligible 仍然只看徽章 → 前端不顯示開店按鈕，
//       畫面只寫「累計工時達 1080 小時（資歷・銅徽章）就可以開店」，等於還是開不了。
// 修正：覆蓋 sp_list_，正式版開始日之前 eligible 一律為 true（與 v1.33 sp_open_ 同一個判斷）；
//       正式版之後恢復只看徽章。另外回傳 testing 讓前端之後可以顯示「測試期免門檻」。
// 覆蓋的函式：sp_list_（唯讀查詢，不在交接第 3 節清單內；不花幣、不改資料，不需通行證）
// 不需要執行 setup。
// ═════════════════════════════════════════════════════════════
function sp_list_(p) {
  var emps = gm_emps_(), me = String(p.empId || '').trim();
  var shops = pv_rows_('shops').map(function (r) {
    var s = sp_shop_(r[0]); var e = emps[s.owner];
    return { owner: s.owner, ownerName: e ? (e.nick || e.name) : s.owner, name: s.name, type: s.type, level: sp_level_(s.sales), sales: s.sales, notice: s.notice, items: sp_items_(s.type, s.prices) };
  });
  var offV = gm_param_('正式版開始日');   // 儲存格若被試算表轉成日期，先轉回 yyyy-MM-dd 再比
  var off = String(offV instanceof Date ? Utilities.formatDate(offV, 'Asia/Taipei', 'yyyy-MM-dd') : (offV || '')).trim(), testing = !off || gm_today_() < off;
  var eligible = testing || gm_hasBadge_(me, 'tenure_1', '');
  var gifts = pv_rows_('gifts').filter(function (r) { return r[2] === me; }).slice(-10).reverse().map(function (r) {
    var f = emps[r[1]], c = gm_catalog_()[r[3]] || {}; return { time: String(r[0]), from: f ? (f.nick || f.name) : r[1], item: c.name, icon: String(c.note || '').split(':')[1] || '🎁', unread: !r[4] };
  });
  var people = Object.keys(emps).filter(function (k) { return !emps[k].resigned && k !== me; }).map(function (k) { return { id: k, name: emps[k].nick || emps[k].name }; });
  return { success: true, data: { people: people, shops: shops, mine: sp_shop_(me) ? shops.filter(function (s) { return s.owner === me; })[0] : null, eligible: eligible, testing: testing,
    types: PV_SHOP_TYPES, fee: pv_param_('小店開店費'), share: pv_param_('小店店主分潤'), threshold: String(gm_param_('資歷門檻') || '1080').split(',')[0], gifts: gifts, balance: gm_balance_(me) } };
}

// v2（部署端，11/14 01:20）：eq_who_、eq_todo_ 不再退回 p.empId（登入驗證仍是「記錄」模式，empId 可冒用；清單含客戶個資）
// ═══════════════════════════════════════════════
// v1.35 設備檢查清單（2026-11-14）
// 貼在「開店資格修正 v1.34」之後、「路由 v1.35」之前。部署後執行一次 eq_setup()（建〈設備模板〉〈設備清單〉，放入隊長給的 8 份模板）
// 三種用途：🎪 活動出攤／百貨快閃、🏬 設櫃、✈️ 出國（新加坡、馬來西亞、越南、印尼、日本）
// 一張清單三關：① 出發前打包 → ② 到場確認 → ③ 收攤點收（少了、壞了 → 待補購，用單價算補購金額）
// 權限：建立、修改清單與模板要 Lv.3 以上且有有效登入通行證（au_verifiedId_）；勾選：Lv.2 以上，或被排進這張清單的夥伴
// 數量自動算：項目「計算」= 人 → × 出團人數；= 百顆 → 預計總顆數 ÷ 100 無條件進位（1 包麵粉約 100 顆）
// 出國當地採購：1 包麵粉＝1 批麵糊＝約 100 顆；每天預計顆數 → 批數 → 雞蛋、牛奶、油、糖…（每批用量在模板裡，可改）
// ═══════════════════════════════════════════════

var EQ_TPL_HEAD = ['模板', '類型', '國家', '電壓', '資訊欄', '項目', '當地採購', '裝箱', '排序', '更新人', '更新時間'];
var EQ_HEAD = ['編號', '模板', '類型', '名稱', '開始日', '結束日', '地點', '人數', '預計顆數', '每日顆數', '資訊', '項目', '狀態', '報價單', '出勤夥伴', '建立人', '建立時間', '更新時間', '當地採購', '裝箱', '國家', '電壓'];
var EQ_TYPES = ['活動', '快閃', '設櫃', '出國'];
var EQ_STAGES = {
  '活動': ['出發前打包', '到場確認', '收攤點收'],
  '快閃': ['出發前打包', '進櫃確認', '撤櫃點收'],
  '設櫃': ['出發前打包', '進櫃確認', '撤櫃點收'],
  '出國': ['打包裝箱', '抵達確認', '回國點收']
};
var EQ_PER_BATCH = 100;   // 1 包麵粉／1 批麵糊約幾顆（〈參數設定〉「每包麵粉顆數」可改）

function eq_perBatch_() { var n = 0; try { n = Number(ops_param_('每包麵粉顆數')) || 0; } catch (e) {} return n > 0 ? n : EQ_PER_BATCH; }
function eq_sheet_(name, head) {
  var ss = ops_ss_(), sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.getRange(1, 1, 1, head.length).setValues([head]); sh.setFrozenRows(1); }
  return sh;
}
function eq_rows_(name, head) {
  var sh = eq_sheet_(name, head); if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, head.length).getValues().map(function (r, i) { return { row: i + 2, v: r }; });
}
function eq_j_(s, d) { if (s && typeof s === 'object') return s; try { return s ? JSON.parse(String(s)) : d; } catch (e) { return d; } }
function eq_str_(v, n) { return String(v == null ? '' : v).trim().slice(0, n || 200); }
function eq_num_(v) { var n = Number(v); return isFinite(n) ? n : 0; }
function eq_day_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Taipei', 'yyyy-MM-dd');
  var s = String(v || '').trim().replace(/\//g, '-'); var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : '';
}
function eq_today_() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd'); }
function eq_addDay_(d, n) { var t = new Date(d + 'T00:00:00+08:00'); t.setDate(t.getDate() + n); return Utilities.formatDate(t, 'Asia/Taipei', 'yyyy-MM-dd'); }

// ── 身分 ──
// 管理動作：一律以通行證本人為準，沒有通行證就擋下（依《部署交接》安全規則）
function eq_admin_() {
  var tid = au_verifiedId_();
  if (!tid) throw new Error('請更新 App 後重新登入');
  var me = ops_me_(tid); if (me.role < 3) throw new Error('建立和修改設備清單需要 Lv.3 以上');
  return me;
}
// 查看、勾選：有通行證用通行證本人；「記錄」模式下沒帶通行證才退回 empId（只能勾自己被排到的清單，Lv.2 以上可以勾全部）
function eq_who_(p) {   // v2（部署端）：清單含客戶統編、聯絡人電話，讀取與打勾也一律以通行證本人為準，不退回 p.empId
  var tid = au_verifiedId_();
  if (!tid) throw new Error('請更新 App 後重新登入');
  return ops_me_(tid);
}
function eq_canSee_(me, L) { return me.role >= 2 || L.crew.indexOf(me.id) >= 0 || L.by === me.id; }

// ── 模板 ──
function eq_item_(x, i) {
  x = x || {};
  var o = { id: eq_str_(x.id, 20) || ('i' + (i + 1)), c: eq_str_(x.c, 30) || '其他', n: eq_str_(x.n, 40), d: eq_str_(x.d, 80), q: eq_num_(x.q === undefined || x.q === '' ? 1 : x.q),
    u: eq_str_(x.u, 10), p: Math.max(0, eq_num_(x.p)), m: eq_str_(x.m, 120), k: ['人', '百顆'].indexOf(String(x.k || '')) >= 0 ? String(x.k) : '', b: eq_str_(x.b, 30) };
  return o;
}
function eq_cleanItems_(arr) {
  var out = [], ids = {};
  (arr || []).forEach(function (x, i) {
    var o = eq_item_(x, i); if (!o.n) return;
    if (ids[o.id]) o.id = 'i' + (i + 1) + '_' + Utilities.getUuid().slice(0, 4);
    ids[o.id] = 1; out.push(o);
  });
  return out.slice(0, 300);
}
function eq_tplOf_(r) {
  var v = r.v;
  return { row: r.row, name: String(v[0]), type: String(v[1] || '活動'), country: String(v[2] || ''), volt: String(v[3] || ''),
    info: eq_j_(v[4], []), items: eq_j_(v[5], []), buy: eq_j_(v[6], []), boxes: eq_j_(v[7], []), sort: eq_num_(v[8]), by: String(v[9] || ''), at: String(v[10] || '') };
}
function eq_tpls_() {
  return eq_rows_('設備模板', EQ_TPL_HEAD).filter(function (r) { return String(r.v[0]).trim(); }).map(eq_tplOf_)
    .sort(function (a, b) { return a.sort - b.sort; });
}
function eq_tplRow_(t, me) {
  return [t.name, t.type, t.country || '', t.volt || '', JSON.stringify(t.info || []), JSON.stringify(t.items || []), JSON.stringify(t.buy || []),
    JSON.stringify(t.boxes || []), t.sort || 0, me ? me.name : '系統', ops_now_()];
}

// ── 清單 ──
function eq_listOf_(r) {
  var v = r.v;
  return { row: r.row, id: String(v[0]), tpl: String(v[1]), type: String(v[2] || '活動'), name: String(v[3]), from: eq_day_(v[4]), to: eq_day_(v[5]) || eq_day_(v[4]),
    loc: String(v[6] || ''), people: eq_num_(v[7]), cakes: eq_num_(v[8]), days: eq_j_(v[9], []), info: eq_j_(v[10], {}), items: eq_j_(v[11], []),
    status: String(v[12] || '準備中'), quote: String(v[13] || ''), crew: String(v[14] || '').split(/[、,\s]+/).filter(String),
    by: String(v[15] || ''), at: String(v[16] || ''), updated: String(v[17] || ''), buy: eq_j_(v[18], []), boxes: eq_j_(v[19], []), country: String(v[20] || ''), volt: String(v[21] || '') };
}
function eq_lists_() { return eq_rows_('設備清單', EQ_HEAD).filter(function (r) { return String(r.v[0]).trim(); }).map(eq_listOf_); }
function eq_find_(id) { var L = eq_lists_().filter(function (x) { return x.id === String(id || ''); })[0]; if (!L) throw new Error('找不到這張清單'); return L; }
function eq_write_(L) {
  var v = [L.id, L.tpl, L.type, L.name, L.from, L.to, L.loc, L.people || '', L.cakes || '', JSON.stringify(L.days || []), JSON.stringify(L.info || {}),
    JSON.stringify(L.items || []), L.status, L.quote || '', (L.crew || []).join('、'), L.by, L.at, ops_now_(), JSON.stringify(L.buy || []), JSON.stringify(L.boxes || []), L.country || '', L.volt || ''];
  var sh = eq_sheet_('設備清單', EQ_HEAD), row = L.row || sh.getLastRow() + 1, rng = sh.getRange(row, 1, 1, EQ_HEAD.length);
  rng.setNumberFormat('@'); rng.setValues([v.map(String)]); L.row = row;
}
// 依人數、顆數算數量（只算有「計算」的項目；手動改過的 qm=1 不再自動算）
function eq_calcQty_(L) {
  var per = eq_perBatch_(), total = eq_num_(L.cakes);
  if (L.days && L.days.length) total = L.days.reduce(function (a, d) { return a + eq_num_(d.n); }, 0) || total;
  (L.items || []).forEach(function (it) {
    if (it.qm) return;
    if (it.k === '人' && L.people > 0) it.q = L.people;
    if (it.k === '百顆' && total > 0) it.q = Math.ceil(total / per);
  });
}
// 當地採購：每天批數 × 每批用量
function eq_buyPlan_(L) {
  var per = eq_perBatch_(), days = (L.days || []).filter(function (d) { return eq_num_(d.n) > 0; });
  if (!(L.buy || []).length || !days.length) return null;
  var rows = days.map(function (d) {
    var b = Math.ceil(eq_num_(d.n) / per);
    return { d: d.d, n: eq_num_(d.n), batches: b, items: L.buy.map(function (x) { return { n: x.n, u: x.u, a: Math.round(eq_num_(x.a) * b * 10) / 10 }; }) };
  });
  var tb = rows.reduce(function (a, r) { return a + r.batches; }, 0);
  return { per: per, days: rows, batches: tb, total: L.buy.map(function (x) { return { n: x.n, u: x.u, a: Math.round(eq_num_(x.a) * tb * 10) / 10, each: eq_num_(x.a) }; }) };
}
function eq_stageCount_(L) {
  var n = L.items.length, c = [0, 0, 0], bad = 0, fix = 0, cost = 0;
  L.items.forEach(function (it) {
    var st = it.st || [];
    for (var i = 0; i < 3; i++) if (st[i]) c[i]++;
    if (it.back && it.back !== 'ok') { bad++; if (!it.fixed) { fix++; cost += (it.p || 0) * Math.max(1, eq_num_(it.miss) || 1); } }
  });
  return { n: n, done: c, bad: bad, fix: fix, cost: cost };
}
function eq_summary_(L) {
  var sc = eq_stageCount_(L);
  return { id: L.id, tpl: L.tpl, type: L.type, name: L.name, from: L.from, to: L.to, loc: L.loc, status: L.status, quote: L.quote, crew: L.crew,
    by: L.by, at: L.at, updated: L.updated, n: sc.n, done: sc.done, bad: sc.bad, fix: sc.fix, cost: sc.cost, stages: EQ_STAGES[L.type] || EQ_STAGES['活動'], country: L.country };
}
function eq_full_(L) {
  var o = eq_summary_(L);
  ['people', 'cakes', 'days', 'info', 'items', 'buy', 'boxes', 'volt'].forEach(function (k) { o[k] = L[k]; });
  o.plan = eq_buyPlan_(L);
  var names = {}; try { ops_staff_().list.forEach(function (s) { names[s.id] = s.nick || s.name; }); } catch (e) {}
  o.crewNames = L.crew.map(function (id) { return names[id] || id; });
  return o;
}
function eq_staffNames_() {
  var out = []; try { ops_staff_().list.forEach(function (s) { if (!s.left) out.push({ id: s.id, name: s.nick || s.name, role: s.role }); }); } catch (e) {}
  return out;
}

// ── API ──
function eq_meta_(p) {
  var me = eq_who_(p), admin = me.role >= 3;
  var tpls = eq_tpls_().map(function (t) {
    var o = { name: t.name, type: t.type, country: t.country, volt: t.volt, info: t.info, n: t.items.length, buy: t.buy, boxes: t.boxes, by: t.by, at: t.at };
    if (admin && p.full) o.items = t.items;
    return o;
  });
  return { success: true, types: EQ_TYPES, stages: EQ_STAGES, perBatch: eq_perBatch_(), tpls: tpls, admin: admin, people: admin ? eq_staffNames_() : [] };
}
function eq_list_(p) {
  var me = eq_who_(p), all = eq_lists_().filter(function (L) { return eq_canSee_(me, L); });
  var t = eq_today_(), lim = eq_addDay_(t, -60);
  var data = all.filter(function (L) { return p.all || L.status === '準備中' || L.to >= lim || eq_stageCount_(L).fix > 0; })
    .sort(function (a, b) { return (a.status === '準備中' ? 0 : 1) - (b.status === '準備中' ? 0 : 1) || (a.from < b.from ? -1 : a.from > b.from ? 1 : 0); })
    .map(eq_summary_);
  return { success: true, data: data.slice(0, 200), admin: me.role >= 3 };
}
function eq_get_(p) {
  var me = eq_who_(p), L = eq_find_(p.id);
  if (!eq_canSee_(me, L)) throw new Error('你沒有被排進這張清單');
  var o = eq_full_(L); o.admin = me.role >= 3; o.me = me.id; return { success: true, data: o };
}
// 建立：從模板（可帶報價單）
function eq_create_(p) {
  var me = eq_admin_();
  var t = eq_tpls_().filter(function (x) { return x.name === String(p.tpl || ''); })[0]; if (!t) return { error: '找不到模板「' + (p.tpl || '') + '」' };
  var L = { id: 'EQ' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss') + Utilities.getUuid().replace(/-/g, '').slice(0, 4).toUpperCase(),
    tpl: t.name, type: t.type, name: eq_str_(p.name, 60), from: eq_day_(p.from), to: eq_day_(p.to) || eq_day_(p.from), loc: eq_str_(p.loc, 80),
    people: Math.max(0, Math.round(eq_num_(p.people))), cakes: Math.max(0, Math.round(eq_num_(p.cakes))), days: [], info: {}, items: [], status: '準備中',
    quote: '', crew: [], by: me.id, at: ops_now_(), buy: t.buy || [], boxes: t.boxes || [], country: t.country || '', volt: t.volt || '' };
  var info = eq_j_(p.info, {}); (t.info || []).forEach(function (k) { if (info[k] !== undefined) L.info[k] = eq_str_(info[k], 200); });
  var crew = eq_j_(p.crew, []); var staff = ops_staff_().map;
  L.crew = (Array.isArray(crew) ? crew : String(crew).split(/[、,\s]+/)).map(String).filter(function (id) { return staff[id] && !staff[id].left; }).slice(0, 30);
  var days = eq_j_(p.days, []); if (Array.isArray(days)) L.days = days.map(function (d) { return { d: eq_day_(d.d), n: Math.max(0, Math.round(eq_num_(d.n))) }; }).filter(function (d) { return d.d; }).slice(0, 60);
  var opt = eq_j_(p.opts, {});
  // 報價單帶入
  if (p.quote) {
    var q = null; try { q = qt_rows_().filter(function (x) { return x.id === String(p.quote); })[0]; } catch (e) {}
    if (!q) return { error: '找不到這張報價單' };
    var f = eq_j_(q.form, {}) || {}, dates = String(q.dates || '').split('、').map(eq_day_).filter(String).sort();
    L.quote = q.id;
    if (!L.name) L.name = (q.event || '活動') + (q.client ? '｜' + q.client : '');
    if (!L.from && dates.length) { L.from = dates[0]; L.to = dates[dates.length - 1]; }
    if (!L.loc) L.loc = String(f.eLoc || '');
    var perDay = Math.max(0, Math.round(eq_num_(f.qty)));
    if (!L.cakes && perDay) L.cakes = perDay * Math.max(1, dates.length);
    if (!L.days.length && perDay && t.type === '出國') L.days = dates.map(function (d) { return { d: d, n: perDay }; });
    var set = function (k, v) { if (v && (t.info || []).indexOf(k) >= 0 && !L.info[k]) L.info[k] = eq_str_(v, 200); };
    set('活動名稱', q.event); set('活動日期', q.dates); set('活動地點', f.eLoc); set('活動時間', [f.eS, f.eE].filter(String).join('～'));
    set('進場日期與時間', f.eS ? (dates[0] || '') + ' ' + f.eS : ''); set('雞蛋糕數量', perDay ? perDay + ' 顆／天 × ' + dates.length + ' 天' : '');
    set('包材類別', f.pkg1n); set('品牌客戶抬頭', q.client); set('客戶統編', f.cT); set('客戶聯絡人', f.wN); set('客戶電話', f.wP);
    set('電力準備', f.ovenQty ? '烤爐 ' + f.ovenQty + ' 台（每台 1,500W）' : '');
    opt.ovens = opt.ovens || eq_num_(f.ovenQty); if (f.mold === false) opt.noMold = true;
  }
  if (!L.name) return { error: '請填清單名稱' };
  if (!L.from) return { error: '請選日期' };
  if (L.to < L.from) L.to = L.from;
  L.items = eq_cleanItems_(t.items).map(function (it) {
    if (opt.ovens > 0 && it.n === '機器') it.q = opt.ovens;
    it.st = [null, null, null]; return it;
  }).filter(function (it) { return !(opt.noMold && it.n === '客製模具'); });
  eq_calcQty_(L);
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try { eq_write_(L); } finally { lock.releaseLock(); }
  return { success: true, id: L.id, data: eq_full_(L) };
}
// 勾選：stage 0/1/2；on=true/false；第三關可帶 back='ok'|'少'|'壞'、miss=數量
function eq_check_(p) {
  var me = eq_who_(p), lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var L = eq_find_(p.id);
    if (!(me.role >= 2 || L.crew.indexOf(me.id) >= 0 || L.by === me.id)) throw new Error('你沒有被排進這張清單，請管理者把你加進出勤夥伴');
    if (L.status !== '準備中') throw new Error('這張清單已經' + L.status + '，不能再勾');
    var stage = Math.round(eq_num_(p.stage)); if (stage < 0 || stage > 2) throw new Error('關卡不對');
    var ids = eq_j_(p.items, null); if (!Array.isArray(ids)) ids = [String(p.item || '')];
    var on = !(p.on === false || p.on === 'false' || p.on === 0 || p.on === '0'), back = String(p.back || ''), hit = 0, now = ops_now_();
    L.items.forEach(function (it) {
      if (ids.indexOf(it.id) < 0) return; hit++;
      it.st = it.st || [null, null, null];
      if (stage === 2 && back) {
        if (['ok', '少', '壞'].indexOf(back) < 0) throw new Error('點收狀態不對');
        it.back = back; it.miss = back === 'ok' ? 0 : Math.max(1, Math.min(eq_num_(it.q) || 1, Math.round(eq_num_(p.miss) || 1)));
        it.st[2] = { by: me.nick || me.name, at: now }; if (back === 'ok') { delete it.fixed; }
        if (p.note !== undefined) it.bn = eq_str_(p.note, 100);
      } else {
        it.st[stage] = on ? { by: me.nick || me.name, at: now } : null;
        if (stage === 2 && !on) { delete it.back; delete it.miss; delete it.fixed; delete it.bn; }
        if (stage === 2 && on && !it.back) it.back = 'ok';
      }
    });
    if (!hit) throw new Error('找不到這個項目');
    eq_write_(L);
    return { success: true, data: eq_full_(L) };
  } finally { lock.releaseLock(); }
}
// 修改清單（Lv.3）：基本資料、資訊欄、項目、每日顆數、出勤夥伴、狀態
function eq_save_(p) {
  var me = eq_admin_(), lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var L = eq_find_(p.id), d = eq_j_(p.data, {}) || {};
    if (d.name !== undefined) L.name = eq_str_(d.name, 60) || L.name;
    if (d.from !== undefined) L.from = eq_day_(d.from) || L.from;
    if (d.to !== undefined) L.to = eq_day_(d.to) || L.from;
    if (L.to < L.from) L.to = L.from;
    if (d.loc !== undefined) L.loc = eq_str_(d.loc, 80);
    if (d.people !== undefined) L.people = Math.max(0, Math.round(eq_num_(d.people)));
    if (d.cakes !== undefined) L.cakes = Math.max(0, Math.round(eq_num_(d.cakes)));
    if (d.days !== undefined) L.days = (d.days || []).map(function (x) { return { d: eq_day_(x.d), n: Math.max(0, Math.round(eq_num_(x.n))) }; }).filter(function (x) { return x.d; }).slice(0, 60);
    if (d.info !== undefined) { var o = {}; for (var k in d.info) o[eq_str_(k, 30)] = eq_str_(d.info[k], 200); L.info = o; }
    if (d.crew !== undefined) { var staff = ops_staff_().map; L.crew = (d.crew || []).map(String).filter(function (id) { return staff[id] && !staff[id].left; }).slice(0, 30); }
    if (d.buy !== undefined) L.buy = (d.buy || []).map(function (x) { return { n: eq_str_(x.n, 20), a: eq_num_(x.a), u: eq_str_(x.u, 8) }; }).filter(function (x) { return x.n; }).slice(0, 30);
    if (d.items !== undefined) {         // 保留已勾的紀錄
      var old = {}; L.items.forEach(function (it) { old[it.id] = it; });
      L.items = eq_cleanItems_(d.items).map(function (it, i) {
        var o = old[it.id], src = d.items[i] || {};
        if (o) { ['st', 'back', 'miss', 'fixed', 'bn', 'qm'].forEach(function (k) { if (o[k] !== undefined) it[k] = o[k]; }); if (Number(o.q) !== Number(it.q)) it.qm = 1; }
        else { it.id = 'n' + Date.now().toString(36) + i; it.st = [null, null, null]; }
        if (src.qm === 0) delete it.qm;
        return it;
      });
    }
    if (d.status !== undefined) { if (['準備中', '已完成', '取消'].indexOf(d.status) < 0) return { error: '狀態不對' }; L.status = d.status; }
    eq_calcQty_(L);
    eq_write_(L);
    return { success: true, data: eq_full_(L) };
  } finally { lock.releaseLock(); }
}
// 待補購：標「已補購」（Lv.3）
function eq_fix_(p) {
  var me = eq_admin_(), lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var L = eq_find_(p.id), ids = eq_j_(p.items, null); if (!Array.isArray(ids)) ids = [String(p.item || '')];
    var on = !(p.on === false || p.on === 'false'), hit = 0;
    L.items.forEach(function (it) { if (ids.indexOf(it.id) >= 0 && it.back && it.back !== 'ok') { hit++; if (on) it.fixed = { by: me.nick || me.name, at: ops_now_() }; else delete it.fixed; } });
    if (!hit) return { error: '沒有要補購的項目' };
    eq_write_(L);
    return { success: true, data: eq_full_(L) };
  } finally { lock.releaseLock(); }
}
// 全部待補購（跨清單）
function eq_fixList_(p) {
  var me = eq_who_(p); if (me.role < 2) throw new Error('需要 Lv.2 以上');
  var out = [];
  eq_lists_().forEach(function (L) {
    L.items.forEach(function (it) {
      if (it.back && it.back !== 'ok' && !it.fixed) out.push({ list: L.id, listName: L.name, date: L.from, id: it.id, n: it.n, c: it.c, back: it.back, miss: it.miss || 1, u: it.u, p: it.p || 0, cost: (it.p || 0) * (it.miss || 1), note: it.bn || '', by: it.st && it.st[2] ? it.st[2].by : '' });
    });
  });
  return { success: true, data: out, total: out.reduce(function (a, x) { return a + x.cost; }, 0) };
}
// 模板：存（新增或修改；改名時 old 帶舊名）
function eq_tplSave_(p) {
  var me = eq_admin_(), t = eq_j_(p.tpl, {}) || {};
  var name = eq_str_(t.name, 30); if (!name) return { error: '請填模板名稱' };
  if (EQ_TYPES.indexOf(t.type) < 0) return { error: '類型要是 ' + EQ_TYPES.join('／') };
  var items = eq_cleanItems_(t.items); if (!items.length) return { error: '模板至少要有一個項目' };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var all = eq_tpls_(), old = String(p.old || ''), hit = old ? all.filter(function (x) { return x.name === old; })[0] : null;
    if (old && !hit) return { error: '找不到原本的模板「' + old + '」' };
    if (all.some(function (x) { return x.name === name && (!hit || x.row !== hit.row); })) return { error: '已經有叫「' + name + '」的模板' };
    var row = { name: name, type: t.type, country: eq_str_(t.country, 20), volt: eq_str_(t.volt, 10),
      info: (t.info || []).map(function (x) { return eq_str_(x, 30); }).filter(String).slice(0, 40), items: items,
      buy: (t.buy || []).map(function (x) { return { n: eq_str_(x.n, 20), a: eq_num_(x.a), u: eq_str_(x.u, 8) }; }).filter(function (x) { return x.n; }).slice(0, 30),
      boxes: (t.boxes || []).map(function (x) { return eq_str_(x, 30); }).filter(String).slice(0, 20), sort: hit ? hit.sort : all.length + 1 };
    var sh = eq_sheet_('設備模板', EQ_TPL_HEAD), r = hit ? hit.row : sh.getLastRow() + 1;
    sh.getRange(r, 1, 1, EQ_TPL_HEAD.length).setValues([eq_tplRow_(row, me)]);
  } finally { lock.releaseLock(); }
  return { success: true, name: name };
}
function eq_tplDel_(p) {
  var me = eq_admin_(), hit = eq_tpls_().filter(function (x) { return x.name === String(p.name || ''); })[0];
  if (!hit) return { error: '找不到這個模板' };
  if (eq_tpls_().length <= 1) return { error: '至少要留一個模板' };
  eq_sheet_('設備模板', EQ_TPL_HEAD).deleteRow(hit.row);
  return { success: true };
}
// 首頁提醒：3 天內要出發、打包還沒完成；收攤後還沒點收；待補購（Lv.3）
function eq_todo_(empId) {
  var out = [];
  try {
    var tid = au_verifiedId_(); if (!tid) return out;   // v2（部署端）：沒有通行證不顯示設備提醒（含待補購金額）
    var me = ops_me_(tid), t = eq_today_(), soon = eq_addDay_(t, 3), fixN = 0, fixCost = 0;
    eq_lists_().forEach(function (L) {
      var mine = L.crew.indexOf(me.id) >= 0 || L.by === me.id || (me.role >= 3 && !L.crew.length);
      var sc = eq_stageCount_(L); fixN += sc.fix; fixCost += sc.cost;
      if (L.status !== '準備中' || !mine) return;
      var stg = EQ_STAGES[L.type] || EQ_STAGES['活動'];
      if (L.from >= t && L.from <= soon && sc.done[0] < sc.n) {
        var when = L.from === t ? '今天' : L.from === eq_addDay_(t, 1) ? '明天' : L.from.slice(5).replace('-', '/');
        out.push({ icon: '🧰', text: when + '「' + L.name + '」' + stg[0] + '還有 ' + (sc.n - sc.done[0]) + ' 項沒打勾', tab: 'equip', red: L.from <= eq_addDay_(t, 1), eq: L.id });
      } else if (L.to < t && L.to >= eq_addDay_(t, -7) && sc.done[2] < sc.n) {
        out.push({ icon: '📦', text: '「' + L.name + '」' + stg[2] + '還有 ' + (sc.n - sc.done[2]) + ' 項', tab: 'equip', red: false, eq: L.id });
      }
    });
    if (me.role >= 3 && fixN) out.push({ icon: '🛒', text: '設備待補購 ' + fixN + ' 項' + (fixCost ? '（約 ' + fixCost.toLocaleString() + ' 元）' : ''), tab: 'equip', red: false });
  } catch (e) {}
  return out;
}

AU_READ = new RegExp(AU_READ.source.replace('|quotePage|quoteList)$', '|quotePage|quoteList|eqMeta|eqGet|eqFixList)$'));

function eqHandler_(action, p) {
  if (action === 'homeTodo') {            // 接在 v1.30 的首頁待辦後面
    try {
      var t = s30Handler_('homeTodo', p);
      if (t && t.success) { var ex = eq_todo_(p.empId); if (ex.length) t.data = ex.concat(t.data || []); }
      return t;
    } catch (e) { return null; }
  }
  var map = { eqMeta: eq_meta_, eqList: eq_list_, eqGet: eq_get_, eqCreate: eq_create_, eqCheck: eq_check_, eqSave: eq_save_,
    eqFix: eq_fix_, eqFixList: eq_fixList_, eqTplSave: eq_tplSave_, eqTplDel: eq_tplDel_ };
  if (!map[action]) return null;
  try { OPS_C_ = {}; return map[action](p); } catch (e) { return { error: e.message }; }
}

// 部署後執行一次：建分頁、放入模板（已經有同名模板就不動，不會蓋掉你改過的）
function eq_setup() {
  OPS_C_ = {};
  eq_sheet_('設備清單', EQ_HEAD);
  var have = {}; eq_tpls_().forEach(function (t) { have[t.name] = 1; });
  var sh = eq_sheet_('設備模板', EQ_TPL_HEAD), add = 0;
  EQ_SEED.forEach(function (t, i) {
    if (have[t.name]) return;
    t.items = eq_cleanItems_(t.items); t.sort = i + 1;
    sh.getRange(sh.getLastRow() + 1, 1, 1, EQ_TPL_HEAD.length).setValues([eq_tplRow_(t, null)]); add++;
  });
  try { if (!String(ops_param_('每包麵粉顆數') || '')) { var ps = ops_ss_().getSheetByName('參數設定'); if (ps) ps.appendRow(['每包麵粉顆數', EQ_PER_BATCH, '設備檢查清單：1 包麵粉／1 批麵糊約幾顆']); } } catch (e) {}
  Logger.log('eq_setup 完成：新增模板 ' + add + ' 份');
  return add;
}

// 隊長 11/13 給的 Excel：《出攤準備檢查清單》《生財工具箱》（各國＋價格表）＋ 11/14 補的設櫃項目
var EQ_SEED = [{"name":"活動出攤","type":"活動","info":["活動名稱","活動日期","活動地點","活動時間","進場日期與時間","雞蛋糕數量","雞蛋糕份數","每份數量","包材類別","發放方式","電力準備","桌子準備","其他事項","品牌客戶抬頭","客戶統編","客戶聯絡人","客戶電話"],"items":[{"c":"食材與麵糊準備","n":"保冰桶","q":1},{"c":"食材與麵糊準備","n":"冰磚","q":1},{"c":"食材與麵糊準備","n":"保冷袋","q":1},{"c":"食材與麵糊準備","n":"麵糊","q":1},{"c":"食材與麵糊準備","n":"低筋麵粉","q":1},{"c":"食材與麵糊準備","n":"二砂糖","q":1},{"c":"食材與麵糊準備","n":"攪拌器","q":1},{"c":"食材與麵糊準備","n":"攪拌器盒子","q":1},{"c":"食材與麵糊準備","n":"冷水壺","q":1},{"c":"食材與麵糊準備","n":"麵糊器","q":1},{"c":"食材與麵糊準備","n":"鐵盤","q":1},{"c":"食材與麵糊準備","n":"夾子","q":1,"p":50},{"c":"用電與機具","n":"機器","q":1},{"c":"用電與機具","n":"烙鐵棒","q":1},{"c":"用電與機具","n":"烙鐵架","q":1},{"c":"用電與機具","n":"烙鐵刷子","q":1},{"c":"用電與機具","n":"烙鐵頭","q":1},{"c":"用電與機具","n":"客製模具","q":1},{"c":"用電與機具","n":"電風扇","q":1},{"c":"用電與機具","n":"延長線","q":1,"p":300},{"c":"用電與機具","n":"多頭延長線","q":1},{"c":"用電與機具","n":"轉接頭","q":1},{"c":"用電與機具","n":"變壓器","q":1},{"c":"用電與機具","n":"測電壓器","q":1},{"c":"製作與維修器具","n":"器具桶","q":1},{"c":"製作與維修器具","n":"雞蛋蛋糕專屬叉子","q":1},{"c":"製作與維修器具","n":"毛刷","q":1},{"c":"製作與維修器具","n":"烤盤油","q":1,"p":150},{"c":"製作與維修器具","n":"平刀","q":1},{"c":"製作與維修器具","n":"測溫槍","q":1,"p":400},{"c":"製作與維修器具","n":"計時器","q":1,"p":100},{"c":"製作與維修器具","n":"六角扳手 5 號","q":1},{"c":"製作與維修器具","n":"六角扳手 2 號","q":1},{"c":"製作與維修器具","n":"十字起子","q":1,"p":30},{"c":"製作與維修器具","n":"大力膠帶","q":1},{"c":"製作與維修器具","n":"雙面膠帶","q":1},{"c":"包材","n":"空白紙袋或品牌紙袋","q":1},{"c":"包材","n":"紙盒","q":1},{"c":"包材","n":"薯條杯","q":1},{"c":"包材","n":"竹籤","q":1},{"c":"包材","n":"竹籤筒","q":1},{"c":"包材","n":"塑膠袋","q":1},{"c":"攤位陳設","n":"置物桶","q":1},{"c":"攤位陳設","n":"保溫箱","q":1},{"c":"攤位陳設","n":"桌布","q":1},{"c":"攤位陳設","n":"布招牌","q":1},{"c":"攤位陳設","n":"品牌輸出","q":1},{"c":"攤位陳設","n":"品牌簡介","q":1},{"c":"攤位陳設","n":"擺飾用草皮","q":1},{"c":"攤位陳設","n":"擺飾用盆栽","q":1},{"c":"攤位陳設","n":"竹籃","q":1},{"c":"攤位陳設","n":"推車","q":1},{"c":"清潔與衛生","n":"酒精","q":1},{"c":"清潔與衛生","n":"口罩","q":1},{"c":"清潔與衛生","n":"衛生手套","q":1},{"c":"清潔與衛生","n":"濕紙巾","q":1},{"c":"清潔與衛生","n":"抹布","q":1,"p":15},{"c":"人員服裝","n":"帽子","q":1},{"c":"人員服裝","n":"品牌制服","q":1},{"c":"人員服裝","n":"圍裙","q":1}]},{"name":"百貨快閃","type":"快閃","info":["活動名稱","活動日期","活動地點","活動時間","進場日期與時間","雞蛋糕數量","雞蛋糕份數","每份數量","包材類別","發放方式","電力準備","桌子準備","其他事項","品牌客戶抬頭","客戶統編","客戶聯絡人","客戶電話"],"items":[{"c":"食材與麵糊準備","n":"保冰桶","q":1},{"c":"食材與麵糊準備","n":"冰磚","q":1},{"c":"食材與麵糊準備","n":"保冷袋","q":1},{"c":"食材與麵糊準備","n":"麵糊","q":1},{"c":"食材與麵糊準備","n":"低筋麵粉","q":1},{"c":"食材與麵糊準備","n":"二砂糖","q":1},{"c":"食材與麵糊準備","n":"攪拌器","q":1},{"c":"食材與麵糊準備","n":"攪拌器盒子","q":1},{"c":"食材與麵糊準備","n":"冷水壺","q":1},{"c":"食材與麵糊準備","n":"麵糊器","q":1},{"c":"食材與麵糊準備","n":"鐵盤","q":1},{"c":"食材與麵糊準備","n":"夾子","q":1,"p":50},{"c":"用電與機具","n":"機器","q":1},{"c":"用電與機具","n":"烙鐵棒","q":1},{"c":"用電與機具","n":"烙鐵架","q":1},{"c":"用電與機具","n":"烙鐵刷子","q":1},{"c":"用電與機具","n":"烙鐵頭","q":1},{"c":"用電與機具","n":"客製模具","q":1},{"c":"用電與機具","n":"電風扇","q":1},{"c":"用電與機具","n":"延長線","q":1,"p":300},{"c":"用電與機具","n":"多頭延長線","q":1},{"c":"用電與機具","n":"轉接頭","q":1},{"c":"用電與機具","n":"變壓器","q":1},{"c":"用電與機具","n":"測電壓器","q":1},{"c":"製作與維修器具","n":"器具桶","q":1},{"c":"製作與維修器具","n":"雞蛋蛋糕專屬叉子","q":1},{"c":"製作與維修器具","n":"毛刷","q":1},{"c":"製作與維修器具","n":"烤盤油","q":1,"p":150},{"c":"製作與維修器具","n":"平刀","q":1},{"c":"製作與維修器具","n":"測溫槍","q":1,"p":400},{"c":"製作與維修器具","n":"計時器","q":1,"p":100},{"c":"製作與維修器具","n":"六角扳手 5 號","q":1},{"c":"製作與維修器具","n":"六角扳手 2 號","q":1},{"c":"製作與維修器具","n":"十字起子","q":1,"p":30},{"c":"製作與維修器具","n":"大力膠帶","q":1},{"c":"製作與維修器具","n":"雙面膠帶","q":1},{"c":"包材","n":"空白紙袋或品牌紙袋","q":1},{"c":"包材","n":"紙盒","q":1},{"c":"包材","n":"薯條杯","q":1},{"c":"包材","n":"竹籤","q":1},{"c":"包材","n":"竹籤筒","q":1},{"c":"包材","n":"塑膠袋","q":1},{"c":"攤位陳設","n":"置物桶","q":1},{"c":"攤位陳設","n":"保溫箱","q":1},{"c":"攤位陳設","n":"桌布","q":1},{"c":"攤位陳設","n":"布招牌","q":1},{"c":"攤位陳設","n":"品牌輸出","q":1},{"c":"攤位陳設","n":"品牌簡介","q":1},{"c":"攤位陳設","n":"擺飾用草皮","q":1},{"c":"攤位陳設","n":"擺飾用盆栽","q":1},{"c":"攤位陳設","n":"竹籃","q":1},{"c":"攤位陳設","n":"推車","q":1},{"c":"清潔與衛生","n":"酒精","q":1},{"c":"清潔與衛生","n":"口罩","q":1},{"c":"清潔與衛生","n":"衛生手套","q":1},{"c":"清潔與衛生","n":"濕紙巾","q":1},{"c":"清潔與衛生","n":"抹布","q":1,"p":15},{"c":"人員服裝","n":"帽子","q":1},{"c":"人員服裝","n":"品牌制服","q":1},{"c":"人員服裝","n":"圍裙","q":1}]},{"name":"設櫃","type":"設櫃","info":["櫃位名稱","進櫃日期","撤櫃日期","進場時間","百貨聯絡人","聯絡電話","電力","櫃位尺寸","其他事項"],"items":[{"c":"設櫃專屬","n":"上掀式冰箱","q":1,"u":"台"},{"c":"設櫃專屬","n":"工作桌","q":1,"u":"張"},{"c":"設櫃專屬","n":"零用金","d":"開櫃找零","q":1,"u":"份"},{"c":"設櫃專屬","n":"價目表","q":1,"u":"份"},{"c":"設櫃專屬","n":"輸出","d":"品牌輸出／海報","q":1,"u":"份"},{"c":"設櫃專屬","n":"裝潢木板","q":1,"u":"組"},{"c":"設櫃專屬","n":"收銀機","q":1,"u":"台"},{"c":"設櫃專屬","n":"櫃位衛生證照","d":"影本，放櫃上","q":1,"u":"份"},{"c":"設櫃專屬","n":"保險資料","d":"產品責任險／公共意外險","q":1,"u":"份"},{"c":"設櫃專屬","n":"每日手寫報表","q":1,"u":"本"},{"c":"食材與麵糊準備","n":"保冰桶","q":1},{"c":"食材與麵糊準備","n":"冰磚","q":1},{"c":"食材與麵糊準備","n":"保冷袋","q":1},{"c":"食材與麵糊準備","n":"麵糊","q":1},{"c":"食材與麵糊準備","n":"低筋麵粉","q":1},{"c":"食材與麵糊準備","n":"二砂糖","q":1},{"c":"食材與麵糊準備","n":"攪拌器","q":1},{"c":"食材與麵糊準備","n":"攪拌器盒子","q":1},{"c":"食材與麵糊準備","n":"冷水壺","q":1},{"c":"食材與麵糊準備","n":"麵糊器","q":1},{"c":"食材與麵糊準備","n":"鐵盤","q":1},{"c":"用電與機具","n":"機器","q":1},{"c":"用電與機具","n":"烙鐵棒","q":1},{"c":"用電與機具","n":"烙鐵架","q":1},{"c":"用電與機具","n":"烙鐵刷子","q":1},{"c":"用電與機具","n":"烙鐵頭","q":1},{"c":"用電與機具","n":"客製模具","q":1},{"c":"用電與機具","n":"電風扇","q":1},{"c":"用電與機具","n":"多頭延長線","q":1},{"c":"用電與機具","n":"轉接頭","q":1},{"c":"用電與機具","n":"變壓器","q":1},{"c":"用電與機具","n":"測電壓器","q":1},{"c":"製作與維修器具","n":"器具桶","q":1},{"c":"製作與維修器具","n":"雞蛋蛋糕專屬叉子","q":1},{"c":"製作與維修器具","n":"毛刷","q":1},{"c":"製作與維修器具","n":"平刀","q":1},{"c":"製作與維修器具","n":"六角扳手 5 號","q":1},{"c":"製作與維修器具","n":"六角扳手 2 號","q":1},{"c":"製作與維修器具","n":"大力膠帶","q":1},{"c":"製作與維修器具","n":"雙面膠帶","q":1},{"c":"包材","n":"空白紙袋或品牌紙袋","q":1},{"c":"包材","n":"紙盒","q":1},{"c":"包材","n":"薯條杯","q":1},{"c":"包材","n":"竹籤","q":1},{"c":"包材","n":"竹籤筒","q":1},{"c":"包材","n":"塑膠袋","q":1},{"c":"攤位陳設","n":"置物桶","q":1},{"c":"攤位陳設","n":"保溫箱","q":1},{"c":"攤位陳設","n":"桌布","q":1},{"c":"攤位陳設","n":"布招牌","q":1},{"c":"攤位陳設","n":"品牌輸出","q":1},{"c":"攤位陳設","n":"品牌簡介","q":1},{"c":"攤位陳設","n":"擺飾用草皮","q":1},{"c":"攤位陳設","n":"擺飾用盆栽","q":1},{"c":"攤位陳設","n":"竹籃","q":1},{"c":"攤位陳設","n":"推車","q":1},{"c":"清潔與衛生","n":"酒精","q":1},{"c":"清潔與衛生","n":"衛生手套","q":1},{"c":"人員服裝","n":"帽子","q":1},{"c":"人員服裝","n":"品牌制服","q":1},{"c":"人員服裝","n":"圍裙","q":1},{"c":"生財工具盒","n":"工具盒","d":"22.8*16*6","q":1,"u":"個","p":150},{"c":"生財工具盒","n":"挑棒","d":"KAI 貝印 18*2.2*2.2cm","q":2,"u":"支","p":99,"m":"230度"},{"c":"生財工具盒","n":"夾子","d":"8寸","q":1,"u":"支","p":50,"m":"不鏽鋼"},{"c":"生財工具盒","n":"刷子","d":"20*3.5*3cm","q":1,"u":"支","p":50,"m":"210度"},{"c":"生財工具盒","n":"油刷","d":"2.3*17cm","q":1,"u":"支","p":10},{"c":"生財工具盒","n":"白鐵漆刀","d":"宏牌 19*6cm","q":1,"u":"支","p":35},{"c":"生財工具盒","n":"測溫槍","d":"標智 GM320","q":1,"u":"支","p":400},{"c":"生財工具盒","n":"六角3/5號","d":"3mm、5mm","q":1,"u":"組","p":50},{"c":"生財工具盒","n":"十字起子","d":"16cm","q":1,"u":"支","p":30},{"c":"生財工具盒","n":"計時器","d":"聖岡 CT-68","q":2,"u":"個","p":100},{"c":"生財工具盒","n":"鹼性電池","d":"4號","q":2,"u":"個","p":10},{"c":"生財工具盒","n":"水銀電池","d":"LR44","q":2,"u":"個","p":10},{"c":"生財工具盒","n":"原子筆","d":"藍","q":1,"u":"支","p":15},{"c":"生財工具盒","n":"白板筆","d":"百樂 WMBM-12L","q":1,"u":"支","p":36},{"c":"生財工具盒","n":"補充液","d":"百樂 WMBM-12L","q":1,"u":"支","p":23},{"c":"生財工具盒","n":"轉接頭T","d":"萬國 WD-21(2500W)","q":1,"u":"個","p":290},{"c":"生財工具盒","n":"轉接頭H","d":"萬寶 WA-6(1500W)","q":1,"u":"個","p":100},{"c":"生財工具盒","n":"定量器彈簧","d":"線徑1.2mm","q":2,"u":"個","p":50},{"c":"生財工具箱","n":"工具箱","d":"KEYWAY聯府 58*42*34cm","q":1,"u":"組","p":500},{"c":"生財工具箱","n":"紙袋盒","d":"IKEA 33.5*24*14.5cm","q":1,"u":"個","p":110},{"c":"生財工具箱","n":"紙袋","q":6,"u":"捆","p":0},{"c":"生財工具箱","n":"打洞器","d":"SDI手牌 BN07102","q":1,"u":"個","p":300},{"c":"生財工具箱","n":"塑膠提袋","q":1,"u":"包","p":0},{"c":"生財工具箱","n":"布膠","d":"12mm","q":1,"u":"捲","p":110},{"c":"生財工具箱","n":"烤盤油","d":"卡羅 650ml","q":1,"u":"罐","p":150},{"c":"生財工具箱","n":"冷卻盤+網","d":"32*22*4.8","q":1,"u":"個","p":250},{"c":"生財工具箱","n":"風扇","d":"四寸單顆","q":1,"u":"個","p":400},{"c":"生財工具箱","n":"小掃把","d":"IKEA 16.5*20.5*4cm","q":1,"u":"組","p":60},{"c":"生財工具箱","n":"濕紙巾","q":1,"u":"包","p":0},{"c":"生財工具箱","n":"衛生紙","q":1,"u":"包","p":0},{"c":"生財工具箱","n":"餐巾紙","q":1,"u":"捲","p":0},{"c":"生財工具箱","n":"營收報表","q":1,"u":"張","p":0},{"c":"生財工具箱","n":"零用金盒","d":"17*14*3.1cm","q":1,"u":"個","p":100},{"c":"生財工具箱","n":"延長線","d":"心安規 6尺","q":1,"u":"條","p":300},{"c":"生財工具箱","n":"圍裙帽子","q":1,"u":"組","p":0},{"c":"生財工具箱","n":"口罩","q":5,"u":"個","p":0},{"c":"生財工具箱","n":"菜單/口味牌","q":1,"u":"組","p":0},{"c":"生財清潔組","n":"垃圾桶","d":"IKEA 10公升","q":1,"u":"個","p":50},{"c":"生財清潔組","n":"水桶","d":"2公升","q":1,"u":"個","p":40},{"c":"生財清潔組","n":"抹布","d":"30*30cm","q":1,"u":"條","p":15},{"c":"生財清潔組","n":"海綿菜瓜布","d":"10*7*2cm","q":1,"u":"個","p":15},{"c":"生財清潔組","n":"洗碗精","d":"白熊 300g","q":1,"u":"瓶","p":50}]},{"name":"出國-新加坡","type":"出國","country":"新加坡","volt":"220V","items":[{"c":"證件與零用金","n":"護照","d":"護照","q":1,"u":"本","k":"人"},{"c":"證件與零用金","n":"簽證","d":"簽證","q":1,"u":"張","k":"人"},{"c":"證件與零用金","n":"SIM卡","d":"當地漫遊","q":1,"u":"張","k":"人"},{"c":"證件與零用金","n":"零用金","d":"購買食材","q":10000,"u":"元"},{"c":"食材","n":"麵粉","d":"100顆/包","q":18,"u":"包","m":"3000顆","k":"百顆","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕烤爐","n":"烤爐1","d":"台灣造型","q":1,"u":"臺","m":"220v/1500W","b":"保冰桶②｜烤爐"},{"c":"雞蛋糕烤爐","n":"延長線","d":"短","q":1,"u":"條","m":"機器x2、烙鐵、電風扇、攪拌機","b":"保冰桶②｜烤爐","p":300},{"c":"雞蛋糕烤爐","n":"轉接頭","d":"機器","q":2,"u":"個","m":"當地插座/展場2、飯店1","b":"保冰桶②｜烤爐"},{"c":"雞蛋糕製作器具","n":"測溫槍","d":"測量烤爐溫度","q":1,"u":"支","m":"電池x2","b":"保冰桶①｜製作器具","p":400},{"c":"雞蛋糕製作器具","n":"隔熱手套","d":"操作機器","q":1,"u":"雙","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"挑棒","d":"挑雞蛋糕工具","q":1,"u":"支","b":"保冰桶①｜製作器具","p":99},{"c":"雞蛋糕製作器具","n":"計時器","d":"製作計時","q":1,"u":"個","m":"電池x1","b":"保冰桶①｜製作器具","p":100},{"c":"雞蛋糕製作器具","n":"電風扇","d":"雞蛋糕降溫","q":1,"u":"個","m":"50W","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"不鏽鋼盤子","d":"承裝雞蛋糕","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"不鏽鋼架子","d":"承裝雞蛋糕","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"夾子","d":"雞蛋糕包裝","q":1,"u":"支","b":"保冰桶①｜製作器具","p":50},{"c":"雞蛋糕製作器具","n":"烙鐵銅頭","d":"活動LOGO銅頭","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"烙鐵加熱棒","d":"銅頭烙印加熱器具","q":1,"u":"支","m":"150W","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"烙鐵棒架子","d":"烙鐵棒架","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"烙鐵棒刷子","d":"烙鐵頭清潔","q":1,"u":"支","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"冷水壺","d":"麵糊容器","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"定量器","d":"麵糊定量","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"定量器蓋子","d":"麵糊定量器蓋子","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"麵糊製作器具","n":"電子秤","d":"原物料秤重","q":1,"u":"個","m":"電池x2","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"攪拌鍋","d":"麵糊容器","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"量杯","d":"500cc植物油","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"量杯","d":"1000cc雞蛋、牛奶","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"塑膠碗","d":"裝糖容器","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"攪拌機","d":"麵糊攪拌","q":1,"u":"支","m":"用電","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"過濾網","d":"過濾麵糊","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"刮刀","d":"麵糊攪拌","q":1,"u":"支","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"封口夾","d":"糖封口","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"五斤袋","d":"麵糊容器","q":1,"u":"包","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"工具盒","d":"打麵糊工具盒","q":1,"u":"個","b":"登機箱｜麵糊製作器具","p":150},{"c":"清潔相關用具","n":"刷子","d":"烤爐清潔","q":2,"u":"支","b":"保冰桶①｜製作器具","p":50},{"c":"清潔相關用具","n":"刮刀","d":"麵糊清潔","q":1,"u":"支","b":"保冰桶①｜製作器具"},{"c":"清潔相關用具","n":"小掃把","d":"桌面清潔","q":1,"u":"組","b":"保冰桶①｜製作器具","p":60},{"c":"清潔相關用具","n":"手套","d":"衛生手套","q":1,"u":"盒","b":"保冰桶①｜製作器具"},{"c":"清潔相關用具","n":"菜瓜布","d":"洗器具","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"清潔相關用具","n":"濕紙巾","d":"整理清潔","q":2,"u":"包","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕包材","n":"牛皮紙袋","d":"雞蛋糕包材(100pcs)","q":3,"u":"疊","m":"推廣會用/貴賓用","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕包材","n":"5寸竹籤","d":"雞蛋糕包材","q":2,"u":"包","m":"展場活動","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕包材","n":"竹籤桶","d":"竹籤容器","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"六角組","d":"烤爐機器維修","q":1,"u":"組","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"十字起子","d":"烙鐵機器使用","q":1,"u":"支","b":"保冰桶①｜製作器具","p":30},{"c":"其他工具及備品","n":"電線","d":"烤爐機器維修備品","q":1,"u":"條","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"4號電池","d":"測溫槍2、計時器1、電子秤2","q":5,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"電工膠帶","d":"烤爐機器維修備品","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"雙面膠帶","d":"固定器具用","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"強力膠帶","d":"固定器具用","q":2,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"定量器塞頭","d":"麵糊定量器備品","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"定量器彈簧","d":"麵糊定量器備品","q":1,"u":"個","b":"保冰桶①｜製作器具","p":50},{"c":"其他工具及備品","n":"工具桶","d":"裝雞蛋糕工具","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"制服與裝飾物","n":"制服","d":"工作人員","q":2,"u":"件","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"圍裙","d":"工作人員","q":2,"u":"件","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"竹籃","d":"擺設","q":1,"u":"個","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"桌布","d":"桌布、隔熱","q":3,"u":"條","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"隔熱布","d":"隔熱、蓋機器","q":2,"u":"條","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"布招牌","d":"裝飾佈置","q":2,"u":"條","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"品牌介紹","d":"裝飾佈置","q":1,"u":"個","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"裝飾物","d":"裝飾佈置","q":2,"u":"個","b":"背包①｜衣服"},{"c":"行李","n":"保冰桶","d":"裝雞蛋糕製作器具、裝麵粉","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"保冰桶","d":"裝烤爐","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"登機箱","d":"裝麵糊製作器具","q":1,"u":"個"},{"c":"行李","n":"背包","d":"裝衣服","q":1,"u":"個"},{"c":"行李","n":"背包","d":"裝電腦","q":1,"u":"個"}],"buy":[{"n":"雞蛋","a":15,"u":"顆"},{"n":"牛奶","a":750,"u":"ml"},{"n":"油","a":75,"u":"g"},{"n":"糖","a":550,"u":"g"}],"boxes":["保冰桶①｜製作器具","保冰桶②｜烤爐","登機箱｜麵糊製作器具","背包①｜衣服","背包②｜電腦"],"info":["國家／城市","展場名稱","展場地址","飯店","去程航班","回程航班","當地聯絡人","當地電話","其他事項"]},{"name":"出國-馬來西亞","type":"出國","country":"馬來西亞","volt":"220V","items":[{"c":"證件與零用金","n":"護照","d":"護照","q":2,"u":"本","k":"人"},{"c":"證件與零用金","n":"簽證","d":"簽證","q":2,"u":"張","k":"人"},{"c":"證件與零用金","n":"SIM卡","d":"當地漫遊","q":2,"u":"張","k":"人"},{"c":"證件與零用金","n":"零用金","d":"購買食材","q":10000,"u":"元"},{"c":"食材","n":"麵粉","d":"100顆/包","q":18,"u":"包","m":"3000顆","k":"百顆","b":"塑膠箱②｜麵粉"},{"c":"雞蛋糕烤爐","n":"烤爐1","d":"台灣造型","q":1,"u":"臺","m":"220v/1500W","b":"保冰桶②｜烤爐"},{"c":"雞蛋糕烤爐","n":"烤爐2","d":"愛心烙印","q":1,"u":"臺","m":"220v/1500W","b":"保冰桶②｜烤爐"},{"c":"雞蛋糕烤爐","n":"延長線","d":"短","q":3,"u":"條","m":"機器x2、烙鐵、電風扇、攪拌機","b":"保冰桶②｜烤爐","p":300},{"c":"雞蛋糕烤爐","n":"轉接頭","d":"機器","q":3,"u":"個","m":"當地插座/展場2、飯店1","b":"保冰桶②｜烤爐"},{"c":"雞蛋糕製作器具","n":"測溫槍","d":"測量烤爐溫度","q":1,"u":"支","m":"電池x2","b":"保冰桶①｜製作器具","p":400},{"c":"雞蛋糕製作器具","n":"隔熱手套","d":"操作機器","q":1,"u":"雙","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"挑棒","d":"挑雞蛋糕工具","q":1,"u":"支","b":"保冰桶①｜製作器具","p":99},{"c":"雞蛋糕製作器具","n":"計時器","d":"製作計時","q":1,"u":"個","m":"電池x1","b":"保冰桶①｜製作器具","p":100},{"c":"雞蛋糕製作器具","n":"電風扇","d":"雞蛋糕降溫","q":1,"u":"個","m":"50W","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"不鏽鋼盤子","d":"承裝雞蛋糕","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"不鏽鋼架子","d":"承裝雞蛋糕","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"夾子","d":"雞蛋糕包裝","q":1,"u":"支","b":"保冰桶①｜製作器具","p":50},{"c":"雞蛋糕製作器具","n":"烙鐵銅頭","d":"活動LOGO銅頭","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"烙鐵加熱棒","d":"銅頭烙印加熱器具","q":1,"u":"支","m":"150W","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"烙鐵棒架子","d":"烙鐵棒架","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"烙鐵棒刷子","d":"烙鐵頭清潔","q":1,"u":"支","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"冷水壺","d":"麵糊容器","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"定量器","d":"麵糊定量","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"定量器蓋子","d":"麵糊定量器蓋子","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"麵糊製作器具","n":"電子秤","d":"原物料秤重","q":1,"u":"個","m":"電池x2","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"攪拌鍋","d":"麵糊容器","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"量杯","d":"500cc植物油","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"量杯","d":"1000cc雞蛋、牛奶","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"塑膠碗","d":"裝糖容器","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"攪拌機","d":"麵糊攪拌","q":1,"u":"支","m":"用電","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"過濾網","d":"過濾麵糊","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"刮刀","d":"麵糊攪拌","q":1,"u":"支","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"封口夾","d":"糖封口","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"五斤袋","d":"麵糊容器","q":1,"u":"包","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"工具盒","d":"打麵糊工具盒","q":1,"u":"個","b":"登機箱｜麵糊製作器具","p":150},{"c":"清潔相關用具","n":"刷子","d":"烤爐清潔","q":2,"u":"支","b":"保冰桶①｜製作器具","p":50},{"c":"清潔相關用具","n":"刮刀","d":"麵糊清潔","q":1,"u":"支","b":"保冰桶①｜製作器具"},{"c":"清潔相關用具","n":"小掃把","d":"桌面清潔","q":1,"u":"組","b":"保冰桶①｜製作器具","p":60},{"c":"清潔相關用具","n":"手套","d":"衛生手套","q":1,"u":"盒","b":"保冰桶①｜製作器具"},{"c":"清潔相關用具","n":"菜瓜布","d":"洗器具","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"清潔相關用具","n":"濕紙巾","d":"整理清潔","q":2,"u":"包","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕包材","n":"牛皮紙袋","d":"雞蛋糕包材(100pcs)","q":3,"u":"疊","m":"推廣會用/貴賓用","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕包材","n":"5寸竹籤","d":"雞蛋糕包材","q":2,"u":"包","m":"展場活動","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕包材","n":"竹籤桶","d":"竹籤容器","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"六角組","d":"烤爐機器維修","q":1,"u":"組","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"十字起子","d":"烙鐵機器使用","q":1,"u":"支","b":"保冰桶①｜製作器具","p":30},{"c":"其他工具及備品","n":"電線","d":"烤爐機器維修備品","q":1,"u":"條","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"4號電池","d":"測溫槍2、計時器1、電子秤2","q":5,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"電工膠帶","d":"烤爐機器維修備品","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"雙面膠帶","d":"固定器具用","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"強力膠帶","d":"固定器具用","q":2,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"定量器塞頭","d":"麵糊定量器備品","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"定量器彈簧","d":"麵糊定量器備品","q":1,"u":"個","b":"保冰桶①｜製作器具","p":50},{"c":"其他工具及備品","n":"工具桶","d":"裝雞蛋糕工具","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"制服與裝飾物","n":"制服","d":"工作人員","q":2,"u":"件","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"圍裙","d":"工作人員","q":2,"u":"件","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"竹籃","d":"擺設","q":1,"u":"個","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"桌布","d":"桌布、隔熱","q":3,"u":"條","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"隔熱布","d":"隔熱、蓋機器","q":2,"u":"條","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"布招牌","d":"裝飾佈置","q":2,"u":"條","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"品牌介紹","d":"裝飾佈置","q":1,"u":"個","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"裝飾物","d":"裝飾佈置","q":2,"u":"個","b":"背包①｜衣服"},{"c":"行李","n":"保冰桶","d":"裝雞蛋糕製作器具","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"保冰桶","d":"裝烤爐","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"塑膠箱","d":"裝烤爐","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"塑膠箱","d":"裝麵粉","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"登機箱","d":"裝麵糊製作器具","q":1,"u":"個"},{"c":"行李","n":"背包","d":"裝衣服","q":1,"u":"個"},{"c":"行李","n":"背包","d":"裝電腦","q":1,"u":"個"}],"buy":[{"n":"雞蛋","a":15,"u":"顆"},{"n":"牛奶","a":750,"u":"ml"},{"n":"油","a":75,"u":"g"},{"n":"糖","a":550,"u":"g"}],"boxes":["保冰桶①｜製作器具","保冰桶②｜烤爐","塑膠箱①｜烤爐","塑膠箱②｜麵粉","登機箱｜麵糊製作器具","背包①｜衣服","背包②｜電腦"],"info":["國家／城市","展場名稱","展場地址","飯店","去程航班","回程航班","當地聯絡人","當地電話","其他事項"]},{"name":"出國-越南","type":"出國","country":"越南","volt":"220V","items":[{"c":"證件與零用金","n":"護照","d":"護照","q":2,"u":"本","k":"人"},{"c":"證件與零用金","n":"簽證","d":"簽證","q":2,"u":"張","k":"人"},{"c":"證件與零用金","n":"SIM卡","d":"當地漫遊","q":2,"u":"張","k":"人"},{"c":"證件與零用金","n":"零用金","d":"購買食材","q":10000,"u":"元"},{"c":"食材","n":"麵粉","d":"100顆/包","q":18,"u":"包","m":"3000顆","k":"百顆","b":"塑膠箱②｜麵粉"},{"c":"雞蛋糕烤爐","n":"烤爐1","d":"台灣造型","q":1,"u":"臺","m":"220v/1500W","b":"保冰桶②｜烤爐"},{"c":"雞蛋糕烤爐","n":"烤爐2","d":"愛心烙印","q":1,"u":"臺","m":"220v/1500W","b":"保冰桶②｜烤爐"},{"c":"雞蛋糕烤爐","n":"延長線","d":"短","q":3,"u":"條","m":"機器x2、烙鐵、電風扇、攪拌機","b":"保冰桶②｜烤爐","p":300},{"c":"雞蛋糕烤爐","n":"轉接頭","d":"機器","q":3,"u":"個","m":"當地插座/展場2、飯店1","b":"保冰桶②｜烤爐"},{"c":"雞蛋糕製作器具","n":"測溫槍","d":"測量烤爐溫度","q":1,"u":"支","m":"電池x2","b":"保冰桶①｜製作器具","p":400},{"c":"雞蛋糕製作器具","n":"隔熱手套","d":"操作機器","q":1,"u":"雙","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"挑棒","d":"挑雞蛋糕工具","q":1,"u":"支","b":"保冰桶①｜製作器具","p":99},{"c":"雞蛋糕製作器具","n":"計時器","d":"製作計時","q":1,"u":"個","m":"電池x1","b":"保冰桶①｜製作器具","p":100},{"c":"雞蛋糕製作器具","n":"電風扇","d":"雞蛋糕降溫","q":1,"u":"個","m":"50W","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"不鏽鋼盤子","d":"承裝雞蛋糕","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"不鏽鋼架子","d":"承裝雞蛋糕","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"夾子","d":"雞蛋糕包裝","q":1,"u":"支","b":"保冰桶①｜製作器具","p":50},{"c":"雞蛋糕製作器具","n":"烙鐵銅頭","d":"活動LOGO銅頭","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"烙鐵加熱棒","d":"銅頭烙印加熱器具","q":1,"u":"支","m":"150W","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"烙鐵棒架子","d":"烙鐵棒架","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"烙鐵棒刷子","d":"烙鐵頭清潔","q":1,"u":"支","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"冷水壺","d":"麵糊容器","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"定量器","d":"麵糊定量","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"定量器蓋子","d":"麵糊定量器蓋子","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"麵糊製作器具","n":"電子秤","d":"原物料秤重","q":1,"u":"個","m":"電池x2","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"攪拌鍋","d":"麵糊容器","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"量杯","d":"500cc植物油","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"量杯","d":"1000cc雞蛋、牛奶","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"塑膠碗","d":"裝糖容器","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"攪拌機","d":"麵糊攪拌","q":1,"u":"支","m":"用電","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"過濾網","d":"過濾麵糊","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"刮刀","d":"麵糊攪拌","q":1,"u":"支","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"封口夾","d":"糖封口","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"五斤袋","d":"麵糊容器","q":1,"u":"包","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"工具盒","d":"打麵糊工具盒","q":1,"u":"個","b":"登機箱｜麵糊製作器具","p":150},{"c":"清潔相關用具","n":"刷子","d":"烤爐清潔","q":2,"u":"支","b":"保冰桶①｜製作器具","p":50},{"c":"清潔相關用具","n":"刮刀","d":"麵糊清潔","q":1,"u":"支","b":"保冰桶①｜製作器具"},{"c":"清潔相關用具","n":"小掃把","d":"桌面清潔","q":1,"u":"組","b":"保冰桶①｜製作器具","p":60},{"c":"清潔相關用具","n":"手套","d":"衛生手套","q":1,"u":"盒","b":"保冰桶①｜製作器具"},{"c":"清潔相關用具","n":"菜瓜布","d":"洗器具","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"清潔相關用具","n":"濕紙巾","d":"整理清潔","q":2,"u":"包","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕包材","n":"牛皮紙袋","d":"雞蛋糕包材(100pcs)","q":3,"u":"疊","m":"推廣會用/貴賓用","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕包材","n":"5寸竹籤","d":"雞蛋糕包材","q":2,"u":"包","m":"展場活動","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕包材","n":"竹籤桶","d":"竹籤容器","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"六角組","d":"烤爐機器維修","q":1,"u":"組","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"十字起子","d":"烙鐵機器使用","q":1,"u":"支","b":"保冰桶①｜製作器具","p":30},{"c":"其他工具及備品","n":"電線","d":"烤爐機器維修備品","q":1,"u":"條","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"4號電池","d":"測溫槍2、計時器1、電子秤2","q":5,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"電工膠帶","d":"烤爐機器維修備品","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"雙面膠帶","d":"固定器具用","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"強力膠帶","d":"固定器具用","q":2,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"定量器塞頭","d":"麵糊定量器備品","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"定量器彈簧","d":"麵糊定量器備品","q":1,"u":"個","b":"保冰桶①｜製作器具","p":50},{"c":"其他工具及備品","n":"工具桶","d":"裝雞蛋糕工具","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"制服與裝飾物","n":"制服","d":"工作人員","q":2,"u":"件","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"圍裙","d":"工作人員","q":2,"u":"件","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"竹籃","d":"擺設","q":1,"u":"個","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"桌布","d":"桌布、隔熱","q":3,"u":"條","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"隔熱布","d":"隔熱、蓋機器","q":2,"u":"條","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"布招牌","d":"裝飾佈置","q":2,"u":"條","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"品牌介紹","d":"裝飾佈置","q":1,"u":"個","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"裝飾物","d":"裝飾佈置","q":2,"u":"個","b":"背包①｜衣服"},{"c":"行李","n":"保冰桶","d":"裝雞蛋糕製作器具","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"保冰桶","d":"裝烤爐","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"塑膠箱","d":"裝烤爐","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"塑膠箱","d":"裝麵粉","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"登機箱","d":"裝麵糊製作器具","q":1,"u":"個"},{"c":"行李","n":"背包","d":"裝衣服","q":1,"u":"個"},{"c":"行李","n":"背包","d":"裝電腦","q":1,"u":"個"}],"buy":[{"n":"雞蛋","a":15,"u":"顆"},{"n":"牛奶","a":750,"u":"ml"},{"n":"油","a":75,"u":"g"},{"n":"糖","a":550,"u":"g"}],"boxes":["保冰桶①｜製作器具","保冰桶②｜烤爐","塑膠箱①｜烤爐","塑膠箱②｜麵粉","登機箱｜麵糊製作器具","背包①｜衣服","背包②｜電腦"],"info":["國家／城市","展場名稱","展場地址","飯店","去程航班","回程航班","當地聯絡人","當地電話","其他事項"]},{"name":"出國-印尼","type":"出國","country":"印尼","volt":"220V","items":[{"c":"證件與零用金","n":"護照","d":"護照","q":2,"u":"本","k":"人"},{"c":"證件與零用金","n":"簽證","d":"簽證","q":2,"u":"張","k":"人"},{"c":"證件與零用金","n":"SIM卡","d":"當地漫遊","q":2,"u":"張","k":"人"},{"c":"證件與零用金","n":"零用金","d":"購買食材","q":10000,"u":"元"},{"c":"食材","n":"麵粉","d":"100顆/包","q":18,"u":"包","m":"3000顆","k":"百顆","b":"塑膠箱②｜麵粉"},{"c":"雞蛋糕烤爐","n":"烤爐1","d":"台灣造型","q":1,"u":"臺","m":"220v/1500W","b":"保冰桶②｜烤爐"},{"c":"雞蛋糕烤爐","n":"烤爐2","d":"愛心烙印","q":1,"u":"臺","m":"220v/1500W","b":"保冰桶②｜烤爐"},{"c":"雞蛋糕烤爐","n":"延長線","d":"短","q":3,"u":"條","m":"機器x2、烙鐵、電風扇、攪拌機","b":"保冰桶②｜烤爐","p":300},{"c":"雞蛋糕烤爐","n":"轉接頭","d":"機器","q":3,"u":"個","m":"當地插座/展場2、飯店1","b":"保冰桶②｜烤爐"},{"c":"雞蛋糕製作器具","n":"測溫槍","d":"測量烤爐溫度","q":1,"u":"支","m":"電池x2","b":"保冰桶①｜製作器具","p":400},{"c":"雞蛋糕製作器具","n":"隔熱手套","d":"操作機器","q":1,"u":"雙","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"挑棒","d":"挑雞蛋糕工具","q":1,"u":"支","b":"保冰桶①｜製作器具","p":99},{"c":"雞蛋糕製作器具","n":"計時器","d":"製作計時","q":1,"u":"個","m":"電池x1","b":"保冰桶①｜製作器具","p":100},{"c":"雞蛋糕製作器具","n":"電風扇","d":"雞蛋糕降溫","q":1,"u":"個","m":"50W","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"不鏽鋼盤子","d":"承裝雞蛋糕","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"不鏽鋼架子","d":"承裝雞蛋糕","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"夾子","d":"雞蛋糕包裝","q":1,"u":"支","b":"保冰桶①｜製作器具","p":50},{"c":"雞蛋糕製作器具","n":"烙鐵銅頭","d":"活動LOGO銅頭","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"烙鐵加熱棒","d":"銅頭烙印加熱器具","q":1,"u":"支","m":"150W","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"烙鐵棒架子","d":"烙鐵棒架","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"烙鐵棒刷子","d":"烙鐵頭清潔","q":1,"u":"支","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"冷水壺","d":"麵糊容器","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"定量器","d":"麵糊定量","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"定量器蓋子","d":"麵糊定量器蓋子","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"麵糊製作器具","n":"電子秤","d":"原物料秤重","q":1,"u":"個","m":"電池x2","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"攪拌鍋","d":"麵糊容器","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"量杯","d":"500cc植物油","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"量杯","d":"1000cc雞蛋、牛奶","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"塑膠碗","d":"裝糖容器","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"攪拌機","d":"麵糊攪拌","q":1,"u":"支","m":"用電","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"過濾網","d":"過濾麵糊","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"刮刀","d":"麵糊攪拌","q":1,"u":"支","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"封口夾","d":"糖封口","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"五斤袋","d":"麵糊容器","q":1,"u":"包","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"工具盒","d":"打麵糊工具盒","q":1,"u":"個","b":"登機箱｜麵糊製作器具","p":150},{"c":"清潔相關用具","n":"刷子","d":"烤爐清潔","q":2,"u":"支","b":"保冰桶①｜製作器具","p":50},{"c":"清潔相關用具","n":"刮刀","d":"麵糊清潔","q":1,"u":"支","b":"保冰桶①｜製作器具"},{"c":"清潔相關用具","n":"小掃把","d":"桌面清潔","q":1,"u":"組","b":"保冰桶①｜製作器具","p":60},{"c":"清潔相關用具","n":"手套","d":"衛生手套","q":1,"u":"盒","b":"保冰桶①｜製作器具"},{"c":"清潔相關用具","n":"菜瓜布","d":"洗器具","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"清潔相關用具","n":"濕紙巾","d":"整理清潔","q":2,"u":"包","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕包材","n":"牛皮紙袋","d":"雞蛋糕包材(100pcs)","q":3,"u":"疊","m":"推廣會用/貴賓用","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕包材","n":"5寸竹籤","d":"雞蛋糕包材","q":2,"u":"包","m":"展場活動","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕包材","n":"竹籤桶","d":"竹籤容器","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"六角組","d":"烤爐機器維修","q":1,"u":"組","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"十字起子","d":"烙鐵機器使用","q":1,"u":"支","b":"保冰桶①｜製作器具","p":30},{"c":"其他工具及備品","n":"電線","d":"烤爐機器維修備品","q":1,"u":"條","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"4號電池","d":"測溫槍2、計時器1、電子秤2","q":5,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"電工膠帶","d":"烤爐機器維修備品","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"雙面膠帶","d":"固定器具用","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"強力膠帶","d":"固定器具用","q":2,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"定量器塞頭","d":"麵糊定量器備品","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"定量器彈簧","d":"麵糊定量器備品","q":1,"u":"個","b":"保冰桶①｜製作器具","p":50},{"c":"其他工具及備品","n":"工具桶","d":"裝雞蛋糕工具","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"制服與裝飾物","n":"制服","d":"工作人員","q":2,"u":"件","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"圍裙","d":"工作人員","q":2,"u":"件","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"竹籃","d":"擺設","q":1,"u":"個","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"桌布","d":"桌布、隔熱","q":3,"u":"條","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"隔熱布","d":"隔熱、蓋機器","q":2,"u":"條","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"布招牌","d":"裝飾佈置","q":2,"u":"條","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"品牌介紹","d":"裝飾佈置","q":1,"u":"個","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"裝飾物","d":"裝飾佈置","q":2,"u":"個","b":"背包①｜衣服"},{"c":"行李","n":"保冰桶","d":"裝雞蛋糕製作器具","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"保冰桶","d":"裝烤爐","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"塑膠箱","d":"裝烤爐","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"塑膠箱","d":"裝麵粉","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"登機箱","d":"裝麵糊製作器具","q":1,"u":"個"},{"c":"行李","n":"背包","d":"裝衣服","q":1,"u":"個"},{"c":"行李","n":"背包","d":"裝電腦","q":1,"u":"個"}],"buy":[{"n":"雞蛋","a":15,"u":"顆"},{"n":"牛奶","a":750,"u":"ml"},{"n":"油","a":75,"u":"g"},{"n":"糖","a":550,"u":"g"}],"boxes":["保冰桶①｜製作器具","保冰桶②｜烤爐","塑膠箱①｜烤爐","塑膠箱②｜麵粉","登機箱｜麵糊製作器具","背包①｜衣服","背包②｜電腦"],"info":["國家／城市","展場名稱","展場地址","飯店","去程航班","回程航班","當地聯絡人","當地電話","其他事項"]},{"name":"出國-日本","type":"出國","country":"日本","volt":"110V","items":[{"c":"食材","n":"麵粉","d":"100顆/包","q":27,"u":"包","m":"3000顆","k":"百顆","b":"塑膠箱②｜麵粉"},{"c":"雞蛋糕烤爐","n":"烤爐1","d":"台灣造型","q":1,"u":"臺","m":"110V/1500W","b":"保冰桶②｜烤爐"},{"c":"雞蛋糕烤爐","n":"烤爐2","d":"愛心烙印","q":1,"u":"臺","m":"110V/1500W","b":"保冰桶②｜烤爐"},{"c":"雞蛋糕烤爐","n":"延長線","d":"短","q":3,"u":"條","m":"機器x2、烙鐵、電風扇、攪拌機","b":"保冰桶②｜烤爐","p":300},{"c":"雞蛋糕烤爐","n":"轉接頭","d":"機器","q":3,"u":"個","m":"當地插座/展場2、飯店1","b":"保冰桶②｜烤爐"},{"c":"雞蛋糕製作器具","n":"測溫槍","d":"測量烤爐溫度","q":1,"u":"支","m":"電池x2","b":"保冰桶①｜製作器具","p":400},{"c":"雞蛋糕製作器具","n":"隔熱手套","d":"操作機器","q":1,"u":"雙","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"挑棒","d":"挑雞蛋糕工具","q":1,"u":"支","b":"保冰桶①｜製作器具","p":99},{"c":"雞蛋糕製作器具","n":"計時器","d":"製作計時","q":1,"u":"個","m":"電池x1","b":"保冰桶①｜製作器具","p":100},{"c":"雞蛋糕製作器具","n":"電風扇","d":"雞蛋糕降溫","q":1,"u":"個","m":"50W","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"不鏽鋼盤子","d":"承裝雞蛋糕","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"不鏽鋼架子","d":"承裝雞蛋糕","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"夾子","d":"雞蛋糕包裝","q":1,"u":"支","b":"保冰桶①｜製作器具","p":50},{"c":"雞蛋糕製作器具","n":"烙鐵銅頭","d":"活動LOGO銅頭","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"烙鐵加熱棒","d":"銅頭烙印加熱器具","q":1,"u":"支","m":"150W","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"烙鐵棒架子","d":"烙鐵棒架","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"烙鐵棒刷子","d":"烙鐵頭清潔","q":1,"u":"支","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"冷水壺","d":"麵糊容器","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"定量器","d":"麵糊定量","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕製作器具","n":"定量器蓋子","d":"麵糊定量器蓋子","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"麵糊製作器具","n":"電子秤","d":"原物料秤重","q":1,"u":"個","m":"電池x2","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"攪拌鍋","d":"麵糊容器","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"量杯","d":"500cc植物油","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"量杯","d":"1000cc雞蛋、牛奶","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"塑膠碗","d":"裝糖容器","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"攪拌機","d":"麵糊攪拌","q":1,"u":"支","m":"用電","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"過濾網","d":"過濾麵糊","q":1,"u":"個","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"刮刀","d":"麵糊攪拌","q":1,"u":"支","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"五斤袋","d":"麵糊容器","q":1,"u":"包","b":"登機箱｜麵糊製作器具"},{"c":"麵糊製作器具","n":"工具盒","d":"打麵糊工具盒","q":1,"u":"個","b":"登機箱｜麵糊製作器具","p":150},{"c":"清潔相關用具","n":"刷子","d":"烤爐清潔","q":2,"u":"支","b":"保冰桶①｜製作器具","p":50},{"c":"清潔相關用具","n":"刮刀","d":"麵糊清潔","q":1,"u":"支","b":"保冰桶①｜製作器具"},{"c":"清潔相關用具","n":"小掃把","d":"桌面清潔","q":1,"u":"組","b":"保冰桶①｜製作器具","p":60},{"c":"清潔相關用具","n":"手套","d":"衛生手套","q":1,"u":"盒","b":"保冰桶①｜製作器具"},{"c":"清潔相關用具","n":"菜瓜布","d":"洗器具","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"清潔相關用具","n":"濕紙巾","d":"整理清潔","q":2,"u":"包","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕包材","n":"牛皮紙袋","d":"雞蛋糕包材(100pcs)","q":10,"u":"疊","m":"推廣會用/貴賓用","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕包材","n":"5寸竹籤","d":"雞蛋糕包材","q":3,"u":"包","m":"展場活動","b":"保冰桶①｜製作器具"},{"c":"雞蛋糕包材","n":"竹籤桶","d":"竹籤容器","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"六角組","d":"烤爐機器維修","q":1,"u":"組","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"十字起子","d":"烙鐵機器使用","q":1,"u":"支","b":"保冰桶①｜製作器具","p":30},{"c":"其他工具及備品","n":"電線","d":"烤爐機器維修備品","q":1,"u":"條","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"4號電池","d":"測溫槍2、計時器1、電子秤2","q":5,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"電工膠帶","d":"烤爐機器維修備品","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"雙面膠帶","d":"固定器具用","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"強力膠帶","d":"固定器具用","q":2,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"定量器塞頭","d":"麵糊定量器備品","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"其他工具及備品","n":"定量器彈簧","d":"麵糊定量器備品","q":1,"u":"個","b":"保冰桶①｜製作器具","p":50},{"c":"其他工具及備品","n":"工具桶","d":"裝雞蛋糕工具","q":1,"u":"個","b":"保冰桶①｜製作器具"},{"c":"制服與裝飾物","n":"制服","d":"工作人員","q":2,"u":"件","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"圍裙","d":"工作人員","q":2,"u":"件","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"竹籃","d":"擺設","q":1,"u":"個","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"桌布","d":"桌布、隔熱","q":3,"u":"條","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"隔熱布","d":"隔熱、蓋機器","q":2,"u":"條","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"布招牌","d":"裝飾佈置","q":2,"u":"條","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"品牌介紹","d":"裝飾佈置","q":1,"u":"個","b":"背包①｜衣服"},{"c":"制服與裝飾物","n":"裝飾物","d":"裝飾佈置","q":2,"u":"個","b":"背包①｜衣服"},{"c":"行李","n":"保冰桶","d":"裝雞蛋糕製作器具","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"保冰桶","d":"裝烤爐","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"塑膠箱","d":"裝烤爐","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"塑膠箱","d":"裝麵粉","q":1,"u":"個","m":"托運前需打包"},{"c":"行李","n":"登機箱","d":"裝麵糊製作器具","q":1,"u":"個"},{"c":"行李","n":"背包","d":"裝衣服","q":1,"u":"個"},{"c":"行李","n":"背包","d":"裝電腦","q":1,"u":"個"}],"buy":[{"n":"雞蛋","a":15,"u":"顆"},{"n":"牛奶","a":750,"u":"ml"},{"n":"油","a":75,"u":"g"},{"n":"糖","a":550,"u":"g"},{"n":"低筋麵粉","a":700,"u":"g"},{"n":"地瓜粉","a":425,"u":"g"},{"n":"糯米粉","a":175,"u":"g"},{"n":"玉米粉","a":100,"u":"g"},{"n":"泡打粉","a":50,"u":"g"},{"n":"奶粉","a":50,"u":"g"},{"n":"香草糖","a":15,"u":"g"}],"boxes":["保冰桶①｜製作器具","保冰桶②｜烤爐","塑膠箱①｜烤爐","塑膠箱②｜麵粉","登機箱｜麵糊製作器具","背包①｜衣服","背包②｜電腦"],"info":["國家／城市","展場名稱","展場地址","飯店","去程航班","回程航班","當地聯絡人","當地電話","其他事項"]}];

// v3（部署端，11/14 02:15）：h36_me_、h36_recv_ 不再退回 p.empId（記錄模式下 empId 可冒用）
// ═══════════════════════════════════════════════
// v1.36 無敵8心（2026-11-14）
// 貼在「設備檢查清單 v1.35 v2」之後、「路由 v1.36」之前。部署後執行一次 h36_setup()
// 8 顆心：愛心、耐心、決心、雄心、誠心、信心、善心、良心。每顆心銅、銀、金三階，依平常工作與遊戲的紀錄自動點亮
// 8 顆都到銅 →「無敵8心」稱號＋光環；8 顆都到金 →「傳說・無敵8心」。點亮後不會收回、不扣幣，和薪資考核無關
// 愛心、善心另外可以由夥伴推薦（每人每月 3 次）、管理者頒發（Lv.3 以上，分數較高）
// 分數規則與門檻都在〈遊戲參數〉（八心門檻_愛心 = 15,60,150 …），可以直接改
// 計算：自己打開 8 心頁時重算自己；每天第一次有人打開時重算全部（不另外加排程）
// 赤心幣：每升一階給一次（測試期與正式版各一次——12/1 正式版赤心幣歸零後，已點亮的心會在正式版補發一次）
// 覆蓋：無（只新增 h36_*、h36Handler_；在 gmScene、homeTodo 回傳裡加資料）
// ═══════════════════════════════════════════════

var H36_HEARTS = [
  ['love', '愛心', '❤️', '關心夥伴、照顧寵物', '送出互動、摸摸頭、生日祝福 1 分；收到夥伴推薦 5 分、管理者頒發 10 分；好導師 10 分'],
  ['patience', '耐心', '💪', '一步一步累積', '累計工時 1 小時 1 分'],
  ['resolve', '決心', '🔥', '說到做到、挑戰到底', '每日一題答對 1 分；小遊戲破紀錄 2 分；大魔王出手 1 分'],
  ['ambition', '雄心', '🦁', '走出舒適圈', '上過班的不同櫃位每個 3 分；活動場次每天 1 分；代班接班 2 分；出國活動 10 分'],
  ['sincere', '誠心', '🤝', '準時、確實', '準時上班每天 1 分；全勤之星每月 10 分'],
  ['confidence', '信心', '⭐', '獨當一面', '收店盤點 1 分；對戰勝場 1 分；開門紅 5 分；業績爆發 10 分'],
  ['kindness', '善心', '🌱', '善待顧客與同伴', '捐團隊基金與塔防投入每 20 枚 1 分；回報門市問題 1 分；收到夥伴推薦 5 分、管理者頒發 10 分'],
  ['conscience', '良心', '🍀', '把品質放心上', '食安紀錄、開店盤點 1 分；設備清單打勾每 10 項 1 分；食安與 SOP 題答對 1 分；上傳體檢 10 分']
];
var H36_DEF = {   // 門檻（銅,銀,金）
  love: '15,60,150', patience: '360,1080,2160', resolve: '20,80,200', ambition: '10,30,70',
  sincere: '20,80,200', confidence: '15,60,150', kindness: '10,40,100', conscience: '30,120,300'
};
var H36_LV = ['', '銅', '銀', '金'];
GM_SHEETS.h36 = ['八心', ['員工編號', '分數(JSON)', '階級(JSON)', '更新時間', '點亮紀錄(JSON)']];
GM_SHEETS.h36rec = ['八心推薦', ['時間', '月份', '推薦人', '對象', '心', '理由', '分數', '推薦人權限']];

function h36_n_(k, d) { var v = Number(gm_param_(k)); return isFinite(v) && String(gm_param_(k) || '') !== '' ? v : d; }
function h36_th_(key) {
  var h = H36_HEARTS.filter(function (x) { return x[0] === key; })[0];
  var s = String(gm_param_('八心門檻_' + h[1]) || H36_DEF[key]).split(/[,，、\s]+/).map(Number).filter(function (n) { return n > 0; });
  return s.length === 3 ? s : H36_DEF[key].split(',').map(Number);
}
function h36_lv_(key, pts) { var t = h36_th_(key), l = 0; for (var i = 0; i < 3; i++) if (pts >= t[i]) l = i + 1; return l; }
function h36_sheetRows_(name, cols) {
  var sh = gm_ss_().getSheetByName(name); if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, Math.min(cols, Math.max(1, sh.getLastColumn()))).getValues();
}
function h36_hm_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Taipei', 'HH:mm');
  var m = /^(\d{1,2}):(\d{2})/.exec(String(v || '').trim()); return m ? ('0' + m[1]).slice(-2) + ':' + m[2] : '';
}

// ── 全部夥伴的分數（一次讀完所有資料）──
function h36_compute_() {
  if (GM_CACHE_.h36pts) return GM_CACHE_.h36pts;
  var emps = gm_emps_(), P = {}, add = function (e, k, n) { if (!emps[e] || !n) return; var o = P[e] = P[e] || {}; o[k] = (o[k] || 0) + n; };
  var nameOf = {}; Object.keys(emps).forEach(function (id) { nameOf[emps[id].nick || emps[id].name] = id; nameOf[emps[id].name] = id; });
  // 徽章
  gm_rows_('badges').forEach(function (r) {
    var e = String(r[0]), b = String(r[1]);
    if (b === 'mentor') add(e, 'love', 10);
    if (b === 'attend') add(e, 'sincere', 10);
    if (b === 'first_open') add(e, 'confidence', 5);
    if (b === 'bigday') add(e, 'confidence', 10);
  });
  // 愛心：互動、摸摸頭、生日祝福
  gm_rows_('inter').forEach(function (r) { add(String(r[2]), 'love', 1); });
  gm_rows_('wishes').forEach(function (r) { add(String(r[2]), 'love', 1); });
  // 推薦／頒發
  gm_rows_('h36rec').forEach(function (r) { add(String(r[3]), String(r[4]), Number(r[6]) || 0); });
  // 耐心：累計工時
  Object.keys(emps).forEach(function (id) { try { add(id, 'patience', c31_cumLife_(id)); } catch (e) {} });
  // 決心：每日一題、小遊戲破紀錄、大魔王
  var qcat = {}; gm_rows_('quiz').forEach(function (r) { qcat[String(r[0])] = String(r[1]); });
  gm_rows_('answers').forEach(function (r) {
    if (String(r[4]) !== '對') return; var e = String(r[1]); add(e, 'resolve', 1);
    if (/食安|SOP|衛生/i.test(qcat[String(r[2])] || '')) add(e, 'conscience', 1);
  });
  gm_rows_('games').forEach(function (r) { if (Number(r[5]) > 0) add(String(r[2]), 'resolve', 2); });
  try { gm_rows_('s30boss').forEach(function (r) { add(String(r[1]), 'resolve', 1); }); } catch (e) {}
  // 雄心：不同櫃位、活動場次、代班、出國
  var act = gm_activityLocs_(), locs = {}, actDay = {}, first = {};
  gm_punchRows_().forEach(function (p) {
    if (p.type !== '上班' || !emps[p.emp]) return;
    if (p.loc) (locs[p.emp] = locs[p.emp] || {})[p.loc.replace(/\s.*$/, '')] = 1;
    if (act[p.loc]) (actDay[p.emp] = actDay[p.emp] || {})[p.date] = 1;
    var k = p.emp + '|' + p.date; if (!first[k] || p.t < first[k]) first[k] = p.t;
  });
  Object.keys(locs).forEach(function (e) { add(e, 'ambition', 3 * Object.keys(locs[e]).length); });
  Object.keys(actDay).forEach(function (e) { add(e, 'ambition', Object.keys(actDay[e]).length); });
  try { if (typeof sch_reqs_ === 'function') sch_reqs_().forEach(function (q) { if (q.status === '已核准' && q.toId) add(String(q.toId), 'ambition', 2); }); } catch (e) {}
  // 設備清單：出國出勤、打勾
  h36_sheetRows_('設備清單', 15).forEach(function (r) {
    var crew = String(r[14] || '').split(/[、,\s]+/).filter(String);
    if (String(r[2]) === '出國' && String(r[12]) !== '取消') crew.forEach(function (id) { add(id, 'ambition', 10); });
    var items = []; try { items = JSON.parse(String(r[11] || '[]')); } catch (e) {}
    var cnt = {}; items.forEach(function (it) { (it.st || []).forEach(function (s) { if (s && s.by && nameOf[s.by]) cnt[nameOf[s.by]] = (cnt[nameOf[s.by]] || 0) + 1; }); });
    Object.keys(cnt).forEach(function (id) { (P.__eq = P.__eq || {})[id] = (P.__eq[id] || 0) + cnt[id]; });
  });
  Object.keys(P.__eq || {}).forEach(function (id) { add(id, 'conscience', Math.floor(P.__eq[id] / 10)); }); delete P.__eq;
  // 誠心：準時上班（第一次上班打卡不晚於班表上班時間＋寬限分鐘）
  var grace = h36_n_('八心準時寬限分鐘', 1) * 60000;
  h36_sheetRows_('班表', 7).forEach(function (r) {
    var d = gm_dstr_(r[1]), e = String(r[3]).trim(), st = h36_hm_(r[6]); if (!d || !st || !emps[e]) return;
    var f = first[e + '|' + d]; if (!f) return;
    if (f <= new Date(d + 'T' + st + ':00+08:00').getTime() + grace) add(e, 'sincere', 1);
  });
  // 信心：收店盤點、對戰勝場
  gm_closeRows_().forEach(function (c) { add(c.emp, 'confidence', 1); });
  h36_sheetRows_('對戰紀錄', 5).forEach(function (r) { add(String(r[4]).trim(), 'confidence', 1); });
  // 善心：團隊基金、塔防投入、門市回報
  var give = {};
  gm_rows_('fund').forEach(function (r) { give[r[1]] = (give[r[1]] || 0) + (Number(r[2]) || 0); });
  h36_sheetRows_('塔防投入', 5).forEach(function (r) { var e = String(r[1]); give[e] = (give[e] || 0) + (Number(r[4]) || 0); });
  Object.keys(give).forEach(function (e) { add(e, 'kindness', Math.floor(give[e] / 20)); });
  h36_sheetRows_('門市回報', 3).forEach(function (r) { add(String(r[2]).trim(), 'kindness', 1); });
  // 良心：食安紀錄、開店盤點、體檢
  h36_sheetRows_('食安紀錄', 5).forEach(function (r) { add(String(r[4]).trim(), 'conscience', 1); });
  h36_sheetRows_('開店盤點', 4).forEach(function (r) { add(String(r[3]).trim(), 'conscience', 1); });
  h36_sheetRows_('體檢表', 2).forEach(function (r) { add(String(r[1]).trim(), 'conscience', 10); });
  return (GM_CACHE_.h36pts = P);
}

// ── 儲存與發獎 ──
function h36_rowsMap_() {
  var m = {}; gm_rows_('h36').forEach(function (r, i) { m[String(r[0])] = { row: i + 2, pts: ops_json_(r[1], {}), lv: ops_json_(r[2], {}), at: String(r[3]), log: ops_json_(r[4], {}) }; });
  return m;
}
function h36_phase_() { return gm_today_() >= String(gm_param_('正式版開始日') || '2026-12-01') && gm_getState_('正式版已重置') ? 'F' : 'T'; }
// 重算一位或全部；回傳 { emp: {pts, lv, log} }
function h36_refresh_(only) {
  var P = h36_compute_(), emps = gm_emps_(), map = h36_rowsMap_(), now = gm_now_(), phase = h36_phase_(), sh = gm_sh_('h36'), out = {};
  var ids = only ? [only] : Object.keys(emps);
  var appends = [];
  ids.forEach(function (id) {
    var e = emps[id]; if (!e || e.resigned) return;
    var cur = map[id] || { pts: {}, lv: {}, log: {} }, pts = P[id] || {}, lv = {}, log = cur.log || {};
    H36_HEARTS.forEach(function (h) {
      var k = h[0], p = Math.floor(pts[k] || 0), l = Math.max(h36_lv_(k, p), Number(cur.lv[k]) || 0);   // 只升不降
      lv[k] = l; pts[k] = p;
      for (var i = 1; i <= l; i++) {
        var lk = k + i; if (!log[lk]) log[lk] = now.slice(0, 10);
        gm_credit_(id, '無敵8心', h36_n_('八心獎勵_' + H36_LV[i], [0, 30, 80, 200][i]), h[1] + '・' + H36_LV[i] + (phase === 'F' && log[lk] < String(gm_param_('正式版開始日')) ? '（正式版補發）' : ''), 'HEART|' + id + '|' + k + '|' + i + '|' + phase);
      }
    });
    var minLv = Math.min.apply(null, H36_HEARTS.map(function (h) { return lv[h[0]]; }));
    if (minLv >= 1) { if (!log.inv) log.inv = now.slice(0, 10); gm_credit_(id, '無敵8心', h36_n_('無敵8心獎勵', 300), '達成「無敵8心」', 'HEART8|' + id + '|' + phase); }
    if (minLv >= 3) { if (!log.legend) log.legend = now.slice(0, 10); gm_credit_(id, '無敵8心', h36_n_('傳說無敵8心獎勵', 1000), '達成「傳說・無敵8心」', 'HEART8G|' + id + '|' + phase); }
    var v = [id, JSON.stringify(pts), JSON.stringify(lv), now, JSON.stringify(log)];
    if (map[id]) { var rng = sh.getRange(map[id].row, 1, 1, 5); rng.setNumberFormat('@'); rng.setValues([v]); }
    else appends.push(v);
    out[id] = { pts: pts, lv: lv, log: log };
  });
  if (appends.length) gm_append_('h36', appends);
  delete GM_CACHE_['rows_h36'];
  return out;
}
// 每天第一次：全部重算
function h36_daily_() {
  var t = gm_today_(); if (gm_getState_('八心重算日') === t) return false;
  var lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) return false;
  try { if (gm_getState_('八心重算日') === t) return false; h36_refresh_(null); gm_setState_('八心重算日', t); return true; }
  finally { lock.releaseLock(); }
}
function h36_levels_() {   // 給宇宙辦公室、名牌用（只讀已存的）
  var m = h36_rowsMap_(), out = {};
  Object.keys(m).forEach(function (id) {
    var lv = m[id].lv || {}, n = 0, g = 0;
    H36_HEARTS.forEach(function (h) { if (lv[h[0]] >= 1) n++; if (lv[h[0]] >= 3) g++; });
    if (n) out[id] = { n: n, g: g, lv: H36_HEARTS.map(function (h) { return Number(lv[h[0]]) || 0; }) };
  });
  return out;
}
function h36_view_(id, x, self) {
  var e = gm_emp_(id) || {};
  var hearts = H36_HEARTS.map(function (h) {
    var t = h36_th_(h[0]), p = (x.pts || {})[h[0]] || 0, l = (x.lv || {})[h[0]] || 0;
    var o = { key: h[0], name: h[1], icon: h[2], mean: h[3], lv: l, at: (x.log || {})[h[0] + l] || '' };
    if (self) { o.pts = p; o.th = t; o.next = l < 3 ? t[l] : 0; o.how = h[4]; }
    return o;
  });
  var n = hearts.filter(function (h) { return h.lv >= 1; }).length, g = hearts.filter(function (h) { return h.lv >= 3; }).length;
  var out = { id: id, name: e.nick || e.name || '', hearts: hearts, n: n, g: g, inv: n === 8, legend: g === 8, invAt: (x.log || {}).inv || '', legendAt: (x.log || {}).legend || '' };
  if (self) {   // 無敵8心進度條：每顆心到銅（或到金）的完成比例平均
    var pr = function (lvNeed, ti) { return hearts.map(function (h) { return h.lv >= lvNeed ? 1 : Math.min(1, h.pts / h.th[ti]); }); };
    out.parts = pr(1, 0); out.partsG = pr(3, 2);
    out.prog = Math.floor(out.parts.reduce(function (a, b) { return a + b; }, 0) / 8 * 100);
    out.progG = Math.floor(out.partsG.reduce(function (a, b) { return a + b; }, 0) / 8 * 100);
  }
  return out;
}

// ── API ──
function h36_me_(p) {
  var vid = au_verifiedId_(); if (!vid) return { error: '請更新 App 後重新登入' };   // v3（部署端）：一律以通行證本人為準（耐心＝累計工時）
  var id = vid;
  var me = gm_emp_(id); if (!me || me.resigned) return { error: '找不到夥伴資料' };
  var x;
  if (p.lite) x = h36_rowsMap_()[id] || { pts: {}, lv: {}, log: {} };       // 樂園卡片：只讀已存的，不重算（快）
  else { h36_daily_(); x = h36_refresh_(id)[id] || { pts: {}, lv: {}, log: {} }; }
  var who = String(p.who || '').trim(), other = null;
  if (who && who !== id) { var lv = h36_rowsMap_()[who]; other = h36_view_(who, lv || { lv: {} }, false); }
  var ym = gm_today_().slice(0, 7), used = gm_rows_('h36rec').filter(function (r) { return String(r[1]) === ym && String(r[2]) === id; }).length;
  var mgr = (me.role >= 3 || gm_isTop_(me)) && !!vid;
  return { success: true, data: h36_view_(id, x, true), other: other, recLeft: Math.max(0, h36_n_('八心每月推薦次數', 3) - used), recPts: h36_n_('八心推薦分數', 5), mgr: mgr, mgrPts: h36_n_('八心頒發分數', 10),
    lvNames: H36_LV, rewards: [0, h36_n_('八心獎勵_銅', 30), h36_n_('八心獎勵_銀', 80), h36_n_('八心獎勵_金', 200)], invReward: h36_n_('無敵8心獎勵', 300), legendReward: h36_n_('傳說無敵8心獎勵', 1000),
    people: Object.keys(gm_emps_()).filter(function (k) { var e = gm_emps_()[k]; return k !== id && !e.resigned; }).map(function (k) { var e = gm_emps_()[k]; return { id: k, name: e.nick || e.name }; }) };
}
// 推薦（夥伴）／頒發（Lv.3 以上）：只能給愛心、善心；一律要有效通行證
function h36_rec_(p) {
  var vid = au_verifiedId_(); if (!vid) return { error: '請更新 App 後重新登入' };
  var me = gm_emp_(vid); if (!me || me.resigned) return { error: '找不到夥伴資料' };
  var to = String(p.to || '').trim(), heart = String(p.heart || ''), why = String(p.reason || '').trim().slice(0, 100), give = String(p.mode || '') === 'give';
  if (!gm_emp_(to) || gm_emp_(to).resigned) return { error: '找不到這位夥伴' };
  if (to === vid) return { error: '不能推薦自己' };
  if (['love', 'kindness'].indexOf(heart) < 0) return { error: '只有愛心和善心可以推薦' };
  if (why.length < 4) return { error: '請寫一句推薦的原因（至少 4 個字）' };
  var ym = gm_today_().slice(0, 7), rows = gm_rows_('h36rec');
  if (give) {
    if (!(me.role >= 3 || gm_isTop_(me))) return { error: '管理者頒發需要 Lv.3 以上' };
  } else {
    if (rows.filter(function (r) { return String(r[1]) === ym && String(r[2]) === vid && Number(r[7]) < 3; }).length >= h36_n_('八心每月推薦次數', 3)) return { error: '這個月的推薦次數用完了，下個月再來' };
  }
  if (rows.some(function (r) { return String(r[1]) === ym && String(r[2]) === vid && String(r[3]) === to && String(r[4]) === heart; })) return { error: '這個月已經' + (give ? '頒發' : '推薦') + '過他這顆心了' };
  var pts = give ? h36_n_('八心頒發分數', 10) : h36_n_('八心推薦分數', 5), name = H36_HEARTS.filter(function (h) { return h[0] === heart; })[0][1];
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try { gm_append_('h36rec', [[gm_now_(), ym, vid, to, heart, why, pts, give ? Math.max(3, me.role) : 1]]); } finally { lock.releaseLock(); }
  GM_CACHE_.h36pts = null; delete GM_CACHE_['rows_h36rec'];
  var x = h36_refresh_(to)[to];
  return { success: true, msg: (give ? '已頒發' : '已推薦') + (gm_emp_(to).nick || gm_emp_(to).name) + '「' + name + '」+' + pts + ' 分', lv: x ? x.lv[heart] : 0 };
}
// 收到的推薦（自己看）
function h36_recv_(p) {
  var vid = au_verifiedId_(); if (!vid) return { error: '請更新 App 後重新登入' };   // v3（部署端）：推薦原因只給本人看
  var emps = gm_emps_();
  var data = gm_rows_('h36rec').filter(function (r) { return String(r[3]) === vid; }).slice(-30).reverse().map(function (r) {
    var f = emps[String(r[2])] || {}; return { at: String(r[0]).slice(0, 10), from: f.nick || f.name || '', heart: String(r[4]), reason: String(r[5]), pts: Number(r[6]) || 0, give: Number(r[7]) >= 3 };
  });
  return { success: true, data: data };
}

// 首頁：自己剛升階（7 天內）、全公司「無敵8心」公告（3 天內）
function h36_todo_(empId) {
  var out = [];
  try {
    var id = au_verifiedId_() || String(empId || '').trim(), m = h36_rowsMap_(), t = gm_today_(), d7 = gm_addDays_(t, -7), d3 = gm_addDays_(t, -3), emps = gm_emps_();
    Object.keys(m).forEach(function (k) {
      var log = m[k].log || {}, e = emps[k]; if (!e || e.resigned) return;
      var nm = e.nick || e.name;
      if (log.legend && log.legend >= d3) out.push({ icon: '👑', text: '恭喜 ' + nm + ' 達成「傳說・無敵8心」！', tab: 'hearts', red: false, who: k });
      else if (log.inv && log.inv >= d3) out.push({ icon: '💖', text: '恭喜 ' + nm + ' 達成「無敵8心」！', tab: 'hearts', red: false, who: k });
    });
    var mine = (m[id] || {}).log || {}, ups = [];
    H36_HEARTS.forEach(function (h) { for (var i = 3; i >= 1; i--) if (mine[h[0] + i] && mine[h[0] + i] >= d7) { ups.push(h[2] + h[1] + '・' + H36_LV[i]); break; } });
    if (ups.length) out.push({ icon: '💗', text: '你點亮了 ' + ups.slice(0, 3).join('、') + (ups.length > 3 ? ' 等 ' + ups.length + ' 顆心' : ''), tab: 'hearts', red: false });
  } catch (e) {}
  return out;
}

AU_READ = new RegExp(AU_READ.source.replace('|eqMeta|eqGet|eqFixList)$', '|eqMeta|eqGet|eqFixList|h36Me|h36Recv)$'));

function h36Handler_(action, p) {
  if (action === 'homeTodo') {           // 接在 v1.35 設備清單（eqHandler_）的首頁待辦後面
    try {
      var t = eqHandler_('homeTodo', p);
      if (t && t.success) { var ex = h36_todo_(p.empId); if (ex.length) t.data = (t.data || []).concat(ex); }
      return t;
    } catch (e) { return null; }
  }
  if (action === 'gmScene') {            // 宇宙辦公室：加上 8 心（光環、點小人看得到）
    try {
      var r = s30Handler_('gmScene', p); if (!r || !r.data) return r;
      var hv = h36_levels_(); r.data.hearts = hv;
      Object.keys(hv).forEach(function (id) { if (hv[id].n === 8 && !r.data.titles[id]) r.data.titles[id] = hv[id].g === 8 ? '傳說・無敵8心' : '無敵8心'; });
      return r;
    } catch (e) { return null; }
  }
  var map = { h36Me: h36_me_, h36Rec: h36_rec_, h36Recv: h36_recv_ };
  if (!map[action]) return null;
  try { GM_CACHE_ = {}; return map[action](p); } catch (e) { return { error: e.message }; }
}

function h36_setup() {
  gm_sh_('h36'); gm_sh_('h36rec');
  var have = {}; gm_rows_('params').forEach(function (r) { have[String(r[0]).trim()] = 1; });
  var add = [];
  H36_HEARTS.forEach(function (h) { if (!have['八心門檻_' + h[1]]) add.push(['八心門檻_' + h[1], H36_DEF[h[0]], '無敵8心：' + h[1] + '銅,銀,金門檻（' + h[4] + '）']); });
  [['八心獎勵_銅', 30, '每顆心升到銅給幾枚'], ['八心獎勵_銀', 80, ''], ['八心獎勵_金', 200, ''], ['無敵8心獎勵', 300, '8 顆心都到銅'], ['傳說無敵8心獎勵', 1000, '8 顆心都到金'],
   ['八心每月推薦次數', 3, '每位夥伴每月可以推薦別人愛心／善心幾次'], ['八心推薦分數', 5, ''], ['八心頒發分數', 10, 'Lv.3 以上頒發'], ['八心準時寬限分鐘', 1, '誠心：比班表上班時間晚幾分鐘內還算準時']]
    .forEach(function (x) { if (!have[x[0]]) add.push(x); });
  if (add.length) gm_append_('params', add);
  GM_CACHE_ = {};
  gm_setState_('八心重算日', '');
  var n = Object.keys(h36_refresh_(null)).length;
  gm_setState_('八心重算日', gm_today_());
  Logger.log('h36_setup 完成：新增參數 ' + add.length + ' 個，計算 ' + n + ' 位夥伴');
  return n;
}

// ═══════════════════════════════════════════════════════════════
// v1.38 樂園新遊戲＋挑戰獎勵（2026-11-14）
//   新遊戲：雞蛋糕消消樂（寵物第 1 階段）、雞蛋糕疊疊樂（第 2 階段）、麵糊大作戰三個任務（第 3 階段）
//   1. 一次性挑戰：通關、三星、關卡里程碑 → 赤心幣／扭蛋券／徽章（每人每項一次；12/1 封存後可再拿）
//   2. 每日破紀錄：沿用原規則，小遊戲每日上限 5 → 6（g38_setup 會改〈遊戲參數〉）
//   3. 週冠軍：原本的「小遊戲週冠軍」徽章外，每款第一名再 +20（〈遊戲參數〉「小遊戲週冠軍獎勵」）
//   4. 防作弊：開局時間記在伺服器，過關要玩滿最短秒數；消消樂一天最多 30 局；分數有上限
// 覆蓋：gm_games_、gm_gameStart_、gm_gameScore_、gm_gameWeekly_
//   ★ gm_gameStart_、gm_gameScore_ 會發幣 → 一律以通行證本人為準，沒有通行證就擋下（不退回 p.empId）
// 位置：貼在「無敵8心 v1.36」之後、路由之前。路由不用改（gmGames／gmGameStart／gmGameScore 原本就有）。
// 部署後執行一次 g38_setup()
// ═══════════════════════════════════════════════════════════════

// 編號、名稱、需要的寵物階段、破個人紀錄的獎勵、分數上限
GM_GAMES.push(
  ['match', '雞蛋糕消消樂', 1, 1, 200],          // 分數＝通過的最高關卡
  ['stack', '雞蛋糕疊疊樂', 2, 2, 3000000],
  ['batter1', '麵糊大作戰・守烤爐', 3, 2, 30000],
  ['batter2', '麵糊大作戰・送訂單', 3, 2, 30000],
  ['batter3', '麵糊大作戰・拆過熱烤爐', 3, 2, 30000]
);
GM_SHEETS.g38ch = ['小遊戲挑戰', ['時間', '員工編號', '挑戰編號', '名稱', '赤心幣', '扭蛋券', '徽章']];
GM_BADGES.push(
  ['b38_batter', '麵糊特攻隊', '🍰', '麵糊大作戰三個任務都拿到三星', 30, false],
  ['b38_match', '消消樂達人', '🧇', '雞蛋糕消消樂通過第 20 關', 20, false],
  ['b38_stack', '疊疊樂大師', '🧱', '雞蛋糕疊疊樂單局出爐 50 排', 20, false]
);
GM_PARAM_DEFAULTS.push(['小遊戲週冠軍獎勵', 20, 'v1.38：每款小遊戲週排行第一名，除了徽章再加幾枚']);
if (typeof C31_ARCHIVE !== 'undefined' && C31_ARCHIVE.indexOf('小遊戲挑戰') < 0) C31_ARCHIVE.push('小遊戲挑戰');   // 12/1 一起封存，正式版可再拿

// 過關（或拿分）最短秒數：比這個短就不算
var G38_MIN_WIN = { match: 15, stack: 20, batter1: 85, batter2: 30, batter3: 40 };
var G38_MATCH_DAY_MAX = 30;

// 一次性挑戰：編號、遊戲、名稱、赤心幣、扭蛋券、徽章、條件
var G38_CH = [
  ['b1_clear', 'batter1', '守烤爐・第一次過關', 10, 0, '', function (s, m) { return m.win; }],
  ['b1_star3', 'batter1', '守烤爐・三星', 10, 0, '', function (s, m) { return m.win && m.stars >= 3; }],
  ['b2_clear', 'batter2', '送訂單・第一次過關', 10, 0, '', function (s, m) { return m.win; }],
  ['b2_star3', 'batter2', '送訂單・三星', 10, 0, '', function (s, m) { return m.win && m.stars >= 3; }],
  ['b3_clear', 'batter3', '拆過熱烤爐・第一次過關', 10, 0, '', function (s, m) { return m.win; }],
  ['b3_star3', 'batter3', '拆過熱烤爐・三星', 10, 0, '', function (s, m) { return m.win && m.stars >= 3; }],
  ['b_all3', 'batter*', '麵糊大作戰・三個任務都三星', 0, 0, 'b38_batter', null],   // 另外判斷
  ['m_5', 'match', '消消樂・通過第 5 關', 10, 0, '', function (s, m) { return m.win && s >= 5; }],
  ['m_10', 'match', '消消樂・通過第 10 關', 15, 0, '', function (s, m) { return m.win && s >= 10; }],
  ['m_15', 'match', '消消樂・通過第 15 關', 20, 0, '', function (s, m) { return m.win && s >= 15; }],
  ['m_20', 'match', '消消樂・通過第 20 關', 30, 1, 'b38_match', function (s, m) { return m.win && s >= 20; }],
  ['s_lv5', 'stack', '疊疊樂・升到 Lv 5', 10, 0, '', function (s, m) { return m.level >= 5; }],
  ['s_lv10', 'stack', '疊疊樂・升到 Lv 10', 20, 0, '', function (s, m) { return m.level >= 10; }],
  ['s_50', 'stack', '疊疊樂・單局出爐 50 排', 0, 1, 'b38_stack', function (s, m) { return m.lines >= 50; }]
];

function g38_done_(emp) { var d = {}; gm_rows_('g38ch').forEach(function (r) { if (r[1] === emp) d[r[2]] = r[0]; }); return d; }
function g38_cache_() { return CacheService.getScriptCache(); }
function g38_me_(p) {   // 會發幣的動作：只認通行證本人
  var id = typeof au_verifiedId_ === 'function' ? au_verifiedId_() : '';
  if (!id) return { error: '請更新 App 後重新登入' };
  if (p.empId && String(p.empId).trim() !== id) return { error: '登入身分不符，請重新登入' };
  return { id: id };
}

// 覆蓋：遊戲清單（多回傳挑戰清單）
function gm_games_(p) {
  var emp = String(p.empId || '').trim(), pet = gm_pet_(emp), today = gm_today_(), wk = gm_weekFrom_(today), emps = gm_emps_();
  var best = {}, week = {}, todayGot = 0;
  gm_rows_('games').forEach(function (r) {
    var g = r[3], sc = Number(r[4]) || 0;
    if (r[2] === emp) { best[g] = Math.max(best[g] || 0, sc); if (String(r[1]) === today) todayGot += Number(r[5]) || 0; }
    if (String(r[1]) >= wk) { var k = g + '|' + r[2]; week[k] = Math.max(week[k] || 0, sc); }
  });
  var games = GM_GAMES.map(function (g) {
    var top = Object.keys(week).filter(function (k) { return k.split('|')[0] === g[0]; }).map(function (k) { var id = k.split('|')[1]; return { name: emps[id] ? (emps[id].nick || emps[id].name) : id, score: week[k], me: id === emp }; })
      .sort(function (a, b) { return b.score - a.score; }).slice(0, 5);
    return { id: g[0], name: g[1], stage: g[2], reward: g[3], unlocked: !!pet && pet.stage >= g[2], best: best[g[0]] || 0, top: top };
  });
  var lives = pet ? Number((gm_rows_('pets')[pet.row - 2] || [])[6]) || 0 : 0;
  var done = g38_done_(emp);
  var ch = G38_CH.map(function (c) { return { id: c[0], game: c[1], name: c[2], coins: c[3], tix: c[4], badge: c[5] ? (gm_badgeDef_(c[5]) || [])[1] || '' : '', badgeCoins: c[5] ? (gm_badgeDef_(c[5]) || [])[4] || 0 : 0, done: !!done[c[0]] }; });
  return { success: true, data: { pet: pet, games: games, todayGot: todayGot, cap: Number(gm_param_('小遊戲每日上限')) || 6, extraLives: lives,
    challenges: ch, weekBonus: Number(gm_param_('小遊戲週冠軍獎勵')) || 0, v: 38 } };
}

// 覆蓋：開局（記下開局時間；有寵物零食的命就用掉一條）
function gm_gameStart_(p) {
  var me = g38_me_(p); if (me.error) return me; var emp = me.id;
  var pet = gm_pet_(emp); if (!pet) return { error: '先領養寵物才能玩' };
  var g = GM_GAMES.filter(function (x) { return x[0] === p.game; })[0]; if (!g) return { error: '沒有這款遊戲' };
  if (pet.stage < g[2]) return { error: '寵物長到第 ' + g[2] + ' 階段才解鎖' };
  if (g[0] === 'match') {
    var today = gm_today_(), n = gm_rows_('games').filter(function (r) { return r[2] === emp && r[3] === 'match' && String(r[1]) === today; }).length;
    if (n >= G38_MATCH_DAY_MAX) return { error: '消消樂今天已經玩 ' + n + ' 局了，明天再來！' };
  }
  var lives = Number(gm_rows_('pets')[pet.row - 2][6]) || 0, extra = 0;
  if (lives > 0 && ['catch', 'breakout', 'runner'].indexOf(g[0]) >= 0) {   // 寵物零食的命只用在有「命」的遊戲
    var rng = gm_sh_('pets').getRange(pet.row, 7); rng.setNumberFormat('@'); rng.setValue(String(lives - 1)); extra = 1; GM_CACHE_.rows_pets = null;
  }
  g38_cache_().put('G38|' + emp + '|' + g[0], String(Date.now()), 21600);
  return { success: true, data: { extra: extra, left: Math.max(0, lives - extra) } };
}

// 覆蓋：送分數（破紀錄獎勵＋一次性挑戰）
function gm_gameScore_(p) {
  var me = g38_me_(p); if (me.error) return me; var emp = me.id;
  var e = gm_emp_(emp); if (!e || e.resigned) return { error: '帳號無法使用' };
  var g = GM_GAMES.filter(function (x) { return x[0] === p.game; })[0]; if (!g) return { error: '沒有這款遊戲' };
  var pet = gm_pet_(emp); if (!pet || pet.stage < g[2]) return { error: '這款遊戲還沒解鎖' };
  var ck = 'G38|' + emp + '|' + g[0], t0 = Number(g38_cache_().get(ck)) || 0;
  if (!t0) return { error: '這一局沒有開局紀錄，請重新開始' };
  g38_cache_().remove(ck);   // 一次開局只能送一次分數
  var sec = (Date.now() - t0) / 1000, meta = p.meta && typeof p.meta === 'object' ? p.meta : {};
  if (typeof p.meta === 'string') { try { meta = JSON.parse(p.meta) || {}; } catch (x) { meta = {}; } }
  var m = { win: meta.win === true || meta.win === 'true' || meta.win === 1, stars: Math.max(0, Math.min(3, Number(meta.stars) || 0)),
            level: Math.max(0, Math.min(99, Number(meta.level) || 0)), lines: Math.max(0, Math.min(9999, Number(meta.lines) || 0)) };
  var score = Math.max(0, Math.min(g[4], Math.round(Number(p.score) || 0))), today = gm_today_();
  // 防作弊：新遊戲過關要玩滿最短秒數；疊疊樂排數不能比時間快太多
  var minS = G38_MIN_WIN[g[0]];
  if (minS && sec < minS && (m.win || g[0] === 'stack')) { score = 0; m.win = false; m.stars = 0; m.level = 0; m.lines = 0; }
  if (g[0] === 'stack' && m.lines > sec / 0.9) m.lines = Math.floor(sec / 0.9);   // 一排至少約 0.9 秒
  if (g[0] === 'match') { if (!m.win) score = 0; else if (score > 0) { var bestLv = 0; gm_rows_('games').forEach(function (r) { if (r[2] === emp && r[3] === 'match') bestLv = Math.max(bestLv, Number(r[4]) || 0); }); if (score > bestLv + 1) score = bestLv + 1; } }   // 一次只能往前推一關
  var best = 0, got = 0;
  gm_rows_('games').forEach(function (r) { if (r[2] === emp) { if (r[3] === g[0]) best = Math.max(best, Number(r[4]) || 0); if (String(r[1]) === today) got += Number(r[5]) || 0; } });
  var open = today >= gm_param_('測試版開始日');
  var cap = Number(gm_param_('小遊戲每日上限')) || 6, reward = 0;
  if (score > best && score > 0 && open) {
    reward = Math.max(0, Math.min(g[3], cap - got));
    if (reward) gm_credit_(emp, '小遊戲', reward, g[1] + ' 破個人紀錄(' + score + ' 分)', 'GAME|' + emp + '|' + g[0] + '|' + gm_now_() + '|' + score);
  }
  gm_append_('games', [[gm_now_(), today, emp, g[0], score, reward]]);
  var newCh = open ? g38_check_(emp, g[0], score, m) : [];
  return { success: true, data: { score: score, best: Math.max(best, score), newRecord: score > best, reward: reward, challenges: newCh } };
}

function g38_give_(emp, c, done, out) {
  if (done[c[0]]) return;
  var badge = c[5] ? gm_badgeDef_(c[5]) : null;
  gm_append_('g38ch', [[gm_now_(), emp, c[0], c[2], c[3], c[4], badge ? badge[1] : '']]);
  done[c[0]] = 1;
  if (c[3]) gm_credit_(emp, '小遊戲挑戰', c[3], '挑戰「' + c[2] + '」', 'G38CH|' + emp + '|' + c[0]);
  if (c[4] && typeof s30_tixAdd_ === 'function') s30_tixAdd_(emp, c[4], '挑戰「' + c[2] + '」', 'G38TIX|' + emp + '|' + c[0]);
  if (badge) gm_award_(emp, c[5], '');
  out.push({ id: c[0], name: c[2], coins: c[3] + (badge ? badge[4] || 0 : 0), tix: c[4], badge: badge ? badge[2] + ' ' + badge[1] : '' });
}
function g38_check_(emp, game, score, m) {
  var done = g38_done_(emp), out = [];
  G38_CH.forEach(function (c) { if (c[1] === game && c[6] && c[6](score, m)) g38_give_(emp, c, done, out); });
  if (/^batter/.test(game) && done.b1_star3 && done.b2_star3 && done.b3_star3) g38_give_(emp, G38_CH.filter(function (c) { return c[0] === 'b_all3'; })[0], done, out);
  return out;
}

// 覆蓋：每週一頒上週各遊戲第一名（徽章＋週冠軍獎勵）
function gm_gameWeekly_(today) {
  if (((new Date(today + 'T00:00:00Z').getUTCDay() + 6) % 7) !== 0) return;
  var from = gm_addDays_(today, -7), to = gm_addDays_(today, -1), top = {}, bonus = Number(gm_param_('小遊戲週冠軍獎勵')) || 0;
  gm_rows_('games').forEach(function (r) {
    var d = String(r[1]); if (d < from || d > to) return;
    var sc = Number(r[4]) || 0; if (!top[r[3]] || sc > top[r[3]].sc) top[r[3]] = { emp: r[2], sc: sc };
  });
  Object.keys(top).forEach(function (g) {
    if (!(top[g].sc > 0) || gm_isFrozen_(top[g].emp)) return;
    gm_award_(top[g].emp, 'gamer', g + '|' + from);
    var gd = GM_GAMES.filter(function (x) { return x[0] === g; })[0];
    if (bonus) gm_credit_(top[g].emp, '小遊戲', bonus, '小遊戲週冠軍「' + (gd ? gd[1] : g) + '」(' + from + ' 那週)', 'GWEEK|' + g + '|' + from);
  });
}

// 部署後執行一次
function g38_setup() {
  GM_CACHE_ = {};
  gm_sh_('g38ch');
  var sh = gm_sh_('params'), rows = gm_rows_('params'), found = {};
  rows.forEach(function (r, i) { found[String(r[0]).trim()] = i + 2; });
  if (found['小遊戲每日上限']) { var c = sh.getRange(found['小遊戲每日上限'], 2); if (Number(c.getValue()) === 5) c.setValue(6); }
  else gm_append_('params', [['小遊戲每日上限', 6, '小遊戲破紀錄獎勵,每天全部遊戲合計最多幾枚']]);
  if (!found['小遊戲週冠軍獎勵']) gm_append_('params', [['小遊戲週冠軍獎勵', 20, 'v1.38：每款小遊戲週排行第一名，除了徽章再加幾枚']]);
  Logger.log('g38_setup 完成');
  return true;
}

// ═══════════════════════════════════════════════
// 路由 extHandler_ v1.36（2026-11-14）
// 整段貼在「程式碼.gs」最底部即可（Apps Script 以檔案中最後一個同名函式為準，不必改原本那一個）。
// 與 v1.35 路由的差別：eqHandler_ 之前加 h36Handler_（無敵8心；也接手 homeTodo、gmScene：先呼叫 eqHandler_／s30Handler_ 再加上 8 心資料）。
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
  var h36 = h36Handler_(action, p); if (h36) return h36;
  var eq = eqHandler_(action, p); if (eq) return eq;
  var qt = qtHandler_(action, p); if (qt) return qt;
  var s30 = s30Handler_(action, p); if (s30) return s30;
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

// ═════════════════════════════════════════════════════════════
// v1.39（2026-11-14）選單整理、選人選單、公告／行事曆修正、辦公室工廠倉庫、櫃位爭霸戰、宇宙辦公室移動與即時營業額
// 底版：後端第 40 版（部署交接 v8）。整個檔案貼在「程式碼.gs」最底部（路由 v1.36 之後）即可：
//   檔案最後的「路由 v1.39」會取代路由 v1.36（Apps Script 同名函式以最後一個為準），內容是 v1.36 再加上 v39Handler_。
// 部署後執行一次 v39_setup()：建立〈即時營業額〉〈設備清單行程〉分頁、加 3 個遊戲參數，
//   並把辦公室、工廠、倉庫加進〈櫃位設定〉（場所性質＝內部；地址用 Maps 自動換成座標，第一次可能要按「允許」）。
// 安全：本模組新增的動作一律以登入通行證本人（au_verifiedId_）為準，沒有通行證就擋下，不退回 p.empId。
// 覆蓋的函式：av_grant_（發放限定造型：權限改以通行證本人判斷）、td_counters_（櫃位爭霸戰只列營業中櫃位＋進行中活動）
// 接手的動作：gmScene（先呼叫 h36Handler_ 再加 bossAt、liveRev）、eqSave（先呼叫 eqHandler_ 再同步行事曆）
// ═════════════════════════════════════════════════════════════
var V39_INNER_KIND = '內部';   // 辦公室、工廠、倉庫的「場所性質」

function v39_me_() {
  var id = au_verifiedId_();
  if (!id) throw new Error('請重新登入後再試');
  return ops_me_(id);
}
function v39_ss_() { return SpreadsheetApp.openById(SHEET_ID); }
function v39_sheet_(name, head) {
  var ss = v39_ss_(), sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(head); sh.setFrozenRows(1); }
  return sh;
}
function v39_rows_(name, head) {
  var sh = v39_sheet_(name, head); if (sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, head.length).getValues();
}
function v39_now_() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss'); }

// ───────── 1. 選人選單（Lv.3 以上）─────────
function v39_pick_(p) {
  var me = v39_me_(); if (me.role < 3) return { error: '需要 Lv.3 以上' };
  OPS_C_.staff = null;
  var out = ops_staff_().list.filter(function (x) { return !x.left; }).map(function (x) {
    var t = /加盟/.test(x.type) ? '加盟店夥伴' : /合作/.test(x.type) ? '合作夥伴' : '員工';
    return { id: x.id, name: x.nick && x.nick !== x.name ? x.name + '（' + x.nick + '）' : x.name, type: t, pos: x.pos, locs: x.managed };
  });
  out.sort(function (a, b) { return a.id < b.id ? -1 : 1; });
  return { success: true, data: out };
}
// 發放限定造型：權限改成以通行證本人判斷（原本只看 p.empId）
function av_grant_(p) {
  var target = String(p.target || '').trim(), item = String(p.item || '').trim();
  var me; try { me = v39_me_(); } catch (e) { return { error: e.message }; }
  if (me.role < 3) return { error: '只有管理者可以發放' };
  if (!target || !item) return { error: '請選夥伴和造型' };
  if (AV_LIMITED_ITEMS.indexOf(item) < 0) return { error: '不是限定款' };
  if (!av_empExists_(target)) return { error: '找不到這位夥伴' };
  if ((av_grantedMap_()[target] || []).indexOf(item) >= 0) return { success: true };
  av_sheet_('造型道具', ['員工編號', '道具', '發放者', '發放時間']).appendRow([target, item, me.id, new Date()]);
  CacheService.getScriptCache().remove('av_all');
  return { success: true };
}

// ───────── 2. 設備清單 ↔ 公司行事曆 連動 ─────────
var V39_EQCAL_HEAD = ['清單編號', '行程ID', '更新時間'];
function v39_eqCalMap_() {
  var m = {}; v39_rows_('設備清單行程', V39_EQCAL_HEAD).forEach(function (r, i) { if (r[0]) m[String(r[0])] = { ev: String(r[1]), row: i + 2 }; });
  return m;
}
function v39_eqCalSet_(listId, evId) {
  var sh = v39_sheet_('設備清單行程', V39_EQCAL_HEAD), m = v39_eqCalMap_()[listId];
  if (m) sh.getRange(m.row, 2, 1, 2).setValues([[evId, v39_now_()]]);
  else sh.appendRow([listId, evId, v39_now_()]);
}
function v39_dayDate_(d) { return new Date(d + 'T00:00:00+08:00'); }
// 舊清單（v1.35 建的行程沒有記編號）：在公司行事曆找描述是「設備檢查清單 名稱」的那一筆接手
function v39_findOldEv_(cal, L) {
  var a = v39_dayDate_(eq_addDay_(L.from, -60)), b = v39_dayDate_(eq_addDay_(L.to, 60)), key = '設備檢查清單 ' + L.name;
  var hit = cal.getEvents(a, b).filter(function (ev) { return String(ev.getDescription() || '').indexOf(key) >= 0; });
  return hit.length ? hit[0] : null;
}
function v39_eqCalSync_(L, opt) {
  var cal = cal_company_(); if (!cal) throw new Error('找不到「紅玉滿行事曆」');
  opt = opt || {};
  var map = v39_eqCalMap_()[L.id], ev = map ? cal.getEventById(map.ev) : null, updated = !!ev;
  if (!ev && opt.adopt) { ev = v39_findOldEv_(cal, L); updated = !!ev; }
  if (L.status === '取消') { if (ev) ev.deleteEvent(); return { deleted: !!ev }; }
  if (!ev && !opt.create) return { skipped: true };
  var s = v39_dayDate_(L.from), e = new Date(v39_dayDate_(L.to || L.from).getTime() + 86400000);
  var cat = CAL_CATS.indexOf(opt.cat) >= 0 ? opt.cat : '活動';
  var title = String(opt.icon || '') + L.name, desc = '設備檢查清單 ' + L.name + '\n分類：' + cat;
  if (ev) {
    if (opt.icon !== undefined) ev.setTitle(title);
    ev.setDescription(desc); ev.setLocation(L.loc || ''); ev.setAllDayDates(s, e);
  } else ev = cal.createAllDayEvent(title, s, e, { description: desc, location: L.loc || '' });
  v39_eqCalSet_(L.id, ev.getId());
  return { updated: updated, id: ev.getId() };
}
// 「加進行事曆」：沒有就建立，有就更新（不會重複）
function v39_eqCal_(p) {
  var me = v39_me_(); if (me.role < 3) return { error: '需要 Lv.3 以上' };
  OPS_C_ = {};
  var L = eq_find_(p.id);
  var r = v39_eqCalSync_(L, { create: true, adopt: true, icon: String(p.icon || '').slice(0, 4), cat: String(p.cat || '活動') });
  return { success: true, updated: !!r.updated };
}
// 改清單（日期、名稱、地點、取消）後同步行事曆；沒有加過行事曆的清單不會自動建立
function v39_eqSaveAfter_(p, res) {
  try {
    if (!res || !res.success || !res.data) return res;
    var d = eq_j_(p.data, {}) || {};
    if (['from', 'to', 'name', 'loc', 'status'].every(function (k) { return d[k] === undefined; })) return res;   // 只改項目、人員就不碰行事曆
    OPS_C_ = {};
    var L = eq_find_(p.id);
    var r = v39_eqCalSync_(L, { adopt: true });
    if (r.updated) res.calSynced = true;
    if (r.deleted) res.calDeleted = true;
  } catch (e) { res.calError = e.message; }
  return res;
}

// ───────── 3. 辦公室、工廠、倉庫（場所性質＝內部）─────────
if (typeof OPS_LOC_KIND !== 'undefined' && OPS_LOC_KIND.indexOf(V39_INNER_KIND) < 0) OPS_LOC_KIND.push(V39_INNER_KIND);
var V39_INNER_SEED = [
  ['辦公室', '台北市', '台北市信義區基隆路一段184號'],
  ['工廠', '台北市', '台北市內湖區成功路二段426巷1號'],
  ['倉庫', '新北市', '新北市三重區中興北街180巷20號']
];
// 加進〈櫃位設定〉：已經有同名的就只補座標；編號從 99 往下找沒用過的
function v39_seedInner_(log) {
  OPS_C_ = {};
  var sh = ops_ss_().getSheetByName('櫃位設定'), locs = ops_locs_(), used = {};
  locs.forEach(function (x) { if (x.code) used[x.code] = 1; });
  var nextCode = function () { for (var c = 99; c >= 10; c--) if (!used[String(c)]) { used[String(c)] = 1; return String(c); } return ''; };
  V39_INNER_SEED.forEach(function (d) {
    var geo = null;
    try { var g = Maps.newGeocoder().setRegion('tw').setLanguage('zh-TW').geocode(d[2]); if (g && g.results && g.results.length) geo = g.results[0].geometry.location; } catch (e) { log.push(d[0] + ' 地址換座標失敗：' + e.message); }
    var ex = locs.filter(function (x) { return x.name === d[0]; })[0];
    if (ex) {
      sh.getRange(ex.row, 6).setValue(V39_INNER_KIND);
      if (geo && ex.lat === '') sh.getRange(ex.row, 7, 1, 2).setValues([[geo.lat, geo.lng]]);
      log.push(d[0] + ' 已存在，場所性質設為內部' + (geo && ex.lat === '' ? '、補上座標' : ''));
      return;
    }
    var code = nextCode();
    var row = [d[0], d[1], 'B直結', '', '營運中', V39_INNER_KIND, geo ? geo.lat : '', geo ? geo.lng : '', '雞蛋糕', "'" + code];
    sh.getRange(sh.getLastRow() + 1, 1, 1, row.length).setValues([row]);
    log.push('新增 ' + d[0] + '（編號 ' + code + '）' + (geo ? '座標 ' + geo.lat.toFixed(5) + ',' + geo.lng.toFixed(5) : '（沒有座標，打卡不檢查距離，可在 App 櫃位管理補）'));
  });
  OPS_C_ = {};
}

// ───────── 4. 櫃位爭霸戰：只列營業中的櫃位＋進行中的活動 ─────────
// 覆蓋 td_counters_（v1.27）：原本是「業績類型含百貨、沒結束」，休賽期也會出現
// 現在：① 業績類型含「百貨」且狀態＝營運中的櫃位；② 場所性質＝活動、狀態＝營運中，且最近 N 天（〈遊戲參數〉爭霸戰活動天數，預設 3）有人上班的活動
// 內部（辦公室、工廠、倉庫）、合作品牌、加盟不列入。等級、捐獻紀錄都保留，重新營業就回來。
function td_counters_() {
  if (GM_CACHE_.v39tc) return GM_CACHE_.v39tc.slice();
  var sh = gm_ss_().getSheetByName('櫃位設定'), out = [], acts = [];
  if (sh && sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues().forEach(function (r) {
    var n = String(r[0]).trim(); if (!n) return;
    var st = String(r[4] || '營運中').trim() || '營運中', kind = String(r[5] || '').trim();
    if (st !== '營運中') return;
    if (kind === '活動') acts.push(n);
    else if (/百貨/.test(String(r[2])) && !/內部|合作|加盟/.test(kind)) out.push(n);
  });
  if (acts.length) {
    var days = Number(gm_param_('爭霸戰活動天數')) || 3, since = gm_addDays_(gm_today_(), -days), hot = {};
    gm_rows_('hours').forEach(function (r) { if (String(r[0]) >= since && acts.indexOf(r[2]) >= 0) hot[r[2]] = 1; });
    try {   // 今天剛上班、還沒日結的也算
      gm_punchRows_().forEach(function (p) { if (p.date >= since && acts.indexOf(p.loc) >= 0) hot[p.loc] = 1; });
    } catch (e) {}
    acts.forEach(function (a) { if (hot[a]) out.push(a); });
  }
  GM_CACHE_.v39tc = out;
  return out.slice();
}

// ───────── 5. 宇宙辦公室：大隊長選擇要去哪裡 ─────────
// 存在 Script Properties「gm_大隊長前往」：{ loc, date, time }，只在當天有效；loc 空白＝回辦公室
function v39_isBoss_(me) { return me.role >= 5 || me.pos === '大隊長'; }
function v39_goto_(p) {
  var me = v39_me_(); if (!v39_isBoss_(me)) return { error: '只有大隊長可以選擇前往的地點' };
  var loc = String(p.loc || '').trim().slice(0, 40);
  if (loc && loc !== '辦公室' && !ops_locByName_(loc)) return { error: '找不到這個地點' };
  var v = loc && loc !== '辦公室' ? { loc: loc, date: gm_today_(), time: Utilities.formatDate(new Date(), 'Asia/Taipei', 'HH:mm') } : null;
  gm_setState_('大隊長前往', v ? JSON.stringify(v) : '');
  return { success: true, data: v };
}
function v39_bossAt_() {
  try { var v = JSON.parse(gm_getState_('大隊長前往') || 'null'); return v && v.date === gm_today_() ? v : null; } catch (e) { return null; }
}

// ───────── 6. 即時營業額回報（不強迫、次數不限；全部夥伴看得到）─────────
var V39_REV_HEAD = ['時間', '日期', '櫃位', '營業額', '員工編號'];
function v39_onDutyAt_(emp, loc) {   // 今天在這個地點上班中（最後一筆是上班）
  var t = gm_today_(), last = null;
  gm_punchRows_().forEach(function (p) { if (p.emp === emp && p.date === t && (p.type === '上班' || p.type === '下班') && (!last || p.t >= last.t)) last = p; });
  return !!last && last.type === '上班' && ops_sameLoc_(last.loc, loc);
}
function v39_rev_(p) {
  var me = v39_me_(), loc = String(p.loc || '').trim(), amt = Math.round(Number(p.amount));
  var L = ops_locByName_(loc); if (!L) return { error: '找不到這個櫃位' };
  if (L.kind === V39_INNER_KIND) return { error: '辦公室、工廠、倉庫不用回報營業額' };
  if (!(amt >= 0) || amt > 2000000) return { error: '請填正確的金額' };
  if (me.role < 2 && !v39_onDutyAt_(me.id, loc)) return { error: '要在這個櫃位上班中才能回報' };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var now = new Date(), t = Utilities.formatDate(now, 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss'), d = gm_today_();
    var sh = v39_sheet_('即時營業額', V39_REV_HEAD);
    sh.appendRow([t, d, loc, amt, me.id]);
    // 小獎勵：每人每天前 N 次各給幾枚（〈遊戲參數〉即時營業額獎勵／即時營業額每日次數）
    var n = 0; v39_rows_('即時營業額', V39_REV_HEAD).forEach(function (r) { if (String(r[4]) === me.id && v39_d_(r[1]) === d) n++; });
    var max = Number(gm_param_('即時營業額每日次數')), coin = Number(gm_param_('即時營業額獎勵'));
    if (!(max >= 0)) max = 3; if (!(coin >= 0)) coin = 2;
    var got = 0;
    if (coin > 0 && n <= max && !gm_isFrozen_(me.id)) { gm_credit_(me.id, '即時營業額', coin, loc + ' ' + t.slice(11, 16) + ' 回報營業額', 'REVLIVE|' + me.id + '|' + d + '|' + n); got = coin; }
    return { success: true, coin: got, data: v39_revBoard_() };
  } finally { lock.releaseLock(); }
}
function v39_d_(v) { return v instanceof Date ? Utilities.formatDate(v, 'Asia/Taipei', 'yyyy-MM-dd') : String(v || '').slice(0, 10); }
// 今日看板：每個櫃位最新一筆（時間、金額、回報人），依金額排序
function v39_revBoard_() {
  var d = gm_today_(), emps = gm_emps_(), last = {};
  v39_rows_('即時營業額', V39_REV_HEAD).forEach(function (r) {
    if (v39_d_(r[1]) !== d) return;
    var t = r[0] instanceof Date ? Utilities.formatDate(r[0], 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss') : String(r[0]);
    var loc = String(r[2]); if (!last[loc] || t >= last[loc].t) last[loc] = { t: t, amt: Number(r[3]) || 0, by: String(r[4]) };
  });
  return Object.keys(last).map(function (loc) {
    var x = last[loc], e = emps[x.by];
    return { loc: loc, amount: x.amt, time: x.t.slice(11, 16), by: e ? (e.nick || e.name) : x.by };
  }).sort(function (a, b) { return b.amount - a.amount; });
}

// ───────── 7. setup（部署後執行一次）─────────
function v39_setup() {
  var log = [];
  v39_sheet_('即時營業額', V39_REV_HEAD); v39_sheet_('設備清單行程', V39_EQCAL_HEAD);
  var have = {}; gm_rows_('params').forEach(function (r) { have[String(r[0]).trim()] = 1; });
  var add = [['即時營業額獎勵', 2, 'v1.39：宇宙辦公室回報即時營業額，每次給幾枚（0＝不給）'], ['即時營業額每日次數', 3, 'v1.39：每人每天前幾次回報有獎勵（回報次數不限）'],
             ['爭霸戰活動天數', 3, 'v1.39：活動最近幾天有人上班，才出現在櫃位爭霸戰']].filter(function (x) { return !have[x[0]]; });
  if (add.length) { gm_append_('params', add); log.push('遊戲參數新增 ' + add.map(function (x) { return x[0]; }).join('、')); }
  v39_seedInner_(log);
  GM_CACHE_ = {}; OPS_C_ = {};
  Logger.log(log.join('\n'));
  return log.join('\n');
}

// ───────── 8. 動作 ─────────
AU_READ = new RegExp(AU_READ.source.replace(/\)\$$/, '|pplPick|v39RevBoard)$'));
function v39Handler_(action, p) {
  p = p || {};
  if (action === 'gmScene') {            // 接在 h36（8 心）後面：加上大隊長前往、即時營業額看板
    try {
      var r = h36Handler_('gmScene', p); if (!r || !r.data) return r;
      r.data.bossAt = v39_bossAt_();
      try { r.data.liveRev = v39_revBoard_(); } catch (e) { r.data.liveRev = []; }
      return r;
    } catch (e) { return null; }
  }
  if (action === 'eqSave') {             // 設備清單改日期、取消 → 行事曆跟著改
    var res = eqHandler_('eqSave', p);
    return v39_eqSaveAfter_(p, res);
  }
  var map = { pplPick: v39_pick_, eqCal: v39_eqCal_, v39Goto: v39_goto_, v39Rev: v39_rev_, v39RevBoard: function () { return { success: true, data: v39_revBoard_() }; } };
  if (!map[action]) return null;
  try { OPS_C_ = {}; GM_CACHE_ = {}; return map[action](p); } catch (e) { return { error: e.message }; }
}

// ═══════════════════════════════════════════════
// 路由 extHandler_ v1.39（2026-11-14）
// 整段貼在「程式碼.gs」最底部，取代路由 v1.36（Apps Script 以檔案中最後一個同名函式為準）。
// 與 v1.36 路由的差別：h36Handler_ 之前加 v39Handler_（選人選單、設備清單↔行事曆、大隊長前往、即時營業額；
//   也接手 gmScene：先呼叫 h36Handler_ 再加上大隊長前往與即時營業額；接手 eqSave：先存清單再同步行事曆）。
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
  var v39 = v39Handler_(action, p); if (v39) return v39;
  var h36 = h36Handler_(action, p); if (h36) return h36;
  var eq = eqHandler_(action, p); if (eq) return eq;
  var qt = qtHandler_(action, p); if (qt) return qt;
  var s30 = s30Handler_(action, p); if (s30) return s30;
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

// v4（部署端，以製作端 v3 為底）：c31_notMe_ 沒有通行證一律擋（小店購物、寵物市集），見檔案末段
// ═════════════════════════════════════════════════════════════
// v1.40（2026-11-14）宇宙辦公室：休息區／沙發區、Lv.3 視察、視察提醒、跑馬燈、營業額里程碑與超車、
//   工廠／倉庫看板、坐騎（買斷＋每月前 5 名品牌款）、請喝咖啡、提醒
// 底版：後端第 41 版（部署交接 v9）。整個檔案貼在「程式碼.gs」最底部（路由 v1.39 之後）即可：
//   檔案最後的「路由 v1.40」會取代路由 v1.39（同名函式以最後一個為準），內容是 v1.39 再加上 v40Handler_。
// 部署後執行一次 v40_setup()：建立〈宇宙通知〉〈宇宙動態〉〈坐騎〉〈坐騎使用〉分頁、加遊戲參數。
// 安全：本模組所有寫入動作一律以登入通行證本人（au_verifiedId_，經 v39_me_）為準，沒有通行證就擋下。
// 不覆蓋任何既有函式。接手的動作：
//   gmScene（先呼叫 v39Handler_ → h36 → s30，再加 people／visits／mounts／ticker／celebrate／coffee／boards）
//   v39Rev（先呼叫 v39Handler_ 回報，再判斷里程碑、超車、寫跑馬燈）
//   v39Goto（大隊長舊動作，改走 v40 視察：Lv.3 以上都能用）
// ═════════════════════════════════════════════════════════════
var V40_NOTE_HEAD = ['時間', '日期', '收件人', '類型', '內容', '已讀', '來源鍵'];
var V40_EVT_HEAD = ['時間', '日期', '類型', '內容', '櫃位'];
var V40_MOUNT_HEAD = ['員工編號', '坐騎', '取得方式', '取得時間', '到期日'];
var V40_RIDE_HEAD = ['員工編號', '坐騎', '更新時間'];
// 一般款：永久買斷；品牌款：每月依上個月工時前 5 名分配、或管理者發放，期限一個月
var V40_MOUNTS = {
  bike:   { name: '腳踏車', icon: '🚲', price: 50 },
  scooter:{ name: '機車',   icon: '🛵', price: 120 },
  car:    { name: '汽車',   icon: '🚗', price: 250 },
  suv:    { name: '休旅車', icon: '🚙', price: 300 },
  truck:  { name: '貨車',   icon: '🚚', price: 300 },
  sports: { name: '跑車',   icon: '🏎️', price: 500 },
  trex:   { name: '小暴龍', icon: '🦖', brand: true },
  train:  { name: '火車',   icon: '🚂', brand: true },
  digger: { name: '挖土機', icon: '🚜', brand: true },
  trike:  { name: '三角龍', icon: '🦕', brand: true },
  bird:   { name: '赤心大鳥', icon: '🐤', brand: true }
};
var V40_BRAND_ORDER = ['trex', 'train', 'digger', 'trike', 'bird'];   // 上個月工時第 1～5 名

function v40_s_(name, head) { return v39_sheet_(name, head); }
function v40_rows_(name, head) { return v39_rows_(name, head); }
function v40_today_() { return gm_today_(); }
function v40_hm_() { return Utilities.formatDate(new Date(), 'Asia/Taipei', 'HH:mm'); }
function v40_nm_(id) { var e = gm_emp_(id); return e ? (e.nick || e.name) : String(id); }
function v40_isMgr_(me) { return me && (me.role >= 3 || me.pos === '大隊長'); }
function v40_isBossId_(id) { var e = gm_emp_(id); return !!e && (e.role >= 5 || e.pos === '大隊長'); }

// ───────── 1. 提醒（站內通知；前端每分鐘讀一次）─────────
// cap：'day' 同一個收件人＋類型每天一次；'pair' 同一個寄件人＋收件人＋類型每天一次
function v40_note_(to, type, text, cap, from) {
  to = String(to || ''); if (!to) return false;
  var d = v40_today_(), key = type + '|' + to + '|' + d + (cap === 'pair' ? '|' + (from || '') : '');
  var rows = v40_rows_('宇宙通知', V40_NOTE_HEAD);
  for (var i = rows.length - 1; i >= 0 && i >= rows.length - 400; i--) if (String(rows[i][6]) === key) return false;
  v40_s_('宇宙通知', V40_NOTE_HEAD).appendRow([v39_now_(), d, to, type, String(text).slice(0, 120), '', key]);
  return true;
}
function v40_notes_(p) {
  var me = v39_me_(), sh = v40_s_('宇宙通知', V40_NOTE_HEAD), rows = v40_rows_('宇宙通知', V40_NOTE_HEAD);
  var since = gm_addDays_(v40_today_(), -2), out = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i]; if (String(r[2]) !== me.id || r[5] || v39_d_(r[1]) < since) continue;
    out.push({ type: String(r[3]), text: String(r[4]), time: (r[0] instanceof Date ? Utilities.formatDate(r[0], 'Asia/Taipei', 'HH:mm') : String(r[0]).slice(11, 16)) });
    sh.getRange(i + 2, 6).setValue('Y');
  }
  return { success: true, data: out };
}

// ───────── 2. 跑馬燈（今日動態）─────────
function v40_event_(type, text, loc) { v40_s_('宇宙動態', V40_EVT_HEAD).appendRow([v39_now_(), v40_today_(), type, String(text).slice(0, 80), loc || '']); }
function v40_ticker_() {
  var d = v40_today_(), out = [];
  v40_rows_('宇宙動態', V40_EVT_HEAD).forEach(function (r) {
    if (v39_d_(r[1]) !== d) return;
    var t = r[0] instanceof Date ? Utilities.formatDate(r[0], 'Asia/Taipei', 'HH:mm') : String(r[0]).slice(11, 16);
    out.push({ time: t, type: String(r[2]), text: String(r[3]), loc: String(r[4] || '') });
  });
  return out.slice(-20).reverse();
}

// ───────── 3. 誰在上班、在哪裡（今天最後一筆打卡是上班）─────────
function v40_dutyMap_() {
  if (GM_CACHE_.v40duty) return GM_CACHE_.v40duty;
  var t = v40_today_(), last = {};
  gm_punchRows_().forEach(function (p) { if (p.date === t && (p.type === '上班' || p.type === '下班') && (!last[p.emp] || p.t >= last[p.emp].t)) last[p.emp] = p; });
  var out = {}; Object.keys(last).forEach(function (e) { if (last[e].type === '上班') out[e] = last[e].loc; });
  return (GM_CACHE_.v40duty = out);
}
function v40_dutyAt_(loc) { var m = v40_dutyMap_(); return Object.keys(m).filter(function (e) { return ops_sameLoc_(m[e], loc); }); }

// ───────── 4. 視察（Lv.3 以上，含大隊長）─────────
// Script Properties「gm_宇宙前往」：{ 員工編號: { loc, date, time } }，只在當天有效
// loc：''＝辦公室沙發區（平常的位置）、'休息區'、或〈櫃位設定〉中的地點（櫃位、活動、工廠、倉庫）
function v40_visits_() {
  var m = {}; try { m = JSON.parse(gm_getState_('宇宙前往') || '{}') || {}; } catch (e) { m = {}; }
  var d = v40_today_(), out = {};
  Object.keys(m).forEach(function (k) { if (m[k] && m[k].date === d) out[k] = m[k]; });
  return out;
}
function v40_goto_(p) {
  var me = v39_me_(); if (!v40_isMgr_(me)) return { error: 'Lv.3 以上才能視察' };
  var loc = String(p.loc || '').trim().slice(0, 40);
  if (loc === '辦公室' || loc === '沙發區') loc = '';
  var L = null;
  if (loc && loc !== '休息區') { L = ops_locByName_(loc); if (!L) return { error: '找不到這個地點' }; }
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var m = v40_visits_();
    if (loc) m[me.id] = { loc: loc, date: v40_today_(), time: v40_hm_() }; else delete m[me.id];
    gm_setState_('宇宙前往', JSON.stringify(m));
    if (v40_isBossId_(me.id)) gm_setState_('大隊長前往', loc && loc !== '休息區' ? JSON.stringify({ loc: loc, date: v40_today_(), time: v40_hm_() }) : '');   // v1.39 相容
  } finally { lock.releaseLock(); }
  var who = v40_isBossId_(me.id) ? '大隊長' : v40_nm_(me.id);
  if (L) {
    v40_dutyAt_(loc).forEach(function (e) { if (e !== me.id) v40_note_(e, 'visit', who + ' 來看你了 👀', 'day'); });
    v40_event_('visit', who + ' 到 ' + shortLoc_(loc) + ' 視察', loc);
  }
  return { success: true, data: loc ? { loc: loc, date: v40_today_(), time: v40_hm_() } : null };
}
function shortLoc_(loc) { return String(loc || '').replace(/^\d+/, '').replace(/^(正櫃|快閃櫃|展覽|活動|分隊長)/, '') || loc; }
// 主管在名片上按「👍 辛苦了」（可附一句話）
function v40_cheer_(p) {
  var me = v39_me_(); if (!v40_isMgr_(me)) return { error: 'Lv.3 以上才能使用' };
  var to = String(p.to || '').trim(); if (!gm_emp_(to) || to === me.id) return { error: '找不到這位隊員' };
  var msg = String(p.msg || '').trim().slice(0, 40);
  var who = v40_isBossId_(me.id) ? '大隊長' : v40_nm_(me.id);
  var ok = v40_note_(to, 'cheer', who + '：' + (msg || '辛苦了！👍'), 'pair', me.id);
  return ok ? { success: true } : { error: '今天已經跟他說過了' };
}

// ───────── 5. 即時營業額：里程碑、超車、跑馬燈（接在 v1.39 回報之後）─────────
function v40_milestones_() {
  var s = String(gm_param_('即時營業額里程碑') || '3000,5000,10000');
  return s.split(/[,，\s]+/).map(Number).filter(function (n) { return n > 0; }).sort(function (a, b) { return a - b; });
}
function v40_afterRev_(p, before, res) {
  try {
    if (!res || !res.success) return res;
    var loc = String(p.loc || '').trim(), after = res.data || v39_revBoard_();
    var amt = 0, rank = 0; after.forEach(function (x, i) { if (x.loc === loc) { amt = x.amount; rank = i + 1; } });
    var prev = 0; (before || []).forEach(function (x) { if (x.loc === loc) prev = x.amount; });
    var me = v39_me_(), sl = shortLoc_(loc);
    v40_event_('rev', v40_nm_(me.id) + ' 回報 ' + sl + ' $' + amt.toLocaleString() + (rank === 1 && after.length > 1 ? '，暫居第一 🥇' : ''), loc);
    // 里程碑：這次跨過的最高門檻
    var hit = 0; v40_milestones_().forEach(function (th) { if (prev < th && amt >= th) hit = th; });
    if (hit) {
      v40_event_('milestone', '🎆 ' + sl + ' 破 ' + hit.toLocaleString() + '！', loc);
      v40_dutyAt_(loc).concat([]).forEach(function (e) { v40_note_(e, 'milestone', '🎆 ' + sl + ' 今天破 ' + hit.toLocaleString() + ' 了！', 'day'); });
    }
    // 超車：之前在我前面、現在在我後面的櫃位
    var beforeAmt = {}; (before || []).forEach(function (x) { beforeAmt[x.loc] = x.amount; });
    after.forEach(function (x) {
      if (x.loc === loc || beforeAmt[x.loc] == null) return;
      if (beforeAmt[x.loc] > prev && x.amount < amt) {
        v40_dutyAt_(x.loc).forEach(function (e) { v40_note_(e, 'overtake', sl + ' 剛超過你們了！加油 💪', 'day'); });
        v40_event_('overtake', sl + ' 超過 ' + shortLoc_(x.loc) + '！', loc);
      }
    });
    res.milestone = hit || 0;
  } catch (e) { res.v40Error = e.message; }
  return res;
}
function v40_celebrate_() {   // 今天的里程碑（前端放煙火用）
  return v40_ticker_().filter(function (x) { return x.type === 'milestone'; }).map(function (x) { return { loc: x.loc, time: x.time, text: x.text }; });
}

// ───────── 6. 坐騎 ─────────
function v40_mountRows_() { return v40_rows_('坐騎', V40_MOUNT_HEAD); }
function v40_owned_(emp) {   // { 坐騎: 到期日（''＝永久） }，只列還有效的
  var d = v40_today_(), out = {};
  v40_mountRows_().forEach(function (r) {
    if (String(r[0]) !== emp) return;
    var id = String(r[1]), exp = r[4] ? v39_d_(r[4]) : '';
    if (exp && exp < d) return;
    if (!exp) out[id] = '';
    else if (out[id] !== '' && (out[id] === undefined || exp > out[id])) out[id] = exp;
  });
  return out;
}
function v40_rideMap_() {   // 全部人目前騎的坐騎（只回有效的）
  if (GM_CACHE_.v40ride) return GM_CACHE_.v40ride;
  var d = v40_today_(), valid = {}, chosen = {};
  v40_mountRows_().forEach(function (r) {
    var e = String(r[0]), id = String(r[1]), exp = r[4] ? v39_d_(r[4]) : '';
    if (exp && exp < d) return;
    (valid[e] = valid[e] || {})[id] = 1;
  });
  v40_rows_('坐騎使用', V40_RIDE_HEAD).forEach(function (r) { chosen[String(r[0])] = String(r[1]); });
  var out = {};
  Object.keys(valid).forEach(function (e) {
    var c = chosen[e];
    if (c === 'none') return;
    if (c && valid[e][c]) { out[e] = c; return; }
    // 沒選或選的已到期：品牌款優先，其次最貴的一般款
    var ids = Object.keys(valid[e]);
    var brand = ids.filter(function (x) { return V40_MOUNTS[x] && V40_MOUNTS[x].brand; })[0];
    out[e] = brand || ids.sort(function (a, b) { return ((V40_MOUNTS[b] || {}).price || 0) - ((V40_MOUNTS[a] || {}).price || 0); })[0];
  });
  return (GM_CACHE_.v40ride = out);
}
function v40_setRide_(emp, id) {
  var sh = v40_s_('坐騎使用', V40_RIDE_HEAD), rows = v40_rows_('坐騎使用', V40_RIDE_HEAD);
  for (var i = 0; i < rows.length; i++) if (String(rows[i][0]) === emp) { sh.getRange(i + 2, 2, 1, 2).setValues([[id, v39_now_()]]); GM_CACHE_.v40ride = null; return; }
  sh.appendRow([emp, id, v39_now_()]); GM_CACHE_.v40ride = null;
}
function v40_monthEnd_(d) { var y = +d.slice(0, 4), m = +d.slice(5, 7); var t = new Date(Date.UTC(y, m, 0)); return t.toISOString().slice(0, 10); }
function v40_plusMonth_(d) { var y = +d.slice(0, 4), m = +d.slice(5, 7), dd = +d.slice(8, 10); var t = new Date(Date.UTC(y, m, Math.min(dd, 28))); return t.toISOString().slice(0, 10); }
function v40_mountMe_(p) {
  var me = v39_me_(), own = v40_owned_(me.id), ride = v40_rideMap_()[me.id] || '';
  return { success: true, data: { owned: own, ride: ride, catalog: V40_MOUNTS, balance: gm_balance_(me.id), alloc: v40_lastAlloc_() } };
}
function v40_mountBuy_(p) {
  var me = v39_me_(), id = String(p.id || ''), M = V40_MOUNTS[id];
  if (!M || M.brand) return { error: '這台不能買（品牌款靠每月上班時數前 5 名拿到）' };
  if (gm_isFrozen_(me.id)) return { error: '帳號不能使用赤心幣' };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    if (v40_owned_(me.id)[id] !== undefined) return { error: '你已經有這台了' };
    var bal = gm_balance_(me.id); if (bal < M.price) return { error: '赤心幣不足，還差 ' + (M.price - bal) + ' 枚' };
    if (!gm_credit_(me.id, '坐騎', -M.price, '買 ' + M.name, 'MOUNT|' + me.id + '|' + id)) return { error: '你已經有這台了' };
    v40_s_('坐騎', V40_MOUNT_HEAD).appendRow([me.id, id, '購買', v39_now_(), '']);
    v40_setRide_(me.id, id);
    v40_event_('mount', v40_nm_(me.id) + ' 買了' + M.icon + M.name, '');
    return { success: true, balance: gm_balance_(me.id) };
  } finally { lock.releaseLock(); }
}
function v40_mountRide_(p) {
  var me = v39_me_(), id = String(p.id || '');
  if (id && id !== 'none' && v40_owned_(me.id)[id] === undefined) return { error: '你沒有這台坐騎' };
  v40_setRide_(me.id, id || 'none');
  return { success: true };
}
// 管理者發放：一般款永久、品牌款一個月
function v40_mountGrant_(p) {
  var me = v39_me_(); if (me.role < 3) return { error: '只有管理者可以發放' };
  var to = String(p.target || '').trim(), id = String(p.id || ''), M = V40_MOUNTS[id];
  if (!M) return { error: '請選坐騎' };
  if (!gm_emp_(to)) return { error: '找不到這位隊員' };
  var exp = M.brand ? v40_plusMonth_(v40_today_()) : '';
  if (!M.brand && v40_owned_(to)[id] !== undefined) return { error: '他已經有這台了' };
  v40_s_('坐騎', V40_MOUNT_HEAD).appendRow([to, id, '發放（' + me.name + '）', v39_now_(), exp]);
  v40_setRide_(to, id);
  v40_note_(to, 'mount', '🎁 你獲得了' + M.icon + M.name + (exp ? '（到 ' + exp.slice(5).replace('-', '/') + '）' : '') + '！', 'pair', me.id + id);
  v40_event_('mount', v40_nm_(to) + ' 獲得' + M.icon + M.name, '');
  return { success: true };
}
// 每月 1 日（第一次有人打開宇宙辦公室時）：上個月工時前 5 名拿品牌款，到這個月底
function v40_lastAlloc_() { try { return JSON.parse(gm_getState_('坐騎分配') || 'null'); } catch (e) { return null; } }
function v40_allocMonthly_() {
  var d = v40_today_(), ym = d.slice(0, 7), last = v40_lastAlloc_();
  if (last && last.month === ym) return;
  var lock = LockService.getScriptLock(); if (!lock.tryLock(5000)) return;
  try {
    last = v40_lastAlloc_(); if (last && last.month === ym) return;
    var prevYm = gm_addDays_(ym + '-01', -1).slice(0, 7), sum = {}, staff = ops_staff_().map;
    gm_rows_('hours').forEach(function (r) {
      if (v39_d_(r[0]).slice(0, 7) !== prevYm) return;
      var e = String(r[1]), s = staff[e]; if (!s || s.left || (s.type && s.type !== '員工')) return;
      sum[e] = (sum[e] || 0) + (Number(r[3]) || 0);
    });
    var top = Object.keys(sum).filter(function (e) { return sum[e] > 0; }).sort(function (a, b) { return sum[b] - sum[a]; }).slice(0, 5);
    var exp = v40_monthEnd_(d), win = [];
    top.forEach(function (e, i) {
      var id = V40_BRAND_ORDER[i], M = V40_MOUNTS[id];
      v40_s_('坐騎', V40_MOUNT_HEAD).appendRow([e, id, prevYm + ' 工時第 ' + (i + 1) + ' 名', v39_now_(), exp]);
      v40_setRide_(e, id);
      v40_note_(e, 'mount', '🏆 上個月上班時數第 ' + (i + 1) + ' 名！這個月可以騎' + M.icon + M.name + '（到 ' + exp.slice(5).replace('-', '/') + '）', 'day');
      win.push({ emp: e, name: v40_nm_(e), mount: id, hours: Math.round(sum[e] / 60) });
    });
    gm_setState_('坐騎分配', JSON.stringify({ month: ym, from: prevYm, winners: win }));
    if (win.length) v40_event_('mount', '本月坐騎得主：' + win.map(function (w) { return V40_MOUNTS[w.mount].icon + w.name; }).join('、'), '');
  } finally { lock.releaseLock(); }
}

// ───────── 7. 請喝咖啡（花 1 枚；同一個人一天一次）─────────
function v40_coffee_(p) {
  var me = v39_me_(), to = String(p.to || '').trim();
  if (!gm_emp_(to) || to === me.id) return { error: '找不到這位隊員' };
  if (gm_isFrozen_(me.id)) return { error: '帳號不能使用赤心幣' };
  var cost = Number(gm_param_('請喝咖啡價格')); if (!(cost >= 0)) cost = 1;
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var key = 'COFFEE|' + me.id + '|' + to + '|' + v40_today_();
    if (gm_hasKey_(key)) return { error: '今天已經請過他了' };
    if (cost > 0 && gm_balance_(me.id) < cost) return { error: '赤心幣不足' };
    var noted = v40_note_(to, 'coffee', v40_nm_(me.id) + ' 請你喝一杯咖啡 ☕', 'pair', me.id);
    if (!noted) return { error: '今天已經請過他了' };
    if (cost > 0) gm_credit_(me.id, '請喝咖啡', -cost, '請 ' + v40_nm_(to) + ' 喝咖啡', key);
    v40_event_('coffee', v40_nm_(me.id) + ' 請 ' + v40_nm_(to) + ' 喝咖啡 ☕', '');
    return { success: true, balance: gm_balance_(me.id) };
  } finally { lock.releaseLock(); }
}

// ───────── 8. 工廠／倉庫看板（先用叫貨單，之後接 ERP）─────────
function v40_boards_() {
  var d = v40_today_(), batter = 0, flour = 0, pend = 0, shipped = 0, todayIn = 0, byLoc = {};
  try {
    ops_matRows_().forEach(function (x) {
      if (x.status === '已取消') return;
      var open = x.status === '已送出' || x.status === '已收到';
      if (open) { pend++; x.items.forEach(function (it) { if (/麵糊/.test(it.item)) { batter += it.qty; byLoc[x.loc] = (byLoc[x.loc] || 0) + it.qty; } if (/麵粉|預拌/.test(it.item)) flour += it.qty; }); }
      if (x.status === '已出貨') shipped++;
      if (String(x.created).slice(0, 10) === d) todayIn++;
    });
  } catch (e) {}
  return {
    factory: { batter: batter, flour: flour, byLoc: Object.keys(byLoc).map(function (l) { return { loc: shortLoc_(l), qty: byLoc[l] }; }).sort(function (a, b) { return b.qty - a.qty; }).slice(0, 4) },
    warehouse: { pending: pend, shipped: shipped, todayIn: todayIn }
  };
}

// ───────── 9. 休息區名單：全部在職隊員（不含合作品牌、加盟）─────────
function v40_people_() {
  return ops_staff_().list.filter(function (x) { return !x.left && (!x.type || x.type === '員工'); }).slice(0, 80)
    .map(function (x) { return { id: x.id, name: x.nick || x.name, mgr: x.role >= 3 || x.pos === '大隊長', boss: x.role >= 5 || x.pos === '大隊長' }; });
}

// ───────── 10. setup ─────────
function v40_setup() {
  var log = [];
  [['宇宙通知', V40_NOTE_HEAD], ['宇宙動態', V40_EVT_HEAD], ['坐騎', V40_MOUNT_HEAD], ['坐騎使用', V40_RIDE_HEAD]].forEach(function (x) { v40_s_(x[0], x[1]); });
  var have = {}; gm_rows_('params').forEach(function (r) { have[String(r[0]).trim()] = 1; });
  var add = [['即時營業額里程碑', '3000,5000,10000', 'v1.40：櫃位當天即時營業額破這些門檻會放煙火（逗號分隔）'],
             ['請喝咖啡價格', 1, 'v1.40：休息區請喝咖啡花幾枚（0＝免費）']].filter(function (x) { return !have[x[0]]; });
  if (add.length) { gm_append_('params', add); log.push('遊戲參數新增 ' + add.map(function (x) { return x[0]; }).join('、')); }
  log.push('分頁就緒：宇宙通知、宇宙動態、坐騎、坐騎使用');
  v40_shopSetup_(log);
  Logger.log(log.join('\n'));
  return log.join('\n');
}

// ───────── 11. 動作 ─────────
AU_READ = new RegExp(AU_READ.source.replace(/\)\$$/, '|v40MountMe|spProposals)$'));
function v40Handler_(action, p) {
  p = p || {};
  if (action === 'gmScene') {
    var r = v39Handler_('gmScene', p); if (!r || !r.data) return r;
    try { v40_allocMonthly_(); } catch (e) {}
    var safe = function (f, dv) { try { return f(); } catch (e) { return dv; } };
    r.data.people = safe(v40_people_, []);
    r.data.visits = safe(v40_visits_, {});
    r.data.mounts = safe(v40_rideMap_, {});
    r.data.ticker = safe(v40_ticker_, []);
    r.data.celebrate = safe(v40_celebrate_, []);
    r.data.boards = safe(v40_boards_, null);
    r.data.mountAlloc = safe(v40_lastAlloc_, null);
    return r;
  }
  if (action === 'v39Rev') {
    var before = []; try { before = v39_revBoard_(); } catch (e) {}
    var res = v39Handler_('v39Rev', p);
    return v40_afterRev_(p, before, res);
  }
  var map = { v39Goto: v40_goto_, v40Goto: v40_goto_, v40Cheer: v40_cheer_, v40Notes: v40_notes_, v40Coffee: v40_coffee_,
              v40MountMe: v40_mountMe_, v40MountBuy: v40_mountBuy_, v40MountRide: v40_mountRide_, v40MountGrant: v40_mountGrant_,
              spClose: v40_shopClose_, spTopup: v40_shopTopup_, spPropose: v40_propose_, spProposals: v40_proposals_, spProposalSet: v40_proposalSet_ };
  if (!map[action]) return null;
  var lock = null;
  try {
    OPS_C_ = {}; GM_CACHE_ = {};
    if (/^sp(Close|Topup)$/.test(action)) { lock = LockService.getScriptLock(); lock.waitLock(20000); }
    return map[action](p);
  } catch (e) { return { error: e.message }; }
  finally { if (lock) lock.releaseLock(); }
}

// ═════════════════════════════════════════════════════════════
// v1.40 第二部分：隊員商店街（隊長 11/14 16:06）
//   ① 開店要先預付「營運金」；每天依（月租＋水電）÷ 當月天數，從營運金扣；扣不夠 → 暫停營業，儲值後恢復
//   ② 可以結束營業：結算到今天（按天數比例），剩下的營運金退回；開店費不退
//   ③ 一個人最多開 2 家（每〈遊戲參數〉小店每人上限），條件一樣：資歷 1080 小時（測試期免）＋開店費
//   ④ 新店種：服飾店、陀螺對戰店、寵物用品店、書店、照相館、家具行、冰店、玩具店
//   ⑤ 店種提案：隊員可以提出想開的店與想賣的東西，管理者規劃後上架
// 覆蓋的函式：sp_shop_、sp_list_、sp_open_、sp_update_、sp_buy_（以 v1.31 版為底，保留通行證身分檢查、同店每日上限、抽成明細）、
//            sp_scene_、c31_shopRent_（改成空的：月租改由營運金每天扣，不再從上月營營收扣，避免重複收）
// 〈小店〉分頁新增欄位：店號、營運金、結算日、狀態（v40_setup 會補標題）
// ═════════════════════════════════════════════════════════════
if (PV_SHEETS.shops && PV_SHEETS.shops[1].length === 8) PV_SHEETS.shops[1] = PV_SHEETS.shops[1].concat(['店號', '營運金', '結算日', '狀態']);
var V40_NEW_TYPES = ['服飾店', '陀螺對戰店', '寵物用品店', '書店', '照相館', '家具行', '冰店', '玩具店'];
V40_NEW_TYPES.forEach(function (t) { if (PV_SHOP_TYPES.indexOf(t) < 0) PV_SHOP_TYPES.push(t); });
// 新店種的商品（wear:xxx＝買到就擁有造型 xxx；card／petsnack／gift／decor 用法和原本一樣）
var V40_SHOP_ITEMS = [
  ['s_tee', '紅玉滿 T 恤（領結）', 'wear', '普通', 15, '小店:服飾店', '', 'wear:bowtie'],
  ['s_knit', '手織圍巾', 'wear', '普通', 20, '小店:服飾店', '', 'wear:scarf'],
  ['s_rain', '黃色雨衣', 'wear', '稀有', 55, '小店:服飾店', '', 'wear:raincoat'],
  ['s_chef', '主廚服', 'wear', '稀有', 65, '小店:服飾店', '', 'wear:chefsuit'],
  ['s_giftbag', '衣服禮盒', 'gift', '普通', 25, '小店:服飾店', '', 'gift:👕'],
  ['s_topatk', '攻擊型陀螺', 'card', '普通', 35, '小店:陀螺對戰店', '', 'card:power:55'],
  ['s_topdef', '防禦型陀螺', 'card', '普通', 35, '小店:陀螺對戰店', '', 'card:shield:40'],
  ['s_topsta', '持久型陀螺', 'card', '普通', 35, '小店:陀螺對戰店', '', 'card:heal:45'],
  ['s_topstorm', '旋風陀螺', 'card', '稀有', 80, '小店:陀螺對戰店', '', 'card:power:90'],
  ['s_jerky', '寵物肉乾', 'petsnack', '普通', 12, '小店:寵物用品店', '', 'petsnack:3'],
  ['s_petfeast', '寵物大餐', 'petsnack', '稀有', 30, '小店:寵物用品店', '', 'petsnack:8'],
  ['s_petbow', '寵物領結', 'wear', '普通', 22, '小店:寵物用品店', '', 'wear:pet_bow'],
  ['s_petwing', '寵物小翅膀', 'wear', '稀有', 65, '小店:寵物用品店', '', 'wear:pet_wings'],
  ['s_novel', '小說', 'gift', '普通', 15, '小店:書店', '', 'gift:📖'],
  ['s_comic', '漫畫', 'gift', '普通', 12, '小店:書店', '', 'gift:📚'],
  ['s_bookmark', '紀念書籤(收藏)', 'decor', '普通', 15, '小店:書店', '', 'decor:🔖'],
  ['s_polaroid', '拍立得', 'gift', '普通', 18, '小店:照相館', '', 'gift:📸'],
  ['s_photo', '合照(收藏)', 'decor', '普通', 20, '小店:照相館', '', 'decor:🖼️'],
  ['s_woodframe', '木質名牌框', 'wear', '稀有', 55, '小店:照相館', '', 'wear:frame_wood'],
  ['s_pot', '小盆栽(收藏)', 'decor', '普通', 15, '小店:家具行', '', 'decor:🪴'],
  ['s_minisofa', '迷你沙發(收藏)', 'decor', '稀有', 40, '小店:家具行', '', 'decor:🛋️'],
  ['s_candle', '香氛蠟燭', 'gift', '普通', 18, '小店:家具行', '', 'gift:🕯️'],
  ['s_shaveice', '剉冰', 'gift', '普通', 15, '小店:冰店', '', 'gift:🍧'],
  ['s_icecream', '冰淇淋', 'gift', '普通', 12, '小店:冰店', '', 'gift:🍦'],
  ['s_peticecream', '寵物冰淇淋', 'petsnack', '普通', 15, '小店:冰店', '', 'petsnack:4'],
  ['s_teddy', '泰迪熊(收藏)', 'decor', '普通', 25, '小店:玩具店', '', 'decor:🧸'],
  ['s_balloon', '氣球', 'gift', '普通', 10, '小店:玩具店', '', 'gift:🎈'],
  ['s_trikedoll', '三角龍玩偶(收藏)', 'decor', '稀有', 40, '小店:玩具店', '', 'decor:🦕']
];
if (typeof GM_CATALOG_SEED !== 'undefined') V40_SHOP_ITEMS.forEach(function (r) { if (!GM_CATALOG_SEED.some(function (x) { return x[0] === r[0]; })) GM_CATALOG_SEED.push(r); });
function v40_shopCost_() {
  var rent = Number(gm_param_('小店月租')), util = Number(gm_param_('小店水電'));
  if (!(rent >= 0)) rent = 30; if (!(util >= 0)) util = 10;
  return { rent: rent, util: util, month: rent + util };
}
function v40_dim_(d) { var y = +d.slice(0, 4), m = +d.slice(5, 7); return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
// 從 from（不含）到 to（含）每天的成本合計（跨月時各月依當月天數）
function v40_accrue_(from, to) {
  var c = v40_shopCost_().month, sum = 0, d = from;
  for (var i = 0; i < 400 && d < to; i++) { d = gm_addDays_(d, 1); sum += c / v40_dim_(d); }
  return sum;
}
function v40_rowToShop_(r, i) {
  var owner = String(r[0] || '').trim(); if (!owner) return null;
  return { row: i + 2, owner: owner, key: String(r[8] || '').trim() || owner, name: String(r[1]), type: String(r[2]), opened: String(r[3]), prices: pv_json_(r[4], {}),
    revenue: Number(r[5]) || 0, sales: Number(r[6]) || 0, notice: String(r[7] || ''), fund: Number(r[9]) || 0, settled: String(r[10] || '').slice(0, 10), status: String(r[11] || '營業中') };
}
function v40_shops_() { return pv_rows_('shops').map(v40_rowToShop_).filter(function (s) { return s && s.status !== '已結束'; }); }
function v40_writeShop_(s, fields) {
  var sh = pv_sh_('shops'), rng = sh.getRange(s.row, 9, 1, 4); rng.setNumberFormat('@');
  var v = [fields.key != null ? fields.key : s.key, String(Math.round((fields.fund != null ? fields.fund : s.fund) * 100) / 100), fields.settled || s.settled || gm_today_(), fields.status || s.status];
  rng.setValues([v]); GM_CACHE_.rows_pv_shops = null;
}
// 結算營運金到今天；不夠 → 暫停營業。回傳最新的 shop
function v40_settle_(s) {
  var t = gm_today_();
  if (!s.settled) { var f0 = s.fund || v40_shopCost_().month; v40_writeShop_(s, { settled: t, fund: f0 }); s.settled = t; s.fund = f0; return s; }   // v1.40 前開的舊店：送一個月營運金，從今天開始算
  if (s.settled >= t) return s;
  var cost = v40_accrue_(s.settled, t), fund = s.fund - cost, st = s.status;
  if (fund < 0) { fund = 0; st = '暫停營業'; }
  v40_writeShop_(s, { fund: fund, settled: t, status: st });
  s.fund = fund; s.settled = t; s.status = st; return s;
}
function sp_shop_(key) {   // key：店號（第 1 家就是員工編號，第 2 家是「員工編號-2」）
  key = String(key || '').trim();
  var all = v40_shops_(), s = all.filter(function (x) { return x.key === key; })[0] || all.filter(function (x) { return x.owner === key; })[0];
  return s ? v40_settle_(s) : null;
}
function v40_myShops_(emp) { return v40_shops_().filter(function (s) { return s.owner === emp; }).map(v40_settle_); }
function v40_vid_(p) { var v = typeof au_verifiedId_ === 'function' ? au_verifiedId_() : ''; return v || ''; }

function sp_list_(p) {
  var emps = gm_emps_(), me = v40_vid_(p) || String(p.empId || '').trim(), cost = v40_shopCost_();
  var shops = v40_shops_().map(v40_settle_).map(function (s) {
    var e = emps[s.owner];
    return { key: s.key, owner: s.owner, ownerName: e ? (e.nick || e.name) : s.owner, name: s.name, type: s.type, level: sp_level_(s.sales), sales: s.sales, notice: s.notice,
      items: sp_items_(s.type, s.prices), status: s.status, fund: s.owner === me ? Math.floor(s.fund) : undefined };
  });
  var off = String(gm_param_('正式版開始日') || '').trim(), testing = !off || gm_today_() < off;
  var max = Number(gm_param_('小店每人上限')) || 2, mine = shops.filter(function (s) { return s.owner === me; });
  var eligible = (testing || gm_hasBadge_(me, 'tenure_1', '')) && mine.length < max;
  var gifts = pv_rows_('gifts').filter(function (r) { return r[2] === me; }).slice(-10).reverse().map(function (r) {
    var f = emps[r[1]], c = gm_catalog_()[r[3]] || {}; return { time: String(r[0]), from: f ? (f.nick || f.name) : r[1], item: c.name, icon: String(c.note || '').split(':')[1] || '🎁', unread: !r[4] };
  });
  var people = Object.keys(emps).filter(function (k) { return !emps[k].resigned && k !== me; }).map(function (k) { return { id: k, name: emps[k].nick || emps[k].name }; });
  return { success: true, data: { people: people, shops: shops, mine: mine[0] || null, myShops: mine, maxShops: max, eligible: eligible, testing: testing,
    types: PV_SHOP_TYPES, fee: pv_param_('小店開店費'), share: pv_param_('小店店主分潤'), threshold: String(gm_param_('資歷門檻') || '1080').split(',')[0], gifts: gifts, balance: gm_balance_(me),
    cost: cost, proposals: v40_myProposals_(me) } };
}
function sp_open_(p) {
  var emp = v40_vid_(p); if (!emp) return { error: '請重新登入後再開店' };
  if (!gm_emp_(emp) || gm_isFrozen_(emp)) return { error: '帳號無法使用' };
  var off = String(gm_param_('正式版開始日') || '').trim(), testing = !off || gm_today_() < off;
  if (!testing && !gm_hasBadge_(emp, 'tenure_1', '')) return { error: '累計工時達 ' + String(gm_param_('資歷門檻')).split(',')[0] + ' 小時才能開店' };
  var mine = v40_myShops_(emp), max = Number(gm_param_('小店每人上限')) || 2;
  if (mine.length >= max) return { error: '一個人最多開 ' + max + ' 家' };
  var type = String(p.type || ''), name = String(p.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12);
  if (PV_SHOP_TYPES.indexOf(type) < 0) return { error: '店型不正確' };
  if (!name) return { error: '請幫小店取名字' };
  var fee = pv_param_('小店開店費'), cost = v40_shopCost_(), pre = Math.max(cost.month, Math.round(Number(p.prepay) || 0));
  if (gm_balance_(emp) < fee + pre) return { error: '赤心幣不足（開店費 ' + fee + ' ＋ 預付營運金 ' + pre + ' 枚）' };
  var used = {}; mine.forEach(function (s) { used[s.key] = 1; });
  var key = !used[emp] ? emp : emp + '-2'; if (used[key]) key = emp + '-' + (mine.length + 1);
  gm_credit_(emp, '開店費', -fee, '開了「' + name + '」' + (testing ? '（測試期免資歷門檻）' : ''), 'SHOPOPEN|' + key + '|' + gm_now_());
  gm_credit_(emp, '小店營運金', -pre, '「' + name + '」預付營運金', 'SHOPFUND|' + key + '|' + gm_now_());
  pv_append_('shops', [[emp, name, type, gm_now_(), '{}', 0, 0, '', key, String(pre), gm_today_(), '營業中']]);
  return { success: true, key: key };
}
function v40_ownShop_(p) {
  var emp = v40_vid_(p); if (!emp) throw new Error('請重新登入後再試');
  var s = sp_shop_(p.shop || p.key || emp); if (!s || s.owner !== emp) throw new Error('這不是你的店');
  return s;
}
function sp_update_(p) {
  var s; try { s = v40_ownShop_(p); } catch (e) { return { error: e.message }; }
  var name = p.name != null ? String(p.name).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12) || s.name : s.name;
  var notice = p.notice != null ? String(p.notice).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40) : s.notice;
  var prices = s.prices, want = p.prices != null ? pv_json_(p.prices, {}) : null;
  if (want) {
    var items = sp_items_(s.type, {}); prices = {};
    items.forEach(function (it) { var v = Math.round(Number(want[it.id]) || it.base); prices[it.id] = Math.min(it.max, Math.max(it.min, v)); });
  }
  var type = s.type;
  if (p.type && PV_SHOP_TYPES.indexOf(p.type) >= 0 && p.type !== s.type) { type = p.type; prices = {}; }
  var rng = pv_sh_('shops').getRange(s.row, 2, 1, 7); rng.setNumberFormat('@');
  rng.setValues([[name, type, s.opened, JSON.stringify(prices), s.revenue, s.sales, notice]]); GM_CACHE_.rows_pv_shops = null;
  return { success: true };
}
// 儲值營運金（暫停營業的店儲值後自動恢復）
function v40_shopTopup_(p) {
  var s; try { s = v40_ownShop_(p); } catch (e) { return { error: e.message }; }
  var amt = Math.round(Number(p.amount) || 0); if (amt < 1) return { error: '請填儲值金額' };
  if (gm_balance_(s.owner) < amt) return { error: '赤心幣不足' };
  gm_credit_(s.owner, '小店營運金', -amt, '「' + s.name + '」儲值營運金', 'SHOPFUND|' + s.key + '|' + gm_now_() + '|' + Math.random());
  v40_writeShop_(s, { fund: s.fund + amt, status: '營業中' });
  return { success: true, fund: Math.floor(s.fund + amt) };
}
// 結束營業：結算到今天（按天數比例收月租＋水電），剩下的營運金退回；開店費不退
function v40_shopClose_(p) {
  var s; try { s = v40_ownShop_(p); } catch (e) { return { error: e.message }; }
  var left = Math.floor(s.fund);
  if (left > 0) gm_credit_(s.owner, '小店營運金退回', left, '「' + s.name + '」結束營業，退回剩餘營運金', 'SHOPREFUND|' + s.key + '|' + gm_now_());
  v40_writeShop_(s, { fund: 0, status: '已結束' });
  var sh = pv_sh_('shops'); sh.getRange(s.row, 9).setValue(s.key + '@' + gm_today_());   // 店號加日期，之後可以用同一個店號再開
  GM_CACHE_.rows_pv_shops = null;
  try { v40_event_('shop', v40_nm_(s.owner) + ' 的「' + s.name + '」結束營業', ''); } catch (e) {}
  return { success: true, refund: left };
}
function sp_buy_(p) {   // 以 v1.31 版為底：通行證身分、同店每日上限、抽成明細；v1.40 多店、暫停營業、wear 類商品
  var buyer = String(p.empId || '').trim(), key = String(p.owner || p.shop || '').trim(), item = String(p.item || ''), to = String(p.to || '').trim();
  if (!gm_emp_(buyer) || gm_isFrozen_(buyer)) return { error: '帳號無法使用' };
  if (c31_notMe_(buyer)) return { error: '登入身分不符，請重新登入' };
  var s = sp_shop_(key); if (!s || gm_isFrozen_(s.owner)) return { error: '這家店目前沒有營業' };
  if (s.status === '暫停營業') return { error: '這家店營運金不足，暫停營業中' };
  var owner = s.owner;
  if (buyer === owner) return { error: '不能買自己店裡的東西' };
  var it = sp_items_(s.type, s.prices).filter(function (x) { return x.id === item; })[0]; if (!it) return { error: '這家店沒有賣這個' };
  var lim = c31_n_('小店同店每日購買上限', 3), today = gm_today_(), cnt = 0;
  pv_rows_('sales').forEach(function (r) { if (String(r[1]) === s.key && String(r[2]) === buyer && String(r[0]).slice(0, 10) === today) cnt++; });
  if (cnt >= lim) return { error: '今天在這家店已經買了 ' + lim + ' 件，明天再來吧' };
  if (gm_balance_(buyer) < it.price) return { error: '赤心幣不足' };
  var cat = gm_catalog_()[item], kind = cat.cat, wear = /^wear:/.test(cat.note) ? String(cat.note).slice(5) : '';
  if (kind === 'gift') { if (!gm_emp_(to) || gm_isFrozen_(to) || to === buyer) return { error: '請選擇要送給哪位隊員' }; }
  else if (wear) { if (gm_owned_(buyer)[wear]) return { error: '已經擁有了' }; }
  else if (['weapon', 'armor', 'card', 'decor'].indexOf(kind) >= 0 && gm_owned_(buyer)[item]) return { error: '已經擁有了' };
  if (kind === 'petsnack' && !gm_pet_(buyer)) return { error: '還沒有寵物' };
  var share = Math.floor(it.price * pv_param_('小店店主分潤') / 100), k = Date.now() + '|' + Math.random();
  gm_credit_(buyer, '小店消費', -it.price, '在「' + s.name + '」買了' + it.name, 'SPBUY|' + buyer + '|' + k);
  if (share) gm_credit_(owner, '小店營收', share, (gm_emp_(buyer).nick || gm_emp_(buyer).name) + ' 在「' + s.name + '」買了' + it.name + '（售價 ' + it.price + '，扣' + c31_feeSplit_(it.price - share) + '）', 'SPINC|' + owner + '|' + k);
  if (kind === 'gift') pv_append_('gifts', [[gm_now_(), buyer, to, item, '']]);
  else if (kind === 'petsnack') {
    var pet = gm_pet_(buyer), add = Number(String(cat.note).split(':')[1]) || 0;
    var prow = gm_rows_('pets')[pet.row - 2];
    var rng = gm_sh_('pets').getRange(pet.row, 6, 1, 2); rng.setNumberFormat('@');
    rng.setValues([[String((Number(prow[5]) || 0) + add), String((Number(prow[6]) || 0) + 1)]]); GM_CACHE_.rows_pets = null;
  } else gm_append_('owned', [[buyer, wear || item, '小店', gm_now_()]]);
  pv_append_('sales', [[gm_now_(), s.key, buyer, item, it.price, share, to]]);
  var rr = pv_sh_('shops').getRange(s.row, 6, 1, 2); rr.setNumberFormat('@'); rr.setValues([[String(s.revenue + share), String(s.sales + 1)]]); GM_CACHE_.rows_pv_shops = null;
  return { success: true, data: { balance: gm_balance_(buyer) } };
}
function sp_scene_() {   // 宇宙辦公室「商店街」（暫停營業的店也顯示，前端可以標示）
  var emps = gm_emps_();
  return v40_shops_().map(function (s) { var e = emps[s.owner]; return { key: s.key, owner: s.owner, ownerName: e ? (e.nick || e.name) : '', name: s.name, type: s.type, level: sp_level_(s.sales), status: s.status }; });
}
function c31_shopRent_(runDate) { /* v1.40：月租改由營運金每天扣（v40_settle_），這裡不再從上月營收扣，避免重複收 */ }

// ── 店種提案：隊員說想開什麼店、想賣什麼，管理者規劃後上架 ──
var V40_PROP_HEAD = ['編號', '時間', '員工編號', '店種名稱', '想賣什麼', '狀態', '回覆', '處理人', '處理時間'];
function v40_myProposals_(emp) {
  try {
    return v40_rows_('小店提案', V40_PROP_HEAD).filter(function (r) { return String(r[2]) === emp; }).slice(-5).reverse()
      .map(function (r) { return { id: String(r[0]), name: String(r[3]), idea: String(r[4]), status: String(r[5] || '待規劃'), reply: String(r[6] || '') }; });
  } catch (e) { return []; }
}
function v40_propose_(p) {
  var me = v39_me_();
  var name = String(p.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12), idea = String(p.idea || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 200);
  if (!name || !idea) return { error: '請填店種名稱和想賣什麼' };
  var open = v40_rows_('小店提案', V40_PROP_HEAD).filter(function (r) { return String(r[2]) === me.id && /待規劃|規劃中/.test(String(r[5] || '待規劃')); }).length;
  if (open >= 3) return { error: '同時最多 3 個提案在等規劃' };
  var id = 'SP' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss');
  v40_s_('小店提案', V40_PROP_HEAD).appendRow([id, v39_now_(), me.id, name, idea, '待規劃', '', '', '']);
  try { if (typeof line_notify_ === 'function') line_notify_('公告', '💡 隊員商店街新店提案｜' + v40_nm_(me.id) + '\n店種：' + name + '\n想賣：' + idea); } catch (e) {}
  return { success: true };
}
function v40_proposals_(p) {
  var me = v39_me_(); if (me.role < 3) return { success: true, data: v40_myProposals_(me.id) };
  return { success: true, data: v40_rows_('小店提案', V40_PROP_HEAD).slice(-50).reverse().map(function (r) {
    return { id: String(r[0]), time: String(r[1]).slice(0, 16), emp: String(r[2]), who: v40_nm_(r[2]), name: String(r[3]), idea: String(r[4]), status: String(r[5] || '待規劃'), reply: String(r[6] || '') };
  }) };
}
function v40_proposalSet_(p) {
  var me = v39_me_(); if (me.role < 3) return { error: '需要 Lv.3 以上' };
  var st = String(p.status || ''); if (['待規劃', '規劃中', '已上架', '婉拒'].indexOf(st) < 0) return { error: '狀態不正確' };
  var rows = v40_rows_('小店提案', V40_PROP_HEAD), sh = v40_s_('小店提案', V40_PROP_HEAD);
  for (var i = 0; i < rows.length; i++) if (String(rows[i][0]) === String(p.id)) {
    sh.getRange(i + 2, 6, 1, 4).setValues([[st, String(p.reply || '').slice(0, 200), me.name, v39_now_()]]);
    v40_note_(String(rows[i][2]), 'shop', '💡 你的店種提案「' + rows[i][3] + '」：' + st + (p.reply ? '｜' + String(p.reply).slice(0, 40) : ''), 'pair', String(p.id) + st);
    return { success: true };
  }
  return { error: '找不到這個提案' };
}
function v40_shopSetup_(log) {
  var sh = pv_sh_('shops'), h = sh.getRange(1, 1, 1, 12).getValues()[0];
  if (String(h[8]) !== '店號') { sh.getRange(1, 9, 1, 4).setValues([['店號', '營運金', '結算日', '狀態']]); log.push('〈小店〉加欄位：店號、營運金、結算日、狀態'); }
  v40_s_('小店提案', V40_PROP_HEAD);
  var cat = gm_catalog_(), add = V40_SHOP_ITEMS.filter(function (r) { return !cat[r[0]]; });
  if (add.length && gm_rows_('catalog').length) { gm_append_('catalog', add); log.push('〈商品目錄〉新增 ' + add.length + ' 項新店種商品'); }
  GM_CACHE_.catalog = null;
  var have = {}; gm_rows_('params').forEach(function (r) { have[String(r[0]).trim()] = 1; });
  var pa = [['小店水電', 10, 'v1.40：每家小店每月水電（和小店月租一起，從營運金每天按比例扣）'], ['小店每人上限', 2, 'v1.40：一個人最多開幾家小店']]
    .filter(function (x) { return !have[x[0]]; });
  if (!have['小店月租']) pa.push(['小店月租', 30, 'v1.40：每家小店每月租金（從營運金每天按比例扣）']);
  if (pa.length) { gm_append_('params', pa); log.push('遊戲參數新增 ' + pa.map(function (x) { return x[0]; }).join('、')); }
}

// ═════════════════════════════════════════════════════════════
// v1.40 部署端修正（11/14 16:40）：花幣動作一律要有效通行證
// 漏洞：c31_notMe_（v1.31）只在「有通行證」時檢查本人，沒有通行證就放行用 p.empId。
//   記錄模式下，可冒用別人編號在自己的小店（sp_buy_，店主拿 80%）或寵物市集（p28_buyMkt_）消費，把對方的赤心幣轉給自己。
// 修正：沒有有效通行證也算「不是本人」→ 擋下。影響 sp_buy_、p28_list_、p28_buyMkt_（都用 c31_notMe_）。
// ═════════════════════════════════════════════════════════════
function c31_notMe_(emp) {
  var v = typeof au_verifiedId_ === 'function' ? au_verifiedId_() : '';
  return !v || v !== String(emp || '').trim();
}

// ═══════════════════════════════════════════════
// 路由 extHandler_ v1.40（2026-11-14）
// 放在檔案最後，取代路由 v1.39（Apps Script 以檔案中最後一個同名函式為準）。
// 與 v1.39 路由的差別：v39Handler_ 之前加 v40Handler_（視察、提醒、坐騎、請喝咖啡；
//   接手 gmScene → v39 → h36 → s30，接手 v39Rev → v39，接手 v39Goto）。
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
  var v40 = v40Handler_(action, p); if (v40) return v40;
  var v39 = v39Handler_(action, p); if (v39) return v39;
  var h36 = h36Handler_(action, p); if (h36) return h36;
  var eq = eqHandler_(action, p); if (eq) return eq;
  var qt = qtHandler_(action, p); if (qt) return qt;
  var s30 = s30Handler_(action, p); if (s30) return s30;
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

// ═══════════════════════════════════════════════
// 紅玉滿夥伴 App 後端模組 v1.41（2026-11-14）
// 貼在第 42 版全文最下面（部署端修正 c31_notMe_ 之後），檔案最後的「路由 v1.41」取代路由 v1.40。
// 內容：
//   1. 宇宙大樓：大廳、飯堂、遊戲室、運動室可以「前往」（接手 v40Goto／v39Goto）
//   2. 開會 v41Meet：Lv.4 以上召開，Lv.2 以上主管到會議桌 5 分鐘（只是動畫，不影響打卡）
//   3. 運動 v41Act：自己去運動室動 3 分鐘，不限次數
//   4. gmScene 加 meeting、acts（經過 v40Handler_，原本的資料都保留）
//   5. 12/1 正式版：正式版開始日之前取得的坐騎不算（覆蓋 v40_mountRows_）
//   6. 角色解鎖：企鵝＝點亮 4 心、小暴龍＝無敵 8 心、機器人＝傳說 8 心（覆蓋 av_save_、av_getAll_）
//   7. 機器人寵物：GM_PET_TYPES 加 robot、科技型、新的相剋循環（覆蓋 pv_fighter_）
//   8. 用語：回給畫面的錯誤訊息、系統 LINE 通知裡的「夥伴」→「隊員」（合作夥伴、加盟店夥伴、好夥伴、夥伴系統、夥伴 App 不改）
// 安全：所有寫入都用 au_verifiedId_()（經 v39_me_），沒有通行證就擋。
// ═══════════════════════════════════════════════

var V41_ROOMS = ['大廳', '飯堂', '遊戲室', '運動室', '辦公區'];
var V41_ACTS = { run: '跑步機', punch: '打大魔王沙包', yoga: '瑜伽', lift: '舉啞鈴', stretch: '伸展' };
var V41_MEET_MIN = 5, V41_ACT_MIN = 3;

function v41_isLv4_(me) { return me && (me.role >= 4 || me.pos === '大隊長'); }
function v41_json_(k) { try { return JSON.parse(gm_getState_(k) || '{}') || {}; } catch (e) { return {}; } }

// ───────── 1. 前往：大樓房間（大廳、飯堂、遊戲室、運動室、辦公區）─────────
function v41_goto_(p) {
  var loc = String(p.loc || '').trim();
  if (V41_ROOMS.indexOf(loc) < 0) return v40_goto_(p);
  var me = v39_me_(); if (!v40_isMgr_(me)) return { error: 'Lv.3 以上才能視察' };
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  var rec = { loc: loc, date: v40_today_(), time: v40_hm_() };
  try {
    var m = v40_visits_(); m[me.id] = rec;
    gm_setState_('宇宙前往', JSON.stringify(m));
    if (v40_isBossId_(me.id)) gm_setState_('大隊長前往', '');
  } finally { lock.releaseLock(); }
  return { success: true, data: rec };
}

// ───────── 2. 開會 ─────────
// Script Properties「gm_宇宙會議」：{ by, byName, start, end（毫秒）, ids:[參加的主管] }
function v41_meeting_() {
  var m = v41_json_('宇宙會議');
  return m && m.end && +m.end > Date.now() ? m : null;
}
function v41_meet_(p) {
  var me = v39_me_(); if (!v41_isLv4_(me)) return { error: 'Lv.4 以上才能召開會議' };
  var now = Date.now(), cur = v41_meeting_();
  if (cur) return { success: true, data: cur, note: '會議進行中' };
  var ids = ops_staff_().list.filter(function (x) { return !x.left && (!x.type || x.type === '員工') && (x.role >= 2 || x.pos === '大隊長'); }).map(function (x) { return x.id; });
  if (ids.indexOf(me.id) < 0) ids.push(me.id);
  var who = v40_isBossId_(me.id) ? '大隊長' : v40_nm_(me.id);
  var m = { by: me.id, byName: who, start: now, end: now + V41_MEET_MIN * 60000, ids: ids };
  gm_setState_('宇宙會議', JSON.stringify(m));
  ids.forEach(function (e) { if (e !== me.id) v41_noteAny_(e, 'visit', '📋 ' + who + ' 召開會議，請到辦公區會議桌'); });
  v40_event_('meet', '📋 ' + who + ' 召開會議（5 分鐘）', '辦公區');
  return { success: true, data: m };
}
// 提醒（不限每天一次：同一分鐘內不重複）
function v41_noteAny_(to, type, text) {
  var key = type + '|' + to + '|' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm');
  v40_s_('宇宙通知', V40_NOTE_HEAD).appendRow([v39_now_(), v40_today_(), String(to), type, String(text).slice(0, 120), '', key]);
}

// ───────── 3. 運動（不限次數，每次 3 分鐘）─────────
// Script Properties「gm_宇宙運動」：{ 員工編號: { act, until（毫秒）} }
function v41_acts_() {
  var m = v41_json_('宇宙運動'), now = Date.now(), out = {};
  Object.keys(m).forEach(function (k) { if (m[k] && +m[k].until > now) out[k] = m[k]; });
  return out;
}
function v41_act_(p) {
  var me = v39_me_(), act = String(p.act || '');
  if (!V41_ACTS[act]) return { error: '沒有這個運動' };
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var m = v41_acts_(); m[me.id] = { act: act, until: Date.now() + V41_ACT_MIN * 60000 };
    gm_setState_('宇宙運動', JSON.stringify(m));
    return { success: true, data: m[me.id] };
  } finally { lock.releaseLock(); }
}

// ───────── 5. 12/1 正式版：坐騎從零開始 ─────────
// 覆蓋 v1.40 v40_mountRows_：今天已到正式版開始日時，只算開始日（含）之後取得的坐騎
function v40_mountRows_() {
  var rows = v40_rows_('坐騎', V40_MOUNT_HEAD), st = String(gm_param_('正式版開始日') || '2026-12-01').slice(0, 10);
  if (v40_today_() < st) return rows;
  return rows.filter(function (r) { return v39_d_(r[3]) >= st; });
}

// ───────── 6. 角色解鎖 ─────────
if (typeof AV_ALLOWED !== 'undefined' && AV_ALLOWED.mascot.indexOf('robot') < 0) AV_ALLOWED.mascot.push('robot');
var V41_MASCOT_NEED = { penguin: 4, trex: 8, robot: 'legend' };
function v41_heartOf_(id) { try { return h36_levels_()[id] || { n: 0, g: 0 }; } catch (e) { return { n: 0, g: 0 }; } }
function v41_mascotOK_(m, h) { var need = V41_MASCOT_NEED[m]; if (!need) return true; return need === 'legend' ? (h.g || 0) >= 8 : (h.n || 0) >= need; }
function v41_formal_() { return gm_today_() >= String(gm_param_('正式版開始日') || '2026-12-01').slice(0, 10); }
function v41_savedCfg_(empId) {
  var v = av_sheet_('角色造型', ['員工編號', '造型設定', '更新時間']).getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (String(v[i][0]).trim() === empId) return av_clean_(v[i][1]);
  return null;
}
// 覆蓋 av_save_：一律以通行證本人存檔（原本用 p.empId）＋角色解鎖檢查
function av_save_(p) {
  var empId = au_verifiedId_(); if (!empId) return { error: '請重新登入後再試' };
  if (!av_empExists_(empId)) return { error: '找不到此帳號' };
  var c = av_clean_(p.cfg);
  if (AV_LIMITED_ITEMS.indexOf(c.hat) >= 0 && (av_grantedMap_()[empId] || []).indexOf(c.hat) < 0) return { error: '這個造型尚未解鎖' };
  if (c.mascot && !v41_mascotOK_(c.mascot, v41_heartOf_(empId))) {
    var old = v41_savedCfg_(empId);
    if (!(old && old.mascot === c.mascot && !v41_formal_())) return { error: '這個角色還沒解鎖（企鵝：點亮 4 心；小暴龍：無敵 8 心；機器人：傳說 8 心）' };
  }
  var un = av_unowned_(empId, c);
  if (un) return { error: '還沒擁有「' + ((gm_catalog_()[un] || {}).name || un) + '」' };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = av_sheet_('角色造型', ['員工編號', '造型設定', '更新時間']), v = sh.getDataRange().getValues(), now = new Date();
    for (var r = 1; r < v.length; r++) if (String(v[r][0]).trim() === empId) {
      sh.getRange(r + 1, 2, 1, 2).setValues([[JSON.stringify(c), now]]);
      CacheService.getScriptCache().remove('av_all'); return { success: true };
    }
    var row = sh.getLastRow() + 1;
    sh.getRange(row, 1).setNumberFormat('@').setValue(empId);
    sh.getRange(row, 2, 1, 2).setValues([[JSON.stringify(c), now]]);
    CacheService.getScriptCache().remove('av_all'); return { success: true };
  } finally { lock.releaseLock(); }
}
// 覆蓋 av_getAll_：正式版開始後，還沒解鎖的角色自動換回隊員本人
function av_getAll_() {
  var cache = CacheService.getScriptCache(), hit = cache.get('av_all');
  if (hit) return { success: true, data: JSON.parse(hit) };
  var v = av_sheet_('角色造型', ['員工編號', '造型設定', '更新時間']).getDataRange().getValues(), g = av_grantedMap_(), out = {};
  var ownAll = null, formal = v41_formal_(), hearts = formal ? (function () { try { return h36_levels_(); } catch (e) { return {}; } })() : {};
  if (typeof gm_rows_ === 'function') { GM_CACHE_ = {}; ownAll = {}; gm_rows_('owned').forEach(function (r) { (ownAll[r[0]] = ownAll[r[0]] || {})[r[1]] = 1; }); }
  for (var i = 1; i < v.length; i++) {
    var id = String(v[i][0]).trim(); if (!id) continue;
    var c = av_clean_(v[i][1]);
    if (AV_LIMITED_ITEMS.indexOf(c.hat) >= 0 && (g[id] || []).indexOf(c.hat) < 0) c.hat = 'none';
    if (ownAll) c = av_stripUnowned_(id, c, ownAll[id] || {});
    if (formal && c.mascot && !v41_mascotOK_(c.mascot, hearts[id] || { n: 0, g: 0 })) c.mascot = 'none';
    out[id] = c;
  }
  var s = JSON.stringify(out); if (s.length < 90000) cache.put('av_all', s, 60);
  return { success: true, data: out };
}

// ───────── 7. 機器人寵物 ─────────
if (GM_PET_TYPES.every(function (t) { return t[0] !== 'robot'; })) GM_PET_TYPES.push(['robot', '機器人']);
PV_PET_ATTR.robot = { stat: 'all', val: 1, label: '科技型' };
// 相剋循環（隊長 11/14 同意）：暴龍 → 三角龍 → 挖土機 → 火車 → 雞 → 機器人，每種剋後面兩種
PV_COUNTER = { trex: ['trice', 'digger'], trice: ['digger', 'train'], digger: ['train', 'chicken'], train: ['chicken', 'robot'], chicken: ['robot', 'trex'], robot: ['trex', 'trice'] };
// 覆蓋 pv_fighter_（以 v1.30 強化版為底）：機器人「科技型」攻擊、防禦、速度、體力各 +1
function pv_fighter_(emp) {
  var e = gm_emp_(emp); if (!e) return null;
  var q = pv_equipRow_(emp), own = gm_owned_(emp), st = { hp: PV_BASE.hp, atk: PV_BASE.atk, def: PV_BASE.def, spd: PV_BASE.spd }, enh = s30_enhMap_(emp), cat = gm_catalog_();
  [q.weapon, q.armor].forEach(function (id) {
    if (!id || !own[id]) return;
    var s = pv_stats_(id); Object.keys(s).forEach(function (k) { if (st[k] != null) st[k] += s[k]; });
    var b = s30_enhBonus_(cat[id] ? cat[id].cat : '', enh[id] || 0); Object.keys(b).forEach(function (k) { if (st[k] != null) st[k] += b[k]; });
  });
  var pet = gm_pet_(emp); if (pet) st.hp += pet.stage * 4;
  st.crit = 0;
  if (pet && pet.type && PV_PET_ATTR[pet.type]) {
    var at = PV_PET_ATTR[pet.type], pct = [0, 0, 0.25, 0.5, 0.75, 1][pet.stage] || 0;
    if (at.stat === 'all') ['atk', 'def', 'spd', 'hp'].forEach(function (k) { st[k] += Math.round(at.val * pct); });
    else st[at.stat] += at.stat === 'crit' ? at.val * pct : Math.round(at.val * pct);
  }
  var cards = q.cards.filter(function (c) { return own[c]; }).slice(0, 3).map(function (c) { var s = pv_stats_(c); return { id: c, name: cat[c].name, kind: s.card, val: s.val }; });
  var nm = function (id) { return id && own[id] ? cat[id].name + (enh[id] ? ' +' + enh[id] : '') : ''; };
  return { id: emp, name: e.nick || e.name, stats: st, weapon: nm(q.weapon), armor: nm(q.armor), cards: cards, join: q.join, pet: pet ? pet.stage : 0,
           petType: pet && pet.type ? pet.type : '', petTypeName: pet && pet.type ? pet.typeName : '' };
}

// ───────── 8. 用語：夥伴 → 隊員（只改回給畫面的訊息與系統 LINE 通知）─────────
function v41_word_(t) {
  return String(t).replace(/(合作|加盟店|好)?夥伴(系統| ?App)?/g, function (m, pre, suf) { return pre || suf ? m : '隊員'; });
}
function v41_wordRes_(r) {
  if (!r || typeof r !== 'object') return r;
  ['error', 'message', 'msg', 'note'].forEach(function (k) { if (typeof r[k] === 'string' && r[k].indexOf('夥伴') >= 0) r[k] = v41_word_(r[k]); });
  return r;
}
// 覆蓋 line_notify_：系統自動推播（叫貨、報修…）的「夥伴」改「隊員」；隊長自己發的公告不改
function line_notify_(use, text) {
  if (!line_prop_('LINE_TOKEN')) return null;
  var ids = line_groups_().filter(function (g) { return g.status !== '已離開' && g.use.indexOf(use) >= 0; }).map(function (g) { return g.id; });
  return ids.length ? line_push_(ids, v41_word_(text)) : null;
}

// ───────── setup（可不執行：沒有新分頁；只是確認參數）─────────
function v41_setup() {
  var log = ['v1.41 沒有新分頁。開會、運動狀態存在 Script Properties（gm_宇宙會議、gm_宇宙運動）。'];
  log.push('正式版開始日：' + (gm_param_('正式版開始日') || '（未設定，預設 2026-12-01）'));
  Logger.log(log.join('\n')); return log.join('\n');
}

// ───────── 動作 ─────────
function v41Handler_(action, p) {
  p = p || {};
  if (action === 'gmScene') {
    var r = v40Handler_('gmScene', p); if (!r || !r.data) return r;
    try { r.data.meeting = v41_meeting_(); } catch (e) { r.data.meeting = null; }
    try { r.data.acts = v41_acts_(); } catch (e) { r.data.acts = {}; }
    return r;
  }
  var map = { v41Meet: v41_meet_, v41Act: v41_act_, v40Goto: v41_goto_, v39Goto: v41_goto_ };
  if (!map[action]) return null;
  try { OPS_C_ = {}; GM_CACHE_ = {}; return map[action](p); }
  catch (e) { return { error: e.message }; }
}

// ═══════════════════════════════════════════════
// 路由 extHandler_ v1.41（2026-11-14）
// 放在檔案最後，取代路由 v1.40（Apps Script 以檔案中最後一個同名函式為準）。
// 與 v1.40 路由的差別：
//   1. v40Handler_ 之前加 v41Handler_（開會、運動、大樓房間前往；接手 gmScene → v40 → v39 → h36 → s30）
//   2. 回給畫面的錯誤訊息「夥伴」→「隊員」（v41_wordRes_，只改 error／message 文字，不動資料）
// ═══════════════════════════════════════════════
function extHandler_(action, p) { return v41_wordRes_(v41Route_(action, p)); }
function v41Route_(action, p) {
  p = p || {};
  var gate = au_gate_(action, p); if (gate) return gate;
  var au = auHandler_(action, p); if (au) return au;
  var sec = secHandler_(action, p); if (sec) return sec;
  var op = opsHandler_(action, p); if (op) return op;
  var bu = buHandler_(action, p); if (bu) return bu;
  var rp = rpHandler_(action, p); if (rp) return rp;
  var fs = fsHandler_(action, p); if (fs) return fs;
  var v41 = v41Handler_(action, p); if (v41) return v41;
  var v40 = v40Handler_(action, p); if (v40) return v40;
  var v39 = v39Handler_(action, p); if (v39) return v39;
  var h36 = h36Handler_(action, p); if (h36) return h36;
  var eq = eqHandler_(action, p); if (eq) return eq;
  var qt = qtHandler_(action, p); if (qt) return qt;
  var s30 = s30Handler_(action, p); if (s30) return s30;
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

// ═══════════════════════════════════════════════
// 紅玉滿夥伴 App 後端模組 v1.42（2026-11-14）
// 貼在第 43 版全文最下面（v1.41 模組之後），檔案最後的「路由 v1.42」取代路由 v1.41。
// 內容：
//   1. 福利補助申請（另外報帳，不併入薪資）：比賽報名費、比賽滿 3 場購物金、其他運動、證照報名費、證照學費、體檢費
//   2. 比賽公告（運動室公告欄）
//   3. 夾娃娃機（1 枚、不好夾、保底）
//   4. 感謝牆、意見箱（可匿名，只有大隊長看得到）
//   5. gmScene 加 bfWall（運動室完賽榮譽牆、學習室證照榮譽牆）、thanks（感謝牆）、lobby（新人歡迎、到職週年）
// 安全：所有動作都用 au_verifiedId_()（經 v39_me_），沒有通行證就擋；金額、文字都有上限。
// 執行一次 v42_setup()：建立〈福利補助〉〈比賽公告〉〈感謝牆〉〈意見箱〉分頁、〈遊戲參數〉補參數。
// ═══════════════════════════════════════════════

var V42_BF_HEAD = ['編號', '申請時間', '員工編號', '姓名', '類別', '名稱', '日期', '申請金額', '補助金額', '收據照片', '證明照片', '備註', '狀態', '核准者', '核准時間', '報帳時間', '退回原因', '年度'];
var V42_EV_HEAD = ['編號', '建立時間', '建立者', '名稱', '日期', '地點', '連結', '狀態'];
var V42_TH_HEAD = ['時間', '日期', '寄件人', '收件人', '內容'];
var V42_IDEA_HEAD = ['時間', '員工編號', '姓名', '匿名', '內容', '回覆', '回覆時間'];
// 類別：key → [名稱, 規則說明]
var V42_BF_CATS = {
  race:     ['運動比賽報名費', '完賽才補，報名費全額'],
  shop3:    ['比賽滿 3 場購物金', '累積完賽 3 場可申請 3,000 元，隊長核准'],
  sport:    ['其他運動（瑜伽、有氧、健身房）', '每年 1,000 元，年中到職按比例'],
  certfee:  ['證照考照報名費', '全額'],
  tuition:  ['證照上課學費', '考取後補 50%，每年 2 個課程'],
  checkup:  ['體檢費', '全額']
};

if (V41_ROOMS.indexOf('學習室') < 0) V41_ROOMS.push('學習室');   // v1.42 學習室可以前往
function v42_s_(name, head) { return v39_sheet_(name, head); }
function v42_rows_(name, head) { var sh = v42_s_(name, head), n = sh.getLastRow(); return n < 2 ? [] : sh.getRange(2, 1, n - 1, head.length).getValues(); }
function v42_n_(k, d) { var v = Number(gm_param_(k)); return String(gm_param_(k) || '') !== '' && isFinite(v) ? v : d; }
function v42_year_() { return v40_today_().slice(0, 4); }
function v42_isLv4_(me) { return me && (me.role >= 4 || me.pos === '大隊長'); }
function v42_isBoss_(me) { return me && (me.role >= 5 || me.pos === '大隊長'); }
function v42_txt_(v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); }
function v42_url_(v) { v = String(v || '').trim(); return /^https:\/\/[^\s<>"]{5,400}$/.test(v) ? v : ''; }
function v42_hm_(t) { return t instanceof Date ? Utilities.formatDate(t, 'Asia/Taipei', 'yyyy-MM-dd HH:mm') : String(t || '').slice(0, 16); }
// 到職日（民國年或西元、Date 都可）→ 'yyyy-MM-dd'
function v42_hire_(id) {
  var s = (ops_staff_().map || {})[id]; if (!s) return '';
  var c = OPS_C_.staffCols || ops_cols_([]), v = s.raw[c.hire];
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Taipei', 'yyyy-MM-dd');
  var p = String(v || '').trim().split(/[\/\-.年月日]/).filter(function (x) { return x !== ''; });
  if (p.length < 3) return '';
  var y = Number(p[0]); if (y < 1911) y += 1911;
  return y + '-' + ('0' + Number(p[1])).slice(-2) + '-' + ('0' + Number(p[2])).slice(-2);
}

// ───────── 1. 福利補助 ─────────
function v42_bfAll_() {
  return v42_rows_('福利補助', V42_BF_HEAD).map(function (r, i) {
    return { row: i + 2, id: String(r[0]), time: v42_hm_(r[1]), emp: String(r[2]), name: String(r[3]), cat: String(r[4]), title: String(r[5]), date: v39_d_(r[6]),
             amount: Number(r[7]) || 0, sub: Number(r[8]) || 0, receipt: String(r[9] || ''), proof: String(r[10] || ''), note: String(r[11] || ''),
             status: String(r[12] || ''), by: String(r[13] || ''), at: v42_hm_(r[14]), paidAt: v42_hm_(r[15]), reason: String(r[16] || ''), year: String(r[17] || '') };
  });
}
function v42_live_(x) { return x.status !== '退回' && x.status !== '取消'; }
// 每個人的額度：其他運動今年剩多少、學費今年還能申請幾個、完賽場數與可申請購物金次數
function v42_quota_(emp, all) {
  all = all || v42_bfAll_();
  var y = v42_year_(), mine = all.filter(function (x) { return x.emp === emp && v42_live_(x); });
  var full = v42_n_('其他運動每年補助', 1000), hire = v42_hire_(emp), months = 12;
  if (hire && hire.slice(0, 4) === y) months = 12 - Number(hire.slice(5, 7)) + 1;   // 到職當月起算
  var sportCap = Math.floor(full * months / 12);
  var sportUsed = mine.filter(function (x) { return x.cat === 'sport' && x.year === y; }).reduce(function (a, x) { return a + x.sub; }, 0);
  var tuitionMax = v42_n_('證照學費每年課程數', 2);
  var tuitionUsed = mine.filter(function (x) { return x.cat === 'tuition' && x.year === y; }).length;
  var races = mine.filter(function (x) { return x.cat === 'race' && x.status !== '待核准'; }).length;   // 核准後才算完賽
  var shops = mine.filter(function (x) { return x.cat === 'shop3'; }).length;
  var per = v42_n_('比賽購物金場數', 3);
  return { year: y, sportCap: sportCap, sportLeft: Math.max(0, sportCap - sportUsed), hire: hire,
           tuitionMax: tuitionMax, tuitionLeft: Math.max(0, tuitionMax - tuitionUsed),
           races: races, per: per, shopAmount: v42_n_('比賽購物金金額', 3000), shopCan: Math.max(0, Math.floor(races / per) - shops) };
}
function v42_bfMe_(p) {
  var me = v39_me_(), all = v42_bfAll_();
  return { success: true, data: {
    cats: Object.keys(V42_BF_CATS).map(function (k) { return { key: k, name: V42_BF_CATS[k][0], rule: V42_BF_CATS[k][1] }; }),
    quota: v42_quota_(me.id, all),
    list: all.filter(function (x) { return x.emp === me.id; }).reverse().slice(0, 50).map(function (x) { delete x.row; return x; }),
    events: v42_events_(), canApprove: v42_isLv4_(me), isBoss: v42_isBoss_(me)
  } };
}
function v42_bfApply_(p) {
  var me = v39_me_(), cat = String(p.cat || '');
  if (!V42_BF_CATS[cat]) return { error: '沒有這個補助類別' };
  var title = v42_txt_(p.title, 40), date = String(p.date || '').slice(0, 10), amount = Math.round(Number(p.amount) || 0);
  var receipt = v42_url_(p.receipt), proof = v42_url_(p.proof), note = v42_txt_(p.note, 100);
  if (cat === 'shop3') { amount = v42_n_('比賽購物金金額', 3000); title = title || '比賽滿 3 場購物金'; }
  else {
    if (!title) return { error: '請填名稱（比賽、課程或證照名稱）' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: '請選日期' };
    if (!(amount >= 1 && amount <= 100000)) return { error: '金額要在 1～100,000 元之間' };
    if (!receipt) return { error: '請上傳收據或繳費證明' };
    if ((cat === 'race' || cat === 'tuition') && !proof) return { error: cat === 'race' ? '請上傳完賽照或獎牌照（完賽才補助）' : '請上傳證照（考取後才補助學費）' };
  }
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var all = v42_bfAll_(), q = v42_quota_(me.id, all), sub = amount;
    if (cat === 'sport') { if (q.sportLeft <= 0) return { error: '今年的運動補助額度已經用完了' }; sub = Math.min(amount, q.sportLeft); }
    if (cat === 'tuition') { if (q.tuitionLeft <= 0) return { error: '今年的學費補助已經申請 ' + q.tuitionMax + ' 個課程了' }; sub = Math.round(amount * v42_n_('證照學費補助比例', 0.5)); }
    if (cat === 'shop3' && q.shopCan <= 0) return { error: '累積完賽 ' + q.per + ' 場（核准後）才能申請' };
    if (all.some(function (x) { return x.emp === me.id && x.status === '待核准' && x.cat === cat && x.title === title && x.date === date; })) return { error: '這筆已經送出了，等主管核准' };
    var id = 'BF' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss') + String(Math.floor(Math.random() * 90 + 10));
    v42_s_('福利補助', V42_BF_HEAD).appendRow([id, v39_now_(), me.id, v40_nm_(me.id), cat, title, date, amount, sub, receipt, proof, note, '待核准', '', '', '', '', v42_year_()]);
    try { line_notify_('公告', '🎁 福利補助申請：' + v40_nm_(me.id) + '｜' + V42_BF_CATS[cat][0] + '｜' + title + '｜補助 $' + sub); } catch (e) {}
    return { success: true, data: { id: id, sub: sub } };
  } finally { lock.releaseLock(); }
}
function v42_bfCancel_(p) {
  var me = v39_me_(), x = v42_bfAll_().filter(function (y) { return y.id === String(p.id || ''); })[0];
  if (!x || x.emp !== me.id) return { error: '找不到這筆申請' };
  if (x.status !== '待核准') return { error: '已經處理過，不能取消' };
  v42_s_('福利補助', V42_BF_HEAD).getRange(x.row, 13).setValue('取消');
  return { success: true };
}
// Lv.4 以上：全部申請；status 篩選
function v42_bfList_(p) {
  var me = v39_me_(); if (!v42_isLv4_(me)) return { error: 'Lv.4 以上才能看' };
  var st = String(p.status || ''), all = v42_bfAll_();
  var list = all.filter(function (x) { return !st || x.status === st; }).reverse().slice(0, 200).map(function (x) { var o = JSON.parse(JSON.stringify(x)); delete o.row; o.quota = null; return o; });
  var sum = {}; all.forEach(function (x) { sum[x.status] = (sum[x.status] || 0) + 1; });
  var unpaid = all.filter(function (x) { return x.status === '待報帳'; }).reduce(function (a, x) { return a + x.sub; }, 0);
  return { success: true, data: { list: list, count: sum, unpaid: unpaid } };
}
// 核准（可調整補助金額）、退回、標已報帳
function v42_bfSet_(p) {
  var me = v39_me_(); if (!v42_isLv4_(me)) return { error: 'Lv.4 以上才能核准' };
  var act = String(p.act || ''), x = v42_bfAll_().filter(function (y) { return y.id === String(p.id || ''); })[0];
  if (!x) return { error: '找不到這筆申請' };
  if (x.emp === me.id && !v42_isBoss_(me)) return { error: '自己的申請請由其他主管核准' };
  var sh = v42_s_('福利補助', V42_BF_HEAD), now = v39_now_(), who = v40_nm_(me.id), cat = V42_BF_CATS[x.cat] ? V42_BF_CATS[x.cat][0] : x.cat;
  if (act === 'approve') {
    if (x.status !== '待核准') return { error: '這筆不是待核准' };
    if (x.cat === 'shop3' && !v42_isBoss_(me)) return { error: '購物金要由隊長核准' };
    var sub = p.sub != null && p.sub !== '' ? Math.round(Number(p.sub)) : x.sub;
    if (!(sub >= 0 && sub <= x.amount && sub <= 100000)) return { error: '補助金額不對' };
    sh.getRange(x.row, 9).setValue(sub); sh.getRange(x.row, 13, 1, 3).setValues([['待報帳', who, now]]);
    v41_noteAny_(x.emp, 'benefit', '🎁 ' + cat + '「' + x.title + '」已核准 $' + sub + '，等會計報帳');
    if (x.cat === 'race') v40_event_('race', '🏅 ' + x.name + ' 完賽「' + x.title + '」！', '運動室');
    if (x.cat === 'tuition' || x.cat === 'certfee') v40_event_('cert', '🎓 ' + x.name + ' 的「' + x.title + '」通過補助', '學習室');
    return { success: true };
  }
  if (act === 'reject') {
    if (x.status !== '待核准') return { error: '這筆不是待核准' };
    var reason = v42_txt_(p.reason, 60); if (!reason) return { error: '請寫退回原因' };
    sh.getRange(x.row, 13, 1, 3).setValues([['退回', who, now]]); sh.getRange(x.row, 17).setValue(reason);
    v41_noteAny_(x.emp, 'benefit', '🎁 ' + cat + '「' + x.title + '」被退回：' + reason);
    return { success: true };
  }
  if (act === 'paid') {
    if (x.status !== '待報帳') return { error: '這筆不是待報帳' };
    sh.getRange(x.row, 13).setValue('已報帳'); sh.getRange(x.row, 16).setValue(now);
    v41_noteAny_(x.emp, 'benefit', '🎁 ' + cat + '「' + x.title + '」已報帳 $' + x.sub);
    return { success: true };
  }
  return { error: '不知道要做什麼' };
}

// ───────── 2. 比賽公告 ─────────
function v42_events_() {
  var d = v40_today_();
  return v42_rows_('比賽公告', V42_EV_HEAD).map(function (r, i) { return { id: String(r[0]), by: String(r[2]), name: String(r[3]), date: v39_d_(r[4]), place: String(r[5] || ''), link: String(r[6] || ''), status: String(r[7] || '') }; })
    .filter(function (x) { return x.status !== '刪除' && x.date >= gm_addDays_(d, -7); }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }).slice(0, 30);
}
function v42_eventAdd_(p) {
  var me = v39_me_(), name = v42_txt_(p.name, 40), date = String(p.date || '').slice(0, 10);
  if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: '請填比賽名稱和日期' };
  if (v42_events_().filter(function (x) { return x.by === me.id; }).length >= 10) return { error: '你已經貼了 10 則比賽' };
  var id = 'EV' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss');
  v42_s_('比賽公告', V42_EV_HEAD).appendRow([id, v39_now_(), me.id, name, date, v42_txt_(p.place, 30), v42_url_(p.link), '']);
  v40_event_('race', '🏃 ' + v40_nm_(me.id) + ' 貼了比賽「' + name + '」（' + date.slice(5).replace('-', '/') + '）', '運動室');
  return { success: true, data: v42_events_() };
}
function v42_eventDel_(p) {
  var me = v39_me_(), rows = v42_rows_('比賽公告', V42_EV_HEAD);
  for (var i = 0; i < rows.length; i++) if (String(rows[i][0]) === String(p.id || '')) {
    if (String(rows[i][2]) !== me.id && !v42_isLv4_(me)) return { error: '只有貼文的人或 Lv.4 以上可以刪' };
    v42_s_('比賽公告', V42_EV_HEAD).getRange(i + 2, 8).setValue('刪除'); return { success: true, data: v42_events_() };
  }
  return { error: '找不到這則比賽' };
}

// ───────── 3. 夾娃娃機 ─────────
// 機率：基本 6%＋對準度（0～1）×8%，最高 14%；連續 15 次沒夾到，下一次必中。獎品：赤心幣或扭蛋券。
var V42_CLAW_PRIZES = [[60, 'coin', 3, '3 枚赤心幣'], [30, 'coin', 5, '5 枚赤心幣'], [5, 'coin', 20, '20 枚赤心幣'], [5, 'tix', 1, '扭蛋券 1 張']];
function v42_claw_(p) {
  var me = v39_me_(); if (gm_isFrozen_(me.id)) return { error: '帳號不能使用赤心幣' };
  var cost = v42_n_('夾娃娃價格', 1), pity = v42_n_('夾娃娃保底次數', 15), align = Math.max(0, Math.min(1, Number(p.align) || 0));
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    if (gm_balance_(me.id) < cost) return { error: '赤心幣不足' };
    var m = {}; try { m = JSON.parse(gm_getState_('夾娃娃保底') || '{}') || {}; } catch (e) { m = {}; }
    var miss = Number(m[me.id]) || 0, key = 'CLAW|' + me.id + '|' + Date.now() + '|' + Math.random();
    gm_credit_(me.id, '夾娃娃機', -cost, '夾娃娃機', key);
    var prob = v42_n_('夾娃娃機率', 0.06) + align * 0.08, win = miss + 1 >= pity || Math.random() < prob, prize = null;
    if (win) {
      var tot = V42_CLAW_PRIZES.reduce(function (a, x) { return a + x[0]; }, 0), r = Math.random() * tot;
      for (var i = 0; i < V42_CLAW_PRIZES.length; i++) { r -= V42_CLAW_PRIZES[i][0]; if (r < 0) { prize = V42_CLAW_PRIZES[i]; break; } }
      prize = prize || V42_CLAW_PRIZES[0];
      if (prize[1] === 'coin') gm_credit_(me.id, '夾娃娃機', prize[2], '夾到 ' + prize[3], key + '|W');
      else s30_tixAdd_(me.id, prize[2], '夾娃娃機', key + '|W');
      m[me.id] = 0;
      if (prize[2] >= 20 || prize[1] === 'tix') v40_event_('claw', '🧸 ' + v40_nm_(me.id) + ' 夾到 ' + prize[3] + '！', '遊戲室');
    } else m[me.id] = miss + 1;
    gm_setState_('夾娃娃保底', JSON.stringify(m));
    return { success: true, data: { win: win, prize: prize ? prize[3] : '', miss: m[me.id], pity: pity, balance: gm_balance_(me.id) } };
  } finally { lock.releaseLock(); }
}

// ───────── 4. 感謝牆、意見箱 ─────────
function v42_thanks_() {
  return v42_rows_('感謝牆', V42_TH_HEAD).slice(-30).reverse().map(function (r) { return { time: v42_hm_(r[0]), from: String(r[2]), fromName: v40_nm_(r[2]), to: String(r[3]), toName: v40_nm_(r[3]), text: String(r[4]) }; });
}
function v42_thank_(p) {
  var me = v39_me_(), to = String(p.to || '').trim(), text = v42_txt_(p.text, 40);
  if (!gm_emp_(to) || to === me.id) return { error: '找不到這位隊員' };
  if (!text) return { error: '寫一句謝謝的話吧' };
  var d = v40_today_(), n = v42_rows_('感謝牆', V42_TH_HEAD).filter(function (r) { return v39_d_(r[1]) === d && String(r[2]) === me.id; }).length;
  if (n >= 3) return { error: '今天已經貼了 3 張，明天再來' };
  v42_s_('感謝牆', V42_TH_HEAD).appendRow([v39_now_(), d, me.id, to, text]);
  v40_note_(to, 'thanks', '💌 ' + v40_nm_(me.id) + '：' + text, 'pair', me.id + '|' + Date.now());
  v40_event_('thanks', '💌 ' + v40_nm_(me.id) + ' 謝謝 ' + v40_nm_(to), '休息區');
  return { success: true, data: v42_thanks_() };
}
function v42_idea_(p) {
  var me = v39_me_(), text = v42_txt_(p.text, 300), anon = p.anon === true || p.anon === 'Y' || p.anon === 'true';
  if (text.length < 2) return { error: '請寫下你的想法' };
  var d = v40_today_(), n = v42_rows_('意見箱', V42_IDEA_HEAD).filter(function (r) { return String(r[0]).slice(0, 10) === d && String(r[1]) === me.id; }).length;
  if (n >= 5) return { error: '今天已經投了 5 則' };
  // 匿名：不記員工編號與姓名（只記日期，防止灌爆用不到身分）
  v42_s_('意見箱', V42_IDEA_HEAD).appendRow([v39_now_(), anon ? '' : me.id, anon ? '' : v40_nm_(me.id), anon ? 'Y' : '', text, '', '']);
  return { success: true };
}
function v42_ideas_(p) {
  var me = v39_me_(); if (!v42_isBoss_(me)) return { error: '只有大隊長看得到意見箱' };
  return { success: true, data: v42_rows_('意見箱', V42_IDEA_HEAD).map(function (r, i) { return { i: i + 2, time: v42_hm_(r[0]), name: String(r[3]) === 'Y' ? '（匿名）' : String(r[2]), anon: String(r[3]) === 'Y', text: String(r[4]), reply: String(r[5] || '') }; }).reverse().slice(0, 100) };
}
function v42_ideaReply_(p) {
  var me = v39_me_(); if (!v42_isBoss_(me)) return { error: '只有大隊長可以回覆' };
  var row = Number(p.i), text = v42_txt_(p.text, 200), sh = v42_s_('意見箱', V42_IDEA_HEAD);
  if (!(row >= 2 && row <= sh.getLastRow()) || !text) return { error: '回覆內容不完整' };
  var r = sh.getRange(row, 1, 1, 7).getValues()[0];
  sh.getRange(row, 6, 1, 2).setValues([[text, v39_now_()]]);
  if (r[1]) v41_noteAny_(String(r[1]), 'benefit', '📮 隊長回覆你的意見：' + text);
  return { success: true };
}

// ───────── 5. 宇宙辦公室資料 ─────────
function v42_wall_() {
  var all = v42_bfAll_().filter(function (x) { return x.status === '待報帳' || x.status === '已報帳'; });
  var pick = function (cats) { return all.filter(function (x) { return cats.indexOf(x.cat) >= 0; }).slice(-8).reverse().map(function (x) { return { name: x.name, title: x.title, date: x.date }; }); };
  return { sport: pick(['race']), cert: pick(['certfee', 'tuition']) };
}
function v42_lobby_() {   // 新人歡迎（到職 7 天內）、今天到職週年
  var d = v40_today_(), md = d.slice(5), out = { welcome: [], anniv: [] };
  ops_staff_().list.forEach(function (x) {
    if (x.left || (x.type && x.type !== '員工')) return;
    var h = v42_hire_(x.id); if (!h) return;
    if (h <= d && h >= gm_addDays_(d, -7)) out.welcome.push({ id: x.id, name: x.nick || x.name, hire: h });
    else if (h.slice(5) === md && h.slice(0, 4) < d.slice(0, 4)) out.anniv.push({ id: x.id, name: x.nick || x.name, years: Number(d.slice(0, 4)) - Number(h.slice(0, 4)) });
  });
  return out;
}

// ───────── setup ─────────
function v42_setup() {
  var log = [];
  [['福利補助', V42_BF_HEAD], ['比賽公告', V42_EV_HEAD], ['感謝牆', V42_TH_HEAD], ['意見箱', V42_IDEA_HEAD]].forEach(function (x) { v42_s_(x[0], x[1]); });
  log.push('分頁就緒：福利補助、比賽公告、感謝牆、意見箱');
  var have = {}; gm_rows_('params').forEach(function (r) { have[String(r[0]).trim()] = 1; });
  var add = [['其他運動每年補助', 1000, 'v1.42：瑜伽、有氧、健身房每人每年補助（年中到職按比例）'],
             ['證照學費每年課程數', 2, 'v1.42：證照上課學費每人每年可申請幾個課程'],
             ['證照學費補助比例', 0.5, 'v1.42：證照學費考取後補助比例（0.5＝50%）'],
             ['比賽購物金場數', 3, 'v1.42：累積完賽幾場可申請購物金'],
             ['比賽購物金金額', 3000, 'v1.42：比賽購物金金額（隊長核准）'],
             ['夾娃娃價格', 1, 'v1.42：夾一次花幾枚'],
             ['夾娃娃機率', 0.06, 'v1.42：基本成功率（另加對準度最多 8%）'],
             ['夾娃娃保底次數', 15, 'v1.42：連續幾次沒夾到，下一次必中']].filter(function (x) { return !have[x[0]]; });
  if (add.length) { gm_append_('params', add); log.push('遊戲參數新增 ' + add.map(function (x) { return x[0]; }).join('、')); }
  Logger.log(log.join('\n')); return log.join('\n');
}

// ───────── 動作 ─────────
AU_READ = new RegExp(AU_READ.source.replace(/\)\$$/, '|bfMe|bfList|v42Ideas)$'));
function v42Handler_(action, p) {
  p = p || {};
  if (action === 'gmScene') {
    var r = v41Handler_('gmScene', p); if (!r || !r.data) return r;
    var safe = function (f, dv) { try { return f(); } catch (e) { return dv; } };
    r.data.bfWall = safe(v42_wall_, null);
    r.data.thanks = safe(v42_thanks_, []);
    r.data.lobby = safe(v42_lobby_, null);
    r.data.events = safe(v42_events_, []);
    return r;
  }
  var map = { bfMe: v42_bfMe_, bfApply: v42_bfApply_, bfCancel: v42_bfCancel_, bfList: v42_bfList_, bfSet: v42_bfSet_,
              bfEventAdd: v42_eventAdd_, bfEventDel: v42_eventDel_, v42Claw: v42_claw_, v42Thank: v42_thank_,
              v42Idea: v42_idea_, v42Ideas: v42_ideas_, v42IdeaReply: v42_ideaReply_ };
  if (!map[action]) return null;
  var lock = null;
  try {
    OPS_C_ = {}; GM_CACHE_ = {};
    if (/^(bfSet|bfCancel|v42Thank|v42Idea|v42IdeaReply|bfEvent)/.test(action)) { lock = LockService.getScriptLock(); lock.waitLock(15000); }
    return map[action](p);
  } catch (e) { return { error: e.message }; }
  finally { if (lock) lock.releaseLock(); }
}

// ═══════════════════════════════════════════════
// 路由 extHandler_ v1.42（2026-11-14）
// 放在檔案最後，取代路由 v1.41（Apps Script 以檔案中最後一個同名函式為準）。
// 與 v1.41 路由的差別：v41Handler_ 之前加 v42Handler_（福利補助、比賽公告、夾娃娃機、感謝牆、意見箱；
//   接手 gmScene → v41 → v40 → v39 → h36 → s30）。extHandler_ 照舊經過 v41_wordRes_。
// ═══════════════════════════════════════════════
function extHandler_(action, p) { return v41_wordRes_(v42Route_(action, p)); }
function v42Route_(action, p) {
  p = p || {};
  var gate = au_gate_(action, p); if (gate) return gate;
  var au = auHandler_(action, p); if (au) return au;
  var sec = secHandler_(action, p); if (sec) return sec;
  var op = opsHandler_(action, p); if (op) return op;
  var bu = buHandler_(action, p); if (bu) return bu;
  var rp = rpHandler_(action, p); if (rp) return rp;
  var fs = fsHandler_(action, p); if (fs) return fs;
  var v42 = v42Handler_(action, p); if (v42) return v42;
  var v41 = v41Handler_(action, p); if (v41) return v41;
  var v40 = v40Handler_(action, p); if (v40) return v40;
  var v39 = v39Handler_(action, p); if (v39) return v39;
  var h36 = h36Handler_(action, p); if (h36) return h36;
  var eq = eqHandler_(action, p); if (eq) return eq;
  var qt = qtHandler_(action, p); if (qt) return qt;
  var s30 = s30Handler_(action, p); if (s30) return s30;
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

// ═══════════════════════════════════════════════
// 紅玉滿夥伴 App 後端模組 v1.44（2026-11-14，檔案 v2＝前端 0020 v3）＋部署端修正：夾娃娃「對準加成」改成參數，預設 0.1（原 0.25）
// 貼在第 44 版全文最下面（v1.43 勞健保合併版之後），檔案最後的「路由 v1.44」取代 v1.43 合併版的 extHandler_
// （保留 getMyIns 那段與 v41_wordRes_ 外層）。
// 內容：
//   1. 心情簽到（每天一次；只有 Lv.3 以上看得到；連續 3 次心情低落提醒主管關心）
//   2. 隊長室敲門留言（寫給隊長，非匿名，隊長在意見箱回覆）
//   3. 客人讚美榮譽牆（Lv.2 以上貼）
//   4. 遊戲室排行榜（本週各遊戲前 3 名）
//   5. 飯堂：請吃雞蛋糕、今日菜單（Lv.3 以上編輯）、今天和隊長吃飯的人
//   6. 意見箱不匿名（隊長 11/14 19:02）：一律記員工編號、姓名；每人每天 5 則
//   7. gmScene 加 praise、rank、canteen、macc（坐騎配件）
//   8. 夾娃娃機改版（覆蓋 v42_claw_）：約 3 次中 1 次、6 次保底；大多 1～10 枚，桌面小配件稀有
//   9. 遊戲室拍貼機＋我的相簿：原圖存雲端〈拍貼相簿（不公開）〉，只有本人看得到
//  10. 坐騎配件＋商店街新店種「坐騎改裝店」（8 種配件）
// v1.45（薪資修正）要放在本模組之後、最後的「路由 v1.44」之前。
// 安全：所有動作都用 au_verifiedId_()（經 v39_me_），沒有通行證就擋。
// 執行一次 v44_setup()：建立〈心情簽到〉〈客人讚美〉〈拍貼相簿〉分頁、〈遊戲參數〉補參數、〈商品目錄〉加坐騎配件。
// 拍貼機用 DriveApp（和體檢表同一個權限，不用重新授權）。
// ═══════════════════════════════════════════════

var V44_MOOD_HEAD = ['時間', '日期', '員工編號', '心情', '一句話'];
var V44_PRAISE_HEAD = ['時間', '日期', '貼文者', '櫃位', '隊員', '來源', '內容'];
var V44_MOODS = ['', '😢 很低落', '😟 有點累', '😐 普通', '🙂 不錯', '😄 很棒'];
if (V41_ROOMS.indexOf('隊長室') < 0) V41_ROOMS.push('隊長室');

function v44_isMgr_(me) { return me && (me.role >= 3 || me.pos === '大隊長'); }

// ───────── 1. 心情簽到 ─────────
function v44_moodRows_() { return v42_rows_('心情簽到', V44_MOOD_HEAD); }
function v44_mood_(p) {
  var me = v39_me_(), v = Math.round(Number(p.mood) || 0), d = v40_today_();
  if (!(v >= 1 && v <= 5)) return { error: '請選一個心情' };
  var note = v42_txt_(p.note, 40), sh = v42_s_('心情簽到', V44_MOOD_HEAD), rows = v44_moodRows_();
  for (var i = rows.length - 1; i >= 0; i--) if (v39_d_(rows[i][1]) === d && String(rows[i][2]) === me.id) { sh.getRange(i + 2, 4, 1, 2).setValues([[v, note]]); v44_moodAlert_(me.id); return { success: true, data: { mood: v, updated: true } }; }
  sh.appendRow([v39_now_(), d, me.id, v, note]);
  v44_moodAlert_(me.id);
  return { success: true, data: { mood: v } };
}
// 連續 3 次（最近 3 筆）都 ≤2 → 提醒 Lv.3 以上主管關心（同一段低落只提醒一次）
function v44_moodAlert_(emp) {
  var mine = v44_moodRows_().filter(function (r) { return String(r[2]) === emp; }).slice(-3);
  if (mine.length < 3 || !mine.every(function (r) { return Number(r[3]) <= 2; })) return;
  var key = '心情提醒|' + emp + '|' + v39_d_(mine[0][1]);
  if (gm_getState_(key)) return; gm_setState_(key, '1');
  ops_staff_().list.filter(function (x) { return !x.left && x.id !== emp && (x.role >= 3 || x.pos === '大隊長'); })
    .forEach(function (x) { v41_noteAny_(x.id, 'care', '💗 ' + v40_nm_(emp) + ' 最近心情比較低落，找時間關心一下'); });
}
function v44_moodMe_(p) {
  var me = v39_me_(), d = v40_today_(), today = null;
  v44_moodRows_().forEach(function (r) { if (String(r[2]) === me.id && v39_d_(r[1]) === d) today = { mood: Number(r[3]), note: String(r[4] || '') }; });
  return { success: true, data: { today: today, moods: V44_MOODS } };
}
// 主管看：今天每個人的心情、最近 7 天平均、連續低落
function v44_moodTeam_(p) {
  var me = v39_me_(); if (!v44_isMgr_(me)) return { error: 'Lv.3 以上才看得到' };
  var d = v40_today_(), from = gm_addDays_(d, -6), by = {};
  v44_moodRows_().forEach(function (r) {
    var e = String(r[2]), dd = v39_d_(r[1]); if (dd < gm_addDays_(d, -30)) return;
    (by[e] = by[e] || []).push({ d: dd, v: Number(r[3]), note: String(r[4] || '') });
  });
  var list = Object.keys(by).map(function (e) {
    var a = by[e], wk = a.filter(function (x) { return x.d >= from; }), last3 = a.slice(-3);
    var t = a.filter(function (x) { return x.d === d; })[0] || null;
    return { id: e, name: v40_nm_(e), today: t ? t.v : 0, note: t ? t.note : '', avg: wk.length ? Math.round(wk.reduce(function (s, x) { return s + x.v; }, 0) / wk.length * 10) / 10 : 0,
             low: last3.length === 3 && last3.every(function (x) { return x.v <= 2; }) };
  }).sort(function (a, b) { return (b.low - a.low) || (a.today || 9) - (b.today || 9); });
  return { success: true, data: { list: list, moods: V44_MOODS } };
}

// ───────── 2. 隊長室敲門 ─────────
function v44_knock_(p) {
  var me = v39_me_(), text = v42_txt_(p.text, 300);
  if (text.length < 2) return { error: '請寫下想跟隊長說的話' };
  var key = 'IDEA|' + me.id + '|' + v40_today_(), n = Number(gm_getState_(key) || 0);
  if (n >= 5) return { error: '今天已經留了 5 則' };
  gm_setState_(key, String(n + 1));
  v42_s_('意見箱', V42_IDEA_HEAD).appendRow([v39_now_(), me.id, v40_nm_(me.id), '', '【敲門】' + text, '', '']);
  ops_staff_().list.filter(function (x) { return !x.left && (x.role >= 5 || x.pos === '大隊長'); }).forEach(function (x) { v41_noteAny_(x.id, 'care', '🚪 ' + v40_nm_(me.id) + ' 敲了隊長室的門：' + text.slice(0, 30)); });
  return { success: true };
}
// 覆蓋 v1.42 v42_idea_：匿名也有每日上限（以通行證計數，存在 Script Properties，不寫進表格）
function v42_idea_(p) {
  // v1.44 v3：意見箱不匿名，一律記下員工編號與姓名（隊長要知道是誰反映）
  var me = v39_me_(), text = v42_txt_(p.text, 300);
  if (text.length < 2) return { error: '請寫下你的想法' };
  var key = 'IDEA|' + me.id + '|' + v40_today_(), n = Number(gm_getState_(key) || 0);
  if (n >= 5) return { error: '今天已經投了 5 則' };
  gm_setState_(key, String(n + 1));
  v42_s_('意見箱', V42_IDEA_HEAD).appendRow([v39_now_(), me.id, v40_nm_(me.id), '', text, '', '']);
  return { success: true };
}
function v42_ideas_(p) {
  var me = v39_me_(); if (!v42_isBoss_(me)) return { error: '只有大隊長看得到意見箱' };
  return { success: true, data: v42_rows_('意見箱', V42_IDEA_HEAD).map(function (r, i) { var old = String(r[3]) === 'Y' && !r[1]; return { i: i + 2, time: v42_hm_(r[0]), name: old ? '（舊版匿名）' : String(r[2]), anon: old, text: String(r[4]), reply: String(r[5] || '') }; }).reverse().slice(0, 100) };
}

// ───────── v1.44 v3 夾娃娃機改版：變好夾；大多夾到 1～10 枚赤心幣，桌面小配件是稀有驚喜 ─────────
// 機率 = 夾娃娃好夾機率(預設 0.25) + 對準度 × 0.25（對很準最高 50%）；連續 夾娃娃好夾保底(預設 6) 次沒中，下一次必中
// 獎品（權重合計 100）：赤心幣 75（1 枚 30、2 枚 22、3 枚 14、5 枚 7、10 枚 2）、桌面小配件 20、扭蛋券 5
// 平均每夾一次約拿回 0.6 枚，花的比拿的多，但常常有東西；小配件直接放進「我的物品」，已經有的換成 3 枚
var V44_CLAW_PRIZES = [
  [30, 'coin', '', '1 枚赤心幣', '🪙', 1], [22, 'coin', '', '2 枚赤心幣', '🪙', 2], [14, 'coin', '', '3 枚赤心幣', '🪙', 3],
  [7, 'coin', '', '5 枚赤心幣', '💰', 5], [2, 'coin', '', '10 枚赤心幣', '💰', 10],
  [6, 'deco', 'deco_plant', '小盆栽', '🪴', 3], [5, 'deco', 'deco_frame', '相框', '🖼️', 3],
  [3, 'deco', 'deco_globe', '地球儀', '🌍', 3], [2.5, 'deco', 'deco_figure', '雞蛋糕公仔', '🧸', 3],
  [1.8, 'deco', 'deco_trex', '小暴龍玩偶', '🦖', 3], [1.2, 'deco', 'deco_trophy', '獎盃', '🏆', 3],
  [0.5, 'deco', 'deco_oven', '迷你金烤爐', '✨', 3],
  [5, 'tix', '', '扭蛋券 1 張', '🎟️', 1]
];
function v42_claw_(p) {
  var me = v39_me_(); if (gm_isFrozen_(me.id)) return { error: '帳號不能使用赤心幣' };
  var cost = v42_n_('夾娃娃價格', 1), pity = v42_n_('夾娃娃好夾保底', 6), align = Math.max(0, Math.min(1, Number(p.align) || 0));
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    if (gm_balance_(me.id) < cost) return { error: '赤心幣不足' };
    var m = {}; try { m = JSON.parse(gm_getState_('夾娃娃保底') || '{}') || {}; } catch (e) { m = {}; }
    var miss = Number(m[me.id]) || 0, key = 'CLAW|' + me.id + '|' + Date.now() + '|' + Math.random();
    gm_credit_(me.id, '夾娃娃機', -cost, '夾娃娃機', key);
    var prob = Math.min(0.9, v42_n_('夾娃娃好夾機率', 0.25) + align * v42_n_('夾娃娃對準加成', 0.1))   // 部署端：對準加成最多 10%（align 由前端送，可被改成 1；25% 時期望值會超過 1 枚）, win = miss + 1 >= pity || Math.random() < prob;
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

// ───────── v1.44 v3 遊戲室拍貼機＋我的相簿 ─────────
// 拍一次（存進相簿時）扣 拍貼機價格(預設 1) 枚；原圖存雲端硬碟〈拍貼相簿（不公開）〉，縮圖存在〈拍貼相簿〉分頁
// 只有本人看得到自己的相簿（每位隊員在「我的 → 我的相簿」）
var V44_PH_HEAD = ['時間', '員工編號', '姓名', '相片ID', '標題', '檔案', '縮圖', '刪除'];
function v44_phFolder_() {
  var roots = DriveApp.getFoldersByName(DRIVE_ROOT), root = roots.hasNext() ? roots.next() : DriveApp.createFolder(DRIVE_ROOT);
  var subs = root.getFoldersByName('拍貼相簿（不公開）');
  return subs.hasNext() ? subs.next() : root.createFolder('拍貼相簿（不公開）');
}
function v44_b64_(v) { return String(v || '').replace(/^data:image\/\w+;base64,/, ''); }
function v44_photo_(p) {
  var me = v39_me_(); if (p._viewAs) return { error: '預覽模式只能看' };
  if (gm_isFrozen_(me.id)) return { error: '帳號不能使用赤心幣' };
  var img = v44_b64_(p.img), th = v44_b64_(p.thumb);
  if (!/^[A-Za-z0-9+\/=]+$/.test(img) || img.length < 1000 || img.length > 1400000) return { error: '照片格式不對，請重拍' };
  if (!/^[A-Za-z0-9+\/=]*$/.test(th) || th.length > 45000) th = '';
  var cost = v42_n_('拍貼機價格', 1), d = v40_today_(), key = 'PHOTO|' + me.id + '|' + d, n = Number(gm_getState_(key) || 0);
  if (n >= v42_n_('拍貼機每日上限', 20)) return { error: '今天已經拍很多張了，明天再來' };
  if (gm_balance_(me.id) < cost) return { error: '赤心幣不足（拍一次 ' + cost + ' 枚）' };
  var id = 'PH' + Date.now() + Math.floor(Math.random() * 1000);
  var f = v44_phFolder_().createFile(Utilities.newBlob(Utilities.base64Decode(img), 'image/jpeg', me.id + '_' + id + '.jpg'));
  try { f.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE); } catch (e) {}
  if (cost > 0) gm_credit_(me.id, '拍貼機', -cost, '遊戲室拍貼機', id);
  gm_setState_(key, String(n + 1));
  v42_s_('拍貼相簿', V44_PH_HEAD).appendRow([v39_now_(), me.id, v40_nm_(me.id), id, v42_txt_(p.title, 20), f.getId(), th, '']);
  if (n === 0) v40_event_('photo', '📸 ' + v40_nm_(me.id) + ' 在遊戲室拍了拍貼', '遊戲室');
  return { success: true, data: { id: id, balance: gm_balance_(me.id) } };
}
function v44_phRows_(emp) {
  var sh = v42_s_('拍貼相簿', V44_PH_HEAD), n = sh.getLastRow(); if (n < 2) return [];
  var a = sh.getRange(2, 1, n - 1, 6).getValues(), b = sh.getRange(2, 7, n - 1, 2).getValues(), out = [];
  for (var i = 0; i < a.length; i++) if (String(a[i][1]) === emp && !b[i][1]) out.push({ row: i + 2, time: v42_hm_(a[i][0]), id: String(a[i][3]), title: String(a[i][4] || ''), file: String(a[i][5]), thumb: String(b[i][0] || '') });
  return out;
}
function v44_photos_(p) {
  var me = v39_me_();
  return { success: true, data: v44_phRows_(me.id).reverse().slice(0, 200).map(function (x) { return { id: x.id, time: x.time, title: x.title, thumb: x.thumb }; }) };
}
function v44_photoGet_(p) {
  var me = v39_me_(), x = v44_phRows_(me.id).filter(function (r) { return r.id === String(p.id); })[0];
  if (!x) return { error: '找不到這張照片' };
  var b = DriveApp.getFileById(x.file).getBlob();
  return { success: true, data: { id: x.id, base64: Utilities.base64Encode(b.getBytes()) } };
}
function v44_photoDel_(p) {
  var me = v39_me_(), x = v44_phRows_(me.id).filter(function (r) { return r.id === String(p.id); })[0];
  if (!x) return { error: '找不到這張照片' };
  v42_s_('拍貼相簿', V44_PH_HEAD).getRange(x.row, 8).setValue(v39_now_());
  try { DriveApp.getFileById(x.file).setTrashed(true); } catch (e) {}
  return { success: true };
}

// ───────── v1.44 v3 坐騎配件＋坐騎改裝店 ─────────
// 商店街新店種「坐騎改裝店」賣 8 種配件（隊員開店來賣）；買到後在「赤心幣商店 → 坐騎」裝上，最多同時裝 3 個
// 配件不分坐騎：換騎哪一台都會跟著裝上。用 wear 類商品機制（買了就擁有、不能重複買）
var V44_MACC = [
  ['macc_flag', '紅玉滿小旗', '普通', 15, '🚩'], ['macc_balloon', '愛心氣球', '普通', 15, '🎈'],
  ['macc_plate', '專屬車牌', '普通', 20, '🔖'], ['macc_star', '星星特效', '普通', 30, '✨'],
  ['macc_neon', '霓虹底燈', '稀有', 35, '💡'], ['macc_flame', '火焰尾氣', '稀有', 40, '🔥'],
  ['macc_wings', '天使翅膀', '稀有', 45, '🪽'], ['macc_gold', '黃金塗裝', '傳說', 90, '👑']
];
var V44_MACC_ITEMS = V44_MACC.map(function (m) { return ['s_' + m[0], m[1], 'wear', m[2], m[3], '小店:坐騎改裝店', '', 'wear:' + m[0]]; });
if (PV_SHOP_TYPES.indexOf('坐騎改裝店') < 0) PV_SHOP_TYPES.push('坐騎改裝店');
if (typeof GM_CATALOG_SEED !== 'undefined') V44_MACC_ITEMS.forEach(function (r) { if (!GM_CATALOG_SEED.some(function (x) { return x[0] === r[0]; })) GM_CATALOG_SEED.push(r); });
var V44_MACC_MAX = 3;
function v44_maccAll_() { var m = {}; try { m = JSON.parse(gm_getState_('坐騎配件') || '{}') || {}; } catch (e) { m = {}; } return m; }
function v44_maccOwned_(emp) { var o = gm_owned_(emp); return V44_MACC.filter(function (m) { return o[m[0]]; }).map(function (m) { return m[0]; }); }
function v44_maccMe_(p) {
  var me = v39_me_(), own = v44_maccOwned_(me.id), on = (v44_maccAll_()[me.id] || []).filter(function (x) { return own.indexOf(x) >= 0; });
  return { success: true, data: { list: V44_MACC.map(function (m) { return { id: m[0], name: m[1], tier: m[2], price: m[3], icon: m[4] }; }), owned: own, on: on, max: V44_MACC_MAX } };
}
function v44_maccSet_(p) {
  var me = v39_me_(), own = v44_maccOwned_(me.id), want = [].concat(p.on || []).map(String);
  want = want.filter(function (x, i) { return own.indexOf(x) >= 0 && want.indexOf(x) === i; });
  if (want.length > V44_MACC_MAX) return { error: '最多同時裝 ' + V44_MACC_MAX + ' 個配件' };
  var m = v44_maccAll_(); if (want.length) m[me.id] = want; else delete m[me.id];
  gm_setState_('坐騎配件', JSON.stringify(m));
  return { success: true, data: { on: want } };
}
function v44_maccScene_() {   // 只回目前有騎坐騎、而且還擁有的配件
  var m = v44_maccAll_(), ride = v40_rideMap_(), out = {}, rows = gm_rows_('owned'), own = {};
  rows.forEach(function (r) { if (/^macc_/.test(String(r[1]))) (own[String(r[0])] = own[String(r[0])] || {})[String(r[1])] = 1; });
  Object.keys(m).forEach(function (e) { if (!ride[e]) return; var a = (m[e] || []).filter(function (x) { return own[e] && own[e][x]; }); if (a.length) out[e] = a.slice(0, V44_MACC_MAX); });
  return out;
}

// ───────── 3. 客人讚美 ─────────
function v44_praiseList_() {
  return v42_rows_('客人讚美', V44_PRAISE_HEAD).slice(-20).reverse().map(function (r) { return { date: v39_d_(r[1]), loc: String(r[3] || ''), who: String(r[4] || ''), src: String(r[5] || ''), text: String(r[6] || '') }; });
}
function v44_praise_(p) {
  var me = v39_me_(); if (!(me.role >= 2 || me.pos === '大隊長')) return { error: 'Lv.2 以上才能貼' };
  var text = v42_txt_(p.text, 80); if (text.length < 2) return { error: '請貼上客人說的話' };
  var src = /^(Google 評論|現場|社群|電話|其他)$/.test(String(p.src || '')) ? String(p.src) : '現場';
  v42_s_('客人讚美', V44_PRAISE_HEAD).appendRow([v39_now_(), v40_today_(), me.id, v42_txt_(p.loc, 20), v42_txt_(p.who, 20), src, text]);
  v40_event_('praise', '⭐ 客人稱讚' + (p.who ? ' ' + v42_txt_(p.who, 20) : '') + (p.loc ? '（' + v42_txt_(p.loc, 20) + '）' : '') + '：' + text.slice(0, 20), '辦公區');
  return { success: true, data: v44_praiseList_() };
}

// ───────── 4. 遊戲排行榜（本週一到今天，各遊戲前 3 名）─────────
function v44_rank_() {
  var d = v40_today_(), wd = (new Date(d + 'T00:00:00Z').getUTCDay() + 6) % 7, from = gm_addDays_(d, -wd), best = {};
  gm_rows_('games').forEach(function (r) {
    var dd = String(r[1]); if (dd < from || dd > d) return;
    var g = String(r[3]), e = String(r[2]), sc = Number(r[4]) || 0, m = (best[g] = best[g] || {});
    if (!m[e] || sc > m[e]) m[e] = sc;
  });
  return GM_GAMES.map(function (g) {
    var m = best[g[0]] || {};
    return { game: g[0], name: g[1], top: Object.keys(m).map(function (e) { return { name: v40_nm_(e), score: m[e] }; }).sort(function (a, b) { return b.score - a.score; }).slice(0, 3) };
  }).filter(function (x) { return x.top.length; });
}

// ───────── 5. 飯堂 ─────────
function v44_menu_() { try { return JSON.parse(gm_getState_('今日菜單') || '{}') || {}; } catch (e) { return {}; } }
function v44_menuSet_(p) {
  var me = v39_me_(); if (!v44_isMgr_(me)) return { error: 'Lv.3 以上才能改菜單' };
  var lines = String(p.lines || '').split(/\n/).map(function (x) { return v42_txt_(x, 24); }).filter(String).slice(0, 6);
  var m = { lines: lines, by: v40_nm_(me.id), date: v40_today_() };
  gm_setState_('今日菜單', JSON.stringify(m)); return { success: true, data: m };
}
function v44_cake_(p) {   // 請吃雞蛋糕（像請喝咖啡：同一個人每天一次）
  var me = v39_me_(), to = String(p.to || '').trim();
  if (!gm_emp_(to) || to === me.id) return { error: '找不到這位隊員' };
  if (gm_isFrozen_(me.id)) return { error: '帳號不能使用赤心幣' };
  var cost = v42_n_('請吃雞蛋糕價格', 2);
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var key = 'CAKE|' + me.id + '|' + to + '|' + v40_today_();
    if (gm_hasKey_(key)) return { error: '今天已經請過他了' };
    if (cost > 0 && gm_balance_(me.id) < cost) return { error: '赤心幣不足' };
    if (!v40_note_(to, 'coffee', v40_nm_(me.id) + ' 請你吃雞蛋糕 🧇', 'pair', me.id + '|cake')) return { error: '今天已經請過他了' };
    if (cost > 0) gm_credit_(me.id, '請吃雞蛋糕', -cost, '請 ' + v40_nm_(to) + ' 吃雞蛋糕', key);
    v40_event_('cake', v40_nm_(me.id) + ' 請 ' + v40_nm_(to) + ' 吃雞蛋糕 🧇', '飯堂');
    return { success: true, balance: gm_balance_(me.id) };
  } finally { lock.releaseLock(); }
}
function v44_canteen_() {
  var d = v40_today_(), meal = [];
  try { s30_meals_().forEach(function (x) { if (String(x.date).slice(0, 10) === d && x.status !== '已取消') meal.push({ id: x.emp, name: x.name }); }); } catch (e) {}
  return { menu: v44_menu_(), meal: meal };
}

// ───────── setup ─────────
function v44_setup() {
  var log = [];
  [['心情簽到', V44_MOOD_HEAD], ['客人讚美', V44_PRAISE_HEAD], ['拍貼相簿', V44_PH_HEAD]].forEach(function (x) { v42_s_(x[0], x[1]); });
  log.push('分頁就緒：心情簽到、客人讚美、拍貼相簿');
  var have = {}; gm_rows_('params').forEach(function (r) { have[String(r[0]).trim()] = 1; });
  var add = [['請吃雞蛋糕價格', 2, 'v1.44：飯堂請吃雞蛋糕花幾枚（0＝免費）'], ['夾娃娃好夾機率', 0.25, 'v1.44：夾娃娃基本中獎率，對準再加最多 0.25'], ['夾娃娃好夾保底', 6, 'v1.44：連續幾次沒夾到，下一次必中'], ['拍貼機價格', 1, 'v1.44：拍貼機存一張花幾枚'], ['拍貼機每日上限', 20, 'v1.44：每人每天最多存幾張']].filter(function (x) { return !have[x[0]]; });
  if (add.length) { gm_append_('params', add); log.push('遊戲參數新增 ' + add.map(function (x) { return x[0]; }).join('、')); }
  var cat = gm_catalog_(), addc = V44_MACC_ITEMS.filter(function (r) { return !cat[r[0]]; });
  if (addc.length && gm_rows_('catalog').length) { gm_append_('catalog', addc); GM_CACHE_.catalog = null; log.push('〈商品目錄〉新增坐騎改裝店 ' + addc.length + ' 項配件'); }
  Logger.log(log.join('\n')); return log.join('\n');
}

// ───────── 動作 ─────────
AU_READ = new RegExp(AU_READ.source.replace(/\)\$$/, '|v44MoodMe|v44MoodTeam|v44Photos|v44PhotoGet|v44MaccMe)$'));
function v44Handler_(action, p) {
  p = p || {};
  if (action === 'gmScene') {
    var r = v42Handler_('gmScene', p); if (!r || !r.data) return r;
    var safe = function (f, dv) { try { return f(); } catch (e) { return dv; } };
    r.data.praise = safe(v44_praiseList_, []);
    r.data.rank = safe(v44_rank_, []);
    r.data.canteen = safe(v44_canteen_, null);
    r.data.macc = safe(v44_maccScene_, {});
    return r;
  }
  var map = { v44Mood: v44_mood_, v44MoodMe: v44_moodMe_, v44MoodTeam: v44_moodTeam_, v44Knock: v44_knock_, v44Praise: v44_praise_,
              v44MenuSet: v44_menuSet_, v44Cake: v44_cake_,
              v44Photo: v44_photo_, v44Photos: v44_photos_, v44PhotoGet: v44_photoGet_, v44PhotoDel: v44_photoDel_,
              v44MaccMe: v44_maccMe_, v44MaccSet: v44_maccSet_ };
  if (!map[action]) return null;
  var lock = null;
  try {
    OPS_C_ = {}; GM_CACHE_ = {};
    if (/^v44(Mood|Knock|Praise|MenuSet|Photo|PhotoDel|MaccSet)$/.test(action)) { lock = LockService.getScriptLock(); lock.waitLock(15000); }
    return map[action](p);
  } catch (e) { return { error: e.message }; }
  finally { if (lock) lock.releaseLock(); }
}

// ═══════════════════════════════════════════════
// v1.45 薪資修正（2026-11-14，第 1 版）— 只動後端，前端不變
// 放在 v1.44 模組之後、路由 v1.44 之前（位置只要在原本 pay3 模組之後即可；本檔不改路由）。
// 1. 假日／活動出勤獎金：原本寫 P['假日出勤獎金'] || 500，參數填 0 會被當成「沒填」又變回 500。
//    改成：〈參數設定〉有這一列就照填的數字（0 就是 0），沒有這一列才用 500。
//    平日活動改讀「活動出勤獎金」（沒有這列時沿用假日出勤獎金）。
// 2. 打卡時數以整點／半點為準（隊長 11/14）：上班時間往後取整點或半點、下班時間往前取整點或半點
//    （例：09:52 上班 → 10:00；19:10 下班 → 19:00；共 9 小時）。
//    12 月新規則也一樣：遲到超過寬限時，上班時間往後取；早退超過寬限時，下班時間往前取；活動依打卡也對齊。
// 覆蓋：pay3_pairHours_、pay3_compute_（以第 44 版全文為底，只改假日獎金、遲到、早退三處，都標了 v1.45）。
// 沒有覆蓋任何第 3 節（部署端修正）的函式。
// ═══════════════════════════════════════════════
var V45_HALF = 1800000;   // 30 分鐘（台灣時區 +8 小時是 30 分鐘的倍數，直接以毫秒對齊即可）
function v45_holAmt_(P, weekdayAct) {
  var has = function (k) { return Object.prototype.hasOwnProperty.call(P, k); };
  var hol = has('假日出勤獎金') ? (Number(P['假日出勤獎金']) || 0) : 500;
  if (weekdayAct && has('活動出勤獎金')) return Number(P['活動出勤獎金']) || 0;
  return hol;
}
// 一組打卡 → 依上下班配對出的時數（同一個地點）；上班往後、下班往前對齊整點／半點
function pay3_pairHours_(ps) {
  var h = 0, open = null, first = null;
  ps.slice().sort(function (a, b) { return a.t - b.t; }).forEach(function (x) {
    if (x.type === '上班') { open = x; if (first === null) first = x.t; }
    else if (x.type === '下班' && open) {
      var st = Math.ceil(open.t / V45_HALF) * V45_HALF, en = Math.floor(x.t / V45_HALF) * V45_HALF;
      h += Math.max(0, (en - st) / 3600000); open = null;
    }
  });
  return { hrs: h, first: first };
}
function pay3_compute_(ym, opt) {
  opt = opt || {};
  var ss = pay3_ss_(), P = getParams(), cal = getCalendar(), locs = pay3_locAlias_(getLocations());
  var wage = P['基準時薪'] || 196, targetMonth = parseInt(ym.slice(5), 10), FEST = [1, 6, 9];
  var newRule = ym >= pay3_ruleStart_(), grace = (Number(pay3_rawParam_('遲到早退寬限分鐘', 15)) || 15) * 60000;
  var cutoff = opt.cutoff || '9999-12-31';
  var staffV = ss.getSheetByName('夥伴資料').getDataRange().getValues(), head = staffV[0] || [];
  var iType = -1, iMng = 46; head.forEach(function (h, i) { h = String(h).trim(); if (h === '帳號類型') iType = i; if (/負責櫃位/.test(h)) iMng = i; });
  var staff = {}; for (var si = 1; si < staffV.length; si++) { var id0 = String(staffV[si][0]).trim(); if (id0) staff[id0] = staffV[si]; }
  var cum = ss.getSheetByName('累計工時').getDataRange().getValues();
  var dec = newRule ? pay3_decisions_() : {};
  var isAct = function (loc) { return /活動/.test((locs[loc] || {}).kind || ''); };
  var isFr = function (loc) { return /加盟/.test((locs[loc] || {}).kind || ''); };

  // 打卡（含歷史）
  var punches = {};
  ['打卡紀錄_歷史', '打卡紀錄'].forEach(function (n) {
    var sh = ss.getSheetByName(n); if (!sh || sh.getLastRow() < 2) return;
    sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(17, Math.min(sh.getLastColumn(), 17))).getValues().forEach(function (r) {
      var eid = String(r[2]).trim(); if (!eid) return;
      var flag = String(r[16] || '');
      if (flag.indexOf('異常未下班') >= 0 && flag.indexOf('已由管理員補登') < 0) return;
      var t = r[6] ? new Date(r[6]) : null; if (!t || isNaN(t)) return;
      var d = Utilities.formatDate(t, 'Asia/Taipei', 'yyyy-MM-dd');
      if (d.slice(0, 7) !== ym || d > cutoff) return;
      if (opt.only && eid !== opt.only) return;
      var k = eid + '|' + d;
      (punches[k] = punches[k] || []).push({ type: String(r[5]).trim(), t: t.getTime(), loc: String(r[9] || '').trim() });
    });
  });

  // 計薪「段」：{ empId, date, loc, hrs, first, note }
  var segs = [], pending = [], flags = {};
  var addFlag = function (eid, txt) { (flags[eid] = flags[eid] || []).push(txt); };
  if (!newRule) {
    Object.keys(punches).forEach(function (k) {
      var a = k.split('|'), byLoc = {};
      punches[k].forEach(function (x) { (byLoc[x.loc] = byLoc[x.loc] || []).push(x); });
      Object.keys(byLoc).forEach(function (loc) {
        var r = pay3_pairHours_(byLoc[loc]); if (!r.hrs) return;
        segs.push({ empId: a[0], date: a[1], loc: loc, hrs: r.hrs, first: r.first, how: '打卡' });
      });
    });
  } else {
    SCH_C_ = {};
    var plan = sch_readShifts_(ym).rows.filter(function (s) { return s.date <= cutoff && (!opt.only || s.empId === opt.only); });
    var planned = {};
    plan.forEach(function (s) { (planned[s.empId + '|' + s.date] = planned[s.empId + '|' + s.date] || []).push(s); });
    var keys = {}; Object.keys(planned).forEach(function (k) { keys[k] = 1; }); Object.keys(punches).forEach(function (k) { keys[k] = 1; });
    Object.keys(keys).forEach(function (k) {
      var a = k.split('|'), eid = a[0], d = a[1], ps = punches[k] || [], used = {};
      var name = staff[eid] ? String(staff[eid][1]) : eid;
      (planned[k] || []).forEach(function (s) {
        if (isAct(s.loc)) return;                       // 活動：依打卡（下面處理）
        used[pay3_code_(s.loc)] = 1;
        var mine = ps.filter(function (x) { return !x.loc || pay3_same_(x.loc, s.loc); });
        var ins = mine.filter(function (x) { return x.type === '上班'; }).sort(function (x, y) { return x.t - y.t; });
        var outs = mine.filter(function (x) { return x.type === '下班'; }).sort(function (x, y) { return x.t - y.t; });
        var ps0 = pay3_t_(d, s.start), pe0 = pay3_t_(d, s.end); if (pe0 <= ps0) pe0 += 86400000;
        var key = d + '|' + eid + '|' + s.loc, planH = (pe0 - ps0) / 3600000;
        if (!ins.length && !outs.length) {
          var dn = dec[key + '|無打卡'];
          if (dn && dn.result === '缺勤') return;
          segs.push({ empId: eid, date: d, loc: s.loc, hrs: planH, first: ps0, how: '排班（無打卡）' });
          if (!dn) { addFlag(eid, d.slice(5) + ' 無打卡'); pending.push({ key: key + '|無打卡', type: '無打卡', date: d, empId: eid, name: name, loc: s.loc, plan: s.start + '–' + s.end, planH: planH, actual: '—', suggest: planH }); }
          return;
        }
        var st = ps0, en = pe0, note = [];
        if (ins.length && ins[0].t > ps0 + grace) { st = Math.ceil(ins[0].t / V45_HALF) * V45_HALF;   // v1.45：遲到往後取整點／半點
          note.push('遲到 ' + Math.round((ins[0].t - ps0) / 60000) + ' 分'); }
        if (outs.length) {
          var lo = outs[outs.length - 1].t;
          if (lo < pe0 - grace) { en = Math.floor(lo / V45_HALF) * V45_HALF;   // v1.45：早退往前取整點／半點
             note.push('早退 ' + Math.round((pe0 - lo) / 60000) + ' 分'); }
          var extra = Math.floor((lo - pe0) / 1800000) * 0.5;        // 往前取最近的整點或半點
          if (extra >= 0.5) {
            var dk = key + '|加班', dv = dec[dk];
            if (dv && dv.result === '核准') { en = pe0 + dv.hours * 3600000; note.push('加班 ' + dv.hours + 'h（已核准）'); }
            else if (!dv) { addFlag(eid, d.slice(5) + ' 加班 ' + extra + 'h 待核准'); pending.push({ key: dk, type: '加班', date: d, empId: eid, name: name, loc: s.loc, plan: s.start + '–' + s.end, planH: planH, actual: pay3_hhmm_(lo) + ' 下班', suggest: extra }); }
          }
        } else { note.push('未打下班卡，依排班'); addFlag(eid, d.slice(5) + ' 未打下班卡'); }
        var h = Math.max(0, (en - st) / 3600000);
        if (h > 0) segs.push({ empId: eid, date: d, loc: s.loc, hrs: h, first: st, how: note.join('、') || '準時' });
      });
      // 打卡但不在排班內的地點：活動依打卡；其他＝臨時支援，核准後才算
      var byLoc = {};
      ps.forEach(function (x) { if (x.loc ? !used[pay3_code_(x.loc)] : !Object.keys(used).length) (byLoc[x.loc] = byLoc[x.loc] || []).push(x); });
      Object.keys(byLoc).forEach(function (loc) {
        var r = pay3_pairHours_(byLoc[loc]); if (!r.hrs) return;
        if (isAct(loc) || !loc) { segs.push({ empId: eid, date: d, loc: loc, hrs: r.hrs, first: r.first, how: '活動（依打卡）' }); return; }
        var dk = d + '|' + eid + '|' + loc + '|臨時支援', dv = dec[dk];
        if (dv && dv.result === '核准') segs.push({ empId: eid, date: d, loc: loc, hrs: r.hrs, first: r.first, how: '臨時支援（已核准）' });
        else if (!dv) { addFlag(eid, d.slice(5) + ' 沒排班有打卡 待核准'); pending.push({ key: dk, type: '臨時支援', date: d, empId: eid, name: name, loc: loc, plan: '—', planH: 0, actual: Math.round(r.hrs * 10) / 10 + 'h', suggest: Math.round(r.hrs * 10) / 10 }); }
      });
    });
  }

  // 櫃位每日工時、人數（假日獎金分攤、業績門檻人數、團體獎金比例）
  var locDayHours = {}, locDayCount = {}, locMonthHours = {}, empLocHours = {}, seen = {};
  segs.forEach(function (s) {
    var k = s.date + '_' + s.loc;
    locDayHours[k] = (locDayHours[k] || 0) + s.hrs;
    if (!seen[k + s.empId]) { locDayCount[k] = (locDayCount[k] || 0) + 1; seen[k + s.empId] = 1; }
    locMonthHours[s.loc] = (locMonthHours[s.loc] || 0) + s.hrs;
    empLocHours[s.empId + '_' + s.loc] = (empLocHours[s.empId + '_' + s.loc] || 0) + s.hrs;
  });
  // 業績
  var calcRev = function (loc, rev) {
    var lc = locs[loc] || {};
    if (lc.type === 'A百貨') return rev * 0.8;
    if (lc.type === 'C份數') return rev * (lc.unitPrice || P['C類預設抽成'] || 70);
    return rev;
  };
  var dayRevenue = {};
  ['收店盤點_歷史', '收店盤點'].forEach(function (n) {
    var sh = ss.getSheetByName(n); if (!sh || sh.getLastRow() < 2) return;
    sh.getRange(2, 1, sh.getLastRow() - 1, Math.min(sh.getLastColumn(), 31)).getValues().forEach(function (r) {
      if (!r[1]) return;
      var d = Utilities.formatDate(new Date(r[1]), 'Asia/Taipei', 'yyyy-MM-dd');
      if (d.slice(0, 7) !== ym || d > cutoff) return;
      var tot = r[30] !== '' && r[30] !== undefined ? parseFloat(r[30]) : parseFloat(r[16]) || 0;
      dayRevenue[d + '_' + String(r[5])] = tot || 0;
    });
  });
  var locRev = {}, locDays = {}, groupPool = {}, groupEq = {};
  Object.keys(dayRevenue).forEach(function (k) { var loc = k.slice(11), c = calcRev(loc, dayRevenue[k]); if (!c) return; locRev[loc] = (locRev[loc] || 0) + c; locDays[loc] = (locDays[loc] || 0) + 1; });
  Object.keys(locRev).forEach(function (loc) { var eq = locRev[loc] / locDays[loc] * 30; groupEq[loc] = eq; if (eq > (P['團體獎金門檻'] || 200000)) groupPool[loc] = locRev[loc] * 0.01; });

  // 逐人
  var bySeg = {}; segs.forEach(function (s) { (bySeg[s.empId] = bySeg[s.empId] || []).push(s); });
  var emps = {}, tier = function (c) { return c > 4320 ? 2400 : c > 2160 ? 1200 : 600; };
  var salSh = ss.getSheetByName('薪資明細'), salEx = salSh ? salSh.getDataRange().getValues() : [];
  Object.keys(bySeg).forEach(function (empId) {
    var emp = staff[empId]; if (!emp) return;
    if (emp[10] && !opt.only) return;                   // 已離職（與原引擎相同）
    var type = iType >= 0 ? String(emp[iType] || '').trim() : '';
    if (/合作/.test(type)) return;
    var home = String(emp[38] || ''), birthday = pay3_bday_(emp[4]);
    var laborSt = String(emp[41] || '公司投保'), healthSt = String(emp[42] || '公司投保'), deps = parseInt(emp[27]) || 0;
    var cumHrs = 0; for (var i = cum.length - 1; i >= 1; i--) if (String(cum[i][0]) === empId) { cumHrs = parseFloat(cum[i][6]) || 0; break; }
    var basic = 0, ot1 = 0, ot2 = 0, ot3 = 0, dblPay = 0, holBonus = 0, perfBonus = 0, group = 0, normalH = 0, holH = 0;
    var locSet = {}, perfAwarded = {}, days = [], byDay = {};
    bySeg[empId].forEach(function (s) { (byDay[s.date] = byDay[s.date] || []).push(s); });
    Object.keys(byDay).sort().forEach(function (date) {
      var list = byDay[date]; list.sort(function (a, b) { return a.first - b.first; });
      var off = 0;
      list.forEach(function (s) {
        var lc = locs[s.loc] || {}; locSet[s.loc] = 1;
        var dt = getDayType(s.date, lc.county || '', home, cal);
        var h = s.hrs, a = off, z = off + h;
        var seg = function (lo, hi) { return Math.max(0, Math.min(z, hi) - Math.max(a, lo)); };
        var b = seg(0, 8) * wage, o1 = seg(8, 10) * wage * 1.33, o2 = seg(10, 12) * wage * 1.67, o3 = seg(12, 999) * wage * 2;
        off = z;
        var row = { date: s.date, loc: s.loc, hrs: Math.round(h * 100) / 100, how: s.how, dayType: dt, pay: 0, holBonus: 0, perf: 0, rev: null };
        if (dt === '國定假日' || dt === '颱風日') { dblPay += b + o1 + o2 + o3; holH += h; row.pay = (b + o1 + o2 + o3) * 2; }
        else { basic += b; ot1 += o1; ot2 += o2; ot3 += o3; normalH += h; row.pay = b + o1 + o2 + o3; }
        if (dt === '假日' || dt === '連假日' || (lc.kind === '活動' && dt === '平日')) {
          var tot = locDayHours[s.date + '_' + s.loc] || h, hb = CEIL(v45_holAmt_(P, lc.kind === '活動' && dt === '平日') / tot * h);   // v1.45：參數填 0 就真的是 0
          holBonus += hb; row.holBonus = hb;
        }
        var ak = s.date + '_' + s.loc;
        if (!perfAwarded[ak]) {
          var rev = dayRevenue[ak];
          if (rev !== undefined) {
            var cv = calcRev(s.loc, rev), th = perfBonusTable(locDayCount[ak] || 1, P), pb = 0;
            if (cv >= th[2]) pb = 1000; else if (cv >= th[1]) pb = 700; else if (cv >= th[0]) pb = 500;
            perfBonus += pb; row.perf = pb; row.rev = Math.round(cv);
            row.next = pb >= 1000 ? 0 : Math.ceil((pb >= 700 ? th[2] : pb >= 500 ? th[1] : th[0]) - cv);
          }
          perfAwarded[ak] = 1;
        }
        row.pay = CEIL(row.pay); days.push(row);
      });
    });
    var groupNotes = [];
    Object.keys(locSet).forEach(function (loc) {
      if (groupPool[loc] && locMonthHours[loc]) group += groupPool[loc] * (empLocHours[empId + '_' + loc] || 0) / locMonthHours[loc];
      else if (groupEq[loc]) groupNotes.push(loc + ' 月換算業績目前約 ' + Math.round(groupEq[loc]).toLocaleString() + '，超過 ' + (P['團體獎金門檻'] || 200000).toLocaleString() + ' 才有團體獎金');
    });
    var totalH = normalH + holH;
    basic = CEIL(basic); ot1 = CEIL(ot1); ot2 = CEIL(ot2); ot3 = CEIL(ot3); dblPay = CEIL(dblPay * 2); group = CEIL(group);
    var basicTotal = basic + ot1 + ot2 + ot3 + dblPay;
    var skill = cumHrs > 180 ? CEIL(totalH * 20) : 0;
    var cl = cumHrs > 4320 ? 20 : cumHrs > 3240 ? 15 : cumHrs > 2160 ? 10 : cumHrs > 1080 ? 5 : 0;
    var contrib = CEIL(totalH * cl);
    var age = 0;
    if (birthday && !isNaN(birthday)) { var ref = new Date(ym + '-01'); age = ref.getFullYear() - birthday.getFullYear(); if (ref.getMonth() < birthday.getMonth()) age--; }
    var evergreen = age >= 50 ? CEIL(totalH * (10 + (age - 50))) : 0;   // 長青津貼：隊長 11/12 定案要發（年滿 50 歲，每小時 +(年齡−50+10)）
    var isBday = !!(birthday && !isNaN(birthday) && birthday.getMonth() + 1 === targetMonth), isFest = FEST.indexOf(targetMonth) >= 0;
    var bday = isBday ? (totalH >= 80 ? tier(cumHrs) : 200) : 0, fest = isFest ? (totalH >= 80 ? tier(cumHrs) : 200) : 0;
    var laborDed = 0, healthDed = 0, insAdd = 0;
    try {
      if (laborSt === '公司投保') laborDed = parseFloat(emp[21]) || 0;
      else insAdd += CEIL(parseFloat(getInsuranceRow(ss, empId, '勞保級距表')[3]) || 0);
      if (healthSt === '公司投保') healthDed = (parseFloat(emp[26]) || 0) * (1 + Math.min(deps, 3));
      else if (healthSt === '無投保') insAdd += CEIL(parseFloat(getInsuranceRow(ss, empId, '健保級距表')[3]) || 0);
    } catch (e) {}
    var fee = parseFloat(emp[17]) || 0, duty = 0, ri = -1;
    for (var k = 1; k < salEx.length; k++) if (String(salEx[k][2]) === empId && ymNorm(salEx[k][1]) === ym) { ri = k; duty = parseFloat(salEx[k][21]) || 0; break; }
    var gross = basicTotal + group + perfBonus + skill + contrib + evergreen + bday + fest + duty + holBonus + insAdd;
    // 加盟店：帳號類型＝加盟店夥伴，或所有工時都在加盟櫃位
    var frHours = {}, frAll = true;
    Object.keys(locSet).forEach(function (l) { if (isFr(l)) frHours[l] = empLocHours[empId + '_' + l] || 0; else if (l) frAll = false; });
    var frLocs = Object.keys(frHours).sort(function (a, b) { return frHours[b] - frHours[a]; });
    var franchise = /加盟/.test(type) || (frAll && frLocs.length > 0);
    var mng = String(emp[iMng] || '');
    var franchiseLoc = franchise ? (frLocs[0] || mng.split(/[、,，\/\s;；]+/)[0] || '') : '';
    var isOwner = franchise && (parseInt(emp[12]) || 1) >= 2 && !!franchiseLoc && (mng.indexOf(franchiseLoc) >= 0 || franchiseLoc.indexOf(mng.trim()) >= 0 && mng.trim().length >= 2);
    emps[empId] = { empId: empId, name: String(emp[1]), locs: Object.keys(locSet), normalH: normalH, holH: holH, totalH: Math.round(totalH * 100) / 100,
      basic: basic, ot1: ot1, ot2: ot2, ot3: ot3, dblPay: dblPay, basicTotal: basicTotal, group: group, perfBonus: perfBonus, skill: skill, contrib: contrib, cl: cl,
      evergreen: evergreen, age: age, bday: bday, fest: fest, isBday: isBday, isFest: isFest, tier: tier(cumHrs), duty: duty, holBonus: holBonus, insAdd: insAdd,
      laborDed: laborDed, healthDed: healthDed, deps: deps, fee: fee, gross: gross, net: gross - laborDed - healthDed - fee, cumHrs: cumHrs, ri: ri,
      days: days, groupNotes: groupNotes, notes: flags[empId] || [], franchise: franchise, franchiseLoc: franchiseLoc, isOwner: isOwner, wage: wage };
  });
  return { ym: ym, newRule: newRule, emps: emps, pending: pending, segs: segs };
}

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

// ═══════════════════════════════════════════════
// 路由 extHandler_ v1.44（2026-11-14）
// 放在檔案最後，取代 v1.43 勞健保合併版的 extHandler_（Apps Script 以檔案中最後一個同名函式為準）。
// 與前一版的差別：v42Handler_ 之前加 v44Handler_（心情簽到、敲門、客人讚美、排行榜、飯堂；
//   接手 gmScene → v42 → v41 → v40 → v39 → h36 → s30）。保留 v1.43 的 getMyIns 與 v41_wordRes_ 外層。
// ═══════════════════════════════════════════════
function extHandler_(action, p) {
  if (action === 'getMyIns') {   // v1.43（部署端合併版）照舊
    p = p || {};
    var gate = au_gate_(action, p); if (gate) return v41_wordRes_(gate);
    try { return v41_wordRes_(v43_myIns_(p)); } catch (e) { return { error: '勞健保資料錯誤:' + e.message }; }
  }
  return v41_wordRes_(v44Route_(action, p));
}
function v44Route_(action, p) {
  p = p || {};
  var gate = au_gate_(action, p); if (gate) return gate;
  var au = auHandler_(action, p); if (au) return au;
  var sec = secHandler_(action, p); if (sec) return sec;
  var op = opsHandler_(action, p); if (op) return op;
  var bu = buHandler_(action, p); if (bu) return bu;
  var rp = rpHandler_(action, p); if (rp) return rp;
  var fs = fsHandler_(action, p); if (fs) return fs;
  var v44 = v44Handler_(action, p); if (v44) return v44;
  var v42 = v42Handler_(action, p); if (v42) return v42;
  var v41 = v41Handler_(action, p); if (v41) return v41;
  var v40 = v40Handler_(action, p); if (v40) return v40;
  var v39 = v39Handler_(action, p); if (v39) return v39;
  var h36 = h36Handler_(action, p); if (h36) return h36;
  var eq = eqHandler_(action, p); if (eq) return eq;
  var qt = qtHandler_(action, p); if (qt) return qt;
  var s30 = s30Handler_(action, p); if (s30) return s30;
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

// ═══════════════════════════════════════════════
// 紅玉滿夥伴 App 後端模組 v1.47（2026-11-14）
// 貼在第 46 版「v1.46 模組」之後；檔案最後的「路由 v1.47」取代「路由 v1.44」（保留 getMyIns 與 v41_wordRes_ 外層）。
// 內容：
//   1. 通知中心 v47Notes（唯讀，通行證本人）：列出本人最近 7 天的提醒（已讀、未讀都列），不會標已讀；
//      頂端跳出照舊用 v40Notes。每則帶「誰送的」（pair 類提醒的來源鍵裡有寄件人）讓前端點了可以到對方名片。
//   2. 每天第一次有人讀通知中心時清一次（v47_clean_）：
//      〈宇宙通知〉刪掉 7 天前的列（已讀紀錄保留 7 天）；
//      Script Properties 刪掉 7 天前的每日計數鍵（gm_IDEA|… gm_PHOTO|… gm_心情提醒|…，部署交接第 8 節的建議）。
// 安全：v47Notes 用 v39_me_()（au_verifiedId_，沒有通行證就擋）；不覆蓋任何部署端修正的函式。
// 不用 setup。
// ═══════════════════════════════════════════════
var V47_KEEP_DAYS = 7;
function v47_ts_(v) { var d = v instanceof Date ? v : new Date(String(v).replace(' ', 'T') + (/[+Z]/.test(String(v).slice(10)) ? '' : '+08:00')); return isNaN(d) ? 0 : d.getTime(); }
function v47_notes_(p) {
  var me = v39_me_();
  try { v47_clean_(); } catch (e) {}
  var since = gm_addDays_(v40_today_(), -(V47_KEEP_DAYS - 1)), out = [];
  v40_rows_('宇宙通知', V40_NOTE_HEAD).forEach(function (r) {
    if (String(r[2]) !== me.id || v39_d_(r[1]) < since) return;
    var key = String(r[6] || ''), parts = key.split('|'), from = parts.length >= 4 && parts[1] === me.id ? parts[3] : '';
    if (from && !gm_emp_(from)) from = '';
    var ts = v47_ts_(r[0]);
    out.push({ ts: ts, time: ts ? Utilities.formatDate(new Date(ts), 'Asia/Taipei', 'MM/dd HH:mm') : String(r[1]).slice(5), type: String(r[3]), text: String(r[4]), from: from, read: !!r[5] });
  });
  out.sort(function (a, b) { return b.ts - a.ts; });
  return { success: true, data: out.slice(0, 150) };
}
function v47_clean_() {
  var d = v40_today_(); if (gm_getState_('v47清理日') === d) return;
  gm_setState_('v47清理日', d);
  var cut = gm_addDays_(d, -V47_KEEP_DAYS), sh = v40_s_('宇宙通知', V40_NOTE_HEAD), rows = v40_rows_('宇宙通知', V40_NOTE_HEAD);
  var keep = rows.filter(function (r) { return v39_d_(r[1]) >= cut; });
  if (keep.length < rows.length) {
    var lock = LockService.getScriptLock(); lock.waitLock(15000);
    try {
      var now = v40_rows_('宇宙通知', V40_NOTE_HEAD), drop = now.length - now.filter(function (r) { return v39_d_(r[1]) >= cut; }).length;
      if (drop > 0) {   // 舊的在最上面（依時間附加），從第 2 列開始刪掉前面連續過期的
        var n = 0; while (n < now.length && v39_d_(now[n][1]) < cut) n++;
        if (n > 0) sh.deleteRows(2, n);
      }
    } finally { lock.releaseLock(); }
  }
  var props = PropertiesService.getScriptProperties(), all = props.getKeys();
  all.forEach(function (k) {
    var m = /^gm_(IDEA|PHOTO|心情提醒)\|.*\|(\d{4}-\d{2}-\d{2})$/.exec(k);
    if (m && m[2] < cut) props.deleteProperty(k);
  });
}
AU_READ = new RegExp(AU_READ.source.replace(/\)\$$/, '|v47Notes)$'));
function v47Handler_(action, p) {
  if (action !== 'v47Notes') return null;
  try { OPS_C_ = {}; GM_CACHE_ = {}; return v47_notes_(p || {}); } catch (e) { return { error: e.message }; }
}

// ═══════════════════════════════════════════════
// 路由 extHandler_ v1.47（2026-11-14）
// 放在檔案最後，取代「路由 v1.44」。和 v1.44 的差別只有：v44Handler_ 之前加 v47Handler_（通知中心）。
// 保留 v1.43 的 getMyIns 與 v41_wordRes_ 外層。
// ═══════════════════════════════════════════════
function extHandler_(action, p) {
  if (action === 'getMyIns') {   // v1.43（部署端合併版）照舊
    p = p || {};
    var gate = au_gate_(action, p); if (gate) return v41_wordRes_(gate);
    try { return v41_wordRes_(v43_myIns_(p)); } catch (e) { return { error: '勞健保資料錯誤:' + e.message }; }
  }
  return v41_wordRes_(v47Route_(action, p));
}
function v47Route_(action, p) {
  p = p || {};
  var gate = au_gate_(action, p); if (gate) return gate;
  var au = auHandler_(action, p); if (au) return au;
  var sec = secHandler_(action, p); if (sec) return sec;
  var op = opsHandler_(action, p); if (op) return op;
  var bu = buHandler_(action, p); if (bu) return bu;
  var rp = rpHandler_(action, p); if (rp) return rp;
  var fs = fsHandler_(action, p); if (fs) return fs;
  var v47 = v47Handler_(action, p); if (v47) return v47;
  var v44 = v44Handler_(action, p); if (v44) return v44;
  var v42 = v42Handler_(action, p); if (v42) return v42;
  var v41 = v41Handler_(action, p); if (v41) return v41;
  var v40 = v40Handler_(action, p); if (v40) return v40;
  var v39 = v39Handler_(action, p); if (v39) return v39;
  var h36 = h36Handler_(action, p); if (h36) return h36;
  var eq = eqHandler_(action, p); if (eq) return eq;
  var qt = qtHandler_(action, p); if (qt) return qt;
  var s30 = s30Handler_(action, p); if (s30) return s30;
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

// ═══════════════════════════════════════════════
// 紅玉滿夥伴 App 後端模組 v1.48（2026-11-14）安全修正
// 貼在第 47 版檔案的最後面（路由 v1.47 之後）。本檔最後的 extHandler_ 會取代 v1.47 的 extHandler_（同名以最後為準），
// v1.47 的 v47Route_ 要保留（本檔會呼叫它）；getMyIns 與 v41_wordRes_ 外層照舊。
// 依《v1.48修改需求_20261114_v1》第一節：
//   1-1 gmScene、getOnDutyCrew、getOrders 一律要有效通行證（不管登入驗證是不是「強制」）。
//   1-2 舊功能改用通行證本人：getSalary、getStaffInfo、getAdminDashboard、schBoard、opsStaffList、訂單
//       （saveOrder、setOrderStatus）—— 一律要有效通行證，而且把 empId／managerId 換成通行證本人，
//       舊程式（含 doGet 裡的 getSalary 等）拿到的就是本人，不能再改編號看別人。
//       大隊長「隊員視角」（viewAs）照舊由 au_gate_ 檢查與換人。
//   1-3 訂單依櫃位過濾（od_get_ 覆蓋）：
//       Lv.3 以上：全部。合作夥伴：不回傳。加盟店夥伴：只看自己的店（負責櫃位＋今天上班的櫃位）。
//       總部 Lv.2：負責櫃位＋今天上班的櫃位。總部 Lv.1：今天上班的櫃位。自己建的訂單一律看得到。
//       看不到的櫃位只回「筆數」（others），不回客人姓名、電話；
//       宇宙辦公室「待取貨」改用 pickup（各櫃位今天未交付的自取筆數，只回數字）。
// 不用 setup。沒有覆蓋第 3 節的部署端修正。
// ═══════════════════════════════════════════════
var V48_MUST = { gmScene: 1, getOnDutyCrew: 1, getOrders: 1, saveOrder: 1, setOrderStatus: 1,
  getSalary: 1, getStaffInfo: 1, getAdminDashboard: 1, schBoard: 1, opsStaffList: 1 };
function v48_gate_(action, p) {
  if (!V48_MUST[action]) return null;
  var tok = p.token, tid = au_tokenId_(tok);
  if (!tok || !tid || !sec_verifyToken_(tok, tid)) { try { au_log_('v48block', action); } catch (e) {} return { error: '請重新登入（App 已更新）', relogin: true }; }
  if (!p.viewAs) {   // 一律以通行證本人為準（viewAs 由 au_gate_ 檢查大隊長身分後換人）
    p.empId = tid;
    if (p.managerId !== undefined && p.managerId !== '') p.managerId = tid;
  }
  return null;
}

// ── 訂單依櫃位過濾 ──
function v48_orderScope_(me) {   // null＝全部；[]＝都不行
  if (me.type === '合作夥伴') return [];
  if (me.role >= 3) return null;
  var locs = [], duty = '';
  try { duty = v40_dutyMap_()[me.id] || ''; } catch (e) {}
  if (duty) locs.push(duty);
  if (me.role >= 2 || me.type === '加盟店夥伴') ops_myLocs_(me).forEach(function (n) { if (locs.indexOf(n) < 0) locs.push(n); });
  return locs;
}
function v48_inScope_(scope, loc) { return scope === null || scope.some(function (n) { return ops_sameLoc_(n, loc); }); }
function od_get_(p) {
  var me = ops_me_(p.empId);
  var today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
  var from = /^\d{4}-\d{2}-\d{2}$/.test(p.from || '') ? p.from : today;
  var to = /^\d{4}-\d{2}-\d{2}$/.test(p.to || '') ? p.to : Utilities.formatDate(new Date(Date.now() + 14 * 86400000), 'Asia/Taipei', 'yyyy-MM-dd');
  var back = Utilities.formatDate(new Date(Date.now() - 30 * 86400000), 'Asia/Taipei', 'yyyy-MM-dd');
  var scope = v48_orderScope_(me), staff = me.type !== '合作夥伴' && me.type !== '加盟店夥伴';
  var v = od_sheet_().getDataRange().getValues(), out = [], others = {}, pickup = {}, lead = od_isLead_(me.role);
  for (var i = 1; i < v.length; i++) {
    var d = String(v[i][2]), st = v[i][16], loc = String(v[i][1]);
    var open = st === '新訂單' || st === '製作中' || st === '已完成';
    if (d === today && open && v[i][7] !== '外送' && (staff || v48_inScope_(scope, loc))) pickup[loc] = (pickup[loc] || 0) + 1;
    if (!((d >= from && d <= to) || (open && d < from && d >= back))) continue;
    if (v48_inScope_(scope, loc) || String(v[i][20]) === me.id) out.push(od_rowToObj_(v[i], lead));
    else if (staff && open) others[loc] = (others[loc] || 0) + 1;
  }
  out.sort(function (a, b) { return (a.date + a.time) < (b.date + b.time) ? -1 : 1; });
  return { success: true, data: out, scope: scope === null ? 'all' : scope,
    others: Object.keys(others).map(function (k) { return { loc: k, n: others[k] }; }), pickup: pickup };
}

// ═══════════════════════════════════════════════
// 路由 extHandler_ v1.48（2026-11-14）
// 放在檔案最後，取代 v1.47 的 extHandler_（v47Route_ 保留）。和 v1.47 的差別只有：最前面先過 v48_gate_（上面清單裡的動作一定要有效通行證）。
// 保留 v1.43 的 getMyIns 與 v41_wordRes_ 外層；其餘照舊交給 v47Route_。
// ═══════════════════════════════════════════════
function extHandler_(action, p) {
  p = p || {};
  var g48 = v48_gate_(action, p); if (g48) return v41_wordRes_(g48);
  if (action === 'getMyIns') {   // v1.43（部署端合併版）照舊
    var gate = au_gate_(action, p); if (gate) return v41_wordRes_(gate);
    try { return v41_wordRes_(v43_myIns_(p)); } catch (e) { return { error: '勞健保資料錯誤:' + e.message }; }
  }
  return v41_wordRes_(v47Route_(action, p));
}

// ═══════════════════════════════════════════════
// 紅玉滿夥伴 App 後端模組 v1.49（2026-11-14）依身分過濾＋合作品牌加入樂園
// 貼在 v1.48 檔案的最後面。本檔最後的 extHandler_ 取代 v1.48 的 extHandler_（同名以最後為準）；
// v48_gate_、v47Route_ 要保留（本檔會呼叫）。依《v1.48修改需求_20261114_v1》第二～四節、隊長 11/14 21:09 六項決定。
//
// 「外部帳號」＝帳號類型「加盟店夥伴」或「合作夥伴」、Lv.2 以下。他們的「本店」＝負責櫃位＋今天上班的櫃位。
//   F5 總部營業額完全看不到、加盟店不互看：gmScene 的 liveRev、跑馬燈營業額訊息、里程碑煙火、v39Rev／v39RevBoard 回傳，只留本店；
//      提醒（v40Notes、v47Notes）不送「里程碑」「被超車」；櫃位爭霸戰（tdMe、tdGive）擋下。
//   F6 麵糊存量（getBatterStock）、缺貨（getShortages）只回本店；工廠看板只留總數（不列各櫃位）。
//   F7 行事曆（calList、首頁待辦）只看「全公司活動」類別（新增這個類別，Lv.3 以上建立活動時可以選）。
//   F2 排班（schBoard）：加盟主只回本店班表與排過本店的人。F3 隊員名單（opsStaffList）：只回本店的人。
//   F4／L2c 設備清單（覆蓋 eq_canSee_）：Lv.3 以上全部；Lv.2 只看負責櫃位的清單；其他只看被排進或自己建的。
//   L2b 總部 Lv.2 的隊員名單：手機只給負責櫃位排過班的人（其他人只有姓名）。L2a 總部 Lv.2 班表照舊全看得到（決定 6）。
//   福利補助（bfApply）只接受帳號類型「員工」（決定 4）。
//   合作品牌：不能開小店（spOpen）；每月 1 日起第一次打開樂園就發〈遊戲參數〉「合作品牌每月配額」（預設 150 枚，決定 5）。
// 安全：上面會用到身分的動作都先過 v48_gate_（加進必須通行證的清單），一律以通行證本人判斷。沒有覆蓋部署端修正的函式。
// 執行一次 v49_setup()：〈遊戲參數〉加「合作品牌每月配額」150。
// ═══════════════════════════════════════════════
['getBatterStock', 'getShortages', 'tdMe', 'tdGive', 'calList', 'v39RevBoard', 'homeTodo', 'eqList'].forEach(function (a) { V48_MUST[a] = 1; });
if (CAL_CATS.indexOf('全公司活動') < 0) CAL_CATS.push('全公司活動');

function v49_viewer_(p) {
  var tid = au_tokenId_(p.token); if (!tid || !sec_verifyToken_(p.token, tid)) return null;
  var id = tid; if (p.viewAs && au_role_(tid) >= 5) id = String(p.viewAs);
  try { return ops_me_(id); } catch (e) { return null; }
}
function v49_isExt_(me) { return !!me && me.role < 3 && (me.type === '合作夥伴' || me.type === '加盟店夥伴'); }
function v49_own_(me) {
  var locs = ops_myLocs_(me).slice();
  try { var d = v40_dutyMap_()[me.id]; if (d && locs.indexOf(d) < 0) locs.push(d); } catch (e) {}
  return locs;
}
function v49_in_(locs, loc) { loc = String(loc || ''); return !!loc && locs.some(function (n) { return ops_sameLoc_(n, loc); }); }
function v49_peopleAt_(locs) {   // 排過這些櫃位的人＋負責這些櫃位的人
  var ids = {};
  try { sch_readShifts_('').rows.forEach(function (r) { if (v49_in_(locs, r.loc)) ids[r.empId] = 1; }); } catch (e) {}
  ops_staff_().list.forEach(function (x) { if (x.role < 3 && !x.left && ops_myLocs_(x).some(function (n) { return v49_in_(locs, n); })) ids[x.id] = 1; });
  return ids;
}
var V49_REV_TYPES = /^(rev|milestone|overtake)$/;

// ── 行事曆：外部帳號只看「全公司活動」 ──
function v49_calFilter_(emp, list) { var me = null; try { me = ops_me_(emp); } catch (e) {} return v49_isExt_(me) ? list.filter(function (x) { return x.cat === '全公司活動'; }) : list; }
function cal_todayTodo_(emp) {
  var out = [], today = gm_today_(), tmr = gm_addDays_(today, 1);
  try {
    var r = cal_list_({ empId: emp, from: today, to: tmr });
    v49_calFilter_(emp, r.data).forEach(function (x) { out.push({ icon: x.src === 'personal' ? '🔒' : '📅', text: (x.date === today ? '今天' : '明天') + (x.start ? ' ' + x.start : '') + '【' + x.cat + '】' + x.title, tab: 'calendar', red: false }); });
  } catch (e) {}
  return out;
}

// ── 設備清單 ──
function eq_canSee_(me, L) {
  if (me.role >= 3 || L.crew.indexOf(me.id) >= 0 || L.by === me.id) return true;
  return me.role >= 2 && v49_in_(ops_myLocs_(me), L.loc);
}

// ── 合作品牌每月配額 ──
function v49_quota_(me) {
  if (!me || me.type !== '合作夥伴' || gm_isFrozen_(me.id)) return;
  var ym = gm_today_().slice(0, 7), n = Math.max(0, Math.round(v42_n_('合作品牌每月配額', 150)));
  if (n) gm_credit_(me.id, '合作品牌每月配額', n, '合作品牌每月配額 ' + ym, 'PQ|' + me.id + '|' + ym);
}
function v49_setup() {
  var have = {}; gm_rows_('params').forEach(function (r) { have[String(r[0]).trim()] = 1; });
  if (!have['合作品牌每月配額']) gm_append_('params', [['合作品牌每月配額', 150, 'v1.49：合作品牌每月 1 日起第一次打開樂園時發的赤心幣']]);
  Logger.log('v1.49 setup 完成'); return 'ok';
}

// ── 回傳後過濾 ──
function v49_filter_(action, p, r, me) {
  if (!r || r.error || !me) return r;
  var ext = v49_isExt_(me);
  if (action === 'gmScene' && r.data && ext) {
    var own = v49_own_(me), d = r.data;
    d.liveRev = (d.liveRev || []).filter(function (x) { return v49_in_(own, x.loc); });
    d.ticker = (d.ticker || []).filter(function (x) { return !V49_REV_TYPES.test(x.type) || v49_in_(own, x.loc); });
    d.celebrate = (d.celebrate || []).filter(function (x) { return v49_in_(own, x.loc); });
    if (d.boards && d.boards.factory) d.boards.factory.byLoc = [];
    d.scope = 'own'; d.ownLocs = own;
  }
  if ((action === 'v39Rev' || action === 'v39RevBoard') && ext && Array.isArray(r.data)) { var o2 = v49_own_(me); r.data = r.data.filter(function (x) { return v49_in_(o2, x.loc); }); r.scope = 'own'; }
  if (action === 'getBatterStock' && ext && Array.isArray(r.data)) { var o3 = v49_own_(me); r.data = r.data.filter(function (x) { return v49_in_(o3, x.loc); }); }
  if (action === 'getShortages' && ext && Array.isArray(r.data)) { var o4 = v49_own_(me); r.data = r.data.filter(function (x) { return v49_in_(o4, x.location); }); }
  if ((action === 'v40Notes' || action === 'v47Notes') && ext && Array.isArray(r.data)) r.data = r.data.filter(function (x) { return x.type !== 'milestone' && x.type !== 'overtake'; });
  if (action === 'calList' && Array.isArray(r.data) && ext) r.data = r.data.filter(function (x) { return x.cat === '全公司活動'; });
  if (action === 'schBoard' && ext && me.type === '加盟店夥伴') {
    var o5 = v49_own_(me), ppl = v49_peopleAt_(o5); ppl[me.id] = 1;
    r.shifts = (r.shifts || []).filter(function (x) { return v49_in_(o5, x.loc); });
    r.staff = (r.staff || []).filter(function (x) { return ppl[x.id]; });
    ['avail', 'stats'].forEach(function (k) { if (r[k] && typeof r[k] === 'object' && !Array.isArray(r[k])) Object.keys(r[k]).forEach(function (id) { if (!ppl[id]) delete r[k][id]; }); });
    if (Array.isArray(r.issues)) r.issues = r.issues.filter(function (x) { return !x || !x.loc || v49_in_(o5, x.loc); });
  }
  if (action === 'opsStaffList' && !r.full && Array.isArray(r.data)) {
    var o6 = ops_myLocs_(me), ppl2 = v49_peopleAt_(o6); ppl2[me.id] = 1;
    if (ext) r.data = r.data.filter(function (x) { return ppl2[x.id]; });
    else r.data.forEach(function (x) { if (!ppl2[x.id]) x.phone = ''; });   // 總部 Lv.2：負責櫃位以外的人只有姓名
  }
  return r;
}

// ═══════════════════════════════════════════════
// 路由 extHandler_ v1.49（2026-11-14）
// 放在檔案最後，取代 v1.48 的 extHandler_。順序：v48_gate_（必須通行證）→ 擋下不開放的動作 → v47Route_ → 依身分過濾回傳。
// 保留 getMyIns 與 v41_wordRes_ 外層。
// ═══════════════════════════════════════════════
function extHandler_(action, p) {
  p = p || {};
  var g48 = v48_gate_(action, p); if (g48) return v41_wordRes_(g48);
  if (action === 'getMyIns') {   // v1.43（部署端合併版）照舊
    var gate = au_gate_(action, p); if (gate) return v41_wordRes_(gate);
    try { return v41_wordRes_(v43_myIns_(p)); } catch (e) { return { error: '勞健保資料錯誤:' + e.message }; }
  }
  var me = /^(gmScene|gmMe|v39Rev|v39RevBoard|getBatterStock|getShortages|v40Notes|v47Notes|calList|schBoard|opsStaffList|tdMe|tdGive|bfApply|spOpen)$/.test(String(action)) ? v49_viewer_(p) : null;
  if (me) {
    if ((action === 'tdMe' || action === 'tdGive') && v49_isExt_(me)) return v41_wordRes_({ error: '櫃位爭霸戰只限總部櫃位' });
    if (action === 'bfApply' && me.type !== '員工') return v41_wordRes_({ error: '福利補助只給總部員工；加盟店的福利請洽加盟主' });
    if (action === 'spOpen' && me.type === '合作夥伴') return v41_wordRes_({ error: '合作品牌帳號不開小店，可以逛隊員商店街購買' });
    if (action === 'gmMe' || action === 'gmScene') { try { v49_quota_(me); } catch (e) {} }
  }
  var r = v47Route_(action, p);
  try { r = v49_filter_(action, p, r, me); } catch (e) {}
  return v41_wordRes_(r);
}
// ═══════════════════════════════════════════════
// v1.51 模組（2026-11-15，第 2 版）：隊長室願景白板、Bug 回報區、合作夥伴牆（第 2 版新增）
// 放在第 48 版最後的「路由 v1.49」之前或之後皆可（新的路由 extHandler_ v1.51 放在最後）。
// 沒有覆蓋既有函式。新增分頁〈願景白板〉、〈Bug回報〉、〈合作夥伴牆〉、〈合作夥伴照片〉，雲端資料夾〈Bug回報截圖（不公開）〉、〈合作夥伴照片（不公開）〉
// 〈遊戲參數〉新增：Bug回報獎勵（預設 5）
// ═══════════════════════════════════════════════

// ───────── 1. 隊長室願景白板 ─────────
// 6 塊白板：全公司隊員都看得到（加盟、合作品牌帳號除外）；只有大隊長能新增／修改／刪除；隊員可以留建議（顯示姓名）
var V51_BOARDS = [
  ['spectrum', '🌈 光譜集團計劃'], ['newbiz', '🚀 新事業'], ['rd', '🛠️ 構想研發'],
  ['ip', '🦖 紅玉滿 IP 宇宙'], ['merch', '🎁 紅玉滿文創周邊'], ['candy', '🍬 古早味糖果・伴手禮']
];
var V51_SPEC = [['red', '紅', '紅玉滿赤心雞蛋糕'], ['orange', '橙', '澄司吐司'], ['yellow', '黃', ''], ['green', '綠', ''], ['blue', '藍', ''], ['indigo', '靛', ''], ['violet', '紫', '']];
var V51_STATUS = ['構想中', '規劃中', '進行中', '已完成'];
var V51_VS_HEAD = ['時間', '白板', '分區', '類型', '內容', '狀態', '員工編號', '姓名', '編號', '排序', '刪除', '修改時間'];
function v51_bid_(v) { v = String(v || ''); return V51_BOARDS.some(function (b) { return b[0] === v; }) ? v : ''; }
function v51_sec_(board, v) { v = String(v || ''); return board === 'spectrum' && V51_SPEC.some(function (x) { return x[0] === v; }) ? v : ''; }
function v51_vrows_() {
  var sh = v42_s_('願景白板', V51_VS_HEAD), n = sh.getLastRow(); if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, V51_VS_HEAD.length).getValues().map(function (r, i) {
    return { row: i + 2, time: v42_hm_(r[0]), board: String(r[1]), sec: String(r[2] || ''), kind: String(r[3]), text: String(r[4] || ''), status: String(r[5] || ''),
             by: String(r[6] || ''), name: String(r[7] || ''), id: String(r[8]), ord: Number(r[9]) || 0, del: !!r[10] };
  }).filter(function (x) { return !x.del && x.id; });
}
function v51_noExt_(me) { if (v49_isExt_(me)) throw new Error('願景白板只開放總部隊員'); }
function v51_visionList_(p) {
  var me = v39_me_(); v51_noExt_(me);
  var rows = v51_vrows_(), boss = v42_isBoss_(me), names = {};
  rows.filter(function (x) { return x.kind === '品牌名'; }).forEach(function (x) { names[x.sec] = x.text; });
  var boards = V51_BOARDS.map(function (b) {
    var its = rows.filter(function (x) { return x.board === b[0] && x.kind === '項目'; }).sort(function (a, c) { return (a.ord - c.ord) || (a.row - c.row); });
    var sg = rows.filter(function (x) { return x.board === b[0] && x.kind === '建議'; }).reverse();
    return { id: b[0], title: b[1],
      items: its.map(function (x) { return { id: x.id, sec: x.sec, text: x.text, status: x.status || '構想中', time: x.time }; }),
      sugg: sg.slice(0, 80).map(function (x) { return { id: x.id, sec: x.sec, text: x.text, name: x.name, mine: x.by === me.id, time: x.time, status: x.status }; }) };
  });
  return { success: true, data: { boards: boards, spec: V51_SPEC.map(function (x) { return { id: x[0], color: x[1], name: names.hasOwnProperty(x[0]) ? names[x[0]] : x[2] }; }), boss: boss, status: V51_STATUS } };
}
function v51_visionSave_(p) {
  var me = v39_me_(); if (!v42_isBoss_(me)) return { error: '只有大隊長可以修改白板' };
  if (p._viewAs) return { error: '預覽模式只能看' };
  var op = String(p.op || ''), sh = v42_s_('願景白板', V51_VS_HEAD), rows = v51_vrows_();
  if (op === 'name') {   // 光譜七色的品牌名稱
    var sec = v51_sec_('spectrum', p.sec); if (!sec) return { error: '顏色不對' };
    var nm = v42_txt_(p.text, 30), old = rows.filter(function (x) { return x.kind === '品牌名' && x.sec === sec; })[0];
    if (old) sh.getRange(old.row, 5).setValue(nm), sh.getRange(old.row, 12).setValue(v39_now_());
    else sh.appendRow([v39_now_(), 'spectrum', sec, '品牌名', nm, '', me.id, v40_nm_(me.id), 'VN' + Date.now(), 0, '', '']);
    return { success: true };
  }
  if (op === 'add') {
    var b = v51_bid_(p.board), t = v42_txt_(p.text, 200); if (!b || t.length < 1) return { error: '請寫下內容' };
    if (rows.filter(function (x) { return x.board === b && x.kind === '項目'; }).length >= 60) return { error: '這塊白板已經 60 項了，先整理一下' };
    var st = V51_STATUS.indexOf(String(p.status)) >= 0 ? String(p.status) : '構想中', id = 'VI' + Date.now() + Math.floor(Math.random() * 1000);
    sh.appendRow([v39_now_(), b, v51_sec_(b, p.sec), '項目', t, st, me.id, v40_nm_(me.id), id, Date.now(), '', '']);
    if (p.fromSug) {   // 採納建議：建議標成「採納」並通知建議的人
      var sg = rows.filter(function (x) { return x.id === String(p.fromSug) && x.kind === '建議'; })[0];
      if (sg) { sh.getRange(sg.row, 6).setValue('採納'); if (sg.by && sg.by !== me.id) v41_noteAny_(sg.by, 'vision', '🗺️ 隊長採納了你在願景白板的建議：' + sg.text.slice(0, 30)); }
    }
    return { success: true, data: { id: id } };
  }
  var x = rows.filter(function (r) { return r.id === String(p.id); })[0]; if (!x) return { error: '找不到這一項' };
  if (op === 'edit') {
    var t2 = v42_txt_(p.text, 200); if (!t2) return { error: '請寫下內容' };
    sh.getRange(x.row, 5, 1, 2).setValues([[t2, V51_STATUS.indexOf(String(p.status)) >= 0 ? String(p.status) : x.status]]);
    if (x.board === 'spectrum' && p.sec != null) sh.getRange(x.row, 3).setValue(v51_sec_('spectrum', p.sec));
    sh.getRange(x.row, 12).setValue(v39_now_()); return { success: true };
  }
  if (op === 'del') { sh.getRange(x.row, 11).setValue(v39_now_()); return { success: true }; }
  if (op === 'read' && x.kind === '建議') { sh.getRange(x.row, 6).setValue('已讀'); return { success: true }; }
  if (op === 'move' && x.kind === '項目') {   // 上移／下移：和同一塊白板（同分區）相鄰那一項交換排序
    var same = rows.filter(function (r) { return r.board === x.board && r.kind === '項目' && r.sec === x.sec; }).sort(function (a, c) { return (a.ord - c.ord) || (a.row - c.row); });
    var i = same.map(function (r) { return r.id; }).indexOf(x.id), j = i + (Number(p.dir) < 0 ? -1 : 1);
    if (j < 0 || j >= same.length) return { success: true };
    same.forEach(function (r, k) { r.ord = k + 1; }); var tmp = same[i].ord; same[i].ord = same[j].ord; same[j].ord = tmp;
    sh.getRange(same[i].row, 10).setValue(same[i].ord); sh.getRange(same[j].row, 10).setValue(same[j].ord);
    return { success: true };
  }
  return { error: '不支援的操作' };
}
function v51_visionSuggest_(p) {
  var me = v39_me_(); v51_noExt_(me); if (p._viewAs) return { error: '預覽模式只能看' };
  var b = v51_bid_(p.board), t = v42_txt_(p.text, 200); if (!b) return { error: '請選白板' }; if (t.length < 2) return { error: '請寫下你的想法' };
  var key = 'VISION|' + me.id + '|' + v40_today_(), n = Number(gm_getState_(key) || 0);
  if (n >= 5) return { error: '今天已經留了 5 則建議，明天再來' };
  gm_setState_(key, String(n + 1)); try { v51_clean_(); } catch (e) {}
  v42_s_('願景白板', V51_VS_HEAD).appendRow([v39_now_(), b, v51_sec_(b, p.sec), '建議', t, '', me.id, v40_nm_(me.id), 'VS' + Date.now() + Math.floor(Math.random() * 1000), 0, '', '']);
  var title = (V51_BOARDS.filter(function (x) { return x[0] === b; })[0] || [])[1] || '';
  if (!v42_isBoss_(me)) ops_staff_().list.filter(function (x) { return !x.left && (x.role >= 5 || x.pos === '大隊長'); }).forEach(function (x) { v41_noteAny_(x.id, 'vision', '🗺️ ' + v40_nm_(me.id) + ' 在「' + title + '」留了建議：' + t.slice(0, 30)); });
  return { success: true };
}
function v51_visionDelSug_(p) {   // 自己的建議自己可以收回
  var me = v39_me_(), x = v51_vrows_().filter(function (r) { return r.id === String(p.id) && r.kind === '建議'; })[0];
  if (!x) return { error: '找不到這則建議' };
  if (x.by !== me.id && !v42_isBoss_(me)) return { error: '只能收回自己的建議' };
  v42_s_('願景白板', V51_VS_HEAD).getRange(x.row, 11).setValue(v39_now_()); return { success: true };
}

// ───────── 2. Bug 回報區 ─────────
// 每位隊員（含加盟、合作品牌）都能回報；可附一張截圖（存雲端〈Bug回報截圖（不公開）〉）；每人每天 5 則
// 大隊長標成「有效」或「已修好」時，自動發〈遊戲參數〉「Bug回報獎勵」枚赤心幣（每則只發一次）
var V51_BUG_HEAD = ['時間', '編號', '員工編號', '姓名', '頁面', '內容', '截圖', '裝置', '狀態', '獎勵', '處理時間', '回覆'];
var V51_BUG_ST = ['待處理', '有效', '已修好', '無效', '重複'];
function v51_bugFolder_() {
  var roots = DriveApp.getFoldersByName(DRIVE_ROOT), root = roots.hasNext() ? roots.next() : DriveApp.createFolder(DRIVE_ROOT);
  var subs = root.getFoldersByName('Bug回報截圖（不公開）');
  return subs.hasNext() ? subs.next() : root.createFolder('Bug回報截圖（不公開）');
}
function v51_bugRows_() {
  var sh = v42_s_('Bug回報', V51_BUG_HEAD), n = sh.getLastRow(); if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, V51_BUG_HEAD.length).getValues().map(function (r, i) {
    return { row: i + 2, time: v42_hm_(r[0]), id: String(r[1]), emp: String(r[2]), name: String(r[3]), page: String(r[4] || ''), text: String(r[5] || ''), shot: String(r[6] || ''),
             dev: String(r[7] || ''), status: String(r[8] || '待處理'), reward: Number(r[9]) || 0, done: v42_hm_(r[10]), reply: String(r[11] || '') };
  });
}
function v51_bugReport_(p) {
  var me = v39_me_(); if (p._viewAs) return { error: '預覽模式只能看' };
  var text = v42_txt_(p.text, 500); if (text.length < 4) return { error: '請描述一下發生什麼事（至少 4 個字）' };
  var key = 'BUG|' + me.id + '|' + v40_today_(), n = Number(gm_getState_(key) || 0);
  if (n >= 5) return { error: '今天已經回報 5 則了，謝謝你！明天再來' };
  var id = 'BUG' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'MMddHHmmss') + Math.floor(Math.random() * 90 + 10), fid = '';
  var img = v44_b64_(p.img);
  if (img) {
    if (!/^[A-Za-z0-9+\/=]+$/.test(img) || img.length < 1000 || img.length > 1400000) return { error: '截圖格式不對或太大，請換一張' };
    var f = v51_bugFolder_().createFile(Utilities.newBlob(Utilities.base64Decode(img), 'image/jpeg', id + '_' + me.id + '.jpg'));
    try { f.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE); } catch (e) {}
    fid = f.getId();
  }
  gm_setState_(key, String(n + 1)); try { v51_clean_(); } catch (e) {}
  v42_s_('Bug回報', V51_BUG_HEAD).appendRow([v39_now_(), id, me.id, v40_nm_(me.id), v42_txt_(p.page, 40), text, fid, v42_txt_(p.dev, 120), '待處理', '', '', '']);
  ops_staff_().list.filter(function (x) { return !x.left && (x.role >= 5 || x.pos === '大隊長'); }).forEach(function (x) { if (x.id !== me.id) v41_noteAny_(x.id, 'bug', '🐞 ' + v40_nm_(me.id) + ' 回報問題：' + text.slice(0, 30)); });
  return { success: true, data: { id: id } };
}
function v51_bugList_(p) {
  var me = v39_me_(), boss = v42_isBoss_(me), rows = v51_bugRows_().filter(function (x) { return boss || x.emp === me.id; }).reverse().slice(0, 200);
  return { success: true, data: { boss: boss, reward: v42_n_('Bug回報獎勵', 5), status: V51_BUG_ST,
    list: rows.map(function (x) { return { id: x.id, time: x.time, name: x.name, mine: x.emp === me.id, page: x.page, text: x.text, shot: !!x.shot, dev: boss ? x.dev : '', status: x.status, reward: x.reward, done: x.done, reply: x.reply }; }) } };
}
function v51_bugShot_(p) {
  var me = v39_me_(), x = v51_bugRows_().filter(function (r) { return r.id === String(p.id); })[0];
  if (!x || !x.shot) return { error: '這則沒有截圖' };
  if (x.emp !== me.id && !v42_isBoss_(me)) return { error: '只有大隊長和回報的人看得到' };
  return { success: true, data: { base64: Utilities.base64Encode(DriveApp.getFileById(x.shot).getBlob().getBytes()) } };
}
function v51_bugSet_(p) {
  var me = v39_me_(); if (!v42_isBoss_(me)) return { error: '只有大隊長可以處理回報' };
  if (p._viewAs) return { error: '預覽模式只能看' };
  var x = v51_bugRows_().filter(function (r) { return r.id === String(p.id); })[0]; if (!x) return { error: '找不到這則回報' };
  var st = V51_BUG_ST.indexOf(String(p.status)) >= 0 ? String(p.status) : x.status, reply = p.reply != null ? v42_txt_(p.reply, 200) : x.reply;
  var sh = v42_s_('Bug回報', V51_BUG_HEAD), amt = x.reward, msg = '';
  if ((st === '有效' || st === '已修好') && !x.reward && x.emp !== me.id) {
    amt = Math.max(0, Math.min(100, v42_n_('Bug回報獎勵', 5)));
    if (amt > 0 && !gm_isFrozen_(x.emp)) { gm_credit_(x.emp, 'Bug回報', amt, '有效的 Bug 回報（' + x.id + '）', 'BUGRW|' + x.id); msg = '，獲得 ' + amt + ' 枚赤心幣 🪙'; } else amt = 0;
  }
  sh.getRange(x.row, 9, 1, 4).setValues([[st, amt || '', v39_now_(), reply]]);
  if (st !== x.status || reply !== x.reply) {
    var head = st === '已修好' ? '🐞 你回報的問題已經修好了' : st === '有效' ? '🐞 你回報的問題確認有效，處理中' : st === '無效' ? '🐞 你回報的問題隊長看過了' : st === '重複' ? '🐞 你回報的問題已經有人回報過' : '🐞 隊長回覆了你的回報';
    if (x.emp !== me.id) v41_noteAny_(x.emp, 'bug', head + msg + (reply ? '：' + reply.slice(0, 40) : ''));
  }
  return { success: true, data: { reward: amt } };
}
function v51_clean_() {   // 每天一次：刪 7 天前的 gm_VISION|、gm_BUG| 計數鍵
  var d = v40_today_(); if (gm_getState_('v51清理日') === d) return;
  gm_setState_('v51清理日', d);
  var cut = gm_addDays_(d, -7), props = PropertiesService.getScriptProperties();
  props.getKeys().forEach(function (k) { var m = /^gm_(VISION|BUG)\|.*\|(\d{4}-\d{2}-\d{2})$/.exec(k); if (m && m[2] < cut) props.deleteProperty(k); });
}
// ───────── 3. 隊長室左牆「合作夥伴牆」（v1.51 第 2 版）─────────
// 合作過的機關團體（中央、地方、協會）、品牌（汽車、科技、醫藥、社群、學校…）與行銷公關夥伴；每一筆可放多張照片
// 總部隊員都看得到（加盟、合作品牌帳號除外）；Lv.3 以上可以新增、修改、上傳照片；刪除限大隊長或建立的人
// 照片原圖存雲端〈合作夥伴照片（不公開）〉，縮圖存〈合作夥伴照片〉分頁
var V51_PT_CATS = [['central', '中央機關', '機關團體'], ['local', '地方機關', '機關團體'], ['assoc', '協會・基金會', '機關團體'], ['car', '汽車', '品牌'], ['tech', '科技', '品牌'], ['med', '醫藥', '品牌'], ['social', '社群・媒體', '品牌'], ['school', '學校', '品牌'], ['fashion', '精品時尚', '品牌'], ['corp', '金融・企業', '品牌'], ['ip', '文創 IP・展覽', '品牌'], ['travel', '觀光・旅展', '品牌'], ['retail', '百貨通路', '品牌'], ['sport', '運動・音樂祭', '品牌'], ['agency', '行銷公關夥伴', '合作夥伴']];
var V51_PT_HEAD = ['時間', '編號', '分類', '名稱', '合作內容', '日期', '建立者', '姓名', '封面照片', '刪除', '修改時間'];
var V51_PP_HEAD = ['時間', '照片編號', '夥伴編號', '檔案', '縮圖', '說明', '上傳者', '刪除'];
function v51_ptCat_(v) { v = String(v || ''); return V51_PT_CATS.some(function (c) { return c[0] === v; }) ? v : ''; }
function v51_ptRows_() {
  var sh = v42_s_('合作夥伴牆', V51_PT_HEAD), n = sh.getLastRow(); if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, V51_PT_HEAD.length).getValues().map(function (r, i) {
    return { row: i + 2, time: v42_hm_(r[0]), id: String(r[1]), cat: String(r[2]), name: String(r[3] || ''), note: String(r[4] || ''), date: r[5] instanceof Date ? Utilities.formatDate(r[5], 'Asia/Taipei', 'yyyy-MM-dd') : String(r[5] || ''),
             by: String(r[6] || ''), cover: String(r[8] || ''), del: !!r[9] };
  }).filter(function (x) { return x.id && !x.del; });
}
function v51_ppRows_() {
  var sh = v42_s_('合作夥伴照片', V51_PP_HEAD), n = sh.getLastRow(); if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, V51_PP_HEAD.length).getValues().map(function (r, i) {
    return { row: i + 2, time: v42_hm_(r[0]), id: String(r[1]), pid: String(r[2]), file: String(r[3]), thumb: String(r[4] || ''), cap: String(r[5] || ''), by: String(r[6] || ''), del: !!r[7] };
  }).filter(function (x) { return x.id && !x.del; });
}
function v51_ptCanEdit_(me) { return me && (me.role >= 3 || v42_isBoss_(me)) && !v49_isExt_(me); }
function v51_ptList_(p) {
  var me = v39_me_(); if (v49_isExt_(me)) return { error: '合作夥伴牆只開放總部隊員' };
  var ph = v51_ppRows_(), cnt = {}, first = {};
  ph.forEach(function (x) { cnt[x.pid] = (cnt[x.pid] || 0) + 1; if (!first[x.pid]) first[x.pid] = x; });
  var thumbOf = {}; ph.forEach(function (x) { thumbOf[x.id] = x.thumb; });
  var list = v51_ptRows_().map(function (x) {
    var cv = (x.cover && thumbOf[x.cover]) ? thumbOf[x.cover] : (first[x.id] ? first[x.id].thumb : '');
    return { id: x.id, cat: x.cat, name: x.name, note: x.note, date: x.date, photos: cnt[x.id] || 0, cover: p.lite ? '' : cv, mine: x.by === me.id };
  }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)) || a.name.localeCompare(b.name); });
  return { success: true, data: { cats: V51_PT_CATS.map(function (c) { return { id: c[0], name: c[1], group: c[2] }; }), list: list, canEdit: v51_ptCanEdit_(me), boss: v42_isBoss_(me) } };
}
function v51_ptSave_(p) {
  var me = v39_me_(); if (!v51_ptCanEdit_(me)) return { error: 'Lv.3 以上才能編輯合作夥伴牆' };
  if (p._viewAs) return { error: '預覽模式只能看' };
  var op = String(p.op || ''), sh = v42_s_('合作夥伴牆', V51_PT_HEAD);
  var cat = v51_ptCat_(p.cat), name = v42_txt_(p.name, 40), note = v42_txt_(p.note, 300), date = /^\d{4}(-\d{2}){0,2}$/.test(String(p.date || '')) ? String(p.date) : '';
  if (op === 'add') {
    if (!cat) return { error: '請選分類' }; if (!name) return { error: '請寫名稱' };
    var id = 'PT' + Date.now() + Math.floor(Math.random() * 1000);
    sh.appendRow([v39_now_(), id, cat, name, note, date, me.id, v40_nm_(me.id), '', '', '']);
    return { success: true, data: { id: id } };
  }
  var x = v51_ptRows_().filter(function (r) { return r.id === String(p.id); })[0]; if (!x) return { error: '找不到這筆' };
  if (op === 'edit') {
    if (!name) return { error: '請寫名稱' };
    sh.getRange(x.row, 3, 1, 4).setValues([[cat || x.cat, name, note, date]]); sh.getRange(x.row, 11).setValue(v39_now_());
    return { success: true };
  }
  if (op === 'cover') { sh.getRange(x.row, 9).setValue(String(p.photo || '')); return { success: true }; }
  if (op === 'del') {
    if (x.by !== me.id && !v42_isBoss_(me)) return { error: '只有大隊長或建立的人可以刪除' };
    sh.getRange(x.row, 10).setValue(v39_now_()); return { success: true };
  }
  return { error: '不支援的操作' };
}
function v51_ptFolder_() {
  var roots = DriveApp.getFoldersByName(DRIVE_ROOT), root = roots.hasNext() ? roots.next() : DriveApp.createFolder(DRIVE_ROOT);
  var subs = root.getFoldersByName('合作夥伴照片（不公開）');
  return subs.hasNext() ? subs.next() : root.createFolder('合作夥伴照片（不公開）');
}
function v51_ptPhoto_(p) {
  var me = v39_me_(); if (!v51_ptCanEdit_(me)) return { error: 'Lv.3 以上才能上傳照片' };
  if (p._viewAs) return { error: '預覽模式只能看' };
  var x = v51_ptRows_().filter(function (r) { return r.id === String(p.id); })[0]; if (!x) return { error: '找不到這筆' };
  if (v51_ppRows_().filter(function (r) { return r.pid === x.id; }).length >= 30) return { error: '每筆最多 30 張照片' };
  var img = v44_b64_(p.img), th = v44_b64_(p.thumb);
  if (!/^[A-Za-z0-9+\/=]+$/.test(img) || img.length < 1000 || img.length > 1900000) return { error: '照片格式不對或太大' };
  if (!/^[A-Za-z0-9+\/=]*$/.test(th) || th.length > 45000) th = '';
  var pid = 'PP' + Date.now() + Math.floor(Math.random() * 1000);
  var f = v51_ptFolder_().createFile(Utilities.newBlob(Utilities.base64Decode(img), 'image/jpeg', x.name.slice(0, 20) + '_' + pid + '.jpg'));
  try { f.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE); } catch (e) {}
  v42_s_('合作夥伴照片', V51_PP_HEAD).appendRow([v39_now_(), pid, x.id, f.getId(), th, v42_txt_(p.cap, 60), me.id, '']);
  return { success: true, data: { id: pid } };
}
function v51_ptPhotos_(p) {
  var me = v39_me_(); if (v49_isExt_(me)) return { error: '合作夥伴牆只開放總部隊員' };
  return { success: true, data: v51_ppRows_().filter(function (r) { return r.pid === String(p.id); }).map(function (r) { return { id: r.id, thumb: r.thumb, cap: r.cap, time: r.time }; }) };
}
function v51_ptPhotoGet_(p) {
  var me = v39_me_(); if (v49_isExt_(me)) return { error: '合作夥伴牆只開放總部隊員' };
  var x = v51_ppRows_().filter(function (r) { return r.id === String(p.id); })[0]; if (!x) return { error: '找不到這張照片' };
  return { success: true, data: { base64: Utilities.base64Encode(DriveApp.getFileById(x.file).getBlob().getBytes()) } };
}
function v51_ptPhotoDel_(p) {
  var me = v39_me_(), x = v51_ppRows_().filter(function (r) { return r.id === String(p.id); })[0]; if (!x) return { error: '找不到這張照片' };
  if (x.by !== me.id && !v42_isBoss_(me)) return { error: '只有大隊長或上傳的人可以刪除' };
  if (p._viewAs) return { error: '預覽模式只能看' };
  v42_s_('合作夥伴照片', V51_PP_HEAD).getRange(x.row, 8).setValue(v39_now_());
  try { DriveApp.getFileById(x.file).setTrashed(true); } catch (e) {}
  return { success: true };
}


// v1.51 第 2 版：依雲端「32活動配合」（565 場）與「31百貨通路」（142 檔），共 306 筆資料夾自動歸類的初始名單（大概的分法，隊長可在 App 修改）
// 部署後執行一次 v51_ptSeed()；已經有同名的不會重複新增。日期＝最近一次合作的年月
var V51_PT_SEED = [["central", "臺鐵・鐵路便當節", "活動 9 場｜2020–2026｜鐵路便當節、鐵路便當節高雄場、2025鐵路便當節、鐵路便當節-台北場、鐵路便當節2025-高雄場、第6屆鐵路便當節", "2026-06"], ["central", "總統府", "活動 6 場｜2024–2026｜總統府亞帕活動、總統府亞運活動、總統府外送訂單、總統府少棒冠軍、總統府-世界棒球十二強冠軍、總統府", "2026-10"], ["central", "公共電視", "活動 5 場｜2025–2026｜公視、公視勇者動畫系列台北華山、公視PLUS活動、公視科教館、小公視大人季勇者動畫台中市政府", "2026-05"], ["central", "中美洲經貿辦事處", "活動 3 場｜2025｜2025中美洲第二版、2025中美洲第一版、中美洲辦事處ITF旅展", "2025-11"], ["central", "國家兩廳院", "櫃位・快閃 1 檔、活動 2 場｜2021–2023｜兩廳院", "2021-08"], ["central", "交通部觀光署・台灣好湯", "活動 2 場｜2026｜台灣好湯谷關、台灣好湯記者會", "2026-09"], ["central", "國家鐵道博物館", "活動 2 場｜2025–2026｜鐵道博物館、國家鐵道博物館", "2026-08"], ["central", "國立臺灣科學教育館", "櫃位・快閃 1 檔、活動 1 場｜2024–2025｜聯合數位巨大恐龍展＠科教館、公視科教館", "2025-08"], ["central", "國防部憲兵指揮部", "活動 2 場｜2025｜2025憲兵營、2025憲兵202指揮部", "2025"], ["central", "外交部", "活動 2 場｜2024–2025｜外交部北投壘球選手、外交部", "2025-08"], ["central", "空軍台南基地", "活動 1 場｜2025｜台南空軍基地", "2025-09"], ["central", "經濟部商業署・餐飲國際推廣計畫", "活動 1 場｜2025｜114年度推動餐飲服務業優質成長暨國際推廣計劃", "2025"], ["central", "衛生福利部・藥害救濟基金會", "活動 1 場｜2026｜藥害救濟基金會", "2026-11"], ["local", "新北市政府（體育局・萬金石・耶誕城）", "活動 6 場｜2019–2024｜新北市活動、新北市體育局、最強市民飆5K、遠東商銀新北耶誕城、萬金石馬拉松開會、萬金石馬拉松記者會", "2024-07"], ["local", "新北市漁業處（龜吼・淡水漁人碼頭）", "活動 6 場｜2024–2026｜新北漁業處機台、新北龜吼漁港、新北漁業處-肯果、龜吼市集、淡水漁人碼頭、新北漁業管理處", "2026-06"], ["local", "臺北流行音樂中心", "活動 5 場｜2024｜北流外送、北流文化館活動、北流外送小巨蛋、台北音樂流行中心", "2024-11"], ["local", "臺北市觀光傳播局", "活動 4 場｜2019–2022｜熊讚慶生、你所未見的台北2.0、大稻埕情人節煙火、Undiscovered Taipei旅遊產品記者會觀傳局For泰國", "2022-08"], ["local", "臺北市（花季・花伴野餐・寶藏巖光節）", "活動 4 場｜2021–2026｜台北花伴野餐日、台北花季、台北花伴野餐、寶藏巖光節", "2026-03"], ["local", "新北市十三行博物館", "活動 2 場｜2024–2025｜新北市十三行路跑格治、考古生活節", "2025-11"], ["local", "桃園市（桃捷・兒童藝術節）", "活動 2 場｜2019–2023｜2023桃園兒童藝術節-桃演本舖、桃捷聖誕活動", "2019-12"], ["local", "臺北市政府政風處", "活動 2 場｜2022｜政風處外送、政風處", "2022-08"], ["local", "台東縣月光節", "活動 1 場｜2024｜大地藝術台東月光節", "2024-06"], ["local", "基隆市城市博覽會", "活動 1 場｜2022｜基隆城博會", "2022-06"], ["local", "屏東勝利星村", "櫃位・快閃 1 檔｜2023｜勝利星村", "2023"], ["local", "新北市大都會公園", "活動 1 場｜2026｜新北大都會公園", "2026-04"], ["local", "新北捷運・新店輕軌", "活動 1 場｜2023｜2023新店輕軌", "2023"], ["local", "新竹縣竹北兒童藝術節", "活動 1 場｜2024｜竹北兒童藝術節", "2024-04"], ["local", "臺中市政府", "活動 1 場｜2025｜小公視大人季勇者動畫台中市政府", "2025-08"], ["local", "臺北市立動物園", "櫃位・快閃 1 檔｜2024｜動物園", "2024"], ["local", "高雄兒童藝術節", "活動 1 場｜2026｜高雄兒藝節b8富邦文創", "2026-04"], ["assoc", "台灣觀光協會（TVA 海外推廣）", "活動 14 場｜2023–2026｜新加坡、馬來西亞緊急行程、TVA馬來西亞吉隆坡MATTA秋季旅展及觀光推廣活動、TVA越南2025年越南胡志明市ITE國際旅展及觀光推廣活動、TVA印尼2025年印尼地區秋季觀光推廣活動、TVA日本2025年西日本地區觀光推廣活動、TVA新加坡2025 年新加坡地區觀光推廣活動、TVA泰國2025泰國春季旅展及觀光推廣活動、台灣觀光協會TVA、韓國釜山推廣會、吉隆坡旅展、馬來西亞、觀光協會菲律賓、日本旅展", "2026-01"], ["assoc", "台北市電腦公會", "活動 13 場｜2023–2026｜電腦工會Futex、台北電腦公會亞洲技能競賽、亞洲競賽晚宴電腦公會、教育科技展台北電腦公會、電腦公會生成藝術節、電腦公會Futex未來科技館、台北市電腦公會、電腦公會活動、電腦公會未來科技館、電腦協會、電腦公會", "2026-09"], ["assoc", "家孩有我在・育幼院公益", "活動 4 場｜2024–2026｜家孩有我在、忠義育幼院-家孩有我在、台北育幼院、家孩有我在愛心園遊會", "2026-05"], ["assoc", "社區・教會・里辦公處", "活動 4 場｜2017–2026｜靈鳩山、外送教會、天域社區活動、仁德里", "2026-02"], ["assoc", "SEMI 國際半導體產業協會", "活動 3 場｜2024–2026｜半導體協會、半導體協會晶晶、SEMI半導體協會", "2026-09"], ["assoc", "富邦文教基金會", "活動 2 場｜2025–2026｜高雄兒藝節b8富邦文創、富邦文教基金會", "2026-04"], ["assoc", "外貿協會", "活動 1 場｜2025｜外貿協會Taione", "2025-12"], ["assoc", "天使心基金會", "活動 1 場｜2024｜天使心", "2024-08"], ["assoc", "張榮發基金會", "活動 1 場｜2019｜", "2019-09"], ["assoc", "牙醫師公會", "活動 1 場｜2026｜原24-25牙醫公會", "2026-10"], ["assoc", "資策會", "活動 1 場｜2023｜資策會", "2023-06"], ["car", "Mercedes-Benz 賓士", "活動 15 場｜2019–2026｜眾奌溝通賓士、台南賓士、台灣賓士CLS發表、中彰賓士、賓士星動樂園台中站、賓士星動樂園台北站、台隆賓士、賓士活動、中華賓士南紡購物中心、中華賓士、賓士、BENZ巡迴", "2026-06"], ["car", "BMW・MINI（汎德・鎔德・依德・大桐）", "活動 14 場｜2019–2026｜桃園大桐汽車、大桐桃園mini、BMW鎔德、台北依德BMW、台北汎德天母、濱江、[汎德BMW M TOWN]、臺北汎德、BMW-M系列50週年台中、BMW台北榕德、大桐竹北連續7個假日、BMW鎔德情人戒活動、BMW聖誕活動", "2026-05"], ["car", "Honda（東星）", "活動 5 場｜2024｜Honda、東星Honda經國店、東星Honda桃園店、東星活動、Honda經國店", "2024-11"], ["car", "Porsche 保時捷", "活動 5 場｜2021–2025｜新竹保時捷、台北保時捷活動、保時捷、保時捷台北", "2025-03"], ["car", "Gogoro", "活動 2 場｜2017–2019｜GOGORO、gogoro2記者發表會", "2019-09"], ["car", "Jaguar Land Rover", "活動 2 場｜2023｜2023JAGUAR LAND ROVER 竹北展示中心、LandRover", "2023-11"], ["car", "Volvo", "活動 2 場｜2023–2024｜2024VOLVO、Volvo凱銳汽車", "2023-05"], ["car", "Audi", "活動 1 場｜2020｜AUDI新車發表會", "2020-09"], ["car", "Ford", "活動 1 場｜2026｜FORD", "2026-01"], ["car", "Subaru", "活動 1 場｜2024｜SUBARU桃園", "2024-02"], ["car", "中華汽車", "活動 1 場｜2025｜中華汽車", "2025-07"], ["car", "九和汽車", "活動 1 場｜2023｜九和汽車", "2023-08"], ["car", "裕隆城", "活動 1 場｜2023｜裕隆城", "2023-09"], ["tech", "FUJI 按摩椅", "活動 11 場｜2019–2024｜Fuji、FUJI台茂、2023Fuji、Fuji環球A19、Fuji按摩椅中和環球、2020Fuji", "2024-02"], ["tech", "台積電 TSMC", "活動 6 場｜2020–2026｜台積電龍潭廠、台積電F8、台積電F3、台積電F7、台積電、台積電18廠", "2026-11"], ["tech", "Leica 徠卡", "活動 5 場｜2020–2026｜徠卡之家、萊卡之家、LEICA", "2026-02"], ["tech", "叡揚資訊", "活動 5 場｜2025–2026｜叡揚資訊尾牙、2025叡揚開模、外送叡揚", "2026-01"], ["tech", "Kingston 金士頓", "活動 4 場｜2024–2026｜金士頓、金士頓青年營、金士頓活動", "2026-09"], ["tech", "MSI 微星", "活動 4 場｜2023–2025｜電玩展MSI、微星MSI-GQ潮流祭、微星、微星msi", "2025-01"], ["tech", "BenQ 明基", "活動 3 場｜2024–2025｜華鋒科技BenQ、明基電通內湖活動、明基電通家庭日", "2025-03"], ["tech", "Samsung 三星", "活動 3 場｜2019–2020｜全國三星教育訓練、三星", "2020-09"], ["tech", "ASUS 華碩", "活動 2 場｜2024–2026｜華碩聖誕、華碩北投藝文晚會", "2026-11"], ["tech", "Moxa 四零四科技", "活動 2 場｜2023–2025｜四零四科技外送、Moxa", "2025-10"], ["tech", "Synology 群暉", "活動 2 場｜2022–2024｜群暉科技", "2024-06"], ["tech", "微康電子商務", "活動 2 場｜2026｜微康VK、微康電子商務中心開幕活動", "2026-10"], ["tech", "德州儀器 TI", "活動 2 場｜2023–2024｜德州儀器", "2024-08"], ["tech", "鴻海・鴻騰精密", "活動 2 場｜2025｜鴻海尾牙、鴻騰精密", "2025-01"], ["tech", "AI DAY", "活動 1 場｜2022｜AIDAY", "2022-10"], ["tech", "AWS 亞馬遜", "活動 1 場｜2025｜亞馬遜資訊", "2025-05"], ["tech", "Dyson", "活動 1 場｜2024｜Dyson", "2024-06"], ["tech", "Google", "活動 1 場｜2024｜台灣科高Google", "2024-05"], ["tech", "Intel", "活動 1 場｜2022｜Intel", "2022-01"], ["tech", "Lenovo 聯想", "活動 1 場｜2023｜聯想訂單", "2023-03"], ["tech", "PNY", "活動 1 場｜2024｜PNY活動", "2024-11"], ["tech", "Philips 飛利浦", "活動 1 場｜2023｜飛利浦劉小姐", "2023-02"], ["tech", "中興保全科技", "活動 1 場｜2026｜中興保全科技", "2026-03"], ["tech", "仁寶電腦", "活動 1 場｜2025｜愛普圓山飯店仁寶活動", "2025-10"], ["tech", "元笙科技", "活動 1 場｜2025｜元笙科技", "2025-05"], ["tech", "台達電", "活動 1 場｜2025｜藝力國際台達電六福村", "2025-11"], ["tech", "新唐科技", "活動 1 場｜2024｜新唐家庭日活動", "2024-09"], ["tech", "星暘能源", "活動 1 場｜2026｜星暘能源股份有限公司", "2026-01"], ["tech", "晶研科技", "活動 1 場｜2023｜晶研科技", "2023-01"], ["tech", "智冠科技", "活動 1 場｜2023｜智冠南港展覽館", "2023-02"], ["tech", "眾智光電", "活動 1 場｜2020｜眾智光電家庭日", "2020-08"], ["tech", "祥旺達科技", "活動 1 場｜2024｜祥旺達科技", "2024-12"], ["tech", "華城電機", "活動 1 場｜2026｜華城科技", "2026-11"], ["tech", "華為", "活動 1 場｜2019｜華為", "2019-08"], ["tech", "華邦電子", "活動 1 場｜2023｜華邦電子家庭日", "2023-10"], ["tech", "輔信科技", "活動 1 場｜2025｜輔信科技活動", "2025-05"], ["tech", "遊戲橘子", "活動 1 場｜2024｜橘子遊戲", "2024-03"], ["tech", "遠傳電信", "活動 1 場｜2023｜板橋遠傳王小姐", "2023-02"], ["tech", "金寶電子", "活動 1 場｜2025｜金寶家庭日", "2025-11"], ["tech", "鈊象電子", "活動 1 場｜2026｜鈊象電子", "2026-02"], ["tech", "風力發電展", "活動 1 場｜2026｜風力發電", "2026-10"], ["med", "GSK・Haleon（舒酸定）", "活動 7 場｜2019–2025｜Haleon、GSK家庭日、HALEON牙展、HALEON、舒酸定、GSK癲癇醫學、GSK舒酸定", "2025-11"], ["med", "醫學會年會（肺癌・乳癌・眼科・神經放射・肺炎）", "活動 7 場｜2020–2026｜神經放射、愛普肺癌台大國際會議中心、台灣肺癌年會、rmp 肺炎年會、乳癌年會、眼科年會、醫療展", "2026-11"], ["med", "Herbalife 賀寶芙", "活動 2 場｜2021｜賀寶芙", "2021-04"], ["med", "Moderna 莫德納", "活動 1 場｜2026｜愛普莫德納台北艾麗", "2026-07"], ["med", "大葉產後護理之家", "活動 1 場｜2024｜外送大葉產後護理之家", "2024-10"], ["med", "美容展", "活動 1 場｜2026｜美容展", "2026-03"], ["social", "VOGUE", "活動 6 場｜2019–2025｜Vogue野餐日、Vogue、VOGUE風格野餐日、VOGUE臺北時裝周、風格野餐日", "2025-04"], ["social", "親子天下", "活動 6 場｜2022–2026｜親子天下、2024親子天下、親天下兒童書展、達克比末日大作戰", "2026-06"], ["social", "foodpanda", "活動 3 場｜2023–2026｜FoodPanda外送、FOODPANDA、2023FoodPanda", "2026-07"], ["social", "三立電視", "活動 3 場｜2019–2024｜三立新聞蔣小姐薪動大未來、大稻埕情人節煙火、桃捷聖誕活動", "2024-06"], ["social", "ELLE", "活動 2 場｜2019–2025｜ELLEweekend、童裝走秀", "2025-10"], ["social", "Meta 臉書", "活動 2 場｜2025–2026｜臉書Joyce鼓鼓應援、臉書公司活動", "2026-07"], ["social", "直播主活動", "活動 2 場｜2025–2026｜宥凱直播、摩曼頓NBAStore聖誕直播", "2026-05"], ["social", "遠見天下・永續生活節", "活動 2 場｜2022–2023｜遠見永續生活節", "2023-04"], ["social", "Uber Eats", "活動 1 場｜2020｜UBEREATS推廣", "2020-10"], ["social", "國家地理 National Geographic", "活動 1 場｜2025｜NationGeographic", "2025-04"], ["social", "獨角傳媒", "活動 1 場｜2024｜獨角傳媒", "2024-10"], ["social", "相信音樂", "活動 1 場｜2024｜相信音樂蕭秉治", "2024-12"], ["social", "蝦皮", "活動 1 場｜2023｜2023蝦皮", "2023"], ["school", "國立政治大學", "活動 3 場｜2026｜政大畢業典禮、政治大學校友會、國立政治大學", "2026-05"], ["school", "世新大學", "活動 2 場｜2020–2021｜世新大學尾牙、世新大學", "2021-01"], ["school", "國立臺灣大學", "活動 2 場｜2024–2026｜台大博雅館、台大會計系", "2026-05"], ["school", "中正國中", "活動 1 場｜2026｜外送中正國中", "2026-10"], ["school", "光復國小", "活動 1 場｜2023｜光復國小", "2023-06"], ["school", "南門國中", "活動 1 場｜2022｜南門國中", "2022-11"], ["school", "國立臺北大學", "活動 1 場｜2026｜台北大學", "2026-11"], ["school", "復興高中", "活動 1 場｜2024｜復興高中家長會", "2024-06"], ["school", "臺北醫學大學", "活動 1 場｜2022｜北醫大", "2022-09"], ["school", "雙永國小", "活動 1 場｜2023｜雙永國小", "2023-12"], ["school", "龍心幼兒園", "活動 1 場｜2024｜龍心幼兒園", "2024-04"], ["fashion", "Under Armour（星裕）", "活動 8 場｜2024–2026｜星裕underamour大巨蛋、UA馬拉松博覽會、星裕UA台中新光三越、UA南紡購物中心、星裕摩曼頓、UA活動高雄夢時代、星裕UA櫃位活動、UnderArmour", "2026-09"], ["fashion", "Calvin Klein", "活動 5 場｜2023–2025｜CK活動、CK、CK台中新光西門店、CKJeans", "2025-03"], ["fashion", "Dunhill", "活動 5 場｜2024–2025｜Dunhill微風信義微風之夜、Dunhill微風之夜、Dunhill、Dunhill微風信義", "2025-08"], ["fashion", "Timberland", "活動 5 場｜2024–2026｜Timberland敦南店、Timberland、Timberland板橋大遠百、TIMBERLAND", "2026-02"], ["fashion", "Grace Gift", "活動 4 場｜2024–2026｜GraceGift大江、GraceGift", "2026-02"], ["fashion", "COACH", "活動 3 場｜2023–2024｜COACH", "2024-05"], ["fashion", "HOF", "活動 3 場｜2023–2024｜HOF、HOF台南", "2024-02"], ["fashion", "小鳥飾品", "活動 3 場｜2024｜小鳥、小鳥飾品", "2024-07"], ["fashion", "Chopard 蕭邦", "活動 2 場｜2020–2023｜蕭邦、2020蕭邦錶", "2023-11"], ["fashion", "HUGO BOSS", "活動 2 場｜2024–2025｜Boss、BOSS高雄漢神", "2025-01"], ["fashion", "Louis Vuitton", "活動 2 場｜2021–2024｜LV租借機器、2021LV品牌活動", "2024-08"], ["fashion", "摩曼頓・NBA Store", "活動 2 場｜2025｜摩曼頓NBAStore聖誕直播、星裕摩曼頓", "2025-12"], ["fashion", "Chanel", "活動 1 場｜2026｜知和公關Chanel", "2026-05"], ["fashion", "Estée Lauder 雅詩蘭黛", "活動 1 場｜2026｜雅詩蘭黛", "2026-03"], ["fashion", "Georg Jensen", "活動 1 場｜2020｜GerogeJenson", "2020-01"], ["fashion", "Jurlique 茱莉蔻", "活動 1 場｜2021｜茱莉蔻", "2021-03"], ["fashion", "Longines 浪琴", "活動 1 場｜2024｜浪琴表", "2024-09"], ["fashion", "Montblanc 萬寶龍", "活動 1 場｜2020｜2020萬寶龍", "2020"], ["fashion", "New Balance", "活動 1 場｜2023｜2023NewBalance", "2023"], ["fashion", "Patek Philippe 百達翡麗", "活動 1 場｜2025｜百達翡麗", "2025-11"], ["fashion", "Polo Ralph Lauren", "活動 1 場｜2020｜2020POLO", "2020"], ["fashion", "Swatch", "活動 1 場｜2022｜SWATCH", "2022"], ["corp", "PLACE 加熱菸", "活動 3 場｜2025–2026｜加熱煙台中、PLACE加熱菸活動", "2026-02"], ["corp", "忠泰建設", "活動 3 場｜2024–2026｜忠泰樂生活展覽、忠泰建設、忠泰尾牙", "2026-10"], ["corp", "台泥", "活動 2 場｜2023–2025｜台泥聖誕、台泥家庭日", "2025-12"], ["corp", "日明耀", "活動 2 場｜2024–2026｜日明耀", "2026-01"], ["corp", "海悅國際", "活動 2 場｜2024｜海悅天母、海悅國際", "2024-12"], ["corp", "聖德福", "活動 2 場｜2025–2026｜聖得福尾牙、聖德福尾牙", "2026-01"], ["corp", "遠東商銀", "活動 2 場｜2019–2024｜遠東商銀、遠東商銀新北耶誕城", "2024-03"], ["corp", "Allianz 安聯", "活動 1 場｜2024｜安聯", "2024-11"], ["corp", "HSBC 匯豐", "活動 1 場｜2020｜匯豐家庭日", "2020-10"], ["corp", "中嘉", "活動 1 場｜2026｜中嘉家庭日", "2026-09"], ["corp", "中國信託（酷碰・貨櫃）", "活動 1 場｜2018｜中信貨櫃、ATM 酷碰優惠券（2019–2021）", "2018-12"], ["corp", "中華航空", "活動 1 場｜2019｜華航60周年", "2019-12"], ["corp", "偉鉅建設", "活動 1 場｜2024｜偉鉅活動", "2024-08"], ["corp", "南山人壽", "活動 1 場｜2020｜南山家庭日", "2020-11"], ["corp", "國聚建設", "活動 1 場｜2022｜國聚建設", "2022-12"], ["corp", "宏華", "活動 1 場｜2025｜宏華家庭日", "2025-11"], ["corp", "文偉", "活動 1 場｜2026｜文偉公司", "2026-03"], ["corp", "旺旺", "活動 1 場｜2024｜旺旺", "2024-03"], ["corp", "明治", "活動 1 場｜2025｜明治奶粉", "2025-06"], ["corp", "睿奇森", "活動 1 場｜2024｜外送訂單睿奇森", "2024-11"], ["corp", "艾利得", "活動 1 場｜2024｜艾利得", "2024-06"], ["corp", "遠雄", "活動 1 場｜2025｜遠雄清水Monica", "2025-09"], ["corp", "金車", "活動 1 場｜2021｜金車", "2021-12"], ["ip", "Snoopy 史努比", "活動 6 場｜2023–2026｜2026Snoopy、Snoop雞蛋仔、蔚龍藝術Snoopy鴨、2024Snoopy第二檔、2024Snoopy第三檔、史奴比", "2025-12"], ["ip", "寬宏藝術（恐龍展・侏儸紀・微型車展・光影魔法）", "活動 6 場｜2019–2023｜寬宏光影魔法、嘉義水恐龍、恐龍展3.0、世界最大微型車展、台中恐龍展、侏儸紀x水世界", "2023-06"], ["ip", "東映動畫（七龍珠・DoReMi・動漫町・數碼寶貝）", "活動 4 場｜2020–2026｜東映-小魔女以及數碼寶貝、動漫町、魔法DoReMi、七龍珠快閃店", "2026-07"], ["ip", "Creema・文博會・華文朗讀節", "活動 3 場｜2019–2023｜文博會2023、華文朗讀節、Creema", "2023-09"], ["ip", "FOCASA 馬戲團", "活動 3 場｜2024–2026｜FOCASA馬戲團台中、FOCASA馬戲團、竹北兒童藝術節", "2026-02"], ["ip", "助六的日常", "活動 2 場｜2022–2023｜助六的日常、助六日常", "2022-12"], ["ip", "咒術迴戰", "活動 2 場｜2022｜咒術迴戰、咒術回戰", "2022-12"], ["ip", "美少女戰士", "活動 2 場｜2021–2022｜美少女戰士台中、美少女戰士咖啡廳", "2022-07"], ["ip", "黑熊", "活動 2 場｜2024–2025｜黑熊", "2025-04"], ["ip", "Ditto Friends", "活動 1 場｜2024｜DittoFriends", "2024-06"], ["ip", "Pazzlo 奶油家族", "活動 1 場｜2024｜Pazzlo奶油家族", "2024-06"], ["ip", "Z但幾勒", "活動 1 場｜2025｜紅玉滿雞蛋糕✗《Z但幾勒》", "2025"], ["ip", "teamLab", "活動 1 場｜2021｜TeamLab展覽", "2021-10"], ["ip", "三麗鷗", "活動 1 場｜2025｜三麗鷗男團", "2025"], ["ip", "卡娜赫拉", "活動 1 場｜2021｜卡納赫拉", "2021-08"], ["ip", "大嘴猴", "活動 1 場｜2025｜大嘴猴三十週年", "2025-12"], ["ip", "小人國", "活動 1 場｜2024｜2024小人國開模", "2024"], ["ip", "巧虎", "活動 1 場｜2024｜2024巧虎夢想樂園", "2024"], ["ip", "庫洛魔法使", "活動 1 場｜2023｜庫洛魔法使", "2023-02"], ["ip", "楓之谷", "活動 1 場｜2023｜楓之谷", "2023-08"], ["ip", "汪汪隊立大功", "活動 1 場｜2025｜汪汪隊立大功-有你共創", "2025-12"], ["ip", "粉紅豬小妹", "活動 1 場｜2020｜粉紅豬小妹", "2020-12"], ["ip", "胖虎", "活動 1 場｜2023｜胖虎", "2023-09"], ["ip", "蔚龍藝術", "活動 1 場｜2025｜蔚龍藝術Snoopy鴨", "2025-08"], ["ip", "蛋蛋怪", "活動 1 場｜2026｜蛋蛋怪到", "2026-01"], ["ip", "風車文化・Food 超人", "活動 1 場｜2025｜Food超人-風車文化", "2025-10"], ["ip", "鯊魚碰碰", "活動 1 場｜2022｜鯊魚碰碰", "2022-08"], ["ip", "黃阿瑪", "活動 1 場｜2022｜黃阿瑪冰菓室", "2022-07"], ["travel", "台北國際旅展 ITF・觀光博覽會", "活動 15 場｜2019–2025｜中美洲辦事處ITF旅展、TVA馬來西亞吉隆坡MATTA秋季旅展及觀光推廣活動、TVA越南2025年越南胡志明市ITE國際旅展及觀光推廣活動、高雄旅展臺北館、TVA泰國2025泰國春季旅展及觀光推廣活動、吉隆坡旅展、夏季旅展、台北觀博會、日本旅展、台北國際觀光博覽會、觀博會、台北國際旅展、台北夏季旅展、臺北ITF國際旅展臺北館", "2025-11"], ["travel", "客家美食展・甜點展・日本展", "活動 5 場｜2023–2025｜山海-茶烘焙博覽會、甜點展、宏匯日本展、客家美食展、日本展", "2025-12"], ["travel", "山海（4Foodie）", "櫃位・快閃 2 檔、活動 3 場｜2025–2026｜棧貳庫、山海大稻埕、山海、山海-茶烘焙博覽會、山海4Foodie", "2026-04"], ["travel", "六福村", "活動 2 場｜2023–2025｜藝力國際台達電六福村、六福村", "2025-11"], ["travel", "三井飯店", "活動 1 場｜2026｜三井飯店", "2026-04"], ["travel", "力麗觀光", "活動 1 場｜2025｜力麗觀光", "2025-11"], ["travel", "圓山大飯店", "活動 1 場｜2025｜愛普圓山飯店仁寶活動", "2025-10"], ["travel", "桃園機場（義美吉盛）", "櫃位・快閃 1 檔｜2025｜桃園機場第二航廈義美吉盛", "2025-11"], ["travel", "樸旅飯店", "活動 1 場｜2025｜樸旅飯店開模", "2025-11"], ["travel", "理想大地", "活動 1 場｜2025｜2025理想大地", "2025"], ["travel", "相鐵旅館", "活動 1 場｜2026｜相鐵旅館", "2026-02"], ["retail", "遠東百貨・SOGO", "櫃位・快閃 16 檔、活動 9 場｜2017–2025｜桃園大遠百、Sogo忠孝、Sogo中壢、竹北遠百、遠百A13、板橋大遠百、忠孝SOGO、中壢SOGO、大遠百板橋、Sogo天母、巡迴大遠百、板橋大遠百滿心集團、Sogo復興館、新竹SOGO、遠百板橋鐵道節、SOGO忠孝12樓、板橋大遠百5樓活動、VIP、桃園婦幼展", "2025-06"], ["retail", "新光三越", "櫃位・快閃 12 檔、活動 9 場｜2018–2025｜新光南西9樓、新光A8春發集市、新光A8一樓、台南新光三越西門新天地、新光三越台南新天地、@新光三越西門店、新光三越站前、新光南西、新光三越南西店、新光A8好朋友放閃計畫、新光三越A11、新光三越A8、新光美麗台、橄欖油、新光A11跨年活動、新光南西主廚快餐車", "2025-08"], ["retail", "環球購物中心", "櫃位・快閃 15 檔、活動 2 場｜2018–2026｜中和環球快閃、中和環球、中和環球Mia超市、環球左營、環球A8、單純剪＠環球板車、中和環球3樓、環球板橋車站、環球南港、環球板橋、環球中和、第二屆小小店長、小小店長", "2026-03"], ["retail", "美麗華百樂園", "櫃位・快閃 13 檔｜2020–2026｜美麗華", "2026-11"], ["retail", "三井（LaLaport・Outlet）", "櫃位・快閃 10 檔｜2018–2026｜三井南港LalaPort、南港Lalaport、台南三井、三井林口Mia超市、林口三井、三井林口", "2026-10"], ["retail", "微風", "櫃位・快閃 1 檔、活動 7 場｜2017–2025｜微風南山、微風之夜、Dunhill微風信義微風之夜、Dunhill微風之夜、APUJAN微風之夜", "2025-08"], ["retail", "誠品生活", "櫃位・快閃 7 檔｜2018–2025｜裕隆城誠品、誠品南西、台茂誠品、台茂誠品快閃、台茂誠品耶誕卡展、誠品站前店", "2025-04"], ["retail", "三創生活", "櫃位・快閃 4 檔、活動 2 場｜2019–2025｜三創、Intel", "2025-08"], ["retail", "巨城購物中心", "櫃位・快閃 6 檔｜2018–2024｜巨城", "2024-11"], ["retail", "統一時代百貨", "櫃位・快閃 3 檔、活動 3 場｜2018–2021｜統一時代、鬥牛、統一時代百貨、情人節統一時代百貨", "2021-04"], ["retail", "南紡購物中心", "櫃位・快閃 4 檔｜2023–2025｜南紡、南紡B1快閃、南紡Mia超市", "2025-04"], ["retail", "台茂購物中心", "櫃位・快閃 4 檔｜2020–2025｜誠品台茂、台茂、誠品禮物市集＠台茂", "2025-01"], ["retail", "大葉高島屋", "櫃位・快閃 4 檔｜2020–2023｜高島屋Mia超市、大葉高島屋", "2023-07"], ["retail", "華山 1914 文創園區", "櫃位・快閃 4 檔｜2020–2024｜Snoopy代代木＠華山、華山、@華山文創園區bySnake、華山1914文化創意發展園區", "2024-12"], ["retail", "宏匯廣場", "櫃位・快閃 2 檔、活動 1 場｜2020–2025｜宏匯廣場、新莊宏匯、宏匯日本展", "2025-06"], ["retail", "家樂福", "櫃位・快閃 3 檔｜2018–2020｜家樂福經國店、內壢家樂福、家樂福新店", "2020-01"], ["retail", "松山 CityLink", "櫃位・快閃 3 檔｜2018–2021｜松山Citylink、松山CityLink、Citylink松山", "2021-02"], ["retail", "京站時尚廣場", "櫃位・快閃 2 檔｜2020｜京站", "2020-08"], ["retail", "置地廣場", "櫃位・快閃 1 檔、活動 1 場｜2020–2021｜置地廣場", "2021-12"], ["retail", "華泰名品城", "櫃位・快閃 2 檔｜2025–2026｜華泰聖誕城、華泰名品城", "2026-11"], ["retail", "ATT 4 FUN", "櫃位・快閃 1 檔｜2019｜ATT大直", "2019-01"], ["retail", "HAPPY GO", "櫃位・快閃 1 檔｜2022｜HappyGO", "2022-12"], ["retail", "Mia 超市", "活動 1 場｜2023｜2023Mia超市", "2023"], ["retail", "京華城", "櫃位・快閃 1 檔｜2018｜京華城", "2018-06"], ["retail", "全家便利商店", "櫃位・快閃 1 檔｜2021｜全家北科", "2021-04"], ["retail", "台北 101", "櫃位・快閃 1 檔｜2020｜觀景台", "2020-07"], ["retail", "台北世貿", "櫃位・快閃 1 檔｜2024｜世貿", "2024-02"], ["retail", "大成好食城", "櫃位・快閃 1 檔｜2018｜南港中信-大成好食城", "2018-07"], ["retail", "大江購物中心", "櫃位・快閃 1 檔｜2020｜大江", "2020-07"], ["retail", "快食尚", "櫃位・快閃 1 檔｜2018｜快食尚", "2018-06"], ["retail", "比漾廣場", "櫃位・快閃 1 檔｜2021｜比漾永和", "2021-04"], ["retail", "漢神巨蛋", "櫃位・快閃 1 檔｜2025｜高雄漢神巨蛋", "2025-06"], ["retail", "秀泰生活", "櫃位・快閃 1 檔｜2019｜秀泰樹林", "2019-11"], ["retail", "統領廣場", "櫃位・快閃 1 檔｜2018｜統領桃園", "2018-09"], ["retail", "裕隆城", "櫃位・快閃 1 檔｜2025｜新店裕隆城", "2025-09"], ["retail", "遠雄廣場", "櫃位・快閃 1 檔｜2018｜遠雄廣場", "2018-08"], ["retail", "高雄夢時代", "櫃位・快閃 1 檔｜2024｜高雄夢時代快閃", "2024-11"], ["retail", "麗寶樂園", "櫃位・快閃 1 檔｜2025｜台中麗寶", "2025-08"], ["sport", "富邦（悍將・勇士）", "櫃位・快閃 1 檔、活動 9 場｜2019–2025｜富邦悍將、富邦悍將棒球、富邦勇士隊、2024富邦悍將、富邦勇士、富邦籃球、富邦勇士開幕賽", "2025-03"], ["sport", "Tomorrowland・KLASH 音樂祭", "活動 2 場｜2017–2018｜UNITE With Tomorrowland TAIWAN、KLASH", "2018-07"], ["sport", "UA 馬拉松博覽會", "活動 1 場｜2025｜UA馬拉松博覽會", "2025-12"], ["sport", "南西足球嘉年華", "活動 1 場｜2018｜南西足球嘉年華", "2018-06"], ["agency", "安益國際展覽", "活動 16 場｜2019–2025｜高雄旅展臺北館、夏季旅展、台北觀博會、文博會2023、安益、客家美食展、資策會、台北國際觀光博覽會、觀博會、你所未見的台北2.0、第6屆鐵路便當節、台北國際旅展、華航60周年、臺北ITF國際旅展臺北館、Undiscovered Taipei旅遊產品記者會觀傳局For泰國", "2025-05"], ["agency", "愛普整合行銷", "活動 10 場｜2019–2026｜愛普莫德納台北艾麗、愛普肺癌台大國際會議中心、愛普整合行銷有限公司、愛普圓山飯店仁寶活動、愛普、乳癌年會、GSK癲癇醫學、GSK舒酸定", "2026-07"], ["agency", "肯果・肯品行銷", "活動 10 場｜2023–2026｜金士頓、金士頓青年營、新北龜吼漁港、新北漁業處-肯果、龜吼市集、電玩展MSI、微星MSI-GQ潮流祭、微星、微星msi", "2026-09"], ["agency", "東冉", "活動 6 場｜2019–2024｜忠泰尾牙、[汎德BMW M TOWN]、BMW-M系列50週年台中、保時捷台北、富邦籃球、富邦勇士開幕賽", "2024-01"], ["agency", "眾奌溝通", "活動 6 場｜2023–2026｜眾奌溝通賓士、Boss、BOSS高雄漢神、賓士", "2026-06"], ["agency", "荷陽創意", "活動 5 場｜2022–2026｜台灣肺癌年會、荷陽行銷、荷陽創意台南大會展中心、荷陽創意", "2026-07"], ["agency", "品特", "活動 4 場｜2021–2023｜胖虎、美少女戰士台中、卡納赫拉、美少女戰士咖啡廳", "2023-09"], ["agency", "森肚", "活動 4 場｜2017–2020｜三星、GOGORO、gogoro2記者發表會", "2020-08"], ["agency", "加貝", "活動 3 場｜2019–2024｜加貝", "2024-03"], ["agency", "好攝", "活動 3 場｜2020–2021｜賀寶芙、南山家庭日", "2021-04"], ["agency", "寶悍運動", "活動 3 場｜2019｜最強市民飆5K、萬金石馬拉松開會、萬金石馬拉松記者會", "2019-12"], ["agency", "樺舍・樺群", "活動 3 場｜2020–2026｜FORD、CK、LEICA", "2026-01"], ["agency", "滿力國際", "活動 3 場｜2023–2026｜滿力、滿力國際台大國際會議中心、滿力國際", "2026-03"], ["agency", "羚羊", "活動 3 場｜2022–2023｜2023羚羊、助六的日常、助六日常", "2022-12"], ["agency", "藝力國際", "活動 3 場｜2024–2026｜中嘉家庭日、藝力國際台達電六福村、明基電通家庭日", "2026-09"], ["agency", "代代木", "活動 2 場｜2023–2025｜Snoop雞蛋仔、史奴比", "2025-12"], ["agency", "十二點原生", "活動 2 場｜2026｜十二原生VIVO兒童樂園、台灣賓士CLS發表", "2026-05"], ["agency", "啟點行銷", "活動 2 場｜2024–2025｜啟點行銷、外交部", "2024-02"], ["agency", "天紅", "活動 2 場｜2019–2020｜匯豐家庭日、VIS25", "2020-10"], ["agency", "快達", "活動 2 場｜2019–2021｜2021LV品牌活動、BENZ巡迴", "2019-10"], ["agency", "皮爾森", "活動 2 場｜2020–2023｜楓之谷、UBEREATS推廣", "2023-08"], ["agency", "芮安", "活動 2 場｜2020–2022｜眼科年會、醫療展", "2022-08"], ["agency", "靈一廣告", "活動 2 場｜2026｜活動靈一廣告、新北大都會公園", "2026-05"], ["agency", "飛虹", "活動 2 場｜2024｜新唐家庭日活動、GUC", "2024-09"], ["agency", "三七木肆", "活動 1 場｜2024｜Dyson", "2024-06"], ["agency", "三聯演義", "活動 1 場｜2026｜安曼嘉年華", "2026-05"], ["agency", "傑麒", "活動 1 場｜2024｜淡水漁人碼頭", "2024-12"], ["agency", "利眾", "活動 1 場｜2022｜舒酸定", "2022-11"], ["agency", "原力創造", "活動 1 場｜2021｜富邦勇士", "2021-12"], ["agency", "台灣筆克", "活動 1 場｜2025｜亞馬遜資訊", "2025-05"], ["agency", "大氣行銷", "活動 1 場｜2024｜大氣行銷", "2024-03"], ["agency", "奈克", "活動 1 場｜2026｜台大博雅館", "2026-05"], ["agency", "好好集", "活動 1 場｜2018｜彩虹廣場", "2018-04"], ["agency", "好日子", "活動 1 場｜2024｜中華賓士", "2024-05"], ["agency", "好食課", "活動 1 場｜2025｜明治奶粉", "2025-06"], ["agency", "學思", "活動 1 場｜2023｜九和汽車", "2023-08"], ["agency", "寬微廣告", "活動 1 場｜2026｜寬微廣告", "2026-01"], ["agency", "弘遠行銷", "活動 1 場｜2024｜中壢", "2024-05"], ["agency", "微逗國際", "活動 1 場｜2022｜微逗國際IP經紀", "2022"], ["agency", "惟文", "活動 1 場｜2025｜GSK家庭日", "2025-05"], ["agency", "拾酷創意", "活動 1 場｜2024｜Honda", "2024-11"], ["agency", "有創", "活動 1 場｜2022｜黃阿瑪冰菓室", "2022-07"], ["agency", "榮樂", "活動 1 場｜2025｜鴻海尾牙", "2025-01"], ["agency", "知和公關", "活動 1 場｜2026｜知和公關Chanel", "2026-05"], ["agency", "立合", "活動 1 場｜2020｜台積電18廠", "2020-08"], ["agency", "立瑋", "活動 1 場｜2024｜天義", "2024-01"], ["agency", "築夢", "活動 1 場｜2025｜中華汽車", "2025-07"], ["agency", "米恩", "活動 1 場｜2024｜黑熊", "2024-07"], ["agency", "耀陽數位", "活動 1 場｜2024｜HALEON", "2024-03"], ["agency", "艾諾可", "活動 1 場｜2024｜遠東商銀", "2024-03"], ["agency", "達日好", "活動 1 場｜2025｜鴻騰精密", "2025-01"], ["agency", "采登", "活動 1 場｜2019｜探索生活節Didcovery", "2019-10"], ["agency", "野鵝快跑", "活動 1 場｜2021｜寶藏巖光節", "2021-03"], ["agency", "集思國際", "活動 1 場｜2024｜rmp 肺炎年會", "2024-04"], ["agency", "高藝", "活動 1 場｜2020｜全國三星教育訓練", "2020-09"]];
function v51_ptSeed() {
  var sh = v42_s_('合作夥伴牆', V51_PT_HEAD), have = {}, add = [], t = v39_now_();
  v51_ptRows_().forEach(function (x) { have[x.name] = 1; });
  V51_PT_SEED.forEach(function (r, i) { if (!have[r[1]] && v51_ptCat_(r[0])) add.push([t, 'PT' + (Date.now() + i), r[0], r[1], r[2], r[3], 'seed', '資料夾歸類', '', '', '']); });
  if (add.length) { sh.getRange(sh.getLastRow() + 1, 1, add.length, V51_PT_HEAD.length).setNumberFormat('@').setValues(add); }
  Logger.log('v1.51 合作夥伴牆初始名單：新增 ' + add.length + ' 筆'); return add.length;
}
function v51_setup() {
  v42_s_('願景白板', V51_VS_HEAD); v42_s_('Bug回報', V51_BUG_HEAD); v42_s_('合作夥伴牆', V51_PT_HEAD); v42_s_('合作夥伴照片', V51_PP_HEAD);
  var have = {}; gm_rows_('params').forEach(function (r) { have[String(r[0]).trim()] = 1; });
  if (!have['Bug回報獎勵']) gm_append_('params', [['Bug回報獎勵', 5, 'v1.51：大隊長把 Bug 回報標成「有效」或「已修好」時，回報的人得到的赤心幣（每則一次）']]);
  Logger.log('v1.51 setup 完成'); return 'ok';
}
AU_READ = new RegExp(AU_READ.source.replace(/\)\$$/, '|visionList|bugList|bugShot|ptList|ptPhotos|ptPhotoGet)$'));
function v51Handler_(action, p) {
  var map = { visionList: v51_visionList_, visionSave: v51_visionSave_, visionSuggest: v51_visionSuggest_, visionDelSug: v51_visionDelSug_,
              bugReport: v51_bugReport_, bugList: v51_bugList_, bugShot: v51_bugShot_, bugSet: v51_bugSet_,
              ptList: v51_ptList_, ptSave: v51_ptSave_, ptPhoto: v51_ptPhoto_, ptPhotos: v51_ptPhotos_, ptPhotoGet: v51_ptPhotoGet_, ptPhotoDel: v51_ptPhotoDel_ };
  var f = map[action]; if (!f) return null;
  var lock = null;
  if (/^(visionSave|visionSuggest|visionDelSug|bugReport|bugSet|ptSave|ptPhoto|ptPhotoDel)$/.test(action)) { lock = LockService.getScriptLock(); lock.waitLock(15000); }
  try { OPS_C_ = {}; GM_CACHE_ = {}; return f(p || {}); } catch (e) { return { error: e.message }; }
  finally { if (lock) lock.releaseLock(); }
}

// ═══════════════════════════════════════════════
// v1.53 模組（2026-11-15）：累計工時修正
// 貼在第 49 版最下面、路由 v1.51 之前（不用換路由，沒有新動作）
// 問題（隊長 11/15 01:04 回報「我的 → 累計工時」沒有算到 11/14）：
//   1. 舊的 updateAccumulatedHours（每天凌晨 2 點）用「班表編號」配對上下班；現在打卡多半沒有班表編號，
//      同一個人所有打卡被當成同一班 → 11 月工時根本沒寫進〈累計工時〉（大隊長停在 9009.3）。
//   2. 〈累計工時〉的「年月」欄被試算表自動轉成日期，比對不到舊列 → 每天重複新增一列；同月有兩列有工時時會重複加總（例：E010 20.8）。
//   3. 「我的」頁只讀這張表，要等隔天凌晨才會更新。
// 修正：
//   - 覆蓋 getStaffInfo：累計工時改成「期初累計工時（夥伴資料 AV 欄）＋所有已下班的打卡（含打卡紀錄_歷史）」即時計算，
//     配對方式和薪資引擎一樣（pay3_pairHours_：上班往後、下班往前對齊半點；同一天同櫃位一組；異常未下班且未補登的不算）。
//     下班打卡後馬上算進去；津貼等級也依這個數字顯示。
//   - 覆蓋 updateAccumulatedHours：每天凌晨重建〈累計工時〉（每人每月一列，年月存文字），並同步夥伴資料技能／貢獻津貼等級（同 syncBaselineForAll 門檻，只往上調不往下調）。
//   - v53_setup()：先把舊〈累計工時〉複製成隱藏備份分頁〈累計工時_備份_v153〉，再重建一次。
// ═══════════════════════════════════════════════
function v53_ym_(v) { return v instanceof Date ? Utilities.formatDate(v, 'Asia/Taipei', 'yyyy-MM') : String(v || '').trim().replace('/', '-').slice(0, 7); }
var V53_C_ = null;
function v53_monthly_(ss) {   // → { emp: { 'yyyy-MM': 小時 } }
  if (V53_C_) return V53_C_;
  var punches = {};
  ['打卡紀錄_歷史', '打卡紀錄'].forEach(function (n) {
    var sh = ss.getSheetByName(n); if (!sh || sh.getLastRow() < 2) return;
    var nc = Math.min(sh.getLastColumn(), 17);
    sh.getRange(2, 1, sh.getLastRow() - 1, nc).getValues().forEach(function (r) {
      var eid = String(r[2]).trim(); if (!eid) return;
      var flag = String(r[16] || '');
      if (flag.indexOf('異常未下班') >= 0 && flag.indexOf('已由管理員補登') < 0) return;
      var t = r[6] instanceof Date ? r[6] : (r[6] ? new Date(r[6]) : null); if (!t || isNaN(t.getTime())) return;
      var d = Utilities.formatDate(t, 'Asia/Taipei', 'yyyy-MM-dd'), loc = String(r[9] || '').trim();
      var k = eid + '|' + d + '|' + loc;
      (punches[k] = punches[k] || []).push({ type: String(r[5]).trim(), t: t.getTime(), loc: loc });
    });
  });
  var out = {};
  Object.keys(punches).forEach(function (k) {
    var a = k.split('|'), h = pay3_pairHours_(punches[k]).hrs; if (!(h > 0)) return;
    var ym = a[1].slice(0, 7); out[a[0]] = out[a[0]] || {}; out[a[0]][ym] = (out[a[0]][ym] || 0) + h;
  });
  return (V53_C_ = out);
}
function v53_levels_(cum) {
  var skill = cum >= 180 ? 20 : 0, contrib = cum >= 4320 ? 20 : cum >= 3240 ? 15 : cum >= 2160 ? 10 : cum >= 1080 ? 5 : 0;
  return { skill: skill, contrib: contrib };
}
function v53_cum_(ss, emp, baseline) {
  var m = v53_monthly_(ss)[emp] || {}, h = Number(baseline) || 0;
  Object.keys(m).forEach(function (ym) { h += m[ym]; });
  return Math.round(h * 10) / 10;
}

// ── 覆蓋：讀取個人資料（累計工時即時計算）──
function getStaffInfo(ss, params) {
  const empId = String(params.empId || "");
  const staffData = ss.getSheetByName("夥伴資料").getDataRange().getValues();
  const emp = staffData.find(r => String(r[0]) === empId);
  if (!emp) return { error: "找不到夥伴資料" };
  const accumulated = v53_cum_(ss, empId, parseFloat(emp[47]) || 0);
  const lv = v53_levels_(accumulated);
  return {
    success: true,
    data: {
      accumulated,
      leaveBalance:  0,
      skillLevel:    Math.max(lv.skill, parseFloat(emp[32]) || 0),
      contribLevel:  Math.max(lv.contrib, parseFloat(emp[33]) || 0),
      longAge:       parseFloat(emp[34]) || 0,
      labor:         parseFloat(emp[21]) || 0,
      health:        parseFloat(emp[26]) || 0,
      noInsure:      parseFloat(emp[29]) || 0,
      checkupExpiry: String(emp[31] || ""),
      bank:          String(emp[15] || ""),
      accountStatus: String(emp[16] || ""),
    }
  };
}

// ── 覆蓋：每日更新累計工時（重建整張表，不再重複新增）──
function updateAccumulatedHours() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  V53_C_ = null;
  const hoursSheet = ss.getSheetByName("累計工時"), staffSheet = ss.getSheetByName("夥伴資料");
  const staff = staffSheet.getDataRange().getValues(), monthly = v53_monthly_(ss);
  const rows = [], levels = [];
  for (let s = 1; s < staff.length; s++) {
    const id = String(staff[s][0]).trim(); if (!id) { levels.push(null); continue; }
    const base = parseFloat(staff[s][47]) || 0, m = monthly[id] || {}, yms = Object.keys(m).sort();
    let cum = base;
    if (!yms.length && base > 0) rows.push([id, String(staff[s][1]), Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM'), 0, 0, 0, base, "", "", "(期初值,無打卡紀錄)"]);
    yms.forEach(ym => {
      const h = Math.round(m[ym] * 10) / 10; cum += m[ym];
      const lv = v53_levels_(cum);
      rows.push([id, String(staff[s][1]), ym, h, 0, h, Math.round(cum * 10) / 10, lv.skill, lv.contrib, ""]);
    });
    levels.push(v53_levels_(cum));
  }
  const n = hoursSheet.getLastRow();
  if (n > 1) hoursSheet.getRange(2, 1, n - 1, Math.max(10, hoursSheet.getLastColumn())).clearContent();
  if (n - 1 > rows.length && rows.length > 0) { try { hoursSheet.deleteRows(rows.length + 2, n - 1 - rows.length); } catch (e) {} }
  if (rows.length) { hoursSheet.getRange(2, 3, rows.length, 1).setNumberFormat('@'); hoursSheet.getRange(2, 1, rows.length, 10).setValues(rows); }
  // 同步津貼等級到夥伴資料（AG＝技能、AH＝貢獻）：只往上調、不往下調
  // （很多人還沒填「期初累計工時」，算出來的數字可能比實際少；手動設定的等級不能被降掉，以免薪資津貼變少）
  for (let s = 1; s < staff.length; s++) {
    const lv = levels[s - 1]; if (!lv || staff[s][10]) continue;   // 離職（K 欄有值）不動
    if (lv.skill > (parseFloat(staff[s][32]) || 0)) staffSheet.getRange(s + 1, 33).setValue(lv.skill);
    if (lv.contrib > (parseFloat(staff[s][33]) || 0)) staffSheet.getRange(s + 1, 34).setValue(lv.contrib);
  }
  if (typeof GM_CACHE_ !== 'undefined') GM_CACHE_.s30cum = null;
  return rows.length;
}

// ── 部署後執行一次：備份舊表 → 重建 ──
function v53_setup() {
  const ss = SpreadsheetApp.openById(SHEET_ID), src = ss.getSheetByName("累計工時");
  if (src && !ss.getSheetByName("累計工時_備份_v153")) { const b = src.copyTo(ss); b.setName("累計工時_備份_v153"); b.hideSheet(); }
  const n = updateAccumulatedHours();
  Logger.log('v1.53 累計工時重建完成：' + n + ' 列'); return n;
}

// ═══════════════════════════════════════════════
// v1.54 模組（2026-11-15）：「我的」顯示到職日與年資
// 貼在第 50 版最下面、路由 v1.51 之前（不用換路由）。覆蓋 getStaffInfo（以 v1.53 為底，只多回傳 hireDate）。
// 到職日在〈夥伴資料〉J 欄，格式有 2023/01/01、2026-05-01 或日期，一律轉成 yyyy-MM-dd；空白回傳 ''。
// ═══════════════════════════════════════════════
function v54_ymd_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return Utilities.formatDate(v, 'Asia/Taipei', 'yyyy-MM-dd');
  var m = /^(\d{2,4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/.exec(String(v || '').trim()); if (!m) return '';
  var y = Number(m[1]); if (y < 1000) y += 1911;   // 民國年
  return y + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
}
// ── 覆蓋（v1.54，以 v1.53 為底）：讀取個人資料＋到職日 hireDate（yyyy-MM-dd）──
function getStaffInfo(ss, params) {
  const empId = String(params.empId || "");
  const staffData = ss.getSheetByName("夥伴資料").getDataRange().getValues();
  const emp = staffData.find(r => String(r[0]) === empId);
  if (!emp) return { error: "找不到夥伴資料" };
  const accumulated = v53_cum_(ss, empId, parseFloat(emp[47]) || 0);
  const lv = v53_levels_(accumulated);
  return {
    success: true,
    data: {
      accumulated,
      leaveBalance:  0,
      skillLevel:    Math.max(lv.skill, parseFloat(emp[32]) || 0),
      contribLevel:  Math.max(lv.contrib, parseFloat(emp[33]) || 0),
      longAge:       parseFloat(emp[34]) || 0,
      labor:         parseFloat(emp[21]) || 0,
      health:        parseFloat(emp[26]) || 0,
      noInsure:      parseFloat(emp[29]) || 0,
      checkupExpiry: String(emp[31] || ""),
      bank:          String(emp[15] || ""),
      accountStatus: String(emp[16] || ""),
      hireDate:      v54_ymd_(emp[9]),
    }
  };
}


// ═══════════════════════════════════════════════
// v1.55 模組（2026-11-15）：行事曆改日期修正
// 貼在第 51 版最下面、路由 v1.51 之前（不用換路由、沒有新動作、不用 setup）。覆蓋 cal_save_。
// 問題（隊長 11/15 01:48）：把跨天行程（11/15～11/16）改成只留 11/15，儲存成功，但 3 秒後重讀又變回 11/15～11/16
//   → Google 日曆實際上沒有改成功（v1.54 已排除手機快取）。
// 修正：
//   1. 整天行程的日期改用「指令碼時區的午夜」建立（setAllDayDates 會忽略時間，只看日期；原本用 +08:00 的時間點，
//      如果指令碼時區不是台北，日期可能差一天）。
//   2. 單日用 setAllDayDate；多日用 setAllDayDates。存完立刻重讀那一筆核對日期；不對就改用「結束日含當天」再試一次；
//      還是不對就刪掉重建（設備檢查清單連到的行程編號一起換新，不會重複）。
//   3. 回傳 Google 日曆上實際的日期（date／end），App 以這個為準。
//   4. 身分改用登入通行證（au_verifiedId_），沒有通行證就擋（照部署交接安全規則）。
// ═══════════════════════════════════════════════
function v55_tz_() { try { return Session.getScriptTimeZone() || 'Asia/Taipei'; } catch (e) { return 'Asia/Taipei'; } }
function v55_day_(ymd, plus) {   // 指令碼時區的午夜
  var a = String(ymd).split('-').map(Number); return new Date(a[0], a[1] - 1, a[2] + (plus || 0));
}
function v55_evDays_(ev) {   // → { date, end }（整天行程，結束日含當天）
  var tz = v55_tz_();
  if (!ev.isAllDayEvent()) { var st = ev.getStartTime(), en = ev.getEndTime(); return { date: Utilities.formatDate(st, 'Asia/Taipei', 'yyyy-MM-dd'), end: Utilities.formatDate(en, 'Asia/Taipei', 'yyyy-MM-dd') }; }
  var s = ev.getAllDayStartDate(), e = ev.getAllDayEndDate();   // e＝結束日隔天的午夜
  return { date: Utilities.formatDate(s, tz, 'yyyy-MM-dd'), end: Utilities.formatDate(new Date(e.getTime() - 3600000), tz, 'yyyy-MM-dd') };
}
function v55_setAllDay_(ev, date, end) {
  if (date === end) ev.setAllDayDate(v55_day_(date)); else ev.setAllDayDates(v55_day_(date), v55_day_(end, 1));
}
function v55_reId_(oldId, newId) {   // 設備檢查清單 → 行程編號 對應表換成新編號
  try {
    var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('設備清單行程'); if (!sh || sh.getLastRow() < 2) return;
    var v = sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < v.length; i++) if (String(v[i][0]) === oldId) sh.getRange(i + 2, 2).setValue(newId);
  } catch (e) {}
}
function cal_save_(p) {
  var emp = au_verifiedId_(); if (!emp) return { error: '請重新登入後再試', relogin: true };
  var me = gm_emp_(emp); if (!me || me.role < 3) return { error: '需要 Lv.3 以上' };
  if (p._viewAs) return { error: '預覽模式只能看' };
  var src = p.src === 'personal' ? 'personal' : 'company';
  if (src === 'personal' && !cal_isBoss_(emp)) return { error: '只有大隊長可以使用個人行事曆' };
  var cal = src === 'personal' ? cal_personal_() : cal_company_(); if (!cal) return { error: src === 'personal' ? '個人行事曆還沒連結（〈遊戲參數〉大隊長行事曆ID）' : '找不到「紅玉滿行事曆」' };
  var title = String(p.title || '').trim().slice(0, 60); if (!title) return { error: '請填標題' };
  var date = gm27_ymd_(p.date), end = gm27_ymd_(p.end) || date; if (!date) return { error: '請選日期' };
  if (end < date) end = date;
  var cat = CAL_CATS.indexOf(p.cat) >= 0 ? p.cat : '其他';
  var desc = (String(p.desc || '').trim().slice(0, 1000) + '\n分類：' + cat).trim(), opt = { description: desc, location: String(p.loc || '').slice(0, 100) };
  var allDay = !p.start, ev, id, note = '';
  var s = allDay ? null : new Date(date + 'T' + p.start + ':00+08:00');
  var e = allDay ? null : new Date(end + 'T' + (p.endTime || p.start) + ':00+08:00');
  if (!allDay && e <= s) e = new Date(s.getTime() + 3600000);
  if (p.id) {
    ev = cal.getEventById(String(p.id)); if (!ev) return { error: '找不到這個行程' };
    ev.setTitle(title); ev.setDescription(desc); ev.setLocation(opt.location);
    if (!allDay) ev.setTime(s, e);
    else {
      v55_setAllDay_(ev, date, end);
      var got = v55_evDays_(cal.getEventById(String(p.id)) || ev);
      if (got.date !== date || got.end !== end) {   // 第二次：結束日當成含當天
        try { ev.setAllDayDates(v55_day_(date), v55_day_(end)); } catch (x) {}
        got = v55_evDays_(cal.getEventById(String(p.id)) || ev);
      }
      if (got.date !== date || got.end !== end) {   // 還是不對：刪掉重建
        var old = String(p.id);
        var nw = date === end ? cal.createAllDayEvent(title, v55_day_(date), opt) : cal.createAllDayEvent(title, v55_day_(date), v55_day_(end, 1), opt);
        try { ev.deleteEvent(); } catch (x) {}
        ev = nw; v55_reId_(old, nw.getId()); note = 'recreated';
      }
    }
  } else ev = allDay ? (date === end ? cal.createAllDayEvent(title, v55_day_(date), opt) : cal.createAllDayEvent(title, v55_day_(date), v55_day_(end, 1), opt)) : cal.createEvent(title, s, e, opt);
  id = ev.getId();
  var fin = v55_evDays_(cal.getEventById(id) || ev);
  return { success: true, id: id, date: fin.date, end: fin.end, note: note };
}

// ── 部署端修正（v1.55，2026-11-15 部署端加）：真正原因是「紅玉滿行事曆」的時區是 UTC（指令碼是 Asia/Taipei）──
//   整天行程的 getStartTime／getEndTime 是 UTC 午夜，原本 cal_ev_ 用台北時間格式化 → 結束日多一天
//   （賓士家庭日在 Google 上其實已經是 11/15 一天，App 卻顯示 11/15～11/16）。
//   整天行程改用 getAllDayStartDate／getAllDayEndDate（v55_evDays_，指令碼時區）；cal_list_ 另外排除不在查詢範圍內的行程
//   （UTC 午夜到午夜會跨到台北隔天早上 8 點，前一天的整天行程會被一起抓到）。
function cal_ev_(ev, src) {
  var all = ev.isAllDayEvent(), st = ev.getStartTime(), en = ev.getEndTime(), f = function (d, fmt) { return Utilities.formatDate(d, 'Asia/Taipei', fmt); };
  var desc = String(ev.getDescription() || ''), dd = all ? v55_evDays_(ev) : null;
  return { id: ev.getId(), src: src, title: ev.getTitle(), allDay: all, date: all ? dd.date : f(st, 'yyyy-MM-dd'), end: all ? dd.end : f(en, 'yyyy-MM-dd'),
    start: all ? '' : f(st, 'HH:mm'), endTime: all ? '' : f(en, 'HH:mm'), loc: String(ev.getLocation() || ''), cat: cal_cat_(desc),
    desc: desc.replace(/\n?分類[:：]\s*\S+/, '').trim() };
}
function cal_list_(p) {
  var emp = String(p.empId || ''), from = gm27_ymd_(p.from) || gm_today_(), to = gm27_ymd_(p.to) || gm_addDays_(from, 41);
  var a = new Date(from + 'T00:00:00+08:00'), b = new Date(to + 'T23:59:59+08:00'), out = [];
  var c = cal_company_(); if (c) c.getEvents(a, b).forEach(function (ev) { out.push(cal_ev_(ev, 'company')); });
  if (cal_isBoss_(emp)) { var pc = cal_personal_(); if (pc) pc.getEvents(a, b).forEach(function (ev) { out.push(cal_ev_(ev, 'personal')); }); }
  out = out.filter(function (x) { return !(x.end < from || x.date > to); });
  out.sort(function (x, y) { return (x.date + x.start) < (y.date + y.start) ? -1 : 1; });
  return { success: true, data: out, cats: CAL_CATS, ready: { company: !!c, personal: cal_isBoss_(emp) ? !!cal_personal_() : null },
    canEdit: (gm_emp_(emp) || {}).role >= 3, isBoss: cal_isBoss_(emp) };
}

// ═══════════════════════════════════════════════
// 路由 extHandler_ v1.51（2026-11-15）
// 放在檔案最後，取代 v1.49 的 extHandler_。和 v1.49 完全相同，只是把 v47Route_ 換成 v51Route_（多接 v51Handler_）。
// 保留 v48_gate_、getMyIns、外部帳號擋法、v49_filter_、v41_wordRes_。
// ═══════════════════════════════════════════════
function v51Route_(action, p) {
  p = p || {};
  if (/^(visionList|visionSave|visionSuggest|visionDelSug|bugReport|bugList|bugShot|bugSet|ptList|ptSave|ptPhoto|ptPhotos|ptPhotoGet|ptPhotoDel)$/.test(String(action))) {
    var gate = au_gate_(action, p); if (gate) return gate;
    var au = auHandler_(action, p); if (au) return au;   // 設定 AU_REQ_（au_verifiedId_ 用）
    return v51Handler_(action, p);
  }
  return v47Route_(action, p);
}
function extHandler_(action, p) {
  p = p || {};
  var g48 = v48_gate_(action, p); if (g48) return v41_wordRes_(g48);
  if (action === 'getMyIns') {   // v1.43（部署端合併版）照舊
    var gate = au_gate_(action, p); if (gate) return v41_wordRes_(gate);
    try { return v41_wordRes_(v43_myIns_(p)); } catch (e) { return { error: '勞健保資料錯誤:' + e.message }; }
  }
  var me = /^(gmScene|gmMe|v39Rev|v39RevBoard|getBatterStock|getShortages|v40Notes|v47Notes|calList|schBoard|opsStaffList|tdMe|tdGive|bfApply|spOpen)$/.test(String(action)) ? v49_viewer_(p) : null;
  if (me) {
    if ((action === 'tdMe' || action === 'tdGive') && v49_isExt_(me)) return v41_wordRes_({ error: '櫃位爭霸戰只限總部櫃位' });
    if (action === 'bfApply' && me.type !== '員工') return v41_wordRes_({ error: '福利補助只給總部員工；加盟店的福利請洽加盟主' });
    if (action === 'spOpen' && me.type === '合作夥伴') return v41_wordRes_({ error: '合作品牌帳號不開小店，可以逛隊員商店街購買' });
    if (action === 'gmMe' || action === 'gmScene') { try { v49_quota_(me); } catch (e) {} }
  }
  var r = v51Route_(action, p);
  try { r = v49_filter_(action, p, r, me); } catch (e) {}
  return v41_wordRes_(r);
}
