import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStorageAreaMock, type StorageAreaMock } from "../test/chrome-storage";
import {
  HISTORY_PREFERENCES_STORAGE_KEY,
  loadHistoryEnabled,
  saveHistoryEnabled,
} from "./history-preferences";

let local: StorageAreaMock;

beforeEach(() => {
  local = createStorageAreaMock();
  vi.stubGlobal("chrome", { storage: { local } });
});

describe("history preferences", () => {
  it("defaults to enabled and persists the user's choice", async () => {
    await expect(loadHistoryEnabled()).resolves.toBe(true);
    expect(local.data[HISTORY_PREFERENCES_STORAGE_KEY]).toEqual({
      schemaVersion: 1,
      enabled: true,
    });

    await saveHistoryEnabled(false);
    await expect(loadHistoryEnabled()).resolves.toBe(false);
  });
});
