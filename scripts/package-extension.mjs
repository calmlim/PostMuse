import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { zipSync } from "fflate";

const manifest = JSON.parse(await readFile("dist/manifest.json", "utf8"));
const releaseDirectory = resolve("release");
const archive = resolve(releaseDirectory, `postmuse-${manifest.version}-store.zip`);
await mkdir(releaseDirectory, { recursive: true });
await rm(archive, { force: true });

const collectFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? collectFiles(path) : [path];
    }),
  );
  return nested.flat();
};

const distDirectory = resolve("dist");
const files = await collectFiles(distDirectory);
const zipEntries = Object.fromEntries(
  await Promise.all(
    files.map(async (file) => [
      relative(distDirectory, file).split(sep).join("/"),
      new Uint8Array(await readFile(file)),
    ]),
  ),
);
await writeFile(archive, zipSync(zipEntries, { level: 9 }));

console.log(`Created ${archive}`);
