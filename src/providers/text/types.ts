import type { NormalizedTextRequest, NormalizedTextResponse } from "../../core/generation/types";
import type { ProviderId, ProviderProfile } from "../../core/settings/types";

export interface TextProviderContext {
  profile: ProviderProfile;
  apiKey: string;
  signal: AbortSignal;
  purpose: "generation" | "connection-test";
}

export const getTextRequestTimeout = (purpose: TextProviderContext["purpose"]): number =>
  purpose === "connection-test" ? 30_000 : 180_000;

export interface TextProviderAdapter {
  id: ProviderId;
  generate(
    request: NormalizedTextRequest,
    context: TextProviderContext,
  ): Promise<NormalizedTextResponse>;
}
