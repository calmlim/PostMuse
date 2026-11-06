import type { OutputLanguageId } from "../core/generation/languages";
import type { ProviderId } from "../core/settings/types";
import { TRANSLATION_RECIPE_VERSION } from "../core/translation/request-builder";

export const TRANSLATION_CACHE_STORAGE_KEY = "postmuse.translationCache";
const MAX_CACHE_ENTRIES = 100;

interface TranslationCacheEntry {
  key: string;
  text: string;
  targetLanguage: OutputLanguageId;
  provider: ProviderId;
  model: string;
}

const digest = async (value: string): Promise<string> => {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const createTranslationCacheKey = async (input: {
  sourceText: string;
  targetLanguage: OutputLanguageId;
  provider: ProviderId;
  model: string;
  fastMode: boolean;
}): Promise<string> =>
  digest(
    JSON.stringify([
      TRANSLATION_RECIPE_VERSION,
      input.sourceText,
      input.targetLanguage,
      input.provider,
      input.model,
      input.fastMode,
    ]),
  );

const readEntries = async (): Promise<TranslationCacheEntry[]> => {
  const stored = await chrome.storage.session.get(TRANSLATION_CACHE_STORAGE_KEY);
  const entries = stored[TRANSLATION_CACHE_STORAGE_KEY];
  return Array.isArray(entries) ? (entries as TranslationCacheEntry[]) : [];
};

const writeEntries = async (entries: TranslationCacheEntry[]): Promise<void> => {
  await chrome.storage.session.set({ [TRANSLATION_CACHE_STORAGE_KEY]: entries });
};

export const getCachedTranslation = async (
  key: string,
): Promise<Omit<TranslationCacheEntry, "key"> | undefined> => {
  const entries = await readEntries();
  const index = entries.findIndex((item) => item.key === key);
  const entry = entries[index];
  if (!entry) {
    return undefined;
  }
  entries.splice(index, 1);
  entries.unshift(entry);
  await writeEntries(entries);
  const { text, targetLanguage, provider, model } = entry;
  return { text, targetLanguage, provider, model };
};

export const saveCachedTranslation = async (entry: TranslationCacheEntry): Promise<void> => {
  const entries = (await readEntries()).filter((item) => item.key !== entry.key);
  entries.unshift(entry);
  await writeEntries(entries.slice(0, MAX_CACHE_ENTRIES));
};
