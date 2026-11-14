// ─────────────────────────────────────────────
// v1.42 大廳服務台：福利補助申請、比賽公告、意見箱；管理端核准與報帳
// 補助另外報帳（不併入薪資）。規則以後端〈遊戲參數〉為準（隊長 11/14 定案）：
//   運動比賽報名費（完賽才補）、比賽滿 3 場購物金 3,000（隊長核准）、其他運動每年 1,000（年中到職按比例）、
//   證照考照報名費全額、證照學費考取後補 50%（每年 2 個課程）、體檢費
// ─────────────────────────────────────────────
import { useEffect, useState } from "react";
import { Flash } from "./TopToast.jsx";

const ST_COL = { "待核准": "#b9770e", "待報帳": "#2e6da4", "已報帳": "#1e8449", "退回": "#b42318", "取消": "#8a7e72" };
const money = n => "$" + Number(n || 0).toLocaleString();
const CAT_NAME = { race: "比賽報名費", shop3: "比賽購物金", sport: "其他運動", certfee: "證照報名費", tuition: "證照學費", checkup: "體檢費" };

// 照片上傳（壓縮後存 Google 雲端，回傳連結）
async function upload(file, compressPhoto, apiPost, name, folder) {
  const b64 = await compressPhoto(file, 1600);
  const r = await apiPost({ action: "uploadPhoto", base64: b64, folder: folder || "福利補助", name }, 0);
  if (!r || !r.success || !r.url) throw new Error("照片上傳失敗（" + ((r && r.error) || "請檢查網路") + "）");
  return r.url;
}

const PhotoBtn = ({ C, s, file, label, onPick }) => (
  <label style={{ ...s.btn("ghost"), border: `2px dashed ${file ? C.green : C.border}`, color: file ? C.green : C.muted, cursor: "pointer", marginBottom: 8, display: "block", textAlign: "center" }}>
    📷 {file ? `已選好：${label}（點一下重選）` : label}
    <input type="file" accept="image/*" onChange={e => onPick(e.target.files[0] || null)} style={{ display: "none" }} />
  </label>
);

