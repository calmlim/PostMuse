export const OUTPUT_LANGUAGE_OPTIONS = [
  { id: "en", label: "English" },
  { id: "zh-CN", label: "简体中文" },
  { id: "zh-TW", label: "繁體中文" },
  { id: "ja", label: "日本語" },
  { id: "ko", label: "한국어" },
  { id: "es", label: "Español" },
  { id: "fr", label: "Français" },
  { id: "de", label: "Deutsch" },
  { id: "pt", label: "Português" },
  { id: "it", label: "Italiano" },
  { id: "ru", label: "Русский" },
  { id: "ar", label: "العربية" },
  { id: "hi", label: "हिन्दी" },
  { id: "id", label: "Bahasa Indonesia" },
  { id: "vi", label: "Tiếng Việt" },
  { id: "th", label: "ไทย" },
  { id: "tr", label: "Türkçe" },
] as const;

export type OutputLanguageId = (typeof OUTPUT_LANGUAGE_OPTIONS)[number]["id"];

export const OUTPUT_LANGUAGE_IDS = OUTPUT_LANGUAGE_OPTIONS.map(
  ({ id }) => id,
) as OutputLanguageId[];

export const isOutputLanguageId = (value: unknown): value is OutputLanguageId =>
  typeof value === "string" && OUTPUT_LANGUAGE_IDS.some((id) => id === value);
