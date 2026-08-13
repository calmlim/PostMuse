import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const packageMetadata = JSON.parse(await readFile("package.json", "utf8"));
const manifest = JSON.parse(await readFile("public/manifest.json", "utf8"));
const version = packageMetadata.version;
if (manifest.version !== version) {
  throw new Error(`Version mismatch: package ${version}, manifest ${manifest.version}.`);
}
const releaseDirectory = resolve("release");
const storeArchive = resolve(releaseDirectory, `postmuse-${version}-store.zip`);
const chromeArchive = resolve(releaseDirectory, `postmuse-${version}-chrome.zip`);

await mkdir(releaseDirectory, { recursive: true });
await copyFile(storeArchive, chromeArchive);

const archiveBytes = await readFile(chromeArchive);
const checksum = createHash("sha256").update(archiveBytes).digest("hex");
await writeFile(
  resolve(releaseDirectory, "SHA256SUMS"),
  `${checksum}  postmuse-${version}-chrome.zip\n`,
);

console.log(`Created ${chromeArchive}`);
console.log(`Updated ${resolve(releaseDirectory, "SHA256SUMS")}`);
