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
  it("migrates the legacy locale into schema v3", async () => {
    local.data.uiLocale = "zh-CN";

    const settings = await loadSettings();

    expect(settings.schemaVersion).toBe(3);
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
      schemaVersion: 3,
      textProviderProfiles: legacy.textProviderProfiles,
      imageProviderProfiles: [expect.objectContaining({ provider: "openai" })],
    });
    expect(local.data[SETTINGS_STORAGE_KEY]).toEqual(migrated);
  });

  it("migrates schema v2 to Provider-default sampling while preserving temperature", async () => {
    const current = createDefaultSettings("en");
    const legacy = {
      ...current,
      schemaVersion: 2,
      textProviderProfiles: current.textProviderProfiles.map(({ samplingMode: _, ...profile }) => ({
        ...profile,
        temperature: 1.2,
      })),
    };
    local.data[SETTINGS_STORAGE_KEY] = legacy;

    await expect(loadSettings()).resolves.toMatchObject({
      schemaVersion: 3,
      textProviderProfiles: [{ samplingMode: "provider-default", temperature: 1.2 }],
    });
    expect(local.set).toHaveBeenCalledTimes(1);
  });

  it("adds API versions only to legacy official defaults and preserves custom paths", async () => {
    const current = createDefaultSettings("en");
    local.data[SETTINGS_STORAGE_KEY] = {
      ...current,
      textProviderProfiles: [
        { ...current.textProviderProfiles[0], baseUrl: "https://api.openai.com" },
      ],
      imageProviderProfiles: [
        { ...current.imageProviderProfiles[0], baseUrl: "https://gateway.example.com/openai" },
      ],
    };

    await expect(loadSettings()).resolves.toMatchObject({
      textProviderProfiles: [{ baseUrl: "https://api.openai.com/v1" }],
      imageProviderProfiles: [{ baseUrl: "https://gateway.example.com/openai" }],
    });
    expect(local.set).toHaveBeenCalledTimes(1);
  });
});
