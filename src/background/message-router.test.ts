import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultProviderProfile } from "../core/settings/defaults";
import { createGenerationInputFixture } from "../core/generation/fixtures";
import { createStorageAreaMock, type StorageAreaMock } from "../test/chrome-storage";
import { routeExtensionMessage } from "./message-router";
import { savePromptTemplate } from "../storage/prompt-repository";

let local: StorageAreaMock;
let session: StorageAreaMock;
const permissionContains = vi.fn();
const fetchMock = vi.fn();

const trustedSender = {
  id: "extension-id",
  url: "chrome-extension://extension-id/sidepanel.html",
} as chrome.runtime.MessageSender;

beforeEach(() => {
  local = createStorageAreaMock();
  session = createStorageAreaMock();
  permissionContains.mockReset();
  permissionContains.mockResolvedValue(true);
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);

  vi.stubGlobal("chrome", {
    storage: { local, session },
    permissions: { contains: permissionContains },
    runtime: {
      id: "extension-id",
      getURL: (path: string) => `chrome-extension://extension-id/${path}`,
    },
  });
});

describe("background message router", () => {
  it("rejects requests from content scripts even when the extension id matches", async () => {
    const response = await routeExtensionMessage(
      { type: "settings.get", requestId: "request-1" },
      {
        id: "extension-id",
        url: "https://x.com/home",
        tab: { id: 3 } as chrome.tabs.Tab,
      },
    );

    expect(response).toEqual({
      ok: false,
      error: {
        code: "UNTRUSTED_SENDER",
        message: "This request is not available from web pages.",
      },
    });
  });

  it("returns only key metadata to the trusted side panel", async () => {
    const profile = { ...createDefaultProviderProfile(), model: "gpt-5-mini" };
    await routeExtensionMessage(
      {
        type: "settings.saveProfile",
        requestId: "request-1",
        profile,
        apiKey: "sk-never-return-this",
      },
      trustedSender,
    );

    const response = await routeExtensionMessage(
      { type: "settings.get", requestId: "request-2" },
      trustedSender,
    );

    expect(JSON.stringify(response)).not.toContain("sk-never-return-this");
    expect(response).toMatchObject({
      ok: true,
      data: { activeSecretStatus: { hasKey: true, persistence: "session" } },
    });
  });

  it("requires exact host permission before the mock setup test", async () => {
    const profile = { ...createDefaultProviderProfile(), model: "gpt-5-mini" };
    await routeExtensionMessage(
      {
        type: "settings.saveProfile",
        requestId: "request-1",
        profile,
        apiKey: "sk-test-value",
      },
      trustedSender,
    );
    permissionContains.mockResolvedValue(false);

    const response = await routeExtensionMessage(
      { type: "provider.test", requestId: "request-2", profileId: profile.id },
      trustedSender,
    );

    expect(permissionContains).toHaveBeenCalledWith({ origins: ["https://api.openai.com/*"] });
    expect(response).toMatchObject({
      ok: false,
      error: { code: "HOST_PERMISSION_REQUIRED" },
    });
  });

  it("completes a local-only mock test when storage and permission are ready", async () => {
    const profile = { ...createDefaultProviderProfile(), model: "gpt-5-mini" };
    await routeExtensionMessage(
      {
        type: "settings.saveProfile",
        requestId: "request-1",
        profile,
        apiKey: "sk-test-value",
      },
      trustedSender,
    );

    const response = await routeExtensionMessage(
      { type: "provider.test", requestId: "request-2", profileId: profile.id },
      trustedSender,
    );

    expect(response).toMatchObject({
      ok: true,
      data: { mode: "mock", provider: "openai-compatible", model: "gpt-5-mini" },
    });
  });

  it("generates through the active Provider without exposing its key", async () => {
    const profile = { ...createDefaultProviderProfile(), model: "gpt-test" };
    await routeExtensionMessage(
      {
        type: "settings.saveProfile",
        requestId: "request-1",
        profile,
        apiKey: "sk-router-secret-value",
      },
      trustedSender,
    );
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: '{"candidates":[{"text":"First"},{"text":"Second"},{"text":"Third"}]}',
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    await savePromptTemplate(
      "professional",
      "My professional voice",
      "Use the saved prompt override.",
    );

    const response = await routeExtensionMessage(
      {
        type: "text.generate",
        requestId: "generation-1",
        input: createGenerationInputFixture(),
      },
      trustedSender,
    );

    expect(response).toMatchObject({
      ok: true,
      data: {
        format: "candidates",
        candidates: [{ text: "First" }, { text: "Second" }, { text: "Third" }],
      },
    });
    expect(JSON.stringify(response)).not.toContain("sk-router-secret-value");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(requestBody.messages[0].content).toContain("Use the saved prompt override.");
  });

  it("cancels an active generation request", async () => {
    const profile = { ...createDefaultProviderProfile(), model: "gpt-test" };
    await routeExtensionMessage(
      {
        type: "settings.saveProfile",
        requestId: "request-1",
        profile,
        apiKey: "sk-cancel-test-value",
      },
      trustedSender,
    );
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );

    const pendingGeneration = routeExtensionMessage(
      {
        type: "text.generate",
        requestId: "generation-to-cancel",
        input: createGenerationInputFixture(),
      },
      trustedSender,
    );
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await expect(
      routeExtensionMessage(
        {
          type: "text.cancel",
          requestId: "cancel-1",
          targetRequestId: "generation-to-cancel",
        },
        trustedSender,
      ),
    ).resolves.toEqual({ ok: true, data: { cancelled: true } });
    await expect(pendingGeneration).resolves.toMatchObject({
      ok: false,
      error: { code: "REQUEST_CANCELLED" },
    });
  });
});
