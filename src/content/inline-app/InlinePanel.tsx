import {
  Copy,
  GearSix,
  SidebarSimple,
  Sparkle,
  StopCircle,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BrandMark } from "../../components/BrandMark";
import { createRequestId, type InlineBootstrap } from "../../core/contracts/messages";
import type { ContentType, GenerationInput, GenerationResult } from "../../core/generation/types";
import { refreshLengthWarnings } from "../../core/generation/result-warnings";
import { OUTPUT_LANGUAGE_OPTIONS, type OutputLanguageId } from "../../core/generation/languages";
import { getInlineMessages, type InlineMessages } from "../../i18n/inline";
import { sendInlineRequest } from "../inline-client";
import type { XPostContext } from "../x-adapter/types";

interface InlinePanelProps {
  context?: XPostContext;
  extractionFailed: boolean;
  initialAction?: InlineAction;
  onClose: () => void;
}

type InlineAction = "rewrite" | "reply" | "quote";
type InlineLanguage = "follow-source" | OutputLanguageId;

const panelStyles = `
  :host { all: initial; color-scheme: light dark; }
  * { box-sizing: border-box; }
  button, select, textarea, input { font: inherit; }
  .panel { margin: 12px 0 6px; overflow: hidden; border: 1px solid #deddd6; border-radius: 14px; background: #fdfcf9; color: #171816; box-shadow: 0 12px 32px rgba(35,34,29,.09); font: 13px/1.45 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
  .heading, .heading-actions, .actions, .result-heading, .brand-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .heading { padding: 14px 16px; border-bottom: 1px solid #e5e3dc; }
  .brand-heading { justify-content: flex-start; min-width: 0; }
  .brand-spark { display: grid; width: 30px; height: 30px; flex: 0 0 auto; place-items: center; color: #ee763b; }
  .brand-copy { display: grid; min-width: 0; gap: 1px; }
  .brand-copy strong { font-size: 15px; font-weight: 780; letter-spacing: -.025em; }
  .brand-copy span { color: #6d6c62; font-size: 10.5px; }
  .heading-actions { justify-content: flex-end; gap: 2px; }
  .icon { display: grid; width: 38px; height: 38px; place-items: center; border: 0; border-radius: 8px; background: transparent; color: #77766e; cursor: pointer; }
  .icon:hover { background: #edf2ff; color: #315fd0; }
  .workspace { padding: 14px 16px 2px; }
  label > span, fieldset legend { display: block; margin-bottom: 6px; font-size: 10.5px; font-weight: 700; }
  .context { display: flex; align-items: flex-start; gap: 8px; margin: 0 0 12px; padding: 9px 10px; border-radius: 9px; background: #f5f6f8; color: #41413c; font-size: 10.5px; cursor: pointer; }
  .context input { margin-top: 2px; accent-color: #315fca; }
  .context span { display: grid; gap: 2px; }
  .context small { color: #77766e; font-size: 9.5px; }
  fieldset { display: flex; gap: 0; margin: 0; padding: 0; overflow: hidden; border: 1px solid #cbc9c0; border-radius: 9px; }
  fieldset legend { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; }
  .choice { flex: 1; min-height: 42px; border: 0; border-right: 1px solid #deddd6; background: #fffdfa; color: #5f5e57; cursor: pointer; font-size: 11px; font-weight: 680; }
  .choice:last-child { border-right: 0; }
  .choice[data-active="true"] { background: #edf2ff; color: #315fd0; box-shadow: inset 0 0 0 1px #315fd0; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 13px; }
  label select { width: 100%; min-height: 42px; padding: 8px 10px; border: 1px solid #cbc9c0; border-radius: 9px; background: #fffdfa; color: #171816; font-size: 11px; }
  .actions { justify-content: flex-end; margin-top: 13px; padding: 0 16px 14px; }
  .primary, .secondary { display: inline-flex; min-height: 42px; align-items: center; justify-content: center; gap: 6px; padding: 8px 12px; border-radius: 9px; cursor: pointer; font-size: 11px; font-weight: 700; }
  .primary { min-width: 142px; border: 1px solid #315fd0; background: #315fd0; color: #fff; }
  .secondary { border: 0; background: transparent; color: #315fd0; }
  .primary:disabled { cursor: wait; opacity: .62; }
  .notice, .error { display: flex; align-items: flex-start; gap: 7px; margin: 12px 16px 0; padding: 10px; border-radius: 9px; font-size: 10px; }
  .notice { background: #eef3ff; color: #315fca; }
  .workspace .notice { margin-inline: 0; }
  .error { background: #fff0ee; color: #a23327; }
  .notice div { display: grid; gap: 2px; }
  .notice small { color: #77766e; }
  .results { display: grid; gap: 0; margin-top: 14px; padding: 8px 16px 6px; border-top: 1px solid #e5e3dc; }
  .result { display: grid; gap: 8px; padding: 13px 0 15px; border-bottom: 1px solid #e5e3dc; }
  .result:last-child { border-bottom: 0; }
  .result-heading { min-height: 28px; padding-inline: 2px; }
  .result strong { font-size: 11px; letter-spacing: -.01em; }
  .result textarea { width: 100%; min-height: 78px; field-sizing: content; resize: vertical; padding: 11px 12px; border: 1px solid #deddd6; border-radius: 9px; outline: 0; background: #fffdfa; color: #171816; font-size: 12px; line-height: 1.55; box-shadow: inset 0 1px 2px rgba(35,34,29,.025); }
  .result textarea:hover { border-color: #cbc9c0; }
  .result textarea:focus-visible { border-color: #315fca; outline: 2px solid rgba(49,95,202,.16); outline-offset: 1px; }
  .result-copy { min-height: 28px; padding: 3px 5px; border-radius: 7px; }
  .result-copy:hover { background: #edf2ff; }
  .status { padding: 0 16px 10px; color: #315fd0; font-size: 9.5px; text-align: right; }
  button:focus-visible, select:focus-visible, textarea:focus-visible, input:focus-visible { outline: 2px solid #315fca; outline-offset: 2px; }
  @media (prefers-color-scheme: dark) {
    .panel { border-color: #3b3b37; background: #191a18; color: #f2f0e9; }
    .heading, .results, .result { border-color: #353631; }
    .result textarea, .choice, label select { border-color: #454640; background: #22231f; color: #f2f0e9; }
    .context small, .brand-copy span { color: #aaa99f; }
    .context { background: #22231f; color: #dce3ed; }
    .choice[data-active="true"], .notice { background: #202d48; color: #8aafff; }
    .secondary { color: #8aafff; }
    .result-copy:hover { background: #202d48; }
    .error { background: #3c2424; color: #ffb5aa; }
  }
`;

