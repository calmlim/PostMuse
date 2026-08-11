import type { GenerationInput } from "./types";

export const createGenerationInputFixture = (
  overrides: Partial<GenerationInput> = {},
): GenerationInput => ({
  source: { kind: "idea", text: "A practical idea about writing better product updates." },
  contentType: "post",
  language: { mode: "fixed", value: "English" },
  styleId: "professional",
  length: "medium",
  candidateCount: 3,
  ...overrides,
});
