import { detectPreferredLocale } from "../i18n";
import type { Locale } from "../i18n/locale";
import {
  createDefaultTranslationPreferences,
  isTranslationPreferencesV1,
} from "../core/translation/preferences";
import type { TranslationPreferencesV1 } from "../core/translation/types";

export const TRANSLATION_PREFERENCES_STORAGE_KEY = "postmuse.translationPreferences";

export const loadTranslationPreferences = async (
  defaultLocale: Locale = detectPreferredLocale(),
): Promise<TranslationPreferencesV1> => {
  const defaults = createDefaultTranslationPreferences(defaultLocale);
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return defaults;
  }
  const stored = await chrome.storage.local.get(TRANSLATION_PREFERENCES_STORAGE_KEY);
  const current = stored[TRANSLATION_PREFERENCES_STORAGE_KEY];
  if (isTranslationPreferencesV1(current)) {
    return current;
  }
  await chrome.storage.local.set({ [TRANSLATION_PREFERENCES_STORAGE_KEY]: defaults });
  return defaults;
};

export const saveTranslationPreferences = async (
  preferences: TranslationPreferencesV1,
): Promise<TranslationPreferencesV1> => {
  if (!isTranslationPreferencesV1(preferences)) {
    throw new Error("Invalid translation preferences.");
  }
  await chrome.storage.local.set({ [TRANSLATION_PREFERENCES_STORAGE_KEY]: preferences });
  return preferences;
};
