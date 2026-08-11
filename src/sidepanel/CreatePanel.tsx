import {
  CaretDown,
  FileText,
  GearSix,
  Sparkle,
  StopCircle,
  UploadSimple,
  WarningCircle,
} from "@phosphor-icons/react";
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { createRequestId } from "../core/contracts/messages";
import type {
  ContentType,
  GenerationInput,
  GenerationResult,
  OutputLength,
  SourceKind,
} from "../core/generation/types";
import { MAX_FILE_BYTES } from "../core/generation/validation";
import { BUILT_IN_STYLES } from "../core/prompts/styles";
import type { ProviderProfile, SettingsSnapshot } from "../core/settings/types";
import type { Messages } from "../i18n";
import { loadCreateAdvancedOpen, saveCreateAdvancedOpen } from "../storage/create-ui-preferences";
import { requestProviderOriginPermission, sendExtensionRequest } from "./extension-client";
import { GenerationResults } from "./GenerationResults";

interface CreatePanelProps {
  copy: Messages;
  onOpenSettings: () => void;
  settingsRevision: number;
}

interface DraftForm {
  sourceKind: SourceKind;
  text: string;
  contentType: ContentType;
  languageValue: "follow-source" | "en" | "zh-CN" | "zh-TW" | "custom";
  customLanguage: string;
  styleId: string;
  length: OutputLength;
  audience: string;
  goal: string;
  tone: string;
  mustInclude: string;
  mustAvoid: string;
  candidateCount: number;
  threadCount: number;
}

const initialForm: DraftForm = {
  sourceKind: "idea",
  text: "",
  contentType: "post",
  languageValue: "follow-source",
  customLanguage: "",
  styleId: "professional",
  length: "medium",
  audience: "",
  goal: "",
  tone: "",
  mustInclude: "",
  mustAvoid: "",
  candidateCount: 3,
  threadCount: 5,
};

const getActiveProfile = (snapshot: SettingsSnapshot): ProviderProfile | undefined =>
  snapshot.settings.textProviderProfiles.find(
    (profile) => profile.id === snapshot.settings.activeTextProviderProfileId,
  );

const getFriendlyError = (error: unknown, copy: Messages): string => {
  if (!(error instanceof Error)) {
    return copy.generationErrorGeneric;
  }

  const localized: Partial<Record<string, string>> = {
    API_KEY_REQUIRED: copy.errorKeyRequired,
    MODEL_REQUIRED: copy.errorModelRequired,
    HOST_PERMISSION_REQUIRED: copy.errorPermissionRequired,
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
    REQUEST_CANCELLED: copy.generationCancelled,
  };

  return localized[error.name] ?? error.message ?? copy.generationErrorGeneric;
};

