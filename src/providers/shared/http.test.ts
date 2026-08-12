import { describe, expect, it, vi } from "vitest";
import { fetchJsonWithPolicy } from "./http";

const requestInit: RequestInit = { method: "POST" };

describe("provider fetch policy", () => {
  it("does not retry authentication failures", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 401 }));

    await expect(
      fetchJsonWithPolicy("https://api.example.com/v1", requestInit, new AbortController().signal, {
        fetchImpl,
      }),
    ).rejects.toMatchObject({ code: "AUTH_INVALID" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not retry rate-limit responses", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 429, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(new Response("", { status: 429, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    await expect(
      fetchJsonWithPolicy("https://api.example.com/v1", requestInit, new AbortController().signal, {
        fetchImpl,
      }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      "server errors",
      vi.fn().mockResolvedValue(new Response("", { status: 503 })),
      "PROVIDER_UNAVAILABLE",
    ],
    ["network failures", vi.fn().mockRejectedValue(new TypeError("offline")), "NETWORK_ERROR"],
  ])("does not retry %s", async (_label, fetchImpl, code) => {
    await expect(
      fetchJsonWithPolicy("https://api.example.com/v1", requestInit, new AbortController().signal, {
        fetchImpl,
      }),
    ).rejects.toMatchObject({ code });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("uses manual redirects and rejects redirect responses", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response("", {
        status: 302,
        headers: { location: "https://evil.example.com/collect" },
      }),
    );

    await expect(
      fetchJsonWithPolicy("https://api.example.com/v1", requestInit, new AbortController().signal, {
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

    const pending = fetchJsonWithPolicy(
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
      fetchJsonWithPolicy("https://api.example.com/v1", requestInit, new AbortController().signal, {
        fetchImpl: fetchImpl as typeof fetch,
        maxRetries: 0,
        timeoutMs: 1,
      }),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("keeps user cancellation active while the response body is being read", async () => {
    const parentController = new AbortController();
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const signal = init.signal;
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () =>
          new Promise((_resolve, reject) => {
            signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      } as Response;
    });

    const pending = fetchJsonWithPolicy(
      "https://api.example.com/v1",
      requestInit,
      parentController.signal,
      { fetchImpl: fetchImpl as typeof fetch },
    );
    await Promise.resolve();
    parentController.abort();

    await expect(pending).rejects.toMatchObject({ code: "REQUEST_CANCELLED" });
  });

  it("keeps the deadline active while the response body is being read", async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const signal = init.signal;
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () =>
          new Promise((_resolve, reject) => {
            signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      } as Response;
    });

    await expect(
      fetchJsonWithPolicy("https://api.example.com/v1", requestInit, new AbortController().signal, {
        fetchImpl: fetchImpl as typeof fetch,
        timeoutMs: 1,
      }),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("maps an invalid JSON body to an output error", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("not-json", { status: 200 }));

    await expect(
      fetchJsonWithPolicy("https://api.example.com/v1", requestInit, new AbortController().signal, {
        fetchImpl,
      }),
    ).rejects.toMatchObject({ code: "OUTPUT_INVALID" });
  });
});
