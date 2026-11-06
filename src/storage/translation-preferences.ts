import { detectPreferredLocale } from "../i18n";
import type { Locale } from "../i18n/locale";
import {
  createDefaultTranslationPreferences,
  isTranslationPreferencesV2,
  migrateTranslationPreferences,
} from "../core/translation/preferences";
import type { TranslationPreferencesV2 } from "../core/translation/types";

export const TRANSLATION_PREFERENCES_STORAGE_KEY = "postmuse.translationPreferences";

export const loadTranslationPreferences = async (
  defaultLocale: Locale = detectPreferredLocale(),
): Promise<TranslationPreferencesV2> => {
  const defaults = createDefaultTranslationPreferences(defaultLocale);
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return defaults;
  }
  const stored = await chrome.storage.local.get(TRANSLATION_PREFERENCES_STORAGE_KEY);
  const current = stored[TRANSLATION_PREFERENCES_STORAGE_KEY];
  const migrated = migrateTranslationPreferences(current, defaultLocale);
  if (migrated) {
    if (!isTranslationPreferencesV2(current)) {
      await chrome.storage.local.set({ [TRANSLATION_PREFERENCES_STORAGE_KEY]: migrated });
    }
    return migrated;
  }
  await chrome.storage.local.set({ [TRANSLATION_PREFERENCES_STORAGE_KEY]: defaults });
  return defaults;
};

export const saveTranslationPreferences = async (
  preferences: TranslationPreferencesV2,
): Promise<TranslationPreferencesV2> => {
  if (!isTranslationPreferencesV2(preferences)) {
    throw new Error("Invalid translation preferences.");
  }
  await chrome.storage.local.set({ [TRANSLATION_PREFERENCES_STORAGE_KEY]: preferences });
  return preferences;
};
