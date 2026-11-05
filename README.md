# Vinayak Motors Varanasi: website + lead capture

Static site + Vercel serverless functions (`/api/lead`, `/api/event`), pinned to the Mumbai region (`bom1`).

## 1. Fill in your details
Edit `assets/config.js`: phone, WhatsApp (e.g. `919876543210`), address, map embed, GA4 / Meta Pixel IDs, and the `cars` list.
Put photos/videos in `assets/` and reference them (`image: "assets/scorpio.jpg"`). Set `sample:false` on real cars.
Empty phone/WhatsApp = those buttons stay hidden (no fake numbers).

## 2. Deploy (free Vercel account)
```
npm i -g vercel
vercel login
vercel          # preview URL for testing
vercel --prod   # production
```

## 3. Where leads go (Vercel > Project > Settings > Environment Variables)
| Variable | Purpose |
|---|---|
| `RESEND_API_KEY`, `LEAD_NOTIFY_EMAIL`, `LEAD_FROM_EMAIL` | Instant email to sales team (resend.com free tier) |
| `CRM_WEBHOOK_URL`, `CRM_WEBHOOK_SECRET` | JSON POST of every lead and click event to your CRM / Zapier / Make / Google Apps Script |
| `DEBUG_LEADS=1` | Returns per-channel result in API response while testing |

Every lead is ALSO written to Vercel > Logs (`LEAD {...}`), so nothing is lost if an integration fails.
Webhook payload (lead): `ref, name, phone, email, city, interest, car, budget, preferredTime, message, consent, source{page,referrer,utm_*}, geo, createdAt`.

## 4. India domain
Buy a `.in` domain (e.g. vinayakmotors.in), then Vercel > Domains > Add and set the DNS records shown.

## 5. Test
`npm test` (API), `npm run dev` (local at http://localhost:3000).

Note: Vercel's free Hobby plan is meant for non-commercial use. For live business traffic, move to Pro.
