// POST /api/event : lightweight click events (call / WhatsApp). Forwarded to the CRM webhook and logged.
const clean = (v, m = 200) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").slice(0, m);
const ALLOWED = new Set(["call_click", "whatsapp_click", "car_view", "form_start"]);

module.exports = async function (req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).end();
  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
  b = b || {};
  const name = clean(b.event, 40);
  if (!ALLOWED.has(name)) return res.status(400).json({ ok: false });
  const evt = { type: "event", event: name, detail: clean(b.detail), page: clean(b.page), utm_source: clean(b.utm_source, 80), utm_campaign: clean(b.utm_campaign, 120), at: new Date().toISOString() };
  console.log("EVENT " + JSON.stringify(evt));
  const url = process.env.CRM_WEBHOOK_URL;
  if (url) {
    try {
      const headers = { "Content-Type": "application/json" };
      if (process.env.CRM_WEBHOOK_SECRET) headers["X-Webhook-Secret"] = process.env.CRM_WEBHOOK_SECRET;
      await fetch(url, { method: "POST", headers, body: JSON.stringify(evt), signal: AbortSignal.timeout(5000) });
    } catch (e) { console.error("EVENT_FWD_FAILED", e.message); }
  }
  return res.status(200).json({ ok: true });
};