const getErrorCopy = (error: unknown, copy: InlineMessages): string =>
  error instanceof Error && error.name === "HOST_PERMISSION_REQUIRED"
    ? copy.inlinePermissionError
    : copy.inlineRuntimeError;

export function InlinePanel({
  context,
  extractionFailed,
  initialAction = "rewrite",
  onClose,
}: InlinePanelProps) {
  const [bootstrap, setBootstrap] = useState<InlineBootstrap>();
  const [action, setAction] = useState<InlineAction>(initialAction);
  const [language, setLanguage] = useState<InlineLanguage>("follow-source");
  const [styleId, setStyleId] = useState("professional");
  const [includeContext, setIncludeContext] = useState(false);
  const [result, setResult] = useState<GenerationResult>();
  const [error, setError] = useState<string>();
  const [copyStatus, setCopyStatus] = useState<string>();
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastGenerationInput, setLastGenerationInput] = useState<GenerationInput>();
  const [lastHistoryId, setLastHistoryId] = useState<string>();
  const activeRequestId = useRef<string | undefined>(undefined);
  const copy = getInlineMessages(bootstrap?.locale ?? "en");
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: Bootstrap is requested once per panel opening.
  useEffect(() => {
    let active = true;
    void sendInlineRequest({ type: "inline.bootstrap" })
      .then((value) => {
        if (active) {
          setBootstrap(value);
          setStyleId(value.defaultStyleId);
          setLanguage(value.preferences.language);
        }
      })
      .catch(() => {
        if (active) {
          setError(copy.inlineRuntimeError);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(
    () => () => {
      const targetRequestId = activeRequestId.current;
      if (targetRequestId) {
        void sendInlineRequest({ type: "inline.cancel", targetRequestId }).catch(() => undefined);
      }
    },
    [],
  );

  const sourceText = useMemo(() => {
    if (!context) {
      return "";
    }
    const related = context.quotedPost ?? context.parentPost;
    return includeContext && related
      ? `${context.text}\n\n[User explicitly included related X context]\n${related.text}`
      : context.text;
  }, [context, includeContext]);

  const buildInput = (): GenerationInput => {
    const contentTypes: Record<InlineAction, ContentType> = {
      rewrite: "post",
      reply: "reply",
      quote: "quote",
    };
    return {
      source: { kind: "draft", text: sourceText },
      contentType: contentTypes[action],
      language:
        language === "follow-source"
          ? { mode: "follow-source" }
          : { mode: "fixed", value: language },
      styleId,
      length: bootstrap?.preferences.length ?? "medium",
      intent:
        action === "reply"
          ? bootstrap?.preferences.replyIntent
          : action === "quote"
            ? bootstrap?.preferences.quoteIntent
            : undefined,
      candidateCount: bootstrap?.preferences.candidateCount ?? 2,
    };
  };

  const generate = async () => {
    if (!context || !bootstrap?.configured) {
      return;
    }
    const requestId = createRequestId();
    activeRequestId.current = requestId;
    setIsGenerating(true);
    setError(undefined);
    try {
      const input = buildInput();
      const generated = await sendInlineRequest({ type: "inline.generate", input }, { requestId });
      if (activeRequestId.current === requestId) {
        setResult(generated.result);
        setLastHistoryId(generated.historyId);
        setLastGenerationInput(input);
      }
    } catch (generationError) {
      if (activeRequestId.current === requestId) {
        setError(getErrorCopy(generationError, copy));
      }
    } finally {
      if (activeRequestId.current === requestId) {
        activeRequestId.current = undefined;
        setIsGenerating(false);
      }
    }
  };

  const cancel = () => {
    const targetRequestId = activeRequestId.current;
    if (!targetRequestId) {
      return;
    }
    activeRequestId.current = undefined;
    setIsGenerating(false);
    void sendInlineRequest({ type: "inline.cancel", targetRequestId }).catch(() => undefined);
  };

  const openSidePanel = async () => {
    try {
      await sendInlineRequest({
        type: "inline.openSidePanel",
        input: context ? buildInput() : undefined,
      });
    } catch {
      setError(copy.inlineOpenError);
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(copy.inlineCopied);
      if (lastHistoryId && result) {
        try {
          await sendInlineRequest({
            type: "inline.history.sync",
            historyId: lastHistoryId,
            result,
          });
        } catch {
          setCopyStatus(`${copy.inlineCopied} ${copy.inlineHistorySyncWarning}`);
        }
      }
    } catch {
      setCopyStatus(copy.copyFailed);
    }
  };

  const resultTexts =
    result?.format === "candidates"
      ? result.candidates
      : result?.format === "thread"
        ? (result.threads[0]?.posts ?? [])
        : result?.format === "raw"
          ? [{ id: "raw", text: result.rawText }]
          : [];

  const updateResultText = (index: number, text: string) => {
    if (result?.format === "candidates") {
      const nextResult: GenerationResult = {
        ...result,
        candidates: result.candidates.map((item, itemIndex) =>
          itemIndex === index ? { ...item, text } : item,
        ),
      };
      setResult(
        lastGenerationInput ? refreshLengthWarnings(nextResult, lastGenerationInput) : nextResult,
      );
    } else if (result?.format === "raw") {
      const nextResult: GenerationResult = { ...result, rawText: text };
      setResult(
        lastGenerationInput ? refreshLengthWarnings(nextResult, lastGenerationInput) : nextResult,
      );
    }
  };

  return (
    <>
      <style>{panelStyles}</style>
      <section className="panel" aria-label={copy.inlineTitle}>
        <div className="heading">
          <div className="brand-heading">
            <span className="brand-spark" aria-hidden="true">
              <BrandMark size={26} />
            </span>
            <div className="brand-copy">
              <strong>{copy.appName}</strong>
              <span>{copy.inlineTitle}</span>
            </div>
          </div>
          <div className="heading-actions">
            <button
              type="button"
              className="icon"
              title={copy.inlineOpenSidePanel}
              aria-label={copy.inlineOpenSidePanel}
              onClick={openSidePanel}
            >
              <SidebarSimple size={18} weight="bold" aria-hidden="true" />
            </button>
            <button type="button" className="icon" aria-label={copy.inlineClose} onClick={onClose}>
              <X size={17} weight="bold" aria-hidden="true" />
            </button>
          </div>
        </div>

        {extractionFailed || !context ? (
          <div className="error" role="alert">
            <WarningCircle size={17} weight="fill" aria-hidden="true" />
            {copy.inlineExtractionError}
          </div>
        ) : (
          <div className="workspace">
            {context.quotedPost || context.parentPost ? (
              <label className="context">
                <input
                  type="checkbox"
                  checked={includeContext}
                  onChange={(event) => setIncludeContext(event.target.checked)}
                />
                <span>
                  {copy.inlineIncludeContext}
                  <small>{copy.inlineContextDisclosure}</small>
                </span>
              </label>
            ) : null}

            <fieldset>
              <legend>{copy.inlineActionLabel}</legend>
              {(["rewrite", "reply", "quote"] as const).map((value) => (
                <button
                  type="button"
                  className="choice"
                  data-active={action === value}
                  aria-pressed={action === value}
                  onClick={() => setAction(value)}
                  key={value}
                >
                  {value === "rewrite"
                    ? copy.inlineActionRewrite
                    : value === "reply"
                      ? copy.inlineActionReply
                      : copy.inlineActionQuote}
                </button>
              ))}
            </fieldset>

            <div className="grid">
              <label>
                <span>{copy.outputLanguageLabel}</span>
                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value as InlineLanguage)}
                >
                  <option value="follow-source">{copy.languageFollowSource}</option>
                  {OUTPUT_LANGUAGE_OPTIONS.map((option) => (
                    <option value={option.id} key={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>{copy.styleLabel}</span>
                <select value={styleId} onChange={(event) => setStyleId(event.target.value)}>
                  {bootstrap?.styles.map((style) => (
                    <option value={style.id} key={style.id}>
                      {style.isBuiltInDefault
                        ? (styleLabels[style.id] ?? style.label)
                        : style.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {!bootstrap?.configured ? (
              <div className="notice">
                <GearSix size={17} aria-hidden="true" />
                <div>
                  <strong>{copy.inlineSetupTitle}</strong>
                  <small>{copy.inlineSetupBody}</small>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {error ? (
          <div className="error" role="alert">
            <WarningCircle size={17} weight="fill" aria-hidden="true" />
            {error}
          </div>
        ) : null}

        {isGenerating || (!extractionFailed && bootstrap?.configured) ? (
          <div className="actions">
            {isGenerating ? (
              <button type="button" className="secondary" onClick={cancel}>
                <StopCircle size={15} aria-hidden="true" />
                {copy.inlineCancel}
              </button>
            ) : null}
            {!extractionFailed && bootstrap?.configured ? (
              <button type="button" className="primary" disabled={isGenerating} onClick={generate}>
                <Sparkle size={15} weight="fill" aria-hidden="true" />
                {isGenerating ? copy.inlineGenerating : copy.inlineGenerate}
              </button>
            ) : null}
          </div>
        ) : null}

        {resultTexts.length > 0 ? (
          <div className="results">
            {resultTexts.map((item, index) => (
              <article className="result" key={item.id}>
                <div className="result-heading">
                  <strong>{copy.inlineResultLabel.replace("{number}", String(index + 1))}</strong>
                  <button
                    type="button"
                    className="secondary result-copy"
                    onClick={() => copyText(item.text)}
                  >
                    <Copy size={14} aria-hidden="true" />
                    {copy.copyText}
                  </button>
                </div>
                <textarea
                  aria-label={copy.inlineResultLabel.replace("{number}", String(index + 1))}
                  value={item.text}
                  onChange={(event) => updateResultText(index, event.target.value)}
                  readOnly={result?.format === "thread"}
                />
              </article>
            ))}
          </div>
        ) : null}
        {copyStatus ? (
          <div className="status" role="status">
            {copyStatus}
          </div>
        ) : null}
      </section>
    </>
  );
}
