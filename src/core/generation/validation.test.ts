import { describe, expect, it } from "vitest";
import { createGenerationInputFixture } from "./fixtures";
import { isGenerationInput, isRegenerationInput, MAX_SOURCE_CHARACTERS } from "./validation";

describe("generation input validation", () => {
  it("accepts a bounded standard post request", () => {
    expect(isGenerationInput(createGenerationInputFixture())).toBe(true);
  });

  it("enforces source, candidate and thread bounds", () => {
    expect(
      isGenerationInput(
        createGenerationInputFixture({
          source: { kind: "idea", text: "x".repeat(MAX_SOURCE_CHARACTERS) },
        }),
      ),
    ).toBe(true);
    expect(
      isGenerationInput(createGenerationInputFixture({ source: { kind: "idea", text: "" } })),
    ).toBe(false);
    expect(
      isGenerationInput(
        createGenerationInputFixture({
          source: { kind: "idea", text: "x".repeat(MAX_SOURCE_CHARACTERS + 1) },
        }),
      ),
    ).toBe(false);
    expect(isGenerationInput(createGenerationInputFixture({ candidateCount: 6 }))).toBe(false);
    expect(
      isGenerationInput(
        createGenerationInputFixture({
          contentType: "thread",
          candidateCount: 1,
          threadCount: 21,
        }),
      ),
    ).toBe(false);
  });

  it("accepts only intents valid for replies and quotes", () => {
    expect(
      isGenerationInput(
        createGenerationInputFixture({ contentType: "reply", intent: "respectful-disagree" }),
      ),
    ).toBe(true);
    expect(
      isGenerationInput(
        createGenerationInputFixture({ contentType: "quote", intent: "summarize" }),
      ),
    ).toBe(true);
    expect(
      isGenerationInput(createGenerationInputFixture({ contentType: "post", intent: "question" })),
    ).toBe(false);
    expect(
      isGenerationInput(createGenerationInputFixture({ contentType: "quote", intent: "question" })),
    ).toBe(false);
  });

  it("validates candidate and thread regeneration targets", () => {
    expect(
      isRegenerationInput({
        input: createGenerationInputFixture(),
        target: { kind: "candidate", index: 1, currentTexts: ["One", "Two"] },
      }),
    ).toBe(true);
    expect(
      isRegenerationInput({
        input: createGenerationInputFixture({
          contentType: "thread",
          candidateCount: 1,
          threadCount: 2,
        }),
        target: { kind: "thread-post", index: 1, currentTexts: ["Hook", "Close"] },
      }),
    ).toBe(true);
    expect(
      isRegenerationInput({
        input: createGenerationInputFixture(),
        target: { kind: "thread-post", index: 0, currentTexts: ["Wrong kind"] },
      }),
    ).toBe(false);
  });

  it("requires a fixed language value and one result for long formats", () => {
    expect(
      isGenerationInput(createGenerationInputFixture({ language: { mode: "fixed", value: "" } })),
    ).toBe(false);
    expect(isGenerationInput(createGenerationInputFixture({ contentType: "long-post" }))).toBe(
      false,
    );
  });

  it("accepts bounded custom style references and rejects malformed ids", () => {
    expect(
      isGenerationInput(createGenerationInputFixture({ styleId: "custom-personal-voice" })),
    ).toBe(true);
    expect(isGenerationInput(createGenerationInputFixture({ styleId: "../../escape" }))).toBe(
      false,
    );
  });
});
