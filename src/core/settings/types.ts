import type { Locale } from "../../i18n";

export const PROVIDER_IDS = ["openai-compatible", "anthropic", "gemini", "xai"] as const;
export const IMAGE_PROVIDER_IDS = ["openai", "gemini"] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];
export type ImageProviderId = (typeof IMAGE_PROVIDER_IDS)[number];
export type SecretPersistence = "session" | "local";

export interface ProviderProfile {
  id: string;
  displayName: string;
  provider: ProviderId;
  model: string;
  baseUrl: string;
  temperature: number;
  maxOutputTokens: number;
  keyPersistence: SecretPersistence;
}

export interface ImageProviderProfile {
  id: string;
  displayName: string;
  provider: ImageProviderId;
  model: string;
  baseUrl: string;
  keyPersistence: SecretPersistence;
}

export interface SettingsV2 {
  schemaVersion: 2;
  uiLocale: Locale;
  activeTextProviderProfileId: string;
  textProviderProfiles: ProviderProfile[];
  activeImageProviderProfileId: string;
  imageProviderProfiles: ImageProviderProfile[];
}

export interface SecretStatus {
  hasKey: boolean;
  persistence?: SecretPersistence;
}

export interface SettingsSnapshot {
  settings: SettingsV2;
  activeSecretStatus: SecretStatus;
  activeImageSecretStatus: SecretStatus;
}

export interface MockConnectionResult {
  mode: "mock";
  provider: ProviderId;
  model: string;
  checkedAt: string;
}
