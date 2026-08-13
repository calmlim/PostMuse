import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getMessages } from "../i18n";
import { GenerationResults } from "./GenerationResults";

describe("GenerationResults", () => {
  it("edits thread posts independently and copies the whole thread in order", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const onChange = vi.fn();
    const onCopied = vi.fn();
    const result = {
      format: "thread" as const,
      contentType: "thread" as const,
      threads: [
        {
          id: "thread-1",
          posts: [
            { id: "post-1", text: "Hook" },
            { id: "post-2", text: "Close" },
          ],
        },
      ],
      warnings: [],
      provider: "xai" as const,
      model: "grok-test",
      softCharacterLimit: 280,
    };

    render(
      <GenerationResults
        copy={getMessages("en")}
        result={result}
        onChange={onChange}
        onCopied={onCopied}
      />,
    );
    fireEvent.change(screen.getByLabelText("Post 1 of 2"), { target: { value: "New hook" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        threads: [
          expect.objectContaining({
            posts: [
              { id: "post-1", text: "New hook" },
              { id: "post-2", text: "Close" },
            ],
          }),
        ],
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy entire thread" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("Hook\n\nClose"));
    expect(onCopied).toHaveBeenCalledWith(result);
  });

  it("uses the result's longer-post limit for a premium-length thread", () => {
    render(
      <GenerationResults
        copy={getMessages("en")}
        result={{
          format: "thread",
          contentType: "thread",
          threads: [{ id: "thread-1", posts: [{ id: "post-1", text: "Long thread post" }] }],
          warnings: [],
          provider: "xai",
          model: "grok-test",
          softCharacterLimit: 25_000,
        }}
        input={{
          source: { kind: "draft", text: "Source" },
          contentType: "thread",
          language: { mode: "follow-source" },
          styleId: "professional",
          length: "custom",
          customLength: 1_000,
          candidateCount: 1,
          threadCount: 2,
        }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/16 \/ 25000 · X count: 16/)).toBeInTheDocument();
    expect(
      screen.getByText(
        "Premium availability and final length are determined by your X account. This is a plain-text long post, not an X Article.",
      ),
    ).toBeInTheDocument();
  });

  it("shows X weighted count separately from the writing target count", () => {
    render(
      <GenerationResults
        copy={getMessages("en")}
        result={{
          format: "candidates",
          contentType: "post",
          candidates: [{ id: "candidate-1", text: "中文" }],
          warnings: [],
          provider: "xai",
          model: "grok-test",
          softCharacterLimit: 280,
        }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/2 \/ 280 · X count: 4/)).toBeInTheDocument();
  });

  it("renders unsafe Provider strings only as editable text", () => {
    render(
      <GenerationResults
        copy={getMessages("en")}
        result={{
          format: "raw",
          contentType: "post",
          rawText: '<script>globalThis.compromised = true</script><img src=x onerror="bad()">',
          warnings: ["RAW_TEXT_FALLBACK"],
          provider: "gemini",
          model: "gemini-test",
        }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Raw Provider result")).toHaveValue(
      '<script>globalThis.compromised = true</script><img src=x onerror="bad()">',
    );
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector("script")).toBeNull();
    expect(screen.queryByRole("button", { name: "Generate image" })).not.toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "Regenerate" })).not.toBeInTheDocument();
  });

  it("offers full regeneration without per-candidate regeneration", () => {
    const onRegenerateAll = vi.fn();
    const result = {
      format: "candidates" as const,
      contentType: "reply" as const,
      candidates: [
        { id: "candidate-1", text: "Keep one" },
        { id: "candidate-2", text: "Replace two" },
      ],
      warnings: [],
      provider: "anthropic" as const,
      model: "test-model",
      softCharacterLimit: 280,
    };

    render(
      <GenerationResults
        copy={getMessages("en")}
        result={result}
        onChange={vi.fn()}
        onRegenerateAll={onRegenerateAll}
      />,
    );

    expect(screen.queryByRole("button", { name: "Regenerate" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Regenerate all" }));
    expect(onRegenerateAll).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("Candidate 1")).toHaveValue("Keep one");
  });
});
