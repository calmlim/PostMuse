import { AppError } from "../core/errors/app-error";
import type { ProviderProfile } from "../core/settings/types";
import {
  buildTranslationRequest,
  getTranslationSuggestedOutputTokens,
  isSameTranslationLanguage,
} from "../core/translation/request-builder";
import type {
  TranslationInput,
  TranslationPreferencesV2,
  TranslationResult,
} from "../core/translation/types";
import { getTextProviderAdapter } from "../providers/text";
import {
  createTranslationCacheKey,
  getCachedTranslation,
  saveCachedTranslation,
} from "../storage/translation-cache";

export const translateText = async (
  input: TranslationInput,
  preferences: TranslationPreferencesV2,
  profile: ProviderProfile,
  apiKey: string | undefined,
  signal: AbortSignal,
  force = false,
): Promise<TranslationResult> => {
  if (isSameTranslationLanguage(input.sourceLanguageHint, preferences.targetLanguage)) {
    return { status: "same-language", targetLanguage: preferences.targetLanguage };
  }
  if (!profile.model.trim()) {
    throw new AppError("MODEL_REQUIRED", "Choose a model before translating.");
  }
  if (!apiKey) {
    throw new AppError("API_KEY_REQUIRED", "Add an API key before translating.");
  }

  const cacheKey = await createTranslationCacheKey({
    sourceText: input.text,
    targetLanguage: preferences.targetLanguage,
    provider: profile.provider,
    model: profile.model.trim(),
    fastMode: preferences.fastMode,
  });
  const outputLimitMayBeLow =
    profile.maxOutputTokens < getTranslationSuggestedOutputTokens(input.text);
  if (!force) {
    const cached = await getCachedTranslation(cacheKey);
    if (cached) {
      return { status: "translated", ...cached, cached: true, outputLimitMayBeLow };
    }
  }

  const request = buildTranslationRequest(
    input,
    preferences.targetLanguage,
    profile.maxOutputTokens,
    preferences.fastMode,
  );
  const response = await getTextProviderAdapter(profile.provider).generate(request, {
    profile,
    apiKey,
    signal,
    purpose: "translation",
  });
  const text = response.text.trim();
  if (!text) {
    throw new AppError("OUTPUT_INVALID", "The Provider returned an empty translation.");
  }
  await saveCachedTranslation({
    key: cacheKey,
    text,
    targetLanguage: preferences.targetLanguage,
    provider: profile.provider,
    model: profile.model.trim(),
  });
  return {
    status: "translated",
    text,
    targetLanguage: preferences.targetLanguage,
    provider: profile.provider,
    model: profile.model.trim(),
    cached: false,
    outputLimitMayBeLow,
  };
};
