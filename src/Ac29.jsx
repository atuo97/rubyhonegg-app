// v1.29 內帳（只有大隊長）：損益看板、明細、記一筆、匯入／匯出營收總表 Excel
import { useState, useEffect } from "react";

const fmt = n => Math.round(Number(n) || 0).toLocaleString("zh-TW");
const PERIODS = (() => { const out = [], now = new Date(Date.now() + 8 * 3600e3); let y = now.getUTCFullYear(), m = now.getUTCMonth() + 1; m = m % 2 ? m : m - 1;
  for (let i = 0; i < 12; i++) { out.push({ from: `${y}-${String(m).padStart(2, "0")}-01`, to: `${y}-${String(m + 1).padStart(2, "0")}-31`, label: `${y - 1911} 年 ${m}-${m + 1} 月`, file: `營收總表${y - 1911} ${String(m).padStart(2, "0")}-${String(m + 1).padStart(2, "0")}` }); m -= 2; if (m < 1) { m = 11; y--; } }
  return out; })();

export function AcPage({ user, apiGet, apiPost, C, s, uploadPhoto, todayStr }) {
  const [tab, setTab] = useState("board");
  const [meta, setMeta] = useState(null);
  useEffect(() => { apiGet({ action: "acMeta" }, 1).then(r => setMeta(r && r.success ? r.data : { error: (r && r.error) || "讀取失敗" })); }, []);
  if (!meta) return <div className="rh-skel" style={{ height: 160, borderRadius: 18 }} />;
  if (meta.error) return <div style={{ ...s.card, color: C.muted, textAlign: "center" }}>{/未知/.test(meta.error) ? "內帳還沒開通（後端更新到 v1.29 後就會出現）" : meta.error}</div>;
  const T = [["board", "損益看板"], ["list", "明細"], ["add", "記一筆"], ["io", "匯入／匯出"]];
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {T.map(([k, l]) => <button key={k} onClick={() => setTab(k)} style={{ flex: 1, border: `1px solid ${tab === k ? C.accent : C.border}`, background: tab === k ? C.accentBg : C.card, color: tab === k ? C.accent : C.text, borderRadius: 999, padding: "8px 0", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>)}
      </div>
      {tab === "board" && <Board apiGet={apiGet} C={C} s={s} />}
      {tab === "list" && <List meta={meta} apiGet={apiGet} apiPost={apiPost} C={C} s={s} uploadPhoto={uploadPhoto} todayStr={todayStr} />}
      {tab === "add" && <Editor meta={meta} apiPost={apiPost} C={C} s={s} uploadPhoto={uploadPhoto} todayStr={todayStr} onDone={() => setTab("list")} />}
      {tab === "io" && <ImportExport apiGet={apiGet} apiPost={apiPost} C={C} s={s} />}
    </div>
  );
}

function Board({ apiGet, C, s }) {
  const [y, setY] = useState(String(new Date().getFullYear())), [d, setD] = useState(null);
  useEffect(() => { setD(null); apiGet({ action: "acSummary", year: y }, 1).then(r => setD(r && r.success ? r.data : { error: (r && r.error) || "讀取失敗" })); }, [y]);
  if (!d) return <div className="rh-skel" style={{ height: 200, borderRadius: 18 }} />;
  if (d.error) return <div style={{ ...s.card, color: C.red }}>{d.error}</div>;
  const max = Math.max(1, ...d.months.map(m => Math.max(m.inc, m.exp)));
  const cats = Object.entries(d.total.expCat).sort((a, b) => b[1] - a[1]), ctot = Math.max(1, d.total.exp);
  return (
    <div>
      <div style={s.card}>
        <select value={y} onChange={e => setY(e.target.value)} style={{ ...s.input, marginBottom: 10 }}>{[0, 1, 2].map(k => { const v = String(new Date().getFullYear() - k); return <option key={v} value={v}>{v - 1911} 年（{v}）</option>; })}</select>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, textAlign: "center" }}>
          {[["收入", d.total.inc, C.green], ["支出", d.total.exp, C.red], ["淨額", d.total.net, d.total.net >= 0 ? C.text : C.red]].map(([l, v, c]) =>
            <div key={l} style={{ minWidth: 0 }}><div style={{ fontSize: 11, color: C.muted }}>{l}</div><div style={{ fontSize: 14.5, fontWeight: 700, color: c, whiteSpace: "nowrap" }}>{fmt(v)}</div></div>)}
        </div>
      </div>
      <div style={s.card}>
        <div style={s.sectionTitle}>每月收支（發票金額，含稅）</div>
        {d.months.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>這一年還沒有資料</div>}
        {d.months.map(m => <div key={m.ym} style={{ padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><b>{Number(m.ym.slice(5))} 月</b><span style={{ color: m.net >= 0 ? C.green : C.red, fontWeight: 600 }}>淨 {fmt(m.net)}</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}><span style={{ fontSize: 11, color: C.muted, width: 26 }}>收</span><div style={{ flex: 1, height: 7, background: C.border, borderRadius: 4, overflow: "hidden" }}><div style={{ width: m.inc / max * 100 + "%", height: "100%", background: C.green }} /></div><span style={{ fontSize: 11.5, width: 78, textAlign: "right" }}>{fmt(m.inc)}</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}><span style={{ fontSize: 11, color: C.muted, width: 26 }}>支</span><div style={{ flex: 1, height: 7, background: C.border, borderRadius: 4, overflow: "hidden" }}><div style={{ width: m.exp / max * 100 + "%", height: "100%", background: C.red }} /></div><span style={{ fontSize: 11.5, width: 78, textAlign: "right" }}>{fmt(m.exp)}</span></div>
          {m.storeRev > 0 && <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>App 收店營業額（對照）{fmt(m.storeRev)}</div>}
        </div>)}
      </div>
      {cats.length > 0 && <div style={s.card}>
        <div style={s.sectionTitle}>支出類別（全年）</div>
        {cats.map(([c, v]) => <div key={c} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 13 }}>
          <span style={{ width: 70 }}>{c}</span><div style={{ flex: 1, height: 8, background: C.border, borderRadius: 4, overflow: "hidden" }}><div style={{ width: v / ctot * 100 + "%", height: "100%", background: C.accent }} /></div>
          <span style={{ width: 92, textAlign: "right" }}>{fmt(v)} <span style={{ fontSize: 11, color: C.muted }}>{Math.round(v / ctot * 100)}%</span></span></div>)}
        {Object.keys(d.total.incCat).length > 0 && <>
          <div style={{ ...s.sectionTitle, marginTop: 12 }}>收入類別（全年）</div>
          {Object.entries(d.total.incCat).sort((a, b) => b[1] - a[1]).map(([c, v]) => <div key={c} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}><span>{c}</span><span>{fmt(v)}</span></div>)}
        </>}
      </div>}
      {d.warn.length > 0 && <div style={{ ...s.card, borderLeft: `4px solid ${C.gold}` }}>
        <div style={s.sectionTitle}>⚠️ 要注意的資料（{d.warn.length}）</div>
        {d.warn.map((w, i) => <div key={i} style={{ fontSize: 12.5, padding: "4px 0", borderBottom: `1px solid ${C.border}` }}>{w.date}・{w.unit || "—"}・{fmt(w.amt)}：<span style={{ color: C.gold }}>{w.text}</span></div>)}
        <div style={{ fontSize: 11.5, color: C.light, marginTop: 6 }}>到「明細」找到那一筆，點一下就能改</div>
      </div>}
    </div>
  );
}

