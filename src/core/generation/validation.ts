import { isRecordValue } from "../settings/validation";
import { isStyleId } from "../prompts/styles";
import {
  CONTENT_TYPES,
  LANGUAGE_MODES,
  OUTPUT_LENGTHS,
  QUOTE_INTENTS,
  REPLY_INTENTS,
  SOURCE_KINDS,
  type GenerationInput,
  type RegenerationInput,
  getCustomLengthBounds,
} from "./types";

export const MAX_SOURCE_CHARACTERS = 100_000;
export const MAX_FILE_BYTES = 1024 * 1024;

const isOneOf = <T extends readonly string[]>(values: T, value: unknown): value is T[number] =>
  typeof value === "string" && values.some((item) => item === value);

const isOptionalText = (value: unknown, maxLength: number): boolean =>
  value === undefined || (typeof value === "string" && value.length <= maxLength);

export const isGenerationInput = (value: unknown): value is GenerationInput => {
  if (!isRecordValue(value) || !isRecordValue(value.source) || !isRecordValue(value.language)) {
    return false;
  }

  const text = value.source.text;
  const contentType = value.contentType;
  const candidateCount = value.candidateCount;
  const threadCount = value.threadCount;

  if (
    !isOneOf(SOURCE_KINDS, value.source.kind) ||
    typeof text !== "string" ||
    text.trim().length === 0 ||
    text.length > MAX_SOURCE_CHARACTERS ||
    !isOneOf(CONTENT_TYPES, contentType) ||
    !isOneOf(LANGUAGE_MODES, value.language.mode) ||
    !isOneOf(OUTPUT_LENGTHS, value.length) ||
    !isStyleId(value.styleId) ||
    typeof candidateCount !== "number" ||
    !Number.isInteger(candidateCount) ||
    candidateCount < 1 ||
    candidateCount > 5
  ) {
    return false;
  }

  const customLength = value.customLength;
  if (value.length === "custom") {
    const bounds = getCustomLengthBounds(contentType);
    if (
      typeof customLength !== "number" ||
      !Number.isInteger(customLength) ||
      customLength < bounds.min ||
      customLength > bounds.max
    ) {
      return false;
    }
  } else if (customLength !== undefined) {
    return false;
  }

  if (
    (contentType === "reply" &&
      value.intent !== undefined &&
      !isOneOf(REPLY_INTENTS, value.intent)) ||
    (contentType === "quote" &&
      value.intent !== undefined &&
      !isOneOf(QUOTE_INTENTS, value.intent)) ||
    (contentType !== "reply" && contentType !== "quote" && value.intent !== undefined)
  ) {
    return false;
  }

  if (
    value.language.mode === "fixed" &&
    (typeof value.language.value !== "string" ||
      value.language.value.trim().length === 0 ||
      value.language.value.length > 80)
  ) {
    return false;
  }

  if (
    (contentType === "thread" &&
      (!Number.isInteger(threadCount) ||
        typeof threadCount !== "number" ||
        threadCount < 2 ||
        threadCount > 20 ||
        candidateCount !== 1)) ||
    (contentType === "long-post" && candidateCount !== 1)
  ) {
    return false;
  }

  return (
    isOptionalText(value.audience, 500) &&
    isOptionalText(value.goal, 500) &&
    isOptionalText(value.tone, 500) &&
    isOptionalText(value.mustInclude, 1_000) &&
    isOptionalText(value.mustAvoid, 1_000)
  );
};

export const isRegenerationInput = (value: unknown): value is RegenerationInput => {
  if (!isRecordValue(value) || !isGenerationInput(value.input) || !isRecordValue(value.target)) {
    return false;
  }
  const input = value.input;
  const { kind, index, currentTexts } = value.target;
  const kindMatchesInput =
    (kind === "candidate" && input.contentType !== "thread") ||
    (kind === "thread-post" && input.contentType === "thread");
  return (
    kindMatchesInput &&
    typeof index === "number" &&
    Number.isInteger(index) &&
    Array.isArray(currentTexts) &&
    currentTexts.length > 0 &&
    currentTexts.length <= 20 &&
    index >= 0 &&
    index < currentTexts.length &&
    currentTexts.every((text) => {
      const maximum = input.contentType === "long-post" ? 25_000 : 20_000;
      return typeof text === "string" && text.trim().length > 0 && text.length <= maximum;
    })
  );
};