// 申請表（體檢頁也用這個，fixedCat="checkup"）
export function BenefitForm({ user, apiPost, compressPhoto, C, s, todayStr, cats, quota, fixedCat, onDone }) {
  const [cat, setCat] = useState(fixedCat || "");
  const [f, setF] = useState({ title: fixedCat === "checkup" ? "體檢費" : "", date: "", amount: "", note: "" });
  const [rc, setRc] = useState(null), [pf, setPf] = useState(null), [busy, setBusy] = useState(false), [msg, setMsg] = useState("");
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const needProof = cat === "race" || cat === "tuition";
  const q = quota || {};
  const preview = (() => {
    const a = Math.round(+f.amount || 0); if (!a) return "";
    if (cat === "sport") return `補助 ${money(Math.min(a, q.sportLeft || 0))}（今年還剩 ${money(q.sportLeft)}）`;
    if (cat === "tuition") return `考取後補 50%：${money(Math.round(a * 0.5))}`;
    return `補助 ${money(a)}`;
  })();
  const send = async () => {
    setMsg("");
    if (cat !== "shop3") {
      if (!f.title.trim() || !f.date || !(+f.amount > 0)) { setMsg("請填名稱、日期、金額"); return; }
      if (!rc) { setMsg("請上傳收據或繳費證明"); return; }
      if (needProof && !pf) { setMsg(cat === "race" ? "請上傳完賽照或獎牌照（完賽才補助）" : "請上傳證照（考取後才補助學費）"); return; }
    }
    setBusy(true); setMsg("送出中…");
    try {
      const receipt = rc ? await upload(rc, compressPhoto, apiPost, user.name) : "";
      const proof = pf ? await upload(pf, compressPhoto, apiPost, user.name) : "";
      const r = await apiPost({ action: "bfApply", cat, ...f, amount: +f.amount || 0, receipt, proof }, 0);
      if (r && r.success) { setMsg(`✅ 已送出，補助 ${money(r.data.sub)}，等主管核准`); setF({ title: fixedCat === "checkup" ? "體檢費" : "", date: "", amount: "", note: "" }); setRc(null); setPf(null); onDone && onDone(); }
      else setMsg((r && r.error) || "送出失敗");
    } catch (e) { setMsg(e.message || "送出失敗"); }
    setBusy(false);
  };
  const list = (cats || []).filter(c => c.key !== "shop3" && (fixedCat ? c.key === fixedCat : c.key !== "checkup"));
  return (
    <div>
      {!fixedCat && <>
        <label style={s.label}>補助類別</label>
        <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
          {list.map(c => (
            <button key={c.key} onClick={() => setCat(c.key)} style={{ textAlign: "left", border: `1.5px solid ${cat === c.key ? C.accent : C.border}`, background: cat === c.key ? C.accentBg : C.card, borderRadius: 12, padding: "9px 12px", cursor: "pointer", fontFamily: "inherit", color: C.text }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</div><div style={{ fontSize: 11.5, color: C.muted }}>{c.rule}</div>
            </button>
          ))}
        </div>
      </>}
      {cat && <>
        <label style={s.label}>{cat === "race" ? "比賽名稱" : cat === "sport" ? "項目（例：健身房 11 月月費）" : cat === "checkup" ? "名稱" : "課程或證照名稱"}</label>
        <input value={f.title} maxLength={40} onChange={e => set("title", e.target.value)} style={{ ...s.input, marginBottom: 8 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}><label style={s.label}>{cat === "race" ? "比賽日期" : "繳費日期"}</label><input type="date" value={f.date} max={todayStr()} onChange={e => set("date", e.target.value)} style={{ ...s.input, marginBottom: 8 }} /></div>
          <div style={{ flex: 1 }}><label style={s.label}>{cat === "race" || cat === "certfee" ? "報名費" : "金額"}</label><input type="number" inputMode="numeric" value={f.amount} onChange={e => set("amount", e.target.value)} style={{ ...s.input, marginBottom: 8 }} /></div>
        </div>
        <PhotoBtn C={C} s={s} file={rc} label="拍收據／繳費證明" onPick={setRc} />
        {needProof && <PhotoBtn C={C} s={s} file={pf} label={cat === "race" ? "拍完賽照或獎牌照" : "拍證照"} onPick={setPf} />}
        <input value={f.note} maxLength={100} onChange={e => set("note", e.target.value)} placeholder="備註（選填）" style={{ ...s.input, marginBottom: 8 }} />
        {preview && <div style={{ fontSize: 13, color: C.accent, fontWeight: 600, marginBottom: 8 }}>{preview}</div>}
        <button disabled={busy} onClick={send} style={{ ...s.btn("primary"), opacity: busy ? .5 : 1 }}>送出申請</button>
      </>}
      {msg && <div style={{ fontSize: 13, marginTop: 8, color: msg.startsWith("✅") ? C.green : C.red }}>{msg}</div>}
    </div>
  );
}

// 大廳服務台：福利補助｜比賽公告｜意見箱
export default function BenefitPage({ user, apiGet, apiPost, C, s, compressPhoto, todayStr, initTab }) {
  const [tab, setTab] = useState(initTab || "apply");
  const [d, setD] = useState(null), [msg, setMsg] = useState(null);
  const load = () => apiGet({ action: "bfMe" }, 0).then(r => setD(r && r.success ? r.data : { error: (r && r.error) || "讀取失敗（後端更新到 v1.42 後才能用）" }));
  useEffect(() => { load(); }, []);
  const q = (d && d.quota) || {};
  const cancel = async x => { if (!window.confirm(`取消「${x.title}」的申請？`)) return; const r = await apiPost({ action: "bfCancel", id: x.id }, 0); setMsg(r && r.success ? { ok: true, text: "已取消" } : { ok: false, text: (r && r.error) || "取消失敗" }); load(); };
  const shop = async () => { if (!window.confirm(`申請比賽滿 ${q.per} 場購物金 ${money(q.shopAmount)}？送出後由隊長核准。`)) return; const r = await apiPost({ action: "bfApply", cat: "shop3" }, 0); setMsg(r && r.success ? { ok: true, text: "✅ 已送出，等隊長核准" } : { ok: false, text: (r && r.error) || "送出失敗" }); load(); };
  const Tab = ({ k, children }) => <button onClick={() => setTab(k)} style={{ flex: 1, border: "none", borderRadius: 10, padding: "8px 0", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: tab === k ? C.accent : C.warm, color: tab === k ? "#fff" : C.text }}>{children}</button>;
  return (
    <div>
      {msg && <Flash text={msg.text} kind={msg.ok ? "ok" : "bad"} />}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <Tab k="apply">🎁 福利補助</Tab><Tab k="events">🏃 比賽公告</Tab><Tab k="idea">📮 意見箱</Tab>
      </div>
      {d && d.error && <div style={{ ...s.card, color: C.red }}>{d.error}</div>}
      {!d && <div style={{ ...s.card, color: C.muted }}>讀取中…</div>}

      {d && !d.error && tab === "apply" && <>
        <div style={s.card}>
          <div style={s.sectionTitle}>我的額度（{q.year} 年）</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, textAlign: "center" }}>
            {[["其他運動", money(q.sportLeft), `共 ${money(q.sportCap)}`], ["證照學費", `${q.tuitionLeft} 個`, `每年 ${q.tuitionMax} 個`], ["比賽完賽", `${q.races} 場`, `滿 ${q.per} 場送購物金`]].map(([a, b, c]) => (
              <div key={a} style={{ background: C.warm, borderRadius: 12, padding: "8px 4px" }}><div style={{ fontSize: 11.5, color: C.muted }}>{a}</div><div style={{ fontSize: 17, fontWeight: 700, color: C.accent }}>{b}</div><div style={{ fontSize: 10.5, color: C.light }}>{c}</div></div>
            ))}
          </div>
          {q.hire && q.hire.slice(0, 4) === String(q.year) && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 6 }}>你今年 {q.hire.slice(5, 7)} 月到職，運動補助按比例計算</div>}
          {q.shopCan > 0 && <button onClick={shop} style={{ ...s.btn("primary"), marginTop: 10 }}>🏅 申請比賽購物金 {money(q.shopAmount)}</button>}
          <div style={{ fontSize: 11.5, color: C.light, marginTop: 8 }}>補助都是另外報帳，不會併入薪資。考照報名費全額、不限次數；學費考取後補 50%。</div>
        </div>
        <div style={s.card}>
          <div style={s.sectionTitle}>新的申請</div>
          <BenefitForm user={user} apiPost={apiPost} compressPhoto={compressPhoto} C={C} s={s} todayStr={todayStr} cats={d.cats} quota={q} onDone={load} />
        </div>
        <div style={s.card}>
          <div style={s.sectionTitle}>我的申請</div>
          {d.list.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>還沒有申請</div>}
          {d.list.map(x => (
            <div key={x.id} style={{ padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ flex: 1 }}><b>{x.title}</b><span style={{ display: "block", fontSize: 11.5, color: C.muted }}>{(d.cats.find(c => c.key === x.cat) || {}).name}・{x.date || x.time.slice(0, 10)}</span></span>
                <span style={{ textAlign: "right" }}><b>{money(x.sub)}</b><span style={{ display: "block", fontSize: 11.5, color: ST_COL[x.status] || C.muted, fontWeight: 600 }}>{x.status}</span></span>
              </div>
              {x.status === "退回" && x.reason && <div style={{ fontSize: 12, color: C.red, marginTop: 2 }}>原因：{x.reason}</div>}
              {x.status === "待核准" && <button onClick={() => cancel(x)} style={{ marginTop: 4, border: `1px solid ${C.border}`, background: C.card, borderRadius: 999, padding: "2px 10px", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit", color: C.muted }}>取消申請</button>}
            </div>
          ))}
        </div>
      </>}

      {d && !d.error && tab === "events" && <EventBoard user={user} apiPost={apiPost} C={C} s={s} events={d.events} canDel={d.canApprove} onChange={ev => setD(x => ({ ...x, events: ev }))} />}
      {tab === "idea" && <IdeaBox apiPost={apiPost} C={C} s={s} />}
    </div>
  );
}

function EventBoard({ user, apiPost, C, s, events, canDel, onChange }) {
  const [f, setF] = useState({ name: "", date: "", place: "", link: "" }), [msg, setMsg] = useState("");
  const add = async () => { const r = await apiPost({ action: "bfEventAdd", ...f }, 0); if (r && r.success) { onChange(r.data); setF({ name: "", date: "", place: "", link: "" }); setMsg("✅ 已貼上"); } else setMsg((r && r.error) || "失敗"); };
  const del = async x => { if (!window.confirm(`刪除「${x.name}」？`)) return; const r = await apiPost({ action: "bfEventDel", id: x.id }, 0); if (r && r.success) onChange(r.data); else setMsg((r && r.error) || "失敗"); };
  return <>
    <div style={s.card}>
      <div style={s.sectionTitle}>🏃 近期比賽</div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>一起報名吧！完賽後到「福利補助」申請報名費，累積 3 場還有購物金</div>
      {events.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>還沒有人貼比賽</div>}
      {events.map(x => (
        <div key={x.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
          <span style={{ width: 46, fontWeight: 700, color: C.accent }}>{x.date.slice(5).replace("-", "/")}</span>
          <span style={{ flex: 1 }}>{x.link ? <a href={x.link} target="_blank" rel="noreferrer" style={{ color: C.text }}>{x.name} ↗</a> : x.name}{x.place && <span style={{ display: "block", fontSize: 11.5, color: C.muted }}>{x.place}</span>}</span>
          {(canDel || String(x.by) === String(user.id)) && <button onClick={() => del(x)} style={{ border: "none", background: "transparent", color: C.light, cursor: "pointer", fontSize: 16 }}>✕</button>}
        </div>
      ))}
    </div>
    <div style={s.card}>
      <div style={s.sectionTitle}>貼一則比賽</div>
      <input value={f.name} maxLength={40} onChange={e => setF(x => ({ ...x, name: e.target.value }))} placeholder="比賽名稱（例：2026 台北馬拉松）" style={{ ...s.input, marginBottom: 8 }} />
      <div style={{ display: "flex", gap: 8 }}>
        <input type="date" value={f.date} onChange={e => setF(x => ({ ...x, date: e.target.value }))} style={{ ...s.input, marginBottom: 8, flex: 1 }} />
        <input value={f.place} maxLength={30} onChange={e => setF(x => ({ ...x, place: e.target.value }))} placeholder="地點" style={{ ...s.input, marginBottom: 8, flex: 1 }} />
      </div>
      <input value={f.link} onChange={e => setF(x => ({ ...x, link: e.target.value }))} placeholder="報名網址 https://…（選填）" style={{ ...s.input, marginBottom: 8 }} />
      <button onClick={add} style={s.btn("primary")}>貼到運動室公告欄</button>
      {msg && <div style={{ fontSize: 13, marginTop: 8, color: msg.startsWith("✅") ? C.green : C.red }}>{msg}</div>}
    </div>
  </>;
}

function IdeaBox({ apiPost, C, s }) {
  const [text, setText] = useState(""), [msg, setMsg] = useState("");
  const send = async () => { const r = await apiPost({ action: "v42Idea", text }, 0); if (r && r.success) { setText(""); setMsg("✅ 已投進意見箱，謝謝你！"); } else setMsg((r && r.error) || "送出失敗"); };
  return (
    <div style={s.card}>
      <div style={s.sectionTitle}>📮 意見箱（寫給隊長）</div>
      <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 8 }}>任何建議、想法、煩惱都可以寫。只有大隊長看得到，會留下你的名字，隊長可以回覆你。</div>
      <textarea value={text} maxLength={300} onChange={e => setText(e.target.value)} rows={5} style={{ ...s.input, marginBottom: 8, resize: "vertical" }} placeholder="想對隊長說的話…" />
      <button disabled={text.trim().length < 2} onClick={send} style={{ ...s.btn("primary"), opacity: text.trim().length < 2 ? .5 : 1 }}>投進意見箱</button>
      {msg && <div style={{ fontSize: 13, marginTop: 8, color: msg.startsWith("✅") ? C.green : C.red }}>{msg}</div>}
    </div>
  );
}

