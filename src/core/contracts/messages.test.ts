import { describe, expect, it } from "vitest";
import { createDefaultProviderProfile } from "../settings/defaults";
import { createGenerationInputFixture } from "../generation/fixtures";
import { isExtensionRequest } from "./messages";

describe("extension message validation", () => {
  it("accepts known typed envelopes", () => {
    expect(isExtensionRequest({ type: "settings.get", requestId: "request-1" })).toBe(true);
    expect(
      isExtensionRequest({
        type: "settings.saveProfile",
        requestId: "request-2",
        profile: createDefaultProviderProfile(),
        apiKey: "sk-test",
      }),
    ).toBe(true);
    expect(
      isExtensionRequest({
        type: "text.generate",
        requestId: "request-3",
        input: createGenerationInputFixture(),
      }),
    ).toBe(true);
  });

  it("rejects unknown, malformed and oversized messages", () => {
    expect(isExtensionRequest({ type: "secrets.get", requestId: "request-1" })).toBe(false);
    expect(isExtensionRequest({ type: "provider.test", requestId: "", profileId: "p" })).toBe(
      false,
    );
    expect(
      isExtensionRequest({
        type: "settings.saveProfile",
        requestId: "request-2",
        profile: createDefaultProviderProfile(),
        apiKey: "x".repeat(2049),
      }),
    ).toBe(false);
    expect(
      isExtensionRequest({
        type: "text.cancel",
        requestId: "request-4",
        targetRequestId: "",
      }),
    ).toBe(false);
  });
});
