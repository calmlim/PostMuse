import type { GenerationInput } from "../generation/types";

export const createOutputSchema = (input: GenerationInput): Record<string, unknown> => {
  if (input.contentType === "thread") {
    return {
      type: "object",
      additionalProperties: false,
      required: ["threads"],
      properties: {
        threads: {
          type: "array",
          minItems: 1,
          maxItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["posts"],
            properties: {
              posts: {
                type: "array",
                minItems: input.threadCount,
                maxItems: input.threadCount,
                items: { type: "string" },
              },
            },
          },
        },
      },
    };
  }

  return {
    type: "object",
    additionalProperties: false,
    required: ["candidates"],
    properties: {
      candidates: {
        type: "array",
        minItems: input.candidateCount,
        maxItems: input.candidateCount,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["text"],
          properties: { text: { type: "string" } },
        },
      },
    },
  };
};
