import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NormalizedTextRequest } from "../../core/generation/types";
import { createDefaultProviderProfile } from "../../core/settings/defaults";
import { PROVIDER_DEFINITIONS } from "../../core/settings/provider-catalog";
import type { ProviderId } from "../../core/settings/types";
import { anthropicAdapter } from "./anthropic";
import { geminiAdapter } from "./gemini";
import { openAICompatibleAdapter } from "./openai-compatible";
import type { TextProviderAdapter } from "./types";
import { xAIAdapter } from "./xai";

const request: NormalizedTextRequest = {
  system: "Return JSON.",
  user: "Source text.",
  schemaName: "post_candidates",
  schema: {
    type: "object",
    properties: { candidates: { type: "array" } },
    required: ["candidates"],
  },
};

const fetchMock = vi.fn();

const profileFor = (provider: ProviderId) => ({
  ...createDefaultProviderProfile(),
  provider,
  displayName: PROVIDER_DEFINITIONS[provider].label,
  baseUrl: PROVIDER_DEFINITIONS[provider].defaultBaseUrl,
  model: "test-model",
});

const generate = (adapter: TextProviderAdapter, provider: ProviderId) =>
  adapter.generate(request, {
    profile: profileFor(provider),
    apiKey: "test-secret-value",
    signal: new AbortController().signal,
  });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("text provider adapters", () => {
  it("maps OpenAI-compatible Chat Completions", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '{"candidates":[]}' } }] }), {
        status: 200,
      }),
    );

    await expect(generate(openAICompatibleAdapter, "openai-compatible")).resolves.toEqual({
      text: '{"candidates":[]}',
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(init.headers).toMatchObject({ authorization: "Bearer test-secret-value" });
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: "test-model",
      max_tokens: 1200,
      messages: [
        { role: "system", content: "Return JSON." },
        { role: "user", content: "Source text." },
      ],
    });
  });

  it("maps Anthropic Messages with a supported temperature", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          stop_reason: "end_turn",
          content: [{ type: "text", text: '{"candidates":[]}' }],
        }),
        { status: 200 },
      ),
    );

    await expect(generate(anthropicAdapter, "anthropic")).resolves.toEqual({
      text: '{"candidates":[]}',
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.headers).toMatchObject({
      "x-api-key": "test-secret-value",
      "anthropic-version": "2023-06-01",
    });
    expect(body.system).toBe("Return JSON.");
    expect(body.temperature).toBe(0.7);
  });

  it("maps Gemini generateContent with header authentication and JSON schema", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: '{"candidates":[]}' }] } }],
        }),
        { status: 200 },
      ),
    );

    await expect(generate(geminiAdapter, "gemini")).resolves.toEqual({
      text: '{"candidates":[]}',
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent",
    );
    expect(init.headers).toMatchObject({ "x-goog-api-key": "test-secret-value" });
    expect(body.generationConfig).toMatchObject({
      responseMimeType: "application/json",
      responseSchema: request.schema,
    });
  });

  it("maps xAI Chat Completions with structured output", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '{"candidates":[]}' } }] }), {
        status: 200,
      }),
    );

    await expect(generate(xAIAdapter, "xai")).resolves.toEqual({
      text: '{"candidates":[]}',
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(url).toBe("https://api.x.ai/v1/chat/completions");
    expect(init.headers).toMatchObject({ authorization: "Bearer test-secret-value" });
    expect(body.response_format).toEqual({
      type: "json_schema",
      json_schema: { name: request.schemaName, strict: true, schema: request.schema },
    });
  });

  it("maps Provider safety refusals to a stable application error", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } }), {
        status: 200,
      }),
    );

    await expect(generate(geminiAdapter, "gemini")).rejects.toMatchObject({
      code: "CONTENT_REJECTED",
    });
  });
});
