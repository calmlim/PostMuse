import { describe, expect, it } from "vitest";
import type { GenerationInput, GenerationResult } from "./types";
import { refreshLengthWarnings } from "./result-warnings";

const input: GenerationInput = {
  source: { kind: "draft", text: "Source" },
  contentType: "post",
  language: { mode: "follow-source" },
  styleId: "professional",
  length: "short",
  candidateCount: 1,
};

describe("result length warnings", () => {
  it("refreshes length warnings while preserving structural warnings", () => {
    const result: GenerationResult = {
      format: "candidates",
      contentType: "post",
      candidates: [{ id: "candidate-1", text: "x".repeat(60) }],
      warnings: ["PARTIAL_CANDIDATE_RESULT", "LENGTH_ABOVE_TARGET"],
      provider: "anthropic",
      model: "test-model",
    };

    expect(refreshLengthWarnings(result, input).warnings).toEqual(["PARTIAL_CANDIDATE_RESULT"]);
  });

  it("keeps the raw fallback marker first", () => {
    const result: GenerationResult = {
      format: "raw",
      contentType: "post",
      rawText: "tiny",
      warnings: ["RAW_TEXT_FALLBACK"],
      provider: "gemini",
      model: "test-model",
    };

    expect(refreshLengthWarnings(result, input).warnings).toEqual([
      "RAW_TEXT_FALLBACK",
      "LENGTH_BELOW_TARGET",
    ]);
  });
});
