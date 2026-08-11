import { DEFAULT_LOCALE, type Locale } from "../i18n";
import { loadSettings, saveUiLocaleSetting } from "./settings-repository";

export const loadUiLocale = async (): Promise<Locale> => {
  try {
    const settings = await loadSettings();
    return settings.uiLocale;
  } catch {
    return DEFAULT_LOCALE;
  }
};

export const saveUiLocale = async (locale: Locale): Promise<void> => {
  await saveUiLocaleSetting(locale);
};
