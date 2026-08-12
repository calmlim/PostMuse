import {
  createDefaultCreationPreferences,
  isCreationPreferencesV1,
  type CreationPreferencesV1,
} from "../core/preferences/creation";

export const CREATION_PREFERENCES_STORAGE_KEY = "postmuse.creationPreferences";

const canUseLocalStorage = () =>
  typeof chrome !== "undefined" && chrome.storage?.local !== undefined;

export const loadCreationPreferences = async (): Promise<CreationPreferencesV1> => {
  const defaults = createDefaultCreationPreferences();
  if (!canUseLocalStorage()) {
    return defaults;
  }
  const stored = await chrome.storage.local.get(CREATION_PREFERENCES_STORAGE_KEY);
  const current = stored[CREATION_PREFERENCES_STORAGE_KEY];
  if (isCreationPreferencesV1(current)) {
    return current;
  }
  await chrome.storage.local.set({ [CREATION_PREFERENCES_STORAGE_KEY]: defaults });
  return defaults;
};

export const saveCreationPreferences = async (
  preferences: CreationPreferencesV1,
): Promise<CreationPreferencesV1> => {
  if (!isCreationPreferencesV1(preferences)) {
    throw new Error("Invalid creation preferences.");
  }
  if (canUseLocalStorage()) {
    await chrome.storage.local.set({ [CREATION_PREFERENCES_STORAGE_KEY]: preferences });
  }
  return preferences;
};
