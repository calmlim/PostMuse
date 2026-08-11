import type {
  ExtensionRequest,
  ExtensionResponse,
  ExtensionResponseMap,
} from "../core/contracts/messages";
import { isExtensionRequest } from "../core/contracts/messages";
import { AppError, toExtensionError } from "../core/errors/app-error";
import {
  getActiveImageProviderProfile,
  getActiveProviderProfile,
  loadSettings,
  upsertImageProviderProfile,
  upsertProviderProfile,
} from "../storage/settings-repository";
import {
  deleteAllApiKeys,
  getSecretStatus,
  readApiKey,
  saveApiKey,
} from "../storage/secrets-repository";
import { loadHistoryEnabled } from "../storage/history-preferences";
import { saveHistoryRecord } from "../storage/history-repository";
import { savePendingXContext } from "../storage/pending-context";
import { loadResolvedPromptLibrary } from "../storage/prompt-repository";
import { PROMPT_RECIPE_VERSION } from "../core/prompts/prompt-builder";
import { runMockConnectionTest } from "./mock-provider-tester";
import { hasProviderOriginPermission } from "./permissions";
import { generateText } from "./text-generation";
import { generateImage } from "./image-generation";
import { resetPostMuseData } from "../storage/data-reset";

type AnyExtensionResponse = ExtensionResponse<ExtensionResponseMap[keyof ExtensionResponseMap]>;
const activeGenerationRequests = new Map<string, AbortController>();

export const isTrustedExtensionSender = (sender: chrome.runtime.MessageSender): boolean => {
  const extensionRoot = chrome.runtime.getURL("");
  return (
    sender.id === chrome.runtime.id &&
    sender.tab === undefined &&
    typeof sender.url === "string" &&
    sender.url.startsWith(extensionRoot)
  );
};

export const isTrustedXContentSender = (sender: chrome.runtime.MessageSender): boolean => {
  if (sender.id !== chrome.runtime.id || sender.tab?.id === undefined || !sender.url) {
    return false;
  }
  try {
    return new URL(sender.url).origin === "https://x.com";
  } catch {
    return false;
  }
};

const isInlineMessage = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { type?: unknown }).type === "string" &&
  (value as { type: string }).type.startsWith("inline.");

const getSnapshot = async () => {
  const settings = await loadSettings();
  const profile = getActiveProviderProfile(settings);
  const imageProfile = getActiveImageProviderProfile(settings);
  return {
    settings,
    activeSecretStatus: await getSecretStatus(profile.id),
    activeImageSecretStatus: await getSecretStatus(imageProfile.id),
  };
};

const runGeneration = async (
  requestId: string,
  input: Extract<ExtensionRequest, { type: "text.generate" | "inline.generate" }>["input"],
  saveInlineHistory: boolean,
): Promise<AnyExtensionResponse> => {
  if (activeGenerationRequests.has(requestId)) {
    throw new AppError("INVALID_REQUEST", "A request with this id is already running.");
  }

  const controller = new AbortController();
  activeGenerationRequests.set(requestId, controller);
  try {
    const settings = await loadSettings();
    const profile = getActiveProviderProfile(settings);
    if (!(await hasProviderOriginPermission(profile.baseUrl))) {
      throw new AppError(
        "HOST_PERMISSION_REQUIRED",
        "Allow access to the Provider host before generating.",
      );
    }

    const apiKey = await readApiKey(profile.id, profile.keyPersistence);
    const result = await generateText(input, profile, apiKey, controller.signal);
    if (saveInlineHistory && result.format !== "raw" && (await loadHistoryEnabled())) {
      try {
        const style = (await loadResolvedPromptLibrary()).active.find(
          (template) => template.id === input.styleId,
        );
        await saveHistoryRecord(input, result, {
          recipeVersion: PROMPT_RECIPE_VERSION,
          styleTemplateVersion: style?.version ?? 1,
        });
      } catch {
        // A local history failure must not discard a successful Provider result.
      }
    }
    return { ok: true, data: result };
  } finally {
    activeGenerationRequests.delete(requestId);
  }
};

