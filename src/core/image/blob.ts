import type { ImageGenerationResult } from "./types";

export const imageResultToBytes = (result: ImageGenerationResult): Uint8Array => {
  const binary = atob(result.base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

export const imageResultToBlob = (result: ImageGenerationResult): Blob =>
  new Blob([imageResultToBytes(result).buffer as ArrayBuffer], { type: result.mimeType });
