import { normalizeBaseUrl } from "../../core/settings/provider-catalog";
import { supportsInsecureLocalhost } from "../../core/settings/runtime-capabilities";

export const appendApiPath = (baseUrl: string, apiPath: string): string => {
  const normalized = normalizeBaseUrl(baseUrl, {
    allowInsecureLocalhost: supportsInsecureLocalhost(),
  });
  const base = new URL(normalized);
  const cleanApiPath = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;

  base.pathname = `${base.pathname.replace(/\/$/, "")}${cleanApiPath}`;
  return base.toString();
};

export const createGeminiEndpoint = (baseUrl: string, model: string): string => {
  void model;
  return appendApiPath(baseUrl, "/interactions");
};

export const isOfficialOpenAIEndpoint = (baseUrl: string): boolean => {
  const normalized = normalizeBaseUrl(baseUrl, {
    allowInsecureLocalhost: supportsInsecureLocalhost(),
  });
  return new URL(normalized).origin === "https://api.openai.com";
};
