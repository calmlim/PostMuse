import type { MockConnectionResult, ProviderProfile } from "../core/settings/types";
import { AppError } from "../core/errors/app-error";

export const runMockConnectionTest = (
  profile: ProviderProfile,
  apiKey: string | undefined,
): MockConnectionResult => {
  if (!profile.model.trim()) {
    throw new AppError("MODEL_REQUIRED", "Choose a model before testing the setup.");
  }

  if (!apiKey) {
    throw new AppError("API_KEY_REQUIRED", "Add an API key before testing the setup.");
  }

  return {
    mode: "mock",
    provider: profile.provider,
    model: profile.model.trim(),
    checkedAt: new Date().toISOString(),
  };
};
