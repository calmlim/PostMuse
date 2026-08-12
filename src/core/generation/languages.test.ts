import { describe, expect, it } from "vitest";
import { isOutputLanguageId, OUTPUT_LANGUAGE_IDS, OUTPUT_LANGUAGE_OPTIONS } from "./languages";

describe("output language catalog", () => {
  it("contains unique common language identifiers", () => {
    expect(new Set(OUTPUT_LANGUAGE_IDS).size).toBe(OUTPUT_LANGUAGE_IDS.length);
    expect(OUTPUT_LANGUAGE_OPTIONS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "ja", label: "日本語" }),
        expect.objectContaining({ id: "es", label: "Español" }),
        expect.objectContaining({ id: "ar", label: "العربية" }),
      ]),
    );
  });

  it("recognizes only catalog language ids", () => {
    expect(isOutputLanguageId("vi")).toBe(true);
    expect(isOutputLanguageId("custom-language")).toBe(false);
  });
});
