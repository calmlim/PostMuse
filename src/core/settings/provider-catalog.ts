import { IMAGE_PROVIDER_IDS, PROVIDER_IDS, type ImageProviderId, type ProviderId } from "./types";

export interface ProviderDefinition {
  id: ProviderId;
  label: string;
  defaultBaseUrl: string;
}

export interface ImageProviderDefinition {
  id: ImageProviderId;
  label: string;
  defaultBaseUrl: string;
  defaultModel: string;
}

export const PROVIDER_DEFINITIONS: Record<ProviderId, ProviderDefinition> = {
  "openai-compatible": {
    id: "openai-compatible",
    label: "OpenAI-compatible",
    defaultBaseUrl: "https://api.openai.com/v1",
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    defaultBaseUrl: "https://api.anthropic.com/v1",
  },
  gemini: {
    id: "gemini",
    label: "Gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
  },
  xai: {
    id: "xai",
    label: "xAI",
    defaultBaseUrl: "https://api.x.ai/v1",
  },
};

export const IMAGE_PROVIDER_DEFINITIONS: Record<ImageProviderId, ImageProviderDefinition> = {
  openai: {
    id: "openai",
    label: "OpenAI Images",
    defaultBaseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-image-2",
  },
  gemini: {
    id: "gemini",
    label: "Gemini Images",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    defaultModel: "gemini-3.1-flash-image",
  },
};

export const isProviderId = (value: unknown): value is ProviderId =>
  typeof value === "string" && PROVIDER_IDS.some((providerId) => providerId === value);

export const isImageProviderId = (value: unknown): value is ImageProviderId =>
  typeof value === "string" && IMAGE_PROVIDER_IDS.some((providerId) => providerId === value);

export const normalizeBaseUrl = (
  value: string,
  options: { allowInsecureLocalhost?: boolean } = {},
): string => {
  const trimmed = value.trim();
  const url = new URL(trimmed);
  const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const isAllowedProtocol =
    url.protocol === "https:" ||
    (options.allowInsecureLocalhost === true && isLocalhost && url.protocol === "http:");

  if (!isAllowedProtocol) {
    throw new Error("Base URL must use HTTPS.");
  }

  if (url.username || url.password) {
    throw new Error("Base URL cannot contain credentials.");
  }

  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/, "");

  return url.toString().replace(/\/$/, "");
};

export const getOriginPattern = (
  baseUrl: string,
  options: { allowInsecureLocalhost?: boolean } = {},
): string => {
  const normalized = normalizeBaseUrl(baseUrl, options);
  const url = new URL(normalized);
  return `${url.origin}/*`;
};
