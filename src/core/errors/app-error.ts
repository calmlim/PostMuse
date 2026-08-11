import type { ExtensionError, ExtensionErrorCode } from "../contracts/messages";

export class AppError extends Error {
  constructor(
    public readonly code: ExtensionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

const SECRET_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi,
  /\b(?:sk|key)-[A-Za-z0-9_-]{6,}\b/gi,
  /\bAIza[A-Za-z0-9_-]{20,}\b/g,
];

export const redactSecrets = (value: string): string =>
  SECRET_PATTERNS.reduce((redacted, pattern) => redacted.replace(pattern, "[REDACTED]"), value);

export const toExtensionError = (error: unknown): ExtensionError => {
  if (error instanceof AppError) {
    return { code: error.code, message: redactSecrets(error.message) };
  }

  const message = error instanceof Error ? error.message : "Unexpected extension error.";
  return { code: "INTERNAL_ERROR", message: redactSecrets(message) };
};
