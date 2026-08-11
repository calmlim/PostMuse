import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultSettings } from "../core/settings/defaults";
import { App } from "./App";

const storageGet = vi.fn();
const storageSet = vi.fn();
const sessionGet = vi.fn();
const sessionSet = vi.fn();
const runtimeSendMessage = vi.fn();
const permissionsRequest = vi.fn();

beforeEach(() => {
  storageGet.mockReset();
  storageSet.mockReset();
  sessionGet.mockReset();
  sessionSet.mockReset();
  runtimeSendMessage.mockReset();
  permissionsRequest.mockReset();
  storageGet.mockResolvedValue({});
  storageSet.mockResolvedValue(undefined);
  sessionGet.mockResolvedValue({});
  sessionSet.mockResolvedValue(undefined);
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
        mode: "mock",
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

  it("runs the Phase 1 local setup check in permission-first order", async () => {
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
          mode: "mock",
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
    fireEvent.click(screen.getByRole("button", { name: "Test setup" }));

    expect(await screen.findByText(/Local setup check passed/)).toBeVisible();
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

  it("keeps the draft while the user visits Settings", async () => {
    render(<App />);
    const draft = await screen.findByLabelText("Your idea or draft");

    fireEvent.change(draft, { target: { value: "Keep this local draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(await screen.findByRole("heading", { name: "Connect your model" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(screen.getByLabelText("Your idea or draft")).toHaveValue("Keep this local draft");
  });
});