function List({ meta, apiGet, apiPost, C, s, uploadPhoto, todayStr }) {
  const [p, setP] = useState(0), [io, setIo] = useState(""), [cat, setCat] = useState(""), [q, setQ] = useState(""), [d, setD] = useState(null), [edit, setEdit] = useState(null);
  const per = PERIODS[p];
  const load = () => { setD(null); apiGet({ action: "acList", from: per.from, to: per.to, io, cat }, 0).then(r => setD(r && r.success ? r.data : [])); };
  useEffect(() => { load(); }, [p, io, cat]);
  if (edit) return <Editor meta={meta} apiPost={apiPost} C={C} s={s} uploadPhoto={uploadPhoto} todayStr={todayStr} init={edit} onDone={() => { setEdit(null); load(); }} onCancel={() => setEdit(null)} />;
  const list = (d || []).filter(x => !q || (x.unit + x.sub + x.note + x.cat).includes(q));
  const inc = list.filter(x => x.io === "收入").reduce((a, x) => a + x.amt, 0), exp = list.filter(x => x.io !== "收入").reduce((a, x) => a + x.amt, 0);
  return (
    <div>
      <div style={s.card}>
        <select value={p} onChange={e => setP(Number(e.target.value))} style={{ ...s.input, marginBottom: 6 }}>{PERIODS.map((x, i) => <option key={i} value={i}>{x.label}</option>)}</select>
        <div style={{ display: "flex", gap: 6 }}>
          <select value={io} onChange={e => { setIo(e.target.value); setCat(""); }} style={{ ...s.input, flex: 1 }}><option value="">收入＋支出</option><option>收入</option><option>支出</option></select>
          <select value={cat} onChange={e => setCat(e.target.value)} style={{ ...s.input, flex: 1.3 }}><option value="">全部類別</option>{(io === "收入" ? meta.inc : io === "支出" ? meta.exp : [...meta.inc, ...meta.exp]).map(c => <option key={c}>{c}</option>)}</select>
        </div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="搜尋單位、子類別、備註" style={{ ...s.input, marginTop: 6 }} />
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 8 }}>{list.length} 筆｜收入 <b style={{ color: C.green }}>{fmt(inc)}</b>｜支出 <b style={{ color: C.red }}>{fmt(exp)}</b></div>
      </div>
      {!d && <div className="rh-skel" style={{ height: 120, borderRadius: 18 }} />}
      {d && list.length === 0 && <div style={{ ...s.card, textAlign: "center", color: C.muted, fontSize: 13 }}>這段期間沒有資料</div>}
      {list.slice(0, 300).map(x => <button key={x.id || x.row} onClick={() => setEdit(x)} style={{ ...s.card, display: "flex", width: "100%", gap: 10, alignItems: "center", textAlign: "left", fontFamily: "inherit", color: C.text, cursor: "pointer", padding: "9px 12px", marginBottom: 6 }}>
        <span style={{ width: 42, fontSize: 12, color: C.muted }}>{x.date.slice(5).replace("-", "/")}</span>
        <span style={{ flex: 1, minWidth: 0 }}><span style={{ fontSize: 13.5 }}>{x.unit || "—"}</span><span style={{ display: "block", fontSize: 11.5, color: x.cat ? C.muted : C.gold, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.cat || "未分類"}{x.sub ? "・" + x.sub : ""}{x.note ? "・" + x.note : ""}{x.photo ? " 📷" : ""}</span></span>
        <b style={{ fontSize: 14, color: x.io === "收入" ? C.green : C.text }}>{x.io === "收入" ? "+" : ""}{fmt(x.amt)}</b>
      </button>)}
      {list.length > 300 && <div style={{ fontSize: 12, color: C.muted, textAlign: "center" }}>只顯示前 300 筆，請用篩選縮小範圍</div>}
    </div>
  );
}

