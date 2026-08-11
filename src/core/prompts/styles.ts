export const BUILT_IN_STYLE_SEED_VERSION = 1;

export interface BuiltInStyleSeed {
  id: string;
  version: number;
  label: string;
  instruction: string;
}

export const BUILT_IN_STYLES: readonly BuiltInStyleSeed[] = [
  {
    id: "professional",
    version: 1,
    label: "Professional",
    instruction: "Write with clarity, credibility, restraint, and concrete language.",
  },
  {
    id: "concise",
    version: 1,
    label: "Concise",
    instruction: "Remove filler and make every sentence carry one useful point.",
  },
  {
    id: "friendly",
    version: 1,
    label: "Friendly",
    instruction: "Sound natural, warm, approachable, and easy to engage with.",
  },
  {
    id: "humorous",
    version: 1,
    label: "Humorous",
    instruction: "Use light, clever humor without insulting people or forcing jokes.",
  },
  {
    id: "sharp",
    version: 1,
    label: "Sharp",
    instruction: "Take a clear position with tension and precision, without personal attacks.",
  },
  {
    id: "storytelling",
    version: 1,
    label: "Storytelling",
    instruction: "Use a concrete scene, tension, and an earned insight.",
  },
  {
    id: "educational",
    version: 1,
    label: "Educational",
    instruction: "Explain the idea accurately with an orderly, easy-to-follow structure.",
  },
  {
    id: "thought-leadership",
    version: 1,
    label: "Thought Leadership",
    instruction: "Offer an original judgment, useful industry context, and a defensible takeaway.",
  },
  {
    id: "product-launch",
    version: 1,
    label: "Product Launch",
    instruction:
      "Lead with user value, show differentiation, and end with a grounded call to action.",
  },
  {
    id: "personal-reflection",
    version: 1,
    label: "Personal Reflection",
    instruction: "Use a candid first-person voice with specific details and a genuine realization.",
  },
] as const;

export type BuiltInStyleId = (typeof BUILT_IN_STYLES)[number]["id"];

export const isStyleId = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= 80 &&
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

export const getBuiltInStyle = (styleId: string) =>
  BUILT_IN_STYLES.find((style) => style.id === styleId);
