import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStorageAreaMock, type StorageAreaMock } from "../test/chrome-storage";
import {
  deleteCustomPrompt,
  hideBuiltInPrompt,
  loadPromptLibrary,
  loadResolvedPromptLibrary,
  PROMPT_LIBRARY_STORAGE_KEY,
  restoreBuiltInPrompt,
  savePromptTemplate,
} from "./prompt-repository";

let local: StorageAreaMock;

beforeEach(() => {
  local = createStorageAreaMock();
  vi.stubGlobal("chrome", { storage: { local } });
  vi.stubGlobal("crypto", { randomUUID: () => "prompt-test-id" });
});

describe("prompt repository", () => {
  it("initializes invalid storage with a valid v1 library", async () => {
    local.data[PROMPT_LIBRARY_STORAGE_KEY] = { schemaVersion: 99 };

    const library = await loadPromptLibrary();

    expect(library).toMatchObject({ schemaVersion: 1, seedVersion: 1 });
    expect(local.data[PROMPT_LIBRARY_STORAGE_KEY]).toEqual(library);
  });

  it("edits, hides, and restores a built-in without changing its seed", async () => {
    await savePromptTemplate("professional", "My voice", "Use concrete examples.");
    expect((await loadResolvedPromptLibrary()).active[0]).toMatchObject({
      id: "professional",
      label: "My voice",
      instruction: "Use concrete examples.",
      isOverridden: true,
    });

    await hideBuiltInPrompt("professional");
    expect((await loadResolvedPromptLibrary()).hidden[0].id).toBe("professional");

    await restoreBuiltInPrompt("professional");
    expect((await loadResolvedPromptLibrary()).active[0]).toMatchObject({
      id: "professional",
      label: "Professional",
      isOverridden: false,
    });
  });

  it("creates, edits, and deletes a custom template", async () => {
    await savePromptTemplate(undefined, "Founder voice", "Write from hard-earned experience.");
    let custom = (await loadResolvedPromptLibrary()).active.at(-1);
    expect(custom).toMatchObject({ id: "custom-prompt-test-id", source: "custom" });

    await savePromptTemplate(custom?.id, "Operator voice", "Prefer operating details.");
    custom = (await loadResolvedPromptLibrary()).active.at(-1);
    expect(custom).toMatchObject({
      label: "Operator voice",
      instruction: "Prefer operating details.",
    });

    await deleteCustomPrompt("custom-prompt-test-id");
    expect((await loadResolvedPromptLibrary()).active).toHaveLength(10);
  });
});
