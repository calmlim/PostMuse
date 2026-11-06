import type { OutputLanguageId } from "../generation/languages";
import type { ProviderId } from "../settings/types";

export const TRANSLATION_DISPLAY_MODES = ["below", "replace"] as const;
export type TranslationDisplayMode = (typeof TRANSLATION_DISPLAY_MODES)[number];

export interface TranslationPreferencesV2 {
  schemaVersion: 2;
  targetLanguage: OutputLanguageId;
  displayMode: TranslationDisplayMode;
  translationModel: string;
  fastMode: boolean;
}

export interface TranslationInput {
  text: string;
  sourceLanguageHint?: string;
}

export type TranslationResult =
  | {
      status: "translated";
      text: string;
      targetLanguage: OutputLanguageId;
      provider: ProviderId;
      model: string;
      cached: boolean;
      outputLimitMayBeLow: boolean;
    }
  | {
      status: "same-language";
      targetLanguage: OutputLanguageId;
    };
