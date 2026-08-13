import { describe, expect, it } from "vitest";
import { createGenerationInputFixture } from "./fixtures";
import {
  countUnicodeCharacters,
  countXWeightedCharacters,
  getLengthStatus,
  getRecommendedMaxOutputTokens,
  getRequestedLengthBounds,
} from "./length";

describe("generation length guidance", () => {
  it("counts Unicode code points instead of UTF-16 units", () => {
    expect(countUnicodeCharacters("A😀中")).toBe(3);
  });

  it("uses X weighted counting for CJK, emoji and URLs", () => {
    expect(countXWeightedCharacters("abc")).toBe(3);
    expect(countXWeightedCharacters("中文")).toBe(4);
    expect(countXWeightedCharacters("😀")).toBe(2);
    expect(countXWeightedCharacters("See https://example.com/a/very/long/path")).toBe(27);
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

  it("never extends a custom tolerance beyond X's longer-post limit", () => {
    const input = createGenerationInputFixture({ length: "custom", customLength: 25_000 });
    expect(getRequestedLengthBounds(input)).toEqual({ min: 22_500, max: 25_000 });
    expect(getLengthStatus("x".repeat(25_001), input)).toBe("above");
  });
});
