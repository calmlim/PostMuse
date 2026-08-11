import type { Locale } from "../../i18n";

export const PROVIDER_IDS = ["openai-compatible", "anthropic", "gemini", "xai"] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];
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

export interface SettingsV1 {
  schemaVersion: 1;
  uiLocale: Locale;
  activeTextProviderProfileId: string;
  textProviderProfiles: ProviderProfile[];
}

export interface SecretStatus {
  hasKey: boolean;
  persistence?: SecretPersistence;
}

export interface SettingsSnapshot {
  settings: SettingsV1;
  activeSecretStatus: SecretStatus;
}

export interface MockConnectionResult {
  mode: "mock";
  provider: ProviderId;
  model: string;
  checkedAt: string;
}
