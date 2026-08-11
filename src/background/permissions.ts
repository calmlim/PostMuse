import { getOriginPattern } from "../core/settings/provider-catalog";
import { supportsInsecureLocalhost } from "../core/settings/runtime-capabilities";

export const hasProviderOriginPermission = async (baseUrl: string): Promise<boolean> => {
  const origin = getOriginPattern(baseUrl, {
    allowInsecureLocalhost: supportsInsecureLocalhost(),
  });
  return chrome.permissions.contains({ origins: [origin] });
};

export const getGrantedProviderOrigins = async (): Promise<string[]> => {
  const permissions = await chrome.permissions.getAll();
  return (permissions.origins ?? []).filter(
    (origin) => origin.startsWith("https://") || origin.startsWith("http://"),
  );
};

export const revokeGrantedProviderOrigins = async (): Promise<{
  revokedOriginCount: number;
  remainingOriginCount: number;
}> => {
  const origins = await getGrantedProviderOrigins();
  if (origins.length === 0) {
    return { revokedOriginCount: 0, remainingOriginCount: 0 };
  }

  await chrome.permissions.remove({ origins });
  const remainingOriginCount = (await getGrantedProviderOrigins()).length;
  return {
    revokedOriginCount: Math.max(0, origins.length - remainingOriginCount),
    remainingOriginCount,
  };
};
