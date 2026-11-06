import {
  useEffect,
  useState,
  type MouseEvent as ReactMouseEvent,
  type SyntheticEvent,
} from "react";
import { createRoot } from "react-dom/client";
import type { InlineBootstrap } from "../../core/contracts/messages";
import { OUTPUT_LANGUAGE_OPTIONS } from "../../core/generation/languages";
import { getInlineMessages } from "../../i18n/inline";
import { detectPreferredLocale } from "../../i18n/locale";
import { InlinePanel } from "../inline-app/InlinePanel";
import { InlineTranslation } from "../inline-app/InlineTranslation";
import { InlineIcon } from "../inline-app/InlineIcon";
import { sendInlineRequest } from "../inline-client";
import type { MountedXPost } from "../observer";
import {
  extractXPost,
  extractXPostTranslationSource,
  findPrimaryXPostTextElement,
  findXPostActionBar,
  type XPostTranslationSource,
} from "./extract-post";
import { POSTMUSE_HOST_ATTRIBUTE, POSTMUSE_MOUNT_ATTRIBUTE } from "./selectors";
import type { XPostExtractionResult } from "./types";

const triggerStyles = `
  :host { all: initial; display: flex; flex: 1 1 0; align-items: center; justify-content: center; font: 13px/1.3 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
  :host([data-postmuse-trigger-kind="translate"]) { flex: 0 1 auto; min-width: 0; }
  button { display: inline-flex; min-width: 34px; height: 34px; align-items: center; justify-content: center; gap: 5px; padding: 0 8px; border: 0; border-radius: 999px; background: transparent; color: rgb(83, 100, 113); cursor: pointer; }
  button.icon-only { width: 34px; padding: 0; }
  button:hover { background: rgba(49, 95, 202, .1); color: rgb(49, 95, 202); }
  button:focus-visible { outline: 2px solid rgb(49, 95, 202); outline-offset: 2px; }
  .label { max-width: 112px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; font-weight: 650; }
  @media (max-width: 720px) { button.translation { width: 34px; padding: 0; } button.translation .label { display: none; } }
  @media (prefers-color-scheme: dark) { button { color: rgb(113, 118, 123); } button:hover { color: rgb(138, 175, 255); } }
`;

let configuredBootstrapPromise: Promise<InlineBootstrap> | undefined;
const bootstrapListeners = new Set<(bootstrap: InlineBootstrap) => void>();

const getConfiguredBootstrap = (): Promise<InlineBootstrap> => {
  configuredBootstrapPromise ??= sendInlineRequest({ type: "inline.bootstrap" });
  return configuredBootstrapPromise;
};

export const refreshInlineConfiguration = async (): Promise<void> => {
  configuredBootstrapPromise = undefined;
  try {
    const bootstrap = await getConfiguredBootstrap();
    for (const listener of bootstrapListeners) {
      listener(bootstrap);
    }
  } catch {
    // A later user action retries bootstrap without mutating the X page.
  }
};

const useConfiguredBootstrap = (): InlineBootstrap | undefined => {
  const [bootstrap, setBootstrap] = useState<InlineBootstrap>();
  useEffect(() => {
    let active = true;
    const listener = (value: InlineBootstrap) => {
      if (active) {
        setBootstrap(value);
      }
    };
    bootstrapListeners.add(listener);
    void getConfiguredBootstrap()
      .then(listener)
      .catch(() => undefined);
    return () => {
      active = false;
      bootstrapListeners.delete(listener);
    };
  }, []);
  return bootstrap;
};

const isPostDetailPage = (): boolean =>
  /^\/(?:i\/web|[^/]+)\/status\/\d+(?:\/|$)/.test(window.location.pathname);

interface TriggerProps {
  onClick: () => void;
}

const useTriggerHandler = (onClick: () => void) => ({
  stopPointerPropagation: (event: SyntheticEvent) => event.stopPropagation(),
  handleClick: (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  },
});

