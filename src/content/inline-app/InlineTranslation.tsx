import { useCallback, useEffect, useRef, useState } from "react";
import type { InlineBootstrap } from "../../core/contracts/messages";
import { createRequestId } from "../../core/contracts/messages";
import { OUTPUT_LANGUAGE_OPTIONS } from "../../core/generation/languages";
import type { TranslationResult } from "../../core/translation/types";
import { getInlineMessages } from "../../i18n/inline";
import { sendInlineRequest } from "../inline-client";
import type { XPostTranslationSource } from "../x-adapter/extract-post";
import { InlineIcon } from "./InlineIcon";

interface InlineTranslationProps {
  source: XPostTranslationSource;
  bootstrap: InlineBootstrap;
  onClose: () => void;
  onTranslatedVisibilityChange: (visible: boolean) => void;
}

const styles = `
  :host { all: initial; color-scheme: light dark; }
  * { box-sizing: border-box; }
  button { font: inherit; }
  .translation { display: grid; gap: 10px; margin: 10px 0; padding: 13px 14px; border: 1px solid #deddd6; border-radius: 12px; background: #fdfcf9; color: #171816; box-shadow: 0 8px 24px rgba(35,34,29,.07); font: 13px/1.55 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
  .heading, .heading > span, .actions { display: flex; align-items: center; gap: 8px; }
  .heading { justify-content: space-between; color: #315fd0; }
  .heading strong { color: #171816; font-size: 12px; }
  .heading button, .action { display: inline-flex; min-height: 30px; align-items: center; justify-content: center; gap: 5px; padding: 4px 7px; border: 0; border-radius: 7px; background: transparent; color: #315fd0; cursor: pointer; font-size: 10.5px; font-weight: 680; }
  .heading button:hover, .action:hover { background: #edf2ff; }
  .text { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 13px; }
  .status { display: flex; align-items: center; gap: 7px; color: #315fd0; font-size: 11px; }
  .spin { animation: postmuse-translation-spin 1.1s linear infinite; }
  .meta, .warning { margin: 0; color: #77766e; font-size: 9.5px; }
  .warning { display: flex; align-items: flex-start; gap: 6px; color: #a23327; }
  .actions { justify-content: flex-end; border-top: 1px solid #e5e3dc; padding-top: 8px; }
  button:focus-visible { outline: 2px solid #315fd0; outline-offset: 2px; }
  @keyframes postmuse-translation-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
  @media (prefers-color-scheme: dark) {
    .translation { border-color: #3b3b37; background: #191a18; color: #f2f0e9; }
    .heading strong { color: #f2f0e9; }
    .actions { border-color: #353631; }
    .heading button:hover, .action:hover { background: #202d48; }
    .meta { color: #aaa99f; }
    .warning { color: #ffb5aa; }
  }
`;

