import { X_SELECTORS } from "./selectors";
import type { XPostContext, XPostExtractionResult, XRelatedPostContext } from "./types";

const isOwnedByPost = (element: Element, article: HTMLElement): boolean =>
  element.closest(X_SELECTORS.post) === article;

const ownedElements = (article: HTMLElement, selector: string): HTMLElement[] =>
  Array.from(article.querySelectorAll<HTMLElement>(selector)).filter((element) =>
    isOwnedByPost(element, article),
  );

const normalizeText = (value: string | null | undefined): string | undefined => {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized || undefined;
};

const parseStatusLink = (
  link: HTMLAnchorElement | undefined,
): { authorHandle?: string; postUrl?: string } => {
  if (!link) {
    return {};
  }
  try {
    const url = new URL(link.href, window.location.origin);
    if (url.origin !== "https://x.com") {
      return {};
    }
    const match = url.pathname.match(/^\/([^/]+)\/status\/\d+/);
    return match ? { authorHandle: `@${match[1]}`, postUrl: `${url.origin}${url.pathname}` } : {};
  } catch {
    return {};
  }
};

const createRelatedContext = (
  textElement: HTMLElement | undefined,
  statusLink: HTMLAnchorElement | undefined,
): XRelatedPostContext | undefined => {
  const text = normalizeText(textElement?.textContent);
  if (!text) {
    return undefined;
  }
  return { text, ...parseStatusLink(statusLink) };
};

const statusIdFromUrl = (value: string | undefined): string | undefined =>
  value?.match(/\/status\/(\d+)/)?.[1];

const findVisibleParentPost = (
  article: HTMLElement,
  selectedPostUrl: string | undefined,
): XRelatedPostContext | undefined => {
  const routeStatusId = statusIdFromUrl(window.location.pathname);
  if (!routeStatusId || statusIdFromUrl(selectedPostUrl) !== routeStatusId) {
    return undefined;
  }

  const visiblePosts = Array.from(document.querySelectorAll<HTMLElement>(X_SELECTORS.post)).filter(
    (post) => !post.parentElement?.closest(X_SELECTORS.post),
  );
  const selectedIndex = visiblePosts.indexOf(article);
  if (selectedIndex <= 0) {
    return undefined;
  }

  const parent = visiblePosts[selectedIndex - 1];
  const parentText = ownedElements(parent, X_SELECTORS.postText)[0];
  const parentStatus = ownedElements(parent, X_SELECTORS.statusLink)[0] as
    | HTMLAnchorElement
    | undefined;
  return createRelatedContext(parentText, parentStatus);
};

export const findXPostActionBar = (article: HTMLElement): HTMLElement | undefined => {
  const replyAction = ownedElements(article, X_SELECTORS.replyAction)[0];
  const actionGroup = replyAction?.closest<HTMLElement>(X_SELECTORS.actionGroup);
  return actionGroup && isOwnedByPost(actionGroup, article) ? actionGroup : undefined;
};

export const extractXPost = (article: HTMLElement | null): XPostExtractionResult => {
  if (!article?.matches(X_SELECTORS.post)) {
    return { ok: false, reason: "POST_NOT_FOUND" };
  }

  const textElements = ownedElements(article, X_SELECTORS.postText);
  const text = normalizeText(textElements[0]?.textContent);
  if (!text) {
    return { ok: false, reason: "POST_TEXT_NOT_FOUND" };
  }
  if (!findXPostActionBar(article)) {
    return { ok: false, reason: "ACTION_BAR_NOT_FOUND" };
  }

  const statusLinks = ownedElements(article, X_SELECTORS.statusLink) as HTMLAnchorElement[];
  const primaryStatus = parseStatusLink(statusLinks[0]);
  const userName = ownedElements(article, X_SELECTORS.userName)[0];
  const languageElement = textElements[0]?.closest<HTMLElement>("[lang]") ?? textElements[0];
  const context: XPostContext = {
    source: "x-visible-post",
    text,
    authorDisplayName: normalizeText(userName?.querySelector("span")?.textContent),
    ...primaryStatus,
    detectedLanguage: normalizeText(languageElement?.getAttribute("lang")),
  };

  const quotedPost = createRelatedContext(textElements[1], statusLinks[1]);
  if (quotedPost) {
    context.quotedPost = quotedPost;
  }
  const parentPost = findVisibleParentPost(article, primaryStatus.postUrl);
  if (parentPost) {
    context.parentPost = parentPost;
  }
  return { ok: true, context };
};
