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
  GenerationIntent,
  GenerationResult,
  OutputLength,
  RegenerationInput,
  SourceKind,
} from "../core/generation/types";
import { getCustomLengthBounds } from "../core/generation/types";
import { getRecommendedMaxOutputTokens } from "../core/generation/length";
import {
  isOutputLanguageId,
  OUTPUT_LANGUAGE_OPTIONS,
  type OutputLanguageId,
} from "../core/generation/languages";
import type { ImageHistoryMetadata } from "../core/image/types";
import { MAX_FILE_BYTES, MAX_SOURCE_CHARACTERS } from "../core/generation/validation";
import {
  createDefaultPromptLibrary,
  type ResolvedPromptTemplate,
  resolvePromptLibrary,
} from "../core/prompts/library";
import { PROMPT_RECIPE_VERSION } from "../core/prompts/prompt-builder";
import type { ProviderProfile, SettingsSnapshot } from "../core/settings/types";
import { createDefaultCreationPreferences } from "../core/preferences/creation";
import type { Messages } from "../i18n";
import { loadCreateAdvancedOpen, saveCreateAdvancedOpen } from "../storage/create-ui-preferences";
import { loadCreationPreferences } from "../storage/creation-preferences";
import { loadHistoryEnabled } from "../storage/history-preferences";
import {
  saveHistoryRecord,
  updateHistoryMedia,
  updateHistoryResult,
} from "../storage/history-repository";
import { loadResolvedPromptLibrary } from "../storage/prompt-repository";
import { requestProviderOriginPermission, sendExtensionRequest } from "./extension-client";
import { GenerationResults } from "./GenerationResults";

interface CreatePanelProps {
  copy: Messages;
  onOpenSettings: () => void;
  settingsRevision: number;
  promptRevision: number;
  historyRevision: number;
  historyDraft?: { requestId: string; input: GenerationInput };
  onHistoryChanged: () => void;
}

interface DraftForm {
  sourceKind: SourceKind;
  text: string;
  contentType: ContentType;
  intent: GenerationIntent;
  languageValue: "follow-source" | OutputLanguageId | "custom";
  customLanguage: string;
  styleId: string;
  length: OutputLength;
  customLength: number;
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
  intent: "agree-and-add",
  languageValue: "follow-source",
  customLanguage: "",
  styleId: "professional",
  length: "medium",
  customLength: 180,
  audience: "",
  goal: "",
  tone: "",
  mustInclude: "",
  mustAvoid: "",
  candidateCount: 3,
  threadCount: 5,
};

const defaultActiveStyles = resolvePromptLibrary(createDefaultPromptLibrary()).active;