function Editor({ meta, apiPost, C, s, uploadPhoto, todayStr, init, onDone, onCancel }) {
  const [f, setF] = useState(init ? { ...init, net: init.net ?? "", tax: init.tax ?? "" } : { date: todayStr(), co: meta.companies[0], io: "支出", cat: "食材成本", sub: "", unit: "", amt: "", net: "", tax: "", note: "", photo: "" });
  const [auto, setAuto] = useState(!init), [busy, setBusy] = useState(false), [msg, setMsg] = useState("");
  const up = (k, v) => setF(x => ({ ...x, [k]: v }));
  const cats = f.io === "收入" ? meta.inc : meta.exp;
  const save = async (again) => {
    setBusy(true); setMsg("");
    const r = await apiPost({ action: "acSave", item: { ...f, autoTax: auto } }, 0); setBusy(false);
    if (r && r.success) { if (again) { setMsg("✅ 已記下，繼續記下一筆"); setF(x => ({ ...x, sub: "", unit: "", amt: "", net: "", tax: "", note: "", photo: "" })); } else onDone && onDone(); }
    else setMsg((r && r.error) || "儲存失敗");
  };
  const del = async () => { if (!confirm("刪除這一筆？")) return; const r = await apiPost({ action: "acDel", id: init.id }, 0); if (r && r.success) onDone(); else setMsg((r && r.error) || "刪除失敗"); };
  const photo = async (file) => { if (!file) return; setBusy(true); setMsg("照片上傳中…"); try { up("photo", await uploadPhoto(file, { folder: "內帳憑證", name: "大隊長" })); setMsg(""); } catch (e) { setMsg(e.message); } setBusy(false); };
  const amt = Number(f.amt) || 0;
  return (
    <div style={s.card}>
      <div style={s.sectionTitle}>{init ? "修改這一筆" : "記一筆"}</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {["支出", "收入"].map(k => <button key={k} onClick={() => setF(x => ({ ...x, io: k, cat: k === "收入" ? meta.inc[0] : meta.exp[2] }))} style={{ flex: 1, border: `1.5px solid ${f.io === k ? (k === "收入" ? C.green : C.red) : C.border}`, background: f.io === k ? (k === "收入" ? C.greenBg : C.redBg) : C.card, color: f.io === k ? (k === "收入" ? C.green : C.red) : C.text, borderRadius: 999, padding: "8px 0", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>{k}</button>)}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <input type="date" value={f.date} onChange={e => up("date", e.target.value)} style={{ ...s.input, flex: 1 }} />
        <select value={f.co} onChange={e => up("co", e.target.value)} style={{ ...s.input, flex: 1 }}>{meta.companies.map(c => <option key={c}>{c}</option>)}</select>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <select value={f.cat} onChange={e => up("cat", e.target.value)} style={{ ...s.input, flex: 1 }}>{cats.map(c => <option key={c}>{c}</option>)}{f.cat && !cats.includes(f.cat) && <option>{f.cat}</option>}</select>
        <input value={f.sub} onChange={e => up("sub", e.target.value)} placeholder="子類別，例：蛋、停車" style={{ ...s.input, flex: 1 }} />
      </div>
      <input value={f.unit} onChange={e => up("unit", e.target.value)} placeholder="單位（店家、公司名稱）" style={{ ...s.input, marginBottom: 8 }} />
      <input type="number" inputMode="decimal" value={f.amt} onChange={e => up("amt", e.target.value)} placeholder="發票金額（含稅）" style={{ ...s.input, marginBottom: 6, fontSize: 18, fontWeight: 600 }} />
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.muted, marginBottom: 6 }}><input type="checkbox" checked={auto} onChange={e => setAuto(e.target.checked)} />自動算未稅（÷1.05）{auto && amt ? `：銷貨 ${fmt(amt / 1.05)}・稅 ${fmt(amt - Math.round(amt / 1.05))}` : ""}</label>
      {!auto && <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <input type="number" value={f.net} onChange={e => up("net", e.target.value)} placeholder="銷貨金額（選填）" style={{ ...s.input, flex: 1 }} />
        <input type="number" value={f.tax} onChange={e => up("tax", e.target.value)} placeholder="稅額（選填）" style={{ ...s.input, flex: 1 }} />
      </div>}
      <input value={f.note} onChange={e => up("note", e.target.value)} placeholder="備註（發票號碼等）" style={{ ...s.input, marginBottom: 8 }} />
      <label style={{ ...s.btn("ghost"), cursor: "pointer", marginBottom: 10, color: f.photo ? C.green : C.muted }}>📷 {f.photo ? "已附發票照片（點一下更換）" : "拍發票（選填）"}<input type="file" accept="image/*" capture="environment" onChange={e => photo(e.target.files[0])} style={{ display: "none" }} /></label>
      <div style={{ display: "flex", gap: 8 }}>
        {init && <button onClick={del} style={{ ...s.btn("ghost"), flex: 1, color: C.red }}>刪除</button>}
        {onCancel && <button onClick={onCancel} style={{ ...s.btn("ghost"), flex: 1 }}>取消</button>}
        {!init && <button disabled={busy || !amt} onClick={() => save(true)} style={{ ...s.btn("ghost"), flex: 1.4, opacity: busy || !amt ? .5 : 1 }}>存好再記一筆</button>}
        <button disabled={busy || !amt} onClick={() => save(false)} style={{ ...s.btn("primary"), flex: 1.4, opacity: busy || !amt ? .5 : 1 }}>儲存</button>
      </div>
      {msg && <div style={{ fontSize: 13, marginTop: 8, color: /✅/.test(msg) ? C.green : C.red }}>{msg}</div>}
    </div>
  );
}

