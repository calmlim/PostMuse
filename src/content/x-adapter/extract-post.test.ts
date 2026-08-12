import { afterEach, describe, expect, it } from "vitest";
import { extractXPost, findXPostActionBar } from "./extract-post";

const createPost = (options: { quoted?: boolean; text?: string } = {}): HTMLElement => {
  const article = document.createElement("article");
  article.dataset.testid = "tweet";
  article.innerHTML = `
    <div data-testid="User-Name"><span>Ada Builder</span><span>@ada</span></div>
    <a href="https://x.com/ada/status/123"><time>now</time></a>
    <div lang="en"><div data-testid="tweetText">${options.text ?? "A focused product lesson"}</div></div>
    ${
      options.quoted
        ? `<div class="quoted-card"><a href="https://x.com/quoted/status/456">quoted</a><div data-testid="tweetText">Quoted context</div></div>`
        : ""
    }
    <div role="group"><button data-testid="reply" type="button">Reply action</button></div>
  `;
  document.body.append(article);
  return article;
};

afterEach(() => {
  document.body.replaceChildren();
  window.history.replaceState({}, "", "/");
});

describe("X post extraction", () => {
  it("extracts only the selected visible post by default", () => {
    const article = createPost({ quoted: true });

    expect(extractXPost(article)).toEqual({
      ok: true,
      context: {
        source: "x-visible-post",
        text: "A focused product lesson",
        authorDisplayName: "Ada Builder",
        authorHandle: "@ada",
        postUrl: "https://x.com/ada/status/123",
        detectedLanguage: "en",
        quotedPost: {
          text: "Quoted context",
          authorHandle: "@quoted",
          postUrl: "https://x.com/quoted/status/456",
        },
      },
    });
  });

  it("does not treat a nested post as part of the selected post", () => {
    const article = createPost();
    const nested = document.createElement("article");
    nested.dataset.testid = "tweet";
    nested.innerHTML = '<div data-testid="tweetText">Nested text</div>';
    article.prepend(nested);

    expect(extractXPost(article)).toMatchObject({
      ok: true,
      context: { text: "A focused product lesson" },
    });
  });

  it("includes the immediately visible parent for the focal post on a detail route", () => {
    const parent = createPost({ text: "Parent context" });
    parent.querySelector("a")?.setAttribute("href", "https://x.com/parent/status/111");
    const reply = createPost({ text: "Focal reply" });
    reply.querySelector("a")?.setAttribute("href", "https://x.com/replier/status/222");
    window.history.replaceState({}, "", "/replier/status/222");

    expect(extractXPost(reply)).toMatchObject({
      ok: true,
      context: {
        text: "Focal reply",
        parentPost: {
          text: "Parent context",
          authorHandle: "@parent",
          postUrl: "https://x.com/parent/status/111",
        },
      },
    });
  });

  it("does not infer a parent for timeline posts or non-focal conversation posts", () => {
    createPost({ text: "Earlier visible post" });
    const selected = createPost({ text: "Selected post" });
    window.history.replaceState({}, "", "/another/status/999");

    const result = extractXPost(selected);
    expect(result).toMatchObject({ ok: true, context: { text: "Selected post" } });
    expect(result.ok && result.context.parentPost).toBeUndefined();
  });

  it("fails closed when text or the semantic action group is unavailable", () => {
    const article = createPost({ text: "" });
    expect(extractXPost(article)).toEqual({ ok: false, reason: "POST_TEXT_NOT_FOUND" });

    article.querySelector('[data-testid="tweetText"]')?.replaceWith(document.createElement("div"));
    article.querySelector('[role="group"]')?.remove();
    expect(findXPostActionBar(article)).toBeUndefined();
  });
});
