import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("release version", () => {
  it("keeps the package and Chrome manifest versions aligned", () => {
    const packageMetadata = JSON.parse(readFileSync("package.json", "utf8"));
    const manifest = JSON.parse(readFileSync("public/manifest.json", "utf8"));

    expect(manifest.version).toBe(packageMetadata.version);
  });
});
