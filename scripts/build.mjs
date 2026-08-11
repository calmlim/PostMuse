import { readFile } from "node:fs/promises";
import { build } from "vite";

const watch = process.argv.includes("--watch");
const modeIndex = process.argv.indexOf("--mode");
const mode = modeIndex >= 0 ? process.argv[modeIndex + 1] : undefined;
const watchOptions = watch ? {} : undefined;

const buildOverride = { watch: watchOptions, emptyOutDir: watch ? false : undefined };

await build({ configFile: "vite.config.ts", mode, build: buildOverride });
await build({ configFile: "vite.content.config.ts", mode, build: buildOverride });

if (!watch) {
  const contentScript = await readFile("dist/assets/content.js", "utf8");
  if (/^\s*(?:import|export)\b/m.test(contentScript)) {
    throw new Error("Content Script build must be a self-contained classic script.");
  }
}
