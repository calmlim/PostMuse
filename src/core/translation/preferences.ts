import type { Locale } from "../../i18n/locale";
import { isOutputLanguageId, type OutputLanguageId } from "../generation/languages";
import { TRANSLATION_DISPLAY_MODES, type TranslationPreferencesV1 } from "./types";

const localeTargets: Partial<Record<Locale, OutputLanguageId>> = {
  en: "en",
  "zh-CN": "zh-CN",
  "zh-TW": "zh-TW",
  ja: "ja",
  ko: "ko",
  vi: "vi",
  es: "es",
  "pt-BR": "pt",
  fr: "fr",
  de: "de",
};

export const createDefaultTranslationPreferences = (
  locale: Locale = "en",
): TranslationPreferencesV1 => ({
  schemaVersion: 1,
  targetLanguage: localeTargets[locale] ?? "en",
  displayMode: "below",
});

export const isTranslationPreferencesV1 = (value: unknown): value is TranslationPreferencesV1 => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record.schemaVersion === 1 &&
    isOutputLanguageId(record.targetLanguage) &&
    typeof record.displayMode === "string" &&
    TRANSLATION_DISPLAY_MODES.some((mode) => mode === record.displayMode)
  );
};
