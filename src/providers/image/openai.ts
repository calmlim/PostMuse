import { AppError } from "../../core/errors/app-error";
import {
  appendImageCanvasRequirement,
  getExpectedImageDimensions,
} from "../../core/image/dimensions";
import { isRecordValue } from "../../core/settings/validation";
import { appendApiPath } from "../shared/endpoints";
import { fetchWithPolicy, readJsonResponse } from "../shared/http";
import type { ImageProviderAdapter } from "./types";

export const openAIImageAdapter: ImageProviderAdapter = {
  id: "openai",
  async generate(input, { profile, apiKey, signal }) {
    const dimensions = getExpectedImageDimensions("openai", input.size, input.aspectRatio);
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
          prompt: appendImageCanvasRequirement(input.prompt, input, dimensions),
          n: 1,
          size: `${dimensions.width}x${dimensions.height}`,
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
