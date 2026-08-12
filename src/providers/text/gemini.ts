import { AppError } from "../../core/errors/app-error";
import { isRecordValue } from "../../core/settings/validation";
import { createGeminiEndpoint } from "../shared/endpoints";
import { fetchWithPolicy, readJsonResponse } from "../shared/http";
import { getTextRequestTimeout, type TextProviderAdapter } from "./types";

export const geminiAdapter: TextProviderAdapter = {
  id: "gemini",
  async generate(request, { profile, apiKey, signal, purpose }) {
    const response = await fetchWithPolicy(
      createGeminiEndpoint(profile.baseUrl, profile.model),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          model: profile.model,
          input: request.user,
          system_instruction: request.system,
          store: false,
          response_format: {
            type: "text",
            mime_type: "application/json",
            schema: request.schema,
          },
          generation_config: { max_output_tokens: profile.maxOutputTokens },
        }),
      },
      signal,
      { timeoutMs: getTextRequestTimeout(purpose), maxRetries: 0 },
    );
    const payload = await readJsonResponse(response);

    if (!isRecordValue(payload)) {
      throw new AppError("OUTPUT_INVALID", "Gemini returned an invalid response.");
    }
    if (payload.status === "failed" || payload.status === "cancelled") {
      throw new AppError("CONTENT_REJECTED", "Gemini refused this content.");
    }
    const modelOutputs = Array.isArray(payload.steps)
      ? payload.steps.filter((step) => isRecordValue(step) && step.type === "model_output")
      : [];
    const lastOutput = modelOutputs.at(-1);
    const text =
      isRecordValue(lastOutput) && Array.isArray(lastOutput.content)
        ? lastOutput.content
            .filter(isRecordValue)
            .filter((part) => part.type === "text" && typeof part.text === "string")
            .map((part) => String(part.text))
            .join("\n")
            .trim()
        : "";
    if (!text) {
      throw new AppError("OUTPUT_INVALID", "Gemini returned empty text.");
    }

    return { text };
  },
};
