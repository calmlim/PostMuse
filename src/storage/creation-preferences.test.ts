import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultCreationPreferences } from "../core/preferences/creation";
import {
  CREATION_PREFERENCES_STORAGE_KEY,
  loadCreationPreferences,
  saveCreationPreferences,
} from "./creation-preferences";

describe("creation preferences", () => {
  const get = vi.fn();
  const set = vi.fn();

  beforeEach(() => {
    get.mockReset();
    set.mockReset();
    vi.stubGlobal("chrome", { storage: { local: { get, set } } });
  });

  it("seeds safe defaults when no valid record exists", async () => {
    get.mockResolvedValue({});
    const result = await loadCreationPreferences();
    expect(result).toEqual(createDefaultCreationPreferences());
    expect(set).toHaveBeenCalledWith({ [CREATION_PREFERENCES_STORAGE_KEY]: result });
  });

  it("round trips a valid preference record", async () => {
    const preferences = createDefaultCreationPreferences();
    preferences.inline.candidateCount = 4;
    preferences.inline.language = "ja";
    preferences.create.threadCount = 8;
    await expect(saveCreationPreferences(preferences)).resolves.toEqual(preferences);
    expect(set).toHaveBeenCalledWith({ [CREATION_PREFERENCES_STORAGE_KEY]: preferences });
  });

  it("migrates version 1 preferences with fast writing enabled", async () => {
    const current = createDefaultCreationPreferences();
    const legacy = {
      schemaVersion: 1,
      defaultStyleId: current.defaultStyleId,
      inline: current.inline,
      create: current.create,
    };
    get.mockResolvedValue({ [CREATION_PREFERENCES_STORAGE_KEY]: legacy });

    await expect(loadCreationPreferences()).resolves.toMatchObject({
      schemaVersion: 2,
      fastMode: true,
    });
    expect(set).toHaveBeenCalledWith({
      [CREATION_PREFERENCES_STORAGE_KEY]: expect.objectContaining({
        schemaVersion: 2,
        fastMode: true,
      }),
    });
  });

  it("rejects custom length as a persistent preset", async () => {
    const preferences = createDefaultCreationPreferences() as unknown as Record<string, unknown>;
    (preferences.inline as Record<string, unknown>).length = "custom";
    await expect(saveCreationPreferences(preferences as never)).rejects.toThrow(
      "Invalid creation preferences",
    );
  });
});
