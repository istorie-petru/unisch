// Minimal static server for the tests: serves the repo under /unisch/, the
// same path GitHub Pages uses, so the service worker scope matches production.
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PREFIX = "/unisch/";
const PORT = Number(process.env.PORT) || 4173;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".webmanifest": "application/manifest+json", ".png": "image/png", ".ico": "image/x-icon"
};

http.createServer((req, res)=>{
  const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if(!urlPath.startsWith(PREFIX)){ res.writeHead(404); return res.end(); }
  let file = path.join(ROOT, urlPath.slice(PREFIX.length) || "index.html");
  if(!file.startsWith(ROOT)){ res.writeHead(403); return res.end(); }
  if(fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  fs.readFile(file, (err, data)=>{
    if(err){ res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  });
}).listen(PORT, "127.0.0.1");
