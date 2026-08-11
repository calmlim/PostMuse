import { act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MountedXPost } from "../observer";
import { mountInlinePost } from "./inject-trigger";

const runtimeSendMessage = vi.fn();

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
  runtimeSendMessage.mockResolvedValue({
    ok: true,
    data: {
      locale: "en",
      configured: false,
      providerDisplayName: "OpenAI-compatible",
      model: "",
      styles: [
        {
          id: "professional",
          label: "Professional",
          version: 1,
          isBuiltInDefault: true,
        },
      ],
    },
  });
  vi.stubGlobal("chrome", { runtime: { sendMessage: runtimeSendMessage } });
});

afterEach(() => {
  document.body.replaceChildren();
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
});
