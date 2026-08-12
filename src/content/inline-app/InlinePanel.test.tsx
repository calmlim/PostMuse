import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InlinePanel } from "./InlinePanel";
import type { XPostContext } from "../x-adapter/types";

const runtimeSendMessage = vi.fn();

const context: XPostContext = {
  source: "x-visible-post",
  text: "Main visible post",
  authorHandle: "@main",
  quotedPost: { text: "Quoted visible context", authorHandle: "@quoted" },
};

beforeEach(() => {
  runtimeSendMessage.mockReset();
  runtimeSendMessage.mockImplementation(async (request: { type: string }) => {
    if (request.type === "inline.bootstrap") {
      return {
        ok: true,
        data: {
          locale: "en",
          configured: true,
          providerDisplayName: "OpenAI",
          model: "gpt-test",
          defaultStyleId: "professional",
          preferences: {
            candidateCount: 2,
            length: "medium",
            language: "follow-source",
            replyIntent: "agree-and-add",
            quoteIntent: "comment",
          },
          styles: [
            {
              id: "professional",
              label: "Professional",
              version: 1,
              isBuiltInDefault: true,
            },
          ],
        },
      };
    }
    if (request.type === "inline.generate") {
      return {
        ok: true,
        data: {
          historyId: "history-inline-1",
          result: {
            format: "candidates",
            contentType: "post",
            candidates: [
              { id: "one", text: "Draft one" },
              { id: "two", text: "Draft two" },
              { id: "three", text: "Draft three" },
            ],
            warnings: [],
            provider: "openai-compatible",
            model: "gpt-test",
            softCharacterLimit: 280,
          },
        },
      };
    }
    if (request.type === "inline.regenerate") {
      return {
        ok: true,
        data: {
          text: "Only the first draft changed",
          provider: "openai-compatible",
          model: "gpt-test",
        },
      };
    }
    return { ok: true, data: { opened: true } };
  });
  vi.stubGlobal("chrome", { runtime: { sendMessage: runtimeSendMessage } });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe("InlinePanel", () => {
  it("excludes related context by default and includes it only after opt-in", async () => {
    render(<InlinePanel context={context} extractionFailed={false} onClose={vi.fn()} />);
    const generate = await screen.findByRole("button", { name: "Generate drafts" });
    expect(screen.queryByText("Main visible post")).not.toBeInTheDocument();
    expect(screen.queryByText("Quoted visible context")).not.toBeInTheDocument();

    fireEvent.click(generate);
    expect(await screen.findByLabelText("Draft 1")).toHaveValue("Draft one");
    const firstRequest = runtimeSendMessage.mock.calls.find(
      ([request]) => request.type === "inline.generate",
    )?.[0];
    expect(firstRequest.input.source.text).toBe("Main visible post");

    fireEvent.click(screen.getByRole("checkbox", { name: /Include related post/ }));
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    fireEvent.click(screen.getByRole("button", { name: "Generate drafts" }));
    await waitFor(() =>
      expect(
        runtimeSendMessage.mock.calls.filter(([request]) => request.type === "inline.generate"),
      ).toHaveLength(2),
    );
    const secondRequest = runtimeSendMessage.mock.calls.filter(
      ([request]) => request.type === "inline.generate",
    )[1][0];
    expect(secondRequest.input).toMatchObject({
      contentType: "reply",
      source: { text: expect.stringContaining("Quoted visible context") },
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Copy" })[0]);
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Draft one"));
    expect(
      screen.getAllByRole("button", { name: "Copy" })[0].closest(".result-heading"),
    ).not.toBeNull();
    expect(screen.getByText("Draft copied.")).toBeVisible();
    expect(runtimeSendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "inline.history.sync", historyId: "history-inline-1" }),
    );
  });

  it("keeps a safe side-panel fallback when extraction fails", async () => {
    render(<InlinePanel extractionFailed onClose={vi.fn()} />);

    expect(await screen.findByText(/could not safely read this post/i)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Open in side panel" }));
    await waitFor(() =>
      expect(runtimeSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "inline.openSidePanel", input: undefined }),
      ),
    );
    expect(runtimeSendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "inline.generate" }),
    );
  });

  it("places the side-panel action in the heading", async () => {
    render(<InlinePanel context={context} extractionFailed={false} onClose={vi.fn()} />);

    const action = await screen.findByRole("button", { name: "Open in side panel" });
    expect(action.closest(".heading-actions")).not.toBeNull();
    fireEvent.click(action);
    await waitFor(() =>
      expect(runtimeSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "inline.openSidePanel" }),
      ),
    );
  });

  it("generates in a selected common output language", async () => {
    render(<InlinePanel context={context} extractionFailed={false} onClose={vi.fn()} />);
    const language = await screen.findByRole("combobox", { name: "Output language" });
    fireEvent.change(language, { target: { value: "ja" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate drafts" }));
    expect(await screen.findByLabelText("Draft 1")).toBeVisible();

    const request = runtimeSendMessage.mock.calls.find(
      ([message]) => message.type === "inline.generate",
    )?.[0];
    expect(request.input.language).toEqual({ mode: "fixed", value: "ja" });
  });

  it("does not offer per-draft regeneration in inline results", async () => {
    render(<InlinePanel context={context} extractionFailed={false} onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Generate drafts" }));
    expect(await screen.findByLabelText("Draft 1")).toHaveValue("Draft one");

    expect(screen.queryByRole("button", { name: "Regenerate" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Draft 2")).toHaveValue("Draft two");
  });
});
