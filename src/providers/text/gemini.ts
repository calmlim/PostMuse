import { AppError } from "../../core/errors/app-error";
import { isRecordValue } from "../../core/settings/validation";
import { createGeminiEndpoint } from "../shared/endpoints";
import { fetchWithPolicy, readJsonResponse } from "../shared/http";
import type { TextProviderAdapter } from "./types";

export const geminiAdapter: TextProviderAdapter = {
  id: "gemini",
  async generate(request, { profile, apiKey, signal }) {
    const response = await fetchWithPolicy(
      createGeminiEndpoint(profile.baseUrl, profile.model),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: request.system }] },
          contents: [{ role: "user", parts: [{ text: request.user }] }],
          generationConfig: {
            temperature: profile.temperature,
            maxOutputTokens: profile.maxOutputTokens,
            responseMimeType: "application/json",
            responseSchema: request.schema,
          },
        }),
      },
      signal,
    );
    const payload = await readJsonResponse(response);

    if (!isRecordValue(payload)) {
      throw new AppError("OUTPUT_INVALID", "Gemini returned an invalid response.");
    }
    if (isRecordValue(payload.promptFeedback) && payload.promptFeedback.blockReason) {
      throw new AppError("CONTENT_REJECTED", "Gemini refused this content.");
    }

    const firstCandidate = Array.isArray(payload.candidates) ? payload.candidates[0] : undefined;
    const parts =
      isRecordValue(firstCandidate) && isRecordValue(firstCandidate.content)
        ? firstCandidate.content.parts
        : undefined;
    const text = Array.isArray(parts)
      ? parts
          .filter(isRecordValue)
          .map((part) => part.text)
          .filter((value): value is string => typeof value === "string")
          .join("\n")
          .trim()
      : "";
    if (!text) {
      throw new AppError("OUTPUT_INVALID", "Gemini returned empty text.");
    }

    return { text };
  },
};
