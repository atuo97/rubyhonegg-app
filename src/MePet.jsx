// ─────────────────────────────────────────────
// 我和寵物（v1.20）：小人造型＋寵物合併成同一頁
// 上方左邊是自己的小人、右邊是寵物；下方切換「造型」「寵物」
// ─────────────────────────────────────────────
import { useEffect, useState } from "react";
import AvatarEditor, { Doll } from "./AvatarEditor.jsx";
import GameTab from "./GameTab.jsx";
import { HeartsPage } from "./Hearts36.jsx";   // v1.36 無敵8心
import CoinShop from "./CoinShop.jsx";   // v1.33 我和寵物的「商店」改成整合後的赤心幣商店
import { PetSprite, PET_STAGE_NAMES, PET_TYPE_NAME } from "./pets/petSprites.jsx";
import { defaultCfg, sanitize } from "./universe/avatarCatalog.js";

export default function MePet({ user, apiGet, apiPost, todayStr, C, s, initial, onOpenShop, onChanged }) {
  const [view, setView] = useState(initial || "avatar");
  const nav = (k) => { setView(k); setVer(v => v + 1); if (typeof window !== "undefined") window.scrollTo(0, 0); };
  const [cfg, setCfg] = useState(defaultCfg());
  const [pet, setPet] = useState(undefined);
  const [ver, setVer] = useState(0);
  const loadHead = () => {
    apiGet({ action: "getMyAvatar", empId: user.id }, 1).then(r => { if (r && r.success) setCfg(sanitize(r.data && r.data.cfg)); });
    apiGet({ action: "gmMe", empId: user.id }, 0).then(r => setPet(r && r.success ? (r.data.pet || null) : null));
  };
  useEffect(loadHead, [ver]);
  const seg = (k, label) => (
    <button key={k} onClick={() => { setView(k); setVer(v => v + 1); }} style={{ flex: "1 0 auto", border: "none", borderRadius: 10, padding: "9px 8px", fontSize: 13.5, whiteSpace: "nowrap", fontFamily: "inherit", cursor: "pointer",
      background: view === k ? C.card : "transparent", color: view === k ? C.text : C.muted, fontWeight: view === k ? 600 : 500 }}>{label}</button>
  );
  return (
    <div>
      <div style={{ ...s.card, display: "flex", alignItems: "flex-end", justifyContent: "space-around", gap: 10, background: C.accentBg, padding: "16px 12px 12px" }}>
        <div style={{ textAlign: "center", flex: 1 }}>
          <Doll cfg={cfg} size={118} />
          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{user.name}</div>
          {cfg.saying ? <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>「{cfg.saying}」</div> : null}
        </div>
        <div style={{ textAlign: "center", flex: 1 }}>
          {pet && pet.id ? <>
            <div style={{ height: 118, display: "flex", alignItems: "flex-end", justifyContent: "center" }}><PetSprite type={pet.type} stage={pet.stage} flavor={pet.flavor} acc={pet.acc} size={pet.stage >= 4 ? 104 : 84} /></div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{pet.name || "我的寵物"}</div>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>{PET_STAGE_NAMES[(pet.stage || 1) - 1] || ""}{pet.type ? `・${PET_TYPE_NAME[pet.type] || ""}` : ""}</div>
          </> : <>
            <div style={{ height: 118, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 54, opacity: .5 }}>🥚</div>
            <div style={{ fontSize: 12.5, color: C.muted, marginTop: 4 }}>{pet === undefined ? "載入中…" : "還沒有寵物"}</div>
            {pet === null && <button onClick={() => setView("pet")} style={{ ...s.btn("ghost"), width: "auto", padding: "4px 10px", fontSize: 12, marginTop: 4 }}>免費領養</button>}
          </>}
        </div>
      </div>
      <div style={{ display: "flex", background: C.warm, borderRadius: 12, padding: 3, gap: 2, marginBottom: 12, overflowX: "auto" }}>{seg("avatar", "👕 造型")}{seg("pet", "🐣 寵物")}{seg("shop", "🛍 商店")}{seg("play", "🎮 小遊戲")}{seg("badge", "🏅 徽章")}{seg("hearts", "💗 8心")}</div>
      {view === "avatar" && <AvatarEditor user={user} apiGet={apiGet} apiPost={apiPost} todayStr={todayStr} C={C} s={s} onOpenShop={() => nav("shop")} />}
      {view === "shop" && <CoinShop key="shop" user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} onEditAvatar={() => nav("avatar")} onChanged={() => { setVer(v => v + 1); onChanged && onChanged(); }} />}
      {view === "hearts" && <HeartsPage user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} />}
      {view !== "avatar" && view !== "shop" && view !== "hearts" && <GameTab key={view} user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} onlyTab={view} onNav={nav} onEditAvatar={() => nav("avatar")} onChanged={() => { setVer(v => v + 1); onChanged && onChanged(); }} />}
    </div>
  );
}
