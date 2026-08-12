import {
  ArrowCounterClockwise,
  Check,
  Copy,
  MagnifyingGlass,
  PencilSimple,
  Trash,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import type { GenerationInput, GenerationResult } from "../core/generation/types";
import { getHistoryResultText, type HistoryRecordV1 } from "../core/history/types";
import type { Locale, Messages } from "../i18n";
import { loadHistoryEnabled, saveHistoryEnabled } from "../storage/history-preferences";
import {
  clearHistoryRecords,
  deleteHistoryRecord,
  listHistoryRecords,
  updateHistoryResult,
} from "../storage/history-repository";
import { GenerationResults } from "./GenerationResults";

interface HistoryPanelProps {
  copy: Messages;
  locale: Locale;
  revision: number;
  onHistoryChanged: () => void;
  onReuseInput: (input: GenerationInput) => void;
}

interface HistoryEditor {
  id: string;
  result: GenerationResult;
  input: GenerationInput;
}

const getContentTypeLabel = (record: HistoryRecordV1, copy: Messages): string => {
  const labels: Record<GenerationInput["contentType"], string> = {
    post: copy.contentTypePost,
    reply: copy.contentTypeReply,
    quote: copy.contentTypeQuote,
    thread: copy.contentTypeThread,
    "long-post": copy.contentTypeLongPost,
  };
  return labels[record.input.contentType];
};

export function HistoryPanel({
  copy,
  locale,
  revision,
  onHistoryChanged,
  onReuseInput,
}: HistoryPanelProps) {
  const [records, setRecords] = useState<HistoryRecordV1[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<HistoryEditor>();
  const [deleteId, setDeleteId] = useState<string>();
  const [confirmClear, setConfirmClear] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string }>();

  // biome-ignore lint/correctness/useExhaustiveDependencies: Revision is an explicit repository reload signal.
  useEffect(() => {
    let active = true;
    void Promise.all([listHistoryRecords(), loadHistoryEnabled()])
      .then(([storedRecords, storedEnabled]) => {
        if (active) {
          setRecords(storedRecords);
          setEnabled(storedEnabled);
        }
      })
      .catch(() => {
        if (active) {
          setFeedback({ kind: "error", text: copy.historyLoadError });
        }
      });
    return () => {
      active = false;
    };
  }, [copy.historyLoadError, revision]);

  const filteredRecords = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(locale);
    if (!normalized) {
      return records;
    }
    return records.filter((record) =>
      `${record.input.source.text}\n${getHistoryResultText(record.result)}`
        .toLocaleLowerCase(locale)
        .includes(normalized),
    );
  }, [locale, query, records]);

  const toggleEnabled = async () => {
    const next = !enabled;
    setEnabled(next);
    try {
      await saveHistoryEnabled(next);
      onHistoryChanged();
      setFeedback(undefined);
    } catch {
      setEnabled(!next);
      setFeedback({ kind: "error", text: copy.historyActionError });
    }
  };

  const copyRecord = async (record: HistoryRecordV1) => {
    try {
      await navigator.clipboard.writeText(getHistoryResultText(record.result));
      setFeedback({ kind: "success", text: copy.historyCopied });
    } catch {
      setFeedback({ kind: "error", text: copy.copyFailed });
    }
  };

  const saveEditor = async () => {
    if (!editor) {
      return;
    }
    try {
      await updateHistoryResult(editor.id, editor.result);
      setEditor(undefined);
      setFeedback({ kind: "success", text: copy.historyUpdated });
      onHistoryChanged();
    } catch {
      setFeedback({ kind: "error", text: copy.historyActionError });
    }
  };

  const deleteRecord = async (id: string) => {
    try {
      await deleteHistoryRecord(id);
      setDeleteId(undefined);
      if (editor?.id === id) {
        setEditor(undefined);
      }
      setFeedback({ kind: "success", text: copy.historyDeleted });
      onHistoryChanged();
    } catch {
      setFeedback({ kind: "error", text: copy.historyActionError });
    }
  };

  const clearAll = async () => {
    try {
      await clearHistoryRecords();
      setConfirmClear(false);
      setEditor(undefined);
      setFeedback({ kind: "success", text: copy.historyCleared });
      onHistoryChanged();
    } catch {
      setFeedback({ kind: "error", text: copy.historyActionError });
    }
  };

  return (
    <div className="history-panel">
      <section className="section-heading" aria-labelledby="history-title">
        <p>{copy.historyEyebrow}</p>
        <h1 id="history-title">{copy.historyTitle}</h1>
        <span>{copy.historyBody}</span>
      </section>

      <section className="history-controls" aria-label={copy.historyEnabledLabel}>
        <label className="history-toggle">
          <input type="checkbox" checked={enabled} onChange={toggleEnabled} />
          <span>
            <strong>{copy.historyEnabledLabel}</strong>
            <small>{copy.historyEnabledBody}</small>
          </span>
        </label>
        {!enabled ? <p className="history-disabled-note">{copy.historyDisabledNote}</p> : null}

        <label className="history-search">
          <span>{copy.historySearchLabel}</span>
          <span className="history-search-input">
            <MagnifyingGlass size={16} aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.historySearchPlaceholder}
            />
          </span>
        </label>
      </section>

      {feedback ? (
        <div className="feedback" data-kind={feedback.kind} role="status">
          {feedback.kind === "success" ? (
            <Check size={18} weight="bold" aria-hidden="true" />
          ) : (
            <WarningCircle size={18} weight="fill" aria-hidden="true" />
          )}
          <span>{feedback.text}</span>
        </div>
      ) : null}

      {editor ? (
        <section className="history-editor" aria-label={copy.historyOpen}>
          <div className="history-editor-heading">
            <strong>{copy.historyOpen}</strong>
            <button
              type="button"
              className="icon-button"
              aria-label={copy.historyCloseEditor}
              onClick={() => setEditor(undefined)}
            >
              <X size={17} weight="bold" aria-hidden="true" />
            </button>
          </div>
          <GenerationResults
            copy={copy}
            result={editor.result}
            input={editor.input}
            onChange={(result) => setEditor({ ...editor, result })}
          />
          <div className="history-editor-actions">
            <button type="button" className="primary-button" onClick={saveEditor}>
              {copy.historySaveChanges}
            </button>
          </div>
        </section>
      ) : null}

      {records.length === 0 ? (
        <section className="history-empty">
          <strong>{copy.historyEmptyTitle}</strong>
          <p>{copy.historyEmptyBody}</p>
        </section>
      ) : filteredRecords.length === 0 ? (
        <section className="history-empty">
          <p>{copy.historyNoResults}</p>
        </section>
      ) : (
        <div className="history-list">
          {filteredRecords.map((record) => (
            <article className="history-card" key={record.id}>
              <div className="history-card-heading">
                <div>
                  <strong>{getContentTypeLabel(record, copy)}</strong>
                  <span>
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(record.updatedAt))}
                  </span>
                </div>
                <span className="provider-chip">
                  {record.result.provider} · {record.result.model}
                </span>
              </div>
              <div className="history-preview">
                <span>{copy.historySourceLabel}</span>
                <p>{record.input.source.text}</p>
              </div>
              <div className="history-preview">
                <span>{copy.historyResultLabel}</span>
                <p>{getHistoryResultText(record.result)}</p>
              </div>
              <div className="history-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    setEditor({
                      id: record.id,
                      result: structuredClone(record.result),
                      input: structuredClone(record.input),
                    })
                  }
                >
                  <PencilSimple size={15} aria-hidden="true" />
                  {copy.historyOpen}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => copyRecord(record)}
                >
                  <Copy size={15} aria-hidden="true" />
                  {copy.copyText}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => onReuseInput(structuredClone(record.input))}
                >
                  <ArrowCounterClockwise size={15} aria-hidden="true" />
                  {copy.historyReuse}
                </button>
                {deleteId === record.id ? (
                  <span className="inline-confirm">
                    <small>{copy.historyDeleteConfirm}</small>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => deleteRecord(record.id)}
                    >
                      {copy.historyDelete}
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={copy.cancelPromptEdit}
                      onClick={() => setDeleteId(undefined)}
                    >
                      <X size={15} aria-hidden="true" />
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="history-delete-button"
                    onClick={() => setDeleteId(record.id)}
                  >
                    <Trash size={15} aria-hidden="true" />
                    {copy.historyDelete}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {records.length > 0 ? (
        <div className="history-clear-row">
          {confirmClear ? (
            <span className="inline-confirm">
              <small>{copy.historyClearConfirm}</small>
              <button type="button" className="danger-button" onClick={clearAll}>
                {copy.historyClear}
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={copy.cancelPromptEdit}
                onClick={() => setConfirmClear(false)}
              >
                <X size={15} aria-hidden="true" />
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="history-delete-button"
              onClick={() => setConfirmClear(true)}
            >
              <Trash size={15} aria-hidden="true" />
              {copy.historyClear}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
