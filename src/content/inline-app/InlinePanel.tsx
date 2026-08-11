import { Copy, GearSix, Sparkle, StopCircle, WarningCircle, X } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createRequestId, type InlineBootstrap } from "../../core/contracts/messages";
import type { ContentType, GenerationInput, GenerationResult } from "../../core/generation/types";
import { getMessages } from "../../i18n";
import { sendInlineRequest } from "../inline-client";
import type { XPostContext } from "../x-adapter/types";

interface InlinePanelProps {
  context?: XPostContext;
  extractionFailed: boolean;
  onClose: () => void;
}

type InlineAction = "rewrite" | "reply" | "quote";
type InlineLanguage = "follow-source" | "en" | "zh-CN" | "zh-TW";

const panelStyles = `
  :host { all: initial; color-scheme: light dark; }
  * { box-sizing: border-box; }
  button, select, textarea, input { font: inherit; }
  .panel { margin: 10px 0 4px; padding: 16px; border: 1px solid #d9e0e9; border-radius: 16px; background: #fff; color: #172033; box-shadow: 0 12px 36px rgba(22,34,55,.12); font: 13px/1.45 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
  .heading, .actions, .result-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  h2 { margin: 0; font-size: 16px; letter-spacing: -.02em; }
  .icon { display: grid; width: 32px; height: 32px; place-items: center; border: 0; border-radius: 9px; background: transparent; color: #667085; cursor: pointer; }
  .icon:hover { background: #eef3ff; color: #315fca; }
  .source { margin: 12px 0 0; padding: 10px 11px; border-radius: 11px; background: #f5f7fa; }
  .source strong, label > span, fieldset legend { display: block; margin-bottom: 5px; font-size: 10px; font-weight: 700; }
  .source p { display: -webkit-box; margin: 0; overflow: hidden; color: #596579; font-size: 11px; white-space: pre-wrap; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
  .context { display: flex; align-items: flex-start; gap: 8px; margin-top: 10px; color: #354052; font-size: 10.5px; cursor: pointer; }
  .context input { margin-top: 2px; accent-color: #315fca; }
  .context span { display: grid; gap: 2px; }
  .context small { color: #667085; font-size: 9px; }
  fieldset { display: flex; gap: 6px; margin: 12px 0 0; padding: 0; border: 0; }
  .choice { flex: 1; min-height: 34px; border: 1px solid #d9e0e9; border-radius: 9px; background: #fff; color: #596579; cursor: pointer; font-size: 10px; font-weight: 680; }
  .choice[data-active="true"] { border-color: #315fca; background: #eaf0ff; color: #315fca; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; margin-top: 12px; }
  label select { width: 100%; min-height: 36px; padding: 7px 9px; border: 1px solid #d9e0e9; border-radius: 9px; background: #fff; color: #172033; font-size: 10.5px; }
  .actions { justify-content: flex-end; margin-top: 13px; }
  .primary, .secondary { display: inline-flex; min-height: 36px; align-items: center; justify-content: center; gap: 6px; padding: 8px 11px; border-radius: 9px; cursor: pointer; font-size: 10.5px; font-weight: 700; }
  .primary { border: 1px solid #315fca; background: #315fca; color: #fff; }
  .secondary { border: 1px solid #d9e0e9; background: #fff; color: #354052; }
  .primary:disabled { cursor: wait; opacity: .62; }
  .notice, .error { display: flex; align-items: flex-start; gap: 7px; margin-top: 12px; padding: 10px; border-radius: 10px; font-size: 10px; }
  .notice { background: #eef3ff; color: #315fca; }
  .error { background: #fff0ee; color: #a23327; }
  .notice div { display: grid; gap: 2px; }
  .notice small { color: #667085; }
  .results { display: grid; gap: 9px; margin-top: 13px; }
  .result { display: grid; gap: 7px; padding: 10px; border: 1px solid #d9e0e9; border-radius: 11px; }
  .result strong { font-size: 10px; }
  .result textarea { width: 100%; min-height: 84px; resize: vertical; padding: 9px; border: 1px solid #d9e0e9; border-radius: 9px; background: #f9fafb; color: #172033; font-size: 11px; line-height: 1.5; }
  .result .secondary { justify-self: end; min-height: 31px; padding: 6px 9px; }
  .status { color: #315fca; font-size: 9.5px; text-align: right; }
  button:focus-visible, select:focus-visible, textarea:focus-visible, input:focus-visible { outline: 2px solid #315fca; outline-offset: 2px; }
  @media (prefers-color-scheme: dark) {
    .panel { border-color: #354052; background: #161b24; color: #eef2f8; }
    .source, .result textarea { background: #202631; color: #eef2f8; }
    .source p, .context small { color: #a6b0bf; }
    .context { color: #dce3ed; }
    .choice, label select, .secondary { border-color: #3b4657; background: #1a202b; color: #dce3ed; }
    .choice[data-active="true"], .notice { background: #202d48; color: #8aafff; }
    .result { border-color: #354052; }
    .error { background: #3c2424; color: #ffb5aa; }
  }
`;

