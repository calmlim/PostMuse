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

    expect(screen.getByRole("heading", { name: "Your writing space is ready" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Interface language" })).toBeVisible();
  });

  it("switches to Chinese and stores the preference", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "中文" }));

    expect(screen.getByRole("heading", { name: "你的创作空间已准备好" })).toBeVisible();
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

    expect(await screen.findByRole("heading", { name: "你的创作空间已准备好" })).toBeVisible();
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
    expect(order).toEqual(["permission", "settings.saveProfile", "provider.test"]);
    expect(permissionsRequest).toHaveBeenCalledWith({ origins: ["https://api.openai.com/*"] });
  });
});
