import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, getMessages, resolveLocale, UI_LOCALE_OPTIONS } from ".";

describe("localization catalog", () => {
  it("keeps every supported interface language complete", () => {
    const englishKeys = Object.keys(getMessages("en")).sort();
    for (const { id } of UI_LOCALE_OPTIONS) {
      expect(Object.keys(getMessages(id)).sort()).toEqual(englishKeys);
    }
  });

  it("uses English as the default interface language", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(getMessages(DEFAULT_LOCALE).createTitle).toBe("Create");
  });

  it("resolves browser language variants with an English fallback", () => {
    expect(resolveLocale("zh-Hant-HK")).toBe("zh-TW");
    expect(resolveLocale("pt-PT")).toBe("pt-BR");
    expect(resolveLocale("es-MX")).toBe("es");
    expect(resolveLocale("unknown")).toBe("en");
  });
});
