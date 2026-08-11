import { DEFAULT_LOCALE, type Locale } from "../../i18n";
import { PROVIDER_DEFINITIONS } from "./provider-catalog";
import type { ProviderProfile, SettingsV1 } from "./types";

export const DEFAULT_PROFILE_ID = "default-text-provider";

export const createDefaultProviderProfile = (): ProviderProfile => ({
  id: DEFAULT_PROFILE_ID,
  displayName: "OpenAI-compatible",
  provider: "openai-compatible",
  model: "",
  baseUrl: PROVIDER_DEFINITIONS["openai-compatible"].defaultBaseUrl,
  temperature: 0.7,
  maxOutputTokens: 1200,
  keyPersistence: "session",
});

export const createDefaultSettings = (uiLocale: Locale = DEFAULT_LOCALE): SettingsV1 => ({
  schemaVersion: 1,
  uiLocale,
  activeTextProviderProfileId: DEFAULT_PROFILE_ID,
  textProviderProfiles: [createDefaultProviderProfile()],
});
