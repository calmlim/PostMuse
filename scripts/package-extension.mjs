import { mkdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const manifest = JSON.parse(await readFile("dist/manifest.json", "utf8"));
const releaseDirectory = resolve("release");
const archive = resolve(releaseDirectory, `postmuse-${manifest.version}-store.zip`);
await mkdir(releaseDirectory, { recursive: true });
await rm(archive, { force: true });

await new Promise((resolvePromise, reject) => {
  const child = spawn("zip", ["-qr", archive, "."], { cwd: resolve("dist"), stdio: "inherit" });
  child.on("error", reject);
  child.on("exit", (code) =>
    code === 0 ? resolvePromise() : reject(new Error(`zip exited with code ${code}`)),
  );
});

console.log(`Created ${archive}`);
