// Serves test.html and proxies /api/chat to ollama.com so the browser
// never talks cross-origin and never sees the API key.
//   OLLAMA_API_KEY=sk-... node proxy.mjs
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const KEY = process.env.OLLAMA_API_KEY;
if (!KEY) {
  console.error("Set OLLAMA_API_KEY first.");
  process.exit(1);
}

const PORT = 5500;

createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/chat") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    try {
      const upstream = await fetch("https://ollama.com/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${KEY}`,
        },
        body: Buffer.concat(chunks),
      });
      const body = await upstream.text();
      res.writeHead(upstream.status, { "Content-Type": "application/json" });
      res.end(body);
    } catch (err) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(err) }));
    }
    return;
  }

  if (req.method === "GET" && (req.url === "/" || req.url === "/test.html")) {
    const html = await readFile(new URL("./test.html", import.meta.url));
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }

  res.writeHead(404).end("Not found");
}).listen(PORT, () => console.log(`http://127.0.0.1:${PORT}/`));
