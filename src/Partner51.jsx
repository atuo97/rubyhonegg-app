// ─────────────────────────────────────────────
// v1.51 第 2 版：隊長室左牆「合作夥伴牆」
// 機關團體（中央、地方、協會）＋品牌（汽車、科技、醫藥、社群、學校…）＋行銷公關夥伴；每一筆可放照片
// 總部隊員都看得到；Lv.3 以上可以新增、修改、上傳照片
// ─────────────────────────────────────────────
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Flash } from "./TopToast.jsx";

export const PT_COL = { central: "#5b7c99", local: "#7a9e9f", assoc: "#8c9a7e", car: "#4a5560", tech: "#5d7a8c", med: "#7fa69a", social: "#b48b84", school: "#a58f6f", fashion: "#8e7f98", corp: "#6f7f8f", ip: "#c49a6c", travel: "#6b9a8b", retail: "#9b8576", sport: "#7b8fa6", agency: "#9a9a8a" };
const GROUPS = ["機關團體", "品牌", "合作夥伴"];

function shrink(file, max, q) {
  return new Promise((ok, no) => {
    const fr = new FileReader();
    fr.onload = () => { const im = new Image(); im.onload = () => {
      const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement("canvas");
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      ok(c.toDataURL("image/jpeg", q)); }; im.onerror = no; im.src = fr.result; };
    fr.onerror = no; fr.readAsDataURL(file);
  });
}

