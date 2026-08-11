import { POSTMUSE_MOUNT_ATTRIBUTE, X_SELECTORS } from "./x-adapter/selectors";

export interface MountedXPost {
  article: HTMLElement;
  isConnected: () => boolean;
  close: (restoreFocus?: boolean) => void;
  destroy: () => void;
}

type MountXPost = (
  article: HTMLElement,
  onOpened: (mounted: MountedXPost) => void,
) => MountedXPost | undefined;

const collectCandidatePosts = (root: Node): HTMLElement[] => {
  const posts = new Set<HTMLElement>();
  if (root instanceof Element) {
    const closest = root.closest<HTMLElement>(X_SELECTORS.post);
    if (closest) {
      posts.add(closest);
    }
    if (root.matches(X_SELECTORS.post)) {
      posts.add(root as HTMLElement);
    }
    for (const post of root.querySelectorAll<HTMLElement>(X_SELECTORS.post)) {
      posts.add(post);
    }
  } else if (root instanceof Document || root instanceof DocumentFragment) {
    for (const post of root.querySelectorAll<HTMLElement>(X_SELECTORS.post)) {
      posts.add(post);
    }
  }
  return [...posts];
};

export class XPostObserver {
  private readonly mounts = new Map<HTMLElement, MountedXPost>();
  private readonly pendingRoots = new Set<Node>();
  private observer?: MutationObserver;
  private flushQueued = false;
  private activeMount?: MountedXPost;

  constructor(private readonly mountPost: MountXPost) {}

  start(root: Document = document): void {
    if (this.observer) {
      return;
    }
    this.scan(root);
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        this.pendingRoots.add(mutation.target);
        for (const node of mutation.addedNodes) {
          this.pendingRoots.add(node);
        }
      }
      this.scheduleFlush();
    });
    this.observer.observe(root.documentElement, { childList: true, subtree: true });
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = undefined;
    this.pendingRoots.clear();
    for (const mounted of this.mounts.values()) {
      mounted.destroy();
    }
    this.mounts.clear();
    this.activeMount = undefined;
  }

  private scheduleFlush(): void {
    if (this.flushQueued) {
      return;
    }
    this.flushQueued = true;
    queueMicrotask(() => {
      this.flushQueued = false;
      this.flush();
    });
  }

  private flush(): void {
    for (const [article, mounted] of this.mounts) {
      if (!article.isConnected || !mounted.isConnected()) {
        mounted.destroy();
        this.mounts.delete(article);
        if (this.activeMount === mounted) {
          this.activeMount = undefined;
        }
      }
    }
    const roots = [...this.pendingRoots];
    this.pendingRoots.clear();
    for (const root of roots) {
      this.scan(root);
    }
  }

  private scan(root: Node): void {
    for (const article of collectCandidatePosts(root)) {
      if (
        !article.isConnected ||
        this.mounts.has(article) ||
        article.hasAttribute(POSTMUSE_MOUNT_ATTRIBUTE)
      ) {
        continue;
      }
      const mounted = this.mountPost(article, (opened) => {
        if (this.activeMount && this.activeMount !== opened) {
          this.activeMount.close(false);
        }
        this.activeMount = opened;
      });
      if (mounted) {
        article.setAttribute(POSTMUSE_MOUNT_ATTRIBUTE, "true");
        this.mounts.set(article, mounted);
      }
    }
  }
}
