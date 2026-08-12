import type {
  ImageAspectRatio,
  ImageGenerationInput,
  ImageGenerationResult,
  ImageSize,
} from "./types";

export interface ImagePixelDimensions {
  width: number;
  height: number;
}

const OPENAI_DIMENSIONS: Record<ImageSize, Record<ImageAspectRatio, ImagePixelDimensions>> = {
  "1K": {
    "1:1": { width: 1024, height: 1024 },
    "16:9": { width: 1536, height: 864 },
    "9:16": { width: 864, height: 1536 },
  },
  "2K": {
    "1:1": { width: 2048, height: 2048 },
    "16:9": { width: 2048, height: 1152 },
    "9:16": { width: 1152, height: 2048 },
  },
};

const OPENAI_REQUEST_DIMENSIONS: Record<ImageAspectRatio, ImagePixelDimensions> = {
  "1:1": { width: 1024, height: 1024 },
  "16:9": { width: 1536, height: 1024 },
  "9:16": { width: 1024, height: 1536 },
};

const GEMINI_DIMENSIONS: Record<ImageSize, Record<ImageAspectRatio, ImagePixelDimensions>> = {
  "1K": {
    "1:1": { width: 1024, height: 1024 },
    "16:9": { width: 1376, height: 768 },
    "9:16": { width: 768, height: 1376 },
  },
  "2K": {
    "1:1": { width: 2048, height: 2048 },
    "16:9": { width: 2752, height: 1536 },
    "9:16": { width: 1536, height: 2752 },
  },
};

export const getExpectedImageDimensions = (
  provider: ImageGenerationResult["provider"],
  size: ImageSize,
  aspectRatio: ImageAspectRatio,
): ImagePixelDimensions =>
  (provider === "gemini" ? GEMINI_DIMENSIONS : OPENAI_DIMENSIONS)[size][aspectRatio];

export const getOpenAIRequestDimensions = (aspectRatio: ImageAspectRatio): ImagePixelDimensions =>
  OPENAI_REQUEST_DIMENSIONS[aspectRatio];

export const appendImageCanvasRequirement = (
  prompt: string,
  input: Pick<ImageGenerationInput, "aspectRatio" | "size">,
  dimensions: ImagePixelDimensions,
): string =>
  `${prompt}\n\nRequired output canvas: ${input.aspectRatio} aspect ratio, ${dimensions.width}×${dimensions.height} pixels. Compose the scene for this exact canvas; do not return a square image unless the requested ratio is 1:1.`;
