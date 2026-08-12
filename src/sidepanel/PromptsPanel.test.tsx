import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMessages } from "../i18n";
import { createStorageAreaMock, type StorageAreaMock } from "../test/chrome-storage";
import { PROMPT_LIBRARY_STORAGE_KEY } from "../storage/prompt-repository";
import { CREATION_PREFERENCES_STORAGE_KEY } from "../storage/creation-preferences";
import { WRITING_PROFILE_STORAGE_KEY } from "../storage/writing-profile-repository";
import { PromptsPanel } from "./PromptsPanel";

let local: StorageAreaMock;

beforeEach(() => {
  local = createStorageAreaMock();
  vi.stubGlobal("chrome", { storage: { local } });
  vi.stubGlobal("crypto", { randomUUID: () => "component-test-id" });
});

describe("PromptsPanel", () => {
  it("shows an inert example and saves only user-entered profile text", async () => {
    const onPromptsChanged = vi.fn();
    render(<PromptsPanel copy={getMessages("en")} onPromptsChanged={onPromptsChanged} />);

    const profile = await screen.findByLabelText("About you and your voice");
    expect(profile).toHaveValue("");
    expect(profile).toHaveAttribute("placeholder", expect.stringContaining("Example only"));
    expect(local.data[WRITING_PROFILE_STORAGE_KEY]).toBeUndefined();

    fireEvent.change(profile, { target: { value: "I build practical AI tools and avoid hype." } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByText("Writing profile saved.")).toBeVisible();
    expect(local.data[WRITING_PROFILE_STORAGE_KEY]).toBe(
      "I build practical AI tools and avoid hype.",
    );
    expect(onPromptsChanged).toHaveBeenCalledTimes(1);
  });

  it("edits and restores a built-in style override", async () => {
    const onPromptsChanged = vi.fn();
    render(<PromptsPanel copy={getMessages("en")} onPromptsChanged={onPromptsChanged} />);

    expect(await screen.findByText("Professional")).toBeVisible();
    fireEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "My professional voice" },
    });
    fireEvent.change(screen.getByLabelText("Style instructions"), {
      target: { value: "Use concrete operator details." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save style" }));

    expect(await screen.findByText("My professional voice")).toBeVisible();
    expect(screen.getByText(/Built-in · Modified/)).toBeVisible();
    expect(onPromptsChanged).toHaveBeenCalledTimes(1);
    expect(local.data[PROMPT_LIBRARY_STORAGE_KEY]).toMatchObject({
      overrides: [
        expect.objectContaining({
          styleId: "professional",
          instruction: "Use concrete operator details.",
        }),
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(await screen.findByText("Built-in style restored.")).toBeVisible();
    expect(screen.getByText("Professional")).toBeVisible();
    expect(local.data[PROMPT_LIBRARY_STORAGE_KEY]).toMatchObject({ overrides: [] });
  });

  it("creates and deletes a custom style with inline confirmation", async () => {
    render(<PromptsPanel copy={getMessages("en")} onPromptsChanged={vi.fn()} />);
    await screen.findByText("Professional");

    fireEvent.click(screen.getByRole("button", { name: "New style" }));
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Founder notes" },
    });
    fireEvent.change(screen.getByLabelText("Style instructions"), {
      target: { value: "Write from firsthand experience." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save style" }));

    const customCard = (await screen.findByText("Founder notes")).closest("article");
    expect(customCard).not.toBeNull();
    fireEvent.click(within(customCard as HTMLElement).getByRole("button", { name: "Delete" }));
    fireEvent.click(within(customCard as HTMLElement).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(screen.queryByText("Founder notes")).not.toBeInTheDocument());
    expect(local.data[PROMPT_LIBRARY_STORAGE_KEY]).toMatchObject({ customTemplates: [] });
  });

  it("hides and recovers a built-in style", async () => {
    render(<PromptsPanel copy={getMessages("en")} onPromptsChanged={vi.fn()} />);
    const professional = (await screen.findByText("Professional")).closest("article");

    fireEvent.click(within(professional as HTMLElement).getByRole("button", { name: "Hide" }));
    expect(await screen.findByRole("heading", { name: "Hidden built-in styles" })).toBeVisible();
    const hiddenSection = screen.getByRole("heading", {
      name: "Hidden built-in styles",
    }).parentElement;
    fireEvent.click(within(hiddenSection as HTMLElement).getByRole("button", { name: "Restore" }));

    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Hidden built-in styles" }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Professional")).toBeVisible();
  });

  it("sets the default style used by new creation surfaces", async () => {
    render(<PromptsPanel copy={getMessages("en")} onPromptsChanged={vi.fn()} />);
    const concise = (await screen.findByText("Concise")).closest("article");

    fireEvent.click(within(concise as HTMLElement).getByRole("button", { name: "Set as default" }));

    expect(await screen.findByText("Default style updated.")).toBeVisible();
    expect(local.data[CREATION_PREFERENCES_STORAGE_KEY]).toMatchObject({
      defaultStyleId: "concise",
    });
    expect(within(concise as HTMLElement).getByRole("button", { name: "Default" })).toBeDisabled();
  });
});