// 管理端（Lv.4 以上）：核准、退回、標已報帳；大隊長另外看意見箱
export function BenefitAdmin({ user, apiGet, apiPost, C, s }) {
  const [st, setSt] = useState("待核准"), [d, setD] = useState(null), [msg, setMsg] = useState(null), [ideas, setIdeas] = useState(null);
  const load = () => apiGet({ action: "bfList", status: st === "意見箱" ? "" : st }, 0).then(r => setD(r && r.success ? r.data : { error: (r && r.error) || "讀取失敗" }));
  useEffect(() => { if (st === "意見箱") apiGet({ action: "v42Ideas" }, 0).then(r => setIdeas(r && r.success ? r.data : { error: (r && r.error) || "讀取失敗" })); else load(); }, [st]);
  const act = async (x, a) => {
    let extra = {};
    if (a === "approve") { const v = window.prompt(`核准「${x.name}｜${x.title}」\n補助金額（可調整，最多 ${x.amount}）`, String(x.sub)); if (v == null) return; extra.sub = v; }
    if (a === "reject") { const v = window.prompt("退回原因"); if (!v) return; extra.reason = v; }
    if (a === "paid" && !window.confirm(`「${x.name}｜${x.title}」${money(x.sub)} 已經報帳給他了嗎？`)) return;
    const r = await apiPost({ action: "bfSet", id: x.id, act: a, ...extra }, 0);
    setMsg(r && r.success ? { ok: true, text: "✅ 已更新，申請人會收到提醒" } : { ok: false, text: (r && r.error) || "失敗" }); load();
  };
  const reply = async x => { const v = window.prompt("回覆（會送到他的提醒）", x.reply || ""); if (!v) return; const r = await apiPost({ action: "v42IdeaReply", i: x.i, text: v }, 0); setMsg(r && r.success ? { ok: true, text: "✅ 已回覆" } : { ok: false, text: (r && r.error) || "失敗" }); apiGet({ action: "v42Ideas" }, 0).then(r => r && r.success && setIdeas(r.data)); };
  const tabs = ["待核准", "待報帳", "已報帳", "退回", ...(user.role >= 5 ? ["意見箱"] : [])];
  return (
    <div>
      {msg && <Flash text={msg.text} kind={msg.ok ? "ok" : "bad"} />}
      <div style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto" }}>
        {tabs.map(k => <button key={k} onClick={() => setSt(k)} style={{ flex: "0 0 auto", border: "none", borderRadius: 10, padding: "7px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: st === k ? C.accent : C.warm, color: st === k ? "#fff" : C.text }}>{k}{d && d.count && d.count[k] ? ` · ${d.count[k]}` : ""}</button>)}
      </div>
      {st !== "意見箱" && d && !d.error && st === "待報帳" && <div style={{ ...s.card, fontSize: 14 }}>待報帳合計：<b style={{ color: C.accent }}>{money(d.unpaid)}</b></div>}
      {st !== "意見箱" && d && d.error && <div style={{ ...s.card, color: C.red }}>{d.error}</div>}
      {st !== "意見箱" && d && !d.error && (
        <div style={s.card}>
          {d.list.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>沒有資料</div>}
          {d.list.map(x => (
            <div key={x.id} style={{ padding: "9px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ flex: 1 }}><b>{x.name}</b>｜{x.title}<span style={{ display: "block", fontSize: 11.5, color: C.muted }}>{CAT_NAME[x.cat] || x.cat}・{x.date}・申請 {money(x.amount)}{x.note ? `・${x.note}` : ""}</span></span>
                <b style={{ color: C.accent }}>{money(x.sub)}</b>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                {x.receipt && <a href={x.receipt} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>🧾 收據</a>}
                {x.proof && <a href={x.proof} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>🏅 證明</a>}
                <span style={{ flex: 1 }} />
                {x.status === "待核准" && <><button onClick={() => act(x, "reject")} style={sm(C)}>退回</button><button onClick={() => act(x, "approve")} style={{ ...sm(C), background: C.accent, color: "#fff", borderColor: C.accent }}>核准</button></>}
                {x.status === "待報帳" && <button onClick={() => act(x, "paid")} style={{ ...sm(C), background: C.green, color: "#fff", borderColor: C.green }}>已報帳</button>}
                {x.status === "退回" && <span style={{ fontSize: 12, color: C.red }}>{x.reason}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      {st === "意見箱" && ideas && (ideas.error ? <div style={{ ...s.card, color: C.red }}>{ideas.error}</div> : (
        <div style={s.card}>
          {ideas.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>意見箱是空的</div>}
          {ideas.map(x => (
            <div key={x.i} style={{ padding: "9px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13.5 }}>
              <div style={{ fontSize: 11.5, color: C.muted }}>{x.time}・{x.name}</div>
              <div style={{ whiteSpace: "pre-wrap", margin: "3px 0" }}>{x.text}</div>
              {x.reply && <div style={{ fontSize: 12.5, color: C.blue }}>↪ {x.reply}</div>}
              {!x.anon && <button onClick={() => reply(x)} style={sm(C)}>{x.reply ? "改回覆" : "回覆"}</button>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
const sm = C => ({ border: `1px solid ${C.border}`, background: C.card, borderRadius: 999, padding: "3px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: C.text });
