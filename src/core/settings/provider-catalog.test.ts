import { describe, expect, it } from "vitest";
import { getOriginPattern, normalizeBaseUrl } from "./provider-catalog";

describe("provider URL policy", () => {
  it("normalizes HTTPS URLs and scopes permission to the origin", () => {
    expect(normalizeBaseUrl(" https://api.example.com/v1/?ignored=yes#hash ")).toBe(
      "https://api.example.com/v1",
    );
    expect(getOriginPattern("https://api.example.com/v1")).toBe("https://api.example.com/*");
  });

  it("rejects insecure remote URLs and embedded credentials", () => {
    expect(() => normalizeBaseUrl("http://api.example.com/v1")).toThrow(/HTTPS/);
    expect(() => normalizeBaseUrl("https://user:secret@api.example.com")).toThrow(/credentials/);
  });

  it("allows HTTP localhost only when explicitly enabled", () => {
    expect(() => normalizeBaseUrl("http://localhost:11434/v1")).toThrow(/HTTPS/);
    expect(normalizeBaseUrl("http://localhost:11434/v1", { allowInsecureLocalhost: true })).toBe(
      "http://localhost:11434/v1",
    );
  });
});