function InlineTrigger({ onClick }: TriggerProps) {
  const bootstrap = useConfiguredBootstrap();
  const copy = getInlineMessages(bootstrap?.locale ?? detectPreferredLocale());
  const { stopPointerPropagation, handleClick } = useTriggerHandler(onClick);
  return (
    <>
      <style>{triggerStyles}</style>
      <button
        type="button"
        className="icon-only"
        title={copy.inlineTrigger}
        aria-label={copy.inlineTrigger}
        onClick={handleClick}
        onPointerDown={stopPointerPropagation}
        onPointerUp={stopPointerPropagation}
      >
        <InlineIcon name="sparkle" size={18} />
      </button>
    </>
  );
}

function TranslationTrigger({ onClick }: TriggerProps) {
  const bootstrap = useConfiguredBootstrap();
  const copy = getInlineMessages(bootstrap?.locale ?? detectPreferredLocale());
  const target = bootstrap?.translation?.preferences.targetLanguage ?? "en";
  const targetLabel =
    OUTPUT_LANGUAGE_OPTIONS.find((option) => option.id === target)?.label ?? target;
  const label = copy.inlineTranslateTrigger.replace("{language}", targetLabel);
  const { stopPointerPropagation, handleClick } = useTriggerHandler(onClick);
  return (
    <>
      <style>{triggerStyles}</style>
      <button
        type="button"
        className="translation"
        title={label}
        aria-label={label}
        onClick={handleClick}
        onPointerDown={stopPointerPropagation}
        onPointerUp={stopPointerPropagation}
      >
        <InlineIcon name="globe" size={17} />
        <span className="label">{label}</span>
      </button>
    </>
  );
}

const stopHostPropagation = (host: HTMLElement) => {
  host.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  host.addEventListener("pointerdown", (event) => event.stopPropagation());
  host.addEventListener("pointerup", (event) => event.stopPropagation());
};

