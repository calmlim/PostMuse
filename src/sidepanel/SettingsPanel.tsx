import {
  CaretDown,
  ChatCircleDots,
  CheckCircle,
  Eye,
  EyeSlash,
  FloppyDisk,
  ImageSquare,
  Key,
  Plug,
  WarningCircle,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import type { Messages } from "../i18n";
import { createDefaultSettings } from "../core/settings/defaults";
import {
  IMAGE_PROVIDER_DEFINITIONS,
  normalizeBaseUrl,
  PROVIDER_DEFINITIONS,
} from "../core/settings/provider-catalog";
import type {
  ImageProviderId,
  ImageProviderProfile,
  ProviderId,
  ProviderProfile,
  SecretStatus,
  SettingsSnapshot,
} from "../core/settings/types";
import { supportsInsecureLocalhost } from "../core/settings/runtime-capabilities";
import { requestProviderOriginPermission, sendExtensionRequest } from "./extension-client";
import { CreationPreferencesPanel } from "./CreationPreferencesPanel";
import { PrivacyDataPanel } from "./PrivacyDataPanel";

interface SettingsPanelProps {
  copy: Messages;
  onSettingsChanged?: () => void;
  onDataReset?: () => void;
  historyRevision?: number;
}

type Feedback = { kind: "success" | "error"; message: string } | undefined;

const getDefaultSnapshot = (): SettingsSnapshot => ({
  settings: createDefaultSettings(),
  activeSecretStatus: { hasKey: false },
  activeImageSecretStatus: { hasKey: false },
});

const getActiveProfile = (snapshot: SettingsSnapshot): ProviderProfile =>
  snapshot.settings.textProviderProfiles.find(
    (profile) => profile.id === snapshot.settings.activeTextProviderProfileId,
  ) ?? snapshot.settings.textProviderProfiles[0];

const getActiveImageProfile = (snapshot: SettingsSnapshot): ImageProviderProfile =>
  snapshot.settings.imageProviderProfiles.find(
    (profile) => profile.id === snapshot.settings.activeImageProviderProfileId,
  ) ?? snapshot.settings.imageProviderProfiles[0];

const normalizeSnapshot = (snapshot: SettingsSnapshot): SettingsSnapshot => ({
  ...snapshot,
  activeImageSecretStatus: snapshot.activeImageSecretStatus ?? { hasKey: false },
});

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
    AUTH_INVALID: copy.errorAuthInvalid,
    MODEL_FORBIDDEN: copy.errorModelForbidden,
    MODEL_NOT_FOUND: copy.errorModelNotFound,
    ENDPOINT_NOT_FOUND: copy.errorEndpointNotFound,
    PROVIDER_REQUEST_INVALID: copy.errorProviderRequestInvalid,
    RATE_LIMITED: copy.errorRateLimited,
    PROVIDER_UNAVAILABLE: copy.errorProviderUnavailable,
    TIMEOUT: copy.errorTimeout,
    NETWORK_ERROR: copy.errorNetwork,
    CONTENT_REJECTED: copy.errorContentRejected,
    OUTPUT_INVALID: copy.errorOutputInvalid,
  };

  return localized[error.name] ?? error.message ?? copy.errorGeneric;
};

