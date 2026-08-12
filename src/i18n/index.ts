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

export {
  DEFAULT_LOCALE,
  detectPreferredLocale,
  isLocale,
  resolveLocale,
  UI_LOCALE_OPTIONS,
  type Locale,
} from "./locale";
import type { Locale } from "./locale";

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

export type Messages = (typeof messages)[Locale];

export const getMessages = (locale: Locale): Messages => messages[locale];
