// v1.27 樂園「赤心幣規則」、加倍活動管理、「關於紅玉滿」品牌頁、登入頁標語
import { useState, useEffect } from "react";
import { Flash } from "./TopToast.jsx";

const short = l => String(l || "").replace(/^\d+/, "");

// ── 赤心幣規則（樂園）──
export function RulesPage({ user, apiGet, C, s, onOpenLedger, loc }) {
  const [d, setD] = useState(null), [err, setErr] = useState("");
  useEffect(() => { apiGet({ action: "gmRules", loc: loc || "" }, 1).then(r => r && r.success ? setD(r.data) : setErr((r && r.error) || "讀取失敗")); }, []);
  if (err) return <div style={{ ...s.card, color: C.muted, textAlign: "center" }}>{/未知的動作/.test(err) ? "規則頁還沒開通（後端更新到 v1.27 後就會出現）" : err}</div>;
  if (!d) return <div className="rh-skel" style={{ height: 200, borderRadius: 18 }} />;
  const Sec = ({ t, children }) => <div style={s.card}><div style={s.sectionTitle}>{t}</div>{children}</div>;
  const Row = ({ l, r, sub, hi }) => <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}`, background: hi ? C.accentBg : "transparent" }}>
    <span style={{ flex: 1, minWidth: 0 }}><span style={{ fontSize: 14 }}>{l}</span>{sub && <span style={{ display: "block", fontSize: 11.5, color: C.muted, marginTop: 1 }}>{sub}</span>}</span>
    <b style={{ fontSize: 14, color: C.accent, whiteSpace: "nowrap" }}>{r}</b></div>;
  const ex = [d.me.roleMult, ...d.events.slice(0, 2).map(e => e.mult)];
  const roleName = r => ["", "隊員", "分隊長", "管理者", "總經理", "大隊長"][r];
  return (
    <div>
      <div style={{ ...s.card, textAlign: "center", background: C.accentBg }}>
        <div style={{ fontSize: 30 }}>❤️</div>
        <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>赤心幣怎麼賺、怎麼用</div>
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>我的餘額 <b style={{ color: C.accent, fontSize: 15 }}>{d.balance}</b> 枚</div>
        {onOpenLedger && <button onClick={onOpenLedger} style={{ border: `1px solid ${C.accent}`, background: C.card, color: C.accent, borderRadius: 999, padding: "5px 14px", fontSize: 12.5, marginTop: 8, cursor: "pointer", fontFamily: "inherit" }}>看我的明細 ›</button>}
      </div>

      <Sec t="✨ 你現在套用中">
        <Row l={`階層加成（Lv.${d.me.role} ${roleName(d.me.role)}）`} r={"×" + d.me.roleMult} />
        {d.me.now.map((x, i) => <Row key={i} l={x.name} r={"×" + x.mult} hi />)}
        {d.me.now.length === 0 && <div style={{ fontSize: 12.5, color: C.muted, padding: "6px 0" }}>今天沒有加倍事件{d.me.bdayMonth ? `，你的生日月是 ${d.me.bdayMonth} 月，那個月工時全部 ×2 🎂` : ""}</div>}
        {d.boosts.length > 0 && <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 4 }}>⚡ 加倍活動</div>
          {d.boosts.map((b, i) => <Row key={i} l={b.name} sub={`${b.from.slice(5).replace("-", "/")}～${b.to.slice(5).replace("-", "/")}・${b.loc ? short(b.loc) : "全部櫃位"}`} r={"×" + b.mult} />)}
        </div>}
      </Sec>

      <Sec t="⏱ 上班就有：工時幣">
        <div style={{ fontSize: 13.5, lineHeight: 1.7, marginBottom: 6 }}>每上班 <b>1 小時 ＝ 1 枚</b>，再乘上階層加成和每一個符合的加倍事件。</div>
        <div style={{ background: C.warm, borderRadius: 10, padding: "8px 10px", fontSize: 12.5, lineHeight: 1.7, marginBottom: 8 }}>
          <b>加倍會相乘</b>：不同事件各自是一份獎勵，全部乘起來。<br />
          例：分隊長生日月去活動場次上班 1 小時 ＝ 1 × 1.2 × 2 × 2 ＝ <b style={{ color: C.accent }}>4.8 枚</b>
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 600, margin: "6px 0 2px" }}>階層加成</div>
        {d.roles.map(r => <Row key={r.role} l={`Lv.${r.role} ${roleName(r.role)}`} r={"×" + r.mult} hi={r.role === d.me.role} />)}
        <div style={{ fontSize: 12.5, fontWeight: 600, margin: "10px 0 2px" }}>加倍事件</div>
        {d.events.map((e, i) => <Row key={i} l={e.name} sub={e.how} r={"×" + e.mult} />)}
        <Row l="⚡ 加倍活動" sub="颱風照常營業、新櫃開幕、旺季衝刺…由管理者公布" r="依活動" />
        <div style={{ fontSize: 11.5, color: C.light, marginTop: 8 }}>每天凌晨結算前一天，以審核後的打卡為準；補打卡後隔天自動補發。</div>
      </Sec>

      <Sec t="🎁 一次給的獎勵">
        {d.once.map((x, i) => <Row key={i} l={x.name} sub={x.how} r={"+" + x.coins} />)}
        {d.badges.length > 0 && <details style={{ marginTop: 8 }}><summary style={{ fontSize: 13, cursor: "pointer", color: C.accent }}>成就徽章（{d.badges.length} 個）</summary>
          {d.badges.map((b, i) => <Row key={i} l={`${b.icon} ${b.name}`} sub={b.how} r={"+" + b.coins} />)}</details>}
      </Sec>

      <Sec t="🛍 怎麼用">
        {d.spend.map((x, i) => <Row key={i} l={x.name} sub={x.how} r="" />)}
        <div style={{ fontSize: 11.5, color: C.light, marginTop: 8 }}>更多新玩法（寵物隊伍、我的座位、進場特效…）陸續推出</div>
      </Sec>

      <Sec t="📜 基本原則">
        {d.principles.map((x, i) => <div key={i} style={{ fontSize: 13, padding: "5px 0", lineHeight: 1.6 }}>・{x}</div>)}
      </Sec>
    </div>
  );
}

// ── 加倍活動（管理）──
export function BoostAdmin({ user, apiGet, apiPost, C, s, locations, todayStr }) {
  const [list, setList] = useState(null), [f, setF] = useState({ name: "", from: todayStr(), to: todayStr(), loc: "", mult: "2" }), [msg, setMsg] = useState("");
  const load = () => apiGet({ action: "gmBoostList" }, 1).then(r => setList(r && r.success ? r.data : []));
  useEffect(() => { load(); }, []);
  const save = async () => {
    const r = await apiPost({ action: "gmBoostSave", ...f, mult: Number(f.mult) }, 0);
    if (r && r.success) { setMsg("✅ 已新增，明天凌晨結算時生效（會補算活動期間的工時）"); setF(x => ({ ...x, name: "" })); load(); } else setMsg((r && r.error) || "失敗");
  };
  const del = async (b) => { if (!confirm(`刪除「${b.name}」？已發的幣不會收回。`)) return; const r = await apiPost({ action: "gmBoostDel", row: b.row }, 0); if (r && r.success) load(); else alert((r && r.error) || "失敗"); };
  const today = todayStr();
  return (
    <div>
      <div style={s.card}>
        <div style={s.sectionTitle}>新增加倍活動</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>例：颱風照常營業 ×2、新櫃開幕前 3 天 ×2、聖誕旺季 ×1.5。會和其他加倍相乘。</div>
        <input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="活動名稱，例：聖誕旺季" style={{ ...s.input, marginBottom: 8 }} />
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <input type="date" value={f.from} onChange={e => setF({ ...f, from: e.target.value })} style={{ ...s.input, flex: 1 }} aria-label="開始日" />
          <input type="date" value={f.to} onChange={e => setF({ ...f, to: e.target.value })} style={{ ...s.input, flex: 1 }} aria-label="結束日" />
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <select value={f.loc} onChange={e => setF({ ...f, loc: e.target.value })} style={{ ...s.input, flex: 2 }}><option value="">全部櫃位</option>{Object.keys(locations || {}).map(n => <option key={n} value={n}>{n}</option>)}</select>
          <select value={f.mult} onChange={e => setF({ ...f, mult: e.target.value })} style={{ ...s.input, flex: 1 }}>{["1.2", "1.5", "2", "3"].map(m => <option key={m} value={m}>×{m}</option>)}</select>
        </div>
        <button onClick={save} disabled={!f.name.trim()} style={{ ...s.btn("primary"), opacity: f.name.trim() ? 1 : .5 }}>新增</button>
        <Flash text={msg} />{msg && <div style={{ fontSize: 12.5, marginTop: 8, color: /✅/.test(msg) ? C.green : C.red }}>{msg}</div>}
      </div>
      <div style={s.card}>
        <div style={s.sectionTitle}>所有加倍活動</div>
        {!list && <div style={{ color: C.muted }}>讀取中…</div>}
        {list && list.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>還沒有加倍活動</div>}
        {(list || []).slice().reverse().map(b => <div key={b.row} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: `1px solid ${C.border}`, opacity: b.to < today ? .5 : 1 }}>
          <span style={{ flex: 1, fontSize: 14 }}>{b.name} <b style={{ color: C.accent }}>×{b.mult}</b><span style={{ display: "block", fontSize: 11.5, color: C.muted }}>{b.from}～{b.to}・{b.loc ? short(b.loc) : "全部櫃位"}{b.to < today ? "・已結束" : ""}</span></span>
          <button onClick={() => del(b)} style={{ border: "none", background: C.redBg, color: C.red, borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>刪除</button>
        </div>)}
      </div>
    </div>
  );
}

// ── 關於紅玉滿 ──
const TIMELINE = [
  ["2016.02.02", "師大夜市龍泉街，第一個攤位開張，招牌是「紅玉滿雞蛋糕」"],
  ["之後", "帶著攤子到不同地方擺攤，最後開著行動車停在西門紅樓前"],
  ["媒體報導", "Yahoo 新聞、部落客陸續報導，成為「台灣十大人氣雞蛋糕品牌」"],
  ["2018", "開始進入百貨櫃位，跑遍各地快閃與活動"],
  ["造型系列", "從心形出發，推出火車、挖土機、三角龍、小暴龍"],
  ["十年", "參加超過 500 場活動，包含與政府單位的合作"],
  ["2026", "成為光譜餐飲品牌集團的紅色品牌；開放加盟；啟用隊員 App"],
];
export function BrandPage({ C, s, locations }) {
  const locs = Object.entries(locations || {}).filter(([n, v]) => !/^(00|66)/.test(n) && !(v && /結束|停/.test(v.status || "")));
  const years = new Date().getFullYear() - 2016 - (new Date() < new Date(new Date().getFullYear() + "-02-02") ? 1 : 0);
  return (
    <div>
      <div style={{ ...s.card, textAlign: "center", padding: "22px 16px" }}>
        <img src="/logo_ink.png" alt="紅玉滿赤心雞蛋糕" style={{ width: "70%", maxWidth: 260 }} />
        <div style={{ fontSize: 16, letterSpacing: 2, marginTop: 14, fontWeight: 600 }}>願食雞蛋糕，常保赤子心</div>
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6 }}>2016 年 2 月 2 日至今，第 {years + 1} 年</div>
      </div>
      <div style={s.card}>
        <div style={s.sectionTitle}>品牌精神</div>
        <div style={{ fontSize: 14, lineHeight: 1.85 }}>一顆雞蛋糕，是很多台灣人童年的味道。我們希望每個吃到紅玉滿的人，都能想起那份單純的快樂，也帶著一顆赤子之心，繼續往前走。</div>
        <div style={{ marginTop: 10, fontSize: 13.5, lineHeight: 1.8 }}>
          <div>🍳 <b>推廣台灣雞蛋糕文化</b>：把街頭巷尾的雞蛋糕，帶進百貨、機場、表演廳，讓更多人、更多國家認識它。</div>
          <div style={{ marginTop: 6 }}>🕰 <b>連結跨時代記憶</b>：從阿公阿嬤的古早味，到孩子手上的造型雞蛋糕，同一個味道連結不同世代。</div>
        </div>
      </div>
      <div style={s.card}>
        <div style={s.sectionTitle}>名字的由來</div>
        {[["紅玉", "創立時想做出差異化，選了台灣特有品種的紅玉紅茶（台茶 18 號），也是我們的招牌口味。"],
          ["滿", "「豐滿」的意思。「豐」向榜樣鼎泰豐致敬，希望每一顆都飽滿、讓人吃得滿足。"],
          ["赤心", "後來才加上去的。代表創辦人的赤子之心，也代表每一位喜歡雞蛋糕的人，心裡都還保有的赤子之心。"]].map(([k, v]) =>
          <div key={k} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
            <b style={{ fontSize: 18, color: C.accent, width: 44, flexShrink: 0 }}>{k}</b><span style={{ fontSize: 13.5, lineHeight: 1.75 }}>{v}</span></div>)}
      </div>
      <div style={s.card}>
        <div style={s.sectionTitle}>品牌故事</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.85, color: C.text }}>
          2016 年 2 月 2 日，紅玉滿在師大夜市龍泉街擺出第一個攤位。那時現點現烤，一次要等 3 分鐘；人手不夠，塑膠袋和竹籤還要請客人自己拿。
        </div>
        <div style={{ fontSize: 13, color: C.muted, fontStyle: "italic", margin: "10px 0", paddingLeft: 10, borderLeft: `3px solid ${C.accent}` }}>「還記得十年前，你第一次站在我們攤位前的那一天嗎？」</div>
        <div style={{ position: "relative", paddingLeft: 18, marginTop: 8 }}>
          <div style={{ position: "absolute", left: 5, top: 6, bottom: 6, width: 2, background: C.border }} />
          {TIMELINE.map(([t, v], i) => <div key={i} style={{ position: "relative", padding: "6px 0" }}>
            <span style={{ position: "absolute", left: -18, top: 11, width: 12, height: 12, borderRadius: 6, background: i === 0 ? C.accent : C.card, border: `2px solid ${C.accent}` }} />
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.accent }}>{t}</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.6 }}>{v}</div>
          </div>)}
        </div>
      </div>
      {locs.length > 0 && <div style={s.card}>
        <div style={s.sectionTitle}>現在在這裡</div>
        {locs.map(([n]) => <div key={n} style={{ fontSize: 14, padding: "7px 0", borderBottom: `1px solid ${C.border}` }}>📍 {short(n)}</div>)}
        <div style={{ fontSize: 12, color: C.muted, marginTop: 8 }}>還有各地活動與快閃，跟著行事曆出發</div>
      </div>}
    </div>
  );
}

// ── 登入頁標語輪播 ──
const SLOGANS = ["願食雞蛋糕，常保赤子心", "推廣台灣雞蛋糕文化", "連結跨時代記憶", "從 2016 年師大夜市的小攤位出發"];
export function LoginSlogan({ C }) {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI(x => (x + 1) % SLOGANS.length), 3500); return () => clearInterval(t); }, []);
  return <div key={i} className="rh-page" style={{ fontSize: 14, color: C.text, marginTop: 14, letterSpacing: 2, minHeight: 22 }}>{SLOGANS[i]}</div>;
}
