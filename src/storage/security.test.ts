import { describe, expect, it, vi } from "vitest";
import { createStorageAreaMock } from "../test/chrome-storage";
import { initializeStorageSecurity } from "./security";

describe("storage access security", () => {
  it("blocks content scripts from local and session extension storage", async () => {
    const local = createStorageAreaMock();
    const session = createStorageAreaMock();
    vi.stubGlobal("chrome", { storage: { local, session } });

    await initializeStorageSecurity();

    expect(local.setAccessLevel).toHaveBeenCalledWith({ accessLevel: "TRUSTED_CONTEXTS" });
    expect(session.setAccessLevel).toHaveBeenCalledWith({ accessLevel: "TRUSTED_CONTEXTS" });
  });
});
