import { CheckCircle, FloppyDisk, SlidersHorizontal, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { createDefaultCreationPreferences } from "../core/preferences/creation";
import { OUTPUT_LANGUAGE_OPTIONS } from "../core/generation/languages";
import type { Messages } from "../i18n";
import { loadCreationPreferences, saveCreationPreferences } from "../storage/creation-preferences";

interface CreationPreferencesPanelProps {
  copy: Messages;
  revision?: number;
  onChanged?: () => void;
}

type Feedback = { kind: "success" | "error"; message: string } | undefined;

export function CreationPreferencesPanel({
  copy,
  revision,
  onChanged,
}: CreationPreferencesPanelProps) {
  const [preferences, setPreferences] = useState(createDefaultCreationPreferences());
  const [feedback, setFeedback] = useState<Feedback>();
  const [isSaving, setIsSaving] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Reset revision is an explicit reload signal.
  useEffect(() => {
    let active = true;
    void loadCreationPreferences().then((stored) => {
      if (active) {
        setPreferences(stored);
      }
    });
    return () => {
      active = false;
    };
  }, [revision]);

  const save = async () => {
    setIsSaving(true);
    setFeedback(undefined);
    try {
      setPreferences(await saveCreationPreferences(preferences));
      setFeedback({ kind: "success", message: copy.creationDefaultsSaved });
      onChanged?.();
    } catch {
      setFeedback({ kind: "error", message: copy.creationDefaultsError });
    } finally {
      setIsSaving(false);
    }
  };

  const languageOptions = (
    <>
      <option value="follow-source">{copy.languageFollowSource}</option>
      {OUTPUT_LANGUAGE_OPTIONS.map((option) => (
        <option value={option.id} key={option.id}>
          {option.label}
        </option>
      ))}
    </>
  );
  const lengthOptions = (
    <>
      <option value="short">{copy.presetLengthShort}</option>
      <option value="medium">{copy.presetLengthMedium}</option>
      <option value="long">{copy.presetLengthLong}</option>
    </>
  );

  return (
    <div className="settings-card creation-preferences-card">
      <div className="settings-card-heading">
        <SlidersHorizontal size={20} weight="duotone" aria-hidden="true" />
        <div>
          <strong>{copy.creationDefaultsTitle}</strong>
          <span>{copy.creationDefaultsBody}</span>
        </div>
      </div>

      <section className="settings-subsection" aria-labelledby="inline-defaults-title">
        <h3 id="inline-defaults-title">{copy.inlineDefaultsTitle}</h3>
        <div className="field-grid">
          <label className="form-field">
            <span>{copy.defaultCandidateCountLabel}</span>
            <input
              type="number"
              min="1"
              max="5"
              value={preferences.inline.candidateCount}
              onChange={(event) =>
                setPreferences({
                  ...preferences,
                  inline: { ...preferences.inline, candidateCount: Number(event.target.value) },
                })
              }
            />
          </label>
          <label className="form-field">
            <span>{copy.defaultLengthLabel}</span>
            <select
              value={preferences.inline.length}
              onChange={(event) =>
                setPreferences({
                  ...preferences,
                  inline: {
                    ...preferences.inline,
                    length: event.target.value as typeof preferences.inline.length,
                  },
                })
              }
            >
              {lengthOptions}
            </select>
          </label>
          <label className="form-field">
            <span>{copy.defaultLanguageLabel}</span>
            <select
              value={preferences.inline.language}
              onChange={(event) =>
                setPreferences({
                  ...preferences,
                  inline: {
                    ...preferences.inline,
                    language: event.target.value as typeof preferences.inline.language,
                  },
                })
              }
            >
              {languageOptions}
            </select>
          </label>
          <label className="form-field">
            <span>{copy.defaultReplyIntentLabel}</span>
            <select
              value={preferences.inline.replyIntent}
              onChange={(event) =>
                setPreferences({
                  ...preferences,
                  inline: {
                    ...preferences.inline,
                    replyIntent: event.target.value as typeof preferences.inline.replyIntent,
                  },
                })
              }
            >
              <option value="agree-and-add">{copy.replyIntentAgreeAndAdd}</option>
              <option value="respectful-disagree">{copy.replyIntentRespectfulDisagree}</option>
              <option value="question">{copy.replyIntentQuestion}</option>
              <option value="humorous">{copy.replyIntentHumorous}</option>
            </select>
          </label>
          <label className="form-field field-wide">
            <span>{copy.defaultQuoteIntentLabel}</span>
            <select
              value={preferences.inline.quoteIntent}
              onChange={(event) =>
                setPreferences({
                  ...preferences,
                  inline: {
                    ...preferences.inline,
                    quoteIntent: event.target.value as typeof preferences.inline.quoteIntent,
                  },
                })
              }
            >
              <option value="comment">{copy.quoteIntentComment}</option>
              <option value="summarize">{copy.quoteIntentSummarize}</option>
              <option value="extend">{copy.quoteIntentExtend}</option>
            </select>
          </label>
        </div>
      </section>

      <section className="settings-subsection" aria-labelledby="create-defaults-title">
        <h3 id="create-defaults-title">{copy.createDefaultsTitle}</h3>
        <div className="field-grid">
          <label className="form-field">
            <span>{copy.defaultCandidateCountLabel}</span>
            <input
              type="number"
              min="1"
              max="5"
              value={preferences.create.candidateCount}
              onChange={(event) =>
                setPreferences({
                  ...preferences,
                  create: { ...preferences.create, candidateCount: Number(event.target.value) },
                })
              }
            />
          </label>
          <label className="form-field">
            <span>{copy.defaultThreadCountLabel}</span>
            <input
              type="number"
              min="2"
              max="20"
              value={preferences.create.threadCount}
              onChange={(event) =>
                setPreferences({
                  ...preferences,
                  create: { ...preferences.create, threadCount: Number(event.target.value) },
                })
              }
            />
          </label>
          <label className="form-field">
            <span>{copy.defaultLengthLabel}</span>
            <select
              value={preferences.create.length}
              onChange={(event) =>
                setPreferences({
                  ...preferences,
                  create: {
                    ...preferences.create,
                    length: event.target.value as typeof preferences.create.length,
                  },
                })
              }
            >
              {lengthOptions}
            </select>
          </label>
          <label className="form-field">
            <span>{copy.defaultLanguageLabel}</span>
            <select
              value={preferences.create.language}
              onChange={(event) =>
                setPreferences({
                  ...preferences,
                  create: {
                    ...preferences.create,
                    language: event.target.value as typeof preferences.create.language,
                  },
                })
              }
            >
              {languageOptions}
            </select>
          </label>
        </div>
      </section>

      <p className="mock-note">{copy.creationDefaultsHint}</p>
      {feedback ? (
        <div className="feedback" data-kind={feedback.kind} role="status">
          {feedback.kind === "success" ? (
            <CheckCircle size={18} weight="fill" aria-hidden="true" />
          ) : (
            <WarningCircle size={18} weight="fill" aria-hidden="true" />
          )}
          <span>{feedback.message}</span>
        </div>
      ) : null}
      <div className="settings-actions">
        <button type="button" className="primary-button" onClick={save} disabled={isSaving}>
          <FloppyDisk size={17} weight="bold" aria-hidden="true" />
          {copy.saveCreationDefaults}
        </button>
      </div>
    </div>
  );
}
