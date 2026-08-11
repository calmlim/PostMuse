import { describe, expect, it } from "vitest";
import { createDefaultPromptLibrary, resolvePromptLibrary } from "./library";
import { BUILT_IN_STYLES } from "./styles";

describe("prompt library merge", () => {
  it("uses upgraded seeds without overwriting a user override", () => {
    const library = createDefaultPromptLibrary();
    library.overrides = [
      {
        styleId: "professional",
        baseVersion: 1,
        label: "My professional voice",
        instruction: "Use my saved writing rules.",
      },
    ];
    const upgradedSeeds = BUILT_IN_STYLES.map((seed) => ({
      ...seed,
      version: seed.version + 1,
      instruction: `${seed.instruction} Upgraded.`,
    }));

    const resolved = resolvePromptLibrary(library, upgradedSeeds);

    expect(resolved.active.find((style) => style.id === "professional")).toMatchObject({
      version: 2,
      label: "My professional voice",
      instruction: "Use my saved writing rules.",
      isOverridden: true,
    });
    expect(resolved.active.find((style) => style.id === "concise")?.instruction).toContain(
      "Upgraded.",
    );
  });

  it("keeps hidden built-ins recoverable and appends missing seed ids", () => {
    const library = createDefaultPromptLibrary();
    library.hiddenBuiltInIds = ["concise"];
    library.order = ["friendly", "professional"];

    const resolved = resolvePromptLibrary(library);

    expect(resolved.active[0].id).toBe("friendly");
    expect(resolved.hidden).toHaveLength(1);
    expect(resolved.hidden[0].id).toBe("concise");
    expect(resolved.active).toHaveLength(BUILT_IN_STYLES.length - 1);
  });
});
