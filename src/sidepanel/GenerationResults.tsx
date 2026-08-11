import { Archive, Check, Copy, WarningCircle } from "@phosphor-icons/react";
import { useState } from "react";
import type { GenerationResult } from "../core/generation/types";
import type { Messages } from "../i18n";

interface GenerationResultsProps {
  copy: Messages;
  result: GenerationResult;
  onChange: (result: GenerationResult) => void;
  onSaveRaw?: () => void;
  rawHistorySaved?: boolean;
}

const countCharacters = (value: string): number => Array.from(value).length;

export function GenerationResults({
  copy,
  result,
  onChange,
  onSaveRaw,
  rawHistorySaved = false,
}: GenerationResultsProps) {
  const [copyStatus, setCopyStatus] = useState<string>();

  const copyText = async (text: string, status: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(status);
    } catch {
      setCopyStatus(copy.copyFailed);
    }
  };

  const updateCandidate = (index: number, text: string) => {
    if (result.format !== "candidates") {
      return;
    }
    const candidates = result.candidates.map((candidate, candidateIndex) =>
      candidateIndex === index ? { ...candidate, text } : candidate,
    );
    onChange({ ...result, candidates });
  };

  const updateThreadPost = (postIndex: number, text: string) => {
    if (result.format !== "thread") {
      return;
    }
    const threads = result.threads.map((thread, threadIndex) =>
      threadIndex === 0
        ? {
            ...thread,
            posts: thread.posts.map((post, index) =>
              index === postIndex ? { ...post, text } : post,
            ),
          }
        : thread,
    );
    onChange({ ...result, threads });
  };

  return (
    <section className="results-section" aria-labelledby="results-title">
      <div className="results-heading">
        <div>
          <p>{copy.resultsEyebrow}</p>
          <h2 id="results-title">{copy.resultsTitle}</h2>
        </div>
        <span className="provider-chip">
          {result.provider} · {result.model}
        </span>
      </div>

      {result.warnings.length > 0 ? (
        <div className="result-warning">
          <WarningCircle size={17} weight="fill" aria-hidden="true" />
          <span>{result.format === "raw" ? copy.rawFallbackNotice : copy.partialResultNotice}</span>
        </div>
      ) : null}

      {result.contentType === "long-post" ? (
        <p className="premium-notice">{copy.longPostNotice}</p>
      ) : null}

      {result.format === "candidates" ? (
        <div className="result-list">
          {result.candidates.map((candidate, index) => {
            const characterCount = countCharacters(candidate.text);
            return (
              <article className="result-card" key={candidate.id}>
                <div className="result-card-heading">
                  <strong>{copy.candidateLabel.replace("{number}", String(index + 1))}</strong>
                  <span
                    data-over={
                      result.softCharacterLimit !== undefined &&
                      characterCount > result.softCharacterLimit
                    }
                  >
                    {result.softCharacterLimit
                      ? `${characterCount} / ${result.softCharacterLimit}`
                      : characterCount}
                  </span>
                </div>
                <textarea
                  aria-label={copy.candidateLabel.replace("{number}", String(index + 1))}
                  value={candidate.text}
                  onChange={(event) => updateCandidate(index, event.target.value)}
                  rows={result.candidates.length === 1 ? 10 : 5}
                />
                <button
                  type="button"
                  className="copy-button"
                  onClick={() => copyText(candidate.text, copy.copiedCandidate)}
                >
                  <Copy size={16} weight="bold" aria-hidden="true" />
                  {copy.copyText}
                </button>
              </article>
            );
          })}
        </div>
      ) : null}

      {result.format === "thread" ? (
        <div className="thread-result">
          {result.threads[0]?.posts.map((post, index) => {
            const characterCount = countCharacters(post.text);
            return (
              <article className="result-card thread-card" key={post.id}>
                <div className="result-card-heading">
                  <strong>
                    {copy.threadPostLabel
                      .replace("{number}", String(index + 1))
                      .replace("{total}", String(result.threads[0].posts.length))}
                  </strong>
                  <span data-over={characterCount > 280}>{characterCount} / 280</span>
                </div>
                <textarea
                  aria-label={copy.threadPostLabel
                    .replace("{number}", String(index + 1))
                    .replace("{total}", String(result.threads[0].posts.length))}
                  value={post.text}
                  onChange={(event) => updateThreadPost(index, event.target.value)}
                  rows={5}
                />
                <button
                  type="button"
                  className="copy-button"
                  onClick={() => copyText(post.text, copy.copiedCandidate)}
                >
                  <Copy size={16} weight="bold" aria-hidden="true" />
                  {copy.copyText}
                </button>
              </article>
            );
          })}
          <button
            type="button"
            className="primary-button copy-all-button"
            onClick={() =>
              copyText(
                result.threads[0]?.posts.map((post) => post.text).join("\n\n") ?? "",
                copy.copiedThread,
              )
            }
          >
            <Copy size={17} weight="bold" aria-hidden="true" />
            {copy.copyAll}
          </button>
        </div>
      ) : null}

      {result.format === "raw" ? (
        <article className="result-card raw-result">
          <textarea
            aria-label={copy.rawResultLabel}
            value={result.rawText}
            onChange={(event) => onChange({ ...result, rawText: event.target.value })}
            rows={10}
          />
          <div className="result-card-actions">
            {onSaveRaw ? (
              <button
                type="button"
                className="copy-button"
                onClick={onSaveRaw}
                disabled={rawHistorySaved}
              >
                <Archive size={16} weight="bold" aria-hidden="true" />
                {rawHistorySaved ? copy.savedToHistory : copy.saveToHistory}
              </button>
            ) : null}
            <button
              type="button"
              className="copy-button"
              onClick={() => copyText(result.rawText, copy.copiedCandidate)}
            >
              <Copy size={16} weight="bold" aria-hidden="true" />
              {copy.copyText}
            </button>
          </div>
        </article>
      ) : null}

      {copyStatus ? (
        <div className="copy-status" role="status">
          <Check size={16} weight="bold" aria-hidden="true" />
          {copyStatus}
        </div>
      ) : null}
    </section>
  );
}
