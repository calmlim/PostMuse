import { readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { build } from "vite";

const watch = process.argv.includes("--watch");
const profileIndex = process.argv.indexOf("--profile");
const profile = profileIndex >= 0 ? process.argv[profileIndex + 1] : "development";
const modeIndex = process.argv.indexOf("--mode");
const mode = modeIndex >= 0 ? process.argv[modeIndex + 1] : undefined;
const watchOptions = watch ? {} : undefined;

const buildOverride = { watch: watchOptions, emptyOutDir: watch ? false : undefined };

if (profile !== "development" && profile !== "store") {
  throw new Error(`Unknown build profile: ${profile}`);
}
if (watch && profile === "store") {
  throw new Error("The store profile is available only for production builds.");
}

await build({ configFile: "vite.config.ts", mode, build: buildOverride });
await build({ configFile: "vite.content.config.ts", mode, build: buildOverride });

if (!watch) {
  const contentScript = await readFile("dist/assets/content.js", "utf8");
  if (/^\s*(?:import|export)\b/m.test(contentScript)) {
    throw new Error("Content Script build must be a self-contained classic script.");
  }
  const contentGzipBytes = gzipSync(contentScript).byteLength;
  if (contentGzipBytes > 120 * 1024) {
    throw new Error(
      `Content Script gzip size is ${(contentGzipBytes / 1024).toFixed(1)} KB; the limit is 120 KB.`,
    );
  }

  if (profile === "store") {
    const manifest = JSON.parse(await readFile("dist/manifest.json", "utf8"));
    manifest.optional_host_permissions = manifest.optional_host_permissions.filter(
      (permission) =>
        !permission.startsWith("http://localhost") && !permission.startsWith("http://127.0.0.1"),
    );
    await writeFile("dist/manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);
  }
}
