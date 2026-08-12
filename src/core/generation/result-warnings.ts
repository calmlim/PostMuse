import type { GenerationInput, GenerationResult, GenerationWarning } from "./types";
import { getLengthStatus } from "./length";

const LENGTH_WARNINGS = new Set<GenerationWarning>(["LENGTH_BELOW_TARGET", "LENGTH_ABOVE_TARGET"]);

const getResultTexts = (result: GenerationResult): string[] => {
  if (result.format === "candidates") {
    return result.candidates.map((candidate) => candidate.text);
  }
  if (result.format === "thread") {
    return result.threads[0]?.posts.map((post) => post.text) ?? [];
  }
  return [result.rawText];
};

export const refreshLengthWarnings = (
  result: GenerationResult,
  input: GenerationInput,
): GenerationResult => {
  const preserved = result.warnings.filter((warning) => !LENGTH_WARNINGS.has(warning));
  const statuses = getResultTexts(result).map((text) => getLengthStatus(text, input));
  const lengthWarnings: GenerationWarning[] = [
    ...(statuses.includes("below") ? (["LENGTH_BELOW_TARGET"] as const) : []),
    ...(statuses.includes("above") ? (["LENGTH_ABOVE_TARGET"] as const) : []),
  ];
  const warnings = [...preserved, ...lengthWarnings];

  return result.format === "raw"
    ? {
        ...result,
        warnings: ["RAW_TEXT_FALLBACK", ...warnings.filter((item) => item !== "RAW_TEXT_FALLBACK")],
      }
    : { ...result, warnings };
};
