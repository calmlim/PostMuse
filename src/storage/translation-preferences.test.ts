import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultTranslationPreferences } from "../core/translation/preferences";
import {
  loadTranslationPreferences,
  saveTranslationPreferences,
  TRANSLATION_PREFERENCES_STORAGE_KEY,
} from "./translation-preferences";

describe("translation preferences", () => {
  const get = vi.fn();
  const set = vi.fn();

  beforeEach(() => {
    get.mockReset();
    set.mockReset();
    vi.stubGlobal("chrome", { storage: { local: { get, set } } });
  });

  it("seeds a safe default when storage is empty", async () => {
    get.mockResolvedValue({});
    const result = await loadTranslationPreferences();
    expect(result).toEqual(createDefaultTranslationPreferences());
    expect(set).toHaveBeenCalledWith({ [TRANSLATION_PREFERENCES_STORAGE_KEY]: result });
  });

  it("uses the saved UI locale when choosing the initial target", async () => {
    get.mockResolvedValue({});
    await expect(loadTranslationPreferences("zh-CN")).resolves.toMatchObject({
      targetLanguage: "zh-CN",
      displayMode: "below",
    });
  });

  it("persists a supported target and reversible display mode", async () => {
    const preferences = { schemaVersion: 1, targetLanguage: "ja", displayMode: "replace" } as const;
    await expect(saveTranslationPreferences(preferences)).resolves.toEqual(preferences);
    expect(set).toHaveBeenCalledWith({ [TRANSLATION_PREFERENCES_STORAGE_KEY]: preferences });
  });
});
