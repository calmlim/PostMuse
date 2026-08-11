import type { MockConnectionResult, ProviderProfile, SettingsSnapshot } from "../settings/types";
import { isProviderProfile, isRecordValue } from "../settings/validation";

export const MESSAGE_TYPES = ["settings.get", "settings.saveProfile", "provider.test"] as const;

export type MessageType = (typeof MESSAGE_TYPES)[number];

export type ExtensionRequest =
  | { type: "settings.get"; requestId: string }
  | {
      type: "settings.saveProfile";
      requestId: string;
      profile: ProviderProfile;
      apiKey?: string;
    }
  | { type: "provider.test"; requestId: string; profileId: string };

export interface ExtensionError {
  code: ExtensionErrorCode;
  message: string;
}

export type ExtensionErrorCode =
  | "INVALID_REQUEST"
  | "UNTRUSTED_SENDER"
  | "PROFILE_NOT_FOUND"
  | "API_KEY_REQUIRED"
  | "API_KEY_REENTRY_REQUIRED"
  | "MODEL_REQUIRED"
  | "HOST_PERMISSION_REQUIRED"
  | "INTERNAL_ERROR";

export type ExtensionResponse<T> = { ok: true; data: T } | { ok: false; error: ExtensionError };

export interface ExtensionResponseMap {
  "settings.get": SettingsSnapshot;
  "settings.saveProfile": SettingsSnapshot;
  "provider.test": MockConnectionResult;
}

const hasValidEnvelope = (value: unknown): value is Record<string, unknown> =>
  isRecordValue(value) &&
  typeof value.type === "string" &&
  MESSAGE_TYPES.some((type) => type === value.type) &&
  typeof value.requestId === "string" &&
  value.requestId.length > 0 &&
  value.requestId.length <= 100;

export const isExtensionRequest = (value: unknown): value is ExtensionRequest => {
  if (!hasValidEnvelope(value)) {
    return false;
  }

  if (value.type === "settings.get") {
    return true;
  }

  if (value.type === "settings.saveProfile") {
    return (
      isProviderProfile(value.profile) &&
      (value.apiKey === undefined ||
        (typeof value.apiKey === "string" && value.apiKey.length <= 2048))
    );
  }

  return (
    value.type === "provider.test" &&
    typeof value.profileId === "string" &&
    value.profileId.length > 0 &&
    value.profileId.length <= 80
  );
};

export const createRequestId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
