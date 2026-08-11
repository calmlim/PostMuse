import { describe, expect, it, vi } from "vitest";
import { fetchWithPolicy } from "./http";

const requestInit: RequestInit = { method: "POST" };

describe("provider fetch policy", () => {
  it("does not retry authentication failures", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 401 }));

    await expect(
      fetchWithPolicy("https://api.example.com/v1", requestInit, new AbortController().signal, {
        fetchImpl,
      }),
    ).rejects.toMatchObject({ code: "AUTH_INVALID" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries 429 responses at most twice and then succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 429, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(new Response("", { status: 429, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    await expect(
      fetchWithPolicy("https://api.example.com/v1", requestInit, new AbortController().signal, {
        fetchImpl,
      }),
    ).resolves.toBeInstanceOf(Response);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("uses manual redirects and rejects redirect responses", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response("", {
        status: 302,
        headers: { location: "https://evil.example.com/collect" },
      }),
    );

    await expect(
      fetchWithPolicy("https://api.example.com/v1", requestInit, new AbortController().signal, {
        fetchImpl,
      }),
    ).rejects.toMatchObject({ code: "ENDPOINT_NOT_FOUND" });
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ redirect: "manual" });
  });

  it("maps user abort to request cancellation", async () => {
    const parentController = new AbortController();
    const fetchImpl = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );

    const pending = fetchWithPolicy(
      "https://api.example.com/v1",
      requestInit,
      parentController.signal,
      {
        fetchImpl: fetchImpl as typeof fetch,
        maxRetries: 0,
      },
    );
    parentController.abort();

    await expect(pending).rejects.toMatchObject({ code: "REQUEST_CANCELLED" });
  });

  it("maps an expired request deadline to a timeout", async () => {
    const fetchImpl = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );

    await expect(
      fetchWithPolicy("https://api.example.com/v1", requestInit, new AbortController().signal, {
        fetchImpl: fetchImpl as typeof fetch,
        maxRetries: 0,
        timeoutMs: 1,
      }),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
  });
});
