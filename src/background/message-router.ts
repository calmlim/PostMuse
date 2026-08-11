import type {
  ExtensionRequest,
  ExtensionResponse,
  ExtensionResponseMap,
} from "../core/contracts/messages";
import { isExtensionRequest } from "../core/contracts/messages";
import { AppError, toExtensionError } from "../core/errors/app-error";
import {
  getActiveProviderProfile,
  loadSettings,
  upsertProviderProfile,
} from "../storage/settings-repository";
import { getSecretStatus, readApiKey, saveApiKey } from "../storage/secrets-repository";
import { runMockConnectionTest } from "./mock-provider-tester";
import { hasProviderOriginPermission } from "./permissions";

type AnyExtensionResponse = ExtensionResponse<ExtensionResponseMap[keyof ExtensionResponseMap]>;

export const isTrustedExtensionSender = (sender: chrome.runtime.MessageSender): boolean => {
  const extensionRoot = chrome.runtime.getURL("");
  return (
    sender.id === chrome.runtime.id &&
    sender.tab === undefined &&
    typeof sender.url === "string" &&
    sender.url.startsWith(extensionRoot)
  );
};

const getSnapshot = async () => {
  const settings = await loadSettings();
  const profile = getActiveProviderProfile(settings);
  return {
    settings,
    activeSecretStatus: await getSecretStatus(profile.id),
  };
};

const handleRequest = async (request: ExtensionRequest): Promise<AnyExtensionResponse> => {
  if (request.type === "settings.get") {
    return { ok: true, data: await getSnapshot() };
  }

  if (request.type === "settings.saveProfile") {
    const currentStatus = await getSecretStatus(request.profile.id);
    const apiKey = request.apiKey?.trim();

    if (
      currentStatus.hasKey &&
      currentStatus.persistence !== request.profile.keyPersistence &&
      !apiKey
    ) {
      throw new AppError(
        "API_KEY_REENTRY_REQUIRED",
        "Re-enter the API key when changing how it is stored.",
      );
    }

    await upsertProviderProfile(request.profile);
    if (apiKey) {
      await saveApiKey(request.profile.id, apiKey, request.profile.keyPersistence);
    }

    return { ok: true, data: await getSnapshot() };
  }

  const settings = await loadSettings();
  const profile = settings.textProviderProfiles.find((item) => item.id === request.profileId);
  if (!profile) {
    throw new AppError("PROFILE_NOT_FOUND", "The selected provider profile was not found.");
  }

  if (!(await hasProviderOriginPermission(profile.baseUrl))) {
    throw new AppError(
      "HOST_PERMISSION_REQUIRED",
      "Allow access to the provider host before testing the setup.",
    );
  }

  const apiKey = await readApiKey(profile.id, profile.keyPersistence);
  return { ok: true, data: runMockConnectionTest(profile, apiKey) };
};

export const routeExtensionMessage = async (
  message: unknown,
  sender: chrome.runtime.MessageSender,
): Promise<AnyExtensionResponse> => {
  try {
    if (!isTrustedExtensionSender(sender)) {
      throw new AppError("UNTRUSTED_SENDER", "This request is not available from web pages.");
    }

    if (!isExtensionRequest(message)) {
      throw new AppError("INVALID_REQUEST", "The extension request was invalid.");
    }

    return await handleRequest(message);
  } catch (error) {
    return { ok: false, error: toExtensionError(error) };
  }
};

export const registerMessageRouter = (securityReady: Promise<void>): void => {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    void securityReady
      .then(() => routeExtensionMessage(message, sender))
      .then(sendResponse)
      .catch((error: unknown) => sendResponse({ ok: false, error: toExtensionError(error) }));
    return true;
  });
};
