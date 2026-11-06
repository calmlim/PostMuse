import { describe, expect, it } from "vitest";
import { buildTranslationRequest, isSameTranslationLanguage } from "./request-builder";

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
    expect(request.maxOutputTokens).toBe(1200);
    expect(request.suppressCustomSampling).toBe(true);
    expect(request.reasoningMode).toBe("disabled");
  });

  it("can preserve Provider reasoning defaults when fast mode is off", () => {
    const request = buildTranslationRequest({ text: "Hello" }, "fr", 1200, false);
    expect(request).not.toHaveProperty("reasoningMode");
  });

  it("uses the configured profile output-token limit", () => {
    expect(buildTranslationRequest({ text: "hello" }, "zh-CN", 1200).maxOutputTokens).toBe(1200);
    expect(buildTranslationRequest({ text: "字".repeat(2000) }, "en", 500).maxOutputTokens).toBe(
      500,
    );
    expect(
      buildTranslationRequest({ text: "x".repeat(220) }, "zh-CN", 10_000).maxOutputTokens,
    ).toBe(10_000);
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
