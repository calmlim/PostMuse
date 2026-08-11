import { afterEach, describe, expect, it, vi } from "vitest";
import { supportsInsecureLocalhost } from "./runtime-capabilities";

afterEach(() => vi.unstubAllGlobals());

describe("runtime capabilities", () => {
  it("enables localhost only when the current manifest declares it", () => {
    vi.stubGlobal("chrome", {
      runtime: {
        getManifest: () => ({ optional_host_permissions: ["http://localhost/*"] }),
      },
    });
    expect(supportsInsecureLocalhost()).toBe(true);

    vi.stubGlobal("chrome", {
      runtime: { getManifest: () => ({ optional_host_permissions: ["https://*/*"] }) },
    });
    expect(supportsInsecureLocalhost()).toBe(false);
  });
});
