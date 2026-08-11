const CREATE_ADVANCED_OPEN_KEY = "postmuse.ui.createAdvancedOpen";

const canUseLocalStorage = () =>
  typeof chrome !== "undefined" && chrome.storage?.local !== undefined;

export const loadCreateAdvancedOpen = async (): Promise<boolean> => {
  if (!canUseLocalStorage()) {
    return false;
  }

  const stored = await chrome.storage.local.get(CREATE_ADVANCED_OPEN_KEY);
  return stored[CREATE_ADVANCED_OPEN_KEY] === true;
};

export const saveCreateAdvancedOpen = async (value: boolean): Promise<void> => {
  if (canUseLocalStorage()) {
    await chrome.storage.local.set({ [CREATE_ADVANCED_OPEN_KEY]: value });
  }
};
