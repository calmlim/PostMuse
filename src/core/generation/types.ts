import type { ProviderId } from "../settings/types";

export const CONTENT_TYPES = ["post", "reply", "quote", "thread", "long-post"] as const;
export const SOURCE_KINDS = ["idea", "draft", "file"] as const;
export const OUTPUT_LENGTHS = ["short", "medium", "long", "custom"] as const;
export const LANGUAGE_MODES = ["follow-source", "fixed"] as const;
export const REPLY_INTENTS = [
  "agree-and-add",
  "respectful-disagree",
  "question",
  "humorous",
] as const;
export const QUOTE_INTENTS = ["comment", "summarize", "extend"] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];
export type SourceKind = (typeof SOURCE_KINDS)[number];
export type OutputLength = (typeof OUTPUT_LENGTHS)[number];
export type ReplyIntent = (typeof REPLY_INTENTS)[number];
export type QuoteIntent = (typeof QUOTE_INTENTS)[number];
export type GenerationIntent = ReplyIntent | QuoteIntent;
export const GENERATION_WARNINGS = [
  "RAW_TEXT_FALLBACK",
  "PARTIAL_THREAD_RESULT",
  "PARTIAL_CANDIDATE_RESULT",
  "LENGTH_BELOW_TARGET",
  "LENGTH_ABOVE_TARGET",
] as const;
export type GenerationWarning = (typeof GENERATION_WARNINGS)[number];

export interface GenerationInput {
  source: {
    kind: SourceKind;
    text: string;
  };
  contentType: ContentType;
  intent?: GenerationIntent;
  language: {
    mode: (typeof LANGUAGE_MODES)[number];
    value?: string;
  };
  styleId: string;
  length: OutputLength;
  customLength?: number;
  audience?: string;
  goal?: string;
  tone?: string;
  mustInclude?: string;
  mustAvoid?: string;
  candidateCount: number;
  threadCount?: number;
}

export const getCustomLengthBounds = (contentType: ContentType) =>
  contentType === "long-post"
    ? { min: 100, max: 25_000, defaultValue: 2_000 }
    : { min: 1, max: 25_000, defaultValue: 180 };

export interface GeneratedText {
  id: string;
  text: string;
}

interface GenerationResultBase {
  provider: ProviderId;
  model: string;
  warnings: GenerationWarning[];
  softCharacterLimit?: number;
  contentType: ContentType;
}

export interface CandidateGenerationResult extends GenerationResultBase {
  format: "candidates";
  candidates: GeneratedText[];
}

export interface ThreadGenerationResult extends GenerationResultBase {
  format: "thread";
  threads: Array<{
    id: string;
    posts: GeneratedText[];
  }>;
}

export interface RawGenerationResult extends GenerationResultBase {
  format: "raw";
  rawText: string;
  warnings: ["RAW_TEXT_FALLBACK", ...GenerationWarning[]];
}

export type GenerationResult =
  | CandidateGenerationResult
  | ThreadGenerationResult
  | RawGenerationResult;

export interface RegenerationInput {
  input: GenerationInput;
  target: {
    kind: "candidate" | "thread-post";
    index: number;
    currentTexts: string[];
  };
}

export interface RegenerationResult {
  text: string;
  provider: ProviderId;
  model: string;
}

export interface NormalizedTextRequest {
  system: string;
  user: string;
  schemaName: "post_candidates" | "thread" | "connection_test" | "target_regeneration";
  schema: Record<string, unknown>;
}

export interface NormalizedTextResponse {
  text: string;
}
