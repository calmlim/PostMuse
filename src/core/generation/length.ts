import type { ContentType, GenerationInput, OutputLength } from "./types";

export type LengthStatus = "below" | "within" | "above";

interface LengthBounds {
  min: number;
  max: number;
}

const PRESET_BOUNDS: Record<ContentType, Record<Exclude<OutputLength, "custom">, LengthBounds>> = {
  post: {
    short: { min: 40, max: 100 },
    medium: { min: 100, max: 200 },
    long: { min: 200, max: 280 },
  },
  reply: {
    short: { min: 40, max: 100 },
    medium: { min: 100, max: 200 },
    long: { min: 200, max: 280 },
  },
  quote: {
    short: { min: 40, max: 100 },
    medium: { min: 100, max: 200 },
    long: { min: 200, max: 280 },
  },
  thread: {
    short: { min: 40, max: 100 },
    medium: { min: 100, max: 180 },
    long: { min: 180, max: 280 },
  },
  "long-post": {
    short: { min: 300, max: 600 },
    medium: { min: 600, max: 1_200 },
    long: { min: 1_200, max: 2_000 },
  },
};

export const countUnicodeCharacters = (value: string): number => Array.from(value).length;

export const getRequestedLengthBounds = (input: GenerationInput): LengthBounds => {
  if (input.length !== "custom") {
    return PRESET_BOUNDS[input.contentType][input.length];
  }
  const target = input.customLength ?? 1;
  return {
    min: Math.max(1, Math.floor((target * 90) / 100)),
    max: Math.ceil((target * 110) / 100),
  };
};

export const getLengthStatus = (text: string, input: GenerationInput): LengthStatus => {
  const count = countUnicodeCharacters(text);
  const bounds = getRequestedLengthBounds(input);
  return count < bounds.min ? "below" : count > bounds.max ? "above" : "within";
};

export const getRecommendedMaxOutputTokens = (input: GenerationInput): number => {
  const perItemMaximum = getRequestedLengthBounds(input).max;
  const itemCount =
    input.contentType === "thread" ? (input.threadCount ?? 1) : input.candidateCount;
  return Math.min(100_000, perItemMaximum * itemCount + 256);
};
