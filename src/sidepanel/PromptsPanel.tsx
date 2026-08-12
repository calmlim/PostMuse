import {
  ArrowCounterClockwise,
  ArrowDown,
  ArrowUp,
  EyeSlash,
  FloppyDisk,
  PencilSimple,
  Plus,
  Star,
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
import { createDefaultCreationPreferences } from "../core/preferences/creation";
import { loadCreationPreferences, saveCreationPreferences } from "../storage/creation-preferences";
import {
  deleteCustomPrompt,
  hideBuiltInPrompt,
  loadResolvedPromptLibrary,
  movePrompt,
  restoreAllBuiltInPrompts,
  restoreBuiltInPrompt,
  savePromptTemplate,
} from "../storage/prompt-repository";
import {
  loadWritingProfile,
  MAX_WRITING_PROFILE_LENGTH,
  saveWritingProfile,
} from "../storage/writing-profile-repository";

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
  const [writingProfile, setWritingProfile] = useState("");
  const [creationPreferences, setCreationPreferences] = useState(
    createDefaultCreationPreferences(),
  );

  useEffect(() => {
    let active = true;
    void Promise.all([loadResolvedPromptLibrary(), loadWritingProfile(), loadCreationPreferences()])
      .then(([resolved, profile, preferences]) => {
        if (active) {
          setLibrary(resolved);
          setWritingProfile(profile);
          const defaultStyleId = resolved.active.some(
            (template) => template.id === preferences.defaultStyleId,
          )
            ? preferences.defaultStyleId
            : (resolved.active[0]?.id ?? "professional");
          const nextPreferences = { ...preferences, defaultStyleId };
          setCreationPreferences(nextPreferences);
          if (defaultStyleId !== preferences.defaultStyleId) {
            void saveCreationPreferences(nextPreferences);
          }
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

  const applyLibrary = async (next: PromptLibraryV1, message: string) => {
    const resolved = resolvePromptLibrary(next);
    setLibrary(resolved);
    if (!resolved.active.some((template) => template.id === creationPreferences.defaultStyleId)) {
      const preferences = {
        ...creationPreferences,
        defaultStyleId: resolved.active[0]?.id ?? "professional",
      };
      setCreationPreferences(await saveCreationPreferences(preferences));
    }
    setFeedback({ kind: "success", text: message });
    onPromptsChanged();
  };

  const runChange = async (
    change: () => Promise<PromptLibraryV1>,
    message: string,
  ): Promise<boolean> => {
    setFeedback(undefined);
    try {
      await applyLibrary(await change(), message);
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

  const saveProfile = async () => {
    setFeedback(undefined);
    try {
      setWritingProfile(await saveWritingProfile(writingProfile));
      setFeedback({ kind: "success", text: copy.writingProfileSaved });
      onPromptsChanged();
    } catch {
      setFeedback({ kind: "error", text: copy.writingProfileSaveError });
    }
  };

  const setDefaultStyle = async (styleId: string) => {
    setFeedback(undefined);
    try {
      const preferences = await saveCreationPreferences({
        ...creationPreferences,
        defaultStyleId: styleId,
      });
      setCreationPreferences(preferences);
      setFeedback({ kind: "success", text: copy.defaultPromptSaved });
      onPromptsChanged();
    } catch {
      setFeedback({ kind: "error", text: copy.promptSaveError });
    }
  };

  return (
    <div className="prompts-panel">
      <section className="section-heading" aria-labelledby="prompts-title">
        <p>{copy.promptsEyebrow}</p>
        <h1 id="prompts-title">{copy.promptsTitle}</h1>
        <span>{copy.promptsBody}</span>
      </section>

      <section className="writing-profile-card" aria-labelledby="writing-profile-title">
        <div>
          <h2 id="writing-profile-title">{copy.writingProfileTitle}</h2>
          <p>{copy.writingProfileBody}</p>
        </div>
        <label className="form-field writing-profile-field" htmlFor="writing-profile">
          <span>{copy.writingProfileLabel}</span>
          <div className="writing-profile-editor">
            <textarea
              id="writing-profile"
              aria-label={copy.writingProfileLabel}
              value={writingProfile}
              placeholder={copy.writingProfilePlaceholder}
              maxLength={MAX_WRITING_PROFILE_LENGTH}
              rows={6}
              onChange={(event) => {
                setWritingProfile(event.target.value);
                setFeedback(undefined);
              }}
            />
            <small className="writing-profile-count">
              {writingProfile.length.toLocaleString()} /{" "}
              {MAX_WRITING_PROFILE_LENGTH.toLocaleString()}
            </small>
          </div>
        </label>
        <div className="writing-profile-footer">
          <small>{copy.writingProfileHint}</small>
          <button type="button" className="primary-button" onClick={saveProfile}>
            <FloppyDisk size={16} weight="bold" aria-hidden="true" />
            {copy.saveWritingProfile}
          </button>
        </div>
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
                  {creationPreferences.defaultStyleId === template.id
                    ? ` · ${copy.defaultPrompt}`
                    : ""}
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
                disabled={creationPreferences.defaultStyleId === template.id}
                onClick={() => void setDefaultStyle(template.id)}
              >
                <Star
                  size={15}
                  weight={creationPreferences.defaultStyleId === template.id ? "fill" : "bold"}
                  aria-hidden="true"
                />
                {creationPreferences.defaultStyleId === template.id
                  ? copy.defaultPrompt
                  : copy.setDefaultPrompt}
              </button>
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
