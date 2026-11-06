import {
  createDefaultCreationPreferences,
  isCreationPreferencesV2,
  migrateCreationPreferences,
  type CreationPreferencesV2,
} from "../core/preferences/creation";

export const CREATION_PREFERENCES_STORAGE_KEY = "postmuse.creationPreferences";

const canUseLocalStorage = () =>
  typeof chrome !== "undefined" && chrome.storage?.local !== undefined;

export const loadCreationPreferences = async (): Promise<CreationPreferencesV2> => {
  const defaults = createDefaultCreationPreferences();
  if (!canUseLocalStorage()) {
    return defaults;
  }
  const stored = await chrome.storage.local.get(CREATION_PREFERENCES_STORAGE_KEY);
  const current = stored[CREATION_PREFERENCES_STORAGE_KEY];
  const migrated = migrateCreationPreferences(current);
  if (migrated) {
    if (!isCreationPreferencesV2(current)) {
      await chrome.storage.local.set({ [CREATION_PREFERENCES_STORAGE_KEY]: migrated });
    }
    return migrated;
  }
  await chrome.storage.local.set({ [CREATION_PREFERENCES_STORAGE_KEY]: defaults });
  return defaults;
};

export const saveCreationPreferences = async (
  preferences: CreationPreferencesV2,
): Promise<CreationPreferencesV2> => {
  if (!isCreationPreferencesV2(preferences)) {
    throw new Error("Invalid creation preferences.");
  }
  if (canUseLocalStorage()) {
    await chrome.storage.local.set({ [CREATION_PREFERENCES_STORAGE_KEY]: preferences });
  }
  return preferences;
};
