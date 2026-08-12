import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStorageAreaMock, type StorageAreaMock } from "../test/chrome-storage";
import {
  loadWritingProfile,
  MAX_WRITING_PROFILE_LENGTH,
  saveWritingProfile,
  WRITING_PROFILE_STORAGE_KEY,
} from "./writing-profile-repository";

let local: StorageAreaMock;

beforeEach(() => {
  local = createStorageAreaMock();
  vi.stubGlobal("chrome", { storage: { local } });
});

describe("writing profile repository", () => {
  it("defaults to empty and persists only entered text", async () => {
    expect(await loadWritingProfile()).toBe("");
    expect(local.data[WRITING_PROFILE_STORAGE_KEY]).toBeUndefined();

    await saveWritingProfile("  Personal, concrete, and restrained.  ");
    expect(await loadWritingProfile()).toBe("Personal, concrete, and restrained.");
  });

  it("rejects oversized profile text", async () => {
    await expect(saveWritingProfile("x".repeat(MAX_WRITING_PROFILE_LENGTH + 1))).rejects.toThrow();
  });
});
