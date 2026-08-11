import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStorageAreaMock, type StorageAreaMock } from "../test/chrome-storage";
import { getSecretStatus, readApiKey, saveApiKey, SECRETS_STORAGE_KEY } from "./secrets-repository";

let local: StorageAreaMock;
let session: StorageAreaMock;

beforeEach(() => {
  local = createStorageAreaMock();
  session = createStorageAreaMock();
  vi.stubGlobal("chrome", { storage: { local, session } });
});

describe("secrets repository", () => {
  it("stores keys in session storage by default", async () => {
    await saveApiKey("profile-1", "  sk-session-value  ", "session");

    await expect(readApiKey("profile-1", "session")).resolves.toBe("sk-session-value");
    await expect(getSecretStatus("profile-1")).resolves.toEqual({
      hasKey: true,
      persistence: "session",
    });
    expect(local.data[SECRETS_STORAGE_KEY]).toBeUndefined();
  });

  it("moves a key between local and session storage without duplicating it", async () => {
    await saveApiKey("profile-1", "sk-session-value", "session");
    await saveApiKey("profile-1", "sk-local-value", "local");

    await expect(readApiKey("profile-1", "local")).resolves.toBe("sk-local-value");
    await expect(readApiKey("profile-1", "session")).resolves.toBeUndefined();
    await expect(getSecretStatus("profile-1")).resolves.toEqual({
      hasKey: true,
      persistence: "local",
    });
  });
});
