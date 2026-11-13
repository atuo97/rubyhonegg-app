// ─────────────────────────────────────────────
// v1.33 赤心幣商店：把「我和寵物 → 商店」和「赤心幣花費」合成一個地方，用分類切換。
// 夥伴自己開的店仍在「夥伴商店街」。商品點一下可以試穿預覽（買不起也能看）。
// ─────────────────────────────────────────────
import { useState } from "react";
import GameTab from "./GameTab.jsx";
import { SpendPage } from "./Spend30.jsx";

const CATS = [
  ["look", "👕 造型"], ["pet", "🐾 寵物"], ["seat", "🪑 座位"], ["title", "🏷️ 稱號・特效"],
  ["battle", "⚔️ 對戰"], ["gacha", "🎰 扭蛋"], ["boss", "👹 活動"], ["meal", "🎁 兌換"],
];
const NOTE = {
  look: "髮色、配件、服裝、帽子、名牌框。點商品可以先試穿看看。",
  pet: "寵物配件、特殊顏色、小窩。點配件可以看寵物戴上的樣子。",
  seat: "宇宙辦公室的夥伴座位區：桌子、椅子、桌上擺飾。",
  title: "名字旁的稱號、打卡上班時的進場特效。",
  battle: "對戰用的武器、防具、卡片與裝備強化。買了到「對戰」頁的「我的戰鬥數值」裝備。",
  gacha: "一般扭蛋與季節限定扭蛋。",
  boss: "全員大魔王：大家一起投幣攻擊，打倒後依排名送扭蛋次數。",
  meal: "現實福利兌換：和隊長吃飯（每月 1 名）。",
};

export default function CoinShop({ user, apiGet, apiPost, C, s, initial, onEditAvatar, onChanged }) {
  const [cat, setCat] = useState(initial || "look");
  const chip = on => ({ flex: "0 0 auto", border: `1px solid ${on ? C.accent : C.border}`, background: on ? C.accentBg : C.card, color: on ? C.accent : C.text,
    borderRadius: 999, padding: "7px 12px", fontSize: 13, fontWeight: on ? 600 : 500, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" });
  const G = (cats, extra = {}) => <GameTab key={cat + "g"} user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} onlyTab="shop" shopCats={cats} onEditAvatar={onEditAvatar} onChanged={onChanged} {...extra} />;
  const S = (only, hideBalance) => <SpendPage key={cat + only} user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} only={only} hideBalance={hideBalance} onChanged={onChanged} />;
  return (
    <div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 4, scrollbarWidth: "none" }}>
        {CATS.map(([k, l]) => <button key={k} onClick={() => { setCat(k); if (typeof window !== "undefined") window.scrollTo(0, 0); }} style={chip(cat === k)}>{l}</button>)}
      </div>
      <div style={{ fontSize: 12, color: C.muted, margin: "0 4px 10px", lineHeight: 1.6 }}>{NOTE[cat]}</div>
      {cat === "look" && G(["haircolor", "acc", "outfit", "hat", "frame"])}
      {cat === "pet" && <>{G(["petacc"])}{S("pet", true)}</>}
      {cat === "seat" && S("seat")}
      {cat === "title" && <>{S("title")}{S("fx", true)}</>}
      {cat === "battle" && <>{G(["weapon", "armor", "card"])}{S("enh", true)}</>}
      {cat === "gacha" && <><GameTab key="gacha" user={user} apiGet={apiGet} apiPost={apiPost} C={C} s={s} onlyTab="gacha" onEditAvatar={onEditAvatar} onChanged={onChanged} />{S("gacha", true)}</>}
      {cat === "boss" && S("boss")}
      {cat === "meal" && S("meal")}
    </div>
  );
}
