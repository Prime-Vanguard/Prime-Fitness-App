import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";

const root = resolve("dist/client");
const base = "/Prime-Fitness-App/";
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
  ".gz": "application/gzip",
  ".txt": "text/plain",
};

// Emulates project-site directory redirects and GitHub's 404 document, without SPA rewrites.
createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://127.0.0.1");
    if (url.pathname === base.slice(0, -1)) {
      response.writeHead(301, { location: base + url.search }).end();
      return;
    }
    if (!url.pathname.startsWith(base) || !["GET", "HEAD"].includes(request.method)) {
      response.writeHead(404).end();
      return;
    }
    let file = resolve(root, decodeURIComponent(url.pathname.slice(base.length)));
    if (file !== root && !file.startsWith(root + sep)) {
      response.writeHead(404).end();
      return;
    }
    let status = 200;
    try {
      if ((await stat(file)).isDirectory()) {
        if (!url.pathname.endsWith("/")) {
          response.writeHead(301, { location: url.pathname + "/" + url.search }).end();
          return;
        }
        file = resolve(file, "index.html");
      }
      await stat(file);
    } catch {
      file = resolve(root, "404.html");
      status = 404;
    }
    const body = await readFile(file);
    response.writeHead(status, {
      "content-type": types[extname(file)] ?? "application/octet-stream",
      "cache-control": "no-cache",
    });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch {
    response.writeHead(500).end("Static preview failed");
  }
}).listen(3174, "127.0.0.1", () =>
  console.log("Pages preview: http://127.0.0.1:3174/Prime-Fitness-App/"),
);
