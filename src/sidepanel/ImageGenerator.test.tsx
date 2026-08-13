import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultSettings } from "../core/settings/defaults";
import { getMessages } from "../i18n";
import { ImageGenerator } from "./ImageGenerator";

const sendMessage = vi.fn();
const permissionRequest = vi.fn();
const createObjectURL = vi.fn();
const revokeObjectURL = vi.fn();

beforeEach(() => {
  sendMessage.mockReset();
  permissionRequest.mockReset();
  createObjectURL.mockReset();
  revokeObjectURL.mockReset();
  permissionRequest.mockResolvedValue(true);
  createObjectURL.mockReturnValue("blob:postmuse-image");
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
  vi.stubGlobal("chrome", {
    runtime: { sendMessage },
    permissions: { request: permissionRequest },
  });
});

describe("ImageGenerator", () => {
  it("generates one preview, reports metadata and revokes its object URL", async () => {
    sendMessage.mockResolvedValue({
      ok: true,
      data: {
        provider: "openai",
        model: "gpt-image-2",
        prompt: "A companion image",
        aspectRatio: "1:1",
        size: "1K",
        mimeType: "image/png",
        base64Data: "aW1hZ2U=",
        pixelWidth: 1024,
        pixelHeight: 1024,
      },
    });
    const onGenerated = vi.fn();
    const settings = createDefaultSettings();
    const { unmount } = render(
      <ImageGenerator
        copy={getMessages("en")}
        sourceText="A useful product lesson"
        snapshot={{
          settings,
          activeSecretStatus: { hasKey: false },
          activeImageSecretStatus: { hasKey: true, persistence: "session" },
        }}
        onOpenSettings={vi.fn()}
        onClose={vi.fn()}
        onGenerated={onGenerated}
      />,
    );

    expect((screen.getByLabelText("Image prompt") as HTMLTextAreaElement).value).toContain(
      "A useful product lesson",
    );
    fireEvent.click(screen.getByRole("button", { name: "Generate image" }));

    expect(await screen.findByRole("img", { name: "Image ready" })).toHaveAttribute(
      "src",
      "blob:postmuse-image",
    );
    expect(screen.getByText("Image ready · 1:1 · 1K · 1024×1024")).toBeInTheDocument();
    expect(permissionRequest).toHaveBeenCalledWith({ origins: ["https://api.openai.com/*"] });
    expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "image.generate" }));
    expect(onGenerated).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "openai", base64Data: "aW1hZ2U=" }),
      expect.objectContaining({ sourceText: "A useful product lesson", style: "editorial" }),
    );

    fireEvent.change(screen.getByLabelText("Aspect ratio"), { target: { value: "16:9" } });
    expect(screen.queryByRole("img", { name: "Image ready" })).not.toBeInTheDocument();

    unmount();
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:postmuse-image"));
  });

  it("generates a standalone image from a description without a text draft", async () => {
    sendMessage.mockResolvedValue({
      ok: true,
      data: {
        provider: "openai",
        model: "gpt-image-2",
        prompt: "Standalone image prompt",
        aspectRatio: "1:1",
        size: "1K",
        mimeType: "image/png",
        base64Data: "aW1hZ2U=",
      },
    });
    const settings = createDefaultSettings();
    render(
      <ImageGenerator
        copy={getMessages("en")}
        sourceText=""
        snapshot={{
          settings,
          activeSecretStatus: { hasKey: false },
          activeImageSecretStatus: { hasKey: true, persistence: "session" },
        }}
        onOpenSettings={vi.fn()}
        onClose={vi.fn()}
        mode="standalone"
      />,
    );

    expect(screen.getByRole("heading", { name: "Create an image" })).toBeVisible();
    fireEvent.change(screen.getByLabelText("Image description"), {
      target: { value: "A red paper boat crossing a quiet blue lake" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate image" }));

    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "image.generate",
          input: expect.objectContaining({
            sourceText: "A red paper boat crossing a quiet blue lake",
            prompt: expect.stringContaining("<IMAGE_DESCRIPTION>"),
          }),
        }),
      ),
    );
  });

  it("restores complete settings for an image-history draft without generating", () => {
    const settings = createDefaultSettings();
    render(
      <ImageGenerator
        copy={getMessages("en")}
        sourceText=""
        snapshot={{
          settings,
          activeSecretStatus: { hasKey: false },
          activeImageSecretStatus: { hasKey: true, persistence: "session" },
        }}
        onOpenSettings={vi.fn()}
        onClose={vi.fn()}
        mode="standalone"
        initialInput={{
          sourceText: "A restored paper boat",
          prompt: "Previously expanded Provider prompt",
          style: "illustration",
          aspectRatio: "16:9",
          size: "2K",
          includeText: true,
        }}
      />,
    );

    expect(screen.getByLabelText("Image description")).toHaveValue("A restored paper boat");
    expect(screen.getByLabelText("Visual style")).toHaveValue("illustration");
    expect(screen.getByLabelText("Aspect ratio")).toHaveValue("16:9");
    expect(screen.getByLabelText("Resolution")).toHaveValue("2K");
    expect(
      screen.getByRole("checkbox", { name: "Allow short text inside the image" }),
    ).toBeChecked();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("keeps the image preview and reports a non-blocking history save failure", async () => {
    sendMessage.mockResolvedValue({
      ok: true,
      data: {
        provider: "openai",
        model: "gpt-image-2",
        prompt: "Saved image prompt",
        aspectRatio: "1:1",
        size: "1K",
        mimeType: "image/png",
        base64Data: "aW1hZ2U=",
      },
    });
    const settings = createDefaultSettings();
    render(
      <ImageGenerator
        copy={getMessages("en")}
        sourceText="A useful lesson"
        snapshot={{
          settings,
          activeSecretStatus: { hasKey: false },
          activeImageSecretStatus: { hasKey: true, persistence: "session" },
        }}
        onOpenSettings={vi.fn()}
        onClose={vi.fn()}
        onGenerated={vi.fn().mockRejectedValue(new Error("IndexedDB failed"))}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate image" }));
    expect(await screen.findByRole("img", { name: "Image ready" })).toBeVisible();
    expect(
      screen.getByText("The result is ready, but it could not be saved to local history."),
    ).toBeVisible();
  });

  it("cancels an active request when the image panel closes", async () => {
    let resolveGeneration: ((value: unknown) => void) | undefined;
    sendMessage.mockImplementation((request: { type: string }) =>
      request.type === "image.generate"
        ? new Promise((resolve) => {
            resolveGeneration = resolve;
          })
        : Promise.resolve({ ok: true, data: { cancelled: true } }),
    );
    const settings = createDefaultSettings();
    const onClose = vi.fn();
    render(
      <ImageGenerator
        copy={getMessages("en")}
        sourceText="A useful lesson"
        snapshot={{
          settings,
          activeSecretStatus: { hasKey: false },
          activeImageSecretStatus: { hasKey: true, persistence: "session" },
        }}
        onOpenSettings={vi.fn()}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate image" }));
    await waitFor(() =>
      expect(sendMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "image.generate" })),
    );
    fireEvent.click(screen.getByRole("button", { name: "Close PostMuse" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "image.cancel", targetRequestId: expect.any(String) }),
    );
    resolveGeneration?.({ ok: false, error: { code: "REQUEST_CANCELLED", message: "cancelled" } });
  });
});
