import de from "./inline/de.json";
import en from "./inline/en.json";
import es from "./inline/es.json";
import fr from "./inline/fr.json";
import ja from "./inline/ja.json";
import ko from "./inline/ko.json";
import ptBR from "./inline/pt-BR.json";
import vi from "./inline/vi.json";
import zhCN from "./inline/zh-CN.json";
import zhTW from "./inline/zh-TW.json";
import type { Locale } from "./locale";

const inlineMessages = {
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
} satisfies Record<Locale, typeof en>;

export type InlineMessages = (typeof inlineMessages)[Locale];
export const getInlineMessages = (locale: Locale): InlineMessages => inlineMessages[locale];
