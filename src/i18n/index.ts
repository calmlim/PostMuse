import en from "./en.json";
import de from "./de.json";
import es from "./es.json";
import fr from "./fr.json";
import ja from "./ja.json";
import ko from "./ko.json";
import ptBR from "./pt-BR.json";
import vi from "./vi.json";
import zhCN from "./zh-CN.json";
import zhTW from "./zh-TW.json";

export const DEFAULT_LOCALE = "en" as const;

const messages = {
  en,
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  ja,
  ko,
  vi,
  es,
  "pt-BR": ptBR,
  fr,
  de,
} as const;

export type Locale = keyof typeof messages;
export type Messages = (typeof messages)[Locale];

export const UI_LOCALE_OPTIONS: ReadonlyArray<{ id: Locale; label: string }> = [
  { id: "en", label: "English" },
  { id: "zh-CN", label: "简体中文" },
  { id: "zh-TW", label: "繁體中文" },
  { id: "ja", label: "日本語" },
  { id: "ko", label: "한국어" },
  { id: "vi", label: "Tiếng Việt" },
  { id: "es", label: "Español" },
  { id: "pt-BR", label: "Português (Brasil)" },
  { id: "fr", label: "Français" },
  { id: "de", label: "Deutsch" },
];

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && value in messages;

export const getMessages = (locale: Locale): Messages => messages[locale];

export const resolveLocale = (languageTag: string | undefined): Locale => {
  const normalized = languageTag?.trim().replaceAll("_", "-").toLowerCase();
  if (!normalized) {
    return DEFAULT_LOCALE;
  }
  if (normalized.startsWith("zh-hant") || /^(zh-)?(tw|hk|mo)(-|$)/.test(normalized)) {
    return "zh-TW";
  }
  if (normalized.startsWith("zh")) {
    return "zh-CN";
  }
  if (normalized.startsWith("pt")) {
    return "pt-BR";
  }
  return (
    (
      UI_LOCALE_OPTIONS.find(({ id }) => normalized === id.toLowerCase()) ??
      UI_LOCALE_OPTIONS.find(({ id }) => normalized.startsWith(`${id.toLowerCase()}-`))
    )?.id ?? DEFAULT_LOCALE
  );
};

export const detectPreferredLocale = (): Locale => {
  const chromeLanguage =
    typeof chrome !== "undefined" && chrome.i18n?.getUILanguage
      ? chrome.i18n.getUILanguage()
      : undefined;
  const browserLanguage =
    typeof navigator !== "undefined" ? (navigator.languages?.[0] ?? navigator.language) : undefined;
  return resolveLocale(chromeLanguage ?? browserLanguage);
};
