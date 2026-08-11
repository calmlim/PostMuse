import { getOriginPattern } from "../core/settings/provider-catalog";

export const hasProviderOriginPermission = async (baseUrl: string): Promise<boolean> => {
  const origin = getOriginPattern(baseUrl, { allowInsecureLocalhost: true });
  return chrome.permissions.contains({ origins: [origin] });
};
