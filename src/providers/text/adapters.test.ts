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

const request = {
  system: "Return JSON.",
  user: "Source text.",
  outputMode: "structured",
  schemaName: "post_candidates",
  schema: {
    type: "object",
    properties: { candidates: { type: "array" } },
    required: ["candidates"],
  },
} satisfies NormalizedTextRequest;

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
    purpose: "generation",
  });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("text provider adapters", () => {
  it("uses official OpenAI token and Structured Output fields without default temperature", async () => {
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
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      model: "test-model",
      max_completion_tokens: 1200,
      messages: [
        { role: "system", content: "Return JSON." },
        { role: "user", content: "Source text." },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: request.schemaName, strict: true, schema: request.schema },
      },
    });
    expect(body).not.toHaveProperty("max_tokens");
    expect(body).not.toHaveProperty("temperature");
  });

  it("keeps generic OpenAI-compatible fields and sends custom temperature only when selected", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '{"candidates":[]}' } }] }), {
        status: 200,
      }),
    );
    await openAICompatibleAdapter.generate(request, {
      profile: {
        ...profileFor("openai-compatible"),
        baseUrl: "https://llm.example.com/api",
        samplingMode: "custom",
        temperature: 1.1,
      },
      apiKey: "test-secret-value",
      signal: new AbortController().signal,
      purpose: "generation",
    });
    expect(fetchMock.mock.calls[0][0]).toBe("https://llm.example.com/api/chat/completions");
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body).toMatchObject({ max_tokens: 1200, temperature: 1.1 });
    expect(body).not.toHaveProperty("max_completion_tokens");
    expect(body).not.toHaveProperty("response_format");
  });

  it("uses legacy Chat Completions fields for older official OpenAI models", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '{"candidates":[]}' } }] }), {
        status: 200,
      }),
    );

    await openAICompatibleAdapter.generate(request, {
      profile: { ...profileFor("openai-compatible"), model: "gpt-4-turbo" },
      apiKey: "test-secret-value",
      signal: new AbortController().signal,
      purpose: "generation",
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body).toMatchObject({ max_tokens: 1200 });
    expect(body).not.toHaveProperty("max_completion_tokens");
    expect(body).not.toHaveProperty("response_format");
  });

  it("maps Anthropic Messages without a temperature override", async () => {
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
    expect(body).not.toHaveProperty("temperature");
  });

  it("maps Gemini Interactions with transient storage and JSON schema", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "completed",
          steps: [{ type: "model_output", content: [{ type: "text", text: '{"candidates":[]}' }] }],
        }),
        { status: 200 },
      ),
    );

    await expect(generate(geminiAdapter, "gemini")).resolves.toEqual({
      text: '{"candidates":[]}',
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/interactions");
    expect(init.headers).toMatchObject({ "x-goog-api-key": "test-secret-value" });
    expect(body).toMatchObject({
      model: "test-model",
      input: "Source text.",
      system_instruction: "Return JSON.",
      store: false,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: request.schema,
      },
      generation_config: { max_output_tokens: 1200 },
    });
    expect(body.generation_config).not.toHaveProperty("temperature");
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
    expect(body).not.toHaveProperty("temperature");
  });

  it("sends xAI temperature only in custom sampling mode", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '{"candidates":[]}' } }] }), {
        status: 200,
      }),
    );
    await xAIAdapter.generate(request, {
      profile: { ...profileFor("xai"), samplingMode: "custom", temperature: 0.4 },
      apiKey: "test-secret-value",
      signal: new AbortController().signal,
      purpose: "generation",
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toMatchObject({
      temperature: 0.4,
    });
  });

  it("uses lean plain-text requests for translation across all adapters", async () => {
    const translationRequest = {
      system: "Translate to French. Output only the translation.",
      user: JSON.stringify("Hello"),
      outputMode: "plain-text",
      maxOutputTokens: 96,
      suppressCustomSampling: true,
    } satisfies NormalizedTextRequest;
    const context = (provider: ProviderId) => ({
      profile: {
        ...profileFor(provider),
        samplingMode: "custom" as const,
        temperature: 1.2,
      },
      apiKey: "test-secret-value",
      signal: new AbortController().signal,
      purpose: "translation" as const,
    });

    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: "Bonjour" } }] }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text: "Bonjour" }] }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "completed",
            steps: [{ type: "model_output", content: [{ type: "text", text: "Bonjour" }] }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: "Bonjour" } }] }), {
          status: 200,
        }),
      );

    await openAICompatibleAdapter.generate(translationRequest, context("openai-compatible"));
    await anthropicAdapter.generate(translationRequest, context("anthropic"));
    await geminiAdapter.generate(translationRequest, context("gemini"));
    await xAIAdapter.generate(translationRequest, context("xai"));

    const bodies = fetchMock.mock.calls.map((call) => JSON.parse(String(call[1].body)));
    expect(bodies[0]).toMatchObject({ max_completion_tokens: 96 });
    expect(bodies[0]).not.toHaveProperty("response_format");
    expect(bodies[0]).not.toHaveProperty("temperature");
    expect(bodies[1]).toMatchObject({ max_tokens: 96 });
    expect(bodies[2].response_format).toEqual({ type: "text", mime_type: "text/plain" });
    expect(bodies[2].response_format).not.toHaveProperty("schema");
    expect(bodies[2].generation_config).toEqual({ max_output_tokens: 96 });
    expect(bodies[3]).toMatchObject({ max_tokens: 96 });
    expect(bodies[3]).not.toHaveProperty("response_format");
    expect(bodies[3]).not.toHaveProperty("temperature");
  });

  it("maps Provider safety refusals to a stable application error", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: "failed", steps: [] }), {
        status: 200,
      }),
    );

    await expect(generate(geminiAdapter, "gemini")).rejects.toMatchObject({
      code: "CONTENT_REJECTED",
    });
  });
});
