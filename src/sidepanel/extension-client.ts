import {
  createRequestId,
  type ExtensionResponse,
  type ExtensionResponseMap,
} from "../core/contracts/messages";
import { getOriginPattern } from "../core/settings/provider-catalog";
import type { ProviderProfile } from "../core/settings/types";
import type { GenerationInput } from "../core/generation/types";

type ExtensionRequestInput =
  | { type: "settings.get" }
  | { type: "settings.saveProfile"; profile: ProviderProfile; apiKey?: string }
  | { type: "provider.test"; profileId: string }
  | { type: "text.generate"; input: GenerationInput }
  | { type: "text.cancel"; targetRequestId: string };

export function sendExtensionRequest(
  request: Extract<ExtensionRequestInput, { type: "settings.get" }>,
): Promise<ExtensionResponseMap["settings.get"]>;
export function sendExtensionRequest(
  request: Extract<ExtensionRequestInput, { type: "settings.saveProfile" }>,
): Promise<ExtensionResponseMap["settings.saveProfile"]>;
export function sendExtensionRequest(
  request: Extract<ExtensionRequestInput, { type: "provider.test" }>,
  options?: { requestId?: string },
): Promise<ExtensionResponseMap["provider.test"]>;
export function sendExtensionRequest(
  request: Extract<ExtensionRequestInput, { type: "text.generate" }>,
  options?: { requestId?: string },
): Promise<ExtensionResponseMap["text.generate"]>;
export function sendExtensionRequest(
  request: Extract<ExtensionRequestInput, { type: "text.cancel" }>,
  options?: { requestId?: string },
): Promise<ExtensionResponseMap["text.cancel"]>;
export async function sendExtensionRequest(
  request: ExtensionRequestInput,
  options: { requestId?: string } = {},
): Promise<ExtensionResponseMap[keyof ExtensionResponseMap]> {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    throw new Error("Extension runtime is unavailable.");
  }

  const response = (await chrome.runtime.sendMessage({
    ...request,
    requestId: options.requestId ?? createRequestId(),
  })) as ExtensionResponse<ExtensionResponseMap[keyof ExtensionResponseMap]>;

  if (!response?.ok) {
    const error = new Error(response?.error.message ?? "The extension request failed.");
    error.name = response?.error.code ?? "INTERNAL_ERROR";
    throw error;
  }

  return response.data;
}

export const requestProviderOriginPermission = (baseUrl: string): Promise<boolean> => {
  if (typeof chrome === "undefined" || !chrome.permissions?.request) {
    return Promise.resolve(false);
  }

  const origin = getOriginPattern(baseUrl, { allowInsecureLocalhost: true });
  return chrome.permissions.request({ origins: [origin] });
};
