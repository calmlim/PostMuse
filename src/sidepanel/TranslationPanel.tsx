import { CheckCircle, FloppyDisk, GlobeHemisphereWest, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { OUTPUT_LANGUAGE_OPTIONS } from "../core/generation/languages";
import type { SettingsSnapshot } from "../core/settings/types";
import { createDefaultTranslationPreferences } from "../core/translation/preferences";
import type { TranslationPreferencesV1 } from "../core/translation/types";
import type { Messages } from "../i18n";
import { sendExtensionRequest } from "./extension-client";

interface TranslationPanelProps {
  copy: Messages;
  onOpenSettings: () => void;
}

type Feedback = { kind: "success" | "error"; message: string } | undefined;

const getActiveProfile = (snapshot: SettingsSnapshot) =>
  snapshot.settings.textProviderProfiles.find(
    (profile) => profile.id === snapshot.settings.activeTextProviderProfileId,
  ) ?? snapshot.settings.textProviderProfiles[0];

const notifyXTabs = async (preferences: TranslationPreferencesV1): Promise<void> => {
  if (typeof chrome === "undefined" || !chrome.tabs?.query) {
    return;
  }
  const tabs = await chrome.tabs.query({ url: "https://x.com/*" }).catch(() => []);
  await Promise.all(
    tabs.map((tab) =>
      tab.id === undefined
        ? Promise.resolve()
        : chrome.tabs
            .sendMessage(tab.id, {
              type: "postmuse.translationPreferencesChanged",
              preferences,
            })
            .catch(() => undefined),
    ),
  );
};

export function TranslationPanel({ copy, onOpenSettings }: TranslationPanelProps) {
  const [preferences, setPreferences] = useState<TranslationPreferencesV1>(
    createDefaultTranslationPreferences(),
  );
  const [settings, setSettings] = useState<SettingsSnapshot>();
  const [isBusy, setIsBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>();

  useEffect(() => {
    let active = true;
    void Promise.all([
      sendExtensionRequest({ type: "translation.preferences.get" }),
      sendExtensionRequest({ type: "settings.get" }),
    ]).then(([storedPreferences, snapshot]) => {
      if (!active) {
        return;
      }
      setPreferences(storedPreferences);
      setSettings(snapshot);
      void notifyXTabs(storedPreferences);
    });
    return () => {
      active = false;
    };
  }, []);

  const profile = settings ? getActiveProfile(settings) : undefined;
  const configured = Boolean(profile?.model.trim() && settings?.activeSecretStatus.hasKey);

  const save = async () => {
    setIsBusy(true);
    setFeedback(undefined);
    try {
      const saved = await sendExtensionRequest({
        type: "translation.preferences.save",
        preferences,
      });
      setPreferences(saved);
      await notifyXTabs(saved);
      setFeedback({ kind: "success", message: copy.translationSaved });
    } catch {
      setFeedback({ kind: "error", message: copy.translationSaveError });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section className="translation-panel" aria-labelledby="translation-title">
      <div className="section-heading">
        <p>{copy.translationEyebrow}</p>
        <h1 id="translation-title">{copy.translationTitle}</h1>
        <span>{copy.translationBody}</span>
      </div>

      <div className="settings-card">
        <div className="settings-card-heading">
          <GlobeHemisphereWest size={20} weight="duotone" aria-hidden="true" />
          <div>
            <strong>{copy.translationTargetLanguage}</strong>
            <span>{copy.translationBody}</span>
          </div>
        </div>
        <label className="form-field">
          <span>{copy.translationTargetLanguage}</span>
          <select
            value={preferences.targetLanguage}
            onChange={(event) =>
              setPreferences((current) => ({
                ...current,
                targetLanguage: event.target.value as TranslationPreferencesV1["targetLanguage"],
              }))
            }
            disabled={isBusy}
          >
            {OUTPUT_LANGUAGE_OPTIONS.map((option) => (
              <option value={option.id} key={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="storage-choice">
          <legend>{copy.translationDisplayMode}</legend>
          <label data-active={preferences.displayMode === "below"}>
            <input
              type="radio"
              name="translation-display-mode"
              checked={preferences.displayMode === "below"}
              onChange={() => setPreferences((current) => ({ ...current, displayMode: "below" }))}
              disabled={isBusy}
            />
            <span>
              <strong>{copy.translationDisplayBelow}</strong>
              <small>{copy.translationDisplayBelowHint}</small>
            </span>
          </label>
          <label data-active={preferences.displayMode === "replace"}>
            <input
              type="radio"
              name="translation-display-mode"
              checked={preferences.displayMode === "replace"}
              onChange={() => setPreferences((current) => ({ ...current, displayMode: "replace" }))}
              disabled={isBusy}
            />
            <span>
              <strong>{copy.translationDisplayReplace}</strong>
              <small>{copy.translationDisplayReplaceHint}</small>
            </span>
          </label>
        </fieldset>

        {feedback ? (
          <div className="feedback" data-kind={feedback.kind} role="status">
            {feedback.kind === "success" ? (
              <CheckCircle size={18} weight="fill" aria-hidden="true" />
            ) : (
              <WarningCircle size={18} weight="fill" aria-hidden="true" />
            )}
            <span>{feedback.message}</span>
          </div>
        ) : null}
        <div className="settings-actions">
          <button type="button" className="primary-button" onClick={save} disabled={isBusy}>
            <FloppyDisk size={17} weight="bold" aria-hidden="true" />
            {copy.translationSave}
          </button>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card-heading">
          <GlobeHemisphereWest size={20} weight="duotone" aria-hidden="true" />
          <div>
            <strong>{copy.translationProviderTitle}</strong>
            <span>
              {configured && profile
                ? copy.translationProviderReady
                    .replace("{provider}", profile.displayName)
                    .replace("{model}", profile.model)
                : copy.translationProviderMissing}
            </span>
          </div>
        </div>
        {!configured ? (
          <button type="button" className="secondary-button" onClick={onOpenSettings}>
            {copy.translationOpenSettings}
          </button>
        ) : null}
        <p className="mock-note">{copy.translationPrivacyNote}</p>
      </div>
    </section>
  );
}