const runImageGeneration = async (
  requestId: string,
  input: Extract<ExtensionRequest, { type: "image.generate" }>["input"],
): Promise<AnyExtensionResponse> => {
  if (activeGenerationRequests.has(requestId)) {
    throw new AppError("INVALID_REQUEST", "A request with this id is already running.");
  }

  const controller = new AbortController();
  activeGenerationRequests.set(requestId, controller);
  try {
    const settings = await loadSettings();
    const profile = getActiveImageProviderProfile(settings);
    if (!(await hasProviderOriginPermission(profile.baseUrl))) {
      throw new AppError(
        "HOST_PERMISSION_REQUIRED",
        "Allow access to the image Provider host before generating.",
      );
    }
    const apiKey = await readApiKey(profile.id, profile.keyPersistence);
    return {
      ok: true,
      data: await generateImage(input, profile, apiKey, controller.signal),
    };
  } finally {
    activeGenerationRequests.delete(requestId);
  }
};

const handleRequest = async (
  request: ExtensionRequest,
  sender: chrome.runtime.MessageSender,
): Promise<AnyExtensionResponse> => {
  if (request.type === "settings.get") {
    return { ok: true, data: await getSnapshot() };
  }

  if (request.type === "inline.bootstrap") {
    const settings = await loadSettings();
    const profile = getActiveProviderProfile(settings);
    const secretStatus = await getSecretStatus(profile.id);
    const styles = (await loadResolvedPromptLibrary()).active.map(
      ({ id, label, version, source, isOverridden }) => ({
        id,
        label,
        version,
        isBuiltInDefault: source === "built-in" && !isOverridden,
      }),
    );
    return {
      ok: true,
      data: {
        locale: settings.uiLocale,
        configured: Boolean(profile.model.trim() && secretStatus.hasKey),
        providerDisplayName: profile.displayName,
        model: profile.model.trim(),
        styles,
      },
    };
  }

  if (request.type === "inline.openSidePanel") {
    if (sender.tab?.id === undefined) {
      throw new AppError("INVALID_REQUEST", "The X tab could not be identified.");
    }
    await Promise.all([
      request.input ? savePendingXContext(request.input) : Promise.resolve(),
      chrome.sidePanel.open({ tabId: sender.tab.id }),
    ]);
    return { ok: true, data: { opened: true } };
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

  if (request.type === "settings.saveImageProfile") {
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

    await upsertImageProviderProfile(request.profile);
    if (apiKey) {
      await saveApiKey(request.profile.id, apiKey, request.profile.keyPersistence);
    }

    return { ok: true, data: await getSnapshot() };
  }

  if (request.type === "data.deleteKeys") {
    await deleteAllApiKeys();
    return { ok: true, data: await getSnapshot() };
  }

  if (request.type === "data.reset") {
    for (const controller of activeGenerationRequests.values()) {
      controller.abort();
    }
    activeGenerationRequests.clear();
    await resetPostMuseData();
    return { ok: true, data: await getSnapshot() };
  }

  if (
    request.type === "text.cancel" ||
    request.type === "image.cancel" ||
    request.type === "inline.cancel"
  ) {
    const controller = activeGenerationRequests.get(request.targetRequestId);
    controller?.abort();
    return { ok: true, data: { cancelled: controller !== undefined } };
  }

  if (request.type === "text.generate" || request.type === "inline.generate") {
    return runGeneration(request.requestId, request.input, request.type === "inline.generate");
  }

  if (request.type === "image.generate") {
    return runImageGeneration(request.requestId, request.input);
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
    if (
      (isInlineMessage(message) && !isTrustedXContentSender(sender)) ||
      (!isInlineMessage(message) && !isTrustedExtensionSender(sender))
    ) {
      throw new AppError("UNTRUSTED_SENDER", "This request is not available from web pages.");
    }

    if (!isExtensionRequest(message)) {
      throw new AppError("INVALID_REQUEST", "The extension request was invalid.");
    }

    return await handleRequest(message, sender);
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
