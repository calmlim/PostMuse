export const supportsInsecureLocalhost = (): boolean => {
  if (typeof chrome === "undefined" || !chrome.runtime?.getManifest) {
    return false;
  }

  const permissions: string[] = chrome.runtime.getManifest().optional_host_permissions ?? [];
  return permissions.some(
    (permission) =>
      permission.startsWith("http://localhost") || permission.startsWith("http://127.0.0.1"),
  );
};