export function CreatePanel({ copy, onOpenSettings, settingsRevision }: CreatePanelProps) {
  const [form, setForm] = useState<DraftForm>(initialForm);
  const [snapshot, setSnapshot] = useState<SettingsSnapshot>();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [result, setResult] = useState<GenerationResult>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string>();
  const [fileName, setFileName] = useState<string>();
  const activeRequestId = useRef<string | undefined>(undefined);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Settings revision is an explicit reload signal.
  useEffect(() => {
    let active = true;
    void Promise.all([
      sendExtensionRequest({ type: "settings.get" }).catch(() => undefined),
      loadCreateAdvancedOpen(),
    ]).then(([settingsSnapshot, storedAdvancedOpen]) => {
      if (active) {
        setSnapshot(settingsSnapshot);
        setAdvancedOpen(storedAdvancedOpen);
      }
    });

    return () => {
      active = false;
    };
  }, [settingsRevision]);

  const updateForm = <K extends keyof DraftForm>(key: K, value: DraftForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError(undefined);
  };

  const selectContentType = (contentType: ContentType) => {
    setForm((current) => ({
      ...current,
      contentType,
      candidateCount: contentType === "thread" || contentType === "long-post" ? 1 : 3,
    }));
    setError(undefined);
  };

  const toggleAdvanced = () => {
    const next = !advancedOpen;
    setAdvancedOpen(next);
    void saveCreateAdvancedOpen(next);
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    if (!/\.(txt|md)$/i.test(file.name)) {
      setError(copy.fileTypeError);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError(copy.fileSizeError);
      return;
    }

    try {
      const text = await file.text();
      setForm((current) => ({ ...current, sourceKind: "file", text }));
      setFileName(file.name);
      setError(undefined);
    } catch {
      setError(copy.fileReadError);
    }
  };

  const buildInput = (): GenerationInput => ({
    source: { kind: form.sourceKind, text: form.text.trim() },
    contentType: form.contentType,
    language:
      form.languageValue === "follow-source"
        ? { mode: "follow-source" }
        : {
            mode: "fixed",
            value:
              form.languageValue === "custom" ? form.customLanguage.trim() : form.languageValue,
          },
    styleId: form.styleId,
    length: form.length,
    audience: form.audience.trim() || undefined,
    goal: form.goal.trim() || undefined,
    tone: form.tone.trim() || undefined,
    mustInclude: form.mustInclude.trim() || undefined,
    mustAvoid: form.mustAvoid.trim() || undefined,
    candidateCount: form.candidateCount,
    threadCount: form.contentType === "thread" ? form.threadCount : undefined,
  });

  const profile = snapshot ? getActiveProfile(snapshot) : undefined;
  const isConfigured = Boolean(profile?.model.trim() && snapshot?.activeSecretStatus.hasKey);

  const generate = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.text.trim()) {
      setError(copy.sourceRequired);
      return;
    }
    if (form.languageValue === "custom" && !form.customLanguage.trim()) {
      setError(copy.customLanguageRequired);
      return;
    }
    if (!profile || !isConfigured) {
      onOpenSettings();
      return;
    }
    const generationInput = buildInput();

    let permissionPromise: Promise<boolean>;
    try {
      permissionPromise = requestProviderOriginPermission(profile.baseUrl);
    } catch (permissionError) {
      setError(getFriendlyError(permissionError, copy));
      return;
    }

    setIsGenerating(true);
    setError(undefined);
    const requestId = createRequestId();
    activeRequestId.current = requestId;

    try {
      const allowed = await permissionPromise;
      if (!allowed) {
        throw Object.assign(new Error(copy.errorPermissionRequired), {
          name: "HOST_PERMISSION_REQUIRED",
        });
      }
      if (activeRequestId.current !== requestId) {
        return;
      }
      const generationResult = await sendExtensionRequest(
        { type: "text.generate", input: generationInput },
        { requestId },
      );
      if (activeRequestId.current === requestId) {
        setResult(generationResult);
      }
    } catch (generationError) {
      if (activeRequestId.current === requestId) {
        setError(getFriendlyError(generationError, copy));
      }
    } finally {
      if (activeRequestId.current === requestId) {
        activeRequestId.current = undefined;
        setIsGenerating(false);
      }
    }
  };

  const cancelGeneration = () => {
    const targetRequestId = activeRequestId.current;
    if (!targetRequestId) {
      return;
    }
    activeRequestId.current = undefined;
    setIsGenerating(false);
    setError(copy.generationCancelled);
    void sendExtensionRequest({ type: "text.cancel", targetRequestId }).catch(() => undefined);
  };

  const styleLabels: Record<string, string> = {
    professional: copy.styleProfessional,
    concise: copy.styleConcise,
    friendly: copy.styleFriendly,
    humorous: copy.styleHumorous,
    sharp: copy.styleSharp,
    storytelling: copy.styleStorytelling,
    educational: copy.styleEducational,
    "thought-leadership": copy.styleThoughtLeadership,
    "product-launch": copy.styleProductLaunch,
    "personal-reflection": copy.stylePersonalReflection,
  };

  return (
    <div className="create-panel">
      <section className="create-heading" aria-labelledby="create-title">
        <p>{copy.createEyebrow}</p>
        <h1 id="create-title">{copy.createTitle}</h1>
        <span>{copy.createBody}</span>
      </section>

      <form className="create-card" onSubmit={generate}>
        <label className="form-field source-field">
          <span>{copy.sourceLabel}</span>
          <textarea
            value={form.text}
            onChange={(event) => {
              updateForm("text", event.target.value);
              if (form.sourceKind === "file") {
                updateForm("sourceKind", "draft");
                setFileName(undefined);
              }
            }}
            placeholder={copy.sourcePlaceholder}
            rows={7}
            maxLength={100_000}
            disabled={isGenerating}
          />
        </label>

        <div className="source-tools">
          <label className="file-button">
            <UploadSimple size={16} weight="bold" aria-hidden="true" />
            <span>{copy.uploadTextFile}</span>
            <input
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              onChange={handleFile}
              disabled={isGenerating}
            />
          </label>
          {fileName ? (
            <span className="file-name">
              <FileText size={15} aria-hidden="true" />
              {fileName}
            </span>
          ) : null}
          <span className="input-count">{form.text.length.toLocaleString()} / 100,000</span>
        </div>

        <div className="create-grid">
          <label className="form-field">
            <span>{copy.contentTypeLabel}</span>
            <select
              value={form.contentType}
              onChange={(event) => selectContentType(event.target.value as ContentType)}
              disabled={isGenerating}
            >
              <option value="post">{copy.contentTypePost}</option>
              <option value="reply">{copy.contentTypeReply}</option>
              <option value="quote">{copy.contentTypeQuote}</option>
              <option value="thread">{copy.contentTypeThread}</option>
              <option value="long-post">{copy.contentTypeLongPost}</option>
            </select>
          </label>

          <label className="form-field">
            <span>{copy.outputLanguageLabel}</span>
            <select
              value={form.languageValue}
              onChange={(event) =>
                updateForm("languageValue", event.target.value as DraftForm["languageValue"])
              }
              disabled={isGenerating}
            >
              <option value="follow-source">{copy.languageFollowSource}</option>
              <option value="en">English</option>
              <option value="zh-CN">简体中文</option>
              <option value="zh-TW">繁體中文</option>
              <option value="custom">{copy.languageCustom}</option>
            </select>
          </label>

          {form.languageValue === "custom" ? (
            <label className="form-field field-wide">
              <span>{copy.customLanguageLabel}</span>
              <input
                value={form.customLanguage}
                onChange={(event) => updateForm("customLanguage", event.target.value)}
                placeholder={copy.customLanguagePlaceholder}
                maxLength={80}
                disabled={isGenerating}
              />
            </label>
          ) : null}

          <label className="form-field">
            <span>{copy.styleLabel}</span>
            <select
              value={form.styleId}
              onChange={(event) => updateForm("styleId", event.target.value)}
              disabled={isGenerating}
            >
              {BUILT_IN_STYLES.map((style) => (
                <option value={style.id} key={style.id}>
                  {styleLabels[style.id]}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>{copy.lengthLabel}</span>
            <select
              value={form.length}
              onChange={(event) => updateForm("length", event.target.value as OutputLength)}
              disabled={isGenerating}
            >
              <option value="short">{copy.lengthShort}</option>
              <option value="medium">{copy.lengthMedium}</option>
              <option value="long">{copy.lengthLong}</option>
            </select>
          </label>
        </div>

        <button
          type="button"
          className="advanced-toggle"
          aria-expanded={advancedOpen}
          onClick={toggleAdvanced}
          disabled={isGenerating}
        >
          <span>{copy.advancedWritingTitle}</span>
          <CaretDown size={16} data-open={advancedOpen} />
        </button>

        {advancedOpen ? (
          <div className="advanced-fields create-advanced-fields">
            <label className="form-field">
              <span>{copy.audienceLabel}</span>
              <input
                value={form.audience}
                onChange={(event) => updateForm("audience", event.target.value)}
                maxLength={500}
                disabled={isGenerating}
              />
            </label>
            <label className="form-field">
              <span>{copy.goalLabel}</span>
              <input
                value={form.goal}
                onChange={(event) => updateForm("goal", event.target.value)}
                maxLength={500}
                disabled={isGenerating}
              />
            </label>
            <label className="form-field field-wide">
              <span>{copy.toneLabel}</span>
              <input
                value={form.tone}
                onChange={(event) => updateForm("tone", event.target.value)}
                maxLength={500}
                disabled={isGenerating}
              />
            </label>
            <label className="form-field">
              <span>{copy.mustIncludeLabel}</span>
              <textarea
                value={form.mustInclude}
                onChange={(event) => updateForm("mustInclude", event.target.value)}
                rows={3}
                maxLength={1000}
                disabled={isGenerating}
              />
            </label>
            <label className="form-field">
              <span>{copy.mustAvoidLabel}</span>
              <textarea
                value={form.mustAvoid}
                onChange={(event) => updateForm("mustAvoid", event.target.value)}
                rows={3}
                maxLength={1000}
                disabled={isGenerating}
              />
            </label>
            {form.contentType === "thread" ? (
              <label className="form-field field-wide compact-number-field">
                <span>{copy.threadCountLabel}</span>
                <input
                  type="number"
                  min="2"
                  max="20"
                  value={form.threadCount}
                  onChange={(event) => updateForm("threadCount", Number(event.target.value))}
                  disabled={isGenerating}
                />
              </label>
            ) : form.contentType !== "long-post" ? (
              <label className="form-field field-wide compact-number-field">
                <span>{copy.candidateCountLabel}</span>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={form.candidateCount}
                  onChange={(event) => updateForm("candidateCount", Number(event.target.value))}
                  disabled={isGenerating}
                />
              </label>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div className="feedback" data-kind="error" role="alert">
            <WarningCircle size={18} weight="fill" aria-hidden="true" />
            <span>{error}</span>
          </div>
        ) : null}

        {!isConfigured ? (
          <button type="button" className="setup-callout" onClick={onOpenSettings}>
            <GearSix size={18} weight="duotone" aria-hidden="true" />
            <span>
              <strong>{copy.configureModelTitle}</strong>
              <small>{copy.configureModelBody}</small>
            </span>
          </button>
        ) : null}

        <div className="generate-actions">
          {isGenerating ? (
            <button type="button" className="secondary-button" onClick={cancelGeneration}>
              <StopCircle size={17} weight="bold" aria-hidden="true" />
              {copy.cancelGeneration}
            </button>
          ) : null}
          <button type="submit" className="primary-button generate-button" disabled={isGenerating}>
            <Sparkle size={17} weight="fill" aria-hidden="true" />
            {isGenerating ? copy.generating : copy.generate}
          </button>
        </div>
        <p className="provider-disclosure">
          {isConfigured && profile
            ? copy.providerDisclosure
                .replace("{provider}", profile.displayName)
                .replace("{origin}", new URL(profile.baseUrl).origin)
            : copy.localDraftNote}
        </p>
      </form>

      {result ? <GenerationResults copy={copy} result={result} onChange={setResult} /> : null}
    </div>
  );
}
