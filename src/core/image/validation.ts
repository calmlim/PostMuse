import { isRecordValue } from "../settings/validation";
import { IMAGE_ASPECT_RATIOS, IMAGE_SIZES, IMAGE_STYLES, type ImageGenerationInput } from "./types";

export const MAX_IMAGE_SOURCE_LENGTH = 100_000;
export const MAX_IMAGE_DESCRIPTION_LENGTH = 20_000;
export const MAX_IMAGE_PROMPT_LENGTH = 32_000;

export const isImageGenerationInput = (value: unknown): value is ImageGenerationInput =>
  isRecordValue(value) &&
  typeof value.sourceText === "string" &&
  value.sourceText.trim().length > 0 &&
  value.sourceText.length <= MAX_IMAGE_SOURCE_LENGTH &&
  typeof value.prompt === "string" &&
  value.prompt.trim().length > 0 &&
  value.prompt.length <= MAX_IMAGE_PROMPT_LENGTH &&
  IMAGE_STYLES.some((style) => style === value.style) &&
  IMAGE_ASPECT_RATIOS.some((ratio) => ratio === value.aspectRatio) &&
  IMAGE_SIZES.some((size) => size === value.size) &&
  typeof value.includeText === "boolean";