export const mountInlinePost = (
  article: HTMLElement,
  onOpened: (mounted: MountedXPost) => void,
): MountedXPost | undefined => {
  const actionBar = findXPostActionBar(article);
  const primaryTextElement = findPrimaryXPostTextElement(article);
  if (!actionBar || !primaryTextElement) {
    return undefined;
  }

  const triggerHost = document.createElement("span");
  triggerHost.setAttribute(POSTMUSE_HOST_ATTRIBUTE, "trigger");
  stopHostPropagation(triggerHost);
  const triggerShadow = triggerHost.attachShadow({ mode: "open" });
  const triggerRoot = createRoot(triggerShadow);

  const translationTriggerHost = document.createElement("span");
  translationTriggerHost.setAttribute(POSTMUSE_HOST_ATTRIBUTE, "translation-trigger");
  translationTriggerHost.setAttribute("data-postmuse-trigger-kind", "translate");
  stopHostPropagation(translationTriggerHost);
  const translationTriggerShadow = translationTriggerHost.attachShadow({ mode: "open" });
  const translationTriggerRoot = createRoot(translationTriggerShadow);

  const panelHost = document.createElement("div");
  panelHost.setAttribute(POSTMUSE_HOST_ATTRIBUTE, "panel");
  panelHost.style.display = "block";
  panelHost.style.width = "100%";
  stopHostPropagation(panelHost);
  const panelShadow = panelHost.attachShadow({ mode: "open" });
  const panelRoot = createRoot(panelShadow);

  const translationHost = document.createElement("div");
  translationHost.setAttribute(POSTMUSE_HOST_ATTRIBUTE, "translation-panel");
  translationHost.style.display = "block";
  translationHost.style.width = "100%";
  stopHostPropagation(translationHost);
  const translationShadow = translationHost.attachShadow({ mode: "open" });
  const translationRoot = createRoot(translationShadow);

  let activeSurface: "writing" | "translation" | undefined;
  let destroyed = false;
  let contextResult: XPostExtractionResult | undefined;
  let translationSource: XPostTranslationSource | undefined;
  let translationBootstrap: InlineBootstrap | undefined;
  let activeSignature: string | undefined;
  let hiddenOriginal:
    | { element: HTMLElement; display: string; ariaHidden: string | null }
    | undefined;
  let mounted: MountedXPost;

  const restoreOriginal = () => {
    if (!hiddenOriginal) {
      return;
    }
    hiddenOriginal.element.style.display = hiddenOriginal.display;
    if (hiddenOriginal.ariaHidden === null) {
      hiddenOriginal.element.removeAttribute("aria-hidden");
    } else {
      hiddenOriginal.element.setAttribute("aria-hidden", hiddenOriginal.ariaHidden);
    }
    hiddenOriginal = undefined;
  };

  const setTranslationVisible = (visible: boolean) => {
    restoreOriginal();
    if (
      visible &&
      translationBootstrap?.translation.preferences.displayMode === "replace" &&
      translationSource
    ) {
      const element = translationSource.textElement;
      hiddenOriginal = {
        element,
        display: element.style.display,
        ariaHidden: element.getAttribute("aria-hidden"),
      };
      element.style.display = "none";
      element.setAttribute("aria-hidden", "true");
    }
  };

  const renderSurfaces = () => {
    panelRoot.render(
      activeSurface === "writing" ? (
        <InlinePanel
          context={contextResult?.ok ? contextResult.context : undefined}
          extractionFailed={!contextResult?.ok}
          initialAction={isPostDetailPage() ? "reply" : "rewrite"}
          onClose={() => mounted.close(true)}
        />
      ) : null,
    );
    translationRoot.render(
      activeSurface === "translation" && translationSource && translationBootstrap ? (
        <InlineTranslation
          source={translationSource}
          bootstrap={translationBootstrap}
          onClose={() => mounted.close(true)}
          onTranslatedVisibilityChange={setTranslationVisible}
        />
      ) : null,
    );
  };

  const openWriting = () => {
    if (destroyed) {
      return;
    }
    restoreOriginal();
    contextResult = extractXPost(article);
    activeSignature = contextResult.ok
      ? `${contextResult.context.postUrl ?? ""}\u0000${contextResult.context.text}`
      : undefined;
    activeSurface = "writing";
    renderSurfaces();
    onOpened(mounted);
  };

  const openTranslation = async () => {
    if (destroyed) {
      return;
    }
    const source = extractXPostTranslationSource(article);
    if (!source) {
      return;
    }
    try {
      const bootstrap = await getConfiguredBootstrap();
      if (destroyed) {
        return;
      }
      restoreOriginal();
      translationSource = source;
      translationBootstrap = bootstrap;
      activeSignature = source.signature;
      activeSurface = "translation";
      renderSurfaces();
      onOpened(mounted);
    } catch {
      // A later click can retry bootstrap without mutating the X page.
    }
  };

  triggerRoot.render(<InlineTrigger onClick={openWriting} />);
  translationTriggerRoot.render(<TranslationTrigger onClick={() => void openTranslation()} />);
  actionBar.append(triggerHost, translationTriggerHost);
  actionBar.insertAdjacentElement("afterend", panelHost);
  primaryTextElement.insertAdjacentElement("afterend", translationHost);

  mounted = {
    article,
    isConnected: () =>
      triggerHost.isConnected &&
      translationTriggerHost.isConnected &&
      panelHost.isConnected &&
      translationHost.isConnected,
    refresh: () => {
      if (!activeSurface || !activeSignature) {
        return;
      }
      const signature =
        activeSurface === "translation"
          ? extractXPostTranslationSource(article)?.signature
          : (() => {
              const current = extractXPost(article);
              return current.ok
                ? `${current.context.postUrl ?? ""}\u0000${current.context.text}`
                : undefined;
            })();
      if (signature !== activeSignature) {
        mounted.close(false);
      }
    },
    close: (restoreFocus = true) => {
      if (!activeSurface || destroyed) {
        return;
      }
      const previousSurface = activeSurface;
      activeSurface = undefined;
      activeSignature = undefined;
      restoreOriginal();
      renderSurfaces();
      if (restoreFocus) {
        const shadow = previousSurface === "translation" ? translationTriggerShadow : triggerShadow;
        shadow.querySelector<HTMLButtonElement>("button")?.focus();
      }
    },
    destroy: () => {
      if (destroyed) {
        return;
      }
      restoreOriginal();
      destroyed = true;
      triggerRoot.unmount();
      translationTriggerRoot.unmount();
      panelRoot.unmount();
      translationRoot.unmount();
      triggerHost.remove();
      translationTriggerHost.remove();
      panelHost.remove();
      translationHost.remove();
      article.removeAttribute(POSTMUSE_MOUNT_ATTRIBUTE);
    },
  };
  return mounted;
};
