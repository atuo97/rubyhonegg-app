// ─────────────────────────────────────────────
// v1.47 操作介面整合：大樓導覽（樂園）、快速視窗（夾娃娃、扭蛋、拍貼、敲門）、隊員的聲音（管理）
// 原則：不刪功能、不加管制，只收在一起、補入口；動作都沿用原本的後端
// ─────────────────────────────────────────────
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Flash } from "./TopToast.jsx";
import Claw42 from "./Claw42.jsx";
import PhotoBooth44 from "./Photo44.jsx";
import GameTab from "./GameTab.jsx";
import { ShopProposals } from "./ShopStreetTab.jsx";
import { FACES, LABEL } from "./Mood44.jsx";
import AvatarEditor from "./AvatarEditor.jsx";
import { MountShop } from "./Mount40.jsx";
import { SpendPage } from "./Spend30.jsx";

// 房間 → 功能（和宇宙辦公室的房間功能列一樣）。how：quick＝直接開視窗；tab＝到某一頁；room＝進宇宙辦公室那間再打開（要看即時資料的看板）
export const GUIDE = [
  ["lobby", "🛎️ 大廳", [["benefit", "🎁 福利補助", "tab"], ["idea", "📮 意見箱", "tab"], ["attend", "☀️ 早安牆", "room"]]],
  ["office", "💼 辦公區", [["rev", "⚡ 即時營業額 PK", "room"], ["praise", "⭐ 讚美牆", "room"], ["status", "📋 各櫃位看板", "room"]]],
  ["seats", "🛋️ 休息區", [["thanks", "💌 感謝牆", "room"], ["seat", "🪑 我的座位", "tab"]]],
  ["canteen", "🍱 飯堂", [["menu", "🍱 今日菜單", "room"], ["cake", "🧇 請吃雞蛋糕", "room"]]],
  ["gameroom", "🎮 遊戲室", [["games", "🕹️ 8 款小遊戲", "tab"], ["claw", "🧸 夾娃娃", "quick"], ["gacha", "🎰 扭蛋機", "quick"], ["photo", "📸 拍貼機", "room"], ["arena", "⚔️ 切磋對戰", "tab"], ["rank", "🏆 本週排行榜", "room"]]],
  ["gym", "🏋️ 運動室", [["exercise", "💪 去運動", "room"], ["sport", "🏃 比賽公告・完賽榜", "room"], ["boss", "👹 大魔王", "tab"]]],
  ["study", "📚 學習室", [["sop", "📖 SOP 教學", "tab"], ["cert", "🎓 證照榮譽牆", "room"]]],
  ["captain", "👑 隊長室", [["knock", "🚪 敲門留言", "quick"]]],
];

