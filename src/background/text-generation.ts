import { AppError } from "../core/errors/app-error";
import { parseGenerationOutput } from "../core/generation/parser";
import type { GenerationInput, GenerationResult } from "../core/generation/types";
import { buildTextGenerationRequest } from "../core/prompts/prompt-builder";
import type { ProviderProfile } from "../core/settings/types";
import { getTextProviderAdapter } from "../providers/text";

export const generateText = async (
  input: GenerationInput,
  profile: ProviderProfile,
  apiKey: string | undefined,
  signal: AbortSignal,
): Promise<GenerationResult> => {
  if (!profile.model.trim()) {
    throw new AppError("MODEL_REQUIRED", "Choose a model before generating.");
  }
  if (!apiKey) {
    throw new AppError("API_KEY_REQUIRED", "Add an API key before generating.");
  }

  const request = buildTextGenerationRequest(input);
  const response = await getTextProviderAdapter(profile.provider).generate(request, {
    profile,
    apiKey,
    signal,
  });

  return parseGenerationOutput(response.text, input, {
    provider: profile.provider,
    model: profile.model.trim(),
  });
};
