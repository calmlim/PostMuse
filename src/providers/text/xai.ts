import { AppError } from "../../core/errors/app-error";
import { isRecordValue } from "../../core/settings/validation";
import { appendApiPath } from "../shared/endpoints";
import { fetchWithPolicy, readJsonResponse } from "../shared/http";
import { getTextRequestTimeout, type TextProviderAdapter } from "./types";

export const xAIAdapter: TextProviderAdapter = {
  id: "xai",
  async generate(request, { profile, apiKey, signal, purpose }) {
    const body: Record<string, unknown> = {
      model: profile.model,
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.user },
      ],
      max_tokens: profile.maxOutputTokens,
      response_format: {
        type: "json_schema",
        json_schema: { name: request.schemaName, strict: true, schema: request.schema },
      },
    };
    if (profile.samplingMode === "custom") {
      body.temperature = profile.temperature;
    }
    const response = await fetchWithPolicy(
      appendApiPath(profile.baseUrl, "/v1/chat/completions"),
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      },
      signal,
      { timeoutMs: getTextRequestTimeout(purpose), maxRetries: 0 },
    );
    const payload = await readJsonResponse(response);

    const choices = isRecordValue(payload) && Array.isArray(payload.choices) ? payload.choices : [];
    const firstChoice = choices[0];
    if (
      isRecordValue(firstChoice) &&
      (firstChoice.finish_reason === "content_filter" ||
        (isRecordValue(firstChoice.message) && typeof firstChoice.message.refusal === "string"))
    ) {
      throw new AppError("CONTENT_REJECTED", "xAI refused this content.");
    }
    const content =
      isRecordValue(firstChoice) && isRecordValue(firstChoice.message)
        ? firstChoice.message.content
        : undefined;
    if (typeof content !== "string" || !content.trim()) {
      throw new AppError("OUTPUT_INVALID", "xAI returned empty text.");
    }

    return { text: content };
  },
};
