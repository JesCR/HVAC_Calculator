import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 4173);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webp": "image/webp"
};

function resolveRequestPath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split("?")[0]);
  const normalizedPath = normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
  const requestedPath = resolve(join(root, normalizedPath));

  if (requestedPath !== root && !requestedPath.startsWith(`${root}${sep}`)) {
    return join(root, "index.html");
  }

  if (existsSync(requestedPath) && statSync(requestedPath).isDirectory()) {
    return join(requestedPath, "index.html");
  }

  if (existsSync(requestedPath)) {
    return requestedPath;
  }

  return join(root, "index.html");
}

const server = createServer((request, response) => {
  try {
    const filePath = resolveRequestPath(request.url || "/");
    const extension = extname(filePath);
    const contentType = contentTypes[extension] || "application/octet-stream";

    response.writeHead(200, { "Content-Type": contentType });
    createReadStream(filePath).pipe(response);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(`Dev server error: ${error.message}`);
  }
});

server.listen(port, host, () => {
  console.log(`HVAC Calculator disponible en http://${host}:${port}`);
});
