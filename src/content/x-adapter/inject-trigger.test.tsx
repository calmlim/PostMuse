import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MountedXPost } from "../observer";
import { mountInlinePost, refreshInlineConfiguration } from "./inject-trigger";

const runtimeSendMessage = vi.fn();
let translationDisplayMode: "below" | "replace";

const createPost = (text: string): HTMLElement => {
  const article = document.createElement("article");
  article.dataset.testid = "tweet";
  article.innerHTML = `
    <a href="https://x.com/user/status/123">time</a>
    <div data-testid="tweetText">${text}</div>
    <div role="group"><button data-testid="reply">Reply action</button></div>
  `;
  document.body.append(article);
  return article;
};

beforeEach(() => {
  translationDisplayMode = "replace";
  runtimeSendMessage.mockImplementation(async (message: { type: string }) => ({
    ok: true,
    data:
      message.type === "inline.translate"
        ? {
            status: "translated",
            text: "翻译结果",
            targetLanguage: "zh-CN",
            provider: "openai-compatible",
            model: "test-model",
            cached: false,
            outputLimitMayBeLow: false,
          }
        : {
            locale: "en",
            configured: true,
            providerDisplayName: "OpenAI-compatible",
            model: "test-model",
            styles: [
              {
                id: "professional",
                label: "Professional",
                version: 1,
                isBuiltInDefault: true,
              },
            ],
            defaultStyleId: "professional",
            preferences: {
              language: "follow-source",
              length: "medium",
              candidateCount: 2,
              replyIntent: "agree-and-add",
              quoteIntent: "comment",
            },
            translation: {
              configured: true,
              preferences: {
                schemaVersion: 2,
                targetLanguage: "zh-CN",
                displayMode: translationDisplayMode,
                translationModel: "",
                fastMode: true,
              },
            },
          },
  }));
  vi.stubGlobal("chrome", { runtime: { sendMessage: runtimeSendMessage } });
});

afterEach(() => {
  document.body.replaceChildren();
  window.history.replaceState({}, "", "/");
});

