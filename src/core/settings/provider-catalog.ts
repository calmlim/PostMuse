import { PROVIDER_IDS, type ProviderId } from "./types";

export interface ProviderDefinition {
  id: ProviderId;
  label: string;
  defaultBaseUrl: string;
}

export const PROVIDER_DEFINITIONS: Record<ProviderId, ProviderDefinition> = {
  "openai-compatible": {
    id: "openai-compatible",
    label: "OpenAI-compatible",
    defaultBaseUrl: "https://api.openai.com",
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    defaultBaseUrl: "https://api.anthropic.com",
  },
  gemini: {
    id: "gemini",
    label: "Gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com",
  },
  xai: {
    id: "xai",
    label: "xAI",
    defaultBaseUrl: "https://api.x.ai",
  },
};

export const isProviderId = (value: unknown): value is ProviderId =>
  typeof value === "string" && PROVIDER_IDS.some((providerId) => providerId === value);

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
