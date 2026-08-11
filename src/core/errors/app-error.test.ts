import { describe, expect, it } from "vitest";
import { redactSecrets, toExtensionError } from "./app-error";

describe("error redaction", () => {
  it("removes common key and authorization values", () => {
    const message = redactSecrets(
      "Bearer abc.def-123 sk-supersecret123 AIza123456789012345678901234567890123",
    );
    expect(message).not.toContain("abc.def-123");
    expect(message).not.toContain("supersecret");
    expect(message).not.toContain("AIza");
  });

  it("redacts unexpected errors before returning them", () => {
    expect(toExtensionError(new Error("Failed with sk-privatevalue123"))).toEqual({
      code: "INTERNAL_ERROR",
      message: "Failed with [REDACTED]",
    });
  });
});
