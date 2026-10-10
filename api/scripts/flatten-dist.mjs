// tsc must use rootDir ".." because src/ imports types from ../shared/api-types.ts.
// That puts the compiled server at build/tsc/api/src/*. Move it to dist/ so the
// entrypoint is dist/server.js. shared/ is type-only, so nothing needs it at runtime.
import { existsSync, renameSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const compiled = join(root, "build", "tsc", "api", "src");
const dist = join(root, "dist");

if (!existsSync(join(compiled, "server.js"))) {
  console.error(`flatten-dist: ${compiled}/server.js not found`);
  process.exit(1);
}
rmSync(dist, { recursive: true, force: true });
renameSync(compiled, dist);
rmSync(join(root, "build"), { recursive: true, force: true });
