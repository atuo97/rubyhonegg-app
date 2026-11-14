// ─────────────────────────────────────────────
// v1.41 宇宙辦公室：點 3D 看板 → 全螢幕放大（大字、可以左右切換其他看板）
// ─────────────────────────────────────────────
import { useState } from "react";
import { createPortal } from "react-dom";
import { SCENES, SCENE_KEYS, sceneOf, shortLoc } from "./officeScene.js";

const ST = { open: ["營業中", "#1e8449"], before: ["準備中", "#b9770e"], closed: ["已打烊", "#7f8c8d"] };

export default function BoardModal41({ k, onClose, onGo, C, s, liveRev = [], opsMap = {}, short = [], game, onDuty = [], user = {}, apiPost, onChanged, own }) {
  const [form, setForm] = useState(null), [fmsg, setFmsg] = useState("");   // v1.44 貼客人讚美、改菜單
  const post = async (payload, ok) => { const r = await apiPost(payload, 0); if (r && r.success) { setFmsg(ok); setForm(null); onChanged && onChanged(); } else setFmsg((r && r.error) || "失敗了"); };
  const stores = SCENE_KEYS.filter(x => SCENES[x].store && opsMap[x] && (opsMap[x].state === "open" || liveRev.some(r => sceneOf(r.loc) === x) || short.some(y => y.scene === x)));
  const keys = ["rev", "status", "attend", ...stores.map(x => "store:" + x), "factory", "warehouse", "thanks", "praise", "menu", "rank", "sport", "cert"];
  const [cur, setCur] = useState(keys.includes(k) ? k : k);
  const i = keys.indexOf(cur), step = d => setCur(keys[(Math.max(0, i) + d + keys.length) % keys.length]);
  let touchX = null;

  const Row = ({ l, v, c, sub }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 4px", borderBottom: `1px solid ${C.border}` }}>
      <div style={{ flex: 1, fontSize: 17 }}>{l}{sub && <div style={{ fontSize: 12.5, color: C.muted }}>{sub}</div>}</div>
      <b style={{ fontSize: 19, color: c || C.text }}>{v}</b>
    </div>
  );
  const empty = t => <div style={{ fontSize: 16, color: C.muted, padding: "24px 4px", textAlign: "center" }}>{t}</div>;

  let title = "", color = "#c0392b", body = null, go = null;
  if (cur === "rev" && own) {   // v1.49 加盟、合作品牌：只看本店，不顯示名次
    title = "⚡ 本店今日營業額";
    body = liveRev.length ? liveRev.map(x => <Row key={x.loc} l={shortLoc(x.loc)} sub={`${x.time} 回報・${x.by || ""}`} v={"$" + Number(x.amount).toLocaleString()} />) : empty("今天還沒有回報");
  } else if (cur === "rev") {
    title = "⚡ 今日即時營業額 PK";
    body = liveRev.length ? liveRev.map((x, n) => <Row key={x.loc} l={`${["🥇", "🥈", "🥉"][n] || n + 1 + "."} ${shortLoc(x.loc)}`} sub={`${x.time} 回報・${x.by || ""}`} v={"$" + Number(x.amount).toLocaleString()} c={n === 0 ? "#c0392b" : null} />) : empty("今天還沒有櫃位回報");
  } else if (cur === "status") {
    title = "🏪 櫃位狀態"; color = "#2e6da4";
    const list = SCENE_KEYS.filter(x => SCENES[x].store && opsMap[x]);
    body = list.map(x => { const m = opsMap[x], t = ST[m.state] || ST.before; return <Row key={x} l={`${SCENES[x].icon} ${SCENES[x].name}`} sub={[m.batterLow ? "⚠️ 麵糊快不夠" : "", m.pickup ? `📦 今日待取貨 ${m.pickup} 筆` : ""].filter(Boolean).join("・")} v={t[0]} c={t[1]} />; });
  } else if (cur === "attend") {
    title = `☀️ 今日出勤 ${onDuty.length} 人`; color = "#e67e22";
    body = onDuty.length ? onDuty.map(p => <Row key={p.id} l={p.name} v={shortLoc(p.location)} c="#1e8449" sub={p.inTime ? new Date(p.inTime).toLocaleTimeString("zh-TW", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hour12: false }) + " 上班" : ""} />) : empty("目前沒有人上班中");
  } else if (cur.startsWith("store:")) {
    const sk = cur.slice(6), m = opsMap[sk] || {}, t = ST[m.state] || ST.before, rv = liveRev.filter(r => sceneOf(r.loc) === sk);
    title = `${SCENES[sk].icon} ${SCENES[sk].name}`; color = "#6e4b2a"; go = sk;
    body = <>
      <Row l="營業狀態" v={t[0]} c={t[1]} />
      {rv.map(r => <Row key={r.loc} l="⚡ 即時營業額" sub={`${r.time} 回報・${r.by || ""}`} v={"$" + Number(r.amount).toLocaleString()} c="#c0392b" />)}
      {m.batter && <Row l="🥣 麵糊（包）" sub={m.bDate ? m.bDate.slice(5).replace("-", "/") + " 收店盤點" : ""} v={`原味 ${m.batter["原味"] ?? "—"}・其他 ${m.batter["其他口味"] ?? "—"}`} c={m.batterLow ? "#c0392b" : null} />}
      {m.pickup > 0 && <Row l="📦 今日待取貨" v={m.pickup + " 筆"} />}
      <div style={{ fontSize: 15, fontWeight: 700, margin: "14px 4px 2px" }}>📋 缺貨看板</div>
      {short.filter(x => x.scene === sk).length ? short.filter(x => x.scene === sk).map(x => <Row key={x.id} l={x.item} sub={x.by} v={x.status === "已發貨" ? "🚚 已發貨" : "缺"} c={x.status === "已發貨" ? "#2e6da4" : "#c0392b"} />) : empty("✅ 目前不缺")}
    </>;
  } else if (cur === "factory") {
    const f = (game && game.boards && game.boards.factory) || {};
    title = "🏭 今日產線"; color = "#1e8449"; go = "factory";
    body = <><Row l="待做麵糊" v={(f.batter || 0) + " 包"} /><Row l="預拌粉需求" v={(f.flour || 0) + " 袋"} />{(f.byLoc || []).map(x => <Row key={x.loc} l={"・" + x.loc} v={x.qty + " 包"} />)}<div style={{ fontSize: 12.5, color: C.muted, marginTop: 8 }}>依各櫃位叫貨單（未出貨）</div></>;
  } else if (cur === "warehouse") {
    const w = (game && game.boards && game.boards.warehouse) || {};
    title = "📦 倉庫看板"; color = "#2e6da4"; go = "warehouse";
    body = <><Row l="待出貨叫貨單" v={(w.pending || 0) + " 張"} /><Row l="配送中" v={(w.shipped || 0) + " 張"} /><Row l="今天新進叫貨" v={(w.todayIn || 0) + " 張"} /><div style={{ fontSize: 12.5, color: C.muted, marginTop: 8 }}>之後接 ERP 顯示真實庫存</div></>;
  } else if (cur === "menu") {
    const ct = (game && game.canteen) || {}, mn = (ct.menu && ct.menu.lines) || [], meal = ct.meal || [];
    title = "🍱 今日菜單"; go = "canteen";
    body = <>
      {mn.length ? mn.map((l, i) => <Row key={i} l={`${i + 1}. ${l}`} v="" />) : <><Row l="主廚推薦" v="敬請期待" /><Row l="飯後甜點" v="現烤雞蛋糕" /></>}
      {ct.menu && ct.menu.by && <div style={{ fontSize: 11.5, color: C.light, margin: "4px 4px" }}>{ct.menu.date} {ct.menu.by} 更新</div>}
      {meal.length > 0 && <Row l="👑 今天和隊長吃飯" v={meal.map(x => x.name).join("、")} c="#c0392b" />}
      {(game && game.birthdays || []).length > 0 && <Row l="🎂 今天的壽星" v={game.birthdays.map(b => b.name).join("、")} c="#e84393" />}
      <div style={{ fontSize: 12.5, color: C.muted, marginTop: 8 }}>點休息中的隊員 →「🧇 請吃」請他吃雞蛋糕；和隊長吃飯在「我的錢包」預約</div>
      {user.role >= 3 && (form === "menu" ? <div style={{ marginTop: 10 }}>
        <textarea defaultValue={mn.join("\n")} id="rh-menu" rows={5} style={{ ...s.input, resize: "vertical" }} placeholder="一行一道（最多 6 行）" />
        <button onClick={() => post({ action: "v44MenuSet", lines: document.getElementById("rh-menu").value }, "✅ 菜單已更新")} style={{ ...s.btn("primary"), marginTop: 8 }}>儲存菜單</button>
      </div> : <button onClick={() => setForm("menu")} style={{ ...s.btn("ghost"), marginTop: 10 }}>✏️ 改今日菜單</button>)}
    </>;
  } else if (cur === "rank") {
    const rk = (game && game.rank) || [];
    title = "🏆 本週排行榜"; color = "#8e44ad"; go = "gameroom";
    body = <>
      <Row l="🧸 夾娃娃機" v="點機台就能玩" c="#ff6fa8" />
      {rk.length ? rk.map(g => <div key={g.game} style={{ marginTop: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 700, margin: "0 4px 2px" }}>{g.name}</div>
        {g.top.map((x, i) => <Row key={i} l={`${["🥇", "🥈", "🥉"][i]} ${x.name}`} v={x.score.toLocaleString()} c={i === 0 ? "#8e44ad" : null} />)}
      </div>) : empty("這週還沒有人玩小遊戲")}
      <div style={{ fontSize: 12.5, color: C.muted, marginTop: 8 }}>每週一結算，各遊戲第一名拿「小遊戲週冠軍」徽章和獎勵</div>
    </>;
  } else if (cur === "sport") {   // v1.42 比賽公告＋完賽榮譽牆
    const ev = (game && game.events) || [], w = (game && game.bfWall && game.bfWall.sport) || [];
    title = "🏃 比賽公告・完賽榜"; color = "#27ae60"; go = "gym";
    body = <>
      <div style={{ fontSize: 15, fontWeight: 700, margin: "10px 4px 2px" }}>近期比賽</div>
      {ev.length ? ev.map(x => <Row key={x.id} l={x.link ? <a href={x.link} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>{x.name} ↗</a> : x.name} sub={x.place} v={x.date.slice(5).replace("-", "/")} c="#27ae60" />) : empty("還沒有人貼比賽")}
      <div style={{ fontSize: 15, fontWeight: 700, margin: "14px 4px 2px" }}>🏅 完賽榮譽牆</div>
      {w.length ? w.map((x, i) => <Row key={i} l={x.name} sub={x.date} v={x.title} c="#c0392b" />) : empty("第一個完賽的就是你！")}
      <div style={{ fontSize: 12.5, color: C.muted, marginTop: 8 }}>完賽後到大廳福利櫃檯申請報名費補助，累積 3 場還有購物金。點自己的小人 →「💪 去運動」不限次數。</div>
    </>;
  } else if (cur === "cert") {
    const w = (game && game.bfWall && game.bfWall.cert) || [];
    title = "🎓 證照榮譽牆"; color = "#2e86c1"; go = "study";
    body = <>{w.length ? w.map((x, i) => <Row key={i} l={x.name} sub={x.date} v={x.title} c="#2e6da4" />) : empty("第一個考取證照的就是你！")}
      <div style={{ fontSize: 12.5, color: C.muted, marginTop: 8 }}>烘焙、中餐、衛生、管理等專業證照：考照報名費全額補助；上課學費考取後補 50%（每年 2 個課程）。到大廳福利櫃檯申請。</div></>;
  } else if (cur === "praise") {   // v1.44 客人讚美
    const pr = (game && game.praise) || [];
    title = "⭐ 客人的讚美"; color = "#f39c12"; go = "office";
    body = <>
      {pr.length ? pr.map((x, i) => <div key={i} style={{ padding: "10px 4px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 16 }}>「{x.text}」</div>
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>{[x.who && "稱讚 " + x.who, x.loc, x.src, x.date].filter(Boolean).join("・")}</div>
      </div>) : empty("還沒有貼上客人的讚美")}
      {user.role >= 2 && (form === "praise" ? <div style={{ marginTop: 10 }}>
        <textarea id="rh-pr-t" rows={3} maxLength={80} style={{ ...s.input, resize: "vertical", marginBottom: 6 }} placeholder="客人說的話（例：雞蛋糕超好吃，服務很親切）" />
        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <input id="rh-pr-w" maxLength={20} style={{ ...s.input, flex: 1 }} placeholder="稱讚哪位隊員（選填）" />
          <input id="rh-pr-l" maxLength={20} style={{ ...s.input, flex: 1 }} placeholder="櫃位（選填）" />
        </div>
        <select id="rh-pr-s" style={{ ...s.input, marginBottom: 6 }}>{["Google 評論", "現場", "社群", "電話", "其他"].map(x => <option key={x}>{x}</option>)}</select>
        <button onClick={() => post({ action: "v44Praise", text: document.getElementById("rh-pr-t").value, who: document.getElementById("rh-pr-w").value, loc: document.getElementById("rh-pr-l").value, src: document.getElementById("rh-pr-s").value }, "✅ 已貼上讚美牆")} style={s.btn("primary")}>貼上讚美牆</button>
      </div> : <button onClick={() => setForm("praise")} style={{ ...s.btn("ghost"), marginTop: 10 }}>⭐ 貼一則客人的讚美</button>)}
    </>;
  } else if (cur === "thanks") {
    const t = (game && game.thanks) || [];
    title = "💌 感謝牆"; color = "#e84393"; go = "office";
    body = <>{t.length ? t.map((x, i) => <Row key={i} l={`${x.fromName} → ${x.toName}`} sub={x.time} v={x.text} c="#7a2a4a" />) : empty("還沒有人貼，點隊員 →「💌 謝謝」")}</>;
  }

  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 1600, display: "flex", alignItems: "center", justifyContent: "center", padding: "calc(12px + env(safe-area-inset-top)) 12px calc(12px + env(safe-area-inset-bottom))" }}>
      <div onClick={e => e.stopPropagation()} onTouchStart={e => (touchX = e.touches[0].clientX)} onTouchEnd={e => { if (touchX == null) return; const dx = e.changedTouches[0].clientX - touchX; if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1); touchX = null; }}
        style={{ background: "#fbfaf5", width: "100%", maxWidth: 520, maxHeight: "100%", display: "flex", flexDirection: "column", borderRadius: 18, overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,.35)", border: "6px solid #6e4b2a" }}>
        <div style={{ background: color, color: "#fff", padding: "14px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => step(-1)} style={btn}>‹</button>
          <div style={{ flex: 1, textAlign: "center", fontSize: 20, fontWeight: 700 }}>{title}</div>
          <button onClick={() => step(1)} style={btn}>›</button>
        </div>
        <div style={{ overflowY: "auto", padding: "4px 14px 10px", color: "#2b1d14" }}>{body}{fmsg && <div style={{ fontSize: 13, marginTop: 8, color: fmsg.startsWith("✅") ? "#1e8449" : "#b42318" }}>{fmsg}</div>}</div>
        <div style={{ display: "flex", gap: 8, padding: "10px 14px 14px", borderTop: `1px solid ${C.border}` }}>
          {go && <button onClick={() => onGo(go)} style={{ ...s.btn("primary"), flex: 1 }}>前往這裡</button>}
          <button onClick={onClose} style={{ ...s.btn("ghost"), flex: 1 }}>關閉</button>
        </div>
        <div style={{ textAlign: "center", fontSize: 11, color: C.light, paddingBottom: 8 }}>左右滑動看其他看板（{Math.max(0, i) + 1}／{keys.length}）</div>
      </div>
    </div>, document.body
  );
}
const btn = { width: 36, height: 36, borderRadius: 10, border: "none", background: "rgba(255,255,255,.22)", color: "#fff", fontSize: 24, lineHeight: "34px", padding: 0, cursor: "pointer", fontFamily: "inherit" };