// 樂園「🏢 大樓導覽」：依房間列出功能，點了直接開（看板類才進 3D 房間）
export function BuildingGuide({ C, s, onFunc }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ ...s.card, padding: "12px 14px" }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: "100%", border: "none", background: "transparent", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", fontFamily: "inherit", color: C.text, padding: 0, textAlign: "left" }}>
        <span style={{ fontSize: 28 }}>🏢</span>
        <span style={{ flex: 1 }}><span style={{ display: "block", fontSize: 14.5, fontWeight: 600 }}>大樓導覽</span><span style={{ display: "block", fontSize: 12, color: C.muted, marginTop: 2 }}>每間房間可以做什麼，點了直接開</span></span>
        <span style={{ fontSize: 12.5, color: C.accent, fontWeight: 600 }}>{open ? "收起" : "打開"}</span>
      </button>
      {open && GUIDE.map(([room, name, fs]) => (
        <div key={room} style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{name}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {fs.map(([k, label, how]) => <button key={k} onClick={() => onFunc(k, how, room)} style={{ border: `1px solid ${C.border}`, background: C.warm, color: C.text, borderRadius: 999, padding: "6px 11px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{label}</button>)}
          </div>
        </div>
      ))}
    </div>
  );
}

// 不進 3D 也能開的視窗：夾娃娃、扭蛋、拍貼（真人自拍）、敲門
export function QuickModal({ k, user, apiGet, apiPost, C, s, onClose, onChanged }) {
  const [text, setText] = useState(""), [msg, setMsg] = useState(null), [busy, setBusy] = useState(false);
  if (k === "claw") return <Claw42 apiPost={apiPost} apiGet={apiGet} C={C} s={s} onClose={() => { onClose(); onChanged && onChanged(); }} />;
  if (k === "photo") return <PhotoBooth44 apiPost={apiPost} s={s} me={{ id: user.id, name: user.nick || user.name }} onClose={onClose} onSaved={onChanged} />;
  const wrap = (title, body) => createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1700, background: "rgba(20,10,20,.8)", display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "calc(14px + env(safe-area-inset-top)) 10px calc(14px + env(safe-area-inset-bottom))" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: C.bg, borderRadius: 20, padding: 12 }}>
        <div style={{ fontSize: 17, fontWeight: 800, textAlign: "center", color: C.accent, margin: "4px 0 8px" }}>{title}</div>
        {body}
        <button onClick={onClose} style={{ ...s.btn("ghost"), marginTop: 8 }}>離開</button>
      </div>
    </div>, document.body);
  if (k === "gacha") return wrap("🎰 紅玉滿扭蛋機", <GameTab user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} onlyTab="gacha" onChanged={onChanged} />);
  if (k === "knock") return wrap("🚪 敲門留言給隊長", <div style={s.card}>
    {msg && <Flash text={msg.text} kind={msg.ok ? "ok" : "bad"} />}
    <div style={{ fontSize: 12, color: C.muted, textAlign: "center", marginBottom: 10 }}>直接留言給隊長，隊長會收到提醒並回覆你</div>
    <textarea value={text} maxLength={300} rows={4} onChange={e => setText(e.target.value)} placeholder="想跟隊長說的話…" style={{ ...s.input, marginBottom: 10, resize: "vertical" }} />
    <button disabled={text.trim().length < 2 || busy} onClick={async () => { setBusy(true); const r = await apiPost({ action: "v44Knock", text }, 0); setBusy(false); if (r && r.success) { setMsg({ ok: true, text: "🚪 已留言給隊長" }); setText(""); setTimeout(onClose, 900); } else setMsg({ ok: false, text: (r && r.error) || "送出失敗" }); }} style={{ ...s.btn("primary"), opacity: text.trim().length < 2 ? .5 : 1 }}>送出</button>
  </div>);
  return null;
}

