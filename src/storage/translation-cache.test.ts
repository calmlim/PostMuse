import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStorageAreaMock, type StorageAreaMock } from "../test/chrome-storage";
import {
  createTranslationCacheKey,
  getCachedTranslation,
  saveCachedTranslation,
  TRANSLATION_CACHE_STORAGE_KEY,
} from "./translation-cache";

let session: StorageAreaMock;

beforeEach(() => {
  session = createStorageAreaMock();
  vi.stubGlobal("chrome", { storage: { session } });
});

describe("translation session cache", () => {
  it("stores only a digest key rather than the source text", async () => {
    const sourceText = "private source text";
    const key = await createTranslationCacheKey({
      sourceText,
      targetLanguage: "fr",
      provider: "openai-compatible",
      model: "test-model",
    });
    await saveCachedTranslation({
      key,
      text: "texte privé",
      targetLanguage: "fr",
      provider: "openai-compatible",
      model: "test-model",
    });

    expect(JSON.stringify(session.data)).not.toContain(sourceText);
    expect(await getCachedTranslation(key)).toMatchObject({ text: "texte privé" });
  });

  it("keeps at most 100 entries and refreshes a hit before eviction", async () => {
    for (let index = 0; index < 100; index += 1) {
      await saveCachedTranslation({
        key: `key-${index}`,
        text: `translation-${index}`,
        targetLanguage: "fr",
        provider: "openai-compatible",
        model: "test-model",
      });
    }
    await getCachedTranslation("key-0");
    await saveCachedTranslation({
      key: "key-100",
      text: "translation-100",
      targetLanguage: "fr",
      provider: "openai-compatible",
      model: "test-model",
    });

    const entries = session.data[TRANSLATION_CACHE_STORAGE_KEY] as Array<{ key: string }>;
    expect(entries).toHaveLength(100);
    expect(entries.some((entry) => entry.key === "key-0")).toBe(true);
    expect(entries.some((entry) => entry.key === "key-1")).toBe(false);
  });
});
