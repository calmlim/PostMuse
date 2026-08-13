import { describe, expect, it } from "vitest";
import { createGenerationInputFixture } from "../core/generation/fixtures";
import { buildRegenerationUserPrompt } from "./text-regeneration";

describe("target regeneration context", () => {
  it("keeps only the target and neighboring thread posts", () => {
    const prompt = buildRegenerationUserPrompt(
      {
        input: createGenerationInputFixture({
          contentType: "thread",
          candidateCount: 1,
          threadCount: 5,
        }),
        target: {
          kind: "thread-post",
          index: 2,
          currentTexts: ["Distant opening", "Previous", "Target", "Next", "Distant close"],
        },
      },
      "middle development post",
    );

    expect(prompt).toContain('"index":1');
    expect(prompt).toContain('"index":2');
    expect(prompt).toContain('"index":3');
    expect(prompt).not.toContain("Distant opening");
    expect(prompt).not.toContain("Distant close");
  });

  it("bounds source and related candidate context while preserving the full target", () => {
    const prompt = buildRegenerationUserPrompt(
      {
        input: createGenerationInputFixture({
          source: { kind: "draft", text: "s".repeat(100_000) },
          candidateCount: 3,
          length: "custom",
          customLength: 25_000,
        }),
        target: {
          kind: "candidate",
          index: 2,
          currentTexts: ["a".repeat(25_000), "b".repeat(25_000), "t".repeat(25_000)],
        },
      },
      "candidate",
    );

    expect(prompt).toContain("Context shortened locally");
    expect(prompt).toContain("t".repeat(25_000));
    expect(prompt.length).toBeLessThan(55_000);
  });
});