describe("inline X mount", () => {
  it("uses isolated Shadow DOM and keeps only one panel open", async () => {
    const firstArticle = createPost("First post");
    const secondArticle = createPost("Second post");
    const firstText = firstArticle.querySelector<HTMLElement>('[data-testid="tweetText"]');
    if (!firstText) {
      throw new Error("Fixture text is missing.");
    }
    let textReads = 0;
    Object.defineProperty(firstText, "textContent", {
      configurable: true,
      get: () => {
        textReads += 1;
        return "First post";
      },
    });
    let active: MountedXPost | undefined;
    const onOpened = (mounted: MountedXPost) => {
      active?.close(false);
      active = mounted;
    };
    let first: MountedXPost | undefined;
    let second: MountedXPost | undefined;
    await act(async () => {
      first = mountInlinePost(firstArticle, onOpened);
      second = mountInlinePost(secondArticle, onOpened);
    });
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(textReads).toBe(0);

    const firstTrigger = firstArticle.querySelector<HTMLElement>('[data-postmuse-host="trigger"]');
    const firstPanel = firstArticle.querySelector<HTMLElement>('[data-postmuse-host="panel"]');
    const secondTrigger = secondArticle.querySelector<HTMLElement>(
      '[data-postmuse-host="trigger"]',
    );
    const secondPanel = secondArticle.querySelector<HTMLElement>('[data-postmuse-host="panel"]');
    expect(firstTrigger?.shadowRoot).not.toBeNull();
    expect(firstPanel?.shadowRoot).not.toBeNull();

    await act(async () => {
      firstTrigger?.shadowRoot?.querySelector<HTMLButtonElement>("button")?.click();
    });
    expect(textReads).toBe(1);
    expect(firstPanel?.shadowRoot?.querySelector("section")).not.toBeNull();

    await act(async () => {
      secondTrigger?.shadowRoot?.querySelector<HTMLButtonElement>("button")?.click();
    });
    expect(firstPanel?.shadowRoot?.querySelector("section")).toBeNull();
    expect(secondPanel?.shadowRoot?.querySelector("section")).not.toBeNull();

    await act(async () => {
      first?.destroy();
      second?.destroy();
    });
    expect(firstArticle.hasAttribute("data-postmuse-mounted")).toBe(false);
  });

  it("opens the panel without triggering the post card navigation handlers", async () => {
    const article = createPost("Stay on the timeline");
    const articleClick = vi.fn();
    const articlePointerDown = vi.fn();
    article.addEventListener("click", articleClick);
    article.addEventListener("pointerdown", articlePointerDown);

    let mounted: MountedXPost | undefined;
    await act(async () => {
      mounted = mountInlinePost(article, vi.fn());
    });

    const trigger = article.querySelector<HTMLElement>('[data-postmuse-host="trigger"]');
    const button = trigger?.shadowRoot?.querySelector<HTMLButtonElement>("button");
    const panel = article.querySelector<HTMLElement>('[data-postmuse-host="panel"]');
    expect(button).toBeDefined();

    button?.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, cancelable: true, composed: true }),
    );
    await act(async () => {
      button?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, composed: true }),
      );
    });

    expect(articlePointerDown).not.toHaveBeenCalled();
    expect(articleClick).not.toHaveBeenCalled();
    expect(panel?.shadowRoot?.querySelector("section")).not.toBeNull();

    const panelSection = panel?.shadowRoot?.querySelector("section");
    panelSection?.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, cancelable: true, composed: true }),
    );
    panelSection?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true, composed: true }),
    );
    expect(articlePointerDown).not.toHaveBeenCalled();
    expect(articleClick).not.toHaveBeenCalled();

    await act(async () => mounted?.destroy());
  });

  it("defaults to rewrite on the timeline and reply on a post detail page", async () => {
    const openPanelAt = async (path: string) => {
      window.history.replaceState({}, "", path);
      const article = createPost(`Post at ${path}`);
      let mounted: MountedXPost | undefined;
      await act(async () => {
        mounted = mountInlinePost(article, vi.fn());
      });
      const trigger = article.querySelector<HTMLElement>('[data-postmuse-host="trigger"]');
      await act(async () => {
        trigger?.shadowRoot?.querySelector<HTMLButtonElement>("button")?.click();
      });
      const panel = article.querySelector<HTMLElement>('[data-postmuse-host="panel"]');
      return { article, mounted, panel };
    };

    const timeline = await openPanelAt("/home");
    expect(
      Array.from(timeline.panel?.shadowRoot?.querySelectorAll("button") ?? []).find(
        (button) => button.textContent === "Rewrite",
      ),
    ).toHaveAttribute("aria-pressed", "true");
    await act(async () => timeline.mounted?.destroy());
    timeline.article.remove();

    const detail = await openPanelAt("/postmuse/status/123456789");
    expect(
      Array.from(detail.panel?.shadowRoot?.querySelectorAll("button") ?? []).find(
        (button) => button.textContent === "Reply",
      ),
    ).toHaveAttribute("aria-pressed", "true");
    await act(async () => detail.mounted?.destroy());
  });

  it("translates only after a click and restores visually replaced source text", async () => {
    const article = createPost("Hello\nworld");
    const text = article.querySelector<HTMLElement>('[data-testid="tweetText"]');
    let mounted: MountedXPost | undefined;
    await act(async () => {
      mounted = mountInlinePost(article, vi.fn());
    });
    expect(
      runtimeSendMessage.mock.calls.some(([message]) => message.type === "inline.translate"),
    ).toBe(false);

    const trigger = article.querySelector<HTMLElement>(
      '[data-postmuse-host="translation-trigger"]',
    );
    expect(trigger?.shadowRoot?.querySelector("button")?.getAttribute("aria-label")).toContain(
      "简体中文",
    );
    await act(async () => {
      trigger?.shadowRoot?.querySelector<HTMLButtonElement>("button")?.click();
    });
    await act(async () => Promise.resolve());

    expect(
      runtimeSendMessage.mock.calls.some(([message]) => message.type === "inline.translate"),
    ).toBe(true);
    expect(text?.style.display).toBe("none");
    const translation = article.querySelector<HTMLElement>(
      '[data-postmuse-host="translation-panel"]',
    );
    expect(translation?.shadowRoot?.textContent).toContain("翻译结果");

    await act(async () => mounted?.close(false));
    expect(text?.style.display).toBe("");
    expect(text?.hasAttribute("aria-hidden")).toBe(false);
    await act(async () => mounted?.destroy());
  });

  it("keeps the original visible in below mode", async () => {
    translationDisplayMode = "below";
    await act(async () => refreshInlineConfiguration());
    const article = createPost("Hello world");
    const text = article.querySelector<HTMLElement>('[data-testid="tweetText"]');
    let mounted: MountedXPost | undefined;
    await act(async () => {
      mounted = mountInlinePost(article, vi.fn());
    });
    const trigger = article.querySelector<HTMLElement>(
      '[data-postmuse-host="translation-trigger"]',
    );
    await act(async () => {
      trigger?.shadowRoot?.querySelector<HTMLButtonElement>("button")?.click();
    });
    await act(async () => Promise.resolve());

    expect(text?.style.display).toBe("");
    expect(text?.hasAttribute("aria-hidden")).toBe(false);
    await act(async () => mounted?.destroy());
  });

  it("clears a replaced translation and restores the source when an article is reused", async () => {
    translationDisplayMode = "replace";
    await act(async () => refreshInlineConfiguration());
    const article = createPost("First post");
    const text = article.querySelector<HTMLElement>('[data-testid="tweetText"]');
    let mounted: MountedXPost | undefined;
    await act(async () => {
      mounted = mountInlinePost(article, vi.fn());
    });
    const trigger = article.querySelector<HTMLElement>(
      '[data-postmuse-host="translation-trigger"]',
    );
    await act(async () => {
      trigger?.shadowRoot?.querySelector<HTMLButtonElement>("button")?.click();
    });
    await act(async () => Promise.resolve());
    expect(text?.style.display).toBe("none");

    if (text) {
      text.textContent = "Reused post";
    }
    await act(async () => mounted?.refresh?.());

    expect(text?.style.display).toBe("");
    expect(text?.hasAttribute("aria-hidden")).toBe(false);
    const translation = article.querySelector<HTMLElement>(
      '[data-postmuse-host="translation-panel"]',
    );
    expect(translation?.shadowRoot?.textContent).not.toContain("翻译结果");
    await act(async () => mounted?.destroy());
  });
});
