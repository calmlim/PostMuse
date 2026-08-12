import { detectPreferredLocale, type Locale } from "../../i18n";
import { IMAGE_PROVIDER_DEFINITIONS, PROVIDER_DEFINITIONS } from "./provider-catalog";
import type { ImageProviderProfile, ProviderProfile, SettingsV3 } from "./types";

export const DEFAULT_PROFILE_ID = "default-text-provider";
export const DEFAULT_IMAGE_PROFILE_ID = "default-image-provider";

export const createDefaultProviderProfile = (): ProviderProfile => ({
  id: DEFAULT_PROFILE_ID,
  displayName: "OpenAI-compatible",
  provider: "openai-compatible",
  model: "",
  baseUrl: PROVIDER_DEFINITIONS["openai-compatible"].defaultBaseUrl,
  samplingMode: "provider-default",
  temperature: 0.7,
  maxOutputTokens: 1200,
  keyPersistence: "session",
});

export const createDefaultImageProviderProfile = (): ImageProviderProfile => ({
  id: DEFAULT_IMAGE_PROFILE_ID,
  displayName: IMAGE_PROVIDER_DEFINITIONS.openai.label,
  provider: "openai",
  model: IMAGE_PROVIDER_DEFINITIONS.openai.defaultModel,
  baseUrl: IMAGE_PROVIDER_DEFINITIONS.openai.defaultBaseUrl,
  keyPersistence: "session",
});

export const createDefaultSettings = (uiLocale: Locale = detectPreferredLocale()): SettingsV3 => ({
  schemaVersion: 3,
  uiLocale,
  activeTextProviderProfileId: DEFAULT_PROFILE_ID,
  textProviderProfiles: [createDefaultProviderProfile()],
  activeImageProviderProfileId: DEFAULT_IMAGE_PROFILE_ID,
  imageProviderProfiles: [createDefaultImageProviderProfile()],
});