export function InlineTranslation({
  source,
  bootstrap,
  onClose,
  onTranslatedVisibilityChange,
}: InlineTranslationProps) {
  const copy = getInlineMessages(bootstrap.locale);
  const targetLabel =
    OUTPUT_LANGUAGE_OPTIONS.find(
      (option) => option.id === bootstrap.translation.preferences.targetLanguage,
    )?.label ?? bootstrap.translation.preferences.targetLanguage;
  const [result, setResult] = useState<TranslationResult>();
  const [error, setError] = useState<string>();
  const [isTranslating, setIsTranslating] = useState(false);
  const [copied, setCopied] = useState(false);
  const activeRequestId = useRef<string | undefined>(undefined);

  const translate = useCallback(
    async (force = false) => {
      if (!bootstrap.translation.configured) {
        setError(copy.inlineSetupBody);
        return;
      }
      const requestId = createRequestId();
      activeRequestId.current = requestId;
      setIsTranslating(true);
      setError(undefined);
      setCopied(false);
      try {
        const translated = await sendInlineRequest(
          {
            type: "inline.translate",
            input: { text: source.text, sourceLanguageHint: source.sourceLanguageHint },
            force,
          },
          { requestId },
        );
        if (activeRequestId.current === requestId) {
          setResult(translated);
          onTranslatedVisibilityChange(translated.status === "translated");
        }
      } catch {
        if (activeRequestId.current === requestId) {
          setError(copy.inlineTranslationError);
        }
      } finally {
        if (activeRequestId.current === requestId) {
          activeRequestId.current = undefined;
          setIsTranslating(false);
        }
      }
    },
    [
      bootstrap.translation.configured,
      copy.inlineSetupBody,
      copy.inlineTranslationError,
      onTranslatedVisibilityChange,
      source.sourceLanguageHint,
      source.text,
    ],
  );

  useEffect(() => {
    void translate();
    return () => {
      const targetRequestId = activeRequestId.current;
      if (targetRequestId) {
        void sendInlineRequest({ type: "inline.cancel", targetRequestId }).catch(() => undefined);
      }
      onTranslatedVisibilityChange(false);
    };
  }, [onTranslatedVisibilityChange, translate]);

  const cancel = () => {
    const targetRequestId = activeRequestId.current;
    if (!targetRequestId) {
      return;
    }
    activeRequestId.current = undefined;
    setIsTranslating(false);
    void sendInlineRequest({ type: "inline.cancel", targetRequestId }).catch(() => undefined);
  };

  const copyTranslation = async () => {
    if (result?.status !== "translated") {
      return;
    }
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const openSettings = () => {
    void sendInlineRequest({ type: "inline.openSidePanel" }).catch(() => undefined);
  };

  return (
    <section className="translation" aria-label={copy.inlineTranslationTitle} aria-live="polite">
      <style>{styles}</style>
      <div className="heading">
        <span>
          <InlineIcon name="globe" size={18} />
          <strong>{copy.inlineTranslationTitle}</strong>
        </span>
        <button type="button" aria-label={copy.inlineTranslationHide} onClick={onClose}>
          <InlineIcon name="x" size={16} />
        </button>
      </div>

      {isTranslating ? (
        <div className="status">
          <InlineIcon name="arrows-clockwise" className="spin" size={17} />
          <span>{copy.inlineTranslating.replace("{language}", targetLabel)}</span>
        </div>
      ) : null}
      {result?.status === "same-language" ? (
        <p className="text">
          {copy.inlineTranslationSameLanguage.replace("{language}", targetLabel)}
        </p>
      ) : null}
      {result?.status === "translated" ? <p className="text">{result.text}</p> : null}
      {result?.status === "translated" && result.cached ? (
        <p className="meta">{copy.inlineTranslationCached}</p>
      ) : null}
      {result?.status === "translated" && result.outputLimitMayBeLow ? (
        <p className="warning">
          <InlineIcon name="warning" size={14} />
          <span>{copy.inlineTranslationLimitWarning}</span>
        </p>
      ) : null}
      {error ? (
        <p className="warning">
          <InlineIcon name="warning" size={14} />
          <span>{error}</span>
        </p>
      ) : null}

      <div className="actions">
        {!bootstrap.translation.configured ? (
          <button type="button" className="action" onClick={openSettings}>
            <InlineIcon name="sidebar" size={15} />
            {copy.inlineOpenSidePanel}
          </button>
        ) : null}
        {isTranslating ? (
          <button type="button" className="action" onClick={cancel}>
            <InlineIcon name="stop" size={15} />
            {copy.inlineCancel}
          </button>
        ) : null}
        {!isTranslating && (result || error) && bootstrap.translation.configured ? (
          <button type="button" className="action" onClick={() => void translate(true)}>
            <InlineIcon name="arrows-clockwise" size={15} />
            {copy.inlineTranslationRetry}
          </button>
        ) : null}
        {result?.status === "translated" ? (
          <button type="button" className="action" onClick={() => void copyTranslation()}>
            <InlineIcon name="copy" size={15} />
            {copied ? copy.inlineTranslationCopied : copy.inlineTranslationCopy}
          </button>
        ) : null}
      </div>
    </section>
  );
}
