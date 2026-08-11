import type { GenerationInput } from "../core/generation/types";
import { isGenerationInput } from "../core/generation/validation";

export const PENDING_X_CONTEXT_STORAGE_KEY = "postmuse.pendingXContext";
const PENDING_CONTEXT_TTL_MS = 5 * 60 * 1000;

interface PendingXContextV1 {
  schemaVersion: 1;
  expiresAt: number;
  input: GenerationInput;
}

const isPendingXContext = (value: unknown): value is PendingXContextV1 =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  (value as Record<string, unknown>).schemaVersion === 1 &&
  typeof (value as Record<string, unknown>).expiresAt === "number" &&
  isGenerationInput((value as Record<string, unknown>).input);

const canUseSessionStorage = () =>
  typeof chrome !== "undefined" && chrome.storage?.session !== undefined;

export const savePendingXContext = async (
  input: GenerationInput,
  now = Date.now(),
): Promise<void> => {
  if (!canUseSessionStorage()) {
    return;
  }
  const value: PendingXContextV1 = {
    schemaVersion: 1,
    expiresAt: now + PENDING_CONTEXT_TTL_MS,
    input,
  };
  await chrome.storage.session.set({ [PENDING_X_CONTEXT_STORAGE_KEY]: value });
};

export const takePendingXContext = async (
  now = Date.now(),
): Promise<GenerationInput | undefined> => {
  if (!canUseSessionStorage()) {
    return undefined;
  }
  const stored = await chrome.storage.session.get(PENDING_X_CONTEXT_STORAGE_KEY);
  const value = stored[PENDING_X_CONTEXT_STORAGE_KEY];
  if (value !== undefined) {
    await chrome.storage.session.remove(PENDING_X_CONTEXT_STORAGE_KEY);
  }
  return isPendingXContext(value) && value.expiresAt >= now ? value.input : undefined;
};
