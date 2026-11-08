// ─────────────────────────────────────────────
// 🌌 宇宙辦公室分頁（測試中：僅 Lv.3 可見）
// 依打卡狀態，讓夥伴的角色出現在他上班的櫃位
// ─────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { createOffice, SCENES, SCENE_KEYS, sceneOf, shortLoc } from "./officeScene.js";

const CSS = `
.uo-wrap{position:relative;border-radius:16px;overflow:hidden;background:#1d1b2e}
.uo-bubble{position:absolute;transform:translate(-50%,-100%);background:#fffaf2;color:#2b1d14;font-size:11px;line-height:1.35;padding:5px 8px;border-radius:9px;max-width:150px;box-shadow:0 3px 10px rgba(0,0,0,.35);transition:opacity .25s;white-space:normal}
.uo-bubble:after{content:"";position:absolute;left:50%;bottom:-5px;margin-left:-5px;border:5px solid transparent;border-top-color:#fffaf2;border-bottom:0}
.uo-boss{background:#ffe08a}.uo-boss:after{border-top-color:#ffe08a}
.uo-guest{background:#d6f5e3}.uo-guest:after{border-top-color:#d6f5e3}
.uo-tag{position:absolute;transform:translate(-50%,0);font-size:10px;font-weight:700;color:#fff;background:rgba(0,0,0,.45);padding:1px 6px;border-radius:6px;white-space:nowrap}
`;

// 示範用：沒人上班時也能看到效果
const DEMO = [
  { id: "demo-egg", name: "雞蛋", location: "工廠" },
  { id: "demo-wy", name: "宛芸", location: "21快閃櫃南港Lalaport" },
  { id: "demo-yz", name: "瑜珍", location: "02正櫃國家音樂廳" },
  { id: "demo-qq", name: "千芊", location: "01正櫃遠百信義" },
  { id: "demo-a", name: "小安", location: "03正櫃遠百竹北" },
  { id: "demo-b", name: "阿德", location: "11正櫃新莊棒球場" },
  { id: "demo-c", name: "小米", location: "01正櫃遠百信義" },
];

async function pool(items, n, fn, onProgress) {
  const out = []; let i = 0, done = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); onProgress && onProgress(++done); }
  }));
  return out;
}

const QUICK = ["竹籤", "紙袋", "塑膠袋", "包材", "麵糊-原味", "麵糊-可可", "麵糊-紅玉", "麵糊-抹茶", "預拌粉", "零錢"];

