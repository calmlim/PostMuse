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

export interface CreationPreferencesV2 {
  schemaVersion: 2;
  fastMode: boolean;
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

export const createDefaultCreationPreferences = (): CreationPreferencesV2 => ({
  schemaVersion: 2,
  fastMode: true,
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

const hasValidCreationValues = (preferences: Record<string, unknown>): boolean => {
  const inline = preferences.inline;
  const create = preferences.create;
  if (
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

export const isCreationPreferencesV2 = (value: unknown): value is CreationPreferencesV2 => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const preferences = value as Record<string, unknown>;
  return (
    preferences.schemaVersion === 2 &&
    typeof preferences.fastMode === "boolean" &&
    hasValidCreationValues(preferences)
  );
};

export const migrateCreationPreferences = (value: unknown): CreationPreferencesV2 | undefined => {
  if (isCreationPreferencesV2(value)) {
    return value;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const preferences = value as Record<string, unknown>;
  if (preferences.schemaVersion !== 1 || !hasValidCreationValues(preferences)) {
    return undefined;
  }
  return {
    ...(preferences as unknown as Omit<CreationPreferencesV2, "schemaVersion" | "fastMode">),
    schemaVersion: 2,
    fastMode: true,
  };
};
