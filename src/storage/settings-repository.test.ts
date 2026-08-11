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
  it("migrates the legacy locale into schema v2", async () => {
    local.data.uiLocale = "zh-CN";

    const settings = await loadSettings();

    expect(settings.schemaVersion).toBe(2);
    expect(settings.uiLocale).toBe("zh-CN");
    expect(settings.textProviderProfiles).toHaveLength(1);
    expect(settings.imageProviderProfiles).toHaveLength(1);
    expect(local.data[SETTINGS_STORAGE_KEY]).toEqual(settings);
  });

  it("migrates schema v1 while preserving the text profile", async () => {
    const current = createDefaultSettings("en");
    const legacy = {
      schemaVersion: 1,
      uiLocale: current.uiLocale,
      activeTextProviderProfileId: current.activeTextProviderProfileId,
      textProviderProfiles: current.textProviderProfiles,
    };
    local.data[SETTINGS_STORAGE_KEY] = legacy;

    const migrated = await loadSettings();

    expect(migrated).toMatchObject({
      schemaVersion: 2,
      textProviderProfiles: legacy.textProviderProfiles,
      imageProviderProfiles: [expect.objectContaining({ provider: "openai" })],
    });
    expect(local.data[SETTINGS_STORAGE_KEY]).toEqual(migrated);
  });

  it("loads valid schema v2 without rewriting it", async () => {
    const current = createDefaultSettings("en");
    local.data[SETTINGS_STORAGE_KEY] = current;

    await expect(loadSettings()).resolves.toEqual(current);
    expect(local.set).not.toHaveBeenCalled();
  });
});
