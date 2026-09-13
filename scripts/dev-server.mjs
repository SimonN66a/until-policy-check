// Local dev server: serves public/ and routes /api/* to the same handlers Vercel runs.
// Applies the headers from vercel.json so CSP problems surface here, not in production.
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const PORT = Number(process.env.PORT || 3000);
const ROOT = new URL("../public/", import.meta.url).pathname;
const vercel = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
const HEADERS = Object.fromEntries(
  vercel.headers.flatMap((g) => (g.source === "/(.*)" ? g.headers : [])).map((h) => [h.key, h.value])
);
const TYPES = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8",
  ".js":"text/javascript; charset=utf-8", ".json":"application/json", ".png":"image/png",
  ".jpg":"image/jpeg", ".svg":"image/svg+xml", ".woff2":"font/woff2" };

const server = http.createServer(async (req, res) => {
  for (const [k, v] of Object.entries(HEADERS)) res.setHeader(k, v);
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname.startsWith("/api/")) {
    const name = url.pathname.slice(5).replace(/[^a-z0-9_-]/gi, "");
    let handler;
    try { handler = (await import(`../api/${name}.js`)).default; }
    catch { res.writeHead(404).end(JSON.stringify({ message: "no such endpoint" })); return; }
    let raw = "";
    for await (const c of req) raw += c;
    req.body = raw ? JSON.parse(raw) : {};
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (o) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); return res; };
    try { await handler(req, res); }
    catch (e) { console.error(e); if (!res.writableEnded) res.status(500).json({ message: String(e) }); }
    return;
  }

  let p = normalize(join(ROOT, decodeURIComponent(url.pathname)));
  if (!p.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try { if ((await stat(p)).isDirectory()) p = join(p, "index.html"); } catch {}
  // vercel.json sets cleanUrls, so /bakermckenzie must serve bakermckenzie.html
  // here too -- otherwise local testing 404s on pages that work in production.
  if (vercel.cleanUrls && !extname(p)) {
    try { await stat(p); } catch { p += ".html"; }
  }
  try {
    const body = await readFile(p);
    res.writeHead(200, { "Content-Type": TYPES[extname(p)] || "application/octet-stream" }).end(body);
  } catch { res.writeHead(404).end("Not found"); }
});
server.listen(PORT, () => console.log(`http://localhost:${PORT}`));
