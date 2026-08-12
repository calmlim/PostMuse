import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDefaultImageProviderProfile,
  createDefaultProviderProfile,
} from "../core/settings/defaults";
import { createGenerationInputFixture } from "../core/generation/fixtures";
import type { GenerationResult } from "../core/generation/types";
import { createStorageAreaMock, type StorageAreaMock } from "../test/chrome-storage";
import { routeExtensionMessage } from "./message-router";
import { savePromptTemplate } from "../storage/prompt-repository";
import { listHistoryRecords } from "../storage/history-repository";
import { takePendingXContext } from "../storage/pending-context";
import { saveWritingProfile } from "../storage/writing-profile-repository";

let local: StorageAreaMock;
let session: StorageAreaMock;
const permissionContains = vi.fn();
const permissionGetAll = vi.fn();
const permissionRemove = vi.fn();
const fetchMock = vi.fn();
const sidePanelOpen = vi.fn();

const pngHeaderBase64 = (width: number, height: number): string => {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return btoa(String.fromCharCode(...bytes));
};

const trustedSender = {
  id: "extension-id",
  url: "chrome-extension://extension-id/sidepanel.html",
} as chrome.runtime.MessageSender;

const xContentSender = {
  id: "extension-id",
  url: "https://x.com/home",
  tab: { id: 3, url: "https://x.com/home" } as chrome.tabs.Tab,
} as chrome.runtime.MessageSender;

