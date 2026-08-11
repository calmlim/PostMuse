import type { ImageProviderId } from "../settings/types";

export const IMAGE_ASPECT_RATIOS = ["1:1", "16:9", "9:16"] as const;
export const IMAGE_SIZES = ["1K", "2K"] as const;
export const IMAGE_STYLES = [
  "editorial",
  "illustration",
  "photographic",
  "minimal",
  "diagram",
] as const;

export type ImageAspectRatio = (typeof IMAGE_ASPECT_RATIOS)[number];
export type ImageSize = (typeof IMAGE_SIZES)[number];
export type ImageStyle = (typeof IMAGE_STYLES)[number];

export interface ImageGenerationInput {
  sourceText: string;
  prompt: string;
  style: ImageStyle;
  aspectRatio: ImageAspectRatio;
  size: ImageSize;
  includeText: boolean;
}

export interface ImageGenerationResult {
  provider: ImageProviderId;
  model: string;
  prompt: string;
  aspectRatio: ImageAspectRatio;
  size: ImageSize;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  base64Data: string;
}

export interface ImageHistoryMetadata {
  type: "image";
  provider: ImageProviderId;
  model: string;
  prompt: string;
  aspectRatio: ImageAspectRatio;
  size: ImageSize;
  mimeType: ImageGenerationResult["mimeType"];
  generatedAt: string;
}
