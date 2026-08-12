import { detectPreferredLocale, type Locale } from "../i18n";
import { loadSettings, saveUiLocaleSetting } from "./settings-repository";

export const loadUiLocale = async (): Promise<Locale> => {
  try {
    const settings = await loadSettings();
    return settings.uiLocale;
  } catch {
    return detectPreferredLocale();
  }
};

export const saveUiLocale = async (locale: Locale): Promise<void> => {
  await saveUiLocaleSetting(locale);
};
