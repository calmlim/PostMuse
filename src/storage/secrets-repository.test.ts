import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStorageAreaMock, type StorageAreaMock } from "../test/chrome-storage";
import { getSecretStatus, readApiKey, saveApiKey, SECRETS_STORAGE_KEY } from "./secrets-repository";

let local: StorageAreaMock;
let session: StorageAreaMock;
const binding = {
  profileId: "profile-1",
  scope: "text",
  provider: "openai-compatible",
  origin: "https://api.openai.com",
} as const;

beforeEach(() => {
  local = createStorageAreaMock();
  session = createStorageAreaMock();
  vi.stubGlobal("chrome", { storage: { local, session } });
});

describe("secrets repository", () => {
  it("stores keys in session storage by default", async () => {
    await saveApiKey(binding, "  sk-session-value  ", "session");

    await expect(readApiKey(binding, "session")).resolves.toBe("sk-session-value");
    await expect(getSecretStatus(binding)).resolves.toEqual({
      hasKey: true,
      persistence: "session",
    });
    expect(local.data[SECRETS_STORAGE_KEY]).toBeUndefined();
  });

  it("moves a key between local and session storage without duplicating it", async () => {
    await saveApiKey(binding, "sk-session-value", "session");
    await saveApiKey(binding, "sk-local-value", "local");

    await expect(readApiKey(binding, "local")).resolves.toBe("sk-local-value");
    await expect(readApiKey(binding, "session")).resolves.toBeUndefined();
    await expect(getSecretStatus(binding)).resolves.toEqual({
      hasKey: true,
      persistence: "local",
    });
  });

  it("never returns a key bound to a different Provider or origin", async () => {
    await saveApiKey(binding, "sk-bound-value", "session");
    const changed = { ...binding, origin: "https://proxy.example.com" };

    await expect(readApiKey(changed, "session")).resolves.toBeUndefined();
    await expect(getSecretStatus(changed)).resolves.toEqual({
      hasKey: false,
      requiresReentry: true,
    });
  });

  it("requires one-time re-entry for a legacy unbound key", async () => {
    session.data[SECRETS_STORAGE_KEY] = { "profile-1": "sk-legacy" };

    await expect(readApiKey(binding, "session")).resolves.toBeUndefined();
    await expect(getSecretStatus(binding)).resolves.toEqual({
      hasKey: false,
      requiresReentry: true,
    });
  });
});
