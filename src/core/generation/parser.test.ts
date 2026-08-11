import { describe, expect, it } from "vitest";
import { createGenerationInputFixture } from "./fixtures";
import { parseGenerationOutput } from "./parser";

const metadata = { provider: "openai-compatible" as const, model: "test-model" };

describe("generation output parser", () => {
  it("parses fenced candidates and trims extra results", () => {
    const result = parseGenerationOutput(
      '```json\n{"candidates":[{"text":" One "},{"text":"Two"}]}\n```',
      createGenerationInputFixture({ candidateCount: 1 }),
      metadata,
    );

    expect(result).toMatchObject({
      format: "candidates",
      candidates: [{ text: "One" }],
      warnings: [],
    });
  });

  it("repairs a single JSON object surrounded by commentary", () => {
    const result = parseGenerationOutput(
      'Here it is: {"candidates":[{"text":"Usable"}]} Thanks',
      createGenerationInputFixture({ candidateCount: 1 }),
      metadata,
    );

    expect(result).toMatchObject({ format: "candidates", candidates: [{ text: "Usable" }] });
  });

  it("preserves invalid structured output as editable raw text", () => {
    const result = parseGenerationOutput(
      "A useful draft that is not JSON.",
      createGenerationInputFixture(),
      metadata,
    );

    expect(result).toEqual({
      format: "raw",
      contentType: "post",
      rawText: "A useful draft that is not JSON.",
      warnings: ["RAW_TEXT_FALLBACK"],
      softCharacterLimit: 280,
      ...metadata,
    });
  });

  it("parses and independently identifies thread posts", () => {
    const result = parseGenerationOutput(
      '{"threads":[{"posts":["Hook","Detail","Close"]}]}',
      createGenerationInputFixture({
        contentType: "thread",
        candidateCount: 1,
        threadCount: 3,
      }),
      metadata,
    );

    expect(result).toMatchObject({
      format: "thread",
      threads: [{ posts: [{ text: "Hook" }, { text: "Detail" }, { text: "Close" }] }],
    });
  });
});
