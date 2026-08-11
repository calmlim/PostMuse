import type { NormalizedTextRequest, NormalizedTextResponse } from "../../core/generation/types";
import type { ProviderId, ProviderProfile } from "../../core/settings/types";

export interface TextProviderContext {
  profile: ProviderProfile;
  apiKey: string;
  signal: AbortSignal;
}

export interface TextProviderAdapter {
  id: ProviderId;
  generate(
    request: NormalizedTextRequest,
    context: TextProviderContext,
  ): Promise<NormalizedTextResponse>;
}
