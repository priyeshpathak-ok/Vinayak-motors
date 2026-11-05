// Local dev server mimicking Vercel: static files + /api/* functions
const http = require("http"), fs = require("fs"), path = require("path");
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".mp4": "video/mp4", ".jpg": "image/jpeg", ".png": "image/png" };
http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname.startsWith("/api/")) {
    const f = path.join(__dirname, url.pathname + ".js");
    if (!fs.existsSync(f)) { res.statusCode = 404; return res.end(); }
    let raw = ""; req.on("data", (c) => (raw += c)); req.on("end", () => {
      try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
      res.status = (c) => { res.statusCode = c; return res; };
      res.json = (o) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); };
      require(f)(req, res);
    });
    return;
  }
  let p = url.pathname === "/" ? "/index.html" : url.pathname;
  if (!path.extname(p) && fs.existsSync(path.join(__dirname, p + ".html"))) p += ".html";
  const fp = path.join(__dirname, p);
  if (!fp.startsWith(__dirname) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.statusCode = 404; return res.end("Not found"); }
  res.setHeader("Content-Type", types[path.extname(fp)] || "application/octet-stream");
  fs.createReadStream(fp).pipe(res);
}).listen(process.env.PORT || 3000, () => console.log("http://localhost:" + (process.env.PORT || 3000)));
