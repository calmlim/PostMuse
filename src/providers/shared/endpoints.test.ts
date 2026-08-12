import { describe, expect, it } from "vitest";
import { appendApiPath } from "./endpoints";

describe("Provider endpoints", () => {
  it("appends only the resource path supplied by the adapter", () => {
    expect(appendApiPath("https://api.deepseek.com/v1", "/chat/completions")).toBe(
      "https://api.deepseek.com/v1/chat/completions",
    );
    expect(appendApiPath("https://gateway.example.com/openai", "/chat/completions")).toBe(
      "https://gateway.example.com/openai/chat/completions",
    );
  });

  it("does not infer an API version for an unversioned custom Base URL", () => {
    expect(appendApiPath("https://api.deepseek.com", "/chat/completions")).toBe(
      "https://api.deepseek.com/chat/completions",
    );
  });
});