const getLengthLabels = (contentType: ContentType, copy: Messages): Record<OutputLength, string> =>
  contentType === "thread"
    ? {
        short: copy.lengthThreadShort,
        medium: copy.lengthThreadMedium,
        long: copy.lengthThreadLong,
        custom: copy.lengthCustom,
      }
    : contentType === "long-post"
      ? {
          short: copy.lengthLongPostShort,
          medium: copy.lengthLongPostMedium,
          long: copy.lengthLongPostLong,
          custom: copy.lengthCustom,
        }
      : {
          short: copy.lengthShort,
          medium: copy.lengthMedium,
          long: copy.lengthLong,
          custom: copy.lengthCustom,
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
    STYLE_NOT_FOUND: copy.errorStyleNotFound,
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

export function CreatePanel({
  copy,
  onOpenSettings,
  settingsRevision,
  promptRevision,
  historyRevision,
  historyDraft,
  onHistoryChanged,
}: CreatePanelProps) {
  const [form, setForm] = useState<DraftForm>(initialForm);
  const [snapshot, setSnapshot] = useState<SettingsSnapshot>();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [result, setResult] = useState<GenerationResult>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string>();
  const [fileName, setFileName] = useState<string>();
  const [styles, setStyles] = useState<ResolvedPromptTemplate[]>(defaultActiveStyles);
  const [historyEnabled, setHistoryEnabled] = useState(true);
  const [rawHistorySaved, setRawHistorySaved] = useState(false);
  const [lastGenerationInput, setLastGenerationInput] = useState<GenerationInput>();
  const [lastHistoryId, setLastHistoryId] = useState<string>();
  const [regeneratingTarget, setRegeneratingTarget] = useState<string>();
  const [creationPreferences, setCreationPreferences] = useState(
    createDefaultCreationPreferences(),
  );
  const activeRequestId = useRef<string | undefined>(undefined);
  const hasUserEditedRef = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Revisions are explicit reload signals.
  useEffect(() => {
    let active = true;
    void Promise.all([
      sendExtensionRequest({ type: "settings.get" }).catch(() => undefined),
      loadCreateAdvancedOpen(),
      loadResolvedPromptLibrary(),
      loadHistoryEnabled(),
      loadCreationPreferences(),
    ]).then(
      ([
        settingsSnapshot,
        storedAdvancedOpen,
        promptLibrary,
        storedHistoryEnabled,
        preferences,
      ]) => {
        if (active) {
          setSnapshot(settingsSnapshot);
          setAdvancedOpen(storedAdvancedOpen);
          setStyles(promptLibrary.active);
          setHistoryEnabled(storedHistoryEnabled);
          setCreationPreferences(preferences);
          const preferredStyle = promptLibrary.active.some(
            (style) => style.id === preferences.defaultStyleId,
          )
            ? preferences.defaultStyleId
            : (promptLibrary.active[0]?.id ?? "professional");
          setForm((current) => {
            if (current.text.trim() || hasUserEditedRef.current) {
              return promptLibrary.active.some((style) => style.id === current.styleId)
                ? current
                : { ...current, styleId: preferredStyle };
            }
            return {
              ...current,
              languageValue: preferences.create.language,
              styleId: preferredStyle,
              length: preferences.create.length,
              candidateCount:
                current.contentType === "thread" || current.contentType === "long-post"
                  ? 1
                  : preferences.create.candidateCount,
              threadCount: preferences.create.threadCount,
            };
          });
        }
      },
    );

    return () => {
      active = false;
    };
  }, [settingsRevision, promptRevision, historyRevision]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: The request id is the one-shot draft transfer signal.
  useEffect(() => {
    if (!historyDraft) {
      return;
    }
    const { input } = historyDraft;
    hasUserEditedRef.current = true;
    const knownLanguage = input.language.value;
    const languageValue: DraftForm["languageValue"] =
      input.language.mode === "follow-source"
        ? "follow-source"
        : isOutputLanguageId(knownLanguage)
          ? knownLanguage
          : "custom";
    setForm({
      sourceKind: input.source.kind,
      text: input.source.text,
      contentType: input.contentType,
      intent: input.intent ?? (input.contentType === "quote" ? "comment" : "agree-and-add"),
      languageValue,
      customLanguage: languageValue === "custom" ? (knownLanguage ?? "") : "",
      styleId: styles.some((style) => style.id === input.styleId)
        ? input.styleId
        : (styles[0]?.id ?? "professional"),
      length: input.length,
      customLength: input.customLength ?? getCustomLengthBounds(input.contentType).defaultValue,
      audience: input.audience ?? "",
      goal: input.goal ?? "",
      tone: input.tone ?? "",
      mustInclude: input.mustInclude ?? "",
      mustAvoid: input.mustAvoid ?? "",
      candidateCount: input.candidateCount,
      threadCount: input.threadCount ?? 5,
    });
    setResult(undefined);
    setLastGenerationInput(undefined);
    setLastHistoryId(undefined);
    setRawHistorySaved(false);
    setError(input.source.text.length > MAX_SOURCE_CHARACTERS ? copy.sourceLengthError : undefined);
    setFileName(undefined);
  }, [historyDraft?.requestId]);

  const updateForm = <K extends keyof DraftForm>(key: K, value: DraftForm[K]) => {
    hasUserEditedRef.current = true;
    setForm((current) => ({ ...current, [key]: value }));
    setError(undefined);
  };

  const selectContentType = (contentType: ContentType) => {
    hasUserEditedRef.current = true;
    setForm((current) => ({
      ...current,
      contentType,
      intent:
        contentType === "quote"
          ? "comment"
          : contentType === "reply"
            ? "agree-and-add"
            : current.intent,
      candidateCount:
        contentType === "thread" || contentType === "long-post"
          ? 1
          : creationPreferences.create.candidateCount,
      customLength:
        current.customLength >= getCustomLengthBounds(contentType).min &&
        current.customLength <= getCustomLengthBounds(contentType).max
          ? current.customLength
          : getCustomLengthBounds(contentType).defaultValue,
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
      if (text.length > MAX_SOURCE_CHARACTERS) {
        setError(copy.sourceLengthError);
        return;
      }
      setForm((current) => ({ ...current, sourceKind: "file", text }));
      hasUserEditedRef.current = true;
      setFileName(file.name);
      setError(undefined);
    } catch {
      setError(copy.fileReadError);
    }
  };

  const buildInput = (): GenerationInput => ({
    source: { kind: form.sourceKind, text: form.text.trim() },
    contentType: form.contentType,
    intent: form.contentType === "reply" || form.contentType === "quote" ? form.intent : undefined,
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
    customLength: form.length === "custom" ? form.customLength : undefined,
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
  const recommendedMaxOutputTokens = getRecommendedMaxOutputTokens(buildInput());
  const hasTokenBudgetWarning = Boolean(
    profile && profile.maxOutputTokens < recommendedMaxOutputTokens,
  );

  const performFullGeneration = async (generationInput: GenerationInput) => {
    if (!profile) {
      return;
    }
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
        setLastHistoryId(undefined);
        setResult(generationResult);
        setLastGenerationInput(generationInput);
        setRawHistorySaved(false);
        if (historyEnabled && generationResult.format !== "raw") {
          try {
            const historyRecord = await saveHistoryRecord(generationInput, generationResult, {
              recipeVersion: PROMPT_RECIPE_VERSION,
              styleTemplateVersion:
                styles.find((style) => style.id === generationInput.styleId)?.version ?? 1,
            });
            setLastHistoryId(historyRecord.id);
            onHistoryChanged();
          } catch {
            setError(copy.historySaveError);
          }
        }
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

  const generate = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.text.trim()) {
      setError(copy.sourceRequired);
      return;
    }
    if (form.text.length > MAX_SOURCE_CHARACTERS) {
      setError(copy.sourceLengthError);
      return;
    }
    if (form.languageValue === "custom" && !form.customLanguage.trim()) {
      setError(copy.customLanguageRequired);
      return;
    }
    if (form.length === "custom") {
      const bounds = getCustomLengthBounds(form.contentType);
      if (
        !Number.isInteger(form.customLength) ||
        form.customLength < bounds.min ||
        form.customLength > bounds.max
      ) {
        setError(
          copy.customLengthRangeError
            .replace("{min}", bounds.min.toLocaleString())
            .replace("{max}", bounds.max.toLocaleString()),
        );
        return;
      }
    }
    if (!profile || !isConfigured) {
      onOpenSettings();
      return;
    }
    await performFullGeneration(buildInput());
  };

  const regenerateAll = async () => {
    if (!profile || !isConfigured || !lastGenerationInput) {
      onOpenSettings();
      return;
    }
    if (lastGenerationInput.source.text.length > MAX_SOURCE_CHARACTERS) {
      setError(copy.sourceLengthError);
      return;
    }
    await performFullGeneration(lastGenerationInput);
  };

  const regenerateItem = async (target: RegenerationInput["target"]) => {
    if (!profile || !isConfigured || !lastGenerationInput || !result) {
      return;
    }
    let permissionPromise: Promise<boolean>;
    try {
      permissionPromise = requestProviderOriginPermission(profile.baseUrl);
    } catch (permissionError) {
      setError(getFriendlyError(permissionError, copy));
      return;
    }

    const targetKey = `${target.kind}:${target.index}`;
    setIsGenerating(true);
    setRegeneratingTarget(targetKey);
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
      const regenerated = await sendExtensionRequest(
        {
          type: "text.regenerate",
          input: { input: lastGenerationInput, target },
        },
        { requestId },
      );
      if (activeRequestId.current !== requestId) {
        return;
      }
      const nextResult: GenerationResult =
        target.kind === "candidate" && result.format === "candidates"
          ? {
              ...result,
              candidates: result.candidates.map((candidate, index) =>
                index === target.index ? { ...candidate, text: regenerated.text } : candidate,
              ),
            }
          : target.kind === "thread-post" && result.format === "thread"
            ? {
                ...result,
                threads: result.threads.map((thread, threadIndex) =>
                  threadIndex === 0
                    ? {
                        ...thread,
                        posts: thread.posts.map((post, index) =>
                          index === target.index ? { ...post, text: regenerated.text } : post,
                        ),
                      }
                    : thread,
                ),
              }
            : result;
      setResult(nextResult);
      if (lastHistoryId) {
        try {
          await updateHistoryResult(lastHistoryId, nextResult);
          onHistoryChanged();
        } catch {
          setError(copy.historySaveError);
        }
      }
    } catch (regenerationError) {
      if (activeRequestId.current === requestId) {
        setError(getFriendlyError(regenerationError, copy));
      }
    } finally {
      if (activeRequestId.current === requestId) {
        activeRequestId.current = undefined;
        setIsGenerating(false);
        setRegeneratingTarget(undefined);
      }
    }
  };

  const syncHistoryOnCopy = async (currentResult: GenerationResult) => {
    if (!lastHistoryId) {
      return;
    }
    try {
      await updateHistoryResult(lastHistoryId, currentResult);
      onHistoryChanged();
    } catch {
      setError(copy.historySaveError);
    }
  };

  const saveRawResult = async () => {
    if (!historyEnabled || result?.format !== "raw" || !lastGenerationInput) {
      return;
    }
    try {
      const historyRecord = await saveHistoryRecord(lastGenerationInput, result, {
        recipeVersion: PROMPT_RECIPE_VERSION,
        styleTemplateVersion:
          styles.find((style) => style.id === lastGenerationInput.styleId)?.version ?? 1,
      });
      setLastHistoryId(historyRecord.id);
      setRawHistorySaved(true);
      setError(undefined);
      onHistoryChanged();
    } catch {
      setError(copy.historySaveError);
    }
  };

  const saveImageMetadata = async (metadata: ImageHistoryMetadata) => {
    if (!lastHistoryId) {
      return;
    }
    try {
      await updateHistoryMedia(lastHistoryId, metadata);
      onHistoryChanged();
    } catch {
      setError(copy.historySaveError);
    }
  };

  const cancelGeneration = () => {
    const targetRequestId = activeRequestId.current;
    if (!targetRequestId) {
      return;
    }
    activeRequestId.current = undefined;
    setIsGenerating(false);
    setRegeneratingTarget(undefined);
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
  const lengthLabels = getLengthLabels(form.contentType, copy);

  return (
    <div className="create-panel">
      <section className="create-heading" aria-labelledby="create-title">
        <p>{copy.createEyebrow}</p>
        <h1 id="create-title">{copy.createTitle}</h1>
        <span>{copy.createBody}</span>
      </section>

      {!isConfigured ? (
        <section className="onboarding-card" aria-labelledby="onboarding-title">
          <div>
            <p>{copy.onboardingBody}</p>
            <h2 id="onboarding-title">{copy.onboardingTitle}</h2>
          </div>
          <ol>
            <li>
              <span>1</span>
              {copy.onboardingStepProvider}
            </li>
            <li>
              <span>2</span>
              {copy.onboardingStepDraft}
            </li>
            <li>
              <span>3</span>
              {copy.onboardingStepReview}
            </li>
          </ol>
          <button type="button" className="secondary-button" onClick={onOpenSettings}>
            <GearSix size={17} weight="duotone" aria-hidden="true" />
            {copy.onboardingAction}
          </button>
        </section>
      ) : null}

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

        <fieldset className="format-selector">
          <legend>{copy.contentTypeLabel}</legend>
          <div>
            {(["post", "reply", "quote", "thread", "long-post"] as const).map((contentType) => {
              const labels: Record<ContentType, string> = {
                post: copy.contentTypePost,
                reply: copy.contentTypeReply,
                quote: copy.contentTypeQuote,
                thread: copy.contentTypeThread,
                "long-post": copy.contentTypeLongPost,
              };
              const shortLabel =
                contentType === "post"
                  ? copy.contentTypePostShort
                  : contentType === "long-post"
                    ? copy.contentTypeLongPostShort
                    : labels[contentType];
              return (
                <button
                  type="button"
                  aria-label={labels[contentType]}
                  aria-pressed={form.contentType === contentType}
                  data-active={form.contentType === contentType}
                  onClick={() => selectContentType(contentType)}
                  disabled={isGenerating}
                  key={contentType}
                >
                  {shortLabel}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="create-grid">
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
              {OUTPUT_LANGUAGE_OPTIONS.map((option) => (
                <option value={option.id} key={option.id}>
                  {option.label}
                </option>
              ))}
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

          {form.contentType === "reply" || form.contentType === "quote" ? (
            <label className="form-field field-wide">
              <span>{copy.intentLabel}</span>
              <select
                value={form.intent}
                onChange={(event) => updateForm("intent", event.target.value as GenerationIntent)}
                disabled={isGenerating}
              >
                {form.contentType === "reply" ? (
                  <>
                    <option value="agree-and-add">{copy.replyIntentAgreeAndAdd}</option>
                    <option value="respectful-disagree">
                      {copy.replyIntentRespectfulDisagree}
                    </option>
                    <option value="question">{copy.replyIntentQuestion}</option>
                    <option value="humorous">{copy.replyIntentHumorous}</option>
                  </>
                ) : (
                  <>
                    <option value="comment">{copy.quoteIntentComment}</option>
                    <option value="summarize">{copy.quoteIntentSummarize}</option>
                    <option value="extend">{copy.quoteIntentExtend}</option>
                  </>
                )}
              </select>
            </label>
          ) : null}

          <label className="form-field">
            <span>{copy.styleLabel}</span>
            <select
              value={form.styleId}
              onChange={(event) => updateForm("styleId", event.target.value)}
              disabled={isGenerating}
            >
              {styles.map((style) => (
                <option value={style.id} key={style.id}>
                  {style.source === "built-in" && !style.isOverridden
                    ? (styleLabels[style.id] ?? style.label)
                    : style.label}
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
              <option value="short">{lengthLabels.short}</option>
              <option value="medium">{lengthLabels.medium}</option>
              <option value="long">{lengthLabels.long}</option>
              <option value="custom">{lengthLabels.custom}</option>
            </select>
          </label>

          {form.length === "custom" ? (
            <label className="form-field field-wide compact-number-field">
              <span>
                {form.contentType === "thread"
                  ? copy.customLengthPerPostLabel
                  : copy.customLengthLabel}
              </span>
              <input
                type="number"
                aria-label={
                  form.contentType === "thread"
                    ? copy.customLengthPerPostLabel
                    : copy.customLengthLabel
                }
                min={getCustomLengthBounds(form.contentType).min}
                max={getCustomLengthBounds(form.contentType).max}
                value={form.customLength}
                onChange={(event) => updateForm("customLength", Number(event.target.value))}
                disabled={isGenerating}
              />
              <small>
                {copy.customLengthRangeHint
                  .replace("{min}", getCustomLengthBounds(form.contentType).min.toLocaleString())
                  .replace("{max}", getCustomLengthBounds(form.contentType).max.toLocaleString())}
              </small>
            </label>
          ) : null}
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

        {hasTokenBudgetWarning ? (
          <div className="feedback" data-kind="warning" role="status">
            <WarningCircle size={18} weight="fill" aria-hidden="true" />
            <span>
              {copy.tokenBudgetWarning
                .replace("{current}", profile?.maxOutputTokens.toLocaleString() ?? "")
                .replace("{recommended}", recommendedMaxOutputTokens.toLocaleString())}
            </span>
          </div>
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

      {result ? (
        <GenerationResults
          copy={copy}
          result={result}
          input={lastGenerationInput}
          onChange={setResult}
          onSaveRaw={historyEnabled && result.format === "raw" ? saveRawResult : undefined}
          rawHistorySaved={rawHistorySaved}
          settingsSnapshot={snapshot}
          onOpenSettings={onOpenSettings}
          onImageGenerated={saveImageMetadata}
          onCopied={syncHistoryOnCopy}
          onRegenerateAll={regenerateAll}
          onRegenerateItem={regenerateItem}
          regeneratingTarget={regeneratingTarget}
          isRegenerating={isGenerating}
        />
      ) : null}
    </div>
  );
}
