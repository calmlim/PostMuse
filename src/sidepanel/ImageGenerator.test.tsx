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
      expect.objectContaining({ type: "image", provider: "openai" }),
    );

    fireEvent.change(screen.getByLabelText("Aspect ratio"), { target: { value: "16:9" } });
    expect(screen.queryByRole("img", { name: "Image ready" })).not.toBeInTheDocument();

    unmount();
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:postmuse-image"));
  });
});
