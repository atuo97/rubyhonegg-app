// ─────────────────────────────────────────────
// v1.56 打卡異常：忘記打下班卡（本人申請補登 → 主管核准）、打卡位置離櫃位太遠
// 核准：Lv.2 自己負責的櫃位；Lv.3 以上所有地點；不能核准自己的（大隊長除外）
// ─────────────────────────────────────────────
import { useEffect, useState } from "react";
import { Flash } from "./TopToast.jsx";

export const PF_LIMIT = 300;   // 預設距離上限（公尺），後端〈遊戲參數〉「打卡距離上限公尺」可改
const shortLoc = l => String(l || "").replace(/^\d+/, "").replace(/-.*$/, "");
const md = d => String(d || "").slice(5).replace("-", "/");
export const fmtDist = m => m >= 1000 ? (m / 1000).toFixed(1) + " 公里" : Math.round(m) + " 公尺";
export function distM(a, b, c, d) {
  const R = 6371000, r = Math.PI / 180, x = (c - a) * r, y = (d - b) * r;
  const h = Math.sin(x / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(y / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
// 打卡前檢查距離：太遠就問原因；回傳 null＝取消打卡，""＝不用備註，其他＝要加進備註的文字
export function punchDistCheck(locations, loc, coords, kindLabel) {
  const L = (locations || {})[loc];
  if (!L || L.lat == null || L.lng == null || L.lat === "" || /活動/.test(L.kind || "") || !coords) return "";
  const dd = distM(coords.lat, coords.lng, Number(L.lat), Number(L.lng));
  if (!(dd > PF_LIMIT)) return "";
  const why = window.prompt(`📍 你現在離「${shortLoc(loc)}」約 ${fmtDist(dd)}，不在櫃位附近。\n\n如果確定要${kindLabel}，請寫原因（例如：GPS 不準、先離開櫃位才想到要打卡）。\n按「取消」可以回到櫃位再打卡。`, "");
  if (why === null) return null;
  return `位置：離櫃位 ${fmtDist(dd)}｜原因：${String(why).trim() || "（沒寫）"}`;
}

// 「出勤」頁最上面：我的打卡異常（沒打下班卡 → 申請補登）
export function PunchAlerts({ apiGet, apiPost, C, s }) {
  const [d, setD] = useState(null), [form, setForm] = useState(null), [msg, setMsg] = useState(null), [busy, setBusy] = useState(false);
  const load = () => apiGet({ action: "pfMine" }, 1).then(r => setD(r && r.success && r.data && Array.isArray(r.data.open) && Array.isArray(r.data.reqs) ? r.data : null)).catch(() => {});   // 部署端：格式不對就不顯示（出勤頁是打卡的地方，不能整頁當掉）
  useEffect(() => { load(); }, []);
  if (!d) return null;
  const recent = d.reqs.filter(r => r.status !== "核准" || r.date >= new Date(Date.now() - 3 * 864e5 + 8 * 3600e3).toISOString().slice(0, 10)).slice(0, 5);
  if (!d.open.length && !recent.length) return null;
  const send = async () => {
    setBusy(true); const r = await apiPost({ action: "pfRequest", date: form.date, loc: form.loc, time: form.time, reason: form.reason }, 0); setBusy(false);
    if (r && r.success) { setMsg({ ok: true, text: "⏰ 已送出，主管核准後就會補上" }); setForm(null); load(); } else setMsg({ ok: false, text: (r && r.error) || "送出失敗" });
  };
  const ST = { 待審: ["#d68a1a", "等主管核准"], 核准: ["#27ae60", "已核准"], 退回: ["#c0392b", "被退回"], 已補登: ["#7f8c8d", "已補登"] };
  return (
    <div style={{ ...s.card, border: `1.5px solid ${d.open.length ? "#e74c3c" : C.border}` }}>
      {msg && <Flash text={msg.text} kind={msg.ok ? "ok" : "bad"} />}
      <div style={{ fontSize: 14.5, fontWeight: 800, color: d.open.length ? "#c0392b" : C.text, marginBottom: 6 }}>⏰ 打卡要處理{d.open.length ? `（${d.open.length}）` : ""}</div>
      {d.open.map(x => (
        <div key={x.key} style={{ padding: "8px 0", borderTop: `1px dashed ${C.border}` }}>
          <div style={{ fontSize: 13.5 }}><b>{md(x.date)} {shortLoc(x.loc)}</b>：{x.inTime} 上班，<span style={{ color: "#c0392b" }}>沒有打下班卡</span></div>
          {x.pending ? <div style={{ fontSize: 12, color: "#d68a1a", marginTop: 3 }}>已申請補登 {x.pending}，等主管核准</div>
            : form && form.key === x.key ? (
              <div style={{ marginTop: 6 }}>
                <label style={{ fontSize: 12, color: C.muted }}>實際下班時間<input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} style={{ ...s.input, marginBottom: 6 }} /></label>
                <input value={form.reason} maxLength={100} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="原因（例如：收店太趕忘記打卡）" style={{ ...s.input, marginBottom: 6 }} />
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setForm(null)} style={{ ...s.btn("ghost"), flex: 1 }}>取消</button>
                  <button disabled={busy || !form.time || form.reason.trim().length < 2} onClick={send} style={{ ...s.btn("primary"), flex: 2, opacity: busy || !form.time || form.reason.trim().length < 2 ? .5 : 1 }}>{busy ? "送出中…" : "送出補登申請"}</button>
                </div>
              </div>
            ) : <button onClick={() => { setMsg(null); setForm({ key: x.key, date: x.date, loc: x.loc, time: "", reason: "" }); }} style={{ marginTop: 5, border: "none", borderRadius: 999, background: "#c0392b", color: "#fff", padding: "5px 12px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>申請補登下班</button>}
        </div>
      ))}
      {recent.length > 0 && <div style={{ marginTop: d.open.length ? 8 : 0 }}>
        {recent.map(r => <div key={r.id} style={{ fontSize: 12.5, padding: "5px 0", borderTop: `1px dashed ${C.border}` }}>
          <span style={{ color: "#fff", background: (ST[r.status] || ST.待審)[0], borderRadius: 999, padding: "1px 8px", marginRight: 6, fontSize: 11 }}>{(ST[r.status] || [0, r.status])[1]}</span>
          {md(r.date)} {shortLoc(r.loc)} 下班 {r.out}{r.reply ? `｜${r.reply}` : ""}
        </div>)}
      </div>}
    </div>
  );
}

// 管理 → 人員 →「⏰ 打卡異常」
export function PunchAdmin({ apiGet, apiPost, C, s }) {
  const [d, setD] = useState(null), [t, setT] = useState("req"), [msg, setMsg] = useState(null), [form, setForm] = useState(null), [busy, setBusy] = useState(false);
  const load = () => apiGet({ action: "pfList" }, 0).then(r => setD(r && r.success && r.data && Array.isArray(r.data.reqs) && Array.isArray(r.data.open) && Array.isArray(r.data.far) ? r.data : { error: (r && r.error) || "讀取失敗" }));   // 部署端：格式檢查
  useEffect(() => { load(); }, []);
  const call = async (body, ok) => {
    setBusy(true); const r = await apiPost(body, 0); setBusy(false);
    if (r && r.success) { setMsg({ ok: true, text: ok }); setForm(null); load(); } else setMsg({ ok: false, text: (r && r.error) || "失敗" });
  };
  if (!d) return <div className="rh-skel" style={{ height: 160, borderRadius: 18 }} />;
  if (d.error) return <div style={{ ...s.card, color: C.red }}>{d.error}</div>;
  const sm = { border: `1px solid ${C.border}`, background: C.card, borderRadius: 999, padding: "4px 11px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: C.text };
  const tabs = [["req", `補登申請 ${d.reqs.length}`], ["open", `沒打下班 ${d.open.length}`], ["far", `位置異常 ${d.far.length}`]];
  const timeForm = (k, label, onOk, withReason) => form && form.k === k ? (
    <div style={{ marginTop: 6 }}>
      <input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} style={{ ...s.input, marginBottom: 6 }} />
      {withReason && <input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="備註（選填）" style={{ ...s.input, marginBottom: 6 }} />}
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => setForm(null)} style={{ ...s.btn("ghost"), flex: 1 }}>取消</button>
        <button disabled={busy || !form.time} onClick={() => onOk(form)} style={{ ...s.btn("primary"), flex: 2, opacity: busy || !form.time ? .5 : 1 }}>{label}</button>
      </div>
    </div>) : null;
  return (
    <div>
      {msg && <Flash text={msg.text} kind={msg.ok ? "ok" : "bad"} />}
      <div style={{ ...s.card, padding: "10px 14px", fontSize: 12.5, color: C.muted, lineHeight: 1.6 }}>
        {d.all ? "你可以處理所有地點。" : "你可以處理自己負責的櫃位。"}隊員忘記打下班卡會自己申請補登；核准後自動補上下班卡，薪資、累計工時、工時幣一起重算。位置異常＝打卡時離櫃位超過 {d.limit} 公尺。
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {tabs.map(([k, l]) => <button key={k} onClick={() => { setT(k); setForm(null); }} style={{ flex: 1, border: "none", borderRadius: 10, padding: "8px 0", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", background: t === k ? C.accent : C.warm, color: t === k ? "#fff" : C.text }}>{l}</button>)}
      </div>
      <div style={s.card}>
        {t === "req" && (!d.reqs.length ? <div style={{ fontSize: 13, color: C.muted }}>沒有待核准的申請 ✅</div> : d.reqs.map(r => (
          <div key={r.id} style={{ padding: "9px 0", borderTop: `1px solid ${C.border}`, fontSize: 13.5 }}>
            <div><b>{r.name}</b>・{md(r.date)} {shortLoc(r.loc)}</div>
            <div style={{ fontSize: 12.5, color: C.muted }}>上班 {r.inTime} → 申請下班 <b style={{ color: C.text }}>{r.out}</b>｜{r.reason}</div>
            {!r.canDecide ? <div style={{ fontSize: 12, color: C.light, marginTop: 4 }}>自己的申請要由其他主管核准</div> : <>
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                <button disabled={busy} onClick={() => call({ action: "pfDecide", id: r.id, ok: true }, "✅ 已核准並補上下班卡")} style={{ ...sm, background: "#27ae60", color: "#fff", border: "none" }}>✅ 核准 {r.out}</button>
                <button onClick={() => setForm({ k: "adj" + r.id, time: r.out, reason: "" })} style={sm}>改時間再核准</button>
                <button disabled={busy} onClick={() => { const v = window.prompt("退回原因（會通知他）", ""); if (v) call({ action: "pfDecide", id: r.id, ok: false, reply: v }, "已退回"); }} style={{ ...sm, color: C.red }}>退回</button>
              </div>
              {timeForm("adj" + r.id, "用這個時間核准", f => call({ action: "pfDecide", id: r.id, ok: true, time: f.time }, "✅ 已核准並補上下班卡"))}
            </>}
          </div>)))}
        {t === "open" && (!d.open.length ? <div style={{ fontSize: 13, color: C.muted }}>沒有忘記打下班卡的紀錄 ✅</div> : d.open.map(x => (
          <div key={x.key} style={{ padding: "9px 0", borderTop: `1px solid ${C.border}`, fontSize: 13.5 }}>
            <div><b>{x.name}</b>・{md(x.date)} {shortLoc(x.loc)}：{x.inTime} 上班，沒打下班卡</div>
            <div style={{ fontSize: 12, color: C.light }}>還沒申請補登{x.mine ? "（自己的請到「出勤」申請，由其他主管核准）" : ""}</div>
            {!x.mine && <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              <button onClick={() => setForm({ k: "close" + x.key, time: "", reason: "" })} style={sm}>直接補登下班</button>
              {d.canIgnore && <button disabled={busy} onClick={() => { if (window.confirm("標成「不處理」？（例如測試資料）這筆不會算工時。")) call({ action: "pfIgnore", key: x.key }, "已標成不處理"); }} style={{ ...sm, color: C.muted }}>不處理</button>}
            </div>}
            {timeForm("close" + x.key, "補登下班卡", f => call({ action: "pfClose", key: x.key, time: f.time, reason: f.reason }, "✅ 已補上下班卡"), true)}
          </div>)))}
        {t === "far" && (!d.far.length ? <div style={{ fontSize: 13, color: C.muted }}>沒有位置異常 ✅</div> : d.far.map(x => (
          <div key={x.pid} style={{ padding: "9px 0", borderTop: `1px solid ${C.border}`, fontSize: 13.5 }}>
            <div><b>{x.name}</b>・{md(x.date)} {shortLoc(x.loc)}・{x.type} {x.time}</div>
            <div style={{ fontSize: 12.5, color: "#c0392b" }}>📍 打卡位置離櫃位 {fmtDist(x.dist)}</div>
            {x.note && <div style={{ fontSize: 12, color: C.muted }}>{x.note}</div>}
            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              <button disabled={busy} onClick={() => call({ action: "pfLoc", pid: x.pid, act: "ok" }, "已確認")} style={sm}>👍 確認沒問題</button>
              <button onClick={() => setForm({ k: "fix" + x.pid, time: x.time, reason: "" })} style={sm}>改成正確時間</button>
            </div>
            {timeForm("fix" + x.pid, `改${x.type}時間`, f => call({ action: "pfLoc", pid: x.pid, act: "time", time: f.time }, "✅ 已修正時間並通知他"))}
          </div>)))}
      </div>
    </div>
  );
}

// 管理分頁紅點：待核准申請＋沒處理的異常
export function usePfCount(user, apiGet) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!user || user.role < 2) return;
    let alive = true;
    const run = () => apiGet({ action: "pfList" }, 1).then(r => { if (alive && r && r.success && r.data && Array.isArray(r.data.reqs) && Array.isArray(r.data.open) && Array.isArray(r.data.far)) setN(r.data.reqs.filter(x => x.canDecide).length + r.data.open.filter(x => !x.mine).length + r.data.far.length); }).catch(() => {});
    run(); const t = setInterval(run, 10 * 60 * 1000);
    return () => { alive = false; clearInterval(t); };
  }, [user && user.id, user && user.role]);
  return n;
}