// 管理 → 公司 →「💬 隊員的聲音」：意見箱（含敲門，只限大隊長）｜店種提案（Lv.3）｜隊員心情（Lv.3）
export function VoicePage({ user, apiGet, apiPost, C, s, initial }) {
  const isBoss = user.role >= 5 || user.position === "大隊長";
  const tabs = [...(isBoss ? [["idea", "📮 意見箱"]] : []), ["prop", "💡 店種提案"], ["mood", "💗 隊員心情"]];
  const [t, setT] = useState(initial && tabs.some(x => x[0] === initial) ? initial : tabs[0][0]);
  const [ideas, setIdeas] = useState(null), [team, setTeam] = useState(null), [msg, setMsg] = useState(null);
  const loadIdeas = () => apiGet({ action: "v42Ideas" }, 0).then(r => setIdeas(r && r.success ? r.data : { error: (r && r.error) || "讀取失敗" }));
  useEffect(() => { if (t === "idea") loadIdeas(); if (t === "mood") apiGet({ action: "v44MoodTeam" }, 0).then(r => setTeam(r && r.success ? r.data : { error: (r && r.error) || "讀取失敗" })); }, [t]);
  const reply = async x => {
    const v = window.prompt("回覆（會送到他的提醒）", x.reply || ""); if (!v) return;
    const r = await apiPost({ action: "v42IdeaReply", i: x.i, text: v }, 0);
    setMsg(r && r.success ? { ok: true, text: "✅ 已回覆" } : { ok: false, text: (r && r.error) || "失敗" }); loadIdeas();
  };
  const sm = { border: `1px solid ${C.border}`, background: C.card, borderRadius: 999, padding: "3px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: C.text };
  return (
    <div>
      {msg && <Flash text={msg.text} kind={msg.ok ? "ok" : "bad"} />}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {tabs.map(([k, l]) => <button key={k} onClick={() => setT(k)} style={{ flex: 1, border: "none", borderRadius: 10, padding: "8px 0", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: t === k ? C.accent : C.warm, color: t === k ? "#fff" : C.text }}>{l}</button>)}
      </div>
      {t === "idea" && (!ideas ? <div className="rh-skel" style={{ height: 120, borderRadius: 18 }} /> : ideas.error ? <div style={{ ...s.card, color: C.red }}>{ideas.error}</div> : (
        <div style={s.card}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>意見箱與隊長室敲門（標「【敲門】」）都在這裡；未回覆的排前面</div>
          {ideas.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>意見箱是空的</div>}
          {[...ideas].sort((a, b) => (a.reply ? 1 : 0) - (b.reply ? 1 : 0)).map(x => (
            <div key={x.i} style={{ padding: "9px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13.5 }}>
              <div style={{ fontSize: 11.5, color: C.muted }}>{!x.reply && !x.anon ? "🔴 " : ""}{x.time}・{x.name}</div>
              <div style={{ whiteSpace: "pre-wrap", margin: "3px 0" }}>{x.text}</div>
              {x.reply && <div style={{ fontSize: 12.5, color: C.blue }}>↪ {x.reply}</div>}
              {!x.anon && <button onClick={() => reply(x)} style={sm}>{x.reply ? "改回覆" : "回覆"}</button>}
            </div>
          ))}
        </div>
      ))}
      {t === "prop" && (user.role >= 3 ? <ShopProposals apiGet={apiGet} apiPost={apiPost} C={C} s={s} /> : <div style={{ ...s.card, color: C.muted }}>Lv.3 以上才看得到</div>)}
      {t === "mood" && (!team ? <div className="rh-skel" style={{ height: 120, borderRadius: 18 }} /> : team.error ? <div style={{ ...s.card, color: C.red }}>{team.error}</div> : (
        <div style={s.card}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>只有 Lv.3 以上看得到；⚠️ 是連續 3 次心情低落，找時間關心一下</div>
          {(team.list || []).length === 0 && <div style={{ fontSize: 13, color: C.muted }}>還沒有人簽到</div>}
          {(team.list || []).map(x => (
            <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 24, width: 30 }}>{x.today ? FACES[x.today] : "・"}</span>
              <span style={{ flex: 1, fontSize: 13.5 }}>{x.low ? "⚠️ " : ""}<b>{x.name}</b>{x.note ? `｜${x.note}` : ""}<span style={{ display: "block", fontSize: 11.5, color: C.muted }}>{x.today ? "今天 " + LABEL[x.today] : "今天還沒簽到"}・近 7 天平均 {x.avg || "—"}</span></span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// 管理分頁紅點：未回覆的意見（大隊長）＋待規劃的店種提案（Lv.3）
export function useVoiceCount(user, apiGet) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!user || user.role < 3) return;
    let alive = true;
    const run = async () => {
      let c = 0;
      if (user.role >= 5 || user.position === "大隊長") { const r = await apiGet({ action: "v42Ideas" }, 1); if (r && r.success) c += (r.data || []).filter(x => !x.reply && !x.anon).length; }
      const p = await apiGet({ action: "spProposals" }, 1); if (p && p.success) c += (p.data || []).filter(x => !x.status || x.status === "待規劃").length;
      if (alive) setN(c);
    };
    run(); const t = setInterval(run, 10 * 60 * 1000);
    return () => { alive = false; clearInterval(t); };
  }, [user && user.id, user && user.role]);
  return n;
}

// ───────── 1-1 我的背包 ─────────
// 不新增資料表：每一分頁直接用原本的裝備畫面（造型＝更衣間、坐騎＝坐騎＋配件、座位＝桌椅擺飾），內容和原入口同步
export const BAG_TABS = [["look", "👕 造型"], ["pet", "🐣 寵物"], ["mount", "🛵 坐騎・配件"], ["seat", "🪑 座位擺飾"], ["ticket", "🎟️ 券"]];
export function BagPage({ user, apiGet, apiPost, todayStr, C, s, initial, onChanged, onOpenShop }) {
  const [t, setT] = useState(BAG_TABS.some(x => x[0] === initial) ? initial : "look");
  return (
    <div>
      <div style={{ ...s.card, padding: "10px 14px", fontSize: 12.5, color: C.muted }}>🎒 買到、夾到、扭到的東西都在這裡，點一下就能裝上、拆下、擺上。</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, overflowX: "auto", paddingBottom: 2 }}>
        {BAG_TABS.map(([k, l]) => <button key={k} onClick={() => setT(k)} style={{ flex: "0 0 auto", border: "none", borderRadius: 999, padding: "7px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: t === k ? C.accent : C.warm, color: t === k ? "#fff" : C.text }}>{l}</button>)}
      </div>
      {t === "look" && <AvatarEditor user={user} apiGet={apiGet} apiPost={apiPost} todayStr={todayStr} C={C} s={s} onOpenShop={onOpenShop} />}
      {t === "pet" && <GameTab key="bagpet" user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} onlyTab="pet" onChanged={onChanged} />}
      {t === "mount" && <MountShop apiGet={apiGet} apiPost={apiPost} C={C} s={s} onChanged={onChanged} />}
      {t === "seat" && <SpendPage key="bagseat" user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} only="seat" onChanged={onChanged} />}
      {t === "ticket" && <SpendPage key="bagtix" user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} only="gacha" onChanged={onChanged} />}
    </div>
  );
}


// ───────── 1-3 通知中心 ─────────
// 頂端 🔔：最近 7 天的提醒都看得到（頂端跳出照舊）。未讀＝上次打開通知中心之後才來的
const SEEN_KEY = "rh_notif_seen";
export const NOTE_ICON = { coffee: "☕", thanks: "💌", cheer: "👍", visit: "👀", benefit: "🎁", claw: "🧸", care: "💗", shop: "💡", mount: "🛵", milestone: "🎆", overtake: "🏃" };
export function useNotifs(user, apiGet) {
  const [list, setList] = useState([]), [seen, setSeen] = useState(() => { try { return Number(localStorage.getItem(SEEN_KEY)) || 0; } catch (e) { return 0; } });
  const load = () => apiGet({ action: "v47Notes" }, 0).then(r => { if (r && r.success) setList(r.data || []); }).catch(() => {});
  useEffect(() => { if (!user) return; load(); const t = setInterval(load, 3 * 60 * 1000); return () => clearInterval(t); }, [user && user.id]);
  const markSeen = () => { const t = Date.now(); setSeen(t); try { localStorage.setItem(SEEN_KEY, String(t)); } catch (e) {} };
  return { list, unread: list.filter(x => x.ts > seen).length, seen, load, markSeen };
}
export function BellButton({ C, n, onClick }) {
  return (
    <button onClick={onClick} aria-label="通知中心" style={{ position: "relative", border: `1px solid ${C.border}`, background: C.card, borderRadius: 999, width: 32, height: 30, cursor: "pointer", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
      🔔{n > 0 && <span style={{ position: "absolute", top: -5, right: -5, minWidth: 16, height: 16, borderRadius: 8, background: "#e74c3c", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{n > 99 ? "99+" : n}</span>}
    </button>
  );
}
// 點一則到哪裡（back＝回通知中心）
export function noteTarget(x) {
  const back = { tab: "notif" };
  if (x.from && /^(coffee|thanks|cheer|visit)$/.test(x.type)) return { tab: "universe", auto: "card:" + x.from, back };
  if (x.type === "benefit") return { tab: "benefit", bf: /意見/.test(x.text) ? "idea" : "apply", back };
  if (x.type === "claw") return { tab: "game", back };
  if (x.type === "care") return { tab: "voice", voice: "mood", back };
  if (x.type === "shop") return { tab: "street", back };
  if (x.type === "mount") return { tab: "bag", bag: "mount", back };
  if (x.type === "milestone" || x.type === "overtake") return { tab: "universe", room: "office", auto: "rev", back };
  return { tab: "universe", back };
}
export function NotifCenter({ C, s, notifs, onGo }) {
  const [seen0] = useState(notifs.seen);
  useEffect(() => { notifs.load(); notifs.markSeen(); }, []);
  const list = notifs.list;
  return (
    <div>
      <div style={{ ...s.card, padding: "10px 14px", fontSize: 12.5, color: C.muted }}>最近 7 天收到的提醒都在這裡，點一則直接過去看。</div>
      {!list.length && <div style={{ ...s.card, textAlign: "center", color: C.muted, fontSize: 13 }}>最近 7 天沒有提醒</div>}
      {list.length > 0 && <div style={s.card}>
        {list.map((x, i) => (
          <button key={i} onClick={() => onGo(noteTarget(x))} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 0", border: "none", borderTop: i ? `1px solid ${C.border}` : "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", color: C.text, textAlign: "left" }}>
            <span style={{ fontSize: 22, width: 28, textAlign: "center" }}>{NOTE_ICON[x.type] || "🔔"}</span>
            <span style={{ flex: 1, fontSize: 13.5, lineHeight: 1.45 }}>{x.ts > seen0 && <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 4, background: "#e74c3c", marginRight: 6, verticalAlign: "middle" }} />}{x.text}<span style={{ display: "block", fontSize: 11, color: C.light }}>{x.time}</span></span>
            <span style={{ color: C.light, fontSize: 18 }}>›</span>
          </button>
        ))}
      </div>}
    </div>
  );
}
