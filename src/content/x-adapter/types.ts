export interface XRelatedPostContext {
  text: string;
  authorHandle?: string;
  postUrl?: string;
}

export interface XPostContext {
  source: "x-visible-post";
  text: string;
  authorDisplayName?: string;
  authorHandle?: string;
  postUrl?: string;
  detectedLanguage?: string;
  quotedPost?: XRelatedPostContext;
  parentPost?: XRelatedPostContext;
}

export type XPostExtractionResult =
  | { ok: true; context: XPostContext }
  | { ok: false; reason: "POST_NOT_FOUND" | "POST_TEXT_NOT_FOUND" | "ACTION_BAR_NOT_FOUND" };
