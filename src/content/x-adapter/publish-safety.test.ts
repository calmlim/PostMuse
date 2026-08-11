import { describe, expect, it } from "vitest";
import { X_SELECTORS } from "./selectors";

describe("X publish safety boundary", () => {
  it("contains no selector for an X submission control", () => {
    const selectors = Object.values(X_SELECTORS).join(" ");
    expect(selectors).not.toMatch(/tweetButton|postButton|submit/i);
    expect(Object.keys(X_SELECTORS)).toEqual([
      "post",
      "postText",
      "replyAction",
      "actionGroup",
      "userName",
      "statusLink",
    ]);
  });
});
