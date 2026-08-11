import { CONTENT_TYPES, type GenerationInput, type GenerationResult } from "../generation/types";
import { isGenerationInput } from "../generation/validation";
import { PROVIDER_IDS } from "../settings/types";
import { isRecordValue } from "../settings/validation";

export const HISTORY_SCHEMA_VERSION = 1;
export const HISTORY_LIMIT = 100;

export interface HistoryRecordV1 {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  updatedAt: string;
  input: GenerationInput;
  result: GenerationResult;
  prompt: {
    recipeVersion: number;
    styleTemplateId: string;
    styleTemplateVersion: number;
  };
}

const isGeneratedText = (value: unknown): boolean =>
  isRecordValue(value) &&
  typeof value.id === "string" &&
  value.id.length > 0 &&
  typeof value.text === "string";

const isGenerationResult = (value: unknown): value is GenerationResult => {
  if (
    !isRecordValue(value) ||
    !PROVIDER_IDS.some((provider) => provider === value.provider) ||
    typeof value.model !== "string" ||
    !Array.isArray(value.warnings) ||
    !value.warnings.every((warning) => typeof warning === "string") ||
    !CONTENT_TYPES.some((contentType) => contentType === value.contentType) ||
    (value.softCharacterLimit !== undefined &&
      (typeof value.softCharacterLimit !== "number" ||
        !Number.isInteger(value.softCharacterLimit) ||
        value.softCharacterLimit < 1))
  ) {
    return false;
  }

  if (value.format === "candidates") {
    return (
      Array.isArray(value.candidates) &&
      value.candidates.length > 0 &&
      value.candidates.every(isGeneratedText)
    );
  }
  if (value.format === "thread") {
    return (
      Array.isArray(value.threads) &&
      value.threads.length > 0 &&
      value.threads.every(
        (thread) =>
          isRecordValue(thread) &&
          typeof thread.id === "string" &&
          Array.isArray(thread.posts) &&
          thread.posts.length > 0 &&
          thread.posts.every(isGeneratedText),
      )
    );
  }
  return value.format === "raw" && typeof value.rawText === "string";
};

const isIsoDate = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));

export const isHistoryRecordV1 = (value: unknown): value is HistoryRecordV1 =>
  isRecordValue(value) &&
  value.schemaVersion === HISTORY_SCHEMA_VERSION &&
  typeof value.id === "string" &&
  value.id.length > 0 &&
  value.id.length <= 100 &&
  isIsoDate(value.createdAt) &&
  isIsoDate(value.updatedAt) &&
  isGenerationInput(value.input) &&
  isGenerationResult(value.result) &&
  isRecordValue(value.prompt) &&
  typeof value.prompt.recipeVersion === "number" &&
  Number.isInteger(value.prompt.recipeVersion) &&
  value.prompt.recipeVersion >= 1 &&
  value.prompt.styleTemplateId === value.input.styleId &&
  typeof value.prompt.styleTemplateVersion === "number" &&
  Number.isInteger(value.prompt.styleTemplateVersion) &&
  value.prompt.styleTemplateVersion >= 1;

export const getHistoryResultText = (result: GenerationResult): string => {
  if (result.format === "candidates") {
    return result.candidates.map((candidate) => candidate.text).join("\n\n");
  }
  if (result.format === "thread") {
    return result.threads[0]?.posts.map((post) => post.text).join("\n\n") ?? "";
  }
  return result.rawText;
};
