import type { ProviderId } from "../settings/types";

export const CONTENT_TYPES = ["post", "reply", "quote", "thread", "long-post"] as const;
export const SOURCE_KINDS = ["idea", "draft", "file"] as const;
export const OUTPUT_LENGTHS = ["short", "medium", "long"] as const;
export const LANGUAGE_MODES = ["follow-source", "fixed"] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];
export type SourceKind = (typeof SOURCE_KINDS)[number];
export type OutputLength = (typeof OUTPUT_LENGTHS)[number];

export interface GenerationInput {
  source: {
    kind: SourceKind;
    text: string;
  };
  contentType: ContentType;
  language: {
    mode: (typeof LANGUAGE_MODES)[number];
    value?: string;
  };
  styleId: string;
  length: OutputLength;
  audience?: string;
  goal?: string;
  tone?: string;
  mustInclude?: string;
  mustAvoid?: string;
  candidateCount: number;
  threadCount?: number;
}

export interface GeneratedText {
  id: string;
  text: string;
}

interface GenerationResultBase {
  provider: ProviderId;
  model: string;
  warnings: string[];
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
  warnings: ["RAW_TEXT_FALLBACK", ...string[]];
}

export type GenerationResult =
  | CandidateGenerationResult
  | ThreadGenerationResult
  | RawGenerationResult;

export interface NormalizedTextRequest {
  system: string;
  user: string;
  schemaName: "post_candidates" | "thread";
  schema: Record<string, unknown>;
}

export interface NormalizedTextResponse {
  text: string;
}
