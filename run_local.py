#!/usr/bin/env python3
"""Run Vinayak Motors site locally: python3 run_local.py -> http://localhost:8000
Leads are saved to leads.csv in this folder."""
import csv, json, os, random, re
from datetime import datetime, timedelta, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__)); os.chdir(ROOT)
FIELDS = ["ref","createdAt","interest","name","phone","email","city","car","budget","preferredTime","message","page","utm_source","utm_medium","utm_campaign"]

class H(SimpleHTTPRequestHandler):
    def _json(self, code, obj):
        b = json.dumps(obj).encode(); self.send_response(code)
        self.send_header("Content-Type","application/json"); self.send_header("Content-Length",str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        p = self.path.split("?")[0]
        if p != "/" and "." not in os.path.basename(p) and os.path.exists(ROOT + p + ".html"):
            self.path = p + ".html" + ("?" + self.path.split("?",1)[1] if "?" in self.path else "")
        return super().do_GET()
    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        try: b = json.loads(self.rfile.read(n) or b"{}")
        except Exception: b = {}
        if self.path.startswith("/api/event"): return self._json(200, {"ok": True})
        if not self.path.startswith("/api/lead"): return self._json(404, {"ok": False})
        if b.get("website"): return self._json(200, {"ok": True, "ref": "VM-SPAM"})
        c = lambda k, m=300: re.sub(r"[\x00-\x1f]", " ", str(b.get(k) or "")).strip()[:m]
        phone = re.sub(r"[\s-]", "", c("phone", 20)); phone = re.sub(r"^(\+91|91|0)(?=\d{10}$)", "", phone)
        err = {}
        if len(c("name", 80)) < 2: err["name"] = "Please enter your name"
        if not re.fullmatch(r"[6-9]\d{9}", phone): err["phone"] = "Enter a valid 10-digit Indian mobile number"
        if c("email", 120) and not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]{2,}", c("email", 120)): err["email"] = "Enter a valid email"
        if b.get("consent") not in (True, "true", "on"): err["consent"] = "Please agree so we can contact you"
        if err: return self._json(400, {"ok": False, "errors": err})
        ist = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
        ref = "VM-%s-%04X" % (ist.strftime("%y%m%d"), random.randint(0, 65535))
        row = {"ref": ref, "createdAt": datetime.now().isoformat(timespec="seconds"), "phone": phone,
               **{k: c(k, 800 if k == "message" else 300) for k in FIELDS if k not in ("ref","createdAt","phone")}}
        new = not os.path.exists("leads.csv")
        with open("leads.csv", "a", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, FIELDS)
            if new: w.writeheader()
            w.writerow(row)
        print("NEW LEAD", ref, row["name"], phone, row["interest"], row["car"])
        return self._json(200, {"ok": True, "ref": ref})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print("Site running at http://localhost:%d  (Ctrl+C to stop). Leads -> leads.csv" % port)
    ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
