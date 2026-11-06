import type { TranslationInput } from "./types";

export const MAX_TRANSLATION_CODE_POINTS = 25_000;

export const countCodePoints = (value: string): number => Array.from(value).length;

export const isTranslationInput = (value: unknown): value is TranslationInput => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const input = value as Record<string, unknown>;
  return (
    typeof input.text === "string" &&
    input.text.trim().length > 0 &&
    countCodePoints(input.text) <= MAX_TRANSLATION_CODE_POINTS &&
    (input.sourceLanguageHint === undefined ||
      (typeof input.sourceLanguageHint === "string" && input.sourceLanguageHint.length <= 35))
  );
};
