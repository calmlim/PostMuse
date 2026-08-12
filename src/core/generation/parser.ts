import { isRecordValue } from "../settings/validation";
import type { GenerationInput, GenerationResult } from "./types";
import type { ProviderId } from "../settings/types";
import { getLengthStatus } from "./length";
import type { GenerationWarning } from "./types";

const createLocalId = (prefix: string, index: number): string => `${prefix}-${index + 1}`;

const stripCodeFence = (value: string): string => {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1]?.trim() ?? trimmed;
};

const parseJsonWithDeterministicRepair = (value: string): unknown => {
  const cleaned = stripCodeFence(value);

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace < 0 || lastBrace <= firstBrace) {
      return undefined;
    }

    try {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    } catch {
      return undefined;
    }
  }
};

interface ParseMetadata {
  provider: ProviderId;
  model: string;
}

const getLengthWarnings = (texts: string[], input: GenerationInput): GenerationWarning[] => {
  const statuses = texts.map((text) => getLengthStatus(text, input));
  return [
    ...(statuses.includes("below") ? (["LENGTH_BELOW_TARGET"] as const) : []),
    ...(statuses.includes("above") ? (["LENGTH_ABOVE_TARGET"] as const) : []),
  ];
};

export const parseGenerationOutput = (
  rawText: string,
  input: GenerationInput,
  metadata: ParseMetadata,
): GenerationResult => {
  const parsed = parseJsonWithDeterministicRepair(rawText);
  const softCharacterLimit = input.contentType === "long-post" ? undefined : 280;
  const contentType = input.contentType;

  if (input.contentType === "thread" && isRecordValue(parsed) && Array.isArray(parsed.threads)) {
    const threads = parsed.threads
      .filter(isRecordValue)
      .map((thread, threadIndex) => ({
        id: createLocalId("thread", threadIndex),
        posts: Array.isArray(thread.posts)
          ? thread.posts
              .filter((post): post is string => typeof post === "string" && post.trim().length > 0)
              .slice(0, input.threadCount)
              .map((text, postIndex) => ({
                id: createLocalId(`thread-${threadIndex + 1}-post`, postIndex),
                text: text.trim(),
              }))
          : [],
      }))
      .filter((thread) => thread.posts.length > 0)
      .slice(0, 1);

    if (threads.length > 0) {
      const warnings: GenerationWarning[] = [
        ...(threads[0].posts.length === input.threadCount
          ? []
          : ["PARTIAL_THREAD_RESULT" as const]),
        ...getLengthWarnings(
          threads[0].posts.map((post) => post.text),
          input,
        ),
      ];
      return { format: "thread", threads, warnings, softCharacterLimit, contentType, ...metadata };
    }
  }

  if (input.contentType !== "thread" && isRecordValue(parsed) && Array.isArray(parsed.candidates)) {
    const candidates = parsed.candidates
      .filter(isRecordValue)
      .map((candidate) => candidate.text)
      .filter((text): text is string => typeof text === "string" && text.trim().length > 0)
      .slice(0, input.candidateCount)
      .map((text, index) => ({ id: createLocalId("candidate", index), text: text.trim() }));

    if (candidates.length > 0) {
      const warnings: GenerationWarning[] = [
        ...(candidates.length === input.candidateCount
          ? []
          : ["PARTIAL_CANDIDATE_RESULT" as const]),
        ...getLengthWarnings(
          candidates.map((candidate) => candidate.text),
          input,
        ),
      ];
      return {
        format: "candidates",
        candidates,
        warnings,
        softCharacterLimit,
        contentType,
        ...metadata,
      };
    }
  }

  return {
    format: "raw",
    rawText: stripCodeFence(rawText),
    warnings: ["RAW_TEXT_FALLBACK"],
    softCharacterLimit,
    contentType,
    ...metadata,
  };
};
