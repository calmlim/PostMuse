import { AppError } from "../../core/errors/app-error";
import { isRecordValue } from "../../core/settings/validation";
import { appendApiPath, isOfficialOpenAIEndpoint } from "../shared/endpoints";
import { fetchWithPolicy, readJsonResponse } from "../shared/http";
import { getTextRequestTimeout, type TextProviderAdapter } from "./types";

export const openAICompatibleAdapter: TextProviderAdapter = {
  id: "openai-compatible",
  async generate(request, { profile, apiKey, signal, purpose }) {
    const officialOpenAI = isOfficialOpenAIEndpoint(profile.baseUrl);
    const body: Record<string, unknown> = {
      model: profile.model,
      messages: [
        { role: "system", content: request.system },
        { role: "user", content: request.user },
      ],
      [officialOpenAI ? "max_completion_tokens" : "max_tokens"]: profile.maxOutputTokens,
    };
    if (profile.samplingMode === "custom") {
      body.temperature = profile.temperature;
    }
    if (officialOpenAI) {
      body.response_format = {
        type: "json_schema",
        json_schema: { name: request.schemaName, strict: true, schema: request.schema },
      };
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

    if (!isRecordValue(payload) || !Array.isArray(payload.choices)) {
      throw new AppError("OUTPUT_INVALID", "The Provider returned no choices.");
    }
    const firstChoice = payload.choices[0];
    if (!isRecordValue(firstChoice) || !isRecordValue(firstChoice.message)) {
      throw new AppError("OUTPUT_INVALID", "The Provider returned no message.");
    }
    if (typeof firstChoice.message.refusal === "string") {
      throw new AppError("CONTENT_REJECTED", "The Provider refused this content.");
    }
    if (typeof firstChoice.message.content !== "string" || !firstChoice.message.content.trim()) {
      throw new AppError("OUTPUT_INVALID", "The Provider returned empty text.");
    }

    return { text: firstChoice.message.content };
  },
};
