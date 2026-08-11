import {
  Archive,
  ArrowsClockwise,
  Check,
  Copy,
  ImageSquare,
  WarningCircle,
} from "@phosphor-icons/react";
import { useState } from "react";
import type { RegenerationInput } from "../core/generation/types";
import type { ImageHistoryMetadata } from "../core/image/types";
import type { SettingsSnapshot } from "../core/settings/types";
import type { GenerationResult } from "../core/generation/types";
import type { Messages } from "../i18n";
import { ImageGenerator } from "./ImageGenerator";

interface GenerationResultsProps {
  copy: Messages;
  result: GenerationResult;
  onChange: (result: GenerationResult) => void;
  onSaveRaw?: () => void;
  rawHistorySaved?: boolean;
  settingsSnapshot?: SettingsSnapshot;
  onOpenSettings?: () => void;
  onImageGenerated?: (metadata: ImageHistoryMetadata) => void;
  onCopied?: (result: GenerationResult) => Promise<void> | void;
  onRegenerateItem?: (target: RegenerationInput["target"]) => void;
  onRegenerateAll?: () => void;
  regeneratingTarget?: string;
  isRegenerating?: boolean;
}

type ImageSource = { kind: "candidate" | "thread" | "raw"; index: number };

const countCharacters = (value: string): number => Array.from(value).length;

export function GenerationResults({
  copy,
  result,
  onChange,
  onSaveRaw,
  rawHistorySaved = false,
  settingsSnapshot,
  onOpenSettings = () => undefined,
  onImageGenerated,
  onCopied,
  onRegenerateItem,
  onRegenerateAll,
  regeneratingTarget,
  isRegenerating = false,
}: GenerationResultsProps) {
  const [copyStatus, setCopyStatus] = useState<string>();
  const [imageSource, setImageSource] = useState<ImageSource>();

  const selectedImageText = imageSource
    ? imageSource.kind === "candidate" && result.format === "candidates"
      ? result.candidates[imageSource.index]?.text
      : imageSource.kind === "thread" && result.format === "thread"
        ? result.threads[0]?.posts[imageSource.index]?.text
        : imageSource.kind === "raw" && result.format === "raw"
          ? result.rawText
          : undefined
    : undefined;

  const copyText = async (text: string, status: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(status);
      void Promise.resolve(onCopied?.(result));
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
        <div className="result-card-actions">
          {onRegenerateAll ? (
            <button
              type="button"
              className="copy-button"
              onClick={onRegenerateAll}
              disabled={isRegenerating}
            >
              <ArrowsClockwise size={16} weight="bold" aria-hidden="true" />
              {isRegenerating && !regeneratingTarget ? copy.regeneratingItem : copy.regenerateAll}
            </button>
          ) : null}
          <span className="provider-chip">
            {result.provider} · {result.model}
          </span>
        </div>
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
                <div className="result-card-actions">
                  {onRegenerateItem ? (
                    <button
                      type="button"
                      className="copy-button"
                      onClick={() =>
                        onRegenerateItem({
                          kind: "candidate",
                          index,
                          currentTexts: result.candidates.map((item) => item.text),
                        })
                      }
                      disabled={isRegenerating}
                    >
                      <ArrowsClockwise size={16} weight="bold" aria-hidden="true" />
                      {regeneratingTarget === `candidate:${index}`
                        ? copy.regeneratingItem
                        : copy.regenerateItem}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="copy-button"
                    onClick={() => setImageSource({ kind: "candidate", index })}
                  >
                    <ImageSquare size={16} weight="bold" aria-hidden="true" />
                    {copy.generateImage}
                  </button>
                  <button
                    type="button"
                    className="copy-button"
                    onClick={() => copyText(candidate.text, copy.copiedCandidate)}
                  >
                    <Copy size={16} weight="bold" aria-hidden="true" />
                    {copy.copyText}
                  </button>
                </div>
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
                <div className="result-card-actions">
                  {onRegenerateItem ? (
                    <button
                      type="button"
                      className="copy-button"
                      onClick={() =>
                        onRegenerateItem({
                          kind: "thread-post",
                          index,
                          currentTexts: result.threads[0].posts.map((item) => item.text),
                        })
                      }
                      disabled={isRegenerating}
                    >
                      <ArrowsClockwise size={16} weight="bold" aria-hidden="true" />
                      {regeneratingTarget === `thread-post:${index}`
                        ? copy.regeneratingItem
                        : copy.regenerateItem}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="copy-button"
                    onClick={() => setImageSource({ kind: "thread", index })}
                  >
                    <ImageSquare size={16} weight="bold" aria-hidden="true" />
                    {copy.generateImage}
                  </button>
                  <button
                    type="button"
                    className="copy-button"
                    onClick={() => copyText(post.text, copy.copiedCandidate)}
                  >
                    <Copy size={16} weight="bold" aria-hidden="true" />
                    {copy.copyText}
                  </button>
                </div>
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
            <button
              type="button"
              className="copy-button"
              onClick={() => setImageSource({ kind: "raw", index: 0 })}
            >
              <ImageSquare size={16} weight="bold" aria-hidden="true" />
              {copy.generateImage}
            </button>
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

      {selectedImageText ? (
        <ImageGenerator
          copy={copy}
          sourceText={selectedImageText}
          snapshot={settingsSnapshot}
          onOpenSettings={onOpenSettings}
          onClose={() => setImageSource(undefined)}
          onGenerated={onImageGenerated}
        />
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
