import { ClockCounterClockwise, GearSix, MagicWand, PencilSimple } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { BrandMark } from "../components/BrandMark";
import { createRequestId } from "../core/contracts/messages";
import type { GenerationInput } from "../core/generation/types";
import { detectPreferredLocale, getMessages, type Locale, UI_LOCALE_OPTIONS } from "../i18n";
import { loadUiLocale, saveUiLocale } from "../storage/locale-storage";
import { PENDING_X_CONTEXT_STORAGE_KEY, takePendingXContext } from "../storage/pending-context";
import { SettingsPanel } from "./SettingsPanel";
import { CreatePanel } from "./CreatePanel";
import { HistoryPanel } from "./HistoryPanel";
import { PromptsPanel } from "./PromptsPanel";

export function App() {
  const [locale, setLocale] = useState<Locale>(detectPreferredLocale());
  const [view, setView] = useState<"create" | "history" | "prompts" | "settings">("create");
  const [settingsRevision, setSettingsRevision] = useState(0);
  const [promptRevision, setPromptRevision] = useState(0);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [dataRevision, setDataRevision] = useState(0);
  const [historyDraft, setHistoryDraft] = useState<{
    requestId: string;
    input: GenerationInput;
  }>();
  const copy = getMessages(locale);

  useEffect(() => {
    let active = true;

    void loadUiLocale().then((storedLocale) => {
      if (active) {
        setLocale(storedLocale);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const consumePendingContext = () => {
      void takePendingXContext()
        .then((input) => {
          if (active && input) {
            setHistoryDraft({ requestId: createRequestId(), input });
            setView("create");
          }
        })
        .catch(() => undefined);
    };
    consumePendingContext();

    const storageChanges = typeof chrome !== "undefined" ? chrome.storage?.onChanged : undefined;
    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) => {
      if (areaName === "session" && PENDING_X_CONTEXT_STORAGE_KEY in changes) {
        consumePendingContext();
      }
    };
    storageChanges?.addListener(handleStorageChange);
    return () => {
      active = false;
      storageChanges?.removeListener(handleStorageChange);
    };
  }, []);

  const selectLocale = (nextLocale: Locale) => {
    setLocale(nextLocale);
    void saveUiLocale(nextLocale);
  };

  const reuseHistoryInput = (input: GenerationInput) => {
    setHistoryDraft({ requestId: createRequestId(), input });
    setView("create");
  };

  const handleDataReset = () => {
    setLocale(detectPreferredLocale());
    setSettingsRevision((revision) => revision + 1);
    setPromptRevision((revision) => revision + 1);
    setHistoryRevision((revision) => revision + 1);
    setHistoryDraft(undefined);
    setDataRevision((revision) => revision + 1);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            <BrandMark />
          </span>
          <div>
            <div className="brand-name">{copy.appName}</div>
            <div className="brand-tagline">{copy.tagline}</div>
          </div>
        </div>

        <label className="locale-switch">
          <span className="sr-only">{copy.localeLabel}</span>
          <select
            className="locale-select"
            aria-label={copy.localeLabel}
            value={locale}
            onChange={(event) => selectLocale(event.target.value as Locale)}
          >
            {UI_LOCALE_OPTIONS.map((option) => (
              <option value={option.id} key={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </header>

      <main className="app-main" data-view={view}>
        <div hidden={view !== "create"}>
          <CreatePanel
            key={dataRevision}
            copy={copy}
            onOpenSettings={() => setView("settings")}
            settingsRevision={settingsRevision}
            promptRevision={promptRevision}
            historyRevision={historyRevision}
            historyDraft={historyDraft}
            onHistoryChanged={() => setHistoryRevision((revision) => revision + 1)}
          />
        </div>
        {view === "history" ? (
          <HistoryPanel
            copy={copy}
            locale={locale}
            revision={historyRevision}
            onHistoryChanged={() => setHistoryRevision((revision) => revision + 1)}
            onReuseInput={reuseHistoryInput}
          />
        ) : null}
        <div hidden={view !== "prompts"}>
          <PromptsPanel
            key={dataRevision}
            copy={copy}
            onPromptsChanged={() => setPromptRevision((revision) => revision + 1)}
          />
        </div>
        <div hidden={view !== "settings"}>
          <SettingsPanel
            copy={copy}
            onSettingsChanged={() => setSettingsRevision((revision) => revision + 1)}
            onDataReset={handleDataReset}
            historyRevision={historyRevision}
          />
        </div>
      </main>

      <nav className="app-nav" aria-label={copy.primaryNavigation}>
        <button type="button" data-active={view === "create"} onClick={() => setView("create")}>
          <PencilSimple size={18} weight={view === "create" ? "fill" : "regular"} />
          <span>{copy.createNav}</span>
        </button>
        <button type="button" data-active={view === "history"} onClick={() => setView("history")}>
          <ClockCounterClockwise size={18} weight={view === "history" ? "fill" : "regular"} />
          <span>{copy.historyNav}</span>
        </button>
        <button type="button" data-active={view === "prompts"} onClick={() => setView("prompts")}>
          <MagicWand size={18} weight={view === "prompts" ? "fill" : "regular"} />
          <span>{copy.promptsNav}</span>
        </button>
        <button type="button" data-active={view === "settings"} onClick={() => setView("settings")}>
          <GearSix size={18} weight={view === "settings" ? "fill" : "regular"} />
          <span>{copy.settingsNav}</span>
        </button>
      </nav>
    </div>
  );
}
