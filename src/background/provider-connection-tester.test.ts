import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultProviderProfile } from "../core/settings/defaults";
import { PROVIDER_DEFINITIONS } from "../core/settings/provider-catalog";
import type { ProviderId } from "../core/settings/types";
import { runConnectionTest } from "./provider-connection-tester";

const fetchMock = vi.fn();

const responses: Record<ProviderId, object> = {
  "openai-compatible": { choices: [{ message: { content: '{"ok":true}' } }] },
  anthropic: { stop_reason: "end_turn", content: [{ type: "text", text: '{"ok":true}' }] },
  gemini: { candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] },
  xai: { choices: [{ message: { content: '{"ok":true}' } }] },
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("live Provider connection tester", () => {
  for (const provider of Object.keys(responses) as ProviderId[]) {
    it(`uses a fixed minimal probe for ${provider}`, async () => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify(responses[provider]), { status: 200 }),
      );
      const definition = PROVIDER_DEFINITIONS[provider];
      const profile = {
        ...createDefaultProviderProfile(),
        provider,
        displayName: definition.label,
        baseUrl: definition.defaultBaseUrl,
        model: "connection-model",
        maxOutputTokens: 5000,
      };

      await expect(
        runConnectionTest(profile, "test-secret", new AbortController().signal),
      ).resolves.toMatchObject({ mode: "live", provider, model: "connection-model" });

      const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
      expect(JSON.stringify(body)).toContain("connection test");
      expect(JSON.stringify(body)).not.toContain("PRIVATE_DRAFT_MARKER");
      expect(
        body.max_tokens ?? body.maxOutputTokens ?? body.generationConfig?.maxOutputTokens,
      ).toBe(64);
    });
  }
});
