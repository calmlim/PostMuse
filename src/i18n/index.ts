import en from "./en.json";
import zhCN from "./zh-CN.json";

export const DEFAULT_LOCALE = "en" as const;

const messages = {
  en,
  "zh-CN": zhCN,
} as const;

export type Locale = keyof typeof messages;
export type Messages = (typeof messages)[Locale];

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && value in messages;

export const getMessages = (locale: Locale): Messages => messages[locale];
