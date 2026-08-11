import {
  CaretDown,
  CheckCircle,
  Eye,
  EyeSlash,
  FloppyDisk,
  Key,
  Plug,
  WarningCircle,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import type { Messages } from "../i18n";
import { createDefaultSettings } from "../core/settings/defaults";
import { normalizeBaseUrl, PROVIDER_DEFINITIONS } from "../core/settings/provider-catalog";
import type {
  ProviderId,
  ProviderProfile,
  SecretStatus,
  SettingsSnapshot,
} from "../core/settings/types";
import { requestProviderOriginPermission, sendExtensionRequest } from "./extension-client";

interface SettingsPanelProps {
  copy: Messages;
  onSettingsChanged?: () => void;
}

type Feedback = { kind: "success" | "error"; message: string } | undefined;

const getDefaultSnapshot = (): SettingsSnapshot => ({
  settings: createDefaultSettings(),
  activeSecretStatus: { hasKey: false },
});

const getActiveProfile = (snapshot: SettingsSnapshot): ProviderProfile =>
  snapshot.settings.textProviderProfiles.find(
    (profile) => profile.id === snapshot.settings.activeTextProviderProfileId,
  ) ?? snapshot.settings.textProviderProfiles[0];

const getFriendlyError = (error: unknown, copy: Messages): string => {
  if (!(error instanceof Error)) {
    return copy.errorGeneric;
  }

  const localized: Partial<Record<string, string>> = {
    API_KEY_REQUIRED: copy.errorKeyRequired,
    API_KEY_REENTRY_REQUIRED: copy.errorKeyReentry,
    HOST_PERMISSION_REQUIRED: copy.errorPermissionRequired,
    MODEL_REQUIRED: copy.errorModelRequired,
    INVALID_REQUEST: copy.errorInvalidSettings,
  };

  return localized[error.name] ?? error.message ?? copy.errorGeneric;
};

export function SettingsPanel({ copy, onSettingsChanged }: SettingsPanelProps) {
  const [profile, setProfile] = useState<ProviderProfile>(getActiveProfile(getDefaultSnapshot()));
  const [secretStatus, setSecretStatus] = useState<SecretStatus>({ hasKey: false });
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>();

  useEffect(() => {
    let active = true;

    void sendExtensionRequest({ type: "settings.get" })
      .then((snapshot) => {
        if (active) {
          setProfile(getActiveProfile(snapshot));
          setSecretStatus(snapshot.activeSecretStatus);
        }
      })
      .catch(() => {
        // Vite preview has no extension runtime. Defaults keep the UI inspectable.
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const updateProfile = <K extends keyof ProviderProfile>(key: K, value: ProviderProfile[K]) => {
    setProfile((current) => ({ ...current, [key]: value }));
    setFeedback(undefined);
  };

  const selectProvider = (provider: ProviderId) => {
    setProfile((current) => {
      const currentDefault = PROVIDER_DEFINITIONS[current.provider].defaultBaseUrl;
      const nextDefinition = PROVIDER_DEFINITIONS[provider];
      return {
        ...current,
        provider,
        displayName: nextDefinition.label,
        baseUrl:
          current.baseUrl === currentDefault ? nextDefinition.defaultBaseUrl : current.baseUrl,
      };
    });
    setFeedback(undefined);
  };

  const applySnapshot = (snapshot: SettingsSnapshot) => {
    setProfile(getActiveProfile(snapshot));
    setSecretStatus(snapshot.activeSecretStatus);
    setApiKey("");
    onSettingsChanged?.();
  };

  const saveProfile = async () => {
    setIsBusy(true);
    setFeedback(undefined);

    try {
      const normalizedProfile = {
        ...profile,
        model: profile.model.trim(),
        baseUrl: normalizeBaseUrl(profile.baseUrl, { allowInsecureLocalhost: true }),
      };
      const snapshot = await sendExtensionRequest({
        type: "settings.saveProfile",
        profile: normalizedProfile,
        ...(apiKey.trim() ? { apiKey } : {}),
      });
      applySnapshot(snapshot);
      setFeedback({ kind: "success", message: copy.settingsSaved });
    } catch (error) {
      setFeedback({ kind: "error", message: getFriendlyError(error, copy) });
    } finally {
      setIsBusy(false);
    }
  };

  const testConnection = async () => {
    setIsBusy(true);
    setFeedback(undefined);

    let permissionPromise: Promise<boolean>;
    try {
      permissionPromise = requestProviderOriginPermission(profile.baseUrl);
    } catch (error) {
      setIsBusy(false);
      setFeedback({ kind: "error", message: getFriendlyError(error, copy) });
      return;
    }

    try {
      const allowed = await permissionPromise;
      if (!allowed) {
        throw Object.assign(new Error(copy.errorPermissionRequired), {
          name: "HOST_PERMISSION_REQUIRED",
        });
      }

      const normalizedProfile = {
        ...profile,
        model: profile.model.trim(),
        baseUrl: normalizeBaseUrl(profile.baseUrl, { allowInsecureLocalhost: true }),
      };
      const snapshot = await sendExtensionRequest({
        type: "settings.saveProfile",
        profile: normalizedProfile,
        ...(apiKey.trim() ? { apiKey } : {}),
      });
      applySnapshot(snapshot);
      const result = await sendExtensionRequest({
        type: "provider.test",
        profileId: normalizedProfile.id,
      });
      setFeedback({
        kind: "success",
        message: copy.mockTestPassed.replace("{model}", result.model),
      });
    } catch (error) {
      setFeedback({ kind: "error", message: getFriendlyError(error, copy) });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section className="settings-panel" aria-labelledby="settings-title" aria-busy={isLoading}>
      <div className="section-heading">
        <p>{copy.settingsEyebrow}</p>
        <h1 id="settings-title">{copy.settingsTitle}</h1>
        <span>{copy.settingsBody}</span>
      </div>

      <div className="settings-card">
        <div className="field-grid">
          <label className="form-field">
            <span>{copy.providerLabel}</span>
            <select
              value={profile.provider}
              onChange={(event) => selectProvider(event.target.value as ProviderId)}
              disabled={isLoading || isBusy}
            >
              {Object.values(PROVIDER_DEFINITIONS).map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.label}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>{copy.modelLabel}</span>
            <input
              value={profile.model}
              onChange={(event) => updateProfile("model", event.target.value)}
              placeholder={copy.modelPlaceholder}
              disabled={isLoading || isBusy}
              autoComplete="off"
            />
          </label>

          <div className="form-field field-wide">
            <label htmlFor="provider-api-key">{copy.apiKeyLabel}</label>
            <span className="secret-input">
              <Key size={16} aria-hidden="true" />
              <input
                id="provider-api-key"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={secretStatus.hasKey ? copy.apiKeySaved : copy.apiKeyPlaceholder}
                disabled={isLoading || isBusy}
                autoComplete="off"
              />
              <button
                type="button"
                className="icon-button"
                aria-label={showKey ? copy.hideApiKey : copy.showApiKey}
                onClick={() => setShowKey((value) => !value)}
              >
                {showKey ? <EyeSlash size={17} /> : <Eye size={17} />}
              </button>
            </span>
            <small>{secretStatus.hasKey ? copy.apiKeyReplaceHint : copy.apiKeyHint}</small>
          </div>
        </div>

        <fieldset className="storage-choice">
          <legend>{copy.storageLabel}</legend>
          <label data-active={profile.keyPersistence === "session"}>
            <input
              type="radio"
              name="key-persistence"
              value="session"
              checked={profile.keyPersistence === "session"}
              onChange={() => updateProfile("keyPersistence", "session")}
              disabled={isLoading || isBusy}
            />
            <span>
              <strong>{copy.storageSession}</strong>
              <small>{copy.storageSessionHint}</small>
            </span>
          </label>
          <label data-active={profile.keyPersistence === "local"}>
            <input
              type="radio"
              name="key-persistence"
              value="local"
              checked={profile.keyPersistence === "local"}
              onChange={() => updateProfile("keyPersistence", "local")}
              disabled={isLoading || isBusy}
            />
            <span>
              <strong>{copy.storageLocal}</strong>
              <small>{copy.storageLocalHint}</small>
            </span>
          </label>
        </fieldset>

        <button
          type="button"
          className="advanced-toggle"
          aria-expanded={advancedOpen}
          onClick={() => setAdvancedOpen((value) => !value)}
        >
          <span>{copy.advancedTitle}</span>
          <CaretDown size={16} data-open={advancedOpen} />
        </button>

        {advancedOpen ? (
          <div className="advanced-fields">
            <label className="form-field field-wide">
              <span>{copy.baseUrlLabel}</span>
              <input
                type="url"
                value={profile.baseUrl}
                onChange={(event) => updateProfile("baseUrl", event.target.value)}
                disabled={isLoading || isBusy}
                spellCheck={false}
              />
              <small>{copy.baseUrlHint}</small>
            </label>

            <label className="form-field">
              <span>{copy.temperatureLabel}</span>
              <input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={profile.temperature}
                onChange={(event) => updateProfile("temperature", Number(event.target.value))}
                disabled={isLoading || isBusy}
              />
            </label>

            <label className="form-field">
              <span>{copy.maxTokensLabel}</span>
              <input
                type="number"
                min="1"
                max="100000"
                step="1"
                value={profile.maxOutputTokens}
                onChange={(event) => updateProfile("maxOutputTokens", Number(event.target.value))}
                disabled={isLoading || isBusy}
              />
            </label>
          </div>
        ) : null}

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
          <button
            type="button"
            className="secondary-button"
            onClick={testConnection}
            disabled={isLoading || isBusy}
          >
            <Plug size={17} weight="bold" aria-hidden="true" />
            {copy.testConnection}
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={saveProfile}
            disabled={isLoading || isBusy}
          >
            <FloppyDisk size={17} weight="bold" aria-hidden="true" />
            {copy.saveSettings}
          </button>
        </div>

        <p className="mock-note">{copy.mockTestNote}</p>
      </div>
    </section>
  );
}
