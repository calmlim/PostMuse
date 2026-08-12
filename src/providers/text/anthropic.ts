import { AppError } from "../../core/errors/app-error";
import { isRecordValue } from "../../core/settings/validation";
import { appendApiPath } from "../shared/endpoints";
import { fetchWithPolicy, readJsonResponse } from "../shared/http";
import { getTextRequestTimeout, type TextProviderAdapter } from "./types";

export const anthropicAdapter: TextProviderAdapter = {
  id: "anthropic",
  async generate(request, { profile, apiKey, signal, purpose }) {
    const response = await fetchWithPolicy(
      appendApiPath(profile.baseUrl, "/v1/messages"),
      {
        method: "POST",
        headers: {
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          model: profile.model,
          max_tokens: profile.maxOutputTokens,
          system: request.system,
          messages: [{ role: "user", content: request.user }],
        }),
      },
      signal,
      { timeoutMs: getTextRequestTimeout(purpose), maxRetries: 0 },
    );
    const payload = await readJsonResponse(response);

    if (!isRecordValue(payload)) {
      throw new AppError("OUTPUT_INVALID", "Anthropic returned an invalid response.");
    }
    if (payload.stop_reason === "refusal") {
      throw new AppError("CONTENT_REJECTED", "Anthropic refused this content.");
    }
    const text = Array.isArray(payload.content)
      ? payload.content
          .filter(isRecordValue)
          .filter((block) => block.type === "text" && typeof block.text === "string")
          .map((block) => String(block.text))
          .join("\n")
          .trim()
      : "";
    if (!text) {
      throw new AppError("OUTPUT_INVALID", "Anthropic returned empty text.");
    }

    return { text };
  },
};
