import { clearHistoryRecords } from "./history-repository";

export const resetPostMuseData = async (): Promise<void> => {
  await Promise.all([
    chrome.storage.local.clear(),
    chrome.storage.session.clear(),
    clearHistoryRecords(),
  ]);
};
