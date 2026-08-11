import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const profileIndex = process.argv.indexOf("--profile");
const profile = profileIndex >= 0 ? process.argv[profileIndex + 1] : "development";
if (profile !== "development" && profile !== "store") {
  throw new Error(`Unknown audit profile: ${profile}`);
}

const root = "dist";
const toPackagePath = (file) => relative(root, file).split(sep).join("/");
const manifest = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

assert(manifest.manifest_version === 3, "manifest_version must be 3");
assert(
  JSON.stringify([...(manifest.permissions ?? [])].sort()) ===
    JSON.stringify(["sidePanel", "storage"].sort()),
  "required permissions must be exactly sidePanel and storage",
);
assert(
  manifest.content_security_policy?.extension_pages === "script-src 'self'; object-src 'self'",
  "extension CSP must allow self-hosted scripts only",
);
assert(
  Array.isArray(manifest.optional_host_permissions) &&
    manifest.optional_host_permissions.includes("https://*/*"),
  "user-triggered HTTPS Provider origin permission must remain optional",
);

const collectFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? collectFiles(path) : [path];
    }),
  );
  return nested.flat();
};

const files = await collectFiles(root);
const names = new Set(files.map(toPackagePath));
for (const required of [
  "manifest.json",
  "sidepanel.html",
  "privacy.html",
  "support.html",
  "icons/icon-16.png",
  "icons/icon-32.png",
  "icons/icon-48.png",
  "icons/icon-128.png",
]) {
  assert(names.has(required), `missing release asset: ${required}`);
}

if (profile === "store") {
  assert(!manifest.content_scripts, "store profile must not register an X content script");
  assert(!names.has("assets/content.js"), "store profile must not package the X content script");
  assert(
    manifest.optional_host_permissions.every((permission) => !permission.startsWith("http://")),
    "store profile must not request insecure localhost origins",
  );
} else {
  assert(
    manifest.content_scripts?.length === 1,
    "development profile must register X inline context",
  );
  assert(names.has("assets/content.js"), "development profile must package the X content script");
}

const textExtensions = new Set([".css", ".html", ".js", ".json", ".svg"]);
const secretPatterns = [
  /sk-[A-Za-z0-9_-]{16,}/g,
  /xai-[A-Za-z0-9_-]{16,}/g,
  /AIza[0-9A-Za-z_-]{30,}/g,
  /Bearer\s+[A-Za-z0-9._-]{16,}/g,
];
for (const file of files) {
  const extension = file.slice(file.lastIndexOf("."));
  if (!textExtensions.has(extension)) continue;
  const text = await readFile(file, "utf8");
  for (const pattern of secretPatterns) {
    pattern.lastIndex = 0;
    assert(!pattern.test(text), `possible secret in ${toPackagePath(file)}`);
  }
  if (extension === ".html") {
    assert(!/<script[^>]+src=["']https?:/i.test(text), `remote script in ${toPackagePath(file)}`);
    assert(
      !/<link[^>]+rel=["']stylesheet["'][^>]+href=["']https?:/i.test(text),
      `remote stylesheet in ${toPackagePath(file)}`,
    );
  }
}

if (failures.length) {
  throw new Error(`Release audit failed:\n- ${failures.join("\n- ")}`);
}

console.log(`Release audit passed for ${profile}: ${files.length} packaged files checked.`);
