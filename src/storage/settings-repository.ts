import { isLocale, type Locale } from "../i18n";
import {
  createDefaultImageProviderProfile,
  createDefaultSettings,
} from "../core/settings/defaults";
import {
  IMAGE_PROVIDER_DEFINITIONS,
  PROVIDER_DEFINITIONS,
} from "../core/settings/provider-catalog";
import type { ImageProviderProfile, ProviderProfile, SettingsV3 } from "../core/settings/types";
import {
  isImageProviderProfile,
  isLegacySettingsV1,
  isProviderProfile,
  isSettingsV2,
  isSettingsV3,
} from "../core/settings/validation";

export const SETTINGS_STORAGE_KEY = "postmuse.settings";
const LEGACY_UI_LOCALE_KEY = "uiLocale";

const canUseLocalStorage = () =>
  typeof chrome !== "undefined" && chrome.storage?.local !== undefined;

const LEGACY_DEFAULT_BASE_URLS = {
  text: {
    "openai-compatible": "https://api.openai.com",
    anthropic: "https://api.anthropic.com",
    gemini: "https://generativelanguage.googleapis.com",
    xai: "https://api.x.ai",
  },
  image: {
    openai: "https://api.openai.com",
    gemini: "https://generativelanguage.googleapis.com",
  },
} as const;

const migrateDefaultBaseUrls = (settings: SettingsV3): SettingsV3 => ({
  ...settings,
  textProviderProfiles: settings.textProviderProfiles.map((profile) => ({
    ...profile,
    baseUrl:
      profile.baseUrl === LEGACY_DEFAULT_BASE_URLS.text[profile.provider]
        ? PROVIDER_DEFINITIONS[profile.provider].defaultBaseUrl
        : profile.baseUrl,
  })),
  imageProviderProfiles: settings.imageProviderProfiles.map((profile) => ({
    ...profile,
    baseUrl:
      profile.baseUrl === LEGACY_DEFAULT_BASE_URLS.image[profile.provider]
        ? IMAGE_PROVIDER_DEFINITIONS[profile.provider].defaultBaseUrl
        : profile.baseUrl,
  })),
});

export const loadSettings = async (): Promise<SettingsV3> => {
  if (!canUseLocalStorage()) {
    return createDefaultSettings();
  }

  const stored = await chrome.storage.local.get([SETTINGS_STORAGE_KEY, LEGACY_UI_LOCALE_KEY]);
  const current = stored[SETTINGS_STORAGE_KEY];

  if (isSettingsV3(current)) {
    const migrated = migrateDefaultBaseUrls(current);
    if (JSON.stringify(migrated) !== JSON.stringify(current)) {
      await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: migrated });
    }
    return migrated;
  }

  if (isSettingsV2(current)) {
    const migrated = migrateDefaultBaseUrls({
      ...current,
      schemaVersion: 3,
      textProviderProfiles: current.textProviderProfiles.map((profile) => ({
        ...profile,
        samplingMode: "provider-default",
      })),
    });
    await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: migrated });
    return migrated;
  }

  if (isLegacySettingsV1(current)) {
    const imageProfile = createDefaultImageProviderProfile();
    const migrated = migrateDefaultBaseUrls({
      ...current,
      schemaVersion: 3,
      textProviderProfiles: current.textProviderProfiles.map((profile) => ({
        ...profile,
        samplingMode: "provider-default",
      })),
      activeImageProviderProfileId: imageProfile.id,
      imageProviderProfiles: [imageProfile],
    });
    await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: migrated });
    return migrated;
  }

  const legacyLocale = isLocale(stored[LEGACY_UI_LOCALE_KEY])
    ? stored[LEGACY_UI_LOCALE_KEY]
    : undefined;
  const migrated = createDefaultSettings(legacyLocale);
  await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: migrated });
  return migrated;
};

export const saveSettings = async (settings: SettingsV3): Promise<SettingsV3> => {
  if (!isSettingsV3(settings)) {
    throw new Error("Settings failed validation.");
  }

  if (canUseLocalStorage()) {
    await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: settings });
  }

  return settings;
};

export const saveUiLocaleSetting = async (uiLocale: Locale): Promise<SettingsV3> => {
  const settings = await loadSettings();
  return saveSettings({ ...settings, uiLocale });
};

export const upsertProviderProfile = async (profile: ProviderProfile): Promise<SettingsV3> => {
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

export const upsertImageProviderProfile = async (
  profile: ImageProviderProfile,
): Promise<SettingsV3> => {
  if (!isImageProviderProfile(profile)) {
    throw new Error("Image provider profile failed validation.");
  }

  const settings = await loadSettings();
  const existingIndex = settings.imageProviderProfiles.findIndex((item) => item.id === profile.id);
  const imageProviderProfiles = [...settings.imageProviderProfiles];

  if (existingIndex >= 0) {
    imageProviderProfiles[existingIndex] = profile;
  } else {
    imageProviderProfiles.push(profile);
  }

  return saveSettings({
    ...settings,
    activeImageProviderProfileId: profile.id,
    imageProviderProfiles,
  });
};

export const getActiveProviderProfile = (settings: SettingsV3): ProviderProfile => {
  const profile = settings.textProviderProfiles.find(
    (item) => item.id === settings.activeTextProviderProfileId,
  );

  if (!profile) {
    throw new Error("Active provider profile was not found.");
  }

  return profile;
};

export const getActiveImageProviderProfile = (settings: SettingsV3): ImageProviderProfile => {
  const profile = settings.imageProviderProfiles.find(
    (item) => item.id === settings.activeImageProviderProfileId,
  );

  if (!profile) {
    throw new Error("Active image provider profile was not found.");
  }

  return profile;
};
