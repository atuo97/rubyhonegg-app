// Cloudflare Worker（royal-hat-f2df）v2：原本的 API 代理＋LINE Webhook 轉送（2026-11-12，v1.20）
// 與 v1（worker-fix-utf8_20260913.js）的差別只有最前面新增的「/line」區塊；其餘照舊。
// 部署前請先和線上 Worker 的程式比對：若線上的 target 網址不同，以線上為準。
// LINE Official Account Manager → Messaging API → Webhook 網址填：https://royal-hat-f2df.atuo97.workers.dev/line
export default {
  async fetch(request, env, ctx) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const url = new URL(request.url);
    const target = "https://script.google.com/macros/s/AKfycbx8L0eITWTp6-YM9FQyxIp7jOeppBys8d-NNmU4MSrr6Ck8_QEoxiN12SwCNblDax5d/exec";

    // ── LINE Webhook：原始內容＋簽章轉給 Apps Script 驗證；先回 200 給 LINE（LINE 要求 1 秒內回應）──
    if (url.pathname === "/line") {
      if (request.method !== "POST") return new Response("ok");
      const body = await request.text();
      const sig = request.headers.get("x-line-signature") || "";
      const forward = fetch(target, {
        method: "POST",
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: JSON.stringify({ action: "lineWebhook", body, sig }),
        redirect: "follow",
      }).catch(() => {});
      if (ctx && ctx.waitUntil) ctx.waitUntil(forward); else await forward;
      return new Response("ok");
    }

    try {
      let resp;
      if (request.method === "POST") {
        const body = await request.text();
        resp = await fetch(target, {
          method: "POST",
          headers: { "Content-Type": "text/plain; charset=utf-8" },
          body,
          redirect: "follow",
        });
      } else {
        resp = await fetch(target + url.search, { redirect: "follow" });
      }
      // 用 arrayBuffer 手動以 UTF-8 解碼，避免中文亂碼
      const buf = await resp.arrayBuffer();
      const text = new TextDecoder("utf-8").decode(buf);
      return new Response(text, {
        headers: { "Content-Type": "application/json; charset=utf-8", ...cors }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        headers: { "Content-Type": "application/json; charset=utf-8", ...cors } });
    }
  }
};
