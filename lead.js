// Vercel serverless function: POST /api/lead
// Validates a lead, then fans out to: Resend email, CRM/Sheet webhook, and logs (always).
const crypto = require("crypto");

const hits = new Map(); // best-effort per-instance rate limit
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 8;
}

const clean = (v, max = 300) =>
  String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function validate(b) {
  const lead = {
    name: clean(b.name, 80),
    phone: clean(b.phone, 20).replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=\d{10}$)/, ""),
    email: clean(b.email, 120),
    city: clean(b.city, 60),
    interest: clean(b.interest, 40) || "Enquiry",
    car: clean(b.car, 120),
    budget: clean(b.budget, 40),
    preferredTime: clean(b.preferredTime, 60),
    message: clean(b.message, 800),
    consent: b.consent === true || b.consent === "true" || b.consent === "on",
    source: {
      page: clean(b.page, 200),
      referrer: clean(b.referrer, 200),
      utm_source: clean(b.utm_source, 80),
      utm_medium: clean(b.utm_medium, 80),
      utm_campaign: clean(b.utm_campaign, 120),
      utm_term: clean(b.utm_term, 80),
      utm_content: clean(b.utm_content, 80),
    },
  };
  const errors = {};
  if (lead.name.length < 2) errors.name = "Please enter your name";
  if (!/^[6-9]\d{9}$/.test(lead.phone)) errors.phone = "Enter a valid 10-digit Indian mobile number";
  if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lead.email)) errors.email = "Enter a valid email";
  if (!lead.consent) errors.consent = "Please agree so we can contact you";
  return { lead, errors };
}

function makeRef() {
  const d = new Date(Date.now() + 5.5 * 3600 * 1000);
  const ymd = d.toISOString().slice(2, 10).replace(/-/g, "");
  return `VM-${ymd}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
}

async function withTimeout(url, opts, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function sendEmail(lead) {
  const key = process.env.RESEND_API_KEY;
  const to = (process.env.LEAD_NOTIFY_EMAIL || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!key || !to.length) return { channel: "email", skipped: true };
  const from = process.env.LEAD_FROM_EMAIL || "Vinayak Motors <onboarding@resend.dev>";
  const rows = [
    ["Ref", lead.ref], ["Type", lead.interest], ["Name", lead.name], ["Phone", lead.phone],
    ["Email", lead.email || "-"], ["City", lead.city || "-"], ["Car", lead.car || "-"],
    ["Budget", lead.budget || "-"], ["Preferred time", lead.preferredTime || "-"],
    ["Message", lead.message || "-"], ["Page", lead.source.page || "-"],
    ["UTM", [lead.source.utm_source, lead.source.utm_medium, lead.source.utm_campaign].filter(Boolean).join(" / ") || "-"],
  ];
  const html = `<h2>New ${esc(lead.interest)} lead - ${esc(lead.ref)}</h2><table cellpadding="6" style="border-collapse:collapse">${rows
    .map(([k, v]) => `<tr><td style="border:1px solid #ddd"><b>${esc(k)}</b></td><td style="border:1px solid #ddd">${esc(v)}</td></tr>`)
    .join("")}</table><p><a href="tel:+91${esc(lead.phone)}">Call</a> | <a href="https://wa.me/91${esc(lead.phone)}">WhatsApp</a></p>`;
  const r = await withTimeout("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject: `New ${lead.interest} lead: ${lead.name} (${lead.ref})`, html, reply_to: lead.email || undefined }),
  });
  if (!r.ok) throw new Error(`resend ${r.status}`);
  return { channel: "email", ok: true };
}

async function sendWebhook(payload) {
  const url = process.env.CRM_WEBHOOK_URL;
  if (!url) return { channel: "crm", skipped: true };
  const headers = { "Content-Type": "application/json" };
  if (process.env.CRM_WEBHOOK_SECRET) headers["X-Webhook-Secret"] = process.env.CRM_WEBHOOK_SECRET;
  const r = await withTimeout(url, { method: "POST", headers, body: JSON.stringify(payload) });
  if (!r.ok) throw new Error(`crm ${r.status}`);
  return { channel: "crm", ok: true };
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return res.status(429).json({ ok: false, error: "Too many requests. Please call us instead." });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  // Honeypot: bots fill the hidden field. Pretend success.
  if (body.website) return res.status(200).json({ ok: true, ref: makeRef() });

  const { lead, errors } = validate(body);
  if (Object.keys(errors).length) return res.status(400).json({ ok: false, errors });

  lead.ref = makeRef();
  lead.createdAt = new Date().toISOString();
  lead.type = "lead";
  lead.geo = { country: req.headers["x-vercel-ip-country"] || "", region: req.headers["x-vercel-ip-country-region"] || "", city: decodeURIComponent(req.headers["x-vercel-ip-city"] || "") };

  // Always log first so a lead is never lost even if every integration fails (see Vercel > Logs).
  console.log("LEAD " + JSON.stringify(lead));

  const results = await Promise.allSettled([sendEmail(lead), sendWebhook(lead)]);
  const channels = results.map((r, i) =>
    r.status === "fulfilled" ? r.value : { channel: ["email", "crm"][i], ok: false, error: String(r.reason && r.reason.message || r.reason) }
  );
  channels.filter((c) => c.ok === false).forEach((c) => console.error("LEAD_CHANNEL_FAILED", lead.ref, JSON.stringify(c)));

  return res.status(200).json({ ok: true, ref: lead.ref, channels: process.env.DEBUG_LEADS ? channels : undefined });
};

module.exports._validate = validate;
