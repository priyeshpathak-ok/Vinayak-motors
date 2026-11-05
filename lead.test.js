const assert = require("assert");
const handler = require("../api/lead.js");
function call(body, method = "POST") {
  return new Promise((resolve) => {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(o) { resolve({ code: this.code, body: o }); }, end() { resolve({ code: this.code }); } };
    handler({ method, headers: { "x-forwarded-for": "9.9.9." + Math.floor(Math.random() * 255) }, body }, res);
  });
}
(async () => {
  const ok = { name: "Ravi Kumar", phone: "+91 98765 43210", consent: true, interest: "Test drive", car: "Scorpio" };
  let r = await call(ok); assert.equal(r.code, 200); assert.match(r.body.ref, /^VM-\d{6}-[0-9A-F]{4}$/);
  r = await call({ ...ok, phone: "12345" }); assert.equal(r.code, 400); assert.ok(r.body.errors.phone);
  r = await call({ ...ok, consent: false }); assert.equal(r.code, 400); assert.ok(r.body.errors.consent);
  r = await call({ ...ok, website: "spam.com" }); assert.equal(r.code, 200);
  r = await call(ok, "GET"); assert.equal(r.code, 405);
  const v = handler._validate({ ...ok, phone: "09876543210" }); assert.equal(v.lead.phone, "9876543210");
  console.log("all lead tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
