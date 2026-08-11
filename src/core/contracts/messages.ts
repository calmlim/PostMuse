import type {
  ImageProviderProfile,
  ConnectionTestResult,
  ProviderPermissionSummary,
  ProviderProfile,
  SettingsSnapshot,
} from "../settings/types";
import { isImageProviderProfile, isProviderProfile, isRecordValue } from "../settings/validation";
import type {
  GenerationInput,
  GenerationResult,
  RegenerationInput,
  RegenerationResult,
} from "../generation/types";
import { isGenerationInput, isRegenerationInput } from "../generation/validation";
import type { ImageGenerationInput, ImageGenerationResult } from "../image/types";
import { isImageGenerationInput } from "../image/validation";

export const MESSAGE_TYPES = [
  "settings.get",
  "settings.saveProfile",
  "settings.saveImageProfile",
  "provider.test",
  "text.generate",
  "text.regenerate",
  "text.cancel",
  "image.generate",
  "image.cancel",
  "data.deleteKeys",
  "data.revokeOrigins",
  "data.reset",
  "inline.bootstrap",
  "inline.generate",
  "inline.cancel",
  "inline.openSidePanel",
] as const;

export type MessageType = (typeof MESSAGE_TYPES)[number];

export type ExtensionRequest =
  | { type: "settings.get"; requestId: string }
  | {
      type: "settings.saveProfile";
      requestId: string;
      profile: ProviderProfile;
      apiKey?: string;
    }
  | {
      type: "settings.saveImageProfile";
      requestId: string;
      profile: ImageProviderProfile;
      apiKey?: string;
    }
  | { type: "provider.test"; requestId: string; profileId: string }
  | { type: "text.generate"; requestId: string; input: GenerationInput }
  | { type: "text.regenerate"; requestId: string; input: RegenerationInput }
  | { type: "text.cancel"; requestId: string; targetRequestId: string }
  | { type: "image.generate"; requestId: string; input: ImageGenerationInput }
  | { type: "image.cancel"; requestId: string; targetRequestId: string }
  | { type: "data.deleteKeys"; requestId: string }
  | { type: "data.revokeOrigins"; requestId: string }
  | { type: "data.reset"; requestId: string }
  | { type: "inline.bootstrap"; requestId: string }
  | { type: "inline.generate"; requestId: string; input: GenerationInput }
  | { type: "inline.cancel"; requestId: string; targetRequestId: string }
  | { type: "inline.openSidePanel"; requestId: string; input?: GenerationInput };

export interface InlineBootstrap {
  locale: "en" | "zh-CN";
  configured: boolean;
  providerDisplayName: string;
  model: string;
  styles: Array<{ id: string; label: string; version: number; isBuiltInDefault: boolean }>;
}

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
  | "STYLE_NOT_FOUND"
  | "HOST_PERMISSION_REQUIRED"
  | "AUTH_INVALID"
  | "MODEL_FORBIDDEN"
  | "MODEL_NOT_FOUND"
  | "ENDPOINT_NOT_FOUND"
  | "PROVIDER_REQUEST_INVALID"
  | "RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "CONTENT_REJECTED"
  | "OUTPUT_INVALID"
  | "REQUEST_CANCELLED"
  | "INTERNAL_ERROR";

export type ExtensionResponse<T> = { ok: true; data: T } | { ok: false; error: ExtensionError };

export interface ExtensionResponseMap {
  "settings.get": SettingsSnapshot;
  "settings.saveProfile": SettingsSnapshot;
  "settings.saveImageProfile": SettingsSnapshot;
  "provider.test": ConnectionTestResult;
  "text.generate": GenerationResult;
  "text.regenerate": RegenerationResult;
  "text.cancel": { cancelled: boolean };
  "image.generate": ImageGenerationResult;
  "image.cancel": { cancelled: boolean };
  "data.deleteKeys": SettingsSnapshot;
  "data.revokeOrigins": ProviderPermissionSummary;
  "data.reset": { snapshot: SettingsSnapshot; remainingOriginCount: number };
  "inline.bootstrap": InlineBootstrap;
  "inline.generate": GenerationResult;
  "inline.cancel": { cancelled: boolean };
  "inline.openSidePanel": { opened: true };
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

  if (
    value.type === "settings.get" ||
    value.type === "data.deleteKeys" ||
    value.type === "data.revokeOrigins" ||
    value.type === "data.reset" ||
    value.type === "inline.bootstrap"
  ) {
    return true;
  }

  if (value.type === "settings.saveProfile") {
    return (
      isProviderProfile(value.profile) &&
      (value.apiKey === undefined ||
        (typeof value.apiKey === "string" && value.apiKey.length <= 2048))
    );
  }

  if (value.type === "settings.saveImageProfile") {
    return (
      isImageProviderProfile(value.profile) &&
      (value.apiKey === undefined ||
        (typeof value.apiKey === "string" && value.apiKey.length <= 2048))
    );
  }

  if (value.type === "text.generate" || value.type === "inline.generate") {
    return isGenerationInput(value.input);
  }

  if (value.type === "text.regenerate") {
    return isRegenerationInput(value.input);
  }

  if (value.type === "image.generate") {
    return isImageGenerationInput(value.input);
  }

  if (value.type === "inline.openSidePanel") {
    return value.input === undefined || isGenerationInput(value.input);
  }

  if (
    value.type === "text.cancel" ||
    value.type === "image.cancel" ||
    value.type === "inline.cancel"
  ) {
    return (
      typeof value.targetRequestId === "string" &&
      value.targetRequestId.length > 0 &&
      value.targetRequestId.length <= 100
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
