import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ImageGenerationInput } from "../../core/image/types";
import { createDefaultImageProviderProfile } from "../../core/settings/defaults";
import { IMAGE_PROVIDER_DEFINITIONS } from "../../core/settings/provider-catalog";
import type { ImageProviderId } from "../../core/settings/types";
import { geminiImageAdapter } from "./gemini";
import { openAIImageAdapter } from "./openai";
import type { ImageProviderAdapter } from "./types";

const input: ImageGenerationInput = {
  sourceText: "A product lesson",
  prompt: "A clean editorial illustration",
  style: "editorial",
  aspectRatio: "16:9",
  size: "2K",
  includeText: false,
};
const fetchMock = vi.fn();

const profileFor = (provider: ImageProviderId) => ({
  ...createDefaultImageProviderProfile(),
  provider,
  displayName: IMAGE_PROVIDER_DEFINITIONS[provider].label,
  baseUrl: IMAGE_PROVIDER_DEFINITIONS[provider].defaultBaseUrl,
  model: "test-image-model",
});

const generate = (adapter: ImageProviderAdapter, provider: ImageProviderId) =>
  adapter.generate(input, {
    profile: profileFor(provider),
    apiKey: "test-image-secret",
    signal: new AbortController().signal,
  });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("image provider adapters", () => {
  it("maps OpenAI Images generation and its 2K landscape size", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ data: [{ b64_json: "b3BlbmFpLWltYWdl" }] }), {
        status: 200,
      }),
    );

    await expect(generate(openAIImageAdapter, "openai")).resolves.toMatchObject({
      provider: "openai",
      mimeType: "image/png",
      base64Data: "b3BlbmFpLWltYWdl",
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/images/generations");
    expect(init.headers).toMatchObject({ authorization: "Bearer test-image-secret" });
    expect(JSON.parse(String(init.body))).toEqual({
      model: "test-image-model",
      prompt: expect.stringContaining(
        "Required output canvas: 16:9 aspect ratio, 2048×1152 pixels",
      ),
      n: 1,
      size: "2048x1152",
      output_format: "png",
    });
  });

  it("maps Gemini Interactions image output and capability fields", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "completed",
          steps: [
            {
              type: "model_output",
              content: [
                { type: "text", text: "Done" },
                { type: "image", data: "Z2VtaW5pLWltYWdl", mime_type: "image/jpeg" },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await expect(generate(geminiImageAdapter, "gemini")).resolves.toMatchObject({
      provider: "gemini",
      mimeType: "image/jpeg",
      base64Data: "Z2VtaW5pLWltYWdl",
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/interactions");
    expect(init.headers).toMatchObject({ "x-goog-api-key": "test-image-secret" });
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: "test-image-model",
      input: expect.stringContaining("Required output canvas: 16:9 aspect ratio, 2752×1536 pixels"),
      response_format: {
        type: "image",
        mime_type: "image/png",
        aspect_ratio: "16:9",
        image_size: "2K",
      },
    });
  });

  it("rejects a successful response without image bytes", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: "completed", steps: [] }), { status: 200 }),
    );

    await expect(generate(geminiImageAdapter, "gemini")).rejects.toMatchObject({
      code: "OUTPUT_INVALID",
    });
  });
});
