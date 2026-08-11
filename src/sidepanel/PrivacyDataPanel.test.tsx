import { describe, expect, it } from "vitest";
import { createDefaultSettings } from "../core/settings/defaults";
import { buildLocalDiagnostics } from "./PrivacyDataPanel";

describe("local diagnostics", () => {
  it("contains support metadata without secrets, content, models, or origins", () => {
    const settings = createDefaultSettings();
    settings.textProviderProfiles[0].model = "private-model-name";
    settings.textProviderProfiles[0].baseUrl = "https://private-provider.example";
    const diagnostics = buildLocalDiagnostics({
      snapshot: {
        settings,
        activeSecretStatus: { hasKey: true, persistence: "session" },
        activeImageSecretStatus: { hasKey: false },
      },
      historyCount: 12,
      grantedOriginCount: 2,
      manifest: { version: "0.1.0", manifest_version: 3, content_scripts: [] },
    });

    expect(diagnostics).toMatchObject({
      version: "0.1.0",
      textProvider: "openai-compatible",
      textKeyStored: true,
      historyCount: 12,
      xInlineBuild: false,
    });
    expect(JSON.stringify(diagnostics)).not.toContain("private-model-name");
    expect(JSON.stringify(diagnostics)).not.toContain("private-provider.example");
    expect(JSON.stringify(diagnostics)).not.toContain("apiKey");
  });
});
