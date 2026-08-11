import type { ImageGenerationInput, ImageGenerationResult } from "../../core/image/types";
import type { ImageProviderId, ImageProviderProfile } from "../../core/settings/types";

export interface ImageProviderContext {
  profile: ImageProviderProfile;
  apiKey: string;
  signal: AbortSignal;
}

export interface ImageProviderAdapter {
  id: ImageProviderId;
  generate(
    input: ImageGenerationInput,
    context: ImageProviderContext,
  ): Promise<ImageGenerationResult>;
}
