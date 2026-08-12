import { AppError } from "../../core/errors/app-error";
import type { ImageGenerationResult } from "../../core/image/types";
import {
  appendImageCanvasRequirement,
  getExpectedImageDimensions,
} from "../../core/image/dimensions";
import { isRecordValue } from "../../core/settings/validation";
import { appendApiPath } from "../shared/endpoints";
import { fetchJsonWithPolicy } from "../shared/http";
import type { ImageProviderAdapter } from "./types";

const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

const findGeneratedImage = (
  payload: Record<string, unknown>,
): Pick<ImageGenerationResult, "mimeType" | "base64Data"> | undefined => {
  if (!Array.isArray(payload.steps)) {
    return undefined;
  }

  const imageParts = payload.steps
    .filter((step) => isRecordValue(step) && step.type === "model_output")
    .flatMap((step) => (isRecordValue(step) && Array.isArray(step.content) ? step.content : []))
    .filter(
      (part) =>
        isRecordValue(part) &&
        part.type === "image" &&
        typeof part.data === "string" &&
        IMAGE_MIME_TYPES.some((mimeType) => mimeType === part.mime_type),
    );
  const image = imageParts.at(-1);
  if (!isRecordValue(image) || typeof image.data !== "string") {
    return undefined;
  }

  return {
    base64Data: image.data,
    mimeType: image.mime_type as ImageGenerationResult["mimeType"],
  };
};

export const geminiImageAdapter: ImageProviderAdapter = {
  id: "gemini",
  async generate(input, { profile, apiKey, signal }) {
    const dimensions = getExpectedImageDimensions("gemini", input.size, input.aspectRatio);
    const payload = await fetchJsonWithPolicy(
      appendApiPath(profile.baseUrl, "/interactions"),
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          model: profile.model,
          input: appendImageCanvasRequirement(input.prompt, input, dimensions),
          store: false,
          response_format: {
            type: "image",
            mime_type: "image/png",
            aspect_ratio: input.aspectRatio,
            image_size: input.size,
          },
        }),
      },
      signal,
      { timeoutMs: 180_000, maxRetries: 0 },
    );
    if (!isRecordValue(payload)) {
      throw new AppError("OUTPUT_INVALID", "Gemini returned an invalid image response.");
    }
    if (payload.status === "failed" || payload.status === "cancelled") {
      throw new AppError("CONTENT_REJECTED", "Gemini did not generate this image.");
    }
    const image = findGeneratedImage(payload);
    if (!image) {
      throw new AppError("OUTPUT_INVALID", "Gemini returned no image data.");
    }

    return {
      provider: "gemini",
      model: profile.model.trim(),
      prompt: input.prompt,
      aspectRatio: input.aspectRatio,
      size: input.size,
      ...image,
    };
  },
};
