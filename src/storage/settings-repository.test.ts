import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultSettings } from "../core/settings/defaults";
import { createStorageAreaMock, type StorageAreaMock } from "../test/chrome-storage";
import { loadSettings, SETTINGS_STORAGE_KEY } from "./settings-repository";

let local: StorageAreaMock;

beforeEach(() => {
  local = createStorageAreaMock();
  vi.stubGlobal("chrome", { storage: { local } });
});

describe("settings repository", () => {
  it("migrates the legacy locale into schema v1", async () => {
    local.data.uiLocale = "zh-CN";

    const settings = await loadSettings();

    expect(settings.schemaVersion).toBe(1);
    expect(settings.uiLocale).toBe("zh-CN");
    expect(settings.textProviderProfiles).toHaveLength(1);
    expect(local.data[SETTINGS_STORAGE_KEY]).toEqual(settings);
  });

  it("loads valid schema v1 without rewriting it", async () => {
    const current = createDefaultSettings("en");
    local.data[SETTINGS_STORAGE_KEY] = current;

    await expect(loadSettings()).resolves.toEqual(current);
    expect(local.set).not.toHaveBeenCalled();
  });
});
