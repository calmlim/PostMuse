import { isLocale } from "../../i18n/locale";
import { isImageProviderId, isProviderId, normalizeBaseUrl } from "./provider-catalog";
import { supportsInsecureLocalhost } from "./runtime-capabilities";
import type {
  ImageProviderProfile,
  ProviderProfile,
  SamplingMode,
  SecretPersistence,
  SettingsV3,
} from "./types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSecretPersistence = (value: unknown): value is SecretPersistence =>
  value === "session" || value === "local";

const isSamplingMode = (value: unknown): value is SamplingMode =>
  value === "provider-default" || value === "custom";

export const isProviderProfile = (value: unknown): value is ProviderProfile => {
  if (!isRecord(value)) {
    return false;
  }

  try {
    normalizeBaseUrl(String(value.baseUrl ?? ""), {
      allowInsecureLocalhost: supportsInsecureLocalhost(),
    });
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
    isSamplingMode(value.samplingMode) &&
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

export const isImageProviderProfile = (value: unknown): value is ImageProviderProfile => {
  if (!isRecord(value)) {
    return false;
  }

  try {
    normalizeBaseUrl(String(value.baseUrl ?? ""), {
      allowInsecureLocalhost: supportsInsecureLocalhost(),
    });
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
    isImageProviderId(value.provider) &&
    typeof value.model === "string" &&
    value.model.length <= 160 &&
    typeof value.baseUrl === "string" &&
    isSecretPersistence(value.keyPersistence)
  );
};

export interface LegacySettingsV1 {
  schemaVersion: 1;
  uiLocale: SettingsV3["uiLocale"];
  activeTextProviderProfileId: string;
  textProviderProfiles: LegacyProviderProfileV2[];
}

export const isLegacySettingsV1 = (value: unknown): value is LegacySettingsV1 => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.schemaVersion === 1 &&
    isLocale(value.uiLocale) &&
    typeof value.activeTextProviderProfileId === "string" &&
    Array.isArray(value.textProviderProfiles) &&
    value.textProviderProfiles.length > 0 &&
    value.textProviderProfiles.every(isLegacyProviderProfileV2) &&
    value.textProviderProfiles.some((profile) => profile.id === value.activeTextProviderProfileId)
  );
};

export interface LegacyProviderProfileV2 extends Omit<ProviderProfile, "samplingMode"> {}

export interface LegacySettingsV2 {
  schemaVersion: 2;
  uiLocale: SettingsV3["uiLocale"];
  activeTextProviderProfileId: string;
  textProviderProfiles: LegacyProviderProfileV2[];
  activeImageProviderProfileId: string;
  imageProviderProfiles: ImageProviderProfile[];
}

const isLegacyProviderProfileV2 = (value: unknown): value is LegacyProviderProfileV2 =>
  isRecord(value) && isProviderProfile({ ...value, samplingMode: "provider-default" });

export const isSettingsV2 = (value: unknown): value is LegacySettingsV2 => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.schemaVersion === 2 &&
    isLocale(value.uiLocale) &&
    typeof value.activeTextProviderProfileId === "string" &&
    Array.isArray(value.textProviderProfiles) &&
    value.textProviderProfiles.length > 0 &&
    value.textProviderProfiles.every(isLegacyProviderProfileV2) &&
    value.textProviderProfiles.some(
      (profile) => profile.id === value.activeTextProviderProfileId,
    ) &&
    typeof value.activeImageProviderProfileId === "string" &&
    Array.isArray(value.imageProviderProfiles) &&
    value.imageProviderProfiles.length > 0 &&
    value.imageProviderProfiles.every(isImageProviderProfile) &&
    value.imageProviderProfiles.some((profile) => profile.id === value.activeImageProviderProfileId)
  );
};

export const isSettingsV3 = (value: unknown): value is SettingsV3 => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.schemaVersion === 3 &&
    isLocale(value.uiLocale) &&
    typeof value.activeTextProviderProfileId === "string" &&
    Array.isArray(value.textProviderProfiles) &&
    value.textProviderProfiles.length > 0 &&
    value.textProviderProfiles.every(isProviderProfile) &&
    value.textProviderProfiles.some(
      (profile) => profile.id === value.activeTextProviderProfileId,
    ) &&
    typeof value.activeImageProviderProfileId === "string" &&
    Array.isArray(value.imageProviderProfiles) &&
    value.imageProviderProfiles.length > 0 &&
    value.imageProviderProfiles.every(isImageProviderProfile) &&
    value.imageProviderProfiles.some((profile) => profile.id === value.activeImageProviderProfileId)
  );
};

export const isRecordValue = isRecord;
