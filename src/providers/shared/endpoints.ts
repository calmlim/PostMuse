import { normalizeBaseUrl } from "../../core/settings/provider-catalog";

export const appendApiPath = (baseUrl: string, apiPath: string): string => {
  const normalized = normalizeBaseUrl(baseUrl, { allowInsecureLocalhost: true });
  const base = new URL(normalized);
  const cleanApiPath = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  const pathWithoutDuplicateVersion =
    base.pathname.endsWith("/v1") && cleanApiPath.startsWith("/v1/")
      ? cleanApiPath.slice(3)
      : cleanApiPath;

  base.pathname = `${base.pathname.replace(/\/$/, "")}${pathWithoutDuplicateVersion}`;
  return base.toString();
};

export const createGeminiEndpoint = (baseUrl: string, model: string): string => {
  const normalizedModel = model.trim().replace(/^models\//, "");
  return appendApiPath(
    baseUrl,
    `/v1beta/models/${encodeURIComponent(normalizedModel)}:generateContent`,
  );
};
