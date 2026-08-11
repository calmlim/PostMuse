import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerationInputFixture } from "../core/generation/fixtures";
import type { GenerationInput, GenerationResult } from "../core/generation/types";
import { getMessages } from "../i18n";
import { listHistoryRecords, saveHistoryRecord } from "../storage/history-repository";
import { createStorageAreaMock } from "../test/chrome-storage";
import { HistoryPanel } from "./HistoryPanel";

const resultFixture = (text: string): GenerationResult => ({
  format: "candidates",
  contentType: "post",
  candidates: [{ id: "candidate-1", text }],
  warnings: [],
  provider: "openai-compatible",
  model: "test-model",
  softCharacterLimit: 280,
});

const renderHistory = (onReuseInput = vi.fn()) => {
  const copy = getMessages("en");
  function Harness() {
    const [revision, setRevision] = useState(0);
    return (
      <HistoryPanel
        copy={copy}
        locale="en"
        revision={revision}
        onHistoryChanged={() => setRevision((current) => current + 1)}
        onReuseInput={onReuseInput}
      />
    );
  }
  render(<Harness />);
};

beforeEach(() => {
  const local = createStorageAreaMock();
  vi.stubGlobal("chrome", { storage: { local } });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe("HistoryPanel", () => {
  it("searches source and result text, copies, and reuses the saved input", async () => {
    const firstInput = createGenerationInputFixture({
      source: { kind: "idea", text: "A launch lesson" },
      candidateCount: 1,
    });
    await saveHistoryRecord(firstInput, resultFixture("A concise launch draft"), {
      recipeVersion: 1,
      styleTemplateVersion: 1,
      now: new Date("2026-08-11T10:00:00.000Z"),
    });
    await saveHistoryRecord(
      createGenerationInputFixture({
        source: { kind: "draft", text: "A quiet reflection" },
        candidateCount: 1,
      }),
      resultFixture("A personal closing"),
      { recipeVersion: 1, styleTemplateVersion: 1 },
    );
    const onReuseInput = vi.fn<(input: GenerationInput) => void>();

    renderHistory(onReuseInput);
    expect(await screen.findByText("A launch lesson")).toBeVisible();

    fireEvent.change(screen.getByLabelText("Search history"), {
      target: { value: "concise launch" },
    });
    expect(screen.getByText("A launch lesson")).toBeVisible();
    expect(screen.queryByText("A quiet reflection")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("A concise launch draft"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Reuse in Create" }));
    expect(onReuseInput).toHaveBeenCalledWith(firstInput);
  });

  it("persists edits, deletes one result, and clears all history", async () => {
    await saveHistoryRecord(
      createGenerationInputFixture({
        source: { kind: "idea", text: "Editable source" },
        candidateCount: 1,
      }),
      resultFixture("Original result"),
      { recipeVersion: 1, styleTemplateVersion: 1 },
    );
    await saveHistoryRecord(
      createGenerationInputFixture({
        source: { kind: "idea", text: "Second source" },
        candidateCount: 1,
      }),
      resultFixture("Second result"),
      { recipeVersion: 1, styleTemplateVersion: 1 },
    );

    renderHistory();
    expect(await screen.findByText("Editable source")).toBeVisible();
    const editableCard = screen.getByText("Editable source").closest("article");
    expect(editableCard).not.toBeNull();
    fireEvent.click(
      within(editableCard as HTMLElement).getByRole("button", { name: "Open and edit" }),
    );
    fireEvent.change(screen.getByLabelText("Candidate 1"), {
      target: { value: "Edited result" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(async () =>
      expect((await listHistoryRecords())[0].result).toMatchObject({
        candidates: [{ text: "Edited result" }],
      }),
    );

    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    fireEvent.click(deleteButtons[0]);
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    await waitFor(async () => expect(await listHistoryRecords()).toHaveLength(1));

    fireEvent.click(await screen.findByRole("button", { name: "Clear history" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear history" }));
    await waitFor(async () => expect(await listHistoryRecords()).toEqual([]));
    expect(await screen.findByText("No saved results yet")).toBeVisible();
  });

  it("stores the save-history toggle without deleting existing records", async () => {
    await saveHistoryRecord(
      createGenerationInputFixture({ candidateCount: 1 }),
      resultFixture("Keep me"),
      {
        recipeVersion: 1,
        styleTemplateVersion: 1,
      },
    );

    renderHistory();
    const toggle = await screen.findByRole("checkbox", { name: /Save new results/ });
    fireEvent.click(toggle);

    expect(toggle).not.toBeChecked();
    expect(
      screen.getByText("New results will not be saved. Existing history remains available."),
    ).toBeVisible();
    expect(await listHistoryRecords()).toHaveLength(1);
  });
});
