import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerationInputFixture } from "../core/generation/fixtures";
import { createStorageAreaMock, type StorageAreaMock } from "../test/chrome-storage";
import { savePendingXContext, takePendingXContext } from "./pending-context";

let session: StorageAreaMock;

beforeEach(() => {
  session = createStorageAreaMock();
  vi.stubGlobal("chrome", { storage: { session } });
});

describe("pending X context", () => {
  it("is one-shot and expires", async () => {
    const input = createGenerationInputFixture();
    await savePendingXContext(input, 1_000);
    await expect(takePendingXContext(2_000)).resolves.toEqual(input);
    await expect(takePendingXContext(2_000)).resolves.toBeUndefined();

    await savePendingXContext(input, 1_000);
    await expect(takePendingXContext(1_000 + 5 * 60 * 1000 + 1)).resolves.toBeUndefined();
  });
});
