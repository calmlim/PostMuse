import { Sparkle } from "@phosphor-icons/react";
import type { MouseEvent as ReactMouseEvent, SyntheticEvent } from "react";
import { createRoot } from "react-dom/client";
import { getMessages, resolveLocale } from "../../i18n";
import { InlinePanel } from "../inline-app/InlinePanel";
import type { MountedXPost } from "../observer";
import { extractXPost, findXPostActionBar } from "./extract-post";
import { POSTMUSE_HOST_ATTRIBUTE, POSTMUSE_MOUNT_ATTRIBUTE } from "./selectors";
import type { XPostExtractionResult } from "./types";

const triggerStyles = `
  :host { all: initial; display: flex; flex: 1 1 0; align-items: center; justify-content: center; }
  button { display: grid; width: 34px; height: 34px; place-items: center; padding: 0; border: 0; border-radius: 999px; background: transparent; color: rgb(83, 100, 113); cursor: pointer; }
  button:hover { background: rgba(49, 95, 202, .1); color: rgb(49, 95, 202); }
  button:focus-visible { outline: 2px solid rgb(49, 95, 202); outline-offset: 2px; }
  @media (prefers-color-scheme: dark) { button { color: rgb(113, 118, 123); } button:hover { color: rgb(138, 175, 255); } }
`;

const pageLocale = () => resolveLocale(document.documentElement.lang);

const isPostDetailPage = (): boolean =>
  /^\/(?:i\/web|[^/]+)\/status\/\d+(?:\/|$)/.test(window.location.pathname);

interface TriggerProps {
  onClick: () => void;
}

function InlineTrigger({ onClick }: TriggerProps) {
  const copy = getMessages(pageLocale());
  const stopPointerPropagation = (event: SyntheticEvent) => {
    event.stopPropagation();
  };
  const handleClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  };
  return (
    <>
      <style>{triggerStyles}</style>
      <button
        type="button"
        title={copy.inlineTrigger}
        aria-label={copy.inlineTrigger}
        onClick={handleClick}
        onPointerDown={stopPointerPropagation}
        onPointerUp={stopPointerPropagation}
      >
        <Sparkle size={18} weight="fill" aria-hidden="true" />
      </button>
    </>
  );
}

export const mountInlinePost = (
  article: HTMLElement,
  onOpened: (mounted: MountedXPost) => void,
): MountedXPost | undefined => {
  const actionBar = findXPostActionBar(article);
  if (!actionBar) {
    return undefined;
  }

  const triggerHost = document.createElement("span");
  triggerHost.setAttribute(POSTMUSE_HOST_ATTRIBUTE, "trigger");
  triggerHost.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  triggerHost.addEventListener("pointerdown", (event) => event.stopPropagation());
  triggerHost.addEventListener("pointerup", (event) => event.stopPropagation());
  const triggerShadow = triggerHost.attachShadow({ mode: "open" });
  const triggerRoot = createRoot(triggerShadow);

  const panelHost = document.createElement("div");
  panelHost.setAttribute(POSTMUSE_HOST_ATTRIBUTE, "panel");
  panelHost.style.display = "block";
  panelHost.style.width = "100%";
  panelHost.addEventListener("click", (event) => event.stopPropagation());
  panelHost.addEventListener("pointerdown", (event) => event.stopPropagation());
  panelHost.addEventListener("pointerup", (event) => event.stopPropagation());
  const panelShadow = panelHost.attachShadow({ mode: "open" });
  const panelRoot = createRoot(panelShadow);

  let open = false;
  let destroyed = false;
  let contextResult: XPostExtractionResult | undefined;
  let mounted: MountedXPost;

  const renderPanel = () => {
    panelRoot.render(
      open ? (
        <InlinePanel
          context={contextResult?.ok ? contextResult.context : undefined}
          extractionFailed={!contextResult?.ok}
          initialAction={isPostDetailPage() ? "reply" : "rewrite"}
          onClose={() => mounted.close(true)}
        />
      ) : null,
    );
  };

  const openPanel = () => {
    if (destroyed) {
      return;
    }
    contextResult = extractXPost(article);
    open = true;
    renderPanel();
    onOpened(mounted);
  };

  triggerRoot.render(<InlineTrigger onClick={openPanel} />);
  actionBar.append(triggerHost);
  actionBar.insertAdjacentElement("afterend", panelHost);

  mounted = {
    article,
    isConnected: () => triggerHost.isConnected && panelHost.isConnected,
    close: (restoreFocus = true) => {
      if (!open || destroyed) {
        return;
      }
      open = false;
      renderPanel();
      if (restoreFocus) {
        triggerShadow.querySelector<HTMLButtonElement>("button")?.focus();
      }
    },
    destroy: () => {
      if (destroyed) {
        return;
      }
      destroyed = true;
      triggerRoot.unmount();
      panelRoot.unmount();
      triggerHost.remove();
      panelHost.remove();
      article.removeAttribute(POSTMUSE_MOUNT_ATTRIBUTE);
    },
  };
  return mounted;
};
