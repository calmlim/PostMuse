import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, getMessages } from ".";

describe("localization catalog", () => {
  it("keeps English and Simplified Chinese message keys identical", () => {
    expect(Object.keys(getMessages("zh-CN")).sort()).toEqual(Object.keys(getMessages("en")).sort());
  });

  it("uses English as the default interface language", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(getMessages(DEFAULT_LOCALE).createTitle).toBe("Create");
  });
});
