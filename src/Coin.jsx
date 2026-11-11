// ─────────────────────────────────────────────
// 赤心幣圖示（v1.19）：全 App 統一從這裡拿，要換圖只改這一處
// ─────────────────────────────────────────────
// 赤心幣圖示：紅色愛心（v1.19 隊長定案，取代 🪙）。只要圖示不要數字時用 <Heart />
export function Heart({ size = 14 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flex: "0 0 auto", verticalAlign: "-0.15em" }}>
    <path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3 4.5 6.6 4.5c2.1 0 3.6 1.2 4.4 2.6.8-1.4 2.3-2.6 4.4-2.6 3.6 0 5.7 3.7 4.2 7.2C19.5 16.4 12 21 12 21z" fill="#d9534f" /></svg>;
}
export function Coin({ n, size = 14, plus }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
    <Heart size={size} />{plus ? "+" : ""}{Number(n || 0).toLocaleString()}</span>;
}