export default function UniverseTab({ user, apiGet, apiPost, todayStr, C, s }) {
  const boxRef = useRef(null);
  const engine = useRef(null);
  const [view, setView] = useState("office");
  const [onDuty, setOnDuty] = useState([]);
  const [demo, setDemo] = useState(false);
  const [progress, setProgress] = useState("");
  const [updated, setUpdated] = useState("");
  const [err, setErr] = useState("");
  const [short, setShort] = useState([]);          // [{id, scene, item, by, time}]
  const [backendOk, setBackendOk] = useState(true);
  const [custom, setCustom] = useState("");

  useEffect(() => {
    engine.current = createOffice(boxRef.current);
    return () => engine.current && engine.current.dispose();
  }, []);
  useEffect(() => { engine.current && engine.current.setView(view); }, [view]);
  useEffect(() => { engine.current && engine.current.setCrew(demo ? DEMO : onDuty); }, [onDuty, demo]);
  useEffect(() => {
    const map = {};
    short.forEach(x => (map[x.scene] = map[x.scene] || []).push(x.item));
    engine.current && engine.current.setBoards(map);
  }, [short]);

  // ── 缺貨看板（後端：getShortages / addShortage / resolveShortage）──
  const loadShort = async () => {
    const r = await apiGet({ action: "getShortages" });
    if (r && r.success) { setBackendOk(true); setShort((r.data || []).map(x => ({ ...x, scene: sceneOf(x.location) }))); }
    else setBackendOk(false);
  };
  const addShort = async (item) => {
    item = String(item || "").trim(); if (!item) return;
    const loc = SCENES[view].name;
    const tmp = { id: "tmp-" + Date.now(), scene: view, location: loc, item, by: user.name, time: new Date().toISOString() };
    setShort(l => [...l, tmp]); setCustom("");
    if (backendOk) {
      const r = await apiPost({ action: "addShortage", location: loc, item, empId: user.id, name: user.name });
      if (r && r.success) loadShort(); else setBackendOk(false);
    }
  };
  const resolveShort = async (x) => {
    setShort(l => l.filter(y => y.id !== x.id));
    if (backendOk && !String(x.id).startsWith("tmp-")) {
      const r = await apiPost({ action: "resolveShortage", id: x.id, empId: user.id, name: user.name });
      if (!(r && r.success)) setBackendOk(false);
    }
  };

  const load = async () => {
    setErr("");
    const staffRes = await apiGet({ action: "getStaffList", empId: user.id });
    if (!staffRes.success) { setErr(staffRes.error || "讀取夥伴名單失敗"); return; }
    const staff = staffRes.data || [];
    setProgress(`讀取打卡狀態 0/${staff.length}`);
    const date = todayStr();
    const res = await pool(staff, 6, st => apiGet({ action: "getActiveSegment", empId: st.id, date }),
      d => setProgress(`讀取打卡狀態 ${d}/${staff.length}`));
    const list = [];
    staff.forEach((st, i) => { const a = res[i]?.success && res[i].active; if (a && a.location) list.push({ id: st.id, name: st.name, location: a.location, inTime: a.inTime }); });
    setOnDuty(list); setProgress("");
    setUpdated(new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }));
  };
  useEffect(() => { load(); loadShort(); const t = setInterval(() => { load(); loadShort(); }, 3 * 60 * 1000); return () => clearInterval(t); }, []);

  const shown = demo ? DEMO : onDuty;
  const count = k => shown.filter(p => sceneOf(p.location) === k).length;
  const here = shown.filter(p => sceneOf(p.location) === view);
  const isStore = SCENES[view].store;

  return (
    <div>
      <style>{CSS}</style>
      <div style={{ ...s.card, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontWeight: 900, fontSize: 15 }}>🌌 宇宙辦公室 <span style={{ fontSize: 10, color: C.gold, fontWeight: 700 }}>測試版</span></div>
          <div style={{ fontSize: 11, color: C.muted }}>{progress || (updated && `更新 ${updated}`)}</div>
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 6 }}>
          {SCENE_KEYS.map(k => (
            <button key={k} onClick={() => setView(k)} style={{
              flex: "0 0 auto", border: "none", borderRadius: 10, padding: "7px 10px", fontSize: 12, fontWeight: 800, cursor: "pointer",
              background: view === k ? C.accent : C.warm, color: view === k ? "#fff" : C.text,
            }}>{SCENES[k].icon} {SCENES[k].short}{count(k) ? ` · ${count(k)}` : ""}</button>
          ))}
        </div>
        <div className="uo-wrap" ref={boxRef}>
          {isStore && here.length === 0 && (
            <div style={{ position: "absolute", top: 10, left: 10, zIndex: 2, background: "rgba(0,0,0,.55)", color: "#fff", fontSize: 12, padding: "4px 10px", borderRadius: 8 }}>
              此櫃位目前無人在班
            </div>
          )}
        </div>
        <div style={{ fontSize: 10, color: C.light, marginTop: 6 }}>左右拖曳可旋轉 · 每 3 分鐘自動更新</div>
      </div>

      {isStore && (
        <div style={s.card}>
          <div style={s.sectionTitle}>📋 {SCENES[view].name} 缺貨看板</div>
          {short.filter(x => x.scene === view).length === 0 && <div style={{ fontSize: 13, color: C.green, padding: "4px 0 8px" }}>✅ 目前不缺</div>}
          {short.filter(x => x.scene === view).map(x => (
            <div key={x.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.red }}>{x.item}</div>
                <div style={{ fontSize: 10, color: C.light }}>{x.by || ""}{x.time ? " · " + new Date(x.time).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}</div>
              </div>
              <button onClick={() => resolveShort(x)} style={{ border: "none", borderRadius: 10, padding: "6px 10px", background: C.greenBg, color: C.green, fontWeight: 800, fontSize: 12, cursor: "pointer" }}>✅ 補好了</button>
            </div>
          ))}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {QUICK.map(q => (
              <button key={q} onClick={() => addShort(q)} style={{ border: `1px solid ${C.border}`, borderRadius: 999, padding: "5px 10px", background: C.warm, fontSize: 12, fontWeight: 700, cursor: "pointer", color: C.text }}>＋ {q}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <input value={custom} onChange={e => setCustom(e.target.value)} placeholder="其他缺的東西…" style={{ ...s.input, padding: "9px 12px" }} />
            <button onClick={() => addShort(custom)} style={{ ...s.btn(), width: "auto", padding: "9px 14px", whiteSpace: "nowrap", flex: "0 0 auto" }}>登記</button>
          </div>
          {!backendOk && <div style={{ fontSize: 11, color: C.gold, marginTop: 8 }}>⚠️ 缺貨看板後端尚未部署，目前登記的內容不會保存。</div>}
        </div>
      )}

      {err && <div style={{ ...s.card, background: C.redBg, color: C.red, fontSize: 13 }}>{err}</div>}

      <div style={s.card}>
        <div style={s.sectionTitle}>{demo ? "示範名單" : "目前在班"}（{shown.length} 人）</div>
        {shown.length === 0 && <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: 8 }}>目前沒有人上班中</div>}
        {shown.map(p => {
          const k = sceneOf(p.location);
          return (
            <div key={p.id} onClick={() => setView(k)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}`, cursor: "pointer" }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</span>
              <span style={{ fontSize: 12, color: C.muted }}>{SCENES[k].icon} {shortLoc(p.location)}{p.inTime ? ` · ${String(p.inTime).slice(11, 16) || p.inTime}` : ""}</span>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={load} style={{ ...s.btn() }}>🔄 重新整理</button>
        <button onClick={() => setDemo(d => !d)} style={{ ...s.btn(demo ? "green" : "ghost") }}>{demo ? "🎮 展示中（點我關閉）" : "🎮 展示模式"}</button>
      </div>
    </div>
  );
}
