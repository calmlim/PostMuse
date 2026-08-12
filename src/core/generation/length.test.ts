import { describe, expect, it } from "vitest";
import { createGenerationInputFixture } from "./fixtures";
import {
  countUnicodeCharacters,
  getLengthStatus,
  getRecommendedMaxOutputTokens,
  getRequestedLengthBounds,
} from "./length";

describe("generation length guidance", () => {
  it("counts Unicode code points instead of UTF-16 units", () => {
    expect(countUnicodeCharacters("A😀中")).toBe(3);
  });

  it("computes conservative token guidance from actual item count", () => {
    expect(getRecommendedMaxOutputTokens(createGenerationInputFixture())).toBe(856);
    expect(
      getRecommendedMaxOutputTokens(
        createGenerationInputFixture({
          contentType: "thread",
          candidateCount: 1,
          threadCount: 5,
          length: "long",
        }),
      ),
    ).toBe(1_656);
  });

  it("uses a ten-percent status range for a custom target", () => {
    const input = createGenerationInputFixture({ length: "custom", customLength: 100 });
    expect(getRequestedLengthBounds(input)).toEqual({ min: 90, max: 110 });
    expect(getLengthStatus("x".repeat(89), input)).toBe("below");
    expect(getLengthStatus("x".repeat(100), input)).toBe("within");
    expect(getLengthStatus("x".repeat(111), input)).toBe("above");
  });
});
