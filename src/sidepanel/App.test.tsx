import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerationInputFixture } from "../core/generation/fixtures";
import { createDefaultSettings } from "../core/settings/defaults";
import { HISTORY_PREFERENCES_STORAGE_KEY } from "../storage/history-preferences";
import { listHistoryRecords, saveHistoryRecord } from "../storage/history-repository";
import { PENDING_X_CONTEXT_STORAGE_KEY } from "../storage/pending-context";
import { App } from "./App";

const storageGet = vi.fn();
const storageSet = vi.fn();
const sessionGet = vi.fn();
const sessionSet = vi.fn();
const sessionRemove = vi.fn();
const runtimeSendMessage = vi.fn();
const permissionsRequest = vi.fn();

beforeEach(() => {
  storageGet.mockReset();
  storageSet.mockReset();
  sessionGet.mockReset();
  sessionSet.mockReset();
  sessionRemove.mockReset();
  runtimeSendMessage.mockReset();
  permissionsRequest.mockReset();
  storageGet.mockResolvedValue({});
  storageSet.mockResolvedValue(undefined);
  sessionGet.mockResolvedValue({});
  sessionSet.mockResolvedValue(undefined);
  sessionRemove.mockResolvedValue(undefined);
  permissionsRequest.mockResolvedValue(true);

  const defaultSettings = createDefaultSettings();
  runtimeSendMessage.mockImplementation(async (request: { type: string; profile?: object }) => {
    if (request.type === "settings.get") {
      return {
        ok: true,
        data: { settings: defaultSettings, activeSecretStatus: { hasKey: false } },
      };
    }

    if (request.type === "settings.saveProfile") {
      return {
        ok: true,
        data: {
          settings: {
            ...defaultSettings,
            textProviderProfiles: [request.profile],
          },
          activeSecretStatus: { hasKey: true, persistence: "session" },
        },
      };
    }

    return {
      ok: true,
      data: {
        mode: "live",
        provider: "openai-compatible",
        model: "gpt-5-mini",
        checkedAt: "2026-08-11T00:00:00.000Z",
      },
    };
  });

  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: storageGet,
        set: storageSet,
      },
      session: {
        get: sessionGet,
        set: sessionSet,
        remove: sessionRemove,
      },
    },
    runtime: { sendMessage: runtimeSendMessage },
    permissions: { request: permissionsRequest },
  });
});

