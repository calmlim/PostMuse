import {
  CheckCircle,
  ClipboardText,
  Lifebuoy,
  LockKey,
  ShieldCheck,
  Trash,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import type { SettingsSnapshot } from "../core/settings/types";
import type { Messages } from "../i18n";
import { listHistoryRecords } from "../storage/history-repository";
import { sendExtensionRequest } from "./extension-client";

interface RuntimeManifestSummary {
  version: string;
  manifest_version: number;
  content_scripts?: unknown[];
}

interface DiagnosticInput {
  snapshot: SettingsSnapshot;
  historyCount: number;
  grantedOriginCount: number;
  manifest?: RuntimeManifestSummary;
}

export const buildLocalDiagnostics = ({
  snapshot,
  historyCount,
  grantedOriginCount,
  manifest,
}: DiagnosticInput) => {
  const textProfile = snapshot.settings.textProviderProfiles.find(
    (profile) => profile.id === snapshot.settings.activeTextProviderProfileId,
  );
  const imageProfile = snapshot.settings.imageProviderProfiles.find(
    (profile) => profile.id === snapshot.settings.activeImageProviderProfileId,
  );

  return {
    app: "PostMuse",
    version: manifest?.version ?? "preview",
    manifestVersion: manifest?.manifest_version ?? 3,
    settingsSchema: snapshot.settings.schemaVersion,
    uiLocale: snapshot.settings.uiLocale,
    textProvider: textProfile?.provider ?? "unknown",
    textModelConfigured: Boolean(textProfile?.model.trim()),
    textKeyStored: snapshot.activeSecretStatus.hasKey,
    textKeyPersistence: snapshot.activeSecretStatus.persistence ?? "none",
    imageProvider: imageProfile?.provider ?? "unknown",
    imageModelConfigured: Boolean(imageProfile?.model.trim()),
    imageKeyStored: snapshot.activeImageSecretStatus.hasKey,
    imageKeyPersistence: snapshot.activeImageSecretStatus.persistence ?? "none",
    historyCount,
    grantedOriginCount,
    xInlineBuild: Boolean(manifest?.content_scripts?.length),
  };
};

const getExtensionPageUrl = (path: string): string =>
  typeof chrome !== "undefined" && chrome.runtime?.getURL
    ? chrome.runtime.getURL(path)
    : `/${path}`;

interface PrivacyDataPanelProps {
  copy: Messages;
  snapshot: SettingsSnapshot;
  onSnapshot: (snapshot: SettingsSnapshot) => void;
  onDataReset?: () => void;
  revision?: number;
}

export function PrivacyDataPanel({
  copy,
  snapshot,
  onSnapshot,
  onDataReset,
  revision = 0,
}: PrivacyDataPanelProps) {
  const [historyCount, setHistoryCount] = useState(0);
  const [grantedOriginCount, setGrantedOriginCount] = useState(0);
  const [confirmDeleteKeys, setConfirmDeleteKeys] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string }>();

  // biome-ignore lint/correctness/useExhaustiveDependencies: Revision explicitly reloads local diagnostics.
  useEffect(() => {
    let active = true;
    void Promise.all([
      listHistoryRecords().then((records) => records.length),
      typeof chrome !== "undefined" && chrome.permissions?.getAll
        ? chrome.permissions.getAll().then((permissions) => permissions.origins?.length ?? 0)
        : Promise.resolve(0),
    ])
      .then(([records, origins]) => {
        if (active) {
          setHistoryCount(records);
          setGrantedOriginCount(origins);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [revision]);

  const copyDiagnostics = async () => {
    try {
      const manifest =
        typeof chrome !== "undefined" && chrome.runtime?.getManifest
          ? (chrome.runtime.getManifest() as RuntimeManifestSummary)
          : undefined;
      const diagnostics = buildLocalDiagnostics({
        snapshot,
        historyCount,
        grantedOriginCount,
        manifest,
      });
      await navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
      setFeedback({ kind: "success", text: copy.diagnosticsCopied });
    } catch {
      setFeedback({ kind: "error", text: copy.diagnosticsCopyFailed });
    }
  };

  const deleteKeys = async () => {
    setIsBusy(true);
    setFeedback(undefined);
    try {
      const nextSnapshot = await sendExtensionRequest({ type: "data.deleteKeys" });
      onSnapshot(nextSnapshot);
      setConfirmDeleteKeys(false);
      setFeedback({ kind: "success", text: copy.savedKeysDeleted });
    } catch {
      setFeedback({ kind: "error", text: copy.dataActionError });
    } finally {
      setIsBusy(false);
    }
  };

  const resetData = async () => {
    setIsBusy(true);
    setFeedback(undefined);
    try {
      const nextSnapshot = await sendExtensionRequest({ type: "data.reset" });
      onSnapshot(nextSnapshot);
      setHistoryCount(0);
      setGrantedOriginCount(0);
      setConfirmReset(false);
      setFeedback({ kind: "success", text: copy.localDataReset });
      onDataReset?.();
    } catch {
      setFeedback({ kind: "error", text: copy.dataActionError });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="settings-card privacy-data-card">
      <div className="settings-card-heading">
        <ShieldCheck size={21} weight="duotone" aria-hidden="true" />
        <div>
          <strong>{copy.privacyDataTitle}</strong>
          <span>{copy.privacyDataBody}</span>
        </div>
      </div>

      <ul className="privacy-facts">
        <li>
          <LockKey size={17} aria-hidden="true" />
          <span>{copy.privacyNoBackend}</span>
        </li>
        <li>
          <ClipboardText size={17} aria-hidden="true" />
          <span>{copy.privacyProviderTransfer}</span>
        </li>
      </ul>

      <fieldset className="privacy-status">
        <legend className="sr-only">{copy.localDataSummary}</legend>
        <span>{copy.textKeySummary}</span>
        <strong>{snapshot.activeSecretStatus.hasKey ? copy.savedLocally : copy.notSaved}</strong>
        <span>{copy.imageKeySummary}</span>
        <strong>
          {snapshot.activeImageSecretStatus.hasKey ? copy.savedLocally : copy.notSaved}
        </strong>
        <span>{copy.historyItemSummary}</span>
        <strong>{historyCount.toLocaleString()}</strong>
        <span>{copy.originPermissionSummary}</span>
        <strong>{grantedOriginCount.toLocaleString()}</strong>
      </fieldset>

      <div className="privacy-links">
        <a href={getExtensionPageUrl("privacy.html")} target="_blank" rel="noreferrer">
          {copy.openPrivacyPolicy}
        </a>
        <a href={getExtensionPageUrl("support.html")} target="_blank" rel="noreferrer">
          <Lifebuoy size={15} aria-hidden="true" />
          {copy.openSupport}
        </a>
      </div>

      {feedback ? (
        <div className="feedback" data-kind={feedback.kind} role="status">
          {feedback.kind === "success" ? (
            <CheckCircle size={18} weight="fill" aria-hidden="true" />
          ) : (
            <WarningCircle size={18} weight="fill" aria-hidden="true" />
          )}
          <span>{feedback.text}</span>
        </div>
      ) : null}

      <div className="data-actions">
        <button type="button" className="secondary-button" onClick={copyDiagnostics}>
          <ClipboardText size={16} weight="bold" aria-hidden="true" />
          {copy.copyDiagnostics}
        </button>

        {confirmDeleteKeys ? (
          <span className="inline-confirm">
            <small>{copy.deleteKeysConfirm}</small>
            <button type="button" className="danger-button" onClick={deleteKeys} disabled={isBusy}>
              {copy.confirmDeleteKeys}
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={copy.cancelPromptEdit}
              onClick={() => setConfirmDeleteKeys(false)}
            >
              <X size={15} aria-hidden="true" />
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="history-delete-button"
            onClick={() => setConfirmDeleteKeys(true)}
          >
            <Trash size={15} aria-hidden="true" />
            {copy.deleteSavedKeys}
          </button>
        )}

        {confirmReset ? (
          <span className="inline-confirm">
            <small>{copy.resetDataConfirm}</small>
            <button type="button" className="danger-button" onClick={resetData} disabled={isBusy}>
              {copy.confirmResetData}
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label={copy.cancelPromptEdit}
              onClick={() => setConfirmReset(false)}
            >
              <X size={15} aria-hidden="true" />
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="history-delete-button"
            onClick={() => setConfirmReset(true)}
          >
            <Trash size={15} aria-hidden="true" />
            {copy.resetLocalData}
          </button>
        )}
      </div>
    </div>
  );
}
