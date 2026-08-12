import { describe, expect, it } from "vitest";
import { getExpectedImageDimensions, getOpenAIRequestDimensions } from "./dimensions";

describe("image dimensions", () => {
  it("uses legacy native sizes for OpenAI image models before GPT Image 2", () => {
    expect(
      (["1:1", "16:9", "9:16"] as const).map((ratio) =>
        getOpenAIRequestDimensions("gpt-image-1.5", "2K", ratio),
      ),
    ).toEqual([
      { width: 1024, height: 1024 },
      { width: 1536, height: 1024 },
      { width: 1024, height: 1536 },
    ]);
  });

  it("uses exact final dimensions for GPT Image 2", () => {
    expect(getOpenAIRequestDimensions("gpt-image-2", "2K", "16:9")).toEqual({
      width: 2048,
      height: 1152,
    });
  });

  it("keeps six OpenAI final canvases independent from request size", () => {
    expect(getExpectedImageDimensions("openai", "1K", "1:1")).toEqual({
      width: 1024,
      height: 1024,
    });
    expect(getExpectedImageDimensions("openai", "1K", "16:9")).toEqual({
      width: 1536,
      height: 864,
    });
    expect(getExpectedImageDimensions("openai", "1K", "9:16")).toEqual({
      width: 864,
      height: 1536,
    });
    expect(getExpectedImageDimensions("openai", "2K", "1:1")).toEqual({
      width: 2048,
      height: 2048,
    });
    expect(getExpectedImageDimensions("openai", "2K", "16:9")).toEqual({
      width: 2048,
      height: 1152,
    });
    expect(getExpectedImageDimensions("openai", "2K", "9:16")).toEqual({
      width: 1152,
      height: 2048,
    });
  });
});
