import { AppError } from "../../core/errors/app-error";

const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_RETRIES = 0;

const waitFor = (durationMs: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new AppError("REQUEST_CANCELLED", "Generation was cancelled."));
      return;
    }

    const onAbort = () => {
      clearTimeout(timer);
      reject(new AppError("REQUEST_CANCELLED", "Generation was cancelled."));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, durationMs);
    signal.addEventListener("abort", onAbort, { once: true });
  });

const getRetryDelay = (response: Response, attempt: number): number => {
  const retryAfter = response.headers.get("retry-after");
  const seconds = retryAfter ? Number(retryAfter) : Number.NaN;
  if (Number.isFinite(seconds)) {
    return Math.min(Math.max(seconds * 1_000, 0), 5_000);
  }

  return 500 * 2 ** attempt;
};

const mapHttpError = (response: Response): AppError => {
  if (response.status === 401) {
    return new AppError("AUTH_INVALID", "The Provider rejected the API key.");
  }
  if (response.status === 403) {
    return new AppError("MODEL_FORBIDDEN", "This API key cannot access the selected model.");
  }
  if (response.status === 404) {
    return new AppError("MODEL_NOT_FOUND", "The model or Provider endpoint was not found.");
  }
  if (response.status === 408) {
    return new AppError("TIMEOUT", "The Provider request timed out.");
  }
  if (response.status === 429) {
    return new AppError("RATE_LIMITED", "The Provider rate limit or quota was reached.");
  }
  if (response.status >= 500) {
    return new AppError("PROVIDER_UNAVAILABLE", "The Provider is temporarily unavailable.");
  }
  if (response.status >= 300 && response.status < 400) {
    return new AppError("ENDPOINT_NOT_FOUND", "The Provider attempted an unsafe redirect.");
  }

  return new AppError("PROVIDER_REQUEST_INVALID", "The Provider rejected the request.");
};

interface FetchPolicyOptions {
  timeoutMs?: number;
  maxRetries?: number;
  fetchImpl?: typeof fetch;
}

export const fetchJsonWithPolicy = async (
  url: string,
  init: RequestInit,
  parentSignal: AbortSignal,
  options: FetchPolicyOptions = {},
): Promise<unknown> => {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_RETRIES;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    if (parentSignal.aborted) {
      throw new AppError("REQUEST_CANCELLED", "Generation was cancelled.");
    }

    const controller = new AbortController();
    let timedOut = false;
    const abortFromParent = () => controller.abort();
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    parentSignal.addEventListener("abort", abortFromParent, { once: true });

    try {
      const response = await fetchImpl(url, {
        ...init,
        redirect: "manual",
        signal: controller.signal,
      });
      const shouldRetry =
        response.status === 408 || response.status === 429 || response.status >= 500;
      if (shouldRetry && attempt < maxRetries) {
        await waitFor(getRetryDelay(response, attempt), parentSignal);
        continue;
      }

      if (!response.ok) {
        throw mapHttpError(response);
      }

      try {
        return await response.json();
      } catch {
        if (parentSignal.aborted) {
          throw new AppError("REQUEST_CANCELLED", "Generation was cancelled.");
        }
        if (timedOut) {
          throw new AppError("TIMEOUT", "The Provider request timed out.");
        }
        throw new AppError("OUTPUT_INVALID", "The Provider returned an invalid response.");
      }
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      if (parentSignal.aborted) {
        throw new AppError("REQUEST_CANCELLED", "Generation was cancelled.");
      }
      if (timedOut) {
        if (attempt < maxRetries) {
          await waitFor(500 * 2 ** attempt, parentSignal);
          continue;
        }
        throw new AppError("TIMEOUT", "The Provider request timed out.");
      }
      if (attempt < maxRetries) {
        await waitFor(500 * 2 ** attempt, parentSignal);
        continue;
      }
      throw new AppError("NETWORK_ERROR", "The Provider could not be reached.");
    } finally {
      clearTimeout(timeout);
      parentSignal.removeEventListener("abort", abortFromParent);
    }
  }

  throw new AppError("NETWORK_ERROR", "The Provider could not be reached.");
};
