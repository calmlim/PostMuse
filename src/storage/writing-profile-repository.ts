export const WRITING_PROFILE_STORAGE_KEY = "postmuse.writingProfile";
export const MAX_WRITING_PROFILE_LENGTH = 4_000;

const canUseLocalStorage = () =>
  typeof chrome !== "undefined" && chrome.storage?.local !== undefined;

export const loadWritingProfile = async (): Promise<string> => {
  if (!canUseLocalStorage()) {
    return "";
  }
  const stored = await chrome.storage.local.get(WRITING_PROFILE_STORAGE_KEY);
  const value = stored[WRITING_PROFILE_STORAGE_KEY];
  return typeof value === "string" && value.length <= MAX_WRITING_PROFILE_LENGTH ? value : "";
};

export const saveWritingProfile = async (value: string): Promise<string> => {
  const profile = value.trim();
  if (profile.length > MAX_WRITING_PROFILE_LENGTH) {
    throw new Error("Writing profile failed validation.");
  }
  if (canUseLocalStorage()) {
    await chrome.storage.local.set({ [WRITING_PROFILE_STORAGE_KEY]: profile });
  }
  return profile;
};
