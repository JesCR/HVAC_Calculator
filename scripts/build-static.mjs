import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const root = resolve(".");
const dist = join(root, "dist");
const entries = ["index.html", "src"];

rmSync(dist, { force: true, recursive: true });
mkdirSync(dist, { recursive: true });

for (const entry of entries) {
  const source = join(root, entry);
  const target = join(dist, entry);

  if (!existsSync(source)) {
    throw new Error(`Missing static entry: ${entry}`);
  }

  cpSync(source, target, {
    force: true,
    recursive: true,
    filter: (filePath) => basename(filePath) !== ".DS_Store"
  });
}

console.log(`HVAC Calculator listo en ${dist}`);