function ImportExport({ apiGet, apiPost, C, s }) {
  const [msg, setMsg] = useState(""), [busy, setBusy] = useState(false), [p, setP] = useState(0);
  const imp = async (file) => {
    if (!file) return; setBusy(true); setMsg("讀取 Excel…");
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const rows = [];
      wb.SheetNames.forEach(n => {
        const data = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true });
        const h = (data[0] || []).map(String), ix = k => h.indexOf(k);
        if (ix("日期") < 0 || ix("發票金額") < 0) return;
        data.slice(1).forEach(r => {
          let d = r[ix("日期")]; if (!d) return;
          if (d instanceof Date) d = new Date(d.getTime() + 8 * 3600e3).toISOString().slice(0, 10); else if (typeof d === "number") d = new Date(Math.round((d - 25569) * 864e5)).toISOString().slice(0, 10); else d = String(d).slice(0, 10).replace(/\//g, "-");
          rows.push({ date: d, co: r[ix("公司")], io: r[ix("收支")], cat: r[ix("記帳類別")] || "", sub: r[ix("子類別")] || "", unit: r[ix("單位")] || "", net: r[ix("銷貨金額")] ?? "", tax: r[ix("稅額")] ?? "", amt: r[ix("發票金額")], note: r[ix("備註")] || "", src: ix("來源檔") >= 0 ? r[ix("來源檔")] : file.name });
        });
      });
      if (!rows.length) { setMsg("檔案裡找不到「日期／發票金額」欄位"); setBusy(false); return; }
      let add = 0, skip = 0, bad = 0;
      // 一模一樣的筆數要放在同一批（後端用「已存在幾筆」判斷重複），所以依內容排序、切批時不把相同的拆開
      const key = x => [x.date, x.io, Math.round(Number(x.amt) || 0), String(x.unit).trim(), String(x.note).trim()].join("|");
      rows.sort((a, b) => key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);
      for (let i = 0; i < rows.length;) {
        let j = Math.min(i + 400, rows.length); while (j < rows.length && j > i && key(rows[j]) === key(rows[j - 1])) j++;
        setMsg(`匯入中… ${j} / ${rows.length}`);
        const r = await apiPost({ action: "acImport", rows: rows.slice(i, j), src: file.name }, 1);
        i = j;
        if (!r || !r.success) { setMsg((r && r.error) || "匯入失敗"); setBusy(false); return; }
        add += r.added; skip += r.skipped; bad += r.bad;
      }
      setMsg(`✅ 匯入完成：新增 ${add} 筆、重複跳過 ${skip} 筆${bad ? `、格式不對 ${bad} 筆` : ""}`);
    } catch (e) { setMsg("讀取失敗：" + e.message); }
    setBusy(false);
  };
  const exp = async () => {
    const per = PERIODS[p]; setBusy(true); setMsg("產生 Excel…");
    const r = await apiGet({ action: "acList", from: per.from, to: per.to }, 1);
    if (!r || !r.success) { setMsg((r && r.error) || "讀取失敗"); setBusy(false); return; }
    const XLSX = await import("xlsx");
    const aoa = [["日期", "公司", "收支", "記帳類別", "子類別", "單位", "銷貨金額", "稅額", "發票金額", "備註"]].concat(r.data.map(x => [new Date(x.date + "T00:00:00"), Number(x.co) || x.co, x.io, x.cat, x.sub, x.unit, x.net ?? "", x.tax ?? "", x.amt, x.note]));
    const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true, dateNF: "yyyy-mm-dd" });
    ws["!cols"] = [12, 10, 6, 10, 14, 20, 10, 8, 10, 24].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, per.file.replace(/^營收總表/, "營收總表").slice(0, 31));
    XLSX.writeFile(wb, `${per.file}_App匯出.xlsx`);
    setMsg(`✅ 已下載「${per.file}_App匯出.xlsx」（${r.data.length} 筆）`); setBusy(false);
  };
  return (
    <div>
      <div style={s.card}>
        <div style={s.sectionTitle}>匯出營收總表（給會計）</div>
        <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 8 }}>格式和原本的營收總表一樣：日期、公司、收支、記帳類別、子類別、單位、銷貨金額、稅額、發票金額、備註</div>
        <select value={p} onChange={e => setP(Number(e.target.value))} style={{ ...s.input, marginBottom: 8 }}>{PERIODS.map((x, i) => <option key={i} value={i}>{x.label}</option>)}</select>
        <button disabled={busy} onClick={exp} style={{ ...s.btn("primary"), opacity: busy ? .6 : 1 }}>⬇ 下載 Excel</button>
      </div>
      <div style={s.card}>
        <div style={s.sectionTitle}>匯入 Excel</div>
        <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 8, lineHeight: 1.7 }}>選營收總表格式的 Excel（例如雲端「App程式碼／內帳／內帳匯入_115年01-10月」）。日期、收支、金額、單位、備註都一樣的會當作重複，自動跳過，重複匯入也不會多算。</div>
        <label style={{ ...s.btn("ghost"), cursor: busy ? "default" : "pointer", opacity: busy ? .6 : 1 }}>📂 選擇 Excel 檔<input type="file" accept=".xlsx,.xls" disabled={busy} onChange={e => imp(e.target.files[0])} style={{ display: "none" }} /></label>
      </div>
      {msg && <div style={{ ...s.card, fontSize: 13, color: /✅/.test(msg) ? C.green : /失敗|不對|找不到/.test(msg) ? C.red : C.text }}>{msg}</div>}
    </div>
  );
}
