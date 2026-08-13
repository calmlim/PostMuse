import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerationInputFixture } from "../core/generation/fixtures";
import type { GenerationResult } from "../core/generation/types";
import { isHistoryRecordV1, isImageHistoryRecordV2 } from "../core/history/types";
import type { ImageGenerationInput, ImageGenerationResult } from "../core/image/types";
import {
  clearHistoryRecords,
  deleteHistoryRecord,
  listHistoryRecords,
  loadHistoryImageBlob,
  saveHistoryRecord,
  saveImageHistoryRecord,
  updateHistoryMedia,
  updateHistoryResult,
} from "./history-repository";

const resultFixture = (text: string): GenerationResult => ({
  format: "candidates",
  contentType: "post",
  candidates: [{ id: "candidate-1", text }],
  warnings: [],
  provider: "openai-compatible",
  model: "test-model",
  softCharacterLimit: 280,
});

const imageInputFixture: ImageGenerationInput = {
  sourceText: "A clean companion image",
  prompt: "A clean companion image",
  style: "editorial",
  aspectRatio: "1:1",
  size: "1K",
  includeText: false,
};

const imageResultFixture: ImageGenerationResult = {
  provider: "openai",
  model: "gpt-image-2",
  prompt: "A clean companion image",
  aspectRatio: "1:1",
  size: "1K",
  mimeType: "image/png",
  base64Data: "aW1hZ2U=",
  pixelWidth: 1024,
  pixelHeight: 1024,
};

beforeEach(() => {
  let id = 0;
  vi.stubGlobal("crypto", { randomUUID: () => `history-test-${++id}` });
});

describe("history repository", () => {
  it("keeps the newest 100 records transactionally", async () => {
    for (let index = 0; index < 101; index += 1) {
      await saveHistoryRecord(
        createGenerationInputFixture({
          source: { kind: "idea", text: `Idea ${index}` },
          candidateCount: 1,
        }),
        resultFixture(`Result ${index}`),
        { recipeVersion: 1, styleTemplateVersion: 1, now: new Date(index * 1_000) },
      );
    }

    const records = await listHistoryRecords();
    expect(records).toHaveLength(100);
    const textRecords = records.filter(isHistoryRecordV1);
    expect(textRecords[0].input.source.text).toBe("Idea 100");
    expect(textRecords.at(-1)?.input.source.text).toBe("Idea 1");
  });

  it("persists edits across database reopen and sorts by updatedAt", async () => {
    const first = await saveHistoryRecord(
      createGenerationInputFixture({ candidateCount: 1 }),
      resultFixture("Original"),
      { recipeVersion: 1, styleTemplateVersion: 1, now: new Date(1_000) },
    );
    await saveHistoryRecord(
      createGenerationInputFixture({
        source: { kind: "idea", text: "Second idea" },
        candidateCount: 1,
      }),
      resultFixture("Second"),
      { recipeVersion: 1, styleTemplateVersion: 1, now: new Date(2_000) },
    );

    await updateHistoryResult(first.id, resultFixture("Edited"), new Date(3_000));
    const records = await listHistoryRecords();

    expect(records[0]).toMatchObject({
      id: first.id,
      result: { candidates: [{ text: "Edited" }] },
    });
  });

  it("deletes one record or clears the store", async () => {
    const first = await saveHistoryRecord(
      createGenerationInputFixture({ candidateCount: 1 }),
      resultFixture("First"),
      { recipeVersion: 1, styleTemplateVersion: 1 },
    );
    await saveHistoryRecord(
      createGenerationInputFixture({
        source: { kind: "idea", text: "Second idea" },
        candidateCount: 1,
      }),
      resultFixture("Second"),
      { recipeVersion: 1, styleTemplateVersion: 1 },
    );

    await deleteHistoryRecord(first.id);
    expect(await listHistoryRecords()).toHaveLength(1);
    await clearHistoryRecords();
    expect(await listHistoryRecords()).toEqual([]);
  });

  it("stores companion image metadata and binary locally", async () => {
    const record = await saveHistoryRecord(
      createGenerationInputFixture({ candidateCount: 1 }),
      resultFixture("Companion image source"),
      { recipeVersion: 1, styleTemplateVersion: 1 },
    );

    await updateHistoryMedia(record.id, imageResultFixture);

    const stored = (await listHistoryRecords()).find((item) => item.id === record.id);
    expect(stored && isHistoryRecordV1(stored) ? stored.media : undefined).toMatchObject({
      provider: "openai",
      size: "1K",
      pixelWidth: 1024,
    });
    expect(JSON.stringify(stored)).not.toContain("base64Data");
    expect(await loadHistoryImageBlob(record.id)).toMatchObject({ size: 5, type: "image/png" });
  });

  it("stores standalone images as first-class history records", async () => {
    const record = await saveImageHistoryRecord(imageInputFixture, imageResultFixture);
    const stored = (await listHistoryRecords()).find((item) => item.id === record.id);

    expect(stored && isImageHistoryRecordV2(stored) ? stored.input.sourceText : undefined).toBe(
      "A clean companion image",
    );
    expect(stored?.result).toMatchObject({ provider: "openai", aspectRatio: "1:1" });
    expect(JSON.stringify(stored)).not.toContain("base64Data");
    expect(await loadHistoryImageBlob(record.id)).toMatchObject({ size: 5, type: "image/png" });

    await deleteHistoryRecord(record.id);
    expect(await loadHistoryImageBlob(record.id)).toBeUndefined();
  });

  it("rejects generated history items beyond the X long-post boundary", async () => {
    await expect(
      saveHistoryRecord(
        createGenerationInputFixture({ candidateCount: 1 }),
        resultFixture("x".repeat(25_001)),
        { recipeVersion: 1, styleTemplateVersion: 1 },
      ),
    ).rejects.toThrow("History record failed validation");
  });

  it("evicts oldest large records when the history byte budget is reached", async () => {
    for (let index = 0; index < 18; index += 1) {
      await saveHistoryRecord(
        createGenerationInputFixture({
          source: { kind: "idea", text: `${index}-${"s".repeat(99_995)}` },
          contentType: "thread",
          candidateCount: 1,
          threadCount: 20,
        }),
        {
          format: "thread",
          contentType: "thread",
          threads: [
            {
              id: `thread-${index}`,
              posts: Array.from({ length: 20 }, (_, postIndex) => ({
                id: `post-${postIndex}`,
                text: "x".repeat(25_000),
              })),
            },
          ],
          warnings: [],
          provider: "xai",
          model: "grok-test",
          softCharacterLimit: 25_000,
        },
        { recipeVersion: 1, styleTemplateVersion: 1, now: new Date(index * 1_000) },
      );
    }

    const records = await listHistoryRecords();
    expect(records.length).toBeLessThan(18);
    const textRecords = records.filter(isHistoryRecordV1);
    expect(textRecords[0].input.source.text).toMatch(/^17-/);
    expect(textRecords.at(-1)?.input.source.text).not.toMatch(/^0-/);
  });
});
