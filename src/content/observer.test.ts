import { afterEach, describe, expect, it, vi } from "vitest";
import type { MountedXPost } from "./observer";
import { XPostObserver } from "./observer";

const postMarkup = (id: number) => `
  <article data-testid="tweet" data-id="${id}">
    <div data-testid="tweetText">Post ${id}</div>
    <div role="group"><button data-testid="reply">Reply</button></div>
  </article>
`;

afterEach(() => {
  document.body.replaceChildren();
});

describe("XPostObserver", () => {
  it("batches a 100-post mutation and mounts each article once", async () => {
    const mounted = new Map<HTMLElement, MountedXPost>();
    const mountPost = vi.fn((article: HTMLElement, _onOpened) => {
      const result: MountedXPost = {
        article,
        isConnected: () => article.isConnected,
        close: vi.fn(),
        destroy: vi.fn(),
      };
      mounted.set(article, result);
      return result;
    });
    const observer = new XPostObserver(mountPost);
    observer.start();

    const batch = document.createElement("section");
    batch.innerHTML = Array.from({ length: 100 }, (_, index) => postMarkup(index)).join("");
    document.body.append(batch);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mountPost).toHaveBeenCalledTimes(100);
    batch.firstElementChild?.append(document.createElement("span"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mountPost).toHaveBeenCalledTimes(100);
    observer.stop();
  });

  it("cleans removed virtual-list nodes and allows remounting", async () => {
    const destroy = vi.fn();
    const mountPost = vi.fn((article: HTMLElement) => ({
      article,
      isConnected: () => article.isConnected,
      close: vi.fn(),
      destroy,
    }));
    const observer = new XPostObserver(mountPost);
    document.body.innerHTML = postMarkup(1);
    observer.start();
    const article = document.querySelector<HTMLElement>('article[data-testid="tweet"]');
    expect(article).not.toBeNull();

    article?.remove();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(destroy).toHaveBeenCalledTimes(1);
    observer.stop();
  });
});
