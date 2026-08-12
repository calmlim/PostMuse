import { AppError } from "../core/errors/app-error";
import { getExpectedImageDimensions } from "../core/image/dimensions";
import type { ImageGenerationInput, ImageGenerationResult } from "../core/image/types";

const base64ToBytes = (value: string): Uint8Array => {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
};

export const readImageDimensions = (
  bytes: Uint8Array,
  mimeType: ImageGenerationResult["mimeType"],
): { width: number; height: number } | undefined => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const isPng =
    bytes.length >= 24 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  if (mimeType === "image/png" && isPng) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (mimeType === "image/jpeg" && bytes.length >= 4) {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      if (marker === 0xd8 || marker === 0xd9) {
        offset += 2;
        continue;
      }
      const length = view.getUint16(offset + 2);
      if (length < 2 || offset + length + 2 > bytes.length) {
        return undefined;
      }
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7)) {
        return { width: view.getUint16(offset + 7), height: view.getUint16(offset + 5) };
      }
      offset += length + 2;
    }
  }
  return undefined;
};

export const conformImageOutput = async (
  result: ImageGenerationResult,
  input: ImageGenerationInput,
): Promise<ImageGenerationResult> => {
  const target = getExpectedImageDimensions(result.provider, input.size, input.aspectRatio);
  const bytes = base64ToBytes(result.base64Data);
  const actual = readImageDimensions(bytes, result.mimeType);
  if (actual?.width === target.width && actual.height === target.height) {
    return { ...result, pixelWidth: actual.width, pixelHeight: actual.height };
  }
  if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas === "undefined") {
    throw new AppError(
      "OUTPUT_INVALID",
      `The Provider returned ${actual?.width ?? "unknown"}×${actual?.height ?? "unknown"}; expected ${target.width}×${target.height}.`,
    );
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(
      new Blob([bytes.buffer as ArrayBuffer], { type: result.mimeType }),
    );
  } catch {
    throw new AppError("OUTPUT_INVALID", "The generated image could not be decoded locally.");
  }
  try {
    const targetRatio = target.width / target.height;
    const sourceRatio = bitmap.width / bitmap.height;
    const sourceWidth = sourceRatio > targetRatio ? bitmap.height * targetRatio : bitmap.width;
    const sourceHeight = sourceRatio > targetRatio ? bitmap.height : bitmap.width / targetRatio;
    const sourceX = (bitmap.width - sourceWidth) / 2;
    const sourceY = (bitmap.height - sourceHeight) / 2;
    const canvas = new OffscreenCanvas(target.width, target.height);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new AppError("OUTPUT_INVALID", "The generated image could not be resized locally.");
    }
    context.drawImage(
      bitmap,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      target.width,
      target.height,
    );
    const outputType = "image/png" as const;
    const blob = await canvas.convertToBlob({ type: outputType, quality: 0.94 });
    const outputBytes = new Uint8Array(await blob.arrayBuffer());
    const finalDimensions = readImageDimensions(outputBytes, outputType);
    if (finalDimensions?.width !== target.width || finalDimensions.height !== target.height) {
      throw new AppError(
        "OUTPUT_INVALID",
        `Local image processing returned ${finalDimensions?.width ?? "unknown"}×${finalDimensions?.height ?? "unknown"}; expected ${target.width}×${target.height}.`,
      );
    }
    return {
      ...result,
      mimeType: outputType,
      base64Data: bytesToBase64(outputBytes),
      pixelWidth: finalDimensions.width,
      pixelHeight: finalDimensions.height,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("OUTPUT_INVALID", "The generated image could not be resized locally.");
  } finally {
    bitmap.close();
  }
};
