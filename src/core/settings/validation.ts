import { isLocale } from "../../i18n";
import { isProviderId, normalizeBaseUrl } from "./provider-catalog";
import type { ProviderProfile, SecretPersistence, SettingsV1 } from "./types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSecretPersistence = (value: unknown): value is SecretPersistence =>
  value === "session" || value === "local";

export const isProviderProfile = (value: unknown): value is ProviderProfile => {
  if (!isRecord(value)) {
    return false;
  }

  try {
    normalizeBaseUrl(String(value.baseUrl ?? ""), { allowInsecureLocalhost: true });
  } catch {
    return false;
  }

  return (
    typeof value.id === "string" &&
    value.id.length > 0 &&
    value.id.length <= 80 &&
    typeof value.displayName === "string" &&
    value.displayName.length > 0 &&
    value.displayName.length <= 80 &&
    isProviderId(value.provider) &&
    typeof value.model === "string" &&
    value.model.length <= 160 &&
    typeof value.baseUrl === "string" &&
    typeof value.temperature === "number" &&
    Number.isFinite(value.temperature) &&
    value.temperature >= 0 &&
    value.temperature <= 2 &&
    typeof value.maxOutputTokens === "number" &&
    Number.isInteger(value.maxOutputTokens) &&
    value.maxOutputTokens >= 1 &&
    value.maxOutputTokens <= 100000 &&
    isSecretPersistence(value.keyPersistence)
  );
};

export const isSettingsV1 = (value: unknown): value is SettingsV1 => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.schemaVersion === 1 &&
    isLocale(value.uiLocale) &&
    typeof value.activeTextProviderProfileId === "string" &&
    Array.isArray(value.textProviderProfiles) &&
    value.textProviderProfiles.length > 0 &&
    value.textProviderProfiles.every(isProviderProfile) &&
    value.textProviderProfiles.some((profile) => profile.id === value.activeTextProviderProfileId)
  );
};

export const isRecordValue = isRecord;