describe("Side Panel App", () => {
  it("renders English by default", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Turn an idea into a post" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Interface language" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Prompts" })).toBeVisible();
  });

  it("switches to Chinese and stores the preference", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "中文" }));

    expect(screen.getByRole("heading", { name: "把想法变成推文" })).toBeVisible();
    expect(screen.getByRole("group", { name: "界面语言" })).toBeVisible();
    await waitFor(() =>
      expect(storageSet).toHaveBeenCalledWith({
        "postmuse.settings": expect.objectContaining({ uiLocale: "zh-CN" }),
      }),
    );
  });

  it("restores a saved locale", async () => {
    storageGet.mockResolvedValue({ uiLocale: "zh-CN" });

    render(<App />);

    expect(await screen.findByRole("heading", { name: "把想法变成推文" })).toBeVisible();
  });

  it("runs the live connection test in permission-first order", async () => {
    const order: string[] = [];
    permissionsRequest.mockImplementation(async () => {
      order.push("permission");
      return true;
    });
    runtimeSendMessage.mockImplementation(async (request: { type: string; profile?: object }) => {
      order.push(request.type);
      const settings = createDefaultSettings();

      if (request.type === "settings.get") {
        return {
          ok: true,
          data: { settings, activeSecretStatus: { hasKey: false } },
        };
      }

      if (request.type === "settings.saveProfile") {
        return {
          ok: true,
          data: {
            settings: { ...settings, textProviderProfiles: [request.profile] },
            activeSecretStatus: { hasKey: true, persistence: "session" },
          },
        };
      }

      return {
        ok: true,
        data: {
          mode: "live",
          provider: "openai-compatible",
          model: "gpt-5-mini",
          checkedAt: "2026-08-11T00:00:00.000Z",
        },
      };
    });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    const model = await screen.findByLabelText("Model");
    fireEvent.change(model, { target: { value: "gpt-5-mini" } });
    fireEvent.change(screen.getByLabelText("API key"), { target: { value: "sk-test-value" } });
    order.length = 0;
    fireEvent.click(screen.getByRole("button", { name: "Run live test" }));

    expect(await screen.findByText(/Live connection passed/)).toBeVisible();
    expect(order).toEqual(["permission", "settings.saveProfile", "provider.test", "settings.get"]);
    expect(permissionsRequest).toHaveBeenCalledWith({ origins: ["https://api.openai.com/*"] });
  });

  it("generates editable candidates and copies the chosen draft", async () => {
    const order: string[] = [];
    const settings = createDefaultSettings();
    settings.textProviderProfiles[0] = {
      ...settings.textProviderProfiles[0],
      model: "gpt-test",
    };
    runtimeSendMessage.mockImplementation(async (request: { type: string }) => {
      order.push(request.type);
      if (request.type === "settings.get") {
        return {
          ok: true,
          data: {
            settings,
            activeSecretStatus: { hasKey: true, persistence: "session" },
          },
        };
      }
      if (request.type === "text.generate") {
        return {
          ok: true,
          data: {
            format: "candidates",
            contentType: "post",
            candidates: [
              { id: "candidate-1", text: "First useful draft" },
              { id: "candidate-2", text: "Second useful draft" },
              { id: "candidate-3", text: "Third useful draft" },
            ],
            warnings: [],
            provider: "openai-compatible",
            model: "gpt-test",
            softCharacterLimit: 280,
          },
        };
      }
      return { ok: true, data: { cancelled: true } };
    });
    permissionsRequest.mockImplementation(async () => {
      order.push("permission");
      return true;
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<App />);
    await screen.findByText(/Generate sends this draft directly/);
    fireEvent.change(screen.getByLabelText("Your idea or draft"), {
      target: { value: "A useful product lesson" },
    });
    order.length = 0;
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    expect(await screen.findByRole("heading", { name: "Edit before you publish" })).toBeVisible();
    expect(order).toEqual(["permission", "text.generate"]);
    expect(screen.getByLabelText("Candidate 1")).toHaveValue("First useful draft");

    fireEvent.click(screen.getAllByRole("button", { name: "Copy" })[0]);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("First useful draft"));
    expect(screen.getByText("Copied to clipboard.")).toBeVisible();
    await waitFor(async () => expect(await listHistoryRecords()).toHaveLength(1));
  });

  it("saves raw fallback text only after explicit confirmation", async () => {
    const settings = createDefaultSettings();
    settings.textProviderProfiles[0] = {
      ...settings.textProviderProfiles[0],
      model: "gpt-test",
    };
    runtimeSendMessage.mockImplementation(async (request: { type: string }) => {
      if (request.type === "settings.get") {
        return {
          ok: true,
          data: {
            settings,
            activeSecretStatus: { hasKey: true, persistence: "session" },
          },
        };
      }
      if (request.type === "text.generate") {
        return {
          ok: true,
          data: {
            format: "raw",
            contentType: "post",
            rawText: "Provider fallback text",
            warnings: ["RAW_TEXT_FALLBACK"],
            provider: "openai-compatible",
            model: "gpt-test",
            softCharacterLimit: 280,
          },
        };
      }
      return { ok: true, data: { cancelled: true } };
    });

    render(<App />);
    await screen.findByText(/Generate sends this draft directly/);
    fireEvent.change(screen.getByLabelText("Your idea or draft"), {
      target: { value: "Fallback source" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    expect(await screen.findByLabelText("Raw Provider result")).toHaveValue(
      "Provider fallback text",
    );
    expect(await listHistoryRecords()).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Save to history" }));
    await waitFor(async () => expect(await listHistoryRecords()).toHaveLength(1));
    expect(screen.getByRole("button", { name: "Saved to history" })).toBeDisabled();
  });

  it("does not save a successful result when local history is disabled", async () => {
    storageGet.mockImplementation(async (key?: string) =>
      key === HISTORY_PREFERENCES_STORAGE_KEY
        ? {
            [HISTORY_PREFERENCES_STORAGE_KEY]: { schemaVersion: 1, enabled: false },
          }
        : {},
    );
    const settings = createDefaultSettings();
    settings.textProviderProfiles[0] = {
      ...settings.textProviderProfiles[0],
      model: "gpt-test",
    };
    runtimeSendMessage.mockImplementation(async (request: { type: string }) => {
      if (request.type === "settings.get") {
        return {
          ok: true,
          data: {
            settings,
            activeSecretStatus: { hasKey: true, persistence: "session" },
          },
        };
      }
      if (request.type === "text.generate") {
        return {
          ok: true,
          data: {
            format: "candidates",
            contentType: "post",
            candidates: [{ id: "candidate-1", text: "Unsaved result" }],
            warnings: [],
            provider: "openai-compatible",
            model: "gpt-test",
            softCharacterLimit: 280,
          },
        };
      }
      return { ok: true, data: { cancelled: true } };
    });

    render(<App />);
    await screen.findByText(/Generate sends this draft directly/);
    fireEvent.change(screen.getByLabelText("Your idea or draft"), {
      target: { value: "Do not save this" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    expect(await screen.findByLabelText("Candidate 1")).toHaveValue("Unsaved result");
    expect(await listHistoryRecords()).toEqual([]);
  });

  it("reads a local Markdown file into the draft without uploading it", async () => {
    render(<App />);
    const file = new File(["Local markdown idea"], "idea.md", { type: "text/markdown" });
    Object.defineProperty(file, "text", {
      configurable: true,
      value: vi.fn().mockResolvedValue("Local markdown idea"),
    });

    fireEvent.change(screen.getByLabelText("Add .txt or .md"), {
      target: { files: [file] },
    });

    await waitFor(() =>
      expect(screen.getByLabelText("Your idea or draft")).toHaveValue("Local markdown idea"),
    );
    expect(screen.getByText("idea.md")).toBeVisible();
    expect(runtimeSendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "text.generate" }),
    );
  });

  it("rejects oversized pasted text and files before generation", async () => {
    render(<App />);
    const source = await screen.findByLabelText("Your idea or draft");
    fireEvent.change(source, { target: { value: "x".repeat(100_001) } });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    expect(
      screen.getByText(
        "The source is longer than 100,000 characters. Shorten it before generating.",
      ),
    ).toBeVisible();

    const file = new File(["small"], "oversized.txt", { type: "text/plain" });
    Object.defineProperty(file, "size", { configurable: true, value: 1024 * 1024 + 1 });
    fireEvent.change(screen.getByLabelText("Add .txt or .md"), {
      target: { files: [file] },
    });
    expect(screen.getByText("The file is larger than 1 MiB. Choose a smaller file.")).toBeVisible();
  });

  it("keeps the draft while the user visits Settings", async () => {
    render(<App />);
    const draft = await screen.findByLabelText("Your idea or draft");

    fireEvent.change(draft, { target: { value: "Keep this local draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(await screen.findByRole("heading", { name: "Connect your model" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(screen.getByLabelText("Your idea or draft")).toHaveValue("Keep this local draft");
  });

  it("reuses a history input in Create without calling the Provider", async () => {
    await saveHistoryRecord(
      createGenerationInputFixture({
        source: { kind: "draft", text: "Reuse this saved source" },
        contentType: "quote",
        candidateCount: 2,
      }),
      {
        format: "candidates",
        contentType: "quote",
        candidates: [{ id: "candidate-1", text: "Saved output" }],
        warnings: [],
        provider: "openai-compatible",
        model: "test-model",
        softCharacterLimit: 280,
      },
      { recipeVersion: 1, styleTemplateVersion: 1 },
    );

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    expect(await screen.findByText("Reuse this saved source")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reuse in Create" }));

    expect(await screen.findByLabelText("Your idea or draft")).toHaveValue(
      "Reuse this saved source",
    );
    expect(screen.getByLabelText("Format")).toHaveValue("quote");
    expect(runtimeSendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "text.generate" }),
    );
  });

  it("consumes a one-shot X context when the side panel opens", async () => {
    const input = createGenerationInputFixture({
      source: { kind: "draft", text: "Context handed off from X" },
      contentType: "reply",
      candidateCount: 3,
    });
    sessionGet.mockImplementation(async (key?: string) =>
      key === PENDING_X_CONTEXT_STORAGE_KEY
        ? {
            [PENDING_X_CONTEXT_STORAGE_KEY]: {
              schemaVersion: 1,
              expiresAt: Date.now() + 60_000,
              input,
            },
          }
        : {},
    );

    render(<App />);

    await waitFor(() =>
      expect(screen.getByLabelText("Your idea or draft")).toHaveValue("Context handed off from X"),
    );
    expect(screen.getByLabelText("Format")).toHaveValue("reply");
    expect(sessionRemove).toHaveBeenCalledWith(PENDING_X_CONTEXT_STORAGE_KEY);
  });

  it("makes a newly saved custom style available in Create", async () => {
    const localData: Record<string, unknown> = {};
    storageGet.mockImplementation(async (keys?: string | string[]) => {
      const requested = typeof keys === "string" ? [keys] : keys;
      if (!requested) {
        return { ...localData };
      }
      return Object.fromEntries(
        requested.filter((key) => key in localData).map((key) => [key, localData[key]]),
      );
    });
    storageSet.mockImplementation(async (values: Record<string, unknown>) => {
      Object.assign(localData, values);
    });
    vi.stubGlobal("crypto", { randomUUID: () => "app-style-id" });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Prompts" }));
    expect(await screen.findByRole("heading", { name: "Shape your voice" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "New style" }));
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Field notes" },
    });
    fireEvent.change(screen.getByLabelText("Style instructions"), {
      target: { value: "Prefer concise observations from direct experience." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save style" }));
    expect(await screen.findByText("Custom style created.")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByRole("option", { name: "Field notes" })).toBeInTheDocument();
  });
});
