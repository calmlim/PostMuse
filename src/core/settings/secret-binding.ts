import type { ImageProviderProfile, ProviderProfile, SecretBinding } from "./types";

const getOrigin = (baseUrl: string): string => new URL(baseUrl).origin;

export const createTextSecretBinding = (profile: ProviderProfile): SecretBinding => ({
  profileId: profile.id,
  scope: "text",
  provider: profile.provider,
  origin: getOrigin(profile.baseUrl),
});

export const createImageSecretBinding = (profile: ImageProviderProfile): SecretBinding => ({
  profileId: profile.id,
  scope: "image",
  provider: profile.provider,
  origin: getOrigin(profile.baseUrl),
});

export const hasSameSecretDestination = (current: SecretBinding, next: SecretBinding): boolean =>
  current.scope === next.scope &&
  current.provider === next.provider &&
  current.origin === next.origin;
