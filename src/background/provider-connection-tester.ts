import { AppError } from "../core/errors/app-error";
import type { NormalizedTextRequest } from "../core/generation/types";
import type { ConnectionTestResult, ProviderProfile } from "../core/settings/types";
import { getTextProviderAdapter } from "../providers/text";

const CONNECTION_REQUEST: NormalizedTextRequest = {
  system: "This is a connection test. Return only the requested JSON object.",
  user: 'Return {"ok":true}. Do not include commentary.',
  schemaName: "connection_test",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["ok"],
    properties: { ok: { type: "boolean" } },
  },
};

export const runConnectionTest = async (
  profile: ProviderProfile,
  apiKey: string | undefined,
  signal: AbortSignal,
): Promise<ConnectionTestResult> => {
  if (!profile.model.trim()) {
    throw new AppError("MODEL_REQUIRED", "Choose a model before testing the connection.");
  }
  if (!apiKey) {
    throw new AppError("API_KEY_REQUIRED", "Add an API key before testing the connection.");
  }

  const response = await getTextProviderAdapter(profile.provider).generate(CONNECTION_REQUEST, {
    profile: {
      ...profile,
      samplingMode: "provider-default",
      maxOutputTokens: Math.min(profile.maxOutputTokens, 64),
    },
    apiKey,
    signal,
    purpose: "connection-test",
  });

  let result: unknown;
  try {
    result = JSON.parse(response.text.trim());
  } catch {
    throw new AppError("OUTPUT_INVALID", "The Provider connection probe returned invalid JSON.");
  }
  if (
    typeof result !== "object" ||
    result === null ||
    Array.isArray(result) ||
    Object.keys(result).length !== 1 ||
    (result as { ok?: unknown }).ok !== true
  ) {
    throw new AppError(
      "OUTPUT_INVALID",
      "The Provider connection probe returned an invalid result.",
    );
  }

  return {
    mode: "live",
    provider: profile.provider,
    model: profile.model.trim(),
    checkedAt: new Date().toISOString(),
  };
};
