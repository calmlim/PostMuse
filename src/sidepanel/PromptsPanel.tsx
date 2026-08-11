import {
  ArrowCounterClockwise,
  ArrowDown,
  ArrowUp,
  EyeSlash,
  FloppyDisk,
  PencilSimple,
  Plus,
  Trash,
  X,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import {
  MAX_PROMPT_INSTRUCTION_LENGTH,
  MAX_PROMPT_NAME_LENGTH,
  type PromptLibraryV1,
  type ResolvedPromptLibrary,
  type ResolvedPromptTemplate,
  resolvePromptLibrary,
} from "../core/prompts/library";
import type { Messages } from "../i18n";
import {
  deleteCustomPrompt,
  hideBuiltInPrompt,
  loadResolvedPromptLibrary,
  movePrompt,
  restoreAllBuiltInPrompts,
  restoreBuiltInPrompt,
  savePromptTemplate,
} from "../storage/prompt-repository";

interface PromptsPanelProps {
  copy: Messages;
  onPromptsChanged: () => void;
}

interface PromptEditorState {
  styleId?: string;
  label: string;
  instruction: string;
}

const getBuiltInLabel = (styleId: string, copy: Messages): string => {
  const labels: Record<string, string> = {
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
  return labels[styleId] ?? styleId;
};

const getDisplayLabel = (template: ResolvedPromptTemplate, copy: Messages): string =>
  template.source === "built-in" && !template.isOverridden
    ? getBuiltInLabel(template.id, copy)
    : template.label;

export function PromptsPanel({ copy, onPromptsChanged }: PromptsPanelProps) {
  const [library, setLibrary] = useState<ResolvedPromptLibrary>({ active: [], hidden: [] });
  const [editor, setEditor] = useState<PromptEditorState>();
  const [pendingDeleteId, setPendingDeleteId] = useState<string>();
  const [confirmRestoreAll, setConfirmRestoreAll] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string }>();

  useEffect(() => {
    let active = true;
    void loadResolvedPromptLibrary()
      .then((resolved) => {
        if (active) {
          setLibrary(resolved);
        }
      })
      .catch(() => {
        if (active) {
          setFeedback({ kind: "error", text: copy.promptLoadError });
        }
      });
    return () => {
      active = false;
    };
  }, [copy.promptLoadError]);

  const applyLibrary = (next: PromptLibraryV1, message: string) => {
    setLibrary(resolvePromptLibrary(next));
    setFeedback({ kind: "success", text: message });
    onPromptsChanged();
  };

  const runChange = async (
    change: () => Promise<PromptLibraryV1>,
    message: string,
  ): Promise<boolean> => {
    setFeedback(undefined);
    try {
      applyLibrary(await change(), message);
      return true;
    } catch {
      setFeedback({ kind: "error", text: copy.promptSaveError });
      return false;
    }
  };

  const openEditor = (template?: ResolvedPromptTemplate) => {
    setPendingDeleteId(undefined);
    setEditor(
      template
        ? {
            styleId: template.id,
            label: getDisplayLabel(template, copy),
            instruction: template.instruction,
          }
        : { label: "", instruction: "" },
    );
    setFeedback(undefined);
  };

  const saveEditor = async () => {
    if (!editor?.label.trim() || !editor.instruction.trim()) {
      setFeedback({ kind: "error", text: copy.promptFieldsRequired });
      return;
    }
    const saved = await runChange(
      () => savePromptTemplate(editor.styleId, editor.label, editor.instruction),
      editor.styleId ? copy.promptUpdated : copy.promptCreated,
    );
    if (saved) {
      setEditor(undefined);
    }
  };

  return (
    <div className="prompts-panel">
      <section className="section-heading" aria-labelledby="prompts-title">
        <p>{copy.promptsEyebrow}</p>
        <h1 id="prompts-title">{copy.promptsTitle}</h1>
        <span>{copy.promptsBody}</span>
      </section>

      <div className="prompts-toolbar">
        <span>{copy.promptCount.replace("{count}", String(library.active.length))}</span>
        <button type="button" className="primary-button" onClick={() => openEditor()}>
          <Plus size={16} weight="bold" aria-hidden="true" />
          {copy.newPrompt}
        </button>
      </div>

      {editor ? (
        <section className="prompt-editor" aria-labelledby="prompt-editor-title">
          <div className="prompt-editor-heading">
            <h2 id="prompt-editor-title">
              {editor.styleId ? copy.editPromptTitle : copy.newPromptTitle}
            </h2>
            <button
              type="button"
              className="icon-button"
              aria-label={copy.cancelPromptEdit}
              onClick={() => setEditor(undefined)}
            >
              <X size={17} weight="bold" />
            </button>
          </div>
          <label className="form-field" htmlFor="prompt-display-name">
            <span>{copy.promptNameLabel}</span>
            <input
              id="prompt-display-name"
              value={editor.label}
              maxLength={MAX_PROMPT_NAME_LENGTH}
              onChange={(event) => setEditor({ ...editor, label: event.target.value })}
            />
          </label>
          <label className="form-field prompt-instruction-field" htmlFor="prompt-instruction">
            <span>{copy.promptInstructionLabel}</span>
            <textarea
              id="prompt-instruction"
              aria-label={copy.promptInstructionLabel}
              value={editor.instruction}
              maxLength={MAX_PROMPT_INSTRUCTION_LENGTH}
              rows={8}
              onChange={(event) => setEditor({ ...editor, instruction: event.target.value })}
            />
            <small>
              {editor.instruction.length.toLocaleString()} /{" "}
              {MAX_PROMPT_INSTRUCTION_LENGTH.toLocaleString()}
            </small>
          </label>
          <p className="prompt-layer-note">{copy.promptLayerNote}</p>
          <div className="prompt-editor-actions">
            <button type="button" className="secondary-button" onClick={() => setEditor(undefined)}>
              {copy.cancelPromptEdit}
            </button>
            <button type="button" className="primary-button" onClick={saveEditor}>
              <FloppyDisk size={16} weight="bold" aria-hidden="true" />
              {copy.savePrompt}
            </button>
          </div>
        </section>
      ) : null}

      {feedback ? (
        <div
          className="feedback"
          data-kind={feedback.kind}
          role={feedback.kind === "error" ? "alert" : "status"}
        >
          {feedback.text}
        </div>
      ) : null}

      <div className="prompt-list">
        {library.active.map((template, index) => (
          <article className="prompt-card" key={template.id}>
            <div className="prompt-card-heading">
              <div>
                <strong>{getDisplayLabel(template, copy)}</strong>
                <span>
                  {template.source === "built-in" ? copy.builtInPrompt : copy.customPrompt}
                  {template.isOverridden ? ` · ${copy.overriddenPrompt}` : ""}
                </span>
              </div>
              <div className="prompt-order-actions">
                <button
                  type="button"
                  className="icon-button"
                  aria-label={copy.movePromptUp.replace("{name}", getDisplayLabel(template, copy))}
                  disabled={index === 0}
                  onClick={() =>
                    void runChange(() => movePrompt(template.id, "up"), copy.promptReordered)
                  }
                >
                  <ArrowUp size={16} weight="bold" />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={copy.movePromptDown.replace(
                    "{name}",
                    getDisplayLabel(template, copy),
                  )}
                  disabled={index === library.active.length - 1}
                  onClick={() =>
                    void runChange(() => movePrompt(template.id, "down"), copy.promptReordered)
                  }
                >
                  <ArrowDown size={16} weight="bold" />
                </button>
              </div>
            </div>
            <p>{template.instruction}</p>
            <div className="prompt-card-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => openEditor(template)}
              >
                <PencilSimple size={15} weight="bold" aria-hidden="true" />
                {copy.editPrompt}
              </button>
              {template.source === "built-in" ? (
                <>
                  {template.isOverridden ? (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() =>
                        void runChange(() => restoreBuiltInPrompt(template.id), copy.promptRestored)
                      }
                    >
                      <ArrowCounterClockwise size={15} weight="bold" aria-hidden="true" />
                      {copy.restorePrompt}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="quiet-button"
                    onClick={() =>
                      void runChange(() => hideBuiltInPrompt(template.id), copy.promptHidden)
                    }
                  >
                    <EyeSlash size={15} weight="bold" aria-hidden="true" />
                    {copy.hidePrompt}
                  </button>
                </>
              ) : pendingDeleteId === template.id ? (
                <span className="inline-confirm">
                  <span>{copy.deletePromptConfirm}</span>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => {
                      void runChange(() => deleteCustomPrompt(template.id), copy.promptDeleted);
                      setPendingDeleteId(undefined);
                    }}
                  >
                    {copy.confirmDelete}
                  </button>
                  <button
                    type="button"
                    className="quiet-button"
                    onClick={() => setPendingDeleteId(undefined)}
                  >
                    {copy.cancelPromptEdit}
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="quiet-button"
                  onClick={() => setPendingDeleteId(template.id)}
                >
                  <Trash size={15} weight="bold" aria-hidden="true" />
                  {copy.deletePrompt}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      {library.hidden.length > 0 ? (
        <section className="hidden-prompts" aria-labelledby="hidden-prompts-title">
          <h2 id="hidden-prompts-title">{copy.hiddenPromptsTitle}</h2>
          {library.hidden.map((template) => (
            <div className="hidden-prompt-row" key={template.id}>
              <span>{getDisplayLabel(template, copy)}</span>
              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  void runChange(() => restoreBuiltInPrompt(template.id), copy.promptRestored)
                }
              >
                <ArrowCounterClockwise size={15} weight="bold" aria-hidden="true" />
                {copy.restorePrompt}
              </button>
            </div>
          ))}
        </section>
      ) : null}

      <section className="restore-prompts">
        <div>
          <strong>{copy.restoreAllTitle}</strong>
          <span>{copy.restoreAllBody}</span>
        </div>
        {confirmRestoreAll ? (
          <span className="inline-confirm">
            <button
              type="button"
              className="danger-button"
              onClick={() => {
                void runChange(restoreAllBuiltInPrompts, copy.allPromptsRestored);
                setConfirmRestoreAll(false);
              }}
            >
              {copy.confirmRestoreAll}
            </button>
            <button
              type="button"
              className="quiet-button"
              onClick={() => setConfirmRestoreAll(false)}
            >
              {copy.cancelPromptEdit}
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="secondary-button"
            onClick={() => setConfirmRestoreAll(true)}
          >
            <ArrowCounterClockwise size={15} weight="bold" aria-hidden="true" />
            {copy.restoreAllPrompts}
          </button>
        )}
      </section>
    </div>
  );
}
