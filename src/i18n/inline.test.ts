import { describe, expect, it } from "vitest";
import { getInlineMessages } from "./inline";
import { UI_LOCALE_OPTIONS } from "./locale";

const placeholders = (value: string): string[] => value.match(/\{[^}]+\}/g)?.sort() ?? [];

describe("inline catalogs", () => {
  it("keeps the same keys and placeholders in all ten locales", () => {
    const english = getInlineMessages("en");
    const keys = Object.keys(english).sort();
    expect(UI_LOCALE_OPTIONS).toHaveLength(10);
    for (const { id } of UI_LOCALE_OPTIONS) {
      const catalog = getInlineMessages(id);
      expect(Object.keys(catalog).sort()).toEqual(keys);
      for (const key of keys) {
        expect(placeholders(catalog[key as keyof typeof catalog])).toEqual(
          placeholders(english[key as keyof typeof english]),
        );
      }
    }
  });
});