const getErrorCopy = (error: unknown, copy: ReturnType<typeof getMessages>): string =>
  error instanceof Error && error.name === "HOST_PERMISSION_REQUIRED"
    ? copy.inlinePermissionError
    : copy.inlineRuntimeError;

export function InlinePanel({ context, extractionFailed, onClose }: InlinePanelProps) {
  const [bootstrap, setBootstrap] = useState<InlineBootstrap>();
  const [action, setAction] = useState<InlineAction>("rewrite");
  const [language, setLanguage] = useState<InlineLanguage>("follow-source");
  const [styleId, setStyleId] = useState("professional");
  const [includeContext, setIncludeContext] = useState(false);
  const [result, setResult] = useState<GenerationResult>();
  const [error, setError] = useState<string>();
  const [copyStatus, setCopyStatus] = useState<string>();
  const [isGenerating, setIsGenerating] = useState(false);
  const activeRequestId = useRef<string | undefined>(undefined);
  const copy = getMessages(bootstrap?.locale ?? "en");
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
          setStyleId(value.styles[0]?.id ?? "professional");
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
      length: "medium",
      candidateCount: 3,
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
      const generated = await sendInlineRequest(
        { type: "inline.generate", input: buildInput() },
        { requestId },
      );
      if (activeRequestId.current === requestId) {
        setResult(generated);
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
      setResult({
        ...result,
        candidates: result.candidates.map((item, itemIndex) =>
          itemIndex === index ? { ...item, text } : item,
        ),
      });
    } else if (result?.format === "raw") {
      setResult({ ...result, rawText: text });
    }
  };

  return (
    <>
      <style>{panelStyles}</style>
      <section className="panel" aria-label={copy.inlineTitle}>
        <div className="heading">
          <h2>{copy.inlineTitle}</h2>
          <button type="button" className="icon" aria-label={copy.inlineClose} onClick={onClose}>
            <X size={17} weight="bold" aria-hidden="true" />
          </button>
        </div>

        {extractionFailed || !context ? (
          <div className="error" role="alert">
            <WarningCircle size={17} weight="fill" aria-hidden="true" />
            {copy.inlineExtractionError}
          </div>
        ) : (
          <>
            <div className="source">
              <strong>{copy.inlineSourceLabel}</strong>
              <p>{context.text}</p>
            </div>
            {context.quotedPost || context.parentPost ? (
              <>
                <div className="source">
                  <strong>{copy.inlineRelatedContextLabel}</strong>
                  <p>{(context.quotedPost ?? context.parentPost)?.text}</p>
                </div>
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
              </>
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
                  <option value="en">English</option>
                  <option value="zh-CN">简体中文</option>
                  <option value="zh-TW">繁體中文</option>
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
          </>
        )}

        {error ? (
          <div className="error" role="alert">
            <WarningCircle size={17} weight="fill" aria-hidden="true" />
            {error}
          </div>
        ) : null}

        <div className="actions">
          <button type="button" className="secondary" onClick={openSidePanel}>
            {copy.inlineOpenSidePanel}
          </button>
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

        {resultTexts.length > 0 ? (
          <div className="results">
            {resultTexts.map((item, index) => (
              <article className="result" key={item.id}>
                <div className="result-heading">
                  <strong>{copy.inlineResultLabel.replace("{number}", String(index + 1))}</strong>
                </div>
                <textarea
                  aria-label={copy.inlineResultLabel.replace("{number}", String(index + 1))}
                  value={item.text}
                  onChange={(event) => updateResultText(index, event.target.value)}
                  readOnly={result?.format === "thread"}
                />
                <button type="button" className="secondary" onClick={() => copyText(item.text)}>
                  <Copy size={14} aria-hidden="true" />
                  {copy.copyText}
                </button>
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
