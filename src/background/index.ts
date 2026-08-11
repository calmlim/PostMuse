import { registerMessageRouter } from "./message-router";
import { initializeStorageSecurity } from "../storage/security";

const configureSidePanel = async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
};

const securityReady = initializeStorageSecurity();
registerMessageRouter(securityReady);

chrome.runtime.onInstalled.addListener(() => {
  void configureSidePanel();
});

chrome.runtime.onStartup.addListener(() => {
  void configureSidePanel();
});

void configureSidePanel();
