import { build } from "esbuild";
import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
await mkdir(".test-build", { recursive: true });
await build({
  entryPoints: ["tests/frontend.test.ts"], bundle: true, platform: "node",
  format: "esm", packages: "external", outfile: ".test-build/frontend.test.mjs",
  define: { "import.meta.env": JSON.stringify({ BASE_URL: "/", VITE_DATA_MODE: "demo" }) }
});
const result = spawnSync(process.execPath, ["--test", ".test-build/frontend.test.mjs"], { stdio: "inherit" });
process.exit(result.status ?? 1);
