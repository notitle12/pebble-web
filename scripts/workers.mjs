import { cpSync, mkdtempSync, readFileSync, writeFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2];
if (!["build", "preview", "deploy"].includes(mode)) throw new Error("Use build, preview or deploy");
// Child tools run outside the repository so Next/Wrangler cannot auto-load its secret files.
const env = Object.fromEntries(["PATH", "HOME", "TMPDIR", "TMP", "TEMP", "USER", "LOGNAME", "CI", "TERM", "NO_COLOR"]
  .filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
env.NEXT_PUBLIC_API_BASE_URL = "https://api.pebble-log.com/api/v1";
function run(args, cwd) {
  const result = spawnSync("npm", args, { cwd, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
const marker = join(root, ".worker-build-path");
if (mode === "build") {
  const stage = mkdtempSync(join(tmpdir(), "pebble-web-workers-"));
  for (const name of ["src", "public", "scripts", "package.json", "package-lock.json", "tsconfig.json", "next-env.d.ts", "next.config.ts", "open-next.config.ts", "wrangler.jsonc"]) {
    cpSync(join(root, name), join(stage, name), { recursive: true,
      filter: source => !/(?:^|\/)(?:\.env[^/]*|\.dev\.vars[^/]*)$/.test(source) });
  }
  run(["ci"], stage);
  run(["exec", "--", "opennextjs-cloudflare", "build"], stage);
  writeFileSync(marker, stage + "\n");
  console.log("Isolated Workers build:", stage);
} else {
  const stage = realpathSync(readFileSync(marker, "utf8").trim());
  if (!stage.startsWith(join(realpathSync(tmpdir()), "pebble-web-workers-"))) throw new Error("Invalid build directory; run build:worker first");
  run(["exec", "--", "opennextjs-cloudflare", mode, ...process.argv.slice(3)], stage);
}