export function PartnerPage({ apiGet, apiPost, C, s, initial }) {
  const [d, setD] = useState(null), [cat, setCat] = useState(initial || "central"), [q, setQ] = useState("");
  const [open, setOpen] = useState(null), [edit, setEdit] = useState(null), [msg, setMsg] = useState(null), [busy, setBusy] = useState(false);
  const load = () => apiGet({ action: "ptList" }, 0).then(r => setD(r && r.success ? r.data : { error: (r && r.error) || "讀取失敗" }));
  useEffect(() => { load(); }, []);
  if (!d) return <div className="rh-skel" style={{ height: 200, borderRadius: 18 }} />;
  if (d.error) return <div style={{ ...s.card, color: C.red }}>{d.error}</div>;
  const cnt = c => d.list.filter(x => x.cat === c).length;
  const kw = q.trim().toLowerCase();
  const list = kw ? d.list.filter(x => (x.name + x.note).toLowerCase().includes(kw)) : d.list.filter(x => x.cat === cat);
  const catName = id => (d.cats.find(c => c.id === id) || {}).name || id;
  const save = async x => { setBusy(true); const r = await apiPost({ action: "ptSave", ...x }, 0); setBusy(false);
    if (r && r.success) { setMsg({ ok: true, text: "✅ 已儲存" }); load(); return r; } setMsg({ ok: false, text: (r && r.error) || "失敗" }); return null; };
  return (
    <div>
      {msg && <Flash text={msg.text} kind={msg.ok ? "ok" : "bad"} />}
      <div style={{ ...s.card, padding: "10px 14px", fontSize: 12.5, color: C.muted, lineHeight: 1.6 }}>
        🤝 紅玉滿一路合作過的機關、品牌和夥伴，共 <b style={{ color: C.text }}>{d.list.length}</b> 個。點一筆看照片。{d.canEdit ? "你可以新增、修改、上傳照片。" : ""}
      </div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 搜尋名稱或活動（例如：賓士、Snoopy）" style={{ ...s.input, marginBottom: 8 }} />
      {!kw && GROUPS.map(g => (
        <div key={g} style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 11.5, color: C.muted, margin: "2px 0 4px" }}>{g}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {d.cats.filter(c => c.group === g).map(c => <button key={c.id} onClick={() => setCat(c.id)} style={{ border: "none", borderRadius: 999, padding: "6px 11px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: cat === c.id ? PT_COL[c.id] : C.warm, color: cat === c.id ? "#fff" : C.text }}>{c.name} {cnt(c.id)}</button>)}
          </div>
        </div>
      ))}
      <div style={s.card}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
          <b style={{ flex: 1, fontSize: 15 }}>{kw ? `搜尋「${q.trim()}」` : catName(cat)}（{list.length}）</b>
          {d.canEdit && <button onClick={() => setEdit({ op: "add", cat: kw ? "central" : cat, name: "", note: "", date: "" })} style={{ border: "none", borderRadius: 999, background: C.accent, color: "#fff", padding: "6px 12px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>＋ 新增</button>}
        </div>
        {!list.length && <div style={{ fontSize: 13, color: C.muted }}>還沒有資料</div>}
        {list.map(x => (
          <button key={x.id} onClick={() => setOpen(x)} style={{ width: "100%", display: "flex", gap: 10, alignItems: "center", padding: "9px 0", border: "none", borderTop: `1px solid ${C.border}`, background: "transparent", cursor: "pointer", fontFamily: "inherit", color: C.text, textAlign: "left" }}>
            <span style={{ width: 52, height: 52, borderRadius: 10, flex: "0 0 52px", background: x.cover ? `center/cover url(data:image/jpeg;base64,${x.cover})` : PT_COL[x.cat], color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700 }}>{x.cover ? "" : x.name.slice(0, 1)}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{x.name}{kw ? <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>・{catName(x.cat)}</span> : null}</span>
              <span style={{ display: "block", fontSize: 12, color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.note || "—"}</span>
            </span>
            <span style={{ fontSize: 11, color: C.light, textAlign: "right", whiteSpace: "nowrap" }}>{x.date}<br />{x.photos ? `📷 ${x.photos}` : ""}</span>
          </button>
        ))}
      </div>
      {open && <PartnerDetail x={open} d={d} apiGet={apiGet} apiPost={apiPost} C={C} s={s} catName={catName} onClose={() => setOpen(null)} onChanged={load}
        onEdit={() => { setEdit({ op: "edit", id: open.id, cat: open.cat, name: open.name, note: open.note, date: open.date }); setOpen(null); }}
        onDel={async () => { if (!window.confirm(`刪除「${open.name}」？`)) return; if (await save({ op: "del", id: open.id })) setOpen(null); }} />}
      {edit && createPortal(
        <div onClick={() => setEdit(null)} style={{ position: "fixed", inset: 0, zIndex: 1800, background: "rgba(20,10,20,.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 14 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: C.bg, borderRadius: 18, padding: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>{edit.op === "add" ? "＋ 新增合作夥伴" : "✏️ 修改"}</div>
            <select value={edit.cat} onChange={e => setEdit({ ...edit, cat: e.target.value })} style={{ ...s.input, marginBottom: 8 }}>
              {GROUPS.map(g => <optgroup key={g} label={g}>{d.cats.filter(c => c.group === g).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>)}
            </select>
            <input value={edit.name} maxLength={40} onChange={e => setEdit({ ...edit, name: e.target.value })} placeholder="名稱（例如：國家太空中心）" style={{ ...s.input, marginBottom: 8 }} />
            <input value={edit.date} maxLength={10} onChange={e => setEdit({ ...edit, date: e.target.value })} placeholder="最近合作（例如：2026-10）" style={{ ...s.input, marginBottom: 8 }} />
            <textarea value={edit.note} maxLength={300} rows={4} onChange={e => setEdit({ ...edit, note: e.target.value })} placeholder="合作內容（例如：Sparky 造型雞蛋糕）" style={{ ...s.input, marginBottom: 10, resize: "vertical" }} />
            <button disabled={busy || !edit.name.trim()} onClick={async () => { if (await save(edit)) setEdit(null); }} style={{ ...s.btn("primary"), opacity: busy || !edit.name.trim() ? .5 : 1 }}>{busy ? "儲存中…" : "儲存"}</button>
            <button onClick={() => setEdit(null)} style={{ ...s.btn("ghost"), marginTop: 6 }}>取消</button>
          </div>
        </div>, document.body)}
    </div>
  );
}

function PartnerDetail({ x, d, apiGet, apiPost, C, s, catName, onClose, onChanged, onEdit, onDel }) {
  const [ph, setPh] = useState(null), [big, setBig] = useState(null), [up, setUp] = useState(""), [msg, setMsg] = useState(null);
  const load = () => apiGet({ action: "ptPhotos", id: x.id }, 0).then(r => setPh(r && r.success ? r.data : []));
  useEffect(() => { load(); }, [x.id]);
  const view = async p => { setBig({ id: p.id, src: "data:image/jpeg;base64," + p.thumb, full: false });
    const r = await apiGet({ action: "ptPhotoGet", id: p.id }, 0); if (r && r.success) setBig(b => b && b.id === p.id ? { ...b, src: "data:image/jpeg;base64," + r.data.base64, full: true } : b); };
  const upload = async files => {
    let n = 0;
    for (const f of files) {
      setUp(`上傳中 ${n + 1}/${files.length}…`);
      try {
        const img = await shrink(f, 1600, 0.78), thumb = await shrink(f, 240, 0.6);
        const r = await apiPost({ action: "ptPhoto", id: x.id, img, thumb }, 0);
        if (!(r && r.success)) { setMsg({ ok: false, text: (r && r.error) || "上傳失敗" }); break; }
        n++;
      } catch (e) { setMsg({ ok: false, text: "有一張照片讀不到" }); }
    }
    setUp(""); if (n) { setMsg({ ok: true, text: `📷 已上傳 ${n} 張` }); load(); onChanged(); }
  };
  const sm = { border: `1px solid ${C.border}`, background: C.card, borderRadius: 999, padding: "4px 11px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: C.text };
  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1700, background: "rgba(20,10,20,.75)", display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "calc(14px + env(safe-area-inset-top)) 10px calc(14px + env(safe-area-inset-bottom))" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, background: C.bg, borderRadius: 18, padding: 14 }}>
        {msg && <Flash text={msg.text} kind={msg.ok ? "ok" : "bad"} />}
        <div style={{ fontSize: 11.5, color: "#fff", background: PT_COL[x.cat], borderRadius: 999, padding: "2px 10px", display: "inline-block" }}>{catName(x.cat)}</div>
        <div style={{ fontSize: 19, fontWeight: 800, margin: "6px 0 2px" }}>{x.name}</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>最近合作：{x.date || "—"}</div>
        {x.note && <div style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 10 }}>{x.note}</div>}
        {!ph ? <div className="rh-skel" style={{ height: 90, borderRadius: 12 }} /> : !ph.length ? <div style={{ fontSize: 13, color: C.muted, padding: "10px 0" }}>還沒有照片{d.canEdit ? "，上傳第一張吧！" : ""}</div> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
            {ph.map(p => <button key={p.id} onClick={() => view(p)} style={{ aspectRatio: "1", border: "none", borderRadius: 8, padding: 0, cursor: "pointer", background: p.thumb ? `center/cover url(data:image/jpeg;base64,${p.thumb})` : C.warm }} />)}
          </div>
        )}
        {d.canEdit && <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          <label style={{ ...sm, background: C.accent, color: "#fff", border: "none" }}>{up || "📷 上傳照片"}
            <input type="file" accept="image/*" multiple disabled={!!up} style={{ display: "none" }} onChange={e => { const f = Array.from(e.target.files || []).slice(0, 20); e.target.value = ""; if (f.length) upload(f); }} />
          </label>
          <button style={sm} onClick={onEdit}>✏️ 修改</button>
          {(x.mine || d.boss) && <button style={{ ...sm, color: C.red }} onClick={onDel}>🗑️ 刪除</button>}
        </div>}
        <button onClick={onClose} style={{ ...s.btn("ghost"), marginTop: 10 }}>關閉</button>
      </div>
      {big && <div onClick={e => { e.stopPropagation(); setBig(null); }} style={{ position: "fixed", inset: 0, zIndex: 1900, background: "rgba(0,0,0,.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 10 }}>
        <img src={big.src} alt="" style={{ maxWidth: "100%", maxHeight: "85vh", borderRadius: 8, filter: big.full ? "none" : "blur(1px)" }} />
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          {d.canEdit && <button onClick={async e => { e.stopPropagation(); const r = await apiPost({ action: "ptSave", op: "cover", id: x.id, photo: big.id }, 0); setMsg(r && r.success ? { ok: true, text: "✅ 已設為封面" } : { ok: false, text: (r && r.error) || "失敗" }); onChanged(); setBig(null); }} style={{ ...sm, background: "#fff" }}>設為封面</button>}
          {d.canEdit && <button onClick={async e => { e.stopPropagation(); if (!window.confirm("刪除這張照片？")) return; const r = await apiPost({ action: "ptPhotoDel", id: big.id }, 0); setMsg(r && r.success ? { ok: true, text: "已刪除" } : { ok: false, text: (r && r.error) || "失敗" }); setBig(null); load(); onChanged(); }} style={{ ...sm, background: "#fff", color: C.red }}>刪除</button>}
        </div>
      </div>}
    </div>, document.body);
}
