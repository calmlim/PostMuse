export const HISTORY_PREFERENCES_STORAGE_KEY = "postmuse.history.preferences";

interface HistoryPreferencesV1 {
  schemaVersion: 1;
  enabled: boolean;
}

const defaultPreferences: HistoryPreferencesV1 = { schemaVersion: 1, enabled: true };

const canUseLocalStorage = () =>
  typeof chrome !== "undefined" && chrome.storage?.local !== undefined;

const isHistoryPreferencesV1 = (value: unknown): value is HistoryPreferencesV1 =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  (value as Record<string, unknown>).schemaVersion === 1 &&
  typeof (value as Record<string, unknown>).enabled === "boolean";

export const loadHistoryEnabled = async (): Promise<boolean> => {
  if (!canUseLocalStorage()) {
    return true;
  }
  const stored = await chrome.storage.local.get(HISTORY_PREFERENCES_STORAGE_KEY);
  const current = stored[HISTORY_PREFERENCES_STORAGE_KEY];
  if (isHistoryPreferencesV1(current)) {
    return current.enabled;
  }
  await chrome.storage.local.set({ [HISTORY_PREFERENCES_STORAGE_KEY]: defaultPreferences });
  return true;
};

export const saveHistoryEnabled = async (enabled: boolean): Promise<void> => {
  if (canUseLocalStorage()) {
    await chrome.storage.local.set({
      [HISTORY_PREFERENCES_STORAGE_KEY]: { schemaVersion: 1, enabled },
    });
  }
};
