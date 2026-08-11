import type { ProviderId } from "../../core/settings/types";
import { anthropicAdapter } from "./anthropic";
import { geminiAdapter } from "./gemini";
import { openAICompatibleAdapter } from "./openai-compatible";
import type { TextProviderAdapter } from "./types";
import { xAIAdapter } from "./xai";

const adapters: Record<ProviderId, TextProviderAdapter> = {
  "openai-compatible": openAICompatibleAdapter,
  anthropic: anthropicAdapter,
  gemini: geminiAdapter,
  xai: xAIAdapter,
};

export const getTextProviderAdapter = (provider: ProviderId): TextProviderAdapter =>
  adapters[provider];