export function SettingsPanel({
  copy,
  onSettingsChanged,
  onDataReset,
  historyRevision,
}: SettingsPanelProps) {
  const [snapshot, setSnapshot] = useState<SettingsSnapshot>(getDefaultSnapshot());
  const [profile, setProfile] = useState<ProviderProfile>(getActiveProfile(snapshot));
  const [imageProfile, setImageProfile] = useState<ImageProviderProfile>(
    getActiveImageProfile(snapshot),
  );
  const [secretStatus, setSecretStatus] = useState<SecretStatus>({ hasKey: false });
  const [imageSecretStatus, setImageSecretStatus] = useState<SecretStatus>({ hasKey: false });
  const [apiKey, setApiKey] = useState("");
  const [imageApiKey, setImageApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [showImageKey, setShowImageKey] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [imageAdvancedOpen, setImageAdvancedOpen] = useState(false);
  const [textSectionOpen, setTextSectionOpen] = useState(false);
  const [imageSectionOpen, setImageSectionOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [isImageBusy, setIsImageBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>();
  const [imageFeedback, setImageFeedback] = useState<Feedback>();
  const supportsCustomSampling =
    profile.provider === "openai-compatible" || profile.provider === "xai";

  useEffect(() => {
    let active = true;

    void sendExtensionRequest({ type: "settings.get" })
      .then((snapshot) => {
        if (active) {
          const normalized = normalizeSnapshot(snapshot);
          setSnapshot(normalized);
          setProfile(getActiveProfile(normalized));
          setSecretStatus(normalized.activeSecretStatus);
          setImageProfile(getActiveImageProfile(normalized));
          setImageSecretStatus(normalized.activeImageSecretStatus);
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
    setApiKey("");
    setFeedback(
      secretStatus.hasKey || secretStatus.requiresReentry
        ? { kind: "error", message: copy.errorKeyReentry }
        : undefined,
    );
  };

  const updateImageProfile = <K extends keyof ImageProviderProfile>(
    key: K,
    value: ImageProviderProfile[K],
  ) => {
    setImageProfile((current) => ({ ...current, [key]: value }));
    setImageFeedback(undefined);
  };

  const selectImageProvider = (provider: ImageProviderId) => {
    setImageProfile((current) => {
      const currentDefinition = IMAGE_PROVIDER_DEFINITIONS[current.provider];
      const nextDefinition = IMAGE_PROVIDER_DEFINITIONS[provider];
      return {
        ...current,
        provider,
        displayName: nextDefinition.label,
        model:
          current.model === currentDefinition.defaultModel
            ? nextDefinition.defaultModel
            : current.model,
        baseUrl:
          current.baseUrl === currentDefinition.defaultBaseUrl
            ? nextDefinition.defaultBaseUrl
            : current.baseUrl,
      };
    });
    setImageApiKey("");
    setImageFeedback(
      imageSecretStatus.hasKey || imageSecretStatus.requiresReentry
        ? { kind: "error", message: copy.errorKeyReentry }
        : undefined,
    );
  };

  const applySnapshot = (snapshot: SettingsSnapshot) => {
    const normalized = normalizeSnapshot(snapshot);
    setSnapshot(normalized);
    setProfile(getActiveProfile(normalized));
    setSecretStatus(normalized.activeSecretStatus);
    setApiKey("");
    setImageProfile(getActiveImageProfile(normalized));
    setImageSecretStatus(normalized.activeImageSecretStatus);
    setImageApiKey("");
    onSettingsChanged?.();
  };

  const saveImageProfile = async () => {
    setIsImageBusy(true);
    setImageFeedback(undefined);

    try {
      const normalizedProfile = {
        ...imageProfile,
        model: imageProfile.model.trim(),
        baseUrl: normalizeBaseUrl(imageProfile.baseUrl, {
          allowInsecureLocalhost: supportsInsecureLocalhost(),
        }),
      };
      const snapshot = await sendExtensionRequest({
        type: "settings.saveImageProfile",
        profile: normalizedProfile,
        ...(imageApiKey.trim() ? { apiKey: imageApiKey } : {}),
      });
      applySnapshot(snapshot);
      setImageFeedback({ kind: "success", message: copy.imageSettingsSaved });
    } catch (error) {
      setImageFeedback({ kind: "error", message: getFriendlyError(error, copy) });
    } finally {
      setIsImageBusy(false);
    }
  };

  const saveProfile = async () => {
    setIsBusy(true);
    setFeedback(undefined);

    try {
      const normalizedProfile = {
        ...profile,
        model: profile.model.trim(),
        baseUrl: normalizeBaseUrl(profile.baseUrl, {
          allowInsecureLocalhost: supportsInsecureLocalhost(),
        }),
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
        baseUrl: normalizeBaseUrl(profile.baseUrl, {
          allowInsecureLocalhost: supportsInsecureLocalhost(),
        }),
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
        message: copy.connectionTestPassed
          .replace("{model}", result.model)
          .replace("{time}", new Date(result.checkedAt).toLocaleString()),
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

      <CreationPreferencesPanel
        copy={copy}
        revision={historyRevision}
        onChanged={onSettingsChanged}
      />

      <div className="settings-card settings-disclosure-card">
        <button
          type="button"
          className="settings-disclosure-trigger"
          aria-expanded={textSectionOpen}
          aria-controls="text-provider-settings"
          onClick={() => setTextSectionOpen((value) => !value)}
        >
          <ChatCircleDots size={20} weight="duotone" aria-hidden="true" />
          <span className="settings-disclosure-copy">
            <strong>{copy.textProviderSectionTitle}</strong>
            <span>{copy.textProviderSectionBody}</span>
          </span>
          <CaretDown size={17} data-open={textSectionOpen} aria-hidden="true" />
        </button>
        {textSectionOpen ? (
          <div id="text-provider-settings" className="settings-disclosure-content">
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
                    placeholder={
                      secretStatus.requiresReentry
                        ? copy.apiKeyReentryPlaceholder
                        : secretStatus.hasKey
                          ? copy.apiKeySaved
                          : copy.apiKeyPlaceholder
                    }
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
                <small>
                  {secretStatus.requiresReentry
                    ? copy.apiKeyReentryHint
                    : secretStatus.hasKey
                      ? copy.apiKeyReplaceHint
                      : copy.apiKeyHint}
                </small>
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
                  <small>
                    {supportsInsecureLocalhost() ? copy.baseUrlHint : copy.baseUrlHttpsOnlyHint}
                  </small>
                </label>

                {supportsCustomSampling ? (
                  <label className="form-field">
                    <span>{copy.samplingModeLabel}</span>
                    <select
                      value={profile.samplingMode}
                      onChange={(event) =>
                        updateProfile(
                          "samplingMode",
                          event.target.value as ProviderProfile["samplingMode"],
                        )
                      }
                      disabled={isLoading || isBusy}
                    >
                      <option value="provider-default">{copy.samplingProviderDefault}</option>
                      <option value="custom">{copy.samplingCustom}</option>
                    </select>
                    <small>{copy.samplingModeHint}</small>
                  </label>
                ) : null}

                {supportsCustomSampling && profile.samplingMode === "custom" ? (
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
                    <small>{copy.temperatureHint}</small>
                  </label>
                ) : null}

                <label className="form-field">
                  <span>{copy.maxTokensLabel}</span>
                  <input
                    type="number"
                    min="1"
                    max="100000"
                    step="1"
                    value={profile.maxOutputTokens}
                    onChange={(event) =>
                      updateProfile("maxOutputTokens", Number(event.target.value))
                    }
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

            <p className="mock-note">{copy.connectionTestNote}</p>
          </div>
        ) : null}
      </div>

      <div className="settings-card settings-disclosure-card">
        <button
          type="button"
          className="settings-disclosure-trigger"
          aria-expanded={imageSectionOpen}
          aria-controls="image-provider-settings"
          onClick={() => setImageSectionOpen((value) => !value)}
        >
          <ImageSquare size={20} weight="duotone" aria-hidden="true" />
          <span className="settings-disclosure-copy">
            <strong>{copy.imageProviderSectionTitle}</strong>
            <span>{copy.imageProviderSectionBody}</span>
          </span>
          <CaretDown size={17} data-open={imageSectionOpen} aria-hidden="true" />
        </button>

        {imageSectionOpen ? (
          <div id="image-provider-settings" className="settings-disclosure-content">
            <div className="field-grid settings-card-fields">
              <label className="form-field">
                <span>{copy.imageProviderLabel}</span>
                <select
                  value={imageProfile.provider}
                  onChange={(event) => selectImageProvider(event.target.value as ImageProviderId)}
                  disabled={isLoading || isImageBusy}
                >
                  {Object.values(IMAGE_PROVIDER_DEFINITIONS).map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span>{copy.imageModelLabel}</span>
                <input
                  value={imageProfile.model}
                  onChange={(event) => updateImageProfile("model", event.target.value)}
                  placeholder={copy.imageModelPlaceholder}
                  disabled={isLoading || isImageBusy}
                  autoComplete="off"
                />
              </label>

              <div className="form-field field-wide">
                <label htmlFor="image-provider-api-key">{copy.imageApiKeyLabel}</label>
                <span className="secret-input">
                  <Key size={16} aria-hidden="true" />
                  <input
                    id="image-provider-api-key"
                    type={showImageKey ? "text" : "password"}
                    value={imageApiKey}
                    onChange={(event) => setImageApiKey(event.target.value)}
                    placeholder={
                      imageSecretStatus.requiresReentry
                        ? copy.apiKeyReentryPlaceholder
                        : imageSecretStatus.hasKey
                          ? copy.apiKeySaved
                          : copy.imageApiKeyPlaceholder
                    }
                    disabled={isLoading || isImageBusy}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={showImageKey ? copy.hideImageApiKey : copy.showImageApiKey}
                    onClick={() => setShowImageKey((value) => !value)}
                  >
                    {showImageKey ? <EyeSlash size={17} /> : <Eye size={17} />}
                  </button>
                </span>
                <small>
                  {imageSecretStatus.requiresReentry
                    ? copy.apiKeyReentryHint
                    : imageSecretStatus.hasKey
                      ? copy.apiKeyReplaceHint
                      : copy.imageApiKeyHint}
                </small>
              </div>
            </div>

            <fieldset className="storage-choice">
              <legend>{copy.storageLabel}</legend>
              <label data-active={imageProfile.keyPersistence === "session"}>
                <input
                  type="radio"
                  name="image-key-persistence"
                  value="session"
                  checked={imageProfile.keyPersistence === "session"}
                  onChange={() => updateImageProfile("keyPersistence", "session")}
                  disabled={isLoading || isImageBusy}
                />
                <span>
                  <strong>{copy.storageSession}</strong>
                  <small>{copy.storageSessionHint}</small>
                </span>
              </label>
              <label data-active={imageProfile.keyPersistence === "local"}>
                <input
                  type="radio"
                  name="image-key-persistence"
                  value="local"
                  checked={imageProfile.keyPersistence === "local"}
                  onChange={() => updateImageProfile("keyPersistence", "local")}
                  disabled={isLoading || isImageBusy}
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
              aria-expanded={imageAdvancedOpen}
              onClick={() => setImageAdvancedOpen((value) => !value)}
            >
              <span>{copy.advancedTitle}</span>
              <CaretDown size={16} data-open={imageAdvancedOpen} />
            </button>

            {imageAdvancedOpen ? (
              <div className="advanced-fields">
                <label className="form-field field-wide">
                  <span>{copy.imageBaseUrlLabel}</span>
                  <input
                    type="url"
                    value={imageProfile.baseUrl}
                    onChange={(event) => updateImageProfile("baseUrl", event.target.value)}
                    disabled={isLoading || isImageBusy}
                    spellCheck={false}
                  />
                  <small>
                    {supportsInsecureLocalhost() ? copy.baseUrlHint : copy.baseUrlHttpsOnlyHint}
                  </small>
                </label>
              </div>
            ) : null}

            {imageFeedback ? (
              <div className="feedback" data-kind={imageFeedback.kind} role="status">
                {imageFeedback.kind === "success" ? (
                  <CheckCircle size={18} weight="fill" aria-hidden="true" />
                ) : (
                  <WarningCircle size={18} weight="fill" aria-hidden="true" />
                )}
                <span>{imageFeedback.message}</span>
              </div>
            ) : null}

            <div className="settings-actions">
              <button
                type="button"
                className="primary-button"
                onClick={saveImageProfile}
                disabled={isLoading || isImageBusy}
              >
                <FloppyDisk size={17} weight="bold" aria-hidden="true" />
                {copy.saveImageSettings}
              </button>
            </div>
            <p className="mock-note">{copy.imageSettingsNote}</p>
          </div>
        ) : null}
      </div>

      <PrivacyDataPanel
        copy={copy}
        snapshot={snapshot}
        onSnapshot={applySnapshot}
        onDataReset={onDataReset}
        revision={historyRevision}
      />
    </section>
  );
}
