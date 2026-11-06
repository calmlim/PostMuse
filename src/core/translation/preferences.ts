import type { Locale } from "../../i18n/locale";
import { isOutputLanguageId, type OutputLanguageId } from "../generation/languages";
import { TRANSLATION_DISPLAY_MODES, type TranslationPreferencesV2 } from "./types";

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
): TranslationPreferencesV2 => ({
  schemaVersion: 2,
  targetLanguage: localeTargets[locale] ?? "en",
  displayMode: "below",
  translationModel: "",
  fastMode: true,
});

export const isTranslationPreferencesV2 = (value: unknown): value is TranslationPreferencesV2 => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record.schemaVersion === 2 &&
    isOutputLanguageId(record.targetLanguage) &&
    typeof record.displayMode === "string" &&
    TRANSLATION_DISPLAY_MODES.some((mode) => mode === record.displayMode) &&
    typeof record.translationModel === "string" &&
    record.translationModel.length <= 200 &&
    typeof record.fastMode === "boolean"
  );
};

export const migrateTranslationPreferences = (
  value: unknown,
  locale: Locale = "en",
): TranslationPreferencesV2 | undefined => {
  if (isTranslationPreferencesV2(value)) {
    return value;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  if (
    record.schemaVersion !== 1 ||
    !isOutputLanguageId(record.targetLanguage) ||
    typeof record.displayMode !== "string" ||
    !TRANSLATION_DISPLAY_MODES.some((mode) => mode === record.displayMode)
  ) {
    return undefined;
  }
  return {
    ...createDefaultTranslationPreferences(locale),
    targetLanguage: record.targetLanguage,
    displayMode: record.displayMode as TranslationPreferencesV2["displayMode"],
  };
};
