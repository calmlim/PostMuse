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
    expect(screen.getByText("Quoted visible context")).toBeVisible();

    fireEvent.click(generate);
    expect(await screen.findByLabelText("Draft 1")).toHaveValue("Draft one");
    const firstRequest = runtimeSendMessage.mock.calls.find(
      ([request]) => request.type === "inline.generate",
    )?.[0];
    expect(firstRequest.input.source.text).toBe("Main visible post");

    fireEvent.click(screen.getByRole("checkbox", { name: /Include quoted context/ }));
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
    expect(screen.getByText("Draft copied.")).toBeVisible();
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
});
