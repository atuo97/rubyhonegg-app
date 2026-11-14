// ─────────────────────────────────────────────
// v1.51 隊長室願景白板（全員可看、只有大隊長能改、隊員可留建議）＋ Bug 回報區
// ─────────────────────────────────────────────
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Flash } from "./TopToast.jsx";

export const SPEC_COL = { red: "#d63031", orange: "#e67e22", yellow: "#f1c40f", green: "#27ae60", blue: "#2e86de", indigo: "#3f3d99", violet: "#8e44ad" };
const ST_COL = { 構想中: "#95a5a6", 規劃中: "#2e86de", 進行中: "#e67e22", 已完成: "#27ae60" };
const isBossOf = u => u && (u.role >= 5 || u.position === "大隊長");

// 3D 白板也用這份資料畫（UniverseTab 讀 visionList 後傳進 engine）
export function useVision(apiGet, on = true) {
  const [d, setD] = useState(null);
  const load = () => apiGet({ action: "visionList" }, 0).then(r => setD(r && r.success ? r.data : { error: (r && r.error) || "讀取失敗" })).catch(() => setD({ error: "讀取失敗" }));
  useEffect(() => { if (on) load(); }, [on]);
  return [d, load];
}

export function VisionPage({ user, apiGet, apiPost, C, s, initial }) {
  const [d, load] = useVision(apiGet);
  const [b, setB] = useState(initial || "spectrum");
  const [msg, setMsg] = useState(null), [edit, setEdit] = useState(null), [sug, setSug] = useState(null), [busy, setBusy] = useState(false);
  const boss = isBossOf(user) && d && d.boss;
  const say = (r, ok) => { setMsg(r && r.success ? { ok: true, text: ok } : { ok: false, text: (r && r.error) || "失敗" }); if (r && r.success) load(); return r && r.success; };
  const save = async x => { setBusy(true); const r = await apiPost({ action: "visionSave", ...x }, 0); setBusy(false); return say(r, "✅ 已更新白板"); };
  if (!d) return <div className="rh-skel" style={{ height: 200, borderRadius: 18 }} />;
  if (d.error) return <div style={{ ...s.card, color: C.red }}>{d.error}</div>;
  const board = d.boards.find(x => x.id === b) || d.boards[0];
  const sm = { border: `1px solid ${C.border}`, background: C.card, borderRadius: 999, padding: "3px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: C.text };
  const Item = ({ x, list }) => {
    const i = list.indexOf(x);
    return (
      <div style={{ padding: "8px 0", borderBottom: `1px dashed ${C.border}` }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <span style={{ fontSize: 11, color: "#fff", background: ST_COL[x.status] || "#999", borderRadius: 999, padding: "2px 8px", whiteSpace: "nowrap", marginTop: 1 }}>{x.status}</span>
          <span style={{ flex: 1, fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{x.text}</span>
        </div>
        {boss && <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
          <button style={sm} onClick={() => setEdit({ op: "edit", id: x.id, text: x.text, status: x.status, sec: x.sec, board: board.id })}>✏️ 修改</button>
          {i > 0 && <button style={sm} onClick={() => save({ op: "move", id: x.id, dir: -1 })}>⬆️</button>}
          {i < list.length - 1 && <button style={sm} onClick={() => save({ op: "move", id: x.id, dir: 1 })}>⬇️</button>}
          <button style={{ ...sm, color: C.red }} onClick={() => window.confirm("刪除這一項？") && save({ op: "del", id: x.id })}>🗑️</button>
        </div>}
      </div>
    );
  };
  const items = sec => board.items.filter(x => (board.id === "spectrum" ? x.sec === sec : true));
  return (
    <div>
      {msg && <Flash text={msg.text} kind={msg.ok ? "ok" : "bad"} />}
      <div style={{ ...s.card, padding: "10px 14px", fontSize: 12.5, color: C.muted, lineHeight: 1.6 }}>
        👑 隊長室的願景白板：紅玉滿要去的地方。全體隊員都看得到，{boss ? "你可以新增、修改、排序；隊員的建議可以一鍵採納。" : "有想法就留建議給隊長，被採納會通知你！"}
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6, marginBottom: 6 }}>
        {d.boards.map(x => <button key={x.id} onClick={() => setB(x.id)} style={{ flex: "0 0 auto", border: "none", borderRadius: 999, padding: "7px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: b === x.id ? C.accent : C.warm, color: b === x.id ? "#fff" : C.text }}>{x.title}{x.items.length ? ` ${x.items.length}` : ""}</button>)}
      </div>
      <div style={{ ...s.card, background: "#fdfdfb", border: "6px solid #b9a07a", borderRadius: 14 }}>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>{board.title}</div>
        {board.id === "spectrum" ? d.spec.map(c => (
          <div key={c.id} style={{ borderLeft: `8px solid ${SPEC_COL[c.id]}`, paddingLeft: 10, margin: "10px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <b style={{ color: SPEC_COL[c.id], fontSize: 15 }}>{c.color}</b>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{c.name || <span style={{ color: C.light, fontWeight: 400 }}>（規劃中的品牌）</span>}</span>
              {boss && <button style={sm} onClick={() => { const v = window.prompt(`${c.color}色品牌名稱`, c.name || ""); if (v != null) save({ op: "name", sec: c.id, text: v }); }}>改名</button>}
            </div>
            {items(c.id).map(x => <Item key={x.id} x={x} list={items(c.id)} />)}
            {boss && <button style={{ ...sm, marginTop: 6 }} onClick={() => setEdit({ op: "add", board: "spectrum", sec: c.id, text: "", status: "構想中" })}>＋ 加想法</button>}
          </div>
        )) : <>
          {board.items.length === 0 && <div style={{ fontSize: 13, color: C.light, padding: "8px 0" }}>{boss ? "還是空白的，寫下第一個計劃吧！" : "隊長還在構思中…"}</div>}
          {board.items.map(x => <Item key={x.id} x={x} list={board.items} />)}
          {boss && <button style={{ ...s.btn("primary"), marginTop: 10 }} onClick={() => setEdit({ op: "add", board: board.id, text: "", status: "構想中" })}>＋ 新增計劃</button>}
        </>}
      </div>
      <div style={s.card}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
          <b style={{ flex: 1, fontSize: 14.5 }}>💡 隊員的建議（{board.sugg.length}）</b>
          {!boss && <button style={{ ...sm, background: C.accent, color: "#fff", border: "none", padding: "6px 12px" }} onClick={() => setSug({ board: board.id, sec: "", text: "" })}>我有想法</button>}
        </div>
        {board.sugg.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>還沒有建議{boss ? "" : "，當第一個吧！"}</div>}
        {board.sugg.map(x => (
          <div key={x.id} style={{ padding: "8px 0", borderTop: `1px solid ${C.border}`, fontSize: 13.5 }}>
            <div style={{ fontSize: 11.5, color: C.muted }}>{boss && !x.status ? "🔴 " : ""}{x.name}・{x.time}{x.sec ? `・${(d.spec.find(c => c.id === x.sec) || {}).color}色` : ""}{x.status === "採納" ? "・✅ 已採納" : ""}</div>
            <div style={{ whiteSpace: "pre-wrap", margin: "3px 0" }}>{x.text}</div>
            <div style={{ display: "flex", gap: 6 }}>
              {boss && x.status !== "採納" && <button style={sm} onClick={() => setEdit({ op: "add", board: board.id, sec: x.sec, text: x.text, status: "構想中", fromSug: x.id })}>✅ 採納</button>}
              {boss && !x.status && <button style={sm} onClick={() => save({ op: "read", id: x.id })}>已讀</button>}
              {(x.mine || boss) && x.status !== "採納" && <button style={{ ...sm, color: C.red }} onClick={async () => { if (!window.confirm(x.mine ? "收回這則建議？" : "刪除這則建議？")) return; say(await apiPost({ action: "visionDelSug", id: x.id }, 0), "已刪除"); }}>{x.mine ? "收回" : "刪除"}</button>}
            </div>
          </div>
        ))}
      </div>
      {edit && createPortal(
        <div onClick={() => setEdit(null)} style={{ position: "fixed", inset: 0, zIndex: 1800, background: "rgba(20,10,20,.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 14 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: C.bg, borderRadius: 18, padding: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>{edit.op === "add" ? (edit.fromSug ? "✅ 採納建議" : "＋ 新增計劃") : "✏️ 修改"}</div>
            {edit.board === "spectrum" && <select value={edit.sec || ""} onChange={e => setEdit({ ...edit, sec: e.target.value })} style={{ ...s.input, marginBottom: 8 }}>
              {d.spec.map(c => <option key={c.id} value={c.id}>{c.color}・{c.name || "規劃中的品牌"}</option>)}
            </select>}
            <textarea value={edit.text} maxLength={200} rows={4} onChange={e => setEdit({ ...edit, text: e.target.value })} placeholder="例如：自己買 CNC 做雞蛋糕機" style={{ ...s.input, marginBottom: 8, resize: "vertical" }} />
            <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              {d.status.map(t => <button key={t} onClick={() => setEdit({ ...edit, status: t })} style={{ ...sm, background: edit.status === t ? ST_COL[t] : C.card, color: edit.status === t ? "#fff" : C.text }}>{t}</button>)}
            </div>
            <button disabled={busy || !edit.text.trim() || (edit.board === "spectrum" && !edit.sec)} onClick={async () => { if (await save(edit)) setEdit(null); }} style={{ ...s.btn("primary"), opacity: busy || !edit.text.trim() ? .5 : 1 }}>{busy ? "儲存中…" : "儲存"}</button>
            <button onClick={() => setEdit(null)} style={{ ...s.btn("ghost"), marginTop: 6 }}>取消</button>
          </div>
        </div>, document.body)}
      {sug && createPortal(
        <div onClick={() => setSug(null)} style={{ position: "fixed", inset: 0, zIndex: 1800, background: "rgba(20,10,20,.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 14 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: C.bg, borderRadius: 18, padding: 14 }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>💡 給「{board.title}」的建議</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>會顯示你的名字，全體隊員看得到；每天最多 5 則</div>
            {board.id === "spectrum" && <select value={sug.sec} onChange={e => setSug({ ...sug, sec: e.target.value })} style={{ ...s.input, marginBottom: 8 }}>
              <option value="">不指定顏色</option>
              {d.spec.map(c => <option key={c.id} value={c.id}>{c.color}・{c.name || "規劃中的品牌"}</option>)}
            </select>}
            <textarea value={sug.text} maxLength={200} rows={4} onChange={e => setSug({ ...sug, text: e.target.value })} placeholder="你的想法…" style={{ ...s.input, marginBottom: 10, resize: "vertical" }} />
            <button disabled={busy || sug.text.trim().length < 2} onClick={async () => { setBusy(true); const r = await apiPost({ action: "visionSuggest", ...sug }, 0); setBusy(false); if (say(r, "💡 已送出，隊長會看到")) setSug(null); }} style={{ ...s.btn("primary"), opacity: sug.text.trim().length < 2 ? .5 : 1 }}>送出</button>
            <button onClick={() => setSug(null)} style={{ ...s.btn("ghost"), marginTop: 6 }}>取消</button>
          </div>
        </div>, document.body)}
    </div>
  );
}

// ───────── Bug 回報 ─────────
const PAGES = ["首頁", "出勤／打卡", "我的", "樂園", "宇宙辦公室", "小遊戲", "官方商店／背包", "訂單／叫貨", "排班／行事曆", "薪資", "管理", "其他"];
const BUG_COL = { 待處理: "#95a5a6", 有效: "#e67e22", 已修好: "#27ae60", 無效: "#7f8c8d", 重複: "#7f8c8d" };
function shrink(file) {   // 截圖壓成 JPEG，長邊 1280
  return new Promise((ok, no) => {
    const fr = new FileReader();
    fr.onload = () => { const im = new Image(); im.onload = () => {
      const k = Math.min(1, 1280 / Math.max(im.width, im.height)), c = document.createElement("canvas");
      c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      ok(c.toDataURL("image/jpeg", 0.72)); }; im.onerror = no; im.src = fr.result; };
    fr.onerror = no; fr.readAsDataURL(file);
  });
}
const devInfo = () => { try { const ua = navigator.userAgent; const os = /iPhone|iPad/.test(ua) ? "iOS " + ((ua.match(/OS (\d+[_\d]*)/) || [])[1] || "").replace(/_/g, ".") : /Android/.test(ua) ? "Android " + ((ua.match(/Android ([\d.]+)/) || [])[1] || "") : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "其他";
  return `${os}・${window.innerWidth}x${window.innerHeight}${window.matchMedia && window.matchMedia("(display-mode: standalone)").matches ? "・主畫面App" : "・瀏覽器"}`; } catch (e) { return ""; } };

function ShotView({ id, apiGet, onClose }) {
  const [src, setSrc] = useState(null);
  useEffect(() => { apiGet({ action: "bugShot", id }, 0).then(r => setSrc(r && r.success ? "data:image/jpeg;base64," + r.data.base64 : "err")); }, [id]);
  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1900, background: "rgba(0,0,0,.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: 10 }}>
      {!src ? <div style={{ color: "#fff" }}>讀取中…</div> : src === "err" ? <div style={{ color: "#fff" }}>讀取失敗</div> : <img src={src} alt="截圖" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 8 }} />}
    </div>, document.body);
}

export function BugPage({ user, apiGet, apiPost, C, s }) {
  const [text, setText] = useState(""), [page, setPage] = useState(""), [img, setImg] = useState(""), [busy, setBusy] = useState(false), [msg, setMsg] = useState(null);
  const [d, setD] = useState(null), [shot, setShot] = useState(null);
  const load = () => apiGet({ action: "bugList" }, 0).then(r => setD(r && r.success ? r.data : { error: (r && r.error) || "讀取失敗" }));
  useEffect(() => { load(); }, []);
  const send = async () => {
    setBusy(true); const r = await apiPost({ action: "bugReport", text, page, img, dev: devInfo() }, 0); setBusy(false);
    if (r && r.success) { setMsg({ ok: true, text: "🐞 已送出，謝謝你！隊長確認有效會送你赤心幣" }); setText(""); setImg(""); setPage(""); load(); }
    else setMsg({ ok: false, text: (r && r.error) || "送出失敗" });
  };
  const mine = d && !d.error ? d.list.filter(x => x.mine) : [];
  return (
    <div>
      {msg && <Flash text={msg.text} kind={msg.ok ? "ok" : "bad"} />}
      <div style={s.card}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>🐞 回報問題</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, lineHeight: 1.6 }}>App 哪裡怪怪的、打不開、算錯、卡住都可以回報。附上截圖最好找！隊長確認有效，送你 {d && d.reward != null ? d.reward : 5} 枚赤心幣 🪙</div>
        <select value={page} onChange={e => setPage(e.target.value)} style={{ ...s.input, marginBottom: 8 }}>
          <option value="">在哪一頁發生的？（可不選）</option>
          {PAGES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <textarea value={text} maxLength={500} rows={4} onChange={e => setText(e.target.value)} placeholder="發生什麼事？例如：按「去運動」人物沒有走過去" style={{ ...s.input, marginBottom: 8, resize: "vertical" }} />
        {img ? <div style={{ position: "relative", marginBottom: 8 }}>
          <img src={img} alt="截圖" style={{ width: "100%", maxHeight: 260, objectFit: "contain", borderRadius: 10, background: "#000" }} />
          <button onClick={() => setImg("")} style={{ position: "absolute", top: 6, right: 6, border: "none", borderRadius: 999, background: "rgba(0,0,0,.6)", color: "#fff", padding: "4px 10px", cursor: "pointer" }}>移除</button>
        </div> : <label style={{ ...s.btn("ghost"), display: "block", boxSizing: "border-box", width: "100%", textAlign: "center", marginBottom: 8, cursor: "pointer" }}>📷 附上截圖（可不附）
          <input type="file" accept="image/*" style={{ display: "none" }} onChange={async e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return; try { setImg(await shrink(f)); } catch (er) { setMsg({ ok: false, text: "這張圖讀不到，換一張試試" }); } }} />
        </label>}
        <button disabled={busy || text.trim().length < 4} onClick={send} style={{ ...s.btn("primary"), opacity: busy || text.trim().length < 4 ? .5 : 1 }}>{busy ? "送出中…" : "送出回報"}</button>
      </div>
      <div style={s.card}>
        <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 6 }}>我的回報</div>
        {!d ? <div className="rh-skel" style={{ height: 60, borderRadius: 12 }} /> : d.error ? <div style={{ color: C.red, fontSize: 13 }}>{d.error}</div> : !mine.length ? <div style={{ fontSize: 13, color: C.muted }}>還沒有回報過</div> : mine.map(x => (
          <div key={x.id} style={{ padding: "8px 0", borderTop: `1px solid ${C.border}`, fontSize: 13.5 }}>
            <div style={{ fontSize: 11.5, color: C.muted }}><span style={{ color: "#fff", background: BUG_COL[x.status], borderRadius: 999, padding: "1px 8px", marginRight: 6 }}>{x.status}</span>{x.time}{x.page ? `・${x.page}` : ""}{x.reward ? `・🪙 +${x.reward}` : ""}</div>
            <div style={{ whiteSpace: "pre-wrap", margin: "3px 0" }}>{x.text}</div>
            {x.reply && <div style={{ fontSize: 12.5, color: C.blue }}>↪ 隊長：{x.reply}</div>}
            {x.shot && <button onClick={() => setShot(x.id)} style={{ border: `1px solid ${C.border}`, background: C.card, borderRadius: 999, padding: "2px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: C.text }}>🖼️ 截圖</button>}
          </div>
        ))}
      </div>
      {shot && <ShotView id={shot} apiGet={apiGet} onClose={() => setShot(null)} />}
    </div>
  );
}

// 管理 → 隊員的聲音 →「🐞 Bug 回報」（大隊長）
export function BugAdmin({ apiGet, apiPost, C, s }) {
  const [d, setD] = useState(null), [f, setF] = useState("open"), [msg, setMsg] = useState(null), [shot, setShot] = useState(null);
  const load = () => apiGet({ action: "bugList" }, 0).then(r => setD(r && r.success ? r.data : { error: (r && r.error) || "讀取失敗" }));
  useEffect(() => { load(); }, []);
  const set = async (x, status) => {
    const reply = window.prompt(`標成「${status}」，要回覆他什麼嗎？（可空白）`, x.reply || ""); if (reply === null) return;
    const r = await apiPost({ action: "bugSet", id: x.id, status, reply }, 0);
    setMsg(r && r.success ? { ok: true, text: r.data && r.data.reward && !x.reward ? `✅ 已更新，送他 ${r.data.reward} 枚赤心幣` : "✅ 已更新" } : { ok: false, text: (r && r.error) || "失敗" }); load();
  };
  if (!d) return <div className="rh-skel" style={{ height: 120, borderRadius: 18 }} />;
  if (d.error) return <div style={{ ...s.card, color: C.red }}>{d.error}</div>;
  const list = d.list.filter(x => f === "all" || (f === "open" ? (x.status === "待處理" || x.status === "有效") : x.status === "已修好"));
  const sm = { border: `1px solid ${C.border}`, background: C.card, borderRadius: 999, padding: "3px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: C.text };
  return (
    <div>
      {msg && <Flash text={msg.text} kind={msg.ok ? "ok" : "bad"} />}
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {[["open", `待處理 ${d.list.filter(x => x.status === "待處理" || x.status === "有效").length}`], ["done", "已修好"], ["all", "全部"]].map(([k, l]) => <button key={k} onClick={() => setF(k)} style={{ ...sm, flex: 1, padding: "6px 0", background: f === k ? C.accent : C.card, color: f === k ? "#fff" : C.text }}>{l}</button>)}
      </div>
      <div style={s.card}>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>標「有效」或「已修好」會自動送回報的人 {d.reward} 枚赤心幣（每則一次，參數〈遊戲參數〉Bug回報獎勵）</div>
        {!list.length && <div style={{ fontSize: 13, color: C.muted }}>沒有回報</div>}
        {list.map(x => (
          <div key={x.id} style={{ padding: "9px 0", borderTop: `1px solid ${C.border}`, fontSize: 13.5 }}>
            <div style={{ fontSize: 11.5, color: C.muted }}><span style={{ color: "#fff", background: BUG_COL[x.status], borderRadius: 999, padding: "1px 8px", marginRight: 6 }}>{x.status}</span>{x.time}・<b style={{ color: C.text }}>{x.name}</b>{x.page ? `・${x.page}` : ""}{x.reward ? `・🪙 ${x.reward}` : ""}</div>
            <div style={{ whiteSpace: "pre-wrap", margin: "3px 0" }}>{x.text}</div>
            {x.dev && <div style={{ fontSize: 11, color: C.light }}>📱 {x.dev}</div>}
            {x.reply && <div style={{ fontSize: 12.5, color: C.blue }}>↪ {x.reply}</div>}
            <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
              {x.shot && <button style={sm} onClick={() => setShot(x.id)}>🖼️ 截圖</button>}
              {x.status !== "有效" && x.status !== "已修好" && <button style={sm} onClick={() => set(x, "有效")}>👍 有效</button>}
              {x.status !== "已修好" && <button style={{ ...sm, color: "#27ae60" }} onClick={() => set(x, "已修好")}>✅ 已修好</button>}
              {x.status === "待處理" && <button style={sm} onClick={() => set(x, "重複")}>重複</button>}
              {x.status === "待處理" && <button style={sm} onClick={() => set(x, "無效")}>無效</button>}
            </div>
          </div>
        ))}
      </div>
      {shot && <ShotView id={shot} apiGet={apiGet} onClose={() => setShot(null)} />}
    </div>
  );
}
