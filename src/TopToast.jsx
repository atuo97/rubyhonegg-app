// ─────────────────────────────────────────────
// v1.34 頂端提醒：所有「已購買」「已送出」「失敗」等提醒一律出現在畫面上方（原本在下方或頁尾，容易沒看到）
// 用法：
//   - 直接呼叫 topToast("文字")
//   - 頁面裡原本的 {msg && <div>…</div>} 旁邊加 <Flash text={msg} />：msg 一變就在頂端跳一次（頁內原訊息保留）
//   - App 根部放一個 <TopToastHost C={C} />
// ─────────────────────────────────────────────
import { useEffect, useState } from "react";

export function topToast(text, kind) {
  if (!text) return;
  window.dispatchEvent(new CustomEvent("rh-top-toast", { detail: { text: String(text), kind } }));
}
// v1.34 部署端：必填提醒（請填…／請選…／請輸入…）也算紅色
const kindOf = t => /^✅|成功|完成|已送出|已儲存|已存|買到|好了/.test(t) ? "ok" : /失敗|錯誤|無法|不能|不足|請先|請重新|^請(填|選|輸入|寫|拍|完整)|⚠️|還差/.test(t) ? "bad" : "info";

export function Flash({ text, kind }) {
  useEffect(() => { if (text) topToast(text, kind); }, [text]);
  return null;
}

export function TopToastHost({ C }) {
  const [t, setT] = useState(null);
  useEffect(() => {
    let timer;
    const on = e => {
      const { text, kind } = e.detail || {};
      setT({ text, kind: kind || kindOf(text), k: Date.now() });
      clearTimeout(timer); timer = setTimeout(() => setT(null), Math.min(7000, 2600 + String(text).length * 60));
    };
    window.addEventListener("rh-top-toast", on);
    return () => { window.removeEventListener("rh-top-toast", on); clearTimeout(timer); };
  }, []);
  if (!t) return null;
  const bg = t.kind === "ok" ? "#2e7d4f" : t.kind === "bad" ? "#b8372e" : (C && C.text) || "#2b221c";
  return (
    <div key={t.k} onClick={() => setT(null)} role="status"
      style={{ position: "fixed", left: "50%", top: "calc(env(safe-area-inset-top) + 12px)", transform: "translateX(-50%)", zIndex: 2000,
               background: bg, color: "#fff", fontSize: 13.5, fontWeight: 600, padding: "10px 16px", borderRadius: 14, maxWidth: "90%", textAlign: "center",
               boxShadow: "0 6px 20px rgba(0,0,0,.18)", animation: "rhTopIn .25s ease-out", lineHeight: 1.5 }}>
      <style>{`@keyframes rhTopIn{from{opacity:0;transform:translate(-50%,-12px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
      {t.text}
    </div>
  );
}
