import { GearSix, NotePencil, PencilSimple, ShieldCheck, Sparkle } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { DEFAULT_LOCALE, getMessages, type Locale } from "../i18n";
import { loadUiLocale, saveUiLocale } from "../storage/locale-storage";
import { SettingsPanel } from "./SettingsPanel";

const localeOptions: Locale[] = ["en", "zh-CN"];

export function App() {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [view, setView] = useState<"create" | "settings">("create");
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

  const selectLocale = (nextLocale: Locale) => {
    setLocale(nextLocale);
    void saveUiLocale(nextLocale);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            <Sparkle size={18} weight="fill" />
          </span>
          <div>
            <div className="brand-name">{copy.appName}</div>
            <div className="brand-tagline">{copy.tagline}</div>
          </div>
        </div>

        <fieldset className="locale-switch">
          <legend className="sr-only">{copy.localeLabel}</legend>
          {localeOptions.map((option) => (
            <button
              className="locale-option"
              data-active={locale === option}
              type="button"
              aria-pressed={locale === option}
              key={option}
              onClick={() => selectLocale(option)}
            >
              {option === "en" ? copy.localeEnglish : copy.localeChinese}
            </button>
          ))}
        </fieldset>
      </header>

      <main className="app-main" data-view={view}>
        {view === "create" ? (
          <section className="empty-state" aria-labelledby="empty-state-title">
            <div className="empty-icon" aria-hidden="true">
              <NotePencil size={30} weight="duotone" />
            </div>
            <h1 id="empty-state-title">{copy.emptyTitle}</h1>
            <p>{copy.emptyBody}</p>
            <div className="empty-prompt">
              <Sparkle size={15} weight="fill" aria-hidden="true" />
              <span>{copy.emptyAction}</span>
            </div>
          </section>
        ) : (
          <SettingsPanel copy={copy} />
        )}
      </main>

      <nav className="app-nav" aria-label={copy.primaryNavigation}>
        <button type="button" data-active={view === "create"} onClick={() => setView("create")}>
          <PencilSimple size={18} weight={view === "create" ? "fill" : "regular"} />
          <span>{copy.createNav}</span>
        </button>
        <span className="privacy-mark">
          <ShieldCheck size={15} weight="duotone" aria-hidden="true" />
          {copy.privacyNote}
        </span>
        <button type="button" data-active={view === "settings"} onClick={() => setView("settings")}>
          <GearSix size={18} weight={view === "settings" ? "fill" : "regular"} />
          <span>{copy.settingsNav}</span>
        </button>
      </nav>
    </div>
  );
}
