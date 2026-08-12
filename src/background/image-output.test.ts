import { afterEach, describe, expect, it, vi } from "vitest";
import type { ImageGenerationInput, ImageGenerationResult } from "../core/image/types";
import { conformImageOutput, readImageDimensions } from "./image-output";

const pngHeader = (width: number, height: number): Uint8Array => {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
};

const toBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));

const input: ImageGenerationInput = {
  sourceText: "Source",
  prompt: "Prompt",
  style: "editorial",
  aspectRatio: "16:9",
  size: "1K",
  includeText: false,
};

const result = (width: number, height: number): ImageGenerationResult => ({
  provider: "openai",
  model: "gpt-image-2",
  prompt: input.prompt,
  aspectRatio: input.aspectRatio,
  size: input.size,
  mimeType: "image/png",
  base64Data: toBase64(pngHeader(width, height)),
});

afterEach(() => vi.unstubAllGlobals());

describe("image output conformance", () => {
  it("reads PNG dimensions and preserves an output that already matches", async () => {
    expect(readImageDimensions(pngHeader(1536, 864), "image/png")).toEqual({
      width: 1536,
      height: 864,
    });
    await expect(conformImageOutput(result(1536, 864), input)).resolves.toMatchObject({
      pixelWidth: 1536,
      pixelHeight: 864,
    });
  });

  it("center-crops and resizes a square Provider output to the requested canvas", async () => {
    const drawImage = vi.fn();
    const close = vi.fn();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 1254, height: 1254, close }),
    );
    vi.stubGlobal(
      "OffscreenCanvas",
      class {
        constructor(
          public width: number,
          public height: number,
        ) {}
        getContext() {
          return { drawImage };
        }
        async convertToBlob() {
          return new Blob([pngHeader(this.width, this.height).buffer as ArrayBuffer], {
            type: "image/png",
          });
        }
      },
    );

    await expect(conformImageOutput(result(1254, 1254), input)).resolves.toMatchObject({
      pixelWidth: 1536,
      pixelHeight: 864,
      mimeType: "image/png",
    });
    expect(drawImage).toHaveBeenCalledWith(
      expect.anything(),
      0,
      expect.closeTo(274.3125),
      1254,
      expect.closeTo(705.375),
      0,
      0,
      1536,
      864,
    );
    expect(close).toHaveBeenCalledOnce();
  });

  it("rejects a local output whose encoded pixels do not match the target", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 1254, height: 1254, close: vi.fn() }),
    );
    vi.stubGlobal(
      "OffscreenCanvas",
      class {
        getContext() {
          return { drawImage: vi.fn() };
        }
        async convertToBlob() {
          return new Blob([pngHeader(100, 100).buffer as ArrayBuffer], { type: "image/png" });
        }
      },
    );

    await expect(conformImageOutput(result(1254, 1254), input)).rejects.toMatchObject({
      code: "OUTPUT_INVALID",
    });
  });
});
