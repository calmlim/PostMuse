import { XPostObserver } from "./observer";
import { mountInlinePost, refreshInlineConfiguration } from "./x-adapter/inject-trigger";
import { isTranslationPreferencesV2 } from "../core/translation/preferences";

const observer = new XPostObserver(mountInlinePost);
observer.start();

chrome.runtime.onMessage.addListener((message) => {
  if (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === "postmuse.translationPreferencesChanged" &&
    isTranslationPreferencesV2((message as { preferences?: unknown }).preferences)
  ) {
    observer.closeActive(false);
    void refreshInlineConfiguration();
  }
});
