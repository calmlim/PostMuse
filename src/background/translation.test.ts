import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultProviderProfile } from "../core/settings/defaults";
import { createDefaultTranslationPreferences } from "../core/translation/preferences";
import { TRANSLATION_CACHE_STORAGE_KEY } from "../storage/translation-cache";
import { translateText } from "./translation";

const adapterGenerate = vi.hoisted(() => vi.fn());
vi.mock("../providers/text", () => ({
  getTextProviderAdapter: () => ({ generate: adapterGenerate }),
}));

describe("background translation", () => {
  const session = new Map<string, unknown>();

  beforeEach(() => {
    adapterGenerate.mockReset();
    session.clear();
    vi.stubGlobal("chrome", {
      storage: {
        session: {
          get: vi.fn(async (key: string) => ({ [key]: session.get(key) })),
          set: vi.fn(async (value: Record<string, unknown>) => {
            for (const [key, item] of Object.entries(value)) {
              session.set(key, item);
            }
          }),
        },
      },
    });
  });

  it("skips the Provider when the reliable source hint matches", async () => {
    const result = await translateText(
      { text: "Hello", sourceLanguageHint: "en-US" },
      createDefaultTranslationPreferences("en"),
      { ...createDefaultProviderProfile(), model: "test-model" },
      undefined,
      new AbortController().signal,
    );
    expect(result).toEqual({ status: "same-language", targetLanguage: "en" });
    expect(adapterGenerate).not.toHaveBeenCalled();
  });

  it("returns one plain translation and reuses it from session cache", async () => {
    adapterGenerate.mockResolvedValue({ text: "Bonjour" });
    const preferences = {
      ...createDefaultTranslationPreferences("fr"),
      targetLanguage: "fr" as const,
    };
    const profile = { ...createDefaultProviderProfile(), model: "test-model" };
    const first = await translateText(
      { text: "Hello", sourceLanguageHint: "en" },
      preferences,
      profile,
      "test-key",
      new AbortController().signal,
    );
    const second = await translateText(
      { text: "Hello", sourceLanguageHint: "en" },
      preferences,
      profile,
      "test-key",
      new AbortController().signal,
    );

    expect(first).toMatchObject({ status: "translated", text: "Bonjour", cached: false });
    expect(second).toMatchObject({ status: "translated", text: "Bonjour", cached: true });
    expect(adapterGenerate).toHaveBeenCalledTimes(1);
    expect(session.get(TRANSLATION_CACHE_STORAGE_KEY)).toHaveLength(1);
    const request = adapterGenerate.mock.calls[0][0];
    expect(request.outputMode).toBe("plain-text");
    expect(request.system).not.toMatch(/STYLE|WRITING PROFILE|schema/i);
  });
});
