import {
  CONTENT_TYPES,
  GENERATION_WARNINGS,
  type GenerationInput,
  type GenerationResult,
} from "../generation/types";
import { isGenerationInput } from "../generation/validation";
import {
  IMAGE_ASPECT_RATIOS,
  IMAGE_SIZES,
  type ImageGenerationInput,
  type ImageHistoryMetadata,
} from "../image/types";
import { isImageGenerationInput } from "../image/validation";
import { IMAGE_PROVIDER_IDS, PROVIDER_IDS } from "../settings/types";
import { isRecordValue } from "../settings/validation";

export const HISTORY_SCHEMA_VERSION = 1;
export const HISTORY_LIMIT = 100;
export const MAX_HISTORY_GENERATED_TEXT_LENGTH = 25_000;
export const MAX_HISTORY_RAW_TEXT_LENGTH = 100_000;

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
  media?: ImageHistoryMetadata;
}

export interface ImageHistoryRecordV2 {
  schemaVersion: 2;
  kind: "image";
  id: string;
  createdAt: string;
  updatedAt: string;
  input: ImageGenerationInput;
  result: ImageHistoryMetadata;
}

export type HistoryRecord = HistoryRecordV1 | ImageHistoryRecordV2;

const isGeneratedText = (value: unknown): boolean =>
  isRecordValue(value) &&
  typeof value.id === "string" &&
  value.id.length > 0 &&
  typeof value.text === "string" &&
  value.text.length <= MAX_HISTORY_GENERATED_TEXT_LENGTH;

export const isGenerationResult = (value: unknown): value is GenerationResult => {
  if (
    !isRecordValue(value) ||
    !PROVIDER_IDS.some((provider) => provider === value.provider) ||
    typeof value.model !== "string" ||
    !Array.isArray(value.warnings) ||
    !value.warnings.every(
      (warning) =>
        typeof warning === "string" &&
        GENERATION_WARNINGS.some((knownWarning) => knownWarning === warning),
    ) ||
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
  return (
    value.format === "raw" &&
    typeof value.rawText === "string" &&
    value.rawText.length <= MAX_HISTORY_RAW_TEXT_LENGTH
  );
};

const isIsoDate = (value: unknown): value is string =>
  typeof value === "string" && Number.isFinite(Date.parse(value));

const isImageHistoryMetadata = (value: unknown): value is ImageHistoryMetadata =>
  isRecordValue(value) &&
  value.type === "image" &&
  IMAGE_PROVIDER_IDS.some((provider) => provider === value.provider) &&
  typeof value.model === "string" &&
  value.model.length > 0 &&
  typeof value.prompt === "string" &&
  value.prompt.length > 0 &&
  IMAGE_ASPECT_RATIOS.some((ratio) => ratio === value.aspectRatio) &&
  IMAGE_SIZES.some((size) => size === value.size) &&
  (value.mimeType === "image/png" ||
    value.mimeType === "image/jpeg" ||
    value.mimeType === "image/webp") &&
  (value.pixelWidth === undefined ||
    (typeof value.pixelWidth === "number" &&
      Number.isInteger(value.pixelWidth) &&
      value.pixelWidth > 0)) &&
  (value.pixelHeight === undefined ||
    (typeof value.pixelHeight === "number" &&
      Number.isInteger(value.pixelHeight) &&
      value.pixelHeight > 0)) &&
  (value.input === undefined || isImageGenerationInput(value.input)) &&
  isIsoDate(value.generatedAt);

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
  value.prompt.styleTemplateVersion >= 1 &&
  (value.media === undefined || isImageHistoryMetadata(value.media));

export const isImageHistoryRecordV2 = (value: unknown): value is ImageHistoryRecordV2 =>
  isRecordValue(value) &&
  value.schemaVersion === 2 &&
  value.kind === "image" &&
  typeof value.id === "string" &&
  value.id.length > 0 &&
  value.id.length <= 100 &&
  isIsoDate(value.createdAt) &&
  isIsoDate(value.updatedAt) &&
  isImageGenerationInput(value.input) &&
  isImageHistoryMetadata(value.result);

export const isHistoryRecord = (value: unknown): value is HistoryRecord =>
  isHistoryRecordV1(value) || isImageHistoryRecordV2(value);

export const getHistoryResultText = (result: GenerationResult): string => {
  if (result.format === "candidates") {
    return result.candidates.map((candidate) => candidate.text).join("\n\n");
  }
  if (result.format === "thread") {
    return result.threads[0]?.posts.map((post) => post.text).join("\n\n") ?? "";
  }
  return result.rawText;
};