beforeEach(() => {
  local = createStorageAreaMock();
  session = createStorageAreaMock();
  permissionContains.mockReset();
  permissionContains.mockResolvedValue(true);
  permissionGetAll.mockReset();
  permissionGetAll.mockResolvedValue({ origins: [] });
  permissionRemove.mockReset();
  permissionRemove.mockResolvedValue(true);
  fetchMock.mockReset();
  sidePanelOpen.mockReset();
  sidePanelOpen.mockResolvedValue(undefined);
  vi.stubGlobal("fetch", fetchMock);

  vi.stubGlobal("chrome", {
    storage: { local, session },
    permissions: {
      contains: permissionContains,
      getAll: permissionGetAll,
      remove: permissionRemove,
    },
    sidePanel: { open: sidePanelOpen },
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

  it("requires key re-entry before changing Provider destination but not its path", async () => {
    const profile = { ...createDefaultProviderProfile(), model: "gpt-5-mini" };
    await routeExtensionMessage(
      {
        type: "settings.saveProfile",
        requestId: "binding-save",
        profile,
        apiKey: "sk-bound-key",
      },
      trustedSender,
    );

    await expect(
      routeExtensionMessage(
        {
          type: "settings.saveProfile",
          requestId: "binding-path",
          profile: { ...profile, baseUrl: "https://api.openai.com/proxy/v1" },
        },
        trustedSender,
      ),
    ).resolves.toMatchObject({ ok: true, data: { activeSecretStatus: { hasKey: true } } });

    await expect(
      routeExtensionMessage(
        {
          type: "settings.saveProfile",
          requestId: "binding-origin",
          profile: { ...profile, baseUrl: "https://proxy.example.com/v1" },
        },
        trustedSender,
      ),
    ).resolves.toMatchObject({ ok: false, error: { code: "API_KEY_REENTRY_REQUIRED" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows only the limited inline bootstrap response from an X content script", async () => {
    const response = await routeExtensionMessage(
      { type: "inline.bootstrap", requestId: "inline-bootstrap-1" },
      xContentSender,
    );

    expect(response).toMatchObject({
      ok: true,
      data: {
        locale: "en",
        configured: false,
        providerDisplayName: "OpenAI-compatible",
        defaultStyleId: "professional",
        preferences: {
          candidateCount: 2,
          length: "medium",
          language: "follow-source",
          replyIntent: "agree-and-add",
          quoteIntent: "comment",
        },
        styles: expect.arrayContaining([
          expect.objectContaining({ id: "professional", version: 1, isBuiltInDefault: true }),
        ]),
      },
    });
    expect(JSON.stringify(response)).not.toContain("apiKey");

    await expect(
      routeExtensionMessage(
        { type: "inline.bootstrap", requestId: "inline-bootstrap-2" },
        {
          ...xContentSender,
          url: "https://example.com/",
        },
      ),
    ).resolves.toMatchObject({ ok: false, error: { code: "UNTRUSTED_SENDER" } });
  });

  it("requires exact host permission before the live setup test", async () => {
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

  it("sends a fixed live probe when storage and permission are ready", async () => {
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
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }), {
        status: 200,
      }),
    );

    const response = await routeExtensionMessage(
      { type: "provider.test", requestId: "request-2", profileId: profile.id },
      trustedSender,
    );

    expect(response).toMatchObject({
      ok: true,
      data: { mode: "live", provider: "openai-compatible", model: "gpt-5-mini" },
    });
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(requestBody.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ content: 'Return {"ok":true}. Do not include commentary.' }),
      ]),
    );
    expect(JSON.stringify(requestBody)).not.toContain("draft");
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

  it("regenerates one thread position with neighboring context", async () => {
    const profile = { ...createDefaultProviderProfile(), model: "gpt-test" };
    await routeExtensionMessage(
      {
        type: "settings.saveProfile",
        requestId: "regen-settings",
        profile,
        apiKey: "sk-regen-secret",
      },
      trustedSender,
    );
    await saveWritingProfile("I write as a practical independent developer.");
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: '{"text":"Stronger close"}' } }] }),
        { status: 200 },
      ),
    );
    const input = createGenerationInputFixture({
      contentType: "thread",
      language: { mode: "fixed", value: "Simplified Chinese" },
      length: "long",
      audience: "solo founders",
      goal: "share one useful lesson",
      tone: "candid",
      mustInclude: "a concrete example",
      mustAvoid: "hype",
      candidateCount: 1,
      threadCount: 3,
    });

    await expect(
      routeExtensionMessage(
        {
          type: "text.regenerate",
          requestId: "regen-thread-close",
          input: {
            input,
            target: {
              kind: "thread-post",
              index: 2,
              currentTexts: ["Hook", "Development", "Old close"],
            },
          },
        },
        trustedSender,
      ),
    ).resolves.toMatchObject({ ok: true, data: { text: "Stronger close" } });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(JSON.stringify(body)).toContain("closing post or CTA");
    expect(JSON.stringify(body)).toContain("Development");
    expect(body.messages[0].content).toContain("Write in Simplified Chinese");
    expect(body.messages[0].content).toContain("180–280 Unicode characters per post");
    expect(body.messages[0].content).toContain("Target audience: solo founders");
    expect(body.messages[0].content).toContain("Content goal: share one useful lesson");
    expect(body.messages[0].content).toContain("Additional tone: candid");
    expect(body.messages[0].content).toContain("Must include: a concrete example");
    expect(body.messages[0].content).toContain("Must avoid: hype");
    expect(body.messages[0].content).toContain("I write as a practical independent developer.");
  });

  it("allows the X inline panel to regenerate one candidate through the narrow inline route", async () => {
    const profile = { ...createDefaultProviderProfile(), model: "gpt-inline-regen" };
    await routeExtensionMessage(
      {
        type: "settings.saveProfile",
        requestId: "inline-regen-settings",
        profile,
        apiKey: "sk-inline-regen-secret",
      },
      trustedSender,
    );
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: '{"text":"New first option"}' } }] }),
        { status: 200 },
      ),
    );

    await expect(
      routeExtensionMessage(
        {
          type: "inline.regenerate",
          requestId: "inline-regen-1",
          input: {
            input: createGenerationInputFixture({ candidateCount: 2 }),
            target: { kind: "candidate", index: 0, currentTexts: ["Old one", "Keep two"] },
          },
        },
        xContentSender,
      ),
    ).resolves.toMatchObject({ ok: true, data: { text: "New first option" } });
  });

  it("generates for the X inline panel in the worker and saves structured history", async () => {
    const profile = { ...createDefaultProviderProfile(), model: "gpt-inline" };
    await routeExtensionMessage(
      {
        type: "settings.saveProfile",
        requestId: "inline-settings",
        profile,
        apiKey: "sk-inline-secret",
      },
      trustedSender,
    );
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: '{"candidates":[{"text":"One"},{"text":"Two"},{"text":"Three"}]}',
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const input = createGenerationInputFixture({
      source: { kind: "draft", text: "Current visible X post" },
    });

    const response = await routeExtensionMessage(
      { type: "inline.generate", requestId: "inline-generation", input },
      xContentSender,
    );

    expect(response).toMatchObject({
      ok: true,
      data: { historyId: expect.any(String), result: { format: "candidates" } },
    });
    expect(await listHistoryRecords()).toHaveLength(1);
    expect((await listHistoryRecords())[0].input.source.text).toBe("Current visible X post");
    expect(JSON.stringify(response)).not.toContain("sk-inline-secret");
    if (!response.ok) {
      throw new Error("Inline generation unexpectedly failed.");
    }
    const envelope = response.data as { historyId: string; result: GenerationResult };
    if (envelope.result.format !== "candidates") {
      throw new Error("Expected candidates.");
    }
    const editedResult: GenerationResult = {
      ...envelope.result,
      candidates: envelope.result.candidates.map((candidate, index) =>
        index === 0 ? { ...candidate, text: "Edited inline result" } : candidate,
      ),
    };
    await expect(
      routeExtensionMessage(
        {
          type: "inline.history.sync",
          requestId: "inline-history-sync",
          historyId: envelope.historyId,
          result: editedResult,
        },
        xContentSender,
      ),
    ).resolves.toEqual({ ok: true, data: { synced: true } });
    const syncedResult = (await listHistoryRecords())[0].result;
    expect(syncedResult.format).toBe("candidates");
    if (syncedResult.format === "candidates") {
      expect(syncedResult.candidates[0].text).toBe("Edited inline result");
    }
  });

  it("generates an image through the separately configured image Provider", async () => {
    const profile = createDefaultImageProviderProfile();
    await routeExtensionMessage(
      {
        type: "settings.saveImageProfile",
        requestId: "image-settings",
        profile,
        apiKey: "image-router-secret",
      },
      trustedSender,
    );
    const generatedImage = pngHeaderBase64(1024, 1024);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: [{ b64_json: generatedImage }] }), { status: 200 }),
    );

    const response = await routeExtensionMessage(
      {
        type: "image.generate",
        requestId: "image-generation",
        input: {
          sourceText: "A useful product lesson",
          prompt: "A clean editorial illustration",
          style: "editorial",
          aspectRatio: "1:1",
          size: "1K",
          includeText: false,
        },
      },
      trustedSender,
    );

    expect(response).toMatchObject({
      ok: true,
      data: {
        provider: "openai",
        mimeType: "image/png",
        base64Data: generatedImage,
        pixelWidth: 1024,
        pixelHeight: 1024,
      },
    });
    expect(JSON.stringify(response)).not.toContain("image-router-secret");
    expect(permissionContains).toHaveBeenCalledWith({ origins: ["https://api.openai.com/*"] });
    await expect(
      routeExtensionMessage({ type: "settings.get", requestId: "image-snapshot" }, trustedSender),
    ).resolves.toMatchObject({
      ok: true,
      data: {
        activeSecretStatus: { hasKey: false },
        activeImageSecretStatus: { hasKey: true, persistence: "session" },
      },
    });
  });

  it("cancels an active image generation request", async () => {
    const profile = createDefaultImageProviderProfile();
    await routeExtensionMessage(
      {
        type: "settings.saveImageProfile",
        requestId: "image-cancel-settings",
        profile,
        apiKey: "image-cancel-secret",
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
        type: "image.generate",
        requestId: "image-to-cancel",
        input: {
          sourceText: "A source",
          prompt: "A visual",
          style: "minimal",
          aspectRatio: "1:1",
          size: "1K",
          includeText: false,
        },
      },
      trustedSender,
    );
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await expect(
      routeExtensionMessage(
        {
          type: "image.cancel",
          requestId: "cancel-image",
          targetRequestId: "image-to-cancel",
        },
        trustedSender,
      ),
    ).resolves.toEqual({ ok: true, data: { cancelled: true } });
    await expect(pendingGeneration).resolves.toMatchObject({
      ok: false,
      error: { code: "REQUEST_CANCELLED" },
    });
  });

  it("hands one validated input to the side panel for the current X tab", async () => {
    const input = createGenerationInputFixture({
      source: { kind: "draft", text: "Move this context" },
      contentType: "reply",
    });

    const response = await routeExtensionMessage(
      { type: "inline.openSidePanel", requestId: "open-inline", input },
      xContentSender,
    );

    expect(response).toEqual({ ok: true, data: { opened: true } });
    expect(sidePanelOpen).toHaveBeenCalledWith({ tabId: 3 });
    await expect(takePendingXContext()).resolves.toEqual(input);
    await expect(takePendingXContext()).resolves.toBeUndefined();
  });

  it("deletes saved keys and resets all local PostMuse data from the trusted panel", async () => {
    const textProfile = { ...createDefaultProviderProfile(), model: "gpt-private" };
    const imageProfile = createDefaultImageProviderProfile();
    await routeExtensionMessage(
      {
        type: "settings.saveProfile",
        requestId: "privacy-text-settings",
        profile: textProfile,
        apiKey: "text-private-key",
      },
      trustedSender,
    );
    await routeExtensionMessage(
      {
        type: "settings.saveImageProfile",
        requestId: "privacy-image-settings",
        profile: imageProfile,
        apiKey: "image-private-key",
      },
      trustedSender,
    );

    await expect(
      routeExtensionMessage(
        { type: "data.deleteKeys", requestId: "delete-all-keys" },
        trustedSender,
      ),
    ).resolves.toMatchObject({
      ok: true,
      data: {
        activeSecretStatus: { hasKey: false },
        activeImageSecretStatus: { hasKey: false },
      },
    });

    await savePromptTemplate("professional", "Private style", "Private instructions");
    await expect(
      routeExtensionMessage({ type: "data.reset", requestId: "reset-data" }, trustedSender),
    ).resolves.toMatchObject({
      ok: true,
      data: {
        remainingOriginCount: 0,
        snapshot: {
          settings: { schemaVersion: 3, activeTextProviderProfileId: "default-text-provider" },
          activeSecretStatus: { hasKey: false },
          activeImageSecretStatus: { hasKey: false },
        },
      },
    });
    expect(await listHistoryRecords()).toEqual([]);
  });

  it("revokes granted optional Provider origins and reports what remains", async () => {
    permissionGetAll
      .mockResolvedValueOnce({ origins: ["https://api.openai.com/*", "https://api.x.ai/*"] })
      .mockResolvedValueOnce({ origins: ["https://api.x.ai/*"] });

    await expect(
      routeExtensionMessage(
        { type: "data.revokeOrigins", requestId: "revoke-origins" },
        trustedSender,
      ),
    ).resolves.toEqual({
      ok: true,
      data: { revokedOriginCount: 1, remainingOriginCount: 1 },
    });
    expect(permissionRemove).toHaveBeenCalledWith({
      origins: ["https://api.openai.com/*", "https://api.x.ai/*"],
    });
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
