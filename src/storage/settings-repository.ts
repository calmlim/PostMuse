import { isLocale, type Locale } from "../i18n";
import { createDefaultSettings } from "../core/settings/defaults";
import type { ProviderProfile, SettingsV1 } from "../core/settings/types";
import { isProviderProfile, isSettingsV1 } from "../core/settings/validation";

export const SETTINGS_STORAGE_KEY = "postmuse.settings";
const LEGACY_UI_LOCALE_KEY = "uiLocale";

const canUseLocalStorage = () =>
  typeof chrome !== "undefined" && chrome.storage?.local !== undefined;

export const loadSettings = async (): Promise<SettingsV1> => {
  if (!canUseLocalStorage()) {
    return createDefaultSettings();
  }

  const stored = await chrome.storage.local.get([SETTINGS_STORAGE_KEY, LEGACY_UI_LOCALE_KEY]);
  const current = stored[SETTINGS_STORAGE_KEY];

  if (isSettingsV1(current)) {
    return current;
  }

  const legacyLocale = isLocale(stored[LEGACY_UI_LOCALE_KEY])
    ? stored[LEGACY_UI_LOCALE_KEY]
    : undefined;
  const migrated = createDefaultSettings(legacyLocale);
  await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: migrated });
  return migrated;
};

export const saveSettings = async (settings: SettingsV1): Promise<SettingsV1> => {
  if (!isSettingsV1(settings)) {
    throw new Error("Settings failed validation.");
  }

  if (canUseLocalStorage()) {
    await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: settings });
  }

  return settings;
};

export const saveUiLocaleSetting = async (uiLocale: Locale): Promise<SettingsV1> => {
  const settings = await loadSettings();
  return saveSettings({ ...settings, uiLocale });
};

export const upsertProviderProfile = async (profile: ProviderProfile): Promise<SettingsV1> => {
  if (!isProviderProfile(profile)) {
    throw new Error("Provider profile failed validation.");
  }

  const settings = await loadSettings();
  const existingIndex = settings.textProviderProfiles.findIndex((item) => item.id === profile.id);
  const textProviderProfiles = [...settings.textProviderProfiles];

  if (existingIndex >= 0) {
    textProviderProfiles[existingIndex] = profile;
  } else {
    textProviderProfiles.push(profile);
  }

  return saveSettings({
    ...settings,
    activeTextProviderProfileId: profile.id,
    textProviderProfiles,
  });
};

export const getActiveProviderProfile = (settings: SettingsV1): ProviderProfile => {
  const profile = settings.textProviderProfiles.find(
    (item) => item.id === settings.activeTextProviderProfileId,
  );

  if (!profile) {
    throw new Error("Active provider profile was not found.");
  }

  return profile;
};
