import { AppError } from "../../core/errors/app-error";
import type { ImageAspectRatio, ImageSize } from "../../core/image/types";
import { isRecordValue } from "../../core/settings/validation";
import { appendApiPath } from "../shared/endpoints";
import { fetchWithPolicy, readJsonResponse } from "../shared/http";
import type { ImageProviderAdapter } from "./types";

const OPENAI_SIZE_MAP: Record<ImageSize, Record<ImageAspectRatio, string>> = {
  "1K": { "1:1": "1024x1024", "16:9": "1536x864", "9:16": "864x1536" },
  "2K": { "1:1": "2048x2048", "16:9": "2048x1152", "9:16": "1152x2048" },
};

export const openAIImageAdapter: ImageProviderAdapter = {
  id: "openai",
  async generate(input, { profile, apiKey, signal }) {
    const response = await fetchWithPolicy(
      appendApiPath(profile.baseUrl, "/v1/images/generations"),
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: profile.model,
          prompt: input.prompt,
          n: 1,
          size: OPENAI_SIZE_MAP[input.size][input.aspectRatio],
          output_format: "png",
        }),
      },
      signal,
      { timeoutMs: 180_000, maxRetries: 1 },
    );
    const payload = await readJsonResponse(response);
    const firstImage =
      isRecordValue(payload) && Array.isArray(payload.data) ? payload.data[0] : null;
    const base64Data = isRecordValue(firstImage) ? firstImage.b64_json : undefined;
    if (typeof base64Data !== "string" || !base64Data.trim()) {
      throw new AppError("OUTPUT_INVALID", "OpenAI returned no image data.");
    }

    return {
      provider: "openai",
      model: profile.model.trim(),
      prompt: input.prompt,
      aspectRatio: input.aspectRatio,
      size: input.size,
      mimeType: "image/png",
      base64Data,
    };
  },
};
