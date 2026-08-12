export const OUTPUT_LANGUAGE_OPTIONS = [
  { id: "en", label: "English", instructionName: "English" },
  { id: "zh-CN", label: "简体中文", instructionName: "Simplified Chinese" },
  { id: "zh-TW", label: "繁體中文", instructionName: "Traditional Chinese" },
  { id: "ja", label: "日本語", instructionName: "Japanese" },
  { id: "ko", label: "한국어", instructionName: "Korean" },
  { id: "es", label: "Español", instructionName: "Spanish" },
  { id: "fr", label: "Français", instructionName: "French" },
  { id: "de", label: "Deutsch", instructionName: "German" },
  { id: "pt", label: "Português", instructionName: "Portuguese" },
  { id: "it", label: "Italiano", instructionName: "Italian" },
  { id: "ru", label: "Русский", instructionName: "Russian" },
  { id: "ar", label: "العربية", instructionName: "Arabic" },
  { id: "hi", label: "हिन्दी", instructionName: "Hindi" },
  { id: "id", label: "Bahasa Indonesia", instructionName: "Indonesian" },
  { id: "vi", label: "Tiếng Việt", instructionName: "Vietnamese" },
  { id: "th", label: "ไทย", instructionName: "Thai" },
  { id: "tr", label: "Türkçe", instructionName: "Turkish" },
] as const;

export type OutputLanguageId = (typeof OUTPUT_LANGUAGE_OPTIONS)[number]["id"];

export const OUTPUT_LANGUAGE_IDS = OUTPUT_LANGUAGE_OPTIONS.map(
  ({ id }) => id,
) as OutputLanguageId[];

export const isOutputLanguageId = (value: unknown): value is OutputLanguageId =>
  typeof value === "string" && OUTPUT_LANGUAGE_IDS.some((id) => id === value);

export const getOutputLanguageInstructionName = (value: string): string =>
  OUTPUT_LANGUAGE_OPTIONS.find((option) => option.id === value)?.instructionName ?? value;
