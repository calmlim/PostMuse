import { geminiImageAdapter } from "./gemini";
import { openAIImageAdapter } from "./openai";
import type { ImageProviderAdapter } from "./types";

const adapters: Record<ImageProviderAdapter["id"], ImageProviderAdapter> = {
  openai: openAIImageAdapter,
  gemini: geminiImageAdapter,
};

export const getImageProviderAdapter = (
  provider: ImageProviderAdapter["id"],
): ImageProviderAdapter => adapters[provider];
