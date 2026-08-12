import { AppError } from "../core/errors/app-error";
import type { ImageGenerationInput, ImageGenerationResult } from "../core/image/types";
import type { ImageProviderProfile } from "../core/settings/types";
import { getImageProviderAdapter } from "../providers/image";
import { conformImageOutput } from "./image-output";

export const generateImage = async (
  input: ImageGenerationInput,
  profile: ImageProviderProfile,
  apiKey: string | undefined,
  signal: AbortSignal,
): Promise<ImageGenerationResult> => {
  if (!profile.model.trim()) {
    throw new AppError("MODEL_REQUIRED", "Choose an image model before generating.");
  }
  if (!apiKey) {
    throw new AppError("API_KEY_REQUIRED", "Add an image API key before generating.");
  }

  const result = await getImageProviderAdapter(profile.provider).generate(input, {
    profile,
    apiKey,
    signal,
  });
  return conformImageOutput(result, input);
};
