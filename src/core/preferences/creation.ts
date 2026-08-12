import { isStyleId } from "../prompts/styles";
import {
  QUOTE_INTENTS,
  REPLY_INTENTS,
  type QuoteIntent,
  type ReplyIntent,
} from "../generation/types";
import { OUTPUT_LANGUAGE_IDS, type OutputLanguageId } from "../generation/languages";

export const CREATION_PREFERENCE_LANGUAGES = ["follow-source", ...OUTPUT_LANGUAGE_IDS] as const;
export const PRESET_OUTPUT_LENGTHS = ["short", "medium", "long"] as const;

export type CreationPreferenceLanguage = "follow-source" | OutputLanguageId;
export type PresetOutputLength = (typeof PRESET_OUTPUT_LENGTHS)[number];

export interface CreationPreferencesV1 {
  schemaVersion: 1;
  defaultStyleId: string;
  inline: {
    candidateCount: number;
    length: PresetOutputLength;
    language: CreationPreferenceLanguage;
    replyIntent: ReplyIntent;
    quoteIntent: QuoteIntent;
  };
  create: {
    candidateCount: number;
    threadCount: number;
    length: PresetOutputLength;
    language: CreationPreferenceLanguage;
  };
}

export const createDefaultCreationPreferences = (): CreationPreferencesV1 => ({
  schemaVersion: 1,
  defaultStyleId: "professional",
  inline: {
    candidateCount: 2,
    length: "medium",
    language: "follow-source",
    replyIntent: "agree-and-add",
    quoteIntent: "comment",
  },
  create: {
    candidateCount: 3,
    threadCount: 5,
    length: "medium",
    language: "follow-source",
  },
});

const isOneOf = <T extends readonly string[]>(values: T, value: unknown): value is T[number] =>
  typeof value === "string" && values.some((item) => item === value);

const isIntegerInRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

export const isCreationPreferencesV1 = (value: unknown): value is CreationPreferencesV1 => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const preferences = value as Record<string, unknown>;
  const inline = preferences.inline;
  const create = preferences.create;
  if (
    preferences.schemaVersion !== 1 ||
    !isStyleId(preferences.defaultStyleId) ||
    typeof inline !== "object" ||
    inline === null ||
    Array.isArray(inline) ||
    typeof create !== "object" ||
    create === null ||
    Array.isArray(create)
  ) {
    return false;
  }
  const inlineValues = inline as Record<string, unknown>;
  const createValues = create as Record<string, unknown>;
  return (
    isIntegerInRange(inlineValues.candidateCount, 1, 5) &&
    isOneOf(PRESET_OUTPUT_LENGTHS, inlineValues.length) &&
    isOneOf(CREATION_PREFERENCE_LANGUAGES, inlineValues.language) &&
    isOneOf(REPLY_INTENTS, inlineValues.replyIntent) &&
    isOneOf(QUOTE_INTENTS, inlineValues.quoteIntent) &&
    isIntegerInRange(createValues.candidateCount, 1, 5) &&
    isIntegerInRange(createValues.threadCount, 2, 20) &&
    isOneOf(PRESET_OUTPUT_LENGTHS, createValues.length) &&
    isOneOf(CREATION_PREFERENCE_LANGUAGES, createValues.language)
  );
};
