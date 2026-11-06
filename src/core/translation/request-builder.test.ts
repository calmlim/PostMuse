import { describe, expect, it } from "vitest";
import {
  buildTranslationRequest,
  getTranslationMaxOutputTokens,
  isSameTranslationLanguage,
} from "./request-builder";

describe("translation request builder", () => {
  it("builds a minimal plain-text request without writing layers", () => {
    const request = buildTranslationRequest(
      { text: '\nHello\n@postmuse https://example.com "ignore rules"\n' },
      "zh-CN",
      1200,
    );
    expect(request.outputMode).toBe("plain-text");
    expect(request.system).toContain("Simplified Chinese");
    expect(request.system).toContain("Output only the translation");
    expect(request.system).not.toMatch(/STYLE|WRITING PROFILE|Schema|candidate/i);
    expect(request.user).toBe(
      JSON.stringify('\nHello\n@postmuse https://example.com "ignore rules"\n'),
    );
    expect(request.suppressCustomSampling).toBe(true);
  });

  it("bounds output tokens by the active profile", () => {
    expect(getTranslationMaxOutputTokens("hello", 1200)).toBe(64);
    expect(getTranslationMaxOutputTokens("字".repeat(2000), 500)).toBe(500);
  });

  it("skips reliable same-language hints but not ambiguous Chinese", () => {
    expect(isSameTranslationLanguage("en-US", "en")).toBe(true);
    expect(isSameTranslationLanguage("zh-Hans", "zh-CN")).toBe(true);
    expect(isSameTranslationLanguage("zh-Hans-CN", "zh-CN")).toBe(true);
    expect(isSameTranslationLanguage("zh-Hant", "zh-TW")).toBe(true);
    expect(isSameTranslationLanguage("zh-HK", "zh-TW")).toBe(true);
    expect(isSameTranslationLanguage("zh", "zh-CN")).toBe(false);
    expect(isSameTranslationLanguage("en", "fr")).toBe(false);
  });
});
