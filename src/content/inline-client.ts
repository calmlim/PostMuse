import {
  createRequestId,
  type ExtensionResponse,
  type ExtensionResponseMap,
} from "../core/contracts/messages";
import type { GenerationInput, RegenerationInput } from "../core/generation/types";

type InlineRequestInput =
  | { type: "inline.bootstrap" }
  | { type: "inline.generate"; input: GenerationInput }
  | { type: "inline.regenerate"; input: RegenerationInput }
  | {
      type: "inline.history.sync";
      historyId: string;
      result: import("../core/generation/types").GenerationResult;
    }
  | { type: "inline.cancel"; targetRequestId: string }
  | { type: "inline.openSidePanel"; input?: GenerationInput };

export async function sendInlineRequest<T extends InlineRequestInput>(
  request: T,
  options: { requestId?: string } = {},
): Promise<ExtensionResponseMap[T["type"]]> {
  const response = (await chrome.runtime.sendMessage({
    ...request,
    requestId: options.requestId ?? createRequestId(),
  })) as ExtensionResponse<ExtensionResponseMap[T["type"]]>;
  if (!response?.ok) {
    const error = new Error(response?.error.message ?? "The inline request failed.");
    error.name = response?.error.code ?? "INTERNAL_ERROR";
    throw error;
  }
  return response.data;
}
