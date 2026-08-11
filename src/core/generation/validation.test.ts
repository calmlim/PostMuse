import { describe, expect, it } from "vitest";
import { createGenerationInputFixture } from "./fixtures";
import { isGenerationInput, MAX_SOURCE_CHARACTERS } from "./validation";

describe("generation input validation", () => {
  it("accepts a bounded standard post request", () => {
    expect(isGenerationInput(createGenerationInputFixture())).toBe(true);
  });

  it("enforces source, candidate and thread bounds", () => {
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

  it("requires a fixed language value and one result for long formats", () => {
    expect(
      isGenerationInput(createGenerationInputFixture({ language: { mode: "fixed", value: "" } })),
    ).toBe(false);
    expect(isGenerationInput(createGenerationInputFixture({ contentType: "long-post" }))).toBe(
      false,
    );
  });
});
